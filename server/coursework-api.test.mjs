import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractCoursework} from './study-api.mjs';
const document={id:'coursework-test',courseId:'fixture',name:'brief.txt',pages:[{page:1,title:'Brief',text:'Submit a report. Deadline 30 November 2026 at 12:00 UTC.'}]};
const env={ELM_API_KEY:'fixture-only',ELM_MODEL:'fixture-model',ELM_BASE_URL:'http://127.0.0.1:9999/v1'};
test('coursework extraction keeps missing dates empty and validates source evidence',async()=>{
 const previous=globalThis.fetch;
 const fields=Object.fromEntries(['title','release','deadline','timezone','submissionType','deliverables','rubric'].map(k=>[k,{value:'',page:0,quote:''}]));
 fields.deadline={value:'30 November 2026 at 12:00 UTC',page:1,quote:'Deadline 30 November 2026 at 12:00 UTC.'};
 try{
  await assert.rejects(extractCoursework({document},{env}),/允许/);
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(fields)}}]}));
  const result=await extractCoursework({document,allowExternal:true,credentialScope:'teacher'},{env});
  assert.equal(result.fields.release.value,'');assert.equal(result.fields.deadline.page,1);
  fields.deadline.quote='Invented requirement';
  await assert.rejects(extractCoursework({document,allowExternal:true,credentialScope:'teacher'},{env}),/引用/);
 }finally{globalThis.fetch=previous;}
});
