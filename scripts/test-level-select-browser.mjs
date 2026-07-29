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
  LEVEL_SELECT_COMPLETION_VIEWS,
  resolveCompletionView,
} from '../src/utils/levelSelectBrowser.js';

const makeLevels = (count, {
  completed = 0,
  unlocked = count,
  savedAt = null,
} = {}) => Array.from({ length: count }, (_, index) => ({
  key: `easy-${index}`,
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
