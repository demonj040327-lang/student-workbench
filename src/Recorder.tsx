import { useEffect, useRef, useState } from 'react';
import { saveAsset } from './storage';

type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'saving' | 'error';

function recordingError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return '麦克风权限未获允许。可以在浏览器设置中允许麦克风后重试。';
    if (error.name === 'NotFoundError') return '没有找到可用的麦克风，请连接设备后重试。';
    if (error.name === 'NotReadableError') return '麦克风暂时无法使用，请检查是否被其他程序占用。';
    if (error.name === 'QuotaExceededError') return '本地存储空间不足，录音未保存。请清理文件后再试。';
  }
  return error instanceof Error ? error.message : '录音失败，请重试。';
}

function supportedMimeType(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
}

export default function Recorder({ courseId, onSaved }: { courseId: string; onSaved: () => void }) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    generationRef.current += 1;
    setStatus('idle');
    setSeconds(0);
    setError('');
    setSaved(false);
    return () => {
      generationRef.current += 1;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      streamRef.current = null;
      busyRef.current = false;
    };
  }, [courseId]);

  useEffect(() => {
    if (status !== 'recording') return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  async function startRecording() {
    if (busyRef.current) return;
    busyRef.current = true;
    // A fresh attempt invalidates any late stop/error event from an earlier recording.
    generationRef.current += 1;
    setError('');
    setSaved(false);
    setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      busyRef.current = false;
      setStatus('error');
      setError('此浏览器无法录音。请使用支持录音的浏览器，并通过 HTTPS 或 localhost 打开页面。');
      return;
    }
    setStatus('requesting');
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      let recordingFailed = false;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recordingFailed = true;
        stream?.getTracks().forEach((track) => track.stop());
        if (!isCurrent()) return;
        busyRef.current = false;
        setError('录音设备出现错误，录音未保存。请检查麦克风后重试。');
        setStatus('error');
      };
      recorder.onstop = async () => {
        stream?.getTracks().forEach((track) => track.stop());
        if (!isCurrent()) return;
        recorderRef.current = null;
        streamRef.current = null;
        if (recordingFailed) {
          busyRef.current = false;
          return;
        }
        setStatus('saving');
        try {
          const type = recorder.mimeType || mimeType || (chunks[0] instanceof Blob ? chunks[0].type : '') || 'audio/webm';
          const blob = new Blob(chunks, { type });
          if (blob.size === 0) throw new Error('未录到音频，请检查麦克风后重试。');
          const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          await saveAsset(courseId, blob, `课堂录音-${stamp}.${extension}`);
          if (!isCurrent()) return;
          busyRef.current = false;
          setStatus('idle');
          setSaved(true);
          onSavedRef.current();
        } catch (saveError: unknown) {
          if (!isCurrent()) return;
          busyRef.current = false;
          setError(recordingError(saveError));
          setStatus('error');
        }
      };
      recorder.start(1000);
      setStatus('recording');
    } catch (startError: unknown) {
      stream?.getTracks().forEach((track) => track.stop());
      if (!isCurrent()) return;
      busyRef.current = false;
      streamRef.current = null;
      recorderRef.current = null;
      setError(recordingError(startError));
      setStatus('error');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setStatus('saving');
    recorder.stop();
  }

  const duration = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <section className="recorder" aria-label="课堂录音">
      <div>
        <strong>课堂录音</strong>
        <p className="muted">本地录音 · 尚未转写</p>
      </div>
      <p className="muted">请先取得授课者与相关人员同意。</p>
      <div className="recorder-controls">
        {status === 'recording' ? (
          <>
            <span className="recorder-timer" role="timer" aria-label={`已录音 ${duration}`}>{duration}</span>
            <button className="button button-primary" type="button" onClick={stopRecording}>结束并保存</button>
          </>
        ) : (
          <button className="button" type="button" onClick={() => void startRecording()} disabled={status === 'requesting' || status === 'saving'}>
            {status === 'requesting' ? '等待麦克风授权…' : status === 'saving' ? '正在保存…' : '开始录音'}
          </button>
        )}
      </div>
      {saved && <p className="muted" role="status">录音已保存至本课程资料。</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </section>
  );
}
