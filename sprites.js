// Minimal canvas-drawn placeholder sprites for the demo.
// No external assets; everything is lines/shapes.

(function(){
  const TAU = Math.PI * 2;

  function rnd(n){ return Math.random()*n; }

  function drawApple(ctx, x, y, w){
    const h = 22; const r = Math.min(w, h) * 0.45;
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.strokeStyle = '#ff6060'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,96,96,0.15)';
    ctx.beginPath();
    ctx.moveTo(-r*0.9, 0);
    ctx.bezierCurveTo(-r, -r*0.6, -r*0.3, -r*0.9, 0, -r*0.8);
    ctx.bezierCurveTo(r*0.3, -r*0.9, r, -r*0.6, r*0.9, 0);
    ctx.bezierCurveTo(r*0.9, r*0.9, 0, r*1.0, 0, r*0.9);
    ctx.bezierCurveTo(0, r*1.0, -r*0.9, r*0.9, -r*0.9, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // stem
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -r*0.8); ctx.lineTo(r*0.1, -r*1.2); ctx.stroke();
    // leaf
    ctx.strokeStyle = '#66dd88'; ctx.fillStyle = 'rgba(102,221,136,0.25)';
    ctx.beginPath(); ctx.ellipse(r*0.25, -r*1.05, r*0.25, r*0.14, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawGrapes(ctx, x, y, w){
    const h = 20; const r = Math.min(8, w*0.12);
    ctx.save();
    ctx.translate(x + w/2, y + 10);
    ctx.fillStyle = 'rgba(136,255,128,0.15)'; ctx.strokeStyle = '#7cff70'; ctx.lineWidth = 2.4;
    const grid = [
      [-2,0],[-1,0],[0,0],[1,0],[2,0],
      [-1.5,-1],[-0.5,-1],[0.5,-1],[1.5,-1],
      [-1,-2],[0,-2],[1,-2]
    ];
    for(const [gx,gy] of grid){
      ctx.beginPath(); ctx.arc(gx*r*1.4, gy*r*1.2, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // stem
    ctx.strokeStyle = '#5bc472'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-r*1.2, -r*3.0); ctx.quadraticCurveTo(0, -r*3.5, r*1.2, -r*3.0); ctx.stroke();
    ctx.restore();
  }

  function drawTV(ctx, x, y, w){
    const h = 22;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,211,107,0.12)'; ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(1.5, 1.5, w-3, h-5, 4); ctx.fill(); ctx.stroke();
    // stand
    ctx.strokeStyle = '#b38d3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w*0.2, h-6); ctx.lineTo(w*0.8, h-6); ctx.stroke();
    ctx.restore();
  }

  function drawFridge(ctx, x, y, w){
    const h = 26;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(233,238,244,0.12)'; ctx.strokeStyle = '#cfd9e6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(1.5, 1.5, w-3, h-3, 4); ctx.fill(); ctx.stroke();
    // divider
    ctx.strokeStyle = 'rgba(207,217,230,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(3, h*0.55); ctx.lineTo(w-3, h*0.55); ctx.stroke();
    // handle
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w-8, 7); ctx.lineTo(w-8, 14); ctx.stroke();
    ctx.restore();
  }

  function drawWasher(ctx, x, y, w){
    const h = 24; const r = Math.min(w, h) * 0.28;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(89,167,255,0.10)'; ctx.strokeStyle = '#59a7ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(1.5, 1.5, w-3, h-3, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2, h/2+1, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawSnack(ctx, x, y, w){
    const h = 16; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(250,119,164,0.10)'; ctx.strokeStyle = '#fa77a4'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(1.5, 1.5, w-3, h-3, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawShampoo(ctx, x, y, w){
    const h = 22; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(144,  96, 255, 0.12)'; ctx.strokeStyle = '#9060ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(4, 6, w-8, h-8, 6); ctx.fill(); ctx.stroke();
    // cap
    ctx.beginPath(); ctx.roundRect(w/2-8, 2, 16, 6, 2); ctx.stroke();
    ctx.restore();
  }

  function drawToaster(ctx, x, y, w){
    const h = 18; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(167, 180, 193, 0.12)'; ctx.strokeStyle = '#a7b0bd'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(1.5, 4, w-3, h-4, 6); ctx.fill(); ctx.stroke();
    // slot
    ctx.strokeStyle = 'rgba(167,176,189,0.9)';
    ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(w-6, 6); ctx.stroke();
    ctx.restore();
  }

  function drawSpeaker(ctx, x, y, w){
    const h = 22; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(80,250,123,0.10)'; ctx.strokeStyle = '#50fa7b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(1.5, 1.5, w-3, h-3, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2, h*0.35, 3.5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2, h*0.7, 6, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawObstacle(ctx, x, y, w){
    // Red human-ish blocker
    const h = 20; ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,107,107,0.10)';
    ctx.beginPath(); ctx.arc(w*0.5, 6, 5, 0, TAU); ctx.fill(); ctx.stroke(); // head
    ctx.beginPath(); ctx.roundRect(w*0.25, 12, w*0.5, h-12, 4); ctx.fill(); ctx.stroke(); // body
    ctx.restore();
  }

  function drawBooster(ctx, x, y, w){
    // Blue tasting table with steam
    const h = 18; ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#59a7ff'; ctx.fillStyle = 'rgba(89,167,255,0.10)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(1.5, 6, w-3, h-6, 4); ctx.fill(); ctx.stroke();
    // steam lines
    ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(8, 4); ctx.quadraticCurveTo(12, -2, 16, 4);
    ctx.moveTo(w/2-4, 4); ctx.quadraticCurveTo(w/2, -2, w/2+4, 4);
    ctx.moveTo(w-16, 4); ctx.quadraticCurveTo(w-12, -2, w-8, 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawCart(ctx, x, y, w, tierKey){
    const h = 18; const pad = 2; const colorByTier = {
      wood: '#c8b08a', iron: '#a7b0bd', silver: '#e9eef4', gold: '#ffd36b'
    };
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.fillStyle = colorByTier[tierKey] || '#ffffff';
    // cart body
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 6); ctx.fill(); ctx.stroke();
    // handle
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.moveTo(w-6, 2); ctx.lineTo(w, -4); ctx.stroke();
    ctx.restore();
  }

  const itemDrawers = {
    apple: drawApple,
    grapes: drawGrapes,
    tv: drawTV,
    fridge: drawFridge,
    washing: drawWasher,
    snack: drawSnack,
    shampoo: drawShampoo,
    toaster: drawToaster,
    speaker: drawSpeaker,
  };

  function drawItem(ctx, x, y, w, type){
    (itemDrawers[type] || drawSnack)(ctx, x, y, w);
  }

  window.Sprites = { drawItem, drawObstacle, drawBooster, drawCart };
})();
