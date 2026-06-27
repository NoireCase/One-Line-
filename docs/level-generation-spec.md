# 四玩法关卡生成约束 v1.0

> 本文档定义 One-Line 四种玩法的关卡生成约束。
> 服务于两个对象：后续 AI 批量生成关卡，以及后续 validator/checker 开发。
>
> 本文档不替代现有关卡数据文件（`src/data/portalLevels.js`）和 Portal 规格（`docs/portal-mode-level-spec.md`），而是补充 Classic/Diagonal 生成约束和四玩法互斥规则。

---

## 1. 总原则

所有玩法关卡生成必须遵守：

1. **关卡必须可解**。每一关必须有至少一条从起点到终点的合法路径。
2. **不能生成死关**。任何强制导致无合法移动的状态不应出现。
3. **不能生成代码不支持的字段**。字段必须与当前 `src/` 实现一致。
4. **不能混用规则**。Classic 的字段不能写入 Portal 关卡，Portal 2.0 的字段不能写入 Classic 关卡。
5. **不能生成未实现机制**。Bridge、One-way、多终点、限时等不在当前代码中的机制，不得在关卡片段出现。
6. **难度必须循序渐进**。不能出现入门关卡比进阶关卡更复杂的情况。
7. **每个玩法应有独立生成约束**。四种玩法不可共享同一套生成逻辑。
8. **AI 生成须标注 intended solution**。只给关卡数据不给推荐解路径的关卡视为未完成。
9. **生成后须人工审查**。AI 生成结果在进入关卡包前必须人工确认可解性、规则兼容性和体验质量。

---

## 2. 四种玩法边界

| mode key | 玩家名称 | 移动规则 | 关卡来源 | 核心目标 | 不允许出现 |
| -------- | -------- | -------- | -------- | -------- | ---------- |
| `classic` | 经典模式 | 正交四向（上下左右） | 程序生成（seeded PRNG + DFS） | 按数字顺序一笔画覆盖全盘 | `portalId`、`isTarget`、`isExit`、`isObstacle`、斜向移动 |
| `diagonal` | 八向连线 | 八向（含斜向） | 程序生成（seeded PRNG + DFS） | 按数字顺序一笔画覆盖全盘 | `portalId`、`isTarget`、`isExit`、`isObstacle` |
| `portalClassic` | 经典传送门 | 八向 | 手工关卡（`portalLevels.js`，version≠2） | 按数字顺序一笔画覆盖全盘 + 传送门 | Version 2 字段（`start`/`exit`/`targets`/`obstacles`）、自由顺序 |
| `portalCollect` | 传送门收集 | 八向 | 手工关卡（`portalLevels.js`，version=2） | 自由顺序收集金币 → 传送门 → 抵达终点 | Classic 编号路径、`val` 顺序依赖、`hiddenVals`、道具依赖 |

重点说明：

- **Classic 不允许斜向移动**。`classic` mode key 对应的 movement 永远是 `orthogonal`。
- **Diagonal 是独立的八向模式**，不是 Classic 的"升级版"。它拥有独立的关卡列表和进度追踪。
- **Portal Classic 和 Portal Collect 不要混写**。Portal Classic 使用 `path`+`hiddenVals`+`portals` 结构；Portal Collect 使用 `start`+`exit`+`targets`+`portals`+`obstacles` 结构。两者通过 `version` 字段区分。
- **Portal Collect 不是 Portal Classic 的简单扩展**。它是独立收集玩法，无顺序要求，无全盘覆盖要求。

---

## 3. Classic 关卡生成约束

### 3.1 当前代码真实规则

Classic 关卡当前通过 `createClassicLevel()` 程序生成，参数来自 `CONFIG`：

| 难度 | N | hiddenMin | hiddenMax | maxGap | HP | coins |
| ---- | - | --------- | --------- | ------ | -- | ----- |
| easy | 5 | 8 | 10 | 2 | 3 | 10 |
| medium | 7 | 20 | 25 | 3 | 5 | 20 |
| hard | 9 | 40 | 45 | 4 | 10 | 40 |

### 3.2 棋盘

- `N × N` 正方形棋盘。`N` 来自 `getClassicGridSize(diff)`。
- easy = 5×5 = 25 格，medium = 7×7 = 49 格，hard = 9×9 = 81 格。

### 3.3 路径

- 路径必须经过所有 `N×N` 个格子，每个格子恰好一次（哈密顿路径）。
- 格子 `val` 按路径顺序赋值：起点 = 1，终点 = N×N。
- 移动规则：**仅正交四向**（上下左右），不能斜向。
- 路径不能自交、不能重复访问。
- 起点位置由 DFS 生成算法随机决定；终点是路径最后一个节点。

### 3.4 隐藏数字

- 从路径中随机选取 `hiddenMin`–`hiddenMax` 个格子隐藏数字。
- 隐藏后必须通过 `checkUnique()` 验证解仍唯一（15ms 超时）。
- 两个隐藏数字之间最多间隔 `maxGap` 个连续可见数字。
- `hiddenVals` 存储的是**路径数字**（如 3, 7, 12），不是格子索引。

### 3.5 cell 字段

Classic cell 合法字段：
```
{ val, isHidden, isRevealed, isExcluded, isHinted }
```
不包含 `portalId`、`isStart`、`isExit`、`isTarget`、`isObstacle`。

### 3.6 难度参数建议

| 参数 | easy | medium | hard |
| ---- | ---- | ------ | ---- |
| N | 5 | 7 | 9 |
| 隐藏数量 | 8–10 | 20–25 | 40–45 |
| 隐藏密度 | ~35% | ~45% | ~52% |
| maxGap | 2 | 3 | 4 |

### 3.7 AI 生成时注意事项

- Classic 当前是**程序生成**，不是静态手工关卡。AI 不应直接写死 gridData 数组。
- AI 后续应生成的是**生成参数建议**（如目标隐藏比例、难度档位）或**候选路径模板**。
- 如需生成手工 Classic 关卡，必须先确认代码支持从静态数据加载 Classic 关卡。

### 3.8 常见错误示例

- ❌ 在 Classic 关卡中写入 `portalId` 字段
- ❌ 使用斜向移动的路径
- ❌ 路径长度不等于 N×N
- ❌ 重复访问同一个格子
- ❌ 隐藏密度超过 60%
- ❌ maxGap 过大导致连续多个不可见数字

---

## 4. Diagonal 关卡生成约束

### 4.1 与 Classic 相同点

- 棋盘尺寸结构完全一致（easy 5×5 / medium 7×7 / hard 9×9）。
- 路径必须覆盖全盘，每个格子恰好一次。
- 按数字顺序（1→2→3…→N×N）。
- 隐藏数字规则相同（随机选取 + checkUnique + maxGap）。
- 评分和星级规则相同。

### 4.2 与 Classic 的唯一核心差异：八向移动

- `movement: MOVEMENT_TYPES.diagonal`
- 允许 8 个方向的移动（上下左右 + 四个斜向）。
- 路径禁止交叉（`allowCrossing: false`）。当两个斜向线段可能形成 "X" 交叉时，第二条线段被拒绝。
- 同一格子不能被重复访问。

### 4.3 斜向路径质量要求

- 斜向移动不应过度密集。连续 3 次以上纯斜向移动会让路径看起来像"锯齿"，失去规划感。
- 推荐斜向比例：easy 20%–35%，medium 25%–40%，hard 30%–50%。
- 斜向移动应该有明确的空间意义（如跨行转场、绕开障碍区域），而不是随机斜跳。

### 4.4 不允许混入的字段

与 Classic 相同：不含 `portalId`、`isTarget`、`isExit`、`isObstacle`。

### 4.5 难度参数建议

与 Classic 完全一致（N / hiddenMin / hiddenMax / maxGap）。额外约束：

| 参数 | easy | medium | hard |
| ---- | ---- | ------ | ---- |
| 推荐斜向比例 | 20–35% | 25–40% | 30–50% |

### 4.6 常见错误示例

- ❌ 全程只有正交移动，未体现八向玩法价值
- ❌ 斜向路径形成 "X" 自交
- ❌ 连续 5 次以上纯斜向锯齿路径
- ❌ 斜向比例超过 60%

---

## 5. Portal Classic / Portal 1.0 关卡生成约束

> 详细规格参见 `docs/portal-mode-level-spec.md` 第 1–11 节。以下为约束摘要。

### 5.1 当前数据结构

```js
{
  id: 'portal-xxx',
  name: '关卡名',
  N: 5,
  targetSteps: 24,
  path: [/* 25 个格子索引，覆盖全盘 */],
  portals: [
    { id: 'A', cells: [入口索引, 出口索引] }
  ],
  hiddenVals: [/* 隐藏的路径数字 */]
}
```

### 5.2 约束

- `N`：当前 Phase 为 5（5×5=25 格）。
- `path`：长度必须 = N×N，每个索引 0–24 各出现一次，相邻移动符合八向规则。
- `portals`：每项 `cells` 必须正好 2 个索引；每组 `id` 唯一；每关 ≥1 组，建议 ≤4 组。
- `hiddenVals`：存的是路径数字（如 3, 7, 12），不是格子索引。
- `targetSteps` = 推荐最优步数。对于全盘覆盖，通常 = N×N − 1 = 24。
- Portal 必须成对出现；至少一个 Portal 是通关必需。
- 不允许使用 Portal 2.0 的 `start`/`exit`/`targets`/`obstacles`/`excellentSteps`。

### 5.3 星级

- 3 星：`steps <= targetSteps`
- 2 星：`steps <= targetSteps + 2`
- 1 星：通关

### 5.4 常见错误示例

- ❌ Portal cells 只有一个索引
- ❌ 复用同一个 `id` 于多组 portal
- ❌ `path` 长度 ≠ N×N
- ❌ `path` 中有重复索引
- ❌ 使用 Portal 2.0 字段
- ❌ Portal 可有可无（不走传送门也能通关）

---

## 6. Portal Collect / Portal 2.0 关卡生成约束

> 详细规格参见 `docs/portal-mode-level-spec.md` 第 12 节。以下为约束摘要。

### 6.1 当前数据结构

```js
{
  id: 'portal2-xxx',
  name: '关卡名',
  version: 2,
  N: 7,
  start: 起点索引,
  exit: 终点索引,
  targets: [金币索引, ...],
  portals: [{ id: 'A', cells: [入口, 出口] }],
  obstacles: [障碍索引, ...],
  targetSteps: 二星步数,
  excellentSteps: 三星步数
}
```

### 6.2 字段约束

- `version`：必须为 `2`。这是区分 Portal Classic 的唯一标识。
- `N`：当前样板为 7。后续可扩展为 5、9 等，推荐先保持 7×7。
- `start`：路径起点。必须是合法格子索引（0 ≤ start < N×N）。
- `exit`：路径终点。金币未全部收集前不可通行。
- `targets`：金币位置数组。至少 2 个，建议 4–8 个。必须全部收集。
- `portals`：同 Portal Classic 格式。每关 ≥1 对，建议 1–3 对。
- `obstacles`：不可通行格子。不得与 `start`/`exit`/`targets`/portal cells 重叠。
- `targetSteps`：二星达标步数。必须基于实际可达成路径计算。
- `excellentSteps`：三星达标步数。必须 ≤ targetSteps 且基于实际最优路径。

### 6.3 胜利条件

```js
isPortal2Complete = 所有 targets 被经过 && exit 被经过
```
注意：`start` 不在条件中（路径起始自动包含）。

### 6.4 星级

- 3 星：`steps <= excellentSteps`
- 2 星：`steps <= targetSteps`
- 1 星：通关

### 6.5 传送门规则

- 踩入传送门入口后**自动传送到出口**（与 Portal Classic 的手动两步不同）。
- 传送门入口和出口均可被路径正常经过。
- 传送门不是收集目标，不影响胜利条件。
- 已使用传送门显示 `◆`，未使用显示 `◇`。

### 6.6 终点封锁规则

- 终点在金币未全部收集前**不可通行**。
- 过早点击终点触发 toast 提示"先收集金币"。
- 设计关卡时必须确保终点可达但最初被封锁，且收集完金币后终点确实可达。

### 6.7 边界

- **不使用 Classic 生命值**。Portal 2.0 HP = 99，无惩罚。
- **不使用 Classic 道具**。恢复/排除/提示在 Portal 2.0 中不可用。
- **不使用 Classic combo 评分**。HUD 只显示步数。
- **不奖励全局金币**。`coinReward = 0`。

### 6.8 关卡设计原则

| 阶段 | 金币数 | 传送门 | 障碍物 | 核心验证 |
| ---- | ------ | ------ | ------ | -------- |
| 入门 | 2–4 | 1 对 | 简单屏障 | 收集顺序验证：玩家理解先收集再离开 |
| 熟悉 | 4–6 | 1–2 对 | 区域分隔 | 区域切换：传送门用于跨区 |
| 进阶 | 6–8 | 1–3 对 | 多区域 | 轻规划：多条可能路线，需选择最优 |
| 挑战 | 8+ | 2–3 对 | 复杂布局 | 深层规划：多阶段路径回收 |

### 6.9 常见错误示例

- ❌ 收集完所有 targets 后，exit 仍不可达
- ❌ exit 被 obstacles 或错误 portal 布局隔断
- ❌ obstacle 覆盖 start/exit/target/portal
- ❌ targets 之间不可达
- ❌ 传送门出口落在 obstacle 上
- ❌ targetSteps 设置为不可能达到的数值
- ❌ excellentSteps > targetSteps
- ❌ 把 Portal Collect 当成固定顺序路径设计
- ❌ 使用 `path` 字段（Portal Collect 无预设路径）

---

## 7. 难度曲线建议

| 阶段 | Classic | Diagonal | Portal Classic | Portal Collect |
| ---- | ------- | -------- | -------------- | -------------- |
| 入门 | N=5, hidden 8–9, maxGap=2 | N=5, hidden 8–9, 斜向 20–25% | N=5, 1 portal, hidden 0–3 | N=7, targets 2–4, 1 portal, 简单屏障 |
| 熟悉 | N=5, hidden 9–10, maxGap=2 | N=5, hidden 9–10, 斜向 25–35% | N=5, 1–2 portals, hidden 2–4 | N=7, targets 4–6, 1–2 portals, 区域分隔 |
| 进阶 | N=7, hidden 20–23, maxGap=3 | N=7, hidden 20–23, 斜向 25–40% | N=5, 2–3 portals, hidden 3–5 | N=7, targets 6–8, 1–3 portals, 多区域 |
| 挑战 | N=9, hidden 40–45, maxGap=4 | N=9, hidden 40–45, 斜向 30–50% | N=5, 3–4 portals, hidden 4–6 | N=7+, targets 8+, 2–3 portals, 复杂布局 |

每个阶段的可调参数：

- **Classic / Diagonal**：N（棋盘尺寸）、hidden count（隐藏数量）、maxGap（连续隐藏间隔）。Diagonal 额外：斜向比例。
- **Portal Classic**：N（当前固定 5）、portal 数量、hiddenVals 数量。`targetSteps` 基于设计路径计算。
- **Portal Collect**：N（当前固定 7）、targets 数量、portals 数量、obstacles 密度。`targetSteps` 和 `excellentSteps` 基于最优可达路径计算。

---

## 8. AI 生成关卡输出格式要求

后续 AI 生成每个关卡时必须输出以下内容：

### 8.1 通用（所有玩法）

```
- mode key: classic | diagonal | portalClassic | portalCollect
- level id: 稳定唯一标识（短横线命名）
- level name: 人类可读名称
- grid size: N
- raw data / config: 可直接放入代码的 JS 对象
- design goal: 一句话说明本关的设计意图
- difficulty: 入门 | 熟悉 | 进阶 | 挑战
- intended solution: 推荐解路径（格子索引序列）
- validation checklist: 本关通过哪些规则检查
```

### 8.2 Classic / Diagonal 额外

```
- hidden count: 实际隐藏数量
- hidden positions: 隐藏数字的位置列表（值，不是索引）
- maxGap: 实际最大间隔
- diagonal ratio: (仅 Diagonal) 斜向占比
```

### 8.3 Portal Classic 额外

```
- portal roles: 每组 portal 的设计角色（Shortcut / Detour / Relay / Recovery / Region Switch）
- hidden positions: 被隐藏的路径数字
- completeness check: portal 是否通关必需
```

### 8.4 Portal Collect 额外

```
- all target positions: 金币位置列表
- portal pair mapping: 传送门配对关系
- recommended path: 一条可达的最优路径
- expected step range: 正常玩家完成步数范围
- exit route verification: 收集完所有 targets 后如何抵达 exit
- obstacle justification: 每个障碍物的设计作用
```

---

## 9. 禁止项

以下行为在 AI 生成关卡时禁止：

1. **不得新增未实现字段**。所有字段必须在当前 `src/` 中有对应读取逻辑。
2. **不得新增未实现机制**。如多终点、限时、Bridge 模式、One-way 格、动态障碍等。
3. **不得混用规则**。Classic 关不得含 portal，Portal Collect 关不得含 hiddenVals。
4. **不得生成未验证可解的关卡**。每个关卡必须有至少一条 verified solution。
5. **不得只给自然语言说明而不给数据结构**。必须同时输出可放入代码的 JS 对象。
6. **不得生成没有 intended solution 的关卡**。AI 必须自己验证至少一条解路径存在。
7. **不得修改现有玩法逻辑来迁就生成结果**。关卡必须适配现有代码，不能反过来。
8. **不得为 Portal Collect 设计固定顺序路径**。Portal Collect 的核心是自由顺序收集。
9. **不得把 Portal Collect 的 `targets` 按 `val` 1→2→3 编号**。Portal Collect 没有 `val` 概念。
10. **不得生成无 Portal 的 Portal Classic 关卡**。至少一个 Portal 是通关必需。

---

## 10. 后续 validator 计划

下一步应实现关卡 validator，自动检查以下项目：

### 通用检查
- [ ] mode key 是否为四个合法值之一
- [ ] grid size N 是否为合法值（5/7/9）
- [ ] 所有索引是否在 [0, N×N−1] 范围内
- [ ] 数据字段是否与 mode 兼容（无不合法字段）

### Classic / Diagonal
- [ ] 路径是否覆盖全盘
- [ ] 路径是否无重复格子
- [ ] 相邻移动是否符合当前 mode 的移动规则
- [ ] 隐藏数字间隔是否满足 maxGap

### Portal Classic
- [ ] portal 是否成对（cells.length === 2）
- [ ] portal id 是否唯一
- [ ] path 是否覆盖全盘且无重复
- [ ] 至少一个 portal 是通关必需
- [ ] targetSteps 是否合理

### Portal Collect
- [ ] start/exit/targets/portals/obstacles 坐标合法
- [ ] obstacle 不与 start/exit/target/portal 重叠
- [ ] portal cells 不与 obstacle 重叠
- [ ] 至少存在一条从 start 到 exit 的路径，经过所有 targets
- [ ] 路径不经过 obstacle
- [ ] 收集完所有 targets 后，exit 是否可达
- [ ] targetSteps 和 excellentSteps 是否合理（基于实际可达路径）

### Validator + Scorer 双层检查体系

项目已建立 Validator + Scorer 双层关卡检查体系：

| 层级 | 脚本 | 职责 | 门禁类型 |
|------|------|------|---------|
| Validator | `scripts/validate-levels.mjs` (`npm run validate:levels`) | 合法性校验：字段类型、索引范围、重叠检查、Portal Collect 可达性 BFS、步数合理性 | **Hard Gate**（不通过则关卡非法） |
| Scorer | `scripts/score-level-quality.mjs` (`npm run score:levels`) | Classic / Diagonal 启发式质量诊断：qualityScore、difficultyScore、penalties、rejectReasons | **Advisory Only**（诊断参考，不作为关卡废弃或 CI 失败依据） |

### Validator 局限性

Validator 只验证关卡数据**合法性**，**不评估关卡质量**。合法关卡不等于优质关卡。

- Classic / Diagonal 抽样校验只检查 board/路径合法性，不评估路径设计感、视觉可读性、难度梯度。
- Portal Classic / Portal Collect 的可达性检查是必要条件，不是充分条件——可达关卡仍可能体验差（如传送门无意义、收集顺序过于线性）。
- 步数合理性检查只做数值对比，不替代人工试玩判断。

### Scorer 覆盖范围

Scorer 当前覆盖 Classic / Diagonal 90 关的启发式质量评分，维度包括：snakePenalty、longRunPenalty、monotonyPenalty、chaosPenalty、turnBalancePenalty、anchorDistributionPenalty、diagonalIdentityPenalty（仅 Diagonal）。

Scorer 输出 `reports/level-quality-report.json` 和 `reports/level-quality-summary.md`，仅作为质量雷达参考。**Portal Classic / Portal Collect 的质量评分尚未覆盖，后续需要单独设计。**

Scorer 阈值（如 qualityScore<65、snakePenalty≥25 等）为初始经验值，**后续需要根据人工试玩反馈校准**，尤其 Diagonal chaosPenalty 在 5×5 小棋盘上可能过度敏感。

### 重要约束

- **不要将 `score:levels` 接入 `validate:levels`**。Scorer 结果不应导致 `validate:levels` 失败或 CI 失败。
- Scorer 的 rejectReasons 是诊断标签，不是关卡删除指令。
- `reports/` 是运行产物，已通过 `.gitignore` 排除，**不进入提交**。

### 关卡质量筛选流程（完整链路）

后续 Classic / Diagonal 扩容时的完整链路：

```
1. 生成候选关卡
   npm run generate:level-candidates -- --mode classic --diff hard --count 5 --stage true

2. 导出 dev 候选
   npm run export:dev-level-candidates

3. 启动 dev server
   npm run dev

4. GM Console 中进入「Dev 试玩关卡」区域
   - 打开设置 → 开发工具 → 打开 GM 控制台
   - 在 GM Console 底部找到「Dev 试玩关卡」区域
   - 候选列表自动从 src/config/devLevelCandidates.generated.js 加载

5. 点击候选「试玩」按钮
   - 进入游戏界面
   - 顶部 HUD 显示「DEV CANDIDATE · Classic hard · seed 169642」
   - 棋盘右侧出现 Dev Candidate Review 信息区（320px 宽）
   - 右侧信息区显示：基础信息、Penalties、Metrics（可折叠）

6. 试玩候选关卡，在棋盘右侧查看候选完整数据

7. 标记审核结果：
   - 「添加为正式关卡」→ 标记为 APPROVED（写入 localStorage cg_dev_candidate_reviews）
   - 「不合格」→ 标记为 REJECTED（写入 localStorage cg_dev_candidate_reviews）
   - 「下一个候选」→ 进入同一批次下一个 UNREVIEWED 候选
   - 「重玩」→ 重新开始当前候选
   - 「返回 GM」→ 返回关卡列表并打开 GM Console
   - 「复制候选 JSON」→ 复制候选完整数据到剪贴板
   - 「复制 apply 命令」→ 复制正式入库命令到剪贴板

8. 后续再通过 apply 脚本 dry-run 确认正式入库：
   npm run apply:staged-levels -- --mode classic --diff hard --seeds 169642,159669 --dry-run true

9. 最终正式入库只能 append 到当前 mode 最末尾
```

#### Dev Candidate 关键约束

- **dev candidate 是开发预览，不是正式关卡**。不显示在玩家关卡列表中。
- **dev candidate 不写正式存档**。不修改 progress、highScores、portalProgress、portalBestSteps、coins、achievements、dailyChallenge、mid-session save。
- **dev candidate 不占用正式 level index**。试玩时 HUD 标题为 DEV CANDIDATE 而非「经典模式 · Lv 1」。
- **「添加为正式关卡」在前端只做审核标记**，不直接改源码。正式入库必须通过单独脚本。
- **不支持插入 easy / medium / hard 中间**，避免关卡编号和存档错位。
- **不支持覆盖已有正式关卡**。
- **不支持改变已有正式关卡顺序**。
- **如果端到端流程跑不通，这套工具应整体删除，不进入提交**。

#### localStorage 审核存储

审核状态存储在 `cg_dev_candidate_reviews`：

```json
{
  "169642": "APPROVED",
  "159669": "REJECTED"
}
```

Key 为候选关卡的 seed（数字），Value 为 `"APPROVED"` 或 `"REJECTED"`。

#### Production 隔离

- 所有 dev candidate 逻辑由 `import.meta.env.DEV` 包裹。
- `src/config/devLevelCandidates.generated.js` 通过动态 `import()` 加载，production build 不打包。
- `devLevelCandidates.generated.js` 在 `.gitignore` 中，不进入版本控制。
- production build 中不显示 Dev 试玩关卡入口、DEV CANDIDATE 标记、右侧候选信息区。
- `src/config/devLevelCandidates.generated.js` 是本地生成产物，已通过 `.gitignore` 排除。
