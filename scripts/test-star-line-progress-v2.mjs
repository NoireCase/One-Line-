/**
 * Star Line Progress V2 — 单双星独立化基础层测试
 * 运行: node scripts/test-star-line-progress-v2.mjs
 */

import {
  STAR_SINGLE_MODE_ID,
  STAR_DOUBLE_MODE_ID,
  STAR_SINGLE_LEVELS,
  STAR_DOUBLE_LEVELS,
  getStarLineLevelList,
  getStarLineGameId,
  getStarLineDisplayNumber,
  findStarLineLevelById,
  STAR_LINE_PROGRESS_V2_KEY,
  createDefaultProgressV2,
  migrateV1ToV2,
  loadProgressV2,
  repairProgressV2,
  getGameProgress,
  isLevelCompleted,
  isLevelUnlocked,
  completeLevel,
  unlockThroughLevel,
} from '../src/game/starLine/starLineProgressV2.js';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

// ── Test harness ──
let passed = 0;
let failed = 0;
const suiteStart = performance.now();

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertDeepEqual(a, b, msg) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg || 'deep equal failed'}: expected ${sb}, got ${sa}`);
}

function assertThrows(fn, expectedMsg, testName) {
  try {
    fn();
    throw new Error(`${testName || 'assertThrows'}: expected error but none thrown`);
  } catch (e) {
    if (expectedMsg && !e.message.includes(expectedMsg)) {
      throw new Error(`${testName || 'assertThrows'}: expected "${expectedMsg}" but got "${e.message}"`);
    }
  }
}

// ── localStorage mock ──
let mockStorage = {};
function setupMockStorage(data = {}) {
  mockStorage = { ...data };
}
globalThis.localStorage = {
  getItem(key) { return key in mockStorage ? mockStorage[key] : null; },
  setItem(key, val) { mockStorage[key] = val; },
  removeItem(key) { delete mockStorage[key]; },
};

// ── Helpers ──
function makeV1Progress(unlockedThrough, completed) {
  return { unlockedThrough, completed: completed || {} };
}

// ═══════════════════════════════════════════════════════════════
// Category 1: 关卡归属验证
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 1. 关卡归属验证 ═══');

test('STAR_SINGLE_LEVELS 有 20 关', () => {
  assert(STAR_SINGLE_LEVELS.length === 20, `expected 20, got ${STAR_SINGLE_LEVELS.length}`);
});

test('STAR_DOUBLE_LEVELS 有 10 关', () => {
  assert(STAR_DOUBLE_LEVELS.length === 10, `expected 10, got ${STAR_DOUBLE_LEVELS.length}`);
});

test('两个列表合计完整覆盖 30 关', () => {
  assert(STAR_SINGLE_LEVELS.length + STAR_DOUBLE_LEVELS.length === 30);
});

test('两个列表无重复 level ID', () => {
  const singleIds = new Set(STAR_SINGLE_LEVELS.map(l => l.id));
  for (const l of STAR_DOUBLE_LEVELS) {
    assert(!singleIds.has(l.id), `"${l.id}" appears in both lists`);
  }
});

test('所有 30 关被分配且无遗漏', () => {
  const singleIds = new Set(STAR_SINGLE_LEVELS.map(l => l.id));
  const doubleIds = new Set(STAR_DOUBLE_LEVELS.map(l => l.id));
  for (const l of STAR_LINE_LEVELS) {
    assert(singleIds.has(l.id) || doubleIds.has(l.id), `"${l.id}" not in either list`);
  }
});

test('单星全部 quota=1', () => {
  for (const l of STAR_SINGLE_LEVELS) {
    const q = l.starsPerRow ?? l.starsPerCol ?? l.starsPerRegion ?? 1;
    assert(q === 1, `"${l.id}" quota=${q}, expected 1`);
  }
});

test('双星全部 quota=2', () => {
  for (const l of STAR_DOUBLE_LEVELS) {
    const q = l.starsPerRow ?? l.starsPerCol ?? l.starsPerRegion ?? 1;
    assert(q === 2, `"${l.id}" quota=${q}, expected 2`);
  }
});

test('关卡列表已冻结', () => {
  assert(Object.isFrozen(STAR_SINGLE_LEVELS));
  assert(Object.isFrozen(STAR_DOUBLE_LEVELS));
});

// ═══════════════════════════════════════════════════════════════
// Category 2: 辅助函数
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 2. 辅助函数 ═══');

test('getStarLineGameId: star-lv-01 → starSingle', () => {
  assert(getStarLineGameId(STAR_LINE_LEVELS[0]) === STAR_SINGLE_MODE_ID);
});

test('getStarLineGameId: star-lv-20 → starSingle', () => {
  assert(getStarLineGameId(STAR_LINE_LEVELS[19]) === STAR_SINGLE_MODE_ID);
});

test('getStarLineGameId: star-lv-21 → starDouble', () => {
  assert(getStarLineGameId(STAR_LINE_LEVELS[20]) === STAR_DOUBLE_MODE_ID);
});

test('getStarLineGameId: star-lv-30 → starDouble', () => {
  assert(getStarLineGameId(STAR_LINE_LEVELS[29]) === STAR_DOUBLE_MODE_ID);
});

test('getStarLineDisplayNumber: starSingle + star-lv-01 = 1', () => {
  assert(getStarLineDisplayNumber(STAR_SINGLE_MODE_ID, 'star-lv-01') === 1);
});

test('getStarLineDisplayNumber: starSingle + star-lv-20 = 20', () => {
  assert(getStarLineDisplayNumber(STAR_SINGLE_MODE_ID, 'star-lv-20') === 20);
});

test('getStarLineDisplayNumber: starDouble + star-lv-21 = 1', () => {
  assert(getStarLineDisplayNumber(STAR_DOUBLE_MODE_ID, 'star-lv-21') === 1);
});

test('getStarLineDisplayNumber: starDouble + star-lv-30 = 10', () => {
  assert(getStarLineDisplayNumber(STAR_DOUBLE_MODE_ID, 'star-lv-30') === 10);
});

test('findStarLineLevelById 找到正确关卡', () => {
  const lv = findStarLineLevelById(STAR_SINGLE_MODE_ID, 'star-lv-01');
  assert(lv !== null && lv.id === 'star-lv-01');
});

test('findStarLineLevelById: 不存在→null', () => {
  assert(findStarLineLevelById(STAR_SINGLE_MODE_ID, 'star-lv-99') === null);
});

test('getStarLineLevelList: 返回正确列表', () => {
  assert(getStarLineLevelList(STAR_SINGLE_MODE_ID) === STAR_SINGLE_LEVELS);
  assert(getStarLineLevelList(STAR_DOUBLE_MODE_ID) === STAR_DOUBLE_LEVELS);
});

test('getStarLineLevelList: 未知 modeId 返回完整列表', () => {
  assert(getStarLineLevelList('unknown') === STAR_LINE_LEVELS);
});

// ═══════════════════════════════════════════════════════════════
// Category 3: 迁移
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 3. 迁移 ═══');

test('空进度迁移为默认 v2', () => {
  const v2 = migrateV1ToV2(null);
  assert(v2.version === 1);
  assert(v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
  assert(v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
  assert(Object.keys(v2.games[STAR_SINGLE_MODE_ID].completed).length === 0);
  assert(Object.keys(v2.games[STAR_DOUBLE_MODE_ID].completed).length === 0);
});

test('completed["0"] → starSingle.completed["star-lv-01"]', () => {
  const v2 = migrateV1ToV2(makeV1Progress(0, { '0': 3 }));
  assert(v2.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] === 3);
});

test('completed["19"] → starSingle.completed["star-lv-20"]', () => {
  const v2 = migrateV1ToV2(makeV1Progress(19, { '19': 3 }));
  assert(v2.games[STAR_SINGLE_MODE_ID].completed['star-lv-20'] === 3);
});

test('completed["20"] → starDouble.completed["star-lv-21"]', () => {
  const v2 = migrateV1ToV2(makeV1Progress(20, { '20': 3 }));
  assert(v2.games[STAR_DOUBLE_MODE_ID].completed['star-lv-21'] === 3);
});

test('completed["29"] → starDouble.completed["star-lv-30"]', () => {
  const v2 = migrateV1ToV2(makeV1Progress(29, { '29': 3 }));
  assert(v2.games[STAR_DOUBLE_MODE_ID].completed['star-lv-30'] === 3);
});

test('越界 completed 索引被忽略', () => {
  const v2 = migrateV1ToV2(makeV1Progress(0, { '99': 3, '-1': 3, '30': 3 }));
  assert(Object.keys(v2.games[STAR_SINGLE_MODE_ID].completed).length === 0);
  assert(Object.keys(v2.games[STAR_DOUBLE_MODE_ID].completed).length === 0);
});

test('非整数 completed key 被忽略', () => {
  const v2 = migrateV1ToV2(makeV1Progress(0, { 'abc': 3, '1.5': 3 }));
  assert(Object.keys(v2.games[STAR_SINGLE_MODE_ID].completed).length === 0);
  assert(Object.keys(v2.games[STAR_DOUBLE_MODE_ID].completed).length === 0);
});

test('unlockedThrough=5 → starSingle.unlockedThroughId=star-lv-06, 双星默认', () => {
  const v2 = migrateV1ToV2(makeV1Progress(5, {}));
  assert(v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-06');
  assert(v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
});

test('unlockedThrough=19 → starSingle 最后一关, 双星第一关', () => {
  const v2 = migrateV1ToV2(makeV1Progress(19, {}));
  assert(v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-20');
  assert(v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
});

test('unlockedThrough=23 → starSingle 全解锁, starDouble 映射到 star-lv-24', () => {
  const v2 = migrateV1ToV2(makeV1Progress(23, {}));
  // 23 is star-lv-24 (0-based index)
  assert(v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-20');
  assert(v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-24');
});

test('unlockedThrough=29 → 双星游标到最后一关 star-lv-30', () => {
  const v2 = migrateV1ToV2(makeV1Progress(29, {}));
  assert(v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-20');
  assert(v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-30');
});

test('unlockedThrough=99 → 双星 clamp 到 star-lv-30', () => {
  const v2 = migrateV1ToV2(makeV1Progress(99, {}));
  assert(v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-20');
  assert(v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-30');
});

test('迁移结果始终为 version:1 结构', () => {
  const v2 = migrateV1ToV2(makeV1Progress(10, { '0': 3, '5': 3 }));
  assert(v2.version === 1);
  assert(typeof v2.games === 'object');
  assert(STAR_SINGLE_MODE_ID in v2.games);
  assert(STAR_DOUBLE_MODE_ID in v2.games);
});

test('非连续完成：只迁移实际完成索引，不自动补齐', () => {
  const v2 = migrateV1ToV2(makeV1Progress(10, { '0': 3, '3': 3, '22': 3 }));
  const sCompleted = Object.keys(v2.games[STAR_SINGLE_MODE_ID].completed);
  const dCompleted = Object.keys(v2.games[STAR_DOUBLE_MODE_ID].completed);
  assert(sCompleted.length === 2, `single completed: ${sCompleted.length}`);
  assert(dCompleted.length === 1, `double completed: ${dCompleted.length}`);
  assert(sCompleted.includes('star-lv-01'));
  assert(sCompleted.includes('star-lv-04'));
  assert(dCompleted.includes('star-lv-23'));
  // 未完成的中间关卡不应出现
  assert(!sCompleted.includes('star-lv-02'));
  assert(!sCompleted.includes('star-lv-03'));
});

// ═══════════════════════════════════════════════════════════════
// Category 4: V2 优先 & 迁移生命周期
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 4. V2 优先 & 迁移生命周期 ═══');

test('v2 不存在 → 从 v1 迁移', () => {
  setupMockStorage({
    'cg_star_line_progress': JSON.stringify(makeV1Progress(3, { '0': 3, '1': 3 })),
  });
  const { progress, shouldPersist } = loadProgressV2();
  assert(shouldPersist === true);
  assert(progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] === 3);
  assert(progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-02'] === 3);
});

test('v2 已存在合法 → 直接使用，不重新迁移', () => {
  const existingV2 = createDefaultProgressV2();
  existingV2.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] = 3;
  setupMockStorage({
    'cg_star_line_progress': JSON.stringify(makeV1Progress(10, { '0': 3, '5': 3 })),
    [STAR_LINE_PROGRESS_V2_KEY]: JSON.stringify(existingV2),
  });
  const { progress, shouldPersist } = loadProgressV2();
  assert(shouldPersist === true);
  // v2 优先，旧 key 中 '5' 的完成记录不应合并进来
  assert(progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] === 3);
  assert(!progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-06']);
});

test('v2 JSON 无法解析 → 安全默认值，shouldPersist=false', () => {
  setupMockStorage({
    [STAR_LINE_PROGRESS_V2_KEY]: '!!! not valid json {{{',
  });
  const { progress, shouldPersist } = loadProgressV2();
  assert(shouldPersist === false);
  assert(progress.version === 1);
  assert(progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
  assert(progress.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
  // localStorage 中的损坏数据未被覆盖
  assert(mockStorage[STAR_LINE_PROGRESS_V2_KEY] === '!!! not valid json {{{');
});

test('v1 和 v2 都不存在 → 默认进度，shouldPersist=true', () => {
  setupMockStorage({});
  const { progress, shouldPersist } = loadProgressV2();
  assert(shouldPersist === true);
  assert(progress.version === 1);
  assert(progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
});

// ═══════════════════════════════════════════════════════════════
// Category 5: 损坏数据恢复
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 5. 损坏数据恢复 ═══');

test('repairProgressV2: 空对象修复为默认值', () => {
  const repaired = repairProgressV2({});
  assert(repaired.version === 1);
  assert(repaired.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
  assert(repaired.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
});

test('repairProgressV2: null → 默认值', () => {
  const repaired = repairProgressV2(null);
  assert(repaired.version === 1);
});

test('repairProgressV2: 缺少 games → 修复', () => {
  const repaired = repairProgressV2({ version: 1 });
  assert(repaired.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
});

test('repairProgressV2: 部分损坏 — 单星合法保留，双星损坏修复', () => {
  const partiallyCorrupted = {
    version: 1,
    games: {
      [STAR_SINGLE_MODE_ID]: {
        completed: { 'star-lv-01': 3, 'star-lv-03': 3 },
        unlockedThroughId: 'star-lv-05',
      },
      [STAR_DOUBLE_MODE_ID]: {
        completed: { 'star-lv-99': 3, 'star-lv-01': 3 }, // invalid IDs
        unlockedThroughId: 'star-lv-99', // invalid
      },
    },
  };
  const repaired = repairProgressV2(partiallyCorrupted);
  // 单星合法数据保留
  assert(repaired.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] === 3);
  assert(repaired.games[STAR_SINGLE_MODE_ID].completed['star-lv-03'] === 3);
  assert(repaired.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-05');
  // 双星非法数据被过滤
  assert(Object.keys(repaired.games[STAR_DOUBLE_MODE_ID].completed).length === 0);
  assert(repaired.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
});

test('repairProgressV2: 无效 unlockedThroughId 被重置为默认', () => {
  const corrupted = {
    version: 1,
    games: {
      [STAR_SINGLE_MODE_ID]: {
        completed: {},
        unlockedThroughId: 'not-a-real-id',
      },
      [STAR_DOUBLE_MODE_ID]: {
        completed: {},
        unlockedThroughId: 'star-lv-21',
      },
    },
  };
  const repaired = repairProgressV2(corrupted);
  assert(repaired.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
  assert(repaired.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
});

// ═══════════════════════════════════════════════════════════════
// Category 6: 进度 API
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 6. 进度 API ═══');

test('completeLevel: 标记关卡完成', () => {
  const p = createDefaultProgressV2();
  const next = completeLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-01');
  assert(isLevelCompleted(next, STAR_SINGLE_MODE_ID, 'star-lv-01'));
  assert(next.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] === 3);
});

test('completeLevel: 幂等', () => {
  const p = createDefaultProgressV2();
  const next1 = completeLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-01');
  const next2 = completeLevel(next1, STAR_SINGLE_MODE_ID, 'star-lv-01');
  assertDeepEqual(next1, next2, 'completeLevel should be idempotent');
});

test('completeLevel: 不修改输入对象', () => {
  const p = createDefaultProgressV2();
  const orig = JSON.stringify(p);
  completeLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-01');
  assert(JSON.stringify(p) === orig, 'input should not be mutated');
});

test('completeLevel: 完成双星关卡', () => {
  const p = createDefaultProgressV2();
  const next = completeLevel(p, STAR_DOUBLE_MODE_ID, 'star-lv-21');
  assert(isLevelCompleted(next, STAR_DOUBLE_MODE_ID, 'star-lv-21'));
});

test('unlockThroughLevel: 推进解锁游标', () => {
  const p = createDefaultProgressV2();
  const next = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-05');
  assert(isLevelUnlocked(next, STAR_SINGLE_MODE_ID, 'star-lv-05'));
  assert(isLevelUnlocked(next, STAR_SINGLE_MODE_ID, 'star-lv-01'));
});

test('unlockThroughLevel: 不会回退解锁游标', () => {
  const p = createDefaultProgressV2();
  const advanced = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-10');
  const reverted = unlockThroughLevel(advanced, STAR_SINGLE_MODE_ID, 'star-lv-03');
  assert(reverted.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-10');
});

test('unlockThroughLevel: 不修改输入对象', () => {
  const p = createDefaultProgressV2();
  const orig = JSON.stringify(p);
  unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-05');
  assert(JSON.stringify(p) === orig, 'input should not be mutated');
});

test('isLevelCompleted: 未完成→false', () => {
  const p = createDefaultProgressV2();
  assert(!isLevelCompleted(p, STAR_SINGLE_MODE_ID, 'star-lv-01'));
});

test('isLevelUnlocked: 第一关已解锁', () => {
  const p = createDefaultProgressV2();
  assert(isLevelUnlocked(p, STAR_SINGLE_MODE_ID, 'star-lv-01'));
  assert(isLevelUnlocked(p, STAR_DOUBLE_MODE_ID, 'star-lv-21'));
});

test('isLevelUnlocked: 第二关未解锁（默认）', () => {
  const p = createDefaultProgressV2();
  assert(!isLevelUnlocked(p, STAR_SINGLE_MODE_ID, 'star-lv-02'));
  assert(!isLevelUnlocked(p, STAR_DOUBLE_MODE_ID, 'star-lv-22'));
});

test('getGameProgress: 返回副本，修改不影响原对象', () => {
  const p = createDefaultProgressV2();
  const game = getGameProgress(p, STAR_SINGLE_MODE_ID);
  game.completed['star-lv-01'] = 3;
  assert(!isLevelCompleted(p, STAR_SINGLE_MODE_ID, 'star-lv-01'));
});

test('非法 modeId 被拒绝', () => {
  const p = createDefaultProgressV2();
  assertThrows(() => completeLevel(p, 'starLine', 'star-lv-01'), '未知 game mode');
  assertThrows(() => completeLevel(p, 'classic', 'star-lv-01'), '未知 game mode');
  assertThrows(() => completeLevel(p, '', 'star-lv-01'), '未知 game mode');
  assertThrows(() => isLevelCompleted(p, null, 'star-lv-01'), '未知 game mode');
  assertThrows(() => isLevelUnlocked(p, undefined, 'star-lv-01'), '未知 game mode');
});

test('错误归属的 levelId 被拒绝', () => {
  const p = createDefaultProgressV2();
  assertThrows(() => completeLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-21'), '不属于');
  assertThrows(() => completeLevel(p, STAR_DOUBLE_MODE_ID, 'star-lv-01'), '不属于');
  assertThrows(() => isLevelCompleted(p, STAR_SINGLE_MODE_ID, 'star-lv-30'), '不属于');
  assertThrows(() => isLevelUnlocked(p, STAR_DOUBLE_MODE_ID, 'star-lv-01'), '不属于');
  assertThrows(() => unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-99'), '不属于');
});

// ═══════════════════════════════════════════════════════════════
// Category 7: 默认进度结构
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 7. 默认进度结构 ═══');

test('createDefaultProgressV2: version=1', () => {
  assert(createDefaultProgressV2().version === 1);
});

test('createDefaultProgressV2: 两个 game 都有 empty completed', () => {
  const p = createDefaultProgressV2();
  assert(Object.keys(p.games[STAR_SINGLE_MODE_ID].completed).length === 0);
  assert(Object.keys(p.games[STAR_DOUBLE_MODE_ID].completed).length === 0);
});

test('createDefaultProgressV2: 两个玩法第一关解锁', () => {
  const p = createDefaultProgressV2();
  assert(p.games[STAR_SINGLE_MODE_ID].unlockedThroughId === 'star-lv-01');
  assert(p.games[STAR_DOUBLE_MODE_ID].unlockedThroughId === 'star-lv-21');
});

// ═══════════════════════════════════════════════════════════════
// Category 8: 旧 key 保护
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 8. 旧 key 保护 ═══');

test('migrateV1ToV2 不修改输入对象', () => {
  const v1 = makeV1Progress(5, { '0': 3, '3': 3 });
  const orig = JSON.stringify(v1);
  migrateV1ToV2(v1);
  assert(JSON.stringify(v1) === orig, 'v1 input should not be mutated');
});

test('loadProgressV2 在 v2 存在时保留旧 key 不变', () => {
  const oldV1Str = JSON.stringify(makeV1Progress(3, { '0': 3 }));
  setupMockStorage({
    'cg_star_line_progress': oldV1Str,
    [STAR_LINE_PROGRESS_V2_KEY]: JSON.stringify(createDefaultProgressV2()),
  });
  loadProgressV2();
  assert(mockStorage['cg_star_line_progress'] === oldV1Str,
    'old key should remain unchanged');
});

test('loadProgressV2 在 v2 损坏时不覆盖 v2 key', () => {
  const corruptedV2 = '!!! corrupt !!!';
  setupMockStorage({
    [STAR_LINE_PROGRESS_V2_KEY]: corruptedV2,
  });
  loadProgressV2();
  assert(mockStorage[STAR_LINE_PROGRESS_V2_KEY] === corruptedV2,
    'corrupted v2 should not be overwritten');
});

// ═══════════════════════════════════════════════════════════════
// Category 9: 迁移幂等性
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ 9. 迁移幂等性 ═══');

test('同一个旧数据迁移两次结果一致', () => {
  const v1 = makeV1Progress(5, { '0': 3, '3': 3, '22': 3 });
  const v2a = migrateV1ToV2(v1);
  const v2b = migrateV1ToV2(v1);
  assertDeepEqual(v2a, v2b, 'migration should be deterministic');
});

test('load → save → load 结果稳定', () => {
  const v1 = makeV1Progress(3, { '0': 3 });
  setupMockStorage({
    'cg_star_line_progress': JSON.stringify(v1),
  });
  const { progress: p1 } = loadProgressV2();
  // 模拟 save
  mockStorage[STAR_LINE_PROGRESS_V2_KEY] = JSON.stringify(p1);
  const { progress: p2 } = loadProgressV2();
  assertDeepEqual(p1, p2, 'load→save→load should be stable');
});

test('已存在 v2 时不重新迁移', () => {
  const existingV2 = createDefaultProgressV2();
  existingV2.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] = 3;
  const v1Extra = makeV1Progress(10, { '0': 3, '5': 3 });
  setupMockStorage({
    'cg_star_line_progress': JSON.stringify(v1Extra),
    [STAR_LINE_PROGRESS_V2_KEY]: JSON.stringify(existingV2),
  });
  const { progress } = loadProgressV2();
  // v2 中只有 star-lv-01 完成，v1 中的 extra 不应合并进来
  assert(Object.keys(progress.games[STAR_SINGLE_MODE_ID].completed).length === 1);
  assert(progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] === 3);
});

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
const elapsed = ((performance.now() - suiteStart) / 1000).toFixed(2);
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`${'='.repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed  (${elapsed}s)`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) process.exit(1);
