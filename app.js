/* =====================================================================
   EPS-95 PENSION CALCULATION TOOL  –  UI
   All calculation logic lives in engine.js.
   ===================================================================== */

/* ------------------------------------------------------------------
   TABS
------------------------------------------------------------------- */
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

/* ------------------------------------------------------------------
   REFERENCE TABLES (editable; engine reads them live at calc time)
------------------------------------------------------------------- */
function buildReferenceTables() {
  const E = window.EPS95Engine;

  const tbBody = document.querySelector('#tableBGrid tbody');
  tbBody.innerHTML = E.TABLE_B_DEFAULT.map((v, i) => {
    const cls = i === 30 ? ' class="flagged"' : '';
    const title = i === 30
      ? ' title="Corrected to 10.487 per confirmed EPFO worksheet figures — see Read Me"' : '';
    return `<tr><td style="text-align:center">${i}</td>
      <td${cls}><input type="number" step="0.00001" value="${v}"${title}></td></tr>`;
  }).join('');

  const mBody = document.querySelector('#multiplierGrid tbody');
  mBody.innerHTML = E.MULT_ROWLABEL.map((label, i) => {
    const loCls = E.MULT_FLAGGED.low[i]  ? ' class="flagged"' : '';
    const hiCls = E.MULT_FLAGGED.high[i] ? ' class="flagged"' : '';
    return `<tr><td>${label}</td>
      <td${loCls}><input type="number" class="mult-low"  value="${E.MULT_DEFAULT.low[i]}"></td>
      <td${hiCls}><input type="number" class="mult-high" value="${E.MULT_DEFAULT.high[i]}"></td></tr>`;
  }).join('');
}

function readTableB() {
  return Array.from(document.querySelectorAll('#tableBGrid tbody input'))
    .map(i => parseFloat(i.value) || 0);
}
function readMultiplier() {
  const low = [], high = [];
  document.querySelectorAll('#multiplierGrid tbody tr').forEach(r => {
    low.push(parseFloat(r.querySelector('.mult-low').value)  || 0);
    high.push(parseFloat(r.querySelector('.mult-high').value) || 0);
  });
  return { low, high };
}

/* ------------------------------------------------------------------
   SERVICE LEDGER
------------------------------------------------------------------- */
let rowCounter = 0;

function makeLedgerRow(preset = {}) {
  rowCounter++;
  const tr = document.createElement('tr');
  tr.dataset.row = rowCounter;
  tr.innerHTML = `
    <td class="sl-num"></td>
    <td><input type="text"   class="r-emp"      value="${preset.employer  || ''}" placeholder="Employer / Member ID"></td>
    <td><input type="date"   class="r-doj"      value="${preset.doj       || ''}"></td>
    <td><input type="date"   class="r-doe"      value="${preset.doe       || ''}"></td>
    <td><input type="number" class="r-ncpPre"   value="${preset.ncpPre   ?? 0}" min="0"></td>
    <td><input type="number" class="r-ncpPost"  value="${preset.ncpPost  ?? 0}" min="0"></td>
    <td><input type="number" class="r-ncpL60"   value="${preset.ncpLast60?? 0}" min="0"></td>
    <td class="preview-cell">—</td>
    <td class="remove-cell"><button type="button" class="row-remove" title="Remove">×</button></td>`;
  tr.querySelector('.row-remove').addEventListener('click', () => {
    tr.remove(); renumberLedger(); refreshLedgerPreview();
  });
  tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', refreshLedgerPreview));
  return tr;
}

function addLedgerRow(preset = {}) {
  document.getElementById('ledgerBody').appendChild(makeLedgerRow(preset));
  renumberLedger();
  refreshLedgerPreview();
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
    ncpPre:   parseFloat(tr.querySelector('.r-ncpPre').value)  || 0,
    ncpPost:  parseFloat(tr.querySelector('.r-ncpPost').value) || 0,
    ncpLast60:parseFloat(tr.querySelector('.r-ncpL60').value)  || 0,
    _tr: tr
  }));
}

function refreshLedgerPreview() {
  const E = window.EPS95Engine;
  const spells = readSpells();

  spells.forEach(s => {
    const cell = s._tr.querySelector('.preview-cell');
    if (!s.doj || !s.doe) { cell.textContent = '—'; return; }
    const doj = E.parseDate(s.doj), doe = E.parseDate(s.doe);
    if (!doj || !doe || E.cmpDate(doe, doj) < 0) { cell.textContent = '!'; return; }
    const c = E.calcRow(doj, doe);
    const p = Math.max(0, c.pre2014Actual - s.ncpPre) + Math.max(0, c.post2014Actual - s.ncpPost);
    cell.textContent = (c.past + p).toLocaleString('en-IN') + ' d';
  });

  // aggregate & push ncpLast60 total
  const agg = E.aggregateSpells(spells);
  document.getElementById('ncpLast60Display').value = agg.ncpLast60;

  const totEl = document.getElementById('ledgerTotals');
  if (agg.lastExit) {
    const pre  = Math.max(0, agg.pre2014Actual  - agg.ncpPre);
    const post = Math.max(0, agg.post2014Actual - agg.ncpPost);
    totEl.textContent =
      `Totals — past service: ${agg.past.toLocaleString('en-IN')} d · ` +
      `actual service since 16-11-1995: ${agg.totalActual.toLocaleString('en-IN')} d ` +
      `(pre-2014: ${agg.pre2014Actual.toLocaleString('en-IN')}, post-2014: ${agg.post2014Actual.toLocaleString('en-IN')}) · ` +
      `pensionable net of NCP: ${(agg.past+pre).toLocaleString('en-IN')} + ${post.toLocaleString('en-IN')}`;
  } else {
    totEl.textContent = '';
  }

  refreshExitStatus(agg);
}

/* ------------------------------------------------------------------
   EXIT STATUS CARD (live, no button required)
------------------------------------------------------------------- */
function refreshExitStatus(agg) {
  const E = window.EPS95Engine;
  const card = document.getElementById('exitStatusCard');
  const line = document.getElementById('exitStatusLine');
  const dob  = E.parseDate(document.getElementById('dob').value);

  if (!dob || !agg || !agg.lastExit) {
    card.className = 'status-card status-neutral';
    line.innerHTML = 'Enter date of birth and at least one complete service row to see the pension commencement date.';
    return;
  }

  const age   = E.attainedAge(dob, agg.lastExit);
  const a58   = E.age58Date(dob);
  const pre   = Math.max(0, agg.pre2014Actual - agg.ncpPre);
  const post  = Math.max(0, agg.post2014Actual - agg.ncpPost);
  const post95Yrs = Math.round((pre + post) / 365);
  const wtOk = post95Yrs >= 20;

  if (age >= 58) {
    card.className = 'status-card';
    line.innerHTML =
      `<strong>Member is 58 at exit (${E.fmtDate(agg.lastExit)}).</strong> ` +
      `Pension commences ${E.fmtDate(E.addDays(agg.lastExit, 1))}, the day after exit. ` +
      (wtOk
        ? `2-year weightage applies — ${post95Yrs} years of post-1995 pensionable service ≥ 20.`
        : `No 2-year weightage — post-1995 pensionable service is ${post95Yrs} year${post95Yrs !== 1 ? 's' : ''} (needs 20+).`);
  } else {
    card.className = 'status-card';
    line.innerHTML =
      `<strong>Member is ${age} at exit (${E.fmtDate(agg.lastExit)}) — pension is deferred.</strong> ` +
      `Superannuation pension commences on <strong>${E.fmtDate(a58)}</strong> ` +
      `(when the member is deemed to attain 58 — the day before the 58th birthday anniversary). ` +
      `No 2-year weightage — weightage requires 20+ years of post-1995 pensionable service; ` +
      `this member has ${post95Yrs}.`;
  }
}

/* ------------------------------------------------------------------
   FORMAT HELPERS
------------------------------------------------------------------- */
function money(n) { return '₹' + Math.round(n || 0).toLocaleString('en-IN'); }

/* ------------------------------------------------------------------
   MAIN CALCULATION (triggered by button)
------------------------------------------------------------------- */
let lastResult = null;

function runCalculation() {
  const E          = window.EPS95Engine;
  const spells     = readSpells();
  const dob        = document.getElementById('dob').value;
  const wage1995   = parseFloat(document.getElementById('wage1995').value)   || 0;
  const preCeiling = parseFloat(document.getElementById('preCeiling').value) || 6500;
  const sum60      = parseFloat(document.getElementById('sum60').value)      || 0;

  const result = E.calculate({
    spells, dob, wage1995, preCeiling, sum60,
    tableB: readTableB(), mult: readMultiplier()
  });

  const panel      = document.getElementById('resultsPanel');
  const errBanner  = document.getElementById('ineligibleBanner');
  const goodResult = document.getElementById('eligibleResult');
  panel.hidden = false;

  if (!result.ok) {
    errBanner.hidden = false; goodResult.hidden = true;
    if (result.reason === 'incomplete') {
      errBanner.innerHTML = '<strong>Cannot calculate yet.</strong> Enter date of birth and at least one valid service row (exit on or after joining).';
    } else {
      const y = Math.floor(result.eligibleDays / 365);
      const m = Math.floor((result.eligibleDays % 365) / 30);
      const d = (result.eligibleDays % 365) % 30;
      errBanner.innerHTML =
        `<strong>Not eligible for monthly pension.</strong> ` +
        `Total service excluding NCP is ${y}y ${m}m ${d}d (${result.eligibleDays} days), ` +
        `short of the minimum 9 years 6 months (rounds to 10 years). ` +
        `This is a withdrawal-benefit case — no monthly pension applies.`;
    }
    lastResult = null; return;
  }

  errBanner.hidden = true; goodResult.hidden = false;

  // Status card
  const sc = document.getElementById('pensionStatusCard');
  sc.className = 'status-card';
  const deferNote = result.ageAtExit < 58
    ? ` Member exited service at age ${result.ageAtExit}. Pension commences on <strong>${E.fmtDate(result.commencement)}</strong> (when the member attains age 58).`
    : ` Pension commences ${E.fmtDate(result.commencement)} (the day after exit).`;
  const wtNote = result.weightageEligible
    ? ` 2-year weightage (730 days) applied — ${result.post95YearsRounded} years of post-1995 pensionable service ≥ 20.`
    : ` No 2-year weightage — post-1995 pensionable service is ${result.post95YearsRounded} year${result.post95YearsRounded !== 1 ? 's' : ''} (needs 20+).`;
  sc.innerHTML = `<strong>Superannuation pension.</strong>${deferNote}${wtNote}`;

  // Tiles
  const n = v => Number(v).toLocaleString('en-IN');
  document.getElementById('finalPension').textContent = money(result.final);
  document.getElementById('minPensionNote').textContent =
    result.minPensionApplied ? `Raised from ${money(result.original)} to the ₹1,000 statutory minimum.` : '';
  document.getElementById('pastServiceBenefit').textContent = money(result.psb);
  document.getElementById('formulaPension').textContent     = money(result.fp);
  document.getElementById('weightageDays').textContent      = `${result.weightageDays} days`;
  const ey = Math.floor(result.eligibleDays / 365);
  const em = Math.floor((result.eligibleDays % 365) / 30);
  document.getElementById('eligibleServiceOut').textContent =
    `${ey}y ${em}m (${n(result.eligibleDays)} days)`;
  document.getElementById('commencementOut').textContent = E.fmtDate(result.commencement);

  // Calculation snapshot — IDS worksheet style
  const ncpQuirk = result.agg.ncpLast60 > 0
    ? `<small style="color:#7A5A00;display:block;margin-top:4px">Note: NCP entered as ${result.agg.ncpLast60} calendar days. EPFO counts each NCP month as 30 days in service calculations (e.g. May = 30, not 31), so EPFO's own worksheet may show a figure 1 day higher and consequently up to ₹1 more pension — a known EPFO internal convention, not a calculation error here.</small>`
    : '';

  document.getElementById('snapshotList').innerHTML = `
    <dt>Actual service since 16-11-1995 (gross — used for Table B lookup)</dt>
    <dd>${n(result.agg.totalActual)} days → completed years = ${result.actYearsFloor} → Table B factor = ${result.tbFactor}</dd>

    <dt>Pensionable service [pre-2014] = actual − NCP pre-2014</dt>
    <dd>${n(result.agg.pre2014Actual)} − ${n(result.agg.ncpPre)} = <strong>${n(result.pre2014Pensionable)} days</strong></dd>

    <dt>Pensionable service [post-2014] = (total actual − pre-2014 actual) − NCP post-2014</dt>
    <dd>(${n(result.agg.totalActual)} − ${n(result.agg.pre2014Actual)}) − ${n(result.agg.ncpPost)} = ${n(result.agg.post2014Actual)} − ${n(result.agg.ncpPost)} = <strong>${n(result.post2014Pensionable)} days</strong>${ncpQuirk}</dd>

    ${result.pastApplicable ? `
    <dt>Past service benefit = multiplier × Table B factor</dt>
    <dd>Wage on 15-11-1995 ${result.wageOver2500 ? '>' : '≤'} ₹2,500 · past service ${result.pastYearsFloor} completed years → multiplier = ${result.multiplier} × ${result.tbFactor} = <strong>${money(result.psb)}</strong></dd>`
    : `<dt>Past service benefit</dt><dd>Not applicable — no service before 16-11-1995</dd>`}

    <dt>Average pensionable salary ${result.agg.ncpLast60 === 0 ? '= sum60 ÷ 60' : '= (sum60 × 30) ÷ (1825 − NCP post-01-09-2014)'}</dt>
    <dd>${result.avgFormula} = <strong>${money(result.avg)}</strong></dd>

    <dt>Weightage = 730 days when post-1995 pensionable service ≥ 20 years (rounded)</dt>
    <dd>${result.post95YearsRounded} years → ${result.weightageEligible ? '<strong>730 days applied</strong>' : '0 days (condition not met)'}</dd>

    <dt>Formula pension = [(pre-2014 × min(salary, ${n(result.cappedAvg)})) + (weightage × min(salary, ${n(result.cappedAvg)})) + (post-2014 × salary)] ÷ (365 × 70)</dt>
    <dd>((${n(result.pre2014Pensionable)} × ${n(result.cappedAvg)}) + (${n(result.weightageDays)} × ${n(result.cappedAvg)}) + (${n(result.post2014Pensionable)} × ${n(result.avg)})) ÷ (365 × 70) = <strong>${money(result.fp)}</strong></dd>

    <dt>Total monthly pension = past service benefit + formula pension</dt>
    <dd>${money(result.psb)} + ${money(result.fp)} = ${money(result.original)}${result.minPensionApplied ? ` → raised to <strong>${money(result.final)}</strong> (₹1,000 minimum)` : ` = <strong>${money(result.final)}</strong>`}</dd>
  `;

  lastResult = { finalPension: result.final, commencement: result.commencement };
  pushToArrears();
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------
   ARREARS
------------------------------------------------------------------- */
function endOfCurrentMonthISO() {
  const n = new Date();
  return window.EPS95Engine.toISO(window.EPS95Engine.endOfMonth(n));
}

function pushToArrears() {
  if (!lastResult) return;
  const E = window.EPS95Engine;
  document.getElementById('arrPension').value      = lastResult.finalPension;
  document.getElementById('arrCommencement').value = E.toISO(lastResult.commencement);
  if (!document.getElementById('arrUpto').value)
    document.getElementById('arrUpto').value = endOfCurrentMonthISO();
}

function runArrears() {
  const E      = window.EPS95Engine;
  const pension = parseFloat(document.getElementById('arrPension').value) || 0;
  const comm    = document.getElementById('arrCommencement').value;
  const upto    = document.getElementById('arrUpto').value;
  const res     = document.getElementById('arrearsResults');
  const arr     = E.calculateArrears(pension, comm, upto);
  if (!arr) { res.hidden = true; return; }
  document.getElementById('arrPart').textContent    = money(arr.part);
  document.getElementById('arrMonths').textContent  = arr.fullMonths;
  document.getElementById('arrFullAmt').textContent = money(arr.fullAmt);
  document.getElementById('arrTotal').textContent   = money(arr.total);
  res.hidden = false;
}

/* ------------------------------------------------------------------
   READ ME
------------------------------------------------------------------- */
function buildReadme() {
  document.getElementById('readmeContent').innerHTML = `
  <h3>What this tool does</h3>
  <p>Calculates a member's own EPS-95 monthly pension — past service benefit plus formula pension, subject to the ₹1,000 statutory minimum — plus the initial arrears. Does not cover family / widow / children / orphan pension or the higher-wage-pension option.</p>

  <h3>Eligibility</h3>
  <p>Total service <strong>excluding NCP</strong> must round to at least 10 years (more than 9 years 6 months). Below that, the case is a withdrawal-benefit case only and no monthly pension applies.</p>

  <h3>Pension commencement</h3>
  <p>Every qualifying member gets superannuation pension — the type is the same regardless of when service ended. If the member is 58 or older at exit, pension commences the day after exit. If the member exited earlier, pension is deferred: it commences on the date the member is deemed to attain 58 (the day before the 58th birthday anniversary, per the Indian legal convention). No user input is needed to distinguish these cases — the tool detects the exit age automatically from the dates entered.</p>

  <h3>Weightage</h3>
  <p>730 days (2 years) are added to the formula pension when post-1995 pensionable service (service from 16-11-1995 to the date of exit, net of NCP) rounds to <strong>20 or more years</strong>. This is the only condition. It does not matter whether the member was still in service at 58 — weightage depends solely on the length of service.</p>

  <h3>Service ledger</h3>
  <p>One row per employment spell, oldest first. Each row is split automatically across the three time buckets. Gaps between spells are simply not counted. The "NCP days post 01-09-2014 (in last 60 months)" column total is carried automatically into the wage-inputs section.</p>

  <h3>Formula for post-2014 pensionable service</h3>
  <p>Post-2014 actual = total actual service (since 16-11-1995) minus pre-2014 actual service. Post-2014 pensionable = post-2014 actual minus NCP post-2014. This subtraction method matches what the EPFO IDS worksheet does.</p>

  <h3>Average pensionable salary</h3>
  <p>When NCP in last 60 months = 0: <code>sum of last-60-month wages ÷ 60</code>. When NCP &gt; 0: <code>(sum × 30) ÷ (1825 − NCP post-01-09-2014 days)</code>. The NCP used in this divisor is the post-2014 NCP that falls within the last 60 months.</p>

  <h3>NCP rounding quirk (±₹1)</h3>
  <p>EPFO's system counts each NCP month as exactly 30 days in the service formula (regardless of whether the calendar month has 30 or 31 days), but uses actual calendar days in the wage-average denominator. When NCP spans a 31-day month, EPFO's own worksheet shows service 1 day higher than simple subtraction gives, which can push the pension ₹1 higher at a rounding boundary. This tool uses calendar days consistently — so results may differ from EPFO's worksheet by ±₹1 when NCP spans a 31-day month. The calculation snapshot flags this when it applies.</p>

  <h3>Arrears</h3>
  <p>Arrears = monthly pension × full months from commencement to cut-off, plus a pro-rated part-month for the commencement month (no pro-rating if pension starts on the 1st). TDS, relief and subsidy are not applied.</p>

  <h3>Verified against</h3>
  <p>Baby S (UAN 100323502431): PSB ₹839, FP ₹4,427, total ₹5,266, arrears ₹21,240 — exact match.<br>
  Sudhakar Sathyamoorthi (UAN 100365645183): avg ₹14,796, FP ₹2,249 (EPFO worksheet: ₹2,250 — ±₹1 from 31-day NCP month convention documented above).</p>
  `;
}

/* ------------------------------------------------------------------
   LOAD EXAMPLE DATA
------------------------------------------------------------------- */
function loadExample() {
  document.getElementById('memberName').value  = 'Baby S';
  document.getElementById('dob').value         = '1968-04-30';
  document.getElementById('wage1995').value    = 2499;
  document.getElementById('preCeiling').value  = 6500;
  document.getElementById('sum60').value       = 900000;
  document.getElementById('ledgerBody').innerHTML = '';
  rowCounter = 0;
  addLedgerRow({ employer: 'Kollam (previous spell)', doj: '1990-07-01', doe: '2021-10-31' });
  addLedgerRow({ employer: 'IREL (present spell)',    doj: '2021-11-01', doe: '2026-04-29' });
  document.getElementById('resultsPanel').hidden   = true;
  document.getElementById('arrearsResults').hidden = true;
}

/* ------------------------------------------------------------------
   INIT
------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  buildReferenceTables();
  buildReadme();
  loadExample();

  document.getElementById('addRowBtn').onclick = () => addLedgerRow();
  document.getElementById('dob').addEventListener('input', refreshLedgerPreview);
  document.getElementById('calculateBtn').onclick = runCalculation;
  document.getElementById('arrearsBtn').onclick   = runArrears;
  document.getElementById('arrUpto').addEventListener('input', runArrears);
});
