(()=>{'use strict';
const $=(s,root=document)=>root.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n==null?'—':new Intl.NumberFormat('ru-RU').format(n);
const when=t=>t&&Number.isFinite(Date.parse(t))?new Date(t).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}):'Ещё не обновлялось';
const stale=t=>!t||!Number.isFinite(Date.parse(t))||Date.now()-Date.parse(t)>36*3600e3;
let cache=null,cacheAt=0,ongoing=null;
async function load(force=false){
 if(!force&&cache&&Date.now()-cacheAt<5*60e3)return cache;
 if(ongoing)return ongoing;
 ongoing=fetch('./live.json?t='+Math.floor(Date.now()/300000),{cache:'no-store'})
 .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})
 .then(json=>{cache=json;cacheAt=Date.now();return json})
 .finally(()=>ongoing=null);
 return ongoing;
}
function codeRows(list){return (list||[]).map(code=>'<span class="lex-live-code"><code>'+esc(code)+'</code><button class="btn ghost" data-copy-live="'+esc(code)+'">Копировать</button></span>').join('')}
function addCopy(node){node.querySelectorAll('[data-copy-live]').forEach(btn=>btn.onclick=async()=>{try{await navigator.clipboard.writeText(btn.dataset.copyLive);const original=btn.textContent;btn.textContent='Скопировано ✓';setTimeout(()=>{if(btn.isConnected)btn.textContent=original},1500)}catch{btn.textContent='Выдели код вручную'}})}
function ageHint(t){return stale(t)?'<span class="lex-live-alert">Данные устарели или ещё не загружены</span>':'<span class="lex-live-fresh">Получено: '+esc(when(t))+'</span>'}
function aboutError(d,type){const err=d?.errors?.[type];return err?'<p class="small muted">Последняя попытка: '+esc(when(d.attempted_at))+' · источник временно недоступен. Предыдущие данные сохранены.</p>':''}
function summary(d){const a=d?.alliance,c=d?.codes;
return '<div class="lex-live-metrics"><div><span>Игроков в [LEX]</span><b>'+(a?fmt(a.member_count):'—')+'</b></div><div><span>БМ альянса по рейтингу</span><b>'+(a?fmt(a.official_power||a.roster_power_sum):'—')+'</b></div><div><span>Рабочих кодов по источнику</span><b>'+(c?fmt(c.active?.length):'—')+'</b></div><div><span>Место на сервере</span><b>'+(a?.server_rank?'#'+fmt(a.server_rank):'—')+'</b></div></div>'+
 '<p class="small muted">БМ альянса берётся из рейтинга сервера; сумма мощи участников показывается отдельно. Числа могут запаздывать относительно игры.</p>';
}
function renderHome(node,d){
 const a=d?.alliance,c=d?.codes;
 node.innerHTML='<div class="lex-live-top"><div><h2>Актуальная информация [LEX]</h2><p class="small muted">Рейтинг и промокоды из LastAsylum.gg. Источники обновляются отдельно.</p></div><a href="#live" class="btn ghost">Подробнее →</a></div>'+summary(d)+
 '<div class="lex-live-dates"><span>Состав: '+esc(when(a?.checked_at))+(stale(a?.checked_at)?' · ждём обновления':'')+'</span><span>Коды: '+esc(when(c?.checked_at))+(stale(c?.checked_at)?' · ждём обновления':'')+'</span></div>';
}
function renderCodes(node,d){
 const data=d?.codes;
 node.innerHTML='<h2>Коды из LastAsylum.gg</h2><p class="small muted">Дважды в сутки проверяем опубликованный список. Реальную работоспособность для конкретного аккаунта может подтвердить только ввод в игре.</p>'+
 (data?ageHint(data.checked_at)+'<div class="lex-live-codes">'+codeRows(data.active)+'</div><p class="small muted">'+fmt(data.expired?.length)+' кодов отмечены источником как истёкшие</p>':'<p>Первое обновление ещё не состоялось. Пока пользуйся кодами из своего журнала ниже.</p>')+
 aboutError(d,'codes')+'<a href="https://lastasylum.gg/en/codes" target="_blank" rel="noopener noreferrer" class="text-link">Источник: LastAsylum.gg ↗</a>';
 addCopy(node);
}
function topTable(d){const a=d?.alliance,top=a?.top_server_alliances;if(!top?.length)return '';
return '<section class="lex-live-box lex-top-alliances"><h3>Топ-10 альянсов сервера 347 по БМ</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Альянс</th><th>Мощность</th></tr></thead><tbody>'+top.map(row=>'<tr'+(row.rank===a.server_rank?' class="lex-is-us"':'')+'><td>'+fmt(row.rank)+'</td><td><a target="_blank" rel="noopener noreferrer" href="'+esc(row.url)+'">'+esc(row.name)+'</a></td><td>'+fmt(row.power)+'</td></tr>').join('')+'</tbody></table></div><p class="small muted">Данные LastAsylum.gg на '+esc(when(a.checked_at))+'.</p></section>'}
function topPlayers(d){const members=d?.alliance?.members;if(!members?.length)return '';
 const top=[...members].sort((x,y)=>Number(y.power)-Number(x.power)).slice(0,10);
 return '<section class="lex-live-box lex-top-alliances"><h3>Топ-10 участников [LEX] по мощности</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Игрок</th><th>Ранг</th><th>Мощность</th></tr></thead><tbody>'+top.map((p,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(p.nickname)+'</td><td>'+esc(p.rank||'—')+'</td><td>'+fmt(p.power)+'</td></tr>').join('')+'</tbody></table></div><p><a class="text-link" href="#sync">Сравнить весь состав с регистрациями →</a></p></section>';
}
function trend(d){const h=(d?.history||[]).filter(x=>x.official_power);if(h.length<2)return '';const first=h[0],last=h[h.length-1],delta=BigInt(last.official_power)-BigInt(first.official_power);return '<p class="small muted">Изменение БМ за последние '+h.length+' снимков: <strong class="'+(delta>=0n?'lex-good':'lex-warn')+'">'+(delta>=0n?'+':'')+fmt(delta.toString())+'</strong></p>'}
function renderFull(node,d){
 const a=d?.alliance,c=d?.codes;
 node.innerHTML='<div class="lex-live-top"><div><h2>Данные игры · сервер 347</h2><p>Два обновления в сутки через GitHub Actions без платных серверов. Ниже всегда указан момент последнего успешного получения данных.</p></div><a href="#sync" class="btn ghost">Сверить игроков →</a></div>'+summary(d)+
 '<div class="lex-live-cols"><section class="lex-live-box"><h3>Альянс [LEX] PIIVO</h3>'+ageHint(a?.checked_at)+
 (a?'<p>Источник: <a class="text-link" href="'+esc(a.source)+'" target="_blank" rel="noopener noreferrer">'+esc(a.name)+' ↗</a></p><p>Место по БМ: #'+fmt(a.server_rank)+' · официальная БМ: '+fmt(a.official_power)+'</p><p>Состав: '+fmt(a.member_count)+' игроков · сумма мощи участников: '+fmt(a.roster_power_sum)+'</p>':'<p>Состав автоматически ещё не получен. Офицер может загрузить JSON на странице «Состав из игры».</p>')+
 aboutError(d,'alliance')+
 '<a href="https://lastasylum.gg/en/leaderboard/servers/347" target="_blank" rel="noopener noreferrer" class="text-link">Рейтинг сервера #347 ↗</a></section>'+
 '<section class="lex-live-box"><h3>Рабочие промокоды</h3>'+ageHint(c?.checked_at)+
 (c?'<div class="lex-live-codes">'+codeRows(c.active)+'</div><details><summary>Истёкшие по источнику ('+fmt(c.expired?.length)+')</summary><p class="small muted">'+(c.expired||[]).map(esc).join(' · ')+'</p></details>':'<p>Ожидаем первое обновление кодов.</p>')+
 aboutError(d,'codes')+'<a href="https://lastasylum.gg/en/codes" class="text-link" target="_blank" rel="noopener noreferrer">Страница кодов ↗</a></section></div>'+trend(d)+topTable(d)+topPlayers(d)+
 '<p class="small muted">LastAsylum.gg — независимый фанатский источник, не API разработчика игры. Если сайт поменяет структуру, автоматический импорт приостановится, а старые значения останутся с прежней датой.</p>';
 addCopy(node);
}
async function render(kind){
 const node=document.getElementById(kind==='home'?'lexLiveHome':kind==='codes'?'lexLiveCodes':'lexLiveFull');
 if(!node)return;let d;
 try{d=await load()}catch(e){if(node.isConnected)node.textContent='Не удалось загрузить ленту: '+e.message;return}
 if(!node.isConnected)return;
 if(kind==='home')renderHome(node,d);else if(kind==='codes')renderCodes(node,d);else renderFull(node,d);
}
window.LEX_LIVE={load,render};
})();