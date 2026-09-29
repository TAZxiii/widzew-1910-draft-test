/* Season mode separation:
   - SYMULUJ SEZON: generated results + scorers are visible immediately.
   - ROZEGRAJ SEZON: the same kind of results are generated in a hidden
     baseline DB; a played/revealed round replaces the baseline result.
*/
(function(){
  "use strict";

  let seasonDB=null;
  let capturedSquad=null;

  function readFinalSquadFromDOM(){
    const pool=[];
    const starters=Array.from(document.querySelectorAll(".squad-list-player"));
    const bench=Array.from(document.querySelectorAll(".bench-player"));
    const starterRole={"BR":"br","LO/PO":"loPo","ŚO":"so","ŚPD/ŚP/OP":"pomoc","LS/LP/PS/PP":"skrzydlowi","N":"napastnicy"};
    const makePlayer=(name,role,position)=>{
      const parts=String(name||"").trim().split(/\s+/);
      if(parts.length<2||!role)return null;
      const first=parts.shift(),last=parts.join(" ");
      return {row:{"Imię":first,"Nazwisko":last},role,position};
    };
    starters.forEach(el=>{
      const info=el.querySelector(".squad-player-info");
      const name=info?.querySelector("strong")?.textContent||"";
      const position=info?.querySelector("small")?.textContent.trim()||"";
      const p=makePlayer(name,starterRole[position],position);
      if(p)pool.push(p);
    });
    bench.forEach(el=>{
      const info=el.querySelector(".bench-info");
      const name=info?.querySelector("strong")?.textContent||"";
      const position=info?.querySelector("small")?.textContent.trim()||"";
      const n=position.toUpperCase().replace(/\s+/g,"");
      let role="bench-mid";
      if(n==="BR")role="bench-br";
      else if(n==="N")role="bench-n";
      else if(["ŚO","SO","LO/PO","LOPO"].includes(n))role="bench-def";
      const p=makePlayer(name,role,position);
      if(p)pool.push(p);
    });
    return pool.length===20?pool:null;
  }

  document.addEventListener("click",e=>{
    const b=e.target?.closest?.("#playSeasonButton");
    if(!b)return;
    const s=readFinalSquadFromDOM();
    if(s)capturedSquad=s;
  },true);

  function getScorerSquad(){
    if(capturedSquad&&capturedSquad.length===20)return capturedSquad;
    return readFinalSquadFromDOM()||[];
  }

  function category(p){
    const pos=String(p.position||"").toUpperCase().replace(/\s+/g,"");
    if(pos==="N")return"N";
    if(pos==="ŚO"||pos==="SO")return"CB";
    if(pos==="LO/PO"||pos==="LOPO")return"DEF";
    if(pos.includes("ŚPD")||pos.includes("ŚP")||pos.includes("OP"))return"MID";
    if(pos.includes("LS")||pos.includes("LP")||pos.includes("PS")||pos.includes("PP"))return"WING";
    const role=String(p.role||"");
    if(role==="napastnicy"||role==="bench-n")return"N";
    if(role==="so"||role==="bench-cb")return"CB";
    if(role==="loPo"||role==="bench-def")return"DEF";
    if(role==="pomoc"||role==="bench-mid")return"MID";
    if(role==="skrzydlowi"||role==="bench-wing")return"WING";
    return"N";
  }

  function chooseWeightedScorerFrom20(){
    const squad=getScorerSquad();
    const starters=squad.filter(p=>!String(p.role||"").startsWith("bench-"));
    const bench=squad.filter(p=>String(p.role||"").startsWith("bench-"));
    const sp={N:[],MID:[],WING:[],DEF:[],CB:[]};
    const bp={N:[],MID:[],WING:[],DEF:[],CB:[]};
    starters.forEach(p=>sp[category(p)]?.push(p));
    bench.forEach(p=>bp[category(p)]?.push(p));

    const base={N:33,MID:12,WING:9,DEF:7,CB:5};
    const sw={...base};
    const available=Object.keys(base).filter(c=>sp[c].length);
    Object.keys(base).forEach(c=>{
      if(!sp[c].length&&available.length){
        const bonus=base[c]/4;
        available.forEach(a=>sw[a]+=bonus);
      }
    });

    const candidates=[];
    available.forEach(c=>candidates.push(["starter",c,sw[c]]));
    const bw={N:18,MID:6,WING:5,DEF:3,CB:1};
    Object.keys(bw).forEach(c=>{if(bp[c].length)candidates.push(["bench",c,bw[c]]);});
    candidates.push(["own","OWN",1]);

    const fallback=[...starters,...bench].filter(p=>String(p.position||"").toUpperCase()!=="BR");
    if(!fallback.length)return{type:"widzew",name:"Zawodnik Widzewa",player:null};

    const total=candidates.reduce((s,x)=>s+x[2],0);
    let roll=Math.random()*total;
    for(const [side,cat,weight] of candidates){
      roll-=weight;
      if(roll<=0){
        if(side==="own")return{type:"own",name:"Samobój",player:null};
        const pool=side==="starter"?sp[cat]:bp[cat];
        if(pool.length){
          const p=pool[Math.floor(Math.random()*pool.length)];
          const name=`${p.row?.["Imię"]||""} ${p.row?.["Nazwisko"]||""}`.trim()||"Zawodnik Widzewa";
          return{type:"widzew",name,player:p};
        }
      }
    }
    const p=fallback[Math.floor(Math.random()*fallback.length)];
    const name=`${p.row?.["Imię"]||""} ${p.row?.["Nazwisko"]||""}`.trim()||"Zawodnik Widzewa";
    return{type:"widzew",name,player:p};
  }

  function drawScorer(){
    try{
      if(typeof window.drawWidzewScorer==="function"){
        const s=window.drawWidzewScorer();
        if(s&&String(s.type||"").toLowerCase()!=="opponent")return s;
      }
    }catch(e){}
    return chooseWeightedScorerFrom20();
  }

  function cleanPlayerName(value){
    return String(value||"").trim().replace(/^(?:Zawodnik|Zawodnika)\s+/i,"").trim();
  }

  function cloneScorer(s){
    const type=String(s?.type||"widzew").toLowerCase();
    const own=type==="own"||type==="own-goal"||type==="samoboj";
    const opponent=type==="opponent";
    return{
      minute:Number(s?.minute)||1,
      type:opponent?"opponent":(own?"own":(s?.type||"widzew")),
      name:opponent?"Przeciwnik":(own?"Samobój":cleanPlayerName(s?.name||s?.player?.name||s?.playerRef?.name||"")),
      player:s?.player||s?.playerRef||null
    };
  }

  function cloneMatch(m){
    return{
      round:Number(m?.round),
      opponent:m?.opponent,
      home:!!m?.home,
      gf:Number(m?.gf)||0,
      ga:Number(m?.ga)||0,
      scorers:Array.isArray(m?.scorers)?m.scorers.map(cloneScorer):[]
    };
  }

  function isWidzewScorer(s){
    const t=String(s?.type||"").toLowerCase();
    return t==="widzew"||t==="own"||t==="own-goal"||t==="samoboj";
  }

  function repairMatchScorers(match){
    const m=cloneMatch(match);
    if(!Array.isArray(m.scorers))m.scorers=[];
    const used=new Set(m.scorers.map(s=>Number(s.minute)||0));

    let countedWidzew=m.scorers.filter(isWidzewScorer).length;
    const targetWidzew=Math.max(0,m.gf);
    while(countedWidzew<targetWidzew){
      const s=drawScorer();
      let minute=1+Math.floor(Math.random()*90);
      while(used.has(minute)&&used.size<90)minute=1+Math.floor(Math.random()*90);
      used.add(minute);
      const own=String(s?.type||"").toLowerCase().includes("own");
      m.scorers.push({
        minute,
        type:own?"own":"widzew",
        name:own?"Samobój":cleanPlayerName(s?.name)||"Zawodnik Widzewa",
        player:s?.player||s?.playerRef||null
      });
      countedWidzew++;
    }

    // Wynik meczu może pochodzić z silnika, który zapisuje tylko gole Widzewa.
    // Dla każdego gola przeciwnika dodajemy więc brakujący wpis "Przeciwnik".
    let countedOpponent=m.scorers.filter(s=>String(s?.type||"").toLowerCase()==="opponent").length;
    const targetOpponent=Math.max(0,m.ga);
    while(countedOpponent<targetOpponent){
      let minute=1+Math.floor(Math.random()*90);
      while(used.has(minute)&&used.size<90)minute=1+Math.floor(Math.random()*90);
      used.add(minute);
      m.scorers.push({minute,type:"opponent",name:"Przeciwnik",player:null});
      countedOpponent++;
    }

    m.scorers.sort((a,b)=>Number(a.minute)-Number(b.minute));
    return m;
  }

  function toDBResult(match){
    const m=cloneMatch(match);
    return{
      round:m.round,
      opponent:m.opponent,
      home:m.home,
      homeGoals:m.home?m.gf:m.ga,
      awayGoals:m.home?m.ga:m.gf,
      widzewGoals:m.gf,
      opponentGoals:m.ga,
      scorers:m.scorers.map(cloneScorer)
    };
  }

  function fromDBResult(r){
    return{
      round:Number(r?.round),
      opponent:r?.opponent,
      home:!!r?.home,
      gf:Number(r?.widzewGoals)||0,
      ga:Number(r?.opponentGoals)||0,
      scorers:Array.isArray(r?.scorers)?r.scorers.map(cloneScorer):[]
    };
  }

  function ensureDB(results){
    if(seasonDB)return seasonDB;
    seasonDB={};
    (results||[]).forEach(m=>{
      const fixed=repairMatchScorers(m);
      seasonDB[Number(fixed.round)]={
        round:Number(fixed.round),
        opponent:fixed.opponent,
        home:!!fixed.home,
        simulated:toDBResult(fixed),
        played:null
      };
    });
    window.seasonMatchDB=seasonDB;
    return seasonDB;
  }

  function resetDB(){
    seasonDB=null;
    window.seasonMatchDB=null;
  }

  function effectiveResults(){
    const db=seasonDB||window.seasonMatchDB;
    if(!db)return[];
    return Object.keys(db).map(Number).sort((a,b)=>a-b).map(r=>{
      const slot=db[r];
      return fromDBResult(slot.played||slot.simulated);
    });
  }

  window.getSeasonMatchDB=()=>seasonDB||window.seasonMatchDB||{};
  window.getSeasonEffectiveResults=effectiveResults;

  /* A played match always replaces the hidden simulated result for that round. */
  window.storePlayedMatch=function(match){
    if(!match)return false;
    const round=Number(match.round);
    const db=seasonDB||window.seasonMatchDB;
    if(!db||!db[round])return false;

    const fixed=repairMatchScorers(match);
    db[round].played=toDBResult(fixed);

    const list=Array.isArray(window.seasonGameState?.widzewResults)
      ? window.seasonGameState.widzewResults : [];
    const idx=list.findIndex(x=>Number(x.round)===round);
    if(idx>=0)list[idx]=fixed;
    else list.push(fixed);
    return true;
  };

  function renderScorers(container,match){
    if(!container||!match)return;
    const sc=Array.isArray(match.scorers)?match.scorers.slice():[];
    const isOwn=s=>{
      const t=String(s?.type||"").toLowerCase();
      return t==="own"||t==="own-goal"||t==="samoboj"||
        String(s?.name||"").toLocaleLowerCase("pl")==="samobój";
    };
    const normal=sc.filter(s=>!isOwn(s)).sort((a,b)=>Number(a.minute)-Number(b.minute));
    const own=sc.filter(isOwn).sort((a,b)=>Number(a.minute)-Number(b.minute));
    const row=s=>{
      const t=String(s.type||"").toLowerCase();
      const color=t==="opponent"?"scorer-opponent":"scorer-widzew";
      const name=isOwn(s)?"Samobój":(s.name||"Zawodnik Widzewa");
      return`<span class="${color}">${Math.max(1,Math.min(90,Number(s.minute)||1))}' ${name}</span>`;
    };
    container.innerHTML=normal.map(row).join("")+
      (own.length?`<span class="scorer-own-divider"></span>${own.map(row).join("")}`:"");
  }

  function getOrCreateScorerContainer(el){
    if(!el)return null;
    let c=el.querySelector(".match-scorers");
    if(!c){
      c=document.createElement("div");
      c.className="match-scorers";
      el.appendChild(c);
    }
    return c;
  }

  function decorateVisibleScorers(match){
    const el=document.querySelector(".round-match.widzew-match");
    if(el)renderScorers(getOrCreateScorerContainer(el),match);
  }

  function decorateAllFinalScorers(){
    const results=effectiveResults();
    document.querySelectorAll(".round-match.widzew-match").forEach((el,i)=>{
      const m=results[i];
      if(m)renderScorers(getOrCreateScorerContainer(el),m);
    });
  }

  function enhanceLeagueTable(){
    const table=document.getElementById("leagueTable");
    if(!table)return;
    const panel=table.closest(".league-table-panel");
    if(panel&&!panel.querySelector(".league-competition-logo")){
      const logo=document.createElement("img");
      logo.className="league-competition-logo";
      logo.src="data/logos/ekstraklasa.png";
      logo.alt="Ekstraklasa";
      logo.style.objectFit="contain";
      panel.appendChild(logo);
    }
    const old=table.querySelector(".league-table-header");
    if(old)old.remove();
    const h=document.createElement("div");
    h.className="league-table-header";
    ["#","Drużyna","M","Z","R","P","B","Pkt"].forEach(label=>{
      const c=document.createElement("span");
      c.textContent=label;
      h.appendChild(c);
    });
    table.insertBefore(h,table.firstChild);
  }

  function addStyles(){
    if(document.getElementById("seasonScorerFixStyles"))return;
    const s=document.createElement("style");
    s.id="seasonScorerFixStyles";
    s.textContent=`.match-scorers{display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:7px;font-size:13px;font-weight:800;line-height:1.25}.match-scorers .scorer-widzew{color:#39d353}.match-scorers .scorer-opponent{color:#ff4d4f}.scorers-panel .scorer-row{grid-template-columns:35px 18px minmax(0,1fr);gap:6px}.scorers-panel .scorer-row strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.league-table-panel{position:relative}.league-competition-logo{position:absolute;top:16px;left:18px;width:72px;height:72px;object-fit:contain;z-index:2}.league-table-panel .season-panel-title{padding-left:88px}.league-table-header,.league-row{display:grid;grid-template-columns:32px minmax(190px,1fr) 28px 28px 28px 28px 58px 38px;gap:5px;align-items:center}.league-table-header{min-height:32px;padding:3px 7px;color:#aaa;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;text-align:center;border-bottom:1px solid rgba(255,255,255,.14);margin-bottom:4px}.league-table-header span:nth-child(2){text-align:left}@media(max-width:700px){.league-competition-logo{width:56px;height:56px;top:12px;left:12px}.league-table-panel .season-panel-title{padding-left:70px}.league-table-header,.league-row{grid-template-columns:25px minmax(120px,1fr) 25px 25px 25px 25px 48px 35px;gap:3px}.league-table-header{font-size:9px}.league-row{font-size:11px}}`;
    document.head.appendChild(s);
  }

  function buildBaseline(){
    const originalRenderFinal=window.renderFinalSeason;
    try{
      window.renderFinalSeason=function(){};
      window.simulateWholeSeason?.();
    }finally{
      window.renderFinalSeason=originalRenderFinal;
    }

    const generated=(window.seasonGameState?.widzewResults||[]).map(repairMatchScorers);
    ensureDB(generated);
    return generated;
  }

  function install(){
    const originalInit=window.initSeasonMode;
    if(typeof originalInit!=="function")return;

    window.initSeasonMode=async function(mode){
      resetDB();
      const result=await originalInit.apply(this,arguments);

      if(mode==="play"){
        /* Generate the whole season once, but keep it hidden from the UI. */
        buildBaseline();
        window.seasonGameState.widzewResults=[];
        window.seasonGameState.scorers={};

        const trainerStartRound = window.__widzewGameMode === "coach"
          ? Math.max(1, Number(window.__widzewTrainerStartRound) || 1)
          : 1;
        window.seasonGameState.currentRound = trainerStartRound;

        // W trybie TRENER wcześniejsze mecze Widzewa są już rozegrane.
        // Bierzemy ich rzeczywiste wyniki bezpośrednio z terminarza CSV.
        if(trainerStartRound > 1){
          window.seasonGameState.widzewFixtures
            .filter(f => Number(f.kolejka) < trainerStartRound)
            .forEach(f => {
              const score = typeof window.seasonResultParts === "function"
                ? window.seasonResultParts(f.wynik)
                : String(f.wynik || "").match(/^(\\d+)\\s*:\\s*(\\d+)$/)?.slice(1).map(Number);
              if(!score) return;
              const home = window.seasonTeamName(f.gospodarz) === "Widzew Łódź";
              const match = {
                round: Number(f.kolejka),
                opponent: home ? window.seasonTeamName(f.gosc) : window.seasonTeamName(f.gospodarz),
                home,
                gf: home ? score[0] : score[1],
                ga: home ? score[1] : score[0],
                scorers: []
              };
              window.seasonGameState.widzewResults.push(match);

              const slot = seasonDB?.[match.round];
              if(slot) slot.played = toDBResult(match);
            });
        }

        if(typeof window.renderPlayableSeason==="function")window.renderPlayableSeason();
      }else if(mode==="simulate"){
        /* The core already generated the season. Repair any missing scorer rows,
           rebuild the DB from the repaired results and render again. */
        const repaired=(window.seasonGameState?.widzewResults||[]).map(repairMatchScorers);
        window.seasonGameState.widzewResults=repaired;
        window.seasonGameState.scorers={};
        repaired.forEach(m=>{
          if(typeof window.updateTopScorersFromMatch==="function")window.updateTopScorersFromMatch(m);
        });
        ensureDB(repaired);
        if(typeof window.renderFinalSeason==="function")window.renderFinalSeason();
      }

      return result;
    };
    window.initSeasonMode.__seasonPlayFixHook=true;

    window.simulateCurrentWidzewMatch=function(){
      const round=Number(window.seasonGameState?.currentRound);
      const db=seasonDB||window.seasonMatchDB;
      const slot=db?.[round];
      if(!slot)return;
      const list=window.seasonGameState.widzewResults||[];
      if(list.some(m=>Number(m.round)===round))return;

      const revealed=repairMatchScorers(fromDBResult(slot.played||slot.simulated));
      list.push(revealed);

      if(typeof window.recordSeasonMatchScorers==="function"){
        window.recordSeasonMatchScorers(revealed);
      }
      if(typeof window.renderPlayableSeason==="function")window.renderPlayableSeason();
      enhanceLeagueTable();
      decorateVisibleScorers(revealed);
    };

    const originalRenderFinal=window.renderFinalSeason;
    if(typeof originalRenderFinal==="function"&&!originalRenderFinal.__seasonPlayFixHook){
      const wrappedFinal=function(){
        const db=seasonDB||window.seasonMatchDB;
        if(db&&Object.keys(db).length){
          window.seasonGameState.widzewResults=effectiveResults().map(repairMatchScorers);
        }
        const r=originalRenderFinal.apply(this,arguments);
        enhanceLeagueTable();
        decorateAllFinalScorers();
        return r;
      };
      wrappedFinal.__seasonPlayFixHook=true;
      window.renderFinalSeason=wrappedFinal;
    }

    const originalRenderLeague=window.renderLeagueTable;
    if(typeof originalRenderLeague==="function"&&!originalRenderLeague.__seasonPlayFixHook){
      const wrappedTable=function(){
        const r=originalRenderLeague.apply(this,arguments);
        enhanceLeagueTable();
        return r;
      };
      wrappedTable.__seasonPlayFixHook=true;
      window.renderLeagueTable=wrappedTable;
    }
  }

  addStyles();

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",install,{once:true});
  }else{
    install();
  }
})();