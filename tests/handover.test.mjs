import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {sanitizeRichText,handoverItems,visibleHandovers,saveHandover,parseUrls,handoverBody,handoverTitle} from '../handover.mjs';
import {kpiMenus,navigationHTML} from '../portal.mjs';
test('인수인계서 is the last KPI menu and is routed',async()=>{
 assert.deepEqual(kpiMenus.at(-1),['kpi-handover','인수인계서']);
 assert.match(navigationHTML('kpi-handover',false),/data-view="kpi-handover" class="active"/);
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');assert.match(app,/'kpi-handover':kpiHandoverPage/);
 const build=await readFile(new URL('../build.mjs',import.meta.url),'utf8');assert.match(build,/'handover\.mjs'/);
});
test('rich text keeps tables, colors and font sizes but strips scripts, handlers and bad links',()=>{
 const html=sanitizeRichText('<p style="color:#d81b1b;font-size:18px;position:fixed">빨강</p><table class="MsoTable"><tr><td colspan="2" onclick="x()" style="background-color:yellow">셀</td></tr></table><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">나쁜</a><a href="https://a.com/?q=1&amp;b=2">좋은</a><!--[if gte mso 9]><xml>w</xml><![endif]--><o:p></o:p><span style="background:url(x)">u</span>');
 assert.match(html,/<p style="color:#d81b1b;font-size:18px">빨강<\/p>/);
 assert.match(html,/<table><tr><td colspan="2" style="background-color:yellow">셀<\/td><\/tr><\/table>/);
 assert.match(html,/<a href="https:\/\/a\.com\/\?q=1&amp;b=2" target="_blank" rel="noopener noreferrer">좋은<\/a>/);
 for(const bad of ['script','alert','<img','onerror','onclick','javascript','MsoTable','o:p','xml','url('])assert(!html.includes(bad),bad);
});
test('rich text closes unbalanced tags and escapes stray angle brackets',()=>{
 assert.equal(sanitizeRichText('<table><tr><td>a'),'<table><tr><td>a</td></tr></table>');
 assert.equal(sanitizeRichText('1 < 2 <img src=x onerror=alert(1)'),'1 &lt; 2 &lt;img src=x onerror=alert(1)');
 assert.equal(sanitizeRichText('</div><b>x</b></span>'),'<b>x</b>');
});
test('handover items need a main task, drop blank sets and validate URLs',()=>{
 assert.deepEqual(handoverItems([{task:' 세미나 운영 ',details:'<p><br></p>',urls:'https://a.com\n\n http://b.kr '},{task:'',details:'',urls:''}]),[{task:'세미나 운영',details:'',urls:['https://a.com','http://b.kr']}]);
 assert.throws(()=>handoverItems([{task:'',details:'',urls:''}]),/한 개 이상/);
 assert.throws(()=>handoverItems([{task:'',details:'<p>내용만</p>',urls:''}]),/1번째 업무의 주요 업무/);
 assert.throws(()=>parseUrls('javascript:alert(1)'),/http/);assert.throws(()=>parseUrls('없는주소'),/형식/);
});
test('owners see until confirmed, receivers after sharing, managers see everything',()=>{
 const rows=[{id:1,owner_id:'a',receiver_id:'b',status:'draft'},{id:2,owner_id:'a',receiver_id:'b',status:'shared'},{id:3,owner_id:'a',receiver_id:'b',status:'confirmed'},{id:4,owner_id:'c',receiver_id:'d',status:'shared'}];
 const ids=m=>visibleHandovers(rows,m).map(r=>r.id);
 assert.deepEqual(ids({id:'a'}),[1,2]);assert.deepEqual(ids({id:'b'}),[2,3]);assert.deepEqual(ids({id:'c'}),[4]);assert.deepEqual(ids({id:'z'}),[]);
 assert.deepEqual(ids({id:'z',role:'admin'}),[1,2,3,4]);
});
test('saving guards ownership, status, receiver and uses optimistic concurrency',async()=>{
 const me={id:'a'},items=[{task:'업무',details:'',urls:''}];
 await assert.rejects(saveHandover({member:me},{id:'1',owner_id:'b',status:'draft',items}),/본인/);
 await assert.rejects(saveHandover({member:me},{id:'1',owner_id:'a',status:'shared',items}),/회수/);
 await assert.rejects(saveHandover({member:me},{items},{share:true}),/인수받을 사람/);
 await assert.rejects(saveHandover({member:me},{items,receiver_id:'a'},{share:true}),/본인에게는/);
 const calls=[];const q={eq:(k,v)=>{calls.push([k,v]);return q},select:()=>q,single:async()=>({data:{id:'1'},error:null})};
 const ctx={member:me,client:{from:t=>{assert.equal(t,'handovers');return {update:v=>{calls.push(['values',v]);return q}}}}};
 await saveHandover(ctx,{id:'1',owner_id:'a',status:'draft',updated_at:'t0',items,receiver_id:'b'},{share:true});
 assert.deepEqual(calls,[['values',{items:[{task:'업무',details:'',urls:[]}],receiver_id:'b',status:'shared'}],['id','1'],['updated_at','t0']]);
});
test('read-only view escapes task names and links only http(s) URLs',()=>{
 const h={owner_id:'a',receiver_id:'b',status:'shared',items:[{task:'<b>업무</b>',details:'<p style="color:red">본문</p><script>x</script>',urls:['https://a.com/"x']},{task:'둘',details:'',urls:[]}]};
 const html=handoverBody(h,[{id:'a',name:'김'},{id:'b',name:'이'}]);
 assert.match(html,/&lt;b&gt;업무/);assert.match(html,/<p style="color:red">본문<\/p>/);assert(!html.includes('<script'));assert.match(html,/href="https:\/\/a\.com\/&quot;x"/);
 assert.equal(handoverTitle(h),'<b>업무</b> 외 1건');
});
test('database policy hides confirmed handovers from the owner and lets admins read all',async()=>{
 const sql=await readFile(new URL('../supabase/handovers.sql',import.meta.url),'utf8');
 assert.match(sql,/owner_id=\(select auth\.uid\(\)\) and status<>'confirmed'/);
 assert.match(sql,/receiver_id=\(select auth\.uid\(\)\) and status<>'draft'/);
 assert.match(sql,/public\.is_admin\(\)/);
 assert.match(sql,/me=old\.receiver_id and new\.status='confirmed'/);
});
