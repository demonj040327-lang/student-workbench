import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Readable} from 'node:stream';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseDocument, askDocument, planAssignment, studyStatus, createStudyMiddleware} from './study-api.mjs';

const exec = promisify(execFile);
const python = process.env.STUDY_PYTHON_BIN || '/Users/jiangge/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const textPayload = {courseId: 'fixture', name: 'notes.txt', contentBase64: Buffer.from('A good interview starts with voluntary consent.\n\nAn interview can be semi-structured.').toString('base64')};

test('real course PDF and PPTX extract and cover every page with valid source self-checks', async () => {
  for (const [courseId, name, url, expected] of [
    ['hci', 'lecture.pdf', '/course-materials/hci-week-2.pdf', 79],
    ['cgr', 'lecture.pptx', '/course-materials/cgr-lecture-3.pptx', 57],
    ['cgr', 'notes.pdf', '/course-materials/cgr-lecture-3-notes.pdf', 7],
  ]) {
    const document = await parseDocument({courseId, name, url});
    assert.equal(document.pages.length, expected);
    const covered = new Set(document.units.flatMap(unit => unit.pages));
    assert(document.pages.every(page => covered.has(page.page)));
    for (const unit of document.units) for (const question of unit.questions) {
      const source = document.pages.find(page => page.page === question.sourcePages[0]);
      assert(source.text.includes(question.options[question.answer]));
      assert(question.options.filter((_, index) => index !== question.answer).every(option => !source.text.includes(option)));
    }
  }
});

test('upload supports TXT and DOCX; blank PDF reports OCR instead of invented units', async () => {
  const text = await parseDocument(textPayload);
  assert.equal(text.mode, 'local');
  assert((await askDocument({document: text, question: 'consent', mode: 'local'})).grounded);
  assert.equal((await askDocument({document: text, question: 'zebrafish neurobiology', mode: 'local'})).grounded, false);
  const directory = await mkdtemp(join(tmpdir(), 'study-test-'));
  try {
    await exec(python, ['-c', `import sys,zipfile\nfrom pathlib import Path\nfrom pypdf import PdfWriter\np=Path(sys.argv[1])\nw=PdfWriter();w.add_blank_page(width=300,height=300);w.write(p/'blank.pdf')\nwith zipfile.ZipFile(p/'notes.docx','w') as z: z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>A triangle has three sides.</w:t></w:r></w:p></w:body></w:document>')`, directory]);
    const blank = await parseDocument({courseId: 'fixture', name: 'blank.pdf', contentBase64: (await readFile(join(directory, 'blank.pdf'))).toString('base64')});
    assert.equal(blank.units.length, 0);
    assert(blank.warnings.some(warning => warning.includes('OCR')));
    const docx = await parseDocument({courseId: 'fixture', name: 'notes.docx', contentBase64: (await readFile(join(directory, 'notes.docx'))).toString('base64')});
    assert(docx.pages[0].text.includes('three sides'));
    assert(docx.warnings.some(warning => warning.includes('排版页码')));
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('reordered PPTX follows presentation order and ignores unreferenced slide parts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'study-slides-'));
  try {
    const code = `import sys,zipfile\nfrom pathlib import Path\np=Path(sys.argv[1])/'reordered.pptx'\nns='http://schemas.openxmlformats.org/'\npresentation='<p:presentation xmlns:p="'+ns+'presentationml/2006/main" xmlns:r="'+ns+'officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="257" r:id="rId2"/><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>'\nrels='<Relationships xmlns="'+ns+'package/2006/relationships"><Relationship Id="rId1" Type="'+ns+'officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="'+ns+'officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>'\nwith zipfile.ZipFile(p,'w') as z:\n z.writestr('ppt/presentation.xml',presentation)\n z.writestr('ppt/_rels/presentation.xml.rels',rels)\n for n,text in [(1,'First-created slide shown second.'),(2,'Second-created slide shown first.'),(99,'Orphan slide is not in this presentation.')]:\n  z.writestr(f'ppt/slides/slide{n}.xml','<p:sld xmlns:p="'+ns+'presentationml/2006/main" xmlns:a="'+ns+'drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>'+text+'</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>')`;
    await exec(python, ['-c', code, directory]);
    const document = await parseDocument({courseId: 'fixture', name: 'reordered.pptx', contentBase64: (await readFile(join(directory, 'reordered.pptx'))).toString('base64')});
    assert.equal(document.pages.length, 2);
    assert.equal(document.pages[0].page, 1);
    assert.equal(document.pages[0].text, 'Second-created slide shown first.');
    assert.equal(document.pages[1].text, 'First-created slide shown second.');
    assert(!document.pages.some(page => page.text.includes('Orphan')));
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('Chinese course terminology finds English source text within only the selected file', async () => {
  const mlp = await parseDocument({courseId: 'mlp', name: 'mlp.pdf', url: '/course-materials/mlp-deep-networks-1.pdf'});
  for (const question of ['什么是神经网络？', '神经网络为什么需要隐藏层？']) {
    const answer = await askDocument({document: mlp, question, mode: 'local'});
    assert(answer.grounded, question);
    assert(answer.sources.every(source => mlp.pages.some(page => page.page === source.page && page.text.includes(source.excerpt))));
  }
  for (const [chinese, english] of [['梯度下降', 'gradient descent'], ['学习率', 'learning rate'], ['交叉熵', 'cross-entropy'], ['过拟合', 'overfitting'], ['正则化', 'regularisation'], ['损失', 'loss'], ['线性回归', 'linear regression'], ['矩阵', 'matrices'], ['透视投影', 'perspective'], ['观察法', 'observation']]) {
    const document = await parseDocument({courseId: 'fixture', name: `${english}.txt`, contentBase64: Buffer.from(`This lecture introduces ${english} and a worked example.`).toString('base64')});
    const answer = await askDocument({document, question: `解释${chinese}`, mode: 'local'});
    assert(answer.grounded, chinese);
    assert(answer.sources.some(source => source.excerpt.includes(english)), chinese);
  }
  const camera = await parseDocument({courseId: 'fixture', name: 'camera.txt', contentBase64: Buffer.from('The camera uses perspective projection and a pinhole.').toString('base64')});
  assert.equal((await askDocument({document: camera, question: '解释神经网络', mode: 'local'})).grounded, false);
});

test('input boundaries prevent path traversal, course mixing and unauthorized model calls', async () => {
  await assert.rejects(parseDocument({courseId: 'hci', name: 'x.pdf', url: '/course-materials/../x.pdf'}));
  await assert.rejects(parseDocument({courseId: 'hci', name: 'x.pdf', url: '/course-materials/aml-week-1-classification.pdf'}), /不匹配/);
  const document = await parseDocument(textPayload);
  await assert.rejects(askDocument({document, question: 'consent', mode: 'ai', allowExternal: false}, {env: {}}), /允许/);
  await assert.rejects(askDocument({document, question: 'consent', mode: 'ai', allowExternal: true}, {env: {}}), /尚未配置/);
  assert.equal((await studyStatus({})).aiConfigured, false);
});

test('same-origin middleware rejects cross-site POST and returns local parse/ask', async () => {
  const middleware = createStudyMiddleware({env: {}});
  const request = async (path, body, origin = 'http://localhost:5175') => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    req.url = path; req.method = body ? 'POST' : 'GET';
    req.headers = {host: 'localhost:5175', 'content-type': 'application/json', origin}; req.socket = {remoteAddress: '127.0.0.1'};
    let status, output;
    const res = {set statusCode(value) {status = value;}, setHeader() {}, end(value) {output = JSON.parse(value);}};
    await middleware(req, res, () => assert.fail('endpoint not intercepted'));
    return {status, output};
  };
  assert.equal((await request('/api/study/parse', textPayload, 'https://other.example')).status, 403);
  const upload = await request('/api/study/parse', textPayload);
  assert.equal(upload.status, 200);
  const answer = await request('/api/study/ask', {document: upload.output, question: 'consent', mode: 'local'});
  assert.equal(answer.status, 200);
  assert.equal(answer.output.sources[0].page, 1);
  const plan = await request('/api/study/plan', {courseId:'fixture',title:'Report',brief:'Review two services and write a report with references.',allowExternal:false});
  assert.equal(plan.status, 403);
});

test('assignment planning validates original quotes, step count, estimates and explicit model action', async () => {
  const originalFetch = globalThis.fetch;
  const payload = {courseId:'fixture',title:'Original demonstration brief',brief:'Review two digital services. Compare user journeys. Write a report with references.',allowExternal:true};
  const env = {ELM_API_KEY:'fixture-only',ELM_BASE_URL:'http://127.0.0.1:9999/v1',ELM_MODEL:'fixture-model'};
  const steps = ['Review two digital services.','Compare user journeys.','Write a report with references.'].map((sourceQuote,i)=>({title:`Action ${i+1}`,output:'A short evidence note',sourceQuote,minutes:30}));
  try {
    let calls=0;
    let responseSteps=steps;
    globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({steps:responseSteps})}}]}));};
    await assert.rejects(planAssignment({...payload,allowExternal:false},{env}),/允许/);
    assert.equal(calls,0);
    const plan=await planAssignment(payload,{env});
    assert.equal(plan.mode,'ai');assert.equal(plan.steps.length,3);
    assert(plan.steps.every(s=>payload.brief.includes(s.sourceQuote)));
    responseSteps=[{...steps[0],sourceQuote:'Invented requirement'},...steps.slice(1)];
    await assert.rejects(planAssignment(payload,{env}),/原文不符/);
    responseSteps=steps.slice(0,2);
    await assert.rejects(planAssignment(payload,{env}),/3–5/);
    responseSteps=[{...steps[0],minutes:-10},...steps.slice(1)];
    await assert.rejects(planAssignment(payload,{env}),/时间建议/);
  } finally {globalThis.fetch=originalFetch;}
});

test('uploaded planning checks course and page-specific quotes without inventing file requirements', async () => {
  const originalFetch=globalThis.fetch;
  const env={ELM_API_KEY:'fixture-only',ELM_BASE_URL:'http://127.0.0.1:9999/v1',ELM_MODEL:'fixture-model'};
  const document={id:'file-plan-fixture',courseId:'fixture',name:'lecture.pdf',pages:[{page:1,title:'Interview',text:'Semi-structured interviews use a flexible topic guide.'},{page:2,title:'Consent',text:'Participants can choose whether to participate.'}],units:[]};
  const payload={courseId:'fixture',title:'Lecture study plan',document,allowExternal:true};
  const steps=[{title:'Read the guide',output:'A definition note',sourceQuote:document.pages[0].text,sourcePage:1,minutes:20},{title:'Explain consent',output:'A consent summary',sourceQuote:document.pages[1].text,sourcePage:2,minutes:20},{title:'Recall the concepts',output:'A self-check note',sourceQuote:document.pages[0].text,sourcePage:1,minutes:15}];
  let modelSteps=steps;let calls=0;
  try {
    globalThis.fetch=async(_,options)=>{calls++;const body=JSON.parse(options.body);const user=JSON.parse(body.messages[1].content);assert.equal(user.pages.length,2);assert.equal(user.brief,undefined);assert(body.messages[0].content.includes('不编造作业'));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({steps:modelSteps})}}]}));};
    await assert.rejects(planAssignment({...payload,courseId:'another-course'},{env}),/不匹配/);
    assert.equal(calls,0);
    const plan=await planAssignment(payload,{env});assert.equal(plan.steps[1].sourcePage,2);
    modelSteps=[{...steps[0],sourcePage:2},...steps.slice(1)];
    await assert.rejects(planAssignment(payload,{env}),/页序或原文/);
    modelSteps=[{...steps[0],sourcePage:999},...steps.slice(1)];
    await assert.rejects(planAssignment(payload,{env}),/页序或原文/);
    const large={...document,id:'too-long-file',pages:[{page:1,text:'x'.repeat(31000)},{page:2,text:'y'.repeat(31000)}]};
    const before=calls;await assert.rejects(planAssignment({...payload,document:large},{env}),/按章节拆分/);assert.equal(calls,before);
  }finally{globalThis.fetch=originalFetch;}
});

test('mock ELM validates citations and generated plan structure without any outbound request', async () => {
  const fetchBefore = globalThis.fetch;
  const env = {ELM_API_KEY: 'fixture-not-a-real-key', ELM_BASE_URL: 'http://127.0.0.1:9999/v1', ELM_MODEL: 'fixture-model'};
  const document = await parseDocument(textPayload);
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({choices: [{message: {content: 'Consent is voluntary. [第1页]'}}]}));
    assert.equal((await askDocument({document, question: 'consent', mode: 'ai', allowExternal: true}, {env})).mode, 'ai');
    globalThis.fetch = async () => new Response(JSON.stringify({choices: [{message: {content: 'Wrong source [第999页]'}}]}));
    await assert.rejects(askDocument({document, question: 'consent', mode: 'ai', allowExternal: true}, {env}), /引用/);
    const unit = {title: 'Interview', pages: [1], overview: 'Read consent principles.', points: ['Voluntary consent.'], readingSteps: ['Read the source.'], questions: [{prompt: 'Which word appears in the source?', options: ['consent', 'galaxy', 'ocean', 'volcano'], answer: 0, explanation: 'The source includes consent.', sourcePages: [1]}]};
    globalThis.fetch = async () => new Response(JSON.stringify({choices: [{message: {content: JSON.stringify({units: [unit]})}}]}));
    const plan = await parseDocument({...textPayload, mode: 'ai', allowExternal: true}, {env});
    assert.equal(plan.mode, 'ai'); assert.equal(plan.units[0].questions[0].options.length, 4);
    unit.questions[0].answer = 9;
    await assert.rejects(parseDocument({...textPayload, mode: 'ai', allowExternal: true}, {env}), /题目/);
  } finally { globalThis.fetch = fetchBefore; }
});

test('Qwen options stay server side and incomplete model output is rejected', async () => {
  const previous = globalThis.fetch;
  const env = {ELM_API_KEY:'fixture-only',ELM_BASE_URL:'http://127.0.0.1:9999/v1',ELM_MODEL:'Qwen/fixture',ELM_ENABLE_THINKING:'false',ELM_JSON_MODE:'json_object',STUDY_ANSWER_MAX_TOKENS:'128',STUDY_PLAN_MAX_TOKENS:'1024'};
  const document = await parseDocument(textPayload);
  let request;
  try {
    globalThis.fetch = async (_, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Consent is voluntary. [第1页]'}}]}));
    };
    await askDocument({document,question:'consent',mode:'ai',allowExternal:true},{env});
    assert.equal(request.max_tokens,128);
    assert.deepEqual(request.chat_template_kwargs,{enable_thinking:false});
    assert.equal(request.response_format,undefined);
    const unit={title:'Consent',pages:[1],overview:'Read voluntary consent.',points:['Consent is voluntary.'],readingSteps:['Read page 1.'],questions:[{prompt:'What does consent mean?',options:['Voluntary agreement','Compulsory participation','A deadline','An experiment result'],answer:0,explanation:'The page states consent is voluntary.',sourcePages:[1]}]};
    globalThis.fetch = async (_, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({units:[unit]})}}]}));
    };
    await parseDocument({...textPayload,mode:'ai',allowExternal:true},{env});
    assert.equal(request.max_tokens,1024);
    assert.deepEqual(request.response_format,{type:'json_object'});
    globalThis.fetch = async () => new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:null}}]}));
    await assert.rejects(askDocument({document,question:'consent',mode:'ai',allowExternal:true},{env}),/长度上限/);
  } finally {globalThis.fetch=previous;}
});
