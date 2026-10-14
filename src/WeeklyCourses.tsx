import type {Assignment,Course} from './data';
import {mondayOf} from './data';

type Props={courses:Course[];assignments:Assignment[];anchor:string;onCourse:(id:string)=>void;onStep:(aid:string,sid:string,done:boolean)=>void};
export default function WeeklyCourses({courses,assignments,anchor,onCourse,onStep}:Props){
 const monday=mondayOf(new Date());const first=Math.round((new Date(`${monday}T12:00:00`).getTime()-new Date(`${anchor}T12:00:00`).getTime())/86400000);
 return <section className="weekly-courses"><div className="weekly-courses-heading"><h2>这周的课程任务</h2><span>打开课程，继续对应资料的学习</span></div><div className="weekly-courses-grid">{courses.map(course=>{
  const tasks=assignments.filter(a=>a.courseId===course.id).flatMap(a=>a.steps.filter(s=>s.day>=first&&s.day<first+7).map(s=>({a,s}))).sort((a,b)=>Number(a.s.done)-Number(b.s.done)||a.s.day-b.s.day);
  const done=tasks.filter(t=>t.s.done).length;
  return <article key={course.id} className="weekly-course" style={{'--weekly-color':course.color} as React.CSSProperties}><button className="weekly-course-open" onClick={()=>onCourse(course.id)}><span className="weekly-course-code"><i/>{course.code}</span><strong>{course.name}</strong><span>{done}/{tasks.length} 步完成 <b>打开课程 ↗</b></span></button><div className="weekly-course-tasks">{tasks.slice(0,3).map(({a,s})=><div key={s.id} className={s.done?'done':''}><button className="weekly-step-check" aria-label={`${s.done?'恢复':'完成'}：${s.title}`} aria-pressed={s.done} onClick={()=>onStep(a.id,s.id,!s.done)}>{s.done?'✓':''}</button><span><strong>{s.title}</strong><small>{a.planOnly?'课后复习':a.title} · {s.minutes} 分钟</small></span></div>)}{tasks.length>3&&<button className="weekly-course-more" onClick={()=>onCourse(course.id)}>查看其余 {tasks.length-3} 个步骤 →</button>}{!tasks.length&&<p>本周暂无计划步骤，可以继续学习课件。</p>}</div></article>;
 })}</div></section>;
}
