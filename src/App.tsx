import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {courseColors, defaultSemester, loadState, persistState, type Assignment, type Course, type Step} from './data';
import SemesterOverview, {courseworkProgress} from './SemesterOverview';
import WeeklyCourses from './WeeklyCourses';
import {AssignmentDetails, SemesterSettings} from './SemesterControls';
import AssignmentPlanner from './AssignmentPlanner';
import CourseQuestions from './CourseQuestions';
import {courseAccent} from './courseTheme';
import {studyRequest, uid} from './studyClient';
import type {StudyServiceStatus} from './studyTypes';

type View = 'overview' | 'planner' | 'questions';
const navigation: [View, string, string][] = [['overview','任务总览','◷'],['planner','作业拆解','≡'],['questions','课件问答','?']];
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className="modal simple-modal" aria-labelledby="modal-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-inner"><header className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></header>{children}</div></dialog>;
}
function NewCourse({onSave}:{onSave:(course:Course)=>void}) {
  function submit(e:FormEvent<HTMLFormElement>) {e.preventDefault();const form=new FormData(e.currentTarget);const name=String(form.get('name')).trim();if(name)onSave({id:uid(),name,subject:String(form.get('subject')).trim(),code:String(form.get('code')).trim()||'COURSE',color:courseColors[0]});}
  return <form className="form-stack" onSubmit={submit}><label>课程名称<input name="name" required maxLength={80}/></label><div className="form-grid"><label>学科<input name="subject" maxLength={40}/></label><label>课程简称<input name="code" maxLength={12}/></label></div><button className="button button-primary">创建课程</button></form>;
}
export default function App() {
  const [state,setState]=useState(loadState);
  const [view,setView]=useState<View>('overview');
  const [activeCourse,setActiveCourse]=useState(state.courses[0]?.id || '');
  const [filter,setFilter]=useState('all');
  const [dialog,setDialog]=useState<'settings'|'course'|null>(null);
  const [assignmentId,setAssignmentId]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [storageError,setStorageError]=useState('');
  const [status,setStatus]=useState<StudyServiceStatus|null>(null);
  const assignments=state.assignments.filter(a=>a.category!=='review'&&!a.planOnly);
  const selected=state.assignments.find(a=>a.id===assignmentId);
  const selectedCourse=state.courses.find(c=>c.id===selected?.courseId);
  useEffect(()=>{try{persistState(state);setStorageError('');}catch{setStorageError('当前浏览器无法保存进度，请检查存储空间或隐私设置。');}},[state]);
  useEffect(()=>{const controller=new AbortController();studyRequest<StudyServiceStatus>('status',undefined,controller.signal).then(setStatus).catch(()=>{});return()=>controller.abort();},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
  function navigate(next:View) {setView(next);window.scrollTo({top:0});}
  function updateStep(aid:string,sid:string,patch:Partial<Step>) {setState(s=>({...s,assignments:s.assignments.map(a=>a.id===aid?{...a,steps:a.steps.map(step=>step.id===sid?{...step,...patch}:step)}:a)}));}
  function showCourse(id:string) {setFilter(id);setTimeout(()=>document.getElementById('assignment-list')?.scrollIntoView({behavior:'smooth',block:'start'}),0);}
  function saveAssignment(a:Assignment) {setState(s=>({...s,assignments:[...s.assignments,a]}));setFilter(a.courseId);setActiveCourse(a.courseId);navigate('overview');setNotice('已加入计划，可以在作业详情中更新进度。');}
  return <div className="app-shell simplified-app"><a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="app-nav"><div className="app-nav-inner"><a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('overview');}} aria-label="workbench 任务总览"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>workbench</span></a><nav className="desktop-navigation" aria-label="主导航">{navigation.map(([key,label])=><button key={key} className={`nav-item ${view===key?'active':''}`} aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>)}</nav><div className="app-nav-account"><button className="icon-button" aria-label="创建课程" title="创建课程" onClick={()=>setDialog('course')}>＋</button><span className="avatar" title="我的学习空间">JG</span></div></div></header>
    <div className="workspace"><header className="topbar"><div className="breadcrumbs">我的空间<span>/</span>{navigation.find(([key])=>key===view)?.[1]}</div><span className="demo-badge">本机演示 · 三项核心功能</span></header>
      <main id="main-content" tabIndex={-1} className="simple-main">
        {storageError&&<p className="simple-error" role="alert">{storageError}</p>}
        {view==='overview'&&<><SemesterOverview courses={state.courses} assignments={assignments} semester={state.semester||defaultSemester} anchor={state.anchor} onOpen={a=>setAssignmentId(a.id)} onAdd={()=>navigate('planner')} onSettings={()=>setDialog('settings')}/><WeeklyCourses courses={state.courses} assignments={assignments} anchor={state.anchor} onCourse={showCourse} onStep={(aid,sid,done)=>updateStep(aid,sid,{done,blocked:false})}/>
          <section id="assignment-list" className="simple-assignment-list" aria-labelledby="assignments-title"><div className="simple-section-heading"><div><span className="section-kicker">COURSEWORK</span><h2 id="assignments-title">全部作业</h2></div><label className="inline-label">课程<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部课程</option>{state.courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label></div>
          <div className="assignment-table">{assignments.filter(a=>filter==='all'||a.courseId===filter).map(a=>{const course=state.courses.find(c=>c.id===a.courseId);if(!course)return null;const percent=courseworkProgress(a);return <button className="assignment-row" key={a.id} onClick={()=>setAssignmentId(a.id)}><span className="assignment-course" style={{color:courseAccent(course)}}>{course.code}</span><span className="assignment-name"><strong>{a.title}</strong><small>{a.due?`${a.due} 截止`:'截止时间待确认'} · {a.steps.filter(s=>s.done).length}/{a.steps.length} 步</small></span><span className="assignment-meter"><span><i style={{width:`${percent}%`,background:courseAccent(course)}}/></span><b>{percent}%</b></span><span aria-hidden="true">↗</span></button>;})}{!assignments.some(a=>filter==='all'||a.courseId===filter)&&<div className="simple-empty"><p>这门课程还没有作业计划。</p><button className="button" onClick={()=>{setActiveCourse(filter==='all'?state.courses[0].id:filter);navigate('planner');}}>拆解一份作业</button></div>}</div><p className="simple-footnote">完成度按已勾选步骤计算，用于记录推进情况。</p></section>
        </>}
        {view==='planner'&&<AssignmentPlanner courses={state.courses} courseId={activeCourse} onCourse={setActiveCourse} anchor={state.anchor} aiConfigured={Boolean(status?.aiConfigured)} onSave={saveAssignment}/>}
        {view==='questions'&&<CourseQuestions courses={state.courses} courseId={activeCourse} onCourse={setActiveCourse} aiConfigured={Boolean(status?.aiConfigured)}/>}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="手机导航">{navigation.map(([key,label,symbol])=><button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}><span className="simple-nav-symbol" aria-hidden="true">{symbol}</span><span>{label}</span></button>)}</nav>
    {notice&&<div className="simple-toast" role="status">{notice}</div>}
    {dialog&&<Modal title={dialog==='settings'?'学期设置':'创建课程'} onClose={()=>setDialog(null)}>{dialog==='settings'?<SemesterSettings semester={state.semester||defaultSemester} onSave={semester=>{setState(s=>({...s,semester}));setDialog(null);}}/>:<NewCourse onSave={course=>{setState(s=>({...s,courses:[...s.courses,course]}));setActiveCourse(course.id);setDialog(null);setNotice('课程已创建，可以添加作业或上传课件。');}}/>}</Modal>}
    {selected&&selectedCourse&&<Modal title="作业详情" onClose={()=>setAssignmentId(null)}><AssignmentDetails key={selected.id} assignment={selected} course={selectedCourse} anchor={state.anchor} onUpdate={patch=>setState(s=>({...s,assignments:s.assignments.map(a=>a.id===selected.id?{...a,...patch}:a)}))} onStep={(sid,done)=>updateStep(selected.id,sid,{done,blocked:false})}/></Modal>}
  </div>;
}
