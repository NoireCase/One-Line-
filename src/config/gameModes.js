export const PLAY_MODES = {
  classic: 'classic',
  portal: 'portal'
};

export const MOVEMENT_TYPES = {
  orthogonal: 'orthogonal',
  diagonal: 'diagonal'
};

// Classic 模式：按 (difficulty, levelIdx) 返回移动方式
// 使用原 Classic 和 Diagonal 关卡参数，确保棋盘尺寸递增
const CLASSIC_STRUCTURE = [
  { diff: 'easy', count: 10, grid: 5, moves: [
    'orthogonal','orthogonal','orthogonal','orthogonal','orthogonal',
    'diagonal','diagonal','diagonal','diagonal','diagonal'
  ]},
  { diff: 'medium', count: 15, grid: 7, moves: [
    'diagonal','diagonal','diagonal','diagonal','diagonal','diagonal',
    'diagonal','diagonal','diagonal','diagonal','diagonal','diagonal',
    'diagonal','diagonal','diagonal'
  ]},
  { diff: 'hard', count: 20, grid: 9, moves: [
    'diagonal','diagonal','diagonal','diagonal','diagonal','diagonal',
    'diagonal','diagonal','diagonal','diagonal','diagonal','diagonal',
    'diagonal','diagonal','diagonal','diagonal','diagonal','diagonal',
    'diagonal','diagonal'
  ]}
];

export const getClassicMovement = (diff, levelIdx) => {
  const section = CLASSIC_STRUCTURE.find(s => s.diff === diff);
  if (!section || levelIdx >= section.moves.length) return MOVEMENT_TYPES.diagonal;
  return section.moves[levelIdx] === 'orthogonal' ? MOVEMENT_TYPES.orthogonal : MOVEMENT_TYPES.diagonal;
};

export const getClassicGridSize = (diff) => {
  const section = CLASSIC_STRUCTURE.find(s => s.diff === diff);
  return section ? section.grid : 5;
};

export const getClassicSectionLevelCount = (diff) => {
  const section = CLASSIC_STRUCTURE.find(s => s.diff === diff);
  return section ? section.count : 5;
};

export const getClassicTotalLevels = () => CLASSIC_STRUCTURE.reduce((sum, s) => sum + s.count, 0);

export const GAME_MODES = {
  [PLAY_MODES.classic]: {
    id: PLAY_MODES.classic,
    name: '经典模式',
    description: '从一笔画新手到路径规划大师',
    movement: MOVEMENT_TYPES.orthogonal,
    progressKey: 'cg_classic_v2_progress',
    highScoresKey: 'cg_classic_v2_highscores',
    savedGameKey: 'cg_classic_v2_saved_game',
    color: 'from-emerald-400 to-green-600'
  },
  [PLAY_MODES.portal]: {
    id: PLAY_MODES.portal,
    name: '传送门谜题',
    description: '穿过入口，选择正确出口，完成一条不断开的路径。',
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
  GAME_MODES[PLAY_MODES.portal]
];

export const getGameModeConfig = (playMode) => GAME_MODES[playMode] || GAME_MODES[PLAY_MODES.classic];

export const getLevelsPerDiff = (playMode) => {
  const config = getGameModeConfig(playMode);
  return config.levelCount || getClassicTotalLevels();
};

export const getSavedGameKey = (playMode) => getGameModeConfig(playMode).savedGameKey;
