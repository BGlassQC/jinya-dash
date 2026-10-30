/* JINYA v0139 — Guest Relations. Check-level, positive satisfaction measure;
   transaction associations identify the serving employee, never fault. */

function fohGuestExperienceEvents(records,sourceLosses=losses){
 const selectedIds=new Set(records.map(check=>check.id)),events=[];
 // Demo-only classifications. Production needs verified Aloha reason codes;
 // a manager's approval alone never identifies a goodwill comp.
 for(const loss of sourceLosses){
  if(!selectedIds.has(loss.checkId))continue;
  const type=loss.type==='Refund'?'refund':loss.type==='Comp'?(loss.checkId%5===0?'problemComp':'goodwill'):null;
  if(type)events.push({id:'loss-'+events.length,checkId:loss.checkId,type,quantity:1});
 }
 const affected=new Set(events.filter(event=>event.type!=='goodwill').map(event=>event.checkId));
 for(const check of records){
  const food=check.items.filter(item=>['food','apps','dessert'].includes(item.category));
  const hash=(check.id*37+check.server.length*11)%997;
  if(food.length&&(hash%173===0||(affected.has(check.id)&&hash%2===0))){events.push({id:'remake-'+check.id,checkId:check.id,type:'remake',quantity:hash%3===0?2:1});affected.add(check.id)}
  if(!affected.has(check.id))continue;
  const type=hash%11===0?'noPay':hash%7===0?'canceled':hash%5===0?'void':hash%3===0?'inputError':null;
  if(type)events.push({id:'action-'+check.id,checkId:check.id,type,quantity:1});
 }
 return events;
}

function fohGuestExperienceSummary(records,events,people){
 records=[...new Map(records.map(check=>[check.id,check])).values()];
 const checksById=new Map(records.map(check=>[check.id,check]));
 const accepted=new Map();
 for(const event of events){
  if(checksById.has(event.checkId)&&event.id!=null&&!accepted.has(event.id))accepted.set(event.id,event);
 }
 const types=['refund','void','canceled','inputError','problemComp','noPay'];
 const qualifying=new Set([...types,'remake']);
 const affected=new Set([...accepted.values()].filter(event=>qualifying.has(event.type)).map(event=>event.checkId));
 const summarize=employeeChecks=>{
  const ids=new Set(employeeChecks.map(check=>check.id));
  const selectedEvents=[...accepted.values()].filter(event=>ids.has(event.checkId));
  const affectedChecks=employeeChecks.filter(check=>affected.has(check.id)).length;
  const items=employeeChecks.reduce((sum,check)=>sum+check.items.filter(item=>['food','apps','dessert'].includes(item.category)).reduce((n,item)=>n+(item.quantity??1),0),0);
  const counts=Object.fromEntries(types.map(type=>[type,new Set(selectedEvents.filter(event=>event.type===type).map(event=>event.checkId)).size]));
  const remakes=selectedEvents.filter(event=>event.type==='remake').reduce((sum,event)=>sum+(event.quantity??1),0);
  return {checks:employeeChecks.length,affectedChecks,score:employeeChecks.length?100*(employeeChecks.length-affectedChecks)/employeeChecks.length:null,items,remakes,counts};
 };
 const rows=people.map(person=>({...person,...summarize(records.filter(check=>check.server===person.name))})).filter(person=>person.checks>0);
 rows.sort((a,b)=>b.score-a.score||b.checks-a.checks||a.name.localeCompare(b.name));
 return {total:summarize(records),rows,types};
}

function fohGuestExperienceModel(){
 const allowed=new Set(currentRows().map(row=>row.server));
 const records=selectedFOHChecks().filter(check=>allowed.has(check.server));
 const people=serviceEmployees.filter(person=>allowed.has(person.name));
 return {...fohGuestExperienceSummary(records,fohGuestExperienceEvents(records),people),goal:98};
}

function fohGuestSatisfactionModuleHTML(){
 const model=fohGuestExperienceModel(),format=value=>value===null?'—':value.toFixed(1)+'%';
 const status=value=>kpiTargetClass(value,model.goal,'guestSatisfaction');
 const row=person=>`<tr><th scope="row" class="foh-table-role"><span class="gs-person"><span class="gs-badge foh-note" aria-label="${person.role==='bartender'?'Bartender':'Server'}">${person.role==='bartender'?'B':'S'}</span><span>${escapeHTML(person.name)}</span></span></th><td class="foh-table-value ${status(person.score)}">${format(person.score)}</td><td class="foh-table-role">${person.remakes.toLocaleString()} / ${person.items.toLocaleString()}</td>${model.types.map(type=>person.counts[type]?`<td class="foh-table-role">${person.counts[type].toLocaleString()}</td>`:'<td class="foh-table-role gs-zero" aria-label="0">-</td>').join('')}</tr>`;
 const meter=model.total.score===null?'':`<div class="gs-meter ${status(model.total.score)}" role="meter" aria-label="Guest Satisfaction" aria-valuenow="${model.total.score.toFixed(1)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${model.total.score}%"></span></div>`;
 const part=selectValue('daypart');
 return `<div id="jinya-guest-satisfaction"><div class="module-title foh-module-title"><h2>Guest Relations</h2></div><section class="gs-panel foh-metric-panel" aria-label="Guest Satisfaction">${fohMetricHeader('GUEST SATISFACTION',format(model.total.score),'Goal: 98%',status(model.total.score))}${meter}<div class="gs-scroll"><table class="gs-table foh-table" aria-label="Guest Satisfaction and recorded items by employee, highest satisfaction first"><colgroup><col class="gs-employee"><col class="gs-satisfaction"><col class="gs-remakes"><col span="6" class="gs-type"></colgroup><thead><tr><th scope="col">Employee</th><th scope="col">Guest<br>Satisfaction</th><th scope="col">Food<br>remakes</th><th scope="col">Refunds</th><th scope="col">Voids</th><th scope="col">Cancelled</th><th scope="col">Input<br>errors</th><th scope="col">Problem<br>comps</th><th scope="col">No<br>pay</th></tr></thead><tbody>${model.rows.map(row).join('')||'<tr><td colspan="9" class="foh-table-role gs-empty">No checks for this selection.</td></tr>'}</tbody></table></div></section></div>`;
}
