import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {weeklyExcelLayout,splitExcelText} from '../excel.mjs';import {emptyMetrics} from '../metrics.mjs';import {weeklyBody} from '../weekly.mjs';import {documentHTML} from '../portal.mjs';
const fixture=()=>{const metrics=emptyMetrics('2026-10-05');metrics.fetched_at='FETCH_TIMESTAMP';metrics.sections[0]={...metrics.sections[0],rows:[{label:'전체 회원',platform:'닥터빌',value:2000,previous:1900,unit:'명'}],note:'METRIC_METHOD_NOTE',platform_notes:{'닥터빌':'DATABASE_TIMESTAMP'}};return {week:'2026-10-05',created_at:'2026-10-10',author:'작성자',members:[{id:'u',name:'담당자',team:'팀'}],metrics,reports:[{user_id:'u',week_start:'2026-10-05',status:'submitted',items:[{id:'task',project:'운영',service:'공통',title:'주요 업무',state:'진행',target_date:'2026-10-20',progress:75,result:'주요 성과에 기록된 출처: 이 문장은 유지'}],issues:'이슈 원문',next_plan:'다음주 원문'}],ai_summary:{issues:[{topic:'이슈',summary:'요약 내용'}],plans:[{topic:'계획',summary:'계획 내용'}]}};};
test('Excel layout follows the 13-column template and preserves typed metric/date/progress values',()=>{
 const s=fixture(),layout=weeklyExcelLayout(s);assert.equal(layout.rows[0].row,5);assert.equal(layout.rows[0].cells[0].from,2);assert.equal(layout.rows[0].cells[0].to,14);
 const metric=layout.rows.find(r=>r.cells[0]?.value==='전체 회원');assert.deepEqual(metric.cells.map(c=>[c.from,c.to]),[[2,4],[5,6],[7,7],[8,14]]);assert.equal(metric.cells[1].value,1900);assert.equal(metric.cells[2].value,2000);
 const task=layout.rows.find(r=>r.cells[1]?.value==='주요 업무');assert.equal(task.cells[6].from,8);assert.equal(task.cells[6].to,12);assert.ok(task.cells[3].value instanceof Date);assert.equal(task.cells[4].value,.75);
 const text=JSON.stringify(layout);assert.ok(!text.includes('METRIC_METHOD_NOTE'));assert.ok(!text.includes('DATABASE_TIMESTAMP'));assert.ok(!text.includes('FETCH_TIMESTAMP'));assert.ok(!text.includes('https://'));assert.ok(text.includes('요약 내용'));assert.ok(text.includes('이슈 원문'));
});
test('long cell text splits into continuation rows without dropping content',()=>{
 const long=('긴 업무 성과와 숫자 123\n').repeat(150),chunks=splitExcelText(long,40);assert.ok(chunks.length>1);assert.equal(chunks.join(''),long);
 const s=fixture();s.reports[0].items[0].result=long;const layout=weeklyExcelLayout(s);const pieces=layout.rows.flatMap(r=>r.cells.filter(c=>c.from===8&&c.to===12&&typeof c.value==='string'&&c.value.includes('긴 업무')).map(c=>c.value));assert.equal(pieces.join(''),long);assert.ok(layout.rows.every(r=>r.height<=409.5));
});
test('screen and HTML retain metric notes/sources; print options remove metadata without stripping task text',()=>{
 const s=fixture(),screen=weeklyBody(s),html=documentHTML(s,'weekly'),print=documentHTML(s,'weekly',{includeMetricMetadata:false});
 for(const text of ['METRIC_METHOD_NOTE','DATABASE_TIMESTAMP','FETCH_TIMESTAMP','href="https://ojungin.github.io/doctorville_dash/"']){assert.ok(screen.includes(text));assert.ok(html.includes(text));assert.ok(!print.includes(text));}
 assert.ok(print.includes('주요 성과에 기록된 출처: 이 문장은 유지'));assert.ok(print.includes('집계 기간: 2026-10-05'));assert.ok(print.includes('전체 회원'));
});
test('Word and PDF request the print-only view while HTML keeps the default view',async()=>{
 const source=await readFile(new URL('../portal.mjs',import.meta.url),'utf8');assert.ok(source.includes("documentHTML(s,kind,{includeMetricMetadata:false})"));assert.ok(source.includes('host.innerHTML=documentBody(s,kind,{includeMetricMetadata:false})'));assert.ok(source.includes("new Blob([documentHTML(s,kind)]"));
});
