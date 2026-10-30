/* JINYA v0138 — Retained Parking Lot modules, legacy tables, rankings and trends. Function definitions only; all functions share the same data and filters. */

function staffingEfficiencyHTML(){
 const cs=selectedFOHChecks().filter(c=>c.employeeRole==='server'),part=selectValue('daypart'),hours=part==='lunch'?[11,12,13,14,15,16]:part==='dinner'?[17,18,19,20,21]:[11,12,13,14,15,16,17,18,19,20,21];
 const dates=[...new Set(cs.map(c=>c.date))],byDate=new Map();for(const c of cs){if(!byDate.has(c.date))byDate.set(c.date,[]);byDate.get(c.date).push(c)}const targetMin=10,targetMax=14;
 const data=hours.map(h=>{let totalGuests=0,totalServers=0,expo=0,bar=0,hosts=0,bussers=0;
 for(const date of dates){const subset=byDate.get(date)||[],minute=h*60+30,active=subset.filter(c=>c.arrivalMinute<=minute&&c.arrivalMinute+c.duration>minute);
 const guests=active.reduce((a,c)=>a+c.guests,0),servers=new Set(active.map(c=>c.server)).size;
 totalGuests+=guests;totalServers+=servers;
 // Synthetic supporting-role coverage estimates. These are not clock-in records.
 expo+=guests?Math.max(1,Math.ceil(guests/45)):0;
 bar+=guests?Math.max(1,Math.ceil(guests/55)):0;
 hosts+=guests?Math.max(1,Math.ceil(guests/65)):0;
 bussers+=guests?Math.max(1,Math.ceil(guests/35)):0;
 }
 const n=dates.length||1,guests=totalGuests/n,servers=totalServers/n,ratio=servers?guests/servers:0;
 return {h,guests,servers,ratio,expo:expo/n,bar:bar/n,hosts:hosts/n,bussers:bussers/n};
 });
 const fmtHour=h=>(h%12||12)+(h<12?' AM':' PM');
 const count=n=>n.toFixed(1);
 return `<article class="card"><div class="head"><h2>Staffing Efficiency by Hour</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><p class="hint">Target: ${targetMin}–${targetMax} guests / server</p><div class="server-scroll"><table class="table staffing-table"><thead><tr><th>Hour</th><th>Guests*</th><th>Server</th><th>Ratio</th><th>Expo</th><th>Bar</th><th>Host</th></tr></thead><tbody>${data.map(r=>`<tr><td>${fmtHour(r.h)} to ${fmtHour(r.h+1)}</td><td>${Math.round(r.guests)}</td><td>${count(r.servers)}</td><td><span class="staff-status ${!r.servers||r.ratio>targetMax?'staff-low':r.ratio<targetMin?'staff-high':'staff-ok'}">${r.servers?r.ratio.toFixed(1):'—'}</span></td><td>${count(r.expo)}</td><td>${count(r.bar)}</td><td>${count(r.hosts)}</td></tr>`).join('')}</tbody></table></div><p class="foot">*Guests are estimated simultaneous diners, averaged by hour. Staffing is simulated. Target ratio of 10–14 is illustrative.</p></article>`
}

function sectionPerformanceData(records=selectedFOHChecks()){
 const row=group=>({...group,...summarizeSectionChecks(records.filter(check=>sectionMatchesGroup(check,group)))});
 return {total:summarizeSectionChecks(records),locations:sectionPlanningGroups.filter(group=>group.location).map(row),
  sections:sectionPlanningGroups.filter(group=>group.sectionId).map(row),unmapped:row(sectionPlanningGroups.find(group=>group.unmapped))};
}

function sectionEmployeeRows(groupKey,records=selectedFOHChecks()){
 const group=sectionPlanningGroups.find(group=>group.key===groupKey);if(!group)return [];
 const selected=records.filter(check=>sectionMatchesGroup(check,group));
 const allowed=new Set(currentRows().filter(row=>employeeRoles[row.role]).map(row=>row.server));
 return [...new Set(selected.map(check=>check.server))].filter(name=>allowed.has(name)).sort((a,b)=>a.localeCompare(b)).map(name=>({
  name,role:serviceEmployees.find(employee=>employee.name===name)?.role||'server',
  selected:summarizeSectionChecks(selected.filter(check=>check.server===name)),
  overall:summarizeSectionChecks(records.filter(check=>check.server===name))
 }));
}

function sectionMetricCells(row){return [fmt(row.checks),fmt(row.guests),sectionMoney(row.grossCents,0),
 sectionMoney(row.avgCheckCents),sectionMoney(row.salesPerGuestCents),sectionMoney(row.alcoholPerCheckCents),
 sectionMoney(row.alcoholPerGuestCents),sectionPercent(row.alcoholMix),sectionPercent(row.alcoholIncluded)].map(value=>`<td>${value}</td>`).join('')}

function selectSectionPlanningGroup(groupKey){
 if(groupKey!==null&&!sectionPlanningGroups.some(group=>group.key===groupKey))return false;
 const previous=sectionPlanningView.group;
 sectionPlanningView.group=groupKey===previous?null:groupKey;
 const panel=$('sectionEmployeeComparison');if(panel){panel.hidden=!sectionPlanningView.group;panel.innerHTML=sectionEmployeeComparisonHTML()}
 syncSectionPlanningControls();persistDashboardView();
 if(!sectionPlanningView.group&&previous){const button=[...document.querySelectorAll('[data-section-group]')].find(element=>element.dataset.sectionGroup===previous);if(button)button.focus()}
 return true;
}

function syncSectionPlanningControls(){
 for(const button of document.querySelectorAll('[data-section-group]')){
  const selected=sectionPlanningView.group===button.dataset.sectionGroup;
  button.setAttribute('aria-expanded',String(selected));button.classList.toggle('selected',selected);
  button.onclick=()=>selectSectionPlanningGroup(button.dataset.sectionGroup);
 }
 bindSectionTableSorting();
 const close=$('closeSectionEmployees');if(close)close.onclick=()=>selectSectionPlanningGroup(null);
}

function lossAnalysisHTML(){const cs=selectedFOHChecks(),ids=new Set(cs.map(c=>c.id)),ls=losses.filter(l=>ids.has(l.checkId)),byServer=new Map();for(const c of cs)if(!byServer.has(c.server))byServer.set(c.server,{name:c.server,checks:0,refund:0,comps:0});for(const c of cs)byServer.get(c.server).checks++;for(const l of ls){const r=byServer.get(l.server);if(r)r[l.type==='Refund'?'refund':'comps']+=l.amount}const ordered=[...byServer.values()].sort((a,b)=>b.refund-a.refund);return `<div class="section full"><article class="card"><div class="head"><h2>Refunds & Comps by Server</h2><span class="hint">Sorted by refund dollars · Review alongside check volume</span></div>${table(['Server','Closed checks','Refund $','Refunds / 100 checks','Comps $'],ordered.map(r=>[r.name,r.checks,cash(r.refund),r.checks?(100*ls.filter(l=>l.server===r.name&&l.type==='Refund').length/r.checks).toFixed(1):'0.0',cash(r.comps)]))}</article></div>`}

function renderServerTable(){
 const target=$('serverTable');if(!target)return;
 const rows=performanceRows();renderPeriodStats(rows);
 const cols=serverColumns.map(([key,label])=>[key,key==='refunds'?(metricMode==='guest'?'Refund / Guest':metricMode==='quantity'?'Refund Total':metricMode==='share'?'Refund Share':'Refund / Check'):key==='check'?(metricMode==='guest'?'Sales / Guest':metricMode==='quantity'?'Sales':metricMode==='share'?'Sales Share':'Avg Check'):label]);
 const sorted=[...rows].sort((a,b)=>{const av=displayValue(a,sortServerBy,rows),bv=displayValue(b,sortServerBy,rows);return (typeof av==='string'?av.localeCompare(bv):av-bv)*sortServerDirection});
 const moneyKeys=['alcohol','apps','dessert','check','refunds'];
 const number=(v,d=0)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 function cell(r,key){const v=displayValue(r,key,rows);
  if(key==='server'){const label=r.role==='bartender'?'Bartender':'Server',badge=r.role==='bartender'?'B':'S';return `<span class="employee-name"><span class="employee-role-badge ${r.role}" role="img" aria-label="${label}" title="${label}">${badge}</span><span>${r.server}</span></span>`}
  if(key==='guests'||key==='tables')return number(v);
  if(key==='duration')return number(v)+' min';
  if(key==='party'||key==='turns')return number(v,1);
  if(metricMode==='share')return moneyKeys.includes(key)?number(v,0)+'%':'—';
  if(key==='refunds'&&metricMode==='guest')return '$'+number(v,2);
  if(metricMode==='guest'&&['alcohol','apps','dessert','check'].includes(key))return '$'+number(v,2);
  if(moneyKeys.includes(key))return '$'+number(v,metricMode==='quantity'?0:2);
  return number(v,2);
 }
 function coloredCell(r,key){const value=cell(r,key);if(!['alcohol','apps','dessert','check','refunds','duration'].includes(key)||value==='—')return value;if(isLiveView()||r.closedChecks<30||metricMode==='guest'||new Set(rows.map(x=>x.role)).size>1)return `<span class="performance neutral">${value}</span>`;if(!['alcohol','apps','dessert','check','refunds','duration'].includes(key)||value==='—')return value;const actual=displayValue(r,key,rows);let goal=referenceTargets(rows,r)[key];if(key==='refunds'){const weights=targetDaypartWeights(rows,r);goal=refundTargets.lunch*weights.lunch+refundTargets.dinner*weights.dinner;if(metricMode==='quantity')goal*=r.closedChecks;else if(metricMode==='share')return `<span class="performance neutral">${value}</span>`;else if(metricMode==='guest')return value;const color=performanceClass(actual,'refunds',goal);return `<span class="performance ${color}">${value}</span>`}if(metricMode==='share')return `<span class="performance neutral">${value}</span>`;if(!Number.isFinite(goal)||goal<=0)return value;return `<span class="performance ${performanceClass(actual,key,goal)}">${value}</span>`}
 function totalCell(key){if(key==='server')return metricMode==='quantity'||metricMode==='share'?'TEAM TOTAL':'TEAM AVG';
  if(key==='guests'||key==='tables')return number(rows.reduce((sum,r)=>sum+r[key],0));
  if(metricMode==='share')return moneyKeys.includes(key)?(rows.reduce((sum,r)=>sum+displayValue(r,key,rows),0)?'100%':'—'):'—';
  const checks=rows.reduce((sum,r)=>sum+r.closedChecks,0),guests=rows.reduce((sum,r)=>sum+r.guests,0);
  if(key==='party')return checks?number(guests/checks,1):'—';
  if(key==='turns'){const shifts=rows.reduce((sum,r)=>sum+r.shiftCount,0);return shifts?number(checks/shifts,1):'—'}
  if(key==='duration')return checks?number(rows.reduce((sum,r)=>sum+r.duration*r.closedChecks,0)/checks)+' min':'—';
  if(key==='refunds'){const total=rows.reduce((sum,r)=>sum+r.refunds,0);if(metricMode==='guest')return guests?'$'+number(total/guests,2):'—';return '$'+number(metricMode==='quantity'?total:checks?total/checks:0,metricMode==='quantity'?0:2)}
  if(metricMode==='guest'){return guests?'$'+number(rows.reduce((sum,r)=>sum+(r.perGuest[key]||0)*r.guests,0)/guests,2):'—'}
  if(metricMode==='quantity'){const total=rows.reduce((sum,r)=>sum+(key==='check'?r.grossTotal:r.quantities[key]||0),0);return '$'+number(total)}
  const total=rows.reduce((sum,r)=>sum+r[key]*r.closedChecks,0);return '$'+number(checks?total/checks:0,2);
 }
 target.innerHTML=`<div class="server-scroll"><table class="server-table"><thead><tr>${cols.map(([key,label])=>`<th scope="col"><button type="button" data-sort="${key}">${label} ${sortServerBy===key?(sortServerDirection===1?'▲':'▼'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(r=>`<tr>${cols.map(([key])=>`<td>${coloredCell(r,key)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${cols.map(([key])=>`<td>${totalCell(key)}</td>`).join('')}</tr></tfoot></table></div><p class="employee-evidence-note">The Employees filter applies here and to Server Trends. Each panel has its own role controls. Colors remain neutral in Live, below 30 checks, in $ / Guest mode without direct targets, or when roles share an unvalidated target. Checks / Shift uses synthetic service shifts.</p>${rows.length?'':`<div class="empty">${!employeeRoles.server&&!employeeRoles.bartender?'Select Server or Bar to view performance.':'No employees match these filters.'}</div>`}`;
 target.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.sort;if(sortServerBy===key)sortServerDirection*=-1;else{sortServerBy=key;sortServerDirection=key==='server'?1:-1}renderServerTable()});
}

function syncEmployeeRoles(){
 for(const [id,role] of [['allServersRole','all'],['serversRole','server'],['bartendersRole','bartender']]){
  const button=$(id);if(!button)continue;
  const active=role==='all'?employeeRoles.server&&employeeRoles.bartender:role==='server'?employeeRoles.server&&!employeeRoles.bartender:employeeRoles.bartender&&!employeeRoles.server;
  button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  button.onclick=()=>{employeeRoles.server=role!=='bartender';employeeRoles.bartender=role!=='server';syncEmployeeRoles();renderServerTable();const comparison=$('sectionEmployeeComparison');if(comparison)comparison.innerHTML=sectionEmployeeComparisonHTML();syncSectionPlanningControls();persistDashboardView()};
 }
}

function syncMetricMode(){for(const [id,mode] of [['moneyMode','money'],['quantityMode','quantity'],['guestMode','guest'],['shareMode','share']]){const b=$(id);if(b){b.classList.toggle('selected',metricMode===mode);b.setAttribute('aria-pressed',String(metricMode===mode));b.onclick=()=>{metricMode=mode;syncMetricMode();renderServerTable()}}}}

function bestSellerPeriodLabel(){return bestSellerPeriods.find(([value])=>value===String(days))?.[1]||String(days)}

function bestSellerScope(){
 const w=dateWindow(),dateLabel=value=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
 const part={all:'All Day',lunch:'Lunch (11 AM to 5 PM)',dinner:'Dinner (5 PM to 10 PM)'}[selectValue('daypart')];
 const population='All Employees';
 return dateLabel(w.start)+(w.start===w.end?'':' to '+dateLabel(w.end))+' · '+part+' · '+population;
}

function bestSellersData(){
 const byItem=new Map(menuCatalog.map(item=>[item.id,{id:item.id,name:item.name,category:item.category,units:0,cents:0}]));
 const categoryTotals=new Map(bestSellerCategories.map(([category])=>[category,0]));
 const cs=selectedFOHChecks();let totalCents=0;
 for(const check of cs)for(const item of check.items){
  const id=item.itemId||item.category+':'+item.name;
  if(!byItem.has(id))byItem.set(id,{id,name:item.name||'Unmapped item',category:item.category,units:0,cents:0});
  const row=byItem.get(id),cents=Math.round(item.price*100);
  row.units++;row.cents+=cents;totalCents+=cents;
  categoryTotals.set(row.category,(categoryTotals.get(row.category)||0)+cents);
 }
 const rows=[...byItem.values()].map(row=>({...row,categoryShare:categoryTotals.get(row.category)?row.cents/categoryTotals.get(row.category)*100:0,totalShare:totalCents?row.cents/totalCents*100:0}));
 return {rows,categoryTotals,totalCents,checkCount:cs.length};
}

function rankBestSellers(rows){return [...rows].sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name)||a.id.localeCompare(b.id))}

function bestSellerCells(row,rank){
 return `<td class="best-seller-item">${rank?`<span class="best-seller-rank">${rank}</span>`:''}<span>${escapeHTML(row.name)}</span></td><td>${fmt(row.units)}</td><td>${itemMoney(row.cents)}</td><td>${Math.round(row.categoryShare)}%</td><td>${itemPercent(row.totalShare)}</td>`;
}

function bestSellersHTML(){
 const data=bestSellersData();
 const cards=bestSellerCategories.map(([category,label])=>{
  const selling=rankBestSellers(data.rows.filter(row=>row.category===category&&row.units>0)),top=selling.slice(0,5);
  return `<article class="card best-seller-card"><div class="head"><h3>${label}</h3><span class="hint">${top.length<5?top.length+' items with sales':'Top 5 by revenue'}</span></div><div class="best-seller-scroll"><table class="best-seller-table"><thead><tr><th scope="col">Item</th><th scope="col">No<br>Sold</th><th scope="col">Rev</th><th scope="col">Pct of<br>Cat Rev</th><th scope="col">Pct of<br>Total Rev</th></tr></thead><tbody>${top.length?top.map((row,index)=>`<tr>${bestSellerCells(row,index+1)}</tr>`).join(''):'<tr><td colspan="5" class="best-seller-empty">No sales match these filters.</td></tr>'}</tbody></table></div></article>`;
 }).join('');
 return `<section class="best-sellers-section" id="bestSellersSection" aria-labelledby="bestSellersTitle"><div class="best-sellers-heading"><div class="best-sellers-title-group"><h2 id="bestSellersTitle" class="foh-section-title">BEST SELLERS</h2><button type="button" id="viewAllItems" class="best-sellers-link" aria-label="View all menu items in an expanded view">View all items ↗</button></div><span class="section-period">${bestSellerPeriodLabel()}</span></div><div class="best-sellers-grid">${cards}</div><p class="foot best-sellers-note">Revenue and units are before refunds and comps. Revenue excludes tax and tips. Category % uses the entire category; total % uses all filtered item sales.</p><p id="bestSellersWindowNote" class="foot" role="status" hidden></p></section>`;
}

function paretoItems(rows){
 const ranked=rankBestSellers(rows),totalCents=ranked.reduce((sum,row)=>sum+row.cents,0);let cumulativeCents=0;
 const result=ranked.map((row,index)=>{
  const group=row.units===0?'zero':totalCents>0&&cumulativeCents*100<totalCents*80?'core':'tail';
  cumulativeCents+=row.cents;
  return {...row,rank:index+1,group,revPerItem:row.units?row.cents/row.units:null,cumulativeShare:totalCents?cumulativeCents/totalCents*100:0};
 });
 const core=result.filter(row=>row.group==='core'),tail=result.filter(row=>row.group==='tail'),zero=result.filter(row=>row.group==='zero');
 return {rows:result,totalCents,core,tail,zero};
}

function paretoChartHTML(analysis){
 const rows=analysis.rows.filter(row=>row.units>0),max=Math.max(0,...rows.map(row=>row.cents));
 if(!analysis.totalCents||!max)return '<p class="items-empty">No sales match the selected FOH filters.</p>';
 const width=1040,height=220,left=56,right=58,top=25,bottom=37,pw=width-left-right,ph=height-top-bottom,step=pw/rows.length;
 const x=index=>left+step*(index+.5),lineY=pct=>top+ph*(1-pct/100),barY=cents=>top+ph*(1-cents/max);
 const grid=[0,20,40,60,80,100].map(pct=>`<line x1="${left}" x2="${width-right}" y1="${lineY(pct)}" y2="${lineY(pct)}" stroke="${pct===80?'#9aa575':'#e8ecef'}" stroke-dasharray="${pct===80?'5 4':'0'}"/><text x="${width-right+8}" y="${lineY(pct)+3}" font-size="10" fill="#7b8792">${pct}%</text>`).join('');
 const bars=rows.map((row,index)=>`<rect x="${x(index)-Math.max(1,step*.7)/2}" y="${barY(row.cents)}" width="${Math.max(1,step*.7)}" height="${top+ph-barY(row.cents)}" fill="${row.group==='core'?'#788344':'#b8c0c6'}"><title>${escapeHTML(row.name)}: ${itemMoney(row.cents)}; cumulative ${itemPercent(row.cumulativeShare)}</title></rect>`).join('');
 const points=rows.map((row,index)=>x(index)+','+lineY(row.cumulativeShare)).join(' ');
 const ticks=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((index,pos,a)=>a.indexOf(index)===pos).map(index=>`<text x="${x(index)}" y="${height-19}" text-anchor="middle" fill="#7b8792" font-size="10">${index+1}</text>`).join('');
 return `<svg class="pareto-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pareto chart: items ranked by revenue, with cumulative revenue and an 80 percent reference line"><text x="${left}" y="12" fill="#7b8792" font-size="10">Item revenue</text><text x="${width-right}" y="12" text-anchor="end" fill="#7b8792" font-size="10">Cumulative revenue</text>${grid}<text x="${left-8}" y="${top+4}" text-anchor="end" font-size="10" fill="#7b8792">${itemMoney(max)}</text><text x="${left-8}" y="${top+ph+4}" text-anchor="end" font-size="10" fill="#7b8792">$0</text>${bars}<polyline fill="none" stroke="#283746" stroke-width="2" points="${points}"/>${ticks}<text x="${width/2}" y="${height-3}" text-anchor="middle" fill="#7b8792" font-size="10">Items ranked by revenue</text></svg>`;
}

function itemsViewHTML(){
 return `<section class="items-app" role="dialog" aria-modal="true" aria-labelledby="allItemsTitle"><header class="items-header"><div class="items-topline"><div><div class="items-brand">JINYA · QUEEN CREEK · SANDBOX</div><h1 id="allItemsTitle">ALL ITEMS</h1></div><div class="items-actions"><button type="button" id="itemsOpenWindow">Open in new window ↗</button><button type="button" id="itemsClose">Close ✕</button></div></div><div id="itemsCategories" class="items-categories" role="group" aria-label="Item categories"></div><button type="button" id="itemsFilterToggle" class="filter-summary-toggle" aria-expanded="false" aria-controls="itemsFilterDrawer" aria-label="Filters"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h2m4 0h12"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="7" cy="18" r="2"/></svg><span id="itemsFilterSummary" class="filter-selection-summary" aria-live="polite"></span><span class="filter-summary-chevron" aria-hidden="true"></span></button>
<div id="itemsFilterDrawer" class="filter-drawer" hidden><div class="filter-button-grid">
<fieldset id="allItemsDaypartFilter"><legend>SHIFT</legend><div id="itemsDaypartButtons" class="filter-button-pair" role="group" aria-label="Shift: select Lunch, Dinner or All Day"><button type="button" id="itemsDaypartButtons-all" aria-pressed="false">All Day</button><button type="button" id="itemsDaypartButtons-lunch" aria-pressed="false">Lunch</button><button type="button" id="itemsDaypartButtons-dinner" aria-pressed="false">Dinner</button></div></fieldset>
<fieldset id="allItemsPopulationFilter"><legend>EMPLOYEES</legend><div id="itemsEmployeeButtons" class="filter-button-pair" role="group" aria-label="Employees"><button type="button" id="itemsEmployeeButtons-onfloor" aria-label="Currently on Floor" aria-pressed="false">Current</button><button type="button" id="itemsEmployeeButtons-active" aria-pressed="false">All Employees</button></div></fieldset>
<fieldset id="allItemsPeriodFilter" class="filter-period-field"><legend>REPORT PERIOD</legend><div id="itemsPeriodButtons" class="filter-period-buttons" role="group" aria-label="Report period"><button type="button" id="itemsPeriodButtons-1" aria-pressed="false">Today</button><button type="button" id="itemsPeriodButtons-7" aria-pressed="false">Last 7 Days</button><button type="button" id="itemsPeriodButtons-30" aria-pressed="false">Last 30 Days</button><button type="button" id="itemsPeriodButtons-90" aria-pressed="false">Last 90 Days</button><button type="button" id="itemsPeriodButtons-rolling12" aria-pressed="false">Rolling 12 Months</button><button type="button" id="itemsPeriodButtons-quarter" aria-pressed="false">Last Quarter</button><button type="button" id="itemsPeriodButtons-year" aria-pressed="false">Last Calendar Year</button><button type="button" id="itemsPeriodButtons-ytd" aria-pressed="false">Year to Date</button></div></fieldset>
</div></div>
<div class="filter-proxies" hidden><select id="allItemsDaypart" aria-label="Shift"><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="all" selected>All Day</option></select><select id="allItemsPopulation" aria-label="Employees"><option value="onfloor">Currently on Floor</option><option value="active" selected>All Employees</option></select><select id="allItemsPeriod" aria-label="Report period"><option value="1">Today</option><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="rolling12">Rolling 12 Months</option><option value="quarter">Last Quarter</option><option value="year">Last Calendar Year</option><option value="ytd">Year to Date</option></select></div></header><div class="items-body"><div id="itemsSummary" class="items-summary"></div><section class="items-pareto"><h2>Revenue concentration</h2><div id="itemsPareto"></div><div class="pareto-legend"><span><i class="core"></i>Items reaching 80% of revenue</span><span><i class="tail"></i>Remaining revenue</span><span><i class="line"></i>Cumulative revenue</span></div></section><div class="items-tools"><div id="itemsTier" class="items-tier" role="group" aria-label="Revenue groups"></div><label><span class="hint">Find an item</span><br><input class="items-search" type="search" id="allItemsSearch" placeholder="Search menu items"></label></div><p id="allItemsCount" class="items-count" aria-live="polite"></p><div class="items-table-scroll"><table><thead id="allItemsHead"></thead><tbody id="allItemsBody"></tbody></table></div><p class="items-note">Rev / Item = revenue ÷ number sold. Revenue and units are before refunds and comps; revenue excludes tax and tips.</p><p class="items-note">The leading group includes the item that reaches or crosses 80% of selected-category revenue. The remainder can be less than 20%. Zero-sale items are separate. Search and revenue-group slicers narrow the list without changing the Pareto analysis.</p><p class="items-note">Pct of Cat Rev uses the full category; Pct of Total Rev uses all filtered FOH sales. FOH date, time and employee filters stay synchronized.</p><p id="itemsStatus" class="items-status" role="status"></p></div></section>`;
}

function bestSellersWindowHTML(){return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JINYA | All Items</title><style>html,body{height:100%;margin:0;overflow:hidden}'+itemsViewStyles+'.items-app{height:100%;max-height:none;max-width:none}</style></head><body>'+itemsViewHTML()+'</body></html>'}

function applyBestSellerFilters(period,daypart,population){
 const view=activeFilters('parkinglot'),selected=parseDashboardPeriod(period);
 if(!isLiveView('parkinglot')&&selected!==null)view.historyDays=selected;
 if(['all','lunch','dinner'].includes(daypart))view.daypart=daypart;
 if(['active','worked','onfloor'].includes(population))view.population=population==='worked'?'active':population;
 if(page==='parkinglot'){applySectionView();render()}else{renderBestSellersWindow();persistDashboardView()}
}

function renderItemsRoot(root,isPopup=false){
 const get=id=>root.querySelector('#'+id),data=bestSellersData(),labels=Object.fromEntries(bestSellerCategories);
 const categoryRows=data.rows.filter(row=>bestSellersView.category==='all'||row.category===bestSellersView.category),analysis=paretoItems(categoryRows);
 get('allItemsTitle').textContent='ALL ITEMS · '+bestSellerPeriodLabel();
 get('itemsCategories').innerHTML=[['all','All Categories'],...bestSellerCategories].map(([key,label])=>`<button type="button" data-item-category="${key}" class="${bestSellersView.category===key?'selected':''}" aria-pressed="${bestSellersView.category===key}">${label}</button>`).join('');
 get('itemsCategories').querySelectorAll('[data-item-category]').forEach(button=>button.onclick=()=>{bestSellersView.category=button.dataset.itemCategory;bestSellersView.tier='all';renderBestSellersWindow()});
 get('allItemsPeriod').innerHTML=bestSellerPeriods.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
 get('allItemsPeriodFilter').hidden=isLiveView();get('allItemsPeriod').disabled=isLiveView();get('allItemsPeriod').title=isLiveView()?'Live shows Today. Select History in FOH to choose another period.':'';get('allItemsPeriod').value=String(days);get('allItemsDaypart').value=selectValue('daypart');syncEmployeesFilter(get('allItemsPopulation'),isLiveView(),selectValue('population'));
 const filters=()=>applyBestSellerFilters(get('allItemsPeriod').value,get('allItemsDaypart').value,get('allItemsPopulation').value);
 for(const id of ['allItemsPeriod','allItemsDaypart','allItemsPopulation'])get(id).onchange=filters;
 const groupCents=rows=>rows.reduce((sum,row)=>sum+row.cents,0),coreCents=groupCents(analysis.core),tailCents=groupCents(analysis.tail);
 get('itemsSummary').innerHTML=`<div class="items-summary-card"><div class="label">TOP ~80% OF REVENUE</div><strong>${itemMoney(coreCents)}</strong><small>${analysis.core.length} items · ${itemPercent(analysis.totalCents?coreCents/analysis.totalCents*100:0)} of selected revenue</small></div><div class="items-summary-card"><div class="label">REMAINING ~20% OF REVENUE</div><strong>${itemMoney(tailCents)}</strong><small>${analysis.tail.length} items · ${itemPercent(analysis.totalCents?tailCents/analysis.totalCents*100:0)} of selected revenue</small></div><div class="items-summary-card"><div class="label">NO SALES</div><strong>${fmt(analysis.zero.length)} items</strong><small>Catalog items with zero units sold</small></div>`;
 get('itemsPareto').innerHTML=paretoChartHTML(analysis);
 get('itemsTier').innerHTML=[['all','All Items'],['core','Top ~80% Rev'],['tail','Remaining ~20% Rev'],['zero','No Sales']].map(([key,label])=>`<button type="button" data-item-tier="${key}" class="${bestSellersView.tier===key?'selected':''}" aria-pressed="${bestSellersView.tier===key}">${label}</button>`).join('');
 get('itemsTier').querySelectorAll('[data-item-tier]').forEach(button=>button.onclick=()=>{bestSellersView.tier=button.dataset.itemTier;renderBestSellersWindow()});
 if(get('allItemsSearch').value!==bestSellersView.query)get('allItemsSearch').value=bestSellersView.query;
 get('allItemsSearch').oninput=()=>{bestSellersView.query=get('allItemsSearch').value;renderBestSellersWindow()};
 const query=bestSellersView.query.trim().toLocaleLowerCase(),rows=analysis.rows.filter(row=>(bestSellersView.tier==='all'||row.group===bestSellersView.tier)&&(!query||row.name.toLocaleLowerCase().includes(query)));
 get('allItemsHead').innerHTML='<tr><th scope="col">Category</th><th scope="col">Item</th><th scope="col">No Sold</th><th scope="col" aria-sort="descending">Rev ▼</th><th scope="col">Rev / Item</th><th scope="col">Pct of<br>Cat Rev</th><th scope="col">Pct of<br>Total Rev</th><th scope="col">Cumul Rev<br>Pct</th><th scope="col">Group</th></tr>';
 get('allItemsBody').innerHTML=rows.length?rows.map(row=>`<tr><td>${escapeHTML(labels[row.category]||row.category)}</td><td>${escapeHTML(row.name)}</td><td>${fmt(row.units)}</td><td>${itemMoney(row.cents)}</td><td>${row.revPerItem==null?'—':itemMoney(row.revPerItem,2)}</td><td>${Math.round(row.categoryShare)}%</td><td>${itemPercent(row.totalShare)}</td><td>${itemPercent(row.cumulativeShare)}</td><td><span class="items-group ${row.group}">${row.group==='core'?'Top 80%':row.group==='tail'?'Remainder':'No sales'}</span></td></tr>`).join(''):'<tr><td colspan="9" class="items-empty">No items match these selections.</td></tr>';
 get('allItemsCount').textContent=rows.length+' of '+categoryRows.length+' items · Ranked by revenue';
 get('itemsOpenWindow').hidden=isPopup;get('itemsOpenWindow').onclick=launchBestSellersPopup;
 get('itemsClose').onclick=()=>{if(isPopup){bestSellersWindow.close();bestSellersWindow=null}else closeBestSellersView()};
 syncFilterDrawer(root,true);
}

function renderBestSellersWindow(){
 const original={page,days,daypart:selectValue('daypart'),population:selectValue('population')};
 try{
  // An expanded FOH view keeps its own context while another area is open.
  if(page!=='parkinglot'){page='parkinglot';applySectionView()}
  const overlay=$('bestSellersOverlay');if(overlay&&!overlay.hidden)renderItemsRoot(overlay);
  if(bestSellersWindow&&!bestSellersWindow.closed){try{renderItemsRoot(bestSellersWindow.document,true)}catch(error){bestSellersWindow=null;const status=overlay&&!overlay.hidden?overlay.querySelector('#itemsStatus'):null;if(status)status.textContent='Separate window unavailable. The expanded view remains available here.'}}
 }finally{page=original.page;days=original.days;$('daypart').value=original.daypart;$('population').value=original.population}
}

function closeBestSellersView(){const overlay=$('bestSellersOverlay');if(overlay)overlay.hidden=true;const button=$('viewAllItems');if(button)button.focus()}

function openBestSellersWindow(){
 let overlay=$('bestSellersOverlay');
 if(!overlay){overlay=document.createElement('div');overlay.id='bestSellersOverlay';overlay.className='items-overlay';overlay.innerHTML=itemsViewHTML();document.body.appendChild(overlay)}
 overlay.hidden=false;renderBestSellersWindow();overlay.querySelector('#itemsClose').focus();
}

function launchBestSellersPopup(){
 const overlay=$('bestSellersOverlay'),status=overlay?overlay.querySelector('#itemsStatus'):null;
 try{
  if(bestSellersWindow&&!bestSellersWindow.closed){renderBestSellersWindow();bestSellersWindow.focus();return}
  const popup=window.open('','jinyaBestSellers','popup,width=1350,height=900,resizable=yes,scrollbars=yes');
  if(!popup)throw new Error('Window unavailable');
  bestSellersWindow=popup;popup.document.open();popup.document.write(bestSellersWindowHTML());popup.document.close();renderBestSellersWindow();popup.focus();if(status)status.textContent='';
 }catch(error){bestSellersWindow=null;if(status)status.textContent='Separate windows are unavailable here. All items and Pareto controls remain available in this expanded view.'}
}

function ensureTrendSelection(domain){
 const config=fohTrendViews[domain];if(config.keys!==null)return;
 const choices=trendEntities(domain);
 if(domain==='food'){
  const eligible=new Set(choices.map(x=>x.key)),totals=new Map();
  for(const c of selectedFOHChecks())for(const item of c.items)if(eligible.has(item.itemId))totals.set(item.itemId,(totals.get(item.itemId)||0)+Math.round(item.price*100));
  config.keys=[...choices].sort((a,b)=>(totals.get(b.key)||0)-(totals.get(a.key)||0)||a.label.localeCompare(b.label)).slice(0,3).map(x=>x.key);
 }else config.keys=choices.slice(0,3).map(x=>x.key);
}

function restoreFOHTrends(saved){
 if(!saved||typeof saved!=='object')return;
 for(const domain of ['mix','employee','section','food']){const from=saved[domain],to=fohTrendViews[domain];if(!from||typeof from!=='object')continue;if(domain==='mix'&&['blended','dayparts'].includes(from.presentation))to.presentation=from.presentation;if(['week','month'].includes(from.grain))to.grain=from.grain;if(fohTrendMetrics[domain].some(m=>m[0]===from.metric))to.metric=from.metric;if(Array.isArray(from.keys))to.keys=[...new Set(from.keys.filter(k=>typeof k==='string'))];if(domain==='food'&&['all',...bestSellerCategories.map(x=>x[0])].includes(from.category))to.category=from.category;if(Array.isArray(from.campaignIds))to.campaignIds=from.campaignIds.filter(id=>typeof id==='string');if(typeof from.showCampaigns==='boolean')to.showCampaigns=from.showCampaigns;if(typeof from.query==='string')to.query=from.query.slice(0,100);if(domain==='employee'&&['all','server','bartender'].includes(from.role))to.role=from.role;if(domain==='section'){if(['all','Inside','Patio'].includes(from.location))to.location=from.location;if(to.keys?.some(k=>k.startsWith('location:')))to.keys=sectionPlanningGroups.filter(g=>g.sectionId).slice(0,3).map(g=>g.key)}}
}

function staffingEfficiencyHTML(){
 const records=selectedFOHChecks().filter(c=>c.employeeRole==='server'),w=dateWindow(),part=selectValue('daypart'),hours=part==='lunch'?[11,12,13,14,15,16]:part==='dinner'?[17,18,19,20,21]:[11,12,13,14,15,16,17,18,19,20,21];
 const dates=windowDays(w.start,w.end),entries=syntheticTimeEntries.filter(e=>inWindow(e.date,w.start,w.end));
 const data=hours.map(hour=>{const start=hour*60,end=start+60,roleHours=Object.fromEntries(['server','expo','bartender','host'].map(role=>[role,0]));for(const e of entries)roleHours[e.role]+=intervalOverlap(start,end,e.start,e.end)/60;const guests=records.filter(c=>c.arrivalMinute>=start&&c.arrivalMinute<end).reduce((sum,c)=>sum+c.guests,0);return {hour,guests,...roleHours,ratio:roleHours.server?guests/roleHours.server:null}});
 const hourLabel=h=>(h%12||12)+(h<12?' AM':' PM');
 return `<article class="card"><div class="head"><h2>Staffing Efficiency by Hour</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><div class="server-scroll"><table class="table staffing-table"><thead><tr><th>Hour</th><th>Arriving Guests / Day</th><th>Server Hours / Day</th><th>Guests / Server Hour</th><th>Expo Hours / Day</th><th>Bar Hours / Day</th><th>Host Hours / Day</th></tr></thead><tbody>${data.map(r=>`<tr><td>${hourLabel(r.hour)}</td><td>${(r.guests/dates).toFixed(1)}</td><td>${(r.server/dates).toFixed(1)}</td><td>${r.ratio===null?'\u2014':r.ratio.toFixed(1)}</td><td>${(r.expo/dates).toFixed(1)}</td><td>${(r.bartender/dates).toFixed(1)}</td><td>${(r.host/dates).toFixed(1)}</td></tr>`).join('')}</tbody></table></div><p class="foot">Separate simulated clock-in/out records include idle coverage. Guest arrivals and clock hours are summed over the report period, then divided by calendar days; the productivity ratio uses total guests / total server hours. These are demonstration schedules, not calibrated staffing recommendations. Actual Aloha time punches and JQC's pro forma remain pending.</p></article>`;
}

function refreshOperationsViews(message='Saved in this browser.'){
 if(page==='parkinglot'&&!isLiveView()){renderFOHTrends();renderRankings();renderOperations();const feedback=$('operationsFeedback');if(feedback)feedback.textContent=message}
}

function baseCampaignManagerHTML(){
 return `<section class="section full"><article class="card"><div class="head"><h2>Promotions &amp; Seating Records</h2></div><p class="hint">Prototype records save in this browser. Export a backup to move them. Sales charts still use synthetic demo sales; these entries do not establish actual marketing results.</p>${operationalWarning?`<p role="alert">${escapeHTML(operationalWarning)}</p>`:''}<details id="campaignEditor"><summary>Campaign calendar</summary><p class="hint">Mark marketing campaigns even without an Aloha discount. Dates and hours use Queen Creek time; recurring hours end on the same day. Split overnight activity into separate entries.</p><input id="campaignId" type="hidden"><div class="operations-grid"><label>Campaign name<input id="campaignName" maxlength="120"></label><label>Start date<input id="campaignStart" type="date" value="${DEMO_TODAY}"></label><label>End date<input id="campaignEnd" type="date" value="${DEMO_TODAY}"></label><label>From<input id="campaignFrom" type="time" value="11:00"></label><label>To<input id="campaignTo" type="time" value="22:00"></label><label>Days<select id="campaignDays"><option value="0,1,2,3,4,5,6">Every day</option><option value="1,2,3,4,5">Monday–Friday</option><option value="0,6">Saturday–Sunday</option>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((name,i)=>`<option value="${i}">${name}</option>`).join('')}${[...new Set(operationalData.campaigns.map(c=>c.weekdays.join(',')))].filter(days=>!['0,1,2,3,4,5,6','1,2,3,4,5','0,6','0','1','2','3','4','5','6'].includes(days)).map(days=>`<option value="${days}">${days.split(',').map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][Number(d)]).join(', ')}</option>`).join('')}</select></label><label>Target category<select id="campaignCategory"><option value="all">All Categories</option>${salesMixTargetCategories.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label><label>Channel<input id="campaignChannel" maxlength="2000" placeholder="Social, email, in-store…"></label><label>Spend, optional ($)<input id="campaignSpend" type="number" min="0" step="0.01"></label><label>Aloha promotion IDs, optional<input id="campaignAloha" maxlength="2000"></label><label class="wide">Objective / notes<textarea id="campaignNotes" maxlength="2000"></textarea></label></div><div class="trend-picker-actions"><button id="campaignSave" type="button">Save campaign</button><button id="campaignNew" type="button">New campaign</button></div><div class="server-scroll"><table class="table"><thead><tr><th>Campaign</th><th>Dates / hours</th><th>Channel</th><th>Actions</th></tr></thead><tbody>${operationalData.campaigns.map(c=>`<tr><td>${escapeHTML(c.name)}${c.archived?' (archived)':''}</td><td>${c.start} to ${c.end}<br>${c.from}–${c.to}</td><td>${escapeHTML(c.channel)}</td><td><button type="button" data-campaign-edit="${escapeHTML(c.id)}">Edit</button> <button type="button" data-campaign-archive="${escapeHTML(c.id)}">${c.archived?'Restore':'Archive'}</button></td></tr>`).join('')||'<tr><td colspan="4">No campaigns entered.</td></tr>'}</tbody></table></div><p class="hint">Shaded bands show campaign date spans. Inspect the campaign legend for active days/hours. Overlap is context, not proof of attribution.</p>${campaignComparisonHTML()}</details><details><summary>Seating availability and occupied intervals</summary><p class="hint">Record only observed intervals. “In service” defines usable configuration time; add Occupied and Unavailable intervals separately. For 301+302, enter both IDs together. Unrecorded time is unknown. Do not mark unused flex positions in service unless they can seat an independent party.</p><div class="operations-grid"><label>Date<input id="seatDate" type="date" value="${DEMO_TODAY}"></label><label>From<input id="seatFrom" type="time" value="17:00"></label><label>To<input id="seatTo" type="time" value="22:00"></label><label>Table / seat IDs<input id="seatTables" placeholder="301, 302"></label><label>State<select id="seatState"><option value="available">In service</option><option value="occupied">Occupied</option><option value="empty">Ready / empty (observed)</option><option value="unavailable">Unavailable</option></select></label><label>Note / reason<input id="seatNote" maxlength="2000"></label></div><button type="button" id="seatSave">Save interval</button><p class="hint">These are manual records, separate from synthetic checks. Capacity by individual guest seat and waitlist-compatible demand require additional source verification.</p></details><details><summary>Seating offers</summary><p class="hint">Record an offer and its accepted/declined outcome. No guest survey is involved. Missing offers are unknown; recorded outcomes are not a complete restaurant refusal rate.</p><div class="operations-grid"><label>Date<input id="offerDate" type="date" value="${DEMO_TODAY}"></label><label>Time<input id="offerTime" type="time" value="17:00"></label><label>Offered section<select id="offerSection">${fohSections.map(s=>`<option value="${s.id}">${s.location} / ${s.name}</option>`).join('')}</select></label><label>Party size<input id="offerGuests" type="number" min="1" max="126" value="2"></label><label>Outcome<select id="offerOutcome"><option value="accepted">Accepted</option><option value="declined">Declined</option></select></label><label>Optional reason<input id="offerNote" maxlength="2000"></label></div><button type="button" id="offerSave">Save offer</button></details><details><summary>Recorded seating entries</summary><div class="server-scroll"><table class="table"><thead><tr><th>Record</th><th>When / where</th><th>Note</th><th>Action</th></tr></thead><tbody>${['seating','offers'].flatMap(kind=>operationalData[kind].map(r=>`<tr><td>${kind==='seating'?r.state:r.outcome}${r.archived?' (archived)':''}</td><td>${r.date} ${kind==='seating'?r.from+'–'+r.to+' / '+r.tables.join('+'):r.time+' / '+r.section}</td><td>${escapeHTML(r.note)}</td><td><button type="button" data-operational-archive="${kind}:${escapeHTML(r.id)}">${r.archived?'Restore':'Archive'}</button></td></tr>`)).join('')||'<tr><td colspan="4">No seating records.</td></tr>'}</tbody></table></div></details><details><summary>Alcohol goal and backup</summary><div class="operations-grid"><label>Server alcohol sales mix goal (%)<input type="number" id="alcoholGoal" min="0" max="100" step="0.1" value="${operationalData.alcoholGoal}"></label></div><button type="button" id="goalSave">Save goal</button><p class="hint">This server goal defaults to 25%. Restaurant Sales Mix trend targets come from Admin and can differ by shift. Target lines show current reference settings, not a recovered history of past goals.</p><p><a id="operationsExport" download="JINYA_Operational_Backup.json" href="data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(operationalData,null,2))}">Export operational backup</a></p><label>Import backup JSON<textarea id="operationsImport" aria-label="Operational backup JSON"></textarea></label><p class="hint">Import merges records by ID and updates matching IDs; other records remain. Export before importing another device's edits. This is a manual transfer, not shared storage.</p><button type="button" id="operationsImportButton">Import backup</button></details><p id="operationsFeedback" role="status" aria-live="polite"></p></article></section>`;
}

function renderOperations(){
 const host=$('operationsHost');if(!host)return;host.innerHTML=campaignManagerHTML();
 $('campaignSave').onclick=()=>{
  const original=operationalData.campaigns.find(c=>c.id===$('campaignId').value),now=new Date().toISOString();
  const record={id:original?.id||operationalId(),name:$('campaignName').value.trim(),start:$('campaignStart').value,end:$('campaignEnd').value,from:$('campaignFrom').value,to:$('campaignTo').value,weekdays:$('campaignDays').value.split(',').map(Number),category:$('campaignCategory').value,channel:$('campaignChannel').value.trim(),spend:$('campaignSpend').value.trim()===''?null:Number($('campaignSpend').value),alohaIds:$('campaignAloha').value.trim(),notes:$('campaignNotes').value.trim(),archived:original?.archived||false,createdAt:original?.createdAt||now,updatedAt:now};
  const next={...operationalData,campaigns:operationalData.campaigns.filter(c=>c.id!==record.id).concat(record)};if(saveOperationalData(next))refreshOperationsViews();
 };
 $('campaignNew').onclick=()=>{renderOperations();$('campaignEditor').open=true};
 for(const button of host.querySelectorAll('[data-campaign-edit]'))button.onclick=()=>{const c=operationalData.campaigns.find(c=>c.id===button.dataset.campaignEdit);$('campaignEditor').open=true;for(const [id,key] of [['campaignId','id'],['campaignName','name'],['campaignStart','start'],['campaignEnd','end'],['campaignFrom','from'],['campaignTo','to'],['campaignCategory','category'],['campaignChannel','channel'],['campaignAloha','alohaIds'],['campaignNotes','notes']])$(id).value=c[key];$('campaignDays').value=c.weekdays.join(',');$('campaignSpend').value=c.spend===null?'':c.spend;};
 for(const button of host.querySelectorAll('[data-campaign-archive]'))button.onclick=()=>{const next={...operationalData,campaigns:operationalData.campaigns.map(c=>c.id===button.dataset.campaignArchive?{...c,archived:!c.archived,updatedAt:new Date().toISOString()}:c)};if(saveOperationalData(next))refreshOperationsViews()};
 for(const button of host.querySelectorAll('[data-operational-archive]'))button.onclick=()=>{const [kind,id]=button.dataset.operationalArchive.split(':');const next={...operationalData,[kind]:operationalData[kind].map(r=>r.id===id?{...r,archived:!r.archived}:r)};if(saveOperationalData(next))refreshOperationsViews()};
 $('seatSave').onclick=()=>{const tables=$('seatTables').value.split(/[,\s+]+/).filter(Boolean).map(Number),record={id:operationalId(),date:$('seatDate').value,from:$('seatFrom').value,to:$('seatTo').value,tables:[...new Set(tables)],state:$('seatState').value,note:$('seatNote').value.trim(),createdAt:new Date().toISOString()};if(saveOperationalData({...operationalData,seating:[...operationalData.seating,record]}))refreshOperationsViews()};
 $('offerSave').onclick=()=>{const record={id:operationalId(),date:$('offerDate').value,time:$('offerTime').value,section:$('offerSection').value,guests:Number($('offerGuests').value),outcome:$('offerOutcome').value,note:$('offerNote').value.trim(),createdAt:new Date().toISOString()};if(saveOperationalData({...operationalData,offers:[...operationalData.offers,record]}))refreshOperationsViews()};
 $('goalSave').onclick=async()=>{if($('alcoholGoal').value.trim()===''){$('operationsFeedback').textContent='Enter a goal from 0 to 100.';return}await saveAdminFileAction(()=>{if(!saveOperationalData({...operationalData,alcoholGoal:Number($('alcoholGoal').value)}))return false;refreshOperationsViews();return true},'operationsFeedback',$('goalSave'))};
 $('operationsImportButton').onclick=()=>{try{const input=validateOperationalData(JSON.parse($('operationsImport').value));const next={...input};for(const k of ['campaigns','seating','offers'])next[k]=[...new Map([...operationalData[k],...input[k]].map(r=>[r.id,r])).values()];const warning=operationalWarning;operationalWarning='';if(saveOperationalData(next))refreshOperationsViews('Imported and merged backup.');else operationalWarning=warning}catch(e){$('operationsFeedback').textContent='Import failed: '+e.message}};
}

function campaignComparisonHTML(){
 const campaigns=operationalData.campaigns.filter(c=>!c.archived);if(!campaigns.length)return '';
 const summaries=campaigns.map(c=>{
  const length=windowDays(c.start,c.end);if(length>730)return `<p>${escapeHTML(c.name)}: use a campaign window of two years or less for comparisons.</p>`;
  const matches=(date,from,to)=>date>=from&&date<=to&&c.weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay());
  const span=shiftDate(c.start,-7*Math.ceil(length/7));
  const windows=[['Before',span,shiftDate(span,length-1)],['During',c.start,c.end],['After',shiftDate(c.start,7*Math.ceil(length/7)),shiftDate(c.start,7*Math.ceil(length/7)+length-1)]];
  return `<h4>${escapeHTML(c.name)}</h4><p class="hint">Same weekday pattern and campaign hours. Synthetic checks arriving in campaign hours; not redemption attribution or ROI. During dates beyond the demo data and unfinished windows are marked partial.</p><div class="server-scroll"><table class="table"><thead><tr><th>Window</th><th>Checks / Guests</th><th>Alcohol mix</th><th>Alcohol / Guest</th><th>Alcohol checks</th><th>Alcohol Rev / Day</th></tr></thead><tbody>${windows.map(([label,start,end])=>{const cs=checks.filter(check=>matches(check.date,start,end)&&check.arrivalMinute>=timeMinute(c.from)&&check.arrivalMinute<timeMinute(c.to)),guests=cs.reduce((n,c)=>n+c.guests,0),gross=cs.reduce((n,c)=>n+c.items.reduce((a,i)=>a+i.price,0),0),alcohol=cs.reduce((n,c)=>n+c.items.filter(i=>i.category==='alcohol').reduce((a,i)=>a+i.price,0),0),attachment=cs.filter(c=>c.items.some(i=>i.category==='alcohol')).length;let days=0;for(let date=start;date<=end;date=shiftDate(date,1))if(date>=DEMO_START&&date<=DEMO_TODAY&&matches(date,start,end))days++;return `<tr><td>${label}${end>DEMO_TODAY||start<DEMO_START?' (partial)':''}<br>${start} to ${end}</td><td>${cs.length} / ${guests}</td><td>${gross?(alcohol/gross*100).toFixed(1)+'%':'—'}</td><td>${guests?cash(alcohol/guests):'—'}</td><td>${cs.length?(attachment/cs.length*100).toFixed(1)+'%':'—'}</td><td>${days?cash(alcohol/days):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
 });return '<h3>Alcohol campaign context</h3>'+summaries.join('');
}

function seatingPositionMetrics(table){
 const w=dateWindow(),part=selectValue('daypart'),lo=part==='dinner'?1020:660,hi=part==='lunch'?1020:1320;
 const rows=operationalData.seating.filter(r=>!r.archived&&r.tables.includes(table)&&inWindow(r.date,w.start,w.end));
 const spans=state=>mergeIntervals(rows.filter(r=>r.state===state).map(r=>{const base=Date.parse(r.date+'T00:00:00Z')/60000;return [base+Math.max(lo,timeMinute(r.from)),base+Math.min(hi,timeMinute(r.to))]}));
 const available=subtractIntervals(spans('available'),spans('unavailable')),occupied=intersectIntervals(available,spans('occupied')),empty=subtractIntervals(intersectIntervals(available,spans('empty')),occupied),covered=mergeIntervals([...occupied,...empty]);
 const availableMinutes=intervalMinutes(available),occupiedMinutes=intervalMinutes(occupied),emptyMinutes=intervalMinutes(empty),coverage=availableMinutes?intervalMinutes(covered)/availableMinutes:null;
 return {table,availableMinutes,occupiedMinutes,emptyMinutes,coverage,utilization:availableMinutes&&coverage>=.999999?occupiedMinutes/availableMinutes*100:null,occupied,empty};
}

function baseSeatingInsightsHTML(){
 const rows=[...fohSeatingIndex.keys()].map(seatingPositionMetrics),recorded=rows.filter(r=>r.availableMinutes>0),positions=recorded.map(r=>{
 const section=fohSeatingIndex.get(r.table),peers=recorded.filter(other=>other.table!==r.table&&fohSeatingIndex.get(other.table).unit===section.unit),peerOccupied=mergeIntervals(peers.flatMap(other=>other.occupied));
 return {...r,busyIdle:intervalMinutes(intersectIntervals(r.empty,peerOccupied)),section};
 });
 const w=dateWindow(),part=selectValue('daypart'),offers=operationalData.offers.filter(o=>!o.archived&&inWindow(o.date,w.start,w.end)&&(part==='all'||(timeMinute(o.time)>= (part==='lunch'?660:1020)&&timeMinute(o.time)<(part==='lunch'?1020:1320))));
 return `<section class="section full"><article class="card"><div class="head"><h2>Seating Use &amp; Preferences</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><p class="seating-purpose"><strong>Find seating that is being overlooked.</strong> Compare how often tables are occupied, when they sit empty while other tables are busy and which seating offers guests decline. This is the analysis for questions such as “Are guests avoiding Flex?”</p><p class="hint">${recorded.length} of 60 permanent positions have recorded availability in this period. Missing time and positions remain unknown. These are manual records, separate from synthetic sales.</p>${recorded.length?`<div class="server-scroll"><table class="table"><thead><tr><th>Position</th><th>Section</th><th>In service min</th><th>Observed coverage</th><th>Occupied time</th><th>Known empty min</th><th>Empty while others busy min*</th><th>Never occupied**</th></tr></thead><tbody>${positions.map(r=>`<tr><td>${r.table}</td><td>${r.section.location} / ${r.section.name}</td><td>${Math.round(r.availableMinutes)}</td><td>${Math.round(r.coverage*100)}%</td><td>${r.utilization===null?'Unknown':Math.round(r.utilization)+'%'}</td><td>${Math.round(r.emptyMinutes)}</td><td>${Math.round(r.busyIdle)}</td><td>${r.utilization===null?'Unknown':r.occupiedMinutes===0?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="seating-empty"><strong>No seating-use data yet.</strong><p>This section cannot identify underused tables until seating records are available. The prototype accepts observed in-service, occupied and empty intervals under Promotions &amp; Records below. Automatic Aloha seating history remains unverified.</p></div>'}<p class="foot">* Other recorded positions of the same table/seat type. This is a demand indicator; party fit, host assignment and guest preference are unverified. ** Applies only to entered in-service intervals with complete occupied/empty observation. Unavailable time is excluded. Joined positions each count once in time totals; these are not party counts or guest-seat capacity.</p><h3>Recorded seating offers</h3>${offers.length?`<div class="server-scroll"><table class="table"><thead><tr><th>Section</th><th>Offers recorded</th><th>Accepted</th><th>Declined</th><th>Recorded decline rate</th></tr></thead><tbody>${fohSections.map(s=>{const os=offers.filter(o=>o.section===s.id),declined=os.filter(o=>o.outcome==='declined').length;return os.length?`<tr><td>${s.location} / ${s.name}</td><td>${os.length}</td><td>${os.length-declined}</td><td>${declined}</td><td>${Math.round(declined/os.length*100)}%</td></tr>`:''}).join('')}</tbody></table></div>`:'<p class="hint">No seating offers recorded for these filters.</p>'}<p class="foot">Rates describe recorded offers only. Capture coverage is unknown; an empty Flex area does not prove guests declined it.</p></article></section>`;
}

function trendEntities(domain){
 const config=fohTrendViews[domain];
 if(domain==='mix')return salesMixTargetCategories.map(([key,label])=>({key,label}));
 if(domain==='employee'){
  const allowed=new Set(currentRows().map(row=>row.server));
  return serviceEmployees.filter(p=>allowed.has(p.name)&&(config.role==='all'||p.role===config.role)).map(p=>({key:p.name,label:p.name+' ('+(p.role==='bartender'?'B':'S')+')'}));
 }
 if(domain==='section')return sectionPlanningGroups.filter(g=>g.sectionId&&(config.location==='all'||fohSections.find(s=>s.id===g.sectionId).location===config.location)).map(g=>({key:g.key,label:g.label}));
 return menuCatalog.filter(item=>config.category==='all'||item.category===config.category).map(item=>({key:item.id,label:item.name}));
}

function persistentMixData(){
 const config=fohTrendViews.mix,buckets=persistentMixBuckets(dateWindow(),config.grain),records=selectedFOHChecks();
 const groups={};for(const part of ['all','lunch','dinner'])groups[part]=buckets.map(()=>({total:0,checks:0,categories:{}}));
 for(const check of records){const i=buckets.findIndex(b=>check.date>=b.start&&check.date<=b.end);if(i<0)continue;for(const part of ['all',check.daypart]){const bucket=groups[part]?.[i];if(!bucket)continue;bucket.checks++;for(const item of check.items){const cents=Math.round(item.price*100);bucket.total+=cents;bucket.categories[item.category]=(bucket.categories[item.category]||0)+cents}}}
 return {buckets,records,rows:salesMixTargetCategories.map(([key,label])=>({key,label,parts:Object.fromEntries(['all','lunch','dinner'].map(part=>[part,groups[part].map(b=>({value:b.total?(b.categories[key]||0)/b.total*100:null,checks:b.checks}))]))}))};
}

function persistentMixPlot(row,part,buckets,range,availableWidth){
 const points=row.parts[part],valid=points.some(p=>p.value!==null),caption=part==='all'?'Blended':part==='lunch'?'Lunch':'Dinner';
 const minWidth=Math.max(280,buckets.length*58+52),width=Math.max(minWidth,availableWidth),height=180,left=28,right=28,top=25,bottom=43,plotW=width-left-right,plotH=height-top-bottom;
 const x=i=>buckets.length===1?left+plotW/2:left+i*plotW/(buckets.length-1),y=v=>top+plotH-(v-range.min)/(range.max-range.min)*plotH;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${row.label}, ${caption}, sales mix by ${fohTrendViews.mix.grain}" data-mix-chart="${row.key}" data-daypart="${part}" data-axis-min="${range.min}" data-axis-max="${range.max}" style="min-width:${minWidth}px">`;
 for(let i=0;i<3;i++)svg+=`<line x1="${left}" x2="${width-right}" y1="${top+i*plotH/2}" y2="${top+i*plotH/2}" stroke="#e3e8ed"/>`;
 const bands=fohTrendViews.mix.showCampaigns===false?[]:campaignBands(buckets).filter(({campaign:c})=>(c.category==='all'||c.category===row.key));
 const dateX=date=>{const t=Date.parse(date+'T00:00:00Z');if(buckets.length===1){const b=buckets[0];return left+Math.max(0,Math.min(1,(t-Date.parse(b.start+'T00:00:00Z'))/(Date.parse(shiftDate(b.end,1)+'T00:00:00Z')-Date.parse(b.start+'T00:00:00Z'))))*plotW}const index=buckets.findIndex(b=>date<=b.end);if(index<0)return width-right;if(date<buckets[0].start)return left;const b=buckets[index],fraction=(t-Date.parse(b.start+'T00:00:00Z'))/(Date.parse(shiftDate(b.end,1)+'T00:00:00Z')-Date.parse(b.start+'T00:00:00Z'));return Math.max(left,Math.min(width-right,left+(index-.5+fraction)*plotW/(buckets.length-1)))};
 for(const {campaign:c}of bands){const xx=dateX(c.start),end=dateX(shiftDate(c.end,1));svg+=`<rect x="${xx}" y="${top}" width="${Math.max(2,end-xx)}" height="${plotH}" fill="#dca132" opacity=".12"><title>${escapeHTML(c.name)}: ${c.start} to ${c.end}, ${c.from}–${c.to}; ${c.weekdays.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</title></rect>`}
 let segment=[];const flush=()=>{if(segment.length>1)svg+=`<polyline points="${segment.join(' ')}" fill="none" stroke="var(--group-color,#435e80)" stroke-width="2.5"/>`;segment=[]};
 points.forEach((p,i)=>{if(p.value===null){flush();return}segment.push(x(i)+','+y(p.value))});flush();
 points.forEach((p,i)=>{if(p.value!==null)svg+=`<circle cx="${x(i)}" cy="${y(p.value)}" r="3" fill="var(--group-color,#435e80)"><title>${row.label}, ${caption}: ${p.value.toFixed(1)}%; ${buckets[i].start} to ${buckets[i].end}; ${p.checks} checks</title></circle><text x="${x(i)}" y="${y(p.value)-9}" text-anchor="middle" font-size="10" font-weight="650" fill="var(--group-text,#435e80)" stroke="#fff" stroke-width="3" paint-order="stroke">${Math.round(p.value)}%</text>`});
 buckets.forEach((b,i)=>{svg+=`<text x="${x(i)}" y="${height-23}" text-anchor="middle" font-size="10" fill="#354655">${b.label}${b.partial?'*':''}</text><text x="${x(i)}" y="${height-8}" text-anchor="middle" font-size="9" fill="#7a8792">${b.year}</text>`});
 if(!valid)svg+=`<text x="${width/2}" y="${top+plotH/2}" text-anchor="middle" fill="#7a8792" font-size="12">No sales for this period</text>`;
 return `<div class="mix-trend-plot" tabindex="0" role="region" aria-label="${row.label} ${caption} trend; scroll for all periods">${svg}</svg></div>`;
}

function persistentMixPanelHTML(){
 const config=fohTrendViews.mix,data=persistentMixData(),daypart=selectValue('daypart'),eligible=daypart==='all',paired=eligible&&config.presentation==='dayparts',parts=paired?['lunch','dinner']:['all'];
 const reference=referenceSalesMixTargets(data.records),format=value=>Number.isFinite(value)?targetPercent(value):'—';
 const available=Math.max(280,(($('trendHost-mix')?.clientWidth||850)-180-(paired?18:0))/(paired?2:1));
 const rows=data.rows.map(row=>{const values=parts.flatMap(part=>row.parts[part].map(p=>p.value)).filter(v=>v!==null),low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1,pad=Math.max(.2,(high-low)*.15),range={min:Math.max(0,low-pad),max:Math.min(100,high+pad)};if(range.max<=range.min)range.max=range.min+.1;
 const target=paired?`<span>Lunch Target: ${format(salesMixTargets.lunch[row.key])}</span><span>Dinner Target: ${format(salesMixTargets.dinner[row.key])}</span>`:`<span>Target: ${format(reference.targets?.[row.key])}</span>`;
 return `<div class="mix-persistent-row" data-mix-row="${row.key}"><div class="mix-persistent-label"><strong>${row.label}</strong>${target}</div><div class="mix-persistent-charts ${paired?'paired':''}">${parts.map(part=>`<div class="mix-persistent-cell">${paired?`<h4>${part==='lunch'?'LUNCH':'DINNER'}</h4>`:''}${persistentMixPlot(row,part,data.buckets,range,available)}</div>`).join('')}</div></div>`}).join('');
 return `<section class="section full foh-trend-section" id="mixTrendsSection"><article class="card"><div class="head"><h2 id="mixTrendTitle">Sales Mix Trends</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><div class="trend-toolbar">${eligible?`<div class="mode-switch" role="group" aria-label="Sales Mix Trends view"><button type="button" data-mix-trend-view="blended" class="${!paired?'selected':''}" aria-pressed="${!paired}">Blended</button><button type="button" data-mix-trend-view="dayparts" class="${paired?'selected':''}" aria-pressed="${paired}">Lunch v. Dinner</button></div>`:''}<div class="mode-switch" role="group" aria-label="Sales Mix Trends grouping">${['week','month'].map(grain=>`<button type="button" id="trend-mix-${grain}" class="${config.grain===grain?'selected':''}" aria-pressed="${config.grain===grain}">${grain==='week'?'Week':'Month'}</button>`).join('')}</div><label class="campaign-visibility"><input type="checkbox" id="trend-mix-campaigns" ${config.showCampaigns!==false?'checked':''}> Show campaigns</label></div>${rows}<p class="foot">${data.buckets.some(b=>b.partial)?'* Partial period. ':''}${config.grain==='week'?'Weeks run Monday to Sunday. ':''}Gaps mean no sales. Each category has its own scale${paired?'; Lunch and Dinner share that category’s scale':''}. Targets reflect current Admin settings${!paired&&eligible?', blended by selected-period sales':''}.</p></article></section>`;
}

function renderPersistentMixTrend(){
 const host=$('trendHost-mix');host.innerHTML=externalSubsectionHeadings(persistentMixPanelHTML());const config=fohTrendViews.mix;
 for(const button of host.querySelectorAll('[data-mix-trend-view]'))button.onclick=()=>{config.presentation=button.dataset.mixTrendView;renderPersistentMixTrend();persistDashboardView()};
 for(const grain of ['week','month'])$('trend-mix-'+grain).onclick=()=>{config.grain=grain;renderPersistentMixTrend();persistDashboardView()};
 const campaigns=$('trend-mix-campaigns');campaigns.checked=config.showCampaigns!==false;campaigns.onchange=()=>{config.showCampaigns=campaigns.checked;renderPersistentMixTrend();persistDashboardView()};
}


function trendSeriesData(domain,records=selectedFOHChecks(),window=dateWindow()){
 ensureTrendSelection(domain);
 const config=fohTrendViews[domain],choices=domain==='food'?menuCatalog.map(item=>({key:item.id,label:item.name})):trendEntities(domain),allowed=new Set(choices.map(x=>x.key)),keys=config.keys.filter(k=>allowed.has(k));
 const buckets=trendBuckets(window,config.grain),dateIndex=new Map();buckets.forEach((b,i)=>{for(let d=b.start;d<=b.end;d=shiftDate(d,1))dateIndex.set(d,i)});
 const empty=()=>({cents:0,alcohol:0,apps:0,dessert:0,appUnits:0,dessertUnits:0,alcoholChecks:0,guests:0,checks:0,units:0,categories:{}});
 const aggregates=new Map(keys.map(k=>[k,buckets.map(empty)])),base=buckets.map(empty),selected=new Set(keys);
 for(const c of records){
  const i=dateIndex.get(c.date);if(i===undefined)continue;
  const gross=c.items.reduce((s,item)=>s+Math.round(item.price*100),0),cat={};for(const item of c.items)cat[item.category]=(cat[item.category]||0)+Math.round(item.price*100);
  const b=base[i];b.guests+=c.guests;b.checks++;b.cents+=gross;for(const [k,v] of Object.entries(cat))b.categories[k]=(b.categories[k]||0)+v;
  if(domain==='food'){
   const touched=new Set();for(const item of c.items)if(selected.has(item.itemId)){const a=aggregates.get(item.itemId)[i];a.cents+=Math.round(item.price*100);a.units++;touched.add(item.itemId)}
   for(const k of touched)aggregates.get(k)[i].checks++;
  }else if(domain==='mix'){
   for(const k of keys){const a=aggregates.get(k)[i];a.cents+=cat[k]||0;a.guests+=c.guests;a.checks++}
  }else{
   const matches=domain==='employee'?(selected.has(c.server)?[c.server]:[]):keys.filter(k=>sectionMatchesGroup(c,sectionPlanningGroups.find(g=>g.key===k)));
   for(const k of matches){const a=aggregates.get(k)[i];a.cents+=gross;a.alcohol+=cat.alcohol||0;a.apps+=cat.apps||0;a.dessert+=cat.dessert||0;a.appUnits+=c.items.filter(x=>x.category==='apps').length;a.dessertUnits+=c.items.filter(x=>x.category==='dessert').length;a.alcoholChecks+=c.items.some(x=>x.category==='alcohol')?1:0;a.guests+=c.guests;a.checks++}
  }
 }
 function value(a,i,key){
  if(domain==='mix')return base[i].cents?a.cents/base[i].cents*100:null;
  if(domain==='food'){
   if(config.metric==='units')return a.units;if(config.metric==='revenue')return a.cents/100;
   if(config.metric==='totalShare')return base[i].cents?a.cents/base[i].cents*100:null;
   if(config.metric==='categoryShare'){const category=menuCatalog.find(item=>item.id===key).category,denom=base[i].categories[category]||0;return denom?a.cents/denom*100:null}
   return base[i].checks?a.checks/base[i].checks*100:null;
  }
  if(config.metric==='revenue')return a.cents/100;if(config.metric==='guests')return a.guests;if(config.metric==='checks')return a.checks;
  if(config.metric==='alcoholMix')return a.cents?a.alcohol/a.cents*100:null;
  if(config.metric==='alcoholAttachment')return a.checks?a.alcoholChecks/a.checks*100:null;
  const numerator=config.metric==='alcoholPerGuest'?a.alcohol/100:config.metric==='smallPerGuest'?a.apps/100:config.metric==='dessertPerGuest'?a.dessert/100:config.metric==='smallUnitsPerGuest'?a.appUnits:config.metric==='dessertUnitsPerGuest'?a.dessertUnits:config.metric==='upsellPerGuest'?(a.appUnits+a.dessertUnits):a.cents/100;
  return a.guests?numerator/a.guests:null;
 }
 return {buckets,series:keys.map((key,i)=>({key,label:choices.find(x=>x.key===key).label,color:fohTrendColors[i%fohTrendColors.length],dash:i>=6?'7 4':'',points:aggregates.get(key).map((a,j)=>({value:value(a,j,key),checks:a.checks,guests:domain==='food'?base[j].guests:a.guests}))}))};
}

function baseTrendPanelHTML(domain){
 if(domain==='mix')return persistentMixPanelHTML();
 ensureTrendSelection(domain);
 const config=fohTrendViews[domain],choices=trendEntities(domain),selected=new Set(config.keys),title={mix:'Sales Mix Trends',food:'Food Trends',employee:'Server Trends',section:'Section Trends'}[domain];
 const noun={mix:'categories',food:'items',employee:'servers',section:'sections'}[domain],find={mix:'Find a category',food:'Find an item',employee:'Find a server',section:'Find a section'}[domain];
 const scopes=domain==='employee'?[['all','All Roles'],['server','Server'],['bartender','Bar']]:domain==='section'?[['all','All Sections'],['Inside','Inside'],['Patio','Outside']]:[];
 const toggle=scopes.length?`<div class="mode-switch" role="group" aria-label="${title} scope">${scopes.map(([key,label])=>`<button type="button" data-trend-scope="${key}" class="${(domain==='employee'?config.role:config.location)===key?'selected':''}" aria-pressed="${(domain==='employee'?config.role:config.location)===key}">${label}</button>`).join('')}</div>`:'';
 return `<section class="section full foh-trend-section" id="${domain}TrendsSection"><article class="card"><div class="head"><h2 id="${domain}TrendTitle">${title}</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><p class="hint">${domain==='employee'?'Employees filter applies. All Roles includes Server and Bar.':domain==='mix'?'Share of gross item sales across all employees.':domain==='food'?'Menu sales across all employees.':'All employees. Outside corresponds to Patio.'}</p><div class="trend-toolbar">${toggle}<div class="mode-switch" role="group" aria-label="${title} grouping"><button type="button" id="trend-${domain}-week" aria-pressed="${config.grain==='week'}" class="${config.grain==='week'?'selected':''}">Week</button><button type="button" id="trend-${domain}-month" aria-pressed="${config.grain==='month'}" class="${config.grain==='month'?'selected':''}">Month</button></div>${domain==='mix'?'':`<label>Measure<select id="trend-${domain}-metric" aria-label="${title} measure">${fohTrendMetrics[domain].map(m=>`<option value="${m[0]}" ${config.metric===m[0]?'selected':''}>${m[1]}</option>`).join('')}</select></label>`}<label class="campaign-visibility"><input type="checkbox" id="trend-${domain}-campaigns" ${config.showCampaigns!==false?'checked':''}> Show campaigns</label></div>${operationalData.campaigns.some(c=>!c.archived)?`<details class="trend-campaign-picker"><summary>Select campaigns</summary>${operationalData.campaigns.filter(c=>!c.archived).map(c=>`<label><input type="checkbox" data-trend-campaign="${escapeHTML(c.id)}" ${!Array.isArray(config.campaignIds)||config.campaignIds.includes(c.id)?'checked':''}>${escapeHTML(c.name)}</label>`).join('')}</details>`:''}<div class="trend-picker trend-compare-picker"><div class="trend-picker-heading"><h3>Compare ${noun}</h3><span>${config.keys.filter(key=>domain==='food'?menuCatalog.some(item=>item.id===key):choices.some(item=>item.key===key)).length} selected</span></div><div class="trend-picker-tools">${domain==='food'?`<label>Select category<select id="trend-food-category" aria-label="Select category"><option value="all">All Categories</option>${bestSellerCategories.map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select></label>`:''}<label>${find}<input id="trend-${domain}-search" type="search" placeholder="Search ${noun}" aria-label="${find}"></label><div class="trend-picker-actions"><button type="button" id="trend-${domain}-all">Add all</button><button type="button" id="trend-${domain}-clear">Clear</button></div></div><div class="trend-choices trend-item-choices" id="trend-${domain}-choices">${choices.map(c=>`<label data-trend-choice="${domain}"><input type="checkbox" data-trend-entity="${domain}" value="${escapeHTML(c.key)}" ${selected.has(c.key)?'checked':''}><span>${escapeHTML(c.label)}</span></label>`).join('')}</div></div><div id="trend-${domain}-chart" aria-live="polite">${trendChartHTML(domain)}</div></article></section>`;
}

function renderFOHTrend(domain){
 const host=$('trendHost-'+domain);if(!host||isLiveView())return;
 if(domain==='mix'){renderPersistentMixTrend();return}
 const scroll=$('trend-'+domain+'-choices')?.scrollTop??trendScrollPositions[domain]??0,chartScroll=$('trend-'+domain+'-chart')?.querySelector('.trend-chart-scroll')?.scrollLeft||0;
 const focusId=document.activeElement?.id,focusValue=document.activeElement?.value,focusDomain=document.activeElement?.dataset?.trendEntity,config=fohTrendViews[domain];
 host.innerHTML=trendPanelHTML(domain);
 const visibility=$('trend-'+domain+'-campaigns');visibility.checked=config.showCampaigns!==false;visibility.onchange=()=>{config.showCampaigns=visibility.checked;renderFOHTrend(domain);persistDashboardView()};
 for(const grain of ['week','month'])$('trend-'+domain+'-'+grain).onclick=()=>{config.grain=grain;renderFOHTrend(domain);persistDashboardView()};
 const metric=$('trend-'+domain+'-metric');if(metric){metric.value=config.metric;metric.onchange=()=>{config.metric=metric.value;renderFOHTrend(domain);persistDashboardView()}};
 for(const button of host.querySelectorAll('[data-trend-scope]'))button.onclick=()=>{config[domain==='employee'?'role':'location']=button.dataset.trendScope;const available=trendEntities(domain);if(!available.some(item=>config.keys.includes(item.key)))config.keys=[...new Set([...config.keys,...available.slice(0,3).map(item=>item.key)])];renderFOHTrend(domain);persistDashboardView()};
 $('trend-'+domain+'-all').onclick=()=>{const query=config.query.trim().toLowerCase(),shown=trendEntities(domain).filter(item=>!query||item.label.toLowerCase().includes(query));config.keys=[...new Set([...config.keys,...shown.map(item=>item.key)])];renderFOHTrend(domain);persistDashboardView()};
 $('trend-'+domain+'-clear').onclick=()=>{config.keys=[];renderFOHTrend(domain);persistDashboardView()};
 for(const box of host.querySelectorAll('[data-trend-entity]')){box.checked=config.keys.includes(box.value);box.onchange=()=>{config.keys=box.checked?[...new Set([...config.keys,box.value])]:config.keys.filter(k=>k!==box.value);renderFOHTrend(domain);persistDashboardView()}}
 if(domain==='food'){const category=$('trend-food-category');category.value=config.category;category.onchange=()=>{config.category=category.value;config.keys=[];config.query='';trendScrollPositions.food=0;const list=$('trend-food-choices');if(list)list.scrollTop=0;renderFOHTrend(domain);persistDashboardView()}}
 for(const box of host.querySelectorAll('[data-trend-campaign]')){box.checked=!Array.isArray(config.campaignIds)||config.campaignIds.includes(box.dataset.trendCampaign);box.onchange=()=>{const current=config.campaignIds??operationalData.campaigns.filter(c=>!c.archived).map(c=>c.id);config.campaignIds=box.checked?[...new Set([...current,box.dataset.trendCampaign])]:current.filter(id=>id!==box.dataset.trendCampaign);renderFOHTrend(domain);persistDashboardView()}}
 const search=$('trend-'+domain+'-search');search.value=config.query;search.oninput=()=>{config.query=search.value;for(const label of host.querySelectorAll('[data-trend-choice]'))label.hidden=!label.textContent.toLowerCase().includes(search.value.trim().toLowerCase());persistDashboardView()};if(config.query)search.oninput();
 if(focusDomain===domain){const next=[...host.querySelectorAll('[data-trend-entity]')].find(box=>box.value===focusValue);if(next)next.focus({preventScroll:true})}else if(focusId&&$(focusId))$(focusId).focus({preventScroll:true});
 trendScrollPositions[domain]=scroll;$('trend-'+domain+'-choices').scrollTop=scroll;$('trend-'+domain+'-choices').onscroll=()=>{trendScrollPositions[domain]=$('trend-'+domain+'-choices').scrollTop};
 const chart=$('trend-'+domain+'-chart')?.querySelector('.trend-chart-scroll');if(chart)chart.scrollLeft=chartScroll;
}

function renderFOHTrends(){if(isLiveView())return;if(page==='executive')renderFOHTrend('mix');else if(page==='parkinglot')for(const domain of ['employee','section','food'])renderFOHTrend(domain)}

function trendTargets(domain,data){
 if(domain==='employee'&&fohTrendViews.employee.metric==='alcoholMix')return [{label:'Alcohol mix goal',values:data.buckets.map(()=>operationalData.alcoholGoal),color:'#526475'}];
 if(domain==='mix')return data.series.map(s=>({label:s.label+' current target',color:s.color,values:data.buckets.map(b=>referenceSalesMixTargets(selectedFOHChecks().filter(c=>inWindow(c.date,b.start,b.end))).targets?.[s.key]??null)}));
 return [];
}

function campaignBands(buckets){
 const w=dateWindow();return operationalData.campaigns.filter(c=>!c.archived&&c.start<=w.end&&c.end>=w.start).map(c=>({campaign:c,indices:buckets.map((b,i)=>b.end>=c.start&&b.start<=c.end?i:-1).filter(i=>i>=0)}));
}

function trendChartHTML(domain){
 const data=trendSeriesData(domain),{buckets,series}=data,metric=trendMetric(domain),unit=metric[2],targets=trendTargets(domain,data);
 if(!series.length)return '<p class="empty">Select one or more '+({food:'items',mix:'categories',section:'sections',employee:'servers'}[domain])+' to compare.</p>';
 const values=series.flatMap(s=>s.points.map(p=>p.value)).filter(v=>v!==null&&Number.isFinite(v));
 if(!values.length)return '<p class="empty">No measured values for this selection and report period.</p>';
 const axisValues=values.concat(targets.flatMap(t=>t.values.filter(v=>v!==null&&Number.isFinite(v)))),low=Math.min(...axisValues),high=Math.max(...axisValues),pad=(high-low||Math.max(Math.abs(high)*.1,.1))*.12;
 const min=Math.max(0,low-pad),max=Math.max(min+.01,high+pad),minWidth=Math.max(320,buckets.length*68+70),width=Math.max(($('trendHost-'+domain)?.clientWidth||834)-34,minWidth),height=365,left=38,right=38,top=Math.max(54,targets.length*12+30),bottom=66,plotH=height-top-bottom,plotW=width-left-right;
 const x=i=>buckets.length===1?left+plotW/2:left+i*plotW/(buckets.length-1),y=v=>top+plotH-((v-min)/(max-min))*plotH;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${domain}TrendTitle ${domain}TrendDescription" data-axis-min="${min}" data-axis-max="${max}"><desc id="${domain}TrendDescription">${escapeHTML(metric[1])} by ${fohTrendViews[domain].grain}. Range adjusts to selected values and visible targets. Whole-number labels; precise measurements and samples are in point descriptions. Campaign bands show dates, not causal effects.</desc>`;
 for(let i=0;i<=4;i++){const yy=top+i*plotH/4;svg+=`<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#e3e8ed"/>`}
 const bands=(fohTrendViews[domain].showCampaigns===false?[]:campaignBands(buckets)).filter(({campaign:c})=>!c.archived&&(!Array.isArray(fohTrendViews[domain].campaignIds)||fohTrendViews[domain].campaignIds.includes(c.id))&&(domain!=='food'||c.category==='all'||series.some(s=>menuCatalog.find(item=>item.id===s.key)?.category===c.category))&&(domain!=='mix'||c.category==='all'||series.some(s=>s.key===c.category)));
 const spanStart=Date.parse(buckets[0].start+'T00:00:00Z'),spanEnd=Date.parse(shiftDate(buckets[buckets.length-1].end,1)+'T00:00:00Z');
 // Date positions use bucket boundaries; markers preserve the actual start/end dates within a bucket.
 const dateX=value=>{const t=Date.parse(value+'T00:00:00Z');if(buckets.length===1)return left+Math.max(0,Math.min(1,(t-spanStart)/(spanEnd-spanStart)))*plotW;const index=buckets.findIndex(b=>value<=b.end);if(index<0)return width-right;if(value<buckets[0].start)return left;const b=buckets[index],fraction=(t-Date.parse(b.start+'T00:00:00Z'))/(Date.parse(shiftDate(b.end,1)+'T00:00:00Z')-Date.parse(b.start+'T00:00:00Z'));return Math.max(left,Math.min(width-right,left+(index-.5+fraction)*plotW/(buckets.length-1)))};
 for(const {campaign:c} of bands){const start=c.start<dateWindow().start?dateWindow().start:c.start,end=shiftDate(c.end,1),xx=dateX(start),endX=dateX(end);svg+=`<rect x="${xx}" y="${top}" width="${Math.max(2,endX-xx)}" height="${plotH}" fill="#dca132" opacity=".12"><title>${escapeHTML(c.name)}: ${c.start} to ${c.end}, ${c.from}–${c.to}, Queen Creek time</title></rect>`}
 const line=(points,color,dash='')=>{let segment=[];const flush=()=>{if(segment.length>1)svg+=`<polyline points="${segment.join(' ')}" fill="none" stroke="${color}" stroke-width="${dash?'1.5':'2.5'}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;segment=[]};points.forEach((v,i)=>{if(v===null){flush();return}segment.push(x(i)+','+y(v))});flush()};
 for(const t of targets){line(t.values,t.color,'5 4');const index=t.values.findIndex(v=>v!==null);if(index>=0){svg+=`<text x="${left+5}" y="${22+targets.indexOf(t)*12}" fill="${t.color}" font-size="10">${escapeHTML(t.label)} ${trendWholeNumber(t.values[index],'%')}${domain==='mix'?' (current Admin reference; may vary by period)':''}</text>`;if(buckets.length===1)svg+=`<line x1="${left}" x2="${width-right}" y1="${y(t.values[0])}" y2="${y(t.values[0])}" stroke="${t.color}" stroke-dasharray="5 4"/>`}}
 for(const s of series){line(s.points.map(p=>p.value),s.color,s.dash);s.points.forEach((p,i)=>{if(p.value!==null)svg+=`<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="${s.color}"><title>${escapeHTML(s.label)}: ${trendNumber(p.value,unit)}; ${buckets[i].start} to ${buckets[i].end}; ${p.checks} checks, ${p.guests} guests${buckets[i].partial?'; partial period':''}</title></circle>`})}
 buckets.forEach((b,i)=>{
  svg+=`<text x="${x(i)}" y="${height-39}" text-anchor="middle" font-size="11" fill="#354655">${b.label}${b.partial?'*':''}</text><text x="${x(i)}" y="${height-20}" text-anchor="middle" font-size="10" fill="#7a8792">${b.year}</text>`;
  const labels=series.filter(s=>s.points[i].value!==null).map(s=>({s,target:y(s.points[i].value)-10})).sort((a,b)=>a.target-b.target),lower=top-12,upper=height-bottom-5,gap=Math.min(13,(upper-lower)/Math.max(labels.length-1,1));let last=lower-gap;
  labels.forEach(label=>{label.pos=Math.max(label.target,last+gap);last=label.pos});let next=upper+gap;for(let j=labels.length-1;j>=0;j--){labels[j].pos=Math.min(labels[j].pos,next-gap);next=labels[j].pos}
  for(const {s,pos} of labels)svg+=`<text class="trend-point-label" x="${x(i)}" y="${pos}" text-anchor="middle" fill="${s.color}" font-size="10" font-weight="600" stroke="#fff" stroke-width="3" paint-order="stroke" aria-hidden="true">${trendWholeNumber(s.points[i].value,unit)}</text>`;
 });svg+='</svg>';
 const campaignLegend=bands.length?`<div class="campaign-legend"><strong>Campaigns</strong>${bands.map(({campaign:c})=>`<span title="${escapeHTML(c.notes)}">${escapeHTML(c.name)} · ${c.start} to ${c.end} · ${c.from}–${c.to} · ${c.weekdays.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</span>`).join('')}</div>`:'';
 return `<div class="trend-chart-scroll" tabindex="0" role="region" aria-label="${domain} trend chart; scroll horizontally to see all periods" style="--chart-min:${minWidth}px">${svg}</div><div class="trend-legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${escapeHTML(s.label)}</span>`).join('')}</div>${campaignLegend}<p class="foot">${buckets.some(b=>b.partial)?'* Partial period. ':''}${buckets.length<2?'Choose a longer report period to see changes over time. ':''}${fohTrendViews[domain].grain==='week'?'Weeks run Monday to Sunday. ':''}Gaps mean no measured rate. ${targets.length?'Dashed targets are current reference settings, not historical target records. ':''}${bands.length?'Campaign shading shows date spans; active days/hours are listed above.':''}</p>`;
}

function rankingData(domain){
 const view=rankingViews[domain],cs=selectedFOHChecks();
 if(domain==='food'){
  const totals=new Map(menuCatalog.map(i=>[i.id,{name:i.name,key:i.id,category:i.category,units:0,cents:0,checks:0}]));
  for(const c of cs){const touched=new Set();for(const item of c.items){const r=totals.get(item.itemId);if(r){r.units++;r.cents+=Math.round(item.price*100);touched.add(item.itemId)}}for(const key of touched)totals.get(key).checks++}
  return [...totals.values()].filter(r=>view.category==='all'||r.category===view.category).map(r=>({...r,categoryLabel:bestSellerCategories.find(c=>c[0]===r.category)?.[1]||r.category,revenue:r.cents/100,value:view.metric==='units'?r.units:r.cents/100,guests:null}));
 }
 const allowed=new Set(currentRows().map(r=>r.server));
 const choices=domain==='employee'?serviceEmployees.filter(p=>allowed.has(p.name)&&(view.role==='all'||p.role===view.role)).map(p=>({key:p.name,name:p.name+' ('+(p.role==='bartender'?'B':'S')+')'})):fohSections.filter(s=>view.location==='all'||s.location===view.location).map(s=>({key:s.id,name:s.location+' / '+s.name}));
 return choices.map(entity=>{
  const records=cs.filter(c=>domain==='employee'?c.server===entity.key:c.sectionId===entity.key),guests=records.reduce((n,c)=>n+c.guests,0),cents={alcohol:0,apps:0,dessert:0,food:0,drink:0},units={apps:0,dessert:0};let total=0,alcoholChecks=0;
  for(const c of records){if(c.items.some(i=>i.category==='alcohol'))alcoholChecks++;for(const item of c.items){const amount=Math.round(item.price*100);total+=amount;cents[item.category]=(cents[item.category]||0)+amount;if(item.category in units)units[item.category]++}}
  const perGuest=value=>guests?value/guests:null;
  const row={key:entity.key,name:entity.name,guests,checks:records.length,revenue:total/100,salesPerGuest:perGuest(total/100),alcoholPerGuest:perGuest(cents.alcohol/100),smallPerGuest:perGuest(cents.apps/100),dessertPerGuest:perGuest(cents.dessert/100),foodPerGuest:perGuest(cents.food/100),drinkPerGuest:perGuest(cents.drink/100),smallUnitsPerGuest:perGuest(units.apps),dessertUnitsPerGuest:perGuest(units.dessert),upsellPerGuest:perGuest(units.apps+units.dessert),alcoholMix:total?cents.alcohol/total*100:null,smallMix:total?cents.apps/total*100:null,foodMix:total?cents.food/total*100:null,dessertMix:total?cents.dessert/total*100:null,drinkMix:total?cents.drink/total*100:null,alcoholAttachment:records.length?alcoholChecks/records.length*100:null};
  row.value=row[view.metric];return row;
 });
}

function sortedRankingData(domain){
 const view=rankingViews[domain],key=view.sortKey||view.metric,direction=view.sortDirection||-1;
 return rankingData(domain).sort((a,b)=>{const av=a[key],bv=b[key];if(av===null||av===undefined)return bv===null||bv===undefined?a.name.localeCompare(b.name):1;if(bv===null||bv===undefined)return -1;return (typeof av==='string'?av.localeCompare(bv):av-bv)*direction||a.name.localeCompare(b.name)});
}

function baseRankingPanelHTML(domain){
 const view=rankingViews[domain],title={food:'Food Rankings',employee:'Server Rankings',section:'Section Rankings'}[domain],columns=rankingColumns[domain],key=view.sortKey||view.metric,direction=view.sortDirection||-1,rows=sortedRankingData(domain);
 let rank=0,last=null;const body=rows.map((r,i)=>{const value=r[key],missing=value===null||value===undefined,rowGoals=domain==='employee'?serverRankingTargets(r):null;if(i===0||value!==last)rank=i+1;last=value;return `<tr><td>${missing?'—':rank}</td>${columns.map(([k,label,type])=>`<td class="${type==='text'?'text-cell':'numeric-cell'}">${rankingTargetCell(domain,r,k,type,rowGoals)}</td>`).join('')}</tr>`}).join('');
 const scopes=domain==='employee'?[['all','All Roles'],['server','Server'],['bartender','Bar']]:domain==='section'?[['all','All Sections'],['Inside','Inside'],['Patio','Outside']]:[];
 return `<section class="section full"><article class="card"><div class="head"><h2>${title}</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><div class="ranking-filters">${scopes.length?`<div class="mode-switch" role="group" aria-label="${title} scope">${scopes.map(([scope,label])=>`<button type="button" data-rank-scope="${scope}" class="${(domain==='employee'?view.role:view.location)===scope?'selected':''}" aria-pressed="${(domain==='employee'?view.role:view.location)===scope}">${label}</button>`).join('')}</div>`:`<label>Select category<select id="ranking-food-category"><option value="all" ${view.category==='all'?'selected':''}>All Categories</option>${bestSellerCategories.map(([k,n])=>`<option value="${k}" ${view.category===k?'selected':''}>${n}</option>`).join('')}</select></label>`}<span class="hint">Click a column heading to sort</span></div><div class="server-scroll ranking-scroll"><table class="table multi-ranking-table ${domain}-ranking-table"><thead><tr><th scope="col">Rank</th>${columns.map(([k,label,type])=>`<th scope="col" class="${type==='text'?'text-cell':'numeric-cell'}" aria-sort="${key===k?(direction===1?'ascending':'descending'):'none'}"><button type="button" data-rank-sort="${k}" aria-label="Sort by ${label}">${label} <span aria-hidden="true">${key===k?(direction===1?'▲':'▼'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${columns.length+1}">No measured values.</td></tr>`}</tbody></table></div><p class="foot">${domain==='food'?'Servings counts units sold, including topping/add-on units. Revenue is gross item revenue; zero-sale items are included.':domain==='employee'?'Revenue / Guest uses summed sales divided by guests. Each Mix is that category’s share of the server’s gross item revenue, excluding tax and tips. Mix columns total 100% before display rounding. Alcohol uses the server alcohol goal; other categories use Admin targets, weighted by this server’s Lunch/Dinner sales for All Day. Green = at or above goal; yellow = 90–99% of goal; red = below 90%. Guest/check counts provide context.':'Verified seat-capacity utilization remains pending; observed position use is in Seating Use & Preferences below.'} Selected report period and shift apply. Equal unrounded values share a rank; missing rates stay last.</p></article></section>`;
}

function renderRankings(){
 for(const domain of (page==='foh'?['employee']:page==='parkinglot'?['food','section']:[])){
  const host=$('rankingHost-'+domain);if(!host)continue;const oldScroll=host.querySelector('.ranking-scroll'),top=oldScroll?.scrollTop||0,left=oldScroll?.scrollLeft||0;
  host.innerHTML=rankingPanelHTML(domain);
  if(domain==='food'){const category=$('ranking-food-category');category.value=rankingViews.food.category;category.onchange=()=>{rankingViews.food.category=category.value;renderRankings();persistDashboardView()}}
  for(const button of host.querySelectorAll('[data-rank-sort]'))button.onclick=()=>{const key=button.dataset.rankSort,view=rankingViews[domain],current=view.sortKey||view.metric;if(current===key)view.sortDirection=-(view.sortDirection||-1);else{view.sortKey=key;view.sortDirection=key==='name'?1:-1}view.sortKey=key;view.metric=key;renderRankings();persistDashboardView()};
  for(const button of host.querySelectorAll('[data-rank-scope]'))button.onclick=()=>{rankingViews[domain][domain==='employee'?'role':'location']=button.dataset.rankScope;renderRankings();persistDashboardView()};
  const scroll=host.querySelector('.ranking-scroll');if(scroll){scroll.scrollTop=top;scroll.scrollLeft=left}
 }
 const seat=$('seatingInsightsHost');if(page==='parkinglot'&&seat)seat.innerHTML=seatingInsightsHTML();
}

function restoreRankings(saved){
 if(!saved||typeof saved!=='object')return;
 for(const domain of ['food','employee','section']){const from=saved[domain],to=rankingViews[domain];if(!from||typeof from!=='object')continue;const key=from.sortKey||from.metric;if(rankingColumns[domain].some(c=>c[0]===key)){to.metric=key;to.sortKey=key}if(from.sortDirection===1||from.sortDirection===-1)to.sortDirection=from.sortDirection;if(domain==='food'&&['all',...bestSellerCategories.map(c=>c[0])].includes(from.category))to.category=from.category;if(domain==='employee'&&['all','server','bartender'].includes(from.role))to.role=from.role;if(domain==='section'&&['all','Inside','Patio'].includes(from.location))to.location=from.location}
}


function baseFOHGroupedContent(){
 if(page!=='parkinglot')return '';
 const legacy=content(),start=legacy.indexOf('<div class="section full" id="employeePerformanceSection"'),staffing=start>=0?legacy.slice(0,start):'',performance=start>=0?legacy.slice(start):legacy,history=!isLiveView();
 const group=(id,name,body)=>`<div class="foh-group ${id}-group" id="fohGroup-${id}"><h2 class="foh-group-banner">${name}</h2>${body}</div>`;
 return group('food','FOOD',bestSellersHTML()+(history?'<div id="trendHost-food"></div><div id="rankingHost-food"></div>':''))+
 group('server','SERVER',performance+(history?'<div id="trendHost-employee"></div>':''))+
 group('staffing','STAFFING','<div id="fohStaffingModule">'+fohStaffingModuleHTML()+'</div>')+
 (history?group('section','SECTIONS','<div id="sectionPerformanceHost">'+sectionPerformanceHTML()+'</div>'+'<div id="trendHost-section"></div><div id="rankingHost-section"></div><div id="seatingInsightsHost"></div>')+group('operations','PROMOTIONS &amp; RECORDS','<div id="operationsHost"></div>'):'');
}

function installTrendResize(){if(typeof ResizeObserver==='undefined')return;const main=document.querySelector('.main');if(!main)return;let lastWidth=main.clientWidth,pending=false;const observer=new ResizeObserver(()=>{if(Math.abs(main.clientWidth-lastWidth)<8||pending)return;lastWidth=main.clientWidth;pending=true;requestAnimationFrame(()=>{pending=false;renderFOHTrends()})});observer.observe(main)}

function sectionSortValue(row,key){if(key==='order')return fohSections.findIndex(s=>s.id===row.sectionId);return key.split('.').reduce((value,part)=>value?.[part],row)}

function sortedSectionRows(rows,table){const sort=sectionTableSort[table];return [...rows].sort((a,b)=>{const av=sectionSortValue(a,sort.key),bv=sectionSortValue(b,sort.key);if(av===null||av===undefined)return bv===null||bv===undefined?0:1;if(bv===null||bv===undefined)return -1;return (typeof av==='string'?av.localeCompare(bv):av-bv)*sort.direction})}

function sectionSortHeadings(table,columns=sectionSortColumns){const sort=sectionTableSort[table];return `<thead><tr>${columns.map(([key,label])=>`<th scope="col" aria-sort="${sort.key===key?(sort.direction===1?'ascending':'descending'):'none'}"><button type="button" data-section-sort="${table}:${key}">${label} <span aria-hidden="true">${sort.key===key?(sort.direction===1?'▲':'▼'):'↕'}</span></button></th>`).join('')}</tr></thead>`}

function baseSectionPerformanceHTML(){
 if(page!=='parkinglot'||isLiveView())return '';
 const data=sectionPerformanceData();
 const row=(group,rollup=false)=>{const definition=fohSections.find(s=>s.id===group.sectionId),numbers=definition?definition.first+'–'+definition.last:'';return `<tr class="${rollup?'section-rollup':'section-detail'}"><th scope="row"><button type="button" class="section-group-button" data-section-group="${group.key}" aria-controls="sectionEmployeeComparison" aria-expanded="${sectionPlanningView.group===group.key}"><span>${escapeHTML(group.label)}</span>${numbers?`<small>${numbers}</small>`:''}</button></th>${sectionMetricCells(group)}</tr>`};
 const table=(key,title,rows,footer='')=>`<h3 class="section-table-heading">${title}</h3><div class="section-planning-scroll" tabindex="0" role="region" aria-label="${title}"><table class="section-planning-table sortable-section-table">${sectionSortHeadings(key)}<tbody>${sortedSectionRows(rows,key).map(group=>row(group,key==='locations')).join('')||'<tr><td colspan="10">No matching sections.</td></tr>'}</tbody>${footer}</table></div>`;
 return `<section class="section full" id="sectionPerformanceSection" aria-labelledby="sectionPerformanceTitle"><article class="card section-planning-card"><div class="head"><h2 id="sectionPerformanceTitle">Section Performance</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><p class="section-planning-purpose">Plan coaching and server placement. Select a location or section to compare server performance.</p>${table('locations','LOCATION TOTALS',data.locations,`<tfoot><tr><th scope="row">All Locations</th>${sectionMetricCells(data.total)}</tr></tfoot>`)}${table('sections','BY SECTION',data.sections)}${data.unmapped.checks?table('unmapped','UNMAPPED SEATING',[data.unmapped]):''}<p class="foot section-planning-definitions">Rev is gross item sales before refunds and comps, excluding tax and tips. Alcohol Mix = alcohol share of Rev. Alcohol Included = checks containing alcohol. Compare per-guest values alongside Avg Check to account for party size.</p><div id="sectionEmployeeComparison" class="section-employee-comparison" ${sectionPlanningView.group?'':'hidden'} aria-labelledby="sectionEmployeeTitle">${sectionEmployeeComparisonHTML()}</div></article></section>`;
}

function sectionEmployeeComparisonHTML(){
 const group=sectionPlanningGroups.find(g=>g.key===sectionPlanningView.group);if(!group)return '';
 const records=selectedFOHChecks(),selected=records.filter(c=>sectionMatchesGroup(c,group)),summary=summarizeSectionChecks(selected),rows=sortedSectionRows(sectionEmployeeRows(group.key,records),'employees');
 return `<div class="section-employee-head"><div><h3 id="sectionEmployeeTitle">SERVER · ${escapeHTML(group.label)}</h3><p class="hint">Avg Check ${sectionMoney(summary.avgCheckCents)} · Alcohol / Guest ${sectionMoney(summary.alcoholPerGuestCents)}</p></div><button type="button" class="section-employee-close" id="closeSectionEmployees">Close ×</button></div><div class="section-planning-scroll" tabindex="0" role="region" aria-label="Server comparison"><table class="section-planning-table section-employee-table sortable-section-table">${sectionSortHeadings('employees',sectionEmployeeSortColumns)}<tbody>${rows.length?rows.map(r=>`<tr><th scope="row"><span class="employee-name"><span class="employee-role-badge ${r.role}" role="img" aria-label="${r.role==='bartender'?'Bartender':'Server'}">${r.role==='bartender'?'B':'S'}</span><span>${escapeHTML(r.name)}</span></span></th><td>${fmt(r.selected.checks)}</td><td>${fmt(r.selected.guests)}</td><td>${sectionMoney(r.selected.avgCheckCents)}</td><td>${sectionMoney(r.overall.avgCheckCents)}</td><td>${sectionMoney(r.selected.alcoholPerGuestCents)}</td><td>${sectionMoney(r.overall.alcoholPerGuestCents)}</td><td>${sectionPercent(r.selected.alcoholMix)}</td></tr>`).join(''):'<tr><td colspan="8">No servers match these filters.</td></tr>'}</tbody></table></div><p class="foot">Here = selected location or section. Overall includes Here, with the same report dates and shift. Employees and role selections apply.</p>`;
}

function bindSectionTableSorting(){
 for(const button of document.querySelectorAll('[data-section-sort]'))button.onclick=()=>{
  const [table,key]=button.dataset.sectionSort.split(':'),view=sectionTableSort[table];if(view.key===key)view.direction*=-1;else{view.key=key;view.direction=key==='label'||key==='name'?1:-1}
  const host=$('sectionPerformanceHost');if(host)host.innerHTML=sectionPerformanceHTML();syncSectionPlanningControls();persistDashboardView();
 };
}

function restoreSectionTableSort(saved){if(!saved||typeof saved!=='object')return;for(const table of Object.keys(sectionTableSort)){const from=saved[table],columns=table==='employees'?sectionEmployeeSortColumns:sectionSortColumns;if(from&&(from.key==='order'||columns.some(c=>c[0]===from.key))&&(from.direction===1||from.direction===-1))sectionTableSort[table]={key:from.key,direction:from.direction}}}

function sectionPerformanceHTML(){return externalSubsectionHeadings(baseSectionPerformanceHTML())}

function trendPanelHTML(domain){return externalSubsectionHeadings(baseTrendPanelHTML(domain))}

function rankingPanelHTML(domain){return domain==='employee'?fohPerformanceModuleHTML():externalSubsectionHeadings(baseRankingPanelHTML(domain))}

function fohGroupedContent(){return externalSubsectionHeadings(baseFOHGroupedContent())}

function seatingInsightsHTML(){return externalSubsectionHeadings(baseSeatingInsightsHTML())}

function campaignManagerHTML(){return externalSubsectionHeadings(baseCampaignManagerHTML())}


function persistentMixPanelHTML(){
 const config=fohTrendViews.mix,{buckets,rows,records}=persistentMixData(),eligible=selectValue('daypart')==='all',paired=eligible&&config.presentation==='dayparts',parts=paired?['lunch','dinner']:['all'],reference=referenceSalesMixTargets(records);
 const colors={all:'#435E80',lunch:'#277F91',dinner:'#A84150'};
 const cards=rows.map(row=>{
  const expanded=expandedMixChart===row.key;
  const values=parts.flatMap(part=>row.parts[part].map(p=>p.value)).filter(v=>v!==null),low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1,pad=Math.max(.4,(high-low)*.2),min=Math.max(0,low-pad),max=Math.min(100,high+pad);
  const host=$('trendHost-mix'),gridWidth=host?.querySelector('.grid-trend-cards')?.clientWidth||Math.max(280,(host?.clientWidth||1100)-34),viewport=typeof window.innerWidth==='number'?window.innerWidth:1200,columns=viewport<=600?1:viewport<=950?2:3;
  const compactWidth=Math.max(220,(gridWidth-(columns-1)*18)/columns-26);
  const width=expanded?Math.max(gridWidth-26,buckets.length*48+80):compactWidth,height=expanded?420:210,left=28,right=expanded?55:42,top=expanded?28:20,bottom=48,plotH=height-top-bottom,plotW=width-left-right,x=i=>buckets.length===1?left+plotW/2:left+i*plotW/(buckets.length-1),y=v=>top+plotH-(v-min)/(max-min)*plotH;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${row.label} sales mix trends" data-grid-chart="${row.key}" data-axis-min="${min}" data-axis-max="${max}" style="width:${width}px;height:${height}px;max-width:none">`;
  for(let i=0;i<3;i++)svg+=`<line x1="${left}" x2="${width-right}" y1="${top+i*plotH/2}" y2="${top+i*plotH/2}" stroke="#e2e7ec"/>`;
  const bands=config.showCampaigns===false?[]:campaignBands(buckets).filter(({campaign:c})=>c.category==='all'||c.category===row.key);
  const dateX=date=>{const t=Date.parse(date+'T00:00:00Z');if(buckets.length===1){const b=buckets[0];return left+Math.max(0,Math.min(1,(t-Date.parse(b.start+'T00:00:00Z'))/(Date.parse(shiftDate(b.end,1)+'T00:00:00Z')-Date.parse(b.start+'T00:00:00Z'))))*plotW}const index=buckets.findIndex(b=>date<=b.end);if(index<0)return width-right;if(date<buckets[0].start)return left;const b=buckets[index],fraction=(t-Date.parse(b.start+'T00:00:00Z'))/(Date.parse(shiftDate(b.end,1)+'T00:00:00Z')-Date.parse(b.start+'T00:00:00Z'));return Math.max(left,Math.min(width-right,left+(index-.5+fraction)*plotW/(buckets.length-1)))};
  for(const {campaign:c}of bands){const xx=dateX(c.start),end=dateX(shiftDate(c.end,1));svg+=`<rect data-sample-campaign="${escapeHTML(c.id)}" x="${xx}" y="${top}" width="${Math.max(3,end-xx)}" height="${plotH}" fill="#DEA839" opacity=".18"><title>${escapeHTML(c.name)}: ${c.start} to ${c.end}, ${c.from}–${c.to}; illustrative annotation only</title></rect><line x1="${xx}" x2="${xx}" y1="${top}" y2="${top+plotH}" stroke="#BB861F" stroke-width="1" opacity=".6"/>`}
  let endpoints=[];
  for(const part of parts){const points=row.parts[part],color=colors[part],caption=part==='all'?'Blended':part==='lunch'?'Lunch':'Dinner';let segment=[];const flush=()=>{if(segment.length>1)svg+=`<polyline data-grid-line="${part}" points="${segment.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" />`;segment=[]};points.forEach((p,i)=>{if(p.value===null){flush();return}segment.push(x(i)+','+y(p.value))});flush();
   points.forEach((p,i)=>{if(p.value!==null)svg+=`<circle cx="${x(i)}" cy="${y(p.value)}" r="3" fill="${color}" stroke="#fff" stroke-width="1"><title>${row.label}, ${caption}: ${p.value.toFixed(1)}%; ${buckets[i].start} to ${buckets[i].end}; ${p.checks} checks</title></circle><circle cx="${x(i)}" cy="${y(p.value)}" r="9" fill="transparent"><title>${row.label}, ${caption}: ${p.value.toFixed(1)}%; ${buckets[i].start} to ${buckets[i].end}; ${p.checks} checks</title></circle>`});
   let last=points.length-1;while(last>=0&&points[last].value===null)last--;if(last>=0)endpoints.push({part,color,index:last,value:points[last].value,pos:y(points[last].value)});
  }
  endpoints.sort((a,b)=>a.pos-b.pos);if(endpoints.length===2&&endpoints[1].pos-endpoints[0].pos<16){const middle=(endpoints[0].pos+endpoints[1].pos)/2;endpoints[0].pos=Math.max(top,middle-8);endpoints[1].pos=Math.min(top+plotH,middle+8)}
  if(buckets.length>12&&!expanded)for(const end of endpoints){svg+=`<line x1="${x(end.index)+4}" x2="${width-right+5}" y1="${y(end.value)}" y2="${end.pos}" stroke="${end.color}" opacity=".5"/><text x="${width-right+8}" y="${end.pos+4}" font-size="12" font-weight="750" fill="${end.color}">${Math.round(end.value)}%</text>`}
  if(buckets.length<=12||expanded)buckets.forEach((bucket,i)=>{
   const labels=parts.filter(part=>row.parts[part][i].value!==null).map(part=>({part,value:row.parts[part][i].value,pos:y(row.parts[part][i].value)-9})).sort((a,b)=>a.pos-b.pos);
   if(labels.length===2&&labels[1].pos-labels[0].pos<15)labels[0].pos=labels[1].pos-15;
   for(const label of labels)svg+=`<text data-point-label="${label.part}" x="${x(i)}" y="${label.pos}" text-anchor="middle" font-size="12" font-weight="700" fill="${colors[label.part]}" stroke="#fff" stroke-width="3" paint-order="stroke">${expanded?label.value.toFixed(1):Math.round(label.value)}%</text>`;
  });
  const interval=expanded||buckets.length<=12?1:Math.max(1,Math.ceil((buckets.length-1)/4));buckets.forEach((b,i)=>{if(i%interval===0||i===buckets.length-1)svg+=`<text x="${x(i)}" y="${height-25}" text-anchor="middle" font-size="12" fill="#475969">${b.label}${b.partial?'*':''}</text><text x="${x(i)}" y="${height-10}" text-anchor="middle" font-size="11" fill="#7a8792">${String(b.year).slice(-2)}</text>`});
  if(!values.length)svg+=`<text x="${width/2}" y="${height/2}" text-anchor="middle" font-size="12" fill="#7a8792">No sales for this period</text>`;
  svg+='</svg>';
  const target=paired?`<span class="grid-lunch">Lunch (Target: ${targetPercent(salesMixTargets.lunch[row.key])})</span><span class="grid-dinner">Dinner (Target: ${targetPercent(salesMixTargets.dinner[row.key])})</span>`:`Target: ${reference.targets?targetPercent(reference.targets[row.key]):'—'}`;
  return `<article class="grid-trend-card ${expanded?'expanded':''}" data-grid-card="${row.key}" ${expandedMixChart&&!expanded?'hidden':''}><div class="grid-card-heading"><h3>${row.label}</h3><button type="button" class="grid-expand-control" data-expand-mix="${row.key}" aria-expanded="${expanded}" aria-controls="grid-plot-${row.key}" aria-label="${expanded?'Collapse':'Expand'} ${row.label} chart">${expanded?'−':'+'}</button></div><div class="grid-targets">${target}</div><div class="grid-plot-wrap" id="grid-plot-${row.key}" tabindex="${expanded?'0':'-1'}">${svg}</div>${bands.length?`<div class="grid-campaign-caption">${bands.map(({campaign:c})=>{const short=date=>{const [y,m,d]=date.split('-');return Number(m)+'/'+Number(d)+'/'+y.slice(-2)};return `<span>${short(c.start)}${c.end!==c.start?'-'+short(c.end):''}: ${escapeHTML(c.name)}</span>`}).join('')}</div>`:''}</article>`;
 }).join('');
 return `<section class="section full foh-trend-section" id="mixTrendsSection"><article class="card"><div class="head"><h2>Sales Mix Trends</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><div class="trend-toolbar">${eligible?`<div class="mode-switch" role="group" aria-label="Sales Mix Trends view">${[['blended','Blended'],['dayparts','Lunch v. Dinner']].map(([key,label])=>`<button type="button" data-mix-trend-view="${key}" class="${config.presentation===key?'selected':''}" aria-pressed="${config.presentation===key}">${label}</button>`).join('')}</div>`:''}<div class="mode-switch" role="group" aria-label="Grouping">${['week','month'].map(grain=>`<button id="trend-mix-${grain}" type="button" class="${config.grain===grain?'selected':''}" aria-pressed="${config.grain===grain}">${grain==='week'?'Week':'Month'}</button>`).join('')}</div><label class="campaign-visibility"><input type="checkbox" id="trend-mix-campaigns" ${config.showCampaigns!==false?'checked':''}> Show campaigns</label></div>${paired?'<div class="grid-line-key"><span class="grid-lunch">━━ Lunch</span><span class="grid-dinner">━━ Dinner</span></div>':''}<div class="grid-trend-cards ${expandedMixChart?'has-expanded':''}">${cards}</div><p class="foot">Hover over points for exact values and dates.</p></article></section>`;
}


function persistentMixBuckets(window,grain){
 if(days!=='rolling12'||grain!=='month')return trendBuckets(window,grain);
 const exclusive=shiftDate(window.end,1),year=Number(exclusive.slice(0,4)),month=Number(exclusive.slice(5,7))-1,day=Number(exclusive.slice(8,10));
 const boundary=offset=>{const first=new Date(Date.UTC(year,month+offset,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return iso(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(day,last))))};
 return Array.from({length:12},(_,i)=>{const from=i===0?window.start:boundary(i-12),end=shiftDate(boundary(i-11),-1),d=new Date(end+'T12:00:00Z');return {key:from,start:from,end,label:new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(d),year:Number(end.slice(0,4)),partial:false}});
}

async function toggleExpandedMixChart(key){
 if(mixChartAnimating)return;mixChartAnimating=true;
 const host=$('trendHost-mix'),grid=host.querySelector('.grid-trend-cards'),reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 try{
  if(grid&&grid.animate&&!reduce)await grid.animate([{opacity:1},{opacity:0}],{duration:100,easing:'ease-in',fill:'forwards'}).finished;
  expandedMixChart=expandedMixChart===key?null:key;renderPersistentMixTrend();
  const nextGrid=host.querySelector('.grid-trend-cards');
  if(nextGrid&&nextGrid.animate&&!reduce)await nextGrid.animate([{opacity:0},{opacity:1}],{duration:150,easing:'ease-out'}).finished;
  const next=[...host.querySelectorAll('[data-expand-mix]')].find(button=>button.dataset.expandMix===key);if(next)next.focus({preventScroll:true});
 }catch(error){renderPersistentMixTrend()}finally{mixChartAnimating=false}
}

function staffingPositionCounts(entries){return Object.fromEntries(fohStaffingRoles.map(([role])=>[role,new Set(entries.filter(e=>e.role===role).map(e=>e.name)).size]))}

function staffingShiftRows(week,part){const entries=fohStaffingEntries(week,shiftDate(week,6));return Array.from({length:7},(_,i)=>{const date=shiftDate(week,i),available=date>=DEMO_START&&date<=DEMO_TODAY,counts=staffingPositionCounts(entries.filter(e=>e.date===date&&(e.start<15*60?'lunch':'dinner')===part));return {date,available,counts,total:fohStaffingRoles.reduce((sum,[role])=>sum+counts[role],0)}})}

function fohStaffingModuleHTML(){
 const current=staffingPositionCounts(fohStaffingEntries(DEMO_TODAY,DEMO_TODAY).filter(e=>e.start<=sampleStaffingMinute&&e.end>sampleStaffingMinute));
 const short=date=>{const [year,month,day]=date.split('-');return Number(month)+'/'+Number(day)+'/'+year.slice(-2)};
 const table=part=>`<div class="staffing-shift-column"><article class="card"><div class="head"><h2>${part==='lunch'?'Lunch':'Dinner'}</h2></div><div class="server-scroll"><table class="table staffing-count-table" aria-label="${part} staffing by weekday"><thead><tr><th scope="col">Day</th>${fohStaffingRoles.map(([,label])=>`<th scope="col">${label}</th>`).join('')}<th scope="col">Total</th></tr></thead><tbody>${staffingShiftRows(staffingWeekStart,part).map(row=>`<tr${row.date===DEMO_TODAY?' class="staffing-today"':''}><th scope="row">${new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z'))}<small>${short(row.date)}</small></th>${fohStaffingRoles.map(([role])=>`<td>${row.available?row.counts[role]:'—'}</td>`).join('')}<td class="staffing-total">${row.available?row.total:'—'}</td></tr>`).join('')}</tbody></table></div></article></div>`;
 return `<div class="section full"><article class="card"><div class="head"><h2>Current Staffing</h2><span class="section-period">Sample ${short(DEMO_TODAY)} · 5:40 PM · Dinner</span></div><div class="staffing-now-counts">${fohStaffingRoles.map(([role,label])=>`<div><span>${label}</span><strong data-current-staff-role="${role}">${current[role]}</strong></div>`).join('')}<div class="staffing-total"><span>Total</span><strong>${fohStaffingRoles.reduce((sum,[role])=>sum+current[role],0)}</strong></div></div></article></div><div class="staffing-week-toolbar"><h3>WEEKLY STAFFING BY SHIFT</h3><div class="staffing-week-controls"><button type="button" id="staffingPreviousWeek" aria-label="Previous week" ${staffingWeekStart<=mondayOf(DEMO_START)?'disabled':''}>‹</button><label>Week of <input type="date" id="staffingWeek" value="${staffingWeekStart}" min="${DEMO_START}" max="${DEMO_TODAY}"></label><button type="button" id="staffingNextWeek" aria-label="Next week" ${shiftDate(staffingWeekStart,7)>DEMO_TODAY?'disabled':''}>›</button></div></div><div class="staffing-shift-grid">${table('lunch')}${table('dinner')}</div><p class="staffing-module-note">Sample headcounts by assigned shift, including all employees. Week selection is independent of Report Period. — = no sample records.</p>${!isLiveView()?'<div class="section full">'+staffingEfficiencyHTML()+'</div>':''}`;
}

function bindStaffingModule(){
 const refresh=()=>{const host=$('fohStaffingModule');host.innerHTML=externalSubsectionHeadings(fohStaffingModuleHTML());bindStaffingModule();persistDashboardView()};
 const select=date=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<DEMO_START||date>DEMO_TODAY)return;staffingWeekStart=mondayOf(date);refresh()};
 $('staffingPreviousWeek').onclick=()=>select(shiftDate(staffingWeekStart,-7));$('staffingNextWeek').onclick=()=>select(shiftDate(staffingWeekStart,7));$('staffingWeek').onchange=()=>select($('staffingWeek').value);
}
