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
