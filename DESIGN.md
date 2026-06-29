# One-Line Design Guidelines

This document defines the UI, visual, interaction, motion, and copy rules for One-Line. It is written for future AI agents and product engineers who modify the game experience.

One-Line is currently v0.15.0. Hidden has completed 60 levels: Easy 10, Medium 20, Hard 30. The current stage is gameplay content closure; future UI changes must protect the game's identity and avoid turning it into a generic tool interface.

## 1. Product Identity

One-Line is a minimalist path puzzle game where one continuous line reveals the full rule system.

The product should feel:

- Clear: players always understand the next meaningful action.
- Restrained: the UI supports concentration and does not compete with the board.
- Mysterious: the game should leave room for inference, especially in Hidden.
- Slightly ceremonial: starting, completing, failing, and advancing should feel like game moments, not form submissions.
- Emotionally engaged: the interface should create goal, progress, challenge, tension, and completion, not only explain functions.

One-Line is not:

- A settings panel.
- A backend dashboard.
- A pure teaching demo.
- A developer test harness.
- A generic puzzle template.

Important principles:

- Minimal UI does not mean empty UI.
- Less information is not always better.
- Players need goal, progress, challenge, and mode identity.
- Simplicity does not mean weak explanation, weak emotion, or weak entry points.
- Every screen should make the player feel they are entering or continuing a path challenge.

## 2. Visual Direction

The overall direction is a dark, focused puzzle space with the board as the primary visual object.

Use:

- Dark backgrounds with subtle depth.
- Glowing path lines that make the route feel alive.
- Board-first composition.
- UI containers with light glass, shadow, or layered depth when needed.
- Clear numbers, path segments, start points, end points, portals, locks, and completed states.
- Short, decisive motion that reinforces feedback.

Avoid:

- Heavy decoration that distracts from solving.
- Flat admin panels as the dominant visual language.
- Background effects that reduce board readability.
- Visual treatments that make numbers, cells, or special elements ambiguous.
- Long decorative animation loops.

The board is the hero. Supporting UI exists to frame the challenge, show progress, and confirm feedback.

## 3. Page-level Rules

### Home

The home screen should feel like the entrance to a game.

It should:

- Give the primary action a clear sense of starting or continuing.
- Show version, mode flavor, and progress when useful.
- Help players feel there is a path challenge waiting for them.
- Make continue/resume states easy to recognize.

It should not:

- Look like a settings panel.
- Lead with weak statistical narration such as "2 modes · 54 levels".
- Present progress like a backend analytics summary.
- Make the game feel like a feature checklist.

When changing Home, protect the emotional hierarchy: continue/start first, progress second, settings and secondary actions last.

### Mode Select

Mode Select should communicate gameplay difference and mood.

Each mode needs its own identity:

- Classic: clean one-line completion.
- Diagonal: more fluid movement and flexible routing.
- Portal: spatial jumps and cross-area planning.
- Hidden: scarce clues and inference pressure.

It should:

- Help players choose by feeling and challenge type.
- Use copy that describes the player experience, not implementation details.
- Show mode progress in a game-like way.

It should not:

- Only list rules.
- Stack developer labels.
- Make every mode look like the same card with different text.
- Use internal staging language as player-facing content.

### Level Select

Level Select should prioritize player progress and challenge clarity.

It should:

- Clearly distinguish completed, available, and locked levels.
- Make completion status and best results easy to scan.
- Show the current next challenge naturally.
- Keep level groups understandable without sounding like development buckets.
- For Hidden, emphasize scarce clues, reasoning pressure, and final-stage challenge.

It should not:

- Use developer-view terms such as Beginner, Advanced, Alpha, or Recommended Path.
- Hide progress behind decorative labels.
- Make locked and available states depend only on color.
- Present levels like a database table.

### Game View

The board must always be the main character.

It should:

- Keep the board visually dominant on desktop and mobile.
- Keep the HUD quiet and useful.
- Make drag, connect, invalid move, mistake, completion, and reset feedback clear.
- Give the path line enough glow and weight to feel like a game object.
- Keep instructions near the experience but visually secondary.

It should not:

- Let explanatory text overpower the board.
- Fill the screen with tool-like controls.
- Add visual effects that obscure cells or numbers.
- Change board readability for decoration.

### Win / Lose / Result

Result screens should feel like game resolution.

They should:

- Give victory a satisfying sense of completion.
- Make failure clear without shaming the player.
- Present next actions in a clear priority order.
- Keep retry, next level, and mode/level navigation easy to understand.
- Show scores or rewards as game feedback, not a report.

They should not:

- Look like backend reports.
- Overload players with raw metrics.
- Use harsh failure language.
- Make secondary buttons compete with the main next step.

## 4. Mode-specific Visual Rules

### Classic

Classic is the foundation of One-Line.

It should feel:

- Basic, clean, and confident.
- Strongly focused on path continuity.
- Satisfying when the final line fills the board.

Do not make Classic visually noisy. Its strength is the pleasure of completing one continuous route.

### Diagonal

Diagonal should feel more flexible and flowing than Classic.

It should:

- Allow lighter connection energy.
- Make diagonal movement visually natural.
- Preserve strong cell and number readability.

Do not make diagonal paths look accidental or weaker than orthogonal paths. The player should feel that diagonal movement is intentional and supported.

### Portal

Portal should emphasize spatial jumps, transfer, and cross-area planning.

It should:

- Make portals visibly distinct from normal cells.
- Show portal activation and destination feedback clearly.
- Make the transition feel like a spatial event.

It should not:

- Look like Classic with a different color.
- Hide portal identity inside small text.
- Let portal effects reduce the readability of path numbers.

### Hidden

Hidden should emphasize scarce clues and reasoning pressure.

It should:

- Make key numbers feel like clues, not ordinary labels.
- Keep unrevealed path areas restrained and ambiguous.
- Preserve strong readability for all visible clues.
- Let Hard final-stage levels feel more tense without sacrificing clarity.

It should not:

- Give too many shape hints for unrevealed paths.
- Over-decorate clue cells.
- Make mystery more important than solvability.
- Treat Hidden as a demo or temporary mode in player-facing UI.

## 5. Component Rules

### Buttons

Buttons should feel like game commands.

They should:

- Have clear priority: primary action, secondary action, utility action.
- Use concise player-facing labels.
- Give visible hover, focus, pressed, disabled, and loading states when relevant.
- Keep touch targets comfortable on mobile.

They should not:

- Look like admin toolbar controls unless used inside a settings surface.
- Use vague labels such as "OK" when the action has a clearer name.
- Compete visually when one action is clearly primary.

When modifying buttons, confirm that the main player path remains obvious.

### Cards

Cards should frame meaningful choices or repeated items.

They should:

- Use subtle depth or glass treatment.
- Support scanning without looking like a dashboard grid.
- Contain only information that helps the player decide or continue.

They should not:

- Be nested inside other decorative cards.
- Become heavy panels full of stats.
- Carry large blocks of rule explanation.

When modifying cards, preserve hierarchy and avoid making the interface feel like a control center.

### Level Cards

Level cards should communicate state and challenge.

They should:

- Clearly show completed, available, and locked states.
- Show completion and best result only when useful.
- Make the next playable level easy to find.

They should not:

- Depend only on color for status.
- Use internal difficulty or staging labels.
- Make locked levels look broken or unavailable due to loading.

When modifying level cards, test completed, available, locked, current, and mobile states.

### Mode Cards

Mode cards should sell the feel of each mode.

They should:

- Use mode-specific visual cues.
- Combine mood, progress, and challenge type.
- Make Classic, Diagonal, Portal, and Hidden feel meaningfully different.

They should not:

- Read like rule documentation.
- Use development labels such as MVP, Alpha, demo, or test.
- Flatten all modes into identical cards with different names.

When modifying mode cards, check that each mode can be recognized quickly before reading long copy.

### Board Cells

Board cells are gameplay objects, not decoration.

They should:

- Keep numbers clear.
- Clearly show empty, active, selected, visited, blocked, mistake, clue, portal, start, and end states where applicable.
- Maintain readable contrast on dark backgrounds.
- Preserve reliable click and drag targets on mobile.

They should not:

- Use effects that obscure numbers.
- Make special states too subtle.
- Change size or layout during interaction.

When modifying board cells, verify all modes, especially Hidden and Portal.

### Path Line

The path line is the central visual reward.

It should:

- Feel continuous, luminous, and precise.
- Make the player's route easy to follow.
- Reinforce successful connection and completion.

It should not:

- Hide numbers or clue cells.
- Become so decorative that it makes the route hard to read.
- Look like a generic chart line.

When modifying path lines, test dense boards and completed paths.

### Toast

Toast messages should be brief feedback, not instruction panels.

They should:

- Confirm mistakes, saves, unlocks, or important state changes.
- Use short, calm, player-facing language.
- Disappear quickly enough to avoid blocking play.

They should not:

- Explain full mechanics.
- Stack into visual clutter.
- Shame the player for mistakes.

When modifying toasts, verify they do not cover critical board interactions on mobile.

### Settings Panel

Settings are supporting controls.

They should:

- Be easy to find but visually secondary.
- Use plain labels and predictable controls.
- Avoid developer-only options in production-facing UI.

They should not:

- Become the visual model for the whole game.
- Dominate Home or Game View.
- Expose internal test states to players.

When modifying settings, keep them clearly separate from the main game flow.

### Progress Display

Progress display should create motivation.

It should:

- Show completion, current challenge, and meaningful achievement.
- Use player-centered language.
- Feel like game progress rather than analytics.

It should not:

- Lead with weak raw counts.
- Overwhelm the screen with totals.
- Use dashboard styling as the dominant tone.

When modifying progress, ask whether the player feels invited to continue.

### Lock / Completed / Available States

State design must be readable and accessible.

It should:

- Combine color, icon, label, shape, or opacity so status is not color-only.
- Make available levels feel playable.
- Make completed levels feel resolved.
- Make locked levels feel intentionally gated, not disabled by error.

It should not:

- Hide important state in subtle color shifts.
- Make locked cards look broken.
- Make completed and available levels too similar.

When modifying states, inspect them together in the same view.

## 6. Copywriting Rules

Write from the player's perspective.

Use copy that expresses:

- Goal.
- Challenge.
- Progress.
- Completion.
- Mode mood.
- Next action.

Avoid developer-view copy:

- Alpha.
- MVP.
- demo.
- Recommended path.
- Stage test.
- Internal route.
- Feature checklist.

Avoid weak statistical narration:

- Not recommended: "2 modes · 54 levels"
- Recommended direction: "Continue your path challenge"

Avoid temporary-mode framing:

- Not recommended: "Hidden MVP demo"
- Recommended direction: "Scarce clues · 60 reasoning challenges"

Do not over-explain mechanics in high-level UI. Teach only what the player needs in the moment. Prefer direct, emotional, game-facing language over implementation details.

## 7. Motion Rules

Motion should be short, clear, and useful.

Use motion for:

- Connection feedback.
- Invalid move feedback.
- Mistake confirmation.
- Key node reveal or activation.
- Portal activation or transfer.
- Path completion.
- Win feedback.
- Unlock or progress feedback.

Rules:

- Keep motion brief.
- Make motion serve feedback.
- Support `prefers-reduced-motion`.
- Avoid long-running decorative loops.
- Avoid exaggerated bounce.
- Do not animate in ways that reduce board readability.

Path completion, key nodes, and victory can receive light emphasis. The emphasis should feel crisp, not theatrical.

## 8. Accessibility / Readability

Readability is a design floor, not a polish task.

Required:

- Numbers must be clear at all supported board sizes.
- Board cell states must be distinguishable.
- Locked, available, and completed states must not rely only on color.
- Mobile layouts must preserve comfortable click and drag targets.
- Hidden clues must be identifiable as clues.
- Portal elements must be identifiable as special gameplay elements.
- Text must not overlap controls or the board.
- Focus states should remain visible for keyboard users.
- Reduced-motion users should not receive distracting motion.

Do not sacrifice clarity for mystery. Hidden can be tense without becoming unreadable; Portal can feel magical without becoming confusing.

## 9. Agent Instructions

When modifying One-Line UI, visual design, interaction design, animation, or copy, read this `DESIGN.md` first.

Before changing UI, confirm:

1. Does the change match One-Line's game identity?
2. Does it preserve the board as the main visual object?
3. Does it avoid developer-view copy?
4. Does it preserve player goal, progress, and challenge?
5. Does it avoid turning pages into backend panels?
6. Does it avoid breaking existing gameplay logic?
7. Does it avoid modifying level data?

If a request conflicts with `DESIGN.md`, explain the conflict before making changes. Do not silently override this document.

For UI work, completion should include:

- A brief list of modified files.
- A simple explanation of what changed.
- Clear instructions for how to test the feature.
- Confirmation that gameplay logic and level data were not modified, unless explicitly requested.

For documentation-only work, keep the change scoped to documentation files.
