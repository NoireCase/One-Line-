import { createPortal } from 'react-dom'
import { motion as Motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Info } from 'lucide-react'
import { toastEnterExit, fadeOnly } from '../config/motionPresets.js'

// toast: { id, message } | null —— id 是事件身份（key），message 只负责显示。
// AnimatePresence 常驻 portal：toast 变 null 时走真实 exit，而不是整体卸载。
// mode="wait" 保证新旧 Toast 不重叠；清理由 App 侧按 id 守卫，组件内无回调清状态。
export default function GameToast({ toast }) {
  const prefersReducedMotion = useReducedMotion()

  return createPortal(
    <AnimatePresence mode="wait">
      {toast && (
        <Motion.div
          key={toast.id}
          style={{ position: 'fixed', top: 76, left: '50%', zIndex: 99999, pointerEvents: 'none' }}
          {...(prefersReducedMotion ? fadeOnly : toastEnterExit)}
        >
          <div
            className="bg-[#202633]/95 text-[#f3ead9] px-4 py-2.5 rounded-xl shadow-xl border border-white/[0.12] flex items-center gap-2 max-w-[min(88vw,380px)] -translate-x-1/2"
            onClick={e => e.stopPropagation()}
            data-testid="game-toast"
          >
            <Info size={17} className="text-teal-400/80 shrink-0" />
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
