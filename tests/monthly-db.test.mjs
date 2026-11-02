import test from 'node:test';import assert from 'node:assert/strict';import {monthlyDatabaseSummary} from '../dashboard-db.mjs';
test('월별 지표는 동일한 월과 직전 월의 원본값을 사용한다',()=>{
 const records=[{key:'report|dv|x',data:{m:{mau:{label:'MAU',unit:'명',src:{m:[['2026-09',100],['2026-10',120]]}},sales:{label:'매출',unit:'원',src:{m:[['2026-09',500],['2026-10',600]]}}}}}];
 const row=monthlyDatabaseSummary(records,'2026-10',[]).sections[0].rows.find(r=>r.label==='MAU');assert.equal(row.value,120);assert.equal(row.previous,100);
});
test('세미나는 달력 월 기준으로 완료 강의를 합산한다',()=>{
 const a=['2026-10-31',,,,,,,true,10,8,90,80],b=['2026-11-01',,,,,,,true,20,15,80,90];
 const result=monthlyDatabaseSummary([], '2026-10',[a,b]).sections[1];assert.equal(result.rows.find(r=>r.label==='완료 건수').value,1);assert.equal(result.rows.find(r=>r.label==='시청자 수 합계').value,8);
});