const $ = id => document.getElementById(id);
const tableFactors = [0,0,0,0,0,0,0,0,0,0,0,5.005,5.599,6.177,6.733,7.268,7.686,8.301,8.965,9.682,10.487,11.294,12.197,13.173,14.2271,15.36555,16.59509,17.92303,19.35722,20.90618,22.57909,24.38586];
const multipliers = {low:[80,90,100,110], high:[85,95,105,120]};
const money = n => '₹' + Math.round(Number(n)||0).toLocaleString('en-IN');
const d = v => v ? new Date(v + 'T00:00:00') : null;
const addDays = (x,n) => { const z=new Date(x); z.setDate(z.getDate()+n); return z; };
const iso = x => x ? new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,10) : '';
const fmt = x => x ? x.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
function excelDays(start,end){
  if(!start || !end || end < start) return 0;
  const e=addDays(end,1); let y=e.getFullYear()-start.getFullYear(), m=e.getMonth()-start.getMonth(), day=e.getDate()-start.getDate();
  if(day<0){m--; day+=new Date(e.getFullYear(),e.getMonth(),0).getDate();}
  if(m<0){y--; m+=12;}
  return y*365+m*30+day;
}
function rowTemplate(i,p={}){return `<tr>
<td>${i+1}</td>
<td><input class="employer" value="${p.employer||''}" placeholder="Member ID / establishment"></td>
<td><input class="fpsJoin" type="date" value="${p.fpsJoin||''}"></td>
<td><input class="epsJoin" type="date" value="${p.epsJoin||''}"></td>
<td><input class="fpsExit" type="date" value="${p.fpsExit||''}"></td>
<td><input class="epsExit" type="date" value="${p.epsExit||''}"></td>
<td><input class="ncp1" type="number" min="0" value="${p.ncp1??0}"></td>
<td><input class="ncp2" type="number" min="0" value="${p.ncp2??0}"></td>
<td class="calc-cell">0 days</td><td><button type="button" class="delete">×</button></td></tr>`;}
function renumber(){document.querySelectorAll('#serviceTable tbody tr').forEach((r,i)=>r.children[0].textContent=i+1);}
function bindRows(){
  document.querySelectorAll('#serviceTable input').forEach(el=>el.addEventListener('input',calculate));
  document.querySelectorAll('.delete').forEach(el=>el.addEventListener('click',()=>{el.closest('tr').remove();renumber();calculate();}));
}
function addRow(p={}){ $('serviceTable').querySelector('tbody').insertAdjacentHTML('beforeend',rowTemplate($('serviceTable').querySelectorAll('tbody tr').length,p)); bindRows(); calculate(); }
function ageOn(dob,date){if(!dob||!date)return 0;let a=date.getFullYear()-dob.getFullYear();if(new Date(date.getFullYear(),dob.getMonth(),dob.getDate())>date)a--;return a;}
function birthday(dob,age){return dob?new Date(dob.getFullYear()+age,dob.getMonth(),dob.getDate()):null;}
function endMonth(){const n=new Date();return iso(new Date(n.getFullYear(),n.getMonth()+1,0));}
function calculate(){
  let past=0, pre=0, post=0, ncpPre=0, ncpPost=0, lastExit=null;
  const pEnd=new Date('1995-11-15T00:00:00'), s95=new Date('1995-11-16T00:00:00'), q14=new Date('2014-08-31T00:00:00'), t14=new Date('2014-09-01T00:00:00');
  document.querySelectorAll('#serviceTable tbody tr').forEach(r=>{
    const fj=d(r.querySelector('.fpsJoin').value), ej=d(r.querySelector('.epsJoin').value), fe=d(r.querySelector('.fpsExit').value), ee=d(r.querySelector('.epsExit').value), n1=+r.querySelector('.ncp1').value||0, n2=+r.querySelector('.ncp2').value||0;
    // Page 3 structure: FPS 71 dates represent past service; EPS dates represent service from 16-11-1995 onward.
    if(fj&&fe&&fe>=fj) past+=excelDays(fj,new Date(Math.min(fe,pEnd)));
    if(ej&&ee&&ee>=ej){
      // Page-3 service dates are the source. The worksheet computes the
      // post-2014 segment as total EPS service minus the pre-2014 segment;
      // this preserves the worksheet's 365/30-day convention at boundaries.
      const totalEpsDays=excelDays(ej,ee);
      const preSegment=ee>=s95 ? excelDays(new Date(Math.max(ej,s95)),new Date(Math.min(ee,q14))) : 0;
      const postSegment=(ej&&ee&&ee>=s95) ? excelDays(new Date(Math.max(ej,s95)),ee) : 0;
      pre+=preSegment;
      post+=postSegment;
      if(!lastExit||ee>lastExit) lastExit=ee;
    }
    const rowPre=Math.max(0,(ej&&ee&&ee>=s95)?excelDays(new Date(Math.max(ej,s95)),new Date(Math.min(ee,q14)))-n1:0);
    const rowPost=Math.max(0,(ej&&ee&&ee>=s95)?excelDays(new Date(Math.max(ej,s95)),ee)-n2:0);
    ncpPre+=n1; ncpPost+=n2;
    r.querySelector('.calc-cell').textContent=`${rowPre+rowPost} days`;
  });
  const pensionPre=Math.max(0,pre-ncpPre), pensionPost=Math.max(0,post-ncpPost), postActual=pre+post, totalEligible=past+pensionPre+pensionPost;
  const dob=d($('dob').value), age=ageOn(dob,lastExit), isSuper=$('pensionType').value==='super';
  const age58=birthday(dob,58), commencement=lastExit?new Date(Math.max(addDays(lastExit,1).getTime(),age58?.getTime()||0)):null;
  const twenty=postActual>=20*365;
  const weight=(isSuper&&commencement&&age58&&commencement>=age58&&twenty)?730:0;
  const exit60=lastExit?new Date(lastExit.getFullYear(),lastExit.getMonth()-60,lastExit.getDate()):null;
  let autoNcp=0;
  document.querySelectorAll('#serviceTable tbody tr').forEach(r=>{const ej=d(r.querySelector('.epsJoin').value),ee=d(r.querySelector('.epsExit').value),n=(+r.querySelector('.ncp1').value||0)+(+r.querySelector('.ncp2').value||0);if(exit60&&ej&&ee&&ee>=exit60&&ej<=lastExit)autoNcp+=n;});
  autoNcp=Math.min(autoNcp,1800); $('lastNcp').value=autoNcp;
  const wageSum=+$('wageSum').value||0;
  const avgRaw=wageSum*30/Math.max(1,1825-autoNcp), avg=Math.min(15000,avgRaw);
  const postYears=Math.floor(postActual/365), pastYears=Math.floor(past/365), factor=past?tableFactors[Math.min(postYears,tableFactors.length-1)]:0;
  const slab=pastYears<=11?0:pastYears<=15?1:pastYears<=20?2:3;
  const mult=past?multipliers[+$('oldWage').value>2500?'high':'low'][slab]:0;
  const pastBenefit=Math.round(mult*factor);
  const formula=Math.round((pensionPre*Math.min(avg,6500)+weight*Math.min(avg,6500)+pensionPost*avg)/(365*70));
  const raw=pastBenefit+formula, monthly=Math.max(1000,raw), eligible=totalEligible>=3650;
  $('heroPension').textContent=eligible?money(monthly):'Not eligible'; $('monthlyPension').textContent=eligible?money(monthly):'Not eligible';
  $('pastBenefit').textContent=money(pastBenefit); $('formulaPension').textContent=money(formula); $('eligibleService').textContent=`${Math.floor(totalEligible/365)} years ${Math.floor((totalEligible%365)/30)} months`; $('postService').textContent=`${postYears} years`; $('avgSalary').textContent=money(avg); $('tableFactor').textContent=factor.toFixed(3); $('multiplier').textContent=money(mult); $('weightage').textContent=`${weight} days`;
  $('eligibilityText').textContent=eligible?'Eligible':'Not eligible — below 9 years 6 months'; $('eligibilityPill').textContent=eligible?'Eligibility threshold met':'Pension eligibility not met'; $('commencement').textContent=fmt(commencement); $('ageAtExit').textContent=lastExit?`${age} years`:'—';
  $('weightReason').textContent=weight?'Pension commencement is on/after age 58 and actual post-16-11-1995 service is at least 20 years.':'Not applicable: requires superannuation, commencement at/after 58 and at least 20 years of actual post-16-11-1995 service.';
  $('resultNote').textContent=eligible?'Illustrative calculation based on page-3 service rows and entered wage details.':'Complete the page-3 service rows and wage details.';
  syncArrears(commencement,eligible?monthly:0);
}
function syncArrears(start,pension){$('arrearsPension').value=Math.round(pension||0);if(start && !$('arrearsStart').value) $('arrearsStart').value=iso(start);if(!$('arrearsCutoff').value) $('arrearsCutoff').value=endMonth();calculateArrears();}
function calculateArrears(){const p=+$('arrearsPension').value||0,s=d($('arrearsStart').value),c=d($('arrearsCutoff').value);if(!p||!s||!c||c<s){['partMonthAmount','fullMonthAmount','totalArrears'].forEach(id=>$(id).textContent='₹0');$('fullMonths').textContent='0';$('calculatorArrears').textContent='₹0';return;}const end=new Date(c.getFullYear(),c.getMonth()+1,0),part=s.getDate()===1?p:Math.round(p/30*(30-s.getDate()+1)),full=Math.max(0,(end.getFullYear()-s.getFullYear())*12+end.getMonth()-s.getMonth()-(s.getDate()===1?0:1)),fullAmt=p*full,total=part+fullAmt;$('partMonthAmount').textContent=money(part);$('fullMonths').textContent=full;$('fullMonthAmount').textContent=money(fullAmt);$('totalArrears').textContent=money(total);$('calculatorArrears').textContent=money(total);}
function init(){
  $('addRow').addEventListener('click',()=>addRow()); $('calculateBtn').addEventListener('click',calculate); $('resetBtn').addEventListener('click',()=>location.reload());
  ['oldWage','wageSum','pensionType','dob'].forEach(id=>$(id).addEventListener('input',calculate)); ['arrearsPension','arrearsStart','arrearsCutoff'].forEach(id=>$(id).addEventListener('input',calculateArrears));
  addRow();
  const navItems=[...document.querySelectorAll('.nav-item')], views={calculator:document.querySelector('#calculatorForm'),arrears:$('arrearsView'),tables:$('tablesView'),readme:$('readmeView')}; const menuToggle=$('menuToggle'),appMenu=$('appMenu');
  function closeMenu(){appMenu.hidden=true;menuToggle.setAttribute('aria-expanded','false');} function openMenu(){appMenu.hidden=false;menuToggle.setAttribute('aria-expanded','true');} menuToggle.addEventListener('click',e=>{e.stopPropagation();appMenu.hidden?openMenu():closeMenu();});
  function showView(name){Object.entries(views).forEach(([key,el])=>{if(el)el.hidden=key!==name;});navItems.forEach(btn=>btn.classList.toggle('active',btn.dataset.view===name));closeMenu();window.scrollTo({top:0,behavior:'smooth'});if(name==='arrears')calculateArrears();} navItems.forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();showView(btn.dataset.view);})); document.addEventListener('click',e=>{if(!e.target.closest('.menu-shell'))closeMenu();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  $('tableBBody').innerHTML=tableFactors.map((v,i)=>`<tr><td>${i}</td><td>${v.toFixed(3)}</td></tr>`).join(''); showView('calculator'); calculate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
