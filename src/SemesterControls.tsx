import {useState,type FormEvent} from 'react';
import {isoDate,shiftDate,type Assignment,type Course,type Semester} from './data';

export function SemesterSettings({semester,onSave}:{semester:Semester;onSave:(value:Semester)=>void}) {
 const [error,setError]=useState('');
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const start=String(f.get('start'));const end=String(f.get('end'));const days=(new Date(`${end}T12:00:00`).getTime()-new Date(`${start}T12:00:00`).getTime())/86400000;
  if(!Number.isFinite(days)||days<1||days>370){setError('结束日期须晚于开始日期，范围不超过一年。');return;}
  onSave({name:String(f.get('name')).trim(),start,end});
 }
 return <form className="form-stack" onSubmit={submit}><label>学期名称<input name="name" defaultValue={semester.name} maxLength={60} required/></label><div className="form-grid"><label>开始日期<input name="start" type="date" defaultValue={semester.start} required/></label><label>结束日期<input name="end" type="date" defaultValue={semester.end} required/></label></div><p className="small muted">周次从开始日期按每 7 天排列。默认采用爱丁堡大学第一学期日期，包含复习与考试时段。</p><a className="source-original" href="https://semester-dates.ed.ac.uk/202627" target="_blank" rel="noreferrer">核对学校学期日历</a>{error&&<p className="error-text" role="alert">{error}</p>}<button className="button button-primary">保存学期设置</button></form>;
}

export function AssignmentDetails({assignment,course,anchor,onUpdate,onStep}:{assignment:Assignment;course:Course;anchor:string;onUpdate:(patch:Partial<Assignment>)=>void;onStep:(stepId:string,done:boolean)=>void}){
 const [due,setDue]=useState(assignment.due);const [error,setError]=useState('');
 const done=assignment.steps.filter(s=>s.done).length;const percentage=assignment.steps.length?Math.round(done/assignment.steps.length*100):0;
 function saveDate(e:FormEvent){e.preventDefault();if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due)){setError('请选择有效日期。');return;}onUpdate({due,deadlineVerified:due===assignment.originalDue&&Boolean(assignment.originalDue)});setError('');}
 function appendStep(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const title=String(new FormData(form).get('step')).trim();if(!title)return;const sid=typeof crypto.randomUUID==='function'?crypto.randomUUID():`step-${Date.now()}-${Math.random()}`;
  const today=isoDate(new Date());const day=Math.round((new Date(`${today}T12:00:00`).getTime()-new Date(`${anchor}T12:00:00`).getTime())/86400000);
  onUpdate({steps:[...assignment.steps,{id:sid,title,minutes:20,day,done:false,blocked:false,evidence:'由自己确认已完成的产出',source:'用户添加的步骤'}]});form.reset();
 }
 return <div className="project-detail"><div className="project-detail-meta"><span className="course-tag" style={{'--course-color':course.color} as React.CSSProperties}>{course.code}</span>{assignment.gradeWeight!==undefined&&<span>课程占比 {assignment.gradeWeight}%</span>}<span>{assignment.deadlineVerified?'日期已核对原文':assignment.due?'用户确认的日期':'时间待确认'}</span></div><h3>{assignment.title}</h3><div className="project-detail-progress"><div><strong>{percentage}%</strong><span>{done} / {assignment.steps.length} 步已完成</span></div><div className="project-detail-track" role="progressbar" aria-label={`${assignment.title}完成进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{width:`${percentage}%`}}/></div></div><form className="project-date-form" onSubmit={saveDate}><label>截止日期<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><button className="button button-small">保存日期</button></form>{error&&<p className="error-text">{error}</p>}
 <div className="project-checklist"><h4>项目步骤</h4>{assignment.steps.map(s=><label key={s.id} className={s.done?'completed':''}><input type="checkbox" checked={s.done} onChange={e=>onStep(s.id,e.target.checked)}/><span>{s.title}{s.evidence&&<em className="step-expected-output">产出：{s.evidence}</em>}</span><small>{s.done?'已完成':s.blocked?'卡住':'待完成'}</small></label>)}</div><form className="project-step-form" onSubmit={appendStep}><input name="step" required maxLength={160} placeholder="添加一个步骤" aria-label="新项目步骤"/><button className="button button-small">添加</button></form>
 <details className="source-box"><summary>作业要求与日期来源</summary><p>{assignment.deadlineSource || '这份作业由你手动创建，日期需要自行核对。'}</p>{assignment.originalDue&&<p>原文日期：{assignment.originalDue}{assignment.deadlineLabel?` · ${assignment.deadlineLabel}`:''}</p>}<p>{assignment.brief}</p>{assignment.briefUrl&&<a className="source-original" href={`${assignment.briefUrl}#page=${assignment.briefPage || 1}`} target="_blank" rel="noreferrer">打开原始作业说明</a>}</details><p className="small muted">百分比按已勾选步骤数计算。未更新的记录为 0%，不代表你实际还没开始。</p>
 </div>;
}
