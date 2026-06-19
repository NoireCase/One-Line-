# 🕹️ One Line (智力一笔画解谜)

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)

**One Line** 是一款结合了空间路径规划与逻辑推理的沉浸式一笔画解谜游戏。玩家需要在一个充满未知与陷阱的棋盘上，按顺序连接数字，利用逻辑推导出隐藏在盲盒下的正确路线。

🌍 **在线游玩体验 (Live Demo):** [点击这里开始游戏](https://one-line-rho.vercel.app/)

---

## ✨ 核心特性 (Features)

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

## 📌 版本记录摘要

* **v0.8.1**：拆分 ModeSelectPage，并用 GAME_MODES 统一管理模式名称、规则和存档 key。
* **v0.8.0**：新增 Classic 四方向模式第一版，原有玩法归入 Diagonal，二者进度独立。
* **v0.7.2**：结构化评分报告，并在结算面板展示评分明细，当前数值规则不变。
* **v0.7.1**：校准规则命名，明确区分 orthogonal 与 diagonal movement，当前关卡沿用现有 diagonal 体验。
* **v0.7.0**：建立 Rule System Foundation，整理 Classic 规则读取和评分结构，玩法体验保持不变。
* **v0.6.1**：补全 Daily Challenge 展示信息、完成反馈和再次挑战刷新纪录逻辑。
* **v0.6.0**：新增 Daily Challenge 第一版，支持每日固定挑战和独立本地成绩存档。


## 📜 许可证 (License)
本项目采用 MIT License 开源许可证。
