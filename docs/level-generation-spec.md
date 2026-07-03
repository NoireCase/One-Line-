# 四玩法关卡生成约束 v1.2

> 本文档定义 One-Line 当前四种正式玩法的关卡生成约束。
> 服务于两个对象：后续 AI 批量生成关卡，以及后续 validator/checker 开发。
>
> 本文档不替代现有关卡数据文件（`src/data/portalLevels.js`）、Hidden 规格（`docs/hidden-mode-spec.md`）和 Portal 规格（`docs/portal-mode-level-spec.md`），而是补充 Classic/Diagonal 生成约束和四玩法互斥规则。

---

## 1. 总原则

所有玩法关卡生成必须遵守：

1. **关卡必须可解**。每一关必须有至少一条从起点到终点的合法路径。
2. **不能生成死关**。任何强制导致无合法移动的状态不应出现。
3. **不能生成代码不支持的字段**。字段必须与当前 `src/` 实现一致。
4. **不能混用规则**。Classic 的字段不能写入 Portal 关卡，未实现或已废弃字段不能写入正式关卡。
5. **不能生成未实现机制**。Bridge、One-way、多终点、限时等不在当前代码中的机制，不得在关卡片段出现。
6. **难度必须循序渐进**。不能出现入门关卡比进阶关卡更复杂的情况。
7. **每个玩法应有独立生成约束**。四种玩法不可共享同一套生成逻辑。
8. **AI 生成须标注 intended solution**。只给关卡数据不给推荐解路径的关卡视为未完成。
9. **生成后须人工审查**。AI 生成结果在进入关卡包前必须人工确认可解性、规则兼容性和体验质量。

---

## 2. 四种玩法边界

| mode key | 玩家名称 | 移动规则 | 关卡来源 | 核心目标 | 不允许出现 |
| -------- | -------- | -------- | -------- | -------- | ---------- |
| `classic` | 经典模式 | 正交四向（上下左右） | 程序生成（seeded PRNG + DFS） | 按数字顺序一笔画覆盖全盘 | `portalId`、收集/终点/障碍字段、斜向移动 |
| `diagonal` | 八向连线 | 八向（含斜向） | 程序生成（seeded PRNG + DFS） | 按数字顺序一笔画覆盖全盘 | `portalId`、收集/终点/障碍字段 |
| `hidden` | 极简线索 | 正交四向（上下左右） | 手工关卡（`hiddenLevels.js`） | 只给关键数字，按段长约束推完整路线 | 斜向移动、Portal 字段、道具/金币/星级依赖、自动生成入库 |
| `portalClassic` | 经典传送门 | 八向 | 手工关卡（`portalLevels.js`） | 按数字顺序一笔画覆盖全盘 + 传送门 | `start`/`exit`/`targets`/`obstacles` 等自由收集字段、自由顺序 |

重点说明：

- **Classic 不允许斜向移动**。`classic` mode key 对应的 movement 永远是 `orthogonal`。
- **Diagonal 是独立的八向模式**，不是 Classic 的"升级版"。它拥有独立的关卡列表和进度追踪。
- **Hidden 是独立的分段推理模式**，不是 Classic 的"更多暗牌"版本。它使用 `src/data/hiddenLevels.js`，不接入星级、金币、道具或自动生成入库流水线。
- **Portal Classic 使用独立手工数据**。Portal Classic 使用 `path`+`hiddenVals`+`portals` 结构，存放在 `portalLevels.js`。

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

- Classic 基础关卡由程序生成；经 GM 审核通过的 curated 关卡可追加到对应 mode/diff 末尾。
- AI 不应直接写死 `gridData` 数组；curated 关卡应通过候选生成、审核、dry-run、apply 流程入库。
- 不允许插入、覆盖或重排已有正式关卡，避免关卡编号和存档错位。

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

- `N`：当前 Phase 为 5 或 7（5×5=25 格，7×7=49 格）。不继续开发 N=9。
- `path`：长度必须 = N×N，每个索引 0–24（或 0–48）各出现一次，相邻移动符合八向规则。
- `portals`：每项 `cells` 必须正好 2 个索引；每组 `id` 唯一；每关 ≥1 组，建议 ≤4 组。
- `hiddenVals`：存的是路径数字（如 3, 7, 12），不是格子索引。
- `targetSteps` = 推荐最优步数。对于全盘覆盖，通常 = N×N − 1（5×5 为 24，7×7 为 48）。
- Portal 必须成对出现；至少一个 Portal 是通关必需。
- 不允许使用自由收集类字段：`start`/`exit`/`targets`/`obstacles`/`excellentSteps`。

### 5.3 星级

- 3 星：`steps <= targetSteps`
- 2 星：`steps <= targetSteps + 2`
- 1 星：通关

### 5.4 常见错误示例

- ❌ Portal cells 只有一个索引
- ❌ 复用同一个 `id` 于多组 portal
- ❌ `path` 长度 ≠ N×N
- ❌ `path` 中有重复索引
- ❌ 使用自由收集类字段
- ❌ Portal 可有可无（不走传送门也能通关）

---

## 6. 难度曲线建议

| 阶段 | Classic | Diagonal | Portal Classic |
| ---- | ------- | -------- | -------------- |
| 入门 | N=5, hidden 8–9, maxGap=2 | N=5, hidden 8–9, 斜向 20–25% | N=5, 1 portal, hidden 0–3 |
| 熟悉 | N=5, hidden 9–10, maxGap=2 | N=5, hidden 9–10, 斜向 25–35% | N=5, 1–2 portals, hidden 2–4 |
| 进阶 | N=7, hidden 20–23, maxGap=3 | N=7, hidden 20–23, 斜向 25–40% | N=7, 2–3 portals, hidden 7–12 |
| 挑战 | N=9, hidden 40–45, maxGap=4 | N=9, hidden 40–45, 斜向 30–50% | 当前不继续扩展为 Hard 主线 |

每个阶段的可调参数：

- **Classic / Diagonal**：N（棋盘尺寸）、hidden count（隐藏数量）、maxGap（连续隐藏间隔）。Diagonal 额外：斜向比例。
- **Portal Classic**：N、portal 数量、hiddenVals 数量。`targetSteps` 基于设计路径计算。

---

## 8. AI 生成关卡输出格式要求

后续 AI 生成每个关卡时必须输出以下内容：

### 8.1 通用（所有玩法）

```
- mode key: classic | diagonal | hidden | portalClassic
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

---

## 9. 禁止项

以下行为在 AI 生成关卡时禁止：

1. **不得新增未实现字段**。所有字段必须在当前 `src/` 中有对应读取逻辑。
2. **不得新增未实现机制**。如多终点、限时、Bridge 模式、One-way 格、动态障碍等。
3. **不得混用规则**。Classic 关不得含 portal，Portal Classic 关不得含自由收集字段。
4. **不得生成未验证可解的关卡**。每个关卡必须有至少一条 verified solution。
5. **不得只给自然语言说明而不给数据结构**。必须同时输出可放入代码的 JS 对象。
6. **不得生成没有 intended solution 的关卡**。AI 必须自己验证至少一条解路径存在。
7. **不得修改现有玩法逻辑来迁就生成结果**。关卡必须适配现有代码，不能反过来。
8. **不得生成无 Portal 的 Portal Classic 关卡**。至少一个 Portal 是通关必需。

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

---

## Classic / Diagonal 内容上限与 Hidden 当前状态

### Classic / Diagonal 内容上限

Classic / Diagonal 是游戏的基础线，不作为无限扩展主线。

目标结构（每个玩法）：

| 难度 | 棋盘 | 关卡数 | 说明 |
|------|------|--------|------|
| easy | 5×5 | **10** | 入门，掌握基本连线逻辑 |
| medium | 7×7 | **20** | 进阶，引入暗牌推理 |
| hard | 9×9 | **30** | 挑战，大棋盘 + 高暗牌密度 |
| **合计** | | **60** | |

达到 60 关后，不再通过单纯增加棋盘尺寸、暗牌数量、路径复杂度继续扩展 Classic / Diagonal。当前后续推理内容已进入 Hidden 独立模式。

### Hidden 当前方向

Hidden 是 Classic / Diagonal 之后的独立推理变化线，当前已完成 60 关：

- Hidden 不等于"更多暗牌"。
- Hidden 的核心是**信息缺口与推理链**——通过限制可见信息、引入间接推理约束，创造新的解谜维度。
- 当前结构为 Easy 5×5 10 关 + Medium 7×7 20 关 + Hard 7×7 30 关。
- Hidden 关卡规则和阶段状态以 `docs/hidden-mode-spec.md` 为准。

### GM 角色定位

GM Console 不是人工逐关筛选器，而是自动化流水线的**批次验收台**：

- 负责展示批次摘要（统计、分布、预警）
- 支持抽查试玩（进入 Dev Candidate 棋盘）
- 修正误判（覆盖 AUTO_REJECT / REVIEW_CANDIDATE 分层）
- 标记 APPROVED / REJECTED
- 生成 apply 命令供正式入库
- 主筛选由 Validator / Scorer / Similarity / Archetype / Batch Evaluator 自动完成

---

## 自动批次评估

### 候选生成器增强

`scripts/generate-level-candidates.mjs` 在原有 Validator + Scorer 基础上新增两层自动评估：

| 层级 | 字段 | 职责 |
|------|------|------|
| Similarity | `similarityScore`, `maxSimilarity`, `similarTo`, `similarityReasons` | 防止新关与旧关/同批候选过度相似 |
| Archetype | `archetypeTag`, `archetypeConfidence`, `archetypeReasons` | 标记关卡结构类型，保证批次结构多样 |

### Similarity Score（相似度评分）

- 输出 0–100，越高越相似
- 对比范围：新候选 vs 正式关卡、新候选 vs 同批 staged、新候选 vs 已选入 staged 的候选
- 高相似候选降权或剔除
- 与正式关卡 maxSimilarity > 85 的候选不得进入 AUTO_RECOMMENDED
- 同批候选中相似度过高时只保留质量更高的

### Archetype Tag（结构类型标签）

标签列表：

| 标签 | 说明 |
|------|------|
| `EDGE_SWEEP` | 边缘扫圈，边缘覆盖明显 |
| `CENTER_WEAVE` | 中心穿插 |
| `LONG_RETURN` | 长线折返 |
| `SPLIT_REGION` | 分区穿越 |
| `COMPACT_ZIGZAG` | 紧凑折线 |
| `ANCHOR_SPARSE` | 锚点稀疏 |
| `ANCHOR_DENSE` | 锚点密集 |
| `DIAGONAL_WEAVE` | 斜向编织（Diagonal 专属） |
| `BALANCED_PATH` | 结构均衡 |
| `UNKNOWN` | 无法稳定判断 |

Archetype 不作为硬失败原因，但同一批 staged Top N 中应尽量避免全部同类型。

### Batch Summary（批次摘要）

`generate-level-candidates --stage true` 额外输出：

- `reports/staged-level-candidates-summary.md`：含 batch evaluation
- 基础统计、分数分布、archetype 分布、相似度预警
- 批次结论：PASS（可进入 GM 抽检）/ REVIEW（建议更多抽检）/ FAIL（不建议入库）

结论仅写入报告，不自动提交、不自动入库。

### Staged 选择规则

推荐优先级（综合排序，非纯 qualityScore 排序）：

1. Validator 必须通过
2. qualityScore 达标
3. difficultyScore 匹配目标 diff
4. maxSimilarity 不过高
5. 同批候选间尽量多样
6. archetype 分布尽量均衡
7. Diagonal 必须保留足够八向身份感

---

### Validator + Scorer 双层检查体系

项目已建立 Validator + Scorer 双层关卡检查体系：

| 层级 | 脚本 | 职责 | 门禁类型 |
|------|------|------|---------|
| Validator | `scripts/validate-levels.mjs` (`npm run validate:levels`) | 合法性校验：字段类型、索引范围、Portal Classic path/portal/crossing 检查 | **Hard Gate**（不通过则关卡非法） |
| Scorer | `scripts/score-level-quality.mjs` (`npm run score:levels`) | Classic / Diagonal 启发式质量诊断：qualityScore、difficultyScore、penalties、rejectReasons | **Advisory Only**（诊断参考，不作为关卡废弃或 CI 失败依据） |

### Validator 局限性

Validator 只验证关卡数据**合法性**，**不评估关卡质量**。合法关卡不等于优质关卡。

- Classic / Diagonal 抽样校验只检查 board/路径合法性，不评估路径设计感、视觉可读性、难度梯度。
- Portal Classic 的合法性检查是必要条件，不是充分条件——合法关卡仍可能体验差（如传送门无意义、空间跳跃弱）。
- 步数合理性检查只做数值对比，不替代人工试玩判断。

### Scorer 覆盖范围

Scorer 当前覆盖 Classic / Diagonal 正式关卡的启发式质量评分，维度包括：snakePenalty、longRunPenalty、monotonyPenalty、chaosPenalty、turnBalancePenalty、anchorDistributionPenalty、diagonalIdentityPenalty（仅 Diagonal）。

Scorer 输出 `reports/level-quality-report.json` 和 `reports/level-quality-summary.md`，仅作为质量雷达参考。**Portal Classic 的质量评分由专用候选工具辅助，不替代人工试玩。**

Scorer 阈值（如 qualityScore<65、snakePenalty≥25 等）为初始经验值，**后续需要根据人工试玩反馈校准**，尤其 Diagonal chaosPenalty 在 5×5 小棋盘上可能过度敏感。

### 重要约束

- **不要将 `score:levels` 接入 `validate:levels`**。Scorer 结果不应导致 `validate:levels` 失败或 CI 失败。
- Scorer 的 rejectReasons 是诊断标签，不是关卡删除指令。
- `reports/` 是运行产物，已通过 `.gitignore` 排除，**不进入提交**。

### 关卡质量筛选流程（完整链路）

后续如需新增或替换 Classic / Diagonal curated 关卡，完整链路为：

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
   npm run apply:level-candidates -- --mode classic --diff hard --keys "classic:hard:169642:169642,classic:hard:159669:159669"

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
