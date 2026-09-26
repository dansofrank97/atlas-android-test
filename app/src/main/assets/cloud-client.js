/* Atlas Cloud Client v0.7 — live Azure endpoint + device-local bearer token */
var ATLAS_LIVE_ENDPOINT='https://atlas-cloud-api.lemonsea-e561a476.southafricanorth.azurecontainerapps.io/v1/mobile/ask';

function cloudClientConfig(){
 var c=typeof cloudCfg==='function'?cloudCfg():{};
 if(!c.endpoint)c.endpoint=ATLAS_LIVE_ENDPOINT;
 return c;
}
function persistCloudClientConfig(c){
 var prior=typeof hybridConfig==='function'?hybridConfig():{};
 var next=Object.assign({},prior||{},c||{});
 if(typeof saveHybridConfig==='function')saveHybridConfig(next);
 else try{localStorage.setItem('atlas_hybrid_config_v1',JSON.stringify(next));}catch(e){}
 return next;
}
(function ensureLiveEndpoint(){
 var c=cloudClientConfig();
 if(!c.endpoint||c.endpoint!==ATLAS_LIVE_ENDPOINT){
  if(!c.endpoint)c.endpoint=ATLAS_LIVE_ENDPOINT;
 }
 persistCloudClientConfig(c);
})();

/* Override Hybrid settings so the test token is stored only on this device. */
window.showCloudSettings=function(){
 var c=cloudClientConfig();
 modal('<h2>Atlas Cloud Connection</h2>'+
 '<p class="muted">The production Azure endpoint is preloaded. For this test build, enter the mobile access token you created for Atlas. It is stored only in this app\'s local device storage, not in source control and not inside the APK.</p>'+
 '<input id="cloudEndpoint" class="field" value="'+esc(c.endpoint||ATLAS_LIVE_ENDPOINT)+'" placeholder="https://.../v1/mobile/ask">'+
 '<input id="cloudToken" class="field" type="password" value="'+esc(c.token||'')+'" placeholder="Atlas mobile access token">'+
 '<input id="cloudWorkspace" class="field" value="'+esc(c.workspace||'')+'" placeholder="Workspace / company ID (optional)">'+
 '<button class="full" onclick="saveCloudSettings()">Save connection</button>'+
 '<button class="secondary full" style="margin-top:8px" onclick="testCloudConnection()">Test live Atlas Cloud</button>'+
 '<div class="muted" style="margin-top:10px">Production authentication will later use Atlas sign-in/OIDC instead of this shared test token.</div>');
};
window.saveCloudSettings=function(){
 var ep=document.getElementById('cloudEndpoint').value.trim()||ATLAS_LIVE_ENDPOINT;
 var token=document.getElementById('cloudToken').value.trim();
 var ws=document.getElementById('cloudWorkspace').value.trim();
 if(!/^https:\/\//i.test(ep)){toast('Use an HTTPS endpoint');return;}
 persistCloudClientConfig({endpoint:ep,token:token,workspace:ws});
 closeModal();
 toast(token?'Atlas Cloud connection saved':'Endpoint saved — mobile token still required');
};
window.testCloudConnection=function(){
 var c=cloudClientConfig();
 if(!c.token){toast('Enter the Atlas mobile access token first');return;}
 closeModal();
 atlasCloudAsk('Reply only with: Atlas cloud connection successful.');
};

function cloudClientPayload(question){
 var t=typeof totals==='function'?totals():{};
 function take(a,n){return Array.isArray(a)?a.slice(0,n):[];}
 return {
  question:question,
  workspace:cloudClientConfig().workspace||null,
  company:(enterprise&&enterprise.company)||{},
  context:atlasQueryContext||null,
  ledgerSummary:{cash:t.cash||0,assets:t.assets||0,liabilities:t.liabilities||0,revenue:t.revenue||0,expenses:t.expenses||0,profit:t.profit||0},
  postingBasket:(atlasBasket||[]).slice(0,50).map(function(x){return{memo:x.memo,lines:x.lines};}),
  businessData:{customers:take(enterprise.customers,100),products:take(enterprise.products,100),employees:take(enterprise.employees,100),suppliers:take(enterprise.suppliers,100),meetings:take(enterprise.meetings,100)},
  client:{name:'Atlas Android Test',version:'0.7-cloud-live'}
 };
}
function renderCloudResponse(question,data){
 var answer=(data&&data.answer)||'Atlas Cloud returned no answer.';
 var meta=[];if(data&&data.source)meta.push('Source: '+data.source);if(data&&data.web_used)meta.push('web search used');
 var html=(question?'<b>You:</b> '+esc(question)+'<br><br>':'')+'<b>Atlas Cloud:</b> '+esc(answer);
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
 var c=cloudClientConfig();
 if(!c.endpoint)return false;
 if(!/^https:\/\//i.test(c.endpoint)){toast('Atlas Cloud endpoint must use HTTPS');return true;}
 if(!c.token){
  chatHtml('<b>You:</b> '+esc(question)+'<br><br><b>Atlas:</b> Atlas Cloud is live, but this phone has not been paired yet.<div class="chatBtns"><button onclick="showCloudSettings()">Connect this phone</button></div>');
  return true;
 }
 chatHtml('<b>You:</b> '+esc(question)+'<br><br><span class="thinking">Atlas Cloud is thinking…</span>');
 var controller=window.AbortController?new AbortController():null;
 var timer=controller?setTimeout(function(){controller.abort();},45000):null;
 fetch(c.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.token},body:JSON.stringify(cloudClientPayload(question)),signal:controller?controller.signal:undefined})
  .then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+(t?': '+t.slice(0,180):''));});return r.json();})
  .then(function(data){if(timer)clearTimeout(timer);renderCloudResponse(question,data);})
  .catch(function(err){if(timer)clearTimeout(timer);chatHtml('<b>You:</b> '+esc(question)+'<br><br><b>Atlas:</b> The Atlas Cloud connection failed: '+esc(err.message||String(err))+'.<div class="muted" style="margin-top:8px">Local ledger, company data and Posting Basket remain available.</div>');});
 return true;
};
window.onNativeCloudAnswer=function(ok,body){if(!ok){chatHtml('<b>Atlas:</b> Cloud request failed: '+esc(body));return;}try{renderCloudResponse('',JSON.parse(body));}catch(e){chatHtml('<b>Atlas Cloud:</b> '+esc(body));}};
