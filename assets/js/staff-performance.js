/* JINYA v0138 — Staff Performance category: labor, hiring, turnover, attendance, sales coaching and employee rankings. Uses shared.js for data, settings, state and startup. */

function renderFOHStaffPerformancePage(){
 $('fohLaborHost').innerHTML=fohLaborModuleHTML();bindFOHLaborDetails();
 $('fohHiringHost').innerHTML=fohHiringModuleHTML();
 $('fohTurnoverHost').innerHTML=fohTurnoverModuleHTML();bindFOHTurnoverCharts();
 $('fohAttendanceHost').innerHTML=fohAttendanceModuleHTML();bindFOHAttendanceDetails();
 $('fohAlcoholHost').innerHTML=fohAlcoholModuleHTML();bindFOHAlcohol();
 $('fohSmallPlatesHost').innerHTML=fohSmallPlatesModuleHTML();bindFOHSmallPlates();
 $('fohDessertHost').innerHTML=fohDessertModuleHTML();bindFOHDessert();
 renderRankings();
}

function allocateLaborCents(cents){
 let assigned=0;return fohLaborPositions.map((role,i)=>{const value=i===fohLaborPositions.length-1?cents-assigned:Math.round(cents*role.share);assigned+=value;return value});
}

function fohLaborSample(){
 const window=dateWindow(),selected=selectValue('daypart'),rows=[];
 for(const date of demoDates.filter(d=>d>=window.start&&d<=window.end)){
  const day=new Date(date+'T12:00:00Z').getUTCDay(),seed=Number(date.replaceAll('-','')),busy=[.78,.70,.76,.84,.98,1.28,1.18][day];
  const dailyRevenue=Math.round(8500*busy*(.96+(seed%9)*.012)*100);
  const sharedDaily={management:24000,benefits:7000,meals:3500,training:day===2?7500:1500,recruitment:1000};
  for(const part of ['lunch','dinner']){
   if(selected!=='all'&&selected!==part)continue;
   const portion=cents=>part==='lunch'?Math.round(cents*.36):cents-Math.round(cents*.36),revenueCents=portion(dailyRevenue);
   const allocations=Object.fromEntries(Object.entries(sharedDaily).map(([key,value])=>[key,allocateLaborCents(portion(value))]));
   const positions=fohLaborPositions.map((role,i)=>{
    const components=Object.fromEntries(Object.entries(allocations).map(([key,values])=>[key,values[i]]));
    const sharedCents=Object.values(components).reduce((s,v)=>s+v,0),budgetCents=revenueCents*fohLaborTarget*role.share;
    const baselineHours=Math.max(1,(budgetCents-sharedCents)/(100*role.rate*1.18));
    const shiftFactor=day===1&&part==='lunch'?1.16:day===5&&part==='dinner'?.94:1;
    const actualHours=Math.round(baselineHours*role.factor*fohLaborSampleHoursScale*shiftFactor*4)/4,overtimeHours=role.key==='expo'&&day===6?.5:0;
    const baseWages=Math.round(actualHours*role.rate*100),overtimePremium=Math.round(overtimeHours*role.rate*.5*100),employerCosts=Math.round((baseWages+overtimePremium)*.18);
    Object.assign(components,{baseWages,overtimePremium,employerCosts});
    return {...role,actualHours,overtimeHours,budgetCents,components,actualCents:Object.values(components).reduce((s,v)=>s+v,0)};
   });
   rows.push({date,part,revenueCents,positions});
  }
 }
 return rows;
}

function fohLaborTotals(rows){
 const revenueCents=rows.reduce((sum,row)=>sum+row.revenueCents,0),days=new Set(rows.map(row=>row.date)).size;
 const positions=fohLaborPositions.map(role=>{
  const records=rows.flatMap(row=>row.positions).filter(p=>p.key===role.key),components={};
  for(const field of ['baseWages','overtimePremium','employerCosts','management','benefits','meals','training','recruitment'])components[field]=records.reduce((s,p)=>s+p.components[field],0);
  return {...role,components,actualCents:records.reduce((s,p)=>s+p.actualCents,0),budgetCents:revenueCents*fohLaborTarget*role.share,actualHours:records.reduce((s,p)=>s+p.actualHours,0),overtimeHours:records.reduce((s,p)=>s+p.overtimeHours,0)};
 });
 return {days,revenueCents,positions,actualCents:positions.reduce((s,p)=>s+p.actualCents,0),budgetCents:revenueCents*fohLaborTarget};
}

function fohHiringHours(window=dateWindow()){
 const start=window.start<DEMO_START?DEMO_START:window.start,end=window.end>DEMO_TODAY?DEMO_TODAY:window.end;
 const part=selectValue('daypart');
 const positions=fohHiringPositions.map(role=>{
  const filled=role.key==='server'&&end<'2026-10-01'?14:role.filled;
  const lunchFilled=role.key==='server'&&filled===14?7:role.lunchFilled;
  return {...role,filled:part==='all'?filled:part==='lunch'?lunchFilled:filled-lunchFilled,standard:part==='all'?role.standard:part==='lunch'?role.lunchStandard:role.standard-role.lunchStandard,employeeDays:0,scheduledMinutes:0,workedMinutes:0};
 });
 for(let day=start;day<=end;day=shiftDate(day,1)){
  const stamp=new Date(day+'T12:00:00Z'),ordinal=Math.floor(stamp.getTime()/86400000),weekday=stamp.getUTCDay(),month=stamp.getUTCMonth();
  for(const role of positions){
   // Sample employment coverage: fourteen Server positions through September,
   // thirteen currently. Other roles are constant. All employed days, including
   // days with no scheduled/worked hours, remain in the denominator.
   const source=fohHiringPositions.find(source=>source.key===role.key);
   const allEmployed=role.key==='server'&&day<'2026-10-01'?14:source.filled;
   const lunch=role.key==='server'&&allEmployed===14?7:source.lunchFilled;
   const employed=part==='all'?allEmployed:part==='lunch'?lunch:allEmployed-lunch;
   role.employeeDays+=employed;
   for(let employee=0;employee<allEmployed;employee++){
    if(part!=='all'&&(employee<lunch?'lunch':'dinner')!==part)continue;
    if((ordinal+employee)%7>=4)continue;
    const demand=(weekday===5||weekday===6?1.12:.94)*(.94+month*.012),individual=.9+(employee%5)*.05;
    const scheduled=Math.round(role.weeklyHours*60/4*demand*individual/15)*15;
    const adjustment=(ordinal+employee)%17===0?30:(ordinal+employee)%11===0?-30:-15;
    role.scheduledMinutes+=scheduled;role.workedMinutes+=Math.max(0,scheduled+adjustment);
   }
  }
 }
 const summarize=row=>({...row,employeeWeeks:row.employeeDays/7,scheduledAverage:row.employeeDays?row.scheduledMinutes/60/(row.employeeDays/7):null,workedAverage:row.employeeDays?row.workedMinutes/60/(row.employeeDays/7):null});
 const total=summarize(positions.reduce((sum,r)=>({employeeDays:sum.employeeDays+r.employeeDays,scheduledMinutes:sum.scheduledMinutes+r.scheduledMinutes,workedMinutes:sum.workedMinutes+r.workedMinutes,filled:sum.filled+r.filled,standard:sum.standard+r.standard}),{employeeDays:0,scheduledMinutes:0,workedMinutes:0,filled:0,standard:0}));
 return {positions:positions.map(summarize),total,start,end};
}

function fohMetricHeader(label,value,caption='',valueClass=''){
 return `<div class="foh-metric-head"><h2 class="foh-metric-label">${label}</h2><div class="foh-metric-value ${valueClass}">${value}</div>${caption?`<div class="foh-metric-caption">${caption}</div>`:''}</div>`;
}

function fohHiringModuleHTML(){
 const {positions,total}=fohHiringHours(),hours=value=>value===null?'—':value.toFixed(1),percent=r=>Math.round(r.filled/r.standard*100)+'%',status=r=>kpiTargetClass(Math.round(r.filled/r.standard*100),fohStaffingGoal,'staffing');
 const row=r=>`<tr><td class="jh-role foh-table-role" data-label="Position">${r.label}</td><td class="foh-table-value" data-label="Staffed"><div class="jh-fill"><div class="jh-track" aria-hidden="true"><span style="width:${r.filled/r.standard*100}%"></span></div><span class="jh-value ${status(r)}">${percent(r)}</span></div></td><td class="foh-table-value" data-label="Filled / Standard">${r.filled} / ${r.standard}</td><td class="foh-table-value ${r.standard>r.filled?'jh-vacant':'jh-zero'}" data-label="Openings">${r.standard-r.filled}</td><td class="foh-table-value" data-label="Scheduled hrs / wk">${hours(r.scheduledAverage)}</td><td class="foh-table-value" data-label="Worked hrs / wk">${hours(r.workedAverage)}</td></tr>`;
 return `<div id="jinya-hiring-staffing"><div class="module-title foh-module-title"><h2>Staffing</h2></div><section class="jh-panel foh-metric-panel" aria-label="FOH staffing coverage and average weekly hours"><div class="jh-summary">${fohMetricHeader('FOH STAFFING',percent(total),'Goal: '+fohStaffingGoal+'%',status(total))}<div class="jh-summary-detail"><div class="jh-count foh-summary-count">${total.filled} <span>of ${total.standard} positions filled</span></div><div class="jh-track" role="img" aria-label="${total.filled} of ${total.standard} positions filled"><span style="width:${total.filled/total.standard*100}%"></span></div></div><div class="jh-open">${fohMetricHeader('OPENINGS',total.standard-total.filled)}</div></div><table class="foh-table" aria-label="Staffing by position and average weekly sample hours"><thead><tr><th scope="col">Position</th><th scope="col">Staffed</th><th scope="col">Filled /<br>Standard</th><th scope="col">Openings</th><th scope="col">Scheduled<br>hrs / wk</th><th scope="col">Worked<br>hrs / wk</th></tr></thead><tbody>${positions.map(row).join('')}</tbody><tfoot><tr><td class="foh-table-total-label" data-label="Position">Total FOH</td><td class="foh-table-value" data-label="Staffed"><div class="jh-fill"><div class="jh-track" aria-hidden="true"><span style="width:${total.filled/total.standard*100}%"></span></div><span class="jh-value ${status(total)}">${percent(total)}</span></div></td><td class="foh-table-value" data-label="Filled / Standard">${total.filled} / ${total.standard}</td><td class="jh-vacant foh-table-value" data-label="Openings">${total.standard-total.filled}</td><td class="foh-table-value" data-label="Scheduled hrs / wk">${hours(total.scheduledAverage)}</td><td class="foh-table-value" data-label="Worked hrs / wk">${hours(total.workedAverage)}</td></tr></tfoot></table><div class="jh-foot foh-note"><span>Staffing counts supplied · hours synthetic</span><span>Weighted by employed weeks</span></div></section></div>`;
}

function fohTurnoverPeriod(window,key='foh',part=selectValue('daypart'),source=fohTurnoverFixture){
 const days=windowDays(window.start,window.end),counts={quit:0,fired:0,other:0};let employeeDays=0;
 const keys=key==='foh'?fohTurnoverRoles.map(role=>role.key):[key];
 const complete=window.start>=source[0]?.start&&window.end<=source.at(-1)?.end&&window.end<=DEMO_TODAY;
 for(const month of source){
  const from=window.start>month.start?window.start:month.start,to=window.end<month.end?window.end:month.end;
  if(from>to)continue;
  for(const role of keys){
   const record=month.roles[role],coverage=part==='all'?1:record.shiftShare[part];
   employeeDays+=record.employeeDays/month.days*windowDays(from,to)*coverage;
   for(const event of record.departures)if(inWindow(event.date,from,to)&&(part==='all'||event.daypart===part))counts[event.reason]++;
  }
 }
 const total=Object.values(counts).reduce((a,b)=>a+b,0),average=days?employeeDays/days:0;
 // Compare a selected-period rate with a proportionate share of the annual target.
 // Never compare seven days of departures directly with a 35% annual target.
 const annualDays=windowDays(rolling12Window(window.end).start,window.end),goal=fohTurnoverTargets.foh*days/annualDays;
 return {...window,complete,counts,total,average,rate:complete&&average?100*total/average:null,goal};
}

function fohTurnoverModel(window=dateWindow()){
 const keys=[...fohTurnoverRoles.map(role=>role.key),'foh'],count=windowDays(window.start,window.end);
 const buckets=count<=7?Array.from({length:count},(_,i)=>{const date=shiftDate(window.start,i);return {start:date,end:date,label:Number(date.slice(5,7))+'/'+Number(date.slice(8))}}):trendBuckets(window,count<=120?'week':'month');
 const months=trendBuckets(window,'month').map(bucket=>({...bucket,label:Number(bucket.start.slice(5,7))+'/'+bucket.start.slice(2,4),roles:Object.fromEntries(fohTurnoverRoles.map(role=>[role.key,{exits:fohTurnoverPeriod(bucket,role.key).counts}]))}));
 return {window,months,keys,rows:keys.map(key=>({key,label:key==='foh'?'Total FOH':fohTurnoverRoles.find(role=>role.key===key).label,current:fohTurnoverPeriod(window,key),points:buckets.map(bucket=>({...fohTurnoverPeriod(bucket,key),label:bucket.label}))}))};
}

function fohTurnoverModuleHTML(){
 const model=fohTurnoverModel(),total=model.rows.find(r=>r.key==='foh').current,percent=v=>v===null?'—':v.toFixed(1)+'%',color=m=>m.rate===null?'':kpiTargetClass(m.rate,m.goal,{direction:'lower',band:m.goal*kpiColorRules.turnover.band/fohTurnoverTargets.foh});
 const row=r=>`<tr><th scope="row" class="${r.key==='foh'?'foh-table-total-label':'foh-table-role'}">${r.label}</th><td class="tr-rate foh-table-value ${color(r.current)}">${percent(r.current.rate)}</td><td><div class="tr-spark" data-turnover-role="${r.key}"></div></td></tr>`;
 const monthlyTable=months=>`<table class="tr-month-table foh-table" aria-label="Monthly FOH departures"><thead><tr><th scope="col">Month</th><th scope="col">Departures</th><th scope="col">Quit</th><th scope="col">Fired</th><th scope="col">Other</th></tr></thead><tbody>${months.map(m=>{const c=fohTurnoverRoles.reduce((s,r)=>{for(const reason of ['quit','fired','other'])s[reason]+=m.roles[r.key].exits[reason];return s},{quit:0,fired:0,other:0});return `<tr><th scope="row" class="foh-table-role">${m.label}</th><td class="foh-table-value">${c.quit+c.fired+c.other}</td><td class="foh-table-value">${c.quit}</td><td class="foh-table-value">${c.fired}</td><td class="foh-table-value">${c.other}</td></tr>`}).join('')}</tbody></table>`;
 return `<div class="module-title foh-module-title"><h2>Turnover</h2></div><div id="jinya-foh-turnover"><section class="tr-panel foh-metric-panel" aria-label="FOH selected-period turnover"><div class="tr-summary">${fohMetricHeader('FOH TURNOVER',percent(total.rate),'Goal: '+total.goal.toFixed(2)+'%',color(total))}</div><table class="tr-table foh-table" aria-label="Turnover by position"><thead><tr><th scope="col">Position</th><th scope="col">Turnover</th><th scope="col">Turnover trend</th></tr></thead><tbody>${model.rows.filter(r=>r.key!=='foh').map(row).join('')}</tbody><tfoot>${row(model.rows.find(r=>r.key==='foh'))}</tfoot></table><details class="tr-monthly-section" aria-label="Monthly FOH departures"><summary class="tr-monthly-toggle"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><h3 class="foh-subheading">MONTHLY DEPARTURES</h3></summary><div class="tr-month-grid">${monthlyTable(model.months.slice(0,6))}${monthlyTable(model.months.slice(6))}</div></details></section></div>`;
}

function bindFOHTurnoverCharts(){
 drawFOHTurnoverCharts();
 if(!fohTurnoverResizeObserver&&typeof ResizeObserver!=='undefined'){
  fohTurnoverResizeObserver=new ResizeObserver(drawFOHTurnoverCharts);fohTurnoverResizeObserver.observe($('fohTurnoverHost'));
 }
}

function drawFOHTurnoverCharts(){
 const root=$('jinya-foh-turnover');if(!root)return;
 const model=fohTurnoverModel();
 for(const node of root.querySelectorAll('[data-turnover-role]')){
  const row=model.rows.find(r=>r.key===node.dataset.turnoverRole),points=row.points.filter(p=>p.complete&&p.rate!==null);if(!points.length){node.innerHTML='<span class="tr-pending">No turnover history</span>';continue;}
  const width=node.clientWidth;if(width<180)continue;
  const left=39,right=7,top=30,bottom=70,low=Math.min(...points.map(p=>p.rate)),high=Math.max(...points.map(p=>p.rate)),flat=Math.abs(high-low)<1e-9;
  const x=i=>points.length===1?(left+width-right)/2:left+(width-left-right)*i/(points.length-1),y=v=>flat?(top+bottom)/2:bottom-(v-low)/(high-low)*(bottom-top);
  const marks=points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.rate)}" r="2.5" fill="var(--tr-${kpiTargetStatus(p.rate,p.goal,{direction:'lower',band:p.goal*kpiColorRules.turnover.band/fohTurnoverTargets.foh})})"/>`).join('');
  const bounds=flat?`<text x="1" y="${y(low)+4}" font-size="11" fill="var(--tr-muted)">${Math.round(low)}%</text>`:`<text x="1" y="${top+4}" font-size="11" fill="var(--tr-muted)">${Math.round(high)}%</text><text x="1" y="${bottom+4}" font-size="11" fill="var(--tr-muted)">${Math.round(low)}%</text>`;
  const first=points[0],last=points[points.length-1],endpoints=`<text x="${left}" y="12" text-anchor="start" font-size="11" fill="var(--tr-ink)">${first.label}: ${Math.round(first.rate)}%</text><text x="${width-right}" y="12" text-anchor="end" font-size="11" fill="var(--tr-ink)">${last.label}: ${Math.round(last.rate)}%</text>`;
  const description=points.map(p=>p.label+': '+Math.round(p.rate)+'%').join('; ');
  node.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 80" role="img" aria-label="${row.label} turnover. ${description}">${endpoints}${bounds}<polyline points="${points.map((p,i)=>x(i)+','+y(p.rate)).join(' ')}" stroke="var(--tr-blue)" stroke-width="1.6" fill="none"/>${marks}</svg>`;
 }
}


function fohAttendanceTally(records,start,end,part=selectValue('daypart')){
 const byEmployee=new Map(fohAttendancePeople.map(person=>[person.id,{...person,shifts:0,affected:0,ce:0,cu:0,le:0,lu:0,swaps:0}]));
 for(const record of records){
  if(record.date<start||record.date>end||(part!=='all'&&record.daypart!==part))continue;
  const row=byEmployee.get(record.employeeId);if(!row)continue;
  row.shifts++;
  row.ce+=Number(record.excusedCallout===true);row.cu+=Number(record.unexcusedCallout===true);
  row.le+=Number(record.excusedLate===true);row.lu+=Number(record.unexcusedLate===true);
  row.swaps+=Number(record.swap===true);
  row.affected+=Number(record.unexcusedCallout===true||record.unexcusedLate===true);
 }
 return [...byEmployee.values()];
}

function fohAttendanceScore(row){return row.shifts?Math.round(100*(row.shifts-row.affected)/row.shifts):null}

function fohAttendanceDelta(row){const now=fohAttendanceScore(row),before=fohAttendanceScore({shifts:row.priorShifts,affected:row.priorAffected});return now===null||before===null?null:now-before}

function fohAttendanceChange(row){const value=fohAttendanceDelta(row);return value===null?'—':value===0?'0 pp':(value>0?'+':'−')+Math.abs(value)+' pp'}

function fohAttendanceRating(row){return kpiTargetClass(fohAttendanceScore(row),fohAttendanceGoal,'attendance')}

function fohAttendanceGender(person){return ['male','female'].includes(person.gender)?person.gender:'unspecified'}

function fohAttendanceSort(a,b){return (fohAttendanceScore(b)??-1)-(fohAttendanceScore(a)??-1)||b.shifts-a.shifts||a.name.localeCompare(b.name)}

function fohAttendanceAggregate(list){return list.reduce((a,r)=>{for(const key of ['shifts','affected','ce','cu','le','lu','swaps','priorShifts','priorAffected'])a[key]+=r[key]||0;return a;},{shifts:0,affected:0,ce:0,cu:0,le:0,lu:0,swaps:0,priorShifts:0,priorAffected:0})}

function fohAttendanceWinners(list,kind){
 const metric=kind==='improved'?fohAttendanceDelta:fohAttendanceScore,direction=kind==='lowest'?1:-1;
 const eligible=list.filter(r=>metric(r)!==null&&(kind!=='improved'||metric(r)>0)).sort((a,b)=>direction*(metric(a)-metric(b))||b.shifts-a.shifts||a.name.localeCompare(b.name));
 if(!eligible.length)return [];
 const best=eligible[0];return eligible.filter(r=>metric(r)===metric(best)&&r.shifts===best.shifts);
}

function fohAttendanceModel(window=dateWindow(),records=fohAttendanceRecords){
 const current=fohAttendanceTally(records,window.start,window.end);
 const priorComplete=window.previousStart>=DEMO_START&&window.previousEnd<=DEMO_TODAY;
 const previous=fohAttendanceTally(records,window.previousStart,window.previousEnd),lookup=new Map(previous.map(row=>[row.id,row]));
 const people=current.map(row=>({...row,priorShifts:priorComplete?lookup.get(row.id).shifts:0,priorAffected:priorComplete?lookup.get(row.id).affected:0}));
 const positions=fohHiringPositions.map(role=>{
  const employees=people.filter(person=>person.role===role.key).sort(fohAttendanceSort);
  return {key:role.key,label:role.label,employees,total:fohAttendanceAggregate(employees)};
 });
 return {window,people,positions,total:fohAttendanceAggregate(people)};
}

function fohAttendancePersonIcon(){return '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>'}

function fohAttendanceModuleHTML(){
 const model=fohAttendanceModel(),percent=row=>fohAttendanceScore(row)===null?'—':fohAttendanceScore(row)+'%';
 const count=(n,unexcused=false)=>`<span class="${n?(unexcused?'att-unexcused':''):'att-zero'}">${n}</span>`;
 const performer=(list,kind,label)=>{
  const people=fohAttendanceWinners(list,kind);
  return `<td class="att-person" data-label="${label}">${people.length?`${people.map(p=>`<span class="att-person-entry"><span class="att-person-icon gender-${fohAttendanceGender(p)}" role="img" aria-label="${fohAttendanceGender(p)==='unspecified'?'Gender unspecified':fohAttendanceGender(p)==='male'?'Male':'Female'}">${fohAttendancePersonIcon()}</span><span class="att-person-name foh-table-role">${escapeHTML(p.name)}</span></span>`).join('')}`:'—'}</td>`;
 };
 const details=position=>`<div class="att-scroll" role="region" aria-label="${position.label} employee attendance"><table class="att-detail-table foh-table"><thead><tr><th scope="col">Employee</th><th scope="col">Shifts</th><th scope="col">Callouts<span class="att-sub att-pair"><span>Excused</span><span>Unexc.</span></span></th><th scope="col">Late<span class="att-sub att-pair"><span>Excused</span><span>Unexc.</span></span></th><th scope="col">Swaps<span class="att-sub">&lt;24h</span></th><th scope="col">Reliability</th><th scope="col">Change</th></tr></thead><tbody>${position.employees.map(row=>`<tr><th scope="row" class="foh-table-role">${escapeHTML(row.name)}</th><td class="foh-table-secondary">${row.shifts}</td><td class="foh-table-secondary"><div class="att-pair">${count(row.ce)}${count(row.cu,true)}</div></td><td class="foh-table-secondary"><div class="att-pair">${count(row.le)}${count(row.lu,true)}</div></td><td class="foh-table-secondary">${count(row.swaps)}</td><td class="foh-table-secondary ${fohAttendanceRating(row)}">${percent(row)}</td><td class="foh-table-secondary att-change">${fohAttendanceChange(row)}</td></tr>`).join('')}</tbody></table></div>`;
 const row=position=>{
  const open=fohAttendanceOpenRoles.has(position.key),total=position.total;
  return `<tr class="att-position"><th scope="row" class="foh-table-role"><button class="att-toggle" id="foh-attendance-toggle-${position.key}" type="button" aria-expanded="${open}" aria-controls="foh-attendance-detail-${position.key}" aria-label="${position.label} attendance details"><span class="att-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span><span>${position.label}</span></button></th><td class="foh-table-value ${fohAttendanceRating(total)}">${percent(total)}</td><td class="foh-table-secondary att-change">${fohAttendanceChange(total)}</td>${performer(position.employees,'highest','Highest Performer')}${performer(position.employees,'lowest','Lowest Performer')}${performer(position.employees,'improved','Most Improved')}</tr><tr class="att-detail" id="foh-attendance-detail-${position.key}"${open?'':' hidden'}><td colspan="6">${details(position)}</td></tr>`;
 };
 return `<div class="module-title foh-module-title"><h2>Attendance</h2></div><div id="jinya-foh-attendance"><section class="att-panel foh-metric-panel" aria-label="FOH attendance">${fohMetricHeader('FOH ATTENDANCE',percent(model.total),'Goal: '+fohAttendanceGoal+'%',fohAttendanceRating(model.total))}<table class="att-table foh-table" aria-label="Attendance by position"><thead><tr><th scope="col">Position</th><th scope="col">Reliability</th><th scope="col">Change</th><th scope="col">Highest<br>Performer</th><th scope="col">Lowest<br>Performer</th><th scope="col">Most<br>Improved</th></tr></thead><tbody>${model.positions.map(row).join('')}</tbody><tfoot><tr><th scope="row" class="foh-table-total-label">Total FOH</th><td class="foh-table-value ${fohAttendanceRating(model.total)}">${percent(model.total)}</td><td class="foh-table-secondary att-change">${fohAttendanceChange(model.total)}</td><td colspan="3"></td></tr></tfoot></table></section></div>`;
}

function bindFOHAttendanceDetails(){
 const root=$('jinya-foh-attendance');if(!root)return;
 root.querySelectorAll('.att-toggle').forEach(button=>button.addEventListener('click',()=>{
  const key=button.id.replace('foh-attendance-toggle-',''),open=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(open));
  const detail=$(button.getAttribute('aria-controls'));if(detail)detail.hidden=!open;
  if(open)fohAttendanceOpenRoles.add(key);else fohAttendanceOpenRoles.delete(key);
 }));
}


function fohLaborModuleHTML(){
 const t=fohLaborTotals(fohLaborSample()),days=t.days||1,percentage=cents=>t.revenueCents?(cents/t.revenueCents*100).toFixed(2)+'%':'—';
 const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100),exact=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
 const amount=cents=>`<span title="${exact(cents)}">${money(cents)}</span>`,status=(actual,budget)=>kpiTargetClass(actual,budget,{relativeBand:kpiColorRules.labor.band/(fohLaborTarget*100),direction:'lower'});
 const variance=(actual,budget)=>{const delta=actual-budget;return `<strong class="${status(actual,budget)}" title="${delta>0?'+':delta<0?'-':''}${exact(Math.abs(delta))}">${Math.round(Math.abs(delta)/100)===0?'':delta>0?'+':delta<0?'-':''}${money(Math.abs(delta))}</strong>`};
 // Balance displayed hundredths so rounded position percentages reconcile.
 const actualUnits=t.positions.map(p=>t.revenueCents?p.actualCents/t.revenueCents*10000:0),displayUnits=actualUnits.map(Math.floor);
 const order=actualUnits.map((value,index)=>({index,remainder:value-Math.floor(value)})).sort((a,b)=>b.remainder-a.remainder);
 const remaining=Math.round(actualUnits.reduce((sum,value)=>sum+value,0))-displayUnits.reduce((sum,value)=>sum+value,0);
 for(let i=0;i<remaining;i++)displayUnits[order[i].index]++;
 const displayedPercent=new Map(t.positions.map((p,i)=>[p.key,(displayUnits[i]/100).toFixed(2)+'%']));
 // Whole-dollar shares reconcile to the same displayed period totals.
 const roundedParts=values=>{const units=values.map(value=>value/100),result=units.map(Math.floor),rank=units.map((value,index)=>({index,remainder:value-Math.floor(value)})).sort((a,b)=>b.remainder-a.remainder),count=Math.round(units.reduce((sum,value)=>sum+value,0))-result.reduce((sum,value)=>sum+value,0);for(let i=0;i<count;i++)result[rank[i].index]++;return result};
 const shownActual=roundedParts(t.positions.map(p=>p.actualCents)),shownTarget=roundedParts(t.positions.map(p=>p.budgetCents));
 const periodDelta=Math.round(t.actualCents/100)-Math.round(t.budgetCents/100);
 const shownAmount=(units,cents)=>`<span title="${exact(cents)}">${money(units*100)}</span>`;
 const shownDelta=(actual,target,units)=>`<strong class="${status(actual,target)}" title="${exact(actual-target)}">${units>0?'+':units<0?'-':''}${money(Math.abs(units)*100)}</strong>`;
 const headline=[
  ['FOH LABOR',percentage(t.actualCents),'Target: 13.75%',status(t.actualCents,t.budgetCents)],
  ['FOH COST',money(t.actualCents),'Target: '+money(t.budgetCents),status(t.actualCents,t.budgetCents)],
  ['FOH Δ',(periodDelta>0?'+':periodDelta<0?'-':'')+money(Math.abs(periodDelta)*100),'',status(t.actualCents,t.budgetCents)]
 ];
 const labels=[['baseWages','Base wages - all paid hours'],['overtimePremium','Overtime premium'],['employerCosts','Employer payroll taxes + workers’ comp'],['management','Allocated FOH management pay'],['benefits','Allocated benefits + PTO'],['meals','Allocated staff meals'],['training','Allocated additional training expenses'],['recruitment','Allocated recruitment expenses']];
 const roleCells=t.positions.map((p,index)=>[
  `<strong class="${status(p.actualCents,p.budgetCents)}" title="${(p.actualCents/t.revenueCents*100).toFixed(6)}%">${displayedPercent.get(p.key)}</strong>`,
  (fohLaborTarget*p.share*100).toFixed(2)+'%',
  `<strong class="${status(p.actualCents,p.budgetCents)}">${shownAmount(shownActual[index],p.actualCents)}</strong>`,
  shownAmount(shownTarget[index],p.budgetCents),shownDelta(p.actualCents,p.budgetCents,shownActual[index]-shownTarget[index])
 ]);
 const totalCells=[`<strong class="${status(t.actualCents,t.budgetCents)}">${percentage(t.actualCents)}</strong>`,'13.75%',amount(t.actualCents),amount(t.budgetCents),shownDelta(t.actualCents,t.budgetCents,periodDelta)];
 const positionTable=(indices,headers)=>`<table class="position-table foh-table"><thead><tr><th scope="col">Position</th>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${t.positions.map((p,index)=>`<tr><th scope="row" class="foh-table-role"><button type="button" class="labor-position-toggle" data-labor-detail="${p.key}" aria-expanded="${fohLaborExpanded.has(p.key)}" aria-controls="labor-cost-detail-${p.key}"><span aria-hidden="true">${fohLaborExpanded.has(p.key)?'−':'+'}</span> ${p.label}</button></th>${indices.map(i=>`<td class="${i===1||i===3?'foh-table-secondary':'foh-table-value'}">${roleCells[index][i]}</td>`).join('')}</tr>`).join('')}<tr class="total-row"><th scope="row" class="foh-table-total-label">Total FOH</th>${indices.map(i=>`<td class="${i===1||i===3?'foh-table-secondary':'foh-table-value'}">${totalCells[i]}</td>`).join('')}</tr></tbody></table>`;
 const lead=(title,value,target,color='')=>fohMetricHeader(title,value,target,color);
 const detailRows=t.positions.map(p=>{
  const detail=labels.map(([key,label])=>`<tr><th scope="row">${label}</th><td>${amount(p.components[key]/days)}</td></tr>`).join('');
  return `<tr class="labor-cost-detail" id="labor-cost-detail-${p.key}" ${fohLaborExpanded.has(p.key)?'':'hidden'}><td><div class="labor-detail-content"><p class="labor-detail-title">${p.label.toUpperCase()} COST DETAILS <span>(AVG PER DAY)</span></p><div class="labor-detail-layout"><table class="labor-component-table"><thead><tr><th>Component</th><th>Cost / Day</th></tr></thead><tbody>${detail}<tr class="labor-total"><th scope="row">TOTAL ${p.label.toUpperCase()} COST</th><td>${amount(p.actualCents/days)}</td></tr></tbody></table><div class="labor-assumptions"><p><strong>Sample paid hours/day:</strong> ${(p.actualHours/days).toFixed(1)}</p><p><strong>Sample hourly wage:</strong> ${exact(p.rate*100)}</p><p><strong>Employer costs:</strong> 18% of wages + overtime premium; benefits/PTO are separate.</p><p><strong>Shared expense allocation:</strong> ${(p.share*100).toFixed(0)}% to ${p.label}, using the agreed FOH target shares.</p><p>Paid training hours are included in base wages. Additional training expenses exclude those wages. All costs are synthetic.</p></div></div></div></td></tr>`;
 }).join('');
 const color=status(t.actualCents,t.budgetCents);
 return `<div class="module-title foh-module-title"><h2>Labor</h2></div><section class="labor-dashboard labor-three"><div class="metric-panels"><article class="data-panel foh-metric-panel">${lead('FOH LABOR',percentage(t.actualCents),'Target: 13.75%',color)}${positionTable([0,1],['Actual','Target'])}</article><article class="data-panel foh-metric-panel">${lead('FOH COST',money(t.actualCents),'Target: '+money(t.budgetCents),color)}${positionTable([2,3],['Actual','Target'])}</article><article class="data-panel delta-panel foh-metric-panel">${lead('FOH Δ',(periodDelta>0?'+':periodDelta<0?'-':'')+money(Math.abs(periodDelta)*100),'',color)}${positionTable([4],['Δ'])}</article></div></section><div class="shared-details"><table><tbody>${detailRows}</tbody></table></div><div class="context-line"><span>Restaurant net revenue: ${amount(t.revenueCents)}</span><span>Labor targets: FOH 13.75% · BOH 11.25% · Total 25%</span></div>`;
}

function bindFOHLaborDetails(){
 const host=$('fohLaborHost');if(!host)return;
 for(const button of host.querySelectorAll('[data-labor-detail]'))button.onclick=()=>{
  const key=button.dataset.laborDetail,open=!fohLaborExpanded.has(key);if(open)fohLaborExpanded.add(key);else fohLaborExpanded.delete(key);
  const row=$('labor-cost-detail-'+key);if(row)row.hidden=!open;
  for(const other of host.querySelectorAll('[data-labor-detail]'))if(other.dataset.laborDetail===key){other.setAttribute('aria-expanded',String(open));other.innerHTML=`<span aria-hidden="true">${open?'−':'+'}</span> ${fohLaborPositions.find(p=>p.key===key).label}`}
 };
}

function fohAlcoholModel(window=dateWindow()){
 const allowed=new Set(currentRows().map(row=>row.server));
 const records=checks.filter(check=>inWindow(check.date,window.start,window.end)&&allowed.has(check.server)&&(selectValue('daypart')==='all'||check.daypart===selectValue('daypart')));
 const count=windowDays(window.start,window.end),grain=count<=7?'day':count<=120?'week':'month';
 const buckets=grain==='day'?Array.from({length:count},(_,i)=>{const date=shiftDate(window.start,i);return {start:date,end:date}}):trendBuckets(window,grain);
 const makeRow=(key,label,selected,daypart=null)=>({key,label,daypart,current:summarizeSectionChecks(selected),points:buckets.map(bucket=>({...bucket,...summarizeSectionChecks(selected.filter(check=>inWindow(check.date,bucket.start,bucket.end)))}))});
 const groups=(selectValue('daypart')==='all'?['dinner','lunch']:[selectValue('daypart')]).map(daypart=>{
  const selected=records.filter(check=>check.daypart===daypart);
  const members=[...new Set(selected.map(check=>check.server))].map(name=>makeRow(daypart+'-'+serviceEmployees.findIndex(person=>person.name===name),name,selected.filter(check=>check.server===name),daypart));
  members.sort((a,b)=>(b.current.alcoholMix??-Infinity)-(a.current.alcoholMix??-Infinity)||b.current.grossCents-a.current.grossCents||a.label.localeCompare(b.label));
  return {key:daypart,label:daypart==='dinner'?'Dinner':'Lunch',members,total:makeRow('team-'+daypart,daypart==='dinner'?'Dinner':'Lunch',selected,daypart)};
 });
 const total=makeRow('team-total','Total',records);
 return {window,grain,buckets,groups,total,team:[...groups.map(group=>group.total),total],goal:operationalData.alcoholGoal};
}

function fohAlcoholPercent(value){return value===null?'—':value.toFixed(1)+'%'}

function fohAlcoholDate(date,grain){const [y,m,d]=date.split('-');return Number(m)+'/'+(grain==='month'?y.slice(2):Number(d))}

function fohAlcoholDetails(row,model,content=null){
 const current=row.current,money=value=>value===null?'—':itemMoney(value,2);
 const stat=(label,value,note='')=>`<div><div class="foh-note">${label}</div><div class="al-detail-value foh-table-value">${value}</div>${note?`<div class="foh-note">${note}</div>`:''}</div>`;
 const body=content===null?`<div class="al-weekly-scroll" role="region" aria-label="${escapeHTML(row.label)} alcohol results"><table class="al-detail-table foh-table"><thead><tr><th scope="col">Period ending</th><th scope="col">Alcohol revenue</th><th scope="col">Total revenue</th><th scope="col">Alcohol %</th></tr></thead><tbody>${row.points.map(point=>`<tr><th scope="row" class="foh-table-role">${fohAlcoholDate(point.end,model.grain)}</th><td class="foh-table-secondary">${money(point.alcoholCents)}</td><td class="foh-table-secondary">${money(point.grossCents)}</td><td class="foh-table-secondary">${fohAlcoholPercent(point.alcoholMix)}</td></tr>`).join('')}</tbody></table></div>`:content;
 return `<div class="al-detail-content"><div class="al-detail-stats">${stat('Alcohol revenue',money(current.alcoholCents))}${stat('Total revenue',money(current.grossCents))}${stat('Alcohol $ / guest',money(current.alcoholPerGuestCents),fmt(current.guests)+' guests')}${stat('Alcohol attachment',fohAlcoholPercent(current.alcoholIncluded),fmt(current.alcoholChecks)+' of '+fmt(current.checks)+' checks')}</div>${body}</div>`;
}

function fohAlcoholModuleHTML(){
 const model=fohAlcoholModel();fohAlcoholRenderedModel=model;
 const color=value=>kpiTargetClass(value,model.goal,'performance');
 const chevron='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
 const heading=label=>`<thead><tr><th scope="col">${label}</th><th scope="col">Alcohol %</th><th scope="col">Trend</th></tr></thead>`;
 const row=r=>{
  const group=model.groups.find(g=>g.total.key===r.key);
  const employees=group?`<div class="al-employees al-group"><table class="al-table foh-table" aria-label="${group.label} employee alcohol performance">${heading('Name')}<tbody>${group.members.length?group.members.map(row).join(''):'<tr><td colspan="3" class="al-empty foh-note">No sales in this period.</td></tr>'}</tbody></table></div>`:null;
  return `<tr class="al-row"><th scope="row" class="${r.key==='team-total'?'foh-table-total-label':'foh-table-role'}"><button type="button" class="al-toggle" aria-expanded="false" aria-controls="al-detail-${r.key}" aria-label="${escapeHTML(r.label)} ${r.daypart||'all shifts'} alcohol details">${chevron}<span>${escapeHTML(r.label)}</span></button></th><td class="foh-table-value ${color(r.current.alcoholMix)}">${fohAlcoholPercent(r.current.alcoholMix)}</td><td class="al-trend"><div class="al-spark" data-alcohol-row="${r.key}"></div></td></tr><tr class="al-detail" id="al-detail-${r.key}" hidden><td colspan="3">${fohAlcoholDetails(r,model,employees)}</td></tr>`;
 };
 return `<div class="module-title foh-module-title"><h2>Alcohol</h2></div><div id="jinya-foh-alcohol"><section class="al-panel foh-metric-panel" aria-label="FOH alcohol performance">${fohMetricHeader('FOH ALCOHOL',fohAlcoholPercent(model.total.current.alcoholMix),'Goal: '+targetPercent(model.goal),color(model.total.current.alcoholMix))}<div class="al-overview al-group"><table class="al-table foh-table" aria-label="Alcohol performance by shift">${heading('Shift')}<tbody>${model.team.map(row).join('')}</tbody></table></div></section></div>`;
}

function bindFOHAlcohol(){
 const root=$('jinya-foh-alcohol');if(!root)return;
 root.querySelectorAll('.al-toggle').forEach(button=>button.addEventListener('click',()=>{
  const open=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(open));
  $(button.getAttribute('aria-controls')).hidden=!open;
  drawFOHAlcoholCharts();
 }));
 drawFOHAlcoholCharts();
 if(!fohAlcoholResizeObserver&&typeof ResizeObserver==='function'){
  fohAlcoholResizeObserver=new ResizeObserver(drawFOHAlcoholCharts);fohAlcoholResizeObserver.observe($('fohAlcoholHost'));
 }
}

function drawFOHAlcoholCharts(){
 const root=$('jinya-foh-alcohol'),model=fohAlcoholRenderedModel;if(!root||!model)return;
 const rows=new Map([...model.groups.flatMap(g=>g.members),...model.team].map(r=>[r.key,r]));
 for(const node of root.querySelectorAll('[data-alcohol-row]')){
  const row=rows.get(node.dataset.alcoholRow);if(!row)continue;
  const points=row.points,valid=points.filter(p=>p.alcoholMix!==null);
  if(!valid.length){node.innerHTML='<span class="foh-note">—</span>';continue;}
  const width=Math.max(200,node.clientWidth||200),left=3,right=3;
  const min=Math.min(...valid.map(p=>p.alcoholMix)),max=Math.max(...valid.map(p=>p.alcoholMix));
  const pad=Math.max(.6,(max-min)*.12),low=Math.max(0,min-pad),high=max+pad;
  const x=i=>points.length===1?width/2:left+(width-left-right)*i/(points.length-1),y=value=>49-(value-low)/(high-low)*25;
  const segments=[];let segment=[];
  points.forEach((p,i)=>{if(p.alcoholMix===null){if(segment.length)segments.push(segment);segment=[]}else segment.push([x(i),y(p.alcoholMix)])});if(segment.length)segments.push(segment);
  const first=valid[0],last=valid[valid.length-1],label=p=>fohAlcoholDate(p.end,model.grain)+': '+fohAlcoholPercent(p.alcoholMix);
  const endpoints=valid.length===1?`<text x="${width/2}" y="11" text-anchor="middle">${label(first)}</text>`:`<text x="${left}" y="11" text-anchor="start">${label(first)}</text><text x="${width-right}" y="11" text-anchor="end">${label(last)}</text>`;
  const description=escapeHTML(row.label+' alcohol share of revenue. '+points.map(p=>p.start+' to '+p.end+': '+fohAlcoholPercent(p.alcoholMix)).join('; '));
  node.innerHTML=`<svg class="al-chart" viewBox="0 0 ${width} 57" role="img" aria-label="${description}">${endpoints}${segments.map(s=>`<polyline points="${s.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6"/>`).join('')}${points.map((p,i)=>p.alcoholMix===null?'':`<circle cx="${x(i)}" cy="${y(p.alcoholMix)}" r="2.5" fill="var(--accent)"/>`).join('')}</svg>`;
 }
}


// Small Plates uses the existing 10% revenue target for both shifts.
function summarizeSmallPlatesChecks(records){
 const total=summarizeSectionChecks(records);let smallPlatesCents=0,smallPlatesChecks=0;
 for(const check of records){let included=false;for(const item of check.items)if(item.category==='apps'){smallPlatesCents+=Math.round(item.price*100);included=true}if(included)smallPlatesChecks++}
 return {...total,smallPlatesCents,smallPlatesChecks,
  smallPlatesMix:total.grossCents?smallPlatesCents/total.grossCents*100:null,
  smallPlatesPerGuestCents:total.guests?smallPlatesCents/total.guests:null,
  smallPlatesIncluded:total.checks?smallPlatesChecks/total.checks*100:null};
}

function fohSmallPlatesModel(window=dateWindow()){
 const allowed=new Set(currentRows().map(row=>row.server));
 const records=checks.filter(check=>inWindow(check.date,window.start,window.end)&&allowed.has(check.server)&&(selectValue('daypart')==='all'||check.daypart===selectValue('daypart')));
 const count=windowDays(window.start,window.end),grain=count<=7?'day':count<=120?'week':'month';
 const buckets=grain==='day'?Array.from({length:count},(_,i)=>{const date=shiftDate(window.start,i);return {start:date,end:date}}):trendBuckets(window,grain);
 const makeRow=(key,label,selected,daypart=null)=>({key,label,daypart,current:summarizeSmallPlatesChecks(selected),points:buckets.map(bucket=>({...bucket,...summarizeSmallPlatesChecks(selected.filter(check=>inWindow(check.date,bucket.start,bucket.end)))}))});
 const groups=(selectValue('daypart')==='all'?['dinner','lunch']:[selectValue('daypart')]).map(daypart=>{
  const selected=records.filter(check=>check.daypart===daypart);
  const members=[...new Set(selected.map(check=>check.server))].map(name=>makeRow(daypart+'-'+serviceEmployees.findIndex(person=>person.name===name),name,selected.filter(check=>check.server===name),daypart));
  members.sort((a,b)=>(b.current.smallPlatesMix??-Infinity)-(a.current.smallPlatesMix??-Infinity)||b.current.grossCents-a.current.grossCents||a.label.localeCompare(b.label));
  return {key:daypart,label:daypart==='dinner'?'Dinner':'Lunch',members,total:makeRow('team-'+daypart,daypart==='dinner'?'Dinner':'Lunch',selected,daypart)};
 });
 const total=makeRow('team-total','Total',records);
 return {window,grain,buckets,groups,total,team:[...groups.map(group=>group.total),total],goal:10};
}

function fohSmallPlatesPercent(value){return value===null?'—':value.toFixed(1)+'%'}

function fohSmallPlatesDate(date,grain){const [y,m,d]=date.split('-');return Number(m)+'/'+(grain==='month'?y.slice(2):Number(d))}

function fohSmallPlatesDetails(row,model,content=null){
 const current=row.current,money=value=>value===null?'—':itemMoney(value,2);
 const stat=(label,value,note='')=>`<div><div class="foh-note">${label}</div><div class="al-detail-value foh-table-value">${value}</div>${note?`<div class="foh-note">${note}</div>`:''}</div>`;
 const body=content===null?`<div class="al-weekly-scroll" role="region" aria-label="${escapeHTML(row.label)} small plates results"><table class="al-detail-table foh-table"><thead><tr><th scope="col">Period ending</th><th scope="col">Small plates revenue</th><th scope="col">Total revenue</th><th scope="col">Small plates %</th></tr></thead><tbody>${row.points.map(point=>`<tr><th scope="row" class="foh-table-role">${fohSmallPlatesDate(point.end,model.grain)}</th><td class="foh-table-secondary">${money(point.smallPlatesCents)}</td><td class="foh-table-secondary">${money(point.grossCents)}</td><td class="foh-table-secondary">${fohSmallPlatesPercent(point.smallPlatesMix)}</td></tr>`).join('')}</tbody></table></div>`:content;
 return `<div class="al-detail-content"><div class="al-detail-stats">${stat('Small plates revenue',money(current.smallPlatesCents))}${stat('Total revenue',money(current.grossCents))}${stat('Small plates $ / guest',money(current.smallPlatesPerGuestCents),fmt(current.guests)+' guests')}${stat('Small plates attachment',fohSmallPlatesPercent(current.smallPlatesIncluded),fmt(current.smallPlatesChecks)+' of '+fmt(current.checks)+' checks')}</div>${body}</div>`;
}

function fohSmallPlatesModuleHTML(){
 const model=fohSmallPlatesModel();fohSmallPlatesRenderedModel=model;
 const color=value=>kpiTargetClass(value,model.goal,'performance');
 const chevron='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
 const heading=label=>`<thead><tr><th scope="col">${label}</th><th scope="col">Small plates %</th><th scope="col">Trend</th></tr></thead>`;
 const row=r=>{
  const group=model.groups.find(g=>g.total.key===r.key);
  const employees=group?`<div class="al-employees al-group"><table class="al-table foh-table" aria-label="${group.label} employee small plates performance">${heading('Name')}<tbody>${group.members.length?group.members.map(row).join(''):'<tr><td colspan="3" class="al-empty foh-note">No sales in this period.</td></tr>'}</tbody></table></div>`:null;
  return `<tr class="al-row"><th scope="row" class="${r.key==='team-total'?'foh-table-total-label':'foh-table-role'}"><button type="button" class="al-toggle" aria-expanded="false" aria-controls="sp-detail-${r.key}" aria-label="${escapeHTML(r.label)} ${r.daypart||'all shifts'} small plates details">${chevron}<span>${escapeHTML(r.label)}</span></button></th><td class="foh-table-value ${color(r.current.smallPlatesMix)}">${fohSmallPlatesPercent(r.current.smallPlatesMix)}</td><td class="al-trend"><div class="al-spark" data-small-plates-row="${r.key}"></div></td></tr><tr class="al-detail" id="sp-detail-${r.key}" hidden><td colspan="3">${fohSmallPlatesDetails(r,model,employees)}</td></tr>`;
 };
 return `<div class="module-title foh-module-title"><h2>Small plates</h2></div><div id="jinya-foh-small-plates"><section class="al-panel foh-metric-panel" aria-label="FOH small plates performance">${fohMetricHeader('FOH SMALL PLATES',fohSmallPlatesPercent(model.total.current.smallPlatesMix),'Goal: '+targetPercent(model.goal),color(model.total.current.smallPlatesMix))}<div class="al-overview al-group"><table class="al-table foh-table" aria-label="Small plates performance by shift">${heading('Shift')}<tbody>${model.team.map(row).join('')}</tbody></table></div></section></div>`;
}

function bindFOHSmallPlates(){
 const root=$('jinya-foh-small-plates');if(!root)return;
 root.querySelectorAll('.al-toggle').forEach(button=>button.addEventListener('click',()=>{
  const open=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(open));
  $(button.getAttribute('aria-controls')).hidden=!open;
  drawFOHSmallPlatesCharts();
 }));
 drawFOHSmallPlatesCharts();
 if(!fohSmallPlatesResizeObserver&&typeof ResizeObserver==='function'){
  fohSmallPlatesResizeObserver=new ResizeObserver(drawFOHSmallPlatesCharts);fohSmallPlatesResizeObserver.observe($('fohSmallPlatesHost'));
 }
}

function drawFOHSmallPlatesCharts(){
 const root=$('jinya-foh-small-plates'),model=fohSmallPlatesRenderedModel;if(!root||!model)return;
 const rows=new Map([...model.groups.flatMap(g=>g.members),...model.team].map(r=>[r.key,r]));
 for(const node of root.querySelectorAll('[data-small-plates-row]')){
  const row=rows.get(node.dataset.smallPlatesRow);if(!row)continue;
  const points=row.points,valid=points.filter(p=>p.smallPlatesMix!==null);
  if(!valid.length){node.innerHTML='<span class="foh-note">—</span>';continue;}
  const width=Math.max(200,node.clientWidth||200),left=3,right=3;
  const min=Math.min(...valid.map(p=>p.smallPlatesMix)),max=Math.max(...valid.map(p=>p.smallPlatesMix));
  const pad=Math.max(.6,(max-min)*.12),low=Math.max(0,min-pad),high=max+pad;
  const x=i=>points.length===1?width/2:left+(width-left-right)*i/(points.length-1),y=value=>49-(value-low)/(high-low)*25;
  const segments=[];let segment=[];
  points.forEach((p,i)=>{if(p.smallPlatesMix===null){if(segment.length)segments.push(segment);segment=[]}else segment.push([x(i),y(p.smallPlatesMix)])});if(segment.length)segments.push(segment);
  const first=valid[0],last=valid[valid.length-1],label=p=>fohSmallPlatesDate(p.end,model.grain)+': '+fohSmallPlatesPercent(p.smallPlatesMix);
  const endpoints=valid.length===1?`<text x="${width/2}" y="11" text-anchor="middle">${label(first)}</text>`:`<text x="${left}" y="11" text-anchor="start">${label(first)}</text><text x="${width-right}" y="11" text-anchor="end">${label(last)}</text>`;
  const description=escapeHTML(row.label+' small plates share of revenue. '+points.map(p=>p.start+' to '+p.end+': '+fohSmallPlatesPercent(p.smallPlatesMix)).join('; '));
  node.innerHTML=`<svg class="al-chart" viewBox="0 0 ${width} 57" role="img" aria-label="${description}">${endpoints}${segments.map(s=>`<polyline points="${s.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6"/>`).join('')}${points.map((p,i)=>p.smallPlatesMix===null?'':`<circle cx="${x(i)}" cy="${y(p.smallPlatesMix)}" r="2.5" fill="var(--accent)"/>`).join('')}</svg>`;
 }
}


// Dessert uses the existing 5% revenue target for both shifts.
function summarizeDessertChecks(records){
 const total=summarizeSectionChecks(records);let dessertCents=0,dessertChecks=0;
 for(const check of records){let included=false;for(const item of check.items)if(item.category==='dessert'){dessertCents+=Math.round(item.price*100);included=true}if(included)dessertChecks++}
 return {...total,dessertCents,dessertChecks,
  dessertMix:total.grossCents?dessertCents/total.grossCents*100:null,
  dessertPerGuestCents:total.guests?dessertCents/total.guests:null,
  dessertIncluded:total.checks?dessertChecks/total.checks*100:null};
}

function fohDessertModel(window=dateWindow()){
 const allowed=new Set(currentRows().map(row=>row.server));
 const records=checks.filter(check=>inWindow(check.date,window.start,window.end)&&allowed.has(check.server)&&(selectValue('daypart')==='all'||check.daypart===selectValue('daypart')));
 const count=windowDays(window.start,window.end),grain=count<=7?'day':count<=120?'week':'month';
 const buckets=grain==='day'?Array.from({length:count},(_,i)=>{const date=shiftDate(window.start,i);return {start:date,end:date}}):trendBuckets(window,grain);
 const makeRow=(key,label,selected,daypart=null)=>({key,label,daypart,current:summarizeDessertChecks(selected),points:buckets.map(bucket=>({...bucket,...summarizeDessertChecks(selected.filter(check=>inWindow(check.date,bucket.start,bucket.end)))}))});
 const groups=(selectValue('daypart')==='all'?['dinner','lunch']:[selectValue('daypart')]).map(daypart=>{
  const selected=records.filter(check=>check.daypart===daypart);
  const members=[...new Set(selected.map(check=>check.server))].map(name=>makeRow(daypart+'-'+serviceEmployees.findIndex(person=>person.name===name),name,selected.filter(check=>check.server===name),daypart));
  members.sort((a,b)=>(b.current.dessertMix??-Infinity)-(a.current.dessertMix??-Infinity)||b.current.grossCents-a.current.grossCents||a.label.localeCompare(b.label));
  return {key:daypart,label:daypart==='dinner'?'Dinner':'Lunch',members,total:makeRow('team-'+daypart,daypart==='dinner'?'Dinner':'Lunch',selected,daypart)};
 });
 const total=makeRow('team-total','Total',records);
 return {window,grain,buckets,groups,total,team:[...groups.map(group=>group.total),total],goal:5};
}

function fohDessertPercent(value){return value===null?'—':value.toFixed(1)+'%'}

function fohDessertDate(date,grain){const [y,m,d]=date.split('-');return Number(m)+'/'+(grain==='month'?y.slice(2):Number(d))}

function fohDessertDetails(row,model,content=null){
 const current=row.current,money=value=>value===null?'—':itemMoney(value,2);
 const stat=(label,value,note='')=>`<div><div class="foh-note">${label}</div><div class="al-detail-value foh-table-value">${value}</div>${note?`<div class="foh-note">${note}</div>`:''}</div>`;
 const body=content===null?`<div class="al-weekly-scroll" role="region" aria-label="${escapeHTML(row.label)} dessert results"><table class="al-detail-table foh-table"><thead><tr><th scope="col">Period ending</th><th scope="col">Dessert revenue</th><th scope="col">Total revenue</th><th scope="col">Dessert %</th></tr></thead><tbody>${row.points.map(point=>`<tr><th scope="row" class="foh-table-role">${fohDessertDate(point.end,model.grain)}</th><td class="foh-table-secondary">${money(point.dessertCents)}</td><td class="foh-table-secondary">${money(point.grossCents)}</td><td class="foh-table-secondary">${fohDessertPercent(point.dessertMix)}</td></tr>`).join('')}</tbody></table></div>`:content;
 return `<div class="al-detail-content"><div class="al-detail-stats">${stat('Dessert revenue',money(current.dessertCents))}${stat('Total revenue',money(current.grossCents))}${stat('Dessert $ / guest',money(current.dessertPerGuestCents),fmt(current.guests)+' guests')}${stat('Dessert attachment',fohDessertPercent(current.dessertIncluded),fmt(current.dessertChecks)+' of '+fmt(current.checks)+' checks')}</div>${body}</div>`;
}

function fohDessertModuleHTML(){
 const model=fohDessertModel();fohDessertRenderedModel=model;
 const color=value=>kpiTargetClass(value,model.goal,'performance');
 const chevron='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
 const heading=label=>`<thead><tr><th scope="col">${label}</th><th scope="col">Dessert %</th><th scope="col">Trend</th></tr></thead>`;
 const row=r=>{
  const group=model.groups.find(g=>g.total.key===r.key);
  const employees=group?`<div class="al-employees al-group"><table class="al-table foh-table" aria-label="${group.label} employee dessert performance">${heading('Name')}<tbody>${group.members.length?group.members.map(row).join(''):'<tr><td colspan="3" class="al-empty foh-note">No sales in this period.</td></tr>'}</tbody></table></div>`:null;
  return `<tr class="al-row"><th scope="row" class="${r.key==='team-total'?'foh-table-total-label':'foh-table-role'}"><button type="button" class="al-toggle" aria-expanded="false" aria-controls="de-detail-${r.key}" aria-label="${escapeHTML(r.label)} ${r.daypart||'all shifts'} dessert details">${chevron}<span>${escapeHTML(r.label)}</span></button></th><td class="foh-table-value ${color(r.current.dessertMix)}">${fohDessertPercent(r.current.dessertMix)}</td><td class="al-trend"><div class="al-spark" data-dessert-row="${r.key}"></div></td></tr><tr class="al-detail" id="de-detail-${r.key}" hidden><td colspan="3">${fohDessertDetails(r,model,employees)}</td></tr>`;
 };
 return `<div class="module-title foh-module-title"><h2>Dessert</h2></div><div id="jinya-foh-dessert"><section class="al-panel foh-metric-panel" aria-label="FOH dessert performance">${fohMetricHeader('FOH DESSERT',fohDessertPercent(model.total.current.dessertMix),'Goal: '+targetPercent(model.goal),color(model.total.current.dessertMix))}<div class="al-overview al-group"><table class="al-table foh-table" aria-label="Dessert performance by shift">${heading('Shift')}<tbody>${model.team.map(row).join('')}</tbody></table></div></section></div>`;
}

function bindFOHDessert(){
 const root=$('jinya-foh-dessert');if(!root)return;
 root.querySelectorAll('.al-toggle').forEach(button=>button.addEventListener('click',()=>{
  const open=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(open));
  $(button.getAttribute('aria-controls')).hidden=!open;
  drawFOHDessertCharts();
 }));
 drawFOHDessertCharts();
 if(!fohDessertResizeObserver&&typeof ResizeObserver==='function'){
  fohDessertResizeObserver=new ResizeObserver(drawFOHDessertCharts);fohDessertResizeObserver.observe($('fohDessertHost'));
 }
}

function drawFOHDessertCharts(){
 const root=$('jinya-foh-dessert'),model=fohDessertRenderedModel;if(!root||!model)return;
 const rows=new Map([...model.groups.flatMap(g=>g.members),...model.team].map(r=>[r.key,r]));
 for(const node of root.querySelectorAll('[data-dessert-row]')){
  const row=rows.get(node.dataset.dessertRow);if(!row)continue;
  const points=row.points,valid=points.filter(p=>p.dessertMix!==null);
  if(!valid.length){node.innerHTML='<span class="foh-note">—</span>';continue;}
  const width=Math.max(200,node.clientWidth||200),left=3,right=3;
  const min=Math.min(...valid.map(p=>p.dessertMix)),max=Math.max(...valid.map(p=>p.dessertMix));
  const pad=Math.max(.6,(max-min)*.12),low=Math.max(0,min-pad),high=max+pad;
  const x=i=>points.length===1?width/2:left+(width-left-right)*i/(points.length-1),y=value=>49-(value-low)/(high-low)*25;
  const segments=[];let segment=[];
  points.forEach((p,i)=>{if(p.dessertMix===null){if(segment.length)segments.push(segment);segment=[]}else segment.push([x(i),y(p.dessertMix)])});if(segment.length)segments.push(segment);
  const first=valid[0],last=valid[valid.length-1],label=p=>fohDessertDate(p.end,model.grain)+': '+fohDessertPercent(p.dessertMix);
  const endpoints=valid.length===1?`<text x="${width/2}" y="11" text-anchor="middle">${label(first)}</text>`:`<text x="${left}" y="11" text-anchor="start">${label(first)}</text><text x="${width-right}" y="11" text-anchor="end">${label(last)}</text>`;
  const description=escapeHTML(row.label+' dessert share of revenue. '+points.map(p=>p.start+' to '+p.end+': '+fohDessertPercent(p.dessertMix)).join('; '));
  node.innerHTML=`<svg class="al-chart" viewBox="0 0 ${width} 57" role="img" aria-label="${description}">${endpoints}${segments.map(s=>`<polyline points="${s.map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6"/>`).join('')}${points.map((p,i)=>p.dessertMix===null?'':`<circle cx="${x(i)}" cy="${y(p.dessertMix)}" r="2.5" fill="var(--accent)"/>`).join('')}</svg>`;
 }
}


// Read-only rendered-style release check. Call auditFOHDesign() in a browser.
// Rendering schedules this automatically; errors appear in the developer console.
function auditFOHDesign(){
 if(typeof getComputedStyle!=='function')return {status:'unavailable',issues:[]};
 const roots=[...document.querySelectorAll('[data-foh-ui]')].filter(root=>!root.hidden);
 const visible=element=>element.getClientRects().length>0;
 const select=selector=>roots.flatMap(root=>[...root.querySelectorAll(selector)]).filter(visible);
 const issues=[],properties=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'];
 const groups={headings:'.foh-metric-label',numbers:'.foh-metric-value',captions:'.foh-metric-caption',tableHeaders:'.foh-table thead th',positions:'.foh-table tbody .foh-table-role',tableValues:'.foh-table-value',tableSecondary:'.foh-table-secondary',moduleNames:'.foh-module-title h2',periods:'.foh-module-title>span'};
 for(const [group,selector]of Object.entries(groups)){
  const elements=select(selector);if(elements.length<2)continue;
  const reference=getComputedStyle(elements[0]);
  for(const element of elements.slice(1)){const actual=getComputedStyle(element);for(const property of properties)if(actual[property]!==reference[property])issues.push({group,property,reference:reference[property],actual:actual[property],text:element.textContent.trim().slice(0,50)});}
 }
 const heads=select('.foh-metric-head');let expectedGap=null;
 for(const head of heads){
  const heading=head.querySelector('.foh-metric-label'),value=head.querySelector('.foh-metric-value');if(!heading||!value)continue;
  const gap=value.getBoundingClientRect().top-heading.getBoundingClientRect().bottom;
  if(expectedGap===null)expectedGap=gap;
  else if(Math.abs(gap-expectedGap)>.25)issues.push({group:'headingNumberGap',reference:expectedGap,actual:gap,text:heading.textContent});
 }
 const panels=select('.foh-metric-panel');if(panels.length){const first=getComputedStyle(panels[0]);for(const panel of panels.slice(1)){const style=getComputedStyle(panel);for(const property of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])if(style[property]!==first[property])issues.push({group:'panelPadding',property,reference:first[property],actual:style[property]});}}
 const result={status:issues.length?'fail':'pass',width:window.innerWidth,headingNumberGap:expectedGap,issues};
 document.documentElement.dataset.fohDesignAudit=result.status;
 if(issues.length)console.error('FOH design consistency check failed',result);
 return result;
}

function fohPerformanceSalesScore(mix,goals){
 const components=Object.entries(fohPerformanceWeights).filter(([,weight])=>Number.isFinite(weight)&&weight>0);
 const weightTotal=components.reduce((sum,[,weight])=>sum+weight,0);
 if(!weightTotal||components.some(([key])=>!Number.isFinite(mix[key])||!Number.isFinite(goals[key])||goals[key]<=0))return null;
 return components.reduce((sum,[key,weight])=>sum+mix[key]/goals[key]*weight,0)/weightTotal*100;
}

function fohPerformanceModel(){
 const window=dateWindow(),part=selectValue('daypart'),allowed=new Set(currentRows().map(row=>row.server));
 const attendance=new Map(fohAttendanceModel(window).people.map(person=>[person.name,person]));
 const records=selectedFOHChecks().filter(check=>allowed.has(check.server));
 const worked=syntheticTimeEntries.filter(entry=>inWindow(entry.date,window.start,window.end)&&(part==='all'||(entry.start<15*60?'lunch':'dinner')===part));
 const goals={alcohol:operationalData.alcoholGoal,apps:10,dessert:5},weeks=windowDays(window.start,window.end)/7;
 const rows=serviceEmployees.filter(person=>allowed.has(person.name)).map(person=>{
  const employeeChecks=records.filter(check=>check.server===person.name),cents={alcohol:0,apps:0,food:0,dessert:0,drink:0};let total=0;
  for(const check of employeeChecks)for(const item of check.items){const value=Math.round(item.price*100);total+=value;cents[item.category]=(cents[item.category]||0)+value}
  const mix=Object.fromEntries(Object.entries(cents).map(([key,value])=>[key,total?100*value/total:null]));
  // Shift identity includes both timestamps, preserving two shifts in a day
  // while rejecting duplicate imported punches. Callouts are not worked shifts.
  const shifts=new Set(worked.filter(entry=>entry.name===person.name&&entry.role===person.role).map(entry=>[entry.date,entry.start,entry.end].join('|'))).size;
  const attendanceRow=attendance.get(person.name);
  return {name:person.name,role:person.role,mix,totalCents:total,score:fohPerformanceSalesScore(mix,goals),reliability:attendanceRow?fohAttendanceScore(attendanceRow):null,shifts,shiftsPerWeek:weeks?shifts/weeks:null};
 });
 const groups=[['server','SERVERS'],['bartender','BAR']].map(([role,label])=>{
  const members=rows.filter(row=>row.role===role).sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||b.shifts-a.shifts||a.name.localeCompare(b.name));
  let previousScore=null,previousShifts=null,rank=0;
  members.forEach((row,index)=>{if(row.score===null){row.rank=null;return}if(index===0||row.score!==previousScore||row.shifts!==previousShifts)rank=index+1;row.rank=rank;previousScore=row.score;previousShifts=row.shifts});
  return {role,label,members};
 });
 return {window,part,goals,groups};
}

function fohPerformanceModuleHTML(){
 const model=fohPerformanceModel(),percent=value=>value===null?'—':value.toFixed(1)+'%';
 const cell=(label,value,kind='foh-table-value',status='')=>`<td class="${kind} ${status}" data-label="${label}">${value}</td>`;
 const row=person=>`<tr><th scope="row" class="foh-table-role">${escapeHTML(person.name)}</th>${cell('Sales rank',person.rank??'—')}${cell('Alcohol',percent(person.mix.alcohol),'foh-table-value',kpiTargetClass(person.mix.alcohol,model.goals.alcohol,'performance'))}${cell('Small Plate',percent(person.mix.apps),'foh-table-value',kpiTargetClass(person.mix.apps,model.goals.apps,'performance'))}${cell('Entrée',percent(person.mix.food))}${cell('Dessert',percent(person.mix.dessert),'foh-table-value',kpiTargetClass(person.mix.dessert,model.goals.dessert,'performance'))}${cell('Reliability',person.reliability===null?'—':person.reliability+'%','foh-table-value',kpiTargetClass(person.reliability,fohAttendanceGoal,'attendance'))}${cell('Shifts/week',person.shiftsPerWeek===null?'—':person.shiftsPerWeek.toFixed(1),'foh-table-secondary')}</tr>`;
 const group=group=>`<section class="lead-group" aria-labelledby="foh-performance-${group.role}"><h3 class="foh-table-role" id="foh-performance-${group.role}">${group.label}</h3><table class="lead-table foh-table" aria-label="${group.label} sales rank, sales mix, reliability and average worked shifts per week"><colgroup><col class="lead-name"><col class="lead-rank"><col class="lead-mix"><col class="lead-mix"><col class="lead-mix"><col class="lead-mix"><col class="lead-reliability"><col class="lead-shifts"></colgroup><thead><tr><th rowspan="2" scope="col">Employee</th><th rowspan="2" scope="col">Sales<br>rank</th><th colspan="4" scope="colgroup" class="lead-mix-heading">Sales Mix · % of total revenue</th><th rowspan="2" scope="col">Reliability</th><th rowspan="2" scope="col">Shifts/<br>week</th></tr><tr><th scope="col">Alcohol</th><th scope="col">Small Plate</th><th scope="col">Entrée</th><th scope="col">Dessert</th></tr></thead><tbody>${group.members.map(row).join('')||'<tr class="lead-empty"><td colspan="8" class="foh-table-role">No measured sales for this selection.</td></tr>'}</tbody></table></section>`;
 return `<div data-foh-ui id="jinya-foh-performance"><div class="module-title foh-module-title"><h2>Performance</h2></div><section class="lead-panel foh-metric-panel" aria-label="FOH employee performance"><h2 class="foh-metric-title">FOH PERFORMANCE</h2>${model.groups.map(group).join('')}</section></div>`;
}
