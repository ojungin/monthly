import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const bundle=await readFile(new URL('../supabase-2.118.0.js',import.meta.url),'utf8');
test('bundled Supabase creates the existing auth client and reads an empty session without network',async()=>{
 const browser={WebSocket,console,URL,URLSearchParams,fetch:()=>{throw Error('Unexpected network');},Headers,Request,Response,AbortController,Blob,FormData,TextEncoder,TextDecoder,setTimeout,clearTimeout,setInterval,clearInterval,crypto,atob,btoa};
 vm.createContext(browser);vm.runInContext(bundle,browser);
 assert.equal(typeof browser.supabase.createClient,'function');
 const client=browser.supabase.createClient('https://example.supabase.co','sb_publishable_test',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getSession();assert.equal(error,null);assert.equal(data.session,null);
 assert.equal(typeof client.auth.signInWithPassword,'function');assert.equal(typeof client.from('reports').select,'function');
});
test('local loader shares one download, retries failed loads and avoids external module imports',async()=>{
 let scripts=[];globalThis.document={createElement:()=>({remove(){}}),head:{append(script){scripts.push(script);}}};
 const {loadSupabase}=await import('../supabase-loader.mjs');
 try{
  const first=loadSupabase();assert.equal(loadSupabase(),first);assert.equal(scripts.length,1);
  assert.ok(scripts[0].src.endsWith('/supabase-2.118.0.js'));assert.ok(!scripts[0].src.includes('https://esm.sh'));
  scripts[0].onerror();await assert.rejects(first,/로그인 모듈/);
  const second=loadSupabase();assert.equal(scripts.length,2);const sdk={createClient(){}};globalThis.supabase=sdk;scripts[1].onload();assert.equal(await second,sdk);
 }finally{delete globalThis.document;delete globalThis.supabase;}
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');const db=await readFile(new URL('../dashboard-db.mjs',import.meta.url),'utf8');assert.ok(!app.includes('esm.sh'));assert.ok(!db.includes('esm.sh'));
});
