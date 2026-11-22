// Crimson Tide Bay — Ruy Calder, the player: walking, driving, fighting.
// One job: everything the person at the keyboard directly controls —
// movement on foot, the driving inputs, the four named weapons and the
// door between the two (F, next to a car, is a whole lifestyle here).

import { PLAYER, WORLD, repTier } from './config.js';
import { pressed, tapped, mouse } from './input.js';
import { collideBuildings } from './city.js';
import { applyDrive, damageCar } from './vehicles.js';
import { sfx } from './audio.js';

export const WEAPONS = [
  { id: 'comadre',  name: 'La Comadre', tier: 1, type: 'pistol',  rate: 0.27, dmg: 34, spread: 0.03, speed: 780, auto: false },
  { id: 'vendaval', name: 'Vendaval-9', tier: 2, type: 'smg',     rate: 0.09, dmg: 15, spread: 0.10, speed: 840, auto: true },
  { id: 'trueno',   name: 'Trueno 12',  tier: 3, type: 'shotgun', rate: 0.85, dmg: 11, spread: 0.17, speed: 720, auto: false, pellets: 6 },
  { id: 'petardo',  name: 'Petardos',   tier: 4, type: 'grenade', rate: 0.7,  dmg: 130, spread: 0, speed: 430, auto: false },
];

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    health: PLAYER.health, armor: 0,
    car: null,               // the car being driven, or null on foot
    weapon: 0,               // index into WEAPONS
    fireCool: 0,
    walkPhase: 0,
    dead: false,
  };
}

export function weaponUnlocked(player, game) {
  const tierIdx = repTier(game.rep).name === 'Nadie' ? 0
    : repTier(game.rep).name === 'Conocido' ? 1
    : repTier(game.rep).name === 'Respetado' ? 2 : 3;
  return WEAPONS[player.weapon].tier - 1 <= tierIdx;
}

export function unlockedWeaponList(game) {
  const tier = repTier(game.rep);
  const idx = tier.name === 'Nadie' ? 0 : tier.name === 'Conocido' ? 1 : tier.name === 'Respetado' ? 2 : 3;
  return WEAPONS.map((w) => ({ ...w, unlocked: w.tier - 1 <= idx }));
}

function nearestCar(game, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const car of game.allCars()) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updatePlayer(player, game, dt) {
  if (player.dead) return;
  player.fireCool -= dt;

  if (player.car) {
    updateDriving(player, game, dt);
  } else {
    updateOnFoot(player, game, dt);
  }

  // Weapon swap: Q cycles, 1-4 direct, wheel scrolls.
  if (tapped('KeyQ') || mouse.wheel !== 0) {
    const dir = mouse.wheel !== 0 ? Math.sign(mouse.wheel) : 1;
    const list = unlockedWeaponList(game);
    for (let step = 0; step < WEAPONS.length; step++) {
      player.weapon = (player.weapon + dir + WEAPONS.length) % WEAPONS.length;
      if (list[player.weapon].unlocked) break;
    }
  }
  for (let n = 0; n < 4; n++) {
    if (tapped('Digit' + (n + 1))) {
      const list = unlockedWeaponList(game);
      if (list[n].unlocked) player.weapon = n;
    }
  }
}

function updateOnFoot(player, game, dt) {
  let mx = 0, my = 0;
  if (pressed('KeyW', 'ArrowUp')) my -= 1;
  if (pressed('KeyS', 'ArrowDown')) my += 1;
  if (pressed('KeyA', 'ArrowLeft')) mx -= 1;
  if (pressed('KeyD', 'ArrowRight')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  const sprint = pressed('ShiftLeft', 'ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * (sprint ? 13 : 9);
  }
  const fixed = collideBuildings(player.x, player.y, PLAYER.radius);
  player.x = fixed.x; player.y = fixed.y;
  player.x = Math.max(26, Math.min(WORLD.width - 26, player.x));
  player.y = Math.max(26, Math.min(WORLD.height - 26, player.y));

  // Aim at the mouse while shooting.
  const aim = game.mouseWorld();
  if (mouse.down) player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);

  // Enter a car.
  if (tapped('KeyF')) {
    const car = nearestCar(game, player.x, player.y, 44);
    if (car) {
      if (car.driver === 'traffic') {
        game.onCarjack(car);
      }
      car.driver = 'player';
      player.car = car;
      car.speed = 0;
      sfx.door();
      game.onEnterCar(car);
      return;
    }
  }

  updateShooting(player, game, dt, aim);
}

function updateDriving(player, game, dt) {
  const car = player.car;
  player.x = car.x; player.y = car.y;
  player.angle = car.angle;

  let throttle = 0, steer = 0;
  if (pressed('KeyW', 'ArrowUp')) throttle = 1;
  if (pressed('KeyS', 'ArrowDown')) throttle = -1;
  if (pressed('KeyA', 'ArrowLeft')) steer = -1;
  if (pressed('KeyD', 'ArrowRight')) steer = 1;
  applyDrive(car, dt, throttle, steer, car.model.top);
  if (pressed('Space')) {
    car.speed -= car.speed * 2.6 * dt; // handbrake bite
    if (Math.abs(car.speed) > 60) game.addSkid(car);
  }
  game.updateDrivingFx(car, dt);

  // Drive-by shooting out of the window.
  const aim = game.mouseWorld();
  updateShooting(player, game, dt, aim);

  if (tapped('KeyF')) {
    // Step out on the left side of the car.
    player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 26;
    player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 26;
    const fixed = collideBuildings(player.x, player.y, PLAYER.radius);
    player.x = fixed.x; player.y = fixed.y;
    car.driver = 'parked';
    player.car = null;
    sfx.door();
    game.onExitCar(car);
  }
}

function updateShooting(player, game, dt, aim) {
  const w = WEAPONS[player.weapon];
  if (game.dialogue && !game.dialogue.done) return; // talking, not shooting
  if (!weaponUnlocked(player, game)) return;
  const wantFire = w.auto ? mouse.down : mouse.clicked;
  if (!wantFire || player.fireCool > 0) return;
  player.fireCool = w.rate;
  const fromCar = !!player.car;
  const ox = player.x + Math.cos(player.angle) * (fromCar ? 20 : 14);
  const oy = player.y + Math.sin(player.angle) * (fromCar ? 20 : 14);
  const baseAngle = Math.atan2(aim.y - oy, aim.x - ox);
  if (!fromCar) player.angle = baseAngle;

  if (w.type === 'grenade') {
    game.throwGrenade(ox, oy, baseAngle, w);
    sfx.shot();
    return;
  }
  const shots = w.pellets || 1;
  for (let k = 0; k < shots; k++) {
    const a = baseAngle + (Math.random() - 0.5) * 2 * w.spread;
    game.spawnBullet({
      x: ox, y: oy,
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      life: 0.55, dmg: w.dmg, from: 'player',
    });
  }
  game.addMuzzle(ox, oy, baseAngle);
  if (w.type === 'shotgun') sfx.shotgun(); else sfx.shot();
  game.onPlayerShot(player);
}

export function hurtPlayer(player, amount, game) {
  if (player.dead) return;
  let dmg = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, dmg * 0.6);
    player.armor -= absorbed;
    dmg -= absorbed;
  }
  player.health -= dmg;
  game.onPlayerHurt(dmg);
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    game.onWasted();
  }
}

export { damageCar };
