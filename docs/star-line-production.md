# Star Line 关卡生产规范

> 本文档管理关卡生产，不定义玩家文案。玩家可见的 Star Line 规则、术语和单星 / 双星表达统一见 [`docs/game-explanation-system.md`](./game-explanation-system.md)：每行、每列、每片星域各放指定数量的星点；星点不能相邻。

## 1. ID 区间

| 区间 | gameId | 状态 |
|------|--------|------|
| star-lv-01 – star-lv-20 | starSingle | 已发布（不可变） |
| star-lv-21 – star-lv-30 | starDouble | 已发布（不可变） |
| star-lv-31 – star-lv-70 | starSingle | 预留（未生产） |
| star-lv-71 – star-lv-120 | starDouble | 预留（未生产） |

ID 格式：`star-lv-NN`（01-99 两位）或 `star-lv-NNN`（100-120 三位）。拒绝 `star-lv-1`、`star-lv-001` 等非规范格式。

## 2. gameId 与 quota 规则

- `gameId: 'starSingle'` → `starsPerRow = starsPerCol = starsPerRegion = 1`
- `gameId: 'starDouble'` → `starsPerRow = starsPerCol = starsPerRegion = 2`
- 三项 quota 必须一致，且仅为 1 或 2
- gameId 为玩法归属唯一权威来源，不依赖数组位置或 ID 数字

## 3. 旧30关不可变原则

star-lv-01 至 star-lv-30 的以下字段永久固定：
- id、N、regions、solution、starsPerRow/Col/Region、数组相对顺序

基线快照：`scripts/star-line-baseline.json`
Validator 每次运行时比对。任何玩法字段变化 → 验证失败。
补充生产元数据（gameId、techniqueTags、difficultyBand、teachingFocus）允许通过基线检查。

## 4. 候选工作区

**唯一允许输出路径：** `tmp/star-line-candidates/`

生成器和分析器使用共享安全模块 `scripts/lib/star-line-candidate-io.mjs`：
- 拒绝 `src/`、`scripts/`、`e2e/`、`docs/`、绝对路径、`../` 逃逸
- 原子写入（临时文件 + rename）
- 默认拒绝覆盖，`--force` 仅在候选目录内有效

## 5. 生成器

```bash
node scripts/generate-star-line-candidates.mjs \
  --mode starSingle \
  --size 5 \
  --count 10 \
  --seed 42 \
  --output single-5x5.json
```

- `--mode`: `starSingle` | `starDouble`
- `--size`: 5–10
- `--count`: 正整数
- `--seed`: 整数（可复现）
- `--force`: 允许覆盖候选目录内已有文件

**失败语义：** 生成不足 `--count` 个唯一解候选时，命令非零退出，不写完整候选文件。

**确定性：** 相同参数产生字节等价的输出。输出不含 `generatedAt`、`durationMs`、绝对路径等非确定字段。

## 6. 分析器

```bash
# 分析单个候选文件
node scripts/analyze-star-line-candidates.mjs --input tmp/star-line-candidates/single-5x5.json

# 与正式30关比较
node scripts/analyze-star-line-candidates.mjs --input tmp/star-line-candidates/single-5x5.json --compare
```

输出 JSON 报告（`-analysis.json`）和 Markdown 报告（`-analysis.md`）。

## 7. 签名定义

**solutionSignature:** `gameId:N:quota:sorted-indexes`
例：`starDouble:8:2:1,3,13,15,17,19,29,31,32,34,44,46,48,50,60,62`

**regionSignature:** `gameId:N:quota:canonical-grid`
对 regions 数组做 row-major 扫描，首次遇到的 label 映射为 0,1,2... 得到 canonical regions。

## 8. 相似度

**Solution Jaccard:** 星位集合的交集/并集。阈值 0.8。

**Region Pair Jaccard:** 对每个 region 结构构建同区无序格子对集合，计算交集/并集。label 不敏感。阈值 0.8。

告警级别：
- `identical-solution`：solution Jaccard = 1.0
- `identical-solution-and-regions`：solution + region pair Jaccard 均为 1.0
- `high-solution-similarity`：solution Jaccard ≥ 0.8 且 < 1.0
- `high-region-similarity`：region pair Jaccard ≥ 0.8 且 < 1.0
- `batch-duplicate`：同批候选 solution 签名相同

## 9. keep / review / reject

| 结论 | 条件 |
|------|------|
| **reject** | solver 非 unique、invalid-declared-solution、identical-solution-and-regions、结构非法 |
| **review** | identical-solution、high-solution-similarity、high-region-similarity、batch-duplicate、Solver 统计异常 |
| **keep** | unique + 声明与 Solver 一致 + 无阻塞 alert + 无高相似 alert |

分析器不自动删除、移动或修改候选。

## 10. 声明 solution 与 Solver 不一致

候选自带的 `solution` 与 Solver 唯一解按集合比较。不一致时：
- 增加 `invalid-declared-solution` 告警
- 结论强制 `reject`
- 所有签名和相似度使用 Solver 唯一解

## 11. 工具安全边界

- 生成器和分析器**不会**写入 `src/data/starLineLevels.js` 或任何正式源码
- 不会自动导入候选到正式数据
- 不会自动 commit
- 不会自动创建 PR

## 12. 正式入库前要求

1. Solver 确认唯一解
2. 两名人工独立无提示求解通过
3. 技巧标签人工核验
4. 与相邻正式关卡相似度检查通过
5. Validator 全项通过
6. 旧30关基线通过
7. 正式入库必须另开任务并明确授权

## 13. 约束

- 本轮尺寸上限：10×10
- 日月（sun-moon）和黑洞（black-hole）不在当前工具范围
- 不创建 progress v3
- v1 迁移映射永久固定为旧 0–29 索引

## 14. 清理

```bash
rm -rf tmp/star-line-candidates/
rm -rf tmp/star-line-candidates-test/
```
