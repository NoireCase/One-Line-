import { CONFIG } from '../classic/createClassicLevel.js';
import { getStarLineLevelByMode } from './starLineRules.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizeFiniteNonNegative = (value, fallback = 0) => (
  Number.isFinite(value) && value >= 0 ? value : fallback
);

/**
 * P3B: Star Line session adapter.
 *
 * 集中处理 Star Line session 的构造、规范化与兼容。
 * `path: [0]` 只存在于本模块内部——调用方不再直接构造无语义占位。
 * 旧存档结构（无 starLineSession 字段、旧版 gridData shape）的兼容也在此收口。
 *
 * ## 设计合同
 * - 调用方使用 buildStarLineSavePayload() 构造保存数据
 * - 调用方使用 normalizeStarLineSession() 校验并规范化已保存数据
 * - 调用方使用 isStarLineBoardActive() 判断盘面是否有玩家操作
 * - 外部代码不应再直接写 path: [0] 或 starLineSession 的字段细节
 */

/**
 * 构造保存/退出时的 Star Line 专属 payload。
 * App.jsx 的 handleCurrentSaveAndExit 通过 handleSaveAndExit 的 extraSaveData 参数传入。
 *
 * @param {string} playMode
 * @param {{ id: string, N: number, regions: number[] }} level
 * @param {Array<{ isStarred?: boolean, isMarkedX?: boolean }>} gridData
 * @returns {{ gridData: Array, path: [0], starLineSession: { modeId: string, levelId: string, gridData: Array } }}
 */
export function buildStarLineSavePayload(playMode, level, gridData) {
  return {
    gridData,
    // path: [0] 是兼容占位：通用 session validator 通过非空 path 判断"有在进行的游戏"，
    // Star Line 的真实盘面状态由 starLineSession.gridData 承载。
    // 未来如果 validator 显式支持 Star Line session 判断，可以移除本字段。
    path: [0],
    starLineSession: {
      modeId: playMode,
      levelId: level.id,
      gridData,
    },
  };
}

/**
 * 判断 Star Line 盘面是否有玩家的实际操作（落星或标记 X）。
 * 替代 App.jsx 中 ad-hoc 的 `gridData.some(cell => cell?.isStarred || cell?.isMarkedX)`。
 *
 * @param {Array<{ isStarred?: boolean, isMarkedX?: boolean }>} gridData
 * @returns {boolean}
 */
export function isStarLineBoardActive(gridData) {
  return Array.isArray(gridData) && gridData.some(
    (cell) => cell?.isStarred || cell?.isMarkedX,
  );
}

/**
 * 从已保存的原始数据中规范化 Star Line session。
 * 这是 savedGame.js normalizeStarLineSavedGame 的本体——P3B 将其移入 adapter，
 * 使 path: [0] 的构造不散布在 savedGame.js 中。
 *
 * @param {object} raw — 原始 localStorage 解析后的对象
 * @param {{ diff: string, levelIdx: number }} identity — 已验证的关卡身份
 * @param {string} playMode
 * @returns {object|null} 规范化后的 saved game 对象，或 null 表示数据无效
 */
export function normalizeStarLineSession(raw, identity, playMode) {
  const level = getStarLineLevelByMode(playMode, identity.levelIdx);
  if (!level) return null;

  const sourceSession = isRecord(raw.starLineSession) ? raw.starLineSession : {};
  const sourceGrid = Array.isArray(sourceSession.gridData)
    ? sourceSession.gridData
    : raw.gridData;

  if (!Array.isArray(sourceGrid) || sourceGrid.length !== level.N ** 2) return null;
  if (sourceSession.modeId !== undefined && sourceSession.modeId !== playMode) return null;
  if (sourceSession.levelId !== undefined && sourceSession.levelId !== level.id) return null;

  const starLineGrid = sourceGrid.map((cell, index) => {
    if (!isRecord(cell)) return null;
    if (cell.regionId !== undefined && cell.regionId !== level.regions[index]) return null;
    const isStarred = Boolean(cell.isStarred);
    const isMarkedX = Boolean(cell.isMarkedX);
    if (isStarred && isMarkedX) return null;
    return {
      ...cell,
      regionId: level.regions[index],
      isStarred,
      isMarkedX,
    };
  });
  if (starLineGrid.some((cell) => cell === null)) return null;

  return {
    ...raw,
    playMode,
    diff: identity.diff,
    levelIdx: identity.levelIdx,
    gridData: starLineGrid,
    // 兼容占位，说明同 buildStarLineSavePayload
    path: [0],
    hp: Number.isFinite(raw.hp) && raw.hp > 0 ? raw.hp : CONFIG.easy.hp,
    timer: normalizeFiniteNonNegative(raw.timer),
    score: normalizeFiniteNonNegative(raw.score),
    maxCombo: normalizeFiniteNonNegative(raw.maxCombo),
    activePortal: null,
    savedAt: normalizeFiniteNonNegative(raw.savedAt),
    starLineSession: {
      ...sourceSession,
      modeId: playMode,
      levelId: level.id,
      gridData: starLineGrid,
    },
  };
}
