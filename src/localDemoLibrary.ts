import {readCampusMaterials,writeCampusMaterial,deleteCampusMaterial,type CampusCourse,type CampusData,type CampusMaterial} from './campusStore';
import type {Assignment} from './data';
type LibraryItem={libraryVersion:string};
type LibraryBundle={courses:CampusCourse[];assignments:Assignment[];excludedIds?:string[]};
export async function importLocalDemoLibrary():Promise<LibraryBundle|null> {
 const response=await fetch('/api/study/local-library');if(response.status===404)return null;if(!response.ok)throw Error('本机课程资料库读取失败。');
 const bundle=await response.json() as {excludedIds?:string[];courses:CampusCourse[];materials:(CampusMaterial&LibraryItem)[];assignments:(Assignment&LibraryItem)[]};
 const markerKey='workbench-local-library-import-v1';const versions:Record<string,string>=JSON.parse(localStorage.getItem(markerKey)||'{}');
 const initial=await readCampusMaterials(true);
 const removed=new Set([...(bundle.excludedIds||[]),...initial.filter(m=>m.id.startsWith('campus-example-material-')).map(m=>m.id)]);
 for(const id of removed)await deleteCampusMaterial(true,id);
 const existing=await readCampusMaterials(true);let changed=initial.some(m=>removed.has(m.id));
 for(const material of bundle.materials){if(versions[material.id]!==material.libraryVersion||!existing.some(m=>m.id===material.id)){await writeCampusMaterial(true,material);versions[material.id]=material.libraryVersion;changed=true;}}
 const assignments=bundle.assignments;
 for(const a of assignments)versions[a.id]=a.libraryVersion;
 localStorage.setItem(markerKey,JSON.stringify(versions));if(changed&&typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('workbench-campus-demo');channel.postMessage('library-imported');channel.close();}
 return {courses:bundle.courses,assignments,excludedIds:bundle.excludedIds};
}
export function mergeLocalDemoLibrary(data:CampusData,bundle:LibraryBundle):CampusData {
 const seeds=new Set(['campus-hci','campus-ml','campus-history','campus-policy']);
 const courses=data.courses.filter(c=>!seeds.has(c.id));
 const replacements=new Map(bundle.assignments.filter(a=>{const old=data.assignments.find(v=>v.id===a.id) as (Assignment&Partial<LibraryItem>)|undefined;return !old||old.libraryVersion!==(a as Assignment&LibraryItem).libraryVersion;}).map(a=>[a.id,a]));
 return {...data,courses:[...courses,...bundle.courses.filter(c=>!courses.some(old=>old.id===c.id))],assignments:[...data.assignments.filter(a=>!seeds.has(a.courseId)&&!(bundle.excludedIds||[]).includes(a.id)&&!replacements.has(a.id)),...replacements.values()]};
}
