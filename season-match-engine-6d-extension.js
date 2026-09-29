/* ETAP 6D — DEF transitions + Z changes
 * Layers on top of season-match-engine.js and season-match-engine-6c-extension.js.
 * Does not modify the stable tester or the 6A-6B base engine.
 */
(function(){
    'use strict';
    const E=window.WidzewSeasonMatchEngine;
    if(!E) throw Error('season-match-engine.js musi być załadowany przed 6D');

    const BASE_TRANSITION=E.transitionForAction;
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const rand=(r)=>clamp(Number(r()),0,0.999999999);
    const int=(a,b,r)=>a+Math.floor(rand(r)*(b-a+1));

    // Szansa na oddanie strzału zależna od odległości Z.
    // Wartości z tabeli są punktami krzywej; pomiędzy nimi stosujemy interpolację liniową.
    const SHOT_CHANCE_BY_Z_POINTS=[
        [70,1],[60,5],[50,10],[40,15],[35,20],[30,25],[25,30],
        [20,50],[16,60],[12,70],[10,75],[5,85],[1,100]
    ];

    function shotChanceByZ(z){
        const x=clamp(Number(z),1,70);
        const points=SHOT_CHANCE_BY_Z_POINTS.slice().sort((a,b)=>a[0]-b[0]);
        if(x<=points[0][0]) return points[0][1];
        if(x>=points[points.length-1][0]) return points[points.length-1][1];
        for(let i=0;i<points.length-1;i++){
            const [x1,y1]=points[i];
            const [x2,y2]=points[i+1];
            if(x>=x1 && x<=x2){
                const t=(x-x1)/(x2-x1);
                return y1+(y2-y1)*t;
            }
        }
        return points[points.length-1][1];
    }

    // Łączna waga pozostałych komunikatów dla danego typu akcji.
    // Strzał jest dodawany jako kolejna możliwość i dopiero cały zestaw
    // jest normalizowany. Dzięki temu np. 50% z tabeli nie oznacza
    // automatycznie 50% wszystkich możliwych wyników akcji.
    // Wagi odpowiadają istniejącym częstotliwościom z transitionDefense:
    // najrzadziej=5, rzadko=30, normalnie=50, często=60.
    const OTHER_FAILURE_WEIGHT={
        '101.1':110, '101.2':90, '101.3':120, '101.4':120, '101.5':60,
        '102.1':110, '102.2':90, '102.3':120, '102.4':120, '102.5':60,
        '104.1':50, '104.2':50
    };

    function rollDefensiveShot(z,r){
        if(!Number.isFinite(Number(z))) return null;
        const id=String(arguments.length>3 ? arguments[3] : '');
        const p=shotChanceByZ(z);
        const otherWeight=OTHER_FAILURE_WEIGHT[id];
        if(!otherWeight) return null;
        const shotProbability=p/(p+otherWeight);
        if(rand(r)>=shotProbability) return null;
        // Dopiero po wylosowaniu samego strzału rozstrzygamy 45:55.
        return rand(r)<0.45?'99.1':'99.2';
    }

    // Zmiany Z z arkusza „Zmiany Z”.
    const DELTA={
        '1.1':[1,5], '1.2':[5,11], '1.4':[3,8], '1.5':[5,12], '1.8':[-3,3],
        '2.1':[1,2], '2.2':[3,6], '2.4':[2,4], '2.5':[3,5],
        '4.1':[1,5], '4.2':[10,20], '5.1':[1,5], '5.2':[10,20],
        '6.1':[1,5],
        '101.1':[1,5], '101.2':[5,12], '101.3':[7,15], '101.4':[3,8], '101.5':[7,15],
        '102.1':[1,5], '102.2':[5,12], '102.3':[7,15], '102.4':[3,8], '102.5':[7,15],
        '104.1':[1,5], '105.1':[5,12], '105.2':[8,15], '106.1':[2,6]
    };

    function event8Z(r){ return E.chooseZ(8,'8.1',r); }

    function changedZ(actionId,z,r){
        const id=String(actionId);
        if(!Number.isFinite(Number(z))) return null;
        if(['1.6','1.7','2.6','2.7','3.5','4.3','4.4','8.1','8.2','8.3','8.4'].includes(id)) return Number(z);
        if(id==='1.3') return Number(z)-int(15,30,r);
        if(id==='2.3') return event8Z(r);
        if(id==='3.1') return int(5,10,r);
        if(id==='3.2'||id==='3.3') return event8Z(r);
        if(id==='3.4') return int(17,25,r);
        if(id==='3.6') return int(5,6,r);
        if(id==='6.2') return event8Z(r);
        if(id==='7.1'||id==='7.2'||id==='7.3') return 11;
        if(id==='103.2'||id==='103.3') return event8Z(r);
        if(id==='104.2') return event8Z(r);
        if(id==='106.2') return event8Z(r);
        if(id==='107.1'||id==='107.2'||id==='107.3') return 11;
        if(id==='108.1'||id==='108.2'||id==='108.3') return Number(z);
        const d=DELTA[id];
        if(d) return Number(z)+(d[0]===-3?int(-3,3,r):-int(d[0],d[1],r));
        return Number(z);
    }

    function targetZForTransition(id,t,z,r){
        const next=t.nextEvent;
        // Strzał celny/niecelny oraz dalszy event 110 korzystają z Z poprzedniej akcji.
        if(t.message==='99.1' && next===110) return Number(z);
        if(next===110) return Number(z);

        // Strzały Widzewa: Z zostaje w event 10.
        if(t.nextAction==='10') return Number(z);

        if(id==='1.3') return next===8?event8Z(r):changedZ(id,z,r);
        if(id==='2.3'||id==='3.2'||id==='3.3'||id==='6.2') return next===8?event8Z(r):undefined;
        if(id==='4.2') return next===8?event8Z(r):changedZ(id,z,r);
        if(id==='103.1') return next===102?int(5,10,r):next===104?int(17,21,r):undefined;
        if(id==='104.1') return next===108?event8Z(r):next===101?changedZ(id,z,r):undefined;
        if(id==='104.2') return next===108?event8Z(r):undefined;
        if(id==='106.2') return next===108?event8Z(r):undefined;
        if(id==='101.4'||id==='102.4'){
            if(t.message==='99.12'){
                const d=int(3,8,r)+int(-5,5,r);
                return Number(z)-d;
            }
            return changedZ(id,z,r);
        }
        if(id==='101.1'||id==='101.2'||id==='101.3'||id==='101.5'||id==='102.1'||id==='102.2'||id==='102.3'||id==='102.5'){
            return (next===101||next===102||next===108)?changedZ(id,z,r):Number(z);
        }
        if(id==='105.1'||id==='105.2'||id==='106.1') return changedZ(id,z,r);
        if(id==='108.1'||id==='108.2'||id==='108.3') return Number(z);
        return t.newZ;
    }

    function applyTransitionZ(id,t,z,r){
        if(!t || !Number.isFinite(Number(z))) return t;
        const nz=targetZForTransition(id,t,z,r);
        if(nz!==undefined && nz!==null) t.newZ=nz;
        return t;
    }

    function transitionForAction6D(actionId,success,z,rng){
        const id=String(actionId);
        const r=rng||Math.random;
        const isDef=/^(10[1-9]|110)\./.test(id) || /^(101|102|103|104|105|106|107|108)\./.test(id) || id==='110';
        const t=BASE_TRANSITION(actionId,success,z,r);
        if(!isDef || success || id==='110' || !Number.isFinite(Number(z))) return applyTransitionZ(id,t,z,r);

        // Automatyczny test strzału jest dozwolony tylko dla eventów 101, 102 i 104.
        // Najpierw losujemy „strzał vs wszystkie pozostałe komunikaty” z normalizacją,
        // a dopiero po wylosowaniu strzału 45:55 dla 99.1/99.2.
        const eventId=Number(id.split('.')[0]);
        const canGenerateShot=[101,102,104].includes(eventId);
        if(!canGenerateShot) return applyTransitionZ(id,t,z,r);

        const shot=rollDefensiveShot(z,r,id);
        if(shot==='99.1') return {message:'99.1',nextAction:'110',newZ:Number(z),shotChance:shotChanceByZ(z),shot:true};
        if(shot==='99.2') return {message:'99.2',end:true,newZ:Number(z),shotChance:shotChanceByZ(z),shot:true};

        return applyTransitionZ(id,t,z,r);
    }

    E.constants.DEF_SHOT={
        minZ:1,maxZ:70,
        chanceTable:SHOT_CHANCE_BY_Z_POINTS,
        onTargetShare:0.45,offTargetShare:0.55,
        normalized:true
    };
    E.defensiveShotChance=shotChanceByZ;
    E.rollDefensiveShot=rollDefensiveShot;
    E.applyActionZChange=changedZ;
    E.transitionForAction=transitionForAction6D;
})();
