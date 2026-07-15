# One-Line AGENTS.md

This file defines Codex-specific working rules for One-Line.

## Project Priorities

When tradeoffs conflict, use this order:

1. Preserve gameplay and rule correctness.
2. Preserve save data and progress compatibility.
3. Keep the change minimal and localized.
4. Preserve player clarity and experience.
5. Keep the code maintainable.
6. Improve performance or visual detail only when it does not compromise the above.

Do not trade gameplay, saves, or progress for visual polish.

## Codex Task Boundaries

Before an implementation task, identify the allowed files, protected areas that may be affected, required validation, and whether Git write operations are authorized.

- A read-only request permits inspection and reporting only. Do not edit files or run scripts that write data.
- An implementation request permits the smallest change needed for its stated goal and file boundary.
- Do not change unrelated business code, even when it is nearby or could be refactored.

The following are protected. When the current task does not explicitly authorize one of them, perform a read-only review and do not modify it:

- Gameplay rules, path validation, movement, or win/loss behavior.
- Level data, level generation, solver, or validator logic.
- Save keys, localStorage structure, saved-game format, progress, scoring, unlocks, or migration logic.
- `.github/workflows`.

When a protected area is explicitly authorized, make the smallest change that satisfies the request. Do not require a second confirmation merely because the area is high-risk. Changes to save or storage structure require a migration and backward-compatibility plan in the task scope.

For UI, layout, visual, or copy tasks, do not also change gameplay, saves, progress, level data, scoring, or unlocks.

## Player UI and Formal Terms

Player-facing UI must use player language, not development language. Do not expose development status, GM, Playtest, debug features, prototype/demo wording, validation-only wording, or unshipped level promises as normal player-facing content.

On game pages, keep the board as the first visual focus. HUD, tools, toasts, and panels should support solving rather than compete with it. Mode differences must use more than color alone.

For Star Line formal UI:

- 星点 is the object placed on the board.
- 单星规则 means each row, column, and region needs 1 star.
- 双星规则 means each row, column, and region needs 2 stars.
- Do not mix rule quotas with ordinary level star ratings; completion copy should emphasize rule completion.

## Validation and Stop Conditions

Choose validation by task risk. Do not default to pressure matrices, repeated identical runs, or tests unrelated to the change.

| Task type | Minimum validation |
| --- | --- |
| Documentation or instruction files only | Inspect diff, formatting, and references; do not run build or E2E. |
| Small UI change | Verify the target page and run one related E2E test. |
| Ordinary code change | Run targeted validation and one full E2E run. |
| Levels, solver, or validator | Run specialized validation, boundary cases, and one full E2E run. |
| Saves or confirmed unstable issue | Run specialized validation and one full E2E run; repeat the full run only for a confirmed flaky, concurrency, or environment-instability reason. |

For validator and solver work, boundary cases are required and runtime and validation rules should agree whenever practical. If a required test fails or is not run, report the reason and result clearly.

Stop when the stated acceptance criteria are met. Do not expand the task to pursue unrelated cleanup.

## Git and Release Safety

- Read-only Git operations may run without additional approval.
- Create a local commit only when the current task explicitly authorizes committing.
- Push, merge, tag, and GitHub Release actions require explicit authorization for the exact target.
- Do not develop or commit directly on `main`.
- Do not force-push unless the user separately and explicitly authorizes it.
- Treat release actions as a separate release task; do not combine them with unrelated code or documentation work.

Before an authorized Git write, show the relevant working-tree and target status plus the exact command or files to be affected.

## Codex Final Report

For implementation tasks, report modified files, what changed, protected areas that did not change, validation commands and results, and Git status when relevant. Use clear, concise language suitable for a product owner.
