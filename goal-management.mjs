import {escapeHTML as e,monday} from './core.mjs';
export const goalKey=(set,index)=>set.id+':'+index;
export function goalCatalog(sets){return sets.flatMap(s=>(s.rows||[]).map((row,index)=>({...row,id:goalKey(s,index),user_id:s.user_id,year:s.year}))).filter(r=>r.personal_goal?.trim());}
export function weeklyGoalProgress(goal,reports,week){
 const tasks=new Map();
 const selected=reports.filter(r=>r.user_id===goal.user_id&&r.status==='submitted'&&r.week_start<=week).slice().sort((a,b)=>b.week_start.localeCompare(a.week_start)||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
 for(const r of selected)for(const [n,item] of (r.items||[]).entries()){const id=item.id||r.id+':'+n;if(!tasks.has(id))tasks.set(id,{item,week:r.week_start});}
 const linked=[...tasks.values()].filter(t=>t.item.personal_goal_id===goal.id);
 if(!linked.length)return null;
 return {progress:Math.round(linked.reduce((sum,t)=>sum+Number(t.item.progress||0),0)/linked.length),count:linked.length,reported:linked.some(t=>t.week===week),tasks:linked};
}
export function monthWeeks(month){const start=monday(month+'-01'),end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();const out=[];for(let d=start;d<=month+'-'+end;){out.push(d);const next=new Date(d+'T12:00Z');next.setUTCDate(next.getUTCDate()+7);d=next.toISOString().slice(0,10);}return out;}
export async function goalManagementPage(ctx){
 const results=ctx.demo?[{data:[]},{data:[]},{data:[]}]:await Promise.all([ctx.client.from('team_goals').select('*'),ctx.client.from('team_goal_strategies').select('*'),(ctx.member.role==='admin'?ctx.client.from('personal_goal_sets').select('*'):ctx.client.from('personal_goal_sets').select('*').eq('user_id',ctx.member.id))]);
 if(!ctx.isActive())return;
 if(results.some(r=>r.error)){ctx.shell('<h1>목표관리</h1><section class="panel"><p class="error">목표를 불러오지 못했습니다. 개인 목표 SQL 적용 여부와 계정 권한을 확인해주세요.</p></section>');return;}
 const [goals,strategies,sets]=results.map(r=>r.data||[]);let month=ctx.today.slice(0,7),owner='';
 function draw(){if(!ctx.isActive())return;const weeks=monthWeeks(month),rows=goalCatalog(sets).filter(r=>r.year===Number(month.slice(0,4))&&(!owner||r.user_id===owner));
 ctx.shell('<h1>목표관리</h1><section class="panel"><div class="toolbar"><label>조회 월<input id="milestone-month" type="month" value="'+month+'"></label>'+(ctx.member.role==='admin'?'<label>팀원<select id="milestone-owner"><option value="">전체 팀원</option>'+ctx.members.map(m=>'<option value="'+e(m.id)+'" '+(owner===m.id?'selected':'')+'>'+e(m.name)+'</option>').join('')+'</select></label>':'<span>본인 목표 현황</span>')+'</div><p class="muted">제출된 주간보고의 연결 업무를 기준으로 진행률을 계산합니다. 여러 업무는 업무별 최신 진행률의 평균을 표시하며, 보고가 없는 주는 직전 진행률을 유지합니다. 임시저장은 반영하지 않습니다.</p><div class="table-wrap"><table class="milestone-table"><thead><tr>'+['부서목표','팀 실행전략','반기/분기 실행 계획','개인목표','팀원','목표일정',...weeks.map(w=>w+' 주')].map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>{const s=strategies.find(s=>s.id===row.strategy_id),g=goals.find(g=>g.id===s?.goal_id);return '<tr>'+[g?.business_goal,g?.team_goal,s?s.period+' · '+s.strategy:'',row.personal_goal,ctx.members.find(m=>m.id===row.user_id)?.name,row.target_date].map(v=>'<td class="detail">'+e(v||'—')+'</td>').join('')+weeks.map(w=>{const p=weeklyGoalProgress(row,ctx.reports,w),future=w>monday(ctx.today);return '<td>'+(!p||future?'<span class="muted">—</span>':'<strong>'+p.progress+'%</strong><div class="bar"><i style="width:'+p.progress+'%"></i></div><small>'+ (p.reported?'보고 반영':'전주 유지')+' · '+p.count+'건</small><details><summary>업무 보기</summary>'+p.tasks.map(t=>'<p class="detail">'+e(t.item.title)+' · '+Number(t.item.progress||0)+'%<br>'+e(t.item.result||'')+'</p>').join('')+'</details>')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>'+(rows.length?'':'<p class="empty">등록된 개인목표가 없습니다.</p>')+'</section>');
 document.getElementById('milestone-month').onchange=ev=>{if(ev.target.value){month=ev.target.value;draw();}};const filter=document.getElementById('milestone-owner');if(filter)filter.onchange=ev=>{owner=ev.target.value;draw();};}
 draw();
}
