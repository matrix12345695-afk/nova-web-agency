'use strict';
// The worker runs only while the free web process is awake.
// Database rows make daily notices idempotent across restarts.
const MAX_ITEMS=12;
function dayInTashkent(at=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(at)}
function shouldCheck(at=new Date()){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',hour:'2-digit',hourCycle:'h23'}).format(at));return hour>=9&&hour<21}
function eligible(rows,today){return rows.filter(x=>x.due&&x.due<today&&!['done','lost'].includes(x.status)).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,MAX_ITEMS)}
function textFor(rows,today){return ['⏰ NOVA WEB · Контроль сроков','Дата: '+today,'Просрочено: '+rows.length,'',...rows.map(x=>'• '+x.id+' · '+(x.name||'Клиент')+'\n  Срок: '+x.due+(x.task?'\n  Задача: '+x.task:'')),'','Открой /overdue для всех просроченных заказов.'].join('\n')}
async function check({crm,send,now=new Date()}){
 if(!shouldCheck(now)||crm.mode()!=='postgres')return {status:'skipped'};
 const today=dayInTashkent(now);
 const rows=eligible(await crm.all(),today);
 if(!rows.length)return {status:'empty'};
 if(!(await crm.claimReminder(today)))return {status:'already_sent'};
 try{await send(textFor(rows,today));return {status:'sent',count:rows.length}}
 catch(e){await crm.releaseReminder(today).catch(()=>{});throw e}
}
module.exports={dayInTashkent,shouldCheck,eligible,textFor,check};
