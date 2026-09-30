/* Main-game integration for the standalone season match engine. */
(function(){
  'use strict';
  const ENGINE_SCRIPTS=['season-match-engine.js','season-match-engine-6c-extension.js','season-match-engine-6d-extension.js','season-match-engine-6e-extension.js'];
  let started=false,dataPromise=null,match=null,ui=null,clockTimer=null;
  const css=`#wsm-overlay{position:fixed;inset:0;z-index:99999;background:#101010;color:#eee;overflow:auto;font-family:Arial,sans-serif}#wsm-overlay *{box-sizing:border-box}.wsm-wrap{max-width:1050px;margin:auto;padding:18px}.wsm-box{background:#191919;border:1px solid #333;border-radius:14px;padding:15px;margin:10px 0}.wsm-score{display:grid;grid-template-columns:1fr 150px 1fr;align-items:center;text-align:center}.wsm-team{font-size:21px;font-weight:900}.wsm-team img{width:58px;height:58px;object-fit:contain;display:block;margin:auto}.wsm-scoreline{font-size:40px;font-weight:900}.wsm-minute{font-size:18px;font-weight:800}.wsm-layout{display:grid;grid-template-columns:1fr 300px;gap:10px}.wsm-event{font-size:23px;font-weight:900;line-height:1.35;min-height:72px}.wsm-meta,.wsm-status{color:#aaa;font-size:13px;margin-top:7px}.wsm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.wsm-action{background:#292929;color:#fff;border:1px solid #555;border-radius:9px;padding:12px;text-align:left;cursor:pointer}.wsm-action-name{font-weight:900}.wsm-chance{color:#bbb;margin-top:5px}.wsm-chance b{color:#fff}.wsm-feed{max-height:330px;overflow:auto}.wsm-row{padding:7px 0;border-bottom:1px solid #292929}.wsm-debug{white-space:pre-wrap;font:11px Consolas,monospace;color:#aaa;max-height:220px;overflow:auto};display:none.wsm-player-choice{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.wsm-player-btn{background:#222;color:#fff;border:1px solid #555;border-radius:8px;padding:9px;cursor:pointer;font-weight:800}.wsm-player-btn.selected{border-color:#e30613;background:#341015}.wsm-close{float:right;background:#333;color:#fff;border:0;border-radius:8px;padding:7px 10px;cursor:pointer;font-weight:900}@media(max-width:700px){.wsm-layout{grid-template-columns:1fr}.wsm-score{grid-template-columns:1fr 100px 1fr}.wsm-team{font-size:15px}.wsm-actions{grid-template-columns:1fr}.wsm-event{font-size:20px}.wsm-player-choice{grid-template-columns:1fr}}.wsm-goal-modal{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);pointer-events:none}.wsm-goal-card{min-width:320px;max-width:90vw;padding:28px 38px;text-align:center;background:#b40000;color:#fff;border:3px solid #fff;border-radius:16px;box-shadow:0 12px 45px rgba(0,0,0,.5)}.wsm-goal-title{font-size:42px;font-weight:900;line-height:1.1}.wsm-goal-scorer{margin-top:12px;font-size:25px;font-weight:800}.wsm-goal-resume{display:block;width:100%;margin-top:10px;text-align:center}`;
  function injectStyles(){if(document.getElementById('wsm-styles'))return;const s=document.createElement('style');s.id='wsm-styles';s.textContent=css;document.head.appendChild(s)}
  function loadScript(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[data-wsm-src="${src}"]`)){resolve();return}const s=document.createElement('script');s.src=`./${src}?wsm=${Date.now()}`;s.dataset.wsmSrc=src;s.onload=resolve;s.onerror=()=>reject(new Error('Nie udało się wczytać '+src));document.head.appendChild(s)})}
  async function loadEngine(){if(window.WidzewSeasonMatchEngine)return;for(const src of ENGINE_SCRIPTS)await loadScript(src);if(!window.WidzewSeasonMatchEngine)throw Error('Silnik meczu nie został uruchomiony.')}
  async function loadData(){if(dataPromise)return dataPromise;dataPromise=Promise.all([fetch('./data/akcje.json?match='+Date.now()).then(r=>r.json()),fetch('./data/eventy.json?match='+Date.now()).then(r=>r.json()),fetch('./data/komunikaty.json?match='+Date.now()).then(r=>r.json())]).then(([a,e,c])=>({actions:a,events:e,comms:c}));return dataPromise}
  function waitForSquad(timeout=5000){return new Promise((resolve,reject)=>{const t=Date.now(),tick=()=>{const db=typeof window.getWidzewSeasonPlayerDB==='function'?window.getWidzewSeasonPlayerDB():null;if(db&&Array.isArray(db.players)&&db.players.length>=11)return resolve(db);if(Date.now()-t>timeout)return reject(Error('Nie udało się pobrać składu wybranego przez gracza.'));setTimeout(tick,100)};tick()})}
  function stat(row,key,fallback=50){const map={defensywa:'Defensywa',szybkosc:'Szybkość',podania:'Podania',atak:'Atak',zaangazowanie:'Zaangażowanie',kreatywnosc:'Kreatywność',strzal:'Strzał',ogolna:'Ogólna',graNogami:'Gra nogami',piastkowanie:'Piastkowanie',robinsonada:'Robinsonada',br:'BR'};const n=Number(String(row?.[map[key]]??fallback).replace(',','.'));return Number.isFinite(n)?n:fallback}
  function playerFromDb(p){const r=p.stats||{};return{name:`${p.first} ${p.last}`.trim(),first:p.first,last:p.last,slot:p.slot,position:p.position,isGoalkeeper:String(p.position||'').toUpperCase()==='BR',row:{'Imię':p.first,'Nazwisko':p.last},stats:{defensywa:stat(r,'defensywa'),szybkosc:stat(r,'szybkosc'),podania:stat(r,'podania'),atak:stat(r,'atak'),zaangazowanie:stat(r,'zaangazowanie'),kreatywnosc:stat(r,'kreatywnosc'),strzal:stat(r,'strzal'),ogolna:stat(r,'ogolna'),graNogami:stat(r,'graNogami'),piastkowanie:stat(r,'piastkowanie'),robinsonada:stat(r,'robinsonada'),br:stat(r,'br')}}}
  const TEAMS=['Legia Warszawa','Lech Poznań','Górnik Zabrze','Jagiellonia Białystok','Raków Częstochowa','GKS Katowice','Pogoń Szczecin','Cracovia','Piast Gliwice','Korona Kielce','Motor Lublin','Radomiak Radom','Wieczysta Kraków','Wisła Kraków','Wisła Płock','Śląsk Wrocław','Zagłębie Lubin'];
  function fixtureOpponent(round){const state=window.seasonGameState,fixtures=Array.isArray(state?.widzewFixtures)?state.widzewFixtures:[],f=fixtures.find(x=>Number(x.kolejka)===Number(round));if(!f)return null;const home=seasonTeamNameSafe(f.gospodarz)==='Widzew Łódź',opponent=home?seasonTeamNameSafe(f.gosc):seasonTeamNameSafe(f.gospodarz);if(!opponent)return null;return{name:opponent,home,logo:'./data/logos/'+slug(opponent)+'.png'}}
  function seasonTeamNameSafe(name){let n=String(name||'').trim().replace(/^vo\s+/i,'');return n==='Cracovia Kraków'?'Cracovia':n}
  function readOpponent(round){const direct=fixtureOpponent(round);if(direct)return direct;const el=document.querySelector('.round-match.widzew-match'),text=String(el?.textContent||''),opponent=TEAMS.find(t=>text.includes(t));if(!opponent)throw Error('Nie udało się ustalić przeciwnika z aktualnej kolejki.');const wi=text.indexOf('Widzew Łódź'),oi=text.indexOf(opponent);if(wi<0||oi<0)throw Error('Nie udało się ustalić gospodarza i gościa meczu.');return{name:opponent,home:wi<oi,logo:'./data/logos/'+slug(opponent)+'.png'}}
  function slug(n){const m={'Legia Warszawa':'legia_warszawa','Lech Poznań':'lech_poznan','Górnik Zabrze':'gornik_zabrze','Jagiellonia Białystok':'jagiellonia_bialystok','Raków Częstochowa':'rakow_czestochowa','GKS Katowice':'gks_katowice','Pogoń Szczecin':'pogon_szczecin','Cracovia':'cracovia','Piast Gliwice':'piast_gliwice','Korona Kielce':'korona_kielce','Motor Lublin':'motor_lublin','Radomiak Radom':'radomiak_radom','Wieczysta Kraków':'wieczysta_krakow','Wisła Kraków':'wisla_krakow','Wisła Płock':'wisla_plock','Śląsk Wrocław':'slask_wroclaw','Zagłębie Lubin':'zaglebie_lubin'};return m[n]||n.toLowerCase().replace(/[ąćęłńóśźż]/g,c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/\s+/g,'_')}
  function showGoalPause(goalCode, scorerName, resume){
    stopClock();
    const oldModal=document.getElementById('wsm-goal-modal');
    if(oldModal)oldModal.remove();
    const modal=document.createElement('div');
    modal.id='wsm-goal-modal';
    modal.className='wsm-goal-modal';
    const isWidzew=goalCode==='9.10';
    modal.innerHTML=`<div class="wsm-goal-card"><div class="wsm-goal-title">${isWidzew?'GOOOOL':'Niestety gol przeciwnika'}</div>${isWidzew?`<div class="wsm-goal-scorer">${esc(scorerName||'Zawodnik Widzewa')}</div>`:''}</div>`;
    document.body.appendChild(modal);
    setTimeout(()=>{if(modal.isConnected)modal.remove()},3000);
    const status=document.getElementById('wsm-status');
    const oldButton=status?.querySelector('.wsm-goal-resume');
    if(oldButton)oldButton.remove();
    if(status){
      const b=document.createElement('button');
      b.className='wsm-primary wsm-goal-resume';
      b.textContent='Wznowienie od środka boiska';
      b.onclick=()=>{b.remove();if(modal.isConnected)modal.remove();resume()};
      status.appendChild(b);
    }
  }

  function createUI(opponent){const old=document.getElementById('wsm-overlay');if(old)old.remove();const root=document.createElement('div');root.id='wsm-overlay';const widzewHome=opponent.home,leftTeam=widzewHome?{name:'Widzew Łódź',logo:'./data/logos/widzew_lodz.png'}:opponent,rightTeam=widzewHome?opponent:{name:'Widzew Łódź',logo:'./data/logos/widzew_lodz.png'};root.innerHTML=`<div class="wsm-wrap"><div class="wsm-box"><button class="wsm-close" id="wsm-close" style="display:none">× POWRÓT</button><div class="wsm-score"><div class="wsm-team"><img src="${leftTeam.logo}"><span>${leftTeam.name}</span></div><div><div id="wsm-score" class="wsm-scoreline">0 : 0</div><div id="wsm-minute" class="wsm-minute">—'</div></div><div class="wsm-team"><img src="${rightTeam.logo}"><span>${rightTeam.name}</span></div></div></div><div class="wsm-layout"><section><div class="wsm-box"><h2>Aktualna sytuacja</h2><div id="wsm-event" class="wsm-event">Przygotowanie meczu…</div><div id="wsm-meta" class="wsm-meta"></div><div id="wsm-actions" class="wsm-actions"></div><div id="wsm-player-choice"></div></div><div class="wsm-box"><h3>Przebieg meczu</h3><div id="wsm-feed" class="wsm-feed"></div></div></section><aside><div class="wsm-box"><div class="wsm-status" id="wsm-status">Ładowanie silnika…</div></div><div class="wsm-box"><h3>Strzelcy Widzewa</h3><div id="wsm-scorers">Brak bramek.</div></div><div class="wsm-box" style="display:none"><h3>Debug</h3><div id="wsm-debug" class="wsm-debug">—</div></div></aside></div></div>`;document.body.appendChild(root);ui={root};document.getElementById('wsm-close').onclick=close}
  function stopClock(){if(clockTimer){clearInterval(clockTimer);clockTimer=null}if(match)match.clockRunning=false}
  function runClockTo(target,onReached){if(!match)return;const goal=Math.max(0,Math.min(90,Number(target)||0));stopClock();if(match.clockMinute>=goal){match.minute=goal;renderScore();onReached();return}match.clockRunning=true;setText('wsm-status',`Czas gry: ${match.clockMinute}' — trwa odliczanie do ${goal}'...`);clockTimer=setInterval(()=>{if(!match||match.finished){stopClock();return}match.clockMinute=Math.min(goal,match.clockMinute+1);match.minute=match.clockMinute;renderScore();if(match.clockMinute===1 && match.opponent?.home)crowdIntroAudio.start();if(match.clockMinute>=goal){stopClock();onReached()}},1000)}
  const crowdIntroAudio = {
    audio: null,
    played: false,
    start(){
      if(this.played) return;
      this.played = true;
      const settings = window.__widzewAudioSettings || {};
      const audio = new Audio('./data/sound/crowd/1.mp3');
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
      this.audio = audio;
      audio.play().catch(error => console.warn('Nie udało się uruchomić crowd/1.mp3:', error));
      audio.addEventListener('ended', () => { this.audio = null; }, {once:true});
    },
    applyVolume(){
      if(!this.audio) return;
      const settings = window.__widzewAudioSettings || {};
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      this.audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
    },
    stop(){
      if(this.audio){ this.audio.pause(); this.audio.currentTime=0; this.audio=null; }
      this.played = false;
    }
  };
  window.__widzewCrowdIntroAudio = crowdIntroAudio;

  const crowdAudio = {
    audio: null,
    track: null,
    ducked: false,
    duckMultiplier: 1,
    setDucked(value){
      this.ducked = Boolean(value);
      this.duckMultiplier = this.ducked ? 0.08 : 1;
      this.applyVolume();
    },
    baseVolume(){
      const settings = window.__widzewAudioSettings || {};
      const effectsVolume = Number(settings.effectsVolume);
      return Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30 * this.duckMultiplier));
    },
    applyVolume(){
      if(!this.audio) return;
      const settings = window.__widzewAudioSettings || {};
      this.audio.volume = settings.effectsEnabled === false ? 0 : this.baseVolume();
    },
    start(){
      this.setTrack('7');
    },
    setTrack(file){
      const nextTrack = String(file);
      if(this.audio && this.track === nextTrack){
        this.applyVolume();
        return;
      }
      this.stop();
      const settings = window.__widzewAudioSettings || {};
      const audio = new Audio('./data/sound/crowd/'+nextTrack+'.mp3');
      audio.loop = true;
      this.audio = audio;
      this.track = nextTrack;
      this.applyVolume();
      audio.play().catch(error => console.warn('Nie udało się uruchomić crowd/'+nextTrack+'.mp3:', error));
    },
    updateForScore(){
      if(!match) return;
      const widzewGoals = Number(match.score?.widzew || 0);
      const opponentGoals = Number(match.score?.opponent || 0);
      this.setTrack(widzewGoals - opponentGoals >= 2 ? '3' : '7');
    },
    setEnabled(){
      this.applyVolume();
    },
    setVolume(){
      this.applyVolume();
    },
    stop(){
      if(this.audio){
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio = null;
      }
      this.track = null;
    }
  };
  window.__widzewCrowdAudio = crowdAudio;

  function close(){if(!match?.finished)return;stopClock();crowdAudio.stop();crowdIntroAudio.stop();crowdActionAudio.stop();crowdGoalAudio.stop();crowdGoalFollowAudio.stop();crowdFinalAudio.stop();document.getElementById('wsm-overlay')?.remove();started=false;match=null;ui=null;if(window.setGameMusicExcluded)window.setGameMusicExcluded(false)}
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const setText=(id,text)=>{const e=document.getElementById(id);if(e)e.textContent=text};
  function feed(text,minute){const e=document.getElementById('wsm-feed');if(e)e.insertAdjacentHTML('afterbegin',`<div class="wsm-row"><b>${minute!=null?esc(minute)+"' ":''}</b>${esc(text)}</div>`)}
  function renderScore(){const a=match.opponent.home?match.score.widzew:match.score.opponent,b=match.opponent.home?match.score.opponent:match.score.widzew;setText('wsm-score',`${a} : ${b}`);setText('wsm-minute',match.minute!=null?`${match.minute}'`:'—')}
  function renderScorers(){const e=document.getElementById('wsm-scorers');if(e)e.innerHTML=match.scorers.length?match.scorers.map(s=>`<div>${esc(s.player)} — ${s.minute}'</div>`).join(''):'Brak bramek.'}
  function eventData(id){const n=Number(id);return n===10||n===110?ui.data.events.special?.[String(id)]:ui.data.events[Number(id)>=100?'DEF':'OF']?.[String(id)]}
  function actionData(id){return ui.data.actions[String(id)]||{}}
  function commName(id,player){const k=String(id),g=k.startsWith('99.')?'DEF':k.startsWith('9.')?'OF':null;let s=g&&ui.data.comms[g]?.[k]?.name||k;if(player)s=s.replace(/Zawodnik XY/g,player.name);return s}
  function randomOutfieldPlayer(exclude){const pool=match.xi.filter(p=>!p.isGoalkeeper&&p!==exclude);if(pool.length)return pool[Math.floor(Math.random()*pool.length)];return match.xi.find(p=>!p.isGoalkeeper)||null}
  function eventText(ev){const d=eventData(ev.eventId);if(!d)return`Event ${ev.eventId}`;let s=d.name;const actor=(Number(ev.eventId)===8?match.receiver:null)||match.player||match.lastActionPlayer||randomOutfieldPlayer();if(Number(ev.eventId)===7)s=s.replace(/wykonuje rzut wolny/,'wykonuje rzut karny');if(actor)s=s.replace(/Zawodnika? XY/g,Number(ev.eventId)===8?`Zawodnika ${actor.name}`:actor.name);if(ev.z!=null)s=s.replace(/Z m/g,`${ev.z} m`);else s=s.replace(/ Z m/g,'');return s}
  function regularMinute(){const b=[{a:1,b:15,w:12.70},{a:16,b:30,w:13.90},{a:31,b:45,w:15.89},{a:46,b:60,w:16.20},{a:61,b:75,w:15.13},{a:76,b:90,w:15.89}];let t=b.reduce((s,x)=>s+x.w,0),r=Math.random()*t;for(const x of b){r-=x.w;if(r<0)return x.a+Math.floor(Math.random()*(x.b-x.a+1))}return 90}
  function eventZ(id){const n=Number(id);if([3,7,103,107,10,110].includes(n))return null;const first={1:'1.1',2:'2.1',4:'4.1',5:'5.1',6:'6.1',8:'8.1',101:'101.1',102:'102.1',104:'104.1',105:'105.1',106:'106.1',108:'108.1'}[n];return first?window.WidzewSeasonMatchEngine.chooseZ(n,first,Math.random):null}
  function pickEvent(side){const w=window.WidzewSeasonMatchEngine.constants.EVENT_WEIGHTS[side],items=Object.entries(w).map(([value,weight])=>({value:Number(value),weight}));return window.WidzewSeasonMatchEngine.weightedPick(items,Math.random).value}
  function buildPlan(input){
    const probe=window.WidzewSeasonMatchEngine.generateMatch(input);
    const sides=window.WidzewSeasonMatchEngine.generateEventSides
      ? window.WidzewSeasonMatchEngine.generateEventSides(probe.totalEvents,probe.ofShare,Math.random)
      : (()=>{const ofCount=Math.round(probe.totalEvents*probe.ofShare);const a=[];for(let i=0;i<probe.totalEvents;i++)a.push(i<ofCount?'OF':'DEF');for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a})();
    return sides.map((s,i)=>{
      const id=pickEvent(s);
      return{minute:regularMinute(),eventId:id,z:eventZ(id),side:s,index:i};
    }).sort((a,b)=>a.minute-b.minute);
  }
  function selectActor(){return randomOutfieldPlayer()}
  function selectReceiver(actor){const p=match.xi.filter(x=>!x.isGoalkeeper&&x!==actor);return p.length?p[Math.floor(Math.random()*p.length)]:actor}
  function chooseActorForAction(id){const type=actionData(id).type;const eventId=Number(match.current.eventId);if([3,4,7].includes(eventId)){const selected=match[`selectedEvent${eventId}Player`];if(selected)return selected;}if(type==='pass'||type==='cross')return match.player||selectActor();return match.player||selectActor()}
  function showEventPlayerChoice(eventId){const box=document.getElementById('wsm-player-choice');if(!box)return;const key=`selectedEvent${eventId}Player`;const selected=match[key];box.innerHTML='<div class="wsm-meta">Wybierz zawodnika wykonującego akcję:</div><div class="wsm-player-choice">'+match.xi.filter(p=>!p.isGoalkeeper).map((p,i)=>`<button class="wsm-player-btn ${selected===p?'selected':''}" data-i="${i}">${esc(p.name)}</button>`).join('')+'</div>';box.querySelectorAll('button').forEach(b=>b.onclick=()=>{match[key]=match.xi.filter(p=>!p.isGoalkeeper)[Number(b.dataset.i)];match.player=match[key];renderActions()})}
  function renderActions(){const ev=match.current;if(!ev)return;setText('wsm-event',eventText(ev));setText('wsm-meta',`Event ${ev.eventId} · ${ev.side} · Z = ${ev.z==null?'—':ev.z} · ${ev.minute}'`);const box=document.getElementById('wsm-actions');box.innerHTML='';let ids=window.WidzewSeasonMatchEngine.availableActions(ev.eventId,ev.z)||[];if(!ids.length&&Number(ev.eventId)===108){const all=window.WidzewSeasonMatchEngine.constants?.ACTION_SPECS||{};ids=Object.keys(all).filter(id=>id.startsWith('108.'));}if(!ids.length&&[101,102].includes(Number(ev.eventId))&&Number(ev.z)<5){match.current={...ev,eventId:108};renderActions();return}if(Number(ev.eventId)===104&&!ids.length)ids=['104.1','104.2'];if(!match.player)match.player=selectActor();const actor=match.player;ids.forEach(id=>{const p=window.WidzewSeasonMatchEngine.calculateActionProbability(id,{z:ev.z,performerStats:actor.stats,opponentStats:match.opponentStats,k:match.k.k}),b=document.createElement('button');b.className='wsm-action';b.innerHTML=`<div class="wsm-action-name">${esc(actionData(id).name||id)}</div><div class="wsm-chance">Szansa powodzenia: <b>${p.probability.toFixed(1)}%</b></div>`;b.onclick=()=>playAction(id);box.appendChild(b)});if([3,4,7].includes(Number(ev.eventId)))showEventPlayerChoice(Number(ev.eventId));else document.getElementById('wsm-player-choice').innerHTML=''}
  function nextEventFrom(t){if(!t)return null;let id=t.nextEvent;if(id==null&&t.nextAction!=null)id=Number(t.nextAction);if(id==null)return null;const rawZ=t.newZ!==undefined?t.newZ:eventZ(id);const z=rawZ==null?null:(Number(id)===108?Math.max(1,Number(rawZ)):Number(rawZ));return{eventId:Number(id),side:Number(id)>=100?'DEF':'OF',z:z,minute:match.plan[match.planIndex]?.minute??match.minute}}
  function addGoal(msg){if(msg==='9.10'){ crowdIntroAudio.stop(); crowdGoalAudio.play();const scorer=match.shotPlayer||match.player;const cleanName=String(scorer?.name||'Zawodnik Widzewa').replace(/^(?:Zawodnik|Zawodnika)\s+/i,'').trim();match.score.widzew++;match.scorers.push({name:cleanName,player:cleanName,minute:match.minute,type:'widzew',playerRef:scorer||null})}if(msg==='99.10')match.score.opponent++;renderScore();renderScorers();crowdAudio.updateForScore()}
  function showHalftime(){stopClock();setText('wsm-event','KONIEC I POŁOWY');setText('wsm-meta','');document.getElementById('wsm-actions').innerHTML='';document.getElementById('wsm-player-choice').innerHTML='';setText('wsm-status','Przerwa. Kliknij, aby rozpocząć drugą połowę.');const box=document.getElementById('wsm-status');const b=document.createElement('button');b.className='wsm-primary';b.textContent='▶ DRUGA POŁOWA';b.onclick=()=>{b.remove();finishHalf()};box.appendChild(b);const wrap=document.querySelector('#wsm-overlay .wsm-wrap');const layout=wrap?.querySelector('.wsm-layout');if(window.matchMedia('(max-width:700px)').matches&&wrap&&layout){b.classList.add('wsm-halftime-mobile');wrap.insertBefore(b,layout);b.style.display='block';b.style.width='100%';b.style.margin='0 0 10px 0';b.style.textAlign='center';b.style.position='sticky';b.style.top='0';b.style.zIndex='100000'}}
  function endSequence(){match.current=null;match.player=null;match.shotPlayer=null;match.lastActionPlayer=null;match.k={eventGroup:null,repeatCount:0,k:0};const next=match.plan[match.planIndex+1];if(match.half===1&&(!next||next.minute>45)){runClockTo(match.firstHalfEnd||45,showHalftime);return}if(match.half===2&&!next){runClockTo(match.secondHalfEnd||90,finishMatch);return}advance()}
  function finishHalf(){stopClock();match.half=2;match.clockMinute=45;match.minute=45;match.planIndex=match.plan.findIndex(x=>x.minute>45);renderScore();if(match.planIndex<0)runClockTo(match.secondHalfEnd||90,finishMatch);else startCurrentEvent()}
  const crowdGoalAudio = {
    audio: null,
    play(){
      this.stop();
      const settings = window.__widzewAudioSettings || {};
      const audio = new Audio('./data/sound/crowd/5.mp3');
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
      this.audio = audio;
      crowdAudio.setDucked(true);
      audio.addEventListener('ended', () => {
        this.audio = null;
        const minute = Number(match?.minute || 0);
        if(minute >= 1 && minute <= 69) crowdGoalFollowAudio.play(6);
        else if(minute >= 70) crowdGoalFollowAudio.play(2);
        else crowdAudio.setDucked(false);
      }, {once:true});
      audio.play().catch(error => console.warn('Nie udało się uruchomić crowd/5.mp3:', error));
    },
    applyVolume(){
      if(!this.audio) return;
      const settings = window.__widzewAudioSettings || {};
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      this.audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
    },
    stop(){
      if(this.audio){ this.audio.pause(); this.audio.currentTime=0; this.audio=null; }
    }
  };
  window.__widzewCrowdGoalAudio = crowdGoalAudio;

  const crowdGoalFollowAudio = {
    audio: null,
    play(file){
      this.stop();
      const settings = window.__widzewAudioSettings || {};
      const audio = new Audio(`./data/sound/crowd/${file}.mp3`);
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
      this.audio = audio;
      audio.play().catch(error => console.warn(`Nie udało się uruchomić crowd/${file}.mp3:`, error));
      audio.addEventListener('ended', () => { this.audio = null; crowdAudio.setDucked(false); }, {once:true});
    },
    applyVolume(){
      if(!this.audio) return;
      const settings = window.__widzewAudioSettings || {};
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      this.audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
    },
    stop(){
      if(this.audio){ this.audio.pause(); this.audio.currentTime=0; this.audio=null; }
    }
  };
  window.__widzewCrowdGoalFollowAudio = crowdGoalFollowAudio;

  const crowdActionAudio = {
    audio: null,
    play(){
      this.stop();
      const settings = window.__widzewAudioSettings || {};
      const audio = new Audio('./data/sound/crowd/4.mp3');
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
      this.audio = audio;
      audio.play().catch(error => console.warn('Nie udało się uruchomić crowd/4.mp3:', error));
      audio.addEventListener('ended', () => { this.audio = null; }, {once:true});
    },
    applyVolume(){
      if(!this.audio) return;
      const settings = window.__widzewAudioSettings || {};
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      this.audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
    },
    stop(){
      if(this.audio){ this.audio.pause(); this.audio.currentTime=0; this.audio=null; }
    }
  };
  window.__widzewCrowdActionAudio = crowdActionAudio;

  const crowdFinalAudio = {
    audio: null,
    play(){
      this.stop();
      const settings = window.__widzewAudioSettings || {};
      const audio = new Audio('./data/sound/crowd/9.mp3');
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
      this.audio = audio;
      audio.play().catch(error => console.warn('Nie udało się uruchomić crowd/9.mp3:', error));
      audio.addEventListener('ended', () => { this.audio = null; }, {once:true});
    },
    applyVolume(){
      if(!this.audio) return;
      const settings = window.__widzewAudioSettings || {};
      const effectsVolume = Number(settings.effectsVolume);
      const baseVolume = Math.min(1, Math.max(0, (Number.isFinite(effectsVolume) ? effectsVolume : 0.7) * 0.30));
      this.audio.volume = settings.effectsEnabled === false ? 0 : baseVolume;
    },
    stop(){
      if(this.audio){ this.audio.pause(); this.audio.currentTime=0; this.audio=null; }
    }
  };
  window.__widzewCrowdFinalAudio = crowdFinalAudio;

  function finishMatch(){stopClock();crowdAudio.stop();crowdIntroAudio.stop();crowdActionAudio.stop();crowdGoalAudio.stop();crowdFinalAudio.play();match.current=null;match.finished=true;setText('wsm-event','KONIEC CZASU GRY');setText('wsm-meta','');setText('wsm-status','Mecz zakończony.');feed('KONIEC CZASU GRY',90);renderScore();renderScorers();const back=document.getElementById('wsm-close');if(back){back.style.display='block';back.textContent='← WRÓĆ DO SEZONU'}if(window.seasonGameState){const round=Number(window.seasonGameState.currentRound),result={round,opponent:match.opponent.name,home:match.opponent.home,gf:match.score.widzew,ga:match.score.opponent,scorers:match.scorers.map(s=>({minute:s.minute,type:s.type||'widzew',name:s.player,player:s.playerRef||null}))};window.seasonGameState.widzewResults=Array.isArray(window.seasonGameState.widzewResults)?window.seasonGameState.widzewResults.filter(x=>Number(x.round)!==round):[];window.seasonGameState.widzewResults.push(result);
        window.seasonGameState.playedMatchCount = Number(window.seasonGameState.playedMatchCount || 0) + 1;
        // Zapisz rozegrany mecz do stabilnej bazy natychmiast, zanim użytkownik przejdzie dalej.
        // Dzięki temu wynik/strzelcy z trybu „Zagraj mecz” nie mogą zostać zastąpieni symulacją.
        if(typeof window.storePlayedMatch==="function") window.storePlayedMatch(result);if(typeof window.recordSeasonMatchScorers==="function") window.recordSeasonMatchScorers(result);
        try{if(typeof window.renderPlayableSeason==='function')window.renderPlayableSeason()}catch(e){console.warn('Nie udało się odświeżyć wyników/tabeli:',e)}try{if(typeof window.renderLeagueTable==='function')window.renderLeagueTable(round,false)}catch(e){console.warn('Nie udało się odświeżyć tabeli:',e)}try{if(typeof window.renderTopScorers==='function')window.renderTopScorers()}catch(e){console.warn('Nie udało się odświeżyć klasyfikacji strzelców:',e)}}}
  function startCurrentEvent(){if(match.planIndex>=match.plan.length){if(match.half===1){runClockTo(match.firstHalfEnd||45,showHalftime)}else if(match.clockMinute<(match.secondHalfEnd||90)){runClockTo(match.secondHalfEnd||90,finishMatch)}else finishMatch();return}const planned=match.plan[match.planIndex];if(match.half===1&&planned.minute>45){runClockTo(match.firstHalfEnd||45,showHalftime);return}if(match.clockMinute<planned.minute){setText('wsm-event','');setText('wsm-meta','');document.getElementById('wsm-actions').innerHTML='';document.getElementById('wsm-player-choice').innerHTML='';runClockTo(planned.minute,()=>startCurrentEvent());return}match.current={...planned};match.minute=planned.minute;match.player=selectActor();match.receiver=null;match.lastActionPlayer=null;match.shotPlayer=null;match.k={eventGroup:null,repeatCount:0,k:0};match.selectedEvent3Player=null;match.selectedEvent4Player=null;match.selectedEvent7Player=null;renderScore();renderActions();feed('Początek sekwencji: '+eventText(match.current),match.minute);setText('wsm-status','Wybierz akcję.')}
  function advance(){match.planIndex++;startCurrentEvent()}
  function playAction(id){if(!match.current||match.resolving||match.finished)return;match.resolving=true;try{const actor=chooseActorForAction(id);match.player=actor;match.lastActionPlayer=actor;const type=actionData(id).type;const receiver=(type==='pass'||type==='cross')?selectReceiver(actor):null;match.receiver=receiver||null;if(type==='shot')match.shotPlayer=actor;const p=window.WidzewSeasonMatchEngine.resolveAction(id,{z:match.current.z,performerStats:actor.stats,opponentStats:match.opponentStats,k:match.k.k,randomFn:Math.random});match.k=window.WidzewSeasonMatchEngine.updateKState(match.k,match.current.eventId);let t=window.WidzewSeasonMatchEngine.transitionForAction(id,p.success,match.current.z,Math.random);

// Twarda reguła 16 m dla faulu ofensywnego.
// 9.11 przy Z <= 16 m zawsze prowadzi do rzutu karnego (Event 7),
// a przy Z > 16 m do rzutu wolnego (Event 4).
if(t?.message==='9.11' && [1,2,3,4,5,6,7,8].includes(Number(match.current.eventId))){
  t={...t,nextEvent:Number(match.current.z)<=16?7:4,newZ:Number(match.current.z)};
}

const msg=t?.message?commName(t.message,match.lastActionPlayer):'';if(msg){feed(msg,match.minute);if(['9.7','9.8','9.9','99.8','99.9'].includes(String(t.message)))crowdActionAudio.play();addGoal(String(t.message))}document.getElementById('wsm-debug').textContent=JSON.stringify({action:id,name:actionData(id).name,type,performer:actor.name,receiver:receiver?.name||null,shotPlayer:match.shotPlayer?.name||null,probability:p.probability,roll:p.roll,success:p.success,transition:t},null,2);const goalCode=t?.goal?(t.goal==='WIDZEW'?'9.10':'99.10'):(String(t?.message)==='9.10'||String(t?.message)==='99.10'?String(t.message):null);
      if(goalCode){
        if(!t?.message)addGoal(goalCode);
        const scorerName=goalCode==='9.10'?String((match.shotPlayer||match.player)?.name||'Zawodnik Widzewa').replace(/^(?:Zawodnik|Zawodnika)\s+/i,'').trim():'';
        showGoalPause(goalCode,scorerName,()=>{
          if(t?.end){endSequence();return}
          const nxAfterGoal=nextEventFrom(t);
          if(!nxAfterGoal){endSequence();return}
          match.current=nxAfterGoal;
          match.player=(type==='pass'||type==='cross')?(p.success?(receiver||selectActor()):actor):actor;
          if(t.keepPlayer)match.player=actor;
          feed('Event '+nxAfterGoal.eventId+': '+eventText(nxAfterGoal),match.minute);
          renderActions();
        });
        return;
      }
      if(t?.end){endSequence();return}const nx=nextEventFrom(t);if(!nx){endSequence();return}if(nx.eventId===10||nx.eventId===110){match.current=nx;match.player=actor;if(nx.eventId===10)match.shotPlayer=actor;feed('Event '+nx.eventId+': '+eventText(nx),match.minute);renderActions();playSpecial(nx);return}match.current=nx;match.player=(type==='pass'||type==='cross')?(p.success?(receiver||selectActor()):actor):actor;if(t.keepPlayer)match.player=actor;feed('Event '+nx.eventId+': '+eventText(nx),match.minute);renderActions()}catch(err){console.error('Błąd rozstrzygania akcji:',err);setText('wsm-status',`Błąd akcji: ${err.message||err}`)}finally{match.resolving=false}}
  function playSpecial(ev){if(match.finished)return;const actor=(Number(ev.eventId)===10?match.shotPlayer:null)||match.player||selectActor();if(Number(ev.eventId)===10)match.shotPlayer=actor;match.player=actor;match.lastActionPlayer=actor;const id=String(ev.eventId);const p=window.WidzewSeasonMatchEngine.resolveAction(id,{z:ev.z,performerStats:actor.stats,opponentStats:match.opponentStats,k:match.k.k,randomFn:Math.random}),t=window.WidzewSeasonMatchEngine.transitionForAction(id,p.success,ev.z,Math.random),msg=t?.message?commName(t.message,match.lastActionPlayer):'';if(msg){feed(msg,match.minute);if(['9.7','9.8','9.9','99.8','99.9'].includes(String(t.message)))crowdActionAudio.play();addGoal(String(t.message))}document.getElementById('wsm-debug').textContent=JSON.stringify({action:id,name:actionData(id).name,performer:actor.name,shotPlayer:match.shotPlayer?.name||null,probability:p.probability,roll:p.roll,success:p.success,transition:t},null,2);const goalCode=t?.goal?(t.goal==='WIDZEW'?'9.10':'99.10'):(String(t?.message)==='9.10'||String(t?.message)==='99.10'?String(t.message):null);
      if(goalCode){
        if(!t?.message)addGoal(goalCode);
        const scorerName=goalCode==='9.10'?String((match.shotPlayer||match.player)?.name||'Zawodnik Widzewa').replace(/^(?:Zawodnik|Zawodnika)\s+/i,'').trim():'';
        showGoalPause(goalCode,scorerName,()=>{
          if(t?.end){endSequence();return}
          const nxAfterGoal=nextEventFrom(t);
          if(nxAfterGoal){match.current=nxAfterGoal;match.player=selectActor();feed('Event '+nxAfterGoal.eventId+': '+eventText(nxAfterGoal),match.minute);renderActions()}
          else endSequence();
        });
        return;
      }
      if(t?.end){endSequence();return}const nx=nextEventFrom(t);if(nx){match.current=nx;match.player=selectActor();feed('Event '+nx.eventId+': '+eventText(nx),match.minute);renderActions()}else endSequence()}
  async function start(){if(started)return;started=true;if(window.setGameMusicExcluded)window.setGameMusicExcluded(true);crowdAudio.start();injectStyles();try{createUI({name:'Ładowanie…',logo:'./data/logos/widzew_lodz.png',home:true});setText('wsm-status','Ładowanie silnika i danych…');await loadEngine();ui.data=await loadData();const db=await waitForSquad(),xi=db.players.filter(p=>p.slot==='starter').map(playerFromDb);if(xi.length<11)throw Error(`Nieprawidłowy skład: znaleziono ${xi.length} zawodników podstawowych.`);const round=Number(window.seasonGameState?.currentRound);if(!Number.isFinite(round))throw Error('Nie udało się odczytać aktualnej kolejki.');const opponent=readOpponent(round);createUI(opponent);ui.data=await loadData();const avg=xi.reduce((s,p)=>s+p.stats.ogolna,0)/xi.length;
      const opponentRow = (window.seasonGameState?.teams||[]).find(t => seasonTeamNameSafe(t["drużyna"] || t["druzyna"] || t["Drużyna"]) === opponent.name);
      if(!opponentRow) throw Error("Nie znaleziono danych przeciwnika "+opponent.name+" dla wybranego sezonu.");
      const opponentOverall = Number(String(opponentRow["Ogólna"] ?? "50").replace(",", "."));
      const opponentCharacter = Number(String(opponentRow["Charakter"] ?? "5").replace(",", "."));
      if(!Number.isFinite(opponentOverall) || !Number.isFinite(opponentCharacter)) throw Error("Nieprawidłowe dane przeciwnika "+opponent.name+" w bazie sezonu.");
      const coachStrength = window.__widzewGameMode === "player"
        ? 0
        : (Number.isFinite(Number(window.__widzewCoachStrength)) ? Number(window.__widzewCoachStrength) : 0);
      const input={home:opponent.home,widzew:{overall:avg,players:xi},opponent:{overall:opponentOverall,charakter:opponentCharacter},coachStrength};match={opponent,xi,opponentStats:{defensywa:50,szybkosc:50,podania:50,atak:50,zaangazowanie:50,kreatywnosc:50,strzal:50,ogolna:opponentOverall,graNogami:50,piastkowanie:50,robinsonada:50,br:50},score:{widzew:0,opponent:0},scorers:[],minute:0,clockMinute:0,clockRunning:false,half:1,plan:buildPlan(input),planIndex:0,current:null,player:null,receiver:null,lastActionPlayer:null,shotPlayer:null,resolving:false,finished:false,firstHalfEnd:45+Math.floor(Math.random()*5)+1,secondHalfEnd:90+Math.floor(Math.random()*8)+1,k:{eventGroup:null,repeatCount:0,k:0}};setText('wsm-status',`Gotowy do rozpoczęcia · ${db.season||''} · skład: ${xi.length} zawodników`);feed(`Mecz: ${opponent.home?'Widzew Łódź – '+opponent.name:opponent.name+' – Widzew Łódź'}`);
      setText('wsm-event','GOTOWI? ROZPOCZYNAMY MECZ!');
      setText('wsm-meta','Kliknij przycisk poniżej, aby rozpocząć spotkanie.');
      const actionsBox=document.getElementById('wsm-actions');
      actionsBox.innerHTML='';
      const startButton=document.createElement('button');
      startButton.className='wsm-action';
      startButton.style.gridColumn='1 / -1';
      startButton.style.textAlign='center';
      startButton.style.fontWeight='900';
      startButton.style.fontSize='18px';
      startButton.textContent='▶ ROZPOCZNIJ MECZ';
      startButton.onclick=()=>{startButton.remove();setText('wsm-event','');setText('wsm-meta','');setText('wsm-status','Mecz rozpoczęty.');startCurrentEvent();};
      actionsBox.appendChild(startButton)}catch(err){setText('wsm-event','Nie udało się uruchomić meczu.');setText('wsm-status',err.message);document.getElementById('wsm-status').classList.add('wsm-error');console.error(err)}}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('#playMatchButton');if(!b)return;e.preventDefault();e.stopImmediatePropagation();start()},true)
})();