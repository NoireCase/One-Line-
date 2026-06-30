# AGENTS.md — One-Line Puzzle Game

React puzzle game built with Vite, Tailwind CSS 3.4, and Playwright E2E tests.

## Essential Commands

```bash
npm run dev          # Start dev server (port 5173, required for E2E)
npm run build        # Production build → dist/
npm run lint         # ESLint (flat config)
npm test             # Playwright E2E tests (starts dev server automatically)
npm run test:ui      # Playwright UI mode
npm run test:debug   # Playwright debug mode
npm run test:report  # View HTML test report
```

## Validation Scripts

```bash
npm run validate:levels        # Validate level data structure
npm run validate:hidden        # Verify hidden number uniqueness
npm run analyze:hidden         # Analyze hidden level configurations
npm run score:levels           # Score level quality metrics
npm run generate:level-candidates  # Generate new level candidates
npm run export:dev-level-candidates # Export staged dev levels
npm run apply:level-candidates     # Apply staged levels to game
```

## Architecture

- **Single monolithic React app**: `App.jsx` (~2200 lines) is the main component — avoid splitting without explicit instruction
- **All state lives in App.jsx**: No router, no state management library — view state is manual (`'home'` | `'levels'` | `'game'` | `'tut'` | `'mode'`)
- **Config modules** (`src/config/`): Pure logic separated from render — `gameModes.js`, `pathValidation.js`, `comboEngine.js`, `ruleDiscoveries.js`, `motionPresets.js`, `soundEngine.js`, `themeTokens.js`
- **E2E tests** (`e2e/`): Playwright tests with helpers for selectors, navigation, game state, and input simulation

## Critical Cautions

- **Never change localStorage keys** without migration — saves player progress
- **Never modify game mechanics** without explicit instruction
- **Never change procedural generation** without confirming determinism
- **Preserve existing gameplay behavior** unless explicitly asked to change it
- **App.jsx is tightly coupled** — do not refactor unless requested

## User Workflow Rules

1. Write final explanations and reports in Chinese by default.
2. Before editing files, list planned changed files, risk level, and validation plan.
3. Do not run `git push`, `git tag`, or `gh release` unless the user explicitly says to do so.
4. Do not create commits unless the user explicitly approves the commit.
5. Do not run `npm install` / `pnpm install` / `yarn install` unless the user explicitly approves.
6. Do not modify localStorage keys, save schema, scoring fields, or migration logic unless explicitly requested.
7. Do not modify core gameplay rules for Classic, Diagonal, Hidden, Portal Classic, or Portal Collect unless explicitly requested.
8. After editing, report changed files, product-level summary, and actual validation results.
9. Do not claim build/test/lint passed unless the command was actually run.
10. If validation fails, report the failure honestly and do not hide it.

## Styling

- Tailwind CSS 3.4 with custom config (`tailwind.config.js`)
- Custom component classes in `index.css` (`@layer components`)
- Dark theme with deep navy background (`#0d101b`)
- Motion library (`motion/react`) for animations — maintained fork of Framer Motion
- Lucide React for icons

## Testing

- E2E tests require dev server running (Playwright auto-starts it)
- Tests cover: home, modes, settings, mouse/keyboard input, save/restore, win/lose panels
- Use `data-testid` attributes for stable selectors — see `e2e/helpers/selectors.js`

## Existing Instruction Files

- `CLAUDE.md` — Comprehensive Claude Code guidance (game rules, architecture, conventions)
- `ROADMAP.md` — Feature planning and milestones
- `CHANGELOG.md` — Version history

## Environment

- Node.js project with ES modules (`"type": "module"`)
- Vite 8 for build tooling
- No TypeScript — pure JSX
- No router — manual view state management
