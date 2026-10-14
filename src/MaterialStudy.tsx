import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { emptyStudyProgress, loadStudyDocument, loadStudyProgress, saveStudyDocument, saveStudyProgress, studyCacheKey } from './studyStore';
import type { StudyAnswer, StudyDocument, StudyProgress, StudyServiceStatus, StudySource, StudyTutorial } from './studyTypes';
import StudyAnswerText from './StudyAnswerText';

type Tab = 'study' | 'ask' | 'pages';
type ConversationEntry = StudyAnswer & { question: string; label: string };
const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function readResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new Error('学习服务暂时无法连接，请确认本机学习服务已启动后重试。');
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value?.error === 'string' ? value.error : typeof value?.message === 'string' ? value.message : '学习服务无法处理这次请求，请重试。');
  return value as T;
}

async function fileBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  if (blob.size > MAX_FILE_BYTES) throw new Error('这个课件超过 25 MB，请先压缩文件或按章节拆分后上传。');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const cancel = () => { reader.abort(); reject(new DOMException('请求已取消', 'AbortError')); };
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    const cleanup = () => signal.removeEventListener('abort', cancel);
    reader.onload = () => { cleanup(); resolve(String(reader.result).split(',')[1] ?? ''); };
    reader.onerror = () => { cleanup(); reject(new Error('无法读取这个文件，请重新上传后再试。')); };
    reader.onabort = () => { cleanup(); reject(new DOMException('请求已取消', 'AbortError')); };
    reader.readAsDataURL(blob);
  });
}

async function parsePayload(source: StudySource, signal: AbortSignal, mode: 'local' | 'ai' = 'local'): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = { courseId: source.courseId, name: source.name, mimeType: source.type, mode };
  if (source.blob) payload.contentBase64 = await fileBase64(source.blob, signal);
  else { payload.materialId = source.materialId ?? source.id; if (source.url) payload.url = source.url; }
  if (mode === 'ai') payload.allowExternal = true;
  return payload;
}

function validateDocument(value: StudyDocument, courseId: string): StudyDocument {
  if (!value || value.courseId !== courseId || !Array.isArray(value.pages) || !Array.isArray(value.units)) {
    throw new Error('返回的资料与当前课程不匹配，学习记录未加载。请重试。');
  }
  if (!value.pages.some(page => typeof page.text === 'string' && page.text.trim())) {
    throw new Error('没有提取到可阅读的文字。这可能是扫描课件，暂时需要上传包含可选中文字的 PDF 或 PPTX。');
  }
  return value;
}

function pageLabel(pages: number[]): string {
  const unique = [...new Set(pages)].sort((a, b) => a - b);
  if (!unique.length) return '页码待确认';
  if (unique.length === 1) return `第 ${unique[0]} 页`;
  const contiguous = unique.every((page, index) => index === 0 || page === unique[index - 1] + 1);
  return contiguous ? `第 ${unique[0]}–${unique[unique.length - 1]} 页` : `第 ${unique.join('、')} 页`;
}

function matchingTutorial(question: string, tutorials: StudyTutorial[]): StudyTutorial | undefined {
  const normalized = question.toLocaleLowerCase();
  const matches = tutorials.map(tutorial => ({
    tutorial,
    score: tutorial.keywords.reduce((score, keyword) => {
      const term = keyword.trim().toLocaleLowerCase();
      if (term.length < 2) return score;
      const contained = /^[a-z0-9]{2,3}$/.test(term)
        ? new RegExp(`\\b${term}\\b`, 'i').test(normalized)
        : normalized.includes(term);
      return score + (contained ? term.length : 0);
    }, 0),
  })).filter(match => match.score > 0).sort((a, b) => b.score - a.score);
  return matches[0]?.tutorial;
}

export default function MaterialStudy({ source, onBack }: { source: StudySource; onBack: () => void }) {
  const [document, setDocument] = useState<StudyDocument | null>(null);
  const [progress, setProgress] = useState<StudyProgress>(emptyStudyProgress);
  const [tab, setTab] = useState<Tab>('study');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [activeUnit, setActiveUnit] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [originalUrl, setOriginalUrl] = useState(source.url ?? '');
  const [service, setService] = useState<StudyServiceStatus | null>(null);
  const [askMode, setAskMode] = useState<'local' | 'ai'>('local');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [askError, setAskError] = useState('');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [savedMessage, setSavedMessage] = useState('');
  const cacheKeyRef = useRef('');
  const generationRef = useRef(0);
  const askControllerRef = useRef<AbortController | null>(null);
  const routeControllerRef = useRef<AbortController | null>(null);
  const progressRef = useRef(progress);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const responseEndRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  progressRef.current = progress;

  useEffect(() => {
    if (!source.blob) { setOriginalUrl(source.url ?? ''); return; }
    const url = URL.createObjectURL(source.blob);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source.blob, source.url]);

  useEffect(() => {
    const generation = ++generationRef.current;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;
    askControllerRef.current?.abort();
    routeControllerRef.current?.abort();
    cacheKeyRef.current = '';
    setDocument(null);
    setProgress(emptyStudyProgress());
    setTab('study');
    setLoading(true);
    setError('');
    setStorageNotice('');
    setService(null);
    setActiveUnit('');
    setActivePage(1);
    setQuestion('');
    setConversation([]);
    setAskError('');
    setAsking(false);
    setRouteBusy(false);
    setRouteError('');
    setAskMode('local');
    setSavedMessage('');

    fetch('/api/study/status', { signal: controller.signal }).then(readResponse<StudyServiceStatus>).then(status => {
      if (isCurrent()) { setService(status); setAskMode(status.aiConfigured ? 'ai' : 'local'); }
    }).catch(() => { /* Parsing can still provide a useful service error if status is unavailable. */ });

    async function load() {
      try {
        if (source.blob && source.blob.size > MAX_FILE_BYTES) throw new Error('这个课件超过 25 MB，请先压缩文件或按章节拆分后上传。');
        let cacheKey = '';
        let cached: StudyDocument | undefined;
        let saved: StudyProgress | undefined;
        try {
          cacheKey = await studyCacheKey(source);
          [cached, saved] = await Promise.all([loadStudyDocument(cacheKey), loadStudyProgress(cacheKey)]);
        } catch (cacheError: unknown) {
          if (isCurrent()) setStorageNotice(cacheError instanceof Error ? cacheError.message : '本地存储不可用，此次进度可能无法保存。');
        }
        if (!isCurrent()) return;
        cacheKeyRef.current = cacheKey;
        let loaded: StudyDocument;
        if (cached) loaded = validateDocument(cached, source.courseId);
        else {
          const payload = await parsePayload(source, controller.signal);
          if (!isCurrent()) return;
          const response = await fetch('/api/study/parse', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal,
          });
          loaded = validateDocument(await readResponse<StudyDocument>(response), source.courseId);
          if (!isCurrent()) return;
          if (cacheKey) {
            try { await saveStudyDocument(cacheKey, loaded); }
            catch { if (isCurrent()) setStorageNotice('课件已解析，但无法保存至浏览器。刷新后需要重新解析。'); }
          }
        }
        if (!isCurrent()) return;
        const restored = saved ?? emptyStudyProgress();
        const selected = loaded.units.find(unit => unit.id === restored.activeUnitId)?.id ?? loaded.units[0]?.id ?? '';
        setDocument(loaded);
        setProgress(restored);
        setActiveUnit(selected);
        setActivePage(loaded.pages[0]?.page ?? 1);
        setLoading(false);
      } catch (loadError: unknown) {
        if (!isCurrent()) return;
        setError(loadError instanceof Error ? loadError.message : '课件解析失败，请重试。');
        setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); askControllerRef.current?.abort(); routeControllerRef.current?.abort(); generationRef.current += 1; };
  }, [source.courseId, source.id, source.url, source.materialId, source.blob, source.version, retry]);

  useEffect(() => { responseEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [conversation.length]);

  function updateProgress(next: StudyProgress) {
    const withTime = { ...next, updatedAt: new Date().toISOString() };
    progressRef.current = withTime;
    setProgress(withTime);
    setSavedMessage('');
    const key = cacheKeyRef.current;
    const generation = generationRef.current;
    if (!key) { setStorageNotice('此次学习记录无法保存，离开页面前请自行记录进度。'); return; }
    // Serialize writes so a fast second answer cannot be replaced by an earlier save.
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(() => saveStudyProgress(key, withTime)).then(() => {
      if (generationRef.current === generation) setSavedMessage('进度已保存');
    }).catch(() => { if (generationRef.current === generation) setStorageNotice('进度保存失败，请检查浏览器存储空间。'); });
  }

  function selectUnit(unitId: string) {
    setActiveUnit(unitId);
    updateProgress({ ...progressRef.current, activeUnitId: unitId });
  }

  function viewPage(page: number) {
    setActivePage(page);
    setTab('pages');
    requestAnimationFrame(() => window.document.getElementById(`material-page-${page}`)?.scrollIntoView({ block: 'start' }));
  }

  function completeUnit(unitId: string) {
    const old = progressRef.current;
    updateProgress({ ...old, completedUnits: old.completedUnits.includes(unitId) ? old.completedUnits : [...old.completedUnits, unitId] });
    const units = document?.units ?? [];
    const next = units[units.findIndex(unit => unit.id === unitId) + 1];
    if (next) selectUnit(next.id);
  }

  async function regenerateRoute(mode: 'local' | 'ai') {
    if (routeBusy || asking || (mode === 'ai' && !service?.aiConfigured)) return;
    const controller = new AbortController();
    routeControllerRef.current?.abort();
    routeControllerRef.current = controller;
    const generation = generationRef.current;
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;
    setRouteError('');
    setRouteBusy(true);
    try {
      const payload = await parsePayload(source, controller.signal, mode);
      if (!isCurrent()) return;
      const response = await fetch('/api/study/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal,
      });
      const loaded = validateDocument(await readResponse<StudyDocument>(response), source.courseId);
      if (!isCurrent()) return;
      const key = cacheKeyRef.current;
      const cleared = { ...emptyStudyProgress(), activeUnitId: loaded.units[0]?.id };
      if (key) {
        try {
          // Finish old route writes before replacing its progress with new unit IDs.
          await saveQueueRef.current.catch(() => {});
          if (!isCurrent()) return;
          await saveStudyDocument(key, loaded);
          await saveStudyProgress(key, cleared);
        } catch { if (isCurrent()) setStorageNotice('新路线已生成，但保存失败。刷新后可能恢复为旧路线。'); }
      }
      if (!isCurrent()) return;
      setDocument(loaded);
      progressRef.current = cleared;
      setProgress(cleared);
      setActiveUnit(loaded.units[0]?.id ?? '');
      setActivePage(loaded.pages[0]?.page ?? 1);
      setSavedMessage('已切换学习路线，模块进度重新开始');
      setTab('study');
    } catch (routeFailure: unknown) {
      if (isCurrent()) setRouteError(`${routeFailure instanceof Error ? routeFailure.message : '路线生成失败。'} 已保留之前的学习路线和进度。`);
    } finally { if (isCurrent()) setRouteBusy(false); }
  }

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const text = question.trim();
    if (!document || !text || asking || routeBusy) return;
    if (askMode === 'ai' && !service?.aiConfigured) return;
    setAskError('');
    const tutorial = askMode === 'local' ? matchingTutorial(text, source.tutorials ?? []) : undefined;
    if (tutorial) {
      const sources = tutorial.sourcePages.map(page => {
        const original = document.pages.find(item => item.page === page);
        return { page, title: original?.title ?? tutorial.title, excerpt: original?.text.slice(0, 280) ?? '' };
      });
      const sections = [tutorial.explanation, tutorial.example ? `辅助例子（原创）：\n${tutorial.example}` : '', tutorial.checkQuestion ? `试着解释：\n${tutorial.checkQuestion}` : ''].filter(Boolean);
      setConversation(old => [...old, { question: text, mode: 'local', label: '课程知识讲解 · 人工整理', answer: sections.join('\n\n'), grounded: true, sources }]);
      setQuestion('');
      questionRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    askControllerRef.current?.abort();
    askControllerRef.current = controller;
    const generation = generationRef.current;
    setAsking(true);
    try {
      const response = await fetch('/api/study/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ document, question: text, mode: askMode, allowExternal: askMode === 'ai' }),
      });
      const answer = await readResponse<StudyAnswer>(response);
      if (controller.signal.aborted || generationRef.current !== generation) return;
      if (!answer || typeof answer.answer !== 'string' || !Array.isArray(answer.sources)) throw new Error('回答格式不完整，请重试。');
      setConversation(old => [...old, { ...answer, question: text, label: answer.mode === 'ai' ? 'ELM 辅导' : '课件检索 · 原文片段' }]);
      setQuestion('');
      questionRef.current?.focus();
    } catch (askFailure: unknown) {
      if (!controller.signal.aborted && generationRef.current === generation) setAskError(askFailure instanceof Error ? askFailure.message : '这次问答失败，请重试。');
    } finally {
      if (!controller.signal.aborted && generationRef.current === generation) setAsking(false);
    }
  }

  function keyboardSubmit(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void ask(); }
  }

  const unit = document?.units.find(item => item.id === activeUnit);
  const completed = document?.units.filter(item => progress.completedUnits.includes(item.id)).length ?? 0;
  const total = document?.units.length ?? 0;
  const percentage = total ? Math.round(completed / total * 100) : 0;
  const isPdf = source.type.includes('pdf') || /\.pdf(?:$|\?)/i.test(source.name);
  const isPowerPoint = source.type.includes('presentation') || /\.pptx$/i.test(source.name);
  const tutorials = source.tutorials ?? [];
  const unitTutorials = unit ? tutorials.filter(tutorial => tutorial.sourcePages.some(page => unit.pages.includes(page))) : [];
  const allAnswersCorrect = !!unit && unit.questions.every(q => progress.answers[q.id]?.checked && progress.answers[q.id]?.option === q.answer);

  return <section className="material-study" aria-label={`${source.name} 学习空间`}>
    <div className="material-heading">
      <button className="material-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> 课程资料</button>
      <div className="material-title"><p>逐份课件学习</p><h2>{source.name}</h2></div>
      {originalUrl && <a className="material-original-link" href={originalUrl} target="_blank" rel="noreferrer" download={isPowerPoint ? source.name : undefined}>{isPowerPoint ? '下载原始 PPTX ↗' : '打开原文件 ↗'}</a>}
    </div>

    {loading && <div className="material-state" role="status"><span className="material-loading-indicator" aria-hidden="true"/><h3>正在读取这份课件</h3><p>提取正文、页码与阅读模块。首次解析完成后会保存在本机浏览器。</p></div>}
    {error && <div className="material-state material-error" role="alert"><h3>还没有加载这份课件</h3><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>重新解析</button></div>}

    {document && <>
      <div className="material-summary">
        <div><strong>{completed}<span> / {total} 个模块完成</span></strong><p>{document.pages.length} 页 · {document.mode === 'ai' ? 'ELM 学习指导' : '材料导读 · 本机提取'}{tutorials.length ? ` · ${tutorials.length} 个课程概念讲解` : ''}</p></div>
        <div className="material-progress"><span>{percentage}%</span><div role="progressbar" aria-label="本课件阅读模块进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{ width: `${percentage}%` }}/></div></div>
      </div>
      <details className="material-route-tools"><summary>学习路线来源 · {document.mode === 'ai' ? 'ELM 学习路线' : '本机材料导读'}</summary><p>本机路线按原文分段导读；ELM 可以进一步解释概念、设计理解题。切换路线会重新开始模块进度。</p>{service?.aiConfigured ? <p className="material-caption">点击生成时，学校 ELM 会使用这份课件的相关片段。</p> : <p className="material-caption">{service ? '学校 ELM 尚未配置，本机导读与检索可正常使用。' : '尚未确认学校 ELM 配置，本机导读与检索可先使用。'}</p>}<div className="material-route-actions"><button type="button" disabled={routeBusy || asking || document.mode === 'local'} onClick={() => void regenerateRoute('local')}>使用本机路线</button><button type="button" disabled={routeBusy || asking || !service?.aiConfigured} onClick={() => void regenerateRoute('ai')}>{routeBusy ? '正在生成学习路线…' : 'ELM 生成学习路线'}</button></div>{routeBusy && <p role="status" className="material-caption">正在根据课件生成分步讲解和理解题，完成前原路线仍可阅读。</p>}{routeError && <p className="material-ask-error" role="alert">{routeError}</p>}</details>
      <div className="material-tabs" role="tablist" aria-label="课件学习方式">
        {([{ id: 'study', label: '分步学习' }, { id: 'ask', label: '知识问答' }, { id: 'pages', label: '原文页' }] as { id: Tab; label: string }[]).map(item => <button key={item.id} type="button" id={`material-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`material-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => {
          const items: Tab[] = ['study', 'ask', 'pages'];
          const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!direction) return;
          event.preventDefault();
          const next = items[(items.indexOf(item.id) + direction + items.length) % items.length];
          setTab(next);
          window.document.getElementById(`material-tab-${next}`)?.focus();
        }}>{item.label}</button>)}
      </div>
      {document.warnings?.length > 0 && <details className="material-warnings"><summary>材料说明 · {document.warnings.length} 项</summary>{document.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
      {storageNotice && <p className="material-storage-notice" role="status">{storageNotice}</p>}

      {tab === 'study' && <div id="material-panel-study" role="tabpanel" aria-labelledby="material-tab-study" className="material-learning-layout">
        <nav className="material-unit-nav" aria-label="阅读模块">
          {document.units.map((item, index) => <button type="button" key={item.id} className={item.id === activeUnit ? 'material-unit-current' : ''} aria-current={item.id === activeUnit ? 'step' : undefined} onClick={() => selectUnit(item.id)}><span className={`material-unit-number ${progress.completedUnits.includes(item.id) ? 'material-unit-done' : ''}`}>{progress.completedUnits.includes(item.id) ? '✓' : String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{pageLabel(item.pages)}</small></span></button>)}
        </nav>
        {unit ? <article className="material-unit-content">
          <div className="material-section-heading"><div><p>{pageLabel(unit.pages)}</p><h3>{unit.title}</h3></div><span>{progress.completedUnits.includes(unit.id) ? '已完成' : '阅读中'}</span></div>
          <p className="material-overview">{unit.overview}</p>
          <section className="material-reading"><h4>按这个顺序读</h4><ol>{unit.readingSteps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
          {unitTutorials.length > 0 && <section className="material-tutorials"><h4>概念讲解</h4><p className="material-caption">依据课程材料人工整理；辅助例子为原创说明。</p>{unitTutorials.map(tutorial => <details key={tutorial.id} className="material-tutorial"><summary>{tutorial.title}<span>展开</span></summary><p>{tutorial.explanation}</p>{tutorial.example && <div className="material-example"><strong>辅助例子（原创）</strong><p>{tutorial.example}</p></div>}{tutorial.checkQuestion && <p className="material-selfcheck"><strong>停下来想一想</strong>{tutorial.checkQuestion}</p>}<button type="button" className="material-page-link" onClick={() => viewPage(tutorial.sourcePages[0] ?? unit.pages[0])}>{pageLabel(tutorial.sourcePages)} · 对照原文 →</button></details>)}</section>}
          <details className="material-guide-points"><summary>{document.mode === 'local' ? '材料导读 · 课件摘录' : '学习要点'}</summary>{document.mode === 'local' && <p className="material-caption">以下是原文摘句，用于定位内容；完整概念解释可使用课程讲解或 ELM 辅导。</p>}<ul>{unit.points.map((point, index) => <li key={index}>{point}</li>)}</ul><div className="material-page-links">{unit.pages.map(page => <button key={page} type="button" className="material-page-link" onClick={() => viewPage(page)}>第 {page} 页 ↗</button>)}</div></details>
          {unit.questions.length > 0 && <section className="material-questions"><h4>检查这一节的理解</h4>{document.mode === 'local' && <p className="material-caption">本机生成的材料定位练习。完成练习代表完成这一节，不等同于掌握整门课程。</p>}{unit.questions.map((q, questionIndex) => {
            const answer = progress.answers[q.id];
            const correct = answer?.checked && answer.option === q.answer;
            return <fieldset className="material-question" key={q.id}><legend>{questionIndex + 1}. {q.prompt}</legend><div className="material-options">{q.options.map((option, optionIndex) => <label key={optionIndex} className={`${answer?.option === optionIndex ? 'material-option-selected' : ''} ${answer?.checked && optionIndex === q.answer ? 'material-option-correct' : ''}`}><input type="radio" name={`material-answer-${q.id}`} value={optionIndex} checked={answer?.option === optionIndex} onChange={() => updateProgress({ ...progressRef.current, answers: { ...progressRef.current.answers, [q.id]: { option: optionIndex, checked: false } } })}/><span>{String.fromCharCode(65 + optionIndex)}</span><p>{option}</p></label>)}</div><button type="button" className="material-check-button" disabled={!answer} onClick={() => { if (answer) updateProgress({ ...progressRef.current, answers: { ...progressRef.current.answers, [q.id]: { ...answer, checked: true } } }); }}>检查答案</button>{answer?.checked && <div className={`material-explanation ${correct ? 'material-answer-correct' : ''}`} role="status"><strong>{correct ? '回答正确' : '再对照课件想一想'}</strong><p>{q.explanation}</p><div className="material-page-links">{q.sourcePages.map(page => <button type="button" key={page} className="material-page-link" onClick={() => viewPage(page)}>依据：第 {page} 页 ↗</button>)}</div></div>}</fieldset>;
          })}</section>}
          <div className="material-completion"><button type="button" disabled={unit.questions.length > 0 && !allAnswersCorrect} onClick={() => completeUnit(unit.id)}>{progress.completedUnits.includes(unit.id) ? '继续下一节' : unit.questions.length ? '完成这一节，继续' : '已完成阅读，继续'}</button><span aria-live="polite">{savedMessage || (unit.questions.length && !allAnswersCorrect ? '先完成这一节的理解检查' : '随时可以退出，进度会保存')}</span></div>
        </article> : <p className="material-state">没有可用模块。可以先查看原文页并提出问题。</p>}
      </div>}

      {tab === 'ask' && <div id="material-panel-ask" role="tabpanel" aria-labelledby="material-tab-ask" className="material-ask-panel">
        <div className="material-ask-intro"><h3>围绕这份课件提问</h3><p>问题与引用限定在「{source.name}」中，不会混入其他课程。</p></div>
        <div className="material-answer-modes" role="group" aria-label="问答模式"><button type="button" aria-pressed={askMode === 'local'} onClick={() => setAskMode('local')}>{tutorials.length ? '课程讲解与本机检索' : '本机检索'}</button><button type="button" aria-pressed={askMode === 'ai'} onClick={() => setAskMode('ai')}>ELM 辅导</button></div>
        {askMode === 'local' ? <p className="material-caption">{tutorials.length ? '已整理概念会显示中文课程讲解；其他问题返回相关原文片段。' : '查找课件中的相关片段，不会把检索摘句当成 AI 解释。'}不会发送到外部模型。</p> : <div className="material-elm-consent">{service?.aiConfigured ? <p>ELM 会使用这份课件与当前问题相关的片段，给出解释并引用来源。</p> : <p>{service ? '学校 ELM 尚未配置。请在本机后端配置入口完成设置，再重新打开这份资料。' : '尚未确认学校 ELM 配置。可以先使用本机检索。'}</p>}</div>}
        {conversation.length === 0 && tutorials.length > 0 && <div className="material-question-suggestions"><span>可以从这里开始</span>{tutorials.slice(0, 4).map(tutorial => <button type="button" key={tutorial.id} onClick={() => { setQuestion(`请解释${tutorial.title}`); questionRef.current?.focus(); }}>{tutorial.title} ↗</button>)}</div>}
        <div className="material-conversation" aria-label="本课件问答记录">{conversation.map((entry, index) => <article className="material-conversation-entry" key={index}><div className="material-user-question"><span>你的问题</span><p>{entry.question}</p></div><div className="material-response"><span>{entry.label}</span><StudyAnswerText text={entry.answer}/>{!entry.grounded && <p className="material-grounding-note">这份材料中未找到充分依据，请补充相关页或换一个问题。</p>}{entry.sources.length > 0 && <details className="material-response-sources"><summary>对照原文 · {entry.sources.length} 处引用</summary>{entry.sources.map((citation, citationIndex) => <div key={`${citation.page}-${citationIndex}`}><button type="button" className="material-page-link" onClick={() => viewPage(citation.page)}>第 {citation.page} 页 · {citation.title} ↗</button><blockquote>{citation.excerpt}</blockquote></div>)}</details>}</div></article>)}<div ref={responseEndRef}/></div>
        <form className="material-ask-form" onSubmit={event => void ask(event)}><label htmlFor="material-ask-question">你的问题</label><textarea ref={questionRef} id="material-ask-question" rows={3} maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={keyboardSubmit} placeholder="例如：这一页的概念是什么意思？能结合课件举例吗？" disabled={asking || routeBusy}/><div><span>⌘ / Ctrl + Enter 发送</span><button type="submit" disabled={asking || routeBusy || !question.trim() || (askMode === 'ai' && (!service?.aiConfigured))}>{asking ? askMode === 'ai' ? 'ELM 正在回答…' : '正在检索课件…' : '发送问题 →'}</button></div>{askError && <p className="material-ask-error" role="alert">{askError}</p>}</form>
      </div>}

      {tab === 'pages' && <div id="material-panel-pages" role="tabpanel" aria-labelledby="material-tab-pages" className="material-pages-panel"><div className="material-page-toolbar"><label>跳到<select value={activePage} onChange={event => viewPage(Number(event.target.value))}>{document.pages.map(page => <option key={page.page} value={page.page}>第 {page.page} 页 · {page.title.slice(0, 38)}</option>)}</select></label>{originalUrl && <a href={isPdf ? `${originalUrl}#page=${activePage}` : originalUrl} target="_blank" rel="noreferrer" download={isPowerPoint ? source.name : undefined}>{isPdf ? `打开 PDF 第 ${activePage} 页 ↗` : isPowerPoint ? '下载原 PPTX ↗' : '打开原文件 ↗'}</a>}</div><p className="material-caption">下面为提取的原文文字，便于检索和对照页码；图表、版式与公式请查看原文件。{isPowerPoint ? 'PPTX 不在浏览器中假装成 PDF 展示。' : ''}</p><div className="material-page-texts">{document.pages.map(page => <article id={`material-page-${page.page}`} key={page.page} className={`material-original-page ${activePage === page.page ? 'material-page-active' : ''}`}><header><span>第 {page.page} 页</span><h3>{page.title}</h3>{isPdf && originalUrl && <a href={`${originalUrl}#page=${page.page}`} target="_blank" rel="noreferrer">PDF 原页 ↗</a>}</header><p>{page.text || '这一页没有可提取文字，请对照原文件查看图表。'}</p></article>)}</div></div>}
    </>}
  </section>;
}
