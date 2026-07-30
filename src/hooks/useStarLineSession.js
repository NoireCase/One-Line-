import { useState, useEffect, useRef, useCallback } from 'react';
import { isStarLineMode, createStarLineGrid } from '../game/starLine/starLineRules.js';
import { getSavedGameKey } from '../config/gameModes.js';
import { safeRemoveStorageItem } from '../utils/safeStorage.js';

/**
 * P3B: Star Line session 生命周期 hook。
 *
 * ## 管理范围
 * - resetKey → 传给 useStarLineInteraction 的 key
 * - initialGrid → useStarLineInteraction 的初始数据（支持恢复）
 * - wonRef / settleTimerRef → 内部持有，对外暴露只读引用
 * - restart() → 集中处理：清 session、增 key、置 playing、清 report、guard wonRef、清 timer、清持久化存档
 * - leaveSession() → 离开当前游戏 session（放弃/切关/卸载）：取消 settle timer、重置 wonRef
 * - cancelSettleTimer() → 保存流程中取消待定结算（不重置 wonRef）
 * - bumpResetKey() → 轻量增 key（关卡选择页 mode 切换用，无生命周期副作用）
 * - 入口 effect（view → game 时重置）
 * - 卸载清理（清 timer）
 *
 * ## 不在本 hook 管理
 * - win 检测 effect（需依赖 starLineState，调用链在 useStarLineInteraction 之后）
 * - starLineLevel / starLineTotalLevels 派生（渲染需要，留在 App.jsx）
 *
 * ## 调用方合同
 * - wonRef / settleTimerRef 由 hook 内部持有，调用方通过 restart() / leaveSession() / cancelSettleTimer() 修改
 * - win 检测 effect 在 App.jsx 中读取 wonRef.current / settleTimerRef.current
 */

export default function useStarLineSession({
  playMode,
  view,
  levelIdx,
  starLineLevel,
  pendingStarLineSession,
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

  // ---- internal refs (owned by hook) ----
  const wonRef = useRef(false);
  const settleTimerRef = useRef(null);

  // ---- reset key ----
  const [resetKey, setResetKey] = useState(0);

  const isActive = isStarLineMode(playMode) && starLineLevel;

  // ---- bump reset key (light: no lifecycle side effects, for mode switch in level select) ----
  const bumpResetKey = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  // ---- leave session: 取消 settle timer + 重置 wonRef（幂等）----
  const leaveSession = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    wonRef.current = false;
  }, []);

  // ---- cancel settle timer only（保存流程用，保留 wonRef） ----
  const cancelSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // ---- restart: 清 session + 增 key + 清除持久化存档 + guard wonRef + 清 timer ----
  const restart = useCallback(() => {
    onSessionRestore?.(null);
    // 清除当前 mode 对应的持久化存档（P1-4 修复）
    if (isStarLineMode(playMode)) {
      safeRemoveStorageItem(getSavedGameKey(playMode));
    }
    setResetKey((k) => k + 1);
    setStatus('playing');
    setLevelReport(null);
    wonRef.current = true;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, [onSessionRestore, playMode, setStatus, setLevelReport]);

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
    // P1-3: 离开 game view 时（返回关卡列表 / 首页）取消旧 settle timer
    if (prevViewRef.current === 'game' && view !== 'game') {
      leaveSession();
    }
    prevViewRef.current = view;
  }, [view, isActive, setStatus, setLevelReport, leaveSession]);

  // ---- leave session on level change (P1-3: 切关时取消旧 timer) ----
  useEffect(() => {
    if (!isActive) return;
    leaveSession();
  }, [levelIdx, isActive, leaveSession]);

  // ---- leave session on unmount (P1-3: 卸载时取消旧 timer) ----
  useEffect(() => {
    return () => {
      leaveSession();
    };
  }, [leaveSession]);

  return {
    resetKey,
    initialGrid,
    restoredGrid,
    bumpResetKey,
    restart,
    leaveSession,
    cancelSettleTimer,
    wonRef,
    settleTimerRef,
  };
}
