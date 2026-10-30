/* JINYA v0138 — Shared data, target policies, calculations, feature state, event bindings and application startup. Keep initialization statements in order; loaded after the category function files. */

// One-sided policy: green meets/beats goal; yellow is a small miss. Bands use percentage points for
// the named percentage KPIs; other performance measures use 10% of target.
const kpiColorRules=Object.freeze({
 labor:{band:.5,direction:'lower'},staffing:{band:3,direction:'higher'},
 turnover:{band:3,direction:'lower'},attendance:{band:2,direction:'higher'},guestSatisfaction:{band:2,direction:'higher'},
 performance:{relativeBand:.10,direction:'higher'}
});

function kpiTargetStatus(value,target,rule='performance'){
 if(value===null||value===undefined||target===null||target===undefined||!Number.isFinite(value)||!Number.isFinite(target))return 'neutral';
 const config=typeof rule==='string'?kpiColorRules[rule]:rule;
 if(!config)return 'neutral';
 const band=config.band??Math.abs(target)*(config.relativeBand??.10);
 if(!Number.isFinite(band)||band<0)return 'neutral';
 // Yellow applies only to a miss. Meeting or beating goal is always green.
 const miss=config.direction==='lower'?value-target:target-value;
 if(miss<=0)return 'green';
 return miss<=band+1e-9?'yellow':'red';
}

function kpiTargetClass(value,target,rule){return 'kpi-'+kpiTargetStatus(value,target,rule)}

function kpiPerformanceClass(value,target,lowerBetter=false){
 const status=kpiTargetStatus(value,target,{relativeBand:.10,direction:lowerBetter?'lower':'higher'});
 return status==='yellow'?'gold':status;
}


const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('en-US'),cash=n=>'$'+fmt(n);
let page='executive',days=1;

const dashboardRevisionMatch=String(document.title||'').match(/Dashboard v([0-9]+)/);
if(dashboardRevisionMatch)$('dashboardRevision').textContent=dashboardRevisionMatch[1];

const names={executive:'General Manager',foh:'Front of House',kitchen:'Kitchen Operations',inventory:'Inventory & Costs',parkinglot:'Parking Lot'};

const dashboardPeriods=[['1','Today'],['7','Last 7 Days'],['30','Last 30 Days'],['90','Last 90 Days'],['rolling12','Rolling 12 Months'],['quarter','Last Quarter'],['year','Last Calendar Year'],['ytd','Year to Date']];

const sectionViews=Object.fromEntries(Object.keys(names).map(section=>[section,{
 mode:'history',
 liveFilters:createFilterSet(section==='foh'?liveDaypartAt():'all'),
 historyFilters:{...createFilterSet(),historyDays:7}
}]));

function dashboardSectionHeading(label,id=''){return `<div class="foh-section-title"${id?` id="${id}"`:''}>${label}<span class="section-period">${dashboardPeriodLabel()}</span></div>`}


const alerts={executive:[['Critical','Kitchen ticket delays','P90: 24.6 min · Target: 20 min','Ticket Time Distribution'],['Warning','Dinner staffing imbalance','6 PM: 38 guests per server labor hour · Target: 25','Staffing by Hour'],['Warning','Pork broth stock risk','Estimated 0.8 days remaining · Reorder review','Ingredient Inventory']],foh:[['Critical','Dinner staffing imbalance','6 PM: 38 guests per server labor hour · Target: 25','Staffing by Hour'],['Warning','Slow table turns','Friday dinner: 1.3 turns · Target: 1.7','Table Turns by Server'],['Warning','Small Plates attachment','18% of checks · Target: 24%','Server Performance']],kitchen:[['Critical','Long-tail ticket times','P90: 24.6 min · Target: 20 min','Ticket Time Distribution'],['Warning','Dinner on-time rate','78% within target · Target: 90%','Kitchen Service Levels'],['Warning','Remake increase','9 remakes in period · Investigate causes','Returns & Remakes']],inventory:[['Critical','Pork broth low','0.8 estimated days remaining · Floor: 2 days','Ingredient Inventory'],['Warning','Fresh noodles low','1.2 estimated days remaining','Ingredient Inventory'],['Warning','Bean sprouts excess','4.9 days remaining · Check freshness and orders','Ingredient Inventory']]};

const metrics={executive:[['Total Orders',1642,'+8.4%'],['Average Daily Guests',324,'+5.6%'],['Net Sales',57182,'+10.2%'],['Prime Cost %','60.9%','-0.4 pts'],['Labor %','31.8%','+1.2 pts'],['COGS %','29.1%','-0.7 pts'],['Operating Profit %','16.8%','+1.1 pts'],['Total Discounts',1984,'-2.1%']],foh:[['Guests Served',2268,'+5.6%'],['Guests / Server Hour','22.7','+3.2%'],['Guests / Host Hour','51.5','+2.1%'],['Guests / Busser Hour','42.0','+1.7%'],['Average Check','$34.82','+2.8%'],['Table Turns / Day','3.2','+0.2'],['Table Time','58 min','-2 min'],['Appetizer Attachment','18%','-2.0 pts'],['Sales / FOH Labor Hour','$118','+4.3%']],kitchen:[['Average Ticket Time','13.4 min','+1.2 min'],['P90 Ticket Time','24.6 min','+3.4 min'],['On-Time Tickets','78%','-6.0 pts'],['Tickets Over 25 Min',31,'+9'],['Remakes',9,'+3'],['Items Produced',4782,'+6.2%'],['Peak Tickets / Hour',74,'+8'],['Kitchen Labor %','15.4%','+0.7 pts']],inventory:[['Estimated COGS %','29.1%','-0.7 pts'],['Low Stock Ingredients',2,'+1'],['Excess Stock Ingredients',1,'+1'],['Estimated Waste','$628','+4.2%'],['Food Cost Variance','+1.8 pts','+0.5 pts'],['Inventory Value','$18,420','+2.1%'],['Unverified Counts',4,'—'],['Days Since Last Count',3,'—']]};

const factor=d=>d==='rolling12'?windowDays(dateWindow().start,dateWindow().end)/7:d===1?1/7:d===7?1:d===30?30/7:90/7;
const nonScaled=new Set(['Average Daily Guests','Guests / Server Hour','Guests / Host Hour','Guests / Busser Hour','Average Check','Table Turns / Day','Table Time','Appetizer Attachment','Sales / FOH Labor Hour','Prime Cost %','Labor %','COGS %','Operating Profit %','Average Ticket Time','P90 Ticket Time','On-Time Tickets','Peak Tickets / Hour','Kitchen Labor %','Estimated COGS %','Low Stock Ingredients','Excess Stock Ingredients','Food Cost Variance','Inventory Value','Unverified Counts','Days Since Last Count']);

function rows(items){return items.map(x=>`<div class="row"><span>${x[0]}${x[2]?`<small>${x[2]}</small>`:''}</span><strong>${x[1]}</strong></div>`).join('')}

function table(headers,data){return `<table class="table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`}

function chart(title,subtitle,values,labels){return `<article class="card"><div class="head"><h2>${title}</h2><span class="hint">${subtitle}</span></div><div class="bars">${values.map((n,i)=>`<div class="barbox"><div class="bar ${n===Math.max(...values)?'hot':''}" style="height:${Math.max(5,n/Math.max(...values)*170)}px" title="${labels[i]}: ${n}"></div></div>`).join('')}</div><div class="bars-labels" style="display:flex;gap:9px;padding:0 4px">${labels.map(l=>`<div class="axis" style="flex:1;text-align:center">${l}</div>`).join('')}</div></article>`}

function box(title,subtitle,inner){return `<article class="card"><div class="head"><h2>${title}</h2><span class="hint">${subtitle}</span></div>${inner}</article>`}

// Deterministic, transaction-level simulation covering 2024 through the demo date (October 15, 2026).
const staff=[['Alex M.','dinner'],['Jordan R.','dinner'],['Taylor S.','dinner'],['Morgan L.','dinner'],['Casey P.','dinner'],['Riley K.','lunch'],['Jamie T.','lunch'],['Sam D.','lunch'],['Avery B.','lunch']];

const serviceEmployees=[
 ...staff.map(([name,daypart])=>({name,dayparts:[daypart],role:'server'})),
 {name:'Chris V.',dayparts:['dinner'],role:'bartender'},
 {name:'Drew N.',dayparts:['dinner'],role:'bartender'},
 {name:'Pat B.',dayparts:['lunch','dinner'],role:'bartender'}
];

const menuCatalog=[{"id":"alcohol-001","category":"alcohol","name":"JINYA Nippon Beats Lager (11 oz)","price":9.8,"weight":4},{"id":"alcohol-002","category":"alcohol","name":"Orion","price":5.8,"weight":2},{"id":"alcohol-003","category":"alcohol","name":"Sapporo Premium Light","price":7.5,"weight":4},{"id":"alcohol-004","category":"alcohol","name":"Lycheetini","price":10.8,"weight":4},{"id":"alcohol-005","category":"alcohol","name":"Strawberry Highball","price":10.8,"weight":3},{"id":"alcohol-006","category":"alcohol","name":"Lychee Cucumber","price":10.8,"weight":2},{"id":"alcohol-007","category":"alcohol","name":"JINYA Nigori (300 ml bottle)","price":18.0,"weight":1},{"id":"alcohol-008","category":"alcohol","name":"Hot Sake (Happy Hour)","price":9.0,"weight":0},{"id":"alcohol-009","category":"alcohol","name":"Sapporo Premium Light (Happy Hour)","price":6.0,"weight":0},{"id":"alcohol-010","category":"alcohol","name":"Lycheetini (Happy Hour)","price":6.0,"weight":0},{"id":"apps-001","category":"apps","name":"Seaweed Salad","price":5.5,"weight":1},{"id":"apps-002","category":"apps","name":"Crunchy Cucumber Salad","price":7.8,"weight":2},{"id":"apps-003","category":"apps","name":"Edamame","price":5.5,"weight":3},{"id":"apps-004","category":"apps","name":"French Fries","price":7.8,"weight":2},{"id":"apps-005","category":"apps","name":"Pork Gyoza (6 pcs)","price":11.5,"weight":5},{"id":"apps-006","category":"apps","name":"Impossible Gyoza (6 pcs)","price":11.5,"weight":1},{"id":"apps-007","category":"apps","name":"Nikuman","price":3.8,"weight":1},{"id":"apps-008","category":"apps","name":"JINYA Bun","price":6.8,"weight":4},{"id":"apps-009","category":"apps","name":"Crispy Chicken (5 pcs)","price":12.8,"weight":5},{"id":"apps-010","category":"apps","name":"Crispy Chicken (10 pcs)","price":25.3,"weight":2},{"id":"apps-011","category":"apps","name":"Takoyaki","price":10.8,"weight":2},{"id":"apps-012","category":"apps","name":"Crispy Rice with Spicy Tuna","price":12.8,"weight":3},{"id":"apps-013","category":"apps","name":"Brussels Sprouts Tempura","price":10.5,"weight":3},{"id":"apps-014","category":"apps","name":"Spicy Creamy Shrimp Tempura","price":12.5,"weight":2},{"id":"apps-015","category":"apps","name":"Spicy Corn Ribs","price":12.0,"weight":3},{"id":"apps-016","category":"apps","name":"Salmon Aburi Oshi Sushi (3 pcs)","price":7.8,"weight":2},{"id":"apps-017","category":"apps","name":"Salmon Aburi Oshi Sushi (6 pcs)","price":15.8,"weight":1},{"id":"apps-018","category":"apps","name":"California Hand Roll","price":5.8,"weight":1},{"id":"apps-019","category":"apps","name":"Spicy Tuna Hand Roll","price":5.8,"weight":2},{"id":"apps-020","category":"apps","name":"Salmon Hand Roll","price":5.8,"weight":1},{"id":"apps-021","category":"apps","name":"Salmon Poke Tacos (2 pcs)","price":7.8,"weight":2},{"id":"apps-022","category":"apps","name":"Spicy Tuna Tacos (2 pcs)","price":7.8,"weight":2},{"id":"apps-023","category":"apps","name":"Steamed Rice","price":2.5,"weight":1},{"id":"apps-024","category":"apps","name":"Edamame (Happy Hour)","price":3.0,"weight":0},{"id":"apps-025","category":"apps","name":"Nikuman (Happy Hour)","price":3.0,"weight":0},{"id":"apps-026","category":"apps","name":"Brussels Sprouts Tempura (Happy Hour)","price":6.0,"weight":0},{"id":"apps-027","category":"apps","name":"Crunchy Cucumber Salad (Happy Hour)","price":6.0,"weight":0},{"id":"apps-028","category":"apps","name":"Crispy Chicken, 5 pcs (Happy Hour)","price":6.0,"weight":0},{"id":"apps-029","category":"apps","name":"French Fries (Happy Hour)","price":6.0,"weight":0},{"id":"apps-030","category":"apps","name":"Salmon Poke Tacos, 2 pcs (Happy Hour)","price":6.0,"weight":0},{"id":"apps-031","category":"apps","name":"Crispy Rice with Spicy Tuna (Happy Hour)","price":9.0,"weight":0},{"id":"apps-032","category":"apps","name":"Spicy Corn Ribs (Happy Hour)","price":9.0,"weight":0},{"id":"food-001","category":"food","name":"JINYA Tonkotsu Black","price":19.8,"weight":6},{"id":"food-002","category":"food","name":"Premium Tonkotsu Red","price":18.8,"weight":3},{"id":"food-003","category":"food","name":"JINYA Tonkotsu Original 2010","price":19.8,"weight":4},{"id":"food-004","category":"food","name":"Tan Tan Men","price":18.8,"weight":2},{"id":"food-005","category":"food","name":"Shrimp Wonton Ramen","price":20.8,"weight":2},{"id":"food-006","category":"food","name":"Mountain Buta Garlic","price":24.8,"weight":1},{"id":"food-007","category":"food","name":"Birria Ramen","price":20.8,"weight":2},{"id":"food-008","category":"food","name":"Chicken Yuzu Shio Delight","price":18.8,"weight":2},{"id":"food-009","category":"food","name":"JINYA Chicken Ramen","price":18.8,"weight":5},{"id":"food-010","category":"food","name":"Spicy Chicken Ramen","price":19.8,"weight":5},{"id":"food-011","category":"food","name":"Wonton Chicken Ramen","price":18.8,"weight":2},{"id":"food-012","category":"food","name":"Spicy Creamy V Ramen","price":19.8,"weight":3},{"id":"food-013","category":"food","name":"Flying Vegan Harvest","price":18.8,"weight":2},{"id":"food-014","category":"food","name":"Garlic Rice","price":14.0,"weight":1},{"id":"food-015","category":"food","name":"Pork Chashu Bowl (regular)","price":18.5,"weight":2},{"id":"food-016","category":"food","name":"Pork Chashu Bowl (small)","price":11.5,"weight":1},{"id":"food-017","category":"food","name":"Chicken Chashu Bowl (regular)","price":18.5,"weight":2},{"id":"food-018","category":"food","name":"Chicken Chashu Bowl (small)","price":11.5,"weight":1},{"id":"food-019","category":"food","name":"Impossible Rice Bowl (regular)","price":18.5,"weight":1},{"id":"food-020","category":"food","name":"Impossible Rice Bowl (small)","price":11.5,"weight":1},{"id":"food-021","category":"food","name":"Tokyo Curry Rice (regular)","price":14.8,"weight":2},{"id":"food-022","category":"food","name":"Tokyo Curry Rice (small)","price":8.5,"weight":1},{"id":"food-023","category":"food","name":"Kids’ Meal","price":12.0,"weight":1},{"id":"food-024","category":"food","name":"Aka Oni - Spicy Garlic","price":19.8,"weight":0},{"id":"food-025","category":"food","name":"Tonkatsu","price":15.8,"weight":0},{"id":"food-026","category":"food","name":"JINYA Chicken Ramen, small (Happy Hour)","price":9.0,"weight":0},{"id":"food-027","category":"food","name":"Lunch Special: Ramen + One","price":22.0,"weight":0},{"id":"food-028","category":"food","name":"Lunch Special: Ramen + Two","price":25.0,"weight":0},{"id":"food-029","category":"food","name":"Combo: Pork Gyoza (4 pcs) & Salad","price":7.5,"weight":0},{"id":"food-030","category":"food","name":"Combo: Impossible Gyoza (4 pcs) & Salad","price":7.5,"weight":0},{"id":"food-031","category":"food","name":"Combo: Crispy Chicken & Salad","price":7.8,"weight":0},{"id":"food-032","category":"food","name":"Combo: Chicken Chashu Bowl & Salad","price":9.8,"weight":0},{"id":"food-033","category":"food","name":"Combo: Pork Chashu Bowl & Salad","price":9.8,"weight":0},{"id":"food-034","category":"food","name":"Combo: Impossible Rice Bowl & Salad","price":9.8,"weight":0},{"id":"food-035","category":"food","name":"Combo: Tokyo Curry Rice & Salad","price":7.8,"weight":0},{"id":"food-036","category":"food","name":"Extra Original Noodles (Kaedama)","price":2.5,"weight":0},{"id":"food-037","category":"food","name":"Kale Noodles (substitute)","price":1.2,"weight":0},{"id":"food-038","category":"food","name":"Extra Kale Noodles (Kaedama)","price":2.8,"weight":0},{"id":"food-039","category":"food","name":"Topping: Fresh Garlic","price":0.0,"weight":0},{"id":"food-040","category":"food","name":"Topping: Pork Chashu","price":3.2,"weight":0},{"id":"food-041","category":"food","name":"Topping: Chicken Chashu","price":3.2,"weight":0},{"id":"food-042","category":"food","name":"Topping: Birria Beef","price":6.4,"weight":0},{"id":"food-043","category":"food","name":"Topping: Crispy Chicken (3 pcs)","price":5.5,"weight":0},{"id":"food-044","category":"food","name":"Topping: Chicken Wonton (3 pcs)","price":2.5,"weight":0},{"id":"food-045","category":"food","name":"Topping: Shrimp Wonton (3 pcs)","price":3.2,"weight":0},{"id":"food-046","category":"food","name":"Topping: Pork Soboro","price":3.2,"weight":0},{"id":"food-047","category":"food","name":"Topping: Chicken Soboro","price":3.2,"weight":0},{"id":"food-048","category":"food","name":"Topping: Impossible Meat Soboro","price":3.2,"weight":0},{"id":"food-049","category":"food","name":"Topping: Seasoned Egg","price":3.2,"weight":0},{"id":"food-050","category":"food","name":"Topping: Butter","price":0.8,"weight":0},{"id":"food-051","category":"food","name":"Topping: Green Onion","price":1.5,"weight":0},{"id":"food-052","category":"food","name":"Topping: Fried Onion","price":1.5,"weight":0},{"id":"food-053","category":"food","name":"Topping: Cabbage","price":1.5,"weight":0},{"id":"food-054","category":"food","name":"Topping: Spicy Bean Sprouts","price":1.5,"weight":0},{"id":"food-055","category":"food","name":"Topping: Spinach","price":2.5,"weight":0},{"id":"food-056","category":"food","name":"Topping: Tofu","price":1.5,"weight":0},{"id":"food-057","category":"food","name":"Topping: Nori Dried Seaweed","price":1.5,"weight":0},{"id":"food-058","category":"food","name":"Topping: Corn","price":1.5,"weight":0},{"id":"food-059","category":"food","name":"Topping: Kikurage","price":1.5,"weight":0},{"id":"food-060","category":"food","name":"Topping: Broccoli","price":1.5,"weight":0},{"id":"food-061","category":"food","name":"Topping: Broccolini","price":2.2,"weight":0},{"id":"food-062","category":"food","name":"Topping: Brussels Sprouts","price":2.2,"weight":0},{"id":"food-063","category":"food","name":"Topping: Mushroom","price":2.8,"weight":0},{"id":"food-064","category":"food","name":"Topping: Bok Choy","price":2.2,"weight":0},{"id":"food-065","category":"food","name":"Topping: Extra Soup (large)","price":6.0,"weight":0},{"id":"food-066","category":"food","name":"Topping: Spicy Sauce","price":1.5,"weight":0},{"id":"food-067","category":"food","name":"Garlic Rice: Add Pork Chashu","price":4.65,"weight":0},{"id":"food-068","category":"food","name":"Garlic Rice: Add Chicken Chashu","price":4.65,"weight":0},{"id":"food-069","category":"food","name":"Garlic Rice: Add Birria Beef","price":5.65,"weight":0},{"id":"food-070","category":"food","name":"Tokyo Curry Rice: Add Tonkatsu","price":9.0,"weight":0},{"id":"food-071","category":"food","name":"Aka Oni: Add Onsen Tamago","price":3.8,"weight":0},{"id":"food-072","category":"food","name":"Tonkatsu: Add Onsen Tamago","price":3.8,"weight":0},{"id":"dessert-001","category":"dessert","name":"Mochi Ice Cream","price":4.8,"weight":3},{"id":"dessert-002","category":"dessert","name":"Matcha Ice Cream","price":4.8,"weight":2},{"id":"dessert-003","category":"dessert","name":"Hokkaido Mille Crepe with Matcha Ice Cream","price":8.5,"weight":2},{"id":"drink-001","category":"drink","name":"Coca-Cola","price":3.6,"weight":5},{"id":"drink-002","category":"drink","name":"Diet Coke","price":3.6,"weight":4},{"id":"drink-003","category":"drink","name":"Sprite","price":3.6,"weight":4},{"id":"drink-004","category":"drink","name":"Lemonade","price":3.6,"weight":3},{"id":"drink-005","category":"drink","name":"Ramune","price":4.2,"weight":2},{"id":"drink-006","category":"drink","name":"Apple Juice","price":4.8,"weight":1},{"id":"drink-007","category":"drink","name":"Iced Matcha Latte, Salted Cream","price":7.5,"weight":3},{"id":"drink-008","category":"drink","name":"Bottled Water","price":2.8,"weight":3},{"id":"drink-009","category":"drink","name":"Perrier","price":4.2,"weight":2},{"id":"drink-010","category":"drink","name":"J.Girl","price":8.0,"weight":1},{"id":"drink-011","category":"drink","name":"Watermelon Delight","price":8.0,"weight":1},{"id":"drink-012","category":"drink","name":"Matcha Lychee Lemonade","price":8.0,"weight":2}];

const menuItemsByCategory=Object.fromEntries(['apps','food','drink','dessert','alcohol'].map(category=>[category,menuCatalog.filter(item=>item.category===category&&item.weight>0).flatMap(item=>Array(item.weight).fill(item))]));

let seed=29117;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function choose(arr){return arr[Math.floor(rnd()*arr.length)]}

const DEMO_TODAY='2026-10-15';
const DEMO_START='2024-01-01';

const demoDates=Array.from({length:Math.round((Date.parse(DEMO_TODAY+'T00:00:00Z')-Date.parse(DEMO_START+'T00:00:00Z'))/86400000)+1},(_,i)=>new Date(Date.parse(DEMO_START+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));

function iso(d){return d.toISOString().slice(0,10)}

function shiftDate(date,amount){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return iso(d)}

// Calendar-month arithmetic clamps leap-day anniversaries to the last valid day.
function shiftCalendarMonths(value,months){
 const date=new Date(value+'T00:00:00Z'),day=date.getUTCDate();
 date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
 const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 date.setUTCDate(Math.min(day,last));return iso(date);
}

function rolling12Window(end){
 const start=shiftDate(shiftCalendarMonths(end,-12),1),previousEnd=shiftDate(start,-1);
 return {start,end,previousStart:shiftDate(shiftCalendarMonths(previousEnd,-12),1),previousEnd,label:'previous rolling 12 months'};
}

function dateWindow(){
 const end=DEMO_TODAY;
 if(days==='rolling12')return rolling12Window(end);
 if(days==='quarter')return {start:'2026-07-01',end:'2026-09-30',previousStart:'2025-07-01',previousEnd:'2025-09-30',label:'same quarter last year'};
 if(days==='year')return {start:'2025-01-01',end:'2025-12-31',previousStart:'2024-01-01',previousEnd:'2024-12-31',label:'previous calendar year'};
 if(days==='ytd')return {start:'2026-01-01',end,previousStart:'2025-01-01',previousEnd:'2025-10-15',label:'same period last year'};
 const count=Number(days),start=shiftDate(end,1-count);
 return {start,end,previousStart:count===1?shiftDate(end,-7):shiftDate(start,-count),previousEnd:count===1?shiftDate(end,-7):shiftDate(start,-1),label:count===1?'same weekday last week':'previous '+count+' days'};
}

function inWindow(date,from,to){return date>=from&&date<=to}

function windowDays(from,to){return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1}


const checks=[];

for(let di=0;di<demoDates.length;di++){const weekday=new Date(demoDates[di]+'T12:00:00Z').getUTCDay();const busy=[5,6,0].includes(weekday);for(let si=0;si<staff.length;si++){const [server,daypart]=staff[si];if((di+si)%7===0)continue;const shiftLoad=daypart==='dinner'?(busy?5:4):(busy?4:3);const n=shiftLoad+Math.floor(rnd()*3);for(let j=0;j<n;j++){const guests=1+Math.floor(rnd()*4);const items=[];const salesFactor=di===demoDates.length-1?1.18:di>=demoDates.length-7?1.06:.92;const upsell=(si%4)*.065+(di%5)*.028;function add(category,count){for(let k=0;k<count;k++){const item=choose(menuItemsByCategory[category]);items.push({category,itemId:item.id,name:item.name,price:item.price})}}add('food',Math.max(1,Math.round(guests*(di===demoDates.length-1?.57:.66+rnd()*.33))));add('apps',rnd()<(.38+upsell+(di===demoDates.length-1?.24:0))?Math.ceil(guests/3):0);add('dessert',rnd()<(.20+upsell+(di===demoDates.length-1?.24:0))?Math.ceil(guests/3):0);add('drink',Math.round(guests*(.36+rnd()*.5+upsell+(di===demoDates.length-1?.22:0))));add('alcohol',daypart==='dinner'?Math.round(guests*(.14+rnd()*.5+upsell+(di===demoDates.length-1?.32:0))):Math.round(guests*rnd()*.18));const duration=Math.round((daypart==='dinner'?42:29)+guests*5+rnd()*30+(di===demoDates.length-1?14:di<demoDates.length-7?-4:0));checks.push({id:checks.length+1,date:demoDates[di],daypart,server,guests,duration,arrivalMinute:(daypart==='lunch'?660:1020)+Math.floor(rnd()*(daypart==='lunch'?330:270)),items,table:'T'+(1+Math.floor(rnd()*24))})}}}

// Brian's FOH planning goals, recorded October 16, 2026.
// Section Performance belongs in History: identify coaching opportunities and
// place each employee where their demonstrated strengths add the most value.
// Compare Inside/Patio first, then their physical sections. Expected differences
// (such as Bar vs Booths) are context, not automatic performance failures.
// Use check/guest counts, party-size-normalized sales and the same daypart/period;
// observed employee/location differences do not establish employee causation.
// Actual Aloha table-combination and split-check attribution remains unverified.
const sectionPlanningGoals=Object.freeze({
 purpose:'Planning, coaching and server placement',
 view:'history',
 objective:'Maximize each server\u2019s value each day.',
 comparisons:['Inside vs Patio','Section vs section','Employee within a location or section vs their overall results'],
 measures:['Check and guest volume','Average check','Sales per guest','Alcohol per check and guest','Alcohol sales mix','Alcohol attachment'],
 source:'Approved 2026-10-16 Section-Table Layout; transactions remain synthetic.'
});

const fohSections=[
 {id:'inside-booths',location:'Inside',name:'Booths',first:101,last:104,unit:'table',capacities:[4,4,4,4]},
 {id:'inside-tables',location:'Inside',name:'Tables',first:201,last:206,unit:'table',capacities:[4,4,4,4,4,4]},
 {id:'inside-flex',location:'Inside',name:'Flex',first:301,last:305,unit:'table',capacities:[4,4,2,2,2],combinedCapacity:24},
 {id:'inside-community',location:'Inside',name:'Community',first:401,last:412,unit:'seat'},
 {id:'inside-ramen',location:'Inside',name:'Ramen',first:501,last:505,unit:'seat'},
 {id:'inside-bar',location:'Inside',name:'Bar',first:601,last:612,unit:'seat'},
 {id:'patio-bar',location:'Patio',name:'Bar',first:701,last:707,unit:'seat'},
 {id:'patio-tables',location:'Patio',name:'Tables',first:801,last:806,unit:'table',capacities:[4,4,4,4,4,4]},
 {id:'patio-flex',location:'Patio',name:'Flex',first:901,last:903,unit:'table',capacities:[4,4,4],combinedCapacity:16}
];

const fohSeatingIndex=new Map();

for(const section of fohSections)for(let number=section.first;number<=section.last;number++)fohSeatingIndex.set(number,section);

const sectionPlanningGroups=[
 ...['Inside','Patio'].map(location=>({key:'location:'+location,label:'All '+location,location})),
 ...fohSections.map(section=>({key:'section:'+section.id,label:section.location+' / '+section.name,sectionId:section.id})),
 {key:'unmapped',label:'Unmapped seating',unmapped:true}
];

const sectionPlanningView={group:null};

function sectionForCheck(check){
 const numbers=Array.isArray(check.tableNumbers)&&check.tableNumbers.length?check.tableNumbers:[check.table];
 const sections=numbers.map(number=>fohSeatingIndex.get(Number(number)));
 return sections[0]&&sections.every(section=>section?.id===sections[0].id)?sections[0]:null;
}

function assignSyntheticSeating(check,index){
 const section=fohSections[(index+Math.floor(index/17))%fohSections.length],count=section.last-section.first+1;
 const start=(index*7+Math.floor(index/9))%count;
 let numbers;
 if(section.unit==='seat'){
  // One synthetic party/check can occupy several permanent seat positions.
  const first=section.first+Math.min(start,count-check.guests);
  numbers=Array.from({length:check.guests},(_,i)=>first+i);
 }else if(section.capacities[start]>=check.guests){numbers=[section.first+start]}
 else{
  const first=Math.min(start,count-2);
  numbers=[section.first+first,section.first+first+1];
 }
 check.table=numbers[0];check.tableNumbers=numbers;check.location=section.location;
 check.sectionId=section.id;check.section=section.name;check.partyId='demo-party-'+check.id;
 check.seatingConfiguration=numbers.length>1&&section.unit==='table'?'Combined':'Standard';
}

function sectionMatchesGroup(check,group){
 const section=sectionForCheck(check);
 return group.unmapped?!section:group.location?section?.location===group.location:section?.id===group.sectionId;
}

function summarizeSectionChecks(records){
 const summary={checks:records.length,guests:0,grossCents:0,alcoholCents:0,alcoholChecks:0};
 // Each check contributes once, even when tableNumbers contains joined tables
 // or several bar/community seats. Monetary rollups use integer cents.
 for(const check of records){
  summary.guests+=Number(check.guests)||0;let alcohol=false;
  for(const item of check.items){const cents=Math.round(item.price*100);summary.grossCents+=cents;if(item.category==='alcohol'){summary.alcoholCents+=cents;alcohol=true}}
  if(alcohol)summary.alcoholChecks++;
 }
 return {...summary,
  avgCheckCents:summary.checks?summary.grossCents/summary.checks:null,
  salesPerGuestCents:summary.guests?summary.grossCents/summary.guests:null,
  alcoholPerCheckCents:summary.checks?summary.alcoholCents/summary.checks:null,
  alcoholPerGuestCents:summary.guests?summary.alcoholCents/summary.guests:null,
  alcoholMix:summary.grossCents?100*summary.alcoholCents/summary.grossCents:null,
  alcoholIncluded:summary.checks?100*summary.alcoholChecks/summary.checks:null
 };
}

function sectionMoney(cents,decimals=2){return cents==null?'\u2014':itemMoney(cents,decimals)}

function sectionPercent(value){return value==null?'\u2014':value.toFixed(1)+'%'}


// Synthetic alcohol baskets demonstrate all three status bands in the existing
// report periods. Use actual catalog items/prices so every view reconciles.
// These profiles affect sample transactions only, never KPI goals or colors.
function applySyntheticAlcoholBaskets(){
 const profiles={
  dinner:{'Alex M.':32,'Jordan R.':28,'Taylor S.':23.7,'Morgan L.':18.5,'Casey P.':24,'Chris V.':34,'Drew N.':20,'Pat B.':23.6},
  lunch:{'Riley K.':28,'Jamie T.':18,'Sam D.':23.7,'Avery B.':29,'Pat B.':23.8}
 };
 const catalog=menuCatalog.filter(item=>item.category==='alcohol'&&item.weight>0),groups=new Map();
 for(const check of checks){
  check.items=check.items.filter(item=>item.category!=='alcohol');
  const key=check.date+'|'+check.daypart+'|'+check.server;
  if(!groups.has(key))groups.set(key,{key,date:check.date,daypart:check.daypart,name:check.server,checks:[],nonAlcohol:0});
  const group=groups.get(key);group.checks.push(check);
  group.nonAlcohol+=check.items.reduce((sum,item)=>sum+Math.round(item.price*100),0);
 }
 let largest=0;
 for(const group of groups.values()){
  const person=serviceEmployees.findIndex(p=>p.name===group.name),ordinal=Math.floor(Date.parse(group.date+'T00:00:00Z')/86400000),week=Math.floor(ordinal/7);
  const base=profiles[group.daypart][group.name]??24;
  // Visible weekly ups and downs; near-goal profiles stay within the yellow band.
  const amplitude=base>=22.5&&base<25?.75:2.1;
  const target=base+amplitude*(.65*Math.sin(week*.78+person*1.3)+.35*Math.sin(ordinal*.72+person));
  group.desired=Math.round(group.nonAlcohol*target/(100-target)/10);
  largest=Math.max(largest,group.desired);
 }
 // Reachable basket totals in ten-cent units. Find the nearest attainable total,
 // then vary item choices deterministically without changing menu prices.
 const prices=catalog.map(item=>Math.round(item.price*10)),limit=largest+Math.max(...prices);
 const reachable=new Uint8Array(limit+1);reachable[0]=1;
 for(let amount=1;amount<=limit;amount++)if(prices.some(price=>amount>=price&&reachable[amount-price]))reachable[amount]=1;
 for(const group of groups.values()){
  let amount=group.desired;
  for(let distance=0;distance<=limit;distance++){
   if(amount+distance<=limit&&reachable[amount+distance]){amount+=distance;break;}
   if(amount-distance>=0&&reachable[amount-distance]){amount-=distance;break;}
  }
  let state=2166136261;
  for(const char of group.key)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const ordered=[...group.checks].sort((a,b)=>((a.id*17)%53)-((b.id*17)%53));
  const included=ordered.slice(0,Math.max(1,Math.round(ordered.length*.68)));
  const slots=included.flatMap(check=>Array(check.guests).fill(check));
  while(amount>0){
   const eligible=catalog.filter((item,i)=>amount>=prices[i]&&reachable[amount-prices[i]]);
   const weight=eligible.reduce((sum,item)=>sum+item.weight,0);let pick=random()*weight;
   const item=eligible.find(candidate=>{pick-=candidate.weight;return pick<0})||eligible.at(-1);
   const check=slots[Math.floor(random()*slots.length)];
   check.items.push({category:item.category,itemId:item.id,name:item.name,price:item.price});
   amount-=Math.round(item.price*10);
  }
 }
}


const losses=[];

checks.forEach((c,i)=>{assignSyntheticSeating(c,i);c.bartender=c.daypart==='dinner'?['Chris V.','Drew N.','Pat B.'][(i+Math.floor(i/9))%3]:'Pat B.';// Synthetic bar checks belong to their serving bartender; each check has one owner.
c.employeeRole=c.section==='Bar'?'bartender':'server';if(c.employeeRole==='bartender')c.server=c.bartender;});

applySyntheticAlcoholBaskets();

checks.forEach((c,i)=>{const amount=c.items.reduce((a,item)=>a+item.price,0);if((i*13+7)%47===0)losses.push({checkId:c.id,type:'Refund',amount:Math.round(Math.min(amount*.65,27+(i%4)*8)*100)/100,server:c.server,date:c.date});if((i*11+5)%31===0)losses.push({checkId:c.id,type:'Comp',amount:Math.round(Math.min(amount*.30,8+(i%5)*4)*100)/100,server:c.server,date:c.date})});

// Ensure both dayparts demonstrate refunds in the current synthetic demo day.
for(const part of ['lunch','dinner']){
 if(!losses.some(loss=>loss.type==='Refund'&&loss.date===DEMO_TODAY&&checks.find(c=>c.id===loss.checkId)?.daypart===part)){
  const check=checks.find(c=>c.date===DEMO_TODAY&&c.daypart===part&&c.employeeRole==='server');
  if(check){const gross=check.items.reduce((sum,item)=>sum+item.price,0);losses.push({checkId:check.id,type:'Refund',amount:Math.round(Math.min(gross*.25,part==='dinner'?18.5:9.5)*100)/100,server:check.server,date:check.date})}
 }
}

const lossesByCheck=new Map();
for(const loss of losses){if(!lossesByCheck.has(loss.checkId))lossesByCheck.set(loss.checkId,[]);lossesByCheck.get(loss.checkId).push(loss)}

const lossFor=c=>lossesByCheck.get(c.id)||[];

let metricMode='guest';

const employeeRoles={server:true,bartender:true};

const serverColumns=[['server','Server'],['guests','Guests'],['tables','Checks'],['party','Party Size'],['alcohol','Alcohol'],['apps','Small'],['dessert','Desserts'],['check','Check'],['refunds','Refund $'],['turns','Checks / Shift'],['duration','Table Time']];

const defaults={lunch:{apps:4,food:19,drink:4,dessert:2,alcohol:3,check:28,duration:45},dinner:{apps:7,food:21,drink:6,dessert:3,alcohol:6,check:37,duration:75}};

let targets=JSON.parse(JSON.stringify(defaults));
try{const saved=localStorage.getItem('jinya-demo-targets-v0038');if(saved){const parsed=JSON.parse(saved);for(const d of ['lunch','dinner'])for(const k of Object.keys(defaults[d]))if(Number.isFinite(+parsed?.[d]?.[k]))targets[d][k]=+parsed[d][k]}}catch(e){}

const refundDefaults={lunch:0.50,dinner:0.50};
let refundTargets={...refundDefaults};
try{const saved=JSON.parse(localStorage.getItem('jinya-refund-targets')||'{}');for(const d of ['lunch','dinner'])if(Number.isFinite(+saved[d])&&+saved[d]>=0)refundTargets[d]=+saved[d]}catch(e){}

const salesMixTargetCategories=[['alcohol','Alcohol'],['apps','Small'],['dessert','Desserts'],['food','Entrées'],['drink','Beverages']];

const salesMixTargetStorageKey='jinya-sales-mix-targets-v1';

const salesMixDefaults={lunch:{alcohol:25,apps:10,dessert:5,food:50,drink:10},dinner:{alcohol:25,apps:10,dessert:5,food:50,drink:10}};

function validSalesMixProfile(profile){return !!profile&&salesMixTargetCategories.every(([key])=>Number.isFinite(profile[key])&&profile[key]>=0&&profile[key]<=100)&&Math.abs(salesMixTargetCategories.reduce((sum,[key])=>sum+profile[key],0)-100)<.000001}

let salesMixTargets=JSON.parse(JSON.stringify(salesMixDefaults));

try{const saved=JSON.parse(localStorage.getItem(salesMixTargetStorageKey)||'null');for(const daypart of ['lunch','dinner'])if(validSalesMixProfile(saved?.[daypart]))salesMixTargets[daypart]={...saved[daypart]}}catch(error){}

function targetPercent(value){return Number(value.toFixed(1))+'%'}

function referenceSalesMixTargets(cs,daypart=selectValue('daypart')){
 if(daypart==='lunch'||daypart==='dinner')return {targets:{...salesMixTargets[daypart]},weights:{lunch:daypart==='lunch'?1:0,dinner:daypart==='dinner'?1:0},available:true};
 const cents={lunch:0,dinner:0};for(const check of cs)if(check.daypart in cents)cents[check.daypart]+=check.items.reduce((sum,item)=>sum+Math.round(item.price*100),0);
 const total=cents.lunch+cents.dinner;if(!total)return {targets:null,weights:{lunch:0,dinner:0},available:false};
 const weights={lunch:cents.lunch/total,dinner:cents.dinner/total};
 return {targets:Object.fromEntries(salesMixTargetCategories.map(([key])=>[key,salesMixTargets.lunch[key]*weights.lunch+salesMixTargets.dinner[key]*weights.dinner])),weights,available:true};
}


let sortServerBy='check',sortServerDirection=-1;

const selectValue=id=>$(id).value;

function currentRows(daypart=selectValue('daypart')){
 const d=daypart,p=selectValue('population'),window=dateWindow();
 const active=['Alex M.','Jordan R.','Taylor S.','Casey P.','Chris V.','Drew N.'];
 const scheduled=[...active,'Morgan L.','Riley K.','Sam D.','Pat B.'];
 return serviceEmployees.filter(person=>(d==='all'||person.dayparts.includes(d))&&(p==='active'||p==='worked'||(p==='scheduled'&&scheduled.includes(person.name))||(p==='onfloor'&&active.includes(person.name)))).map(person=>{
  const selected=checks.filter(c=>c.server===person.name&&inWindow(c.date,window.start,window.end)&&(d==='all'||c.daypart===d));
  if(!selected.length)return null;
  const totalGuests=selected.reduce((v,c)=>v+c.guests,0),totals={apps:0,food:0,drink:0,dessert:0,alcohol:0},quantities={apps:0,food:0,drink:0,dessert:0,alcohol:0};
  for(const c of selected)for(const item of c.items){totals[item.category]+=item.price;quantities[item.category]++}
  const n=selected.length;
  const row={server:person.name,role:person.role,guests:totalGuests,party:totalGuests/n,turns:n/new Set(selected.map(c=>c.date)).size,duration:selected.reduce((v,c)=>v+c.duration,0)/n,quantities:{},perGuest:{}};
  for(const k of Object.keys(totals)){row[k]=totals[k]/n;row.quantities[k]=totals[k];row.perGuest[k]=totals[k]/totalGuests}
  row.tables=n;row.closedChecks=n;row.daypartCounts={lunch:selected.filter(check=>check.daypart==='lunch').length,dinner:selected.filter(check=>check.daypart==='dinner').length};
  row.refunds=selected.reduce((sum,c)=>sum+lossFor(c).filter(l=>l.type==='Refund').reduce((a,l)=>a+l.amount,0),0);
  row.check=Object.values(totals).reduce((a,b)=>a+b,0)/n;row.grossTotal=row.check*n;row.perGuest.check=row.grossTotal/totalGuests;row.shiftCount=new Set(selected.map(c=>c.date+":"+c.daypart)).size;row.turns=n/row.shiftCount;
  return row;
 }).filter(Boolean)
}

function performanceRows(){return currentRows().filter(row=>employeeRoles[row.role])}


function displayValue(r,key,rows=performanceRows()){if(key==='refunds'&&metricMode==='guest')return r.guests?r.refunds/r.guests:0;if(metricMode==='share'&&['apps','food','drink','dessert','alcohol','check','refunds'].includes(key)){const total=rows.reduce((sum,x)=>sum+(key==='check'?x.grossTotal:key==='refunds'?x.refunds:(x[key]||0)*x.closedChecks),0);const amount=key==='check'?r.grossTotal:key==='refunds'?r.refunds:(r[key]||0)*r.closedChecks;return total?amount/total*100:0}if(metricMode==='quantity'&&r.quantities&&key in r.quantities)return r.quantities[key];if(metricMode==='guest'&&r.perGuest&&key in r.perGuest)return r.perGuest[key];if(metricMode==='quantity'&&key==='check')return r.grossTotal;if(key==='refunds'&&metricMode==='money')return r.refunds/Math.max(1,r.closedChecks);return r[key]}

function targetDaypartWeights(rows,employee=null){
 const group=employee?[employee]:rows,d=selectValue('daypart');
 if(d==='lunch')return {lunch:1,dinner:0};if(d==='dinner')return {lunch:0,dinner:1};
 const lunch=group.reduce((sum,row)=>sum+(row.daypartCounts?.lunch||0),0),dinner=group.reduce((sum,row)=>sum+(row.daypartCounts?.dinner||0),0),total=lunch+dinner;
 return total?{lunch:lunch/total,dinner:dinner/total}:{lunch:.5,dinner:.5};
}

function referenceTargets(rows,employee=null){
 const weights=targetDaypartWeights(rows,employee),base=Object.fromEntries(Object.keys(defaults.dinner).map(key=>[key,targets.lunch[key]*weights.lunch+targets.dinner[key]*weights.dinner]));
 if(metricMode==='money')return base;
 if(metricMode==='quantity'){const count=employee?employee.closedChecks:rows.reduce((sum,row)=>sum+row.closedChecks,0)/Math.max(1,rows.length);return Object.fromEntries(Object.entries(base).map(([key,value])=>[key,key==='duration'?value:value*count]))}
 return Object.fromEntries(Object.keys(base).map(key=>[key,key==='duration'?base.duration:NaN]));
}


function performanceClass(v,key,goal){return kpiPerformanceClass(v,goal,['duration','refunds'].includes(key))}

function renderPeriodStats(rows){const el=$('serverPeriodStats');if(!el)return;const filtered=selectedFOHChecks();const n=filtered.length,guests=filtered.reduce((a,c)=>a+c.guests,0),sales=filtered.reduce((a,c)=>a+c.items.reduce((b,i)=>b+i.price,0),0),duration=n?filtered.reduce((a,c)=>a+c.duration,0)/n:0;const stats=[['Checks',n.toLocaleString()],['Guests',guests.toLocaleString()],['Check',n?'$'+(sales/n).toFixed(2):'—'],['Party Size',n?(guests/n).toFixed(2):'—'],['Table Time',n?duration.toFixed(1)+' min':'—']];el.innerHTML=stats.map(([label,value])=>`<div class="period-stat"><span>${label}</span><strong>${value}</strong></div>`).join('')}

function selectedFOHChecks(){const w=dateWindow(),part=selectValue('daypart');return checks.filter(c=>inWindow(c.date,w.start,w.end)&&(part==='all'||c.daypart===part))}


function fohStats(){const cs=selectedFOHChecks(),n=cs.length,guestCount=cs.reduce((a,c)=>a+c.guests,0),gross=cs.reduce((a,c)=>a+c.items.reduce((b,i)=>b+i.price,0),0),dates=new Set(cs.map(c=>c.date)).size,selectedIds=new Set(cs.map(c=>c.id)),periodLosses=losses.filter(l=>selectedIds.has(l.checkId)),refunds=periodLosses.filter(l=>l.type==='Refund').reduce((a,l)=>a+l.amount,0),comps=periodLosses.filter(l=>l.type==='Comp').reduce((a,l)=>a+l.amount,0);return {cs,n,guestCount,gross,dates,refunds,comps,net:gross-refunds-comps}}

function previousChecks(){if(isLiveView())return [];const w=dateWindow(),part=selectValue('daypart');return checks.filter(c=>inWindow(c.date,w.previousStart,w.previousEnd)&&(part==='all'||c.daypart===part))}


function previousStats(){const w=dateWindow(),cs=previousChecks(),gross=cs.reduce((sum,c)=>sum+c.items.reduce((a,i)=>a+i.price,0),0),guests=cs.reduce((a,c)=>a+c.guests,0),ids=new Set(cs.map(c=>c.id)),ls=losses.filter(l=>ids.has(l.checkId)),refunds=ls.filter(l=>l.type==='Refund').reduce((a,l)=>a+l.amount,0),comps=ls.filter(l=>l.type==='Comp').reduce((a,l)=>a+l.amount,0);return {days:windowDays(w.previousStart,w.previousEnd),available:cs.length>0,guests,checks:cs.length,gross,refunds,comps,net:gross-refunds-comps}}

function metricTrend(key,current,average=false){if(isLiveView()||$('compare').value==='none')return '';const p=previousStats();if(!p.available)return 'Prior period unavailable';const old=average?p[key]/p.days:p[key],now=average?current/windowDays(dateWindow().start,dateWindow().end):current;if(!old)return now>0?'New':'0%';const change=(now/old-1)*100;return `${change>=0?'+':''}${Math.round(change)}% vs ${dateWindow().label}`}


function fohMetricPairs(){const x=fohStats(),{n,guestCount,gross,refunds,comps,net}=x;const w=dateWindow(),dayCount=windowDays(w.start,w.end);return [['Guests Served',guestCount,'guests'],['Closed Checks',n,'checks'],['Gross Sales',gross,'gross'],['Refunds',refunds,'refunds'],['Comps',comps,'comps'],['Net Sales',net,'net']].map(([label,v,key])=>({label,v,key,days:dayCount}))}

function metricDisplay(m,average){const v=average?m.v/m.days:m.v;return ['Guests Served','Closed Checks'].includes(m.label)?(average?fmt(Math.round(v)):fmt(v)):(['Refunds','Comps'].includes(m.label)?'-':'')+cash(v)}

function fohMetricCards(average){return fohMetricPairs().map(m=>{const text=metricTrend(m.key,m.v,average),delta=Number(text.match(/^[+-]?\d+/)?.[0]),lowGood=m.key==='refunds',neutral=m.key==='comps'||!Number.isFinite(delta),bad=!neutral&&(lowGood?delta>0:delta<0);return `<button class="card metric" data-detail="${m.label}"><div class="label">${m.label}</div><div class="metric-number">${metricDisplay(m,average)}</div><div class="trend ${neutral?'na':bad?'bad':''}" title="${escapeHTML(text)}">${escapeHTML(text)}</div></button>`}).join('')}


function periodHeading(){if($('compare').value==='none')return '';const p=previousStats();return p.available?(' vs '+dateWindow().label):' (comparison unavailable)'}

function compositionHTML(){
 const {cs,n,guestCount}=fohStats(),part=selectValue('daypart'),d=part==='lunch'?'lunch':'dinner';
 const prev=isLiveView()?[]:previousChecks();
 const revenue=(data,category)=>data.reduce((sum,c)=>sum+c.items.filter(i=>i.category===category).reduce((v,i)=>v+i.price,0),0);
 const total=data=>data.reduce((sum,c)=>sum+c.items.reduce((v,i)=>v+i.price,0),0);
 const guests=data=>data.reduce((sum,c)=>sum+c.guests,0);
 const participation=(data,category)=>data.length?100*data.filter(c=>c.items.some(i=>i.category===category)).length/data.length:0;
 const perGuest=(data,category)=>guests(data)?revenue(data,category)/guests(data):0;
 const upselling=[
  {label:'Alcohol Included',actual:participation(cs,'alcohol'),previous:participation(prev,'alcohol'),target:null,unit:'%'},
  {label:'Alcohol $ / Guest',actual:perGuest(cs,'alcohol'),previous:perGuest(prev,'alcohol'),target:null,unit:'$'},
  {label:'Small Included',actual:participation(cs,'apps'),previous:participation(prev,'apps'),target:null,unit:'%'},
  {label:'Small $ / Guest',actual:perGuest(cs,'apps'),previous:perGuest(prev,'apps'),target:null,unit:'$'},
  {label:'Dessert Included',actual:participation(cs,'dessert'),previous:participation(prev,'dessert'),target:null,unit:'%'},
  {label:'Dessert $ / Guest',actual:perGuest(cs,'dessert'),previous:perGuest(prev,'dessert'),target:null,unit:'$'}
 ];
 const mixReference=referenceSalesMixTargets(cs);
 const sales=salesMixTargetCategories.map(([category,label])=>({label,actual:total(cs)?100*revenue(cs,category)/total(cs):0,previous:total(prev)?100*revenue(prev,category)/total(prev):0,target:mixReference.targets?.[category]??null,unit:'%'}));
 const fmt=(v,u)=>u==='%'?Math.round(v)+'%':'$'+v.toFixed(2);
 const tiles=metrics=>`<div class="upselling-pair">${metrics.map(m=>{
  const change=prev.length?(m.unit==='%'?m.actual-m.previous:m.previous?(m.actual/m.previous-1)*100:null):null;
  const comparison=change==null?'—':`${change>=0?'+':''}${m.unit==='%'?change.toFixed(1)+' pts':Math.round(change)+'%'}`;
  const label=m.unit==='%'?'Checks Included':'$ / Guest';
  return `<article class="card metric" aria-label="${m.label}"><div class="label">${label}</div><div class="metric-number"><span class="performance neutral">${fmt(m.actual,m.unit)}</span></div>${isLiveView()?'':`<div class="trend ${change!=null&&change<0?'bad':''}">${comparison}</div>`}</article>`
 }).join('')}</div>`;
 const buckets=[['Alcohol',upselling.slice(0,2)],['Small Plates',upselling.slice(2,4)],['Dessert',upselling.slice(4,6)]];
 return {
  salesMix:`${dashboardSectionHeading('SALES MIX','salesMixTitle')}${salesMixChartHTML(sales,n>0,prev.length>0,mixReference)}`,
  upselling:`<section id="upsellingSection">${dashboardSectionHeading('UPSELLING')}<div class="upselling-groups">${buckets.map(([label,metrics])=>`<section class="upselling-group" aria-label="${label} upselling"><h3 class="upselling-group-title">${label}</h3>${tiles(metrics)}</section>`).join('')}</div></section>`
 };
}


function blendedSalesMixChartHTML(metrics,hasCurrent,hasPrevious,mixReference){

 const compare=!isLiveView()&&$('compare').value!=='none';
 if(!hasCurrent)return '<article class="card sales-mix-card" aria-labelledby="salesMixTitle"><div class="empty">No sales match these filters.</div></article>';
 const rows=metrics.map(m=>{
  const driver=['Alcohol','Small','Desserts'].includes(m.label);const status=!driver?'neutral':performanceClass(m.actual,'sales',m.target);
  const change=hasPrevious?m.actual-m.previous:null;
  const changeLabel=!compare||change===null?'—':`${change>=0?'+':''}${change.toFixed(1)} pts`;
  const changeClass=!driver||change===null?'na':change<0?'bad':'';
  const actual=Math.max(0,Math.min(100,m.actual));
  return `<tr data-sales-category="${m.label}"><th scope="row">${m.label}</th><td><div class="sales-mix-plot"><div class="sales-mix-track" role="img" aria-label="${m.label}: ${m.actual.toFixed(1)}% of gross item sales; target ${targetPercent(m.target)}"><span class="sales-mix-bar ${status}" style="width:${actual}%" aria-hidden="true"></span><span class="sales-mix-target" style="left:${m.target}%" aria-hidden="true"></span></div><span class="sales-mix-value ${status}">${Math.round(m.actual)}%</span></div></td>${compare?`<td class="sales-mix-change ${changeClass}">${changeLabel}</td>`:''}<td>${targetPercent(m.target)}</td></tr>`
 }).join('');
 return `<article class="card sales-mix-card" aria-labelledby="salesMixTitle"><div class="sales-mix-key"><span><i class="actual-key" aria-hidden="true"></i>Actual share of sales</span><span><i class="target-key" aria-hidden="true"></i>Target</span></div><div class="sales-mix-scroll"><table class="sales-mix-table"><colgroup><col class="category-column"><col>${compare?'<col class="change-column">':''}<col class="target-column"></colgroup><thead><tr><th scope="col">Category</th><th scope="col" class="sales-mix-scale-heading">Share of Sales</th>${compare?'<th scope="col">Change</th>':''}<th scope="col">Target</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="sales-mix-axis"><td></td><td><div class="sales-mix-axis-labels"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></td>${compare?'<td></td>':''}<td></td></tr></tfoot></table></div><p class="sales-mix-foot">Share of gross item sales. Beverages excludes alcohol.${compare?' Change is in percentage points. Driver colors apply to Alcohol, Small and Desserts; other shares are neutral.':''}</p>${selectValue('daypart')==='all'&&mixReference?.available?`<p class="sales-mix-foot target-blend-note">All Day target blend: ${targetPercent(mixReference.weights.lunch*100)} Lunch / ${targetPercent(mixReference.weights.dinner*100)} Dinner, weighted by sales.</p>`:''}</article>`
}

$('sidebarTargets').onclick=openAdmin;

$('closeTargets').onclick=cancelAdmin;

$('targetDaypart').onchange=changeAdminDaypart;

$('daypart').onchange=()=>renderKeepingSection();

$('population').onchange=()=>renderKeepingSection();

const bestSellerCategories=[['alcohol','Alcohol'],['apps','Small'],['food','Entrées'],['dessert','Desserts'],['drink','Beverages']];

const bestSellerPeriods=dashboardPeriods;

let bestSellersWindow=null;

const bestSellersView={category:'all',query:'',tier:'all'};

const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const itemMoney=(cents,decimals=0)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:decimals,maximumFractionDigits:decimals});

const itemPercent=value=>value.toFixed(1)+'%';

const itemsViewStyles=".items-overlay{position:fixed;inset:0;z-index:1250;display:flex;justify-content:center;padding:18px;background:#111a2477}\n.items-overlay[hidden]{display:none!important}\n.items-app{display:flex;flex-direction:column;min-height:0;max-height:100%;width:100%;max-width:1500px;background:#f3f5f7;color:#1d2732;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}\n.items-app *{box-sizing:border-box}\n.items-app button,.items-app input,.items-app select{font:inherit}\n.items-app button,.items-app select{cursor:pointer}\n.items-app .items-header{padding:18px 24px;background:#626b2f;color:#fff;flex-shrink:0}\n.items-app .items-topline{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.items-app .items-brand{font-size:10px;letter-spacing:1.4px;opacity:.85}\n.items-app h1{margin:3px 0 0;font-size:23px;color:#fff}\n.items-app .items-actions{display:flex;gap:8px}\n.items-app .items-actions button{padding:7px 11px;border:1px solid #ffffff66;background:#ffffff15;color:#fff;font-size:12px;font-weight:650}\n.items-app .items-actions button:hover{background:#ffffff30}\n.items-app .items-categories{display:flex;gap:0;flex-wrap:wrap;margin-top:15px}\n.items-app .items-categories button{border:1px solid #ffffff66;border-right:0;background:transparent;color:#fff;padding:7px 15px;font-size:12px;font-weight:700}\n.items-app .items-categories button:last-child{border-right:1px solid #ffffff66}\n.items-app .items-categories button.selected{background:#fff;color:#46511c}\n.items-app .items-filters{display:flex;gap:11px;flex-wrap:wrap;margin-top:12px}\n.items-app .items-filters label{display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:650}\n.items-app .items-filters select{padding:6px 9px;min-width:165px;background:#fff;border:1px solid #dce1e5;color:#253340;font-size:12px}\n.items-app .items-body{flex:1;min-height:0;overflow:auto;padding:18px 24px 26px}\n.items-app .items-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-bottom:13px}\n.items-app .items-summary-card{padding:13px 15px;border:1px solid #dce1e5;background:#fff}\n.items-app .items-summary-card .label{font-size:11px;color:#667584;font-weight:750;letter-spacing:.5px}\n.items-app .items-summary-card strong{display:block;font-size:24px;line-height:1.4;color:#34431d}\n.items-app .items-summary-card small{font-size:11px;color:#7b8792}\n.items-app .items-pareto{padding:14px 16px;background:#fff;border:1px solid #dce1e5;margin-bottom:13px}\n.items-app .items-pareto h2{font-size:14px;margin:0 0 7px;color:#626b2f}\n.items-app .pareto-chart{display:block;width:100%;height:auto;min-height:160px;max-height:260px}\n.items-app .pareto-legend{display:flex;gap:17px;flex-wrap:wrap;font-size:10px;color:#667584;margin-top:3px}\n.items-app .pareto-legend i{display:inline-block;width:13px;height:8px;margin-right:5px}\n.items-app .pareto-legend .core{background:#788344}.items-app .pareto-legend .tail{background:#b8c0c6}.items-app .pareto-legend .line{height:2px;background:#283746;vertical-align:middle}\n.items-app .items-tools{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:12px 0}\n.items-app .items-tier{display:flex;flex-wrap:wrap}\n.items-app .items-tier button{padding:7px 12px;border:1px solid #d7dde3;border-right:0;background:#fff;color:#425365;font-size:11px;font-weight:700}\n.items-app .items-tier button:last-child{border-right:1px solid #d7dde3}\n.items-app .items-tier button.selected{background:#253340;color:#fff;border-color:#253340}\n.items-app .items-search{padding:8px 10px;min-width:220px;background:#fff;border:1px solid #dce1e5;color:#253340;font-size:12px}\n.items-app .items-count{margin:0 0 7px;font-size:11px;color:#7b8792}\n.items-app .items-table-scroll{overflow-x:auto;background:#fff;border:1px solid #dce1e5}\n.items-app table{width:100%;min-width:1080px;border-collapse:collapse;table-layout:auto;font-size:12px;font-variant-numeric:tabular-nums}\n.items-app th,.items-app td{padding:10px 9px;border-bottom:1px solid #e3e7e9;text-align:right;white-space:nowrap}\n.items-app th{vertical-align:bottom;background:#eef1f3;color:#425365;font-size:10px;font-weight:750}\n.items-app th:first-child,.items-app td:first-child,.items-app th:nth-child(2),.items-app td:nth-child(2){text-align:left}\n.items-app td:nth-child(2){min-width:210px;white-space:normal;font-weight:650}\n.items-app tbody tr:nth-child(even){background:#fafbfc}.items-app tbody tr:hover{background:#f3f5ed}\n.items-app .items-group{display:inline-block;padding:2px 5px;font-size:10px;font-weight:650;background:#f0f2f4;color:#75818a}\n.items-app .items-group.core{background:#edf2dd;color:#526224}.items-app .items-group.tail{background:#eef1f4;color:#65727f}\n.items-app .items-note{font-size:10px;color:#7b8792;margin:9px 0 0}\n.items-app .items-empty{padding:15px;text-align:center;color:#7b8792;font-size:12px}\n.items-app .items-status{font-size:11px;color:#8b472b;padding:6px 0 0}\n.items-app button:focus-visible,.items-app input:focus-visible,.items-app select:focus-visible{outline:3px solid #b2bf86;outline-offset:2px}\n@media(max-width:750px){.items-overlay{padding:0}.items-app .items-header{padding:13px}.items-app .items-body{padding:13px}.items-app .items-summary{grid-template-columns:1fr}.items-app .items-summary-card{padding:10px 13px}.items-app .items-summary-card strong{font-size:20px}.items-app .items-categories button{padding:6px 10px}.items-app .items-actions button{font-size:11px}.items-app .items-filters label{flex:1}.items-app .items-filters select{min-width:140px;width:100%}}\n\n.items-app .items-filters label{flex:1;min-width:0}\n.items-app .items-filters select{width:100%;min-width:0}\n.items-app .items-filters label[hidden]{display:none!important}\n/* v0050: compact filter summary with an expandable button drawer. */\n#fohControls{--filter-color:var(--section);margin-top:12px!important;padding:0!important;border:0!important}\n.items-app{--filter-color:#626b2f}\n.filter-summary-toggle{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 12px;border:1px solid #ffffff66;border-radius:0;background:#ffffff10;color:#fff;text-align:left;font:inherit;touch-action:manipulation}\n.filter-summary-toggle:hover{background:#ffffff22}\n.filter-summary-toggle svg{width:17px;height:17px;flex:0 0 17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\n.filter-selection-summary{flex:1;min-width:0;font-size:13px;font-weight:650;line-height:1.4}\n.filter-summary-chevron{display:block;width:8px;height:8px;margin:0 3px 3px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transition:transform .16s ease;flex:0 0 8px}\n.filter-summary-toggle[aria-expanded=true] .filter-summary-chevron{transform:rotate(225deg);margin-bottom:-3px}\n.filter-drawer{padding:16px 0 2px}\n.filter-drawer[hidden],.filter-proxies{display:none!important}\n.filter-button-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}\n.filter-drawer.filter-live .filter-button-grid{grid-template-columns:repeat(2,minmax(0,1fr))}\n.filter-drawer.filter-only-period .filter-button-grid{grid-template-columns:1fr}\n.filter-button-grid fieldset{padding:0;margin:0;min-width:0;border:0}\n.filter-button-grid fieldset[hidden]{display:none!important}\n.filter-button-grid legend{padding:0;margin:0 0 7px;color:#fff;font-size:11px;font-weight:750;letter-spacing:1.1px}\n.filter-button-pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}\n.filter-period-buttons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}\n.filter-button-grid button{min-width:0;min-height:44px;padding:8px 6px;border:1px solid #ffffff88;border-radius:0;background:transparent;color:#fff;font-family:inherit;font-size:13px;font-weight:700;line-height:1.25;touch-action:manipulation;transition:background-color .15s ease,color .15s ease}\n.filter-button-grid .filter-period-buttons button{font-size:12px}\n.filter-button-grid button[aria-pressed=true]{color:var(--filter-color,#626b2f);background:#fff;border-color:#fff}\n.filter-button-grid button[aria-pressed=false]:hover{background:#ffffff22}\n#filterSummary{display:none!important}\n.items-app .filter-summary-toggle{margin-top:14px}\n.items-app .filter-summary-toggle svg{width:17px;height:17px}\n@media(max-width:700px){.filter-button-grid{grid-template-columns:1fr 1.2fr}.filter-period-field{grid-column:1/-1}.filter-selection-summary{font-size:12px}.filter-drawer{padding-top:14px}.filter-button-grid{gap:14px}}\n@media(max-width:500px){.filter-button-grid,.filter-drawer.filter-live .filter-button-grid{grid-template-columns:1fr}.filter-summary-toggle{padding:9px 10px;gap:8px}.sticky-area .section-view-toggle button{min-height:44px}}\n@media(prefers-reduced-motion:reduce){.filter-button-grid button,.filter-summary-chevron{transition:none}}\n";

document.addEventListener('keydown',event=>{
 const overlay=$('bestSellersOverlay');if(!overlay||overlay.hidden)return;
 if(event.key==='Escape'){event.preventDefault();closeBestSellersView();return}
 if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('button,input,select')].filter(element=>!element.hidden);const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
});


const dashboardViewStorageKey='jinya-dashboard-view-v1';

const dashboardRefreshIntervalMs=15*60*1000;

let lastDataUpdateAt=null,dashboardRefreshInProgress=false,lastFloorSourceAt=null,floorRefreshFailed=false;

document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>navigateDashboard(button.dataset.page));

$('liveView').onclick=()=>selectOriginalMode('live');
$('historyView').onclick=()=>selectOriginalMode('history');

$('period').onchange=()=>setDashboardPeriod($('period').value);

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&activeFilters().filtersOpen){setFiltersOpen(page,false);$('filterSummaryToggle').focus()}});

$('compare').onchange=render;
$('close').onclick=()=>$('drawerwrap').classList.remove('show');

$('drawerwrap').onclick=e=>{if(e.target===$('drawerwrap'))$('drawerwrap').classList.remove('show')};

document.onkeydown=e=>{if(e.key==='Escape')$('drawerwrap').classList.remove('show')};

// History trends use transaction totals and the selected report period.
const fohTrendViews={
 employee:{grain:'week',metric:'alcoholMix',keys:null,query:'',role:'all'},
 section:{grain:'week',metric:'salesPerGuest',keys:['section:inside-booths','section:inside-tables','section:inside-flex'],query:'',location:'all'},
 food:{grain:'week',metric:'units',keys:null,category:'food',query:''}
};

const fohTrendColors=['#b92335','#2167a8','#197a60','#8654a3','#b76819','#197f91','#a14b70','#606b22','#566884','#8b4f32','#477d33','#6551a8'];

const fohTrendMetrics={
 mix:[['share','Percent of Revenue','%']],
 employee:[['salesPerGuest','Revenue per Guest','$'],['alcoholPerGuest','Alcohol Revenue per Guest','$'],['alcoholMix','Alcohol Sales Mix','%'],['alcoholAttachment','Checks Including Alcohol','%'],['smallUnitsPerGuest','Small Plates per Guest','number'],['dessertUnitsPerGuest','Desserts per Guest','number'],['smallPerGuest','Small Plates Revenue per Guest','$'],['dessertPerGuest','Dessert Revenue per Guest','$'],['revenue','Total Revenue','$'],['checks','Checks','number']],
 section:[['guests','Number of Guests','number'],['salesPerGuest','Revenue per Guest','$'],['alcoholPerGuest','Alcohol Revenue per Guest','$'],['revenue','Total Revenue','$'],['alcoholMix','Alcohol Sales Mix','%'],['checks','Checks','number']],
 food:[['units','Number Sold','number'],['revenue','Revenue','$'],['totalShare','Percent of Total Revenue','%'],['categoryShare','Percent of Category Revenue','%'],['attachment','Checks Including Item','%']]
};

function trendMetric(domain){return fohTrendMetrics[domain].find(m=>m[0]===fohTrendViews[domain].metric)||fohTrendMetrics[domain][0]}

function isoWeekInfo(date){
 const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
 const year=d.getUTCFullYear(),first=new Date(Date.UTC(year,0,1));
 return {year,week:Math.ceil((((d-first)/86400000)+1)/7)};
}

function trendBuckets(window,grain){
 const start=new Date(window.start+'T00:00:00Z');
 let cursor=grain==='month'?window.start.slice(0,7)+'-01':shiftDate(window.start,-((start.getUTCDay()+6)%7));
 const buckets=[];
 while(cursor<=window.end){
  const next=grain==='month'?iso(new Date(Date.UTC(Number(cursor.slice(0,4)),Number(cursor.slice(5,7)),1))):shiftDate(cursor,7);
  const end=shiftDate(next,-1),from=cursor<window.start?window.start:cursor,to=end>window.end?window.end:end;
  const week=isoWeekInfo(cursor),month=new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(new Date(cursor+'T12:00:00Z'));
  buckets.push({key:cursor,start:from,end:to,label:grain==='month'?month:'W'+String(week.week).padStart(2,'0'),year:grain==='month'?Number(cursor.slice(0,4)):week.year,partial:from!==cursor||to!==end});
  cursor=next;
 }
 return buckets;
}

function trendNumber(value,unit,compact=false){
 if(value===null||!Number.isFinite(value))return '\u2014';
 if(compact&&value>=1000)return (unit==='$'?'$':'')+(value/1000).toFixed(value>=10000?0:1)+'k';
 return (unit==='$'?'$':'')+value.toLocaleString('en-US',{maximumFractionDigits:unit==='$'?2:1,minimumFractionDigits:unit==='$'&&!compact?2:0})+(unit==='%'?'%':'');
}

function trendWholeNumber(value,unit){
 return (unit==='$'?'$':'')+Math.round(value).toLocaleString('en-US')+(unit==='%'?'%':'');
}

function trendAxis(values){
 const low=Math.min(...values),high=Math.max(...values),span=high-low;
 const pad=span>0?span*.12:Math.max(Math.abs(high)*.08,1);
 const rawStep=(span+pad*2)/4,power=10**Math.floor(Math.log10(Math.max(rawStep,1)));
 const step=Math.max(1,([1,2,5,10].find(n=>n*power>=rawStep)||10)*power);
 const min=low>=0?Math.max(0,Math.floor((low-pad)/step)*step):Math.floor((low-pad)/step)*step;
 const max=Math.max(min+step,Math.ceil((high+pad)/step)*step),ticks=[];
 for(let v=min;v<=max;v+=step)ticks.push(v);
 return {min,max,step,ticks};
}


// A separate synthetic clock record exists even when an employee serves no check.
const syntheticTimeEntries=[];

for(let di=0;di<demoDates.length;di++){
 const date=demoDates[di];
 for(let si=0;si<staff.length;si++)if((di+si)%7!==0||si===0){const [name,part]=staff[si];syntheticTimeEntries.push({date,name,role:'server',start:part==='lunch'?630:990,end:part==='lunch'?1040:1350})}
 for(const [name,role,start,end] of [['Chris V.','bartender',990,1350],['Pat B.','bartender',630,1050],['Expo 1','expo',630,1050],['Expo 2','expo',990,1350],['Host 1','host',645,1050],['Host 2','host',990,1350]])syntheticTimeEntries.push({date,name,role,start,end});
 if(di%7===4||di%7===5)for(const [name,role] of [['Drew N.','bartender'],['Expo 3','expo'],['Host 3','host']])syntheticTimeEntries.push({date,name,role,start:1020,end:1350});
}

function intervalOverlap(a,b,c,d){return Math.max(0,Math.min(b,d)-Math.max(a,c))}


const operationalStorageKey='jinya-operational-records-v1';

const emptyOperationalData=()=>({schema:1,alcoholGoal:25,campaigns:[],seating:[],offers:[]});

let operationalData=emptyOperationalData(),operationalWarning='';

function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}

function validTime(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)}

function validateOperationalData(data){
 if(!data||data.schema!==1||!Number.isFinite(data.alcoholGoal)||data.alcoholGoal<0||data.alcoholGoal>100||!['campaigns','seating','offers'].every(k=>Array.isArray(data[k])&&data[k].length<=10000))throw Error('Invalid operational data.');
 for(const key of ['campaigns','seating','offers']){const ids=new Set();for(const record of data[key]){if(typeof record.id!=='string'||!/^[-A-Za-z0-9_]{1,100}$/.test(record.id)||ids.has(record.id))throw Error('Missing or duplicate record ID.');ids.add(record.id)}}
 for(const c of data.campaigns){if(typeof c.name!=='string'||!c.name.trim()||c.name.length>120||!validDate(c.start)||!validDate(c.end)||c.end<c.start||!validTime(c.from)||!validTime(c.to)||c.to<=c.from||!Array.isArray(c.weekdays)||!c.weekdays.length||!c.weekdays.every(x=>Number.isInteger(x)&&x>=0&&x<=6)||!['all',...salesMixTargetCategories.map(x=>x[0])].includes(c.category)||!['channel','notes','alohaIds'].every(k=>typeof c[k]==='string'&&c[k].length<=2000)||!(c.spend===null||Number.isFinite(c.spend)&&c.spend>=0)||typeof c.archived!=='boolean')throw Error('Invalid campaign dates, hours or fields. Campaign hours must end later on the same day.');}
 for(const s of data.seating){if(!validDate(s.date)||!validTime(s.from)||!validTime(s.to)||s.to<=s.from||!['available','occupied','unavailable','empty'].includes(s.state)||!Array.isArray(s.tables)||!s.tables.length||new Set(s.tables).size!==s.tables.length||!s.tables.every(n=>Number.isInteger(n)&&fohSeatingIndex.has(n))||typeof s.note!=='string'||s.note.length>2000)throw Error('Invalid seating interval or table IDs.');}
 for(const o of data.offers){if(!validDate(o.date)||!validTime(o.time)||!fohSections.some(s=>s.id===o.section)||!['accepted','declined'].includes(o.outcome)||!Number.isInteger(o.guests)||o.guests<1||o.guests>126||typeof o.note!=='string'||o.note.length>2000)throw Error('Invalid seating offer.');}
 return data;
}

try{const raw=localStorage.getItem(operationalStorageKey);if(raw)operationalData=validateOperationalData(JSON.parse(raw))}catch(e){operationalWarning='Saved operational records could not be loaded. Existing storage has not been overwritten. Import a valid backup before saving new records.'}

function saveOperationalData(next){
 try{validateOperationalData(next);if(operationalWarning)throw Error(operationalWarning);localStorage.setItem(operationalStorageKey,JSON.stringify(next));operationalData=next;return true}catch(e){const feedback=$('operationsFeedback');if(feedback)feedback.textContent=e.message;return false}
}

function operationalId(){return 'jqc-'+Date.now()+'-'+Math.random().toString(36).slice(2,10)}

function campaignActive(c,date,minute){return date>=c.start&&date<=c.end&&c.weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay())&&minute>=timeMinute(c.from)&&minute<timeMinute(c.to)}

function timeMinute(t){const [h,m]=t.split(':').map(Number);return h*60+m}

function mergeIntervals(list){const result=[];for(const pair of list.filter(p=>p[1]>p[0]).sort((a,b)=>a[0]-b[0])){const last=result[result.length-1];if(last&&pair[0]<=last[1])last[1]=Math.max(last[1],pair[1]);else result.push([...pair])}return result}

function intersectIntervals(a,b){return mergeIntervals(a.flatMap(x=>b.map(y=>[Math.max(x[0],y[0]),Math.min(x[1],y[1])])))}

function subtractIntervals(a,b){let result=mergeIntervals(a);for(const [from,to] of mergeIntervals(b)){result=result.flatMap(([s,e])=>to<=s||from>=e?[[s,e]]:[[s,Math.min(e,from)],[Math.max(s,to),e]].filter(p=>p[1]>p[0]))}return result}

function intervalMinutes(list){return list.reduce((n,[a,b])=>n+b-a,0)}

const rankingViews={food:{metric:'revenue',category:'all'},employee:{metric:'salesPerGuest',role:'all'},section:{metric:'guests',location:'all'}};

const rankingMetrics={food:[['revenue','Revenue','$'],['units','Number Sold','number']],employee:[['salesPerGuest','Revenue per Guest','$'],['alcoholPerGuest','Alcohol Revenue per Guest','$'],['upsellPerGuest','Upsells per Guest','number'],['smallUnitsPerGuest','Small Plates per Guest','number'],['dessertUnitsPerGuest','Desserts per Guest','number']],section:[['guests','Number of Guests','number'],['salesPerGuest','Revenue per Guest','$'],['alcoholPerGuest','Alcohol Revenue per Guest','$']]};


const trendScrollPositions={};

fohTrendViews.mix={grain:'week',metric:'share',keys:['alcohol'],query:'',presentation:'blended'};

const rankingColumns={
 food:[['categoryLabel','Category','text'],['name','Item','text'],['units','Servings','count'],['revenue','Revenue','money'],['checks','Checks','count']],
 employee:[['name','Server','text'],['salesPerGuest','Revenue / Guest','rate'],['alcoholMix','Alcohol Mix','percent'],['smallMix','Small Mix','percent'],['foodMix','Entrée Mix','percent'],['dessertMix','Dessert Mix','percent'],['drinkMix','Beverage Mix','percent'],['guests','Guests','count'],['checks','Checks','count']],
 section:[['name','Section','text'],['guests','Guests','count'],['checks','Checks','count'],['revenue','Revenue','money'],['salesPerGuest','Revenue / Guest','rate'],['alcoholPerGuest','Alcohol Rev / Guest','rate'],['alcoholMix','Alcohol Sales Mix','percent'],['alcoholAttachment','Checks with Alcohol','percent']]
};

function rankingCell(value,type){if(value===null||value===undefined)return '—';if(type==='text')return escapeHTML(value);return (type==='money'||type==='rate'?'$':'')+value.toLocaleString('en-US',{minimumFractionDigits:type==='rate'||type==='decimal'?2:0,maximumFractionDigits:type==='rate'||type==='decimal'?2:type==='percent'?1:0})+(type==='percent'?'%':'')}

// One complete-cost definition. Targets are the agreed prototype allocations.
const fohLaborTarget=.1375,bohLaborTarget=.1125;

// Reference Last 30 Days / All Day sample displays 13.71%; target stays 13.75%.
const fohLaborSampleHoursScale=.96463;

const fohLaborPositions=[{key:'server',label:'Server',share:.50,rate:12.5,factor:1.10},{key:'bartender',label:'Bar',share:.20,rate:13,factor:.90},{key:'expo',label:'Expo',share:.15,rate:17,factor:1.08},{key:'host',label:'Host',share:.15,rate:16,factor:.94}];

const fohLaborExpanded=new Set();

// v0120: hiring and turnover demonstration models. No HR/payroll source connected.
const fohStaffingGoal=90;

const fohHiringPositions=[
 {key:'server',label:'Server',filled:13,standard:15,lunchFilled:6,lunchStandard:7,weeklyHours:24},
 {key:'bar',label:'Bar',filled:5,standard:5,lunchFilled:2,lunchStandard:2,weeklyHours:26},
 {key:'expo',label:'Expo',filled:4,standard:4,lunchFilled:2,lunchStandard:2,weeklyHours:22},
 {key:'host',label:'Host',filled:4,standard:6,lunchFilled:2,lunchStandard:3,weeklyHours:18}
];


const fohTurnoverTargets=Object.freeze({foh:35,boh:35});

const fohTurnoverRoles=[{key:'server',label:'Server',average:14},{key:'bar',label:'Bar',average:5},{key:'expo',label:'Expo',average:4},{key:'host',label:'Host',average:4}];

const fohTurnoverFixture=(()=>{
 const counts={
  server:[1,1,1,1,1,1,1,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,0],
  bar:[0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  expo:Array(24).fill(0),host:[0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1]
 };
 return Array.from({length:25},(_,index)=>{
  const d=new Date(Date.UTC(2024,9+index,1)),year=d.getUTCFullYear(),month=d.getUTCMonth(),dayCount=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const start=year+'-'+String(month+1).padStart(2,'0')+'-01';
  return {start,end:year+'-'+String(month+1).padStart(2,'0')+'-'+dayCount,label:(month+1)+'/'+String(year).slice(-2),days:dayCount,roles:Object.fromEntries(fohTurnoverRoles.map((role,roleIndex)=>{
   const total=counts[role.key][index]||0,fired=index>=12&&((role.key==='server'&&(index===16||index===22))||(role.key==='host'&&index===23))?1:0;
   // Explicit dated DEMO events and cohort allocations, never estimates of
   // production departures from monthly totals. Preserve existing monthly sums.
   const departures=Array.from({length:total},(_,i)=>({date:shiftDate(start,Math.min(dayCount-1,6+(index*7+roleIndex*5+i*11)%dayCount)),daypart:(index+roleIndex+i)%2?'dinner':'lunch',reason:i<fired?'fired':'quit'}));
   const staffing=fohHiringPositions.find(item=>item.key===role.key),lunch=staffing.lunchFilled/staffing.filled;
   return [role.key,{employeeDays:role.average*dayCount,shiftShare:{lunch,dinner:1-lunch},departures,exits:{quit:total-fired,fired,other:0},transfersIn:0,transfersOut:0}];
  }))};
 });
})();

let fohTurnoverResizeObserver=null;



// Synthetic attendance records only; no POS/payroll connection or settings writes.
const fohAttendanceGoal=95;

const fohAttendanceOpenRoles=new Set();

// Gender values below belong only to these fictional demo profiles.
const fohAttendancePeople=[
 ['Alex M.','server',50,1,2,'male'],['Jordan R.','server',48,1,3,'female'],
 ['Taylor S.','server',48,4,3,'female'],['Morgan L.','server',46,3,3,'male'],
 ['Casey P.','server',45,3,4,'female'],['Riley K.','server',44,2,5,'male'],
 ['Jamie T.','server',42,3,4,'male'],['Sam D.','server',40,3,3,'female'],
 ['Avery B.','server',40,3,2,'male'],['Quinn H.','server',40,2,2,'female'],
 ['Sam C.','server',36,3,2,'female'],['Drew W.','server',34,2,3,'male'],['Devon F.','server',32,2,1,'male'],
 ['Chris V.','bar',60,2,3,'male'],['Drew N.','bar',58,2,5,'female'],['Pat B.','bar',56,2,5,'male'],
 ['Lee V.','bar',54,1,2,'female'],['Robin E.','bar',52,2,1,'male'],
 ['Sky M.','expo',54,1,2,'male'],['Noah G.','expo',52,1,3,'male'],
 ['Emerson Q.','expo',50,1,2,'female'],['Reese I.','expo',48,2,2,'female'],
 ['Blake Z.','host',50,4,3,'male'],['Hayden O.','host',48,4,2,'male'],
 ['Finley U.','host',44,3,3,'female'],['Parker Y.','host',42,3,5,'female']
].map(([name,role,shifts,bad,priorBad,gender],index)=>({gender,id:'attendance-'+index,name,role,shifts,bad,priorBad,index}));


const fohAttendanceRecords=(()=>{
 const records=[];
 // Each 90-day block has real dated shift records. Shorter/longer report
 // periods count those records rather than scaling percentages or event counts.
 for(let cycle=0;;cycle++){
  const end=shiftDate(DEMO_TODAY,-90*cycle),start=shiftDate(end,-89);
  if(end<DEMO_START)break;
  for(const person of fohAttendancePeople){
   const n=person.shifts,bad=cycle===0?person.bad:cycle===1?person.priorBad:Math.max(1,person.priorBad+(cycle+person.index)%3-1);
   const badIndices=new Set(Array.from({length:bad},(_,i)=>(Math.floor((i+.5)*n/bad)+person.index*3)%n));
   const free=Array.from({length:n},(_,i)=>i).filter(i=>!badIndices.has(i));
   const calloutIndex=bad>=3?[...badIndices][0]:-1;
   for(let i=0;i<n;i++){
    const offset=(Math.floor(i*90/n)+person.index*7)%90,date=shiftDate(start,offset);
    if(date<DEMO_START)continue;
    const shifts=serviceEmployees.find(employee=>employee.name===person.name)?.dayparts||[person.index%2?'dinner':'lunch'];
    records.push({id:person.id+'-'+cycle+'-'+i,employeeId:person.id,date,daypart:shifts[i%shifts.length],
     unexcusedCallout:i===calloutIndex,unexcusedLate:badIndices.has(i)&&i!==calloutIndex,
     excusedCallout:person.index%4===0&&i===free[0],excusedLate:person.index%7===0&&i===free[1],
     swap:i<person.index%3});
   }
  }
 }
 return records;
})();


const sectionSortColumns=[['label','Location / Section'],['checks','Checks'],['guests','Guests'],['grossCents','Rev'],['avgCheckCents','Avg Check'],['salesPerGuestCents','Rev / Guest'],['alcoholPerCheckCents','Alcohol / Check'],['alcoholPerGuestCents','Alcohol / Guest'],['alcoholMix','Alcohol Mix'],['alcoholIncluded','Alcohol Included']];

const sectionTableSort={locations:{key:'label',direction:1},sections:{key:'guests',direction:-1},unmapped:{key:'label',direction:1},employees:{key:'name',direction:1}};

const sectionEmployeeSortColumns=[['name','Server'],['selected.checks','Checks Here'],['selected.guests','Guests Here'],['selected.avgCheckCents','Avg Check Here'],['overall.avgCheckCents','Avg Check Overall'],['selected.alcoholPerGuestCents','Alcohol / Guest Here'],['overall.alcoholPerGuestCents','Alcohol / Guest Overall'],['selected.alcoholMix','Alcohol Mix Here']];

function externalSubsectionHeadings(html){
 return html.replace(/(<article\b[^>]*>)\s*<div class="head"><h2([^>]*)>([\s\S]*?)<\/h2>(?:<span class="section-period">([\s\S]*?)<\/span>)?<\/div>/g,(_,article,attrs,title,period)=>`<div class="subsection-heading"><h2${attrs.replace(/\sclass="[^"]*"/g,'')} class="foh-section-title">${title}</h2>${period?`<span class="section-period">${period}</span>`:''}</div>${article}`);
}



function serverRankingTargets(row){
 const records=selectedFOHChecks().filter(check=>check.server===row.key),reference=referenceSalesMixTargets(records);
 return {alcoholMix:operationalData.alcoholGoal,smallMix:reference.targets?.apps??null,foodMix:reference.targets?.food??null,dessertMix:reference.targets?.dessert??null,drinkMix:reference.targets?.drink??null};
}

function rankingTargetStatus(actual,goal){
 if(!Number.isFinite(actual)||!Number.isFinite(goal)||goal<=0)return {color:'neutral',label:'No positive target available'};
 const color=kpiTargetStatus(actual,goal,'performance');
 return {color,label:color==='yellow'?'Below target, within 10% of target':color==='green'?'At or above target':'More than 10% below target'};
}

function rankingTargetCell(domain,row,key,type,goals){
 const value=rankingCell(row[key],type);if(domain!=='employee'||type!=='percent'||row[key]===null)return value;
 const goal=goals?.[key],status=rankingTargetStatus(row[key],goal),description=status.label+(Number.isFinite(goal)?'; target '+goal.toFixed(1)+'%':'');
 return `<span class="rank-target-${status.color}" title="${description}" aria-label="${value}; ${description}">${value}</span>`;
}


const dashboardColorStorageKey='jinya-dashboard-colors-v1';

const dashboardColorDefaults={fohHeader:'#626B2F',mix:'#435E80',food:'#8C6135',server:'#366C52',section:'#76538D',staffing:'#596A75',operations:'#665B4D',executiveHeader:'#384D64',kitchenHeader:'#8B4938',inventoryHeader:'#386B68',fohSubhead:'#6F6F6F',siteBackground:'#E2E2E2'};

let dashboardColors={...dashboardColorDefaults},dashboardColorWarning='';

try{const raw=localStorage.getItem(dashboardColorStorageKey);if(raw){const saved=JSON.parse(raw);if(saved.schema!==1)throw Error('Invalid color version.');dashboardColors=validateDashboardColors(saved.colors)}}catch(e){dashboardColorWarning='Saved colors could not be read. Default colors are shown.'}

$('resetColors').onclick=resetDashboardColorFields;

applyDashboardColors();

let salesMixAllDayView='blended';


const defaultFOHAlertThresholds={waitlistMinutes:15,pickupMinutes:3,mealWaitMinutes:20};

let fohAlertThresholds={...defaultFOHAlertThresholds};

let settingsRevision=null,lastSavedSettings=null;

let adminDraft=null,adminEditingDaypart=null,adminSaving=false;

$('updateAdmin').onclick=updateAdmin;
;


let expandedMixChart=null,mixChartAnimating=false;

const baseRenderMixGrid=renderPersistentMixTrend;

renderPersistentMixTrend=function(){baseRenderMixGrid();for(const button of $('trendHost-mix').querySelectorAll('[data-expand-mix]'))button.onclick=()=>toggleExpandedMixChart(button.dataset.expandMix)};


const fohStaffingRoles=[['manager','Manager'],['server','Server'],['bartender','Bar'],['expo','Expo'],['host','Host']];

const sampleStaffingMinute=17*60+40;

function mondayOf(date){const d=new Date(date+'T12:00:00Z');return shiftDate(date,-((d.getUTCDay()+6)%7))}

let staffingWeekStart=shiftDate(mondayOf(DEMO_TODAY),-7);

function fohStaffingEntries(start,end){
 const entries=syntheticTimeEntries.filter(e=>inWindow(e.date,start,end));
 for(let date=start;date<=end;date=shiftDate(date,1)){if(date<DEMO_START||date>DEMO_TODAY)continue;entries.push({date,name:'Manager Lunch',role:'manager',start:630,end:1050},{date,name:'Manager Dinner',role:'manager',start:990,end:1350});const dow=new Date(date+'T12:00:00Z').getUTCDay();if(dow===5||dow===6)entries.push({date,name:'Manager Peak',role:'manager',start:1050,end:1320})}
 return entries;
}


let fohWorkspace='old',newFOHMode='history';


const LIVE_FLOOR_DOCUMENT="";
 // Live prototype retained in v0097.

let fohLivePage='attention';

let liveFloorMounted=false,liveFloorWasVisible=false;

for(const button of document.querySelectorAll('[data-floor-page]'))button.onclick=()=>selectFloorPage(button.dataset.floorPage);

window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('newFOHLiveFrame').contentWindow)return;if(e.data?.type==='jinya-floor-ready')syncFloorState();if(e.data?.type==='jinya-floor-open-page')selectFloorPage(e.data.page)});

$('floorMenuButton').onclick=()=>setFloorNavOpen(true);
$('floorNavClose').onclick=()=>{setFloorNavOpen(false);$('floorMenuButton').focus()};
$('floorNavShade').onclick=()=>setFloorNavOpen(false);

$('sidebarTargets').addEventListener('click',()=>setFloorNavOpen(false));

document.addEventListener('keydown',e=>{if(e.key==='Escape'){setFloorNavOpen(false)}});

window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('newFOHLiveFrame').contentWindow||e.data?.type!=='jinya-floor-height')return;const height=e.data.height;if(Number.isFinite(height)&&height>=0&&height<=100000)$('newFOHLiveFrame').style.height=Math.ceil(height)+'px'});



let adminCategory='foh';

const adminCategoryNames={executive:'General Manager',foh:'FOH',kitchen:'Kitchen',inventory:'Inventory',costs:'Costs',dashboard:'Dashboard'};

for(const b of document.querySelectorAll('[data-admin-category]'))b.onclick=()=>selectAdminCategory(b.dataset.adminCategory);

$('adminCategoryToggle').onclick=()=>{const open=$('adminCategoryToggle').getAttribute('aria-expanded')!=='true';$('adminCategoryToggle').setAttribute('aria-expanded',String(open));$('adminCategoryNav').classList.toggle('is-open',open)};



window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==$('newFOHLiveFrame').contentWindow)return;
 if(e.data?.type==='jinya-floor-updated'){
  const date=new Date(e.data.updatedAt);if(!Number.isFinite(date.getTime()))return;
  // Display the timestamp of the data actually rendered, even if a source rolls back.
  lastFloorSourceAt=date;floorRefreshFailed=false;renderCurrentRefreshStatus();
 }else if(e.data?.type==='jinya-floor-failed'){floorRefreshFailed=true;renderCurrentRefreshStatus()}
});


// FOH Alcohol uses the same check ownership and gross-item revenue as Sales Mix.
// Shared report dates, selected shift and employee population apply.
let fohAlcoholRenderedModel=null;

let fohAlcoholResizeObserver=null;

// FOH Small plates uses the same check ownership and gross-item revenue as Sales Mix.
// Shared report dates, selected shift and employee population apply.
let fohSmallPlatesRenderedModel=null;

let fohSmallPlatesResizeObserver=null;

// FOH Dessert uses the same check ownership and gross-item revenue as Sales Mix.
// Shared report dates, selected shift and employee population apply.
let fohDessertRenderedModel=null;

let fohDessertResizeObserver=null;


// Provisional profitability priorities. Replace these category weights with
// cost-informed weights when verified item costs are available. This is a
// sales-effectiveness index, not a measured profit or employee overall score.
const fohPerformanceWeights={alcohol:.50,apps:.30,dessert:.20};

let gmCategory='overview',gmMountedCategory=null;
const gmCategoryPages=new Map(),gmCategoryRequests=new Map();
for(const link of document.querySelectorAll('[data-gm-category]'))link.onclick=event=>{event.preventDefault();selectGMCategory(link.dataset.gmCategory)};

let fohCategory='overview',fohMountedCategory=null;
let fohModuleTarget=null;
const fohCategoryPages=new Map(),fohCategoryRequests=new Map();

for(const link of document.querySelectorAll('[data-foh-category]'))link.onclick=event=>{event.preventDefault();selectFOHCategory(link.dataset.fohCategory)};

for(const link of document.querySelectorAll('[data-module-jump]'))link.onclick=event=>{
 event.preventDefault();const target=$(link.dataset.moduleJump);if(target?.scrollIntoView)target.scrollIntoView({block:'start',behavior:'auto'});
 for(const other of document.querySelectorAll('[data-module-jump]'))other.classList.toggle('active',other===link);
};

$('sidebarTargets').addEventListener('click',()=>{setDashboardDrawer(false,false);$('closeTargets').focus({preventScroll:true})});

for(const button of document.querySelectorAll('[data-page]'))button.addEventListener('click',()=>setDashboardDrawer(false));




let dashboardDrawerOpen=false,dashboardDrawerPreviousFocus=null;

$('dashboardMenuButton').onclick=()=>setDashboardDrawer(!dashboardDrawerOpen);

$('dashboardDrawerClose').onclick=()=>setDashboardDrawer(false);

$('dashboardDrawerBackdrop').onclick=()=>setDashboardDrawer(false);

document.addEventListener('keydown',event=>{
 if(!dashboardDrawerOpen)return;
 if(event.key==='Escape'){event.preventDefault();setDashboardDrawer(false);return}
 if(event.key==='Tab'){
  const focusable=[...$('dashboardMenuItems').querySelectorAll('button:not([disabled]),a[href]')].filter(el=>!el.hidden);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true})}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true})}
 }
});



// Start after all four deferred scripts and their shared state are ready.
startPersistentDashboard();

