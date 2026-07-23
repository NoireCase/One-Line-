# Star Double 关卡生产系统（Package D0.8）

> D0 建立候选生成底座；D0.5 增加可证明的人类逻辑、推理指纹和 D1 门禁；
> D0.7 正式化两条安全规则并验证有界局部 motif；D0.8 验证停滞驱动、
> 有界且确定的 region mutation optimizer。本阶段不新增正式关卡。

## 1. 双星规则与生产约束

- **quota = 2**：每行 2 星、每列 2 星、每区域 2 星
- **无邻接**：任意两颗星在八方向上不可相邻
- **N 个区域**：N×N 棋盘有 N 个正交连通区域
- **唯一解**：每个 puzzle 必须有且仅有一个满足全部约束的解

## 2. 支持尺寸

| 尺寸 | 星数 | 区域数 | 状态 |
|------|------|--------|------|
| 8×8 | 16 | 8 | 已支持 |
| 9×9 | 18 | 9 | 已支持 |
| 10×10 | 20 | 10 | 已支持 |

非法尺寸明确失败，不静默回退。

## 3. Generator Family 与 Structural Family

生成器使用 **solution-first** 方法：

1. 生成合法星位（2/行、2/列、无邻接）
2. 每对星分配至一个区域（N 个区域，各 2 星）
3. 从种子星位出发平衡 BFS 生长区域
4. 应用单格对交换变异增加多样性
5. Solver 验证唯一解

`generatorFamily` 记录实际生成策略与结构分类的组合；`structuralFamily`
只描述答案星位的空间分布。两者不可混写，也不能单独证明玩家体验不同。

结构家族按星位空间分布分类：
- `edge`：星位集中于边缘
- `diagonal`：星位沿对角线分布
- `clustered`：星位在部分象限集中
- `distributed`：星位均衡分布

## 4. Seed 机制

- 使用 `mulberry32` 确定性 PRNG
- 相同 `(size, seed, index)` 产生完全相同候选
- 不同 seed 可产生不同家族结构
- 所有命令输出不含 `generatedAt`、`durationMs` 等非确定字段

## 5. 唯一解要求

- 生成器内部通过 `solveStarLine` 验证 `UNIQUE`
- 声明 solution 与 Solver 解不一致时记录 `invalid-declared-solution`
- 分析器独立重验证 Solver 状态

## 6. Legacy Opening Taxonomy

quota=2 开局分类不照搬单星的 region-singleton 体系。

双星开局事件类型：
- `ROW_CAPACITY` / `COL_CAPACITY` / `REGION_CAPACITY`：剩余格数等于所需星数
- `ROW_REGION_LOCK` / `COL_REGION_LOCK`：行/列剩余格全在同一区域
- `REGION_ROW_LOCK` / `REGION_COL_LOCK`：区域剩余格全在同一行/列

开局家族：
- `DIRECT_CAPACITY`：直接容量推理可放置星
- `SINGLE_LOCK_CHAIN`：单一类型锁链
- `MULTI_LOCK_CHAIN`：多层锁链
- `MIXED_LOCK_CHAIN`：混合类型锁链
- `NO_BASIC_OPENING`：无直接开局推理

该体系在 D0.5 起标记为 **legacy/advisory**。旧 lock 事件没有完整传播证明，
opening 与 difficulty 只用于历史对照和候选检索，不得单独放行或拒绝 D1。

## 7. Legacy Difficulty 评估

综合评分维度（满分 100）：
- 开局推理可用性（0-30）
- 锁定复杂度（0-25）
- 传播深度（0-20）
- 棋盘尺寸（0-15）
- 约束类型切换（0-10）

难度 band：
- `intro`（≤15）
- `basic`（≤30）
- `intermediate`（≤50）
- `advanced`（≤70）
- `expert`（>70）

该分数同样是 advisory，不等于玩家难度，也不等于基础规则可解。

## 8. 可证明的人类逻辑

`scripts/star-double-human-logic.mjs` 在 scripts 层独立分析，不修改游戏运行时。
唯一解求解器只负责最终验证，不能产生玩家 deduction。

安全规则：

- `QUOTA_SATURATED`：单位达到 2 星后排除其余格
- `ADJACENCY_EXCLUSION`：星点八邻域排除
- `REMAINING_CAPACITY`：候选数等于剩余额度时置星
- `CONFINED_CAPACITY`：source 候选完全受限于 target，且两者剩余额度相等
- `TWO_BY_TWO_CAPACITY`：以 2×2 至多一星和可复核 block cover 产生排除
- `MULTI_UNIT_CONFINEMENT`：两个同类 source units 的全部候选被两个 target
  units 包含，且两边剩余额度总和严格相等
- `PRESSURED_GROUP_EXCLUSION`：剩余 quota 为 2 的单位可被两个容量为 1 的
  冲突组覆盖；由此排除与整组冲突的外部格，单格组可直接置星

两条 D0.7 规则都使用固定搜索预算：

- multi-unit 只搜索 2 source × 2 target，最多检查 20,000 个组合
- pressured-group 最多 8 个候选、每组最多 4 格、每单位最多检查 128 个划分
- 多个证明只保留一个最小且稳定的 canonical proof，并记录被合并的证明数量

不支持分支、猜测、反证或“因为答案唯一所以放这里”。

分析结果：

- `SOLVED_SUPPORTED_RULES`：当前安全规则可完整推导
- `STALLED_SUPPORTED_RULES`：无下一步；不表示玩家应该猜
- `UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET`：求解器证明唯一，但当前人类规则集不足
- `CONTRADICTION`：状态、事件或已知解一致性冲突
- `INVALID_INPUT`：输入结构非法
- `TRACE_LIMIT_REACHED`：到达固定传播上限

每个事件保存规则版本、动作、格子、来源单位、证据格、依赖、传播深度、
完整 proof 和输入状态 hash。分析同时输出：

- `canonicalPath`：固定排序的一条可回放路径
- `deductionWaves`：同一状态下可同时成立的事件集合

自动 deduction 必须能完整回放，并保持 UNKNOWN 单调减少。

## 9. 推理指纹

精确调试指纹用于复现：

- 完整 canonical path
- exact trace hash
- deduction wave hash

归一化体验指纹用于玩家重复风险：

- 尺寸、开局技术
- 绝对屏幕位置与 D4 canonical 位置
- 首颗星前 deduction 数、首颗星深度
- 主导技术、按 wave 归一化的技术序列和切换次数
- 最大传播深度、独立开局数量
- 排除/置星比例、收尾占比
- 最终分析状态

同层事件顺序和内部 event ID 不影响体验指纹。绝对视角与 D4 视角同时保留，
尺寸变化本身不作为玩法变化。

## 10. Duplicate 与 Similarity 门禁

### Exact Duplicate

- exact region → 硬拒绝
- D4 region → 硬拒绝
- exact normalized reasoning fingerprint → 硬拒绝
- 9×9/10×10 exact solution → 硬拒绝
- 9×9/10×10 D4 solution → 硬拒绝

8×8 exact/D4 solution 暂时只告警并进入人工复核。同一 exact solution 在未来
D1 最多 2 次、不得相邻、至少间隔 3 关；归一化推理指纹必须不同，且开局技术、
绝对位置、首颗星深度至少两项不同。

连续数值 region similarity 第一版只报告分布、告警和排序，不固化 0.75/0.80/0.90
为长期产品标准。

nearest 指标统一使用“solution 相似度最大值”：

- `nearestSolutionSimilarity`：0 表示没有共同星位，1 表示完全相同
- `avgNearestNeighborSimilarity`：每个候选最近邻相似度的平均值

不再使用含义不明的 `nearestSimilarityScore`。

## 11. 序列级门禁

未来 10 关序列独立检查：

- 相邻 opening fingerprint 不得完全相同
- dominant technique 不得连续超过 2 关
- 任意 4 关至少有 3 种 opening/dominant experience
- 同尺寸不得连续超过 2 关
- 9×9/10×10 solution 重复拒绝
- 8×8 同解例外必须满足次数、间隔和体验差异
- 不得连续出现基础规则无法完成的关卡

D1 第一轮试产尺寸目标为 8×8 / 9×9 / 10×10 = 3 / 5 / 2，初始顺序：

`8, 9, 8, 9, 10, 9, 8, 9, 9, 10`

该顺序可以被实际候选分析结果推翻，不是永久规则。

## 12. 批次生产与固定试验

```bash
# 生成 8×8 候选
node scripts/star-double-generator.mjs --size 8 --count 6 --seed 42 --output double-8x8-batch.json

# 也可通过统一生成器
node scripts/generate-star-line-candidates.mjs --mode starDouble --size 8 --count 6 --seed 42 --output double-8x8.json

# D0.5 固定预算试验；配置写死，输出仅进入 /tmp
npm run trial:star-double-d0-5

# D0.7 固定 48 候选 paired motif 试验；输出仅进入 /tmp
npm run trial:star-double-d0-7

# D0.8 固定 48 候选 region optimizer 试验；输出仅进入 /tmp
npm run trial:star-double-d0-8
```

选项：
- `--size`：8、9 或 10
- `--count`：目标候选数量
- `--seed`：整数种子
- `--output`：输出文件名（`tmp/star-line-candidates/` 下）
- `--force`：覆盖已有文件
- `--max-total-attempts`：最大总尝试次数

固定试验只允许运行一次既定 seed 体系，不因结果不理想更换 seed 或扩大矩阵。
输出位置：

`/tmp/star-double-d0-5-production-trial.json`

D0.7 paired trial 输出位置：

`/tmp/star-double-d0-7-paired-trial.json`

D0.8 optimizer trial 输出位置：

`/tmp/star-double-d0-8-optimizer-trial.json`

结论只能是：

- A：现有 generator + 人类逻辑筛选足够
- B：需要局部 region fragment / motif
- C：需要人工母题 + 自动变异
- D：需要重构 generator

### D0.5 固定试验结果（seed 20260723）

本次试验只运行一套固定 seed，没有调阈值、换 seed 或扩大矩阵。

| 尺寸 | candidate calls | generator attempts | UNIQUE | 基础规则完整可解 | 超出规则集 | normalized fingerprint | exact / D4 solution |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8×8 | 40 | 194 | 40 | 1 | 39 | 20 | 2 / 1 |
| 9×9 | 50 | 1333 | 50 | 0 | 50 | 34 | 47 / 30 |
| 10×10 | 35 | 6466 | 30 | 0 | 30 | 20 | 30 / 30 |

10×10 有 5 次 candidate call 在单次 500 attempts 上限内未产出，其余尺寸没有
generation failure。所有已分析 trace 均可回放，未出现 solution 一致性错误。

固定池无法组成满足门禁的 10 关：

- 8×8 只有 1 个基础规则完整可解候选，且 40 个候选中有 38 次 exact solution 重复
- 9×9、10×10 没有基础规则完整可解候选
- 搜索没有触及 50,000 nodes 上限；失败原因是候选资格不足，不是搜索超时

本轮路线结论为 **B：需要局部 region fragment / motif**。证据表明 generator
仍能稳定提供 UNIQUE 候选，当前主要缺口是可连续传播的安全逻辑链。D1 暂不能开始；
下一轮应在不改变运行时规则的前提下，验证少量可证明 motif 是否能提高
`SOLVED_SUPPORTED_RULES` 通过率。若局部 motif 仍不能提供足够体验差异，再另行评估 C。

### D0.7 安全规则与 paired motif 试验（seed 20260723）

D0.7 使用 D0.6 完全相同的 48 个固定候选，每个源候选最多尝试：

- `MULTI_UNIT_CONFINEMENT_MOTIF`：2 个确定性变体
- `PRESSURED_GROUP_MOTIF`：2 个确定性变体
- 每个变体最多修改共享边界上的 4 个非解星格
- 每个候选变体只应用一种 motif

模块位于 `scripts/star-double-region-motifs.mjs`，是生成后的独立、可选后处理，
不修改 generator 核心。每个变体都重新验证 region 连通、每区两颗声明解星、
Solver UNIQUE、声明解一致、目标事件实际进入前两个 wave，以及完整 trace 安全回放。

正式化后的阶段 A 在相同 58 个盘面上得到：

- `SOLVED_SUPPORTED_RULES`：2（正式关 `star-lv-24`、10×10 固定候选 i15）
- `UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET`：56
- 0 个不安全事件，0 个回放失败
- 与 D0.6 临时 R2 的两个完整解一致

固定 paired trial 只运行一次：

| Motif | 变体 | EVENT_TRIGGERED | PROPAGATION_GAIN | FULLY_SOLVED |
| --- | ---: | ---: | ---: | ---: |
| Multi-unit confinement | 33 | 33 | 28 | 4 |
| Pressured group | 17 | 17 | 3 | 0 |
| 合计 | 50 | 50 | 31 | 4 |

50 个变体全部保持 UNIQUE 并通过安全回放，但完整解出的 4 个全部是 8×8。
9×9 和 10×10 虽能出现新入口或后续传播，本轮都没有新增完整解。

多样性结果：

- 50 个 exact / D4 region 均不同
- 39 个 normalized reasoning fingerprint
- 13 个 exact solution、11 个 D4 solution
- 30 个 8×8 变体只有 2 个 exact solution、1 个 D4 solution；motif 不增加答案空间

序列结果：

- 确定性去除硬重复后，只有 4 个候选进入序列池：8×8 三个、10×10 一个
- 严格 3/5/2 顺序最大只能组成 1 关，缺少全部 5 个 9×9 和另 1 个 10×10
- 放宽尺寸比例、但不放宽重复门禁时，最大只能组成 2 关

因此 D0.7 路线结论为 **B-PARTIAL**：

- 局部 motif 已证明可以稳定制造真实入口，并在部分盘面产生连续传播
- 当前 4 格局部边界不足以稳定制造跨尺寸完整逻辑链
- pressured-group 大量被基础规则覆盖或只产生孤立排除，不应按事件数判断成功
- 不扩大搜索预算、格子上限或 seed 矩阵
- D1 仍不能开始；下一轮应评估更完整的局部结构、另一条有真实证据的安全规则，
  或升级路线 C，而不是直接重构 generator

### D0.8 停滞驱动 Region Optimizer（seed 20260723）

模块位于 `scripts/star-double-region-optimizer.mjs`，是 generator 之后的独立后处理，
不修改生成器核心，也不预置新的 motif。它先让当前人类逻辑传播到第一次停滞，
再根据最后有效 wave、最受限单位、接近成立的安全规则结构和 UNKNOWN 集中区，
确定一个固定局部边界区：

- 8×8 最多 18 格
- 9×9 最多 22 格
- 10×10 最多 26 格

停滞定位和局部区选择不接收 solution。solution 只在一个 mutation 已经生成后，
用于拒绝移动解星、验证每区仍有两颗解星，并由 Solver 复核唯一性。每个原子操作
只允许一格跨正交共享边界改变所属 region；donor 和 receiver 在每一步后都必须连通。

搜索按固定三档递进：

| Tier | 最多移动格 | 每来源最多合法状态 | 进入条件 |
| --- | ---: | ---: | --- |
| 1 | 4 | 80 | 所有来源 |
| 2 | 8 | 160 | Tier 1 有可观察改善且尚未完整解 |
| 3 | 12 | 240 | Tier 2 达到显著传播改善且尚未完整解 |

同一个 exact 或 D4 canonical region 状态不会重复分析。候选使用固定字典序目标：
完整解、唯一且安全回放、停滞阶段、已置星数、wave 数、完成度、安全 deduction 数、
独立入口数、较少移动格、较小结构扰动。不会为了“看起来更不同”牺牲前面的门槛。

每个保留结果记录：

- 原始/优化后 trace 与指纹
- 固定 mutation zone
- 每一步 mutation history
- 每次最佳目标变化
- solver 与 trace 回放结果
- 新 deduction 中与 mutation 直接或依赖关联的事件
- 最终分类与停止原因

固定试验与 D0.6/D0.7 使用完全相同的 48 个候选，D0.5 基线签名核对 48/48
通过。本次只运行一次，没有换 seed、调整阈值或扩大矩阵。

| 尺寸 | 来源 | 原始停滞阶段（开/早/中/解） | 平均 zone | Tier 1/2/3 进入 | 合法状态 | 保留完整解 | 新增完整解 | 保留传播增益 | 平均移动 / 最大 | 平均完成度增益 | 平均 wave 增益 | 运行时间 |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8×8 | 16 | 10/5/1/0 | 18 | 16/4/2 | 949 | 13 | 13 | 2 | 2.44 / 7 | +0.8008 | +5.6250 | 55.2 秒 |
| 9×9 | 16 | 11/2/3/0 | 22 | 16/11/10 | 2,699 | 7 | 7 | 8 | 4.25 / 9 | +0.5494 | +5.4375 | 254.8 秒 |
| 10×10 | 16 | 12/0/3/1 | 26 | 16/14/14 | 5,818 | 1 | 0 | 11 | 6.81 / 12 | +0.2344 | +2.5000 | 1,026.9 秒 |

批次总计：

- 38,315 次原子 mutation 尝试；其中 9,466 个合法状态进入 Solver
- 27,138 个 mutation 因连通、解星配额等硬条件被拒绝
- 1,361 个合法结构被 Solver 判为非唯一
- 9,514 次 Solver 调用、8,201 次人类逻辑分析
- wall-clock 约 22.95 分钟；10×10 占 optimizer 运行时间约 77%
- 48 个保留结果全部重新验证为 UNIQUE、安全回放且 mutation history 可复现
- 20 个来源由不完整推进为 `SOLVED_SUPPORTED_RULES`；加上原有 1 个，共 21 个完整解

相较 D0.7：

| 指标 | D0.7 paired motif | D0.8 optimizer |
| --- | ---: | ---: |
| 完整解结果 | 4 | 21 |
| 完整解尺寸覆盖 | 仅 8×8 | 8×8 / 9×9 / 10×10 |
| normalized fingerprint | 39 | 48 |
| 平均移动格 | 2.04 | 4.50 |

两列不是完全相同的样本单位：D0.7 统计每个 motif 变体，D0.8 每个来源只保留一个
最佳结果。因此它们用于判断路线变化，不作为同口径性能基准。

多样性和序列门禁仍然失败：

- 全部 48 个保留结果的 normalized fingerprint 都不同，exact/D4 region 也都不同
- 但 46/48 的 dominant technique 是 `TWO_BY_TWO_CAPACITY`
- 21 个完整解的 dominant technique **全部**是 `TWO_BY_TWO_CAPACITY`
- 8×8 仍只有 2 个 exact solution、1 个 D4 solution；optimizer 不增加答案空间
- 可单独进入序列候选池的完整解为 8×8 十三个、9×9 七个、10×10 一个
- 严格 3/5/2 顺序搜索 1,196 nodes，最大只能组成 2 关
- 放宽顺序但保持 3/5/2 比例和全部门禁时搜索 5,457 nodes，最大仍为 2 关
- 两次搜索都未触及 50,000 nodes 上限；失败不是搜索超时
- 主要阻塞为 dominant technique 连续超过两关、8×8 同解间隔和体验差异；
  此外 10×10 只有一个完整解，本身也不足 2 关目标

因此 D0.8 路线结论为 **OPTIMIZER_PARTIAL**：

- optimizer 显著改善“能否由当前安全规则完整推导”，尤其是 8×8 和 9×9
- 它没有解决“连续 10 关体验不重复”；exact fingerprint 不同不能替代序列体验门禁
- 10×10 搜索成本最高、完整解增益最低，不适合作为当前路线的主要生产来源
- D1 正式产关仍不能开始
- 下一步应人工审核本批完整 trace，判断 dominant technique 集中是规则指纹表达问题、
  zone/objective 偏置，还是 generator 结构事实；在此之前不应继续扩大 optimizer 预算
- 若产品需要近期交付 Lv.11–20，应优先评估少量人工母题加自动变异，而不是把
  `OPTIMIZER_PARTIAL` 解释为自动生产已经通过

## 13. 正式入库前检查

1. Solver 确认唯一解
2. 人类逻辑状态为 `SOLVED_SUPPORTED_RULES`
3. deduction trace 完整回放且与唯一解一致
4. 不使用分支、反证或唯一性 deduction
5. 通过 exact/D4/reasoning duplicate 门禁
6. 通过 10 关序列门禁
7. 两名人工独立无提示求解通过
8. Validator 全项通过
9. 正式入库必须另开任务并明确授权

## 14. D0.8 范围

- ✅ 保留 D0 的 8×8、9×9、10×10 候选生成能力
- ✅ 建立可证明、可回放的基础人类逻辑
- ✅ 建立 exact 与 normalized reasoning fingerprint
- ✅ 建立 batch 与 sequence 重复门禁
- ✅ 建立固定预算生产试验
- ✅ 正式化 multi-unit 与 pressured-group 两条安全规则
- ✅ 建立独立、确定、有界的局部 region motif 后处理原型
- ✅ 完成固定 48 候选 paired trial，并明确得到 B-PARTIAL
- ✅ 建立不依赖 solution 定位的停滞分析与固定局部 mutation zone
- ✅ 建立 4/8/12 格、80/160/240 合法状态的分级 region optimizer
- ✅ 建立 mutation history、目标历史、依赖 deduction 和停止原因记录
- ✅ 完成唯一一次固定 48 候选 optimizer trial，并明确得到 OPTIMIZER_PARTIAL
- ❌ 不新增正式关卡（Lv.11–60 待 D1+）
- ❌ 不修改现有 10 关双星数据
- ❌ 不修改运行时、UI、存档或进度
- ❌ 不重写 generator 核心

## 15. 后续计划

- **下一包**：人工审核 D0.8 的 21 个完整 trace 与序列阻塞，校准 dominant
  experience 定义，并决定是否升级为人工母题 + 自动变异
- **D1**：仅在新的生产门通过并经产品确认后生产 Lv.11–20
- **D2**：Lv.21–30（9×9 进阶）
- **D3**：Lv.31–40（10×10 高阶）
- **D4**：Lv.41–50
- **D5**：Lv.51–60
