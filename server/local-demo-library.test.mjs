import test from 'node:test';
import assert from 'node:assert/strict';
import {selectDemoItems,serveLocalDemoLibrary} from './local-demo-library.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';

test('curation preserves the original corpus, excludes unselected IDs and can restore all',()=>{
 const manifest={items:[{id:'a',course:'hci',name:'week5.pdf'},{id:'b',course:'hci',name:'template.docx'}]};
 const before=JSON.stringify(manifest);const result=selectDemoItems(manifest,{mode:'curated',items:[{course:'hci',name:'week5.pdf',title:'Data Analysis'}]});
 assert.deepEqual(result.excludedIds,['b']);assert.equal(result.items[0].presentation.title,'Data Analysis');assert.equal(JSON.stringify(manifest),before);
 assert.equal(selectDemoItems(manifest,{mode:'all'}).items.length,2);assert.throws(()=>selectDemoItems(manifest,{mode:'invalid'}));
});
test('curated HTTP library excludes stale coursework, keeps dates unconfirmed and hides excluded file URLs',async t=>{
 const root=mkdtempSync(join(tmpdir(),'curated-library-'));mkdirSync(join(root,'config'),{recursive:true});mkdirSync(join(root,'data/local-demo-library'),{recursive:true});
 const doc={warnings:[],units:[],pages:[{page:1,title:'Source',text:'A source page.'}]};
 const manifest={revision:'1',courses:[],skipped:[],items:[{id:'lecture',course:'hci',courseId:'hci',name:'week5.pdf',file:'week5.pdf',kind:'lecture',week:5,sha256:'a',parse:{ok:true},document:doc},{id:'brief',course:'hci',courseId:'hci',name:'brief.pdf',file:'brief.pdf',kind:'coursework',sha256:'b',parse:{ok:true},document:doc},{id:'old',course:'hci',name:'old.pdf',file:'old.pdf',kind:'coursework'}]};
 writeFileSync(join(root,'data/local-demo-library/manifest.json'),JSON.stringify(manifest));writeFileSync(join(root,'config/demo-library.json'),JSON.stringify({mode:'curated',revision:'test',items:[{course:'hci',name:'week5.pdf',title:'Data Analysis',week:5},{course:'hci',name:'brief.pdf'}]}));
 const server=createServer((req,res)=>serveLocalDemoLibrary(req,res,root).catch(()=>{res.statusCode=500;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});});const url=`http://127.0.0.1:${server.address().port}`;
 const bundle=await fetch(url+'/api/study/local-library').then(r=>r.json());assert.equal(bundle.materials.length,1);assert.equal(bundle.assignments.length,1);assert.deepEqual(bundle.excludedIds,['old']);assert.equal(bundle.materials[0].title,'Data Analysis');assert.equal(bundle.materials[0].weekUnconfirmed,false);assert.equal(bundle.assignments[0].coursework.status,'draft');assert.equal(bundle.assignments[0].coursework.dueAt,'');assert.equal((await fetch(url+'/api/study/local-library/file/old')).status,404);
});
