// 全项目桌面限定门禁 · 设备检测纯函数测试
// detectMobileDevice 为可注入纯函数：测试不修改真实 navigator，不依赖全局状态。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMobileDevice, detectMobileFromNavigator } from './detectMobile.js';

// 构造信号：userAgentData / userAgent / platform / maxTouchPoints
const sig = (overrides = {}) => ({
  userAgentData: null,
  userAgent: '',
  platform: '',
  maxTouchPoints: 0,
  ...overrides,
});

// ── 真实 UA 样本 ──
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPOD = 'Mozilla/5.0 (iPod touch; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD_MOBILE = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPADOS_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_WINDOWS_PHONE = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.1; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)';
const UA_OPERA_MINI = 'Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54';
const UA_MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ── 移动设备：必须判为移动 ──
test('userAgentData.mobile=true 判为移动（即使 UA 为桌面 UA）', () => {
  assert.equal(detectMobileDevice(sig({ userAgentData: { mobile: true }, userAgent: UA_MAC_CHROME })), true);
});

test('iPhone UA 判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_IPHONE, platform: 'iPhone' })), true);
});

test('iPod UA 判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_IPOD, platform: 'iPod' })), true);
});

test('iPad 移动模式 UA 判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_IPAD_MOBILE, platform: 'iPad' })), true);
});

test('iPadOS 桌面 UA（MacIntel + maxTouchPoints>1）判为移动', () => {
  assert.equal(detectMobileDevice(sig({
    userAgentData: { mobile: false },
    userAgent: UA_IPADOS_DESKTOP,
    platform: 'MacIntel',
    maxTouchPoints: 5,
  })), true);
});

test('Android 手机 UA 判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_ANDROID_PHONE, platform: 'Linux armv8l' })), true);
});

test('Android 平板（UA 无 Mobile 关键字）判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_ANDROID_TABLET, platform: 'Linux armv8l' })), true);
});

test('Windows Phone / IEMobile UA 判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_WINDOWS_PHONE, platform: 'Win32' })), true);
});

test('常见 Mobile UA（Opera Mini）判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_OPERA_MINI })), true);
});

test('mobile 字段缺失但 UA 含 iPhone 仍判为移动（旧浏览器无 userAgentData）', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_IPHONE })), true);
});

// ── 桌面设备：不得误判 ──
test('macOS Safari 桌面 UA 不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })), false);
});

test('macOS Chrome 桌面 UA 不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_MAC_CHROME, platform: 'MacIntel', maxTouchPoints: 0 })), false);
});

test('Windows Chrome 桌面 UA 不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_WIN_CHROME, platform: 'Win32', maxTouchPoints: 0 })), false);
});

test('Linux 桌面 UA 不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_LINUX, platform: 'Linux x86_64' })), false);
});

test('Windows 触摸屏笔记本（Win32 + maxTouchPoints>1）不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_WIN_CHROME, platform: 'Win32', maxTouchPoints: 10 })), false);
});

test('MacBook 触摸板（MacIntel + maxTouchPoints=0）不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })), false);
});

test('MacIntel + maxTouchPoints=1（边缘值）不判为移动', () => {
  assert.equal(detectMobileDevice(sig({ userAgent: UA_MAC_CHROME, platform: 'MacIntel', maxTouchPoints: 1 })), false);
});

test('userAgentData.mobile=false 且无其他移动特征不判为移动', () => {
  assert.equal(detectMobileDevice(sig({
    userAgentData: { mobile: false },
    userAgent: UA_MAC_CHROME,
    platform: 'MacIntel',
    maxTouchPoints: 0,
  })), false);
});

test('空信号（无 navigator 能力的环境）不判为移动', () => {
  assert.equal(detectMobileDevice(sig()), false);
});

test('detectMobileFromNavigator(null / undefined / 非对象) 安全返回 false', () => {
  assert.equal(detectMobileFromNavigator(null), false);
  assert.equal(detectMobileFromNavigator(undefined), false);
  assert.equal(detectMobileFromNavigator('navigator'), false);
});

test('detectMobileFromNavigator 代理真实 navigator 形状的信号', () => {
  const nav = {
    userAgentData: { mobile: false },
    userAgent: UA_IPADOS_DESKTOP,
    platform: 'MacIntel',
    maxTouchPoints: 5,
  };
  assert.equal(detectMobileFromNavigator(nav), true);

  const desktopNav = {
    userAgentData: { mobile: false },
    userAgent: UA_WIN_CHROME,
    platform: 'Win32',
    maxTouchPoints: 0,
  };
  assert.equal(detectMobileFromNavigator(desktopNav), false);
});

// ── 视角外维度不参与判断（窄窗口不被误判）──
test('判断不读取任何 viewport / 尺寸信号：窄窗口桌面浏览器不被误判', () => {
  // detectMobileDevice 的入参没有宽度 / 媒体查询字段；用桌面特征构造即不拦截。
  const narrowDesktopSignals = sig({ userAgent: UA_MAC_CHROME, platform: 'MacIntel', maxTouchPoints: 0 });
  assert.equal(detectMobileDevice(narrowDesktopSignals), false);
});
