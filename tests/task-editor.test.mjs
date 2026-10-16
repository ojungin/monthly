import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const extract=name=>source.slice(source.indexOf('function '+name+'('),source.indexOf('\nfunction ',source.indexOf('function '+name+'(')+1));
test('loading an existing task replaces one row, preserves identity and does not mutate history',()=>{
 const ctx=vm.createContext({structuredClone});vm.runInContext(extract('loadedTaskValues'),ctx);
 const original={id:'task-1',sourceWeek:'2026-10-05',title:'성과 확인',project:'운영',service:'공통',personal_goal_id:'g1',progress:50,result:'기존 성과'};
 const rows=[{id:'blank'},{id:'task-2',title:'보존할 업무'}];
 const loaded=ctx.loadedTaskValues([original],'task-1',rows,0);
 assert.equal(loaded.id,'task-1');assert.equal(loaded.personal_goal_id,'g1');assert.equal(loaded.progress,50);assert.ok(!('sourceWeek' in loaded));
 loaded.result='이번 주 성과';assert.equal(original.result,'기존 성과');assert.equal(rows[1].title,'보존할 업무');
 assert.throws(()=>ctx.loadedTaskValues([original],'task-1',[{id:'blank'},{id:'task-1'}],0),/이미 다른 입력란/);
 assert.throws(()=>ctx.loadedTaskValues([],'other',rows,0),/찾지 못했습니다/);
});
test('task catalog only returns own tasks and uses newest instance per ID',()=>{
 const ctx=vm.createContext({reports:[
  {id:'r1',user_id:'me',week_start:'2026-10-05',items:[{id:'task',title:'old'}]},
  {id:'r2',user_id:'other',week_start:'2026-10-12',items:[{id:'private',title:'다른 팀원'}]},
  {id:'r3',user_id:'me',week_start:'2026-10-12',items:[{id:'task',title:'new'}]}
 ],itemId:(r,i)=>i.id});
 vm.runInContext(extract('taskCatalog'),ctx);
 assert.equal(ctx.taskCatalog('me').length,1);assert.equal(ctx.taskCatalog('me')[0].title,'new');
});
