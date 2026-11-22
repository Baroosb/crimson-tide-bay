// Crimson Tide Bay — everything the eye receives.
// One job: draw the game. The static city is pre-rendered once to an
// offscreen canvas (water, sand, roads, buildings with their long
// south-east shadows, palms, lamps); each frame composites that layer,
// the living things on top of it, the golden-hour grade over everything,
// and finally the HUD and screens.

import { WORLD, PALETTE, CAR, repTier } from './config.js';
import { city } from './city.js';
import { DISTRICTS, districtCenter } from './districts.js';
import { police } from './police.js';
import { dispatchRows, dispatchChatter } from './dispatch.js';
import { drawPortrait, currentLine, CHARACTERS } from './crew.js';
import { WEAPONS } from './player.js';
import { applyGrade, lightPool } from './grading.js';
import { srand, rnd } from './random.js';

let staticLayer = null;

export function getStaticLayer() {
  return staticLayer || buildStaticLayer();
}

export function buildStaticLayer() {
  const c = document.createElement('canvas');
  c.width = WORLD.width; c.height = WORLD.height;
  const ctx = c.getContext('2d');
  srand(4242);

  // Water with a deep edge.
  const wg = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.3, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.62);
  wg.addColorStop(0, PALETTE.water);
  wg.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 130; k++) {
    const x = rnd() * WORLD.width, y = rnd() * WORLD.height;
    ctx.beginPath();
    ctx.arc(x, y, 14 + rnd() * 30, rnd() * 3, rnd() * 2 + 1.5);
    ctx.stroke();
  }

  // The island: wet rim, dry sand, foam line.
  const rim = 30;
  ctx.fillStyle = PALETTE.sandWet;
  roundRect(ctx, rim - 12, rim - 12, WORLD.width - rim * 2 + 24, WORLD.height - rim * 2 + 24, 90);
  ctx.fill();
  ctx.fillStyle = PALETTE.sand;
  roundRect(ctx, rim, rim, WORLD.width - rim * 2, WORLD.height - rim * 2, 84);
  ctx.fill();
  ctx.strokeStyle = PALETTE.waterFoam;
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 12]);
  roundRect(ctx, rim - 18, rim - 18, WORLD.width - rim * 2 + 36, WORLD.height - rim * 2 + 36, 96);
  ctx.stroke();
  ctx.setLineDash([]);
  // Sand speckle.
  ctx.fillStyle = 'rgba(160,110,50,0.18)';
  for (let k = 0; k < 900; k++) {
    ctx.fillRect(rnd() * WORLD.width, rnd() * WORLD.height, 2.4, 2.4);
  }

  drawRoads(ctx);
  drawBlocks(ctx);
  drawBeach(ctx);
  staticLayer = c;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRoads(ctx) {
  const gx = WORLD.sandRim, gy = WORLD.sandRim;
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(gx, gy, WORLD.gridW, WORLD.gridH);
  // Edge shading.
  ctx.fillStyle = PALETTE.roadEdge;
  for (let i = 0; i <= WORLD.blocksX; i++) {
    const x = gx + i * WORLD.pitch;
    ctx.fillRect(x, gy, 5, WORLD.gridH);
    ctx.fillRect(x + WORLD.roadWidth - 5, gy, 5, WORLD.gridH);
  }
  for (let j = 0; j <= WORLD.blocksY; j++) {
    const y = gy + j * WORLD.pitch;
    ctx.fillRect(gx, y, WORLD.gridW, 5);
    ctx.fillRect(gx, y + WORLD.roadWidth - 5, WORLD.gridW, 5);
  }
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  for (let i = 0; i <= WORLD.blocksX; i++) {
    const x = gx + i * WORLD.pitch + WORLD.roadWidth / 2;
    ctx.beginPath(); ctx.moveTo(x, gy + 8); ctx.lineTo(x, gy + WORLD.gridH - 8); ctx.stroke();
  }
  for (let j = 0; j <= WORLD.blocksY; j++) {
    const y = gy + j * WORLD.pitch + WORLD.roadWidth / 2;
    ctx.beginPath(); ctx.moveTo(gx + 8, y); ctx.lineTo(gx + WORLD.gridW - 8, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (let i = 0; i <= WORLD.blocksX; i++) {
    for (let j = 0; j <= WORLD.blocksY; j++) {
      const x = gx + i * WORLD.pitch, y = gy + j * WORLD.pitch;
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(x + 8 + s * 22, y + 3, 13, 9);
        ctx.fillRect(x + 8 + s * 22, y + WORLD.roadWidth - 12, 13, 9);
        ctx.fillRect(x + 3, y + 8 + s * 22, 9, 13);
        ctx.fillRect(x + WORLD.roadWidth - 12, y + 8 + s * 22, 9, 13);
      }
    }
  }
  // Asphalt wear.
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let k = 0; k < 260; k++) {
    ctx.fillRect(gx + rnd() * WORLD.gridW, gy + rnd() * WORLD.gridH, 20 + rnd() * 50, 3 + rnd() * 6);
  }
}

function drawBlocks(ctx) {
  for (const b of city.blocks) {
    // Sidewalk slab.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(b.x - 8, b.y - 8, WORLD.blockSize + 16, WORLD.blockSize + 16);
    ctx.strokeStyle = PALETTE.curb;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - 8, b.y - 8, WORLD.blockSize + 16, WORLD.blockSize + 16);
    if (b.kind === 'park') {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(b.x, b.y, WORLD.blockSize, WORLD.blockSize);
      ctx.strokeStyle = 'rgba(240,207,150,0.7)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + WORLD.blockSize / 2);
      ctx.lineTo(b.x + WORLD.blockSize, b.y + WORLD.blockSize / 2);
      ctx.moveTo(b.x + WORLD.blockSize / 2, b.y);
      ctx.lineTo(b.x + WORLD.blockSize / 2, b.y + WORLD.blockSize);
      ctx.stroke();
    } else if (b.kind === 'parking') {
      ctx.fillStyle = '#4a4c55';
      ctx.fillRect(b.x, b.y, WORLD.blockSize, WORLD.blockSize);
      ctx.strokeStyle = 'rgba(232,226,210,0.65)';
      ctx.lineWidth = 2;
      for (let s = 0; s < 5; s++) {
        ctx.strokeRect(b.x + 12 + s * 37, b.y + 16, 26, 52);
        ctx.strokeRect(b.x + 12 + s * 37, b.y + WORLD.blockSize - 68, 26, 52);
      }
    } else {
      ctx.fillStyle = '#cdbb9a';
      ctx.fillRect(b.x, b.y, WORLD.blockSize, WORLD.blockSize);
    }
  }
  for (const b of city.buildings) drawBuildingStatic(ctx, b);
  for (const p of city.palms) drawPalm(ctx, p.x, p.y, p.s);
  for (const l of city.lamps) lightPool(ctx, l.x, l.y, 30, 0.10);
  // The lighthouse.
  const lh = city.lighthouse;
  if (lh) {
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath(); ctx.ellipse(lh.x + 16, lh.y + 20, lh.r + 8, lh.r - 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r * 0.3, 0, Math.PI * 2); ctx.fill();
    lightPool(ctx, lh.x, lh.y, 74, 0.2);
  }
}

function drawBuildingStatic(ctx, b) {
  const shX = b.lift * 1.7, shY = b.lift * 2.3;
  // Long violet shadow toward the south-east.
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w + shX, b.y + shY * 0.4);
  ctx.lineTo(b.x + b.w + shX, b.y + b.h + shY);
  ctx.lineTo(b.x + shX, b.y + b.h + shY);
  ctx.lineTo(b.x, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  // South and east faces (the fake depth).
  ctx.fillStyle = '#a87a52';
  ctx.fillRect(b.x + shX * 0.42, b.y + b.h, b.w, b.lift * 0.62);
  ctx.fillStyle = '#8a5f3e';
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w + shX * 0.42, b.y + b.lift * 0.62);
  ctx.lineTo(b.x + b.w + shX * 0.42, b.y + b.h + b.lift * 0.62);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  // Roof.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // Parapet rim.
  ctx.strokeStyle = 'rgba(255,240,210,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
  ctx.strokeStyle = 'rgba(60,30,40,0.35)';
  ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
  // Roof props.
  for (const p of b.props) {
    const px = b.x + p.dx, py = b.y + p.dy;
    if (p.type === 'ac') {
      ctx.fillStyle = '#9aa0a4';
      ctx.fillRect(px, py, p.w, p.h);
      ctx.strokeStyle = '#5a6068';
      ctx.beginPath(); ctx.arc(px + p.w / 2, py + p.h / 2, Math.min(p.w, p.h) / 3, 0, Math.PI * 2); ctx.stroke();
    } else if (p.type === 'skylight') {
      ctx.fillStyle = '#a8d4e6';
      ctx.fillRect(px, py, p.w, p.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(px + 1, py + 1, p.w - 2, p.h - 2);
    } else if (p.type === 'tank') {
      ctx.fillStyle = '#7a5c40';
      ctx.beginPath(); ctx.ellipse(px + p.w / 2, py + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#93765a';
      ctx.beginPath(); ctx.ellipse(px + p.w / 2, py + p.h / 2, p.w / 3, p.h / 3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'pool') {
      ctx.fillStyle = '#37b6c9';
      roundRect(ctx, px, py, p.w + 6, p.h + 4, 5);
      ctx.fill();
    } else {
      ctx.fillStyle = '#6a6f76';
      ctx.fillRect(px, py, p.w * 0.7, p.h * 0.7);
    }
  }
  // Storefront sign on the south face.
  if (b.sign) {
    ctx.fillStyle = 'rgba(24,16,32,0.88)';
    const tw = Math.min(b.w - 10, b.sign.length * 6.4 + 12);
    ctx.fillRect(b.x + (b.w - tw) / 2, b.y + b.h + 1, tw, 13);
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.sign.toUpperCase(), b.x + b.w / 2, b.y + b.h + 11);
  }
}

function drawPalm(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(46,26,74,0.28)';
  ctx.beginPath(); ctx.ellipse(x + 13 * s, y + 15 * s, 17 * s, 6 * s, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a5c40';
  ctx.lineWidth = 3.4 * s;
  ctx.beginPath(); ctx.moveTo(x, y + 6 * s); ctx.quadraticCurveTo(x + 2 * s, y, x, y - 4 * s); ctx.stroke();
  ctx.strokeStyle = '#3f7d33';
  ctx.lineWidth = 2.6 * s;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y - 4 * s);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * 12 * s, y - 4 * s + Math.sin(a) * 8 * s - 4 * s,
      x + Math.cos(a) * 19 * s, y - 4 * s + Math.sin(a) * 13 * s + 3 * s,
    );
    ctx.stroke();
  }
}

function drawBeach(ctx) {
  // Umbrellas and towels on the sand rim.
  for (let k = 0; k < 40; k++) {
    const side = Math.floor(rnd() * 4);
    let x, y;
    if (side === 0) { x = 60 + rnd() * (WORLD.width - 120); y = 62 + rnd() * 60; }
    else if (side === 1) { x = 60 + rnd() * (WORLD.width - 120); y = WORLD.height - 122 + rnd() * 60; }
    else if (side === 2) { x = 62 + rnd() * 60; y = 60 + rnd() * (WORLD.height - 120); }
    else { x = WORLD.width - 122 + rnd() * 60; y = 60 + rnd() * (WORLD.height - 120); }
    ctx.fillStyle = 'rgba(46,26,74,0.25)';
    ctx.beginPath(); ctx.ellipse(x + 5, y + 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ['#d95f4b', '#2fa8a0', '#f4cf4a', '#c65b7c'][k % 4];
    ctx.beginPath(); ctx.arc(x, y, 9, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x, y - 9); ctx.closePath(); ctx.fill();
  }
}

// ---- Dynamic world --------------------------------------------------------

export function drawWorld(ctx, game) {
  if (!staticLayer) buildStaticLayer();
  const cam = game.camera;
  const vw = ctx.canvas.width, vh = ctx.canvas.height;
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(staticLayer, cam.x, cam.y, vw, vh, 0, 0, vw, vh);

  // Skid marks under the cars.
  ctx.strokeStyle = 'rgba(20,16,24,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const s of game.skids) {
    ctx.moveTo(s.x1 - cam.x, s.y1 - cam.y);
    ctx.lineTo(s.x2 - cam.x, s.y2 - cam.y);
  }
  ctx.stroke();

  drawMarkers(ctx, game);

  for (const ped of game.peds) drawPed(ctx, game, ped);
  for (const car of game.cars) if (!car.dead) drawCar(ctx, game, car);
  if (!game.player.car && !game.player.dead) drawPlayerFigure(ctx, game, game.player.x, game.player.y, game.player.angle, game.player.walkPhase, '#d95f4b');
  drawEffects(ctx, game);
  if (police.heli && game.state === 'play') drawHeli(ctx, game);
}

function drawMarkers(ctx, game) {
  const cam = game.camera;
  const t = game.time;
  const beacon = (x, y, color, label) => {
    const sx = x - cam.x, sy = y - cam.y;
    if (sx < -80 || sy < -80 || sx > ctx.canvas.width + 80 || sy > ctx.canvas.height + 80) return;
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, sy, 26 * pulse, 12 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
    const grad = ctx.createLinearGradient(0, sy - 150, 0, sy);
    grad.addColorStop(0, 'rgba(255,210,90,0)');
    grad.addColorStop(1, 'rgba(255,210,90,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 9, sy - 150, 18, 150);
    if (label) {
      ctx.fillStyle = 'rgba(16,10,24,0.8)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(label).width + 14;
      ctx.fillRect(sx - w / 2, sy - 178, w, 18);
      ctx.fillStyle = '#ffd98a';
      ctx.fillText(label, sx, sy - 165);
    }
  };
  const obj = game.objective();
  if (obj && obj.x !== null && game.state === 'play') beacon(obj.x, obj.y, '#ffd23e', null);
  const giver = game.missions.giverMark();
  if (giver && game.state === 'play' && game.missions.state === 'idle') {
    beacon(giver.x, giver.y, '#2fd4c4', (CHARACTERS[giver.label] || {}).name || 'WORK');
  }
  // Race checkpoints.
  if (game.races.active) {
    const cps = game.races.active.race.checkpoints;
    const cp = cps[game.races.active.playerCp % cps.length];
    beacon(cp.x, cp.y, '#7fe07a', 'CHECKPOINT');
  }
  // Crates for the collection stage.
  const stage = game.missions.stage && game.missions.stage();
  if (stage && stage.type === 'collect') {
    for (let i = game.missions.collected; i < stage.points.length; i++) {
      const pt = stage.points[i];
      const sx = pt.x - cam.x, sy = pt.y - cam.y;
      ctx.fillStyle = '#b07a3f';
      ctx.fillRect(sx - 9, sy - 9, 18, 18);
      ctx.strokeStyle = '#ffd98a';
      ctx.strokeRect(sx - 9, sy - 9, 18, 18);
      ctx.beginPath(); ctx.moveTo(sx - 9, sy - 9); ctx.lineTo(sx + 9, sy + 9); ctx.moveTo(sx + 9, sy - 9); ctx.lineTo(sx - 9, sy + 9); ctx.stroke();
    }
  }
}

export function drawCar(ctx, game, car) {
  const cam = game.camera;
  const x = car.x - cam.x, y = car.y - cam.y;
  if (x < -70 || y < -70 || x > ctx.canvas.width + 70 || y > ctx.canvas.height + 70) return;
  ctx.save();
  ctx.translate(x, y);
  // Ground shadow.
  ctx.fillStyle = 'rgba(30,16,50,0.35)';
  ctx.beginPath(); ctx.ellipse(5, 7, CAR.length * 0.55, CAR.width * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  const L = CAR.length, W = CAR.width;
  // Body with a lengthwise gradient.
  const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  const base = car.driver === 'cop' ? '#eef2ee' : car.color;
  g.addColorStop(0, shade(base, 28));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, -34));
  ctx.fillStyle = g;
  roundRect(ctx, -L / 2, -W / 2, L, W, 6);
  ctx.fill();
  if (car.driver === 'cop') {
    ctx.fillStyle = '#1d4e5e';
    ctx.fillRect(-L * 0.1, -W / 2, L * 0.34, W);
    // Light bar, flashing with the game clock.
    const on = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff4444' : '#3355ff';
    ctx.fillRect(-4, -W / 2 + 3, 8, 6);
    ctx.fillStyle = on ? '#3355ff' : '#ff4444';
    ctx.fillRect(-4, W / 2 - 9, 8, 6);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18,26,38,0.92)';
  roundRect(ctx, -L * 0.16, -W * 0.36, L * 0.4, W * 0.72, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,210,235,0.55)';
  roundRect(ctx, L * 0.08, -W * 0.32, L * 0.13, W * 0.64, 3);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161c';
  for (const [wx, wy] of [[-L * 0.32, -W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2], [L * 0.32, W / 2]]) {
    ctx.fillRect(wx - 5, wy - 2.5, 10, 5);
  }
  // Damage smoke and fire.
  if (car.burning > 0) {
    const f = 1 + Math.sin(game.time * 31) * 0.25;
    ctx.fillStyle = 'rgba(255,120,30,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, 13 * f, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,60,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, 7 * f, 0, Math.PI * 2); ctx.fill();
  } else if (car.health < 45) {
    ctx.fillStyle = 'rgba(40,40,48,0.5)';
    ctx.beginPath(); ctx.arc(L * 0.3, 0, 6 + Math.sin(game.time * 7) * 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // The target car of a steal job wears a marker.
  if (car.driver === 'target') {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', x, y - 30 + Math.sin(game.time * 5) * 3);
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

function drawPed(ctx, game, ped) {
  const cam = game.camera;
  const x = ped.x - cam.x, y = ped.y - cam.y;
  if (x < -30 || y < -30 || x > ctx.canvas.width + 30 || y > ctx.canvas.height + 30) return;
  if (ped.state === 'down') {
    ctx.fillStyle = 'rgba(30,16,30,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, 13, 6, ped.angle, 0, Math.PI * 2); ctx.fill();
    return;
  }
  drawFigure(ctx, x, y, ped.angle, ped.phase, ped.shirt, ped.skin);
}

export function drawPlayerFigure(ctx, game, wx, wy, angle, phase, shirt) {
  const cam = game.camera;
  drawFigure(ctx, wx - cam.x, wy - cam.y, angle, phase, shirt, '#8d5a3b', true);
}

function drawFigure(ctx, x, y, angle, phase, shirt, skin, isPlayer = false) {
  ctx.fillStyle = 'rgba(30,16,50,0.3)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(phase) * 1.6;
  // Legs.
  ctx.strokeStyle = '#2c2c38';
  ctx.lineWidth = 3.4;
  const lx = Math.cos(angle), ly = Math.sin(angle);
  const px = -ly, py = lx;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - lx * 4 + px * 3.4 + lx * bob, y - ly * 4 + py * 3.4 + ly * bob);
  ctx.moveTo(x, y);
  ctx.lineTo(x - lx * 4 - px * 3.4 - lx * bob, y - ly * 4 - py * 3.4 - ly * bob);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(x, y, 8.4, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(x + lx * 2.4, y + ly * 2.4, 5.2, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 12.4, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawEffects(ctx, game) {
  const cam = game.camera;
  // Bullets as tracers.
  ctx.strokeStyle = 'rgba(255,230,150,0.95)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const b of game.bullets) {
    ctx.moveTo(b.x - cam.x, b.y - cam.y);
    ctx.lineTo(b.x - b.vx * 0.016 - cam.x, b.y - b.vy * 0.016 - cam.y);
  }
  ctx.stroke();
  // Grenades.
  for (const gr of game.grenades) {
    ctx.fillStyle = '#2e4630';
    ctx.beginPath(); ctx.arc(gr.x - cam.x, gr.y - cam.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Muzzle flashes.
  for (const m of game.muzzles) {
    const x = m.x - cam.x, y = m.y - cam.y;
    ctx.fillStyle = 'rgba(255,190,70,0.9)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(m.angle) * 8, y + Math.sin(m.angle) * 8, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const p of game.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cam.x - p.size / 2, p.y - cam.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // Explosion flashes.
  for (const f of game.flashes) {
    const x = f.x - cam.x, y = f.y - cam.y;
    const r = f.r * (1 - f.life / f.maxLife) + 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,240,200,0.95)');
    g.addColorStop(0.4, 'rgba(255,140,40,0.75)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawHeli(ctx, game) {
  const cam = game.camera;
  const h = police.heli;
  const hx = h.x - cam.x, hy = h.y - cam.y;
  const p = game.playerPos();
  const px = p.x - cam.x, py = p.y - cam.y;
  // Spotlight cone to the player.
  const grad = ctx.createRadialGradient(px, py, 8, px, py, 120);
  grad.addColorStop(0, 'rgba(255,246,200,0.34)');
  grad.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(px - 66, py + 26);
  ctx.lineTo(px + 66, py + 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(px, py, 62, 0, Math.PI * 2); ctx.fill();
  // The aircraft, drawn big and high with its rotor blur.
  ctx.save();
  ctx.translate(hx, hy);
  ctx.fillStyle = 'rgba(30,16,50,0.3)';
  ctx.beginPath(); ctx.ellipse(16, 22, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(h.angle);
  ctx.fillStyle = '#22303c';
  roundRect(ctx, -26, -10, 52, 20, 9);
  ctx.fill();
  ctx.fillRect(-44, -3, 22, 6);
  ctx.fillStyle = 'rgba(160,220,245,0.8)';
  roundRect(ctx, 8, -7, 14, 14, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,240,250,0.5)';
  ctx.lineWidth = 3;
  const ra = game.time * 40;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * 40, Math.sin(ra) * 40);
  ctx.lineTo(-Math.cos(ra) * 40, -Math.sin(ra) * 40);
  ctx.stroke();
  ctx.restore();
}
