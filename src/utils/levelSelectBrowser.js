const WINDOW_SIZE = 10;
const WINDOW_STEP = 5;

export const LEVEL_SELECT_COMPLETION_VIEWS = Object.freeze({
  normal: 'normal',
  ceremony: 'ceremony',
  sealed: 'sealed',
  replay: 'replay',
});

function normalizeCount(total) {
  return Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
}

export function getLevelWindowStarts(total) {
  const count = normalizeCount(total);
  if (count <= WINDOW_SIZE) return [1];

  const starts = [];
  for (let start = 1; start + WINDOW_SIZE - 1 <= count; start += WINDOW_STEP) {
    starts.push(start);
  }
  const finalStart = count - WINDOW_SIZE + 1;
  if (starts.at(-1) !== finalStart) starts.push(finalStart);
  return starts;
}

export function getDefaultLevelWindowIndex(total, recommendedLocalNumber = null) {
  const starts = getLevelWindowStarts(total);
  if (!Number.isInteger(recommendedLocalNumber) || recommendedLocalNumber < 1) return 0;

  const count = normalizeCount(total);
  const idealStart = Math.min(
    Math.floor((recommendedLocalNumber - 1) / WINDOW_STEP) * WINDOW_STEP + 1,
    Math.max(1, count - WINDOW_SIZE + 1),
  );
  let index = 0;
  starts.forEach((start, candidateIndex) => {
    if (start <= idealStart) index = candidateIndex;
  });
  return index;
}

export function getMaxBrowsableWindowIndex(total, unlockedCount, recommendedLocalNumber = null) {
  const starts = getLevelWindowStarts(total);
  if (normalizeCount(unlockedCount) >= normalizeCount(total)) return starts.length - 1;
  return getDefaultLevelWindowIndex(total, recommendedLocalNumber);
}

export function getVisibleLevels(levels, windowStart) {
  if (!Array.isArray(levels)) return [];
  const startIndex = Math.max(0, (Number(windowStart) || 1) - 1);
  return levels.slice(startIndex, startIndex + WINDOW_SIZE);
}

export function getDifficultyProgress(levels) {
  const list = Array.isArray(levels) ? levels : [];
  return {
    completed: list.filter(level => level.isCompleted).length,
    unlocked: list.filter(level => level.isUnlocked).length,
    total: list.length,
  };
}

export function getRecommendedLevel(levels) {
  const list = Array.isArray(levels) ? levels : [];
  return list.find(level => level.hasSave)
    || list.find(level => level.isUnlocked && !level.isCompleted)
    || null;
}

export function resolveCompletionView({
  modeId,
  isComplete,
  completionEvent = null,
  ceremonyPlayed = false,
}) {
  if (!isComplete) return LEVEL_SELECT_COMPLETION_VIEWS.normal;
  if (
    completionEvent?.modeId === modeId
    && completionEvent?.firstCompletion === true
    && !ceremonyPlayed
  ) {
    return LEVEL_SELECT_COMPLETION_VIEWS.ceremony;
  }
  return LEVEL_SELECT_COMPLETION_VIEWS.sealed;
}

export function getNextModeForGuide(modes, currentModeId, modeProgressSummaries) {
  const list = Array.isArray(modes) ? modes : [];
  const currentIndex = list.findIndex(mode => mode.id === currentModeId);
  if (currentIndex < 0) return null;
  for (let index = currentIndex + 1; index < list.length; index += 1) {
    const mode = list[index];
    const progress = modeProgressSummaries?.[mode.id] || { completed: 0, total: 0 };
    if (progress.total <= 0 || progress.completed < progress.total) return mode.id;
  }
  return null;
}

export function getCeremonyPageStarts(total) {
  const count = normalizeCount(total);
  if (count === 0) return [1];
  const starts = [Math.max(1, count - WINDOW_SIZE + 1)];
  for (let start = count - (WINDOW_SIZE * 2) + 1; start > 1; start -= WINDOW_SIZE) {
    starts.push(start);
  }
  if (starts.at(-1) !== 1) starts.push(1);
  return starts;
}

export function getCompletionCeremonyTimeline(total) {
  const pages = getCeremonyPageStarts(total);
  const flipStart = 1250;
  const pageStep = 450;
  const sealStart = flipStart + (pages.length - 1) * pageStep;
  return {
    pages,
    flipStart,
    pageStep,
    sealStart,
    progressAt: sealStart + 400,
    guideAt: sealStart + 750,
    end: sealStart + 900,
  };
}

export function getCompletionCeremonyFrame(total, elapsed) {
  const timeline = getCompletionCeremonyTimeline(total);
  const time = Math.max(0, Number(elapsed) || 0);
  const pageIndex = time < timeline.flipStart
    ? 0
    : Math.min(
        Math.floor((time - timeline.flipStart) / timeline.pageStep) + 1,
        timeline.pages.length - 1,
      );
  const pageAppearedAt = pageIndex === 0
    ? 0
    : timeline.flipStart + (pageIndex - 1) * timeline.pageStep;
  const goldStates = Array.from({ length: WINDOW_SIZE }, (_, index) => {
    const goldAt = pageIndex === 0
      ? 150 + (WINDOW_SIZE - 1 - index) * 85
      : pageAppearedAt + (WINDOW_SIZE - 1 - index) * 24;
    return time >= goldAt;
  });

  return {
    ...timeline,
    pageIndex,
    pageStart: timeline.pages[pageIndex],
    pageAppearedAt,
    goldStates,
    showSeal: time >= timeline.sealStart,
    showProgress: time >= timeline.progressAt,
    showGuide: time >= timeline.guideAt,
    complete: time >= timeline.end,
  };
}
