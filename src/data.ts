import { courses, coursePlans } from './courseContent';
import {courseworkDefaults} from './courseworkData';
export { questions, courseMaterials } from './courseContent';
export type Course = { id: string; name: string; subject: string; code: string; color: string; materialName?: string; topic?: string };
export type Step = { id: string; title: string; minutes: number; day: number; done: boolean; blocked: boolean; evidence: string; source: string };
export type Assignment = { id: string; courseId: string; title: string; due: string; steps: Step[]; brief: string; planOnly?: boolean; category?:'coursework'|'review'; deadlineVerified?:boolean; deadlineSource?:string; deadlineLabel?:string; originalDue?:string; startsOn?:string; gradeWeight?:number; briefUrl?:string; briefPage?:number };
export type Semester = {name:string;start:string;end:string};
export const defaultSemester:Semester={name:'2026 秋季学期',start:'2026-09-21',end:'2026-12-21'};
export type Note = { id: string; courseId: string; text: string; createdAt: string };
export type State = { version: 2; anchor: string; courses: Course[]; assignments: Assignment[]; notes: Note[]; passed: string[]; semester?:Semester; courseworkSeedVersion?:number };
export type Question = { id: string; title: string; prompt: string; options: string[]; answer: number; explanation: string; source: string; excerpt: string; minutes: number; sourceId?: string; sourcePage?: number };
export const courseColors = ['#7a875e', '#5f8195', '#a47756', '#85719a', '#948346'];
export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function shiftDate(date: string, days: number) {
  const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return isoDate(d);
}
export function mondayOf(date: Date) {
  const d=new Date(date);d.setDate(d.getDate()-(d.getDay()+6)%7);return isoDate(d);
}
export function seedState(): State {
  const anchor=mondayOf(new Date());
  return {
    version:2,anchor,courses:courses.map(c=>({...c})),notes:[],passed:[],
    assignments:courses.map((c,i)=>{
      const plan=coursePlans[c.id];
      return {id:`${c.id}-review`,courseId:c.id,title:plan.title,brief:plan.brief,due:shiftDate(anchor,5+i*2),planOnly:true,category:'review',
        steps:plan.steps.map((s,j)=>({...s,id:`${c.id}-step-${j}`,day:[0,2,3,4][j] ?? 4,done:j===0&&i<2,blocked:false}))};
    })
  };
}
function withSemesterWork(state:State):State {
  if(state.courseworkSeedVersion===1)return {...state,semester:state.semester || defaultSemester};
  const present=new Set(state.assignments.map(a=>a.id));
  const courseIds=new Set(state.courses.map(c=>c.id));
  const today=isoDate(new Date());
  const currentDay=Math.round((new Date(`${today}T12:00:00`).getTime()-new Date(`${state.anchor}T12:00:00`).getTime())/86400000);
  const additions:Assignment[]=courseworkDefaults.filter(a=>courseIds.has(a.courseId)&&!present.has(a.id)).map(a=>{
    const finalDay=a.due?Math.round((new Date(`${a.due}T12:00:00`).getTime()-new Date(`${state.anchor}T12:00:00`).getTime())/86400000):currentDay+a.requirements.length*7;
    return {id:a.id,courseId:a.courseId,title:a.title,due:a.due,originalDue:a.originalDue,deadlineVerified:a.deadlineVerified,deadlineSource:a.deadlineSource,deadlineLabel:a.deadlineLabel,gradeWeight:a.gradeWeight ?? undefined,briefUrl:a.briefUrl,briefPage:a.briefPage,brief:a.brief,category:'coursework',planOnly:false,
      steps:a.requirements.map((title,i)=>({id:`${a.id}-step-${i}`,title,minutes:30,day:Math.min(currentDay+i*7,finalDay),done:false,blocked:false,evidence:'由本人核对已完成的产出',source:a.deadlineSource}))};
  });
  return {...state,semester:state.semester || defaultSemester,courseworkSeedVersion:1,assignments:[...state.assignments.map(a=>({...a,category:a.category || (a.planOnly?'review' as const:'coursework' as const)})),...additions]};
}
const key='student-workbench-v2-real-courses';
export function loadState(): State {
  try {
    const raw=localStorage.getItem(key);
    if(raw){const s=JSON.parse(raw) as State;if(s.version===2&&Array.isArray(s.courses)&&s.courses.length>0&&Array.isArray(s.assignments)&&Array.isArray(s.notes)&&Array.isArray(s.passed)&&typeof s.anchor==='string')return withSemesterWork(s);}
  } catch { /* A storage failure must not prevent opening the prototype. */ }
  return withSemesterWork(seedState());
}
export function persistState(state:State){localStorage.setItem(key,JSON.stringify(state));}
