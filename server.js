'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const crm=require('./crm');
const PORT=Number(process.env.PORT||3000);
const TOKEN=process.env.TELEGRAM_BOT_TOKEN||'';
const CHAT=String(process.env.TELEGRAM_ADMIN_CHAT_ID||'');
const WEBHOOK_SECRET=TOKEN?crypto.createHash('sha256').update('novaweb-webhook:'+TOKEN).digest('hex'):'';
const MAX=8192,limits=new Map();
const SITE='https://novaweb-agency.onrender.com';
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function page(res){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'"});fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
function clean(x,n){return String(x??'').trim().slice(0,n).replace(/[\u0000-\u001F\u007F]/g,' ')}
async function tg(method,data){const response=await fetch('https://api.telegram.org/bot'+TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw Error('Telegram '+method+': '+String(result.description||response.status).slice(0,160));return result.result}
async function send(message,keyboard){return tg('sendMessage',{chat_id:CHAT,text:message,...(keyboard?{reply_markup:keyboard}:{})})}
async function answer(id,text,alert=false){if(!id)return;try{await tg('answerCallbackQuery',{callback_query_id:id,text:String(text||'').slice(0,190),show_alert:alert})}catch(e){console.error('Callback answer:',e.message)}}
function menu(){return{inline_keyboard:[[{text:'📊 Статистика',callback_data:'menu|stats'},{text:'📥 Заявки',callback_data:'menu|leads'}],[{text:'🌐 Сайт',url:SITE}]]}}
async function statsText(){const s=await crm.summary();return '📊 NOVA WEB · Сводка\nЗаявок: '+s.total+'\n'+Object.entries(crm.statuses).map(([k,v])=>v+': '+(s.counts[k]||0)).join('\n')+'\n\nХранилище: '+(crm.mode()==='postgres'?'✅ PostgreSQL':crm.mode()==='temporary_file'?'⚠️ Временное, данные могут исчезнуть':'❌ Недоступно')+'\nПлатежи: ещё не подключены'}
async function leadsText(){const s=await crm.summary();return s.recent.length?'📥 Последние заявки\n\n'+s.recent.map(x=>x.id+' · '+crm.statuses[x.status]+'\n'+x.name+' · '+x.type).join('\n\n')+'\n\nДетали: /lead ID':'📥 Пока нет сохранённых заявок.'}
async function restoreFromTelegram(message,id){
 const t=String(message?.text||'');if(!/^[A-Za-z0-9]{8,48}$/.test(id)||!t.includes('NOVA WEB · Заявка '+id))return null;
 const row=k=>{const l=t.split('\n').find(x=>x.startsWith(k+': '));return l?l.slice(k.length+2).trim():''};
 const name=clean(row('Имя'),80),contact=clean(row('Контакт'),120),type=clean(row('Тариф'),80),notes=clean(row('Задача'),1500);
 if(!name||!contact||!['START','GROW','SCALE'].includes(type))return null;
 let status='new';for(const line of t.split('\n'))if(line.startsWith('Статус: ')){const symbol=line.slice(8).trim();const matched=Object.entries(crm.statuses).find(([,v])=>v===symbol);if(matched)status=matched[0]}
 const at=new Date().toISOString(),entry={id,name,contact,type,notes,createdAt:at,updatedAt:at,status,history:[{at,status,source:'telegram_recovery'}]};
 await crm.add(entry);return crm.get(id)
}
async function lead(req,res){
 if(!TOKEN||!CHAT||crm.mode()==='postgres_unavailable')return json(res,503,{ok:false,message:'Приём заявок временно недоступен.'});
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].slice(0,80);
 const now=Date.now(),seen=(limits.get(ip)||[]).filter(t=>now-t<3600000);
 if(seen.length>=5)return json(res,429,{ok:false,message:'Лимит заявок. Попробуйте позже.'});
 let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>MAX)return json(res,413,{ok:false,message:'Слишком длинная заявка'})}
 let data;try{data=JSON.parse(body)}catch{return json(res,400,{ok:false,message:'Неверный формат заявки'})}
 const name=clean(data.name,80),contact=clean(data.contact,120),type=clean(data.type,80),notes=clean(data.notes,1500);
 if(name.length<2||contact.length<5||!['START','GROW','SCALE'].includes(type)||!data.consent)return json(res,400,{ok:false,message:'Проверьте обязательные поля'});
 const item=crm.create({name,contact,type,notes});
 try{await crm.add(item)}catch(e){console.error('CRM write failed:',e.message);return json(res,503,{ok:false,message:'Сейчас не удалось сохранить заявку, попробуйте позднее.'})}
 seen.push(now);limits.set(ip,seen);if(limits.size>5000)limits.clear();
 try{await send(crm.describe(item),crm.keyboard(item.id))}catch(e){console.error('New lead Telegram notification failed; lead stored:',item.id,e.message)}
 return json(res,201,{ok:true,id:item.id,message:'Заявка принята. Мы свяжемся с вами.'});
}
async function sendBackup(){
 const rows=await crm.all();const bytes=Buffer.from(JSON.stringify({exportedAt:new Date().toISOString(),storage:crm.mode(),leads:rows},null,2));
 if(bytes.length>9*1024*1024){await send('Резервная копия слишком большая, нужен экспорт через защищённую админ-панель.');return}
 const form=new FormData();form.append('chat_id',CHAT);form.append('caption','📦 NOVA WEB · Резервная копия заявок · '+new Date().toISOString().slice(0,10));form.append('document',new Blob([bytes],{type:'application/json'}),'novaweb-backup-'+new Date().toISOString().slice(0,10)+'.json');
 const response=await fetch('https://api.telegram.org/bot'+TOKEN+'/sendDocument',{method:'POST',body:form,signal:AbortSignal.timeout(15000)});
 const v=await response.json();if(!v.ok)throw Error('Telegram backup upload failed');
}
async function onMessage(m){
 if(String(m.chat?.id)!==CHAT)return;
 const parts=String(m.text||'').trim().split(/\s+/),cmd=(parts[0]||'').split('@')[0];
 if(cmd==='/start')return send('🚀 NOVA WEB · Центр управления\n\nЗаявки, клиенты и их статусы находятся здесь.\n\nИспользуйте кнопки или /help.',menu());
 if(cmd==='/help')return send('🧭 NOVA WEB\n/start — меню\n/stats — сводка\n/leads — список заявок\n/lead ID — карточка\n/backup — резервная копия\n/help — справка',menu());
 if(cmd==='/stats'||cmd==='/status')return send(await statsText(),menu());
 if(cmd==='/leads')return send(await leadsText(),menu());
 if(cmd==='/lead'){const x=await crm.get(parts[1]||'');return send(x?crm.describe(x):'Заявка не найдена. Пример: /lead NW123',x?crm.keyboard(x.id):menu())}
 if(cmd==='/backup')return sendBackup();
}
async function onCallback(cb){
 if(String(cb.from?.id)!==CHAT||String(cb.message?.chat?.id)!==CHAT)return answer(cb.id,'Нет доступа',true);
 const parts=String(cb.data||'').split('|');
 if(parts[0]==='menu'){await answer(cb.id,'Открываю раздел');return send(parts[1]==='stats'?await statsText():await leadsText(),menu())}
 if(parts[0]!=='st'||!crm.statuses[parts[2]])return answer(cb.id,'Неизвестная команда');
 let x=await crm.change(parts[1],parts[2]);
 if(!x){const recovered=await restoreFromTelegram(cb.message,parts[1]);if(recovered)x=await crm.change(parts[1],parts[2])}
 if(!x)return answer(cb.id,'Заявка не найдена',true);
 try{
  await tg('editMessageText',{chat_id:CHAT,message_id:cb.message.message_id,text:crm.describe(x),reply_markup:crm.keyboard(x.id)});
  return answer(cb.id,'Статус: '+crm.statuses[x.status]);
 }catch(e){
  if(/message is not modified/i.test(e.message))return answer(cb.id,'Статус уже установлен');
  console.error('Telegram edit failed:',e.message);
  try{await send('🔄 Актуальная карточка заявки\n\n'+crm.describe(x),crm.keyboard(x.id));return answer(cb.id,'Обновил карточку новым сообщением')}
  catch(f){console.error('Telegram fallback failed:',f.message);return answer(cb.id,'Статус сохранён, но карточка не обновилась',true)}
 }
}
async function webhook(req,res){
 if(!TOKEN||!WEBHOOK_SECRET||req.headers['x-telegram-bot-api-secret-token']!==WEBHOOK_SECRET)return json(res,403,{ok:false});
 let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>16384)return json(res,413,{ok:false})}
 let update;try{update=JSON.parse(body)}catch{return json(res,400,{ok:false})}
 try{
  if(Number.isSafeInteger(update.update_id)&&await crm.isUpdateProcessed(update.update_id))return json(res,200,{ok:true,duplicate:true});
  if(update.message)await onMessage(update.message);
  if(update.callback_query)await onCallback(update.callback_query);
  if(Number.isSafeInteger(update.update_id))await crm.markUpdateProcessed(update.update_id);
  return json(res,200,{ok:true});
 }catch(e){console.error('Webhook processing failed:',e.message);return json(res,503,{ok:false})}
}
async function setupWebhook(){
 if(!TOKEN||!CHAT)return;
 try{await tg('setWebhook',{url:SITE+'/api/telegram/webhook',secret_token:WEBHOOK_SECRET,allowed_updates:['message','callback_query'],drop_pending_updates:false});console.log('Telegram webhook configured')}
 catch(e){console.error('Telegram webhook setup failed:',e.message)}
}
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true,version:'crm-stage1',storage:crm.mode()});
 if(req.method==='GET'&&p==='/api/status')return json(res,200,{ordersEnabled:Boolean(TOKEN&&CHAT&&crm.mode()!=='postgres_unavailable')});
 if(req.method==='POST'&&p==='/api/telegram/webhook'){webhook(req,res).catch(e=>{console.error('Webhook:',e.message);json(res,500,{ok:false})});return}
 if(req.method==='POST'&&p==='/api/lead'){lead(req,res).catch(e=>{console.error('Lead:',e.message);json(res,500,{ok:false,message:'Ошибка сервера'})});return}
 if(req.method==='GET'&&(p==='/'||p==='/index.html'))return page(res);
 res.writeHead(404);res.end('Not found');
});
(async()=>{try{await crm.init();server.listen(PORT,'0.0.0.0',()=>{console.log('NOVA WEB on '+PORT,'storage:',crm.mode());setTimeout(setupWebhook,1500)})}catch(e){console.error('Failed to initialize CRM:',e.message);process.exitCode=1}})();
