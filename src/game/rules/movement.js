import { MOVEMENT_TYPES } from '../../config/gameModes.js';

export const ORTHOGONAL_DIRECTIONS = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0]
];

export const DIAGONAL_DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
];

export const ALL_DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
];

export const getAllowedDirections = (rules) => {
  return rules.movement === MOVEMENT_TYPES.diagonal ? ALL_DIRECTIONS : ORTHOGONAL_DIRECTIONS;
};

export const getCellPosition = (index, N) => ({
  r: Math.floor(index / N),
  c: index % N
});

export const getCellIndex = (r, c, N) => r * N + c;

export const isInsideBoard = (r, c, N) => r >= 0 && r < N && c >= 0 && c < N;

export const isDiagonalDelta = (dr, dc) => Math.abs(dr) === 1 && Math.abs(dc) === 1;

export const canMoveBetween = (fromIndex, toIndex, N, rules) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  const dr = to.r - from.r;
  const dc = to.c - from.c;

  if (dr === 0 && dc === 0) return false;
  if (Math.abs(dr) > 1 || Math.abs(dc) > 1) return false;
  if (isDiagonalDelta(dr, dc) && rules.movement !== MOVEMENT_TYPES.diagonal) return false;
  return true;
};

export const getCrossingKeys = (fromIndex, toIndex, N) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  const dr = to.r - from.r;
  const dc = to.c - from.c;

  if (!isDiagonalDelta(dr, dc)) return [];

  const crossA = `${from.r},${to.c}-${to.r},${from.c}`;
  const crossB = `${to.r},${from.c}-${from.r},${to.c}`;
  return [crossA, crossB];
};

export const getSegmentKeys = (fromIndex, toIndex, N) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  return [
    `${from.r},${from.c}-${to.r},${to.c}`,
    `${to.r},${to.c}-${from.r},${from.c}`
  ];
};

export const hasPathCrossing = (path, fromIndex, toIndex, N, rules) => {
  if (rules.path.allowCrossing) return false;

  const crossingKeys = getCrossingKeys(fromIndex, toIndex, N);
  if (crossingKeys.length === 0) return false;

  for (let i = 0; i < path.length - 1; i++) {
    const segmentKeys = getSegmentKeys(path[i], path[i + 1], N);
    if (segmentKeys.some(key => crossingKeys.includes(key))) return true;
  }

  return false;
};

export const getMinMoveDistance = (fromIndex, toIndex, N, rules) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  const rowDistance = Math.abs(from.r - to.r);
  const colDistance = Math.abs(from.c - to.c);
  return rules.movement === MOVEMENT_TYPES.diagonal ? Math.max(rowDistance, colDistance) : rowDistance + colDistance;
};
