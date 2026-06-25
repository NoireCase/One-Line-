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
            className="bg-slate-800/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2"
            onClick={e => e.stopPropagation()}
          >
            <Info size={18} className="text-emerald-400 shrink-0" />
            <span className="font-bold text-sm tracking-wide">{toast}</span>
          </div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
