// 全项目桌面限定门禁 · 移动设备全局提示页
// 轻量、无依赖：不 import App / Runtime / 正式游戏数据；无按钮、无自动跳转、
// 无 localStorage、无埋点、无远程请求。仅由 main.jsx 在检测到不支持的移动设备时挂载
// （App 在移动设备上根本不 mount，不初始化 Runtime / Session / 存档 / 事件监听）。
export default function DesktopOnlyNotice() {
  return (
    <main className="desktop-only-notice" data-testid="desktop-only-notice">
      <div className="desktop-only-notice-inner">
        <span className="linebook-wordmark night-title desktop-only-notice-wordmark">Linebook</span>
        <h1 className="desktop-only-notice-title">请使用电脑体验</h1>
        <p className="desktop-only-notice-copy">
          当前版本仅支持 Windows 或 macOS 电脑浏览器。
        </p>
        <p className="desktop-only-notice-copy">
          移动端将在全部玩法内容完成后统一适配。
        </p>
      </div>
    </main>
  );
}
