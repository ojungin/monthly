import test from 'node:test';
import assert from 'node:assert/strict';
import {goalCatalog,weeklyGoalProgress,monthWeeks} from '../goal-management.mjs';
test('goal links remain stable for empty rows and sets with duplicate goal names',()=>{
 const goals=goalCatalog([{id:'a',user_id:'u',year:2026,rows:[{}, {personal_goal:'성장'}]},{id:'b',user_id:'v',year:2026,rows:[{personal_goal:'성장'}]}]);
 assert.deepEqual(goals.map(g=>g.id),['a:1','b:0']);
});
test('weekly milestone uses latest task, owner, submitted only, carries forward and averages linked tasks',()=>{
 const goal={id:'a:1',user_id:'u'};const report=(id,date,items,extra={})=>({id,user_id:'u',status:'submitted',week_start:date,items,...extra});
 const task=(id,progress,link='a:1')=>({id,progress,personal_goal_id:link});
 const reports=[report('1','2026-10-05',[task('x',20),task('y',40)]),report('2','2026-10-12',[task('x',60)]),report('3','2026-10-19',[task('x',100)]),report('4','2026-10-12',[task('y',100)],{status:'draft'}),report('5','2026-10-12',[task('y',100)],{user_id:'v'})];
 assert.equal(weeklyGoalProgress(goal,reports,'2026-10-12').progress,50);
 assert.equal(weeklyGoalProgress(goal,reports,'2026-10-12').count,2);
 assert.equal(weeklyGoalProgress(goal,reports,'2026-10-26').reported,false);
 assert.equal(weeklyGoalProgress(goal,reports,'2026-10-26').progress,70);
 assert.equal(weeklyGoalProgress(goal,reports,'2026-09-28'),null);
 // Changing a task's linked goal must remove its obsolete association.
 reports.push(report('6','2026-10-12',[task('y',40,'other')]));
 reports[5].updated_at='2026-10-13';
 assert.equal(weeklyGoalProgress(goal,reports,'2026-10-12').count,1);
});
test('month milestone columns include month boundary weeks',()=>{
 assert.deepEqual(monthWeeks('2026-10'),['2026-09-28','2026-10-05','2026-10-12','2026-10-19','2026-10-26']);
 assert.equal(monthWeeks('2027-02').length,4);
});

import {periodWeeks,monthGroups,assertMilestoneExport,milestoneExportRows} from '../goal-management.mjs';
test('year and quarter periods cover boundary weeks without duplicate annual columns',()=>{
 const year=periodWeeks(2026);assert.equal(year.length,53);assert.equal(year[0].date,'2025-12-29');assert.equal(year.at(-1).date,'2026-12-28');assert.equal(new Set(year.map(w=>w.date)).size,year.length);
 assert.equal(monthGroups(year).reduce((n,g)=>n+g.count,0),year.length);assert.equal(monthGroups(year).length,12);
 const q=periodWeeks(2026,'2');assert.equal(q[0].date,'2026-03-30');assert.equal(q[0].month,'2026-04');assert.equal(q[0].label,'1주');assert.equal(q.at(-1).date,'2026-06-29');
 assert.throws(()=>periodWeeks(2026,'5'));assert.throws(()=>periodWeeks(0));
});
test('Excel extraction requires a manager and exports typed percentages with future weeks blank',()=>{
 assert.throws(()=>assertMilestoneExport({role:'member'}),/관리자/);assert.doesNotThrow(()=>assertMilestoneExport({role:'admin'}));
 const row={id:'a:0',user_id:'u',strategy_id:'s',personal_goal:'목표',target_date:'2026-12-01'};
 const reports=[{id:'r',user_id:'u',status:'submitted',week_start:'2026-10-05',items:[{id:'t',personal_goal_id:'a:0',progress:50}]}];
 const output=milestoneExportRows([row],[{date:'2026-10-05'},{date:'2026-10-12'},{date:'2026-10-19'}],reports,'2026-10-14',[{id:'g',business_goal:'부서',team_goal:'팀'}],[{id:'s',goal_id:'g',period:'하반기',strategy:'계획'}],[{id:'u',name:'팀원'}]);
 assert.deepEqual(output[0],['부서','팀','하반기 · 계획','목표','팀원','2026-12-01','',0.5,0.5,null]);
});

import {linkedGoalTasksText} from '../goal-management.mjs';
test('linked task column uses latest submitted owner tasks as of selected period and excludes future reports',()=>{
 const goal={id:'a:0',user_id:'u'},task=(title,id='t',link='a:0')=>({id,title,progress:50,personal_goal_id:link});
 const report=(date,items,extra={})=>({id:date,user_id:'u',status:'submitted',week_start:date,items,...extra});
 const reports=[report('2026-04-06',[task('old')]),report('2026-06-29',[task('<updated>'),task('second','t2')]),report('2026-07-06',[task('future')]),report('2026-06-29',[task('draft')],{status:'draft'}),report('2026-06-29',[task('other owner')],{user_id:'v'})];
 assert.equal(linkedGoalTasksText(goal,reports,[{date:'2026-06-29'}],'2026-10-15'),'<updated>\nsecond');
 assert.equal(linkedGoalTasksText(goal,reports,[{date:'2026-12-28'}],'2026-06-30'),'<updated>\nsecond');
 assert.equal(linkedGoalTasksText({id:'none',user_id:'u'},reports,[{date:'2026-06-29'}],'2026-10-15'),'');
 const data=milestoneExportRows([goal],[{date:'2026-06-29'}],reports,'2026-10-15',[],[],[]);
 assert.equal(data[0][6],'<updated>\nsecond');assert.equal(data[0][7],0.5);
});
