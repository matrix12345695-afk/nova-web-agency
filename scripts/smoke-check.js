'use strict';
// Read-only public checks: never submit leads or invoke the Telegram webhook.
const BASE='https://novaweb-agency.onrender.com';
const TARGETS=Object.freeze([
 {name:'primary',url:'https://novaweb.uz/',kind:'html'},
 {name:'crm-health',url:BASE+'/health',kind:'health'},
 {name:'lead-intake-status',url:BASE+'/api/status',kind:'status'},
 {name:'demo-beauty',url:BASE+'/demo/beauty',kind:'html'},
 {name:'demo-estate',url:BASE+'/demo/estate',kind:'html'},
 {name:'demo-cafe',url:BASE+'/demo/cafe',kind:'html'}
]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkOne(target,{fetchFn=fetch,sleepFn=sleep,retries=2,timeoutMs=15000}={}){
 let error='not attempted';
 for(let i=0;i<=retries;i++){
  try{
   const res=await fetchFn(target.url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
   if(!res.ok)throw Error('HTTP '+res.status);
   if(target.kind==='health'){
    const body=await res.json();
    if(body.ok!==true||body.storage!=='postgres')throw Error('PostgreSQL readiness not confirmed');
   }else if(target.kind==='status'){
    const body=await res.json();
    if(body.ordersEnabled!==true)throw Error('Lead intake is disabled');
   }else if(!String(res.headers?.get('content-type')||'').toLowerCase().includes('text/html')){
    throw Error('Expected HTML response');
   }
   return {name:target.name,ok:true,attempts:i+1,recovered:i>0};
  }catch(e){error=String(e.message||e).slice(0,150)}
  if(i<retries)await sleepFn(5000*(i+1));
 }
 return {name:target.name,ok:false,attempts:retries+1,error};
}
async function main(){
 const results=[];
 for(const target of TARGETS)results.push(await checkOne(target));
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),results,webhookDelivery:'not-tested'},null,2));
 if(results.some(r=>!r.ok))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error('Smoke check failed:',String(e.message||e));process.exitCode=1});
module.exports={TARGETS,checkOne};
