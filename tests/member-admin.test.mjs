import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {memberInput,createMemberAccount,accountsTableHTML} from '../member-admin.mjs';
test('member input is normalised and validated',()=>{
 assert.deepEqual(memberInput({email:' Kim@Mcircle.biz ',name:' 김팀원 ',team:' 플랫폼운영팀 '}),{email:'kim@mcircle.biz',name:'김팀원',team:'플랫폼운영팀'});
 assert.throws(()=>memberInput({email:'kim',name:'a',team:'b'}),/이메일/);
 assert.throws(()=>memberInput({email:'a@b.co',name:'',team:'b'}),/이름과 소속/);
});
test('only managers can call the account function, and errors are explained',async()=>{
 await assert.rejects(createMemberAccount({member:{role:'member'},get client(){throw Error('no call')}},{email:'a@b.co',name:'a',team:'b'}),/관리자/);
 const calls=[];const ok={member:{role:'admin'},client:{functions:{invoke:async(name,opts)=>{calls.push([name,opts.body]);return {data:{id:'1',created:true},error:null}}}}};
 assert.deepEqual(await createMemberAccount(ok,{email:'A@b.co',name:'가',team:'나'}),{id:'1',created:true});
 assert.deepEqual(calls,[['member-admin',{action:'create',email:'a@b.co',name:'가',team:'나'}]]);
 const missing={member:{role:'admin'},client:{functions:{invoke:async()=>({data:null,error:{context:{status:404,json:async()=>({})}}})}}};
 await assert.rejects(createMemberAccount(missing,{email:'a@b.co',name:'a',team:'b'}),/HTTP 404.*배포/);
 const denied={member:{role:'admin'},client:{functions:{invoke:async()=>({data:null,error:{context:{status:403,json:async()=>({error:'관리자/책임자만 팀원 계정을 등록할 수 있습니다.'})}}})}}};
 await assert.rejects(createMemberAccount(denied,{email:'a@b.co',name:'a',team:'b'}),/HTTP 403.*관리자/);
});
test('account overview flags duplicate emails and unregistered accounts, escaping values',()=>{
 const html=accountsTableHTML([{id:'1',email:'oj@x.biz',is_member:true},{id:'2',email:'OJ@x.biz',is_member:false},{id:'3',email:'<b>@x.biz',is_member:false}],[{id:'1',name:'오정인',team:'팀',role:'admin'}]);
 assert.match(html,/같은 이메일 중복 2개/);assert.match(html,/팀원 미등록 2개/);assert.match(html,/관리자\/책임자/);
 assert.match(html,/data-register-email="OJ@x.biz"/);assert(!html.includes('<b>@'));
});
test('edge function checks the caller is an admin before using the service key, and SQL keeps lookup server-only',async()=>{
 const fn=await readFile(new URL('../supabase/functions/member-admin/index.ts',import.meta.url),'utf8'),sql=await readFile(new URL('../supabase/member-accounts.sql',import.meta.url),'utf8');
 assert(fn.indexOf("rows[0]?.role!=='admin'")<fn.indexOf('const admin={apikey:secret'),'admin check first');
 assert.match(fn,/email_confirm:true/);assert.match(fn,/role:'member'/);assert.match(fn,/DELETE/);assert(!/^import /m.test(fn));
 assert.match(sql,/revoke all on function public\.auth_user_id_by_email\(text\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.auth_user_id_by_email\(text\) to service_role/);
 assert.match(sql,/if not public\.is_admin\(\) then raise exception/);
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');assert.match(app,/createMemberAccount\(\{client,member:me\}/);assert(!app.includes("rpc('register_team_member'"));
});
