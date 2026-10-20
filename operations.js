'use strict';
function parse(command,args=[]){
 const id=String(args[0]||'').trim();
 if(!/^NW[A-Za-z0-9]{6,40}$/.test(id))return {error:'Укажите ID заявки, например: /'+command+' NW123 ...'};
 const value=args.slice(1).join(' ').trim();
 if(command==='note'){if(!value||value.length>1000)return {error:'Заметка должна содержать от 1 до 1000 символов.'};return {id,changes:{note:value}}}
 if(command==='task'){if(!value||value.length>300)return {error:'Задача должна содержать от 1 до 300 символов.'};return {id,changes:{task:value}}}
 if(command==='due'){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)return {error:'Дата в формате ГГГГ-ММ-ДД, например 2026-11-05.'};return {id,changes:{due:value}}}
 if(command==='quote'){if(!/^\d{1,11}$/.test(value)||Number(value)<=0)return {error:'Укажи сумму в сумах целым числом, например /quote NW123 3000000.'};return {id,changes:{quotedAmount:Number(value)}}}
 return {error:'Неизвестная операция'};
}
function fmtAmount(n){return Number.isSafeInteger(n)&&n>0?n.toLocaleString('ru-RU')+' сум':'не указана'}
function details(x){return ['📁 NOVA WEB · Карточка заказа', 'ID: '+x.id,'Имя: '+x.name,'Контакт: '+x.contact,'Тариф: '+x.type,'Статус: '+x.status,'📌 Задача: '+(x.task||'нет'),'📅 Срок: '+(x.due||'не указан'),'📝 Заметка: '+(x.note||'нет'),'💵 Сумма предложения: '+fmtAmount(x.quotedAmount),'','Сумма предложения не является подтверждённой оплатой.'].join('\n')}
function deadlines(rows){if(!rows.length)return '📅 Просроченных заказов нет.';return '⚠️ Просроченные заказы:\n\n'+rows.slice(0,15).map(x=>x.id+' · '+(x.name||'Клиент')+'\nСрок: '+x.due+' · '+(x.task||'Без задачи')).join('\n\n')}
function finance(rows){const quoted=rows.reduce((total,x)=>total+(Number.isSafeInteger(x.quotedAmount)&&x.quotedAmount>0?x.quotedAmount:0),0);return ['💰 NOVA WEB · Финансы','', 'Сумма коммерческих предложений: '+fmtAmount(quoted),'Предложений с указанной суммой: '+rows.filter(x=>x.quotedAmount>0).length,'','⚠️ Это не выручка и не подтверждённые платежи.','Интеграция с платёжным провайдером ещё не подключена.'].join('\n')}
module.exports={parse,fmtAmount,details,deadlines,finance};
