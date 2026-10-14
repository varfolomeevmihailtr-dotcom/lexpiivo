(function(root){
  'use strict';
  function num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
  function clamp(v,min,max){return Math.min(max,Math.max(min,num(v,min)));}
  function dayValue(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return NaN;const d=Date.parse(date+'T00:00:00Z');return d;}
  function addDays(date,days){const time=dayValue(date);return Number.isFinite(time)?new Date(time+num(days)*86400000).toISOString().slice(0,10):null;}
  function age(opened,today){const a=dayValue(opened),b=dayValue(today);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.floor((b-a)/86400000)+1):0;}
  function dateAt(opened,serverDay){return addDays(opened,num(serverDay)-1);}
  function shards(from,to,steps){from=clamp(from,0,50);to=clamp(to,0,50);if(to<from)throw Error('Цель должна быть не ниже текущего значения');return steps.slice(from,to).reduce((s,n)=>s+num(n),0);}
  function xp(from,to,costs){from=Math.trunc(clamp(from,1,150));to=Math.trunc(clamp(to,1,150));if(to<from)throw Error('Целевой уровень ниже текущего');let total=0;for(let level=from;level<to;level++){const c=costs[level-1];if(c===null||c===undefined||!Number.isFinite(Number(c)))throw Error('Для перехода '+level+' → '+(level+1)+' нет проверенной стоимости');total+=Number(c);}return total;}
  function formation(heroes){const counts={warrior:0,ranger:0,warlock:0};heroes.filter(Boolean).forEach(h=>{if(h.faction in counts)counts[h.faction]++;});const sorted=Object.values(counts).sort((a,b)=>b-a);const bonus=sorted[0]===5?20:sorted[0]===4?15:sorted[0]===3&&sorted[1]===2?10:sorted[0]===3?5:0;return{counts,bonus,tanks:heroes.filter(h=>h?.role==='tank').length,dps:heroes.filter(h=>h?.role==='dps').length,support:heroes.filter(h=>h?.role==='support').length};}
  function discountedSeconds(base,speed=0,flatHours=0){return Math.max(0,num(base)/(1+Math.max(0,num(speed))/100)-Math.max(0,num(flatHours))*3600);}
  function fullSteps(stars,substep){return Math.trunc(clamp(stars,0,10))*5+Math.trunc(clamp(substep,0,4));}
  function plunderLimit(level){const values={10:2.5,11:2.5,12:2.5,13:3,14:4,15:5,16:6,17:7,18:8,19:9,20:10,21:12,22:14,23:16,24:18,25:20,26:22,27:24,28:26,29:28,30:30};return values[Math.trunc(level)]?values[Math.trunc(level)]*1e6:null;}
  const api={num,clamp,age,addDays,dateAt,shards,xp,formation,discountedSeconds,fullSteps,plunderLimit};root.PlagueCore=api;if(typeof module==='object')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
