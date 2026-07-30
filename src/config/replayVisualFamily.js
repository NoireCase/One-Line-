import { GAME_MODE_LIST, getFamilyId } from './gameModes.js';

export const REPLAY_VISUAL_FAMILIES = Object.freeze({
  oneLine: 'oneLine',
  starLine: 'starLine',
});

// P3B: 从 gameModes.js 的 GAME_FAMILIES 单一来源推导，不再独立维护第二份映射。
const _buildFamilyByMode = () => {
  const map = {};
  for (const mode of GAME_MODE_LIST) {
    const familyId = getFamilyId(mode.id);
    if (familyId) map[mode.id] = familyId;
  }
  return Object.freeze(map);
};

export const REPLAY_VISUAL_FAMILY_BY_MODE = _buildFamilyByMode();

export const REPLAY_MODE_IDS = Object.freeze(
  Object.keys(REPLAY_VISUAL_FAMILY_BY_MODE),
);

export function getReplayVisualFamily(modeId) {
  return getFamilyId(modeId) || null;
}
