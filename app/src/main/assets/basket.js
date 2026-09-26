/* Atlas Posting Basket v0.4 */
var ATLAS_BASKET_KEY='atlas_posting_basket_v1';
var atlasBasket=(function(){try{return JSON.parse(localStorage.getItem(ATLAS_BASKET_KEY)||'[]')}catch(e){return[]}})();
function atlasCopy(x){return JSON.parse(JSON.stringify(x));}
function atlasSum(arr,fn){var n=0;for(var i=0;i<arr.length;i++)n+=Number(fn?fn(arr[i]):arr[i])||0;return n;}
function atlasMoney(n){return typeof money==='function'?money(n):('GH₵ '+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));}
function saveAtlasBasket(){localStorage.setItem(ATLAS_BASKET_KEY,JSON.stringify(atlasBasket));renderBasketCard();}

var atlasPreviousReviewPosting=window.reviewPosting;
window.reviewPosting=function(p){
 var err=(p&&p.error)||(typeof validateLines==='function'?validateLines((p&&p.lines)||[]):'');
 if(err){if(typeof chat==='function')chat('Atlas',err);return false;}
 var item={id:'B'+Date.now()+'_'+Math.floor(Math.random()*10000),memo:p.memo||'Journal posting',lines:atlasCopy(p.lines||[]),source:p.source||'Ask Atlas',addedAt:new Date().toISOString()};
 atlasBasket.push(item);saveAtlasBasket();
 if(typeof pending!=='undefined')pending=null;
 var total=atlasSum(item.lines,function(l){return Number(l.debit||0);});
 chatHtml('<b>Atlas:</b> I added <b>'+esc(item.memo)+'</b> ('+atlasMoney(total)+') to your <b>Posting Basket</b>.<br><br>You now have <b>'+atlasBasket.length+'</b> transaction'+(atlasBasket.length===1?'':'s')+' waiting. Tell me the next activity, or say <b>done</b> when you want to review everything.<div class="chatBtns"><button onclick="showPostingBasket()">View basket</button><button class="secondary" onclick="atlasChoice(\'done\')">Done</button></div>');
 return true;
};

function renderBasketCard(){
 var c=document.getElementById('atlasBasketCard');if(!c)return;
 var total=0;for(var i=0;i<atlasBasket.length;i++)total+=atlasSum(atlasBasket[i].lines,function(l){return Number(l.debit||0);});
 c.innerHTML='<div class="sectionTitle"><b>Posting Basket</b><button onclick="showPostingBasket()">Review</button></div><div style="display:flex;justify-content:space-between;align-items:end;margin-top:10px"><div><span class="muted">Unposted transactions</span><div style="font-size:24px;font-weight:850;margin-top:3px">'+atlasBasket.length+'</div></div><div style="text-align:right"><span class="muted">Batch value</span><div style="font-weight:800;margin-top:3px">'+atlasMoney(total)+'</div></div></div><div class="muted" style="margin-top:8px">'+(atlasBasket.length?'Keep adding activities. They stay here until you post or remove them.':'New interpreted transactions will collect here until you say “done”.')+'</div>';
}

function showPostingBasket(){
 if(!atlasBasket.length){modal('<h2>Posting Basket</h2><p class="muted">The basket is empty. Tell Atlas a transaction in ordinary words and it will collect here.</p>');return;}
 var grand=0,html='<h2>Posting Basket</h2><p class="muted">Nothing below has been posted yet. Review the whole batch first.</p>';
 for(var i=0;i<atlasBasket.length;i++){
  var p=atlasBasket[i],tot=atlasSum(p.lines,function(l){return Number(l.debit||0);});grand+=tot;
  html+='<div style="border:1px solid #e2e7ef;border-radius:14px;padding:12px;margin:9px 0"><b>'+(i+1)+'. '+esc(p.memo)+'</b><div class="muted" style="margin:5px 0">'+atlasMoney(tot)+'</div><div class="miniTable"><table><tr><th>Account</th><th>Debit</th><th>Credit</th></tr>';
  for(var j=0;j<p.lines.length;j++){var l=p.lines[j];html+='<tr><td>'+esc(l.account)+'</td><td>'+(l.debit?atlasMoney(l.debit):'')+'</td><td>'+(l.credit?atlasMoney(l.credit):'')+'</td></tr>';}
  html+='</table></div><button class="secondary full" onclick="removeBasketItem(\''+p.id+'\')">Remove this transaction</button></div>';
 }
 html+='<div class="reportLine"><b>Batch total</b><b>'+atlasMoney(grand)+'</b></div><div class="exportRow"><button onclick="confirmPostBasket()">Post all '+atlasBasket.length+'</button><button class="secondary" onclick="clearPostingBasket()">Clear basket</button></div>';
 modal(html);
}
function removeBasketItem(id){atlasBasket=atlasBasket.filter(function(x){return x.id!==id});saveAtlasBasket();closeModal();showPostingBasket();}
function clearPostingBasket(){if(confirm('Clear all unposted transactions from the basket?')){atlasBasket=[];saveAtlasBasket();closeModal();chat('Atlas','Posting Basket cleared. Nothing was posted.');}}
function confirmPostBasket(){
 if(!atlasBasket.length)return;
 modal('<h2>Final posting confirmation</h2><p>You are about to post <b>'+atlasBasket.length+'</b> transaction'+(atlasBasket.length===1?'':'s')+' to the local test ledger. Existing journal entries will remain unchanged.</p><button class="full" onclick="postAllBasketNow()">Confirm and post all</button><button class="secondary full" style="margin-top:8px" onclick="closeModal()">Go back</button>');
}
function postAllBasketNow(){
 for(var i=0;i<atlasBasket.length;i++){var e=validateLines(atlasBasket[i].lines);if(e){toast('Basket item '+(i+1)+': '+e);return;}}
 var copy=atlasBasket.slice(),posted=0;
 for(var j=0;j<copy.length;j++){
  if(post(copy[j].lines,copy[j].memo,'Posting Basket')){posted++;if(typeof syncEnterpriseFromPosting==='function')syncEnterpriseFromPosting(copy[j]);}else break;
 }
 if(posted===copy.length){atlasBasket=[];saveAtlasBasket();closeModal();chatHtml('<b>Atlas:</b> Posted <b>'+posted+'</b> transaction'+(posted===1?'':'s')+' successfully. Earlier journal entries remain intact, and the reports now include the new batch.');}
}
window.showPostingBasket=showPostingBasket;window.removeBasketItem=removeBasketItem;window.clearPostingBasket=clearPostingBasket;window.confirmPostBasket=confirmPostBasket;window.postAllBasketNow=postAllBasketNow;
