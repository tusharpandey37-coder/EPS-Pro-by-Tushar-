/* =====================================================================
   EPS-95 PENSION CALCULATION ENGINE
   Pure functions — no DOM dependencies.
   Works in Node.js (require) and in the browser (script tag → window.EPS95Engine).
   ===================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();          // Node / CommonJS
  } else {
    root.EPS95Engine = factory();        // Browser global
  }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ------------------------------------------------------------------
     DATE HELPERS
  ------------------------------------------------------------------- */
  const REF95       = new Date(1995, 10, 16); // 16-11-1995
  const PAST_END    = new Date(1995, 10, 15); // 15-11-1995
  const C2014_END   = new Date(2014,  7, 31); // 31-08-2014
  const C2014_START = new Date(2014,  8,  1); // 01-09-2014

  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function toISO(dt) {
    if (!dt) return '';
    const y  = dt.getFullYear();
    const m  = String(dt.getMonth() + 1).padStart(2, '0');
    const d  = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(dt, n) {
    const x = new Date(dt); x.setDate(x.getDate() + n); return x;
  }

  function cmpDate(a, b) { return a.getTime() - b.getTime(); }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); } // m 0-based

  function endOfMonth(dt) { return new Date(dt.getFullYear(), dt.getMonth() + 1, 0); }

  function fmtDate(dt) {
    if (!dt) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ------------------------------------------------------------------
     EPFO DAY-COUNT CONVENTION
     Decompose (endInclusive + 1) - start as Y/M/D, value as Y×365 + M×30 + D.
     This is a bookkeeping convention that matches EPFO's own worksheets.
  ------------------------------------------------------------------- */
  function ymd(start, endInclusive) {
    if (!start || !endInclusive || cmpDate(endInclusive, start) < 0) return { y: 0, m: 0, d: 0 };
    const end = addDays(endInclusive, 1);
    let y  = end.getFullYear() - start.getFullYear();
    let m  = end.getMonth()    - start.getMonth();
    let dd = end.getDate()     - start.getDate();
    if (dd < 0) {
      m -= 1;
      const pm = end.getMonth() === 0 ? 11 : end.getMonth() - 1;
      const py = end.getMonth() === 0 ? end.getFullYear() - 1 : end.getFullYear();
      dd += daysInMonth(py, pm);
    }
    if (m < 0) { y -= 1; m += 12; }
    return { y, m, d: dd };
  }

  function ddays(start, endInclusive) {
    const { y, m, d } = ymd(start, endInclusive);
    return y * 365 + m * 30 + d;
  }

  /* Indian legal convention: a person attains an age the day *before* the
     birthday anniversary. Built-in to ymd because we compare against
     (age58Date = dob + 58 years - 1 day). */
  function age58Date(dob) {
    return addDays(new Date(dob.getFullYear() + 58, dob.getMonth(), dob.getDate()), -1);
  }

  function attainedAge(dob, onDate) { return ymd(dob, onDate).y; }

  /* ------------------------------------------------------------------
     REFERENCE DATA (defaults; UI can override)
  ------------------------------------------------------------------- */
  const TABLE_B_DEFAULT = [
    1.039, 1.122, 1.212, 1.309, 1.413, 1.526, 1.649, 1.781, 1.923, 2.077,
    2.243, 2.423, 2.616, 2.826, 3.052, 3.296, 3.560, 3.845, 4.152, 4.485,
    4.843, 5.231, 5.649, 6.101, 6.589, 7.117, 7.686, 8.301, 8.965, 9.682,
    10.487,                              // n=30 corrected per confirmed EPFO worksheet
    11.294, 12.197, 13.173,
    14.2271, 15.36555, 16.59509, 17.92303, 19.35722, 20.90618, 22.57909, 24.38586
  ];

  /* Rows: [<11 yrs, 11–15 yrs, 15–20 yrs, 20+ yrs]
     Confirmed by user: low[0]=80, high[0]=85, high[1]=95.
     Remaining cells flagged as inferred from standard published progression. */
  const MULT_DEFAULT = {
    low:  [80, 90, 100, 110],
    high: [85, 95, 105, 120]
  };
  const MULT_FLAGGED = { low: [false, true, true, true], high: [false, false, true, true] };
  const MULT_ROWLABEL = [
    'Up to 11 years',
    'More than 11, up to 15 years',
    'More than 15, up to 20 years',
    'More than 20 years'
  ];

  function multiplierBracket(pastYearsFloor) {
    if (pastYearsFloor < 11) return 0;
    if (pastYearsFloor < 15) return 1;
    if (pastYearsFloor < 20) return 2;
    return 3;
  }

  /* ------------------------------------------------------------------
     SERVICE LEDGER — per-row calculation
  ------------------------------------------------------------------- */
  function calcRow(doj, doe) {
    if (!doj || !doe || cmpDate(doe, doj) < 0)
      return { past: 0, totalActual: 0, pre2014Actual: 0, post2014Actual: 0 };

    const past = cmpDate(doj, PAST_END) <= 0
      ? ddays(doj, cmpDate(doe, PAST_END) < 0 ? doe : PAST_END)
      : 0;

    const epsStart = cmpDate(doj, REF95) > 0 ? doj : REF95;
    const hasPost95 = cmpDate(doe, REF95) >= 0;
    const totalActual = hasPost95 ? ddays(epsStart, doe) : 0;

    const pre2014Actual = (hasPost95 && cmpDate(epsStart, C2014_END) <= 0)
      ? ddays(epsStart, cmpDate(doe, C2014_END) < 0 ? doe : C2014_END)
      : 0;

    // post2014 via subtraction — matches EPFO's own approach for spells straddling 01-09-2014
    const post2014Actual = totalActual - pre2014Actual;

    return { past, totalActual, pre2014Actual, post2014Actual };
  }

  /* Aggregate an array of spell objects into combined totals.
     Each spell: { doj, doe, ncpPre, ncpPost, ncpLast60 } — all strings or Date. */
  function aggregateSpells(spells) {
    const agg = {
      past: 0, totalActual: 0, pre2014Actual: 0, post2014Actual: 0,
      ncpPre: 0, ncpPost: 0, ncpLast60: 0,
      lastExit: null, valid: true
    };
    spells.forEach(s => {
      const doj = parseDate(s.doj);
      const doe = parseDate(s.doe);
      if (!doj || !doe) return;
      if (cmpDate(doe, doj) < 0) { agg.valid = false; return; }
      const c = calcRow(doj, doe);
      agg.past         += c.past;
      agg.totalActual  += c.totalActual;
      agg.pre2014Actual  += c.pre2014Actual;
      agg.post2014Actual += c.post2014Actual;
      agg.ncpPre    += (Number(s.ncpPre)    || 0);
      agg.ncpPost   += (Number(s.ncpPost)   || 0);
      agg.ncpLast60 += (Number(s.ncpLast60) || 0);
      if (!agg.lastExit || cmpDate(doe, agg.lastExit) > 0) agg.lastExit = doe;
    });
    return agg;
  }

  /* ------------------------------------------------------------------
     MAIN CALCULATION
     Returns a rich result object. UI just renders what it needs.
  ------------------------------------------------------------------- */
  function calculate(params) {
    /* params:
       spells      – array of { doj, doe, ncpPre, ncpPost, ncpLast60 }
       dob         – string YYYY-MM-DD
       wage1995    – number (wage on 15-11-1995)
       preCeiling  – number (default 6500)
       sum60       – number (total EPS wages, last 60 months)
       tableB      – optional array (defaults to TABLE_B_DEFAULT)
       mult        – optional { low, high } (defaults to MULT_DEFAULT)
    */
    const tableB = params.tableB || TABLE_B_DEFAULT;
    const mult   = params.mult   || MULT_DEFAULT;
    const dob    = parseDate(params.dob);
    const preCeil = Number(params.preCeiling) || 6500;
    const sum60   = Number(params.sum60)       || 0;
    const wage1995 = Number(params.wage1995)   || 0;

    const agg = aggregateSpells(params.spells || []);

    if (!dob || !agg.lastExit || !agg.valid) {
      return { ok: false, reason: 'incomplete', agg };
    }

    const pre2014Pensionable  = Math.max(0, agg.pre2014Actual  - agg.ncpPre);
    const post2014Pensionable = Math.max(0, agg.post2014Actual - agg.ncpPost);
    const eligibleDays  = agg.past + pre2014Pensionable + post2014Pensionable;
    const eligibleYears = Math.round(eligibleDays / 365);

    // Minimum 10 eligible years (= more than 9 yr 6 months when rounded)
    if (eligibleYears < 10) {
      return { ok: false, reason: 'ineligible', eligibleDays, eligibleYears, agg };
    }

    // Age at exit (Indian convention: day before birthday counts as attaining that age)
    const ageAtExit = attainedAge(dob, agg.lastExit);

    // Pension commences: if member is 58+ at exit, the very next day; otherwise deferred to age 58
    const commencement = ageAtExit >= 58 ? addDays(agg.lastExit, 1) : age58Date(dob);

    // Weightage: 730 days when post-1995 pensionable service rounds to 20+ years.
    // Rule: superannuation pension is always payable at 58 regardless of when service ended.
    // Weightage depends only on the length of post-1995 pensionable service, not on
    // whether the member was still in service at 58.
    const post95Pensionable     = pre2014Pensionable + post2014Pensionable;
    const post95YearsRounded    = Math.round(post95Pensionable / 365);
    const weightageEligible     = post95YearsRounded >= 20;
    const weightageDays         = weightageEligible ? 730 : 0;

    // Average pensionable salary.
    // When no NCP in last 60 months:  sum60 / 60
    // When NCP present:               (sum60 × 30) / (1825 − NCP_post2014_in_last60)
    // Note: EPFO counts each NCP month as 30 days in the service formula, but uses
    // the actual calendar-day figure in the wage-average denominator. With a single
    // NCP input field the tool uses the same figure for both; in edge cases where
    // NCP spans 31-day months, the service result may differ from EPFO by ±1 day
    // (and consequently by up to ±₹1 of pension). See the snapshot note.
    let avg, avgFormula;
    if (agg.ncpLast60 === 0) {
      avg        = Math.round(sum60 / 60);
      avgFormula = `${sum60} / 60 = ${avg}`;
    } else {
      const denom = 1825 - agg.ncpLast60;
      avg        = denom > 0 ? Math.round(sum60 * 30 / denom) : 0;
      avgFormula = `(${sum60} × 30) / (1825 − ${agg.ncpLast60}) = ${avg}`;
    }

    // Past service benefit
    const pastApplicable  = agg.past > 0;
    const wageOver2500    = wage1995 > 2500;
    const pastYearsFloor  = Math.floor(agg.past / 365);
    const bracket         = multiplierBracket(pastYearsFloor);
    const multiplier      = pastApplicable ? (wageOver2500 ? mult.high[bracket] : mult.low[bracket]) : 0;
    const actYearsFloor   = Math.min(Math.floor(agg.totalActual / 365), tableB.length - 1);
    const tbFactor        = pastApplicable ? (tableB[actYearsFloor] || 0) : 0;
    const psb             = pastApplicable ? Math.round(multiplier * tbFactor) : 0;

    // Formula pension
    // [(pre-2014 pensionable × min(avg,ceiling)) + (weightage × min(avg,ceiling)) + (post-2014 pensionable × avg)]
    // ÷ (365 × 70)
    const cappedAvg = Math.min(avg, preCeil);
    const fp = Math.round(
      (pre2014Pensionable * cappedAvg + weightageDays * cappedAvg + post2014Pensionable * avg) / (365 * 70)
    );
    const formulaShort =
      `((${pre2014Pensionable} × ${cappedAvg}) + (${weightageDays} × ${cappedAvg}) + (${post2014Pensionable} × ${avg})) / (365 × 70) = ${fp}`;

    const original = psb + fp;
    const final    = Math.max(original, 1000);

    return {
      ok: true,
      // service
      agg,
      pre2014Pensionable, post2014Pensionable,
      eligibleDays, eligibleYears,
      post95Pensionable, post95YearsRounded,
      ageAtExit,
      // pension
      commencement, weightageEligible, weightageDays,
      // wage
      avg, avgFormula,
      // past service
      pastApplicable, wageOver2500, pastYearsFloor, bracket,
      multiplier, actYearsFloor, tbFactor, psb,
      // formula pension
      cappedAvg, fp, formulaShort,
      // result
      original, final,
      minPensionApplied: final > original
    };
  }

  /* ------------------------------------------------------------------
     ARREARS
  ------------------------------------------------------------------- */
  function calculateArrears(finalPension, commencementDate, uptoDate) {
    const start = parseDate(commencementDate);
    const uptoRaw = parseDate(uptoDate);
    if (!finalPension || !start || !uptoRaw) return null;

    const upto = endOfMonth(uptoRaw);
    if (cmpDate(upto, start) < 0) return null;

    const startMonthEnd   = endOfMonth(start);
    const daysInStartMo   = startMonthEnd.getDate();
    const daysDue         = daysInStartMo - start.getDate() + 1;
    const isFirstOfMonth  = start.getDate() === 1;

    // part-month: only if pension does NOT commence on the 1st of the month
    const part = isFirstOfMonth
      ? 0
      : Math.round(finalPension / daysInStartMo * daysDue);

    const fullMonths =
      (upto.getFullYear() - start.getFullYear()) * 12 +
      (upto.getMonth()    - start.getMonth()) +
      (isFirstOfMonth ? 1 : 0);

    const fullAmt = finalPension * Math.max(0, fullMonths);
    const total   = part + fullAmt;

    return { part, daysDue, daysInStartMo, fullMonths, fullAmt, total };
  }

  /* ------------------------------------------------------------------
     PUBLIC API
  ------------------------------------------------------------------- */
  return {
    // constants
    REF95, PAST_END, C2014_END, C2014_START,
    TABLE_B_DEFAULT, MULT_DEFAULT, MULT_FLAGGED, MULT_ROWLABEL,
    // helpers
    parseDate, toISO, addDays, fmtDate, cmpDate, endOfMonth,
    ymd, ddays, age58Date, attainedAge,
    multiplierBracket, calcRow, aggregateSpells,
    // main
    calculate, calculateArrears
  };
}));
