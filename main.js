(() => {
  // Canvas size (matches index.html)
  const WIDTH = 800;
  const HEIGHT = 600;
  const MOM_BASE_SPEED = 1;     // gap per second
  const MIN_GAP = 0;            // game over when gap <= 0
  const START_GAP = 5;

  // Shelf/3D config
  const LEVELS_PER_SIDE = 3;    // left: 3 levels, right: 3 levels (total 6 slots)
  const SHELF_GAP = 6;          // distance between bays (world units)
  const FOV = 400;              // pseudo perspective focal length
  const ADVANCE_MS = 500;       // tween duration on click

  // Cart tier/capacity (UI uses these)
  const TIERS = [
    { key: 'wood',  label: 'WOOD',  capacity: 5 },
    { key: 'iron',  label: 'IRON',  capacity: 8 },
    { key: 'silver',label: 'SILVER',capacity: 11},
    { key: 'gold',  label: 'GOLD',  capacity: 14},
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

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const easeOutCubic = (t)=>1 - Math.pow(1-t,3);

  // Cart tier persistence
  function getTierIndex() {
    const idx = parseInt(localStorage.getItem('cartTierIdx') || '0', 10);
    return clamp(idx, 0, TIERS.length - 1);
  }
  function setTierIndex(idx) {
    localStorage.setItem('cartTierIdx', String(clamp(idx, 0, TIERS.length - 1)));
  }

  // Item types (sprites.js supports these)
  const TYPES = ['apple','snack','shampoo','grapes','toaster','speaker','tv','fridge','washing'];
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

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
      // scoring/capacity
      score: 0,
      combo: 0,
      usedCapacity: 0,
      tierIdx,
      capacity: tier.capacity,
      momGap: START_GAP,
      momSpeed: MOM_BASE_SPEED,
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
    capacityEl.textContent = `${Math.round(state.usedCapacity)}/${state.capacity}`;
    const maxGap = 12; // for bar scaling only
    const p = clamp(state.momGap / maxGap, 0, 1);
    gapFillEl.style.width = `${Math.round(p * 100)}%`;
    gapTextEl.textContent = String(Math.max(0, Math.ceil(state.momGap)));
    // Danger overlay intensifies when gap <= 2
    const dangerAlpha = clamp(1 - (state.momGap / 2), 0, 1);
    dangerOverlay.style.opacity = (dangerAlpha * 0.9).toFixed(2);
    if (state.momGap <= 2.2) {
      speech.classList.remove('hidden');
    } else {
      speech.classList.add('hidden');
    }
  }

  function makeShelf(i){
    const items = [];
    // Left side 3 levels, Right side 3 levels
    for (let level = 0; level < LEVELS_PER_SIDE; level++) {
      items.push({ side: 'L', level, type: pick(TYPES), collected: false });
      items.push({ side: 'R', level, type: pick(TYPES), collected: false });
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
    state.momGap -= state.momSpeed * dt;
    state.momGap = Math.max(MIN_GAP - 0.0001, state.momGap);
    updateHUD();
    if (state.momGap <= MIN_GAP) endGame();
  }

  function drawScene(dt){
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const cx = WIDTH/2;
    const cy = HEIGHT*0.65; // horizon-ish baseline

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
      const scale = FOV / (FOV + z*100);

      // Compute left/right shelf rectangles (endless feel)
      const margin = 80;            // how close shelves hug the screen edge
      const shelfWidth = 120;       // base width before perspective
      const leftX = cx - (cx - margin) * scale;
      const leftW = shelfWidth * scale;
      const rightX = cx + (cx - margin) * scale - leftW;

      // Draw three horizontal boards per side to convey 3 tiers
      const baseOff = 110;  // base vertical offset from horizon
      const gapOff = 40;    // gap between tiers
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = Math.max(1, 2*scale);
      for (let lvl = 0; lvl < LEVELS_PER_SIDE; lvl++) {
        const yBoard = cy - (baseOff - lvl*gapOff) * scale;
        // left board
        ctx.beginPath(); ctx.moveTo(leftX, yBoard); ctx.lineTo(leftX + leftW, yBoard); ctx.stroke();
        // right board
        ctx.beginPath(); ctx.moveTo(rightX, yBoard); ctx.lineTo(rightX + leftW, yBoard); ctx.stroke();
      }

      // items per level and side
      for (const it of shelf.items) {
        if (it.collected) continue;
        const yBoard = cy - (baseOff - it.level*gapOff) * scale;
        const sx = (it.side === 'L') ? (leftX + leftW/2) : (rightX + leftW/2);
        const sy = yBoard - 10*scale;
        const w = 70*scale;
        if (window.Sprites && window.Sprites.drawItem) {
          window.Sprites.drawItem(ctx, sx - w/2, sy, w, it.type);
        } else {
          ctx.fillStyle = '#8be9fd'; ctx.fillRect(sx - w/2, sy, w, 22*scale);
        }
      }
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
    state.running = true; state.over = false; state.time = performance.now();
    // fully hide start screen regardless of class order
    startScreen.classList.add('hidden');
    startScreen.classList.remove('visible');
    gameOver.classList.add('hidden');
    requestAnimationFrame(tick);
  }

  function endGame(){
    state.running = false; state.over = true;
    finalScoreEl.textContent = String(state.score);
    gameOver.classList.remove('hidden');
  }

  function retry(){
    initState();
    startGame();
  }

  function upgradeCart(){
    const next = Math.min(state.tierIdx + 1, TIERS.length - 1);
    if (next !== state.tierIdx) setTierIndex(next);
    initState();
    startGame();
  }

  function closeStartScreen(){
    startScreen.classList.remove('visible');
    startScreen.classList.add('hidden');
  }

  // Buttons
  startBtn.addEventListener('click', () => { closeStartScreen(); initState(); startGame(); });
  retryBtn.addEventListener('click', retry);
  upgradeBtn.addEventListener('click', upgradeCart);
  resetTierBtn.addEventListener('click', () => { setTierIndex(0); initState(); });

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
    picked.collected = true;

    // scoring/capacity
    const capCost = 1;
    if (state.usedCapacity + capCost <= state.capacity) {
      state.usedCapacity += capCost;
    } else {
      state.combo = 0; // overflow penalty
    }
    state.combo += 1;
    state.score += 10 * (1 + Math.floor(state.combo/10));
    state.momGap += 0.8; // gain some distance on pick

    tweenToNextShelf();
  });

  function pickItemUnderCursor(x, y){
    const shelf = state.shelves[state.shelfIndex];
    if (!shelf) return null;
    const cx = WIDTH/2; const cy = HEIGHT*0.65;
    const z = shelf.z - state.cameraZ; const scale = FOV/(FOV + z*100);
    const margin = 80; const shelfWidth = 120; const leftX = cx - (cx - margin) * scale; const leftW = shelfWidth * scale; const rightX = cx + (cx - margin) * scale - leftW;
    const baseOff = 110; const gapOff = 40;
    let best = null, bestD2 = Infinity;
    for (const it of shelf.items) {
      if (it.collected) continue;
      const yBoard = cy - (baseOff - it.level*gapOff) * scale;
      const sx = (it.side === 'L') ? (leftX + leftW/2) : (rightX + leftW/2);
      const sy = yBoard - 10*scale;
      const r = 36*scale; const d2 = (x - sx)**2 + (y - sy)**2;
      if (d2 < r*r && d2 < bestD2) { best = it; bestD2 = d2; }
    }
    return best;
  }

  function tweenToNextShelf(){
    const startZ = state.cameraZ;
    const endZ = (state.shelfIndex+1) * SHELF_GAP;
    const t0 = performance.now();
    function step(t){
      if (!state.running) return;
      const p = Math.min(1, (t - t0)/ADVANCE_MS);
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
})();
