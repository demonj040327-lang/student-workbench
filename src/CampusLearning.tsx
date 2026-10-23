import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n';
import { studyRequest, errorMessage } from './studyClient';
import StudyAnswerText from './StudyAnswerText';
import type { StudyAnswer } from './studyTypes';
import type {
  CampusMaterial,
  PersonalApi,
  StudentProgress,
} from './campusStore';
import Icon from './CampusIcons';
import { Alert, Empty, Meter } from './CampusUI';

type Props = {
  material: CampusMaterial;
  progress: StudentProgress;
  onProgress: (change: (p: StudentProgress) => StudentProgress) => void;
  api: PersonalApi | null;
  onConnect: () => void;
  onBack: () => void;
};
export default function CampusLearning({
  material,
  progress,
  onProgress,
  api,
  onConnect,
  onBack,
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'guide' | 'practice' | 'ask' | 'source'>(
    'guide',
  );
  const [activeUnit, setActiveUnit] = useState(0);
  const [sourcePage, setSourcePage] = useState(1);
  const [question, setQuestion] = useState('');
  const [searchOnly, setSearchOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<
    { question: string; result: StudyAnswer }[]
  >([]);
  const abort = useRef<AbortController | null>(null);
  const [fileUrl, setFileUrl] = useState(material.document.originalUrl?.startsWith('/api/study/local-library/file/') ? material.document.originalUrl : '');
  const units = material.document.units;
  const unit = units[activeUnit] || units[0];
  const completed = units.filter((u) => progress.units[u.id]).length;
  const questions = units.flatMap((u) => u.questions);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!material.blob) return;
    const url = URL.createObjectURL(material.blob);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [material.blob]);
  const page =
    material.document.pages.find((p) => p.page === sourcePage) ||
    material.document.pages[0];
  function openSource(page: number) {
    setSourcePage(page);
    setTab('source');
  }
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    if (!searchOnly && !api) {
      onConnect();
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError('');
    const text = question.trim();
    try {
      const result = await studyRequest<StudyAnswer>(
        'ask',
        {
          document: material.document,
          question: text,
          mode: searchOnly ? 'local' : 'ai',
          allowExternal: true,
          credentialScope: 'student',
          ...(!searchOnly ? { personalApi: api } : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setHistory((h) => [...h, { question: text, result }]);
        setQuestion('');
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="cp-learning">
      <button className="cp-back" onClick={onBack}>
        ← {t('返回课程资料')}
      </button>
      <header className="cp-page-heading">
        <div>
          <span className="cp-eyebrow">
            {material.weekUnconfirmed ? t('周次待确认') : t('第 {week} 周', { week: material.week })} <span> / </span>{' '}
            {t('课程学习')}
          </span>
          <h1>{t(material.title)}</h1>
          <p>
            {material.name} ·{' '}
            {t('{count} 页资料', { count: material.document.pages.length })} ·{' '}
            {material.example ? t('人工编写的演示内容') : t('教师已发布')}
          </p>
        </div>
        <div className="cp-learning-progress">
          <strong>
            {completed}
            <small> / {units.length}</small>
          </strong>
          <span>{t('个模块已完成')}</span>
          <Meter
            percent={
              units.length ? Math.round((completed / units.length) * 100) : 0
            }
            label={t('学习模块完成度')}
          />
        </div>
      </header>
      <nav className="cp-tabs" aria-label={t('课件学习导航')}>
        {(
          [
            ['guide', '分步指导', 'layers'],
            ['practice', '课后练习', 'check'],
            ['ask', '课件问答', 'message'],
            ['source', '原文资料', 'file'],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            <Icon name={icon} size={17} />
            {t(label)}
            {key === 'practice' && <small>{questions.length}</small>}
          </button>
        ))}
      </nav>
      {tab === 'guide' &&
        (unit ? (
          <div className="cp-guide-layout">
            <aside className="cp-unit-list">
              <span className="cp-eyebrow">{t('学习路径')}</span>
              {units.map((u, i) => (
                <button
                  key={u.id}
                  className={activeUnit === i ? 'active' : ''}
                  onClick={() => setActiveUnit(i)}
                >
                  <span className={progress.units[u.id] ? 'done' : ''}>
                    {progress.units[u.id] ? (
                      <Icon name="check" size={15} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <div>
                    <strong>{t(u.title)}</strong>
                    <small>
                      {t('第 {pages} 页', { pages: u.pages.join(', ') })}
                    </small>
                  </div>
                  <Icon name="chevron" size={15} />
                </button>
              ))}
            </aside>
            <article className="cp-unit-content cp-card">
              <span className="cp-eyebrow">
                MODULE {String(activeUnit + 1).padStart(2, '0')}
              </span>
              <h2>{t(unit.title)}</h2>
              <p className="cp-unit-overview">{t(unit.overview)}</p>
              <h3>{t('需要理解的知识点')}</h3>
              <ul className="cp-point-list">
                {unit.points.map((point, i) => (
                  <li key={i}>
                    <Icon name="check" size={16} />
                    {t(point)}
                  </li>
                ))}
              </ul>
              <h3>{t('跟着这几步学习')}</h3>
              <ol className="cp-reading-steps">
                {unit.readingSteps.map((step, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    <p>{t(step)}</p>
                  </li>
                ))}
              </ol>
              <div className="cp-source-links">
                {unit.pages.map((page) => (
                  <button key={page} onClick={() => openSource(page)}>
                    <Icon name="file" size={14} />
                    {t('第 {page} 页', { page })} ↗
                  </button>
                ))}
              </div>
              <footer>
                <label className="cp-check-label">
                  <input
                    type="checkbox"
                    checked={!!progress.units[unit.id]}
                    onChange={(e) =>
                      onProgress((p) => ({
                        ...p,
                        units: { ...p.units, [unit.id]: e.target.checked },
                      }))
                    }
                  />
                  {t('我已完成这个模块')}
                </label>
                <button
                  className="cp-button"
                  onClick={() => {
                    if (activeUnit < units.length - 1)
                      setActiveUnit(activeUnit + 1);
                    else setTab('practice');
                  }}
                >
                  {t(
                    activeUnit < units.length - 1
                      ? '下一个模块'
                      : '开始课后练习',
                  )}
                  <Icon name="arrow" size={16} />
                </button>
              </footer>
              <small className="cp-muted">
                {t('勾选记录学习进度，不代表已经掌握知识。')}
              </small>
            </article>
          </div>
        ) : (
          <Empty title={t('教师尚未发布学习指导')}>
            <p>{t('你可以先阅读原文，或针对课件提问。')}</p>
            <button className="cp-button" onClick={() => setTab('source')}>
              {t('阅读原文')}
            </button>
          </Empty>
        ))}
      {tab === 'practice' && (
        <div className="cp-practice-layout">
          <div className="cp-practice-heading">
            <h2>{t('用几个问题，检查自己的理解')}</h2>
            <p>{t('先独立作答，再查看解释和课件出处。')}</p>
          </div>
          {!questions.length && <Empty title={t('这份课件暂时没有练习')} />}{' '}
          {questions.map((q, i) => {
            const state = progress.answers[q.id];
            const checked = !!state?.checked;
            const correct = state?.option === q.answer;
            return (
              <article className="cp-card cp-question" key={q.id}>
                <span className="cp-eyebrow">
                  QUESTION {String(i + 1).padStart(2, '0')}
                </span>
                <h3>{t(q.prompt)}</h3>
                <fieldset disabled={checked}>
                  <legend className="cp-sr">{t('选择一个答案')}</legend>
                  {q.options.map((option, j) => (
                    <label
                      key={j}
                      className={`${state?.option === j ? 'selected' : ''} ${checked && j === q.answer ? 'correct' : ''} ${checked && state?.option === j && !correct ? 'incorrect' : ''}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={state?.option === j}
                        onChange={() =>
                          onProgress((p) => ({
                            ...p,
                            answers: {
                              ...p.answers,
                              [q.id]: { option: j, checked: false },
                            },
                          }))
                        }
                      />
                      <span>{'ABCD'[j]}</span>
                      <p>{t(option)}</p>
                      {checked && j === q.answer && (
                        <Icon name="check" size={18} />
                      )}
                    </label>
                  ))}
                </fieldset>
                {checked ? (
                  <div
                    className={`cp-feedback ${correct ? 'correct' : 'incorrect'}`}
                    role="status"
                  >
                    <strong>
                      {t(correct ? '回答正确' : '再看一下这个知识点')}
                    </strong>
                    <p>{t(q.explanation)}</p>
                    {q.sourcePages.map((page) => (
                      <button
                        key={page}
                        className="cp-link"
                        onClick={() => openSource(page)}
                      >
                        {t('查看第 {page} 页', { page })} ↗
                      </button>
                    ))}
                    <button
                      className="cp-link"
                      onClick={() =>
                        onProgress((p) => ({
                          ...p,
                          answers: {
                            ...p.answers,
                            [q.id]: { ...p.answers[q.id], checked: false },
                          },
                        }))
                      }
                    >
                      {t('重新作答')}
                    </button>
                  </div>
                ) : (
                  <button
                    className="cp-button primary"
                    disabled={!state}
                    onClick={() =>
                      onProgress((p) => ({
                        ...p,
                        answers: {
                          ...p.answers,
                          [q.id]: { ...p.answers[q.id], checked: true },
                        },
                      }))
                    }
                  >
                    {t('检查答案')}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {tab === 'ask' && (
        <div className="cp-ask-layout">
          <section className="cp-card cp-chat">
            <header>
              <Icon name="message" />
              <div>
                <h2>{t('针对这份课件提问')}</h2>
                <p>{t('回答附带原文出处，方便回到课件核对。')}</p>
              </div>
              <span className={`cp-status ${api ? 'connected' : ''}`}>
                {t(api ? '个人 API 已设置' : '个人 API 未设置')}
              </span>
            </header>
            <div className="cp-chat-history" aria-live="polite">
              {!history.length && (
                <div className="cp-chat-start">
                  <span className="cp-chat-mark">
                    <Icon name="book" size={28} />
                  </span>
                  <h3>{t('从一个不懂的知识点开始')}</h3>
                  <p>{t('可以要求换个例子、比较概念，或解释某个术语。')}</p>
                  <div className="cp-suggestions">
                    {material.document.pages.slice(0, 3).map((page) => (
                      <button
                        key={page.page}
                        onClick={() =>
                          setQuestion(`${t('解释')} ${page.title}`)
                        }
                      >
                        {page.title}
                        <Icon name="arrow" size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {history.map((item, i) => (
                <div className="cp-chat-turn" key={i}>
                  <div className="cp-user-message">{item.question}</div>
                  <article className="cp-model-message">
                    <span className="cp-eyebrow">
                      {t(
                        item.result.mode === 'ai'
                          ? 'ELM · 课件讲解'
                          : '原文检索结果',
                      )}
                    </span>
                    <StudyAnswerText text={item.result.answer} />
                    <div className="cp-source-links">
                      {item.result.sources.map((source) => (
                        <button
                          key={source.page}
                          title={source.excerpt}
                          onClick={() => openSource(source.page)}
                        >
                          <Icon name="file" size={14} />
                          {t('第 {page} 页', { page: source.page })} ↗
                        </button>
                      ))}
                    </div>
                  </article>
                </div>
              ))}
              {busy && (
                <p className="cp-loading" role="status">
                  <i />
                  {t('正在阅读相关课件片段…')}
                </p>
              )}
            </div>
            {error && <Alert>{t(error)}</Alert>}
            <form className="cp-chat-form" onSubmit={ask}>
              <label className="cp-sr" htmlFor="course-question">
                {t('输入你的问题')}
              </label>
              <textarea
                id="course-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('这部分不太理解，可以举个例子吗？')}
                maxLength={2000}
                rows={2}
                disabled={busy}
              />
              <div>
                <label className="cp-check-label">
                  <input
                    type="checkbox"
                    checked={searchOnly}
                    onChange={(e) => setSearchOnly(e.target.checked)}
                    disabled={busy}
                  />
                  {t('只检索原文')}
                </label>
                <button
                  className="cp-button primary"
                  disabled={busy || !question.trim()}
                >
                  {t(!searchOnly && !api ? '连接 API 并提问' : '发送问题')}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </form>
            <p className="cp-fineprint">
              {t(
                'AI 问答使用你自己的 API。发送问题时，仅向 ELM 提交当前课件的相关文字片段。',
              )}
            </p>
          </section>
          <aside className="cp-card cp-ask-aside">
            <span className="cp-eyebrow">{t('当前资料')}</span>
            <Icon name="file" size={30} />
            <h3>{t(material.title)}</h3>
            <p>{material.name}</p>
            <div className="cp-divider" />
            <h4>{t('让问题更具体')}</h4>
            <ul>
              <li>{t('使用课件中的术语')}</li>
              <li>{t('指出不理解的定义或步骤')}</li>
              <li>{t('要求一个例子后自己再解释一次')}</li>
            </ul>
            <button className="cp-button" onClick={onConnect}>
              <Icon name="key" size={16} />
              {t('管理个人 API')}
            </button>
          </aside>
        </div>
      )}
      {tab === 'source' && (
        <section className="cp-card cp-original">
          <header>
            <div>
              <h2>{t('原文资料')}</h2>
              <p>{t('页序来自文件解析；PPTX 按幻灯片顺序展示。')}</p>
            </div>
            {fileUrl && (
              <a className="cp-button" href={fileUrl} download={material.name}>
                <Icon name="download" size={16} />
                {t('下载课件')}
              </a>
            )}
          </header>
          <div className="cp-original-layout">
            <nav aria-label={t('原文页码')}>
              {material.document.pages.map((p) => (
                <button
                  key={p.page}
                  className={sourcePage === p.page ? 'active' : ''}
                  onClick={() => setSourcePage(p.page)}
                >
                  <span>{String(p.page).padStart(2, '0')}</span>
                  {p.title || t('第 {page} 页', { page: p.page })}
                </button>
              ))}
            </nav>
            <article>
              <span className="cp-eyebrow">
                {t('第 {page} 页', { page: page?.page || 1 })}
              </span>
              <h2>{page?.title}</h2>
              <div className="cp-source-text">
                {page?.text ||
                  t('这一页没有可提取的文字，请下载原件查看图示。')}
              </div>
              {fileUrl && material.name.toLowerCase().endsWith('.pdf') && (
                <iframe
                  src={`${fileUrl}#page=${page?.page || 1}`}
                  title={t('课件 PDF 预览')}
                />
              )}
            </article>
          </div>
          {material.document.warnings.length > 0 && (
            <details className="cp-extraction-notes">
              <summary>{t('文件解析说明')}</summary>
              {material.document.warnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
            </details>
          )}
        </section>
      )}
    </section>
  );
}
