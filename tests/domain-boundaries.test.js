'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('primary website and SEO use novaweb.uz',()=>{
 const home=read('index.html'),robots=read('robots.txt'),sitemap=read('sitemap.xml');
 assert.ok(home.includes('https://novaweb.uz/'));
 assert.ok(robots.includes('https://novaweb.uz/sitemap.xml'));
 assert.ok(sitemap.includes('https://novaweb.uz/'));
 assert.ok(!sitemap.includes('onrender.com'));
});
test('portfolio stays on Render, with a route back to the primary site',()=>{
 const home=read('index.html'),showcase=read('showcase.html');
 for(const slug of ['beauty','estate','cafe']){
  assert.ok(home.includes('https://novaweb-agency.onrender.com/demo/'+slug));
 }
 assert.ok(showcase.includes('https://novaweb.uz/'));
});
test('Telegram webhook stays on Render while public bot links use primary domain',()=>{
 const server=read('server.js'),bot=read('bot-ui.js');
 assert.ok(server.includes("const SITE='https://novaweb.uz'"));
 assert.ok(server.includes("const WEBHOOK_SITE='https://novaweb-agency.onrender.com'"));
 assert.ok(server.includes("url:WEBHOOK_SITE+'/api/telegram/webhook'"));
 assert.ok(bot.includes('https://novaweb.uz'));
});
