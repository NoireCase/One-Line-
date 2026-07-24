# Star Double 60 关课程编排

## 固定边界与统计

- 8×8：Lv.1–30，26 关可玩、4 个保留位。
- 9×9：Lv.31–50，11 关可玩、9 个保留位。
- 10×10：Lv.51–60，4 关可玩、6 个保留位。
- 来源：10 个新教学关、10 个既有正式关、21 个正式化候选，共 41 关。
- 保留位共 19 个，只存在于课程规划，不进入导航、进度或存档。
- 尺寸边界按 30 / 20 / 10 配置，为当前 26 / 11 / 4 个关卡分别保留 4 / 9 / 6 个扩展位置。

8×8 双星在现行规则下只有一个 D4 等价解类别，因此允许复用星位。8×8 的差异门由 region exact/D4、开局位置、归一化推理指纹、教学重点和完整 trace 共同保证。9×9 与 10×10 继续执行 exact/D4 solution 去重。

难度分数综合 deduction wave 数、首颗星深度、技巧转换、开局直接结论数量和后半盘收束比例。同尺寸内按分数非递减排序；Lv.1–10 由课程目标固定顺序，尺寸顺序始终优先于分数。

## 60 槽目录

| Lv | 状态 | Level ID | 尺寸 | 来源 | 教学重点 | 分数 | Trace | 主要技巧 / 排序原因 |
|---:|---|---|---:|---|---|---:|---:|---|
| 1 | playable | star-double-tutorial-01 | 8×8 | tutorial-new | 认识双星规则 | 81 | 64 | 配额、八向禁邻、2×2；课程固定 |
| 2 | playable | star-double-tutorial-02 | 8×8 | tutorial-new | 星星周围排除 | 82 | 64 | 八邻格排除；课程固定 |
| 3 | playable | star-double-tutorial-03 | 8×8 | tutorial-new | 配额已经满足 | 83 | 64 | 配额收束；课程固定 |
| 4 | playable | star-double-tutorial-04 | 8×8 | tutorial-new | 剩余位置等于剩余星数 | 84 | 64 | 剩余容量；课程固定 |
| 5 | playable | star-double-tutorial-05 | 8×8 | tutorial-new | 已有一颗，寻找第二颗 | 85 | 64 | 单位内逐颗推进；课程固定 |
| 6 | playable | star-double-tutorial-06 | 8×8 | tutorial-new | 区域形状锁定 | 86 | 64 | 星域形状与2×2；课程固定 |
| 7 | playable | star-double-tutorial-07 | 8×8 | tutorial-new | 行列与星域交叉 | 87 | 64 | 跨单位观察；课程固定 |
| 8 | playable | star-double-tutorial-08 | 8×8 | tutorial-new | 两个位置必有一星 | 88 | 64 | 共同冲突排除；课程固定 |
| 9 | playable | star-double-tutorial-09 | 8×8 | tutorial-new | 连续传播 | 89 | 64 | 操作后重新扫描；课程固定 |
| 10 | playable | star-double-tutorial-10 | 8×8 | tutorial-new | 基础逻辑毕业关 | 90 | 64 | 综合基础规则；课程固定 |
| 11 | playable | star-double-promoted-03 | 8×8 | promoted-candidate | 综合运用 | 108.2 | 64 | 同尺寸综合难度排序 |
| 12 | playable | star-lv-22 | 8×8 | existing-official | 综合运用 | 108.6 | 64 | 同尺寸综合难度排序 |
| 13 | playable | star-double-promoted-02 | 8×8 | promoted-candidate | 综合运用 | 108.9 | 64 | 同尺寸综合难度排序 |
| 14 | playable | star-double-promoted-01 | 8×8 | promoted-candidate | 综合运用 | 109.2 | 64 | 同尺寸综合难度排序 |
| 15 | playable | star-double-promoted-12 | 8×8 | promoted-candidate | 综合运用 | 113.4 | 64 | 同尺寸综合难度排序 |
| 16 | playable | star-double-promoted-08 | 8×8 | promoted-candidate | 综合运用 | 113.8 | 64 | 同尺寸综合难度排序 |
| 17 | playable | star-double-promoted-07 | 8×8 | promoted-candidate | 综合运用 | 114.5 | 64 | 同尺寸综合难度排序 |
| 18 | playable | star-double-promoted-05 | 8×8 | promoted-candidate | 综合运用 | 119.3 | 64 | 同尺寸综合难度排序 |
| 19 | playable | star-double-promoted-10 | 8×8 | promoted-candidate | 综合运用 | 120.5 | 64 | 同尺寸综合难度排序 |
| 20 | playable | star-double-promoted-13 | 8×8 | promoted-candidate | 综合运用 | 120.8 | 64 | 同尺寸综合难度排序 |
| 21 | playable | star-lv-21 | 8×8 | existing-official | 综合运用 | 121.1 | 64 | 恢复正式关身份后排序 |
| 22 | playable | star-double-promoted-06 | 8×8 | promoted-candidate | 综合运用 | 127.7 | 64 | 同尺寸综合难度排序 |
| 23 | playable | star-double-promoted-04 | 8×8 | promoted-candidate | 综合运用 | 129.5 | 64 | 同尺寸综合难度排序 |
| 24 | playable | star-double-promoted-09 | 8×8 | promoted-candidate | 综合运用 | 129.5 | 64 | 同尺寸综合难度排序 |
| 25 | playable | star-double-promoted-11 | 8×8 | promoted-candidate | 综合运用 | 136.3 | 64 | 同尺寸综合难度排序 |
| 26 | playable | star-lv-23 | 8×8 | existing-official | 综合运用 | 148.7 | 64 | 8×8 小高峰 |
| 27 | reserved | — | 8×8 | reserved | 未来课程保留位 | — | — | 8×8 区间末尾 |
| 28 | reserved | — | 8×8 | reserved | 未来课程保留位 | — | — | 8×8 区间末尾 |
| 29 | reserved | — | 8×8 | reserved | 未来课程保留位 | — | — | 8×8 区间末尾 |
| 30 | reserved | — | 8×8 | reserved | 未来课程保留位 | — | — | 8×8 区间末尾 |
| 31 | playable | star-lv-24 | 9×9 | existing-official | 综合运用 | 118.1 | 81 | 尺寸优先，再按难度排序 |
| 32 | playable | star-double-promoted-17 | 9×9 | promoted-candidate | 综合运用 | 121.3 | 81 | 同尺寸综合难度排序 |
| 33 | playable | star-double-promoted-20 | 9×9 | promoted-candidate | 综合运用 | 122.8 | 81 | 同尺寸综合难度排序 |
| 34 | playable | star-double-promoted-16 | 9×9 | promoted-candidate | 综合运用 | 122.9 | 81 | 同尺寸综合难度排序 |
| 35 | playable | star-lv-26 | 9×9 | existing-official | 综合运用 | 124.5 | 81 | 同尺寸综合难度排序 |
| 36 | playable | star-double-promoted-18 | 9×9 | promoted-candidate | 综合运用 | 131.1 | 81 | 同尺寸综合难度排序 |
| 37 | playable | star-double-promoted-14 | 9×9 | promoted-candidate | 综合运用 | 132.4 | 81 | 同尺寸综合难度排序 |
| 38 | playable | star-lv-25 | 9×9 | existing-official | 综合运用 | 132.4 | 81 | 同尺寸综合难度排序 |
| 39 | playable | star-lv-27 | 9×9 | existing-official | 综合运用 | 142.6 | 81 | 同尺寸综合难度排序 |
| 40 | playable | star-double-promoted-19 | 9×9 | promoted-candidate | 综合运用 | 143.0 | 81 | 同尺寸综合难度排序 |
| 41 | playable | star-double-promoted-15 | 9×9 | promoted-candidate | 综合运用 | 145.6 | 81 | 9×9 小高峰 |
| 42 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 43 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 44 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 45 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 46 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 47 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 48 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 49 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 50 | reserved | — | 9×9 | reserved | 未来课程保留位 | — | — | 9×9 区间末尾 |
| 51 | playable | star-lv-28 | 10×10 | existing-official | 综合运用 | 129.8 | 100 | 尺寸优先，再按难度排序 |
| 52 | playable | star-lv-29 | 10×10 | existing-official | 综合运用 | 143.3 | 100 | 同尺寸综合难度排序 |
| 53 | playable | star-double-promoted-21 | 10×10 | promoted-candidate | 综合运用 | 164.9 | 100 | 同尺寸综合难度排序 |
| 54 | playable | star-lv-30 | 10×10 | existing-official | 综合运用 | 164.9 | 100 | 10×10 小高峰 |
| 55 | reserved | — | 10×10 | reserved | 未来课程保留位 | — | — | 10×10 区间末尾 |
| 56 | reserved | — | 10×10 | reserved | 未来课程保留位 | — | — | 10×10 区间末尾 |
| 57 | reserved | — | 10×10 | reserved | 未来课程保留位 | — | — | 10×10 区间末尾 |
| 58 | reserved | — | 10×10 | reserved | 未来课程保留位 | — | — | 10×10 区间末尾 |
| 59 | reserved | — | 10×10 | reserved | 未来课程保留位 | — | — | 10×10 区间末尾 |
| 60 | reserved | — | 10×10 | reserved | 未来课程保留位 | — | — | 10×10 区间末尾 |

## 前十关教学强度

| Lv | 新增知识 | 引导强度 | 玩家自主比例 | 只用已教学玩家规则 | 高级术语 |
|---:|---|---|---:|---|---|
| 1 | 完整双星规则与2×2 | 完整引导 + 三级提示 | 60% | 是 | 无 |
| 2 | 八邻格排除 | 说明 + 一次练习 | 70% | 是 | 无 |
| 3 | 配额已经满足 | 说明 + 一次练习 | 75% | 是 | 无 |
| 4 | 剩余容量 | 说明 + 一次练习 | 75% | 是 | 无 |
| 5 | 寻找第二颗 | 说明 + 一次练习 | 80% | 是 | 无 |
| 6 | 区域形状锁定 | 开局介绍 | 85% | 是 | 无 |
| 7 | 行列星域交叉 | 开局介绍 | 85% | 是 | 无 |
| 8 | 两位置共同排除 | 开局介绍 | 90% | 是 | 无 |
| 9 | 连续传播 | 开局介绍 | 90% | 是 | 无 |
| 10 | 基础逻辑综合 | 仅延迟分级提示 | 100% | 是 | 无 |

门禁会按每一课截至当时已教学的规则建立白名单并重新回放。Lv.2–5
在同一固定候选上各做了不超过两格的有界 region 调整，使它们无需提前调用
Lv.6–8 的跨单位规则即可完整解出。默认完整分析仍可记录同一结论的其他严格证明，
但玩家文案不显示内部术语。

## 门禁结论

- 41 关全部区域连通、唯一解、`SOLVED_SUPPORTED_RULES` 且 deduction trace 可回放。
- 所有 playable 的 exact region 与 D4 region 均不重复，归一化推理指纹与
  exact trace hash 均不同；相邻 8×8 的开局技术、D4 位置和首星深度组合不重复。
- 9×9、10×10 的 exact solution 与 D4 solution 均不重复。
- 8×8 复用唯一 D4 星位类别，但 region、开局、课程重点和完整推理路径不同。
- Lv.1–10 均通过“仅启用截至本课已教学规则”的受限完整求解门禁。
- 10 个既有正式 ID 保留；21 个 `star-review-double-*` 来源映射为 `star-double-promoted-01`～`21`。
- `star-lv-21` 恢复自身数据身份并仅做有界生产优化；完整教学绑定 `star-double-tutorial-01`。
- 旧共享中断局先把旧数组索引还原为稳定 `star-lv-*` ID，再查找当前课程位置；
  课程重排不会把旧 `star-lv-21` 棋盘误接到新教学 Lv.1。
