'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildBackup,inspectBackup,readBackupSnapshot}=require('../backup');
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

test('Snapshot includes more than 5000 leads in a repeatable-read transaction',async()=>{
 const calls=[];
 const client={query:async(sql)=>{
  calls.push(sql);
  if(sql.startsWith('SELECT COUNT'))return {rows:[{total:'5001'}]};
  if(sql.startsWith('SELECT data'))return {rows:Array.from({length:5001},(_,i)=>({data:{id:'NW'+String(i).padStart(5,'0')}}))};
  return {rows:[]};
 }};
 const rows=await readBackupSnapshot(client);
 assert.equal(rows.length,5001);
 assert.deepEqual(calls,[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  'SELECT COUNT(*)::bigint AS total FROM nova_leads',
  'SELECT data FROM nova_leads ORDER BY created_at ASC, id ASC',
  'COMMIT'
 ]);
});
test('Snapshot fails closed and rolls back on missing rows',async()=>{
 const calls=[];
 const client={query:async(sql)=>{
  calls.push(sql);
  if(sql.startsWith('SELECT COUNT'))return {rows:[{total:'2'}]};
  if(sql.startsWith('SELECT data'))return {rows:[{data:{id:'NWTEST1'}}]};
  return {rows:[]};
 }};
 await assert.rejects(readBackupSnapshot(client),/Incomplete CRM backup snapshot/);
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(!calls.includes('COMMIT'));
});
test('Snapshot rejects invalid row count and rolls back',async()=>{
 const calls=[];
 const client={query:async(sql)=>{
  calls.push(sql);
  if(sql.startsWith('SELECT COUNT'))return {rows:[{total:'9007199254740993'}]};
  return {rows:[]};
 }};
 await assert.rejects(readBackupSnapshot(client),/Invalid CRM backup count/);
 assert.equal(calls.at(-1),'ROLLBACK');
});
test('Snapshot rejects missing client before beginning a transaction',async()=>{
 await assert.rejects(readBackupSnapshot(null),/Expected PostgreSQL client/);
});
test('Snapshot rolls back on SQL failure',async()=>{
 const calls=[];
 const client={query:async(sql)=>{
  calls.push(sql);
  if(sql.startsWith('SELECT COUNT'))throw Error('test database failure');
  return {rows:[]};
 }};
 await assert.rejects(readBackupSnapshot(client),/test database failure/);
 assert.equal(calls.at(-1),'ROLLBACK');
});
