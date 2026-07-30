import { getPortalLevelCount } from '../game/portal/portalRules.js';
import { getStarLineLevelCount } from '../game/starLine/starLineRules.js';
import { getModeCopy } from './gameExplanations.js';

export const PLAY_MODES = {
  classic: 'classic',
  diagonal: 'diagonal',
  portalClassic: 'portalClassic',
  hidden: 'hidden',
  starLine: 'starLine',
  starSingle: 'starSingle',
  starDouble: 'starDouble',
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
  subtitle: '路径已完成',
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
    familyId: 'oneLine',
    id: PLAY_MODES.classic,
    name: '循序寻踪',
    description: getModeCopy(PLAY_MODES.classic).description,
    movement: MOVEMENT_TYPES.orthogonal,
    progressKey: 'cg_classic_v2_progress',
    highScoresKey: 'cg_classic_v2_highscores',
    savedGameKey: 'cg_classic_v2_saved_game',
    color: 'from-emerald-400 to-green-600',
    winPanel: createWinPanelConfig(),
    // Classic/Diagonal 关卡为程序生成；levelSchema 仅描述 curated 覆盖数据的字段
    levelSchema: ['N', 'path', 'hiddenIndices'],
    inputCapabilities: ['mouse-drag', 'trackpad-drag'],
  },
  [PLAY_MODES.diagonal]: {
    familyId: 'oneLine',
    id: PLAY_MODES.diagonal,
    name: '八向寻踪',
    description: getModeCopy(PLAY_MODES.diagonal).description,
    movement: MOVEMENT_TYPES.diagonal,
    progressKey: 'cg_diagonal_progress',
    highScoresKey: 'cg_diagonal_highscores',
    savedGameKey: 'cg_diagonal_saved_game',
    color: 'from-cyan-400 to-sky-600',
    winPanel: createWinPanelConfig(),
    // Classic/Diagonal 关卡为程序生成；levelSchema 仅描述 curated 覆盖数据的字段
    levelSchema: ['N', 'path', 'hiddenIndices'],
    inputCapabilities: ['mouse-drag', 'trackpad-drag'],
  },
  [PLAY_MODES.portalClassic]: {
    familyId: 'oneLine',
    id: PLAY_MODES.portalClassic,
    name: '跃迁寻踪',
    description: getModeCopy(PLAY_MODES.portalClassic).description,
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
    }),
    levelSchema: ['N', 'portals', 'path'],
    inputCapabilities: ['mouse-drag', 'trackpad-drag'],
  },
  [PLAY_MODES.hidden]: {
    familyId: 'oneLine',
    id: PLAY_MODES.hidden,
    name: '隐迹寻踪',
    description: getModeCopy(PLAY_MODES.hidden).description,
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: 60,
    progressKey: 'cg_hidden_progress',
    highScoresKey: 'cg_hidden_best_steps',
    savedGameKey: 'cg_hidden_saved_game',
    color: 'from-orange-400 to-red-600',
    winPanel: createWinPanelConfig({
      title: '推理完成！',
      titleClass: 'text-3xl font-black text-[#f0a070]',
      subtitle: getModeCopy(PLAY_MODES.hidden).winSubtitle,
      description: '你用关键数字推演出了完整路线。',
      descriptionClass: 'text-sm text-[#c0a890] mt-1 mb-1',
      detailLabel: '推理数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-orange-300'
    }),
    levelSchema: ['N', 'keyNumbers', 'path'],
    inputCapabilities: ['mouse-drag', 'trackpad-drag'],
  },
  [PLAY_MODES.starLine]: {
    familyId: 'starLine',
    id: PLAY_MODES.starLine,
    name: '星线谜阵',
    description: getModeCopy(PLAY_MODES.starLine).description,
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: getStarLineLevelCount(),
    progressKey: 'cg_star_line_progress',
    highScoresKey: 'cg_star_line_records',
    savedGameKey: 'cg_star_line_saved_game',
    color: 'from-purple-400 to-amber-400',
    winPanel: createWinPanelConfig({
      title: '星线完成！',
      titleClass: 'text-3xl font-black text-[#e7d6ff]',
      subtitle: getModeCopy(PLAY_MODES.starLine).winSubtitle,
      // 规则完成语义由 win 徽标「行、列、星域规则已满足」承担，此处不再重复整句规则
      description: null,
      descriptionClass: 'text-sm text-[#cdb8f3] mt-1 mb-1',
      detailLabel: '星阵数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-purple-200',
      buttonClass: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#493463]',
      buttonClassNoGlow: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] transition-colors'
    }),
    levelSchema: ['N', 'regions', 'starsPerRow', 'starsPerCol', 'starsPerRegion', 'solution'],
    inputCapabilities: ['mouse-click', 'mouse-drag', 'trackpad-click', 'trackpad-drag'],
  },
  [PLAY_MODES.starSingle]: {
    familyId: 'starLine',
    id: PLAY_MODES.starSingle,
    name: '单星谜阵',
    description: getModeCopy(PLAY_MODES.starSingle).description,
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: getStarLineLevelCount(PLAY_MODES.starSingle),
    progressKey: 'cg_star_line_progress_v2',
    highScoresKey: 'cg_star_line_records',
    savedGameKey: 'cg_star_line_single_saved_game',
    color: 'from-purple-400 to-amber-400',
    winPanel: createWinPanelConfig({
      title: '星线完成！',
      titleClass: 'text-3xl font-black text-[#e7d6ff]',
      subtitle: getModeCopy(PLAY_MODES.starSingle).winSubtitle,
      // 规则完成语义由 win 徽标「行、列、星域规则已满足」承担，此处不再重复整句规则
      description: null,
      descriptionClass: 'text-sm text-[#cdb8f3] mt-1 mb-1',
      detailLabel: '星阵数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-purple-200',
      buttonClass: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#493463]',
      buttonClassNoGlow: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] transition-colors'
    }),
    levelSchema: ['N', 'regions', 'starsPerRow', 'starsPerCol', 'starsPerRegion', 'solution'],
    inputCapabilities: ['mouse-click', 'mouse-drag', 'trackpad-click', 'trackpad-drag'],
  },
  [PLAY_MODES.starDouble]: {
    familyId: 'starLine',
    id: PLAY_MODES.starDouble,
    name: '双星谜阵',
    description: getModeCopy(PLAY_MODES.starDouble).description,
    movement: MOVEMENT_TYPES.orthogonal,
    levelCount: getStarLineLevelCount(PLAY_MODES.starDouble),
    progressKey: 'cg_star_line_progress_v2',
    highScoresKey: 'cg_star_line_records',
    savedGameKey: 'cg_star_line_double_saved_game',
    color: 'from-purple-400 to-amber-400',
    winPanel: createWinPanelConfig({
      title: '星线完成！',
      titleClass: 'text-3xl font-black text-[#e7d6ff]',
      subtitle: getModeCopy(PLAY_MODES.starDouble).winSubtitle,
      // 规则完成语义由 win 徽标「行、列、星域规则已满足」承担，此处不再重复整句规则
      description: null,
      descriptionClass: 'text-sm text-[#cdb8f3] mt-1 mb-1',
      detailLabel: '星阵数据',
      detailAccentClass: 'font-mono normal-case tracking-normal text-purple-200',
      buttonClass: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#493463]',
      buttonClassNoGlow: 'w-full bg-[#8064b5] hover:bg-[#9272ca] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] transition-colors'
    }),
    levelSchema: ['N', 'regions', 'starsPerRow', 'starsPerCol', 'starsPerRegion', 'solution'],
    inputCapabilities: ['mouse-click', 'mouse-drag', 'trackpad-click', 'trackpad-drag'],
  }
};

// ───── 展示列表：从 GAME_MODES + familyId 派生，仅排序显式声明 ─────
// 列表内容（哪些 mode）由 GAME_MODES 条目的 familyId 决定；
// 列表顺序（展示权重）由本处 modeOrder 数组决定。
// 新增 mode 时：在 GAME_MODES 中加条目 + 设 familyId，再在对应 modeOrder 中加 id 即可。

const _buildModeList = (familyId, modeOrder) => {
  return modeOrder
    .filter((id) => getFamilyId(id) === familyId)
    .map((id) => GAME_MODES[id])
    .filter(Boolean);
};

// Hidden（隐迹寻踪）是 One Line 家族中差异最强的正式玩法，入口排序提至第二位。
export const ONE_LINE_MODE_LIST = _buildModeList('oneLine', [
  'classic',
  'hidden',
  'diagonal',
  'portalClassic',
]);

export const STAR_LINE_MODE_LIST = _buildModeList('starLine', [
  'starSingle',
  'starDouble',
]);

export const GAME_MODE_LIST = [
  ...ONE_LINE_MODE_LIST,
  ...STAR_LINE_MODE_LIST
];

// ───── P3B: family→mode 权威注册结构 ─────
// GAME_FAMILIES 从 GAME_MODES 各条目的 familyId 字段派生——不独立维护 mode 清单。
// 新增或移动 mode 时，只需修改 GAME_MODES 中的 familyId 字段。

const _buildFamilyRegistry = () => {
  const families = {};
  for (const modeId of Object.keys(GAME_MODES)) {
    const config = GAME_MODES[modeId];
    if (!config.familyId) continue;
    if (!families[config.familyId]) {
      families[config.familyId] = { id: config.familyId, modes: [] };
    }
    families[config.familyId].modes.push(modeId);
  }
  // freeze
  for (const f of Object.values(families)) {
    f.modes = Object.freeze(f.modes);
  }
  return Object.freeze(families);
};

export const GAME_FAMILIES = _buildFamilyRegistry();

/**
 * 从 modeId 推导 familyId。
 * 从 GAME_MODES 条目的 familyId 字段读取——唯一权威来源。
 * @param {string} modeId
 * @returns {'oneLine'|'starLine'|null}
 */
export function getFamilyId(modeId) {
  const config = GAME_MODES[modeId];
  return config?.familyId || null;
}

/**
 * 从 familyId 获取其下所有 modeId。
 * @param {'oneLine'|'starLine'} familyId
 * @returns {readonly string[]}
 */
export function getFamilyModeIds(familyId) {
  return GAME_FAMILIES[familyId]?.modes || [];
}

/**
 * P3B runtime selector：从 modeId 推导 runtime/interaction 类型。
 * 覆盖 board、session、capabilities（Hidden/Portal/StarLine）。
 * 不建立万能框架；只供 App/GameView 中原来通过 mode 字符串判断的分支使用。
 *
 * @param {string} modeId
 * @returns {{
 *   familyId: string,
 *   boardType: 'starLine'|'grid',
 *   sessionType: 'starLine'|'oneLine',
 *   capabilities: { hidden: boolean, portal: boolean, starLine: boolean }
 * }|null}
 */
export function getModeRuntime(modeId) {
  const familyId = getFamilyId(modeId);
  if (!familyId) return null;
  const isStarLineFamily = familyId === 'starLine';
  return {
    familyId,
    boardType: isStarLineFamily ? 'starLine' : 'grid',
    sessionType: isStarLineFamily ? 'starLine' : 'oneLine',
    capabilities: {
      hidden: modeId === PLAY_MODES.hidden,
      portal: modeId === PLAY_MODES.portalClassic,
      starLine: isStarLineFamily,
    },
  };
}

export const getGameModeConfig = (playMode) => GAME_MODES[playMode] || GAME_MODES[PLAY_MODES.classic];

export const getLevelsPerDiff = (playMode) => {
  const config = getGameModeConfig(playMode);
  return config.levelCount || getClassicTotalLevels(playMode);
};

export const getSavedGameKey = (playMode) => getGameModeConfig(playMode).savedGameKey;

export const isHiddenMode = (playMode) => playMode === PLAY_MODES.hidden;

export const getWinPanelConfig = (playMode) => getGameModeConfig(playMode).winPanel || WIN_PANEL_DEFAULT;
