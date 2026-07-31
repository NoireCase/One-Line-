# Loopy / Galaxies 上游成熟实现参考（Edge Puzzle Upstream Reference）

> 本文档是 P4 数字环线规划与 Simon Tatham Portable Puzzle Collection 成熟 Loopy / Galaxies 架构研究的**非规范性工程参考（non-normative reference）**：记录上游规则、交互与架构研究结论，供后续 Solver / Validator / Generator 立项时作为参考起点。它不是玩法设计文档，不复制上游代码，只记录可追踪的架构事实与映射决策。
>
> **权威层级：本文档不是产品或技术合同，不构成任何实施要求。** 与正式合同冲突时，一律以正式合同为准——产品结构以 [`docs/game-family-design-system.md`](./game-family-design-system.md) 与 [`ROADMAP.md`](../ROADMAP.md) 为准；P4B 范围以 [`docs/digital-loop-edge-input-spike.md`](./digital-loop-edge-input-spike.md) 为唯一规范性来源；原型晋升边界以 [`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md) 为准。
>
> 相关合同：[`docs/digital-loop-edge-input-spike.md`](./digital-loop-edge-input-spike.md)（P4B 实施边界）、[`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md)（原型隔离）。

## 1. 来源层级

| 层级 | 来源 | 用途 |
| --- | --- | --- |
| 第一权威 | Simon Tatham 官方开发源码仓库：<https://git.tartarus.org/simon/puzzles.git> | 规则、当前后端结构和开发接口以官方最新源码为准 |
| 官方文档 | <https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/>（玩家文档）、<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/devel/>（开发者文档） | 规则说明与后端/前端架构说明 |
| 第二参考 | GitHub 镜像：<https://github.com/ghewgill/puzzles> | 方便检索、历史实现和平台适配参考；与官方存在差异时以官方为准 |

原则：不只看网页玩法说明推断架构；本轮不复制任何代码；未来若复制实质性代码必须遵守 MIT 许可证并保留版权与许可声明（见第 18 节）。

## 2. 调查 commit

本轮实际读取的官方源码快照：

| 项 | 值 |
| --- | --- |
| 仓库 | `https://git.tartarus.org/simon/puzzles.git`（**官方源**，clone 成功） |
| HEAD SHA | `3c3632259d298ab62aafa8a5858823569ab1af46` |
| 提交时间 | 2026-07-19 21:24:01 +0100 |
| 提交消息 | `Click-and-type puzzles: clicks outside grid hide cursor` |
| 调查方式 | `git clone --depth 1` 至 `/tmp/linebook-puzzles-upstream`，只读；未修改、未构建、未复制进入 One-Line |

## 3. 许可证

上游为 **MIT 许可证**（`LICENCE` 文件头部）：

- 版权：`This software is copyright (c) 2004-2024 Simon Tatham.`，另有 Richard Boulton、James Harvey 等多位贡献者的部分版权。
- 许可要点：免费使用/复制/修改/合并/发布/再许可/销售；必须包含以上版权声明与许可声明；软件按「AS IS」提供，无任何明示或暗示担保。

**One-Line 义务（本轮未触发，未来触发时执行）：** 如未来复制任何实质性代码（例如 Solver 或 Generator 的算法移植），必须：(1) 在受影响文件中保留上游版权与 MIT 许可声明；(2) 记录来源文件与上游 commit SHA；(3) 不删除或改写许可文本。本轮没有复制代码，因此不新增第三方源码或许可证文件。

## 4. Loopy 状态模型

成熟实现使用三态边状态（`loopy.c`）：

```c
enum line_state { LINE_YES, LINE_UNKNOWN, LINE_NO };   /* loopy.c:227 */
```

| 上游 | Linebook 映射 | 语义 |
| --- | --- | --- |
| `LINE_YES` | `line` | 属于环的边；参与完成判定 |
| `LINE_UNKNOWN` | `undecided` | 尚未决定；默认状态；参与完成判定（未定即未完成） |
| `LINE_NO` | `excluded` | 明确排除；**玩家推理标记**，不参与结构完成判定 |

关键事实：

- 三态各自承担不同语义：`LINE_YES` 是解的构成，`LINE_UNKNOWN` 是待定，`LINE_NO` 是玩家推理排除——**`LINE_NO` 不是纯视觉叉号**，它是求解与生成过程中的有效状态（solver 会消费它，见第 5、7 节）。
- 完成判定基于 `LINE_YES` 结构 + 数字线索；`LINE_NO` 帮助 solver 收敛但不直接决定结构。
- Solver **同时使用三态**：`dot_yes_count` / `dot_no_count`、`face_yes_count` / `face_no_count` 缓存分别统计 YES 与 NO（`solver_state`，loopy.c:149）。
- 绘制层另有独立四态：`enum line_drawstate { DS_LINE_YES, DS_LINE_UNKNOWN, DS_LINE_NO, DS_LINE_ERROR }`（loopy.c:228-229）——`DS_LINE_ERROR` 是错误反馈的绘制状态，与输入状态模型分离。这与 Linebook「数据语义与视觉表现分离」的合同一致。
- 序列化用 run-length 编码表达三态（`state_to_text()`，loopy.c:724；`new_game_desc` 注释「solution and description both use run-length encoding in obvious ways」）。

## 5. Loopy 棋盘与图模型

通用图模型在 `grid.c` / `grid.h`（Loopy 与其他边谜题共享）：

| 概念 | 上游结构 | 事实 |
| --- | --- | --- |
| vertex | `grid_dot` | `index`、`order`（关联边数）、`edges`、`faces`（NULL = 外部无限面）、`x/y`（任意 Cartesian 整数坐标，避免溢出） |
| edge | `grid_edge` | `dot1` / `dot2`（两个端点）、`face1` / `face2`（NULL = 外部无限面）、`index` |
| face / cell | `grid_face` | `index`、`order`、`edges`、`dots`、可选 `incentre`（格内接圆圆心，用于绘制线索数字） |
| grid | `grid` | `faces` / `edges` / `dots` 数组与计数、bounding box、`tilesize`、`refcount`；**生成后不可变** |
| 顶点度数 | `grid_dot->order` + `dot_yes_count` | 顶点处 YES 边数实时统计 |
| 连通分量 | `DSF *dotdsf`（solver） | 顶点 union-find 结构 |

多网格支持：`grid_type` + `GRIDGEN_LIST`（SQUARE / HONEYCOMB / TRIANGULAR / SNUBSQUARE / CAIRO / GREATHEXAGONAL / KAGOME / OCTAGONAL / KITE 等），`grid_new()` 统一生成，`grid_desc` 编码网格类型与尺寸。

**Linebook 决策：** P4 第一阶段只实现 **square grid / 规则矩形棋盘**。应保留的抽象：vertex / edge / face 三实体、edge 两个端点与相邻 face、顶点度数、连通分量、与屏幕坐标分离的数据坐标。暂不实现：多网格类型、`incentre`、非矩形网格。

## 6. Loopy Validator（完成与错误判定）

上游把「错误」拆在两层：

1. **局部冲突**：`game_state->line_errors[]`（每边错误标记）+ solver 的 `SOLVER_MISTAKE`。数字线索超限（face 周边 YES 数超过数字）、顶点 YES 边数 ≥ 3（分支）都会标记错误。
2. **结构问题**：`exactly_one_loop`（loopy.c `game_state` 字段）跟踪「是否恰好一个环」；小环、多环、死端通过 solver 判定。

最终状态由 solver 输出（`solver_status`，loopy.c:141-145）：

```c
enum solver_status {
    SOLVER_SOLVED,    /* This is the only solution the solver could find */
    SOLVER_MISTAKE,   /* This is definitely not a solution */
    SOLVER_AMBIGUOUS, /* This _might_ be an ambiguous solution */
    SOLVER_INCOMPLETE /* This may be a partial solution */
};
```

**Linebook 建议区分的五态（参考基线，与上游对齐；正式判定合同以 Spike 合同及未来 Validator 工程包为准）：**

| Linebook 状态 | 上游对应 | 含义 |
| --- | --- | --- |
| 当前局部冲突 | `SOLVER_MISTAKE` 级局部错误（`line_errors`） | 线索超限或顶点分支，当前即错 |
| 当前仍可继续 | `SOLVER_INCOMPLETE` | 无冲突但未闭合/未满足 |
| 结构闭合但数字未满足 | solver 对线索的判定 | 单环成立但存在线索不足 |
| 数字满足但结构不是单环 | `exactly_one_loop == false` + 线索满足 | 多环/死端 |
| 完整成功 | `SOLVER_SOLVED` | 单环 ∧ 全部线索满足 ∧ 唯一解 |

## 7. Loopy Solver 架构

- **状态**：`solver_state`（loopy.c:149）——包装 `game_state`、`solver_status`、`looplen`（每个 dot 连接数）、难度 `diff`、统计缓存（`dot_yes_count` / `dot_no_count` / `face_yes_count` / `face_no_count` / `dot_solved` / `face_solved`）、`dotdsf`（连通）、`dlines`（Normal 级对偶线位掩码）、`linedsf`（Hard 级）。
- **推理顺序**：`SOLVERLIST` 按计算成本从低到高排序，快推理先跑、慢推理只在快推理无进展时启用；每个推理函数关联难度级别，生成难度 = 只允许 ≤ 该难度的推理（loopy.c 注释）。
- **推理类型**：`trivial_deductions`（EASY）、`dline_deductions`（NORMAL）、`linedsf_deductions`（HARD）、`loop_deductions`（EASY）。
- **递归试探**：`solve_game_rec()`（loopy.c:2951）——deduction 无法推进时递归尝试分支（AMBIGUOUS 由此检测）。
- **难度分层**：`DIFFLIST` 四层 `EASY / NORMAL / TRICKY / HARD`（loopy.c:192）。
- **数字线索**：`face_yes_count` / `face_no_count` 按面统计周边边状态。
- **顶点约束**：`dot_yes_count` / `dot_no_count`，结合 `looplen`（dot 处 YES 边连接数）。
- **全局连通**：`dotdsf`（顶点 union-find）+ `loop_deductions`（环结构推理，防止过早闭环/多环）。

**Linebook 后续 Solver 合同的参考基线（建议起点，与上游四态对齐；正式合同以未来 Solver 工程包立项与评审为准）：**

- `solved`（= SOLVER_SOLVED）
- `mistake`（= SOLVER_MISTAKE）
- `ambiguous`（= SOLVER_AMBIGUOUS）
- `incomplete`（= SOLVER_INCOMPLETE）

难度规划参考上游分层（EASY/NORMAL/TRICKY/HARD 四层、快推理先行、难度=可用的推理集合），但不要求沿用完全相同的名称或算法。

## 8. Loopy Generator

生成管线（`loopy.c` `new_game_desc()`，1514-1560 行附近）：

1. **初始完整解**：`generate_loop()`（`loopgen.c:302`，接口在 `loopgen.h`）在网格面上生成黑白分布（`FACE_WHITE` / `FACE_BLACK`，bias 函数可注入偏好），由此得到初始环；随后 `add_full_clues()`（loopy.c:1428）填充全部线索。
2. **唯一解检查**：`game_has_unique_soln()`（loopy.c:1459）调用 `solve_game_rec` 验证 `SOLVER_SOLVED`。
3. **线索移除**：`remove_clues()`（loopy.c:1478）——洗牌所有线索，逐个移除，每次移除后用唯一解检查验证；不可移除则回退（保留）。线索冗余自然被处理。
4. **难度约束**：生成难度 diff 下唯一解；且 `params->diff > 0` 时若 `diff-1` 难度下仍唯一解，则**拒绝重来**（`goto newboard_please`）——保证生成谜题不低于目标难度。
5. **失败重试**：do-while 循环重试；注释说明棋盘 ≥ 4×4 可防止无限循环。
6. **随机种子**：`random_state *rs`（所有随机操作经统一 random_state）。
7. **序列化**：`state_to_text()`（RLE）→ game description；`grid_new_desc()` 生成网格描述（类型 + 尺寸）。

**Linebook 决策：** P4B 不实现完整 Generator。长期路线（见 [`ROADMAP.md`](../ROADMAP.md)）中，后续完整数字环线原型不应只依赖手写关卡，最终需要：Solver、uniqueness validator、difficulty classifier、generator、deterministic seed、stable level schema（对应上游 random_state → game description 管线）；各部分的正式合同以未来对应工程包立项与评审为准。

## 9. Loopy 难度

- 生成侧：目标难度由 `params->diff` 决定，`remove_clues` 与「diff-1 可解则拒绝」双重约束（第 8 节）。
- 求解侧：每个 deduction 函数关联难度，低难度 solver 只能使用低难度推理（第 7 节）。
- 难度是「可用的推理集合」而非硬编码步数——该模型值得 Linebook 参考。

## 10. Loopy 输入限制（必须改写）

上游 `interpret_move()`（loopy.c:3045）明确是**点击限定**：

- 源码注释（loopy.c:3074-3075）：`/* I think it's only possible to play this game with mouse clicks, sorry */ /* Maybe will add mouse drag support some time */`。
- 输入路径：屏幕坐标 → 网格坐标（tilesize 换算）→ `grid_nearest_edge()` 最近边命中 → 按钮循环：
  - LEFT：`LINE_UNKNOWN → LINE_YES`；`LINE_YES → LINE_UNKNOWN`；`LINE_NO → LINE_UNKNOWN`（stylus 模式 YES 可直转 NO）。
  - MIDDLE：→ `LINE_UNKNOWN`。
  - RIGHT：`LINE_UNKNOWN → LINE_NO`；`LINE_NO → LINE_UNKNOWN`；`LINE_YES → LINE_UNKNOWN`。
- 每次点击产生一个 move 字符（`y` / `n` / `u`），`execute_move()` 应用；每次操作一次 undo。
- 无拖动、无 Pointer capture、无触摸板/移动端适配（`STYLUS_SUPPORT` 只是笔点击）。

**Linebook 决策：**

可以继承的概念：
- line / undecided / excluded 的状态语义。
- 左右键作为**桌面参考方案**（P4B 输入方案 A）。
- 单次操作的确定性（每次输入产生确定的状态转移）。

不能直接继承：
- 点击限定输入（P4B 必须支持连续拖动）。
- 旧桌面鼠标假设（缺少现代 Pointer Events、pointer capture、触摸板与移动触摸适配）。
- P4B 必须重新实现现代输入层（见 `docs/digital-loop-edge-input-spike.md` 第 7、8 节：Pointer Events、三态能力要求、方案 A/B/C 比较）。

## 11. Galaxies 坐标模型

成熟实现（`galaxies.c`）使用**统一 lattice 坐标**：

- 头部注释（galaxies.c:11-16）：`Grid is stored as size (2n-1), holding edges as well as spaces (and thus vertices too, at edge intersections). Any dot will thus be positioned at one of our grid points, which saves any faffing with half-of-a-square stuff.`——棋盘格存储为 **(2n-1)×(2n-1)** 的 space 数组：tile 中心、边中点、顶点、dot 都落在同一网格点上；`SPACE(s,x,y)` 宏统一访问；`F_DOT` / `F_TILE_ASSOC` / `F_EDGE_SET` 等 flags 区分实体。
- 中心点位置由此天然覆盖三种情况：格内、边上、顶点上（全部是 grid point，无需半格）。
- 输入坐标换算：`px = 2*FROMCOORD(x) + 0.5`（屏幕 → space 坐标）。
- 输入同样点击限定：放点（`D` / `d`，按 dot 位置）或画边模式（`edge_placement_legal()` 检查边不穿过 dot）。

**与 Loopy 坐标模型比较（A vs B）：**

| 方案 | 描述 | 适合 P4B | 有利于对称分区 |
| --- | --- | --- | --- |
| A. Loopy 风格 `{ orientation, row, col }` + `h:r:c` / `v:r:c` key | 显式区分横边/竖边，直接表达「边」 | 是：数字环线的核心实体就是边，方向语义直接 | 中：对称分区需要同时表达 tile 归属与边状态，纯边模型需额外派生 |
| B. Galaxies 风格 (2n-1) 统一 lattice | 点/边/格同一坐标系，dot 必然落在 grid point | 中：边身份需换算，数字环线不关心格内点 | 高：中心点（格内/边上/顶点）天然表达，无半格 |

**Linebook 决策：** P4B 采用方案 A（Loopy 风格 orientation + row + col），因为数字环线的核心实体是边且方向语义直接、与现有 P4A 合同一致。未来对称分区若需要统一 lattice，可通过**适配器**在 Geometry API 层转换（edge key ↔ space 坐标），不需要在 P4B 冻结统一坐标表示。**不得仅为了未来玩法过度设计 P4B**——本轮不冻结 Galaxies 风格坐标。

## 12. Galaxies 完成判定

成熟实现（`galaxies.c` 3095-3160 行附近）以**边状态**而非格归属做完成检查：

1. 遍历格，按 `F_EDGE_SET` 边状态用 `dsf_merge` 划分**连通分量**。
2. 对每个分量计算 bounding box 与对称中心 `cx = minx + maxx + 1`。
3. 分量有效需**同时满足**：
   - 180° 旋转对称（对称中心两侧格归属一致）；
   - 对称中心处有 dot（`SPACE(cx, cy)` 有 `F_DOT`）；
   - 分量内（含边界）没有其他 dot（中心点唯一）；
   - 分量内没有内部边（分隔同分量两格的边不能存在）；
   - 所有格被完整划分（遍历覆盖）。
4. `state->completed` 标记整体完成；难度名称含 `Impossible` / `Ambiguous` / `Unfinished`（galaxies.c:143）。

**Linebook 决策：** 这些规则属于**未来对称分区 Validator**（中心点、区域连通、180° 旋转对称、所有格完整分配、区域有效），**不得进入当前数字环线 Validator**（见 `docs/digital-loop-edge-input-spike.md` 第 14 节分层：未来对称分区专属层 = connected-region validator、180° rotational symmetry validator、one-centre-dot validator）。

## 13. 两玩法可复用与不可复用部分

**可复用（通用边缘输入底座）：**

- board geometry（格子/边/顶点坐标与 key）
- edge identity（稳定边身份）
- edge rendering（边渲染几何）
- edge hit testing（像素 → 边命中）
- pointer gesture（手势状态机）
- undo transaction（一次手势一次撤销）
- dev-only prototype shell（原型外壳）

**不可直接复用（各玩法专属）：**

- completion validator（Loopy 单环+数字 vs Galaxies 区域对称）
- clue model（数字线索 vs 中心点）
- solver / generator / difficulty model（两玩法独立）
- level schema 的规则字段（两玩法独立）

## 14. 上游概念到 Linebook 模块映射

| Linebook 模块 | 上游对应 | 职责 |
| --- | --- | --- |
| 通用 Edge Board 层 | `grid.c` / `grid.h`（grid_dot / grid_edge / grid_face / grid） | Cell/Vertex/Edge 坐标、稳定 Edge key、Edge adjacency、board geometry、pixel-to-edge hit testing、edge-to-pixel 渲染几何、board bounds、序列化边界；纯函数优先、不依赖 React/DOM id/任何玩法线索；square grid 先行 |
| 通用 Edge Input 层 | 上游 `interpret_move`（改写） | Pointer Events、pointerdown/move/up/cancel、pointer capture、gesture mode、same-edge 去重、hit corridor、vertex dead zone、一手势一 undo、移动端滚动抑制、取消回滚；不内置任何玩法完成规则；输出规范 edge operation |
| 数字环线 Domain 层 | `loopy.c` game_state + 判定逻辑 | undecided/line/excluded、数字线索、clue edge count、vertex degree、branch、open chain、closed single loop、multiple loops、invalid reference、联合完成规则；纯函数 |
| 数字环线 Solver 层（后续） | `solver_state` / `solve_game_rec` / `SOLVERLIST` | 输入谜题、当前推导、求解结果、歧义、达到的难度、可选推理轨迹；P4B 不实现 |
| 数字环线 Generator 层（后续） | `generate_loop` / `add_full_clues` / `remove_clues` / `game_has_unique_soln` | 已解环生成、线索推导与移除、唯一解验证、难度分类、确定性种子、生成预算、失败原因；P4B 不实现 |
| 对称分区 Domain 层（未来） | `galaxies.c` 完成判定 | centre dots、区域连通、180° 旋转对称、所有格完整分配、区域有效；**不实现** |

上游 midend 概念（`devel.but`：front end / middle end / back end 三层分离；undoable action = 追加 move 到 undo chain；game_params / game_state / game_drawstate / game_ui 四结构）对应 Linebook 的 session/undo 边界：`docs/digital-loop-edge-input-spike.md` 已定义「一次手势 = 一个 undo step」与 session 生命周期（P3B 接缝），本轮不再扩大。

## 15. 保留 / 改写 / 不采用矩阵

| 类别 | 条目 | 处理 |
| --- | --- | --- |
| 保留概念 | 三态 edge（LINE_YES / LINE_UNKNOWN / LINE_NO） | 保留，映射 line / undecided / excluded |
| 保留概念 | 顶点与边图（vertex degree、连通分量） | 保留（第一层结构判定基础） |
| 保留概念 | 数字线索（face 周边边数） | 保留（第二层线索判定基础） |
| 保留概念 | 单环判定（exactly_one_loop） | 保留（联合完成条件） |
| 保留概念 | Solver 状态（SOLVED / MISTAKE / AMBIGUOUS / INCOMPLETE） | 保留为后续 Solver 合同状态 |
| 保留概念 | 唯一解意识（game_has_unique_soln） | 保留为 Generator/难度核心约束 |
| 保留概念 | 难度分层（EASY / NORMAL / TRICKY / HARD + 推理集合模型） | 保留为参考，不照搬名称 |
| 保留概念 | Generator 与 Solver 协作（生成→验证→删线索→难度校准） | 保留为后续路线 |
| 保留概念 | 后端与前端分离（devel.but 三层） | 保留为模块边界参考 |
| 改写 | C 数据结构 → JavaScript 纯函数模块 | 改写（Edge Board / Domain 层） |
| 改写 | 桌面鼠标点击 → Pointer Events | 改写（P4B 现代输入层） |
| 改写 | 单击输入 → 连续拖动 | 改写（P4B 核心能力） |
| 改写 | 上游原生前端 → React 开发原型 | 改写（DEV-only 原型外壳） |
| 改写 | 上游 game description（RLE）→ Linebook level schema | 改写（后续合同） |
| 改写 | 上游 undo/midend → Linebook session transaction | 改写（已由 P3B/P4A 合同定义） |
| 改写 | 上游视觉 → Linebook 统一产品语言 | 改写（界环谜阵局部符号语言） |
| 不采用 | 多种非方格网格 | 不采用（P4 第一阶段 square grid 先行） |
| 不采用 | 旧桌面 GUI | 不采用 |
| 不采用 | 点击限定输入 | 不采用（P4B 重写） |
| 不采用 | 上游视觉资源 | 不采用 |
| 不采用 | 上游菜单系统 | 不采用 |
| 不采用 | 上游存档格式 | 不采用（Linebook 存档合同另行定义） |
| 不采用 | 直接编译或嵌入 C/WASM | 不采用（JavaScript 纯函数重写） |
| 不采用 | 直接复制 Generator 或 Solver 代码 | 不采用（参考概念，独立实现；如移植算法须遵守 MIT） |
| 不采用 | 同时实现 Galaxies | 不采用（对称分区不进入 P4B） |

## 16. P4B 实施边界

P4B 范围的**唯一规范性来源**是 [`docs/digital-loop-edge-input-spike.md`](./digital-loop-edge-input-spike.md)（第 3 节非目标、第 13 节实现边界、第 14 节分层）。本文档不独立维护 P4B「必须实现 / 不实现」清单，也不通过本文档扩张 P4B；以下仅为上游经验如何支持当前决策的摘要。

- P4B 仍是数字环线 Edge/Input 技术 Spike：三态边、Pointer Events、连续拖动、一手势一次 undo、单环结构判定、最小数字线索判定与联合完成判定，均与上游成熟状态模型一致（第 4–7、10 节）。
- 完整 Solver、Generator、难度体系与正式关卡在上游本就是独立管线（第 7–9 节），Linebook 同样将其留在 P4B 之后的独立工程包。
- 对称分区（Galaxies）的规则与判定属于未来同家族玩法的专属层（第 11–13 节），不进入 P4B。

**晋升原则（非规范性说明）：** P4B 应遵守原型隔离合同、避免污染正式 runtime，并保留合理的模块边界与可测试性（避免一次性 Demo 式写法）；是否晋升、哪些代码晋升与生产质量门槛由 P4C 和后续独立工程包裁决（规范性规则见 [`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md) 晋升合同）。

## 17. 后续 Solver / Generator 路线

以下为后续工程包的**参考基线（建议起点；不排期、不承诺本轮实施）**，供各工程包独立立项与评审时使用；最终实现的正式合同以未来对应工程包为准，本文档不提前冻结：

1. **Solver 合同**：状态四态（solved / mistake / ambiguous / incomplete）；难度分层参考上游「推理集合」模型；deduction 优先、必要时递归试探；输入谜题 → 当前推导 → 结果 + 歧义 + 难度 + 可选推理轨迹。
2. **Uniqueness validator**：等价上游 `game_has_unique_soln`（solver 判定唯一解）。
3. **Difficulty classifier**：按可用推理级别分类，参考 EASY / NORMAL / TRICKY / HARD。
4. **Generator**：等价上游管线——初始环生成（loopgen 概念）→ 全线索 → 唯一解验证 → 逐步删线索 → 难度校准 → 确定性种子 → 序列化。
5. **Stable level schema**：Linebook 格式，替代上游 game description（RLE）。
6. 顺序遵循 ROADMAP：完整数字环线原型 → Solver → Validator → 5–10 关原型 → 教学与人工试玩 → 再独立评估对称分区。

## 18. 许可证与归属要求

- 上游为 MIT（第 3 节）。
- 本轮未复制代码，不新增第三方源码或许可证文件。
- 未来若复制或移植实质性代码（任何超过琐碎量的算法实现）：必须保留上游版权与 MIT 许可声明、记录来源文件与上游 commit SHA、在本参考文档登记。算法**概念**（三态、唯一解检查、删线索生成）不受版权限制，可以直接参考实现；**表达式**（具体 C 代码）移植必须遵守许可要求。
- 涉及贡献者版权：Simon Tatham 及 Richard Boulton、James Harvey、Mike Pinna 等人（`LICENCE` 头部完整名单）。

## 参考

- [`docs/digital-loop-edge-input-spike.md`](./digital-loop-edge-input-spike.md) —— P4B 唯一规范性合同（本文档仅为其工程参考）
- [`docs/game-family-design-system.md`](./game-family-design-system.md) —— 家族规范（界环谜阵定位、P3B 状态）
- [`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md) —— 原型隔离与晋升合同
- [`ROADMAP.md`](../ROADMAP.md) —— 路线（P4A/P4B/P4C）
- 上游官方源码：`git.tartarus.org/simon/puzzles.git` @ `3c3632259d298ab62aafa8a5858823569ab1af46`（`loopy.c`、`galaxies.c`、`grid.c` / `grid.h`、`loopgen.c` / `loopgen.h`、`devel.but`、`LICENCE`）
- 上游官方文档：<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/>、<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/devel/>
