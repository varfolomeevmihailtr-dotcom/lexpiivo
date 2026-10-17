(()=>{'use strict';
const key='sb_publishable_bYnfQgWXe_6YeqU_v8CktQ_mY09szxO',url='https://mcmzwkomuwzjkvggicyf.supabase.co';
if(!window.supabase){window.LEX_CLOUD={status:'Библиотека Supabase не загрузилась'};return}
const sb=window.LEX_SB=window.supabase.createClient(url,key);
const api={userId:null,status:'Подключение…',ready:false,onLoad:null,onStatus:null};
let generation=0,dirty=false,busy=false,timer=null,snapshot=null;
const report=s=>{api.status=s;api.onStatus?.(s)};
function queueSave(state){if(!api.ready||!api.userId)return;snapshot=JSON.parse(JSON.stringify(state));dirty=true;clearTimeout(timer);timer=setTimeout(flush,900)}
async function flush(){if(busy||!dirty||!api.ready||!api.userId)return;busy=true;const uid=api.userId,version=generation;try{do{dirty=false;const copy=snapshot;report('Сохраняем прогресс…');const {error}=await sb.from('player_profiles').upsert({user_id:uid,game_state:copy,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;if(version!==generation)break}while(dirty);if(version===generation)report('Прогресс синхронизирован')}catch(e){if(version===generation){dirty=true;report('Ошибка синхронизации: '+e.message)}}finally{busy=false}}
api.queueSave=queueSave;api.flush=async()=>{clearTimeout(timer);await flush();return api.status};
async function load(){const g=++generation;api.ready=false;api.userId=null;dirty=false;clearTimeout(timer);
 const {data:{user},error}=await sb.auth.getUser();if(g!==generation)return;
 if(error){report('Не удалось проверить вход: '+error.message);return}
 if(!user){api.ready=true;report('Гостевой режим · локальное сохранение');api.lastLoad={kind:'guest'};api.onLoad?.(api.lastLoad);return}
 api.userId=user.id;
 report('Загружаем облачный профиль…');
 const {data,error:fetchError}=await sb.from('player_profiles').select('game_state').eq('user_id',user.id).maybeSingle();
 if(g!==generation)return;
 if(fetchError){report('Сеть недоступна: локальное сохранение');api.lastLoad={kind:'offline',userId:user.id};api.onLoad?.(api.lastLoad);return}
 api.ready=true;api.lastLoad={kind:data?.game_state&&Object.keys(data.game_state).length?'cloud':'new',state:data?.game_state,userId:user.id};api.onLoad?.(api.lastLoad);report(data?'Прогресс загружен из облака':'Новый облачный профиль');
}
api.reload=load;window.LEX_CLOUD=api;
sb.auth.onAuthStateChange((event)=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(load,0)});
load();
})();