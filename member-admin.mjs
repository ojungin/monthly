// 팀원 관리: 관리자/책임자가 사이트에서 로그인 계정을 만들고 팀원으로 등록합니다(Edge Function member-admin).
import {escapeHTML as e} from './core.mjs?v=20261105-memberrole';
export const canRegisterMembers=member=>member?.role==='admin';
export function memberInput(v){
 const email=String(v.email??'').trim().toLowerCase(),name=String(v.name??'').trim(),team=String(v.team??'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('이메일 형식을 확인해주세요.');
 if(!name||name.length>100||!team||team.length>100)throw Error('이름과 소속을 1~100자로 입력해주세요.');
 return {email,name,team};
}
export async function createMemberAccount(ctx,values){
 if(!canRegisterMembers(ctx.member))throw Error('관리자/책임자만 팀원 계정을 등록할 수 있습니다.');
 const input=memberInput(values);
 const {data,error}=await ctx.client.functions.invoke('member-admin',{body:{action:'create',...input}});
 if(error||data?.error){
  let detail=data?.error||'';const context=error?.context,status=context?.status;
  if(!detail&&typeof context?.json==='function'){try{const body=await (context.clone?context.clone():context).json();detail=body.error||body.message||'';}catch{}}
  if(!detail)detail=status===404?'member-admin 함수가 배포되어 있지 않습니다. docs/member-admin-setup.md를 확인해주세요.':status===401?'로그인이 만료되었거나 함수의 JWT 검증 설정을 꺼야 합니다. 다시 로그인 후 시도해주세요.':'계정 등록 서버에 연결하지 못했습니다. 함수 배포 상태를 확인해주세요.';
  throw Error('계정 등록 실패'+(status?' (HTTP '+status+')':'')+': '+detail);
 }
 return data;
}
export async function loadAccounts(ctx){
 if(ctx.demo)return ctx.members.map((m,n)=>({id:m.id,email:m.email||(['minsu','jiyeon','junho'][n]||'member'+n)+'@example.com',created_at:'2026-01-0'+(n+1)+'T00:00:00Z',last_sign_in_at:n===2?null:'2026-11-0'+(n+1)+'T00:00:00Z',is_member:true}));
 const {data,error}=await ctx.client.rpc('admin_member_accounts');
 if(error)throw Error('로그인 계정 현황을 불러오지 못했습니다. supabase/member-accounts.sql 적용 여부를 확인해주세요. ('+error.message+')');
 return data;
}
const day=v=>v?new Date(v).toLocaleDateString('ko-KR'):'-';
export function accountsTableHTML(accounts,members){
 const count=new Map();accounts.forEach(a=>{const k=String(a.email||'').toLowerCase();count.set(k,(count.get(k)||0)+1)});
 const dup=accounts.filter(a=>count.get(String(a.email||'').toLowerCase())>1).length,unregistered=accounts.filter(a=>!a.is_member).length;
 return '<p class="muted">로그인 계정 '+accounts.length+'개 · 팀원 미등록 '+unregistered+'개'+(dup?' · <b class="error">같은 이메일 중복 '+dup+'개</b>':'')+'</p>'
  +'<div class="table-wrap"><table class="account-table"><thead><tr><th>이메일</th><th>팀원 등록</th><th>권한</th><th>계정 생성일</th><th>최근 로그인</th><th>계정 ID</th><th>관리</th></tr></thead><tbody>'
  +accounts.map(a=>{const m=members.find(x=>x.id===a.id),isDup=count.get(String(a.email||'').toLowerCase())>1;
   return '<tr'+(isDup?' class="account-dup"':'')+'><td>'+e(a.email||'(이메일 없음)')+(isDup?' <span class="pill hold">중복</span>':'')+'</td><td>'+(m?e(m.name)+' · '+e(m.team):'<span class="pill hold">미등록</span>')+'</td><td>'+(m?(m.role==='admin'?'관리자/책임자':'일반 팀원'):'-')+'</td><td>'+day(a.created_at)+'</td><td>'+(a.last_sign_in_at?day(a.last_sign_in_at):'<span class="muted">로그인 기록 없음</span>')+'</td><td class="muted small">'+e(a.id)+'</td><td>'+(m?'':'<button type="button" data-register-email="'+e(a.email||'')+'">팀원으로 등록</button>')+'</td></tr>';}).join('')
  +'</tbody></table></div>'+(dup?'<p class="muted">같은 이메일이 여러 개이면 최근 로그인 기록과 팀원 등록 여부를 비교해 사용하지 않는 계정을 Supabase Authentication > Users에서 삭제해주세요. 보고 이력이 있는 계정은 삭제하면 보고도 함께 지워지므로 먼저 확인이 필요합니다.</p>':'');
}
