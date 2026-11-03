import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
import {monthlyTaskDigest,monthlyReportModel,linesToText,textToLines} from '../monthly-report.mjs';
import {taskDigest,validSummary,sourceBoundSchema,summaryInstructions} from '../supabase/functions/_shared/summary.mjs';
const snap=()=>({id:'doc',month:'2026-10',created_at:'2026-11-02',author:'팀장',members:[{id:'a',name:'가상A'},{id:'b',name:'가상B'}],reports:[
 {id:'r2',user_id:'a',week_start:'2026-10-12',report_date:'2026-10-15',items:[{id:'t1',project:'콘텐츠 운영',service:'닥터빌',title:'세미나 운영',state:'진행',progress:80,result:'2차 완료'}],issues:'송출 지연 재발 없음',next_plan:'11월 일정 확정'},
 {id:'r1',user_id:'a',week_start:'2026-10-05',report_date:'2026-10-08',items:[{id:'t1',project:'콘텐츠 운영',service:'닥터빌',title:'세미나 운영',state:'진행',progress:50,result:'1차 진행\n- 신청 100명'},{project:'플랫폼 운영',service:'팜빌',title:'배너  교체',state:'진행',progress:30,result:'시안'}],issues:'송출 지연, 업체 조치',next_plan:'2차 준비'},
 {id:'r3',user_id:'b',week_start:'2026-10-12',report_date:'2026-10-16',items:[{project:'플랫폼 운영',service:'팜빌',title:'배너 교체',state:'완료',progress:100,result:'배포'},{project:'신규 분야',title:'조사',state:'보류',progress:10,result:''}],issues:'',next_plan:''},
 {id:'r4',user_id:'a',week_start:'2026-10-19',report_date:'2026-10-22',items:[{project:'플랫폼 운영',service:'팜빌',title:'배너 교체',state:'완료',progress:100,result:'최종 반영'}],issues:'',next_plan:''}]});
test('page and GPT function build the identical task list (same keys, order and latest state)',()=>{
 const a=monthlyTaskDigest(snap()),b=taskDigest(snap());assert.deepEqual(a,b);
 assert.deepEqual(a.map(t=>[t.platform,t.work_area]),[['닥터빌','콘텐츠 운영'],['팜빌','플랫폼 운영'],['팜빌','플랫폼 운영'],['공통','기타']]);
 assert.deepEqual(a.map(t=>[t.task_key,t.owner,t.title,t.state,t.progress]),[['T01','가상A','세미나 운영','진행',80],['T02','가상A','배너 교체','완료',100],['T03','가상B','배너 교체','완료',100],['T04','가상B','조사','보류',10]]);
 assert.deepEqual(a[0].history.map(h=>h.report_id),['r1','r2']);assert.deepEqual(a[1].report_ids,['r1','r4']);
});
const G=(over={})=>({overview:[],issues:[],plans:[],done:[],todo:[],metrics:[],groups:[
 {platform:'닥터빌',title:'세미나 운영',task_keys:['T01'],done:['세미나 2회를 운영했음','신청 100명을 모집했음'],todo:['11월 일정을 확정할 예정임']},
 {platform:'팜빌',title:'배너 교체',task_keys:['T02','T03'],done:['배너 교체를 배포했음'],todo:[]},
 {platform:'공통',title:'기타',task_keys:[],done:['송출 지연에 업체 조치로 대응했음'],todo:[]}],...over});
const body=(r,i)=>r.sections[i].body.map(l=>[l.t,l.text||'']);
test('한 일 / 할 일 are split by platform, then work area, then similar-task groups',()=>{
 const s=snap();s.ai_summary=G();const r=monthlyReportModel(s),done=body(r,1),todo=body(r,2),txt=done.map(x=>x[1]);
 const order=['가. 닥터빌','[콘텐츠 운영]','1. 세미나 운영 (가상A · 진행 80%)','(1) 세미나 2회를 운영했음','(2) 신청 100명을 모집했음','나. 팜빌','[플랫폼 운영]','1. 배너 교체 (업무 2건 · 가상A·가상B)','· 대상 업무 : 배너 교체(가상A 완료 100%), 배너 교체(가상B 완료 100%)','(1) 배너 교체를 배포했음','다. 공통','[기타]','1. 조사 (가상B · 보류 10%)','(1) 기재된 수행 내용 없음','2. 업무에 연결되지 않은 이슈 대응','(1) 송출 지연에 업체 조치로 대응했음'];
 let at=-1;for(const t of order){const i=txt.indexOf(t);assert.ok(i>at,t);at=i;}
 assert.deepEqual(done.filter(x=>x[0]==='plat').map(x=>x[1]),['가. 닥터빌','나. 팜빌','다. 공통']);
 assert.ok(txt.some(x=>/요약이 없는 업무는 주간 보고 원문/.test(x)));// T04 missing from groups → raw fallback
 const tt=todo.map(x=>x[1]);
 for(const t of ['가. 닥터빌','(1) 11월 일정을 확정할 예정임','나. 공통','(1) 보류 중 · 진행률 10%','※ 완료되어 후속 할 일이 없는 업무 2건은 제외함'])assert.ok(tt.includes(t),t);
 assert.ok(!tt.includes('나. 팜빌'),'fully completed groups without follow-up are left out of 할 일');
});
test('a GPT group cannot mix platforms or reuse a task; leftovers fall back to same-title groups from the weekly text',()=>{
 const s=snap();s.ai_summary=G({groups:[{platform:'닥터빌',title:'혼합',task_keys:['T01','T02'],done:['세미나 운영'],todo:[]},{platform:'팜빌',title:'중복',task_keys:['T01'],done:['x'],todo:[]}]});
 const txt=body(monthlyReportModel(s),1).map(x=>x[1]);
 assert.ok(txt.includes('1. 혼합 (가상A · 진행 80%)'));assert.ok(!txt.some(x=>x.startsWith('1. 중복')));
 assert.ok(txt.includes('1. 배너 교체 (업무 2건 · 가상A·가상B)'));assert.ok(txt.includes('(1) 최종 반영 · 시안 · 배포'));
});
test('documents without summary (or with the older per-task summary) still list every task by platform',()=>{
 const s=snap();s.ai_summary={overview:[],issues:[],plans:[],done:[],todo:[],metrics:[]};
 const r=monthlyReportModel(s),done=body(r,1).map(x=>x[1]),todo=body(r,2).map(x=>x[1]);
 for(const t of ['가. 닥터빌','(1) 2차 완료 · 1차 진행 · 신청 100명','나. 팜빌','(1) 최종 반영 · 시안 · 배포'])assert.ok(done.includes(t),t);
 assert.ok(todo.includes('(1) 진행 중 · 진행률 80%'));assert.ok(todo.includes('2. 최근 주간 보고의 차주 계획'));assert.ok(todo.includes('(1) 가상A · 11월 일정 확정'));
 const o=snap();o.ai_summary={overview:[],issues:[],plans:[],done:[],todo:[],metrics:[],tasks:[{task_key:'T01',done:['예전 요약'],todo:[]},{task_key:'OTHER',done:['예전 기타'],todo:[]}]};
 const od=body(monthlyReportModel(o),1).map(x=>x[1]);assert.ok(od.includes('(1) 예전 요약'));assert.ok(od.includes('(1) 예전 기타'));
});
test('editor notation keeps the platform level',()=>{
 const s=snap();s.ai_summary=G();const r=monthlyReportModel(s),t=linesToText(r.sections[1].body);
 assert.deepEqual(textToLines(t),r.sections[1].body);
});
test('group output is validated: unknown keys, bad platform and long lists rejected; duplicates removed; schema bounds',()=>{
 const base={overview:[],issues:[],plans:[],done:[],todo:[],metrics:[]},keys=['T01','T02'],g=(x)=>({platform:'닥터빌',title:'a',task_keys:['T01'],done:[],todo:[],...x});
 assert.throws(()=>validSummary({...base,groups:[g({task_keys:['T09']})]},['r1'],[],keys),/업무 그룹/);
 assert.throws(()=>validSummary({...base,groups:[g({platform:'기타'})]},['r1'],[],keys),/업무 그룹/);
 assert.throws(()=>validSummary({...base,groups:[g({done:Array(7).fill('x')})]},['r1'],[],keys),/업무 그룹/);
 const v=validSummary({...base,groups:[g({done:['a']}),g({task_keys:['T01','T02'],done:['b']}),g({task_keys:['T01'],done:['c']}),g({task_keys:[],done:[]})]},['r1'],[],keys);
 assert.deepEqual(v.groups.map(x=>[x.task_keys,x.done[0]]),[[['T01'],'a'],[['T02'],'b']]);assert.deepEqual(validSummary({...base},['r1']).groups,[]);
 const schema=sourceBoundSchema(['r1'],[],keys),gp=schema.properties.groups;assert.equal(gp.minItems,1);assert.equal(gp.maxItems,6);
 assert.deepEqual(gp.items.properties.task_keys.items.enum,['T01','T02']);assert.deepEqual(gp.items.properties.platform.enum,['닥터빌','팜빌','배터빌','공통']);
 assert.ok(summaryInstructions.includes('정확히 한 그룹의 task_keys에 한 번만'));assert.ok(summaryInstructions.includes('platform이나 work_area가 다른 업무는 절대 한 그룹에'));
});
test('monthly function sends the task list with platforms (without account ids) and stores grouped summaries',async()=>{
 const code=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/report-ai/index.ts',import.meta.url),'utf8'));
 const shared=await readFile(new URL('../supabase/functions/_shared/summary.mjs',import.meta.url),'utf8');const body=(src,name)=>src.slice(src.indexOf('function '+name),src.indexOf('\n}\n',src.indexOf('function '+name)));
 for(const n of ['taskDigest','metricHighlights'])assert.equal(body(code,n),body(shared,n),n);
 const s=snap(),id='11111111-1111-1111-1111-111111111111',doc={id,created_by:'u',kind:'monthly',period:'2026-10',snapshot:s};let handler,input,schema,saved;
 const res=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
 const fetch=async(url,o={})=>{if(url.endsWith('/auth/v1/user'))return res({id:'u'});if(url.includes('report_documents?select=*'))return res([doc]);if(url.endsWith('/rpc/claim_report_ai'))return new Response(null,{status:204});
  if(url==='https://api.openai.com/v1/responses'){const p=JSON.parse(o.body);input=JSON.parse(p.input);schema=p.text.format.schema;return res({status:'completed',model:'m',output:[{content:[{type:'output_text',text:JSON.stringify({overview:[],issues:[],plans:[],done:[],todo:[],metrics:[],groups:[{platform:'닥터빌',title:'세미나 운영',task_keys:['T01'],done:['세미나 운영'],todo:[]}]})}]}]});}
  if(url.endsWith('/rpc/save_report_ai')){saved=JSON.parse(o.body).summary_data;return res({...doc,snapshot:{...s,ai_summary:saved}});}throw Error('unexpected '+url);};
 const ctx={Deno:{env:{get:k=>({SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'k',OPENAI_API_KEY:'fake'})[k]},serve:f=>handler=f},fetch,Response,AbortSignal,console,Set,Map,Date,JSON,Error,Number,Math,String,Object,Array};vm.createContext(ctx);vm.runInContext(code,ctx);
 const r=await handler(new Request('https://e/report-ai',{method:'POST',headers:{authorization:'Bearer t','Content-Type':'application/json'},body:JSON.stringify({document_id:id})}));
 assert.equal(r.status,200);assert.deepEqual(input.tasks.map(t=>t.task_key),['T01','T02','T03','T04']);assert.equal(input.tasks[0].user_id,undefined);assert.equal(input.tasks[0].history.length,2);
 assert.deepEqual(input.tasks.map(t=>t.platform),['닥터빌','팜빌','팜빌','공통']);assert.deepEqual(schema.properties.groups.items.properties.task_keys.items.enum,['T01','T02','T03','T04']);assert.deepEqual(saved.groups[0].task_keys,['T01']);
});
test('grouped summaries are never mistaken for the old 업무 분야 rows even if top-level done/todo are filled',()=>{
 const s=snap();s.ai_summary=G({done:[{category:'기타',topic:'x',summary:'y',details:[],report_ids:['r1']}]});
 const txt=monthlyReportModel(s).sections[1].body.map(l=>l.text||'');assert.ok(txt.includes('가. 닥터빌'));assert.ok(!txt.includes('1. x'));
});
test('raw detail lists are compressed to at most two lines; long GPT lists are packed into two lines',async()=>{
 const {twoLines,packTwo}=await import('../monthly-report.mjs');
 const many=Array.from({length:12},(_,i)=>'(1) 항목 '+(i+1)+' 세부 내용 정리 완료');many.push('https://www.figma.com/x','기획안:');
 const out=twoLines(many);assert.equal(out.length,2);assert.ok(out.every(l=>l.length<=120));assert.match(out[1],/외 \d+건$/);assert.ok(!out.join('').includes('http'));assert.ok(!out.join('').includes('기획안:'));
 assert.deepEqual(packTwo(['a','b','c']),['a b','c']);assert.deepEqual(packTwo(['a']),['a']);
 const s=snap();s.reports[0].items[0].result=many.join('\n');const lines=monthlyReportModel(s).sections[1].body.filter(l=>l.t==='item');
 assert.ok(lines.length<=6);assert.ok(lines.every(l=>/^\((1|2)\) /.test(l.text)));
});
