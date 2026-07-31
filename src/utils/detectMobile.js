// 全项目桌面限定门禁 · 移动设备检测（全项目唯一判断入口）
// 分层判断，不依赖 viewport 尺寸 / CSS media query（桌面浏览器缩窄窗口不得误判）：
//   1) navigator.userAgentData?.mobile === true（优先）
//   2) iPadOS 桌面 UA 特征：platform === 'MacIntel' && maxTouchPoints > 1
//   3) User Agent 兜底（iPhone / iPod / iPad / Android / Windows Phone / 常见 Mobile UA）
// Android 即使 UA 不含 Mobile 也按移动设备处理（覆盖 Android 平板）。
// 纯函数、可注入（detectMobileDevice），浏览器读取由 detectMobileFromNavigator 封装。

const MOBILE_UA_PATTERN = /(iPhone|iPod|iPad|Android|Windows Phone|IEMobile|WPDesktop|Mobile|Opera Mobi)/i;

/**
 * 纯函数设备判断。signals 可来自真实 navigator（detectMobileFromNavigator）
 * 或测试构造对象；函数本身不读取全局 navigator / window，无副作用。
 *
 * @param {object} signals
 * @param {object|null} signals.userAgentData  navigator.userAgentData（可为 null/undefined）
 * @param {string} signals.userAgent          navigator.userAgent
 * @param {string} signals.platform           navigator.platform
 * @param {number} signals.maxTouchPoints     navigator.maxTouchPoints
 * @returns {boolean} true = 不支持的移动设备
 */
export function detectMobileDevice({ userAgentData, userAgent, platform, maxTouchPoints }) {
  // 1. 优先：userAgentData.mobile === true 直接判定移动。
  //    注意 mobile === false 不能提前返回桌面：iPadOS 请求桌面站后
  //    userAgentData.mobile 仍为 false，需继续走 2 / 3 层。
  if (userAgentData && typeof userAgentData.mobile === 'boolean' && userAgentData.mobile) {
    return true;
  }

  // 2. iPadOS 桌面 UA：platform 保持 'MacIntel'，靠 maxTouchPoints > 1 区分 iPad
  //    与普通 Mac（Mac 触摸板 maxTouchPoints 为 0；触摸屏笔记本为 Win32 等，不命中）。
  if (platform === 'MacIntel' && typeof maxTouchPoints === 'number' && maxTouchPoints > 1) {
    return true;
  }

  // 3. UA 兜底：iPhone / iPod / iPad / Android / Windows Phone / 常见 Mobile UA。
  //    Android 无 Mobile 关键字也命中（Android 平板）。
  if (userAgent && MOBILE_UA_PATTERN.test(userAgent)) {
    return true;
  }

  return false;
}

/**
 * 从真实 navigator 读取信号（main.jsx 在 App 挂载前调用一次）。
 * 环境缺失时安全返回 false（不拦截桌面/无 navigator 环境）。
 */
export function detectMobileFromNavigator(nav) {
  if (!nav || typeof nav !== 'object') return false;
  return detectMobileDevice({
    userAgentData: nav.userAgentData ?? null,
    userAgent: typeof nav.userAgent === 'string' ? nav.userAgent : '',
    platform: typeof nav.platform === 'string' ? nav.platform : '',
    maxTouchPoints: typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0,
  });
}
