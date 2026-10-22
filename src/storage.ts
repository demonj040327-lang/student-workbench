export type StoredAsset = {
  id: string;
  courseId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  blob: Blob;
};

const DATABASE_NAME = 'student-workbench-app-assets-v1';
const STORE_NAME = 'assets';
let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器无法使用本地文件存储。'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    let settled = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('courseId', 'courseId', { unique: false });
    };
    request.onerror = () => {
      settled = true;
      reject(request.error ?? new Error('无法打开本地文件存储。'));
    };
    request.onblocked = () => {
      settled = true;
      reject(new Error('本地文件存储被另一标签页占用，请关闭其他页面后重试。'));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      settled = true;
      resolve(database);
    };
  }).catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function listAssets(courseId: string): Promise<StoredAsset[]> {
  if (!courseId.trim()) throw new Error('请先选择课程，再查看文件。');
  const database = await openDatabase();
  return new Promise<StoredAsset[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).index('courseId').getAll(courseId);
    let assets: StoredAsset[] = [];
    request.onsuccess = () => {
      assets = request.result as StoredAsset[];
    };
    transaction.oncomplete = () => {
      resolve(assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('读取文件失败。'));
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('读取文件失败。'));
  });
}

export async function saveAsset(courseId: string, file: File | Blob, name?: string): Promise<StoredAsset> {
  if (!courseId.trim()) throw new Error('请先选择课程，再保存文件。');
  const database = await openDatabase();
  const asset: StoredAsset = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    courseId,
    name: name ?? (typeof File !== 'undefined' && file instanceof File ? file.name : '未命名文件'),
    type: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  return new Promise<StoredAsset>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).put(asset);
    transaction.oncomplete = () => resolve(asset);
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('保存文件失败，可能已达到浏览器存储上限。'));
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('保存文件失败，可能已达到浏览器存储上限。'));
  });
}

export async function deleteAsset(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('删除文件失败。'));
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('删除文件失败。'));
  });
}
