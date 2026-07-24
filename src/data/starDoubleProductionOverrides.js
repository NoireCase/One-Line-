/**
 * Bounded production-gate repairs.
 *
 * Stable IDs are preserved. Region-only entries keep the original solution;
 * replacement entries were generated with the single curriculum seed 20260724.
 */
export const STAR_DOUBLE_PRODUCTION_OVERRIDES = Object.freeze({
  'star-lv-21': { kind: 'restore-official-identity-and-optimize', movedCells: [30], regions: [0,0,0,1,1,1,1,2,0,0,0,1,1,3,3,2,0,0,0,1,3,3,3,2,4,4,5,1,3,3,3,2,4,4,5,5,3,6,7,2,4,4,5,5,6,6,7,7,4,5,5,6,6,6,7,7,4,4,5,6,6,7,7,7], solution: [1,3,13,15,17,19,29,31,32,34,44,46,48,50,60,62] },
  'star-lv-22': { kind: 'bounded-region-optimization', movedCells: [26,33], regions: [0,0,1,1,1,2,3,3,0,0,1,1,2,2,3,3,0,0,0,1,2,2,3,3,4,0,0,1,2,2,3,3,4,4,5,5,6,2,7,7,4,4,5,6,6,2,7,7,4,4,5,5,6,7,7,7,4,4,6,6,6,6,7,7], solution: [1,3,13,15,17,19,29,31,32,34,44,46,48,50,60,62] },
  'star-lv-23': { kind: 'bounded-region-optimization', movedCells: [37], regions: [0,0,1,1,1,2,2,2,0,0,0,1,1,3,3,2,4,0,0,1,1,3,3,2,4,0,5,1,1,3,6,2,4,0,5,5,7,6,6,2,4,5,5,7,7,6,6,6,4,4,5,5,7,7,6,6,4,5,5,7,7,6,6,6], solution: [1,3,13,15,17,19,29,31,32,34,44,46,48,50,60,62] },
  'star-lv-25': { kind: 'same-size-fixed-seed-replacement', seed: 20260724, generationIndex: 106, movedCells: [21,22,52,68,69,77], regions: [0,0,0,1,1,1,1,1,1,2,2,0,3,3,3,1,1,1,2,2,0,0,0,3,3,3,3,2,2,0,0,4,3,3,5,5,6,2,2,0,4,4,4,4,5,6,6,2,0,7,7,4,4,5,6,6,7,0,7,7,4,8,8,6,6,7,7,7,7,7,8,8,6,6,6,7,7,7,8,8,8], solution: [1,5,12,16,18,23,29,34,36,40,47,53,58,60,64,71,75,78] },
  'star-lv-26': { kind: 'bounded-region-optimization', movedCells: [42,79], regions: [0,0,0,0,0,1,1,1,1,2,2,0,0,1,1,1,1,1,2,2,0,0,3,1,1,4,4,2,2,0,0,3,3,1,4,4,2,5,0,0,3,3,4,4,4,5,5,5,7,3,8,6,6,4,5,5,5,7,3,8,6,6,4,5,5,7,7,7,8,6,4,4,5,7,7,7,8,8,6,4,4], solution: [3,8,10,15,22,26,27,29,41,43,46,48,59,61,63,65,76,78] },
  'star-lv-27': { kind: 'same-size-fixed-seed-replacement', seed: 20260724, generationIndex: 302, movedCells: [30,57,64,65,66,69,71], regions: [0,0,1,1,1,2,2,2,3,0,1,1,1,1,2,2,2,3,0,0,1,1,2,2,3,3,3,0,0,0,0,2,2,3,3,3,4,4,4,4,5,5,3,5,3,4,6,6,6,6,5,5,5,3,4,6,6,7,7,5,5,5,5,8,6,6,6,7,7,5,5,5,8,8,8,8,7,7,7,7,7], solution: [1,4,15,17,19,21,32,34,36,38,49,51,56,62,63,68,75,79] },
  'star-lv-28': { kind: 'bounded-region-optimization', movedCells: [9,13,23,48,58,72,74], regions: [0,0,0,0,0,1,1,1,1,1,3,3,0,0,0,1,1,1,1,2,3,0,0,0,4,4,1,1,1,2,3,3,0,0,0,4,1,1,2,2,3,3,0,0,0,4,1,1,8,2,5,3,5,6,6,7,8,8,8,2,5,5,5,6,7,7,8,8,2,2,5,7,5,6,7,7,7,8,9,9,5,7,7,7,7,7,8,8,9,9,5,7,7,7,7,8,8,8,8,9], solution: [4,7,11,19,24,26,32,38,40,45,53,57,61,65,73,78,80,86,92,99] },
  'star-lv-29': { kind: 'bounded-region-optimization', movedCells: [38,54], regions: [0,0,1,1,1,1,2,2,2,2,0,1,1,1,1,1,1,1,2,3,0,4,1,5,5,1,2,2,2,3,0,4,1,1,5,2,2,2,2,3,0,4,4,1,5,2,6,7,3,3,0,4,8,8,6,6,6,7,3,3,4,4,4,8,8,6,6,7,3,9,4,8,8,8,8,6,6,7,7,9,4,4,8,8,6,6,7,7,9,9,8,8,8,8,6,6,7,7,7,9], solution: [2,7,10,15,23,29,31,36,44,48,50,52,67,69,73,75,81,88,94,96] },
  'star-lv-30': { kind: 'same-size-fixed-seed-replacement', seed: 20260724, generationIndex: 400, movedCells: [7,17,28,36,78], regions: [0,0,0,0,0,1,2,3,3,3,0,4,0,0,0,1,2,3,3,3,4,4,4,4,1,1,2,2,6,3,4,5,4,4,1,1,1,2,6,6,5,5,4,7,7,1,1,1,6,6,5,5,5,7,7,7,8,8,6,6,5,5,5,7,7,7,7,8,6,6,5,5,5,9,9,7,7,8,8,6,5,9,9,9,9,9,8,8,8,6,9,9,9,9,9,9,8,8,8,8], solution: [4,8,12,16,24,29,30,37,42,45,50,58,63,65,71,77,83,89,91,96] },
  'star-double-promoted-10': { kind: 'same-size-fixed-seed-replacement', seed: 20260724, generationIndex: 500, movedCells: [44], regions: [0,0,0,1,1,1,1,1,0,0,0,1,1,1,2,1,0,0,0,2,2,2,2,2,3,3,3,3,2,2,4,2,3,5,3,5,4,4,4,4,3,5,5,5,4,4,4,4,3,6,5,6,7,7,7,7,6,6,6,6,6,7,7,7], solution: [4,6,8,10,20,22,24,26,37,39,41,43,53,55,57,59] },
  'star-double-promoted-18': { kind: 'same-size-fixed-seed-replacement', seed: 20260724, generationIndex: 200, movedCells: [18,27,40,54], regions: [0,0,0,1,1,1,1,2,3,0,0,0,1,1,1,1,2,3,0,0,0,1,4,1,1,2,3,0,4,4,4,4,2,2,2,3,5,5,5,5,2,2,2,2,3,5,5,5,5,6,2,3,3,3,7,6,6,6,6,2,3,3,3,7,7,7,7,8,8,8,8,8,7,7,7,7,8,8,8,8,8], solution: [5,7,9,11,22,24,28,35,39,41,45,52,56,58,69,71,73,75] },
});

export function applyStarDoubleProductionOverride(level) {
  const override = STAR_DOUBLE_PRODUCTION_OVERRIDES[level.id];
  if (!override) return level;
  return {
    ...level,
    regions: [...override.regions],
    solution: [...override.solution],
    revealPath: [...override.solution],
    productionAdjustment: override.kind,
    productionSeed: override.seed,
    productionGenerationIndex: override.generationIndex,
    productionMovedCells: [...override.movedCells],
  };
}
