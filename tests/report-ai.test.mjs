import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {weeklyBody} from '../weekly.mjs';import {documentHTML} from '../portal.mjs';import {validSummary,summarySchema} from '../supabase/functions/_shared/summary.mjs';
const base=()=>({week:'2026-10-05',month:'2026-10',created_at:'2026-10-10',author:'팀장',members:[{id:'u',name:'보고자'}],reports:[{id:'r',user_id:'u',week_start:'2026-10-05',status:'submitted',items:[{id:'t',title:'개발',project:'운영',state:'진행',progress:50,result:'화면 구현'}],issues:'원본 이슈',next_plan:'검증 진행'}]});
const summary=()=>({issues:[{topic:'서비스',summary:'장애 <조치> 완료',report_ids:['r']}],plans:[{topic:'테스트',summary:'검증 예정',report_ids:['r']}],done:[],todo:[],metrics:[]});
test('weekly summary tables precede collapsed original reporter tables with safe HTML',()=>{const s=base();s.ai_summary=summary();const html=weeklyBody(s),tail=html.slice(html.indexOf('5. 금주 이슈 및 대응'));assert.match(tail,/장애 &lt;조치&gt; 완료/);assert.match(tail,/<details class="report-original"><summary>펼쳐보기/);assert.ok(tail.indexOf('장애')<tail.indexOf('원본 이슈'));assert.match(tail,/报告者|보고자/);assert.match(tail,/검증 예정/);assert.ok(!tail.includes('<details open'));});
test('monthly report has metrics/done/todo and blank advisory; text is included in HTML export',()=>{const s=base(),html=documentHTML(s,'monthly');for(const title of ['1. 지표','2. 한 일','3. 할 일','4. 자문 요청사항'])assert.ok(html.includes(title));assert.ok(html.includes('진행 50%'));s.advisory_request='<검토 요청>';assert.ok(documentHTML(s,'monthly').includes('&lt;검토 요청&gt;'));s.ai_summary=summary();s.ai_summary.done=[{topic:'개발',summary:'화면 구현',report_ids:['r']}];assert.ok(documentHTML(s,'monthly').includes('화면 구현'));});
test('summary rejects missing sources and accepts actual report/metric document ids',()=>{assert.equal(validSummary(summary(),['r']).issues.length,1);const bad=summary();bad.plans[0].report_ids=['made-up'];assert.throws(()=>validSummary(bad,['r']),/출처/);const s=summary();s.metrics=[{platform:'팜빌',name:'회원',value:'100',comparison:'',source:'metric-doc'}];assert.throws(()=>validSummary(s,['r']),/출처/);assert.equal(validSummary(s,['r'],['metric-doc']).metrics.length,1);assert.equal(summarySchema.additionalProperties,false);});
test('edge function validates user and document before invoking OpenAI; secrets remain server-side',async()=>{const fn=await readFile(new URL('../supabase/functions/report-ai/index.ts',import.meta.url),'utf8');assert.ok(fn.indexOf("'/auth/v1/user'")<fn.indexOf("'https://api.openai.com/v1/responses'"));assert.match(fn,/doc.created_by!==user.id/);assert.match(fn,/store:false/);const app=await readFile(new URL('../app.js',import.meta.url),'utf8');assert.ok(!app.includes('OPENAI_API_KEY'));assert.match(app,/summarizeDocument\(client,d.id\)/);});

import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
test('edge function integration verifies auth, uses saved snapshot, persists GPT summary, reuses cache and blocks other users',async()=>{
 const code=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/report-ai/index.ts',import.meta.url),'utf8'));
 let handler,apiCalls=0,cached=false,wrongOwner=false,claimed=false;
 const id='11111111-1111-1111-1111-111111111111',doc={id,created_by:'u',kind:'monthly',period:'2026-10',snapshot:base()};
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const fakeFetch=async(url,options={})=>{
  if(url.endsWith('/auth/v1/user'))return response({id:'u'});
  if(url.includes('report_documents?select=*'))return response([{...doc,created_by:wrongOwner?'other':'u',snapshot:cached?{...base(),ai_summary:summary()}:base()}]);
  if(url.includes('report_documents?select=id'))return response([]);
  if(url.endsWith('/rpc/claim_report_ai')){claimed=true;return response(null);}
  if(url==='https://api.openai.com/v1/responses'){assert.ok(claimed);apiCalls++;const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(JSON.parse(payload.input).period,'2026-10');return response({status:'completed',model:'test',output:[{content:[{type:'output_text',text:JSON.stringify(summary())}]}]});}
  if(url.endsWith('/rpc/save_report_ai')){const payload=JSON.parse(options.body);return response({...doc,snapshot:{...base(),ai_summary:payload.summary_data}});}
  throw Error('unexpected endpoint '+url);
 };
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',OPENAI_API_KEY:'fake-test-only'};
 const context={Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},fetch:fakeFetch,Response,AbortSignal,console,Set,Date,JSON,Error};vm.createContext(context);vm.runInContext(code,context);
 const request=()=>new Request('https://example/report-ai',{method:'POST',headers:{authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({document_id:id})});
 const result=await handler(request());assert.equal(result.status,200);assert.ok((await result.json()).document.snapshot.ai_summary);assert.equal(apiCalls,1);
 cached=true;assert.equal((await handler(request())).status,200);assert.equal(apiCalls,1);
 wrongOwner=true;assert.equal((await handler(request())).status,403);assert.equal(apiCalls,1);
 assert.equal((await handler(new Request('https://example/report-ai',{method:'POST'}))).status,401);
});
