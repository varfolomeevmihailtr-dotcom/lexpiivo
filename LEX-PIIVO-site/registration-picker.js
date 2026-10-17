(()=>{'use strict';
const $=id=>document.getElementById(id);let players=[],selected=null;
const label=$('nickLabel'),nick=$('nickname'),form=$('authForm'),status=$('status');
if(!label||!nick||!form)return;
const search=document.createElement('input');search.id='gameNickSearch';search.type='search';search.autocomplete='off';search.placeholder='Поиск по игровому нику (любой язык)';
const note=document.createElement('small');note.id='gameNickInfo';note.style.cssText='display:block;color:#b6d0a8;line-height:1.5;margin:5px 0';
note.textContent='Загружаем актуальный список [LEX]…';
const results=document.createElement('div');results.id='gameNickResults';results.style.cssText='max-height:190px;overflow:auto;display:grid;gap:4px';
const hidden=document.createElement('input');hidden.type='hidden';hidden.id='selectedGamePlayerId';
label.insertBefore(note,nick);label.insertBefore(search,nick);
nick.parentNode.insertBefore(hidden,nick.nextSibling);nick.readOnly=true;nick.placeholder='Выбери ник из списка выше';
label.after(results);
const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase().trim();
function render(){
 results.replaceChildren();
 const found=players.filter(p=>normalize(p.nickname).includes(normalize(search.value))).slice(0,30);
 for(const p of found){
 const b=document.createElement('button');b.type='button';b.style.cssText='display:flex;justify-content:space-between;gap:12px;width:100%;padding:9px;text-align:left;border:1px solid #567353;border-radius:7px;background:#28402d;color:#edf3e8';
 const a=document.createElement('span');a.textContent=p.nickname;
 const meta=document.createElement('small');meta.textContent=(p.rank||'R1')+' · '+new Intl.NumberFormat('ru-RU').format(p.power||0)+' БМ';
 b.append(a,meta);b.onclick=()=>{selected=p;nick.value=p.nickname;hidden.value=p.game_player_id;search.value=p.nickname;results.replaceChildren();note.textContent='Игрок выбран: '+p.nickname+' · привязку подтвердит офицер R4/R5';};results.append(b)
 }
 if(!found.length){const small=document.createElement('small');small.textContent=players.length?'Игрок не найден. Обратись к R4, чтобы проверить состав.':'Пока нет данных о составе';results.append(small)}
}
search.addEventListener('input',()=>{selected=null;nick.value='';hidden.value='';render()});
fetch('./live.json?t='+Math.floor(Date.now()/300000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{
 if(d?.alliance?.server!==347||!Array.isArray(d.alliance.members)||!d.alliance.members.length)throw Error('Список [LEX] на #347 не найден');
 players=d.alliance.members.filter(p=>p.game_player_id&&p.nickname&&[...p.nickname].length<=40);
 note.textContent='Найдено '+players.length+' игроков, проверено '+new Date(d.alliance.checked_at).toLocaleString('ru-RU')+'. Выбери свой ник.';
 render();
}).catch(e=>{note.textContent='Не удалось загрузить игровой состав: '+e.message});
form.addEventListener('submit',e=>{if(label.style.display==='none')return;
 if(!selected||nick.value!==selected.nickname||hidden.value!==selected.game_player_id){
  e.preventDefault();e.stopImmediatePropagation();status.textContent='Для регистрации сначала выбери ник из списка [LEX].';return
 }
},true);
const switchButton=$('switch');
if(switchButton)switchButton.addEventListener('click',()=>setTimeout(()=>{if(label.style.display!=='none')render()},0));
})();