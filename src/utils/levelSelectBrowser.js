export const LEVEL_SELECT_PAGE_SIZE = 10;

export const LEVEL_SELECT_COMPLETION_VIEWS = Object.freeze({
  normal: 'normal',
  ceremony: 'ceremony',
  sealed: 'sealed',
  replay: 'replay',
});

function normalizeCount(total) {
  return Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
}

export function getLevelPageStarts(total) {
  const count = normalizeCount(total);
  if (count === 0) return [];
  return Array.from(
    { length: Math.ceil(count / LEVEL_SELECT_PAGE_SIZE) },
    (_, index) => index * LEVEL_SELECT_PAGE_SIZE + 1,
  );
}

export function buildLevelSelectPages(sections) {
  const entries = (Array.isArray(sections) ? sections : []).flatMap(section => (
    (Array.isArray(section?.levels) ? section.levels : []).map(level => ({
      level,
      sectionKey: section.key || '',
      sectionLabel: section.label || '',
    }))
  ));

  return getLevelPageStarts(entries.length).map((start, pageIndex) => {
    const pageEntries = entries.slice(
      pageIndex * LEVEL_SELECT_PAGE_SIZE,
      (pageIndex + 1) * LEVEL_SELECT_PAGE_SIZE,
    );
    const sectionLabels = [...new Set(
      pageEntries.map(entry => entry.sectionLabel).filter(Boolean),
    )];
    return {
      index: pageIndex,
      start,
      end: start + pageEntries.length - 1,
      label: sectionLabels.join(' · '),
      sectionKeys: [...new Set(
        pageEntries.map(entry => entry.sectionKey).filter(Boolean),
      )],
      levels: pageEntries.map(entry => entry.level),
    };
  });
}

export function getDefaultLevelPageIndex(pages, recommendedKey = null) {
  if (!recommendedKey || !Array.isArray(pages)) return 0;
  const pageIndex = pages.findIndex(page => (
    page.levels.some(level => level.key === recommendedKey)
  ));
  return pageIndex >= 0 ? pageIndex : 0;
}

export function getRecommendedLevel(levels) {
  const list = Array.isArray(levels) ? levels : [];
  return list.find(level => level.hasSave)
    || list.find(level => level.isUnlocked && !level.isCompleted)
    || null;
}

export function getReplayRecommendedLevel(levels, completedLevelKey = null) {
  const list = Array.isArray(levels) ? levels : [];
  if (list.length === 0) return null;
  if (!completedLevelKey) return list[0];
  const completedIndex = list.findIndex(level => level.key === completedLevelKey);
  if (completedIndex < 0) return list[0];
  return list[Math.min(completedIndex + 1, list.length - 1)];
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
  return getLevelPageStarts(count).reverse();
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
  const goldStates = Array.from({ length: LEVEL_SELECT_PAGE_SIZE }, (_, index) => {
    const goldAt = pageIndex === 0
      ? 150 + (LEVEL_SELECT_PAGE_SIZE - 1 - index) * 85
      : pageAppearedAt + (LEVEL_SELECT_PAGE_SIZE - 1 - index) * 24;
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
