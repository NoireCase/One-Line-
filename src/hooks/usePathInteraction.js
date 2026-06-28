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
  setTargetFlash,
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
  containerRef,
  markLost,
  showToast,
  onComplete
}) {
  const isDraggingRef = useRef(false);
  const feedbackIdRef = useRef(0);
  const pathRef = useRef(path);
  pathRef.current = path;
  const activePortalRef = useRef(activePortal);
  activePortalRef.current = activePortal;
  const portal2LastDragCommitRef = useRef(null);

  const getPortal2LegalNextMoves = useCallback((latestPath, levelConfig, rules, N) => {
    const currentTip = latestPath[latestPath.length - 1];
    const portalLevel = levelConfig.portalLevel;
    if (!portalLevel || currentTip == null) return [];

    const pathSet = new Set(latestPath);
    const allCoinsCollected = portalLevel.targets.every(t => pathSet.has(t));

    return gridData
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell, index }) => {
        if (index === currentTip) return false;
        if (pathSet.has(index)) return false;
        if (!canMoveBetween(currentTip, index, N, rules)) return false;
        if (hasPathCrossing(latestPath, currentTip, index, N, rules)) return false;
        if (cell.isObstacle) return false;

        if (cell.isExit && !allCoinsCollected) {
          return true;
        }

        if (cell.portalId) {
          const exitIndex = getPortalExitIndex(index, gridData);
          return exitIndex >= 0 && !pathSet.has(exitIndex);
        }

        return true;
      })
      .map(({ index }) => index);
  }, [gridData]);

  const maybeShowPortal2StuckHint = useCallback((nextPath, levelConfig, rules, N) => {
    if (!levelConfig.portalLevel || isPortal2Complete(nextPath, levelConfig.portalLevel)) return;
    const legalMoves = getPortal2LegalNextMoves(nextPath, levelConfig, rules, N);
    if (legalMoves.length > 0) return;

    showToast?.('这条路走不通，换个顺序试试。');
  }, [getPortal2LegalNextMoves, showToast]);

  const flashInvalidCell = useCallback((index, duration = 260) => {
    setWrongFlash(index);
    setTimeout(() => setWrongFlash(null), duration);
  }, [setWrongFlash]);

  const processCellInteraction = useCallback((index) => {
    if (isPathCompleting) return false;
    const latestPath = pathRef.current;
    const currentTip = latestPath[latestPath.length - 1];
    const latestActivePortal = activePortalRef.current;
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const N = levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || CONFIG[diff].N;
    const rules = resolveRules(levelConfig);
    const isPortal2 = !rules.path.requireSequential;

    if (index === currentTip) return false;
    if (latestPath.includes(index)) {
      return false;
    }

    // ── Portal 1.0: manual exit connection ──
    if (!isPortal2 && rules.portal) {
      const portalExitRequired = latestActivePortal?.entryIndex === currentTip
        && !latestPath.includes(latestActivePortal.exitIndex);
      const completingActivePortal = portalExitRequired && index === latestActivePortal.exitIndex;

      if (portalExitRequired && !completingActivePortal) return false;
      if (!completingActivePortal) {
        if (!canMoveBetween(currentTip, index, N, rules)) return false;
        if (hasPathCrossing(latestPath, currentTip, index, N, rules)) return false;
      }
    } else {
      // Classic / Portal 2.0: standard adjacency + crossing check
      if (!canMoveBetween(currentTip, index, N, rules)) return false;
      if (hasPathCrossing(latestPath, currentTip, index, N, rules)) {
        if (isPortal2) flashInvalidCell(index);
        return false;
      }
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
          const missingTargets = levelConfig.portalLevel.targets.filter(t => !latestPath.includes(t));
          if (missingTargets.length > 0) {
            setTargetFlash?.(missingTargets);
            showToast?.(missingTargets.length === 1 ? '还差 1 个金币' : `还差 ${missingTargets.length} 个金币`);
            setTimeout(() => setTargetFlash?.([]), 700);
          }
          flashInvalidCell(index, 400);
        } else {
          flashInvalidCell(index);
        }
        return false;
      }
      if (latestPath.includes(index) || targetCell.isExcluded) return false;

      if (!targetCell.isHidden || targetCell.isRevealed) {
        if (wrongFlash !== index) {
          setWrongFlash(index);
          setTimeout(() => setWrongFlash(null), 300);
        }
        setBreakPoints(prev => new Set([...prev, latestPath.length]));
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
        const newHp = h - 1;
        if (newHp <= 0) markLost();
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
    } else if (isPortal2) {
      maybeShowPortal2StuckHint(nextPath, levelConfig, rules, N);
    }
    return true;
  }, [
    activePortal, comboStreak, completionTimeoutRef, connectedPulseTimeoutRef,
    diff, flashInvalidCell, gridData, isPathCompleting, levelIdx, markLost, maxComboStreak,
    maybeShowPortal2StuckHint, onComplete, path, pendingVisualBreak, playMode, prefersReducedMotion,
    scoreRef, setActivePortal, setBreakPoints, setComboStreak,
    setConnectionFeedback, setGridData, setHp, setIsDragging,
    setIsPathCompleting, setLastConnectedIndex, setMaxComboStreak,
    setPath, setPendingVisualBreak, setScore, setTimerRunning, setWrongFlash,
    timerRunning, wrongFlash, setTargetFlash, showToast
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
      const N = levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || CONFIG[diff]?.N || 5;

      // Portal 1.0: when active portal requires exit, redirect any direction input to exit
      const active = activePortalRef.current;
      if (active?.entryIndex === head) {
        processCellInteraction(active.exitIndex);
        return;
      }

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
        const levelConfig = createLevelConfig(diff, levelIdx, playMode);
        if (levelConfig.rules.id !== 'portal2') {
          setPendingVisualBreak(true);
        }
      }
      setIsDragging(false);
      lastProcessedRef.current = null;
      portal2LastDragCommitRef.current = null;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [diff, lastProcessedRef, levelIdx, playMode, setIsDragging, setPendingVisualBreak]);

  const getCellIndexFromEvent = useCallback((e) => {
    const touch = e.touches ? e.touches[0] : e;
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const rules = resolveRules(levelConfig);
    const isPortal2 = !rules.path.requireSequential;

    if (isPortal2 && containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const N = levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || CONFIG[diff]?.N || 5;
      const cellSize = rect.width / N;
      const tolerance = cellSize * 0.24;
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (x < -tolerance || y < -tolerance || x > rect.width + tolerance || y > rect.height + tolerance) {
        return null;
      }

      const clampedX = Math.max(0, Math.min(rect.width - 1, x));
      const clampedY = Math.max(0, Math.min(rect.height - 1, y));
      const col = Math.floor(clampedX / cellSize);
      const row = Math.floor(clampedY / cellSize);
      return row * N + col;
    }

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
  }, [containerRef, diff, levelIdx, playMode]);

  const getPortal2MoveSequence = useCallback((fromIndex, toIndex) => {
    if (fromIndex == null || toIndex == null || fromIndex === toIndex) return [];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const rules = resolveRules(levelConfig);
    if (rules.path.requireSequential) return [toIndex];

    const N = levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || CONFIG[diff]?.N || 5;
    const fromRow = Math.floor(fromIndex / N);
    const fromCol = fromIndex % N;
    const toRow = Math.floor(toIndex / N);
    const toCol = toIndex % N;
    const dRow = toRow - fromRow;
    const dCol = toCol - fromCol;
    const aligned = dRow === 0 || dCol === 0 || Math.abs(dRow) === Math.abs(dCol);
    if (!aligned) return [toIndex];

    const stepRow = Math.sign(dRow);
    const stepCol = Math.sign(dCol);
    const steps = Math.max(Math.abs(dRow), Math.abs(dCol));
    const sequence = [];
    for (let step = 1; step <= steps; step++) {
      sequence.push((fromRow + stepRow * step) * N + (fromCol + stepCol * step));
    }
    return sequence;
  }, [diff, levelIdx, playMode]);

  const getPortal2AdjacentHitIndexFromEvent = useCallback((e, hitboxScale = 0.12) => {
    if (!containerRef?.current) return null;

    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    if (levelConfig.rules.id !== 'portal2') return null;

    const currentTip = pathRef.current[pathRef.current.length - 1];
    if (currentTip == null) return null;

    const touch = e.touches ? e.touches[0] : e;
    const rect = containerRef.current.getBoundingClientRect();
    const N = levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || CONFIG[diff]?.N || 5;
    const cellSize = rect.width / N;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const tolerance = cellSize * hitboxScale;

    if (x < -tolerance || y < -tolerance || x > rect.width + tolerance || y > rect.height + tolerance) {
      return null;
    }

    const lastCommit = portal2LastDragCommitRef.current;
    if (lastCommit && Math.hypot(touch.clientX - lastCommit.x, touch.clientY - lastCommit.y) < cellSize * 0.18) {
      return null;
    }

    const tipRow = Math.floor(currentTip / N);
    const tipCol = currentTip % N;
    const candidates = [];

    for (let dRow = -1; dRow <= 1; dRow++) {
      for (let dCol = -1; dCol <= 1; dCol++) {
        if (dRow === 0 && dCol === 0) continue;

        const row = tipRow + dRow;
        const col = tipCol + dCol;
        if (row < 0 || row >= N || col < 0 || col >= N) continue;

        const isDiagonalNeighbor = dRow !== 0 && dCol !== 0;
        const candidateTolerance = isDiagonalNeighbor ? tolerance : tolerance * 0.4;
        const left = col * cellSize - candidateTolerance;
        const right = (col + 1) * cellSize + candidateTolerance;
        const top = row * cellSize - candidateTolerance;
        const bottom = (row + 1) * cellSize + candidateTolerance;
        if (x < left || x > right || y < top || y > bottom) continue;

        const centerX = (col + 0.5) * cellSize;
        const centerY = (row + 0.5) * cellSize;
        const distance = Math.hypot(x - centerX, y - centerY);
        const index = row * N + col;

        if (!isDiagonalNeighbor && hitboxScale <= 0.12) {
          const minDepth = cellSize * 0.24;
          if (dCol === 1 && x < col * cellSize + minDepth) continue;
          if (dCol === -1 && x > (col + 1) * cellSize - minDepth) continue;
          if (dRow === 1 && y < row * cellSize + minDepth) continue;
          if (dRow === -1 && y > (row + 1) * cellSize - minDepth) continue;
        }

        candidates.push({ index, distance });
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].index;
  }, [containerRef, diff, levelIdx, playMode]);

  const handlePointerDown = useCallback((e) => {
    if (status !== 'playing') return;
    resumeAudioContext();
    const idx = getCellIndexFromEvent(e);
    const tip = pathRef.current[pathRef.current.length - 1];
    if (idx !== null && idx === tip) {
      e.target.releasePointerCapture?.(e.pointerId);
      setWrongFlash(null);
      setIsDragging(true);
      portal2LastDragCommitRef.current = null;
      lastProcessedRef.current = idx;
      return;
    }

    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const isPortal2 = levelConfig.rules.id === 'portal2';
    const portal2Idx = isPortal2 ? getPortal2AdjacentHitIndexFromEvent(e, 0.22) : idx;
    if (portal2Idx !== null && isPortal2) {
      e.target.releasePointerCapture?.(e.pointerId);
      setWrongFlash(null);
      portal2LastDragCommitRef.current = null;
      const moved = processCellInteraction(portal2Idx);
      if (moved) {
        setIsDragging(true);
        lastProcessedRef.current = pathRef.current[pathRef.current.length - 1];
      }
    }
  }, [
    diff, getCellIndexFromEvent, getPortal2AdjacentHitIndexFromEvent, lastProcessedRef,
    levelIdx, playMode, processCellInteraction, setIsDragging, setWrongFlash, status
  ]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || status !== 'playing') return;
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const isPortal2 = levelConfig.rules.id === 'portal2';
    const idx = isPortal2 ? getPortal2AdjacentHitIndexFromEvent(e, 0.12) : getCellIndexFromEvent(e);
    if (idx !== null && idx !== lastProcessedRef.current) {
      const sequence = isPortal2
        ? [idx]
        : getPortal2MoveSequence(pathRef.current[pathRef.current.length - 1], idx);
      for (const candidate of sequence) {
        if (candidate === lastProcessedRef.current) continue;
        const moved = processCellInteraction(candidate);
        if (isPortal2 && moved) {
          const touch = e.touches ? e.touches[0] : e;
          portal2LastDragCommitRef.current = { x: touch.clientX, y: touch.clientY };
        }
        lastProcessedRef.current = moved ? pathRef.current[pathRef.current.length - 1] : candidate;
        if (!moved) break;
      }
    }
  }, [
    diff, getCellIndexFromEvent, getPortal2AdjacentHitIndexFromEvent, getPortal2MoveSequence,
    isDragging, lastProcessedRef, levelIdx, playMode, processCellInteraction, status
  ]);

  const handlePointerUp = useCallback(() => {
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const isPortal2 = levelConfig.rules.id === 'portal2';
    if (isDragging && pathRef.current.length > 0 && !isPortal2) {
      setPendingVisualBreak(true);
    }
    setIsDragging(false);
    lastProcessedRef.current = null;
    portal2LastDragCommitRef.current = null;
  }, [diff, isDragging, levelIdx, playMode, setIsDragging, setPendingVisualBreak]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
}
