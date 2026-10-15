import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('monthly archive is routed for all members and filters stored monthly snapshots',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(source.includes("'monthly-files':monthlyFilesPage"));
 const page=source.slice(source.indexOf('function monthlyFilesPage()'));
 assert.ok(page.includes("documents.filter(d=>d.kind==='monthly')"));assert.ok(page.includes('monthlyArchivePeriod'));
 assert.ok(page.includes("documentBody(selectedDocument.snapshot,'monthly')"));assert.ok(!page.includes('monthlyAdvisoryEditor'));
 assert.ok(source.includes("if(view==='monthly'||view==='monthly-files')"));
});
test('creation screens and persistence guard manager role independently of menu visibility',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(source.includes("function monthly(){if(me.role!=='admin')"));
 assert.ok(source.includes("function weeklyPage(){if(me.role!=='admin')"));
 assert.ok(source.includes("async function persistDocument(snapshot,kind,period){if(me.role!=='admin')"));
});
