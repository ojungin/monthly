// 월 성과 보고서 — tf-worklog '보고의 건' 양식(보고요약 회색 박스, 회색 머리글 표, A4 Word)을 따릅니다.
// 보고서는 하나의 모델(monthlyReportModel)에서 화면·HTML·PDF·Word를 모두 만듭니다.
import {escapeHTML as e} from './core.mjs?v=20261102-report5';

export const workCategories=['콘텐츠 운영','플랫폼 운영','콘텐츠 신규','플랫폼 신규','AX/업무 효율화','AX/신규','기타'];
export const monthlyOverviewAreas=['주요 지표','한 일','할 일'];
const CIRC='①②③④⑤⑥⑦⑧⑨⑩';
const pad=n=>String(n).padStart(2,'0');
const monthNo=ym=>Number(String(ym).slice(5,7));
const previousMonthOf=ym=>{const d=new Date(ym+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);};
const lastDay=ym=>new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).getUTCDate();
const dot=s=>String(s||'').replace(/-/g,'.');
const md=s=>Number(String(s).slice(5,7))+'/'+Number(String(s).slice(8,10));
const korDate=iso=>{const d=new Date(iso||Date.now());const k=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d),g=t=>k.find(x=>x.type===t)?.value;return g('year')+'년 '+g('month')+'월 '+g('day')+'일';};
const kst=iso=>{if(!iso||Number.isNaN(Date.parse(iso)))return '';const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));return p.replace(/-/g,'.');};
const lines=t=>String(t||'').split(/\r?\n/).map(x=>x.replace(/^\s*(?:[-•·*▪◦]+|\d{1,2}[.)](?!\d)|[①-⑳])\s*/u,'').trim()).filter(Boolean);
const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(/[,\s]/g,''));return Number.isFinite(n)?n:null;};

// 단위별 표기: 금액은 억·만 단위, 점수는 소수 둘째 자리, 그 외 정수
export function formatMetric(v,unit){
 const n=num(v);if(n===null)return '-';
 if(unit==='원'||unit==='P'){const a=Math.abs(n),sg=n<0?'-':'',suffix=unit==='원'?'원':'P';if(a>=1e8)return sg+(a/1e8).toFixed(a>=1e10?0:1)+'억'+suffix;if(a>=1e4)return sg+Math.round(a/1e4).toLocaleString('ko-KR')+'만'+suffix;return sg+Math.round(a).toLocaleString('ko-KR')+suffix;}
 if(unit==='점')return n.toLocaleString('ko-KR',{maximumFractionDigits:2})+unit;
 return Math.round(n).toLocaleString('ko-KR')+(unit||'');
}
export function metricChange(row){
 const a=num(row.value),b=num(row.previous);if(a===null||b===null)return {diff:'-',rate:'-'};
 const d=a-b,diff=d===0?'0':(d>0?'+':'')+formatMetric(d,row.unit),rate=b===0?'-':(d>0?'+':'')+(d/Math.abs(b)*100).toFixed(1)+'%';
 return {diff,rate};
}
function metricNote(row){
 if(row.note&&num(row.value)===null)return row.partial&&row.kind!=='sum'?'월 마감 후 확정':row.note;
 if(row.basis==='same-days')return '1~'+Number(row.through.slice(8,10))+'일 동기간 비교';
 if(row.partial)return md(row.through)+' 기준(집계 중)';
 return row.note||'';
}
const legacyGroup=i=>['회원·활동성','세미나','포인트'][i]||'기타';
// 매출은 월 성과 보고서에 표시하지 않습니다(이전에 저장된 문서 포함).
const isSales=r=>r.key==='sales'||r.group==='매출'||/^매출/.test(String(r.label||''));
export function metricTables(s){
 const sections=s.metrics?.sections||[],rows=sections.flatMap((sec,i)=>(sec.rows||[]).filter(r=>!isSales(r)).map(r=>({...r,group:r.group||legacyGroup(i)})));
 const order=['회원','활동성','회원·활동성','포인트','세미나','기타'],cur=monthNo(s.month),prev=monthNo(previousMonthOf(s.month));
 const titles={'세미나':'비학술 세미나'};
 return order.filter(g=>rows.some(r=>r.group===g)).map((g,i)=>({title:(CIRC[i]||'-')+' '+(titles[g]||g),head:['플랫폼','지표',prev+'월',cur+'월','증감','증감률','비고'],numeric:[2,3,4,5],
  rows:['닥터빌','팜빌'].flatMap(p=>rows.filter(r=>r.group===g&&(r.platform||'닥터빌')===p)).map(r=>{const c=metricChange(r);return [r.platform||'닥터빌',String(r.label||'').replace(/^\[(닥터빌|팜빌)\]\s*/,''),formatMetric(r.previous,r.unit),formatMetric(r.value,r.unit),c.diff,c.rate,metricNote(r)];})}));
}
function metricBody(s){
 const m=s.metrics,prev=previousMonthOf(s.month),L=[];
 if(!m?.sections?.some(x=>x.rows?.length))return [{t:'p',text:'1) 지표 자료 없음'},{t:'note',text:'※ 통계 DB 계정을 연결한 뒤 보고서를 다시 생성해야 지표가 표시됨'}];
 L.push({t:'num',text:'① 기준 월 : '+s.month.slice(0,4)+'년 '+monthNo(s.month)+'월 (전월 '+monthNo(prev)+'월 대비)'});
 const packs=(m.packs||[]).map(p=>p.platform+' '+(p.key?(kst(p.generated_at)||'저장본')+' 생성본':'저장본 없음'));
 L.push({t:'num',text:'② 출처 : 통합 통계(Dashboard_DV) 월간 리포트'+(packs.length?' ('+packs.join(', ')+')':'')+', 비학술 세미나 Google Sheets 원본'});
 const partial=(m.sections||[]).flatMap(x=>x.rows||[]).find(r=>r.partial);
 if(partial)L.push({t:'note',text:'※ '+monthNo(s.month)+'월은 '+md(partial.through)+'까지 집계된 진행 중 수치이며, 합계 지표는 전월 같은 기간(1~'+Number(partial.through.slice(8,10))+'일)과 비교함'});
 L.push({t:'note',text:'※ 합계 지표는 월 합계, 평균 지표(DAU·MAU 등)는 월 평균, 회원·잔여 포인트는 월말 값이며 자료가 없는 값은 ‘-’로 표시함'});
 return L;
}
// 업무 분야별 [분류] → 1. 업무 → 요약 → (1) 세부 내용
function workBody(rows,empty){
 if(!rows.length)return [{t:'p',text:empty}];
 const L=[],cat=r=>workCategories.includes(r.category)?r.category:'기타';
 for(const c of workCategories){const group=rows.filter(r=>cat(r)===c);if(!group.length)continue;
  if(L.length)L.push({t:'gap'});L.push({t:'cat',text:'['+c+']'});
  group.forEach((r,i)=>{L.push({t:'goal',text:(i+1)+'. '+String(r.topic||'').trim()});if(String(r.summary||'').trim())L.push({t:'p',text:String(r.summary).trim()});(r.details||[]).map(x=>String(x).trim()).filter(Boolean).forEach((x,j)=>L.push({t:'item',text:'('+(j+1)+') '+x}));});
 }
 return L;
}
// 동일 담당자+업무 ID는 월 내 최신 보고 기준
export function latestMonthlyTasks(s){const tasks=new Map();for(const r of [...(s.reports||[])].sort((a,b)=>b.week_start.localeCompare(a.week_start)||String(b.updated_at||'').localeCompare(String(a.updated_at||''))))(r.items||[]).forEach((i,n)=>{const key=r.user_id+':'+(i.id||r.id+'-'+n);if(!tasks.has(key))tasks.set(key,{...i,owner:r.user_id});});return [...tasks.values()];}
function fallbackWork(s,kind){
 const tasks=latestMonthlyTasks(s),person=id=>s.members?.find(m=>m.id===id)?.name||'미등록';
 const cat=t=>workCategories.includes(t.project)?t.project:'기타';
 if(kind==='done')return tasks.filter(t=>t.state==='완료'||String(t.result||'').trim()).map(t=>({category:cat(t),topic:t.title+' ('+(t.service||'공통')+' · '+person(t.owner)+')',summary:t.state+' · 진행률 '+t.progress+'%',details:lines(t.result)}));
 return tasks.filter(t=>t.state!=='완료').map(t=>({category:cat(t),topic:t.title+' ('+(t.service||'공통')+' · '+person(t.owner)+')',summary:t.state+' · 진행률 '+t.progress+'% · 목표 일정 '+(t.target_date||'미지정'),details:[]}));
}
function summaryLines(s){
 const ai=s.ai_summary,reports=s.reports||[],tasks=latestMonthlyTasks(s);
 if(Array.isArray(ai?.overview)&&ai.overview.length)return monthlyOverviewAreas.flatMap(area=>ai.overview.filter(r=>r.area===area).map(r=>String(r.summary||'').trim())).filter(Boolean);
 const count=st=>tasks.filter(t=>t.state===st).length;
 const out=[monthNo(s.month)+'월 주간 보고 '+reports.length+'건(보고자 '+new Set(reports.map(r=>r.user_id)).size+'명)을 취합했으며, 주요 업무 '+tasks.length+'건 중 완료 '+count('완료')+'건, 진행 '+count('진행')+'건, 보류 '+count('보류')+'건임'];
 const key=(s.metrics?.sections||[]).flatMap(x=>x.rows||[]).filter(r=>num(r.value)!==null&&['total','mau','use'].includes(r.key)&&(r.platform||'닥터빌')==='닥터빌');
 if(key.length)out.push('닥터빌 '+key.map(r=>String(r.label).replace(/\s*\(.*\)$/,'')+' '+formatMetric(r.value,r.unit)+(metricChange(r).diff!=='-'?'(전월 대비 '+metricChange(r).diff+')':'')).join(', ')+'임');
 return out;
}
export function monthlyReportModel(s){
 const month=s.month,ai=s.ai_summary,legacyAI=ai&&!Array.isArray(ai.overview);
 const done=ai?.done?.length?ai.done:ai?[]:fallbackWork(s,'done'),todo=ai?.todo?.length?ai.todo:ai?[]:fallbackWork(s,'todo');
 const advisory=lines(s.advisory_request);
 const members=s.members||[],person=id=>members.find(m=>m.id===id)?.name||'미등록';
 const sections=[
  {title:'2. 주요 지표',body:metricBody(s),tables:metricTables(s)},
  {title:'3. 한 일',body:[...workBody(done,'선택 월에 정리된 수행 내용 없음'),...(ai?[]:[{t:'note',text:'※ 요약 미생성 상태로 주간 보고의 최신 업무 상태를 그대로 정리함'}])]},
  {title:'4. 할 일',body:[...workBody(todo,'다음 달로 이어지는 업무 없음'),...(ai?[]:[{t:'note',text:'※ 요약 미생성 상태로 완료되지 않은 업무를 그대로 정리함'}])]},
  {title:'5. 자문 필요 사항',body:advisory.length?advisory.map((x,i)=>({t:'num',text:(CIRC[i]||'-')+' '+x})):[{t:'p',text:'해당 없음'}]}
 ];
 const tasks=latestMonthlyTasks(s),appendix=[];
 if(tasks.length)appendix.push({title:'주요 업무 현황 (월 내 최신 보고 기준)',head:['업무 분야','서비스','업무내용','담당','상태','진행률','목표 일정'],rows:tasks.slice().sort((a,b)=>String(a.project).localeCompare(String(b.project),'ko')).map(t=>[t.project||'',t.service||'',t.title||'',person(t.owner),t.state||'',(t.progress??'')+'%',t.target_date||'미지정'])});
 const reports=(s.reports||[]).slice().sort((a,b)=>String(a.report_date||a.week_start).localeCompare(String(b.report_date||b.week_start))||person(a.user_id).localeCompare(person(b.user_id),'ko'));
 if(reports.length)appendix.push({title:'주간 보고 제출 현황',head:['작성일','보고 주간','보고자','업무 수'],rows:reports.map(r=>[dot(r.report_date||r.week_start),dot(r.week_start)+' 주',person(r.user_id),(r.items||[]).length+'건'])});
 for(const d of s.metrics?.sections?.[1]?.platform_details||[])if(d.detail_rows?.length)appendix.push({title:'비학술 세미나 완료 강의 · '+d.platform,head:d.detail_headers,rows:d.detail_rows.map(r=>r.map(x=>typeof x==='number'?x.toLocaleString('ko-KR',{maximumFractionDigits:2}):String(x??'')))});
 if(reports.length)appendix.push({title:'주간 보고 원문',head:['작성일','보고자','주요 업무 · 성과','금주 이슈 및 대응','차주 계획'],wide:true,rows:reports.map(r=>[dot(r.report_date||r.week_start),person(r.user_id),(r.items||[]).map(i=>'['+(i.project||'')+'] '+(i.title||'')+' ('+(i.state||'')+' '+(i.progress??'')+'%)'+(String(i.result||'').trim()?'\n'+String(i.result).trim():'')).join('\n'),String(r.issues||'').trim()||'없음',String(r.next_plan||'').trim()||'없음'])});
 return {title:month.slice(0,4)+'년 '+monthNo(month)+'월 업무 성과 보고의 건',dateLine:'보고일 : '+korDate(s.created_at),metaLine:'보고기간 : '+dot(month+'-01')+' ~ '+dot(month+'-'+pad(lastDay(month)))+' · 작성 : '+(s.author||''),
  summaryTitle:'1. 보고 요약',summary:summaryLines(s),summaryNote:!ai?'※ 요약 미생성 · 보고서 생성 또는 요약 재시도를 실행하면 GPT 요약으로 바뀜':legacyAI?'※ 이전 양식으로 생성된 문서임 · 보고서를 다시 생성하면 새 요약이 포함됨':'',sections,appendix};
}

export const monthlyReportStyles='.rdoc{background:#fff;color:#111;max-width:794px;margin:0 auto;padding:48px 56px;border:1px solid #d9dde3;font-size:14.5px;line-height:1.7;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;box-sizing:border-box}.rdoc *{box-sizing:border-box}.rdoc .rd-title{text-align:center;font-size:19px;font-weight:700;margin:0 0 18px;letter-spacing:-.01em;word-break:keep-all;color:#111;border:0;padding:0}.rdoc .rd-meta{text-align:right;font-weight:700;margin:0;font-size:14px}.rdoc .rd-box{background:#EDEDED;border:1px solid #9a9a9a;padding:12px 16px;margin:18px 0 8px}.rdoc .rd-boxh{font-weight:700;margin:0 0 6px}.rdoc .rd-sum{margin:0 0 6px;padding-left:1.4em;text-indent:-1.4em;word-break:break-word}.rdoc .rd-h{font-size:14.5px;font-weight:700;margin:22px 0 8px;color:#111;border:0;padding:0}.rdoc p{margin:0;white-space:pre-wrap}.rdoc .rb-cat{font-weight:700;margin:12px 0 4px;color:#13213b}.rdoc .rb-goal{font-weight:700;margin:6px 0 3px;padding-left:.6em}.rdoc .rb-p{margin:0 0 3px;padding-left:1.6em;word-break:break-word}.rdoc .rb-item{margin:0 0 2px;padding-left:3.4em;text-indent:-1.6em;word-break:break-word}.rdoc .rb-num{margin:0 0 4px;padding-left:2.2em;text-indent:-1.2em;word-break:break-word}.rdoc .rb-note{margin:0 0 4px;padding-left:2.2em;font-size:11.5px;color:#555}.rdoc .rb-gap{height:6px}.rdoc .rd-th{font-weight:700;margin:14px 0 6px}.rdoc .tblwrap{overflow-x:auto}.rdoc .rd-tbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px}.rdoc .rd-tbl th,.rdoc .rd-tbl td{border:1px solid #808080;padding:5px 7px;vertical-align:top;color:#111;white-space:pre-wrap;word-break:break-word}.rdoc .rd-tbl th{background:#EDEDED;font-weight:700;text-align:center;white-space:nowrap}.rdoc .rd-tbl td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.rdoc .rd-tbl.wide{font-size:11px}.rdoc .rd-tbl.wide th,.rdoc .rd-tbl.wide td{white-space:pre-wrap}@media(max-width:600px){.rdoc{padding:22px 16px}.rdoc .rd-tbl{font-size:11px}}@media print{.rdoc{border:0;padding:0;max-width:none}.rdoc tr,.rdoc .rd-box{break-inside:avoid}.rdoc .rd-h,.rdoc .rd-th{break-after:avoid}}';
const lineHTML=l=>l.t==='gap'?'<div class="rb-gap"></div>':'<p class="rb-'+l.t+'">'+e(l.text)+'</p>';
const tableHTML=(t,i)=>'<p class="rd-th">'+(i===undefined?'':(i+1)+'. ')+e(t.title)+'</p><div class="tblwrap"><table class="rd-tbl'+(t.wide?' wide':'')+'"><thead><tr>'+t.head.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+(t.rows.length?t.rows.map(row=>'<tr>'+row.map((c,ci)=>'<td'+(t.numeric?.includes(ci)?' class="num"':'')+'>'+e(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+t.head.length+'">자료 없음</td></tr>')+'</tbody></table></div>';
export function monthlyReportBody(s){
 const r=monthlyReportModel(s);
 return '<style>'+monthlyReportStyles+'</style><article class="rdoc monthly-report"><h1 class="rd-title">'+e(r.title)+'</h1><p class="rd-meta">'+e(r.dateLine)+'</p><p class="rd-meta">'+e(r.metaLine)+'</p>'
  +'<div class="rd-box"><p class="rd-boxh">■ '+e(r.summaryTitle)+'</p>'+(r.summary.length?r.summary.map((x,i)=>'<p class="rd-sum">'+(i+1)+'. '+e(x)+'</p>').join(''):'<p class="rd-sum">요약할 내용이 없음</p>')+(r.summaryNote?'<p class="rb-note" style="padding-left:0">'+e(r.summaryNote)+'</p>':'')+'</div>'
  +r.sections.map(sec=>'<h2 class="rd-h">'+e(sec.title)+'</h2>'+sec.body.map(lineHTML).join('')+(sec.tables||[]).map(t=>tableHTML(t)).join('')).join('')
  +(r.appendix.length?'<h2 class="rd-h">■ 참고자료</h2>'+r.appendix.map((t,i)=>tableHTML(t,i)).join(''):'')+'</article>';
}

// Word(.docx): tf-worklog 출력 양식 — A4, 맑은 고딕 11pt, 보고요약 회색 박스, 회색 머리글 표
export function monthlyReportDocx(D,s){
 const r=monthlyReportModel(s),{Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType,ShadingType,BorderStyle}=D;
 const F='맑은 고딕',G='EDEDED';
 const run=(t,o={})=>new TextRun({text:t,font:F,size:o.size||22,bold:!!o.bold,color:o.color});
 const para=(t,o={})=>new Paragraph({children:String(t).split('\n').map((x,i)=>new TextRun({text:x,font:F,size:o.size||22,bold:!!o.bold,color:o.color,break:i?1:0})),alignment:o.align,spacing:{after:o.after??80,before:o.before??0,line:300},indent:o.indent});
 const border={style:BorderStyle.SINGLE,size:4,color:'808080'},borders={top:border,bottom:border,left:border,right:border};
 const kids=[para(r.title,{size:28,bold:true,align:AlignmentType.CENTER,after:200}),para(r.dateLine,{bold:true,align:AlignmentType.RIGHT,after:40}),para(r.metaLine,{bold:true,align:AlignmentType.RIGHT,after:200})];
 kids.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[new TableCell({borders,shading:{type:ShadingType.CLEAR,color:'auto',fill:G},margins:{top:120,bottom:120,left:160,right:160},
  children:[para('■ '+r.summaryTitle,{bold:true,after:100}),...(r.summary.length?r.summary:['요약할 내용이 없음']).map((x,i)=>para((i+1)+'. '+x,{after:80,indent:{left:300,hanging:300}})),...(r.summaryNote?[para(r.summaryNote,{size:17,color:'555555'})]:[])]})]})]}));
 const line=l=>l.t==='gap'?para('',{after:40}):l.t==='cat'?para(l.text,{bold:true,before:160,after:60}):l.t==='goal'?para(l.text,{bold:true,before:100,after:40,indent:{left:200}}):l.t==='item'?para(l.text,{indent:{left:900,hanging:380}}):l.t==='num'?para(l.text,{indent:{left:400,hanging:280}}):l.t==='note'?para(l.text,{size:17,color:'555555',indent:{left:400}}):para(l.text,{indent:{left:500}});
 const tbl=t=>{const sz=t.head.length>6?16:18;const cell=(txt,head,ci)=>new TableCell({borders,shading:head?{type:ShadingType.CLEAR,color:'auto',fill:G}:undefined,margins:{top:30,bottom:30,left:60,right:60},children:[new Paragraph({alignment:head?AlignmentType.CENTER:(t.numeric?.includes(ci)?AlignmentType.RIGHT:undefined),children:String(txt??'').split('\n').map((x,i)=>new TextRun({text:x,font:F,size:sz,bold:head,break:i?1:0}))})]});
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:t.head.map((h,ci)=>cell(h,true,ci))}),...(t.rows.length?t.rows:[['자료 없음',...t.head.slice(1).map(()=>'')]]).map(row=>new TableRow({cantSplit:true,children:row.map((c,ci)=>cell(c,false,ci))}))]});};
 for(const sec of r.sections){kids.push(para(sec.title,{bold:true,before:280,after:100}));kids.push(...sec.body.map(line));for(const t of sec.tables||[]){kids.push(para(t.title,{bold:true,before:160,after:80,size:20}));kids.push(tbl(t));}}
 if(r.appendix.length){kids.push(para('■ 참고자료',{bold:true,before:320,after:120}));r.appendix.forEach((t,i)=>{kids.push(para((i+1)+'. '+t.title,{bold:true,before:160,after:80}));kids.push(tbl(t));});}
 return new Document({styles:{default:{document:{run:{font:F,size:22}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1701,bottom:1701,left:1440,right:1440}}},children:kids}]});
}
