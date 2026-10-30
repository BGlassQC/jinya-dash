/* JINYA v0143 — Overview. Headline values use the source tabs' models,
   target colors, rounding and filter scope. No separate sample values. */

const fohOverviewModules={
 labor:{category:'staff-performance',id:'fohLaborHost'},
 staffing:{category:'staff-performance',id:'fohHiringHost'},
 turnover:{category:'staff-performance',id:'fohTurnoverHost'},
 attendance:{category:'staff-performance',id:'fohAttendanceHost'},
 alcohol:{category:'staff-performance',id:'fohAlcoholHost'},
 'small-plates':{category:'staff-performance',id:'fohSmallPlatesHost'},
 dessert:{category:'staff-performance',id:'fohDessertHost'},
 satisfaction:{category:'guest-relations',id:'jinya-guest-satisfaction'}
};

function fohOverviewDestination(hash){
 return Object.values(fohOverviewModules).find(destination=>'#'+destination.id===hash)||null;
}

function bindFOHOverviewLinks(){
 for(const link of $('fohOverviewHost').querySelectorAll('[data-overview-metric]'))link.onclick=event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  const destination=fohOverviewModules[link.dataset.overviewMetric];
  selectFOHCategory(destination.category,destination.id);
 };
}

function fohOverviewModel(){
 const labor=fohLaborTotals(fohLaborSample());
 const staffing=fohHiringHours().total;
 const turnover=fohTurnoverModel().rows.find(row=>row.key==='foh').current;
 const attendance=fohAttendanceModel().total;
 const alcohol=fohAlcoholModel(),smallPlates=fohSmallPlatesModel(),dessert=fohDessertModel();
 const guest=fohGuestExperienceModel();
 return {window:dateWindow(),labor,staffing,turnover,attendance,alcohol,smallPlates,dessert,guest};
}

function fohOverviewGauge(value,goal,ceiling,lower,label){
 const max=Math.max(ceiling,goal,Number.isFinite(value)?value:0),fraction=v=>Math.max(0,Math.min(1,v/max));
 const point=(f,r)=>[110-Math.cos(f*Math.PI)*r,100-Math.sin(f*Math.PI)*r];
 const area=(a,b,color,opacity=1)=>{
  const s=point(a,84),e=point(b,84),i=point(b,70),j=point(a,70);
  return `<path d="M ${s} A 84 84 0 0 1 ${e} L ${i} A 70 70 0 0 0 ${j} Z" fill="${color}" opacity="${opacity}"/>`;
 };
 const target=fraction(goal),a=point(target,65),b=point(target,92),needle=Number.isFinite(value)?point(fraction(value),66):null;
 const ticks=max<2?max.toFixed(2):Number(max.toFixed(1));
 return `<svg class="foh-overview-gauge" viewBox="0 0 220 126" role="img" aria-label="${label}: ${value===null?'no data':value.toFixed(2)+' percent'}. Target ${lower?'at most ':''}${goal.toFixed(2)} percent.">${area(0,1,'var(--line)')}${area(lower?0:target,lower?target:1,'var(--positive)',.45)}<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--ink)" stroke-width="2"/>${needle?`<line x1="110" y1="100" x2="${needle[0]}" y2="${needle[1]}" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/><circle cx="110" cy="100" r="7" fill="var(--ink)"/>`:''}<text x="26" y="123">0%</text><text x="194" y="123" text-anchor="end">${ticks}%</text></svg>`;
}

function renderFOHOverviewPage(){
 const {labor,staffing,turnover,attendance,alcohol,smallPlates,dessert,guest}=fohOverviewModel();
 const card=(key,label,value,goal,ceiling,rule,digits=0,lower=false)=>{
  const shown=value===null?'—':value.toFixed(digits)+'%',caption='Goal: '+(lower?'≤ ':'')+Number(goal.toFixed(2))+'%';
  return `<a class="foh-overview-card foh-metric-panel" data-overview-metric="${key}" href="#${fohOverviewModules[key].id}"><h2 class="foh-metric-label">${label}</h2>${fohOverviewGauge(value,goal,ceiling,lower,label)}<div class="foh-metric-value ${kpiTargetClass(value,goal,rule)}">${shown}</div><div class="foh-metric-caption">${caption}</div></a>`;
 };
 const laborPercent=labor.revenueCents?labor.actualCents/labor.revenueCents*100:null;
 const staffingPercent=staffing.standard?Math.round(100*staffing.filled/staffing.standard):null;
 const metricCards=[
  card('labor','FOH LABOR',laborPercent,fohLaborTarget*100,20,'labor',2,true),
  card('staffing','FOH STAFFING',staffingPercent,fohStaffingGoal,100,'staffing'),
  card('turnover','FOH TURNOVER',turnover.rate,turnover.goal,Math.max(1,Math.ceil(turnover.goal*2)),{direction:'lower',band:turnover.goal*kpiColorRules.turnover.band/fohTurnoverTargets.foh},1,true),
  card('attendance','FOH ATTENDANCE',fohAttendanceScore(attendance),fohAttendanceGoal,100,'attendance')
 ];
 const salesCards=[
  card('alcohol','FOH ALCOHOL',alcohol.total.current.alcoholMix,alcohol.goal,40,'performance',1),
  card('small-plates','FOH SMALL PLATES',smallPlates.total.current.smallPlatesMix,smallPlates.goal,16,'performance',1),
  card('dessert','FOH DESSERT',dessert.total.current.dessertMix,dessert.goal,8,'performance',1)
 ];
 $('fohOverviewHost').innerHTML=`<div class="module-title foh-module-title"><h2>Staff Performance</h2></div><div class="foh-overview-metrics">${metricCards.join('')}</div><div class="foh-overview-sales">${salesCards.join('')}</div><div class="foh-overview-guest"><div class="module-title foh-module-title"><h2>Guest Relations</h2></div>${card('satisfaction','GUEST SATISFACTION',guest.total.score,guest.goal,100,'guestSatisfaction',1)}</div>`;
 bindFOHOverviewLinks();
}

