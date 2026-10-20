'use strict';
const SOURCES=new Set(['direct','google','instagram','telegram','referral','portfolio','outreach','other']);
function normalizeSource(value){const v=String(value||'').trim().toLowerCase();return SOURCES.has(v)?v:'direct'}
function normalizeCampaign(value){return /^[a-z0-9_-]{1,40}$/i.test(String(value||''))?String(value).toLowerCase():'none'}
function funnel(rows){const bySource={};const statuses={};for(const item of rows){const source=normalizeSource(item.source);if(!bySource[source])bySource[source]={total:0,active:0,done:0};const group=bySource[source];group.total++;if(item.status==='done')group.done++;if(!['lost','done'].includes(item.status))group.active++;statuses[item.status]=(statuses[item.status]||0)+1}return {total:rows.length,bySource,statuses}}
function report(rows){const data=funnel(rows);const lines=Object.entries(data.bySource).sort((a,b)=>b[1].total-a[1].total).map(([source,s])=>source+': '+s.total+' обращений · '+s.active+' активных · '+s.done+' завершено');return ['📣 NOVA WEB · Источники заявок','Всего: '+data.total,'',...lines,'','Статусы не равны оплаченной выручке. Источники определяются метками ссылок и выбором посетителя.'].join('\n')}
module.exports={normalizeSource,normalizeCampaign,funnel,report};
