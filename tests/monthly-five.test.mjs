import test from 'node:test';import assert from 'node:assert/strict';import {monthlyPerformanceBody} from '../portal.mjs';
test('월간 지표는 통합 통계에 정의된 지표를 그룹별 표로 전월·당월·증감·증감률과 함께 표시',()=>{
 const rows=[{key:'total',group:'회원',platform:'닥터빌',label:'전체 회원 (가입 누적)',previous:100,value:120,unit:'명',kind:'level'},{key:'wau',group:'활동성',platform:'닥터빌',label:'WAU (주 평균)',previous:20,value:30,unit:'명',kind:'avg'},{key:'use',group:'포인트',platform:'팜빌',label:'포인트 사용',previous:2e7,value:1.5e7,unit:'P',kind:'sum'}];
 const html=monthlyPerformanceBody({month:'2026-10',reports:[],members:[],metrics:{sections:[{rows:rows.slice(0,2)},{rows:[]},{rows:rows.slice(2)}]},ai_summary:{overview:[],done:[],todo:[]}});
 for(const t of ['① 회원','② 활동성','③ 포인트','<th>9월</th>','<th>10월</th>','100명','120명','+20명','+20.0%','WAU (주 평균)','+50.0%','2,000만P','1,500만P','-500만P','-25.0%'])assert.ok(html.includes(t),t);
 assert.ok(!html.includes('<svg'));
});
