# 原型隔离合同（Prototype Isolation Contract）

> 本文档是 Linebook 产品体系的**通用原型隔离合同**，面向所有未来原型（数字环线、日月、黑洞或其他候选玩法），不只服务于数字环线。它是 `docs/game-family-design-system.md` 第七部分「新玩法接入合同」的工程补充，也是 P3B Should #6「原型数据隔离约定」的正式冻结文档。
>
> **状态：正式生效（P4A 冻结）**
>
> 自 P4A 起，所有原型 Spike 与完整原型工程包都必须遵守本合同。数字环线 Spike 的具体范围另见 [`docs/digital-loop-edge-input-spike.md`](./digital-loop-edge-input-spike.md)。

---

## 1. 目的

原型隔离用于在**不污染正式产品**的前提下验证高风险假设：

- 验证高风险交互（例如边线输入、命中区域、拖动手感）。
- 验证新的 board / runtime 类型（第三类 board/runtime 是否可通过 P3B 接缝隔离接入）。
- 验证玩法规则可行性（规则是否成立、是否可解释、是否值得进入正式设计流程）。
- 防止未成熟原型污染正式产品（入口、存档、进度、关卡目录、registry）。
- 防止原型数据被误认为正式关卡或正式模式（包括关卡选择页、推荐、重玩、完成仪式与统计）。

核心原则：**原型是实验，不是产品**。原型存在的唯一目的是产出可裁决的证据；原型本身不承诺任何正式玩法形态。

## 2. 生命周期状态

每个原型必须明确处于以下一个状态，且状态必须记录在原型目录的 `PROTOTYPE.md`（或等价 README）中：

| 状态 | 含义 |
| --- | --- |
| Proposed | 已提出想法，仅有文档与设计，未编写任何原型代码 |
| Active Spike | 正在进行小规模技术验证（输入、命中、性能、结构判定） |
| Review | Spike 已产出证据，正在评审；只允许修复评审中发现的问题 |
| GO | 裁决通过，允许进入后续完整原型工程包（不等于正式上线） |
| GO WITH CHANGES | 裁决有条件通过，必须先修改指定问题（输入方式、棋盘密度、命中区域、状态模型或视口方案） |
| NO-GO | 裁决不通过，原型封存或删除，不进入完整原型开发 |
| Promoted | 已通过正式注册流程成为正式玩法（走正式 family/mode 合同） |
| Archived | 已结束生命周期，代码封存或删除，入口移除，数据清理 |

### 状态权限矩阵

「允许」表示该状态默认允许；未列出的活动一律禁止。「诊断数据」指原型自己的临时数据；「正式存档/正式进度」指任何 `cg_*` 正式玩家数据 key。

| 活动 | Proposed | Active Spike | Review | GO | GO WITH CHANGES | NO-GO | Promoted | Archived |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 编写原型代码 | 否 | 是 | 仅修复评审问题 | 是（下一阶段） | 是（修复变更项后） | 仅清理代码 | 是（正式开发） | 否 |
| 创建诊断数据 | 否 | 是（prototype 前缀） | 否（已有数据只读） | 是（prototype 前缀） | 是（prototype 前缀） | 否（进入清理） | 否（使用正式数据） | 否 |
| 出现在开发入口 | 否 | 是（DEV-only） | 是（DEV-only） | 是（DEV-only） | 是（DEV-only） | 否 | 否（正式入口） | 否 |
| 进入正式 registry（`GAME_MODES`） | 否 | 否 | 否 | 否 | 否 | 否 | 是（走正式合同） | 否 |
| 写入正式存档 | 否 | 否 | 否 | 否 | 否 | 否 | 是 | 否 |
| 写入正式进度 | 否 | 否 | 否 | 否 | 否 | 否 | 是 | 否 |
| 创建正式关卡 | 否 | 否 | 否 | 否 | 否 | 否 | 是（正式生产流程） | 否 |
| 对玩家开放 | 否 | 否 | 否 | 否 | 否 | 否 | 是 | 否 |

## 3. 目录隔离

推荐目录合同（具体原型使用 `<prototype-id>` 占位，命名见第 13 节的数字环线示例）：

```
src/prototypes/<prototype-id>/          # 原型全部代码，禁止散落
src/prototypes/<prototype-id>/data/     # 原型关卡/诊断数据
src/prototypes/<prototype-id>/tests/    # 原型单元测试
e2e/prototypes/<prototype-id>.spec.js   # 原型浏览器测试（如需要）
```

合同规则：

- **原型代码不得放入正式玩法目录**：禁止写入 `src/game/`、`src/components/`、`src/hooks/` 的正式模块路径。
- **原型数据不得放入正式关卡数据目录**：禁止写入 `src/data/`（现有正式关卡目录）；既有 dev candidate 机制（`src/config/devLevelCandidates.generated.js`、`/tmp/star-line-candidates/` 等）已有 `.gitignore` 忽略规则，原型不得借用这些路径充当通用原型目录。
- **原型测试不得伪装成正式生产门禁**：原型测试与正式 E2E 分离，原型测试不进入正式回归门禁，正式 CI 不因原型测试失败而阻塞。
- **可复用中性工具，但正式 runtime 不得反向依赖原型**：原型可以复用 `src/utils/` 等中性工具；正式代码（`GAME_MODES`、`getModeRuntime`、App、GameView、session 层）禁止 import 原型目录。
- **删除原型目录后，正式构建与正式玩法必须仍然成立**：原型目录必须是可整体删除的叶子依赖；删除后 `npm run build` 与正式玩法不受影响。

## 4. 入口隔离

原型只能通过**明确的开发模式或开发参数**进入，生产构建默认不可见。

- 复用现有 DEV 双重门槛机制（`src/App.jsx`：`import.meta.env.DEV` 自动启用，或 URL `?playtest=1` 显式启用）。
- 推荐入口形式（本轮只冻结形式，不决定 UI 样式）：
  - DEV-only route（例如 `/#/prototype/<prototype-id>` 或独立 hash 段）。
  - DEV-only query（例如 `?prototype=<prototype-id>`）。
  - Playtest / GM 工具入口（现有 `GmPanel`、`DevCandidateInfoPanel`、`StarLinePlaytestPanel` 同级的开发面板）。
- 原型入口**必须满足**：
  - 不进入首页正式入口（`HomeOneLineEntry` / `HomeStarLineEntry`）。
  - 不进入关卡选择页（`LevelSelectBrowser` / `PuzzleBookPage`）。
  - 不进入 `GAME_MODE_LIST` / `ONE_LINE_MODE_LIST` / `STAR_LINE_MODE_LIST`。
  - 不进入 `GAME_FAMILIES` 的正式玩家目录。
  - 不进入推荐关卡、继续游戏或重玩体系（`cg_level_select_replay_v1`、完成仪式）。
  - 不得通过 unknown mode fallback 误入正式玩法：原型入口必须显式判定，`getModeRuntime()` 对未知 mode 保持 fail-closed，原型不得注册占位 mode 再利用 fallback 进入。

## 5. 数据与持久化隔离

原型默认：

- 不写正式 saved-game key（`cg_classic_v2_saved_game`、`cg_hidden_saved_game`、`cg_diagonal_saved_game`、`cg_portal_saved_game`、`cg_star_line_*_saved_game` 等）。
- 不写正式 progress key（`cg_classic_v2_progress`、`cg_hidden_progress`、`cg_diagonal_progress`、`cg_portal_progress`、`cg_star_line_progress_v2` 等）。
- 不写金币（`cg_coins`）、不写道具（`cg_items`）、不写奖励、不写解锁。
- 不写推荐状态（`cg_level_select_replay_v1`、`cg_level_select_completion_ceremony_v1`）。
- 不写正式统计。
- 不改变 package 版本（原型阶段不升 version、不打 tag、不 Release）。

如原型确需临时保存调试数据：

- 必须使用明确 prototype 前缀：`cg_prototype_<prototype-id>_*`。
- 必须可一键删除（通过 DEV 面板按钮或一次性清理脚本）。
- 必须不与正式 schema 兼容混用（不同 key、不同结构，禁止复用正式 normalization 读原型数据）。
- NO-GO 或删除原型时必须一并清理（见第 9 节）。

## 6. Runtime 隔离

- 原型可以验证新的 board / runtime 类型（例如数字环线的边线 board），验证方式为**开发专用装配层**直接渲染原型棋盘，不经过 `GAME_MODES`。
- 在 GO 前不得注册为正式 `GAME_MODES` mode；`RUNTIME_BOARDS` / `RUNTIME_SESSIONS` 是正式 registry 的一部分，原型不得向其中添加条目。
- 不得为了原型扩展正式玩家目录（`catalogVisible`、`GAME_FAMILIES` 派生结果不得因原型改变）。
- 不得让 App 出现散落的 prototype mode 字符串分支；原型装配集中在一个入口模块，App 对原型只有「检测到开发参数 → 挂载原型装配层」一个调用点。
- GO 后必须重新经过 family/runtime 正式注册流程（第 8 节）。
- 原型代码不能被视为自动晋升的生产实现：Spike 代码在晋升时按正式合同重写或系统化，而非直接复制。

## 7. 测试与验证

区分四类验证：

| 类型 | 内容 | 阶段 |
| --- | --- | --- |
| 诊断测试 | 原型纯函数/状态机单元测试（坐标、命中、结构判定） | Spike 期间每轮可运行 |
| 原型交互测试 | 原型聚焦浏览器测试、真实渲染、人工鼠标/触摸板/触摸体验 | Spike 期间每轮可运行 |
| 正式 E2E | 完整 Playwright 套件（正式玩法回归门禁） | 仅在特定节点运行一次 |
| 产品人工验收 | 非开发人员试玩、视觉与手感签字 | Review / GO 前后 |

预算规则：

- Spike 阶段不要求每次迭代运行完整 E2E 套件。
- 原型方向未稳定前，只运行：静态检查、原型聚焦测试、必要 build、浏览器真实渲染、人工输入体验。
- GO 前必须执行一次正式影响面回归（确认原型及其装配没有改变正式玩法行为与存档）。
- 正式晋升后再进入完整 E2E 门禁。
- 完整 E2E 只在以下情况运行一次：原型需要影响正式 runtime；或 P4C 准备 GO；或正式晋升前。

## 8. 晋升合同

原型从 Spike 晋升正式玩法（Promoted）前，必须重新确认以下全部条目，且必须回到 `docs/game-family-design-system.md` 的正式流程（设计流程 13 步 + 新玩法接入合同 + Go/No-Go 门槛）：

- 正式 family（现有家族或经论证的新家族）。
- 正式 mode id（唯一标识，不沿用原型内部 id）。
- runtime descriptor（`{ board, session, interactions }`，经 `GAME_MODES` 注册）。
- levelSchema（文档性声明，与正式关卡数据字段一致）。
- inputCapabilities（输入能力声明）。
- 教学注册（P3B Should #5 正式实施后）。
- 关卡 schema 与正式关卡数据。
- 存档 schema（namespace、结构、迁移策略）。
- 进度和奖励（正常推进、sealed、replay、ceremony、金币/道具边界）。
- 正式目录入口（首页、关卡选择页、GAME_MODE_LIST）。
- E2E 识别（正式 E2E 导航与断言）。
- 文档（设计系统、UI 规范、关卡规范、路线图）。
- 版本规划（package 版本、CHANGELOG、Release 计划）。

## 9. 清理合同

NO-GO 或 Archived 时：

- 删除或封存入口（移除 DEV 装配点、URL 参数处理、面板入口）。
- 删除原型数据（`src/prototypes/<prototype-id>/data/`）。
- 删除临时存储（`cg_prototype_<prototype-id>_*` 全部 key）。
- 删除无用依赖（原型引入的测试工具、脚本；不得为原型新增正式依赖）。
- 保持正式 registry 无残留（`GAME_MODES`、`RUNTIME_BOARDS`、`GAME_FAMILIES` 与原型无关）。
- 不保留死 mode id（原型内部 id 不得出现在正式代码路径）。
- 不影响正式玩法测试（删除原型后完整 E2E 不受影响）。

## 10. P3B 状态

本合同由 P4A 冻结。完成本合同后：

- **P3B Should #6 原型隔离：完成**（本合同即该 Should 项的正式交付物）。
- **P3B Should #5 教学注册：仍未实施**（不在 P4A 范围）。
- **P3B 整体：仍为 PARTIAL**（runtime 核心接缝已实施，两个 Should 项之一完成，工程包尚未整体关闭）。

## 参考

- [`docs/game-family-design-system.md`](./game-family-design-system.md) —— 玩法家族权威规范（第七部分接入合同、第九部分 P3B 完成状态）
- [`docs/digital-loop-edge-input-spike.md`](./digital-loop-edge-input-spike.md) —— 数字环线 Spike 的具体合同（本合同的应用实例）
- [`ROADMAP.md`](../ROADMAP.md) —— 路线与阶段状态
- `src/config/gameModes.js` —— `GAME_MODES` 正式 registry（代码层权威来源）
- `src/App.jsx` —— DEV 双重门槛（`import.meta.env.DEV` / `?playtest=1`）
