/* Atlas Hybrid native bridge overrides v0.5 */
(function(){
 function bridge(){return window.AtlasNative||null;}
 window.startAtlasVoice=function(){var b=bridge();if(b&&b.startVoice){toast('Listening…');b.startVoice();}else toast('Voice recognition is unavailable on this device.');};
 window.atlasCloudAsk=function(q){var c=typeof cloudCfg==='function'?cloudCfg():{};var b=bridge();if(!c.endpoint||!b||!b.cloudAsk)return false;chatHtml('<b>You:</b> '+esc(q)+'<br><br><span class="thinking">Atlas Cloud is thinking…</span>');b.cloudAsk(c.endpoint,JSON.stringify(cloudPayload(q)));return true;};
 if(typeof atlasWikipediaFallback==='undefined'&&window.atlasWebKnowledge)window.atlasWikipediaFallback=window.atlasWebKnowledge;
 window.atlasWebKnowledge=function(q){if(window.atlasCloudAsk(q))return;if(typeof window.atlasWikipediaFallback==='function')return window.atlasWikipediaFallback(q);};
 var btn=document.getElementById('atlasVoiceBtn');if(btn)btn.onclick=window.startAtlasVoice;
})();
