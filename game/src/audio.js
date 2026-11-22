// Crimson Tide Bay — all sound is synthesized live on WebAudio.
// One job: engines, sirens, gunfire, explosions and three radio stations
// sequenced note by note. There is not one audio file in this game.

let ac = null;
let master = null;
let engineOsc = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenTimer = 0;
let radioTimer = null;
let noiseBuffer = null;

export const STATIONS = [
  { id: 'marea',  name: 'Radio Marea',   freq: '98.1',  mood: 'Bahía synth' },
  { id: 'fuga',   name: 'Fuga FM',       freq: '104.7', mood: 'Night drive' },
  { id: 'serena', name: 'Ola Serena',    freq: '91.3',  mood: 'Bolero lento' },
];

export function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    const len = ac.sampleRate * 0.6;
    noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } catch (e) {
    ac = null;
  }
}

export function resumeAudio() {
  if (ac && ac.state === 'suspended') ac.resume();
}

function burst(dur, freq, gain, type = 'lowpass') {
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ac.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); src.stop(ac.currentTime + dur);
}

function blip(freq, dur, gain, type = 'square') {
  if (!ac) return;
  const o = ac.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ac.currentTime + dur);
}

export const sfx = {
  shot() { burst(0.09, 2400, 0.25, 'highpass'); blip(160, 0.06, 0.12); },
  shotgun() { burst(0.22, 1200, 0.4); blip(90, 0.14, 0.2); },
  explosion() { burst(0.7, 300, 0.65); blip(48, 0.6, 0.4, 'sine'); },
  crash() { burst(0.18, 700, 0.3); },
  pickup() { blip(660, 0.09, 0.14, 'sine'); setTimeout(() => blip(990, 0.12, 0.14, 'sine'), 70); },
  cash() { blip(880, 0.08, 0.13, 'triangle'); setTimeout(() => blip(1320, 0.14, 0.13, 'triangle'), 60); },
  busted() { blip(220, 0.3, 0.2, 'sawtooth'); setTimeout(() => blip(147, 0.45, 0.2, 'sawtooth'), 180); },
  door() { burst(0.06, 500, 0.15); },
  checkpoint() { blip(1046, 0.1, 0.13, 'sine'); },
};

// Engine: a sawtooth whose pitch follows the car's speed.
export function setEngine(on, speedRatio = 0) {
  if (!ac) return;
  if (on && !engineOsc) {
    engineOsc = ac.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ac.createGain();
    engineGain.gain.value = 0.0;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  if (engineOsc) {
    engineOsc.frequency.value = 55 + speedRatio * 165;
    engineGain.gain.value = on ? 0.05 + speedRatio * 0.05 : 0;
    if (!on) { try { engineOsc.stop(); } catch (e) { /* already stopped */ } engineOsc = null; }
  }
}

// Siren: a two-tone wail that exists only while the law is close.
export function setSiren(on) {
  if (!ac) return;
  if (on && !sirenOsc) {
    sirenOsc = ac.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ac.createGain();
    sirenGain.gain.value = 0.028;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    sirenTimer = 0;
  }
  if (sirenOsc) {
    sirenTimer += 1;
    sirenOsc.frequency.value = (sirenTimer % 50 < 25) ? 720 : 540;
    if (!on) { try { sirenOsc.stop(); } catch (e) { /* already stopped */ } sirenOsc = null; }
  }
}

// Radio: a tiny step sequencer. Each station is a scale, a tempo and a wave.
const SCALES = {
  marea:  { base: 220, notes: [0, 3, 5, 7, 10, 7, 5, 3], tempo: 210, wave: 'sawtooth', gain: 0.05 },
  fuga:   { base: 196, notes: [0, 0, 7, 0, 10, 7, 12, 10], tempo: 150, wave: 'square', gain: 0.04 },
  serena: { base: 262, notes: [0, 4, 7, 11, 9, 7, 4, 2], tempo: 330, wave: 'sine', gain: 0.07 },
};
let radioStep = 0;

export function setRadio(stationId) {
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  if (!ac || !stationId) return;
  const s = SCALES[stationId];
  if (!s) return;
  radioTimer = setInterval(() => {
    if (!ac) return;
    const semi = s.notes[radioStep % s.notes.length];
    radioStep++;
    const freq = s.base * Math.pow(2, semi / 12);
    blip(freq, s.tempo / 1000 * 0.9, s.gain, s.wave);
    if (radioStep % 2 === 0) blip(freq / 2, s.tempo / 1000, s.gain * 0.7, 'triangle');
  }, s.tempo);
}

export function radioOff() {
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
}
