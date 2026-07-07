import { useState, useCallback, useMemo } from 'react';
import { evaluateStarLineBoard } from '../game/starLine/starLineRules.js';

const EMPTY_STATE = { isComplete: false, hasConflicts: false, conflicts: [], conflictCells: new Set(), conflictTypes: {}, countExceeded: false, placedCount: 0, targetCount: 0 };

export default function useStarLineInteraction(level, initialGridData, resetKey = 0) {
  const stateKey = `${level?.id ?? 'none'}:${resetKey}`;
  const baseGridData = useMemo(() => initialGridData || [], [initialGridData]);
  const [gridState, setGridState] = useState(() => ({
    key: stateKey,
    gridData: baseGridData
  }));

  const gridData = gridState.key === stateKey ? gridState.gridData : baseGridData;

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

  const handleStarLineCellToggle = useCallback((idx, tool) => {
    setGridData(prev => {
      const next = prev.map((cell, i) => {
        if (i !== idx) return cell;
        if (!cell) return cell;
        if (tool === 'star') {
          return { ...cell, isStarred: !cell.isStarred, isMarkedX: false };
        }
        if (tool === 'x') {
          return { ...cell, isStarred: false, isMarkedX: !cell.isMarkedX };
        }
        return { ...cell, isStarred: false, isMarkedX: false };
      });
      return next;
    });
  }, [setGridData]);

  return { gridData, starLineState, starIndexes, handleStarLineCellToggle, setGridData };
}
