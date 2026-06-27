import { useState, useRef } from 'react';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import { PLAY_MODES, getSavedGameKey, getClassicTotalLevels } from '../config/gameModes.js';
import { isPortalMode, getPortalLevelCount, getPortalLevel, createDefaultPortalProgress } from '../game/portal/portalRules.js';

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
  setProgress, setPortalProgress
}) {
  const [gmPos, setGmPos] = useState({ x: 20, y: 20 });
  const gmDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [jumpMode, setJumpMode] = useState('classic');
  const [jumpLevel, setJumpLevel] = useState('1');

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

  /* ── 跳关映射 ── */
  const getJumpTarget = () => {
    const num = parseInt(jumpLevel, 10);
    if (isNaN(num) || num < 1) return null;
    if (isPortalMode(jumpMode)) {
      const max = getPortalLevelCount(jumpMode);
      if (num > max) return null;
      return { diff: 'easy', levelIdx: num - 1, mode: jumpMode };
    }
    if (jumpMode === PLAY_MODES.diagonal) {
      if (num > 45) return null;
      if (num <= 10) return { diff: 'easy', levelIdx: num - 1, mode: PLAY_MODES.diagonal };
      if (num <= 25) return { diff: 'medium', levelIdx: num - 11, mode: PLAY_MODES.diagonal };
      return { diff: 'hard', levelIdx: num - 26, mode: PLAY_MODES.diagonal };
    }
    if (num > 45) return null;
    if (num <= 10) return { diff: 'easy', levelIdx: num - 1, mode: 'classic' };
    if (num <= 25) return { diff: 'medium', levelIdx: num - 11, mode: 'classic' };
    return { diff: 'hard', levelIdx: num - 26, mode: 'classic' };
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
    if (portalRun) {
      const max = getPortalLevelCount(playMode);
      setPortalProgress(prev => ({
        ...prev,
        easy: { unlockedIndex: Math.max(prev.easy?.unlockedIndex ?? 0, max - 1), starsById: prev.easy?.starsById || {} }
      }));
    } else {
      const full = {
        easy: Array.from({ length: 10 }, () => 1),
        medium: Array.from({ length: 15 }, () => 1),
        hard: Array.from({ length: 20 }, () => 1)
      };
      setProgress(full);
    }
    showToast('🔓 当前模式全部关卡已解锁');
  };

  const handleResetProgress = () => {
    if (portalRun) {
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
      className="fixed bg-slate-900 border-2 border-emerald-600 rounded-xl shadow-2xl z-[9998] text-white w-72 select-none opacity-95 flex flex-col"
      style={{ left: gmPos.x, top: gmPos.y, maxHeight: '85vh', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* ── 头部 ── */}
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-slate-700 pointer-events-none shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-emerald-400" />
          <span className="font-bold text-sm text-emerald-400">GM Console</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">DEV ONLY</span>
          <button onClick={onClose} className="pointer-events-auto active:scale-90 hover:bg-slate-800 p-1 rounded-md gm-no-drag"><X size={14} /></button>
        </div>
      </div>

      {/* ── 可滚动内容区 ── */}
      <div className="overflow-y-auto px-3 py-2 flex-1" style={{ cursor: 'default' }}>

        {/* 1. 当前状态 */}
        <Section title="当前状态">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            {[['视图', view], ['模式', playMode], ['难度', diff], ['关卡索引', levelIdx],
              ['状态', status], ['路径长度', `${path?.length ?? 0} / ${gridN * gridN}`],
              ['棋盘', `${gridN}×${gridN}`], ['生命', hp], ['分数', score],
              ['连击', comboStreak], ['最大连击', maxComboStreak],
              ['金币', coins], ['道具', `${items?.heal ?? 0}h ${items?.exclude ?? 0}e ${items?.hint ?? 0}t`],
              ['传送门', portalRun ? '是' : '否'], ['存档', hasSavedGame ? '是' : '否']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between col-span-1 py-0.5 border-b border-slate-800/50">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-200 font-mono text-[10px]">{String(v)}</span>
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
              portalRun ? '确定要解锁传送门全部关卡吗？' : `确定要解锁经典模式全部 ${getClassicTotalLevels()} 关吗？`,
              handleUnlockAll)}
            {dangerBtn('重置当前模式进度',
              portalRun ? '确定要重置传送门模式进度吗？所有星级和通关记录将丢失。' : '确定要重置经典模式进度吗？所有星级和通关记录将丢失。',
              handleResetProgress)}
          </div>
        </Section>

        {/* 7. 跳关 */}
        <Section title="跳关">
          <div className="flex items-center gap-1.5">
            <select value={jumpMode} onChange={e => { setJumpMode(e.target.value); setJumpLevel('1'); }}
              className="gm-no-drag bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 px-2 py-1.5 flex-1">
              <option value="classic">经典模式</option>
              <option value="diagonal">八向连线</option>
              <option value="portalClassic">经典传送门</option>
              <option value="portalCollect">传送门收集</option>
            </select>
            <input type="number" value={jumpLevel} onChange={e => setJumpLevel(e.target.value)}
              min="1" max={isPortalMode(jumpMode) ? getPortalLevelCount(jumpMode) : getClassicTotalLevels()}
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
            {isPortalMode(jumpMode) ? `1–${getPortalLevelCount(jumpMode)}` : `1–${getClassicTotalLevels()}`}
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
