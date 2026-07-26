import { createPortal } from 'react-dom'
import { motion as Motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Info } from 'lucide-react'
import { toastEnterExit, fadeOnly } from '../config/motionPresets.js'

export default function GameToast({ toast, onDone }) {
  const prefersReducedMotion = useReducedMotion()

  // AnimatePresence 常驻 portal：toast 变 null 时走真实 exit，而不是整体卸载。
  // key 取文案本身，mode="wait" 保证新旧 Toast 不重叠、不闪烁。
  return createPortal(
    <AnimatePresence mode="wait" onExitComplete={onDone}>
      {toast && (
        <Motion.div
          key={toast}
          style={{ position: 'fixed', top: 76, left: '50%', zIndex: 99999, pointerEvents: 'none' }}
          {...(prefersReducedMotion ? fadeOnly : toastEnterExit)}
        >
          <div
            className="bg-[#202633]/95 text-[#f3ead9] px-4 py-2.5 rounded-xl shadow-xl border border-white/[0.12] flex items-center gap-2 max-w-[min(88vw,380px)] -translate-x-1/2"
            onClick={e => e.stopPropagation()}
            data-testid="game-toast"
          >
            <Info size={17} className="text-teal-400/80 shrink-0" />
            <span className="font-semibold text-sm">{toast}</span>
          </div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
