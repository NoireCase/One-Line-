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

  const handleStarLineCellToggle = useCallback((idx, tool) => {
    const currentCell = gridDataRef.current[idx];
    if (!currentCell) return;
    const prevStarred = currentCell.isStarred;
    const prevMarkedX = currentCell.isMarkedX;

    // 提前计算新旧状态
    let newStarred, newMarkedX;
    if (tool === 'star') {
      newStarred = !prevStarred;
      newMarkedX = false;
    } else if (tool === 'x') {
      newStarred = false;
      newMarkedX = !prevMarkedX;
    } else {
      newStarred = false;
      newMarkedX = false;
    }

    // 在 setGridData 之前同步记录历史
    if (prevStarred !== newStarred || prevMarkedX !== newMarkedX) {
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
    }

    setGridData(prev => {
      const cell = prev[idx];
      if (!cell) return prev;
      let nextCell;
      if (tool === 'star') {
        nextCell = { ...cell, isStarred: !cell.isStarred, isMarkedX: false };
      } else if (tool === 'x') {
        nextCell = { ...cell, isStarred: false, isMarkedX: !cell.isMarkedX };
      } else {
        nextCell = { ...cell, isStarred: false, isMarkedX: false };
      }
      return prev.map((c, i) => i === idx ? nextCell : c);
    });
  }, [setGridData]);

  const undoLast = useCallback(() => {
    const batch = historyRef.current.pop();
    if (!batch || batch.length === 0) {
      historyRef.current = [];
      setCanUndo(false);
      return;
    }
    setGridData(prev => {
      const next = [...prev];
      for (const change of batch) {
        if (next[change.idx]) {
          next[change.idx] = { ...next[change.idx], isStarred: change.prevStarred, isMarkedX: change.prevMarkedX };
        }
      }
      return next;
    });
    setCanUndo(historyRef.current.length > 0);
  }, [setGridData]);

  return {
    gridData,
    starLineState,
    starIndexes,
    handleStarLineCellToggle,
    setGridData,
    undoLast,
    canUndo,
    beginBatch,
    commitBatch,
    clearHistory,
  };
}
