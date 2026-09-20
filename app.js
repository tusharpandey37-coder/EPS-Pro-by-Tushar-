/* =====================================================================
   EPS-95 PENSION CALCULATION TOOL — UI  v4
   All calculation logic in engine.js (window.EPS95Engine)
   ===================================================================== */

/* ---- TABS ---- */
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---- LEDGER ---- */
let rowCounter = 0;

function makeLedgerRow(p = {}) {
  rowCounter++;
  const tr = document.createElement('tr');
  tr.dataset.row = rowCounter;
  tr.innerHTML = `
    <td class="sl-num"></td>
    <td><input type="text"   class="r-emp"    value="${p.employer  ||''}" placeholder="Employer / Member ID"></td>
    <td><input type="date"   class="r-doj"    value="${p.doj       ||''}"></td>
    <td><input type="date"   class="r-doe"    value="${p.doe       ||''}"></td>
    <td><input type="number" class="r-bis"    value="${p.bis       ??0}" min="0"></td>
    <td><input type="number" class="r-ncpPre" value="${p.ncpPre    ??0}" min="0"></td>
    <td><input type="number" class="r-ncpPost"value="${p.ncpPost   ??0}" min="0"></td>
    <td><input type="number" class="r-ncp12"  value="${p.ncpLast12 ??0}" min="0"></td>
    <td><input type="number" class="r-ncp60"  value="${p.ncpLast60 ??0}" min="0"></td>
    <td class="preview-cell">—</td>
    <td class="remove-cell"><button type="button" class="row-remove" title="Remove">×</button></td>`;
  tr.querySelector('.row-remove').addEventListener('click', () => {
    tr.remove(); renumberLedger(); refreshLedger();
  });
  tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', refreshLedger));
  return tr;
}

function addLedgerRow(preset = {}) {
  document.getElementById('ledgerBody').appendChild(makeLedgerRow(preset));
  renumberLedger();
  refreshLedger();
}

function renumberLedger() {
  document.querySelectorAll('#ledgerBody tr').forEach((tr, i) => {
    tr.querySelector('.sl-num').textContent = i + 1;
  });
}

function readSpells() {
  return Array.from(document.querySelectorAll('#ledgerBody tr')).map(tr => ({
    doj:      tr.querySelector('.r-doj').value,
    doe:      tr.querySelector('.r-doe').value,
    bis:      parseFloat(tr.querySelector('.r-bis').value)     || 0,
    ncpPre:   parseFloat(tr.querySelector('.r-ncpPre').value)  || 0,
    ncpPost:  parseFloat(tr.querySelector('.r-ncpPost').value) || 0,
    ncpLast12:parseFloat(tr.querySelector('.r-ncp12').value)   || 0,
    ncpLast60:parseFloat(tr.querySelector('.r-ncp60').value)   || 0,
    _tr: tr
  }));
}

function refreshLedger() {
  const E = window.EPS95Engine;
  const spells = readSpells();

  /* per-row preview */
  spells.forEach(s => {
    const cell = s._tr.querySelector('.preview-cell');
    if (!s.doj || !s.doe) { cell.textContent = '—'; return; }
    const doj = E.parseDate(s.doj), doe = E.parseDate(s.doe);
    if (!doj || !doe || E.cmpDate(doe, doj) < 0) { cell.textContent = '!'; return; }
    const c = E.calcRow(doj, doe);
    const p = Math.max(0, c.pre2014Actual - s.ncpPre) + Math.max(0, c.post2014Actual - s.ncpPost);
    cell.textContent = (c.pastGross - s.bis + p).toLocaleString('en-IN') + ' d (net)';
  });

  /* aggregate for totals and auto-NCP fill */
  const agg = E.aggregateSpells(spells);

  /* auto-fill NCP display fields */
  document.getElementById('ncp12Display').value = agg.ncpLast12;
  document.getElementById('ncp60Display').value = agg.ncpLast60;

  /* show/hide 12 vs 60-month wage section */
  const exitBefore = agg.lastExit && E.cmpDate(agg.lastExit, E.C2014_START) < 0;
  document.getElementById('wage12section').hidden = !exitBefore;
  document.getElementById('wage60section').hidden =  exitBefore;

  /* totals line */
  const totEl = document.getElementById('ledgerTotals');
  if (agg.lastExit) {
    const pre  = Math.max(0, agg.pre2014Actual  - agg.ncpPre);
    const post = Math.max(0, agg.post2014Actual - agg.ncpPost);
    totEl.textContent =
      `Totals — past service gross: ${agg.pastGross.toLocaleString('en-IN')} d` +
      (agg.bis ? `, BIS: ${agg.bis}, net: ${agg.pastNet.toLocaleString('en-IN')} d` : '') +
      ` · actual EPS service: ${agg.totalActual.toLocaleString('en-IN')} d` +
      ` (pre-2014: ${agg.pre2014Actual.toLocaleString('en-IN')}, post-2014: ${agg.post2014Actual.toLocaleString('en-IN')})` +
      ` · pensionable net of NCP: ${(agg.pastNet+pre).toLocaleString('en-IN')} + ${post.toLocaleString('en-IN')}`;
  } else {
    totEl.textContent = '';
  }

  refreshExitStatus(agg);
}

/* ---- EXIT STATUS CARD (live) ---- */
function refreshExitStatus(agg) {
  const E    = window.EPS95Engine;
  const card = document.getElementById('exitStatusCard');
  const line = document.getElementById('exitStatusLine');
  const dob  = E.parseDate(document.getElementById('dob').value);

  if (!dob || !agg || !agg.lastExit) {
    card.className = 'status-card status-neutral';
    line.innerHTML = 'Enter date of birth and at least one service row to see the pension commencement date.';
    return;
  }

  const comm = E.superannuationDate(dob);
  const pre  = Math.max(0, agg.pre2014Actual - agg.ncpPre);
  const post = Math.max(0, agg.post2014Actual - agg.ncpPost);
  const post95Yrs = Math.round((pre + post) / 365);
  const wtOk = post95Yrs >= 20;
  const age  = E.attainedAge(dob, agg.lastExit);

  card.className = 'status-card';
  const deferNote = age < 58
    ? `Member exited service at age ${age}. `
    : ``;
  line.innerHTML =
    `<strong>Superannuation pension commences on ${E.fmtDate(comm)}</strong> (member's 58th birthday). ` +
    deferNote +
    (wtOk
      ? `2-year weightage applies — ${post95Yrs} years of post-1995 pensionable service ≥ 20.`
      : `No 2-year weightage — post-1995 pensionable service is ${post95Yrs} year${post95Yrs!==1?'s':''} (needs 20+).`);
}

/* ---- FORMAT HELPERS ---- */
const money = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const num   = n => Number(n).toLocaleString('en-IN');

/* ---- MAIN CALCULATION ---- */
let lastResult = null;

function runCalculation() {
  const E = window.EPS95Engine;
  const spells = readSpells();
  const params = {
    spells,
    dob:        document.getElementById('dob').value,
    wage1995:   parseFloat(document.getElementById('wage1995').value)   || 0,
    preCeiling: parseFloat(document.getElementById('preCeiling').value) || 6500,
    sum12:      parseFloat(document.getElementById('sum12').value)      || 0,
    ncp12:      parseFloat(document.getElementById('ncp12Display').value)|| 0,
    sum60:      parseFloat(document.getElementById('sum60').value)      || 0,
    ncp60:      parseFloat(document.getElementById('ncp60Display').value)|| 0,
  };

  const result = E.calculate(params);

  const panel     = document.getElementById('resultsPanel');
  const errBanner = document.getElementById('ineligibleBanner');
  const goodResult= document.getElementById('eligibleResult');
  panel.hidden = false;

  if (!result.ok) {
    errBanner.hidden = false; goodResult.hidden = true;
    if (result.reason === 'incomplete') {
      errBanner.innerHTML = '<strong>Cannot calculate yet.</strong> Enter date of birth and at least one valid service row (exit on or after joining).';
    } else {
      const y = Math.floor(result.eligibleDays/365), m = Math.floor((result.eligibleDays%365)/30), d = (result.eligibleDays%365)%30;
      errBanner.innerHTML =
        `<strong>Not eligible for monthly pension.</strong> ` +
        `Total eligible service is ${y}y ${m}m ${d}d (${result.eligibleDays} days), ` +
        `short of the minimum 9 years 6 months (rounds to 10 years). ` +
        `This is a withdrawal-benefit case — no monthly pension is payable.`;
    }
    lastResult = null; return;
  }

  errBanner.hidden = true; goodResult.hidden = false;

  /* Status card */
  const sc = document.getElementById('pensionStatusCard');
  sc.className = 'status-card';
  sc.innerHTML =
    `<strong>Superannuation pension.</strong> ` +
    `Pension commences on <strong>${E.fmtDate(result.commencement)}</strong> (member's 58th birthday). ` +
    (result.weightageEligible
      ? `2-year weightage (730 days) applied — ${result.post95YearsRounded} years of post-1995 pensionable service ≥ 20.`
      : `No 2-year weightage — post-1995 pensionable service is ${result.post95YearsRounded} year${result.post95YearsRounded!==1?'s':''} (needs 20+).`);

  /* Tiles */
  document.getElementById('finalPension').textContent       = money(result.final);
  document.getElementById('minPensionNote').textContent     = result.minPensionApplied ? `Raised from ${money(result.original)} to the ₹1,000 statutory minimum.` : '';
  document.getElementById('pastServiceBenefit').textContent = money(result.psb);
  document.getElementById('formulaPension').textContent     = money(result.fp);
  document.getElementById('weightageDays').textContent      = `${result.weightageDays} days`;
  const ey = Math.floor(result.eligibleDays/365), em = Math.floor((result.eligibleDays%365)/30);
  document.getElementById('eligibleServiceOut').textContent = `${ey}y ${em}m (${num(result.eligibleDays)} days)`;
  document.getElementById('commencementOut').textContent    = E.fmtDate(result.commencement);

  /* Snapshot */
  const agg = result.agg;
  const ncpNote = (result.numMonths === 60 && agg.ncpLast60 > 0)
    ? `<small style="color:#7A5A00;display:block;margin-top:4px">Note: NCP entered as ${agg.ncpLast60} calendar days. EPFO counts each NCP month as 30 days in service calculations, so if NCP spans a 31-day month, EPFO's worksheet may show up to 1 day more service and up to ₹1 more pension — a known EPFO convention, not an error here.</small>`
    : '';

  document.getElementById('snapshotList').innerHTML = `
    ${result.pastApplicable ? `
    <dt>Past service (before 16-11-1995)</dt>
    <dd>
      Gross: ${num(agg.pastGross)} days
      ${agg.bis ? `&minus; BIS ${num(agg.bis)} = <strong>${num(agg.pastNet)} days net</strong>` : ''}
      &rarr; ${result.pastYearsFloor} completed years &rarr; ${result.wageOver2500?'>':'&le;'} ₹2,500 slab
      &rarr; multiplier = <strong>${result.multiplier}</strong>
    </dd>
    <dt>Table B — years from 16-11-1995 to 58th birthday (${E.fmtDate(result.commencement)})</dt>
    <dd>${result.tbYears} completed years &rarr; Table B factor = <strong>${result.tbFactor}</strong></dd>
    <dt>Past Service Benefit = multiplier × Table B factor</dt>
    <dd>${result.multiplier} × ${result.tbFactor} = <strong>${money(result.psb)}</strong></dd>`
    : `<dt>Past service benefit</dt><dd>Not applicable — no service before 16-11-1995</dd>`}

    <dt>Actual EPS service since 16-11-1995 (gross, before NCP)</dt>
    <dd>${num(agg.totalActual)} days total (pre-2014: ${num(agg.pre2014Actual)}, post-2014: ${num(agg.post2014Actual)})</dd>

    <dt>Pensionable service [pre-2014] = actual − NCP pre-2014</dt>
    <dd>${num(agg.pre2014Actual)} − ${num(agg.ncpPre)} = <strong>${num(result.pre2014Pensionable)} days</strong></dd>

    <dt>Pensionable service [post-2014] = (total − pre-2014) − NCP post-2014</dt>
    <dd>(${num(agg.totalActual)} − ${num(agg.pre2014Actual)}) − ${num(agg.ncpPost)}
        = ${num(agg.post2014Actual)} − ${num(agg.ncpPost)}
        = <strong>${num(result.post2014Pensionable)} days</strong>${ncpNote}</dd>

    <dt>Average pensionable salary — ${result.numMonths}-month window
        ${result.exitBeforeSep2014 ? '(exit before 01-09-2014)' : '(exit on/after 01-09-2014)'}</dt>
    <dd>${result.avgFormula} = <strong>${money(result.avg)}</strong></dd>

    <dt>Weightage — 730 days when post-1995 pensionable service rounds to ≥ 20 years</dt>
    <dd>${result.post95YearsRounded} years &rarr; <strong>${result.weightageDays} days</strong>
        ${result.weightageEligible ? '' : '(condition not met)'}</dd>

    <dt>Formula pension = [(pre-2014 × min(salary, ${num(result.cappedAvg)}))
        + (weightage × min(salary, ${num(result.cappedAvg)}))
        + (post-2014 × salary)] ÷ (365 × 70)</dt>
    <dd>((${num(result.pre2014Pensionable)} × ${num(result.cappedAvg)})
        + (${num(result.weightageDays)} × ${num(result.cappedAvg)})
        + (${num(result.post2014Pensionable)} × ${num(result.avg)}))
        ÷ (365 × 70) = <strong>${money(result.fp)}</strong></dd>

    <dt>Total = Past Service Benefit + Formula Pension</dt>
    <dd>${money(result.psb)} + ${money(result.fp)} = ${money(result.original)}
        ${result.minPensionApplied ? `→ raised to <strong>${money(result.final)}</strong> (₹1,000 minimum)` : `= <strong>${money(result.final)}</strong>`}</dd>
  `;

  lastResult = { finalPension: result.final, commencement: result.commencement };
  pushToArrears();
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---- ARREARS ---- */
function toISO(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function pushToArrears() {
  if (!lastResult) return;
  document.getElementById('arrPension').value      = lastResult.finalPension;
  document.getElementById('arrCommencement').value = toISO(lastResult.commencement);
  const E = window.EPS95Engine;
  if (!document.getElementById('arrUpto').value) {
    document.getElementById('arrUpto').value = toISO(E.endOfMonth(new Date()));
  }
}

function runArrears() {
  const E      = window.EPS95Engine;
  const pension= parseFloat(document.getElementById('arrPension').value) || 0;
  const comm   = document.getElementById('arrCommencement').value;
  const upto   = document.getElementById('arrUpto').value;
  const res    = document.getElementById('arrearsResults');
  const arr    = E.calculateArrears(pension, comm, upto);
  if (!arr) { res.hidden = true; return; }
  document.getElementById('arrPart').textContent    = money(arr.part);
  document.getElementById('arrMonths').textContent  = arr.fullMonths;
  document.getElementById('arrFullAmt').textContent = money(arr.fullAmt);
  document.getElementById('arrTotal').textContent   = money(arr.total);
  res.hidden = false;
}

/* ---- READ ME ---- */
function buildReadme() {
  document.getElementById('readmeContent').innerHTML = `
  <h3>What this tool calculates</h3>
  <p>The member's own EPS-95 monthly pension — past service benefit plus formula pension — subject to the ₹1,000 statutory minimum, plus initial arrears. Early pension (with the 4%/year reduction) and family/widow/children/orphan pension are not covered.</p>

  <h3>Eligibility</h3>
  <p>Total eligible service <strong>excluding NCP</strong> (past service net of BIS + pensionable service since 16-11-1995) must round to at least 10 years. Below this, the case is a withdrawal-benefit case only and no monthly pension applies.</p>

  <h3>Pension commencement date</h3>
  <p>Always the member's <strong>58th birthday</strong> (DOB + 58 years), regardless of when service ended. A member who retires exactly at 58 draws pension from that day; a member who left earlier draws it only from the 58th birthday.</p>

  <h3>Past service benefit (for service before 16-11-1995)</h3>
  <p>Net past service days = gross days (computed with EPFO's 30-day borrow convention) − BIS (Break in Service). The multiplier is chosen from the wage-on-15-11-1995 slab and completed years of net past service. The Table B factor is looked up by the number of <strong>complete calendar years from 16-11-1995 to the member's 58th birthday</strong> — not from the date of exit. This is the EPFO scheme's design and produces the correct factor in all three verified cases.</p>

  <h3>Multiplier table (all values confirmed from the official scheme table)</h3>
  <table class="ref-table" style="max-width:500px;margin:8px 0">
    <thead><tr><th>Past service (completed years)</th><th>Wage ≤ ₹2,500</th><th>Wage &gt; ₹2,500</th></tr></thead>
    <tbody>
      <tr><td>Up to 11 years</td><td>80</td><td>85</td></tr>
      <tr><td>More than 11, up to 15 years</td><td>95</td><td>105</td></tr>
      <tr><td>More than 15, less than 20 years</td><td>120</td><td>135</td></tr>
      <tr><td>Beyond 20 years</td><td>150</td><td>170</td></tr>
    </tbody>
  </table>

  <h3>Weightage</h3>
  <p>730 days added when post-1995 pensionable service (16-11-1995 to date of exit, net of NCP) rounds to <strong>20 or more years</strong>.</p>

  <h3>Wage window — 12 months vs 60 months</h3>
  <p>If the exit date is <strong>before 01-09-2014</strong>: average pensionable salary = (sum of last 12 months' EPS wages × 30) ÷ (365 − NCP in last 12 months).</p>
  <p>If the exit date is <strong>on or after 01-09-2014</strong>: average pensionable salary = sum of last 60 months' EPS wages ÷ 60, or (sum × 30) ÷ (1825 − NCP) when NCP &gt; 0.</p>
  <p>The tool switches between these automatically based on the exit date detected from the ledger.</p>

  <h3>BIS (Break in Service)</h3>
  <p>Enter BIS days in the ledger column. BIS is subtracted from the gross past service days before the multiplier bracket and Table B lookup.</p>

  <h3>Day-count conventions</h3>
  <p>EPS service is computed as (exit date + 1) − joining date, then valued as years×365 + months×30 + days (calendar-day borrow). Past service uses the same formula but borrows 30 days when d&lt;0 — matching the EPFO scheme's convention. These conventions reproduce EPFO's own worksheet figures for all three verified cases.</p>

  <h3>Known ±₹1 rounding</h3>
  <p>When NCP spans 31-day months, EPFO's system counts each NCP month as 30 days internally but displays calendar days. The tool uses the calendar figure entered by the user, so results may differ from EPFO's worksheet by ±₹1 at a rounding boundary. The snapshot flags this when relevant.</p>

  `;
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  buildReadme();

  /* Start with a blank form — user fills in their own data */
  document.getElementById('addRowBtn').onclick = () => addLedgerRow();
  addLedgerRow(); // one blank row to start

  document.getElementById('dob').addEventListener('input', () => {
    const agg = window.EPS95Engine.aggregateSpells(readSpells());
    refreshExitStatus(agg);
  });
  document.getElementById('calculateBtn').onclick = runCalculation;
  document.getElementById('arrearsBtn').onclick   = runArrears;
  document.getElementById('arrUpto').addEventListener('input', runArrears);
});
