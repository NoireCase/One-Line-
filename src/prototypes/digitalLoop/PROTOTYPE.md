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

## 桌面输入收敛（本轮）

- 桌面阶段已选择**双通道直接输入**：左键 = line（起点 undecided → 添加；起点 line → 删除）；右键 / secondary click = X（起点 undecided → 添加；起点 excluded → 删除）。
- **独立 Erase 工具已取消**（UI、状态、分支逻辑、测试预期全部移除）。
- 线 / X **严格互斥**：line 与 excluded 之间无直接转换，任何转换必须经过 undecided；左键不覆盖 X、右键不覆盖 line。
- 起始 Edge 决定操作模式；拖动经过互斥状态一律跳过。
- Hover 与 pointerdown 复用同一 hit-testing 事实源。
- A/B/C 历史比较保留在 DEV Debug 折叠区（方案 B 只保留 Line / X；方案 C 标记「移动端暂缓」，本轮不测试、不优化）。
- **这不是 P4C GO，也不是正式产品输入合同。**

## 当前命中参数（候选值，未冻结）

- cell 边长（viewBox 域）：40px
- hit corridor 半宽：0.32 × cell（= 12.8 viewBox px）
- ambiguity 距离差阈值（tie ε）：1.0 viewBox px（横/竖候选几乎等距时判歧义，不提交错误 Edge）
- 拖动移动阈值：5 viewBox px
- 长按阈值（方案 C，移动端暂缓）：450ms

命中模型：点到有限 Edge segment 距离；不使用大面积圆形死区（Edge 可见长度 10%–90% 均可命中）；外边界与棋盘 padding 按几何自然处理。实际设备像素值随 SVG 缩放变化；原型诊断面板实时显示 cell 像素边长与走廊/ε 像素值。所有数值为 P4B 实测候选值，未冻结。

## 当前已知限制

- 纯移动触摸端输入方案尚未裁决（方案 C 暂缓；secondary 通道在纯触摸不可用）。
- excluded 边作为左键拖动起点、line 边作为右键拖动起点时不启动手势（互斥保护）。
- 快速拖动不做轨迹插值：单帧大跨度只记录实际命中的边（当前方格棋盘最小可靠方案，不建立通用多边形路径引擎）。
- Mac 触摸板 secondary drag 的稳定性待人工验收记录；如无法稳定支持，保留右键点击 X 通道。
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

## 待人工验证项（桌面）

- 鼠标 5×5：左键加线、左键删线、右键加 X、右键删 X、线/X 不覆盖、直线、直角、Undo、点击 Edge 两端附近、点击 X 中心、点击 line 中心
- 鼠标 10×10：连续画 10 条以上 Edge、连续删除、连续右键 X、多次直角、是否误选相邻 Edge、是否明显掉帧
- 鼠标 11×11：单边精确点击、快速拖动、直角、line/X 删除、Hit Debug 检查视觉与几何是否一致
- Mac 触摸板：左键拖动、secondary click、secondary click 删除 X、secondary drag、context menu 是否频繁弹出、是否易误当左键（如 secondary drag 不稳定，如实记录，保留右键点击 X 通道）
- 记录：最易误触位置、hit corridor 宽窄、歧义区是否合理、10×10/11×11 是否可用、是否掉帧

移动端验证（390×844、长按、触摸）本轮不做；移动端输入方案尚未裁决。

## P4C

P4C 尚未裁决。本原型只提供证据，不输出 GO。
