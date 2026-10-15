import test from 'node:test';import assert from 'node:assert/strict';import {navigationHTML} from '../portal.mjs';test('home and admin member management stay outside KPI and work groups',()=>{const html=navigationHTML('weekly',true);assert.match(html,/KPI 관리/);assert.match(html,/업무 관리/);for(const label of ['팀 목표 설정','개인 목표 설정','목표관리'])assert(html.includes(label));const work=html.slice(html.indexOf('<h2>업무 관리'),html.lastIndexOf('</section>'));assert(work.includes('플랫폼 회원 통계'));assert(!work.includes('팀원 관리'));assert(!work.includes('data-view="dashboard"'));assert.match(html,/data-view="weekly" class="active" aria-current="page"/);assert(!navigationHTML('dashboard',false).includes('팀원 관리'));});
test('work menus follow requested order and only managers see report generation',()=>{
 const manager=navigationHTML('weekly',true),member=navigationHTML('monthly-files',false);
 const ids=html=>[...html.slice(html.indexOf('<h2>업무 관리')).matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]).filter(x=>x!=='members');
 assert.deepEqual(ids(manager),['write','edit','weekly','files','monthly','monthly-files']);
 assert.deepEqual(ids(member),['write','edit','files','monthly-files']);
 assert.ok(member.includes('월 성과 보고서 저장소'));assert.ok(!member.includes('월 성과 보고서 생성'));
});
