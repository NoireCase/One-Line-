import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createStarLineGrid } from '../game/starLine/starLineRules.js';
import { getSavedGameKey } from '../config/gameModes.js';
import { safeRemoveStorageItem } from '../utils/safeStorage.js';

/**
 * Star Line session 生命周期 owner。
 *
 * hook 独占 session token、generation、settle timer、scheduled/committed guard，
 * 并通过语义方法处理重开与离开。调用方只同步盘面完成状态，不接触可写 ref。
 */
export default function useStarLineSession({
  playMode,
  view,
  sessionStartEpoch,
  starLineLevel,
  pendingStarLineSession,
  setStatus,
  setLevelReport,
  onSessionRestore,
}) {
  const levelId = starLineLevel?.id || null;
  const isActive = view === 'game' && Boolean(starLineLevel);

  const restoredGrid = useMemo(() => (
    pendingStarLineSession?.modeId === playMode
    && pendingStarLineSession?.levelId === levelId
    && Array.isArray(pendingStarLineSession?.gridData)
    && starLineLevel
    && pendingStarLineSession.gridData.length === starLineLevel.N ** 2
  ) ? pendingStarLineSession.gridData : null, [
    levelId,
    pendingStarLineSession,
    playMode,
    starLineLevel,
  ]);

  const initialGrid = useMemo(
    () => restoredGrid || (starLineLevel ? createStarLineGrid(starLineLevel) : []),
    [restoredGrid, starLineLevel],
  );

  const [resetGeneration, setResetGeneration] = useState(0);
  const resetKey = `${playMode}:${levelId || 'none'}:${sessionStartEpoch}:${resetGeneration}`;

  const generationRef = useRef(0);
  const lifecycleRef = useRef({
    active: false,
    committed: false,
    generation: 0,
    identity: null,
    scheduled: false,
    timerId: null,
    token: null,
  });

  const invalidateSession = useCallback(() => {
    const current = lifecycleRef.current;
    if (current.timerId !== null) clearTimeout(current.timerId);
    generationRef.current += 1;
    lifecycleRef.current = {
      active: false,
      committed: false,
      generation: generationRef.current,
      identity: null,
      scheduled: false,
      timerId: null,
      token: null,
    };
  }, []);

  const activateSession = useCallback((modeId, activeLevelId, startEpoch) => {
    invalidateSession();
    const token = Object.freeze({
      generation: generationRef.current,
      levelId: activeLevelId,
      playMode: modeId,
      startEpoch,
    });
    lifecycleRef.current = {
      active: true,
      committed: false,
      generation: token.generation,
      identity: `${modeId}:${activeLevelId}:${startEpoch}`,
      scheduled: false,
      timerId: null,
      token,
    };
  }, [invalidateSession]);

  // Identity cleanup always runs before the next mode/level/view identity is activated.
  // It also invalidates the most recent restart token during StrictMode cleanup/unmount.
  useEffect(() => {
    if (!isActive) {
      invalidateSession();
      return undefined;
    }
    activateSession(playMode, levelId, sessionStartEpoch);
    return invalidateSession;
  }, [
    activateSession,
    invalidateSession,
    isActive,
    levelId,
    playMode,
    sessionStartEpoch,
  ]);

  const syncCompletion = useCallback(({
    isComplete,
    delay = 0,
    onSettle,
  }) => {
    const current = lifecycleRef.current;

    if (!isComplete) {
      if (current.timerId !== null) clearTimeout(current.timerId);
      current.timerId = null;
      current.scheduled = false;
      current.committed = false;
      return false;
    }

    if (
      !current.active
      || !current.token
      || current.scheduled
      || current.committed
      || typeof onSettle !== 'function'
    ) {
      return false;
    }

    const token = current.token;
    current.scheduled = true;
    current.timerId = setTimeout(() => {
      const live = lifecycleRef.current;
      const tokenIsCurrent = (
        live.active
        && live.token === token
        && live.generation === token.generation
        && live.identity === `${token.playMode}:${token.levelId}:${token.startEpoch}`
        && !live.committed
      );
      if (!tokenIsCurrent) return;

      live.timerId = null;
      live.scheduled = false;
      live.committed = true;
      onSettle();
    }, Math.max(0, delay));
    return true;
  }, []);

  const leaveSession = useCallback(() => {
    invalidateSession();
    onSessionRestore?.(null);
    setResetGeneration((generation) => generation + 1);
  }, [invalidateSession, onSessionRestore]);

  const restart = useCallback(() => {
    if (isActive) {
      activateSession(playMode, levelId, sessionStartEpoch);
    } else {
      invalidateSession();
    }

    onSessionRestore?.(null);
    const savedGameKey = getSavedGameKey(playMode);
    if (savedGameKey) safeRemoveStorageItem(savedGameKey);
    setResetGeneration((generation) => generation + 1);
    setStatus('playing');
    setLevelReport(null);
  }, [
    activateSession,
    invalidateSession,
    isActive,
    levelId,
    onSessionRestore,
    playMode,
    sessionStartEpoch,
    setLevelReport,
    setStatus,
  ]);

  return {
    initialGrid,
    leaveSession,
    resetKey,
    restart,
    restoredGrid,
    syncCompletion,
  };
}
