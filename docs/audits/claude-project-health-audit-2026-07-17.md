# One-Line 项目健康审查报告

- 审查日期：2026-07-17
- 审查执行：Claude Code（多视角只读体检：普通玩家 / 产品设计者 / 前端维护者 / 测试与发布负责人）
- 报告性质：只读审查。除本报告外未产生任何仓库改动，未修改业务代码、关卡数据、测试或存档结构。

---

## 1. 审查环境

| 项 | 值 |
| --- | --- |
| 仓库 | /Users/happyelements/Documents/GitHub/One-Line- |
| 平台 | macOS (Darwin 25.5.0) |
| Node 工具链 | Vite 8.0.8（实际解析版本）、React 19、Playwright 1.61、Tailwind 3.4 |
| package.json version | 0.23.0 |
| 测试框架 | 仅 Playwright E2E（无单元测试框架）+ 4 个挂在 npm scripts 的 node 脚本测试 |

## 2. Git 状态与 HEAD

| 项 | 预期 | 实际 | 结论 |
| --- | --- | --- | --- |
| 分支 | main | main | ✅ |
| HEAD | d84d16e | d84d16e32dff4093ad89989ed65348f644cf0f0d | ✅ |
| 与 origin/main | 同步 | 同一 SHA，无 ahead/behind | ✅ |
| 工作区 | 干净 | `git status --short` 为空 | ✅ |
| PR #27 | 已合并 | HEAD 即 PR #27 merge commit | ✅ |

基线与预期完全一致，审查按计划执行。

## 3. 执行过的命令

只读检查：`git status --short` / `git branch --show-current` / `git rev-parse HEAD` / `git log -1 --oneline` / `git rev-parse origin/main` / `git ls-files` 系列 / 大量 `grep` / 源码阅读。

验证命令（按验证预算）：

1. `npm run build` —— 一次正式 build
2. `npm run validate:levels` —— 关卡数据完整性验证
3. `npm run validate:hidden` —— Hidden 60 关唯一解验证
4. `npx playwright test` —— 一次完整 E2E（未重复运行）
5. 数据不变量补充校验：审查 agent 以只读 node 脚本对 portal 30 关 / hidden 60 关 / curated 60 关 / Star Line 70 关做了全量结构校验（未写入任何文件）

未执行：`npm audit`（网络受限，记为未验证）；lint（非本轮验证目标）。

## 4. 验证结果

| 验证 | 结果 | 说明 |
| --- | --- | --- |
| `npm run build` | ✅ 通过（1.32s） | 产物 dist/ 正常；警告：单 JS chunk 630.75 kB（gzip 182.52 kB）超 500 kB 阈值 |
| `npm run validate:levels` | ✅ 4611/4611 通过，0 errors | 15 条警告：star-lv-45~51、star-lv-69 等 N=10 但 difficulty=easy「可能过大」 |
| `npm run validate:hidden` | ✅ 4228/4228 通过 | 60 关全部唯一解 |
| 完整 E2E（chromium，dev server） | ❌ **182 通过 / 5 失败**（6.7 分钟） | 5 个失败全部在 `e2e/star-line-teaching.spec.js`，全部同因：PR #27（83e0c8b）将文案「星星」统一为「星点」、双星说明改写，但测试断言未同步。失败证据保存在 `test-results/star-line-teaching-*/error-context.md`。按预算未重跑第二次完整 E2E，未做代码修复。 |
| 数据不变量补充校验 | ✅ 全部通过 | 70 个 Star Line 关卡 id 唯一、regions/solution/quota/相邻规则全部合法；portal 传送门成对且相邻步合法；hidden path 连续满盘 |

E2E 失败明细（首次失败记录）：

- T6.1 / T6.5 / T6.6 / T6.9：期望子串「这一列已有星星」，实际文案已是「这一列已有星点，把其余空格标成 X。」
- T7.1：期望 `/需要\s*2\s*个\s*星点，相邻规则不变/`，实际为「双星开始每行、每列、每片星域各放 2 个星点；星点不能相邻。」

结论：**main 分支当前处于 E2E 红灯状态**，属于测试断言过时（功能本身按新文案正常），根因是无 CI 门禁（见 OL-31）。

## 5. 项目总体健康评分

**66 / 100**

扣分依据（在 100 分基础上）：

- −8：P1-01 Hidden 存档触发全关解锁 + 引导性删档（玩家高概率遭遇的进度体系破坏）
- −6：P1-02 生产环境 `?playtest=1` 后门（解锁全部/清存档/显示全部答案），对解谜产品是成就体系级风险
- −6：P1-03 main E2E 红灯 + 无 CI，质量门禁全部依赖手工自觉且已实际失守
- −6：P2 层规则文案缺失（交叉规则零说明）、双星入口劫持、竞态死棋盘、拖动漏格等玩家可感问题群
- −4：文档/版本体系与实现严重脱节（0.23.0 落后 43 commits；星线 30 关 vs 实际 70 关）
- −2：测试体系结构性弱点（vacuous pass、portal/hidden 无通关测试、108 处固定延时）
- −2：维护债务（死代码三件套、双源硬编码、遗留 starLine 模式、initGame 无星线分支）

加分面（避免误判为更低分）：核心规则实现经全量校验正确；数据层 8839 项检查零错误；存档迁移设计（gate/marker/不覆盖旧数据）谨慎；监听器/定时器清理纪律好；选择器纪律与存储隔离测试质量高。

## 6. 各维度评分

| 维度 | 得分 | 主要依据 |
| --- | --- | --- |
| 功能与规则 | 78 | 四种一笔画 + 双星线规则实现与判定经全量校验正确；扣：hidden 解锁绕过（P1）、交叉规则无文案、竞态窗口 |
| 玩家体验 | 72 | 导航/状态表达整体清晰且不止颜色；扣：Toast 偏移、10px 核心状态、双星劫持、静默删档、误导报错文案 |
| 数据与存档 | 70 | 迁移与隔离设计谨慎、星线 v1/v2 隔离经测试确认；扣：hidden hasSave 缺陷波及存档安全、NaN/null 无自愈、开新关静默弃档 |
| UI 一致性 | 68 | 新规范体系完整、焦点样式健康；扣：令牌只有星线消费、4 份复制的野生按钮、双遮罩明度不一致、themeTokens 死文件分叉 |
| 架构与维护性 | 62 | 模块划分清楚；扣：死代码三件套、双源硬编码、遗留 starLine 全链路、initGame 无星线分支、文档漂移 |
| 测试体系 | 55 | 182 用例、隔离/契约测试优秀；扣：main 红灯、8 个 vacuous pass、portal/hidden 无通关测试、无 CI、108 处固定延时 |
| 性能与稳定性 | 80 | 监听器/写盘纪律好、无每帧全树重渲染证据；扣：拖动漏格、630KB 单 chunk、pointermove 内 hit-test |
| 发布可靠性 | 50 | build 通过、SPA 无路由 404 风险；扣：playtest 后门、版本/CHANGELOG 停在 0.23.0、生产构建零测试覆盖、无 CI |

---

## 问题清单说明

每条含：编号 / 等级 / 分类 / 标题 / 是否已验证 / 证据 / 文件与行号 / 复现条件 / 玩家影响 / 技术影响 / 推荐处理 / 修改范围 / 修复风险 / 置信度。
问题类型区分：已确认缺陷、高风险隐患、设计债务、测试盲区、可选优化。

## 7. P0 问题

**无。** 应用可运行、可构建，六种玩法均可完成，未发现大面积存档损坏或产物不可用。

## 8. P1 问题

### OL-01 · P1 · 已确认缺陷 · 存档/进度
**Hidden 模式存在任一存档时，全部 60 关解锁、全关显示「继续」书签，且 CTA 会引导玩家静默销毁存档**

- 是否已验证：是（主审与规则审查两路独立走查，代码闭环一致）
- 证据：`src/hooks/useLevelList.js:81-89` hasSave 判定末项 `(portalModeSelected || hiddenModeSelected || savedLevelInfo.levelIdx === entry.levelIdx)` —— hidden 短路为 true，不比对 levelIdx；而 hidden 全部条目 diff 均为 'easy'（`src/utils/levelNavigation.js:34-39`），故任一 hidden 存档使 60 个条目 hasSave 全真。连锁：`useLevelList.js:100-101` `entry.levelIdx <= normalUnlockedThroughIndex || hasSave` → 全部解锁；`src/components/PuzzleBookPage.jsx:221` 每个 tile 渲染书签；`PuzzleBookPage.jsx:88-90` CTA 取第一个 hasSave 条目（恒为第 1 关）显示「继续存档」；点击非存档关后 `src/hooks/useGameSession.js:390` 恢复条件 `saved.levelIdx === lvl` 不满足 → `initGame` 默认 `clearSavedGame=true`（`useGameSession.js:238,242-244`）删除存档。
- 复现条件：hidden 任意关游玩中「保存并退出」→ 返回 hidden 选关页。
- 玩家影响：解锁体系被破坏（跳关直达第 60 关）；全关书签误导；点 CTA「继续存档」实际进入第 1 关并删掉真实存档，进行中进度丢失。
- 技术影响：hidden 的解锁/继续语义全部失真；E2E 无 hidden 保存流测试（见 OL-30），长期未暴露。
- 推荐处理：hidden 分支比对 `savedLevelInfo.levelIdx === entry.levelIdx`（与 classic 一致）；同批补一条 hidden 保存→恢复 E2E。
- 预计修改范围：小（1 行判定 + 1 条测试）｜修复风险：低｜置信度：高

### OL-02 · P1 · 已确认缺陷 · 发布风险
**生产构建可通过 `?playtest=1` 打开 Star Line Playtest 面板：任意跳关、显示全部答案、解锁全部、清空存档**

- 是否已验证：是（代码链 + 本次生产 build 产物字符串证据：`dist/assets/index-*.js` 含 `playtest`、`解锁全部` 等 playtest 动作文案；GmPanel 专属 DEV 代码则已被摇除）
- 证据：`src/App.jsx:294-295` `isPlaytestMode = isDev || new URLSearchParams(window.location.search).has('playtest')`；处理器无任何 isDev 守卫：`App.jsx:663-674` 解锁全部、`676-688` 清空存档、`643` 显示答案（`App.jsx:641` 全部关卡 solution 本就随 `src/data/starLineLevels.js` 打包进产物）；渲染链 `App.jsx:1052-1056` → `src/components/game/GameView.jsx:249-271` → `src/components/StarLinePlaytestPanel.jsx:107-181`；HUD GM 按钮 `src/components/game/GameHud.jsx:130-141`。README「Playtest Panel」段落公开了该参数。
- 复现条件：生产部署地址加 `?playtest=1` 进入任意星线关。
- 玩家影响：任何知道参数的玩家（攻略站一旦传播即全体玩家）可看答案、解锁全部、一键清档；解谜游戏的成就与进度体系失去意义；清空存档按钮还构成误操作丢档风险。
- 技术影响：GM/Playtest 能力进入生产 bundle；与 CLAUDE.md「不得把 GM/Playtest/debug 暴露为玩家可达内容」直接冲突。README 公开文档化使其不属于隐蔽后门，若为有意的测试渠道，也应在正式发布前收口。
- 推荐处理：产品先裁决该参数是否为「有意的公测通道」。若否：渲染与处理器统一改为仅 `import.meta.env.DEV`；若是：至少移除「清空存档」「解锁全部」的生产可达性，并从 README 移除参数说明。补一条基于 `vite preview` 的生产 gating 测试（配合 OL-24）。
- 预计修改范围：小｜修复风险：低（纯 gating）｜置信度：高

### OL-03 · P1 · 已确认缺陷 · 测试与发布流程
**main 分支 E2E 处于红灯：PR #27 术语统一改文案未同步测试，5 个教学用例失败；根因是无任何 CI 门禁**

- 是否已验证：是（本次完整 E2E 实测：182 通过 / 5 失败）
- 证据：失败断言见本报告 §4；改动源 83e0c8b（2026-07-17「ui: 统一玩家玩法说明与术语」）触及 10+ 组件与文案配置但零 e2e 更新；`.github` 目录不存在，无任何 CI 配置；`npm test` 未包含 4 个 node 脚本测试。对照：14cfed5（视觉重构）同批更新了 star-line.spec.js，说明团队有同步意识但无机制兜底。
- 复现条件：`npx playwright test e2e/star-line-teaching.spec.js`
- 玩家影响：本次失败本身无玩家影响（是断言过时）。真正的风险是：红灯常态化后，下一个真实回归会被淹没。
- 技术影响：质量门禁完全依赖开发者手动执行；关键门禁脚本（如 `scripts/test-star-line-catalog-diversity.mjs` 防重复关卡）无人自动运行（见 OL-33）。
- 推荐处理：① 修正 5 条断言至新文案（小改动）；② 建立最小 CI（PR 时跑 `playwright test` + 4 个已挂 npm scripts 的 node 测试 + 关卡门禁脚本）。注意 `.github/workflows` 属受保护区域，需单独授权任务执行。
- 预计修改范围：断言修复小；CI 建设中｜修复风险：低｜置信度：高

## 9. P2 问题

### OL-04 · P2 · 已确认缺陷 · 玩法规则/文案
**diagonal 与 portalClassic 强制「路径不可交叉」，但玩家侧零文案；交叉被拒时报错文案答非所问**

- 已验证：是（代码走查）
- 证据：规则 `src/game/rules/levelConfig.js:19` `allowCrossing:false`；执行 `src/game/rules/movement.js:77-89`、`src/hooks/usePathInteraction.js:105-108,115-118`；`src/config/gameExplanations.js:13-21,31-40` 全库无「交叉」玩家文案；交叉被拒时 toast 为「请从当前路径末端继续」（`usePathInteraction.js:106`）——玩家此刻就在末端。
- 复现：diagonal 任意关尝试斜线交叉已有线段。
- 玩家影响：无法从任何渠道学到核心限制；报错与实际原因不符，玩家会归因为「游戏坏了」。
- 技术影响：文案系统（gameExplanations）与规则系统（levelConfig）缺少对账机制。
- 推荐处理：diagonal/portal 说明补一句「线不能交叉」；交叉拒绝时单独文案。
- 范围：小｜风险：低｜置信度：高

### OL-05 · P2 · 已确认缺陷 · 玩法规则/文案
**portalClassic 实际八向移动，但说明/RuleCard 从不提斜向；其 firstHint 是永不显示的死文案**

- 已验证：是
- 证据：`levelConfig.js:32-36` PORTAL_RULE 继承 DIAGONAL_RULE；`src/config/gameModes.js:124` movement=diagonal；数据校验确认关卡路径含对角步。`src/hooks/useGameSession.js:375` `!isPortalMode(...)` 把 portal 排除在首关提示外 → `gameExplanations.js:36` portalClassic.firstHint 不可达。
- 玩家影响：不知道可以走斜线的玩家会在传送门关卡卡住（该模式关卡必须走斜线才能完成）。
- 推荐处理：portal 说明补「斜向也可以走」；删除或接通 firstHint。
- 范围：小｜风险：低｜置信度：高

### OL-06 · P2 · 已确认缺陷 · 星线教学
**「重新查看教学」会拦截全部双星选关；重播中途退出后条件落盘，变成永久强制跳转单星第 1 关**

- 已验证：是（代码闭环）
- 证据：`src/App.jsx:271-284` `needsOperationGuide = !completed || replayRequested` 满足即把双星选关重定向到单星第 1 关；`src/hooks/useStarLineGuide.js:193-203` `beginReplay` 置 `operation.completed=false` 且保持 `replayRequested=true` 并持久化 `cg_star_line_guidance_v1`；中途退出后两条件同时为真。设置面板 toast「下次进入单星第 1 关时播放」（`App.jsx:1122-1125`）暗示被动行为，与主动拦截不符。无取消重播途径。
- 复现：设置 → 重新查看教学 → 进单星第 1 关 → 教学中途退出 → 此后任何双星选关均被踢回单星第 1 关。
- 玩家影响：老玩家点了「重新查看」后，双星入口被持续劫持且无法自行解除（唯一出口是完整做完 4 步教学）。
- 技术影响：replayRequested 语义（被动重播）与实现（主动门槛）不一致。
- 推荐处理：拦截条件改为仅 `!completed`；replay 走「进入单星第 1 关才触发」的被动路径，或提供取消重播入口。
- 范围：小-中｜风险：中（教学状态机需回归 star-line-teaching E2E）｜置信度：高

### OL-07 · P2 · 已确认缺陷（窗口窄） · 星线状态机
**通关判定后的 1000/1300ms 延迟窗口内保存退出，恢复后得到「已完成但永不弹胜利」的死棋盘**

- 已验证：代码路径确认（未实测触发）
- 证据：`src/App.jsx:601-611` 完成后 status 仍 'playing'，winPanelDelay（单星 1000ms/双星 1300ms，`src/game/starLine/starLineFeedbackTiming.js`）后才 handleWin；窗口内退出提示可用并保存完成态棋盘（`App.jsx:573-589`）；恢复时 `App.jsx:552` `starLineWonRef.current=true` 守卫 + `App.jsx:612` `!isComplete` 分支永不执行 → 永不判胜；同时 `src/components/game/StarLineBoard.jsx:286,692` 因 isComplete 禁用输入与撤销。
- 复现：星线通关瞬间 1 秒内点返回 → 保存并退出 → 恢复该关。
- 玩家影响：棋盘满足全部规则却不判胜、不能操作、不能撤销，只能重开重做整关。
- 技术影响：恢复路径缺「已完成局」检测。相关联：同窗口内保存后回到首页，计时器仍触发 markWon 删掉刚保存的存档（`App.jsx:601-625` 计时器不随视图切换清理，P3 级另记于 OL-17）。
- 推荐处理：恢复星线 session 时若 grid 已 isComplete，直接走胜利流程或丢弃该存档；或保存时禁止保存完成态。
- 范围：小｜风险：中（触碰胜负判定路径，属受保护区域，需授权）｜置信度：中高

### OL-08 · P2 · 已确认缺陷（窗口窄） · Hidden 状态机
**hp=0 后 550ms 判负延迟窗口内可保存出 0 HP「死档」，且从选关页内联恢复不校验 hp**

- 已验证：代码路径确认（未实测）
- 证据：`src/hooks/usePathInteraction.js:143-155` hp 归零延迟 550ms 才 markLost；`src/hooks/useGameSession.js:429-452` handleSaveAndExit 不清 `hiddenLossTimeoutRef`、不校验 hp>0；首页恢复有 `saved.hp > 0` 过滤（`useGameSession.js:127`），但选关页点击走的内联恢复（`useGameSession.js:380-398`）无此校验 → 恢复 0 HP 残局，再错一次立即判负。
- 玩家影响：低概率保存出一开局即濒死/直接判负的残局，体验为「存档坏了」。
- 推荐处理：handleSaveAndExit 前 flush/取消 pending 判负；内联恢复复用 getSavedGameResume 的校验。
- 范围：小｜风险：低-中（存档路径，需授权）｜置信度：中高

### OL-09 · P2 · 已确认缺陷 · 交互质量
**一笔画快速拖动漏格：采样点间无插值 + 45% 格心命中死区，高速划线误报「请从当前路径末端继续」**

- 已验证：代码确认（帧率阈值未实测）
- 证据：`src/hooks/usePathInteraction.js:261-273` 仅对当前事件点 `elementFromPoint` 且要求距格心 <0.45×min(w,h)；`291-300` 不补齐跳过格。对照星线侧已实现四分之一格步长插值（`src/hooks/useStarLineInputController.js:35-49`），一笔画未同步该改进。
- 复现：9×9 hard 盘快速划过 3+ 格。
- 玩家影响：快速操作被误判断线、连击中断，高级玩家高频遭遇。
- 推荐处理：把星线的插值方案移植到 usePathInteraction（属玩法交互区域，需授权）。
- 范围：中｜风险：中｜置信度：高

### OL-10 · P2 · 已确认缺陷 · 存档体验
**从选关页进入与存档不同的关卡，会静默删除该模式进行中存档，无任何确认**

- 已验证：是
- 证据：`src/hooks/useGameSession.js:380-398` 存档不匹配目标关时走 `initGame`，默认 `clearSavedGame=true`（`:238,242-244`）直接 `safeRemoveStorageItem`。classic/diagonal 有书签标记缓解误点；星线选关页 hasSave 恒 false（`src/hooks/useLevelList.js:81-82`）完全无提示，重玩旧关的存档最易被无感清除；hidden 则因 OL-01 全关都是假书签，情况最差。
- 玩家影响：进行中进度丢失且不可恢复；玩家无法预知「点别的关=弃档」这一规则。
- 技术影响：单存档槽语义可以接受，但缺少「将放弃当前存档」确认或星线书签展示。
- 推荐处理：不匹配时弹确认（复用现有退出确认样式）；或至少为星线补 hasSave 展示。
- 范围：中｜风险：中（触碰保存/恢复路径，需授权）｜置信度：高

### OL-11 · P2 · 已确认缺陷 · 文档与版本
**版本与文档体系整体漂移：0.23.0 后 43 个提交无版本号/CHANGELOG；README/ROADMAP 称星线 30 关，实际 70 关已上架；生产规范文档把已上架的 40 关标「预留（未生产）」**

- 已验证：是
- 证据：`package.json:4`=0.23.0、CHANGELOG 顶部 v0.23.0（2026-07-14）、最新 tag v0.23.0，`git log v0.23.0..HEAD` 43 commits（含 v0.24/0.25/0.26 命名分支的 PR #21-#27）；`src/data/starLineLevels.js` 70 关（单星 60 + 双星 10），`getStarLineLevelCount` 直接驱动玩家入口；README 多处「共 30 关」；`docs/star-line-production.md:11`「star-lv-31 – star-lv-70 … 预留（未生产）」。另 README「五种玩法入口」vs 实际 6 入口。
- 玩家影响：无直接影响（文档为开发侧）。
- 技术影响：发布时无法从任何文档确定「发的是什么」；生产规范文档是关卡入库门禁依据，状态列错误会误导后续生产决策；`docs/temp-week-notes-2026-07-08.md` 自定删除条件已触发仍保留。
- 推荐处理：作为独立发布整理任务：补 CHANGELOG（0.24-0.26 段）、更新 README/ROADMAP/star-line-production 关卡口径、bump version、删临时笔记。
- 范围：中（纯文档）｜风险：低｜置信度：高

### OL-12 · P2 · 高风险隐患 · 工程基线
**被 gitignore 的 `src/config/devLevelCandidates.generated.js` 被 GmPanel 以字面量动态 import，新 clone 构建存疑**

- 已验证：**未验证**（本机文件存在故 build 通过；计划的「移走文件后定向 build」验证因工具环境临时受限未能执行，见 §16）
- 证据：`.gitignore:27` 忽略该文件且未 tracked；`src/components/GmPanel.jsx:67` `import('../config/devLevelCandidates.generated.js')` 字面量路径无 `/* @vite-ignore */`；GmPanel 被 `App.jsx:7` 静态 import。Rollup 对字面量动态 import 在构建期解析模块图，文件缺失时预期报 "Could not resolve"。README 本地运行章节未提示需先 `npm run export:dev-level-candidates` 生成。
- 玩家影响：无（构建期问题）。
- 技术影响：新环境（CI、新成员、部署机）clone 后 `npm run build` 可能直接失败。
- 推荐处理：先在干净目录实测；若确认，改为 try/catch 包裹的 `/* @vite-ignore */` 变量路径，或提交一个空的占位模块。
- 范围：小｜风险：低｜置信度：中

### OL-13 · P2 · 已确认缺陷 · UI/反馈
**GameToast 的居中 `translateX(-50%)` 会被 motion 动画合成的 transform 覆盖，Toast 实际不居中**

- 已验证：代码语义确认（未实测截图）
- 证据：`src/components/GameToast.jsx:14` style 同时含 `transform:'translateX(-50%)'` 与展开的 `{...toastEnterExit}`；`src/config/motionPresets.js:25-30` 动画 x/scale——motion/react 动画期以自身合成 transform 覆盖静态值，左缘锚定在 50% 处向右偏。
- 玩家影响：画线出错等高频提示出现在偏右位置，削弱与棋盘的空间关联。
- 推荐处理：改用 `left:'50%'` + motion 的 `x:'-50%'` 起始值，或外层定位内层动画。
- 范围：小｜风险：低｜置信度：中高（建议合并修复时先截图确认）

### OL-14 · P2 · 已确认缺陷 · UI/可读性
**Hidden 模式核心资源「剩余尝试」用 10px 灰字，违反自家排版规范**

- 已验证：是
- 证据：`src/components/game/GameHud.jsx:197` `text-[10px]`（orange-200/75）；规范 `docs/ui-design-system.md:62`「11px 以下文字不得承担玩家必须读取的规则、状态」；hp 归零即判负（`usePathInteraction.js:143-155`）。
- 玩家影响：最需要盯住的数值最小最灰，玩家可能在不知情时输掉。
- 推荐处理：提升字号/对比至规范层级，与非 hidden 模式 HP 显示同级。
- 范围：小｜风险：低｜置信度：高

### OL-15 · P2 · 高风险隐患 · 响应式
**矮窗口（视口高约 <650px）下结果面板/规则卡无滚动导致按钮出屏；星线桌面壳会裁掉撤销工具栏**

- 已验证：布局计算确认（未实跑窗口矩阵）
- 证据：`src/components/WinPanel.jsx:99-112`、`src/components/RuleCard.jsx:49-50` fixed 居中无 max-height/overflow，完整内容约 530-600px 高；`src/index.css:2214-2219` 星线壳 `height:100dvh; overflow:hidden` + `:2308` 棋盘 clamp 下限 30rem，视口高 <~652px 时总高超出，底部撤销/辅助高亮被裁。常见 1280×720 / 1440×900 无碍。
- 玩家影响：半屏窗口或 125% 缩放的 720p 下，「下一关/开始挑战」不可达、星线失去撤销入口。
- 推荐处理：面板加 `max-h-[90dvh] overflow-y-auto`；星线壳最小高度降级策略。
- 范围：小-中（纯样式）｜风险：低｜置信度：中高

### OL-16 · P2 · 测试盲区 · 测试体系
**结算核心测试可静默通过：win-lose 8 个用例依赖 React fiber 内部结构读取 gridData，取不到时 `if (!gridData) return` 直接变绿**

- 已验证：是
- 证据：`e2e/win-lose.spec.js:115,128,143,170` `if (!gridData) return;`、`:204,211,220,228` `if (!triggered) return;`；`e2e/helpers/game-state.js:92-129` 遍历 React 19 fiber 找状态——React 升级或 hook 形状变化即全部静默通过；`e2e/core-flow.spec.js:288-299,309-317` 键盘负向测试同样整体包在 `if (visible)` 中。
- 技术影响：胜利/失败面板真回归时测试不报警，是「测试通过但功能可能损坏」的最大单点。
- 推荐处理：守卫改为硬断言（`expect(gridData).toBeTruthy()`）；逐步用 data-testid/存储断言替代 fiber 读取。
- 范围：小-中（仅测试）｜风险：低｜置信度：高

### OL-17 · P2 · 测试盲区 · 测试体系
**玩法×流程覆盖缺口：portal 与 hidden 从无「真实通关」测试；starDouble 无终关与下一关推进；One Line 各模式无刷新恢复测试；生产构建零测试**

- 已验证：是（全 spec 覆盖矩阵盘点）
- 证据：全库无任何 portal 通关断言（portalClassic 仅散见于 core-flow/game-shell/levels 的提示与切换）；hidden 仅失败流（`e2e/core-flow.spec.js:53-81`）；`e2e/core-flow.spec.js:215-227` 双星通关后未点下一关，star-lv-30 终关从未通关；`page.reload` 仅存在于星线隔离与 batch spec；`playwright.config.js:33-38` webServer=`npm run dev`，「正式版不含 GM」类断言（`e2e/batch-eval-apply.spec.js:101` 等）全部在 DEV=true 下运行，无法证明生产 gating。
- 技术影响：传送门核心机制（穿门正确性）、hidden 通关写进度、双星边界完全无回归保护；OL-02 的生产 gating 也因此无测试。
- 推荐处理：补 portal/hidden 各一条进入→通关→下一关；starDouble 终关；一条基于 `vite preview` 的生产 smoke。
- 范围：中（仅测试）｜风险：低｜置信度：高

### OL-18 · P2 · 测试盲区 · 测试体系
**测试脆弱性系统化：约 108 处 `waitForTimeout` 固定延时 + 15-25 个用例耦合中文文案，本次 5 个失败即此模式的现实化**

- 已验证：是（grep 全量清单 + 本次 E2E 失败）
- 证据：固定延时分布（最大 2900ms）见 `e2e/dev-candidate-review.spec.js`（24 处）、`core-flow.spec.js`（14 处）等；文案耦合如 `e2e/levels.spec.js:37,114-115`、`hidden.spec.js:8,25-26`、`star-line-teaching.spec.js:113,115`；时间型负断言 `e2e/star-line.spec.js:326`。对照良好实践：`core-flow.spec.js:12-24` 已用 `page.clock` 冻结时钟并从 src 导入时序常量。
- 技术影响：文案迭代（产品常态）每次都会碎一批测试；并行负载下固定延时随机失败，掩盖真 flaky。
- 推荐处理：修复 5 条红灯断言时，顺同批把 teaching 系文案断言改为 data-testid + 结构断言；固定延时逐步替换为 clock/事件等待（不必一次性清零）。
- 范围：中（仅测试）｜风险：低｜置信度：高

## 10. P3 问题

### OL-19 · P3 · 设计债务 · 死代码
**死代码三件套及关联误导：`FloatingScore.jsx`、`pathValidation.js`（算法与真实实现分叉，文件头自称「所有移动必须通过此模块」为假）、`themeTokens.js`（色值与 index.css 令牌分叉）；另有 GameHud 非星线分支内约 10 处永假的 `isStarLine` 三元（`GameHud.jsx:148-244`）与死样式 `.starline-cell:focus-visible`（`index.css:554-557`）**
已验证：是。玩家影响：无；技术影响：后续按错误入口修改（尤其 pathValidation 的交叉判定是错误算法）。处理：删除或标注。范围：小｜风险：低｜置信度：高

### OL-20 · P3 · 设计债务 · 存储
**声明未使用/无 UI 的存储项：`cg_music_vol` 有读写与 state 但无 UI、soundEngine 无音乐通道（`App.jsx:157-158,319-331`、`SettingsPanel.jsx` 仅音效滑块）；`cg_hidden_best_steps` 定义未实现（`gameModes.js:146`，`App.jsx:508` 传硬编码空值）；`cg_star_line_records` 三模式共享声明但 v2 模式从不写**
已验证：是。处理：删声明或补实现，避免下次迭代误信这些 key 有数据。范围：小｜风险：低｜置信度：高

### OL-21 · P3 · 高风险隐患 · 异常数据
**损坏存储无自愈路径：`parseInt` 得 NaN 后回写「NaN」永久中毒（coins `useInventory.js:7-14`→道具/购买全瘫、globalScore `useProgress.js:27-34`、音量 `App.jsx:315-331`）；classic/diagonal/hidden progress 的 readJson 无形状校验（`useProgress.js:18-25,37-48,63-65`，portal/星线有 normalize），若 key 内容为字面 `"null"`，`useLevelList.js:71,74` 对 null 取属性将使选关页崩溃**
已验证：代码确认（未注入实测）。触发概率低，但属「数据损坏导致无法进入」类。处理：readNumber 加 Number.isFinite 回退；readJson 加形状守卫（需授权的存储路径小改）。范围：小｜风险：低｜置信度：高

### OL-22 · P3 · 高风险隐患 · 结算竞态
**保存退出与延迟结算的竞态族（窗口约 0.9-1.3s）：一笔画 900ms 完成窗口内保存退出，`completionTimeoutRef` 不被清理，回到列表后仍触发 handleWin/markWon 删掉刚保存的存档（`usePathInteraction.js:224-227`、`useGameSession.js:414-423,429-452`）；星线同窗口同型问题（`App.jsx:601-625`）。进度写入本身正确，损失的是「刚保存的续玩入口」**
已验证：代码确认。处理：handleSaveAndExit 时清 pending 完成/判负计时器（与 OL-07/OL-08 同批修）。范围：小｜风险：中（存档+胜负路径，需授权）｜置信度：高

### OL-23 · P3 · 高风险隐患 · 星线状态机
**星线胜利 effect 机制脆弱：cleanup 无条件清 pending win timer，重跑因 wonRef 守卫不再重排（`App.jsx:601-625`）。当前 deps 在窗口内恰好全部稳定（星线 timerRunning 恒 false）故不是活缺陷；任何给 handleWin/依赖引入变化的未来改动都会让通关静默失效**
已验证：是（机制确认）。处理：win timer 与 effect 生命周期解耦（ref 持有、显式清理点）。范围：小-中｜风险：中｜置信度：高

### OL-24 · P3 · 设计债务 · 会话架构
**initGame 无星线分支：进入星线仍执行 curated/classic 生成器灌入无用 session grid，星线存档靠 `path:[0]` hack 通过通用校验（`useGameSession.js:247-311`、`App.jsx:578-588` 注释自认）；恢复存档时 `comboStreak` 被置为历史 maxCombo（`useGameSession.js:314-329` + `:429-452` 只存 maxCombo），恢复后连击起点虚高、结算 comboBonus 偏大**
已验证：是。处理：initGame 增星线早退分支；保存增 comboStreak 字段或恢复时归零。范围：小-中｜风险：中（计分路径，需授权）｜置信度：高（连击影响量级小）

### OL-25 · P3 · 设计债务 · 双源硬编码
**同一事实多处硬编码，扩关必分叉：hidden `levelCount:60`（`gameModes.js:144`）vs `getHiddenLevelCount()`（`useGameResultFlow.js:25` 用数据长度、存档校验用硬编码）；curated `BASE={easy:10,medium:15,hard:20}`（`curatedLevels.js:3804`）vs `CLASSIC_STRUCTURE`（`gameModes.js:23-27`）；星线目录升迁边界硬编码 `'star-lv-20'→'star-lv-31'`、`'star-lv-30'→'star-lv-71'`（`useProgress.js:88-93`），且旁注「no star-lv-31 yet」已与现实（31-70 已上架）不符**
已验证：是（当前值经校验一致，无现行错误）。处理：单一来源化 + 注释纠偏。范围：小｜风险：低｜置信度：高

### OL-26 · P3 · 设计债务 · 遗留模式
**旧 `starLine` 混合模式全链路残留：GAME_MODES 完整配置、useGameResultFlow 写旧 key 分支（`:177-186`）、App playtest 分支、PuzzleBookPage `STAR_LINE_SECTIONS`（`:15-20`）、e2e helper 死路径及其自测（`e2e/helpers/navigation.js:57`、`levels.spec.js:222-226`）。玩家不可达（不在 MODE_LIST），属兼容遗留，但持续增加每次星线改动的理解与回归成本**
已验证：是。处理：待老玩家 v1 迁移期结束后集中下线；短期仅加「遗留勿扩展」注释。范围：中（清理时）｜风险：中｜置信度：高

### OL-27 · P3 · 已确认缺陷 · 可访问性/一致性
**WinPanel 在 window capture 阶段无条件拦截 Enter/Space/Escape（`WinPanel.jsx:66-75`，第二个 effect `:77-89` 为冗余子集），LosePanel 则有 `closest` 限定（`LosePanel.jsx:16-26`）——同类面板行为不一致，且胜利面板期间全页键盘失效、按钮可聚焦不可激活；弹层普遍无 `role="dialog"`/`aria-modal`；星线胜利徽章 `aria-hidden` 却承载有效文案（`WinPanel.jsx:170`）**
已验证：是。不建议恢复键盘玩法，仅对齐 LosePanel 的限定实现与语义标注。范围：小｜风险：低｜置信度：高

### OL-28 · P3 · 已确认缺陷 · 动效
**prefers-reduced-motion 覆盖不完整：CSS 侧完备，JS 侧 WinPanel 全部动画、GameToast spring、GameBoard 错误抖动/whileTap、GameView 首关提示未接 `prefersReducedMotion`（对照 GameHud/StarLineGuideOverlay 已正确接线）；未配置全局 MotionConfig**
已验证：是。玩家影响：减弱动效用户仍见弹跳/抖动，信息本身无丢失。范围：小｜风险：低｜置信度：高

### OL-29 · P3 · 设计债务 · UI 体系
**语义令牌层实际只被星线消费（`var(--ui-` 在 index.css 仅 11 处、JSX 0 处）；模式主 CTA 按钮串在 `gameModes.js:135/177/199/221` 复制 4 份；LosePanel 复活/购买确认两处近似 amber 按钮各写一遍；统一禁用态只覆盖 button-primary/secondary（`index.css:1048-1055`）；胜/负遮罩层数不一致（胜=GameStatusLayer 80% + WinPanel 自带背板叠加，负=单层）**
已验证：是。规范自身允许渐进迁移，不算违规；列为债务防止第三套并行体系出现。范围：中（渐进）｜风险：低｜置信度：高

### OL-30 · P3 · 已确认缺陷 · 星线交互边缘
**退出确认弹出不 flush 星线待定单击：275ms 单击定时器（`useStarLineInputController.js:153-167`）在打开退出确认后仍会提交落 X，随后被「保存并退出」存进存档；另拖动中 `disabled` 仅拦 pointerdown 不终止进行中手势（`:262` vs `:237-259,313-330`），教学步骤切换/通关瞬间的进行中拖动仍会加 X（无实际损害路径，撤销/重开可解）**
已验证：是（触发罕见）。处理：打开任何弹层时 flush/取消待定单击。范围：小｜风险：低｜置信度：中

### OL-31 · P3 · 设计债务 · 工程卫生
**工程卫生杂项：① 5 个孤儿测试脚本不被任何入口执行（含关键门禁 `test-star-line-catalog-diversity.mjs` 防重复关卡）+2 个孤儿生成脚本；② `docs/temp-week-notes-2026-07-08.md` 自定删除条件已触发仍在库；③ `tmp/` 仅按子目录忽略，新文件会变 untracked 可提交（`.gitignore:33-34`）；④ eslint files 不含 `.mjs`（scripts/ 全部不被 lint）且根目录 node 配置用 browser globals（`eslint.config.js`）；⑤ vite 未配置 `base`，当前根域部署无碍、换子路径部署即 404（`vite.config.js`）；⑥ dev 工具内嵌命令错误：`App.jsx:791` 复制出的 `npm run apply:staged-levels -- --seeds ...` 脚本名与参数均不存在（正确为 `apply:level-candidates -- --keys`，对照 `GmPanel.jsx:439`）**
已验证：是（⑤为条件性）。范围：小｜风险：低｜置信度：高（④中 lint 实际报错情况未运行验证）

### OL-32 · P3 · 设计债务 · 计分体系
**Portal 星级与最佳步数数学退化：完成条件恒使 steps=N²-1，30 关 targetSteps 全部等于 N²-1（数据校验确认）→ `calculatePortalStars` 恒 3 星、bestSteps 恒等于 target、2 星/1 星分支不可达（`portalRules.js:143-147`、`pathCompletion.js:1`、`useGameResultFlow.js:102-106`）**
已验证：是。玩家影响：星级失去区分度（但无错误判定）。属产品决策项：要么取消 portal 星级展示，要么改 targetSteps 语义。范围：中（产品先决）｜风险：中｜置信度：高

### OL-33 · P3 · 可选优化 · 性能
**性能小项（均无可感知卡顿证据，不构成缺陷）：`usePathInteraction` 每 pointermove 做 elementFromPoint+getBoundingClientRect（星线侧已在 pointerdown 缓存 rect，可对齐）；`useLevelList` 的 useMemo 被 App 内联对象 deps 击穿，每渲染重建 60+ 条目并同步读 localStorage（`App.jsx:495-517`、`useLevelList.js:50`）；StarLineBoard 每格 hover 整板重渲染；单 JS chunk 630KB 无代码分割（build 警告）；音量滑块每 tick 写 2 个 storage key**
已验证：是。处理：仅在出现真实卡顿反馈时动手；chunk 分割可在下次构建配置调整时顺带。范围：小-中｜风险：低｜置信度：高

### OL-34 · P3 · 设计债务 · 教学
**星线操作教学步骤 2/3 只认「单次完整手势」，玩家逐格单击标完 X 后只会收到 nudge，会话内无自愈（重进/重开才对账，`StarLineBoard.jsx:253-260,338-357`）；首关提示触发条件 `lvl===0` 不限难度且仅内存记忆，medium 第 1 关也弹「从 1 出发」、每次刷新重现（`useGameSession.js:150,375-377`）**
已验证：是。范围：小｜风险：低（教学状态机需回归）｜置信度：高

## 11. 测试盲区（汇总）

正式条目见 OL-16/17/18，此处为完整清单：

| 盲区 | 现状 | 风险 |
| --- | --- | --- |
| portal 通关/失败/存档/终关 | 完全无测试，无专门 spec | 传送门核心机制无回归保护 |
| hidden 通关与进度写入 | 仅失败流有测试 | 通关判定/进度写入回归无感知；OL-01 长期未暴露即例证 |
| hidden/diagonal 保存-恢复 | 无 | 存档兼容改动风险盲区 |
| starDouble 终关、下一关推进 | 无（单星有完整边界组） | 双星边界回归盲区 |
| One Line 各模式 mid-game 刷新恢复 | 无（星线有） | 刷新恢复回归盲区 |
| 生产构建（vite preview） | 零测试；「不含 GM」断言全在 DEV 下跑 | OL-02 类 gating 回归无法被发现 |
| classic 通关后 progress key 更新 | 无直接断言（解锁被 seeding 绕过） | 真实解锁链只有零星覆盖 |
| 8 个 vacuous pass 用例 | fiber 依赖 + if-return | 结算回归静默变绿 |
| 关卡门禁脚本 | 5 个孤儿，无人自动跑 | 重复/劣质关卡可无声入库 |
| 存档迁移（classic v1→v2） | 无 | 仅星线迁移有高质量测试 |

测试体系亮点（避免误伤）：selectors.js 集中管理且无孤儿 testid；beforeEach 清理纪律完整；star-line-storage-isolation 与教学契约测试质量高；`page.clock` 范式已在 core-flow 落地；无 test.skip/fixme/.only。

## 12. 维护风险（汇总）

1. **流程性**：无 CI（OL-03）+ 版本/CHANGELOG 停更（OL-11）+ 门禁脚本孤儿（OL-31①）——三者叠加意味着「main 可发布」这一判断当前没有任何机器保证。
2. **知识性**：死代码与错误注释（OL-19/25 的 pathValidation 假声明、useProgress 过时旁注、star-line-production 状态表错误）会误导后续 AI/人工修改，是本项目特有的高杠杆风险（开发高度依赖文档驱动的 agent 工作流）。
3. **结构性**：遗留 starLine 模式（OL-26）、initGame 无星线分支（OL-24）、双源硬编码（OL-25）让「下一个星线迭代」的每一步都要多考虑一层兼容。
4. **测试性**：文案耦合断言（OL-18）使产品文案迭代（高频操作）每次都产生测试维护税。

## 13. 被排除的伪问题或无效建议

| 项 | 排除理由 |
| --- | --- |
| 复活 HP 与 hidden/portal 初始 HP 不一致 | 走查证伪：hidden 无复活按钮（`LosePanel.jsx:37`），portal diff 恒 'easy' 且开局 HP=复活 HP=3，classic/diagonal 一致 |
| 购买确认可能刷负金币 | `useItemLogic.js:110` 有前置 canAfford 拦截，确认框打开期间金币无扣减路径 |
| hidden hard 章节尺寸显示错误 | 数据证伪：hidden 31-60 关实际 N=7，`chapterSize` 显示 7×7 正确 |
| 一笔画无回退/撤销 | 实现层确认不存在，属刻意设计（断点续连 + 数字顺序强制），不列缺陷 |
| WinPanel 下一关连点跳两关 | `nextLevelTarget` 为派生 useMemo，双击幂等重开同关 |
| 键盘玩法残留 | 全部 keydown 监听均为「阻止激活」或 dev 面板 ESC，`cg_input_mode` 仅存在于兼容测试，符合决策 |
| 移动端全面适配 | 已明确封存（docs/mobile-refactor-plan.md），仅保留 OL-15 的桌面矮窗口问题 |
| StarLineBoard 内联样式 | 仅 3 处且全部为动态值，符合 CLAUDE.md 豁免 |
| 弹层不支持点遮罩/ESC 关闭 | 全部弹层行为一致，属产品选择，不构成误导 |
| 「useMemo/React.memo 覆盖率」类泛性能建议 | 无每帧全树重渲染证据，不列为问题（仅 OL-33 记录有证据的小项） |
| npm audit | 网络受限未执行，记为未验证而非缺陷 |
| Star Line N=10 标 easy 的 15 条数据警告 | validate 脚本自身输出的软警告，难度标签当前不参与玩家可见逻辑，不单列 |

## 14. 推荐整改顺序

1. **立即（发布阻断级预防）**：OL-03 断言修复（让 main 回绿）→ OL-02 playtest 收口 → OL-01 hidden hasSave 一行修复。三者都小、独立、可当天完成。
2. **第二批（存档与结算安全）**：OL-22/07/08 竞态族统一修（同一批清理 pending timer + 恢复校验）+ OL-10 弃档确认 + OL-21 读取自愈。
3. **第三批（玩家沟通正确性）**：OL-04/05 规则文案 + OL-13 Toast 定位 + OL-14 小字 + OL-06 教学劫持。
4. **第四批（测试体系）**：OL-16 vacuous pass 消灭 + OL-17 覆盖补齐 + CI 建立（OL-03 后半）+ OL-18 渐进去脆弱。
5. **第五批（文档与债务）**：OL-11 版本文档整理 → OL-19/20/25/26/31 债务清理 → OL-32 portal 星级产品决策。
6. **按需**：OL-15 矮窗口、OL-27/28 一致性、OL-33 性能项。

## 15. 建议拆分的整改 Package

### Package A：「红灯与后门」发布安全包
- 解决：OL-03（断言）、OL-02、OL-01
- 玩家收益：进度体系不可作弊、hidden 不再误删存档；工程收益：main 回绿
- 修改范围：小（约 3 个文件 + 5 条测试断言）；主要风险：低
- 顺序：第 1；适合一次性集中修改：是
- 验证：`playwright test e2e/star-line-teaching.spec.js e2e/hidden.spec.js` + 一次完整 E2E + `vite preview` 手验 ?playtest=1

### Package B：存档与结算竞态包（需存档/胜负区域授权）
- 解决：OL-07、OL-08、OL-22、OL-23、OL-10、OL-21、OL-24（恢复连击部分）
- 玩家收益：保存永远可信——保存的进度不会被延迟计时器删掉、不会恢复成死棋盘/死档、弃档前有确认
- 修改范围：中（useGameSession/App 星线 effect/usePathInteraction 保存路径）；主要风险：中（触碰受保护的存档与胜负逻辑，需按 CLAUDE.md 做读写路径全检索 + 兼容计划）
- 顺序：第 2；适合一次性集中修改：是（同一根因族）
- 验证：save-restore + star-line-storage-isolation + core-flow 定向，加一次完整 E2E

### Package C：规则文案与反馈可读性包
- 解决：OL-04、OL-05、OL-13、OL-14、OL-06、OL-34（首关提示部分可选）
- 玩家收益：能学到全部规则、报错说人话、关键状态看得清、双星入口不再被劫持
- 修改范围：小-中（gameExplanations/GameToast/GameHud/App 教学拦截条件）；主要风险：低-中（文案改动必须同步 e2e 断言——正是 OL-18 教训）
- 顺序：第 3；适合一次性集中修改：文案类是；OL-06 建议单独 commit
- 验证：涉及文案的全部 spec 定向 + 一次完整 E2E

### Package D：测试体系加固包（仅测试与 CI）
- 解决：OL-16、OL-17、OL-18、OL-31①（门禁脚本入 CI）、OL-03 的 CI 部分
- 玩家收益：间接——未来回归在合并前被拦截
- 修改范围：中（仅 e2e/ 与 .github/workflows，后者需单独授权）；主要风险：低
- 顺序：第 4（A 完成 main 回绿后立刻启动，避免 CI 首跑即红）
- 验证：CI 自证 + 本地一次完整 E2E

### Package E：文档与版本对齐包（纯文档）
- 解决：OL-11、OL-31②、OL-25 注释部分、OL-19 的文档侧（mobile-refactor-plan 中 FloatingScore 提法）
- 玩家收益：无直接；发布收益：可确定「发的是什么」
- 修改范围：中（纯 markdown + version bump）；主要风险：低（不碰代码）
- 顺序：第 5；适合一次性集中修改：是；建议按 CLAUDE.md 作为独立任务，不与代码混批
- 验证：文档 diff 审阅，无需 build/E2E

### Package F：债务清理包
- 解决：OL-19、OL-20、OL-26（评估后）、OL-24（initGame 分支）、OL-29（渐进）、OL-31③④⑤⑥、OL-32（产品决策后）
- 玩家收益：无直接；收益是降低后续每次迭代的出错面
- 修改范围：中-大（分多批）；主要风险：中（OL-26 遗留模式下线需迁移期确认）
- 顺序：最后，且不宜一次性集中——按「删除类（低风险）→ 结构类（需回归）」分小批
- 验证：每批一次完整 E2E

## 16. 未能验证的项目

| 项 | 原因 | 建议 |
| --- | --- | --- |
| OL-12 新 clone 构建失败假设 | 计划的「移走 generated 文件 → 定向 build → 还原」验证因执行环境临时受限未能运行（文件现状未被改动） | 在干净目录 `git clone && npm ci && npm run build` 实测一次 |
| npm audit 依赖安全 | 网络受限 | 有网环境下只读执行一次 |
| OL-13 Toast 偏移的视觉实证 | 未做截图实测（代码语义置信度中高） | 修复前先 dev 环境触发 toast 截图确认 |
| OL-15 矮窗口裁切的窗口矩阵实测 | 纯布局计算推导 | 修复时以 1280×650 以下窗口手验 |
| eslint 对根目录 node 配置文件的实际报错 | 本轮未运行 lint | 顺 Package F 时跑一次 `npm run lint` |
| E2E 5 个失败的「定向复现」 | 未重跑：失败证据（截图/视频/error-context.md）已由首轮运行完整保存于 test-results/，无需消耗第二次运行 | 修复断言后仅定向跑该 spec |

## 17. 最终结论

One-Line 当前是一个**核心玩法扎实、数据质量过硬、但发布与守护体系明显滞后于功能速度**的项目。六种玩法的规则实现、关卡数据（8839 项自动校验零错误）、星线拖动状态机与存档迁移设计都经得起逐行检验；真正的问题集中在三个「缝」上：

1. **状态与 UI 的缝**（hidden hasSave、竞态窗口、教学劫持）——单点小 bug，但都落在玩家最敏感的进度与存档上；
2. **开发态与生产态的缝**（?playtest=1、dev-only E2E、版本停更）——项目至今按「内部试玩」标准运行，尚未切换到「对外发布」标准；
3. **变更与验证的缝**（main 红灯、vacuous pass、无 CI）——文案改动这类最日常的迭代已经实际击穿了测试体系。

好消息是：P1 三项的修复都很小（合计约 10 行代码 + 5 条断言 + 一个 gating 决策），Package A 一天内可让项目回到「绿灯 + 无后门 + 存档安全」的可发布基线。建议在启动下一个功能迭代（如星线 71+ 关或新玩法）之前，先完成 Package A/B，并把 CI 立起来——否则本次审查发现的「测试通过但功能已坏」模式会随功能速度继续放大。

---

*报告生成于 2026-07-17，基于 HEAD d84d16e。本轮审查未修改任何业务代码、关卡数据、测试或存档结构；唯一新增文件即本报告。*
