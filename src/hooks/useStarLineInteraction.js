import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { evaluateStarLineBoard } from '../game/starLine/starLineRules.js';

const EMPTY_STATE = { isComplete: false, hasConflicts: false, conflicts: [], conflictCells: new Set(), conflictTypes: {}, countExceeded: false, placedCount: 0, targetCount: 0 };
const MAX_HISTORY = 20;

export default function useStarLineInteraction(level, initialGridData, resetKey = 0) {
  const stateKey = `${level?.id ?? 'none'}:${resetKey}`;
  const baseGridData = useMemo(() => initialGridData || [], [initialGridData]);
  const [gridState, setGridState] = useState(() => ({
    key: stateKey,
    gridData: baseGridData
  }));

  const gridData = gridState.key === stateKey ? gridState.gridData : baseGridData;
  const gridDataRef = useRef(gridData);
  gridDataRef.current = gridData;

  const setGridData = useCallback((updater) => {
    setGridState(prev => {
      const currentGrid = prev.key === stateKey ? prev.gridData : baseGridData;
      const nextGrid = typeof updater === 'function' ? updater(currentGrid) : updater;
      return { key: stateKey, gridData: nextGrid || [] };
    });
  }, [baseGridData, stateKey]);

  const starIndexes = useMemo(() => {
    const indexes = [];
    (gridData || []).forEach((cell, idx) => {
      if (cell?.isStarred) indexes.push(idx);
    });
    return indexes;
  }, [gridData]);

  const starLineState = useMemo(() => {
    if (!level) return EMPTY_STATE;
    const quota = level?.starsPerRow ?? level?.starsPerCol ?? level?.starsPerRegion ?? 1;
    return evaluateStarLineBoard(level.N, level.regions, starIndexes, quota);
  }, [level, starIndexes]);

  // ── 撤销历史 ──
  const [canUndo, setCanUndo] = useState(false);
  const historyRef = useRef([]);
  const pendingBatchRef = useRef(null);

  const updateCanUndo = useCallback(() => {
    const can = historyRef.current.length > 0;
    setCanUndo(can);
  }, []);

  // 重置时清空历史
  useEffect(() => {
    historyRef.current = [];
    pendingBatchRef.current = null;
    setCanUndo(false);
  }, [resetKey]);

  // 通关时外部主动清空历史（解决 isComplete 仅禁用按钮但未清空 ref 的问题）
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    pendingBatchRef.current = null;
    setCanUndo(false);
  }, []);

  const commitBatch = useCallback(() => {
    const batch = pendingBatchRef.current;
    if (batch && batch.length > 0) {
      historyRef.current.push(batch);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      updateCanUndo();
    }
    pendingBatchRef.current = null;
  }, [updateCanUndo]);

  const beginBatch = useCallback(() => {
    if (!pendingBatchRef.current) {
      pendingBatchRef.current = [];
    }
  }, []);

  const setCellMarkState = useCallback((idx, { isStarred, isMarkedX }) => {
    const currentGrid = gridDataRef.current;
    const currentCell = currentGrid[idx];
    if (!currentCell) return false;

    const nextStarred = Boolean(isStarred);
    const nextMarkedX = nextStarred ? false : Boolean(isMarkedX);
    const prevStarred = Boolean(currentCell.isStarred);
    const prevMarkedX = Boolean(currentCell.isMarkedX);

    if (prevStarred === nextStarred && prevMarkedX === nextMarkedX) return false;

    const change = { idx, prevStarred, prevMarkedX };
    if (pendingBatchRef.current) {
      if (!pendingBatchRef.current.some(c => c.idx === idx)) {
        pendingBatchRef.current.push(change);
      }
    } else {
      historyRef.current.push([change]);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      setCanUndo(true);
    }

    const nextGrid = currentGrid.map((cell, cellIdx) => (
      cellIdx === idx
        ? { ...cell, isStarred: nextStarred, isMarkedX: nextMarkedX }
        : cell
    ));
    gridDataRef.current = nextGrid;
    setGridData(nextGrid);
    return true;
  }, [setGridData]);

  const getCellState = useCallback((idx) => gridDataRef.current[idx] || null, []);
  const setCellExcluded = useCallback((idx) => (
    setCellMarkState(idx, { isStarred: false, isMarkedX: true })
  ), [setCellMarkState]);
  const clearCell = useCallback((idx) => (
    setCellMarkState(idx, { isStarred: false, isMarkedX: false })
  ), [setCellMarkState]);
  const setCellStar = useCallback((idx) => (
    setCellMarkState(idx, { isStarred: true, isMarkedX: false })
  ), [setCellMarkState]);

  const cellActions = useMemo(() => ({
    getCellState,
    setCellExcluded,
    clearCell,
    setCellStar,
  }), [clearCell, getCellState, setCellExcluded, setCellStar]);

  const undoLast = useCallback(() => {
    const batch = historyRef.current.pop();
    if (!batch || batch.length === 0) {
      historyRef.current = [];
      setCanUndo(false);
      return;
    }
    const nextGrid = [...gridDataRef.current];
    for (const change of batch) {
      if (nextGrid[change.idx]) {
        nextGrid[change.idx] = {
          ...nextGrid[change.idx],
          isStarred: change.prevStarred,
          isMarkedX: change.prevMarkedX,
        };
      }
    }
    gridDataRef.current = nextGrid;
    setGridData(nextGrid);
    setCanUndo(historyRef.current.length > 0);
  }, [setGridData]);

  return {
    gridData,
    starLineState,
    starIndexes,
    cellActions,
    setGridData,
    undoLast,
    canUndo,
    beginBatch,
    commitBatch,
    clearHistory,
  };
}
