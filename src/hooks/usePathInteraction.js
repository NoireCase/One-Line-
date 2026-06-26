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
import { createActivePortal, getPortalExitIndex, isPortal2Complete } from '../game/portal/portalRules.js';

export default function usePathInteraction({
  inputMode,
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
  lastProcessedRef,
  markLost,
  onComplete
}) {
  const isDraggingRef = useRef(false);
  const feedbackIdRef = useRef(0);
  const pathRef = useRef(path);
  pathRef.current = path;
  const activePortalRef = useRef(activePortal);
  activePortalRef.current = activePortal;

  const processCellInteraction = useCallback((index) => {
    if (isPathCompleting) return;
    const latestPath = pathRef.current;
    const currentTip = latestPath[latestPath.length - 1];
    const latestActivePortal = activePortalRef.current;
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const N = levelConfig.portalLevel?.N || CONFIG[diff].N;
    const rules = resolveRules(levelConfig);
    const isPortal2 = !rules.path.requireSequential;

    if (index === currentTip) return;
    if (latestPath.includes(index)) return;

    // ── Portal 1.0: manual exit connection ──
    if (!isPortal2 && rules.portal) {
      const portalExitRequired = latestActivePortal?.entryIndex === currentTip
        && !latestPath.includes(latestActivePortal.exitIndex);
      const completingActivePortal = portalExitRequired && index === latestActivePortal.exitIndex;

      if (portalExitRequired && !completingActivePortal) return;
      if (!completingActivePortal) {
        if (!canMoveBetween(currentTip, index, N, rules)) return;
        if (hasPathCrossing(latestPath, currentTip, index, N, rules)) return;
      }
    } else {
      // Classic / Portal 2.0: standard adjacency + crossing check
      if (!canMoveBetween(currentTip, index, N, rules)) return;
      if (hasPathCrossing(latestPath, currentTip, index, N, rules)) return;
    }

    const nextVal = latestPath.length + 1;
    const targetCell = gridData[index];
    let canWalkOn;
    if (isPortal2) {
      const allCoinsCollected = levelConfig.portalLevel.targets.every(t => latestPath.includes(t));
      canWalkOn = !targetCell.isObstacle && !(targetCell.isExit && !allCoinsCollected);
    } else {
      canWalkOn = targetCell.val === nextVal;
    }

    if (!canWalkOn) {
      if (isPortal2) {
        if (targetCell.isExit) {
          setWrongFlash(index);
          setTimeout(() => setWrongFlash(null), 400);
        }
        return;
      }
      if (latestPath.includes(index) || targetCell.isExcluded) return;

      if (!targetCell.isHidden || targetCell.isRevealed) {
        if (wrongFlash !== index) {
          setWrongFlash(index);
          setTimeout(() => setWrongFlash(null), 300);
        }
        setBreakPoints(prev => new Set([...prev, latestPath.length]));
        const { streak: fStreak } = computeComboState(comboStreak, maxComboStreak, 'failure');
        setComboStreak(fStreak);
        return;
      }

      playErrorTone();
      setWrongFlash(index);
      setTimeout(() => setWrongFlash(null), 300);
      setBreakPoints(prev => new Set([...prev, latestPath.length]));

      const { streak: fStreak2 } = computeComboState(comboStreak, maxComboStreak, 'failure');
      setComboStreak(fStreak2);

      setHp(h => {
        const newHp = h - 1;
        if (newHp <= 0) markLost();
        return newHp;
      });
      return;
    }

    // ── walkable: apply the move ──
    if (pendingVisualBreak) {
      setBreakPoints(prev => new Set([...prev, latestPath.length]));
      setPendingVisualBreak(false);
    }
    if (!timerRunning) setTimerRunning(true);

    // Portal 2.0 auto-teleport: find exit cell
    let teleportExit = -1;
    if (isPortal2 && targetCell.portalId) {
      const candidate = getPortalExitIndex(index, gridData);
      if (candidate >= 0 && !latestPath.includes(candidate)) {
        teleportExit = candidate;
      }
    }

    let nextPath = [...latestPath, index];
    if (teleportExit >= 0) {
      nextPath = [...nextPath, teleportExit];
      setBreakPoints(prev => new Set([...prev, nextPath.length - 1]));
    }
    pathRef.current = nextPath;
    setPath(nextPath);

    const wasHidden = targetCell.isHidden && !targetCell.isRevealed;

    setGridData(prev => {
      let nd = [...prev];
      nd[index] = { ...nd[index], isRevealed: true, isExcluded: false };
      if (teleportExit >= 0) {
        nd[teleportExit] = { ...nd[teleportExit], isRevealed: true };
      }
      return nd;
    });

    const { streak: newStreak, max: newMax } = computeComboState(comboStreak, maxComboStreak, 'success');
    setComboStreak(newStreak);
    setMaxComboStreak(newMax);

    const displayIdx = teleportExit >= 0 ? teleportExit : index;
    setLastConnectedIndex(displayIdx);
    if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
    connectedPulseTimeoutRef.current = setTimeout(() => setLastConnectedIndex(null), 320);

    if (!isPortal2) {
      const fbIdx = teleportExit >= 0 ? teleportExit : index;
      const feedbackRow = Math.floor(fbIdx / N);
      const feedbackCol = fbIdx % N;
      const feedbackId = `connection-${++feedbackIdRef.current}`;
      setConnectionFeedback({
        id: feedbackId,
        label: teleportExit >= 0 ? '↗' : '+1',
        milestone: false,
        style: {
          left: `${((feedbackCol + 0.5) / N) * 100}%`,
          top: `${((feedbackRow + 0.24) / N) * 100}%`
        }
      });
      setTimeout(() => {
        setConnectionFeedback(current => current?.id === feedbackId ? null : current);
      }, prefersReducedMotion ? 260 : 620);
    }

    if (isPortal2) {
      activePortalRef.current = null;
      setActivePortal(null);
    } else if (rules.portal) {
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
    const complete = isPortal2
      ? isPortal2Complete(nextPath, levelConfig.portalLevel)
      : isPathComplete(nextPath, N);
    if (complete) {
      playVictoryChime();
      setIsDragging(false);
      setIsPathCompleting(true);
      completionTimeoutRef.current = setTimeout(() => {
        completionTimeoutRef.current = null;
        onComplete(nextPath, newMax);
      }, prefersReducedMotion ? 140 : 900);
    }
  }, [
    activePortal, comboStreak, completionTimeoutRef, connectedPulseTimeoutRef,
    diff, gridData, isPathCompleting, levelIdx, markLost, maxComboStreak,
    onComplete, path, pendingVisualBreak, playMode, prefersReducedMotion,
    scoreRef, setActivePortal, setBreakPoints, setComboStreak,
    setConnectionFeedback, setGridData, setHp, setIsDragging,
    setIsPathCompleting, setLastConnectedIndex, setMaxComboStreak,
    setPath, setPendingVisualBreak, setScore, setTimerRunning, setWrongFlash,
    timerRunning, wrongFlash
  ]);

  useEffect(() => {
    if (inputMode !== 'keyboard' || status !== 'playing') return;

    let active = { up: false, down: false, left: false, right: false };
    let moveTimer = null;

    const resolveDirection = () => {
      const v = active.up && !active.down ? 'up' : !active.up && active.down ? 'down' : null;
      const h = active.left && !active.right ? 'left' : !active.left && active.right ? 'right' : null;
      if (v === 'up' && h === 'left') return [-1, -1];
      if (v === 'up' && h === 'right') return [-1, 1];
      if (v === 'down' && h === 'left') return [1, -1];
      if (v === 'down' && h === 'right') return [1, 1];
      if (v === 'up') return [-1, 0];
      if (v === 'down') return [1, 0];
      if (h === 'left') return [0, -1];
      if (h === 'right') return [0, 1];
      return null;
    };

    const attemptMove = (dir) => {
      if (!dir) return;
      const head = path[path.length - 1];
      if (head == null) return;
      const levelConfig = createLevelConfig(diff, levelIdx, playMode);
      const N = levelConfig.portalLevel?.N || CONFIG[diff]?.N || 5;
      const row = Math.floor(head / N);
      const col = head % N;
      const nr = row + dir[0];
      const nc = col + dir[1];
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
      const targetIdx = nr * N + nc;
      if (path.length > 1 && targetIdx === path[path.length - 2]) return;
      processCellInteraction(targetIdx);
    };

    const scheduleMove = () => {
      if (moveTimer) clearTimeout(moveTimer);
      const dir = resolveDirection();
      if (!dir) return;
      moveTimer = setTimeout(() => {
        moveTimer = null;
        const finalDir = resolveDirection();
        if (finalDir) attemptMove(finalDir);
      }, 50);
    };

    const handleKeyDown = (e) => {
      if (e.repeat) return;
      switch (e.key) {
        case 'w': case 'W': active.up = true; e.preventDefault(); break;
        case 'a': case 'A': active.left = true; e.preventDefault(); break;
        case 's': case 'S': active.down = true; e.preventDefault(); break;
        case 'd': case 'D': active.right = true; e.preventDefault(); break;
        default: return;
      }
      if (active.up && active.down) { active.up = false; active.down = false; }
      if (active.left && active.right) { active.left = false; active.right = false; }
      scheduleMove();
    };

    const handleKeyUp = (e) => {
      switch (e.key) {
        case 'w': case 'W': active.up = false; break;
        case 'a': case 'A': active.left = false; break;
        case 's': case 'S': active.down = false; break;
        case 'd': case 'D': active.right = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (moveTimer) clearTimeout(moveTimer);
    };
  }, [diff, inputMode, levelIdx, path, playMode, processCellInteraction, status]);

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
    }
  }, [getCellIndexFromEvent, setIsDragging, setWrongFlash, status]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || status !== 'playing') return;
    const idx = getCellIndexFromEvent(e);
    if (idx !== null && idx !== lastProcessedRef.current) {
      processCellInteraction(idx);
      lastProcessedRef.current = idx;
    }
  }, [getCellIndexFromEvent, isDragging, lastProcessedRef, processCellInteraction, status]);

  const handlePointerUp = useCallback(() => {
    if (isDragging && pathRef.current.length > 0) {
      setPendingVisualBreak(true);
    }
    setIsDragging(false);
    lastProcessedRef.current = null;
  }, [isDragging, setIsDragging, setPendingVisualBreak]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
}
