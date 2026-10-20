'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),r=require('../reminders');
test('overdue filter excludes completed and future tasks',()=>{
 const rows=[{id:'A',due:'2026-10-19',status:'working',name:'Client'},{id:'B',due:'2026-10-20',status:'working'},{id:'C',due:'2026-10-18',status:'done'}];
 assert.deepEqual(r.eligible(rows,'2026-10-20').map(x=>x.id),['A']);
 assert.match(r.textFor(r.eligible(rows,'2026-10-20'),'2026-10-20'),/Просрочено: 1/);
});
test('timezone and send-once reminder logic works',async()=>{
 const now=new Date('2026-10-20T08:00:00Z');
 assert.equal(r.shouldCheck(now),true);
 const calls=[];let claimed=false;
 const crm={mode:()=> 'postgres',all:async()=>[{id:'NWTEST',name:'Test',due:'2026-10-19',status:'working'}],claimReminder:async()=>{if(claimed)return false;claimed=true;return true},releaseReminder:async()=>{claimed=false}};
 assert.equal((await r.check({crm,send:async s=>calls.push(s),now})).status,'sent');
 assert.equal((await r.check({crm,send:async s=>calls.push(s),now})).status,'already_sent');
 assert.equal(calls.length,1);
});
