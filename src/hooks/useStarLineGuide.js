import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLAY_MODES, getSavedGameKey } from '../config/gameModes.js';
import { safeGetStorageItem, safeSetStorageItem } from '../utils/safeStorage.js';
import { STAR_LINE_TUTORIAL_CONTRACT } from '../game/starLine/starLineTutorialContract.js';

export const STAR_LINE_GUIDANCE_KEY = 'cg_star_line_guidance_v1';
export const LEGACY_STAR_LINE_BASIC_KEY = 'cg_discovery_star_line_basic_v1';
export const STAR_LINE_DOUBLE_GUIDE_KEY = 'cg_discovery_star_line_double_star_v1';

const GUIDANCE_VERSION = 1;
const FIRST_SINGLE_LEVEL_ID = 'star-lv-01';
const FIRST_DOUBLE_LEVEL_ID = 'star-lv-21';

const createFreshGuidance = () => ({
  version: GUIDANCE_VERSION,
  operation: { completed: false, step: 1 },
  rules: { completed: false, step: 1 },
  replayRequested: false,
});

const createSkippedGuidance = () => ({
  version: GUIDANCE_VERSION,
  operation: { completed: true, step: 4 },
  rules: { completed: true, step: 10 },
  replayRequested: false,
});

function normalizeGuidance(value) {
  if (!value || value.version !== GUIDANCE_VERSION) return null;
  const operationStep = Math.min(4, Math.max(1, Number(value.operation?.step) || 1));
  const ruleStep = Math.min(10, Math.max(1, Number(value.rules?.step) || 1));
  return {
    version: GUIDANCE_VERSION,
    operation: {
      completed: Boolean(value.operation?.completed),
      step: operationStep,
    },
    rules: {
      completed: Boolean(value.rules?.completed),
      step: ruleStep,
    },
    replayRequested: Boolean(value.replayRequested),
  };
}

function readStoredGuidance() {
  const raw = safeGetStorageItem(STAR_LINE_GUIDANCE_KEY);
  if (!raw) return null;
  try {
    return normalizeGuidance(JSON.parse(raw));
  } catch {
    return null;
  }
}

function hasMeaningfulProgress(progressV2) {
  const single = progressV2?.games?.[PLAY_MODES.starSingle];
  const double = progressV2?.games?.[PLAY_MODES.starDouble];
  const hasCompletions = [single, double].some(game => Object.keys(game?.completed || {}).length > 0);
  const hasAdvancedUnlock = single?.unlockedThroughId !== FIRST_SINGLE_LEVEL_ID
    || double?.unlockedThroughId !== FIRST_DOUBLE_LEVEL_ID;
  return hasCompletions || hasAdvancedUnlock;
}

function hasMeaningfulLegacyProgress() {
  const raw = safeGetStorageItem('cg_star_line_progress');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Number(parsed?.unlockedThrough) > 0 || Object.keys(parsed?.completed || {}).length > 0;
  } catch {
    return false;
  }
}

function hasSavedStarLineSession() {
  return [PLAY_MODES.starSingle, PLAY_MODES.starDouble].some(modeId => {
    const raw = safeGetStorageItem(getSavedGameKey(modeId));
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      const cells = saved?.starLineSession?.gridData || saved?.gridData;
      return Array.isArray(cells) && cells.some(cell => cell?.isStarred || cell?.isMarkedX);
    } catch {
      return false;
    }
  });
}

function shouldSkipForExistingPlayer(progressV2) {
  return safeGetStorageItem(LEGACY_STAR_LINE_BASIC_KEY) !== null
    || hasMeaningfulProgress(progressV2)
    || hasMeaningfulLegacyProgress()
    || hasSavedStarLineSession();
}

export function resolveStarLineOperationStep(storedStep, gridData) {
  const { operation } = STAR_LINE_TUTORIAL_CONTRACT;
  const cell = idx => gridData?.[idx] || {};
  if (!cell(operation.tapX).isMarkedX || cell(operation.tapX).isStarred) return 1;

  if (storedStep >= 4) return cell(operation.firstStar).isStarred ? 5 : 4;

  const path = operation.addDragPath;
  const pathAllX = path.every(idx => cell(idx).isMarkedX && !cell(idx).isStarred);
  if (pathAllX) return 3;
  return 2;
}

export function resolveStarLineRuleStep(storedStep, gridData) {
  const { operation, rules } = STAR_LINE_TUTORIAL_CONTRACT;
  const cell = idx => gridData?.[idx] || {};
  const isStar = idx => Boolean(cell(idx).isStarred);
  const isX = idx => Boolean(cell(idx).isMarkedX) && !cell(idx).isStarred;
  const allX = indexes => indexes.every(isX);

  if (!isStar(operation.firstStar)) return 0;
  if (!allX(rules.firstRowDoneX)) return 1;
  if (!allX(rules.starColumnDoneX)) return 2;
  if (!isStar(rules.secondStar)) return 3;
  if (!allX(rules.greenRegionDoneX)) return 4;
  if (storedStep <= 5) return 5;
  if (!isStar(rules.thirdStar)) return 6;
  if (!allX(rules.thirdColumnDoneX)) return 7;
  if (!isStar(rules.fourthStar)) return 8;
  if (!allX(rules.tailDoneX)) return 9;
  if (!isStar(rules.finalStar)) return 10;
  return 11;
}

export function canSafelyReplayStarLineGuide(gridData) {
  return Array.isArray(gridData)
    && gridData.length > 0
    && gridData.every(cell => !cell?.isStarred && !cell?.isMarkedX);
}

export default function useStarLineGuide(progressV2) {
  const [guidance, setGuidance] = useState(() => (
    readStoredGuidance()
    || (shouldSkipForExistingPlayer(progressV2) ? createSkippedGuidance() : createFreshGuidance())
  ));

  useEffect(() => {
    safeSetStorageItem(STAR_LINE_GUIDANCE_KEY, JSON.stringify(guidance));
  }, [guidance]);

  const setOperationStep = useCallback((step) => {
    setGuidance(prev => ({
      ...prev,
      operation: { completed: false, step: Math.min(4, Math.max(1, step)) },
    }));
  }, []);

  const completeOperation = useCallback(() => {
    setGuidance(prev => ({
      ...prev,
      operation: { completed: true, step: 4 },
      replayRequested: false,
    }));
  }, []);

  const setRuleStep = useCallback((step) => {
    setGuidance(prev => ({
      ...prev,
      rules: { completed: false, step: Math.min(10, Math.max(1, step)) },
    }));
  }, []);

  const completeRules = useCallback(() => {
    setGuidance(prev => ({
      ...prev,
      rules: { completed: true, step: 10 },
    }));
  }, []);

  const advanceRules = useCallback(() => {
    setGuidance(prev => {
      return {
        ...prev,
        rules: { completed: false, step: Math.min(10, prev.rules.step + 1) },
      };
    });
  }, []);

  const returnToStarPlacement = useCallback(() => {
    setGuidance(prev => ({
      ...prev,
      operation: { completed: false, step: 4 },
      replayRequested: false,
    }));
  }, []);

  const requestReplay = useCallback(() => {
    setGuidance(prev => ({ ...prev, replayRequested: true }));
  }, []);

  const beginReplay = useCallback(() => {
    setGuidance(prev => ({
      ...prev,
      operation: { completed: false, step: 1 },
      replayRequested: true,
    }));
  }, []);

  const actions = useMemo(() => ({
    setOperationStep,
    completeOperation,
    setRuleStep,
    completeRules,
    advanceRules,
    returnToStarPlacement,
    requestReplay,
    beginReplay,
  }), [advanceRules, beginReplay, completeOperation, completeRules, requestReplay, returnToStarPlacement, setOperationStep, setRuleStep]);

  return { guidance, actions };
}
