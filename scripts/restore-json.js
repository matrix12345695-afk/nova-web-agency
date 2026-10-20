'use strict';
const fs=require('node:fs');
const {Pool}=require('pg');
const {inspectBackup}=require('../backup');
async function restore({bytes,url,confirm=false}){
 if(!url||!confirm)throw Error('Separate RESTORE_DATABASE_URL and explicit --confirm are required');
 if(process.env.DATABASE_URL&&url===process.env.DATABASE_URL)throw Error('Refusing restoration into live DATABASE_URL');
 const meta=inspectBackup(bytes),data=JSON.parse(bytes.toString('utf8'));
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query("CREATE TABLE IF NOT EXISTS nova_leads (id text PRIMARY KEY, data jsonb NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())");
  await client.query("CREATE TABLE IF NOT EXISTS nova_lead_events (event_id bigserial PRIMARY KEY, lead_id text NOT NULL REFERENCES nova_leads(id), status text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())");
  await client.query("CREATE TABLE IF NOT EXISTS nova_telegram_updates (update_id bigint PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now())");
  const rows=await client.query('SELECT COUNT(*)::int AS n FROM nova_leads');
  if(rows.rows[0].n!==0)throw Error('Refusing restore: destination already contains CRM records');
  for(const row of data.leads){
   await client.query('INSERT INTO nova_leads(id,data,status,created_at,updated_at) VALUES($1,$2::jsonb,$3,$4,$5)',[row.id,JSON.stringify(row),row.status,row.createdAt,row.updatedAt||row.createdAt]);
   for(const event of row.history){
    if(event.status&&['new','working','contacted','invoice','done','lost'].includes(event.status))await client.query('INSERT INTO nova_lead_events(lead_id,status,recorded_at) VALUES($1,$2,$3)',[row.id,event.status,Number.isFinite(Date.parse(event.at))?event.at:row.createdAt]);
   }
  }
  const check=await client.query('SELECT COUNT(*)::int AS n FROM nova_leads');
  if(check.rows[0].n!==meta.count)throw Error('Restored record count mismatch');
  await client.query('COMMIT');
  return {count:meta.count};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release();await pool.end()}
}
if(require.main===module){
 const filename=process.argv[2],confirm=process.argv.includes('--confirm');
 if(!filename){console.error('Usage: RESTORE_DATABASE_URL=... node scripts/restore-json.js backup.json --confirm');process.exitCode=2}
 else restore({bytes:fs.readFileSync(filename),url:process.env.RESTORE_DATABASE_URL,confirm}).then(x=>console.log('Restored records:',x.count)).catch(e=>{console.error('Restore rejected:',e.message);process.exitCode=1});
}
module.exports={restore};
