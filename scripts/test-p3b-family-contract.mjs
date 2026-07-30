/**
 * P3B family registry + runtime selector 合同测试。
 * 确认 family 权威注册结构、mode 列表派生、runtime selector 矩阵一致。
 * 运行: node scripts/test-p3b-family-contract.mjs
 */

const MODULE_PATH = '../src/config/gameModes.js';

let pass = 0;
let fail = 0;

function assert(description, condition) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL: ${description}`);
  }
}

// Dynamic import
const mod = await import(MODULE_PATH);

console.log('\n=== Family Registry ===');

// 1. GAME_FAMILIES 从 GAME_MODES 派生（不独立维护）
const familyIdsFromConfig = new Set(
  Object.values(mod.GAME_MODES).map((c) => c.familyId).filter(Boolean),
);
const familyIdsFromRegistry = new Set(Object.keys(mod.GAME_FAMILIES));
assert(
  'GAME_FAMILIES keys match GAME_MODES familyId fields',
  [...familyIdsFromConfig].every((id) => familyIdsFromRegistry.has(id))
    && [...familyIdsFromRegistry].every((id) => familyIdsFromConfig.has(id)),
);

// 2. getFamilyId 从 GAME_MODES.familyId 读取
for (const modeId of Object.keys(mod.PLAY_MODES)) {
  const expected = mod.GAME_MODES[modeId]?.familyId || null;
  const actual = mod.getFamilyId(modeId);
  assert(`getFamilyId(${modeId}) === ${expected}`, actual === expected);
}

// 3. 未知 mode 安全返回 null
assert('getFamilyId("nonexistent") === null', mod.getFamilyId('nonexistent') === null);

// 4. getFamilyModeIds 与 GAME_FAMILIES 一致
for (const familyId of Object.keys(mod.GAME_FAMILIES)) {
  const fromRegistry = mod.GAME_FAMILIES[familyId].modes;
  const fromHelper = mod.getFamilyModeIds(familyId);
  assert(
    `getFamilyModeIds(${familyId}) matches GAME_FAMILIES.${familyId}.modes`,
    fromRegistry.length === fromHelper.length
      && fromRegistry.every((id) => fromHelper.includes(id)),
  );
}
assert(
  'getFamilyModeIds("nonexistent") returns []',
  mod.getFamilyModeIds('nonexistent').length === 0,
);

console.log('\n=== Mode Lists ===');

// 5. ONE_LINE_MODE_LIST 与 family 注册一致
const oneLineModeIds = mod.ONE_LINE_MODE_LIST.map((c) => c.id);
assert(
  'ONE_LINE_MODE_LIST all have familyId === "oneLine"',
  oneLineModeIds.every((id) => mod.getFamilyId(id) === 'oneLine'),
);
assert('ONE_LINE_MODE_LIST has 4 entries', oneLineModeIds.length === 4);
assert('No duplicate modes in ONE_LINE_MODE_LIST', new Set(oneLineModeIds).size === oneLineModeIds.length);

// 6. STAR_LINE_MODE_LIST 与 family 注册一致
const starLineModeIds = mod.STAR_LINE_MODE_LIST.map((c) => c.id);
assert(
  'STAR_LINE_MODE_LIST all have familyId === "starLine"',
  starLineModeIds.every((id) => mod.getFamilyId(id) === 'starLine'),
);
assert('STAR_LINE_MODE_LIST has 2 entries', starLineModeIds.length === 2);
assert('No duplicate modes in STAR_LINE_MODE_LIST', new Set(starLineModeIds).size === starLineModeIds.length);

// 7. GAME_MODE_LIST = ONE_LINE + STAR_LINE
const allModeIds = mod.GAME_MODE_LIST.map((c) => c.id);
const expectedAll = [...oneLineModeIds, ...starLineModeIds];
assert(
  'GAME_MODE_LIST === ONE_LINE_MODE_LIST + STAR_LINE_MODE_LIST',
  allModeIds.length === expectedAll.length
    && allModeIds.every((id, i) => id === expectedAll[i]),
);

// 8. 无 mode 同时属于两个 family
for (const modeId of Object.keys(mod.PLAY_MODES)) {
  const fid = mod.getFamilyId(modeId);
  if (!fid) continue; // legacy starLine has familyId 'starLine'
  const inOneLine = mod.ONE_LINE_MODE_LIST.some((c) => c.id === modeId);
  const inStarLine = mod.STAR_LINE_MODE_LIST.some((c) => c.id === modeId);
  assert(
    `Mode ${modeId} not in both lists`,
    !(inOneLine && inStarLine),
  );
}

console.log('\n=== Runtime Selector ===');

// 9. getModeRuntime 矩阵
const runtimeMatrix = [
  ['classic', { familyId: 'oneLine', boardType: 'grid', sessionType: 'oneLine', caps: { hidden: false, portal: false, starLine: false } }],
  ['hidden', { familyId: 'oneLine', boardType: 'grid', sessionType: 'oneLine', caps: { hidden: true, portal: false, starLine: false } }],
  ['diagonal', { familyId: 'oneLine', boardType: 'grid', sessionType: 'oneLine', caps: { hidden: false, portal: false, starLine: false } }],
  ['portalClassic', { familyId: 'oneLine', boardType: 'grid', sessionType: 'oneLine', caps: { hidden: false, portal: true, starLine: false } }],
  ['starSingle', { familyId: 'starLine', boardType: 'starLine', sessionType: 'starLine', caps: { hidden: false, portal: false, starLine: true } }],
  ['starDouble', { familyId: 'starLine', boardType: 'starLine', sessionType: 'starLine', caps: { hidden: false, portal: false, starLine: true } }],
];

for (const [modeId, expected] of runtimeMatrix) {
  const rt = mod.getModeRuntime(modeId);
  assert(`getModeRuntime(${modeId}) is not null`, rt !== null);
  assert(`getModeRuntime(${modeId}).familyId === "${expected.familyId}"`, rt.familyId === expected.familyId);
  assert(`getModeRuntime(${modeId}).boardType === "${expected.boardType}"`, rt.boardType === expected.boardType);
  assert(`getModeRuntime(${modeId}).sessionType === "${expected.sessionType}"`, rt.sessionType === expected.sessionType);
  for (const cap of Object.keys(expected.caps)) {
    assert(
      `getModeRuntime(${modeId}).capabilities.${cap} === ${expected.caps[cap]}`,
      rt.capabilities[cap] === expected.caps[cap],
    );
  }
}

// 10. 未知 mode fallback
assert('getModeRuntime("nonexistent") === null', mod.getModeRuntime('nonexistent') === null);

console.log('\n=== replayVisualFamily ===');
// 11. replayVisualFamily 从 getFamilyId 推导
const rvf = await import('../src/config/replayVisualFamily.js');
for (const modeId of Object.keys(mod.PLAY_MODES)) {
  const expected = mod.getFamilyId(modeId);
  if (!expected) continue;
  const actual = rvf.getReplayVisualFamily(modeId);
  assert(`getReplayVisualFamily(${modeId}) === "${expected}"`, actual === expected);
}
assert('getReplayVisualFamily("nonexistent") === null', rvf.getReplayVisualFamily('nonexistent') === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
