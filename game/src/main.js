// Crimson Tide Bay — the game itself: state, loop and consequences.
// One job: own the world state and the frame loop. Every other module
// does one thing; this one holds them together — the heat and the law,
// fire and explosions, money and REP, saves, screens, and the staged
// scenes the screenshots are taken from (?scene=chase|mission|map).

import { WORLD, LAW, repTier } from './config.js';
import { initInput, pressed, tapped, mouse, clearTaps } from './input.js';
import { buildCity, city, isOnRoad } from './city.js';
import { districtAt } from './districts.js';
import { buildStaticLayer, drawWorld } from './render.js';
import { applyGrade } from './grading.js';
import { drawHUD, drawTitleScreen, drawMapScreen, drawPauseScreen, drawEndScreen } from './hud.js';
import { makePlayer, updatePlayer, hurtPlayer } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic, collideCars, collideWorld, damageCar, makeCar, applyDrive } from './vehicles.js';
import { spawnPeds, updatePed, scarePeds, knockDown } from './pedestrians.js';
import { police, updatePolice, resetPolice, nearestCopDist } from './police.js';
import { buildMissions, MissionRunner, roadNear } from './missions.js';
import { buildRaces, RaceRunner } from './races.js';
import { updateDialogue } from './crew.js';
import { initAudio, resumeAudio, setEngine, setSiren, setRadio, radioOff, STATIONS, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
initInput(canvas);

buildCity();
buildStaticLayer();

const HEAT_FOR_STARS = [0, 20, 55, 105, 170, 250];

const game = {
  state: 'title',           // 'title' | 'play' | 'pause' | 'map' | 'busted' | 'wasted'
  time: 0,
  cash: 240,
  rep: 0,
  heat: 0,
  wanted: 0,
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  grenades: [],
  particles: [],
  flashes: [],
  muzzles: [],
  skids: [],
  camera: { x: 0, y: 0, shake: 0 },
  missions: null,
  races: null,
  dialogue: null,
  bannerData: null,
  districtCard: null,
  districtId: null,
  promptText: null,
  hurtFlash: 0,
  radioIdx: -1,
  radioStation: null,
  slots: [],
  slotIndex: -1,
  slotRects: [],
  raceBests: {},
  endText: '',
  saveTimer: -1,
  storyDone: false,

  playerPos() {
    return this.player.car ? { x: this.player.car.x, y: this.player.car.y } : { x: this.player.x, y: this.player.y };
  },
  playerVel() {
    const c = this.player.car;
    return c ? { x: Math.cos(c.angle) * c.speed, y: Math.sin(c.angle) * c.speed } : { x: 0, y: 0 };
  },
  allCars() { return this.cars; },
  addCar(car) { this.cars.push(car); },
  mouseWorld() {
    return { x: this.camera.x + mouse.x, y: this.camera.y + mouse.y };
  },
  objective() {
    if (this.races && this.races.active) return this.races.objective();
    return this.missions ? this.missions.objective() : null;
  },

  // ---- Heat and the law -------------------------------------------------
  crime(points, x, y) {
    let witnessed = !!police.heli;
    if (!witnessed) {
      for (const u of police.units) {
        if (!u.dead && Math.hypot(u.x - x, u.y - y) < 420) { witnessed = true; break; }
      }
    }
    if (!witnessed) {
      for (const p of this.peds) {
        if (p.state !== 'down' && Math.hypot(p.x - x, p.y - y) < 230) { witnessed = true; break; }
      }
    }
    this.heat = Math.min(300, this.heat + (witnessed ? points : points * 0.3));
  },
  setWanted(n) {
    this.heat = Math.max(this.heat, HEAT_FOR_STARS[n] + 1);
  },
  updateHeat(dt) {
    const cooling = police.seen || police.heli ? 0.7 : 5.2;
    this.heat = Math.max(0, this.heat - cooling * dt);
    if (this.pinWanted) this.heat = Math.max(this.heat, HEAT_FOR_STARS[this.pinWanted] + 1);
    let stars = 0;
    for (let s = 1; s <= 5; s++) if (this.heat >= HEAT_FOR_STARS[s]) stars = s;
    this.wanted = stars;
  },

  // ---- Money, REP, messages ----------------------------------------------
  earn(cashAdd, repAdd) {
    const before = repTier(this.rep).name;
    this.cash += cashAdd;
    this.rep += repAdd;
    const after = repTier(this.rep).name;
    if (after !== before) {
      this.banner('REP — ' + after.toUpperCase(), 'La bahía te conoce un poco más. Mejores armas desbloqueadas en el HUD.');
    }
  },
  banner(title, text) {
    this.bannerData = { title, text: text || '', t: 0, max: 4.4 };
  },

  // ---- Events from other modules ------------------------------------------
  onPlayerShot(p) {
    this.crime(5, p.x, p.y);
    scarePeds(this.peds, p.x, p.y, 190);
  },
  onCarjack(car) {
    this.crime(30, car.x, car.y);
    scarePeds(this.peds, car.x, car.y, 150);
    sfx.crash();
  },
  onEnterCar(car) {
    if (this.radioIdx < 0) this.cycleRadio(0);
    void car;
  },
  onExitCar() {
    this.radioIdx = -1;
    this.radioStation = null;
    radioOff();
    setEngine(false);
  },
  cycleRadio(force) {
    this.radioIdx = force !== undefined ? force : (this.radioIdx + 1) % (STATIONS.length + 1);
    if (this.radioIdx >= STATIONS.length) {
      this.radioIdx = -1;
      this.radioStation = null;
      radioOff();
      return;
    }
    this.radioStation = STATIONS[this.radioIdx];
    setRadio(this.radioStation.id);
  },
  onCarBurning(car) {
    scarePeds(this.peds, car.x, car.y, 170);
  },
  onCarImpact(a, b, force) {
    const dmg = (force - 48) * 0.55;
    if (dmg > 2) {
      damageCar(a, dmg * 0.7, this);
      damageCar(b, dmg * 0.7, this);
      this.spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 7);
      sfx.crash();
    }
    if (a.driver === 'cop' || b.driver === 'cop') {
      const other = a.driver === 'cop' ? b : a;
      if (other.driver === 'player' || other === this.player.car) this.crime(26, other.x, other.y);
    }
    if (this.player.car && (a === this.player.car || b === this.player.car)) {
      this.camera.shake = Math.min(9, this.camera.shake + force * 0.05);
      if (force > 120) hurtPlayer(this.player, (force - 120) * 0.05, this);
    }
  },
  onPlayerHurt() {
    this.hurtFlash = 1;
  },
  onBusted() {
    if (this.state !== 'play') return;
    const fine = Math.min(this.cash, 120 + this.wanted * 70);
    this.cash -= fine;
    this.endText = `La Policía Municipal te ha ganado esta vez. Multa de $${fine}. Tu coche queda donde cayó.`;
    this.state = 'busted';
    sfx.busted();
    radioOff();
    setEngine(false);
    setSiren(false);
  },
  onWasted() {
    if (this.state !== 'play') return;
    const bill = Math.min(this.cash, 160);
    this.cash -= bill;
    this.endText = `Despiertas en el Hospital del Mar. Factura: $${bill}. La bahía sigue ahí fuera.`;
    this.state = 'wasted';
    radioOff();
    setEngine(false);
    setSiren(false);
  },

  // ---- Combat plumbing ------------------------------------------------------
  spawnBullet(b) {
    if (this.bullets.length < 320) this.bullets.push(b);
  },
  throwGrenade(x, y, angle, w) {
    this.grenades.push({
      x, y,
      vx: Math.cos(angle) * w.speed + this.playerVel().x * 0.4,
      vy: Math.sin(angle) * w.speed + this.playerVel().y * 0.4,
      fuse: 1.05,
    });
  },
  addMuzzle(x, y, angle) {
    this.muzzles.push({ x, y, angle, life: 0.05 });
  },
  spawnSparks(x, y, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 130;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3, maxLife: 0.6,
        color: Math.random() < 0.5 ? '#ffd23e' : '#ff8a3c', size: 2.6,
      });
    }
  },
  explodeAt(x, y, radius, dmg) {
    this.flashes.push({ x, y, r: radius, life: 0.32, maxLife: 0.32 });
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 300;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.7, maxLife: 1.1,
        color: ['#ff8a3c', '#ffd23e', '#5a4a52', '#ff5f4d'][k % 4], size: 3 + Math.random() * 4,
      });
    }
    this.camera.shake = Math.min(14, this.camera.shake + 7);
    sfx.explosion();
    scarePeds(this.peds, x, y, radius * 3.4);
    this.crime(34, x, y);
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < radius + 20) damageCar(car, dmg * (1 - d / (radius + 30)), this);
    }
    for (const ped of this.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < radius * 0.85) {
        knockDown(ped);
        this.crime(40, ped.x, ped.y);
      }
    }
    const p = this.playerPos();
    const pd = Math.hypot(p.x - x, p.y - y);
    if (pd < radius) {
      const inCar = !!this.player.car;
      hurtPlayer(this.player, dmg * (1 - pd / radius) * (inCar ? 0.45 : 0.8), this);
    }
  },

  // ---- Driving feel ---------------------------------------------------------
  addSkid(car) {
    const back = 19;
    const lx = car.x - Math.cos(car.angle) * back + Math.cos(car.angle - Math.PI / 2) * 10;
    const ly = car.y - Math.sin(car.angle) * back + Math.sin(car.angle - Math.PI / 2) * 10;
    const rx = car.x - Math.cos(car.angle) * back - Math.cos(car.angle - Math.PI / 2) * 10;
    const ry = car.y - Math.sin(car.angle) * back - Math.sin(car.angle - Math.PI / 2) * 10;
    if (car._sk) {
      this.skids.push({ x1: car._sk.lx, y1: car._sk.ly, x2: lx, y2: ly });
      this.skids.push({ x1: car._sk.rx, y1: car._sk.ry, x2: rx, y2: ry });
      if (this.skids.length > 700) this.skids.splice(0, this.skids.length - 700);
    }
    car._sk = { lx, ly, rx, ry };
  },
  updateDrivingFx(car, dt) {
    void dt;
    if (!isOnRoad(car.x, car.y) && Math.abs(car.speed) > 40 && Math.random() < 0.4) {
      this.particles.push({
        x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
        life: 0.5, maxLife: 0.5, color: '#e3ba7d', size: 4,
      });
    }
  },

  // ---- Saves ------------------------------------------------------------------
  saveSoon() { this.saveTimer = 1.2; },
  saveGame() {
    if (this.slotIndex < 0) return;
    const data = {
      cash: this.cash, rep: this.rep,
      missionIndex: this.missions.index, done: this.missions.done,
      raceBests: this.raceBests,
      when: new Date().toLocaleString('es-ES'),
    };
    try { localStorage.setItem('ctb-slot-' + this.slotIndex, JSON.stringify(data)); } catch (e) { /* private mode */ }
    this.loadSlots();
  },
  loadSlots() {
    this.slots = [];
    for (let i = 0; i < 3; i++) {
      let data = null;
      try { data = JSON.parse(localStorage.getItem('ctb-slot-' + i) || 'null'); } catch (e) { data = null; }
      if (data) {
        this.slots.push({
          exists: true, cash: data.cash,
          progress: data.done ? 'Historia completa' : `Trabajo ${Math.min(data.missionIndex + 1, 8)} de 8`,
          when: data.when || '',
          raw: data,
        });
      } else this.slots.push({ exists: false });
    }
  },
};

// ---- World population --------------------------------------------------------

function populate() {
  game.cars = [...spawnTraffic(16), ...spawnParked(12)];
  game.peds = spawnPeds(30);
}

function startGame(slotIndex, data) {
  game.slotIndex = slotIndex;
  game.cash = data ? data.cash : 240;
  game.rep = data ? data.rep : 0;
  game.heat = 0;
  game.wanted = 0;
  game.raceBests = data ? (data.raceBests || {}) : {};
  resetPolice();
  game.bullets.length = 0;
  game.grenades.length = 0;
  game.particles.length = 0;
  game.skids.length = 0;
  game.dialogue = null;
  game.bannerData = null;
  populate();
  const home = roadNear(city.hideout ? city.hideout.x : WORLD.width / 2, city.hideout ? city.hideout.y : WORLD.height / 2);
  game.player = makePlayer(home.x + 26, home.y + 30);
  game.missions = new MissionRunner(buildMissions());
  if (data) {
    game.missions.index = data.missionIndex || 0;
    game.missions.done = !!data.done;
    if (game.missions.done) game.missions.startCourier(game);
  }
  game.races = new RaceRunner(buildRaces());
  game.state = 'play';
  game.districtId = null;
  game.banner('Crimson Tide Bay', 'Marisol te espera en su casa, al noreste. Sigue el marcador turquesa.');
}

// ---- Per-frame updates ---------------------------------------------------------

function updatePlay(dt) {
  game.time += dt;
  const player = game.player;

  // Dialogue first: it eats the advance key and the click.
  if (game.dialogue && !game.dialogue.done) {
    updateDialogue(game.dialogue, dt, tapped('KeyE') || mouse.clicked);
  }

  updatePlayer(player, game, dt);
  // Screenshot staging only: a staged chase keeps rolling on its own.
  if (game.autoCruise && player.car) applyDrive(player.car, dt, 0.42, 0, player.car.model.top);

  // The car the player sits in is not traffic; keep lists in step.
  for (const car of game.cars) {
    if (car.driver === 'traffic') updateTraffic(car, dt, game);
    if (car.burning > 0) {
      car.burning -= dt;
      car.speed *= (1 - 2.4 * dt);
      if (Math.random() < 0.3) {
        game.particles.push({
          x: car.x + (Math.random() - 0.5) * 16, y: car.y - 6,
          vx: (Math.random() - 0.5) * 16, vy: -34 - Math.random() * 26,
          life: 0.7, maxLife: 0.7, color: '#4a4048', size: 5,
        });
      }
      if (car.burning <= 0 && !car.dead) {
        car.dead = true;
        game.explodeAt(car.x, car.y, 96, 115);
      }
    }
  }
  collideCars(game.cars, (a, b, f) => game.onCarImpact(a, b, f));
  for (const car of game.cars) {
    if (car.dead) continue;
    const impact = collideWorld(car);
    if (impact > 130) {
      damageCar(car, (impact - 130) * 0.22, game);
      game.spawnSparks(car.x, car.y, 5);
      if (car === player.car) {
        game.camera.shake = Math.min(10, game.camera.shake + 3);
        sfx.crash();
      }
    }
  }
  // Retire wrecks after a while so the streets stay alive.
  for (let i = game.cars.length - 1; i >= 0; i--) {
    const car = game.cars[i];
    if (car.dead) {
      car._corpse = (car._corpse || 0) + dt;
      if (car._corpse > 26 && car !== player.car) game.cars.splice(i, 1);
    }
  }

  for (const ped of game.peds) updatePed(ped, dt, game);
  // Cars versus people: the bay keeps score.
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    for (const car of game.cars) {
      if (car.dead || Math.abs(car.speed) < 26) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 19) {
        knockDown(ped);
        game.crime(car.driver === 'player' ? 55 : 8, ped.x, ped.y);
        scarePeds(game.peds, ped.x, ped.y, 210);
        if (car.driver === 'player') { game.camera.shake += 3; sfx.crash(); }
        break;
      }
    }
  }

  updatePolice(game, dt);
  game.updateHeat(dt);
  game.missions.update(game, dt);
  game.races.update(game, dt);
  updateProjectiles(dt);
  updateFx(dt);

  // Garage: Taller Calder fixes and resprays, and the law forgets a star.
  game.promptText = null;
  const p = game.playerPos();
  if (player.car) {
    const g = city.garage;
    const gp = g ? roadNear(g.x + g.w / 2, g.y + g.h / 2) : null;
    if (gp && Math.hypot(p.x - gp.x, p.y - gp.y) < 74 && Math.abs(player.car.speed) < 16) {
      game.promptText = game.cash >= 150
        ? 'Taller Calder — G: reparar y repintar ($150, −1 estrella)'
        : 'Taller Calder — necesitas $150 para el apaño';
      if (tapped('KeyG') && game.cash >= 150) {
        game.cash -= 150;
        player.car.health = 100;
        player.car.color = ['#d95f4b', '#2fa8a0', '#e8a33d', '#8a5fb8', '#4d7fa8'][Math.floor(Math.random() * 5)];
        game.heat = Math.max(0, game.heat - 55);
        game.banner('Taller Calder', 'Como nuevo. Y la poli, de pronto, busca otro coche.');
        sfx.cash();
      }
    }
    if (tapped('KeyR')) game.cycleRadio();
  } else {
    // On foot prompts.
    let nearCar = null;
    for (const car of game.cars) {
      if (!car.dead && Math.hypot(car.x - p.x, car.y - p.y) < 44) { nearCar = car; break; }
    }
    if (nearCar) game.promptText = `F — Subir al ${nearCar.model.name}`;
  }
  const raceOffer = game.races.startMark(game);
  if (raceOffer && !game.races.active) {
    game.promptText = `E — Carrera: ${raceOffer.name} (necesitas un coche)`;
    if (tapped('KeyE') && player.car) game.races.begin(game, raceOffer);
    else if (tapped('KeyE')) game.banner(raceOffer.name, 'Vuelve con un coche robado… o tuyo. Nadie pregunta.');
  }

  // District title cards.
  const d = districtAt(p.x, p.y);
  if (d && d.id !== game.districtId) {
    game.districtId = d.id;
    game.districtCard = { name: d.name, tag: d.tag, t: 0 };
  }
  if (game.districtCard) {
    game.districtCard.t += dt;
    if (game.districtCard.t > 2.9) game.districtCard = null;
  }
  if (game.bannerData) {
    game.bannerData.t += dt;
    if (game.bannerData.t > game.bannerData.max) game.bannerData = null;
  }
  game.hurtFlash = Math.max(0, game.hurtFlash - dt * 2.4);

  // Camera: follow with a little lead toward velocity, plus shake.
  const vel = game.playerVel();
  const tx = p.x + vel.x * 0.32 - canvas.width / 2;
  const ty = p.y + vel.y * 0.32 - canvas.height / 2;
  game.camera.x += (tx - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (ty - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = Math.max(0, Math.min(WORLD.width - canvas.width, game.camera.x));
  game.camera.y = Math.max(0, Math.min(WORLD.height - canvas.height, game.camera.y));
  game.camera.shake = Math.max(0, game.camera.shake - dt * 26);

  // Sound of the moment.
  setEngine(!!player.car, player.car ? Math.abs(player.car.speed) / player.car.model.top : 0);
  setSiren(game.wanted > 0 && nearestCopDist(game) < 430);

  // Autosave trickle.
  if (game.saveTimer > 0) {
    game.saveTimer -= dt;
    if (game.saveTimer <= 0) game.saveGame();
  }

  if (tapped('KeyP') || tapped('Escape')) game.state = 'pause';
  if (tapped('KeyM') || tapped('Tab')) game.state = 'map';
}

function updateProjectiles(dt) {
  // Bullets.
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let kill = b.life <= 0;
    if (!kill) {
      for (const bd of city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { kill = true; break; }
      }
    }
    if (!kill && b.from === 'player') {
      for (const car of game.cars) {
        if (car.dead) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 25) {
          damageCar(car, b.dmg, game);
          game.spawnSparks(b.x, b.y, 3);
          if (car.driver === 'cop') game.crime(24, car.x, car.y);
          kill = true;
          break;
        }
      }
      if (!kill) {
        for (const ped of game.peds) {
          if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
            knockDown(ped);
            game.crime(65, ped.x, ped.y);
            scarePeds(game.peds, ped.x, ped.y, 230);
            kill = true;
            break;
          }
        }
      }
    }
    if (!kill && b.from === 'cop') {
      const p = game.playerPos();
      if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        hurtPlayer(game.player, b.dmg, game);
        kill = true;
      }
    }
    if (kill) game.bullets.splice(i, 1);
  }
  // Grenades.
  for (let i = game.grenades.length - 1; i >= 0; i--) {
    const gr = game.grenades[i];
    gr.x += gr.vx * dt;
    gr.y += gr.vy * dt;
    gr.vx *= (1 - 2.2 * dt);
    gr.vy *= (1 - 2.2 * dt);
    gr.fuse -= dt;
    if (gr.fuse <= 0) {
      game.explodeAt(gr.x, gr.y, 104, 135);
      game.grenades.splice(i, 1);
    }
  }
}

function updateFx(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 1.6 * dt);
    p.vy *= (1 - 1.6 * dt);
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.flashes.length - 1; i >= 0; i--) {
    game.flashes[i].life -= dt;
    if (game.flashes[i].life <= 0) game.flashes.splice(i, 1);
  }
  for (let i = game.muzzles.length - 1; i >= 0; i--) {
    game.muzzles[i].life -= dt;
    if (game.muzzles[i].life <= 0) game.muzzles.splice(i, 1);
  }
}

// ---- Screens -------------------------------------------------------------------

function respawnAt(building, healthBack) {
  resetPolice();
  game.heat = 0;
  game.wanted = 0;
  if (game.player.car) {
    game.player.car.driver = 'parked';
    game.player.car = null;
  }
  const spot = building ? roadNear(building.x + building.w / 2, building.y + building.h / 2) : { x: WORLD.width / 2, y: WORLD.height / 2 };
  game.player.x = spot.x + 20;
  game.player.y = spot.y + 24;
  game.player.health = healthBack;
  game.player.dead = false;
  game.state = 'play';
  game.saveSoon();
}

function updateEnd(kind, dt) {
  void dt;
  if (tapped('Enter')) {
    if (kind === 'busted') respawnAt(city.policeStation, 80);
    else respawnAt(city.hospital, 100);
  }
}

function updateTitle(dt) {
  game.time += dt;
  if (mouse.clicked && game.slotRects.length) {
    for (let i = 0; i < 3; i++) {
      const r = game.slotRects[i];
      if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
        const slot = game.slots[i];
        startGame(i, slot.exists ? slot.raw : null);
        return;
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    if (tapped('Digit' + (i + 1))) {
      const slot = game.slots[i];
      startGame(i, slot.exists ? slot.raw : null);
      return;
    }
  }
}

// ---- Staged scenes for the screenshots ------------------------------------------

function stageScene(scene) {
  startGame(-1, null);
  const centro = roadNear(WORLD.width / 2, WORLD.height / 2);
  if (scene === 'chase') {
    game.cash = 1875;
    game.rep = 210;
    const car = makeCar(centro.x, centro.y, 0, 2, 'player');
    car.speed = 168;
    game.addCar(car);
    // Clear the lane ahead and behind so the chase reads cleanly.
    game.cars = game.cars.filter((c) => c === car || Math.hypot(c.x - car.x, c.y - car.y) > 240);
    game.player.car = car;
    game.player.x = car.x; game.player.y = car.y;
    game.missions.index = 0;
    game.missions.activate(game, 1); // mid-delivery, mission card populated
    game.setWanted(3);
    game.pinWanted = 3;
    const homeDistrict = districtAt(car.x, car.y);
    if (homeDistrict) game.districtId = homeDistrict.id; // no title card over the action
    // Cast the pursuit: two units behind, a roadblock ahead, the heli above.
    const mk = (dx, dy, name, role, model) => {
      const c = makeCar(car.x + dx, car.y + dy, 0, model, 'cop');
      c.color = model === 4 ? '#22303c' : '#eef2ee';
      c.health = 130;
      c.unitName = name;
      c.role = role;
      c.speed = 150;
      game.addCar(c);
      police.units.push(c);
      return c;
    };
    mk(-96, -50, 'MARLIN 4', 'PURSUIT', 1);
    mk(-142, 42, 'MARLIN 2', 'PURSUIT', 1);
    mk(252, -28, 'MURO 1', 'ROADBLOCK', 1).angle = Math.PI / 2;
    mk(252, 26, 'MURO 2', 'ROADBLOCK', 1).angle = Math.PI / 2;
    police.units[2].speed = 0;
    police.units[3].speed = 0;
    police.blocks.push({ x: car.x + 252, y: car.y, cars: [police.units[2], police.units[3]] });
    police.heli = { x: car.x + 120, y: car.y - 130, angle: 0, phase: 1 };
    // A wreck already burning on the shoulder, for the light it throws.
    const wreck = makeCar(car.x + 178, car.y + 92, 0.7, 5, 'parked');
    game.addCar(wreck);
    wreck.health = 1;
    damageCar(wreck, 5, game);
    game.autoCruise = true;
    game.radioIdx = 0;
    game.radioStation = STATIONS[0];
    game.bannerData = null;
    game.camera.x = car.x - canvas.width / 2;
    game.camera.y = car.y - canvas.height / 2;
  } else if (scene === 'mission') {
    game.cash = 1240;
    game.rep = 130;
    game.missions.index = 2; // Metal Caliente, given by Tito at the garage
    const g = city.garage;
    const gp = roadNear(g.x + g.w / 2, g.y + g.h / 2);
    game.player.x = gp.x + 14;
    game.player.y = gp.y + 18;
    const car = makeCar(gp.x - 60, gp.y + 6, 0.3, 0, 'parked');
    game.addCar(car);
    game.setWanted(2);
    game.pinWanted = 2;
    const cop = makeCar(gp.x - 210, gp.y - 90, 0.6, 1, 'cop');
    cop.color = '#eef2ee';
    cop.unitName = 'MARLIN 2';
    cop.role = 'PURSUIT';
    game.addCar(cop);
    police.units.push(cop);
    game.missions.tryStart(game);
    game.bannerData = null;
    const md = districtAt(game.player.x, game.player.y);
    if (md) game.districtId = md.id; // no title card over the conversation
    game.camera.x = game.player.x - canvas.width / 2;
    game.camera.y = game.player.y - canvas.height / 2;
  } else if (scene === 'map') {
    game.cash = 2310;
    game.rep = 355;
    game.missions.index = 3;
    game.state = 'map';
  }
}

// ---- Boot and loop -----------------------------------------------------------------

game.loadSlots();
const params = new URLSearchParams(location.search);
const scene = params.get('scene');
if (scene && scene !== 'title') stageScene(scene);

window.addEventListener('pointerdown', () => { initAudio(); resumeAudio(); }, { once: false });
window.addEventListener('keydown', () => { initAudio(); resumeAudio(); }, { once: false });

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.001;

  const shakeX = game.camera.shake ? (Math.random() - 0.5) * game.camera.shake : 0;
  const shakeY = game.camera.shake ? (Math.random() - 0.5) * game.camera.shake : 0;

  if (game.state === 'title') {
    updateTitle(dt);
    drawTitleScreen(ctx, game);
  } else if (game.state === 'play') {
    updatePlay(dt);
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawWorld(ctx, game);
    ctx.restore();
    applyGrade(ctx, canvas.width, canvas.height);
    drawHUD(ctx, game);
  } else if (game.state === 'pause') {
    if (tapped('KeyP') || tapped('Escape')) game.state = 'play';
    if (tapped('KeyM') || tapped('Tab')) game.state = 'map';
    if (tapped('KeyS')) { game.saveGame(); game.banner('Guardado', 'La partida está a salvo.'); }
    if (tapped('KeyT')) { game.saveGame(); game.loadSlots(); game.state = 'title'; }
    drawWorld(ctx, game);
    applyGrade(ctx, canvas.width, canvas.height);
    drawPauseScreen(ctx, game);
  } else if (game.state === 'map') {
    if (tapped('KeyM') || tapped('Tab') || tapped('Escape')) game.state = 'play';
    drawWorld(ctx, game);
    applyGrade(ctx, canvas.width, canvas.height);
    drawMapScreen(ctx, game);
  } else if (game.state === 'busted' || game.state === 'wasted') {
    updateEnd(game.state, dt);
    drawWorld(ctx, game);
    applyGrade(ctx, canvas.width, canvas.height);
    drawEndScreen(ctx, game, game.state);
  }
  clearTaps();
}
requestAnimationFrame(frame);
