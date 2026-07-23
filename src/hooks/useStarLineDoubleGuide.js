import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeGetStorageItem, safeSetStorageItem } from '../utils/safeStorage.js';
import {
  resolveStarLineDoubleTutorialCells,
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
} from '../game/starLine/starLineDoubleTutorialContract.js';

export const STAR_LINE_DOUBLE_GUIDANCE_KEY = 'cg_star_line_double_guidance_v1';
export const LEGACY_STAR_LINE_DOUBLE_GUIDE_KEY = 'cg_discovery_star_line_double_star_v1';

const GUIDANCE_VERSION = 2;
const FINAL_STEP = STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.steps.length;

const createFreshGuidance = () => ({
  version: GUIDANCE_VERSION,
  completed: false,
  step: 1,
  replayRequested: false,
});

const createSkippedGuidance = () => ({
  version: GUIDANCE_VERSION,
  completed: true,
  step: FINAL_STEP,
  replayRequested: false,
});

function normalizeGuidance(value) {
  if (!value || value.version !== GUIDANCE_VERSION) return null;
  return {
    version: GUIDANCE_VERSION,
    completed: Boolean(value.completed),
    step: Math.min(FINAL_STEP, Math.max(1, Number(value.step) || 1)),
    replayRequested: Boolean(value.replayRequested),
  };
}

function readStoredGuidance() {
  const raw = safeGetStorageItem(STAR_LINE_DOUBLE_GUIDANCE_KEY);
  if (!raw) return null;
  try {
    return normalizeGuidance(JSON.parse(raw));
  } catch {
    return null;
  }
}

function cellMatchesAction(cell, action) {
  if (action === 'place-stars') return Boolean(cell?.isStarred) && !cell?.isMarkedX;
  return Boolean(cell?.isMarkedX) && !cell?.isStarred;
}

export function resolveStarLineDoubleGuideStep(storedStep, gridData) {
  const stepNumber = Math.min(FINAL_STEP, Math.max(1, Number(storedStep) || 1));
  const step = STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.steps[stepNumber - 1];
  if (!step || step.type === 'explain') return stepNumber;

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

export default function useStarLineDoubleGuide() {
  const [guidance, setGuidance] = useState(() => (
    readStoredGuidance()
    || (safeGetStorageItem(LEGACY_STAR_LINE_DOUBLE_GUIDE_KEY) !== null
      ? createSkippedGuidance()
      : createFreshGuidance())
  ));

  useEffect(() => {
    safeSetStorageItem(STAR_LINE_DOUBLE_GUIDANCE_KEY, JSON.stringify(guidance));
  }, [guidance]);

  const setStep = useCallback((step) => {
    setGuidance(prev => ({
      ...prev,
      completed: false,
      step: Math.min(FINAL_STEP, Math.max(1, step)),
    }));
  }, []);

  const advance = useCallback(() => {
    setGuidance(prev => ({
      ...prev,
      completed: false,
      step: Math.min(FINAL_STEP, prev.step + 1),
    }));
  }, []);

  const complete = useCallback(() => {
    setGuidance({
      version: GUIDANCE_VERSION,
      completed: true,
      step: FINAL_STEP,
      replayRequested: false,
    });
  }, []);

  const requestReplay = useCallback(() => {
    setGuidance(prev => {
      if (!prev.completed || prev.replayRequested) return prev;
      return { ...prev, replayRequested: true };
    });
  }, []);

  const beginReplay = useCallback(() => {
    setGuidance({
      version: GUIDANCE_VERSION,
      completed: false,
      step: 1,
      replayRequested: true,
    });
  }, []);

  const actions = useMemo(() => ({
    setStep,
    advance,
    complete,
    requestReplay,
    beginReplay,
  }), [advance, beginReplay, complete, requestReplay, setStep]);

  return { guidance, actions };
}
