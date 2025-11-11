// 엄마의 분노 모드 전용 스크립트
// - 거리 게이지/경고 표시
// - 시간이 지날수록 엄마와의 거리 감소, 0이면 종료
// - 아이템 담으면 거리 +1, 기본 점수 공식을 사용

(function(){
  const API = {};

  function $(sel){ return document.querySelector(sel); }
  const gameGaugeEl = document.getElementById('gameGauge');
  const gameGaugeFillEl = document.getElementById('gameGaugeFill');
  const gapTextEl = document.getElementById('gapText');
  const dangerOverlay = document.getElementById('dangerOverlay');
  const speech = document.getElementById('speech');
  const timerLabelEl = $('.timer-label');
  const gapLabelEl = $('.gap-label');

  const START_DISTANCE = 5; // 엔진 상수와 동일해야 함
  const WARNING_DISTANCE = 2;
  const MOM_BASE_SPEED = 0.45;

  API.begin = function(beginInit, startGame){ beginInit('mom'); startGame(); };

  API.updateHUD = function(state){
    timerLabelEl && timerLabelEl.classList.add('hidden');
    gapLabelEl && gapLabelEl.classList.remove('hidden');
    gameGaugeEl && gameGaugeEl.classList.remove('hidden');
    const fillRatio = Math.max(0, Math.min(1, (START_DISTANCE - state.momGap) / Math.max(START_DISTANCE, 0.0001)));
    if (gameGaugeFillEl) {
      if (fillRatio <= 0) {
        gameGaugeFillEl.classList.add('empty');
        gameGaugeFillEl.style.width = '0%';
      } else {
        const pct = (fillRatio * 100).toFixed(1);
        gameGaugeFillEl.classList.remove('empty');
        gameGaugeFillEl.style.width = pct + '%';
      }
    }
    gapTextEl && (gapTextEl.textContent = String(Math.max(0, Math.ceil(state.momGap))));
    const dangerAlpha = Math.max(0, Math.min(1, 1 - (state.momGap / 2)));
    if (dangerOverlay) dangerOverlay.style.opacity = (dangerAlpha * 0.9).toFixed(2);
    const inWarning = state.momGap <= WARNING_DISTANCE;
    state.momWarningActive = !!inWarning;
    if (inWarning) speech && speech.classList.remove('hidden'); else speech && speech.classList.add('hidden');
  };

  API.update = function(state, dt){
    state.momGap -= MOM_BASE_SPEED * dt;
    if (state.momGap < -0.0001) state.momGap = -0.0001;
  };

  API.isOver = function(state){ return state.momGap <= 0; };

  // baseScore는 엔진이 계산해서 넣어줌
  API.scoreForPick = function(state, picked, baseScore){
    const mult = 1 + Math.floor(state.combo/10);
    return (baseScore || 10) * mult;
  };

  API.onPickAfter = function(state){ state.momGap += 1; };

  window.MomMode = API;
})();

