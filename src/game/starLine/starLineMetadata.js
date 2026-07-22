/**
 * Star Line 共享元数据 — 技巧标签、ID区间、章节配置、校验枚举。
 *
 * 本模块为纯数据定义，不包含运行时逻辑。
 * React 组件、Node 脚本、Validator 均导入同一份定义，杜绝多源复制。
 */

// ═══ A. gameId 常量（与 starLineProgressV2.js 一致，此处集中维护） ═══

export const STAR_SINGLE_MODE_ID = 'starSingle';
export const STAR_DOUBLE_MODE_ID = 'starDouble';
export const STAR_LINE_LEGACY_MODE_ID = 'starLine';

// ═══ B. ID 区间规则 ═══

export const STAR_LINE_ID_RANGES = Object.freeze([
  {
    gameId: STAR_SINGLE_MODE_ID,
    label: '单星·已发布',
    firstLevelId: 'star-lv-01',
    lastLevelId: 'star-lv-20',
    count: 20,
    released: true,
  },
  {
    gameId: STAR_DOUBLE_MODE_ID,
    label: '双星·已发布',
    firstLevelId: 'star-lv-21',
    lastLevelId: 'star-lv-30',
    count: 10,
    released: true,
  },
  {
    gameId: STAR_SINGLE_MODE_ID,
    label: '单星·已发布',
    firstLevelId: 'star-lv-31',
    lastLevelId: 'star-lv-70',
    count: 40,
    released: true,
  },
  {
    gameId: STAR_DOUBLE_MODE_ID,
    label: '双星·预留',
    firstLevelId: 'star-lv-71',
    lastLevelId: 'star-lv-120',
    count: 50,
    released: false,
  },
]);

/** 旧30关迁移基线：v1数组下标 0–29 对应的稳定 levelId */
export const LEGACY_MIGRATION_IDS = Object.freeze(
  Array.from({ length: 30 }, (_, i) => `star-lv-${String(i + 1).padStart(2, '0')}`)
);

// ═══ C. 难度与段位枚举 ═══

export const VALID_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const VALID_DIFFICULTY_BANDS = Object.freeze(['beginner', 'intermediate', 'advanced']);

// ═══ D. 技巧标签注册表 ═══

export const STAR_SINGLE_TECHNIQUE_TAGS = Object.freeze([
  'row-single',
  'column-single',
  'region-single',
  'adjacency-exclusion',
  'row-column-intersection',
  'region-row-lock',
  'region-column-lock',
  'region-capacity',
  'edge-region',
  'symmetry-break',
  'coupled-regions',
  'propagation-chain',
  'short-contradiction',
  'global-balance',
  'irregular-region',
]);

export const STAR_DOUBLE_TECHNIQUE_TAGS = Object.freeze([
  'quota-zero-of-two',
  'quota-one-of-two',
  'quota-two-of-two',
  'double-star-spacing',
  'row-capacity',
  'column-capacity',
  'region-capacity',
  'row-pair',
  'column-pair',
  'region-pair',
  'row-region-coupling',
  'column-region-coupling',
  'alternating-candidates',
  'coupled-quota-chain',
  'saturation-contradiction',
  'global-combination',
  'high-density-reduction',
]);

export const ALL_TECHNIQUE_TAGS = Object.freeze([
  ...STAR_SINGLE_TECHNIQUE_TAGS,
  ...STAR_DOUBLE_TECHNIQUE_TAGS,
]);

// ═══ E. 五章节配置（唯一来源） ═══

/**
 * 章节定义。
 * startDisplayNumber / endDisplayNumber 为玩法内部 1-based 显示编号。
 * 关卡选择页、E2E helper、进度统计均使用本配置。
 * 章节归属由 { gameId, displayNumber } 决定，不依赖全局数组下标。
 */
export const STAR_SINGLE_CHAPTERS = Object.freeze([
  {
    chapterId: 'star-single-intro',
    gameId: STAR_SINGLE_MODE_ID,
    title: '入门 · 单星',
    startDisplayNumber: 1,
    endDisplayNumber: 10,
    order: 0,
  },
  {
    chapterId: 'star-single-basic',
    gameId: STAR_SINGLE_MODE_ID,
    title: '基础 · 单星',
    startDisplayNumber: 11,
    endDisplayNumber: 25,
    order: 1,
  },
  {
    chapterId: 'star-single-intermediate',
    gameId: STAR_SINGLE_MODE_ID,
    title: '进阶 · 单星',
    startDisplayNumber: 26,
    endDisplayNumber: 40,
    order: 2,
  },
  {
    chapterId: 'star-single-advanced',
    gameId: STAR_SINGLE_MODE_ID,
    title: '高难 · 单星',
    startDisplayNumber: 41,
    endDisplayNumber: 52,
    order: 3,
  },
  {
    chapterId: 'star-single-final',
    gameId: STAR_SINGLE_MODE_ID,
    title: '终局 · 单星',
    startDisplayNumber: 53,
    endDisplayNumber: 60,
    order: 4,
  },
]);

export const STAR_DOUBLE_CHAPTERS = Object.freeze([
  {
    chapterId: 'star-double-intro',
    gameId: STAR_DOUBLE_MODE_ID,
    title: '入门 · 双星',
    startDisplayNumber: 1,
    endDisplayNumber: 10,
    order: 0,
  },
  {
    chapterId: 'star-double-basic',
    gameId: STAR_DOUBLE_MODE_ID,
    title: '基础 · 双星',
    startDisplayNumber: 11,
    endDisplayNumber: 25,
    order: 1,
  },
  {
    chapterId: 'star-double-intermediate',
    gameId: STAR_DOUBLE_MODE_ID,
    title: '进阶 · 双星',
    startDisplayNumber: 26,
    endDisplayNumber: 40,
    order: 2,
  },
  {
    chapterId: 'star-double-advanced',
    gameId: STAR_DOUBLE_MODE_ID,
    title: '高难 · 双星',
    startDisplayNumber: 41,
    endDisplayNumber: 52,
    order: 3,
  },
  {
    chapterId: 'star-double-final',
    gameId: STAR_DOUBLE_MODE_ID,
    title: '终局 · 双星',
    startDisplayNumber: 53,
    endDisplayNumber: 60,
    order: 4,
  },
]);

/** 根据 gameId 返回章节配置列表 */
export function getChaptersForGame(gameId) {
  if (gameId === STAR_SINGLE_MODE_ID) return STAR_SINGLE_CHAPTERS;
  if (gameId === STAR_DOUBLE_MODE_ID) return STAR_DOUBLE_CHAPTERS;
  return [];
}

/**
 * 根据 { gameId, displayNumber } 找到对应章节。
 * 返回 undefined 表示该关卡的 displayNumber 不在任何已定义章节范围内。
 */
export function findChapterForLevel(gameId, displayNumber) {
  const chapters = getChaptersForGame(gameId);
  return chapters.find(
    c => displayNumber >= c.startDisplayNumber && displayNumber <= c.endDisplayNumber
  );
}

/**
 * 返回当前实际关卡数据中可显示的章节（过滤空章节）。
 * @param {string} gameId
 * @param {number} totalLevels — 该玩法当前实际关卡总数
 */
export function getVisibleChapters(gameId, totalLevels) {
  const chapters = getChaptersForGame(gameId);
  return chapters
    .filter(c => c.startDisplayNumber <= totalLevels)
    .map(c => ({
      ...c,
      endDisplayNumber: Math.min(c.endDisplayNumber, totalLevels),
    }));
}
