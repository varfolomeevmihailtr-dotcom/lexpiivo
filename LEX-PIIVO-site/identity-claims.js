(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$all=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase().trim();
const sb=()=>window.LEX_SB;
const roles=['r4','r5','admin'];
async function show(node){
 const {data:{user}}=await sb().auth.getUser();if(!user){node.innerHTML='<div class="lex-ops-card"><h2>Игровой ник</h2><p>Войди в аккаунт, чтобы подтвердить свой игровой ник.</p><a class="btn" href="./login.html">Войти</a></div>';return}
 const [me,roster,claims,accounts]=await Promise.all([
 sb().from('clan_accounts').select('nickname,role,user_id').eq('user_id',user.id).single(),
 sb().from('game_roster').select('game_player_id,nickname,power,rank').eq('is_current',true).not('game_player_id','is',null).order('nickname'),
 sb().from('game_identity_claims').select('user_id,game_player_id,game_nickname,status,created_at,reviewed_at').order('created_at',{ascending:false}),
 sb().from('clan_accounts').select('user_id,nickname')]);
 for(const r of [me,roster,claims,accounts])if(r.error)throw r.error;
 const officer=roles.includes(me.data.role),own=claims.data.find(c=>c.user_id===user.id),map=new Map(accounts.data.map(x=>[x.user_id,x.nickname])),pending=claims.data.filter(c=>c.status==='pending');
 node.innerHTML='<section class="lex-ops-card"><h2>Подтверждение игрового ника</h2><p>Выбери себя в актуальном составе [LEX] сервера 347. Чтобы никто не мог занять чужой ник, привязка начинает действовать только после проверки R4/R5.</p>'+
 (own?'<p>Твой запрос: <strong>'+esc(own.game_nickname)+'</strong> · '+(own.status==='approved'?'<span class="lex-good">✅ подтверждён офицером</span>':own.status==='pending'?'<span class="lex-warn">⏳ ожидает проверки</span>':'<span class="lex-warn">Отклонён · можно подать новый запрос</span>')+'</p>':'<p>Игровой ID ещё не привязан к твоему аккаунту.</p>')+
 (own?.status!=='approved'?'<label>Найди свой ник (корейские/японские символы поддерживаются)<input id="lexIdentitySearch" type="search" placeholder="Поиск по 99 игрокам…" autocomplete="off"></label><div id="lexIdentityResults" class="lex-identity-results"></div><p class="small muted" id="lexIdentityChosen">Игрок не выбран</p><button id="lexIdentitySubmit" class="btn" disabled>Отправить R4/R5 на проверку</button>':'')+
 '</section>'+
 (officer?'<section class="lex-ops-card"><h3>Заявки на подтверждение ('+pending.length+')</h3>'+(pending.length?pending.map(c=>'<div class="lex-claim-row"><div><strong>'+esc(c.game_nickname)+'</strong> · '+esc(map.get(c.user_id)||'Аккаунт')+'<small class="muted"> · '+new Date(c.created_at).toLocaleDateString('ru-RU')+'</small></div><div class="lex-row-actions"><button class="btn" data-approve="'+esc(c.user_id)+'">Подтвердить</button><button class="btn ghost" data-reject="'+esc(c.user_id)+'">Отклонить</button></div></div>').join(''):'<p class="muted">Ожидающих заявок нет.</p>')+'</section>':'')+
 '<p id="lexIdentityStatus" role="status"></p>';
 const status=t=>{$('#lexIdentityStatus',node).textContent=t};
 if(own?.status!=='approved'){
  let selected=null;const search=$('#lexIdentitySearch',node),results=$('#lexIdentityResults',node),choose=$('#lexIdentitySubmit',node);
  function repaint(){
   const q=normalize(search.value);results.textContent='';
   roster.data.filter(m=>normalize(m.nickname).includes(q)).slice(0,25).forEach(m=>{
    const btn=document.createElement('button');btn.type='button';btn.className='lex-identity-result';
    const name=document.createElement('span');name.textContent=m.nickname;
    const info=document.createElement('small');info.textContent=(m.rank||'Игрок')+' · БМ '+new Intl.NumberFormat('ru-RU').format(m.power||0);
    btn.append(name,info);btn.onclick=()=>{selected=m;search.value=m.nickname;results.textContent='';choose.disabled=false;$('#lexIdentityChosen',node).textContent='Выбран '+m.nickname+' · ID '+m.game_player_id;};
    results.append(btn)
   });
  }
  search.oninput=()=>{selected=null;choose.disabled=true;repaint()};repaint();
  choose.onclick=async()=>{if(!selected)return;choose.disabled=true;try{
   if(own&&own.status==='rejected'){const del=await sb().from('game_identity_claims').delete().eq('user_id',user.id);if(del.error)throw del.error}
   const {error}=await sb().from('game_identity_claims').insert({user_id:user.id,game_player_id:selected.game_player_id,game_nickname:selected.nickname,status:'pending'});
   if(error)throw error;await show(node);
  }catch(e){status('Не удалось отправить: '+e.message);choose.disabled=false}};
 }
 $all('[data-approve]',node).forEach(btn=>btn.onclick=async()=>{if(!confirm('Ты проверил, что аккаунт действительно принадлежит этому игроку?'))return;const {error}=await sb().rpc('review_game_identity',{target_user:btn.dataset.approve,new_status:'approved'});if(error)status(error.message);else await show(node)});
 $all('[data-reject]',node).forEach(btn=>btn.onclick=async()=>{const {error}=await sb().rpc('review_game_identity',{target_user:btn.dataset.reject,new_status:'rejected'});if(error)status(error.message);else await show(node)});
}
window.LEX_IDENTITY={async render(){const node=document.getElementById('lexIdentity');if(!node)return;try{await show(node)}catch(e){if(node.isConnected)node.textContent='Ошибка: '+e.message}}};
})();