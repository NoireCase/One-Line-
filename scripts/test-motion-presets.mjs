// Targeted check: motion tokens match the frozen Motion spec and shared
// presets are built from those tokens (no stray literal springs/durations).
import assert from 'node:assert/strict';
import {
  DURATIONS,
  STAGGER,
  MAX_TOTAL_STAGGER,
  EASING,
  SPRINGS,
  staggerDelay,
  fadeOnly,
  backdropEnter,
  winPanelEnter,
  toastEnterExit,
  unlockBadgeEnter,
  hudValuePulse,
  comboMilestonePulse,
  cellTap,
  errorShake
} from '../src/config/motionPresets.js';

// Duration tokens: exactly five steps.
assert.deepEqual(DURATIONS, {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  emphasis: 0.42,
  ritual: 0.8
});

// Stagger: fixed 60ms step, capped at 300ms total.
assert.equal(STAGGER, 0.06);
assert.equal(MAX_TOTAL_STAGGER, 0.3);
assert.equal(staggerDelay(0), 0);
assert.equal(staggerDelay(2), 0.12);
assert.equal(staggerDelay(99), 0.3);

// Easing: exactly two curves.
assert.deepEqual(EASING.standard, [0, 0, 0.2, 1]);
assert.deepEqual(EASING.emphasized, [0.2, 0.75, 0.25, 1]);

// Springs: exactly two groups with frozen parameters.
assert.deepEqual(SPRINGS.gentle, { type: 'spring', stiffness: 300, damping: 22, mass: 0.6 });
assert.deepEqual(SPRINGS.celebrate, { type: 'spring', stiffness: 400, damping: 12, mass: 1 });

// Reduced-motion fallback: Fast 160ms opacity only, no transform/spring.
assert.equal(fadeOnly.transition.duration, DURATIONS.fast);
assert.deepEqual(Object.keys(fadeOnly.initial), ['opacity']);
assert.deepEqual(Object.keys(fadeOnly.animate), ['opacity']);

// Shared presets reuse tokens instead of literals.
assert.equal(backdropEnter.transition.duration, DURATIONS.base);
assert.equal(winPanelEnter.transition, SPRINGS.gentle);
assert.equal(toastEnterExit.transition, SPRINGS.gentle);
assert.equal(unlockBadgeEnter.transition, SPRINGS.celebrate);
assert.equal(hudValuePulse.transition.duration, DURATIONS.base);
assert.equal(comboMilestonePulse.transition.duration, DURATIONS.base);
assert.equal(cellTap.whileTap.transition.duration, DURATIONS.instant);
assert.equal(errorShake.transition.duration, DURATIONS.base);
assert.equal(errorShake.transition.ease, EASING.standard);

// High-frequency feedback must not use springs.
assert.notEqual(cellTap.whileTap.transition.type, 'spring');
assert.notEqual(errorShake.transition.type, 'spring');
assert.notEqual(hudValuePulse.transition.type, 'spring');

console.log('motion-presets: all token checks passed');
