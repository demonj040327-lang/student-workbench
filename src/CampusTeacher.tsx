import { useRef, useState, type ReactNode, type FormEvent } from 'react';
import { useI18n } from './i18n';
import { errorMessage, sourcePayload, studyRequest, uid } from './studyClient';
import type { StudyDocument, StudyUnit } from './studyTypes';
import type { CampusCourse, CampusMaterial, PersonalApi, StudentProgress } from './campusStore';
import type { Assignment } from './data';
import Icon from './CampusIcons';
import CampusLearning from './CampusLearning';
import {emptyProgress} from './campusStore';
import {enqueueGeneration,useGenerationJobs,isJobActive} from './teacherGenerationQueue';
import { Alert, CampusDialog, Empty } from './CampusUI';

type Props = {
  demo:boolean;
  onEditCourse: () => void;
  onDeleteCourse: () => void;
  coursework: ReactNode;
  assignments: Assignment[];
  onEditAssignment: (assignment: Assignment, regenerate?: boolean) => void;
  onSaveAssignment: (assignment: Assignment) => void;
  course: CampusCourse;
  materials: CampusMaterial[];
  onSave: (material: CampusMaterial) => Promise<void>;
  api: PersonalApi | null;
  hostConfigured: boolean;
  onConnect: () => void;
};
export default function CampusTeacher({
  demo, onEditCourse, onDeleteCourse, coursework, assignments, onEditAssignment, onSaveAssignment,
  course,
  materials,
  onSave,
  api,
  hostConfigured,
  onConnect,
}: Props) {
  const { t, language } = useI18n();
  const jobs=useGenerationJobs();
  const pending=(id:string)=>jobs.some(j=>j.demo===demo&&j.materialId===id&&isJobActive(j));
  const [preview,setPreview]=useState<CampusMaterial|null>(null);
  const [previewProgress,setPreviewProgress]=useState<StudentProgress>(emptyProgress);
  const [previewHint,setPreviewHint]=useState('');
  const [contentKind, setContentKind] = useState<'lecture' | 'coursework'>('lecture');
  const [uploadKind, setUploadKind] = useState<'lecture' | 'coursework'>('lecture');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<CampusMaterial | null>(null);
  const [week, setWeek] = useState(1);
  const [weekFilter, setWeekFilter] = useState('all');
  const filteredMaterials=materials.filter(m=>weekFilter==='all'||(weekFilter==='unconfirmed'?m.weekUnconfirmed:!m.weekUnconfirmed&&m.week===Number(weekFilter)));
  async function changeWeek(material:CampusMaterial,value:string) {
    setBusy(material.id);setError('');
    try { const next={...material,week:value==='unconfirmed'?material.week:Number(value),weekUnconfirmed:value==='unconfirmed',updatedAt:new Date().toISOString()};await onSave(next);if(activeMaterial?.id===material.id){setActiveMaterial(next);setWeek(next.week);} }
    catch(e){setError(errorMessage(e));}finally{setBusy(null);}
  }
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<CampusMaterial | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function saveSourceDraft() {
    const file = selectedFile;
    if (!file || !title.trim()) return;
    if (!/\.(pdf|pptx|docx|txt|md)$/i.test(file.name)) { setError('请上传 PDF、PPTX、DOCX、TXT 或 Markdown。'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('上传文件不能超过 25 MB。'); return; }
    setBusy('upload'); setError('');
    try {
      const id = uid();
      const controller = new AbortController();
      const payload = await sourcePayload({ id, courseId: course.id, name: file.name, type: file.type, blob: file }, controller.signal);
      const document = await studyRequest<StudyDocument>('parse', { ...payload, mode: 'local' }, controller.signal);
      document.units = [];
      await onSave({ id, courseId: course.id, title: title.trim(), week, name: file.name, status: 'draft', blob: file, document, updatedAt: new Date().toISOString() });
      setSelectedFile(null); setActiveMaterial(null); setTitle('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(null); }
  }
  function upload(file:File,action:'guide'|'questions') {
    if(!api&&!hostConfigured){onConnect();return;}
    if(!/\.(pdf|pptx|docx|txt|md)$/i.test(file.name)){setError('请上传 PDF、PPTX、DOCX、TXT 或 Markdown。');return;}
    if(file.size>25*1024*1024){setError('上传文件不能超过 25 MB。');return;}
    enqueueGeneration({demo,courseId:course.id,title:title.trim()||file.name.replace(/\.[^.]+$/,''),week,action,language,api,file});
    setError('');setSelectedFile(null);setActiveMaterial(null);setTitle('');if(fileRef.current)fileRef.current.value='';
  }
  function generate(material:CampusMaterial,action:'guide'|'questions'='guide') {
    if(!api&&!hostConfigured){onConnect();return;}
    enqueueGeneration({demo,courseId:course.id,title:material.title,week:material.week,action,language,api,material});setError('');
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
            {t(course.teacher)} · {t(course.description)}
          </p>
        </div>
        <span className="cp-status connected">{t('教师工作区')}</span>
      </div>
      <div className="cp-form-actions cp-course-manage">
        <button className="cp-button" onClick={onEditCourse}>{t('修改课程')}</button>
        <button className="cp-button" onClick={onDeleteCourse}>{t('删除课程')}</button>
      </div>
      <div className="cp-teacher-columns cp-teacher-full"><div>
      <nav className="cp-tabs cp-upload-kind" aria-label={t('资料类型')}>
        <button className={uploadKind === 'lecture' ? 'active' : ''} aria-pressed={uploadKind === 'lecture'} disabled={!!busy} onClick={() => setUploadKind('lecture')}>{t('课程课件')}</button>
        <button className={uploadKind === 'coursework' ? 'active' : ''} aria-pressed={uploadKind === 'coursework'} disabled={!!busy} onClick={() => setUploadKind('coursework')}>Coursework</button>
      </nav>
      {uploadKind === 'coursework' ? <section className="cp-card cp-upload-card"><h2>{t('上传作业说明')}</h2>{coursework}</section> : (
      <section className="cp-card cp-upload-card">
        <div className="cp-section-heading">
          <div>
            <h2>{t('上传本周课件')}</h2>
            <p>{t('文件先保存为草稿，生成内容经你确认后再发布。')}</p>
          </div>
          <div className="cp-form-actions">
            <button className="cp-button" disabled={!!busy || !title.trim() || !selectedFile} onClick={() => void saveSourceDraft()}>{t('保存原文草稿')}</button>
            <button className="cp-button" disabled={!!busy || !title.trim() || (!selectedFile && !activeMaterial)} onClick={() => { if(activeMaterial) void generate({...activeMaterial,title:title.trim(),week}, 'guide'); else if(selectedFile) void upload(selectedFile,'guide'); }}>{t('AI 生成草稿')}</button>
            <button className="cp-button primary" disabled={!!busy || !title.trim() || (!selectedFile && !activeMaterial)} onClick={() => { if(activeMaterial) void generate({...activeMaterial,title:title.trim(),week}, 'questions'); else if(selectedFile) void upload(selectedFile,'questions'); }}>{t('AI 生成题目')}</button>
          </div>
        </div>
        <div className="cp-upload-meta">
          <label>
            {t('课件标题')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder={t('填写课件标题')}
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
            const file=e.dataTransfer.files[0]; if(file) { setSelectedFile(file); setActiveMaterial(null); if(!title) setTitle(file.name.replace(/\.[^.]+$/, '')); }
          }}
        >
          <span>
            <Icon name="upload" size={25} />
          </span>
          <h3>{busy === 'upload' ? t('正在解析课件…') : selectedFile?.name || t('将课件拖到这里')}</h3>
          <p>{t('选择文件并填写标题，再使用右上角 AI 操作。每份不超过 25 MB。')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,.docx,.txt,.md"
            onChange={(e) => { const file=e.target.files?.[0]; if(file) { setSelectedFile(file); setActiveMaterial(null); if(!title) setTitle(file.name.replace(/\.[^.]+$/, '')); } }}
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
      {activeMaterial && <div className="cp-generated-preview"><h3>{t('生成结果与编辑')}</h3>
        <GuideEditor key={activeMaterial.updatedAt} material={activeMaterial} onSave={async next => {await onSave(next); setActiveMaterial(next);}} />
      </div>}
      </section>
      )}
      {error && <Alert>{t(error)}</Alert>}
      <nav className="cp-tabs cp-upload-kind" aria-label={t('已保存内容')}>
        <button className={contentKind === 'lecture' ? 'active' : ''} aria-pressed={contentKind === 'lecture'} onClick={() => setContentKind('lecture')}>{t('课件与学习内容')} · {materials.length}</button>
        <button className={contentKind === 'coursework' ? 'active' : ''} aria-pressed={contentKind === 'coursework'} onClick={() => setContentKind('coursework')}>{t('作业布置')} · {assignments.length}</button>
      </nav>
      {contentKind === 'lecture' ? <>
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
      <label className="cp-community-filter">{t('按周次查看')}<select aria-label={t('按周次查看')} value={weekFilter} onChange={e=>setWeekFilter(e.target.value)}><option value="all">{t('全部周次')}</option><option value="unconfirmed">{t('周次待确认')}</option>{Array.from({length:20},(_,i)=><option key={i} value={i+1}>{t('第 {week} 周',{week:i+1})}</option>)}</select></label>
      <div className="cp-teacher-material-list">
        {filteredMaterials.map((material) => (
          <article key={material.id} className="cp-card cp-teacher-material">
            <div className="cp-material-file">
              <Icon name="file" size={26} />
              <small>{material.name.split('.').pop()?.toUpperCase()}</small>
            </div>
            <div className="cp-material-description">
              <div>
                <span className="cp-tag">
                  {material.weekUnconfirmed ? t('周次待确认') : t('第 {week} 周', { week: material.week })}
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
              {material.kind && <span className="cp-tag">{t(({lecture:'讲座课件',tutorial:'辅导课资料',reference:'参考文献',template:'空白模板'})[material.kind])}</span>}
              <h3>{t(material.title)}</h3>{pending(material.id)&&<span className="cp-status">{t('后台生成中')}</span>}
              <p>
                {t('{pages} 页 · {units} 个模块 · {questions} 道练习', {
                  pages: material.document.pages.length,
                  units: material.document.units.length,
                  questions: material.document.units.flatMap((u) => u.questions)
                    .length,
                })}
              </p>
              <p className="cp-muted">{t(material.document.mode === 'ai' ? 'AI 已生成，待核对' : '仅原文，待生成')}{material.document.pages.some(p=>!p.text.trim()) && ` · ${material.document.pages.filter(p=>!p.text.trim()).length} ${t('页未提取到文字')}`}</p>
              {material.document.warnings.length > 0 && <details><summary>{t('解析与生成提示')}</summary>{material.document.warnings.map((w,i)=><p className="cp-fineprint" key={i}>{w}</p>)}</details>}
              <label className="cp-material-week-picker">{t('归属周次')}<select aria-label={`${t(material.title)} · ${t('归属周次')}`} disabled={busy===material.id||pending(material.id)} value={material.weekUnconfirmed?'unconfirmed':String(material.week)} onChange={e=>void changeWeek(material,e.target.value)}><option value="unconfirmed">{t('周次待确认')}</option>{Array.from({length:20},(_,i)=><option key={i} value={i+1}>{t('第 {week} 周',{week:i+1})}</option>)}</select></label>
              <small className="cp-muted">{material.name}</small>{material.document.originalUrl && <a className="cp-link" href={material.document.originalUrl} download={material.name}>{t('下载原文件')}</a>}
            </div>
            <div className="cp-material-actions">
              <button className="cp-button" disabled={pending(material.id)} onClick={()=>{setPreview(structuredClone(material));setPreviewProgress(emptyProgress());setPreviewHint('');}}>{t('学生视角预览')}</button>
              <button
                className="cp-button"
                disabled={busy===material.id||pending(material.id)}
                onClick={() => setEditor(structuredClone(material))}
              >
                <Icon name="eye" size={15} />
                {t('检查与编辑')}
              </button>
              <button
                className="cp-button"
                disabled={busy===material.id||pending(material.id)}
                onClick={() => void generate(material)}
              >
                <Icon name="layers" size={15} />
                {t(
                  busy === material.id
                    ? '处理中…'
                    : material.document.units.length
                      ? '重新生成草稿'
                      : 'AI 生成草稿',
                )}
              </button>
              <button className="cp-button" disabled={busy===material.id||pending(material.id)} onClick={()=>generate(material,'questions')}>
                <Icon name="check" size={15}/>{t(material.document.units.some(u=>u.questions.length)?'重新生成题目':'AI 生成题目')}
              </button>
              <button
                className={`cp-button ${material.status !== 'published' ? 'primary' : ''}`}
                disabled={busy===material.id||pending(material.id)}
                onClick={() => void publish(material)}
              >
                {t(material.status === 'published' ? '撤回发布' : '发布给学生')}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        ))}
        {!filteredMaterials.length && materials.length>0 && <Empty title={t('这个周次还没有课件')}/>}
        {!materials.length && (
          <Empty title={t('这门课还没有课件')}>
            <p>{t('上传第一份资料，建立课程的学习空间。')}</p>
          </Empty>
        )}
      </div>
      </> : <section className="cp-teacher-material-list">
        <div className="cp-section-heading"><h2>{t('作业布置')}</h2><button className="cp-button" onClick={() => {setUploadKind('coursework');window.scrollTo({top:0,behavior:'smooth'});}}>{t('布置 Coursework')}</button></div>
        {assignments.map(a => {
          const draft=a.coursework?.status === 'draft';
          const scheduled=!draft && !!a.coursework?.releaseAt && Date.parse(a.coursework.releaseAt)>Date.now();
          return <article key={a.id} className="cp-card cp-teacher-material">
            <div className="cp-material-file"><Icon name="file" size={26}/><small>COURSEWORK</small></div>
            <div className="cp-material-description"><span className={`cp-status ${draft?'draft':'connected'}`}>{t(draft?'草稿':scheduled?'待开始':'已发布')}</span><h3>{t(a.title)}</h3><p>{a.brief}</p><small>{t('截止日期')} · {a.coursework?.dueAt || a.due || '—'}</small></div>
            <div className="cp-material-actions">
              <button className="cp-button" onClick={() => onEditAssignment(a)}><Icon name="eye" size={15}/>{t('检查与编辑')}</button>
              <button className="cp-button" disabled={!a.coursework?.document} title={!a.coursework?.document?t('请先上传作业原文件'):undefined} onClick={() => onEditAssignment(a,true)}><Icon name="layers" size={15}/>{t('重新生成草稿')}</button>
              <button className={`cp-button ${draft?'primary':''}`} onClick={() => {
                if(draft) {onEditAssignment(a);return;}
                onSaveAssignment({...a,coursework:{releaseAt:a.startsOn?a.startsOn+'T00:00:00Z':'',dueAt:a.due?a.due+'T23:59:00Z':'',timezone:'UTC',submissionType:'',deliverables:'',rubric:'',revisions:[],...a.coursework,status:'draft'}});
              }}>{t(draft?'检查并发布':'撤回发布')}</button>
            </div>
          </article>;
        })}
        {!assignments.length && <Empty title={t('暂无课程作业')}/>}
      </section>}
      </div></div>
      {busy && busy !== 'upload' && (
        <div className="cp-loading" role="status">
          <i />
          {t('正在处理课件；生成可能需要一分钟，请保持页面打开。')}
        </div>
      )}
      {preview && <CampusDialog title={t('学生视角预览')} wide onClose={()=>setPreview(null)}><p className="cp-info">{t('预览中的答题与进度不会写入学生记录；AI 问答不使用学生额度。')}</p>{previewHint&&<Alert>{previewHint}</Alert>}<CampusLearning material={preview} progress={previewProgress} onProgress={setPreviewProgress} api={null} onConnect={()=>setPreviewHint(t('预览仅展示问答入口，实际问答由学生使用自己的 API。'))} onBack={()=>setPreview(null)}/></CampusDialog>}
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
      <p className="cp-info">{t('可直接修改讲解、知识点、阅读步骤及题目。保存后为草稿，检查后再发布。')}</p>
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
              setDraft((d) => ({ ...d, week: Number(e.target.value), weekUnconfirmed:false }))
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
              <button className="cp-button" type="button" disabled={busy} onClick={()=>updateUnit(i,{questions:[...unit.questions,{id:crypto.randomUUID(),prompt:'',options:['','','',''],answer:0,explanation:'',sourcePages:[unit.pages[0]]}]})}>{t('添加选择题')}</button>
              {unit.questions.map((q, qi) => (
                <fieldset className="cp-edit-question" key={q.id}>
                  <legend>{t('练习 {number}', { number: qi + 1 })}</legend><button type="button" className="cp-link" onClick={()=>updateUnit(i,{questions:unit.questions.filter(item=>item.id!==q.id)})}>{t('删除这道题')}</button>
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
                  <label>{t('引用原文页')}<select value={q.sourcePages[0]} onChange={e=>updateUnit(i,{questions:unit.questions.map((item,k)=>k===qi?{...item,sourcePages:[Number(e.target.value)]}:item)})}>{draft.document.pages.map(p=><option value={p.page} key={p.page}>{t('第 {page} 页',{page:p.page})}</option>)}</select></label>
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
