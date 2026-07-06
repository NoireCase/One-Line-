import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { evaluateStarLineBoard } from '../game/starLine/starLineRules.js';

const EMPTY_STATE = { isComplete: false, hasConflicts: false, conflicts: [], conflictCells: new Set(), conflictTypes: {}, countExceeded: false, placedCount: 0, targetCount: 0 };

export default function useStarLineInteraction(level, initialGridData, resetKey = 0) {
  const [gridData, setGridData] = useState(initialGridData || []);
  const levelIdRef = useRef(level?.id);
  const resetKeyRef = useRef(resetKey);
  const initialGridRef = useRef(initialGridData);
  initialGridRef.current = initialGridData;

  useEffect(() => {
    const currentId = level?.id;
    const shouldReset = (currentId && currentId !== levelIdRef.current)
      || resetKey !== resetKeyRef.current;
    if (shouldReset && initialGridRef.current?.length > 0) {
      levelIdRef.current = currentId || levelIdRef.current;
      resetKeyRef.current = resetKey;
      setGridData(initialGridRef.current);
    }
  }, [level?.id, resetKey]);

  const starIndexes = useMemo(() => {
    const indexes = [];
    (gridData || []).forEach((cell, idx) => {
      if (cell?.isStarred) indexes.push(idx);
    });
    return indexes;
  }, [gridData]);

  const starLineState = useMemo(() => {
    if (!level) return EMPTY_STATE;
    return evaluateStarLineBoard(level.N, level.regions, starIndexes);
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
  }, []);

  return { gridData, starLineState, starIndexes, handleStarLineCellToggle, setGridData };
}
