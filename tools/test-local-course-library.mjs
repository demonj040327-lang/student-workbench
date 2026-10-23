// Local-only course corpus audit. Course documents and model outputs live in ignored data/.
import {readFile,writeFile,mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import {join,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadEnv} from 'vite';
import {parseDocument,generateGuidance,extractCoursework} from '../server/study-api.mjs';
const exec=promisify(execFile),root=process.cwd(),out=join(root,'data/local-demo-library');
const base=process.env.COURSE_LIBRARY_ROOT||'/Users/jiangge/Desktop/爱丁堡 AI';
const env={...process.env,...loadEnv('development',root,'' )};
const python=env.STUDY_PYTHON_BIN||'python3';
const definitions=[['hci','HCI','Human-Computer Interaction','#6f8264'],['mlp','MLP','Machine Learning Practical','#8d7aa2'],['aml','AML','Applied Machine Learning','#64899b'],['cgr','CGR','Computer Graphics Rendering','#b08962']];
await mkdir(join(out,'files'),{recursive:true});
const courses=definitions.map(([id,code,name,color])=>({id:'local-course-'+id,code,name,color,subject:'',teacher:'课程教学团队',instructorId:'local-teacher',description:'本机课程资料 · '+code}));
const items=[],skipped=[];
for(const [code,,folder] of definitions){
 const folderPath=join(base,folder);
 async function scan(dir,depth=0){
  const entries=await readdir(dir,{withFileTypes:true});
  for(const e of entries){
   const path=join(dir,e.name),relative=path.slice(folderPath.length+1);
   if(e.isDirectory()){
    // Only official material locations, never student project trees, results or backups.
    if(depth===0&&(/^(lecture|week\d+|tutorials|coursework)$/i.test(e.name)))await scan(path,depth+1);
    else if(code==='mlp'&&relative==='Coursework/Coursework1')await scan(path,depth+1);
    continue;
   }
   if(!['.pdf','.pptx','.docx','.ppt','.doc'].includes(extname(e.name).toLowerCase()))continue;
   if(/^(\.~|~\$)|billingual|中文|翻译|执行计划|Research_Plan/i.test(e.name)) {skipped.push({course:code,file:relative,reason:'个人整理、翻译或临时文件'});continue;}
   let kind=/tutorial|tut\d/i.test(relative)?'tutorial':/paper|jrsssb_/i.test(e.name)?'reference':/brief|spec/i.test(e.name)?'coursework':/template|pisinformatics|participantconsent/i.test(e.name)?'template':'lecture';
   if(/coursework/i.test(relative)&&!['coursework','template','reference'].includes(kind)){skipped.push({course:code,file:relative,reason:'非明确的官方作业说明'});continue;}
   const buffer=await readFile(path),hash=createHash('sha256').update(buffer).digest('hex');
   if(e.name==='MLP2026_27_CW1_Template.pdf'){skipped.push({id:'local-'+code+'-'+hash.slice(0,12),course:code,file:relative,reason:'内容包含成段分析和实验结果，保守排除，不作为空白模板导入'});continue;}
   if(items.some(i=>i.sha256===hash)){skipped.push({course:code,file:relative,reason:'字节完全重复'});continue;}
   const id='local-'+code+'-'+hash.slice(0,12),extension=extname(e.name).toLowerCase();
   await copyFile(path,join(out,'files',id+extension));
   items.push({id,courseId:'local-course-'+code,course:code,name:e.name,relative,kind,bytes:buffer.length,sha256:hash,extension,file:id+extension,week:Number(e.name.match(/week[- ]?0?(\d)|mlp0?(\d)|W0?(\d)|CGR(?:25|26)_L?(\d+)/i)?.slice(1).find(Boolean)||1)});
  }
 }
 await scan(folderPath);
}
const manifest={version:1,revision:new Date().toISOString(),courses,items,skipped,exclusionPolicy:'仅导入官方讲义、教程、参考文献、空白模板和作业说明；排除个人答案、报告、代码、实验输出、翻译、压缩包和备份。'};
let saving=Promise.resolve();
const save=()=>{const snapshot=JSON.stringify(manifest,null,2);saving=saving.then(()=>writeFile(join(out,'manifest.json'),snapshot));return saving;};
for(const item of items){
 try{
  const path=join(out,'files',item.file);
  if(item.bytes<=25*1024*1024) item.document=await parseDocument({courseId:item.courseId,name:item.name,materialId:item.id,contentBase64:(await readFile(path)).toString('base64')},{env});
  else {
   const raw=await exec(python,[join(root,'server/extract_document.py'),path,item.extension],{timeout:45000,maxBuffer:12*1024*1024});
   const parsed=JSON.parse(raw.stdout);if(parsed.error)throw Error(parsed.error);
   item.document={id:item.id+'-source',courseId:item.courseId,name:item.name,pages:parsed.pages,units:[],mode:'local',warnings:[...parsed.warnings,'原件超过25 MB：本次通过本机资料库导入，不代表普通上传接口通过。'],createdAt:new Date().toISOString()};
  }
  // Never label local excerpt exercises as model-generated learning content.
  item.document.units=[];
  item.parse={ok:true,pages:item.document.pages.length,blank:item.document.pages.filter(p=>!p.text.trim()).map(p=>p.page),characters:item.document.pages.reduce((n,p)=>n+p.text.length,0),uploadSupported:item.bytes<=25*1024*1024,warnings:item.document.warnings};
  console.log('PARSED',item.course,item.name,item.parse.pages+'p',item.parse.blank.length+' blank',item.parse.uploadSupported?'upload-ok':'over-25MB');
 }catch(error){item.parse={ok:false,error:error.message};console.log('PARSE-FAILED',item.course,item.name,error.message);}
 await save();
}
console.log('INVENTORY',items.length,'files',skipped.length,'skipped');
if(process.argv.includes('--ai')){
 let cursor=0;
 async function worker(){while(cursor<items.length){const item=items[cursor++];if(!item.parse.ok||!item.parse.characters)continue;
  const previousPath=join(out,item.id+'-ai.json');
  try{const cached=JSON.parse(await readFile(previousPath,'utf8'));if(cached.sourceHash===item.sha256 && cached.result.ai?.ok && !(item.kind==='coursework' && cached.result.ai.type!=='coursework')){Object.assign(item,cached.result);console.log('CACHED',item.name);continue;}}catch{}
  const started=Date.now();
  try{
   if(item.kind==='coursework'){
    const extracted=await extractCoursework({document:item.document,allowExternal:true,credentialScope:'teacher',mode:'teacher-summary',language:'zh'},{env});
    item.fields=extracted.fields;item.ai={ok:true,type:'coursework',seconds:Math.round((Date.now()-started)/1000)};
   }else{
    // Oversized text is split by actual source pages before generation, keeping original citations.
    const groups=[];let group=[],chars=0;
    for(const page of item.document.pages){if((chars+page.text.length>20000 || group.length>=30)&&group.length){groups.push(group);group=[];chars=0;}group.push(page);chars+=page.text.length;}if(group.length)groups.push(group);
    const units=[],warnings=[];
    for(let index=0;index<groups.length;index++){
     const part={...item.document,id:item.document.id+'-part-'+(index+1),pages:groups[index],units:[]};
     let result;
     try { result=await generateGuidance({document:part,allowExternal:true,credentialScope:'teacher',language:'zh'},{env}); }
     catch(error) {
       if(!/长度上限|1–5|有效学习计划|学习模块|选择题数量/.test(error.message)||groups[index].length<4) throw error;
       const half=Math.ceil(groups[index].length/2);groups.splice(index,1,groups[index].slice(0,half),groups[index].slice(half));index--;continue;
     }
     units.push(...result.units);warnings.push(...result.warnings);
    }
    item.document={...item.document,units,mode:'ai',warnings:[...new Set([...item.document.warnings,...warnings])]};
    item.ai={ok:true,type:'guidance',seconds:Math.round((Date.now()-started)/1000),units:units.length,questions:units.flatMap(u=>u.questions).length};
   }
  }catch(error){item.ai={ok:false,error:error.message,seconds:Math.round((Date.now()-started)/1000)};}
  await writeFile(previousPath,JSON.stringify({sourceHash:item.sha256,result:{document:item.document,fields:item.fields,ai:item.ai}}));
  // Snapshot writes are serialized by JS; each includes all completed in-memory items.
  await save();console.log(item.ai.ok?'AI-PASS':'AI-FAIL',item.course,item.name,JSON.stringify(item.ai));
 }}
 await Promise.all([worker(),worker()]);
}
await save();
console.log('DONE',JSON.stringify({files:items.length,parseOK:items.filter(i=>i.parse?.ok).length,aiOK:items.filter(i=>i.ai?.ok).length,aiFailed:items.filter(i=>i.ai&&!i.ai.ok).length}));
