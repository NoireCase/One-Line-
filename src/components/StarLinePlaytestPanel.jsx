import { useState, useCallback, useEffect } from 'react';
import { X, Eye, EyeOff, Trash2, Unlock, RotateCcw, Play } from 'lucide-react';

/**
 * Star Line Playtest Panel — 右侧抽屉式 GM 面板
 * 入口：GameHud 中的 GM 按钮
 * 显示条件：import.meta.env.DEV 或 ?playtest=1
 */
export default function StarLinePlaytestPanel({
  levelIdx,
  starLineLevel,
  totalLevels = 30,
  starLineState,
  show = false,
  onClose,
  onJumpToLevel,
  onUnlockAll,
  onResetLevel,
  onClearProgress,
  showSolution,
  onToggleSolution,
  solutionCells,
}) {
  const [jumpInput, setJumpInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show, onClose]);

  const handleJump = useCallback(() => {
    const num = parseInt(jumpInput, 10);
    if (Number.isFinite(num) && num >= 1 && num <= totalLevels) {
      onJumpToLevel?.(num - 1);
      setJumpInput('');
    }
  }, [jumpInput, onJumpToLevel]);

  const handleJumpKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleJump();
  }, [handleJump]);

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    onClearProgress?.();
    setConfirmClear(false);
  }, [confirmClear, onClearProgress]);

  const levelInfo = starLineLevel ? {
    levelNum: (levelIdx ?? 0) + 1,
    id: starLineLevel.id,
    name: starLineLevel.name,
    N: starLineLevel.N,
    quota: starLineLevel.starsPerRow ?? starLineLevel.starsPerCol ?? starLineLevel.starsPerRegion ?? 1,
    starRating: starLineLevel.starRating ?? '—',
    difficultyBand: starLineLevel.difficultyBand ?? '—',
    stage: starLineLevel.stage ?? '—',
    teachingFocus: starLineLevel.teachingFocus ?? '—',
  } : null;

  const placedStars = starLineState?.placedCount ?? 0;
  const targetStars = starLineState?.targetCount ?? 0;

  if (!show) return null;

  return (
    <>
      {/* Backdrop — lightweight, doesn't block board interaction */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[95] w-[340px] max-w-[calc(100vw-2rem)] bg-[#0c1018] border-l border-white/[0.08] shadow-2xl shadow-black/50 flex flex-col overflow-y-auto"
        data-testid="star-line-gm-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
            <span className="text-sm font-bold text-slate-200">Star Line GM</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition active:scale-90"
            data-testid="star-line-gm-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-3 space-y-4">

          {/* ── Level Jump ── */}
          <Section title="跳转关卡">
            <div className="flex gap-1.5">
              <input
                type="number" min={1} max={totalLevels}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={handleJumpKeyDown}
                placeholder={`Lv.1–${totalLevels}`}
                className="flex-1 px-2 py-1.5 text-xs rounded-md bg-slate-800 border border-white/[0.1] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
                data-testid="playtest-jump-input"
              />
              <button
                onClick={handleJump} disabled={!jumpInput}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-md bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
                data-testid="playtest-jump-go"
              >
                <Play size={12} /> GO
              </button>
            </div>
          </Section>

          {/* ── Level Info ── */}
          {levelInfo && (
            <Section title="关卡信息">
              <div className="space-y-1 text-[11px]">
                <InfoRow label="Level" value={`${levelInfo.levelNum} · ${levelInfo.name}`} />
                <InfoRow label="ID" value={levelInfo.id} />
                <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-1">
                  <InfoRow label="N" value={levelInfo.N} testid="playtest-info-n" />
                  <InfoRow label="Quota" value={levelInfo.quota} testid="playtest-info-quota" />
                  <InfoRow label="Rating" value={`★${levelInfo.starRating}`} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <InfoRow label="Band" value={levelInfo.difficultyBand} />
                  <InfoRow label="Stage" value={levelInfo.stage} />
                </div>
                <div className="text-slate-400 leading-relaxed mt-1" data-testid="playtest-info-focus">
                  <span className="text-slate-600">focus:</span> {levelInfo.teachingFocus}
                </div>
                <div className="text-slate-500 mt-0.5">
                  已放置: {placedStars} / {targetStars}
                </div>
              </div>
            </Section>
          )}

          {/* ── Actions ── */}
          <Section title="操作">
            <div className="space-y-1.5">
              <ActionBtn
                icon={showSolution ? <EyeOff size={13} /> : <Eye size={13} />}
                label={showSolution ? '隐藏答案' : '显示答案'}
                onClick={onToggleSolution}
                active={showSolution}
                testid="playtest-toggle-solution"
              />
              <ActionBtn
                icon={<RotateCcw size={13} />}
                label="重置当前关"
                onClick={onResetLevel}
                testid="playtest-reset-level"
              />
              <ActionBtn
                icon={<Unlock size={13} />}
                label="解锁全部 Star Line"
                onClick={onUnlockAll}
                testid="playtest-unlock-all"
              />
              <ActionBtn
                icon={<Trash2 size={13} />}
                label={confirmClear ? '确认清空？再次点击' : '清空 Star Line 存档'}
                onClick={handleClear}
                danger={confirmClear}
                testid="playtest-clear-progress"
              />
            </div>
          </Section>

          {/* Solution active indicator */}
          {showSolution && (
            <div className="text-[10px] text-amber-400/70 flex items-center gap-1" data-testid="playtest-solution-active">
              <Eye size={11} />
              答案已显示 — {solutionCells?.length ?? 0} 个星点
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, testid }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-300 font-mono" data-testid={testid}>{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active = false, danger = false, testid }) {
  const base = 'w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold rounded-md transition active:scale-[0.98]';
  const color = danger
    ? 'bg-red-600/15 border border-red-500/25 text-red-300 hover:bg-red-600/25'
    : active
      ? 'bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30'
      : 'bg-slate-800/50 border border-white/[0.06] text-slate-400 hover:bg-slate-700/50 hover:text-slate-200';
  return (
    <button onClick={onClick} className={`${base} ${color}`} data-testid={testid}>
      {icon}{label}
    </button>
  );
}
