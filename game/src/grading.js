// Crimson Tide Bay — the golden-hour colour grade.
// One job: the light. Warm sun-glow from the west, a violet dusk creeping
// up from the east, and a vignette that keeps the eye in the middle of
// the frame. Everything the render draws passes under this light.

import { PALETTE } from './config.js';

let vignetteCache = null;
let glowCache = null;

// Screen-space grade overlays, rebuilt only when the viewport changes size.
function buildOverlays(w, h) {
  vignetteCache = document.createElement('canvas');
  vignetteCache.width = w; vignetteCache.height = h;
  const v = vignetteCache.getContext('2d');
  const vg = v.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(30,10,50,0)');
  vg.addColorStop(1, 'rgba(30,10,50,0.34)');
  v.fillStyle = vg;
  v.fillRect(0, 0, w, h);

  glowCache = document.createElement('canvas');
  glowCache.width = w; glowCache.height = h;
  const g = glowCache.getContext('2d');
  const sun = g.createLinearGradient(0, 0, w, h * 0.4);
  sun.addColorStop(0, PALETTE.sunGlow);
  sun.addColorStop(0.55, 'rgba(255,140,60,0.10)');
  sun.addColorStop(1, PALETTE.dusk);
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  // An all-over warm wash: the last kiss of the setting sun.
  g.fillStyle = 'rgba(255,124,40,0.07)';
  g.fillRect(0, 0, w, h);
}

// Apply the full grade to the finished frame.
export function applyGrade(ctx, w, h) {
  if (!vignetteCache || vignetteCache.width !== w || vignetteCache.height !== h) {
    buildOverlays(w, h);
  }
  ctx.drawImage(glowCache, 0, 0);
  ctx.drawImage(vignetteCache, 0, 0);
}

// A soft warm light pool, used for street lamps and lit windows at dusk.
export function lightPool(ctx, x, y, r, strength = 0.16) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,196,96,${strength})`);
  g.addColorStop(1, 'rgba(255,196,96,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
