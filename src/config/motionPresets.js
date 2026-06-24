// Centralized motion presets — fast, crisp, damped, no bloat

export const cellTap = {
  whileTap: { scale: 0.88, transition: { duration: 0.08 } }
}

export const cellSuccess = {
  initial: { scale: 0.7, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 600, damping: 18, mass: 0.5 }
}

export const errorShake = {
  animate: { x: [0, -6, 6, -4, 4, -2, 0] },
  transition: { duration: 0.35, ease: 'easeOut' }
}

export const floatingScoreRise = {
  initial: { y: 0, opacity: 1, scale: 0.6 },
  animate: { y: -48, opacity: 0, scale: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }
}

export const toastEnterExit = {
  initial: { x: 80, opacity: 0, scale: 0.9 },
  animate: { x: 0, opacity: 1, scale: 1 },
  exit: { x: 40, opacity: 0, scale: 0.9 },
  transition: { type: 'spring', stiffness: 400, damping: 24 }
}

export const winPanelEnter = {
  initial: { scale: 0.85, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0 },
  transition: { type: 'spring', stiffness: 300, damping: 22, mass: 0.6 }
}

export const backdropEnter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25 }
}

export const starPop = (delay) => ({
  initial: { scale: 3, rotate: 20, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  transition: { type: 'spring', stiffness: 400, damping: 12, delay: delay || 0 }
})

export const comboMilestonePulse = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.15, 1] },
  transition: { duration: 0.25, ease: 'easeOut' }
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
