import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {activityMetrics,seminarMetrics,pointMetrics,emptyMetrics,numberValue,isoWeek,displayMetric} from '../metrics.mjs';
import {weeklyBody} from '../weekly.mjs';
test('browser code has valid JavaScript syntax',()=>{for(const path of ['app.js','metrics.mjs','weekly.mjs','excel.mjs','portal.mjs'])execFileSync(process.execPath,['--check',path]);});
test('missing values remain distinct from zero and weeks cross year boundaries',()=>{
 assert.equal(numberValue(''),null);assert.equal(numberValue('0'),0);assert.equal(numberValue('1,000명'),1000);
 assert.equal(displayMetric({value:null}),'자료 미확인');assert.equal(isoWeek('2025-12-29'),'2026-W01');
});
test('activity uses latest all-device row and never sums device users',()=>{
 const data={weekly:{cols:['주 시작일(월)','기기','WAU','조회수'],rows:[['2026-10-05','전체',100,400],['2026-10-05','PC',80,200],['2026-10-05','MO',60,200],['2026-10-05','전체',110,410],['2026-09-28','전체',90,300]]}};
 const result=activityMetrics(data,'2026-10-05');assert.equal(result.rows[0].value,110);assert.equal(result.rows[0].previous,90);
 assert.equal(activityMetrics(data,'2026-10-12').rows.length,0);
});
test('seminar counts use exact week, completed sessions and nonempty score averages',()=>{
 const row=(date,done,signup,view,score)=>[date,'','','','','','',done,signup,view,score,''];
 const result=seminarMetrics([row('2026. 10. 5',true,'1,000명',800,90),row('2026. 10. 6',true,200,100,''),row('2026. 10. 7',false,900,800,100),row('2026. 10. 12',true,600,500,100)],'2026-10-05');
 assert.equal(result.rows[0].value,3);assert.equal(result.rows[1].value,2);assert.equal(result.rows[2].value,1200);assert.equal(result.rows[4].value,90);
});
test('points are labeled monthly and never taken from another month',()=>{
 const source={months:['2026-10'],range:{to:'2026-10-07'},earn:{amt:[100]},use:{amt:[30]},balance:[70],balanceChg:[20],balanceTotal:[90]};
 const p=pointMetrics(source,'2026-10-05');assert.equal(p.rows[0].value,100);assert.match(p.period,/2026-10-01 ~ 2026-10-07 \(월 집계\)/);
 assert.equal(pointMetrics(source,'2026-09-28').rows.length,0);
});
test('weekly body includes numbered sections and escapes manually entered text',()=>{
 const s={week:'2026-10-05',created_at:'2026-10-07T00:00:00Z',author:'test',members:[],reports:[],metrics:emptyMetrics('2026-10-05')};
 s.metrics.sections[0].rows=[{label:'<script>',value:0,unit:'명'}];
 const html=weeklyBody(s);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));let last=-1;
 for(const title of ['0. 기간','1. 주요 지표','2. 비학술 세미나','3. 포인트','4. 주간 업무','5. 이슈','6. 다음주']){const pos=html.indexOf(title);assert(pos>last);last=pos;}
});
