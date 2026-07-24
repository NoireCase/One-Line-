/** Star Line Progress V2 Package A pure-module tests. */

import {
  LEGACY_STAR_LINE_LEVEL_COUNT,
  STAR_LINE_LEGACY_MODE_ID,
  STAR_LINE_PROGRESS_V2_KEY,
  STAR_SINGLE_MODE_ID,
  STAR_DOUBLE_MODE_ID,
  STAR_SINGLE_LEVELS,
  STAR_DOUBLE_LEVELS,
  getValidatedStarLineQuota,
  getStarLineGameId,
  getStarLineLevelList,
  getStarLineDisplayNumber,
  findStarLineLevelById,
  upgradeCatalogBoundary,
  createDefaultProgressV2,
  migrateV1ToV2,
  normalizeProgressV2,
  repairProgressV2,
  loadProgressV2,
  getGameProgress,
  isLevelCompleted,
  isLevelUnlocked,
  completeLevel,
  unlockThroughLevel,
  __setLevelListOverride,
  __clearLevelListOverride,
} from '../src/game/starLine/starLineProgressV2.js';
import { safeSetStorageItem } from '../src/utils/safeStorage.js';
import {
  LEGACY_STAR_LINE_SAVED_GAME_KEY,
  STAR_LINE_SESSION_MIGRATION_MARKER_KEY,
  migrateLegacyStarLineSavedGame,
} from '../src/hooks/useGameSession.js';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

let passed = 0;
let failed = 0;
let storage = {};
let getError = null;
let setError = null;
let setCalls = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}: ${error.message}`);
    failed++;
  }
}

function assert(value, message = 'assertion failed') {
  if (!value) throw new Error(message);
}

function equal(actual, expected, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function deepEqual(actual, expected, message = 'objects differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function throws(fn, text) {
  try {
    fn();
  } catch (error) {
    assert(error.message.includes(text), `expected error including ${text}, got ${error.message}`);
    return;
  }
  throw new Error(`expected error including ${text}`);
}

function setStorage(data = {}, options = {}) {
  storage = { ...data };
  getError = options.getError || null;
  setError = options.setError || null;
  setCalls = 0;
}

globalThis.localStorage = {
  getItem(key) {
    if (getError) throw getError;
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
  },
  setItem(key, value) {
    setCalls++;
    if (setError) throw setError;
    storage[key] = value;
  },
  removeItem(key) {
    delete storage[key];
  },
};

function v1(unlockedThrough = 0, completed = {}) {
  return { unlockedThrough, completed };
}

function completionIds(progress, modeId) {
  return Object.keys(progress.games[modeId].completed).sort();
}

console.log('\n═══ 1. 关卡身份与分类 ═══');

test('单星 60 关、双星 41 关，覆盖当前 101 个可玩关', () => {
  equal(STAR_SINGLE_LEVELS.length, 60);
  equal(STAR_DOUBLE_LEVELS.length, 41);
  equal(STAR_SINGLE_LEVELS.length + STAR_DOUBLE_LEVELS.length, 101);
});

test('列表容器冻结但关卡对象仍来自唯一数据源', () => {
  assert(Object.isFrozen(STAR_SINGLE_LEVELS));
  assert(Object.isFrozen(STAR_DOUBLE_LEVELS));
  assert(STAR_SINGLE_LEVELS[0].id === 'star-lv-01');
  assert(STAR_DOUBLE_LEVELS[0].id === 'star-double-tutorial-01');
});

test('quota=1/2 的关卡归属正确', () => {
  equal(getStarLineGameId(STAR_SINGLE_LEVELS[19]), STAR_SINGLE_MODE_ID);
  equal(getStarLineGameId(STAR_DOUBLE_LEVELS[0]), STAR_DOUBLE_MODE_ID);
  equal(getStarLineDisplayNumber(STAR_DOUBLE_MODE_ID, 'star-lv-21'), 21);
  equal(getStarLineDisplayNumber(STAR_DOUBLE_MODE_ID, 'star-lv-30'), 54);
  equal(findStarLineLevelById(STAR_SINGLE_MODE_ID, 'star-lv-01').id, 'star-lv-01');
});

test('未知 mode 被拒绝，legacy mode 必须显式写出', () => {
  equal(getStarLineLevelList(STAR_LINE_LEGACY_MODE_ID).length, 101);
  throws(() => getStarLineLevelList('unknown'), '未知 game mode');
});

for (const [name, level, expected] of [
  ['缺失字段默认单星', { id: 'test' }, 1],
  ['三项均为双星', { id: 'test', starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2 }, 2],
]) {
  test(`quota 校验：${name}`, () => equal(getValidatedStarLineQuota(level), expected));
}

for (const [name, level] of [
  ['row=1 col=2 region=1', { id: 'bad', starsPerRow: 1, starsPerCol: 2, starsPerRegion: 1 }],
  ['row=2 col=2 region=1', { id: 'bad', starsPerRow: 2, starsPerCol: 2, starsPerRegion: 1 }],
  ['quota=3', { id: 'bad', starsPerRow: 3, starsPerCol: 3, starsPerRegion: 3 }],
  ['无法解析 quota', { id: 'bad', starsPerRow: '1', starsPerCol: '1', starsPerRegion: '1' }],
]) {
  test(`quota 校验拒绝：${name}`, () => throws(() => getValidatedStarLineQuota(level), 'quota'));
}

console.log('\n═══ 2. 精确旧索引与完成值迁移 ═══');

for (const key of ['0', '1', '10', '29']) {
  test(`精确旧索引 ${key} 被迁移`, () => {
    const progress = migrateV1ToV2(v1(0, { [key]: 3 }));
    const index = Number(key);
    const modeId = index < 20 ? STAR_SINGLE_MODE_ID : STAR_DOUBLE_MODE_ID;
    assert(Object.keys(progress.games[modeId].completed).length === 1);
  });
}

for (const key of ['00', '01', '1.0', ' 1', '1 ', '+1', '-0', '1e1', '0x10', '', '30', '-1']) {
  test(`非规范旧索引 ${JSON.stringify(key)} 被拒绝`, () => {
    const progress = migrateV1ToV2(v1(0, { [key]: 3 }));
    equal(completionIds(progress, STAR_SINGLE_MODE_ID).length, 0);
    equal(completionIds(progress, STAR_DOUBLE_MODE_ID).length, 0);
  });
}

for (const value of [1, 2, 3, 4, 99]) {
  test(`有限正整数完成值 ${value} 被保留`, () => {
    const progress = migrateV1ToV2(v1(0, { '0': value }));
    equal(progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'], value);
  });
}

for (const value of [0, -1, 1.5, NaN, Infinity, '3', null, {}, []]) {
  test(`非法完成值 ${String(value)} 被拒绝`, () => {
    const progress = migrateV1ToV2(v1(0, { '0': value }));
    equal(completionIds(progress, STAR_SINGLE_MODE_ID).length, 0);
  });
}

test('非连续完成记录保持非连续', () => {
  const progress = migrateV1ToV2(v1(10, { '0': 1, '3': 2, '22': 3 }));
  deepEqual(completionIds(progress, STAR_SINGLE_MODE_ID), ['star-lv-01', 'star-lv-04']);
  deepEqual(completionIds(progress, STAR_DOUBLE_MODE_ID), ['star-lv-23']);
});

console.log('\n═══ 3. unlockedThrough 边界 ═══');

const unlockedCases = [
  [0, 'star-lv-01', 'star-double-tutorial-01'],
  [19, 'star-lv-20', 'star-double-tutorial-01'],
  [20, 'star-lv-20', 'star-lv-21'],
  [29, 'star-lv-20', 'star-lv-30'],
  [30, 'star-lv-20', 'star-lv-30'],
  [999, 'star-lv-20', 'star-lv-30'],
  [-1, 'star-lv-01', 'star-double-tutorial-01'],
  [1.5, 'star-lv-01', 'star-double-tutorial-01'],
  [NaN, 'star-lv-01', 'star-double-tutorial-01'],
  [Infinity, 'star-lv-01', 'star-double-tutorial-01'],
  ['20', 'star-lv-01', 'star-double-tutorial-01'],
  [null, 'star-lv-01', 'star-double-tutorial-01'],
  [undefined, 'star-lv-01', 'star-double-tutorial-01'],
];

for (const [value, singleId, doubleId] of unlockedCases) {
  test(`unlockedThrough=${String(value)} 安全映射`, () => {
    const progress = migrateV1ToV2(v1(value, { '0': 3 }));
    equal(progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId, singleId);
    equal(progress.games[STAR_DOUBLE_MODE_ID].unlockedThroughId, doubleId);
    equal(progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'], 3);
  });
}

console.log('\n═══ 4. 完整 legacy 30 关迁移 ═══');

test('旧 0–29 完整迁移为单星 20、双星 10', () => {
  const completed = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [String(index), 3]));
  const progress = migrateV1ToV2(v1(29, completed));
  equal(completionIds(progress, STAR_SINGLE_MODE_ID).length, 20);
  equal(completionIds(progress, STAR_DOUBLE_MODE_ID).length, 10);
  equal(progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId, 'star-lv-20');
  equal(progress.games[STAR_DOUBLE_MODE_ID].unlockedThroughId, 'star-lv-30');
  assert(!progress.games[STAR_DOUBLE_MODE_ID].completed['star-lv-31']);
});

test('迁移不修改旧输入对象', () => {
  const old = v1(20, { '0': 3, '20': 2 });
  const original = JSON.stringify(old);
  migrateV1ToV2(old);
  equal(JSON.stringify(old), original);
});

console.log('\n═══ 5. v2 统一语义规范化 ═══');

test('未知顶层和未知 game 字段被丢弃', () => {
  const normalized = normalizeProgressV2({
    version: 1,
    extra: true,
    games: { [STAR_SINGLE_MODE_ID]: {}, [STAR_DOUBLE_MODE_ID]: {}, future: {} },
  });
  deepEqual(Object.keys(normalized), ['version', 'games']);
  deepEqual(Object.keys(normalized.games).sort(), [STAR_DOUBLE_MODE_ID, STAR_SINGLE_MODE_ID]);
});

test('双玩法错误归属、未知 ID 和非法值被过滤', () => {
  const normalized = normalizeProgressV2({
    version: 1,
    games: {
      [STAR_SINGLE_MODE_ID]: {
        completed: { 'star-lv-01': 2, 'star-lv-21': 3, unknown: 3, 'star-lv-02': 1.5 },
        unlockedThroughId: 'star-lv-99',
      },
      [STAR_DOUBLE_MODE_ID]: {
        completed: { 'star-lv-21': 1, 'star-lv-01': 3, 'star-lv-22': '3', 'star-lv-23': Infinity },
        unlockedThroughId: 'star-lv-21',
      },
    },
  });
  deepEqual(normalized.games[STAR_SINGLE_MODE_ID].completed, { 'star-lv-01': 2 });
  equal(normalized.games[STAR_SINGLE_MODE_ID].unlockedThroughId, 'star-lv-01');
  deepEqual(normalized.games[STAR_DOUBLE_MODE_ID].completed, { 'star-lv-21': 1 });
});

test('单星合法时，双星损坏只修复双星', () => {
  const normalized = normalizeProgressV2({
    version: 1,
    games: {
      [STAR_SINGLE_MODE_ID]: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-05' },
      [STAR_DOUBLE_MODE_ID]: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'bad' },
    },
  });
  equal(normalized.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'], 3);
  equal(normalized.games[STAR_SINGLE_MODE_ID].unlockedThroughId, 'star-lv-05');
  deepEqual(normalized.games[STAR_DOUBLE_MODE_ID].completed, {});
  equal(normalized.games[STAR_DOUBLE_MODE_ID].unlockedThroughId, 'star-double-tutorial-01');
});

test('双星合法时，单星损坏只修复单星', () => {
  const normalized = repairProgressV2({
    version: 1,
    games: {
      [STAR_SINGLE_MODE_ID]: { completed: [], unlockedThroughId: 'bad' },
      [STAR_DOUBLE_MODE_ID]: { completed: { 'star-lv-21': 3 }, unlockedThroughId: 'star-lv-24' },
    },
  });
  deepEqual(normalized.games[STAR_SINGLE_MODE_ID].completed, {});
  equal(normalized.games[STAR_DOUBLE_MODE_ID].completed['star-lv-21'], 3);
  equal(normalized.games[STAR_DOUBLE_MODE_ID].unlockedThroughId, 'star-lv-24');
});

console.log('\n═══ 6. 只读 storage adapter 生命周期 ═══');

test('v2 不存在时从旧 key 迁移，且不写任何 storage', () => {
  const oldRaw = JSON.stringify(v1(20, { '0': 3, '20': 2 }));
  setStorage({ cg_star_line_progress: oldRaw });
  const result = loadProgressV2();
  equal(result.source, 'legacy');
  assert(result.needsPersist);
  equal(result.progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'], 3);
  equal(result.progress.games[STAR_DOUBLE_MODE_ID].completed['star-lv-21'], 2);
  equal(storage.cg_star_line_progress, oldRaw);
  equal(setCalls, 0);
});

test('v1/v2 都不存在时返回 default 和 needsPersist', () => {
  setStorage();
  const result = loadProgressV2();
  equal(result.source, 'default');
  assert(result.needsPersist);
  equal(setCalls, 0);
});

test('完整合法 v2 优先且不合并 v1', () => {
  const v2 = createDefaultProgressV2();
  v2.games[STAR_SINGLE_MODE_ID].completed['star-lv-01'] = 3;
  setStorage({
    cg_star_line_progress: JSON.stringify(v1(10, { '5': 3 })),
    [STAR_LINE_PROGRESS_V2_KEY]: JSON.stringify(v2),
  });
  const result = loadProgressV2();
  equal(result.source, 'v2');
  assert(!result.needsPersist);
  assert(!result.progress.games[STAR_SINGLE_MODE_ID].completed['star-lv-06']);
  equal(setCalls, 0);
});

test('可解析但语义损坏的 v2 被修复并标记 needsPersist', () => {
  setStorage({
    [STAR_LINE_PROGRESS_V2_KEY]: JSON.stringify({
      version: 1,
      games: {
        [STAR_SINGLE_MODE_ID]: { completed: { 'star-lv-21': 3 }, unlockedThroughId: 'bad' },
        [STAR_DOUBLE_MODE_ID]: { completed: {}, unlockedThroughId: 'star-lv-21' },
      },
    }),
  });
  const result = loadProgressV2();
  equal(result.source, 'v2');
  assert(result.needsPersist);
  equal(result.progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId, 'star-lv-01');
  equal(setCalls, 0);
});

for (const raw of ['not json', 'null', '[]', '"text"', '{"unexpected":true}']) {
  test(`完全损坏 v2 ${raw} 保留原值且不合并 v1`, () => {
    const oldRaw = JSON.stringify(v1(29, { '29': 3 }));
    setStorage({ cg_star_line_progress: oldRaw, [STAR_LINE_PROGRESS_V2_KEY]: raw });
    const result = loadProgressV2();
    equal(result.source, 'corrupt-v2');
    assert(!result.needsPersist);
    equal(storage[STAR_LINE_PROGRESS_V2_KEY], raw);
    equal(storage.cg_star_line_progress, oldRaw);
    equal(completionIds(result.progress, STAR_DOUBLE_MODE_ID).length, 0);
    equal(setCalls, 0);
  });
}

test('localStorage getItem 抛错时安全返回 default', () => {
  setStorage({}, { getError: new Error('storage disabled') });
  const result = loadProgressV2();
  equal(result.source, 'default');
  assert(!result.needsPersist);
});

test('localStorage setItem 抛错时安全写入返回失败且不修改已有数据', () => {
  setStorage({ [STAR_LINE_PROGRESS_V2_KEY]: 'preserve-me' }, { setError: new Error('quota exceeded') });
  equal(safeSetStorageItem(STAR_LINE_PROGRESS_V2_KEY, 'new-value'), false);
  equal(storage[STAR_LINE_PROGRESS_V2_KEY], 'preserve-me');
  equal(setCalls, 1);
});

console.log('\n═══ 7. 中断存档迁移隔离 ═══');

test('可识别的旧双星共享存档只复制到双星 key，旧 key 保持原样', () => {
  const oldRaw = JSON.stringify({ playMode: 'starLine', diff: 'easy', levelIdx: 20, gridData: [{}], path: [0], hp: 5 });
  setStorage({ [LEGACY_STAR_LINE_SAVED_GAME_KEY]: oldRaw });
  assert(migrateLegacyStarLineSavedGame());
  equal(storage[LEGACY_STAR_LINE_SAVED_GAME_KEY], oldRaw);
  const migrated = JSON.parse(storage.cg_star_line_double_saved_game);
  equal(migrated.playMode, STAR_DOUBLE_MODE_ID);
  equal(migrated.levelIdx, 20);
  equal(migrated.levelId, 'star-lv-21');
  assert(!Object.prototype.hasOwnProperty.call(storage, 'cg_star_line_single_saved_game'));
  equal(storage[STAR_LINE_SESSION_MIGRATION_MARKER_KEY], '1');
});

test('levelId 可单独确认旧共享存档归属', () => {
  const oldRaw = JSON.stringify({ mode: 'starLine', levelId: 'star-lv-07', diff: 'easy', gridData: [{}], path: [0], hp: 5 });
  setStorage({ [LEGACY_STAR_LINE_SAVED_GAME_KEY]: oldRaw });
  assert(migrateLegacyStarLineSavedGame());
  equal(storage[LEGACY_STAR_LINE_SAVED_GAME_KEY], oldRaw);
  const migrated = JSON.parse(storage.cg_star_line_single_saved_game);
  equal(migrated.playMode, STAR_SINGLE_MODE_ID);
  equal(migrated.levelIdx, 6);
});

test('已有正式中断存档时，迁移不会覆盖它', () => {
  const oldRaw = JSON.stringify({ playMode: 'starLine', diff: 'easy', levelIdx: 0, gridData: [{}], path: [0], hp: 5 });
  const existingRaw = JSON.stringify({ playMode: 'starSingle', diff: 'easy', levelIdx: 3, gridData: [{}], path: [0], hp: 5 });
  setStorage({
    [LEGACY_STAR_LINE_SAVED_GAME_KEY]: oldRaw,
    cg_star_line_single_saved_game: existingRaw,
  });
  assert(migrateLegacyStarLineSavedGame());
  equal(storage[LEGACY_STAR_LINE_SAVED_GAME_KEY], oldRaw);
  equal(storage.cg_star_line_single_saved_game, existingRaw);
  equal(storage[STAR_LINE_SESSION_MIGRATION_MARKER_KEY], '1');
});

test('无法确认归属的旧共享存档不迁移、不删除、不标记', () => {
  const oldRaw = JSON.stringify({ playMode: 'starLine', levelIdx: 3.5 });
  setStorage({ [LEGACY_STAR_LINE_SAVED_GAME_KEY]: oldRaw });
  assert(!migrateLegacyStarLineSavedGame());
  equal(storage[LEGACY_STAR_LINE_SAVED_GAME_KEY], oldRaw);
  assert(!Object.prototype.hasOwnProperty.call(storage, 'cg_star_line_single_saved_game'));
  assert(!Object.prototype.hasOwnProperty.call(storage, 'cg_star_line_double_saved_game'));
  assert(!Object.prototype.hasOwnProperty.call(storage, STAR_LINE_SESSION_MIGRATION_MARKER_KEY));
});

console.log('\n═══ 8. 纯进度 API ═══');

test('legacy mode、未知 mode 与错误归属 ID 均被拒绝', () => {
  const progress = createDefaultProgressV2();
  throws(() => completeLevel(progress, STAR_LINE_LEGACY_MODE_ID, 'star-lv-01'), '未知 game mode');
  throws(() => completeLevel(progress, 'unknown', 'star-lv-01'), '未知 game mode');
  throws(() => completeLevel(progress, STAR_SINGLE_MODE_ID, 'star-lv-21'), '不属于');
});

test('completeLevel 幂等、只完成，不自动解锁', () => {
  const start = createDefaultProgressV2();
  const once = completeLevel(start, STAR_SINGLE_MODE_ID, 'star-lv-02');
  const twice = completeLevel(once, STAR_SINGLE_MODE_ID, 'star-lv-02');
  deepEqual(once, twice);
  assert(isLevelCompleted(once, STAR_SINGLE_MODE_ID, 'star-lv-02'));
  assert(!isLevelUnlocked(once, STAR_SINGLE_MODE_ID, 'star-lv-02'));
});

test('单星 Lv.40→41、Lv.50→51、Lv.59→60 与终关边界保持隔离', () => {
  const single = getStarLineLevelList(STAR_SINGLE_MODE_ID);
  const doubleBefore = JSON.stringify(createDefaultProgressV2().games[STAR_DOUBLE_MODE_ID]);
  equal(single.length, 60);
  equal(single[39].id, 'star-lv-50'); // 玩家 Lv.40
  equal(single[40].id, 'star-lv-51'); // 玩家 Lv.41
  equal(single[49].id, 'star-lv-60'); // 玩家 Lv.50
  equal(single[50].id, 'star-lv-61'); // 玩家 Lv.51
  equal(single[58].id, 'star-lv-69'); // 玩家 Lv.59
  equal(single[59].id, 'star-lv-70'); // 玩家 Lv.60

  let progress = createDefaultProgressV2();
  for (let index = 0; index <= 39; index++) {
    progress = completeLevel(progress, STAR_SINGLE_MODE_ID, single[index].id);
  }
  progress = unlockThroughLevel(progress, STAR_SINGLE_MODE_ID, 'star-lv-51');
  assert(isLevelCompleted(progress, STAR_SINGLE_MODE_ID, 'star-lv-50'));
  assert(isLevelUnlocked(progress, STAR_SINGLE_MODE_ID, 'star-lv-51'));

  for (let index = 40; index <= 49; index++) {
    progress = completeLevel(progress, STAR_SINGLE_MODE_ID, single[index].id);
  }
  progress = unlockThroughLevel(progress, STAR_SINGLE_MODE_ID, 'star-lv-61');
  assert(isLevelCompleted(progress, STAR_SINGLE_MODE_ID, 'star-lv-60'));
  assert(isLevelUnlocked(progress, STAR_SINGLE_MODE_ID, 'star-lv-61'));

  for (let index = 50; index <= 58; index++) {
    progress = completeLevel(progress, STAR_SINGLE_MODE_ID, single[index].id);
  }
  progress = unlockThroughLevel(progress, STAR_SINGLE_MODE_ID, 'star-lv-70');
  progress = completeLevel(progress, STAR_SINGLE_MODE_ID, 'star-lv-70');
  equal(getGameProgress(progress, STAR_SINGLE_MODE_ID).unlockedThroughId, 'star-lv-70');
  assert(isLevelCompleted(progress, STAR_SINGLE_MODE_ID, 'star-lv-70'));
  equal(findStarLineLevelById(STAR_SINGLE_MODE_ID, 'star-lv-71'), null);
  equal(getStarLineDisplayNumber(STAR_SINGLE_MODE_ID, 'star-lv-71'), null);
  equal(JSON.stringify(getGameProgress(progress, STAR_DOUBLE_MODE_ID)), doubleBefore,
    'single progression must not change double progress');
});

test('unlockThroughLevel 只前进，最后一关安全', () => {
  const advanced = unlockThroughLevel(createDefaultProgressV2(), STAR_DOUBLE_MODE_ID, 'star-lv-30');
  const unchanged = unlockThroughLevel(advanced, STAR_DOUBLE_MODE_ID, 'star-lv-21');
  equal(unchanged.games[STAR_DOUBLE_MODE_ID].unlockedThroughId, 'star-lv-30');
  assert(isLevelUnlocked(unchanged, STAR_DOUBLE_MODE_ID, 'star-lv-30'));
});

test('API 规范化输入、丢弃未知字段且不修改输入', () => {
  const input = {
    version: 1,
    extra: true,
    games: {
      [STAR_SINGLE_MODE_ID]: { completed: {}, unlockedThroughId: 'star-lv-01', extra: true },
      [STAR_DOUBLE_MODE_ID]: { completed: {}, unlockedThroughId: 'star-lv-21' },
    },
  };
  const original = JSON.stringify(input);
  const output = completeLevel(input, STAR_SINGLE_MODE_ID, 'star-lv-01');
  equal(JSON.stringify(input), original);
  assert(!Object.prototype.hasOwnProperty.call(output, 'extra'));
  assert(!Object.prototype.hasOwnProperty.call(output.games[STAR_SINGLE_MODE_ID], 'extra'));
  const game = getGameProgress(output, STAR_SINGLE_MODE_ID);
  game.completed['star-lv-02'] = 3;
  assert(!isLevelCompleted(output, STAR_SINGLE_MODE_ID, 'star-lv-02'));
});

// ═══ 9. 目录边界升级 ═══
console.log('\n═══ 9. 目录边界升级 ═══');

test('当前目录有新关但旧关未完成 → 不升级', () => {
  const result = upgradeCatalogBoundary(
    createDefaultProgressV2(), STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31'
  );
  assert(!result.upgraded);
  assert(result.reason === 'not-all-old-completed'); // star-lv-31 exists but no completions
});

test('旧 20 关全完成 + 目录含 star-lv-31 → 升级解锁新首关', () => {
  const completedAll = createDefaultProgressV2();
  let p = completedAll;
  for (const l of STAR_SINGLE_LEVELS.slice(0, 20)) {
    p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  }
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');

  // star-lv-31 IS in the real catalog now → should upgrade
  const result = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  assert(result.upgraded);
  assert(result.reason === 'catalog-expanded');
  const game = result.progress.games[STAR_SINGLE_MODE_ID];
  assert(game.unlockedThroughId === 'star-lv-31');
});

test('模拟扩展目录：双星旧10关全完成但无新首关 → no-op', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_DOUBLE_LEVELS.slice(0, 9)) {
    p = completeLevel(p, STAR_DOUBLE_MODE_ID, l.id);
  }
  p = unlockThroughLevel(p, STAR_DOUBLE_MODE_ID, 'star-lv-30');
  const result = upgradeCatalogBoundary(p, STAR_DOUBLE_MODE_ID, 'star-lv-30', 'star-lv-71');
  assert(!result.upgraded);
  assert(result.reason === 'no-new-first-level');
});

test('旧关未全完成 → 不升级', () => {
  let p = createDefaultProgressV2();
  p = completeLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-01');
  // star-lv-31 exists but not all old levels completed
  const result = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  assert(!result.upgraded);
  assert(result.reason === 'not-all-old-completed');
});

test('当前游标已超过新首关 → 不升级', () => {
  let p = createDefaultProgressV2();
  // Complete all 20 and unlock to end
  for (const l of STAR_SINGLE_LEVELS) {
    p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  }
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  // 使用 star-lv-19（存在且游标已超过）作为 newFirst
  const result = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-19');
  assert(!result.upgraded);
  assert(result.reason === 'already-unlocked');
});

test('upgradeCatalogBoundary 不影响另一玩法', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_SINGLE_LEVELS) {
    p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  }
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  const before = JSON.stringify(getGameProgress(p, STAR_DOUBLE_MODE_ID));
  upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  const after = JSON.stringify(getGameProgress(p, STAR_DOUBLE_MODE_ID));
  equal(before, after);
});

test('upgradeCatalogBoundary 幂等', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_SINGLE_LEVELS.slice(0, 19)) {
    p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  }
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  const r1 = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  const r2 = upgradeCatalogBoundary(r1.progress, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  assert(!r1.upgraded);
  assert(!r2.upgraded);
  deepEqual(r1.progress, r2.progress);
});

// ═══ 11. 真实目录扩容 fixture ═══
console.log('\n═══ 11. 真实目录扩容 fixture ═══');

// 构建包含 star-lv-71 的模拟扩展目录（仅测试用，不修改正式数据）
// star-lv-31 已在正式目录中，不再重复添加
const MOCK_DOUBLE_EXPANDED = Object.freeze([
  ...STAR_DOUBLE_LEVELS,
  { id: 'star-lv-71', gameId: 'starDouble', N: 8, starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2 },
]);

test('单星: 旧20关全完成 + 真实目录含star-lv-31 → 仅解锁star-lv-31', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_SINGLE_LEVELS.slice(0, 20)) p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  const result = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  assert(result.upgraded, '应该升级: ' + result.reason);
  assert(result.reason === 'catalog-expanded');
  assert(getGameProgress(result.progress, STAR_SINGLE_MODE_ID).unlockedThroughId === 'star-lv-31');
  assert(!isLevelCompleted(result.progress, STAR_SINGLE_MODE_ID, 'star-lv-31'));
});

test('双星: 旧10关全完成 + 目录含star-lv-71 → 仅解锁star-lv-71', () => {
  __setLevelListOverride(MOCK_DOUBLE_EXPANDED);
  try {
    let p = createDefaultProgressV2();
    for (const l of STAR_DOUBLE_LEVELS) p = completeLevel(p, STAR_DOUBLE_MODE_ID, l.id);
    p = unlockThroughLevel(p, STAR_DOUBLE_MODE_ID, 'star-lv-30');
    const result = upgradeCatalogBoundary(p, STAR_DOUBLE_MODE_ID, 'star-lv-30', 'star-lv-71');
    assert(result.upgraded, '应该升级: ' + result.reason);
    assert(result.reason === 'catalog-expanded');
    assert(getGameProgress(result.progress, STAR_DOUBLE_MODE_ID).unlockedThroughId === 'star-lv-71');
    assert(!isLevelCompleted(result.progress, STAR_DOUBLE_MODE_ID, 'star-lv-71'));
  } finally { __clearLevelListOverride(); }
});

test('单星扩容后 completed 仍为旧20关', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_SINGLE_LEVELS.slice(0, 20)) p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  const before = Object.keys(getGameProgress(p, STAR_SINGLE_MODE_ID).completed).sort();
  const result = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  const after = Object.keys(getGameProgress(result.progress, STAR_SINGLE_MODE_ID).completed).sort();
  deepEqual(before, after);
});

test('扩容幂等: 重复执行不改变结果', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_SINGLE_LEVELS.slice(0, 20)) p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  const r1 = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  const r2 = upgradeCatalogBoundary(r1.progress, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  assert(r1.upgraded);
  assert(!r2.upgraded);
  assert(r2.reason === 'already-unlocked');
});

test('当前真实目录: star-lv-31 存在 → 旧满进度可升级', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_SINGLE_LEVELS.slice(0, 20)) p = completeLevel(p, STAR_SINGLE_MODE_ID, l.id);
  p = unlockThroughLevel(p, STAR_SINGLE_MODE_ID, 'star-lv-20');
  const result = upgradeCatalogBoundary(p, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31');
  assert(result.upgraded, '旧满进度玩家应能解锁新关');
  assert(result.reason === 'catalog-expanded');
});

test('当前真实目录: star-lv-71 不存在 → no-op', () => {
  let p = createDefaultProgressV2();
  for (const l of STAR_DOUBLE_LEVELS) p = completeLevel(p, STAR_DOUBLE_MODE_ID, l.id);
  p = unlockThroughLevel(p, STAR_DOUBLE_MODE_ID, 'star-lv-30');
  const result = upgradeCatalogBoundary(p, STAR_DOUBLE_MODE_ID, 'star-lv-30', 'star-lv-71');
  assert(!result.upgraded);
  assert(result.reason === 'no-new-first-level');
});

// ═══ 10. 旧30关不可变基线 ═══
console.log('\n═══ 10. 旧30关不可变基线 ═══');

test('旧30关 ID 顺序与 LEGACY_MIGRATION_IDS 一致', () => {
  const ids = STAR_LINE_LEVELS.slice(0, 30).map(l => l.id);
  const expected = Array.from({ length: 30 }, (_, i) => `star-lv-${String(i + 1).padStart(2, '0')}`);
  deepEqual(ids, expected);
});

test('旧30关全部有 gameId', () => {
  for (const l of STAR_LINE_LEVELS.slice(0, 30)) {
    assert(l.gameId === STAR_SINGLE_MODE_ID || l.gameId === STAR_DOUBLE_MODE_ID,
      `"${l.id}" missing gameId`);
  }
});

test('旧30关全部有非空 techniqueTags', () => {
  for (const l of STAR_LINE_LEVELS.slice(0, 30)) {
    assert(Array.isArray(l.techniqueTags) && l.techniqueTags.length > 0,
      `"${l.id}" missing techniqueTags`);
  }
});

test('单星20关 gameId 与 quota 一致', () => {
  for (const l of STAR_SINGLE_LEVELS.slice(0, 19)) {
    assert(l.gameId === STAR_SINGLE_MODE_ID, `"${l.id}" gameId should be starSingle`);
    const q = getValidatedStarLineQuota(l);
    assert(q === 1, `"${l.id}" quota=${q} but gameId=starSingle`);
  }
});

test('双星10关 gameId 与 quota 一致', () => {
  for (const l of STAR_DOUBLE_LEVELS.slice(0, 9)) {
    assert(l.gameId === STAR_DOUBLE_MODE_ID, `"${l.id}" gameId should be starDouble`);
    const q = getValidatedStarLineQuota(l);
    assert(q === 2, `"${l.id}" quota=${q} but gameId=starDouble`);
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
