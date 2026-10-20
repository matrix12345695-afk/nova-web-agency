'use strict';
const PAGE_SIZE=5;
function menu(){
 return {inline_keyboard:[
 [{text:'📊 Панель управления',callback_data:'nav|dashboard'},{text:'📥 Заявки',callback_data:'nav|leads|0'}],
 [{text:'🆕 Новые',callback_data:'nav|new|0'},{text:'📅 Сегодня',callback_data:'nav|today'}],
 [{text:'🔎 Поиск',callback_data:'nav|search'},{text:'⏰ Просрочки',callback_data:'nav|overdue'}],
 [{text:'📣 Источники',callback_data:'nav|sources'},{text:'💰 Финансы',callback_data:'nav|finance'}],
 [{text:'📦 Резервная копия',callback_data:'nav|backup'}],
 [{text:'❔ Помощь',callback_data:'nav|help'},{text:'🌐 Открыть сайт',url:'https://novaweb-agency.onrender.com'}]
 ]};
}
function back(){return {inline_keyboard:[[{text:'🏠 Главное меню',callback_data:'nav|home'}]]}}
function summaryText(s,mode='temporary_file'){
 const c=s.counts||{};
 return ['📊 NOVA WEB · Панель владельца','','📋 Заявок: '+s.total,'🆕 Новых: '+(c.new||0),'🛠 В работе: '+(c.working||0),'💬 Связались: '+(c.contacted||0),'🧾 Счёт отправлен: '+(c.invoice||0),'✅ Завершено: '+(c.done||0),'❌ Отказ: '+(c.lost||0),'','🗃 Хранилище: '+(mode==='postgres'?'✅ PostgreSQL':mode==='temporary_file'?'⚠️ Временное':'❌ Недоступно'),'💳 Платежи: не подключены','', 'Счёт отправлен ≠ оплачено. Финансы появятся после платёжной интеграции.'].join('\n')
}
function helpText(){return ['🧭 NOVA WEB · Команды','','/start — панель','/stats или /status — сводка','/leads — последние заявки','/new — новые заявки','/today — заявки сегодня','/lead ID — карточка клиента','/backup — выгрузить архив заявок','/find запрос — поиск клиента','/note ID текст — заметка','/task ID текст — задача','/due ID ГГГГ-ММ-ДД — срок','/quote ID сумма — сумма предложения','/overdue — просроченные заказы','/finance — состояние платежей','/sources — источники заявок','/help — справка','','🔐 Доступ только владельцу. Не пересылайте выгрузки с контактами клиентов.'].join('\n')}
function financeText(){return '💰 NOVA WEB · Финансы\n\nПлатёжный провайдер пока не подключён. Реальные суммы, задолженности и поступления недоступны.\n\nСтатусы CRM отражают ход работы, а не подтверждают оплату.\n\nПосле подключения официальной оплаты появятся выручка, возвраты и сверка транзакций.'}
function todayText(s){const today=new Date().toISOString().slice(0,10),items=(s.all||s.recent||[]).filter(x=>String(x.createdAt).startsWith(today));return ['📅 NOVA WEB · Сегодня','Дата UTC: '+today,'Новых заявок сегодня: '+items.length,'','Для просмотра карточек используйте «Заявки».'].join('\n')}
function leadList(rows,filter='all',page=0){
 const filtered=filter==='new'?rows.filter(x=>x.status==='new'):rows;
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const current=Math.min(Math.max(Number.isInteger(page)?page:0,0),pages-1);
 const subset=filtered.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE);
 let txt=filter==='new'?'🆕 NOVA WEB · Новые заявки':'📥 NOVA WEB · Заявки';
 txt+='\nСтраница '+(current+1)+'/'+pages+' · Всего '+filtered.length+'\n';
 txt+=subset.length?'\n'+subset.map((x,i)=>(current*PAGE_SIZE+i+1)+'. '+(x.name||'Клиент').slice(0,40)+'\n'+x.id+' · '+(x.type||'—')+' · '+(x.status||'new')).join('\n\n'):'\nЗаявок пока нет.';
 const grid=subset.map(x=>[{text:'📄 '+(x.name||'Клиент').slice(0,24)+' · '+x.id.slice(-5),callback_data:'view|'+x.id+'|'+filter+'|'+current}]);
 const pagesRow=[];
 if(current>0)pagesRow.push({text:'◀ Назад',callback_data:'nav|'+(filter==='new'?'new':'leads')+'|'+(current-1)});
 if(current<pages-1)pagesRow.push({text:'Дальше ▶',callback_data:'nav|'+(filter==='new'?'new':'leads')+'|'+(current+1)});
 if(pagesRow.length)grid.push(pagesRow);
 grid.push([{text:'🏠 Главное меню',callback_data:'nav|home'}]);
 return {text:txt,keyboard:{inline_keyboard:grid}};
}
function cardKeyboard(id,source='leads',page=0){
 return {inline_keyboard:[
 [{text:'🛠 В работу',callback_data:'st|'+id+'|working'},{text:'💬 Связались',callback_data:'st|'+id+'|contacted'}],
 [{text:'🧾 Счёт отправлен',callback_data:'st|'+id+'|invoice'},{text:'✅ Завершено',callback_data:'st|'+id+'|done'}],
 [{text:'❌ Отказ',callback_data:'st|'+id+'|lost'}],
 [{text:'↩ К списку',callback_data:'nav|'+source+'|'+page},{text:'🏠 Меню',callback_data:'nav|home'}]
 ]};
}
function homeText(mode){return ['🚀 NOVA WEB · PRO','', 'Панель владельца агентства.', 'Заявки, статусы и отчёты в одном Telegram.', '',mode==='postgres'?'🟢 PostgreSQL подключена':mode==='temporary_file'?'🟠 CRM на временном хранилище':'🔴 Хранилище недоступно','', 'Выберите раздел ниже.'].join('\n')}
module.exports={menu,back,summaryText,helpText,financeText,todayText,leadList,cardKeyboard,homeText,PAGE_SIZE};
