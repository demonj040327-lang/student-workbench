import {useSyncExternalStore} from 'react';
import {readCampusMaterials,writeCampusMaterial,loadCampusData,type CampusMaterial,type PersonalApi} from './campusStore';
import {sourcePayload,studyRequest,uid,errorMessage} from './studyClient';
import type {StudyDocument} from './studyTypes';
type Action='guide'|'questions';
export type GenerationJob={id:string;materialId:string;courseId:string;title:string;demo:boolean;action:Action;state:'queued'|'parsing'|'generating'|'done'|'failed';error?:string;result?:CampusMaterial};
type Input={demo:boolean;courseId:string;title:string;week:number;action:Action;language:string;api:PersonalApi|null;file?:File;material?:CampusMaterial};
let jobs:GenerationJob[]=[];const listeners=new Set<()=>void>(),runs=new Map<string,()=>Promise<void>>();let working=false;
const emit=()=>listeners.forEach(fn=>fn());
const patch=(id:string,p:Partial<GenerationJob>)=>{jobs=jobs.map(j=>j.id===id?{...j,...p}:j);emit();};
export function useGenerationJobs(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>jobs);}
export function isJobActive(job:GenerationJob){return ['queued','parsing','generating'].includes(job.state);}
function updated(demo:boolean){window.dispatchEvent(new Event('workbench-materials-updated'));if(typeof BroadcastChannel!=='undefined'){const c=new BroadcastChannel(`workbench-campus-${demo?'demo':'personal'}`);c.postMessage('updated');c.close();}}
async function save(input:Input,m:CampusMaterial){if(!loadCampusData(input.demo).courses.some(c=>c.id===input.courseId))throw Error('课程已移除，生成结果未写入。');await writeCampusMaterial(input.demo,m);updated(input.demo);}
async function pump(){if(working)return;working=true;try{while(true){const j=jobs.find(j=>j.state==='queued');if(!j)break;try{await runs.get(j.id)!();}catch(e){patch(j.id,{state:'failed',error:errorMessage(e)});}}}finally{working=false;}}
export function enqueueGeneration(input:Input){
 const materialId=input.material?.id||uid();if(jobs.some(j=>j.materialId===materialId&&isJobActive(j)))return;
 const id=uid();let parsed:CampusMaterial|undefined;
 runs.set(id,async()=>{
  let material=parsed||input.material;
  if(!material){
   patch(id,{state:'parsing',error:undefined});
   const controller=new AbortController();
   const payload=await sourcePayload({id:materialId,courseId:input.courseId,name:input.file!.name,type:input.file!.type,blob:input.file!},controller.signal);
   const document=await studyRequest<StudyDocument>('parse',{...payload,mode:'local'},controller.signal);document.units=[];
   material={id:materialId,courseId:input.courseId,title:input.title,week:input.week,name:input.file!.name,status:'draft',blob:input.file,document,updatedAt:new Date().toISOString()};
   await save(input,material);parsed=material;
  }
  const current=(await readCampusMaterials(input.demo)).find(m=>m.id===materialId)||material;
  patch(id,{state:'generating',error:undefined});
  const document=await studyRequest<StudyDocument>('generate',{document:current.document,generationTarget:input.action,language:input.language,credentialScope:'teacher',...(input.api?{personalApi:input.api}:{}),allowExternal:true});
  const latest=(await readCampusMaterials(input.demo)).find(m=>m.id===materialId)||current;
  if(input.action==='questions'&&!document.units.some(u=>u.questions.length))throw Error('本次没有生成通过校验的题目，原有讲解与题目已保留，请重试。');
  if(input.action==='guide')document.units=document.units.map(u=>({...u,questions:latest.document.units.flatMap(v=>v.questions).filter(q=>u.pages.includes(q.sourcePages[0]))}));
  else if(latest.document.units.length){const qs=document.units.flatMap(u=>u.questions);document.units=latest.document.units.map(u=>({...u,questions:qs.filter(q=>u.pages.includes(q.sourcePages[0]))}));}
  const next={...latest,document,status:'draft' as const,example:false,updatedAt:new Date().toISOString()};
  await save(input,next);patch(id,{state:'done',result:next});
  // Credentials and original File closures are retained only while retry is needed.
  runs.delete(id);
 });
 jobs=[...jobs,{id,materialId,courseId:input.courseId,title:input.title,demo:input.demo,action:input.action,state:'queued'}];emit();void pump();return id;
}
export function retryGeneration(id:string){if(!runs.has(id))return;patch(id,{state:'queued',error:undefined});void pump();}
export function dismissGeneration(id:string){const job=jobs.find(j=>j.id===id);if(job&&isJobActive(job))return;runs.delete(id);jobs=jobs.filter(j=>j.id!==id);emit();}
