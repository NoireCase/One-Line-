# CHANGELOG

## v0.12.0

v0.12.0 内容扩展与工具链完善：

- **经典模式 / 八向连线 medium 扩容**：各新增 5 个 curated 关卡（Classic 15→20，Diagonal 15→20），总计 50 关/模式
- **候选关卡生成 pipeline**：新增 `generate:level-candidates` / `export:dev-level-candidates` / `apply:level-candidates` 脚本
- **相似度检测 (similarityScore)**：候选生成器自动比较路径方向、run length、空间分布、hidden anchor 等特征
- **结构标签 (archetypeTag)**：10 种路径结构类型自动标记，支持 staged 多样性选择
- **批次评估 (batch evaluation)**：自动总结 staged 候选的分数分布、archetype 分布和相似度预警
- **apply --write**：支持 curated candidate 安全入库，干运行校验、容量检查、重复检测、写入后校验
- **GM Console 增强**：Dev Candidate 试玩、审核面板（标记为可入库/不合格/辅助判断）、批次摘要、已入库过滤
- **关卡列表 UI 修复**：统一卡片排版、修复滚动布局、动态关卡总数渲染
- **GM 跳关动态映射**：不再硬编码 45/25/26，改为动态 section count

不修改：

- 经典模式 / 八向连线 easy/hard 结构
- Portal / Portal Collect 玩法与关卡
- 存档结构、localStorage key
- 评分公式与星级阈值

## v0.11.4

v0.11.4 架构收口：App 编排层拆分

本轮专注于内部代码结构整理，不涉及面向玩家的功能变更：

- 拆分游戏会话状态（`useGameSession`）
- 拆分路径输入交互逻辑（`usePathInteraction`）
- 拆分胜负与结算流程（`useGameResultFlow`）
- 拆分游戏视图展示组件（`GameHud` / `GameBoard` / `GameActions` / `GameStatusLayer` / `GameView`）
- 提取道具执行业务逻辑（`useItemLogic`）
- 提取保存/放弃退出流程至游戏会话管理层
- 提取关卡导航纯函数、DEV-only GM 面板、关卡列表数据准备（`useLevelList`）

不修改：

- 玩法规则（Classic / Portal）
- 评分公式与星级阈值
- 关卡数据（经典模式 45 关、传送门 9 关）
- 存档结构、localStorage key
- 道具、金币、生命、复活等经济数值
- UI 设计与视觉参数
- package 依赖

## v0.11.3

v0.11.3 结构拆分与 Portal 体验收口：

- 同步 package、README 与 CHANGELOG 的版本元信息。
- Portal 入口与文案统一为“传送门谜题”，减少开发阶段表达。
- Portal 通关结算不再显示 `+0 金币`。
- 保持 Classic / Portal 玩法规则、关卡数量、金币数值、道具数值和存档结构不变。
- 本轮不处理 `useGameSession` 拆分、既有 lint ref 同步问题、Math.random lint 规则、Lv6 规则说明回看、Hidden / Bridge / One-Way / Obstacle 和新 Portal 关卡包。

## v0.11.2

关卡内体验与规则说明收口：

- 优化棋盘路径线、已走格、当前格的视觉层级，降低数值噪音。
- 删除棋盘内浮动 combo 倍率提示，Combo 信息仅保留在顶部 HUD。
- 支持失败后和松手后继续连线时的视觉路径分段，避免旧线和新区段视觉混淆。
- 禁止拖动回退，path 只能向前增长，避免路径状态混乱。
- 增加通关轻量音效（C5-E5-G5-C6 上行琶音），遵守音量开关。
- 修复第 5 关进入第 6 关时八方向说明弹窗被通关面板遮挡的流程异常。
- 修复通关最后一格在结算阶段仍保留当前格样式的问题。
- 修复 Portal 成功传送时因中间格触发错误动画（红框抖动与错误闪烁）的问题。
- 增加 Portal 规则说明页，并调整为进入 Portal 第 1 关棋盘后展示。
- 将八方向说明页收口为静态规则示意，表达"从 5 出发可斜向连接四角"。
- 新增 CLAUDE.md，明确 AI 辅助开发中的 Git 与 GitHub 操作安全规则。
- 不修改关卡数据、存档结构、评分公式和道具系统。

## v0.11.1

Release Candidate 稳定性收口：

- GM 控制台改为仅开发环境可见的设置入口，移除隐藏字符串触发方式。
- 修复 Classic 结算页始终显示三星的问题，改为展示本次实际获得星级。
- 修复 Classic 在 Lv6 解锁八方向后，部分后续关卡错误恢复四方向的问题。
- 接通游戏内退出确认框，支持保存退出、放弃退出和继续游戏。
- 保持 Classic / Portal 现有存档 key 与数据结构不变。
- 确认 Portal 当前所有关卡的完成步数与目标步数均固定为 24，评分暂时不会拉开差异；本版本不调整 Portal。

## v0.11

产品结构收口：双模式架构

- Classic 与 Diagonal 合并为统一的"经典模式"（45 关）。
- 经典模式采用连续关卡，棋盘 5×5 → 7×7 → 9×9 只递增不回退。
- 斜向连接不再作为独立一级模式，改为 Classic 内部进阶规则（Lv6 解锁）。
- 模式选择页从三个入口简化为两个：经典模式、传送门谜题。
- 旧关卡精选 45 关进入新主线，30 关进入备用素材库。
- Portal 传送门谜题保持 9 关不变，存档保留。
- 旧 Classic / Diagonal 存档清空，存档体系使用新 key（cg_classic_v2_*）。
- 关卡选择页改为连续 Lv1-Lv45 编号。
- README、ROADMAP 同步更新。

## v0.10.8

玩家视角文案收口：

- 首页、README、ROADMAP 和游戏内文案统一为玩家表达。
- 模式名称统一为经典模式、斜线模式和传送门谜题。
- 收口开发者术语、英文标签和未启用提示。
- 不修改玩法逻辑、存档结构和关卡数据。

## v0.10.7

做了什么：

- 删除 ModeDetail 中间确认页，模式选择后直接进入 LevelSelect。
- 主路径调整为 `Home → ModeSelect → LevelSelect → Game`。
- 首页主按钮从“选择模式”调整为“开始游戏”，并移除首页解释型副标题。
- Home 保留一句极短副标题“找到正确的路径”。
- ModeSelect 清理课程分级标签和开发者式说明，改为展示 Classic / Diagonal / Portal 的完成度。
- LevelSelect 删除 `新手段 / 进阶段 / 挑战段` 和 `Lv1-Lv5` 这类内部难度段标题，改为连续关卡进度表达。
- Game Header 删除规则型副标题，只保留模式名、当前关卡、时间、生命和当前进度信息。
- Tutorial 继续作为规则说明页保留。

没做什么：

- 不新增玩法，不恢复 Daily Challenge，不新增 Continue，不新增 Portal 独立页面。
- 不修改经济、道具、金币、生命、复活、评分或关卡判定逻辑。

存档 / 玩法 / 数据结构：

- 不修改存档结构。
- 不修改 `diff = easy / medium / hard` 底层分段。
- 不修改 `progress`、`highScores`、`classicProgress`、`classicHighScores`、`portalProgress` 或 `portalBestSteps`。

## v0.10.6

做了什么：

- 删除旧 `diff` 页面残留，不再保留不可达的“选择关卡组 / 选择难度段”页面分支。
- Tutorial 改为按模式说明移动规则：Classic 只支持上下左右，Diagonal 支持上下左右和斜向，Portal 在对应移动规则基础上加入传送门规则。
- ModeDetail 收紧为模式介绍与进入关卡前确认页，只保留模式名称、核心说明、当前进度摘要、进入关卡主按钮和返回入口。

没做什么：

- 不新增玩法，不恢复 Daily Challenge，不新增 Continue，不新增 Portal 独立关卡包页面。
- 不修改经济系统、道具系统、金币、生命、提示、排除、恢复或复活逻辑。
- 不为 Portal 引入独立经济或独立道具，Classic、Diagonal、Portal 继续共享现有资源体系。

存档 / 玩法 / 数据结构：

- `diff = easy / medium / hard` 继续作为 Classic / Diagonal 连续关卡的底层分段和存档结构保留。
- 不修改 `progress`、`highScores`、`classicProgress`、`classicHighScores`、`portalProgress` 或 `portalBestSteps`。

## v0.10.5

做了什么：

- 删除 Daily Challenge 入口、页面和专属游戏流程。
- 删除 Daily Challenge 的本地存档读取、写入和初始化逻辑。
- Home 回归为“选择模式 / 游戏说明 / 设置”的最小入口结构。

没做什么：

- 不修改 Home → ModeSelect → ModeDetail → LevelSelect → Game 主路径。
- 不修改 Classic、Diagonal、Portal、金币、道具、复活、评分公式或难度结构。

存档 / 玩法 / 数据结构：

- 移除 `dailyChallenge` 本地存档 key。
- 不修改 `progress`、`highScores`、`classicProgress`、`classicHighScores`、`portalProgress` 或 `portalBestSteps`。

## v0.10.4

做了什么：

- 做首日信息减负与 UI 权重整理。
- ModeDetail 降低解释密度，保留进入游戏前必要信息。
- LevelSelect 优化卡片信息层级，让继续闯关和关卡状态更清楚。
- WinPanel 将“下一关”保持为唯一主按钮，Score Report 折叠或降权。
- Game Header 降低次要信息权重，减少游戏中视觉干扰。

没做什么：

- 不改评分、金币、道具、复活、连击、生命、计时或关卡判定逻辑。
- 不改关卡数据，不扩展 Portal 关卡包。

存档 / 玩法 / 数据结构：

- 不涉及存档迁移。
- 不修改玩法规则。
- 不修改关卡数据结构或本地存档结构。

## v0.10.3

做了什么：

- Classic / Diagonal 的 `easy` / `medium` / `hard` 关卡在同一个 LevelSelect 中连续展示。
- 前台不再向玩家展示独立 DifficultySelect 难度选择页。
- 关卡选择页按连续进度表达当前可挑战、已完成和未解锁状态。

没做什么：

- 不删除旧 DifficultySelect 代码分支。
- 不改关卡生成方式，不重排底层难度分组。

存档 / 玩法 / 数据结构：

- 只是前台合并展示。
- 底层仍使用 `easy` / `medium` / `hard` 关卡、进度和最高分结构。
- 不涉及存档迁移，不修改玩法规则。

## v0.10.2

做了什么：

- 统一主路径为 `Home → ModeSelect → ModeDetail → LevelSelect → Game`。
- 将模式介绍收口到进入关卡选择前，减少首页和关卡页的重复解释。
- 明确 Classic / Diagonal / Portal 的进入顺序和页面职责。

没做什么：

- 不引入 `difficulty: 1-10`。
- 不改关卡数据。
- 不清理旧 DifficultySelect 分支。

存档 / 玩法 / 数据结构：

- 没有改存档结构。
- 没有改评分、金币、道具、复活或核心路径判定。
- 没有改 Classic / Diagonal 底层 `easy` / `medium` / `hard` 结构。

## v0.10.1

做了什么：

- 首页主按钮改为“开始推荐关卡”，直接进入 Classic Easy Lv.1，减少首次进入时的选择负担。
- 模式选择页减重，只保留模式名、定位标签和一句短说明。
- Diagonal 在模式页中保持主玩法权重，Portal 降低为 Advanced / Alpha 弱入口。
- Classic / Diagonal 难度选择页改为轻量关卡组列表，减少大面积高饱和渐变。
- 关卡入口页统一标题、说明栏、卡片圆角、间距和锁定态。
- Portal 关卡入口新增 Alpha Pack 说明，避免页面显得空或未完成。

没做什么：

- 不新增玩法，不新增关卡，不迁移存档。

存档 / 玩法 / 数据结构：

- 不修改存档 key、进度结构、关卡数据、路径判定、评分、金币、道具或 Portal 规则。

## v0.10.0

做了什么：

- 首页新增新玩家推荐路径提示，明确建议 `Classic → Diagonal`。
- 模式入口新增模式定位与短说明：Classic / Beginner、Diagonal / Main Mode、Portal / Advanced Alpha。
- Classic Lv.1 与 Diagonal Lv.1 首次进入时新增轻量规则提示，说明数字顺序、隐藏数字推理和合法一笔画目标。
- 通关弹窗优先展示下一步行动：下一关、提升星级、尝试主模式和模式选择。
- Portal Mode 入口保留并弱化为进阶实验玩法，不扩展关卡、不新增 Portal 机制。
- Score Report、金币和分数信息保留，但在通关弹窗中让位于继续游玩的主按钮。
- 首页和导航中的产品名称统一为 One Line。

没做什么：

- 不扩展 Portal 内容，不做 JSX 大拆分。

存档 / 玩法 / 数据结构：

- 不修改已有存档 key、进度结构或最高分结构。
- 不修改关卡数据、核心路径判定、评分公式、经济系统或成就系统。

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
- 本版本只处理 Portal Mode，不修改 Classic 或 Diagonal。

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
- Portal Mode 暂时作为独立模式接入。

已知限制：

- Portal Mode 仍是 MVP 阶段内容。
- 当前 Portal 关卡数量有限，主要用于验证 Hidden Portal 机制和关卡学习曲线。
- Portal Mode 暂未提供云存档或排行榜。

## v0.8.1

- 将模式选择页从 `App.jsx` 拆出为 `src/components/ModeSelectPage.jsx`。
- 新增 `src/config/gameModes.js`，集中管理模式名称、说明、movement、关卡数量和本地存档 key。
- App 通过 `GAME_MODES` 读取 Classic / Diagonal 配置，减少模式文案和存档 key 硬编码。
- 未新增玩法、未新增关卡、未修改评分、未迁移存档。
- Classic / Diagonal 进度分离，Diagonal 旧存档兼容。

## v0.8.0

- 新增 Classic 四方向模式第一版：只允许上下左右移动，不允许斜向移动。
- 新增模式选择流程，可在 Classic 与 Diagonal 之间选择。
- Classic 每个难度提供 5 个可玩关卡，共 15 个 Classic 关卡。
- 原有普通关卡归入 Diagonal 模式，继续使用旧的 `progress` / `highScores`，不强制迁移旧存档。
- Classic 使用独立本地存档 `cg_classic_progress` / `cg_classic_highscores`，中途存档使用 `cg_classic_saved_game`。
- 评分公式、星级阈值、金币收益和 Score Report 展示保持不变。

## v0.7.2

- 新增结构化评分报告字段：完成分、时间加成、生命加成、连击加成、规则加成、总分和星级。
- WinPanel 结算面板展示评分明细。
- 当前规则加成为 0，并显示为暂未启用，为未来特殊规则奖励预留位置。
- 总分公式、星级阈值、金币收益、连击规则、时间加成和生命加成数值保持不变。
- `progress`、`highScores` 存档逻辑保持不变。

## v0.7.1

- 校准 Rule System 命名：方向规则改为明确的 `movement: "orthogonal" | "diagonal"`。
- 新增清晰规则定义：Classic 使用 `orthogonal` 四方向移动，Diagonal 使用上下左右 + 四个斜向移动。
- 当前普通关卡继续使用 `diagonal` movement，保持现有可玩体验不变。
- 未新增模式选择页、未新增关卡、未新增新玩法入口。
- 评分数值、`progress`、`highScores` 存档逻辑保持不变。

## v0.7.0

- 新增 Rule System Foundation：每个关卡通过统一 `rules` 配置读取移动、交叉、特殊格和评分扩展能力。
- 建立规则配置层，当前普通关卡自动读取同一规则配置。
- 当前体验保持顺序连线、填满棋盘、不可交叉，不新增玩法和新关卡。
- 特殊规则开关已预留：桥梁、传送门、障碍物、单向格当前全部关闭。
- 评分代码整理为统一结构，保留当前完成分、生命加成、时间加成、最大连击加成和星级阈值，数值不变。
