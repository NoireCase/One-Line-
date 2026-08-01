# P4C 数字环线桌面技术裁决

> 本文档记录数字环线（界环谜阵旗舰玩法）桌面技术方向的 P4C 正式裁决。裁决依据：P4B 桌面 Edge/Input Spike 实现、聚焦测试、完整正式 E2E、用户桌面人工验收与独立最终复核（`PASS WITH NON-BLOCKING NOTES`）。
> 相关合同：`docs/digital-loop-edge-input-spike.md`；原型档案：`src/prototypes/digitalLoop/PROTOTYPE.md`。

## 1. 裁决

```text
GO WITH CHANGES
```

## 2. 裁决含义

- 数字环线**桌面**技术方向成立。
- P4B 已解除核心输入、方格几何和最小规则风险。
- **不需要返回输入 Spike**。
- 可以进入正式生产化工程。
- **不允许将整个 prototype 目录直接视为生产实现**：必须先提取通用 Edge Puzzle Foundation，再单独建设 Digital Loop Runtime / Validator。
- **不表示**正式玩法完成；**不表示**可以生产批量关卡；**不表示** Solver、Generator、移动端、对称分区或异形棋盘完成。
- 当前**不得注册 familyId 或 modeId**（界环谜阵第三卷工程注册另行决策）。

## 3. 晋升结论

| 原型模块 | P4C 结论 |
| --- | --- |
| `input/edgeState.js` | **可原样晋升**（生产通用层） |
| `input/edgeCoordinates.js` | **可原样晋升**（生产通用层） |
| `input/edgeGeometry.js` | **可原样晋升**（生产通用层，命中参数单一来源） |
| `input/hitTesting.js` | **修正后晋升**（删除重复参数与重复 Hover 谓词，参数由单一 layout 注入） |
| `input/gestureMachine.js` | **修正后晋升**（P2-1 按钮 Guard、P2-2 严格相邻、P2-3 生命周期；生产控制器不含 React / 诊断 / clue / completion / debug UI / Undo stack） |
| `input/undoTransactions.js` | 作为**通用 transaction 工具**晋升（本包不建立正式 Session undo stack） |
| `graph/edgeGraph.js` | **只晋升通用图原语**（degree / 连通分量 / 引用合法性 / key 规范化 / 图遍历辅助；不含环分类枚举） |
| `graph/diagnoseStructure.js` | 数字环线规则层，**不进入通用层**（留在原型） |
| `loopy/clueEvaluation.js` | 数字环线专属，**不进入通用层** |
| `loopy/evaluateCompletion.js` | 仅为 Spike 证据，**不作为完整生产 Validator** |
| `data/diagnosticBoards.js`、`components/DigitalLoopBoard.jsx`、`DigitalLoopPrototype.jsx`、`index.jsx` | 原型专用 |
| 移动端门禁（`main.jsx` / `DesktopOnlyNotice.jsx` / `src/utils/detectMobile.js`） | 正式全局代码，**继续保留** |

## 4. Package 1 必修问题

以下问题由 P4C 指定为生产化前必修，由 Package 1（Production Edge Puzzle Foundation）解决：

1. **P2-1 鼠标按钮 Guard**：中键（button 1）和侧键（button 3 / 4）不得进入 line 通道；统一在控制器入口忽略，不在接线层复制第二套事实源。
2. **P2-2 严格相邻**：连续笔划只允许写入与上一条已接受 Edge 共享顶点的 Edge；无相邻候选时 reject，不得回退到全候选池或最近非相邻 Edge。
3. **P2-3 活跃手势生命周期**：`lostpointercapture`、controller 销毁、Reset、场景切换和 `setPointerCapture` 失败必须安全取消活跃手势（回滚未提交变更、清理 preview / press 状态），不允许「棋盘已改但 transaction 未进入 Session」。
4. **原型不静态进入生产 bundle**：普通 App 启动不得静态加载 DigitalLoopPrototype，改为动态加载（异步 chunk）。
5. **状态词分离**：P4B 阶段状态（COMPLETE）与原型生命周期状态（Review / Accepted for extraction）必须分开，不得把 COMPLETE 新增为原型生命周期枚举。
6. **测试进入 CI**：生产纯函数测试与 `detectMobile` 测试必须接入 npm script 与 Quality Gate（秒级，不重复浏览器 E2E）。

## 5. 后续路线

```text
Package 1：Production Edge Puzzle Foundation（本包）
→ Package 2：Digital Loop Runtime / Validator
→ Package 3：Solver 与正式关卡格式
→ Package 4：5–10 关真实试玩包
→ 再独立评估方格版对称分区
```

每个包单独立项、单独验收；本裁决不预填任何后续包的结论。

## 6. 非阻断观察项（P4B 合并时记录，供后续包处理）

- 中键 / 侧键按钮行为（已由 P2-1 处理）。
- 相邻 Edge 约束 fallback（已由 P2-2 处理）。
- 活跃手势清理（已由 P2-3 处理）。
- 原型 playtest URL 生产可达性与静态进 bundle（已由「原型动态加载」处理；生产可达性规则保持 DEV / playtest 门槛不变）。
- 生命周期词汇表（Package 1 文档对齐时处理）。
- 原型纯函数测试接入 CI（已由 P2-6 / Package 1 处理）。
