import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from './i18n';
import { sourcePayload, studyRequest, uid, errorMessage } from './studyClient';
import type { StudyDocument, StudyUnit } from './studyTypes';
import type { CampusCourse, CampusMaterial, PersonalApi } from './campusStore';
import Icon from './CampusIcons';
import { Alert, CampusDialog, Empty } from './CampusUI';

type Props = {
  course: CampusCourse;
  materials: CampusMaterial[];
  onSave: (material: CampusMaterial) => Promise<void>;
  api: PersonalApi | null;
  hostConfigured: boolean;
  onConnect: () => void;
};
export default function CampusTeacher({
  course,
  materials,
  onSave,
  api,
  hostConfigured,
  onConnect,
}: Props) {
  const { t } = useI18n();
  const [week, setWeek] = useState(5);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<CampusMaterial | null>(null);
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload(file?: File) {
    if (!file || busy) return;
    setError('');
    if (!/\.(pdf|pptx|docx|txt|md)$/i.test(file.name)) {
      setError('请上传 PDF、PPTX、DOCX、TXT 或 Markdown。');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('上传文件不能超过 25 MB。');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy('upload');
    try {
      const id = uid();
      const payload = await sourcePayload(
        {
          id,
          courseId: course.id,
          name: file.name,
          blob: file,
          type: file.type,
        },
        abort.signal,
      );
      const document = await studyRequest<StudyDocument>(
        'parse',
        { ...payload, mode: 'local' },
        abort.signal,
      );
      // Raw parsing is deliberately separate from a semantic model-generated guide.
      document.units = [];
      if (!abort.signal.aborted)
        await onSave({
          id,
          courseId: course.id,
          title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
          week,
          name: file.name,
          status: 'draft',
          document,
          blob: file,
          updatedAt: new Date().toISOString(),
        });
      if (!abort.signal.aborted) setTitle('');
    } catch (e) {
      if (!abort.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!abort.signal.aborted) {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    }
  }
  async function generate(material: CampusMaterial) {
    if (!api && !hostConfigured) {
      onConnect();
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(material.id);
    setError('');
    try {
      const document = await studyRequest<StudyDocument>(
        'generate',
        {
          document: material.document,
          credentialScope: 'teacher',
          ...(api ? { personalApi: api } : {}),
          allowExternal: true,
        },
        abort.signal,
      );
      if (!abort.signal.aborted) {
        const next: CampusMaterial = {
          ...material,
          document,
          status: 'draft',
          example: false,
          updatedAt: new Date().toISOString(),
        };
        await onSave(next);
        setEditor(next);
      }
    } catch (e) {
      if (!abort.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!abort.signal.aborted) setBusy(null);
    }
  }
  async function publish(material: CampusMaterial) {
    setError('');
    setBusy(material.id);
    try {
      await onSave({
        ...material,
        status: material.status === 'published' ? 'draft' : 'published',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="cp-teacher-materials">
      <div
        className="cp-course-cover"
        style={{ '--course-color': course.color } as React.CSSProperties}
      >
        <span className="cp-course-monogram">{course.code}</span>
        <div>
          <span className="cp-eyebrow">
            {t('教学课程')} / {course.code}
          </span>
          <h1>{t(course.name)}</h1>
          <p>
            {course.teacher} · {t(course.description)}
          </p>
        </div>
        <span className="cp-status connected">{t('教师工作区')}</span>
      </div>
      <div className="cp-teacher-workflow">
        {[
          ['01', '上传课程资料', '按周次归档课件'],
          ['02', '生成学习内容', '提炼指导与理解题'],
          ['03', '检查并发布', '让学生直接开始学习'],
        ].map(([n, title, body]) => (
          <div key={n}>
            <span>{n}</span>
            <div>
              <strong>{t(title)}</strong>
              <small>{t(body)}</small>
            </div>
            <Icon name="arrow" size={16} />
          </div>
        ))}
      </div>
      <section className="cp-card cp-upload-card">
        <div className="cp-section-heading">
          <div>
            <h2>{t('上传本周课件')}</h2>
            <p>{t('文件先保存为草稿，生成内容经你确认后再发布。')}</p>
          </div>
          <span className="cp-tag">PDF / PPTX / DOCX / TXT / MD</span>
        </div>
        <div className="cp-upload-meta">
          <label>
            {t('课件标题')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder={t('留空则使用文件名')}
              disabled={!!busy}
            />
          </label>
          <label>
            {t('课程周次')}
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              disabled={!!busy}
            >
              {Array.from({ length: 20 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {t('第 {week} 周', { week: i + 1 })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className={`cp-dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files[0]);
          }}
        >
          <span>
            <Icon name="upload" size={25} />
          </span>
          <h3>{t(busy === 'upload' ? '正在解析课件…' : '将课件拖到这里')}</h3>
          <p>{t('每份不超过 25 MB，支持选择文件上传。')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,.docx,.txt,.md"
            onChange={(e) => void upload(e.target.files?.[0])}
            disabled={!!busy}
            aria-label={t('选择课件文件')}
          />
          <button
            className="cp-button"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="plus" size={16} />
            {t('选择文件')}
          </button>
        </div>
      </section>
      {error && <Alert>{t(error)}</Alert>}
      <div className="cp-section-heading">
        <div>
          <span className="cp-eyebrow">COURSE MATERIALS</span>
          <h2>
            {t('课件与学习内容')} <small>{materials.length}</small>
          </h2>
        </div>
        <button className="cp-link" onClick={onConnect}>
          <Icon name="key" size={15} />
          {t(
            api
              ? '使用个人教学 API'
              : hostConfigured
                ? '使用本机教学接口'
                : '配置教学 API',
          )}
        </button>
      </div>
      <div className="cp-teacher-material-list">
        {materials.map((material) => (
          <article key={material.id} className="cp-card cp-teacher-material">
            <div className="cp-material-file">
              <Icon name="file" size={26} />
              <small>{material.name.split('.').pop()?.toUpperCase()}</small>
            </div>
            <div className="cp-material-description">
              <div>
                <span className="cp-tag">
                  {t('第 {week} 周', { week: material.week })}
                </span>
                <span
                  className={`cp-status ${material.status === 'published' ? 'connected' : 'draft'}`}
                >
                  {t(material.status === 'published' ? '已发布' : '草稿')}
                </span>
                {material.example && (
                  <span className="cp-tag">{t('示例')}</span>
                )}
              </div>
              <h3>{t(material.title)}</h3>
              <p>
                {t('{pages} 页 · {units} 个模块 · {questions} 道练习', {
                  pages: material.document.pages.length,
                  units: material.document.units.length,
                  questions: material.document.units.flatMap((u) => u.questions)
                    .length,
                })}
              </p>
              <small className="cp-muted">{material.name}</small>
            </div>
            <div className="cp-material-actions">
              <button
                className="cp-button"
                disabled={!!busy}
                onClick={() => setEditor(structuredClone(material))}
              >
                <Icon name="eye" size={15} />
                {t('检查与编辑')}
              </button>
              <button
                className="cp-button"
                disabled={!!busy}
                onClick={() => void generate(material)}
              >
                <Icon name="layers" size={15} />
                {t(
                  busy === material.id
                    ? '处理中…'
                    : material.document.units.length
                      ? '重新生成草稿'
                      : '生成指导与练习',
                )}
              </button>
              <button
                className={`cp-button ${material.status !== 'published' ? 'primary' : ''}`}
                disabled={!!busy}
                onClick={() => void publish(material)}
              >
                {t(material.status === 'published' ? '撤回发布' : '发布给学生')}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        ))}
        {!materials.length && (
          <Empty title={t('这门课还没有课件')}>
            <p>{t('上传第一份资料，建立课程的学习空间。')}</p>
          </Empty>
        )}
      </div>
      {busy && busy !== 'upload' && (
        <div className="cp-loading" role="status">
          <i />
          {t('正在处理课件；生成可能需要一分钟，请保持页面打开。')}
        </div>
      )}
      {editor && (
        <CampusDialog
          title={t('检查与编辑学习内容')}
          wide
          onClose={() => setEditor(null)}
        >
          <GuideEditor
            material={editor}
            onSave={async (next) => {
              await onSave(next);
              setEditor(null);
            }}
          />
        </CampusDialog>
      )}
    </section>
  );
}

function GuideEditor({
  material,
  onSave,
}: {
  material: CampusMaterial;
  onSave: (material: CampusMaterial) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(material);
  const [tab, setTab] = useState<'guide' | 'source'>('guide');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function updateUnit(index: number, patch: Partial<StudyUnit>) {
    setDraft((d) => ({
      ...d,
      document: {
        ...d.document,
        units: d.document.units.map((u, i) =>
          i === index ? { ...u, ...patch } : u,
        ),
      },
    }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        ...draft,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <form className="cp-form cp-guide-editor" onSubmit={save}>
      <div className="cp-form-row">
        <label>
          {t('课件标题')}
          <input
            required
            maxLength={150}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </label>
        <label>
          {t('课程周次')}
          <input
            type="number"
            min={1}
            max={20}
            value={draft.week}
            onChange={(e) =>
              setDraft((d) => ({ ...d, week: Number(e.target.value) }))
            }
            required
          />
        </label>
      </div>
      <nav className="cp-tabs">
        <button
          type="button"
          className={tab === 'guide' ? 'active' : ''}
          onClick={() => setTab('guide')}
        >
          {t('指导与练习')}
        </button>
        <button
          type="button"
          className={tab === 'source' ? 'active' : ''}
          onClick={() => setTab('source')}
        >
          {t('核对原文')}
        </button>
      </nav>
      {tab === 'source' ? (
        <div className="cp-editor-sources">
          {draft.document.pages.map((page) => (
            <article key={page.page}>
              <span className="cp-eyebrow">
                {t('第 {page} 页', { page: page.page })}
              </span>
              <h3>{page.title}</h3>
              <p>{page.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <>
          {!draft.document.units.length && (
            <p className="cp-info">
              {t('尚未生成指导。可以先发布原文，也可以返回生成学习内容。')}
            </p>
          )}
          {draft.document.units.map((unit, i) => (
            <fieldset key={unit.id} className="cp-edit-unit">
              <legend>
                MODULE {i + 1} ·{' '}
                {t('第 {pages} 页', { pages: unit.pages.join(', ') })}
              </legend>
              <label>
                {t('模块标题')}
                <input
                  required
                  maxLength={300}
                  value={unit.title}
                  onChange={(e) => updateUnit(i, { title: e.target.value })}
                />
              </label>
              <label>
                {t('概念讲解')}
                <textarea
                  required
                  maxLength={5000}
                  value={unit.overview}
                  onChange={(e) => updateUnit(i, { overview: e.target.value })}
                  rows={3}
                />
              </label>
              <label>
                {t('知识点（每行一条）')}
                <textarea
                  value={unit.points.join('\n')}
                  onChange={(e) =>
                    updateUnit(i, { points: e.target.value.split('\n') })
                  }
                  rows={3}
                />
              </label>
              <label>
                {t('分步指导（每行一步）')}
                <textarea
                  value={unit.readingSteps.join('\n')}
                  onChange={(e) =>
                    updateUnit(i, { readingSteps: e.target.value.split('\n') })
                  }
                  rows={3}
                />
              </label>
              {unit.questions.map((q, qi) => (
                <fieldset className="cp-edit-question" key={q.id}>
                  <legend>{t('练习 {number}', { number: qi + 1 })}</legend>
                  <label>
                    {t('题目')}
                    <input
                      required
                      maxLength={3000}
                      value={q.prompt}
                      onChange={(e) =>
                        updateUnit(i, {
                          questions: unit.questions.map((item, k) =>
                            k === qi
                              ? { ...item, prompt: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  {q.options.map((option, oi) => (
                    <label key={oi}>
                      {t('选项')} {'ABCD'[oi]}
                      <input
                        required
                        maxLength={1500}
                        value={option}
                        onChange={(e) =>
                          updateUnit(i, {
                            questions: unit.questions.map((item, k) =>
                              k === qi
                                ? {
                                    ...item,
                                    options: item.options.map((o, n) =>
                                      n === oi ? e.target.value : o,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    {t('正确答案')}
                    <select
                      value={q.answer}
                      onChange={(e) =>
                        updateUnit(i, {
                          questions: unit.questions.map((item, k) =>
                            k === qi
                              ? { ...item, answer: Number(e.target.value) }
                              : item,
                          ),
                        })
                      }
                    >
                      {q.options.map((_, oi) => (
                        <option key={oi} value={oi}>
                          {'ABCD'[oi]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('答案解释')}
                    <textarea
                      required
                      maxLength={4000}
                      value={q.explanation}
                      onChange={(e) =>
                        updateUnit(i, {
                          questions: unit.questions.map((item, k) =>
                            k === qi
                              ? { ...item, explanation: e.target.value }
                              : item,
                          ),
                        })
                      }
                      rows={2}
                    />
                  </label>
                </fieldset>
              ))}
            </fieldset>
          ))}
        </>
      )}
      {error && <Alert>{t(error)}</Alert>}
      <p className="cp-fineprint">
        {t(
          '保存后为草稿状态，请在课件列表重新发布。AI 内容需要核对概念、答案与出处。',
        )}
      </p>
      <button className="cp-button primary" disabled={busy}>
        {t(busy ? '保存中…' : '保存为草稿')}
      </button>
    </form>
  );
}
