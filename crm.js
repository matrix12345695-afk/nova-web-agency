'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const dir=process.env.DATA_DIR||path.join(__dirname,'data');
const file=path.join(dir,'leads.json');
const statuses=Object.freeze({new:'🆕 Новая',working:'🛠 В работе',contacted:'💬 Связались',invoice:'🧾 Счёт отправлен',done:'✅ Завершено',lost:'❌ Отказ'});
fs.mkdirSync(dir,{recursive:true,mode:0o700});
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:7000,idleTimeoutMillis:30000,ssl:process.env.DATABASE_SSL==='require'?{rejectUnauthorized:false}:undefined}):null;
let ready=false;
async function init(){
 if(!pool){ready=true;console.warn('CRM TEMPORARY: filesystem fallback. Data is lost when Render Free restarts.');return}
 try{const u=new URL(process.env.DATABASE_URL);const host=u.hostname;const target=host.endsWith('.render.com')?'external_render_hostname':host.startsWith('dpg-')?'internal_render_hostname':'custom_hostname';console.log('CRM connectivity check:',target,'tls:',process.env.DATABASE_SSL==='require'?'required':'default','protocol:',u.protocol.replace(':',''));}catch(e){console.error('CRM DATABASE_URL format invalid:',e.message);throw Error('Invalid DATABASE_URL')}
 await pool.query("CREATE TABLE IF NOT EXISTS nova_leads (id text PRIMARY KEY, data jsonb NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())");
 await pool.query("CREATE TABLE IF NOT EXISTS nova_lead_events (event_id bigserial PRIMARY KEY, lead_id text NOT NULL REFERENCES nova_leads(id), status text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())");
 await pool.query("CREATE TABLE IF NOT EXISTS nova_telegram_updates (update_id bigint PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now())");
 await pool.query("CREATE TABLE IF NOT EXISTS nova_daily_reminders (day text PRIMARY KEY, claimed_at timestamptz NOT NULL DEFAULT now())");
 ready=true;console.log('CRM PostgreSQL schema ready');
}
function mode(){return pool?(ready?'postgres':'postgres_unavailable'):'temporary_file'}
function requireReady(){if(!ready)throw Error('CRM initialization pending')}
function fileAll(){try{const rows=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(rows)?rows:[]}catch(e){if(e.code!=='ENOENT')console.error('CRM read failed:',e.message);return []}}
function saveFile(rows){const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows,null,2),{mode:0o600});fs.renameSync(tmp,file)}
async function all(){requireReady();if(!pool)return fileAll();const r=await pool.query("SELECT data FROM nova_leads ORDER BY created_at ASC LIMIT 5000");return r.rows.map(x=>x.data)}
function create(data){const now=new Date().toISOString();return {id:'NW'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(2).toString('hex'),name:data.name,contact:data.contact,type:data.type,notes:data.notes,source:data.source||'direct',campaign:data.campaign||'none',createdAt:now,updatedAt:now,status:'new',history:[{at:now,status:'new'}]}}
async function add(item){
 requireReady();
 if(!pool){const rows=fileAll();if(rows.some(x=>x.id===item.id))return false;rows.push(item);saveFile(rows);return true}
 const client=await pool.connect();try{
  await client.query('BEGIN');
  const q=await client.query("INSERT INTO nova_leads (id,data,status,created_at,updated_at) VALUES ($1,$2::jsonb,$3,$4,$4) ON CONFLICT DO NOTHING",[item.id,JSON.stringify(item),item.status,item.createdAt]);
  if(q.rowCount)await client.query("INSERT INTO nova_lead_events (lead_id,status) VALUES($1,$2)",[item.id,item.status]);
  await client.query('COMMIT');return q.rowCount>0;
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}
}
async function get(id){requireReady();if(!pool)return fileAll().find(x=>x.id===id)||null;const r=await pool.query("SELECT data FROM nova_leads WHERE id=$1",[id]);return r.rows[0]?.data||null}
async function change(id,status){
 if(!Object.hasOwn(statuses,status))return null;requireReady();
 if(!pool){const rows=fileAll(),i=rows.findIndex(x=>x.id===id);if(i<0)return null;const now=new Date().toISOString();rows[i].status=status;rows[i].updatedAt=now;rows[i].history=(rows[i].history||[]).concat([{at:now,status}]);saveFile(rows);return rows[i]}
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const existing=await client.query("SELECT data FROM nova_leads WHERE id=$1 FOR UPDATE",[id]);
  if(!existing.rows.length){await client.query('ROLLBACK');return null}
  const row=existing.rows[0].data;
  if(row.status!==status){
   const now=new Date().toISOString();row.status=status;row.updatedAt=now;row.history=(row.history||[]).concat([{at:now,status}]);
   await client.query("UPDATE nova_leads SET data=$2::jsonb,status=$3,updated_at=$4 WHERE id=$1",[id,JSON.stringify(row),status,now]);
   await client.query("INSERT INTO nova_lead_events (lead_id,status) VALUES ($1,$2)",[id,status]);
  }
  await client.query('COMMIT');return row;
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}
}
async function summary(){const rows=await all(),counts=Object.fromEntries(Object.keys(statuses).map(s=>[s,0]));for(const x of rows)counts[x.status]=(counts[x.status]||0)+1;return {total:rows.length,counts,recent:rows.slice(-10).reverse()}}
function describe(item){return [(statuses[item.status]||'📋').split(' ')[0]+' NOVA WEB · Заявка '+item.id,'Статус: '+(statuses[item.status]||item.status),'Имя: '+item.name,'Контакт: '+item.contact,'Тариф: '+item.type,'Задача: '+(item.notes||'Не указана'),'Создана: '+new Date(item.createdAt).toLocaleString('ru-RU')].join('\n')}
function keyboard(id){return {inline_keyboard:[[{text:'🛠 В работу',callback_data:'st|'+id+'|working'},{text:'💬 Связались',callback_data:'st|'+id+'|contacted'}],[{text:'🧾 Счёт отправлен',callback_data:'st|'+id+'|invoice'},{text:'✅ Завершено',callback_data:'st|'+id+'|done'}],[{text:'❌ Отказ',callback_data:'st|'+id+'|lost'}]]}}
async function isUpdateProcessed(id){if(!pool||!ready||!Number.isSafeInteger(id))return false;const q=await pool.query("SELECT 1 FROM nova_telegram_updates WHERE update_id=$1",[id]);return q.rowCount>0}
async function markUpdateProcessed(id){if(!pool||!ready||!Number.isSafeInteger(id))return;await pool.query("INSERT INTO nova_telegram_updates (update_id) VALUES ($1) ON CONFLICT DO NOTHING",[id])}

async function amend(id,changes){
 requireReady();
 const allowed=['note','task','due','quotedAmount'];
 const update={};for(const k of allowed)if(Object.hasOwn(changes,k))update[k]=changes[k];
 const apply=(row)=>{const now=new Date().toISOString();for(const [k,v] of Object.entries(update))row[k]=v;row.updatedAt=now;row.history=(row.history||[]).concat([{at:now,action:'edited',fields:Object.keys(update)}]);return row};
 if(!pool){const rows=fileAll(),i=rows.findIndex(x=>x.id===id);if(i<0)return null;const item=apply(rows[i]);saveFile(rows);return item}
 const client=await pool.connect();try{
  await client.query('BEGIN');
  const q=await client.query('SELECT data FROM nova_leads WHERE id=$1 FOR UPDATE',[id]);
  if(!q.rows.length){await client.query('ROLLBACK');return null}
  const item=apply(q.rows[0].data);
  await client.query('UPDATE nova_leads SET data=$2::jsonb,updated_at=$3 WHERE id=$1',[id,JSON.stringify(item),item.updatedAt]);
  await client.query('COMMIT');return item;
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}
}
async function search(query){const q=String(query||'').toLocaleLowerCase('ru-RU').trim();if(q.length<2)return [];return (await all()).filter(x=>[x.id,x.name,x.contact,x.type].some(v=>String(v||'').toLocaleLowerCase('ru-RU').includes(q))).slice(-20).reverse()}
async function overdue(today=new Date().toISOString().slice(0,10)){return (await all()).filter(x=>x.due&&x.due<today&&!['done','lost'].includes(x.status)).sort((a,b)=>a.due.localeCompare(b.due))}


async function claimReminder(day){requireReady();if(!pool)return false;const r=await pool.query("INSERT INTO nova_daily_reminders (day) VALUES($1) ON CONFLICT DO NOTHING",[day]);return r.rowCount===1}
async function releaseReminder(day){requireReady();if(!pool)return;await pool.query("DELETE FROM nova_daily_reminders WHERE day=$1",[day])}

module.exports={claimReminder,releaseReminder,amend,search,overdue,init,mode,all,add,create,get,change,summary,describe,keyboard,statuses,isUpdateProcessed,markUpdateProcessed};
