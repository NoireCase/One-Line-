# ROADMAP

## 已完成

- 普通关卡流程：模式选择、模式介绍、连续关卡选择、线性解锁、普通最高分和本地进度存档。
- 核心玩法：一笔画连线、隐藏数字推理、生命值、计时、连击、动态星级结算。
- 经济与道具：金币、全局积分兑换、恢复、排除、提示、普通关卡复活。
- Daily Challenge 基础功能：
  - v0.6.0 完成每日入口、日期固定关卡映射、独立本地存档。
  - v0.6.1 完成今日关卡信息展示、完成状态反馈、再次挑战刷新最佳纪录。
- Rule System Foundation：
  - v0.7.0 完成关卡规则配置层、统一移动/交叉规则读取和评分结构整理。
  - v0.7.1 完成 `orthogonal` 与 `diagonal` movement 命名校准。
  - v0.8.0 完成 Classic 四方向模式第一版，并将原有玩法归入 Diagonal。
- Score Report Foundation：
  - v0.7.2 完成评分报告结构化和结算面板明细展示。
  - 当前只解释既有分数，不引入新公式、新奖励或新玩法评分。
- Classic 四方向模式：
  - v0.8.0 完成模式入口、每个难度 5 个 Classic 关卡、独立进度和独立最高分。
  - v0.8.1 完成 ModeSelectPage 拆分和 GAME_MODES 配置集中管理。
  - Diagonal 继续使用原有 `progress` / `highScores`，Daily Challenge 暂时继续使用 Diagonal。
- Portal Mode MVP / Alpha Pack：
  - v0.9.0 完成 Portal Mode MVP，接入 Hidden Portal、步数星级、最佳步数和独立存档。
  - v0.9.1 完成 Portal Spec v1.1，明确难度不按 Portal 数量判断，而按重新规划、跨区域思考、隐藏数字密度、误导路线和未覆盖区域记忆判断。
  - v0.9.2 完成 Portal Pack Alpha 的 9 个 `5x5` 关卡顺序整理，按 Tutorial → Easy → Normal → Hard 调整学习曲线。
  - v0.9.3 完成 Portal 进度与最佳步数的 `level.id` 化存档，降低后续重排、插入、删除关卡造成的错位风险。
  - Portal Mode 暂不进入 Daily Challenge。
- First-Time User Experience / 产品化首轮：
  - v0.10.0 完成首页推荐路径、模式定位、首关轻提示和通关后下一步引导。
  - Classic 明确为 Beginner / 入门模式，Diagonal 明确为 Main Mode / 标准主玩法。
  - Portal Mode 保留为 Advanced / Alpha / Experimental 扩展玩法，不扩展关卡数量。
  - Daily Challenge 保留为回访挑战，不作为新玩家首推路径。
- UI Consistency Pass：
  - v0.10.1 完成首页、模式选择页、难度页和关卡入口页的信息层级统一。
  - 首页主按钮直达推荐关卡，模式选择降为次级路径。
  - 模式页和关卡入口页减少高饱和渐变，统一卡片圆角、间距、说明层级和锁定态。
  - Portal 入口继续保留 Advanced / Alpha 定位，不新增机制或关卡。
- 产品路径收口：
  - v0.10.2 统一主路径为 `Home → ModeSelect → ModeDetail → LevelSelect → Game`，没有修改存档结构。
  - v0.10.3 将 Classic / Diagonal 的 `easy` / `medium` / `hard` 在同一个 LevelSelect 中连续展示，底层结构仍保留旧分组。
  - v0.10.4 完成首日信息减负与 UI 权重整理，ModeDetail、LevelSelect、WinPanel 和 Game Header 更突出继续闯关。
  - 当前通关页原则是“下一关”为唯一主按钮，Score Report 折叠或降权。

## 下一阶段建议

### 近期

- 清理当前玩家路径不可达的 DifficultySelect 分支。
- 继续优化 LevelSelect 卡片密度和分段展示，保持连续关卡体验但降低信息拥挤。
- 检查首页 Continue / 继续闯关机制是否需要引入，避免玩家回访时只能从入口重新选择。

### 中期

- 引入统一关卡序列，减少前台连续展示与底层难度分组之间的割裂。
- 设计 `difficulty: 1-10` 难度模型。
- 设计旧存档兼容与迁移方案，明确 `easy` / `medium` / `hard` 如何映射到新序列。
- 重新梳理 Daily Challenge 映射，确认它使用统一序列、固定池还是独立挑战池。

### 长期

- JSX 组件拆分，优先拆出边界稳定、只负责展示的子组件。
- 新玩法扩展，例如 Obstacle、One-Way、Bridge 等规则变体。
- Portal 扩展关卡包，在 Alpha Pack 验证后扩展更多关卡。
- 编辑器 / AI 生成关卡支持，用于加速关卡生产和测试。

## 暂未实现 / 暂不承诺

- 效率分
- 规则奖励
- 特殊玩法评分
- Diagonal 扩展关卡包
- difficulty: 1-10
- 统一关卡序列
- 旧存档迁移
- 桥梁模式
- 障碍物模式
- 单向格模式
- Portal 正式关卡包
- Portal 关卡 20+ 扩展
- Portal 进入 Daily Challenge
- 排行榜
- 连续签到
- 每日奖励
- 历史记录页
- 成就联动
- 账号系统
- 网络同步
- AI 生成关卡
- 新增题库
