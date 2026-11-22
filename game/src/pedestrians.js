// Crimson Tide Bay — the people of the bay.
// One job: pedestrians who stroll the sidewalks in the sun, panic when
// the shooting starts, dive out of the way of bad driving, and remember
// none of it five seconds later.

import { WORLD } from './config.js';
import { blockOrigin, collideBuildings } from './city.js';
import { roll, rollPick } from './random.js';

const SHIRTS = ['#e2725b', '#4d7fa8', '#f4cf4a', '#7fb069', '#e5e0d2', '#c65b7c', '#2fa8a0', '#e39a54', '#8a5fb8'];
const SKINS = ['#8d5a3b', '#c68e5e', '#6e452a', '#e0ac82', '#5a3a22'];

let nextId = 1;

function sidewalkPoint() {
  // A point on the pavement ring around a random block.
  const i = Math.floor(Math.random() * WORLD.blocksX);
  const j = Math.floor(Math.random() * WORLD.blocksY);
  const o = blockOrigin(i, j);
  const side = Math.floor(Math.random() * 4);
  const t = Math.random();
  const off = 7;
  if (side === 0) return { x: o.x - off + t * (WORLD.blockSize + off * 2), y: o.y - off };
  if (side === 1) return { x: o.x - off + t * (WORLD.blockSize + off * 2), y: o.y + WORLD.blockSize + off };
  if (side === 2) return { x: o.x - off, y: o.y - off + t * (WORLD.blockSize + off * 2) };
  return { x: o.x + WORLD.blockSize + off, y: o.y - off + t * (WORLD.blockSize + off * 2) };
}

export function makePed(x, y) {
  return {
    id: nextId++,
    x, y,
    angle: roll(0, Math.PI * 2),
    speed: 0,
    state: 'stroll',       // 'stroll' | 'panic' | 'dive' | 'down'
    stateTime: 0,
    target: sidewalkPoint(),
    shirt: rollPick(SHIRTS),
    skin: rollPick(SKINS),
    phase: roll(0, Math.PI * 2),
    threat: null,
  };
}

export function spawnPeds(count) {
  const peds = [];
  for (let k = 0; k < count; k++) {
    const p = sidewalkPoint();
    peds.push(makePed(p.x, p.y));
  }
  return peds;
}

export function scarePeds(peds, x, y, radius) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.state = 'panic';
      p.stateTime = roll(1.6, 3.2);
      p.threat = { x, y };
    }
  }
}

export function updatePed(ped, dt, game) {
  if (ped.state === 'down') return;
  ped.phase += dt * (ped.state === 'stroll' ? 7 : 13);
  ped.stateTime -= dt;

  // Dive away from fast cars bearing down.
  if (ped.state !== 'dive') {
    for (const car of game.allCars()) {
      if (car.dead || Math.abs(car.speed) < 120) continue;
      const dx = ped.x - car.x, dy = ped.y - car.y;
      const d = Math.hypot(dx, dy);
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      if (d < 64 && ahead > 0) {
        ped.state = 'dive';
        ped.stateTime = 0.55;
        ped.angle = Math.atan2(dy, dx);
        break;
      }
    }
  }

  let targetSpeed = 0;
  if (ped.state === 'stroll') {
    const dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) ped.target = sidewalkPoint();
    else {
      ped.angle = Math.atan2(dy, dx);
      targetSpeed = 42;
    }
  } else if (ped.state === 'panic') {
    if (ped.threat) ped.angle = Math.atan2(ped.y - ped.threat.y, ped.x - ped.threat.x);
    targetSpeed = 148;
    if (ped.stateTime <= 0) { ped.state = 'stroll'; ped.target = sidewalkPoint(); }
  } else if (ped.state === 'dive') {
    targetSpeed = 215;
    if (ped.stateTime <= 0) { ped.state = 'panic'; ped.stateTime = 1.2; }
  }

  ped.speed += (targetSpeed - ped.speed) * Math.min(1, dt * 6);
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  const fixed = collideBuildings(ped.x, ped.y, 9);
  ped.x = fixed.x; ped.y = fixed.y;
  ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD.height - 30, ped.y));
}

export function knockDown(ped) {
  ped.state = 'down';
  ped.speed = 0;
}
