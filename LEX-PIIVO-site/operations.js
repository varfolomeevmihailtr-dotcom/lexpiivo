(()=>{'use strict';
const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeNames={elixir:'Битва за эликсир',cheese:'Сырная ловушка',duel:'Дуэль альянсов',other:'Другое событие'};
const roleOk=r=>['r4','r5','admin'].includes(r);
const leader=r=>['r5','admin'].includes(r);
const client=()=>window.LEX_SB;
const dateText=t=>t?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(t)):'Время ещё не назначено';
const formDate=t=>{if(!t)return '';const d=new Date(t);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const message=(node,msg)=>{const out=$('[data-message]',node);if(out)out.textContent=msg};
const parseTime=s=>{if(!s)return null;const d=new Date(s);if(Number.isNaN(d.getTime()))throw Error('Укажи корректную дату и время');return d.toISOString()};
const numOrNull=s=>s===''?null:Number(s);
async function auth(){const {data:{user},error}=await client().auth.getUser();if(error)throw error;if(!user)return null;const {data,error:e}=await client().from('clan_accounts').select('user_id,nickname,role').eq('user_id',user.id).single();if(e)throw e;return data}
const loginHtml='<div class="panel"><h2>Войди в аккаунт</h2><p>Расписание, запись на события и журнал клана доступны участникам после входа.</p><a href="./login.html" class="btn">Войти / Регистрация</a></div>';
const rolesList='<option value="going">✅ Участвую</option><option value="maybe">🕓 В резерве</option><option value="cant">🚫 Не смогу</option>';
const optionsTypes=Object.entries(typeNames).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('');
function eventForm(e){const id=e?.id||'new',title=e?.title||'',description=e?.description||'',ty=e?.event_type||'elixir';
return '<form class="lex-form" data-event-form="'+esc(id)+'"><div class="lex-fields"><label>Название<input name="title" required minlength="3" maxlength="100" value="'+esc(title)+'"></label><label>Тип<select name="event_type">'+optionsTypes.replace('value="'+ty+'"','value="'+ty+'" selected')+'</select></label><label>Старт (время на твоём устройстве)<input name="starts_at" type="datetime-local" value="'+esc(formDate(e?.starts_at))+'"></label><label>Целевое число участников<input name="capacity" type="number" min="1" max="150" placeholder="Без ограничения" value="'+(e?.capacity||'')+'"></label></div><label>Описание / инструкция<textarea name="description" rows="2" maxlength="2000">'+esc(description)+'</textarea></label><label class="lex-inline"><input type="checkbox" name="is_published" '+(e?.is_published?'checked':'')+'> Опубликовать и открыть запись</label><p class="small muted">Без даты публикация невозможна. Целевой размер состава информационный, сверх лимита запись не блокируется.</p><button class="btn" type="submit">'+(e?'Сохранить ивент':'Создать ивент')+'</button>'+(e&&leader(window.LEX_CURRENT_ROLE)?' <button type="button" class="btn danger" data-delete-event="'+esc(id)+'">Удалить</button>':'')+'</form>'}
async function events(node){
 const me=await auth();if(!me){node.innerHTML=loginHtml;return}window.LEX_CURRENT_ROLE=me.role;
 const sb=client(),r=await sb.from('clan_events').select('*').order('starts_at',{ascending:true,nullsFirst:false});if(r.error)throw r.error;
 const eventList=r.data||[],ids=eventList.map(e=>e.id),[signups,people]=await Promise.all([
 ids.length?sb.from('clan_event_signups').select('event_id,user_id,response,comment').in('event_id',ids):Promise.resolve({data:[]}),
 sb.from('clan_accounts').select('user_id,nickname')
 ]);if(signups.error)throw signups.error;if(people.error)throw people.error;
 const names=new Map(people.data.map(a=>[a.user_id,a.nickname]));const admin=roleOk(me.role);
 node.innerHTML='<div class="lex-intro"><h2>Запись на клановые ивенты</h2><p>Доступна всем зарегистрированным игрокам. Участники, резерв и отказы видны команде. Даты публикуют R4/R5.</p></div>'+
 (admin?'<details class="lex-ops-card"><summary>＋ Создать ивент</summary>'+eventForm(null)+'</details>':'')+
 (eventList.length?eventList.map(e=>{
 const ss=(signups.data||[]).filter(s=>s.event_id===e.id),counts={going:0,maybe:0,cant:0};ss.forEach(s=>counts[s.response]++);
 const own=ss.find(s=>s.user_id===me.user_id);
 return '<article class="lex-ops-card" data-event="'+esc(e.id)+'"><div class="lex-card-heading"><div><div class="small muted">'+esc(typeNames[e.event_type]||'Событие')+' · '+(e.is_published?'Открыта запись':'Черновик, виден офицерам')+'</div><h3>'+esc(e.title)+'</h3><p>'+esc(e.description)+'</p><p class="lex-event-time">'+esc(dateText(e.starts_at))+'</p></div><div class="lex-count"><b>'+counts.going+'</b><span>участвуют'+(e.capacity?' / цель '+e.capacity:'')+'</span></div></div><div class="lex-status-row"><span>✅ Участвуют: '+counts.going+'</span><span>🕓 Резерв: '+counts.maybe+'</span><span>🚫 Не смогут: '+counts.cant+'</span></div>'+
 (ss.length?'<div class="lex-signup-list">'+ss.map(s=>'<span class="lex-person '+esc(s.response)+'" title="'+esc(s.comment)+'">'+esc(names.get(s.user_id)||'Игрок')+(s.response==='going'?' ✓':s.response==='maybe'?' · резерв':' · не сможет')+'</span>').join('')+'</div>':'<p class="small muted">Пока никто не записался</p>')+
 (e.is_published?'<div class="lex-event-signup"><label>Мой ответ<select data-signup-choice="'+esc(e.id)+'">'+rolesList.replace('value="'+(own?.response||'going')+'"','value="'+(own?.response||'going')+'" selected')+'</select></label><label>Комментарий (необязательно)<input maxlength="280" placeholder="Отряд, время или пожелания" data-signup-comment="'+esc(e.id)+'" value="'+esc(own?.comment||'')+'"></label><button class="btn" data-signup-save="'+esc(e.id)+'">'+(own?'Обновить ответ':'Записаться')+'</button>'+(own?' <button class="btn ghost" data-signup-leave="'+esc(e.id)+'">Отменить запись</button>':'')+'</div>':'<p class="small muted">Офицер ещё не назначил время. Регистрация откроется после публикации.</p>')+
 (admin?'<details class="lex-event-edit"><summary>Настроить событие</summary>'+eventForm(e)+'</details>':'')+
 '</article>'
 }).join(''):'<div class="lex-ops-card">События пока не назначены. R4/R5 могут создать первое.</div>')+
 '<p class="small" data-message role="status" aria-live="polite"></p>';
 async function action(fn){try{await fn();await events(node)}catch(e){message(node,e.message)}}
 $$('[data-event-form]',node).forEach(form=>form.onsubmit=ev=>{ev.preventDefault();action(async()=>{
 const v=Object.fromEntries(new FormData(form).entries()),id=form.dataset.eventForm;
 const row={title:String(v.title||'').trim(),event_type:v.event_type,description:String(v.description||'').trim(),starts_at:parseTime(v.starts_at),capacity:numOrNull(v.capacity),is_published:v.is_published==='on'};
 if(row.is_published&&!row.starts_at)throw Error('Для публикации сначала назначь дату и время');
 const op=id==='new'?sb.from('clan_events').insert({...row,created_by:me.user_id}):sb.from('clan_events').update(row).eq('id',id);
 const result=await op;if(result.error)throw result.error;
 })});
 $$('[data-delete-event]',node).forEach(btn=>btn.onclick=()=>action(async()=>{if(!confirm('Удалить событие вместе со всеми записями участников?'))return;const r=await sb.from('clan_events').delete().eq('id',btn.dataset.deleteEvent);if(r.error)throw r.error}));
 $$('[data-signup-save]',node).forEach(btn=>btn.onclick=()=>action(async()=>{
 const id=btn.dataset.signupSave,response=$('[data-signup-choice="'+id+'"]',node).value,comment=$('[data-signup-comment="'+id+'"]',node).value;
 const r=await sb.from('clan_event_signups').upsert({event_id:id,user_id:me.user_id,response,comment,updated_at:new Date().toISOString()},{onConflict:'event_id,user_id'});if(r.error)throw r.error;
 }));
 $$('[data-signup-leave]',node).forEach(btn=>btn.onclick=()=>action(async()=>{const r=await sb.from('clan_event_signups').delete().eq('event_id',btn.dataset.signupLeave).eq('user_id',me.user_id);if(r.error)throw r.error}));
}
async function incidents(node){
 const me=await auth();if(!me){node.innerHTML=loginHtml;return}
 const admin=roleOk(me.role),sb=client(),r=await sb.from('clan_incidents').select('*').order('updated_at',{ascending:false});
 if(r.error)throw r.error;
 node.innerHTML='<div class="lex-intro"><h2>Журнал нарушений</h2><p>Общий журнал инцидентов в игре. Отметки видны всем вошедшим участникам. Только R4/R5 и администратор могут их менять.</p></div>'+
 (admin?'<details class="lex-ops-card" open><summary>＋ Добавить нарушение</summary><form id="lexNewIncident" class="lex-form"><div class="lex-fields"><label>Игровой ник<input name="nickname" maxlength="80" required></label><label>Тег альянса (если есть)<input name="alliance_tag" maxlength="24" placeholder="LEX"></label></div><label>Что произошло<textarea name="description" maxlength="1200" rows="2" required minlength="6"></textarea></label><button class="btn" type="submit">Добавить в журнал</button></form></details>':'')+
 (r.data.length?r.data.map(i=>
 '<article class="lex-ops-card" data-incident="'+esc(i.id)+'"><div class="lex-card-heading"><div><h3>'+esc(i.nickname)+' '+(i.alliance_tag?'<span class="small muted">['+esc(i.alliance_tag)+']</span>':'')+'</h3><p>'+esc(i.description)+'</p><small class="muted">Обновлено '+esc(dateText(i.updated_at))+'</small></div></div><div class="lex-status-row"><span class="lex-incident-status '+(i.warned?'warned':'inactive')+'">● Написали</span><span class="lex-incident-status '+(i.burned?'burned':'inactive')+'">● Сожгли в игре</span><span class="lex-incident-status '+(i.apologized?'apologized':'inactive')+'">● Извинился</span></div>'+
 (admin?'<div class="lex-status-controls"><label><input type="checkbox" data-flag="warned" data-id="'+esc(i.id)+'" '+(i.warned?'checked':'')+'> Написали (жёлтый)</label><label><input type="checkbox" data-flag="burned" data-id="'+esc(i.id)+'" '+(i.burned?'checked':'')+'> Сожгли (красный)</label><label><input type="checkbox" data-flag="apologized" data-id="'+esc(i.id)+'" '+(i.apologized?'checked':'')+'> Извинился (зелёный)</label>'+(leader(me.role)?'<button class="btn danger" data-delete-incident="'+esc(i.id)+'">Удалить</button>':'')+'</div>':'')+'</article>').join(''):'<div class="lex-ops-card"><p>Записей пока нет. Это хороший знак для клана.</p></div>')+
 '<p class="small" data-message role="status" aria-live="polite"></p>';
 async function act(fn){try{await fn();await incidents(node)}catch(e){message(node,e.message)}}
 const add=$('#lexNewIncident',node);if(add)add.onsubmit=e=>{e.preventDefault();act(async()=>{
 const v=Object.fromEntries(new FormData(add).entries()),row={nickname:v.nickname.trim(),alliance_tag:v.alliance_tag.trim()||null,description:v.description.trim(),created_by:me.user_id,updated_by:me.user_id};
 if(row.description.length<6)throw Error('Коротко опиши нарушение (не менее 6 символов)');
 const r=await sb.from('clan_incidents').insert(row);if(r.error)throw r.error;
 })};
 $$('[data-flag]',node).forEach(box=>box.onchange=()=>act(async()=>{const r=await sb.from('clan_incidents').update({[box.dataset.flag]:box.checked,updated_at:new Date().toISOString()}).eq('id',box.dataset.id);if(r.error)throw r.error}));
 $$('[data-delete-incident]',node).forEach(btn=>btn.onclick=()=>act(async()=>{if(!confirm('Удалить эту запись о нарушении?'))return;const r=await sb.from('clan_incidents').delete().eq('id',btn.dataset.deleteIncident);if(r.error)throw r.error}));
}
window.LEX_OPERATIONS={async render(route){const node=document.getElementById(route==='events'?'lexEvents':'lexIncidents');if(!node)return;if(!client()){node.textContent='Библиотека Supabase недоступна. Проверь подключение к интернету.';return}try{if(route==='events')await events(node);else await incidents(node)}catch(e){if(node.isConnected)node.textContent='Ошибка загрузки: '+e.message}}};
})();