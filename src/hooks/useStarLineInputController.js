import { useCallback, useEffect, useRef, useState } from 'react';

export const STAR_LINE_DOUBLE_CLICK_MS = 275;
export const STAR_LINE_DRAG_THRESHOLD_PX = 6;

function createIdlePointer() {
  return {
    active: false,
    pointerId: null,
    startIdx: null,
    startPoint: null,
    lastPoint: null,
    boardRect: null,
    dragging: false,
    dragMode: null,
    visited: new Set(),
    changed: new Set(),
    added: new Set(),
    cleared: new Set(),
    captureTarget: null,
    secondTap: null,
  };
}

function pointToCellIndex(point, boardRect, size) {
  if (!boardRect || size <= 0) return null;
  const localX = point.x - boardRect.left;
  const localY = point.y - boardRect.top;
  if (localX < 0 || localY < 0 || localX >= boardRect.width || localY >= boardRect.height) return null;
  const col = Math.min(size - 1, Math.floor((localX / boardRect.width) * size));
  const row = Math.min(size - 1, Math.floor((localY / boardRect.height) * size));
  return row * size + col;
}

function traceCellIndexes(from, to, boardRect, size, visit) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const cellSpan = Math.min(boardRect.width / size, boardRect.height / size);
  const stepSize = Math.max(2, cellSpan / 4);
  const steps = Math.max(1, Math.ceil(distance / stepSize));

  for (let step = 0; step <= steps; step++) {
    const ratio = step / steps;
    const idx = pointToCellIndex({
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    }, boardRect, size);
    if (idx !== null) visit(idx);
  }
}

function getPointerPoints(event) {
  const nativeEvent = event.nativeEvent || event;
  const coalesced = typeof nativeEvent.getCoalescedEvents === 'function'
    ? nativeEvent.getCoalescedEvents()
    : [];
  const points = coalesced.map(item => ({ x: item.clientX, y: item.clientY }));
  const current = { x: event.clientX, y: event.clientY };
  const last = points[points.length - 1];
  if (!last || last.x !== current.x || last.y !== current.y) points.push(current);
  return points;
}

function getPointerTimestamp(event) {
  const timestamp = Number(event.timeStamp);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : Date.now();
}

export default function useStarLineInputController({
  interactionKey,
  boardSize,
  cellActions,
  beginBatch,
  commitBatch,
  disabled = false,
  onActiveCellChange,
  onCellCleared,
  onGestureComplete,
  canInteractWithCell,
}) {
  const pointerRef = useRef(createIdlePointer());
  const pendingTapRef = useRef(null);
  const [pressedIdx, setPressedIdx] = useState(null);
  const [pendingTapIdx, setPendingTapIdx] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const emitGesture = useCallback((gesture) => {
    onGestureComplete?.({
      ...gesture,
      processedIndexes: [...(gesture.processedIndexes || [])],
      changedIndexes: [...(gesture.changedIndexes || [])],
      addedIndexes: [...(gesture.addedIndexes || [])],
      clearedIndexes: [...(gesture.clearedIndexes || [])],
      starredIndexes: [...(gesture.starredIndexes || [])],
    });
  }, [onGestureComplete]);

  const commitSingleTap = useCallback((idx) => {
    if (canInteractWithCell && !canInteractWithCell(idx)) return;
    const cell = cellActions.getCellState(idx);
    if (!cell) return;

    let changed = false;
    if (cell.isStarred || cell.isMarkedX) {
      changed = cellActions.clearCell(idx);
      if (changed) {
        const clearedKind = cell.isStarred ? 'star' : 'x';
        onCellCleared?.({ idx, kind: clearedKind, source: 'single' });
        emitGesture({
          type: cell.isStarred ? 'single-clear-star' : 'single-clear-x',
          startIdx: idx,
          processedIndexes: [idx],
          changedIndexes: [idx],
          clearedIndexes: [idx],
        });
      }
    } else {
      changed = cellActions.setCellExcluded(idx);
      if (changed) {
        emitGesture({
          type: 'single-add-x',
          startIdx: idx,
          processedIndexes: [idx],
          changedIndexes: [idx],
          addedIndexes: [idx],
        });
      }
    }
    if (changed) onActiveCellChange?.(idx);
  }, [canInteractWithCell, cellActions, emitGesture, onActiveCellChange, onCellCleared]);

  const commitDoubleTap = useCallback((idx) => {
    if (canInteractWithCell && !canInteractWithCell(idx)) return;
    const cell = cellActions.getCellState(idx);
    if (!cell || cell.isStarred) return;
    if (cellActions.setCellStar(idx)) {
      onActiveCellChange?.(idx);
      emitGesture({
        type: cell.isMarkedX ? 'double-x-to-star' : 'double-place-star',
        startIdx: idx,
        processedIndexes: [idx],
        changedIndexes: [idx],
        starredIndexes: [idx],
      });
    }
  }, [canInteractWithCell, cellActions, emitGesture, onActiveCellChange]);

  const detachPendingTap = useCallback(() => {
    const pending = pendingTapRef.current;
    if (!pending) return null;
    window.clearTimeout(pending.timerId);
    pendingTapRef.current = null;
    setPendingTapIdx(null);
    return pending;
  }, []);

  const flushPendingTap = useCallback(() => {
    const pending = detachPendingTap();
    if (pending) commitSingleTap(pending.idx);
  }, [commitSingleTap, detachPendingTap]);

  const scheduleSingleTap = useCallback((idx, releasedAt = Date.now()) => {
    const pending = {
      idx,
      releasedAt,
      timerId: null,
    };
    pending.timerId = window.setTimeout(() => {
      if (pendingTapRef.current !== pending) return;
      pendingTapRef.current = null;
      setPendingTapIdx(null);
      commitSingleTap(idx);
    }, STAR_LINE_DOUBLE_CLICK_MS);
    pendingTapRef.current = pending;
    setPendingTapIdx(idx);
  }, [commitSingleTap]);

  const processDragCell = useCallback((pointer, idx) => {
    if (pointer.visited.has(idx)) return;
    pointer.visited.add(idx);
    if (canInteractWithCell && !canInteractWithCell(idx)) return;
    const cell = cellActions.getCellState(idx);
    if (!cell) return;

    let changed = false;
    if (pointer.dragMode === 'add-x' && !cell.isStarred && !cell.isMarkedX) {
      changed = cellActions.setCellExcluded(idx);
      if (changed) pointer.added.add(idx);
    } else if (pointer.dragMode === 'erase-x' && cell.isMarkedX) {
      changed = cellActions.clearCell(idx);
      if (changed) {
        pointer.cleared.add(idx);
        onCellCleared?.({ idx, kind: 'x', source: 'drag' });
      }
    }
    if (changed) {
      pointer.changed.add(idx);
      onActiveCellChange?.(idx);
    }
  }, [canInteractWithCell, cellActions, onActiveCellChange, onCellCleared]);

  const emitDragGesture = useCallback((pointer) => {
    if (pointer.changed.size === 0) return;
    emitGesture({
      type: pointer.dragMode === 'erase-x' ? 'drag-clear-x' : 'drag-add-x',
      startIdx: pointer.startIdx,
      processedIndexes: pointer.visited,
      changedIndexes: pointer.changed,
      addedIndexes: pointer.added,
      clearedIndexes: pointer.cleared,
    });
  }, [emitGesture]);

  const tracePointerSegment = useCallback((pointer, from, to) => {
    traceCellIndexes(from, to, pointer.boardRect, boardSize, idx => processDragCell(pointer, idx));
  }, [boardSize, processDragCell]);

  const beginDrag = useCallback((pointer, point) => {
    pointer.dragging = true;
    pointer.secondTap = null;
    if (pointer.dragMode !== 'none') {
      beginBatch?.();
      processDragCell(pointer, pointer.startIdx);
      tracePointerSegment(pointer, pointer.startPoint, point);
    }
    setPendingTapIdx(null);
    setIsDragging(true);
  }, [beginBatch, processDragCell, tracePointerSegment]);

  const releasePointerCapture = useCallback((pointer) => {
    const target = pointer.captureTarget;
    if (!target || pointer.pointerId === null) return;
    try {
      if (target.hasPointerCapture?.(pointer.pointerId)) target.releasePointerCapture(pointer.pointerId);
    } catch {
      // Pointer capture can already be gone after browser cancellation.
    }
  }, []);

  const resetPointer = useCallback((pointer) => {
    releasePointerCapture(pointer);
    pointerRef.current = createIdlePointer();
    setPressedIdx(null);
    setIsDragging(false);
  }, [releasePointerCapture]);

  const cancelPendingInteraction = useCallback(() => {
    detachPendingTap();
    const pointer = pointerRef.current;
    if (!pointer.active) return;
    if (pointer.dragging && pointer.dragMode !== 'none') commitBatch?.();
    resetPointer(pointer);
  }, [commitBatch, detachPendingTap, resetPointer]);

  const finishPointer = useCallback((event, cancelled = false) => {
    const pointer = pointerRef.current;
    if (!pointer.active || event.pointerId !== pointer.pointerId) return;

    if (pointer.dragging) {
      if (pointer.dragMode !== 'none') {
        commitBatch?.();
        if (!cancelled) emitDragGesture(pointer);
      }
    } else if (pointer.secondTap) {
      const firstTap = pointer.secondTap;
      if (!cancelled && getPointerTimestamp(event) - firstTap.releasedAt <= STAR_LINE_DOUBLE_CLICK_MS) {
        commitDoubleTap(pointer.startIdx);
      } else {
        commitSingleTap(firstTap.idx);
        if (!cancelled) scheduleSingleTap(pointer.startIdx, getPointerTimestamp(event));
      }
    } else if (!cancelled) {
      scheduleSingleTap(pointer.startIdx, getPointerTimestamp(event));
    }

    resetPointer(pointer);
  }, [commitBatch, commitDoubleTap, commitSingleTap, emitDragGesture, resetPointer, scheduleSingleTap]);

  const handlePointerDown = useCallback((event) => {
    if (disabled || pointerRef.current.active) return;
    if (event.button !== 0 || event.isPrimary === false) return;

    const boardRect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX, y: event.clientY };
    const startIdx = pointToCellIndex(point, boardRect, boardSize);
    if (startIdx === null) return;
    if (canInteractWithCell && !canInteractWithCell(startIdx)) return;
    const startCell = cellActions.getCellState(startIdx);
    if (!startCell) return;
    const dragMode = startCell.isStarred
      ? 'none'
      : startCell.isMarkedX ? 'erase-x' : 'add-x';

    event.preventDefault();
    const pending = pendingTapRef.current;
    let secondTap = null;
    if (
      pending
      && pending.idx === startIdx
      && getPointerTimestamp(event) - pending.releasedAt <= STAR_LINE_DOUBLE_CLICK_MS
    ) {
      secondTap = detachPendingTap();
    } else if (pending) {
      flushPendingTap();
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Global pointer listeners below remain as the safety net.
    }

    pointerRef.current = {
      active: true,
      pointerId: event.pointerId,
      startIdx,
      startPoint: point,
      lastPoint: point,
      boardRect,
      dragging: false,
      dragMode,
      visited: new Set(),
      changed: new Set(),
      added: new Set(),
      cleared: new Set(),
      captureTarget: event.currentTarget,
      secondTap,
    };
    setPressedIdx(startIdx);
  }, [boardSize, canInteractWithCell, cellActions, detachPendingTap, disabled, flushPendingTap]);

  const handlePointerMove = useCallback((event) => {
    const pointer = pointerRef.current;
    if (!pointer.active || event.pointerId !== pointer.pointerId) return;
    event.preventDefault();

    for (const point of getPointerPoints(event)) {
      if (!pointer.dragging) {
        const distance = Math.hypot(
          point.x - pointer.startPoint.x,
          point.y - pointer.startPoint.y,
        );
        if (distance > STAR_LINE_DRAG_THRESHOLD_PX) beginDrag(pointer, point);
      } else {
        tracePointerSegment(pointer, pointer.lastPoint, point);
      }
      pointer.lastPoint = point;
    }
  }, [beginDrag, tracePointerSegment]);

  const handlePointerUp = useCallback((event) => {
    event.preventDefault();
    finishPointer(event, false);
  }, [finishPointer]);

  const handlePointerCancel = useCallback((event) => {
    finishPointer(event, true);
  }, [finishPointer]);

  useEffect(() => {
    if (!disabled) return undefined;
    let active = true;
    queueMicrotask(() => {
      if (active) cancelPendingInteraction();
    });
    return () => {
      active = false;
    };
  }, [cancelPendingInteraction, disabled]);

  useEffect(() => {
    const handleWindowPointerUp = event => finishPointer(event, false);
    const handleWindowPointerCancel = event => finishPointer(event, true);
    const handleWindowBlur = () => {
      flushPendingTap();
      const pointer = pointerRef.current;
      if (!pointer.active) return;
      if (pointer.dragging && pointer.dragMode !== 'none') commitBatch?.();
      else if (pointer.secondTap) commitSingleTap(pointer.secondTap.idx);
      resetPointer(pointer);
    };
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [commitBatch, commitSingleTap, finishPointer, flushPendingTap, resetPointer]);

  useEffect(() => {
    const resetFrame = window.requestAnimationFrame(() => {
      setPressedIdx(null);
      setPendingTapIdx(null);
      setIsDragging(false);
    });
    return () => {
      window.cancelAnimationFrame(resetFrame);
      const pending = pendingTapRef.current;
      if (pending) window.clearTimeout(pending.timerId);
      pendingTapRef.current = null;
      const pointer = pointerRef.current;
      if (pointer.dragging && pointer.dragMode !== 'none') commitBatch?.();
      releasePointerCapture(pointer);
      pointerRef.current = createIdlePointer();
    };
  }, [commitBatch, interactionKey, releasePointerCapture]);

  return {
    pressedIdx,
    pendingTapIdx,
    isDragging,
    gridPointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
