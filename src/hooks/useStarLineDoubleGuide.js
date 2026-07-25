/**
 * Star Double 教学持久化钩子 (v3)。
 *
 * 存储格式 v5：
 *   { version: 5, completedLessons: { [levelId]: true }, replayLevelId: null }
 *
 * 迁移规则：
 *   - v4 completed=true 只映射到 Lv.1
 *   - v4 step 不迁移
 *   - v4 replayRequested=true 映射为 replayLevelId='star-double-tutorial-01'
 *   - v4 lessons 子对象逐项迁移到 completedLessons
 *   - 迁移后不再写回旧字段
 *   - step 为 session 状态，不持久化
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeGetStorageItem, safeSetStorageItem } from '../utils/safeStorage.js';
import {
  resolveStarLineDoubleTutorialCells,
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
} from '../game/starLine/starLineDoubleTutorialContract.js';

export const STAR_LINE_DOUBLE_GUIDANCE_KEY = 'cg_star_line_double_guidance_v1';
export const LEGACY_STAR_LINE_DOUBLE_GUIDE_KEY = 'cg_discovery_star_line_double_star_v1';

const GUIDANCE_VERSION = 5;
const DOUBLE_LESSON_IDS = new Set(Array.from(
  { length: 10 },
  (_, index) => `star-double-tutorial-${String(index + 1).padStart(2, '0')}`,
));

function normalizeCompletedLessons(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([levelId, completed]) => (
    DOUBLE_LESSON_IDS.has(levelId) && completed === true
  )));
}

// ═══ 迁移 ═══

export function normalizeStarLineDoubleGuidance(raw) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.version === 5) {
    return {
      version: 5,
      completedLessons: normalizeCompletedLessons(raw.completedLessons),
      replayLevelId: DOUBLE_LESSON_IDS.has(raw.replayLevelId) ? raw.replayLevelId : null,
    };
  }

  // v4 migration
  if (raw.version === 4) {
    const result = { version: 5, completedLessons: {}, replayLevelId: null };

    // Lv.1 completed → only Lv.1
    if (raw.completed === true) {
      result.completedLessons['star-double-tutorial-01'] = true;
    }

    // replayRequested → replay Lv.1
    if (raw.replayRequested === true) {
      result.replayLevelId = 'star-double-tutorial-01';
    }

    // v4/v2 lessons sub-object
    if (raw.lessons && typeof raw.lessons === 'object') {
      for (const [id, state] of Object.entries(raw.lessons)) {
        if (state?.completed === true) {
          if (DOUBLE_LESSON_IDS.has(id)) result.completedLessons[id] = true;
        }
      }
    }

    return result;
  }

  return null;
}

function createDefaultV5() {
  return { version: 5, completedLessons: {}, replayLevelId: null };
}

function readStored() {
  const raw = safeGetStorageItem(STAR_LINE_DOUBLE_GUIDANCE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizeStarLineDoubleGuidance(parsed);
  } catch {
    return null;
  }
}

/**
 * Hook: Star Double 教学持久化。
 * 返回 guidance（持久化状态）+ actions（complete/replay 操作）。
 * session step 由 StarLineBoard 内部管理。
 */
export default function useStarLineDoubleGuide() {
  const [stored, setStored] = useState(() => {
    const migrated = readStored();
    if (migrated) return migrated;

    // Legacy player detection
    const hasLegacy = safeGetStorageItem(LEGACY_STAR_LINE_DOUBLE_GUIDE_KEY) !== null;
    if (hasLegacy) {
      return { version: 5, completedLessons: { 'star-double-tutorial-01': true }, replayLevelId: null };
    }

    return createDefaultV5();
  });

  // Persist (v5-only format, no old fields)
  useEffect(() => {
    const toPersist = {
      version: GUIDANCE_VERSION,
      completedLessons: stored.completedLessons || {},
      replayLevelId: stored.replayLevelId || null,
    };
    safeSetStorageItem(STAR_LINE_DOUBLE_GUIDANCE_KEY, JSON.stringify(toPersist));
  }, [stored]);

  const guidance = useMemo(() => ({
    version: GUIDANCE_VERSION,
    completedLessons: stored.completedLessons || {},
    replayLevelId: stored.replayLevelId || null,
    // Backward-compat for Lv.1: completed means Lv.1 done
    get completed() { return Boolean(stored.completedLessons?.['star-double-tutorial-01']); },
    get replayRequested() { return stored.replayLevelId === 'star-double-tutorial-01'; },
  }), [stored]);

  const isLessonCompleted = useCallback((levelId) => {
    return Boolean(stored.completedLessons?.[levelId]);
  }, [stored]);

  const completeLesson = useCallback((levelId) => {
    setStored(prev => ({
      ...prev,
      completedLessons: { ...prev.completedLessons, [levelId]: true },
      replayLevelId: prev.replayLevelId === levelId ? null : prev.replayLevelId,
    }));
  }, []);

  const requestReplay = useCallback((levelId) => {
    setStored(prev => ({
      ...prev,
      replayLevelId: DOUBLE_LESSON_IDS.has(levelId) && prev.completedLessons?.[levelId]
        ? levelId
        : prev.replayLevelId,
    }));
  }, []);

  const clearReplay = useCallback(() => {
    setStored(prev => ({ ...prev, replayLevelId: null }));
  }, []);

  const actions = useMemo(() => ({
    isLessonCompleted,
    completeLesson,
    requestReplay,
    clearReplay,
  }), [isLessonCompleted, completeLesson, requestReplay, clearReplay]);

  return { guidance, actions };
}

// ═══ 工具函数 ═══

function cellMatchesAction(cell, action) {
  if (action === 'place-stars') return Boolean(cell?.isStarred) && !cell?.isMarkedX;
  return Boolean(cell?.isMarkedX) && !cell?.isStarred;
}

export function resolveStarLineDoubleGuideStep(storedStep, gridData) {
  const steps = STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.steps;
  const stepNumber = Math.min(steps.length, Math.max(1, Number(storedStep) || 1));
  const step = steps[stepNumber - 1];
  if (!step || step.type === 'explain' || step.type === 'autonomous') return stepNumber;
  const actionCells = resolveStarLineDoubleTutorialCells(step, 'actions');
  if (actionCells.length === 0) return stepNumber;
  const completed = actionCells.every(idx => cellMatchesAction(gridData?.[idx], step.type));
  return completed ? stepNumber + 1 : stepNumber;
}

export function canSafelyReplayStarLineDoubleGuide(gridData) {
  return Array.isArray(gridData)
    && gridData.length > 0
    && gridData.every(cell => !cell?.isStarred && !cell?.isMarkedX);
}
