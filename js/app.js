// FinCA — Main application logic
// Static frontend: all calculations run in browser

// Rates synced with Python backend (finca.db, 108 months 2016-2025)
const AVG_NIFTY=0.1204,AVG_GOLD=0.1203,AVG_FD=0.0688,AVG_DEBT=0.071,AVG_INF=0.0496;
const REAL_NIFTY_VOL=0.0468; // real monthly std dev from 108 months NSE data
const PALETTE_ARR=['#2563eb','#d97706','#16a34a','#7c3aed','#db2777'];
let selRisk='moderate',selHealth='no',selRegime='new',loanCount=0;
let cGrowth=null,cDist=null,cAlloc=null,cExp=null;
let _lastInputs={};

// ── THEME ─────────────────────────────────────────────────────────────
function setTheme(t,btn){document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');localStorage.setItem('finca-theme',t);}
(function(){const s=localStorage.getItem('finca-theme')||'light';document.documentElement.setAttribute('data-theme',s);setTimeout(()=>{const b=document.getElementById('tb-'+s);if(b){document.querySelectorAll('.theme-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');}},50);})();

// ── REGIME ───────────────────────────────────────────────────────────
function setRegime(r,btn){selRegime=r;document.querySelectorAll('.regime-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const note=document.getElementById('regime-note');if(note)note.innerHTML=r==='old'?'📌 <b>Old Regime:</b> Claim 80C (₹1.5L), HRA, 80D, 80CCD. Use if your total deductions exceed ₹3.75L/year.':'📌 <b>New Regime (default after 2023):</b> Lower tax slabs but cannot claim 80C/ELSS/HRA deductions. Good if deductions less than ₹3.75L/year.';}

// ── FORMAT ─────────────────────────────────────────────────────────────
function fmtIN(n){if(!n&&n!==0)return'—';const a=Math.abs(Math.round(n));const s=a.toString();let r='';if(s.length<=3){r=s;}else{r=s.slice(-3);let rem=s.slice(0,-3);while(rem.length>2){r=rem.slice(-2)+','+r;rem=rem.slice(0,-2);}if(rem.length)r=rem+','+r;}return(n<0?'-':'')+r;}
function fmt(n){if(n===undefined||n===null||isNaN(n))return'—';const a=Math.abs(n);if(a>=10000000)return'₹'+(n/10000000).toFixed(2)+' Cr';if(a>=100000)return'₹'+(n/100000).toFixed(2)+' L';return'₹'+fmtIN(n);}

// FIX: strip leading zeros on blur
function stripLeadingZero(el){if(el.value.length>1&&el.value.startsWith('0')&&!el.value.startsWith('0.')){el.value=String(parseFloat(el.value)||0);}updateSurplus();}

// ── TOAST ─────────────────────────────────────────────────────────────
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}

// ── VALIDATION ────────────────────────────────────────────────────────
function validateName(input){const ok=/^[a-zA-Z\s]*$/.test(input.value);document.getElementById('fg-name').classList.toggle('has-error',!ok&&input.value.length>0);return ok||input.value.length===0;}

// ── NAV ──────────────────────────────────────────────────────────────
function goTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  const order=['profile','expenses','loans','results'];
  const map={profile:'step-1',expenses:'step-2',loans:'step-3',results:'step-4'};
  const idx=order.indexOf(page);
  document.querySelectorAll('.nav-step').forEach(s=>{s.classList.remove('active','done');s.onclick=null;s.style.cursor='default';});
  order.forEach((p,i)=>{const el=document.getElementById(map[p]);if(!el)return;if(i<idx){el.classList.add('done');el.onclick=()=>goTo(p);el.style.cursor='pointer';}else if(i===idx)el.classList.add('active');});
}
function selectRadio(g,v,el){el.parentElement.querySelectorAll('.radio-card').forEach(e=>e.classList.remove('selected'));el.classList.add('selected');if(g==='risk')selRisk=v;if(g==='health')selHealth=v;}
function goToExpenses(){
  const name=document.getElementById('f-name').value.trim();
  const age=document.getElementById('f-age').value;
  const income=document.getElementById('f-income').value;
  if(!name){showToast('Please enter your name');return;}
  if(!/^[a-zA-Z\s]+$/.test(name)){showToast('Name should contain letters only');document.getElementById('fg-name').classList.add('has-error');return;}
  if(!age||+age<18||+age>59){showToast('Please enter a valid age between 18 and 59');return;}
  if(!income||+income<1){showToast('Please enter your monthly income');return;}
  goTo('expenses');updateSurplus();
}

// ── SURPLUS ───────────────────────────────────────────────────────────
function updateSurplus(){
  const income=+document.getElementById('f-income')?.value||0;
  const rent=+document.getElementById('f-rent')?.value||0;
  const emi=+document.getElementById('f-emi')?.value||0;
  const grocer=+document.getElementById('f-groceries')?.value||0;
  const utils=+document.getElementById('f-utilities')?.value||0;
  const deps=+document.getElementById('f-deps')?.value||0;
  const ls=document.getElementById('f-lifestyle')?.value||'average';
  const lsSpend={frugal:income*.05,average:income*.10,lavish:income*.20}[ls]||0;
  const depCost=deps*6000;
  const total=rent+emi+grocer+utils+lsSpend+depCost;
  const surplus=income-total;
  const investable=Math.max(Math.round(surplus*.80),500);
  const preview=document.getElementById('surplus-preview');
  if(preview&&income>0){
    preview.style.display='block';
    document.getElementById('sp-income').textContent=fmt(income);
    document.getElementById('sp-expenses').textContent=fmt(total);
    const sEl=document.getElementById('sp-surplus');sEl.textContent=fmt(surplus);sEl.style.color=surplus<500?'var(--red)':'var(--text)';
    document.getElementById('sp-buffer').textContent=fmt(Math.round(surplus*.20));
    document.getElementById('sp-sip').textContent=fmt(investable)+'/month';
  }
}

// ── LOANS ─────────────────────────────────────────────────────────────
function addLoan(){loanCount++;const id=loanCount;const c=document.getElementById('loans-container');const d=document.createElement('div');d.className='loan-card';d.id='loan-'+id;d.innerHTML=`<div class="field" style="margin:0"><label class="field-label">Type</label><select style="width:100%"><option>Personal</option><option>Credit Card</option><option>Vehicle</option><option>Education</option><option>Other</option></select></div><div class="field" style="margin:0"><label class="field-label">Rate %</label><input type="number" placeholder="e.g. 18" min="1" max="60" style="width:100%"></div><div class="field" style="margin:0"><label class="field-label">Monthly EMI (₹)</label><input type="number" placeholder="e.g. 5000" style="width:100%"></div><button class="btn-remove" onclick="document.getElementById('loan-${id}').remove()" title="Remove">✕</button>`;c.appendChild(d);}
function getLoans(){const rows=document.querySelectorAll('.loan-card');const loans=[],highCost=[];rows.forEach(row=>{const inp=row.querySelectorAll('input[type=number]');const rate=Math.min(+inp[0]?.value||0,60);const emi=+inp[1]?.value||0,type=row.querySelector('select')?.value||'Other';if(emi>0){loans.push({type,rate,emi});if(rate>12)highCost.push({type,rate,emi});}});return{loans,highCost};}

// ── CORE CALC ─────────────────────────────────────────────────────────
function getAlloc(age,risk,hasHealth,deps,hasEMI){const ytr=Math.max(60-age,1);let b;if(hasHealth)b={equity:20,gold:10,fd:25,debt_mf:20,health_insurance:25};else if(risk==='aggressive')b={equity:60,gold:10,fd:10,debt_mf:15,health_insurance:5};else if(risk==='moderate')b={equity:40,gold:15,fd:20,debt_mf:20,health_insurance:5};else b={equity:20,gold:20,fd:35,debt_mf:20,health_insurance:5};if(deps>=2){b.health_insurance=Math.min(b.health_insurance+5,25);b.equity=Math.max(b.equity-5,10);}if(hasEMI){b.equity=Math.max(b.equity-5,10);b.fd+=5;}if(ytr<10){const cut=Math.min(b.equity,20);b.equity-=cut;b.fd+=cut;}return b;}
function getWR(a){const t=a.equity+a.gold+a.fd+a.debt_mf;return(a.equity/t)*AVG_NIFTY+(a.gold/t)*AVG_GOLD+(a.fd/t)*AVG_FD+(a.debt_mf/t)*AVG_DEBT;}

// FIX: Monte Carlo — correct formula: noise stays at monthly scale, not divided by 12
function mcSim(sip,years,wr,n=800){
  const res=[];
  const rMonthly=wr/12;
  for(let i=0;i<n;i++){
    let c=0;
    for(let m=0;m<years*12;m++){
      // Box-Muller for normal distribution (sum of 4 uniforms ≈ normal)
      const noise=(Math.random()+Math.random()+Math.random()+Math.random()-2)*REAL_NIFTY_VOL;
      const mr=rMonthly+noise; // FIX: noise stays monthly, not divided by 12
      c=(c+sip)*(1+mr);
    }
    res.push(c);
  }
  res.sort((a,b)=>a-b);
  return{worst:res[Math.floor(n*.10)],likely:res[Math.floor(n*.50)],best:res[Math.floor(n*.90)],all:res};
}

function growC(sip,years,wr,g){const rm=wr/12,gm=g/12/100;let c=0,cur=sip;for(let m=0;m<years*12;m++){c=(c+cur)*(1+rm);cur*=(1+gm);}return c;}
function corpusAt(sip,year,wr){const r=wr/12,n=year*12;return r===0?sip*n:sip*(((1+r)**n-1)/r)*(1+r);}

// FIX: Tax handles both regimes correctly
}
function exportPDF(){
  // Show all tab panels for print, then restore
  const panels=document.querySelectorAll('.tab-panel');
  const hidden=[];
  panels.forEach(p=>{if(!p.classList.contains('active')){p.style.display='block';hidden.push(p);}});
  window.print();
  hidden.forEach(p=>{p.style.display='';});
}
function calcTax(annInc,regime){
  if(regime==='new'){
    if(annInc<=300000)return{tax:0,bracket:0,elssAllowed:false};
    if(annInc<=700000){const t=(annInc-300000)*.05;return{tax:t,bracket:.05,elssAllowed:false};}
    if(annInc<=1000000){const t=20000+(annInc-700000)*.10;return{tax:t,bracket:.10,elssAllowed:false};}
    if(annInc<=1200000){const t=50000+(annInc-1000000)*.15;return{tax:t,bracket:.15,elssAllowed:false};}
    if(annInc<=1500000){const t=80000+(annInc-1200000)*.20;return{tax:t,bracket:.20,elssAllowed:false};}
    const t=140000+(annInc-1500000)*.30;return{tax:t,bracket:.30,elssAllowed:false};
  } else {
    if(annInc<=250000)return{tax:0,bracket:0,elssAllowed:true};
    if(annInc<=500000){const t=(annInc-250000)*.05;return{tax:t,bracket:.05,elssAllowed:true};}
    if(annInc<=1000000){const t=12500+(annInc-500000)*.20;return{tax:t,bracket:.20,elssAllowed:true};}
    const t=112500+(annInc-1000000)*.30;return{tax:t,bracket:.30,elssAllowed:true};
  }
}

function calcScore(surplus,income,savings,efReq,gap,alloc,age,highCost){let s=0;s+=Math.min((surplus/income)*100,25);s+=savings>=efReq?20:savings>=efReq*.5?10:savings>0?5:0;s+=gap<=0?20:gap<income*12?10:0;s+=alloc.health_insurance>=10?15:alloc.health_insurance>=5?8:0;const idealEq=Math.max(100-age,20);s+=Math.max(10-Math.abs(alloc.equity-idealEq)/3,0);s+=highCost.length===0?10:!highCost.some(l=>l.rate>20)?5:0;return Math.min(Math.round(s),100);}
function scoreGrade(s){if(s>=80)return{g:'Excellent',c:'#16a34a'};if(s>=65)return{g:'Good',c:'#2563eb'};if(s>=45)return{g:'Fair',c:'#d97706'};return{g:'Needs Attention',c:'#dc2626'};}
function renderScore(score,el){const{g,c}=scoreGrade(score);const r=34,circ=2*Math.PI*r;const offset=circ-(score/100)*circ;el.innerHTML=`<div class="health-ring"><svg width="80" height="80" viewBox="0 0 80 80"><circle class="hr-bg" cx="40" cy="40" r="${r}"/><circle class="hr-fg" cx="40" cy="40" r="${r}" stroke="${c}" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" id="hs-arc"/></svg><div class="hr-num" style="color:${c}">${score}<div class="hr-label-sm">/100</div></div></div><div class="hs-info"><div class="hs-title">Financial Health</div><div class="hs-grade" style="color:${c}">${g}</div><div class="hs-sub">Surplus, savings, insurance & goals</div></div>`;setTimeout(()=>{const a=document.getElementById('hs-arc');if(a)a.style.strokeDashoffset=offset;},200);}

// ── EMERGENCY FUND (min-width fix) ────────────────────────────────────
function renderEFCard(savings,efReq,bufferPerMonth){
  const pct=Math.min(Math.round((savings/efReq)*100),100);
  const shortfall=Math.max(efReq-savings,0);
  const monthsToComplete=bufferPerMonth>0?Math.ceil(shortfall/bufferPerMonth):null;
  const isDone=savings>=efReq;
  const barColor=isDone?'var(--green)':pct>50?'var(--gold)':'var(--red)';
  const monthsText=isDone?'Complete ✓':monthsToComplete?`~${monthsToComplete} months to complete`:'Add buffer savings to track';
  document.getElementById('r-ef-card').innerHTML=`
    <div class="ef-card">
      <div class="ef-header"><div><div class="ef-title">🛡️ Emergency Fund Tracker</div><div class="ef-subtitle">6 months of expenses as a safety net — before investing more</div></div><div class="ef-badge ${isDone?'done':'warn'}">${isDone?'✓ Complete':'⚠ Incomplete'}</div></div>
      <div class="ef-bar-wrap"><div class="ef-bar-fill" id="ef-fill" style="width:0;background:${barColor}"><span class="ef-bar-pct">${pct}%</span></div></div>
      <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--text-dim);margin-bottom:14px;"><span>${fmt(savings)} saved</span><span>Goal: ${fmt(efReq)}</span></div>
      <div class="ef-stats">
        <div class="ef-stat"><div class="ef-stat-label">You Have</div><div class="ef-stat-val ${isDone?'green':''}">${fmt(savings)}</div></div>
        <div class="ef-stat"><div class="ef-stat-label">You Need</div><div class="ef-stat-val">${fmt(efReq)}</div></div>
        <div class="ef-stat"><div class="ef-stat-label">Shortfall</div><div class="ef-stat-val ${isDone?'green':'red'}">${isDone?'None ✓':fmt(shortfall)}</div></div>
      </div>
      <div class="ef-recommendation"><b>⏱ ${monthsText}</b><br>${isDone?'Your emergency fund is ready. You can invest your full SIP amount.':`Park in <b>SBI Liquid Fund</b> or <b>HDFC Overnight Fund</b> — not a savings account. These give ~6–7% while staying instantly withdrawable. Buffer of ${fmt(bufferPerMonth)}/month allocated here.`}</div>
    </div>`;
  // FIX: animate after render, with min-width so tiny % still shows
  setTimeout(()=>{const el=document.getElementById('ef-fill');if(el)el.style.width=Math.max(pct,3)+'%';},200);
}

// ── RISK BANNER ───────────────────────────────────────────────────────
function renderRiskBanner(risk){
  const msgs={
    aggressive:{text:'You chose <b>Aggressive</b> investing. Small cap and mid cap funds can drop 40–60% in a crash (2020 COVID, 2008). This is normal — the key is to NOT sell in panic. Stay invested for 7+ years minimum.',color:'#dc2626',bg:'rgba(220,38,38,.08)'},
    moderate:{text:'You chose <b>Moderate</b> investing. Your portfolio will fluctuate — a 15–25% dip in a bad year is normal. Do not panic-sell when markets fall. Systematic investing works when you stay the course.',color:'#d97706',bg:'rgba(217,119,6,.08)'},
    conservative:{text:'You chose <b>Conservative</b> investing. FDs and debt funds are safe but after 5% inflation, your real returns may be only 1–2%/year. Without some equity, your corpus may not beat inflation long-term.',color:'#2563eb',bg:'rgba(37,99,235,.08)'}
  };
  const m=msgs[risk];
  document.getElementById('r-risk-banner').innerHTML=`<div class="risk-banner" style="border-left:4px solid ${m.color};background:${m.bg};"><div class="risk-banner-icon">⚠️</div><div class="risk-banner-body"><div class="risk-banner-title" style="color:${m.color}">Risk Disclosure — Read Before Investing</div><div class="risk-banner-text" style="color:var(--text-mid)">${m.text}<br><br><b style="color:var(--text)">Past returns are NOT a guarantee of future performance. Markets can and do go down. Only invest money you won't need for the specified time horizon. Data as of May 2025.</b></div></div></div>`;
}

// ── CHARTS ────────────────────────────────────────────────────────────
function destroyCharts(){[cGrowth,cDist,cAlloc,cExp].forEach(c=>{try{if(c)c.destroy();}catch(e){}});cGrowth=cDist=cAlloc=cExp=null;}
const chartOpts={plugins:{legend:{display:false}},animation:{duration:900,easing:'easeOutQuart'},responsive:true,maintainAspectRatio:false};
function getCSSVar(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function gridColor(){return getCSSVar('--border')||'#e4e8f0';}
function tickColor(){return getCSSVar('--text-dim')||'#9aa3bc';}

function buildGrowthChart(sip,years,wr,growth,age){
  const labels=[],data=[],dataG=[];
  const step=Math.max(1,Math.floor(years/8));
  for(let y=0;y<=years;y+=step){labels.push('Age '+(age+y));data.push(Math.round(corpusAt(sip,y,wr)));const rm=wr/12,gm=growth/12/100;let c=0,cur=sip;for(let m=0;m<y*12;m++){c=(c+cur)*(1+rm);cur*=(1+gm);}dataG.push(Math.round(c));}
  const ctx=document.getElementById('chart-growth').getContext('2d');
  cGrowth=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Base SIP',data,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.06)',borderWidth:2,pointRadius:3,fill:true,tension:.4},{label:'With Growth',data:dataG,borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.04)',borderWidth:2,pointRadius:3,fill:true,tension:.4,borderDash:[5,4]}]},options:{...chartOpts,scales:{x:{ticks:{color:tickColor(),font:{size:9}},grid:{color:gridColor()}},y:{ticks:{color:tickColor(),font:{size:9},callback:v=>fmt(v)},grid:{color:gridColor()}}}}});
}
function buildDistChart(all){
  const n=10,min=all[0],max=all[all.length-1],step=(max-min)/n;
  const counts=Array(n).fill(0);all.forEach(v=>{const i=Math.min(Math.floor((v-min)/step),n-1);counts[i]++;});
  const ctx=document.getElementById('chart-dist').getContext('2d');
  cDist=new Chart(ctx,{type:'bar',data:{labels:counts.map((_,i)=>fmt(min+i*step)),datasets:[{data:counts,backgroundColor:'rgba(37,99,235,.35)',borderColor:'#2563eb',borderWidth:1,borderRadius:4}]},options:{...chartOpts,scales:{x:{ticks:{display:false},grid:{display:false}},y:{ticks:{color:tickColor(),font:{size:9}},grid:{color:gridColor()}}}}});
}
function buildAllocChart(alloc){
  const ctx=document.getElementById('chart-alloc').getContext('2d');
  cAlloc=new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(alloc).map(k=>k.replace('_',' ')),datasets:[{data:Object.values(alloc),backgroundColor:PALETTE_ARR,borderColor:getCSSVar('--surface')||'#fff',borderWidth:3,hoverOffset:6}]},options:{...chartOpts,cutout:'70%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${c.parsed}%`}}}}});
}
function buildExpChart(items){
  const colors=['#dc2626','#2563eb','#7c3aed','#db2777','#d97706','#16a34a','#6b7280'];
  const ctx=document.getElementById('chart-exp').getContext('2d');
  cExp=new Chart(ctx,{type:'doughnut',data:{labels:items.map(i=>i[0]),datasets:[{data:items.map(i=>i[1]),backgroundColor:colors,borderColor:getCSSVar('--surface')||'#fff',borderWidth:3,hoverOffset:6}]},options:{...chartOpts,cutout:'70%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.parsed)}`}}}}});
}

// ── MAIN CALCULATE ────────────────────────────────────────────────────
function calculate(){
  const btn=document.getElementById('btn-generate-main');
  const spinner=document.getElementById('generate-spinner');
  if(btn){btn.disabled=true;btn.textContent='Calculating...';}
  if(spinner)spinner.style.display='flex';
  setTimeout(()=>{_doCalculate();if(btn){btn.disabled=false;btn.textContent='Generate My Report →';}if(spinner)spinner.style.display='none';},120);
}
function _doCalculate(){
  const name=document.getElementById('f-name').value.trim()||'You';
  const age=+document.getElementById('f-age').value||25;
  const income=+document.getElementById('f-income').value||50000;
  const goal=+document.getElementById('f-goal').value||10000000;
  const savings=+document.getElementById('f-savings').value||0;
  const growth=+document.getElementById('f-growth').value||8;
  const rent=+document.getElementById('f-rent').value||0;
  const emi=+document.getElementById('f-emi').value||0;
  const grocer=+document.getElementById('f-groceries').value||0;
  const utils=+document.getElementById('f-utilities').value||0;
  const deps=+document.getElementById('f-deps').value||0;
  const ls=document.getElementById('f-lifestyle').value;
  const lsSpend={frugal:income*.05,average:income*.10,lavish:income*.20}[ls];
  const depCost=deps*6000;
  const totalExp=rent+emi+grocer+utils+lsSpend+depCost;
  const surplus=income-totalExp;
  const{loans,highCost}=getLoans();
  const highEMI=highCost.reduce((a,l)=>a+l.emi,0);
  const hasEMI=emi>0||loans.some(l=>l.emi>0);
  const investable=Math.max(Math.round((surplus-highEMI)*.80),500);
  const ytr=Math.max(60-age,1);
  const efReq=totalExp*6;
  const bufferPerMonth=Math.round(surplus*.20);
  const alloc=getAlloc(age,selRisk,selHealth==='yes',deps,hasEMI);
  const wr=getWR(alloc);
  const sim=mcSim(investable,ytr,wr);
  const grow=growC(investable,ytr,wr,growth);
  const infAdj=sim.likely/Math.pow(1+AVG_INF,ytr);
  const gap=goal-sim.likely;
  const annInc=income*12;
  const taxInfo=calcTax(annInc,selRegime);
  const bracket=taxInfo.bracket;
  // FIX: ELSS from monthly investable equity, not % of annual income
  const monthlyEqSip=Math.round(investable*alloc.equity/100);
  const elssAmt=taxInfo.elssAllowed?Math.min(monthlyEqSip*12,150000):0;
  const taxSaved=Math.round(elssAmt*bracket);
  const hscore=calcScore(surplus,income,savings,efReq,gap,alloc,age,highCost);
  _lastInputs={name,age,income,deps,health:selHealth,ls,savings,surplus,investable,ytr,risk:selRisk,regime:selRegime};

  destroyCharts();
  goTo('results');
  renderRiskBanner(selRisk);
  renderEFCard(savings,efReq,bufferPerMonth);

  document.getElementById('r-name').textContent=name+"'s Investment Report";
  const rLabel={aggressive:'Aggressive 🔥',moderate:'Moderate ⚖️',conservative:'Conservative 🛡️'}[selRisk];
  document.getElementById('r-meta').innerHTML=`<span class="rh-tag">Age ${age}</span><span class="rh-tag">${ytr} yrs to retire</span><span class="rh-tag primary">${rLabel}</span><span class="rh-tag">${selRegime==='new'?'New Regime':'Old Regime'}</span><span class="rh-tag">${deps} dependent${deps!==1?'s':''}</span><span class="rh-tag ${gap<=0?'green':''}">${gap<=0?'✓ On Track':'⚠ Below Goal'}</span>`;
  renderScore(hscore,document.getElementById('r-health-score'));
  saveReport({name,age,income,goal,savings,growth,rent,emi,groceries:grocer,utilities:utils,deps,lifestyle:ls,risk:selRisk,health:selHealth,regime:selRegime,corpusLikely:Math.round(sim.likely),corpusWorst:Math.round(sim.worst),corpusBest:Math.round(sim.best),investable,surplus:Math.round(surplus),ytr,healthScore:hscore,allocation:alloc});

  let ah='';
  if(!savings||savings<efReq)ah+=`<div class="alert warn"><span class="alert-icon">⚠</span><div class="alert-body"><strong>Emergency Fund Incomplete</strong>You need ${fmt(efReq)} as a 6-month safety net. Shortfall: ${fmt(Math.max(efReq-savings,0))}. Build this before increasing SIP.</div></div>`;
  highCost.forEach(l=>{ah+=`<div class="alert warn"><span class="alert-icon">⚠</span><div class="alert-body"><strong>High-Interest Loan — ${l.rate}%</strong>Your ${l.type} loan at ${l.rate}% costs more than investments return. EMI of ${fmt(l.emi)}/month excluded from investable.</div></div>`;});
  if(gap<=0)ah+=`<div class="alert success"><span class="alert-icon">✓</span><div class="alert-body"><strong>On Track</strong>Projected to meet your goal of ${fmt(goal)}. With ${growth}% income growth you will exceed it comfortably.</div></div>`;
  if(selRegime==='new')ah+=`<div class="alert info"><span class="alert-icon">ℹ</span><div class="alert-body"><strong>New Tax Regime — No 80C Benefit</strong>ELSS/80C deductions unavailable. NPS 80CCD(1B) ₹50,000 deduction may still apply — check with employer.</div></div>`;
  document.getElementById('r-alerts').innerHTML=ah;

  document.getElementById('r-kpis').innerHTML=`
    <div class="kpi-card accent-primary"><div class="kpi-label">Monthly SIP</div><div class="kpi-val primary">${fmt(investable)}</div><div class="kpi-sub">After expenses and 20% buffer</div></div>
    <div class="kpi-card ${gap<=0?'accent-green':''}"><div class="kpi-label">Likely Corpus</div><div class="kpi-val ${gap<=0?'green':''}">${fmt(sim.likely)}</div><div class="kpi-sub">50th percentile · 800 simulations · ±18% range</div></div>
    <div class="kpi-card accent-gold"><div class="kpi-label">Your Goal</div><div class="kpi-val gold">${fmt(goal)}</div><div class="kpi-sub">${gap<=0?'✓ Will be met':'Shortfall: '+fmt(gap)}</div></div>
    <div class="kpi-card"><div class="kpi-label">With Income Growth</div><div class="kpi-val green">${fmt(grow)}</div><div class="kpi-sub">At ${growth}% annual salary growth</div></div>
    <div class="kpi-card"><div class="kpi-label">Inflation Adjusted</div><div class="kpi-val">${fmt(infAdj)}</div><div class="kpi-sub">In today's purchasing power</div></div>
    <div class="kpi-card"><div class="kpi-label">Portfolio Return</div><div class="kpi-val primary">${(wr*100).toFixed(1)}%</div><div class="kpi-sub">Weighted annual estimate · data to May 2025</div></div>
  `;

  // FIX: corpus bars — goal line on outer container (no overflow:hidden clipping)
  // FIX: separate maxV for MC bars vs growth to fix scale distortion
  const mcMax=Math.max(sim.best,goal)*1.1; // scale MC bars against MC+goal only
  const growMax=Math.max(grow,goal)*1.1;
  const gp_mc=Math.min((goal/mcMax*100),98).toFixed(1);
  const gp_gr=Math.min((goal/growMax*100),98).toFixed(1);
  const bars=[
    {id:'worst',label:'Worst (10%)',val:sim.worst,bg:'rgba(220,38,38,.15)',color:'#dc2626',maxV:mcMax,gp:gp_mc},
    {id:'likely',label:'Likely (50%)',val:sim.likely,bg:'rgba(37,99,235,.15)',color:'#2563eb',maxV:mcMax,gp:gp_mc},
    {id:'best',label:'Best (90%)',val:sim.best,bg:'rgba(22,163,74,.15)',color:'#16a34a',maxV:mcMax,gp:gp_mc},
    {id:'grow',label:'With Growth',val:grow,bg:'rgba(124,58,237,.15)',color:'#7c3aed',maxV:growMax,gp:gp_gr},
  ];
  document.getElementById('r-bars').innerHTML=`
    <div style="padding-top:28px;">${bars.map(b=>`
      <div class="corpus-bar-row">
        <div class="cbr-label">${b.label}</div>
        <div class="cbr-outer">
          <div class="cbr-track"><div class="cbr-fill" id="cb-${b.id}" style="background:${b.bg};color:${b.color}"></div></div>
          <div class="goal-line-outer" style="left:${b.gp}%"><div class="goal-line-label">Goal</div></div>
        </div>
        <div class="cbr-val" style="color:${b.color}">${fmt(b.val)}</div>
      </div>`).join('')}
    </div>
    <div class="bar-legend">
      <div class="bl-item"><div class="bl-dot" style="background:#dc2626"></div>Worst case — 10% of simulations were below this</div>
      <div class="bl-item"><div class="bl-dot" style="background:#2563eb"></div>Likely — median of 800 simulations</div>
      <div class="bl-item"><div class="bl-dot" style="background:#16a34a"></div>Best case — 90% of simulations were below this</div>
      <div class="bl-item"><div class="bl-dot" style="background:#7c3aed"></div>With salary growth — SIP increases ${growth}%/year</div>
      <div class="bl-item"><div class="bl-dot" style="background:var(--gold)"></div>Gold line = your retirement goal of ${fmt(goal)}</div>
    </div>
  `;
  setTimeout(()=>bars.forEach(b=>{const el=document.getElementById('cb-'+b.id);if(el){el.style.width=(Math.min(b.val,b.maxV)/b.maxV*100)+'%';el.textContent=fmt(b.val);}}),150);

  const mAges=[35,40,45,50].filter(a=>a>age&&a<60);
  if(mAges.length<2)[5,10,15,20].filter(y=>y<ytr).forEach(y=>mAges.push(age+y));
  document.getElementById('r-milestones').innerHTML=mAges.slice(0,4).map(a=>`<div class="milestone-cell"><div class="mc-age">Age ${a}</div><div class="mc-val">${fmt(corpusAt(investable,a-age,wr))}</div><div class="mc-yr">In ${a-age} years</div></div>`).join('');

  setTimeout(()=>{
    buildGrowthChart(investable,ytr,wr,growth,age);
    buildDistChart(sim.all);
    buildAllocChart(alloc);
    const expItems=[['Rent/EMI',rent+emi],['Groceries',grocer],['Utilities',utils],['Lifestyle',Math.round(lsSpend)],['Dependents',depCost],['Buffer',Math.round(surplus*.20)],['SIP',investable]].filter(i=>i[1]>0);
    buildExpChart(expItems);
  },300);

  document.getElementById('r-alloc').innerHTML=Object.entries(alloc).map(([k,v],i)=>`
    <div class="alloc-tr"><div class="alloc-dot" style="background:${PALETTE_ARR[i]}"></div><div class="alloc-name">${k.replace('_',' ')}</div><div class="alloc-pct" style="color:${PALETTE_ARR[i]}">${v}%</div><div class="alloc-amt">${fmt(investable*v/100)}/mo</div></div>
    <div class="alloc-bar-row"><div class="alloc-bar-bg"><div class="alloc-bar-fg" style="width:${v}%;background:${PALETTE_ARR[i]}"></div></div></div>`).join('');

  const expR=[['Rent & EMI',rent+emi,'#dc2626'],['Groceries & Food',grocer,'#2563eb'],['Bills & Utilities',utils,'#7c3aed'],['Lifestyle',Math.round(lsSpend),'#db2777'],['Dependents',depCost,'#d97706'],['Liquid Buffer',Math.round(surplus*.20),'#d97706'],['Monthly SIP',investable,'#16a34a']].filter(r=>r[1]>0);
  document.getElementById('r-breakdown').innerHTML=expR.map(([cat,amt,clr])=>`<div class="exp-row"><div class="er-left"><div class="er-dot" style="background:${clr}"></div><div><div class="er-label">${cat}</div><div class="er-pct">${income>0?((amt/income)*100).toFixed(1):0}% of income</div></div></div><div class="er-amt" style="color:${clr}">${fmt(amt)}</div></div>`).join('')+`<div class="exp-row"><div class="er-left"><div class="er-label" style="font-weight:700;color:var(--text)">Total Monthly Income</div></div><div class="er-amt">${fmt(income)}</div></div>`;

  document.getElementById('tax-card-title').textContent=selRegime==='old'?'Section 80C Tax Optimisation (Old Regime)':'New Regime — Tax Breakdown';
  if(selRegime==='old'){
    document.getElementById('r-tax-kpis').innerHTML=`
      <div class="kpi-card"><div class="kpi-label">Tax Bracket</div><div class="kpi-val gold">${Math.round(bracket*100)}%</div><div class="kpi-sub">Annual income: ${fmt(annInc)}</div></div>
      <div class="kpi-card"><div class="kpi-label">ELSS eligible / Year</div><div class="kpi-val primary">${fmt(elssAmt)}</div><div class="kpi-sub">80C limit: ₹1,50,000 · Source: IT Act</div></div>
      <div class="kpi-card accent-green"><div class="kpi-label">Tax saved / Year</div><div class="kpi-val green">${fmt(taxSaved)}</div><div class="kpi-sub">Via ELSS under Section 80C</div></div>
      <div class="kpi-card"><div class="kpi-label">Extra via NPS 80CCD</div><div class="kpi-val">${fmt(Math.round(50000*bracket))}</div><div class="kpi-sub">On ₹50,000 NPS Tier-1 contribution</div></div>`;
    document.getElementById('r-tax-body').innerHTML=`By routing equity allocation into <strong>ELSS mutual funds</strong> (e.g. Mirae Asset Tax Saver), you save <strong style="color:var(--green)">${fmt(taxSaved)}</strong>/year in taxes. ELSS has a <strong>3-year lock-in</strong> — shortest among 80C instruments — while delivering equity-level returns. Additionally, ₹50,000 NPS Tier-1 under 80CCD(1B) saves another <strong style="color:var(--green)">${fmt(Math.round(50000*bracket))}</strong>. Over ${ytr} years, these savings compounded add roughly <strong style="color:var(--primary)">${fmt((taxSaved+Math.round(50000*bracket))*ytr*1.4)}</strong> in wealth. <i style="color:var(--text-dim);font-size:.72rem">Source: Income Tax Act 1961, Sections 80C and 80CCD.</i>`;
  } else {
    document.getElementById('r-tax-kpis').innerHTML=`
      <div class="kpi-card"><div class="kpi-label">Tax Bracket</div><div class="kpi-val gold">${Math.round(bracket*100)}%</div><div class="kpi-sub">New regime slab for ${fmt(annInc)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Est. Annual Tax</div><div class="kpi-val primary">${fmt(Math.round(taxInfo.tax))}</div><div class="kpi-sub">Before cess & surcharge</div></div>
      <div class="kpi-card"><div class="kpi-label">80C Deduction</div><div class="kpi-val" style="font-size:.95rem">Not Available</div><div class="kpi-sub">Switch to old regime to claim</div></div>
      <div class="kpi-card"><div class="kpi-label">NPS 80CCD(2)</div><div class="kpi-val green">May Apply</div><div class="kpi-sub">Employer NPS contribution — check with HR</div></div>`;
    document.getElementById('r-tax-body').innerHTML=`You are on the <strong>New Tax Regime</strong> — 80C deductions (ELSS, PPF, LIC) and HRA are <strong>not available</strong>. You get lower flat slab rates instead. If your total old-regime deductions would exceed ₹3.75L/year, switching to old regime may save more tax. <strong>Employer NPS contributions</strong> under 80CCD(2) are still tax-free even in the new regime — check with your HR. Estimated annual tax: <strong style="color:var(--primary)">${fmt(Math.round(taxInfo.tax))}</strong>. <i style="color:var(--text-dim);font-size:.72rem">Source: Finance Act 2023, new tax regime slabs.</i>`;
  }

  buildWhere(alloc,investable,selRisk);
  buildGeminiSection(age,deps,selHealth,income,ls);
  buildPlan(alloc,investable,surplus,savings,efReq,highCost,gap,ytr,taxSaved,growth,income,bracket,selRegime);
}

// ── TABS ──────────────────────────────────────────────────────────────
function showTab(name,btn){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.getElementById('tab-'+name).classList.add('active');btn.classList.add('active');}

// ── GEMINI AI ─────────────────────────────────────────────────────────
function buildGeminiSection(age,deps,health,income,lifestyle){
  document.getElementById('r-ai-health').innerHTML=`
    <div class="ai-section">
      <div class="ai-header">
        <div class="ai-header-left"><div class="ai-gem-icon">✨</div><div><div class="ai-title">AI Health Insurance Advisor</div><div class="ai-subtitle">Powered by Gemini · Personalised to your profile</div></div></div>
        <div class="ai-badge">GEMINI AI</div>
      </div>
      <div class="ai-body">
        <div class="ai-form-grid">
          <div class="ai-field"><label>Your City</label><input type="text" id="ai-city" placeholder="e.g. Mumbai"></div>
          <div class="ai-field"><label>Pre-existing Conditions</label><select id="ai-condition"><option value="none">None</option><option value="diabetes">Diabetes</option><option value="hypertension">Hypertension</option><option value="heart">Heart Disease</option><option value="thyroid">Thyroid</option><option value="other">Other</option></select></div>
          <div class="ai-field"><label>Family Type</label><select id="ai-family"><option value="individual">Individual (just me)</option><option value="couple">Couple</option><option value="family" ${deps>0?'selected':''}>Family with kids</option><option value="parents">Me + Parents</option><option value="floater">Full family floater</option></select></div>
          <div class="ai-field"><label>Smoker?</label><select id="ai-smoker"><option value="no">No</option><option value="yes">Yes</option></select></div>
        </div>
        <div class="ai-field" style="margin-bottom:16px;">
          <label style="display:block;font-size:.72rem;font-weight:600;color:var(--text-dim);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em;">Gemini API Key <span class="tip-wrap" style="display:inline-flex"><i class="tip-icon">i</i><div class="tip-box tip-right">Get a free key at ai.google.dev — free for personal use. Your key goes directly to Google's API. FinCA never stores it.</div></span></label>
          <input type="password" id="ai-key" placeholder="AIza...your Gemini API key" style="font-family:monospace">
        </div>
        <button class="ai-run-btn" id="ai-run-btn" onclick="runGemini(${age},${deps},'${health}',${income},'${lifestyle}')">✨ Analyse My Health Insurance Needs</button>
        <div class="ai-error" id="ai-error"></div>
        <div class="ai-loading" id="ai-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">Gemini is analysing your profile...</div></div>
        <div class="ai-result" id="ai-result"></div>
      </div>
    </div>`;
}

async function runGemini(age,deps,health,income,lifestyle){
  const key=document.getElementById('ai-key').value.trim();
  const city=document.getElementById('ai-city').value.trim()||'India';
  const condition=document.getElementById('ai-condition').value;
  const family=document.getElementById('ai-family').value;
  const smoker=document.getElementById('ai-smoker').value;
  if(!key){const err=document.getElementById('ai-error');err.textContent='Please enter your Gemini API key. Get one free at ai.google.dev';err.style.display='block';return;}
  document.getElementById('ai-run-btn').disabled=true;
  document.getElementById('ai-loading').style.display='block';
  document.getElementById('ai-result').style.display='none';
  document.getElementById('ai-error').style.display='none';
  const prompt=`You are an expert Indian health insurance advisor with knowledge of IRDAI claim settlement data. Analyse this profile and recommend top 3 health insurance plans available in India in 2024-2025.
Profile: Age: ${age}, City: ${city}, Monthly income: ₹${income.toLocaleString('en-IN')}, Family: ${family}, Dependents: ${deps}, Pre-existing: ${condition}, Smoker: ${smoker}, Lifestyle: ${lifestyle}, Health concern: ${health==='yes'?'Yes':'No'}
Return ONLY valid JSON (no markdown, no backticks):
{"recommendedCover":"₹X lakh - reason","plans":[{"name":"Plan Name","company":"Insurer","coverAmount":"₹X lakh","estimatedPremium":"₹X/month","claimSettlementRatio":"XX%","keyFeatures":"2-3 features","suitabilityScore":85,"whyRecommended":"One sentence","isTopPick":true}],"warnings":"any warnings","termLifeNote":"term life note"}`;
  try{
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.3,maxOutputTokens:1500}})});
    if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`API error: ${res.status}`);}
    const data=await res.json();
    const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    const parsed=JSON.parse(raw.replace(/```json|```/g,'').trim());
    renderGeminiResult(parsed);
  }catch(e){
    document.getElementById('ai-loading').style.display='none';
    document.getElementById('ai-run-btn').disabled=false;
    const err=document.getElementById('ai-error');err.textContent='Error: '+(e.message||'Check your API key and try again.');err.style.display='block';
  }
}

function renderGeminiResult(data){
  document.getElementById('ai-loading').style.display='none';
  document.getElementById('ai-run-btn').disabled=false;
  const el=document.getElementById('ai-result');el.style.display='block';
  const plansHTML=data.plans.map(p=>`<div class="ai-plan-card ${p.isTopPick?'top':''}"><div class="ai-plan-name">${p.name}</div><div class="ai-plan-company">${p.company}</div><div class="ai-plan-stat"><span class="ai-plan-stat-label">Cover</span><span class="ai-plan-stat-val">${p.coverAmount}</span></div><div class="ai-plan-stat"><span class="ai-plan-stat-label">Premium</span><span class="ai-plan-stat-val">${p.estimatedPremium}</span></div><div class="ai-plan-stat"><span class="ai-plan-stat-label">Claim Ratio</span><span class="ai-plan-stat-val">${p.claimSettlementRatio}</span></div><div class="ai-rating-bar"><div class="ai-rating-fill" style="width:${p.suitabilityScore||75}%"></div></div><div style="font-size:.62rem;color:var(--text-dim);margin-top:2px;">AI Suitability: ${p.suitabilityScore||75}/100 · Claim ratio: <a href="https://www.irdai.gov.in" target="_blank" style="color:var(--primary)">IRDAI ↗</a></div><div class="ai-plan-reason">${p.whyRecommended}</div><div class="ai-plan-reason" style="margin-top:4px;padding-top:4px;border-top:var(--card-border);font-size:.65rem">${p.keyFeatures}</div></div>`).join('');
  el.innerHTML=`<div class="ai-result-header" style="margin-top:20px;"><span style="font-size:1rem">✅</span><div class="ai-result-title">AI Analysis Complete — ${data.plans.length} Plans Recommended</div></div><div class="ai-cover-rec"><b>Recommended Cover:</b> ${data.recommendedCover}</div><div class="ai-plans">${plansHTML}</div>${data.warnings?`<div class="ai-cover-rec" style="border-color:rgba(220,38,38,.3);background:rgba(220,38,38,.04)"><b style="color:var(--red)">⚠ Important:</b> ${data.warnings}</div>`:''} ${data.termLifeNote?`<div class="ai-cover-rec" style="border-color:rgba(22,163,74,.3);background:rgba(22,163,74,.04)"><b style="color:var(--green)">💡 Also consider:</b> ${data.termLifeNote}</div>`:''}<div class="ai-disclaimer">⚠ AI recommendations are informational only. Verify premiums, features and claim ratios at <a href="https://www.policybazaar.com/health-insurance/" target="_blank" style="color:var(--primary);font-weight:600">Policybazaar ↗</a> or <a href="https://www.irdai.gov.in" target="_blank" style="color:var(--primary);font-weight:600">IRDAI ↗</a> before purchasing. FinCA is not IRDAI-registered.</div>`;
}

// ── ACTION PLAN ───────────────────────────────────────────────────────
function buildPlan(alloc,investable,surplus,savings,efReq,highCost,gap,ytr,taxSaved,growth,income,bracket,regime){
  const items=[];let step=1;
  if(highCost.length>0)items.push({n:step++,col:'red',title:'Clear high-interest loans first',desc:`Loans above 12% cost more than investments return. Clear ${highCost.map(l=>l.type).join(', ')} before investing more.`,when:'This week — top priority',urgent:true});
  if(savings<efReq)items.push({n:step++,col:'red',title:'Build your 6-month emergency fund',desc:`Need ${fmt(efReq)} as buffer. At ${fmt(Math.round(surplus*.2))}/month buffer → ~${Math.ceil(Math.max(efReq-savings,0)/(surplus*.2||1))} months. Keep in SBI Liquid Fund or HDFC Overnight Fund — NOT a savings account.`,when:'Start immediately — before investing more',urgent:true});
  items.push({n:step++,col:'green',title:'Buy health insurance this month',desc:`Minimum: ₹10L individual, ₹25L family. Monthly premium ~₹500–₹1,500. Use the AI Health Advisor above for personalised recommendations. Compare at Policybazaar (policybazaar.com).`,when:'This month — do not delay'});
  if(regime==='old')items.push({n:step++,col:'primary',title:'Start ELSS SIP — exhaust Section 80C',desc:`Put ${fmt(Math.min(Math.round(investable*alloc.equity/100),Math.round(150000/12)))}/month into ELSS (e.g. Mirae Asset Tax Saver via Groww or Kuvera). Saves ${fmt(taxSaved)}/year in taxes.`,when:'This month — set up SIP'});
  items.push({n:step++,col:'primary',title:'Start equity SIP',desc:`Put ${fmt(Math.round(investable*alloc.equity/100))}/month into equity. Parag Parikh Flexi Cap or NIFTYBEES ETF. Set auto-debit on the 5th. Source: AMFI NAV data at amfiindia.com.`,when:'Month 1'});
  items.push({n:step++,col:'gold',title:'Set up gold allocation',desc:`Invest ${fmt(Math.round(investable*alloc.gold/100))}/month. Buy Sovereign Gold Bonds (SGB) via rbiretaildirect.org.in when RBI issues, otherwise Nippon GOLDBEES ETF on Zerodha.`,when:'Month 1–2'});
  items.push({n:step++,col:'green',title:'Open FD or debt MF SIP',desc:`Park ${fmt(Math.round(investable*alloc.fd/100))}/month in SBI FD (sbi.co.in) or HDFC Low Duration Fund. FD rates at rbi.org.in for current benchmarks.`,when:'Month 2'});
  if(regime==='old')items.push({n:step++,col:'primary',title:'Open NPS Tier-1 for ₹50,000 extra deduction',desc:`Under 80CCD(1B), NPS gives ₹50,000 more deduction — saves ${fmt(Math.round(50000*bracket))}/year. Open at npstrust.org.in. Locked till age 60.`,when:'Month 2–3'});
  items.push({n:step++,col:'green',title:'Set annual SIP step-up reminder',desc:`Every April, increase SIP by ${growth}% to match salary increment. Set a Google Calendar reminder now.`,when:'Every April'});
  if(gap>0)items.push({n:step++,col:'red',title:'Close the gap to your retirement goal',desc:`Corpus falls short by ${fmt(gap)}. Increase SIP by ${fmt(Math.round(gap/(ytr*12)))}/month, OR reduce expenses by ${fmt(Math.round(gap/(ytr*12)/.8))}/month.`,when:'Review every 6 months',urgent:true});
  const colors={primary:'var(--primary)',green:'var(--green)',red:'var(--red)',gold:'var(--gold)'};
  document.getElementById('r-action').innerHTML=items.map(item=>`<div class="action-item ${item.urgent?'urgent':''}"><div class="action-num" style="background:${colors[item.col]}">${item.n}</div><div class="action-body"><div class="action-title">${item.title}</div><div class="action-desc">${item.desc}</div><div class="action-when">⏱ ${item.when}</div></div></div>`).join('');
}

// ── WHERE TO INVEST ───────────────────────────────────────────────────
function wiToggle(id){const b=document.getElementById('wb-'+id);const c=document.getElementById('wc-'+id);b.classList.toggle('open');c.classList.toggle('open');}
function wCard(name,tag,tagBg,tagColor,stats,via,top,note,links){
  const linksHTML=links?`<div class="wc-links">${links.map(([lbl,url])=>`<a class="wc-link" href="${url}" target="_blank" rel="noopener">${lbl} ↗</a>`).join('')}</div>`:'';
  return`<div class="wi-card${top?' top-pick':''}"><div class="wc-name">${name}</div><span class="wc-tag" style="background:${tagBg};color:${tagColor}">${tag}</span><div class="wc-stats">${stats}</div><div class="wc-platform"><span class="wcp-label">Via</span><span class="wcp-val">${via}</span></div>${note?`<div class="wc-note">${note}</div>`:''}${linksHTML}</div>`;
}
function buildWhere(alloc,investable,risk){
  const f=fmt;const buckets=[];
  const eqAmt=Math.round(investable*(alloc.equity/100));
  if(eqAmt>0){
    const elssMonthly=Math.min(eqAmt,Math.round(150000/12));const directAmt=eqAmt-elssMonthly;
    let mf='',etf='',stocks='';
    if(risk==='aggressive'){
      mf=wCard('Parag Parikh Flexi Cap','Flexi Cap','#dbeafe','#1d4ed8','<b>~19% CAGR (5Y)</b> · No lock-in · Global exposure','Groww / Kuvera',true,'Best all-weather fund. Indian + US stocks.',[['Kuvera','https://kuvera.in'],['Screener','https://www.screener.in']])+wCard('Nippon India Small Cap','Small Cap','#dcfce7','#15803d','<b>~22% CAGR (5Y)</b> · Very high risk<br>Expect 40–50% drawdowns','Zerodha Coin',false,'7+ year horizon only.',[['Zerodha','https://zerodha.com/coin'],['NSE','https://www.nseindia.com']])+wCard('Kotak Emerging Equity','Mid Cap','#f3e8ff','#6d28d9','<b>~19% CAGR (5Y)</b>','Groww / Kuvera',false,'Sweet spot: large+small cap.',null);
      etf=wCard('NIFTYBEES','Nifty 50 ETF','#dbeafe','#1d4ed8','<b>~15% CAGR (10Y)</b> · 0.04% expense<br>Source: NSE / AMFI','Zerodha / Upstox',false,'Cheapest way to own Nifty 50.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=NIFTYBEES'],['Tickertape','https://www.tickertape.in/stocks/nippon-india-etf-nifty-50-bees-NIFTYBEES']])+wCard('JUNIORBEES','Nifty Next 50','#dbeafe','#1d4ed8','<b>~16% CAGR (10Y)</b> · Source: NSE','Zerodha / Groww',false,'Tomorrow\'s Nifty 50.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=JUNIORBEES']]);
      stocks=wCard('HDFC Bank','NSE: HDFCBANK','#fce7f3','#9d174d','18%+ ROE · Most reliable Indian bank<br>Source: NSE','Zerodha / Groww',true,'20-year compounder.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK'],['Screener','https://www.screener.in/company/HDFCBANK/']])+wCard('Reliance Industries','NSE: RELIANCE','#fce7f3','#9d174d','Conglomerate · Energy, Retail, Telecom','Zerodha / Upstox',false,'India growth proxy.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=RELIANCE'],['Screener','https://www.screener.in/company/RELIANCE/']])+wCard('Infosys','NSE: INFY','#fce7f3','#9d174d','IT Services · USD revenue · Dividends','Zerodha / Groww',false,'Rupee depreciation hedge.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=INFY'],['Screener','https://www.screener.in/company/INFY/']]);
    } else if(risk==='moderate'){
      mf=wCard('Parag Parikh Flexi Cap','Flexi Cap','#dbeafe','#1d4ed8','<b>~19% CAGR (5Y)</b> · No lock-in','Groww / Kuvera',true,'Indian blue chips + US tech.',[['Kuvera','https://kuvera.in'],['Groww','https://groww.in']])+wCard('Mirae Asset Large & Mid Cap','Large & Mid','#dcfce7','#15803d','<b>~17% CAGR (5Y)</b>','Zerodha Coin',false,'50% large cap + 50% mid cap.',null)+wCard('ICICI Pru Bluechip','Large Cap','#dbeafe','#1d4ed8','<b>~15% CAGR (5Y)</b> · Low volatility','Groww / Kuvera',false,'Fewer drawdowns in crashes.',null);
      etf=wCard('NIFTYBEES','Nifty 50 ETF','#dbeafe','#1d4ed8','<b>~15% CAGR (10Y)</b> · 0.04% expense<br>Source: NSE/AMFI','Zerodha / Upstox',false,'Zero manager risk, lowest cost.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=NIFTYBEES'],['Tickertape','https://www.tickertape.in/stocks/nippon-india-etf-nifty-50-bees-NIFTYBEES']]);
      stocks=wCard('HDFC Bank','NSE: HDFCBANK','#fce7f3','#9d174d','18%+ ROE · Source: NSE','Zerodha / Groww',true,'20-year compounder.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK'],['Screener','https://www.screener.in/company/HDFCBANK/']])+wCard('TCS','NSE: TCS','#fce7f3','#9d174d','IT Exports · USD revenue · Dividends','Zerodha / Upstox',false,'Earns in dollars.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=TCS'],['Screener','https://www.screener.in/company/TCS/']])+wCard('Asian Paints','NSE: ASIANPAINT','#fce7f3','#9d174d','40% market share · Consistent compounder','Groww / Zerodha',false,'Pricing power, low debt.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=ASIANPAINT'],['Screener','https://www.screener.in/company/ASIANPAINT/']]);
    } else {
      mf=wCard('ICICI Pru Bluechip','Large Cap','#dbeafe','#1d4ed8','<b>~15% CAGR (5Y)</b> · Low volatility','Groww / Kuvera',true,'Sticks to Nifty 50 companies only.',null)+wCard('Mirae Asset Tax Saver','ELSS · 80C','#f3e8ff','#6d28d9','<b>~17% CAGR (5Y)</b> · 3-year lock-in','Zerodha Coin',false,'80C benefit. Lock-in = forced patience.',null);
      etf=wCard('NIFTYBEES','Nifty 50 ETF','#dbeafe','#1d4ed8','<b>~15% CAGR (10Y)</b> · 0.04% expense','Zerodha / Upstox',false,'Safest equity option.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=NIFTYBEES']]);
      stocks=wCard('HDFC Bank','NSE: HDFCBANK','#fce7f3','#9d174d','Most stable Indian stock · 18%+ ROE','Zerodha / Groww',true,'Conservative-friendly.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK'],['Screener','https://www.screener.in/company/HDFCBANK/']])+wCard('ITC','NSE: ITC','#fce7f3','#9d174d','FMCG · Dividend yield ~3–4%','Zerodha / Upstox',false,'Like fixed income with upside.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=ITC'],['Screener','https://www.screener.in/company/ITC/']]);
    }
    // ELSS card and split note only shown on old regime (FIX: was always showing)
    const elssCard=selRegime==='old'?wCard('Mirae Asset ELSS Tax Saver','ELSS · 80C','#f3e8ff','#6d28d9',`<b>Up to ${f(Math.round(150000/12))}/mo</b> tax-saving<br>3-year lock-in · ~17% CAGR · Source: AMFI`,'Groww / Kuvera',false,'Old Regime only — route equity SIP here first.',null):'';
    const eqSplitNote=selRegime==='old'
      ?`<div class="wi-split-note">Split <strong>${f(eqAmt)}/month</strong>: <strong>${f(elssMonthly)}</strong> → ELSS (Old Regime 80C) + <strong>${f(Math.max(directAmt,0))}</strong> → Flexi Cap / Index ETF / Stocks. Returns sourced from <a href="https://www.amfiindia.com" target="_blank" style="color:var(--primary)">AMFI ↗</a> and <a href="https://www.nseindia.com" target="_blank" style="color:var(--primary)">NSE ↗</a>.</div>`
      :`<div class="wi-split-note">Invest <strong>${f(eqAmt)}/month</strong> across Flexi Cap funds, Index ETFs, and direct stocks. ELSS/80C not available on new regime. Returns sourced from <a href="https://www.amfiindia.com" target="_blank" style="color:var(--primary)">AMFI ↗</a> and <a href="https://www.nseindia.com" target="_blank" style="color:var(--primary)">NSE ↗</a>.</div>`;
    const eqSub=selRegime==='old'?'Mutual Funds · ETFs · Stocks · ELSS':'Mutual Funds · ETFs · Stocks';
    buckets.push({id:'eq',color:'#2563eb',title:'Equity',sub:eqSub,amt:eqAmt,pct:alloc.equity,body:`${eqSplitNote}<div class="wi-section-hd">Mutual Funds (SIP)</div><div class="wi-cards">${mf}${elssCard}</div><div class="wi-section-hd">Index ETFs — buy on NSE like a stock</div><div class="wi-cards">${etf}</div><div class="wi-section-hd">Direct Stocks — optional, max 15% of equity</div><div class="wi-cards">${stocks}</div><div class="wi-why"><b>Strategy</b>60–70% into a Flexi Cap SIP (hands-off). 20% into Index ETF (cheapest). 10–15% direct stocks only if you enjoy researching. Clicking ↗ links opens NSE/Screener for live data.</div>`});
  }

  const goldAmt=Math.round(investable*(alloc.gold/100));
  if(goldAmt>0){
    const goldCards=wCard('Sovereign Gold Bond (SGB)','Govt. Bond · RBI','#fef3c7','#92400e','<b>Gold price + 2.5% p.a. interest</b><br>8-year tenure · Tax-free maturity<br>Source: RBI (rbi.org.in)','RBI Retail Direct / HDFC Bank',true,'Best gold investment — returns plus guaranteed interest.',[['RBI SGB','https://rbiretaildirect.org.in'],['RBI Info','https://www.rbi.org.in/scripts/bs_viewcontent.aspx?Id=4494']])+wCard('Nippon India GOLDBEES','Gold ETF','#fef3c7','#92400e','<b>Tracks MCX gold price live</b> · 0.54% expense<br>No lock-in · Source: MCX/NSE','Zerodha / Upstox',false,'Monthly SIP-style buying. Tracks gold 1:1.',[['NSE','https://www.nseindia.com/get-quotes/equity?symbol=GOLDBEES'],['MCX','https://www.mcxindia.com']])+wCard('Digital Gold','Digital · 24K Pure','#fef3c7','#92400e','<b>Start with ₹1</b> · MMTC-PAMP backed','Groww / PhonePe',false,'For amounts under ₹1,000/mo only.',null);
    buckets.push({id:'gold',color:'#d97706',title:'Gold',sub:'SGB · ETF · Digital Gold · Source: RBI/MCX',amt:goldAmt,pct:alloc.gold,body:`<div class="wi-split-note">Invest <strong>${f(goldAmt)}/month</strong>. Gold 9-year CAGR: <b>12.03%</b> (Source: <a href="https://www.mcxindia.com" target="_blank" style="color:var(--primary)">MCX India ↗</a>). Priority: SGB → Gold ETF → Digital Gold.</div><div class="wi-section-hd">Gold options</div><div class="wi-cards">${goldCards}</div><div class="wi-why"><b>Strategy</b>SGBs are best — gold returns plus 2.5% interest, tax-free at maturity. For monthly SIP, Gold ETF on Zerodha. Avoid physical gold — making charges destroy returns.</div>`});
  }

  const fdAmt=Math.round(investable*(alloc.fd/100));
  if(fdAmt>0){
    const fdCards=wCard('SBI Fixed Deposit','Govt. Bank FD','#dcfce7','#166534','<b>6.8–7.1% p.a.</b> (1–5 yr)<br>Source: RBI benchmark · DICGC insured','SBI YONO App',true,'Safest FD — government backing.',[['SBI FD','https://www.sbi.co.in/web/personal-banking/investments-deposits/deposits/term-deposits/fixed-deposit'],['RBI Rates','https://www.rbi.org.in']])+wCard('IDFC First Bank FD','Small Finance','#dcfce7','#166534','<b>7.75–8.25% p.a.</b> · DICGC ₹5L','IDFC First App',false,'Higher rate, safe up to ₹5L.',null)+wCard('RBI Floating Rate Bond','Govt. Bond','#dcfce7','#166534','<b>8.05% p.a.</b> · 7-year · No TDS<br>Source: RBI','RBI Retail Direct',false,'Better than most FDs.',[['RBI Retail Direct','https://rbiretaildirect.org.in']])+wCard('Post Office MIS','Govt. Scheme','#dcfce7','#166534','<b>7.4% p.a.</b> monthly payout · 5-year','India Post App',false,'Regular monthly income.',null);
    buckets.push({id:'fd',color:'#16a34a',title:'Fixed Deposits & Bonds',sub:'FD · RBI Bonds · Post Office · Source: RBI',amt:fdAmt,pct:alloc.fd,body:`<div class="wi-split-note">Park <strong>${f(fdAmt)}/month</strong> via RD. FD rates source: <a href="https://www.rbi.org.in" target="_blank" style="color:var(--primary)">RBI ↗</a>. Current benchmark: <b>6.88% p.a.</b> (recency-weighted)</div><div class="wi-section-hd">Fixed income options</div><div class="wi-cards">${fdCards}</div><div class="wi-why"><b>Strategy</b>SBI FD for emergency buffer (DICGC insured ₹5L). RBI Bonds (8.05%) for beyond that. Keep each IDFC/Ujjivan FD below ₹5L insurance limit.</div>`});
  }

  const debtAmt=Math.round(investable*(alloc.debt_mf/100));
  if(debtAmt>0){
    const debtCards=wCard('HDFC Low Duration Fund','Low Duration','#f3e8ff','#5b21b6','<b>~7.5% p.a.</b> · No lock-in<br>Source: AMFI category average','Groww / Kuvera',true,'Better than savings account. Instant withdrawal.',null)+wCard('Aditya Birla Money Manager','Money Market','#f3e8ff','#5b21b6','<b>~7.3% p.a.</b> · Source: AMFI','Groww / Zerodha Coin',false,'Near-zero risk. 3–6 month buffer.',null)+wCard('ICICI Pru Short Term Fund','Short Duration','#f3e8ff','#5b21b6','<b>~7.8% p.a.</b> · Source: AMFI','Zerodha Coin / Kuvera',false,'2–3 year goals.',null);
    buckets.push({id:'debt',color:'#7c3aed',title:'Debt Mutual Funds',sub:'Low Duration · Money Market · Source: AMFI',amt:debtAmt,pct:alloc.debt_mf,body:`<div class="wi-split-note">SIP <strong>${f(debtAmt)}/month</strong>. Returns source: <a href="https://www.amfiindia.com" target="_blank" style="color:var(--primary)">AMFI India ↗</a>. Category average: <b>7.1% p.a.</b> (AUM-weighted AMFI data)</div><div class="wi-section-hd">Debt fund options</div><div class="wi-cards">${debtCards}</div><div class="wi-why"><b>Why not just FD?</b> Debt MFs are tax-efficient for 20–30% bracket — FD interest taxed yearly, MF gains only on withdrawal. Fully liquid, no premature withdrawal penalty.</div>`});
  }

  const hiAmt=Math.round(investable*(alloc.health_insurance/100));
  if(hiAmt>0){
    const hiCards=wCard('Niva Bupa ReAssure 2.0','Health Insurance','#fce7f3','#9d174d','<b>Unlimited restore</b> · No room rent cap<br>Claim ratio: ~94% (Source: IRDAI)','Policybazaar / Niva Bupa',true,'Best all-round. Unlimited claim restoration.',[['Policybazaar','https://www.policybazaar.com/health-insurance/'],['IRDAI','https://www.irdai.gov.in']])+wCard('Star Health Comprehensive','Health Insurance','#fce7f3','#9d174d','OPD cover · ~90% claim ratio<br>Source: IRDAI annual report','Star Health',false,'Strong for families with OPD.',[['Star Health','https://www.starhealth.in']])+wCard('HDFC ERGO Optima Secure','Health Insurance','#fce7f3','#9d174d','<b>4x cover Day 1</b> · No room rent limit<br>Source: IRDAI','HDFC ERGO',false,'4x cover from day one. Metro-friendly.',[['HDFC ERGO','https://www.hdfcergo.com']])+wCard('NPS Tier-1 (80CCD)','Pension · Tax','#fce7f3','#9d174d','<b>Extra ₹50,000</b> deduction 80CCD(1B)<br>Source: IT Act 1961','NPS Trust / PFRDA',false,'Extra 80C beyond ₹1.5L (old regime).',[['NPS Trust','https://www.npstrust.org.in'],['PFRDA','https://www.pfrda.org.in']]);
    buckets.push({id:'hi',color:'#db2777',title:'Health Insurance & NPS',sub:'Medical Cover · Pension · Source: IRDAI/PFRDA',amt:hiAmt,pct:alloc.health_insurance,body:`<div class="wi-split-note">Spend <strong>${f(hiAmt)}/month</strong>. Claim settlement ratios from <a href="https://www.irdai.gov.in" target="_blank" style="color:var(--primary)">IRDAI annual report ↗</a>. Min cover: ₹10L individual, ₹25L family.</div><div class="wi-section-hd">Health & protection</div><div class="wi-cards">${hiCards}</div><div class="wi-why"><b>Rule of thumb</b>Cover = at least 50% of annual income. One serious illness without insurance can wipe years of savings. Use AI Health Advisor above for personalised plan recommendations.</div>`});
  }

  const disclaimer=`<div class="wi-disclaimer">⚠ <strong>Disclaimer:</strong> Product recommendations are informational only based on publicly available data (May 2025). FinCA is not SEBI-registered. Past returns are not guaranteed. Verify current rates before investing. All ↗ links open official sources (NSE, AMFI, RBI, IRDAI, Screener.in) in a new tab.</div>`;
  document.getElementById('r-where').innerHTML=disclaimer+buckets.map(b=>`<div class="wi-bucket"><div class="wi-hd" onclick="wiToggle('${b.id}')"><div class="wi-hd-left"><div class="wi-color-bar" style="background:${b.color}"></div><div><div class="wi-hd-title">${b.title}</div><div class="wi-hd-sub">${b.sub}</div></div></div><div class="wi-hd-right"><div class="wi-amt">${f(b.amt)}<span style="font-size:.68rem;font-weight:400;color:var(--text-dim)">/mo</span></div><div class="wi-badge">${b.pct}%</div><div class="wi-chev" id="wc-${b.id}">▼</div></div></div><div class="wi-body" id="wb-${b.id}">${b.body}</div></div>`).join('');
  setTimeout(()=>wiToggle('eq'),100);
}

// ── AUTH ─────────────────────────────────────────────────────────────
function updateNavAuth(user){const el=document.getElementById('nav-auth');if(user){const init=(user.displayName||user.email||'U')[0].toUpperCase();const photo=user.photoURL?`<img src="${user.photoURL}" alt="">`:`${init}`;el.innerHTML=`<div class="nav-user-info"><div class="nav-avatar">${photo}</div><span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.75rem;font-weight:600">${user.displayName||user.email.split('@')[0]}</span></div><button class="btn-sm btn-ghost-sm" onclick="openHistory()">History</button><button class="btn-sm btn-danger-sm" onclick="doLogout()">Sign Out</button>`;}else{el.innerHTML=`<button class="btn-sm btn-primary-sm" onclick="goTo('auth')">Sign In</button>`;}}
function switchAuthTab(tab,el){document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));el.classList.add('active');document.getElementById('auth-'+tab).classList.add('active');['login-error','signup-error'].forEach(id=>document.getElementById(id).classList.remove('show'));}
function showAuthError(id,msg){const el=document.getElementById(id);el.textContent=msg;el.classList.add('show');}
async function doLogin(){const email=document.getElementById('login-email').value.trim();const pass=document.getElementById('login-pass').value;if(!email||!pass){showAuthError('login-error','Please enter email and password.');return;}try{await window._signInWithEmailAndPassword(window._auth,email,pass);showToast('Welcome back!');goTo('landing');}catch(e){const m={'auth/user-not-found':'No account found.','auth/wrong-password':'Incorrect password.','auth/invalid-email':'Enter a valid email.','auth/too-many-requests':'Too many attempts. Try later.'};showAuthError('login-error',m[e.code]||'Sign in failed.');}}
async function doSignup(){const name=document.getElementById('signup-name').value.trim();const email=document.getElementById('signup-email').value.trim();const pass=document.getElementById('signup-pass').value;if(!name){showAuthError('signup-error','Please enter your name.');return;}if(!email||!pass){showAuthError('signup-error','Please fill all fields.');return;}if(pass.length<6){showAuthError('signup-error','Password must be at least 6 characters.');return;}try{const cred=await window._createUserWithEmailAndPassword(window._auth,email,pass);await window._setDoc(window._doc(window._db,'users',cred.user.uid),{name,email,createdAt:new Date().toISOString()});showToast('Account created! Welcome to FinCA 🎉');goTo('landing');}catch(e){const m={'auth/email-already-in-use':'Account already exists.','auth/invalid-email':'Enter a valid email.','auth/weak-password':'Password is too weak.'};showAuthError('signup-error',m[e.code]||'Sign up failed.');}}
async function doGoogleLogin(){try{await window._signInWithPopup(window._auth,window._provider);showToast('Signed in with Google!');goTo('landing');}catch(e){if(e.code!=='auth/popup-closed-by-user'){showAuthError('login-error','Google sign-in failed.');showAuthError('signup-error','Google sign-in failed.');}}}
async function doLogout(){await window._signOut(window._auth);window._currentUser=null;showToast('Signed out');goTo('landing');}
async function saveReport(data){if(!window._currentUser)return;try{await window._addDoc(window._collection(window._db,'reports'),{uid:window._currentUser.uid,...data,savedAt:new Date().toISOString()});const t=document.getElementById('save-toast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}catch(e){console.error('Save failed:',e);}}
async function openHistory(){if(!window._currentUser){goTo('auth');return;}document.getElementById('history-modal').classList.add('open');const list=document.getElementById('history-list');list.innerHTML='<div class="hist-empty">Loading your reports...</div>';try{const q=window._query(window._collection(window._db,'reports'),window._where('uid','==',window._currentUser.uid),window._orderBy('savedAt','desc'),window._limit(10));const snap=await window._getDocs(q);if(snap.empty){list.innerHTML='<div class="hist-empty">No saved reports yet.<br>Generate a report and it saves automatically.</div>';return;}list.innerHTML=snap.docs.map(d=>{const r=d.data();const date=new Date(r.savedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});return`<div class="hist-item" onclick="loadReport(${JSON.stringify(r).replace(/"/g,'&quot;')})"><div class="hist-date">${date}</div><div class="hist-name">${r.name||'Report'}</div><div class="hist-meta">Age ${r.age||'—'} · ${r.risk||'moderate'} risk · ${r.regime||'new'} regime</div><div class="hist-corpus">Likely corpus: ${fmt(r.corpusLikely)}</div></div>`;}).join('');}catch(e){list.innerHTML='<div class="hist-empty">Could not load history.</div>';console.error(e);}}
function closeHistory(){document.getElementById('history-modal').classList.remove('open');}
function loadReport(r){closeHistory();if(r.name)document.getElementById('f-name').value=r.name;if(r.age)document.getElementById('f-age').value=r.age;if(r.income)document.getElementById('f-income').value=r.income;if(r.goal)document.getElementById('f-goal').value=r.goal;if(r.savings)document.getElementById('f-savings').value=r.savings;if(r.growth)document.getElementById('f-growth').value=r.growth;if(r.rent)document.getElementById('f-rent').value=r.rent;if(r.emi)document.getElementById('f-emi').value=r.emi;if(r.groceries)document.getElementById('f-groceries').value=r.groceries;if(r.utilities)document.getElementById('f-utilities').value=r.utilities;if(r.deps)document.getElementById('f-deps').value=r.deps;if(r.lifestyle)document.getElementById('f-lifestyle').value=r.lifestyle;if(r.regime){const btn=document.getElementById('regime-'+(r.regime||'new'));if(btn)setRegime(r.regime,btn);}showToast('Report loaded — click Generate to recalculate');goTo('profile');}
function resetAll(){selRisk='moderate';selHealth='no';selRegime='new';loanCount=0;document.getElementById('loans-container').innerHTML='';const sp=document.getElementById('surplus-preview');if(sp)sp.style.display='none';const cb=document.getElementById('risk-consent-cb');if(cb)cb.checked=false;const btn=document.getElementById('btn-generate-main');if(btn)btn.disabled=true;}
