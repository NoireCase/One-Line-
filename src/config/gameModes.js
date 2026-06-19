export const PLAY_MODES = {
  classic: 'classic',
  diagonal: 'diagonal'
};

export const MOVEMENT_TYPES = {
  orthogonal: 'orthogonal',
  diagonal: 'diagonal'
};

export const GAME_MODES = {
  [PLAY_MODES.classic]: {
    id: PLAY_MODES.classic,
    name: 'Classic',
    description: '仅支持上下左右连线',
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: 5,
    progressKey: 'cg_classic_progress',
    highScoresKey: 'cg_classic_highscores',
    savedGameKey: 'cg_classic_saved_game',
    color: 'from-emerald-400 to-green-600'
  },
  [PLAY_MODES.diagonal]: {
    id: PLAY_MODES.diagonal,
    name: 'Diagonal',
    description: '支持上下左右与斜向八方向连线',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: 20,
    progressKey: 'cg_progress',
    highScoresKey: 'cg_highscores',
    savedGameKey: 'cg_saved_game',
    color: 'from-cyan-400 to-blue-600'
  }
};

export const GAME_MODE_LIST = [
  GAME_MODES[PLAY_MODES.classic],
  GAME_MODES[PLAY_MODES.diagonal]
];

export const getGameModeConfig = (playMode) => GAME_MODES[playMode] || GAME_MODES[PLAY_MODES.diagonal];

export const getLevelsPerDiff = (playMode) => getGameModeConfig(playMode).levelCount;

export const getSavedGameKey = (playMode) => getGameModeConfig(playMode).savedGameKey;
