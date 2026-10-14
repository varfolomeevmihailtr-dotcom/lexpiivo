(()=>{'use strict';
const KEY='lexpiivo-mascot-disabled-v1';
const lines=[
['arthur','Артур','Щит держу. А ты ускорения к нужному дню придержи.'],
['marlena','Марлена','Если всё потратить сегодня, завтра побеждать будем харизмой.'],
['harper','Харпер','Гениальный план: сначала проверить состав, потом нажимать «Атаковать».'],
['bella','Белла','Звёзды не растут от долгого взгляда на осколки. Проверено.'],
['zoya','Зоя','Враг ждёт хаоса. Мы принесём таблицу прокачки.'],
['arthur','Артур','Командир, калькулятор не кусается. А вот неправильная прокачка — да.'],
['marlena','Марлена','Сегодня фармим спокойно. Паника — после отчёта о бое.'],
['harper','Харпер','На сервере 347 случайностей нет. Кроме моих критов.']
];
let disabled=false;try{disabled=localStorage.getItem(KEY)==='1'}catch{}
let node,timer,shown=0,last=-1,visibilityTimer;
function make(){
 if(node)return;
 node=document.createElement('section');node.className='lex-companion';node.setAttribute('aria-label','Шутки героев LEX');
 node.innerHTML='<button class="lex-companion-toggle" type="button" title="Шутки героев" aria-label="Показать или скрыть шутки героев">✦</button><div class="lex-companion-bubble" role="status" aria-live="off"><button class="lex-companion-close" type="button" aria-label="Скрыть подсказку">×</button><img class="lex-companion-art" alt="" loading="lazy"><div class="lex-companion-copy"><span class="lex-companion-name"></span><p class="lex-companion-quote"></p></div></div>';
 document.body.appendChild(node);
 node.querySelector('.lex-companion-toggle').addEventListener('click',()=>{const open=node.classList.contains('is-visible');if(open){hide();disabled=true;}else{disabled=false;show();}try{localStorage.setItem(KEY,disabled?'1':'0')}catch{}});
 node.querySelector('.lex-companion-close').addEventListener('click',()=>{hide();disabled=true;try{localStorage.setItem(KEY,'1')}catch{}});
 if(disabled)node.classList.add('is-muted');
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide()});
}
function hide(){if(!node)return;node.classList.remove('is-visible');clearTimeout(visibilityTimer)}
function show(){
 if(document.hidden||disabled||!node)return;
 let index=Math.floor(Math.random()*lines.length);if(index===last)index=(index+1)%lines.length;last=index;
 const [id,name,quote]=lines[index];
 const h=window.PLAGUE_DATA?.heroes?.find(h=>h.id===id);
 const art=node.querySelector('.lex-companion-art');
 if(h?.imagePath){art.src=h.imagePath;art.hidden=false;art.onerror=()=>{art.hidden=true}}else art.hidden=true;
 node.querySelector('.lex-companion-name').textContent=name+' · штаб 347';
 node.querySelector('.lex-companion-quote').textContent=quote;
 node.classList.remove('is-muted');node.classList.add('is-visible');shown++;
 clearTimeout(visibilityTimer);visibilityTimer=setTimeout(hide,6800);
}
function start(){
 make();if(!disabled)setTimeout(show,10000);
 timer=setInterval(()=>{if(!disabled&&shown<12&&!node.classList.contains('is-visible'))show()},56000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();