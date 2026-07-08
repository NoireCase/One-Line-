# Codex Task Templates

These templates are reusable prompts for One-Line AI-assisted development.
Use them to keep tasks small, clear, and safe.

## 1. Read-Only Review

Use for bug diagnosis, UX review, architecture checks, PR review, or release readiness.

```text
任务类型：只读审查

只读审查，不要修改任何文件。
不要 git add / commit / push / tag / release。
不要运行会写入文件的脚本。

目标：
【写清楚要判断的问题】

重点检查：
- 【文件 / 模块 / 行为】

请输出：
1. 总体结论：可继续 / 需修正 / 不建议继续
2. Blocking 问题
3. Major 问题
4. Minor 问题
5. 涉及文件
6. 推荐最小下一步
7. 建议验证命令
```

## 2. UI Small Change

Use for copy, layout hierarchy, light visual polish, small animation, or player-facing UI cleanup.

```text
任务类型：UI 小改

目标：
【写清楚 UI 要改什么】

允许修改：
- 【明确列文件】

禁止修改：
- 玩法规则
- solver
- validator
- 关卡数据
- 存档结构 / localStorage key
- 评分逻辑
- 解锁流程
- package version

执行要求：
1. 只做最小范围修改。
2. 不引入新依赖。
3. 不改变现有玩法行为。
4. 如修改玩家文案，删除开发口径，保留短句。

验证：
- npm run build
- 【必要时增加 e2e】

完成后报告：
1. 修改文件
2. UI 改了什么
3. 是否影响玩法 / solver / 关卡 / 存档
4. 验证结果
5. git status
```

## 3. High-Risk Logic Review First

Use before changing gameplay, solver, validator, levels, saves, scoring, unlocks, or scripts.

```text
任务类型：高风险逻辑改动，第一轮只读分析

第一步只读分析，不要修改代码。
不要 git 操作。
不要运行 --write 类脚本。

目标：
【写清楚要解决的问题】

重点检查：
- 【列出相关文件】

请输出：
1. 问题原因
2. 影响文件
3. 风险点
4. 最小修改方案
5. 哪些行为不应该改变
6. 必须执行的验证命令

等我确认后，再进入第二轮修改。
```

## 4. High-Risk Logic Implementation

Use only after the first review or file boundary is confirmed.

```text
任务类型：高风险逻辑改动，第二轮修改

按刚才确认的方案修改。

允许修改：
- 【只列确认过的文件】

禁止修改：
- 【明确列禁止文件 / 模块】

要求：
1. 只做确认过的最小修改。
2. 不扩大到 UI polish 或无关重构。
3. Validator / solver 改动必须补边界测试。
4. 如涉及 runtime 行为，validator 应尽量与 runtime 规则一致。

验证：
- npm run build
- npm run validate:levels
- 【相关脚本测试】
- 【相关 e2e】

完成后报告：
1. 修改文件
2. 修改内容
3. 是否影响玩法 / 存档 / 评分 / 关卡数据
4. 验证结果
5. 剩余风险
6. git status

本轮不做 git commit，除非我明确要求。
```

## 5. Git / Release Closeout

Use for commit, push, merge, tag, GitHub Release, or PR.

```text
任务类型：Git / Release 收口

只处理 git / release，不修改源码、文档、测试、package.json。

第一步先输出：
1. git status --short
2. git log --oneline -n 3
3. 当前分支
4. 准备 stage / commit / push / tag / release 的文件或命令
5. 风险判断

未经我确认，不要执行：
- git add
- git commit
- git push
- git merge
- git tag
- gh release
- gh pr create
- gh pr merge

完成后报告：
1. 当前分支
2. 最新 commit hash / tag / release URL，如有
3. git status 是否干净
4. 是否同步 origin
5. 本次处理文件列表
```

## 6. Level Data / Generation

Use for level candidates, generated data, or formal level writes.

```text
任务类型：关卡数据任务

目标：
【生成候选 / 审查候选 / 写入正式关卡】

禁止：
- 不要运行任何带 --write 的脚本，除非我单独确认。
- 不要覆盖、插入或重排已有正式关卡，除非任务明确要求。
- 不要修改存档 key。
- 不要修改其他玩法数据。

要求：
1. 候选先 dry-run / 输出到临时文件。
2. 正式入库前必须 validate。
3. 检查 id 唯一、顺序、可访问、难度曲线、runtime 规则兼容。
4. 报告是否改变关卡数量和玩家可见范围。

验证：
- npm run validate:levels
- 【对应 solver / analyzer】
- 【必要 e2e】
```

## 7. UI / Animation Review

Use before visual polish sprints.

```text
任务类型：UI / 动效只读审查

只读审查，不要修改文件。

检查页面：
- 首页 / Puzzle Book
- 关卡选择页
- GameView
- WinPanel / LosePanel
- Settings / GM / Playtest，如相关

输出：
1. 总体结论
2. 最大 5 个表现力问题
3. 设计原则
4. 必做小范围高收益项
5. 中等范围项
6. 暂不做项
7. 需要人工截图审核的点
8. 建议分支名和 commit 边界
```
