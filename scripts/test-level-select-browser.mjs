import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_MODES, PLAY_MODES } from '../src/config/gameModes.js';
import {
  buildLevelSelectPages,
  getCeremonyPageStarts,
  getCompletionCeremonyFrame,
  getCompletionCeremonyTimeline,
  getDefaultLevelPageIndex,
  getLevelPageStarts,
  getNextModeForGuide,
  getRecommendedLevel,
  getReplayRecommendedLevel,
  LEVEL_SELECT_COMPLETION_VIEWS,
  resolveCompletionView,
} from '../src/utils/levelSelectBrowser.js';
import {
  getReplayVisualFamily,
  REPLAY_VISUAL_FAMILIES,
} from '../src/config/replayVisualFamily.js';
import {
  activateLevelSelectReplay,
  LEVEL_SELECT_REPLAY_STORAGE_KEY,
  markLevelSelectReplayCompleted,
  normalizeLevelSelectReplayProgress,
  readLevelSelectReplayProgress,
  setLevelSelectReplayPage,
} from '../src/utils/levelSelectReplayStorage.js';

const makeLevels = (count, {
  completed = 0,
  unlocked = count,
  savedAt = null,
} = {}) => Array.from({ length: count }, (_, index) => ({
  key: `easy-${index}`,
  levelId: `level-${index + 1}`,
  displayLevelNumber: index + 1,
  isCompleted: index < completed,
  isUnlocked: index < unlocked,
  hasSave: index + 1 === savedAt,
}));

assert.deepEqual(getLevelPageStarts(0), []);
assert.deepEqual(getLevelPageStarts(8), [1]);
assert.deepEqual(getLevelPageStarts(10), [1]);
assert.deepEqual(getLevelPageStarts(13), [1, 11]);
assert.deepEqual(getLevelPageStarts(20), [1, 11]);
assert.deepEqual(getLevelPageStarts(30), [1, 11, 21]);
assert.deepEqual(getLevelPageStarts(60), [1, 11, 21, 31, 41, 51]);
for (const total of [8, 10, 13, 20, 30, 60]) {
  const starts = getLevelPageStarts(total);
  assert.equal(new Set(starts).size, starts.length);
  assert.equal(starts.every(start => start >= 1), true);
  assert.equal(starts.every(start => start <= total), true);
}

const sixtyLevelPages = buildLevelSelectPages([
  { key: 'intro', label: '入门', levels: makeLevels(10) },
  {
    key: 'medium',
    label: '中等',
    levels: makeLevels(20).map((level, index) => ({
      ...level,
      key: `medium-${index}`,
      displayLevelNumber: index + 11,
    })),
  },
  {
    key: 'hard',
    label: '困难',
    levels: makeLevels(30).map((level, index) => ({
      ...level,
      key: `hard-${index}`,
      displayLevelNumber: index + 31,
    })),
  },
]);
assert.equal(sixtyLevelPages.length, 6);
assert.deepEqual(
  sixtyLevelPages[1].levels.map(level => level.displayLevelNumber),
  [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
);
assert.equal(sixtyLevelPages[1].label, '中等');
assert.equal(getDefaultLevelPageIndex(sixtyLevelPages, 'hard-12'), 4);

const thirteenLevelPages = buildLevelSelectPages([
  { key: 'only', label: '基础', levels: makeLevels(13) },
]);
assert.equal(thirteenLevelPages.length, 2);
assert.deepEqual(
  thirteenLevelPages[1].levels.map(level => level.displayLevelNumber),
  [11, 12, 13],
);

const crossChapterPages = buildLevelSelectPages([
  { key: 'basic', label: '基础', levels: makeLevels(5) },
  {
    key: 'advanced',
    label: '进阶',
    levels: makeLevels(5).map((level, index) => ({
      ...level,
      key: `advanced-${index}`,
      displayLevelNumber: index + 6,
    })),
  },
]);
assert.equal(crossChapterPages[0].label, '基础 · 进阶');

const levelsWithSave = makeLevels(15, {
  completed: 7,
  unlocked: 9,
  savedAt: 6,
});
assert.equal(getRecommendedLevel(levelsWithSave).displayLevelNumber, 6);
assert.equal(
  getRecommendedLevel(makeLevels(15, { completed: 8, unlocked: 9 }))
    .displayLevelNumber,
  9,
);
assert.equal(getRecommendedLevel(makeLevels(10, { completed: 10 })), null);

const replayLevels = makeLevels(13, { completed: 13 });
assert.equal(getReplayRecommendedLevel(replayLevels).displayLevelNumber, 1);
assert.equal(
  getReplayRecommendedLevel(replayLevels, ['level-1']).displayLevelNumber,
  2,
);
assert.equal(
  getReplayRecommendedLevel(
    replayLevels,
    replayLevels.slice(0, 9).map(level => level.levelId),
  ).displayLevelNumber,
  10,
);
assert.equal(
  getReplayRecommendedLevel(
    replayLevels,
    replayLevels.slice(0, 10).map(level => level.levelId),
  ).displayLevelNumber,
  11,
);
assert.equal(
  getReplayRecommendedLevel(replayLevels, ['level-1', 'level-3'])
    .displayLevelNumber,
  2,
);
assert.equal(
  getReplayRecommendedLevel(
    replayLevels,
    replayLevels.map(level => level.levelId),
  ),
  null,
);
assert.equal(getReplayRecommendedLevel([], ['level-1']), null);

const longReplayLevels = makeLevels(30, { completed: 30 });
assert.equal(
  getReplayRecommendedLevel(
    longReplayLevels,
    longReplayLevels.slice(0, 17).map(level => level.levelId),
  ).displayLevelNumber,
  18,
);
assert.equal(
  getReplayRecommendedLevel(
    longReplayLevels,
    longReplayLevels.slice(0, 20).map(level => level.levelId),
  ).displayLevelNumber,
  21,
);

assert.deepEqual(
  ['classic', 'hidden', 'diagonal', 'portalClassic']
    .map(getReplayVisualFamily),
  Array(4).fill(REPLAY_VISUAL_FAMILIES.oneLine),
);
assert.deepEqual(
  ['starSingle', 'starDouble'].map(getReplayVisualFamily),
  Array(2).fill(REPLAY_VISUAL_FAMILIES.starLine),
);
assert.equal(getReplayVisualFamily('unknown'), null);

const replayStorage = new Map();
globalThis.localStorage = {
  getItem: key => replayStorage.get(key) ?? null,
  setItem: (key, value) => replayStorage.set(key, String(value)),
  removeItem: key => replayStorage.delete(key),
};

activateLevelSelectReplay('classic');
markLevelSelectReplayCompleted(
  'classic',
  'classic:easy:0',
  ['classic:easy:0', 'classic:easy:1', 'classic:easy:2'],
);
activateLevelSelectReplay('starSingle');
markLevelSelectReplayCompleted(
  'starSingle',
  'star-single-001',
  ['star-single-001', 'star-single-002'],
);
setLevelSelectReplayPage('starSingle', 3);
const isolatedReplayProgress = readLevelSelectReplayProgress();
assert.deepEqual(
  isolatedReplayProgress.modes.classic.replayCompletedLevelIds,
  ['classic:easy:0'],
);
assert.deepEqual(
  isolatedReplayProgress.modes.starSingle.replayCompletedLevelIds,
  ['star-single-001'],
);
assert.equal(isolatedReplayProgress.modes.classic.lastReplayPage, 0);
assert.equal(isolatedReplayProgress.modes.starSingle.lastReplayPage, 3);

markLevelSelectReplayCompleted(
  'classic',
  'classic:easy:2',
  ['classic:easy:0', 'classic:easy:1', 'classic:easy:2'],
);
assert.deepEqual(
  readLevelSelectReplayProgress().modes.classic.replayCompletedLevelIds,
  ['classic:easy:0', 'classic:easy:2'],
);
assert.equal(readLevelSelectReplayProgress().modes.classic.lastReplayPage, 0);
assert.deepEqual(
  readLevelSelectReplayProgress().modes.starSingle.replayCompletedLevelIds,
  ['star-single-001'],
);

replayStorage.set(LEVEL_SELECT_REPLAY_STORAGE_KEY, '{broken');
assert.deepEqual(readLevelSelectReplayProgress(), {
  version: 1,
  modes: {},
});
assert.deepEqual(normalizeLevelSelectReplayProgress({
  version: 0,
  modes: {
    classic: {
      replayActive: true,
      replayCompletedLevelIds: ['a', 'a', null],
      lastReplayPage: -5,
    },
    unsupported: {
      replayActive: true,
      replayCompletedLevelIds: ['x'],
    },
  },
}), {
  version: 1,
  modes: {
    classic: {
      replayActive: true,
      replayCompletedLevelIds: ['a'],
      lastReplayPage: 0,
    },
  },
});

assert.equal(resolveCompletionView({
  modeId: 'classic',
  isComplete: false,
}), LEVEL_SELECT_COMPLETION_VIEWS.normal);
assert.equal(resolveCompletionView({
  modeId: 'classic',
  isComplete: true,
}), LEVEL_SELECT_COMPLETION_VIEWS.sealed);
assert.equal(resolveCompletionView({
  modeId: 'classic',
  isComplete: true,
  completionEvent: {
    modeId: 'classic',
    firstCompletion: true,
  },
  ceremonyPlayed: false,
}), LEVEL_SELECT_COMPLETION_VIEWS.ceremony);
assert.equal(resolveCompletionView({
  modeId: 'classic',
  isComplete: true,
  completionEvent: {
    modeId: 'classic',
    firstCompletion: true,
  },
  ceremonyPlayed: true,
}), LEVEL_SELECT_COMPLETION_VIEWS.sealed);
assert.equal(resolveCompletionView({
  modeId: 'hidden',
  isComplete: true,
  completionEvent: {
    modeId: 'classic',
    firstCompletion: true,
  },
  ceremonyPlayed: false,
}), LEVEL_SELECT_COMPLETION_VIEWS.sealed);

const modes = [
  { id: 'classic' },
  { id: 'hidden' },
  { id: 'diagonal' },
];
assert.equal(getNextModeForGuide(modes, 'classic', {
  classic: { completed: 45, total: 45 },
  hidden: { completed: 60, total: 60 },
  diagonal: { completed: 8, total: 45 },
}), 'diagonal');
assert.equal(getNextModeForGuide(modes, 'diagonal', {}), null);

assert.deepEqual(getCeremonyPageStarts(60), [51, 41, 31, 21, 11, 1]);
assert.deepEqual(getCeremonyPageStarts(30), [21, 11, 1]);
assert.deepEqual(getCeremonyPageStarts(13), [11, 1]);
const ceremonyTimeline = getCompletionCeremonyTimeline(60);
assert.equal(ceremonyTimeline.pageStep, 450);
assert.equal(ceremonyTimeline.end, 4400);
assert.equal(getCompletionCeremonyFrame(60, 0).pageStart, 51);
assert.equal(getCompletionCeremonyFrame(60, 3500).pageStart, 1);
assert.equal(getCompletionCeremonyFrame(60, 4400).complete, true);

assert.deepEqual(
  [
    PLAY_MODES.classic,
    PLAY_MODES.hidden,
    PLAY_MODES.diagonal,
    PLAY_MODES.portalClassic,
  ].map(modeId => GAME_MODES[modeId].name),
  ['循序寻踪', '隐迹寻踪', '八向寻踪', '跃迁寻踪'],
);

const chapterMarkSource = readFileSync(
  new URL('../src/components/ChapterRuleMark.jsx', import.meta.url),
  'utf8',
);
const puzzleBookSource = readFileSync(
  new URL('../src/components/PuzzleBookPage.jsx', import.meta.url),
  'utf8',
);
const levelSelectCss = readFileSync(
  new URL('../src/index.css', import.meta.url),
  'utf8',
);

assert.match(chapterMarkSource, /rule-mark-classic-start/);
assert.match(chapterMarkSource, /rule-mark-classic-end/);
assert.match(chapterMarkSource, /rule-mark-diagonal-start/);
assert.match(chapterMarkSource, /rule-mark-diagonal-end/);
assert.equal((chapterMarkSource.match(/<ellipse className="rule-mark-portal is-/g) || []).length, 2);
assert.match(puzzleBookSource, /if \(modeId === activeMode\) return;/);
assert.match(puzzleBookSource, /setChapterAnimationCycle\(cycle => cycle \+ 1\)/);
assert.match(levelSelectCss, /--motion-duration-ritual:\s*800ms/);
assert.match(levelSelectCss, /@keyframes classic-route-cycle[\s\S]*?77\.5%/);
assert.match(levelSelectCss, /@keyframes hidden-right-cycle[\s\S]*?76\.25%[\s\S]*?92\.5%/);
assert.match(levelSelectCss, /@keyframes diagonal-route-cycle[\s\S]*?81\.25%/);
assert.match(levelSelectCss, /@keyframes portal-right-cycle[\s\S]*?58\.75%[\s\S]*?87\.5%/);
assert.match(levelSelectCss, /@keyframes chapter-heading-cycle[\s\S]*?90%/);
assert.match(levelSelectCss, /font-size:\s*clamp\(18px,\s*1\.45vw,\s*22px\)/);
assert.match(levelSelectCss, /font-size:\s*clamp\(24px,\s*2vw,\s*32px\)/);

console.log('level-select-browser: all assertions passed');
