(() => {
  // Canvas size (matches index.html)
  const WIDTH = 800;
  const HEIGHT = 600;

  // Config
  const MOM_BASE_SPEED = 1;
  const KID_BASE_SPEED = 1;
  const START_DISTANCE = 5;
  const MIN_DISTANCE = 0;
  const WARNING_DISTANCE = 2;


  // Shelf/3D config
  const LEVELS_PER_SIDE = 3;    // left: 3 levels, right: 3 levels (total 6 slots)
  const SHELF_GAP = 10;          // distance between bays (world units)
  const SHELF_FLOOR_GAP = 80;
  const FOV = 400;              // pseudo perspective focal length

  // Cart tier/capacity (UI uses these)
  const TIERS = [
    { key: 'wood',   label: 'WOOD',   capacity: 1 },
    { key: 'iron',   label: 'IRON',   capacity: 2 },
    { key: 'silver', label: 'SILVER', capacity: 3 },
    { key: 'gold',   label: 'GOLD',   capacity: 4 },
  ];

  // DOM elements
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const cartTierEl = document.getElementById('cartTier');
  const capacityEl = document.getElementById('capacity');
  const gapFillEl = document.getElementById('gapFill');
  const gapTextEl = document.getElementById('gapText');
  const startScreen = document.getElementById('startScreen');
  const gameOver = document.getElementById('gameOver');
  const startBtn = document.getElementById('startBtn');
  const retryBtn = document.getElementById('retryBtn');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const resetTierBtn = document.getElementById('resetTierBtn');
  const finalScoreEl = document.getElementById('finalScore');
  const speech = document.getElementById('speech');
  const dangerOverlay = document.getElementById('dangerOverlay');
  // Auth/UI elements
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmailEl = document.getElementById('userEmail');
  const myScoreBtn = document.getElementById('myScoreBtn');
  const authModal = document.getElementById('authModal');
  const authName = document.getElementById('authName');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const doLogin = document.getElementById('doLogin');
  const doSignup = document.getElementById('doSignup');
  const closeAuth = document.getElementById('closeAuth');
  const authMsg = document.getElementById('authMsg');
  const myScores = document.getElementById('myScores');
  const bestScoreEl = document.getElementById('bestScore');
  const recentScoresEl = document.getElementById('recentScores');
  const closeScores = document.getElementById('closeScores');

  // Audio setup
  function makeAudio(src, { loop = false } = {}) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = 'auto';
    return audio;
  }

  function playSound(audio, { reset = true } = {}) {
    if (!audio) return;
    if (reset) {
      audio.pause();
      audio.currentTime = 0;
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }

  function stopSound(audio, { reset = true } = {}) {
    if (!audio) return;
    audio.pause();
    if (reset) audio.currentTime = 0;
  }

  const sounds = {
    opening: makeAudio('assets/sounds/opening.mp3', { loop: true }),
    during: makeAudio('assets/sounds/during.mp3', { loop: true }),
    momVoice: makeAudio('assets/sounds/momvoice.mp3'),
    packing: makeAudio('assets/sounds/packing.wav'),
    upgrade1: makeAudio('assets/sounds/upgrade1.wav'),
    upgrade2: makeAudio('assets/sounds/upgrade2.wav'),
  };

  function playOpeningMusic() {
    playSound(sounds.opening);
  }

  function stopOpeningMusic() {
    stopSound(sounds.opening);
  }

  function startDuringMusic() {
    playSound(sounds.during);
  }

  function stopDuringMusic() {
    stopSound(sounds.during);
  }

  function playUpgradeSequence() {
    const { upgrade1, upgrade2 } = sounds;
    if (!upgrade1 || !upgrade2) return;
    stopSound(upgrade1);
    stopSound(upgrade2);
    upgrade1.addEventListener('ended', () => {
      playSound(upgrade2);
    }, { once: true });
    playSound(upgrade1);
  }

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const easeOutCubic = (t)=>1 - Math.pow(1-t,3);

  // API helpers
  const API_BASE = (window.API_BASE || '').trim() || '/api';
  const tokenKey = 'authToken';
  function getToken(){ return localStorage.getItem(tokenKey) || null; }
  function setToken(t){ if (t) localStorage.setItem(tokenKey, t); }
  function clearToken(){ localStorage.removeItem(tokenKey); }
  async function api(path, opts={}){
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers||{});
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const res = await fetch(`${API_BASE}${path}`, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw Object.assign(new Error('api_error'), { status: res.status, data });
    return data;
  }

  async function refreshUserUI(){
    const t = getToken();
    if (!t) {
      userEmailEl.textContent = '';
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
      return;
    }
    try {
      const me = await api('/auth/me').catch(() => null);
      const email = me && me.user ? me.user.email : '';
      userEmailEl.textContent = email;
      loginBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
    } catch (_) {
      clearToken();
      userEmailEl.textContent = '';
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
    }
  }

  // Cart tier persistence
  function getTierIndex() {
    const idx = parseInt(localStorage.getItem('cartTierIdx') || '0', 10);
    return clamp(idx, 0, TIERS.length - 1);
  }
  function setTierIndex(idx) {
    localStorage.setItem('cartTierIdx', String(clamp(idx, 0, TIERS.length - 1)));
  }

  // Random pick helper
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // Shared drawing/picking layout constants
  const LAYOUT_MARGIN = 50;        // matches drawScene
  const LAYOUT_SHELF_WIDTH = 250;  // matches drawScene
  const LAYOUT_BASE_OFF = 110;     // matches drawScene
  const ITEM_BASE_SIZE = 40;       // square size base (scales with perspective)

  function computeShelfGeom(z){
    const cx = WIDTH / 2;
    const cy = HEIGHT * 0.65;
    const scale = FOV / (FOV + z * 100);
    const leftX = cx - (cx - LAYOUT_MARGIN) * scale;
    const leftW = LAYOUT_SHELF_WIDTH * scale;
    const rightX = cx + (cx - LAYOUT_MARGIN) * scale - leftW;
    return { cx, cy, scale, leftX, leftW, rightX };
  }

  // Compute the on-screen square rect for an item on a shelf: {x,y,w,h}
  function computeItemRect(shelfZ, item){
    const { cy, scale, leftX, leftW, rightX } = computeShelfGeom(shelfZ);
    const yBoard = cy + (LAYOUT_BASE_OFF - item.level * SHELF_FLOOR_GAP) * scale - 50;
    const sx = (item.side === 'L') ? (leftX + leftW/2) : (rightX + leftW/2);
    const size = ITEM_BASE_SIZE * scale;
    const x = sx - size / 2;
    const y = yBoard - 10 * scale;
    return { x, y, w: size, h: size };
  }

  // Item OOP model
  class ItemType {
    constructor(key, { score, volume, color = '#8be9fd', image = null } = {}){
      this.key = key; this.score = score; this.volume = volume; this.color = color; this.image = image;
    }
    draw(ctx, rect, scale){
      // Placeholder: draw colored square matching clickable area
      ctx.fillStyle = this.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  class Item {
    constructor({ side, level, type }){
      this.side = side; this.level = level; this.type = type; this.collected = false;
    }
    draw(ctx, z){
      const rect = computeItemRect(z, this);
      const { scale } = computeShelfGeom(z);
      this.type.draw(ctx, rect, scale);
    }
  }

  // Item type registry
  const ITEM_TYPES = {
    apple:   new ItemType('apple',   { score: 10, volume: 1, color: '#8be9fd' }),
    snack:   new ItemType('snack',   { score: 10, volume: 1, color: '#fa77a4' }),
    shampoo: new ItemType('shampoo', { score: 12, volume: 2, color: '#9060ff' }),
    grapes:  new ItemType('grapes',  { score: 12, volume: 2, color: '#7cff70' }),
    toaster: new ItemType('toaster', { score: 18, volume: 3, color: '#a7b0bd' }),
    speaker: new ItemType('speaker', { score: 22, volume: 3, color: '#50fa7b' }),
    tv:      new ItemType('tv',      { score: 35, volume: 4, color: '#ffd36b' }),
    fridge:  new ItemType('fridge',  { score: 45, volume: 4, color: '#cfd9e6' }),
    washing: new ItemType('washing', { score: 40, volume: 5, color: '#59a7ff' }),
  };

  function randomItemType(){
    const keys = Object.keys(ITEM_TYPES);
    return ITEM_TYPES[pick(keys)];
  }

  // Game state
  let state = null;

  function initState() {
    const tierIdx = getTierIndex();
    const tier = TIERS[tierIdx];
    cartTierEl.textContent = tier.label;
    canvas.classList.remove('tier-wood','tier-iron','tier-silver','tier-gold');
    canvas.classList.add(`tier-${tier.key}`);

    state = {
      running: false,
      over: false,
      time: performance.now(),
      // shelf world
      shelves: [],        // [{ z, items: [{slot, type, collected}] }]
      cameraZ: 0,
      shelfIndex: 0,
      transients: [],     // transient item animations during transition
      // scoring/capacity
      score: 0,
      combo: 0,
      speedModifier: 1,
      usedCapacity: 0,
      tierIdx,
      capacity: tier.capacity,
      momGap: START_DISTANCE,
      momWarningActive: false
    };

    // Seed shelves
    state.shelves = [makeShelf(0), makeShelf(1)];
    ensureShelfAhead();
    updateHUD();
    drawScene(0);
  }

  function updateHUD() {
    scoreEl.textContent = String(state.score);
    comboEl.textContent = String(state.combo);
    // Show only cart capacity (size limit)
    capacityEl.textContent = `${state.capacity}`;
    const maxGap = 12; // for bar scaling only
    const p = clamp(state.momGap / maxGap, 0, 1);
    gapFillEl.style.width = `${Math.round(p * 100)}%`;
    gapTextEl.textContent = String(Math.max(0, Math.ceil(state.momGap)));
    // Danger overlay intensifies when gap <= 2
    const dangerAlpha = clamp(1 - (state.momGap / 2), 0, 1);
    dangerOverlay.style.opacity = (dangerAlpha * 0.9).toFixed(2);
    const inWarning = state.momGap <= WARNING_DISTANCE;
    if (inWarning && !state.momWarningActive) {
      playSound(sounds.momVoice);
    }
    state.momWarningActive = inWarning;

    if (inWarning) {
      speech.classList.remove('hidden');
    } else {
      speech.classList.add('hidden');
    }
  }

  function makeShelf(i){
    const items = [];
    // Left side 3 levels, Right side 3 levels
    for (let level = 0; level < LEVELS_PER_SIDE; level++) {
      items.push(new Item({ side: 'L', level, type: randomItemType() }));
      items.push(new Item({ side: 'R', level, type: randomItemType() }));
    }
    return { z: i * SHELF_GAP, items };
  }

  function ensureShelfAhead(){
    while (state.shelves.length < state.shelfIndex + 3) {
      state.shelves.push(makeShelf(state.shelves.length));
    }
  }

  function update(dtMs){
    const dt = dtMs / 1000;
    state.momGap -= MOM_BASE_SPEED * dt;
    state.momGap = Math.max(MIN_DISTANCE - 0.0001, state.momGap);
    updateHUD();
    if (state.momGap <= MIN_DISTANCE) endGame();
  }

  function drawScene(dt){
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const cx = WIDTH/2;
    const cy = HEIGHT * 0.65; // horizon-ish baseline

    // ground fade
    const grd = ctx.createLinearGradient(0, cy-200, 0, HEIGHT);
    grd.addColorStop(0, 'rgba(255,255,255,0.04)');
    grd.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = grd; ctx.fillRect(0, cy-200, WIDTH, HEIGHT-(cy-200));

    // visible bays
    for (let i = state.shelfIndex; i < state.shelves.length; i++) {
      const shelf = state.shelves[i];
      const z = shelf.z - state.cameraZ;
      if (z < -0.001) continue;
      const { scale } = computeShelfGeom(z);

      // Compute left/right shelf rectangles (endless feel)
      // geometry computed in computeShelfGeom

      // Draw three horizontal boards per side to convey 3 tiers
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = Math.max(1, 2*scale);

      // items per level and side
      for (const it of shelf.items) {
        if (it.collected) continue;
        it.draw(ctx, z);
      }
    }

    // Transient item animations (rendered on top)
    if (state.transients && state.transients.length) {
      const now = performance.now();
      const remain = [];
      for (const tr of state.transients) {
        if (tr.kind === 'picked') {
          const p = clamp((now - tr.t0) / tr.dur, 0, 1);
          const t = easeOutCubic(p);
          const rect = {
            x: lerp(tr.start.x, tr.end.x, t),
            y: lerp(tr.start.y, tr.end.y, t),
            w: lerp(tr.start.w, tr.end.w, t),
            h: lerp(tr.start.h, tr.end.h, t),
          };
          const { scale } = computeShelfGeom(0);
          tr.type.draw(ctx, rect, scale);
          if (p < 1) remain.push(tr);
        } else if (tr.kind === 'exit') {
          // Follow the shelf/camera path (world-space). Stop once behind camera.
          const z = tr.shelfZ - state.cameraZ;
          if (z <= 0) {
            continue; // shelf has passed the camera; drop this transient
          }
          const dummy = { side: tr.side, level: tr.level };
          const rect = computeItemRect(z, dummy);
          const { scale } = computeShelfGeom(z);
          tr.type.draw(ctx, rect, scale);
          if (rect.y <= HEIGHT + 80) {
            remain.push(tr);
          }
        }
      }
      state.transients = remain;
    }
  }

  // Main loop
  function tick(now){
    if (!state.running) return;
    const dt = now - state.time; state.time = now;
    update(dt);
    drawScene(dt);
    requestAnimationFrame(tick);
  }

  function startGame(){
    if (!state) initState();

    state.running = true;
    state.over = false;
    state.time = performance.now();
    stopOpeningMusic();
    startDuringMusic();

    startScreen.classList.add('hidden');
    startScreen.classList.remove('visible');
    gameOver.classList.add('hidden');
    requestAnimationFrame(tick);
  }

  function endGame(){
    state.running = false; state.over = true;
    stopDuringMusic();
    playOpeningMusic();
    finalScoreEl.textContent = String(state.score);
    gameOver.classList.remove('hidden');
    // submit score if logged in
    const t = getToken();
    if (t) {
      api('/scores', { method: 'POST', body: JSON.stringify({ score: state.score }) }).catch(()=>{});
    }
  }

  function retry(){
    initState();
    startGame();
  }

  function upgradeCart(){
    const next = Math.min(state.tierIdx + 1, TIERS.length - 1);
    if (next !== state.tierIdx) {
      setTierIndex(next);
      playUpgradeSequence();
    }
    initState();
    startGame();
  }

  // Buttons
  startBtn.addEventListener('click', () => { initState(); startGame(); });
  retryBtn.addEventListener('click', retry);
  upgradeBtn.addEventListener('click', upgradeCart);
  resetTierBtn.addEventListener('click', () => { setTierIndex(0); initState(); });
  // Auth controls
  loginBtn && loginBtn.addEventListener('click', () => { authModal.classList.remove('hidden'); authMsg.textContent=''; });
  closeAuth && closeAuth.addEventListener('click', () => { authModal.classList.add('hidden'); });
  logoutBtn && logoutBtn.addEventListener('click', () => { clearToken(); refreshUserUI(); });
  doLogin && doLogin.addEventListener('click', async () => {
    authMsg.textContent = '';
    try {
      const out = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: authEmail.value, password: authPassword.value }) });
      setToken(out.token);
      authModal.classList.add('hidden');
      refreshUserUI();
    } catch (e) { authMsg.textContent = e?.data?.error || '로그인 실패'; }
  });
  doSignup && doSignup.addEventListener('click', async () => {
    authMsg.textContent = '';
    try {
      const out = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ name: authName.value, email: authEmail.value, password: authPassword.value }) });
      setToken(out.token);
      authModal.classList.add('hidden');
      refreshUserUI();
    } catch (e) { authMsg.textContent = e?.data?.error || '회원가입 실패'; }
  });
  myScoreBtn && myScoreBtn.addEventListener('click', async () => {
    const t = getToken();
    if (!t) { authModal.classList.remove('hidden'); return; }
    try {
      const out = await api('/scores/my');
      bestScoreEl.textContent = String(out.best || 0);
      recentScoresEl.innerHTML = '';
      for (const row of out.recent || []) {
        const li = document.createElement('li');
        const dt = new Date(row.created_at);
        li.innerHTML = `<span>${dt.toLocaleString()}</span><strong>${row.score}</strong>`;
        recentScoresEl.appendChild(li);
      }
      myScores.classList.remove('hidden');
    } catch (_) { /* ignore */ }
  });
  closeScores && closeScores.addEventListener('click', () => { myScores.classList.add('hidden'); });

  // Click-to-pick and advance
  canvas.addEventListener('click', (e) => {
    if (!state || state.over) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const picked = pickItemUnderCursor(x, y);
    if (!picked) return;
    // Build transient animations for current shelf items at click time
    const shelf = state.shelves[state.shelfIndex];
    const z = shelf.z - state.cameraZ;
    const cx = WIDTH / 2;
    const bottomPad = 40;
    const targetSize = 40;
    for (const it of shelf.items) {
      if (it.collected) continue;
      const r = computeItemRect(z, it);
      if (it === picked) {
        const endSize = Math.max(targetSize, r.w);
        state.transients.push({
          kind: 'picked',
          type: it.type,
          start: r,
          end: { x: cx - endSize/2, y: HEIGHT - bottomPad - endSize, w: endSize, h: endSize },
          t0: performance.now(),
          dur: 380,
        });
      } else {
        state.transients.push({
          kind: 'exit',
          type: it.type,
          side: it.side,
          level: it.level,
          shelfZ: shelf.z,
        });
      }
      // prevent shelf renderer from drawing again; transients handle visibility
      it.collected = true;
    }
    // Volume-based capacity (no stacking UI). Penalty for oversize will be added later.
    const vol = picked.type.volume;
    if (vol > state.capacity) {
      state.combo = 0;
      state.speedModifier = 1;
      const baseScore = -5;
      state.score += baseScore * (1 + Math.floor(state.combo/10));
      // too big: ignore pick (no collection)
    }
    else {
      picked.collected = true;
      state.combo += 1;
      state.speedModifier += 0.02;
      const baseScore = picked.type.score || 10;
      state.score += baseScore * (1 + Math.floor(state.combo/10));
      playSound(sounds.packing);
    }
    state.momGap += 1; // gain some distance on pick

    // Spawn next shelf(s) immediately at click to avoid waiting for tween end
    while (state.shelves.length < state.shelfIndex + 4) {
      state.shelves.push(makeShelf(state.shelves.length));
    }
    tweenToNextShelf();
  });

  function pickItemUnderCursor(x, y){
    const shelf = state.shelves[state.shelfIndex];
    if (!shelf) return null;
    const z = shelf.z - state.cameraZ;

    for (const it of shelf.items) {
      if (it.collected) continue;
      const r = computeItemRect(z, it);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return it;
      }
    }
    return null;
  }

  function tweenToNextShelf(){
    const startZ = state.cameraZ;
    const endZ = (state.shelfIndex+1) * SHELF_GAP;
    const t0 = performance.now();
    function step(t){
      if (!state.running) return;
      const p = Math.min(1, (t - t0) * KID_BASE_SPEED * state.speedModifier * 0.001);
      state.cameraZ = lerp(startZ, endZ, easeOutCubic(p));
      drawScene(0);
      if (p < 1) requestAnimationFrame(step);
      else {
        state.shelfIndex++;
        ensureShelfAhead();
      }
    }
    requestAnimationFrame(step);
  }

  // Bootstrap
  initState();
  refreshUserUI();
  playOpeningMusic();
  window.addEventListener('pointerdown', () => {
    if (!state || state.running) return;
    if (sounds.opening && sounds.opening.paused) playOpeningMusic();
  }, { once: true });
})();
