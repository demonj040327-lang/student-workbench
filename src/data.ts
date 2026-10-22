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
  return {version:2,anchor:mondayOf(new Date()),courses:[],assignments:[],notes:[],passed:[],semester:defaultSemester};
}
// Formal app workspace: legacy demo records remain under their original keys.
const key='student-workbench-app-v1';
export function loadState(): State {
  try {
    const raw=localStorage.getItem(key);
    if(raw){const s=JSON.parse(raw) as State;if(s.version===2&&Array.isArray(s.courses)&&Array.isArray(s.assignments)&&Array.isArray(s.notes)&&Array.isArray(s.passed)&&typeof s.anchor==='string')return s;}
  } catch { /* Opening the app must remain possible if storage is unavailable. */ }
  return seedState();
}
export function persistState(state:State){localStorage.setItem(key,JSON.stringify(state));}
export type CourseMaterial = {id:string;name:string;originalPath:string;url:string;type:string};
export const courseMaterials:Record<string,CourseMaterial[]>={};
export const questions:Record<string,Question[]>={};
