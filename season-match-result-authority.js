/* Final authority bridge: commit the interactive result before the match overlay can close. */
(function(){
  'use strict';
  function commitPlayedNow(){
    const state=window.seasonGameState;
    const round=Number(state?.currentRound);
    if(!state||!Number.isFinite(round)||typeof window.storePlayedMatch!=='function')return false;
    const result=(state.widzewResults||[]).find(m=>Number(m.round)===round);
    if(!result)return false;
    return !!window.storePlayedMatch(result);
  }
  document.addEventListener('click',function(e){
    if(!e.target?.closest?.('#wsm-close'))return;
    commitPlayedNow();
  },true);
  window.commitCurrentPlayedMatch=commitPlayedNow;
})();
