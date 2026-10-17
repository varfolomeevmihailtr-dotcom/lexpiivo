(()=>{'use strict';
const el=(s,root=document)=>root.querySelector(s),all=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.LEX_SB;
const normalize=s=>String(s??'').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\s+/g,' ').trim().toLocaleLowerCase();
const fmt=n=>n==null?'—':new Intl.NumberFormat('ru-RU').format(n);
const readPower=value=>{if(value==null||value==='')return null;
 if(typeof value==='number'){if(!Number.isSafeInteger(value)||value<0)throw Error('Неподдерживаемое значение мощности');return value}
 const s=String(value).replace(/[\s,._\u00a0\u202f]/g,'');if(!/^\d{1,15}$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)?n:null};
const txt=v=>v==null?'':String(v);
const rank=v=>{const s=txt(v).trim().toUpperCase();const m=s.match(/(?:^R?([1-5])$|^RANK\s*([1-5])$)/);return m?'R'+(m[1]||m[2]):null};
const candidates=d=>[d, d?.members,d?.players,d?.roster,d?.roster?.members,d?.alliance?.members,d?.alliance?.players,d?.data,d?.data?.members,d?.data?.players,d?.data?.roster,d?.export?.members,d?.items,d?.records,d?.allianceMembers,d?.result?.members].find(Array.isArray);
function parseJSON(data){const input=candidates(data);
 if(!input)throw Error('JSON не содержит массив участников. Нужен экспорт состава с страницы альянса, а не полный экспорт всех серверов.');
 if(!input.length||input.length>150)throw Error('Ожидается состав из 1–150 игроков. В этом файле: '+input.length);
 const meta=data?.alliance||data?.data?.alliance||data;const server=Number(meta?.server??meta?.serverId??meta?.server_id??data?.server);
 if(Number.isFinite(server)&&server>0&&server!==347)throw Error('Этот файл относится к серверу '+server+', а наш сервер — 347.');
 const tag=txt(meta?.tag??meta?.alliance_tag??meta?.allianceTag??'').replace(/\[|\]/g,'').trim();
 if(tag&&tag.toUpperCase()!=='LEX')throw Error('В файле указан альянс ['+tag+'], а нужен [LEX].');
 const items=input.map((raw,i)=>{const item=raw?.player||raw?.doctor||raw||{};
 const name=txt(item.nickname??item.player_name??item.playerName??item.name??item.username??item.displayName??item.doctorName??item.role_name??'').trim();
 const power=readPower(item.power??item.might??item.total_power??item.totalPower??item.battlePower??item.powerValue??item.power_value??item.value);
 const id=txt(item.player_id??item.playerId??item.gameId??item.game_player_id??item.uid??item.userId??item.id??'').trim();
 if(!name||name.length>100)throw Error('У игрока #'+(i+1)+' не найден корректный ник. Нужен пример JSON для адаптации импорта.');
 if(power==null)throw Error('У игрока '+name+' не распознана мощность. Нужен пример JSON для адаптации импорта.');
 const key=id?'id:'+id:'nick:'+normalize(name);
 return {source_key:key,nickname:name,game_player_id:id||null,power,rank:rank(item.rank??item.position??item.allianceRank??item.alliance_rank)};
 });
 if(new Set(items.map(x=>x.source_key)).size!==items.length)throw Error('В файле есть дублирующиеся игровые ID или ники. Импорт остановлен, чтобы не испортить состав.');
 return items;
}
async function me(){const {data:{user}}=await sb().auth.getUser();if(!user)return null;const {data,error}=await sb().from('clan_accounts').select('user_id,role,nickname').eq('user_id',user.id).single();if(error)throw error;return data}
function stats(rows){return rows.reduce((v,x)=>v+BigInt(x.power||0),0n).toLocaleString('ru-RU')}
let prepared=null;
async function render(node){
 const current=await me();if(!current){node.innerHTML='<div class="panel"><h2>Состав из игры</h2><p>Войди в аккаунт, чтобы сравнить игроков и регистрации.</p><a class="btn" href="./login.html">Войти</a></div>';return}
 const canEdit=['r4','r5','admin'].includes(current.role);
 const [r,a,l]=await Promise.all([sb().from('game_roster').select('*').eq('is_current',true).order('power',{ascending:false}),sb().from('clan_accounts').select('user_id,nickname,role,power'),sb().from('roster_links').select('user_id,source_key')]);
 for(const x of [r,a,l])if(x.error)throw x.error;
 const players=r.data||[],accounts=a.data||[],links=l.data||[];
 const linked=new Map(links.map(x=>[x.source_key,x.user_id]));
 const registeredById=new Map(accounts.map(x=>[x.user_id,x]));
 const index=new Map();for(const account of accounts){const k=normalize(account.nickname);index.set(k,[...(index.get(k)||[]),account])}
 const matches=players.map(player=>{const explicit=linked.get(player.source_key);
 if(explicit){const found=registeredById.get(explicit);if(found)return {...player,account:found,method:'linked'}}
 const same=index.get(normalize(player.nickname))||[];
 return {...player,account:same.length===1?same[0]:null,method:same.length===1?'nickname':same.length>1?'ambiguous':'missing'};
 });
 const matched=matches.filter(x=>!!x.account),unmatched=matches.filter(x=>!x.account);
 const accountedIds=new Set(matched.map(m=>m.account.user_id));
 const absent=accounts.filter(x=>!accountedIds.has(x.user_id));
 const latest=players.reduce((a,b)=>!a||new Date(b.captured_at)>new Date(a)?b.captured_at:a,null);
 const membersText=players.length?'<p class="small muted">Обновлено из файла: '+esc(new Date(latest).toLocaleString('ru-RU'))+'. Это снимок, а не прямое соединение с игрой.</p>':'<p class="small muted">Данных из игры ещё нет. Сначала загрузите экспорт альянса.</p>';
 const options=accounts.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.nickname)+'</option>').join('');
 node.innerHTML='<section class="lex-ops-card"><h2>Состав альянса [LEX] · сервер 347</h2><p>Сверка игрового списка с аккаунтами сайта. Игровую мощность и ник берем из загруженного JSON LastAsylum.gg, не из анкет игроков.</p><div class="lex-metrics"><div><b>'+players.length+'</b><span>В игровой выгрузке</span></div><div><b>'+matched.length+'</b><span>Есть аккаунт</span></div><div><b>'+unmatched.length+'</b><span>Не зарегистрированы</span></div><div><b>'+fmt(absent.length)+'</b><span>На сайте, но нет в выгрузке</span></div></div><div class="lex-total">Мощь по игровому списку: <strong>'+stats(players)+'</strong></div>'+membersText+'<p><a href="https://lastasylum.gg/ru/leaderboard/servers" target="_blank" rel="noopener noreferrer" class="text-link">Открыть рейтинг LastAsylum.gg →</a> Найди сервер #347, альянс [LEX]PIIVO и скачай JSON состава на странице альянса.</p></section>'+
 (canEdit?'<section class="lex-ops-card"><h3>Обновить состав из JSON</h3><p class="small muted">Только R4, R5 и администратор. Загружается до 150 строк, данные сверяются с тегом и сервером, если они есть в файле. Импорт создаёт новый снимок: прежние игроки остаются в истории, но исключаются из актуального состава.</p><input type="file" accept=".json,application/json" id="lexRosterJson"><label class="lex-inline"><input id="lexRosterConfirm" type="checkbox"> Проверил: файл относится к [LEX] PIIVO на сервере 347</label><div id="lexImportPreview" class="small muted"></div><button class="btn" id="lexImportSubmit" disabled>Импортировать состав</button></section>':'')+
 (players.length?'<section class="lex-ops-card"><h3>Кто есть в игре, но ещё не зарегистрирован</h3><p class="small muted">Сверка по Unicode-нику (NFKC + удаление невидимых символов). Изменённые ники может вручную связать офицер.</p><div class="table-wrap"><table><thead><tr><th>Игрок в игре</th><th>Ранг</th><th>Мощность</th><th>Аккаунт сайта</th>'+(canEdit?'<th>Привязка</th>':'')+'</tr></thead><tbody>'+matches.map(x=>'<tr><td>'+esc(x.nickname)+'</td><td>'+esc(x.rank||'—')+'</td><td>'+fmt(x.power)+'</td><td>'+(x.account?'<span class="lex-good">'+esc(x.account.nickname)+'</span> <small>'+(x.method==='linked'?'✓ подтверждено':'по нику')+'</small>':'<span class="lex-warn">Нет регистрации'+(x.method==='ambiguous'?' · неоднозначно':'')+'</span>')+'</td>'+
 (canEdit?'<td><div class="lex-row-actions">'+(x.method==='linked'?'<button class="btn ghost" data-unlink="'+esc(x.source_key)+'">Отвязать</button>':'<select data-link-select="'+esc(x.source_key)+'"><option value="">Выбрать аккаунт…</option>'+options+'</select><button class="btn ghost" data-link="'+esc(x.source_key)+'">Связать</button>')+'</div></td>':'')+'</tr>').join('')+'</tbody></table></div></section>':'')+
 (players.length?'<section class="lex-ops-card"><h3>Зарегистрированы, но не обнаружены в выгрузке</h3><p class="small muted">Возможно, изменили игровой ник, вышли из альянса или экспорт устарел. Это не доказательство выхода.</p><div class="lex-chip-list">'+(absent.length?absent.map(x=>'<span class="lex-person">'+esc(x.nickname)+'</span>').join(''):'Все зарегистрированные аккаунты найдены')+'</div></section>':'')+
 '<p id="lexImportStatus" role="status" class="small"></p>';
 const status=t=>{const x=el('#lexImportStatus',node);if(x)x.textContent=t};
 const file=el('#lexRosterJson',node);
 if(file)file.onchange=async()=>{prepared=null;el('#lexImportSubmit',node).disabled=true;try{
 const f=file.files?.[0];if(!f)return;if(f.size>2e6)throw Error('Размер файла не должен превышать 2 МБ');
 const data=JSON.parse(await f.text());prepared=parseJSON(data);
 el('#lexImportPreview',node).textContent='Распознано '+prepared.length+' игроков. Мощь: '+stats(prepared)+'. Пример: '+prepared.slice(0,3).map(x=>x.nickname+' ('+fmt(x.power)+')').join(', ')+'.';
 el('#lexImportSubmit',node).disabled=false;
 }catch(e){el('#lexImportPreview',node).textContent='Ошибка: '+e.message}};
 const imp=el('#lexImportSubmit',node);if(imp)imp.onclick=async()=>{if(!prepared||!el('#lexRosterConfirm',node).checked){status('Сначала проверь, что выгрузка именно [LEX] и #347, и поставь галочку.');return}imp.disabled=true;try{
 const snapshot=prepared.map(({source_key,nickname,game_player_id,power,rank})=>({source_key,nickname,game_player_id,power,rank}));
 const {error}=await sb().rpc('replace_game_roster',{snapshot});if(error)throw error
 prepared=null;await render(node);
 }catch(e){status('Ошибка: '+e.message);imp.disabled=false}};
 all('[data-link]',node).forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.link,userId=el('[data-link-select="'+CSS.escape(id)+'"]',node).value;
 if(!userId){status('Выбери зарегистрированный аккаунт.');return}
 const {error}=await sb().from('roster_links').upsert({source_key:id,user_id:userId,linked_by:current.user_id},{onConflict:'user_id'});
 if(error)status(error.message);else render(node);
 });
 all('[data-unlink]',node).forEach(btn=>btn.onclick=async()=>{const {error}=await sb().from('roster_links').delete().eq('source_key',btn.dataset.unlink);if(error)status(error.message);else render(node)});
}
window.LEX_ROSTER={async render(){const node=document.getElementById('lexRoster');if(!node)return;try{if(!sb())throw Error('Supabase не подключился');await render(node)}catch(e){if(node.isConnected)node.textContent='Ошибка: '+e.message}}};
})();