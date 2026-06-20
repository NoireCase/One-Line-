# ROADMAP

## 已完成

- 普通关卡流程：难度选择、关卡选择、线性解锁、普通最高分和本地进度存档。
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

## 下一阶段建议

- Portal Pack 正式化：
  - 在继续扩展 Portal 关卡前，先基于 Portal Spec v1.1 验证现有 9 关的难度曲线。
  - 为每个 Portal 关卡补充人工设计审查记录，包括 Portal 角色、是否需要重新规划、是否存在纯绕路或猜谜问题。
  - 扩展关卡时优先保持 Tutorial → Easy → Normal → Hard 的认知负担曲线，而不是按 Portal 数量排序。
- Portal 内容收口优先级高于第二玩法：
  - 第二玩法可以考虑 Obstacle 或 One-Way。
  - Obstacle / One-Way 暂不应优先于 Portal Pack 正式化。
  - 不建议在 Portal Pack 收口前推进大型玩法重构。

## 暂未实现 / 暂不承诺

- 效率分
- 规则奖励
- 特殊玩法评分
- Diagonal 扩展关卡包
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
