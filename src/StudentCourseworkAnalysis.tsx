import {useEffect,useRef,useState} from 'react';
import type {PersonalApi} from './campusStore';
import type {StudyDocument} from './studyTypes';
import {studyRequest,errorMessage} from './studyClient';
import {useI18n} from './i18n';
import {Alert} from './CampusUI';

type Field={value:string;page:number;quote:string};
export default function StudentCourseworkAnalysis({document,api,onConnect}:{document:StudyDocument;api:PersonalApi|null;onConnect:()=>void}) {
 const {language}=useI18n();
 const tr=(zh:string,en:string)=>language==='en'?en:zh;
 const [fields,setFields]=useState<Record<string,Field>|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function analyse() {
  if(!api){onConnect();return;}
  const c=new AbortController();controller.current=c;setBusy(true);setError('');
  try {
   const result=await studyRequest<{fields:Record<string,Field>}>('coursework',{document,credentialScope:'student',personalApi:api,allowExternal:true,language},c.signal);
   if(!c.signal.aborted)setFields(result.fields);
  } catch(e){if(!c.signal.aborted)setError(errorMessage(e));}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 return <section className="cp-student-coursework-analysis">
  <h3>{tr('理解作业要求','Understand the assignment')}</h3>
  <p className="cp-fineprint">{tr('使用你自己的 ELM API 解析原文件；不会修改教师发布的介绍和日期。','Analyse the original brief using your own ELM API. Published descriptions and dates remain unchanged.')}</p>
  <button className="cp-button" disabled={busy} onClick={()=>void analyse()}>{busy?tr('正在解析…','Analysing…'):tr('解析评分标准与提交要求','Analyse marking criteria & deliverables')}</button>
  {error&&<Alert>{error}</Alert>}
  {fields&&(['submissionType','deliverables','rubric'] as const).map(name=><article key={name}>
    <h4>{({submissionType:tr('个人或小组作业','Individual or group'),deliverables:tr('提交要求','Deliverables'),rubric:tr('评分标准','Marking criteria')})[name]}</h4>
    <p style={{whiteSpace:'pre-wrap'}}>{fields[name]?.value||tr('原文件未明确提供，请向教师确认。','Not specified in the brief. Check with your teacher.')}</p>
    {fields[name]?.quote&&<blockquote>p.{fields[name].page}: {fields[name].quote}</blockquote>}
  </article>)}
 </section>;
}
