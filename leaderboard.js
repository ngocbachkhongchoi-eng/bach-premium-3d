'use strict';
module.exports=(users,wallet)=>{
 const totals=new Map();
 for(const w of wallet){
  // Older records only distinguished refunds through their generated note.
  const deposit=w.kind==='deposit'||(!w.kind&&!String(w.note||'').startsWith('Hoàn tiền đơn '));
  if(deposit&&Number.isSafeInteger(w.amount)&&w.amount>0)totals.set(w.username,(totals.get(w.username)||0)+w.amount);
 }
 return users.map(u=>({username:u.username,totalDeposited:totals.get(u.username)||0})).filter(u=>u.totalDeposited>0).sort((a,b)=>b.totalDeposited-a.totalDeposited||a.username.localeCompare(b.username)).slice(0,10);
};
