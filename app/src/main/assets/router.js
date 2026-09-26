/* Atlas Universal Router v0.4 */
function atlasQuestionLike(text){var s=String(text||'').trim().toLowerCase();return /^(who|what|when|where|why|how|which|can|could|is|are|do|does|did|tell me|give me|show me|explain)\b/.test(s)||/\?$/.test(s);}
function atlasRepairDemoOpening(){try{if(state&&state.transactions&&state.transactions.length===0&&state.accounts&&state.accounts['Retained Earnings']&&Number(state.accounts['Retained Earnings'].balance)===19440){state.accounts['Retained Earnings'].balance=7440;save();}}catch(e){}}
function atlasWebKnowledge(query){
 chatHtml('<b>You:</b> '+esc(query)+'<br><br><span class="thinking">Atlas is checking online general knowledge…</span>');
 var url='https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(query)+'&format=json&utf8=1&origin=*';
 fetch(url).then(function(r){if(!r.ok)throw new Error('search failed');return r.json();}).then(function(j){
  var hit=j&&j.query&&j.query.search&&j.query.search[0];if(!hit)throw new Error('no result');
  var u='https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(hit.title)+'&format=json&origin=*';
  return fetch(u).then(function(r){return r.json();}).then(function(x){var pages=x&&x.query&&x.query.pages||{},page=null;Object.keys(pages).forEach(function(k){if(!page)page=pages[k];});var txt=page&&page.extract?String(page.extract):String(hit.snippet||'').replace(/<[^>]+>/g,'');if(txt.length>900)txt=txt.slice(0,897)+'…';chatHtml('<b>You:</b> '+esc(query)+'<br><br><b>Atlas:</b> '+esc(txt)+'<div class="muted" style="margin-top:8px">Online source: Wikipedia general-knowledge lookup. Live news, prices, weather and unrestricted web reasoning still require the production Atlas cloud/web service.</div>');});
 }).catch(function(){chatHtml('<b>You:</b> '+esc(query)+'<br><br><b>Atlas:</b> I do not have enough local company information to answer that, and the online knowledge lookup was unavailable or unsuitable. I will not guess. The production Atlas cloud AI/web service is required for unrestricted current-web questions.');});
}
function atlasAnswerBusiness(text,remindDialogue){var biz=typeof businessAnswer==='function'?businessAnswer(text):null;if(!biz)return false;if(remindDialogue)biz+='<div class="muted" style="margin-top:8px">Your unfinished transaction is still waiting. Continue it whenever you are ready.</div>';chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+biz);return true;}
var atlasPriorHandleAsk=window.handleAsk;
window.handleAsk=function(text){
 var s=String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
 if(typeof atlasDialogue!=='undefined'&&atlasDialogue){
  if(atlasAnswerBusiness(text,true))return;
  try{var qfin=typeof answerQuestion==='function'?answerQuestion(text):null;if(qfin&&atlasQuestionLike(text)&&!isPostingIntent(s)){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+qfin+'<div class="muted" style="margin-top:8px">Your unfinished transaction is still waiting.</div>');return;}}catch(e){}
  if(atlasQuestionLike(text)&&!isPostingIntent(s)){atlasWebKnowledge(text);return;}
  return atlasPriorHandleAsk(text);
 }
 if(/^(done|that is all|that's all|finished|finish|review basket|show basket)$/.test(s)){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> Your <b>'+atlasBasket.length+'</b> unposted transaction'+(atlasBasket.length===1?' is':'s are')+' still in the Posting Basket. Review them before posting.<div class="chatBtns"><button onclick="showPostingBasket()">Review basket</button></div>');showPostingBasket();return;}
 if(/^(post all|post basket|post everything|post them)$/.test(s)){confirmPostBasket();return;}
 if(/^(clear basket|cancel basket|remove all unposted)$/.test(s)){clearPostingBasket();return;}
 if(atlasAnswerBusiness(text,false))return;
 try{var fin=typeof answerQuestion==='function'?answerQuestion(text):null;if(fin&&!isPostingIntent(s)){chatHtml('<b>You:</b> '+esc(text)+'<br><br><b>Atlas:</b> '+fin);return;}}catch(e){}
 if(atlasQuestionLike(text)&&!isPostingIntent(s)){atlasWebKnowledge(text);return;}
 return atlasPriorHandleAsk(text);
};
function resetUniversalDemo(){if(!confirm('Reset the sample company knowledge, Posting Basket and local test ledger?'))return;try{enterprise=freshEnterprise();saveEnterprise();}catch(e){}try{atlasBasket=[];saveAtlasBasket();}catch(e){}try{saveAtlasContext(null);}catch(e){}try{clearAtlasDialogue();}catch(e){try{localStorage.removeItem('atlas_dialogue_v3');}catch(x){}}try{state=fresh();save();}catch(e){}chat('Atlas','Demo data reset.');}
function atlasInjectUi(){atlasRepairDemoOpening();var ai=document.querySelector('.card.ai');if(ai&&!document.getElementById('atlasBasketCard')){var c=document.createElement('div');c.id='atlasBasketCard';c.className='card';ai.parentNode.insertBefore(c,ai.nextSibling);}renderBasketCard();var sub=document.querySelector('.sub');if(sub)sub.textContent='Financial OS · Universal Intelligence Test Build 0.4';var q=document.getElementById('q');if(q)q.placeholder='Ask about the business, or tell Atlas what happened';}
window.resetUniversalDemo=resetUniversalDemo;
window.addEventListener('DOMContentLoaded',function(){setTimeout(atlasInjectUi,80);});
