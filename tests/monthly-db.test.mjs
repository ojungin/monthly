import test from 'node:test';import assert from 'node:assert/strict';import {monthlyDatabaseSummary} from '../dashboard-db.mjs';
test('월별 지표는 동일한 월과 직전 월의 원본값을 사용한다',()=>{
 const records=[{key:'report|dv|x',data:{m:{mau:{label:'MAU',unit:'명',src:{m:[['2026-09',100],['2026-10',120]]}},sales:{label:'매출',unit:'원',src:{m:[['2026-09',500],['2026-10',600]]}}}}}];
 const row=monthlyDatabaseSummary(records,'2026-10',[]).sections[0].rows.find(r=>r.label==='MAU');assert.equal(row.value,120);assert.equal(row.previous,100);
});
test('세미나는 달력 월 기준으로 완료 강의를 합산한다',()=>{
 const a=['2026-10-31',,,,,,,true,10,8,90,80],b=['2026-11-01',,,,,,,true,20,15,80,90];
 const result=monthlyDatabaseSummary([], '2026-10',[a,b]).sections[1];assert.equal(result.rows.find(r=>r.label==='완료 건수').value,1);assert.equal(result.rows.find(r=>r.label==='시청자 수 합계').value,8);
});test('진행 중인 달의 합계 지표는 전월 같은 기간과 비교하고, 기말 값은 마지막 집계일 기준을 쓴다',()=>{
 const days=(ym,n,v)=>Array.from({length:n},(_,i)=>[ym+'-'+String(i+1).padStart(2,'0'),v]);
 const records=[{key:'report|dv|2026-10-21',data:{generatedAt:'2026-10-21T00:00:00Z',m:{
  newM:{label:'신규 가입',kind:'sum',unit:'명',src:{end:'2026-10-20',m:[['2026-09',90]],d:[...days('2026-09',30,3),...days('2026-10',20,4)]}},
  total:{label:'전체 회원 (가입 누적)',kind:'level',unit:'명',src:{end:'2026-10-20',m:[['2026-09',1000]],w:[['2026-10-12',1070]]}},
  mau:{label:'MAU',kind:'avg',how:'mau',unit:'명',src:{end:'2026-10-20',m:[['2026-09',500],['2026-10',520]]}},
  earn:{label:'포인트 적립',kind:'sum',unit:'P',src:{end:'2026-10-31',m:[['2026-09',100],['2026-10',150]]}},
  sales:{label:'매출 (실적)',kind:'sum',unit:'원',src:{end:'2026-10-31',m:[['2026-10',3e8]]}},
  sem:{label:'세미나 진행',kind:'sum',unit:'건',src:{end:'2026-10-31',m:[['2026-10',3]]}}}}}];
 const s=monthlyDatabaseSummary(records,'2026-10',[]),row=k=>[...s.sections[0].rows,...s.sections[2].rows].find(r=>r.key===k);
 assert.deepEqual([row('newM').value,row('newM').previous,row('newM').basis,row('newM').through],[80,60,'same-days','2026-10-20']);
 assert.deepEqual([row('total').value,row('total').previous,row('total').group],[1070,1000,'회원']);
 assert.equal(row('mau').value,null);assert.equal(row('mau').previous,500);
 assert.deepEqual([row('earn').value,row('earn').previous,row('earn').partial],[150,100,false]);assert.ok(s.sections[2].rows.includes(row('earn')));
 assert.equal(row('sem'),undefined);assert.equal(row('sales'),undefined);assert.equal(s.packs[0].key,'report|dv|2026-10-21');assert.equal(s.sections.length,3);
});
