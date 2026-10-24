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
  autoGenerate = false,
  api,
  hostConfigured,
  onConnect,
  onSave,
}: {
  courses: CampusCourse[];
  initial?: Assignment;
  autoGenerate?: boolean;
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
      '',
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
  const draftKey=(new URLSearchParams(location.search).get('demo')==='1'?'demo:':'personal:')+(initial?.id||'new:'+courses.map(c=>c.id).join(','));
  useEffect(()=>{let live=true;draftOperation(draftKey,'read').then(d=>{if(!live)return;if(d&&courses.some(c=>c.id===d.course)){setCourse(d.course);setTitle(d.title);setBrief(d.brief);setRelease(d.release);setDue(d.due);setType(d.submissionType);setDeliverables(d.deliverables);setRubric(d.rubric);setSteps(d.steps);setDocument(d.document);setFields(d.fields);setConfirmed(false);}setDraftReady(true);}).catch(()=>{if(live){setError(tr('无法恢复草稿，请检查浏览器存储。','Draft recovery is unavailable. Check browser storage.'));setDraftReady(true);}});return()=>{live=false;};},[]);
  useEffect(()=>{if(!draftReady||finished.current)return;const timer=setTimeout(()=>{if(!finished.current)void draftOperation(draftKey,'write',{course,title,brief,release,due,submissionType,deliverables,rubric,steps,document,fields}).catch(()=>setError(tr('草稿未能自动保存，请勿刷新页面。','Draft could not be saved. Do not refresh.')));},350);return()=>clearTimeout(timer);},[draftReady,course,title,brief,release,due,submissionType,deliverables,rubric,steps,document,fields]);

  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
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
      const r = await studyRequest<{fields:Record<string,Field>;warnings?:string[]}>('coursework', {document, ...credentials, language, mode:'teacher-summary'}, c.signal);
      if(c.signal.aborted) return;
      setFields(r.fields);
      if(r.warnings?.length)setError(r.warnings.join(' '));
      if(r.fields.title?.value) setTitle(r.fields.title.value.slice(0,150));
      if(r.fields.introduction?.value) setBrief(r.fields.introduction.value);
      // Only explicit, normalised UTC dates can populate scheduling inputs.
      const iso = (value:string|undefined) => value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(value) && Number.isFinite(Date.parse(value)) ? value.slice(0,16) : '';
      setRelease(iso(r.fields.release?.value));
      setDue(iso(r.fields.deadline?.value));
      setConfirmed(false);
    } catch (e) {
      if (!c.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const autoStarted = useRef(false);
  useEffect(() => {
    if(autoGenerate && draftReady && document && !autoStarted.current) {
      autoStarted.current=true;
      void run();
    }
  }, [autoGenerate, draftReady, document]);
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
        setBrief(''); setRelease(''); setDue('');
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
    if (!document || !title.trim() || (status === 'published' && (!brief.trim() || !due || !release))) {
      setError(
        tr(
          '请上传作业文件并填写标题；发布前请填写介绍、开始时间和截止时间。',
          'Upload a brief and enter a title. Add an introduction, start time and deadline before publishing.',
        ),
      );
      return;
    }
    const a = Date.parse(release + 'Z'),
      b = Date.parse(due + 'Z');
    if ((release && !Number.isFinite(a)) || (due && !Number.isFinite(b)) || (release && due && a >= b)) {
      setError(
        tr('截止时间必须晚于发布时间。', 'The deadline must follow release.'),
      );
      return;
    }
    if (status === 'published' && !confirmed) {
      setError(
        tr(
          '发布前请核对作业介绍、开始时间与截止时间。',
          'Confirm the introduction, start time and deadline before publishing.',
        ),
      );
      return;
    }
    const id = initial?.id || uid();
    const before = initial?.coursework?.dueAt || initial?.due || '';
    const after = due ? due + ':00Z' : '';
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
        releaseAt: release ? release + ':00Z' : '',
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
          '上传作业文件，AI 生成介绍并提取起止时间，确认后即可发布。评分标准和学习步骤由学生端按需解析。',
          'Upload a brief, generate an introduction and extract dates, then confirm and publish. Students analyse marking criteria and learning steps separately.',
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
            onClick={() => void run()}
          >
            {tr('AI 生成介绍与提取日期', 'Generate introduction & extract dates')}
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
          {Object.entries(fields).filter(([key]) => ['title','introduction','release','deadline','timezone'].includes(key)).map(([key, f]) => (
            <div
              key={key}
              style={{ padding: '10px 0', borderBottom: '1px solid #e4e5eb' }}
            >
              <strong>
                {
                  (
                    {
                      title: tr('标题', 'Title'),
                      introduction: tr('作业介绍', 'Introduction'),
                      release: tr('开始时间', 'Start'),
                      deadline: tr('截止时间', 'Deadline'),
                      timezone: tr('时区', 'Timezone'),
                      submissionType: tr('个人或小组', 'Individual or group'),
                      deliverables: tr('提交内容', 'Deliverables'),
                      rubric: tr('评分标准', 'Rubric'),
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
          {tr('开始时间（UTC）', 'Start time (UTC)')}
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
        {tr('作业介绍', 'Coursework introduction')}
        <textarea rows={4} maxLength={6000} value={brief} onChange={e=>{setBrief(e.target.value);setConfirmed(false);}} />
      </label>
      <label className="cp-check-label">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {tr(
          '我已核对作业介绍、开始时间、截止时间与时区。',
          'I have checked the introduction, start time, deadline and timezone.',
        )}
      </label>
      {error && <Alert>{error}</Alert>}
      {busy && <p role="status">{tr('正在处理，请稍候…', 'Processing…')}</p>}
      <div className="cp-form-actions">
        <button
          className="cp-button"
          disabled={busy || !draftReady}
          onClick={() => save('draft')}
        >
          {t('保存为草稿')}
        </button>
        <button
          className="cp-button primary"
          disabled={busy || !draftReady}
          onClick={() => save('published')}
        >
          {t('发布给学生')}
        </button>
      </div>
    </div>
  );
}
