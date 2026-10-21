'use strict';
async function checkReadiness(crm){
  const storage=crm.mode();
  if(storage!=='postgres')return {ok:false,storage};
  try{
    await crm.ping();
    return {ok:true,storage:'postgres'};
  }catch{
    return {ok:false,storage:'postgres_unavailable'};
  }
}
module.exports={checkReadiness};
