'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = process.env.DATA_DIR || path.join(__dirname,'data');
const file = path.join(dir,'leads.json');
const statuses = Object.freeze({new:'🆕 Новая',working:'🛠 В работе',contacted:'💬 Связались',invoice:'🧾 Счёт отправлен',done:'✅ Завершено',lost:'❌ Отказ'});
fs.mkdirSync(dir,{recursive:true,mode:0o700});
function all(){try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(data)?data:[]}catch(e){if(e.code!=='ENOENT')console.error('CRM read failed',e.message);return []}}
function save(data){const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(tmp,file)}
function create(data){const date=new Date().toISOString();return {id:'NW'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(2).toString('hex'),name:data.name,contact:data.contact,type:data.type,notes:data.notes,createdAt:date,updatedAt:date,status:'new',history:[{at:date,status:'new'}]}}
function add(item){const rows=all();rows.push(item);save(rows)}
function get(id){return all().find(x=>x.id===id)||null}
function change(id,status){if(!Object.hasOwn(statuses,status))return null;const rows=all();const i=rows.findIndex(x=>x.id===id);if(i<0)return null;rows[i].status=status;rows[i].updatedAt=new Date().toISOString();rows[i].history=(rows[i].history||[]).concat([{at:rows[i].updatedAt,status}]);save(rows);return rows[i]}
function summary(){const rows=all(),counts=Object.fromEntries(Object.keys(statuses).map(s=>[s,0]));for(const x of rows)counts[x.status]=(counts[x.status]||0)+1;return {total:rows.length,counts,recent:rows.slice(-10).reverse()}}
function describe(item){return [(statuses[item.status]||'📋').split(' ')[0]+' NOVA WEB · Заявка '+item.id,'Статус: '+(statuses[item.status]||item.status),'Имя: '+item.name,'Контакт: '+item.contact,'Тариф: '+item.type,'Задача: '+(item.notes||'Не указана'),'Создана: '+new Date(item.createdAt).toLocaleString('ru-RU')].join('\n')}
function keyboard(id){return {inline_keyboard:[[{text:'🛠 В работу',callback_data:'st|'+id+'|working'},{text:'💬 Связались',callback_data:'st|'+id+'|contacted'}],[{text:'🧾 Счёт отправлен',callback_data:'st|'+id+'|invoice'},{text:'✅ Завершено',callback_data:'st|'+id+'|done'}],[{text:'❌ Отказ',callback_data:'st|'+id+'|lost'}]]}}
module.exports={all,add,create,get,change,summary,describe,keyboard,statuses};