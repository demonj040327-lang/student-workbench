import {useEffect,useState} from 'react';
import type {CampusMaterial,StudentProgress} from './campusStore';
import type {Assignment} from './data';
import {useI18n} from './i18n';
import {Meter,Empty} from './CampusUI';

type Props={courseId:string;currentWeek:number;materials:CampusMaterial[];assignments:Assignment[];progress:StudentProgress;onMaterial:(m:CampusMaterial)=>void;onAssignment:(a:Assignment)=>void;onAddExample?:()=>void};
export default function StudentCourseContent({courseId,currentWeek,materials,assignments,progress,onMaterial,onAssignment,onAddExample}:Props) {
 const {t,language}=useI18n();const tr=(zh:string,en:string)=>language==='en'?en:zh;
 const storageKey=`workbench-course-content-${courseId}`;
 const [tab,setTab]=useState(()=>{try{return localStorage.getItem(storageKey)==='coursework'?'coursework':'learning';}catch{return 'learning';}});
 const [savedWeeks]=useState<Record<string,boolean>>(()=>{try{return JSON.parse(localStorage.getItem(`${storageKey}-weeks`)||'{}');}catch{return {};}});
 useEffect(()=>{try{localStorage.setItem(storageKey,tab);}catch{}},[storageKey,tab]);
 const weeks=[...new Set(materials.map(m=>m.weekUnconfirmed?0:m.week))].sort((a,b)=>a===0?1:b===0?-1:a-b);
 const defaultWeek=weeks.includes(currentWeek)?currentWeek:weeks.filter(w=>w>0&&w<=currentWeek).at(-1)??weeks[0];
 const tabs=[['learning',tr('课程学习','Learning'),materials.length],['coursework',tr('课程作业','Coursework'),assignments.length]] as const;
 function switchKey(e:React.KeyboardEvent<HTMLButtonElement>){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'learning':e.key==='End'?'coursework':tab==='learning'?'coursework':'learning';setTab(next);document.getElementById(`${courseId}-tab-${next}`)?.focus();}
 return <section className="student-course-content">
  <div className="student-content-tabs" role="tablist" aria-label={tr('课程内容','Course content')}>{tabs.map(([value,label,count])=><button key={value} id={`${courseId}-tab-${value}`} role="tab" aria-selected={tab===value} aria-controls={`${courseId}-panel-${value}`} tabIndex={tab===value?0:-1} onKeyDown={switchKey} onClick={()=>setTab(value)}>{label}<small>{count}</small></button>)}</div>
  <div role="tabpanel" id={`${courseId}-panel-learning`} aria-labelledby={`${courseId}-tab-learning`} hidden={tab!=='learning'}>
   {weeks.map(week=>{const items=materials.filter(m=>(m.weekUnconfirmed?0:m.week)===week);const topics=[...new Set(items.map(m=>m.weekTopic?.trim()).filter(Boolean))];return <WeekGroup key={week} week={week} title={topics.join(' · ')} count={items.length} initiallyOpen={savedWeeks[week]??week===defaultWeek} onToggle={open=>{try{const state=JSON.parse(localStorage.getItem(`${storageKey}-weeks`)||'{}');localStorage.setItem(`${storageKey}-weeks`,JSON.stringify({...state,[week]:open}));}catch{}}}><div className="cp-student-materials">{items.map(m=>{const done=m.document.units.filter(u=>progress.units[u.id]).length;return <button className="cp-card cp-student-material" key={m.id} onClick={()=>onMaterial(m)}><div><small>{m.name.split('.').pop()?.toUpperCase()} · {m.document.pages.length} {tr('页','pages')}</small><h3>{m.title}</h3><p>{m.document.units.length} {tr('个模块','modules')} · {m.document.units.flatMap(u=>u.questions).length} {tr('道练习','questions')}</p><Meter percent={m.document.units.length?Math.round(done/m.document.units.length*100):0} label={t('学习模块完成度')}/></div><span>{t(done?'继续学习':'开始学习')} →</span></button>})}</div></WeekGroup>;})}
   {!materials.length&&<Empty title={t('教师还没有发布这门课的资料')}/>}
  </div>
  <div role="tabpanel" id={`${courseId}-panel-coursework`} aria-labelledby={`${courseId}-tab-coursework`} hidden={tab!=='coursework'} className="student-coursework-list">
   {assignments.map(a=><button key={a.id} className="cp-card student-assignment-card" onClick={()=>onAssignment(a)}><div><strong>{a.title}</strong><small>{tr('截止日期','Due')} · {a.due||tr('待教师确认','Awaiting confirmation')}</small></div><span>{tr('查看作业','Open assignment')} →</span></button>)}
   {!assignments.length&&<Empty title={tr('暂无已发布作业','No published coursework')}/>}
   {onAddExample&&<button className="cp-button" onClick={onAddExample}>{t('载入作业流程示例（非真实作业）')}</button>}
  </div>
 </section>;
}

function WeekGroup({week,title,count,initiallyOpen,onToggle,children}:{week:number;title:string;count:number;initiallyOpen:boolean;onToggle:(open:boolean)=>void;children:React.ReactNode}) {
 const {t,language}=useI18n();const [open,setOpen]=useState(initiallyOpen);
 return <details className="student-week-group" open={open}><summary onClick={e=>{e.preventDefault();const value=!open;setOpen(value);onToggle(value);}}><span className="student-week-chevron" aria-hidden="true">›</span><span>{week?t('第 {week} 周',{week}):t('周次待确认')}</span>{title&&<strong>{title}</strong>}<small>{count} {language==='en'?'files':'份资料'}</small></summary>{children}</details>;
}
