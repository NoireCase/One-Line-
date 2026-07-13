const SINGLE_STAR_TIMING = Object.freeze({
  winPanelDelay: 1000,
  starStaggerDelay: 70,
  starStaggerMax: 280,
  starPulseDuration: 650,
});

const DOUBLE_STAR_TIMING = Object.freeze({
  winPanelDelay: 1300,
  starStaggerDelay: 40,
  starStaggerMax: 600,
  starPulseDuration: 650,
});

export function getStarLineCompletionTiming(level) {
  const quota = level?.starsPerRow ?? level?.starsPerCol ?? level?.starsPerRegion ?? 1;
  return quota > 1 ? DOUBLE_STAR_TIMING : SINGLE_STAR_TIMING;
}

export function getStarLineStarDelay(starOrder, timing) {
  return Math.min(starOrder * timing.starStaggerDelay, timing.starStaggerMax);
}
