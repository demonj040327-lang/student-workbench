import {readLanguage} from './i18n';
import type {StudySource} from './studyTypes';

export async function studyRequest<T>(path: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/study/${path}`, {method: payload === undefined ? 'GET' : 'POST', headers: payload === undefined ? undefined : {'Content-Type': 'application/json'}, body: payload === undefined ? undefined : JSON.stringify({...payload as Record<string,unknown>,language:readLanguage()}), signal});
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('学习服务暂时无法连接，请检查本机服务后重试。');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败，请稍后重试。');
  return result as T;
}
export async function sourcePayload(source: StudySource, signal: AbortSignal) {
  if (!source.blob) return {courseId: source.courseId, name: source.name, materialId: source.materialId || source.id, url: source.url};
  if (source.blob.size > 25 * 1024 * 1024) throw new Error('上传文件不能超过 25 MB。');
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const cancel = () => reader.abort();
    if (signal.aborted) { reject(new DOMException('已取消', 'AbortError')); return; }
    signal.addEventListener('abort', cancel, {once: true});
    const cleanup = () => signal.removeEventListener('abort', cancel);
    reader.onload = () => {cleanup(); resolve(String(reader.result).split(',')[1] || '');};
    reader.onerror = () => {cleanup(); reject(new Error('文件读取失败。'));};
    reader.onabort = () => {cleanup(); reject(new DOMException('已取消', 'AbortError'));};
    reader.readAsDataURL(source.blob!);
  });
  return {courseId: source.courseId, name: source.name, mimeType: source.type, contentBase64};
}
export function uid() { return crypto.randomUUID(); }
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : '操作失败，请重试。'; }
