import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {executiveBody} from '../portal.mjs';
import {generateExecutiveReport} from '../report-ai.mjs';

test('executive document escapes content and includes saved-source comparisons',()=>{
 const html=executiveBody({week:'2026-10-26',source_created_at:'2026-10-27',executive:{headline:'<script>bad</script>',metrics:[{platform:'닥터빌',name:'WAU',previous:'100명',current:'120명',change:'+20명'}],achievements:['작업 완료'],issues:[],next_steps:['검토 예정']}});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('+20명'));assert.ok(html.includes('검토 예정'));
});
test('client requires a matching response from the new server version',async()=>{
 const old={functions:{invoke:async()=>({data:{document:{}},error:null})}};
 await assert.rejects(generateExecutiveReport(old,'doc'),/최신 버전/);
 const current={functions:{invoke:async()=>({data:{executive:{},source_document_id:'doc'},error:null})}};
 assert.equal((await generateExecutiveReport(current,'doc')).source_document_id,'doc');
});
test('edge requires administrator, rate-limit claim, and uses original metric values',async()=>{
 const code=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/report-ai/index.ts',import.meta.url),'utf8'));
 const id='11111111-1111-1111-1111-111111111111';
 const doc={id,kind:'weekly',period:'2026-10-26',created_by:'another-admin',created_at:'2026-10-27',snapshot:{ai_summary:{issues:[],plans:[]},reports:[{id:'r'}],metrics:{sections:[{title:'회원',rows:[{platform:'닥터빌',label:'WAU',value:120,previous:100,unit:'명'}]}]}}};
 let handler,role='admin',claimed=false,calls=0;
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const fetch=async(url,opts={})=>{
  if(url.endsWith('/auth/v1/user'))return response({id:'u'});
  if(url.includes('report_documents?select=*'))return response([doc]);
  if(url.includes('members?select=role'))return response([{role}]);
  if(url.endsWith('/rpc/claim_executive_report_ai')){claimed=true;return new Response(null,{status:204});}
  if(url==='https://api.openai.com/v1/responses'){
   assert.ok(claimed);calls++;return response({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({headline:'요약',metrics:[{platform:'닥터빌',name:'WAU',current:'9999명',previous:'0',change:'허위'}],achievements:['성과'],issues:[],next_steps:[]})}]}]});
  }
  throw Error('unexpected '+url);
 };
 const context={Deno:{env:{get:k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',OPENAI_API_KEY:'fake-test-only'})[k]},serve:f=>handler=f},fetch,Response,AbortSignal,console,Set,Date,JSON,Error};
 vm.createContext(context);vm.runInContext(code,context);
 const request=()=>new Request('https://example/report-ai',{method:'POST',headers:{authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({document_id:id,mode:'executive'})});
 // void RPC is intentionally checked here; the server must handle HTTP 204.
 const result=await handler(request());const data=await result.json();assert.equal(result.status,200,JSON.stringify(data));assert.equal(data.executive.metrics[0].current,'120명');assert.equal(data.executive.metrics[0].previous,'100명');assert.equal(data.executive.metrics[0].change,'+20명');
 role='member';claimed=false;assert.equal((await handler(request())).status,403);assert.equal(claimed,false);assert.equal(calls,1);
});
