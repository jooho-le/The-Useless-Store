(() => {
  const WIDTH = 800;
  const HEIGHT = 1020;

  const MOM_BASE_SPEED = 0.45;
  const KID_BASE_SPEED = 0.9;
  const START_DISTANCE = 5;
  const MIN_DISTANCE = 0;
  const WARNING_DISTANCE = 2;

  const CAMERA_SPEED_BASE = 0.9;
  const CAMERA_SPEED_VOLUME_FACTOR = 0.12;
  const CAMERA_SPEED_MIN = 0.6;
  const CAMERA_SPEED_MAX = 1.6;
  const CAMERA_SPEED_EASING = 0.18;
  const CAMERA_SPEED_DECAY = 0.55;
  const FRIDGE_FRONT_SPEED_MULT = 1.35;
  const FRIDGE_AUTO_SPEED_MULT = 2.1;


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
  const gameGaugeFillEl = document.getElementById('gameGaugeFill');
  const gameGaugeEl = document.getElementById('gameGauge');
  const characterLayer = document.querySelector('.character-layer');
  const cartImg = characterLayer ? characterLayer.querySelector('.cart') : null;
  const personImg = characterLayer ? characterLayer.querySelector('.person') : null;
  const gapTextEl = document.getElementById('gapText');
  const gapLabelEl = document.querySelector('.gap-label');
  const startScreen = document.getElementById('startScreen');
  const gameOver = document.getElementById('gameOver');
  const startMomBtn = document.getElementById('startMomBtn');
  const startScoreBtn = document.getElementById('startScoreBtn');
  const retryBtn = document.getElementById('retryBtn');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const resetTierBtn = document.getElementById('resetTierBtn');
  const finalScoreEl = document.getElementById('finalScore');
  const speech = document.getElementById('speech');
  const dangerOverlay = document.getElementById('dangerOverlay');
  const timerTextEl = document.getElementById('timerText');
  const timerLabelEl = document.querySelector('.timer-label');
  const memoModal = document.getElementById('memoModal');
  const memoList = document.getElementById('memoList');
  const memoCountdown = document.getElementById('memoCountdown');
  const skipMemoBtn = document.getElementById('skipMemoBtn');
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

  function drawRoundedRectPath(ctx, x, y, w, h, r){
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  const FURNITURE_IMAGE_PATHS = {
    bookshelf: {
      left: 'assets/images/bookshelf_left.png',
      right: 'assets/images/bookshelf_right.png',
    },
    fridge: {
      left: 'assets/images/refrigerator_left.png',
      right: 'assets/images/refrigerator_right.png',
    },
  };
  let furnitureImages = null;
  let furnitureImagesReady = false;

  function loadImage(path){
    return new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = path;
    });
  }

  async function ensureFurnitureImages(){
    if (furnitureImages) return furnitureImages;
    const [bookshelfLeft, bookshelfRight, fridgeLeft, fridgeRight] = await Promise.all([
      loadImage(FURNITURE_IMAGE_PATHS.bookshelf.left),
      loadImage(FURNITURE_IMAGE_PATHS.bookshelf.right),
      loadImage(FURNITURE_IMAGE_PATHS.fridge.left),
      loadImage(FURNITURE_IMAGE_PATHS.fridge.right),
    ]);
    furnitureImages = {
      bookshelf: { left: bookshelfLeft, right: bookshelfRight },
      fridge: { left: fridgeLeft, right: fridgeRight },
    };
    return furnitureImages;
  }

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
  const ITEM_BASE_SIZE = 40;       // square size base (원근에 따라 스케일)

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
    let rect = { x, y, w: size, h: size };

    if (state && state.shelves && state.shelfIndex != null) {
      const frontShelf = state.shelves[state.shelfIndex];
      if (frontShelf && frontShelf.items && frontShelf.items.includes(item)) {
        if (state.furniture && state.furniture.length && currentFrontFurnitureType() === 'bookshelf') {
          const frontLayer = state.furniture[0];
          const placement = computeFurniturePlacement(frontLayer);
          if (placement) {
            const baseRect = item.side === 'L' ? placement.left : placement.right;
            if (baseRect) {
              if (item.level >= LEVELS_PER_SIDE || BOX_FLOOR_PX[item.level] == null) return null;
              // 엄마 모드와 동일한 원근 스케일을 유지
              const targetSize = ITEM_BASE_SIZE * scale * 2.5;
              const scaleX = baseRect.w / FURNITURE_CANONICAL.width;
              const scaleY = baseRect.h / FURNITURE_CANONICAL.height;
              const edgePx = BOX_EDGE_PX * scaleX;
              const floorPx = (BOX_FLOOR_PX[item.level] != null ? BOX_FLOOR_PX[item.level] : BOX_FLOOR_PX[0]) * scaleY;
              const floorY = baseRect.y + baseRect.h;
              const desiredX = item.side === 'L'
                ? baseRect.x + edgePx
                : baseRect.x + baseRect.w - edgePx - targetSize;
              const topAdjust = (item.level === LEVELS_PER_SIDE - 1) ? BOX_TOP_LEVEL_OFFSET * scaleY : 0;
              const desiredY = floorY - targetSize - floorPx + topAdjust;
              rect = {
                x: clamp(desiredX, baseRect.x, baseRect.x + baseRect.w - targetSize),
                y: clamp(desiredY, baseRect.y, floorY - targetSize),
                w: targetSize,
                h: targetSize,
              };
            }
          }
        }
      }
    }

    return rect;
  }

  // Item OOP model
  class ItemType {
    constructor(key, { score, volume, color = '#8be9fd', image = null } = {}){
      this.key = key; this.score = score; this.volume = volume; this.color = color; this.imagePath = image;
      this.image = null; this.imageLoaded = false; this.imageError = false;
      if (this.imagePath) this.loadImage();
    }
    loadImage(){
      if (!this.imagePath || this.image) return;
      const img = new Image();
      img.onload = () => { this.imageLoaded = true; };
      img.onerror = () => { this.imageError = true; };
      img.src = this.imagePath;
      this.image = img;
    }
    draw(ctx, rect, scale){
      if (this.imagePath && (!this.image || (!this.imageLoaded && !this.imageError))) {
        this.loadImage();
      }
      if (this.image && this.imageLoaded) {
        const naturalW = this.image.naturalWidth || this.image.width || rect.w;
        const naturalH = this.image.naturalHeight || this.image.height || rect.h;
        if (naturalW > 0 && naturalH > 0) {
          const aspect = naturalW / naturalH;
          let drawW = rect.w;
          let drawH = rect.h;
          if (aspect >= 1) {
            drawW = rect.w;
            drawH = rect.w / aspect;
            if (drawH > rect.h) {
              const s = rect.h / drawH;
              drawW *= s;
              drawH *= s;
            }
          } else {
            drawH = rect.h;
            drawW = rect.h * aspect;
            if (drawW > rect.w) {
              const s = rect.w / drawW;
              drawW *= s;
              drawH *= s;
            }
          }
          const dx = rect.x + (rect.w - drawW) / 2;
          const dy = rect.y + (rect.h - drawH) / 2;
          ctx.drawImage(this.image, dx, dy, drawW, drawH);
        } else {
          ctx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h);
        }
        return;
      }
      // Fallback: draw colored square matching clickable area
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
      if (!rect) return;
      const { scale } = computeShelfGeom(z);
      // 엄마 모드와 동일하게 원근 스케일 사용
      const drawScale = scale;
      this.type.draw(ctx, rect, drawScale);
    }
  }

  // Item type registry
  const ITEM_TYPES = {
    apple_bundle: new ItemType('apple_bundle', { score: 10, volume: 1, color: '#ff6b6b', image: 'assets/images/apple_bundle.png' }),
    apple:        new ItemType('apple',        { score: 9,  volume: 1, color: '#ff9b40', image: 'assets/images/apple.png' }),
    can_bundle:   new ItemType('can_bundle',   { score: 12, volume: 2, color: '#59a7ff', image: 'assets/images/can_bundle.png' }),
    can_set:      new ItemType('can_set',      { score: 14, volume: 2, color: '#50fa7b', image: 'assets/images/can_set.png' }),
    can:          new ItemType('can',          { score: 11, volume: 1, color: '#8be9fd', image: 'assets/images/can.png' }),
    snack_set:    new ItemType('snack_set',    { score: 13, volume: 2, color: '#fa77a4', image: 'assets/images/snack_set.png' }),
    snack:        new ItemType('snack',        { score: 9,  volume: 1, color: '#ffd36b', image: 'assets/images/snack.png' }),
    water_bundle: new ItemType('water_bundle', { score: 10, volume: 2, color: '#59a7ff', image: 'assets/images/water_bundle.png' }),
    water:        new ItemType('water',        { score: 8,  volume: 1, color: '#9060ff', image: 'assets/images/water.png' }),
  };

  function randomItemType(){
    const keys = Object.keys(ITEM_TYPES);
    return ITEM_TYPES[pick(keys)];
  }

  // Furniture perspective setup for alternating bookshelf/fridge pairs
  const FURNITURE_CANONICAL = { width: 339, height: 432 };
  const FURNITURE_SCALE = WIDTH / FURNITURE_CANONICAL.width;
  const FURNITURE_ORDER = ['bookshelf', 'fridge'];
  const FURNITURE_LAYER_TARGET = 4;
  const FURNITURE_BASE = {
    bookshelf: { width: 129, height: 290, fill: '#b0793a', stroke: '#70421c', highlight: 'rgba(255,230,180,0.24)' },
    fridge:    { width: 112, height: 302, fill: '#e4ecf6', stroke: '#9aa9ba', highlight: 'rgba(255,255,255,0.28)' },
  };
  const BOX_EDGE_OFFSET_RATIO = 57 / FURNITURE_CANONICAL.width;
  const BOX_EDGE_PX = 130;
  const BOX_FLOOR_PX = [160, 260, 360];
  const BOX_TOP_LEVEL_OFFSET = 24; // canonical px offset to lower top-shelf items
  const CART_IMAGES = {
    center: 'assets/images/cart.png',
    left: 'assets/images/cart_left.png',
    right: 'assets/images/cart_right.png',
  };
  const PERSON_IMAGES = {
    center: 'assets/images/person_front.png',
    left: 'assets/images/person_left2.png',
    right: 'assets/images/person_right2.png',
    left1: 'assets/images/person_left1.png',
    left2: 'assets/images/person_left2.png',
    right1: 'assets/images/person_right1.png',
    right2: 'assets/images/person_right2.png',
  };
  const PERSON_FRAME_DELAY = 80;
  const FURNITURE_PROFILES = {
    bookshelf: [
      { y: 0, width: 129, height: 290, edge: 0 },
      { y: 89, width: 87, height: 197, edge: 52 },
      { y: 177, width: 48, height: 106, edge: 105 },
      { y: 221, width: 27, height: 60, edge: 131 },
    ],
    fridge: [
      { y: 0, width: 112, height: 302, edge: 0 },
      { y: 155, width: 50, height: 136, edge: 93 },
      { y: 194, width: 34, height: 92, edge: 115 },
      { y: 236, width: 17, height: 45, edge: 141 },
    ],
  };

  const FURNITURE_MAX_PROFILE_Y = Math.max(
    ...Object.values(FURNITURE_PROFILES).flat().map((p) => p.y)
  );

  function sampleFurnitureProfile(type, y) {
    const records = FURNITURE_PROFILES[type];
    if (!records || !records.length) return null;
    if (y <= records[0].y) {
      const front = records[0];
      return { y, width: front.width, height: front.height, edge: front.edge };
    }
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const next = records[i];
      if (y <= next.y) {
        const span = Math.max(1, next.y - prev.y);
        const t = clamp((y - prev.y) / span, 0, 1);
        return {
          y,
          width: lerp(prev.width, next.width, t),
          height: lerp(prev.height, next.height, t),
          edge: lerp(prev.edge, next.edge, t),
        };
      }
    }
    const last = records[records.length - 1];
    const before = records[records.length - 2] || last;
    const span = Math.max(1, last.y - before.y);
    const t = (y - last.y) / span;
    return {
      y,
      width: Math.max(6, last.width + (last.width - before.width) * t),
      height: Math.max(12, last.height + (last.height - before.height) * t),
      edge: Math.max(0, last.edge + (last.edge - before.edge) * t),
    };
  }

  function currentFrontFurnitureType(){
    if (!state || !state.furniture || !state.furniture.length) return 'bookshelf';
    return state.furniture[0].type || 'bookshelf';
  }

  function computeFurniturePlacement(layer) {
    const sample = sampleFurnitureProfile(layer.type, layer.y);
    const base = FURNITURE_BASE[layer.type];
    if (!sample || !base) return null;
    const width = sample.width * FURNITURE_SCALE;
    const height = sample.height * FURNITURE_SCALE;
    if (width <= 0.1 || height <= 0.1) return null;
    const bottomY = HEIGHT - sample.y * FURNITURE_SCALE;
    const topY = bottomY - height;
    const scale = width / (base.width * FURNITURE_SCALE);
    const edgeOffset = sample.edge * FURNITURE_SCALE;
    return {
      scale: clamp(scale, 0.05, 1.1),
      base,
      left: { x: edgeOffset, y: topY, w: width, h: height },
      right: { x: WIDTH - edgeOffset - width, y: topY, w: width, h: height },
    };
  }

  function renderFurnitureRect(ctx, rect, base, type, scale, side) {
    const radius = Math.max(6, 12 * scale);
    const fill = base.fill || '#555';
    const stroke = base.stroke || '#222';
    const highlight = base.highlight || 'rgba(255,255,255,0.12)';
    const sheet = furnitureImages && furnitureImages[type];
    const img = sheet && side ? sheet[side] : null;
    const hasImage = furnitureImagesReady && img;

    if (hasImage) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.4 * scale);
      ctx.stroke();

      ctx.strokeStyle = highlight;
      ctx.lineWidth = Math.max(0.5, 0.9 * scale);
      const innerX = rect.x + radius * 0.15;
      const innerY = rect.y + radius * 0.15;
      const innerW = Math.max(rect.w - radius * 0.3, 4);
      const innerH = Math.max(rect.h - radius * 0.3, 4);
      drawRoundedRectPath(ctx, innerX, innerY, innerW, innerH, Math.max(2, radius * 0.6));
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.lineWidth = Math.max(0.8, scale);
      if (type === 'fridge') {
        ctx.strokeStyle = 'rgba(40,48,64,0.35)';
        const midY = rect.y + rect.h * 0.55;
        ctx.beginPath();
        ctx.moveTo(rect.x + 4, midY);
        ctx.lineTo(rect.x + rect.w - 4, midY);
        ctx.stroke();
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        const handleX = rect.x + rect.w * 0.82;
        ctx.beginPath();
        ctx.moveTo(handleX, rect.y + rect.h * 0.2);
        ctx.lineTo(handleX, rect.y + rect.h * 0.45);
        ctx.stroke();
      } else if (type === 'bookshelf') {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        const shelfCount = 4;
        for (let i = 1; i < shelfCount; i++) {
          const y = rect.y + (rect.h * i) / shelfCount;
          ctx.beginPath();
          ctx.moveTo(rect.x + rect.w * 0.08, y);
          ctx.lineTo(rect.x + rect.w * 0.92, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function drawFurnitureBackdrop(ctx) {
    if (!state || !state.furniture || !state.furniture.length) return;
    ctx.save();
    ctx.lineJoin = 'round';
    for (let i = state.furniture.length - 1; i >= 0; i--) {
      const layer = state.furniture[i];
      const placement = computeFurniturePlacement(layer);
      if (!placement) continue;
      renderFurnitureRect(ctx, placement.left, placement.base, layer.type, placement.scale, 'left');
      renderFurnitureRect(ctx, placement.right, placement.base, layer.type, placement.scale, 'right');
    }
    ctx.restore();
  }

  function initFurnitureQueue() {
    const slots = [];
    let nextIndex = 0;
    for (let i = 0; i < FURNITURE_LAYER_TARGET; i++) {
      const type = FURNITURE_ORDER[nextIndex];
      const profile = FURNITURE_PROFILES[type];
      const sample = profile ? profile[Math.min(i, profile.length - 1)] : null;
      slots.push({
        type,
        y: sample ? sample.y : 0,
      });
      nextIndex = (nextIndex + 1) % FURNITURE_ORDER.length;
    }
    return { slots, nextIndex };
  }

  function prepareFurnitureAdvance(targetState) {
    if (!targetState || !targetState.furniture || !targetState.furniture.length) return;
    const currentSlots = targetState.furniture;
    const startY = currentSlots.map((slot) => slot.y);
    const nextSlots = currentSlots.slice(1);
    const addType = FURNITURE_ORDER[targetState.furnitureNextIndex];
    targetState.furnitureNextIndex = (targetState.furnitureNextIndex + 1) % FURNITURE_ORDER.length;
    const addProfile = FURNITURE_PROFILES[addType];
    const addInfo = addProfile ? (addProfile[FURNITURE_LAYER_TARGET - 1] || addProfile[addProfile.length - 1]) : { y: FURNITURE_MAX_PROFILE_Y };
    nextSlots.push({ type: addType, y: addInfo.y });
    const targetY = nextSlots.map((slot, idx) => {
      const profile = FURNITURE_PROFILES[slot.type];
      const info = profile ? (profile[idx] || profile[profile.length - 1]) : { y: 0 };
      return info.y;
    });
    const start = nextSlots.map((slot, idx) => {
      if (idx < startY.length - 1) return startY[idx + 1];
      return slot.y;
    });
    targetState.furnitureTween = { start, target: targetY };
    for (let i = 0; i < nextSlots.length; i++) {
      nextSlots[i].y = start[i];
    }
    targetState.furniture = nextSlots;
  }

  function applyFurnitureTween(targetState, progress) {
    if (!targetState || !targetState.furnitureTween) return;
    const tween = targetState.furnitureTween;
    const slots = targetState.furniture;
    for (let i = 0; i < slots.length; i++) {
      const start = tween.start[i];
      const end = tween.target[i];
      slots[i].y = lerp(start, end, progress);
    }
    if (progress >= 1) {
      for (let i = 0; i < slots.length; i++) {
        slots[i].y = tween.target[i];
      }
      targetState.furnitureTween = null;
    }
  }

  // Game state
  let state = null;
  let cartPoseTimer = null;
  let personPoseTimers = [];

  function initState(modeParam = null) {
    // mode: 'mom' = 엄마의 분노(기존), 'score' = 점수제(메모/타이머)
    const mode = (modeParam || (state && state.mode) || 'mom');
    const tierIdx = getTierIndex();
    const tier = TIERS[tierIdx];
    cartTierEl.textContent = tier.label;
    canvas.classList.remove('tier-wood','tier-iron','tier-silver','tier-gold');
    canvas.classList.add(`tier-${tier.key}`);

    state = {
      running: false,
      over: false,
      time: performance.now(),
      mode,
      // shelf world
      shelves: [],        // [{ z, items: [{slot, type, collected}] }]
      cameraZ: 0,
      shelfIndex: 0,
      transients: [],     // transient item animations during transition
      furniture: [],
      furnitureNextIndex: 0,
      // scoring/capacity
      score: 0,
      combo: 0,
      speedModifier: CAMERA_SPEED_BASE,
      speedTarget: CAMERA_SPEED_BASE,
      usedCapacity: 0,
      tierIdx,
      capacity: tier.capacity,
      momGap: START_DISTANCE,      // [엄마 모드] 현재 엄마와의 거리(칸 단위)
      momWarningActive: false,     // [엄마 모드] 경고 음성/말풍선 활성화 여부
      // score mode extras
      timeLeft: 60,
      targets: [],
      targetsSet: null,
      autoAdvance: false,
    };

    const furnitureInit = initFurnitureQueue();
    state.furniture = furnitureInit.slots;
    state.furnitureNextIndex = furnitureInit.nextIndex;
    state.furnitureTween = null;

    characterLayer && characterLayer.classList.remove('visible');
    resetCartPose();

    // Seed shelves
    state.shelves = [makeShelf(0), makeShelf(1)];
    ensureShelfAhead();
    updateHUD();
    drawScene(0);
  }

  function updateHUD() {
    scoreEl.textContent = String(state.score);
    comboEl.textContent = String(state.combo);
    capacityEl.textContent = `${state.capacity}`;
    if (state.mode === 'mom') {
      // 엄마 모드: 거리 게이지/경고 표시
      timerLabelEl && timerLabelEl.classList.add('hidden');
      gapLabelEl && gapLabelEl.classList.remove('hidden');
      gameGaugeEl && gameGaugeEl.classList.remove('hidden');
      const fillRatio = clamp((START_DISTANCE - state.momGap) / Math.max(START_DISTANCE, 0.0001), 0, 1);
      if (gameGaugeFillEl) {
        if (fillRatio <= 0) {
          gameGaugeFillEl.classList.add('empty');
          gameGaugeFillEl.style.width = '0%';
        } else {
          const pct = clamp(fillRatio, 0, 1) * 100;
          gameGaugeFillEl.classList.remove('empty');
          gameGaugeFillEl.style.width = `${pct.toFixed(1)}%`;
        }
      }
      gapTextEl.textContent = String(Math.max(0, Math.ceil(state.momGap)));
      const dangerAlpha = clamp(1 - (state.momGap / 2), 0, 1);
      dangerOverlay.style.opacity = (dangerAlpha * 0.9).toFixed(2);
      const inWarning = state.momGap <= WARNING_DISTANCE;
      if (inWarning && !state.momWarningActive) playSound(sounds.momVoice);
      state.momWarningActive = inWarning;
      if (inWarning) speech.classList.remove('hidden');
      else speech.classList.add('hidden');
    } else {
      // 점수제: 타이머만 표시, 경고/거리 게이지 숨김, 오버레이 끔
      timerLabelEl && timerLabelEl.classList.remove('hidden');
      gapLabelEl && gapLabelEl.classList.add('hidden');
      gameGaugeEl && gameGaugeEl.classList.add('hidden');
      timerTextEl && (timerTextEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft))));
      dangerOverlay.style.opacity = '0';
      speech.classList.add('hidden');
    }
  }

  function setPersonImage(poseKey = 'center') {
    if (!personImg) return;
    const src = PERSON_IMAGES[poseKey] || PERSON_IMAGES.center;
    personImg.src = src;
  }

  function clearPersonPoseTimers() {
    if (!personPoseTimers.length) return;
    for (const timer of personPoseTimers) {
      clearTimeout(timer);
    }
    personPoseTimers = [];
  }

  function setCartPose(pose = 'center', { skipPerson = false } = {}) {
    if (!cartImg) return;
    cartImg.src = CART_IMAGES[pose] || CART_IMAGES.center;
    if (!personImg || skipPerson) return;
    if (pose === 'center') {
      clearPersonPoseTimers();
    }
    const personPose = pose === 'left' ? 'left2' : pose === 'right' ? 'right2' : 'center';
    setPersonImage(personPose);
  }

  function resetCartPose() {
    if (cartPoseTimer) {
      clearTimeout(cartPoseTimer);
      cartPoseTimer = null;
    }
    setCartPose('center');
  }

  function animatePersonSide(side) {
    if (!personImg) return;
    clearPersonPoseTimers();
    const frames = side === 'L' ? ['left1', 'left2'] : ['right1', 'right2'];
    setPersonImage(frames[0]);
    const timer = setTimeout(() => {
      setPersonImage(frames[1]);
    }, PERSON_FRAME_DELAY);
    personPoseTimers.push(timer);
  }

  function flashCartPose(side) {
    if (!cartImg || !personImg) return;
    const pose = side === 'L' ? 'left' : 'right';
    setCartPose(pose, { skipPerson: true });
    animatePersonSide(side);
    if (cartPoseTimer) clearTimeout(cartPoseTimer);
    cartPoseTimer = setTimeout(() => {
      cartPoseTimer = null;
      setCartPose('center');
    }, 320);
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
    state.speedTarget = Math.max(CAMERA_SPEED_BASE, state.speedTarget - CAMERA_SPEED_DECAY * dt);
    const desiredSpeed = clamp(state.speedTarget, CAMERA_SPEED_MIN, CAMERA_SPEED_MAX);
    const lerpFactor = clamp(dt * 60 * CAMERA_SPEED_EASING, 0, 1);
    state.speedModifier = lerp(state.speedModifier, desiredSpeed, lerpFactor);
    if (state.mode === 'mom') {
      state.momGap -= MOM_BASE_SPEED * dt;
      state.momGap = Math.max(MIN_DISTANCE - 0.0001, state.momGap);
      updateHUD();
      if (state.momGap <= MIN_DISTANCE) endGame();
    } else {
      state.timeLeft -= dt;
      updateHUD();
      if (state.timeLeft <= 0) endGame();
    }
  }

  function drawScene(dt){
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const cx = WIDTH/2;
    const cy = HEIGHT * 0.65; // horizon-ish baseline

    const frontFurnitureType = currentFrontFurnitureType();
    const canDrawShelfItems = frontFurnitureType !== 'fridge';

    // ground fade
    const grd = ctx.createLinearGradient(0, cy-200, 0, HEIGHT);
    grd.addColorStop(0, 'rgba(255,255,255,0.04)');
    grd.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = grd; ctx.fillRect(0, cy-200, WIDTH, HEIGHT-(cy-200));

    drawFurnitureBackdrop(ctx);

    // visible bays
    for (let i = state.shelfIndex; i < state.shelves.length; i++) {
      const shelf = state.shelves[i];
      const z = shelf.z - state.cameraZ;
      if (z < -0.001) continue;
      const { scale } = computeShelfGeom(z);
      const isFrontShelf = i === state.shelfIndex;

      // Compute left/right shelf rectangles (endless feel)
      // geometry computed in computeShelfGeom

      // Draw three horizontal boards per side to convey 3 tiers
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = Math.max(1, 2*scale);

      // items per level and side
      if (canDrawShelfItems && isFrontShelf) {
        for (const it of shelf.items) {
          if (it.collected) continue;
          it.draw(ctx, z);
        }
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
          if (!rect) continue;
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
    characterLayer && characterLayer.classList.add('visible');
    resetCartPose();
    requestAnimationFrame(tick);
  }

  function endGame(){
    state.running = false; state.over = true;
    stopDuringMusic();
    playOpeningMusic();
    finalScoreEl.textContent = String(state.score);
    gameOver.classList.remove('hidden');
    characterLayer && characterLayer.classList.remove('visible');
    resetCartPose();
    if (state && state.nextAdvanceTimer) { clearTimeout(state.nextAdvanceTimer); state.nextAdvanceTimer = null; }
    // submit score if logged in
    const t = getToken();
    if (t) {
      api('/scores', { method: 'POST', body: JSON.stringify({ score: state.score }) }).catch(()=>{});
    }
  }

  function retry(){
    if (state && state.nextAdvanceTimer) { clearTimeout(state.nextAdvanceTimer); state.nextAdvanceTimer = null; }
    initState(state && state.mode ? state.mode : 'mom');
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

  // Buttons (mode selection)
  startMomBtn && startMomBtn.addEventListener('click', () => { initState('mom'); startGame(); });
  startScoreBtn && startScoreBtn.addEventListener('click', () => { beginScoreModeFlow(); });
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
    if (currentFrontFurnitureType() === 'fridge') return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const picked = pickItemUnderCursor(x, y);
    if (!picked) return;
    flashCartPose(picked.side);
    // Build transient animations for current shelf items at click time
    const shelf = state.shelves[state.shelfIndex];
    const z = shelf.z - state.cameraZ;
    const cx = WIDTH / 2;
    const bottomPad = 40;
    const targetSize = 40;
    for (const it of shelf.items) {
      if (it.collected) continue;
      const r = computeItemRect(z, it);
      if (!r) {
        it.collected = true;
        continue;
      }
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
    // 적재 용량/콤보/속도/점수 계산(두 모드 공통 규칙)
    // - 용량 초과: 콤보/속도 초기화, 점수 페널티
    // - 정상 담기: 콤보 증가, 속도 소폭 증가, 점수 가산, 포장 소리
    const vol = picked.type.volume;
    if (vol > state.capacity) {
      state.combo = 0;
      state.speedModifier = CAMERA_SPEED_BASE;
      state.speedTarget = CAMERA_SPEED_BASE;
      const baseScore = -5;
      state.score += baseScore * (1 + Math.floor(state.combo/10));
      // too big: ignore pick (no collection)
    }
    else {
      picked.collected = true;
      state.combo += 1;
      const volumeBoost = picked.type?.volume || 1;
      const target = CAMERA_SPEED_BASE + volumeBoost * CAMERA_SPEED_VOLUME_FACTOR;
      state.speedTarget = clamp(target, CAMERA_SPEED_MIN, CAMERA_SPEED_MAX);
      const baseScore = picked.type.score || 10;
      if (state.mode === 'score') {
        // 점수제: 메모에 있는 아이템만 +1, 그 외 0점
        const ok = state.targetsSet && state.targetsSet.has(picked.type.key);
        if (ok) state.score += 1;
      } else {
        // 엄마 모드: 기존 점수 공식 유지
        state.score += baseScore * (1 + Math.floor(state.combo/10));
      }
      playSound(sounds.packing);
    }
    if (state.mode === 'mom') {
      state.momGap += 1; // 담을수록 엄마와의 거리 벌어짐(엄마 모드 전용)
    }

    // Spawn next shelf(s) immediately at click to avoid waiting for tween end
    while (state.shelves.length < state.shelfIndex + 4) {
      state.shelves.push(makeShelf(state.shelves.length));
    }
    tweenToNextShelf();
  });

  function pickItemUnderCursor(x, y){
    if (currentFrontFurnitureType() === 'fridge') return null;
    const shelf = state.shelves[state.shelfIndex];
    if (!shelf) return null;
    const z = shelf.z - state.cameraZ;

    for (const it of shelf.items) {
      if (it.collected) continue;
      const r = computeItemRect(z, it);
      if (!r) continue;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return it;
      }
    }
    return null;
  }

  function tweenToNextShelf({ auto = false, speedMultiplier = null } = {}){
    const startZ = state.cameraZ;
    const endZ = (state.shelfIndex+1) * SHELF_GAP;
    const t0 = performance.now();
    prepareFurnitureAdvance(state);
    const frontType = currentFrontFurnitureType();
    const baseSpeed = clamp(state.speedModifier, CAMERA_SPEED_MIN, CAMERA_SPEED_MAX);
    const typeMultiplier = frontType === 'fridge' ? FRIDGE_FRONT_SPEED_MULT : 1;
    const effectiveSpeed = baseSpeed * (speedMultiplier || 1) * typeMultiplier;
    const tweenSpeed = Math.max(CAMERA_SPEED_MIN, Math.min(CAMERA_SPEED_MAX * 2, effectiveSpeed));
    function step(t){
      if (!state.running) return;
      const p = Math.min(1, (t - t0) * KID_BASE_SPEED * tweenSpeed * 0.001);
      const progress = p;
      state.cameraZ = lerp(startZ, endZ, progress);
      applyFurnitureTween(state, progress);
      if (p >= 1) {
        state.shelfIndex++;
        ensureShelfAhead();
        applyFurnitureTween(state, 1);
        const nextFront = currentFrontFurnitureType();
        if (nextFront === 'fridge' && state.running) {
          // 냉장고 구간은 즉시 자동 통과(기존 동작 유지)
          tweenToNextShelf({ auto: true, speedMultiplier: FRIDGE_AUTO_SPEED_MULT });
          return;
        }
        drawScene(0);
        return;
      }
      drawScene(0);
      requestAnimationFrame(step);
    }
    step(performance.now());
  }

  // Bootstrap
  ensureFurnitureImages()
    .catch(() => null)
    .finally(() => {
      furnitureImagesReady = true;
      initState('mom');
      refreshUserUI();
      playOpeningMusic();
      window.addEventListener('pointerdown', () => {
        if (!state || state.running) return;
        if (sounds.opening && sounds.opening.paused) playOpeningMusic();
      }, { once: true });
    });
  
  // Score mode helpers
  function beginScoreModeFlow(){
    initState('score');
    setupScoreTargets();
    showMemoOverlay(10, () => {
      startGame();
    });
  }

  function setupScoreTargets(){
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
      if (remain <= 0) {
        cleanup();
        onDone && onDone();
      }
    };
    skipMemoBtn && skipMemoBtn.addEventListener('click', onSkip);
    timer = setInterval(tick, 1000);
  }

  function scheduleNextScoreAdvance(delayMs){
    if (!state || !state.running) return;
    if (state.nextAdvanceTimer) clearTimeout(state.nextAdvanceTimer);
    state.nextAdvanceTimer = setTimeout(() => {
      if (!state || !state.running) return;
      // 이동 속도를 완만하게 하여 선택 시간을 확보
      tweenToNextShelf({ auto: true, speedMultiplier: 1.0 });
    }, Math.max(0, delayMs|0));
  }
})();
