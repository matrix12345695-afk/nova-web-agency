'use strict';const test=require('node:test'),assert=require('node:assert/strict');const {buildBackup,inspectBackup}=require('../backup');const {restore}=require('../scripts/restore-json');
test('Full backup retains operational and marketing fields',()=>{const lead={id:'NWTEST123456',name:'Demo',contact:'TESTONLY',type:'GROW',createdAt:'2026-10-20T09:00:00Z',updatedAt:'2026-10-20T10:00:00Z',status:'working',history:[{at:'2026-10-20T09:00:00Z',status:'new'}],note:'Internal note',task:'Prepare mockup',due:'2026-11-01',quotedAmount:3000000,source:'instagram',campaign:'autumn'};const data=JSON.parse(buildBackup([lead],'postgres'));for(const field of ['note','task','due','quotedAmount','source','campaign'])assert.deepEqual(data.leads[0][field],lead[field]);assert.equal(inspectBackup(Buffer.from(JSON.stringify(data))).count,1)});
test('Duplicate record IDs are rejected',()=>{const l={id:'NWTEST123456',createdAt:'2026-10-20T09:00:00Z',status:'new',history:[]};assert.throws(()=>inspectBackup(buildBackup([l,l],'postgres')),/Invalid/)});
test('Restore refuses writes without explicit confirmation',async()=>{await assert.rejects(()=>restore({bytes:Buffer.from('{}'),url:'postgres://example',confirm:false}),/explicit/)});
test('Real PostgreSQL backup is restored into an isolated empty destination', {skip:!process.env.TEST_POSTGRES_URL},async()=>{
 const {Pool}=require('pg');const url=process.env.TEST_POSTGRES_URL;
 const pool=new Pool({connectionString:url});await pool.query('CREATE SCHEMA IF NOT EXISTS nova_restore_sandbox');await pool.query('DROP SCHEMA nova_restore_sandbox CASCADE');await pool.query('CREATE SCHEMA nova_restore_sandbox');await pool.end();const isolated=new URL(url);isolated.searchParams.set('options','-c search_path=nova_restore_sandbox');const testUrl=isolated.toString();
 const lead={id:'NWBACKUP001',name:'Sample',contact:'NOTREAL',type:'START',createdAt:'2026-10-20T09:00:00Z',status:'new',history:[{at:'2026-10-20T09:00:00Z',status:'new'}],note:'Internal test',quotedAmount:1500000};
 const bytes=buildBackup([lead],'postgres');
 const x=await restore({bytes,url:testUrl,confirm:true});assert.equal(x.count,1);
 const verify=new Pool({connectionString:testUrl});const q=await verify.query('SELECT data FROM nova_leads WHERE id=$1',[lead.id]);assert.equal(q.rows[0].data.note,'Internal test');
 await assert.rejects(()=>restore({bytes,url,confirm:true}),/destination already contains CRM records/);await verify.end();
});
