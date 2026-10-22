'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS,checkOne}=require('../scripts/smoke-check');
const response=(status,payload,contentType='application/json')=>({
 ok:status>=200&&status<300,status,headers:{get:()=>contentType},json:async()=>payload
});
test('All six checks are GET-only and exclude the Telegram webhook',()=>{
 assert.equal(TARGETS.length,6);
 assert.ok(TARGETS.every(x=>x.url.startsWith('https://')));
 assert.ok(TARGETS.every(x=>!x.url.includes('/api/telegram/webhook')));
});
test('A transient 503 is recovered on retry',async()=>{
 let n=0;const methods=[];
 const r=await checkOne({name:'health',url:'https://example.test/health',kind:'health'}, {
  fetchFn:async(_,opts)=>{methods.push(opts.method);return ++n===1?response(503,{}):response(200,{ok:true,storage:'postgres'})},
  sleepFn:async()=>{},retries:2
 });
 assert.deepEqual(methods,['GET','GET']);
 assert.deepEqual(r,{name:'health',ok:true,attempts:2,recovered:true});
});
test('HTTP 200 without PostgreSQL readiness is a failure',async()=>{
 const r=await checkOne({name:'health',url:'https://example.test/health',kind:'health'}, {
  fetchFn:async()=>response(200,{ok:false,storage:'postgres_unavailable'}),sleepFn:async()=>{},retries:0
 });
 assert.equal(r.ok,false);assert.match(r.error,/PostgreSQL readiness/);
});
test('HTTP 200 with disabled intake is a failure',async()=>{
 const r=await checkOne({name:'status',url:'https://example.test/api/status',kind:'status'}, {
  fetchFn:async()=>response(200,{ordersEnabled:false}),sleepFn:async()=>{},retries:0
 });
 assert.equal(r.ok,false);assert.match(r.error,/Lead intake/);
});
test('Persistent HTTP 503 fails closed',async()=>{
 const r=await checkOne({name:'demo',url:'https://example.test/demo',kind:'html'}, {
  fetchFn:async()=>response(503,{}),sleepFn:async()=>{},retries:1
 });
 assert.equal(r.ok,false);assert.equal(r.attempts,2);assert.equal(r.error,'HTTP 503');
});

test('A valid HTML page passes without retry',async()=>{
 const r=await checkOne({name:'primary',url:'https://example.test/',kind:'html'}, {
  fetchFn:async(_,opts)=>{assert.equal(opts.method,'GET');return response(200,null,'text/html; charset=utf-8')},
  sleepFn:async()=>{throw Error('Unexpected retry')},retries:2
 });
 assert.deepEqual(r,{name:'primary',ok:true,attempts:1,recovered:false});
});
test('HTTP 200 returning JSON instead of HTML fails closed',async()=>{
 const r=await checkOne({name:'demo-cafe',url:'https://example.test/demo/cafe',kind:'html'}, {
  fetchFn:async()=>response(200,{ok:true},'application/json'),sleepFn:async()=>{},retries:0
 });
 assert.equal(r.ok,false);
 assert.equal(r.error,'Expected HTML response');
});
test('A temporary network exception is recovered on retry',async()=>{
 let calls=0;
 const r=await checkOne({name:'crm-health',url:'https://example.test/health',kind:'health'}, {
  fetchFn:async()=>{if(++calls===1)throw Error('temporary DNS failure');return response(200,{ok:true,storage:'postgres'})},
  sleepFn:async()=>{},retries:1
 });
 assert.equal(calls,2);
 assert.deepEqual(r,{name:'crm-health',ok:true,attempts:2,recovered:true});
});
test('Invalid status JSON fails without claiming intake availability',async()=>{
 const r=await checkOne({name:'lead-intake-status',url:'https://example.test/api/status',kind:'status'}, {
  fetchFn:async()=>({ok:true,status:200,json:async()=>{throw SyntaxError('Unexpected token')}}),
  sleepFn:async()=>{},retries:0
 });
 assert.equal(r.ok,false);
 assert.match(r.error,/Unexpected token/);
});
