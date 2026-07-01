# One-Line AI Development SOP v1

本文件用于 One-Line 项目的 AI 协作开发流程。

当前策略：

```text
不接 ECC
不堆新工具
继续使用现有 CLAUDE.md
继续使用已收紧的 .claude/settings.local.json
靠任务分级、文件边界、风险分层、Git 单独确认来控风险
```

`CLAUDE.md` 负责项目硬规则。本文件负责日常任务模板和执行流程。

## 1. 任务分级

| 类型 | 是否两轮 | 是否需要 Codex review | 适用场景 |
| --- | ---: | ---: | --- |
| 小改 | 否 | 否 | 文案、按钮样式、README 小改、轻量 CSS |
| UI 小改 | 通常否 | 可选 | PuzzleBook、ModeSwitcher、WinPanel 视觉、SettingsPanel |
| 中风险改动 | 视情况 | 建议 | 组件拆分、交互调整、局部状态修改 |
| 高风险逻辑 | 是 | 必须 | 玩法、存档、关卡、评分、解锁、hooks、写入脚本 |
| Git / Release | 单独任务 | 发布前建议 | commit、push、tag、release、PR |

## 2. 固定任务模板

### A. 只读分析类

适合：玩法判断、架构检查、bug 定位、PR review、diff review。

```text
任务类型：只读分析

只读分析，不要修改任何文件。

目标：
【写清楚要判断的问题】

重点检查：
- 【文件 / 模块 / 行为】

输出格式：
1. 主要问题
2. 影响范围
3. 风险点
4. 可选方案
5. 推荐下一步

禁止：
- 不要修改文件
- 不要执行 git add / commit / push / tag / release
- 不要运行会写入文件的脚本
```

### B. 小改 / UI 小改类

适合：首页、关卡选择、按钮样式、视觉层级、轻量文案。

```text
任务类型：UI 小改

目标：
【写清楚 UI 要改什么】

允许修改：
- 【明确列文件】

禁止修改：
- src/config/gameModes.js
- src/data/*
- src/hooks/*
- 玩法逻辑
- 关卡数据
- 存档结构
- 评分逻辑
- 解锁流程
- localStorage key

执行要求：
1. 只做最小范围修改。
2. 修改后说明：
   - 修改了哪些文件
   - 改了什么
   - 是否改变玩法逻辑
   - 如何验证

验证：
- npm run build

是否允许 git 操作：否
```

小 UI、README、文案改动不需要强制两轮；只要文件边界清楚，可以直接改。

### C. 高风险逻辑类

适合：

- `src/hooks/*`
- `src/config/gameModes.js`
- `src/data/*`
- `scripts/*`
- Win / Lose
- scoring
- localStorage
- 解锁流程
- 关卡生成 / apply
- Portal / Hidden / Diagonal 规则

第一轮：

```text
任务类型：高风险逻辑改动

第一步只读分析，不要修改代码。

目标：
【写清楚要解决的问题】

重点检查：
- 【列出相关文件】

输出格式：
1. 问题原因
2. 影响文件
3. 风险点
4. 最小修改方案
5. 必须执行的验证命令
6. 哪些行为不应该被改变

等我确认后，再进入第二轮修改。

禁止：
- 第一轮不要改文件
- 不要 git 操作
- 不要运行 --write 类脚本
```

第二轮：

```text
按刚才确认的方案修改。

允许修改：
- 【只列确认过的文件】

禁止修改：
- 【明确列禁止文件】

验证：
- npm run build
- 【相关 e2e / validate 命令】

修改后输出：
1. 修改文件
2. 修改内容
3. 是否影响玩法 / 存档 / 评分 / 关卡数据
4. 验证结果
5. 剩余风险

是否允许 git 操作：否
```

### D. Git / Release 类

适合：commit、push、tag、release、PR。

```text
任务类型：Git / Release

只处理 git / release，不修改代码。

第一步先输出：
1. git status --short
2. git log --oneline -n 3
3. 当前分支：从 git status 输出中读取
4. 准备执行的命令
5. 风险判断

未经我确认，不要执行：
- git add
- git commit
- git push
- git tag
- gh release
- gh pr create
- gh pr merge

本轮禁止修改源码、文档、测试、package.json。
```

如需更方便，可之后把以下只读命令加入 Claude Code 白名单：

```text
Bash(git branch --show-current)
```

它是安全只读命令，但不是必须。

## 3. Codex 使用规则

不用每次都 review。

| 任务风险 | Codex 是否需要 |
| --- | ---: |
| 小文案 / README / CSS 小改 | 不需要 |
| UI 小改 | 可选 |
| 组件结构调整 | 建议 |
| 玩法 / 存档 / 关卡 / scoring | 必须 |
| push / tag / release 前 | 建议 |
| Claude 输出让你不放心时 | 必须 |

当前分工：

```text
ChatGPT：方案判断 / Prompt 生成
Claude Code CLI：执行
Codex：中高风险 review
```

## 4. 关卡写入特殊规则

关卡相关任务要单独管控。

| 操作 | Claude 是否可直接执行 |
| --- | ---: |
| 生成候选 | 可以 |
| dry-run | 可以 |
| validate | 可以 |
| `--write` 写入正式关卡 | 不可以，必须单独确认 |
| 写入后 commit | 不可以，必须单独确认 |

固定提醒：

```text
不要运行任何带 --write 的关卡写入脚本，除非我单独确认。
```

## 5. 最终执行原则

每个任务先判断属于哪类：

```text
小改 → 直接执行，明确禁止 git
UI 小改 → 明确允许 / 禁止文件
高风险逻辑 → 先只读分析，再确认修改
Git / Release → 单独任务，单独确认
```

最终流程：

```text
任务分级
→ 明确允许修改文件
→ 明确禁止修改范围
→ 小范围执行
→ build / test / validate
→ 中高风险再 Codex review
→ Git / Release 单独确认
```

