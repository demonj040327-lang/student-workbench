import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
// Curate only the presentation view. Original files and cached AI results stay intact.
export function selectDemoItems(manifest,selection){
 if(selection.mode==='all')return {items:manifest.items,excludedIds:[]};
 if(selection.mode!=='curated'||!Array.isArray(selection.items))throw Error('Invalid demo selection');
 const selected=selection.items.map(rule=>{
  const item=manifest.items.find(i=>i.course===rule.course&&i.name===rule.name);
  return item?{...item,presentation:rule}:null;
 }).filter(Boolean);
 const ids=new Set(selected.map(i=>i.id));
 return {items:selected,excludedIds:manifest.items.filter(i=>!ids.has(i.id)).map(i=>i.id)};
}
export async function serveLocalDemoLibrary(req,res,projectRoot) {
 const path=new URL(req.url,'http://localhost').pathname;
 if(path!=='/api/study/local-library'&&!path.startsWith('/api/study/local-library/file/'))return false;
 const root=join(projectRoot,'data/local-demo-library');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 let manifest;try{manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));}catch{res.statusCode=404;res.end(JSON.stringify({error:'本机资料库尚未生成。'}));return true;}
 let selection;try{selection=JSON.parse(await readFile(join(projectRoot,'config/demo-library.json'),'utf8'));}catch{res.statusCode=500;res.end(JSON.stringify({error:'演示资料筛选配置无法读取，请检查 config/demo-library.json。'}));return true;}
 const {items,excludedIds}=selectDemoItems(manifest,selection);
 if(path.startsWith('/api/study/local-library/file/')) {
  const id=path.split('/').pop(),item=items.find(i=>i.id===id);
  if(!item||basename(item.file)!==item.file){res.statusCode=404;res.end();return true;}
  const file=join(root,'files',item.file),info=await stat(file);
  res.setHeader('Content-Type',item.extension==='.pdf'?'application/pdf':item.extension==='.pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Length',info.size);createReadStream(file).on('error',()=>res.destroy()).pipe(res);return true;
 }
 const stamp=manifest.revision,materials=[],assignments=[];
 for(const i of items.filter(i=>i.parse?.ok)){
  const document={...i.document,originalUrl:'/api/study/local-library/file/'+i.id};
  const warning=i.ai?.ok?'本机导入演示；AI 内容尚未人工核对。':'本机导入；尚未生成 AI 讲解，请先阅读原件。';
  document.warnings=[...document.warnings,warning];
  const version=createHash('sha256').update(JSON.stringify([i.sha256,i.ai,i.fields,i.document.units,i.presentation])).digest('hex').slice(0,20);
  if(i.kind==='coursework'){
   const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(v)?v:'';
   const release=iso(i.fields?.release?.value),due=iso(i.fields?.deadline?.value);
   assignments.push({id:i.id,courseId:i.courseId,title:i.fields?.title?.value||i.name,brief:i.fields?.introduction?.value||'请阅读原作业说明，AI 介绍尚待生成。',startsOn:release.slice(0,10),due:due.slice(0,10),steps:[],category:'coursework',deadlineVerified:false,coursework:{status:'draft',releaseAt:release,dueAt:due,timezone:'UTC',submissionType:'',deliverables:'',rubric:'',document,revisions:[]},libraryVersion:version});
  }else materials.push({id:i.id,courseId:i.courseId,title:i.presentation?.title||i.name.replace(/\.[^.]+$/,''),weekTopic:i.presentation?.topic,week:i.presentation?.week??(/week[- ]?0?\d|W0?\d/i.test(i.name)?i.week:1),weekUnconfirmed:i.presentation?.week?false:!/week[- ]?0?\d|W0?\d/i.test(i.name),name:i.name,status:'published',example:true,document,updatedAt:stamp,libraryVersion:version,kind:i.kind});
 }
 res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({revision:stamp,courses:manifest.courses,materials,assignments,excludedIds:[...excludedIds,...manifest.skipped.filter(i=>i.id).map(i=>i.id)],presentation:{mode:selection.mode,revision:selection.revision,total:manifest.items.length,selected:items.length},audit:items.map(i=>({id:i.id,name:i.name,course:i.course,kind:i.kind,parse:i.parse,ai:i.ai}))}));return true;
}
