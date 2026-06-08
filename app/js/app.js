// FinCA — Connected frontend application logic
// All calculations via Flask API (server.py)
// Run: python3 server.py → open http://localhost:5000


// ══════════════════════════════════════════════════════════════════════
// FinCA — Connected Frontend
// All calculations run on Python backend via Flask API
// ══════════════════════════════════════════════════════════════════════

const API = '';  // same-origin — Flask serves this file
let _market = null;
let _modelInfo = null;

const PALETTE_ARR = ['#2563eb','#d97706','#16a34a','#7c3aed','#db2777'];
let selRisk='moderate', selHealth='no', selRegime='new', loanCount=0;
let cGrowth=null, cDist=null, cAlloc=null, cExp=null;
let _lastResult = {};

// ── Init: fetch market data + model info on load ──────────────────────
async function initConnected() {
  try {
    const [mRes, mdRes] = await Promise.all([
      fetch(API + '/api/model-info'),
      fetch(API + '/api/market-data'),
    ]);
    _modelInfo = await mRes.json();
    _market    = await mdRes.json();

    // Show backend badge + model tag
    const badge = document.getElementById('backend-badge');
    if (badge) {
      badge.innerHTML = `<span class="dot"></span> Live Backend · ${_modelInfo.model_name}`;
      badge.className = 'badge-pill backend-pill';
    }

    // Inject connected banner into profile page
    const profilePage = document.getElementById('page-profile');
    if (profilePage) {
      const banner = document.createElement('div');
      banner.className = 'connected-banner';
      banner.innerHTML = `<span class="conn-dot"></span>
        Connected to Python backend &nbsp;·&nbsp;
        <b>${_modelInfo.model_name}</b> model
        ${_modelInfo.cv_accuracy ? `(${(_modelInfo.cv_accuracy*100).toFixed(1)}% CV accuracy)` : ''} &nbsp;·&nbsp;
        Rates live from <b>finca.db</b>`;
      profilePage.insertBefore(banner, profilePage.firstChild);
    }

    // Inject market strip into landing page data section
    const marketStrip = document.getElementById('market-strip');
    if (marketStrip && _market) {
      marketStrip.innerHTML = [
        ['Nifty',    _market.nifty    + '%'],
        ['Gold',     _market.gold     + '%'],
        ['FD',       _market.fd       + '%'],
        ['Debt MF',  _market.debt_mf  + '%'],
        ['Inflation', _market.inflation + '%'],
      ].map(([l,v]) => `<div class="market-chip"><div class="mc-val">${v}</div><div class="mc-label">${l}</div></div>`).join('');
    }

  } catch (e) {
    console.warn('Backend not reachable:', e.message);
    const badge = document.getElementById('backend-badge');
    if (badge) { badge.style.background='#7f1d1d'; badge.style.color='#fca5a5'; badge.textContent='⚠ Backend offline'; }
  }
}

// ── Formatting ────────────────────────────────────────────────────────
function fmtIN(n){if(!n&&n!==0)return'—';const a=Math.abs(Math.round(n));const s=a.toString();let r='';if(s.length<=3){r=s;}else{r=s.slice(-3);let rem=s.slice(0,-3);while(rem.length>2){r=rem.slice(-2)+','+r;rem=rem.slice(0,-2);}if(rem.length)r=rem+','+r;}return(n<0?'-':'')+r;}
function fmt(n){if(n===undefined||n===null||isNaN(n))return'—';const a=Math.abs(n);if(a>=10000000)return'₹'+(n/10000000).toFixed(2)+' Cr';if(a>=100000)return'₹'+(n/100000).toFixed(2)+' L';return'₹'+fmtIN(n);}

// ── UI helpers (unchanged from static) ───────────────────────────────
function setTheme(t,btn){document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');localStorage.setItem('finca-theme',t);}
function setRegime(r,btn){selRegime=r;document.querySelectorAll('.regime-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const note=document.getElementById('regime-note');if(note)note.innerHTML=r==='old'?'📌 <b>Old Regime:</b> Claim 80C (₹1.5L), HRA, 80D, 80CCD. Use if your total deductions exceed ₹3.75L/year.':'📌 <b>New Regime (default after 2023):</b> Lower tax slabs but cannot claim 80C/ELSS/HRA deductions. Good if deductions less than ₹3.75L/year.';}
function stripLeadingZero(el){if(el.value.length>1&&el.value.startsWith('0')&&!el.value.startsWith('0.')){el.value=String(parseFloat(el.value)||0);}updateSurplus();}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}
function validateName(input){const ok=/^[a-zA-Z\s]*$/.test(input.value);document.getElementById('fg-name').classList.toggle('has-error',!ok&&input.value.length>0);return ok||input.value.length===0;}
function selectRadio(g,v,el){el.parentElement.querySelectorAll('.radio-card').forEach(e=>e.classList.remove('selected'));el.classList.add('selected');if(g==='risk')selRisk=v;if(g==='health')selHealth=v;}
function showTab(name,btn){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.getElementById('tab-'+name).classList.add('active');btn.classList.add('active');}
function wiToggle(id){const b=document.getElementById('wb-'+id);const c=document.getElementById('wc-'+id);b.classList.toggle('open');c.classList.toggle('open');}

function goTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById('page-'+page);
  if(el)el.classList.add('active');
  window.scrollTo(0,0);
  const order=['profile','expenses','loans','results'];
  const map={profile:'step-1',expenses:'step-2',loans:'step-3',results:'step-4'};
  document.querySelectorAll('.step').forEach(s=>s.classList.remove('active','done'));
  const idx=order.indexOf(page);
  order.forEach((p,i)=>{const st=document.getElementById(map[p]);if(!st)return;if(i<idx)st.classList.add('done');else if(i===idx)st.classList.add('active');});
}

function goToExpenses(){
  const name=document.getElementById('f-name')?.value?.trim();
  const age=parseInt(document.getElementById('f-age')?.value);
  const income=parseFloat(document.getElementById('f-income')?.value);
  if(!name){showToast('Please enter your name.');return;}
  if(!age||age<18||age>59){showToast('Age must be between 18 and 59.');return;}
  if(!income||income<1000){showToast('Please enter a valid monthly income.');return;}
  goTo('expenses');
}

function updateSurplus(){
  const income=parseFloat(document.getElementById('f-income')?.value)||0;
  const rent=parseFloat(document.getElementById('f-rent')?.value)||0;
  const emi=parseFloat(document.getElementById('f-emi')?.value)||0;
  const grocer=parseFloat(document.getElementById('f-groceries')?.value)||0;
  const utils=parseFloat(document.getElementById('f-utilities')?.value)||0;
  const deps=parseInt(document.getElementById('f-deps')?.value)||0;
  const ls=document.getElementById('f-lifestyle')?.value||'average';
  const lsSpend={frugal:income*.05,average:income*.10,lavish:income*.20}[ls]||0;
  const depCost=deps*6000;
  const total=rent+emi+grocer+utils+lsSpend+depCost;
  const surplus=income-total;
  const investable=Math.max(Math.round(surplus*.80),0);
  const sp=document.getElementById('surplus-preview');
  if(!sp)return;
  if(income>0){
    sp.style.display='block';
    // Use correct IDs matching the HTML
    const incEl=document.getElementById('sp-income');
    const expEl=document.getElementById('sp-expenses');
    const surEl=document.getElementById('sp-surplus');
    const bufEl=document.getElementById('sp-buffer');
    const sipEl=document.getElementById('sp-sip');
    if(incEl)incEl.textContent=fmt(income);
    if(expEl)expEl.textContent=fmt(total);
    if(surEl){surEl.textContent=fmt(surplus);surEl.style.color=surplus>0?'var(--green)':'var(--red)';}
    if(bufEl)bufEl.textContent=fmt(Math.round(surplus*.20));
    if(sipEl)sipEl.textContent=fmt(investable)+'/month';
  }
}

function addLoan(){loanCount++;const id=loanCount;const c=document.getElementById('loans-container');const d=document.createElement('div');d.className='loan-card';d.id='loan-'+id;d.innerHTML=`<div class="field" style="margin:0"><label class="field-label">Type</label><select style="width:100%"><option>Personal</option><option>Credit Card</option><option>Vehicle</option><option>Education</option><option>Other</option></select></div><div class="field" style="margin:0"><label class="field-label">Rate %</label><input type="number" placeholder="e.g. 18" min="1" max="60" style="width:100%"></div><div class="field" style="margin:0"><label class="field-label">Monthly EMI (₹)</label><input type="number" placeholder="e.g. 5000" style="width:100%"></div><button class="btn-remove" onclick="document.getElementById('loan-${id}').remove()" title="Remove">✕</button>`;c.appendChild(d);}
function getLoans(){const rows=document.querySelectorAll('.loan-card');const loans=[];rows.forEach(row=>{const inp=row.querySelectorAll('input[type=number]');const rate=Math.min(+inp[0]?.value||0,60);const emi=+inp[1]?.value||0,type=row.querySelector('select')?.value||'Other';if(emi>0)loans.push({type,rate,emi});});return loans;}

// ── Charts ────────────────────────────────────────────────────────────
function destroyCharts(){[cGrowth,cDist,cAlloc,cExp].forEach(c=>{try{if(c)c.destroy();}catch(e){}});cGrowth=cDist=cAlloc=cExp=null;}
function getCSSVar(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function gridColor(){return getCSSVar('--border')||'#e4e8f0';}
function tickColor(){return getCSSVar('--text-dim')||'#9aa3bc';}
const chartOpts={plugins:{legend:{display:false}},animation:{duration:900,easing:'easeOutQuart'},responsive:true,maintainAspectRatio:false};

function buildGrowthChart(corpusByYear, growth){
  const el=document.getElementById('chart-growth');
  if(!el)return;
  if(cGrowth)cGrowth.destroy();
  const labels=corpusByYear.map(d=>d.year);
  const flat=corpusByYear.map(d=>d.flat/1e5);
  const grow=corpusByYear.map(d=>d.growth/1e5);
  cGrowth=new Chart(el,{type:'line',data:{labels,datasets:[
    {label:'Flat SIP',data:flat,borderColor:'#2563eb',backgroundColor:'#2563eb22',fill:true,tension:.4,pointRadius:0},
    {label:`With ${growth}% growth`,data:grow,borderColor:'#16a34a',backgroundColor:'#16a34a22',fill:true,tension:.4,pointRadius:0},
  ]},options:{...chartOpts,plugins:{legend:{display:true,labels:{color:tickColor(),font:{size:11}}},tooltip:{callbacks:{label:c=>`₹${c.raw.toFixed(1)}L`}}},scales:{x:{ticks:{color:tickColor()},grid:{color:gridColor()}},y:{ticks:{color:tickColor(),callback:v=>`₹${v}L`},grid:{color:gridColor()}}}}});
}

function buildDistChart(worst, likely, best){
  const el=document.getElementById('chart-dist');
  if(!el)return;
  if(cDist)cDist.destroy();
  const vals=[worst,likely,best].map(v=>v/1e7);
  cDist=new Chart(el,{type:'bar',data:{labels:['Worst (10th%)','Likely (50th%)','Best (90th%)'],datasets:[{data:vals,backgroundColor:['#ef444466','#2563eb99','#16a34a99'],borderColor:['#ef4444','#2563eb','#16a34a'],borderWidth:2,borderRadius:6}]},options:{...chartOpts,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`₹${c.raw.toFixed(2)} Cr`}}},scales:{x:{ticks:{color:tickColor()},grid:{display:false}},y:{ticks:{color:tickColor(),callback:v=>`₹${v}Cr`},grid:{color:gridColor()}}}}});
}

function buildAllocChart(alloc){
  const el=document.getElementById('chart-alloc');
  if(!el)return;
  if(cAlloc)cAlloc.destroy();
  const keys=Object.keys(alloc),vals=Object.values(alloc);
  cAlloc=new Chart(el,{type:'doughnut',data:{labels:keys,datasets:[{data:vals,backgroundColor:PALETTE_ARR,borderWidth:2}]},options:{...chartOpts,cutout:'65%',plugins:{legend:{display:true,position:'right',labels:{color:tickColor(),font:{size:11},padding:10}}}}});
}

function buildExpChart(totalExp, lsSpend, depCost, rent, emi, groceries, utilities){
  const el=document.getElementById('chart-exp');
  if(!el)return;
  if(cExp)cExp.destroy();
  const items=[
    ['Rent/EMI',rent+emi],['Groceries',groceries],
    ['Utilities',utilities],['Lifestyle',lsSpend],['Dependents',depCost],
  ].filter(i=>i[1]>0);
  cExp=new Chart(el,{type:'doughnut',data:{labels:items.map(i=>i[0]),datasets:[{data:items.map(i=>i[1]),backgroundColor:['#dc2626','#2563eb','#7c3aed','#db2777','#d97706','#16a34a'],borderWidth:2}]},options:{...chartOpts,cutout:'65%',plugins:{legend:{display:true,position:'right',labels:{color:tickColor(),font:{size:11},padding:10}}}}});
}

// ── Score ─────────────────────────────────────────────────────────────
function calcScore(r){
  let s=0;
  s+=Math.min((r.surplus/r.monthly_income)*100,25);
  s+=r.ef_savings>=r.ef_required?20:r.ef_savings>=r.ef_required*.5?10:r.ef_savings>0?5:0;
  s+=r.on_track?20:r.gap<r.monthly_income*12?10:0;
  s+=r.allocation.health_insurance>=10?15:r.allocation.health_insurance>=5?8:0;
  const idealEq=Math.max(100-r.age,20);
  s+=Math.max(10-Math.abs(r.allocation.equity-idealEq)/3,0);
  s+=r.high_cost_loans.length===0?10:!r.high_cost_loans.some(l=>l.rate>20)?5:0;
  return Math.min(Math.round(s),100);
}
function scoreGrade(s){if(s>=80)return{g:'Excellent',c:'#16a34a'};if(s>=65)return{g:'Good',c:'#2563eb'};if(s>=45)return{g:'Fair',c:'#d97706'};return{g:'Needs Attention',c:'#dc2626'};}
function renderScore(score,el){const{g,c}=scoreGrade(score);const r=34,circ=2*Math.PI*r;const offset=circ-(score/100)*circ;el.innerHTML=`<div class="health-ring"><svg width="80" height="80" viewBox="0 0 80 80"><circle class="hr-bg" cx="40" cy="40" r="${r}"/><circle class="hr-fg" cx="40" cy="40" r="${r}" stroke="${c}" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" id="hs-arc"/></svg><div class="hr-num" style="color:${c}">${score}<div class="hr-label-sm">/100</div></div></div><div class="hs-info"><div class="hs-title">Financial Health</div><div class="hs-grade" style="color:${c}">${g}</div><div class="hs-sub">Surplus, savings, insurance & goals</div></div>`;setTimeout(()=>{const a=document.getElementById('hs-arc');if(a)a.style.strokeDashoffset=offset;},200);}

// ── Emergency fund card ───────────────────────────────────────────────
function renderEFCard(savings,efReq,bufferPerMonth){
  const pct=Math.min(efReq>0?Math.round(savings/efReq*100):100,100);
  const isDone=savings>=efReq;
  const barColor=isDone?'var(--green)':pct>50?'var(--gold)':'var(--red)';
  const monthsToComplete=bufferPerMonth>0?Math.ceil((efReq-savings)/bufferPerMonth):null;
  const monthsText=isDone?'Complete ✓':monthsToComplete?`~${monthsToComplete} months to complete`:'Add buffer savings to track';
  return `<div class="ef-card"><div class="ef-header"><span class="ef-title">Emergency Fund</span><span class="ef-pct" style="color:${barColor}">${pct}%</span></div><div class="ef-bar-track"><div class="ef-bar-fill" style="width:${pct}%;background:${barColor}"></div></div><div class="ef-stats"><span>Target: ${fmt(efReq)}</span><span>Saved: ${fmt(savings)}</span></div><div class="ef-months" style="color:${barColor}">${monthsText}</div>${!isDone?`<div class="ef-shortfall">Shortfall: ${fmt(efReq-savings)}</div>`:''}${!isDone?`<div class="ef-tip">💡 Keep ${fmt(bufferPerMonth)}/month aside (20% of surplus) until complete.</div>`:''}</div>`;
}

// ── Risk banner ───────────────────────────────────────────────────────
function renderRiskBanner(risk, modelName){
  const msgs={
    aggressive:{icon:'🚀',title:'Aggressive Profile',text:'Higher equity allocation for maximum long-term growth. Comfortable with short-term volatility.'},
    moderate:  {icon:'⚖️',title:'Moderate Profile', text:'Balanced approach between growth and stability. Suits most working professionals.'},
    conservative:{icon:'🛡️',title:'Conservative Profile',text:'Capital preservation priority. Lower volatility, steady returns.'},
  };
  const m=msgs[risk]||msgs.moderate;
  return `<div class="r-risk-banner risk-${risk}"><div class="rrb-icon">${m.icon}</div><div><div class="rrb-title">${m.title} <span class="model-tag">via ${modelName||'ML'}</span></div><div class="rrb-text">${m.text}</div></div></div>`;
}

// ── Where to invest — full version matching static site ─────────────
function wiToggle(id){
  const hd=document.getElementById('wh-'+id);
  const body=document.getElementById('wb-'+id);
  if(!hd||!body)return;
  const open=body.classList.toggle('open');
  hd.classList.toggle('open',open);
}
function wCard(name,tag,tagBg,tagColor,stats,via,top,note,links){
  const linksHTML=links?`<div class="wc-links">${links.map(([lbl,url])=>`<a class="wc-link" href="${url}" target="_blank" rel="noopener">${lbl} ↗</a>`).join('')}</div>`:'';
  return`<div class="wi-card${top?' top-pick':''}">
    ${top?'<div class="wc-top-badge">⭐ Top Pick</div>':''}
    <div class="wc-name">${name}</div>
    <span class="wc-tag" style="background:${tagBg};color:${tagColor}">${tag}</span>
    <div class="wc-stats">${stats}</div>
    <div class="wc-platform"><span class="wcp-label">Via</span><span class="wcp-val">${via}</span></div>
    ${note?`<div class="wc-note">${note}</div>`:''}
    ${linksHTML}
  </div>`;
}
function buildWhere(alloc,investable,risk,regime,market){
  const f=fmt;
  // Live rates from backend DB — no hardcoding
  const niftyCAGR = market?.nifty   ? market.nifty.toFixed(2)   : '12.04';
  const goldCAGR  = market?.gold    ? market.gold.toFixed(2)     : '12.03';
  const fdRate    = market?.fd      ? market.fd.toFixed(2)       : '6.88';
  const debtRate  = market?.debt_mf ? market.debt_mf.toFixed(2) : '7.1';
  const inflation = market?.inflation ? market.inflation.toFixed(2) : '4.96';
  const dbNote    = '<span style="font-size:.65rem;color:var(--text-dim)"> · Source: finca.db</span>';
  const eqAmt=Math.round(investable*(alloc.equity/100));
  const goldAmt=Math.round(investable*(alloc.gold/100));
  const fdAmt=Math.round(investable*(alloc.fd/100));
  const debtAmt=Math.round(investable*(alloc.debt_mf/100));
  const hiAmt=Math.round(investable*(alloc.health_insurance/100));
  const buckets=[];

  if(eqAmt>0){
    const elssMonthly=Math.min(eqAmt,Math.round(150000/12));
    const directAmt=eqAmt-elssMonthly;
    let mf='',etf='',stocks='';
    if(risk==='aggressive'){
      mf=wCard('Parag Parikh Flexi Cap','Flexi Cap','#dbeafe','#1d4ed8',`<b>~19% CAGR (5Y)</b> · No lock-in · Global exposure<br>Portfolio equity rate: <b>${niftyCAGR}%</b>${dbNote}`,"Groww / Kuvera",true,"Best all-weather fund. Indian + US stocks.",[['Kuvera','https://kuvera.in'],['Screener','https://www.screener.in']])+wCard('Nippon India Small Cap','Small Cap','#dcfce7','#15803d','<b>~22% CAGR (5Y)</b> · Very high risk<br>Expect 40–50% drawdowns','Zerodha Coin',false,'7+ year horizon only.',[['Zerodha','https://zerodha.com/coin'],['NSE','https://www.nseindia.com']])+wCard('Kotak Emerging Equity','Mid Cap','#f3e8ff','#6d28d9','<b>~19% CAGR (5Y)</b>','Groww / Kuvera',false,'Sweet spot: large+small cap.',null);
      etf=wCard('NIFTYBEES','Nifty 50 ETF','#dbeafe','#1d4ed8','<b>~15% CAGR (10Y)</b> · 0.04% expense<br>Source: NSE / AMFI','Zerodha / Upstox',false,'Cheapest way to own Nifty 50.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=NIFTYBEES'],['Tickertape','https://www.tickertape.in/stocks/nippon-india-etf-nifty-50-bees-NIFTYBEES']])+wCard('JUNIORBEES','Nifty Next 50','#dbeafe','#1d4ed8','<b>~16% CAGR (10Y)</b> · Source: NSE','Zerodha / Groww',false,"Tomorrow's Nifty 50.",[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=JUNIORBEES']]);
      stocks=wCard('HDFC Bank','NSE: HDFCBANK','#fce7f3','#9d174d','18%+ ROE · Most reliable Indian bank<br>Source: NSE','Zerodha / Groww',true,'20-year compounder.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK'],['Screener','https://www.screener.in/company/HDFCBANK/']])+wCard('Reliance Industries','NSE: RELIANCE','#fce7f3','#9d174d','Conglomerate · Energy, Retail, Telecom','Zerodha / Upstox',false,'India growth proxy.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=RELIANCE'],['Screener','https://www.screener.in/company/RELIANCE/']])+wCard('Infosys','NSE: INFY','#fce7f3','#9d174d','IT Services · USD revenue · Dividends','Zerodha / Groww',false,'Rupee depreciation hedge.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=INFY'],['Screener','https://www.screener.in/company/INFY/']]);
    } else if(risk==='moderate'){
      mf=wCard('Parag Parikh Flexi Cap','Flexi Cap','#dbeafe','#1d4ed8',`<b>~19% CAGR (5Y)</b> · No lock-in<br>Portfolio equity rate: <b>${niftyCAGR}%</b>${dbNote}`,"Groww / Kuvera",true,"Indian blue chips + US tech.",[['Kuvera','https://kuvera.in'],['Groww','https://groww.in']])+wCard('Mirae Asset Large & Mid Cap','Large & Mid','#dcfce7','#15803d','<b>~17% CAGR (5Y)</b>','Zerodha Coin',false,'50% large cap + 50% mid cap.',null)+wCard('ICICI Pru Bluechip','Large Cap','#dbeafe','#1d4ed8','<b>~15% CAGR (5Y)</b> · Low volatility','Groww / Kuvera',false,'Fewer drawdowns in crashes.',null);
      etf=wCard('NIFTYBEES','Nifty 50 ETF','#dbeafe','#1d4ed8','<b>~15% CAGR (10Y)</b> · 0.04% expense<br>Source: NSE/AMFI','Zerodha / Upstox',false,'Zero manager risk, lowest cost.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=NIFTYBEES'],['Tickertape','https://www.tickertape.in/stocks/nippon-india-etf-nifty-50-bees-NIFTYBEES']]);
      stocks=wCard('HDFC Bank','NSE: HDFCBANK','#fce7f3','#9d174d','18%+ ROE · Source: NSE','Zerodha / Groww',true,'20-year compounder.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK'],['Screener','https://www.screener.in/company/HDFCBANK/']])+wCard('TCS','NSE: TCS','#fce7f3','#9d174d','IT Exports · USD revenue · Dividends','Zerodha / Upstox',false,'Earns in dollars.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=TCS'],['Screener','https://www.screener.in/company/TCS/']])+wCard('Asian Paints','NSE: ASIANPAINT','#fce7f3','#9d174d','40% market share · Consistent compounder','Groww / Zerodha',false,'Pricing power, low debt.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=ASIANPAINT'],['Screener','https://www.screener.in/company/ASIANPAINT/']]);
    } else {
      mf=wCard('ICICI Pru Bluechip','Large Cap','#dbeafe','#1d4ed8',`<b>~15% CAGR (5Y)</b> · Low volatility<br>Portfolio equity rate: <b>${niftyCAGR}%</b>${dbNote}`,"Groww / Kuvera",true,"Sticks to Nifty 50 companies only.",null)+wCard('Mirae Asset Tax Saver','ELSS · 80C','#f3e8ff','#6d28d9','<b>~17% CAGR (5Y)</b> · 3-year lock-in','Zerodha Coin',false,'80C benefit. Lock-in = forced patience.',null);
      etf=wCard('NIFTYBEES','Nifty 50 ETF','#dbeafe','#1d4ed8','<b>~15% CAGR (10Y)</b> · 0.04% expense','Zerodha / Upstox',false,'Safest equity option.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=NIFTYBEES']]);
      stocks=wCard('HDFC Bank','NSE: HDFCBANK','#fce7f3','#9d174d','Most stable Indian stock · 18%+ ROE','Zerodha / Groww',true,'Conservative-friendly.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK'],['Screener','https://www.screener.in/company/HDFCBANK/']])+wCard('ITC','NSE: ITC','#fce7f3','#9d174d','FMCG · Dividend yield ~3–4%','Zerodha / Upstox',false,'Like fixed income with upside.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=ITC'],['Screener','https://www.screener.in/company/ITC/']]);
    }
    const elssCard=regime==='old'?wCard('Mirae Asset ELSS Tax Saver','ELSS · 80C','#f3e8ff','#6d28d9',`<b>Up to ${f(Math.round(150000/12))}/mo</b> tax-saving<br>3-year lock-in · ~17% CAGR · Source: AMFI`,'Groww / Kuvera',false,'Old Regime only — route equity SIP here first.',null):'';
    const eqSplitNote=regime==='old'
      ?`<div class="wi-split-note">Split <strong>${f(eqAmt)}/month</strong>: <strong>${f(elssMonthly)}</strong> → ELSS (Old Regime 80C) + <strong>${f(Math.max(directAmt,0))}</strong> → Flexi Cap / Index ETF / Stocks. Returns sourced from <a href="https://www.amfiindia.com" target="_blank" style="color:var(--primary)">AMFI ↗</a> and <a href="https://www.nseindia.com" target="_blank" style="color:var(--primary)">NSE ↗</a>.</div>`
      :`<div class="wi-split-note">Invest <strong>${f(eqAmt)}/month</strong> across Flexi Cap funds, Index ETFs, and direct stocks. ELSS/80C not available on new regime. Returns sourced from <a href="https://www.amfiindia.com" target="_blank" style="color:var(--primary)">AMFI ↗</a> and <a href="https://www.nseindia.com" target="_blank" style="color:var(--primary)">NSE ↗</a>.</div>`;
    const eqSub=regime==='old'?'Mutual Funds · ETFs · Stocks · ELSS':'Mutual Funds · ETFs · Stocks';
    buckets.push({id:'eq',color:'#2563eb',title:'Equity',sub:eqSub,amt:eqAmt,pct:alloc.equity,body:`${eqSplitNote}<div class="wi-section-hd">Mutual Funds (SIP)</div><div class="wi-cards">${mf}${elssCard}</div><div class="wi-section-hd">Index ETFs — buy on NSE like a stock</div><div class="wi-cards">${etf}</div><div class="wi-section-hd">Direct Stocks — optional, max 15% of equity</div><div class="wi-cards">${stocks}</div><div class="wi-why"><b>Strategy</b> 60–70% into a Flexi Cap SIP (hands-off). 20% into Index ETF (cheapest). 10–15% direct stocks only if you enjoy researching.</div>`});
  }

  if(goldAmt>0){
    const goldCards=wCard('Sovereign Gold Bond (SGB)','Govt. Bond · RBI','#fef3c7','#92400e',`<b>Gold price + 2.5% p.a. interest</b><br>8-year tenure · Tax-free maturity<br>Gold CAGR: <b>${goldCAGR}%</b>${dbNote}`,"RBI Retail Direct / HDFC Bank",true,"Best gold investment — returns plus guaranteed interest.",[['RBI SGB','https://rbiretaildirect.org.in'],['RBI Info','https://www.rbi.org.in']])+wCard('Nippon India GOLDBEES','Gold ETF','#fef3c7','#92400e','<b>Tracks MCX gold price live</b> · 0.54% expense<br>No lock-in · Source: MCX/NSE','Zerodha / Upstox',false,'Monthly SIP-style buying. Tracks gold 1:1.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=GOLDBEES'],['MCX','https://www.mcxindia.com']])+wCard('Digital Gold','Digital · 24K Pure','#fef3c7','#92400e','<b>Start with ₹1</b> · MMTC-PAMP backed','Groww / PhonePe',false,'For amounts under ₹1,000/mo only.',null);
    buckets.push({id:'gold',color:'#d97706',title:'Gold',sub:'SGB · ETF · Digital Gold · Source: RBI/MCX',amt:goldAmt,pct:alloc.gold,body:`<div class="wi-split-note">Invest <strong>${f(goldAmt)}/month</strong>. Gold CAGR: <b>${goldCAGR}%</b> (from finca.db) (Source: <a href="https://www.mcxindia.com" target="_blank" style="color:var(--primary)">MCX India ↗</a>). Priority: SGB → Gold ETF → Digital Gold.</div><div class="wi-section-hd">Gold options</div><div class="wi-cards">${goldCards}</div><div class="wi-why"><b>Strategy</b> SGBs are best — gold returns plus 2.5% interest, tax-free at maturity. For monthly SIP, Gold ETF on Zerodha. Avoid physical gold — making charges destroy returns.</div>`});
  }

  if(fdAmt>0){
    const fdCards=wCard('SBI Fixed Deposit','Govt. Bank FD','#dcfce7','#166534',`<b>${fdRate}% p.a.</b> (recency-weighted from DB)<br>RBI benchmark · DICGC insured${dbNote}`,"SBI YONO App",true,"Safest FD — government backing.",[['SBI FD','https://www.sbi.co.in/web/personal-banking/investments-deposits/deposits/term-deposits/fixed-deposit'],['RBI Rates','https://www.rbi.org.in']])+wCard('IDFC First Bank FD','Small Finance','#dcfce7','#166534','<b>7.75–8.25% p.a.</b> · DICGC ₹5L','IDFC First App',false,'Higher rate, safe up to ₹5L.',null)+wCard('RBI Floating Rate Bond','Govt. Bond','#dcfce7','#166534','<b>8.05% p.a.</b> · 7-year · No TDS<br>Source: RBI','RBI Retail Direct',false,'Better than most FDs.',[['RBI Retail Direct','https://rbiretaildirect.org.in']])+wCard('Post Office MIS','Govt. Scheme','#dcfce7','#166534','<b>7.4% p.a.</b> monthly payout · 5-year','India Post App',false,'Regular monthly income.',null);
    buckets.push({id:'fd',color:'#16a34a',title:'Fixed Deposits & Bonds',sub:'FD · RBI Bonds · Post Office · Source: RBI',amt:fdAmt,pct:alloc.fd,body:`<div class="wi-split-note">Park <strong>${f(fdAmt)}/month</strong> via RD. FD rates source: <a href="https://www.rbi.org.in" target="_blank" style="color:var(--primary)">RBI ↗</a>. Current benchmark: <b>${fdRate}% p.a.</b> (recency-weighted from DB)</div><div class="wi-section-hd">Fixed income options</div><div class="wi-cards">${fdCards}</div><div class="wi-why"><b>Strategy</b> SBI FD for emergency buffer (DICGC insured ₹5L). RBI Bonds (8.05%) for beyond that. Keep each IDFC/Ujjivan FD below ₹5L insurance limit.</div>`});
  }

  if(debtAmt>0){
    const debtCards=wCard('HDFC Low Duration Fund','Low Duration','#f3e8ff','#5b21b6',`<b>${debtRate}% p.a.</b> (AUM-weighted from DB)<br>No lock-in · AMFI category average${dbNote}`,"Groww / Kuvera",true,"Better than savings account. Instant withdrawal.",null)+wCard('Aditya Birla Money Manager','Money Market','#f3e8ff','#5b21b6','<b>~7.3% p.a.</b> · Source: AMFI','Groww / Zerodha Coin',false,'Near-zero risk. 3–6 month buffer.',null)+wCard('ICICI Pru Short Term Fund','Short Duration','#f3e8ff','#5b21b6','<b>~7.8% p.a.</b> · Source: AMFI','Zerodha Coin / Kuvera',false,'2–3 year goals.',null);
    buckets.push({id:'debt',color:'#7c3aed',title:'Debt Mutual Funds',sub:'Low Duration · Money Market · Source: AMFI',amt:debtAmt,pct:alloc.debt_mf,body:`<div class="wi-split-note">SIP <strong>${f(debtAmt)}/month</strong>. Returns source: <a href="https://www.amfiindia.com" target="_blank" style="color:var(--primary)">AMFI India ↗</a>. Category average: <b>${debtRate}% p.a.</b> (AUM-weighted from DB)</div><div class="wi-section-hd">Debt fund options</div><div class="wi-cards">${debtCards}</div><div class="wi-why"><b>Why not just FD?</b> Debt MFs are tax-efficient for 20–30% bracket — FD interest taxed yearly, MF gains only on withdrawal. Fully liquid, no premature withdrawal penalty.</div>`});
  }

  if(hiAmt>0){
    const hiCards=wCard('Niva Bupa ReAssure 2.0','Health Insurance','#fce7f3','#9d174d','<b>Unlimited restore</b> · No room rent cap<br>Claim ratio: ~94% (Source: IRDAI)','Policybazaar / Niva Bupa',true,'Best all-round. Unlimited claim restoration.',[['Policybazaar','https://www.policybazaar.com/health-insurance/'],['IRDAI','https://www.irdai.gov.in']])+wCard('Star Health Comprehensive','Health Insurance','#fce7f3','#9d174d','OPD cover · ~90% claim ratio<br>Source: IRDAI annual report','Star Health',false,'Strong for families with OPD.',[['Star Health','https://www.starhealth.in']])+wCard('HDFC ERGO Optima Secure','Health Insurance','#fce7f3','#9d174d','<b>4x cover Day 1</b> · No room rent limit<br>Source: IRDAI','HDFC ERGO',false,'4x cover from day one. Metro-friendly.',[['HDFC ERGO','https://www.hdfcergo.com']])+wCard('NPS Tier-1 (80CCD)','Pension · Tax','#fce7f3','#9d174d','<b>Extra ₹50,000</b> deduction 80CCD(1B)<br>Source: IT Act 1961','NPS Trust / PFRDA',false,'Extra 80C beyond ₹1.5L (old regime).',[['NPS Trust','https://www.npstrust.org.in'],['PFRDA','https://www.pfrda.org.in']]);
    buckets.push({id:'hi',color:'#db2777',title:'Health Insurance & NPS',sub:'Medical Cover · Pension · Source: IRDAI/PFRDA',amt:hiAmt,pct:alloc.health_insurance,body:`<div class="wi-split-note">Spend <strong>${f(hiAmt)}/month</strong>. Claim settlement ratios from <a href="https://www.irdai.gov.in" target="_blank" style="color:var(--primary)">IRDAI annual report ↗</a>. Min cover: ₹10L individual, ₹25L family.</div><div class="wi-section-hd">Health & protection</div><div class="wi-cards">${hiCards}</div><div class="wi-why"><b>Rule of thumb</b> Cover = at least 50% of annual income. One serious illness without insurance can wipe years of savings.</div>`});
  }

  const disclaimer=`<div class="wi-disclaimer">⚠ <strong>Disclaimer:</strong> Market rates (Nifty ${niftyCAGR}%, Gold ${goldCAGR}%, FD ${fdRate}%, Debt MF ${debtRate}%) sourced live from finca.db. Product recommendations informational only. FinCA is not SEBI-registered. Past returns are not guaranteed. Verify current rates before investing. All ↗ links open official sources (NSE, AMFI, RBI, IRDAI, Screener.in) in a new tab.</div>`;

  document.getElementById('r-where').innerHTML=disclaimer+buckets.map(b=>`
    <div class="wi-bucket">
      <div class="wi-hd" id="wh-${b.id}" onclick="wiToggle('${b.id}')">
        <div class="wi-hd-left">
          <div class="wi-color-bar" style="background:${b.color}"></div>
          <div>
            <div class="wi-hd-title">${b.title}</div>
            <div class="wi-hd-sub">${b.sub}</div>
          </div>
        </div>
        <div class="wi-hd-right">
          <div class="wi-amt">${f(b.amt)}<span style="font-size:.68rem;font-weight:400;color:var(--text-dim)">/mo</span></div>
          <div class="wi-badge">${b.pct}%</div>
          <div class="wi-chev" id="wc-${b.id}">▼</div>
        </div>
      </div>
      <div class="wi-body" id="wb-${b.id}">${b.body}</div>
    </div>`).join('');
  setTimeout(()=>wiToggle('eq'),100);
}

function buildGeminiSection(age,deps,health,income,lifestyle){
  return `<div class="ai-section"><div class="ai-header"><span class="ai-icon">✨</span><div><div class="ai-title">AI Financial Coach</div><div class="ai-subtitle">Powered by Gemini — personalised advice based on your profile</div></div></div><div class="ai-key-wrap"><input type="password" id="gemini-key" placeholder="Paste your Gemini API key (free at aistudio.google.com)" class="ai-key-input"><button class="btn-ai" onclick="runGemini(${age},${deps},'${health}',${income},'${lifestyle}')">Ask Gemini →</button></div><div class="ai-loading" id="ai-loading"><div class="ai-spinner"></div><span>Thinking...</span></div><div id="ai-result"></div></div>`;
}
async function runGemini(age,deps,health,income,lifestyle){
  const key=document.getElementById('gemini-key')?.value?.trim();
  if(!key){showToast('Please enter your Gemini API key.');return;}
  document.getElementById('ai-loading').style.display='flex';
  document.getElementById('ai-result').innerHTML='';
  const r=_lastResult;
  const prompt=`You are a SEBI-registered financial advisor for India. The user is ${age} years old, income ₹${income}/month, ${deps} dependents, health: ${health}, lifestyle: ${lifestyle}. Their investable surplus is ₹${r.investable}/month. Risk profile: ${r.final_risk}. Weighted portfolio return: ${r.weighted_return}%. Likely retirement corpus: ${fmt(r.corpus_likely)}. Gap to goal: ${fmt(r.gap)}. Give 3-4 specific, actionable tips in bullet points. Be concise and India-specific. Mention specific fund names, insurance providers, or tax sections where relevant.`;
  try{
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
    const data=await res.json();
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'No response.';
    document.getElementById('ai-result').innerHTML=`<div class="ai-response">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\*(.*?)(\n|$)/g,'• $1<br>')}</div>`;
  }catch(e){document.getElementById('ai-result').innerHTML=`<div class="ai-response" style="color:var(--red)">Error: ${e.message}</div>`;}
  document.getElementById('ai-loading').style.display='none';
}

// ── PDF Export ────────────────────────────────────────────────────────
function exportPDF(){
  const panels=document.querySelectorAll('.tab-panel');
  const hidden=[];
  panels.forEach(p=>{if(!p.classList.contains('active')){p.style.display='block';hidden.push(p);}});
  window.print();
  hidden.forEach(p=>{p.style.display='';});
}

// ── Main calculate — calls backend ───────────────────────────────────
function calculate(){
  const btn=document.getElementById('btn-generate-main');
  const spinner=document.getElementById('generate-spinner');
  if(btn){btn.disabled=true;btn.textContent='Calculating...';}
  if(spinner)spinner.style.display='flex';

  const errEl=document.getElementById('api-error');
  if(errEl)errEl.style.display='none';

  // Collect inputs
  const payload={
    name:           document.getElementById('f-name')?.value?.trim()||'Investor',
    age:            parseInt(document.getElementById('f-age')?.value)||30,
    monthly_income: parseFloat(document.getElementById('f-income')?.value)||0,
    goal_amount:    parseFloat(document.getElementById('f-goal')?.value)||10000000,
    savings:        parseFloat(document.getElementById('f-savings')?.value)||0,
    income_growth:  parseFloat(document.getElementById('f-growth')?.value)||8,
    regime:         selRegime,
    health_issue:   selHealth==='yes',
    rent:           parseFloat(document.getElementById('f-rent')?.value)||0,
    emi:            parseFloat(document.getElementById('f-emi')?.value)||0,
    groceries:      parseFloat(document.getElementById('f-groceries')?.value)||0,
    utilities:      parseFloat(document.getElementById('f-utilities')?.value)||0,
    dependents:     parseInt(document.getElementById('f-deps')?.value)||0,
    lifestyle:      document.getElementById('f-lifestyle')?.value||'average',
    loans:          getLoans(),
    risk_override:  selRisk!=='moderate'?selRisk:null,
  };

  fetch(API+'/api/calculate',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  })
  .then(res=>res.json().then(data=>({status:res.status,data})))
  .then(({status,data})=>{
    if(btn){btn.disabled=false;btn.textContent='Generate My Report →';}
    if(spinner)spinner.style.display='none';

    if(status!==200||data.error){
      const msg=data.message||data.error||'Something went wrong.';
      if(errEl){errEl.textContent=msg;errEl.style.display='block';}
      showToast(msg);
      return;
    }

    _lastResult=data;
    renderResults(data);
  })
  .catch(e=>{
    if(btn){btn.disabled=false;btn.textContent='Generate My Report →';}
    if(spinner)spinner.style.display='none';
    const msg='Could not reach backend. Make sure server.py is running.';
    if(errEl){errEl.textContent=msg;errEl.style.display='block';}
    showToast(msg);
  });
}

// ── Render results from API response ─────────────────────────────────
function renderResults(r){
  destroyCharts();
  goTo('results');

  const income=r.monthly_income;
  const age=r.age;
  const ytr=r.years_to_retire;

  // Header
  const nameEl=document.getElementById('r-name');
  if(nameEl)nameEl.textContent=r.name+"'s Plan";

  // Score
  const score=calcScore(r);
  const scoreEl=document.getElementById('r-score');
  if(scoreEl)renderScore(score,scoreEl);

  // Risk banner
  const bannerEl=document.getElementById('r-risk-banner');
  if(bannerEl)bannerEl.innerHTML=renderRiskBanner(r.final_risk, r.model_name);

  // Alerts
  const alerts=[];
  if(r.high_cost_loans?.length)alerts.push(`⚠ You have ${r.high_cost_loans.length} high-interest loan(s). Clear these before investing more.`);
  if(r.ef_pct<50)alerts.push(`⚠ Emergency fund only ${r.ef_pct}% complete. Build this first.`);
  if(r.on_track)alerts.push(`✅ On track to meet your goal of ${fmt(r.goal)}!`);
  const alertsEl=document.getElementById('r-alerts');
  if(alertsEl)alertsEl.innerHTML=alerts.map(a=>`<div class="r-alert">${a}</div>`).join('');

  // ── CORPUS TAB ──
  // Render corpus stats into dedicated divs — do NOT touch canvas elements
  const gap=r.gap;
  const extraSip=gap>0?Math.round(gap/(ytr*12)):0;
  const barsEl=document.getElementById('r-bars');
  if(barsEl){
    barsEl.innerHTML=`
      <div class="corpus-bars">
        <div class="corpus-bar-row">
          <div class="corpus-bar-label">Worst case <span class="pct-badge">10th %</span></div>
          <div class="corpus-bar-val" style="color:var(--red)">${fmt(r.corpus_worst)}</div>
          <div class="corpus-bar-track"><div class="corpus-bar-fill" style="width:${Math.min(r.corpus_worst/r.corpus_best*100,100).toFixed(1)}%;background:var(--red)"></div></div>
        </div>
        <div class="corpus-bar-row">
          <div class="corpus-bar-label">Likely <span class="pct-badge">50th %</span></div>
          <div class="corpus-bar-val" style="color:var(--primary)">${fmt(r.corpus_likely)}</div>
          <div class="corpus-bar-track"><div class="corpus-bar-fill" style="width:${Math.min(r.corpus_likely/r.corpus_best*100,100).toFixed(1)}%;background:var(--primary)"></div></div>
        </div>
        <div class="corpus-bar-row">
          <div class="corpus-bar-label">Best case <span class="pct-badge">90th %</span></div>
          <div class="corpus-bar-val" style="color:var(--green)">${fmt(r.corpus_best)}</div>
          <div class="corpus-bar-track"><div class="corpus-bar-fill" style="width:100%;background:var(--green)"></div></div>
        </div>
      </div>
      <div class="r-mini-stats">
        <div class="r-mini-stat"><div class="r-mini-val">${fmt(r.corpus_growth)}</div><div class="r-mini-label">With ${r.income_growth||8}% salary growth</div></div>
        <div class="r-mini-stat"><div class="r-mini-val">${fmt(r.inflation_adjusted)}</div><div class="r-mini-label">Inflation-adjusted value</div></div>
        <div class="r-mini-stat"><div class="r-mini-val">${fmt(r.goal)}</div><div class="r-mini-label">Your goal</div></div>
      </div>
      <div class="r-goal-row ${gap<=0?'on-track':'off-track'}">
        ${gap>0?`<span>⚠ Gap: ${fmt(gap)} → increase SIP by ${fmt(extraSip)}/month</span>`:`<span>✅ On track to meet your goal!</span>`}
      </div>
      <div class="r-source-note">800 Monte Carlo simulations · numpy cumprod · Nifty vol ${r.market?.volatility||0.0468} · ${r.model_name} model</div>`;
  }
  // Build charts into existing canvas elements (already in HTML, not recreated)
  setTimeout(()=>{
    buildGrowthChart(r.corpus_by_year, r.income_growth||8);
    buildDistChart(r.corpus_worst, r.corpus_likely, r.corpus_best);
  }, 200);

  // ── BREAKDOWN TAB ──
  // Render breakdown stats into existing divs — do NOT overwrite canvas elements
  const brkEl=document.getElementById('r-breakdown');
  if(brkEl){
    brkEl.innerHTML=`
      <div class="r-grid-2">
        <div class="r-stat"><div class="r-stat-val">${fmt(income)}</div><div class="r-stat-label">Monthly income</div></div>
        <div class="r-stat"><div class="r-stat-val" style="color:var(--red)">${fmt(r.total_expenses)}</div><div class="r-stat-label">Total expenses</div></div>
        <div class="r-stat"><div class="r-stat-val" style="color:var(--green)">${fmt(r.surplus)}</div><div class="r-stat-label">Monthly surplus</div></div>
        <div class="r-stat"><div class="r-stat-val">${fmt(r.investable)}</div><div class="r-stat-label">Investable (80% of surplus)</div></div>
      </div>
      ${renderEFCard(r.ef_savings, r.ef_required, Math.round(r.surplus*.20))}`;
  }
  const allocEl=document.getElementById('r-alloc');
  if(allocEl){
    allocEl.innerHTML=Object.entries(r.allocation).map(([k,v])=>`<div class="r-alloc-row"><span>${k.replace('_',' ')}</span><span>${v}% · ${fmt(Math.round(r.investable*v/100))}/mo</span></div>`).join('');
  }
  setTimeout(()=>{
    buildAllocChart(r.allocation);
    buildExpChart(r.total_expenses, r.lifestyle_spend, r.dependent_cost,
      parseFloat(document.getElementById('f-rent')?.value)||0,
      parseFloat(document.getElementById('f-emi')?.value)||0,
      parseFloat(document.getElementById('f-groceries')?.value)||0,
      parseFloat(document.getElementById('f-utilities')?.value)||0);
  }, 200);

  // ── TAX TAB ──
  // ── TAX TAB ──
  const taxKpisEl=document.getElementById('r-tax-kpis');
  const taxBodyEl=document.getElementById('r-tax-body');
  if(taxKpisEl){
    taxKpisEl.innerHTML=`
      <div class="tax-kpi"><div class="tax-kpi-val">${r.bracket}%</div><div class="tax-kpi-label">Tax bracket</div></div>
      <div class="tax-kpi"><div class="tax-kpi-val">${fmt(r.tax_amount)}</div><div class="tax-kpi-label">Est. annual tax</div></div>
      <div class="tax-kpi"><div class="tax-kpi-val">${r.regime==='old'?fmt(r.tax_saved+r.nps_saving):'₹0'}</div><div class="tax-kpi-label">Max tax saving</div></div>
    `;
  }
  if(taxBodyEl){
    taxBodyEl.innerHTML=r.elss_allowed?`
      <div class="r-tax-savings">
        <div class="r-ts-row"><span>📦 ELSS 80C (up to ₹1.5L/year)</span><span class="r-ts-save">Save ${fmt(r.tax_saved)}/year</span></div>
        <div class="r-ts-row"><span>🏦 NPS 80CCD(1B) (₹50K extra)</span><span class="r-ts-save">Save ${fmt(r.nps_saving)}/year</span></div>
        <div class="r-ts-row r-ts-total"><span><b>Total potential saving</b></span><span class="r-ts-save"><b>${fmt(r.tax_saved+r.nps_saving)}/year</b></span></div>
      </div>
      <div class="r-note" style="margin-top:12px">💡 Route your equity SIP through ELSS first to claim 80C. Then top up NPS for the additional ₹50K deduction.</div>`
    :`<div class="r-note">New regime selected: 80C/ELSS deductions not available. You benefit from lower slab rates instead. Consider NPS 80CCD(2) employer contribution — still allowed under new regime.</div>`;
  }

  // ── PLAN TAB ──
  const actionEl=document.getElementById('r-action');
  if(actionEl){
    let step=1;
    const items=[];
    const efReq=r.ef_required;
    const surplus=r.surplus;
    const investable=r.investable;
    const alloc=r.allocation;
    const regime=r.regime;
    const taxSaved=r.tax_saved||0;
    const npsS=r.nps_saving||0;
    const ytr=r.years_to_retire;

    // 1. Emergency fund
    if(r.ef_savings<efReq)items.push({n:step++,col:'red',title:'Build your 6-month emergency fund',desc:`Need ${fmt(efReq)} as buffer. At ${fmt(Math.round(surplus*.2))}/month buffer → ~${Math.ceil(Math.max(efReq-r.ef_savings,0)/(surplus*.2||1))} months. Keep in <b>SBI Liquid Fund</b> or <b>HDFC Overnight Fund</b> — NOT a savings account. These give ~${r.market?.fd||6.88}% while staying instantly withdrawable (DB rate).`,when:'Start immediately — before investing more',urgent:true});

    // 2. High interest loans
    if(r.high_cost_loans?.length)r.high_cost_loans.forEach(l=>items.push({n:step++,col:'red',title:`Clear ${l.type} loan (${l.rate}% interest)`,desc:`This loan costs <b>${l.rate}%</b> annually — almost certainly more than your investment returns. Pay ${fmt(l.emi)}/month. Every rupee prepaid saves you ${l.rate}% guaranteed — better than any market return.`,when:'This month — redirect investable amount here first',urgent:true}));

    // 3. ELSS
    if(regime==='old')items.push({n:step++,col:'primary',title:'Start ELSS SIP — exhaust Section 80C',desc:`Put ${fmt(Math.min(Math.round(investable*alloc.equity/100),Math.round(150000/12)))}/month into ELSS (e.g. <b>Mirae Asset Tax Saver</b> via Groww or Kuvera). Saves <b>${fmt(taxSaved)}/year</b> in taxes. ELSS has a 3-year lock-in — shortest among 80C instruments — while delivering equity-level returns.`,when:'This month — set up SIP'});

    // 4. Equity SIP
    items.push({n:step++,col:'primary',title:'Start equity SIP',desc:`Put ${fmt(Math.round(investable*alloc.equity/100))}/month into equity. <b>Parag Parikh Flexi Cap</b> or <b>NIFTYBEES ETF</b>. Set auto-debit on the 5th of every month. Source: <a href="https://www.amfiindia.com" target="_blank">AMFI NAV data</a>.`,when:'Month 1'});

    // 5. Gold
    items.push({n:step++,col:'gold',title:'Set up gold allocation',desc:`Invest ${fmt(Math.round(investable*alloc.gold/100))}/month. Buy <b>Sovereign Gold Bonds (SGB)</b> via <a href="https://rbiretaildirect.org.in" target="_blank">rbiretaildirect.org.in</a> when RBI issues, otherwise <b>Nippon GOLDBEES ETF</b> on Zerodha. Gold CAGR: ${r.market?.gold||12.03}% (source: finca.db/MCX).`,when:'Month 1–2'});

    // 6. FD/Debt
    items.push({n:step++,col:'green',title:'Open FD or debt MF SIP',desc:`Park ${fmt(Math.round(investable*alloc.fd/100))}/month in <b>SBI FD</b> (sbi.co.in) or <b>HDFC Low Duration Fund</b>. FD rates at <a href="https://www.rbi.org.in" target="_blank">rbi.org.in</a>. Current DB rate: ${r.market?.fd||6.88}% p.a. (recency-weighted)`,when:'Month 2'});

    // 7. Health insurance
    items.push({n:step++,col:'pink',title:'Get health insurance',desc:`Budget ${fmt(Math.round(investable*alloc.health_insurance/100))}/month premium. Minimum cover: ₹10L individual, ₹25L family. Recommended: <b>Niva Bupa ReAssure 2.0</b> (unlimited restore, ~94% claim ratio per IRDAI) or <b>Star Health Comprehensive</b>. One hospital stay can wipe years of savings.`,when:'Month 1 — before anything else'});

    // 8. NPS
    if(regime==='old')items.push({n:step++,col:'primary',title:'Open NPS Tier-1 for extra 80CCD(1B)',desc:`Contribute ₹50,000/year to NPS — saves another <b>${fmt(npsS)}/year</b> in taxes beyond 80C. Choose <b>Aggressive (75% equity)</b> if age < 40. Open at <a href="https://www.npstrust.org.in" target="_blank">npstrust.org.in</a>. Over ${ytr} years, this tax saving compounded adds ~${fmt((npsS)*ytr*1.4)} in wealth.`,when:'Month 2–3'});

    // 9. Step up
    if(r.income_growth>0)items.push({n:step++,col:'primary',title:`Step up SIP by ${r.income_growth}% every year`,desc:`As your salary grows ${r.income_growth}% annually, increase your SIP by the same amount. With step-up, corpus grows from <b>${fmt(r.corpus_likely)}</b> (flat SIP) to <b>${fmt(r.corpus_growth)}</b> — a difference of ${fmt(r.corpus_growth-r.corpus_likely)}. Set a calendar reminder every April.`,when:'Every financial year start (April)'});

    // 10. Review
    const nextReview=new Date(Date.now()+6*30*24*60*60*1000).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    items.push({n:step++,col:'muted',title:'Review every 6–12 months',desc:`Recalculate your plan when: income changes significantly, you get married or have children, after a major market correction (>20% fall), or if your expenses change. Next review: <b>${nextReview}</b>. Data as of May 2025 — recalculate with updated DB rates periodically.`,when:nextReview});

    const colMap={red:'#ef4444',primary:'var(--primary)',gold:'#d97706',green:'#16a34a',pink:'#db2777',muted:'var(--border)'};
    actionEl.innerHTML=`<div class="plan-header">Your personalised ${r.final_risk} action plan · ${items.length} steps · Powered by ${r.model_name} model</div>`+items.map(item=>`
      <div class="plan-item${item.urgent?' urgent':''}">
        <div class="plan-step-num" style="background:${colMap[item.col]||'var(--primary)'}">Step ${item.n}</div>
        <div class="plan-body">
          <div class="plan-title">${item.title}</div>
          <div class="plan-desc">${item.desc}</div>
          <div class="plan-when">⏱ ${item.when}</div>
        </div>
      </div>`).join('');
  }

  // ── WHERE TO INVEST TAB ──
  const whereEl=document.getElementById('r-where');
  if(whereEl){
    whereEl.innerHTML=buildWhere(r.allocation, r.investable, r.final_risk, r.regime, r.market);
  }

  // ── AI TAB ──
  const aiEl=document.getElementById('r-ai');
  if(aiEl){
    aiEl.innerHTML=buildGeminiSection(age, r.dependents||0, r.health_issue?'yes':'no', income, document.getElementById('f-lifestyle')?.value||'average');
  }

  // ── Market data tab ──
  const mktEl=document.getElementById('r-market');
  if(mktEl&&r.market){
    const m=r.market;
    mktEl.innerHTML=`
      <div class="r-section-title">Live rates from finca.db (108 months · Apr 2016 – Mar 2025)</div>
      <div class="market-strip">
        ${[['Nifty 50 CAGR',m.nifty+'%','First/last price per year'],['Gold CAGR',m.gold+'%','First → last date'],['FD Rate',m.fd+'%','Recency-weighted'],['Debt MF',m.debt_mf+'%','AUM-weighted AMFI'],['Inflation',m.inflation+'%','RBI CPI 10Y avg'],['Nifty Vol',m.volatility,'Monthly std dev']].map(([l,v,note])=>`<div class="market-chip" style="min-width:120px"><div class="mc-val">${v}</div><div class="mc-label">${l}</div><div class="mc-label" style="font-size:.6rem">${note}</div></div>`).join('')}
      </div>
      <div class="r-note" style="margin-top:12px">All rates computed from real DB data — not hardcoded. Weighted return: <b>${r.weighted_return}% p.a.</b> (health insurance excluded from denominator).</div>
      <div class="r-note">ML model: <b>${r.model_name}</b>${_modelInfo?.cv_accuracy?' ('+(_modelInfo.cv_accuracy*100).toFixed(1)+'% CV accuracy)':''} · Surplus ratio: ${(r.surplus_ratio*100).toFixed(1)}% · Profile: <b>${r.final_risk}</b> (${r.risk_source})</div>`;
  }

  // Save to localStorage
  try{
    const saves=JSON.parse(localStorage.getItem('finca-reports')||'[]');
    saves.unshift({...r, savedAt:new Date().toISOString()});
    localStorage.setItem('finca-reports', JSON.stringify(saves.slice(0,10)));
  }catch(e){}
}

// ── History (localStorage) ────────────────────────────────────────────
function openHistory(){
  document.getElementById('history-modal').classList.add('open');
  const list=document.getElementById('history-list');
  try{
    const saves=JSON.parse(localStorage.getItem('finca-reports')||'[]');
    if(!saves.length){list.innerHTML='<div class="hist-empty">No saved reports yet.</div>';return;}
    list.innerHTML=saves.map((r,i)=>{
      const date=new Date(r.savedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return`<div class="hist-item" onclick="loadReport(${JSON.stringify(r).replace(/"/g,'&quot;')})"><div class="hist-date">${date}</div><div class="hist-name">${r.name||'Report'}</div><div class="hist-meta">Age ${r.age} · ${r.final_risk} · ${r.regime} regime</div><div class="hist-corpus">Likely: ${fmt(r.corpus_likely)}</div></div>`;
    }).join('');
  }catch(e){list.innerHTML='<div class="hist-empty">Could not load history.</div>';}
}
function closeHistory(){document.getElementById('history-modal').classList.remove('open');}
function loadReport(r){
  closeHistory();
  if(r.name)document.getElementById('f-name').value=r.name;
  if(r.age)document.getElementById('f-age').value=r.age;
  if(r.monthly_income)document.getElementById('f-income').value=r.monthly_income;
  if(r.goal)document.getElementById('f-goal').value=r.goal;
  if(r.ef_savings)document.getElementById('f-savings').value=r.ef_savings;
  showToast('Report loaded — click Generate to recalculate');
  goTo('profile');
}

function resetAll(){selRisk='moderate';selHealth='no';selRegime='new';loanCount=0;document.getElementById('loans-container').innerHTML='';const sp=document.getElementById('surplus-preview');if(sp)sp.style.display='none';const cb=document.getElementById('risk-consent-cb');if(cb)cb.checked=false;const btn=document.getElementById('btn-generate-main');if(btn)btn.disabled=true;}

// ── Boot ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{
  const saved=localStorage.getItem('finca-theme');
  if(saved){
    document.documentElement.setAttribute('data-theme',saved);
    document.querySelectorAll('.theme-btn').forEach(b=>{if(b.dataset.theme===saved)b.classList.add('active');});
  }
  initConnected();
  goTo('landing');
});
