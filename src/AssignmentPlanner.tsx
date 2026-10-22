import {useI18n} from './i18n';
import {useEffect, useRef, useState, type DragEvent} from 'react';
import {isoDate, type Assignment, type Course} from './data';
import {errorMessage, sourcePayload, studyRequest, uid} from './studyClient';
import {saveAsset} from './storage';
import {loadStudyDocument, saveStudyDocument, studyCacheKey} from './studyStore';
import type {StudyDocument, StudySource} from './studyTypes';

type DraftStep = {id:string;title:string;output:string;sourceQuote:string;sourcePage?:number;minutes:number};
type DraftFile = {name:string;pageCount:number;documentId:string;cacheKey?:string};
type Draft = {courseId:string;title:string;due:string;brief:string;steps:DraftStep[];mode:'ai'|'example'|'manual';file?:DraftFile};
const DRAFT_KEY='student-workbench-app-assignment-draft-v1';

function blank(courseId:string):Draft {return {courseId,title:'',due:'',brief:'',steps:[],mode:'manual'};}
function readDraft(courseId:string):Draft {
  try {
    const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
    if(d&&typeof d.courseId==='string'&&typeof d.title==='string'&&typeof d.brief==='string'&&typeof d.due==='string'&&['ai','example','manual'].includes(d.mode)&&Array.isArray(d.steps)&&d.steps.length<=8&&d.steps.every((s:DraftStep)=>typeof s.id==='string'&&typeof s.title==='string'&&typeof s.output==='string'&&typeof s.sourceQuote==='string'&&Number.isFinite(s.minutes))) {
      if(d.file&&(typeof d.file.name!=='string'||typeof d.file.documentId!=='string'||!Number.isInteger(d.file.pageCount)||(d.file.cacheKey!==undefined&&typeof d.file.cacheKey!=='string')))delete d.file;
      return d;
    }
  }catch{}
  return blank(courseId);
}
export default function AssignmentPlanner({courses,courseId,onCourse,anchor,aiConfigured,onSave}:{courses:Course[];courseId:string;onCourse:(id:string)=>void;anchor:string;aiConfigured:boolean;onSave:(a:Assignment)=>void}) {
  const {t}=useI18n();
  const [draft,setDraft]=useState(()=>readDraft(courseId));
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [phase,setPhase]=useState<'idle'|'reading'|'generating'>('idle');
  const [dragging,setDragging]=useState(false);
  const [message,setMessage]=useState('');
  const busy=phase!=='idle';
  const request=useRef<AbortController|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const aiReady=useRef(aiConfigured);aiReady.current=aiConfigured;
  const parsedDocument=useRef<StudyDocument|null>(null);
  const draftRef=useRef(draft);draftRef.current=draft;
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));}catch{setError('草稿暂时无法保存在浏览器中，请检查存储空间。');}},[draft]);
  useEffect(()=>{if(!courses.some(c=>c.id===draft.courseId))setDraft(blank(courseId));},[courses,courseId,draft.courseId]);
  function patch(value:Partial<Draft>) {setDraft(d=>({...d,...value}));}
  function stepPatch(id:string,value:Partial<DraftStep>) {setDraft(d=>({...d,steps:d.steps.map(s=>s.id===id?{...s,...value}:s)}));}
  function current(controller:AbortController) {return request.current===controller&&!controller.signal.aborted;}
  async function generateDraft(value:Draft,controller:AbortController,document?:StudyDocument) {
    let source=document;
    if(value.file&&!source) {
      source=parsedDocument.current?.id===value.file.documentId?parsedDocument.current:undefined;
      if(!source&&value.file.cacheKey)source=await loadStudyDocument(value.file.cacheKey);
      if(!source||source.id!==value.file.documentId||source.courseId!==value.courseId)throw new Error('这份文件的解析缓存不可用，请重新上传文件。');
    }
    if(!current(controller))return;
    setPhase('generating');
    const result=await studyRequest<{mode:'ai';steps:Omit<DraftStep,'id'>[]}>('plan',{courseId:value.courseId,title:value.title,...(source?{document:source}:{brief:value.brief}),allowExternal:true},controller.signal);
    if(current(controller)){patch({mode:'ai',steps:result.steps.map(step=>({...step,id:uid()}))});setMessage('步骤已生成，可以展开修改后加入计划。');}
  }
  async function upload(file:File|undefined) {
    if(!file)return;
    if(!/\.(pdf|pptx|docx|txt|md)$/i.test(file.name)||!file.size||file.size>25*1024*1024){setError('请上传 25 MB 以内的 PDF、PPTX、DOCX、TXT 或 MD 文件。');return;}
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setPhase('reading');setError('');setWarning('');setMessage('');
    const cid=draftRef.current.courseId;
    try {
      const source:StudySource={id:uid(),courseId:cid,name:file.name,type:file.type,blob:file};
      const payload=await sourcePayload(source,controller.signal);if(!current(controller))return;
      const doc=await studyRequest<StudyDocument>('parse',payload,controller.signal);if(!current(controller))return;
      if(doc.courseId!==cid||!doc.pages.some(p=>p.text.trim()))throw new Error('未读取到可用文字。扫描件或图片课件请转换为可选中文字的 PDF 后再试。');
      const text=doc.pages.map(p=>p.text).join('\n\n');
      if(text.length>60000)throw new Error('这份课件文字较多，请按章节拆分后上传，每份不超过 60,000 个字符。');
      let cacheKey:string|undefined;
      try {
        const asset=await saveAsset(cid,file);if(!current(controller))return;
        source.id=asset.id;cacheKey=await studyCacheKey(source);if(!current(controller))return;
        await saveStudyDocument(cacheKey,doc);
      }catch{if(current(controller))setWarning('文字已读取，但文件或缓存未保存；刷新后可能需要重新上传。');}
      if(!current(controller))return;
      parsedDocument.current=doc;
      const next:Draft={courseId:cid,title:file.name.replace(/\.[^.]+$/,'').slice(0,150)||t('课件学习计划'),due:'',brief:doc.pages.map(p=>`[第${p.page}页]\n${p.text}`).join('\n\n'),steps:[],mode:'manual',file:{name:file.name,pageCount:doc.pages.length,documentId:doc.id,cacheKey}};
      setDraft(next);
      if(aiReady.current)await generateDraft(next,controller,doc);
      else setMessage('文件已读取。ELM 可用后点击“生成步骤”，也可以手动添加步骤。');
    }catch(e){if(current(controller))setError(errorMessage(e));}
    finally{if(request.current===controller){setPhase('idle');request.current=null;}}
  }
  async function generate() {
    const value=draftRef.current;
    if(!value.title.trim()||(!value.file&&value.brief.trim().length<20)){setError('请先上传资料，或输入作业标题及至少 20 个字符的要求。');return;}
    request.current?.abort();const controller=new AbortController();request.current=controller;setPhase('generating');setError('');setMessage('');
    try{await generateDraft(value,controller);}catch(e){if(current(controller))setError(errorMessage(e));}
    finally{if(request.current===controller){setPhase('idle');request.current=null;}}
  }
  function drop(e:DragEvent) {e.preventDefault();setDragging(false);if(e.dataTransfer.files.length!==1){setError('请每次上传一份课件或作业说明。');return;}void upload(e.dataTransfer.files[0]);}
  function save() {
    const d=draftRef.current;const today=isoDate(new Date());
    if(!d.title.trim()||!d.steps.length||d.steps.some(s=>!s.title.trim()||!s.output.trim()||!Number.isInteger(s.minutes)||s.minutes<5||s.minutes>240)){setError('请填写作业标题、每步行动和产出；时间建议为 5–240 分钟。');return;}
    if(d.due&&d.due<today){setError('截止日期早于今天，请重新确认，或留空后再安排。');return;}
    if(!courses.some(c=>c.id===d.courseId)){setError('请选择一门有效课程。');return;}
    const day=(date:string)=>Math.round((new Date(`${date}T12:00:00`).getTime()-new Date(`${anchor}T12:00:00`).getTime())/86400000);
    const first=day(today);const remaining=d.due?Math.max(0,day(d.due)-first):d.steps.length-1;
    const assignment:Assignment={id:uid(),courseId:d.courseId,title:d.title.trim(),due:d.due,brief:d.brief,category:'coursework',deadlineVerified:false,deadlineSource:`${d.file?`来源文件：${d.file.name}；`:''}日期由用户填写；步骤为可编辑的学习计划，需自行核对资料。`,startsOn:today,steps:d.steps.map((s,i)=>({id:uid(),title:s.title.trim(),minutes:s.minutes,day:first+Math.floor(i*remaining/Math.max(1,d.steps.length-1)),done:false,blocked:false,evidence:s.output.trim(),source:s.sourceQuote?`${s.sourcePage?`第 ${s.sourcePage} 页 · `:''}${s.sourceQuote}`:'用户添加的步骤'}))};
    try{localStorage.removeItem(DRAFT_KEY);}catch{}
    onCourse(d.courseId);onSave(assignment);
  }
  return <section className="simple-feature" aria-labelledby="planner-title">
    <header className="simple-feature-heading"><div><span className="section-kicker">COURSEWORK PLANNER</span><h1 id="planner-title">{t("上传资料，自动拆解。")}</h1><p>{t("课件或作业说明，生成可以逐步完成的学习计划。")}</p></div></header>
    <div className="planner-layout"><section className="simple-panel planner-input"><div className="panel-heading"><span className="panel-number">01</span><h2>{t("上传课程资料")}</h2></div>
      <div className="form-stack"><label>{t("归属课程")}<select aria-label={t("归属课程")} value={draft.courseId} disabled={busy} onChange={e=>{parsedDocument.current=null;setDraft(blank(e.target.value));setError('');setWarning('');setMessage('');onCourse(e.target.value);}}>{courses.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>
        <div className={`planner-dropzone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={drop}>
          <input ref={fileInput} type="file" accept=".pdf,.pptx,.docx,.txt,.md" aria-label={t("上传课件或作业说明")} hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
          <span className="planner-upload-icon" aria-hidden="true">↑</span><h3>{draft.file?t("上传另一份资料"):t("把课件放到这里")}</h3><p>{t("支持课件、讲义或 coursework 说明")}</p><button className="button button-primary" disabled={busy} onClick={()=>fileInput.current?.click()}>{draft.file?t("更换文件"):t("选择文件并生成")}</button><small>{t("PDF、PPTX、DOCX、TXT、MD · 最大 25 MB")}</small>
        </div>
        <p className="simple-footnote planner-upload-notice">{aiConfigured?t("上传后会自动提取文字，并发送至学校 ELM 生成步骤。"):t("ELM 暂不可用：上传后可先读取原文，稍后生成步骤。")}{' '}{t("图片、图示中的文字可能无法提取。")}</p>
        {busy&&<div className="planner-upload-status" role="status"><span>{phase==='reading'?t("正在读取文件文字…"):t("正在生成 3–5 个步骤…")}</span><button className="text-button" onClick={()=>{request.current?.abort();setMessage(t("已取消。已读取的资料仍可重新生成步骤。"));}}>{t("取消")}</button></div>}
        {draft.file&&<div className="planner-file-summary"><span aria-hidden="true">↳</span><div><strong>{draft.file.name}</strong><small>{t("已读取")}{' '}{draft.file.pageCount}{' '}{t("页 / 节 · 已归入")}{' '}{courses.find(c=>c.id===draft.courseId)?.code}</small></div></div>}
        {(draft.file||draft.brief)&&<><label>{t("计划标题")}<input aria-label={t("计划标题")} value={draft.title} maxLength={150} disabled={busy} onChange={e=>patch({title:e.target.value})}/></label><label>{t("截止日期（可选）")}<input aria-label={t("截止日期")} type="date" value={draft.due} disabled={busy} onChange={e=>patch({due:e.target.value})}/></label><p className="simple-footnote">{t("标题已自动填写；截止日期由你确认，不会从课件中猜测。")}</p></>}
        {draft.file?<details className="planner-original"><summary>{t("查看提取的原文")}</summary><pre>{draft.brief}</pre></details>:<details className="planner-manual"><summary>{t("或手动输入要求")}</summary><div className="form-stack"><label>{t("作业标题")}<input value={draft.title} maxLength={150} disabled={busy} onChange={e=>patch({title:e.target.value})}/></label><label>{t("原始要求")}<textarea value={draft.brief} rows={5} maxLength={12000} disabled={busy} placeholder={t("粘贴作业要求…")} onChange={e=>patch({brief:e.target.value,steps:[],mode:'manual'})}/></label></div></details>}
        {(draft.file||draft.brief)&&<div className="planner-generate"><button className="button" onClick={generate} disabled={busy||!aiConfigured}>{draft.steps.length?t("重新生成步骤"):t("生成步骤")}</button></div>}
      </div>
    </section>
    <section className="simple-panel planner-result" aria-labelledby="draft-title"><div className="panel-heading"><span className="panel-number">02</span><h2 id="draft-title">{t("步骤草稿")}</h2><span className="subtle-badge">{draft.mode==='ai'?t("ELM 生成"):draft.mode==='example'?t("示例草稿"):draft.file?t("已读取文件"):t("等待资料")}</span></div><p className="simple-footnote">{t("课件生成复习步骤，作业说明生成执行步骤。展开即可修改。")}</p>
      {!draft.steps.length&&<div className="planner-placeholder"><span aria-hidden="true">≡</span><h3>{busy?t("正在整理你的资料"):t("上传后，步骤会显示在这里")}</h3><p>{t("每一步包含具体行动、预期产出和对应原文。")}</p></div>}
      <div className="draft-steps">{draft.steps.map((step,i)=><details className="draft-step" key={step.id}><summary><span className="draft-step-index">{String(i+1).padStart(2,'0')}</span><span><strong>{step.title||t("填写这一步的行动")}</strong><small>{step.output||t("补充完成后的产出")} · {step.minutes}{' '}{t("分钟")}</small></span><span className="draft-expand" aria-hidden="true">⌄</span></summary><div className="draft-step-fields"><label>{t("行动")}<input value={step.title} maxLength={160} disabled={busy} onChange={e=>stepPatch(step.id,{title:e.target.value})}/></label><label>{t("完成后应有的产出")}<textarea rows={2} value={step.output} maxLength={1200} disabled={busy} onChange={e=>stepPatch(step.id,{output:e.target.value})}/></label><label className="duration-field">{t("预计用时")}<input type="number" min={5} max={240} value={step.minutes} disabled={busy} onChange={e=>stepPatch(step.id,{minutes:Number(e.target.value)})}/>{t("分钟")}</label>{step.sourceQuote&&<details className="draft-source"><summary>{t("对应原文")}{step.sourcePage?t(" · 第 {v0} 页 / 节", {v0: step.sourcePage}):''}</summary><blockquote>{step.sourceQuote}</blockquote></details>}<button className="text-button" disabled={busy} aria-label={t("删除步骤 {v0}", {v0: i+1})} onClick={()=>patch({steps:draft.steps.filter(s=>s.id!==step.id)})}>{t("删除这一步")}</button></div></details>)}</div>
      <div className="planner-save"><button className="button" disabled={busy||draft.steps.length>=8} onClick={()=>patch({steps:[...draft.steps,{id:uid(),title:'',output:'',sourceQuote:'',minutes:30}]})}>{t("＋ 添加一步")}</button><button className="button button-primary" disabled={busy||!draft.steps.length} onClick={save}>{t("加入学习计划 ↗")}</button></div><p className="simple-footnote">{t("按顺序分配到今天至截止日；未填写日期时按每天一步安排。")}</p>
    </section></div>
    {error&&<p className="simple-error" role="alert">{t(error)}</p>}{warning&&<p className="simple-footnote" role="status">{t(warning)}</p>}{message&&<p className="planner-message" role="status">{t(message)}</p>}
  </section>;
}
