// Crimson Tide Bay — the Policía Municipal and its escalation ladder.
// One job: the law. Named units that hunt you, roadblocks across the
// street at two stars, a helicopter whose spotlight never lets the heat
// cool at three, and rifles out at four. The dispatch panel reads its
// roster from here.

import { LAW } from './config.js';
import { randomRoadPoint } from './city.js';
import { makeCar, driveToward, damageCar } from './vehicles.js';
import { sfx } from './audio.js';

const PURSUIT_NAMES = ['MARLIN 2', 'MARLIN 4', 'MARLIN 6', 'MARLIN 8', 'GAVIOTA 5'];
const BLOCK_NAMES = ['MURO 1', 'MURO 2'];

export const police = {
  units: [],        // cop cars in play (driver === 'cop')
  blocks: [],       // active roadblocks {x, y, cars[]}
  heli: null,       // {x, y, angle, phase}
  bust: 0,          // 0..1 — full means BUSTED
  seen: false,      // does any unit currently see the player?
  seenTimer: 99,    // seconds since a unit last saw the player
  blockCool: 0,
  shotCool: 0,
};

export function resetPolice() {
  police.units.length = 0;
  police.blocks.length = 0;
  police.heli = null;
  police.bust = 0;
  police.seen = false;
  police.seenTimer = 99;
}

function spawnCop(game, kind) {
  const p = game.playerPos();
  // Spawn on a road, out of sight but not out of the story.
  let spot = randomRoadPoint();
  let tries = 0;
  while (Math.hypot(spot.x - p.x, spot.y - p.y) < 460 && tries < 12) {
    spot = randomRoadPoint();
    tries++;
  }
  const isInterceptor = kind === 'interceptor';
  const car = makeCar(spot.x, spot.y, 0, isInterceptor ? 4 : 1, 'cop');
  car.color = isInterceptor ? '#22303c' : '#eef2ee';
  car.health = 130;
  const usedNames = new Set(police.units.map((u) => u.unitName));
  car.unitName = isInterceptor ? 'TIBURÓN 3' : PURSUIT_NAMES.find((n) => !usedNames.has(n)) || 'MARLIN 9';
  car.role = isInterceptor ? 'RAMMING' : 'PURSUIT';
  police.units.push(car);
  game.addCar(car);
  return car;
}

function desiredUnits(game) {
  const s = game.wanted;
  if (s <= 0) return 0;
  return Math.min(1 + s, 6); // 1★:2 … 5★:6
}

function updateRoadblocks(game, dt) {
  police.blockCool -= dt;
  const p = game.playerPos();
  // Retire blocks the player has left far behind.
  for (let i = police.blocks.length - 1; i >= 0; i--) {
    const b = police.blocks[i];
    if (Math.hypot(b.x - p.x, b.y - p.y) > 760 || game.wanted < 2) {
      for (const c of b.cars) { c.driver = 'parked'; c.unitName = null; }
      police.blocks.splice(i, 1);
    }
  }
  // Throw a new block across the road ahead of a driving player.
  const player = game.player;
  if (game.wanted >= 2 && police.blocks.length < (game.wanted >= 4 ? 2 : 1)
      && police.blockCool <= 0 && player.car && Math.abs(player.car.speed) > 40) {
    const ahead = 400;
  const tx = p.x + Math.cos(player.car.angle) * ahead;
    const ty = p.y + Math.sin(player.car.angle) * ahead;
    const cars = [];
    for (let k = 0; k < 2; k++) {
      const car = makeCar(
        tx + Math.cos(player.car.angle + Math.PI / 2) * (k === 0 ? -26 : 26),
        ty + Math.sin(player.car.angle + Math.PI / 2) * (k === 0 ? -26 : 26),
        player.car.angle + Math.PI / 2, 1, 'cop',
      );
      car.color = '#eef2ee';
      car.health = 130;
      car.unitName = BLOCK_NAMES[k];
      car.role = 'ROADBLOCK';
      car.speed = 0;
      cars.push(car);
      game.addCar(car);
    }
    police.blocks.push({ x: tx, y: ty, cars });
    police.blockCool = 16;
  }
}

export function updatePolice(game, dt) {
  const player = game.player;
  const p = game.playerPos();
  police.seenTimer += dt;

  // Roster management.
  const want = desiredUnits(game);
  const active = police.units.filter((u) => !u.dead && u.role !== 'ROADBLOCK');
  if (active.length < want) {
    spawnCop(game, game.wanted >= 4 && active.length === 0 ? 'interceptor' : 'patrol');
  }
  if (game.wanted === 0) {
    for (const u of police.units) if (!u.dead) { u.driver = 'parked'; u.unitName = null; }
    police.units.length = 0;
  }

  updateRoadblocks(game, dt);

  // Helicopter at three stars: it watches, so the heat cannot cool.
  if (game.wanted >= 3 && !player.dead) {
    if (!police.heli) police.heli = { x: p.x + 200, y: p.y - 200, angle: 0, phase: 0 };
    const h = police.heli;
    h.phase += dt * 0.7;
    const tx = p.x + Math.cos(h.phase) * 130;
    const ty = p.y + Math.sin(h.phase) * 130;
    h.x += (tx - h.x) * Math.min(1, dt * 1.6);
    h.y += (ty - h.y) * Math.min(1, dt * 1.6);
    h.angle = Math.atan2(p.y - h.y, p.x - h.x);
    if (Math.hypot(h.x - p.x, h.y - p.y) < 460) {
      police.seen = true;
      police.seenTimer = 0;
    }
  } else {
    police.heli = null;
  }

  // Pursuit driving and eyes.
  police.seen = police.heli ? true : false;
  for (const u of police.units) {
    if (u.dead || u.burning > 0) continue;
    if (u.role === 'ROADBLOCK') continue;
    const dist = Math.hypot(u.x - p.x, u.y - p.y);
    if (dist < LAW.sightRange) { police.seen = true; police.seenTimer = 0; }
    // Predict a little of the player's line, then drive at it.
    const lead = player.car ? 0.45 : 0.2;
    const tx = p.x + game.playerVel().x * lead;
    const ty = p.y + game.playerVel().y * lead;
    const topSpeed = u.role === 'RAMMING' ? 292 : 238 + game.wanted * 9;
    if (dist > 46) driveToward(u, tx, ty, dt, topSpeed);
    else {
      // Alongside: match speed, crowd the player.
      u.speed *= (1 - 1.8 * dt);
      driveToward(u, tx, ty, dt, 60);
    }
    if (dist > 1500) { // hopelessly lost: quietly retire and respawn later
      u.driver = 'parked'; u.unitName = null;
    }
  }
  for (let i = police.units.length - 1; i >= 0; i--) {
    if (police.units[i].driver !== 'cop') police.units.splice(i, 1);
  }

  // Rifles out at four stars.
  police.shotCool -= dt;
  if (game.wanted >= LAW.copShootStars && police.shotCool <= 0 && !player.dead) {
    for (const u of police.units) {
      if (u.dead || u.role === 'ROADBLOCK') continue;
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (d < 250 && d > 30) {
        const a = Math.atan2(p.y - u.y, p.x - u.x) + (Math.random() - 0.5) * 0.22;
        game.spawnBullet({
          x: u.x + Math.cos(a) * 24, y: u.y + Math.sin(a) * 24,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          life: 0.5, dmg: 7, from: 'cop',
        });
        sfx.shot();
        police.shotCool = 0.55;
        break;
      }
    }
  }

  // The bust grip.
  let gripped = false;
  if (!player.dead && game.wanted > 0) {
    for (const u of police.units) {
      if (u.dead) continue;
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (!player.car && d < 34) gripped = true;
      if (player.car && Math.abs(player.car.speed) < 14 && d < 58) gripped = true;
    }
  }
  if (gripped) {
    police.bust += dt / LAW.bustFillSeconds;
    if (police.bust >= 1) {
      police.bust = 0;
      game.onBusted();
    }
  } else {
    police.bust = Math.max(0, police.bust - dt * 0.7);
  }
}

export function nearestCopDist(game) {
  const p = game.playerPos();
  let best = Infinity;
  for (const u of police.units) {
    if (u.dead) continue;
    best = Math.min(best, Math.hypot(u.x - p.x, u.y - p.y));
  }
  return best;
}

export { damageCar };
