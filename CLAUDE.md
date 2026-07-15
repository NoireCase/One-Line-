# CLAUDE.md

This file defines Claude Code execution rules for One-Line.

## Language and Output

Respond in Simplified Chinese except where English is necessary for code, file names, package names, commands, or technical terms. Keep explanations concise, structured, and actionable.

For code changes, summarize the changed files, what changed, protected areas that did not change, validation results, and whether further Git action is authorized.

## Project Priorities

When tradeoffs conflict, use this order:

1. Preserve gameplay and rule correctness.
2. Preserve save data and progress compatibility.
3. Keep the change minimal and localized.
4. Preserve player clarity and experience.
5. Keep the code maintainable.
6. Improve performance or visual detail only when it does not compromise the above.

Do not trade gameplay, saves, or progress for visual polish. Current project facts must be verified from source code, `package.json`, and relevant tests; do not treat this file as a static architecture or data inventory.

## Execution and Protected Areas

Read-only inspection commands may run directly. Edit only files within the current task boundary, and do not install dependencies, add libraries, or run data-writing scripts unless the task explicitly authorizes them.

The following are protected. When the current task does not explicitly authorize one of them, inspect and report only; do not modify it:

- Gameplay rules, path validation, movement, or win/loss behavior.
- Level data, level generation, solver, or validator logic.
- Save keys, localStorage structure, saved-game format, progress, scoring, unlocks, or migration logic.
- `.github/workflows`.

When a protected area is explicitly authorized, make the smallest change that satisfies the request. Changes to save or storage structure require searching all read/write paths, migration logic, and compatibility tests, plus a migration and backward-compatibility plan.

Current in-level interaction is mouse or touchpad led. Do not restore removed WASD, arrow-key, or input-mode switching gameplay. The legacy `cg_input_mode` value is compatibility data only, not a current feature.

## Player UI, Terms, and Styling

For UI, layout, visual, or copy tasks, do not also change gameplay, saves, progress, level data, scoring, or unlocks.

Player-facing UI must use player language, not development language. Do not expose GM, Playtest, debug features, prototype/demo wording, validation-only wording, development status, or unshipped level promises as normal player-facing content.

Keep the board as the first visual focus on game pages; supporting UI must help solving rather than compete with it. Mode differences must use more than color alone.

For Star Line formal UI, use 星点 for board objects; use 单星规则 and 双星规则 for the row, column, and region quotas; do not confuse those quotas with ordinary level star ratings.

Prefer the existing style system and tokens. Do not refactor dynamic board styles merely to remove inline styles, and do not introduce an unnecessary styling system.

## Validation and Stop Conditions

Choose validation by task risk. Do not default to pressure matrices, repeated identical runs, or tests unrelated to the change.

| Task type | Minimum validation |
| --- | --- |
| Documentation or instruction files only | Inspect diff, formatting, and references; do not run build or E2E. |
| Small UI change | Verify the target page and run one related E2E test. |
| Ordinary code change | Run targeted validation and one full E2E run. |
| Levels, solver, or validator | Run specialized validation, boundary cases, and one full E2E run. |
| Saves or confirmed unstable issue | Run specialized validation and one full E2E run; repeat the full run only for a confirmed flaky, concurrency, or environment-instability reason. |

Use the current `package.json` scripts and relevant tests to select commands. If a required test fails or is not run, state why and report the result. Stop when the stated acceptance criteria are met; do not expand the task into unrelated cleanup.

## Git and Release Permissions

- Read-only Git operations may run without additional approval.
- Create a local commit only when the current task explicitly authorizes committing.
- Push, merge, tag, and GitHub Release actions require explicit authorization for the exact target.
- Do not develop or commit directly on `main`.
- Do not force-push unless the user separately and explicitly authorizes it.
- Treat release actions as a separate release task; do not combine them with unrelated code or documentation work.

Before an authorized Git write, show the relevant working-tree and target status plus the exact command or files to be affected.
