// 인수인계서 — 작성자(인계자)에게 귀속되고, 인수인계하면 인수자에게 공유됩니다.
// 인수자가 "확인 완료"를 누르면 인계자 목록에서 사라지며, 관리자/책임자는 전체를 확인합니다.
import {escapeHTML as e} from './core.mjs?v=20261105-hoquarter';

export const isHandoverManager=member=>member?.role==='admin';
export const handoverStatus={draft:'작성 중',shared:'확인 대기',confirmed:'확인 완료'};
export const blankHandoverItem=()=>({task:'',details:'',urls:[]});
const MAX_ITEMS=30,MAX_TASK=200,MAX_DETAILS=200000,MAX_URLS=20;

// ── 서식 있는 본문(HTML) 정리: 허용한 태그·속성·스타일만 남깁니다(Word 붙여넣기 포함). ──
const ALLOWED=new Set('p div br span b strong i em u s strike sub sup font h1 h2 h3 h4 ul ol li blockquote pre code hr table caption colgroup col thead tbody tfoot tr th td a'.split(' '));
const VOID=new Set(['br','hr','col']);
const STYLE_PROPS=new Set(['color','background-color','font-size','font-weight','font-style','font-family','text-decoration','text-decoration-line','text-align','vertical-align','width','min-width','height','border','border-top','border-right','border-bottom','border-left','border-color','border-width','border-style','border-collapse','padding','padding-left','margin-left','line-height']);
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function cleanStyle(style){
 return decode(style).split(';').map(part=>{const i=part.indexOf(':');if(i<0)return '';const prop=part.slice(0,i).trim().toLowerCase(),value=part.slice(i+1).trim();
  if(!STYLE_PROPS.has(prop)||!value||value.length>120||!/^[#\w\s.,%()'"-]+$/.test(value)||/url|expression|javascript|var\(/i.test(value))return '';
  return prop+':'+value.replace(/["']/g,'');}).filter(Boolean).join(';');
}
function cleanAttrs(tag,raw){
 const out=[];
 for(const m of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)){
  const name=m[1].toLowerCase(),value=decode(m[3]??m[4]??m[5]??'').trim();
  if(name==='style'){const s=cleanStyle(value);if(s)out.push('style="'+e(s)+'"');}
  else if((name==='colspan'||name==='rowspan')&&(tag==='td'||tag==='th')&&/^\d{1,2}$/.test(value))out.push(name+'="'+value+'"');
  else if(name==='href'&&tag==='a'&&/^https?:\/\//i.test(value))out.push('href="'+e(value)+'"');
  else if(name==='color'&&tag==='font'&&/^#?[a-zA-Z0-9]{1,20}$/.test(value))out.push('color="'+e(value)+'"');
  else if(name==='size'&&tag==='font'&&/^[1-7]$/.test(value))out.push('size="'+value+'"');
  else if(name==='span'&&tag==='col'&&/^\d{1,2}$/.test(value))out.push('span="'+value+'"');
 }
 if(tag==='a')out.push('target="_blank" rel="noopener noreferrer"');
 return out.length?' '+out.join(' '):'';
}
export function sanitizeRichText(html){
 const source=String(html??'').replace(/<!--[\s\S]*?(-->|$)/g,'').replace(/<(script|style|xml|template|iframe|object|embed|noscript|title|head|svg|math|textarea|select)\b[\s\S]*?(<\/\1\s*>|$)/gi,'');
 const stack=[];let out='',last=0;
 const text=s=>s.replace(/</g,'&lt;').replace(/>/g,'&gt;');
 for(const m of source.matchAll(/<[^>]*>/g)){
  out+=text(source.slice(last,m.index));last=m.index+m[0].length;
  const t=/^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([\s\S]*?)\/?>$/.exec(m[0]);if(!t)continue;
  const tag=t[2].toLowerCase();if(!ALLOWED.has(tag))continue;
  if(t[1]){const i=stack.lastIndexOf(tag);if(i<0)continue;while(stack.length>i)out+='</'+stack.pop()+'>';continue;}
  out+='<'+tag+cleanAttrs(tag,t[3])+'>';if(!VOID.has(tag))stack.push(tag);
 }
 out+=text(source.slice(last));
 while(stack.length)out+='</'+stack.pop()+'>';
 return out;
}
export const richTextIsEmpty=html=>!sanitizeRichText(html).replace(/<(?!table|hr)[^>]*>/gi,'').replace(/&nbsp;|\s/g,'').length;

// ── 입력값 검증 ──
export function parseUrls(value){
 const list=(Array.isArray(value)?value:String(value??'').split(/\r?\n/)).map(v=>String(v).trim()).filter(Boolean);
 if(list.length>MAX_URLS)throw Error('참고 URL은 업무별 '+MAX_URLS+'개까지 입력할 수 있습니다.');
 return list.map(v=>{let url;try{url=new URL(v)}catch{throw Error('참고 URL 형식을 확인해주세요: '+v)}if(!/^https?:$/.test(url.protocol)||v.length>2000)throw Error('참고 URL은 http:// 또는 https://로 시작해야 합니다: '+v);return v;});
}
export function handoverItems(items){
 const rows=(items||[]).map(i=>({task:String(i.task??'').trim(),details:sanitizeRichText(i.details),urls:parseUrls(i.urls)}))
  .filter(i=>i.task||!richTextIsEmpty(i.details)||i.urls.length);
 if(!rows.length)throw Error('주요 업무를 한 개 이상 입력해주세요.');
 if(rows.length>MAX_ITEMS)throw Error('업무는 '+MAX_ITEMS+'개까지 추가할 수 있습니다.');
 rows.forEach((r,n)=>{
  if(!r.task||r.task.length>MAX_TASK)throw Error((n+1)+'번째 업무의 주요 업무를 1~'+MAX_TASK+'자로 입력해주세요.');
  if(r.details.length>MAX_DETAILS)throw Error((n+1)+'번째 업무의 세부 내용이 너무 깁니다.');
  if(richTextIsEmpty(r.details))r.details='';
 });
 return rows;
}
// 화면에 보일 인수인계서: 관리자는 전체, 인계자는 확인 완료 전까지, 인수자는 공유된 뒤부터.
export function visibleHandovers(rows,member){
 if(isHandoverManager(member))return rows;
 return rows.filter(r=>(r.owner_id===member?.id&&r.status!=='confirmed')||(r.receiver_id===member?.id&&r.status!=='draft'));
}
export function handoverTitle(h){const items=h.items||[];return (items[0]?.task||'(주요 업무 없음)')+(items.length>1?' 외 '+(items.length-1)+'건':'');}

// ── 분기 최신화: 확인 완료 전 문서는 분기마다 한 번 이상 내용을 점검(최신화)해야 합니다. ──
export const kstDate=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(value));
export function quarterOf(day){
 const [y,m]=day.split('-').map(Number),q=Math.floor((m-1)/3)+1,first=(q-1)*3+1,last=new Date(Date.UTC(y,first+2,0)).getUTCDate();
 const pad=n=>String(n).padStart(2,'0');
 return {year:y,quarter:q,label:y+'년 '+q+'분기',start:y+'-'+pad(first)+'-01',end:y+'-'+pad(first+2)+'-'+pad(last)};
}
export const lastReviewed=h=>h.reviewed_at||h.updated_at||h.created_at;
export function needsRefresh(h,today){
 if(h.status==='confirmed')return false;
 const at=lastReviewed(h);return !at||kstDate(at)<quarterOf(today).start;
}
export const staleHandovers=(rows,memberId,today)=>rows.filter(r=>r.owner_id===memberId&&needsRefresh(r,today));
export function refreshReminder(count,today){
 if(!count)return '';const q=quarterOf(today),[,mm,dd]=q.end.split('-').map(Number);
 return q.label+'에 최신화하지 않은 인수인계서가 '+count+'건 있습니다. '+mm+'월 '+dd+'일까지 내용을 확인하고 최신화해주세요.';
}
// 로그인 직후 알림용: 본인 문서 중 최신화가 필요한 건수(저장소가 없으면 0).
export async function staleHandoverCount(ctx,today){
 try{
  if(ctx.demo)return staleHandovers(demoRows(),ctx.member.id,today).length;
  const {data,error}=await ctx.client.from('handovers').select('id,owner_id,status,reviewed_at,updated_at,created_at').eq('owner_id',ctx.member.id).neq('status','confirmed');
  return error?0:staleHandovers(data,ctx.member.id,today).length;
 }catch{return 0}
}
export async function markReviewed(ctx,row){
 if(row.owner_id!==ctx.member.id||row.status==='confirmed')throw Error('확인 완료 전인 본인 문서만 최신화할 수 있습니다.');
 const now=new Date().toISOString();
 if(ctx.demo){demoSave(demoRows().map(r=>r.id===row.id?{...r,reviewed_at:now}:r));return;}
 const {data,error}=await ctx.client.from('handovers').update({reviewed_at:now}).eq('id',row.id).eq('status',row.status).select();
 if(error)throw Error('최신화하지 못했습니다: '+error.message);
 if(!data.length)throw Error('문서 상태가 바뀌었습니다. 새로고침해주세요.');
}

// ── 저장소: 실제 DB(Supabase) 또는 데모(브라우저 저장소) ──
const DEMO_KEY='teamwork-demo-handovers';
function demoRows(){try{return JSON.parse(localStorage.getItem(DEMO_KEY)||'[]')}catch{return []}}
function demoSave(rows){try{localStorage.setItem(DEMO_KEY,JSON.stringify(rows))}catch{}}
async function listHandovers(ctx){
 if(ctx.demo)return demoRows();
 const {data,error}=await ctx.client.from('handovers').select('*').order('updated_at',{ascending:false});
 if(error)throw Error('인수인계서 저장소를 불러오지 못했습니다. supabase/handovers.sql 적용 여부를 확인해주세요. ('+error.message+')');
 return data;
}
export async function saveHandover(ctx,row,{share=false}={}){
 const items=handoverItems(row.items),receiver=row.receiver_id||null,me=ctx.member.id;
 if(row.id&&row.owner_id!==me)throw Error('본인이 작성한 인수인계서만 수정할 수 있습니다.');
 if(row.id&&row.status!=='draft')throw Error('인수인계된 문서는 수정할 수 없습니다. 회수 후 수정해주세요.');
 if(share&&!receiver)throw Error('인수받을 사람을 선택해주세요.');
 if(receiver&&receiver===me)throw Error('본인에게는 인수인계할 수 없습니다.');
 const values={items,receiver_id:receiver,status:share?'shared':'draft'};
 if(ctx.demo){const now=new Date().toISOString(),rows=demoRows(),saved={...rows.find(r=>r.id===row.id),...values,id:row.id||crypto.randomUUID(),owner_id:me,created_at:row.created_at||now,updated_at:now,reviewed_at:now,shared_at:share?now:null,confirmed_at:null};demoSave([saved,...rows.filter(r=>r.id!==saved.id)]);return saved;}
 let query=row.id?ctx.client.from('handovers').update(values).eq('id',row.id).eq('updated_at',row.updated_at):ctx.client.from('handovers').insert({...values,owner_id:me});
 const {data,error}=await query.select().single();
 if(error)throw Error('인수인계서를 저장하지 못했습니다. 새로고침 후 다시 시도해주세요. '+error.message);
 return data;
}
async function changeStatus(ctx,row,status){
 const me=ctx.member.id;
 if(status==='confirmed'&&(row.receiver_id!==me||row.status!=='shared'))throw Error('인수자로 지정된 사람만 확인 완료할 수 있습니다.');
 if(status==='draft'&&(row.owner_id!==me||row.status!=='shared'))throw Error('인계자만 확인 전 문서를 회수할 수 있습니다.');
 if(ctx.demo){const now=new Date().toISOString(),rows=demoRows().map(r=>r.id===row.id?{...r,status,updated_at:now,confirmed_at:status==='confirmed'?now:null,shared_at:status==='draft'?null:r.shared_at}:r);demoSave(rows);return;}
 const {data,error}=await ctx.client.from('handovers').update({status}).eq('id',row.id).eq('status','shared').select();
 if(error)throw Error('처리하지 못했습니다: '+error.message);
 if(!data.length)throw Error('이미 처리되었거나 권한이 없습니다. 새로고침해주세요.');
}
async function removeHandover(ctx,row){
 if(row.owner_id!==ctx.member.id||row.status!=='draft')throw Error('작성 중인 본인 문서만 삭제할 수 있습니다.');
 if(ctx.demo){demoSave(demoRows().filter(r=>r.id!==row.id));return;}
 const {data,error}=await ctx.client.from('handovers').delete().eq('id',row.id).eq('status','draft').select();
 if(error)throw Error('삭제하지 못했습니다: '+error.message);
 if(!data.length)throw Error('이미 인수인계되었거나 삭제되었습니다. 새로고침해주세요.');
}

// ── 서식 편집기(글자색·배경색·글자 크기·굵게·표 등) ──
const FONT_SIZES=[10,12,14,16,18,20,24,28,32];
function toolbarHTML(){
 const b=(cmd,label,title)=>'<button type="button" data-rt="'+cmd+'" title="'+title+'" aria-label="'+title+'">'+label+'</button>';
 return '<div class="rt-toolbar" role="toolbar" aria-label="서식 도구">'
  +'<select data-rt-size aria-label="글자 크기"><option value="">글자 크기</option>'+FONT_SIZES.map(n=>'<option value="'+n+'">'+n+'px</option>').join('')+'</select>'
  +'<label class="rt-color" title="글자색">가<input type="color" data-rt-color="foreColor" value="#d81b1b" aria-label="글자색"></label>'
  +'<label class="rt-color rt-bg" title="배경색">가<input type="color" data-rt-color="hiliteColor" value="#fff59d" aria-label="배경색"></label>'
  +'<span class="rt-sep"></span>'+b('bold','<b>B</b>','굵게')+b('italic','<i>I</i>','기울임')+b('underline','<u>U</u>','밑줄')+b('strikeThrough','<s>S</s>','취소선')
  +'<span class="rt-sep"></span>'+b('insertUnorderedList','• 목록','글머리 목록')+b('insertOrderedList','1. 목록','번호 목록')
  +b('justifyLeft','왼쪽','왼쪽 정렬')+b('justifyCenter','가운데','가운데 정렬')+b('justifyRight','오른쪽','오른쪽 정렬')
  +'<span class="rt-sep"></span><details class="rt-menu"><summary>표</summary><div class="rt-menu-body"><div class="rt-size-row"><label>행<input type="number" data-rt-rows min="1" max="30" value="3"></label><label>열<input type="number" data-rt-cols min="1" max="10" value="3"></label></div>'
  +b('table-insert','표 삽입','표 삽입')+'<hr>'+b('row-add','행 추가','아래에 행 추가')+b('col-add','열 추가','오른쪽에 열 추가')+b('row-del','행 삭제','현재 행 삭제')+b('col-del','열 삭제','현재 열 삭제')+b('table-del','표 삭제','현재 표 삭제')+'</div></details>'
  +'<span class="rt-sep"></span>'+b('removeFormat','서식 지우기','서식 지우기')+b('undo','↶','실행 취소')+b('redo','↷','다시 실행')+'</div>';
}
function bindRichEditor(wrap){
 const area=wrap.querySelector('.rt-area');let range=null;
 const inArea=node=>node&&area.contains(node.nodeType===1?node:node.parentNode);
 const remember=()=>{const sel=getSelection();if(sel.rangeCount&&inArea(sel.anchorNode))range=sel.getRangeAt(0).cloneRange();};
 area.addEventListener('keyup',remember);area.addEventListener('mouseup',remember);area.addEventListener('input',remember);area.addEventListener('blur',remember);
 const restore=()=>{area.focus();if(range){const sel=getSelection();sel.removeAllRanges();sel.addRange(range);}};
 const exec=(cmd,value=null,css=true)=>{restore();document.execCommand('styleWithCSS',false,css);document.execCommand(cmd,false,value);remember();};
 const cell=()=>{restore();const n=getSelection().anchorNode;const el=n&&(n.nodeType===1?n:n.parentElement);const c=el?.closest('td,th');return c&&area.contains(c)?c:null;};
 const newCell=tag=>{const c=document.createElement(tag==='th'?'th':'td');c.innerHTML='<br>';return c;};
 wrap.querySelectorAll('[data-rt]').forEach(btn=>{btn.addEventListener('mousedown',ev=>ev.preventDefault());btn.onclick=()=>{
  const cmd=btn.dataset.rt;
  if(cmd==='table-insert'){const rows=Math.min(30,Math.max(1,Number(wrap.querySelector('[data-rt-rows]').value)||3)),cols=Math.min(10,Math.max(1,Number(wrap.querySelector('[data-rt-cols]').value)||3));
   exec('insertHTML','<table><tbody>'+Array.from({length:rows},(_,r)=>'<tr>'+Array.from({length:cols},()=>r===0?'<th><br></th>':'<td><br></td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>');wrap.querySelector('.rt-menu').open=false;return;}
  if(['row-add','col-add','row-del','col-del','table-del'].includes(cmd)){const c=cell();if(!c){alert('표 안의 칸을 먼저 선택해주세요.');return;}const tr=c.parentElement,table=c.closest('table'),index=[...tr.children].indexOf(c);
   if(cmd==='row-add'){const row=document.createElement('tr');[...tr.children].forEach(()=>row.append(newCell('td')));tr.after(row);}
   if(cmd==='col-add')table.querySelectorAll('tr').forEach(r=>{const ref=r.children[index];(ref?ref.after.bind(ref):r.append.bind(r))(newCell(ref?.tagName.toLowerCase()));});
   if(cmd==='row-del'){if(table.querySelectorAll('tr').length>1)tr.remove();else table.remove();}
   if(cmd==='col-del'){if(tr.children.length>1)table.querySelectorAll('tr').forEach(r=>r.children[index]?.remove());else table.remove();}
   if(cmd==='table-del')table.remove();
   area.dispatchEvent(new Event('input'));return;}
  exec(cmd);
 };});
 wrap.querySelector('[data-rt-size]').onchange=ev=>{const px=ev.target.value;ev.target.value='';if(!px)return;exec('fontSize','7',false);
  const spans=[...area.querySelectorAll('font[size="7"]')].map(f=>{const s=document.createElement('span');s.style.fontSize=px+'px';s.append(...f.childNodes);f.replaceWith(s);return s;});
  area.querySelectorAll('span[style*="xxx-large"]').forEach(s=>{s.style.fontSize=px+'px';spans.push(s);});
  if(spans.length){const r=document.createRange();r.setStartBefore(spans[0]);r.setEndAfter(spans.at(-1));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);range=r.cloneRange();}};
 wrap.querySelectorAll('[data-rt-color]').forEach(input=>{input.onchange=()=>exec(input.dataset.rtColor,input.value);});
 area.addEventListener('paste',ev=>{const html=ev.clipboardData?.getData('text/html');if(!html)return;ev.preventDefault();exec('insertHTML',sanitizeRichText(html));});
}

// ── 화면 ──
let demoViewer='';
const fmt=d=>d?new Date(d).toLocaleString('ko-KR',{dateStyle:'short',timeStyle:'short'}):'-';
function urlsHTML(urls){return urls?.length?'<ul class="handover-urls">'+urls.map(u=>'<li><a href="'+e(u)+'" target="_blank" rel="noopener noreferrer">'+e(u)+'</a></li>').join('')+'</ul>':'<p class="muted">없음</p>';}
export function handoverBody(h,members){
 const name=id=>members.find(m=>m.id===id)?.name||'미지정';
 return '<p class="muted">인계자 '+e(name(h.owner_id))+' → 인수자 '+e(h.receiver_id?name(h.receiver_id):'미지정')+' · '+e(handoverStatus[h.status]||h.status)+'</p>'
  +(h.items||[]).map((i,n)=>'<section class="handover-view-item"><h3>업무 '+(n+1)+'. '+e(i.task)+'</h3><h4>업무 세부 내용</h4><div class="rich-content">'+(sanitizeRichText(i.details)||'<p class="muted">없음</p>')+'</div><h4>참고 URL</h4>'+urlsHTML(i.urls)+'</section>').join('');
}
export async function handoverPage(ctx){
 const realMember=ctx.member,today=ctx.today||kstDate(Date.now()),quarter=quarterOf(today);
 if(ctx.demo){demoViewer||=realMember.id;ctx={...ctx,member:ctx.members.find(m=>m.id===demoViewer)||realMember};}
 const me=ctx.member,manager=isHandoverManager(me),name=id=>ctx.members.find(m=>m.id===id)?.name||'미지정';
 let rows=[],error='';
 try{rows=visibleHandovers(await listHandovers(ctx),me);}catch(err){error=err.message;}
 if(!ctx.isActive())return;
 const reload=()=>handoverPage({...ctx,member:realMember});
 const received=rows.filter(r=>r.receiver_id===me.id&&r.status!=='draft'),mine=rows.filter(r=>r.owner_id===me.id&&r.status!=='confirmed');
 const stale=staleHandovers(rows,me.id,today);if(!ctx.demo||me.id===realMember.id)ctx.setReminder?.(stale.length);
 const refreshCell=r=>r.status==='confirmed'?'<span class="muted">-</span>':needsRefresh(r,today)?'<span class="pill hold">최신화 필요</span><br><span class="muted">최근 '+e(kstDate(lastReviewed(r)))+'</span>':'<span class="pill done">'+quarter.quarter+'분기 완료</span><br><span class="muted">'+e(kstDate(lastReviewed(r)))+'</span>';
 const pill=s=>'<span class="pill'+(s==='confirmed'?' done':s==='draft'?' hold':'')+'">'+e(handoverStatus[s]||s)+'</span>';
 const act=(k,id,label,primary)=>'<button type="button" data-ho-'+k+'="'+e(id)+'"'+(primary?' class="primary"':'')+'>'+label+'</button>';
 const table=(head,body,empty)=>body.length?'<div class="table-wrap"><table class="handover-table"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+body.join('')+'</tbody></table></div>':'<p class="empty">'+empty+'</p>';
 const demoSwitch=ctx.demo?'<label class="handover-demo-switch">데모 사용자 전환<select id="ho-viewer">'+ctx.members.map(m=>'<option value="'+e(m.id)+'"'+(m.id===me.id?' selected':'')+'>'+e(m.name)+(m.role==='admin'?' (관리자/책임자)':'')+'</option>').join('')+'</select></label>':'';
 ctx.shell('<div class="topline"><div><h1>인수인계서</h1><p>작성한 인수인계서는 본인에게만 보이며, 인수인계하면 인수자에게 공유됩니다. 인수자가 확인 완료하면 인계자 목록에서 사라집니다.</p></div><div class="actions">'+demoSwitch+'<button id="ho-refresh">새로고침</button><button id="ho-new" class="primary" '+(error?'disabled':'')+'>+ 작성</button></div></div>'
  +(error?'<section class="panel"><p class="error">'+e(error)+'</p><a href="https://github.com/ojungin/monthly/blob/main/supabase/handovers.sql" target="_blank" rel="noopener">DB 설정 SQL 보기</a></section>':
  (stale.length?'<div class="handover-reminder" role="alert"><strong>분기 최신화 알림</strong> '+e(refreshReminder(stale.length,today))+' 내용이 그대로라면 <b>최신화 확인</b>을, 바꿀 내용이 있으면 <b>수정</b> 후 저장해주세요. 인수인계 중인 문서는 회수 후 수정할 수 있습니다.</div>':'')
  +'<section class="panel"><h2>인수받은 인수인계서 <span class="muted">'+received.length+'건</span></h2>'+table(['주요 업무','인계자','상태','공유일','확인일','관리'],received.map(r=>'<tr><td>'+e(handoverTitle(r))+'</td><td>'+e(name(r.owner_id))+'</td><td>'+pill(r.status)+'</td><td>'+fmt(r.shared_at)+'</td><td>'+fmt(r.confirmed_at)+'</td><td class="actions">'+act('view',r.id,'보기')+(r.status==='shared'?act('confirm',r.id,'확인 완료',true):'')+'</td></tr>'),'인수받은 인수인계서가 없습니다.')+'</section>'
  +'<section class="panel"><h2>내가 작성한 인수인계서 <span class="muted">'+mine.length+'건</span></h2>'+table(['주요 업무','인수자','상태','최신화','관리'],mine.map(r=>'<tr'+(needsRefresh(r,today)?' class="handover-stale"':'')+'><td>'+e(handoverTitle(r))+'</td><td>'+e(r.receiver_id?name(r.receiver_id):'미지정')+'</td><td>'+pill(r.status)+'</td><td>'+refreshCell(r)+'</td><td class="actions">'+act('view',r.id,'보기')+act('review',r.id,'최신화 확인',needsRefresh(r,today))+(r.status==='draft'?act('edit',r.id,'수정')+act('share',r.id,'인수인계',true)+act('delete',r.id,'삭제'):act('recall',r.id,'회수'))+'</td></tr>'),'작성한 인수인계서가 없습니다. 상단의 + 작성을 눌러 시작하세요.')+'</section>'
  +(manager?'<section class="panel"><h2>전체 인수인계 현황 <span class="muted">관리자/책임자 · '+rows.length+'건 · '+e(quarter.label)+' 최신화 필요 '+rows.filter(r=>needsRefresh(r,today)).length+'건</span></h2>'+table(['인계자','인수자','주요 업무','상태','최신화','공유일','확인일','관리'],rows.map(r=>'<tr'+(needsRefresh(r,today)?' class="handover-stale"':'')+'><td>'+e(name(r.owner_id))+'</td><td>'+e(r.receiver_id?name(r.receiver_id):'미지정')+'</td><td>'+e(handoverTitle(r))+'</td><td>'+pill(r.status)+'</td><td>'+refreshCell(r)+'</td><td>'+fmt(r.shared_at)+'</td><td>'+fmt(r.confirmed_at)+'</td><td>'+act('view',r.id,'보기')+'</td></tr>'),'등록된 인수인계서가 없습니다.')+'</section>':''))
  +'<dialog id="ho-dialog" class="handover-dialog" aria-labelledby="ho-dialog-title"></dialog>');
 const dialog=document.getElementById('ho-dialog'),find=id=>rows.find(r=>r.id===id);
 document.getElementById('ho-refresh').onclick=()=>ctx.run(reload);
 if(ctx.demo)document.getElementById('ho-viewer').onchange=ev=>{demoViewer=ev.target.value;ctx.run(reload);};
 if(error)return;
 const others=ctx.members.filter(m=>m.id!==me.id);
 function openEditor(row,shareNow=false){
  const draft=structuredClone(row||{items:[blankHandoverItem()],receiver_id:'',status:'draft'});
  const itemHTML=(i,n)=>'<section class="handover-item" data-ho-item><div class="item-head"><h3>업무 '+(n+1)+'</h3><button type="button" data-ho-remove '+(draft.items.length<2?'hidden':'')+'>업무 삭제</button></div>'
   +'<div class="field"><label>주요 업무<input data-ho-field="task" maxlength="'+MAX_TASK+'" value="'+e(i.task)+'" placeholder="예) 제휴 세미나 운영"></label></div>'
   +'<div class="field"><span class="rt-label">업무 세부 내용</span><div class="rt-editor">'+toolbarHTML()+'<div class="rt-area rich-content" contenteditable="true" role="textbox" aria-multiline="true" aria-label="업무 세부 내용 '+(n+1)+'">'+sanitizeRichText(i.details)+'</div></div><p class="muted">Word·엑셀에서 표를 복사해 붙여넣을 수 있습니다. 그림은 붙여넣어지지 않습니다.</p></div>'
   +'<div class="field"><label>참고 URL <span class="muted">(한 줄에 하나씩)</span><textarea data-ho-field="urls" rows="2" placeholder="https://">'+e(Array.isArray(i.urls)?i.urls.join('\n'):String(i.urls||''))+'</textarea></label></div></section>';
  const capture=()=>{draft.items=[...dialog.querySelectorAll('[data-ho-item]')].map(el=>({task:el.querySelector('[data-ho-field="task"]').value,details:el.querySelector('.rt-area').innerHTML,urls:el.querySelector('[data-ho-field="urls"]').value}));draft.receiver_id=dialog.querySelector('#ho-receiver').value;};
  const draw=()=>{
   dialog.innerHTML='<form method="dialog" class="handover-form"><header><h2 id="ho-dialog-title">인수인계서 '+(row?'수정':'작성')+'</h2><button type="button" data-ho-close aria-label="닫기">✕</button></header><div class="handover-dialog-body">'
    +draft.items.map(itemHTML).join('')+'<button type="button" id="ho-add-item" class="handover-add">+ 업무 추가</button></div>'
    +'<footer><label>인수받을 사람<select id="ho-receiver"><option value="">선택해주세요</option>'+others.map(m=>'<option value="'+e(m.id)+'"'+(m.id===draft.receiver_id?' selected':'')+'>'+e(m.name)+' · '+e(m.team)+'</option>').join('')+'</select></label><div class="actions"><button type="button" data-ho-close>취소</button><button type="button" id="ho-save">저장</button><button type="button" id="ho-handover" class="primary">인수인계</button></div><p class="error" id="ho-error"></p></footer></form>';
   dialog.querySelectorAll('.rt-editor').forEach(bindRichEditor);
   dialog.querySelectorAll('[data-ho-close]').forEach(b=>b.onclick=()=>{if(confirm('저장하지 않은 내용은 사라집니다. 닫을까요?'))dialog.close();});
   dialog.querySelector('#ho-add-item').onclick=()=>{capture();if(draft.items.length>=MAX_ITEMS){dialog.querySelector('#ho-error').textContent='업무는 '+MAX_ITEMS+'개까지 추가할 수 있습니다.';return;}draft.items.push(blankHandoverItem());draw();dialog.querySelector('[data-ho-item]:last-of-type [data-ho-field="task"]').focus();};
   dialog.querySelectorAll('[data-ho-remove]').forEach((b,n)=>b.onclick=()=>{capture();if(!confirm('업무 '+(n+1)+'을(를) 삭제할까요?'))return;draft.items.splice(n,1);draw();});
   const submit=share=>ctx.run(async()=>{capture();try{
    if(share&&!draft.receiver_id)throw Error('인수받을 사람을 선택해주세요.');
    if(share&&!confirm(name(draft.receiver_id)+'님에게 인수인계할까요? 인수인계 후에는 회수하기 전까지 수정할 수 없습니다.'))return;
    await saveHandover(ctx,{...draft,id:row?.id,owner_id:row?.owner_id,updated_at:row?.updated_at,created_at:row?.created_at,status:row?.status||'draft'},{share});
    dialog.close();ctx.toast(share?name(draft.receiver_id)+'님에게 인수인계했습니다.':'인수인계서를 저장했습니다.');await reload();
   }catch(err){dialog.querySelector('#ho-error').textContent=err.message;}});
   dialog.querySelector('#ho-save').onclick=()=>submit(false);
   dialog.querySelector('#ho-handover').onclick=()=>submit(true);
  };
  draw();dialog.showModal();
  if(shareNow)dialog.querySelector('#ho-receiver').focus();else dialog.querySelector('[data-ho-field="task"]').focus();
 }
 function openView(h){
  const canConfirm=h.receiver_id===me.id&&h.status==='shared';
  dialog.innerHTML='<div class="handover-form"><header><h2 id="ho-dialog-title">'+e(handoverTitle(h))+'</h2><button type="button" data-ho-close aria-label="닫기">✕</button></header><div class="handover-dialog-body">'+handoverBody(h,ctx.members)+'</div><footer><span></span><div class="actions"><button type="button" data-ho-close>닫기</button>'+(canConfirm?'<button type="button" id="ho-confirm-view" class="primary">확인 완료</button>':'')+'</div></footer></div>';
  dialog.querySelectorAll('[data-ho-close]').forEach(b=>b.onclick=()=>dialog.close());
  if(canConfirm)dialog.querySelector('#ho-confirm-view').onclick=()=>confirmDone(h);
  dialog.showModal();
 }
 const confirmDone=h=>ctx.run(async()=>{if(!confirm('인수인계 내용을 확인하셨나요? 확인 완료하면 인계자('+name(h.owner_id)+')의 목록에서 사라집니다.'))return;await changeStatus(ctx,h,'confirmed');if(dialog.open)dialog.close();ctx.toast('확인 완료했습니다.');await reload();});
 document.getElementById('ho-new').onclick=()=>openEditor(null);
 const on=(k,fn)=>document.querySelectorAll('[data-ho-'+k+']').forEach(b=>b.onclick=()=>fn(find(b.dataset['ho'+k[0].toUpperCase()+k.slice(1)])));
 on('view',openView);on('edit',h=>openEditor(h));on('share',h=>openEditor(h,true));on('confirm',confirmDone);
 on('review',h=>ctx.run(async()=>{if(!confirm('현재 내용이 최신 상태인지 확인하셨나요? '+quarter.label+' 최신화로 기록합니다.'))return;await markReviewed(ctx,h);ctx.toast('최신화했습니다.');await reload();}));
 on('recall',h=>ctx.run(async()=>{if(!confirm('인수인계를 회수할까요? 인수자에게 더 이상 보이지 않고 다시 수정할 수 있습니다.'))return;await changeStatus(ctx,h,'draft');ctx.toast('인수인계를 회수했습니다.');await reload();}));
 on('delete',h=>ctx.run(async()=>{if(!confirm('이 인수인계서를 삭제할까요?'))return;await removeHandover(ctx,h);ctx.toast('삭제했습니다.');await reload();}));
}
