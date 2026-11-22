// Crimson Tide Bay — cars: models, driving physics, traffic.
// One job: everything with four wheels that is not law enforcement —
// the shared arcade driving model, the lane-following traffic, the
// parked cars waiting to be borrowed, and what happens when they meet.

import { WORLD, CAR } from './config.js';
import { roadCenterX, roadCenterY, collideBuildings, randomRoadPoint } from './city.js';
import { roll, rollPick } from './random.js';

export const MODELS = [
  { name: 'Pícaro',      kind: 'hatch',  color: '#d95f4b', top: 218, accel: 0.92, grip: 1.05 },
  { name: 'Marea 4p',    kind: 'sedan',  color: '#4d7fa8', top: 232, accel: 0.95, grip: 1.0 },
  { name: 'Tornado V8',  kind: 'muscle', color: '#e8a33d', top: 268, accel: 1.12, grip: 0.9 },
  { name: 'Gaviota Van', kind: 'van',    color: '#e5e0d2', top: 196, accel: 0.82, grip: 0.95 },
  { name: 'Relámpago',   kind: 'sport',  color: '#8a5fb8', top: 302, accel: 1.22, grip: 1.08 },
  { name: 'Burro',       kind: 'pickup', color: '#6f9e57', top: 208, accel: 0.88, grip: 0.97 },
  { name: 'Coral GT',    kind: 'sport',  color: '#2fa8a0', top: 292, accel: 1.16, grip: 1.05 },
  { name: 'Taxi Sol',    kind: 'sedan',  color: '#f4cf4a', top: 226, accel: 0.94, grip: 1.0 },
];
const PAINTS = ['#d95f4b', '#4d7fa8', '#e8a33d', '#e5e0d2', '#8a5fb8', '#6f9e57', '#2fa8a0', '#f4cf4a', '#c65b7c', '#ded5c2', '#54687a', '#a83e4d'];

let nextId = 1;

export function makeCar(x, y, angle, modelIdx, driver) {
  const model = MODELS[modelIdx % MODELS.length];
  return {
    id: nextId++,
    x, y, angle, speed: 0,
    model, modelIdx,
    color: driver === 'traffic' || driver === 'parked' ? rollPick(PAINTS) : model.color,
    driver,             // 'traffic' | 'parked' | 'player' | 'cop' | 'rival' | 'target'
    health: 100,
    burning: 0,         // seconds left before it blows (0 = not burning)
    dead: false,
    lane: null,         // traffic lane state
    turnCool: 0,
    stuckTime: 0,
    unitName: null,     // police call-sign, set by police.js
    role: null,         // dispatch role, set by police.js
  };
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// The shared arcade drive: throttle -1..1, steer -1..1 (left..right).
export function applyDrive(car, dt, throttle, steer, maxSpeed) {
  const m = car.model;
  const top = Math.min(maxSpeed || m.top, m.top);
  if (throttle > 0) car.speed += CAR.accel * m.accel * throttle * dt;
  else if (throttle < 0) {
    car.speed += (car.speed > 4 ? -CAR.brake : CAR.accel * 0.55 * throttle) * dt;
  }
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed > top) car.speed = top;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  const speedFactor = Math.max(-1, Math.min(1, car.speed / 130));
  car.angle += steer * CAR.turnRate * m.grip * speedFactor * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// Steer a car toward a world point; returns nothing, applies drive.
export function driveToward(car, tx, ty, dt, maxSpeed, reverse = true) {
  const dx = tx - car.x, dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const diff = wrapAngle(Math.atan2(dy, dx) - car.angle);
  let throttle = 1, steer = Math.max(-1, Math.min(1, diff * 2.4));
  if (reverse && Math.abs(diff) > 2.35 && dist > 30) throttle = -0.8;
  else if (Math.abs(diff) > 1.15) throttle = 0.55;
  applyDrive(car, dt, throttle, steer, maxSpeed);
  return dist;
}

// Keep a car out of the buildings and the sea; returns impact speed or 0.
export function collideWorld(car) {
  let impact = 0;
  const before = { x: car.x, y: car.y };
  const fixed = collideBuildings(car.x, car.y, 17);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    impact = Math.abs(car.speed);
    car.x = fixed.x; car.y = fixed.y;
    car.speed *= -0.25;
  }
  const m = 40;
  car.x = Math.max(m, Math.min(WORLD.width - m, car.x));
  car.y = Math.max(m, Math.min(WORLD.height - m, car.y));
  if (car.x === m || car.y === m || car.x === WORLD.width - m || car.y === WORLD.height - m) {
    if (Math.abs(car.speed) > 60) impact = Math.max(impact, Math.abs(car.speed) * 0.7);
    car.speed *= 0.6;
  }
  void before;
  return impact;
}

// Car-to-car bumps: push apart, trade speed, report the violence.
export function collideCars(cars, onImpact) {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 38;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const closing = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.82; b.speed = avg * 0.82;
        if (closing > 55 && onImpact) onImpact(a, b, closing);
      }
    }
  }
}

export function damageCar(car, amount, game) {
  if (car.dead || car.burning > 0) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.burning = roll(0.7, 1.4);
    if (game && game.onCarBurning) game.onCarBurning(car);
  }
}

// ---- Traffic ------------------------------------------------------------

const LANE_OFF = WORLD.roadWidth / 4;

function laneCoord(car) {
  const L = car.lane;
  if (L.axis === 'v') return roadCenterX(L.idx) + (L.dir > 0 ? -LANE_OFF : LANE_OFF);
  return roadCenterY(L.idx) + (L.dir > 0 ? LANE_OFF : -LANE_OFF);
}

export function spawnTraffic(count) {
  const cars = [];
  for (let k = 0; k < count; k++) {
    const p = randomRoadPoint();
    const vertical = Math.random() < 0.5;
    const idx = vertical
      ? Math.max(0, Math.min(WORLD.blocksX, Math.round((p.x - WORLD.sandRim) / WORLD.pitch)))
      : Math.max(0, Math.min(WORLD.blocksY, Math.round((p.y - WORLD.sandRim) / WORLD.pitch)));
    const car = makeCar(p.x, p.y, 0, Math.floor(Math.random() * MODELS.length), 'traffic');
    car.lane = { axis: vertical ? 'v' : 'h', idx, dir: Math.random() < 0.5 ? 1 : -1 };
    car.angle = car.lane.axis === 'v' ? (car.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.lane.dir > 0 ? 0 : Math.PI);
    if (car.lane.axis === 'v') car.x = laneCoord(car); else car.y = laneCoord(car);
    car.speed = roll(60, 110);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(count) {
  const cars = [];
  for (let k = 0; k < count; k++) {
    const vertical = Math.random() < 0.5;
    const idx = Math.floor(Math.random() * (vertical ? WORLD.blocksX + 1 : WORLD.blocksY + 1));
    const side = Math.random() < 0.5 ? -1 : 1;
    let x, y, angle;
    if (vertical) {
      x = roadCenterX(idx) + side * (WORLD.roadWidth / 2 - 13);
      y = roll(WORLD.sandRim + 60, WORLD.height - WORLD.sandRim - 60);
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = roll(WORLD.sandRim + 60, WORLD.width - WORLD.sandRim - 60);
      y = roadCenterY(idx) + side * (WORLD.roadWidth / 2 - 13);
      angle = side > 0 ? 0 : Math.PI;
    }
    const car = makeCar(x, y, angle, Math.floor(Math.random() * MODELS.length), 'parked');
    car.health = roll(55, 100);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(car, dt, game) {
  if (car.dead || car.driver !== 'traffic') return;
  if (car.burning > 0) { car.speed *= 0.9; return; }
  car.turnCool -= dt;
  const L = car.lane;
  const coord = laneCoord(car);
  // Lookahead point down the lane.
  let tx, ty;
  if (L.axis === 'v') { tx = coord; ty = car.y + L.dir * 110; }
  else { tx = car.x + L.dir * 110; ty = coord; }

  // Slow for anything solid ahead.
  let cruise = 118;
  for (const other of game.allCars()) {
    if (other === car || other.dead) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 58 && side < 20) cruise = Math.min(cruise, Math.max(0, (ahead - 34) * 4));
  }
  const px = game.playerPos();
  const aheadP = (px.x - car.x) * Math.cos(car.angle) + (px.y - car.y) * Math.sin(car.angle);
  const sideP = Math.abs((px.x - car.x) * -Math.sin(car.angle) + (px.y - car.y) * Math.cos(car.angle));
  if (aheadP > 0 && aheadP < 54 && sideP < 20) cruise = 0;

  driveToward(car, tx, ty, dt, cruise, false);
  if (car.speed > cruise) car.speed = Math.max(cruise, car.speed - 190 * dt);

  // Consider a turn at the next intersection.
  if (car.turnCool <= 0) {
    const cross = L.axis === 'v'
      ? Math.abs(car.y - roadCenterY(Math.round((car.y - WORLD.sandRim) / WORLD.pitch))) < 8
      : Math.abs(car.x - roadCenterX(Math.round((car.x - WORLD.sandRim) / WORLD.pitch))) < 8;
    if (cross && Math.random() < 0.012) {
      if (L.axis === 'v') {
        const j = Math.max(0, Math.min(WORLD.blocksY, Math.round((car.y - WORLD.sandRim) / WORLD.pitch)));
        car.lane = { axis: 'h', idx: j, dir: Math.random() < 0.5 ? 1 : -1 };
      } else {
        const i = Math.max(0, Math.min(WORLD.blocksX, Math.round((car.x - WORLD.sandRim) / WORLD.pitch)));
        car.lane = { axis: 'v', idx: i, dir: Math.random() < 0.5 ? 1 : -1 };
      }
      car.turnCool = 2.5;
    }
  }
  // Keep traffic inside the grid: turn around at the rim roads.
  if (L.axis === 'v' && (car.y < WORLD.sandRim + 30 || car.y > WORLD.height - WORLD.sandRim - 30)) L.dir *= -1;
  if (L.axis === 'h' && (car.x < WORLD.sandRim + 30 || car.x > WORLD.width - WORLD.sandRim - 30)) L.dir *= -1;
}
