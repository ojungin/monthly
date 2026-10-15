import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function reportSavedDate('),source.indexOf('function editDateSelector('));
const savedDate=new Function(fn+';return reportSavedDate;')();
test('edit calendar uses latest save date in Korea and falls back for legacy reports',()=>{
 assert.equal(savedDate({updated_at:'2026-10-14T16:30:00Z',report_date:'2026-10-12'}),'2026-10-15');
 assert.equal(savedDate({updated_at:'2026-10-16T01:00:00Z',created_at:'2026-10-14T01:00:00Z'}),'2026-10-16');
 assert.equal(savedDate({report_date:'2026-10-12',week_start:'2026-10-05'}),'2026-10-12');
 assert.equal(savedDate({week_start:'2026-10-05'}),'2026-10-05');
});
test('edit picker uses own reports and awaits editor before adding calendar',()=>{
 assert.match(source,/reports.filter\(r=>r.user_id===user.id\).sort/);
 assert.match(source,/await write\(\);if\(view!=='edit'\|\|request!==editRequest\)return/);
 assert.match(source,/id="edit-saved-date" type="date"/);
 assert.match(source,/id="edit-saved-report"/);
});
