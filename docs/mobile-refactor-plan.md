# 移动端体验重构计划

> **状态：封存计划（Plan），未进入实现。**
> 本文档记录 2026-07-09 对移动端体验的结构性审查结论与后续重构方向。
> 当前 v0.18.3 移动端补丁（`ui/mobile-result-starline-v0.18.3`）为实验性质，**不建议合入 main**。

---

## 一、当前结论

| 结论 | 说明 |
| --- | --- |
| **v0.18.3 mobile patch 不建议合入 main** | 三轮补丁（工具栏/面板 padding、`.game-shell` 安全区/HUD 三段布局）虽通过了 build + validate + full e2e（100/100），但真机复查确认：移动端体验问题是**结构性**的，不是局部 CSS 能根本解决的。 |
| **PC 端优先** | PC 端当前体验已较为成熟。在不建立完整 mobile-first 设计系统之前，优先保证 PC 端不回退。 |
| **移动端需要单独 refactor** | 需要以移动端为第一优先级重新设计游戏页信息架构，而非在现有 PC 结构上打补丁。 |

---

## 二、已发现问题（结构性）

基于对以下文件的只读审查：

- `src/components/game/GameView.jsx`
- `src/components/game/GameHud.jsx`
- `src/components/game/GameActions.jsx`
- `src/components/WinPanel.jsx`
- `src/components/LosePanel.jsx`
- `src/components/game/StarLineBoard.jsx`
- `src/index.css`（`.game-shell` / `.board-sketch` / `.starline-board-shell` / Star Line toolbar 媒体查询）

### 2.1 顶部 HUD 信息过载

当前移动端 HUD 在一个横向 `flex justify-between` 三段的胶囊条内塞入：

- 玩法名（"经典模式"）+ 关卡号
- 计时器 `00:06`
- 分数 `424分`
- combo `×16`
- 步数/路径/星点计数（按模式）
- Star Line 额外：棋盘尺寸 + 单星/双星标签
- 左侧：返回 + 重置按钮
- 右侧：金币 + 生命胶囊

**问题**：
- iPhone 12 Pro（390px 视口）下，combo 从 `×2` 变为 `×16`、分数从 `24` 变为 `424` 时，中间胶囊被撑宽，右侧金币/生命被顶出。
- v0.18.3 补丁通过 `truncate` + `sm:hidden` 隐藏分数勉强兜住布局，但这掩盖了根本问题：**combo / score / coins 等游戏进程数据不应常驻移动端 HUD**。
- Star Line 星点计数 + 棋盘尺寸 + 单星/双星标签 + 模式名共 5 段信息同在一行，即使收缩后也过于拥挤。

### 2.2 棋盘视觉重量过高

- Classic 棋盘 `board-sketch` 使用深色面板 + 多级阴影（`24px/62px`、`40px` 发光、`0 0 34px` inscet 辉光），在移动端接近满宽时视觉占比过大。
- 棋盘 `max-w-md`（384px）在 390px 手机上 `px-2` 包裹后约 374px 宽，距屏边仅 8px。
- 边缘单元格可能触发 iOS 左边缘返回手势。
- Star Line 棋盘 `width: min(92vw, 33rem)` 在 390px 上≈358px，带工具栏后纵向空间紧张。
- 5×5 格字 3xl（约 30px），手机上看仍偏大；7×7/9×9 号略小但格线细弱。

### 2.3 底部道具区占高过大

- `GameActions` 三个道具按钮各 56×56px（`w-14 h-14`）+ 文字标签 + `pt-2 pb-4`，总高约 110–120px。
- 在 100dvh 布局下，该区域占纵向可见空间的 12–14%——对 Classic 等无道具需求场景属无效占高。
- 按钮为圆形大图标风格（"PC 缩小"），移动端更适合轻量横向工具条。

### 2.4 WinPanel / LosePanel 需要 mobile sheet 化

- 当前面板为居中 max-w-sm modal（带背景遮罩 + portal），在 PC 上属标准。
- 移动端问题：
  - 面板纵向空间过长（WinPanel 含星星行 h-14 + 奖励格 + 详情折叠区 + 按钮），需要 `max-h + overflow-y-auto` 兜底，滚动体验不佳；
  - LosePanel 虽然较短，但"复活 30 金币"按钮与底部安全区距离因 safari 浏览器栏而不可控；
  - 居中 modal 在单手操作的手机上是反直觉的——更适合 bottom sheet。

### 2.5 Safari / WebView 系统交互持续影响

- iOS Safari 顶部地址栏与底部工具条占用 dvh 变化；
- 左边缘 swipe 返回、下拉刷新、长按选中、缩放等系统手势在当前 `touch-action` / `overscroll-behavior` 补丁下仅被部分抑制（`touch-action: none` 对流式手势不可靠）；
- `env(safe-area-inset-bottom)` 解决了静态 notch 但无法解决动态出现的浏览器栏——`100dvh` 帮助有限。

### 2.6 Playwright 移动端截图不能替代真机验收

- Playwright 模拟 iPhone 12 Pro 视口（390×844）+ DPR3 + hasTouch，但无系统浏览器栏、无边缘手势、无 WebView 环境。
- 即便通过 Playwright 截图检查，真机上手仍有差距。移动端验收必须以真机/模拟器为最终标准。

---

## 三、移动端目标结构（规划，非当前实现）

### 3.1 mobile GameHud

**极简化**：从三排压缩为一排。

推荐移动端仅显示：

| Classic / Hidden / Portal | Star Line |
| --- | --- |
| `← Lv1 00:06`（左返回 + 关卡 + 计时器） | `← 星线 Lv1 步数 0`（左返回 + 模式 + 关卡 + 计数） |

移除：
- 常驻分数（始终保留在结算页）；
- 常驻 combo（移动端改为短暂浮动 +N 后消失，非持续显示）；
- 重置按钮（移至底部工具条或长按菜单）；
- 右侧金币/生命胶囊（金币移至浮动/结算页，生命仅在危险时显示闪烁提示）。

HUD 应占用 1 行（约 40px），而不是当桌面 HUD 的缩小版。

### 3.2 mobile Board

- 棋盘外框视觉减重：去除 24px/62px 阴影级联，在移动端改为更薄的 1px 边框 + 微弱内发光。
- 格子数字、线宽、padding 根据 N（5/7/9）移动端专用尺寸，不与桌面共用 `text-3xl` 等 Tailwind 绝对字号。
- 左右留足 16px+ 安全边距（棋盘 wrapper 不可贴近屏边 8px）。
- Star Line：保留 `aspect-ratio 1/1`，但 toolbar 可考虑改为悬浮或透明背景以增加棋盘可见面积。

### 3.3 mobile GameActions

- 从三个圆形大按钮改为底部薄工具条（约 44px 高）：图标 + 文字横排，固定于游戏页底部。
- 道具在移动端考虑 context menu / 长按弹出而非底部常驻。
- Classic 无道具场景完全不显示，回收占高。

### 3.4 combo / score 移出常驻 HUD

- combo 改为路径连接 `+N` 浮动标签（已有 `FloatingScore`）后消失——自然提示连击，不持续占用空间。
- 分数只在结算页展示（当前已保留在 WinPanel 详情折叠区，直接可用）。
- 金币不常驻，收到时浮动提示。

### 3.5 WinPanel / LosePanel → mobile sheet

目标：

| 当前 | 目标 |
| --- | --- |
| 居中 modal（`max-w-sm` portal） | 底部 sheet（`border-radius: 20px 20px 0 0`） |
| 竖向上依赖 `max-h + overflow-y-auto` | sheet 默认不会超过屏幕 60%，长内容可上拉展开 |
| PC / mobile 共用同一组件 | 桌面保留 modal，移动端 sheet 变体 |

LosePanel 复活按钮在 sheet 底部贴着安全区，不受浏览器栏动态变化影响。

### 3.6 基础能力保留（不依赖补丁就可保留）

以下 CSS 基础能力属于"即使不做 mobile refactor 也应该补"的安全底线，可以在任何阶段独立合入：

| 能力 | 说明 |
| --- | --- |
| `height/min-height: 100dvh` | 游戏页外壳用动态视口，非 100vh |
| `overscroll-behavior: none` | 阻断滚动链/系统手势 |
| `touch-action: none`（交互棋盘） | 棋盘/格子区阻止默认滚动 |
| `env(safe-area-inset-bottom)` | 底部安全区 padding |
| `-webkit-touch-callout: none` | 禁止长按选中 |
| `user-select: none` | 禁止文本选中 |

这些能力不解决体验问题，但避免体验被系统破坏。

---

## 四、建议后续分支

| 分支 | 用途 | 状态 |
| --- | --- | --- |
| `ui/mobile-result-starline-v0.18.3` | v0.18.3 移动端 CSS 补丁（三轮） | **封存为 experiment，不合入 main** |
| `ui/mobile-gameplay-refactor-v0.19`（建议） | 真正的移动端结构重构 | 待规划，从 main 新开 |

当前分支不应作为正式合并分支。后续以 main 为基新开分支 `ui/mobile-gameplay-refactor-v0.19` 或等价命名，从头重做移动端信息架构——参考本计划第三节目标结构，不复用 v0.18.3 的 `truncate/hidden` 补丁思路。

---

## 五、验收标准（后续 mobile refactor 上线前）

| # | 标准 |
| --- | --- |
| 1 | 在 iPhone 12/13 mini/Pro 尺寸真机或 Xcode Simulator 上验收 |
| 2 | 在手机 Safari 或 WebView 环境（非桌面浏览器 responsive mode）验收 |
| 3 | Classic 完整通关（从 Lv1 起至少 5 关连续） |
| 4 | Star Line 工具切换与放置操作流畅 |
| 5 | WinPanel / LosePanel sheet 出现自然、按钮可点 |
| 6 | 横向/纵向滑动棋盘时，不会误触发浏览器返回、下拉刷新、缩放 |
| 7 | HUD 不会因 combo 数值增长（个位→两位数→三位数）而挤爆 |
| 8 | 底部工具/按钮不被 iOS home indicator 或 Safari 工具栏遮挡 |
| 9 | 桌面端（Chrome/Firefox 1280px+）在上述改动后**不出现任何回退** |
| 10 | 完整 E2E 与 `validate:levels` 全部通过且不退化；执行时以当前正式基线为准（2026-07-25 完整 E2E 为 239/239） |

---

## 六、处置确认

- v0.18.3 实验分支保留，不删除。
- 本计划文档 `docs/mobile-refactor-plan.md` 可随 `main` 正常提交。
- v0.18.3 工作区改动（5 文件/71 行）建议丢弃或保留在本地不提交；若后续需要参考其中 safe-area/touch 基础能力，可单独提取为最小 PR，而非整组合入。
