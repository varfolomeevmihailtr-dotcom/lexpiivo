(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const officer=r=>['r4','r5','admin'].includes(r);
const label={vip:'VIP',coachman:'Кучер'};
const fmt=s=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const localDateTime=s=>{const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const requests=new WeakMap();
async function load(node){
 if(!node||!node.isConnected)return;
 const requestId=(requests.get(node)||0)+1;
 requests.set(node,requestId);
 const current=()=>node.isConnected&&requests.get(node)===requestId;
 try{
  const sb=window.LEX_SB;if(!sb)throw Error('Не удалось подключиться к базе.');
  const {data:{user},error:authError}=await Promise.race([sb.auth.getUser(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Не удалось получить сессию. Обнови страницу и повтори.')),9000))]);
  if(authError)throw authError;
  if(!user){node.innerHTML='<div class="lex-ops-card"><h2>Вход в штаб</h2><p>Для записи на караван войди в аккаунт LEX.</p><a href="./login.html" class="btn">Войти / Регистрация</a></div>';return}
  const timed=(promise,ms,description)=>Promise.race([
   Promise.resolve(promise),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('Превышено время ожидания: '+description+'. Нажми «Повторить».')),ms))
  ]);
  const [account,queue,people,history]=await timed(Promise.all([
   sb.from('clan_accounts').select('user_id,nickname,role').eq('user_id',user.id).single(),
   sb.from('clan_caravan_queue').select('*').order('created_at',{ascending:true}),
   sb.from('clan_accounts').select('user_id,nickname'),
   sb.from('clan_caravan_history').select('*').order('selected_at',{ascending:false}).limit(2000)
  ]),10000,'данные каравана');
  for(const r of [account,queue,people,history])if(r.error)throw r.error;
  // Optional Telegram services must never prevent the queue from loading.
  const [telegram,departure]=await Promise.all([
   timed(sb.rpc('telegram_link_status'),3500,'Telegram').catch(error=>({data:false,error})),
   timed(sb.from('clan_caravan_departure').select('departure_at').eq('id',1).maybeSingle(),3500,'время отправления').catch(error=>({data:null,error}))
  ]);
  if(telegram.error)console.warn('Telegram status unavailable:',telegram.error.message);
  if(departure.error)console.warn('Departure unavailable:',departure.error.message);
  if(!current())return;
  const me=account.data,rows=queue.data||[],my=rows.find(r=>r.user_id===me.user_id);
  const names=new Map((people.data||[]).map(r=>[r.user_id,r.nickname]));
  const past=history.data||[],totals=new Map();
  for(const entry of past){const t=totals.get(entry.user_id)||{vip:0,coachman:0};t[entry.request_type]++;totals.set(entry.user_id,t)}
  const tabs=['coachman','vip'];
  node.innerHTML='<section class="lex-caravan-hero"><span class="lex-caravan-eyebrow">АЛЬЯНС LEX · СЕРВЕР 347</span><h2>Караван ждёт своих героев</h2><p>Запишись в очередь на VIP-место или роль кучера. R4/R5 назначают участников в игре и отмечают выбранных здесь.</p><button type="button" class="btn lex-gold-btn" id="lexOpenCaravan">'+(my?'Изменить мою запись':'Записаться на караван')+'</button><span class="lex-caravan-note">Запись на сайте не назначает роль автоматически в игре.</span></section>'+
  '<div class="lex-caravan-grid">'+tabs.map(type=>{
    const rr=rows.filter(r=>r.request_type===type),pending=rr.filter(r=>r.status==='pending');
    return '<section class="lex-caravan-panel"><div class="lex-caravan-header"><div><span class="lex-caravan-eyebrow">'+(type==='vip'?'ОСОБЫЙ ПАССАЖИР':'ГЛАВНАЯ ПОВОЗКА')+'</span><h3>'+(type==='vip'?'✦ VIP':'♞ Кучер')+'</h3></div><strong>'+pending.length+' в очереди</strong></div>'+
    (rr.length?'<div class="lex-caravan-list">'+rr.map((r)=>{
      const rank=pending.findIndex(t=>t.user_id===r.user_id)+1;
      const chosen=r.status==='selected';
      return '<div class="lex-caravan-person '+(chosen?'is-selected':'')+'"><span class="lex-caravan-rank">'+(chosen?'✓':'#'+rank)+'</span><div class="lex-caravan-person-name"><strong>'+esc(names.get(r.user_id)||'Игрок')+'</strong><small>'+(chosen?'Выбран · '+fmt(r.selected_at):'В очереди с '+fmt(r.created_at))+'</small><small>За всё время: VIP '+(totals.get(r.user_id)?.vip||0)+' · Кучер '+(totals.get(r.user_id)?.coachman||0)+'</small></div><span class="lex-caravan-status '+(chosen?'chosen':'')+'">'+(chosen?'Взяли':'Ожидает')+'</span>'+(officer(me.role)?'<button type="button" class="lex-caravan-mark" data-caravan-mark="'+esc(r.user_id)+'" data-next="'+(chosen?'pending':'selected')+'">'+(chosen?'Вернуть':'Взяли ✓')+'</button>':'')+'</div>'
    }).join('')+'</div>':'<p class="lex-caravan-empty">Пока нет заявок. Можно стать первым!</p>')+'</section>'
  }).join('')+'</div>'+
  (my?'<p class="lex-caravan-own">Твоя запись: <strong>'+label[my.request_type]+'</strong> · '+(my.status==='selected'?'выбран офицером':'ожидаешь в очереди')+'.</p>':'')+
  '<section class="lex-caravan-history"><div class="lex-caravan-history-title"><h3>История караванов</h3><span>'+past.length+' назначений</span></div>'+
  (past.length?'<div class="lex-caravan-history-list">'+past.map(h=>'<article class="lex-caravan-history-entry"><div><strong>'+esc(names.get(h.user_id)||'Игрок')+'</strong><small>'+esc(label[h.request_type]||h.request_type)+' · '+fmt(h.selected_at)+'</small></div><p>'+(h.note?esc(h.note):'Без примечания')+'</p>'+(officer(me.role)?'<button class="lex-caravan-mark" type="button" data-history-note="'+h.id+'">✎ Примечание</button>':'')+'</article>').join('')+'</div>':'<p class="lex-caravan-empty">История пока пустая. Первое подтверждение офицера появится здесь.</p>')+'</section>'+
  '<section class="lex-caravan-history"><div class="lex-caravan-history-title"><h3>🔔 Личные уведомления Telegram</h3></div><p>Бот <a href="https://t.me/LEXCaravan347Bot" target="_blank" rel="noopener noreferrer">@LEXCaravan347Bot</a> напишет, когда R4 подтвердит назначение, и напомнит за час до отправления.</p><p id="lexTelegramLinkedStatus">'+(telegram.data?'✅ Telegram привязан к аккаунту':'Telegram пока не привязан')+'</p><div class="button-row">'+(telegram.data?'<button type="button" class="btn ghost" id="lexTelegramUnlink">Отключить Telegram</button>':'<button type="button" class="btn lex-gold-btn" id="lexTelegramLink">Привязать Telegram</button> <button type="button" class="btn ghost" id="lexTelegramRefresh">Проверить привязку</button>')+'</div></section>'+
  '<section class="lex-caravan-history"><div class="lex-caravan-history-title"><h3>⏰ Время отправления</h3></div><p id="lexCaravanDepartureText">'+(departure.data?.departure_at?'Ближайшее отправление: '+fmt(departure.data.departure_at):'Время отправления пока не назначено')+'</p>'+(officer(me.role)?'<form id="lexCaravanDepartureForm" class="lex-form"><label class="lex-caravan-note-label">Дата и время (на твоём устройстве)<input type="datetime-local" name="departure" value="'+(departure.data?.departure_at?localDateTime(departure.data.departure_at):'')+'"></label><button type="submit" class="btn">Сохранить время</button><button type="button" id="lexCaravanClearDeparture" class="btn ghost">Сбросить</button></form>':'')+'</section>'+
  '<p id="lexCaravanMessage" role="status" aria-live="polite"></p>';
  $('#lexOpenCaravan',node).onclick=()=>popup(node,me,my);
  const linkButton=$('#lexTelegramLink',node);
  if(linkButton)linkButton.onclick=async()=>{
   linkButton.disabled=true;
   try{
    const r=await sb.rpc('telegram_link_start');
    if(r.error)throw r.error;
    const href='https://t.me/LEXCaravan347Bot?start='+encodeURIComponent(r.data);
    const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove();
    const status=$('#lexTelegramLinkedStatus',node);if(status)status.textContent='В Telegram нажми Start, затем вернись и нажми «Проверить привязку». Ссылка действует 15 минут.';
   }catch(e){$('#lexCaravanMessage',node).textContent=e.message}
   finally{linkButton.disabled=false}
  };
  const refresh=$('#lexTelegramRefresh',node);if(refresh)refresh.onclick=()=>load(node);
  const unlink=$('#lexTelegramUnlink',node);if(unlink)unlink.onclick=async()=>{
   if(!confirm('Отключить личные Telegram-уведомления?'))return;
   const r=await sb.rpc('telegram_unlink');if(r.error)$('#lexCaravanMessage',node).textContent=r.error.message;else load(node);
  };
  const departureForm=$('#lexCaravanDepartureForm',node);
  if(departureForm)departureForm.onsubmit=async e=>{
   e.preventDefault();const raw=departureForm.elements.departure.value;
   if(!raw){$('#lexCaravanMessage',node).textContent='Укажи время отправления';return}
   const dt=new Date(raw);if(Number.isNaN(dt.getTime()))return;
   const r=await sb.rpc('set_caravan_departure',{p_departure:dt.toISOString()});
   if(r.error)$('#lexCaravanMessage',node).textContent=r.error.message;else load(node);
  };
  const clear=$('#lexCaravanClearDeparture',node);if(clear)clear.onclick=async()=>{
   if(!confirm('Сбросить время отправления?'))return;
   const r=await sb.rpc('set_caravan_departure',{p_departure:null});if(r.error)$('#lexCaravanMessage',node).textContent=r.error.message;else load(node);
  };

  $$('[data-caravan-mark]',node).forEach(b=>b.onclick=()=>{
    const chosen=b.dataset.next==='selected',uid=b.dataset.caravanMark;
    if(chosen)officerPopup(node,uid,names.get(uid)||'Игрок');
    else if(confirm('Вернуть игрока в очередь? Его прошлые назначения останутся в истории.'))changeSelection(node,uid,false,'');
  });
  $$('[data-history-note]',node).forEach(b=>b.onclick=()=>{
    const entry=past.find(h=>String(h.id)===b.dataset.historyNote);
    if(entry)notePopup(node,entry,names.get(entry.user_id)||'Игрок');
  });
 }catch(e){if(!current())return;node.innerHTML='<section class="lex-ops-card"><h2>Не удалось открыть очередь</h2><p>'+esc(e.message)+'</p><button class="btn" id="lexCaravanRetry">Повторить</button></section>';$('#lexCaravanRetry',node).onclick=()=>load(node)}
}
async function changeSelection(node,uid,selected,note){
 const feedback=$('#lexCaravanMessage',node);
 try{
  const r=await window.LEX_SB.rpc('set_caravan_selection',{p_user_id:uid,p_selected:selected,p_note:note});
  if(r.error)throw r.error;
  await load(node);
  return true;
 }catch(e){if(feedback)feedback.textContent=e.message;return false}
}
function modalFrame(title,description,body){
 const overlay=document.createElement('div');overlay.className='lex-caravan-backdrop';
 overlay.innerHTML='<div class="lex-caravan-dialog" role="dialog" aria-modal="true" aria-labelledby="lexExtraModalTitle"><button class="lex-caravan-close" aria-label="Закрыть" type="button">×</button><span class="lex-caravan-eyebrow">ЖУРНАЛ КАРАВАНА</span><h2 id="lexExtraModalTitle">'+esc(title)+'</h2><p>'+esc(description)+'</p>'+body+'</div>';
 document.body.append(overlay);document.body.classList.add('lex-caravan-modal-open');
 const key=e=>{if(e.key==='Escape')close()};
 const close=()=>{overlay.remove();document.body.classList.remove('lex-caravan-modal-open');document.removeEventListener('keydown',key)};
 document.addEventListener('keydown',key);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 $('.lex-caravan-close',overlay).onclick=close;
 return {overlay,close};
}
function officerPopup(node,uid,nickname){
 const {overlay,close}=modalFrame('Подтвердить назначение','Игрок: '+nickname+'. Добавь причину или комментарий для истории.', '<form id="lexOfficerForm"><label class="lex-caravan-note-label">За что выбрали / примечание<textarea name="note" maxlength="500" rows="4" placeholder="Например: давно не был, помог альянсу, очередь по графику…"></textarea></label><button class="btn lex-gold-btn" type="submit">✓ Отметить «Взяли»</button><p class="lex-caravan-form-feedback" role="status"></p></form>');
 $('#lexOfficerForm',overlay).onsubmit=async e=>{
  e.preventDefault();const btn=$('button[type=submit]',overlay);btn.disabled=true;
  const note=$('textarea[name=note]',overlay).value;
  const result=await window.LEX_SB.rpc('set_caravan_selection',{p_user_id:uid,p_selected:true,p_note:note});
  if(result.error){$('.lex-caravan-form-feedback',overlay).textContent=result.error.message;btn.disabled=false;return}
  close();await load(node);
 };
}
function notePopup(node,entry,nickname){
 const {overlay,close}=modalFrame('Примечание к назначению',nickname+' · '+(label[entry.request_type]||entry.request_type)+' · '+fmt(entry.selected_at),'<form id="lexEditNoteForm"><label class="lex-caravan-note-label">За что выбрали / комментарий<textarea name="note" maxlength="500" rows="4">'+esc(entry.note)+'</textarea></label><button class="btn lex-gold-btn" type="submit">Сохранить примечание</button><p class="lex-caravan-form-feedback" role="status"></p></form>');
 $('#lexEditNoteForm',overlay).onsubmit=async e=>{
  e.preventDefault();const btn=$('button[type=submit]',overlay);btn.disabled=true;
  const r=await window.LEX_SB.rpc('update_caravan_history_note',{p_history_id:entry.id,p_note:$('textarea[name=note]',overlay).value});
  if(r.error){$('.lex-caravan-form-feedback',overlay).textContent=r.error.message;btn.disabled=false;return}
  close();await load(node);
 };
}
function popup(node,me,my){
 const overlay=document.createElement('div');overlay.className='lex-caravan-backdrop';
 overlay.innerHTML='<div class="lex-caravan-dialog" role="dialog" aria-modal="true" aria-labelledby="lexCaravanTitle"><button type="button" class="lex-caravan-close" aria-label="Закрыть">×</button><span class="lex-caravan-eyebrow">ЗАПИСЬ НА КАРАВАН</span><h2 id="lexCaravanTitle">Твоё место в истории LEX</h2><p>Выбери одну очередь. Ник берём из твоего профиля, чтобы R4 знал, кого назначать.</p><form id="lexCaravanForm"><label>Игровой ник<input disabled value="'+esc(me.nickname)+'"></label><div class="lex-caravan-choice"><label><input type="radio" name="kind" value="vip" '+(!my||my.request_type==='vip'?'checked':'')+'><span>✦ VIP <small>Особое приглашение</small></span></label><label><input type="radio" name="kind" value="coachman" '+(my?.request_type==='coachman'?'checked':'')+'><span>♞ Кучер <small>Управляет караваном</small></span></label></div><button class="btn lex-gold-btn" type="submit">'+(my?'Обновить очередь':'Встать в очередь')+'</button>'+(my&&my.status==='pending'?'<button type="button" id="lexCaravanLeave" class="btn ghost">Отменить запись</button>':'')+'<p id="lexCaravanFormError" role="status"></p></form></div>';
 document.body.append(overlay);document.body.classList.add('lex-caravan-modal-open');
 const close=()=>{overlay.remove();document.body.classList.remove('lex-caravan-modal-open');document.removeEventListener('keydown',key)};
 const key=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',key);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 $('.lex-caravan-close',overlay).onclick=close;
 $('#lexCaravanForm',overlay).onsubmit=async e=>{
  e.preventDefault();const button=$('button[type=submit]',overlay);button.disabled=true;
  const kind=$('input[name=kind]:checked',overlay).value;
  if(my?.status==='selected'){ $('#lexCaravanFormError',overlay).textContent='Ты уже выбран. Изменения может внести офицер.';button.disabled=false;return}
  const sb=window.LEX_SB;
  const result=await sb.rpc('set_caravan_request',{p_request_type:kind});
  if(result.error){$('#lexCaravanFormError',overlay).textContent=result.error.message;button.disabled=false;return}
  close();await load(node);
 };
 const leave=$('#lexCaravanLeave',overlay);if(leave)leave.onclick=async()=>{
  leave.disabled=true;const r=await window.LEX_SB.from('clan_caravan_queue').delete().eq('user_id',me.user_id);
  if(r.error){$('#lexCaravanFormError',overlay).textContent=r.error.message;leave.disabled=false}
  else{close();await load(node)}
 };
}
window.LEX_CARAVAN={render:()=>{const node=document.getElementById('lexCaravan');if(node)load(node)}};
})();