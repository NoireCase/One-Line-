# Star Double 关卡生产系统 (Package D0)

> D0 建立双星生产工具底座，不新增正式关卡。后续 D1 起按 10 关批次推进 Lv.11–60。

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

## 3. Generator Family

生成器使用 **solution-first** 方法：

1. 生成合法星位（2/行、2/列、无邻接）
2. 每对星分配至一个区域（N 个区域，各 2 星）
3. 从种子星位出发平衡 BFS 生长区域
4. 应用单格对交换变异增加多样性
5. Solver 验证唯一解

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

## 6. Opening Taxonomy

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

## 7. Difficulty 评估

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

## 8. Duplicate 与 Similarity 门禁

### Exact Duplicate
- Solution 签名完全相同 → reject
- Canonical (D4) region 签名完全相同 → reject

### Near Duplicate
- 同 structural family + 同 opening family → near-duplicate 告警
- 批次内 nearest-neighbor 相似度报告

### 批次集中
报告维度：
- Family 分布
- Opening family 分布
- Difficulty band 分布
- Size 分布
- Nearest-neighbor similarity

## 9. 批次生产流程

```bash
# 生成 8×8 候选
node scripts/star-double-generator.mjs --size 8 --count 6 --seed 42 --output double-8x8-batch.json

# 也可通过统一生成器
node scripts/generate-star-line-candidates.mjs --mode starDouble --size 8 --count 6 --seed 42 --output double-8x8.json
```

选项：
- `--size`：8、9 或 10
- `--count`：目标候选数量
- `--seed`：整数种子
- `--output`：输出文件名（`tmp/star-line-candidates/` 下）
- `--force`：覆盖已有文件
- `--max-total-attempts`：最大总尝试次数

## 10. 正式入库前检查

1. Solver 确认唯一解
2. 两名人工独立无提示求解通过
3. Structural family 和 opening family 与相邻关不同
4. Canonical region signature 不与现存关重复
5. D4 相似度与现存同尺寸关卡 < 0.90
6. Validator 全项通过
7. 正式入库必须另开任务并明确授权

## 11. D0 范围

- ✅ 建立 8×8、9×9、10×10 双星生成能力
- ✅ 建立开局分类和难度评估
- ✅ 建立重复度与多样性门禁
- ✅ 建立批次生产 CLI
- ✅ 建立定向测试
- ❌ 不新增正式关卡（Lv.11–60 待 D1+）
- ❌ 不修改现有 10 关双星数据

## 12. 后续计划

- **D1**：Lv.11–20（首批 10 关，8×8 为主）
- **D2**：Lv.21–30（9×9 进阶）
- **D3**：Lv.31–40（10×10 高阶）
- **D4**：Lv.41–50
- **D5**：Lv.51–60
