import { useCallback, useEffect, useRef } from 'react';
import { computeComboState, getComboMultiplier } from '../config/comboEngine.js';
import { playComboTone, playErrorTone, playVictoryChime, resumeAudioContext } from '../config/soundEngine.js';
import { CONFIG } from '../game/classic/createClassicLevel.js';
import {
  canMoveBetween,
  hasPathCrossing
} from '../game/rules/movement.js';
import { isPathComplete } from '../game/rules/pathCompletion.js';
import { createLevelConfig, resolveRules } from '../game/rules/levelConfig.js';
import {
  createActivePortal
} from '../game/portal/portalRules.js';

export const HIDDEN_LOSS_DELAY_MS = 550;

export default function usePathInteraction({
  prefersReducedMotion,
  playMode,
  diff,
  levelIdx,
  gridData,
  setGridData,
  path,
  setPath,
  pendingVisualBreak,
  setPendingVisualBreak,
  setHp,
  timerRunning,
  setTimerRunning,
  status,
  isDragging,
  setIsDragging,
  wrongFlash,
  setWrongFlash,
  scoreRef,
  comboStreak,
  setComboStreak,
  maxComboStreak,
  setMaxComboStreak,
  setScore,
  setBreakPoints,
  setConnectionFeedback,
  setLastConnectedIndex,
  isPathCompleting,
  setIsPathCompleting,
  activePortal,
  setActivePortal,
  completionTimeoutRef,
  connectedPulseTimeoutRef,
  hiddenLossTimeoutRef,
  hiddenLossPendingRef,
  lastProcessedRef,
  containerRef,
  markLost,
  showToast,
  clearToast,
  onComplete
}) {
  const isDraggingRef = useRef(false);
  const feedbackIdRef = useRef(0);
  const pathRef = useRef(path);
  pathRef.current = path;
  const activePortalRef = useRef(activePortal);
  activePortalRef.current = activePortal;

  const processCellInteraction = useCallback((index) => {
    if (isPathCompleting || hiddenLossPendingRef.current) return false;
    const latestPath = pathRef.current;
    const currentTip = latestPath[latestPath.length - 1];
    const latestActivePortal = activePortalRef.current;
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const N = levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || CONFIG[diff].N;
    const rules = resolveRules(levelConfig);

    const showPathError = (message) => {
      if (wrongFlash !== index) {
        setWrongFlash(index);
        setTimeout(() => setWrongFlash(null), 300);
      }
      setBreakPoints(prev => new Set([...prev, latestPath.length]));
      showToast(message);
    };

    if (index === currentTip) return false;
    if (latestPath.includes(index)) {
      return false;
    }

    // ── Portal 1.0: manual exit connection ──
    if (rules.portal) {
      const portalExitRequired = latestActivePortal?.entryIndex === currentTip
        && !latestPath.includes(latestActivePortal.exitIndex);
      const completingActivePortal = portalExitRequired && index === latestActivePortal.exitIndex;

      if (portalExitRequired && !completingActivePortal) {
        showPathError('请从对应传送门出口继续');
        return false;
      }
      if (!completingActivePortal) {
        if (!canMoveBetween(currentTip, index, N, rules)) {
          showPathError('请从当前路径末端继续');
          return false;
        }
        if (hasPathCrossing(latestPath, currentTip, index, N, rules)) {
          showPathError('请从当前路径末端继续');
          return false;
        }
      }
    } else {
      if (!canMoveBetween(currentTip, index, N, rules)) {
        showPathError('请从当前路径末端继续');
        return false;
      }
      if (hasPathCrossing(latestPath, currentTip, index, N, rules)) {
        showPathError('请从当前路径末端继续');
        return false;
      }
    }

    const nextVal = latestPath.length + 1;
    const targetCell = gridData[index];
    const canWalkOn = targetCell.val === nextVal;

    if (!canWalkOn) {
      if (latestPath.includes(index) || targetCell.isExcluded) return false;

      if (!targetCell.isHidden || targetCell.isRevealed) {
        showPathError('请从当前路径末端继续');
        const { streak: fStreak } = computeComboState(comboStreak, maxComboStreak, 'failure');
        setComboStreak(fStreak);
        return false;
      }

      playErrorTone();
      setWrongFlash(index);
      setTimeout(() => setWrongFlash(null), 300);
      setBreakPoints(prev => new Set([...prev, latestPath.length]));

      const { streak: fStreak2 } = computeComboState(comboStreak, maxComboStreak, 'failure');
      setComboStreak(fStreak2);

      setHp(h => {
        const newHp = Math.max(0, h - 1);
        if (newHp <= 0 && !hiddenLossPendingRef.current) {
          hiddenLossPendingRef.current = true;
          if (hiddenLossTimeoutRef.current) clearTimeout(hiddenLossTimeoutRef.current);
          hiddenLossTimeoutRef.current = setTimeout(() => {
            hiddenLossTimeoutRef.current = null;
            hiddenLossPendingRef.current = false;
            markLost();
          }, HIDDEN_LOSS_DELAY_MS);
        }
        return newHp;
      });
      return false;
    }

    // ── walkable: apply the move ──
    if (pendingVisualBreak) {
      setBreakPoints(prev => new Set([...prev, latestPath.length]));
      setPendingVisualBreak(false);
    }
    if (!timerRunning) setTimerRunning(true);

    let nextPath = [...latestPath, index];
    clearToast();
    pathRef.current = nextPath;
    setPath(nextPath);

    const wasHidden = targetCell.isHidden && !targetCell.isRevealed;

    setGridData(prev => {
      let nd = [...prev];
      nd[index] = { ...nd[index], isRevealed: true, isExcluded: false };
      return nd;
    });

    const { streak: newStreak, max: newMax } = computeComboState(comboStreak, maxComboStreak, 'success');
    setComboStreak(newStreak);
    setMaxComboStreak(newMax);

    setLastConnectedIndex(index);
    if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
    connectedPulseTimeoutRef.current = setTimeout(() => setLastConnectedIndex(null), 320);

    const feedbackRow = Math.floor(index / N);
    const feedbackCol = index % N;
    const feedbackId = `connection-${++feedbackIdRef.current}`;
    setConnectionFeedback({
      id: feedbackId,
      label: '+1',
      milestone: false,
      style: {
        left: `${((feedbackCol + 0.5) / N) * 100}%`,
        top: `${((feedbackRow + 0.24) / N) * 100}%`
      }
    });
    setTimeout(() => {
      setConnectionFeedback(current => current?.id === feedbackId ? null : current);
    }, prefersReducedMotion ? 260 : 620);

    if (rules.portal) {
      const portalExitRequired = latestActivePortal?.entryIndex === currentTip
        && !latestPath.includes(latestActivePortal.exitIndex);
      const completingActivePortal = portalExitRequired && index === latestActivePortal.exitIndex;
      const nextPortal = completingActivePortal ? null : createActivePortal(index, gridData);
      activePortalRef.current = nextPortal;
      setActivePortal(nextPortal);
    } else {
      const multi = getComboMultiplier(newStreak);
      const basePoints = wasHidden ? 30 : 10;
      const earnedPoints = Math.floor(basePoints * multi);
      scoreRef.current += earnedPoints;
      setScore(scoreRef.current);
    }

    playComboTone(newStreak);
    const complete = isPathComplete(nextPath, N);
    if (complete) {
      playVictoryChime();
      setIsDragging(false);
      setIsPathCompleting(true);
      completionTimeoutRef.current = setTimeout(() => {
        completionTimeoutRef.current = null;
        onComplete(nextPath, newMax);
      }, prefersReducedMotion ? 140 : 900);
    }
    return true;
  }, [
    activePortal, comboStreak, completionTimeoutRef, connectedPulseTimeoutRef,
    diff, gridData, isPathCompleting, levelIdx, markLost, maxComboStreak,
    onComplete, path, pendingVisualBreak, playMode, prefersReducedMotion,
    scoreRef, setActivePortal, setBreakPoints, setComboStreak,
    setConnectionFeedback, setGridData, setHp, setIsDragging,
    setIsPathCompleting, setLastConnectedIndex, setMaxComboStreak,
    setPath, setPendingVisualBreak, setScore, setTimerRunning, setWrongFlash,
    clearToast, showToast, timerRunning, wrongFlash
  ]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        setPendingVisualBreak(true);
      }
      setIsDragging(false);
      lastProcessedRef.current = null;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [lastProcessedRef, setIsDragging, setPendingVisualBreak]);

  const getCellIndexFromEvent = useCallback((e) => {
    const touch = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const idxStr = el.getAttribute('data-index');
      if (idxStr != null) {
        const rect = el.getBoundingClientRect();
        const dist = Math.sqrt((touch.clientX - (rect.left + rect.width / 2)) ** 2 + (touch.clientY - (rect.top + rect.height / 2)) ** 2);
        if (dist < Math.min(rect.width, rect.height) * 0.45) return Number(idxStr);
      }
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (status !== 'playing') return;
    resumeAudioContext();
    const idx = getCellIndexFromEvent(e);
    const tip = pathRef.current[pathRef.current.length - 1];
    if (idx !== null && idx === tip) {
      e.target.releasePointerCapture?.(e.pointerId);
      setWrongFlash(null);
      setIsDragging(true);
      lastProcessedRef.current = idx;
      return;
    }
  }, [
    getCellIndexFromEvent, lastProcessedRef, setIsDragging, setWrongFlash, status
  ]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || status !== 'playing') return;
    const idx = getCellIndexFromEvent(e);
    if (idx !== null && idx !== lastProcessedRef.current) {
      const moved = processCellInteraction(idx);
      lastProcessedRef.current = moved ? pathRef.current[pathRef.current.length - 1] : idx;
    }
  }, [
    getCellIndexFromEvent, isDragging, lastProcessedRef, processCellInteraction, status
  ]);

  const handlePointerUp = useCallback(() => {
    if (isDragging && pathRef.current.length > 0) {
      setPendingVisualBreak(true);
    }
    setIsDragging(false);
    lastProcessedRef.current = null;
  }, [isDragging, lastProcessedRef, setIsDragging, setPendingVisualBreak]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
}
