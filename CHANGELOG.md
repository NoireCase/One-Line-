# CHANGELOG

## v0.9.3

新增内容：

- Portal Mode 进度存档新增按 `level.id` 记录的结构。
- Portal Mode 最佳步数改为按 `level.id` 记录，降低关卡重排后的成绩错位风险。
- Portal 中途存档新增 `portalLevelId`，用于识别当前 Portal 关卡。

调整内容：

- Portal 星级 / 通关记录优先使用 `starsById[levelId]`。
- Portal 最佳步数优先使用 `portalBestSteps[diff][levelId]`。
- 旧 index 数组存档读取时会按当前 `PORTAL_LEVELS[index].id` 映射到新结构。
- Portal 最高解锁位置继续保留 index 结构，用于维持线性解锁顺序。

已知限制：

- 旧存档只能按当前关卡顺序做兼容映射，不能还原历史重排前的真实关卡 id。
- 旧的 Portal 中途存档如果没有 `portalLevelId`，仍只能按 `levelIdx` 兼容读取。
- 本版本只处理 Portal Mode，不修改 Classic、Diagonal 或 Daily Challenge。

## v0.9.2

新增内容：

- 整理 Portal Pack Alpha，共 9 个 `5x5` Hidden Portal 关卡。
- Portal 关卡顺序调整为更接近 Tutorial → Easy → Normal → Hard 的学习曲线。

调整内容：

- 将 Alpha 关卡纳入正式显示顺序。
- 去掉部分关卡名中的 `Alpha` 前缀，使关卡名称更适合玩家阅读。
- 保持所有 Portal 关卡的 `path`、`portals`、`hiddenVals` 和 `targetSteps` 不变。

已知限制：

- Portal Pack 仍是 Alpha 内容，不代表 v1.0 正式关卡包完成。
- 当前 9 个关卡均为 `5x5`，还没有扩展到 20+ 关。
- 关卡排序已优化，但仍需要继续通过试玩验证难度曲线。

## v0.9.1

新增内容：

- 新增 `docs/portal-mode-level-spec.md`，记录 Portal Mode 关卡生成规格。
- Portal Spec v1.1 明确 Hidden Portal 规则、Tutorial / Easy / Normal / Hard 难度标准和 Portal 角色分类。
- 新增 Bridge、Detour、Relay、Recovery、Region Switch 等 Portal 设计角色说明。

调整内容：

- 明确 Portal 数量只是难度参考，不直接决定难度。
- 明确 `targetSteps` 只用于星级评价，不用于难度判断。
- 明确关卡包排序应按玩家认知负担，而不是按 Portal 数量。

已知限制：

- Spec 是关卡生成和验收文档，不会自动保证现有关卡全部达到正式包标准。
- 当前实现尚未支持关卡描述字段，Portal 角色说明暂时只记录在文档层。

## v0.9.0

新增内容：

- 新增 Portal Mode MVP。
- 新增 Hidden Portal 规则：未访问显示 `?`，进入入口后高亮出口，玩家必须手动连接出口，已访问 Portal 显示路径数字。
- 新增 Portal Mode 独立进度、最佳步数和中途存档 key。
- 新增 Portal Mode 步数星级结算。

调整内容：

- Portal Mode 不使用 Classic combo 评分作为主要成绩。
- Portal Mode 使用步数、最佳步数和星级展示通关表现。
- Portal Mode 暂时作为独立模式接入，不进入 Daily Challenge。

已知限制：

- Portal Mode 仍是 MVP 阶段内容。
- 当前 Portal 关卡数量有限，主要用于验证 Hidden Portal 机制和关卡学习曲线。
- Portal Mode 暂未接入 Daily Challenge，也未提供云存档或排行榜。

## v0.8.1

- 将模式选择页从 `App.jsx` 拆出为 `src/components/ModeSelectPage.jsx`。
- 新增 `src/config/gameModes.js`，集中管理模式名称、说明、movement、关卡数量和本地存档 key。
- App 通过 `GAME_MODES` 读取 Classic / Diagonal 配置，减少模式文案和存档 key 硬编码。
- 未新增玩法、未新增关卡、未修改评分、未迁移存档。
- Classic / Diagonal 进度分离、Diagonal 旧存档兼容、Daily Challenge 使用 Diagonal 的行为保持不变。

## v0.8.0

- 新增 Classic 四方向模式第一版：只允许上下左右移动，不允许斜向移动。
- 新增模式选择流程，可在 Classic 与 Diagonal 之间选择。
- Classic 每个难度提供 5 个可玩关卡，共 15 个 Classic 关卡。
- 原有普通关卡归入 Diagonal 模式，继续使用旧的 `progress` / `highScores`，不强制迁移旧存档。
- Classic 使用独立本地存档 `cg_classic_progress` / `cg_classic_highscores`，中途存档使用 `cg_classic_saved_game`。
- Daily Challenge 暂时继续使用 Diagonal 关卡，不修改 `dailyChallenge` 存档结构。
- 评分公式、星级阈值、金币收益和 Score Report 展示保持不变。

## v0.7.2

- 新增结构化评分报告字段：完成分、时间加成、生命加成、连击加成、规则加成、总分和星级。
- WinPanel 结算面板展示评分明细，普通关卡和 Daily Challenge 共用同一报告结构。
- 当前规则加成为 0，并显示为暂未启用，为未来特殊规则奖励预留位置。
- 总分公式、星级阈值、金币收益、连击规则、时间加成和生命加成数值保持不变。
- `progress`、`highScores`、`dailyChallenge` 存档逻辑保持不变。

## v0.7.1

- 校准 Rule System 命名：方向规则改为明确的 `movement: "orthogonal" | "diagonal"`。
- 新增清晰规则定义：Classic 使用 `orthogonal` 四方向移动，Diagonal 使用上下左右 + 四个斜向移动。
- 当前普通关卡和 Daily Challenge 继续使用 `diagonal` movement，保持现有可玩体验不变。
- 未新增模式选择页、未新增关卡、未新增新玩法入口。
- 评分数值、`progress`、`highScores`、`dailyChallenge` 存档逻辑保持不变。

## v0.7.0

- 新增 Rule System Foundation：每个关卡通过统一 `rules` 配置读取移动、交叉、特殊格和评分扩展能力。
- 建立规则配置层，当前所有普通关卡和 Daily Challenge 自动读取同一规则配置。
- 当前体验保持顺序连线、填满棋盘、不可交叉，不新增玩法和新关卡。
- 特殊规则开关已预留：桥梁、传送门、障碍物、单向格当前全部关闭。
- 评分代码整理为统一结构，保留当前完成分、生命加成、时间加成、最大连击加成和星级阈值，数值不变。
- Daily Challenge 保持兼容，仍使用独立 `dailyChallenge` 本地存档。

## v0.6.1

- 补全 Daily Challenge 页面信息：显示今日日期、今日挑战难度、今日挑战关卡编号。
- Daily Challenge 未完成时显示占位状态，不展示虚假分数或星级。
- Daily Challenge 完成后显示已完成、今日最佳分数、今日最佳星级，并提示可再次挑战刷新纪录。
- 今日已完成后，Daily 页面按钮改为“再次挑战”。
- 再次挑战只在新分数或新星级更高时刷新 `dailyChallenge` 当日记录。
- Daily Challenge 继续保持独立：不影响 `progress`、`highScores`、普通关卡解锁、普通关卡中途存档、金币、道具和复活。

## v0.6.0

- 新增 Daily Challenge 第一版。
- 首页新增“每日挑战”入口。
- 每天根据日期固定映射到一个现有关卡，不新增题库。
- 新增独立本地存档 `dailyChallenge`，记录当日完成状态、最佳分数和最佳星级。
- Daily Challenge 不发金币、不消耗道具、不允许复活。
