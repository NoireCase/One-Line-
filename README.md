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

## 🎮 玩法说明 (How to Play)

1.  **起点**：从数字 `1` 开始，按住鼠标或屏幕。
2.  **连线**：按照递增顺序 (`1 → 2 → 3...`) 拖动连线，支持横、竖、斜向移动。
3.  **规则**：线路不可交叉，不可重复经过同一个格子。
4.  **推理**：棋盘上部分数字处于“隐藏”状态，您需要根据周围已知数字的位置，推断出正确的走向。连错“暗牌”将扣除生命值并打断连击！


## 📜 许可证 (License)
本项目采用 MIT License 开源许可证。
