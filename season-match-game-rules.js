/* Main-game-only transition corrections copied from the confirmed match tester rules. */
(function(){
  'use strict';
  const E=window.WidzewSeasonMatchEngine;
  if(!E)throw Error('Silnik meczu musi być załadowany przed regułami integracji');
  const BASE=E.transitionForAction;
  const clamp=n=>Math.max(0,Math.min(0.999999999,Number(n)||0));
  const rand=()=>clamp(Math.random());

  E.transitionForAction=function(id,success,z,rng){
    const sid=String(id), r=rng||Math.random;
    const original=BASE(id,success,z,r);

    if(sid==='101.1'||sid==='102.1'){
      const eventId=sid==='101.1'?101:102;
      const nextNormal=Number(z)<=16?108:eventId;
      if(success){
        const x=clamp(r())*140;
        if(x<80)return {message:'99.7',nextEvent:nextNormal,testOverride:true};
        if(x<110)return {message:'99.3',end:true,testOverride:true};
        return {message:'99.4',end:true,testOverride:true};
      }
      const shotChance=typeof E.defensiveShotChance==='function'?E.defensiveShotChance(z):0;
      if(clamp(r())<shotChance){
        const shotMessage=clamp(r())<0.45?'99.1':'99.2';
        return shotMessage==='99.1'
          ? {message:'99.1',nextEvent:110,testOverride:true}
          : {message:'99.2',end:true,testOverride:true};
      }
      return {message:'99.6',nextEvent:nextNormal,testOverride:true};
    }

    if(sid==='108.1'||sid==='108.2'||sid==='108.3'){
      if(success)return original;
      const x=clamp(r())*175;
      if(x<60)return {message:'99.13',nextEvent:103,testOverride:true};
      if(x<140)return {message:'99.14',nextEvent:110,testOverride:true};
      if(x<170)return {message:'99.2',end:true,testOverride:true};
      return {message:'99.11',nextEvent:107,testOverride:true};
    }

    // The main integration counts a goal from the communication itself.
    // Remove the duplicate goal marker used by the standalone API.
    if(original&&original.goal){
      const copy={...original};
      delete copy.goal;
      return copy;
    }
    return original;
  };
})();
