// Crimson Tide Bay — the work: eight story missions and endless courier jobs.
// One job: define the jobs Marisol, Tito and La Perla hand out, run their
// stages against the live world (go here, fetch this, steal that, lose
// the law), and pay out cash and REP when the work is done.

import { WORLD, repTier } from './config.js';
import { city, roadCenterX, roadCenterY } from './city.js';
import { districtById, districtCenter } from './districts.js';
import { makeDialogue } from './crew.js';
import { makeCar } from './vehicles.js';
import { sfx } from './audio.js';

// Snap a point to the nearest road centre line so markers sit on asphalt.
export function roadNear(x, y) {
  const lx = x - WORLD.sandRim, ly = y - WORLD.sandRim;
  const i = Math.max(0, Math.min(WORLD.blocksX, Math.round(lx / WORLD.pitch)));
  const j = Math.max(0, Math.min(WORLD.blocksY, Math.round(ly / WORLD.pitch)));
  const cx = roadCenterX(i), cy = roadCenterY(j);
  return Math.abs(cx - x) < Math.abs(cy - y) ? { x: cx, y } : { x, y: cy };
}

function frontOf(building) {
  if (!building) return { x: WORLD.width / 2, y: WORLD.height / 2 };
  return roadNear(building.x + building.w / 2, building.y + building.h / 2);
}

function districtPoint(id) {
  return roadNear(districtCenter(districtById(id)).x, districtCenter(districtById(id)).y);
}

export function buildMissions() {
  const hideout = frontOf(city.hideout);
  const garage = frontOf(city.garage);
  const hospital = frontOf(city.hospital);
  const faro = roadNear(city.lighthouse.x - 60, city.lighthouse.y - 30);
  const puerto = districtPoint('puerto');
  const muelles = districtPoint('muelles');
  const centro = districtPoint('centro');
  const mercado = districtPoint('mercado');
  const ceniza = districtPoint('ceniza');
  const costa = districtPoint('costa');
  const paseo = districtPoint('paseo');
  void hospital;

  return [
    {
      id: 'marea', title: 'Primera Marea', giver: 'marisol', at: hideout, reward: 350, rep: 30,
      intro: [
        ['marisol', 'Ruy. You owe the bay three thousand and your car smells of someone else\'s petrol. Earn it back.'],
        ['ruy', 'One job at a time, Marisol. What is it?'],
        ['marisol', 'A package waits at Puerto Alba. Bring it to Tito at the Taller. Quietly.'],
      ],
      stages: [
        { type: 'goto', text: 'Pick up the package at Puerto Alba', at: puerto },
        { type: 'goto', text: 'Deliver it to Taller Calder', at: garage },
      ],
    },
    {
      id: 'cajas', title: 'Tres Cajas', giver: 'marisol', at: hideout, reward: 600, rep: 40,
      intro: [
        ['marisol', 'Three crates fell off a boat that never existed. Mercado, Centro, Ceniza. All three, then home.'],
        ['ruy', 'And if someone asks what is inside?'],
        ['marisol', 'Then you drive faster, mi amor.'],
      ],
      stages: [
        { type: 'collect', text: 'Collect the three crates', points: [mercado, centro, ceniza] },
        { type: 'goto', text: 'Bring the crates to Casa de Marisol', at: hideout },
      ],
    },
    {
      id: 'metal', title: 'Metal Caliente', giver: 'tito', at: garage, reward: 800, rep: 45,
      intro: [
        ['tito', 'A Relámpago sleeps in Centro Coral, keys in, owner in church. It should sleep in my garage instead.'],
        ['ruy', 'Stealing from the faithful, Tito?'],
        ['tito', 'He insured it twice, Ruy. God and the company both pay.'],
      ],
      stages: [
        { type: 'steal', text: 'Steal the Relámpago in Centro Coral', at: centro, model: 4 },
        { type: 'deliver', text: 'Deliver the Relámpago to Taller Calder', at: garage },
      ],
    },
    {
      id: 'deposito', title: 'Depósito Nocturno', giver: 'perla', at: muelles, reward: 900, rep: 50,
      intro: [
        ['perla', 'The night deposit, Ruy. Banco del Mar closes its books at dusk — the bag must be inside before.'],
        ['ruy', 'And the bag is heavy because…?'],
        ['perla', 'Because money is heavy, cariño. That is the whole tragedy.'],
      ],
      stages: [
        { type: 'goto', text: 'Reach Banco del Mar before the timer dies', at: centro, timer: 80 },
        { type: 'goto', text: 'Bring the receipt to La Perla at the docks', at: muelles, timer: 65 },
      ],
    },
    {
      id: 'sirenas', title: 'Sirenas al Alba', giver: 'marisol', at: hideout, reward: 1100, rep: 55,
      intro: [
        ['marisol', 'A friend waits at the harbour with a suitcase and a problem. The problem wears a uniform.'],
        ['ruy', 'You could have led with the uniform.'],
        ['marisol', 'Pick him up, lose the sirens, bring him home. Simple, like drowning.'],
      ],
      stages: [
        { type: 'goto', text: 'Pick up Marisol\'s friend at Puerto Alba', at: puerto, setWanted: 2 },
        { type: 'escape', text: 'Lose the police — break their line of sight' },
        { type: 'goto', text: 'Bring him to Casa de Marisol', at: hideout },
      ],
    },
    {
      id: 'doble', title: 'Doble Entrega', giver: 'perla', at: muelles, reward: 1000, rep: 55,
      intro: [
        ['perla', 'Two drops, one evening, no questions. Paseo first, then the beach. The clock is the only cop I fear.'],
        ['ruy', 'You fear nothing, Inés.'],
        ['perla', 'Then drive like me.'],
      ],
      stages: [
        { type: 'goto', text: 'First drop: Paseo del Mar', at: paseo, timer: 85 },
        { type: 'goto', text: 'Second drop: Costa Dorada', at: costa, timer: 75 },
      ],
    },
    {
      id: 'camino', title: 'El Largo Camino', giver: 'tito', at: garage, reward: 1300, rep: 65,
      intro: [
        ['tito', 'Medicine for the lighthouse keeper\'s kid. The pharmacy is on Costa Dorada; the faro is the whole island away.'],
        ['ruy', 'And the police checkpoints on the coast road?'],
        ['tito', 'Smile at them. From very far away. At speed.'],
      ],
      stages: [
        { type: 'goto', text: 'Collect the medicine at Costa Dorada', at: costa },
        { type: 'goto', text: 'Cross the island to Faro Quemado', at: faro, timer: 150, setWanted: 2 },
      ],
    },
    {
      id: 'salida', title: 'La Gran Salida', giver: 'marisol', at: hideout, reward: 1500, rep: 80,
      intro: [
        ['marisol', 'Last job, Ruy. An armoured Gaviota sleeps at the east docks, full of other people\'s retirements.'],
        ['ruy', 'And my debt?'],
        ['marisol', 'Bring the van to the boat at Puerto Alba and the debt drowns tonight. So does the old Ruy.'],
      ],
      stages: [
        { type: 'steal', text: 'Steal the armoured Gaviota at Muelles del Este', at: muelles, model: 3, tough: true },
        { type: 'deliver', text: 'Reach the boat at Puerto Alba', at: puerto, setWanted: 3 },
      ],
    },
  ];
}

export class MissionRunner {
  constructor(missions) {
    this.missions = missions;
    this.index = 0;
    this.state = 'idle';      // 'idle' | 'active' | 'courier'
    this.mission = null;
    this.stageIdx = 0;
    this.collected = 0;
    this.timer = null;
    this.targetCar = null;
    this.courier = null;      // {stage:'pickup'|'deliver', at, pay}
    this.done = false;        // whole story finished
  }

  stage() {
    return this.mission ? this.mission.stages[this.stageIdx] : null;
  }

  giverMark() {
    if (this.done) return null;
    if (this.state === 'idle') {
      const m = this.missions[this.index];
      return m ? { x: m.at.x, y: m.at.y, label: m.giver } : null;
    }
    return null;
  }

  objective() {
    if (this.state === 'idle') {
      const g = this.giverMark();
      const m = this.missions[this.index];
      if (!g || !m) return null;
      return { x: g.x, y: g.y, text: `New work: ${m.title}`, sub: 'Drive to the marker to talk' };
    }
    if (this.state === 'courier' && this.courier) {
      return {
        x: this.courier.at.x, y: this.courier.at.y,
        text: this.courier.stage === 'pickup' ? 'Courier: pick up the parcel' : 'Courier: make the delivery',
        sub: `$${this.courier.pay} on delivery`,
      };
    }
    const s = this.stage();
    if (!s) return null;
    if (s.type === 'escape') {
      return { x: null, y: null, text: s.text, sub: 'Stay out of sight until the stars fade' };
    }
    if (s.type === 'collect') {
      const pt = s.points[this.collected];
      if (!pt) return null;
      return { x: pt.x, y: pt.y, text: `${s.text} (${this.collected}/${s.points.length})`, sub: 'Crate marked on the map' };
    }
    return { x: s.at.x, y: s.at.y, text: s.text, sub: this.mission ? this.mission.title : '' };
  }

  tryStart(game) {
    if (game.dialogue && !game.dialogue.done) return false;
    const g = this.giverMark();
    if (!g) return false;
    const p = game.playerPos();
    if (Math.hypot(p.x - g.x, p.y - g.y) > 52) return false;
    const m = this.missions[this.index];
    this.mission = m;
    game.dialogue = makeDialogue(m.intro, () => this.activate(game, 0));
    return true;
  }

  activate(game, stageIdx) {
    if (!this.mission) this.mission = this.missions[this.index];
    this.state = 'active';
    this.stageIdx = stageIdx;
    this.collected = 0;
    const s = this.stage();
    this.timer = s && s.timer ? s.timer : null;
    if (s && s.setWanted) game.setWanted(s.setWanted);
    if (s && s.type === 'steal') {
      const car = makeCar(s.at.x + 30, s.at.y + 10, Math.PI / 2, s.model || 0, 'target');
      car.color = '#f2f2f2';
      if (s.tough) { car.health = 280; car.color = '#3c4652'; }
      this.targetCar = car;
      game.addCar(car);
    }
    if (s && s.type === 'collect') sfx.pickup();
  }

  advance(game) {
    const s = this.stage();
    void s;
    if (this.stageIdx + 1 >= this.mission.stages.length) this.complete(game);
    else this.activate(game, this.stageIdx + 1);
  }

  complete(game) {
    const m = this.mission;
    const pay = Math.round(m.reward * (1 + repTier(game.rep).payBonus));
    game.earn(pay, m.rep);
    game.banner(`${m.title} — done`, `${m.giver === 'tito' ? 'Tito' : m.giver === 'perla' ? 'La Perla' : 'Marisol'} paid you $${pay}. REP +${m.rep}.`);
    sfx.cash();
    this.mission = null;
    this.targetCar = null;
    this.index++;
    this.state = 'idle';
    if (this.index >= this.missions.length) {
      this.done = true;
      game.banner('La bahía es tuya', 'The debt is paid. Courier work stays open at the harbour.');
      this.startCourier(game);
    }
    game.saveSoon();
  }

  fail(game, reason) {
    game.banner('Job failed', reason);
    this.mission = null;
    this.targetCar = null;
    this.state = 'idle';
    this.timer = null;
  }

  startCourier(game) {
    const a = districtPointRandom();
    let b = districtPointRandom();
    let guard = 0;
    while (Math.hypot(a.x - b.x, a.y - b.y) < 700 && guard++ < 8) b = districtPointRandom();
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    this.courier = { stage: 'pickup', at: a, drop: b, pay: Math.round(140 + dist / 4) };
    this.state = 'courier';
    void game;
  }

  update(game, dt) {
    if (this.state === 'idle') {
      if (!this.done) this.tryStart(game);
      else if (!this.courier) this.startCourier(game);
      return;
    }
    if (this.state === 'courier') {
      const p = game.playerPos();
      const c = this.courier;
      if (c && Math.hypot(p.x - c.at.x, p.y - c.at.y) < 48) {
        if (c.stage === 'pickup') {
          c.stage = 'deliver';
          c.at = c.drop;
          sfx.pickup();
          game.banner('Courier work', 'Parcel aboard. Deliver it across the bay.');
        } else {
          game.earn(c.pay, 6);
          sfx.cash();
          game.banner('Delivered', `Courier fare $${c.pay}. Another parcel already waits.`);
          this.courier = null;
          this.startCourier(game);
          game.saveSoon();
        }
      }
      return;
    }
    // Active story mission.
    if (game.dialogue && !game.dialogue.done) return;
    const s = this.stage();
    if (!s) return;
    if (this.timer !== null) {
      this.timer -= dt;
      if (this.timer <= 0) { this.fail(game, 'The clock ran out. The job is off — come back and try again.'); return; }
    }
    const p = game.playerPos();
    if (s.type === 'goto') {
      if (Math.hypot(p.x - s.at.x, p.y - s.at.y) < 50) this.advance(game);
    } else if (s.type === 'collect') {
      const pt = s.points[this.collected];
      if (pt && Math.hypot(p.x - pt.x, p.y - pt.y) < 40) {
        this.collected++;
        sfx.pickup();
        if (this.collected >= s.points.length) this.advance(game);
      }
    } else if (s.type === 'steal') {
      if (this.targetCar && this.targetCar.dead) { this.fail(game, 'The car burned. The job needed it whole.'); return; }
      if (game.player.car && game.player.car === this.targetCar) this.advance(game);
    } else if (s.type === 'deliver') {
      if (this.targetCar && this.targetCar.dead) { this.fail(game, 'The car burned. The job needed it whole.'); return; }
      if (game.player.car && game.player.car === this.targetCar
          && Math.hypot(p.x - s.at.x, p.y - s.at.y) < 62) this.advance(game);
    } else if (s.type === 'escape') {
      if (game.wanted === 0) this.advance(game);
    }
  }
}

function districtPointRandom() {
  const ids = ['palmera', 'mercado', 'puerto', 'ceniza', 'centro', 'muelles', 'costa', 'paseo', 'faro'];
  const id = ids[Math.floor(Math.random() * ids.length)];
  return districtPoint(id);
}

export function missionProgress(runner) {
  // For the map screen: story completion as a percentage.
  const total = runner.missions.length;
  const doneCount = runner.done ? total : runner.index;
  return Math.round((doneCount / total) * 100);
}
