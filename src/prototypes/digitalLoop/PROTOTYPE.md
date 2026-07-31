# P4B 数字环线 Edge/Input Spike · 原型档案

> 本档案遵循 `docs/prototype-isolation-contract.md`。原型目录是可整体删除的叶子依赖；删除本目录与 App 集中调用点后，正式构建与正式玩法必须仍然成立。

## 基本信息

| 项 | 值 |
| --- | --- |
| Prototype ID | `digital-loop` |
| 当前状态 | **Active Spike** |
| 产品家族 | 界环谜阵（第三卷，产品方向已确定；工程 familyId/modeId 未注册） |
| 当前阶段 | P4B |
| P4C | **尚未裁决**（本原型不产出 GO 结论） |

## DEV-only 入口

- 入口参数：`?prototype=digital-loop`
- 门槛：复用仓库既有 DEV/playtest 双重门槛（`import.meta.env.DEV` 或 `?playtest=1`）
- 装配：`src/prototypes/digitalLoop/index.js` 的 `DigitalLoopPrototypeHost`，App.jsx 唯一集中调用点
- 生产默认状态不可见；正式首页、关卡选择页、`GAME_MODES`、`GAME_FAMILIES`、runtime registry 均无原型

## 实现范围

- square-grid Edge Board 纯函数底座（坐标、稳定 key、邻接、合法性）
- 三态 Edge State（undecided / line / excluded），数据语义与视觉表现分离；三态严格互斥（转换只能经过 undecided）
- Board geometry 与几何命中（点到有限线段距离 + corridor + ambiguity，viewBox 缩放一致性）
- Pointer Events 手势状态机（pointerdown/move/up/cancel、capture、失焦、多指隔离、同边去重、右键拖动）
- 桌面双通道直接输入：左键线（add / remove line）、右键 X（add / remove excluded）
- A/B/C 输入方案历史比较保留在 DEV Debug 折叠区（方案 B 已取消 Erase；方案 C 移动端暂缓）
- 内存 undo（一次手势一个 transaction，不写 localStorage）
- 第一层结构诊断（Empty / Open Chain / Closed Single Loop / Branch / Multiple Loops / Invalid Edge Reference）
- 第二层最小 Loopy 数字线索（少于 / 等于 / 超限；单环 ∧ 至少一个线索 ∧ 全部满足 = 完成；无数字不得完成）
- 13 个诊断场景（含 10×10 / 11×11 压力棋盘）
- Hover 反馈与 DEV-only Hit Debug（corridor / ambiguity / 轨迹可视化，pointer-events: none 装饰图层）

## 明确非目标（P4B 不做）

- 完整 Solver、唯一解验证、自动生成、难度分类
- 正式 Validator 管线、正式关卡、正式教学
- 正式 family/mode 注册、玩家入口、存档、进度、奖励
- Galaxies / 对称分区任何实现
- 多网格类型（非方格网格）
- 正式美术、正式完成流程（WinPanel 等）

## 桌面输入最终收敛（本轮）

- **双通道直接输入**：左键 = line 通道；右键 或 **Shift+左键** = X 通道（同一通道逻辑，Shift 在 pointerdown 锁定，中途松开不切换）。
- **Line 优先于 X**：左键可从 undecided 或 excluded 起手直接覆盖为 line（paint-line）；X 不允许覆盖 line（X 通道命中 line 不产生变化）。
- 状态转换矩阵：左键 undecided→line、line→undecided、excluded→line；右键/Shift+左键 undecided→excluded、excluded→undecided、line 保持。
- **独立 Erase 工具已取消**；A/B/C 历史比较与可切换工具模式已全部删除（方案 C 仅在本文档记录为「移动端暂缓」，不在 UI 中运行）。
- 三态严格互斥：任意时刻一条 Edge 只有一个状态；Undo 恢复手势前的真实状态（左键覆盖 X 后 Undo 恢复 X，而非 undecided）。
- 点击/拖动阈值按**屏幕 CSS 像素**判定（候选 5px，作为 DEV 参数展示，未冻结）。
- **连续笔划模型**：拖动中按 A→B 线段有序采样（步长 0.2×cell），采样点统一 hit-testing；Edge 相邻约束（相同或共享顶点）防止隔空跳边；顶点按「共享顶点 → 移动方向一致 → 距离近」裁决；整个笔划一次提交一个 undo step。
- 预览语义：普通 Hover 中性（不预判通道）；左键按下 paint-line / remove-line 预览；X 通道按下显示小 X 预览；remove 淡出；X 命中 line 显示不可覆盖。
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

- 纯移动触摸端输入方案尚未裁决（方案 C 暂缓，不在 UI 中运行；secondary 通道在纯触摸不可用）。
- X 通道从 line 起手不启动手势（不覆盖 line；需从 undecided/excluded 起手）。
- Mac 触摸板 secondary drag 的稳定性待人工验收记录；如无法稳定支持，可用 Shift+左键替代（保留右键点击 X 通道）。
- 异形棋盘（三角形、蜂巢、Penrose 等）属于数字环线未来拓扑扩展，本轮不实施。
- 无正式 redo。
- 本轮不处理移动端、390×844、长按优化。
- 命中为全边线性扫描（10×10 220 条 / 11×11 264 条，当前规模性能可接受）。
- excluded 视觉（虚线 + ×）为原型表达，不冻结正式美术。

## 自动验证结果

| 项 | 结果 |
| --- | --- |
| 纯函数测试（坐标/key、命中、手势、结构、线索） | 见 `tests/` 运行结果 |
| 原型聚焦浏览器测试 | `e2e/prototypes/digital-loop.spec.js` |
| build | 按验证结果 |
| 1440×900 / 390×844 渲染 | 按验证结果 |
| 正式存储隔离 | 原型不读写任何 `cg_*` 正式 key |
| 完整 E2E | 本轮不运行（方向未稳定，按 P4A 测试预算） |

## 待人工验证项（桌面最终验收）

- 鼠标 5×5：左键单击线、左键覆盖 X、Undo 恢复 X、右键 X、Shift+左键 X、连续直线、快速直线、连续删除、多次直角、起始动画不残留、Hover 与按下预览、Esc、Cmd+Z
- 鼠标 10×10：快速横向/纵向笔划、连续多个直角、连续删除、右键连续 X、Shift+左键连续 X、Cell 中心安全区、数字区域安全区、是否误选平行 Edge、是否明显掉帧
- 鼠标 11×11：单边点击、Edge 两端点击、快速长笔划、复杂折线、删除复杂折线、Hit Debug、Stroke Debug、是否隔空跳边
- Mac 触摸板：左键拖动、secondary click、secondary drag、Shift+左键点击与拖动、context menu、原生拖拽、点击抖动、直角、Cmd+Z、Esc（secondary drag 如不稳定，如实记录，保留 Shift+左键与右键点击 X 通道）

移动端验证（390×844、长按、触摸）本轮不做；移动端输入方案尚未裁决。

## P4C

P4C 尚未裁决。本原型只提供证据，不输出 GO。
