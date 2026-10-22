'use strict';
const MAX_BYTES=9*1024*1024;
function buildBackup(leads,storage,at=new Date().toISOString()){
 if(!Array.isArray(leads))throw new TypeError('Expected array of leads');
 const rows=leads.map(row=>({
  id:String(row.id||''),name:row.name||'',contact:row.contact||'',
  type:row.type||'',notes:row.notes||'',createdAt:row.createdAt||'',
  updatedAt:row.updatedAt||'',status:row.status||'new',
  history:Array.isArray(row.history)?row.history:[],
  source:row.source||'direct',campaign:row.campaign||'none',
  note:row.note||'',task:row.task||'',due:row.due||'',
  quotedAmount:Number.isSafeInteger(row.quotedAmount)?row.quotedAmount:null
 }));
 const body={format:'novaweb-crm',schemaVersion:1,exportedAt:at,storage,count:rows.length,leads:rows};
 const json=JSON.stringify(body,null,2);
 const bytes=Buffer.from(json,'utf8');
 if(bytes.length>MAX_BYTES)throw new RangeError('Backup exceeds safe Telegram attachment limit');
 return bytes;
}
function inspectBackup(bytes){
 const data=JSON.parse(Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes));
 if(!data||data.format!=='novaweb-crm'||data.schemaVersion!==1||!Array.isArray(data.leads)||data.leads.length!==data.count)throw Error('Invalid NOVA WEB backup');
 const seen=new Set();
 for(const row of data.leads){
  if(!row||!/^NW[A-Za-z0-9]{4,45}$/.test(row.id)||seen.has(row.id)||!Array.isArray(row.history)||!['new','working','contacted','invoice','done','lost'].includes(row.status)||!Number.isFinite(Date.parse(row.createdAt)))throw Error('Invalid lead in NOVA WEB backup');
  seen.add(row.id);
 }
 return {count:data.count,createdAt:data.exportedAt,storage:data.storage,leadIds:data.leads.map(x=>x.id)};
}
async function readBackupSnapshot(client){
 if(!client||typeof client.query!=='function')throw new TypeError('Expected PostgreSQL client');
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const countResult=await client.query('SELECT COUNT(*)::bigint AS total FROM nova_leads');
  const total=Number(countResult.rows[0]?.total);
  if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid CRM backup count');
  const result=await client.query('SELECT data FROM nova_leads ORDER BY created_at ASC, id ASC');
  const rows=result.rows.map(row=>row.data);
  if(rows.length!==total)throw Error('Incomplete CRM backup snapshot');
  await client.query('COMMIT');
  return rows;
 }catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  throw error;
 }
}
module.exports={buildBackup,inspectBackup,readBackupSnapshot};
