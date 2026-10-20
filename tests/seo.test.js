'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Landing supports RU and UZ and lead form tracks spam-trap',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const v of ['data-lang="ru"','data-lang="uz"','name="website"','lang=','rel="canonical"'])assert.ok(html.includes(v),v);
 assert.ok(html.includes("website:f.get('website')"));
});
test('SEO files include canonical origin and exclude API/demo',()=>{
 const robots=fs.readFileSync('robots.txt','utf8'),sitemap=fs.readFileSync('sitemap.xml','utf8');
 assert.match(robots,/Disallow: \/api\//);assert.match(robots,/Disallow: \/demo\//);assert.match(sitemap,/https:\/\/novaweb-agency.onrender.com\//);
});
