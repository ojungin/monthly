import {escapeHTML as e} from './core.mjs';
export function summaryTable(headers,rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(v=>'<td class="detail">'+e(v??'')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">해당 내용 없음</td></tr>')+'</tbody></table></div>';}
export function aiNotes(s,field,title,original){const key=field==='issues'?'issues':'plans',rows=s.ai_summary?.[key];return '<section class="report-section"><h2>'+e(title)+'</h2>'+(rows?summaryTable(field==='issues'?['구분','금주 이슈 및 대응 요약']:['구분','다음주 계획 요약'],rows.map(r=>[r.topic,r.summary])):'<p class="report-muted">요약이 아직 생성되지 않았습니다. 아래 펼쳐보기에서 보고자별 원문을 확인해주세요.</p>')+'<details class="report-original"><summary>펼쳐보기 · 보고자별 원문</summary>'+original+'</details></section>';}
export function monthlyAISections(s){const ai=s.ai_summary,latest=new Map();for(const r of [...s.reports].sort((a,b)=>b.week_start.localeCompare(a.week_start)||String(b.updated_at||'').localeCompare(String(a.updated_at||''))))for(const [n,i] of (r.items||[]).entries()){const key=r.user_id+':'+(i.id||r.id+':'+n);if(!latest.has(key))latest.set(key,{...i,owner:s.members.find(m=>m.id===r.user_id)?.name||'미등록'});}
 const tasks=[...latest.values()],done=ai?.done?.map(x=>[x.topic,x.summary])||tasks.filter(x=>x.state==='완료').map(x=>[x.title,x.owner+' · '+(x.result||'완료')]),todo=ai?.todo?.map(x=>[x.topic,x.summary])||[...tasks.filter(x=>x.state!=='완료').map(x=>[x.title,x.owner+' · '+x.state+' '+x.progress+'% · '+(x.target_date||'일정 미지정')]),...s.reports.filter(r=>r.next_plan).map(r=>['계획',r.next_plan])];
 return '<section class="report-section"><h2>1. 지표</h2>'+(ai?summaryTable(['플랫폼','지표명','값 / 실적','비교 / 설명'],ai.metrics.map(x=>[x.platform,x.name,x.value,x.comparison])):'<p class="report-muted">요약 미생성 · 지표는 저장된 주간 통합문서의 실제 수치를 바탕으로 정리합니다.</p>')+'</section><section class="report-section"><h2>2. 한 일</h2>'+summaryTable(['업무','성과 요약'],done)+'</section><section class="report-section"><h2>3. 할 일</h2>'+summaryTable(['업무 / 계획','진행 상황 및 다음 행동'],todo)+'</section><section class="report-section"><h2>4. 자문 요청사항</h2><div class="detail" style="min-height:80px;border:1px solid #dce5ef;padding:12px">'+e(s.advisory_request||'')+'</div></section>';
}
export function latestWeeklyDocument(documents,week){return documents.filter(d=>d.kind==='weekly'&&d.period===week).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id).localeCompare(String(a.id)))[0]||null;}
export async function summarizeDocument(client,documentId){
 const {data,error}=await client.functions.invoke('report-ai',{body:{document_id:documentId}});
 if(error||data?.error){
  let detail=data?.error||'';
  const context=error?.context;let status=context?.status;
  if(!detail&&typeof context?.json==='function'){try{const body=await (typeof context.clone==='function'?context.clone():context).json();detail=body.error||body.message||body.msg||'';}catch{}}
  if(!detail){if(status===401)detail='로그인이 만료되었거나 함수 JWT 설정이 맞지 않습니다. 다시 로그인하고 함수 설정을 확인해주세요.';else if(status===404)detail='report-ai 함수가 배포되어 있는지 확인해주세요.';else detail='GPT 서버에 연결하지 못했습니다. 네트워크와 함수 배포 상태를 확인해주세요.';}
  throw Error('요약 실패'+(status?' (HTTP '+status+')':'')+': '+detail+' 원본 보고서는 저장되어 있습니다.');
 }
 if(!data?.document?.snapshot?.ai_summary)throw Error('요약 결과를 확인하지 못했습니다.');
 return data.document;
}
