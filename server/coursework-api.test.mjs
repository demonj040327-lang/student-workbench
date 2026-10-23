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

test('coursework planning honours output settings and rejects truncated output without adopting partial steps',async()=>{
 const {planAssignment}=await import('./study-api.mjs');
 const previous=globalThis.fetch;
 const limits=[];
 try{
  globalThis.fetch=async(_,options)=>{const body=JSON.parse(options.body);limits.push(body.max_tokens);assert(body.messages[0].content.includes('不超过180'));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({steps:[1,2,3].map(i=>({title:'Review '+i,output:'A note',sourceQuote:'Submit a report.',sourcePage:1,minutes:20}))})}}]}));};
  const payload={document,courseId:'fixture',title:'Report',allowExternal:true,credentialScope:'teacher'};
  await planAssignment(payload,{env});
  await planAssignment(payload,{env:{...env,STUDY_PLAN_MAX_TOKENS:'8100'}});
  await planAssignment(payload,{env:{...env,STUDY_PLAN_MAX_TOKENS:'8100',STUDY_COURSEWORK_MAX_TOKENS:'9200'}});
  assert.deepEqual(limits,[6000,8100,9200]);
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"steps":['}}]}));
  await assert.rejects(planAssignment(payload,{env}),/长度上限/);
 }finally{globalThis.fetch=previous;}
});

test('valid short guidance is accepted across many slides without relaxing coverage or citation checks',async()=>{
 const {generateGuidance}=await import('./study-api.mjs');
 const doc={id:'short-guidance-fixture',courseId:'fixture',name:'slides.pdf',pages:Array.from({length:6},(_,i)=>({page:i+1,title:'Consent',text:'Participation is voluntary. Obtain informed consent.'}))};
 const unit={title:'Consent',overview:'Participation is voluntary.',points:['Obtain consent.'],readingSteps:['Read the source.'],questions:[{prompt:'What is required?',options:['Consent','Payment','A grade','A deadline'],answer:0,explanation:'The source states informed consent.',sourcePages:[1]}]};
 const old=globalThis.fetch;
 let output={units:[{...unit,pages:[1,2,3]},{...unit,pages:[4,5,6]}]};
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}));
  const payload={document:doc,allowExternal:true,credentialScope:'teacher'};
  const r=await generateGuidance(payload,{env});assert.equal(r.units.length,2);
  output={units:[{...unit,pages:[1,2,3,4,5,6]}]};assert.equal((await generateGuidance(payload,{env})).units.length,1);
  output={units:[{...unit,pages:[1]}]};const partial=await generateGuidance(payload,{env});assert.deepEqual(partial.units[0].readingOnlyPages,[2,3,4,5,6]);assert(partial.units[0].overview.includes('未生成 AI 讲解'));assert.equal(partial.units[0].questions.length,1);
  output={units:Array.from({length:6},()=>({...unit,pages:[1,2,3,4,5,6]}))};await assert.rejects(generateGuidance(payload,{env}),/1–5/);
  output={units:[null]};await assert.rejects(generateGuidance(payload,{env}),/模块格式/);
 }finally{globalThis.fetch=old;}
});

test('guidance diagnostics separate option, answer-index and PDF-page errors',async()=>{
 const {generateGuidance}=await import('./study-api.mjs');
 const doc={id:'question-fields-fixture',courseId:'fixture',name:'slides.pdf',pages:[{page:1,title:'Consent',text:'Participation is voluntary.'}]};
 const q={prompt:'What is required?',options:['Consent','Payment','A grade','A deadline'],answer:0,explanation:'Consent is voluntary.',sourcePages:[1]};
 const old=globalThis.fetch;let question=q;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({units:[{title:'Consent',overview:'Read consent.',points:['Consent is voluntary.'],readingSteps:['Read page one.'],pages:[1],questions:[question]}]})}}]}));
  const payload={document:doc,allowExternal:true,credentialScope:'teacher'};
  question={...q,answer:4};assert.equal((await generateGuidance(payload,{env})).units[0].questions.length,0);
  question={...q,sourcePages:['1']};assert.equal((await generateGuidance(payload,{env})).units[0].questions[0].sourcePages[0],1);
  question={...q,sourcePages:[54]};assert.equal((await generateGuidance(payload,{env})).units[0].questions.length,0);
  question={...q,options:['A','B']};assert.equal((await generateGuidance(payload,{env})).units[0].questions.length,0);
  question=q;assert.equal((await generateGuidance(payload,{env})).units[0].questions[0].answer,0);
 }finally{globalThis.fetch=old;}
});


test('option formats are normalised without inventing missing answers',async()=>{
 const {normalizeStudyQuestion}=await import('./study-api.mjs');
 assert.deepEqual(normalizeStudyQuestion({options:{A:'one',B:'two',C:'three',D:'four'},answer:'C',sourcePages:['2']}).options,['one','two','three','four']);
 assert.equal(normalizeStudyQuestion({answer:'C'}).answer,2);
 assert.deepEqual(normalizeStudyQuestion({options:[{label:'A',text:'one'},{label:'B',text:'two'},{label:'C',text:'three'},{label:'D',text:'four'}]}).options,['one','two','three','four']);
 assert.deepEqual(normalizeStudyQuestion({options:['one','two']}).options,['one','two']);
 assert.equal(normalizeStudyQuestion({answer:4}).answer,4);
});
