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
export function periodWeeks(year,quarter='all'){
 const y=Number(year),q=String(quarter);if(!Number.isInteger(y)||y<2000||y>2100||!['all','1','2','3','4'].includes(q))throw Error('조회 기간을 확인해주세요.');
 const first=q==='all'?1:(Number(q)-1)*3+1,last=q==='all'?12:first+2;
 const start=y+'-'+String(first).padStart(2,'0')+'-01',end=new Date(Date.UTC(y,last,0)).toISOString().slice(0,10),weeks=[];
 for(let date=monday(start);date<=end;){const anchor=date<start?start:date,month=anchor.slice(0,7);weeks.push({date,month,label:(monthWeeks(month).indexOf(date)+1)+'주'});const d=new Date(date+'T12:00Z');d.setUTCDate(d.getUTCDate()+7);date=d.toISOString().slice(0,10);}
 return weeks;
}
export function monthGroups(weeks){const groups=[];for(const w of weeks){const last=groups.at(-1);if(last?.month===w.month)last.count++;else groups.push({month:w.month,count:1});}return groups;}
const milestoneHeaders=['부서목표','팀 실행전략','반기/분기 실행 계획','개인목표','팀원','목표일정','연결된 주요 업무'];
export function milestoneValues(row,goals,strategies,members){const s=strategies.find(s=>s.id===row.strategy_id),g=goals.find(g=>g.id===s?.goal_id);return [g?.business_goal||'',g?.team_goal||'',s?s.period+' · '+s.strategy:'',row.personal_goal,members.find(m=>m.id===row.user_id)?.name||'',row.target_date||''];}
export function assertMilestoneExport(member){if(member?.role!=='admin')throw Error('관리자/책임자만 Excel 추출이 가능합니다.');}
export function linkedGoalTasksText(row,reports,weeks,today){const cutoff=weeks.at(-1)?.date;if(!cutoff)return '';const week=cutoff<monday(today)?cutoff:monday(today);return (weeklyGoalProgress(row,reports,week)?.tasks||[]).map(t=>t.item.title||'').filter(Boolean).join('\n');}
export function milestoneExportRows(rows,weeks,reports,today,goals,strategies,members){return rows.map(row=>[...milestoneValues(row,goals,strategies,members),linkedGoalTasksText(row,reports,weeks,today),...weeks.map(w=>{if(w.date>monday(today))return null;const p=weeklyGoalProgress(row,reports,w.date);return p?p.progress/100:null;})]);}
let excelPromise;
export async function exportMilestones(ctx,rows,weeks,year,quarter,goals,strategies){
 assertMilestoneExport(ctx.member);
 excelPromise||=new Promise((resolve,reject)=>{if(window.ExcelJS)return resolve(window.ExcelJS);const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{excelPromise=null;reject(Error('Excel 모듈을 불러오지 못했습니다.'));};document.head.append(script);});
 const ExcelJS=await excelPromise;assertMilestoneExport(ctx.member);const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('목표 마일스톤'),total=7+weeks.length;
 sheet.columns=[28,28,34,32,12,15,40,...weeks.map(()=>10)].map(width=>({width}));sheet.views=[{state:'frozen',xSplit:7,ySplit:4}];
 sheet.mergeCells(1,1,1,total);sheet.getCell(1,1).value=year+'년 목표관리 · '+(quarter==='all'?'전체 분기':quarter+'분기');sheet.getRow(1).height=30;
 sheet.mergeCells(2,1,2,total);sheet.getCell(2,1).value='제출 보고 기준 · 여러 업무는 최신 진행률 평균 · 미보고 주는 직전 진행률 유지';
 milestoneHeaders.forEach((h,i)=>{sheet.mergeCells(3,i+1,4,i+1);sheet.getCell(3,i+1).value=h;});let col=8;for(const group of monthGroups(weeks)){if(group.count>1)sheet.mergeCells(3,col,3,col+group.count-1);sheet.getCell(3,col).value=Number(group.month.slice(5))+'월';col+=group.count;}weeks.forEach((w,i)=>{sheet.getCell(4,i+8).value=w.label;sheet.getCell(4,i+7).note=w.date+' 시작 주간';});
 milestoneExportRows(rows,weeks,ctx.reports,ctx.today,goals,strategies,ctx.members).forEach((values,i)=>{sheet.getRow(i+5).values=values;sheet.getRow(i+5).height=80;for(let c=8;c<=total;c++)sheet.getCell(i+5,c).numFmt='0%';});
 for(let r=3;r<=rows.length+4;r++)for(let c=1;c<=total;c++){const cell=sheet.getCell(r,c);cell.font={name:'맑은 고딕',size:10,bold:r<=4};cell.alignment={vertical:'middle',horizontal:c>=8?'center':'left',wrapText:true};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};if(r<=4)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAEEF8'}};}
 const buffer=await book.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='목표관리_'+year+'_'+(quarter==='all'?'전체':quarter+'분기')+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function goalManagementPage(ctx){
 const results=ctx.demo?[{data:[]},{data:[]},{data:[]}]:await Promise.all([ctx.client.from('team_goals').select('*'),ctx.client.from('team_goal_strategies').select('*'),(ctx.member.role==='admin'?ctx.client.from('personal_goal_sets').select('*'):ctx.client.from('personal_goal_sets').select('*').eq('user_id',ctx.member.id))]);
 if(!ctx.isActive())return;
 if(results.some(r=>r.error)){ctx.shell('<h1>목표관리</h1><section class="panel"><p class="error">목표를 불러오지 못했습니다. 개인 목표 SQL 적용 여부와 계정 권한을 확인해주세요.</p></section>');return;}
 const [goals,strategies,sets]=results.map(r=>r.data||[]);let year=Number(ctx.today.slice(0,4)),quarter='all',owner='';
 function draw(){if(!ctx.isActive())return;const weeks=periodWeeks(year,quarter),rows=goalCatalog(sets).filter(r=>r.year===year&&(!owner||r.user_id===owner));
 const header='<tr>'+milestoneHeaders.map(h=>'<th rowspan="2">'+e(h)+'</th>').join('')+monthGroups(weeks).map(g=>'<th colspan="'+g.count+'">'+Number(g.month.slice(5))+'월</th>').join('')+'</tr><tr>'+weeks.map(w=>'<th title="'+w.date+' 시작 주간">'+w.label+'</th>').join('')+'</tr>';
 ctx.shell('<h1>목표관리</h1><section class="panel"><div class="toolbar"><label>연도<input id="milestone-year" type="number" min="2000" max="2100" value="'+year+'"></label><label>분기<select id="milestone-quarter">'+['all','1','2','3','4'].map(q=>'<option value="'+q+'" '+(quarter===q?'selected':'')+'>'+(q==='all'?'전체 분기':q+'분기')+'</option>').join('')+'</select></label>'+(ctx.member.role==='admin'?'<label>팀원<select id="milestone-owner"><option value="">전체 팀원</option>'+ctx.members.map(m=>'<option value="'+e(m.id)+'" '+(owner===m.id?'selected':'')+'>'+e(m.name)+'</option>').join('')+'</select></label><button id="milestone-excel" class="primary">Excel 추출</button>':'<span>본인 목표 현황</span>')+'</div><p class="muted">제출된 주간보고 기준입니다. 여러 업무는 최신 진행률의 평균, 미보고 주는 직전 상태를 표시합니다. 월 아래 주차는 해당 월의 월~일 주간 순서이며, 날짜는 주차에 마우스를 올려 확인할 수 있습니다.</p><div class="table-wrap"><table class="milestone-table" style="width:'+(1450+weeks.length*100)+'px"><colgroup>'+[210,210,240,210,90,120,280,...weeks.map(()=>100)].map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup><thead>'+header+'</thead><tbody>'+rows.map(row=>'<tr>'+[...milestoneValues(row,goals,strategies,ctx.members),linkedGoalTasksText(row,ctx.reports,weeks,ctx.today)].map(v=>'<td class="detail">'+e(v||'—')+'</td>').join('')+weeks.map(w=>{const p=weeklyGoalProgress(row,ctx.reports,w.date),future=w.date>monday(ctx.today);return '<td>'+(!p||future?'<span class="muted">—</span>':'<strong>'+p.progress+'%</strong><div class="bar"><i style="width:'+p.progress+'%"></i></div><small>'+(p.reported?'보고 반영':'전주 유지')+' · '+p.count+'건</small><details><summary>업무 보기</summary>'+p.tasks.map(t=>'<p class="detail">'+e(t.item.title)+' · '+Number(t.item.progress||0)+'%<br>'+e(t.item.result||'')+'</p>').join('')+'</details>')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div>'+(rows.length?'':'<p class="empty">등록된 개인목표가 없습니다.</p>')+'</section>');
 document.getElementById('milestone-year').onchange=ev=>{const y=Number(ev.target.value);if(Number.isInteger(y)&&y>=2000&&y<=2100){year=y;draw();}};document.getElementById('milestone-quarter').onchange=ev=>{quarter=ev.target.value;draw();};const filter=document.getElementById('milestone-owner');if(filter)filter.onchange=ev=>{owner=ev.target.value;draw();};const button=document.getElementById('milestone-excel');if(button)button.onclick=()=>ctx.run(()=>exportMilestones(ctx,rows,weeks,year,quarter,goals,strategies));}
 draw();
}
