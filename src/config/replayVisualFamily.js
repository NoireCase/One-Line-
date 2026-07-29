export const REPLAY_VISUAL_FAMILIES = Object.freeze({
  oneLine: 'oneLine',
  starLine: 'starLine',
});

export const REPLAY_VISUAL_FAMILY_BY_MODE = Object.freeze({
  classic: REPLAY_VISUAL_FAMILIES.oneLine,
  hidden: REPLAY_VISUAL_FAMILIES.oneLine,
  diagonal: REPLAY_VISUAL_FAMILIES.oneLine,
  portalClassic: REPLAY_VISUAL_FAMILIES.oneLine,
  starSingle: REPLAY_VISUAL_FAMILIES.starLine,
  starDouble: REPLAY_VISUAL_FAMILIES.starLine,
});

export const REPLAY_MODE_IDS = Object.freeze(
  Object.keys(REPLAY_VISUAL_FAMILY_BY_MODE),
);

export function getReplayVisualFamily(modeId) {
  return REPLAY_VISUAL_FAMILY_BY_MODE[modeId] || null;
}
