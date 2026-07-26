import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* reducedMotion="user"：跟随系统 prefers-reduced-motion，全局禁用 Motion 位移/缩放/spring。
        CSS 动画与 Tailwind active transform 由 index.css 的 reduced-motion 基础各自受控。 */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
