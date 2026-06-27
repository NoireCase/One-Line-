export const PLAY_MODES = {
  classic: 'classic',
  diagonal: 'diagonal',
  portalClassic: 'portalClassic',
  portalCollect: 'portalCollect'
};

export const MOVEMENT_TYPES = {
  orthogonal: 'orthogonal',
  diagonal: 'diagonal'
};

// Classic and Diagonal are now separate modes.
// This structure only defines section sizes for the shared generated boards.
// Exported so levelNavigation can derive offsets automatically.
export const CLASSIC_STRUCTURE = [
  { diff: 'easy', count: 10, grid: 5 },
  { diff: 'medium', count: 15, grid: 7 },
  { diff: 'hard', count: 20, grid: 9 }
];

// Target structure for future expansion (not yet applied to formal levels)
export const TARGET_STRUCTURE = [
  { diff: 'easy', count: 10, grid: 5 },
  { diff: 'medium', count: 20, grid: 7 },
  { diff: 'hard', count: 30, grid: 9 }
];

export const getTargetSectionCount = (diff) => {
  const section = TARGET_STRUCTURE.find(s => s.diff === diff);
  return section ? section.count : 0;
};

export const getTargetTotalLevels = () =>
  TARGET_STRUCTURE.reduce((sum, s) => sum + s.count, 0);

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
    description: '顺着数字，把整张棋盘连成一条路。',
    movement: MOVEMENT_TYPES.orthogonal,
    progressKey: 'cg_classic_v2_progress',
    highScoresKey: 'cg_classic_v2_highscores',
    savedGameKey: 'cg_classic_v2_saved_game',
    color: 'from-emerald-400 to-green-600'
  },
  [PLAY_MODES.diagonal]: {
    id: PLAY_MODES.diagonal,
    name: '八向连线',
    description: '加入斜向连接，路线规划更灵活。',
    movement: MOVEMENT_TYPES.diagonal,
    progressKey: 'cg_diagonal_progress',
    highScoresKey: 'cg_diagonal_highscores',
    savedGameKey: 'cg_diagonal_saved_game',
    color: 'from-cyan-400 to-sky-600'
  },
  [PLAY_MODES.portalClassic]: {
    id: PLAY_MODES.portalClassic,
    name: '经典传送门',
    description: '穿过传送门，完成一条不断开的路径。',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: 8,
    progressKey: 'cg_portal_progress',
    highScoresKey: 'cg_portal_best_steps',
    savedGameKey: 'cg_portal_saved_game',
    color: 'from-violet-500 to-fuchsia-600'
  },
  [PLAY_MODES.portalCollect]: {
    id: PLAY_MODES.portalCollect,
    name: '传送门收集',
    description: '吃完所有金币，通过传送门抵达终点。步数越少，评价越高。',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: 2,
    progressKey: 'cg_portal_collect_progress',
    highScoresKey: 'cg_portal_collect_best_steps',
    savedGameKey: 'cg_portal_collect_saved_game',
    color: 'from-amber-400 to-violet-600'
  }
};

export const GAME_MODE_LIST = [
  GAME_MODES[PLAY_MODES.classic],
  GAME_MODES[PLAY_MODES.diagonal],
  GAME_MODES[PLAY_MODES.portalClassic],
  GAME_MODES[PLAY_MODES.portalCollect]
];

export const getGameModeConfig = (playMode) => GAME_MODES[playMode] || GAME_MODES[PLAY_MODES.classic];

export const getLevelsPerDiff = (playMode) => {
  const config = getGameModeConfig(playMode);
  return config.levelCount || getClassicTotalLevels();
};

export const getSavedGameKey = (playMode) => getGameModeConfig(playMode).savedGameKey;
