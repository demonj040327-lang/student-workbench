import type { StudyDocument, StudyProgress, StudySource } from './studyTypes';

const DATABASE = 'student-workbench-app-study-v1';
let databasePromise: Promise<IDBDatabase> | undefined;
const deletedSources = new Set<string>();

function sourceKey(cacheKey: string): string | undefined {
  try {
    const parts = JSON.parse(cacheKey) as unknown;
    return Array.isArray(parts) ? JSON.stringify(parts.slice(0, 2)) : undefined;
  } catch { return undefined; }
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('此浏览器无法保存学习进度。可以继续阅读，但刷新后需要重新解析。'));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents', { keyPath: 'key' });
      request.result.createObjectStore('progress', { keyPath: 'key' });
    };
    request.onerror = () => { settled = true; reject(request.error ?? new Error('无法打开学习存储。')); };
    request.onblocked = () => { settled = true; reject(new Error('请关闭其他旧版页面后重新打开学习资料。')); };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => { database.close(); databasePromise = undefined; };
      settled = true;
      resolve(database);
    };
  }).catch((error: unknown) => { databasePromise = undefined; throw error; });
  return databasePromise;
}

async function digest(bytes: ArrayBuffer): Promise<string> {
  if (!crypto.subtle) throw new Error('需要通过 localhost 或 HTTPS 打开页面才能安全识别课件版本。');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function studyCacheKey(source: StudySource): Promise<string> {
  if (!source.courseId || !source.id) throw new Error('课件必须归入一门课程。');
  const fingerprint = source.blob
    ? await digest(await source.blob.arrayBuffer())
    : await digest(new TextEncoder().encode(JSON.stringify({ url: source.url, materialId: source.materialId, version: source.version ?? '1' })).buffer);
  return JSON.stringify([source.courseId, source.id, fingerprint]);
}

async function readValue<T>(storeName: string, key: string): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    let value: T | undefined;
    request.onsuccess = () => { value = request.result?.value as T | undefined; };
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('读取学习记录失败。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('读取学习记录已中止。'));
  });
}

async function saveValue<T>(storeName: string, key: string, value: T): Promise<void> {
  const identity = sourceKey(key);
  if (identity && deletedSources.has(identity)) throw new Error('这份课件已删除，学习记录不会继续保存。');
  const database = await openDatabase();
  if (identity && deletedSources.has(identity)) throw new Error('这份课件已删除，学习记录不会继续保存。');
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const request = transaction.objectStore(storeName).put({ key, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('学习记录保存失败，可能存储空间不足。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('学习记录未保存。'));
  });
}

export function emptyStudyProgress(): StudyProgress {
  return { completedUnits: [], answers: {}, updatedAt: new Date().toISOString() };
}

export const loadStudyDocument = (key: string) => readValue<StudyDocument>('documents', key);
export const saveStudyDocument = (key: string, document: StudyDocument) => saveValue('documents', key, document);
export const loadStudyProgress = (key: string) => readValue<StudyProgress>('progress', key);
export const saveStudyProgress = (key: string, progress: StudyProgress) => saveValue('progress', key, progress);

export async function deleteStudyForSource(courseId: string, sourceId: string): Promise<void> {
  // Late saves from a recently closed reader must not recreate a deleted source.
  deletedSources.add(JSON.stringify([courseId, sourceId]));
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['documents', 'progress'], 'readwrite');
    for (const storeName of ['documents', 'progress']) {
      const request = transaction.objectStore(storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        try {
          const parts = JSON.parse(String(cursor.key)) as unknown;
          if (Array.isArray(parts) && parts[0] === courseId && parts[1] === sourceId) cursor.delete();
        } catch { /* A malformed unrelated entry is never removed by a source-scoped deletion. */ }
        cursor.continue();
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('删除课件学习缓存失败。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('课件学习缓存未删除。'));
  });
}
