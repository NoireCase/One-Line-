import { createPortal } from 'react-dom'
import { motion as Motion, AnimatePresence } from 'motion/react'
import { Info } from 'lucide-react'
import { toastEnterExit } from '../config/motionPresets.js'

export default function GameToast({ toast, onDone }) {
  if (!toast) return null

  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {toast && (
        <Motion.div
          key="toast"
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, pointerEvents: 'auto' }}
          {...toastEnterExit}
        >
          <div
            className="bg-[#151b24] text-slate-100 px-4 py-3 rounded-xl shadow-lg border border-white/[0.08] flex items-center gap-2"
            onClick={e => e.stopPropagation()}
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
