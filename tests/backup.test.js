'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildBackup,inspectBackup}=require('../backup');
test('Backup preserves client card, status history, and count',()=>{
 const sample=[{id:'NWTEST1',name:'Demo only',contact:'NOT_REAL',type:'START',notes:'Mock',createdAt:'2026-10-20T00:00:00Z',status:'working',history:[{at:'2026-10-20T00:00:00Z',status:'new'},{at:'2026-10-20T00:01:00Z',status:'working'}]}];
 const bytes=buildBackup(sample,'postgres','2026-10-20T01:00:00Z');
 const content=JSON.parse(bytes.toString('utf8'));
 assert.equal(content.count,1);assert.equal(content.leads[0].status,'working');
 assert.deepEqual(content.leads[0].history,sample[0].history);
 assert.deepEqual(inspectBackup(bytes).leadIds,['NWTEST1']);
});
test('Backup rejects corrupt and inconsistent content',()=>{
 assert.throws(()=>inspectBackup(Buffer.from('{"format":"novaweb-crm","schemaVersion":1,"count":5,"leads":[]}')),/Invalid/);
 assert.throws(()=>buildBackup({id:'not-array'},'postgres'),/Expected array/);
});
