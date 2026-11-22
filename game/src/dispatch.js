// Crimson Tide Bay — the dispatch panel.
// One job: turn the police roster into the radio-traffic readout the
// winners' HUDs all carry — named units, tactical roles, live distances,
// nearest first. Pure data; the render draws what this returns.

import { police } from './police.js';

export function dispatchRows(game, maxRows = 4) {
  const p = game.playerPos();
  const rows = [];
  for (const u of police.units) {
    if (u.dead) continue;
    rows.push({
      name: u.unitName || 'UNIDAD',
      role: u.role || 'PURSUIT',
      dist: Math.round(Math.hypot(u.x - p.x, u.y - p.y) / 4), // game metres
      kind: 'car',
    });
  }
  if (police.heli) {
    rows.push({
      name: 'HALCÓN 1',
      role: 'SPOTLIGHT',
      dist: Math.round(Math.hypot(police.heli.x - p.x, police.heli.y - p.y) / 4),
      kind: 'heli',
    });
  }
  rows.sort((a, b) => a.dist - b.dist);
  return rows.slice(0, maxRows);
}

// The one-line dispatch chatter that scrolls under the panel now and then.
const CHATTER = [
  'Control: todas las unidades, sospechoso en movimiento.',
  'Control: mantengan la distancia, no lo pierdan.',
  'HALCÓN 1: lo tengo en la luz, repito, en la luz.',
  'MURO 1: bloqueo listo, que venga.',
  'Control: el sujeto es Ruy Calder, prioridad alta.',
  'MARLIN 4: voy por el flanco, cúbranme.',
];

export function dispatchChatter(game) {
  if (game.wanted <= 0) return null;
  const idx = Math.floor(game.time / 9) % CHATTER.length;
  return CHATTER[idx];
}
