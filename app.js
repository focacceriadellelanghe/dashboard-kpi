'use strict';
const IVA=1.10;
const cfg=window.APP_CONFIG||{};
const configured=Boolean(cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&cfg.ADMIN_EMAIL&&cfg.VIEWER_EMAIL);
const sb=configured?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:true}}):null;
const state={role:null,user:null,days:[],settings:{break_even_net:12800,target_net:16500,analysis_weeks:8,standard_week:{0:'closed',1:'open',2:'open',3:'open',4:'open',5:'open',6:'open'}},categories:[],commissions:[],scenarios:[],page:'home',period:'month',topic:'Fatturato',customFrom:null,customTo:null,chart:null,demo:!configured};
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n||0));
const euro2=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
const pct=n=>`${n>=0?'+':''}${Number(n||0).toLocaleString('it-IT',{maximumFractionDigits:1})}%`;
const net=n=>Number(n||0)/IVA;
const localGross=d=>Math.max(0,d.gross_total-d.gross_takeaway-d.gross_deliveroo-d.gross_justeat);
const localCustomers=d=>Math.max(0,d.customers_total-d.customers_takeaway-d.customers_deliveroo-d.customers_justeat);
const localTransactions=d=>Math.max(0,d.transactions_total-d.tickets_takeaway-d.orders_deliveroo-d.orders_justeat);
const isoMonth=d=>d.slice(0,7);
const today=()=>new Date().toISOString().slice(0,10);

const demoDays=()=>{const rows=[];for(let i=1;i<=15;i++){const date=`2026-06-${String(i).padStart(2,'0')}`;const dow=new Date(date+'T12:00:00').getDay();if(dow===0)continue;const gross=260+i*17+(dow===6?180:0);rows.push({id:`demo-${i}`,business_date:date,status:'open',planned_status:'open',deliveroo_active:true,justeat_active:true,gross_total:gross,gross_takeaway:gross*.18,gross_deliveroo:gross*.09,gross_justeat:gross*.05,customers_total:Math.round(gross/9.3),customers_takeaway:Math.round(gross*.18/9),customers_deliveroo:Math.round(gross*.09/12),customers_justeat:Math.round(gross*.05/11),transactions_total:Math.round(gross/14),tickets_takeaway:Math.round(gross*.18/14),orders_deliveroo:Math.round(gross*.09/20),orders_justeat:Math.round(gross*.05/18),promo_redeemed:Math.round(i/4),promo_revenue_gross:Math.round(i/4)*9.8,landing_cumulative:i*28,promo_downloads_cumulative:i*6,category_id:null,tags:[],notes:i===13?'Evento cittadino favorevole':'',include_in_averages:true,updated_at:new Date().toISOString()});}return rows};

async function boot(){
  $('#loginForm').addEventListener('submit',login);
  $('#resetBtn').addEventListener('click',resetPassword);
  $('#roleBtn').addEventListener('click',logout);
  $('#modalClose').addEventListener('click',closeModal);
  if(state.demo){$('#loginError').textContent='Modalità locale: usa admin2026 o viewer2026. Configura config.js per collegare Supabase.';}
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

async function login(e){e.preventDefault();const password=$('#password').value;$('#loginError').textContent='';try{
  if(state.demo){if(password==='admin2026')state.role='admin';else if(password==='viewer2026')state.role='viewer';else throw new Error('Password non corretta');state.days=demoDays();state.categories=defaultCategories();}
  else{let res=await sb.auth.signInWithPassword({email:cfg.ADMIN_EMAIL,password});if(res.error){res=await sb.auth.signInWithPassword({email:cfg.VIEWER_EMAIL,password});if(res.error)throw new Error('Password non corretta');}state.user=res.data.user;const {data,error}=await sb.from('profiles').select('role').eq('id',state.user.id).single();if(error)throw error;state.role=data.role;await loadAll();}
  $('#login').classList.add('hidden');$('#app').classList.remove('hidden');renderNav();showPage('home');
}catch(err){$('#loginError').textContent=err.message}}
async function resetPassword(){if(state.demo)return toast('Disponibile dopo la configurazione Supabase');if(!cfg.ADMIN_EMAIL)return;const {error}=await sb.auth.resetPasswordForEmail(cfg.ADMIN_EMAIL,{redirectTo:location.href});toast(error?error.message:'Email di recupero inviata')}
async function logout(){if(sb)await sb.auth.signOut();state.role=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden');$('#password').value=''}
async function loadAll(){const [d,s,c,m,sc]=await Promise.all([sb.from('days').select('*').order('business_date'),sb.from('settings').select('*').eq('id',1).single(),sb.from('categories').select('*').order('name'),sb.from('delivery_commissions').select('*'),sb.from('scenarios').select('*').order('updated_at',{ascending:false})]);if(d.error)throw d.error;state.days=d.data||[];if(s.data)state.settings=s.data;state.categories=c.data||[];state.commissions=m.data||[];state.scenarios=sc.data||[]}
function defaultCategories(){return ['Giornata ordinaria','Maltempo moderato','Maltempo eccezionale','Evento cittadino favorevole','Evento cittadino sfavorevole','Festività','Apertura straordinaria','Apertura con orario ridotto','Chiusura anticipata','Guasto o problema tecnico','Personale ridotto','Manifestazione o viabilità bloccata','Campagna marketing/promozione','Grande gruppo o prenotazione eccezionale','Esaurimento prodotto/scorte','Altro'].map((name,i)=>({id:i+1,name,active:true}))}

function renderNav(){const items=[['home','⌂','Home'],['deep','◫','Approfondimenti'],...(state.role==='admin'?[['entry','＋','Inserimento']]:[]),['archive','▤','Archivio'],['more','•••','Altro']];$('#nav').style.gridTemplateColumns=`repeat(${items.length},1fr)`;$('#nav').innerHTML=items.map(([id,ico,label])=>`<button class="nav-btn ${id===state.page?'active':''}" data-page="${id}"><b>${ico}</b>${label}</button>`).join('');$$('.nav-btn').forEach(b=>b.onclick=()=>showPage(b.dataset.page))}
function showPage(page){state.page=page;renderNav();const renderers={home:renderHome,deep:renderDeep,entry:renderEntry,archive:renderArchive,more:renderMore};renderers[page]?.();window.scrollTo(0,0)}
function head(kicker,title,sub=''){return `<div class="page-head"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${sub?`<div class="muted">${sub}</div>`:''}</div>`}
function monthDays(month='2026-06'){return state.days.filter(d=>isoMonth(d.business_date)===month&&d.status!=='closed')}
function previousMonth(month){const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7)}
function totals(rows){const gross=rows.reduce((a,d)=>a+Number(d.gross_total),0),customers=rows.reduce((a,d)=>a+Number(d.customers_total),0),transactions=rows.reduce((a,d)=>a+Number(d.transactions_total),0);return{gross,net:net(gross),customers,transactions,spend:customers?net(gross)/customers:0,ticket:transactions?net(gross)/transactions:0}}
function change(current,previous,key){const a=current[key]||0,b=previous[key]||0;return b?((a-b)/b*100):0}
function openDaysInMonth(month){const [y,m]=month.split('-').map(Number);let n=0;for(let d=1;d<=new Date(y,m,0).getDate();d++){const dow=new Date(y,m-1,d).getDay();if(state.settings.standard_week?.[dow]!=='closed')n++}return n}
function forecast(month,rows){const t=totals(rows),elapsed=rows.length,totalOpen=openDaysInMonth(month);if(!elapsed)return 0;return t.net/elapsed*totalOpen}

function renderHome(){const month='2026-06',rows=monthDays(month),cur=totals(rows),prev=totals(monthDays(previousMonth(month))),fc=forecast(month,rows),be=Number(state.settings.break_even_net),target=Number(state.settings.target_net);const channels=[['Locale',rows.reduce((a,d)=>a+net(localGross(d)),0)],['Asporto',rows.reduce((a,d)=>a+net(d.gross_takeaway),0)],['Deliveroo',rows.reduce((a,d)=>a+net(d.gross_deliveroo),0)],['Just Eat',rows.reduce((a,d)=>a+net(d.gross_justeat),0)]];const last=rows.at(-1);$('#main').innerHTML=head('Giugno 2026','Andamento del mese',`Ultimo aggiornamento ${last?new Date(last.updated_at).toLocaleString('it-IT'):'—'}`)+`<div class="grid home-grid">
${kpi('Fatturato lordo IVA inclusa',euro(cur.gross),`${pct(change(cur,prev,'gross'))} rispetto al fatturato lordo del mese precedente`,'','Unico KPI lordo; non usato nei calcoli')}
${kpi('Fatturato netto IVA',euro(cur.net),`${pct(change(cur,prev,'net'))} rispetto al fatturato netto IVA del mese precedente`,'gold',`${Math.min(100,cur.net/be*100).toFixed(0)}% del punto di pareggio`)}
${kpi('Clienti',cur.customers.toLocaleString('it-IT'),`${pct(change(cur,prev,'customers'))} rispetto ai clienti del mese precedente`)}
${kpi('Forecast netto IVA',euro(fc),`Range indicativo ${euro(fc*.94)}–${euro(fc*1.06)}`)}
${kpi('Distanza dal pareggio netto IVA',euro(fc-be),`${euro((be-cur.net)/Math.max(1,openDaysInMonth(month)-rows.length))} netti IVA per giorno residuo`)}
${kpi('Spesa media netta IVA',euro2(cur.spend),`${pct(change(cur,prev,'spend'))} rispetto alla spesa media netta IVA del mese precedente`,change(cur,prev,'spend')<0?'gold':'')}
</div><div class="card"><h2 class="section-title">Composizione canali</h2><div class="muted">Ripartizione del fatturato netto IVA</div>${channels.map(([n,v])=>`<div class="channel"><span>${n} netto IVA</span><div class="bar"><span style="width:${cur.net?v/cur.net*100:0}%"></span></div><b>${euro(v)} · ${cur.net?(v/cur.net*100).toFixed(0):0}%</b></div>`).join('')}</div>${alerts(rows,cur,fc,be,target)}${last?`<div class="card"><div class="eyebrow">Ultima giornata</div><h2 class="section-title">${new Date(last.business_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</h2><div class="muted">${last.notes||'Giornata ordinaria'}</div><div class="kpi-value">${euro(net(last.gross_total))} netto IVA</div><div class="small">${last.customers_total} clienti · ${euro2(last.customers_total?net(last.gross_total)/last.customers_total:0)} media cliente netta IVA</div></div>`:''}`}
function kpi(label,value,changeText,cls='',note=''){return `<div class="kpi ${cls}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${changeText?`<div class="change">${changeText}</div>`:''}${note?`<div class="small">${note}</div>`:''}</div>`}
function alerts(rows,cur,fc,be,target){const list=[];if(fc<be)list.push(`Forecast ${euro(be-fc)} sotto il pareggio netto IVA`);if(fc<target)list.push(`Forecast ${euro(target-fc)} sotto l’obiettivo netto IVA`);if(!rows.length)list.push('Nessun dato nel mese corrente');return `<div class="card"><h2 class="section-title">Avvisi e priorità attive</h2><div class="muted">${list.length?list.join(' · '):'Nessun avviso attivo'}</div></div>`}

function periodRows(){let rows=[...state.days].filter(d=>d.status!=='closed').sort((a,b)=>a.business_date.localeCompare(b.business_date));if(state.period==='today')return rows.filter(d=>d.business_date===rows.at(-1)?.business_date);if(state.period==='7')return rows.slice(-7);if(state.period==='30')return rows.slice(-30);if(state.period==='3m')return rows.slice(-78);if(state.period==='year')return rows.filter(d=>d.business_date.startsWith('2026-'));if(state.period==='custom'&&state.customFrom&&state.customTo)return rows.filter(d=>d.business_date>=state.customFrom&&d.business_date<=state.customTo);return monthDays('2026-06')}

function deepContent(topic,rows){
  const t=totals(rows);
  const open=Math.max(1,rows.length);
  const channelNet={
    locale:rows.reduce((a,d)=>a+net(localGross(d)),0),
    takeaway:rows.reduce((a,d)=>a+net(d.gross_takeaway),0),
    deliveroo:rows.reduce((a,d)=>a+net(d.gross_deliveroo),0),
    justeat:rows.reduce((a,d)=>a+net(d.gross_justeat),0)
  };
  const channelCustomers={
    locale:rows.reduce((a,d)=>a+localCustomers(d),0),
    takeaway:rows.reduce((a,d)=>a+Number(d.customers_takeaway||0),0),
    deliveroo:rows.reduce((a,d)=>a+Number(d.customers_deliveroo||0),0),
    justeat:rows.reduce((a,d)=>a+Number(d.customers_justeat||0),0)
  };
  const promoRedeemed=rows.reduce((a,d)=>a+Number(d.promo_redeemed||0),0);
  const promoGross=rows.reduce((a,d)=>a+Number(d.promo_revenue_gross||0),0);
  const lastLanding=rows.length?Number(rows.at(-1).landing_cumulative||0):0;
  const lastDownloads=rows.length?Number(rows.at(-1).promo_downloads_cumulative||0):0;
  const forecastNet=forecast('2026-06',monthDays('2026-06'));
  const be=Number(state.settings.break_even_net||0);
  const target=Number(state.settings.target_net||0);

  if(topic==='Clienti')return{
    cards:kpi('Clienti totali',t.customers.toLocaleString('it-IT'),'Periodo selezionato')+
      kpi('Media clienti per giorno',Math.round(t.customers/open).toLocaleString('it-IT'),'Giorni aperti selezionati')+
      kpi('Clienti locale',channelCustomers.locale.toLocaleString('it-IT'),'Calcolati al netto degli altri canali'),
    reading:`Nel periodo selezionato sono stati registrati ${t.customers.toLocaleString('it-IT')} clienti, pari a una media di ${Math.round(t.customers/open).toLocaleString('it-IT')} clienti per giorno aperto. Il locale rappresenta ${t.customers?(channelCustomers.locale/t.customers*100).toFixed(1):0}% dei clienti complessivi.`
  };

  if(topic==='Spesa media')return{
    cards:kpi('Spesa media netta IVA',euro2(t.spend),'Per cliente')+
      kpi('Scontrino medio netto IVA',euro2(t.ticket),'Per transazione')+
      kpi('Spesa media lorda IVA',euro2(t.customers?t.gross/t.customers:0),'Dato di lettura'),
    reading:`La spesa media netta IVA è ${euro2(t.spend)} per cliente. Lo scontrino medio netto IVA è ${euro2(t.ticket)} su ${t.transactions.toLocaleString('it-IT')} transazioni registrate.`
  };

  if(topic==='Canali')return{
    cards:kpi('Locale netto IVA',euro(channelNet.locale),`${t.net?(channelNet.locale/t.net*100).toFixed(1):0}% del totale`)+
      kpi('Asporto netto IVA',euro(channelNet.takeaway),`${t.net?(channelNet.takeaway/t.net*100).toFixed(1):0}% del totale`)+
      kpi('Delivery netto IVA',euro(channelNet.deliveroo+channelNet.justeat),`${t.net?((channelNet.deliveroo+channelNet.justeat)/t.net*100).toFixed(1):0}% del totale`),
    reading:`Il locale genera ${euro(channelNet.locale)} netti IVA, l’asporto ${euro(channelNet.takeaway)}, Deliveroo ${euro(channelNet.deliveroo)} e Just Eat ${euro(channelNet.justeat)}.`
  };

  if(topic==='Promo')return{
    cards:kpi('Promo riscattate',promoRedeemed.toLocaleString('it-IT'),'Periodo selezionato')+
      kpi('Fatturato promo netto IVA',euro(net(promoGross)),'Attribuito agli scontrini promo')+
      kpi('Download cumulativi',lastDownloads.toLocaleString('it-IT'),`${lastLanding.toLocaleString('it-IT')} visite landing cumulative`),
    reading:`Le promo riscattate sono ${promoRedeemed.toLocaleString('it-IT')} e hanno generato ${euro(net(promoGross))} netti IVA. Il rapporto tra riscatti e download cumulativi è ${lastDownloads?(promoRedeemed/lastDownloads*100).toFixed(1):0}%.`
  };

  if(topic==='Forecast')return{
    cards:kpi('Forecast mensile netto IVA',euro(forecastNet),'Proiezione sul mese corrente')+
      kpi('Distanza dal pareggio',euro(forecastNet-be),forecastNet>=be?'Sopra il pareggio':'Sotto il pareggio')+
      kpi('Distanza dall’obiettivo',euro(forecastNet-target),forecastNet>=target?'Sopra l’obiettivo':'Sotto l’obiettivo'),
    reading:`La proiezione di chiusura è ${euro(forecastNet)} netti IVA. Il pareggio è fissato a ${euro(be)} e l’obiettivo a ${euro(target)}.`
  };

  return{
    cards:kpi('Fatturato netto IVA',euro(t.net),'Periodo selezionato')+
      kpi('Media netta per giorno aperto',euro(rows.length?t.net/rows.length:0),'Periodo selezionato')+
      kpi('Fatturato lordo IVA inclusa',euro(t.gross),'Dato di lettura'),
    reading:`Il fatturato netto IVA è ${euro(t.net)}, generato da ${t.customers.toLocaleString('it-IT')} clienti con una spesa media netta IVA di ${euro2(t.spend)}.`
  };
}

function renderDeep(){
  const rows=periodRows(),content=deepContent(state.topic,rows);
  $('#main').innerHTML=head('Approfondimenti','Analisi per argomento')+
  `<div class="filters">${[['today','Oggi'],['7','7 giorni'],['month','Mese'],['3m','3 mesi'],['year','Anno'],['custom','Personalizzato']].map(([v,l])=>`<button class="chip ${state.period===v?'active':''}" data-period="${v}">${l}</button>`).join('')}</div>
  <div class="filters">${['Fatturato','Clienti','Spesa media','Canali','Promo','Forecast'].map(x=>`<button class="chip ${state.topic===x?'active':''}" data-topic="${x}">${x}</button>`).join('')}</div>
  <div class="card"><div class="grid">${content.cards}</div><div class="chart-wrap"><canvas id="trendChart"></canvas></div></div>
  <div class="card"><h2 class="section-title">Lettura automatica</h2><div class="muted">${content.reading}</div></div>`;

  $$('[data-period]').forEach(b=>b.onclick=()=>{const p=b.dataset.period;if(p==='custom')openCustomPeriod();else{state.period=p;renderDeep()}});
  $$('[data-topic]').forEach(b=>b.onclick=()=>{state.topic=b.dataset.topic;renderDeep()});
  requestAnimationFrame(()=>drawChart(rows,state.topic));
}

function drawChart(rows,topic='Fatturato'){
  const c=$('#trendChart');if(!c)return;state.chart?.destroy();
  let datasets=[],showLegend=false;

  if(topic==='Clienti'){
    datasets=[{label:'Clienti',data:rows.map(d=>Number(d.customers_total||0)),borderColor:'#DFA145',backgroundColor:'rgba(223,161,69,.12)',fill:true,tension:.35}];
  }else if(topic==='Spesa media'){
    datasets=[{label:'Spesa media netta IVA',data:rows.map(d=>d.customers_total?net(d.gross_total)/d.customers_total:0),borderColor:'#DFA145',backgroundColor:'rgba(223,161,69,.12)',fill:true,tension:.35}];
  }else if(topic==='Canali'){
    showLegend=true;
    datasets=[
      {label:'Locale',data:rows.map(d=>net(localGross(d))),borderColor:'#DFA145',tension:.35},
      {label:'Asporto',data:rows.map(d=>net(d.gross_takeaway)),borderColor:'#d7d7d7',tension:.35},
      {label:'Deliveroo',data:rows.map(d=>net(d.gross_deliveroo)),borderColor:'#8f8f8f',tension:.35},
      {label:'Just Eat',data:rows.map(d=>net(d.gross_justeat)),borderColor:'#5f5f5f',tension:.35}
    ];
  }else if(topic==='Promo'){
    datasets=[{label:'Promo riscattate',data:rows.map(d=>Number(d.promo_redeemed||0)),borderColor:'#DFA145',backgroundColor:'rgba(223,161,69,.12)',fill:true,tension:.35}];
  }else if(topic==='Forecast'){
    const cumulative=[];let sum=0;
    rows.forEach(d=>{sum+=net(d.gross_total);cumulative.push(sum)});
    datasets=[{label:'Fatturato netto cumulato',data:cumulative,borderColor:'#DFA145',backgroundColor:'rgba(223,161,69,.12)',fill:true,tension:.35}];
  }else{
    datasets=[{label:'Fatturato netto IVA',data:rows.map(d=>net(d.gross_total)),borderColor:'#DFA145',backgroundColor:'rgba(223,161,69,.12)',fill:true,tension:.35}];
  }

  state.chart=new Chart(c,{type:'line',data:{labels:rows.map(d=>d.business_date.slice(5)),datasets},options:{maintainAspectRatio:false,plugins:{legend:{display:showLegend,labels:{color:'#aaa'}}},scales:{x:{ticks:{color:'#777'},grid:{display:false}},y:{ticks:{color:'#777'},grid:{color:'#252525'}}}}});
}

function openCustomPeriod(){
  openModal('Intervallo personalizzato',`<div class="fields"><div class="field"><label>Dal</label><input id="fromDate" type="date" value="${state.customFrom||''}"></div><div class="field"><label>Al</label><input id="toDate" type="date" value="${state.customTo||''}"></div></div><button class="btn primary" id="applyDates">Applica</button>`);
  $('#applyDates').onclick=()=>{const f=$('#fromDate').value,t=$('#toDate').value;if(!f||!t)return toast('Seleziona entrambe le date');if(f>t)return toast('La data iniziale supera quella finale');state.customFrom=f;state.customTo=t;state.period='custom';closeModal();renderDeep()}
}

function renderEntry(edit=null){if(state.role!=='admin')return showPage('home');const d=edit||{business_date:nextMissingDate(),status:'open',planned_status:'open',deliveroo_active:true,justeat_active:true,gross_total:'',gross_takeaway:'',gross_deliveroo:'',gross_justeat:'',customers_total:'',customers_takeaway:'',customers_deliveroo:'',customers_justeat:'',transactions_total:'',tickets_takeaway:'',orders_deliveroo:'',orders_justeat:'',promo_redeemed:'',promo_revenue_gross:'',landing_cumulative:'',promo_downloads_cumulative:'',category_id:'',tags:[],notes:'',include_in_averages:true};$('#main').innerHTML=head('Inserimento',edit?'Modifica giornata':'Nuova giornata','Data proposta: ultima giornata aperta mancante')+`<form id="dayForm" class="card">${section('Giornata',fields([{n:'business_date',l:'Data',t:'date',v:d.business_date},{n:'status',l:'Stato',t:'select',v:d.status,o:[['open','Aperto'],['closed','Chiuso'],['partial','Parzialmente aperto']]},{n:'deliveroo_active',l:'Deliveroo',t:'select',v:String(d.deliveroo_active),o:[['true','Attivo'],['false','Non attivo']]},{n:'justeat_active',l:'Just Eat',t:'select',v:String(d.justeat_active),o:[['true','Attivo'],['false','Non attivo']]}]))}${section('Fatturato IVA inclusa',fields([{n:'gross_total',l:'Fatturato totale lordo €',t:'number',v:d.gross_total,full:true},{n:'gross_takeaway',l:'Asporto lordo €',t:'number',v:d.gross_takeaway},{n:'gross_deliveroo',l:'Deliveroo lordo €',t:'number',v:d.gross_deliveroo},{n:'gross_justeat',l:'Just Eat lordo €',t:'number',v:d.gross_justeat}])+`<div id="revenueSummary" class="summary"></div>`)}${section('Clienti e transazioni',fields([{n:'customers_total',l:'Clienti totali',t:'number',v:d.customers_total},{n:'transactions_total',l:'Transazioni totali',t:'number',v:d.transactions_total},{n:'customers_takeaway',l:'Clienti asporto',t:'number',v:d.customers_takeaway},{n:'tickets_takeaway',l:'Scontrini asporto',t:'number',v:d.tickets_takeaway},{n:'customers_deliveroo',l:'Clienti Deliveroo',t:'number',v:d.customers_deliveroo},{n:'orders_deliveroo',l:'Ordini Deliveroo',t:'number',v:d.orders_deliveroo},{n:'customers_justeat',l:'Clienti Just Eat',t:'number',v:d.customers_justeat},{n:'orders_justeat',l:'Ordini Just Eat',t:'number',v:d.orders_justeat}])+`<div id="peopleSummary" class="summary"></div>`)}${section('Promo',fields([{n:'promo_redeemed',l:'Promo riscattate totali',t:'number',v:d.promo_redeemed},{n:'promo_revenue_gross',l:'Fatturato scontrini promo lordo €',t:'number',v:d.promo_revenue_gross},{n:'landing_cumulative',l:'Landing cumulative del mese',t:'number',v:d.landing_cumulative},{n:'promo_downloads_cumulative',l:'Promo scaricate cumulative',t:'number',v:d.promo_downloads_cumulative}]))}${section('Contesto',fields([{n:'category_id',l:'Categoria principale',t:'select',v:d.category_id||'',o:[['','Seleziona'],...state.categories.filter(c=>c.active).map(c=>[c.id,c.name])]},{n:'include_in_averages',l:'Inclusione nelle medie',t:'select',v:String(d.include_in_averages),o:[['true','Considera'],['false','Escludi']]},{n:'tags',l:'Tag secondari',t:'text',v:(d.tags||[]).join(', '),full:true},{n:'notes',l:'Descrizione libera',t:'textarea',v:d.notes||'',full:true}]))}<button class="btn primary" style="width:100%">Controlla e salva giornata</button></form>`;$('#dayForm').oninput=entryCalc;$('#dayForm').onsubmit=e=>saveDay(e,d.id);entryCalc()}
function section(title,body){return `<div class="form-section"><div class="form-title">${title}</div>${body}</div>`}
function fields(arr){return `<div class="fields">${arr.map(x=>{
  let control='';
  if(x.t==='select') control=`<select name="${x.n}">${x.o.map(([v,l])=>`<option value="${v}" ${String(x.v)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  else if(x.t==='textarea') control=`<textarea name="${x.n}">${x.v??''}</textarea>`;
  else control=`<input name="${x.n}" type="${x.t}" value="${x.v??''}" ${x.t==='number'?'step="0.01"':''}>`;
  return `<div class="field ${x.full?'full':''}"><label>${x.l}</label>${control}</div>`;
}).join('')}</div>`}
function entryCalc(){const f=new FormData($('#dayForm')),n=k=>Number(f.get(k)||0);const gl=Math.max(0,n('gross_total')-n('gross_takeaway')-n('gross_deliveroo')-n('gross_justeat'));$('#revenueSummary').textContent=`Locale calcolato automaticamente: ${euro2(gl)} lordo · ${euro2(net(gl))} netto IVA. Totale netto IVA: ${euro2(net(n('gross_total')))}`;const lc=Math.max(0,n('customers_total')-n('customers_takeaway')-n('customers_deliveroo')-n('customers_justeat')),lt=Math.max(0,n('transactions_total')-n('tickets_takeaway')-n('orders_deliveroo')-n('orders_justeat'));$('#peopleSummary').textContent=`Locale calcolato automaticamente: ${lc} clienti · ${lt} scontrini`}
async function saveDay(e,id){e.preventDefault();const f=new FormData(e.target),num=k=>Number(f.get(k)||0);const row={business_date:f.get('business_date'),status:f.get('status'),planned_status:f.get('status'),deliveroo_active:f.get('deliveroo_active')==='true',justeat_active:f.get('justeat_active')==='true',gross_total:num('gross_total'),gross_takeaway:num('gross_takeaway'),gross_deliveroo:num('gross_deliveroo'),gross_justeat:num('gross_justeat'),customers_total:num('customers_total'),customers_takeaway:num('customers_takeaway'),customers_deliveroo:num('customers_deliveroo'),customers_justeat:num('customers_justeat'),transactions_total:num('transactions_total'),tickets_takeaway:num('tickets_takeaway'),orders_deliveroo:num('orders_deliveroo'),orders_justeat:num('orders_justeat'),promo_redeemed:num('promo_redeemed'),promo_revenue_gross:num('promo_revenue_gross'),landing_cumulative:num('landing_cumulative'),promo_downloads_cumulative:num('promo_downloads_cumulative'),category_id:f.get('category_id')||null,tags:String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),notes:f.get('notes')||null,include_in_averages:f.get('include_in_averages')==='true',updated_at:new Date().toISOString()};const errs=validate(row);if(errs.length)return toast(errs[0]);if(state.demo){if(id){const i=state.days.findIndex(x=>x.id===id);state.days[i]={...state.days[i],...row}}else state.days.push({...row,id:crypto.randomUUID()});state.days.sort((a,b)=>a.business_date.localeCompare(b.business_date));}else{const q=id?sb.from('days').update(row).eq('id',id):sb.from('days').insert(row);const {error}=await q;if(error)return toast(error.message);await loadAll()}toast('Giornata salvata');showPage('home')}
function validate(r){const e=[];if(r.status==='closed'&&r.gross_total>0)e.push('Una giornata chiusa non può avere fatturato');if(r.gross_total<r.gross_takeaway+r.gross_deliveroo+r.gross_justeat)e.push('La somma dei canali supera il totale');if(r.customers_total<r.customers_takeaway+r.customers_deliveroo+r.customers_justeat)e.push('La somma clienti canale supera il totale');if(r.gross_deliveroo>0&&!r.orders_deliveroo)e.push('Deliveroo ha fatturato ma zero ordini');if(r.gross_justeat>0&&!r.orders_justeat)e.push('Just Eat ha fatturato ma zero ordini');return e}
function nextMissingDate(){const dates=new Set(state.days.map(d=>d.business_date));let d=new Date('2026-06-01T12:00:00');for(let i=0;i<60;i++){const iso=d.toISOString().slice(0,10),dow=d.getDay();if(state.settings.standard_week?.[dow]!=='closed'&&!dates.has(iso))return iso;d.setDate(d.getDate()+1)}return today()}

function renderArchive(){const rows=[...state.days].sort((a,b)=>b.business_date.localeCompare(a.business_date));$('#main').innerHTML=head('Archivio','Giornate registrate')+`<div class="card">${rows.map(d=>{const avgGross=d.customers_total?d.gross_total/d.customers_total:0,avgNet=d.customers_total?net(d.gross_total)/d.customers_total:0;return `<div class="archive-row" data-id="${d.id}"><div class="datebox"><b>${d.business_date.slice(-2)}</b><span>${new Date(d.business_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'}).toUpperCase()}</span></div><div><b>${euro(d.gross_total)} lordo</b><div class="small">${euro(net(d.gross_total))} netto IVA · ${d.customers_total} clienti · ${d.notes||'Giornata ordinaria'}</div></div><div style="text-align:right"><b>${euro2(avgGross)}</b><div class="small">media cliente lorda<br>${euro2(avgNet)} netta IVA</div></div></div>`}).join('')||'<div class="muted">Nessun dato</div>'}</div>`;$$('.archive-row').forEach(r=>r.onclick=()=>openDay(r.dataset.id))}
function openDay(id){const d=state.days.find(x=>x.id===id);openModal(new Date(d.business_date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}),`<div class="grid">${kpi('Fatturato lordo IVA inclusa',euro(d.gross_total),'Dato di lettura')}${kpi('Fatturato netto IVA',euro(net(d.gross_total)),'Usato nei KPI')}${kpi('Clienti',d.customers_total,'')}</div><div class="card"><div class="muted">Locale netto IVA ${euro(net(localGross(d)))} · Asporto netto IVA ${euro(net(d.gross_takeaway))} · Deliveroo netto IVA ${euro(net(d.gross_deliveroo))} · Just Eat netto IVA ${euro(net(d.gross_justeat))}</div></div>${state.role==='admin'?`<div class="btn-row"><button id="editDay" class="btn secondary">Modifica</button><button id="deleteDay" class="btn danger">Elimina</button></div>`:''}`);if(state.role==='admin'){$('#editDay').onclick=()=>{closeModal();renderEntry(d)};$('#deleteDay').onclick=()=>deleteDay(d.id)}}
async function deleteDay(id){if(!confirm('Eliminare definitivamente la giornata?'))return;if(state.demo)state.days=state.days.filter(d=>d.id!==id);else{const {error}=await sb.from('days').delete().eq('id',id);if(error)return toast(error.message);await loadAll()}closeModal();renderArchive();toast('Giornata eliminata')}

function renderMore(){const items=[['calendar','📅','Calendario'],['targets','🎯','Target'],['commissions','💶','Commissioni'],['simulator','📊','Simulatore'],['transfer','📤','Import / Export'],...(state.role==='admin'?[['settings','⚙️','Impostazioni']]:[])];$('#main').innerHTML=head('Altro','Strumenti e configurazione')+`<div class="more-grid">${items.map(([id,ico,l])=>`<button class="more-item" data-sub="${id}"><span>${ico}</span><b>${l}</b></button>`).join('')}</div>`;$$('[data-sub]').forEach(b=>b.onclick=()=>renderSub(b.dataset.sub))}
function renderSub(name){({calendar:renderCalendar,targets:renderTargets,commissions:renderCommissions,simulator:renderSimulator,transfer:renderTransfer,settings:renderSettings})[name]?.()}
function backMore(){renderMore()}
function renderCalendar(){const days=[];for(let i=1;i<=30;i++){const dow=new Date(`2026-06-${String(i).padStart(2,'0')}T12:00:00`).getDay();days.push(`<div class="day ${dow===0?'closed':''}">${i}</div>`)}$('#main').innerHTML=head('Calendario','Pianificato ed effettivo')+`<div class="card"><div class="calendar">${['L','M','M','G','V','S','D'].map(x=>`<div class="small">${x}</div>`).join('')}${days.join('')}</div></div><button class="btn secondary" onclick="showPage('more')">Indietro</button>`}
function renderTargets(){$('#main').innerHTML=head('Target','Obiettivi economici','Inserire esclusivamente valori netti IVA')+`<form id="targetForm" class="card"><div class="fields"><div class="field"><label>Punto di pareggio mensile netto IVA</label><input name="break_even_net" type="number" value="${state.settings.break_even_net}"></div><div class="field"><label>Obiettivo mensile netto IVA</label><input name="target_net" type="number" value="${state.settings.target_net}"></div><div class="field"><label>Giorni apertura previsti</label><input disabled value="${openDaysInMonth('2026-06')}"></div><div class="field"><label>Target teorico netto IVA / giorno</label><input disabled value="${(state.settings.break_even_net/openDaysInMonth('2026-06')).toFixed(2)}"></div></div>${state.role==='admin'?'<button class="btn primary">Salva target</button>':''}</form>`;if(state.role==='admin')$('#targetForm').onsubmit=saveTargets}
async function saveTargets(e){e.preventDefault();const f=new FormData(e.target),row={break_even_net:Number(f.get('break_even_net')),target_net:Number(f.get('target_net')),updated_at:new Date().toISOString()};state.settings={...state.settings,...row};if(!state.demo){const {error}=await sb.from('settings').update(row).eq('id',1);if(error)return toast(error.message)}toast('Target salvati')}
function renderCommissions(){const month='2026-06-01',c=state.commissions.find(x=>x.month===month)||{deliveroo:0,justeat:0};$('#main').innerHTML=head('Commissioni','Chiusura mensile')+`<form id="commissionForm" class="card"><div class="fields"><div class="field"><label>Mese</label><input name="month" type="month" value="2026-06"></div><div class="field"><label>Commissioni Deliveroo €</label><input name="deliveroo" type="number" value="${c.deliveroo}"></div><div class="field"><label>Commissioni Just Eat €</label><input name="justeat" type="number" value="${c.justeat}"></div></div>${state.role==='admin'?'<button class="btn primary">Salva commissioni</button>':''}</form>`;if(state.role==='admin')$('#commissionForm').onsubmit=saveCommissions}
async function saveCommissions(e){e.preventDefault();const f=new FormData(e.target),row={month:f.get('month')+'-01',deliveroo:Number(f.get('deliveroo')),justeat:Number(f.get('justeat')),updated_at:new Date().toISOString()};if(state.demo){state.commissions=state.commissions.filter(x=>x.month!==row.month);state.commissions.push(row)}else{const {error}=await sb.from('delivery_commissions').upsert(row,{onConflict:'month'});if(error)return toast(error.message);await loadAll()}toast('Commissioni salvate')}
function renderSimulator(){const def=state.settings.simulator_defaults||{local_customers:48,local_spend:8.9,takeaway_customers:16,takeaway_spend:9.2,deliveroo_customers:6,deliveroo_spend:12.5,justeat_customers:4,justeat_spend:11.8,days:25};$('#main').innerHTML=head('Simulatore','Scenari commerciali')+`<form id="simForm" class="card"><div class="fields">${Object.entries(def).map(([k,v])=>`<div class="field"><label>${k.replaceAll('_',' ')}</label><input name="${k}" type="number" value="${v}"></div>`).join('')}</div><div id="simResult" class="summary"></div>${state.role==='admin'?'<div class="btn-row"><button type="button" id="saveScenario" class="btn primary">Salva scenario</button></div>':''}</form><div class="card"><h2 class="section-title">Scenari salvati</h2>${state.scenarios.map(s=>`<div class="archive-row"><div><b>${s.name}</b><div class="small">${s.description||''}</div></div></div>`).join('')||'<div class="muted">Nessuno scenario</div>'}</div>`;$('#simForm').oninput=simCalc;simCalc();if(state.role==='admin')$('#saveScenario').onclick=saveScenario}
function simCalc(){const f=new FormData($('#simForm')),n=k=>Number(f.get(k)||0),daily=n('local_customers')*n('local_spend')+n('takeaway_customers')*n('takeaway_spend')+n('deliveroo_customers')*n('deliveroo_spend')+n('justeat_customers')*n('justeat_spend'),monthly=daily*n('days');$('#simResult').textContent=`Fatturato stimato netto IVA: ${euro(monthly)} · Differenza dal pareggio: ${euro(monthly-state.settings.break_even_net)} · Differenza dall'obiettivo: ${euro(monthly-state.settings.target_net)}`}
async function saveScenario(){const name=prompt('Nome scenario');if(!name)return;const values=Object.fromEntries(new FormData($('#simForm'))),row={name,description:prompt('Descrizione facoltativa')||'',values,updated_at:new Date().toISOString()};if(state.demo)state.scenarios.unshift({...row,id:crypto.randomUUID()});else{const {error}=await sb.from('scenarios').insert(row);if(error)return toast(error.message);await loadAll()}renderSimulator();toast('Scenario salvato')}
function renderTransfer(){$('#main').innerHTML=head('Import / Export','Portabilità dati')+`<div class="card"><div class="btn-row"><button id="exportCsv" class="btn primary">Esporta CSV</button><button id="exportJson" class="btn secondary">Backup JSON</button></div>${state.role==='admin'?'<div class="field full" style="margin-top:14px"><label>Importa CSV</label><input id="importFile" type="file" accept=".csv"></div>':''}</div>`;$('#exportCsv').onclick=exportCsv;$('#exportJson').onclick=exportJson;if(state.role==='admin')$('#importFile').onchange=importCsv}
function exportCsv(){const headers=Object.keys(state.days[0]||{business_date:''}),csv=[headers.join(','),...state.days.map(d=>headers.map(h=>JSON.stringify(d[h]??'')).join(','))].join('\n');download('giornate.csv',csv,'text/csv')}
function exportJson(){download(`backup-${today()}.json`,JSON.stringify({days:state.days,settings:state.settings,categories:state.categories,commissions:state.commissions,scenarios:state.scenarios},null,2),'application/json')}
function importCsv(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>toast('Anteprima importazione pronta: la gestione conflitti verrà applicata nel passaggio di configurazione dati');r.readAsText(file)}
function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function renderSettings(){if(state.role!=='admin')return renderMore();$('#main').innerHTML=head('Impostazioni','Configurazione amministratore')+`<div class="card"><h2 class="section-title">Regole di analisi</h2><div class="fields"><div class="field"><label>Finestra storico settimane</label><input value="${state.settings.analysis_weeks}"></div><div class="field"><label>Soglia calo clienti %</label><input value="${state.settings.customer_drop_threshold||10}"></div><div class="field"><label>Soglia calo spesa media %</label><input value="${state.settings.avg_spend_drop_threshold||5}"></div></div></div><div class="card"><h2 class="section-title">Categorie</h2>${state.categories.map(c=>`<div class="archive-row"><div><b>${c.name}</b><div class="small">${c.active?'Attiva':'Disattivata'}</div></div></div>`).join('')}</div><div class="card"><button id="changeAdminPwd" class="btn secondary">Cambia password amministratore</button></div>`;$('#changeAdminPwd').onclick=changePassword}
async function changePassword(){if(state.demo)return toast('Disponibile con Supabase configurato');const p=prompt('Nuova password amministratore');if(!p)return;const {error}=await sb.auth.updateUser({password:p});toast(error?error.message:'Password aggiornata')}
function openModal(title,body){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
boot();
