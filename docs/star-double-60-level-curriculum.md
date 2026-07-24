# Star Double 60 关课程编排

## 固定边界与统计

- 8×8：Lv.1–30，26 关可玩、4 个保留位。
- 9×9：Lv.31–50，11 关可玩、9 个保留位。
- 10×10：Lv.51–60，4 关可玩、6 个保留位。
- 来源：10 个新教学关、10 个既有正式关、21 个正式化候选，共 41 关。
- 保留位共 19 个，只存在于课程规划，不进入导航、进度或存档。
- 尺寸边界按 30 / 20 / 10 配置，为当前 26 / 11 / 4 个关卡分别保留 4 / 9 / 6 个扩展位置。

8×8 双星在现行规则下只有一个 D4 等价解类别，因此允许复用星位。8×8 的差异门由 region exact/D4、开局位置、归一化推理指纹、教学重点和完整 trace 共同保证。9×9 与 10×10 继续执行 exact/D4 solution 去重。

Lv.11 之后的难度分数综合 deduction wave 数、首颗星深度、技巧转换、开局直接结论数量和后半盘收束比例。同尺寸内按分数非递减排序；Lv.1–10 使用下文可回放的教学难度模型。尺寸顺序始终优先于分数。

## 60 槽目录

| Lv | 状态 | Level ID | 尺寸 | 来源 | 教学重点 | 分数 | Trace | 主要技巧 / 排序原因 |
|---:|---|---|---:|---|---|---:|---:|---|
| 1 | playable | star-double-tutorial-01 | 8×8 | tutorial-new | 认识双星规则 | 65.4 | 64 | 配额、八向禁邻、2×2；课程固定 |
| 2 | playable | star-double-tutorial-02 | 8×8 | tutorial-new | 星星周围排除 | 70.7 | 64 | 八邻格排除；课程固定 |
| 3 | playable | star-double-tutorial-03 | 8×8 | tutorial-new | 配额已经满足 | 74.0 | 64 | 配额收束；课程固定 |
| 4 | playable | star-double-tutorial-04 | 8×8 | tutorial-new | 剩余位置等于剩余星数 | 79.5 | 64 | 剩余容量；课程固定 |
| 5 | playable | star-double-tutorial-05 | 8×8 | tutorial-new | 已有一颗，寻找第二颗 | 84.1 | 64 | 单位内逐颗推进；课程固定 |
| 6 | playable | star-double-tutorial-06 | 8×8 | tutorial-new | 区域形状锁定 | 89.5 | 64 | 星域形状与2×2；课程固定 |
| 7 | playable | star-double-tutorial-07 | 8×8 | tutorial-new | 行列与星域交叉 | 97.3 | 64 | 跨单位观察；课程固定 |
| 8 | playable | star-double-tutorial-08 | 8×8 | tutorial-new | 两个位置必有一星 | 103.5 | 64 | 共同冲突排除；课程固定 |
| 9 | playable | star-double-tutorial-09 | 8×8 | tutorial-new | 连续传播 | 104.1 | 64 | 操作后重新扫描；课程固定 |
| 10 | playable | star-double-tutorial-10 | 8×8 | tutorial-new | 基础逻辑毕业关 | 105.8 | 64 | 综合基础规则；课程固定 |
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
| 2 | 规则认识：八邻格排除 | 2×2容量 48；剩余容量 16 | 64 | 9 | 6 | 33.3% | 9 | 0 | 100% | 70.7 | 首星延后两波，且不显示具体操作格。 |
| 3 | 规则认识：配额满足 | 2×2容量 47；剩余容量 16；配额满足 1 | 64 | 10 | 5 | 40.0% | 10 | 0 | 100% | 74.0 | 新增配额满足排除，传播增至十波。 |
| 4 | 基础独立：剩余位置 | 2×2容量 48；剩余容量 16 | 64 | 7 | 4 | 42.9% | 7 | 0 | 100% | 79.5 | 进入独立阶段；链较短，但不再依赖认识期引导。 |
| 5 | 基础独立：寻找第二颗 | 2×2容量 48；剩余容量 16 | 64 | 8 | 5 | 37.5% | 8 | 0 | 100% | 84.1 | 首星更晚，传播增加一波。 |
| 6 | 基础独立：区域形状 | 2×2容量 43；剩余容量 16；区域形状限制 5 | 64 | 10 | 5 | 50.0% | 10 | 5 | 100% | 89.5 | 首次加入区域形状限制和跨单位证明。 |
| 7 | 联动传播：行列星域交叉 | 区域形状 13；2×2容量 34；多单位联动 1；剩余容量 16 | 64 | 7 | 4 | 42.9% | 7 | 14 | 100% | 97.3 | 进入联动阶段，联动事件由 5 次升至 14 次。 |
| 8 | 联动传播：两位置必有一星 | 2×2容量 18；多单位联动 6；共同排除 10；邻接 3；区域形状 13；剩余容量 8；配额满足 6 | 64 | 8 | 3 | 50.0% | 8 | 29 | 100% | 103.5 | 加入共同排除，联动事件升至 29 次。 |
| 9 | 联动传播：连续传播 | 2×2容量 28；多单位联动 2；区域形状 6；共同排除 12；配额满足 12；剩余容量 4 | 64 | 8 | 3 | 62.5% | 8 | 20 | 100% | 104.1 | 不新增规则，难点转为连续重新扫描。 |
| 10 | 毕业：基础逻辑综合 | 多单位联动 4；2×2容量 36；共同排除 6；邻接 1；剩余容量 10；配额满足 5；区域形状 2 | 64 | 10 | 1 | 60.0% | 10 | 12 | 100% | 105.8 | 不新增规则；十波综合链，高于 Lv.9 且低于 Lv.11。 |

四阶段平均分依次为 `70.0 → 84.4 → 101.6 → 105.8`。阶段内分数均不下降；
Lv.10 低于 Lv.11–13 中最简单的 108.2。本轮审查没有发现需要修改 region 的异常尖峰。

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
- Lv.1–10 最大 D4 region geometry similarity 为 0.502（Lv.1/Lv.10）；
  最大归一化 trace LCS 相似度为 0.922（Lv.1/Lv.2），低于 0.95 明显重复门槛。
- 本轮只替换了 Lv.1–10 的占位难度分数并补齐证据，没有修改任何教学 region、
  solution、reasoning fingerprint 或教学脚本坐标。
- 10 个既有正式 ID 保留；21 个 `star-review-double-*` 来源映射为 `star-double-promoted-01`～`21`。
- `star-lv-21` 恢复自身数据身份并仅做有界生产优化；完整教学绑定 `star-double-tutorial-01`。
- 旧共享中断局先把旧数组索引还原为稳定 `star-lv-*` ID，再查找当前课程位置；
  课程重排不会把旧 `star-lv-21` 棋盘误接到新教学 Lv.1。
