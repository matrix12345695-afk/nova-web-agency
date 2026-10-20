'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {checkReadiness}=require('../health');

test('healthy PostgreSQL responds ready',async()=>{
  let queries=0;
  const r=await checkReadiness({mode:()=> 'postgres',ping:async()=>{queries++}});
  assert.deepEqual(r,{ok:true,storage:'postgres'});
  assert.equal(queries,1);
});
test('PostgreSQL failure is not reported as healthy',async()=>{
  const r=await checkReadiness({mode:()=> 'postgres',ping:async()=>{throw Error('private connection details')}});
  assert.deepEqual(r,{ok:false,storage:'postgres_unavailable'});
  assert.ok(!JSON.stringify(r).includes('private'));
});
test('temporary or uninitialized CRM cannot pass readiness',async()=>{
  for(const mode of ['temporary_file','postgres_unavailable']){
    let called=false;
    const r=await checkReadiness({mode:()=>mode,ping:async()=>{called=true}});
    assert.equal(r.ok,false);
    assert.equal(r.storage,mode);
    assert.equal(called,false);
  }
});
test('health endpoint uses readiness probe and responds 503 on failure',()=>{
  const server=fs.readFileSync('server.js','utf8');
  const crm=fs.readFileSync('crm.js','utf8');
  assert.match(server,/checkReadiness\(crm\)/);
  assert.match(server,/state\.ok\?200:503/);
  assert.match(crm,/query_timeout:2500/);
});
