import test from 'node:test';import assert from 'node:assert/strict';
import {monthlyReportModel,monthlyReportBody,monthlyReportDocx,formatMetric,metricChange} from '../monthly-report.mjs';
import {validSummary,sourceBoundSchema} from '../supabase/functions/_shared/summary.mjs';
const base=()=>({month:'2026-10',created_at:'2026-11-02T01:00:00Z',author:'팀장',members:[{id:'u',name:'가상'}],reports:[{id:'r',user_id:'u',week_start:'2026-10-05',report_date:'2026-10-08',items:[{id:'t',project:'플랫폼 운영',service:'닥터빌',title:'세미나 운영',state:'진행',progress:60,result:'3건 완료'}],issues:'오류 확인',next_plan:'테스트 예정'}]});
const ai=()=>({overview:[{area:'할 일',summary:'다음 달 개선 예정임',report_ids:['r']},{area:'주요 지표',summary:'MAU 증가',report_ids:[]},{area:'한 일',summary:'세미나 3건 운영했음',report_ids:['r']}],issues:[],plans:[],metrics:[],
 done:[{category:'플랫폼 운영',topic:'세미나 운영',summary:'세미나 3건을 운영했음',details:['신청 120명','<스크립트>'],report_ids:['r']},{category:'없는 분류',topic:'기타 대응',summary:'오류 대응했음',details:[],report_ids:['r']}],
 todo:[{category:'플랫폼 운영',topic:'세미나 운영',summary:'잔여 일정 진행 예정임',details:['11월 2건 진행 예정'],report_ids:['r']}]});
test('model follows the 보고의 건 layout: title, date lines, numbered summary in area order, five sections and appendix',()=>{
 const s=base();s.ai_summary=ai();s.advisory_request='예산 검토\n- 법무 확인';const r=monthlyReportModel(s);
 assert.equal(r.title,'2026년 10월 업무 성과 보고의 건');assert.match(r.dateLine,/보고일 : 2026년 11월 2일/);assert.match(r.metaLine,/2026\.10\.01 ~ 2026\.10\.31/);
 assert.deepEqual(r.summary,['MAU 증가','세미나 3건 운영했음','다음 달 개선 예정임']);assert.equal(r.summaryTitle,'1. 보고 요약');
 assert.deepEqual(r.sections.map(x=>x.title),['2. 주요 지표','3. 한 일','4. 할 일','5. 자문 필요 사항']);
 const done=r.sections[1].body;assert.deepEqual(done.slice(0,5).map(l=>[l.t,l.text]),[['cat','[플랫폼 운영]'],['goal','1. 세미나 운영'],['p','세미나 3건을 운영했음'],['item','(1) 신청 120명'],['item','(2) <스크립트>']]);
 assert.ok(done.some(l=>l.text==='[기타]'));assert.deepEqual(r.sections[3].body.map(l=>l.text),['① 예산 검토','② 법무 확인']);
 assert.deepEqual(r.appendix.map(t=>t.title),['주요 업무 현황 (월 내 최신 보고 기준)','주간 보고 제출 현황','주간 보고 원문']);
 const html=monthlyReportBody(s);assert.ok(html.includes('&lt;스크립트&gt;'));assert.ok(!html.includes('<스크립트>'));assert.ok(html.includes('■ 1. 보고 요약'));assert.ok(html.includes('■ 참고자료'));
});
test('without a summary the report falls back to raw task states and says so; empty advisory shows 해당 없음',()=>{
 const r=monthlyReportModel(base());assert.match(r.summary[0],/주간 보고 1건\(보고자 1명\).*진행 1건/);assert.match(r.summaryNote,/요약 미생성/);
 assert.ok(r.sections[2].body.some(l=>/세미나 운영/.test(l.text)));assert.ok(r.sections[2].body.some(l=>/진행률 60%/.test(l.text)));assert.equal(r.sections[3].body[0].text,'해당 없음');
});
test('metric formatting uses 억·만 for money and points and safe comparisons',()=>{
 assert.equal(formatMetric(350000000,'원'),'3.5억원');assert.equal(formatMetric(12345678,'P'),'1,235만P');assert.equal(formatMetric(4.567,'점'),'4.57점');assert.equal(formatMetric(1234.6,'명'),'1,235명');assert.equal(formatMetric(null,'명'),'-');
 assert.deepEqual(metricChange({value:120,previous:100,unit:'명'}),{diff:'+20명',rate:'+20.0%'});assert.deepEqual(metricChange({value:5,previous:0,unit:'건'}),{diff:'+5건',rate:'-'});assert.deepEqual(metricChange({value:null,previous:3,unit:'건'}),{diff:'-',rate:'-'});
 const r=monthlyReportModel({...base(),metrics:{sections:[{rows:[{key:'newM',group:'회원',platform:'닥터빌',label:'신규 가입',kind:'sum',unit:'명',value:80,previous:60,partial:true,through:'2026-10-20',basis:'same-days'}]},{rows:[]},{rows:[]}],packs:[{platform:'닥터빌',key:'report|dv|x',generated_at:'2026-10-21T00:00:00Z'}]}});
 const sec=r.sections[0];assert.deepEqual(sec.tables[0].rows[0],['닥터빌','신규 가입','60명','80명','+20명','+33.3%','1~20일 동기간 비교']);assert.ok(sec.body.some(l=>/10\/20까지 집계된 진행 중 수치/.test(l.text)));
});
test('monthly done/todo rows require a work category and short detail list',()=>{
 assert.throws(()=>validSummary(ai(),['r']),/형식/);
 const ok=ai();ok.done[1].category='기타';assert.equal(validSummary(ok,['r']).done[1].category,'기타');
 const bad=ai();bad.done[1].category='기타';bad.todo[0].details=Array(7).fill('x');assert.throws(()=>validSummary(bad,['r']),/형식/);
 const schema=sourceBoundSchema(['r']);assert.deepEqual(schema.properties.done.items.required,['category','topic','summary','details','report_ids']);assert.equal(schema.properties.todo.items.properties.details.maxItems,6);
});
test('Word export builds an A4 document with a shaded summary box from the same model',()=>{
 const made=[];const ctor=name=>class{constructor(o){this.name=name;this.o=o;made.push(this);}};
 const D={Document:ctor('Document'),Paragraph:ctor('Paragraph'),TextRun:ctor('TextRun'),Table:ctor('Table'),TableRow:ctor('TableRow'),TableCell:ctor('TableCell'),WidthType:{PERCENTAGE:'pct'},AlignmentType:{CENTER:'c',RIGHT:'r'},ShadingType:{CLEAR:'clear'},BorderStyle:{SINGLE:'single'}};
 const s=base();s.ai_summary=ai();s.ai_summary.done[1].category='기타';const doc=monthlyReportDocx(D,s);
 assert.equal(doc.o.sections[0].properties.page.size.width,11906);assert.ok(made.some(x=>x.name==='TableCell'&&x.o.shading?.fill==='EDEDED'));
 const text=made.filter(x=>x.name==='TextRun').map(x=>x.o.text).join('|');for(const t of ['2026년 10월 업무 성과 보고의 건','■ 1. 보고 요약','3. 한 일','(1) 신청 120명','5. 자문 필요 사항','■ 참고자료'])assert.ok(text.includes(t),t);
});
