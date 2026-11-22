// Crimson Tide Bay — the crew: named people with faces.
// One job: the characters who give the work — who they are, what they
// look like as a dusk-lit silhouette portrait, and the dialogue box
// that carries their words at the bottom of the screen.

export const CHARACTERS = {
  marisol: { name: 'Marisol Vega', role: 'La que manda', color: '#2fa8a0', hair: 'bun', skin: '#8d5a3b' },
  tito:    { name: 'Tito Anselmo', role: 'Mecánico', color: '#e8a33d', hair: 'cap', skin: '#c68e5e' },
  perla:   { name: 'Inés “La Perla” Duarte', role: 'Compradora', color: '#c65b7c', hair: 'long', skin: '#6e452a' },
  ruy:     { name: 'Ruy Calder', role: 'El conductor', color: '#d95f4b', hair: 'short', skin: '#e0ac82' },
  control: { name: 'Control Policial', role: 'Radio de la ley', color: '#4d7fa8', hair: 'none', skin: '#5a3a22' },
};

// A dialogue is a queue of [speakerId, text] lines. E or a click steps
// forward; the last step closes the box and fires onDone once.
export function makeDialogue(lines, onDone) {
  return { lines, idx: 0, t: 0, onDone: onDone || null, done: false };
}

export function updateDialogue(d, dt, advance) {
  if (!d || d.done) return;
  d.t += dt;
  if (advance && d.t > 0.25) {
    d.idx++;
    d.t = 0;
    if (d.idx >= d.lines.length) {
      d.done = true;
      if (d.onDone) d.onDone();
    }
  }
}

export function currentLine(d) {
  if (!d || d.done || d.idx >= d.lines.length) return null;
  const [speaker, text] = d.lines[d.idx];
  return { speaker, text, who: CHARACTERS[speaker] };
}

// Procedural portrait: a silhouette bust against the character's colour,
// rim-lit by the setting sun. No image files, just shapes.
export function drawPortrait(ctx, x, y, size, charId) {
  const c = CHARACTERS[charId] || CHARACTERS.ruy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, c.color);
  g.addColorStop(1, '#2a1a3e');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  const cx = x + size / 2, cy = y + size * 0.46, r = size * 0.21;
  // Shoulders.
  ctx.fillStyle = '#1d1428';
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 1.02, size * 0.34, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair shapes per character.
  ctx.fillStyle = '#241722';
  if (c.hair === 'bun') {
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.72, r * 0.86, r * 0.55, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.5, cy - r * 1.05, r * 0.34, 0, Math.PI * 2); ctx.fill();
  } else if (c.hair === 'long') {
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.3, r * 0.95, r * 1.25, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.1, r * 0.7, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
  } else if (c.hair === 'cap') {
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.62, r * 0.9, r * 0.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - r * 0.95, cy - r * 0.52, r * 1.9, r * 0.22);
  } else if (c.hair === 'short') {
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.66, r * 0.84, r * 0.52, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
  // Rim light from the west.
  ctx.strokeStyle = 'rgba(255,180,90,0.85)';
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.82, r, 0, Math.PI * 0.7, Math.PI * 1.35);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,160,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}
