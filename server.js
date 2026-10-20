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
http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true});if(req.method==='GET'&&p==='/api/status')return json(res,200,{ordersEnabled:Boolean(TOKEN&&CHAT)});if(req.method==='POST'&&p==='/api/lead'){lead(req,res).catch(()=>json(res,500,{ok:false,message:'Ошибка сервера'}));return}if(req.method==='GET'&&(p==='/'||p==='/index.html'))return page(res);res.writeHead(404);res.end('Not found')}).listen(PORT,'0.0.0.0',()=>console.log('NOVA WEB on '+PORT));
