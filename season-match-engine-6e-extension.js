/* ETAP 6E — corrections to 6D transitions and Z handling */
(function(){
    'use strict';
    const E=window.WidzewSeasonMatchEngine;
    if(!E) throw Error('Silnik musi być załadowany przed 6E');

    const BASE_TRANSITION=E.transitionForAction;
    const BASE_AVAILABLE_ACTIONS=E.availableActions;
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const rand=r=>clamp(Number(r()),0,0.999999999);
    const int=(a,b,r)=>a+Math.floor(rand(r)*(b-a+1));

    const DECREASE_RANGES={
        '1.1':[1,5], '1.2':[5,11], '1.3':[15,30], '1.4':[3,8], '1.5':[5,12],
        '2.1':[1,2], '2.2':[3,6], '2.4':[2,4], '2.5':[3,5],
        '4.1':[1,5],
        '5.1':[1,5], '5.2':[10,20],
        '6.1':[1,5]
    };

    function correctedDecreaseZ(actionId,z,r){
        const range=DECREASE_RANGES[String(actionId)];
        if(!range || !Number.isFinite(Number(z))) return null;
        return Number(z)-int(range[0],range[1],r);
    }

    function transitionForAction6E(actionId,success,z,rng){
        const id=String(actionId);
        const r=rng||Math.random;
        let t=BASE_TRANSITION(actionId,success,z,r);

        if(success && Number.isFinite(Number(z))){
            if(['1.1','1.2','1.3','1.4','1.5'].includes(id)){
                const nz = (id==='1.3' && t.nextEvent===8)
                    ? (typeof E.chooseZ==='function' ? E.chooseZ(8,'8.1',r) : null)
                    : correctedDecreaseZ(id,z,r);
                if(nz!==null) t={...t,nextEvent:t.nextEvent||1,newZ:nz};
            }

            // 1.8 — gra na czas: event 1 + zmiana Z o -3..+3.
            if(id==='1.8'){
                const nz=Number(z)+int(-3,3,r);
                t={...t,nextEvent:1,newZ:nz};
            }

            if(['2.1','2.2','2.4','2.5'].includes(id)){
                const nz=correctedDecreaseZ(id,z,r);
                if(nz!==null) t={...t,nextEvent:t.nextEvent||2,newZ:nz};
            }
            if(id==='2.3' && t.nextEvent===8){
                const nz=typeof E.chooseZ==='function' ? E.chooseZ(8,'8.1',r) : null;
                if(nz!==null) t={...t,nextEvent:8,newZ:nz};
            }

            // 2.8 — gra na czas: event 2 + zmiana Z o -3..+3.
            if(id==='2.8'){
                const nz=Number(z)+int(-3,3,r);
                t={...t,nextEvent:2,newZ:nz};
            }

            if(id==='4.1'){
                const nz=correctedDecreaseZ(id,z,r);
                if(nz!==null) t={...t,nextEvent:1,newZ:nz};
            }

            if(['5.1','5.2'].includes(id)){
                const nz=correctedDecreaseZ(id,z,r);
                if(nz!==null) t={...t,nextEvent:1,newZ:nz};
            }

            // 6.1 — podanie do najbliższego zawodnika: event 2,
            // a Z zmniejsza się losowo o 1–5 m zgodnie z arkuszem „Zmiany Z”.
            if(id==='6.1'){
                const nz=correctedDecreaseZ(id,z,r);
                t={...t,nextEvent:2,newZ:nz};
            }
        }

        // 101.5 i 102.5: przy sukcesie 99.3/99.4 kończy akcję najrzadziej,
        // natomiast faul 99.11 występuje często.
        // Kluczowe: 99.11 NIE losuje nowej odległości.
        // Do eventu 107 lub 104 przekazujemy dokładnie Z z poprzedniej akcji.
        if(success && (id==='101.5' || id==='102.5')){
            const roll=rand(r);
            if(roll < 60/70){
                t={
                    message:'99.11',
                    nextEvent:Number(z)<=16?107:104,
                    newZ:Number(z)
                };
            }else if(roll < 65/70){
                t={message:'99.3',end:true};
            }else{
                t={message:'99.4',end:true};
            }
        }

        // Po udanym strzale bramkarza w evencie 110 piłka trafia na rzut rożny.
        // Event 110 jest defensywny, więc dalszy event musi również być defensywny.
        if(id==='110' && t && t.message==='99.9' && t.nextEvent===3){
            t={...t,nextEvent:103};
        }

        // Korekta komunikatu dla obu akcji eventu 103: 99.12 nie występuje.
        // W obu przypadkach właściwym komunikatem jest 99.13 — rzut rożny.
        if((id==='103.2'||id==='103.3') && t && t.message==='99.12'){
            t={...t,message:'99.13'};
        }

        // 104.1/104.2/105.1/105.2/106.1/106.2: 99.13 -> 99.14
        if(['104.1','104.2','105.1','105.2','106.1','106.2'].includes(id) && t && t.message==='99.13'){
            t={...t,message:'99.14'};
        }

        // Po udanym wybiciu na aut komunikat 99.12 prowadzi
        // do eventu 105 albo 106 zależnie od Z z POPRZEDNIEJ akcji.
        // Z <= 30 m -> 105, Z > 30 m -> 106. Z nie zmienia się.
        if(success && (id==='101.4'||id==='102.4') && t && t.message==='99.12'){
            t={
                ...t,
                nextEvent:Number(z)<=30?(id==='101.4'?105:105):(id==='101.4'?106:106),
                newZ:Number(z)
            };
        }

        // Zasada 16 m: w każdej defensywnej akcji, gdy wynikiem jest 99.11,
        // decyzja o kolejnym evencie zależy od aktualnego Z.
        // Z <= 16 m -> rzut karny (107), Z > 16 m -> rzut wolny (104).
        const eventId=Number(id.split('.')[0]);
        if([101,102,103,104,105,106,108].includes(eventId) && t && t.message==='99.11'){
            t={...t,nextEvent:Number(z)<=16?107:104};
        }

        // Zasada 16 m: w każdej ofensywnej akcji, gdy wynikiem jest 9.11,
        // decyzja o kolejnym evencie zależy od aktualnego Z.
        // Z <= 16 m -> event 7, Z > 16 m -> event 4.
        if([1,2,3,4,5,6,7,8].includes(eventId) && t && t.message==='9.11'){
            t={...t,nextEvent:Number(z)<=16?7:4};
        }

        return t;
    }

    // Event 2: akcja 2.3 (dośrodkowanie) jest zawsze dostępna,
    // niezależnie od aktualnego Z. Jej wynik nadal rozstrzygany jest
    // normalnie, a przy sukcesie prowadzi do eventu 8 z nowym losowym Z.
    E.availableActions=function(eventId,z){
        const actions=BASE_AVAILABLE_ACTIONS(eventId,z);
        if(Number(eventId)===2 && !actions.includes('2.3')){
            const insertAt=Math.min(2,actions.length);
            actions.splice(insertAt,0,'2.3');
        }

        // 105 = daleki aut: tylko Z 31–70.
        // 106 = bliski aut: tylko Z 5–30.
        // Z z poprzedniej akcji pozostaje bez zmian.
        if(Number(eventId)===105 && Number.isFinite(Number(z))){
            return ['105.1','105.2'];
        }
        if(Number(eventId)===106 && Number.isFinite(Number(z))){
            return ['106.1','106.2'];
        }
        return actions;
    };

    E.transitionForAction=transitionForAction6E;
    E.constants.ETAP_6E={
        fix_1_1_to_1_5_z:'decrease_by_workbook_range',
        fix_1_8_z:'plus_or_minus_3',
        fix_2_1_to_2_5_z:'decrease_by_workbook_range_except_2_3_event8',
        fix_2_8_z:'plus_or_minus_3',
        fix_4_1_z:'decrease_1_to_5',
        fix_5_1_z:'decrease_1_to_5',
        fix_5_2_z:'decrease_10_to_20',
        fix_6_1_z:'decrease_1_to_5',
        fix_6_1_event:2,
        fix_99_11_threshold_m:16,
        fix_99_11_event_le_16:107,
        fix_99_11_event_gt_16:104,
        fix_9_11_threshold_m:16,
        fix_9_11_event_le_16:7,
        fix_9_11_event_gt_16:4,
        fix_event_2_action_2_3_always_available:true,
        fix_2_3_success_event:8,
        fix_2_3_success_new_z:'random_event_8_range',
        fix_110_99_9_next_event:103,
        fix_103_actions_message_99_12_to:'99.13',
        fix_104_106_message_99_13_to:'99.14',
        fix_101_5_102_5_success_messages:{'99.3':'najrzadziej','99.4':'najrzadziej','99.11':'często'},
        fix_101_5_102_5_99_11_preserve_z:true
    };
})();