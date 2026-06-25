// Pentatonic scale (C major), capped at C6 (1046.50 Hz)
const PENTATONIC_SCALE = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  1046.50 // C6 — cap here
];

let audioCtx = null;
let sfxVolume = 100; // 0-100, defaults to full

/** Lazy singleton AudioContext */
function getCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Safe tone: no pop, auto-cleanup */
function safeTone(freq, type, peakVol, duration) {
  const ctx = getCtx();
  const vol = peakVol * (sfxVolume / 100);
  if (vol <= 0.0001) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  // Ramp up fast, then decay
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.01);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/**
 * Play combo tone using pentatonic scale.
 * comboCount 1 → first note (C4), capped at last note (C6).
 */
export function playComboTone(comboCount) {
  const idx = Math.min(comboCount - 1, PENTATONIC_SCALE.length - 1);
  const freq = PENTATONIC_SCALE[Math.max(0, idx)];
  safeTone(freq, 'triangle', 0.1, 0.14);
}

/** Error sound: low, short, not harsh */
export function playErrorTone() {
  safeTone(150, 'sine', 0.09, 0.16);
}

/** Short ascending victory chime (~400ms, C5-E5-G5-C6 arpeggio). Respects sfxVolume. */
export function playVictoryChime() {
  const ctx = getCtx();
  const vol = 0.10 * (sfxVolume / 100);
  if (vol <= 0.0001) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, delay: 0, dur: 0.30, vol: 0.08 },
    { freq: 659.25, delay: 0.08, dur: 0.28, vol: 0.09 },
    { freq: 783.99, delay: 0.16, dur: 0.30, vol: 0.10 },
    { freq: 1046.50, delay: 0.25, dur: 0.32, vol: 0.12 },
  ];

  notes.forEach(({ freq, delay, dur, vol: noteVol }) => {
    const nv = noteVol * (sfxVolume / 100);
    if (nv <= 0.0001) return;
    const t = now + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(nv, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
}

/** Must be called after user gesture to unlock audio */
export function resumeAudioContext() {
  getCtx();
}

/** Set global sfx volume (0-100). Called from settings. */
export function setSfxVolume(vol) {
  sfxVolume = Math.max(0, Math.min(100, vol));
}
