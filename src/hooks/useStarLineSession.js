import { useState, useEffect, useRef, useCallback } from 'react';
import { isStarLineMode, createStarLineGrid } from '../game/starLine/starLineRules.js';

/**
 * P3B: Star Line session 生命周期 hook。
 *
 * 集中管理 Star Line 的初始化、恢复、重开与切关清理。
 * wonRef / settleTimerRef 由调用方创建并传入——win 检测 effect 需要读取
 * useStarLineInteraction 返回的 starLineState，因此留在 App.jsx 中。
 * 但 restart() 和 cancelSettleTimer() 统一通过本 hook 收口对这两个 ref 的写操作。
 *
 * ## 管理范围
 * - resetKey → 传给 useStarLineInteraction 的 key
 * - initialGrid → useStarLineInteraction 的初始数据（支持恢复）
 * - restart() → 集中处理：清 session、增 key、置 playing、清 report、guard wonRef、清 timer
 * - cancelSettleTimer() → 保存流程中取消待定结算
 * - 入口 effect（view → game 时重置）
 * - 切关 effect（levelIdx 变化时清 timer + 重置 wonRef）
 * - 卸载清理（清 timer）
 *
 * ## 不在本 hook 管理
 * - win 检测 effect（需依赖 starLineState，调用链在 useStarLineInteraction 之后）
 * - starLineLevel / starLineTotalLevels 派生（渲染需要，留在 App.jsx）
 */

export default function useStarLineSession({
  playMode,
  view,
  levelIdx,
  starLineLevel,
  pendingStarLineSession,
  wonRef,
  settleTimerRef,
  setStatus,
  setLevelReport,
  onSessionRestore,
}) {
  // ---- restored grid derivation ----
  const restoredGrid = (
    pendingStarLineSession?.modeId === playMode
    && pendingStarLineSession?.levelId === starLineLevel?.id
    && Array.isArray(pendingStarLineSession?.gridData)
    && starLineLevel
    && pendingStarLineSession.gridData.length === starLineLevel.N ** 2
  ) ? pendingStarLineSession.gridData : null;

  const initialGrid = restoredGrid || (starLineLevel ? createStarLineGrid(starLineLevel) : []);

  // ---- reset key ----
  const [resetKey, setResetKey] = useState(0);

  const isActive = isStarLineMode(playMode) && starLineLevel;

  // ---- bump reset key (light: no lifecycle side effects, for mode switch in level select) ----
  const bumpResetKey = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  // ---- restart ----
  const restart = useCallback(() => {
    onSessionRestore?.(null);
    setResetKey((k) => k + 1);
    setStatus('playing');
    setLevelReport(null);
    wonRef.current = true;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, [onSessionRestore, setStatus, setLevelReport, wonRef, settleTimerRef]);

  // ---- cancel settle timer ----
  const cancelSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, [settleTimerRef]);

  // ---- entry reset (view → game) ----
  const prevViewRef = useRef(view);
  useEffect(() => {
    if (!isActive) return;
    if (view === 'game' && prevViewRef.current !== 'game') {
      setResetKey((k) => k + 1);
      setStatus('playing');
      setLevelReport(null);
      wonRef.current = true;
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    }
    prevViewRef.current = view;
  }, [view, isActive, setStatus, setLevelReport, wonRef, settleTimerRef]);

  // ---- cleanup on level change ----
  useEffect(() => {
    if (!isActive) return;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    wonRef.current = false;
  }, [levelIdx, isActive, wonRef, settleTimerRef]);

  // ---- cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [settleTimerRef]);

  return {
    resetKey,
    initialGrid,
    restoredGrid,
    bumpResetKey,
    restart,
    cancelSettleTimer,
  };
}
