import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { courseColors, courseMaterials, isoDate, loadState, mondayOf, persistState, questions, shiftDate, type Assignment, type Course, type Question, type State, type Step, defaultSemester } from './data';
import { deleteAsset, listAssets, saveAsset, type StoredAsset } from './storage';
import Recorder from './Recorder';
import SemesterOverview from './SemesterOverview';
import {AssignmentDetails,SemesterSettings} from './SemesterControls';
import WeeklyCourses from './WeeklyCourses';
import MaterialStudy from './MaterialStudy';
import type {StudySource} from './studyTypes';
import {courseTutorials} from './courseTutorials';
import {deleteStudyForSource} from './studyStore';

type View = 'material' | 'semester' | 'week' | 'courses' | 'learn' | 'notes';
type Task = {assignment: Assignment; step: Step; course: Course};
type Dialog = {kind:'course'} | {kind:'assignment'} | {kind:'task';assignmentId:string;stepId:string} | {kind:'question';courseId:string;questionId:string} | {kind:'asset';asset:StoredAsset} | {kind:'material';name:string;url:string;type:string} | {kind:'semester-settings'} | {kind:'project';assignmentId:string};
const icons: Record<string, string> = {
  semester:'M4 4v16h16M8 8h10M8 12h6M8 16h9',
  week:'M4 5h16v15H4z M7 3v4m10-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2',
  courses:'M4 5h6l2 2h8v13H4z',learn:'m12 3 9 5-9 5-9-5 9-5m-6 7v7c4 3 8 3 12 0v-7',
  notes:'M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5',plus:'M12 5v14M5 12h14',
  arrow:'M5 12h14m-5-5 5 5-5 5',chevron:'m9 5 7 7-7 7',clock:'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4L19 6',file:'M6 3h8l4 4v14H6zM14 3v5h4m-9 4h6m-6 4h6',upload:'M12 16V4m-4 4 4-4 4 4M5 15v5h14v-5',
  link:'m9 15 6-6m-5-2 2-2a4 4 0 0 1 6 6l-2 2m-2 4-2 2a4 4 0 0 1-6-6l2-2',
  pause:'M8 5v14M16 5v14',trash:'M4 6h16M9 6V3h6v3m-9 0 1 15h10l1-15m-8 4v7m4-7v7'
};
function Icon({name,size=20}:{name:string;size?:number}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name] || icons.file}/></svg>; }
function courseStyle(course: Course): CSSProperties { return {'--course-color':course.color} as CSSProperties; }
const dateLabel = (date:string) => date?new Date(`${date}T12:00:00`).toLocaleDateString('zh-CN',{month:'long',day:'numeric'}):'时间待确认';
const dayLabels = ['周一','周二','周三','周四','周五','周六','周日'];
function remaining(date: string) { if(!date)return Number.POSITIVE_INFINITY;return Math.round((new Date(`${date}T12:00:00`).getTime()-new Date(`${isoDate(new Date())}T12:00:00`).getTime())/86400000); }
function dueLabel(date: string) { if(!date)return '时间待确认';const d=remaining(date);return d<0?`已过期 ${-d} 天`:d===0?'今天截止':`还有 ${d} 天`; }
function id() { return typeof crypto.randomUUID==='function'?crypto.randomUUID():`local-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="modal-inner"><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><Icon name="close"/></button></header>{children}</div>
  </dialog>;
}

function NewCourse({onSave}:{onSave:(course:Course)=>void}) {
  const [color,setColor]=useState(courseColors[0]);
  function submit(e:FormEvent<HTMLFormElement>) {e.preventDefault();const f=new FormData(e.currentTarget);onSave({id:id(),name:String(f.get('name')).trim(),subject:String(f.get('subject')).trim(),code:String(f.get('code')).trim() || 'COURSE',color});}
  return <form onSubmit={submit} className="form-stack">
    <p className="muted">给课程一个固定位置，资料和任务都会归在这里。</p>
    <label>课程名称<input name="name" required maxLength={80} placeholder="例如：Introduction to Sociology"/></label>
    <div className="form-grid"><label>学科<input name="subject" required maxLength={40} placeholder="例如：社会学"/></label><label>课程简称<input name="code" maxLength={12} placeholder="例如：SOC"/></label></div>
    <fieldset><legend>课程颜色</legend><div className="colors">{courseColors.map(c=><button key={c} type="button" className={`color-option ${c===color?'selected':''}`} style={{background:c}} onClick={()=>setColor(c)} aria-label={`选择颜色 ${courseColors.indexOf(c)+1}`} aria-pressed={c===color}>{c===color&&<Icon name="check" size={16}/>}</button>)}</div></fieldset>
    <button className="button button-primary" type="submit">创建课程<Icon name="plus" size={17}/></button>
  </form>;
}

function NewAssignment({state,onSave}:{state:State;onSave:(a:Assignment)=>void}) {
  const [error,setError]=useState('');
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const f=new FormData(e.currentTarget);const due=String(f.get('due'));
    const titles=String(f.get('steps')).split('\n').map(t=>t.trim()).filter(Boolean);
    if(!titles.length){setError('至少写下一步要做的事。');return;}
    if(titles.length>20){setError('请把步骤控制在 20 个以内。');return;}
    const today=isoDate(new Date());
        const start=Math.round((new Date(`${today}T12:00:00`).getTime()-new Date(`${state.anchor}T12:00:00`).getTime())/86400000);
    const last=due?Math.round((new Date(`${due}T12:00:00`).getTime()-new Date(`${state.anchor}T12:00:00`).getTime())/86400000):start+titles.length;
    const brief=String(f.get('brief')).trim();
    onSave({id:id(),courseId:String(f.get('course')),title:String(f.get('title')).trim(),due,brief,category:'coursework',deadlineVerified:false,steps:titles.map((title,i)=>({id:id(),title,minutes:20,day:Math.min(start+i,last),done:false,blocked:false,evidence:'完成这一小步后由自己确认',source:brief?'用户输入的作业要求':'手动创建的任务，无原文引用'}))});
  }
  return <form onSubmit={submit} className="form-stack">
    <p className="muted">选择课程，确认截止日期，列出需要完成的步骤。</p>
    <label>归属课程<select name="course">{state.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>作业标题<input name="title" required maxLength={100} placeholder="例如：阅读回应 · Week 4"/></label>
    <label>截止日期（可以稍后确认）<input name="due" type="date"/></label>
    <label>原始作业要求<textarea name="brief" maxLength={10000} rows={3} placeholder="粘贴要求，便于之后核对。"/></label>
    <label>拆成小步骤（一行一步）<textarea name="steps" required rows={4} maxLength={5000} placeholder={'读要求并圈出交付物\n找出主要论点\n整理支持证据\n完成初稿并检查引用'}/></label>
    <p className="small muted">每步先按 20 分钟安排，可在任务详情中调整。步骤会从今天开始安排，并限制在截止日内。</p>
    {error&&<p className="error-text" role="alert">{error}</p>}
    <button className="button button-primary" type="submit">加入学习计划<Icon name="arrow" size={17}/></button>
  </form>;
}

function QuestionCard({q,passed,onPass,sourceUrl}:{q:Question;passed:boolean;onPass:()=>void;sourceUrl?:string}) {
  const [selected,setSelected]=useState<number|null>(null);const [checked,setChecked]=useState(false);
  const correct=checked&&selected===q.answer;
  return <div className="question-content"><span className="eyebrow">示例微课 · 理解检查</span><h3>{q.prompt}</h3>
    <div className="answer-options" role="radiogroup" aria-label="选择你的答案">{q.options.map((o,i)=><button key={o} role="radio" aria-checked={selected===i} className={`answer-option ${selected===i?'chosen':''} ${checked&&i===q.answer?'right-answer':''} ${checked&&selected===i&&i!==q.answer?'wrong-answer':''}`} onClick={()=>{setSelected(i);setChecked(false);}}><span className="answer-letter">{String.fromCharCode(65+i)}</span>{o}</button>)}</div>
    {checked&&<div className={`feedback ${correct?'correct':'try-again'}`} aria-live="polite"><strong>{correct?'理解到位':'再想一下'}</strong><p>{q.explanation}</p>{!correct&&<p className="small">可以读下方依据，再选择一次。</p>}</div>}
    <details className="source-box"><summary><Icon name="link" size={16}/>{q.source}</summary><p>{q.excerpt}</p><span className="small muted">依据本地真实课件人工核对；并非上传后自动生成。</span>{sourceUrl&&<a className="source-original" href={`${sourceUrl}#page=${q.sourcePage || 1}`} target="_blank" rel="noreferrer">打开对应课件原文<Icon name="link" size={14}/></a>}</details>
    {!correct?<button className="button button-primary" disabled={selected===null} onClick={()=>setChecked(true)}>检查答案<Icon name="arrow" size={17}/></button>:<button className="button button-primary" onClick={onPass}>{passed?'返回学习路径':'记录本关完成'}<Icon name="check" size={17}/></button>}
    <p className="small muted">通过一道选择题代表完成这次检查，不等于达到整门课程要求。</p>
  </div>;
}

function AssetPreview({asset}:{asset:StoredAsset}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const u=URL.createObjectURL(asset.blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[asset]);
  const pdf=asset.type==='application/pdf';
  const audio=asset.type.startsWith('audio/');
  return <div className="asset-preview">{pdf?<iframe title={asset.name} src={url||undefined} sandbox="allow-same-origin"/>:audio?<audio controls src={url||undefined}/>:<p className="muted">此格式在 Demo 中保存原文件，可下载后打开。点击课程资料中的“开始学习”可查看逐页提取的文字。</p>}<a className="button" href={url} download={asset.name}><Icon name="file" size={17}/>下载原文件</a><p className="small muted">原文件保存在当前浏览器；课件导读和 ELM 问答从“开始学习”进入。</p></div>;
}

export default function App() {
  const [state,setState]=useState(loadState);
  const [view,setView]=useState<View>('semester');
  const [courseFilter,setCourseFilter]=useState('all');
  const [activeCourse,setActiveCourse]=useState(state.courses[0]?.id || '');
  const [studySource,setStudySource]=useState<StudySource|null>(null);
  const [dayFilter,setDayFilter]=useState<number|null>(null);
  const [shortOnly,setShortOnly]=useState(false);
  const [weekOffset,setWeekOffset]=useState(0);
  const [dialog,setDialog]=useState<Dialog|null>(null);
  const [notice,setNotice]=useState('');
  const [assets,setAssets]=useState<StoredAsset[]>([]);
  const [uploadError,setUploadError]=useState('');
  const [uploading,setUploading]=useState(false);
  const [noteText,setNoteText]=useState('');
  const activeCourseRef=useRef(activeCourse);
  activeCourseRef.current=activeCourse;
  const fileInput=useRef<HTMLInputElement>(null);
  const semester=state.semester || defaultSemester;
  const semesterAssignments=state.assignments.filter(a=>a.category!=='review'&&!a.planOnly);
  const currentWeek=mondayOf(new Date());
  const currentBase=Math.round((new Date(`${currentWeek}T12:00:00`).getTime()-new Date(`${state.anchor}T12:00:00`).getTime())/86400000);
  const weekBase=currentBase+weekOffset*7;
  const weekStart=shiftDate(state.anchor,weekBase);
  const course=state.courses.find(c=>c.id===activeCourse) || state.courses[0];
  const tasks:Task[]=state.assignments.flatMap(assignment=>{const c=state.courses.find(c=>c.id===assignment.courseId);return c?assignment.steps.map(step=>({assignment,step,course:c})):[];});
  const weekTasks=tasks.filter(t=>t.step.day>=weekBase&&t.step.day<weekBase+7);
  const visibleTasks=weekTasks.filter(t=>(courseFilter==='all'||t.course.id===courseFilter)&&(dayFilter===null||t.step.day===weekBase+dayFilter)&&(!shortOnly||t.step.minutes<=15));
  const todo=weekTasks.filter(t=>!t.step.done);
  const next=[...todo].filter(t=>!t.step.blocked&&(courseFilter==='all'||t.course.id===courseFilter)&&(!shortOnly||t.step.minutes<=15)).sort((a,b)=>a.assignment.due.localeCompare(b.assignment.due)||a.step.day-b.step.day)[0];
  const done=weekTasks.filter(t=>t.step.done).length;
  const totalMinutes=todo.reduce((s,t)=>s+t.step.minutes,0);
  const courseAssignments=state.assignments.filter(a=>a.courseId===activeCourse);
  const courseQuestions=questions[activeCourse] || [];
  const materials=courseMaterials[activeCourse] || [];

  useEffect(()=>{try{persistState(state);}catch{setNotice('浏览器无法保存进度。请检查存储空间或隐私设置。');}},[state]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);},[notice]);
  async function refreshAssets() {const cid=activeCourseRef.current;try{const a=await listAssets(cid);if(activeCourseRef.current===cid){setAssets(a);setUploadError('');}}catch{if(activeCourseRef.current===cid)setUploadError('无法读取本地文件，请检查浏览器存储设置。');}}
  useEffect(()=>{let live=true;setAssets([]);listAssets(activeCourse).then(a=>{if(live){setAssets(a);setUploadError('');}}).catch(()=>{if(live)setUploadError('无法读取本地文件，请检查浏览器存储设置。');});return()=>{live=false;};},[activeCourse]);
  useEffect(()=>{setNoteText('');},[activeCourse]);
  function updateStep(aid:string,sid:string,patch:Partial<Step>) {setState(s=>({...s,assignments:s.assignments.map(a=>a.id===aid?{...a,steps:a.steps.map(st=>st.id===sid?{...st,...patch}:st)}:a)}));}
  function completeTask(t:Task) {updateStep(t.assignment.id,t.step.id,{done:!t.step.done,blocked:false});setNotice(t.step.done?'已恢复为待完成':'已记录进度，下一步可以继续了。');}
  function moveTask(t:Task) {const day=t.step.day+1;if(t.assignment.due&&shiftDate(state.anchor,day)>t.assignment.due){setNotice('顺延会超过截止日，请先调整截止日期或任务安排。');return;}updateStep(t.assignment.id,t.step.id,{day});setNotice(`已挪到 ${dateLabel(shiftDate(state.anchor,day))}`);setDialog(null);}
  function openTask(t:Task) {setDialog({kind:'task',assignmentId:t.assignment.id,stepId:t.step.id});}
  function selectCourse(cid:string,newView:View='courses') {setActiveCourse(cid);setStudySource(null);setView(newView);}
  function openStudy(source:StudySource){setActiveCourse(source.courseId);setStudySource(source);setView('material');window.scrollTo({top:0});}
  function openCourseCard(cid:string){selectCourse(cid);setTimeout(()=>document.querySelector('.course-workspace')?.scrollIntoView({block:'start'}),0);}
  async function upload(files:FileList|null) {
    if(!files?.length)return;setUploading(true);setUploadError('');const cid=activeCourse;
    try{
      for(const f of Array.from(files)){
        if(f.size>25*1024*1024)throw new Error(`${f.name} 超过 25 MB，请选较小文件。`);
        if(!/\.(pdf|pptx|txt|md|docx)$/i.test(f.name))throw new Error('请选择 PDF、PPTX、DOCX 或文本文件。');
        await saveAsset(cid,f);
      }
      const a=await listAssets(cid);if(activeCourseRef.current===cid)setAssets(a);setNotice('资料已保存在所选课程下。');
    }catch(e){if(activeCourseRef.current===cid){setUploadError(e instanceof Error?e.message:'文件保存失败，请重试。');const a=await listAssets(cid).catch(()=>[]);if(activeCourseRef.current===cid)setAssets(a);}}
    finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
  }
  function addNote(e:FormEvent) {e.preventDefault();if(!noteText.trim())return;setState(s=>({...s,notes:[{id:id(),courseId:activeCourse,text:noteText.trim(),createdAt:new Date().toISOString()},...s.notes]}));setNoteText('');setNotice('疑问已归入当前课程，方便之后继续。');}
  const selectedTask=dialog?.kind==='task'?tasks.find(t=>t.assignment.id===dialog.assignmentId&&t.step.id===dialog.stepId):undefined;
  const selectedQuestion=dialog?.kind==='question'?questions[dialog.courseId]?.find(q=>q.id===dialog.questionId):undefined;
  const navigation:[View,string][]=[['semester','学期'],['week','本周'],['courses','课程'],['learn','学习路径'],['notes','课堂记录']];

  const selectedProject=dialog?.kind==='project'?state.assignments.find(a=>a.id===dialog.assignmentId):undefined;
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setView('semester');}}><span className="brand-mark"><i/><i/><i/></span><span>workbench<span className="brand-caption">学习工作台</span></span></a>
      <span className="sidebar-label">我的工作台</span><nav aria-label="主导航">{navigation.map(([v,label])=><button key={v} className={`nav-item ${view===v||(view==='material'&&v==='courses')?'active':''}`} onClick={()=>setView(v)}><Icon name={v}/>{label}{v==='week'&&todo.length>0&&<span className="nav-count">{todo.length}</span>}</button>)}</nav>
      <div className="sidebar-course-title"><span className="sidebar-label">课程</span><button className="icon-button small-icon" onClick={()=>setDialog({kind:'course'})} aria-label="创建课程"><Icon name="plus" size={16}/></button></div>
      <div className="sidebar-courses">{state.courses.map(c=><button key={c.id} onClick={()=>selectCourse(c.id)} className={`sidebar-course ${view!=='week'&&view!=='semester'&&c.id===activeCourse?'selected':''}`} style={courseStyle(c)}><span className="course-dot"/><span>{c.code}</span><span className="course-subject">{c.subject}</span></button>)}</div>
      <div className="sidebar-bottom"><span className="avatar">JG</span><div><strong>我的学习空间</strong><span>本地 Demo · 无需登录</span></div></div>
    </aside>

    <div className="workspace"><header className="topbar"><div className="breadcrumbs">我的空间<span>/</span>{view==='material'?'课件学习':navigation.find(([v])=>v===view)?.[1]}</div><div className="topbar-actions"><span className="demo-badge">交互原型</span><a className="reference-link" href="/references/index.html" target="_blank" rel="noreferrer">设计参考<Icon name="link" size={14}/></a></div></header>
      <div className={`workspace-columns ${view==='semester'||view==='material'?'semester-layout':''}`}><main className={`main-content ${view==='semester'?'semester-content':view==='material'?'material-view-content':''}`}>
        {view==='semester'&&<><SemesterOverview courses={state.courses} assignments={semesterAssignments} semester={semester} anchor={state.anchor} onOpen={a=>setDialog({kind:'project',assignmentId:a.id})} onAdd={()=>setDialog({kind:'assignment'})} onSettings={()=>setDialog({kind:'semester-settings'})}/><WeeklyCourses courses={state.courses} assignments={state.assignments} anchor={state.anchor} onCourse={openCourseCard} onStep={(aid,sid,done)=>updateStep(aid,sid,{done,blocked:false})}/></>}
        {view==='material'&&studySource&&<MaterialStudy key={`${studySource.courseId}:${studySource.id}`} source={studySource} onBack={()=>selectCourse(studySource.courseId)}/> }
        {view==='week'&&<>
          <div className="page-heading"><div><h1>本周任务</h1><p className="muted">课程、作业与复习目标，放在同一个地方。</p></div><button className="button button-primary add-task" onClick={()=>setDialog({kind:'assignment'})}><Icon name="plus" size={17}/><span>添加作业</span></button></div>
          <div className="week-summary"><div><strong>{done}<span> / {weekTasks.length}</span></strong><span>本周已完成</span></div><div><strong>{todo.length}<span> 步</span></strong><span>还可以继续</span></div><div><strong>{Math.floor(totalMinutes/60)}<span> 小时 {totalMinutes%60} 分</span></strong><span>剩余预计用时 · 可调整</span></div></div>
          <div className="week-heading"><div className="week-switch"><button className="icon-button" aria-label="上一周" onClick={()=>{setWeekOffset(w=>w-1);setDayFilter(null);}}><span>‹</span></button><h2>{dateLabel(weekStart)} — {dateLabel(shiftDate(weekStart,6))}</h2><button className="icon-button" aria-label="下一周" onClick={()=>{setWeekOffset(w=>w+1);setDayFilter(null);}}><span>›</span></button></div>{weekOffset!==0?<button className="text-button" onClick={()=>{setWeekOffset(0);setDayFilter(null);}}>回到本周</button>:<span className="small muted">{new Date().toLocaleDateString('zh-CN',{weekday:'long'})}</span>}</div>
          <div className="week-strip">{dayLabels.map((label,i)=>{const date=shiftDate(weekStart,i);const n=weekTasks.filter(t=>t.step.day===weekBase+i&&!t.step.done).length;return <button key={label} className={`day-button ${dayFilter===i?'selected':''} ${date===isoDate(new Date())?'today':''}`} onClick={()=>setDayFilter(d=>d===i?null:i)} aria-pressed={dayFilter===i}><span>{label}</span><strong>{new Date(`${date}T12:00:00`).getDate()}</strong><span className={`day-indicator ${n?'has-tasks':''}`}>{n?`${n} 步`:'—'}</span></button>;})}</div>
          {next&&<section className="next-step" style={courseStyle(next.course)}><div className="next-copy"><span className="eyebrow"><span className="course-dot"/>可以从这里开始 · {next.course.code}</span><h3>{next.step.title}</h3><p><Icon name="clock" size={15}/>{next.step.minutes} 分钟<span>·</span>{next.assignment.title}</p></div><button className="button next-button" onClick={()=>openTask(next)}>开始这一步<Icon name="arrow" size={17}/></button></section>}
          <div className="list-toolbar"><h2>本周小步骤<span>{visibleTasks.length}</span></h2><button className={`time-filter ${shortOnly?'active':''}`} onClick={()=>setShortOnly(v=>!v)} aria-pressed={shortOnly}><Icon name="clock" size={15}/>我只有 15 分钟</button></div>
          <div className="course-filters"><button className={courseFilter==='all'?'selected':''} onClick={()=>setCourseFilter('all')}>全部课程</button>{state.courses.map(c=><button key={c.id} className={courseFilter===c.id?'selected':''} onClick={()=>setCourseFilter(c.id)} style={courseStyle(c)}><span className="course-dot"/>{c.code}</button>)}{dayFilter!==null&&<button className="clear-filter" onClick={()=>setDayFilter(null)}>清除日期筛选 ×</button>}</div>
          <div className="task-list">{visibleTasks.sort((a,b)=>a.step.day-b.step.day||Number(a.step.done)-Number(b.step.done)).map(t=><div className={`task-row ${t.step.done?'is-done':''}`} key={t.step.id} style={courseStyle(t.course)}><button className="task-check" onClick={()=>completeTask(t)} aria-label={`${t.step.done?'恢复':'完成'}：${t.step.title}`} aria-pressed={t.step.done}>{t.step.done&&<Icon name="check" size={15}/>}</button><button className="task-body" onClick={()=>openTask(t)}><span className="task-title">{t.step.title}{t.step.blocked&&<span className="blocked-badge">卡住了</span>}</span><span className="task-context"><span className="course-tag">{t.course.code}</span>{t.assignment.title}</span></button><button className="task-end" onClick={()=>openTask(t)}><span>{dayLabels[((t.step.day%7)+7)%7]}</span><span>{t.step.minutes} 分<Icon name="chevron" size={14}/></span></button></div>)}</div>
          {!visibleTasks.length&&<div className="empty-state"><Icon name="week" size={28}/><h3>这里暂时没有步骤</h3><p>可以切换日期或课程，也可以添加一份作业。</p><button className="button" onClick={()=>{setCourseFilter('all');setDayFilter(null);setShortOnly(false);}}>显示这一周的全部任务</button></div>}
          <p className="prototype-note">课程课后复习步骤与 coursework 分别记录；作业日期可在学期总览核对。</p>
        </>}

        {view==='courses'&&<>
          <div className="page-heading"><div><h1>课程资料</h1><p className="muted">先分好课程，再整理每周的内容。</p></div><button className="button button-primary" onClick={()=>setDialog({kind:'course'})}><Icon name="plus" size={17}/>创建课程</button></div>
          <div className="course-grid">{state.courses.map(c=>{const own=tasks.filter(t=>t.course.id===c.id);return <button key={c.id} className={`course-card ${activeCourse===c.id?'active':''}`} style={courseStyle(c)} onClick={()=>setActiveCourse(c.id)}><span className="course-card-top"><span className="course-code">{c.code}</span><Icon name="courses" size={19}/></span><h3>{c.name}</h3><p>{c.subject}</p><span className="course-card-progress"><span style={{width:`${own.length?own.filter(t=>t.step.done).length/own.length*100:0}%`}}/></span><span className="small muted">{own.filter(t=>t.step.done).length} / {own.length} 个步骤完成</span></button>;})}</div>
          {course&&<section className="course-workspace"><div className="section-title"><div><span className="eyebrow">{course.code} · 课程空间</span><h2>{course.name}</h2></div><button className="button" onClick={()=>selectCourse(course.id,'learn')}>学习路径<Icon name="arrow" size={16}/></button></div>
            <div className="materials-header"><h3>课程资料<span>{materials.length+assets.length}</span></h3><button className="button button-small" disabled={uploading} onClick={()=>fileInput.current?.click()}><Icon name="upload" size={16}/>{uploading?'保存中…':'上传资料'}</button><input ref={fileInput} type="file" multiple accept=".pdf,.pptx,.txt,.md,.docx" hidden onChange={e=>void upload(e.target.files)}/></div>
            <p className="small muted course-file-helper">选择一份课件开始学习：分步导读、选择题、知识点讲解与 ELM 问答。每份资料都有独立进度和出处。</p>
            {uploadError&&<p className="error-text" role="alert">{uploadError}</p>}
            <div className="asset-list">{materials.map(m=><div className="asset-row original-material" key={m.id}><Icon name="file" size={19}/><button className="asset-name" onClick={()=>setDialog({kind:'material',name:m.name,url:m.url,type:m.type})}>{m.name}<span>来自你的课程文件夹 · 本地课件副本</span></button><div className="asset-actions"><span className="original-label">原课件</span><button className="study-open-button" onClick={()=>openStudy({id:m.id,courseId:activeCourse,name:m.name,type:m.type,url:m.url,materialId:m.id,tutorials:courseTutorials[m.id]})}>开始学习 →</button></div></div>)}{assets.map(a=><div className="asset-row" key={a.id}><Icon name="file" size={19}/><button className="asset-name" onClick={()=>setDialog({kind:'asset',asset:a})}>{a.name}<span>{(a.size/1024/1024).toFixed(2)} MB · {new Date(a.createdAt).toLocaleDateString('zh-CN')}</span></button><div className="asset-actions">{/\.(pdf|pptx|docx|txt|md)$/i.test(a.name)&&<button className="study-open-button" onClick={()=>openStudy({id:a.id,courseId:a.courseId,name:a.name,type:a.type,blob:a.blob})}>开始学习 →</button>}<button className="icon-button" aria-label={`删除 ${a.name}`} onClick={async()=>{try{await deleteStudyForSource(a.courseId,a.id);await deleteAsset(a.id);await refreshAssets();setNotice('文件与学习记录已从本地删除。');}catch{setUploadError('删除失败，请重试。');}}}><Icon name="trash" size={16}/></button></div></div>)}</div>
            {!assets.length&&<div className="upload-placeholder" onClick={()=>fileInput.current?.click()}><Icon name="upload" size={24}/><p>上传这一周的课件或作业说明</p><span>PDF、PPTX、DOCX、TXT、MD · 单个文件不超过 25 MB</span></div>}
            <div className="materials-header assignments-heading"><h3>作业与下一步<span>{courseAssignments.length}</span></h3><button className="text-button" onClick={()=>setDialog({kind:'assignment'})}>添加作业 +</button></div>
            {courseAssignments.map(a=><div className="assignment-card" key={a.id}><div><h3>{a.title}</h3><p className="small muted">{dateLabel(a.due)} {a.planOnly?'演示复习目标':'截止'} · {a.steps.filter(s=>s.done).length} / {a.steps.length} 步完成</p></div><div className="assignment-steps">{a.steps.map(s=><button key={s.id} onClick={()=>{const t=tasks.find(t=>t.step.id===s.id);if(t)openTask(t);}} className={s.done?'done':''}><span className="mini-check">{s.done&&<Icon name="check" size={11}/>}</span>{s.title}<Icon name="chevron" size={13}/></button>)}</div></div>)}
          </section>}
        </>}

        {view==='learn'&&<>
          <div className="page-heading"><div><h1>课程复习</h1><p className="muted">随时暂停。下次从这里继续。</p></div></div>
          <div className="course-filters learning-filters">{state.courses.map(c=><button key={c.id} className={activeCourse===c.id?'selected':''} onClick={()=>setActiveCourse(c.id)} style={courseStyle(c)}><span className="course-dot"/>{c.code}</button>)}</div>
          {course&&<div className="learning-head" style={courseStyle(course)}><span className="course-code">{course.code}</span><div><h2>{course.name}</h2><p className="muted">{course.topic || '个人课程'} · {courseQuestions.length} 个模块</p></div><span className="lesson-progress">{courseQuestions.filter(q=>state.passed.includes(q.id)).length} / {courseQuestions.length}</span></div>}
          <div className="learning-path">{courseQuestions.map((q,i)=>{const passed=state.passed.includes(q.id);return <button key={q.id} className={`module-card ${passed?'passed':''}`} onClick={()=>setDialog({kind:'question',courseId:activeCourse,questionId:q.id})}><span className="module-number">{passed?<Icon name="check" size={23}/>:String(i+1).padStart(2,'0')}</span><div className="module-copy"><span className="eyebrow">{i===0?'基础理解':i===1?'把概念用起来':'检查理解的边界'}</span><h3>{q.title}</h3><p>{q.minutes} 分钟 · 一次理解检查{passed?' · 已完成':''}</p></div><Icon name="arrow" size={20}/></button>;})}</div>
          {!courseQuestions.length&&<div className="empty-state"><h3>这门课程的学习路径尚未建立</h3><p>上传课件后，在课程资料中点击“开始学习”建立这份文件的学习路线。这里保留四门课程的基础概念检查。</p><button className="button" onClick={()=>setView('courses')}>前往课程空间</button></div>}
          <div className="learning-note"><Icon name="link" size={18}/><p>题目附真实课件页码，可打开原文核对。当前每门课程选取三个基础模块，尚未覆盖整份课件，也不代表达到整门课程要求。</p></div>
        </>}

        {view==='notes'&&<>
          <div className="page-heading"><div><h1>课堂记录</h1><p className="muted">课堂疑问和录音始终属于当前课程。</p></div></div>
          <label className="course-select-label">当前课程<select value={activeCourse} onChange={e=>setActiveCourse(e.target.value)}>{state.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <form className="note-composer" onSubmit={addNote}><label htmlFor="note">今天哪个地方还不太明白？</label><textarea id="note" value={noteText} onChange={e=>setNoteText(e.target.value)} rows={4} maxLength={5000} placeholder="例如：为什么这里要记录行为，而不能只询问用户满意度？" required/><div><span className="small muted">课件问答请从“课程资料 → 开始学习”进入。</span><button className="button button-primary" disabled={!noteText.trim()}>记下来<Icon name="arrow" size={17}/></button></div></form>
          <Recorder key={activeCourse} courseId={activeCourse} onSaved={()=>{void refreshAssets();setNotice('录音已保存在课程资料中。');}}/>
          <div className="section-title notes-title"><h2>这门课程的疑问</h2><span className="small muted">{state.notes.filter(n=>n.courseId===activeCourse).length} 条记录</span></div>
          <div className="notes-list">{state.notes.filter(n=>n.courseId===activeCourse).map(n=><article className="note-card" key={n.id}><div><span className="eyebrow">{course?.code} · 待理解</span><button className="icon-button small-icon" aria-label={`删除疑问：${n.text.slice(0,20)}`} onClick={()=>setState(s=>({...s,notes:s.notes.filter(note=>note.id!==n.id)}))}><Icon name="trash" size={15}/></button></div><p>{n.text}</p><span className="small muted">{new Date(n.createdAt).toLocaleDateString('zh-CN')}</span></article>)}</div>
          {!state.notes.some(n=>n.courseId===activeCourse)&&<p className="empty-inline">还没有疑问记录。看到不懂的地方，可以随时记下来。</p>}
          <button className="text-button" onClick={()=>setView('courses')}>打开课件与录音<Icon name="arrow" size={16}/></button>
        </>}
      </main>

      {view!=='semester'&&view!=='material'&&<aside className="context-panel"><div className="context-header"><span className="eyebrow">截止日期</span><h2>作业与复习目标</h2></div><div className="deadline-list">{[...state.assignments].filter(a=>a.steps.some(s=>!s.done)).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4).map(a=>{const c=state.courses.find(c=>c.id===a.courseId)!;const progress=a.steps.filter(s=>s.done).length;return <button className="deadline-card" key={a.id} style={courseStyle(c)} onClick={()=>selectCourse(c.id)}><div><span className="course-tag">{c.code}</span><span className={`due-pill ${remaining(a.due)<=3?'soon':''}`}>{a.planOnly?'复习目标 · ':''}{dueLabel(a.due)}</span></div><h3>{a.title}</h3><span className="small muted">{dateLabel(a.due)} · 还剩 {a.steps.length-progress} 步</span><div className="thin-progress"><i style={{width:`${progress/a.steps.length*100}%`}}/></div></button>;})}</div>
        <div className="context-learning"><span className="eyebrow">理解检查</span><h3>复习记录</h3><p>本周作业完成了 <strong>{done} 步</strong>。示例微课完成了 <strong>{state.passed.length} 关</strong>。</p><button className="text-button" onClick={()=>setView('learn')}>继续一次理解检查<Icon name="arrow" size={16}/></button></div>
        <div className="context-foot"><span className="eyebrow">TEACHATHON 2026</span><p>学习工作台 · 本地交互原型</p><a href="/项目方案.md" target="_blank" rel="noreferrer">查看项目方案 ↗</a></div>
      </aside>}</div>
    </div>
    <nav className="mobile-nav" aria-label="手机导航">{navigation.map(([v,label])=><button key={v} className={view===v||(view==='material'&&v==='courses')?'active':''} onClick={()=>setView(v)}><Icon name={v} size={21}/><span>{label}</span></button>)}</nav>
    {notice&&<div className="toast" role="status"><Icon name="check" size={17}/>{notice}</div>}
    {dialog?.kind==='semester-settings'&&<Modal title="学期设置" onClose={()=>setDialog(null)}><SemesterSettings semester={semester} onSave={value=>{setState(s=>({...s,semester:value}));setDialog(null);setNotice('学期时间已更新。');}}/></Modal>}
    {selectedProject&&<Modal title="作业进度" onClose={()=>setDialog(null)}><AssignmentDetails key={selectedProject.id} assignment={selectedProject} course={state.courses.find(c=>c.id===selectedProject.courseId)!} anchor={state.anchor} onUpdate={patch=>setState(s=>({...s,assignments:s.assignments.map(a=>a.id===selectedProject.id?{...a,...patch}:a)}))} onStep={(sid,done)=>updateStep(selectedProject.id,sid,{done,blocked:false})}/></Modal>}
    {dialog?.kind==='course'&&<Modal title="创建一门课程" onClose={()=>setDialog(null)}><NewCourse onSave={c=>{setState(s=>({...s,courses:[...s.courses,c]}));selectCourse(c.id);setDialog(null);setNotice('课程已创建，可以加入资料和任务了。');}}/></Modal>}
    {dialog?.kind==='assignment'&&<Modal title="添加一份作业" onClose={()=>setDialog(null)}><NewAssignment state={state} onSave={a=>{setState(s=>({...s,assignments:[...s.assignments,a]}));setView('semester');setWeekOffset(0);setDayFilter(null);setCourseFilter('all');setShortOnly(false);setDialog(null);setNotice('作业已加入学期总览。');}}/></Modal>}
    {selectedTask&&<Modal title="把这一小步推进" onClose={()=>setDialog(null)}><div className="task-detail" style={courseStyle(selectedTask.course)}><span className="course-tag">{selectedTask.course.code}</span><h3>{selectedTask.step.title}</h3><p className="muted">{selectedTask.assignment.title} · {dateLabel(selectedTask.assignment.due)} {selectedTask.assignment.planOnly?'演示学习目标，非正式截止':'截止'}</p><div className="detail-goal"><span className="eyebrow">做完以后，你会留下</span><p>{selectedTask.step.evidence}</p></div><label className="estimate-input">预计用时<input type="number" min={1} max={480} value={selectedTask.step.minutes} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=480)updateStep(selectedTask.assignment.id,selectedTask.step.id,{minutes:n});}}/>分钟</label><details className="source-box"><summary><Icon name="link" size={16}/>查看这一步的要求来源</summary><strong>{selectedTask.step.source}</strong><p>{selectedTask.assignment.brief || '没有粘贴原始说明。这是用户手动创建的任务。'}</p></details><div className="detail-actions"><button className="button button-primary" onClick={()=>{completeTask(selectedTask);setDialog(null);}}>{selectedTask.step.done?'恢复为待完成':'完成这一步'}<Icon name="check" size={17}/></button><button className="button" onClick={()=>moveTask(selectedTask)}>顺延一天<Icon name="arrow" size={16}/></button></div><button className="text-button stuck-button" onClick={()=>{updateStep(selectedTask.assignment.id,selectedTask.step.id,{blocked:!selectedTask.step.blocked});setNotice(selectedTask.step.blocked?'已恢复，可以继续':'已标记卡住，可在课堂记录里写下疑问。');setDialog(null);}}><Icon name="pause" size={15}/>{selectedTask.step.blocked?'我可以继续了':'我卡住了，先标记一下'}</button></div></Modal>}
    {selectedQuestion&&dialog?.kind==='question'&&<Modal title={selectedQuestion.title} onClose={()=>setDialog(null)}><QuestionCard q={selectedQuestion} sourceUrl={(courseMaterials[dialog.courseId] || []).find(m=>m.id===selectedQuestion.sourceId)?.url} passed={state.passed.includes(selectedQuestion.id)} onPass={()=>{setState(s=>({...s,passed:s.passed.includes(selectedQuestion.id)?s.passed:[...s.passed,selectedQuestion.id]}));setDialog(null);setNotice('这一关已完成，随时可以再来练习。');}}/></Modal>}
    {dialog?.kind==='asset'&&<Modal title={dialog.asset.name} onClose={()=>setDialog(null)}><AssetPreview asset={dialog.asset}/></Modal>}
    {dialog?.kind==='material'&&<Modal title={dialog.name} onClose={()=>setDialog(null)}><div className="asset-preview">{dialog.type==='application/pdf'?<iframe title={dialog.name} src={dialog.url}/>:<p className="muted">这是课程原始 PPTX，可在 PowerPoint 或 Keynote 打开。相机课程另有辅助 PDF 讲义，可以在课程资料中直接查看。</p>}<a className="button" href={dialog.url} target="_blank" rel="noreferrer"><Icon name="file" size={17}/>打开原课件</a><p className="small muted">本机原课件预览；学习导读与 ELM 问答从“开始学习”进入。</p></div></Modal>}
  </div>;
}
