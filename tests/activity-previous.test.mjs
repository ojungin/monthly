import test from 'node:test';
import assert from 'node:assert/strict';
import {activityMetrics,activityWeek} from '../metrics.mjs';
import {databaseSummary} from '../dashboard-db.mjs';
test('activity dates and ISO weeks match exact previous week across year boundaries',()=>{
 for(const value of ['2026. 10. 12.','2026/10/12','2026-10-12T00:00:00+09:00','2026-W42'])assert.equal(activityWeek(value),'2026-10-12');
 assert.equal(activityWeek('2026-W01'),'2025-12-29');assert.equal(activityWeek('2026-02-31'),'');
 const part=activityMetrics({weekly:{cols:['주 시작일(월)','기기','WAU','MAU (YTD)'],rows:[['2026. 10. 5.','전체',20,0],['2026-10-12','전체',30,40],['2026-10-05','PC',999,999]]}},'2026-10-12');
 assert.equal(part.rows[0].previous,20);assert.equal(part.rows[1].previous,0);
});
test('page activity compares matching page, not row order or current-week rank',()=>{
 const data={pageWeekly:{cols:['주 시작일(월)','페이지그룹','조회수'],rows:[['2026-10-05','B',90],['2026/10/5','A',10],['2026-10-12','A',100],['2026-10-12','B',0],['2026-10-12','C',5]]}};
 const rows=activityMetrics(data,'2026-10-12').rows;
 assert.equal(rows.find(r=>r.label.endsWith('A')).previous,10);assert.equal(rows.find(r=>r.label.endsWith('B')).previous,90);
 assert.equal(rows.find(r=>r.label.endsWith('C')).previous,null);
});
test('gaps and missing totals do not borrow other weeks or sum PC/MO users',()=>{
 const data={weekly:{cols:['주차','구분','WAU'],rows:[['2026-W40','전체',10],['2026-W41','PC',20],['2026-W41','MO',30],['2026-W42','전체',40]]}};
 assert.equal(activityMetrics(data,'2026-10-12').rows[0].previous,null);
});
test('Dashboard DB retains Pharmville weekly and page data when normalizing week formats',()=>{
 const summary=databaseSummary([{key:'file|data/pv_activity.enc.json',fetched_at:'2026-10-19',data:{weekly:{cols:['주차','구분','WAU'],rows:[['2026-W41','전체',70],['2026-W42','전체',80]]},pageWeekly:{cols:['주차','페이지그룹','조회수'],rows:[['2026-W41','메인',50],['2026-W42','메인',60]]}}}],'2026-10-12');
 const rows=summary.sections[0].rows.filter(r=>r.platform==='팜빌');
 assert.equal(rows.find(r=>r.label==='WAU').previous,70);
 assert.equal(rows.find(r=>r.label==='페이지 조회수 · 메인').previous,50);
});
