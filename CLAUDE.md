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
```

There is no test suite.

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
| `gameModes.js`       | Play mode definitions (classic/portal), level structure (easy/medium/hard tiers with grid sizes), localStorage key helpers |
| `pathValidation.js`  | `validateMove()` — adjacency checks (4-directional and 8-directional), path crossing detection                             |
| `comboEngine.js`     | Combo streak tracking driven by path events (`success`/`failure`/`reset`), tiered multiplier table                         |
| `ruleDiscoveries.js` | Rule-card unlock triggers, such as diagonal movement unlock at classic easy level 6                                        |
| `motionPresets.js`   | Centralized Motion animation variants: cell tap, shake, float, star pop, combo pulse                                       |
| `soundEngine.js`     | Web Audio API: pentatonic scale combo tones, error beep, volume control, lazy AudioContext singleton                       |
| `themeTokens.js`     | Color palette constants (`T`) and `cellStyle()` helper for inline cell styling                                             |

## Game Data Model

* **Board**: flat array of length `N*N`, each cell is `{ val, isHidden, isRevealed, isExcluded, isHinted, portalId? }`
* **Path**: flat array of cell indices in visit order, starting at the cell containing `val: 1`
* **Coordinates**: `row = Math.floor(index / N)`, `col = index % N`
* **Level configs**:

  * Classic levels are procedurally generated via seeded PRNG + DFS
  * Portal levels are hand-authored with fixed paths and portal pairs

## Path Generation (`App.jsx`)

1. `mulberry32(seed)` — deterministic PRNG from level difficulty + index
2. `generatePathDFS(N, rand, rules)` — DFS with Warnsdorff's heuristic (fewest-free-neighbors-first), 10 restart attempts, 5000-node depth limit
3. Hidden numbers are chosen randomly, then each candidate is verified for unique solvability via `checkUnique()` — a constrained DFS solver with a 15ms timeout

## Classic Mode Level Structure

```text
easy:   10 levels, 5×5 grid, levels 1-5 orthogonal, levels 6-10 diagonal
medium: 15 levels, 7×7 grid, all diagonal
hard:   20 levels, 9×9 grid, all diagonal
```

Diagonal movement unlocks via `RuleCard` after completing classic easy level 6.

## Portal Mode

9 hand-authored 5×5 levels with portal pairs.

Portals connect non-adjacent cells: entering a portal forces the next move to jump to its paired exit cell.

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
