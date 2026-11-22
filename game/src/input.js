// Crimson Tide Bay — keyboard and mouse state.
// One job: listen to the window and keep a plain state object the rest of
// the game polls each frame. No game logic lives here.

export const keys = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    mouse.wheel += Math.sign(e.deltaY);
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function pressed(...codes) {
  return codes.some((c) => keys.has(c));
}

// One-shot key presses: main polls these and clears them at frame end.
const tappedSet = new Set();
window.addEventListener('keydown', (e) => {
  if (!e.repeat) tappedSet.add(e.code);
});
export function tapped(code) {
  return tappedSet.has(code);
}
export function clearTaps() {
  tappedSet.clear();
  mouse.clicked = false;
  mouse.wheel = 0;
}
