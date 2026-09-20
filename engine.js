/* =====================================================================
   EPS-95 PENSION CALCULATION ENGINE  v4
   Pure functions — no DOM. Works in Node.js (require) and browser (window.EPS95Engine).
   ===================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else { root.EPS95Engine = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ------------------------------------------------------------------
     FIXED SCHEME DATES
  ------------------------------------------------------------------- */
  const REF95       = new Date(1995, 10, 16); // 16-11-1995 : EPS-95 start
  const PAST_END    = new Date(1995, 10, 15); // 15-11-1995 : last day of past service
  const C2014_END   = new Date(2014,  7, 31); // 31-08-2014
  const C2014_START = new Date(2014,  8,  1); // 01-09-2014

  /* ------------------------------------------------------------------
     DATE HELPERS
  ------------------------------------------------------------------- */
  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function toISO(dt) {
    if (!dt) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }
  function addDays(dt, n) { const x = new Date(dt); x.setDate(x.getDate() + n); return x; }
  function cmpDate(a, b)  { return a.getTime() - b.getTime(); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); } // m is 0-based
  function endOfMonth(dt)    { return new Date(dt.getFullYear(), dt.getMonth() + 1, 0); }
  function fmtDate(dt) {
    if (!dt) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ------------------------------------------------------------------
     SUPERANNUATION DATE  =  member's 58th birthday (DOB + 58 years)
     This is the pension commencement date in all cases.
  ------------------------------------------------------------------- */
  function superannuationDate(dob) {
    return new Date(dob.getFullYear() + 58, dob.getMonth(), dob.getDate());
  }

  /* ------------------------------------------------------------------
     EPFO DAY-COUNT — TWO CONVENTIONS

     EPS service  (post 16-11-1995):
       Uses (endInclusive + 1) - start, borrows ACTUAL calendar days.
       Verified against all EPS spans in three IDS worksheets.

     Past service (pre 16-11-1995):
       Uses (endInclusive + 1) - start, but borrows 30 days when d < 0.
       EPFO's scheme convention treats every month as 30 days in the borrow.
       Example: 30-09-1991 to 15-11-1995 = 4y 1m 16d = 1506 (not 1507)
                because borrow from Oct uses 30 not 31.
  ------------------------------------------------------------------- */
  function _ymdBase(start, endInclusive, use30DayBorrow) {
    if (!start || !endInclusive || cmpDate(endInclusive, start) < 0) return { y:0, m:0, d:0 };
    const end = addDays(endInclusive, 1);
    let y  = end.getFullYear() - start.getFullYear();
    let m  = end.getMonth()    - start.getMonth();
    let dd = end.getDate()     - start.getDate();
    if (dd < 0) {
      m -= 1;
      if (use30DayBorrow) {
        dd += 30;
      } else {
        const pm = end.getMonth() === 0 ? 11 : end.getMonth() - 1;
        const py = end.getMonth() === 0 ? end.getFullYear() - 1 : end.getFullYear();
        dd += daysInMonth(py, pm);
      }
    }
    if (m < 0) { y -= 1; m += 12; }
    return { y, m, d: dd };
  }

  function ymd(start, endInclusive)     { return _ymdBase(start, endInclusive, false); } // EPS service
  function ymdPast(start, endInclusive) { return _ymdBase(start, endInclusive, true);  } // Past service

  function ddays(start, endInclusive)     { const { y, m, d } = ymd(start, endInclusive);     return y*365+m*30+d; }
  function ddaysPast(start, endInclusive) { const { y, m, d } = ymdPast(start, endInclusive); return y*365+m*30+d; }

  /* Years from REF95 to the 58th birthday — used as the Table B index.
     Uses simple calendar-year difference (not EPFO day-count). */
  function tableByears(dob) {
    const a58 = superannuationDate(dob);
    const refMMDD = REF95.getMonth() * 100 + REF95.getDate();
    const a58MMDD = a58.getMonth()  * 100 + a58.getDate();
    let y = a58.getFullYear() - REF95.getFullYear();
    if (a58MMDD < refMMDD) y--;
    return Math.max(0, y);
  }

  function attainedAge(dob, onDate) { return ymd(dob, onDate).y; }

  /* ------------------------------------------------------------------
     REFERENCE DATA
  ------------------------------------------------------------------- */
  const TABLE_B = [
    1.039, 1.122, 1.212, 1.309, 1.413, 1.526, 1.649, 1.781, 1.923, 2.077,
    2.243, 2.423, 2.616, 2.826, 3.052, 3.296, 3.560, 3.845, 4.152, 4.485,
    4.843, 5.231, 5.649, 6.101, 6.589, 7.117, 7.686, 8.301, 8.965, 9.682,
    10.487,                           // n=30 corrected per confirmed EPFO worksheet
    11.294, 12.197, 13.173,
    14.2271, 15.36555, 16.59509, 17.92303, 19.35722, 20.90618, 22.57909, 24.38586
  ];

  /* Multiplier table — all values confirmed from the official EPS-95 scheme table.
     Row index:  0 = up to 11 yrs, 1 = >11–15 yrs, 2 = >15–<20 yrs, 3 = ≥20 yrs */
  const MULT = {
    low:  [80,  95,  120, 150],   // wage on 15-11-1995  ≤ Rs.2,500
    high: [85, 105,  135, 170]    // wage on 15-11-1995  > Rs.2,500
  };

  const MULT_ROWLABEL = [
    'Up to 11 years',
    'More than 11 years but up to 15 years',
    'More than 15 years but less than 20 years',
    'Beyond 20 years'
  ];

  function multiplierBracket(pastYearsFloor) {
    if (pastYearsFloor <= 11) return 0;   // "up to 11" includes exactly 11
    if (pastYearsFloor <= 15) return 1;
    if (pastYearsFloor <  20) return 2;
    return 3;
  }

  /* ------------------------------------------------------------------
     SERVICE LEDGER — per-row calculation (EPS portion only)
  ------------------------------------------------------------------- */
  function calcRow(doj, doe) {
    if (!doj || !doe || cmpDate(doe, doj) < 0)
      return { pastGross: 0, totalActual: 0, pre2014Actual: 0, post2014Actual: 0 };

    // Past service gross (before 16-11-1995) — uses 30-day borrow convention
    const pastEnd = cmpDate(doe, PAST_END) < 0 ? doe : PAST_END;
    const pastGross = cmpDate(doj, PAST_END) <= 0 ? ddaysPast(doj, pastEnd) : 0;

    // EPS service from 16-11-1995
    const epsStart  = cmpDate(doj, REF95) > 0 ? doj : REF95;
    const hasEPS    = cmpDate(doe, REF95) >= 0;
    const totalActual = hasEPS ? ddays(epsStart, doe) : 0;

    const pre2014Actual = (hasEPS && cmpDate(epsStart, C2014_END) <= 0)
      ? ddays(epsStart, cmpDate(doe, C2014_END) < 0 ? doe : C2014_END)
      : 0;

    // Post-2014 via subtraction — matches EPFO's own worksheet method
    const post2014Actual = totalActual - pre2014Actual;

    return { pastGross, totalActual, pre2014Actual, post2014Actual };
  }

  function aggregateSpells(spells) {
    const agg = {
      pastGross: 0, bis: 0,
      totalActual: 0, pre2014Actual: 0, post2014Actual: 0,
      ncpPre: 0, ncpPost: 0, ncpLast60: 0, ncpLast12: 0,
      lastExit: null, valid: true
    };
    spells.forEach(s => {
      const doj = parseDate(s.doj);
      const doe = parseDate(s.doe);
      if (!doj || !doe) return;
      if (cmpDate(doe, doj) < 0) { agg.valid = false; return; }
      const c = calcRow(doj, doe);
      agg.pastGross      += c.pastGross;
      agg.totalActual    += c.totalActual;
      agg.pre2014Actual  += c.pre2014Actual;
      agg.post2014Actual += c.post2014Actual;
      agg.bis       += (Number(s.bis)        || 0);
      agg.ncpPre    += (Number(s.ncpPre)     || 0);
      agg.ncpPost   += (Number(s.ncpPost)    || 0);
      agg.ncpLast60 += (Number(s.ncpLast60)  || 0);
      agg.ncpLast12 += (Number(s.ncpLast12)  || 0);
      if (!agg.lastExit || cmpDate(doe, agg.lastExit) > 0) agg.lastExit = doe;
    });
    // Net past service after deducting BIS
    agg.pastNet = Math.max(0, agg.pastGross - agg.bis);
    return agg;
  }

  /* ------------------------------------------------------------------
     MAIN CALCULATION
  ------------------------------------------------------------------- */
  function calculate(params) {
    /*
      params.spells     — array of spell objects
      params.dob        — string YYYY-MM-DD
      params.wage1995   — wage on 15-11-1995 (Rs)
      params.preCeiling — editable pre-2014 ceiling (default 6500)
      params.sum60      — sum of EPS wages, last 60 months (post-2014 exit)
      params.ncp60      — NCP days in last 60 months    (post-2014 exit)  [= ncpLast60 from ledger]
      params.sum12      — sum of EPS wages, last 12 months (pre-2014 exit)
      params.ncp12      — NCP days in last 12 months    (pre-2014 exit)   [= ncpLast12 from ledger]
      params.tableB     — optional override array
    */
    const tableB   = params.tableB || TABLE_B;
    const dob      = parseDate(params.dob);
    const preCeil  = Number(params.preCeiling) || 6500;
    const wage1995 = Number(params.wage1995)   || 0;
    const agg      = aggregateSpells(params.spells || []);

    if (!dob || !agg.lastExit || !agg.valid)
      return { ok: false, reason: 'incomplete', agg };

    // Determine wage window: pre-2014 exit → 12 months; post-2014 exit → 60 months
    const exitBeforeSep2014 = cmpDate(agg.lastExit, C2014_START) < 0;

    const pre2014Pensionable  = Math.max(0, agg.pre2014Actual  - agg.ncpPre);
    const post2014Pensionable = Math.max(0, agg.post2014Actual - agg.ncpPost);
    const eligibleDays  = agg.pastNet + pre2014Pensionable + post2014Pensionable;
    const eligibleYears = Math.round(eligibleDays / 365);

    if (eligibleYears < 10)
      return { ok: false, reason: 'ineligible', eligibleDays, eligibleYears, agg };

    // Superannuation date = 58th birthday = commencement in ALL cases
    const commencement = superannuationDate(dob);

    // Weightage: post-1995 pensionable service (16-11-1995 to exit) ≥ 20 years
    const post95Pensionable   = pre2014Pensionable + post2014Pensionable;
    const post95YearsRounded  = Math.round(post95Pensionable / 365);
    const weightageEligible   = post95YearsRounded >= 20;
    const weightageDays       = weightageEligible ? 730 : 0;

    // Average pensionable salary
    let avg, avgFormula, numMonths;
    if (exitBeforeSep2014) {
      numMonths = 12;
      const sum12 = Number(params.sum12) || 0;
      const ncp12 = Number(params.ncp12) || agg.ncpLast12;
      const denom = 365 - ncp12;
      avg        = denom > 0 ? Math.round(sum12 * 30 / denom) : 0;
      avgFormula = `(${sum12} × 30) ÷ (365 − ${ncp12}) = ${avg}`;
    } else {
      numMonths = 60;
      const sum60 = Number(params.sum60) || 0;
      const ncp60 = Number(params.ncp60) || agg.ncpLast60;
      if (ncp60 === 0) {
        avg        = Math.round(sum60 / 60);
        avgFormula = `${sum60} ÷ 60 = ${avg}`;
      } else {
        const denom = 1825 - ncp60;
        avg        = denom > 0 ? Math.round(sum60 * 30 / denom) : 0;
        avgFormula = `(${sum60} × 30) ÷ (1825 − ${ncp60}) = ${avg}`;
      }
    }

    // Past service benefit
    const pastApplicable = agg.pastNet > 0;
    const wageOver2500   = wage1995 > 2500;
    const pastYearsFloor = Math.floor(agg.pastNet / 365);
    const bracket        = multiplierBracket(pastYearsFloor);
    const multiplier     = pastApplicable ? (wageOver2500 ? MULT.high[bracket] : MULT.low[bracket]) : 0;

    // Table B: years from 16-11-1995 to member's 58th birthday
    const tbYears  = Math.min(tableByears(dob), tableB.length - 1);
    const tbFactor = pastApplicable ? (tableB[tbYears] || 0) : 0;
    const psb      = pastApplicable ? Math.round(multiplier * tbFactor) : 0;

    // Formula pension
    // Pre-2014 part (×min(avg,ceiling)) + Weightage (×min(avg,ceiling)) + Post-2014 part (×avg)
    // ÷ (365 × 70)
    // Note: for pre-2014 exits, post2014Pensionable = 0, so the formula is automatically correct.
    const cappedAvg = Math.min(avg, preCeil);
    const fp = Math.round(
      (pre2014Pensionable * cappedAvg + weightageDays * cappedAvg + post2014Pensionable * avg)
      / (365 * 70)
    );

    const original = psb + fp;
    const final    = Math.max(original, 1000);

    return {
      ok: true,
      agg,
      exitBeforeSep2014, numMonths,
      pre2014Pensionable, post2014Pensionable,
      eligibleDays, eligibleYears,
      commencement,
      post95Pensionable, post95YearsRounded, weightageEligible, weightageDays,
      avg, avgFormula,
      pastApplicable, wageOver2500, pastYearsFloor, bracket,
      multiplier, tbYears, tbFactor, psb,
      cappedAvg, fp,
      original, final,
      minPensionApplied: final > original,
      ageAtExit: attainedAge(dob, agg.lastExit)
    };
  }

  /* ------------------------------------------------------------------
     ARREARS
  ------------------------------------------------------------------- */
  function calculateArrears(finalPension, commencementDate, uptoDate) {
    const start    = parseDate(commencementDate);
    const uptoRaw  = parseDate(uptoDate);
    if (!finalPension || !start || !uptoRaw) return null;
    const upto = endOfMonth(uptoRaw);
    if (cmpDate(upto, start) < 0) return null;

    const startMonthEnd  = endOfMonth(start);
    const daysInStartMo  = startMonthEnd.getDate();
    const daysDue        = daysInStartMo - start.getDate() + 1;
    const isFirstOfMonth = start.getDate() === 1;

    const part = isFirstOfMonth ? 0 : Math.round(finalPension / daysInStartMo * daysDue);

    const fullMonths =
      (upto.getFullYear() - start.getFullYear()) * 12 +
      (upto.getMonth()    - start.getMonth()) +
      (isFirstOfMonth ? 1 : 0);

    const fullAmt = finalPension * Math.max(0, fullMonths);
    return { part, daysDue, daysInStartMo, fullMonths, fullAmt, total: part + fullAmt };
  }

  /* ------------------------------------------------------------------
     PUBLIC API
  ------------------------------------------------------------------- */
  return {
    REF95, PAST_END, C2014_END, C2014_START,
    TABLE_B, MULT, MULT_ROWLABEL,
    parseDate, toISO, addDays, fmtDate, cmpDate, endOfMonth,
    ymd, ymdPast, ddays, ddaysPast,
    superannuationDate, tableByears, attainedAge,
    multiplierBracket, calcRow, aggregateSpells,
    calculate, calculateArrears
  };
}));
