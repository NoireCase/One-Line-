/* eslint-disable react-refresh/only-export-components */
import { motion as Motion, AnimatePresence } from 'motion/react'
import { floatingScoreRise } from '../config/motionPresets.js'

let scoreIdCounter = 0

export function createFloatingScore(val, gridIndex, N) {
  const row = Math.floor(gridIndex / N)
  const col = gridIndex % N
  const pctX = ((col + 0.5) / N) * 100
  const pctY = ((row + 0.5) / N) * 100
  const offsetX = (Math.random() - 0.5) * 14
  const offsetY = (Math.random() - 0.5) * 10 - 6
  scoreIdCounter++
  return {
    id: `fs-${scoreIdCounter}-${Date.now()}`,
    val,
    style: {
      left: `calc(${pctX}% + ${offsetX}px)`,
      top: `calc(${pctY}% + ${offsetY}px)`
    }
  }
}

export default function FloatingScore({ scores, onComplete }) {
  if (!scores || scores.length === 0) return null
  const activeScores = scores.slice(-6)

  return (
    <AnimatePresence>
      {activeScores.map(s => (
        <Motion.div
          key={s.id}
          className="absolute z-40 pointer-events-none text-xs font-bold text-teal-200/90 whitespace-nowrap"
          style={s.style}
          {...floatingScoreRise}
          onAnimationComplete={() => {
            if (onComplete) onComplete(s.id)
          }}
        >
          +{s.val}
        </Motion.div>
      ))}
    </AnimatePresence>
  )
}
