const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const PORT=Number(process.env.PORT||3000);
const TOKEN=process.env.TELEGRAM_BOT_TOKEN||'';
const CHAT=process.env.TELEGRAM_ADMIN_CHAT_ID||'';
const MAX=8192;
const limits=new Map();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function page(res){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'"});fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
async function lead(req,res){
 if(!TOKEN||!CHAT)return json(res,503,{ok:false,message:'Приём заявок временно недоступен.'});
 const ip=req.socket.remoteAddress||'unknown',now=Date.now(),seen=(limits.get(ip)||[]).filter(t=>now-t<3600000);
 if(seen.length>=5)return json(res,429,{ok:false,message:'Лимит заявок. Попробуйте позже.'});
 let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>MAX)return json(res,413,{ok:false,message:'Слишком длинная заявка'})}
 let data;try{data=JSON.parse(body)}catch{return json(res,400,{ok:false,message:'Неверный формат'})}
 const name=String(data.name||'').trim().slice(0,80),contact=String(data.contact||'').trim().slice(0,120),type=String(data.type||'').trim().slice(0,80),notes=String(data.notes||'').trim().slice(0,1500);
 if(name.length<2||contact.length<5||!['START','GROW','SCALE'].includes(type)||!data.consent)return json(res,400,{ok:false,message:'Проверьте обязательные поля'});
 const entry=crm.create({name,contact,type,notes});
 try{
  await tg('sendMessage',{chat_id:CHAT,text:crm.describe(entry),reply_markup:crm.keyboard(entry.id)});
  try{crm.add(entry)}catch(e){console.error('CRM storage failed; Telegram copy exists',e.message)}
  seen.push(now);limits.set(ip,seen);if(limits.size>5000)limits.clear();
  return json(res,200,{ok:true,id:entry.id,message:'Заявка отправлена. Мы свяжемся с вами.'});
 }catch(e){console.error('Lead notification failed',e.message);return json(res,503,{ok:false,message:'Сейчас не удалось отправить заявку. Попробуйте позднее.'})}
}

const crypto=require('node:crypto');
const crm=require('./crm');
const WEBHOOK_SECRET=TOKEN?crypto.createHash('sha256').update('novaweb-webhook:'+TOKEN).digest('hex'):'';
async function tg(method,data){const response=await fetch('https://api.telegram.org/bot'+TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});const r=await response.json();if(!response.ok||!r.ok){const detail=String(r.description||'unknown').replace(/[\r\n]/g,' ').slice(0,180);throw Error('Telegram '+method+' failed: '+response.status+' '+detail)}return r.result}
async function telegramSend(chatId,message,keyboard){return tg('sendMessage',{chat_id:chatId,text:message,...(keyboard?{reply_markup:keyboard}:{})})}
function menu(){return {inline_keyboard:[[{text:'📊 Статистика',callback_data:'menu|stats'},{text:'📥 Заявки',callback_data:'menu|leads'}],[{text:'🌐 Наш сайт',url:'https://novaweb-agency.onrender.com'}]]}}
function statsText(){const s=crm.summary();return '📊 NOVA WEB · Сводка\nВсего: '+s.total+'\n'+Object.entries(crm.statuses).map(([k,label])=>label+': '+(s.counts[k]||0)).join('\n')+'\n\nВажно: до подключения постоянной базы данные на Render Free могут исчезнуть после развёртывания.'}
function leadsText(){const items=crm.summary().recent;if(!items.length)return '📥 Заявок пока нет. Новые будут приходить в этот чат.';return '📥 Последние заявки\n\n'+items.map(x=>x.id+' · '+crm.statuses[x.status]+'\n'+x.name+' · '+x.type).join('\n\n')+'\n\nДетали: /lead ID'}
async function setupWebhook(){if(!TOKEN||!CHAT)return;try{await tg('setWebhook',{url:'https://novaweb-agency.onrender.com/api/telegram/webhook',secret_token:WEBHOOK_SECRET,allowed_updates:['message','callback_query'],drop_pending_updates:false});console.log('Telegram webhook configured')}catch(e){console.error('Webhook setup failed',e.message)}}
async function telegramWebhook(req,res){
 if(!TOKEN||!CHAT||req.headers['x-telegram-bot-api-secret-token']!==WEBHOOK_SECRET)return json(res,403,{ok:false});
 let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>16384)return json(res,413,{ok:false})}
 let update;try{update=JSON.parse(body)}catch{return json(res,400,{ok:false})}
 const m=update.message,cb=update.callback_query;
 try{
  if(m&&String(m.chat?.id)===String(CHAT)){
   const parts=String(m.text||'').trim().split(/\s+/),cmd=parts[0].split('@')[0];
   if(cmd==='/start')await telegramSend(CHAT,'🚀 NOVA WEB · Центр управления\n\nЗаявки, статусы и сводка прямо в Telegram. Используй кнопки или /help.',menu());
   else if(cmd==='/help')await telegramSend(CHAT,'🧭 Команды NOVA WEB\n/start — меню\n/stats и /status — статистика\n/leads — последние заявки\n/lead ID — карточка заявки\n/help — подсказка',menu());
   else if(cmd==='/stats'||cmd==='/status')await telegramSend(CHAT,statsText(),menu());
   else if(cmd==='/leads')await telegramSend(CHAT,leadsText(),menu());
   else if(cmd==='/lead') {const x=crm.get(parts[1]||'');await telegramSend(CHAT,x?crm.describe(x):'Заявка не найдена. Пример: /lead NW123',x?crm.keyboard(x.id):menu())}
  }else if(cb&&String(cb.from?.id)===String(CHAT)&&String(cb.message?.chat?.id)===String(CHAT)){
   const d=String(cb.data||'').split('|');
   if(d[0]==='menu'){
    await tg('answerCallbackQuery',{callback_query_id:cb.id});
    await telegramSend(CHAT,d[1]==='stats'?statsText():leadsText(),menu());
   }else if(d[0]==='st'&&crm.statuses[d[2]]){
    const x=crm.change(d[1],d[2]);
    if(!x){
      await tg('answerCallbackQuery',{callback_query_id:cb.id,text:'Заявка недоступна. Данные могли исчезнуть после перезапуска Render.',show_alert:true});
    }else{
      let displayed=false;
      try{
        if(!cb.message?.message_id)throw Error('Telegram callback has no message ID');
        await tg('editMessageText',{chat_id:CHAT,message_id:cb.message.message_id,text:crm.describe(x),reply_markup:crm.keyboard(x.id)});
        displayed=true;
      }catch(e){
        if(/message is not modified/i.test(e.message)){displayed=true}
        else{
          console.error('CRM message edit error:',e.message);
          try{
            await telegramSend(CHAT,'🔄 Актуальная карточка заявки\n\n'+crm.describe(x),crm.keyboard(x.id));
            displayed=true;
          }catch(sendError){console.error('CRM fallback message failed:',sendError.message)}
        }
      }
      await tg('answerCallbackQuery',{callback_query_id:cb.id,text:displayed?'Статус: '+crm.statuses[d[2]]:'Статус сохранён, но Telegram не обновил карточку',show_alert:!displayed});
    }
   }else await tg('answerCallbackQuery',{callback_query_id:cb.id,text:'Неизвестная команда'});
  }
 }catch(e){console.error('Telegram command error',e.message);return json(res,503,{ok:false})}
 return json(res,200,{ok:true});
}
setTimeout(setupWebhook,1500);

http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true,version:'premium-v2'});if(req.method==='GET'&&p==='/api/status')return json(res,200,{ordersEnabled:Boolean(TOKEN&&CHAT)});if(req.method==='POST'&&p==='/api/telegram/webhook'){telegramWebhook(req,res).catch(()=>json(res,500,{ok:false}));return}if(req.method==='POST'&&p==='/api/lead'){lead(req,res).catch(()=>json(res,500,{ok:false,message:'Ошибка сервера'}));return}if(req.method==='GET'&&(p==='/'||p==='/index.html'))return page(res);res.writeHead(404);res.end('Not found')}).listen(PORT,'0.0.0.0',()=>console.log('NOVA WEB on '+PORT));
