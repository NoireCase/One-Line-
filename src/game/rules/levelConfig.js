import {
  MOVEMENT_TYPES,
  PLAY_MODES,
  getClassicMovement
} from '../../config/gameModes.js';
import { getPortalLevel, isPortalMode } from '../portal/portalRules.js';

export const ORTHOGONAL_RULE = {
  id: 'classic',
  movement: MOVEMENT_TYPES.orthogonal,
  bridge: false,
  portal: false,
  obstacle: false,
  oneWay: false,
  path: {
    requireSequential: true,
    requireFullBoard: true,
    allowCrossing: false
  },
  scoring: {
    specialRuleBonus: false
  }
};

export const DIAGONAL_RULE = {
  ...ORTHOGONAL_RULE,
  id: 'diagonal',
  movement: MOVEMENT_TYPES.diagonal
};

export const PORTAL_RULE = {
  ...DIAGONAL_RULE,
  id: 'portal',
  portal: true
};

export const RULE_BY_PLAY_MODE = {
  [PLAY_MODES.classic]: { ...ORTHOGONAL_RULE, movement: MOVEMENT_TYPES.orthogonal },
  diagonal: { ...DIAGONAL_RULE, movement: MOVEMENT_TYPES.diagonal },
  [PLAY_MODES.portal]: { ...PORTAL_RULE, movement: MOVEMENT_TYPES.diagonal }
};

export const createLevelConfig = (difficulty, levelIdx, playMode = PLAY_MODES.classic) => {
  if (isPortalMode(playMode)) {
    return {
      id: `${playMode}-${difficulty}-${levelIdx + 1}`,
      difficulty,
      levelIdx,
      playMode,
      rules: PORTAL_RULE,
      portalLevel: getPortalLevel(levelIdx),
      targetSteps: getPortalLevel(levelIdx).targetSteps
    };
  }
  const movement = getClassicMovement(difficulty, levelIdx);
  const baseRules = movement === MOVEMENT_TYPES.orthogonal
    ? RULE_BY_PLAY_MODE[PLAY_MODES.classic]
    : RULE_BY_PLAY_MODE.diagonal;
  const rules = { ...baseRules, movement };
  return {
    id: `classic-${difficulty}-${levelIdx + 1}`,
    difficulty,
    levelIdx,
    playMode,
    rules
  };
};

export const resolveRules = (levelConfig) => levelConfig?.rules || DIAGONAL_RULE;
