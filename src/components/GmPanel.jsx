import { useState, useRef, useEffect } from 'react';
import { X, ShieldAlert, AlertTriangle, Play, XCircle, Loader2 } from 'lucide-react';
import { PLAY_MODES, getSavedGameKey, getClassicTotalLevels, getClassicLevelTargetByNumber, getClassicSectionLevelCount, isHiddenMode } from '../config/gameModes.js';
import { isPortalMode, getPortalLevelCount, getPortalLevel, createDefaultPortalProgress } from '../game/portal/portalRules.js';
import { getAppliedCandidateKeys } from '../data/curatedLevels.js';
import { getHiddenLevelCount } from '../data/hiddenLevels.js';
import { loadDevLevelCandidates } from '../config/loadDevLevelCandidates.js';

/* ───── 辅助 ───── */
const N = (gridData) => Math.round(Math.sqrt(gridData.length || 25));

const Section = ({ title, children }) => (
  <div className="mb-3">
    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">{title}</div>
    {children}
  </div>
);

const ConfirmOverlay = ({ message, onConfirm, onCancel }) => (
  <div className="absolute inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 rounded-xl">
    <div className="bg-slate-800 border border-slate-600 p-5 rounded-lg max-w-[220px] w-full text-center">
      <AlertTriangle size={24} className="text-amber-400 mx-auto mb-3" />
      <p className="text-slate-200 text-xs mb-4 leading-relaxed">{message}</p>
      <div className="flex gap-2.5 justify-center">
        <button onClick={onConfirm}
          className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded text-xs font-bold transition">确认</button>
        <button onClick={onCancel}
          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-1.5 rounded text-xs transition">取消</button>
      </div>
    </div>
  </div>
);

/* ───── 主组件 ───── */
export default function GmPanel({
  show, onClose, view, showToast,
  playMode, diff, levelIdx, status, path,
  gridData, hp, score, timer, comboStreak, maxComboStreak,
  coins, items,
  setCoins, setItems, setGridData, setPath, setTimer,
  handleWin, handleLose, handleRevive,
  restartCurrentGame, clearSavedGame, startGame,
  setProgress, setPortalProgress, setHiddenProgress,
  onStartDevCandidate, devCandidates, setDevCandidates,
  devReviewMap, onMarkCandidateReviewed,
  activeDevCandidate
}) {
  const [gmPos, setGmPos] = useState({ x: 20, y: 20 });
  const gmDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [jumpMode, setJumpMode] = useState('classic');
  const [jumpLevel, setJumpLevel] = useState('1');

  // Dev candidate loading state (local to GM panel)
  const [devLoadState, setDevLoadState] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!show) return;
    if (devCandidates.length > 0) {
      setDevLoadState('loaded');
      return;
    }
    if (devLoadState === 'loading' || devLoadState === 'loaded') return;

    setDevLoadState('loading');
    loadDevLevelCandidates()
      .then(list => {
        setDevCandidates(list);
        setDevLoadState('loaded');
      })
      .catch(() => {
        setDevLoadState('error');
      });
  }, [show, devCandidates, setDevCandidates, devLoadState]);

  // Filter out already-applied candidates
  const candidateKeyFn = (c) => `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx || c.seed}`;
  const appliedKeys = getAppliedCandidateKeys();
  const visibleCandidates = devCandidates.filter(c => !appliedKeys.has(candidateKeyFn(c)));
  const hiddenCount = devCandidates.length - visibleCandidates.length;

  if (collapsed) {
    return (
      <div className="fixed bg-slate-900/90 border border-slate-700 rounded-lg shadow-lg z-[9998] text-white select-none flex items-center gap-2 px-3 py-1.5"
        style={{ left: gmPos.x, top: gmPos.y, touchAction: 'none', cursor: 'pointer' }}
        onClick={() => setCollapsed(false)}
      >
        <ShieldAlert size={12} className="text-emerald-500" />
        <span className="text-[10px] font-bold text-slate-400">GM 后台</span>
      </div>
    );
  }

  /* ── 拖拽 ── */
  const onPointerDown = (e) => {
    if (e.target.closest('.gm-no-drag')) return;
    gmDragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, initialX: gmPos.x, initialY: gmPos.y };
    e.target.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!gmDragRef.current.isDragging) return;
    setGmPos({ x: gmDragRef.current.initialX + e.clientX - gmDragRef.current.startX, y: gmDragRef.current.initialY + e.clientY - gmDragRef.current.startY });
  };
  const onPointerUp = (e) => { gmDragRef.current.isDragging = false; e.target.releasePointerCapture(e.pointerId); };

  if (!show) return null;

  /* ── 派生数据 ── */
  const gridN = N(gridData);
  const portalRun = isPortalMode(playMode);
  const hasSavedGame = (() => {
    try { return !!localStorage.getItem(getSavedGameKey(playMode)); } catch { return false; }
  })();
  const isInGame = view === 'game' && status === 'playing';

  /* ── 剪贴板 ── */
  const copyToClipboard = (text, label) => {
    try {
      navigator.clipboard.writeText(text).then(
        () => showToast(`✅ 已复制 ${label}`),
        () => showToast('❌ 复制失败')
      );
    } catch { showToast('❌ 剪贴板不可用'); }
  };

  /* ── 二次确认 ── */
  const askConfirm = (message, action) => setConfirmDialog({ message, onConfirm: () => { action(); setConfirmDialog(null); } });

  /* ── 跳关映射（动态结构） ── */
  const getJumpTarget = () => {
    const num = parseInt(jumpLevel, 10);
    if (isNaN(num) || num < 1) return null;
    if (isHiddenMode(jumpMode)) {
      if (num > getHiddenLevelCount()) return null;
      return { diff: 'easy', levelIdx: num - 1, mode: jumpMode };
    }
    if (isPortalMode(jumpMode)) {
      const max = getPortalLevelCount(jumpMode);
      if (num > max) return null;
      return { diff: 'easy', levelIdx: num - 1, mode: jumpMode };
    }
    const mode = jumpMode === PLAY_MODES.diagonal ? PLAY_MODES.diagonal : PLAY_MODES.classic;
    const target = getClassicLevelTargetByNumber(mode, num);
    if (!target) { showToast(`无效的关卡编号（最大 ${getClassicTotalLevels(mode)}）`); return null; }
    return target;
  };

  /* ── 存档操作 ── */
  const handleSaveCurrent = () => {
    const saveData = {
      playMode, diff, levelIdx,
      ...(portalRun ? { portalLevelId: getPortalLevel(levelIdx, playMode).id } : {}),
      gridData, path, hp, timer,
      score, maxCombo: maxComboStreak,
      savedAt: Date.now()
    };
    localStorage.setItem(getSavedGameKey(playMode), JSON.stringify(saveData));
    showToast('💾 当前局已保存');
  };

  const handleCopySave = () => {
    try {
      const saved = localStorage.getItem(getSavedGameKey(playMode));
      copyToClipboard(saved || '{}', '当前存档 JSON');
    } catch { showToast('❌ 读取存档失败'); }
  };

  /* ── 进度操作 ── */
  const handleUnlockAll = () => {
    if (isHiddenMode(playMode)) {
      const max = getHiddenLevelCount();
      setHiddenProgress({ hidden: Array.from({ length: max }, () => 1) });
    } else if (portalRun) {
      const max = getPortalLevelCount(playMode);
      setPortalProgress(prev => ({
        ...prev,
        easy: { unlockedIndex: Math.max(prev.easy?.unlockedIndex ?? 0, max - 1), starsById: prev.easy?.starsById || {} }
      }));
    } else {
      const mode = playMode === PLAY_MODES.diagonal ? PLAY_MODES.diagonal : PLAY_MODES.classic;
      const full = {
        easy: Array.from({ length: getClassicSectionLevelCount('easy', mode) }, () => 1),
        medium: Array.from({ length: getClassicSectionLevelCount('medium', mode) }, () => 1),
        hard: Array.from({ length: getClassicSectionLevelCount('hard', mode) }, () => 1)
      };
      setProgress(full);
    }
    showToast('🔓 当前模式全部关卡已解锁');
  };

  const handleResetProgress = () => {
    if (isHiddenMode(playMode)) {
      setHiddenProgress({ hidden: [] });
    } else if (portalRun) {
      setPortalProgress(createDefaultPortalProgress());
    } else {
      setProgress({ easy: [0], medium: [], hard: [] });
    }
    showToast('🔄 当前模式进度已重置');
  };

  /* ── 按钮样式 ── */
  const btn = (label, onClick, cls = '') => (
    <button onClick={onClick}
      className={`gm-no-drag bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-[11px] active:scale-95 transition text-slate-200 ${cls}`}>
      {label}
    </button>
  );
  const dangerBtn = (label, message, action) => btn(label, () => askConfirm(message, action), 'text-rose-300/80 bg-slate-800 hover:bg-rose-950/50');

  return (
    <div
      className="fixed dev-surface bg-slate-900 z-[9998] text-white select-none opacity-95 flex flex-col"
      style={{ left: gmPos.x, top: gmPos.y, maxHeight: '85vh', width: '780px', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* ── 头部 ── */}
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-slate-700 pointer-events-none shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-slate-400" />
          <span className="font-bold text-sm text-slate-300">GM Console</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(true)} className="pointer-events-auto active:scale-90 hover:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500 gm-no-drag" title="最小化">—</button>
          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">DEV ONLY</span>
          <button onClick={onClose} className="pointer-events-auto active:scale-90 hover:bg-slate-800 p-1 rounded-md gm-no-drag"><X size={14} /></button>
        </div>
      </div>

      {/* ── 可滚动内容区（三列：GM 控制左两列 + Dev 试玩右列） ── */}
      <div className="overflow-y-auto px-3 py-2 flex-1" style={{ cursor: 'default' }}>
        <div className="flex gap-0">
          {/* ═══ 左侧：GM 控制区（两列网格） ═══ */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="grid grid-cols-2 gap-x-2.5">

        {/* 1. 当前状态 */}
        <Section title="当前状态">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            {[
              ['视图', view],
              ...(activeDevCandidate
                ? [
                    ['模式', 'DEV CANDIDATE'],
                    ['原玩法', activeDevCandidate.mode === 'diagonal' ? 'Diagonal' : 'Classic'],
                    ['难度', activeDevCandidate.diff],
                    ['seed', activeDevCandidate.seed],
                    ['关卡索引', 'N/A'],
                  ]
                : [
                    ['模式', playMode],
                    ['难度', diff],
                    ['关卡索引', levelIdx],
                  ]
              ),
              ['状态', status],
              ['路径长度', `${path?.length ?? 0} / ${gridN * gridN}`],
              ['棋盘', `${gridN}×${gridN}`],
              ['生命', hp],
              ['分数', score],
              ['连击', comboStreak],
              ['最大连击', maxComboStreak],
              ['金币', coins],
              ['道具', `${items?.heal ?? 0}h ${items?.exclude ?? 0}e ${items?.hint ?? 0}t`],
              ['传送门', portalRun ? '是' : '否'],
              ['存档', hasSavedGame ? '是' : '否']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between col-span-1 py-0.5 border-b border-slate-800/50">
                <span className="text-slate-500">{k}</span>
                <span className={`text-slate-200 font-mono text-[10px] ${k === '模式' && activeDevCandidate ? 'text-amber-400' : ''}`}>{String(v)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. 经济 / 道具 */}
        <Section title="经济 / 道具">
          <div className="grid grid-cols-2 gap-1.5">
            {btn('+100 金币', () => { setCoins(c => c + 100); showToast('+100 金币'); })}
            {btn('+1000 金币', () => { setCoins(c => c + 1000); showToast('+1000 金币'); })}
            {btn('+1 全道具', () => { setItems(p => ({ heal: p.heal + 1, exclude: p.exclude + 1, hint: p.hint + 1 })); showToast('+1 全道具'); })}
            {dangerBtn('清空道具', '确定要清空所有道具吗？此操作不可撤销。', () => { setItems({ heal: 0, exclude: 0, hint: 0 }); showToast('道具已清空'); })}
          </div>
        </Section>

        {/* 3. 棋盘操作 */}
        <Section title="棋盘操作">
          <div className="grid grid-cols-2 gap-1.5">
            {btn('显示全部暗牌', () => {
              if (!isInGame && view !== 'game') { showToast('请在关卡内使用'); return; }
              setGridData(prev => prev.map(c => ({ ...c, isRevealed: true })));
              showToast('已揭示全部暗牌');
            })}
            {btn('清空路径', () => {
              if (!isInGame) { showToast('请在游戏中使用'); return; }
              if (!path || path.length <= 1) { showToast('路径已为空'); return; }
              setPath([path[0]]); setTimer(0);
              showToast('路径已清空');
            })}
            {btn('重开当前关', () => {
              restartCurrentGame();
              showToast('已重开当前关卡');
            }, 'col-span-2')}
          </div>
        </Section>

        {/* 4. 结果控制 */}
        <Section title="结果控制">
          <div className="grid grid-cols-2 gap-1.5">
            {btn('立即通关', () => {
              if (!isInGame) { showToast('请在游戏中使用'); return; }
              if (!gridData || gridData.length === 0) return;
              const sorted = [...gridData].map((v, i) => ({ v: v.val, i })).sort((a, b) => a.v - b.v);
              const fullPath = sorted.map(x => x.i);
              setPath(fullPath); setTimer(0);
              setTimeout(() => { handleWin(fullPath, maxComboStreak); }, 400);
            })}
            {btn('立即失败', () => {
              if (!isInGame) { showToast('请在游戏中使用'); return; }
              handleLose();
              showToast('已触发失败');
            })}
            {btn('复活', () => {
              if (status !== 'lost') { showToast('只能在失败后使用'); return; }
              handleRevive();
            }, 'col-span-2')}
          </div>
        </Section>

        {/* 5. 存档 */}
        <Section title="存档">
          <div className="grid grid-cols-2 gap-1.5">
            {btn('保存当前局', () => {
              if (!isInGame) { showToast('请在游戏中使用'); return; }
              handleSaveCurrent();
            })}
            {btn('复制存档 JSON', () => handleCopySave())}
            {dangerBtn('清除当前存档', '确定要清除当前模式的存档吗？此操作不可撤销。', () => {
              clearSavedGame();
              showToast('当前存档已清除');
            }, 'col-span-2')}
          </div>
        </Section>

        {/* 6. 进度 */}
        <Section title="进度">
          <div className="grid grid-cols-2 gap-1.5">
            {dangerBtn('解锁全部关卡',
              portalRun ? '确定要解锁传送门全部关卡吗？' : `确定要解锁循序寻踪全部 ${getClassicTotalLevels(playMode)} 关吗？`,
              handleUnlockAll)}
            {dangerBtn('重置当前模式进度',
              portalRun ? '确定要重置传送门模式进度吗？所有星级和通关记录将丢失。' : '确定要重置循序寻踪进度吗？所有星级和通关记录将丢失。',
              handleResetProgress)}
          </div>
        </Section>

        {/* 7. 跳关 */}
        <Section title="跳关">
          <div className="flex items-center gap-1.5">
            <select value={jumpMode} onChange={e => { setJumpMode(e.target.value); setJumpLevel('1'); }}
              className="gm-no-drag bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 px-2 py-1.5 flex-1">
              <option value="classic">循序寻踪</option>
              <option value="diagonal">八向寻踪</option>
              <option value="hidden">隐迹寻踪</option>
              <option value="portalClassic">跃迁寻踪</option>
            </select>
            <input type="number" value={jumpLevel} onChange={e => setJumpLevel(e.target.value)}
              min="1" max={isHiddenMode(jumpMode) ? getHiddenLevelCount() : isPortalMode(jumpMode) ? getPortalLevelCount(jumpMode) : getClassicTotalLevels(jumpMode === PLAY_MODES.diagonal ? PLAY_MODES.diagonal : PLAY_MODES.classic)}
              className="gm-no-drag bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 px-2 py-1.5 w-16 text-center" />
            <button onClick={() => {
              const target = getJumpTarget();
              if (!target) { showToast('无效的关卡编号'); return; }
              startGame(target.diff, target.levelIdx, target.mode);
              showToast(`跳转至 ${jumpMode} #${jumpLevel}`);
            }}
              className="gm-no-drag bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-[11px] font-bold transition active:scale-95 shrink-0">
              开始
            </button>
          </div>
          <div className="text-[9px] text-slate-600 mt-1 px-0.5">
            {isHiddenMode(jumpMode) ? `1–${getHiddenLevelCount()}` : isPortalMode(jumpMode) ? `1–${getPortalLevelCount(jumpMode)}` : `1–${getClassicTotalLevels(jumpMode === PLAY_MODES.diagonal ? PLAY_MODES.diagonal : PLAY_MODES.classic)}`}
          </div>
        </Section>

        {/* 8. Debug */}
        <Section title="Debug">
          <div className="grid grid-cols-1 gap-1.5">
            {btn('复制当前状态 JSON', () => {
              const debugState = {
                视图: view, 模式: playMode, 难度: diff, 关卡索引: levelIdx, 状态: status,
                路径长度: path?.length ?? 0,
                棋盘大小: gridN,
                生命: hp, 分数: score,
                连击: comboStreak, 最大连击: maxComboStreak,
                金币: coins, 道具: items,
                传送门关卡: portalRun,
                当前存档: hasSavedGame,
                时间戳: new Date().toISOString()
              };
              copyToClipboard(JSON.stringify(debugState, null, 2), 'Debug JSON');
            })}
          </div>
        </Section>
        </div>{/* end grid-cols-2 */}
          </div>{/* end 左侧 GM 控制区 */}

          {/* ═══ 分隔线 ═══ */}
          <div className="w-px bg-slate-700/50 shrink-0" />

          {/* ═══ 右侧：Dev 试玩关卡（独立滚动列） ═══ */}
          <div className="w-[280px] shrink-0 pl-2 flex flex-col min-h-0 overflow-hidden">
            {/* 标题区（固定） */}
            <div className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider mb-1 px-0.5 shrink-0">
              Dev 试玩关卡
              {devLoadState === 'loaded' && devCandidates.length > 0 && (
                <span className="text-slate-500 font-normal normal-case ml-1">· 共 {visibleCandidates.length} 个候选{hiddenCount > 0 ? `（${hiddenCount} 已入库）` : ''}</span>
              )}
            </div>
            {devLoadState === 'loaded' && visibleCandidates.length > 0 && visibleCandidates.some(c => devReviewMap[c.seed] === 'APPROVED') && (
              <button
                onClick={() => {
                  const approved = visibleCandidates.filter(c => devReviewMap[c.seed] === 'APPROVED');
                  if (approved.length === 0) { showToast('没有已通过的候选'); return; }
                  // Group by mode+diff
                  const groups = {};
                  for (const c of approved) {
                    const g = `${c.mode}:${c.diff}`;
                    if (!groups[g]) groups[g] = [];
                    groups[g].push(`${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx || c.seed}`);
                  }
                  const lines = [];
                  for (const [g, keys] of Object.entries(groups)) {
                    const [mode, groupDiff] = g.split(':');
                    lines.push(`npm run apply:level-candidates -- --mode ${mode} --diff ${groupDiff} --keys "${keys.join(',')}" --dry-run`);
                  }
                  const cmd = lines.join(' && \\\n');
                  try {
                    navigator.clipboard.writeText(cmd).then(
                      () => showToast(`✅ 已复制 ${approved.length} 个 APPROVED 候选的 apply 命令`),
                      () => showToast('❌ 复制失败')
                    );
                  } catch { showToast('❌ 剪贴板不可用'); }
                }}
                className="gm-no-drag w-full text-[9px] bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-300/80 py-1 rounded mb-1.5 transition active:scale-95 shrink-0"
              >
                复制已通过 apply 命令
              </button>
            )}

            {/* 候选列表区（独立滚动） */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              {devLoadState === 'loading' && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500 py-2">
                  <Loader2 size={12} className="animate-spin" /> 正在加载...
                </div>
              )}
              {(devLoadState === 'error' || (devLoadState === 'loaded' && devCandidates.length === 0)) && visibleCandidates.length === 0 && (
                <div className="text-[10px] text-slate-500">
                  <p className="text-amber-400/70 mb-1">暂无候选关卡</p>
                  <p className="text-slate-600 leading-relaxed">
                    使用 CLI 生成：
                    <br /><code className="text-slate-500 break-all">npm run generate:level-candidates -- --mode classic --diff hard --count 5 --stage true</code>
                    <br /><code className="text-slate-500">npm run export:dev-level-candidates</code>
                  </p>
                </div>
              )}
              {devLoadState === 'loaded' && (visibleCandidates.length > 0 || devCandidates.length > 0) && (() => {
                const groupOrder = [];
                const groupMap = new Map();
                for (const c of visibleCandidates) {
                  const g = `${c.mode} · ${c.diff}`;
                  if (!groupMap.has(g)) { groupMap.set(g, []); groupOrder.push(g); }
                  groupMap.get(g).push(c);
                }

                const candidateCard = (c) => {
                  const reviewStatus = devReviewMap[c.seed];
                  const tierColors = c.tier === 'AUTO_RECOMMENDED'
                    ? 'border-emerald-600/40 bg-emerald-500/5'
                    : c.tier === 'REVIEW_CANDIDATE'
                      ? 'border-amber-600/40 bg-amber-500/5'
                      : 'border-rose-600/40 bg-rose-500/5';
                  const tierLabel = c.tier === 'AUTO_RECOMMENDED' ? '推荐'
                    : c.tier === 'REVIEW_CANDIDATE' ? '待审' : '淘汰';
                  const tierLabelCls = c.tier === 'AUTO_RECOMMENDED' ? 'text-emerald-400'
                    : c.tier === 'REVIEW_CANDIDATE' ? 'text-amber-400' : 'text-rose-400';
                  const statusBadge = reviewStatus === 'APPROVED'
                    ? { text: '✓', cls: 'bg-emerald-500/20 text-emerald-400' }
                    : reviewStatus === 'REJECTED'
                      ? { text: '✕', cls: 'bg-rose-500/20 text-rose-400' }
                      : null;

                  return (
                    <div key={c.seed} className={`border rounded-md p-1.5 ${tierColors}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[9px] font-mono text-slate-300">s{c.seed}</span>
                          <span className="text-[7px] text-slate-600">{c.N}×{c.N}</span>
                          <span className="text-[7px] text-slate-500" title={c.archetypeTag || ''}>{({EDGE_SWEEP:'边缘',CENTER_SWEEP:'中扫',CORNER_SWEEP:'角扫',LONG_RUN_MIXED:'长直',LONG_RETURN:'折返',SPLIT_REGION:'分区',COMPACT_ROUTE:'紧凑',COMPACT_ZIGZAG:'紧凑',TURN_DENSE:'密转',ROW_COL_SWEEP:'行列',ANCHOR_SPARSE:'锚稀',ANCHOR_DENSE:'锚密',DIAGONAL_WEAVE:'斜织',DIAGONAL_CROSS:'斜交',BALANCED_WEAVE:'均衡',BALANCED_PATH:'均衡',UNKNOWN:'?'})[c.archetypeTag] || '?'}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[7px] font-mono text-slate-500" title="similarity">S{(c.similarityScore != null ? c.similarityScore : '?')}</span>
                          <span className="text-[8px] font-mono text-slate-400">Q{c.qualityScore}</span>
                          {statusBadge && (
                            <span className={`text-[8px] px-1 py-0.5 rounded ${statusBadge.cls}`}>{statusBadge.text}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        <span className={`text-[7px] font-semibold ${tierLabelCls}`}>{tierLabel}</span>
                        {c.rejectReasons && c.rejectReasons.slice(0, 1).map((r, ri) => (
                          <span key={ri} className="text-[7px] text-rose-400/50 font-mono truncate max-w-[80px]" title={r}>{r}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { if (onStartDevCandidate) onStartDevCandidate(c); onClose(); }}
                          className="gm-no-drag flex items-center gap-0.5 bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-bold transition active:scale-95"
                        >
                          <Play size={9} /> 试玩
                        </button>
                        <button
                          onClick={() => {
                            if (onMarkCandidateReviewed) {
                              const newStatus = reviewStatus === 'REJECTED' ? undefined : 'REJECTED';
                              onMarkCandidateReviewed(c, newStatus);
                              showToast(newStatus ? `⚠️ REJECTED · seed ${c.seed}` : `↩️ 已重置 · seed ${c.seed}`);
                            }
                          }}
                          className={`gm-no-drag flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition active:scale-95 ${
                            reviewStatus === 'REJECTED'
                              ? 'bg-slate-700/40 text-slate-400 hover:bg-slate-600/40'
                              : 'bg-amber-800/40 hover:bg-amber-700/40 text-amber-300/80'
                          }`}
                        >
                          <XCircle size={9} /> {reviewStatus === 'REJECTED' ? '重置' : '淘汰'}
                        </button>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-2">
                    {groupOrder.map(groupKey => {
                      const list = groupMap.get(groupKey);
                      const reviewedCount = list.filter(c => devReviewMap[c.seed]).length;
                      const groupProgress = list.length > 0 ? `${reviewedCount}/${list.length}` : '';
                      return (
                        <div key={groupKey}>
                          <div className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-0.5 flex items-center justify-between">
                            <span>{groupKey}</span>
                            <span className="text-slate-600 normal-case font-normal">{list.length} 个{groupProgress ? ` · 已审 ${groupProgress}` : ''}</span>
                          </div>
                          <div className="space-y-1">
                            {list.map(c => candidateCard(c))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>{/* end 候选列表滚动区 */}
          </div>{/* end 右侧 Dev 试玩关卡 */}
        </div>{/* end flex 三列容器 */}
      </div>

      {/* ── 二次确认浮层 ── */}
      {confirmDialog && (
        <ConfirmOverlay
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
