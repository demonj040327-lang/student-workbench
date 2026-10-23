import {draftOperation} from './courseworkDraft';
import { useEffect, useRef, useState } from 'react';
import type { Assignment } from './data';
import type { CampusCourse, PersonalApi } from './campusStore';
import type { StudyDocument } from './studyTypes';
import { sourcePayload, studyRequest, uid, errorMessage } from './studyClient';
import { Alert } from './CampusUI';
import { useI18n } from './i18n';

type Field = { value: string; page: number; quote: string };
export default function CourseworkEditor({
  courses,
  initial,
  api,
  hostConfigured,
  onConnect,
  onSave,
}: {
  courses: CampusCourse[];
  initial?: Assignment;
  api: PersonalApi | null;
  hostConfigured: boolean;
  onConnect: () => void;
  onSave: (a: Assignment) => void;
}) {
  const { t, language } = useI18n();
  const tr = (zh: string, en: string) => (language === 'en' ? en : zh);
  const [course, setCourse] = useState(
    initial?.courseId || courses[0]?.id || '',
  );
  const [title, setTitle] = useState(initial?.title || '');
  const [brief, setBrief] = useState(initial?.brief || '');
  const [release, setRelease] = useState(
    initial?.coursework?.releaseAt?.slice(0, 16) ||
      new Date().toISOString().slice(0, 16),
  );
  const [due, setDue] = useState(
    initial?.coursework?.dueAt?.slice(0, 16) ||
      (initial?.due ? initial.due + 'T17:00' : ''),
  );
  const [submissionType, setType] = useState(
    initial?.coursework?.submissionType || '',
  );
  const [deliverables, setDeliverables] = useState(
    initial?.coursework?.deliverables || '',
  );
  const [rubric, setRubric] = useState(initial?.coursework?.rubric || '');
  const [steps, setSteps] = useState(initial?.steps || []);
  const [document, setDocument] = useState<StudyDocument | undefined>(
    initial?.coursework?.document,
  );
  const [personalKey, setPersonalKey] = useState('');
  const [personalModel, setPersonalModel] = useState(
    api?.model || 'Qwen/Qwen3.5-397B-A17B-FP8',
  );
  const effectiveApi = personalKey.trim()
    ? { key: personalKey.trim(), model: personalModel.trim() }
    : api;
  const [fields, setFields] = useState<Record<string, Field>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const [draftReady,setDraftReady]=useState(false);
  const finished=useRef(false);
  const draftKey=(new URLSearchParams(location.search).get('demo')==='1'?'demo:':'personal:')+(initial?.id||'new');
  useEffect(()=>{let live=true;draftOperation(draftKey,'read').then(d=>{if(!live)return;if(d&&courses.some(c=>c.id===d.course)){setCourse(d.course);setTitle(d.title);setBrief(d.brief);setRelease(d.release);setDue(d.due);setType(d.submissionType);setDeliverables(d.deliverables);setRubric(d.rubric);setSteps(d.steps);setDocument(d.document);setFields(d.fields);setConfirmed(false);}setDraftReady(true);}).catch(()=>{if(live){setError(tr('无法恢复草稿，请检查浏览器存储。','Draft recovery is unavailable. Check browser storage.'));setDraftReady(true);}});return()=>{live=false;};},[]);
  useEffect(()=>{if(!draftReady||finished.current)return;const timer=setTimeout(()=>{if(!finished.current)void draftOperation(draftKey,'write',{course,title,brief,release,due,submissionType,deliverables,rubric,steps,document,fields}).catch(()=>setError(tr('草稿未能自动保存，请勿刷新页面。','Draft could not be saved. Do not refresh.')));},350);return()=>clearTimeout(timer);},[draftReady,course,title,brief,release,due,submissionType,deliverables,rubric,steps,document,fields]);

  useEffect(() => () => controller.current?.abort(), []);
  async function run(action: 'extract' | 'plan') {
    if (!document) return;
    if (!effectiveApi && !hostConfigured) {
      setError(
        tr(
          '请先在教学 API 设置中填写个人 Key 和模型。',
          'Enter your key and model in Teaching API settings first.',
        ),
      );
      return;
    }
    setBusy(true);
    setError('');
    const c = new AbortController();
    controller.current = c;
    try {
      const credentials = {
        credentialScope: 'teacher',
        ...(effectiveApi ? { personalApi: effectiveApi } : {}),
        allowExternal: true,
      };
      if (action === 'extract') {
        const r = await studyRequest<{ fields: Record<string, Field> }>(
          'coursework',
          { document, ...credentials },
          c.signal,
        );
        if (c.signal.aborted) return;
        setFields(r.fields);
        if (r.fields.title.value) setTitle(r.fields.title.value);
        setType(r.fields.submissionType.value);
        setDeliverables(r.fields.deliverables.value);
        setRubric(r.fields.rubric.value);
        setConfirmed(false);
      } else {
        const r = await studyRequest<{
          steps: {
            title: string;
            output: string;
            sourceQuote: string;
            minutes: number;
            sourcePage: number;
          }[];
        }>(
          'plan',
          {
            document,
            courseId: course,
            title: title || document.name,
            ...credentials,
          },
          c.signal,
        );
        if (c.signal.aborted) return;
        setSteps(
          r.steps.map((s, i) => ({
            id: uid(),
            title: s.title,
            evidence: s.output,
            source: `p.${s.sourcePage}: ${s.sourceQuote}`,
            minutes: s.minutes,
            day: i,
            done: false,
            blocked: false,
          })),
        );
      }
    } catch (e) {
      if (!c.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    setDocument(undefined);
    setFields({});
    setSteps([]);
    setConfirmed(false);
    const c = new AbortController();
    controller.current = c;
    try {
      const payload = await sourcePayload(
        {
          id: uid(),
          courseId: course,
          name: file.name,
          type: file.type,
          blob: file,
        },
        c.signal,
      );
      const doc = await studyRequest<StudyDocument>('parse', payload, c.signal);
      if (!c.signal.aborted) {
        setDocument(doc);
        setBrief(doc.pages.map((p) => p.text).join('\n\n'));
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (e) {
      if (!c.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  function save(status: 'draft' | 'published') {
    setError('');
    if (!title.trim() || !due || !release) {
      setError(
        tr(
          '请填写标题、发布时间和截止时间。',
          'Enter a title, release time and deadline.',
        ),
      );
      return;
    }
    const a = Date.parse(release + 'Z'),
      b = Date.parse(due + 'Z');
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
      setError(
        tr('截止时间必须晚于发布时间。', 'The deadline must follow release.'),
      );
      return;
    }
    if (status === 'published' && (!confirmed || !steps.length)) {
      setError(
        tr(
          '发布前请确认日期和要求，并至少添加一个步骤。',
          'Confirm the requirements and dates and add at least one step.',
        ),
      );
      return;
    }
    const id = initial?.id || uid();
    const before = initial?.coursework?.dueAt || initial?.due || '';
    const after = due + 'Z';
    finished.current=true;
    void draftOperation(draftKey,'delete').catch(()=>{});
    onSave({
      ...initial,
      id,
      courseId: course,
      title: title.trim(),
      brief,
      startsOn: release.slice(0, 10),
      due: due.slice(0, 10),
      category: 'coursework',
      deadlineVerified: confirmed,
      steps,
      coursework: {
        status,
        releaseAt: release + 'Z',
        dueAt: after,
        timezone: 'UTC',
        submissionType,
        deliverables,
        rubric,
        document,
        revisions: [
          ...(initial?.coursework?.revisions || []),
          ...(before && before !== after
            ? [{ at: new Date().toISOString(), before, after }]
            : []),
        ],
      },
    });
  }
  return (
    <div className="cp-form">
      <p className="cp-fineprint">{tr("编辑内容自动保存在本机；刷新后可恢复。API Key 不保存。","Edits are saved locally and can be restored after refresh. API keys are never saved.")}</p>
      <p className="cp-info">
        {tr(
          '上传 Coursework / 作业说明，提取要求后由教师确认日期。所有时间明确使用 UTC。',
          'Upload a coursework brief, then confirm the requirements and dates. All times use UTC.',
        )}
      </p>
      <details>
        <summary>
          {tr('教学 API 设置（可选）', 'Teaching API settings (optional)')}
        </summary>
        <label>
          ELM API Key
          <input
            type="password"
            autoComplete="off"
            value={personalKey}
            onChange={(e) => setPersonalKey(e.target.value)}
          />
        </label>
        <label>
          {tr('模型名称', 'Model name')}
          <input
            value={personalModel}
            onChange={(e) => setPersonalModel(e.target.value)}
          />
        </label>
        <small>
          {tr(
            '仅保存在当前编辑窗口内存中；未填写时使用已有教学接口。',
            'Kept in this editor memory only; leave blank to use the configured teaching API.',
          )}
        </small>
      </details>
      <label>
        {t('归属课程')}
        <select
          value={course}
          disabled={busy || !!initial}
          onChange={(e) => {
            setCourse(e.target.value);
            setDocument(undefined);
            setFields({});
            setSteps([]);
            setConfirmed(false);
          }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {t(c.name)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tr('上传作业说明', 'Upload coursework brief')}
        <input
          type="file"
          accept=".pdf,.pptx,.docx,.txt,.md"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {document && (
        <>
          <p className="cp-muted">
            {document.name} · {document.pages.length} {tr('页', 'pages')}
          </p>
          <button
            className="cp-button"
            disabled={busy}
            onClick={() => void run('extract')}
          >
            {tr('AI 提取作业要求', 'Extract coursework requirements')}
          </button>
          <details>
            <summary>{tr('核对作业原文', 'Check original brief')}</summary>
            {document.pages.map((p) => (
              <article key={p.page}>
                <strong>
                  p.{p.page} · {p.title}
                </strong>
                <p style={{ whiteSpace: 'pre-wrap' }}>{p.text}</p>
              </article>
            ))}
          </details>
        </>
      )}
      {Object.keys(fields).length > 0 && (
        <details open>
          <summary>
            {tr(
              '提取结果与原文出处（日期须手动确认）',
              'Extracted fields and evidence (confirm dates manually)',
            )}
          </summary>
          {Object.entries(fields).map(([key, f]) => (
            <div
              key={key}
              style={{ padding: '10px 0', borderBottom: '1px solid #e4e5eb' }}
            >
              <strong>
                {
                  (
                    {
                      title: '标题 / Title',
                      release: '发布时间 / Release',
                      deadline: '截止时间 / Deadline',
                      timezone: '时区 / Timezone',
                      submissionType: '个人或小组 / Individual or group',
                      deliverables: '提交内容 / Deliverables',
                      rubric: '评分标准 / Rubric',
                    } as Record<string, string>
                  )[key]
                }
              </strong>
              <p>
                {f.value ||
                  tr(
                    '原文未提供，请补充确认',
                    'Not provided; confirm with the teacher',
                  )}
              </p>
              {f.quote && (
                <blockquote>
                  p.{f.page}: {f.quote}
                </blockquote>
              )}
            </div>
          ))}
        </details>
      )}
      <label>
        {t('作业标题')}
        <input
          value={title}
          maxLength={150}
          onChange={(e) => {
            setTitle(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <div className="cp-form-row">
        <label>
          {tr('发布时间（UTC）', 'Release time (UTC)')}
          <input
            type="datetime-local"
            value={release}
            onChange={(e) => {
              setRelease(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <label>
          {tr('截止时间（UTC）', 'Deadline (UTC)')}
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => {
              setDue(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
      </div>
      <p className="cp-fineprint">
        {tr(
          'UTC 不随夏令时变化；若原文使用英国夏令时 BST，请先换算后填写。模型不会推断缺失日期或时区。',
          'UTC does not change with daylight saving. Convert BST dates to UTC before entering. Missing dates and timezones are not inferred.',
        )}
      </p>
      <label>
        {tr('个人或小组作业', 'Individual or group work')}
        <input
          value={submissionType}
          onChange={(e) => {
            setType(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <label>
        {tr('需要提交的内容', 'Deliverables')}
        <textarea
          rows={3}
          value={deliverables}
          onChange={(e) => {
            setDeliverables(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <label>
        {tr('评分标准', 'Marking criteria')}
        <textarea
          rows={3}
          value={rubric}
          onChange={(e) => {
            setRubric(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <label>
        {t('作业要求')}
        <textarea
          rows={4}
          value={brief}
          onChange={(e) => {
            setBrief(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <div className="cp-form-actions">
        <button
          className="cp-button"
          disabled={busy || !document}
          onClick={() => void run('plan')}
        >
          {tr('AI 拆解作业步骤', 'Generate coursework steps')}
        </button>
        <button
          className="cp-button"
          disabled={busy}
          onClick={() =>
            setSteps((s) => [
              ...s,
              {
                id: uid(),
                title: '',
                minutes: 30,
                day: s.length,
                done: false,
                blocked: false,
                evidence: '',
                source: '',
              },
            ])
          }
        >
          {tr('添加步骤', 'Add step')}
        </button>
      </div>
      {steps.map((s, i) => (
        <div key={s.id}>
          <label>
            {tr('步骤', 'Step')} {i + 1}
            <input
              value={s.title}
              onChange={(e) =>
                setSteps((all) =>
                  all.map((v) =>
                    v.id === s.id ? { ...v, title: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <small>{s.evidence}</small>
          {s.source && (
            <details>
              <summary>{tr('查看来源', 'View evidence')}</summary>
              {s.source}
            </details>
          )}
          <button
            className="cp-link"
            onClick={() => setSteps((all) => all.filter((v) => v.id !== s.id))}
          >
            {tr('移除步骤', 'Remove step')}
          </button>
        </div>
      ))}
      <label className="cp-check-label">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {tr(
          '我已核对日期、时区、提交要求与步骤。',
          'I have checked the dates, timezone, requirements and steps.',
        )}
      </label>
      {error && <Alert>{error}</Alert>}
      {busy && <p role="status">{tr('正在处理，请稍候…', 'Processing…')}</p>}
      <div className="cp-form-actions">
        <button
          className="cp-button"
          disabled={busy}
          onClick={() => save('draft')}
        >
          {t('保存为草稿')}
        </button>
        <button
          className="cp-button primary"
          disabled={busy || steps.some((s) => !s.title.trim())}
          onClick={() => save('published')}
        >
          {t('发布给学生')}
        </button>
      </div>
    </div>
  );
}
