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
- 三态 Edge State（undecided / line / excluded），数据语义与视觉表现分离
- Board geometry 与几何命中（hit corridor、vertex dead zone、viewBox 缩放一致性）
- Pointer Events 手势状态机（pointerdown/move/up/cancel、capture、失焦、多指隔离、同边去重）
- 起始 Edge 决定 line / erase 拖动模式
- A/B/C 输入方案对比切换（不宣布最终胜出）
- 内存 undo（一次手势一个 transaction，不写 localStorage）
- 第一层结构诊断（Empty / Open Chain / Closed Single Loop / Branch / Multiple Loops / Invalid Edge Reference）
- 第二层最小 Loopy 数字线索（少于 / 等于 / 超限；单环 ∧ 全部满足 = 完成）
- 13 个诊断场景（含 10×10 / 11×11 压力棋盘）

## 明确非目标（P4B 不做）

- 完整 Solver、唯一解验证、自动生成、难度分类
- 正式 Validator 管线、正式关卡、正式教学
- 正式 family/mode 注册、玩家入口、存档、进度、奖励
- Galaxies / 对称分区任何实现
- 多网格类型（非方格网格）
- 正式美术、正式完成流程（WinPanel 等）

## A/B/C 输入方案说明

| 方案 | 实现 | 支持设备 | 已知限制 |
| --- | --- | --- | --- |
| A · 桌面参考 | 主键 line 添加/擦除（起点决定）；secondary 键 toggle excluded | 桌面鼠标；Mac 触摸板（双指/ctrl+click 可作 secondary） | **纯移动触摸无法完整使用**（无 secondary 键），不得伪装为跨平台最终方案 |
| B · 统一工具 | DEV toolbar：Line / Excluded / Erase；工具切换不入 undo | 鼠标、触摸板、触摸一致 | 多一步工具切换；撤销语义不含工具状态 |
| C · 移动手势 | 主拖动按起点决定；长按（450ms 候选）toggle excluded；长按发生有效移动后取消 | 触摸、触摸板 | 长按阈值未冻结；长按与滚动手势的冲突待实测 |

P4B 不预判最终赢家：三方案均保留，由人工验收与 P4C 裁决。

## 当前命中参数（候选值，未冻结）

- cell 边长（viewBox 域）：40px
- hit corridor 半宽：0.32 × cell（= 12.8 viewBox px）
- vertex dead zone 半径：0.38 × cell（= 15.2 viewBox px）
- 拖动移动阈值：5 viewBox px
- 长按阈值（方案 C）：450ms

实际设备像素值随 SVG 缩放变化；原型诊断面板实时显示当前 cell 像素边长与走廊/死区像素值。

## 当前已知限制

- 方案 A 的 secondary 在纯触摸设备不可用（设计如此，待实测记录）。
- excluded 边作为主键拖动起点时不启动手势（P4B 待测项）。
- 点按（无移动）在 erase 模式不擦除（防误触；拖动才能擦除）。
- 无正式 redo。
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

## 待人工验证项

- 鼠标：单边点击、连续直线、直角转弯、擦除、secondary excluded、Undo、跨出棋盘再返回
- Mac 触摸板：连续拖动稳定性、起点误判、转弯、方案 B、方案 C 长按
- 移动触摸（390×844）：页面不滚动、直线、转弯、长按 excluded、长按移动取消、Undo、10×10、11×11
- 记录：最易误触位置、hit corridor 宽窄、dead zone 是否导致拐弯断线、A/B/C 哪个最自然、excluded 是否易理解、10×10/11×11 是否可用、是否掉帧

## P4C

P4C 尚未裁决。本原型只提供证据，不输出 GO。
