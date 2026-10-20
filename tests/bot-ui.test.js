'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../bot-ui');
test('Owner home menu contains working navigation and safe finance link',()=>{
 const keys=ui.menu().inline_keyboard.flat();
 const actions=keys.filter(x=>x.callback_data).map(x=>x.callback_data);
 for(const needed of ['nav|dashboard','nav|leads|0','nav|new|0','nav|today','nav|finance','nav|backup','nav|help'])assert.ok(actions.includes(needed));
 assert.match(ui.financeText(),/не подключён/);
});
test('Lead pagination is bounded and callback payloads fit Telegram',()=>{
 const rows=Array.from({length:12},(_,i)=>({id:'NW123456789'+i,name:'Test '+i,type:'START',status:i%2?'new':'working'}));
 const page=ui.leadList(rows,'all',2);
 assert.match(page.text,/Страница 3\/3/);
 assert.match(page.text,/Всего 12/);
 assert.equal(page.keyboard.inline_keyboard.filter(x=>x[0]?.callback_data?.startsWith('view|')).length,2);
 assert.ok(page.keyboard.inline_keyboard.flat().every(x=>!x.callback_data||Buffer.byteLength(x.callback_data,'utf8')<=64));
 const nov=ui.leadList(rows,'new',20);
 assert.match(nov.text,/Всего 6/);
 assert.match(nov.text,/Страница 2\/2/);
});
test('Status buttons fit Telegram payload limits',()=>{
 const buttons=ui.cardKeyboard('NW12345678901234567890','new',0).inline_keyboard.flat();
 assert.ok(buttons.some(x=>x.callback_data?.endsWith('|done')));
 assert.ok(buttons.some(x=>x.callback_data==='nav|new|0'));
 assert.ok(buttons.every(x=>!x.callback_data||Buffer.byteLength(x.callback_data,'utf8')<=64));
});
test('Statistics do not claim any payments',()=>{
 const text=ui.summaryText({total:3,counts:{new:2,done:1}},'postgres');
 assert.match(text,/Заявок: 3/);
 assert.match(text,/PostgreSQL/);
 assert.match(text,/Платежи: не подключены/);
});
