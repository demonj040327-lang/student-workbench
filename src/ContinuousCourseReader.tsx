import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {StudyPage} from './studyTypes';
import {useI18n} from './i18n';
GlobalWorkerOptions.workerSrc=workerUrl;

function PdfPage({pdf,page,width,ratio}:{pdf:PDFDocumentProxy;page:StudyPage;width:number;ratio:number}) {
 const {t}=useI18n();
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 const [visible,setVisible]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{root:root.current?.closest('.continuous-reader'),rootMargin:'700px'});if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[]);

 useEffect(()=>{
  if(!visible||!width)return;
  let live=true;let task:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;
  void pdf.getPage(page.page).then(p=>{if(!live||!canvas.current)return;const viewport=p.getViewport({scale:width/p.getViewport({scale:1}).width});const output=Math.min(devicePixelRatio||1,2);const target=canvas.current;target.width=Math.floor(viewport.width*output);target.height=Math.floor(viewport.height*output);task=p.render({canvas:target,viewport,transform:[output,0,0,output,0,0]});return task.promise;}).catch(e=>{if(live&&e?.name!=='RenderingCancelledException')setError(true);});
  return()=>{live=false;task?.cancel();const target=canvas.current;if(target){target.width=0;target.height=0;}};
 },[pdf,page.page,width,visible]);
 return <div ref={root}><div className="continuous-pdf-surface" style={{aspectRatio:ratio}}>{error?<p>{t('页面预览失败，可查看下方文字或下载原文件。')}</p>:<canvas ref={canvas} role="img" aria-label={t('第 {page} 页',{page:page.page})}/>}</div><details className="continuous-source-text"><summary>{t('查看本页提取文字')}</summary><p>{page.text||t('这一页没有可提取的文字，请下载原件查看图示。')}</p></details></div>;
}

export default function ContinuousCourseReader({url,pdf:usePdf,pages,currentPage,onPageChange}:{url:string;pdf:boolean;pages:StudyPage[];currentPage:number;onPageChange:(page:number)=>void}) {
 const {t}=useI18n();const root=useRef<HTMLDivElement>(null),visiblePage=useRef(currentPage),callback=useRef(onPageChange);callback.current=onPageChange;
 const [ratios,setRatios]=useState<Record<number,number>>({});
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(''),[width,setWidth]=useState(0);
 const ready=!usePdf||!!pdf||!!error;
 useEffect(()=>{if(!usePdf||!url)return;let live=true;setPdf(null);setError('');const task=getDocument({url});void task.promise.then(async doc=>{const sizes=await Promise.all(pages.map(async page=>{const p=await doc.getPage(page.page);const v=p.getViewport({scale:1});return [page.page,v.width/v.height];}));if(live){setRatios(Object.fromEntries(sizes));setPdf(doc);}}).catch(()=>{if(live)setError(t('PDF 预览加载失败，已显示提取文字；你也可以下载原文件。'));});return()=>{live=false;void task.destroy();};},[url,usePdf,t,pages]);
 useEffect(()=>{if(!root.current)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(0,Math.floor(entries[0].contentRect.width-32))));observer.observe(root.current);return()=>observer.disconnect();},[]);
 function jump(page:number){const target=root.current?.querySelector<HTMLElement>(`[data-source-page="${page}"]`);if(target&&root.current){visiblePage.current=page;root.current.scrollTop=Math.max(0,target.offsetTop-16);}}
 const initialPositioned=useRef(false),lastWidth=useRef(0);
 useEffect(()=>{if(!ready)return;const frame=requestAnimationFrame(()=>{if(!initialPositioned.current||lastWidth.current!==width||visiblePage.current!==currentPage){jump(currentPage);initialPositioned.current=true;lastWidth.current=width;}});return()=>cancelAnimationFrame(frame);},[ready,currentPage,width]);
 function scrolled(){if(!root.current||!ready)return;const bounds=root.current.getBoundingClientRect();const marker=bounds.top+Math.min(150,bounds.height*.25);const elements=[...root.current.querySelectorAll<HTMLElement>('[data-source-page]')];const target=elements.find(e=>{const r=e.getBoundingClientRect();return r.top<=marker&&r.bottom>marker;})||elements.find(e=>e.getBoundingClientRect().top>marker);const page=Number(target?.dataset.sourcePage);if(page&&page!==visiblePage.current){visiblePage.current=page;callback.current(page);}}
 return <div className="continuous-reader" ref={root} onScroll={scrolled} tabIndex={0} role="region" aria-label={t('连续课件阅读区')}>
 {error&&<p role="alert">{error}</p>}{!ready&&<p role="status">{t('正在加载课件预览…')}</p>}
 {pages.map(page=><section key={page.page} data-source-page={page.page} className="continuous-page"><header>{t('第 {page} 页',{page:page.page})}<span>{page.title}</span></header>{pdf?<PdfPage pdf={pdf} page={page} width={width} ratio={ratios[page.page]||4/3}/>:<article className="continuous-text-page"><h2>{page.title}</h2><p>{page.text||t('这一页没有可提取的文字，请下载原件查看图示。')}</p></article>}</section>)}
 </div>;
}
