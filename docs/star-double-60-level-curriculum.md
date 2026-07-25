# Star Double 60 关课程编排

## 固定边界与统计

- 60/60 均为可玩关，reserved 为 0。
- 8×8：Lv.1–30；9×9：Lv.31–50；10×10：Lv.51–60；尺寸不回退。
- 来源：10 个新教学关、10 个既有正式关、21 个正式化候选、19 个 generated-expansion。
- 8×8 因数学上只有一个 D4 solution 类别，允许复用答案星位；仍禁止 exact/D4 region、推理指纹和 trace 重复。9×9、10×10 继续禁止 exact/D4 solution 重复。
- 相邻近似门槛来自原 41 关同尺寸分布：region ≤ 0.50（基线 p95 0.478），trace LCS ≤ 0.78（基线 p95 0.750）。不是为本批次通过率临时调整。
- opening family 在技巧、首星深度、开局结论规模和 D4 位置形态上归类；任意连续五关同 family 最多两次。

## 60 关目录

| Lv | Level ID | 尺寸 | 来源 | 分数 | Trace | 波次 | Opening family | 主要技巧 | Seed/index | 排序原因 |
|---:|---|---:|---|---:|---:|---:|---|---|---|---|
| 1 | star-double-tutorial-01 | 8×8 | tutorial-new | 65.4 | 64 | 9 | TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed | 共同冲突排除、剩余位置收束 | — | 教学位置固定 |
| 2 | star-double-tutorial-02 | 8×8 | tutorial-new | 65.7 | 64 | 6 | TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread | 共同冲突排除、星域形状限制 | 20642868/i23 | 1 步进入八邻格 Guided |
| 3 | star-double-tutorial-03 | 8×8 | tutorial-new | 66.8 | 64 | 5 | TWO_BY_TWO_CAPACITY|opening-star|expansive|inner-spread | 共同冲突排除、配额已满 | 20560734/i0 | 2 步形成满额单位 |
| 4 | star-double-tutorial-04 | 8×8 | tutorial-new | 77.7 | 64 | 6 | TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread | 共同冲突排除、星域形状限制 | 20700332/i5 | 1 步进入剩余容量 |
| 5 | star-double-tutorial-05 | 8×8 | tutorial-new | 81.3 | 64 | 7 | TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread | 共同冲突排除、星域形状限制 | 20832011/i9 | 1 步进入寻找第二颗 |
| 6 | star-double-tutorial-06 | 8×8 | tutorial-new | 91.3 | 64 | 10 | TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact | 星域形状限制、共同冲突排除 | — | 保留布局，重写证明合同 |
| 7 | star-double-tutorial-07 | 8×8 | tutorial-new | 99.1 | 64 | 8 | TWO_BY_TWO_CAPACITY|opening-star|wide|edge-spread | 星域形状限制、共同冲突排除 | 20960746/i0 | 1 步进入多单位交叉 |
| 8 | star-double-tutorial-08 | 8×8 | tutorial-new | 103.5 | 64 | 8 | TWO_BY_TWO_CAPACITY|mid-star|broad|inner-spread | 共同冲突排除、星域形状限制 | — | 教学位置固定 |
| 9 | star-double-tutorial-09 | 8×8 | tutorial-new | 104.8 | 64 | 8 | CONFINED_CAPACITY|opening-star|wide|edge-spread | 星域形状限制、共同冲突排除 | 21192428/i4 | 三条前后依赖证明 |
| 10 | star-double-tutorial-10 | 8×8 | tutorial-new | 105.8 | 64 | 10 | MULTI_UNIT_CONFINEMENT|early-star|focused|center-spread | 共同冲突排除、剩余位置收束 | — | 教学位置固定 |
| 11 | star-double-promoted-02 | 8×8 | promoted-candidate | 109.4 | 64 | 5 | MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed | 星域形状限制、共同冲突排除 | — | 难度排序并通过相邻多样性门禁 |
| 12 | star-double-promoted-03 | 8×8 | promoted-candidate | 109.8 | 64 | 6 | TWO_BY_TWO_CAPACITY|early-star|wide|center-spread | 共同冲突排除、行列星域联动 | — | 难度排序并通过相邻多样性门禁 |
| 13 | star-double-promoted-01 | 8×8 | promoted-candidate | 110.0 | 64 | 5 | TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 14 | star-lv-22 | 8×8 | existing-official | 110.1 | 64 | 6 | TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 15 | star-double-promoted-08 | 8×8 | promoted-candidate | 112.0 | 64 | 6 | MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 16 | star-double-promoted-07 | 8×8 | promoted-candidate | 114.0 | 64 | 7 | TWO_BY_TWO_CAPACITY|early-star|broad|center-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 17 | star-double-promoted-12 | 8×8 | promoted-candidate | 114.1 | 64 | 7 | MULTI_UNIT_CONFINEMENT|early-star|broad|edge-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 18 | star-double-promoted-13 | 8×8 | promoted-candidate | 115.0 | 64 | 7 | TWO_BY_TWO_CAPACITY|early-star|narrow|inner-compact | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 19 | star-lv-21 | 8×8 | existing-official | 115.6 | 64 | 8 | CONFINED_CAPACITY|early-star|focused|edge-compact | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 20 | star-double-promoted-05 | 8×8 | promoted-candidate | 115.6 | 64 | 8 | TWO_BY_TWO_CAPACITY|early-star|focused|center-compact | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 21 | star-double-promoted-10 | 8×8 | promoted-candidate | 116.0 | 64 | 7 | MULTI_UNIT_CONFINEMENT|mid-star|focused|edge-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 22 | star-double-expansion-02 | 8×8 | generated-expansion | 118.3 | 64 | 8 | TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact | 共同冲突排除、星域形状限制 | 20260726/i7 | 难度排序并通过相邻多样性门禁 |
| 23 | star-double-expansion-04 | 8×8 | generated-expansion | 118.9 | 64 | 8 | TWO_BY_TWO_CAPACITY|early-star|narrow|edge-compact | 共同冲突排除、星域形状限制 | 20260726/i11 | 难度排序并通过相邻多样性门禁 |
| 24 | star-double-promoted-06 | 8×8 | promoted-candidate | 119.3 | 64 | 9 | TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact | 共同冲突排除、行列星域联动 | — | 难度排序并通过相邻多样性门禁 |
| 25 | star-double-expansion-01 | 8×8 | generated-expansion | 119.8 | 64 | 9 | TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed | 共同冲突排除、星域形状限制 | 20260726/i0 | 难度排序并通过相邻多样性门禁 |
| 26 | star-double-expansion-03 | 8×8 | generated-expansion | 120.5 | 64 | 10 | TWO_BY_TWO_CAPACITY|early-star|narrow|edge-mixed | 共同冲突排除、行列星域联动 | 20260726/i9 | 难度排序并通过相邻多样性门禁 |
| 27 | star-double-promoted-04 | 8×8 | promoted-candidate | 120.3 | 64 | 9 | TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 28 | star-double-promoted-09 | 8×8 | promoted-candidate | 121.5 | 64 | 9 | MULTI_UNIT_CONFINEMENT|early-star|focused|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 29 | star-double-promoted-11 | 8×8 | promoted-candidate | 126.1 | 64 | 12 | TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 30 | star-lv-23 | 8×8 | existing-official | 137.4 | 64 | 16 | TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 31 | star-double-expansion-09 | 9×9 | generated-expansion | 117.4 | 81 | 7 | TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread | 共同冲突排除、星域形状限制 | 20260726/i28 | 难度排序并通过相邻多样性门禁 |
| 32 | star-lv-24 | 9×9 | existing-official | 118.5 | 81 | 7 | CONFINED_CAPACITY|opening-star|broad|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 33 | star-double-expansion-08 | 9×9 | generated-expansion | 118.6 | 81 | 7 | CONFINED_CAPACITY|early-star|broad|inner-spread | 共同冲突排除、星域形状限制 | 20260726/i20 | 难度排序并通过相邻多样性门禁 |
| 34 | star-double-promoted-17 | 9×9 | promoted-candidate | 119.2 | 81 | 7 | TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 35 | star-lv-26 | 9×9 | existing-official | 119.8 | 81 | 8 | TWO_BY_TWO_CAPACITY|early-star|wide|center-spread | 共同冲突排除、行列星域联动 | — | 难度排序并通过相邻多样性门禁 |
| 36 | star-double-promoted-20 | 9×9 | promoted-candidate | 119.9 | 81 | 8 | CONFINED_CAPACITY|opening-star|wide|edge-spread | 星域形状限制、共同冲突排除 | — | 难度排序并通过相邻多样性门禁 |
| 37 | star-double-promoted-16 | 9×9 | promoted-candidate | 120.4 | 81 | 7 | TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 38 | star-double-expansion-05 | 9×9 | generated-expansion | 120.9 | 81 | 7 | TWO_BY_TWO_CAPACITY|early-star|broad|edge-mixed | 共同冲突排除、星域形状限制 | 20260726/i10 | 难度排序并通过相邻多样性门禁 |
| 39 | star-double-expansion-06 | 9×9 | generated-expansion | 122.6 | 81 | 10 | TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed | 共同冲突排除、剩余位置收束 | 20260726/i11 | 难度排序并通过相邻多样性门禁 |
| 40 | star-double-expansion-13 | 9×9 | generated-expansion | 123.9 | 81 | 10 | TWO_BY_TWO_CAPACITY|early-star|broad|edge-mixed | 共同冲突排除、星域形状限制 | 20260727/i7 | 难度排序并通过相邻多样性门禁 |
| 41 | star-double-promoted-18 | 9×9 | promoted-candidate | 125.4 | 81 | 10 | TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 42 | star-lv-25 | 9×9 | existing-official | 125.3 | 81 | 11 | TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed | 共同冲突排除、剩余位置收束 | — | 难度排序并通过相邻多样性门禁 |
| 43 | star-double-expansion-07 | 9×9 | generated-expansion | 125.5 | 81 | 10 | TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread | 星域形状限制、共同冲突排除 | 20260726/i13 | 难度排序并通过相邻多样性门禁 |
| 44 | star-double-expansion-11 | 9×9 | generated-expansion | 125.9 | 81 | 10 | TWO_BY_TWO_CAPACITY|opening-star|broad|edge-spread | 星域形状限制、共同冲突排除 | 20260726/i33 修复 | 难度排序并通过相邻多样性门禁 |
| 45 | star-double-promoted-14 | 9×9 | promoted-candidate | 126.2 | 81 | 9 | TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 46 | star-lv-27 | 9×9 | existing-official | 129.6 | 81 | 10 | TWO_BY_TWO_CAPACITY|mid-star|focused|edge-compact | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 47 | star-double-expansion-10 | 9×9 | generated-expansion | 129.9 | 81 | 12 | TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed | 共同冲突排除、星域形状限制 | 20260726/i29 | 难度排序并通过相邻多样性门禁 |
| 48 | star-double-promoted-19 | 9×9 | promoted-candidate | 130.3 | 81 | 12 | TWO_BY_TWO_CAPACITY|early-star|focused|center-compact | 星域形状限制、共同冲突排除 | — | 难度排序并通过相邻多样性门禁 |
| 49 | star-double-expansion-12 | 9×9 | generated-expansion | 130.6 | 81 | 10 | CONFINED_CAPACITY|early-star|narrow|center-mixed | 共同冲突排除、星域形状限制 | 20260727/i2 | 难度排序并通过相邻多样性门禁 |
| 50 | star-double-promoted-15 | 9×9 | promoted-candidate | 132.3 | 81 | 12 | TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 51 | star-lv-28 | 10×10 | existing-official | 127.6 | 100 | 8 | TWO_BY_TWO_CAPACITY|opening-star|expansive|center-spread | 星域形状限制、行列星域联动 | — | 难度排序并通过相邻多样性门禁 |
| 52 | star-double-expansion-16 | 10×10 | generated-expansion | 128.8 | 100 | 8 | TWO_BY_TWO_CAPACITY|opening-star|wide|edge-spread | 星域形状限制、共同冲突排除 | 20260726/i17 | 难度排序并通过相邻多样性门禁 |
| 53 | star-lv-29 | 10×10 | existing-official | 134.1 | 100 | 10 | TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread | 行列星域联动、共同冲突排除 | — | 难度排序并通过相邻多样性门禁 |
| 54 | star-double-expansion-14 | 10×10 | generated-expansion | 134.2 | 100 | 9 | TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread | 星域形状限制、共同冲突排除 | 20260726/i10 | 难度排序并通过相邻多样性门禁 |
| 55 | star-double-expansion-17 | 10×10 | generated-expansion | 134.7 | 100 | 9 | CONFINED_CAPACITY|early-star|wide|inner-spread | 星域形状限制、共同冲突排除 | 20260726/i18 | 难度排序并通过相邻多样性门禁 |
| 56 | star-double-expansion-19 | 10×10 | generated-expansion | 141.3 | 100 | 11 | TWO_BY_TWO_CAPACITY|early-star|broad|center-mixed | 星域形状限制、共同冲突排除 | 20260726/i28 修复 | 难度排序并通过相邻多样性门禁 |
| 57 | star-double-expansion-15 | 10×10 | generated-expansion | 145.7 | 100 | 14 | TWO_BY_TWO_CAPACITY|mid-star|broad|edge-mixed | 共同冲突排除、星域形状限制 | 20260726/i12 | 难度排序并通过相邻多样性门禁 |
| 58 | star-double-promoted-21 | 10×10 | promoted-candidate | 146.8 | 100 | 14 | MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed | 共同冲突排除、星域形状限制 | — | 难度排序并通过相邻多样性门禁 |
| 59 | star-lv-30 | 10×10 | existing-official | 148.6 | 100 | 15 | TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact | 星域形状限制、共同冲突排除 | — | 难度排序并通过相邻多样性门禁 |
| 60 | star-double-expansion-18 | 10×10 | generated-expansion | 147.7 | 100 | 14 | TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact | 共同冲突排除、星域形状限制 | 20260726/i26 修复 | 难度排序并通过相邻多样性门禁 |

## 三个尺寸内的完整难度曲线

Lv.1–10 使用 `src/data/starDoubleCurriculum.js` 中
`STAR_DOUBLE_TEACHING_DIFFICULTY_EVIDENCE` 的教学分数，并由
`npm run test:star-double-curriculum` 核验；Lv.11 后使用统一目录指标。每个非教学
尺寸段整体递增，允许最多 1.0 分的极小回摆以满足开局和主要技巧多样性。

- 8×8：65.4 → 65.7 → 66.8 → 77.7 → 81.3 → 91.3 → 99.1 → 103.5 → 104.8 → 105.8 → 109.4 → 109.8 → 110.0 → 110.1 → 112.0 → 114.0 → 114.1 → 115.0 → 115.6 → 115.6 → 116.0 → 118.3 → 118.9 → 119.3 → 119.8 → 120.5 → 120.3 → 121.5 → 126.1 → 137.4
- 9×9：117.4 → 118.5 → 118.6 → 119.2 → 119.8 → 119.9 → 120.4 → 120.9 → 122.6 → 123.9 → 125.4 → 125.3 → 125.5 → 125.9 → 126.2 → 129.6 → 129.9 → 130.3 → 130.6 → 132.3
- 10×10：127.6 → 128.8 → 134.1 → 134.2 → 134.7 → 141.3 → 145.7 → 146.8 → 148.6 → 147.7

## Opening family 分布

- `CONFINED_CAPACITY|early-star|broad|edge-mixed`：1
- `CONFINED_CAPACITY|early-star|broad|inner-spread`：1
- `CONFINED_CAPACITY|early-star|focused|edge-compact`：1
- `CONFINED_CAPACITY|early-star|narrow|center-mixed`：1
- `CONFINED_CAPACITY|early-star|wide|inner-spread`：1
- `CONFINED_CAPACITY|opening-star|broad|inner-mixed`：1
- `CONFINED_CAPACITY|opening-star|wide|edge-spread`：1
- `MULTI_UNIT_CONFINEMENT|early-star|broad|edge-mixed`：1
- `MULTI_UNIT_CONFINEMENT|early-star|focused|center-spread`：1
- `MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed`：3
- `MULTI_UNIT_CONFINEMENT|early-star|focused|inner-mixed`：1
- `MULTI_UNIT_CONFINEMENT|mid-star|focused|edge-mixed`：1
- `TWO_BY_TWO_CAPACITY|early-star|broad|center-mixed`：2
- `TWO_BY_TWO_CAPACITY|early-star|broad|edge-mixed`：3
- `TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed`：3
- `TWO_BY_TWO_CAPACITY|early-star|focused|center-compact`：2
- `TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact`：3
- `TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed`：3
- `TWO_BY_TWO_CAPACITY|early-star|focused|inner-mixed`：1
- `TWO_BY_TWO_CAPACITY|early-star|narrow|edge-compact`：1
- `TWO_BY_TWO_CAPACITY|early-star|narrow|edge-mixed`：1
- `TWO_BY_TWO_CAPACITY|early-star|narrow|inner-compact`：1
- `TWO_BY_TWO_CAPACITY|early-star|narrow|inner-mixed`：1
- `TWO_BY_TWO_CAPACITY|early-star|wide|center-spread`：2
- `TWO_BY_TWO_CAPACITY|mid-star|broad|edge-mixed`：1
- `TWO_BY_TWO_CAPACITY|mid-star|broad|inner-spread`：1
- `TWO_BY_TWO_CAPACITY|mid-star|focused|edge-compact`：1
- `TWO_BY_TWO_CAPACITY|mid-star|focused|edge-mixed`：1
- `TWO_BY_TWO_CAPACITY|mid-star|focused|inner-mixed`：1
- `TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact`：3
- `TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed`：3
- `TWO_BY_TWO_CAPACITY|opening-star|broad|edge-spread`：2
- `TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed`：3
- `TWO_BY_TWO_CAPACITY|opening-star|expansive|center-spread`：1
- `TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread`：3
- `TWO_BY_TWO_CAPACITY|opening-star|wide|edge-spread`：1
- `TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread`：2

## 主要技巧分布

- `ADJACENCY_EXCLUSION`：6
- `COMBINED_BASICS`：1
- `CONFINED_CAPACITY`：17
- `DOUBLE_STAR_RULES`：1
- `MULTI_UNIT_CONFINEMENT`：10
- `PRESSURED_GROUP_EXCLUSION`：5
- `PROPAGATION_CHAIN`：1
- `QUOTA_SATURATED`：13
- `REMAINING_CAPACITY`：6

## 新 19 关生成统计

- 8×8：4 关，seed 20260726，index 0、7、9、11。
- 9×9：9 关；seed 20260726 的 index 10、11、13、20、28、29、33（33 为 near-miss 二阶段修复），seed 20260727 的 index 2、7。
- 10×10：6 关，seed 20260726 的 index 10、12、17、18、26、28（26、28 为 near-miss 二阶段修复）。
- 阶段 A 共修复并入选 9×9 一关、10×10 两关；阶段 B 仅执行 9×9 seed 20260727 的 index 0–7，在得到两个新入选关后立即停止；未启动 10×10 seed 20260728。

## 前十关真实难度证明

计算口径：

- Trace 长度是限定规则 canonical path 中被确定为星或 X 的格子事件数。
- 首星深度从 0 开始；`0` 表示开局波即可确定星。
- Forced 比例是“包含确定星事件的波次 ÷ 总波次”。比例越低，玩家通常需要先完成更多排除。
- 最长链按 `prerequisiteEvents` 依赖关系计算，不使用 solution 反推。
- 联动次数只计算必须联合单位证明的 `CONFINED_CAPACITY`、`MULTI_UNIT_CONFINEMENT`
  和 `PRESSURED_GROUP_EXCLUSION`；玩家界面仍使用“星域形状”“行列星域交叉”
  和“两位置共同排除”等普通语言。
- “实际使用规则”记录确定性 canonical path 最终选择的证明。教学主题仍可通过玩家
  操作演示同一条安全规则；例如 Lv.2 会练习星周围排除，但空盘 canonical path 对
  相同格子优先记录了 2×2 与剩余容量证明。
- 提示前独立比例是 canonical trace 中未被教学直接显示操作格的比例。Lv.1 只直接显示
  八邻格，玩家仍需亲自操作；其余课程不预先显示答案格。
- 教学分数 = 阶段基准 + 阶段内位置×3 + 波次×0.5 + 首星深度×0.4
  + 最长链×0.5 + 联动次数×0.2 + `(1 - Forced比例)×5` + 独立比例×3。
  阶段基准依次为 50、65、80、88，用于表达累计知识负担；其余项全部来自受限 trace。

| Lv | 阶段 / 教学主题 | 实际使用规则（事件数） | Trace | 波次 | 首星深度 | Forced | 最长链 | 联动 | 提示前独立 | 分数 | 相比上一关 |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 规则认识：双星规则 | 2×2容量 48；剩余容量 16 | 64 | 9 | 4 | 55.6% | 9 | 0 | 87.5% | 65.4 | 基准课；完整引导只显示八邻格操作。 |
| 2 | 规则认识：八邻格排除 | 2×2容量 48；剩余容量 16 | 64 | 6 | 3 | 50.0% | 6 | 0 | 100% | 65.7 | 1 步真实放星后，亲手排除完整八邻格。 |
| 3 | 规则认识：配额满足 | 2×2容量 48；剩余容量 16 | 64 | 5 | 2 | 60.0% | 5 | 0 | 100% | 66.8 | 2 步真实放星形成满额单位。 |
| 4 | 基础独立：剩余位置 | 2×2容量 48；剩余容量 16 | 64 | 6 | 3 | 50.0% | 6 | 0 | 100% | 77.7 | Guided 与 Transfer 均由玩家放星。 |
| 5 | 基础独立：寻找第二颗 | 2×2容量 48；剩余容量 16 | 64 | 7 | 3 | 57.1% | 7 | 0 | 100% | 81.3 | 结合两个已学依据寻找第二颗。 |
| 6 | 基础独立：区域形状 | 2×2容量 34；区域形状 14；剩余容量 16 | 64 | 10 | 5 | 50.0% | 10 | 14 | 100% | 91.3 | 首次加入区域形状限制和跨单位证明。 |
| 7 | 联动传播：行列星域交叉 | 区域形状 18；2×2容量 28；多单位联动 2；剩余容量 16 | 64 | 8 | 4 | 50.0% | 8 | 20 | 100% | 99.1 | 两次真实多单位交叉结论。 |
| 8 | 联动传播：两位置必有一星 | 2×2容量 18；多单位联动 6；共同排除 10；邻接 3；区域形状 13；剩余容量 8；配额满足 6 | 64 | 8 | 3 | 50.0% | 8 | 29 | 100% | 103.5 | 加入共同排除，联动事件升至 29 次。 |
| 9 | 联动传播：连续传播 | 区域形状 18；2×2容量 18；多单位联动 4；共同排除 11；配额满足 7；邻接 1；剩余容量 5 | 64 | 8 | 0 | 75.0% | 8 | 33 | 100% | 104.8 | 三步证明严格前后依赖。 |
| 10 | 毕业：基础逻辑综合 | 多单位联动 4；2×2容量 36；共同排除 6；邻接 1；剩余容量 10；配额满足 5；区域形状 2 | 64 | 10 | 1 | 60.0% | 10 | 12 | 100% | 105.8 | 不新增规则；十波综合链，高于 Lv.9 且低于 Lv.11。 |

四阶段平均分依次为 `66.0 → 83.4 → 102.5 → 105.8`。阶段内分数均不下降；
Lv.10 低于 Lv.11–13 中最简单的 109.4。

门禁会按每一课截至当时已教学的规则建立白名单并重新回放。Lv.2–5
以及 Lv.7、Lv.9 使用固定种子从不同正式母版收缩一个或两个星域，Lv.6、Lv.8
保留原布局。所有候选仍通过唯一解、人类逻辑、trace 回放、exact/D4 与相邻
多样性门禁。默认完整分析可记录同一结论的其他严格证明，但玩家文案不显示内部术语。


## 门禁结论

- 60/60 区域连通、唯一解、`SOLVED_SUPPORTED_RULES`，canonical trace 可回放。唯一解只证明答案唯一；可玩性由人类逻辑门单独证明。
- exact region、D4 region、normalized reasoning fingerprint 和 exact trace 均为 60/60 唯一。
- 9×9、10×10 的 exact solution 与 D4 solution 均不重复；8×8 按数学例外执行。
- 相邻 opening signature 均不同；任意连续五关同 opening family 最多两次；相同 dominant technique 不连续超过两关。
- 相邻同尺寸最大 region similarity 为 0.458（门槛 0.50），最大 trace similarity 为 0.734（门槛 0.78）。
- Lv.1 核心体验、Lv.6/Lv.8/Lv.10 布局和 Lv.11–60 数据未修改；Lv.2–5、
  Lv.7、Lv.9 使用固定种子新布局。全部稳定 level ID 与进度映射不变。
- 生成 checkpoint 只用于来源审计，正式游戏只读取冻结的静态关卡数据。
