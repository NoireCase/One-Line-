# 🕹️ One Line (智力一笔画解谜)

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)

**One Line** 是一款结合了空间路径规划与逻辑推理的沉浸式一笔画解谜游戏。玩家需要在一个充满未知与陷阱的棋盘上，按顺序连接数字，利用逻辑推导出隐藏在盲盒下的正确路线。

🌍 **在线游玩体验 (Live Demo):** [点击这里开始游戏](https://one-line-rho.vercel.app/)

---

## ✨ 核心特性 (Features)

* 🧭 **新玩家推荐路径 (First-Time User Experience)**
    * 当前核心路径为 `Home → 选择模式 → 模式介绍 → 关卡选择 → 游戏 → 下一关`。
    * 首页和模式入口明确推荐 `Classic → Diagonal`。
    * Classic 定位为 Beginner / 入门模式，用来学习基础路径规则。
    * Diagonal 定位为 Main Mode / 标准主玩法，承载完整的一笔画推理体验。
    * Portal Mode 定位为 Advanced / Alpha / Experimental 扩展玩法，建议熟悉主玩法后再尝试。
    * Daily Challenge 定位为回访挑战，不作为新玩家首推入口。
* 🧠 **程序化关卡生成 (Procedural Generation)**
    * 底层采用定制化的 DFS (深度优先搜索) 算法结合伪随机种子，确保每一个关卡都有唯一且连贯的解，拒绝无脑死局。
* 🎵 **动态丝滑音阶 (Pentatonic Audio Engine)**
    * 内置 Web Audio API，连线时触发大调五声音阶 (Do-Re-Mi-Sol-La)。无论连击多长，听感始终如丝般顺滑、无缝攀升。
* 🔥 **心流连击系统 (Combo System)**
    * 打破传统的单调连线。基于单次拖动长度触发 Combo（Good / Great / Excellent / Unstoppable）。
    * 达到高连击时，连线会自动加粗、发光并变为专属的**无敌金色**，伴随爆炸性的得分乘数加成。
* 📈 **动态极限评级 (Dynamic S-Max Rating)**
    * 摒弃死板的时间限制。系统会在后台计算当前关卡的理论极限最高分（包含全盘隐牌盲猜、满血、满连击），基于该极限分数的百分比 (30% / 60% / 90%) 动态赋予 1~3 星的评级。
* 🎒 **闭环经济与道具系统 (Economy & Items)**
    * 特设“全局积分奖金池”，累计满 5000 分自动印钞兑换金币。
    * 提供丰富战术道具：**恢复** (加血)、**排除** (排雷)、**提示** (点亮下一步)。使用道具会受到强制打断 Combo 的严厉惩罚，维护硬核玩家的高分含金量。
* 📅 **每日挑战 (Daily Challenge)**
    * 每天根据日期固定映射到一个现有关卡，同一天所有玩家看到同一挑战。
    * 每日挑战使用独立本地存档 `dailyChallenge`，只记录当日完成状态、最佳分数和最佳星级。
    * 每日挑战不影响普通关卡进度、最高分、解锁、金币、道具、复活或中途存档。
* 🌀 **Portal Mode Alpha**
    * 当前已实现 Portal Mode，作为 Advanced / Alpha 扩展内容展示。
    * Portal Mode 使用 Hidden Portal 规则：未访问 Portal 显示 `?`；进入入口后出口高亮；玩家必须手动连接到出口；已访问 Portal 显示路径数字。
    * Portal Mode 不使用 Classic combo 评分，改用步数、最佳步数和步数星级。
    * 当前 Portal Mode 提供 9 个 `5x5` 关卡，关卡顺序按 Tutorial → Easy → Normal → Hard 的学习曲线整理。
    * Portal Mode 暂不进入 Daily Challenge。
* 🧩 **规则系统基础 (Rule System Foundation)**
    * v0.7.0 起，每个关卡通过统一规则配置读取移动、交叉、特殊格和评分扩展能力。
    * v0.7.1 起，方向规则明确区分 `orthogonal`（上下左右）与 `diagonal`（上下左右 + 斜向）。
    * v0.8.0 起正式提供 Classic 四方向模式；原有玩法归入 Diagonal 模式。
    * 该结构继续为未来桥梁、障碍物、传送门、单向格等玩法预留扩展位置。
* 📊 **结构化评分报告 (Score Report)**
    * v0.7.2 起，结算结果拆分为完成分、时间加成、生命加成、连击加成、规则加成和总分。
    * 当前评分公式和数值不变，结构化报告用于未来效率分、规则奖励和特殊玩法评分扩展。

## 🎮 玩法说明 (How to Play)

1.  **起点**：从数字 `1` 开始，按住鼠标或屏幕。
2.  **选择模式**：Classic 只允许上下左右移动；Diagonal 允许上下左右与斜向八方向移动。
3.  **连线**：按照递增顺序 (`1 → 2 → 3...`) 拖动连线。
4.  **规则**：线路不可交叉，不可重复经过同一个格子。
5.  **推理**：棋盘上部分数字处于“隐藏”状态，您需要根据周围已知数字的位置，推断出正确的走向。连错“暗牌”将扣除生命值并打断连击！

## 🧭 当前玩家路径

当前主线产品路径已经收口为：

`Home → 选择模式 → 模式介绍 → 关卡选择 → 游戏 → 下一关`

玩家先在首页进入推荐路径或模式入口，再阅读对应模式的轻量介绍，随后进入关卡选择页开始游戏。通关后，“下一关”是唯一主按钮，Score Report、分数拆解和奖励信息保留但折叠或降权，避免打断继续闯关。

## 🧭 当前模式定位

建议新玩家先从 **Classic** 开始，再进入 **Diagonal**：

| 模式 | 定位 | 适合玩家 | 简短说明 |
| --- | --- | --- | --- |
| Classic | Beginner / 入门模式 | 第一次打开游戏的新玩家 | 标准一笔画，连续关卡展示。 |
| Diagonal | Main Mode / 标准主玩法 | 已理解基础规则的玩家 | 允许斜线连接，连续关卡展示。 |
| Portal | Alpha Pack / 扩展玩法 | 想尝试扩展规则的玩家 | 包含隐藏传送门的进阶谜题。 |
| Daily Challenge | Daily Challenge / 回访挑战 | 已玩过基础模式的玩家 | 每天刷新的挑战关。 |

游戏核心乐趣是：观察隐藏信息，根据路径位置推理下一步，并完成一条合法的一笔画路径。

## 🗂️ 当前关卡选择结构

Classic / Diagonal 的前台关卡选择已经合并为连续展示，不再向玩家展示独立的 Easy / Medium / Hard 难度选择页。

需要注意的是：这只是前台产品路径收口，底层仍保留 `easy` / `medium` / `hard` 的关卡生成、存档和兼容结构。旧的 `DifficultySelect` 代码分支仍在仓库中，但当前玩家主路径不可达。

### Portal Mode

Portal Mode 是当前 Advanced / Alpha 扩展玩法内容：

1. 未访问的 Portal 显示为 `?`，不会提前暴露配对关系。
2. 玩家进入 Portal 入口后，系统高亮对应出口。
3. 玩家下一步必须手动连接到高亮出口，Portal 不会自动传送。
4. 到达出口后，路径继续按数字顺序推进。
5. 已访问的 Portal 会显示路径数字，方便玩家回看顺序。

Portal Mode 当前不使用 Classic / Diagonal 的 combo 分数作为主要成绩，而是使用步数、最佳步数和星级。当前共有 9 个 `5x5` Portal 关卡，暂不进入 Daily Challenge。

## 📌 版本记录摘要

* **v0.10.4**：首日信息减负与 UI 权重整理，优化 ModeDetail、LevelSelect、WinPanel 和 Game Header，不修改评分、金币、道具或复活逻辑。
* **v0.10.3**：Classic / Diagonal 的 easy / medium / hard 在同一个 LevelSelect 中连续展示，前台不再展示独立 DifficultySelect，底层结构不变。
* **v0.10.2**：统一产品路径为 `Home → ModeSelect → ModeDetail → LevelSelect → Game`，不修改存档结构。
* **v0.10.1**：进一步整理首页、模式入口、关卡入口页的信息层级和视觉权重。
* **v0.10.0**：产品化首轮，优化首页推荐路径、模式定位、首关轻提示和通关后的下一步引导。
* **v0.9.3**：Portal 进度与最佳步数改为按 `level.id` 保存，降低后续重排、插入、删除关卡造成的存档错位风险。
* **v0.9.2**：整理 Portal Pack Alpha 的 9 个 `5x5` 关卡顺序，按 Tutorial → Easy → Normal → Hard 形成学习曲线。
* **v0.9.1**：新增 Portal Mode 关卡生成规格 v1.1，明确 Hidden Portal、难度判断、Portal 角色和 `targetSteps` 用途。
* **v0.9.0**：新增 Portal Mode MVP，接入 Hidden Portal 规则、步数星级和 Portal 独立进度。
* **v0.8.1**：拆分 ModeSelectPage，并用 GAME_MODES 统一管理模式名称、规则和存档 key。
* **v0.8.0**：新增 Classic 四方向模式第一版，原有玩法归入 Diagonal，二者进度独立。
* **v0.7.2**：结构化评分报告，并在结算面板展示评分明细，当前数值规则不变。
* **v0.7.1**：校准规则命名，明确区分 orthogonal 与 diagonal movement，当前关卡沿用现有 diagonal 体验。
* **v0.7.0**：建立 Rule System Foundation，整理 Classic 规则读取和评分结构，玩法体验保持不变。
* **v0.6.1**：补全 Daily Challenge 展示信息、完成反馈和再次挑战刷新纪录逻辑。
* **v0.6.0**：新增 Daily Challenge 第一版，支持每日固定挑战和独立本地成绩存档。

## ⚠️ 当前限制

* 尚未引入统一的 `difficulty: 1-10` 难度模型。
* Classic / Diagonal 的存档结构仍使用旧的 `easy` / `medium` / `hard`。
* `DifficultySelect` 旧代码分支仍保留，但当前玩家路径不可达。
* JSX 大拆分尚未进行，主要页面逻辑仍保留在现有组件结构中。

## 📜 许可证 (License)
本项目采用 MIT License 开源许可证。
