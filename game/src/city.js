// Crimson Tide Bay — the island city itself: blocks, buildings, roads.
// One job: generate the static city once (seeded, so it never changes),
// hand out geometry answers (where are the roads? what did I just hit?),
// and name the landmark buildings the story leans on.

import { WORLD, PALETTE } from './config.js';
import { srand, rnd, randRange, randInt, pick, chance } from './random.js';
import { districtAt } from './districts.js';

export const ROOF_COLORS = [
  '#e2725b', '#d95f4b', '#e8e3d8', '#cbb9a0', '#b8524a', '#e39a54',
  '#8fb8ad', '#d9cfc0', '#c96f4a', '#a85751', '#e5d3ac', '#7d9dbd',
];
export const WALL_SOUTH = '#b98a63';
export const WALL_EAST = '#96684a';

const SHOP_NAMES = [
  'Café Brasa', 'Farmacia Sol', 'Taller Calder', 'Banco del Mar', 'Hotel Coral',
  'Pescadería Alba', 'Licores Faro', 'Panadería Ceniza', 'Joyas Marea',
  'Club Náutico', 'Cine Palmera', 'Mercado 9', 'Bar La Ola', 'Dulces Inés',
  'Ferretería Bravo', 'Librería Salitre', 'Gimnasio Toro', 'Flores Vega',
];

export const city = {
  buildings: [],   // {x,y,w,h,lift,roof,props[],sign|null,landmark|null}
  palms: [],       // {x,y,s}
  lamps: [],       // {x,y}
  blocks: [],      // {x,y,kind} kind: 'build' | 'park' | 'parking'
  garage: null,    // landmark rect + pad
  policeStation: null,
  hospital: null,
  hideout: null,
  lighthouse: null,
};

export function blockOrigin(i, j) {
  return {
    x: WORLD.sandRim + WORLD.roadWidth + i * WORLD.pitch,
    y: WORLD.sandRim + WORLD.roadWidth + j * WORLD.pitch,
  };
}
export function roadCenterX(i) { // vertical road i, i in 0..blocksX
  return WORLD.sandRim + i * WORLD.pitch + WORLD.roadWidth / 2;
}
export function roadCenterY(j) { // horizontal road j, j in 0..blocksY
  return WORLD.sandRim + j * WORLD.pitch + WORLD.roadWidth / 2;
}

export function isOnRoad(x, y) {
  const lx = x - WORLD.sandRim, ly = y - WORLD.sandRim;
  if (lx < 0 || ly < 0 || lx > WORLD.gridW || ly > WORLD.gridH) return false;
  const mx = lx % WORLD.pitch, my = ly % WORLD.pitch;
  return mx < WORLD.roadWidth || my < WORLD.roadWidth;
}

export function onIsland(x, y) {
  const m = 46;
  return x > m && y > m && x < WORLD.width - m && y < WORLD.height - m;
}

// Push a circle out of every building it overlaps; returns corrected point.
export function collideBuildings(x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the box: push out through the nearest face.
        const left = x - b.x, right = b.x + b.w - x;
        const top = y - b.y, bot = b.y + b.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

export function randomRoadPoint() {
  // A point on a random road, away from the map edge.
  if (chance(0.5)) {
    const i = randInt(1, WORLD.blocksX - 1);
    return { x: roadCenterX(i) + randRange(-20, 20), y: randRange(WORLD.sandRim + 80, WORLD.height - WORLD.sandRim - 80) };
  }
  const j = randInt(1, WORLD.blocksY - 1);
  return { x: randRange(WORLD.sandRim + 80, WORLD.width - WORLD.sandRim - 80), y: roadCenterY(j) + randRange(-20, 20) };
}

function makeBuilding(x, y, w, h, district) {
  const lift = randRange(7, 15) + (district && district.id === 'centro' ? randRange(6, 16) : 0);
  const props = [];
  const propCount = randInt(1, 4);
  for (let k = 0; k < propCount; k++) {
    props.push({
      type: pick(['ac', 'ac', 'skylight', 'tank', 'pool', 'vent']),
      dx: randRange(6, Math.max(7, w - 26)),
      dy: randRange(6, Math.max(7, h - 26)),
      w: randRange(12, 24),
      h: randRange(10, 18),
    });
  }
  return {
    x, y, w, h, lift,
    roof: pick(ROOF_COLORS),
    props,
    sign: null,
    landmark: null,
  };
}

export function buildCity() {
  srand(20261122);
  city.buildings.length = 0;
  city.palms.length = 0;
  city.lamps.length = 0;
  city.blocks.length = 0;
  const usedSigns = new Set();

  for (let j = 0; j < WORLD.blocksY; j++) {
    for (let i = 0; i < WORLD.blocksX; i++) {
      const o = blockOrigin(i, j);
      const district = districtAt(o.x + 10, o.y + 10);
      const rollKind = rnd();
      const kind = rollKind < 0.1 ? 'park' : rollKind < 0.18 ? 'parking' : 'build';
      city.blocks.push({ x: o.x, y: o.y, kind, i, j });

      if (kind === 'build') {
        const layout = randInt(1, 3);
        if (layout === 1) {
          city.buildings.push(makeBuilding(o.x + 14, o.y + 14, WORLD.blockSize - 28, WORLD.blockSize - 28, district));
        } else if (layout === 2) {
          const w = (WORLD.blockSize - 40) / 2;
          city.buildings.push(makeBuilding(o.x + 12, o.y + 14, w, WORLD.blockSize - 28, district));
          city.buildings.push(makeBuilding(o.x + 26 + w, o.y + 14, w, WORLD.blockSize - 28, district));
        } else {
          const w = (WORLD.blockSize - 40) / 2;
          const h = (WORLD.blockSize - 40) / 2;
          city.buildings.push(makeBuilding(o.x + 12, o.y + 12, w, h, district));
          city.buildings.push(makeBuilding(o.x + 26 + w, o.y + 12, w, h, district));
          city.buildings.push(makeBuilding(o.x + 12, o.y + 26 + h, w, h, district));
          city.buildings.push(makeBuilding(o.x + 26 + w, o.y + 26 + h, w, h, district));
        }
      }
      // Palms cluster on parks, beach blocks and random sidewalks.
      const palmCount = kind === 'park' ? randInt(4, 7) : randInt(0, 2);
      for (let k = 0; k < palmCount; k++) {
        city.palms.push({
          x: o.x + randRange(14, WORLD.blockSize - 14),
          y: o.y + randRange(14, WORLD.blockSize - 14),
          s: randRange(0.8, 1.3),
        });
      }
    }
  }

  // Signs for a scatter of storefronts.
  for (const b of city.buildings) {
    if (chance(0.16)) {
      const name = SHOP_NAMES.find((s) => !usedSigns.has(s));
      if (name) { b.sign = name; usedSigns.add(name); }
    }
  }

  // Street lamps at intersections.
  for (let i = 0; i <= WORLD.blocksX; i++) {
    for (let j = 0; j <= WORLD.blocksY; j++) {
      city.lamps.push({ x: roadCenterX(i) - WORLD.roadWidth / 2 + 6, y: roadCenterY(j) - WORLD.roadWidth / 2 + 6 });
    }
  }

  // Beach palms along the sand rim.
  for (let k = 0; k < 46; k++) {
    const side = randInt(0, 3);
    let x, y;
    if (side === 0) { x = randRange(50, WORLD.width - 50); y = randRange(56, WORLD.sandRim - 26); }
    else if (side === 1) { x = randRange(50, WORLD.width - 50); y = randRange(WORLD.height - WORLD.sandRim + 26, WORLD.height - 56); }
    else if (side === 2) { x = randRange(56, WORLD.sandRim - 26); y = randRange(50, WORLD.height - 50); }
    else { x = randRange(WORLD.width - WORLD.sandRim + 26, WORLD.width - 56); y = randRange(50, WORLD.height - 50); }
    city.palms.push({ x, y, s: randRange(0.9, 1.5) });
  }

  // Landmarks: claim specific buildings / spots.
  const claim = (i, j, name) => {
    const o = blockOrigin(i, j);
    let best = null, bd = 1e9;
    for (const b of city.buildings) {
      const d = Math.abs(b.x - o.x) + Math.abs(b.y - o.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { best.landmark = name; best.sign = name; }
    return best;
  };
  city.garage = claim(1, 3, 'Taller Calder');
  city.policeStation = claim(5, 3, 'Comisaría Central');
  city.hospital = claim(5, 6, 'Hospital del Mar');
  city.hideout = claim(8, 1, 'Casa de Marisol');
  city.lighthouse = {
    x: WORLD.width - WORLD.sandRim + 66,
    y: WORLD.height - WORLD.sandRim + 60,
    r: 17,
  };
  return city;
}
