import { getPortalLevelCount } from '../game/portal/portalRules.js';
import { getStarLineLevelCount } from '../game/starLine/starLineRules.js';

export const PLAY_MODES = {
  classic: 'classic',
  diagonal: 'diagonal',
  portalClassic: 'portalClassic',
  hidden: 'hidden',
  starLine: 'starLine'
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

// Curated level count (lazy-init to avoid circular imports)
let _curatedCountFn = null;
export function _setCuratedCountFn(fn) { _curatedCountFn = fn; }

export const getClassicSectionLevelCount = (diff, mode = 'classic') => {
  const section = CLASSIC_STRUCTURE.find(s => s.diff === diff);
  const base = section ? section.count : 5;
  const curated = _curatedCountFn ? _curatedCountFn(mode, diff) : 0;
  return base + curated;
};

export const getClassicTotalLevels = (mode = 'classic') => {
  const base = CLASSIC_STRUCTURE.reduce((sum, s) => sum + s.count, 0);
  const curated = _curatedCountFn
    ? CLASSIC_STRUCTURE.reduce((sum, s) => sum + (_curatedCountFn(mode, s.diff)), 0)
    : 0;
  return base + curated;
};

/** Convert 1-based linear level number to { diff, levelIdx } for classic/diagonal modes. */
export const getClassicLevelTargetByNumber = (mode, levelNumber) => {
  if (levelNumber < 1) return null;
  let remaining = levelNumber - 1;
  for (const section of CLASSIC_STRUCTURE) {
    const count = getClassicSectionLevelCount(section.diff, mode);
    if (remaining < count) return { diff: section.diff, levelIdx: remaining, mode };
    remaining -= count;
  }
  return null; // beyond total
};

const WIN_PANEL_DEFAULT = {
  title: '关卡完成！',
  titleClass: 'text-3xl font-black text-[#d7eee7]',
  subtitle: 'Path complete',
  description: null,
  descriptionClass: '',
  detailLabel: '成绩详情',
  detailAccentClass: 'font-mono normal-case tracking-normal text-emerald-300',
  buttonClass: 'button-primary w-full py-4 text-lg flex justify-center items-center gap-2',
  buttonClassNoGlow: 'button-primary w-full py-4'
};

const createWinPanelConfig = (overrides = {}) => ({
  ...WIN_PANEL_DEFAULT,
  ...overrides
});

export const GAME_MODES = {
  [PLAY_MODES.classic]: {
    id: PLAY_MODES.classic,
    name: '经典模式',
    description: '顺着数字，把整张棋盘连成一条路。',
    movement: MOVEMENT_TYPES.orthogonal,
    progressKey: 'cg_classic_v2_progress',
    highScoresKey: 'cg_classic_v2_highscores',
    savedGameKey: 'cg_classic_v2_saved_game',
    color: 'from-emerald-400 to-green-600',
    winPanel: createWinPanelConfig()
  },
  [PLAY_MODES.diagonal]: {
    id: PLAY_MODES.diagonal,
    name: '八向连线',
    description: '加入斜向连接，路线规划更灵活。',
    movement: MOVEMENT_TYPES.diagonal,
    progressKey: 'cg_diagonal_progress',
    highScoresKey: 'cg_diagonal_highscores',
    savedGameKey: 'cg_diagonal_saved_game',
    color: 'from-cyan-400 to-sky-600',
    winPanel: createWinPanelConfig()
  },
  [PLAY_MODES.portalClassic]: {
    id: PLAY_MODES.portalClassic,
    name: '经典传送门',
    description: '穿过传送门，完成一条不断开的路径。',
    movement: MOVEMENT_TYPES.diagonal,
    levelCount: getPortalLevelCount(PLAY_MODES.portalClassic),
    progressKey: 'cg_portal_progress',
    highScoresKey: 'cg_portal_best_steps',
    savedGameKey: 'cg_portal_saved_game',
    color: 'from-violet-500 to-fuchsia-600',
    winPanel: createWinPanelConfig({
      title: '传送门谜题完成！',
      titleClass: 'text-3xl font-black text-[#d7c8ef]',
      detailLabel: '通关数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-violet-300',
      buttonClass: 'w-full bg-[#8068ad] hover:bg-[#9279c0] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#493b65]',
      buttonClassNoGlow: 'w-full bg-[#8068ad] hover:bg-[#9279c0] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] transition-colors'
    })
  },
  [PLAY_MODES.hidden]: {
    id: PLAY_MODES.hidden,
    name: '极简线索',
    description: '只给关键数字，推完整路线。线索极少，推理极深。',
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: 60,
    progressKey: 'cg_hidden_progress',
    highScoresKey: 'cg_hidden_best_steps',
    savedGameKey: 'cg_hidden_saved_game',
    color: 'from-orange-400 to-red-600',
    winPanel: createWinPanelConfig({
      title: '推理完成！',
      titleClass: 'text-3xl font-black text-[#f0a070]',
      description: '你用关键数字还原了完整路线',
      descriptionClass: 'text-sm text-[#c0a890] mt-1 mb-1',
      detailLabel: '推理数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-orange-300'
    })
  },
  [PLAY_MODES.starLine]: {
    id: PLAY_MODES.starLine,
    name: '星线谜阵',
    description: '在每一行、每一列、每片星域放入指定数量的星点；星点不能相邻。',
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: getStarLineLevelCount(),
    progressKey: 'cg_star_line_progress',
    highScoresKey: 'cg_star_line_records',
    savedGameKey: 'cg_star_line_saved_game',
    color: 'from-purple-400 to-amber-400',
    winPanel: createWinPanelConfig({
      title: '星线完成！',
      titleClass: 'text-3xl font-black text-[#e7d6ff]',
      subtitle: 'Logic complete',
      description: '星点满足全部行列与星域规则',
      descriptionClass: 'text-sm text-[#cdb8f3] mt-1 mb-1',
      detailLabel: '星阵数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-purple-200',
      buttonClass: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#493463]',
      buttonClassNoGlow: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] transition-colors'
    })
  }
};

export const ONE_LINE_MODE_LIST = [
  GAME_MODES[PLAY_MODES.classic],
  GAME_MODES[PLAY_MODES.diagonal],
  GAME_MODES[PLAY_MODES.hidden],
  GAME_MODES[PLAY_MODES.portalClassic]
];

export const STAR_LINE_MODE_LIST = [
  GAME_MODES[PLAY_MODES.starLine]
];

export const GAME_MODE_LIST = [
  ...ONE_LINE_MODE_LIST,
  ...STAR_LINE_MODE_LIST
];

export const getGameModeConfig = (playMode) => GAME_MODES[playMode] || GAME_MODES[PLAY_MODES.classic];

export const getLevelsPerDiff = (playMode) => {
  const config = getGameModeConfig(playMode);
  return config.levelCount || getClassicTotalLevels(playMode);
};

export const getSavedGameKey = (playMode) => getGameModeConfig(playMode).savedGameKey;

export const isHiddenMode = (playMode) => playMode === PLAY_MODES.hidden;

export const getWinPanelConfig = (playMode) => getGameModeConfig(playMode).winPanel || WIN_PANEL_DEFAULT;
