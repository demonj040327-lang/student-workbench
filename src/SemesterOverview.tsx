import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {Assignment,Course,Semester} from './data';

type Props={courses:Course[];assignments:Assignment[];semester:Semester;anchor?:string;onOpen:(a:Assignment)=>void;onAdd:()=>void;onSettings:()=>void};
const DAY=86400000;
export function monthDayNumber(value:string){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!m)return NaN;
 const n=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 return new Date(n).toISOString().slice(0,10)===value?n:NaN;
}
function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function shortDate(value:string){return value?`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`:'待确认';}
function toDate(value:number){return new Date(value).toISOString().slice(0,10);}
export function courseworkProgress(a:Assignment){return a.steps.length?Math.round(a.steps.filter(s=>s.done).length/a.steps.length*100):0;}
export function plannedStart(a:Assignment,anchor?:string){
 if(a.startsOn)return {date:monthDayNumber(a.startsOn),kind:'指定开始日'};
 const days=a.steps.map(s=>s.day).filter(Number.isFinite);
 return {date:anchor&&days.length?monthDayNumber(anchor)+Math.min(...days)*DAY:NaN,kind:'个人计划起点'};
}
function localMidnight(value:string,nextDay=false){
 if(!Number.isFinite(monthDayNumber(value)))return NaN;
 const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d+(nextDay?1:0)).getTime();
}
export function semesterElapsed(semester:Semester,now:number){
 const start=localMidnight(semester.start),end=localMidnight(semester.end,true);
 return Number.isFinite(start)&&end>start?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):0;
}
function useVisibleClock(){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{
  let timer:ReturnType<typeof setInterval>|undefined;
  const schedule=()=>{if(timer)clearInterval(timer);timer=undefined;if(document.visibilityState!=='hidden'){setNow(Date.now());timer=setInterval(()=>setNow(Date.now()),200);}};
  schedule();document.addEventListener('visibilitychange',schedule);
  return ()=>{if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',schedule);};
 },[]);return now;
}

export default function SemesterOverview({courses,assignments,semester,anchor,onOpen,onAdd,onSettings}:Props){
 const clock=useVisibleClock();const [filter,setFilter]=useState('all');const chartRef=useRef<HTMLDivElement>(null);
 const start=monthDayNumber(semester.start),end=monthDayNumber(semester.end),today=monthDayNumber(localToday());
 const elapsed=semesterElapsed(semester,clock),currentWeek=today>=start&&today<=end?Math.floor((today-start)/(7*DAY))+1:null;
 const startDate=new Date(Number.isFinite(start)?start:today),endDate=new Date(Number.isFinite(end)?end:today);
 const rangeStart=Date.UTC(startDate.getUTCFullYear(),startDate.getUTCMonth(),1);
 const rangeEnd=Math.max(Date.UTC(endDate.getUTCFullYear(),endDate.getUTCMonth()+1,1),Date.UTC(startDate.getUTCFullYear()+1,1,1));
 const span=rangeEnd-rangeStart;const position=(date:number)=>((date-rangeStart)/span)*100;
 const months:Array<{date:number;next:number;label:string}>=[];
 for(let date=rangeStart;date<rangeEnd&&months.length<24;){const d=new Date(date),next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);months.push({date,next,label:`${d.getUTCMonth()+1}月`});date=next;}
 const selected=assignments.filter(a=>filter==='all'||a.courseId===filter);
 const pending=selected.filter(a=>!Number.isFinite(monthDayNumber(a.due)));
 const invalid=selected.filter(a=>{const due=monthDayNumber(a.due),s=plannedStart(a,anchor).date;return Number.isFinite(due)&&Number.isFinite(s)&&s>due;});
 const outside=selected.filter(a=>{const due=monthDayNumber(a.due);return Number.isFinite(due)&&(due<rangeStart||due>=rangeEnd)&&!invalid.some(i=>i.id===a.id);});
 const dated=selected.filter(a=>Number.isFinite(monthDayNumber(a.due))&&!invalid.some(i=>i.id===a.id)&&!outside.some(i=>i.id===a.id));
 const complete=selected.filter(a=>a.steps.length>0&&a.steps.every(s=>s.done)).length;
 const nearby=dated.filter(a=>monthDayNumber(a.due)>=today&&monthDayNumber(a.due)<=today+14*DAY&&courseworkProgress(a)<100).length;
 const groups=courses.map(course=>({course,items:dated.filter(a=>a.courseId===course.id).sort((a,b)=>a.due.localeCompare(b.due))})).filter(g=>g.items.length);
 const orphaned=dated.filter(a=>!courses.some(c=>c.id===a.courseId));if(orphaned.length)groups.push({course:{id:'unclassified',name:'未分类课程',code:'未分类',color:'#748295',subject:''},items:orphaned});
 const todayVisible=today>=rangeStart&&today<rangeEnd;
 const monthLines=<>{months.slice(1).map(m=><i className="month-grid-line" key={m.date} style={{left:`${position(m.date)}%`}}/>)}{todayVisible&&<i className="month-today-line" data-testid="today-timeline-line" style={{left:`${position(today)}%`}}/>}</>;
 function locateToday(){
  const chart=chartRef.current;if(!chart)return;
  const line=chart.querySelector<HTMLElement>('.month-today-line'),label=chart.querySelector<HTMLElement>('.month-label-cell');if(!line||!label)return;
  const labelWidth=label.getBoundingClientRect().width,visibleDateWidth=chart.clientWidth-labelWidth;
  const target=chart.scrollLeft+line.getBoundingClientRect().left-chart.getBoundingClientRect().left-labelWidth-visibleDateWidth/2;
  chart.scrollTo({left:Math.max(0,target),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 }
 function pendingItem(a:Assignment,label?:string){
  const course=courses.find(c=>c.id===a.courseId),pct=courseworkProgress(a),done=a.steps.filter(s=>s.done).length;
  return <button type="button" className="month-pending-item" data-assignment-id={a.id} key={a.id} onClick={()=>onOpen(a)} style={{'--month-color':course?.color || '#6d7f99'} as CSSProperties}><span className="month-pending-title"><i/>{course?.code || '未分类'}<strong>{a.title}</strong><span>{pct}%</span></span><span className="month-pending-track"><i style={{width:`${pct}%`}}/></span><span className="month-pending-meta">{label || '截止日期待确认'} · {done}/{a.steps.length} 步<span>查看步骤 ↗</span></span></button>;
 }
 return <section className="semester-overview month-overview">
  <div className="semester-page-header"><div><h1>学期总览</h1><p>{semester.name}<span>·</span>{currentWeek?`第 ${currentWeek} 周`:(today<start?'尚未开始':'学期已结束')}<span>·</span>{courses.length} 门课程</p></div><div className="semester-actions"><button type="button" className="button semester-settings" onClick={onSettings}>学期设置</button><button type="button" className="button button-primary" onClick={onAdd}><span aria-hidden="true">＋</span>添加作业</button></div></div>
  <div className="month-time-panel"><div className="month-time-heading"><span>学期时间已过</span><span>{semester.start} — {semester.end}</span></div><div className="month-time-number" aria-hidden="true"><strong data-testid="semester-elapsed" data-clock-ms={clock}>{elapsed.toFixed(8)}</strong><span>%</span></div><div className="month-time-track" role="progressbar" aria-label="学期时间已过" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed)}><i style={{width:`${elapsed}%`}}/></div><div className="month-time-footer"><span>按实际时间更新</span><span>作业完成情况见下方</span></div></div>
  <div className="month-project-summary"><span><strong>{selected.length}</strong> 份作业与检查点</span><span><strong>{complete}</strong> 已完成</span><span><strong>{nearby}</strong> 两周内截止</span></div>
  <div className="month-toolbar"><div className="month-filters" aria-label="按课程筛选作业"><button type="button" className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>全部课程</button>{courses.map(c=><button type="button" key={c.id} className={filter===c.id?'active':''} onClick={()=>setFilter(c.id)}><i style={{background:c.color}}/>{c.code}</button>)}</div><span>横轴为日历时间 · 条内为完成比例</span></div>
  {dated.length>0&&<div className="month-chart" ref={chartRef} role="region" aria-label="按课程分组的学期作业时间图" tabIndex={0} data-testid="month-chart" data-range-start={toDate(rangeStart)} data-range-end={toDate(rangeEnd-DAY)}><div className="month-chart-grid">
   <div className="month-chart-header"><div className="month-label-cell month-header-label"><span>课程 / 作业</span><small>{startDate.getUTCFullYear()} — {new Date(rangeEnd-DAY).getUTCFullYear()}</small></div><div className="month-calendar-header">{months.map(m=><span key={m.date} style={{left:`${position(m.date)}%`,width:`${(m.next-m.date)/span*100}%`}} data-month={toDate(m.date).slice(0,7)}>{m.label}</span>)}{todayVisible&&<span className="month-today-label" style={{left:`${position(today)}%`}}>今天</span>}</div></div>
   {groups.map(({course,items})=><div className="month-course-group" key={course.id} data-course-id={course.id}><div className="month-course-heading"><div className="month-label-cell"><i style={{background:course.color}}/><strong>{course.code}</strong><span>{items.length} 项</span></div><div className="month-course-line">{monthLines}</div></div>{items.map(a=>{
    const pct=courseworkProgress(a),done=a.steps.filter(s=>s.done).length,due=monthDayNumber(a.due),plan=plannedStart(a,anchor),hasStart=Number.isFinite(plan.date),barStart=hasStart?Math.max(rangeStart,plan.date):due;
    const left=position(barStart),width=hasStart?Math.max(.55,position(due+DAY)-left):0;const overdue=due<today&&pct<100;
    return <div className="month-project-row" key={a.id} data-assignment-id={a.id} data-progress={pct} data-due={a.due} data-start={hasStart?toDate(plan.date):''} style={{'--month-color':course.color} as CSSProperties}>
     <button type="button" className="month-label-cell month-project-label" onClick={()=>onOpen(a)} aria-label={`${a.title}，${pct}%完成，${done}/${a.steps.length}步`}><span className="month-project-name">{a.title}</span><span className="month-project-meta"><span>{shortDate(a.due)} 截止{!a.deadlineVerified?' · 待核对':''}</span><strong>{pct}%</strong></span><span className="month-project-steps">{done}/{a.steps.length} 步{overdue?' · 已逾期':''}</span></button>
     <div className="month-project-canvas">{monthLines}{hasStart?<button type="button" className={`month-project-bar ${pct===100?'complete':''}`} style={{left:`${left}%`,width:`${width}%`}} onClick={()=>onOpen(a)} aria-label={`${a.title}，${plan.kind} ${toDate(plan.date)} 至 ${a.due}，${pct}%完成`} title={`${plan.kind} ${toDate(plan.date)} → ${a.due}；已完成 ${done}/${a.steps.length} 步`}><span className="month-project-fill" style={{width:`${pct}%`}}/><span className="month-bar-content"><span>{plan.date<rangeStart?'← ':''}{a.category==='review'?'复习计划':'个人计划'}</span><strong>{pct}%</strong></span><span className="month-deadline-marker"/></button>:<button type="button" className="month-deadline-only" style={{left:`${position(due)}%`}} onClick={()=>onOpen(a)} aria-label={`${a.title}，${a.due}截止；开始日待确认；${pct}%完成`}><i/><span>截止 · {pct}%</span></button>}</div>
    </div>;
   })}</div>)}
  </div></div>}
  {dated.length>0&&<div className="month-chart-navigation"><span>左右滑动查看月份</span>{todayVisible&&<button type="button" data-testid="month-locate-today" onClick={locateToday}>定位今天</button>}</div>}
  <div className="month-chart-caption"><span><i className="month-caption-plan"/>浅色：个人计划区间 <i className="month-caption-progress"/>实色：已完成步骤比例</span><span>开始日依个人计划；官方日期见作业详情</span></div>
  {pending.length>0&&<section className="month-pending"><div className="month-subheading"><h2>截止时间待确认 <span>{pending.length}</span></h2><p>确认日期后显示在时间图中。</p></div>{pending.map(a=>pendingItem(a))}</section>}
  {invalid.length>0&&<section className="month-pending"><div className="month-subheading"><h2>日期待调整 <span>{invalid.length}</span></h2><p>计划起点晚于截止日，请核对计划。</p></div>{invalid.map(a=>pendingItem(a,`${shortDate(toDate(plannedStart(a,anchor).date))} 计划开始 · ${shortDate(a.due)} 截止`))}</section>}
  {outside.length>0&&<section className="month-pending"><div className="month-subheading"><h2>图示范围之外 <span>{outside.length}</span></h2><p>{shortDate(toDate(rangeStart))} — {shortDate(toDate(rangeEnd-DAY))} 以外的作业仍会保留。</p></div>{outside.map(a=>pendingItem(a,`${shortDate(a.due)} 截止`))}</section>}
  {!selected.length&&<div className="month-empty"><p>这门课程还没有作业。</p><button type="button" className="button" onClick={onAdd}>添加作业</button></div>}
 </section>;
}
