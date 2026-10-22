import {isoDate, mondayOf, type Assignment, type Course, type State} from './data';

// Fictional examples live in a separate workspace and never seed personal data.
const key='student-workbench-home-examples-v1';
const courses:Course[]=[
  {id:'example-psychology',name:'认知心理学',code:'PSY',subject:'心理学',color:'#6483b5'},
  {id:'example-history',name:'世界史与史料研究',code:'HIS',subject:'人文学科',color:'#b28a5f'},
  {id:'example-statistics',name:'应用统计学',code:'STAT',subject:'数据与分析',color:'#61968b'},
  {id:'example-design',name:'交互设计',code:'DES',subject:'设计与创作',color:'#9380ad'},
];
type Example={id:string;courseId:string;title:string;start:string;due:string;done:number;steps:string[]};
const examples:Example[]=[
  {id:'example-psychology-report',courseId:'example-psychology',title:'记忆实验 · 研究报告',start:'2026-10-05',due:'2026-11-06',done:2,steps:['确定实验问题与假设','梳理相关研究','整理实验数据','撰写结果与讨论','检查引用并完成报告']},
  {id:'example-psychology-review',courseId:'example-psychology',title:'注意力研究 · 文献评述',start:'2026-11-23',due:'2027-01-08',done:0,steps:['确定评述主题','筛选与阅读文献','比较研究结论','写出核心论点','完善文献评述']},
  {id:'example-history-analysis',courseId:'example-history',title:'历史材料 · 史料分析',start:'2026-09-28',due:'2026-10-30',done:3,steps:['选择史料与背景','记录材料来源','形成分析提纲','补充论证与例证','完成分析与参考文献']},
  {id:'example-history-response',courseId:'example-history',title:'博物馆展览 · 阅读回应',start:'2026-09-23',due:'2026-10-16',done:5,steps:['阅读展览背景','记录核心主题','选择分析材料','完成阅读回应','核对与提交']},
  {id:'example-statistics-project',courseId:'example-statistics',title:'城市出行 · 数据项目',start:'2026-10-12',due:'2026-11-20',done:1,steps:['明确研究问题','清洗与检查数据','探索数据分布','完成统计分析','整理图表与报告']},
  {id:'example-design-portfolio',courseId:'example-design',title:'校园服务 · 交互作品集',start:'2026-09-28',due:'2026-12-04',done:4,steps:['梳理用户需求','绘制主要流程','制作交互原型','记录可用性反馈','完善作品集与设计说明']},
];
export function createHomeExamples(now=new Date()):State {
  const anchor=mondayOf(now);
  const day=(date:string)=>Math.round((new Date(`${date}T12:00:00`).getTime()-new Date(`${anchor}T12:00:00`).getTime())/86400000);
  const today=day(isoDate(now));
  const assignments:Assignment[]=examples.map(example=>({
    id:example.id,courseId:example.courseId,title:example.title,startsOn:example.start,due:example.due,
    category:'coursework',deadlineVerified:false,deadlineSource:'首页布局演示的虚构课程与日期，不是学校公布的作业要求。',
    brief:'这是用于展示学期时间轴、完成比例和任务交互的虚构示例，不是实际课程或 AI 分析结果。',
    steps:example.steps.map((title,i)=>({id:`${example.id}-step-${i}`,title,minutes:[25,40,30,45,20][i],done:i<example.done,blocked:false,
      day:i<example.done?Math.min(today-7+i,day(example.due)):Math.min(Math.max(today+i-example.done,day(example.start)),day(example.due)),
      source:'虚构设计示例',evidence:'用于演示步骤完成状态和作业进度'})),
  }));
  return {version:2,anchor,courses:courses.map(course=>({...course})),assignments,notes:[],passed:[],semester:{name:'2026 秋季学期 · 示例',start:'2026-09-21',end:'2027-01-15'}};
}
export function loadHomeExamples():State {
  try{const state=JSON.parse(localStorage.getItem(key)||'null') as State|null;if(state?.version===2&&Array.isArray(state.courses)&&state.courses.length===courses.length&&state.courses.every(c=>c.id.startsWith('example-'))&&Array.isArray(state.assignments)&&typeof state.anchor==='string')return state;}catch{}
  return createHomeExamples();
}
export function persistHomeExamples(state:State){localStorage.setItem(key,JSON.stringify(state));}

export function localizeHomeExamples(state:State,t:(message:string)=>string):State {
  return {...state,semester:state.semester?{...state.semester,name:t(state.semester.name)}:undefined,
    courses:state.courses.map(c=>({...c,name:t(c.name),subject:t(c.subject)})),
    assignments:state.assignments.map(a=>({...a,title:t(a.title),brief:t(a.brief),deadlineSource:a.deadlineSource?t(a.deadlineSource):undefined,steps:a.steps.map(s=>({...s,title:t(s.title),evidence:t(s.evidence),source:t(s.source)}))}))};
}
