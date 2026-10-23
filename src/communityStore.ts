import {useEffect,useState} from 'react';
import type {CampusMaterial,StudentProgress} from './campusStore';
export type Discussion={id:string;courseId:string;title:string;body:string;createdAt:string;replies:{id:string;body:string;createdAt:string}[]};
export type Activity={studentId:string;materialId:string;version:string;viewedAt:string;answered:string[]};
type Community={discussions:Discussion[];activity:Activity[]};
const key=(demo:boolean)=>`workbench-community-${demo?'demo':'personal'}-v1`;
const event='workbench-community-change';
export function readCommunity(demo:boolean):Community {
 const raw=localStorage.getItem(key(demo));if(!raw)return {discussions:[],activity:[]};
 const value=JSON.parse(raw);if(!Array.isArray(value.discussions)||!Array.isArray(value.activity))throw Error('Invalid community data');return value;
}
export function changeCommunity(demo:boolean,update:(value:Community)=>Community) {
 const next=update(readCommunity(demo));localStorage.setItem(key(demo),JSON.stringify(next));window.dispatchEvent(new Event(event));
}
export function useCommunity(demo:boolean) {
 const [state,setState]=useState<Community>({discussions:[],activity:[]});const [error,setError]=useState(false);
 useEffect(()=>{const sync=()=>{try{setState(readCommunity(demo));setError(false);}catch{setError(true);}};sync();window.addEventListener(event,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(event,sync);window.removeEventListener('storage',sync);};},[demo]);
 return {...state,error};
}
export function materialVersion(m:CampusMaterial) {
 let hash=2166136261;const text=JSON.stringify([m.document.id,m.document.units]);for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return String(hash>>>0);
}
export function recordActivity(demo:boolean,m:CampusMaterial,p:StudentProgress) {
 const identityKey=key(demo)+'-student';let studentId=localStorage.getItem(identityKey);if(!studentId){studentId=crypto.randomUUID();localStorage.setItem(identityKey,studentId);}
 const version=materialVersion(m),answered=m.document.units.flatMap(u=>u.questions).filter(q=>p.answers[q.id]?.checked).map(q=>q.id);
 changeCommunity(demo,value=>{
  const previous=value.activity.find(a=>a.studentId===studentId&&a.materialId===m.id&&a.version===version);
  const record={studentId:studentId!,materialId:m.id,version,viewedAt:previous?.viewedAt||new Date().toISOString(),answered};
  return {...value,activity:[...value.activity.filter(a=>!(a.studentId===studentId&&a.materialId===m.id&&a.version===version)),record]};
 });
}
