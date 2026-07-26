// Centralized motion tokens & presets — single source of truth.
// Durations are in seconds (Motion convention); index.css mirrors the same
// tokens as --motion-* CSS variables. Components must reuse these tokens and
// presets instead of writing their own millisecond/spring literals.

// ── Duration tokens (frozen: exactly five steps) ──
export const DURATIONS = {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  emphasis: 0.42,
  ritual: 0.8
}

// ── Stagger (fixed 60ms step, max 300ms total; not a sixth duration) ──
export const STAGGER = 0.06
export const MAX_TOTAL_STAGGER = 0.3

/** Stagger delay for the item at `index`, capped at MAX_TOTAL_STAGGER. */
export const staggerDelay = (index) => Math.min(index * STAGGER, MAX_TOTAL_STAGGER)

// ── Easing tokens (frozen: exactly two) ──
export const EASING = {
  standard: [0, 0, 0.2, 1],
  emphasized: [0.2, 0.75, 0.25, 1]
}

// ── Spring tokens (frozen: exactly two) ──
// gentle: ordinary one-shot panel entry.
// celebrate: win stars, unlock badges and major rewards only.
// High-frequency cells, HUD, buttons, undo and error feedback must NOT use springs.
export const SPRINGS = {
  gentle: { type: 'spring', stiffness: 300, damping: 22, mass: 0.6 },
  celebrate: { type: 'spring', stiffness: 400, damping: 12, mass: 1 }
}

// ── Opacity-only fallback for prefers-reduced-motion ──
// Panels/toasts keep a Fast 160ms opacity fade; no translation, scale or spring.
export const fadeOnly = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATIONS.fast, ease: EASING.standard }
}

// ── Shared UI presets ──

export const backdropEnter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATIONS.base }
}

export const winPanelEnter = {
  initial: { scale: 0.85, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0 },
  transition: SPRINGS.gentle
}

export const toastEnterExit = {
  initial: { x: 80, opacity: 0, scale: 0.9 },
  animate: { x: 0, opacity: 1, scale: 1 },
  exit: { x: 40, opacity: 0, scale: 0.9 },
  transition: SPRINGS.gentle
}

// Unlock badge / major reward pop (reserved for Commit B unlock feedback).
export const unlockBadgeEnter = {
  initial: { scale: 0.5, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: SPRINGS.celebrate
}

// Win star pop; delay per star uses the stagger token.
export const starPop = (delay) => ({
  initial: { scale: 3, rotate: 20, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  transition: { ...SPRINGS.celebrate, delay: delay || 0 }
})

// ── HUD presets ──

export const comboMilestonePulse = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.15, 1] },
  transition: { duration: DURATIONS.base, ease: EASING.standard }
}

// Non-milestone combo value change (no spring, short and quiet).
export const hudValuePulse = {
  initial: { scale: 0.88, opacity: 0.62 },
  animate: { scale: [0.92, 1.12, 1], opacity: [0.65, 1, 1] },
  transition: { duration: DURATIONS.base, ease: EASING.standard }
}

// Teaching-card step transition: Base opacity crossfade with a barely-there
// offset. Reduced-motion uses fadeOnly (opacity only).
export const teachingStepFade = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
  transition: { duration: DURATIONS.base, ease: EASING.standard }
}

// ── Board presets ──

export const cellTap = {
  whileTap: { scale: 0.9, transition: { duration: DURATIONS.instant } }
}

// Error shake: high-frequency feedback, no spring. Suppressed entirely
// under prefers-reduced-motion (error color/text state still shows).
export const errorShake = {
  animate: { x: [0, -4, 4, -2, 2, 0] },
  transition: { duration: DURATIONS.base, ease: EASING.standard }
}

export const floatingScoreRise = {
  initial: { y: 0, opacity: 1, scale: 0.6 },
  animate: { y: -48, opacity: 0, scale: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATIONS.ritual, ease: EASING.standard }
}

// ── Legacy presets (kept; currently unreferenced, safe to adopt later) ──

export const cellSuccess = {
  initial: { scale: 0.7, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: SPRINGS.gentle
}

export const headPulsePreset = {
  animate: {
    boxShadow: [
      '0 0 4px rgba(52,211,153,0.4)',
      '0 0 16px rgba(52,211,153,0.7)',
      '0 0 4px rgba(52,211,153,0.4)'
    ],
    scale: [1, 1.06, 1]
  },
  transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
}
