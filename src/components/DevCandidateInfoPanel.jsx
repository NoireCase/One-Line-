import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, CheckCircle, XCircle, SkipForward, ArrowLeft, Eye, EyeOff, Trash2, RotateCcw } from 'lucide-react';

const tierBadge = (tier) => {
  if (tier === 'AUTO_RECOMMENDED') return { label: '推荐', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (tier === 'REVIEW_CANDIDATE') return { label: '待审', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { label: '淘汰', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
};

const modeLabel = (mode) => mode === 'diagonal' ? '八向连线' : '经典模式';

const InfoRow = ({ label, value, mono, highlight }) => (
  <div className="flex justify-between items-center py-[3px] border-b border-slate-800/40">
    <span className="text-[11px] text-slate-500">{label}</span>
    <span className={`text-[11px] ${highlight ? 'text-slate-100 font-semibold' : 'text-slate-300'} ${mono ? 'font-mono' : ''}`}>{String(value)}</span>
  </div>
);

const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 w-full text-left hover:text-slate-400 transition"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {title}
      </button>
      {open && <div className="mt-1 pl-3.5">{children}</div>}
    </div>
  );
};

export default function DevCandidateInfoPanel({ candidate, actions }) {
  if (!candidate) return null;

  const tierInfo = tierBadge(candidate.tier);
  const hasActions = actions && Object.keys(actions).length > 0;
  const p = candidate.penalties || {};
  const m = candidate.metrics || {};

  return (
    <div className="w-[420px] shrink-0 border-l border-slate-700/50 flex flex-col min-h-0 overflow-hidden"
      style={{ backgroundColor: '#0b0e16' }}>
      {/* ── Header（固定） ── */}
      <div className="px-3.5 py-2.5 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">DEV</span>
          <span className="text-sm font-bold text-slate-200">候选审核</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tierInfo.cls}`}>{tierInfo.label}</span>
          {candidate.status === 'PASSED' ? (
            <span className="text-[10px] text-emerald-500/70">✓ 校验通过</span>
          ) : (
            <span className="text-[10px] text-rose-400/70">✕ {candidate.status}</span>
          )}
        </div>
      </div>

      {/* ── 数据信息区（约 50-55%，可滚动） ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5">

        {/* 基础信息 */}
        <CollapsibleSection title="基础信息" defaultOpen={true}>
          <InfoRow label="玩法" value={modeLabel(candidate.mode)} />
          <InfoRow label="难度" value={candidate.diff} />
          <InfoRow label="种子" value={candidate.seed} mono highlight />
          <InfoRow label="虚拟索引" value={candidate.virtualIdx} mono />
          <InfoRow label="棋盘" value={`${candidate.N}×${candidate.N}`} />
          <InfoRow label="暗牌数" value={`${candidate.hiddenCount} / ${candidate.N * candidate.N}`} />
          <InfoRow label="路径长度" value={candidate.path?.length ?? '?'} mono />
          <InfoRow label="质量分" value={candidate.qualityScore} mono highlight />
          <InfoRow label="难度分" value={candidate.difficultyScore} mono highlight />
          <InfoRow label="相似度" value={candidate.similarityScore ?? '?'} mono />
          <InfoRow label="结构类型" value={candidate.archetypeTag || 'UNKNOWN'} />
          {candidate.rejectReasons && candidate.rejectReasons.length > 0 && (
            <div className="mt-1.5">
              <span className="text-[10px] text-rose-400/70 font-semibold">淘汰原因：</span>
              {candidate.rejectReasons.map((r, i) => (
                <div key={i} className="text-[10px] text-rose-400/50 font-mono ml-1">{r}</div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* 扣分项 */}
        {candidate.penalties && (
          <CollapsibleSection title="扣分项">
            <InfoRow label="蛇形惩罚" value={p.snakePenalty} mono />
            <InfoRow label="长直惩罚" value={p.longRunPenalty} mono />
            <InfoRow label="单调惩罚" value={p.monotonyPenalty} mono />
            <InfoRow label="混乱惩罚" value={p.chaosPenalty} mono />
            <InfoRow label="转向平衡" value={p.turnBalancePenalty} mono />
            <InfoRow label="锚点分布" value={p.anchorDistributionPenalty} mono />
            {p.diagonalIdentityPenalty !== undefined && (
              <InfoRow label="斜向特征" value={p.diagonalIdentityPenalty} mono />
            )}
          </CollapsibleSection>
        )}

        {/* 指标 */}
        {candidate.metrics && (
          <CollapsibleSection title="指标数据">
            <InfoRow label="暗牌数" value={m.hiddenCount} mono />
            <InfoRow label="暗牌比例" value={m.hiddenRatio?.toFixed(3)} mono />
            <InfoRow label="最大暗牌连" value={m.maxHiddenStreak} mono />
            <InfoRow label="转向次数" value={m.turnCount} mono />
            <InfoRow label="最大直行" value={m.maxStraightRun} mono />
            <InfoRow label="转向率" value={m.turnRate?.toFixed(3)} mono />
            <InfoRow label="斜向次数" value={m.diagCount} mono />
            <InfoRow label="斜向比例" value={m.diagRatio?.toFixed(3)} mono />
            <InfoRow label="最大斜向连" value={m.maxDiagRun} mono />
            <InfoRow label="方向偏差" value={m.directionBias?.toFixed(3)} mono />
            <InfoRow label="主方向占比" value={m.dominantDirRatio?.toFixed(3)} mono />
            <InfoRow label="最大锚点距" value={m.maxAnchorGap} mono />
          </CollapsibleSection>
        )}
      </div>

      {/* ── 操作区（约 45-50%，内部可滚动以防极小屏幕） ── */}
      {hasActions && (
        <div className="shrink-0 border-t border-slate-700/50 flex flex-col min-h-[260px] max-h-[48%] overflow-y-auto">
          <div className="px-3.5 py-3 space-y-3">

            {/* 审核决策区 */}
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">审核决策</div>
              <div className="space-y-2">
                <button
                  onClick={actions.markApproved}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white h-11 rounded-lg text-sm font-bold transition active:scale-[0.98] shadow-[0_3px_0_#1e5631]"
                >
                  <CheckCircle size={15} /> 标记为可入库
                </button>
                <button
                  onClick={actions.markRejected}
                  className="w-full flex items-center justify-center gap-2 bg-rose-800/60 hover:bg-rose-700/60 text-rose-200 h-11 rounded-lg text-sm font-semibold transition active:scale-[0.98] border border-rose-700/40"
                >
                  <XCircle size={15} /> 不合格
                </button>
              </div>
            </div>

            {/* 辅助判断区 */}
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">辅助判断</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={actions.revealAllHidden}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 h-9 rounded-md text-[11px] font-medium transition active:scale-95"
                >
                  <Eye size={12} /> 翻开全部暗牌
                </button>
                <button
                  onClick={actions.restoreHidden}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 h-9 rounded-md text-[11px] font-medium transition active:scale-95"
                >
                  <EyeOff size={12} /> 恢复暗牌
                </button>
                <button
                  onClick={actions.resetLevel}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 h-9 rounded-md text-[11px] font-medium transition active:scale-95"
                >
                  <RotateCcw size={12} /> 重置当前关卡
                </button>
                <button
                  onClick={actions.clearPath}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 h-9 rounded-md text-[11px] font-medium transition active:scale-95"
                >
                  <Trash2 size={12} /> 清空路径
                </button>
                <button
                  onClick={actions.nextCandidate}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 h-9 rounded-md text-[11px] font-medium transition active:scale-95"
                >
                  <SkipForward size={12} /> 下一个候选
                </button>
                <button
                  onClick={actions.backToGm}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 h-9 rounded-md text-[11px] font-medium transition active:scale-95"
                >
                  <ArrowLeft size={12} /> 返回 GM
                </button>
                <button
                  onClick={actions.copyJson}
                  className="flex items-center justify-center gap-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 h-9 rounded-md text-[10px] transition active:scale-95"
                >
                  <Copy size={11} /> 复制 JSON
                </button>
                <button
                  onClick={actions.copyApplyCommand}
                  className="flex items-center justify-center gap-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 h-9 rounded-md text-[10px] transition active:scale-95"
                >
                  <Copy size={11} /> 复制命令
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
