# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Rules

All responses must be in Simplified Chinese.
Do not use English unless necessary for code, file names, package names, commands, or technical terms.
Keep explanations structured, concise, and directly actionable.

## Project Context

This is a puzzle game (One-Line) built with React + Vite.

The codebase prioritizes:

* gameplay correctness over UI perfection
* data correctness over visual polish
* simple architecture over over-engineering
* readability over abstraction
* small safe iterations over large rewrites

## Priority Rules

When making decisions, use this priority order:

1. Preserve existing gameplay behavior
2. Preserve save data and progress compatibility
3. Keep code changes minimal and localized
4. Improve readability and maintainability
5. Improve UI/UX polish
6. Optimize performance only when there is a clear issue

## Code Change Principles

* Do not introduce unnecessary libraries
* Do not refactor unrelated code
* Keep changes minimal and localized
* Prefer editing existing logic over rewriting
* Do not change game rules unless explicitly asked
* Do not change level data unless explicitly asked
* Do not change save keys or storage structure unless explicitly asked
* Do not rename public-facing modes, levels, or rules unless explicitly asked
* Do not add new product concepts unless explicitly requested
* Avoid speculative architecture changes

## Safety Rules

* Never modify game mechanics without explicit instruction
* Avoid large-scale refactoring unless requested
* Do not restructure core architecture unless explicitly required
* Preserve existing gameplay behavior unless asked to change it
* Preserve deterministic level generation unless asked to change it
* Preserve localStorage compatibility unless asked to migrate it
* If a change may affect progression, scoring, save data, or win/loss logic, call it out clearly before implementation
* If a requested change is risky, explain the risk briefly and propose a smaller safe step

## GitHub / Git Safety Rules

- You may use `gh` CLI to inspect repository, branches, PRs, checks, and release status.
- You may run read-only commands freely:
  - `git status`
  - `git diff`
  - `git diff --stat`
  - `git log --oneline -n 10`
  - `gh repo view`
  - `gh pr list`
  - `gh pr view`
  - `gh run list`
- You must ask before running any write operation:
  - `git add`
  - `git commit`
  - `git push`
  - `gh pr create`
  - `gh pr merge`
  - `gh release create`
  - any command that modifies `.github/workflows/*`

## Git Commit Rules

- Do not add `Co-authored-by: Claude`, `Co-authored-by: claude`, or any Claude-related co-author trailer to commit messages.
- Do not use Claude / claude as the git author.
- Do not use Claude / claude as the git committer.
- The commit author must use the existing NoireCase author identity already used in this repository.
- If the local git config `user.name` or `user.email` does not match the existing NoireCase author identity, stop and ask the user before committing.
- Before every commit, check:
  - `git config user.name`
  - `git config user.email`
  - `git log --format=fuller -n 1`
- After every commit, verify that the latest commit does not contain:
  - Claude as author
  - Claude as committer
  - `Co-authored-by: Claude`
  - `Co-authored-by: claude`
- Never push directly to `main`.
- Never force push unless explicitly instructed.
- Never create or modify a GitHub Release unless explicitly instructed.
- Never modify GitHub Actions workflow files unless explicitly instructed.
- Before preparing a PR, always run:
  - `npm run build`
  - `git status`
  - `git diff --stat`
- After making changes, summarize:
  - changed files
  - what changed
  - what was not changed
  - build result if available
  - whether PR is ready

## Output Style

* Use structured markdown
* Use Simplified Chinese for explanations
* When modifying code, prefer diff-style output or concise file-by-file summaries
* Explain changes briefly, avoid long explanations
* Focus on actionable changes, not theory
* Do not over-explain implementation details unless asked
* At the end of code changes, summarize:

  * modified files
  * what changed
  * whether gameplay logic changed
  * whether build/lint was run

## Development Workflow

When asked to modify the project:

1. First identify the target files
2. Make the smallest safe change
3. Avoid touching unrelated files
4. Preserve existing behavior unless explicitly asked to change it
5. Run `npm run build` when practical
6. Report whether the build passed or failed

When asked to analyze the project:

1. Point out the main problem first
2. Then give improvement options
3. Then recommend the next concrete step

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (HMR)
npm run build        # Production build to dist/
npm run lint         # ESLint (flat config, JSX + hooks rules)
npm run preview      # Preview production build locally
npm run test         # Run Playwright E2E tests
npm run test:ui      # Playwright UI mode
npm run test:debug   # Playwright debug mode
npm run test:report  # View HTML test report
```

## E2E Testing

Playwright E2E tests live in `e2e/`. 46 tests cover home, mode selection, settings, mouse/keyboard input, save/restore, win/lose panels, and Portal 2.0 (Portal Collect).

Key UI elements have `data-testid` attributes for stable selector targeting. Do not remove or rename `data-testid` without updating the corresponding test selectors in `e2e/helpers/selectors.js`.

## Tech Stack

* **React 19** (JSX only, no TypeScript)
* **Vite 8** with `@vitejs/plugin-react`
* **Tailwind CSS 3.4** with custom `tailwind.config.js` (keyframes for path animations)
* **Motion** (`motion/react` — maintained fork of Framer Motion) for animations
* **Lucide React** for icons
* No router, no state management library — all state lives in `App.jsx`

## Architecture

### Component Tree

```text
main.jsx → App.jsx (single monolithic component, ~2200 lines)
  ├── PuzzleBookPage.jsx   — mode selection + level grid (the "puzzle book")
  │     ├── ModeSwitcher.jsx    — mode focus card + mode switching track
  │     └── modePresentation.js — mode style constants (eyebrow, accent, progress)
  ├── WinPanel.jsx          — victory overlay with stars + score breakdown
  ├── LosePanel.jsx         — defeat overlay with revive/restart
  ├── SettingsPanel.jsx     — input mode, sfx volume, dev tools toggle
  ├── GameToast.jsx         — global toast (portals to document.body)
  ├── RuleCard.jsx          — "new rule discovered" cinematic reveal
  ├── DiagonalAnimation.jsx — SVG animation for diagonal unlock card
  ├── FloatingScore.jsx     — floating "+N" score labels (portals to body)
  └── PuzzleMarks.jsx       — decorative SVG path illustrations (home/empty states)
```

### View Navigation

Manual view state (`view` in App.jsx): `'home'` | `'levels'` | `'game'` | `'tut'` | `'mode'`.

There is no router. `renderViewContent()` switches on `view` to render the current screen.

### Config Modules (`src/config/`)

These are pure-logic modules separated from the render component:

| File                 | Responsibility                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `gameModes.js`       | Play mode definitions (classic/diagonal/portalClassic/portalCollect), level structure, localStorage key helpers              |
| `pathValidation.js`  | `validateMove()` — adjacency checks (4-directional and 8-directional), path crossing detection                             |
| `comboEngine.js`     | Combo streak tracking driven by path events (`success`/`failure`/`reset`), tiered multiplier table                         |
| `ruleDiscoveries.js` | Rule-card unlock triggers, such as diagonal movement unlock at classic easy level 6                                        |
| `motionPresets.js`   | Centralized Motion animation variants: cell tap, shake, float, star pop, combo pulse                                       |
| `soundEngine.js`     | Web Audio API: pentatonic scale combo tones, error beep, volume control, lazy AudioContext singleton                       |
| `themeTokens.js`     | Color palette constants (`T`) and `cellStyle()` helper for inline cell styling                                             |

### E2E Tests (`e2e/`)

| File                      | Coverage                                |
| ------------------------- | --------------------------------------- |
| `helpers/selectors.js`    | Centralized `data-testid` selectors     |
| `helpers/navigation.js`   | View navigation helpers                 |
| `helpers/game-state.js`   | localStorage + React fiber state access |
| `helpers/game-simulation.js` | Mouse drag + keyboard input simulation |
| `home.spec.js`            | Home view                               |
| `levels.spec.js`          | Mode selection + level grid             |
| `settings.spec.js`        | Settings panel                          |
| `game-mouse.spec.js`      | Mouse drag input                        |
| `game-keyboard.spec.js`   | WASD keyboard input                     |
| `save-restore.spec.js`    | Save/restore flow                       |
| `win-lose.spec.js`        | Win + lose panels                       |
| `portal-collect.spec.js`  | Portal 2.0 (Portal Collect) regression  |

## Game Data Model

* **Board**: flat array of length `N*N`. Cell shape depends on the mode:
  * Classic / Diagonal / Portal Classic: `{ val, isHidden, isRevealed, isExcluded, isHinted, portalId? }`
  * Portal Collect (Portal 2.0): additionally `{ isStart, isExit, isTarget, isObstacle }`, generated by `createPortal2Grid()` in `portalRules.js`
* **Path**: flat array of cell indices in visit order; in Classic/Portal Classic starts at the cell with `val: 1`, in Portal 2.0 starts at `portalLevel.start`
* **Coordinates**: `row = Math.floor(index / N)`, `col = index % N`
* **Level configs**:

  * Classic / Diagonal levels are procedurally generated via seeded PRNG + DFS (45 levels each, across easy/medium/hard)
  * Portal Classic levels are hand-authored (8 levels, 5×5, with `path` + `hiddenVals` + `portals`)
  * Portal Collect levels are hand-authored (2 levels, 7×7, with `start`/`exit`/`targets`/`portals`/`obstacles`)

## Path Generation (`App.jsx`)

1. `mulberry32(seed)` — deterministic PRNG from level difficulty + index
2. `generatePathDFS(N, rand, rules)` — DFS with Warnsdorff's heuristic (fewest-free-neighbors-first), 10 restart attempts, 5000-node depth limit
3. Hidden numbers are chosen randomly, then each candidate is verified for unique solvability via `checkUnique()` — a constrained DFS solver with a 15ms timeout

## Mode Structure

Four independent play modes, each with its own level list:

| Mode | Key | Movement | Levels | Board |
|------|-----|----------|--------|-------|
| 经典模式 | `classic` | Orthogonal (4-directional) | 45 | 5×5 / 7×7 / 9×9 |
| 八向连线 | `diagonal` | Diagonal (8-directional) | 45 | 5×5 / 7×7 / 9×9 |
| 经典传送门 | `portalClassic` | Diagonal | 8 | 5×5 |
| 传送门收集 | `portalCollect` | Diagonal | 2 | 7×7 |

Classic and Diagonal share the same procedurally-generated 45-level pool (seeded PRNG + DFS). Classic uses orthogonal movement throughout; Diagonal uses diagonal movement throughout. They are separate mode entries with independent progress tracking.

## Portal Modes

### Portal Classic (`portalClassic`)

Portal 1.0 rules: hidden numbers + sequential path + manual portal two-step. 8 hand-authored 5×5 levels with portal pairs.

Portals connect non-adjacent cells: entering a portal forces the next move to jump to its paired exit cell. Unvisited portals display as `?`.

### Portal Collect (`portalCollect`, Portal 2.0)

Portal 2.0 rules: free-order path + coin collection + auto-teleport portals + reach the exit. 2 hand-authored 7×7 levels.

Key differences from Portal Classic:
- No sequential number requirement, no full-board requirement
- Must collect all coin targets (`●`) before the exit (`E`) becomes passable
- Portals auto-teleport on entry (no manual second step)
- No Classic item bar, no combo scoring — HUD shows step count
- HP = 99 (no penalty), win/lose based on step count and star thresholds
- Win panel title: "空间折叠完成！", lose panel title: "路线卡住了"

## Input System

Two modes, toggled in settings:

* **Mouse/touch**: pointerdown starts drag from current head, pointermove processes cells under cursor, pointerup ends drag. Backtracking allowed by tapping the previous cell.
* **Keyboard (WASD)**: 8-directional movement with 50ms debounce, arrow-key-style combos for diagonals. Backtracking disabled in keyboard mode.

## Persistence (localStorage)

All progress is browser-local.

Keys:

* `cg_classic_v2_progress`
* `cg_classic_v2_highscores`
* `cg_classic_v2_saved_game`
* `cg_portal_*`
* `cg_coins`
* `cg_items`
* `cg_global_score`
* `cg_sfx_vol`
* `cg_music_vol`
* `cg_input_mode`

Saved games include full grid data, path, HP, timer, score, and combo state, enabling exact mid-game resume.

## Combo System

Pure path-driven:

* each successful connection fires a `'success'` event
* wrong taps fire `'failure'`
* reset events clear the combo state

Combo multiplier tiers:

| Streak | Label     | Multiplier |
| ------ | --------- | ---------- |
| 0-1    | —         | ×1.0       |
| 2-4    | Nice      | ×1.0       |
| 5-9    | Great     | ×1.2       |
| 10-15  | Excellent | ×1.5       |
| 16+    | Perfect!  | ×2.0       |

Combo only affects score display, not the star rating formula.

## Scoring (Classic Mode)

```text
baseScore = hiddenCount × 30 + visibleCount × 10
totalScore = baseScore + timeBonus + lifeBonus + comboBonus
stars: 1 star (any completion), 2 stars (≥60% of max), 3 stars (≥90% of max)
```

## CSS

Custom component classes in `index.css` (`@layer components`):

* `.app-shell`
* `.surface-panel`
* `.surface-muted`
* `.hud-surface`
* `.button-primary`
* `.button-secondary`
* `.button-quiet`

The rest is Tailwind utilities.

Dark theme with deep navy background (`#0d101b`) and warm accent colors.

## Styling Conventions

* Cell states use Tailwind classes, not inline styles, switched by `getCellClass()` helper in `App.jsx`
* Animated elements use Motion components with presets from `motionPresets.js`
* Path lines are rendered as an SVG overlay on top of the CSS grid board
* The `board-sketch` container uses `touch-none select-none` for clean drag interaction

## Project-Specific Cautions

* `App.jsx` is large and tightly coupled. Do not split it unless explicitly requested.
* Do not change procedural generation without confirming determinism.
* Do not change Portal behavior without confirming level compatibility.
* Do not change scoring or star logic unless explicitly requested.
* Do not change localStorage keys unless a migration is included.
* UI polish should not alter gameplay rules, path validation, input behavior, or progression logic.
