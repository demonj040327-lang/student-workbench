import {useState} from 'react';
import type {FormEvent} from 'react';
import type {CampusCourse,CampusMaterial,CampusRole} from './campusStore';
import {changeCommunity,materialVersion,useCommunity} from './communityStore';
import {useI18n} from './i18n';
import {Alert,Empty} from './CampusUI';

export function StudentFeedback({courses,materials,demo}:{courses:CampusCourse[];materials:CampusMaterial[];demo:boolean}) {
 const {t,language}=useI18n();const tr=(zh:string,en:string)=>language==='en'?en:zh;
 const {activity,error}=useCommunity(demo);const [course,setCourse]=useState('');
 const visible=materials.filter(m=>m.status==='published'&&courses.some(c=>c.id===m.courseId)&&(!course||m.courseId===course));
 return <>
  <header className="cp-page-heading"><div><span className="cp-eyebrow">STUDENT ENGAGEMENT</span><h1>{t('学生反馈')}</h1><p>{tr('了解已发布课件的查看人数和选择题完成情况。','See views and practice completion for published materials.')}</p></div></header>
  <p className="cp-info">{tr('本机演示记录：按浏览器身份去重，不代表真实班级人数；切换到其他设备不会共享数据。','Local demo records: counts represent browser identities, not verified student accounts. Data is not shared across devices.')}</p>
  <label className="cp-community-filter">{t('选择课程')}<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">{tr('全部课程','All courses')}</option>{courses.map(c=><option value={c.id} key={c.id}>{c.code} · {t(c.name)}</option>)}</select></label>
  {error&&<Alert>{tr('无法读取学习记录，请检查浏览器存储。','Unable to read activity. Check browser storage.')}</Alert>}
  <div className="cp-teacher-material-list">{visible.map(m=>{
    const records=activity.filter(a=>a.materialId===m.id&&a.version===materialVersion(m));const ids=m.document.units.flatMap(u=>u.questions).map(q=>q.id);
    const finished=ids.length?records.filter(a=>ids.every(id=>a.answered.includes(id))).length:0;
    const attempted=records.filter(a=>ids.some(id=>a.answered.includes(id))).length;
    return <article className="cp-card cp-engagement-card" key={m.id}><div><span className="cp-tag">{courses.find(c=>c.id===m.courseId)?.code}</span><h2>{t(m.title)}</h2><small>{tr('第','Week')} {m.week} {tr('周','')} · {ids.length} {tr('道选择题','questions')}</small></div>
      <dl><div><dt>{tr('查看课件','Viewed materials')}</dt><dd>{records.length}</dd></div><div><dt>{tr('已开始答题','Started practice')}</dt><dd>{attempted}</dd></div><div><dt>{tr('完成全部选择题','Completed all questions')}</dt><dd>{ids.length?finished:'—'}</dd></div><div><dt>{tr('查看者中的练习完成率','Completion among viewers')}</dt><dd>{ids.length&&records.length?Math.round(finished/records.length*100)+'%':'—'}</dd></div></dl>
      <small>{tr('打开课件记为查看；提交答案记为答题，不表示答对。更新学习内容后重新统计。','Opening a material counts as a view. Checked answers count as participation, regardless of correctness. Content updates start a new tally.')}</small>
    </article>;
  })}</div>{!visible.length&&<Empty title={tr('暂无已发布课件','No published materials yet')}/>}</>;
}

export function CourseDiscussion({courses,role,demo,initialFilter='all'}:{courses:CampusCourse[];role:CampusRole;demo:boolean;initialFilter?:string}) {
 const {t,language,locale}=useI18n();const tr=(zh:string,en:string)=>language==='en'?en:zh;
 const {discussions,error:loadError}=useCommunity(demo);
 const [course,setCourse]=useState(''),[questionCourse,setQuestionCourse]=useState(courses[0]?.id||'');
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[error,setError]=useState(''),[filter,setFilter]=useState(initialFilter);
 const [reply,setReply]=useState<Record<string,string>>({});
 const effectiveQuestionCourse=courses.some(c=>c.id===questionCourse)?questionCourse:(courses[0]?.id||'');
 const items=discussions.filter(d=>courses.some(c=>c.id===d.courseId)&&(!course||course===d.courseId)&&(filter==='all'||(filter==='open'?!d.replies.length:!!d.replies.length))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const date=(value:string)=>new Date(value).toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 function post(e:FormEvent){e.preventDefault();if(!title.trim()||!body.trim()||!courses.some(c=>c.id===effectiveQuestionCourse))return;try{changeCommunity(demo,d=>({...d,discussions:[...d.discussions,{id:crypto.randomUUID(),courseId:effectiveQuestionCourse,title:title.trim(),body:body.trim(),createdAt:new Date().toISOString(),replies:[]}]}));setTitle('');setBody('');setCourse(effectiveQuestionCourse);setFilter('all');setError('');}catch{setError(tr('问题未能保存，请重试。','Could not save the question. Try again.'));}}
 function respond(id:string){if(!reply[id]?.trim())return;try{changeCommunity(demo,d=>({...d,discussions:d.discussions.map(q=>q.id===id?{...q,replies:[...q.replies,{id:crypto.randomUUID(),body:reply[id].trim(),createdAt:new Date().toISOString()}]}:q)}));setReply(r=>({...r,[id]:''}));setError('');}catch{setError(tr('回复未能保存，请重试。','Could not save the reply. Try again.'));}}
 return <>
  <header className="cp-page-heading"><div><span className="cp-eyebrow">COURSE DISCUSSIONS</span><h1>{t('课程讨论')}</h1><p>{role==='teacher'?tr('按课程查看学生的问题，并给出解答。','Review and answer student questions by course.'):tr('把不懂的地方留给老师，按课程交流。','Ask your teacher and discuss questions by course.')}</p></div></header>
  <p className="cp-fineprint">{tr('本机演示讨论区：同一浏览器的学生与教师视角共享记录，刷新后保留；尚未接入跨设备账户和消息服务。','Local discussion demo: student and teacher views in this browser share saved records. Cross-device accounts and messaging are not connected yet.')}</p>
  {role==='student'&&<form className="cp-card cp-form cp-discussion-compose" onSubmit={post}><h2>{tr('向老师提问','Ask your teacher')}</h2><label>{t('归属课程')}<select required value={effectiveQuestionCourse} onChange={e=>setQuestionCourse(e.target.value)}>{courses.map(c=><option value={c.id} key={c.id}>{c.code} · {t(c.name)}</option>)}</select></label><label>{tr('问题标题','Question title')}<input required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>{tr('问题描述','Question details')}<textarea required rows={3} maxLength={5000} value={body} onChange={e=>setBody(e.target.value)} placeholder={tr('可以注明课件名称、页码和你卡住的地方。','Include the material title, page and what you find confusing.')}/></label><button className="cp-button primary" disabled={!courses.length||!title.trim()||!body.trim()}>{tr('发布问题','Post question')}</button></form>}
  {(error||loadError)&&<Alert>{error||tr('无法读取讨论记录。','Unable to read discussions.')}</Alert>}
  <div className="cp-discussion-controls"><label className="cp-community-filter">{t('选择课程')}<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">{tr('全部课程','All courses')}</option>{courses.map(c=><option value={c.id} key={c.id}>{c.code} · {t(c.name)}</option>)}</select></label><nav className="cp-tabs" aria-label={tr('问题状态','Question status')}>{[['all',tr('全部','All')],['open',tr('待回复','Unanswered')],['answered',tr('已回复','Answered')]].map(([value,label])=><button key={value} aria-pressed={filter===value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</nav></div>
  <div className="cp-discussion-list">{items.map(q=><article className="cp-card cp-discussion-thread" key={q.id}><header><span className="cp-tag">{courses.find(c=>c.id===q.courseId)?.code}</span><span className="cp-status">{q.replies.length?tr('已回复','Answered'):tr('待回复','Unanswered')}</span><time>{date(q.createdAt)}</time></header><h2>{q.title}</h2><p>{q.body}</p>{q.replies.map(r=><section className="cp-teacher-reply" key={r.id}><strong>{tr('教师回复','Teacher reply')}</strong><time>{date(r.createdAt)}</time><p>{r.body}</p></section>)}{role==='teacher'&&<form className="cp-form" onSubmit={e=>{e.preventDefault();respond(q.id);}}><label>{tr('回复这个问题','Reply to this question')}<textarea required maxLength={5000} rows={3} value={reply[q.id]||''} onChange={e=>setReply(r=>({...r,[q.id]:e.target.value}))}/></label><button className="cp-button primary" disabled={!reply[q.id]?.trim()}>{tr('发送回复','Send reply')}</button></form>}</article>)}</div>
  {!items.length&&<Empty title={tr('暂无符合条件的问题','No matching questions')}/>}</>;
}
