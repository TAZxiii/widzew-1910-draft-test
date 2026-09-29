/* Robust launcher for interactive season matches. */
(function(){
  'use strict';

  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('#playMatchButton');
    if(!button)return;

    const originalQuery=Document.prototype.querySelector;
    let intercepted=false;

    Document.prototype.querySelector=function(selector){
      if(!intercepted && selector==='.round-match.widzew-match'){
        intercepted=true;
        try{
          const state=window.seasonGameState;
          const round=Number(state?.currentRound);
          const fixtures=Array.isArray(state?.widzewFixtures)?state.widzewFixtures:[];
          const fixture=fixtures.find(f=>Number(f.kolejka)===round);
          if(fixture){
            const host=document.createElement('div');
            host.textContent=`${fixture.gospodarz||''} ${fixture.gosc||''}`;
            return host;
          }
        }catch(e){
          console.warn('Nie udało się ustalić meczu z terminarza:',e);
        }
        return originalQuery.call(this,selector);
      }
      return originalQuery.call(this,selector);
    };

    setTimeout(function(){
      if(Document.prototype.querySelector!==originalQuery){
        Document.prototype.querySelector=originalQuery;
      }
    },5000);
  },true);
})();
