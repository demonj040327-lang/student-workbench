import {useI18n} from './i18n';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {courseMaterials, type Course} from './data';
import {deleteAsset, listAssets, saveAsset, type StoredAsset} from './storage';
import {deleteStudyForSource, loadStudyDocument, saveStudyDocument, studyCacheKey} from './studyStore';
import type {StudyAnswer, StudyDocument, StudySource} from './studyTypes';
import StudyAnswerText from './StudyAnswerText';
import {errorMessage, sourcePayload, studyRequest} from './studyClient';

type Entry=StudyAnswer&{question:string};
const suggestions:Record<string,string[]>={};
export default function CourseQuestions({courses,courseId,onCourse,aiConfigured}:{courses:Course[];courseId:string;onCourse:(id:string)=>void;aiConfigured:boolean}) {
  const {t}=useI18n();
  const [assets,setAssets]=useState<StoredAsset[]>([]);
  const [selected,setSelected]=useState<StudySource|null>(null);
  const [document,setDocument]=useState<StudyDocument|null>(null);
  const [loading,setLoading]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [asking,setAsking]=useState(false);
  const [question,setQuestion]=useState('');
  const [entries,setEntries]=useState<Entry[]>([]);
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [page,setPage]=useState<number|null>(null);
  const [mode,setMode]=useState<'ai'|'local'>('ai');
  const [originalUrl,setOriginalUrl]=useState('');
  const [selectionError,setSelectionError]=useState('');
  const courseRef=useRef(courseId);courseRef.current=courseId;
  const parser=useRef<AbortController|null>(null);
  const answerRequest=useRef<AbortController|null>(null);
  const selectionVersion=useRef(0);
  const fileInput=useRef<HTMLInputElement>(null);
  const endRef=useRef<HTMLDivElement>(null);
  const safeMode=aiConfigured?mode:'local';
  const current=document?.courseId===courseId?document:null;
  const sources:StudySource[]=[...(courseMaterials[courseId]||[]).map(m=>({id:m.id,courseId,name:m.name,type:m.type,url:m.url,materialId:m.id})),...assets.filter(a=>/\.(pdf|pptx|docx|txt|md)$/i.test(a.name)).map(a=>({id:a.id,courseId:a.courseId,name:a.name,type:a.type,blob:a.blob}))];
  useEffect(()=>{let live=true;selectionVersion.current++;parser.current?.abort();answerRequest.current?.abort();setSelected(null);setDocument(null);setEntries([]);setPage(null);setQuestion('');setAssets([]);setError('');setWarning('');setSelectionError('');setLoading(false);setAsking(false);listAssets(courseId).then(value=>{if(live)setAssets(value);}).catch(e=>{if(live)setError(errorMessage(e));});return()=>{live=false;};},[courseId]);
  useEffect(()=>()=>{selectionVersion.current++;parser.current?.abort();answerRequest.current?.abort();},[]);
  useEffect(()=>{if(!selected){setOriginalUrl('');return;}if(selected.blob){const url=URL.createObjectURL(selected.blob);setOriginalUrl(url);return()=>URL.revokeObjectURL(url);}setOriginalUrl(selected.url||'');},[selected]);
  async function select(source:StudySource) {
    parser.current?.abort();answerRequest.current?.abort();const controller=new AbortController();parser.current=controller;const version=++selectionVersion.current;
    const valid=()=>!controller.signal.aborted&&selectionVersion.current===version&&courseRef.current===source.courseId;
    setSelected(source);setDocument(null);setEntries([]);setPage(null);setQuestion('');setError('');setSelectionError('');setWarning('');setLoading(true);setAsking(false);
    try {
      const key=await studyCacheKey(source);if(!valid())return;
      let doc:StudyDocument|undefined;
      try{doc=await loadStudyDocument(key);}catch{if(valid())setWarning('缓存暂不可用，仍可读取和提问。');}
      if(!valid())return;
      if(!doc) {
        const payload=await sourcePayload(source,controller.signal);if(!valid())return;
        doc=await studyRequest<StudyDocument>('parse',payload,controller.signal);if(!valid())return;
        try{await saveStudyDocument(key,doc);}catch{if(valid())setWarning('文字已读取，但缓存未保存；刷新后需要重新读取。');}
      }
      if(!valid())return;
      if(doc.courseId!==source.courseId||!doc.pages.some(p=>p.text.trim()))throw new Error('没有提取到有效文字，请使用含可选中文字的课件。');
      setDocument(doc);setPage(doc.pages[0]?.page||null);
    }catch(e){if(valid())setSelectionError(errorMessage(e));}
    finally{if(valid()){setLoading(false);parser.current=null;}}
  }
  async function upload(file:File|undefined) {
    if(!file)return;const cid=courseId;
    if(!/\.(pdf|pptx|docx|txt|md)$/i.test(file.name)||file.size>25*1024*1024||!file.size){setError('请上传 25 MB 以内的 PDF、PPTX、DOCX、TXT 或 MD 文件。');return;}
    setUploading(true);setError('');
    try{const asset=await saveAsset(cid,file);if(courseRef.current!==cid)return;setAssets(a=>[asset,...a]);await select({id:asset.id,courseId:cid,name:asset.name,type:asset.type,blob:asset.blob});}catch(e){if(courseRef.current===cid)setError(errorMessage(e));}finally{setUploading(false);}
  }
  async function remove(asset:StoredAsset) {
    const cid=courseId;
    try{await deleteAsset(asset.id);await deleteStudyForSource(asset.courseId,asset.id);if(courseRef.current!==cid)return;setAssets(a=>a.filter(x=>x.id!==asset.id));if(selected?.id===asset.id){selectionVersion.current++;parser.current?.abort();answerRequest.current?.abort();setSelected(null);setDocument(null);setEntries([]);setPage(null);setLoading(false);setAsking(false);}}
    catch(e){if(courseRef.current===cid)setError(errorMessage(e));}
  }
  async function ask(e:FormEvent) {
    e.preventDefault();if(!current||!question.trim()||asking)return;
    const submitted=question.trim();const version=selectionVersion.current;const controller=new AbortController();answerRequest.current=controller;setAsking(true);setError('');
    try{const result=await studyRequest<StudyAnswer>('ask',{document:current,question:submitted,mode:safeMode,allowExternal:safeMode==='ai'},controller.signal);if(controller.signal.aborted||version!==selectionVersion.current)return;setEntries(list=>[...list,{...result,question:submitted}]);setQuestion('');setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'}),0);}
    catch(e){if(!controller.signal.aborted&&version===selectionVersion.current)setError(errorMessage(e));}
    finally{if(answerRequest.current===controller){setAsking(false);answerRequest.current=null;}}
  }
  const visiblePage=current?.pages.find(p=>p.page===page);
  const pdf=selected?.type==='application/pdf'||Boolean(selected?.url?.endsWith('.pdf'));
  return <section className="simple-feature" aria-labelledby="questions-title"><header className="simple-feature-heading"><div><span className="section-kicker">UNDERSTAND YOUR MATERIAL</span><h1 id="questions-title">{t("带着问题，回到课件。")}</h1><p>{t("选择一份资料，解释概念，也能找到原文依据。")}</p></div><span className="service-indicator"><i className={aiConfigured?'online':''}/>{aiConfigured?t("学校 ELM 已配置"):t("本地原文检索")}</span></header>
    <div className="questions-layout"><aside className="simple-panel material-picker" aria-label={t("课程与课件")}><label>{t("归属课程")}<select aria-label={t("归属课程")} value={courseId} onChange={e=>onCourse(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><div className="material-list-heading"><h2>{t("课程资料")}</h2><span>{sources.length}{' '}{t("份")}</span></div><div className="simple-material-list">{sources.map(source=><div className={`simple-material-item ${selected?.id===source.id?'selected':''}`} key={source.id}><button aria-pressed={selected?.id===source.id} onClick={()=>void select(source)}><span className="file-glyph" aria-hidden="true">↳</span><span><strong>{source.name}</strong><small>{source.blob?t("本机上传"):t("课程课件")}</small></span></button>{source.blob&&<button className="remove-material" aria-label={t("删除 {v0}", {v0: source.name})} onClick={()=>{const asset=assets.find(a=>a.id===source.id);if(asset)void remove(asset);}}>×</button>}</div>)}</div><input ref={fileInput} type="file" accept=".pdf,.pptx,.docx,.txt,.md" hidden onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><button className="button material-upload" disabled={uploading} onClick={()=>fileInput.current?.click()}>{uploading?t("正在读取…"):t("＋ 上传课件")}</button><p className="simple-footnote">PDF、PPTX、DOCX、TXT、MD<br/>{t("单份 25 MB 以内，按课程独立保存。")}</p></aside>
    <div className="question-workspace"><section className="simple-panel question-conversation" aria-label={t("课件问答")}><div className="question-toolbar"><div><span className="section-kicker">{t("当前课件")}</span><h2>{selected?.name||t("先选择一份课程资料")}</h2></div><label className="answer-mode"><span className="sr-only">{t("回答方式")}</span><select value={safeMode} onChange={e=>setMode(e.target.value as 'ai'|'local')} disabled={asking}><option value="ai" disabled={!aiConfigured}>{t("ELM 知识点解答")}</option><option value="local">{t("本地原文检索")}</option></select></label></div>
      <div className="conversation-body">{loading&&<p className="loading-state" role="status">{t("正在读取课件文字…")}</p>}{selectionError&&<div className="simple-error" role="alert"><p>{t(selectionError)}</p><button className="button" onClick={()=>selected&&void select(selected)}>{t("重新读取")}</button></div>}{!loading&&!selectionError&&!entries.length&&<div className="question-placeholder"><span aria-hidden="true">?</span><h3>{current?t("想先弄懂哪个概念？"):t("让解答有据可查")}</h3><p>{current?t("已读取 {v0} 页。可以从下面的问题开始。", {v0: current.pages.length}):t("从左侧选择课件，或上传你自己的资料。")}</p>{current&&<div className="question-suggestions">{(suggestions[courseId]||[t("这份课件讲了什么？")]).map(text=><button key={text} onClick={()=>{setQuestion(text);window.document.getElementById('question-input')?.focus();}}>{text} ↗</button>)}</div>}</div>}
        {entries.map((entry,i)=><article className="conversation-entry" key={i}><div className="user-question"><span>{t("你的问题")}</span><p>{entry.question}</p></div><div className="grounded-answer"><span className="answer-label">{entry.mode==='ai'?t("ELM 解答"):t("原文检索")}{!entry.grounded?t(" · 资料不足"):''}</span><StudyAnswerText text={entry.answer}/>{entry.sources.length>0&&<div className="answer-sources"><span>{t("依据页序")}</span>{entry.sources.map(source=><button key={source.page} onClick={()=>{setPage(source.page);setTimeout(()=>window.document.getElementById('source-reader')?.scrollIntoView({behavior:'smooth',block:'nearest'}),0);}}>{t("第")}{' '}{source.page}{' '}{t("页 ↗")}</button>)}</div>}</div></article>)}{asking&&<p role="status" className="loading-state">{safeMode==='ai'?t("ELM 正在结合当前课件解答…"):t("正在检索当前课件…")}</p>}<div ref={endRef}/></div>
      <form className="question-composer" onSubmit={ask}><label htmlFor="question-input" className="sr-only">{t("你的问题")}</label><textarea id="question-input" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} rows={2} disabled={!current||asking} placeholder={current?t("输入课件中的术语，或描述不理解的地方…"):t("选择课件后即可提问…")}/><div><p>{safeMode==='ai'?t("发送时仅将问题和相关课件文字片段交给 ELM。"):t("只检索本份课件原文，不生成 AI 讲解。")}</p>{asking?<button type="button" className="button" onClick={()=>answerRequest.current?.abort()}>{t("取消")}</button>:<button className="button button-primary" disabled={!current||!question.trim()} type="submit">{t("提问 ↑")}</button>}</div></form>
    </section>
    {current&&<section id="source-reader" className="simple-panel source-reader" aria-label={t("课件原文")}><div className="simple-section-heading"><h2>{t("原文核对")}</h2><label className="inline-label">{t("页序")}<select aria-label={t("原文页序")} value={page||''} onChange={e=>setPage(Number(e.target.value))}>{current.pages.map(p=><option key={p.page} value={p.page}>{p.page} / {current.pages.length}</option>)}</select></label></div><h3>{visiblePage?.title}</h3><pre>{visiblePage?.text||t("此页未提取到文字，请查看原文件。")}</pre>{originalUrl&&<a className="source-original" href={pdf?`${originalUrl}#page=${page||1}`:originalUrl} target="_blank" rel="noreferrer" download={pdf?undefined:selected?.name}>{t("打开原文件 ↗")}</a>}<p className="simple-footnote">{t("以上为提取文字；图示及图片中的公式请核对原文件。页序从 1 开始。")}</p></section>}
    </div></div>{(error||warning)&&<p className={error?'simple-error':'simple-footnote'} role={error?'alert':'status'}>{t(error||warning)}</p>}
  </section>;
}
