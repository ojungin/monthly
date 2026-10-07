import {escapeHTML as e, summarize} from './core.mjs';
export function weeklySnapshot(reports,members,week,author){
 const selected=reports.filter(r=>r.status==='submitted'&&r.week_start===week);
 if(!selected.length)throw Error('선택한 주에 제출된 보고가 없습니다.');
 return {version:1,id:crypto.randomUUID(),week,created_at:new Date().toISOString(),author,members:structuredClone(members.map(({id,name,team})=>({id,name,team}))),reports:structuredClone(selected)};
}
export function groupedNotes(reports,field){
 const groups=new Map();
 for(const r of reports){let category='일반';for(let line of String(r[field]||'').split(/\r?\n/)){line=line.trim();if(!line||/^(없음|해당 없음|-)$/u.test(line))continue;
 const heading=line.match(/^\[([^\]]+)\]\s*(.*)$/u)||line.match(/^([^:：]{1,50})[:：]\s*(.*)$/u);
 if(heading){category=heading[1].trim();line=heading[2].trim();if(!line)continue;}
 if(!groups.has(category))groups.set(category,new Map());const key=line.replace(/\s+/g,' ').trim(),entries=groups.get(category);if(!entries.has(key))entries.set(key,{text:line,owners:new Set()});entries.get(key).owners.add(r.user_id);
 }}return [...groups].map(([category,entries])=>({category,entries:[...entries.values()].map(x=>({...x,owners:[...x.owners]}))}));
}
export function weeklyBody(s){
 const stats=summarize(s.reports),person=id=>s.members.find(m=>m.id===id)||{name:'알 수 없는 팀원',team:''};
 const notes=(field,title)=>{const groups=groupedNotes(s.reports,field);return '<section><h2>'+title+'</h2>'+ (groups.length?groups.map(g=>'<h3>'+e(g.category)+'</h3><ul>'+g.entries.map(x=>'<li><span class="detail">'+e(x.text)+'</span> <strong>('+x.owners.map(id=>e(person(id).name)).join(', ')+')</strong></li>').join('')+'</ul>').join(''):'<p>없음</p>')+'</section>'};
 const rows=s.reports.flatMap(r=>r.items.map(i=>({...i,owner:r.user_id}))).sort((a,b)=>a.project.localeCompare(b.project,'ko'));
 return '<h1>'+e(s.week)+' 주간 통합보고</h1><p>생성: '+e(new Date(s.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))+' · 작성: '+e(s.author)+'</p><p>제출 '+stats.people+' / '+s.members.length+'명 · 업무 '+stats.items.length+'건 · 완료 '+stats.done+'건</p><p>미제출: '+e(s.members.filter(m=>!s.reports.some(r=>r.user_id===m.id)).map(m=>m.name).join(', ')||'없음')+'</p><section><h2>팀 주간 업무 및 성과</h2><div class="table-wrap"><table><thead><tr><th>프로젝트</th><th>업무내용</th><th>상태/진행률</th><th>업무담당자</th><th>주요성과</th></tr></thead><tbody>'+rows.map(i=>'<tr><td>'+e(i.project)+'<br>서비스: '+e(i.service||'미지정')+'</td><td>'+e(i.title)+'</td><td>'+e(i.state)+' / '+e(i.progress)+'%<br>목표 일정: '+e(i.target_date||'미지정')+'</td><td>'+e(person(i.owner).name)+'</td><td class="detail">'+e(i.result||'없음')+'</td></tr>').join('')+'</tbody></table></div></section>'+notes('issues','이슈 및 지원 요청')+notes('next_plan','다음 주 계획');
}
export function weeklyFile(s){return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(s.week)} 주간 통합보고</title><style>body{font:15px Arial,'Malgun Gothic',sans-serif;color:#182944;max-width:1100px;margin:40px auto;padding:20px}h1{border-bottom:3px solid #2464dd;padding-bottom:20px}section{margin:32px 0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dce5ef;padding:12px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#eef3fb}p{white-space:pre-wrap;line-height:1.7}li{margin:10px 0}.detail{white-space:pre-wrap}@media print{@page{size:A4;margin:14mm}body{margin:0;padding:0}tr{break-inside:avoid}}</style><body>${weeklyBody(s)}<script type="application/json" id="weekly-data">${JSON.stringify(s).replaceAll('<','\\u003c')}</script></body></html>`}
