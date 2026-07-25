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

## Star Double Teaching Curriculum (Lv.1–10)

Star Double Lv.1–10 is a completed, proof-driven teaching curriculum. These rules apply to any task touching Star Double lessons, contracts, proof engine, or lesson UI.

### Immutable Facts

- Lv.1–10 are formal, human-accepted courses. Do not treat them as work-in-progress.
- Lv.11–60 are production levels and must not be modified as part of teaching tasks.
- All lesson conclusions come from the live board, regions, and quota — never from a fixed solution or canonical path.
- The proof engine supports 7 techniques (see `docs/star-double-proof-driven-lessons.md`). Do not add techniques without a full contract, simulation, and E2E cycle.

### Prohibited Patterns

When modifying or adding Star Double teaching content, the following are forbidden:

- **Fixed coordinates.** Do not use `actionCells`, static cell indices, or hardcoded positions to drive teaching steps. All targets must come from `activeProof.derivedTargets`.
- **Solution-driven teaching.** Do not read `solution`, `revealPath`, or `canonicalPath` to determine what the player should do next.
- **No-proof pass-through.** Do not allow board input when `activeProof` is null, has empty targets, or has a stale `boardStateHash`.
- **Button-skip SETUP.** SETUP completion must require real player actions and real board conditions. Do not advance SETUP with a fixed action count.
- **Fixed-count step advancement.** Do not advance teaching steps after N actions without checking the semantic completion predicate.
- **Teaching card obstruction.** Teaching cards must not obscure the board; the board remains the primary visual focus.

### UI and Design Sync

- Any UI change to teaching cards, highlights, or feedback must also update `docs/ui-design-system.md` if it introduces a new reusable rule.
- Observation cells and evidence cells must use distinct visual semantics and must not look like final answers.
- Derived targets must never be highlighted in Guided or Transfer Practice phases.
- Player-facing action language: `place-star` = "在确定的位置放置星星"; `eliminate` = "把不能放星的位置标成 X".

### E2E Testing Rules

- Curriculum E2E must use real pointer operations. Do not inject solution steps, write board state directly, or use static answer coordinates.
- The E2E proof bridge (`VITE_E2E_PROOF_BRIDGE=1`) must not exist in production builds.
- Consecutive level-switch E2E must verify runtime isolation (old proofs do not leak into the new level).
- Completion records must only write the level that was actually won.

### Git Boundaries

- Local commits for documentation are permitted when the task explicitly authorizes them.
- Push, PR, merge, and tag require separate, explicit authorization.
- Do not modify Lv.11–60 level data, solver, validator, or formal progress schema in a teaching task.

## Codex Final Report

For implementation tasks, report modified files, what changed, protected areas that did not change, validation commands and results, and Git status when relevant. Use clear, concise language suitable for a product owner.
