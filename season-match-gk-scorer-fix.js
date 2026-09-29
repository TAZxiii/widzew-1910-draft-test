/* Fix goalkeeper stats and preserve the actual Widzew shooter as scorer. */
(function(){
  'use strict';
  const GK_ACTIONS=new Set(['107.1','107.2','107.3','108.2','108.3']);
  let pendingShot=null,goalScorers=[],seenScorerCount=0;
  function goalkeeperStats(){
    try{
      const db=typeof window.getWidzewSeasonPlayerDB==='function'?window.getWidzewSeasonPlayerDB():null;
      const p=(db?.players||[]).find(x=>x.slot==='starter'&&String(x.position||'').toUpperCase()==='BR');
      if(!p)return null;
      const r=p.stats||{},n=k=>{const v=Number(String(r[k]??50).replace(',','.'));return Number.isFinite(v)?v:50};
      return {defensywa:n('Defensywa'),szybkosc:n('Szybkość'),podania:n('Podania'),atak:n('Atak'),zaangazowanie:n('Zaangażowanie'),kreatywnosc:n('Kreatywność'),strzal:n('Strzał'),ogolna:n('Ogólna'),graNogami:n('Gra nogami'),piastkowanie:n('Piastkowanie'),robinsonada:n('Robinsonada'),br:n('BR')};
    }catch(e){return null}
  }
  function withGK(base){const g=goalkeeperStats();return g?{...(base||{}),br:g.br,graNogami:g.graNogami,piastkowanie:g.piastkowanie,robinsonada:g.robinsonada}:base}
  function patchEngine(){
    const E=window.WidzewSeasonMatchEngine;if(!E||E.__gkScorerFix)return;
    const calc=E.calculateActionProbability,resolve=E.resolveAction;
    E.calculateActionProbability=function(id,c){const x={...(c||{})};if(GK_ACTIONS.has(String(id)))x.performerStats=goalkeeperStats()||x.performerStats;if(String(id)==='110')x.opponentStats=withGK(x.opponentStats);return calc.call(this,id,x)};
    E.resolveAction=function(id,c){const x={...(c||{})};if(GK_ACTIONS.has(String(id)))x.performerStats=goalkeeperStats()||x.performerStats;if(String(id)==='110')x.opponentStats=withGK(x.opponentStats);return resolve.call(this,id,x)};
    E.__gkScorerFix=true;
  }
  function eventShooter(){
    const text=String(document.getElementById('wsm-event')?.textContent||'').trim();if(!text)return null;
    let m=text.match(/^(.+?)\s+ma piłkę\s+\d+\s*m/i);if(m)return m[1].trim();
    m=text.match(/^(.+?)\s+znajduje się na skrzydle\s+\d+\s*m/i);if(m)return m[1].trim();
    m=text.match(/^(.+?)\s+wykonuje rzut rożny/i);if(m)return m[1].trim();
    m=text.match(/^(.+?)\s+wykonuje rzut wolny(?:\s+\d+\s*m)?/i);if(m)return m[1].trim();
    m=text.match(/^(.+?)\s+wykonuje aut\s+\d+\s*m/i);if(m)return m[1].trim();
    m=text.match(/^Piłka spada w kierunku\s+(.+?)\s+\d+\s*m/i);if(m)return m[1].trim();
    return null;
  }
  function patchAllResultScorers(){
    const state=window.seasonGameState;if(!state||!goalScorers.length)return;
    const round=Number(state.currentRound),list=Array.isArray(state.widzewResults)?state.widzewResults:[],r=list.find(x=>Number(x.round)===round);
    if(r&&Array.isArray(r.scorers)){const ws=r.scorers.filter(x=>x.type==='widzew');goalScorers.forEach((name,i)=>{if(ws[i]){ws[i].name=name;ws[i].player=name;}})}
    const db=window.seasonMatchDB,entry=db&&db[round];
    if(entry?.played?.scorers?.length){const ws=entry.played.scorers.filter(x=>x.type==='widzew');goalScorers.forEach((name,i)=>{if(ws[i]){ws[i].name=name;ws[i].player=name;}})}
  }
  function watchScorers(){
    const el=document.getElementById('wsm-scorers');if(!el||el.__gkObserver)return;el.__gkObserver=true;
    const obs=new MutationObserver(()=>{const divs=el.querySelectorAll(':scope > div');if(divs.length<=seenScorerCount||!pendingShot)return;for(let i=seenScorerCount;i<divs.length;i++){goalScorers.push(pendingShot);const minute=String(divs[i].textContent).match(/(\d+)\s*$/)?.[1]||'';divs[i].textContent=pendingShot+' — '+minute;}seenScorerCount=divs.length;});
    obs.observe(el,{childList:true,subtree:true});
  }
  function watchFinish(){
    const status=document.getElementById('wsm-status');if(!status||status.__gkFinishObserver)return;status.__gkFinishObserver=true;
    const obs=new MutationObserver(()=>{if(/Mecz zakończony/i.test(status.textContent||''))patchAllResultScorers()});
    obs.observe(status,{childList:true,characterData:true,subtree:true});
  }
  document.addEventListener('click',function(ev){
    const start=ev.target?.closest?.('#playMatchButton');if(start){pendingShot=null;goalScorers=[];seenScorerCount=0;return;}
    const b=ev.target?.closest?.('.wsm-action');if(!b)return;
    const name=eventShooter(),actionName=String(b.querySelector('.wsm-action-name')?.textContent||'');
    if(name&&/Uderz|głów|wolejem|przewrotką|szczupakiem/i.test(actionName))pendingShot=name;
  },true);
  const boot=setInterval(()=>{patchEngine();watchScorers();watchFinish()},500);setTimeout(()=>clearInterval(boot),30000);
})();
