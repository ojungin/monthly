import test from 'node:test';import assert from 'node:assert/strict';import {seminarRowsFromTable,seminarMetrics,metricsBody,emptyMetrics} from '../metrics.mjs';
const headers=['월','key','구분','일자',' 대분류',' 소분류',' 편성',' 소속',' 연자',' 강의명','완료','신청자 수','시청자 수','만족도','유용도','','메모','','팜빌 신청자 수','시청자 수'];
const table=rows=>({status:'ok',table:{cols:headers.map(label=>({label})),rows:rows.map(values=>({c:values.map(v=>({v}))}))}});
const make=(date,title,speaker,done,signup,views,satisfaction,usefulness,pvSignup='',pvViews='')=>['10월','','',date,'','','','',speaker,title,done,signup,views,satisfaction,usefulness,'','','',pvSignup,pvViews];
test('real raw column layout resolves lecture/speaker plus all six detail fields and previous-week aggregates',()=>{
 const rows=seminarRowsFromTable(table([
 make('Date(2026,9,8)','이전 강의','이전 연자',true,'3,437명','2,415명','86점','85점'),
 make('Date(2026,9,12)','현재 강의','현재 연자',true,'3,916명','2,314명','88점','90점'),
 make('Date(2026,9,15)','예정 강의','예정 연자',false,'','','','')
 ]));
 const part=seminarMetrics(rows,'2026-10-12');
 assert.deepEqual(part.detail_headers,['강의명','연자명','신청자 수','시청자 수','만족도','유용도']);
 assert.deepEqual(part.detail_rows,[['현재 강의','현재 연자',3916,2314,88,90]]);
 const metric=label=>part.rows.find(r=>r.platform==='닥터빌'&&r.label===label);
 assert.equal(metric('편성 건수').value,2);assert.equal(metric('완료 건수').value,1);
 assert.equal(metric('신청자 수 합계').value,3916);assert.equal(metric('신청자 수 합계').previous,3437);
 assert.equal(metric('평균 만족도').value,88);assert.equal(metric('평균 유용도').value,90);
});
test('column reordering and duplicate viewer header keep platforms isolated and zero scores valid',()=>{
 const raw=table([make('2026. 10. 12','<강의>','연자',true,100,80,0,'-',20,10)]);
 const order=[19,9,18,3,8,10,11,12,13,14,0,1,2,4,5,6,7,15,16,17];
 const shuffled={status:'ok',table:{cols:order.map(i=>raw.table.cols[i]),rows:raw.table.rows.map(row=>({c:order.map(i=>row.c[i])}))}};
 // Duplicate unqualified viewer headings need the original Raw adjacency;
 // platform-qualified headings remain unambiguous even after reordering.
 shuffled.table.cols[0].label='팜빌 시청자 수';
 const part=seminarMetrics(seminarRowsFromTable(shuffled),'2026-10-12');
 const pv=part.platform_details.find(p=>p.platform==='팜빌');
 assert.deepEqual(part.detail_rows[0],['<강의>','연자',100,80,0,'미입력']);
 assert.deepEqual(pv.detail_rows[0],['<강의>','연자',20,10,'미입력','미입력']);
 const summary=emptyMetrics('2026-10-12');summary.sections[1]=part;
 const html=metricsBody({week:'2026-10-12',metrics:summary});assert.ok(html.includes('&lt;강의&gt;'));assert.ok(!html.includes('<강의>'));
});
test('raw S/T viewer metrics do not overwrite Doctorville M column',()=>{
 const part=seminarMetrics(seminarRowsFromTable(table([make('2026. 10. 12','강의','연자',true,100,80,90,89,20,10)])),'2026-10-12');
 assert.equal(part.detail_rows[0][3],80);assert.equal(part.platform_details[1].detail_rows[0][3],10);
});
