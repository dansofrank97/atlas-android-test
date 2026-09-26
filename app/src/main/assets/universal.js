/* Atlas Universal Intelligence Layer v0.4
   Local enterprise question routing + conversation context + posting basket +
   structured financial reports + online general-knowledge fallback.
   Business data below is DEMO DATA for the test APK, not a real company database. */
(function(){
'use strict';

var ENTERPRISE_KEY='atlas_enterprise_v1';
var BASKET_KEY='atlas_posting_basket_v1';
var CONTEXT_KEY='atlas_query_context_v1';

function deepCopy(x){return JSON.parse(JSON.stringify(x));}
function isoDate(d){try{return new Date(d).toISOString()}catch(e){return String(d||'')}}
function todayText(){return new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});}
function dateText(v){var d=new Date(v);return isNaN(d.getTime())?String(v):d.toLocaleString(undefined,{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9₵%&. ]+/g,' ').replace(/\s+/g,' ').trim();}
function has(s,re){return re.test(norm(s));}
function sum(arr,fn){var n=0;for(var i=0;i<arr.length;i++)n+=Number(fn?fn(arr[i]):arr[i])||0;return n;}
function fmtNum(n){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});}
function fmtMoney(n){return typeof money==='function'?money(n):('GH₵ '+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));}
function accountBal(name){return typeof bal==='function'?Number(bal(name)||0):0;}

function freshEnterprise(){
 return {
  version:1,
  demo:true,
  company:{name:'Atlas Demo Enterprise',currency:'GHS',country:'Ghana',reportingBasis:'IFRS-oriented test presentation'},
  customers:[
   {id:'C001',name:'ABC Ltd',balance:4500,overdue:4500,daysOverdue:18,lastInvoice:'2026-09-08',phone:'024 000 0001'},
   {id:'C002',name:'Kofi Traders',balance:3200,overdue:0,daysOverdue:0,lastInvoice:'2026-09-20',phone:'024 000 0002'},
   {id:'C003',name:'Mawuse Ventures',balance:2800,overdue:0,daysOverdue:0,lastInvoice:'2026-09-22',phone:'024 000 0003'},
   {id:'C004',name:'Adom Stores',balance:2400,overdue:0,daysOverdue:0,lastInvoice:'2026-09-24',phone:'024 000 0004'},
   {id:'C005',name:'Grace Mart',balance:0,overdue:0,daysOverdue:0,lastInvoice:'2026-09-15',phone:'024 000 0005'}
  ],
  products:[
   {id:'P001',sku:'FAN18',name:'Standing Fan 18-inch',stock:12,reorder:10,cost:350,price:520,supplier:'Akoma Appliances',lastPurchase:'2026-09-18',lastPurchaseQty:20,lastPurchaseUnitCost:345,sales30d:28},
   {id:'P002',sku:'BLD15',name:'Blender 1.5L',stock:8,reorder:10,cost:260,price:390,supplier:'Akoma Appliances',lastPurchase:'2026-09-12',lastPurchaseQty:15,lastPurchaseUnitCost:255,sales30d:19},
   {id:'P003',sku:'KET20',name:'Electric Kettle 2L',stock:25,reorder:8,cost:180,price:275,supplier:'Nhyira Wholesale',lastPurchase:'2026-09-21',lastPurchaseQty:30,lastPurchaseUnitCost:175,sales30d:16},
   {id:'P004',sku:'IRON1',name:'Steam Iron',stock:18,reorder:8,cost:210,price:315,supplier:'Nhyira Wholesale',lastPurchase:'2026-09-10',lastPurchaseQty:20,lastPurchaseUnitCost:205,sales30d:11},
   {id:'P005',sku:'TV32',name:'32-inch Smart TV',stock:4,reorder:5,cost:1450,price:1850,supplier:'Prime Electronics',lastPurchase:'2026-08-29',lastPurchaseQty:6,lastPurchaseUnitCost:1425,sales30d:7},
   {id:'P006',sku:'RICE25',name:'Rice 25kg',stock:31,reorder:12,cost:430,price:495,supplier:'Unity Foods',lastPurchase:'2026-09-23',lastPurchaseQty:40,lastPurchaseUnitCost:425,sales30d:33}
  ],
  employees:[
   {id:'E001',name:'Ama Mensah',role:'HR Manager',department:'Human Resources',status:'Active',joined:'2024-03-01',monthlySalary:6200},
   {id:'E002',name:'Kojo Asante',role:'Accountant',department:'Finance',status:'Active',joined:'2025-01-15',monthlySalary:5800},
   {id:'E003',name:'Esi Owusu',role:'Sales Manager',department:'Sales',status:'Active',joined:'2023-10-10',monthlySalary:6500},
   {id:'E004',name:'Yaw Boateng',role:'Storekeeper',department:'Stores',status:'Active',joined:'2025-06-05',monthlySalary:3900},
   {id:'E005',name:'Akosua Frimpong',role:'Sales Officer',department:'Sales',status:'Active',joined:'2026-02-01',monthlySalary:3600},
   {id:'E006',name:'Daniel Osei',role:'Driver',department:'Operations',status:'Active',joined:'2024-08-12',monthlySalary:3200}
  ],
  suppliers:[
   {id:'S001',name:'Akoma Appliances',balance:5200,lastPurchase:'2026-09-18',purchases90d:22400},
   {id:'S002',name:'Nhyira Wholesale',balance:3500,lastPurchase:'2026-09-21',purchases90d:16800},
   {id:'S003',name:'Prime Electronics',balance:2300,lastPurchase:'2026-08-29',purchases90d:8700},
   {id:'S004',name:'Unity Foods',balance:0,lastPurchase:'2026-09-23',purchases90d:19100}
  ],
  banks:[{name:'GCB Bank',balance:7200},{name:'Ecobank',balance:4800}],
  meetings:[
   {id:'M001',title:'Weekly Operations Meeting',start:'2026-09-28T09:00:00Z',location:'Main Office',attendees:['Ama Mensah','Kojo Asante','Esi Owusu','Yaw Boateng'],notes:'Sales, collections, inventory and weekly priorities.'},
   {id:'M002',title:'Supplier Review',start:'2026-09-30T14:00:00Z',location:'Conference Room',attendees:['Kojo Asante','Yaw Boateng','Esi Owusu'],notes:'Supplier pricing, reorder levels and payment plan.'},
   {id:'M003',title:'Monthly Management Meeting',start:'2026-10-02T10:00:00Z',location:'Main Office',attendees:['Ama Mensah','Kojo Asante','Esi Owusu','Yaw Boateng','Akosua Frimpong'],notes:'September performance and October plan.'}
  ]
 };
}

function loadJson(key,fallback){try{var x=JSON.parse(localStorage.getItem(key)||'null');return x||fallback;}catch(e){return fallback;}}
var enterprise=loadJson(ENTERPRISE_KEY,freshEnterprise());
var atlasBasket=loadJson(BASKET_KEY,[]);
var atlasQueryContext=loadJson(CONTEXT_KEY,null);
function saveEnterprise(){localStorage.setItem(ENTERPRISE_KEY,JSON.stringify(enterprise));}
function saveBasket(){localStorage.setItem(BASKET_KEY,JSON.stringify(atlasBasket));renderBasketCard();}
function saveContext(c){atlasQueryContext=c||null;if(c)localStorage.setItem(CONTEXT_KEY,JSON.stringify(c));else localStorage.removeItem(CONTEXT_KEY);}

/* Correct only the untouched historical demo opening balance from v0.2/v0.3. */
function repairLegacyDemoOpening(){
 try{
  if(state&&state.transactions&&state.transactions.length===0&&state.accounts&&state.accounts['Retained Earnings']&&Number(state.accounts['Retained Earnings'].balance)===19440){
   state.accounts['Retained Earnings'].balance=7440;
   if(typeof save==='function')save();
  }
 }catch(e){}
}

/* ---------------- POSTING BASKET ---------------- */
var atlasOriginalReviewPosting=window.reviewPosting;
window.reviewPosting=function(p){
 var err=(p&&p.error)||(typeof validateLines==='function'?validateLines((p&&p.lines)||[]):'');
 if(err){if(typeof chat==='function')chat('Atlas',err);return false;}
 var item={id:'B'+Date.now()+'_'+Math.floor(Math.random()*10000),memo:p.memo||'Journal posting',lines:deepCopy(p.lines||[]),source:p.source||'Ask Atlas',addedAt:new Date().toISOString()};
 atlasBasket.push(item);saveBasket();
 if(typeof pending!=='undefined')pending=null;
 var total=sum(item.lines,function(l){return Number(l.debit||0);});
 chatHtml('<b>Atlas:</b> I added <b>'+esc(item.memo)+'</b> ('+fmtMoney(total)+') to your <b>Posting Basket</b>.<br><br>You now have <b>'+atlasBasket.length+'</b> transaction'+(atlasBasket.length===1?'':'s')+' waiting. Tell me the next activity, or say <b>done</b> when you want to review everything.'+
  '<div class="chatBtns"><button onclick="showPostingBasket()">View basket</button><button class="secondary" onclick="atlasChoice(\'done\')">Done</button></div>');
 return true;
};

window.showPostingBasket=function(){
 if(!atlasBasket.length){modal('<h2>Posting Basket</h2><p class="muted">The basket is empty. Tell Atlas a transaction in ordinary words and it will be added here after clarification.</p>');return;}
 var grand=0,html='<h2>Posting Basket</h2><p class="muted">Nothing below has been posted yet. Review the full batch first.</p>';
 for(var i=0;i<atlasBasket.length;i++){
  var p=atlasBasket[i],tot=sum(p.lines,function(l){return Number(l.debit||0);});grand+=tot;
  html+='<div style="border:1px solid #e2e7ef;border-radius:14px;padding:12px;margin:9px 0"><b>'+(i+1)+'. '+esc(p.memo)+'</b><div class="muted" style="margin:5px 0">'+fmtMoney(tot)+'</div>';
  html+='<div class="miniTable"><table><tr><th>Account</th><th>Debit</th><th>Credit</th></tr>';
  for(var j=0;j<p.lines.length;j++){var l=p.lines[j];html+='<tr><td>'+esc(l.account)+'</td><td>'+(l.debit?fmtMoney(l.debit):'')+'</td><td>'+(l.credit?fmtMoney(l.credit):'')+'</td></tr>';}
  html+='</table></div><button class="secondary full" onclick="removeBasketItem(\''+p.id+'\')">Remove this transaction</button></div>';
 }
 html+='<div class="reportLine"><b>Batch total</b><b>'+fmtMoney(grand)+'</b></div><div class="exportRow"><button onclick="confirmPostBasket()">Post all '+atlasBasket.length+'</button><button class="secondary" onclick="clearPostingBasket()">Clear basket</button></div>';
 modal(html);
};
window.removeBasketItem=function(id){atlasBasket=atlasBasket.filter(function(x){return x.id!==id});saveBasket();closeModal();showPostingBasket();};
window.clearPostingBasket=function(){if(confirm('Clear all unposted transactions from the basket?')){atlasBasket=[];saveBasket();closeModal();chat('Atlas','Posting Basket cleared. Nothing was posted.');}};
window.confirmPostBasket=function(){
 if(!atlasBasket.length)return;
 var html='<h2>Final posting confirmation</h2><p>You are about to post <b>'+atlasBasket.length+'</b> transaction'+(atlasBasket.length===1?'':'s')+' to the local test ledger. Posted entries remain in the journal and are not replaced by later entries.</p><button class="full" onclick="postAllBasketNow()">Confirm and post all</button><button class="secondary full" style="margin-top:8px" onclick="closeModal()">Go back</button>';
 modal(html);
};
window.postAllBasketNow=function(){
 for(var i=0;i<atlasBasket.length;i++){var e=validateLines(atlasBasket[i].lines);if(e){toast('Basket item '+(i+1)+': '+e);return;}}
 var copy=atlasBasket.slice(),posted=0;
 for(var j=0;j<copy.length;j++){if(post(copy[j].lines,copy[j].memo,'Posting Basket')){posted++;syncEnterpriseFromPosting(copy[j]);}else break;}
 if(posted===copy.length){atlasBasket=[];saveBasket();closeModal();chatHtml('<b>Atlas:</b> Posted <b>'+posted+'</b> transaction'+(posted===1?'':'s')+' successfully. Your previous journal entries remain intact, and the dashboard and reports now include the new batch.');}
};
function syncEnterpriseFromPosting(p){
 try{
  var text=norm(p.memo),debitAR=0,creditAR=0;
  for(var i=0;i<p.lines.length;i++){if(p.lines[i].account==='Accounts Receivable'){debitAR+=Number(p.lines[i].debit||0);creditAR+=Number(p.lines[i].credit||0);}}
  if(debitAR>0){var m=text.match(/sale to ([a-z0-9 &.'-]+)/i);if(m){var c=findCustomer(m[1]);if(c)c.balance+=debitAR;}}
  if(creditAR>0){var names=enterprise.customers.filter(function(c){return text.indexOf(norm(c.name))>=0});if(names.length)names[0].balance=Math.max(0,Number(names[0].balance)-creditAR);}
  saveEnterprise();
 }catch(e){}
}
function renderBasketCard(){
 var c=document.getElementById('atlasBasketCard');if(!c)return;
 var count=atlasBasket.length,total=0;for(var i=0;i<count;i++)total+=sum(atlasBasket[i].lines,function(l){return Number(l.debit||0);});
 c.innerHTML='<div class="sectionTitle"><b>Posting Basket</b><button onclick="showPostingBasket()">Review</button></div><div style="display:flex;justify-content:space-between;align-items:end;margin-top:10px"><div><span class="muted">Unposted transactions</span><div style="font-size:24px;font-weight:850;margin-top:3px">'+count+'</div></div><div style="text-align:right"><span class="muted">Batch value</span><div style="font-weight:800;margin-top:3px">'+fmtMoney(total)+'</div></div></div>'+(count?'<div class="muted" style="margin-top:8px">Keep telling Atlas more activities. They remain here until you post or remove them.</div>':'<div class="muted" style="margin-top:8px">New interpreted transactions will collect here until you say “done”.</div>');
}

/* ---------------- ENTERPRISE KNOWLEDGE ---------------- */
function findCustomer(q){q=norm(q);var best=null;for(var i=0;i<enterprise.customers.length;i++){var c=enterprise.customers[i],n=norm(c.name);if(q===n||q.indexOf(n)>=0||n.indexOf(q)>=0){best=c;break;}}return best;}
function findProduct(q){q=norm(q);var best=null;for(var i=0;i<enterprise.products.length;i++){var p=enterprise.products[i],n=norm(p.name);if(q.indexOf(norm(p.sku))>=0||q.indexOf(n)>=0||n.indexOf(q)>=0){best=p;break;}var words=n.split(' ');for(var w=0;w<words.length;w++)if(words[w].length>3&&q.indexOf(words[w])>=0){best=p;break;}if(best)break;}return best;}
function findEmployee(q){q=norm(q);for(var i=0;i<enterprise.employees.length;i++){var e=enterprise.employees[i];if(q.indexOf(norm(e.name))>=0||q.indexOf(norm(e.role))>=0)return e;}return null;}
function owingCustomers(){return enterprise.customers.filter(function(c){return Number(c.balance)>0});}
function setEntityContext(type,items,label){saveContext({type:type,ids:items.map(function(x){return x.id}),label:label||type,at:new Date().toISOString()});}
function contextItems(){if(!atlasQueryContext)return[];var src=atlasQueryContext.type==='customers'?enterprise.customers:atlasQueryContext.type==='products'?enterprise.products:atlasQueryContext.type==='employees'?enterprise.employees:atlasQueryContext.type==='meetings'?enterprise.meetings:atlasQueryContext.type==='suppliers'?enterprise.suppliers:[];return src.filter(function(x){return atlasQueryContext.ids.indexOf(x.id)>=0});}
function demoNote(){return '<div class="muted" style="margin-top:8px">Source: sample company data stored in this test APK. Connect real company systems for production answers.</div>';}
function listNames(items,extra){return items.map(function(x,i){return (i+1)+'. <b>'+esc(x.name||x.title)+'</b>'+(extra?extra(x):'');}).join('<br>');}

function answerFollowUp(text){
 if(!atlasQueryContext)return null;var s=norm(text),items=contextItems();if(!items.length)return null;
 if(/^(who are they|who are these|give me their names|names|list them|show them)$/.test(s)||/who exactly/.test(s)){
  if(atlasQueryContext.type==='customers')return listNames(items,function(c){return ' — '+fmtMoney(c.balance)+(c.overdue?' ('+fmtMoney(c.overdue)+' overdue)':'');})+demoNote();
  if(atlasQueryContext.type==='products')return listNames(items,function(p){return ' — '+fmtNum(p.stock)+' units';})+demoNote();
  if(atlasQueryContext.type==='employees')return listNames(items,function(e){return ' — '+esc(e.role);})+demoNote();
  if(atlasQueryContext.type==='meetings')return listNames(items,function(m){return ' — '+esc(dateText(m.start));})+demoNote();
 }
 if(/how much.*(owe|owing)|total.*(owe|balance)/.test(s)&&atlasQueryContext.type==='customers')return 'Together, '+esc(atlasQueryContext.label)+' owe <b>'+fmtMoney(sum(items,function(c){return c.balance;}))+'</b>.'+demoNote();
 if(/how many/.test(s))return 'There are <b>'+items.length+'</b> '+esc(atlasQueryContext.label)+'.'+demoNote();
 if(/who.*attend|attendees|who.*coming/.test(s)&&atlasQueryContext.type==='meetings'){var a=[];items.forEach(function(m){a=a.concat(m.attendees||[])});a=a.filter(function(v,i,x){return x.indexOf(v)===i});return 'Attendees: <b>'+esc(a.join(', '))+'</b>.'+demoNote();}
 return null;
}

function businessAnswer(text){
 var s=norm(text),follow=answerFollowUp(text);if(follow)return follow;
 var owing=owingCustomers();
 if(/how many (customers|clients|debtors).*(owe|owing)|how many.*(owe us|owing us)|number of debtors/.test(s)){
  setEntityContext('customers',owing,'customers owing us');return '<b>'+owing.length+' customers</b> currently owe the business <b>'+fmtMoney(sum(owing,function(c){return c.balance;}))+'</b>. '+enterprise.customers.filter(function(c){return c.overdue>0}).length+' of them have overdue balances.'+demoNote();
 }
 if(/who (owes|is owing)|which customers.*(owe|owing)|list.*debtors|show.*debtors/.test(s)){
  setEntityContext('customers',owing,'customers owing us');return listNames(owing,function(c){return ' — '+fmtMoney(c.balance)+(c.overdue?' · overdue '+c.daysOverdue+' days':'');})+demoNote();
 }
 if(/who owes.*(most|highest)|largest debtor|biggest debtor/.test(s)){var x=owing.slice().sort(function(a,b){return b.balance-a.balance})[0];setEntityContext('customers',[x],'largest debtor');return '<b>'+esc(x.name)+'</b> owes the most at <b>'+fmtMoney(x.balance)+'</b>.'+(x.overdue?' '+fmtMoney(x.overdue)+' is overdue.':'')+demoNote();}
 if(/overdue customers|customers.*overdue|who.*overdue/.test(s)){var od=enterprise.customers.filter(function(c){return c.overdue>0});setEntityContext('customers',od,'overdue customers');return od.length?listNames(od,function(c){return ' — '+fmtMoney(c.overdue)+' overdue by '+c.daysOverdue+' days';})+demoNote():'No sample customers are overdue.'+demoNote();}
 if(/how many customers|number of customers|customer count/.test(s)){setEntityContext('customers',enterprise.customers,'customers');return 'The customer master contains <b>'+enterprise.customers.length+' customers</b>. '+owing.length+' currently have outstanding balances.'+demoNote();}

 if(/how many products|number of products|product count|how many product lines/.test(s)){setEntityContext('products',enterprise.products,'products');return 'There are <b>'+enterprise.products.length+' active products/SKUs</b> in the sample catalogue, with <b>'+fmtNum(sum(enterprise.products,function(p){return p.stock;}))+' total units</b> on hand.'+demoNote();}
 if(/how many stocks|how much stock|stock do we have|units.*stock|total stock/.test(s)){setEntityContext('products',enterprise.products,'products in stock');return 'Current sample stock is <b>'+fmtNum(sum(enterprise.products,function(p){return p.stock;}))+' units</b> across '+enterprise.products.length+' products. Estimated cost value is <b>'+fmtMoney(sum(enterprise.products,function(p){return p.stock*p.cost;}))+'</b>.'+demoNote();}
 if(/low stock|reorder|running low|out of stock/.test(s)){var low=enterprise.products.filter(function(p){return p.stock<=p.reorder});setEntityContext('products',low,'low-stock products');return low.length?listNames(low,function(p){return ' — '+p.stock+' units; reorder level '+p.reorder;})+demoNote():'No products are currently at or below reorder level.'+demoNote();}
 if(/top selling|best selling|fastest selling|selling most/.test(s)){var top=enterprise.products.slice().sort(function(a,b){return b.sales30d-a.sales30d})[0];setEntityContext('products',[top],'top-selling product');return '<b>'+esc(top.name)+'</b> is the top sample seller over the last 30 days with <b>'+top.sales30d+' units</b> sold.'+demoNote();}
 if(/inventory value|stock value|value of stock/.test(s))return 'Estimated sample inventory cost value is <b>'+fmtMoney(sum(enterprise.products,function(p){return p.stock*p.cost;}))+'</b>. This product-detail value is separate from the accounting-ledger inventory balance in this test build.'+demoNote();
 var prod=findProduct(s);
 if(prod&&/(stock|units|quantity|how many)/.test(s)){setEntityContext('products',[prod],prod.name);return '<b>'+esc(prod.name)+'</b> has <b>'+prod.stock+' units</b> on hand. Reorder level is '+prod.reorder+'.'+demoNote();}
 if(prod&&/(last.*(buy|bought|purchase)|when.*(buy|bought|purchase))/.test(s)){setEntityContext('products',[prod],prod.name);return 'The last sample purchase of <b>'+esc(prod.name)+'</b> was <b>'+esc(prod.lastPurchase)+'</b>: '+prod.lastPurchaseQty+' units at '+fmtMoney(prod.lastPurchaseUnitCost)+' each from '+esc(prod.supplier)+'.'+demoNote();}
 if(prod&&/(supplier|who supplies|bought from)/.test(s)){setEntityContext('products',[prod],prod.name);return '<b>'+esc(prod.supplier)+'</b> is the recorded supplier for '+esc(prod.name)+'.'+demoNote();}
 if(prod&&/(price|cost|selling price)/.test(s)){return esc(prod.name)+': latest unit cost <b>'+fmtMoney(prod.lastPurchaseUnitCost)+'</b>; current selling price <b>'+fmtMoney(prod.price)+'</b>.'+demoNote();}

 var active=enterprise.employees.filter(function(e){return e.status==='Active'});
 if(/how many (employees|staff|workers)|employee count|staff count/.test(s)){setEntityContext('employees',active,'active employees');return 'There are <b>'+active.length+' active employees</b> in the sample employee master.'+demoNote();}
 if(/employee names|staff names|names of.*employees|list.*employees|list.*staff/.test(s)){setEntityContext('employees',active,'active employees');return listNames(active,function(e){return ' — '+esc(e.role)+' · '+esc(e.department);})+demoNote();}
 if(/who.*(hr|human resources)|name.*(hr|human resources)|hr manager/.test(s)){var hr=enterprise.employees.filter(function(e){return /human resources|hr/i.test(e.department+' '+e.role)})[0];setEntityContext('employees',[hr],'HR');return 'The sample HR lead is <b>'+esc(hr.name)+'</b>, '+esc(hr.role)+'.'+demoNote();}
 if(/who.*accountant|finance staff|who.*finance/.test(s)){var fin=enterprise.employees.filter(function(e){return /finance|accountant/i.test(e.department+' '+e.role)});setEntityContext('employees',fin,'finance employees');return listNames(fin,function(e){return ' — '+esc(e.role);})+demoNote();}
 var emp=findEmployee(s);if(emp&&/(who is|role|department|joined|salary)/.test(s)){setEntityContext('employees',[emp],emp.name);return '<b>'+esc(emp.name)+'</b> is '+esc(emp.role)+' in '+esc(emp.department)+', joined '+esc(emp.joined)+'. Sample monthly salary: '+fmtMoney(emp.monthlySalary)+'.'+demoNote();}
 if(/payroll|salary total|total salaries|monthly salaries/.test(s))return 'Sample monthly payroll for active employees is <b>'+fmtMoney(sum(active,function(e){return e.monthlySalary;}))+'</b> before statutory deductions and employer costs.'+demoNote();

 if(/next meeting|when.*meeting|upcoming meeting/.test(s)){var now=Date.now(),future=enterprise.meetings.filter(function(m){return new Date(m.start).getTime()>=now}).sort(function(a,b){return new Date(a.start)-new Date(b.start)});var mt=future[0]||enterprise.meetings.slice().sort(function(a,b){return new Date(a.start)-new Date(b.start)})[0];if(!mt)return 'No meeting is recorded in the sample calendar.'+demoNote();setEntityContext('meetings',[mt],'next meeting');return 'Your next recorded sample meeting is <b>'+esc(mt.title)+'</b> on <b>'+esc(dateText(mt.start))+'</b> at '+esc(mt.location)+'. Attendees: '+esc(mt.attendees.join(', '))+'.'+demoNote();}
 if(/meetings.*(week|upcoming)|show.*meetings|list.*meetings/.test(s)){var mts=enterprise.meetings.slice().sort(function(a,b){return new Date(a.start)-new Date(b.start)});setEntityContext('meetings',mts,'upcoming meetings');return listNames(mts,function(m){return ' — '+esc(dateText(m.start))+' · '+esc(m.location);})+demoNote();}

 if(/how many suppliers|supplier count|number of suppliers/.test(s)){setEntityContext('suppliers',enterprise.suppliers,'suppliers');return 'There are <b>'+enterprise.suppliers.length+' suppliers</b> in the sample supplier master.'+demoNote();}
 if(/list.*suppliers|supplier names|who.*suppliers/.test(s)){setEntityContext('suppliers',enterprise.suppliers,'suppliers');return listNames(enterprise.suppliers,function(x){return ' — balance '+fmtMoney(x.balance);})+demoNote();}
 if(/biggest supplier|top supplier|supplier.*most/.test(s)){var sp=enterprise.suppliers.slice().sort(function(a,b){return b.purchases90d-a.purchases90d})[0];setEntityContext('suppliers',[sp],'top supplier');return '<b>'+esc(sp.name)+'</b> has the highest sample 90-day purchases at '+fmtMoney(sp.purchases90d)+'.'+demoNote();}

 if(/last (posting|transaction|journal)|most recent (posting|transaction)/.test(s)){if(!state.transactions.length)return 'No transactions have been posted in this local test ledger yet.';var tx=state.transactions[0];return 'The most recent posted transaction is <b>'+esc(tx.memo)+'</b> on '+esc(dateText(tx.date))+', with total debits of '+fmtMoney(sum(tx.lines,function(l){return l.debit;}))+'.';}
 if(/how many (postings|transactions|journal entries)/.test(s))return 'The local test ledger currently contains <b>'+state.transactions.length+' posted transaction'+(state.transactions.length===1?'':'s')+'</b>. The Posting Basket contains '+atlasBasket.length+' unposted transaction'+(atlasBasket.length===1?'':'s')+'.';
 if(/what.*company name|name of.*company/.test(s))return 'The test company is <b>'+esc(enterprise.company.name)+'</b>.'+demoNote();
 return null;
}

/* ---------------- STANDARD REPORTING ---------------- */
function acct(name){return state.accounts&&state.accounts[name]?Number(state.accounts[name].balance||0):0;}
function allAccountsByType(type){var a=[];Object.keys(state.accounts||{}).forEach(function(n){if(state.accounts[n].type===type)a.push({name:n,balance:Number(state.accounts[n].balance||0)});});return a;}
function displayAmount(n){n=Number(n||0);return n<0?'('+fmtMoney(Math.abs(n)).replace('GH₵ ','')+')':fmtMoney(n).replace('GH₵ ','');}
function sectionRows(title,items,totalLabel){var rows=[[title,'']];var total=0;items.forEach(function(x){var v=Number(x.value||0);total+=v;rows.push(['  '+x.label,displayAmount(v)]);});rows.push([totalLabel,displayAmount(total)]);return{rows:rows,total:total};}
var atlasOriginalBuildReport=window.buildReport;
window.buildReport=function(type){
 var t=totals(),co=enterprise.company.name,now=new Date(),date=now.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),summary=[],rows=[],title='';
 if(type==='balance'){
  title=co+' — Statement of Financial Position';
  var nonCurrentNames=['Furniture','Computer Equipment','Office Equipment','Motor Vehicles','Equipment','Building','Land','Communication Equipment'];
  var nc=[];nonCurrentNames.forEach(function(n){if(state.accounts[n]&&acct(n)!==0)nc.push({label:n,value:acct(n)});});
  if(state.accounts['Accumulated Depreciation']&&acct('Accumulated Depreciation')!==0)nc.push({label:'Less: Accumulated depreciation',value:-Math.abs(acct('Accumulated Depreciation'))});
  var cur=[{label:'Inventory',value:acct('Inventory')},{label:'Trade receivables',value:acct('Accounts Receivable')},{label:'Prepayments',value:acct('Prepaid Expenses')},{label:'Cash',value:acct('Cash')},{label:'Bank',value:acct('Bank')}];if(state.accounts['MoMo Wallet'])cur.push({label:'Mobile money',value:acct('MoMo Wallet')});
  var ncs=sectionRows('NON-CURRENT ASSETS',nc,'Total non-current assets'),cs=sectionRows('CURRENT ASSETS',cur,'Total current assets');
  rows=[['ASSETS','GH₵']].concat(ncs.rows,cs.rows,[['TOTAL ASSETS',displayAmount(ncs.total+cs.total)],['','']]);
  var eq=[{label:'Stated / owner capital',value:acct('Owner Capital')},{label:'Retained earnings',value:acct('Retained Earnings')},{label:'Current period profit',value:t.profit}];if(state.accounts['Owner Drawings'])eq.push({label:'Less: owner drawings',value:-Math.abs(acct('Owner Drawings'))});
  var noncl=[];Object.keys(state.accounts).forEach(function(n){if(state.accounts[n].type==='liability'&&/loan payable/i.test(n))noncl.push({label:n,value:acct(n)});});
  var curl=[{label:'Trade payables',value:acct('Accounts Payable')}];if(state.accounts['Output VAT'])curl.push({label:'Output VAT / taxes payable',value:acct('Output VAT')});
  Object.keys(state.accounts).forEach(function(n){if(state.accounts[n].type==='liability'&&n!=='Accounts Payable'&&n!=='Output VAT'&&!/loan payable/i.test(n))curl.push({label:n,value:acct(n)});});
  var es=sectionRows('EQUITY',eq,'Total equity'),nls=sectionRows('NON-CURRENT LIABILITIES',noncl,'Total non-current liabilities'),cls=sectionRows('CURRENT LIABILITIES',curl,'Total current liabilities');
  rows=rows.concat([['EQUITY AND LIABILITIES','GH₵']],es.rows,nls.rows,cls.rows,[['TOTAL EQUITY AND LIABILITIES',displayAmount(es.total+nls.total+cls.total)]]);
  var diff=(ncs.total+cs.total)-(es.total+nls.total+cls.total);summary=[{label:'Reporting date',value:date},{label:'Currency',value:'Ghana cedi (GH₵)'},{label:'Total assets',value:fmtMoney(ncs.total+cs.total)},{label:'Total equity and liabilities',value:fmtMoney(es.total+nls.total+cls.total)}];if(Math.abs(diff)>.01)summary.push({label:'Control difference',value:fmtMoney(diff)});
 }
 else if(type==='income'){
  title=co+' — Statement of Profit or Loss';
  var revenue=[];allAccountsByType('revenue').forEach(function(a){if(a.balance!==0)revenue.push({label:a.name,value:a.balance});});var rs=sectionRows('REVENUE',revenue,'Total revenue');
  var cos=acct('Cost of Sales'),gross=rs.total-cos;var op=[];allAccountsByType('expense').forEach(function(a){if(a.name!=='Cost of Sales'&&a.balance!==0)op.push({label:a.name,value:a.balance});});var ops=sectionRows('OPERATING EXPENSES',op,'Total operating expenses');
  rows=[['STATEMENT OF PROFIT OR LOSS','GH₵']].concat(rs.rows,[['Cost of sales',displayAmount(-cos)],['GROSS PROFIT',displayAmount(gross)]],ops.rows,[['NET PROFIT',displayAmount(rs.total-cos-ops.total)]]);
  summary=[{label:'Period ended',value:date},{label:'Currency',value:'Ghana cedi (GH₵)'},{label:'Revenue',value:fmtMoney(rs.total)},{label:'Net profit',value:fmtMoney(rs.total-cos-ops.total)}];
 }
 else if(type==='trial'){
  title=co+' — Trial Balance';rows=[['Account','Debit (GH₵)','Credit (GH₵)']];var td=0,tc=0;Object.keys(state.accounts).sort().forEach(function(n){var a=state.accounts[n],b=Number(a.balance||0),dn=nature(a.type)==='debit',d=dn?Math.max(0,b):Math.max(0,-b),c=dn?Math.max(0,-b):Math.max(0,b);td+=d;tc+=c;rows.push([n,d?displayAmount(d):'',c?displayAmount(c):'']);});rows.push(['TOTAL',displayAmount(td),displayAmount(tc)]);summary=[{label:'As at',value:date},{label:'Total debits',value:fmtMoney(td)},{label:'Total credits',value:fmtMoney(tc)},{label:'Difference',value:fmtMoney(td-tc)}];
 }
 else if(type==='journal'){
  title=co+' — General Journal';rows=[['Date','Narration','Account','Debit (GH₵)','Credit (GH₵)']];state.transactions.slice().reverse().forEach(function(tx){tx.lines.forEach(function(l){rows.push([new Date(tx.date).toLocaleDateString(),tx.memo,l.account,l.debit?displayAmount(l.debit):'',l.credit?displayAmount(l.credit):'']);});});summary=[{label:'Generated',value:date},{label:'Posted transactions',value:String(state.transactions.length)},{label:'Unposted basket items',value:String(atlasBasket.length)}];
 }
 else if(type==='daily'){
  title=co+' — Daily Management Report';summary=[{label:'Date',value:date},{label:'Sales / revenue',value:fmtMoney(t.revenue)},{label:'Cash and bank',value:fmtMoney(t.cash)},{label:'Trade receivables',value:fmtMoney(accountBal('Accounts Receivable'))},{label:'Expenses',value:fmtMoney(t.expenses)},{label:'Net profit',value:fmtMoney(t.profit)},{label:'Net assets',value:fmtMoney(t.netAssets)}];rows=[['Key operating information','Value'],['Customers owing',String(owingCustomers().length)],['Overdue receivables',fmtMoney(sum(enterprise.customers,function(c){return c.overdue;}))],['Products / SKUs',String(enterprise.products.length)],['Units in stock',fmtNum(sum(enterprise.products,function(p){return p.stock;}))],['Low-stock products',String(enterprise.products.filter(function(p){return p.stock<=p.reorder;}).length)],['Active employees',String(enterprise.employees.filter(function(e){return e.status==='Active';}).length)],['Unposted transactions',String(atlasBasket.length)]];
 }
 else return atlasOriginalBuildReport?atlasOriginalBuildReport(type):{title:'Atlas Report',summary:[],rows:[]};
 return{title:title,company:co,reportingDate:date,currency:'GHS',basis:enterprise.company.reportingBasis,summary:summary,rows:rows,type:type,generated:new Date().toISOString()};
};

/* ---------------- GENERAL KNOWLEDGE / WEB FALLBACK ---------------- */
function looksLikeQuestion(text){var s=norm(text);return /^(who|what|when|where|why|how|which|can|could|is|are|do|does|did|tell me|give me|show me|explain)\b/.test(s)||/[?]$/.test(String(text||'').trim());}
function stripHtml(s){var d=document.createElement('div');d.innerHTML=String(s||'');return d.textContent||d.innerText||'';}
function generalKnowledgeSearch(query){
 chatHtml('<b>You:</b> '+esc(query)+'<br><br><span class="thinking">Atlas is checking online general knowledge…</span>');
 var api='https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(query)+'&format=json&utf8=1&origin=*';
 fetch(api).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(function(j){var hit=j&&j.query&&j.query.search&&j.query.search[0];if(!hit)throw Error('No reliable result');var title=hit.title;var extract='https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(title)+'&format=json&origin=*';return fetch(extract).then(function(r){return r.json();}).then(function(x){var pages=x&&x.query&&x.query.pages||{},page=null;Object.keys(pages).forEach(function(k){if(!page)page=pages[k];});var text=page&&page.extract?String(page.extract):stripHtml(hit.snippet);if(text.length>850)text=text.slice(0,847)+'…';chatHtml('<b>You:</b> '+esc(query)+'<br><br><b>Atlas:</b> '+esc(text)+'<div class="muted" style="margin-top:8px">Online source: Wikipedia general-knowledge lookup. For current news, prices, weather or live business data, the production Atlas cloud/web connector is still required.</div>');});});
 }).catch(function(){chatHtml('<b>You:</b> '+esc(query)+'<br><br><b>Atlas:</b> I do not have enough local company information to answer that, and the online knowledge lookup was unavailable or unsuitable. The production Atlas AI/web layer will route this kind of question to a full web-enabled model instead of guessing.');});
}

/* ---------------- UNIVERSAL ROUTER ---------------- */
var atlasConversationHandleAsk=window.handleAsk;
window.handleAsk=function(text){
 var s=norm(text);
 if(typeof atlasDialogue!=='undefined'&&atlasDialogue){return atlasConversationHandleAsk(text);}
 if(/^(done|that is all|that s all|finished|finish|review basket|show basket)$/.test(s)){showPostingBasket();chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> Your '+atlasBasket.length+' unposted transaction'+(atlasBasket.length===1?' is':'s are')+' still in the Posting Basket. Review the batch below before posting.<div class="chatBtns"><button onclick="showPostingBasket()">Review basket</button></div>');return;}
 if(/^(post all|post basket|post everything|post them)$/.test(s)){confirmPostBasket();return;}
 if(/^(clear basket|cancel basket|remove all unposted)$/.test(s)){clearPostingBasket();return;}
 var b=businessAnswer(text);if(b){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+b);return;}
 try{var fin=typeof answerQuestion==='function'?answerQuestion(text):null;if(fin&&!isPostingIntent(s)){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+fin);return;}}catch(e){}
 if(looksLikeQuestion(text)&&!isPostingIntent(s)){generalKnowledgeSearch(text);return;}
 return atlasConversationHandleAsk(text);
};

/* Extend reset without silently deleting posted history unless user confirms original reset. */
var atlasOriginalResetDemo=window.resetDemo;
window.resetUniversalDemo=function(){
 if(confirm('Reset the test company knowledge, Posting Basket and local ledger to the starting demo data?')){
  enterprise=freshEnterprise();saveEnterprise();atlasBasket=[];saveBasket();saveContext(null);localStorage.removeItem('atlas_dialogue_v3');if(typeof atlasOriginalResetDemo==='function')atlasOriginalResetDemo();
 }
};

function injectUniversalUI(){
 repairLegacyDemoOpening();
 var ai=document.querySelector('.card.ai');if(ai&&!document.getElementById('atlasBasketCard')){var c=document.createElement('div');c.id='atlasBasketCard';c.className='card';ai.parentNode.insertBefore(c,ai.nextSibling);}
 var sub=document.querySelector('.sub');if(sub)sub.textContent='Financial OS · Universal Intelligence Test Build 0.4';
 var hint=document.querySelector('.hint');if(hint)hint.textContent='Ask about accounting, customers, stock, employees, meetings, reports, or describe transactions in ordinary language.';
 var q=document.getElementById('q');if(q)q.placeholder='Ask anything about the business, or tell Atlas what happened';
 var foot=document.querySelector('.foot');if(foot)foot.textContent='Universal intelligence test · Company records shown here are sample data · Local ledger + optional online general-knowledge lookup';
 renderBasketCard();
}

window.atlasEnterprise=enterprise;
window.atlasBasket=atlasBasket;
window.addEventListener('DOMContentLoaded',function(){setTimeout(injectUniversalUI,50);});
})();
