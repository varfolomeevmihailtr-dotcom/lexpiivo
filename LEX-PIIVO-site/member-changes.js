(()=>{'use strict';
const fmt=n=>n==null?'—':new Intl.NumberFormat('ru-RU').format(n);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rows(items,label,isPower){return items.length?'<section class="lex-change-card"><h3>'+label+' ('+items.length+')</h3><div class="table-wrap"><table><thead><tr><th>Игрок</th><th>'+(isPower?'Изменение БМ':'БМ')+'</th><th>Замечено</th></tr></thead><tbody>'+items.map(e=>'<tr><td>'+safe(e.nickname)+'</td><td>'+(!isPower?'':e.delta>0?'+':'')+fmt(isPower?e.delta:e.power)+'</td><td>'+safe(new Date(e.at).toLocaleString('ru-RU'))+'</td></tr>').join('')+'</tbody></table></div></section>':''}
async function render(){
 const node=document.getElementById('lexChanges');if(!node)return;
 try{const response=await fetch('./live.json?v='+Math.floor(Date.now()/300000),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();const all=Array.isArray(data.member_events)?data.member_events:[];
 const age=Date.now()-24*60*60*1000,day=all.filter(e=>e.at&&new Date(e.at).getTime()>=age);
 const joins=day.filter(e=>e.type==='joined'),left=day.filter(e=>e.type==='left'),power=day.filter(e=>e.type==='power');
 const climbs=power.filter(e=>e.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,20);
 const dips=power.filter(e=>e.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,20);
 const renamed=day.filter(e=>e.type==='renamed');
 node.innerHTML='<section class="lex-ops-card"><h2>Что изменилось за 24 часа</h2><p>Сравнение последовательных снимков 99 игроков [LEX]. Проверка дважды в сутки.</p><div class="lex-metrics"><div><b>'+joins.length+'</b><span>Вступили</span></div><div><b>'+left.length+'</b><span>Вышли</span></div><div><b>'+climbs.length+'</b><span>Выросла БМ</span></div><div><b>'+dips.length+'</b><span>Упала БМ</span></div></div><p class="small muted">Последний сбор данных: '+safe(data.alliance?.checked_at?new Date(data.alliance.checked_at).toLocaleString('ru-RU'):'нет данных')+'. История началась после второго снимка, поэтому отсутствие изменений не означает, что их никогда не было.</p></section>'+
 rows(joins,'Новые игроки',false)+rows(left,'Ушли из состава',false)+rows(climbs,'Самый большой прирост мощности',true)+rows(dips,'Снижение мощности',true)+
 (renamed.length?'<section class="lex-change-card"><h3>Сменили ник</h3>'+renamed.map(x=>'<p>'+safe(x.previous_name)+' → '+safe(x.nickname)+'</p>').join('')+'</section>':'')+
 (!day.length?'<section class="lex-ops-card"><p>Новых изменений между последними проверками не зафиксировано.</p></section>':'')+
 '<p class="small muted">Источник — LastAsylum.gg, не прямое подключение к игре. Временные пропуски/переименования могут ошибочно выглядеть как уход или приход; спорные случаи подтверждайте в игре.</p>';
 }catch(e){if(node.isConnected)node.textContent='Не удалось открыть изменения: '+e.message}
}
window.LEX_CHANGES={render};
})();