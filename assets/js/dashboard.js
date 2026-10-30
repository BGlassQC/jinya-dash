/* JINYA v0138 — Dashboard shell, navigation, shared filters, Admin and dashboard routing. Function definitions only; shared.js starts the application. */

function usesFOHData(section=page){return section==='foh'||section==='parkinglot'}

function liveDaypartAt(value=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',hour:'2-digit',hourCycle:'h23'}).format(value));
 return hour>=11&&hour<17?'lunch':hour>=17&&hour<22?'dinner':'all';
}

function createFilterSet(daypart='all'){return {daypart,population:'active',filtersOpen:false}}

function activeFilters(section=page){const view=sectionViews[section];return view?view[view.mode==='live'?'liveFilters':'historyFilters']:null}

function isLiveView(section=page){return sectionViews[section].mode==='live'}

function parseDashboardPeriod(value){const text=String(value);return dashboardPeriods.some(([key])=>key===text)?(/^\d+$/.test(text)?Number(text):text):null}

function dashboardPeriodLabel(){return dashboardPeriods.find(([key])=>key===String(days))?.[1]||'Today'}

function syncEmployeesFilter(element,live,value){
 const choices=[['onfloor','Currently on Floor'],['active','All Employees']];
 const markup=choices.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
 if(element.innerHTML!==markup)element.innerHTML=markup;
 element.value=choices.some(([key])=>key===value)?value:'active';return element.value;
}

function rememberSectionFilters(){
 const view=activeFilters();view.daypart=selectValue('daypart');view.population=syncEmployeesFilter($('population'),isLiveView(),selectValue('population'));
 if(!isLiveView()&&parseDashboardPeriod(days)!==null)view.historyDays=days;
}

function applySectionView(){
 if(usesFOHData()||page==='executive')sectionViews[page].mode='history';
 const view=activeFilters();days=isLiveView()?1:view.historyDays;
 if(view.population==='worked')view.population='active';
 $('daypart').value=view.daypart;view.population=syncEmployeesFilter($('population'),isLiveView(),view.population);
}

function syncDashboardControls(){
 document.documentElement.dataset.viewMode=isLiveView()?'live':'history';document.body.dataset.viewMode=isLiveView()?'live':'history';
 $('liveView').setAttribute('aria-pressed',String(isLiveView()));$('historyView').setAttribute('aria-pressed',String(!isLiveView()));
 $('sectionViewToggle').setAttribute('aria-label',names[page]+' view');
 $('periodFilter').hidden=isLiveView();$('fohControls').hidden=!['foh','parkinglot','executive'].includes(page)&&isLiveView();
 $('period').value=String(days);$('period').disabled=isLiveView();$('period').title=isLiveView()?'Live shows Today. Select History to choose another period.':'Historical reporting period';
 $('timeOfDayFilter').hidden=!['foh','parkinglot','executive'].includes(page);$('employeePopulationFilter').hidden=!usesFOHData();
 $('fohControls').classList.toggle('period-only',!['foh','parkinglot','executive'].includes(page));
 syncFilterDrawer(document);syncFOHWorkspaces();syncMidnightHeader();
}

function filterDrawerIDs(items=false){return items?{toggle:'itemsFilterToggle',summary:'itemsFilterSummary',drawer:'itemsFilterDrawer',dayparts:'itemsDaypartButtons',employees:'itemsEmployeeButtons',periods:'itemsPeriodButtons'}:{toggle:'filterSummaryToggle',summary:'filterSelectionSummary',drawer:'filterDrawer',dayparts:'daypartButtons',employees:'employeeButtons',periods:'periodButtons'}}

function filterSelectionSummary(foh=usesFOHData()){
 const selection=[];
 if(page==='executive'){selection.push({all:'All Day',lunch:'Lunch',dinner:'Dinner'}[selectValue('daypart')])}else if(foh){selection.push({all:'All Day',lunch:'Lunch',dinner:'Dinner'}[selectValue('daypart')]);selection.push(selectValue('population')==='onfloor'?'Current':'All Employees')}
 selection.push(dashboardPeriodLabel());return (isLiveView()?'Live: ':'History: ')+selection.join(' · ');
}

function setFiltersOpen(section,open){
 if(!Object.hasOwn(sectionViews,section))return;
 activeFilters(section).filtersOpen=!!open;
 syncDashboardControls();renderBestSellersWindow();persistDashboardView();
}

function commitFilterSelection(section,updates){
 const view=activeFilters(section);if(!view)return;
 Object.assign(view,updates);
 if(page===section){applySectionView();renderKeepingSection()}else{renderBestSellersWindow();persistDashboardView()}
}

function toggleFilterDaypart(section,part){
 if(!['all','lunch','dinner'].includes(part))return;
 if(activeFilters(section).daypart!==part)commitFilterSelection(section,{daypart:part});
}

function chooseFilterEmployees(section,population){if(['onfloor','active'].includes(population))commitFilterSelection(section,{population})}

function chooseFilterPeriod(section,value){
 const period=parseDashboardPeriod(value);if(period!==null&&sectionViews[section].mode==='history')commitFilterSelection(section,{historyDays:period});
}

function syncFilterDrawer(root,items=false){
 const ids=filterDrawerIDs(items),get=id=>root.querySelector('#'+id),section=items?'parkinglot':page,view=activeFilters(section),foh=items||['foh','parkinglot','executive'].includes(page),open=view.filtersOpen===true;
 const summary=items?(isLiveView()?'Live: ':'History: ')+({all:'All Day',lunch:'Lunch',dinner:'Dinner'}[selectValue('daypart')])+' · All Employees · '+dashboardPeriodLabel():filterSelectionSummary(foh);
 get(ids.summary).textContent=summary;get(ids.toggle).setAttribute('aria-label','Filters: '+summary);get(ids.toggle).setAttribute('aria-expanded',String(open));get(ids.toggle).onclick=()=>setFiltersOpen(section,!activeFilters(section).filtersOpen);
 get(ids.drawer).hidden=!open;get(ids.drawer).classList.toggle('filter-live',isLiveView());get(ids.drawer).classList.toggle('filter-only-period',!foh);
 for(const part of ['all','lunch','dinner']){const button=get(ids.dayparts+'-'+part);button.setAttribute('aria-pressed',String(selectValue('daypart')===part));button.onclick=()=>toggleFilterDaypart(section,part)}
 for(const population of ['onfloor','active']){const button=get(ids.employees+'-'+population);button.setAttribute('aria-pressed',String(selectValue('population')===population));button.onclick=()=>chooseFilterEmployees(section,population)}
 for(const [period] of dashboardPeriods){const button=get(ids.periods+'-'+period);button.setAttribute('aria-pressed',String(String(days)===period));button.onclick=()=>chooseFilterPeriod(section,period)}
}


function renderKeepingSection(){
 // Filters update values in place. Never anchor to a later report section.
 // Desktop scrolls .main; narrow layouts may scroll the document instead.
 const scrollers=[...new Set([document.querySelector('.main'),document.scrollingElement].filter(Boolean))];
 const positions=scrollers.map(element=>({element,top:element.scrollTop,left:element.scrollLeft}));
 render();
 for(const {element,top,left} of positions){
  if(Number.isFinite(top))element.scrollTop=top;
  if(Number.isFinite(left))element.scrollLeft=left;
 }
}


function setDashboardMode(mode){
 if(usesFOHData()&&mode!=='history')return false;
 if(!['live','history'].includes(mode)||sectionViews[page].mode===mode)return false;
 rememberSectionFilters();sectionViews[page].mode=mode;applySectionView();renderKeepingSection();return true;
}

function setDashboardPeriod(value){
 const selected=parseDashboardPeriod(value);if(isLiveView()||selected===null){syncDashboardControls();return false}
 days=selected;activeFilters().historyDays=selected;renderKeepingSection();return true;
}

function navigateDashboard(section){
 setFloorNavOpen(false);
 if(!Object.hasOwn(names,section))return;
 if(section==='executive')history.replaceState(null,'','#gm-'+gmCategory);
 else if(/^#gm-/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);
 rememberSectionFilters();page=section;applySectionView();render();const main=document.querySelector('.main');if(main)main.scrollTop=0;if(document.scrollingElement)document.scrollingElement.scrollTop=0;
}

function selectGMCategory(category){
 if(!['overview','operations','tbd'].includes(category))return false;
 gmCategory=category;
 if(page!=='executive'){rememberSectionFilters();page='executive';applySectionView()}
 history.replaceState(null,'','#gm-'+category);
 render();
 for(const scroller of [document.querySelector('.main'),document.scrollingElement])if(scroller)scroller.scrollTop=0;
 return true;
}

function requestGMCategory(category){
 if(gmCategoryRequests.has(category))return gmCategoryRequests.get(category);
 const pending=(async()=>{
  try{
   const response=await fetch('pages/gm-'+category+'.html?v=0149');
   if(!response.ok)throw new Error('Category page could not be loaded');
   const markup=await response.text();
   const required={overview:'gmOverviewPage',operations:'gmOperationsPage',tbd:'gmTBDPage'}[category];
   if(!markup.includes('id="'+required+'"'))throw new Error('Category page is invalid');
   gmCategoryPages.set(category,markup);
   if(page==='executive'&&gmCategory===category)render();
  }catch(error){
   if(page==='executive'&&gmCategory===category){
    $('gmCategoryHost').innerHTML='<p role="alert">This page could not be loaded.</p><button type="button" id="retryGMCategory">Retry</button>';
    $('retryGMCategory').onclick=()=>{gmCategoryRequests.delete(category);render()};
   }
   console.warn('General Manager category load failed.',error);
  }finally{gmCategoryRequests.delete(category)}
 })();
 gmCategoryRequests.set(category,pending);return pending;
}

function renderGMCategory(){
 const host=$('gmCategoryHost'),legacy=$('legacyDashboardModules'),main=$('dashboardMain');
 // Preserve the existing module nodes before replacing a category fragment.
 if(legacy.parentElement!==main)main.insertBefore(legacy,document.querySelector('.demo-footer'));
 host.hidden=page!=='executive';
 if(page!=='executive'){host.innerHTML='';gmMountedCategory=null;return}
 if(gmMountedCategory!==gmCategory){
  const markup=gmCategoryPages.get(gmCategory);
  if(!markup){host.innerHTML='<p role="status">Loading…</p>';gmMountedCategory=null;requestGMCategory(gmCategory);return}
  host.innerHTML=markup;gmMountedCategory=gmCategory;
 }
 if(gmCategory==='tbd')$('gmLegacyModules').append(legacy);
 if(gmCategory==='operations')renderGMFoodPrep();
}

function selectFOHCategory(category,moduleId=null){
 if(!['overview','staff-performance','guest-relations'].includes(category))return false;
 fohModuleTarget=moduleId?{category,id:moduleId}:null;
 fohCategory=category;
 if(page!=='foh'){rememberSectionFilters();page='foh';applySectionView()}
 render();
 for(const scroller of [document.querySelector('.main'),document.scrollingElement])if(scroller)scroller.scrollTop=0;
 return true;
}

function requestFOHCategory(category){
 if(fohCategoryRequests.has(category))return fohCategoryRequests.get(category);
 const pending=(async()=>{
  try{
   const response=await fetch('pages/'+category+'.html?v=0149');
   if(!response.ok)throw new Error('Category page could not be loaded');
   const markup=await response.text();
   const required={overview:'id="fohOverviewHost"','staff-performance':'id="fohStaffPerformance"','guest-relations':'id="fohGuestRelationsHost"'}[category];
   if(!markup.includes(required))throw new Error('Category page is invalid');
   fohCategoryPages.set(category,markup);
   if(page==='foh'&&fohCategory===category)render();
  }catch(error){
   if(page==='foh'&&fohCategory===category){
    const host=$('fohCategoryHost');host.innerHTML='<p role="alert">This category could not be loaded.</p><button type="button" id="retryFOHCategory">Retry</button>';
    $('retryFOHCategory').onclick=()=>{fohCategoryRequests.delete(category);render()};
   }
   console.warn('FOH category load failed.',error);
  }finally{fohCategoryRequests.delete(category)}
 })();
 fohCategoryRequests.set(category,pending);
 return pending;
}

function renderFOHCategory(){
 const host=$('fohCategoryHost');host.hidden=page!=='foh';
 if(page!=='foh'){host.innerHTML='';fohMountedCategory=null;fohModuleTarget=null;return}
 if(fohMountedCategory!==fohCategory){
  const markup=fohCategoryPages.get(fohCategory);
  if(!markup){host.innerHTML='<p role="status">Loading…</p>';fohMountedCategory=null;requestFOHCategory(fohCategory);return}
  host.innerHTML=markup;fohMountedCategory=fohCategory;
 }
 if(fohCategory==='overview')renderFOHOverviewPage();
 else if(fohCategory==='staff-performance')renderFOHStaffPerformancePage();
 else $('fohGuestRelationsHost').innerHTML=fohGuestSatisfactionModuleHTML();
 requestAnimationFrame(()=>{
  auditFOHDesign();
  if(page!=='foh'||!fohModuleTarget||fohModuleTarget.category!==fohCategory)return;
  const target=$(fohModuleTarget.id);if(!target)return;
  fohModuleTarget=null;
  const sticky=document.querySelector('.app-sticky');
  target.style.scrollMarginTop=(Math.max(0,sticky?.getBoundingClientRect().bottom||0)+12)+'px';
  const heading=target.querySelector('.foh-metric-label')||target.querySelector('h2')||target;
  heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'auto'});
 });
}

function formatMetricValue(label,raw){if(typeof raw==='string')return raw;let n=page==='foh'||nonScaled.has(label)?raw:raw*factor(days);if(['Net Sales','Total Discounts','Estimated Waste'].includes(label))return cash(n);return fmt(n)}

function card([label,raw,delta]){let bad=delta.startsWith('+')&&['Labor %','COGS %','P90 Ticket Time','Average Ticket Time','Tickets Over 25 Min','Remakes','Kitchen Labor %','Estimated Waste','Low Stock Ingredients','Excess Stock Ingredients','Food Cost Variance'].includes(label);let comparison=$('compare').value;let suffix=page==='foh'?delta:comparison==='none'?'Comparison off':comparison==='yoy'?'No comparable prior-year data':delta;return `<button class="card metric" data-detail="${label}"><div class="label">${label}</div><div class="metric-number">${formatMetricValue(label,raw)}</div><div class="trend ${bad?'bad':''} ${['none','yoy'].includes(comparison)?'na':''}">${suffix}</div></button>`}

function content(){if(page==='executive')return `<div class="section full">${chart('Guests Served by Hour','Average day',[5,12,40,32,18,25,43,38,19],['11a','12p','1p','2p','3p','4p','5p','6p','7p'])}</div><div class="section equal">${box('Profitability Snapshot','Accounting data required',rows([['COGS','29.1%'],['Labor','31.8%'],['Prime cost','60.9%'],['Overhead','22.3%'],['Operating profit','16.8%']]))}${box('Most Popular Dishes','Units sold',rows([['Tonkotsu Black','318'],['Spicy Chicken Ramen','264'],['JINYA Tonkotsu Original','236'],['Crispy Chicken','188'],['Gyoza','176']]))}</div>`;
if(page==='parkinglot')return `${isLiveView()?'':`<div class="section full">${staffingEfficiencyHTML()}</div>`}<div class="section full" id="employeePerformanceSection"><article class="card employee-performance-card"><div class="head"><h2>Server Performance</h2><span class="section-period">${dashboardPeriodLabel()}</span></div><div class="performance-toolbar"><div class="mode-switch employee-role-switch" role="group" aria-label="Employee roles"><button type="button" id="allServersRole" aria-pressed="true" class="selected">All Roles</button><button type="button" id="serversRole" class="selected" aria-pressed="true" title="Show or hide servers">Server</button><button type="button" id="bartendersRole" class="selected" aria-pressed="true" title="Show or hide bartenders">Bar</button></div><div class="mode-switch" role="group" aria-label="Performance metric units"><button type="button" id="moneyMode" class="selected" aria-pressed="true">AVG $</button><button type="button" id="quantityMode" aria-pressed="false">TOTAL $</button><button type="button" id="shareMode" aria-pressed="false">TOTAL %</button><button type="button" id="guestMode" aria-pressed="false">$ / GUEST</button></div></div><div id="serverTable"></div></article></div>`;
if(page==='kitchen')return `<div class="section">${chart('Ticket Time by Hour','Average minutes',[11,12,14,12,10,13,18,21,16],['11a','12p','1p','2p','3p','4p','5p','6p','7p'])}${box('Kitchen Service Levels','Service targets',rows([['Average ticket time','13.4 min'],['90th percentile','24.6 min','Target: 20 min'],['Completed within target','78%','Target: 90%'],['Tickets over 25 min','31'],['Remakes','9']]))}</div><div class="section equal">${box('Station Performance','Requires kitchen station timestamps',table(['Station','Avg min','On time'],[['Ramen','15.8','73%'],['Appetizers','9.6','91%'],['Grill','14.2','80%'],['Expo','3.8','94%']]))}${box('Returns & Remakes','Reasons to investigate',rows([['Wrong preparation','4'],['Temperature issue','3'],['Missing modifier','2'],['Total remakes','9'],['Attributed cook metrics','Not yet validated','Requires reliable production attribution']]))}</div>`;
return `<div class="section">${box('Ingredient Inventory Watch','Days remaining',rows([['Pork broth','0.8 days','Low stock'],['Fresh noodles','1.2 days','Low stock'],['Bean sprouts','4.9 days','Potential excess'],['Chicken chashu','3.1 days','Within modeled range']])+'<p class="foot">Requires actual counts, recipes, receipts and waste. Aloha sales alone cannot establish on-hand inventory.</p>')}${box('Food Cost & Waste','Cost breakdown',rows([['Theoretical food cost','27.3%'],['Actual food cost','29.1%'],['Variance','+1.8 pts'],['Estimated waste','$628'],['Unverified physical counts','4']]))}</div><div class="section equal">${chart('Estimated Ingredient Demand','Usage index',[28,35,31,45,49,60,58],['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])}${box('Purchasing & Controls','Requires inventory workflow',rows([['Ingredients below reorder point','2'],['Potential excess items','1'],['Next planned count','Tomorrow'],['Last completed count','3 days ago'],['Data confidence','Pending validation']]))}</div>`}

function syncSalesMixTargetTotal(){
 const inputs=[...$('targetFields').querySelectorAll('[data-mix-target]')],total=inputs.reduce((sum,input)=>sum+Number(input.value),0),valid=inputs.every(input=>input.value.trim()!==''&&Number.isFinite(Number(input.value))&&Number(input.value)>=0&&Number(input.value)<=100)&&Math.abs(total-100)<.000001;
 const display=$('salesMixTargetTotal');if(display){display.textContent='Sales Mix total: '+(Number.isFinite(total)?targetPercent(total):'—')+(valid?'':' (must equal 100%)');display.style.color=valid?'#247545':'#b13a45'}
}

function editTargets(){
 const daypart=selectValue('targetDaypart'),salesMixTargets=adminDraft.salesMixTargets,targets=adminDraft.employeeTargets,refundTargets=adminDraft.refundTargets;$('targetFeedback').textContent='';
 $('targetFields').innerHTML='<div id="adminMixTargets" class="admin-target-group"><div class="target-subhead">SALES MIX (%)</div><p class="target-help">Set each category\u2019s share of sales. The five targets must total 100%. All Day blends Lunch and Dinner using sales in the selected filters.</p>'+salesMixTargetCategories.map(([key,label])=>`<label>${label} (%)<input type="number" step="0.1" min="0" max="100" data-mix-target="${key}" value="${salesMixTargets[daypart][key]}"></label>`).join('')+'<div id="salesMixTargetTotal" class="target-total" aria-live="polite"></div></div><div id="adminEmployeeTargets" class="admin-target-group"><div class="target-subhead">EMPLOYEE PERFORMANCE</div><p class="target-help">Dollar targets are averages per closed check. All Day blends Lunch and Dinner using the employee\u2019s check counts.</p>'+[['alcohol','Alcohol ($/check)'],['apps','Small ($/check)'],['dessert','Desserts ($/check)'],['food','Entrées ($/check)'],['drink','Beverages ($/check)'],['check','Check ($/check)'],['duration','Max Table Time (min)']].map(([key,label])=>`<label>${label}<input type="number" step="0.1" min="0" data-target="${key}" value="${targets[daypart][key]}"></label>`).join('')+`<div class="target-subhead">REFUNDS</div><label>Max Avg Refund ($/check)<input type="number" step="0.01" min="0" data-refund-target value="${refundTargets[daypart].toFixed(2)}"></label></div>`;
 for(const input of $('targetFields').querySelectorAll('[data-mix-target]'))input.oninput=syncSalesMixTargetTotal;
 syncSalesMixTargetTotal();syncAdminCategory();
}


function showDetail(title,detail){$('drawerTitle').textContent=title;$('drawerDescription').textContent=detail||'Detailed performance breakdown.';let body=title.includes('Staffing')?table(['Hour','Guests','Server','Host','Bussers'],[['12 PM','18','2','1','1'],['1 PM','40','2','1','1'],['5 PM','49','3','1','1'],['6 PM','44','2','1','1']]):title.includes('Ticket')||title.includes('Kitchen')?table(['Daypart','Average','P90','On time'],[['Lunch','11.2 min','19.1 min','88%'],['Afternoon','10.8 min','17.5 min','91%'],['Dinner','17.9 min','27.8 min','72%']]):title.includes('Inventory')||title.includes('broth')?table(['Ingredient','Days left','Action'],[['Pork broth','0.8','Review order'],['Fresh noodles','1.2','Review order'],['Bean sprouts','4.9','Review overstock']]):title.includes('Server')||title.includes('Employee')||title.includes('Attachment')?table(['Server','Checks','Avg check','App attach'],[['Server A','88','$39.10','25%'],['Server B','79','$34.80','18%'],['Server C','75','$32.60','14%']]):table(['Segment','Value'],[['Lunch','38%'],['Dinner','52%'],['Other','10%']]);$('drawerBody').innerHTML=body;$('drawerwrap').classList.add('show')}

function sidebarDateTime(value){
 const date=value instanceof Date?value:new Date(value);
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',month:'2-digit',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(date);
 const part=type=>parts.find(item=>item.type===type)?.value||'';
 return {date:part('month')+'/'+part('day'),time:part('hour')+':'+part('minute')+' '+part('dayPeriod')};
}

function renderSidebarDateTime(element,value){
 if(!element)return;
 const text=sidebarDateTime(value);element.innerHTML='<span class="sidebar-date">'+text.date+'</span><span class="sidebar-clock">'+text.time+'</span>';
 element.setAttribute('datetime',new Date(value).toISOString());
}

function updateSidebarClock(){renderSidebarDateTime($('sidebarTime'),new Date());renderCurrentRefreshStatus()}

function recordSuccessfulDataUpdate(timestamp,source='synthetic'){
 const date=new Date(timestamp);if(!Number.isFinite(date.getTime()))throw new Error('Invalid data-update timestamp');
 lastDataUpdateAt=date;renderCurrentRefreshStatus();
}


function renderCurrentRefreshStatus(){
 const element=$('sidebarLastUpdate');if(!element)return;
 const floor=page==='foh'&&fohWorkspace==='new'&&newFOHMode==='live';
 const value=floor?lastFloorSourceAt:lastDataUpdateAt;
 if(value){renderSidebarDateTime(element,value);const ageMs=Date.now()-value.getTime();if(ageMs>60000)element.insertAdjacentHTML('beforeend','<span class="status-data-age">(-'+Math.floor(ageMs/60000)+' MIN)</span>')}else{element.textContent='—';element.removeAttribute('datetime')}
 element.title=floor?(lastFloorSourceAt?'Floor source-data timestamp'+(floorRefreshFailed?'; latest attempt failed.':'.'):'Floor source data has not loaded successfully.'):'Last successful dashboard sample-data refresh';
}


function captureDashboardView(){
 const overlay=$('bestSellersOverlay');
 rememberSectionFilters();
 return {gmCategory,fohCategory,fohWorkspace,newFOHMode,staffingWeekStart,salesMixAllDayView,trendDefaultsVersion:61,page,days,sectionViews:JSON.parse(JSON.stringify(sectionViews)),daypart:selectValue('daypart'),population:selectValue('population'),metricMode,employeeRoles:{...employeeRoles},sortServerBy,sortServerDirection,sectionPlanningView:{...sectionPlanningView},fohTrendViews:JSON.parse(JSON.stringify(fohTrendViews)),rankingViews:JSON.parse(JSON.stringify(rankingViews)),sectionTableSort:JSON.parse(JSON.stringify(sectionTableSort)),bestSellersView:{...bestSellersView},itemsOpen:!!overlay&&!overlay.hidden};
}

function persistDashboardView(){try{sessionStorage.setItem(dashboardViewStorageKey,JSON.stringify(captureDashboardView()))}catch(error){/* In-memory selections still survive automatic refreshes when storage is unavailable. */}}

function restoreFilterSet(target,saved,history=false){
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return;
 if(['all','lunch','dinner'].includes(saved.daypart))target.daypart=saved.daypart;
 if(['onfloor','worked','active'].includes(saved.population))target.population=saved.population==='worked'?'active':saved.population;
 if(typeof saved.filtersOpen==='boolean')target.filtersOpen=saved.filtersOpen;
 const period=parseDashboardPeriod(saved.historyDays);if(history&&period!==null)target.historyDays=period;
}

function restoreDashboardView(){
 let view;try{view=JSON.parse(sessionStorage.getItem(dashboardViewStorageKey)||'null')}catch(error){return false}
 if(!view||typeof view!=='object')return false;
 // FOH now has one historical workspace; retain its saved historical filters.
 fohWorkspace='old';newFOHMode='history';
 if(Object.hasOwn(names,view.page))page=view.page;
 if(['overview','operations','tbd'].includes(view.gmCategory))gmCategory=view.gmCategory;
 if(['overview','staff-performance','guest-relations'].includes(view.fohCategory))fohCategory=view.fohCategory;
 if(view.sectionViews&&typeof view.sectionViews==='object'){
  for(const section of Object.keys(names)){
   const saved=view.sectionViews[section];if(!saved||typeof saved!=='object')continue;
   if(['live','history'].includes(saved.mode))sectionViews[section].mode=saved.mode;
   if(saved.liveFilters||saved.historyFilters){
    restoreFilterSet(sectionViews[section].liveFilters,saved.liveFilters);
    restoreFilterSet(sectionViews[section].historyFilters,saved.historyFilters,true);
   }else{
    // Migrate the known active selection; give the other mode independent defaults.
    restoreFilterSet(activeFilters(section),saved,!isLiveView(section));
    const period=parseDashboardPeriod(saved.historyDays);if(period!==null)sectionViews[section].historyFilters.historyDays=period;
   }
  }
 }else{
  restoreFilterSet(activeFilters(),view,!isLiveView());
  const period=parseDashboardPeriod(view.days);if(period!==null)sectionViews[page].historyFilters.historyDays=period;
 }
 applySectionView();
 if(['money','quantity','share','guest'].includes(view.metricMode))metricMode=view.metricMode;
 for(const role of ['server','bartender'])if(typeof view.employeeRoles?.[role]==='boolean')employeeRoles[role]=view.employeeRoles[role];
 if(serverColumns.some(([key])=>key===view.sortServerBy))sortServerBy=view.sortServerBy;
 if(view.sortServerDirection===1||view.sortServerDirection===-1)sortServerDirection=view.sortServerDirection;
 if(sectionPlanningGroups.some(group=>group.key===view.sectionPlanningView?.group))sectionPlanningView.group=view.sectionPlanningView.group;
 const items=view.bestSellersView;
 if(items&&typeof items==='object'){
  if(['all',...bestSellerCategories.map(([key])=>key)].includes(items.category))bestSellersView.category=items.category;
  if(['all','core','tail','zero'].includes(items.tier))bestSellersView.tier=items.tier;
  if(typeof items.query==='string')bestSellersView.query=items.query.slice(0,200);
 }
 if(typeof view.staffingWeekStart==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(view.staffingWeekStart)&&view.staffingWeekStart>=DEMO_START&&view.staffingWeekStart<=DEMO_TODAY)staffingWeekStart=mondayOf(view.staffingWeekStart);
 restoreFOHTrends(view.fohTrendViews);if(view.trendDefaultsVersion!==61)fohTrendViews.employee.metric='alcoholMix';restoreRankings(view.rankingViews);restoreSectionTableSort(view.sectionTableSort);if(['blended','dayparts'].includes(view.salesMixAllDayView))salesMixAllDayView=view.salesMixAllDayView;return view.itemsOpen===true;
}


async function loadDashboardSnapshot(){
 // The prototype reads its local synthetic records. A live implementation must
 // return only after its read-only data fetch succeeds, with the source update time.
 return {checks,losses,updatedAt:new Date(),source:'synthetic'};
}

async function refreshDashboardData(){
 if(dashboardRefreshInProgress)return false;
 dashboardRefreshInProgress=true;
 try{
  const snapshot=await loadDashboardSnapshot();
  if(!snapshot||!Array.isArray(snapshot.checks)||!Array.isArray(snapshot.losses))throw new Error('Dashboard data refresh did not complete');
  const updateDate=new Date(snapshot.updatedAt);if(!Number.isFinite(updateDate.getTime()))throw new Error('Missing successful data-update time');
  // Capture the latest interaction state after the request completes. User
  // selections made while a request is pending must take precedence.
  const main=document.querySelector('.main'),mainScroll=main?.scrollTop,documentScroll=document.scrollingElement?.scrollTop;
  const overlay=$('bestSellersOverlay'),itemsBody=overlay?.querySelector('.items-body'),itemsScroll=itemsBody?.scrollTop;
  const focus=document.activeElement,focusId=focus?.id;
  render();
  if(page==='foh'&&fohWorkspace==='new'&&newFOHMode==='live')refreshLiveFloorModule();
  if(main&&Number.isFinite(mainScroll))main.scrollTop=mainScroll;if(document.scrollingElement&&Number.isFinite(documentScroll))document.scrollingElement.scrollTop=documentScroll;
  if(itemsBody&&Number.isFinite(itemsScroll))itemsBody.scrollTop=itemsScroll;
  if(focusId&&document.activeElement!==focus){const replacement=$(focusId);if(replacement)replacement.focus({preventScroll:true})}
  recordSuccessfulDataUpdate(updateDate,snapshot.source);persistDashboardView();return true;
 }catch(error){
  const element=$('sidebarLastUpdate');if(page==='foh'&&fohWorkspace==='new'&&newFOHMode==='live')renderCurrentRefreshStatus();else if(element)element.title='Last successful refresh shown. The most recent refresh did not complete.';
  console.warn('Dashboard data refresh failed; current view retained.',error);return false;
 }finally{dashboardRefreshInProgress=false}
}

function initializeDashboard(){
 const reopenItems=restoreDashboardView();
 const gmLink=location.hash.match(/^#gm-(overview|operations|tbd)$/);
 if(gmLink){page='executive';gmCategory=gmLink[1]}
 const moduleLink=fohOverviewDestination(location.hash);
 if(moduleLink){page='foh';fohCategory=moduleLink.category;fohModuleTarget=moduleLink}
 applySectionView();render();installTrendResize();if(reopenItems)openBestSellersWindow();
 recordSuccessfulDataUpdate(new Date(),'synthetic');updateSidebarClock();persistDashboardView();
 setInterval(updateSidebarClock,1000);setInterval(refreshDashboardData,dashboardRefreshIntervalMs);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateSidebarClock();if(page==='foh'&&fohWorkspace==='new'&&newFOHMode==='live')refreshLiveFloorModule()}});
 window.addEventListener('pagehide',persistDashboardView);
}


function render(){
 for(const domain of ['mix','food','employee','section']){const list=$('trend-'+domain+'-choices');if(list)trendScrollPositions[domain]=list.scrollTop||0}
 rememberSectionFilters();syncDashboardControls();
 const historyFOH=page==='foh'&&!isLiveView(),parking=page==='parkinglot';
 document.documentElement.dataset.section=page;document.body.dataset.section=page;
 $('title').textContent=names[page];$('roleNote').textContent='';
 renderFOHCategory();renderGMCategory();
 const gmTBD=page==='executive'&&gmCategory==='tbd';
 const blankGM=page==='executive'&&!gmTBD;
 $('legacyDashboardModules').hidden=historyFOH||blankGM||(page==='executive'&&gmMountedCategory!=='tbd');
 document.querySelector('.demo-footer').hidden=blankGM;
 $('managementAttention').hidden=historyFOH||parking||blankGM;
 $('alerts').innerHTML=(page==='foh'?computedFOHAlerts():(alerts[page]||[])).map(a=>`<button class="alert" data-alert="${a[3]}"><span class="tag">${a[0]}</span><strong>${a[1]}</strong><small>${a[2]}</small></button>`).join('');
 $('primaryTitle').innerHTML='TOTALS<span class="section-period">'+dashboardPeriodLabel()+'</span>';
 $('dailyTitle').innerHTML='AVG PER DAY<span class="section-period">'+dashboardPeriodLabel()+'</span>';
 $('cards').innerHTML=parking?fohMetricCards(false):page==='foh'||blankGM?'':(metrics[page]||[]).map(card).join('');
 $('cards').style.display=page==='foh'?'none':'grid';
 $('dailyTitle').style.display=parking?'flex':'none';$('dailyCards').style.display=parking?'grid':'none';
 $('dailyCards').innerHTML=parking?fohMetricCards(true):'';
 $('cards').classList.toggle('foh-primary',parking);$('dailyCards').classList.toggle('foh-primary',parking);
 $('primaryTitle').style.display=parking?'flex':'none';
 $('content').innerHTML=page==='foh'||blankGM?'':parking?fohGroupedContent():content();
 const composition=parking||gmTBD?compositionHTML():null;
 $('salesMixSection').hidden=!gmTBD;$('salesMixSection').innerHTML=gmTBD?composition.salesMix:'';
 $('fohGroup-mix').hidden=!gmTBD;$('fohGroup-upselling').hidden=!parking;$('upsellingHost').innerHTML=parking?composition.upselling:'';
 $('fohControls').style.display='block';
 $('trendHost-mix').hidden=!gmTBD||isLiveView();if($('trendHost-mix').hidden)$('trendHost-mix').innerHTML='';
 $('populationNote').textContent=parking?'Employees filters employee tables and Server Trends. Restaurant sales, menu and section totals include all employees.':'';
 if(parking){
  bindStaffingModule();syncEmployeeRoles();syncMetricMode();renderServerTable();
  syncSectionPlanningControls();renderFOHTrends();renderRankings();renderOperations();
  const allItems=$('viewAllItems');if(allItems)allItems.onclick=openBestSellersWindow;
 }
 if(gmTBD){bindSalesMixControls();if(!isLiveView())renderFOHTrend('mix')}
 renderBestSellersWindow();
 document.querySelectorAll('[data-alert]').forEach(b=>b.onclick=()=>usesFOHData()?showFOHDetail(b.dataset.alert):showDetail(b.dataset.alert));
 document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>usesFOHData()?showFOHDetail(b.dataset.detail):showDetail(b.dataset.detail));
 document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 persistDashboardView();
}

function computedFOHAlerts(){
 const cs=selectedFOHChecks(),summary=summarizeSectionChecks(cs),reference=referenceSalesMixTargets(cs),out=[];
 if(cs.length<30)return [['Info','Building the service sample',cs.length+' closed checks; target comparisons remain neutral below 30 checks.','Server Performance']];
 if(reference.available)for(const key of ['alcohol','apps','dessert']){
  const actual=summary.grossCents?100*cs.reduce((sum,c)=>sum+c.items.filter(i=>i.category===key).reduce((s,i)=>s+Math.round(i.price*100),0),0)/summary.grossCents:0,target=reference.targets[key];
  if(target>0&&actual<target*.9)out.push(['Review',salesMixTargetCategories.find(c=>c[0]===key)[1]+' mix below target',actual.toFixed(1)+'% actual / '+target.toFixed(1)+'% target; review alongside dollars per guest.','Sales Mix']);
 }
 const stats=fohStats(),weights={lunch:cs.filter(c=>c.daypart==='lunch').length/cs.length,dinner:cs.filter(c=>c.daypart==='dinner').length/cs.length},refundGoal=refundTargets.lunch*weights.lunch+refundTargets.dinner*weights.dinner;
 if(stats.refunds/cs.length>refundGoal)out.push(['Review','Refunds above configured limit',cash(stats.refunds/cs.length)+' per check / '+cash(refundGoal)+' limit. Review causes.','Refunds']);
 return out.length?out:[['Info','No configured exceptions',cs.length+' closed checks reviewed. Kitchen, waitlist and live labor alerts require connected data.','Server Performance']];
}


function showFOHDetail(title){
 if(title==='Sales Mix'){const el=$('salesMixSection');if(el?.scrollIntoView)el.scrollIntoView({block:'start'});return}
 if(title==='Server Performance'){const el=$('employeePerformanceSection');if(el?.scrollIntoView)el.scrollIntoView({block:'start'});return}
 $('drawerTitle').textContent=title;$('drawerDescription').textContent='All employees within the selected report dates and shift.';
 if(title==='Refunds')$('drawerBody').innerHTML=lossAnalysisHTML();else{
  const cs=selectedFOHChecks();$('drawerBody').innerHTML=table(['Shift','Checks','Guests','Gross Sales','Refunds','Comps','Net Sales'],['lunch','dinner'].map(part=>{const records=cs.filter(c=>c.daypart===part),ids=new Set(records.map(c=>c.id)),summary=summarizeSectionChecks(records),ls=losses.filter(l=>ids.has(l.checkId)),refunds=ls.filter(l=>l.type==='Refund').reduce((s,l)=>s+l.amount,0),comps=ls.filter(l=>l.type==='Comp').reduce((s,l)=>s+l.amount,0);return [part==='lunch'?'Lunch':'Dinner',records.length,summary.guests,cash(summary.grossCents/100),cash(refunds),cash(comps),cash(summary.grossCents/100-refunds-comps)]}));
 }
 $('drawerwrap').classList.add('show');
}

function validateDashboardColors(colors){if(!colors||typeof colors!=='object')throw Error('Invalid color settings.');const result={};for(const key of Object.keys(dashboardColorDefaults)){const value=colors[key]===undefined&&['fohSubhead','siteBackground'].includes(key)?dashboardColorDefaults[key]:colors[key];if(typeof value!=='string'||!/^#[0-9A-Fa-f]{6}$/.test(value))throw Error('Enter a six-digit hex color, including #, for every field.');result[key]=value.toUpperCase()}return result}

function colorShade(hex,white=.87){const values=[1,3,5].map(index=>Math.round(parseInt(hex.slice(index,index+2),16)*(1-white)+255*white));return '#'+values.map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase()}

function colorNavTint(hex){return '#'+[1,3,5].map((i,n)=>Math.min(255,parseInt(hex.slice(i,i+2),16)+[48,48,50][n]).toString(16).padStart(2,'0')).join('').toUpperCase()}

function colorNavActive(hex){return '#'+[1,3,5].map((i,n)=>Math.max(0,parseInt(hex.slice(i,i+2),16)-[44,46,32][n]).toString(16).padStart(2,'0')).join('').toUpperCase()}

function colorDeepen(hex){return '#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.72).toString(16).padStart(2,'0')).join('').toUpperCase()}

function colorInk(hex){const [r,g,b]=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));return r*.299+g*.587+b*.114>155?'#243441':'#FFFFFF'}

function applyDashboardColors(){
 // Migrate known previous-theme defaults in memory; save only through Admin UPDATE.
 if(dashboardColors.siteBackground.toUpperCase()==='#E2E2E2')dashboardColors.siteBackground='#181A1C';
 if(dashboardColors.fohHeader.toUpperCase()==='#626B2F')dashboardColors.fohHeader='#42AAFF';
 const readable=hex=>colorInk(hex)==='#FFFFFF'?colorShade(hex,.35):hex;
 const rules=[`:root{--bg:${dashboardColors.siteBackground};--border:var(--line)}`];
 for(const [section,key] of [['foh','fohHeader'],['executive','executiveHeader'],['kitchen','kitchenHeader'],['inventory','inventoryHeader']])rules.push(`body[data-section="${section}"]{--accent:${readable(dashboardColors.fohHeader)};--section:${dashboardColors[key]}}`);
 for(const key of ['mix','food','server','section','staffing','operations'])rules.push(`.foh-group.${key}-group{--group-color:${readable(dashboardColors[key])};--group-tint:var(--accent-tint);--group-text:${readable(dashboardColors[key])}}.foh-group.${key}-group>.foh-group-banner{color:var(--group-color)}`);
 $('dashboardColorTheme').textContent=rules.join('\n');
}


function adminColorFields(){
 const colors=adminDraft.colors;
 const row=(key,label)=>`<label class="admin-color-field"><span>${escapeHTML(label)}</span><span class="admin-color-inputs"><input type="color" value="${colors[key]}" data-theme-picker="${key}" aria-label="${escapeHTML(label)} color picker"><input type="text" value="${colors[key]}" data-theme-hex="${key}" maxlength="7" spellcheck="false" aria-label="${escapeHTML(label)} hex code"></span></label>`;
 $('adminColorFields').innerHTML='<h4>Site</h4>'+row('siteBackground','Site background')+'<h4>FOH</h4>'+[['fohHeader','Header'],['fohSubhead','Subheads'],['mix','Sales Mix / Upselling'],['food','Food'],['server','Server'],['section','Sections'],['staffing','Staffing'],['operations','Promotions & Records']].map(([key,label])=>row(key,label)).join('')+'<h4>Other dashboard headers</h4>'+[['executiveHeader','General Manager'],['kitchenHeader','Kitchen Operations'],['inventoryHeader','Inventory & Costs']].map(([key,label])=>row(key,label)).join('');
 const host=$('adminColorFields'),hexes=[...host.querySelectorAll('[data-theme-hex]')],pickers=[...host.querySelectorAll('[data-theme-picker]')];
 for(const input of hexes)input.oninput=()=>{if(/^#[0-9A-Fa-f]{6}$/.test(input.value)){pickers.find(p=>p.dataset.themePicker===input.dataset.themeHex).value=input.value;$('adminColorFeedback').textContent='Click UPDATE to apply changes.'}};
 for(const picker of pickers)picker.oninput=()=>{hexes.find(input=>input.dataset.themeHex===picker.dataset.themePicker).value=picker.value.toUpperCase();$('adminColorFeedback').textContent='Click UPDATE to apply changes.'};
 $('adminColorFeedback').textContent=dashboardColorWarning;
}

function resetDashboardColorFields(){for(const input of $('adminColorFields').querySelectorAll('[data-theme-hex]'))input.value=dashboardColorDefaults[input.dataset.themeHex];for(const picker of $('adminColorFields').querySelectorAll('[data-theme-picker]'))picker.value=dashboardColorDefaults[picker.dataset.themePicker];$('adminColorFeedback').textContent='Defaults loaded. Click UPDATE to apply.'}


function salesMixDaypartData(records=selectedFOHChecks()){
 const groups={lunch:{checks:0,total:0,categories:{}},dinner:{checks:0,total:0,categories:{}}};
 for(const check of records){const group=groups[check.daypart];if(!group)continue;group.checks++;for(const item of check.items){const cents=Math.round(item.price*100);group.total+=cents;group.categories[item.category]=(group.categories[item.category]||0)+cents}}
 const rows=salesMixTargetCategories.map(([key,label])=>{const part=name=>({actual:groups[name].total?(groups[name].categories[key]||0)/groups[name].total*100:null,target:salesMixTargets[name][key]});const lunch=part('lunch'),dinner=part('dinner');return {key,label,lunch,dinner,difference:lunch.actual===null||dinner.actual===null?null:dinner.actual-lunch.actual}});
 return {groups,rows};
}

function salesMixChartHTML(metrics,hasCurrent,hasPrevious,mixReference){
 const eligible=page==='executive'&&!isLiveView()&&selectValue('daypart')==='all';
 const controls=eligible?`<div class="sales-mix-view-controls"><span>Shift view</span><div class="mode-switch" role="group" aria-label="Sales Mix shift presentation"><button type="button" data-sales-mix-view="blended" aria-pressed="${salesMixAllDayView==='blended'}" class="${salesMixAllDayView==='blended'?'selected':''}">Blended</button><button type="button" data-sales-mix-view="dayparts" aria-pressed="${salesMixAllDayView==='dayparts'}" class="${salesMixAllDayView==='dayparts'?'selected':''}">Lunch vs. Dinner</button></div></div>`:'';
 return controls+(eligible&&salesMixAllDayView==='dayparts'?salesMixDaypartHTML():blendedSalesMixChartHTML(metrics,hasCurrent,hasPrevious,mixReference));
}

function bindSalesMixControls(){
 for(const button of $('salesMixSection').querySelectorAll('[data-sales-mix-view]'))button.onclick=()=>{salesMixAllDayView=button.dataset.salesMixView;$('salesMixSection').innerHTML=compositionHTML().salesMix;bindSalesMixControls();persistDashboardView()};
}

function salesMixDaypartHTML(){
 const {groups,rows}=salesMixDaypartData();
 if(!groups.lunch.checks&&!groups.dinner.checks)return '<article class="card sales-mix-card" aria-labelledby="salesMixTitle"><div class="empty">No sales match these filters.</div></article>';
 function cells(row,part){
  const value=row[part],driver=['alcohol','apps','dessert'].includes(row.key),status=value.actual===null||!driver?'neutral':performanceClass(value.actual,'sales',value.target);
  const maximum=Math.min(100,Math.max(5,Math.ceil(Math.max(row.lunch.actual||0,row.dinner.actual||0,row.lunch.target,row.dinner.target)*1.15/5)*5));
  return `<td class="daypart-result sales-mix-value-text ${status} ${part==='dinner'?'dinner-start':''}">${value.actual===null?'—':Math.round(value.actual)+'%'}</td><td class="daypart-target-value" data-target-daypart="${part}" data-target-category="${row.key}" data-target="${value.target}">${targetPercent(value.target)}</td><td>${value.actual===null?'<span class="daypart-no-sales">No sales</span>':`<div class="sales-mix-track daypart-standalone-track" data-scale-max="${maximum}" role="img" aria-label="${row.label}, ${part}: ${value.actual.toFixed(1)}% actual, ${targetPercent(value.target)} target; scale 0 to ${maximum}%"><span class="sales-mix-bar ${status}" style="width:${Math.max(0,Math.min(100,value.actual/maximum*100))}%" aria-hidden="true"></span><span class="sales-mix-target" style="left:${value.target/maximum*100}%" aria-hidden="true"></span></div><div class="daypart-row-scale"><span>0%</span><span>${maximum}%</span></div>`}</td>`
 }

 return `<article class="card sales-mix-card" aria-labelledby="salesMixTitle"><div class="sales-mix-key"><span><i class="actual-key" aria-hidden="true"></i>Actual share of each shift’s sales</span><span><i class="target-key" aria-hidden="true"></i>Shift target</span></div><div class="sales-mix-scroll"><table class="sales-mix-table paired-daypart-table" aria-label="Lunch and Dinner side by side by category"><colgroup><col class="paired-category"><col class="paired-number"><col class="paired-number"><col><col class="paired-number"><col class="paired-number"><col></colgroup><thead><tr class="paired-daypart-groups"><th scope="col" rowspan="2">Category</th><th scope="colgroup" colspan="3">LUNCH <small>${groups.lunch.checks.toLocaleString('en-US')} checks</small></th><th scope="colgroup" colspan="3" class="dinner-start">DINNER <small>${groups.dinner.checks.toLocaleString('en-US')} checks</small></th></tr><tr><th scope="col">Result</th><th scope="col">Target</th><th scope="col" class="sales-mix-scale-heading">Chart</th><th scope="col" class="dinner-start">Result</th><th scope="col">Target</th><th scope="col" class="sales-mix-scale-heading">Chart</th></tr></thead><tbody>${rows.map(row=>`<tr data-sales-category="${row.label}"><th scope="row">${row.label}</th>${cells(row,'lunch')}${cells(row,'dinner')}</tr>`).join('')}</tbody></table></div><p class="sales-mix-foot">${dashboardPeriodLabel()}. Lunch and Dinner use their own sales and independent Admin targets. Each category’s two charts share a scale; scales vary by category to reveal smaller differences. Revenue excludes tax and tips; Beverages excludes alcohol.</p></article>`;
}

function adminSettingsSnapshot(){return {format:'jinya-admin-settings',schema:1,exportedAt:new Date().toISOString(),salesMixTargets:JSON.parse(JSON.stringify(salesMixTargets)),employeeTargets:JSON.parse(JSON.stringify(targets)),refundTargets:{...refundTargets},colors:{...dashboardColors},serverAlcoholGoal:operationalData.alcoholGoal,fohAlertThresholds:{...fohAlertThresholds}}}

function validateAdminSettings(data){
 if(!data||data.format!=='jinya-admin-settings'||data.schema!==1)throw Error('Choose a JINYA settings file (version 1).');
 const result={salesMixTargets:{},employeeTargets:{},refundTargets:{},colors:validateDashboardColors(data.colors),serverAlcoholGoal:data.serverAlcoholGoal,fohAlertThresholds:{...defaultFOHAlertThresholds,...data.fohAlertThresholds}};
 if(data.fohAlertThresholds!==undefined&&(!data.fohAlertThresholds||typeof data.fohAlertThresholds!=='object'||Array.isArray(data.fohAlertThresholds)))throw Error('Invalid FOH thresholds.');
 for(const key of Object.keys(defaultFOHAlertThresholds))if(!Number.isInteger(result.fohAlertThresholds[key])||result.fohAlertThresholds[key]<1||result.fohAlertThresholds[key]>240)throw Error('Alert thresholds must be whole numbers from 1 to 240 minutes.');
 if(!Number.isFinite(result.serverAlcoholGoal)||result.serverAlcoholGoal<0||result.serverAlcoholGoal>100)throw Error('Invalid server alcohol goal.');
 for(const part of ['lunch','dinner']){
  if(!validSalesMixProfile(data.salesMixTargets?.[part]))throw Error(part+' Sales Mix targets must total 100%.');
  result.salesMixTargets[part]=Object.fromEntries(salesMixTargetCategories.map(([key])=>[key,data.salesMixTargets[part][key]]));
  result.employeeTargets[part]={};for(const key of Object.keys(defaults[part])){const value=data.employeeTargets?.[part]?.[key];if(!Number.isFinite(value)||value<=0)throw Error('Invalid '+part+' employee target: '+key);result.employeeTargets[part][key]=value}
  const refund=data.refundTargets?.[part];if(!Number.isFinite(refund)||refund<0)throw Error('Invalid refund target.');result.refundTargets[part]=refund;
 }
 return result;
}

function applySettingsMemory(data){const next=validateAdminSettings(data);salesMixTargets=next.salesMixTargets;targets=next.employeeTargets;refundTargets=next.refundTargets;dashboardColors=next.colors;fohAlertThresholds=next.fohAlertThresholds;operationalData={...operationalData,alcoholGoal:next.serverAlcoholGoal};applyDashboardColors();syncFloorState()}

async function persistAdminFile(){throw Error('This review dashboard is read-only.');}

async function saveAdminFileAction(action,feedbackId,button){
 const feedback=$(feedbackId);if(button)button.disabled=true;
 try{if(action()===false)return false;await persistAdminFile();feedback.textContent='Saved to settings.json.';return true}
 catch(error){if(lastSavedSettings){applySettingsMemory(lastSavedSettings);render()}feedback.textContent='NOT SAVED: '+error.message;return false}
 finally{if(button)button.disabled=false}
}

async function startPersistentDashboard(){
 try{
  if(!/^https?:$/.test(location.protocol))throw Error('Start server.py, then open http://localhost:8765.');
  const response=await fetch('review-settings.json',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'Cannot load settings.json.');
  applySettingsMemory(data);settingsRevision=null;lastSavedSettings=data;initializeDashboard();$('sidebarTargets').hidden=true;$('updateAdmin').disabled=true;

 }catch(error){$('sidebarTargets').disabled=true;$('cards').style.display='grid';$('cards').innerHTML='<article class="card"><h2>Settings could not be loaded</h2><p>'+escapeHTML(error.message)+'</p><p>Check the server terminal and reload this page.</p></article>';console.error(error)}
}

function captureAdminTargetDraft(){
 if(!adminDraft||!adminEditingDaypart)return;
 const part=adminEditingDaypart,read=input=>input.value.trim()===''?NaN:Number(input.value);
 for(const input of $('targetFields').querySelectorAll('[data-mix-target]'))adminDraft.salesMixTargets[part][input.dataset.mixTarget]=read(input);
 for(const input of $('targetFields').querySelectorAll('[data-target]'))adminDraft.employeeTargets[part][input.dataset.target]=read(input);
 const refund=$('targetFields').querySelector('[data-refund-target]');if(refund)adminDraft.refundTargets[part]=read(refund);
}

function openAdmin(){
 return;
 if(adminSaving)return;adminDraft=adminSettingsSnapshot();$('targetDaypart').value=selectValue('daypart')==='lunch'?'lunch':'dinner';adminEditingDaypart=selectValue('targetDaypart');$('targetModal').hidden=false;editTargets();adminColorFields();$('adminUpdateFeedback').textContent='';$('waitlistAlertMinutes').value=adminDraft.fohAlertThresholds.waitlistMinutes;$('pickupAlertMinutes').value=adminDraft.fohAlertThresholds.pickupMinutes;$('mealWaitAlertMinutes').value=adminDraft.fohAlertThresholds.mealWaitMinutes;selectAdminCategory(['executive','foh','kitchen','inventory'].includes(page)?page:'foh');
}

function cancelAdmin(){if(adminSaving)return;adminDraft=null;adminEditingDaypart=null;$('targetModal').hidden=true}

function changeAdminDaypart(){captureAdminTargetDraft();adminEditingDaypart=selectValue('targetDaypart');editTargets()}

async function updateAdmin(){
 if(adminSaving)return false;
 try{
  captureAdminTargetDraft();
  for(const [key,id] of [['waitlistMinutes','waitlistAlertMinutes'],['pickupMinutes','pickupAlertMinutes'],['mealWaitMinutes','mealWaitAlertMinutes']]){const text=$(id).value.trim();adminDraft.fohAlertThresholds[key]=text===''?NaN:Number(text)}
  adminDraft.colors=Object.fromEntries([...$('adminColorFields').querySelectorAll('[data-theme-hex]')].map(input=>[input.dataset.themeHex,input.value.trim()]));
  validateAdminSettings(adminDraft);const snapshot=JSON.parse(JSON.stringify(adminDraft));snapshot.exportedAt=new Date().toISOString();
  adminSaving=true;$('updateAdmin').disabled=true;$('closeTargets').disabled=true;$('targetDaypart').disabled=true;$('adminUpdateFeedback').textContent='Updating…';
  await persistAdminFile(snapshot);
  applySettingsMemory(lastSavedSettings);dashboardColorWarning='';render();adminDraft=null;adminEditingDaypart=null;$('targetModal').hidden=true;return true;
 }catch(error){$('adminUpdateFeedback').textContent='NOT UPDATED: '+error.message;return false}
 finally{adminSaving=false;$('updateAdmin').disabled=false;$('closeTargets').disabled=false;$('targetDaypart').disabled=false}
}

function selectOriginalMode(mode){setFloorNavOpen(false);if(!setDashboardMode(mode))render()}

function syncFOHWorkspaces(){
 const foh=usesFOHData()||page==='executive';fohWorkspace='old';newFOHMode='history';
 document.body.dataset.fohWorkspace='old';document.body.dataset.newFohMode='history';
 $('newFOHLiveModule').hidden=true;$('fohLivePages').hidden=true;
 syncLiveFloorVisibility(false);renderCurrentRefreshStatus();
 $('sectionViewToggle').hidden=foh;
 $('newLiveView').hidden=true;$('newHistoryView').hidden=true;
 $('liveView').hidden=foh;$('historyView').hidden=foh;
 $('liveView').innerHTML='<span class="view-live-dot" aria-hidden="true"></span>Live';$('historyView').textContent='History';
 $('liveView').setAttribute('aria-pressed',String(isLiveView()));$('historyView').setAttribute('aria-pressed',String(!isLiveView()));
}

function syncLiveFloorVisibility(active){const previouslyMounted=liveFloorMounted;if(active){ensureLiveFloorModule();if(!liveFloorWasVisible&&previouslyMounted)refreshLiveFloorModule()}liveFloorWasVisible=active}

function ensureLiveFloorModule(){if(liveFloorMounted)return;liveFloorMounted=true;$('newFOHLiveFrame').srcdoc=LIVE_FLOOR_DOCUMENT.replace('__WAITLIST_THRESHOLD__',String(fohAlertThresholds.waitlistMinutes)).replace('__PICKUP_THRESHOLD__',String(fohAlertThresholds.pickupMinutes)).replace('__MEAL_WAIT_THRESHOLD__',String(fohAlertThresholds.mealWaitMinutes)).replace('__FOH_SUBHEAD_COLOR__',dashboardColors.fohSubhead).replace('__FOH_SUBHEAD_INK__',colorInk(dashboardColors.fohSubhead)).replace('__SITE_BACKGROUND__',dashboardColors.siteBackground)}

function refreshLiveFloorModule(){if(liveFloorMounted)$('newFOHLiveFrame').contentWindow?.postMessage({type:'jinya-floor-refresh'},location.origin)}

function syncFloorState(){if(liveFloorMounted)$('newFOHLiveFrame').contentWindow?.postMessage({type:'jinya-floor-state',page:fohLivePage,...fohAlertThresholds,theme:{fohSubhead:dashboardColors.fohSubhead,siteBackground:dashboardColors.siteBackground}},location.origin)}

function selectFloorPage(value){fohLivePage=['seating','guest'].includes(value)?value:'attention';for(const b of document.querySelectorAll('[data-floor-page]'))b.setAttribute('aria-pressed',String(b.dataset.floorPage===fohLivePage));syncFloorState()}

function setFloorNavOpen(open){document.body.classList.toggle('floor-nav-open',open);$('floorMenuButton').setAttribute('aria-expanded',String(open));if(open)$('floorNavClose').focus()}

function syncAdminCategory(){
 const targets=['executive','foh'].includes(adminCategory);
 $('adminTargetsPanel').hidden=!targets;$('adminThresholdPanel').hidden=adminCategory!=='foh';$('adminDashboardPanel').hidden=adminCategory!=='dashboard';$('adminEmptyCategory').hidden=targets||adminCategory==='dashboard';
 if($('adminMixTargets'))$('adminMixTargets').hidden=adminCategory!=='executive';if($('adminEmployeeTargets'))$('adminEmployeeTargets').hidden=adminCategory!=='foh';
 $('adminCategoryLabel').textContent=adminCategoryNames[adminCategory];for(const b of document.querySelectorAll('[data-admin-category]'))b.setAttribute('aria-pressed',String(b.dataset.adminCategory===adminCategory));
}

function selectAdminCategory(value){if(!Object.hasOwn(adminCategoryNames,value))return;adminCategory=value;syncAdminCategory();$('adminCategoryNav').classList.remove('is-open');$('adminCategoryToggle').setAttribute('aria-expanded','false')}




function syncMidnightHeader(){
 $('headerShift').hidden=!['foh','parkinglot','executive'].includes(page);
 $('headerEmployees').hidden=!usesFOHData();$('headerPeriod').hidden=isLiveView();
 $('fohModuleNav').hidden=!usesFOHData()&&page!=='executive';
 $('fohModuleNav').setAttribute('aria-label',names[page]+' modules');
 const links=[...document.querySelectorAll('[data-module-dashboard]')];
 links.forEach(link=>link.hidden=link.dataset.moduleDashboard!==page);
 const visible=links.filter(link=>!link.hidden);
 if(page==='foh')for(const link of visible){const active=link.dataset.fohCategory===fohCategory;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}
 else if(page==='executive')for(const link of visible){const active=link.dataset.gmCategory===gmCategory;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}
 else if(!visible.some(link=>link.classList.contains('active')))links.forEach(link=>link.classList.toggle('active',link===visible[0]));
}

function setDashboardDrawer(open,restoreFocus=true){
 open=!!open;
 if(open&&!dashboardDrawerOpen)dashboardDrawerPreviousFocus=document.activeElement;
 dashboardDrawerOpen=open;
 const root=$('dashboardMenu'),button=$('dashboardMenuButton');
 root.classList.toggle('is-open',open);root.inert=!open;root.setAttribute('aria-hidden',String(!open));
 document.body.classList.toggle('dashboard-drawer-open',open);document.documentElement.classList?.toggle('dashboard-drawer-open',open);
 button.setAttribute('aria-expanded',String(open));
 if(open)$('dashboardDrawerClose').focus({preventScroll:true});
 else if(restoreFocus){const previous=dashboardDrawerPreviousFocus;const destination=previous&&previous.isConnected&&!root.contains(previous)?previous:button;destination.focus({preventScroll:true});dashboardDrawerPreviousFocus=null}
}
