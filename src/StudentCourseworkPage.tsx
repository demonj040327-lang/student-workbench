import {useEffect,useRef,useState} from 'react';
import type {Assignment} from './data';
import type {CampusMaterial,PersonalApi,StudentProgress} from './campusStore';
import CampusLearning from './CampusLearning';
import StudentCourseworkAnalysis from './StudentCourseworkAnalysis';
import {useI18n} from './i18n';
import {studyRequest,errorMessage} from './studyClient';
import {Alert} from './CampusUI';
type PlanStep={title:string;output:string;sourceQuote:string;sourcePage:number;minutes:number};
export default function StudentCourseworkPage({assignment,api,progress,onProgress,onConnect,onBack,onPlan,onStep}:{assignment:Assignment;api:PersonalApi|null;progress:StudentProgress;onProgress:(p:StudentProgress|((p:StudentProgress)=>StudentProgress))=>void;onConnect:()=>void;onBack:()=>void;onPlan:(steps:PlanStep[])=>void;onStep:(id:string,done:boolean)=>void}) {
 const {language,t}=useI18n();const tr=(zh:string,en:string)=>language==='en'?en:zh;
 const [tab,setTab]=useState('brief'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const document=assignment.coursework!.document!;
 async function generate(){if(!api){onConnect();return;}const controller=new AbortController();request.current=controller;setBusy(true);setError('');try{const result=await studyRequest<{steps:PlanStep[]}>('plan',{document,courseId:assignment.courseId,title:assignment.title,credentialScope:'student',personalApi:api,allowExternal:true,language},controller.signal);if(!controller.signal.aborted)onPlan(result.steps);}catch(e){if(!controller.signal.aborted)setError(errorMessage(e));}finally{if(!controller.signal.aborted)setBusy(false);}}
 const material:CampusMaterial={id:assignment.id,courseId:assignment.courseId,title:assignment.title,week:1,name:document.name,status:'published',document:{...document,units:[]},updatedAt:document.createdAt};
 return <section><button className="cp-button" onClick={onBack}>← {t('返回课程资料')}</button><h1>{assignment.title}</h1><p className="cp-muted">{tr('截止日期','Due')} · {assignment.coursework?.dueAt||assignment.due||tr('待确认','To confirm')}</p><p>{assignment.brief}</p><label className="cp-check-label"><input type="checkbox" checked={!!progress.submitted?.[assignment.id]} onChange={e=>{const checked=e.target.checked;onProgress(p=>({...p,submitted:{...p.submitted,[assignment.id]:checked?new Date().toISOString():''}}));}}/>{tr('我已在学校系统提交（仅手动记录）','Submitted in the university system (manual record only)')}</label><div className="cp-tabs"><button className={tab==='brief'?'active':''} onClick={()=>setTab('brief')}>{tr('作业说明与问答','Brief & Q&A')}</button><button className={tab==='steps'?'active':''} onClick={()=>setTab('steps')}>{tr('分步指导','Step-by-step plan')}</button><button className={tab==='criteria'?'active':''} onClick={()=>setTab('criteria')}>{tr('理解提交要求','Understand requirements')}</button></div>
 <div hidden={tab!=='brief'}><CampusLearning workspace sourceOnly material={material} progress={progress} onProgress={onProgress} api={api} onConnect={onConnect} onBack={onBack}/></div>
 {tab==='steps'&&<section className="cp-card coursework-plan"><h2>{tr('我的作业步骤','My assignment plan')}</h2><p>{tr('根据原始作业说明生成 3–5 个过程步骤，不代写作业答案。重新生成会替换个人步骤。','Generate 3–5 process steps from the brief, without writing assessed answers. Regeneration replaces your personal steps.')}</p><button className="cp-button" disabled={busy} onClick={()=>void generate()}>{busy?tr('正在生成…','Generating…'):tr(assignment.steps.length?'重新生成个人步骤':'生成个人步骤',assignment.steps.length?'Regenerate my plan':'Generate my plan')}</button>{error&&<Alert>{error}</Alert>}{assignment.steps.map(s=><article key={s.id}><label><input type="checkbox" checked={s.done} onChange={e=>onStep(s.id,e.target.checked)}/> {s.title}</label><p>{s.evidence}</p><small>{s.minutes} min · {s.source}</small></article>)}</section>}
 {tab==='criteria'&&<StudentCourseworkAnalysis document={document} api={api} onConnect={onConnect}/>}</section>;
}
