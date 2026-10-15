import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {latestWeeklyDocument,summarizeDocument} from '../report-ai.mjs';
test('weekly generation preview selects the newest saved document for the exact week',()=>{
 const summary={issues:[],plans:[]};
 const docs=[{id:'old',kind:'weekly',period:'2026-10-05',created_at:'2026-10-06',snapshot:{}},{id:'new',kind:'weekly',period:'2026-10-05',created_at:'2026-10-07',snapshot:{ai_summary:summary}},{id:'other',kind:'weekly',period:'2026-10-12',created_at:'2026-10-14',snapshot:{}},{id:'month',kind:'monthly',period:'2026-10',created_at:'2026-10-15',snapshot:{}}];
 assert.equal(latestWeeklyDocument(docs,'2026-10-05').snapshot.ai_summary,summary);
 assert.equal(latestWeeklyDocument(docs,'2026-11-02'),null);
 assert.equal(docs[0].id,'old');
});
test('summary call exposes the actual server error body and status',async()=>{
 const context=new Response(JSON.stringify({error:'서버에 OPENAI_API_KEY를 등록해주세요.'}),{status:503});
 await assert.rejects(summarizeDocument({functions:{invoke:async()=>({data:null,error:{context}})}},'doc'),/HTTP 503.*OPENAI_API_KEY/);
});
test('summary call handles gateway errors and returns saved summaries',async()=>{
 const context=new Response(JSON.stringify({code:401,message:'Invalid JWT'}),{status:401});
 await assert.rejects(summarizeDocument({functions:{invoke:async()=>({data:null,error:{context}})}},'doc'),/HTTP 401.*Invalid JWT/);
 const document={snapshot:{ai_summary:{issues:[],plans:[]}}};
 assert.equal(await summarizeDocument({functions:{invoke:async()=>({data:{document},error:null})}},'doc'),document);
});
test('generation page uses saved snapshot and exposes retry; failures remain visible',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(app.includes('weeklyBody(previewDocument?.snapshot||'));
 assert.ok(app.includes('GPT 요약 생성 / 재시도'));
 assert.ok(app.includes('reportAINotice=err.message;render();throw err'));
});
