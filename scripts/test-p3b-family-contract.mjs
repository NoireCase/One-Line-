/**
 * P3B mode/family/catalog/runtime 结构合同。
 * 运行: node scripts/test-p3b-family-contract.mjs
 */

import { readFile } from 'node:fs/promises';

const mod = await import('../src/config/gameModes.js');
const replay = await import('../src/config/replayVisualFamily.js');
const savedGame = await import('../src/utils/savedGame.js');

let pass = 0;
let fail = 0;

function assert(description, condition) {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL: ${description}`);
  }
}

function ids(configs) {
  return configs.map((config) => config.id);
}

function sameMembers(actual, expected) {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && actual.every((id) => expected.includes(id));
}

const modeEntries = Object.entries(mod.GAME_MODES);
const modeConfigs = modeEntries.map(([, config]) => config);
const catalogConfigs = modeConfigs.filter((config) => config.catalogVisible === true);

console.log('\n=== Registry integrity ===');

assert(
  'Every registry key matches the config id',
  modeEntries.every(([modeId, config]) => config.id === modeId),
);
assert(
  'Every PLAY_MODES value resolves to exactly one GAME_MODES entry',
  Object.values(mod.PLAY_MODES).every((modeId) => mod.GAME_MODES[modeId]?.id === modeId),
);
assert(
  'Registered mode ids are unique',
  new Set(ids(modeConfigs)).size === modeConfigs.length,
);
assert(
  'Every mode explicitly declares catalogVisible',
  modeConfigs.every((config) => typeof config.catalogVisible === 'boolean'),
);
assert(
  'Every mode declares exactly one non-empty familyId string',
  modeConfigs.every((config) => (
    typeof config.familyId === 'string'
    && config.familyId.length > 0
    && !Array.isArray(config.familyId)
  )),
);

const groupedFromModes = modeConfigs.reduce((groups, config) => {
  (groups[config.familyId] ||= []).push(config.id);
  return groups;
}, {});
assert(
  'GAME_FAMILIES ids exactly match familyIds declared by GAME_MODES',
  sameMembers(Object.keys(mod.GAME_FAMILIES), Object.keys(groupedFromModes)),
);
for (const [familyId, expectedModeIds] of Object.entries(groupedFromModes)) {
  const registryModeIds = mod.GAME_FAMILIES[familyId]?.modes || [];
  assert(
    `GAME_FAMILIES.${familyId}.modes exactly matches GAME_MODES grouping`,
    sameMembers(registryModeIds, expectedModeIds),
  );
  assert(
    `getFamilyModeIds(${familyId}) matches the derived registry`,
    sameMembers(mod.getFamilyModeIds(familyId), expectedModeIds),
  );
}
assert('Unknown family returns an empty mode list', mod.getFamilyModeIds('unknown-family').length === 0);
assert('Unknown mode has no family', mod.getFamilyId('unknown-mode') === null);

console.log('\n=== Catalog membership and ordering ===');

assert(
  'Every catalog-visible mode declares a finite familyOrder',
  catalogConfigs.every((config) => Number.isFinite(config.familyOrder)),
);
const allCatalogListIds = ids(mod.GAME_MODE_LIST);
assert(
  'GAME_MODE_LIST contains every and only catalog-visible mode',
  sameMembers(allCatalogListIds, ids(catalogConfigs)),
);
assert(
  'GAME_MODE_LIST contains no duplicates or unknown modes',
  new Set(allCatalogListIds).size === allCatalogListIds.length
    && allCatalogListIds.every((modeId) => mod.GAME_MODES[modeId]),
);

for (const familyId of Object.keys(mod.GAME_FAMILIES)) {
  const expected = mod.buildFamilyModeList(familyId);
  const actual = mod.GAME_MODE_LISTS_BY_FAMILY[familyId] || [];
  assert(
    `${familyId} catalog contains every visible family member in registry order`,
    ids(actual).every((modeId, index) => modeId === expected[index]?.id)
      && actual.length === expected.length,
  );
  assert(
    `${familyId} catalog excludes catalogVisible:false members`,
    actual.every((config) => config.catalogVisible === true),
  );
}
assert(
  'ONE_LINE_MODE_LIST is the derived oneLine catalog',
  ids(mod.ONE_LINE_MODE_LIST).every((modeId, index) => (
    modeId === mod.GAME_MODE_LISTS_BY_FAMILY.oneLine[index]?.id
  )) && mod.ONE_LINE_MODE_LIST.length === mod.GAME_MODE_LISTS_BY_FAMILY.oneLine.length,
);
assert(
  'STAR_LINE_MODE_LIST is the derived starLine catalog',
  ids(mod.STAR_LINE_MODE_LIST).every((modeId, index) => (
    modeId === mod.GAME_MODE_LISTS_BY_FAMILY.starLine[index]?.id
  )) && mod.STAR_LINE_MODE_LIST.length === mod.GAME_MODE_LISTS_BY_FAMILY.starLine.length,
);

const syntheticRuntime = mod.GAME_MODES.classic.runtime;
const syntheticRegistry = {
  ...mod.GAME_MODES,
  futureOneLine: {
    id: 'futureOneLine',
    familyId: 'oneLine',
    familyOrder: 25,
    catalogVisible: true,
    runtime: syntheticRuntime,
  },
  futureFamilyMode: {
    id: 'futureFamilyMode',
    familyId: 'futureFamily',
    familyOrder: 10,
    catalogVisible: true,
    runtime: syntheticRuntime,
  },
  hiddenInternalMode: {
    id: 'hiddenInternalMode',
    familyId: 'oneLine',
    familyOrder: 15,
    catalogVisible: false,
    runtime: syntheticRuntime,
  },
};
assert(
  'A new visible mode is included without a second membership whitelist',
  ids(mod.buildFamilyModeList('oneLine', syntheticRegistry)).includes('futureOneLine'),
);
assert(
  'catalogVisible:false is the explicit and sufficient exclusion rule',
  !ids(mod.buildFamilyModeList('oneLine', syntheticRegistry)).includes('hiddenInternalMode'),
);
const syntheticFamilies = mod.buildFamilyRegistry(syntheticRegistry);
assert(
  'A new family is derived as itself and never defaults to oneLine',
  syntheticFamilies.futureFamily.modes.includes('futureFamilyMode')
    && !syntheticFamilies.oneLine.modes.includes('futureFamilyMode'),
);

const sortingFixture = {
  zMissing: {
    id: 'zMissing',
    familyId: 'fixture',
    catalogVisible: true,
    runtime: syntheticRuntime,
  },
  beta: {
    id: 'beta',
    familyId: 'fixture',
    familyOrder: 10,
    catalogVisible: true,
    runtime: syntheticRuntime,
  },
  alpha: {
    id: 'alpha',
    familyId: 'fixture',
    familyOrder: 10,
    catalogVisible: true,
    runtime: syntheticRuntime,
  },
};
assert(
  'Duplicate order values use id as a deterministic tiebreaker and missing order sorts last',
  ids(mod.buildFamilyModeList('fixture', sortingFixture)).join(',') === 'alpha,beta,zMissing',
);

console.log('\n=== Runtime descriptor ===');

const validBoards = new Set(Object.values(mod.RUNTIME_BOARDS));
const validSessions = new Set(Object.values(mod.RUNTIME_SESSIONS));
for (const config of modeConfigs) {
  const runtime = mod.getModeRuntime(config.id);
  assert(`${config.id} has a runtime descriptor`, runtime !== null);
  assert(`${config.id} runtime is read from its own registry entry`, runtime === config.runtime);
  assert(`${config.id} has a legal board`, validBoards.has(runtime?.board));
  assert(`${config.id} has a legal session`, validSessions.has(runtime?.session));
  assert(`${config.id} hidden interaction is boolean`, typeof runtime?.interactions?.hidden === 'boolean');
  assert(`${config.id} portal interaction is boolean`, typeof runtime?.interactions?.portal === 'boolean');
  assert(
    `${config.id} runtime has no duplicate family/starLine capability fields`,
    !('familyId' in runtime) && !('starLine' in runtime.interactions),
  );
  assert(
    `${config.id} board/session combination is coherent`,
    (runtime.board === mod.RUNTIME_BOARDS.starLine) === (
      runtime.session === mod.RUNTIME_SESSIONS.starLine
    ),
  );
  assert(
    `${config.id} does not enable Hidden and Portal together`,
    !(runtime.interactions.hidden && runtime.interactions.portal),
  );
}

const expectedRuntimeMatrix = {
  classic: ['oneLine', 'path-grid', 'path', false, false],
  hidden: ['oneLine', 'path-grid', 'path', true, false],
  diagonal: ['oneLine', 'path-grid', 'path', false, false],
  portalClassic: ['oneLine', 'path-grid', 'path', false, true],
  starSingle: ['starLine', 'star-line', 'star-line', false, false],
  starDouble: ['starLine', 'star-line', 'star-line', false, false],
};
for (const [modeId, [familyId, board, session, hidden, portal]] of Object.entries(expectedRuntimeMatrix)) {
  const runtime = mod.getModeRuntime(modeId);
  assert(`${modeId} keeps its production family`, mod.getFamilyId(modeId) === familyId);
  assert(`${modeId} keeps its production board`, runtime.board === board);
  assert(`${modeId} keeps its production session`, runtime.session === session);
  assert(`${modeId} keeps its Hidden capability`, runtime.interactions.hidden === hidden);
  assert(`${modeId} keeps its Portal capability`, runtime.interactions.portal === portal);
}
assert(
  'Only Hidden enables the Hidden interaction',
  modeConfigs.filter((config) => config.runtime.interactions.hidden).every((config) => config.id === 'hidden'),
);
assert(
  'Only Portal enables the Portal interaction',
  modeConfigs.filter((config) => config.runtime.interactions.portal).every((config) => config.id === 'portalClassic'),
);

console.log('\n=== Unknown mode fail-closed ===');

assert('Unknown mode has no runtime', mod.getModeRuntime('unknown-mode') === null);
assert('Unknown mode has no config', mod.getGameModeConfig('unknown-mode') === null);
assert('Strict config query returns null for unknown mode', mod.getGameModeConfigStrict('unknown-mode') === null);
assert('Unknown mode has no saved-game key', mod.getSavedGameKey('unknown-mode') === null);
assert('Unknown mode reports zero levels', mod.getLevelsPerDiff('unknown-mode') === 0);

let unknownStorageReads = 0;
globalThis.localStorage = {
  getItem() {
    unknownStorageReads += 1;
    return null;
  },
};
assert('Unknown saved-game read returns null', savedGame.readSavedGame('unknown-mode') === null);
assert('Unknown saved-game read never touches a fallback storage key', unknownStorageReads === 0);
delete globalThis.localStorage;

console.log('\n=== Replay family and source guards ===');

for (const config of modeConfigs) {
  assert(
    `Replay visual family for ${config.id} delegates to familyId`,
    replay.getReplayVisualFamily(config.id) === config.familyId,
  );
}
assert('Unknown replay visual family is null', replay.getReplayVisualFamily('unknown-mode') === null);
assert(
  'Replay map contains every and only catalog-visible mode',
  sameMembers(Object.keys(replay.REPLAY_VISUAL_FAMILY_BY_MODE), ids(catalogConfigs)),
);

const gameModesSource = await readFile(new URL('../src/config/gameModes.js', import.meta.url), 'utf8');
const gameViewSource = await readFile(new URL('../src/components/game/GameView.jsx', import.meta.url), 'utf8');
assert('Production catalog derivation has no modeOrder membership whitelist', !gameModesSource.includes('modeOrder'));
assert(
  'GameView Portal behavior has no direct portalClassic comparison',
  !gameViewSource.includes("playMode === 'portalClassic'"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
