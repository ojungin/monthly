import test from 'node:test';
import assert from 'node:assert/strict';
import {responsibilityValues,responsibilityTable,persistResponsibility} from '../team-responsibilities.mjs';
test('R&R rejects empty and oversized fields and trims saved values',()=>{
 assert.deepEqual(responsibilityValues({name:' 홍길동 ',position:' 팀장 ',duties:' 운영\n관리 '}),{name:'홍길동',position:'팀장',duties:'운영\n관리'});
 for(const key of ['name','position','duties']){
  assert.throws(()=>responsibilityValues({name:'홍길동',position:'팀장',duties:'운영',[key]:' '}));
 }
 assert.throws(()=>responsibilityValues({name:'가'.repeat(101),position:'팀장',duties:'운영'}));
});
test('PDF and read-only tables escape user input and retain multiline duties',()=>{
 const html=responsibilityTable([{name:'<img src=x>',position:'책임자',duties:'첫 업무\n<script>bad()</script>'}]);
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('첫 업무\n&lt;script&gt;'));
 assert.ok(!/<input|<textarea|<button|<script/.test(html));
});
test('members cannot mutate even if UI handlers are called directly',async()=>{
 const ctx={member:{role:'member'},get client(){throw Error('DB should not be accessed');}};
 for(const remove of [false,true])await assert.rejects(persistResponsibility(ctx,{id:'one'},remove),/관리자/);
});
test('updates and deletes use optimistic concurrency and report conflicts',async()=>{
 for(const remove of [false,true]){
  const calls=[];const q={eq:(k,v)=>{calls.push([k,v]);return q;},select:()=>q,single:async()=>({data:null,error:{message:'conflict'}})};
  const ctx={member:{role:'admin'},client:{from:table=>{assert.equal(table,'team_responsibilities');return {update:()=>q,delete:()=>q};}}};
  await assert.rejects(persistResponsibility(ctx,{id:'one',updated_at:'original',name:'이름',position:'직책',duties:'업무'},remove),/저장하지 못했습니다/);
  assert.deepEqual(calls,[['id','one'],['updated_at','original']]);
 }
});
