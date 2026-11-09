(()=>{'use strict';
const KEY='lex-caravan-invite-v1-';
const INTERVAL=7*24*60*60*1000;
let checking=false,dialog=null;
const home=()=>!location.hash||location.hash==='#home';
async function check(){
 if(checking||dialog||!home()||document.hidden)return;
 const sb=window.LEX_SB;if(!sb)return;
 checking=true;
 try{
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user||!home())return;
  const key=KEY+user.id;
  let last=0;
  try{last=Number(localStorage.getItem(key)||0)}catch{}
  if(last&&Date.now()-last<INTERVAL)return;
  const {data:profile,error:profileError}=await sb.from('clan_accounts').select('user_id').eq('user_id',user.id).maybeSingle();
  if(profileError||!profile)return;
  const {data:queued,error:queueError}=await sb.from('clan_caravan_queue').select('user_id').eq('user_id',user.id).maybeSingle();
  if(queueError||queued||!home()||dialog||document.hidden)return;
  show(key);
 }catch(e){console.warn('Caravan invitation skipped',e)}
 finally{checking=false}
}
function show(key){
 if(dialog)return;
 const overlay=document.createElement('div');overlay.className='lex-caravan-backdrop lex-caravan-invite-backdrop';
 overlay.innerHTML='<section class="lex-caravan-dialog lex-caravan-invite" role="dialog" aria-modal="true" aria-labelledby="lexCaravanInviteTitle" aria-describedby="lexCaravanInviteText" tabindex="-1"><button type="button" class="lex-caravan-close" data-invite-dismiss aria-label="Закрыть">×</button><span class="lex-caravan-eyebrow">СЕРВЕР 347 · АЛЬЯНС LEX</span><div class="lex-caravan-invite-symbol" aria-hidden="true">♞</div><h2 id="lexCaravanInviteTitle">Караван собирает бойцов</h2><p id="lexCaravanInviteText">Открыта очередь на <strong>VIP</strong> и <strong>Кучера</strong>. Запишись и следи за назначениями офицеров в журнале LEX.</p><div class="lex-caravan-invite-actions"><button type="button" class="btn lex-gold-btn" data-invite-go>Записаться на караван</button><button type="button" class="btn ghost" data-invite-dismiss>Позже</button></div><small>Покажем приглашение снова не раньше чем через 7 дней, если ты ещё не записан.</small></section>';
 document.body.append(overlay);dialog=overlay;const previousFocus=document.activeElement;
 document.body.classList.add('lex-caravan-modal-open');
 try{localStorage.setItem(key,String(Date.now()))}catch{}
 const close=()=>{
  if(dialog!==overlay)return;
  dialog=null;overlay.remove();document.body.classList.remove('lex-caravan-modal-open');
  document.removeEventListener('keydown',onKey);
  if(previousFocus&&previousFocus.isConnected)previousFocus.focus();
 };
 const onKey=e=>{
  if(e.key==='Escape')close();
  if(e.key==='Tab'){
   const items=[...overlay.querySelectorAll('button:not([disabled])')];
   if(!items.length)return;
   if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus()}
   else if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus()}
  }
 };
 document.addEventListener('keydown',onKey);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 overlay.querySelectorAll('[data-invite-dismiss]').forEach(b=>b.onclick=close);
 overlay.querySelector('[data-invite-go]').onclick=()=>{close();location.hash='caravan'};
 overlay.querySelector('[data-invite-go]').focus();
}
function schedule(){
 if(!home()){if(dialog)dialog.querySelector('[data-invite-dismiss]')?.click();return}
 setTimeout(check,900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
window.addEventListener('hashchange',schedule);
window.addEventListener('lex-profile-updated',schedule);
})();