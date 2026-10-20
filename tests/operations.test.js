'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ops=require('../operations');
test('Operations parse safely, validate deadlines and currency',()=>{
 const id='NW123456abcdef';
 assert.equal(ops.parse('note',[id,'Позвонить','клиенту']).changes.note,'Позвонить клиенту');
 assert.equal(ops.parse('task',[id,'Согласовать дизайн']).changes.task,'Согласовать дизайн');
 assert.equal(ops.parse('due',[id,'2026-11-10']).changes.due,'2026-11-10');
 assert.ok(ops.parse('due',[id,'2026-02-30']).error);
 assert.equal(ops.parse('quote',[id,'3000000']).changes.quotedAmount,3000000);
 assert.ok(ops.parse('quote',[id,'-10']).error);
 assert.ok(ops.parse('note',['invalid','text']).error);
});
test('Financial panel never confuses quotes with payments',()=>{
 const s=ops.finance([{quotedAmount:3000000},{quotedAmount:1500000}]);
 assert.match(s,/4\s*500\s*000/);assert.match(s,/не выручка/);
});
test('Overdue report skips no items passed',()=>{
 assert.match(ops.deadlines([]),/нет/);
 assert.match(ops.deadlines([{id:'NW123456abcdef',name:'Client',due:'2026-10-01'}]),/NW123456abcdef/);
});
