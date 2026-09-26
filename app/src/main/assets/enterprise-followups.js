/* Contextual follow-ups layered over enterprise.js */
var atlasBaseBusinessAnswer=window.businessAnswer;
window.businessAnswer=function(text){
 var s=entNorm(text);
 if(atlasQueryContext&&atlasQueryContext.type==='products'){
  var items=entContextItems();
  if(items.length&&/(when.*last|last.*(buy|bought|purchase)|when.*(buy|bought|purchase)|last purchase)/.test(s)){
   return items.map(function(p){return '<b>'+esc(p.name)+'</b>: last purchased '+esc(p.lastPurchase)+' — '+p.lastPurchaseQty+' units at '+entMoney(p.lastPurchaseUnitCost)+' each from '+esc(p.supplier)+'.';}).join('<br>')+demoSource();
  }
  if(items.length&&/(who.*supplier|who supplies|supplier.*it|where.*buy)/.test(s)){
   return items.map(function(p){return '<b>'+esc(p.name)+'</b>: '+esc(p.supplier)+'.';}).join('<br>')+demoSource();
  }
  if(items.length&&/(how much.*(cost|price)|price.*it|cost.*it)/.test(s)){
   return items.map(function(p){return '<b>'+esc(p.name)+'</b>: cost '+entMoney(p.lastPurchaseUnitCost)+', selling price '+entMoney(p.price)+'.';}).join('<br>')+demoSource();
  }
 }
 if(atlasQueryContext&&atlasQueryContext.type==='employees'){
  var staff=entContextItems();
  if(staff.length&&/(what.*role|what.*do|department|position)/.test(s))return staff.map(function(e){return '<b>'+esc(e.name)+'</b> — '+esc(e.role)+', '+esc(e.department)+'.';}).join('<br>')+demoSource();
 }
 return atlasBaseBusinessAnswer?atlasBaseBusinessAnswer(text):null;
};
