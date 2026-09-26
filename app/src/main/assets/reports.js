/* Atlas Standard Reporting Layer v0.4 */
var atlasBaseBuildReport=window.buildReport;
function repMoney(n){return typeof money==='function'?money(n):('GH₵ '+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));}
function repDisplay(n){n=Number(n||0);var raw=repMoney(Math.abs(n)).replace('GH₵ ','');return n<0?'('+raw+')':raw;}
function repAcct(n){return state.accounts&&state.accounts[n]?Number(state.accounts[n].balance||0):0;}
function repRows(title,items,totalLabel){var rows=[[title,'']],total=0;for(var i=0;i<items.length;i++){var v=Number(items[i].value||0);total+=v;rows.push(['  '+items[i].label,repDisplay(v)]);}rows.push([totalLabel,repDisplay(total)]);return{rows:rows,total:total};}
function repByType(type){var out=[];Object.keys(state.accounts||{}).forEach(function(n){var a=state.accounts[n];if(a.type===type)out.push({name:n,balance:Number(a.balance||0)});});return out;}
window.buildReport=function(type){
 var t=totals(),co=(window.enterprise&&enterprise.company&&enterprise.company.name)||'Atlas Demo Enterprise',date=new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),title='',summary=[],rows=[];
 if(type==='balance'){
  title=co+' — Statement of Financial Position';
  var fixedNames=['Furniture','Computer Equipment','Office Equipment','Motor Vehicles','Equipment','Building','Land','Communication Equipment'],nc=[];
  for(var i=0;i<fixedNames.length;i++)if(state.accounts[fixedNames[i]]&&repAcct(fixedNames[i])!==0)nc.push({label:fixedNames[i],value:repAcct(fixedNames[i])});
  if(state.accounts['Accumulated Depreciation']&&repAcct('Accumulated Depreciation')!==0)nc.push({label:'Less: accumulated depreciation',value:-Math.abs(repAcct('Accumulated Depreciation'))});
  var cur=[{label:'Inventory',value:repAcct('Inventory')},{label:'Trade receivables',value:repAcct('Accounts Receivable')},{label:'Prepayments',value:repAcct('Prepaid Expenses')},{label:'Cash',value:repAcct('Cash')},{label:'Bank',value:repAcct('Bank')}];if(state.accounts['MoMo Wallet'])cur.push({label:'Mobile money',value:repAcct('MoMo Wallet')});
  var ncs=repRows('NON-CURRENT ASSETS',nc,'Total non-current assets'),cs=repRows('CURRENT ASSETS',cur,'Total current assets');
  rows=[['ASSETS','GH₵']].concat(ncs.rows,cs.rows,[['TOTAL ASSETS',repDisplay(ncs.total+cs.total)],['','']]);
  var eq=[{label:'Stated / owner capital',value:repAcct('Owner Capital')},{label:'Retained earnings',value:repAcct('Retained Earnings')},{label:'Current period profit',value:t.profit}];if(state.accounts['Owner Drawings'])eq.push({label:'Less: owner drawings',value:-Math.abs(repAcct('Owner Drawings'))});
  var noncl=[];Object.keys(state.accounts).forEach(function(n){if(state.accounts[n].type==='liability'&&/loan payable/i.test(n))noncl.push({label:n,value:repAcct(n)});});
  var curl=[{label:'Trade payables',value:repAcct('Accounts Payable')}];if(state.accounts['Output VAT'])curl.push({label:'Output VAT / taxes payable',value:repAcct('Output VAT')});Object.keys(state.accounts).forEach(function(n){if(state.accounts[n].type==='liability'&&n!=='Accounts Payable'&&n!=='Output VAT'&&!/loan payable/i.test(n))curl.push({label:n,value:repAcct(n)});});
  var es=repRows('EQUITY',eq,'Total equity'),nls=repRows('NON-CURRENT LIABILITIES',noncl,'Total non-current liabilities'),cls=repRows('CURRENT LIABILITIES',curl,'Total current liabilities');
  rows=rows.concat([['EQUITY AND LIABILITIES','GH₵']],es.rows,nls.rows,cls.rows,[['TOTAL EQUITY AND LIABILITIES',repDisplay(es.total+nls.total+cls.total)]]);
  var diff=(ncs.total+cs.total)-(es.total+nls.total+cls.total);summary=[{label:'Reporting date',value:date},{label:'Currency',value:'Ghana cedi (GH₵)'},{label:'Total assets',value:repMoney(ncs.total+cs.total)},{label:'Total equity and liabilities',value:repMoney(es.total+nls.total+cls.total)}];if(Math.abs(diff)>.01)summary.push({label:'Control difference',value:repMoney(diff)});
 }
 else if(type==='income'){
  title=co+' — Statement of Profit or Loss';var revenue=[];repByType('revenue').forEach(function(a){if(a.balance!==0)revenue.push({label:a.name,value:a.balance});});var rs=repRows('REVENUE',revenue,'Total revenue'),cos=repAcct('Cost of Sales'),gross=rs.total-cos,op=[];repByType('expense').forEach(function(a){if(a.name!=='Cost of Sales'&&a.balance!==0)op.push({label:a.name,value:a.balance});});var ops=repRows('OPERATING EXPENSES',op,'Total operating expenses');
  rows=[['STATEMENT OF PROFIT OR LOSS','GH₵']].concat(rs.rows,[['Cost of sales',repDisplay(-cos)],['GROSS PROFIT',repDisplay(gross)]],ops.rows,[['NET PROFIT',repDisplay(rs.total-cos-ops.total)]]);summary=[{label:'Period ended',value:date},{label:'Currency',value:'Ghana cedi (GH₵)'},{label:'Revenue',value:repMoney(rs.total)},{label:'Net profit',value:repMoney(rs.total-cos-ops.total)}];
 }
 else if(type==='trial'){
  title=co+' — Trial Balance';rows=[['Account','Debit (GH₵)','Credit (GH₵)']];var td=0,tc=0;Object.keys(state.accounts).sort().forEach(function(n){var a=state.accounts[n],b=Number(a.balance||0),dn=nature(a.type)==='debit',d=dn?Math.max(0,b):Math.max(0,-b),c=dn?Math.max(0,-b):Math.max(0,b);td+=d;tc+=c;rows.push([n,d?repDisplay(d):'',c?repDisplay(c):'']);});rows.push(['TOTAL',repDisplay(td),repDisplay(tc)]);summary=[{label:'As at',value:date},{label:'Total debits',value:repMoney(td)},{label:'Total credits',value:repMoney(tc)},{label:'Difference',value:repMoney(td-tc)}];
 }
 else if(type==='journal'){
  title=co+' — General Journal';rows=[['Date','Narration','Account','Debit (GH₵)','Credit (GH₵)']];state.transactions.slice().reverse().forEach(function(tx){tx.lines.forEach(function(l){rows.push([new Date(tx.date).toLocaleDateString(),tx.memo,l.account,l.debit?repDisplay(l.debit):'',l.credit?repDisplay(l.credit):'']);});});summary=[{label:'Generated',value:date},{label:'Posted transactions',value:String(state.transactions.length)},{label:'Unposted basket items',value:String(window.atlasBasket?atlasBasket.length:0)}];
 }
 else if(type==='daily'){
  title=co+' — Daily Management Report';summary=[{label:'Date',value:date},{label:'Sales / revenue',value:repMoney(t.revenue)},{label:'Cash and bank',value:repMoney(t.cash)},{label:'Trade receivables',value:repMoney(repAcct('Accounts Receivable'))},{label:'Expenses',value:repMoney(t.expenses)},{label:'Net profit',value:repMoney(t.profit)},{label:'Net assets',value:repMoney(t.netAssets)}];var oc=window.owingCustomers?owingCustomers().length:0,prod=window.enterprise?enterprise.products:[],emp=window.enterprise?enterprise.employees:[];rows=[['Key operating information','Value'],['Customers owing',String(oc)],['Products / SKUs',String(prod.length)],['Units in stock',String(prod.reduce(function(s,p){return s+Number(p.stock||0)},0))],['Low-stock products',String(prod.filter(function(p){return p.stock<=p.reorder}).length)],['Active employees',String(emp.filter(function(e){return e.status==='Active'}).length)],['Unposted transactions',String(window.atlasBasket?atlasBasket.length:0)]];
 }
 else return atlasBaseBuildReport?atlasBaseBuildReport(type):{title:'Atlas Report',summary:[],rows:[]};
 return{title:title,company:co,reportingDate:date,currency:'GHS',summary:summary,rows:rows,type:type,generated:new Date().toISOString()};
};
