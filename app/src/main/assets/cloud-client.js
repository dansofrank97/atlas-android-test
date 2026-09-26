/* Atlas Cloud Client v0.6 — direct HTTPS client for Atlas Cloud Intelligence */
function cloudClientPayload(question){
 var t=typeof totals==='function'?totals():{};
 function take(a,n){return Array.isArray(a)?a.slice(0,n):[];}
 return {
  question:question,
  workspace:(typeof cloudCfg==='function'&&cloudCfg().workspace)||null,
  company:(enterprise&&enterprise.company)||{},
  context:atlasQueryContext||null,
  ledgerSummary:{cash:t.cash||0,assets:t.assets||0,liabilities:t.liabilities||0,revenue:t.revenue||0,expenses:t.expenses||0,profit:t.profit||0},
  postingBasket:(atlasBasket||[]).slice(0,50).map(function(x){return{memo:x.memo,lines:x.lines};}),
  businessData:{customers:take(enterprise.customers,100),products:take(enterprise.products,100),employees:take(enterprise.employees,100),suppliers:take(enterprise.suppliers,100),meetings:take(enterprise.meetings,100)},
  client:{name:'Atlas Android Test',version:'0.6'}
 };
}
function renderCloudResponse(question,data){
 var answer=(data&&data.answer)||'Atlas Cloud returned no answer.';
 var meta=[];if(data&&data.source)meta.push('Source: '+data.source);if(data&&data.web_used)meta.push('web search used');
 var html='<b>You:</b> '+esc(question)+'<br><br><b>Atlas Cloud:</b> '+esc(answer);
 if(data&&data.clarification)html+='<br><br><b>Atlas needs:</b> '+esc(data.clarification);
 if(data&&data.posting_proposal){
  var p=data.posting_proposal;
  html+='<div class="miniTable"><table><tr><th>Account</th><th>Debit</th><th>Credit</th></tr>';
  (p.lines||[]).forEach(function(l){html+='<tr><td>'+esc(l.account)+'</td><td>'+(l.debit?atlasMoney(l.debit):'')+'</td><td>'+(l.credit?atlasMoney(l.credit):'')+'</td></tr>';});
  html+='</table></div><div class="chatBtns"><button onclick="addCloudProposalToBasket()">Add proposal to Posting Basket</button></div>';
  window.atlasPendingCloudProposal=p;
 }
 if(meta.length)html+='<div class="muted" style="margin-top:8px">'+esc(meta.join(' · '))+'</div>';
 chatHtml(html);
}
function addCloudProposalToBasket(){var p=window.atlasPendingCloudProposal;if(!p)return;reviewPosting({memo:p.memo||'Atlas Cloud proposal',lines:p.lines||[],source:'Atlas Cloud'});window.atlasPendingCloudProposal=null;}
window.addCloudProposalToBasket=addCloudProposalToBasket;

window.atlasCloudAsk=function(question){
 var c=typeof cloudCfg==='function'?cloudCfg():{};
 if(!c.endpoint)return false;
 if(!/^https:\/\//i.test(c.endpoint)){toast('Atlas Cloud endpoint must use HTTPS');return true;}
 chatHtml('<b>You:</b> '+esc(question)+'<br><br><span class="thinking">Atlas Cloud is thinking…</span>');
 var controller=window.AbortController?new AbortController():null;
 var timer=controller?setTimeout(function(){controller.abort();},45000):null;
 fetch(c.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cloudClientPayload(question)),signal:controller?controller.signal:undefined})
  .then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+(t?': '+t.slice(0,180):''));});return r.json();})
  .then(function(data){if(timer)clearTimeout(timer);renderCloudResponse(question,data);})
  .catch(function(err){if(timer)clearTimeout(timer);chatHtml('<b>You:</b> '+esc(question)+'<br><br><b>Atlas:</b> The Atlas Cloud connection failed: '+esc(err.message||String(err))+'.<div class="muted" style="margin-top:8px">Local ledger, company data and Posting Basket remain available.</div>');});
 return true;
};
window.onNativeCloudAnswer=function(ok,body){if(!ok){chatHtml('<b>Atlas:</b> Cloud request failed: '+esc(body));return;}try{renderCloudResponse('',JSON.parse(body));}catch(e){chatHtml('<b>Atlas Cloud:</b> '+esc(body));}};
