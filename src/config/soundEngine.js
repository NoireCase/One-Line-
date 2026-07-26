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

/**
 * Safe tone: no pop, auto-cleanup.
 * opts 全部可选，默认值与早期四参版本行为完全一致（One Line 调用不受影响）：
 * - attack：起音时间（默认 6ms 硬起音；更长则柔和）
 * - delay：延迟发声（默认 0）
 * - endFreq：音高滑移目标（默认不滑移，用于轻微下行/上行感）
 */
function safeTone(freq, type, peakVol, duration, { attack = 0.006, delay = 0, endFreq = null } = {}) {
  const ctx = getCtx();
  const vol = peakVol * (sfxVolume / 100);
  if (vol <= 0.0001) return;

  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  }

  // Ramp up, then decay to silence
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + duration + 0.01);

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

// ── Semantic sound foundation ──
// Thin safeTone wrappers mapped to game events. All respect sfxVolume.
// Star Line 系列刻意安静：音量约为 One Line 主音的 20%～45%，sine 为主、
// 柔和起音（attack 8–18ms），高频操作低存在感，更像思考型棋盘的落子反馈。

/** Star Line: a star is placed on the board. 五类中最清楚，但仍柔和。 */
export function playStarPlaceSound() {
  safeTone(523.25, 'sine', 0.04, 0.09, { attack: 0.015 }); // C5，玻璃珠轻落
}

/** Star Line: a cell is marked X. 触感级确认，所有声音中最低。 */
export function playMarkXSound() {
  safeTone(659.25, 'sine', 0.018, 0.045, { attack: 0.008 }); // E5，轻亮的短 tick
}

/** Rule conflict feedback (distinct from the generic error tone). 短、闷、不吓人。 */
export function playConflictSound() {
  safeTone(164.81, 'sine', 0.045, 0.11, { attack: 0.012 }); // E3，柔和低音
}

/** Undo an action. 低存在感的轻微回落。 */
export function playUndoSound() {
  safeTone(392.0, 'sine', 0.03, 0.13, { attack: 0.012, endFreq: 293.66 }); // G4→D4
}

/** Level complete. 温和的三音上行（C4-E4-G4），总计约 410ms。 */
export function playCompleteSound() {
  safeTone(261.63, 'sine', 0.03, 0.15, { attack: 0.018 }); // C4
  safeTone(329.63, 'sine', 0.035, 0.17, { attack: 0.018, delay: 0.09 }); // E4
  safeTone(392.0, 'sine', 0.045, 0.23, { attack: 0.018, delay: 0.18 }); // G4
}

/** A new level/mode is unlocked. */
export function playUnlockSound() {
  safeTone(659.25, 'triangle', 0.09, 0.18); // E5
}

/** Run/level failed. */
export function playFailureSound() {
  safeTone(130.81, 'sine', 0.09, 0.28); // C3
}

/** Reward granted (coins, badges). */
export function playRewardSound() {
  safeTone(880.0, 'triangle', 0.08, 0.16); // A5
}
