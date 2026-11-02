import test from 'node:test';import assert from 'node:assert/strict';import {monthlySnapshot,monthlyPerformanceBody} from '../portal.mjs';
test('월 경계 보고는 작성일 기준으로 포함하며 기존 작성일 없는 보고는 주 시작일을 사용한다',()=>{
 const reports=[{id:'one',user_id:'u',week_start:'2026-10-26',report_date:'2026-11-01',status:'submitted',items:[]},{id:'two',user_id:'u',week_start:'2026-11-02',status:'submitted',items:[]},{id:'other',user_id:'u',week_start:'2026-11-30',report_date:'2026-12-01',status:'submitted',items:[]}];
 assert.deepEqual(monthlySnapshot(reports,[],'2026-11','작성자').reports.map(r=>r.id),['one','two']);
});
test('원문 펼쳐보기는 요약 누락 여부를 확인할 수 있게 보존하고 HTML을 안전하게 처리한다',()=>{
 const report={id:'one',user_id:'u',week_start:'2026-11-02',items:[{id:'t',title:'<업무>',state:'진행',progress:50,result:'성과 원문'}],issues:'이슈 원문',next_plan:'계획 원문'};
 const html=monthlyPerformanceBody({month:'2026-11',reports:[report],members:[{id:'u',name:'담당자'}],ai_summary:{done:[],todo:[]}});
 for(const text of ['성과 원문','이슈 원문','계획 원문','&lt;업무&gt;','펼쳐보기'])assert.ok(html.includes(text));assert.ok(!html.includes('<업무>'));
});