// 팀원 로그인 계정 생성·등록 Edge Function (관리자/책임자 전용). 단일 파일이므로 Dashboard Editor에 그대로 붙여넣어 배포합니다.
// 1) 호출자의 로그인 토큰으로 본인 확인 → members.role='admin'인지 확인
// 2) 같은 이메일의 로그인 계정이 있으면 재사용, 없으면 비밀번호 없는 계정을 만들고(이메일 인증 완료 처리)
// 3) members에 일반 팀원(role='member')으로 등록. 등록에 실패하면 이번에 만든 계정은 되돌립니다.
// 서비스 키는 이 함수 안에서만 쓰이며 브라우저로 전달되지 않습니다.
const cors={'Access-Control-Allow-Origin':'https://ojungin.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const detail=async(r:Response)=>{const t=await r.text();try{const e=JSON.parse(t);return e.msg||e.message||e.error_description||e.error||t;}catch{return t;}};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'POST 요청만 허용됩니다.'},405);
 const base=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('MEMBER_ADMIN_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!anon||!secret)return json({error:'함수 환경 변수(SUPABASE_URL, SUPABASE_ANON_KEY, 서비스 키)를 확인해주세요.'},500);
 const authorization=req.headers.get('authorization')||'';
 if(!/^Bearer\s+\S+/i.test(authorization))return json({error:'로그인이 필요합니다.'},401);
 try{
  // 호출자 확인(호출자 권한으로 조회하므로 RLS가 그대로 적용됩니다).
  const who=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization}});
  if(!who.ok)return json({error:'로그인 정보가 만료되었습니다. 다시 로그인해주세요.'},401);
  const caller=await who.json();
  const role=await fetch(base+'/rest/v1/members?select=role&id=eq.'+encodeURIComponent(caller.id),{headers:{apikey:anon,Authorization:authorization}});
  const rows=role.ok?await role.json():[];
  if(rows[0]?.role!=='admin')return json({error:'관리자/책임자만 팀원 계정을 등록할 수 있습니다.'},403);

  let body:any;try{body=await req.json();}catch{return json({error:'잘못된 요청입니다.'},400);}
  if(body?.action!=='create')return json({error:'지원하지 않는 요청입니다.'},400);
  const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim(),team=String(body.team||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:'이메일 형식을 확인해주세요.'},400);
  if(name.length<1||name.length>100||team.length<1||team.length>100)return json({error:'이름과 소속을 1~100자로 입력해주세요.'},400);

  const admin={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  const found=await fetch(base+'/rest/v1/rpc/auth_user_id_by_email',{method:'POST',headers:admin,body:JSON.stringify({account_email:email})});
  if(!found.ok)return json({error:'계정 조회에 실패했습니다. supabase/member-accounts.sql 적용 여부를 확인해주세요. ('+await detail(found)+')'},500);
  let id:string|null=await found.json(),created=false;
  if(!id){
   const made=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,email_confirm:true,user_metadata:{name,team}})});
   if(!made.ok)return json({error:'로그인 계정을 만들지 못했습니다: '+await detail(made)},400);
   id=(await made.json()).id;created=true;
  }
  const insert=await fetch(base+'/rest/v1/members',{method:'POST',headers:{...admin,Prefer:'return=representation'},body:JSON.stringify({id,name,team,role:'member'})});
  if(!insert.ok){
   const reason=insert.status===409?'already':await detail(insert);
   if(created)await fetch(base+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});
   if(reason==='already')return json({error:'이미 팀원으로 등록된 계정입니다: '+email},409);
   return json({error:'팀원 등록에 실패했습니다: '+reason},500);
  }
  return json({id,email,created});
 }catch(err){return json({error:'처리 중 오류가 발생했습니다: '+(err instanceof Error?err.message:String(err))},500);}
});
