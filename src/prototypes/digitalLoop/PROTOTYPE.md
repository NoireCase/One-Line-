# P4B 数字环线 Edge/Input Spike · 原型档案

> 本档案遵循 `docs/prototype-isolation-contract.md`。原型目录是可整体删除的叶子依赖；删除本目录与 App 集中调用点后，正式构建与正式玩法必须仍然成立。
> 平台范围遵循 [`docs/platform-support-policy.md`](../../../docs/platform-support-policy.md)：**P4B 为桌面限定阶段**（Windows / macOS 电脑浏览器），手机和平板由全局门禁拦截；移动端不属于 P4，不建立 `P4B-M`。

## 基本信息

| 项 | 值 |
| --- | --- |
| Prototype ID | `digital-loop` |
| P4B 阶段状态 | **COMPLETE**（2026-08-01 桌面最终人工验收通过，PR #39 已合并） |
| 原型生命周期 | **Review / Accepted for extraction**（通用模块晋升至 `src/game/edgePuzzle/`，原型改为消费生产底座；「COMPLETE」是阶段状态词，不是生命周期枚举） |
| P4C 裁决 | **GO WITH CHANGES**（见 [`docs/p4c-digital-loop-technical-decision.md`](../../../docs/p4c-digital-loop-technical-decision.md)） |
| 产品家族 | 界环谜阵（第三卷，产品方向已确定；工程 familyId/modeId 未注册） |
| 当前阶段 | Package 1：Production Edge Puzzle Foundation（进行中） |

## DEV-only 入口

- 入口参数：`?prototype=digital-loop`
- 门槛：复用仓库既有 DEV/playtest 双重门槛（`import.meta.env.DEV` 或 `?playtest=1`）
- 装配：`src/prototypes/digitalLoop/index.jsx` 的 `DigitalLoopPrototypeHost`，App.jsx 唯一集中调用点；**动态加载**（React.lazy + Suspense），普通 App 启动不静态加载原型实现（异步 chunk，见「生产化迁移」）
- 生产默认状态不可见；正式首页、关卡选择页、`GAME_MODES`、`GAME_FAMILIES`、runtime registry 均无原型

## 生产化迁移（Package 1）

- 通用模块已晋升至 `src/game/edgePuzzle/`（生产层，供数字环线与方格版对称分区复用）；本原型 `input/` 与 `graph/edgeGraph.js` 为**薄 re-export**，不维护第二套实现。
- 生产层不 import 原型；原型规则层（diagnoseStructure / clue evaluator / completion / diagnosticBoards / 棋盘与调试面板）继续保留在本原型。
- 本原型不进入正式 registry、存档、进度、奖励。

## 实现范围

- square-grid Edge Board 纯函数底座（坐标、稳定 key、邻接、合法性）
- 三态 Edge State（undecided / line / excluded），数据语义与视觉表现分离；三态严格互斥（任意时刻一条 Edge 只有一个状态；状态转换矩阵见「桌面输入最终收敛」，**不**存在「只能经过 undecided」的限制）
- Board geometry 与几何命中（点到有限线段距离 + corridor + ambiguity，viewBox 缩放一致性）
- Pointer Events 手势状态机（pointerdown/move/up/cancel、capture、失焦、多指隔离、同边去重、右键单击延迟提交）
- 桌面输入映射：左键线（点击/拖动，add / remove line）、右键单击单个 X、Shift+左键点击/拖动连续 X（add / remove excluded）
- A/B/C 输入方案历史比较已从 UI 删除（方案 B 已取消 Erase；方案 C 按平台政策整体暂缓，仅本文档记录）
- 内存 undo（一次手势一个 transaction，不写 localStorage）
- 第一层结构诊断（Empty / Open Chain / Closed Single Loop / Branch / Multiple Loops / Invalid Edge Reference）
- 第二层最小 Loopy 数字线索（少于 / 等于 / 超限；单环 ∧ 至少一个线索 ∧ 全部满足 = 完成；无数字不得完成）
- 14 个诊断场景（含 10×10 / 11×11 压力棋盘与完成状态正例）
- Hover 反馈与 DEV-only Hit Debug（corridor / ambiguity / 轨迹可视化，pointer-events: none 装饰图层）

## 明确非目标（P4B 不做）

- 完整 Solver、唯一解验证、自动生成、难度分类
- 正式 Validator 管线、正式关卡、正式教学
- 正式 family/mode 注册、玩家入口、存档、进度、奖励
- Galaxies / 对称分区任何实现
- 多网格类型（非方格网格）
- 正式美术、正式完成流程（WinPanel 等）

## 桌面输入最终收敛（本轮）

- **输入映射（桌面人工验收后冻结）**：左键 = line 通道（点击/拖动）；**右键单击** = 单个 X（延迟提交，pointerdown 不修改 Edge，超过点击阈值即取消）；**Shift+左键** = X 通道点击与连续拖动（Shift 在 pointerdown 锁定，中途松开不切换）。
- **右键拖动不属于正式支持输入**：secondary drag 可能被操作系统、触摸板或浏览器扩展占用（紫色轨迹、扩展手势等外部行为），不作为网页兼容目标；网页本身不因右键拖动产生任何 Edge 修改、不残留起点 X、不产生 Undo。
- **Line 优先于 X**：左键可从 undecided 或 excluded 起手直接覆盖为 line（paint-line）；X 不允许覆盖 line（X 通道命中 line 不产生变化）。
- 状态转换矩阵：左键 undecided→line、line→undecided、excluded→line；右键单击或 Shift+左键 undecided→excluded、excluded→undecided、line 保持。
- **独立 Erase 工具已取消**；A/B/C 历史比较与可切换工具模式已全部删除（方案 C 按平台政策整体暂缓，仅在本文档记录，不在 UI 中运行）。
- 三态严格互斥：任意时刻一条 Edge 只有一个状态；Undo 恢复手势前的真实状态（左键覆盖 X 后 Undo 恢复 X，而非 undecided）。
- 点击/拖动阈值按**屏幕 CSS 像素**判定（候选 5px，作为 DEV 参数展示，未冻结）。
- **连续笔划模型**：拖动中按 A→B 线段有序采样（步长 0.2×cell），采样点统一 hit-testing；Edge 相邻约束（相同或共享顶点）防止隔空跳边；顶点按「共享顶点 → 移动方向一致 → 距离近」裁决；整个笔划一次提交一个 undo step。
- 预览语义：普通 Hover 中性（不预判通道）；左键按下 paint-line / remove-line 预览；X 通道按下显示小 X 预览（右键 pending 单击同样只显示单 Edge X 预览，不提前提交）；remove 淡出；X 命中 line 显示不可覆盖；右键按下后移动超阈值时 X 预览立即清除。
- **X 视觉归属**：缩小约 28%（half 0.13×cell）、严格居中 Edge 中点、后方基础网格边压暗断开；视觉不影响 hit-testing。
- 浏览器行为：棋盘内 `dragstart` / `contextmenu` preventDefault、`user-select: none`、`-webkit-user-drag: none`；装饰图层 `pointer-events: none`。
- 快捷键：**Cmd/Ctrl+Z** 撤销一步（输入框/select/textarea 聚焦时不劫持）；**Esc** 取消活跃笔划（等价 pointercancel：回滚、不入栈、释放 capture、清空反馈；无手势时无副作用）。
- **这不是 P4C GO，也不是正式产品输入合同。**

## 当前命中参数（候选值，未冻结）

- cell 边长（viewBox 域）：40px
- hit corridor 半宽：0.32 × cell（= 12.8 viewBox px；格中心/线索中心/平行边中间有稳定安全区）
- ambiguity 距离差阈值（tie ε）：1.0 viewBox px（横/竖候选几乎等距时判歧义，不提交错误 Edge）
- 点击/拖动阈值：5 屏幕 CSS px
- 轨迹采样步长：0.2 × cell（viewBox 域）

命中模型：点到有限 Edge segment 距离；不使用大面积圆形死区（Edge 可见长度 10%–90% 均可命中）；外边界与棋盘 padding 按几何自然处理。实际设备像素值随 SVG 缩放变化；原型诊断面板实时显示 cell 像素边长与走廊/ε 像素值。所有数值为 P4B 实测候选值，未冻结。

## 当前已知限制

- 移动端输入按 [`docs/platform-support-policy.md`](../../../docs/platform-support-policy.md) 整体暂缓：移动端不属于 P4，不建立 `P4B-M`，不进行单玩法移动端适配；方案 C 不运行、不验收。
- X 通道从 line 起手不启动手势（不覆盖 line；需从 undecided/excluded 起手）。
- **Mac 触摸板 secondary drag 不作为正式输入**：双指点按可标记单个 X（右键单击路径）；连续标记请使用 Shift+左键拖动。不要求 secondary drag 通过（可能被系统或浏览器扩展占用）。
- 异形棋盘（三角形、蜂巢、Penrose 等）属于数字环线未来拓扑扩展，本轮不实施。
- 无正式 redo。
- 本轮不处理移动端、移动 390×844、长按（按平台政策整体暂缓；390×844 仅作为桌面窄窗口回归视口）。
- 命中为全边线性扫描（10×10 220 条 / 11×11 264 条，当前规模性能可接受）。
- excluded 视觉（虚线 + ×）为原型表达，不冻结正式美术。

## 自动验证结果

| 项 | 结果 |
| --- | --- |
| 纯函数测试（坐标/key、命中、手势、结构、线索） | 见 `tests/` 运行结果（含 45° 斜向过顶点、连续多转角、高速过顶点、字面量坐标命中、8 字形 Branch、完成正例证据） |
| 原型聚焦浏览器测试 | `e2e/prototypes/digital-loop.spec.js` |
| 移动门禁聚焦测试 | `e2e/desktop-only-gate.spec.js` |
| build | 按验证结果 |
| 1440×900 / 390×844（桌面窄窗口）渲染 | 按验证结果 |
| 正式存储隔离 | 原型不读写任何 `cg_*` 正式 key |
| 完整 E2E | 收口前运行一次（PR 前按验证预算） |

## 人工验收归档（2026-08-01）

用户已完成桌面最终人工验收，冻结结论：

- 左键点击/拖动：添加或删除 line；**line 可以覆盖 X；X 不覆盖 line**。
- 右键单击：添加或删除单个 X；**右键拖动不属于正式支持输入**（可能被系统/触摸板/浏览器扩展占用），且不得修改任何 Edge。
- Shift+左键点击/拖动：添加或删除 X；一次笔划一个 Undo；Cmd/Ctrl+Z、Esc 保留。
- 当前仅支持桌面；手机和平板只显示「请使用电脑体验」（全局门禁，见 `docs/platform-support-policy.md`）。
- **后续操作手感优化必须进入真实数字环线关卡后再进行**，不在原型内继续调整输入参数。

验收覆盖：鼠标 5×5 / 10×10 / 11×11（左键线、覆盖 X、Undo 恢复 X、右键单击 X、Shift+左键点击与拖动 X、连续直线/快速直线/连续删除/多次直角/连续转角、起始动画不残留、Hover 与按下预览、Cell 与数字区域安全区、Esc、Cmd+Z、右键拖动无副作用）；Mac 触摸板（左键拖动、双指点按标记/删除单个 X、双指移动不作为连续 X 输入、Shift+左键连续 X、不要求 secondary drag 通过）。

移动端验证本轮不做：移动端按 [`docs/platform-support-policy.md`](../../../docs/platform-support-policy.md) 整体暂缓（不属于 P4，不建立 `P4B-M`，不再作为 P4C GO 条件）。

## 模型边界（收口结论）

- 当前**方格 Edge 模型可复用于方格版对称分区**（第二候选玩法复用 Edge Model、hit testing、Pointer input、手势撤销，仅替换 validator）。
- 当前模型**仅适用于正交方格**：不是异形棋盘（三角形、蜂巢、Penrose 等）引擎，也不是通用平面图引擎。
- 后续输入优化、手感调优与异形棋盘扩展转入**真实数字环线关卡阶段**（P4C 之后的独立工程包）。

## P4C

**P4C 已裁决：GO WITH CHANGES**（详见 [`docs/p4c-digital-loop-technical-decision.md`](../../../docs/p4c-digital-loop-technical-decision.md)）。裁决确认：桌面技术方向成立、不需要返回输入 Spike、可进入正式生产化工程；不允许把整个原型目录直接作为生产实现。本原型只提供证据，不输出正式玩法结论。
