import {
  MOVEMENT_TYPES,
  PLAY_MODES,
  isHiddenMode
} from '../../config/gameModes.js';
import { getPortalLevel, isPortalMode } from '../portal/portalRules.js';
import { getHiddenLevel } from '../../data/hiddenLevels.js';
import { getStarLineLevel, isStarLineMode } from '../starLine/starLineRules.js';

export const ORTHOGONAL_RULE = {
  id: 'classic',
  movement: MOVEMENT_TYPES.orthogonal,
  bridge: false,
  portal: false,
  obstacle: false,
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

export const HIDDEN_RULE = {
  ...ORTHOGONAL_RULE,
  id: 'hidden',
  movement: MOVEMENT_TYPES.orthogonal
};

export const STAR_LINE_RULE = {
  ...ORTHOGONAL_RULE,
  id: 'starLine',
  starBattle: true,
  path: { requireSequential: false, requireFullBoard: false, allowCrossing: false }
};

export const RULE_BY_PLAY_MODE = {
  [PLAY_MODES.classic]: { ...ORTHOGONAL_RULE, movement: MOVEMENT_TYPES.orthogonal },
  [PLAY_MODES.diagonal]: { ...DIAGONAL_RULE, movement: MOVEMENT_TYPES.diagonal },
  [PLAY_MODES.hidden]: { ...HIDDEN_RULE, movement: MOVEMENT_TYPES.orthogonal },
  [PLAY_MODES.portalClassic]: { ...PORTAL_RULE, movement: MOVEMENT_TYPES.diagonal },
  [PLAY_MODES.starLine]: { ...STAR_LINE_RULE, movement: MOVEMENT_TYPES.orthogonal }
};

export const createLevelConfig = (difficulty, levelIdx, playMode = PLAY_MODES.classic) => {
  if (isHiddenMode(playMode)) {
    const hiddenLevel = getHiddenLevel(levelIdx);
    return {
      id: `${playMode}-${levelIdx + 1}`,
      difficulty: 'easy',
      levelIdx,
      playMode,
      rules: HIDDEN_RULE,
      hiddenLevel
    };
  }
  if (isPortalMode(playMode)) {
    const portalLevel = getPortalLevel(levelIdx, playMode);
    return {
      id: `${playMode}-${difficulty}-${levelIdx + 1}`,
      difficulty,
      levelIdx,
      playMode,
      rules: PORTAL_RULE,
      portalLevel,
      targetSteps: portalLevel.targetSteps
    };
  }
  if (isStarLineMode(playMode)) {
    const starLineLevel = getStarLineLevel(levelIdx);
    return {
      id: `${playMode}-${levelIdx + 1}`,
      difficulty: starLineLevel?.difficulty || 'easy',
      levelIdx,
      playMode,
      rules: STAR_LINE_RULE,
      starLineLevel
    };
  }
  const movement = playMode === PLAY_MODES.diagonal
    ? MOVEMENT_TYPES.diagonal
    : MOVEMENT_TYPES.orthogonal;
  const baseRules = movement === MOVEMENT_TYPES.orthogonal
    ? RULE_BY_PLAY_MODE[PLAY_MODES.classic]
    : RULE_BY_PLAY_MODE[PLAY_MODES.diagonal];
  const rules = { ...baseRules, movement };
  return {
    id: `${playMode}-${difficulty}-${levelIdx + 1}`,
    difficulty,
    levelIdx,
    playMode,
    rules
  };
};

export const resolveRules = (levelConfig) => levelConfig?.rules || DIAGONAL_RULE;
