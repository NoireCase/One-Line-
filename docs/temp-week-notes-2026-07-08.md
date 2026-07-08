# Temporary Week Notes - 2026-07-08

This is a temporary planning note from the Codex weekly review.
Do not treat all items here as long-term project rules.

## Current Product State

- One-Line v0.16.0 has been released.
- Star Line current shipped stage: Lv.1-30.
- Star Line currently supports single-star and double-star rules.
- Star Line includes solver validation, teaching UI, Playtest Panel / GM panel, and board visual polish.
- Current release-stage validation baseline recorded this week:
  - Full E2E: 100/100 passed.
  - Star Line E2E: 26/26 passed.
  - `npm run validate:levels`: 1981/1981 passed.
  - `node scripts/test-star-line-solver.mjs`: 42 passed.

## Temporary Workbench Notes

- Keep existing Star Line generation helper stash entries untouched until a dedicated cleanup task.
- Do not mix temporary helper scripts into release notes or player-facing docs.
- Murdoku was used as a UI/product-completeness reference only. Do not copy its art, layout, theme, or brand expression.
- Lv.31-100, Q=3, Knight Shot, Ghost Regions, and other advanced variants are future planning topics, not current shipped content.

## Rules Promoted To Long-Term Docs

The following were promoted into longer-term project docs:

- Git / Release must be a separate task.
- High-risk gameplay, solver, validator, level, save, scoring, and unlock work should use read-only review before implementation.
- Player-facing UI must not show development status language.
- Star Line UI terminology should distinguish 星点 from 单星规则 / 双星规则.
- Validator checks should match runtime rules where practical.

## Delete Or Refresh Later

Refresh or delete this note after the next release planning pass, especially when:

- Star Line moves beyond Lv.30.
- temporary generation scripts are reviewed or deleted.
- v0.17 planning becomes the active roadmap.
