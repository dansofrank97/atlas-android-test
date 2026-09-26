/* Atlas Cloud Client v0.8 — cloud-first business reasoning + device-local bearer token */
var ATLAS_LIVE_ENDPOINT='https://atlas-cloud-api.lemonsea-e561a476.southafricanorth.azurecontainerapps.io/v1/mobile/ask';
var ATLAS_CLOUD_STATE_KEY='atlas_cloud_state_v2';
var ATLAS_CLOUD_HISTORY_KEY='atlas_cloud_history_v2';
var atlasCloudState=loadCloudState();
var atlasCloudHistory=loadCloudHistory();
var atlasCloudCurrentQuestion='';
var atlasCloudLocalFallback=null;

function loadCloudState(){try{return JSON.parse(localStorage.getItem(ATLAS_CLOUD_STATE_KEY)||'null')}catch(e){return null}}
function saveCloudState(v){atlasCloudState=v||null;try{if(atlasCloudState)localStorage.setItem(ATLAS_CLOUD_STATE_KEY,JSON.stringify(atlasCloudState));else localStorage.removeItem(ATLAS_CLOUD_STATE_KEY)}catch(e){}}
function loadCloudHistory(){try{var h=JSON.parse(localStorage.getItem(ATLAS_CLOUD_HISTORY_KEY)||'[]');return Array.isArray(h)?h.slice(-12):[]}catch(e){return[]}}
function pushCloudHistory(role,text){atlasCloudHistory.push({role:role,text:String(text||'').slice(0,2000),at:new Date().toISOString()});atlasCloudHistory=atlasCloudHistory.slice(-12);try{localStorage.setItem(ATLAS_CLOUD_HISTORY_KEY,JSON.stringify(atlasCloudHistory))}catch(e){}}
function clearCloudConversation(){saveCloudState(null);atlasCloudHistory=[];try{localStorage.removeItem(ATLAS_CLOUD_HISTORY_KEY)}catch(e){}}

function cloudClientConfig(){var c=typeof cloudCfg==='function'?cloudCfg():{};if(!c.endpoint)c.endpoint=ATLAS_LIVE_ENDPOINT;return c;}
function persistCloudClientConfig(c){var prior=typeof hybridConfig==='function'?hybridConfig():{};var next=Object.assign({},prior||{},c||{});if(typeof saveHybridConfig==='function')saveHybridConfig(next);else try{localStorage.setItem('atlas_hybrid_config_v1',JSON.stringify(next));}catch(e){}return next;}
(function ensureLiveEndpoint(){var c=cloudClientConfig();if(!c.endpoint)c.endpoint=ATLAS_LIVE_ENDPOINT;persistCloudClientConfig(c);})();

window.showCloudSettings=function(){
 var c=cloudClientConfig();
 modal('<h2>Atlas Cloud Connection</h2>'+
 '<p class="muted">The production Azure endpoint is preloaded. Your mobile access token stays only in this app\'s local device storage.</p>'+
 '<input id="cloudEndpoint" class="field" value="'+esc(c.endpoint||ATLAS_LIVE_ENDPOINT)+'" placeholder="https://.../v1/mobile/ask">'+
 '<input id="cloudToken" class="field" type="password" value="'+esc(c.token||'')+'" placeholder="Atlas mobile access token">'+
 '<input id="cloudWorkspace" class="field" value="'+esc(c.workspace||'')+'" placeholder="Workspace / company ID (optional)">'+
 '<button class="full" onclick="saveCloudSettings()">Save connection</button>'+
 '<button class="secondary full" style="margin-top:8px" onclick="testCloudConnection()">Test live Atlas Cloud</button>'+
 '<button class="secondary full" style="margin-top:8px" onclick="clearCloudConversation();closeModal();toast(\'Cloud conversation cleared\')">Clear cloud conversation</button>'+
 '<div class="muted" style="margin-top:10px">Production authentication will later use Atlas sign-in/OIDC instead of this shared test token.</div>');
};
window.saveCloudSettings=function(){var ep=document.getElementById('cloudEndpoint').value.trim()||ATLAS_LIVE_ENDPOINT;var token=document.getElementById('cloudToken').value.trim();var ws=document.getElementById('cloudWorkspace').value.trim();if(!/^https:\/\//i.test(ep)){toast('Use an HTTPS endpoint');return;}persistCloudClientConfig({endpoint:ep,token:token,workspace:ws});closeModal();toast(token?'Atlas Cloud connection saved':'Endpoint saved — mobile token still required');};
window.testCloudConnection=function(){var c=cloudClientConfig();if(!c.token){toast('Enter the Atlas mobile access token first');return;}closeModal();atlasCloudAsk('Reply only with: Atlas cloud connection successful.');};

function cloudClientPayload(question){
 var t=typeof totals==='function'?totals():{};function take(a,n){return Array.isArray(a)?a.slice(0,n):[];}
 return {
  question:question,
  workspace:cloudClientConfig().workspace||null,
  company:(enterprise&&enterprise.company)||{},
  context:{business_context:atlasQueryContext||null,cloud_state:atlasCloudState||null,recent_messages:atlasCloudHistory.slice(-8)},
  ledgerSummary:{cash:t.cash||0,assets:t.assets||0,liabilities:t.liabilities||0,revenue:t.revenue||0,expenses:t.expenses||0,profit:t.profit||0},
  postingBasket:(atlasBasket||[]).slice(0,100).map(function(x){return{memo:x.memo,lines:x.lines};}),
  businessData:{customers:take(enterprise.customers,200),products:take(enterprise.products,200),employees:take(enterprise.employees,200),suppliers:take(enterprise.suppliers,200),meetings:take(enterprise.meetings,100)},
  client:{name:'Atlas Android Test',version:'0.8-integrated-business'}
 };
}
function renderCloudCitations(list){if(!Array.isArray(list)||!list.length)return'';var out='<div class="muted" style="margin-top:10px"><b>Sources</b><br>';list.slice(0,6).forEach(function(c){var title=esc(c.title||'Source'),url=String(c.url||'');if(/^https:\/\//i.test(url))out+='<a href="'+esc(url)+'" target="_blank">'+title+'</a><br>';});return out+'</div>';}
function renderCloudResponse(question,data){
 var answer=(data&&data.answer)||'Atlas Cloud returned no answer.';var meta=[];if(data&&data.source)meta.push('Source: '+data.source);if(data&&data.web_used)meta.push('live web used');if(data&&data.operation_code)meta.push(data.operation_code);
 if(data&&data.conversation_state)saveCloudState(data.conversation_state);else if(data&&(!data.clarification||data.posting_proposal))saveCloudState(null);
 if(question)pushCloudHistory('user',question);pushCloudHistory('assistant',answer+(data&&data.clarification?' | needs: '+data.clarification:''));
 var html=(question?'<b>You:</b> '+esc(question)+'<br><br>':'')+'<b>Atlas Cloud:</b> '+esc(answer);
 if(data&&data.clarification)html+='<br><br><b>Atlas needs:</b> '+esc(data.clarification);
 if(data&&data.assumptions&&data.assumptions.length)html+='<div class="muted" style="margin-top:8px"><b>Assumptions:</b> '+esc(data.assumptions.join('; '))+'</div>';
 if(data&&data.warnings&&data.warnings.length)html+='<div class="warn" style="margin-top:8px"><b>Review:</b> '+esc(data.warnings.join(' '))+'</div>';
 if(data&&data.posting_proposal){var p=data.posting_proposal;html+='<div class="miniTable"><table><tr><th>Account</th><th>Debit</th><th>Credit</th></tr>';(p.lines||[]).forEach(function(l){html+='<tr><td>'+esc(l.account)+'</td><td>'+(l.debit?atlasMoney(l.debit):'')+'</td><td>'+(l.credit?atlasMoney(l.credit):'')+'</td></tr>';});html+='</table></div><div class="chatBtns"><button onclick="addCloudProposalToBasket()">Add proposal to Posting Basket</button></div>';window.atlasPendingCloudProposal=p;}
 if(data&&data.client_action&&data.client_action.type==='show_report'&&data.client_action.value){var rv=String(data.client_action.value);html+='<div class="chatBtns"><button onclick="showReport(\''+rv.replace(/'/g,"\\'")+'\')">'+esc(data.client_action.label||'Open report')+'</button></div>';}
 html+=renderCloudCitations(data&&data.citations);
 if(meta.length)html+='<div class="muted" style="margin-top:8px">'+esc(meta.join(' · '))+'</div>';chatHtml(html);
}
function addCloudProposalToBasket(){var p=window.atlasPendingCloudProposal;if(!p)return;reviewPosting({memo:p.memo||'Atlas Cloud proposal',lines:p.lines||[],source:'Atlas Cloud'});window.atlasPendingCloudProposal=null;saveCloudState(null);}
window.addCloudProposalToBasket=addCloudProposalToBasket;

window.atlasCloudAsk=function(question){
 var c=cloudClientConfig();if(!c.endpoint)return false;if(!/^https:\/\//i.test(c.endpoint)){toast('Atlas Cloud endpoint must use HTTPS');return true;}
 if(!c.token){chatHtml('<b>You:</b> '+esc(question)+'<br><br><b>Atlas:</b> Atlas Cloud is live, but this phone has not been paired yet.<div class="chatBtns"><button onclick="showCloudSettings()">Connect this phone</button></div>');return true;}
 atlasCloudCurrentQuestion=String(question||'');chatHtml('<b>You:</b> '+esc(question)+'<br><br><span class="thinking">Atlas Cloud is thinking…</span>');var payload=JSON.stringify(cloudClientPayload(question));
 if(window.AtlasNative&&AtlasNative.cloudAskAuth){AtlasNative.cloudAskAuth(c.endpoint,c.token,payload);return true;}
 var controller=window.AbortController?new AbortController():null;var timer=controller?setTimeout(function(){controller.abort();},55000):null;
 fetch(c.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.token},body:payload,signal:controller?controller.signal:undefined}).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+(t?': '+t.slice(0,180):''));});return r.json();}).then(function(data){if(timer)clearTimeout(timer);renderCloudResponse(atlasCloudCurrentQuestion,data);}).catch(function(err){if(timer)clearTimeout(timer);chatHtml('<b>You:</b> '+esc(question)+'<br><br><b>Atlas:</b> The Atlas Cloud connection failed: '+esc(err.message||String(err))+'.<div class="muted" style="margin-top:8px">Local ledger and Posting Basket remain safe on this phone.</div>');});return true;
};
window.onNativeCloudAnswer=function(ok,body){if(!ok){chatHtml('<b>Atlas:</b> Cloud request failed: '+esc(body));return;}try{renderCloudResponse(atlasCloudCurrentQuestion,JSON.parse(body));}catch(e){chatHtml('<b>Atlas Cloud:</b> '+esc(body));}};

/* Once this script loads, the Ask Atlas box becomes cloud-first whenever the
   phone is paired. Local functionality remains the fallback when no token is set. */
(function enableCloudFirst(){
 if(typeof window.handleAsk!=='function')return;
 var localHandle=window.handleAsk;atlasCloudLocalFallback=localHandle;
 window.handleAsk=function(text){
  var s=String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(/^(done|that is all|that's all|finished|finish|review basket|show basket|post all|post basket|post everything|post them|clear basket|cancel basket|remove all unposted)$/.test(s))return localHandle(text);
  var c=cloudClientConfig();
  if(c&&c.endpoint&&c.token)return window.atlasCloudAsk(text);
  return localHandle(text);
 };
})();
