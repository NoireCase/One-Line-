# One-Line AGENTS.md

This file defines project-level rules for AI agents working on One-Line.

## User Context

The project owner is a game marketing and product planning professional, not a software engineer.

When working on this project:

- Explain technical concepts in simple language.
- Prefer maintainable solutions over complex architecture.
- Break large work into small executable steps.
- Always explain what files changed.
- Always explain how to test the change.
- Do not over-engineer.
- Focus on shipping working product increments.
- Act as a senior product engineer, not a coding tutor.

## Project Priorities

Use this order when tradeoffs conflict:

1. Preserve gameplay correctness.
2. Preserve save data and progress compatibility.
3. Keep changes minimal and localized.
4. Keep the product understandable for players.
5. Improve UI polish and product feel.
6. Add architecture only when it removes real risk or repeated work.

## High-Risk Areas

Treat these as high-risk unless the user explicitly says otherwise:

- Gameplay rules.
- Solver logic.
- Validator logic.
- Level data.
- Save keys and localStorage structure.
- Scoring, stars, rewards, unlocks, win/loss flow.
- Release, tag, push, merge, PR, and GitHub Release operations.

High-risk work should normally use two steps:

1. Read-only review and smallest safe plan.
2. Implementation only after the user confirms the plan or file boundary.

## Task Boundaries

Before editing, identify:

- Allowed files.
- Forbidden files.
- Whether gameplay, saves, levels, solver, validator, scoring, or unlocks may change.
- Required validation commands.
- Whether git operations are allowed.

If the request says UI-only, do not modify rules, levels, solver, validator, save structure, scoring, or unlock flow.

If the request says read-only, do not modify files and do not run write scripts.

## Player-Facing Copy Rules

Player UI must use player language, not development language.

Do not show these in player-facing UI:

- 开发中
- 样板关
- 当前开放
- 用于验证
- prototype / demo
- GM / Playtest as a normal player feature
- future level promises such as “100 关全新挑战” unless actually shipped

Development status belongs in README, CHANGELOG, ROADMAP, or temporary planning notes.

## One-Line UI Rules

- The board is the first visual focus on game pages.
- HUD, tools, toast, and panels must support solving, not compete with the board.
- WinPanel is a reward page, not a grading report.
- LosePanel should clearly tell the player what to do next.
- Mode differences cannot rely only on color; use symbols, copy, state, and board behavior.
- Avoid dashboard-like UI in player screens.
- Avoid heavy visual effects, large rewrites, and new dependencies for polish.

## Star Line Rules

Use these terms in formal UI:

- 星点: the object placed on the board.
- 单星规则: each row, column, and region needs 1 star.
- 双星规则: each row, column, and region needs 2 stars.

Avoid mixing Star Line rule quota with normal level star ratings.
Star Line completion should emphasize rule completion, not pass/fail grading by star rating.

## Validation Expectations

After changes, report what was run and the result.

Common commands:

- `npm run build`
- `npm run validate:levels`
- `node scripts/test-star-line-solver.mjs`
- `npm run test:e2e`
- targeted Playwright tests when UI flows change

For validator or solver work, tests must include boundary cases, not only happy paths.
Validator rules should match runtime rules whenever practical.

## Git Safety

Git / Release work must be a separate task.

Do not run these unless explicitly authorized in the current conversation:

- `git add`
- `git commit`
- `git push`
- `git merge`
- `git tag`
- `gh release create`
- `gh pr create`
- `gh pr merge`

Before authorized git write operations, show:

1. `git status --short`
2. recent commits or target branch status
3. exact files or command to be used

Do not mix release operations with unrelated code or documentation edits.

## Reporting Format

When finishing a task, include:

- Modified files.
- What changed.
- What did not change, especially gameplay / saves / levels / solver / validator.
- Validation commands and results.
- Current git status if relevant.
