/**
 * Curated Classic / Diagonal levels.
 *
 * These are candidate levels that have been reviewed in the GM Console
 * and marked APPROVED, then written via `npm run apply:level-candidates -- --write`.
 *
 * Each entry is a complete snapshot of the candidate at review time,
 * NOT a regeneration seed.  The grid is reconstructed deterministically
 * from `path` + `hiddenIndices` so that the in-game experience exactly
 * matches what was play-tested in the GM dev candidate panel.
 *
 * Curated levels are appended to the END of their respective mode/diff
 * section and never inserted in the middle of existing generated levels.
 *
 * portal / portalCollect levels are NOT stored here — they live in
 * `src/data/portalLevels.js`.
 */

import { _setCuratedCountFn } from '../config/gameModes.js';

const CURATED_LEVELS = [];

// Wire curated count into gameModes so level counts include both generated + curated
_setCuratedCountFn((mode, diff) =>
  CURATED_LEVELS.filter(l => l.mode === mode && l.diff === diff).length
);

/** Look up a curated level by mode, diff, and per-diff level index. */
export function getCuratedLevel(mode, diff, levelIdx) {
  return CURATED_LEVELS.find(
    l => l.mode === mode && l.diff === diff && l.levelIdx === levelIdx
  ) || null;
}

export function buildCuratedGrid(curated) {
  const N = curated.N;
  const hiddenSet = new Set(curated.hiddenIndices || []);
  const grid = [];
  for (let i = 0; i < N * N; i++) {
    const val = (curated.path.indexOf(i) + 1) || 0;
    grid.push({ val, isHidden: hiddenSet.has(i), isRevealed: false, isExcluded: false, isHinted: false });
  }
  return {
    config: {
      N,
      hiddenMin: curated.hiddenIndices ? curated.hiddenIndices.length : 0,
      hiddenMax: curated.hiddenIndices ? curated.hiddenIndices.length : 0,
      hp: N === 5 ? 3 : N === 7 ? 5 : 10,
      coins: N === 5 ? 10 : N === 7 ? 20 : 40,
      times: N === 5 ? [30, 60] : N === 7 ? [90, 180] : [300, 600],
      maxGap: N === 5 ? 2 : N === 7 ? 3 : 4
    },
    grid,
    startIndex: curated.path[0]
  };
}

export function curatedLevelCount(mode, diff) {
  return CURATED_LEVELS.filter(l => l.mode === mode && l.diff === diff).length;
}
