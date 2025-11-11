// 점수제 모드 전용 스크립트
// - 엄마는 등장하지 않음(거리/경고 비표시)
// - 시작 전 메모(목표 아이템) 표시 후 시작
// - 맞는 아이템만 점수 +1, 그 외 0점

(function(){
  const API = {};

  function q(id){ return document.getElementById(id); }

  // 메모 UI 요소 참조
  const memoModal = q('memoModal');
  const memoList = q('memoList');
  const memoCountdown = q('memoCountdown');
  const skipMemoBtn = q('skipMemoBtn');
  const timerLabelEl = document.querySelector('.timer-label');

  // 내부 유틸
  function showMemoOverlay(seconds, onDone){
    let remain = Math.max(1, Math.floor(seconds));
    if (memoCountdown) memoCountdown.textContent = String(remain);
    if (memoModal) memoModal.classList.remove('hidden');
    let timer = null;
    const cleanup = () => {
      if (memoModal) memoModal.classList.add('hidden');
      if (timer) clearInterval(timer);
      timer = null;
      skipMemoBtn && skipMemoBtn.removeEventListener('click', onSkip);
    };
    const onSkip = () => { cleanup(); onDone && onDone(); };
    const tick = () => {
      remain -= 1;
      if (memoCountdown) memoCountdown.textContent = String(Math.max(0, remain));
      if (remain <= 0) { cleanup(); onDone && onDone(); }
    };
    skipMemoBtn && skipMemoBtn.addEventListener('click', onSkip);
    timer = setInterval(tick, 1000);
  }

  function setupTargets(state, ITEM_TYPES){
    const keys = Object.keys(ITEM_TYPES);
    const shuffled = keys.slice().sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 4);
    state.targets = targets;
    state.targetsSet = new Set(targets);
    if (memoList) {
      memoList.innerHTML = '';
      for (const k of targets) {
        const it = ITEM_TYPES[k];
        const label = k.replace(/_/g, ' ');
        const li = document.createElement('li');
        const img = it && it.imagePath ? `<img src="${it.imagePath}" alt="${label}" style="height:32px;margin-right:8px;vertical-align:middle;"/>` : '';
        li.innerHTML = `${img}<span>${label}</span>`;
        memoList.appendChild(li);
      }
    }
  }

  // 외부로 노출: 시작 플로우(메모 → 시작)
  API.begin = function(beginInitState, startGame, ITEM_TYPES){
    // beginInitState(mode) 는 main.js의 initState 래퍼를 주입 받는다고 가정
    beginInitState('score');
    if (!window.__game_state__) return;
    setupTargets(window.__game_state__, ITEM_TYPES || window.__ITEM_TYPES__);
    showMemoOverlay(10, () => { startGame(); });
  };

  // 업데이트(HUD/타이머)
  API.updateHUD = function(state){
    const timerTextEl = document.getElementById('timerText');
    const gapLabelEl = document.querySelector('.gap-label');
    const gameGaugeEl = document.getElementById('gameGauge');
    const dangerOverlay = document.getElementById('dangerOverlay');
    const speech = document.getElementById('speech');
    timerLabelEl && timerLabelEl.classList.remove('hidden');
    gapLabelEl && gapLabelEl.classList.add('hidden');
    gameGaugeEl && gameGaugeEl.classList.add('hidden');
    timerTextEl && (timerTextEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft))));
    if (dangerOverlay) dangerOverlay.style.opacity = '0';
    speech && speech.classList.add('hidden');
  };

  // 타이머 감소만 수행 (0 이하면 main.js가 endGame 호출)
  API.update = function(state, dt){
    state.timeLeft -= dt;
  };

  API.isOver = function(state){ return state.timeLeft <= 0; };

  // 점수 계산: 맞으면 +1, 아니면 0
  API.scoreForPick = function(state, picked){
    return state.targetsSet && state.targetsSet.has(picked.type.key) ? 1 : 0;
  };

  API.onPickAfter = function(state){};

  window.ScoreMode = API;
})();
