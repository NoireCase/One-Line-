/**
 * Deterministic Dev Candidate data used only by Playwright E2E.
 *
 * This is intentionally small and is not a source of formal level data.
 */

const CLASSIC_ROW_SNAKE = [
  0, 1, 2, 3, 4,
  9, 8, 7, 6, 5,
  10, 11, 12, 13, 14,
  19, 18, 17, 16, 15,
  20, 21, 22, 23, 24,
];

const CLASSIC_COLUMN_SNAKE = [
  0, 5, 10, 15, 20,
  21, 16, 11, 6, 1,
  2, 7, 12, 17, 22,
  23, 18, 13, 8, 3,
  4, 9, 14, 19, 24,
];

const DIAGONAL_WEAVE_A = [
  19, 24, 23, 22, 18,
  14, 9, 4, 3, 2,
  8, 13, 7, 1, 0,
  5, 6, 12, 17, 11,
  10, 15, 16, 21, 20,
];

const DIAGONAL_WEAVE_B = [
  24, 23, 19, 14, 9,
  4, 3, 2, 8, 13,
  18, 22, 17, 21, 20,
  15, 16, 12, 7, 1,
  0, 5, 6, 10, 11,
];

const HIDDEN_VALUES = new Set([3, 4, 7, 8, 11, 12, 15, 16, 19, 20]);

function createCandidate({
  mode,
  seed,
  candidateIndex,
  virtualIdx,
  path,
  qualityScore,
  similarityScore,
  archetypeTag,
  tier,
  diagCount,
}) {
  const grid = Array.from({ length: 25 }, (_, index) => {
    const val = path.indexOf(index) + 1;
    return {
      val,
      isHidden: HIDDEN_VALUES.has(val),
      isRevealed: false,
      isExcluded: false,
      isHinted: false,
    };
  });
  const hiddenIndices = grid
    .map((cell, index) => (cell.isHidden ? index : null))
    .filter(index => index !== null);

  return {
    key: `${mode}:easy:${seed}:${virtualIdx}`,
    mode,
    diff: 'easy',
    candidateIndex,
    virtualIdx,
    seed,
    N: 5,
    status: 'PASSED',
    tier,
    qualityScore,
    difficultyScore: mode === 'diagonal' ? 58 : 52,
    rejectReasons: [],
    penalties: {
      snakePenalty: 0,
      longRunPenalty: 0,
      monotonyPenalty: 0,
      chaosPenalty: 0,
      turnBalancePenalty: 0,
      anchorDistributionPenalty: 0,
      diagonalIdentityPenalty: 0,
    },
    metrics: {
      hiddenCount: hiddenIndices.length,
      hiddenRatio: hiddenIndices.length / 25,
      maxHiddenStreak: 2,
      turnCount: mode === 'diagonal' ? 16 : 8,
      maxStraightRun: 5,
      turnRate: mode === 'diagonal' ? 0.67 : 0.33,
      diagCount,
      diagRatio: diagCount / 24,
      maxDiagRun: mode === 'diagonal' ? 4 : 0,
      directionBias: 0.5,
      dominantDirRatio: 0.25,
      maxAnchorGap: 3,
    },
    grid,
    path,
    hiddenCount: hiddenIndices.length,
    hiddenIndices,
    similarityScore,
    maxSimilarity: similarityScore,
    archetypeTag,
    archetypeConfidence: 100,
    generatorVersion: 'e2e-fixture-v1',
  };
}

export const E2E_DEV_LEVEL_CANDIDATES = [
  createCandidate({
    mode: 'classic',
    seed: 901,
    candidateIndex: 0,
    virtualIdx: 901,
    path: CLASSIC_ROW_SNAKE,
    qualityScore: 94,
    similarityScore: 72,
    archetypeTag: 'ROW_COL_SWEEP',
    tier: 'AUTO_RECOMMENDED',
    diagCount: 0,
  }),
  createCandidate({
    mode: 'classic',
    seed: 902,
    candidateIndex: 1,
    virtualIdx: 902,
    path: CLASSIC_COLUMN_SNAKE,
    qualityScore: 90,
    similarityScore: 68,
    archetypeTag: 'CORNER_SWEEP',
    tier: 'REVIEW_CANDIDATE',
    diagCount: 0,
  }),
  createCandidate({
    mode: 'diagonal',
    seed: 903,
    candidateIndex: 0,
    virtualIdx: 903,
    path: DIAGONAL_WEAVE_A,
    qualityScore: 93,
    similarityScore: 70,
    archetypeTag: 'DIAGONAL_WEAVE',
    tier: 'AUTO_RECOMMENDED',
    diagCount: 8,
  }),
  createCandidate({
    mode: 'diagonal',
    seed: 904,
    candidateIndex: 1,
    virtualIdx: 904,
    path: DIAGONAL_WEAVE_B,
    qualityScore: 89,
    similarityScore: 66,
    archetypeTag: 'DIAGONAL_CROSS',
    tier: 'REVIEW_CANDIDATE',
    diagCount: 7,
  }),
];
