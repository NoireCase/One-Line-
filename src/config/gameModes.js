export const PLAY_MODES = {
  classic: 'classic',
  diagonal: 'diagonal',
  portal: 'portal'
};

export const MOVEMENT_TYPES = {
  orthogonal: 'orthogonal',
  diagonal: 'diagonal'
};

export const GAME_MODES = {
  [PLAY_MODES.classic]: {
    id: PLAY_MODES.classic,
    name: '经典模式',
    description: '四向路径',
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: 5,
    progressKey: 'cg_classic_progress',
    highScoresKey: 'cg_classic_highscores',
    savedGameKey: 'cg_classic_saved_game',
    color: 'from-emerald-400 to-green-600'
  },
  [PLAY_MODES.diagonal]: {
    id: PLAY_MODES.diagonal,
    name: '斜线模式',
    description: '多方向路径',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: 20,
    progressKey: 'cg_progress',
    highScoresKey: 'cg_highscores',
    savedGameKey: 'cg_saved_game',
    color: 'from-cyan-400 to-blue-600'
  },
  [PLAY_MODES.portal]: {
    id: PLAY_MODES.portal,
    name: '传送门谜题',
    description: '跨区域路径',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: 9,
    progressKey: 'cg_portal_progress',
    highScoresKey: 'cg_portal_best_steps',
    savedGameKey: 'cg_portal_saved_game',
    color: 'from-violet-500 to-fuchsia-600'
  }
};

export const GAME_MODE_LIST = [
  GAME_MODES[PLAY_MODES.classic],
  GAME_MODES[PLAY_MODES.diagonal],
  GAME_MODES[PLAY_MODES.portal]
];

export const getGameModeConfig = (playMode) => GAME_MODES[playMode] || GAME_MODES[PLAY_MODES.diagonal];

export const getLevelsPerDiff = (playMode) => getGameModeConfig(playMode).levelCount;

export const getSavedGameKey = (playMode) => getGameModeConfig(playMode).savedGameKey;
