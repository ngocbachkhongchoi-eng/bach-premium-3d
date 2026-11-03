'use strict';
const crypto=require('node:crypto');
module.exports=function(secret){
 const key=crypto.createHash('sha256').update('bach-delivery-v1:'+secret).digest();
 return {
  seal(value){
   const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
   const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
   return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64url')).join('.');
  },
  open(value){
   if(!value)return null;
   const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64url'));
   const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
   return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
  }
 };
};
