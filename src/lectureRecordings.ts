export type LectureRecording = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  createdAt: string;
  durationMs: number;
  status: 'recording' | 'saved' | 'interrupted';
  mimeType: string;
  audioSource?: 'microphone' | 'display';
  transcript: string;
  originalTranscript: string;
  translation: string;
  translatedSource: string;
  warning?: string;
  targetLanguage: 'zh' | 'en';
  explanation: string;
  explanationSource: string;
};
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return (database ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('workbench-classroom-recordings-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('records', { keyPath: 'id' });
      request.result.createObjectStore('chunks', {
        keyPath: ['recordId', 'index'],
      });
    };
    request.onerror = () => {
      database = undefined;
      reject(new Error('录音存储无法打开。'));
    };
    request.onblocked = () => {
      database = undefined;
      reject(new Error('请关闭旧录音页面后重试。'));
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
  }));
}
export async function recordingTransaction<T>(
  scope: string,
  stores: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction, set: (value: T) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T;
    run(tx, (v) => {
      value = v;
    });
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(new Error(scope));
    tx.onabort = () => reject(new Error(scope));
  });
}
export function saveRecording(record: LectureRecording, demo: boolean) {
  return recordingTransaction<void>(
    '录音文字未保存，请检查存储空间。',
    ['records'],
    'readwrite',
    (tx) => {
      tx.objectStore('records').put({ ...record, demo });
    },
  );
}
export async function listRecordings(demo: boolean) {
  return recordingTransaction<LectureRecording[]>(
    '录音记录读取失败。',
    ['records'],
    'readonly',
    (tx, set) => {
      const request = tx.objectStore('records').getAll();
      request.onsuccess = () =>
        set(
          request.result
            .filter((r) => r.demo === demo)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
    },
  );
}
export function addRecordingChunk(recordId: string, index: number, blob: Blob) {
  return recordingTransaction<void>(
    '录音音频未保存，请检查存储空间。',
    ['chunks'],
    'readwrite',
    (tx) => {
      tx.objectStore('chunks').put({ recordId, index, blob });
    },
  );
}
export async function recordingAudio(record: LectureRecording) {
  const blob = await recordingTransaction<Blob>(
    '录音音频读取失败。',
    ['chunks'],
    'readonly',
    (tx, set) => {
      const request = tx
        .objectStore('chunks')
        .getAll(
          IDBKeyRange.bound(
            [record.id, 0],
            [record.id, Number.MAX_SAFE_INTEGER],
          ),
        );
      request.onsuccess = () =>
        set(
          new Blob(
            request.result.map((r) => r.blob),
            { type: record.mimeType || 'audio/webm' },
          ),
        );
    },
  );
  return prepareRecordingAudio(blob, record.durationMs);
}
export async function prepareRecordingAudio(blob: Blob, durationMs: number) {
  if (blob.size && blob.type.includes('webm') && durationMs > 0) {
    try {
      const { fixWebmDuration } = await import('@fix-webm-duration/fix');
      return await fixWebmDuration(blob, durationMs, { logger: false });
    } catch {
      return blob;
    }
  }
  return blob;
}
export function removeRecording(id: string) {
  return recordingTransaction<void>(
    '录音删除失败。',
    ['records', 'chunks'],
    'readwrite',
    (tx) => {
      tx.objectStore('records').delete(id);
      tx.objectStore('chunks').delete(
        IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]),
      );
    },
  );
}
