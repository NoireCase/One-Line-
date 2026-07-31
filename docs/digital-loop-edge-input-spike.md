# 数字环线边线输入 Spike 合同

> 本文档是 P4A 的正式交付物，冻结数字环线边线输入 Spike（P4B）的可执行设计与工程合同。它不是玩法设计文档，不定义完整数字环线规则；它是「在写任何原型代码之前先达成一致」的工程合同。
>
> 通用原型隔离规则见 [`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md)，本文档是该合同的第一个应用实例。
>
> **产品定位**：数字环线属于**已确定的第三家族「界环谜阵」**（第一卷线序谜阵、第二卷星线谜阵、第三卷界环谜阵、第四卷 Coming Soon），是界环谜阵的**旗舰与第一优先玩法**；产品家族已确定，工程 familyId / modeId 尚未注册。玩法基线是 Loopy / Slitherlink-like；对称分区（Galaxies / Tentai Show）是界环谜阵第二强候选玩法，不进入 P4B，但对通用边缘输入底座构成复用约束。详见第 2 节「权威玩法参考」。

## 0. 合同修订记录（P4B 桌面实测后）

本文档初始状态为 **Frozen / Ready for P4B**。以下修订是 **P4B 桌面实测后的合同修正**，不是未经记录的实现漂移：

- **2026-07-31 · 平台范围修订**：全项目改为**桌面优先政策**，手机和平板由全局门禁拦截（详见 [`platform-support-policy.md`](./platform-support-policy.md)，平台范围单一事实源）。移动端不属于 P4，不建立 `P4B-M`，不再作为 P4C GO 条件；390×844 移动视口、长按、方案 C、移动端 excluded 输入全部移出当前阶段。本文档中残留的移动端计划一律失效，不删除历史记录但不再作为当前依据。
- **2026-07-31 · line / excluded 合同修订**：原规则「line 与 excluded 互不覆盖」修订为实测结论 **「line 优先于 excluded」**（冻结矩阵见第 8 节）：line 可以覆盖 X；X 不能覆盖 line；Undo 必须恢复被覆盖前的 excluded（而非 undecided）。
- **2026-08-01 · 桌面输入映射修正（最后一次聚焦收口）**：**右键拖动连续画 X 正式取消**，X 输入冻结为「右键单击 = 单个 X」与「Shift+左键点击/拖动 = 单个或连续 X」。右键按下不再立即修改 Edge（延迟提交：pointerdown 只登记 pending，移动超过点击阈值即取消，pointerup 未超阈值才提交单 Edge X transaction，一个 undo step）。原因是 secondary drag 可能被操作系统、触摸板或浏览器扩展占用，属于外部环境行为，不作为网页兼容目标。这是桌面人工验收后的输入映射修正：不影响三态模型与 line 优先规则，不属于移动端适配。

## 1. 状态与目标

| 属性 | 值 |
| --- | --- |
| Package | P4A |
| 类型 | 文档冻结 |
| 状态 | **Frozen / Ready for P4B** |
| 正式实现 | 未开始 |
| 玩家入口 | 无 |
| 产品家族 | 界环谜阵（第三卷，**已确定**） |
| 产品定位 | 界环谜阵旗舰玩法、第一优先 |
| 工程 familyId | 未注册（英文家族名未冻结） |
| 工程 modeId | 未注册 |

目标：验证**边线输入**是否值得进入完整数字环线原型开发。即用最小成本回答：在当前技术栈（React + Pointer Events + SVG/CSS 棋盘）与目标设备上，边线的命中、拖动、擦除、排除（excluded）、撤销与结构识别是否稳定可靠，并且最小数字线索校验能否证明这是「Loopy Spike」而不只是无规则画线板。P4A 不回答「数字环线何时成为正式玩法」（产品家族已确定为界环谜阵，但工程注册与上线另行决策），只回答「边线输入这条路是否走得通」。

## 2. 权威玩法参考

### 主要参考：Loopy / Slitherlink-like

参考来源：Simon Tatham 的 Portable Puzzle Collection 中的 Loopy（<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/js/loopy.html>）。

参考的正式目标规则：

- 沿网格边绘制**一条单一、连续、闭合的环**。
- **不允许分支**（任意顶点至多两条 line 边）。
- **不允许多个独立环**。
- 数字格的数字表示**该格周边属于环的边数量**。
- 完成必须**同时满足单环结构与全部数字线索**。

参考的成熟边状态：`undecided`（尚未决定）、`line`（属于环）、`excluded`（明确不属于环）。

说明：

- One-Line **不复制其视觉表现**（正式美术与视觉语言另行设计，本轮不冻结）。
- One-Line **不直接复制其桌面控制方式**（右键排除等桌面约定在移动端不成立；P4 为桌面限定阶段，移动端输入按平台政策整体暂缓，见第 0 节）。
- One-Line **以其成熟规则作为 P4 数字环线的玩法基线**。
- **Mac 触摸板与桌面触摸屏输入需要重新设计并实测**（见第 6、7 节，桌面双通道输入方案见第 7 节；移动端不在当前阶段）。

### 对称分区：Galaxies / Tentai Show（界环谜阵第二强候选玩法）

参考来源：Simon Tatham 的 Portable Puzzle Collection 中的 Galaxies（<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/js/galaxies.html>）。

**产品定位：** Galaxies / Tentai Show 对应界环谜阵的第二个玩法「对称分区」（推荐中文玩法名；备选「银河分区」「镜像分区」，为避免与 Star Line 星系语义重复，当前优先「对称分区」）。它是**同一家族的第二个强候选玩法**，排在数字环线之后，不是纯粹的外部技术案例。

规则内容：

- 沿格子边划分连通区域。
- 每个区域具有 180° 旋转对称。
- 每个区域恰好包含一个位于对称中心的点。

定位明确：

- **对称分区不是数字环线**，不使用单环和数字边数规则。
- **不进入本次 P4B 实现范围**；后续需单独开展规则、Solver、Validator 与原型评估。
- 它不是已经实现的玩法，也不是已经正式立项的生产包；但它是**已明确保留的产品方向**。
- 对当前 P4B 的作用是**约束通用边缘输入底座不得硬编码 Loopy 规则**（输入层与规则层解耦的理由）：未来对称分区需要复用 Edge Model、边界 hit testing、Pointer input、手势撤销，并将区域对称 validator 与 Loopy 的单环/数字 validator 独立替换。
- 不需要在 P4B 实际实现对称分区来证明复用性。

## 3. 明确非目标

本阶段（P4A + P4B）不包含：

- 完整数字环线玩法
- 5～10 关正式原型
- 完整 solver
- 自动出题
- 正式教学
- 正式美术
- 正式 family
- 正式 mode
- 存档
- 进度
- 奖励
- 金币
- 解锁
- 下一关
- 重玩
- 玩家目录入口
- package 升级
- Release
- **对称分区（Galaxies / Tentai Show）的任何实现**（包括其区域划分、180° 旋转对称与中心点规则）

以上全部属于 P4C GO 之后的后续工程包（另行立项，见 [`ROADMAP.md`](../ROADMAP.md) P4 段与 P6 候选方向），本轮一律不实现、不占位、不预留半成品。完整 Solver 与 Generator 的长期路线参考见 [`docs/edge-puzzle-upstream-reference.md`](./edge-puzzle-upstream-reference.md) 第 17 节（非规范性），不属于 P4B。

## 4. 术语

中文术语在本项目统一使用（Star Line 正式文案术语「星点」不受影响）：

| 英文 | 中文 | 定义 |
| --- | --- | --- |
| Cell | 格 | 棋盘上单个方格区域，由四条边围成 |
| Vertex | 顶点 | 边的端点，四条（棋盘内部）或两条/三条（边界处）边的交点 |
| Horizontal Edge | 横边 | 水平方向的边，位于相邻两格之间或棋盘外边界 |
| Vertical Edge | 竖边 | 垂直方向的边，位于相邻两格之间或棋盘外边界 |
| Edge Segment | 边段 | 一条横边或竖边作为一个最小可操作单元 |
| Edge State | 边状态 | 单条边当前的状态（undecided / line / excluded） |
| Undecided | 未决定 | 尚未作出判断的默认状态 |
| Line | 线 | 玩家认为属于最终闭环的边 |
| Excluded | 排除 | 玩家明确认为不属于闭环的边（视觉表现未冻结） |
| Loop | 环 | 由 line 边构成的一条闭合回路 |
| Open Chain | 断链 | 由 line 边构成但未闭合的开放路径 |
| Branch | 分支 | 一个顶点处超过两条 line 边相交 |
| Multiple Loops | 多环 | 同一棋盘上存在两个或以上相互独立的环 |
| Clue | 数字线索 | 格内数字，表示该格周边属于环的边数量 |
| Symmetric Partition | 对称分区 | 界环谜阵第二候选玩法（对应 Galaxies / Tentai Show）：沿格子边划分连通区域，每区域 180° 旋转对称且含一个中心点；不进入 P4B，仅约束通用输入层可复用性 |
| Gesture | 手势 | 一次 pointerdown 到 pointerup/pointercancel 的完整输入过程 |
| Hit Corridor | 命中走廊 | 一条边实际响应点击/拖动命中的空间区域 |
| Dead Zone | 死区 | 顶点附近不归属任何边的区域（用于避免交汇处误选） |
| Session | 会话 | 一次进入原型棋盘到退出的完整交互期 |

## 5. 坐标模型

冻结边线的规范化数据表示（**不得依赖 DOM 元素 id 作为正式数据身份**）：

```
{ orientation: 'horizontal' | 'vertical', row, col }
```

稳定字符串 key：`h:<row>:<col>` / `v:<row>:<col>`。

明确约定：

- **行列从 0 开始**（与现有 `src/data/` 正式关卡的行列约定一致）。
- **坐标含义（棋盘为 N×N 格，即 N 个 cell/边）：**
  - horizontal edge 的 `row` ∈ [0, N]，`col` ∈ [0, N-1]：位于第 `row` 行的格间水平分隔线（`row` = 0 为上边界，`row` = N 为下边界）。
  - vertical edge 的 `row` ∈ [0, N-1]，`col` ∈ [0, N]：位于第 `col` 列的格间垂直分隔线（`col` = 0 为左边界，`col` = N 为右边界）。
- **10×10、11×11 指 cell 数**（即 10×10 棋盘有 11×10 横边 + 10×11 竖边 = 220 条边；11×11 棋盘有 264 条边）。
- **一条 horizontal edge `(h, r, c)` 的两个端点为 vertex `(r, c)` 和 vertex `(r, c+1)`。**
- **一条 vertical edge `(v, r, c)` 的两个端点为 vertex `(r, c)` 和 vertex `(r+1, c)`。**
- **一个 vertex `(r, c)` 的相邻边**（棋盘内部顶点）为：`h:(r, c-1)`、`h:(r, c)`、`v:(r-1, c)`、`v:(r, c)` 四条；棋盘边界顶点按几何位置减少。
- **edge 相等**：orientation、row、col 三者完全相等。
- **key 生成**：`h:<row>:<col>` / `v:<row>:<col>`，是全项目唯一的稳定身份，可作 Map key、存储 key 与测试断言。
- **序列化**：边集合序列化为 key 字符串数组；解析器必须拒绝非法组合（越界 row/col、非法 orientation），非法输入产出明确错误而非静默纠正。
- **重复 edge**：数据表示中**不允许重复**（同一条边只存在一个状态）；去重发生在装配层，不依赖渲染层。
- **视觉方向与数据方向**：不区分。横边就是 horizontal、竖边就是 vertical；渲染旋转不影响身份。

## 6. 最小 Edge State（三态）

冻结三态 Edge State。经核查，现有正式文档（`docs/game-family-design-system.md`、`docs/portal-mode-level-spec.md`、`docs/hidden-mode-spec.md` 等）**未定义**数字环线的 edge state 集合，因此本合同的冻结依据是「Loopy 成熟规则 + P4B 验证需要」，不声称来自任何已验收的 One-Line 规则。

| 状态 | 规范数据名 | 语义 | 视觉表达 |
| --- | --- | --- | --- |
| 未决定 | `undecided` | 尚未作出判断 | 基础网格边或中性状态 |
| 线 | `line` | 玩家认为属于最终闭环 | 已画边线，参与结构与线索判定 |
| 排除 | `excluded` | 玩家明确认为不属于闭环 | 叉号、淡化、断开或其他表达——**最终视觉表现尚未冻结** |

合同：

- **数据语义与视觉表现分离**：状态是数据（undecided / line / excluded），视觉是渲染选择。`excluded` 是否显示为 X 或其它形式，由 P4B 体验测试决定，不提前绑定视觉资源。
- **禁止含糊语义**：禁止用 `empty` 同时表示「未决定」和「明确排除」；禁止用 `blocked`（易与障碍物混淆）；禁止用 `cross` 直接绑定某一种视觉资源。
- 推荐规范数据名即上表：`undecided` / `line` / `excluded`。
- P4B 必须实现三态之间的切换能力（见第 7、8 节）。

## 7. Pointer 输入合同

桌面鼠标、触摸板、触摸屏统一使用 **Pointer Events**（本项目 `usePathInteraction`、`useStarLineInputController` 已验证该路线）。

必须定义并实现的事件流：

| 事件 | 处理 |
| --- | --- |
| `pointerdown` | 命中判定；决定手势模式（见第 8 节）；`setPointerCapture(pointerId)`（参照 `useStarLineInputController.js`） |
| `pointermove` | 命中判定 + 状态切换（见第 8 节） |
| `pointerup` | 提交手势：批量合并为一次撤销步；释放 capture |
| `pointercancel` | 丢弃本次手势全部未提交变更；不产生撤销步；恢复可交互状态 |
| pointer capture | pointerdown 时捕获，防止移出棋盘丢失事件 |
| 点击与拖动判定 | 以「pointerdown 到 pointerup 期间是否产生有效命中」区分；点击 = 单条边命中，拖动 = 多条边命中；两者同为一次手势 |
| 同一手势重复经过同一 edge | 只处理一次（见第 8 节「每个 edge 同一手势只处理一次」） |
| 手势离开棋盘 | 不中断；保持 capture，回入棋盘继续生效；位置超出棋盘时按「无命中」处理，不产生副作用 |
| 页面滚动与手势冲突 | 棋盘根元素 `touch-action: none`（仅原型棋盘容器，不扩散全局）；原型的 app-shell 无页面级纵向滚动（与正式 `app-shell` 一致） |
| 多指触摸 | 仅首指有效；第二指 `pointerdown` 被忽略并标记手势结束边界；禁止多指同时画线 |
| 浏览器取消 | 统一走 `pointercancel` 路径 |
| 窗口失焦 | 等效 `pointercancel`：丢弃未提交手势 |
| 撤销单位 | 一次手势 = 一个 undo step（见下方核心合同） |

**核心合同（不可妥协）：**

1. **一个手势只能形成一个 undo step** —— 参照现有 Star Line 撤销批处理模式（`useStarLineInteraction.js` 的 `pendingBatchRef` / `commitBatch`）：手势期间的变更累积为一批，`pointerup` 时一次入栈。
2. **同一 edge 在同一手势内最多被修改一次** —— 首次命中时按模式决定结果，之后该手势再次经过该 edge 不改变其结果，也不产生新变更记录。
3. **手势取消不得留下半提交历史** —— `pointercancel` / 失焦时，本批变更整体回滚（渲染层同步还原），撤销栈不出现任何残留。
4. **不允许由 render 顺序决定输入结果** —— 命中与状态变更基于数据坐标（第 5 节），不基于 DOM 树遍历顺序或 z-index 顺序。
5. **不允许通过逐个 DOM click 模拟连续拖动** —— 拖动必须是连续 pointermove 流；禁止合成离散 click 序列。

**三态能力要求（冻结）：**

1. 必须能够连续绘制 `line`。
2. 必须能够连续擦除 `line` 回 `undecided`。
3. 必须能够标记 `excluded`。
4. 必须能够取消 `excluded` 回 `undecided`。
5. 同一手势内同一 edge 最多改变一次。
6. 一次手势仍只产生一个 undo step。
7. `line` 手势不得意外写入 `excluded`。
8. `excluded` 手势不得意外写入 `line`。
9. 不允许在一次拖动中因经过不同状态自动切换工具语义。

**P4A 输入方案比较（历史记录，P4B 桌面实测后已收敛）：**

| 方案 | 描述 | P4B 实测结论 |
| --- | --- | --- |
| A. 桌面参考方案 | 左键拖动 = `line`；右键 = `excluded`（类 Loopy 桌面约定） | **收敛为桌面扩展**：左键 line（点击/拖动）；**右键单击**单个 X；**Shift+左键点击/拖动**连续 X（右键拖动已正式取消，见第 0 节修订记录） |
| B. 统一工具方案 | 当前工具为 `line` / `excluded` / `erase`；点击和拖动按当前工具执行 | **未采用**：独立 Erase 工具已取消；工具切换打断笔划流 |
| C. 移动端手势方案 | 点击或拖动 = `line`；长按、双击或工具按钮 = `excluded` | **按平台政策整体暂缓**（移动端不属于 P4，不建立 `P4B-M`；主界面已删除，方案 C 不运行、不验收） |

P4B 基于鼠标、Mac 触摸板、10×10 与 11×11 棋盘完成桌面实际选择；最终桌面输入方案 = 实测结果 + 人工试玩记录（详见 `src/prototypes/digitalLoop/PROTOTYPE.md`「桌面输入最终收敛」）。

## 8. 拖动模式

冻结**推荐方案：「起始 edge 决定手势模式」**（三态化）：

- 从 `undecided` edge 开始手势 → 进入**添加模式**：后续经过的 `undecided` 边变为 `line`。
- 从 `line` edge 开始手势 → 进入**擦除模式**：后续经过的 `line` 边变为 `undecided`。
- 手势期间**不因经过其他状态自动切换模式**；擦除模式经过 `undecided` 或 `excluded` 边时不新增线也不修改它们。
- 每个 edge 同一手势只处理一次（第 7 节核心合同 2）。
- 起始点在死区（顶点附近）或未命中任何边时，手势不启动，不产生任何变更。
- **`excluded` 的标记与取消不通过拖动自动产生**：它属于独立输入通道（右键单击 或 Shift+左键点击/拖动），由 P4B 桌面实测确定；`excluded` 边作为手势起点的行为（进入/擦除该边）属 P4B 实测结果，冻结如下。

**line / excluded 合同（P4B 桌面实测后冻结，修订自 P4A 的「互不覆盖」）：**

| 当前 Edge | 左键 line | 右键单击或 Shift+左键 X |
| --- | --- | --- |
| undecided | line | excluded |
| line | undecided | 保持 line |
| excluded | line | undecided |

- **line 可以覆盖 X**：左键可从 `undecided` 或 `excluded` 起手直接覆盖为 `line`（paint-line）；添加模式经过 `excluded` 边时同样覆盖为 `line`。
- **X 不能覆盖 line**：X 通道命中 `line` 不产生变化（从 `line` 起手的 X 手势不启动）。
- **Undo 必须恢复被覆盖前的 `excluded`**（而非 `undecided`）：撤销恢复手势前的真实状态。
- **右键仅支持单击**：pointerdown 只登记 pending（不修改 Edge），移动超过点击阈值即取消，pointerup 未超阈值才提交单 Edge X transaction（一个 undo step）；右键拖动不产生任何 Edge transaction、不残留起点 X、不入 Undo 栈（原因见第 0 节修订记录）。
- 该合同是 P4B 桌面实测后的**合同修正**（见第 0 节修订记录），不是未经记录的实现漂移。

**被否决的替代方案：**

1. **先选择工具（画笔/橡皮）再拖动** —— 作为默认主交互会中断拖动手势流，且撤销语义需要记住工具状态；但作为方案 B 的 excluded 专用通道仍列入 P4B 比较。
2. **随状态即时切换（经过 line 就擦、经过 undecided 就画）** —— 回退经过自身已画线时会立即擦掉，方向性拖动不可预测，撤销批处理复杂。
3. **统一「拖动经过即取反」** —— 一次手势内重复经过同一 edge 无法满足「最多修改一次」合同，且回退抖动无法消除。

**为什么推荐方案更利于稳定拖动和撤销：** 手势模式由起点一次性决定，整个手势期间行为恒定；同一边只处理一次使「画 → 回退重画」变为天然幂等，撤销批恰好等于手势批，不需要模式回滚逻辑。

**P4B 必须验证的风险：** 起点误命中（意图画线却落在已有线上导致擦除，反之亦然）；起点在死区边界时的手势启动稳定性；擦除模式下经过顶点拐弯的连续性；`excluded` 通道（方案 A/B/C）与拖动手势互不干扰、不误触。

## 9. 命中区域

区分三个概念：

| 概念 | 定义 |
| --- | --- |
| 可见线宽 | 渲染层画出的边线视觉宽度（P4A 不冻结像素值） |
| 实际 hit corridor | 判定命中的空间区域，宽度通常大于可见线宽，由棋盘尺寸决定 |
| vertex dead zone | 顶点附近的圆形/方形无主区域，任何边都不响应，避免交汇处误触 |

- **不无依据照搬 44px 按钮热区到每条边**：边是细长目标，其命中走廊必须基于棋盘实际尺寸、cell 间距、相邻边冲突和人工测试结果（P4B 实测）决定。
- 相邻边冲突区域（横边与竖边在顶点交汇处、平行相邻边之间的空隙）必须显式定义归属规则，P4B 验证无歧义。
- **`excluded` 的视觉表达（如叉号）不得缩小或扩大 hit corridor**：命中区域只由几何决定，不随状态变化（P4B 验证）。

**P4B 需要验证的命中场景：**

| 场景 | 验证内容 |
| --- | --- |
| 鼠标命中 | 桌面精确点击、跨边拖动 |
| Mac 触摸板拖动 | 拖动连续性、轨迹稳定（secondary drag 不作为正式输入；双指点按标记单个 X，连续标记用 Shift+左键拖动） |
| 横边与竖边交汇处 | 死区有效性、交汇处归属无歧义 |
| 棋盘边缘 | 外边界边（row/col 边界值）可命中 |
| 密集 10×10 | 220 条边下的冲突与误选 |
| 密集 11×11 | 264 条边下的冲突与误选 |
| 桌面窄窗口 390×844 | 缩窄窗口后的 hit corridor 有效性（桌面浏览器，非移动设备；移动触摸按平台政策整体暂缓） |
| 1440×900 桌面视口 | 常规桌面尺寸下的手感 |

**P4A 冻结测量方法与验收方式（不伪造像素值）：**

- 命中走廊宽度、死区半径必须由 P4B 在目标视口实测后记录（含棋盘 CSS 尺寸、cell 像素边长、边像素宽度、走廊/死区像素值）。
- 验收 = 人工试玩记录（命中成功率、误触次数）+ 原型聚焦测试断言（每个诊断场景的预期命中序列）。
- 任何像素数值在本轮均标记为「P4B 待测」，不写成已达标结论。

## 10. 规则判定（两层）

P4B 的规则判定拆为两层。**两层都不要求完整求解**：第一层如实报告结构，第二层如实报告线索状态。

### 第一层：通用边图结构诊断

输入为 `line` 边的集合（edge key 数组），输出为结构分类：

| 结构 | 定义（判定依据） |
| --- | --- |
| Empty | `line` 边集合为空 |
| Open Chain | 存在连通分量，所有顶点 degree ≤ 2，且至少一个端点度数为 1（未闭合） |
| Closed Single Loop | 恰好一个连通分量，所有顶点 degree = 2，边数 ≥ 4，整体闭合，且边集合非空 |
| Branch | 至少一个顶点 degree ≥ 3 |
| Multiple Loops | 存在两个或以上各自闭合、互不连通的连通分量 |
| Invalid Edge Reference | 输入包含非法坐标（越界、非法 orientation）、重复边或格式错误 key |

判定至少基于：

- vertex degree（每个顶点关联的 `line` 边数）。
- connected components（按顶点相邻关系划分连通分量）。
- edge count。
- 闭合性（分量内全部顶点 degree = 2 且边数 ≥ 4）。

**第一层只统计 `line` 边**：`undecided`、`excluded` 不参与结构判定（`excluded` 是推理辅助标记，不是结构输入）。

### 第二层：Loopy 线索判定

每个数字格统计其周边（四边）`line` 数量：

| 状态 | 含义 |
| --- | --- |
| 少于数字 | 未完成或仍可继续（不判定为错误） |
| 等于数字 | 该线索当前满足 |
| 大于数字 | 冲突 |
| 所有数字满足 且 结构为 Closed Single Loop | **完成** |

**完成必须由单环结构与全部数字线索联合决定**——只有单环但数字未满足，或所有数字满足但存在两个环，都不得完成。

明确：

- P4B 的主要目标仍是**输入稳定性**。
- P4B **至少应实现最小数字线索校验**，才能证明它确实是 Loopy Spike，而不只是无规则画线板。
- 不要求完整 solver、不要求自动生成器、不要求正式关卡难度体系。

**必须区分：**

- 第一层结构有效（Empty / Open Chain / Closed Single Loop / 多环/分支的如实报告）。
- 第二层线索满足（数字环线规则的解正确性）。
- 「分支/多环是错误还是允许」由 Loopy 基线（第 2 节）决定：**非法**。但 P4B 的第一层只如实报告结构，第二层才输出「未完成/满足/冲突」状态；「单环 + 全部数字满足」是唯一完成条件。

## 11. 诊断棋盘

冻结以下最小诊断场景（**诊断数据，不是正式关卡**，存放于原型 `data/` 目录）。

**结构诊断场景（保留）：**

| # | 场景 | 覆盖 |
| --- | --- | --- |
| 1 | 单边点击与撤销 | pointerdown→up 单边；一次手势一个 undo；连续点击产生连续独立 undo |
| 2 | 连续直线拖动 | 一行/一列连续多边；模式恒定；同边不重复处理 |
| 3 | 直角转弯拖动 | 横边→竖边拐弯；死区通过；拐角顶点不产生误选 |
| 4 | 创建分支 | 中心顶点第三条 line 边；第一层判定报告 Branch |
| 5 | 创建两个独立环或断链 | 双环 / 环+链；第一层判定报告 Multiple Loops / Open Chain |

**最小 Loopy 规则场景（新增，冻结 P4B 必须覆盖的类型）：**

| # | 场景 | 覆盖 |
| --- | --- | --- |
| 6 | 无数字的单环结构场景 | 无数字时仅凭 Closed Single Loop 成立结构；无数字时无完成判定 |
| 7 | 一个数字 0 的排除状态场景 | 数字 0 周边全部边应标记 `excluded`；验证 excluded 标记与取消、数字 0 满足判定 |
| 8 | 一个数字 1 或 2 的局部线索场景 | 单格线索局部计数；少于/等于/大于三种线索状态 |
| 9 | 数字周边 line 数量超限冲突 | 第四边画入使线索 > 数字；第二层输出「冲突」 |
| 10 | 所有数字满足但存在两个环，仍不得完成 | 第二层全满足但第一层 Multiple Loops → 未完成 |
| 11 | 单环成立但某个数字未满足，仍不得完成 | 第一层 Closed Single Loop 但第二层线索未满足 → 未完成 |

压力与视口场景：

- 一个 10×10 压力棋盘（诊断数据：在密集区域构造大量短边与拐弯）。
- 一个 11×11 压力棋盘（同上，覆盖最大边数 264）。
- 一个 390×844 **桌面窄窗口**命中场景（桌面浏览器缩窄窗口；移动设备按平台政策整体暂缓，见第 0 节）。

P4A 不在本文档编写具体完整谜题数据，但以上 11 类场景类型由 P4B 逐一实现为诊断数据。

## 12. 性能与交互验收

P4B 验收表（**可测量；未实测数字一律标记 P4B 待测并给出测量方法，不写成已达标**）：

| # | 验收项 | 判定方式 | 当前状态 |
| --- | --- | --- | --- |
| 1 | pointermove 高频输入下无明显掉帧 | 拖动期间人工观察 + 可选 rAF/帧率采样；阈值待测 | P4B 待测 |
| 2 | 一次手势只产生一次 undo | 诊断场景断言 | 合同已冻结 |
| 3 | 不发生相邻 edge 批量误选 | 诊断场景命中断言 + 人工试玩 | P4B 待测 |
| 4 | 拖动结果可预测 | 人工试玩（鼠标/触摸板）；起点决定模式行为恒定 | P4B 待测 |
| 5 | pointercancel 可恢复 | 模拟 pointercancel 后界面与撤销栈一致 | 合同已冻结 |
| 6 | 切换视图后无残留 gesture | 卸载原型页面后无事件监听器泄漏、无未提交批 | 合同已冻结 |
| 7 | 10×10、11×11 可正常操作 | 压力棋盘人工操作 + 结构判定正确 | P4B 待测 |
| 8 | 移动端不触发页面滚动或浏览器手势冲突 | **移出当前阶段**（移动端按平台政策整体暂缓；`touch-action: none` 保持仅作用原型棋盘容器） | 已移出 |
| 9 | `line` 手势不误写 `excluded`，`excluded` 输入不误写 `line` | 三态诊断场景断言 + 人工试玩 | P4B 待测 |
| 10 | 数字线索计数与冲突提示正确 | 最小 Loopy 场景断言（场景 6–11） | 合同已冻结 |
| 11 | 完成判定 = 单环 ∧ 全部数字满足 | 场景 10、11 断言未完成；单环全满足场景断言完成 | 合同已冻结 |
| 12 | 不出现正式存档和进度写入 | 断言无任何 `cg_*` 正式 key 写入（原型 key 除外） | 合同已冻结 |
| 13 | 删除原型后正式 build 仍成立 | 删除 `src/prototypes/` 后 `npm run build` 通过 | 合同已冻结 |

## 13. P4B 实现边界

P4B 仍是数字环线 Edge/Input 技术 Spike。实现应遵守原型隔离合同、避免污染正式 runtime，并保留合理的模块边界与可测试性（避免一次性 Demo 式写法）；是否晋升、哪些代码晋升与生产质量门槛由 P4C 和后续独立工程包裁决（规范性规则见 [`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md) 晋升合同；上游工程经验为参考，见 [`docs/edge-puzzle-upstream-reference.md`](./edge-puzzle-upstream-reference.md)，非规范性）。

**允许：**

- DEV-only 入口（`import.meta.env.DEV` 或 `?playtest=1` / `?prototype=...` 双门槛）。
- 隔离原型目录（`src/prototypes/digitalLoop/`）。
- 一块边线棋盘（SVG/CSS 渲染，N=10 或 11 可切换）。
- Edge hit testing（第 9 节）。
- **三态 edge（undecided / line / excluded）**。
- 连续绘制 `line`、连续擦除回 `undecided`、标记/取消 `excluded`。
- 单手势 undo（第 7 节）。
- 第一层通用边图结构诊断（第 10 节）。
- **第二层最小数字线索校验**：数字线索显示、数字周边 line 计数、数字冲突提示、单环 + 数字线索联合完成判定。
- 3～5 个结构诊断场景 + 6 类最小 Loopy 规则场景（第 11 节）。
- 10×10、11×11 压力场景。
- 鼠标、Mac 触摸板、桌面触摸屏测试（移动端按平台政策整体暂缓）。
- 聚焦单元测试与 E2E（原型目录内测试 + `e2e/prototypes/`）。

**禁止：**

- `GAME_MODES` 正式注册。
- `GAME_FAMILIES` 玩家目录接入。
- 正式存档。
- 正式进度。
- 奖励和金币。
- 正式关卡。
- 正式教学。
- 完整 solver。
- 自动生成器。
- 难度体系。
- 正式 UI 美术。
- package 升级。
- **对称分区（Galaxies / Tentai Show）实现**（区域划分、180° 旋转对称、中心点规则）。

## 14. P4B 推荐工程边界与分层

建议目录（已核对与现有结构无冲突：`src/game/`、`src/components/`、`src/hooks/` 均为正式模块，原型独立于其外）：

```
src/prototypes/digitalLoop/
src/prototypes/digitalLoop/data/          # 诊断场景数据（纯 JSON/JS 常量）
src/prototypes/digitalLoop/components/    # 诊断 UI（棋盘渲染、状态面板、线索显示）
src/prototypes/digitalLoop/input/         # pointer 输入状态机（手势、命中）
src/prototypes/digitalLoop/graph/         # 通用边图结构诊断（第一层，纯函数）
src/prototypes/digitalLoop/loopy/         # Loopy 线索判定（第二层，纯函数）
src/prototypes/digitalLoop/tests/         # 聚焦单元测试
e2e/prototypes/digital-loop.spec.js       # 原型浏览器测试（如需要）
```

**强制分层：**

| 层 | 模块 | 依赖边界 |
| --- | --- | --- |
| 通用输入层 | edge coordinate、edge key、edge state、hit testing、pointer gesture、undo transaction、board geometry（`input/` + `graph/` 的数据基础） | **不得 import Loopy validator**；只依赖自身与中性工具（`src/utils/`） |
| Loopy 专属层 | single-loop structure validator、numbered-cell clue validator、completion rule、Loopy 诊断数据（`loopy/` + `data/`） | 可以消费通用 edge state；不反向依赖输入层内部 |
| 未来对称分区专属层（**界环谜阵第二玩法方向，P4B 不实现**） | connected-region validator、180° rotational symmetry validator、one-centre-dot validator | 与 Loopy 层同接口地位，可独立替换 |

其余职责：

| 模块 | 要求 |
| --- | --- |
| `graph/`（第一层结构诊断） | **必须保持纯函数**（无 DOM、无 React、无 localStorage）；独立可测 |
| `loopy/`（第二层线索判定） | **必须保持纯函数**；消费通用 edge state；不读写存储 |
| `input/`（pointer 事件 → 命中 → 手势状态机） | 只依赖坐标模型与边状态；不直接读写 DOM；事件绑定由组件层提供 |
| `components/` | 渲染棋盘 + 挂载事件 + 诊断状态显示 + 线索/冲突显示；不包含规则逻辑 |
| `data/` | 诊断数据；仅原型使用 |
| 原型入口 | DEV-only 装配层：检测开发参数后挂载 `digitalLoop` 原型，App 对原型只有一个调用点；**入口负责组合通用输入层与 Loopy 规则层** |
| 反向扩散 | 原型模块只允许 import 中性工具（`src/utils/`）与自身目录；正式 registry、App、GameView、session hook 禁止 import 原型目录 |

解耦验收（P4B 自证项）：通用输入层在无 `loopy/` 的情况下可独立构建与测试；未来替换 Loopy validator 为对称分区 validator（界环谜阵第二玩法）不需要改动 `input/` 与坐标模型。**不需要在 P4B 实际实现对称分区来证明复用性，也不得为证明复用性同时开发对称分区。**

## 15. 测试预算

**方向未稳定阶段（每次交互微调后）：**

- 纯函数测试（坐标、key、命中、两层判定、手势状态机）。
- 原型聚焦浏览器测试。
- 单视口截图（人工查看）。
- 人工鼠标/触摸板体验。
- 必要 build。

**方向稳定后：**

- 390×844 桌面窄窗口测试（桌面浏览器；移动设备按平台政策整体暂缓）。
- 1440×900 桌面测试。
- 10×10 / 11×11 压力测试。
- 一次正式影响面回归。

**完整 E2E 套件只在以下三种情况运行一次：**

- 原型需要影响正式 runtime；或
- P4C 准备 GO；或
- 正式晋升前。

不得在每次交互微调后运行完整 E2E 套件。

## 16. P4C 裁决

P4B 结束后进入 P4C 裁决，最终只允许三种结论：

| 结论 | 含义 |
| --- | --- |
| **GO** | 输入可靠、性能可接受、**桌面**可操作、两层判定正确、原型隔离成立；允许在后续工程包开发完整数字环线原型 |
| **GO WITH CHANGES** | 核心可行，但必须先修改输入方式、棋盘密度、命中区域、状态模型或视口方案中的指定问题，再进入后续原型开发 |
| **NO-GO** | 输入稳定性或性能无法达到产品要求；原型封存或删除；不进入完整数字环线开发 |

**GO 条件（在输入与性能条件之外，必须全部满足）：**

- 三态 edge input 可用。
- `excluded` 状态在**桌面**有**可理解**的输入方案（右键单击或 Shift+左键点击/拖动；移动端不作为 GO 条件，见第 0 节与平台政策）。
- 单环结构判定正确（第一层）。
- 最小数字线索判定正确（第二层）。
- 单环与数字线索**联合决定完成**。
- 通用输入层未硬编码 Loopy 规则。
- 未来可替换为对称分区等其他 edge-boundary validator（架构上成立，不要求实际实现）。

**GO 不表示：** 数字环线正式上线；对称分区已经通过验证；界环谜阵四玩法已经完成；familyId 或 modeId 已正式注册。

明确：

- **P4C 的 GO 不等于立即正式上线**。GO 只表示该方向允许进入后续完整原型工程包（如 P6 方向：5–10 关完整原型，需另行立项、评审与正式合同流程）。
- NO-GO 不否定数字环线玩法概念本身，只否定「边线输入在当前技术栈/设备上可行」这一前提。
- 裁决证据 = P4B 实测记录（命中/误触/性能数据）+ 人工试玩记录 + 两层判定测试结果；P4A 不预填结论。

## 17. 风险清单

| # | 风险 | 影响 | P4B 验证方式 | GO/NO-GO 关联 |
| --- | --- | --- | --- | --- |
| 1 | vertex 交汇处误触 | 拐弯拖动产生错误边 | 死区实测；转弯诊断场景命中断言 | 误触率高 → GO WITH CHANGES（调死区） |
| 2 | 高密度棋盘命中冲突 | 10×10/11×11 相邻边批量误选 | 压力棋盘人工试玩 + 断言 | 批量误选 → GO WITH CHANGES（缩走廊） |
| 3 | 触摸拖动触发滚动 | 移动端手势被浏览器劫持 | **已移出当前阶段**（移动端按平台政策整体暂缓；`touch-action: none` 保持仅作用原型棋盘容器） | 已移出 |
| 4 | Pointer capture 丢失 | 拖出棋盘后事件中断 | 跨边界拖动测试；失焦测试 | 不可恢复 → NO-GO |
| 5 | 同一 edge 重复进入 | 回退抖动、模式翻转 | 手势状态机单元测试 | 违反合同 → REVISE 实现 |
| 6 | 拖动经过角点时路径不稳定 | 转弯处断线或误选 | 直角转弯诊断场景 | 不稳定 → GO WITH CHANGES（死区/走廊） |
| 7 | 撤销粒度错误 | 一次手势产生多步撤销 | 撤销断言（第 12 节 #2） | 违反合同 → REVISE 实现 |
| 8 | 高频 pointermove 性能 | 掉帧、输入延迟 | 帧率/交互采样 | 不达标 → NO-GO |
| 9 | `line` 与 `excluded` 互误写 | 三态语义污染；推理辅助标记被破坏 | 三态诊断场景断言 + 人工试玩 | 违反合同 → REVISE 实现 |
| 10 | 移动端 excluded 无可用输入 | 排除标记在触摸设备上不可操作 | **已移出当前阶段**（移动端按平台政策整体暂缓；桌面 X 通道 = 右键单击或 Shift+左键，见第 8 节） | 已移出 |
| 11 | DOM 命中与数据坐标漂移 | 渲染缩放后命不中 | 多视口命中断言 | 漂移 → GO WITH CHANGES（坐标换算） |
| 12 | 视口缩放导致 hit corridor 失真 | 不同视口手感不一致 | 390×844（桌面窄窗口）/ 1440×900 对比测试 | 失真 → GO WITH CHANGES |
| 13 | 原型污染正式 registry | GAME_MODES/家族目录被改动 | P4B 全程禁止；验收 #12 断言 | 违反合同 → REVISE |
| 14 | 原型写入正式 storage | 正式存档/进度被污染 | 验收 #12 断言 | 违反合同 → REVISE |
| 15 | 过早绑定完整规则 | P4B 被完整 Loopy 求解/生成牵制 | P4A 非目标清单 + 两层判定边界 | 越界 → REVISE |
| 16 | 过早建立正式美术和教学 | Spike 成本膨胀、污染玩家观感 | P4B 禁止清单 + 原型隔离合同 | 越界 → REVISE |
| 17 | 把对称分区混入 P4B | Spike 范围膨胀；无法聚焦边线输入验证 | P4B 禁止清单 + 分层边界 | 越界 → REVISE |

## 参考

- [`docs/prototype-isolation-contract.md`](./prototype-isolation-contract.md) —— 通用原型隔离合同（本合同的容器规则）
- [`docs/game-family-design-system.md`](./game-family-design-system.md) —— 玩法家族权威规范（P3B 完成状态、新玩法接入合同）
- [`docs/edge-puzzle-upstream-reference.md`](./edge-puzzle-upstream-reference.md) —— Loopy / Galaxies 上游成熟实现研究映射（**非规范性工程参考**：状态模型、Validator、Solver、Generator、难度、输入限制；不构成实施要求）
- [`ROADMAP.md`](../ROADMAP.md) —— 路线与阶段状态（P4A/P4B/P4C 位置）
- 权威玩法参考：Loopy（<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/js/loopy.html>，数字环线规则基线）、Galaxies（<https://www.chiark.greenend.org.uk/~sgtatham/puzzles/js/galaxies.html>，对称分区规则参考）
- 代码事实源：`src/config/gameModes.js`（`GAME_MODES`、`RUNTIME_BOARDS`、runtime descriptor）、`src/hooks/useStarLineInputController.js`（Pointer capture 与窗口级 pointerup/pointercancel 模式）、`src/hooks/useStarLineInteraction.js`（手势批撤销模式）、`src/hooks/usePathInteraction.js`（拖动输入模式）
