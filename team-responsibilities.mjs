import {escapeHTML as e} from './core.mjs';
export const canManageResponsibilities=member=>member?.role==='admin';
export function responsibilityValues(row){
 const result={};
 for(const [key,label,max] of [['name','이름',100],['position','직책',100],['duties','업무내용',10000]]){
  const value=String(row[key]??'').trim();
  if(!value||value.length>max)throw Error(label+'을 1~'+max+'자로 입력해주세요.');
  result[key]=value;
 }
 return result;
}
export async function persistResponsibility(ctx,row,remove=false){
 if(!canManageResponsibilities(ctx.member))throw Error('관리자/책임자만 작성·수정·삭제할 수 있습니다.');
 if(remove&&!row.id) return null;
 const values=remove?null:responsibilityValues(row);
 if(ctx.demo)return remove?null:{...row,...values,id:row.id||crypto.randomUUID(),updated_at:new Date().toISOString()};
 let query;
 if(remove)query=ctx.client.from('team_responsibilities').delete();
 else if(row.id)query=ctx.client.from('team_responsibilities').update(values);
 else query=ctx.client.from('team_responsibilities').insert({...values,created_by:ctx.user.id});
 if(row.id)query=query.eq('id',row.id).eq('updated_at',row.updated_at);
 const {data,error}=await query.select().single();
 if(error)throw Error('저장하지 못했습니다. 다른 사용자가 변경했다면 새로고침 후 다시 시도해주세요. '+error.message);
 return remove?null:data;
}
export function responsibilityTable(rows){
 return '<table><colgroup><col style="width:15%"><col style="width:15%"><col style="width:70%"></colgroup><thead><tr><th>이름</th><th>직책</th><th>업무내용</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+e(r.name)+'</td><td>'+e(r.position)+'</td><td>'+e(r.duties)+'</td></tr>').join('')+'</tbody></table>';
}
let pdfPromise;
async function exportPDF(rows){
 if(!rows.length)throw Error('출력할 업무 R&R이 없습니다.');
 pdfPromise||=new Promise((resolve,reject)=>{
  if(window.html2pdf)return resolve(window.html2pdf);
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  s.onload=()=>resolve(window.html2pdf);
  s.onerror=()=>{pdfPromise=null;reject(Error('PDF 모듈을 불러오지 못했습니다. 다시 시도해주세요.'));};
  document.head.append(s);
 });
 const pdf=await pdfPromise,host=document.createElement('div');
 host.style.cssText='width:1000px;background:white;color:#222;padding:20px';
 host.innerHTML='<style>.rr-export{font:14px "Malgun Gothic",Arial,sans-serif}.rr-export table{width:100%;table-layout:fixed;border-collapse:collapse}.rr-export th,.rr-export td{border:1px solid #777;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;vertical-align:top}.rr-export th{background:#eaeef2}.rr-export tr{break-inside:avoid}</style><article class="rr-export"><h1>팀 업무 R&amp;R</h1>'+responsibilityTable(rows)+'</article>';
 document.body.append(host);
 try{await document.fonts.ready;await pdf().set({margin:10,filename:'팀_업무_RR.pdf',html2canvas:{scale:2,scrollY:0},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'},pagebreak:{mode:['css','legacy'],avoid:['tr']}}).from(host).save();}finally{host.remove();}
}
let demoRows=[];
export async function teamResponsibilitiesPage(ctx){
 const manager=canManageResponsibilities(ctx.member);
 let rows=[],error='';
 if(ctx.demo)rows=structuredClone(demoRows);
 else{
  const result=await ctx.client.from('team_responsibilities').select('*').order('created_at').order('id');
  if(result.error)error='팀 업무 R&R 저장소를 불러오지 못했습니다. DB 설정 SQL 적용 여부와 연결 상태를 확인해주세요.';
  else rows=result.data;
 }
 if(!ctx.isActive())return;
 const capture=()=>{if(manager)document.querySelectorAll('[data-rr-row]').forEach(el=>{
  const row=rows[Number(el.dataset.rrRow)];
  el.querySelectorAll('[data-rr-field]').forEach(f=>row[f.dataset.rrField]=f.value);
 });};
 function draw(){
  if(!ctx.isActive())return;
  ctx.shell('<div class="topline"><div><h1>팀 업무 R&amp;R</h1><p>팀원의 직책과 담당 업무를 함께 확인합니다.</p></div><div class="actions"><button id="rr-refresh">새로고침</button><button id="rr-pdf" '+(!rows.length||error?'disabled':'')+'>PDF 출력</button>'+(manager&&!error?'<button id="rr-add" class="primary">인원 추가</button>':'')+'</div></div><section class="panel">'+(error?'<p class="error">'+e(error)+'</p><a href="https://github.com/ojungin/monthly/blob/main/supabase/team-responsibilities.sql" target="_blank" rel="noopener">DB 설정 SQL 보기</a>':'<p class="muted">'+(manager?'행별로 입력한 후 저장해주세요. 삭제는 이 표의 업무 배정에만 적용됩니다.':'팀원은 열람과 PDF 출력이 가능합니다.')+'</p><datalist id="rr-names">'+ctx.members.map(m=>'<option value="'+e(m.name)+'"></option>').join('')+'</datalist><div class="table-wrap">'+(manager?'<table style="table-layout:fixed;width:100%;min-width:720px"><colgroup><col style="width:15%"><col style="width:15%"><col style="width:55%"><col style="width:15%"></colgroup><thead><tr><th>이름</th><th>직책</th><th>업무내용</th><th>관리</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr data-rr-row="'+i+'"><td><input aria-label="이름 '+(i+1)+'" data-rr-field="name" list="rr-names" maxlength="100" value="'+e(r.name)+'"></td><td><input aria-label="직책 '+(i+1)+'" data-rr-field="position" maxlength="100" value="'+e(r.position)+'"></td><td><textarea aria-label="업무내용 '+(i+1)+'" data-rr-field="duties" maxlength="10000" rows="5">'+e(r.duties)+'</textarea></td><td><button data-rr-save="'+i+'">저장</button><button data-rr-delete="'+i+'">삭제</button></td></tr>').join('')+'</tbody></table>':responsibilityTable(rows))+'</div>'+(!rows.length?'<p class="empty">등록된 업무 R&R이 없습니다.</p>':''))+'</section>');
  document.getElementById('rr-refresh').onclick=()=>ctx.run(()=>teamResponsibilitiesPage(ctx));
  document.getElementById('rr-pdf').onclick=()=>ctx.run(async()=>{capture();const valid=rows.map(responsibilityValues);await exportPDF(valid);});
  if(!manager||error)return;
  document.getElementById('rr-add').onclick=()=>{capture();rows.push({name:'',position:'',duties:''});draw();document.querySelector('[data-rr-row]:last-child input')?.focus();};
  document.querySelectorAll('[data-rr-save]').forEach(b=>b.onclick=()=>ctx.run(async()=>{
   capture();const i=Number(b.dataset.rrSave);rows[i]=await persistResponsibility(ctx,rows[i]);if(ctx.demo)demoRows=rows.filter(r=>r.id).map(r=>({...r}));draw();ctx.toast('업무 R&R을 저장했습니다.');
  }));
  document.querySelectorAll('[data-rr-delete]').forEach(b=>b.onclick=()=>ctx.run(async()=>{
   capture();const i=Number(b.dataset.rrDelete);await persistResponsibility(ctx,rows[i],true);rows.splice(i,1);if(ctx.demo)demoRows=rows.filter(r=>r.id).map(r=>({...r}));draw();ctx.toast('업무 배정을 삭제했습니다.');
  }));
 }
 draw();
}
