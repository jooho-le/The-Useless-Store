(() => {
  // Game constants
  const WIDTH = 800;
  const HEIGHT = 600;
  const LANES = 7; // 좌3 우3 + 중앙
  const LANE_W = WIDTH / LANES;
  const PLAYER_Y = HEIGHT - 80;
  const MOM_BASE_SPEED = 1; // gap per second
  const FEVER_THRESHOLD = 10;
  const FEVER_DURATION = 4500; // ms
  const BOOST_DURATION = 2400; // ms (시식코너)
  const MIN_GAP = 0; // game over when gap <= 0
  const START_GAP = 5; // 처음 시작 5칸 차이
  const MOVE_COOLDOWN = 120; // ms between lane moves

  const TIERS = [
    { key: 'wood', label: '나무', capacity: 5 },
    { key: 'iron', label: '철', capacity: 8 },
    { key: 'silver', label: '은', capacity: 11 },
    { key: 'gold', label: '금', capacity: 14 },
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
  const rand = (min, max) => Math.random() * (max - min) + min;

  // Cart tier persistence
  function getTierIndex() {
    const idx = parseInt(localStorage.getItem('cartTierIdx') || '0', 10);
    return clamp(idx, 0, TIERS.length - 1);
  }
  function setTierIndex(idx) {
    localStorage.setItem('cartTierIdx', String(clamp(idx, 0, TIERS.length - 1)));
  }

  // Game state
  let state = null;

  function initState() {
    const tierIdx = getTierIndex();
    const tier = TIERS[tierIdx];
    cartTierEl.textContent = tier.label;
    // Visual accent per tier
    canvas.classList.remove('tier-wood','tier-iron','tier-silver','tier-gold');
    canvas.classList.add(`tier-${tier.key}`);

    state = {
      running: false,
      over: false,
      time: performance.now(),
      playerLane: Math.floor(LANES / 2),
      lastMoveAt: 0,
      items: [],
      obstacles: [],
      boosters: [],
      score: 0,
      combo: 0,
      usedCapacity: 0,
      tierIdx,
      capacity: tier.capacity,
      momGap: START_GAP,
      momSpeed: MOM_BASE_SPEED,
      spawnTimer: 0,
      spawnEvery: 700, // ms, lower = faster
      fallBase: 180, // px/s base fall speed
      feverUntil: 0,
      boostUntil: 0,
    };
    updateHUD();
    drawScene(0);
  }

  function updateHUD() {
    scoreEl.textContent = String(state.score);
    comboEl.textContent = String(state.combo);
    capacityEl.textContent = `${state.usedCapacity}/${state.capacity}`;
    const maxGap = 12; // for bar scaling only
    const p = clamp(state.momGap / maxGap, 0, 1);
    gapFillEl.style.width = `${Math.round(p * 100)}%`;
    gapTextEl.textContent = String(Math.max(0, Math.ceil(state.momGap)));
    // Danger overlay intensifies when gap <= 2
    const dangerAlpha = clamp(1 - (state.momGap / 2), 0, 1);
    dangerOverlay.style.opacity = (dangerAlpha * 0.9).toFixed(2);
    if (state.momGap <= 2.2) {
      speech.classList.remove('hidden');
      // Optional: swap lines randomly
      if (Math.random() < 0.01) {
        const lines = [
          '거기 서! 계산하고 가! 💢',
          '비싼 건 안 돼! 💸',
          '손에 들고 있는 거 내려놔! 😤',
        ];
        speech.querySelector('.bubble').textContent = lines[Math.floor(Math.random()*lines.length)];
      }
    } else {
      speech.classList.add('hidden');
    }
  }

  // Input
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key);
  });

  function handleMovement(now) {
    if (now - state.lastMoveAt < MOVE_COOLDOWN) return;
    let moved = false;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
      state.playerLane = clamp(state.playerLane - 1, 0, LANES - 1);
      moved = true;
    } else if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
      state.playerLane = clamp(state.playerLane + 1, 0, LANES - 1);
      moved = true;
    }
    if (moved) state.lastMoveAt = now;
  }

  // Entities
  const TYPES_BY_VOLUME = {
    1: ['apple','snack','shampoo'],
    2: ['grapes','toaster','speaker'],
    3: ['tv','fridge','washing'],
  };

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function makeItem() {
    // Items: volume 1..3 lanes, price tier influences gap gain
    const r = Math.random();
    let volume = r < 0.6 ? 1 : (r < 0.9 ? 2 : 3);
    // Ensure at least one small item appears periodically by spawn logic elsewhere
    const maxStartLane = LANES - volume;
    const lane = Math.floor(Math.random() * (maxStartLane + 1));
    const priceTier = volume === 1 ? (Math.random() < 0.5 ? 1 : 2) : (volume === 2 ? 2 : 3);
    const type = pick(TYPES_BY_VOLUME[volume]);
    return { kind: 'item', lane, volume, y: -40, priceTier, type };
  }

  function makeObstacle() {
    // Obstacles: promo staff/customer taking 1 or 2 lanes
    const vol = Math.random() < 0.7 ? 1 : 2;
    const lane = Math.floor(Math.random() * (LANES - vol + 1));
    return { kind: 'obstacle', lane, volume: vol, y: -40, hit: false };
  }

  function makeBooster() {
    // Sampling counter: always 2 lanes
    const vol = 2;
    const lane = Math.floor(Math.random() * (LANES - vol + 1));
    return { kind: 'booster', lane, volume: vol, y: -40 };
  }

  function itemGapGain(item) {
    // Price tier influences gap gain (higher is better)
    switch (item.priceTier) {
      case 3: return 1.6; // luxury
      case 2: return 1.0;
      default: return 0.6;
    }
  }

  function itemCapacity(item) {
    // Volume equals capacity cost
    return item.volume;
  }

  // Spawn control ensures at least one volume-1 item every few spawns
  let smallItemGuarantee = 0;

  function spawn(dt) {
    state.spawnTimer += dt;
    const currentEvery = Math.max(260, state.spawnEvery - state.combo * 10 - (inFever() ? 180 : 0) - (inBoost() ? 140 : 0));
    if (state.spawnTimer >= currentEvery) {
      state.spawnTimer = 0;
      // Decide what to spawn: mostly items, sometimes obstacles/booster
      const roll = Math.random();
      if (roll < 0.75) {
        let it = makeItem();
        if (smallItemGuarantee >= 5) { it.volume = 1; it.lane = Math.floor(Math.random() * LANES); smallItemGuarantee = 0; }
        else smallItemGuarantee++;
        state.items.push(it);
      } else if (roll < 0.92) {
        state.obstacles.push(makeObstacle());
      } else {
        state.boosters.push(makeBooster());
      }
    }
  }

  function inFever() { return performance.now() < state.feverUntil; }
  function inBoost() { return performance.now() < state.boostUntil; }

  // Update
  function update(dtMs) {
    const dt = dtMs / 1000;

    // Mom approaches
    state.momGap -= state.momSpeed * dt;

    // Movement
    handleMovement(performance.now());

    // Spawn
    spawn(dtMs);

    // Fall speed scales with combo and fever/boost
    let fall = state.fallBase + state.combo * 6;
    if (inFever()) fall += 240;
    if (inBoost()) fall += 180;

    const playerLane = state.playerLane;
    // Update items
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      it.y += fall * dt;
      // Collect when overlapping player's footprint at bottom region
      if (it.y >= PLAYER_Y - 26) {
        const overlaps = (playerLane >= it.lane && playerLane < it.lane + it.volume) || inFever() || inBoost();
        if (overlaps) {
          // Capacity logic: during fever/boost, ignore capacity
          const capCost = inFever() || inBoost() ? 0 : itemCapacity(it);
          const wouldExceed = state.usedCapacity + capCost > state.capacity;
          // Always allow at least the first item after reset to fit by letting overflow but resetting speed
          if (wouldExceed && !(inFever() || inBoost())) {
            // Overflow penalty: reset combo/speed
            state.combo = 0;
            // but still collect the item
          } else {
            state.usedCapacity += capCost;
          }
          const gain = itemGapGain(it);
          state.momGap += gain;
          state.score += Math.round(gain * 10) * (1 + Math.floor(state.combo/10));
          state.combo += 1;
          // Fever trigger
          if (state.combo > 0 && state.combo % FEVER_THRESHOLD === 0) {
            state.feverUntil = performance.now() + FEVER_DURATION;
          }
          state.items.splice(i, 1);
          continue;
        } else if (it.y > HEIGHT + 40) {
          // Missed item
          state.combo = 0;
          state.items.splice(i, 1);
          continue;
        }
      } else if (it.y > HEIGHT + 60) {
        state.items.splice(i, 1);
      }
    }

    // Obstacles
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const ob = state.obstacles[i];
      ob.y += (fall * 0.92) * dt;
      if (ob.y >= PLAYER_Y - 26) {
        const hit = playerLane >= ob.lane && playerLane < ob.lane + ob.volume;
        if (hit && !ob.hit) {
          ob.hit = true;
          state.combo = 0;
          state.momGap -= 1.2; // mom gets closer
        }
      }
      if (ob.y > HEIGHT + 60) state.obstacles.splice(i, 1);
    }

    // Boosters (sampling corner)
    for (let i = state.boosters.length - 1; i >= 0; i--) {
      const b = state.boosters[i];
      b.y += (fall * 1.02) * dt;
      if (b.y >= PLAYER_Y - 26) {
        const hit = playerLane >= b.lane && playerLane < b.lane + b.volume;
        if (hit) {
          state.boostUntil = performance.now() + BOOST_DURATION;
          // Free quick items period: grant small immediate gap too
          state.momGap += 0.8;
          state.boosters.splice(i, 1);
          continue;
        }
      }
      if (b.y > HEIGHT + 60) state.boosters.splice(i, 1);
    }

    // Capacity quality-of-life: slowly bleed off (unload) a tiny amount over time to make space
    // Represents tossing items into the cart better or stacking tighter
    if (!inFever() && !inBoost()) {
      state.usedCapacity = Math.max(0, state.usedCapacity - dt * 0.25);
    }

    // Clamp + HUD
    state.momGap = Math.max(MIN_GAP - 0.0001, state.momGap); // allow slight negative to trigger end
    updateHUD();

    // Game over
    if (state.momGap <= MIN_GAP) {
      endGame();
    }
  }

  // Render
  function drawScene(dt) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Aisle lanes
    for (let i = 1; i < LANES; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const x = i * LANE_W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }

    // Draw entities
    function laneToX(l) { return l * LANE_W; }

    // Items
    for (const it of state.items) {
      const x = laneToX(it.lane) + 4;
      const w = it.volume * LANE_W - 8;
      const y = it.y;
      if (window.Sprites && window.Sprites.drawItem) {
        window.Sprites.drawItem(ctx, x, y, w, it.type);
      } else {
        ctx.fillStyle = '#8be9fd'; ctx.fillRect(x, y, w, 22);
      }
    }

    // Obstacles
    for (const ob of state.obstacles) {
      const x = laneToX(ob.lane) + 4;
      const w = ob.volume * LANE_W - 8;
      if (window.Sprites && window.Sprites.drawObstacle) {
        window.Sprites.drawObstacle(ctx, x, ob.y, w);
      } else {
        ctx.fillStyle = '#ff6b6b'; ctx.fillRect(x, ob.y, w, 20);
      }
    }

    // Boosters
    for (const b of state.boosters) {
      const x = laneToX(b.lane) + 4;
      const w = b.volume * LANE_W - 8;
      if (window.Sprites && window.Sprites.drawBooster) {
        window.Sprites.drawBooster(ctx, x, b.y, w);
      } else {
        ctx.fillStyle = '#59a7ff'; ctx.fillRect(x, b.y, w, 20);
      }
    }

    // Player cart marker
    const px = laneToX(state.playerLane) + LANE_W * 0.15;
    const tier = TIERS[state.tierIdx];
    if (window.Sprites && window.Sprites.drawCart) {
      window.Sprites.drawCart(ctx, px, PLAYER_Y, LANE_W * 0.7, tier.key);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(px, PLAYER_Y, LANE_W * 0.7, 18, 6); ctx.fill(); ctx.stroke();
    }

    // Fever/Boost glow indicator
    if (inFever() || inBoost()) {
      ctx.strokeStyle = inFever() ? 'rgba(255,199,76,0.9)' : 'rgba(89,167,255,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 6, PLAYER_Y - 6, LANE_W * 0.7 + 12, 18 + 12);
    }
  }

  // Main loop
  function tick(now) {
    if (!state.running) return;
    const dt = now - state.time;
    state.time = now;
    update(dt);
    drawScene(dt);
    requestAnimationFrame(tick);
  }

  function startGame() {
    if (!state) initState();
    state.running = true; state.over = false; state.time = performance.now();
    startScreen.classList.add('hidden');
    gameOver.classList.add('hidden');
    requestAnimationFrame(tick);
  }

  function endGame() {
    state.running = false;
    state.over = true;
    finalScoreEl.textContent = String(state.score);
    gameOver.classList.remove('hidden');
  }

  function retry() {
    initState();
    startGame();
  }

  function upgradeCart() {
    const next = Math.min(state.tierIdx + 1, TIERS.length - 1);
    if (next !== state.tierIdx) {
      setTierIndex(next);
    }
    initState();
    startGame();
  }

  // Buttons
  startBtn.addEventListener('click', () => {
    initState();
    startGame();
  });
  retryBtn.addEventListener('click', retry);
  upgradeBtn.addEventListener('click', upgradeCart);
  resetTierBtn.addEventListener('click', () => { setTierIndex(0); initState(); });

  // Bootstrap
  initState();
})();
