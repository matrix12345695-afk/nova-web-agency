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
 if(!TOKEN||!CHAT)return json(res,503,{ok:false,message:'Приём заявок настраивается. Пожалуйста, попробуйте позднее.'});
 const ip=(req.socket.remoteAddress||'unknown');const now=Date.now();const x=limits.get(ip)||[];const recent=x.filter(t=>now-t<3600000);if(recent.length>=5)return json(res,429,{ok:false,message:'Слишком много заявок. Попробуйте позднее.'});recent.push(now);limits.set(ip,recent);if(limits.size>5000)limits.clear();
 let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>MAX)return json(res,413,{ok:false,message:'Слишком длинная заявка'})}
 let data;try{data=JSON.parse(body)}catch{return json(res,400,{ok:false,message:'Неверный формат'})}
 const name=String(data.name||'').trim().slice(0,80),contact=String(data.contact||'').trim().slice(0,120),type=String(data.type||'').trim().slice(0,80),notes=String(data.notes||'').trim().slice(0,1500);
 if(name.length<2||contact.length<5||!['START','GROW','SCALE'].includes(type)||!data.consent)return json(res,400,{ok:false,message:'Проверьте обязательные поля'});
 const message=['🆕 NOVA WEB · Новая заявка','Имя: '+name,'Контакт: '+contact,'Тариф: '+type,'Задача: '+(notes||'Не указана')].join('\n');
 try{const response=await fetch('https://api.telegram.org/bot'+TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:CHAT,text:message}),signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok||!result.ok)throw Error('Telegram rejected request');return json(res,200,{ok:true,message:'Заявка отправлена. Мы свяжемся с вами.'})}catch(e){console.error('Lead notification failed');return json(res,503,{ok:false,message:'Сейчас не удалось отправить заявку. Попробуйте позднее.'})}
}

const crypto=require('node:crypto');
const WEBHOOK_SECRET=TOKEN?crypto.createHash('sha256').update('novaweb-webhook:'+TOKEN).digest('hex'):'';
async function telegramSend(chatId,message){const response=await fetch('https://api.telegram.org/bot'+TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:message}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Telegram send failed')}
async function setupWebhook(){if(!TOKEN||!CHAT)return;try{const url='https://novaweb-agency.onrender.com/api/telegram/webhook';const response=await fetch('https://api.telegram.org/bot'+TOKEN+'/setWebhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,secret_token:WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false}),signal:AbortSignal.timeout(10000)});const data=await response.json();console.log('Telegram webhook setup:',data.ok?'OK':'FAILED')}catch(e){console.error('Telegram webhook setup failed:',e.message)}}
async function telegramWebhook(req,res){if(!TOKEN||!CHAT||req.headers['x-telegram-bot-api-secret-token']!==WEBHOOK_SECRET)return json(res,403,{ok:false});let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>16384)return json(res,413,{ok:false})}let update;try{update=JSON.parse(body)}catch{return json(res,400,{ok:false})}const m=update.message;const chatId=String(m?.chat?.id||'');if(!m||!chatId)return json(res,200,{ok:true});if(chatId!==CHAT){return json(res,200,{ok:true})}const command=String(m.text||'').trim().split(' ')[0].split('@')[0];let answer;if(command==='/start')answer='🚀 NOVA WEB · Панель владельца\\n\\nБот подключён к сайту. Новые клиентские заявки будут приходить сюда.\\n\\nКоманды: /status, /help';else if(command==='/status')answer='✅ Сайт: онлайн\\n✅ Telegram: подключён\\n✅ Приём заявок: активен\\n💳 Платежи: ещё не подключены';else if(command==='/help')answer='NOVA WEB\\n/start — открыть панель\\n/status — состояние системы\\n/help — справка';else return json(res,200,{ok:true});try{await telegramSend(chatId,answer)}catch(e){console.error('Telegram command reply failed:',e.message);return json(res,503,{ok:false})}return json(res,200,{ok:true})}
setTimeout(setupWebhook,1500);

http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true});if(req.method==='GET'&&p==='/api/status')return json(res,200,{ordersEnabled:Boolean(TOKEN&&CHAT)});if(req.method==='POST'&&p==='/api/telegram/webhook'){telegramWebhook(req,res).catch(()=>json(res,500,{ok:false}));return}if(req.method==='POST'&&p==='/api/lead'){lead(req,res).catch(()=>json(res,500,{ok:false,message:'Ошибка сервера'}));return}if(req.method==='GET'&&(p==='/'||p==='/index.html'))return page(res);res.writeHead(404);res.end('Not found')}).listen(PORT,'0.0.0.0',()=>console.log('NOVA WEB on '+PORT));
