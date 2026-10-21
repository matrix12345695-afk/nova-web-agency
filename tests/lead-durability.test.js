'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
test('new leads require a live durable PostgreSQL connection',()=>{
 assert.match(source,/if\(!TOKEN\|\|!CHAT\|\|!\(await checkReadiness\(crm\)\)\.ok\)return json\(res,503/);
 assert.doesNotMatch(source,/crm\.mode\(\)==='postgres_unavailable'\)return json\(res,503/);
});
test('public form status does not advertise accepting leads after database loss',()=>{
 assert.match(source,/checkReadiness\(crm\)\.then\(state=>json\(res,200,\{ordersEnabled:Boolean\(TOKEN&&CHAT&&state\.ok\)\}\)\)/);
 assert.match(source,/\.catch\(\(\)=>json\(res,200,\{ordersEnabled:false\}\)\)/);
});