(()=>{'use strict';
const $=(q,r=document)=>r.querySelector(q),all=(q,r=document)=>Array.from(r.querySelectorAll(q));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.LEX_SB,officer=r=>['r4','r5','admin'].includes(r);
const fmt=n=>n==null?'—':new Intl.NumberFormat('ru-RU').format(n);
const date=s=>s?new Date(s).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}):'Не указано';
const inputDate=s=>{if(!s)return '';const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const iso=v=>v?new Date(v).toISOString():null;
const getMe=async()=>{const {data:{user}}=await sb().auth.getUser();if(!user)return null;const {data,error}=await sb().from('clan_accounts').select('user_id,role,nickname').eq('user_id',user.id).single();if(error)throw error;return data};
const msg=(node,t)=>{const a=$('[data-duel-message]',node);if(a)a.textContent=t};
async function show(node){
 const me=await getMe();if(!me){node.innerHTML='<div class="lex-ops-card"><h2>Дуэль альянсов</h2><p>Войди в аккаунт, чтобы увидеть свой план и отмечать задания.</p><a href="./login.html" class="btn">Войти</a></div>';return}
 const admin=officer(me.role);
 const [p,t,g,accounts]=await Promise.all([
 sb().from('duel_plans').select('*').order('created_at',{ascending:false}),
 sb().from('duel_tasks').select('*').order('created_at'),
 sb().from('duel_task_progress').select('*'),
 sb().from('clan_accounts').select('user_id,nickname')]);
 for(const r of [p,t,g,accounts])if(r.error)throw r.error;
 const users=new Map(accounts.data.map(x=>[x.user_id,x.nickname]));
 const selects='<option value="">Всем участникам</option>'+accounts.data.map(x=>'<option value="'+escape(x.user_id)+'">'+escape(x.nickname)+'</option>').join('');
 node.innerHTML='<section class="lex-ops-card"><h2>Дуэль альянсов · задания</h2><p>R4/R5 назначают планы и цели, а игроки отмечают выполнение. Отчёт виден всему клану.</p></section>'+
 (admin?'<details class="lex-ops-card"><summary>＋ Создать план Дуэли</summary><form id="lexDuelNew" class="lex-form"><label>Название<input name="title" required minlength="3" maxlength="110" placeholder="Дуэль альянсов · неделя"></label><div class="lex-fields"><label>Начало<input name="starts_at" type="datetime-local"></label><label>Окончание<input name="ends_at" type="datetime-local"></label></div><label>Инструкция<textarea name="description" maxlength="1400"></textarea></label><button class="btn">Создать план</button></form></details>':'')+
 (p.data.length?p.data.map(plan=>{const tasks=t.data.filter(x=>x.plan_id===plan.id);const progress=g.data.filter(x=>tasks.some(t=>t.id===x.task_id));const done=progress.filter(x=>x.status==='done').length;const points=progress.reduce((v,x)=>v+BigInt(x.points||0),0n);
 return '<section class="lex-ops-card" data-duel-plan="'+escape(plan.id)+'"><h3>'+escape(plan.title)+'</h3><p class="small muted">'+escape(date(plan.starts_at))+' — '+escape(date(plan.ends_at))+' · '+escape(plan.status)+'</p><p>'+escape(plan.description)+'</p><div class="lex-status-row"><span>Заданий: '+tasks.length+'</span><span>Выполнено отметок: '+done+'</span><span>Заявлено очков: '+fmt(points.toString())+'</span></div>'+
 (admin?'<div class="lex-row-actions"><select data-plan-status="'+escape(plan.id)+'"><option value="planning" '+(plan.status==='planning'?'selected':'')+'>Подготовка</option><option value="active" '+(plan.status==='active'?'selected':'')+'>Активна</option><option value="completed" '+(plan.status==='completed'?'selected':'')+'>Завершена</option></select><button class="btn ghost" data-update-plan="'+escape(plan.id)+'">Изменить статус</button></div>':'')+
 tasks.map(task=>{const own=g.data.find(x=>x.task_id===task.id&&x.user_id===me.user_id);const reports=g.data.filter(x=>x.task_id===task.id);
 return '<div class="lex-duel-task"><div><strong>'+escape(task.title)+'</strong><p class="small muted">'+escape(task.details)+'</p><small>Кому: '+escape(task.assignee_id?users.get(task.assignee_id)||'Игрок':'Всем участникам')+' · Цель: '+fmt(task.target_points)+' очков'+(task.due_at?' · До '+date(task.due_at):'')+'</small></div>'+
 reports.length?'<div class="lex-chip-list">'+reports.map(x=>'<span class="lex-person">'+escape(users.get(x.user_id)||'Игрок')+': '+(x.status==='done'?'✅':x.status==='doing'?'⏳':'▫️')+' '+fmt(x.points)+' очков</span>').join('')+'</div>':'<p class="small muted">Пока нет отчётов</p>'+
 ((!task.assignee_id||task.assignee_id===me.user_id)&&plan.status!=='completed'?'<div class="lex-row-actions"><select data-task-status="'+escape(task.id)+'"><option value="todo" '+(!own||own.status==='todo'?'selected':'')+'>Не начал</option><option value="doing" '+(own?.status==='doing'?'selected':'')+'>В процессе</option><option value="done" '+(own?.status==='done'?'selected':'')+'>Готово</option></select><input type="number" min="0" data-task-points="'+escape(task.id)+'" placeholder="Очки" value="'+(own?.points??'')+'"><input maxlength="350" data-task-note="'+escape(task.id)+'" placeholder="Комментарий" value="'+escape(own?.note||'')+'"><button class="btn" data-task-save="'+escape(task.id)+'">Отметить</button></div>':'')+
 (admin?'<button class="btn ghost" data-task-delete="'+escape(task.id)+'">Удалить задание</button>':'')+'</div>'
 }).join('')+
 (admin?'<details class="lex-duel-add"><summary>＋ Добавить задание</summary><form data-new-task="'+escape(plan.id)+'" class="lex-form"><label>Задание<input name="title" required minlength="3" maxlength="160" placeholder="Набрать очки на исследованиях"></label><div class="lex-fields"><label>Исполнитель<select name="assignee_id">'+selects+'</select></label><label>Цель по очкам<input name="target_points" type="number" min="0" placeholder="Необязательно"></label><label>Дедлайн<input name="due_at" type="datetime-local"></label></div><label>Инструкция<textarea name="details" maxlength="800"></textarea></label><button class="btn">Добавить задание</button></form></details>':'')+
 '</section>';
 }).join(''):'<div class="lex-ops-card">Пока нет активных планов. Офицеры могут создать первый.</div>')+
 '<p class="small" role="status" data-duel-message></p>';
 async function action(fn){try{await fn();await show(node)}catch(e){msg(node,e.message)}}
 const add=$('#lexDuelNew',node);if(add)add.onsubmit=e=>{e.preventDefault();action(async()=>{const data=Object.fromEntries(new FormData(add));const row={title:data.title.trim(),starts_at:iso(data.starts_at),ends_at:iso(data.ends_at),description:data.description.trim(),created_by:me.user_id};if(row.starts_at&&row.ends_at&&row.ends_at<=row.starts_at)throw Error('Окончание должно быть позже начала');const r=await sb().from('duel_plans').insert(row);if(r.error)throw r.error})};
 all('[data-update-plan]',node).forEach(btn=>btn.onclick=()=>action(async()=>{const id=btn.dataset.updatePlan,v=$('[data-plan-status="'+id+'"]',node).value;const r=await sb().from('duel_plans').update({status:v}).eq('id',id);if(r.error)throw r.error}));
 all('[data-new-task]',node).forEach(form=>form.onsubmit=e=>{e.preventDefault();action(async()=>{const data=Object.fromEntries(new FormData(form)),row={plan_id:form.dataset.newTask,title:data.title.trim(),details:data.details.trim(),assignee_id:data.assignee_id||null,target_points:data.target_points?Number(data.target_points):null,due_at:iso(data.due_at)};const r=await sb().from('duel_tasks').insert(row);if(r.error)throw r.error})});
 all('[data-task-delete]',node).forEach(btn=>btn.onclick=()=>action(async()=>{if(!confirm('Удалить задание и отчёты игроков?'))return;const r=await sb().from('duel_tasks').delete().eq('id',btn.dataset.taskDelete);if(r.error)throw r.error}));
 all('[data-task-save]',node).forEach(btn=>btn.onclick=()=>action(async()=>{const id=btn.dataset.taskSave,raw=$('[data-task-points="'+id+'"]',node).value;const row={task_id:id,user_id:me.user_id,status:$('[data-task-status="'+id+'"]',node).value,points:raw===''?null:Number(raw),note:$('[data-task-note="'+id+'"]',node).value,updated_at:new Date().toISOString()};if(row.points!=null&&(!Number.isSafeInteger(row.points)||row.points<0))throw Error('Укажи корректные очки');const r=await sb().from('duel_task_progress').upsert(row,{onConflict:'task_id,user_id'});if(r.error)throw r.error}));
}
window.LEX_DUEL={async render(){const node=document.getElementById('lexDuel');if(!node)return;if(!sb()){node.textContent='Сервис недоступен';return}try{await show(node)}catch(e){if(node.isConnected)node.textContent='Ошибка: '+e.message}}};
})();