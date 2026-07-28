import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_MODES, PLAY_MODES } from '../src/config/gameModes.js';
import {
  getCeremonyPageStarts,
  getCompletionCeremonyFrame,
  getCompletionCeremonyTimeline,
  getDefaultLevelWindowIndex,
  getDifficultyProgress,
  getLevelWindowStarts,
  getMaxBrowsableWindowIndex,
  getNextModeForGuide,
  getRecommendedLevel,
  getVisibleLevels,
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

assert.deepEqual(getLevelWindowStarts(8), [1]);
assert.deepEqual(getLevelWindowStarts(10), [1]);
assert.deepEqual(getLevelWindowStarts(12), [1, 3]);
assert.deepEqual(getLevelWindowStarts(15), [1, 6]);
assert.deepEqual(getLevelWindowStarts(20), [1, 6, 11]);
assert.deepEqual(getLevelWindowStarts(30), [1, 6, 11, 16, 21]);
assert.deepEqual(getLevelWindowStarts(60), [1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51]);
for (const total of [8, 10, 12, 15, 20, 30, 60]) {
  const starts = getLevelWindowStarts(total);
  assert.equal(new Set(starts).size, starts.length);
  assert.equal(starts.every(start => start >= 1), true);
  assert.equal(starts.every(start => start <= Math.max(1, total - 9)), true);
  if (total > 10) assert.equal(starts.at(-1), total - 9);
}

assert.equal(getDefaultLevelWindowIndex(30, 2), 0);
assert.equal(getDefaultLevelWindowIndex(30, 14), 2);
assert.equal(getDefaultLevelWindowIndex(15, 9), 1);
assert.equal(getDefaultLevelWindowIndex(12, 12), 1);
assert.equal(getDefaultLevelWindowIndex(30, 30), 4);
assert.equal(getMaxBrowsableWindowIndex(15, 9, 9), 1);
assert.equal(getMaxBrowsableWindowIndex(30, 14, 14), 2);
assert.equal(getMaxBrowsableWindowIndex(30, 30, null), 4);

assert.deepEqual(
  getVisibleLevels(makeLevels(12), 3).map(level => level.displayLevelNumber),
  [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
);
assert.deepEqual(getDifficultyProgress(makeLevels(15, {
  completed: 8,
  unlocked: 9,
})), {
  completed: 8,
  unlocked: 9,
  total: 15,
});

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
