'use strict';
const E = require('./engine.js');
let passed=0, failed=0;

function assert(label, got, exp, tol=0) {
  const ok = tol>0 ? Math.abs(Number(got)-Number(exp))<=tol : String(got)===String(exp);
  if(ok){ console.log(`  ✓  ${label}: ${got}`); passed++; }
  else  { console.error(`  ✗  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(exp)}${tol?` (±${tol})`:''}`); failed++; }
}

/* ========================================================
   BABY S  (UAN 100323502431)
   Two spells, pre-1995 service, post-2014 service, superannuation
   Expected: PSB ₹839, FP ₹4427, total ₹5266, arrears ₹21240
   ======================================================== */
console.log('\n=== Baby S (UAN 100323502431) ===');
const bs = E.calculate({
  spells:[
    {doj:'1990-07-01',doe:'2021-10-31',bis:0,ncpPre:0,ncpPost:0,ncpLast60:0,ncpLast12:0},
    {doj:'2021-11-01',doe:'2026-04-29',bis:0,ncpPre:0,ncpPost:0,ncpLast60:0,ncpLast12:0}
  ],
  dob:'1968-04-30', wage1995:2499, preCeiling:6500, sum60:900000, ncp60:0
});
assert('ok',                   bs.ok,                              true);
assert('past gross days',      bs.agg.pastGross,                   1960);
assert('past net (no BIS)',     bs.agg.pastNet,                     1960);
assert('pre-2014 actual',      bs.agg.pre2014Actual,               6856);
assert('post-2014 actual',     bs.agg.post2014Actual,              4254);
assert('total actual',         bs.agg.totalActual,                 11110);
assert('pre-2014 pensionable', bs.pre2014Pensionable,              6856);
assert('post-2014 pensionable',bs.post2014Pensionable,             4254);
assert('eligible years',       bs.eligibleYears,                   36);
assert('Table B years (from 16-11-1995 to 30-04-2026)', bs.tbYears, 30);
assert('Table B factor n=30',  Math.round(bs.tbFactor*1000)/1000, 10.487);
assert('multiplier',           bs.multiplier,                      80);
assert('PSB',                  bs.psb,                             839);
assert('weightage days',       bs.weightageDays,                   730);
assert('post95 years rounded', bs.post95YearsRounded,              30);
assert('avg salary',           bs.avg,                             15000);
assert('formula pension',      bs.fp,                              4427);
assert('final pension',        bs.final,                           5266);
assert('commencement (58th birthday)', E.toISO(bs.commencement),  '2026-04-30');
assert('exit NOT before Sep2014', bs.exitBeforeSep2014,            false);
assert('numMonths',            bs.numMonths,                       60);

const ba = E.calculateArrears(5266, '2026-04-30', '2026-08-31');
assert('arrears part-month (Apr, 1 day)', ba.part,       176);
assert('arrears full months (May-Aug)',   ba.fullMonths,  4);
assert('arrears total',                   ba.total,       21240);

/* ========================================================
   SUDHAKAR  (UAN 100365645183)
   Single spell post-1995, NCP post-2014, exits before 58
   Expected: avg ₹14796, FP ₹2249–2250, commencement 09-12-2023
   ======================================================== */
console.log('\n=== Sudhakar Sathyamoorthi (UAN 100365645183) ===');
const su = E.calculate({
  spells:[{doj:'2009-11-18',doe:'2023-05-15',bis:0,ncpPre:0,ncpPost:61,ncpLast60:61,ncpLast12:0}],
  dob:'1965-12-09', wage1995:0, preCeiling:6500, sum60:870000, ncp60:61
});
assert('ok',                   su.ok,                              true);
assert('past gross',           su.agg.pastGross,                   0);
assert('pre-2014 actual',      su.agg.pre2014Actual,               1744);
assert('post-2014 actual',     su.agg.post2014Actual,              3179);
assert('total actual',         su.agg.totalActual,                 4923);
assert('pre-2014 pensionable', su.pre2014Pensionable,              1744);
assert('post-2014 pensionable (3179-61)', su.post2014Pensionable, 3118);
assert('ncpLast60 auto-carried', su.agg.ncpLast60,                61);
assert('avg (sum×30/(1825-61))', su.avg,                           14796);
assert('weightage eligible (13y<20)', su.weightageEligible,        false);
assert('weightageDays',        su.weightageDays,                   0);
assert('PSB (no past service)',su.psb,                             0);
assert('fp (EPFO=2250 ±1)',    su.fp,                              2249, 1);
assert('final',                su.final,                           2249, 1);
assert('Table B years from REF95 to 09-12-2023', su.tbYears,      28);
assert('commencement = 58th birthday', E.toISO(su.commencement),  '2023-12-09');
assert('exit NOT before Sep2014', su.exitBeforeSep2014,            false);

/* ========================================================
   SHUKLA  (UAN 102174391717)
   Past service with BIS, pre-2014 exit, 12-month wage window
   Expected: PSB ₹1229, FP ₹677, original ₹1906, commencement 12-01-2031
   ======================================================== */
console.log('\n=== Santosh Kumar Shukla (UAN 102174391717) ===');
const sh = E.calculate({
  spells:[{doj:'1991-09-30',doe:'2006-12-12',bis:117,ncpPre:522,ncpPost:0,ncpLast60:0,ncpLast12:30}],
  dob:'1973-01-12', wage1995:2499, preCeiling:6500, sum12:54909, ncp12:30
});
assert('ok',                   sh.ok,                              true);
assert('past gross (30-day borrow)', sh.agg.pastGross,            1506);
assert('past net (1506-117)', sh.agg.pastNet,                      1389);
assert('past years floor (3)', sh.pastYearsFloor,                  3);
assert('bracket (<=11 yrs)',   sh.bracket,                         0);
assert('pre-2014 actual',      sh.agg.pre2014Actual,               4042);
assert('post-2014 actual',     sh.agg.post2014Actual,              0);
assert('pre-2014 pensionable (4042-522)', sh.pre2014Pensionable,  3520, 3);
assert('Table B years (REF95 to 12-01-2031)', sh.tbYears,         35);
assert('Table B factor n=35', Math.round(sh.tbFactor*1000)/1000,  15.366, 0.001);
assert('multiplier (wage<=2500, bracket0)', sh.multiplier,         80);
assert('PSB',                  sh.psb,                             1229);
assert('avg (12-month window)', sh.avg,                            4917);
assert('fp (EPFO=677)',        sh.fp,                              677, 1);
assert('original (EPFO=1906)', sh.original,                        1906, 1);
assert('commencement = 58th birthday', E.toISO(sh.commencement),  '2031-01-12');
assert('exit before Sep2014',  sh.exitBeforeSep2014,               true);
assert('numMonths = 12',       sh.numMonths,                       12);

/* ========================================================
   MULTIPLIER TABLE — boundary checks
   ======================================================== */
console.log('\n=== Multiplier bracket boundaries ===');
assert('floor 11  → bracket 0 (up to 11)', E.multiplierBracket(11), 0);
assert('floor 12  → bracket 1 (>11–15)',   E.multiplierBracket(12), 1);
assert('floor 15  → bracket 1 (≤15)',      E.multiplierBracket(15), 1);
assert('floor 16  → bracket 2 (>15–<20)',  E.multiplierBracket(16), 2);
assert('floor 19  → bracket 2',            E.multiplierBracket(19), 2);
assert('floor 20  → bracket 3 (≥20)',      E.multiplierBracket(20), 3);
assert('low  bracket0 = 80',  E.MULT.low[0],  80);
assert('high bracket0 = 85',  E.MULT.high[0], 85);
assert('low  bracket1 = 95',  E.MULT.low[1],  95);
assert('high bracket1 = 105', E.MULT.high[1], 105);
assert('low  bracket2 = 120', E.MULT.low[2],  120);
assert('high bracket2 = 135', E.MULT.high[2], 135);
assert('low  bracket3 = 150', E.MULT.low[3],  150);
assert('high bracket3 = 170', E.MULT.high[3], 170);

/* ========================================================
   WEIGHTAGE — service length only, regardless of exit age
   ======================================================== */
console.log('\n=== Weightage (service-length rule only) ===');
const wt = E.calculate({
  spells:[{doj:'1997-01-01',doe:'2022-01-01',bis:0,ncpPre:0,ncpPost:0,ncpLast60:0,ncpLast12:0}],
  dob:'1967-01-01', wage1995:0, preCeiling:6500, sum60:900000, ncp60:0
});
assert('post95 years ≥ 20 → weightage eligible', wt.weightageEligible, true);
assert('weightage days = 730',                    wt.weightageDays,     730);
assert('commencement = 58th birthday (01-01-2025)', E.toISO(wt.commencement), '2025-01-01');

/* ========================================================
   INELIGIBLE — short service
   ======================================================== */
console.log('\n=== Ineligible (<10 eligible years) ===');
const ig = E.calculate({
  spells:[{doj:'2018-01-01',doe:'2023-01-01',bis:0,ncpPre:0,ncpPost:0,ncpLast60:0,ncpLast12:0}],
  dob:'1980-01-01', wage1995:0, preCeiling:6500, sum60:900000, ncp60:0
});
assert('ok=false',         ig.ok,     false);
assert('reason=ineligible',ig.reason, 'ineligible');
assert('eligible years<10',ig.eligibleYears < 10, true);

/* ========================================================
   ARREARS — commences on 1st of month (no part-month)
   ======================================================== */
console.log('\n=== Arrears: commences on 1st ===');
const a1 = E.calculateArrears(5000, '2026-05-01', '2026-08-31');
assert('no part-month', a1.part,       0);
assert('full months = 4', a1.fullMonths, 4);
assert('total = 20000', a1.total,      20000);

/* ========================================================
   PAST SERVICE DAY-COUNT  (30-day borrow convention)
   ======================================================== */
console.log('\n=== Past service day-count (30-day borrow) ===');
// Baby S: DOJ 01-07-1990, PAST_END 15-11-1995 → no borrow (d=15-1=14, +1→15) → 1960
assert('Baby S past gross', E.ddaysPast(new Date(1990,6,1), new Date(1995,10,15)), 1960);
// Shukla: DOJ 30-09-1991, PAST_END 15-11-1995 → borrow needed, uses 30 not 31 → 1506
assert('Shukla past gross',E.ddaysPast(new Date(1991,8,30), new Date(1995,10,15)), 1506);

console.log(`\n${'─'.repeat(54)}\n  ${passed} passed, ${failed} failed`);
if(failed>0) process.exit(1);
