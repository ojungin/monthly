import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBoundSchema,summarySchema,validSummary} from '../supabase/functions/_shared/summary.mjs';
test('GPT source schema only permits saved report IDs, with at least one source per row',()=>{
 const schema=sourceBoundSchema(['report-a','report-b'],['weekly-doc']);
 for(const key of ['issues','plans','done','todo']){
  const ids=schema.properties[key].items.properties.report_ids;
  assert.equal(ids.minItems,1);assert.deepEqual(ids.items.enum,['report-a','report-b']);
 }
 assert.deepEqual(schema.properties.metrics.items.properties.source.enum,['report-a','report-b','weekly-doc']);
 assert.equal(summarySchema.properties.issues.items.properties.report_ids.items.enum,undefined);
 assert.throws(()=>sourceBoundSchema([]),/원본 보고서 ID/);
});
test('empty sections use empty arrays while unsupported sources remain rejected',()=>{
 const value={issues:[],plans:[],done:[],todo:[],metrics:[]};
 assert.equal(validSummary(value,['report-a']),value);
 for(const ids of [[],['user-id'],['task-id'],['report-a','invented']]){
  assert.throws(()=>validSummary({...value,issues:[{topic:'업무',summary:'이슈',report_ids:ids}]},['report-a']),/출처/);
 }
});
