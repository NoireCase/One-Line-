/**
 * Build generated Classic/Diagonal level fixtures inside the browser runtime.
 *
 * The generator uses JavaScript engine details while ordering equal DFS choices.
 * Running it in Playwright's Node process can therefore produce a different
 * board from the one rendered by Chromium in CI.
 */
export async function getBrowserClassicLevel(page, {
  diff = 'easy',
  levelIdx = 0,
  playMode = 'classic',
} = {}) {
  return page.evaluate(async (options) => {
    const [{ createClassicLevel }, { createLevelConfig, resolveRules }] = await Promise.all([
      import('/src/game/classic/createClassicLevel.js'),
      import('/src/game/rules/levelConfig.js'),
    ]);
    const level = createClassicLevel(
      options.diff,
      options.levelIdx,
      resolveRules(createLevelConfig(options.diff, options.levelIdx, options.playMode)),
      options.playMode
    );
    const solution = level.grid
      .map((cell, index) => ({ index, value: cell.val }))
      .sort((a, b) => a.value - b.value)
      .map(cell => cell.index);

    return {
      gridData: level.grid,
      hp: level.config.hp,
      solution,
      startIndex: level.startIndex,
    };
  }, { diff, levelIdx, playMode });
}

export async function getBrowserClassicSolution(page, options) {
  const level = await getBrowserClassicLevel(page, options);
  return level.solution;
}

export async function buildBrowserClassicSave(page, {
  diff = 'easy',
  levelIdx = 0,
  playMode = 'classic',
  pathLength = 1,
  timer = 0,
  score = 0,
  maxCombo = 0,
  savedAt = 1752710400000,
} = {}) {
  const level = await getBrowserClassicLevel(page, { diff, levelIdx, playMode });
  const path = level.solution.slice(0, pathLength);
  const visited = new Set(path);
  const gridData = level.gridData.map((cell, index) => ({
    ...cell,
    isRevealed: cell.isRevealed || visited.has(index),
  }));

  return {
    solution: level.solution,
    savedGame: {
      playMode,
      diff,
      levelIdx,
      gridData,
      path,
      hp: level.hp,
      timer,
      score,
      maxCombo,
      activePortal: null,
      savedAt,
    },
  };
}
