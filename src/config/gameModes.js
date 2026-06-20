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
    name: 'Classic',
    role: 'Beginner',
    badge: '推荐新手先玩',
    description: '学习基础路径规则',
    detail: '只用上下左右移动，适合先理解数字顺序、隐藏数字和一笔画目标。',
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
    role: 'Main Mode',
    badge: '标准主玩法',
    description: '完整的一笔画推理体验',
    detail: '加入斜向移动，隐藏信息 + 路径推理 + 一笔画完成感更完整。',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: 20,
    progressKey: 'cg_progress',
    highScoresKey: 'cg_highscores',
    savedGameKey: 'cg_saved_game',
    color: 'from-cyan-400 to-blue-600'
  },
  [PLAY_MODES.portal]: {
    id: PLAY_MODES.portal,
    name: 'Portal Mode',
    role: 'Advanced / Alpha',
    badge: '进阶实验玩法',
    description: '包含隐藏传送门的进阶挑战',
    detail: 'Alpha Pack 内容，适合熟悉主玩法后尝试隐藏传送门。',
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
