// Course-scoped adaptation of Campus Skill Exchange's matching/session workflow.
// Reference and MIT notice: THIRD_PARTY_NOTICES.md. No upstream auth/admin code used.
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
class PeerError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const check=(condition,message,status)=>{if(!condition)throw new PeerError(message,status);};
const text=(value,max=160)=>{check(typeof value==='string'&&value.trim().length>0&&value.length<=max,'字段为空或超出长度限制。');return value.trim();};
const overlap=(a,b)=>a===b||a==='both'||b==='both';
const sameTopic=(a,b)=>a.courseId===b.courseId&&a.key===b.key;
export function rankPeers(me,profiles){
 if(!me?.active)return [];
 return profiles.filter(p=>p.id!==me.id&&p.active&&overlap(p.language,me.language)&&p.slot===me.slot).map(p=>{
  const learn=me.learn.filter(a=>p.teach.some(b=>sameTopic(a,b)));
  const teach=me.teach.filter(a=>p.learn.some(b=>sameTopic(a,b)));
  return {profile:p,learn,teach,score:3*(learn.length+teach.length)+(learn.length&&teach.length?2:0)};
 }).filter(m=>m.learn.length||m.teach.length).sort((a,b)=>b.score-a.score||a.profile.id.localeCompare(b.profile.id));
}
function topics(value){check(Array.isArray(value)&&value.length<=20,'每种需求最多选择 20 个知识点。');return value.map(t=>({courseId:text(t.courseId),courseCode:text(t.courseCode,40),key:text(t.key),label:text(t.label,200),materialId:typeof t.materialId==='string'?t.materialId.slice(0,160):''})).filter((t,i,a)=>a.findIndex(b=>sameTopic(t,b))===i);}
export function saveProfile(state,id,input){
 const teach=topics(input.teach),learn=topics(input.learn);check(teach.length+learn.length>0,'请至少选择一个愿意讲解或希望学习的知识点。');
 check(['zh','en','both'].includes(input.language),'请选择交流语言。');check(['weekday-day','weekday-evening','weekend'].includes(input.slot),'请选择共同可用时段。');
 const p={id,name:text(input.name,60),teach,learn,language:input.language,slot:input.slot,active:input.active!==false};state.profiles=[...state.profiles.filter(p=>p.id!==id),p];return p;
}
export function requestSession(state,actor,input){
 const me=state.profiles.find(p=>p.id===actor),match=rankPeers(me,state.profiles).find(m=>m.profile.id===input.partnerId);check(match,'当前没有相符的课程、知识点、语言或可用时段。');
 const direction=input.direction;check(['learn','teach'].includes(direction),'互助方向无效。');const topic=match[direction].find(t=>t.courseId===input.courseId&&t.key===input.topicKey);check(topic,'请选择匹配理由中列出的知识点。');
 check(!state.sessions.some(s=>[s.requesterId,s.recipientId].includes(actor)&&[s.requesterId,s.recipientId].includes(input.partnerId)&&sameTopic(s.topic,topic)&&['pending','accepted'].includes(s.status)),'这个知识点已有待处理或进行中的邀请。',409);
 const s={id:randomUUID(),requesterId:actor,recipientId:match.profile.id,teacherId:direction==='learn'?match.profile.id:actor,learnerId:direction==='learn'?actor:match.profile.id,topic,language:me.language==='both'?match.profile.language:me.language,slot:me.slot,status:'pending',createdAt:new Date().toISOString(),messages:[]};state.sessions.unshift(s);return s;
}
export function transitionSession(state,actor,input){
 const s=state.sessions.find(s=>s.id===input.sessionId);check(s,'邀请不存在。',404);check([s.requesterId,s.recipientId].includes(actor),'无权操作这次互助。',403);
 const next=input.status;const allowed=s.status==='pending'?((actor===s.recipientId&&['accepted','rejected'].includes(next))||(actor===s.requesterId&&next==='cancelled')):s.status==='accepted'&&['completed','cancelled'].includes(next);
 check(allowed,'不能执行这个状态变更。',409);s.status=next;s.updatedAt=new Date().toISOString();return s;
}
export function postMessage(state,actor,input){
 const s=state.sessions.find(s=>s.id===input.sessionId);check(s,'互助不存在。',404);check([s.requesterId,s.recipientId].includes(actor),'无权查看或发送这次交流。',403);check(s.status==='accepted','双方确认后才能交流；已结束的交流只读。',409);check(s.messages.length<200,'这次交流已达到 200 条消息上限，请结束后重新发起。');
 s.messages.push({id:randomUUID(),senderId:actor,body:text(input.body,2000),at:new Date().toISOString()});return s;
}
export function peerSnapshot(state,actor){const me=state.profiles.find(p=>p.id===actor)||null;return {actorId:actor,me,matches:rankPeers(me,state.profiles),sessions:state.sessions.filter(s=>[s.requesterId,s.recipientId].includes(actor)).map(s=>({...s,requesterName:state.profiles.find(p=>p.id===s.requesterId)?.name||'—',recipientName:state.profiles.find(p=>p.id===s.recipientId)?.name||'—'}))};}
const actors=['demo-learner','demo-helper','demo-partner'];
function seed(state,input){const topic=topics(input.topics);check(topic.length>0,'当前课程还没有可用于演示的知识点。');const first=[topic[0]],second=[topic[1]||topic[0]];for(const [id,name,teach,learn] of [['demo-learner','演示同学 A',second,first],['demo-helper','演示同学 B',first,second],['demo-partner','演示同学 C',first,[]]])saveProfile(state,id,{name,teach,learn,language:'both',slot:'weekday-evening'});}
async function body(req){check(req.headers['content-type']?.startsWith('application/json'),'需要 JSON 请求体。',415);let raw='';for await(const chunk of req){raw+=chunk;check(Buffer.byteLength(raw)<=32768,'请求内容过长。',413);}try{const value=JSON.parse(raw);check(value&&typeof value==='object'&&!Array.isArray(value),'请求结构无效。');return value;}catch(e){if(e instanceof PeerError)throw e;throw new PeerError('请求 JSON 无效。');}}
export function createPeerMiddleware({root=process.cwd()}={}){
 const directory=join(root,'data','peer-learning');
 return async(req,res,next)=>{
  const url=new URL(req.url||'/','http://localhost');if(!url.pathname.startsWith('/api/peer-learning'))return next();
  const send=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  try{
   const expected=new URL(`http://${req.headers.host}`);check(['localhost','127.0.0.1','[::1]'].includes(expected.hostname),'互助原型仅支持本机访问。',403);check(!req.socket.remoteAddress||['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress),'仅支持本机访问。',403);check(!req.headers.origin||req.headers.origin===expected.origin,'拒绝跨站请求。',403);check(req.headers['sec-fetch-site']!=='cross-site','拒绝跨站请求。',403);
   const demo=url.searchParams.get('demo')==='1';const path=url.pathname.slice('/api/peer-learning'.length)||'/';
   check((req.method==='GET'&&path==='/')||(req.method==='POST'&&['/profile','/request','/transition','/message',...(demo?['/seed','/actor']:[])].includes(path)),'互助接口不存在。',404);
   const file=join(directory,demo?'demo.json':'workspace.json');const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{version:1,tokens:{},profiles:[],sessions:[]};check(state.version===1&&Array.isArray(state.profiles)&&Array.isArray(state.sessions),'互助记录无法读取，请保留数据并检查服务。',500);
   const persist=()=>{mkdirSync(directory,{recursive:true});const temp=file+'.tmp';writeFileSync(temp,JSON.stringify(state),{mode:0o600});renameSync(temp,file);};
   const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));let token=cookies.workbench_peer;const setCookies=[];
   if(!/^[a-f0-9]{64}$/.test(token||'')){token=randomBytes(32).toString('hex');setCookies.push(`workbench_peer=${token}; Path=/api/peer-learning; HttpOnly; SameSite=Strict; Max-Age=2592000`);}
   const hash=createHash('sha256').update(token).digest('hex');let actor=demo&&actors.includes(cookies.workbench_peer_demo)?cookies.workbench_peer_demo:state.tokens[hash];if(!actor){actor=randomUUID();state.tokens[hash]=actor;persist();}
   const input=req.method==='POST'?await body(req):{};
   if(path==='/seed'){seed(state,input);actor='demo-learner';setCookies.push('workbench_peer_demo=demo-learner; Path=/api/peer-learning; HttpOnly; SameSite=Strict');}
   else if(path==='/actor'){check(actors.includes(input.actorId)&&state.profiles.some(p=>p.id===input.actorId),'请先载入演示搭档。');actor=input.actorId;setCookies.push(`workbench_peer_demo=${actor}; Path=/api/peer-learning; HttpOnly; SameSite=Strict`);}
   else if(path==='/profile')saveProfile(state,actor,input);
   else if(path==='/request')requestSession(state,actor,input);
   else if(path==='/transition')transitionSession(state,actor,input);
   else if(path==='/message')postMessage(state,actor,input);
   if(req.method==='POST')persist();if(setCookies.length)res.setHeader('Set-Cookie',setCookies);send(200,peerSnapshot(state,actor));
  }catch(e){send(e instanceof PeerError?e.status:500,{error:e instanceof PeerError?e.message:'互助服务暂时不可用，未覆盖已有记录。'});}
 };
}
