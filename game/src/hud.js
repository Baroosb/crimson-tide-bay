// Crimson Tide Bay — the interface: HUD, dispatch panel, screens.
// One job: everything drawn over the world — the mission card, the
// police dispatch readout with live distances, the minimap, banners,
// dialogue boxes, district title cards, and the full screens (poster
// title with save slots, the island map, pause, BUSTED, WASTED).

import { WORLD, repTier, REP_TIERS } from './config.js';
import { DISTRICTS, districtCenter } from './districts.js';
import { city } from './city.js';
import { police } from './police.js';
import { dispatchRows, dispatchChatter } from './dispatch.js';
import { drawPortrait, currentLine } from './crew.js';
import { WEAPONS, unlockedWeaponList } from './player.js';
import { getStaticLayer } from './render.js';
import { missionProgress } from './missions.js';

export function panel(ctx, x, y, w, h, alpha = 0.74) {
  ctx.fillStyle = `rgba(13,9,22,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,205,130,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

// ---- HUD ------------------------------------------------------------------

export function drawHUD(ctx, game) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  drawMissionCard(ctx, game);
  drawStatusCluster(ctx, game, W);
  if (game.wanted > 0) drawDispatch(ctx, game, H);
  drawMinimap(ctx, game, W, H);
  drawVehicleCluster(ctx, game, W, H);
  drawObjectiveArrow(ctx, game, W, H);
  if (game.bannerData) drawBanner(ctx, game, W);
  if (game.dialogue && !game.dialogue.done) drawDialogue(ctx, game, W, H);
  if (game.districtCard) drawDistrictCard(ctx, game, W, H);
  if (game.promptText) {
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.promptText).width + 30;
    panel(ctx, W / 2 - w / 2, H - 118, w, 32, 0.8);
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(game.promptText, W / 2, H - 96);
  }
  if (game.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,30,30,${game.hurtFlash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMissionCard(ctx, game) {
  const obj = game.objective();
  panel(ctx, 16, 16, 308, obj ? 96 : 58);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb35c';
  ctx.font = 'bold 11px system-ui, sans-serif';
  const m = game.missions;
  let header = 'CRIMSON TIDE BAY';
  if (game.races.active) header = 'CARRERA CALLEJERA';
  else if (m.state === 'active' && m.mission) header = `${m.mission.title.toUpperCase()} — FASE ${m.stageIdx + 1}/${m.mission.stages.length}`;
  else if (m.state === 'courier') header = 'MENSAJERÍA — TRABAJO LIBRE';
  else if (m.state === 'idle' && !m.done) header = 'TRABAJO NUEVO';
  ctx.fillText(header, 30, 38);
  if (!obj) {
    ctx.fillStyle = '#e8e2d2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('La bahía está tranquila. Por ahora.', 30, 60);
    return;
  }
  ctx.fillStyle = '#f4ecd8';
  ctx.font = '600 14.5px system-ui, sans-serif';
  wrapText(ctx, obj.text, 30, 60, 282, 17);
  ctx.fillStyle = '#b9ac93';
  ctx.font = '12px system-ui, sans-serif';
  let sub = obj.sub || '';
  if (obj.x !== null && obj.x !== undefined) {
    const p = game.playerPos();
    const d = Math.round(Math.hypot(obj.x - p.x, obj.y - p.y) / 4);
    sub += `${sub ? ' · ' : ''}${d} m`;
  }
  ctx.fillText(sub, 30, 100);
  if (m.timer !== null && m.state === 'active') {
    const t = Math.max(0, m.timer);
    ctx.fillStyle = t < 12 ? '#ff5f4d' : '#ffd98a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${t.toFixed(0)}s`, 312, 38);
    ctx.textAlign = 'left';
  }
}

function drawStatusCluster(ctx, game, W) {
  panel(ctx, W - 252, 16, 236, 96);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8be08a';
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, W - 30, 46);
  // Wanted stars.
  ctx.font = '19px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.wanted ? '#ffd23e' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', W - 30 - (4 - i) * 22, 72);
  }
  // REP tier and progress.
  const tier = repTier(game.rep);
  const next = REP_TIERS[REP_TIERS.indexOf(tier) + 1];
  ctx.fillStyle = '#e8c98a';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`REP · ${tier.name}${tier.payBonus ? ` (+${Math.round(tier.payBonus * 100)}%)` : ''}`, W - 30, 94);
  if (next) {
    const f = (game.rep - tier.min) / (next.min - tier.min);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(W - 236, 100, 140, 4);
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(W - 236, 100, 140 * Math.max(0, Math.min(1, f)), 4);
  }
  ctx.textAlign = 'left';
  // Health and armor bars under the cluster.
  const hw = 236;
  ctx.fillStyle = 'rgba(13,9,22,0.74)';
  ctx.beginPath(); ctx.roundRect(W - 252, 118, hw, 12, 6); ctx.fill();
  ctx.fillStyle = game.player.health > 30 ? '#7fc95e' : '#ff5f4d';
  ctx.beginPath(); ctx.roundRect(W - 252, 118, hw * Math.max(0, game.player.health) / 100, 12, 6); ctx.fill();
  if (game.player.armor > 0) {
    ctx.fillStyle = 'rgba(13,9,22,0.74)';
    ctx.beginPath(); ctx.roundRect(W - 252, 134, hw, 8, 4); ctx.fill();
    ctx.fillStyle = '#7fb8d9';
    ctx.beginPath(); ctx.roundRect(W - 252, 134, hw * Math.min(100, game.player.armor) / 100, 8, 4); ctx.fill();
  }
}

function drawDispatch(ctx, game, H) {
  const rows = dispatchRows(game);
  const chatter = dispatchChatter(game);
  const h = 44 + rows.length * 21 + (chatter ? 32 : 0) + (police.bust > 0.02 ? 22 : 0);
  panel(ctx, 16, H - h - 16, 264, h, 0.8);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff7a5c';
  ctx.font = 'bold 11.5px system-ui, sans-serif';
  ctx.fillText('◉ DESPACHO POLICIAL — UNIDADES ACTIVAS', 28, H - h + 12);
  let y = H - h + 34;
  for (const r of rows) {
    ctx.fillStyle = r.kind === 'heli' ? '#9fd8ff' : '#f4ecd8';
    ctx.font = 'bold 12.5px ui-monospace, monospace';
    ctx.fillText(r.name, 28, y);
    ctx.fillStyle = '#ffb35c';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(r.role, 118, y);
    ctx.fillStyle = '#b9ac93';
    ctx.textAlign = 'right';
    ctx.fillText(`${r.dist} m`, 268, y);
    ctx.textAlign = 'left';
    y += 21;
  }
  if (chatter) {
    ctx.fillStyle = 'rgba(230,220,200,0.62)';
    ctx.font = 'italic 10.5px system-ui, sans-serif';
    wrapText(ctx, chatter, 28, y + 2, 240, 13);
    y += 20;
  }
  if (police.bust > 0.02) {
    ctx.fillStyle = '#ff5f4d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('¡TE ESTÁN DETENIENDO!', 28, y + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(150, y, 118, 8);
    ctx.fillStyle = '#ff5f4d';
    ctx.fillRect(150, y, 118 * Math.min(1, police.bust), 8);
  }
}

function drawMinimap(ctx, game, W, H) {
  const mw = 196, mh = 158;
  const x = W - mw - 16, y = H - mh - 16;
  panel(ctx, x - 6, y - 6, mw + 12, mh + 12, 0.8);
  const layer = getStaticLayer();
  ctx.drawImage(layer, 0, 0, WORLD.width, WORLD.height, x, y, mw, mh);
  const sx = (wx) => x + (wx / WORLD.width) * mw;
  const sy = (wy) => y + (wy / WORLD.height) * mh;
  const obj = game.objective();
  if (obj && obj.x !== null && obj.x !== undefined) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(sx(obj.x), sy(obj.y), 4 + Math.sin(game.time * 5) * 1.2, 0, Math.PI * 2); ctx.fill();
  }
  const giver = game.missions.giverMark();
  if (giver) {
    ctx.fillStyle = '#2fd4c4';
    ctx.beginPath(); ctx.arc(sx(giver.x), sy(giver.y), 3.6, 0, Math.PI * 2); ctx.fill();
  }
  if (Math.floor(game.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ff5040';
    for (const u of police.units) {
      if (u.dead) continue;
      ctx.beginPath(); ctx.arc(sx(u.x), sy(u.y), 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const p = game.playerPos();
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(game.player.car ? game.player.car.angle : game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4.4, -3.6); ctx.lineTo(-4.4, 3.6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawVehicleCluster(ctx, game, W, H) {
  ctx.textAlign = 'right';
  let y = H - 196;
  if (game.player.car) {
    const car = game.player.car;
    ctx.fillStyle = '#f4ecd8';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.42)} km/h`, W - 228, y);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#b9ac93';
    ctx.fillText(`${car.model.name} · estado ${Math.max(0, Math.round(car.health))}%`, W - 228, y + 18);
    y += 40;
  }
  const w = WEAPONS[game.player.weapon];
  const list = unlockedWeaponList(game);
  ctx.fillStyle = list[game.player.weapon].unlocked ? '#ffd98a' : '#8a8074';
  ctx.font = '600 13.5px system-ui, sans-serif';
  ctx.fillText(`🔫 ${w.name} · TIER ${w.tier}`, W - 228, y);
  ctx.textAlign = 'left';
  if (game.radioStation) {
    const st = game.radioStation;
    const txt = `♪ ${st.name} ${st.freq} — ${st.mood}  [R]`;
    ctx.font = '600 12.5px system-ui, sans-serif';
    const tw = ctx.measureText(txt).width + 26;
    panel(ctx, W / 2 - tw / 2, H - 40, tw, 26, 0.7);
    ctx.fillStyle = '#9fe8dc';
    ctx.textAlign = 'center';
    ctx.fillText(txt, W / 2, H - 22);
    ctx.textAlign = 'left';
  }
}

function drawObjectiveArrow(ctx, game, W, H) {
  const obj = game.objective();
  if (!obj || obj.x === null || obj.x === undefined) return;
  const cam = game.camera;
  const sx = obj.x - cam.x, sy = obj.y - cam.y;
  if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return;
  let cx = Math.max(36, Math.min(W - 36, sx));
  let cy = Math.max(36, Math.min(H - 36, sy));
  if (cx < 352 && cy < 140) cy = 140; // keep the arrow out of the mission card
  const a = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  const p = game.playerPos();
  const d = Math.round(Math.hypot(obj.x - p.x, obj.y - p.y) / 4);
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 11.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${d} m`, cx, cy + 24);
  ctx.textAlign = 'left';
}

function drawBanner(ctx, game, W) {
  const b = game.bannerData;
  const a = Math.min(1, b.t / 0.3, (b.max - b.t) / 0.5);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Georgia, serif';
  const tw = Math.max(ctx.measureText(b.title).width, 240) + 60;
  panel(ctx, W / 2 - tw / 2, 128, tw, b.text ? 74 : 52, 0.82);
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(b.title, W / 2, 162);
  if (b.text) {
    ctx.font = '13.5px system-ui, sans-serif';
    ctx.fillStyle = '#f4ecd8';
    wrapText(ctx, b.text, W / 2 - tw / 2 + 24, 184, tw - 48, 16);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawDialogue(ctx, game, W, H) {
  const line = currentLine(game.dialogue);
  if (!line) return;
  // While the law is active the dispatch panel owns the bottom-left:
  // the dialogue box slides right and narrows to keep both readable.
  const shift = game.wanted > 0 ? 132 : 0;
  const bw = Math.min(game.wanted > 0 ? 620 : 780, W - 90 - shift), bh = 104;
  const x = W / 2 - bw / 2 + shift, y = H - bh - 58;
  panel(ctx, x, y, bw, bh, 0.88);
  drawPortrait(ctx, x + 14, y + 14, 76, line.speaker);
  ctx.textAlign = 'left';
  ctx.fillStyle = line.who.color;
  ctx.font = 'bold 15.5px system-ui, sans-serif';
  ctx.fillText(line.who.name, x + 106, y + 30);
  ctx.fillStyle = '#b9ac93';
  ctx.font = '11.5px system-ui, sans-serif';
  ctx.fillText(line.who.role, x + 106, y + 47);
  ctx.fillStyle = '#f7f1de';
  ctx.font = '15px system-ui, sans-serif';
  wrapText(ctx, line.text, x + 106, y + 68, bw - 130, 19);
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('E ▸', x + bw - 14, y + bh - 10);
  ctx.textAlign = 'left';
}

function drawDistrictCard(ctx, game, W, H) {
  const c = game.districtCard;
  const a = Math.min(1, c.t / 0.5, (2.8 - c.t) / 0.8);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3d6';
  ctx.font = '600 46px Georgia, serif';
  ctx.shadowColor = 'rgba(20,8,30,0.8)';
  ctx.shadowBlur = 18;
  ctx.fillText(c.name.toUpperCase(), W / 2, H * 0.3);
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(c.tag, W / 2, H * 0.3 + 32);
  ctx.restore();
  ctx.textAlign = 'left';
}

// ---- Screens ---------------------------------------------------------------

export function drawTitleScreen(ctx, game) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  // Poster sky: amber melting into violet over the bay.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3b1d5e');
  sky.addColorStop(0.42, '#a83e5e');
  sky.addColorStop(0.68, '#f07f3c');
  sky.addColorStop(0.8, '#ffc46b');
  sky.addColorStop(0.84, '#2a7d9d');
  sky.addColorStop(1, '#175d80');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Sun disc on the waterline.
  const sunY = H * 0.8;
  ctx.fillStyle = '#ffe3a1';
  ctx.beginPath(); ctx.arc(W * 0.5, sunY, 74, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,160,80,0.35)';
  ctx.beginPath(); ctx.arc(W * 0.5, sunY, 108, 0, Math.PI * 2); ctx.fill();
  // Sea sparkle.
  ctx.fillStyle = 'rgba(255,220,150,0.5)';
  for (let k = 0; k < 46; k++) {
    const yy = sunY + 8 + (k * 37 % (H - sunY - 14));
    const ww = 16 + (k * 53 % 90);
    ctx.fillRect(W * 0.5 - ww / 2 + Math.sin(k * 7.3) * 120, yy, ww, 2.4);
  }
  // Skyline silhouettes, two depths.
  drawSkyline(ctx, W, sunY, '#5e2450', 0.75, 11);
  drawSkyline(ctx, W, sunY + 6, '#241331', 1, 29);
  // Palm silhouettes at the edges.
  drawPalmSilhouette(ctx, 66, sunY + 16, 1.25);
  drawPalmSilhouette(ctx, W - 74, sunY + 22, 1.05);

  // The title.
  ctx.textAlign = 'center';
  ctx.font = '900 84px Georgia, serif';
  ctx.fillStyle = 'rgba(30,8,36,0.55)';
  ctx.fillText('CRIMSON TIDE', W / 2 + 4, H * 0.3 + 4);
  ctx.fillStyle = '#fff3d6';
  ctx.fillText('CRIMSON TIDE', W / 2, H * 0.3);
  ctx.font = '900 84px Georgia, serif';
  const tg = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.3 + 80);
  tg.addColorStop(0, '#ffd98a');
  tg.addColorStop(1, '#f07f3c');
  ctx.fillStyle = tg;
  ctx.fillText('BAY', W / 2, H * 0.3 + 82);
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('Una bahía. Una deuda. Una última noche al volante.', W / 2, H * 0.3 + 122);

  // Save slots.
  const sw = 252, sh = 96, gap = 22;
  const totalW = sw * 3 + gap * 2;
  const sx = W / 2 - totalW / 2, sy = H * 0.62;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('ELIGE TU PARTIDA — clic o teclas 1 · 2 · 3', W / 2, sy - 14);
  game.slotRects = [];
  for (let i = 0; i < 3; i++) {
    const x = sx + i * (sw + gap);
    const slot = game.slots[i];
    ctx.fillStyle = 'rgba(16,10,26,0.78)';
    ctx.beginPath(); ctx.roundRect(x, sy, sw, sh, 12); ctx.fill();
    ctx.strokeStyle = slot.exists ? '#ffd98a' : 'rgba(255,233,201,0.35)';
    ctx.lineWidth = slot.exists ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`PARTIDA ${i + 1}`, x + sw / 2, sy + 28);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#f4ecd8';
    if (slot.exists) {
      ctx.fillText(`$${slot.cash.toLocaleString('en-US')} · ${slot.progress}`, x + sw / 2, sy + 52);
      ctx.fillStyle = '#b9ac93';
      ctx.font = '11.5px system-ui, sans-serif';
      ctx.fillText(slot.when, x + sw / 2, sy + 72);
    } else {
      ctx.fillText('— Vacía: empieza de cero —', x + sw / 2, sy + 56);
    }
    game.slotRects.push({ x, y: sy, w: sw, h: sh });
  }
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,240,214,0.85)';
  ctx.fillText('WASD conducir · F subir/bajar · ratón apuntar y disparar · Q cambiar arma · R radio · M mapa · P pausa', W / 2, H - 26);
  ctx.textAlign = 'left';
}

function drawSkyline(ctx, W, baseY, color, scale, seed) {
  ctx.fillStyle = color;
  let x = -20;
  let n = seed;
  while (x < W + 20) {
    n = (n * 137 + 71) % 997;
    const bw = 30 + (n % 60);
    const bh = (36 + (n % 110)) * scale;
    ctx.fillRect(x, baseY - bh, bw, bh);
    // Lit windows.
    ctx.fillStyle = 'rgba(255,196,96,0.75)';
    for (let wy = baseY - bh + 8; wy < baseY - 10; wy += 13) {
      for (let wx = x + 5; wx < x + bw - 6; wx += 11) {
        if ((wx * wy) % 7 < 2.4) ctx.fillRect(wx, wy, 4.6, 6);
      }
    }
    ctx.fillStyle = color;
    x += bw + 4 + (n % 16);
  }
}

function drawPalmSilhouette(ctx, x, y, s) {
  ctx.strokeStyle = '#1c0f28';
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + 120 * s);
  ctx.quadraticCurveTo(x + 8 * s, y + 50 * s, x - 2 * s, y);
  ctx.stroke();
  ctx.lineWidth = 4.4 * s;
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * (0.08 + k * 0.17);
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y);
    ctx.quadraticCurveTo(
      x - 2 * s + Math.cos(a) * 34 * s, y - Math.sin(a) * 26 * s - 12 * s,
      x - 2 * s + Math.cos(a) * 58 * s, y - Math.sin(a) * 30 * s + 14 * s,
    );
    ctx.stroke();
  }
}

export function drawMapScreen(ctx, game) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10,6,18,0.92)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('CRIMSON TIDE BAY', 36, 48);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#b9ac93';
  ctx.fillText(`Historia completada: ${missionProgress(game.missions)}% · REP ${game.rep} · $${game.cash.toLocaleString('en-US')}`, 36, 72);

  const mw = Math.min(W - 380, 880);
  const mh = mw * (WORLD.height / WORLD.width);
  const mx = 36, my = 92;
  const layer = getStaticLayer();
  ctx.drawImage(layer, 0, 0, WORLD.width, WORLD.height, mx, my, mw, mh);
  ctx.strokeStyle = 'rgba(255,217,138,0.5)';
  ctx.strokeRect(mx, my, mw, mh);
  const sx = (wx) => mx + (wx / WORLD.width) * mw;
  const sy = (wy) => my + (wy / WORLD.height) * mh;
  // District names.
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    const c = districtCenter(d);
    ctx.font = 'bold 12.5px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(16,10,24,0.65)';
    const tw = ctx.measureText(d.name.toUpperCase()).width + 10;
    ctx.fillRect(sx(c.x) - tw / 2, sy(c.y) - 10, tw, 17);
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText(d.name.toUpperCase(), sx(c.x), sy(c.y) + 3);
  }
  const mark = (wx, wy, color, label) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx(wx), sy(wy), 5.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#14101e';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (label) {
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.fillStyle = '#ffe9c9';
      ctx.fillText(label, sx(wx), sy(wy) - 10);
    }
  };
  const obj = game.objective();
  if (obj && obj.x !== null && obj.x !== undefined) mark(obj.x, obj.y, '#ffd23e', 'OBJETIVO');
  const giver = game.missions.giverMark();
  if (giver) mark(giver.x, giver.y, '#2fd4c4', 'TRABAJO');
  if (city.garage) mark(city.garage.x + city.garage.w / 2, city.garage.y + city.garage.h / 2, '#e8a33d', 'TALLER');
  if (city.policeStation) mark(city.policeStation.x, city.policeStation.y, '#7fb8d9', 'POLICÍA');
  if (city.hospital) mark(city.hospital.x, city.hospital.y, '#f2f2f2', 'HOSPITAL');
  for (const r of game.races.races) mark(r.start.x, r.start.y, '#7fe07a', r.name.toUpperCase());
  const p = game.playerPos();
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(game.player.car ? game.player.car.angle : game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(9, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // Legend.
  const lx = mx + mw + 28;
  panel(ctx, lx, my, 252, 252, 0.85);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('LEYENDA', lx + 16, my + 28);
  const items = [
    ['#ffffff', 'Tú'],
    ['#ffd23e', 'Objetivo actual'],
    ['#2fd4c4', 'Trabajo nuevo'],
    ['#e8a33d', 'Taller Calder — reparar y despintar'],
    ['#7fb8d9', 'Comisaría Central'],
    ['#f2f2f2', 'Hospital del Mar'],
    ['#7fe07a', 'Salidas de carrera'],
  ];
  ctx.font = '12.5px system-ui, sans-serif';
  items.forEach(([color, label], i) => {
    const yy = my + 56 + i * 27;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lx + 22, yy - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4ecd8';
    ctx.fillText(label, lx + 38, yy);
  });
  ctx.fillStyle = '#b9ac93';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('M o Tab para volver', lx + 16, my + 252 - 14);
  void H;
}

export function drawPauseScreen(ctx, game) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10,6,18,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3d6';
  ctx.font = '900 54px Georgia, serif';
  ctx.fillText('PAUSA', W / 2, H * 0.36);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')} · REP ${game.rep} (${repTier(game.rep).name}) · Historia ${missionProgress(game.missions)}%`, W / 2, H * 0.36 + 40);
  ctx.fillStyle = '#b9ac93';
  ctx.font = '13.5px system-ui, sans-serif';
  ctx.fillText('P seguir · M mapa · S guardar en la partida actual · T volver al título', W / 2, H * 0.36 + 72);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, game, kind) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = kind === 'busted' ? 'rgba(16,20,44,0.72)' : 'rgba(44,10,14,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '900 72px Georgia, serif';
  ctx.fillStyle = kind === 'busted' ? '#9fd8ff' : '#ff7a5c';
  ctx.fillText(kind === 'busted' ? 'DETENIDO' : 'ELIMINADO', W / 2, H * 0.42);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(game.endText || '', W / 2, H * 0.42 + 42);
  ctx.fillStyle = '#b9ac93';
  ctx.font = '13.5px system-ui, sans-serif';
  ctx.fillText('Pulsa Enter para seguir', W / 2, H * 0.42 + 72);
  ctx.textAlign = 'left';
}
