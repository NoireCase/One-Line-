// 全项目桌面限定门禁 · 聚焦浏览器测试
// 移动设备（含 iPadOS 桌面 UA、横竖屏、正式/原型/playtest 入口）只显示提示页：
// App 不 mount（正式根 DOM 与 prototype 根 DOM 均不存在）、无正式 storage 写入、无按钮。
// 桌面 4 类特征（macOS / Windows / 窄窗口 / 触摸屏笔记本）不被误拦截。
// 判定入口与 src/utils/detectMobile.js 同一事实源：测试只改 navigator 信号，不改实现。
import { test, expect, devices } from '@playwright/test';

const NOTICE = '[data-testid="desktop-only-notice"]';
const HOME = '[data-testid="home-view"]';
const BOARD = '[data-testid="digital-loop-board"]';

// 真实 UA 样本（与纯函数测试同一事实源）
const UA_IPADOS_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_WINDOWS_PHONE = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.1; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)';

// 覆盖 navigator 信号（platform / maxTouchPoints / userAgentData.mobile）。
async function overrideNavigator(context, { platform, maxTouchPoints, mobile }) {
  await context.addInitScript((opts) => {
    const { platform, maxTouchPoints, mobile } = opts;
    if (typeof platform === 'string') {
      Object.defineProperty(Navigator.prototype, 'platform', {
        configurable: true,
        get: () => platform,
      });
    }
    if (typeof maxTouchPoints === 'number') {
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {
        configurable: true,
        get: () => maxTouchPoints,
      });
    }
    if (typeof mobile === 'boolean') {
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        configurable: true,
        get: () => ({ mobile, brands: [], platform: '' }),
      });
    }
  }, { platform, maxTouchPoints, mobile });
}

// 移动设备：只显示提示页；App 未 mount；无正式 storage 写入；无按钮。
async function expectMobileNoticeOnly(page) {
  await expect(page.locator(NOTICE)).toBeVisible();
  await expect(page.locator(NOTICE).getByRole('button')).toHaveCount(0);
  // App 根 DOM 不存在 → App 未 mount（而非提示页盖在 App 上）
  await expect(page.locator(HOME)).toHaveCount(0);
  // prototype 根 DOM 不存在
  await expect(page.locator(BOARD)).toHaveCount(0);
  // 根下只有提示页一个节点
  const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1);
  expect(rootChildren).toBe(1);
  // 不产生正式 localStorage 写入（App 未 mount，不读不写任何 cg_* key）
  const storage = await page.evaluate(() => ({
    length: localStorage.length,
    keys: Object.keys(localStorage),
  }));
  expect(storage.length).toBe(0);
  expect(storage.keys.filter((key) => key.startsWith('cg_'))).toEqual([]);
}

// 桌面设备：无提示页；App 正常挂载。
async function expectDesktopNormal(page) {
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(HOME)).toBeVisible();
}

// ───────────────────────── 移动设备：只显示提示页 ─────────────────────────
test.describe('移动设备：只显示提示页', () => {
  test('iPhone 390×844 竖屏 · 正式入口', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('iPhone 横屏 844×390 · 正式入口（横屏不能绕过）', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      viewport: { width: 844, height: 390 },
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('Android 手机 412×915 · 正式入口', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('Android 平板（UA 无 Mobile 关键字）· 正式入口', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['Galaxy Tab S4'], locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('iPad 768×1024 竖屏 · 正式入口', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPad Pro 11'],
      viewport: { width: 768, height: 1024 },
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('iPad 横屏 1024×768 · 正式入口（横屏不能绕过）', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPad Pro 11'],
      viewport: { width: 1024, height: 768 },
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('iPadOS 桌面 UA（Macintosh UA + MacIntel + maxTouchPoints>1）', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: UA_IPADOS_DESKTOP,
      viewport: { width: 768, height: 1024 },
      hasTouch: true,
      locale: 'zh-CN',
    });
    await overrideNavigator(context, { platform: 'MacIntel', maxTouchPoints: 5, mobile: false });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('大 viewport + userAgentData.mobile=true 仍拦截（viewport 不能绕过）', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: UA_MAC_CHROME,
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
    });
    await overrideNavigator(context, { mobile: true });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('Windows Phone UA · 正式入口', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: UA_WINDOWS_PHONE,
      viewport: { width: 412, height: 732 },
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('移动设备 ?prototype=digital-loop 只显示提示页（原型不挂载）', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/?prototype=digital-loop');
    await expectMobileNoticeOnly(page);
    await context.close();
  });

  test('移动设备 ?playtest=1 只显示提示页（正式入口与 playtest 统一拦截）', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/?playtest=1');
    await expectMobileNoticeOnly(page);
    await context.close();
  });
});

// ───────────────────────── 桌面设备：不被误拦截 ─────────────────────────
test.describe('桌面设备：不被误拦截', () => {
  test('macOS 桌面 1440×900 · 正式首页正常挂载', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/');
    await expectDesktopNormal(page);
    await context.close();
  });

  test('Windows 桌面（Windows UA + Win32）· 不拦截', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: UA_WIN_CHROME,
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
    });
    await overrideNavigator(context, { platform: 'Win32', maxTouchPoints: 0 });
    const page = await context.newPage();
    await page.goto('/');
    await expectDesktopNormal(page);
    await context.close();
  });

  test('窄桌面窗口 390×844（无移动 UA）· 不拦截', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/');
    await expectDesktopNormal(page);
    await context.close();
  });

  test('Windows 触摸屏笔记本（Win32 + maxTouchPoints=10）· 不拦截', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: UA_WIN_CHROME,
      viewport: { width: 1440, height: 900 },
      hasTouch: true,
      locale: 'zh-CN',
    });
    await overrideNavigator(context, { platform: 'Win32', maxTouchPoints: 10 });
    const page = await context.newPage();
    await page.goto('/');
    await expectDesktopNormal(page);
    await context.close();
  });

  test('桌面 ?prototype=digital-loop · 数字环线原型仍可用', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/?prototype=digital-loop');
    await expect(page.locator(NOTICE)).toHaveCount(0);
    await expect(page.locator(BOARD)).toBeVisible();
    await context.close();
  });
});
