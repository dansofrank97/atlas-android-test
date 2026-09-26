/* Atlas conversational posting interpreter v0.3
   Extends the offline test ledger with multi-turn clarification for ordinary business language. */
var ATLAS_DIALOGUE_KEY='atlas_dialogue_v3';
var atlasDialogue=loadAtlasDialogue();

function loadAtlasDialogue(){try{return JSON.parse(localStorage.getItem(ATLAS_DIALOGUE_KEY)||'null')}catch(e){return null}}
function saveAtlasDialogue(){if(atlasDialogue)localStorage.setItem(ATLAS_DIALOGUE_KEY,JSON.stringify(atlasDialogue));else localStorage.removeItem(ATLAS_DIALOGUE_KEY)}
function clearAtlasDialogue(){atlasDialogue=null;saveAtlasDialogue()}
function firstAmount(text){var m=String(text||'').match(/(?:ghs|ghc|gh¢|gh₵|₵)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);return m?num(m[1]):0}
function titleCase(s){return String(s||'').trim().replace(/\b\w/g,function(c){return c.toUpperCase()})}
function cleanItem(s){return String(s||'').replace(/\b(for|worth|at|costing|cost|amounting to)\b.*$/i,'').replace(/^(a|an|the|some)\s+/i,'').replace(/[,:;-]+$/,'').trim()}
function quickChoices(items){return '<div class="chatBtns">'+items.map(function(x){var label=Array.isArray(x)?x[0]:x,val=Array.isArray(x)?x[1]:x;return '<button onclick="atlasChoice(\''+String(val).replace(/'/g,"\\'")+'\')">'+esc(label)+'</button>'}).join('')+'</div>'}
function atlasChoice(v){var q=document.getElementById('q');q.value=v;ask()}
function converse(message,choices){chatHtml('<b>Atlas:</b> '+message+(choices&&choices.length?quickChoices(choices):''))}

var assetWords={
 'furniture':'Furniture','desk':'Furniture','chair':'Furniture','table':'Furniture','shelf':'Furniture','cabinet':'Furniture',
 'laptop':'Computer Equipment','computer':'Computer Equipment','desktop':'Computer Equipment','printer':'Office Equipment','photocopier':'Office Equipment','scanner':'Office Equipment',
 'vehicle':'Motor Vehicles','car':'Motor Vehicles','truck':'Motor Vehicles','motorbike':'Motor Vehicles','motorcycle':'Motor Vehicles',
 'generator':'Equipment','machine':'Equipment','machinery':'Equipment','equipment':'Equipment','fridge':'Equipment','refrigerator':'Equipment','freezer':'Equipment','air conditioner':'Equipment','airconditioner':'Equipment',
 'building':'Building','land':'Land','phone':'Communication Equipment','smartphone':'Communication Equipment'
};
var expenseWords={
 'fuel':'Fuel Expense','petrol':'Fuel Expense','diesel':'Fuel Expense','transport':'Transport Expense','transportation':'Transport Expense',
 'food':'Feeding Expense','feeding':'Feeding Expense','lunch':'Feeding Expense','breakfast':'Feeding Expense','refreshment':'Feeding Expense','water':'Utilities Expense',
 'electricity':'Utilities Expense','light':'Utilities Expense','internet':'Utilities Expense','data':'Utilities Expense','airtime':'Utilities Expense',
 'rent':'Rent Expense','stationery':'Stationery Expense','paper':'Stationery Expense','pen':'Stationery Expense','printing':'Printing Expense',
 'repair':'Repairs & Maintenance Expense','repairs':'Repairs & Maintenance Expense','maintenance':'Repairs & Maintenance Expense',
 'advert':'Marketing Expense','advertising':'Marketing Expense','marketing':'Marketing Expense','salary':'Salaries Expense','salaries':'Salaries Expense','wages':'Salaries Expense',
 'cleaning':'Cleaning Expense','security':'Security Expense','bank charges':'Bank Charges Expense','charge':'Bank Charges Expense'
};
var inventoryWords=['inventory','stock','goods','merchandise','products','items for resale','raw materials','materials for resale'];
var personalWords=['personal','myself','home use','family use','private use'];

function classifyPurchasedItem(item,text){var s=(item+' '+text).toLowerCase();
 for(var k in assetWords)if(new RegExp('\\b'+k.replace(/ /g,'\\s+')+'\\b','i').test(s))return{class:'asset',account:assetWords[k],confidence:'high'};
 if(inventoryWords.some(function(k){return s.indexOf(k)>=0})||/for resale|to resell|for selling/.test(s))return{class:'inventory',account:'Inventory',confidence:'high'};
 for(var e in expenseWords)if(new RegExp('\\b'+e.replace(/ /g,'\\s+')+'\\b','i').test(s))return{class:'expense',account:expenseWords[e],confidence:'medium'};
 return{class:'unknown',account:null,confidence:'low'}
}
function paymentMethod(text){var s=String(text||'').toLowerCase();if(/on credit|credit purchase|pay later|owe|owing|supplier credit/.test(s))return'credit';if(/momo|mobile money|mobilemoney/.test(s))return'momo';if(/bank|cheque|check|transfer/.test(s))return'bank';if(/cash/.test(s))return'cash';return null}
function receivingMethod(text){var s=String(text||'').toLowerCase();if(/momo|mobile money|mobilemoney/.test(s))return'momo';if(/cash/.test(s))return'cash';if(/bank|account|transfer/.test(s))return'bank';return null}
function purposeFromReply(text,item){var s=String(text||'').toLowerCase();if(/resale|resell|sell it|stock|inventory|for selling/.test(s))return{class:'inventory',account:'Inventory'};if(/personal|myself|home|family|private/.test(s))return{class:'personal',account:'Owner Drawings'};if(/staff|office use|business use|business|refreshment|eat|eating|consume|consumption/.test(s)){var c=classifyPurchasedItem(item,'');if(c.class==='asset')return c;return{class:'expense',account:expenseAccountForItem(item)}}return null}
function expenseAccountForItem(item){var s=String(item||'').toLowerCase();for(var e in expenseWords)if(new RegExp('\\b'+e.replace(/ /g,'\\s+')+'\\b','i').test(s))return expenseWords[e];if(/mango|fruit|drink|snack|meal|rice|bread|food/.test(s))return'Feeding Expense';return titleCase(item||'General')+' Expense'}
function sourceAccount(method){if(method==='cash')return'Cash';if(method==='bank')return'Bank';if(method==='momo'){ensureAccount('MoMo Wallet','asset');return'MoMo Wallet'}if(method==='credit')return'Accounts Payable';return null}
function destinationAccount(method){if(method==='cash')return'Cash';if(method==='bank')return'Bank';if(method==='momo'){ensureAccount('MoMo Wallet','asset');return'MoMo Wallet'}return null}

function extractPurchase(text){var s=String(text||'');var m=s.match(/\b(?:i\s+)?(?:bought|purchased|purchase|acquired|got)\s+(.+?)(?:(?:\s+(?:for|at|worth|costing|cost)\s+)|(?:\s+))(?:ghs|ghc|gh¢|gh₵|₵)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)(?:\b|$)/i);
 if(!m){m=s.match(/\b(?:i\s+)?(?:bought|purchased|purchase|acquired|got)\s+(.+)/i);if(!m)return null;var amt=firstAmount(m[1]);var item=cleanItem(m[1].replace(/(?:ghs|ghc|gh¢|gh₵|₵)?\s*[0-9][0-9,]*(?:\.\d{1,2})?.*$/i,''));return{kind:'purchase',item:item||null,amount:amt||0,payment:paymentMethod(s),raw:s}}
 return{kind:'purchase',item:cleanItem(m[1]),amount:num(m[2]),payment:paymentMethod(s),raw:s}
}
function extractLoan(text){var s=String(text||''),low=s.toLowerCase();if(!/(borrow|borrowed|loan received|received.*loan|took.*loan|loaned.*from|loan.*from)/.test(low))return null;var amount=firstAmount(s),lender=null;var lm=s.match(/\bfrom\s+([A-Za-z][A-Za-z0-9 &'._-]{1,35}?)(?=\s+(?:bank|for|into|to|of|ghs|ghc|gh¢|gh₵|₵|[0-9])|[,.;]|$)/i);if(lm)lender=lm[1].trim();var bankName=s.match(/\bfrom\s+([A-Za-z][A-Za-z0-9 &'._-]{1,30})\s+bank\b/i);if(bankName)lender=bankName[1].trim()+' Bank';if(lender&&/^a bank$|^the bank$|^bank$/i.test(lender))lender=null;return{kind:'loan',amount:amount,lender:lender,receive:receivingMethod(s),raw:s}}
function extractSale(text){var s=String(text||'');if(!/\b(sold|sale|sales)\b/i.test(s))return null;var amount=firstAmount(s);if(!amount)return{kind:'sale',amount:0,payment:paymentMethod(s),raw:s};var customer=null;var cm=s.match(/\bto\s+([A-Za-z][A-Za-z .'-]{1,35})(?=\s+(?:for|on credit|cash|bank)|[,.;]|$)/i);if(cm)customer=cm[1].trim();return{kind:'sale',amount:amount,payment:paymentMethod(s),customer:customer,raw:s}}
function extractExpense(text){var s=String(text||''),low=s.toLowerCase();if(!/\b(paid|spent|expense|paid for)\b/.test(low))return null;var amount=firstAmount(s);var found=null;for(var e in expenseWords)if(new RegExp('\\b'+e.replace(/ /g,'\\s+')+'\\b','i').test(low)){found=expenseWords[e];break}if(!found)return null;return{kind:'expense',account:found,amount:amount,payment:paymentMethod(s),raw:s}}

function startNaturalDialogue(text){var tx=extractLoan(text)||extractPurchase(text)||extractSale(text)||extractExpense(text);if(!tx)return false;atlasDialogue=tx;saveAtlasDialogue();continueAtlasDialogue();return true}
function continueAtlasDialogue(){var d=atlasDialogue;if(!d)return false;
 if(d.kind==='purchase'){
   if(!d.item){d.wait='item';saveAtlasDialogue();converse('What did you buy?');return true}
   if(!d.amount){d.wait='amount';saveAtlasDialogue();converse('How much did the '+esc(d.item)+' cost?');return true}
   if(!d.classification){var c=classifyPurchasedItem(d.item,d.raw||'');if(c.class==='unknown'){d.wait='purpose';saveAtlasDialogue();converse('I understand you bought <b>'+esc(d.item)+'</b> for <b>'+money(d.amount)+'</b>. What was it for?',[["Stock / resale","for resale"],["Business use","business use"],["Personal use","personal use"]]);return true}d.classification=c}
   if(!d.payment){d.wait='payment';saveAtlasDialogue();converse('How did you pay for the '+esc(d.item)+'?',[["Cash","cash"],["Bank","bank"],["MoMo","momo"],["On credit","on credit"]]);return true}
   return finishPurchase(d)
 }
 if(d.kind==='loan'){
   if(!d.lender){d.wait='lender';saveAtlasDialogue();converse('I understand this as money you <b>borrowed</b>. Which bank or lender gave you the loan?');return true}
   if(!d.amount){d.wait='amount';saveAtlasDialogue();converse('How much did you borrow from '+esc(d.lender)+'?');return true}
   if(!d.receive){d.wait='receive';saveAtlasDialogue();converse('Where did the '+money(d.amount)+' loan money go?',[["Bank account","bank"],["Cash","cash"],["MoMo","momo"]]);return true}
   return finishLoan(d)
 }
 if(d.kind==='sale'){
   if(!d.amount){d.wait='amount';saveAtlasDialogue();converse('How much was the sale?');return true}
   if(!d.payment){d.wait='payment';saveAtlasDialogue();converse('How did the customer pay?',[["Cash","cash"],["Bank","bank"],["MoMo","momo"],["On credit","on credit"]]);return true}
   if(d.payment==='credit'&&!d.customer){d.wait='customer';saveAtlasDialogue();converse('Who is the customer that owes you '+money(d.amount)+'?');return true}
   return finishSale(d)
 }
 if(d.kind==='expense'){
   if(!d.amount){d.wait='amount';saveAtlasDialogue();converse('How much did you pay?');return true}
   if(!d.payment){d.wait='payment';saveAtlasDialogue();converse('How did you pay?',[["Cash","cash"],["Bank","bank"],["MoMo","momo"],["On credit","on credit"]]);return true}
   return finishExpense(d)
 }
 return false
}
function handleDialogueReply(text){var d=atlasDialogue;if(!d)return false;var v=String(text||'').trim();
 if(/^(cancel|stop|forget it|start over)$/i.test(v)){clearAtlasDialogue();converse('Okay. I cancelled that transaction. Nothing was posted.');return true}
 if(d.wait==='item'){d.item=cleanItem(v);d.wait=null}
 else if(d.wait==='amount'){var a=firstAmount(v);if(!a){converse('I still need the amount. Please enter a figure, for example <b>15,000</b>.');return true}d.amount=a;d.wait=null}
 else if(d.wait==='purpose'){var p=purposeFromReply(v,d.item);if(!p){converse('Was it <b>for resale</b>, <b>for business use</b>, or <b>for personal use</b>?',[["Stock / resale","for resale"],["Business use","business use"],["Personal use","personal use"]]);return true}d.classification=p;d.wait=null}
 else if(d.wait==='payment'){var pm=paymentMethod(v);if(!pm){converse('Please tell me whether it was paid by <b>cash</b>, <b>bank</b>, <b>MoMo</b>, or bought <b>on credit</b>.',[["Cash","cash"],["Bank","bank"],["MoMo","momo"],["On credit","on credit"]]);return true}d.payment=pm;d.wait=null}
 else if(d.wait==='lender'){if(v.length<2){converse('Please give me the bank or lender name.');return true}d.lender=titleCase(v.replace(/^from\s+/i,''));d.wait=null}
 else if(d.wait==='receive'){var rm=receivingMethod(v);if(!rm){converse('Did the loan enter your <b>bank account</b>, come as <b>cash</b>, or enter <b>MoMo</b>?',[["Bank account","bank"],["Cash","cash"],["MoMo","momo"]]);return true}d.receive=rm;d.wait=null}
 else if(d.wait==='customer'){d.customer=titleCase(v);d.wait=null}
 else if(d.wait==='genericIntent'){return handleGenericIntentReply(v)}
 saveAtlasDialogue();return continueAtlasDialogue()
}

function finishPurchase(d){var debitAcct;
 if(d.classification.class==='inventory')debitAcct='Inventory';
 else if(d.classification.class==='personal'){ensureAccount('Owner Drawings','equity');debitAcct='Owner Drawings'}
 else {debitAcct=d.classification.account||expenseAccountForItem(d.item);ensureAccount(debitAcct,d.classification.class==='asset'?'asset':'expense')}
 var creditAcct=sourceAccount(d.payment);if(!creditAcct)return false;var memo='Bought '+d.item+(d.payment==='credit'?' on credit':' by '+d.payment);var p={memo:memo,lines:[line(debitAcct,d.amount,0),line(creditAcct,0,d.amount)]};clearAtlasDialogue();reviewPosting(p);return true}
function finishLoan(d){var debitAcct=destinationAccount(d.receive);var liability=titleCase(d.lender)+' Loan Payable';ensureAccount(liability,'liability');var p={memo:'Loan received from '+d.lender,lines:[line(debitAcct,d.amount,0),line(liability,0,d.amount)]};clearAtlasDialogue();reviewPosting(p);return true}
function finishSale(d){var debitAcct=d.payment==='credit'?'Accounts Receivable':sourceAccount(d.payment);var memo='Sale'+(d.customer?' to '+d.customer:'')+(d.payment==='credit'?' on credit':' via '+d.payment);var p={memo:memo,lines:[line(debitAcct,d.amount,0),line('Sales Revenue',0,d.amount)]};clearAtlasDialogue();reviewPosting(p);return true}
function finishExpense(d){var creditAcct=sourceAccount(d.payment);ensureAccount(d.account,'expense');var p={memo:d.account.replace(/ Expense$/,'')+' paid via '+d.payment,lines:[line(d.account,d.amount,0),line(creditAcct,0,d.amount)]};clearAtlasDialogue();reviewPosting(p);return true}

function startGenericClarification(text){var amount=firstAmount(text);atlasDialogue={kind:'generic',raw:text,amount:amount||0,wait:'genericIntent'};saveAtlasDialogue();var msg='I am not fully sure what happened';if(amount)msg+=' with <b>'+money(amount)+'</b>';msg+='. Which best describes it?';converse(msg,[["I bought something","purchase"],["I made a sale","sale"],["I paid an expense","expense"],["I borrowed money","loan"],["Money came in","received"],["Something else","other"]]);return true}
function handleGenericIntentReply(v){var d=atlasDialogue,low=v.toLowerCase();if(/purchase|bought|buy/.test(low)){atlasDialogue={kind:'purchase',item:null,amount:d.amount||0,payment:null,raw:d.raw};saveAtlasDialogue();return continueAtlasDialogue()}if(/sale|sold/.test(low)){atlasDialogue={kind:'sale',amount:d.amount||0,payment:null,customer:null,raw:d.raw};saveAtlasDialogue();return continueAtlasDialogue()}if(/expense|paid/.test(low)){clearAtlasDialogue();converse('What did you pay for? For example: <b>electricity</b>, <b>transport</b>, <b>rent</b>, or <b>fuel</b>.');return true}if(/loan|borrow/.test(low)){atlasDialogue={kind:'loan',amount:d.amount||0,lender:null,receive:null,raw:d.raw};saveAtlasDialogue();return continueAtlasDialogue()}clearAtlasDialogue();converse('Tell me what happened in your own words. I will ask follow-up questions if I need more information.');return true}

/* Override the earlier one-shot parser for broader ordinary-language handling. */
var atlasOldParseActivity=parseActivity;
parseActivity=function(text){var old=atlasOldParseActivity(text);if(old)return old;var tx=extractPurchase(text);if(tx&&tx.item&&tx.amount&&tx.payment){var c=classifyPurchasedItem(tx.item,text);if(c.class!=='unknown'){tx.classification=c;var debit=c.class==='inventory'?'Inventory':c.account;ensureAccount(debit,c.class==='asset'?'asset':'expense');return{memo:text,lines:[line(debit,tx.amount,0),line(sourceAccount(tx.payment),0,tx.amount)]}}}return null};

/* Override Ask Atlas so clarification dialogue gets first priority. */
var atlasOldHandleAsk=handleAsk;
handleAsk=function(text){
 if(atlasDialogue){handleDialogueReply(text);return}
 var lower=String(text||'').toLowerCase(),report=detectReport(lower),fmt=detectFormat(lower);
 if(report){var r=buildReport(report);chat('Atlas',reportAnswer(report,r));if(fmt)exportReport(fmt,report);else showReport(report);return}
 var answer=answerQuestion(text);if(answer&&!isPostingIntent(lower)){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+answer);return}
 var explicit=parseExplicit(text);if(explicit){reviewPosting(explicit);return}
 var p=atlasOldParseActivity(text);if(p){reviewPosting(p);return}
 if(startNaturalDialogue(text))return;
 if(answer){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+answer);return}
 startGenericClarification(text)
};

window.addEventListener('DOMContentLoaded',function(){if(atlasDialogue){setTimeout(function(){converse('You had an unfinished transaction. '+(atlasDialogue.wait==='payment'?'How was it paid?':'Let’s continue from where you stopped.'));},180)}});
