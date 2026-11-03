const {test}=require('node:test'),assert=require('node:assert/strict'),rank=require('../leaderboard');
test('top ten counts deposits, not purchases, refunds or empty accounts',()=>{
 const users=Array.from({length:15},(_,i)=>({username:'u'+i}));
 const wallet=users.slice(1).map((u,i)=>({username:u.username,kind:'deposit',amount:(i+1)*100}));
 wallet.push({username:'u0',kind:'refund',amount:999999},{username:'u0',amount:999999,note:'Hoàn tiền đơn old'},{username:'u1',amount:-500,note:'Mua acc'},{username:'u1',amount:50,note:'ADMIN nạp tiền'});
 const top=rank(users,wallet);assert.equal(top.length,10);assert.equal(top[0].username,'u14');assert.ok(top.every(u=>u.totalDeposited>0&&u.username!=='u0'));
 assert.equal(rank([{username:'u1'}],wallet)[0].totalDeposited,150);
});
