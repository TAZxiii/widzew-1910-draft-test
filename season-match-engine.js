/*
 * Widzew 1910 Draft Game — standalone season match engine
 * ETAP 6 / 6A-6B
 *
 * This file is intentionally independent from script.js and the UI.
 * It generates one match from supplied match data. Integration comes later.
 *
 * Public API:
 *   window.WidzewSeasonMatchEngine.generateMatch(input)
 *
 * The engine accepts a random function in input.randomFn for deterministic tests.
 */
(function () {
    'use strict';

    const ENGINE_VERSION = '6A-6B.1';

    const EVENT_WEIGHTS = {
        OF: { 1: 20, 2: 17, 3: 5.5, 4: 7, 5: 20, 6: 15, 7: 3, 8: 12.5 },
        DEF: { 101: 20, 102: 17, 103: 5.5, 104: 7, 105: 20, 106: 15, 107: 3, 108: 12.5 }
    };

    const K_BY_REPEAT = {
        1: 0, 2: -5, 3: -10, 4: -15, 5: -20,
        6: -25, 7: -30, 8: -35, 9: -40, 10: -45
    };

    const FREQUENCY_WEIGHT = {
        najrzadziej: 5,
        rzadko: 30,
        normalnie: 50,
        często: 60,
        najczęściej: 80
    };

    const ACTION_AVAILABILITY = {
        '1.1': [5, 70], '1.2': [6, 70], '1.3': [20, 70], '1.4': [4, 70], '1.5': [9, 70],
        '1.6': [5, 70], '1.7': [5, 70], '1.8': [5, 70],
        '2.1': [5, 35], '2.2': [6, 35], '2.3': [10, 35], '2.4': [5, 35], '2.5': [9, 35],
        '2.6': [5, 35], '2.7': [5, 35], '2.8': [5, 35],
        '3.1': null, '3.2': null, '3.3': null, '3.4': null, '3.5': null, '3.6': null,
        '4.1': [17, 50], '4.2': [17, 50], '4.3': [17, 50], '4.4': [17, 50],
        '5.1': [31, 70], '5.2': [31, 70],
        '6.1': [5, 30], '6.2': [5, 30],
        '7.1': null, '7.2': null, '7.3': null,
        '8.1': [3, 18], '8.2': [3, 18], '8.3': [3, 18], '8.4': [3, 18],
        '10': null,
        '101.1': [5, 70], '101.2': [5, 70], '101.3': [5, 70], '101.4': [5, 70], '101.5': [5, 70],
        '102.1': [5, 35], '102.2': [5, 35], '102.3': [5, 35], '102.4': [5, 35], '102.5': [5, 35],
        '103.1': null, '103.2': null, '103.3': null,
        '104.1': [17, 50], '104.2': [17, 50],
        '105.1': [31, 70], '105.2': [31, 70],
        '106.1': [5, 30], '106.2': [5, 30],
        '107.1': null, '107.2': null, '107.3': null,
        '108.1': [3, 18], '108.2': [3, 18], '108.3': [3, 18],
        '110': null
    };

    const SPECIAL_Z_RANGES = {
        '3.1': [5, 10],
        '3.4': [17, 25],
        '3.6': [5, 6]
    };

    const Z_DISTRIBUTIONS = {
        1: [[5, 15, 10], [16, 29, 20], [30, 50, 45], [51, 60, 15], [61, 70, 10]],
        2: [[5, 10, 15], [11, 19, 20], [20, 30, 45], [31, 35, 20]],
        4: [[17, 20, 10], [21, 24, 15], [25, 35, 45], [36, 42, 20], [43, 50, 10]],
        5: [[31, 39, 15], [40, 60, 60], [61, 70, 25]],
        6: [[5, 10, 15], [11, 14, 15], [15, 25, 50], [26, 30, 20]],
        8: [[3, 5, 15], [6, 7, 15], [8, 15, 50], [16, 18, 20]]
    };

    const Z_CURVES = {
        Z4_DOWN: [[50,-45],[45,-42],[40,-38],[35,-34],[30,-29],[25,-23],[20,-15],[18,-11],[16,-7],[14,-2],[12,5],[10,12],[8,20],[6,29],[5,34],[4,39],[3,44]],
        Z4_UP_INV: [[50,44],[40,38],[30,29],[25,23],[20,15],[16,7],[14,2],[12,-5],[10,-12],[8,-20],[6,-29],[5,-34],[4,-39],[3,-44]],
        Z3_A: [[50,20],[40,16],[30,11],[25,7],[20,3],[16,0],[12,-5],[10,-9],[8,-14],[6,-19],[5,-22],[4,-25],[3,-28]],
        Z3_B: [[50,20],[40,18],[30,13],[25,8],[20,0],[16,-6],[12,-10],[10,-16],[8,-20],[6,-24],[5,-28],[4,-20],[3,-32]],
        Z3_C: [[50,-20],[40,-12],[35,-5],[30,3],[25,9],[20,13],[18,15],[16,14],[14,11],[12,6],[10,0],[8,-7],[6,-14],[5,-18]],
        Z3_D: [[16,4],[14,7],[12,10],[10,13],[8,17],[6,21],[5,24],[4,27],[3,30]],
        Z2_A: [[70,15],[60,14],[50,12],[40,9],[30,6],[25,3],[20,0],[16,-6],[12,-10],[10,-14],[8,-18],[6,-22],[5,-28],[4,-32],[3,-36]],
        Z2_B: [[50,15],[45,14],[40,12],[35,9],[30,6],[25,3],[20,0],[18,-5],[17,-15]],
        Z2_C: [[70,15],[60,14],[50,12],[40,9],[35,7],[30,5],[25,2],[20,0],[16,-3],[12,-6],[10,-8],[8,-10],[6,-12],[5,-14],[4,-15],[3,-15]],
        Z2_D: [[70,-25],[60,-22],[50,-18],[40,-13],[30,-7],[25,-3],[20,2],[16,7],[12,12],[10,15],[8,17],[6,19],[5,20]],
        Z2_E: [[50,25],[45,22],[40,18],[35,14],[30,9],[25,4],[20,-2],[19,-7],[18,-15],[17,-25]],
        Z2_F: [[70,-10],[60,-8],[50,-6],[40,-3],[35,0],[30,3],[25,5],[20,7],[16,9],[12,11],[10,12],[8,14],[6,15],[5,15]],
        Z1: [[70,8],[60,7],[50,6],[40,4],[30,2],[25,1],[20,0],[16,-2],[12,-3],[10,-4],[8,-5],[6,-6],[5,-7],[4,-8],[3,-8]]
    };

    const ACTION_Z_CURVE = {};
    ['1.6','1.7','2.6','2.7','4.3','4.4','8.1','8.2','8.3','8.4'].forEach(k => ACTION_Z_CURVE[k] = 'Z4_DOWN');
    ['1.4','1.5','2.4','2.5'].forEach(k => ACTION_Z_CURVE[k] = 'Z3_A');
    ['1.2','2.2'].forEach(k => ACTION_Z_CURVE[k] = 'Z3_B');
    ['2.3','4.2'].forEach(k => ACTION_Z_CURVE[k] = 'Z3_C');
    ['108.1','108.2','108.3'].forEach(k => ACTION_Z_CURVE[k] = 'Z3_D');
    ['1.1','2.1'].forEach(k => ACTION_Z_CURVE[k] = 'Z2_A');
    ACTION_Z_CURVE['4.1'] = 'Z2_B';
    ['5.2','6.2'].forEach(k => ACTION_Z_CURVE[k] = 'Z2_C');
    ['101.1','101.2','101.3','101.4','101.5','102.1','102.2','102.3','102.4','102.5'].forEach(k => ACTION_Z_CURVE[k] = 'Z2_D');
    ['104.1','104.2'].forEach(k => ACTION_Z_CURVE[k] = 'Z2_E');
    ['105.1','105.2','106.1','106.2'].forEach(k => ACTION_Z_CURVE[k] = 'Z2_F');
    ['1.8','2.8'].forEach(k => ACTION_Z_CURVE[k] = 'Z1');
    ACTION_Z_CURVE['10'] = 'Z4_DOWN';
    ACTION_Z_CURVE['110'] = 'Z4_UP_INV';

    const OF_EVENT_ACTIONS = {
        1: ['1.1','1.2','1.3','1.4','1.5','1.6','1.7','1.8'],
        2: ['2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'],
        3: ['3.1','3.2','3.3','3.4','3.5','3.6'],
        4: ['4.1','4.2','4.3','4.4'],
        5: ['5.1','5.2'],
        6: ['6.1','6.2'],
        7: ['7.1','7.2','7.3'],
        8: ['8.1','8.2','8.3','8.4']
    };

    const DEF_EVENT_ACTIONS = {
        101: ['101.1','101.2','101.3','101.4','101.5'],
        102: ['102.1','102.2','102.3','102.4','102.5'],
        103: ['103.1','103.2','103.3'],
        104: ['104.1','104.2'],
        105: ['105.1','105.2'],
        106: ['106.1','106.2'],
        107: ['107.1','107.2','107.3'],
        108: ['108.1','108.2','108.3']
    };

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
    function rand(rng) { return clamp(Number(rng()), 0, 0.999999999); }
    function randInt(min, max, rng) { return min + Math.floor(rand(rng) * (max - min + 1)); }

    function weightedPick(items, rng) {
        const valid = items.filter(x => Number(x.weight) > 0);
        if (!valid.length) return null;
        const total = valid.reduce((s, x) => s + Number(x.weight), 0);
        let r = rand(rng) * total;
        for (const item of valid) {
            r -= Number(item.weight);
            if (r < 0) return item;
        }
        return valid[valid.length - 1];
    }

    function frequencyWeight(label) {
        return FREQUENCY_WEIGHT[label] || Number(label) || 0;
    }

    function weightedFrequencyPick(options, rng) {
        return weightedPick(options.map(o => ({ value: o.value, weight: frequencyWeight(o.frequency) })), rng).value;
    }

    function normaliseWeightedOptions(options) {
        return options.map(o => ({ ...o, weight: frequencyWeight(o.frequency) }));
    }

    function chooseWeighted(options, rng) {
        return weightedPick(normaliseWeightedOptions(options), rng).value;
    }

    function interpolateCurve(points, z) {
        if (!points || !points.length || !Number.isFinite(Number(z))) return 0;
        const x = Number(z);
        const sorted = points.slice().sort((a,b) => a[0] - b[0]);
        if (x <= sorted[0][0]) return sorted[0][1];
        if (x >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
        for (let i = 0; i < sorted.length - 1; i++) {
            const [x1,y1] = sorted[i];
            const [x2,y2] = sorted[i+1];
            if (x >= x1 && x <= x2) {
                const t = (x - x1) / (x2 - x1);
                return y1 + (y2 - y1) * t;
            }
        }
        return 0;
    }

    function curveModifier(actionId, z) {
        const curve = ACTION_Z_CURVE[String(actionId)];
        return curve ? interpolateCurve(Z_CURVES[curve], z) : 0;
    }

    function chooseZ(eventId, actionId, rng) {
        const action = String(actionId);
        if (action === '10' || action === '110') return null;
        if (SPECIAL_Z_RANGES[action]) {
            const [min,max] = SPECIAL_Z_RANGES[action];
            return randInt(min, max, rng);
        }
        const event = Number(eventId);
        if ([3,7,103,107].includes(event)) return null;
        const range = ACTION_AVAILABILITY[action];
        if (!range) return null;
        const [min,max] = range;
        const distribution = Z_DISTRIBUTIONS[event];
        if (!distribution) return randInt(min,max,rng);
        const usable = distribution.filter(x => x[1] >= min && x[0] <= max);
        const bucket = weightedPick(usable.map(x => ({ value:x, weight:x[2] })), rng).value;
        return randInt(Math.max(min,bucket[0]), Math.min(max,bucket[1]), rng);
    }

    function availableActions(eventId, z) {
        const source = eventId >= 100 ? DEF_EVENT_ACTIONS : OF_EVENT_ACTIONS;
        const actions = source[eventId] || [];
        return actions.filter(actionId => {
            const range = ACTION_AVAILABILITY[actionId];
            if (!range) return true;
            if (!Number.isFinite(Number(z))) return false;
            return z >= range[0] && z <= range[1];
        });
    }

    function chooseAction(eventId, z, rng) {
        const actions = availableActions(eventId, z);
        if (!actions.length) throw new Error('Brak dostępnej akcji dla eventu ' + eventId + ' i Z=' + z);
        return actions[randInt(0, actions.length - 1, rng)];
    }

    function getK(repeatCount) {
        return K_BY_REPEAT[Math.min(Math.max(repeatCount, 1), 10)] ?? -45;
    }

    function updateRepeat(lastAction, repeatCount, currentAction) {
        if (!lastAction || lastAction !== currentAction) return 1;
        return Math.min(repeatCount + 1, 10);
    }

    function selectRandomFieldPlayer(players, rng, exclude) {
        const list = (players || []).filter(p => p && !p.isGoalkeeper && String(p.slot || p.position || '').toUpperCase() !== 'BR' && p !== exclude);
        if (!list.length) return null;
        return list[randInt(0, list.length - 1, rng)];
    }

    function selectActionPlayers(actionId, players, rng, currentPlayer) {
        const id = String(actionId);
        const passing = /^(1\.1|1\.2|1\.3|1\.8|2\.1|2\.2|2\.8|3\.1|3\.6|4\.1|5\.1|5\.2|6\.1|6\.2)$/.test(id);
        const dribble = /^(1\.4|1\.5|2\.4|2\.5)$/.test(id);
        const performer = currentPlayer || selectRandomFieldPlayer(players, rng);
        if (passing) {
            const receiver = selectRandomFieldPlayer(players, rng, performer);
            return { performer, receiver };
        }
        if (dribble) return { performer, receiver: null };
        return { performer, receiver: null };
    }

    function eventSide(eventId) { return eventId >= 100 ? 'DEF' : 'OF'; }

    function chooseNextEventByZ(eventId, z, rng) {
        if (eventId === 101) return z <= 16 ? 108 : 101;
        if (eventId === 102) return z <= 16 ? 108 : 102;
        if (eventId === 105) return 101;
        if (eventId === 106) return 102;
        if (eventId === 104) return rand(rng) < 0.5 ? 108 : 110;
        return eventId;
    }

    function chooseEvent1or8(rng) { return rand(rng) < 0.5 ? 1 : 8; }

    function chooseFailureMessage(options, rng) {
        return chooseWeighted(options, rng);
    }

    function transitionForAction(actionId, success, z, rng) {
        const id = String(actionId);
        if (id === '10') {
            if (success) return { message: '9.10', goal: 'WIDZEW', end: true };
            return rand(rng) < (60/(60+30))
                ? { message: '9.8', end: true }
                : { message: '9.9', nextEvent: 3, newZ: null };
        }
        if (id === '110') {
            if (success) return rand(rng) < (60/(60+30))
                ? { message: '99.9', nextEvent: 3 }
                : { message: '99.8', end: true };
            return { message: '99.10', goal: 'OPPONENT', end: true };
        }

        const shot = ['1.6','1.7','2.6','2.7','4.3','4.4','7.1','7.2','7.3','8.1','8.2','8.3','8.4'].includes(id);
        if (shot) {
            if (success) return { message: '9.1', nextAction: '10' };
            const opts = id.startsWith('7.')
                ? [{value:'9.2',frequency:'często'},{value:'9.8',frequency:'normalnie'},{value:'9.9',frequency:'rzadko'}]
                : [{value:'9.2',frequency:'często'},{value:'9.3',frequency:'normalnie'},{value:'9.4',frequency:'rzadko'},{value:'9.6',frequency:'normalnie'},{value:'9.8',frequency:'normalnie'},{value:'9.7',frequency:'rzadko'},{value:'9.9',frequency:'rzadko'}];
            const msg = chooseFailureMessage(opts, rng);
            if (msg === '9.7' || msg === '9.9') return { message: msg, nextEvent: 3 };
            return { message: msg, end: true };
        }

        const passing = ['1.1','1.2','1.8','2.1','2.2','2.8','3.1','3.6','4.1','5.1','5.2','6.1','6.2'].includes(id);
        if (passing) {
            if (success) {
                let nextEvent;
                if (id === '3.1') nextEvent = 2;
                else if (id === '3.6') nextEvent = 2;
                else if (id === '6.2') nextEvent = 8;
                else nextEvent = id.startsWith('2.') ? 2 : 1;
                return { nextEvent, newZ: null };
            }
            if (id === '3.1' || id === '3.6') {
                const opts = [{value:'9.3',frequency:'często'},{value:'9.4',frequency:'często'},{value:'9.11',frequency:'rzadko'}];
                const msg = chooseFailureMessage(opts,rng);
                return msg === '9.11' ? {message:msg,nextEvent:4} : {message:msg,end:true};
            }
            if (id === '1.2' || id === '2.2') {
                const msg = chooseFailureMessage([{value:'9.3',frequency:'często'},{value:'9.4',frequency:'często'},{value:'9.5',frequency:'rzadko'}],rng);
                return {message:msg,end:true};
            }
            return { message: chooseFailureMessage([{value:'9.3',frequency:'normalnie'},{value:'9.4',frequency:'normalnie'}],rng), end:true };
        }

        if (['1.4','1.5','2.4','2.5'].includes(id)) {
            if (success) return { nextEvent:1, newZ:null, keepPlayer:true };
            const msg = chooseFailureMessage([{value:'9.3',frequency:'często'},{value:'9.4',frequency:'często'},{value:'9.11',frequency:'rzadko'}],rng);
            if (msg === '9.11') return {message:msg,nextEvent: rand(rng)<0.5 ? 4 : 7};
            return {message:msg,end:true};
        }

        if (id === '1.3') {
            if (success) return { nextEvent: chooseEvent1or8(rng), newZ:null };
            return {message:chooseFailureMessage([{value:'9.3',frequency:'normalnie'},{value:'9.4',frequency:'normalnie'}],rng),end:true};
        }
        if (id === '2.3') {
            if (success) return {nextEvent:8,newZ:null};
            return {message:chooseFailureMessage([{value:'9.3',frequency:'normalnie'},{value:'9.4',frequency:'normalnie'}],rng),end:true};
        }
        if (id === '3.2' || id === '3.3') {
            if (success) return {nextEvent:8,newZ:null};
            const msg=chooseFailureMessage([{value:'9.6',frequency:'często'},{value:'9.8',frequency:'często'},{value:'9.7',frequency:'normalnie'},{value:'9.9',frequency:'normalnie'},{value:'9.11',frequency:'najrzadziej'}],rng);
            if (msg==='9.7'||msg==='9.9') return {message:msg,nextEvent:3};
            if (msg==='9.11') return {message:msg,nextEvent:7};
            return {message:msg,end:true};
        }
        if (id === '3.4') {
            if (success) return {nextEvent:1,newZ:randInt(17,25,rng)};
            const msg=chooseFailureMessage([{value:'9.6',frequency:'często'},{value:'9.7',frequency:'normalnie'},{value:'9.11',frequency:'rzadko'}],rng);
            if(msg==='9.7') return {message:msg,nextEvent:3};
            if(msg==='9.11') return {message:msg,nextEvent:4};
            return {message:msg,end:true};
        }
        if (id === '3.5') return success ? {message:'9.1',nextAction:'10'} : {message:'9.2',end:true};
        if (id === '4.2') {
            if(success) return {nextEvent:chooseEvent1or8(rng),newZ:null};
            const msg=chooseFailureMessage([{value:'9.3',frequency:'często'},{value:'9.6',frequency:'często'},{value:'9.8',frequency:'często'},{value:'9.7',frequency:'normalnie'},{value:'9.9',frequency:'normalnie'},{value:'9.11',frequency:'najrzadziej'}],rng);
            if(msg==='9.7'||msg==='9.9') return {message:msg,nextEvent:3};
            if(msg==='9.11') return {message:msg,nextEvent:7};
            return {message:msg,end:true};
        }
        if (id === '4.3' || id === '4.4') {
            if(success) return {message:'9.1',nextAction:'10'};
            const msg=chooseFailureMessage([{value:'9.2',frequency:'często'},{value:'9.3',frequency:'normalnie'},{value:'9.4',frequency:'normalnie'},{value:'9.6',frequency:'normalnie'},{value:'9.8',frequency:'normalnie'},{value:'9.7',frequency:'rzadko'},{value:'9.9',frequency:'rzadko'}],rng);
            if(msg==='9.7'||msg==='9.9') return {message:msg,nextEvent:3};
            return {message:msg,end:true};
        }

        if (['101.1','101.2','101.3','101.4','101.5','102.1','102.2','102.3','102.4','102.5','103.1','103.2','103.3','104.1','104.2','105.1','105.2','106.1','106.2','108.1','108.2','108.3','107.1','107.2','107.3'].includes(id)) {
            return transitionDefense(id, success, z, rng);
        }

        throw new Error('Brak przejścia dla akcji ' + id);
    }

    function transitionDefense(id, success, z, rng) {
        const num = Number(id.split('.')[0]);
        if (id === '107.1' || id === '107.2' || id === '107.3') {
            if (success) {
                const msg=chooseFailureMessage([{value:'99.2',frequency:'najczęściej'},{value:'99.9',frequency:'często'},{value:'99.8',frequency:'rzadko'}],rng);
                return msg==='99.9' ? {message:msg,nextEvent:103} : {message:msg,end:true};
            }
            return {message:'99.1',nextAction:'110'};
        }
        if (id === '110') return success ? (rand(rng)<(60/(60+30)) ? {message:'99.9',nextEvent:3} : {message:'99.8',end:true}) : {message:'99.10',goal:'OPPONENT',end:true};

        if (id === '101.1' || id === '102.1') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            const msg=chooseFailureMessage([{value:'99.6',frequency:'często'},{value:'99.7',frequency:'normalnie'}],rng);
            return {message:msg,nextEvent:chooseNextEventByZ(num,z,rng)};
        }
        if (id === '101.2' || id === '102.2') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            const msg=chooseFailureMessage([{value:'99.6',frequency:'często'},{value:'99.11',frequency:'rzadko'}],rng);
            return msg==='99.11'?{message:msg,nextEvent:104}:{message:msg,nextEvent:chooseNextEventByZ(num,z,rng)};
        }
        if (id === '101.3' || id === '102.3') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            const msg=chooseFailureMessage([{value:'99.6',frequency:'często'},{value:'99.11',frequency:'często'}],rng);
            return msg==='99.11'?{message:msg,nextEvent:104}:{message:msg,nextEvent:chooseNextEventByZ(num,z,rng)};
        }
        if (id === '101.4' || id === '102.4') {
            if(success){
                const msg=chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'},{value:'99.12',frequency:'często'}],rng);
                return msg==='99.12'?{message:msg,nextEvent:num===101?105:105}:{message:msg,end:true};
            }
            const msg=chooseFailureMessage([{value:'99.6',frequency:'często'},{value:'99.14',frequency:'często'}],rng);
            return {message:msg,nextEvent:chooseNextEventByZ(num,z,rng)};
        }
        if (id === '101.5' || id === '102.5') {
            if(success){
                const msg=chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'},{value:'99.11',frequency:'często'}],rng);
                if(msg==='99.11') return {message:msg,nextEvent:rand(rng)<0.5?104:107};
                return {message:msg,end:true};
            }
            return {message:'99.6',nextEvent:chooseNextEventByZ(num,z,rng)};
        }
        if (id === '103.1') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'często'},{value:'99.4',frequency:'często'}],rng),end:true};
            return rand(rng)<(60/(60+30)) ? {message:'99.14',nextEvent:102} : {message:'99.11',nextEvent:104};
        }
        if (id === '103.2' || id === '103.3') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'często'},{value:'99.4',frequency:'często'}],rng),end:true};
            const msg=chooseFailureMessage([{value:'99.14',frequency:'często'},{value:'99.9',frequency:'normalnie'},{value:'99.12',frequency:'normalnie'},{value:'99.11',frequency:'najrzadziej'}],rng);
            if(msg==='99.14') return {message:msg,nextEvent:108};
            if(msg==='99.11') return {message:msg,nextEvent:107};
            return {message:msg,nextEvent:103};
        }
        if (id === '104.1') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            return {message:'99.13',nextEvent:rand(rng)<0.5?108:101};
        }
        if (id === '104.2') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            return {message:'99.13',nextEvent:rand(rng)<(60/(60+30))?108:110};
        }
        if (id === '105.1' || id === '105.2') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            return {message:'99.13',nextEvent:101};
        }
        if (id === '106.1') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            return {message:'99.13',nextEvent:102};
        }
        if (id === '106.2') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'normalnie'},{value:'99.4',frequency:'normalnie'}],rng),end:true};
            return {message:'99.13',nextEvent:108};
        }
        if (id === '108.1' || id === '108.2' || id === '108.3') {
            if(success) return {message:chooseFailureMessage([{value:'99.3',frequency:'często'},{value:'99.4',frequency:'często'},{value:'99.8',frequency:'rzadko'}],rng),end:true};
            const msg=chooseFailureMessage([{value:'99.13',frequency:'najczęściej'},{value:'99.14',frequency:'często'},{value:'99.2',frequency:'normalnie'},{value:'99.11',frequency:'najrzadziej'}],rng);
            if(msg==='99.13') return {message:msg,nextEvent:103};
            if(msg==='99.14') return {message:msg,nextEvent:110};
            if(msg==='99.11') return {message:msg,nextEvent:108};
            return {message:msg,end:true};
        }
        throw new Error('Brak defensywnego przejścia dla '+id);
    }

    function overallEventModifier(diff) {
        if (diff >= 15) return 1.5;
        if (diff <= -15) return -1.5;
        return diff / 10;
    }

    function calculateTotalEvents(input, rng) {
        const w = Number(input.widzew?.overall ?? 65);
        const o = Number(input.opponent?.overall ?? 65);
        const diff = clamp(w - o, -20, 20);
        const coach = Number(input.coachStrength ?? input.coach?.strength ?? 0);
        const character = Number(input.opponent?.charakter ?? input.opponent?.character ?? 5);
        const location = input.home ? 0.5 : -0.5;
        const characterMod = (character - 5) * 0.4;
        const randomness = rand(rng) * 3 - 1.5;
        return clamp(Math.round(10 + overallEventModifier(diff) + coach + location + characterMod + randomness), 3, 15);
    }

    function chooseOfShare(input, rng) {
        // Podział podstawowych sekwencji OF/DEF.
        // Baza: 50% OF.
        // Overall Widzewa względem rywala: maks. +/-12 pp.
        // Siła trenera: coachStrength * 5 pp.
        // Miejsce meczu: +5 pp u siebie, -5 pp na wyjeździe.
        // Charakter rywala nie wpływa na OF/DEF — wpływa wyłącznie na liczbę wydarzeń.
        const widzewOverall = Number(input.widzew?.overall ?? 65);
        const opponentOverall = Number(input.opponent?.overall ?? 65);
        const overallDiff = clamp(widzewOverall - opponentOverall, -20, 20);

        const coachStrength = Number(input.coachStrength ?? input.coach?.strength ?? 0);
        const overallMod = clamp(overallDiff * (12 / 20), -12, 12);
        const coachMod = coachStrength * 5;
        const locationMod = input.home ? 5 : -5;

        const ofPercent = clamp(
            50 + overallMod + coachMod + locationMod,
            25,
            75
        );

        return ofPercent / 100;
    }

    function generateEventSides(count, ofShare, rng) {
        const ofCount = Math.round(count * ofShare);
        const sides = Array(count).fill('OF');
        for (let i = ofCount; i < count; i++) sides[i] = 'DEF';
        for (let i = sides.length - 1; i > 0; i--) {
            const j = Math.floor(rand(rng) * (i + 1));
            [sides[i], sides[j]] = [sides[j], sides[i]];
        }
        return sides;
    }

    function chooseEvent(side, rng) {
        const table = EVENT_WEIGHTS[side];
        const picked = weightedPick(Object.entries(table).map(([value,weight])=>({value:Number(value),weight})),rng);
        return picked.value;
    }

    function minuteBucket(rng) {
        return weightedPick([
            {value:[1,15],weight:12.70},{value:[16,30],weight:13.90},{value:[31,45],weight:15.89},
            {value:[45,45],weight:3.19},{value:[46,60],weight:16.20},{value:[61,75],weight:15.13},
            {value:[76,90],weight:15.89},{value:[90,90],weight:7.09}
        ],rng).value;
    }

    function generateMinutes(count, rng) {
        const values=[];
        for(let i=0;i<count;i++){
            const bucket=minuteBucket(rng);
            if(bucket[0]===45) values.push(45+randInt(0,5,rng));
            else if(bucket[0]===90) values.push(90+randInt(0,8,rng));
            else values.push(randInt(bucket[0],bucket[1],rng));
        }
        return values.sort((a,b)=>a-b);
    }

    function generateMatch(input) {
        const rng = typeof input.randomFn === 'function' ? input.randomFn : Math.random;
        const count = calculateTotalEvents(input,rng);
        const ofShare = chooseOfShare(input,rng);
        const sides = generateEventSides(count,ofShare,rng);
        const minutes = generateMinutes(count,rng);
        const players = input.widzew?.players || [];
        const events=[];
        let scoreW=0, scoreO=0;
        let currentPlayer=null;
        let lastAction=null;
        let repeatCount=0;

        for(let i=0;i<count;i++){
            let side=sides[i];
            let eventId=chooseEvent(side,rng);
            let safety=0;
            let sequenceEnd=false;
            while(!sequenceEnd && safety++<100){
                const eventZ = eventId>=100 ? chooseZ(eventId, String(eventId)+'.1', rng) : chooseZ(eventId, String(eventId)+'.1', rng);
                let actionZ=eventZ;
                const action=chooseAction(eventId,actionZ,rng);
                let z=chooseZ(eventId,action,rng);
                if(z===null && actionZ!==null) z=actionZ;
                const actorData=side==='OF' ? selectActionPlayers(action,players,rng,currentPlayer) : {performer:selectRandomFieldPlayer(players,rng),receiver:null};
                currentPlayer=actorData.performer;
                repeatCount=updateRepeat(lastAction,repeatCount,action);
                const k=getK(repeatCount);
                const transition=transitionForAction(action,false,z,rng);

                const record={index:events.length+1,minute:minutes[i],side,eventId,actionId:action,z,k,performer:actorData.performer,receiver:actorData.receiver,success:null,transition};
                events.push(record);

                // This standalone first version intentionally stops before resolving action success,
                // because the exact stat formula table is implemented in the next engine sub-step.
                sequenceEnd=true;
                lastAction=action;
                if(transition.goal==='WIDZEW') scoreW++;
                if(transition.goal==='OPPONENT') scoreO++;
            }
        }

        return {
            engineVersion:ENGINE_VERSION,
            totalEvents:count,
            ofShare,
            score:{widzew:scoreW,opponent:scoreO},
            events,
            notes:['Core ETAP 6A-6B scaffold created independently from script.js.','Action probability/stat resolver is intentionally isolated for the next implementation step.']
        };
    }

    window.WidzewSeasonMatchEngine = {
        version: ENGINE_VERSION,
        constants: {
            EVENT_WEIGHTS,
            ACTION_AVAILABILITY,
            Z_DISTRIBUTIONS,
            Z_CURVES,
            FREQUENCY_WEIGHT,
            K_BY_REPEAT
        },
        generateMatch,
        weightedPick,
        interpolateCurve,
        curveModifier,
        chooseZ,
        availableActions,
        chooseNextEventByZ,
        chooseEvent1or8,
        transitionForAction
    };
})();
