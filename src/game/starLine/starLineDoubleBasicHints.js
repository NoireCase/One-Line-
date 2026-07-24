const UNKNOWN = 'unknown';
const STAR = 'star';
const X = 'x';

function readCell(cell) {
  if (cell?.isStarred) return STAR;
  if (cell?.isMarkedX) return X;
  return UNKNOWN;
}

function eightNeighbors(idx, boardSize) {
  const row = Math.floor(idx / boardSize);
  const col = idx % boardSize;
  const cells = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < boardSize && nextCol >= 0 && nextCol < boardSize) {
        cells.push(nextRow * boardSize + nextCol);
      }
    }
  }
  return cells.sort((a, b) => a - b);
}

function buildUnits(level) {
  const { N, regions } = level;
  const rows = Array.from({ length: N }, (_, index) => ({
    kind: 'row',
    index,
    label: `第 ${index + 1} 行`,
    cells: Array.from({ length: N }, (_, col) => index * N + col),
  }));
  const cols = Array.from({ length: N }, (_, index) => ({
    kind: 'col',
    index,
    label: `第 ${index + 1} 列`,
    cells: Array.from({ length: N }, (_, row) => row * N + index),
  }));
  const regionIds = [...new Set(regions)];
  const regionUnits = regionIds.map((regionId, index) => ({
    kind: 'region',
    index,
    label: '这个星域',
    cells: regions
      .map((value, cell) => (value === regionId ? cell : -1))
      .filter(cell => cell >= 0),
  }));
  return [...rows, ...cols, ...regionUnits];
}

function buildBlocks(boardSize) {
  const blocks = [];
  for (let row = 0; row < boardSize - 1; row += 1) {
    for (let col = 0; col < boardSize - 1; col += 1) {
      blocks.push([
        row * boardSize + col,
        row * boardSize + col + 1,
        (row + 1) * boardSize + col,
        (row + 1) * boardSize + col + 1,
      ]);
    }
  }
  return blocks;
}

function disjoint(first, second) {
  const firstSet = new Set(first);
  return second.every(cell => !firstSet.has(cell));
}

function makeUnitHint(unit, rule, action, targetCells, evidenceCells, copies) {
  return {
    rule,
    action,
    targetCells: [...new Set(targetCells)].sort((a, b) => a - b),
    observationCells: [...unit.cells],
    evidenceCells: [...new Set(evidenceCells)].sort((a, b) => a - b),
    tier1Copy: `先看${unit.label}。`,
    tier2Copy: copies.tier2,
    tier3Copy: copies.tier3,
  };
}

function makeCorrectionHint(level, state, units) {
  if (!Array.isArray(level.solution)) return null;
  const solution = new Set(level.solution);
  const wrongStar = state.findIndex((value, cell) => value === STAR && !solution.has(cell));
  const wrongX = state.findIndex((value, cell) => value === X && solution.has(cell));
  const target = wrongStar >= 0 ? wrongStar : wrongX;
  if (target < 0) return null;

  const relatedCells = units
    .filter(unit => unit.cells.includes(target))
    .flatMap(unit => unit.cells);
  const markName = state[target] === STAR ? '星点' : 'X';
  return {
    mode: 'correction',
    rule: 'correction',
    action: 'clear',
    targetCells: [target],
    observationCells: [...new Set(relatedCells)].sort((a, b) => a - b),
    evidenceCells: [],
    tier1Copy: '棋盘还未完成，说明至少有一处标记错误。',
    tier2Copy: '检查高亮格所在的行、列和星域。',
    tier3Copy: `先撤销高亮格的${markName}，再重新判断。`,
  };
}

/**
 * 只提供新手关允许的四种安全结论：
 * 2×2 容量、八向禁邻、配额已满、剩余格数等于剩余星数。
 * 不读取 solution，也不包含 multi-unit / pressured-group。
 */
export function findStarLineDoubleBasicHint(level, gridData) {
  if (!level || !Array.isArray(gridData) || gridData.length !== level.N * level.N) return null;
  const quota = level.starsPerRow ?? level.starsPerCol ?? level.starsPerRegion ?? 2;
  const state = gridData.map(readCell);
  const units = buildUnits(level);

  const hasUnknown = state.includes(UNKNOWN);
  if (!hasUnknown) {
    const correction = makeCorrectionHint(level, state, units);
    if (correction) return correction;
  }

  let invalidState = false;
  for (const unit of units) {
    const stars = unit.cells.filter(cell => state[cell] === STAR).length;
    const unknown = unit.cells.filter(cell => state[cell] === UNKNOWN).length;
    if (stars > quota || stars + unknown < quota) invalidState = true;
  }
  for (let star = 0; star < state.length; star += 1) {
    if (state[star] !== STAR) continue;
    if (eightNeighbors(star, level.N).some(cell => state[cell] === STAR)) invalidState = true;
  }
  if (invalidState) {
    return makeCorrectionHint(level, state, units);
  }

  for (let star = 0; star < state.length; star += 1) {
    if (state[star] !== STAR) continue;
    const targets = eightNeighbors(star, level.N).filter(cell => state[cell] === UNKNOWN);
    if (targets.length > 0) {
      return {
        rule: 'adjacency',
        action: 'eliminate',
        targetCells: targets,
        observationCells: [star, ...eightNeighbors(star, level.N)],
        evidenceCells: [star],
        tier1Copy: '先看这颗星周围。',
        tier2Copy: '星点八向不相邻，周围八格都不能放星。',
        tier3Copy: '把高亮的相邻空格标成 X。',
      };
    }
  }

  for (const unit of units) {
    const stars = unit.cells.filter(cell => state[cell] === STAR);
    const unknown = unit.cells.filter(cell => state[cell] === UNKNOWN);
    if (stars.length === quota && unknown.length > 0) {
      return makeUnitHint(unit, 'quota-saturated', 'eliminate', unknown, stars, {
        tier2: `${unit.label}已经放满 ${quota} 颗星。`,
        tier3: '把这个范围内剩余的空格标成 X。',
      });
    }
  }

  for (const unit of units) {
    const stars = unit.cells.filter(cell => state[cell] === STAR);
    const unknown = unit.cells.filter(cell => state[cell] === UNKNOWN);
    const remaining = quota - stars.length;
    if (remaining > 0 && unknown.length === remaining) {
      return makeUnitHint(unit, 'remaining-capacity', 'place-stars', unknown, stars, {
        tier2: `${unit.label}还缺 ${remaining} 颗星，也只剩 ${remaining} 个空格。`,
        tier3: '双击高亮的剩余空格放星。',
      });
    }
  }

  const blocks = buildBlocks(level.N);
  for (const unit of units) {
    const stars = unit.cells.filter(cell => state[cell] === STAR);
    const candidates = unit.cells.filter(cell => state[cell] === UNKNOWN);
    const remaining = quota - stars.length;
    if (remaining < 1 || remaining > 2 || candidates.length === 0) continue;
    const candidateSet = new Set(candidates);
    const eligible = blocks.filter(block => (
      block.every(cell => state[cell] !== STAR)
      && block.some(cell => candidateSet.has(cell))
    ));
    const covers = [];
    if (remaining === 1) {
      for (const block of eligible) {
        if (candidates.every(cell => block.includes(cell))) covers.push([block]);
      }
    } else {
      for (let first = 0; first < eligible.length; first += 1) {
        for (let second = first + 1; second < eligible.length; second += 1) {
          if (!disjoint(eligible[first], eligible[second])) continue;
          const union = new Set([...eligible[first], ...eligible[second]]);
          if (candidates.every(cell => union.has(cell))) {
            covers.push([eligible[first], eligible[second]]);
          }
        }
      }
    }

    for (const cover of covers) {
      const targets = cover
        .flat()
        .filter(cell => state[cell] === UNKNOWN && !candidateSet.has(cell));
      if (targets.length === 0) continue;
      const blockCountCopy = cover.length === 1 ? '一个 2×2' : '两个互不重叠的 2×2';
      return makeUnitHint(unit, 'two-by-two', 'eliminate', targets, cover.flat(), {
        tier2: `${unit.label}能放星的格子都落在${blockCountCopy}里。`,
        tier3: '每个 2×2 最多 1 星，把同块外侧高亮格标成 X。',
      });
    }
  }

  return null;
}
