// Crimson Tide Bay — small deterministic random helpers.
// One job: seeded randomness so the city is the same city on every visit,
// plus the everyday dice the gameplay code rolls.

let seed = 1877;

export function srand(newSeed) {
  seed = newSeed >>> 0;
}

export function rnd() {
  // A mulberry-style step: cheap, repeatable, good enough for rooftops.
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(min, max) {
  return min + rnd() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function pick(list) {
  return list[Math.floor(rnd() * list.length) % list.length];
}

export function chance(p) {
  return rnd() < p;
}

// Live dice for gameplay (impacts, AI whims) — not used for city layout.
export function roll(min, max) {
  return min + Math.random() * (max - min);
}

export function rollPick(list) {
  return list[Math.floor(Math.random() * list.length) % list.length];
}
