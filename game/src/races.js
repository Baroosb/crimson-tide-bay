// Crimson Tide Bay — street races: two unsanctioned loops of the island.
// One job: the race definitions, the rival drivers who run them with
// you, checkpoint bookkeeping, positions, and the best-time bragging
// rights that live in the save file.

import { roadCenterX, roadCenterY } from './city.js';
import { makeCar, driveToward } from './vehicles.js';
import { sfx } from './audio.js';

function cp(i, j) { return { x: roadCenterX(i), y: roadCenterY(j) }; }

export function buildRaces() {
  return [
    {
      id: 'faro', name: 'Vuelta al Faro', laps: 1,
      blurb: 'The whole island, one loop, no brakes worth mentioning.',
      checkpoints: [cp(1, 7), cp(1, 1), cp(5, 1), cp(9, 1), cp(9, 7), cp(5, 7)],
      start: cp(1, 7),
    },
    {
      id: 'coral', name: 'Circuito Coral', laps: 2,
      blurb: 'Two tight laps around Centro Coral. The walls are close and so is second place.',
      checkpoints: [cp(3, 5), cp(3, 3), cp(7, 3), cp(7, 5)],
      start: cp(3, 5),
    },
  ];
}

export class RaceRunner {
  constructor(races) {
    this.races = races;
    this.active = null;   // {race, cpIdx, lap, time, rivals[], finished}
    this.countdown = 0;
  }

  startMark(game) {
    if (this.active) return null;
    // Offer whichever race start the player is standing near.
    for (const r of this.races) {
      const p = game.playerPos();
      if (Math.hypot(p.x - r.start.x, p.y - r.start.y) < 60) return r;
    }
    return null;
  }

  begin(game, race) {
    const rivals = [];
    const startAngle = 0;
    for (let k = 0; k < 2; k++) {
      const car = makeCar(
        race.start.x - 40 - k * 52, race.start.y + (k === 0 ? -24 : 24),
        startAngle, k === 0 ? 6 : 2, 'rival',
      );
      car.health = 160;
      car.raceCp = 0;
      rivals.push(car);
      game.addCar(car);
    }
    this.active = {
      race, cpIdx: 0, lap: 1, time: 0, rivals, finished: false, playerCp: 0,
    };
    this.countdown = 3.2;
    game.banner(race.name, race.blurb);
  }

  playerProgress() {
    const a = this.active;
    if (!a) return 0;
    return (a.lap - 1) * a.race.checkpoints.length + a.playerCp;
  }

  rivalProgress(rival, game) {
    const a = this.active;
    const cps = a.race.checkpoints;
    const next = cps[rival.raceCp % cps.length];
    const d = Math.hypot(rival.x - next.x, rival.y - next.y);
    return rival.raceCp * 1000 - d;
  }

  position(game) {
    const a = this.active;
    if (!a) return null;
    const mine = this.playerProgress() * 1000
      - Math.hypot(game.playerPos().x - a.race.checkpoints[a.playerCp % a.race.checkpoints.length].x,
                    game.playerPos().y - a.race.checkpoints[a.playerCp % a.race.checkpoints.length].y);
    let pos = 1;
    for (const r of a.rivals) if (this.rivalProgress(r, game) > mine) pos++;
    return pos;
  }

  objective() {
    const a = this.active;
    if (!a) return null;
    const cp = a.race.checkpoints[a.playerCp % a.race.checkpoints.length];
    return {
      x: cp.x, y: cp.y,
      text: `${a.race.name} — checkpoint ${a.playerCp + 1}/${a.race.checkpoints.length * a.race.laps}`,
      sub: `Position ${this.positionCache || '—'} · lap ${a.lap}/${a.race.laps}`,
    };
  }

  update(game, dt) {
    const a = this.active;
    if (!a) return;
    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount && n > 0) { this.lastCount = n; game.banner(String(n), a.race.name); sfx.checkpoint(); }
      if (this.countdown <= 0) { game.banner('¡VAMOS!', a.race.name); sfx.cash(); }
      return;
    }
    a.time += dt;
    const cps = a.race.checkpoints;
    const p = game.playerPos();

    // Player checkpoints.
    const target = cps[a.playerCp % cps.length];
    if (Math.hypot(p.x - target.x, p.y - target.y) < 78) {
      a.playerCp++;
      sfx.checkpoint();
      if (a.playerCp >= cps.length) {
        a.playerCp = 0;
        a.lap++;
        if (a.lap > a.race.laps) { this.finish(game, true); return; }
        game.banner(`Lap ${a.lap}`, a.race.name);
      }
    }
    this.positionCache = this.position(game);

    // Rivals: chase their next checkpoint with a little rubber in the band.
    const myProg = this.playerProgress();
    for (const r of a.rivals) {
      if (r.dead) continue;
      const rc = cps[r.raceCp % cps.length];
      if (Math.hypot(r.x - rc.x, r.y - rc.y) < 82) r.raceCp++;
      const progDiff = (r.raceCp - (myProg + a.playerCp * 0)) ;
      void progDiff;
      const rubber = r.raceCp * 1.0 < myProg ? 1.06 : 0.97;
      driveToward(r, rc.x, rc.y, dt, r.model.top * 0.88 * rubber);
    }
  }

  finish(game, won) {
    const a = this.active;
    const pos = this.positionCache || 2;
    const best = game.raceBests[a.race.id];
    if (!best || a.time < best) game.raceBests[a.race.id] = Math.round(a.time * 10) / 10;
    if (pos === 1) {
      game.earn(500, 25);
      game.banner(`¡PRIMERO! ${a.race.name}`, `You won in ${a.time.toFixed(1)}s — $500 and the bay knows your name.`);
    } else {
      game.banner(`${a.race.name} — position ${pos}`, `Finished in ${a.time.toFixed(1)}s. The trophy stays warm for next time.`);
    }
    sfx.cash();
    for (const r of a.rivals) r.driver = 'traffic';
    this.active = null;
    game.saveSoon();
    void won;
  }

  abort(game) {
    if (!this.active) return;
    for (const r of this.active.rivals) r.driver = 'traffic';
    this.active = null;
    game.banner('Race off', 'You left the loop. The start line keeps.');
  }
}
