import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
import {monthlyTaskDigest,monthlyReportModel} from '../monthly-report.mjs';
import {taskDigest,validSummary,sourceBoundSchema,summaryInstructions} from '../supabase/functions/_shared/summary.mjs';
const snap=()=>({id:'doc',month:'2026-10',created_at:'2026-11-02',author:'팀장',members:[{id:'a',name:'가상A'},{id:'b',name:'가상B'}],reports:[
 {id:'r2',user_id:'a',week_start:'2026-10-12',report_date:'2026-10-15',items:[{id:'t1',project:'콘텐츠 운영',service:'닥터빌',title:'세미나 운영',state:'진행',progress:80,result:'2차 완료'}],issues:'송출 지연 재발 없음',next_plan:'11월 일정 확정'},
 {id:'r1',user_id:'a',week_start:'2026-10-05',report_date:'2026-10-08',items:[{id:'t1',project:'콘텐츠 운영',service:'닥터빌',title:'세미나 운영',state:'진행',progress:50,result:'1차 진행\n- 신청 100명'},{project:'플랫폼 운영',service:'팜빌',title:'배너  교체',state:'진행',progress:30,result:'시안'}],issues:'송출 지연, 업체 조치',next_plan:'2차 준비'},
 {id:'r3',user_id:'b',week_start:'2026-10-12',report_date:'2026-10-16',items:[{project:'플랫폼 운영',service:'팜빌',title:'배너 교체',state:'완료',progress:100,result:'배포'},{project:'신규 분야',title:'조사',state:'보류',progress:10,result:''}],issues:'',next_plan:''},
 {id:'r4',user_id:'a',week_start:'2026-10-19',report_date:'2026-10-22',items:[{project:'플랫폼 운영',service:'팜빌',title:'배너 교체',state:'완료',progress:100,result:'최종 반영'}],issues:'',next_plan:''}]});
test('page and GPT function build the identical task list (same keys, order and latest state)',()=>{
 const a=monthlyTaskDigest(snap()),b=taskDigest(snap());assert.deepEqual(a,b);
 assert.deepEqual(a.map(t=>[t.task_key,t.owner,t.title,t.state,t.progress]),[['T01','가상A','세미나 운영','진행',80],['T02','가상A','배너 교체','완료',100],['T03','가상B','배너 교체','완료',100],['T04','가상B','조사','보류',10]]);
 assert.deepEqual(a[0].history.map(h=>h.report_id),['r1','r2']);assert.deepEqual(a[1].report_ids,['r1','r4']);
});
test('every task is listed under 3. 한 일 and 4. 할 일 with its own summary lines',()=>{
 const s=snap();s.ai_summary={overview:[],issues:[],plans:[],done:[],todo:[],metrics:[],tasks:[
  {task_key:'T01',done:['세미나 2회를 운영했음','신청 100명을 모집했음'],todo:['11월 일정을 확정할 예정임']},
  {task_key:'T02',done:['배너 교체를 반영했음'],todo:[]},{task_key:'T03',done:['배너 교체를 배포했음'],todo:[]},
  {task_key:'OTHER',done:['송출 지연에 업체 조치로 대응했음'],todo:[]}]};
 const r=monthlyReportModel(s),done=r.sections[1].body.map(l=>l.text||''),todo=r.sections[2].body.map(l=>l.text||'');
 for(const t of ['[콘텐츠 운영]','1. 세미나 운영 (닥터빌 · 가상A · 진행 80%)','(1) 세미나 2회를 운영했음','(2) 신청 100명을 모집했음','[플랫폼 운영]','1. 배너 교체 (팜빌 · 가상A · 완료 100%)','2. 배너 교체 (팜빌 · 가상B · 완료 100%)','[기타]','(1) 송출 지연에 업체 조치로 대응했음'])assert.ok(done.includes(t),t);
 assert.ok(done.includes('1. 조사 (공통 · 가상B · 보류 10%)'));// unknown category → 기타, summary missing → raw fallback
 assert.ok(done.includes('(1) 기재된 수행 내용 없음'));assert.ok(done.some(x=>/요약이 없는 업무는 주간 보고 원문/.test(x)));
 for(const t of ['(1) 11월 일정을 확정할 예정임','(1) 완료 · 후속 할 일 없음','(1) 보류 중 · 진행률 10%'])assert.ok(todo.includes(t),t);
});
test('documents whose summary has empty 한 일/할 일 still list every task from the weekly text instead of being blank',()=>{
 const s=snap();s.ai_summary={overview:[],issues:[],plans:[],done:[],todo:[],metrics:[]};
 const r=monthlyReportModel(s),done=r.sections[1].body.map(l=>l.text||''),todo=r.sections[2].body.map(l=>l.text||'');
 for(const t of ['(1) 1차 진행','(2) 신청 100명','(3) 2차 완료','(1) 시안','(2) 최종 반영'])assert.ok(done.includes(t),t);
 assert.ok(todo.includes('(1) 진행 중 · 진행률 80%'));assert.ok(todo.includes('1. 최근 주간 보고의 차주 계획'));assert.ok(todo.includes('(1) 가상A · 11월 일정 확정'));
 assert.ok(!done.includes('선택 월에 정리된 수행 내용 없음'));
});
test('per-task output is validated: unknown keys and long lists rejected, duplicates keep the first row, schema demands one row per task',()=>{
 const base={overview:[],issues:[],plans:[],done:[],todo:[],metrics:[]},keys=['T01','T02'];
 assert.throws(()=>validSummary({...base,tasks:[{task_key:'T09',done:[],todo:[]}]},['r1'],[],keys),/업무별/);
 assert.throws(()=>validSummary({...base,tasks:[{task_key:'T01',done:Array(7).fill('x'),todo:[]}]},['r1'],[],keys),/업무별/);
 const v=validSummary({...base,tasks:[{task_key:'T01',done:['a'],todo:[]},{task_key:'T01',done:['b'],todo:[]},{task_key:'OTHER',done:[],todo:['c']}]},['r1'],[],keys);
 assert.deepEqual(v.tasks.map(t=>t.done[0]||t.todo[0]),['a','c']);assert.deepEqual(validSummary({...base},['r1']).tasks,[]);
 const schema=sourceBoundSchema(['r1'],[],keys);assert.equal(schema.properties.tasks.minItems,2);assert.equal(schema.properties.tasks.maxItems,3);assert.deepEqual(schema.properties.tasks.items.properties.task_key.enum,['T01','T02','OTHER']);
 assert.ok(summaryInstructions.includes('task_key별로 정확히 한 행씩'));
});
test('monthly function sends the task list (without account ids) and stores per-task summaries',async()=>{
 const code=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/report-ai/index.ts',import.meta.url),'utf8'));
 const shared=await readFile(new URL('../supabase/functions/_shared/summary.mjs',import.meta.url),'utf8');const body=(src,name)=>src.slice(src.indexOf('function '+name),src.indexOf('\n}\n',src.indexOf('function '+name)));
 for(const n of ['taskDigest','metricHighlights'])assert.equal(body(code,n),body(shared,n),n);
 const s=snap(),id='11111111-1111-1111-1111-111111111111',doc={id,created_by:'u',kind:'monthly',period:'2026-10',snapshot:s};let handler,input,schema,saved;
 const res=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
 const fetch=async(url,o={})=>{if(url.endsWith('/auth/v1/user'))return res({id:'u'});if(url.includes('report_documents?select=*'))return res([doc]);if(url.endsWith('/rpc/claim_report_ai'))return new Response(null,{status:204});
  if(url==='https://api.openai.com/v1/responses'){const p=JSON.parse(o.body);input=JSON.parse(p.input);schema=p.text.format.schema;return res({status:'completed',model:'m',output:[{content:[{type:'output_text',text:JSON.stringify({overview:[],issues:[],plans:[],done:[],todo:[],metrics:[],tasks:[{task_key:'T01',done:['세미나 운영'],todo:[]}]})}]}]});}
  if(url.endsWith('/rpc/save_report_ai')){saved=JSON.parse(o.body).summary_data;return res({...doc,snapshot:{...s,ai_summary:saved}});}throw Error('unexpected '+url);};
 const ctx={Deno:{env:{get:k=>({SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'k',OPENAI_API_KEY:'fake'})[k]},serve:f=>handler=f},fetch,Response,AbortSignal,console,Set,Map,Date,JSON,Error,Number,Math,String,Object,Array};vm.createContext(ctx);vm.runInContext(code,ctx);
 const r=await handler(new Request('https://e/report-ai',{method:'POST',headers:{authorization:'Bearer t','Content-Type':'application/json'},body:JSON.stringify({document_id:id})}));
 assert.equal(r.status,200);assert.deepEqual(input.tasks.map(t=>t.task_key),['T01','T02','T03','T04']);assert.equal(input.tasks[0].user_id,undefined);assert.equal(input.tasks[0].history.length,2);
 assert.deepEqual(schema.properties.tasks.items.properties.task_key.enum,['T01','T02','T03','T04','OTHER']);assert.equal(saved.tasks[0].task_key,'T01');
});
