# Linebook 玩法家族设计规范

> 本文档是 Linebook 项目的玩法家族权威规范。它定义家族化设计流程、新玩法接入合同、Go/No-Go 门槛，以及全局层、家族层、玩法层的职责边界。
>
> **状态：正式生效**
>
> 自 P3A 起，所有新玩法设计和现有玩法 UI 改动都必须遵守本规范。

---

## 第一部分：目的与适用范围

### 为什么需要玩法家族

Linebook 自 v0.11 的双模式架构开始，逐步从「一玩法一页面」演化为多个正式玩法共存的产品。P1、P2 的 UI 重构证明：如果不先定义玩法所属家族和共享规则，每个新玩法都会带来碎片化的视觉、交互和工程决策。

家族化设计解决以下问题：

1. **视觉碎片化**：每个玩法的页面独立设计，导致产品整体缺乏统一的识别。
2. **工程耦合分散**：modeId、存档 key、章节配置、分页规则、状态语义散落在组件中，新玩法接入需要理解全部隐式约定。
3. **状态语义漂移**：「已完成」「当前关」「重玩中」在不同玩法中表达不一致。
4. **资产重复演化**：同一 SVG 几何在多个文件中复制后分别修改，失去单一来源。

### 家族化不解决什么

- **不追求所有玩法同质化**：家族共享骨架和语言，玩法保留机制、场景和节奏差异。
- **不建立万能玩法框架**：家族规范是设计合同，不是运行时抽象层。
- **不替代具体实现**：具体玩法的关卡数据、solver、validator 仍由各自模块负责。

### 核心原则

> 统一骨架、统一规则、统一质量标准，同时保留可识别的玩法差异。

### 适用范围

本规范适用于：

- 现有六个正式玩法的后续 UI 改动
- 新玩法的产品设计、原型验证和工程接入
- 全局 UI 规范的家族层面补充
- P3B 及之后的所有工程迭代

---

## 第二部分：当前家族地图

以下表格基于 v0.27.0 仓库真实代码和配置。modeId、展示名、关卡数量和存档 key 均从源码验证。`familyId` 是 P3A 冻结的设计合同标识；当前 `GAME_MODES` 尚无该字段，加入只读 `familyId` 仍属于 P3B。

### One Line 家族

| 属性 | 循序寻踪 | 隐迹寻踪 | 八向寻踪 | 跃迁寻踪 |
| --- | --- | --- | --- | --- |
| familyId | `oneLine` | `oneLine` | `oneLine` | `oneLine` |
| modeId | `classic` | `hidden` | `diagonal` | `portalClassic` |
| 展示名 | 循序寻踪 | 隐迹寻踪 | 八向寻踪 | 跃迁寻踪 |
| 关卡数量 | 60 | 60 | 60 | 30 |
| 专属色 | 薄荷青绿 | 雾蓝灰 + 紫灰回声 | 钴蓝 + 方向青 | 翡翠绿 + 暖橙门环 |
| 主要输入 | 鼠标/触摸板拖动 | 鼠标/触摸板拖动 | 鼠标/触摸板拖动 | 鼠标/触摸板拖动 |
| 关卡结构 | easy 10 / medium 20 / hard 30 | Easy 5×5 10 / Medium 7×7 20 / Hard 7×7 30 | easy 10 / medium 20 / hard 30 | 5×5 + 7×7 手工关卡 |
| 进度存储 | `cg_classic_v2_progress` | `cg_hidden_progress` | `cg_diagonal_progress` | `cg_portal_progress` |
| 高分/成绩存储 | `cg_classic_v2_highscores` | `cg_hidden_best_steps`（仅 config 保留，当前 runtime 不读写） | `cg_diagonal_highscores` | `cg_portal_best_steps` |
| 中断存档 | `cg_classic_v2_saved_game` | `cg_hidden_saved_game` | `cg_diagonal_saved_game` | `cg_portal_saved_game` |
| 重玩存储 | `cg_level_select_replay_v1` | `cg_level_select_replay_v1` | `cg_level_select_replay_v1` | `cg_level_select_replay_v1` |
| 完成仪式存储 | `cg_level_select_completion_ceremony_v1` | `cg_level_select_completion_ceremony_v1` | `cg_level_select_completion_ceremony_v1` | `cg_level_select_completion_ceremony_v1` |
| 教学模式 | 首局规则提示 | 首局规则提示 | 首局规则提示 | 首局规则提示 |
| runtime | `useGameSession` | `useGameSession` | `useGameSession` | `useGameSession` |
| 首页入口 | `HomeOneLineEntry` | `HomeOneLineEntry` | `HomeOneLineEntry` | `HomeOneLineEntry` |
| 重玩视觉家族 | `oneLine` (折线 SVG) | `oneLine` (折线 SVG) | `oneLine` (折线 SVG) | `oneLine` (折线 SVG) |

#### Classic / Diagonal 的 60 关装载关系

`classic` 与 `diagonal` 的正式目录不是 60 条手工数组，也不能用 `curatedLevels.js` 的条目数代替正式关卡总数。生产装载路径由 `getLevelSections()` → `getClassicSectionLevelCount()` 计算：

| 每个 mode | easy | medium | hard | 合计 |
| --- | ---: | ---: | ---: | ---: |
| 程序生成基础槽位（`CLASSIC_STRUCTURE`） | 10 | 15 | 20 | 45 |
| `curatedLevels.js` 追加关卡 | 0 | 5 | 10 | 15 |
| **玩家正式目录** | **10** | **20** | **30** | **60** |

`useGameSession.initGame()` 先尝试读取对应难度末尾的 curated 关卡；其余槽位由 `createClassicLevel()` 按 mode、难度和关卡索引确定性生成。因此「curated 15 关」是每个 mode 的人工追加数据量，不是该 mode 的正式关卡总数。

### Star Line 家族

| 属性 | 单星谜阵 | 双星谜阵 |
| --- | --- | --- |
| familyId | `starLine` | `starLine` |
| modeId | `starSingle` | `starDouble` |
| 展示名 | 单星谜阵 | 双星谜阵 |
| 关卡数量 | 60 | 60 |
| 专属色 | 柔和紫 | 玫紫 |
| 主要输入 | 鼠标单击/拖动放置、排除、清除 | 鼠标单击/拖动放置、排除、清除 |
| 关卡结构 | Lv.1–20 基础 + Lv.21–60 扩展 | Lv.1 legacy 教学 + Lv.2–9 proof-driven 教学 + Lv.10 自主毕业 + Lv.11–60 进阶 |
| 进度存储 | `cg_star_line_progress_v2`（单双星共享 schema，按 modeId 隔离） | `cg_star_line_progress_v2`（单双星共享 schema，按 modeId 隔离） |
| 成绩存储 | `cg_star_line_records`（仅 config / legacy 清理保留，当前正式 runtime 不读写） | `cg_star_line_records`（仅 config / legacy 清理保留，当前正式 runtime 不读写） |
| 中断存档 | `cg_star_line_single_saved_game` | `cg_star_line_double_saved_game` |
| 重玩存储 | `cg_level_select_replay_v1` | `cg_level_select_replay_v1` |
| 完成仪式存储 | `cg_level_select_completion_ceremony_v1` | `cg_level_select_completion_ceremony_v1` |
| 教学模式 | 操作教学（4 步） + 规则教学（10 步） | Lv.1 legacy 教学 + Lv.2–9 proof-driven 教学 |
| 教学存储 | `cg_star_line_guidance_v1` | `cg_star_line_double_guidance_v1` |
| runtime | `useGameSession`（页面/会话）+ `useStarLineInteraction`（盘面）+ `useStarLineInputController`（指针输入）+ `useStarLineGuide` | `useGameSession`（页面/会话）+ `useStarLineInteraction`（盘面）+ `useStarLineInputController`（指针输入）+ `useStarLineDoubleGuide` |
| solver | constraint-propagation + backtracking | constraint-propagation + backtracking |
| validator | 接入 `validate:levels` | 接入 `validate:levels` |
| 首页入口 | `HomeStarLineEntry` | `HomeStarLineEntry` |
| 重玩视觉家族 | `starLine` (星线 SVG) | `starLine` (星线 SVG) |

### Legacy `starLine` 兼容合同

`starLine` 是 v0.23 之前单星/双星混合目录的 legacy modeId，不是第七个正式玩法。

- **入口状态**：仍存在于 `PLAY_MODES`、`GAME_MODES`、Star Line 规则和兼容分支中，但不在 `ONE_LINE_MODE_LIST`、`STAR_LINE_MODE_LIST` 或 `GAME_MODE_LIST`，正常玩家流程没有入口。
- **旧进度 key**：`cg_star_line_progress`。当 `cg_star_line_progress_v2` 不存在时，`loadProgressV2()` 只读旧 key，并按固定的旧 30 关基线迁移：前 20 关归入 `starSingle`，后 10 关归入 `starDouble`。正式 `starSingle` / `starDouble` 只写 v2 key，不回写旧进度。
- **旧中断存档 key**：`cg_star_line_saved_game`。`migrateLegacyStarLineSavedGame()` 只把身份明确的旧存档复制到 `cg_star_line_single_saved_game` 或 `cg_star_line_double_saved_game`，写入 `cg_star_line_session_migration_v1` 标记；旧记录不删除，归属不明确的记录保持原样。
- **旧成绩 key**：`cg_star_line_records` 仍保留在 legacy config 和开发清理分支中，当前正式单双星流程不读写成绩记录。
- **关卡数量口径**：330 只统计六个玩家可达的正式 mode。`starLine` 的兼容 getter 可访问合并数据源，但它不形成独立玩家目录，也不能再次计入总数。
- **退役边界**：P3A 不删除 legacy mode、旧 key 或迁移代码；任何退役都必须先证明旧进度和旧中断存档不再需要兼容，并作为单独的存档迁移任务处理。

### 全局共享存储

| 存储 key | 作用 | 范围 |
| --- | --- | --- |
| `cg_level_select_replay_v1` | 重玩模式状态 | 全玩法，按 modeId 隔离 |
| `cg_level_select_completion_ceremony_v1` | 首次通关完成仪式已播放记录 | 全玩法，按 modeId 隔离 |
| `cg_coins` | 金币 | 全局共享 |
| `cg_items` | 道具库存 | 全局共享 |
| `cg_global_score` | 全局积分池 | 全局共享 |
| `cg_sfx_vol` | 音量设置 | 全局共享 |

### 总关卡数量

| 家族 | 玩法 | 关卡数 |
| --- | --- | ---: |
| One Line | 循序寻踪 | 60 |
| One Line | 隐迹寻踪 | 60 |
| One Line | 八向寻踪 | 60 |
| One Line | 跃迁寻踪 | 30 |
| Star Line | 单星谜阵 | 60 |
| Star Line | 双星谜阵 | 60 |
| **合计** | **6 个正式玩法** | **330** |

---

## 第三部分：三层继承模型

### 产品全局层

全局层定义所有玩法和页面共享的基础设施。任何玩法都不应绕过全局层独立定义这些能力。

**共享内容：**

- 固定视口（`app-shell`，无页面级纵向滚动）
- Linebook 品牌外壳（`linebook-wordmark`、`home-family-shell`、`--linebook-night-background`）
- 首页双家族入口（`HomeOneLineEntry` / `HomeStarLineEntry`）
- 返回逻辑（`handleBack`：有进度时弹出退出确认，空局直接返回）
- 卡片原子（共用 `--linebook-card-*` token）
- 分页器（5×2 固定网格，每页 10 关）
- 可访问性基线（`aria-pressed`、`aria-expanded`、`aria-controls`、`hidden`、focus-visible）
- hover / focus / pressed 交互基线（来自 `motionPresets.js` 和 `--motion-*` 变量）
- 响应式要求（游戏页：1920×1080、1440×900、1024×768；关卡选择页额外覆盖 1280×720）
- 测试与验收格式（游戏页桌面三档；关卡选择页四档 + 分页边界 + 状态隔离）
- Toast 系统（`GameToast`，自增 ID 事件，1.8s 自动清除）
- 设置面板（`SettingsPanel`，音量、教学重播、开发入口）
- 开发工具隔离（GM Panel 仅 dev 环境或 `?playtest=1`）

### 玩法家族层

每个玩法家族定义一个共享骨架，家族内的所有具体玩法从这个骨架派生。

**One Line 家族共享：**

- 首页入口卡片：`HomeOneLineEntry`（折线路径 SVG + 青绿色系 + 「线序谜阵」副标题）
- 家族标题：`ONE LINE`
- 家族视觉语法：深色夜空 + 奶油标题 + 金色终点
- 状态标识：金色星星表示首次推进当前关
- 关卡页骨架：`PuzzleBookPage` + `ONE_LINE_MODE_LIST`
- 基础交互范式：鼠标/触摸板拖动连线，从 1 出发按数字顺序
- 家族专属 SVG 资产：`OneLinePathIcon`、`HomePathMark`
- 家族存档命名空间：`cg_classic_v2_*`、`cg_diagonal_*`、`cg_hidden_*`、`cg_portal_*`
- 家族重玩标识：折线 SVG（`oneLine` 视觉家族）
- runtime：`useGameSession` + `usePathInteraction`

**Star Line 家族共享：**

- 首页入口卡片：`HomeStarLineEntry`（星线节点 SVG + 紫色系 + 「星线谜阵」副标题）
- 家族标题：`STAR LINE`
- 家族视觉语法：深紫空间 + 稀疏节点 + 细关系线 + 金色机制焦点
- 状态标识：节点网络 + 星核关系
- 关卡页骨架：`PuzzleBookPage` + `STAR_LINE_MODE_LIST`
- 基础交互范式：鼠标单击/拖动进行放置星点、排除 X、清除
- 家族专属 SVG 资产：`StarLineEntryIcon`、`StarLineMark`
- 家族存档命名空间：`cg_star_line_progress_v2`（共享 schema，按 modeId 隔离）、`cg_star_line_*_saved_game`
- 家族重玩标识：星线 SVG（`starLine` 视觉家族）
- runtime：`useGameSession` 管理共享页面/会话状态，`useStarLineInteraction` 管理星点盘面，`useStarLineInputController` 管理指针手势，再按 mode 接入教学 hook
- 20 步撤销能力
- solver：constraint-propagation + backtracking
- validator：`validate:levels`（区域结构、连通性、唯一解）

### 具体玩法层

每个具体玩法只负责自己的差异化内容。

**One Line 玩法负责：**

- 核心规则（movement type：orthogonal / diagonal、路径不可交叉）
- 专属场景 SVG（规则签名：连续路径 / 遮蔽路径 / 折角路径 / 门环路径）
- 专属色（薄荷青绿 / 雾蓝灰 / 钴蓝 / 翡翠绿）
- 关卡数据（`src/data/curatedLevels.js`、`src/data/hiddenLevels.js`、`src/data/portalLevels.js`）
- 输入差异（Portal 的传送门入口/出口连接逻辑）
- 教学内容（首局规则提示）
- solver / validator 差异（Hidden 唯一解验证、Portal 传送门路径验证）
- 特殊失败条件（Hidden 尝试次数、Portal 非法出口）
- 章节配置（难度分段 easy/medium/hard）

**Star Line 玩法负责：**

- 核心规则（每行/每列/每星域各放 1 或 2 个星点，星点不能相邻）
- 专属色（柔和紫 / 玫紫）
- 关卡数据（`src/data/starLineLevels.js` 及教学/扩展关卡文件）
- 教学内容（单星操作/规则教学、双星 proof-driven curriculum Lv.1–10）
- 完成判定（按规则判定，不直接比对 solution）
- 结算时序（单星 ~1000ms、双星 ~1300ms）
- solver / validator（统一 constraint-propagation + backtracking，按 quota 分支）
- 章节配置（五章，按 displayNumber 归属）

---

## 第四部分：家族规范化设计流程

后续所有玩法设计必须按以下顺序执行。禁止跳过步骤或倒推。

### 设计流程（13 步）

1. **明确产品问题**：这个玩法为玩家解决什么问题？与现有玩法的体验差异是什么？
2. **判断家族归属**：是否属于现有 One Line 或 Star Line 家族？如果是新家族，为什么现有家族骨架无法承载？
3. **定义家族共享骨架**：列出该玩法将从家族层继承的所有元素（骨架、状态语义、存档 namespace、资产语言）。
4. **定义玩法差异**：列出该玩法需要独立定义的所有元素（机制、场景、专属色、教学、输入差异）。
5. **建立完整状态矩阵**：覆盖未解锁、已解锁未完成、当前关、已完成关、整体首次通关、二次重玩当前关、二次已通关、全部二次通关、hover/focus/pressed、翻页中、第一页/最后一页、最后一页不足 10 关、存档恢复、损坏存档降级。
6. **定义家族资产和标识语义**：入口 SVG、场景 SVG、状态 SVG、装饰 SVG、图标组件的命名、位置、复用边界。
7. **定义输入与交互合同**：输入方式声明、家族内共享交互范式、玩法特殊交互差异。
8. **定义进度、存档和迁移合同**：存档 namespace、共享 key vs 独立 key、迁移策略。
9. **定义教学、validator、solver 合同**：教学形式、validator 检查项、solver 算法要求。
10. **制作小型原型**：3–5 关验证核心机制、UI 骨架和输入可行性。
11. **完成多分辨率与交互验收**：游戏页覆盖 1920×1080、1440×900、1024×768；关卡选择页额外覆盖 1280×720。
12. **更新设计规范和开发文档**：家族规范、UI 规范、关卡规范、E2E 策略。
13. **进入正式关卡生产**：通过 Go/No-Go 评审后方可开始批量生产。

### 明确禁止

- ❌ 先画单页再倒推家族
- ❌ 只解决一个玩法而不更新全局规范
- ❌ 通过颜色单独区分两个玩法（模式差异必须 > 仅颜色）
- ❌ 同一个 SVG 跨家族承担不同语义
- ❌ 页面状态没有定义就直接编码
- ❌ 原型数据直接混入正式关卡目录
- ❌ 先生产大量关卡再验证 runtime
- ❌ 为单个新玩法重写整套 App
- ❌ 绕过家族定义直接进入正式开发

---

## 第五部分：家族状态矩阵

v0.27.0 已形成的三套状态体系，后续所有玩法必须完全遵守。

### 三套状态体系

#### 1. 正常首次推进

| 状态 | 视觉表达 | 交互 |
| --- | --- | --- |
| 未解锁 | 低明度编号 + 弱边界 + 不可操作 | 不可点击 |
| 已解锁未完成 | 正常编号 + 正常卡片材质 | 可点击进入 |
| 当前推荐关 | 玩法色推荐描边 + 提亮背景 + 克制辉光 + **右上角金色星星** | 第一操作焦点 |
| 已完成关 | 已完成材质 + 基础卡片 | 可点击重玩（在 replay 未激活时仍可进入） |

**关键规则：**
- 金色星星**只**表示首次推进的当前推荐关
- 金色星星不得表示首次已通关、二次当前关或二次已通关
- 编号永远是格内第一视觉信息

#### 2. 整体首次通关总览（sealed）

触发条件：玩法全部关卡首次通关完成，且仪式已结束或跳过。

| 属性 | 表达 |
| --- | --- |
| 显示范围 | 固定第一页 1–10 |
| 卡片样式 | 深色主体 + 浅金编号 + 低透明度金色细边 + 克制暖金内层高光 |
| 网格外框 | 低透明度细金线完成框（不形成粗横条/粗竖条/表格感） |
| 分页箭头 | 隐藏 |
| 底部入口 | 「已通关」（主状态，静止） + 「点击重玩」（弱提示，静止） |
| 交互 | pointer + hover + focus-visible + 一次性 pressed 反馈；点击打开确认框 |

**确认框：**
- 标题：`{玩法名}已通关`
- 正文：`进入重玩模式后，可自由选择任意已完成关卡。通关记录不会清除。`
- 操作：「进入重玩」+「取消」
- 语义：必须有 dialog 语义、焦点圈定、Esc 取消和关闭后焦点返回

#### 3. 二次重玩（replay）

触发条件：玩家在 sealed 确认框中确认进入重玩。

| 属性 | 表达 |
| --- | --- |
| 推荐关 | 第一个尚未二次通过的真实关卡（玩法色推荐高亮 + 编号保持玩法色） |
| 重玩标识 | 右上角显示玩法家族专属 SVG（**无文字**） |
| 二次已通关关 | 基础卡片材质 + 编号变为**金色** + 右上角保留家族专属 SVG |
| 全部二次通关 | 推荐指针为空，所有关保持金色编号 + SVG，继续允许分页 |
| 分页 | 恢复分页箭头 + 当前页/总页数 |

**重玩标识 SVG 规则：**
- One Line 家族（classic / hidden / diagonal / portalClassic）：使用首页 `HomeOneLineEntry` 进入按钮的折线 SVG
- Star Line 家族（starSingle / starDouble）：使用首页 `HomeStarLineEntry` 进入按钮的星线 SVG
- 两种几何**不得混用**
- SVG 类型由集中 modeId→家族映射在渲染时推导，**不写入存档**

**交互优先级（卡片内）：**
```
pressed > hover/focus > 当前重玩推荐 > 二次通过金色编号 > 玩法族 SVG > 基础卡片
```

SVG 默认静止，仅在真实 hover、focus 或按下时由卡片提供短反馈。

### sealed 与 replay 互斥

`sealed` 和 `replay` 是互斥状态。前者表达整个玩法首次完成的成就总览，后者表达独立二次进度。

### 存档隔离

- `sealed` / `replay` 状态由 `cg_level_select_replay_v1` 独立管理
- 进入 replay、确认对话框和重玩已完成关均**不得**清除 completed/unlocked、改变首次解锁顺序、重复发放首次奖励或重播完整仪式
- 重玩存档异常只能降级为空重玩记录，不得影响首次通关存档
- 切换玩法、切换家族、返回首页、路由变化、刷新和重新载入均**不得**清除 replay 状态

### 完成仪式（ceremony）

- 触发：首次完整玩法通关，且由本次胜利流程明确返回
- 流程：从最后十关反向染金，按约 450ms/页回翻到 1–10，绘制封存金线，显示「已通关」
- 任意操作可跳过
- 仪式自然结束/跳过/reduced-motion 降级后，写入 `cg_level_select_completion_ceremony_v1`（只记录已播放仪式的 modeId）
- 已完成的老存档没有本次首次完成事件 → 直接进入 `sealed`，不补播仪式

---

## 第六部分：家族资产规范

### 资产分类

| 类型 | 定义 | 示例 |
| --- | --- | --- |
| 入口 SVG | 首页双家族入口卡片插画 | `HomePathMark`（One Line）、`StarLineMark`（Star Line） |
| 入口图标 | 入口按钮内联图标 | `OneLinePathIcon`、`StarLineEntryIcon` |
| 规则签名 | 关卡选择页章节头部动画图形 | 六种规则签名（连续路径/遮蔽路径/折角路径/门环路径/单核汇聚/双核共享） |
| 状态 SVG | 关卡卡片上的状态标识 | 金色星星（首次推进）、折线 SVG（One Line 重玩）、星线 SVG（Star Line 重玩） |
| 装饰 SVG | 环境氛围元素 | 背景星点（不规律、低密度） |
| 设计令牌 | CSS custom properties | `--level-accent`、`--level-accent-strong`、`--level-rec-border` |
| 动画 | motion token 与组件动画 | `motionPresets.js`、`--motion-*` 变量 |

### 资产命名规则

- 入口 SVG：`{Family}Mark`、`{Family}EntryIcon`
- 规则签名：由组件内部管理，不导出为独立命名资产
- 状态 SVG：由 `replayVisualFamily.js` 的 `REPLAY_VISUAL_FAMILY_BY_MODE` 映射推导
- 装饰 SVG：保留在页面容器内，不独立命名

### 文件位置

- 入口/图标 SVG：`src/components/PuzzleMarks.jsx`
- 视觉家族映射：`src/config/replayVisualFamily.js`
- 设计令牌：`src/index.css`（全局令牌）+ 各组件内 CSS 变量（家族/玩法专属）
- 规则签名：`src/components/ChapterRuleMark.jsx`，由 `LevelSelectBrowser` 在 `PuzzleBookPage` 骨架中渲染

### 复用边界

- ✅ 首页入口 SVG 的纯几何可以被家族内部复用（例如重玩标识复用入口折线/星线几何）
- ✅ 首页动画留在首页容器（`home-family-art`），关卡卡片只复用静态几何
- ❌ One Line 和 Star Line **不共用**重玩标识
- ❌ 具体玩法场景 SVG 不应被其他玩法直接套用
- ❌ 同一资产**不得**在多个文件复制后分别演化
- ❌ 禁止新增外部素材或依赖（所有视觉资产为代码内 SVG/CSS）

---

## 第七部分：新玩法接入合同

任何新玩法进入正式设计评审前，必须完整填写以下合同。

### A. 产品信息

- **familyId**：`oneLine` | `starLine` | 新家族（需说明原因）
- **modeId**：唯一标识字符串（如 `starSingle`、`portalClassic`）
- **展示名**：玩家可见的中文玩法名（如「单星谜阵」）
- **一句话机制**：30 字以内描述核心规则
- **与现有玩法的差异**：明确列出至少 2 个非颜色差异
- **用户学习成本**：低（现有玩家可直觉理解）/ 中（需要教学）/ 高（需要 proof-driven curriculum）
- **是否属于现有家族**：是 / 否（如否则说明新家族的理由和骨架）

### B. 设计信息

- **专属色**：主色、高光色、深层色（hex 值）
- **场景视觉**：规则签名的图形语法描述（节点、线、空间结构）
- **状态矩阵**：完整覆盖第五部分的所有状态
- **入口资产**：如需新家族入口 SVG，提供几何描述
- **页面差异**：与家族默认骨架的差异清单
- **响应式策略**：游戏页 1920×1080 / 1440×900 / 1024×768 三档；如接入关卡选择页，再补 1280×720

### C. 工程信息

- **registry / config 注册入口**：`src/config/gameModes.js`（`PLAY_MODES` + `GAME_MODES`）
- **runtime / session**：复用现有 `useGameSession` 或 `useStarLineInteraction`，或声明新 hook
- **level schema**：关卡数据必需字段（id、N、规则参数、solution 等）
- **输入能力声明**：鼠标/触摸板，单击/拖动/多点操作范围
- **完成判定**：路径判定 / 规则判定 / solution 比对
- **存档 namespace**：进度 key、高分 key、中断存档 key、教学存储 key
- **进度与迁移**：是否共享现有进度 schema，是否需要迁移
- **教学入口**：首次进入提示 / 分步教学 / proof-driven curriculum / 无
- **validator**：接入现有 `validate:levels` 还是新增检查项
- **solver**：复用现有 constraint-propagation + backtracking 还是新算法
- **E2E 导航方式**：家族入口 + mode 切换 + 关卡 tile 选择
- **analytics/埋点**：如果项目未来接入埋点，声明关键事件

### D. 生产信息

- **原型关卡数量**：3–5 关（验证核心机制）
- **正式关卡生产门槛**：通过 Go/No-Go 评审后的最小关卡集
- **数据与正式目录隔离**：原型放在独立目录，不得混入 `src/data/`
- **Go/No-Go 评审**：满足第八部分全部条件
- **发布与回滚方案**：如何在不影响现有玩法的情况下上线和回滚

### 当前真实结构 vs 未来可能性

**当前真实结构（v0.27.0）：**

- `PLAY_MODES` 常量定义在 `src/config/gameModes.js`
- `GAME_MODES` 是包含所有配置的平面对象（非嵌套家族结构）
- `ONE_LINE_MODE_LIST` 和 `STAR_LINE_MODE_LIST` 是两个独立数组（在 `PuzzleBookPage` 中按入口来源选择）
- 家族视觉映射在 `src/config/replayVisualFamily.js`（`REPLAY_VISUAL_FAMILY_BY_MODE`）
- `oneLine` / `starLine` 已作为 P3A 设计合同中的 familyId 使用，但当前 mode config 没有 `familyId` 字段
- 没有集中的「家族注册表」
- 没有声明式输入能力描述
- runtime/session 由 `App.jsx` 中的条件分支选择

**P3B 建议补充的最小接缝（不改变当前结构）：**

- 明确 family→mode 映射为单一来源（当前分散在 `ONE_LINE_MODE_LIST`、`STAR_LINE_MODE_LIST` 和 `replayVisualFamily.js`）
- 为 mode config 增加可选的 `familyId` 字段（只读标记，不改变运行时行为）

**未来可能性（非当前计划）：**

- 集中的家族注册表，支持按 familyId 查询 mode 列表、共享资产和存档 namespace
- 声明式输入能力、runtime 类型和完成判定方式
- 新家族骨架模板

---

## 第八部分：Go / No-Go 门槛

### 进入正式生产前必须全部满足（Go 条件）

- [ ] 家族归属明确（现有家族或充分论证的新家族）
- [ ] 与现有玩法差异明确（至少 2 个非颜色差异）
- [ ] 核心机制原型成立（3–5 关可玩且人工验收通过）
- [ ] 输入方式可稳定实现（不依赖尚未支持的硬件或平台能力）
- [ ] 最小关卡集验证通过（validator 全覆盖、solver 唯一解验证）
- [ ] 状态矩阵完整（覆盖第五部分所有状态）
- [ ] 存档合同明确（namespace、schema、迁移策略）
- [ ] 教学可解释（新玩家能够在教学引导下完成第一关）
- [ ] validator / solver 路径明确（已存在的可复用，或新算法已通过原型验证）
- [ ] 移动端或小视口策略明确（1024×768 下核心操作可用）
- [ ] 不需要大规模破坏现有架构（改动限于 config 注册 + 家族/mode 级别文件）
- [ ] 人工体验验收通过（非开发人员能理解并完成第一关）

### 直接 No-Go 的情况

- ❌ 只靠换色形成差异
- ❌ 规则难以用一句话说明
- ❌ 输入方式与当前平台冲突（例如需要键盘、多点触控、陀螺仪等）
- ❌ 必须先重写 App 才能实现
- ❌ 尚未验证就要求生产 30–60 关
- ❌ 与现有玩法体验高度重叠
- ❌ 无法建立稳定 validator
- ❌ 存档会污染其他玩法（namespace 冲突或共享 schema 误写）

---

## 第九部分：P3B 最小 runtime 接缝建议

以下基于 v0.27.0 源代码审计，列出 P3B 应解决的最小工程接缝。P3B 只拆真正阻碍新玩法原型的接缝，不重写 App，不建立万能框架。

| # | 当前问题 | 真实代码位置 | 影响范围 | 建议的最小接缝 | 优先级 | 风险 | 验收条件 | 明确不做什么 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | family→mode 映射分散在三处 | `gameModes.js:231-246`（列表）、`replayVisualFamily.js:6-13`（视觉映射）、`App.jsx:1059`（`isStarLineCatalog` 分支） | 新增家族时需改三处 | 在 `gameModes.js` 中增加 `GAME_FAMILIES` 常量和 `getFamilyId(modeId)` 函数，作为单一来源；`replayVisualFamily.js` 和 `App.jsx` 改为引用它 | **Must** | 低：纯常数重构，不改行为 | `getFamilyId('classic') === 'oneLine'`；`getFamilyId('starSingle') === 'starLine'`；现有 E2E 全绿 | 不改变 `ONE_LINE_MODE_LIST`/`STAR_LINE_MODE_LIST` 的列表语义；不改变 `PuzzleBookPage` 的渲染逻辑 |
| 2 | runtime/session 分支隐式耦合 modeId | `App.jsx:1106-1125`（`isStarLineFlag`、`isHiddenFlag`、`portalRun` 三重条件分支） | 新玩法需要新增分支 | 将 runtime 选择逻辑提取为 `getModeRuntime(modeId)`，返回 `{ sessionType, interactionType, ... }` | **Must** | 中：涉及 session 生命周期，需仔细测试 | 现有六玩法游戏内行为不变；新 runtime 类型可扩展 | 不改变 `useGameSession` / `useStarLineInteraction` 内部实现 |
| 3 | 关卡 schema 无统一声明 | 各数据文件独立定义字段（`starLineLevels.js` 有 `starsPerRow/Col/Region`，`hiddenLevels.js` 有 `keyNumbers`，`portalLevels.js` 有 `portals`） | 新关卡类型需要猜测必需字段 | 在每个 mode config 中增加 `levelSchema` 声明（纯文档性，不影响运行时） | **Should** | 低：文档性变更 | 每种 mode 的 `levelSchema` 与现有数据文件字段一致 | 不自动生成 TypeScript 类型；不添加运行时 schema 校验 |
| 4 | 输入能力无声明位置 | 输入方式在各组件内部隐式实现（`usePathInteraction` 处理拖动连线，`useStarLineInputController` 处理 Star Line 单击/拖动） | 新输入方式无明确接入点 | 在 mode config 中增加可选的 `inputCapabilities` 声明 | **Should** | 低：文档性变更 | 每个 mode 有明确的输入能力声明 | 不在运行时读取 `inputCapabilities`；不建立输入抽象层 |
| 5 | 教学接入无集中注册 | 教学触发分散在 `App.jsx`（`ruleDiscovery`、`starLineGuidance`、`starLineDoubleGuidance`）和各 hook | 新教学类型需要修改 App.jsx | 在 mode config 中增加 `tutorial` 字段（可选），声明教学类型 | **Should** | 低 | 现有教学行为不变；新 mode 可通过 config 声明教学 | 不统一教学 hook 签名；不改变现有教学实现 |
| 6 | 原型数据与正式目录隔离 | P3A 模板已禁止原型进入 `src/data/`，但当前只有 `devLevelCandidates.generated.js` 和两个 Star Line candidate 子目录具备既有忽略规则，尚无通用原型目录 | 原型关可能误入正式目录 | 在 P3B 为通用原型目录确定位置、`.gitignore` 规则和晋升流程 | **Should** | 低：文档性变更 | 原型关卡有明确的独立目录、忽略规则和晋升流程 | 不把原型放入 `src/data/`；不修改现有正式数据文件 |
| 7 | 进度 schema 无文档化 schema | 每种 mode 的 progress 结构隐式定义在各自的 normalization 函数中 | 新 mode 的 progress 设计无参考 | 在 `docs/game-family-design-system.md` 的家族地图中已记录所有存档 key；后续可为每种 mode 补充 schema 文档 | **Defer** | 低 | 每个 mode 有文档化的 progress schema | 不修改代码 |
| 8 | E2E mode 识别依赖 data-testid | 测试使用 `data-testid="mode-card-{modeId}"` 和 `data-testid="puzzle-book-title"` 文本匹配 | 新增 mode 需同步添加 testid | 已有 `switchMode(page, modeId)` helper，新 mode 只需添加 modeId 常量即可 | **Defer** | 低 | 新 mode 的 E2E 使用现有 helper 即可导航 | 不重写 E2E helper |
| 9 | 建立万能玩法框架 | — | 全部 | — | **No-Go** | 极高：过度抽象 | — | P3B 不做任何超出上述接缝的抽象 |
| 10 | 全量拆分或重写 App.jsx | — | 全部 | — | **No-Go** | 极高：破坏所有现有行为 | — | 只允许第 1–2 项验收所需的局部调用点替换；不做整文件拆分、重写或无关重构 |
| 11 | 迁移无关存档 | — | 存档相关 | — | **No-Go** | 高：数据丢失风险 | — | P3B 不迁移任何未明确声明需要迁移的存档 |

### P3B 执行约束

- 只拆真正阻碍新玩法原型的接缝
- 不重写 App
- 不建立万能玩法框架
- 不迁移无关存档
- 不重新设计 UI
- 不同时开发新玩法
- 不修改现有玩家行为
- 一次 PR 可完成
- 可单独回滚

---

## 第十部分：参考文档索引

| 文档 | 角色 |
| --- | --- |
| `docs/game-family-design-system.md`（本文档） | 玩法家族设计权威规范 |
| `docs/ui-design-system.md` | 产品级 UI 设计规范 |
| `docs/ui-art-direction.md` | 视觉审美方向约束 |
| `docs/player-experience-rules.md` | 玩家体验硬约束 |
| `docs/game-explanation-system.md` | 玩法说明统一文案 |
| `docs/gameplay-design-template.md` | 新玩法设计模板 |
| `docs/ai-development-sop.md` | AI 开发流程规范 |
| `src/config/gameModes.js` | mode 注册与配置（代码层权威来源） |
| `src/config/replayVisualFamily.js` | 重玩视觉家族映射 |
| `README.md` | 项目总览与 navigation |
| `ROADMAP.md` | 路线与阶段状态 |
| `CHANGELOG.md` | 已发布版本记录 |
