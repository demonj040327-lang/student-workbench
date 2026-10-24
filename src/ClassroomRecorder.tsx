import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CampusCourse, PersonalApi } from './campusStore';
import { useI18n } from './i18n';
import Icon from './CampusIcons';
import StudyAnswerText from './StudyAnswerText';
import { Alert } from './CampusUI';
import { studyRequest, errorMessage } from './studyClient';
import {
  beginClassroomCapture,
  requestClassroomDisplay,
  type ClassroomAudioSource,
  type ClassroomCapture,
} from './classroomCapture';
import {
  addRecordingChunk,
  listRecordings,
  recordingAudio,
  prepareRecordingAudio,
  removeRecording,
  saveRecording,
  type LectureRecording,
} from './lectureRecordings';
import './classroomRecorder.css';

type Props = {
  courses: CampusCourse[];
  courseId: string;
  materialTitle?: string;
  demo: boolean;
  api: PersonalApi | null;
  onConnect: () => void;
  onExpanded: (value: boolean) => void;
};
type Phase = 'idle' | 'starting' | 'recording' | 'stopping';
const clock = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}`;
export default function ClassroomRecorder({
  courses,
  courseId,
  materialTitle,
  demo,
  api,
  onConnect,
  onExpanded,
}: Props) {
  const { language, locale, t } = useI18n();
  const tr = (zh: string, en: string) => (language === 'en' ? en : zh);
  const [open, setOpen] = useState(false),
    [phase, setPhase] = useState<Phase>('idle'),
    [record, setRecord] = useState<LectureRecording | null>(null),
    [history, setHistory] = useState<LectureRecording[]>([]);
  const [selectedCourse, setSelectedCourse] = useState(courseId),
    [tab, setTab] = useState<'transcript' | 'translation' | 'explanation'>(
      'transcript',
    );
  const [audioSource, setAudioSource] = useState<ClassroomAudioSource>(
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
      ? 'display'
      : 'microphone',
  );
  const [transcribe, setTranscribe] = useState(true),
    [autoTranslate, setAutoTranslate] = useState(false),
    [interim, setInterim] = useState(''),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState(''),
    [warning, setWarning] = useState(''),
    [notice, setNotice] = useState(''),
    [aiBusy, setAiBusy] = useState(false),
    [audioUrl, setAudioUrl] = useState(''),
    [saveState, setSaveState] = useState<'saved' | 'pending' | 'failed'>(
      'saved',
    );
  const current = useRef(record),
    phaseRef = useRef(phase),
    apiRef = useRef(api),
    capture = useRef<ClassroomCapture | null>(null),
    disposed = useRef(false),
    saving = useRef<Promise<void>>(Promise.resolve()),
    chunkIndex = useRef(new Map<string, number>()),
    memoryChunks = useRef<Blob[]>([]),
    storageFailed = useRef(false),
    started = useRef(0),
    autoSession = useRef(''),
    translationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    ),
    request = useRef<AbortController | null>(null),
    aiLock = useRef(false),
    topButton = useRef<HTMLButtonElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    deleted = useRef(new Set<string>()),
    lastCourse = useRef(courseId),
    transcriptField = useRef<HTMLTextAreaElement>(null),
    selection = useRef<{
      start: number;
      end: number;
      scroll: number;
      follow: boolean;
    } | null>(null);
  current.current = record;
  phaseRef.current = phase;
  apiRef.current = api;
  const active = phase !== 'idle';
  function update(
    next: LectureRecording | null | ((r: LectureRecording) => LectureRecording),
  ) {
    const value =
      typeof next === 'function'
        ? current.current
          ? next(current.current)
          : null
        : next;
    current.current = value;
    setRecord(value);
    setSaveState('pending');
  }
  function changePhase(value: Phase) {
    phaseRef.current = value;
    setPhase(value);
  }
  function expand(value: boolean) {
    setOpen(value);
    onExpanded(value);
    if (!value) topButton.current?.focus();
  }
  async function refreshHistory() {
    try {
      const rows = await listRecordings(demo);
      if (!disposed.current) setHistory(rows);
    } catch (e) {
      if (!disposed.current) setError(errorMessage(e));
    }
  }
  useEffect(() => {
    disposed.current = false;
    void refreshHistory();
    return () => {
      disposed.current = true;
      capture.current?.abort();
      request.current?.abort();
      clearTimeout(translationTimer.current);
      const r = current.current;
      if (r)
        void saveRecording(
          {
            ...r,
            status: phaseRef.current === 'idle' ? r.status : 'interrupted',
            durationMs:
              phaseRef.current === 'idle'
                ? r.durationMs
                : started.current
                  ? Date.now() - started.current
                  : 0,
          },
          demo,
        ).catch(() => {});
    };
  }, [demo]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
  }, [open]);
  useEffect(() => {
    if (lastCourse.current !== courseId && phaseRef.current === 'idle') {
      lastCourse.current = courseId;
      setSelectedCourse(courseId);
      const previous = current.current;
      if (previous)
        void saveRecording(previous, demo).catch((e) =>
          setError(errorMessage(e)),
        );
      autoSession.current = '';
      update(null);
      setAudioUrl('');
      setElapsed(0);
    }
  }, [courseId]);
  useEffect(() => {
    if (!record) return;
    const timer = setTimeout(() => {
      const r = current.current;
      if (!r || deleted.current.has(r.id)) return;
      void saveRecording(
        {
          ...r,
          durationMs:
            phaseRef.current === 'recording'
              ? Date.now() - started.current
              : r.durationMs,
        },
        demo,
      )
        .then(() => {
          if (!disposed.current && current.current?.id === r.id) {
            setSaveState('saved');
            setHistory((h) => [r, ...h.filter((v) => v.id !== r.id)]);
          }
        })
        .catch((e) => {
          if (!disposed.current) {
            storageFailed.current = true;
            setSaveState('failed');
            setError(errorMessage(e));
          }
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [record, demo]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(
      () => setElapsed(Date.now() - started.current),
      250,
    );
    const checkpoint = setInterval(() => {
      const r = current.current;
      if (r)
        void saveRecording(
          { ...r, durationMs: Date.now() - started.current },
          demo,
        ).catch((e) => {
          if (!disposed.current) {
            setError(errorMessage(e));
            setSaveState('failed');
          }
        });
    }, 2000);
    return () => {
      clearInterval(timer);
      clearInterval(checkpoint);
    };
  }, [phase, demo]);
  useEffect(() => {
    if (!active) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    addEventListener('beforeunload', unload);
    return () => removeEventListener('beforeunload', unload);
  }, [active]);
  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);
  function storeChunk(id: string, blob: Blob) {
    if (current.current?.id === id) memoryChunks.current.push(blob);
    const index = chunkIndex.current.get(id) || 0;
    chunkIndex.current.set(id, index + 1);
    saving.current = saving.current
      .then(() => addRecordingChunk(id, index, blob))
      .catch((e) => {
        storageFailed.current = true;
        if (!disposed.current) {
          setError(errorMessage(e));
          setSaveState('failed');
        }
      });
  }
  function receiveText(id: string, text: string, pending: string) {
    if (disposed.current || current.current?.id !== id) return;
    setInterim(pending);
    if (text === current.current.originalTranscript) return;
    const field = transcriptField.current;
    if (field)
      selection.current = {
        start: field.selectionStart,
        end: field.selectionEnd,
        scroll: field.scrollTop,
        follow:
          document.activeElement !== field &&
          field.scrollHeight - field.scrollTop - field.clientHeight < 40,
      };
    update((r) => {
      const edited = r.transcript !== r.originalTranscript;
      const extension = text.startsWith(r.originalTranscript)
        ? text.slice(r.originalTranscript.length)
        : '';
      return {
        ...r,
        originalTranscript: text,
        transcript: edited ? r.transcript + extension : text,
      };
    });
  }
  useLayoutEffect(() => {
    const field = transcriptField.current,
      saved = selection.current;
    if (field && saved) {
      if (document.activeElement === field)
        field.setSelectionRange(saved.start, saved.end);
      field.scrollTop = saved.follow ? field.scrollHeight : saved.scroll;
      selection.current = null;
    }
  }, [record?.transcript]);
  async function start() {
    if (phaseRef.current !== 'idle' || aiLock.current) return;
    if (autoTranslate && !api) {
      onConnect();
      return;
    }
    const course =
      courses.find((c) => c.id === selectedCourse) ||
      courses.find((c) => c.id === courseId) ||
      courses[0];
    if (!course) return;
    changePhase('starting');
    const previous = current.current;
    let displayStream: MediaStream | undefined;
    try {
      // Request sharing while the start click still has transient activation.
      if (audioSource === 'display')
        displayStream = await requestClassroomDisplay();
      if (disposed.current) {
        displayStream?.getTracks().forEach((track) => track.stop());
        return;
      }
      if (previous) await saveRecording(previous, demo);
    } catch (e) {
      displayStream?.getTracks().forEach((track) => track.stop());
      if (!disposed.current) {
        setError(errorMessage(e));
        changePhase('idle');
      }
      return;
    }
    setError('');
    setWarning('');
    setNotice('');
    setInterim('');
    setElapsed(0);
    setAudioUrl('');
    storageFailed.current = false;
    memoryChunks.current = [];
    started.current = 0;
    autoSession.current = '';
    const id = crypto.randomUUID();
    const next: LectureRecording = {
      id,
      courseId: course.id,
      courseName: course.name,
      title: `${course.code}${course.id === courseId && materialTitle ? ' · ' + materialTitle : ''} · ${new Date().toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
      durationMs: 0,
      status: 'recording',
      mimeType: '',
      audioSource,
      transcript: '',
      originalTranscript: '',
      translation: '',
      translatedSource: '',
      targetLanguage: 'zh',
      explanation: '',
      explanationSource: '',
    };
    update(next);
    changePhase('starting');
    setTab('transcript');
    try {
      const result = await beginClassroomCapture(
        transcribe,
        {
          onText: (text, pending) => receiveText(id, text, pending),
          onChunk: (blob) => storeChunk(id, blob),
          onWarning: (message) => {
            if (!disposed.current) {
              setWarning(message);
              update((r) => ({ ...r, warning: message }));
            }
          },
          onDeviceEnded: () => {
            void stop();
          },
        },
        displayStream,
      );
      if (disposed.current) {
        result.capture.abort();
        return;
      }
      capture.current = result.capture;
      started.current = Date.now();
      update((r) => ({ ...r, mimeType: result.mimeType }));
      await saveRecording(current.current!, demo);
      if (disposed.current) {
        result.capture.abort();
        return;
      }
      autoSession.current = autoTranslate ? id : '';
      changePhase('recording');
    } catch (e) {
      capture.current?.abort();
      capture.current = null;
      if (!disposed.current) {
        changePhase('idle');
        update((r) => ({ ...r, status: 'interrupted' }));
        setError(errorMessage(e));
      }
    }
  }
  async function stop() {
    if (phaseRef.current !== 'recording' || !capture.current) return;
    changePhase('stopping');
    const durationMs = Date.now() - started.current;
    setElapsed(durationMs);
    setNotice('');
    try {
      await capture.current.stop();
      await saving.current;
      if (disposed.current) return;
      const latest = current.current;
      if (!latest) return;
      const saved = {
        ...latest,
        durationMs,
        status: storageFailed.current
          ? ('interrupted' as const)
          : ('saved' as const),
      };
      update(saved);
      await saveRecording(saved, demo);
      const blob = await prepareRecordingAudio(
        new Blob(memoryChunks.current, { type: saved.mimeType }),
        saved.durationMs,
      );
      if (blob.size) setAudioUrl(URL.createObjectURL(blob));
      if (!disposed.current)
        setNotice(
          storageFailed.current
            ? tr(
                '存储不完整，请立即下载录音。',
                'Storage is incomplete. Download the audio now.',
              )
            : tr(
                '录音已保存，可以编辑文字和回听。',
                'Recording saved. Edit your text or play it back.',
              ),
        );
      void refreshHistory();
    } catch (e) {
      if (!disposed.current) {
        setError(errorMessage(e));
        const latest = current.current;
        if (latest) {
          update({ ...latest, status: 'interrupted' });
          const blob = new Blob(memoryChunks.current, {
            type: latest.mimeType,
          });
          if (blob.size) setAudioUrl(URL.createObjectURL(blob));
        }
      }
    } finally {
      capture.current = null;
      if (!disposed.current) {
        changePhase('idle');
        setInterim('');
      }
    }
  }
  async function chooseRecord(id: string) {
    if (active || aiLock.current || deleted.current.has(id)) return;
    const previous = current.current;
    if (previous) {
      try {
        await saveRecording(previous, demo);
      } catch (e) {
        setError(errorMessage(e));
        return;
      }
    }
    autoSession.current = '';
    clearTimeout(translationTimer.current);
    setError('');
    setWarning('');
    setNotice('');
    setAudioUrl('');
    const found = history.find((r) => r.id === id);
    if (!found) {
      update(null);
      return;
    }
    const value = {
      ...found,
      status:
        found.status === 'recording' ? ('interrupted' as const) : found.status,
    };
    update(value);
    setWarning(value.warning || '');
    setSelectedCourse(value.courseId);
    setElapsed(value.durationMs);
    try {
      const blob = await recordingAudio(value);
      if (blob.size && current.current?.id === id)
        setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function appendTranslation(source: string, text: string, id: string) {
    if (current.current?.id !== id) return;
    update((r) => ({
      ...r,
      translation: r.translation + (r.translation ? '\n' : '') + text,
      translatedSource: source,
    }));
  }
  async function autoTranslateNext() {
    translationTimer.current = undefined;
    const r = current.current,
      credentials = apiRef.current;
    if (!r || autoSession.current !== r.id || aiLock.current || !credentials)
      return;
    if (!r.transcript.startsWith(r.translatedSource)) {
      autoSession.current = '';
      setWarning(
        tr(
          '原文已修改，自动翻译已暂停。你可以手动修改译文，或停止后重新翻译原文。',
          'Transcript edited. Auto-translation paused; edit the translation or translate again after stopping.',
        ),
      );
      return;
    }
    const remaining = r.transcript.slice(r.translatedSource.length);
    if (!remaining.trim()) {
      update((latest) => ({ ...latest, translatedSource: latest.transcript }));
      return;
    }
    if (phaseRef.current === 'recording' && remaining.trim().length < 35)
      return;
    let part = remaining.slice(0, 1800);
    if (remaining.length > 1800 && part.lastIndexOf(' ') > 1000)
      part = part.slice(0, part.lastIndexOf(' '));
    const end = r.translatedSource + part;
    aiLock.current = true;
    setAiBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await studyRequest<{ text: string }>(
        'classroom-text',
        {
          task: 'translate',
          text: part,
          context: r.translatedSource.slice(-500),
          targetLanguage: r.targetLanguage,
          credentialScope: 'student',
          personalApi: credentials,
          allowExternal: true,
        },
        controller.signal,
      );
      if (!disposed.current) appendTranslation(end, result.text, r.id);
    } catch (e) {
      if (!controller.signal.aborted && !disposed.current) {
        autoSession.current = '';
        setWarning(
          tr(
            '实时翻译已暂停；录音和转写继续。',
            'Live translation paused; recording and transcription continue.',
          ) +
            ' ' +
            errorMessage(e),
        );
      }
    } finally {
      aiLock.current = false;
      if (!disposed.current) setAiBusy(false);
    }
  }
  useEffect(() => {
    const r = current.current;
    if (
      !r ||
      autoSession.current !== r.id ||
      !api ||
      aiLock.current ||
      translationTimer.current ||
      r.transcript === r.translatedSource
    )
      return;
    translationTimer.current = setTimeout(() => {
      void autoTranslateNext();
    }, 1200);
  }, [record, api, aiBusy, phase]);
  async function generate(task: 'translate' | 'explain') {
    const r = current.current;
    if (!r || active || aiLock.current) return;
    if (!api) {
      onConnect();
      return;
    }
    const text = task === 'translate' ? r.transcript : r.translation;
    if (!text.trim()) return;
    autoSession.current = '';
    clearTimeout(translationTimer.current);
    aiLock.current = true;
    setAiBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    setNotice('');
    try {
      const result = await studyRequest<{ text: string }>(
        'classroom-text',
        {
          task,
          text,
          targetLanguage: r.targetLanguage,
          credentialScope: 'student',
          personalApi: api,
          allowExternal: true,
          confirmedTranslation: task === 'explain',
        },
        controller.signal,
      );
      if (disposed.current || current.current?.id !== r.id) return;
      if (
        (task === 'translate'
          ? current.current.transcript
          : current.current.translation) !== text
      ) {
        setNotice(
          tr(
            '文字已在请求期间修改，请重新生成。',
            'Text changed during the request. Generate again.',
          ),
        );
        return;
      }
      update((latest) =>
        task === 'translate'
          ? { ...latest, translation: result.text, translatedSource: text }
          : { ...latest, explanation: result.text, explanationSource: text },
      );
      setTab(task === 'translate' ? 'translation' : 'explanation');
    } catch (e) {
      if (!controller.signal.aborted && !disposed.current)
        setError(errorMessage(e));
    } finally {
      aiLock.current = false;
      if (!disposed.current) setAiBusy(false);
    }
  }
  async function deleteCurrent() {
    const r = current.current;
    if (!r || active || aiLock.current) return;
    deleted.current.add(r.id);
    autoSession.current = '';
    update(null);
    setAudioUrl('');
    setElapsed(0);
    try {
      await removeRecording(r.id);
      await refreshHistory();
    } catch (e) {
      deleted.current.delete(r.id);
      update(r);
      setError(errorMessage(e));
    }
  }
  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function downloadAudio() {
    if (!record) return;
    try {
      const blob = await recordingAudio(record);
      if (blob.size) setAudioUrl(URL.createObjectURL(blob));
      else
        setWarning(
          tr(
            '没有已保存的音频，文字仍可导出。',
            'No saved audio was found. You can still export text.',
          ),
        );
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const pending =
    !!api &&
    !!record &&
    autoSession.current === record.id &&
    record.transcript !== record.translatedSource;
  const visibleHistory = [
    ...(record ? [record] : []),
    ...history.filter((r) => r.id !== record?.id),
  ].filter(
    (r) => r.courseId === (record?.courseId || selectedCourse || courseId),
  );
  return (
    <>
      <button
        ref={topButton}
        type="button"
        className={`cp-recording-launch ${phase === 'recording' ? 'is-recording' : ''}`}
        aria-label={tr('课堂录音', 'Class recording')}
        aria-expanded={open}
        aria-controls="classroom-recorder"
        onClick={() => expand(!open)}
      >
        <Icon name="mic" size={17} />
        <span>
          {phase === 'recording'
            ? tr('录音中', 'Recording')
            : phase === 'starting'
              ? tr('连接中', 'Connecting')
              : phase === 'stopping'
                ? tr('保存中', 'Saving')
                : tr('课堂录音', 'Class recording')}
        </span>
        {active && <time>{clock(elapsed)}</time>}
        {active && <i />}
      </button>
      {createPortal(
        <div className="campus-app classroom-portal">
          <aside
            id="classroom-recorder"
            className="classroom-recorder"
            aria-label={tr('课堂录音面板', 'Class recording panel')}
            hidden={!open}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
                e.stopPropagation();
                expand(false);
              }
            }}
          >
            <header className="classroom-header">
              <div>
                <span className="classroom-kicker">
                  {tr('课堂助手', 'CLASSROOM')}
                </span>
                <h2>{tr('课堂录音', 'Class recording')}</h2>
              </div>
              <button
                ref={closeButton}
                className="cp-button classroom-collapse"
                aria-label={tr('收起录音面板', 'Collapse recording panel')}
                onClick={() => expand(false)}
                title={tr('收起不会结束录音', 'Minimizing keeps recording')}
              >
                <Icon name="chevron" size={16} />
                <span>{tr('收起', 'Minimize')}</span>
              </button>
            </header>
            <div className="classroom-body">
              <label>
                {tr('课程', 'Course')}
                <select
                  disabled={active || aiBusy || !!record}
                  value={record?.courseId || selectedCourse || courseId}
                  onChange={(e) => {
                    setSelectedCourse(e.target.value);
                    update(null);
                  }}
                >
                  {record && !courses.some((c) => c.id === record.courseId) && (
                    <option value={record.courseId}>{record.courseName}</option>
                  )}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {record && (
                <label>
                  {tr('录音标题', 'Recording title')}
                  <input
                    maxLength={120}
                    value={record.title}
                    onChange={(e) =>
                      update((r) => ({ ...r, title: e.target.value }))
                    }
                  />
                </label>
              )}
              {!active ? (
                <details className="classroom-source-options">
                  <summary>
                    {audioSource === 'display'
                      ? tr('视频／电脑声音', 'Video / computer audio')
                      : tr('麦克风', 'Microphone')}{' '}
                    · {tr('音频设置', 'Audio settings')}
                  </summary>
                  <label>
                    {tr('音频来源', 'Audio source')}
                    <select
                      value={audioSource}
                      onChange={(event) =>
                        setAudioSource(
                          event.target.value as ClassroomAudioSource,
                        )
                      }
                    >
                      <option
                        value="display"
                        disabled={!navigator.mediaDevices?.getDisplayMedia}
                      >
                        {tr(
                          '视频／系统音频 · 录播',
                          'Video / system audio · Recorded lecture',
                        )}
                      </option>
                      <option value="microphone">
                        {tr(
                          '麦克风 · 现场课堂',
                          'Microphone · In-person class',
                        )}
                      </option>
                    </select>
                  </label>
                </details>
              ) : (
                <p className="classroom-hint">
                  {record?.audioSource === 'display'
                    ? tr(
                        '正在采集视频／电脑声音',
                        'Capturing video / computer audio',
                      )
                    : tr('正在采集麦克风声音', 'Capturing microphone audio')}
                </p>
              )}
              {!active && audioSource === 'display' && (
                <p className="classroom-hint">
                  {tr(
                    '开始后选择播放视频的浏览器标签页，并勾选“分享标签页音频”。也可选系统提供的带音频窗口或屏幕；只保存声音，不保存画面。建议使用电脑端 Chrome 或 Edge。',
                    'After starting, select the browser tab playing your video and enable “Share tab audio”. Audio-enabled windows or screens can also work when supported. Only sound is saved, not video. Use desktop Chrome or Edge.',
                  )}
                </p>
              )}
              <div
                className={`classroom-capture ${phase === 'recording' ? 'active' : ''}`}
              >
                <div>
                  <span className="classroom-signal" />
                  <strong
                    role="timer"
                    aria-label={tr('录音时长', 'Recording duration')}
                  >
                    {clock(elapsed)}
                  </strong>
                  <small role="status">
                    {phase === 'starting'
                      ? tr(
                          '正在连接与请求音频…',
                          'Connecting and requesting audio…',
                        )
                      : phase === 'stopping'
                        ? tr(
                            '正在保存最后的音频与文字…',
                            'Saving final audio and text…',
                          )
                        : phase === 'recording'
                          ? tr(
                              '正在录制 · 翻页不会中断',
                              'Recording · Page changes keep recording',
                            )
                          : record
                            ? record.status === 'interrupted'
                              ? tr(
                                  '中断记录 · 已保留收到的内容',
                                  'Interrupted · Received content retained',
                                )
                              : tr('已结束', 'Stopped')
                            : tr('准备就绪', 'Ready')}
                  </small>
                </div>
                {phase === 'recording' ? (
                  <button
                    className="cp-button classroom-stop"
                    onClick={() => void stop()}
                  >
                    {tr('结束并保存', 'Stop & save')}
                  </button>
                ) : (
                  <button
                    className="cp-button primary"
                    disabled={active || aiBusy || !courses.length}
                    onClick={() => void start()}
                  >
                    {phase === 'starting' || phase === 'stopping'
                      ? tr('请稍候…', 'Please wait…')
                      : tr('开始新录音', 'Start new recording')}
                  </button>
                )}
              </div>
              {!active && (
                <div className="classroom-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={transcribe}
                      onChange={(e) => {
                        setTranscribe(e.target.checked);
                        if (!e.target.checked) setAutoTranslate(false);
                      }}
                    />
                    {tr(
                      '实时英文转写（本机）',
                      'Live English transcription (local)',
                    )}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!transcribe}
                      checked={autoTranslate}
                      onChange={(e) => {
                        setAutoTranslate(e.target.checked);
                        if (!e.target.checked) {
                          if (autoSession.current === current.current?.id)
                            request.current?.abort();
                          autoSession.current = '';
                          clearTimeout(translationTimer.current);
                        }
                      }}
                    />
                    {tr(
                      '实时翻译（使用个人 API）',
                      'Live translation (personal API)',
                    )}
                  </label>
                </div>
              )}
              <p className="classroom-privacy">
                {tr(
                  '录音保存在当前浏览器。转写在本机运行；开启翻译后，确认的文字会发送到你的模型服务。请先取得录音许可。',
                  'Audio stays in this browser. ASR runs locally; enabling translation sends confirmed text to your model provider. Obtain permission to record.',
                )}
              </p>
              {active && record && record.courseId !== courseId && (
                <p className="classroom-warning">
                  {tr(
                    `录音仍归属于 ${record.courseName}；请结束后再为当前课程新建录音。`,
                    `Recording is still linked to ${record.courseName}. Stop before starting a recording for the current course.`,
                  )}
                </p>
              )}
              {error && <Alert>{t(error)}</Alert>}
              {warning && (
                <p className="classroom-warning" role="status">
                  {t(warning)}
                </p>
              )}
              {notice && (
                <p className="cp-info" role="status">
                  {notice}
                </p>
              )}
              {!active && (
                <div className="classroom-history">
                  <label>
                    {tr('本课程录音', 'Recordings in this course')}
                    <select
                      aria-label={tr('选择历史录音', 'Choose saved recording')}
                      value={record?.id || ''}
                      disabled={aiBusy}
                      onChange={(e) => void chooseRecord(e.target.value)}
                    >
                      <option value="">
                        {tr('选择已保存录音', 'Choose a saved recording')}
                      </option>
                      {visibleHistory.map((r) => (
                        <option value={r.id} key={r.id}>
                          {r.title}
                          {r.status === 'recording' ||
                          r.status === 'interrupted'
                            ? tr(' · 中断记录', ' · Interrupted')
                            : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {record && (
                    <button
                      className="cp-link"
                      disabled={aiBusy}
                      onClick={() =>
                        void chooseRecord('').then(() => {
                          setElapsed(0);
                          setSelectedCourse(courseId);
                        })
                      }
                    >
                      {tr('切换课程 / 新记录', 'Change course / new record')}
                    </button>
                  )}
                </div>
              )}
              {record && (
                <>
                  <nav
                    className="classroom-tabs"
                    aria-label={tr('录音内容', 'Recording content')}
                  >
                    {(
                      [
                        ['transcript', tr('原文', 'Transcript')],
                        ['translation', tr('译文', 'Translation')],
                        ['explanation', tr('课程讲解', 'Explanation')],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={tab === value}
                        className={tab === value ? 'active' : ''}
                        onClick={() => setTab(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                  {tab === 'transcript' && (
                    <section>
                      <div className="classroom-edit-heading">
                        <label htmlFor="classroom-transcript">
                          {tr('原文（可编辑）', 'Transcript (editable)')}
                        </label>
                        <small>
                          {tr(
                            '新字幕追加，保留人工修改',
                            'New text appends; edits are kept',
                          )}
                        </small>
                      </div>
                      <textarea
                        ref={transcriptField}
                        id="classroom-transcript"
                        maxLength={100000}
                        rows={12}
                        value={record.transcript}
                        onChange={(e) =>
                          update((r) => ({ ...r, transcript: e.target.value }))
                        }
                        placeholder={tr(
                          '开始录音后，文字会持续出现在这里。',
                          'Start recording to see the live transcript.',
                        )}
                      />
                      {interim && (
                        <p
                          className="classroom-interim"
                          aria-label={tr('正在识别', 'Recognizing')}
                        >
                          {interim}…
                        </p>
                      )}
                      {record.transcript !== record.originalTranscript && (
                        <details className="classroom-original">
                          <summary>
                            {tr(
                              '对照原始识别文字',
                              'Compare original ASR text',
                            )}
                          </summary>
                          <p>{record.originalTranscript}</p>
                        </details>
                      )}
                      <button
                        className="cp-button"
                        disabled={
                          active ||
                          aiBusy ||
                          !record.transcript.trim() ||
                          record.transcript.length > 12000
                        }
                        onClick={() => void generate('translate')}
                      >
                        {record.translation
                          ? tr(
                              '重新翻译当前原文（替换译文）',
                              'Retranslate transcript (replace translation)',
                            )
                          : tr('翻译当前原文', 'Translate current transcript')}
                      </button>
                      {record.transcript.length > 12000 && (
                        <small>
                          {tr(
                            '一次重新翻译限 12,000 字符；实时翻译不受此单次限制。',
                            'One retranslation supports 12,000 characters; live translation continues incrementally.',
                          )}
                        </small>
                      )}
                    </section>
                  )}
                  {tab === 'translation' && (
                    <section>
                      <label>
                        {tr('翻译为', 'Translate to')}
                        <select
                          disabled={active || aiBusy || !!record.translation}
                          value={record.targetLanguage}
                          onChange={(e) =>
                            update((r) => ({
                              ...r,
                              targetLanguage: e.target.value as 'zh' | 'en',
                            }))
                          }
                        >
                          <option value="zh">中文</option>
                          <option value="en">English</option>
                        </select>
                      </label>
                      <label htmlFor="classroom-translation">
                        {tr('译文（可编辑）', 'Translation (editable)')}
                      </label>
                      <textarea
                        id="classroom-translation"
                        maxLength={100000}
                        rows={12}
                        value={record.translation}
                        onChange={(e) =>
                          update((r) => ({ ...r, translation: e.target.value }))
                        }
                        placeholder={tr(
                          '开启实时翻译，或结束后翻译原文。也可以粘贴并编辑已有译文。',
                          'Enable live translation, translate after recording, or paste and edit a translation.',
                        )}
                      />
                      <p className="classroom-hint">
                        {tr(
                          '确认译文后生成讲解；不会重新读取未修改的识别稿。',
                          'The explanation uses this edited translation, not the original ASR transcript.',
                        )}
                      </p>
                      <button
                        className="cp-button primary"
                        disabled={
                          active ||
                          aiBusy ||
                          pending ||
                          record.translation.length > 100000 ||
                          !record.translation.trim()
                        }
                        onClick={() => void generate('explain')}
                      >
                        {tr(
                          '确认译文并生成讲解',
                          'Confirm translation & explain',
                        )}
                      </button>
                      {record.translation.length > 100000 && (
                        <p className="classroom-warning">
                          {tr(
                            '译文超过单次讲解长度限制，请先整理至 100,000 字符内。',
                            'Translation exceeds the explanation limit. Edit it to fewer than 100,000 characters.',
                          )}
                        </p>
                      )}
                    </section>
                  )}
                  {tab === 'explanation' && (
                    <section>
                      {record.explanation ? (
                        <>
                          <p className="classroom-hint">
                            {tr(
                              'AI 根据课堂译文整理，并非教师原话。',
                              'AI explanation based on your translation; not a verbatim lecturer statement.',
                            )}
                          </p>
                          {record.explanationSource !== record.translation && (
                            <p className="classroom-warning">
                              {tr(
                                '译文已修改，讲解尚未更新。',
                                'Translation changed. Regenerate the explanation.',
                              )}
                            </p>
                          )}
                          <div className="classroom-explanation">
                            <StudyAnswerText text={record.explanation} />
                          </div>
                        </>
                      ) : (
                        <p className="classroom-hint">
                          {tr(
                            '先在译文标签中检查和修改文字，再生成课程讲解。',
                            'Review the Translation tab before generating an explanation.',
                          )}
                        </p>
                      )}
                      <button
                        className="cp-button"
                        disabled={
                          active ||
                          aiBusy ||
                          pending ||
                          record.translation.length > 100000 ||
                          !record.translation.trim()
                        }
                        onClick={() => void generate('explain')}
                      >
                        {tr(
                          '根据当前译文生成讲解',
                          'Explain current translation',
                        )}
                      </button>
                    </section>
                  )}
                  {(aiBusy || pending) && (
                    <p className="classroom-hint" role="status">
                      {tr(
                        '正在处理翻译或讲解，录音不受影响…',
                        'Processing translation or explanation; recording continues…',
                      )}
                    </p>
                  )}
                  {!active && audioUrl && (
                    <div className="classroom-playback">
                      <audio
                        controls
                        src={audioUrl}
                        aria-label={tr('录音回听', 'Recording playback')}
                      />
                      <a
                        className="cp-button"
                        href={audioUrl}
                        download={`${record.title}.${record.mimeType.includes('mp4') ? 'm4a' : record.mimeType.includes('ogg') ? 'ogg' : 'webm'}`}
                      >
                        <Icon name="download" size={14} />
                        {tr('下载完整录音', 'Download recording')}
                      </a>
                    </div>
                  )}
                  {!active && !audioUrl && record.status !== 'recording' && (
                    <button
                      className="cp-button"
                      onClick={() => void downloadAudio()}
                    >
                      {tr('读取已保存音频', 'Load saved audio')}
                    </button>
                  )}
                  <footer className="classroom-save">
                    <span>
                      {saveState === 'failed'
                        ? tr('本机保存失败', 'Local save failed')
                        : saveState === 'pending'
                          ? tr('正在保存…', 'Saving…')
                          : tr(
                              '文字已保存在此浏览器',
                              'Text saved in this browser',
                            )}
                    </span>
                    <button
                      className="cp-link"
                      onClick={() =>
                        download(
                          new Blob(
                            [
                              `# ${record.title}\n\n## Transcript\n${record.transcript}\n\n## Translation\n${record.translation}\n\n## Explanation\n${record.explanation}`,
                            ],
                            { type: 'text/plain;charset=utf-8' },
                          ),
                          `${record.title}.txt`,
                        )
                      }
                    >
                      {tr('导出文字', 'Export text')}
                    </button>
                  </footer>
                  {!active && (
                    <details className="classroom-delete">
                      <summary>
                        {tr('删除这条录音', 'Delete this recording')}
                      </summary>
                      <p>
                        {tr(
                          '这会删除本机音频、原文、译文和讲解。',
                          'Deletes local audio, transcript, translation and explanation.',
                        )}
                      </p>
                      <button
                        className="cp-button"
                        disabled={aiBusy}
                        onClick={() => void deleteCurrent()}
                      >
                        {tr('确认删除', 'Confirm delete')}
                      </button>
                    </details>
                  )}
                </>
              )}
              <button className="cp-link" onClick={onConnect}>
                {api
                  ? `${api.provider === 'deepseek' ? 'DeepSeek' : 'ELM'} · ${tr('管理个人 API', 'Manage personal API')}`
                  : tr(
                      '连接个人 API 以翻译和生成讲解',
                      'Connect your API for translation and explanation',
                    )}
              </button>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
