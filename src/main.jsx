import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.jsx'
import DesktopOnlyNotice from './components/DesktopOnlyNotice.jsx'
import { detectMobileFromNavigator } from './utils/detectMobile.js'

// 全项目桌面限定门禁：检测为不受支持的移动设备时，App 根本不 mount——
// 不初始化 Runtime / Session / 存档读取 / 事件监听，只渲染轻量提示页。
const isUnsupportedMobile = detectMobileFromNavigator(
  typeof navigator !== 'undefined' ? navigator : null,
)

const root = createRoot(document.getElementById('root'))

if (isUnsupportedMobile) {
  root.render(<DesktopOnlyNotice />)
} else {
  root.render(
    <StrictMode>
      {/* reducedMotion="user"：跟随系统 prefers-reduced-motion，全局禁用 Motion 位移/缩放/spring。
          CSS 动画与 Tailwind active transform 由 index.css 的 reduced-motion 基础各自受控。 */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StrictMode>,
  )
}
