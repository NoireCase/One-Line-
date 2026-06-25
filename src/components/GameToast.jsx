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
          style={{ position: 'fixed', bottom: 18, left: '50%', zIndex: 99999, pointerEvents: 'auto', transform: 'translateX(-50%)' }}
          {...toastEnterExit}
        >
          <div
            className="bg-[#151b24]/95 text-slate-100 px-4 py-2.5 rounded-xl shadow-lg border border-white/[0.08] flex items-center gap-2 max-w-[min(88vw,380px)]"
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
