import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
import {weeklyBody,weeklyOverview} from '../weekly.mjs';import {weeklyExcelLayout} from '../excel.mjs';import {emptyMetrics} from '../metrics.mjs';
import {sourceBoundSchema,validSummary,metricHighlights,summaryInstructions} from '../supabase/functions/_shared/summary.mjs';
const empty=()=>({issues:[],plans:[],done:[],todo:[],metrics:[]});
const snap=ai=>({week:'2026-10-05',created_at:'2026-10-10',author:'팀장',members:[{id:'u',name:'보고자'}],metrics:emptyMetrics('2026-10-05'),reports:[{id:'r',user_id:'u',week_start:'2026-10-05',items:[{id:'t',project:'운영',title:'업무',state:'진행',progress:50,result:'성과'}],issues:'이슈',next_plan:'계획'}],...(ai?{ai_summary:ai}:{})});
test('overview schema is source-bound and validation requires report sources except for metrics',()=>{
 const schema=sourceBoundSchema(['r']);assert.ok(schema.required.includes('overview'));const row=schema.properties.overview.items;
 assert.deepEqual(row.properties.area.enum,['주요 지표','주요 업무','금주 이슈 및 대응','한 일','할 일']);assert.deepEqual(row.properties.report_ids.items.enum,['r']);assert.equal(schema.properties.overview.maxItems,9);
 assert.equal(validSummary({...empty(),overview:[{area:'주요 지표',summary:'닥터빌 MAU 120명, 전주 대비 +20명',report_ids:[]},{area:'주요 업무',summary:'운영 업무를 진행하고 있습니다.',report_ids:['r']}]},['r']).overview.length,2);
 assert.throws(()=>validSummary({...empty(),overview:[{area:'주요 업무',summary:'근거 없음',report_ids:[]}]},['r']),/핵심 요약/);
 assert.throws(()=>validSummary({...empty(),overview:[{area:'차주 계획',summary:'영역 외',report_ids:['r']}]},['r']),/핵심 요약/);
 assert.throws(()=>validSummary({...empty(),overview:[{area:'금주 이슈 및 대응',summary:'출처 조작',report_ids:['x']}]},['r']),/핵심 요약/);
 assert.deepEqual(validSummary(empty(),['r']).overview,[]);
});
test('metric highlights give the model display strings only and skip missing values',()=>{
 const m=emptyMetrics('2026-10-05');m.sections[0].rows=[{label:'MAU',platform:'팜빌',value:1200,previous:1000,unit:'명'},{label:'DAU',value:null,previous:5,unit:'명'}];m.sections[2].rows=[{label:'지급 포인트',platform:'닥터빌',value:500,previous:500,unit:'P'}];
 assert.deepEqual(metricHighlights(m),[{group:'회원 및 활동성',platform:'팜빌',name:'MAU',current:'1,200명',previous:'1,000명',change:'전주 대비 +200명 (+20.0%)'},{group:'포인트',platform:'닥터빌',name:'지급 포인트',current:'500P',previous:'500P',change:'전주와 동일'}]);
 assert.ok(summaryInstructions.includes('metric_highlights'));
});
test('section 1 shows the overview by area before status cards, with a clear message for older documents',()=>{
 const html=weeklyBody(snap({...empty(),overview:[{area:'금주 이슈 및 대응',summary:'이슈 <대응> 완료',report_ids:['r']},{area:'주요 지표',summary:'MAU 상승',report_ids:[]},{area:'주요 업무',summary:'첫째',report_ids:['r']},{area:'주요 업무',summary:'둘째',report_ids:['r']}]}));
 const sec=html.slice(html.indexOf('1. 보고서 요약'),html.indexOf('2. 주요 지표'));
 assert.ok(sec.indexOf('MAU 상승')<sec.indexOf('첫째\n둘째'));assert.ok(sec.indexOf('첫째')<sec.indexOf('이슈 &lt;대응&gt; 완료'));assert.ok(sec.indexOf('이슈 &lt;대응')<sec.indexOf('report-stats'));
 assert.ok(weeklyBody(snap({...empty()})).includes('핵심 요약 기능 이전에 생성'));assert.ok(weeklyBody(snap()).includes('핵심 요약이 아직 생성되지 않았습니다'));
 assert.equal(weeklyOverview(snap({...empty(),overview:[]})).status,'ready');
});
test('Excel section 1 lists the overview rows',()=>{
 const layout=weeklyExcelLayout(snap({...empty(),overview:[{area:'주요 업무',summary:'업무 요약',report_ids:['r']}]})),i=layout.rows.findIndex(r=>r.cells[0]?.value==='구분'&&r.cells[1]?.value==='핵심 내용');
 assert.ok(i>0);assert.deepEqual(layout.rows[i+1].cells.map(c=>c.value),['주요 업무','업무 요약']);
});
test('weekly edge function request includes precomputed metric highlights and stores the overview',async()=>{
 const code=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/report-ai/index.ts',import.meta.url),'utf8'));
 const shared=await readFile(new URL('../supabase/functions/_shared/summary.mjs',import.meta.url),'utf8');const rules=s=>s.slice(s.indexOf('const summaryInstructions'),s.indexOf('`;',s.indexOf('const summaryInstructions')));assert.equal(rules(code),rules(shared));
 const s=snap();s.metrics.sections[0].rows=[{label:'MAU',platform:'닥터빌',value:120,previous:100,unit:'명'}];
 const id='11111111-1111-1111-1111-111111111111',doc={id,created_by:'u',kind:'weekly',period:'2026-10-05',snapshot:s};let handler,input,saved;
 const res=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
 const fetch=async(url,o={})=>{if(url.endsWith('/auth/v1/user'))return res({id:'u'});if(url.includes('report_documents?select=*'))return res([doc]);if(url.endsWith('/rpc/claim_report_ai'))return new Response(null,{status:204});
  if(url==='https://api.openai.com/v1/responses'){const p=JSON.parse(o.body);input=JSON.parse(p.input);assert.ok(p.text.format.schema.required.includes('overview'));return res({status:'completed',model:'m',output:[{content:[{type:'output_text',text:JSON.stringify({...empty(),overview:[{area:'주요 지표',summary:'MAU 120명',report_ids:[]}]})}]}]});}
  if(url.endsWith('/rpc/save_report_ai')){saved=JSON.parse(o.body).summary_data;return res({...doc,snapshot:{...s,ai_summary:saved}});}throw Error('unexpected '+url);};
 const ctx={Deno:{env:{get:k=>({SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'k',OPENAI_API_KEY:'fake'})[k]},serve:f=>handler=f},fetch,Response,AbortSignal,console,Set,Date,JSON,Error,Number,Math,String};vm.createContext(ctx);vm.runInContext(code,ctx);
 const r=await handler(new Request('https://e/report-ai',{method:'POST',headers:{authorization:'Bearer t','Content-Type':'application/json'},body:JSON.stringify({document_id:id})}));
 assert.equal(r.status,200);assert.equal(input.metric_highlights[0].change,'전주 대비 +20명 (+20.0%)');assert.equal(saved.overview[0].summary,'MAU 120명');
});
