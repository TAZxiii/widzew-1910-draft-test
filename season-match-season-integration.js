/* Integrates the real interactive match result into the stable per-round season database. */
(function(){
  'use strict';
  let committedRound=null,timer=null;
  function currentRound(){return Number(window.seasonGameState?.currentRound)}
  function findCurrentResult(){const r=currentRound();return(window.seasonGameState?.widzewResults||[]).find(m=>Number(m.round)===r)||null}
  function commit(){const result=findCurrentResult();if(!result)return false;const round=Number(result.round);if(committedRound===round)return true;if(typeof window.storePlayedMatch==='function'){const stored=window.storePlayedMatch(result);if(!stored)return false;}else{return false;}committedRound=round;return true}
  function check(){const overlay=document.getElementById('wsm-overlay'),close=document.getElementById('wsm-close');if(!overlay||!close)return;if(getComputedStyle(close).display!=='none')commit()}
  document.addEventListener('click',e=>{if(e.target?.closest?.('#wsm-close'))setTimeout(commit,0)},true);
  function start(){if(timer)return;timer=setInterval(check,200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer)});
})();
