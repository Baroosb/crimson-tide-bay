// Crimson Tide Bay — shared tuning constants.
// One job: every number and colour the rest of the game agrees on lives here,
// so the city, the law and the camera all read from the same page.

export const WORLD = {
  // The island is a grid of city blocks separated by two-lane roads,
  // wrapped in a sand rim and open water.
  blocksX: 10,
  blocksY: 8,
  blockSize: 196,     // buildable square inside one block (px)
  roadWidth: 96,      // asphalt band between blocks (px)
  sandRim: 150,       // beach between the street grid and the water
  get pitch() { return this.blockSize + this.roadWidth; },
  get gridW() { return this.blocksX * this.pitch + this.roadWidth; },
  get gridH() { return this.blocksY * this.pitch + this.roadWidth; },
  get width() { return this.gridW + this.sandRim * 2; },
  get height() { return this.gridH + this.sandRim * 2; },
};

export const PLAYER = {
  walkSpeed: 122,
  sprintSpeed: 204,
  radius: 11,
  health: 100,
  armor: 0,
};

export const CAR = {
  length: 48,
  width: 23,
  accel: 275,
  brake: 360,
  reverseMax: 98,
  drag: 0.6,
  turnRate: 2.7,      // rad/s at full lock, scaled by speed
  trafficCount: 16,
  parkedCount: 12,
};

export const LAW = {
  maxStars: 5,
  decayPerSecond: 0.05,  // heat lost per second while no cop sees you
  sightRange: 340,
  bustFillSeconds: 2.2,  // this long in a cop's grip and you are busted
  copShootStars: 4,      // at this many stars the law stops asking nicely
};

// Golden-hour grade: the whole bay is lit by a low amber sun, shadows fall
// long toward the south-east and every shade is warmed or violet-tinted.
export const PALETTE = {
  water: '#2a7d9d',
  waterDeep: '#175d80',
  waterFoam: '#bfe6dd',
  sand: '#f0cf96',
  sandWet: '#e3ba7d',
  grass: '#69a24e',
  park: '#5c9445',
  sidewalk: '#d8c49c',
  curb: '#a68f68',
  road: '#41434e',
  roadEdge: '#33353f',
  roadLine: '#f4cf4a',
  crosswalk: '#e8e2d2',
  shadow: 'rgba(46,26,74,0.34)',   // violet-tinted building shadows
  sunGlow: 'rgba(255,166,66,0.20)',
  dusk: 'rgba(64,28,92,0.19)',
};

export const REP_TIERS = [
  { name: 'Nadie',            min: 0,    payBonus: 0 },
  { name: 'Conocido',         min: 120,  payBonus: 0.10 },
  { name: 'Respetado',        min: 320,  payBonus: 0.18 },
  { name: 'Leyenda de la Bahía', min: 650, payBonus: 0.25 },
];

export function repTier(rep) {
  let tier = REP_TIERS[0];
  for (const t of REP_TIERS) if (rep >= t.min) tier = t;
  return tier;
}
