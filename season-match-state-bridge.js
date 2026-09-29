/* Expose the season state to the interactive match scripts. */
(function(){
  'use strict';
  try {
    if (!window.seasonGameState) {
      const state = window.eval('seasonGameState');
      if (state) window.seasonGameState = state;
    }
  } catch (e) {
    console.error('Nie udało się udostępnić stanu sezonu dla silnika meczu:', e);
  }
})();
