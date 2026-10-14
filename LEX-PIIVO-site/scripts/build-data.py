#!/usr/bin/env python3
"""Bundle public game facts into portable scripts below InfinityFree's 1 MB JS limit."""
import json
from pathlib import Path

root=Path(__file__).resolve().parent.parent
out=root/'dist' if (root/'dist').is_dir() else root
def read(name): return json.loads((out/'data'/name).read_text())
def js(value): return json.dumps(value,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
heroes=read('heroes.json')
servers=read('servers.json')
progression=read('progression.json')
events=read('events.json')
research_guides=read('guides-research.json')
for g in research_guides:
 g['image']={'kvk-shield-plan':'assets/guides/shields.svg','troop-preservation':'assets/guides/shields.svg','alliance-duel-saving':'assets/guides/alliance-week.svg','elixir-objectives':'assets/guides/elixir.svg','hero-gear-priorities':'assets/guides/gear.svg'}.get(g['id'],'assets/guides/pve.svg')
 g['imageCaption']='Схема журнала [LEX]PIIVO' if g['image'].endswith('.svg') else 'Карта, предоставленная кланом'
 g['sources']=[{'title':s.get('title',s.get('url','Источник')),'url':s['url']} for s in g['sources']]
base_guides=[
 {'id':'community-rules','title':'Правила сообщества [LEX]PIIVO','category':'Правила клана','summary':'Ник в группе, уважение и порядок общения','image':'assets/clan/community-rules.jpg','body':'<ol><li>Перед началом взаимодействия напиши свой игровой ник в теме <b>#игровые ники участников</b>.</li><li>Ознакомься с правилами.</li><li>Соблюдай вежливость и уважай других участников.</li><li>За нарушения возможны предупреждение или блокировка доступа к группе.</li></ol>','source':None},
 {'id':'server-rules','title':'NAP и правила сервера 347','category':'Правила клана','summary':'Свои повозки, сборы и порядок решения конфликтов','image':'assets/clan/server-rules.jpg','body':'<p>Не грабим повозки и сундуки на своём сервере. Не атакуем сборы и места сбора ресурсов. Сначала решаем ошибки через диалог с игроком и главой его гильдии. Если ошиблись сами — извиняемся.</p><p>Ответные действия согласуем с руководством. Наказывать весь альянс за отдельного нарушителя нельзя. Повторные нарушения, преследование и оскорбления передаём лидерам / NAP.</p><p>Это присланная памятка нашего сервера. Новые решения действующего руководства NAP 347 имеют приоритет.</p>','source':None},
 {'id':'elixir-assignments','title':'Эликсир: назначения до начала битвы','category':'Битва за эликсир','summary':'Кто координирует и кто идёт к каждому зданию','image':'assets/clan/elixir-map.jpg','body':'<p>Лидеры заранее выбирают координатора — в памятке предложен <b>@Net_Spider11</b> или другой назначенный участник. Координатор распределяет команду по зданиям и публикует назначения в беседе.</p><p>Указываем игроков для Врат миграции, каждой лечебной палатки и каждой алхимической мастерской. После разведки или в бою план может меняться, но стартовое направление каждый знает заранее.</p><p>Если участников меньше 20, снимаем по 1–2 человека с менее важных объектов и концентрируемся на зданиях с основными преимуществами и очками. Координатора назначаем до гонки, а не во время неё.</p><p><a class="text-link" href="#elixir">Открыть карту и составить назначения →</a></p>','source':None},
 {'id':'ban-appeal','title':'Блокировка аккаунта: обращение в поддержку','category':'Поддержка','summary':'Какие данные приложить и как описать ситуацию','image':'assets/clan/ban-appeal-guide.jpg','body':'<p>Если считаешь блокировку ошибочной, обратись через поддержку в самой игре. Укажи сервер, ник, ID аккаунта, время блокировки, текст ошибки и приложи скриншот. Объясни контекст спорного сообщения спокойно и конкретно.</p><p>Присланная памятка содержит утверждения о словах-триггерах и сроках блокировок. Мы не подтвердили их как официальную политику: конкретную причину и решение сообщает поддержка. Не обещаем автоматический разбан.</p><p>В следующей памятке сохранён исходный шаблон. При обращении замени все поля своими данными и опиши реальную ситуацию.</p>','source':None},
 {'id':'appeal-template','title':'Шаблон апелляции: русский и английский','category':'Поддержка','summary':'Исходная памятка клана и нейтральная формулировка обращения','image':'assets/clan/ban-appeal-template.jpg','body':'<p><b>Нейтральный английский вариант:</b></p><blockquote>Dear Support Team,<br>I would like to request a review of the restriction on my Last Asylum: Plague account. My server is [server], nickname [nickname], and account ID [ID]. The restriction appeared on [date and time] with the message [message].<br>The context was [explain what happened]. I have attached screenshots. Please let me know the reason for the restriction and whether access can be restored.<br>Thank you,<br>[nickname]</blockquote><p>Отправляй через официальный канал поддержки из игры. Пароль и коды входа в текст не добавляй.</p>','source':None},
 {'id':'claire-ur','title':'Клэр: SSR → UR и цена дальнейших звёзд','category':'Герои','summary':'Открывается на 8-й день эры, расходует свои SSR-осколки','body':'<p>Повышение редкости Клэр появляется на 8-й день Эры возрождения. После перехода она использует осколки Клэр SSR, а стоимость каждого шага её новой лестницы удваивается.</p><p>Путь 6★ → 8★ стоит 600 осколков, до 9★ — 1000, до 10★ — 1600. Эти числа не включают условия самого события повышения. Проверяй доступность перехода в игре.</p><p>Для расчёта твоего остатка используй вкладку «Клэр UR» в калькуляторах.</p>','image':'assets/heroes/claire-ur.webp','source':'https://thelaphub.com/guides/claire-rarity-upgrade'},
 {'id':'daskal-offer','title':'Даскал: пропуск, дневная акция и осколки','category':'Герои','summary':'Дебют и последующая продажа идут по разным расписаниям','body':'<p>Календарь сообщества указывает первый Пропуск Даскала на день 29, а его появление в дневной акции — на день 57. Для сервера 347 ориентир дневного предложения — 27 октября 2026.</p><p>Подтверждённого цикла повторения первого пропуска мы не нашли. Сравнивай цену полезного осколка в реальных предложениях: количество наград, которые успеешь забрать, важнее рекламного процента выгоды.</p>','image':'assets/heroes/daskal.webp','source':'https://thelaphub.com/codex/heroes/daskal'},
 {'id':'faction-bonuses','title':'Фракции: от +5% до +20% всему отряду','category':'Герои','summary':'Пятёрка одного типа и сочетание 3+2 дают разные бонусы','body':'<p>Три героя одной фракции дают +5% атаки, здоровья и защиты. Сочетание 3+2 — +10%, четыре одинаковых — +15%, пять — +20%.</p><p>Сам бонус не делает состав автоматически лучшим: роль, звёзды и конкретные навыки важны. Пробуй сочетания в сборщике и сравнивай боевые отчёты при близком развитии героев.</p>','source':'https://wiki-last-asylum.com/en/wiki/hero-factions','image':'assets/guides/pve.svg'}
]
codes=[{'code':c,'status':'worked','note':'Сработал в твоих прошлых проверках, актуальность на сегодня не подтверждена'} for c in ['LA1OW9F7X','LADCEX1223','LA25W8CM','twlap888','twlap666','LAOKT26','LACAFE26','LAMAU26']]+[{'code':'LAHD26','status':'unknown','note':'Найден пользователем, результат не подтверждён'}]+[{'code':c,'status':'failed','note':'Не сработал в прошлой проверке'} for c in ['LAKR15K9A','LAKR10K6L','LAKR12K7O','WLTLAP','61HW4LA','LAAS777','LAPKOR777','LA15WPN4D']]
base={'heroes':heroes,'servers':servers,'events':events,'codes':codes,'guides':base_guides+research_guides}
bundles={
 'data.js':'window.PLAGUE_DATA='+js(base)+';\n',
 'data-progression.js':'window.PLAGUE_DATA.progression='+js({k:v for k,v in progression.items() if k not in ['buildings','research']})+';\n',
 'data-buildings.js':'window.PLAGUE_DATA.progression.buildings='+js(progression['buildings'])+';\n',
 'data-research.js':'window.PLAGUE_DATA.progression.research='+js(progression['research'])+';\n'
}
for name,content in bundles.items():
 path=out/name;path.write_text(content)
 size=path.stat().st_size
 if size>=950000:raise RuntimeError(f'{name} exceeds conservative InfinityFree limit: {size}')
 print(name,size)
print('guides',len(base['guides']),'hero_cards',len(heroes),'servers',len(servers['servers']))
