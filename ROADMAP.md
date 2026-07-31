# ROADMAP

## 路线阶段

### P1：产品外壳与双家族入口（已完成 · v0.17–v0.19）

- Linebook 谜题书入口与产品外壳视觉统一。
- 桌面 Game Shell、HUD 与棋盘舞台层级统一。
- 首页双家族卡片（One Line / Star Line）与家族专属入口插画。
- 胜利遮罩防误触、Star Line 退出确认、Classic / Portal 桌面道具条恢复。

### P2：关卡选择页重构与全玩法状态体系（已完成 · v0.20–v0.27）

- 关卡选择页 V3.1 全面重构：5×2 十关固定网格、水平翻页、全屏连续夜色背景。
- 六种玩法统一关卡选择骨架和章节材质。
- 建立三套完成状态体系：正常首次推进、整体首次通关总览（sealed）、二次重玩（replay）。
- 重玩独立版本化存储（`cg_level_select_replay_v1`），按 modeId 隔离。
- 完成仪式（ceremony）：首次通关反向染金翻页动画。
- 六种规则签名动画系统。
- 主题变量体系，玩法间只换色相不换视觉强度。
- Star Line 游戏内规则反馈、结算时序、连续拖动排除/清除、20 步撤销。
- Star Double proof-driven 教学课程（Lv.1–10）完成并通过人工验收。
- 全项目游戏内键盘模式移除，关卡统一使用鼠标或触摸板。
- 项目健康整改 Package A/B/C 完成。
- 当前正式验证基线：默认完整 E2E 239/239、Curriculum E2E 14/14。

**P2 关键发布：**

- v0.20.0：关卡选择页重构（章节化、星轨、sealed 状态）
- v0.21.0：Star Line 游戏内规则反馈优化
- v0.22.0：游戏内核心流程一致性（Hidden 失败反馈、Star Line 结算时序、重新开始确认）
- v0.23.0：鼠标专用游戏输入系统（键盘模式移除、连续拖动、20 步撤销）
- v0.24–v0.26：项目健康整改 Package A/B/C、双星教学课程
- v0.27.0：关卡选择页 V3.1 家族化视觉与重玩体系

### P3A：家族规范化设计流程 + 新玩法接入合同 + 路线冻结（已完成）

- 建立 `docs/game-family-design-system.md` 作为玩法家族权威规范。
- 定义全局层、家族层、玩法层三级继承模型。
- 建立家族规范化设计流程（13 步）。
- 新玩法接入合同（产品/设计/工程/生产四维）。
- Go / No-Go 门槛。
- 输出 P3B 最小 runtime 接缝建议。
- 项目总览文档全面对齐 v0.27.0 真实状态。
- 过期和冲突文档修正。

### P3B：最小 runtime 接缝（Runtime 核心接缝 Implemented，待最终独立复核；工程包整体 PARTIAL）

**Runtime 核心接缝（已实施）：**
- `GAME_MODES` 是 mode、family、展示资格、排序与 runtime 的唯一权威来源；`GAME_FAMILIES` 和展示列表自动派生，排序字段不决定成员资格。
- runtime descriptor 使用 `{ board, session, interactions }`，真实决定棋盘、会话与 Hidden / Portal 行为。
- strict selector 与入口 fail-closed；unknown mode 不回退 Classic config、runtime 或存档 key。
- Star Line session adapter（`path: [0]` 兼容占位集中化）。
- Star Line session 生命周期 hook 独占 settle timer、generation/token、scheduled/committed guard、restart 与 leave cleanup。
- Should #3：关卡 schema 声明（`levelSchema`，已完成，文档性）。
- Should #4：输入能力声明（`inputCapabilities`，已完成，文档性）。
- mode / level / restart / leave / unmount 均使旧 session token 失效；重开继续清理当前 mode 持久化存档。
- 合同测试与生命周期 E2E 保护。
- P3B runtime 核心接缝已在 **PR #37** 合入（Merge commit `d802d37`）。

**Should 项状态（P4A 后更新）：**
- Should #5：教学接入注册 —— 仍未实施。
- Should #6：原型数据隔离约定 —— 已完成（P4A 冻结 [`docs/prototype-isolation-contract.md`](docs/prototype-isolation-contract.md) 为通用原型隔离合同）。

**P3B 约束：**
- 只拆真正阻碍新玩法原型的接缝。
- 不重写 App，不建立万能玩法框架。
- 不迁移无关存档，不重新设计 UI。
- 一次 PR 可完成，可单独回滚。

### Linebook 长期结构（四卷）

Linebook 是长期扩展的逻辑谜题合集。正式产品结构为四卷：

| 卷 | 家族 | 状态 |
| --- | --- | --- |
| 第一卷：线序谜阵 | One Line | 已确定（内容基本完成，当前重点是产品收口和体验优化，不继续增加第五种玩法） |
| 第二卷：星线谜阵 | Star Line | 已确定 |
| 第三卷：界环谜阵 | 英文暂定（Boundary Line / Loop Line） | 产品方向已确定；工程 registry 未注册 |
| 第四卷 | Coming Soon | 未确定（不命名、不立项；正式产品位，不是临时提示） |

**界环谜阵路线：**

- **数字环线**：强确认、旗舰、第一优先（对应 Loopy / Slitherlink；当前 P4B 的唯一实现目标）。
- **对称分区**：强候选、第二优先（对应 Galaxies / Tentai Show；排在数字环线之后评估；未来复用边缘画线输入底座）。
- 第三玩法：待定（候选可继续筛选：Shikaku、Nurikabe、Masyu、Castle Wall 或其他闭环或分区玩法）。
- 第四玩法：待定。

**当前明确不做（界环谜阵）：**

- 当前不开发对称分区。
- 当前不注册正式界环 familyId / modeId（英文家族名未冻结）。
- 当前不调整 Linebook 首页。
- 当前不确定第四家族。
- 当前不新增第三、第四个界环玩法。

### P4：数字环线边线输入 Spike（进行中 · 仅合同与原型，不进入正式生产）

玩法基线：**Loopy / Slitherlink-like 为主要规则参考**（沿网格边绘制单一连续闭合环、不允许分支与多环、数字格表示周边边数、单环与全部数字线索联合判定完成）。数字环线是**已确定的第三家族「界环谜阵」**的旗舰与第一优先玩法（产品家族已确定；工程 familyId / modeId 未注册）；对称分区（Galaxies / Tentai Show）是界环谜阵第二强候选玩法，**不进入 P4B**，但对通用边缘输入底座构成复用约束（不得硬编码 Loopy 规则）。

目标：尽早验证数字环线最大的工程风险——边线输入是否稳定；鼠标、触摸板、移动触摸是否可用；10×10、11×11 棋盘是否具备足够操作精度；三态边（undecided / line / excluded）与单环、断线、分支、多环是否可被可靠识别；**最小数字线索校验**能否证明它是 Loopy Spike 而非无规则画线板；第三类 board/runtime 是否能通过 P3B 接缝隔离接入；原型是否与正式玩法、存档、进度和玩家目录完全隔离。

- **P4A：数字环线边线输入 Spike 合同与原型隔离冻结（已完成）。** 交付 [`docs/prototype-isolation-contract.md`](docs/prototype-isolation-contract.md)（通用原型隔离合同，关闭 P3B Should #6）与 [`docs/digital-loop-edge-input-spike.md`](docs/digital-loop-edge-input-spike.md)（P4B 可执行合同：Loopy 玩法基线、坐标模型、三态 Edge State、Pointer 输入合同与三方案比较、拖动模式、命中区域、两层规则判定（结构诊断 + 数字线索）、诊断场景、验收表、输入/规则层解耦、测试预算、P4C 裁决）。
- **P4B：数字环线边线输入技术 Spike（未开始）。** 按 Spike 合同实施隔离原型，包含三态输入与最小数字线索校验；不注册任何正式 mode，不实现对称分区。
- **P4C：数字环线技术裁决（GO / GO WITH CHANGES / NO-GO）。** GO 表示数字环线输入方向成立、可进入后续完整数字环线原型、通用边缘输入底座没有明显阻碍后续对称分区复用；GO **不表示**数字环线正式上线、对称分区已经验证、界环谜阵四玩法已经完成、或 familyId / modeId 已正式注册。

明确：

- P4 不直接生产正式关卡或正式玩法；不注册正式 family/mode、不写正式存档与进度、不进入玩家目录。
- 数字环线通过后，后续路线是：完整数字环线原型 → Solver → Validator → 5–10 关原型 → 教学与人工试玩 → 再独立评估对称分区。
- P4 完成后仍需单独决定后续完整原型路线（完整数字环线原型另行立项与评审）。

### 候选与研究

以下仅为候选或研究项，尚未批准进入正式生产。

#### 日月小型原型

- Star Line 家族的可能扩展：继续复用 Star Line 页面骨架和规则签名画布。
- 仅填写家族内部的主题变量与节点关系。
- 不重新设计关卡卡片和布局。
- 需在 P3B 完成后评估，通过 Go/No-Go 评审后方可立项。

#### 其他未来探索

- Hidden 9×9 Hard / Master / EX（仅作为未来探索方向，不做当前版本计划）。
- Portal 玩法结构深化（继续评估是否扩展或保持小规模）。
- Star Line 高级规则变体（Q=3、Knight Shot、Ghost Regions 不进入当前主线）。

## 长期方向

- 完善各玩法的深度内容。
- 探索适合 One Line 的新路径规则。
- 保持专注于单机路径解谜体验。

## 暂不计划

- Daily Challenge
- 每日或每周任务
- 连续登录奖励
- 排行榜
- 赛季
- Battle Pass
- 社交系统
- 账号和网络同步
