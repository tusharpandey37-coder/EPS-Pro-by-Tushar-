const tableFactors=[1.039,1.122,1.212,1.309,1.413,1.526,1.649,1.781,1.923,2.077,2.243,2.423,2.616,2.826,3.052,3.296,3.560,3.845,4.152,4.485,4.843,5.231,5.649,6.101,6.589,7.117,7.686,8.301,8.965,9.682,10.487,11.294,12.197,13.173,14.2271,15.36555,16.59509,17.92303,19.35722,20.90618,22.57909,24.38586];
const multipliers={low:[80,90,100,110],high:[85,95,105,120]};
const $=id=>document.getElementById(id);
const money=n=>'₹'+Math.round(n||0).toLocaleString('en-IN');
function d(v){return v?new Date(v+'T00:00:00'):null}
function addDays(date,n){let x=new Date(date);x.setDate(x.getDate()+n);return x}
function excelDays(start,endInclusive){if(!start||!endInclusive||endInclusive<start)return 0;let end=addDays(endInclusive,1), y=end.getFullYear()-start.getFullYear(), m=end.getMonth()-start.getMonth(), day=end.getDate()-start.getDate();if(day<0){m--;day+=new Date(end.getFullYear(),end.getMonth(),0).getDate()}if(m<0){y--;m+=12}return y*365+m*30+day}
function fmtDate(x){return x?x.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'}
function rowTemplate(i, preset={}){return `<tr><td>${i+1}</td><td><input class="employer" value="${preset.employer||''}" placeholder="Employer / ID"></td><td><input class="join" type="date" value="${preset.join||''}"></td><td><input class="exit" type="date" value="${preset.exit||''}"></td><td><input class="ncp1" type="number" min="0" value="${preset.ncp1??0}"></td><td><input class="ncp2" type="number" min="0" value="${preset.ncp2??0}"></td><td class="calc-cell">0 days</td><td><button type="button" class="delete" title="Remove row">×</button></td></tr>`}
function addRow(preset={}){$('serviceTable').querySelector('tbody').insertAdjacentHTML('beforeend',rowTemplate($('serviceTable').querySelectorAll('tbody tr').length,preset));bindRows();calculate()}
function bindRows(){document.querySelectorAll('#serviceTable input').forEach(x=>x.oninput=calculate);document.querySelectorAll('.delete').forEach(x=>x.onclick=()=>{x.closest('tr').remove();renumber();calculate()})}
function renumber(){document.querySelectorAll('#serviceTable tbody tr').forEach((r,i)=>r.children[0].textContent=i+1)}
function calculate(){
 let past=0, pre=0, post=0, lastExit=null;
 document.querySelectorAll('#serviceTable tbody tr').forEach(r=>{
  const join=d(r.querySelector('.join').value), exit=d(r.querySelector('.exit').value), n1=+r.querySelector('.ncp1').value||0,n2=+r.querySelector('.ncp2').value||0;
  if(join&&exit&&exit>=join){
   const pastEnd=new Date('1995-11-15T00:00:00'), preStart=new Date('1995-11-16T00:00:00'), preEnd=new Date('2014-08-31T00:00:00'), postStart=new Date('2014-09-01T00:00:00');
   past+=excelDays(join, new Date(Math.min(exit,pastEnd))) * (join<=pastEnd?1:0);
   if(exit>=preStart) pre+=excelDays(new Date(Math.max(join,preStart)),new Date(Math.min(exit,preEnd)));
   if(exit>=postStart) post+=excelDays(new Date(Math.max(join,postStart)),exit);
   r.children[6].textContent=`${Math.max(0,excelDays(new Date(Math.max(join,preStart)),new Date(Math.min(exit,preEnd)))-n1)+Math.max(0,excelDays(new Date(Math.max(join,postStart)),exit)-n2)} days`;
   if(!lastExit||exit>lastExit)lastExit=exit;
  }else r.children[6].textContent='0 days';
 });
 const pensionPre=Math.max(0,pre-Array.from(document.querySelectorAll('.ncp1')).reduce((a,x)=>a+(+x.value||0),0));
 const pensionPost=Math.max(0,post-Array.from(document.querySelectorAll('.ncp2')).reduce((a,x)=>a+(+x.value||0),0));
 const actual=past+pre+post, eligible=past+pensionPre+pensionPost, pastYears=Math.floor(past/365), actualYears=Math.floor((pre+post)/365), eligibleYears=Math.round(eligible/365);
 const oldWage=+$('oldWage').value||0, wageSum=+$('wageSum').value||0,lastNcp=+$('lastNcp').value||0;
 const avg=Math.round(wageSum/Math.max(1,60-lastNcp/30)), factor=tableFactors[Math.min(actualYears,tableFactors.length-1)]||0;
 let slab=pastYears<11?0:pastYears<15?1:pastYears<20?2:3, mult=past?multipliers[oldWage>2500?'high':'low'][slab]:0;
 const pastBenefit=Math.round(mult*factor), weight=($('twentyYears').value==='Yes'&&eligibleYears>=20)?730:0;
 const formula=Math.round((pensionPre*Math.min(avg,6500)+weight*Math.min(avg,6500)+pensionPost*avg)/(365*70));
 const monthly=Math.max(1000,pastBenefit+formula), eligibleOk=eligible>=3650;
 $('heroPension').textContent=money(monthly);$('monthlyPension').textContent=money(monthly);$('pastBenefit').textContent=money(pastBenefit);$('formulaPension').textContent=money(formula);$('eligibleService').textContent=`${eligibleYears} years`;$('avgSalary').textContent=money(avg);$('tableFactor').textContent=factor.toFixed(3);$('multiplier').textContent=money(mult);$('weightage').textContent=`${weight} days`;$('eligibilityText').textContent=eligibleOk?'10+ years':'Below 10 years';$('commencement').textContent=lastExit?fmtDate(addDays(lastExit,1)):'—';$('resultNote').textContent=eligibleOk?'Estimate uses the workbook-based formula and applies the ₹1,000 minimum.':'The workbook flags service below 10 years as a withdrawal-benefit case, not covered here.';$('eligibilityPill').textContent=eligibleOk?'Eligible-service threshold met':'Add 10+ years of service';
}
$('addRow').onclick=()=>addRow();
$('resetBtn').onclick=()=>{location.reload()};
addRow({employer:'Kollam (previous)',join:'1990-07-01',exit:'2021-10-31'});
addRow({employer:'IREL (present)',join:'2021-11-01',exit:'2026-04-29'});
