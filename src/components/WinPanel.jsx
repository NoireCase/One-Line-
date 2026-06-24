import React, { useState, useEffect } from 'react';
import { Star, CircleDollarSign, FastForward, RotateCcw } from 'lucide-react';

const WinPanel = ({
  report,
  levelIdx,
  maxLevelCount,
  hasNextLevel = levelIdx + 1 < maxLevelCount,
  onBack,
  onNext,
  onRetry,
  onModeSelect
}) => {
  const {
    completionScore = 0,
    timeBonus = 0,
    lifeBonus = 0,
    comboBonus = 0,
    ruleBonus = 0,
    totalScore = 0,
    coinReward = 0,
    sMax = 1
  } = report;
  const isPortalReport = report.isPortal;
  const canContinue = hasNextLevel;
  const [total, setTotal] = useState(0);
  const [animating, setAnimating] = useState(true);

  const step1 = completionScore;
  const step2 = step1 + timeBonus;
  const step3 = step2 + lifeBonus;
  const step4 = step3 + comboBonus;
  const step5 = step4 + ruleBonus;

  useEffect(() => {
    let startTime = performance.now();
    const duration = 4500;
    let animFrame;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setTotal(Math.floor(easeProgress * totalScore));

      if (progress < 1) {
        animFrame = requestAnimationFrame(tick);
      } else {
        setTotal(totalScore);
        setAnimating(false);
      }
    };
    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [totalScore]);

  const renderRowVal = (target, offsetStart, offsetEnd) => {
    if (total <= offsetStart) return 0;
    if (total >= offsetEnd) return target;
    return total - offsetStart;
  };

  if (isPortalReport) {
    return (
      <>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes star-drop {
            0% { transform: scale(3) translateY(-30px) rotate(15deg); opacity: 0; filter: blur(4px); }
            50% { transform: scale(0.9) translateY(5px) rotate(-5deg); opacity: 1; filter: blur(0); }
            100% { transform: scale(1) translateY(0) rotate(0); opacity: 1; }
          }
          .animate-star-drop { animation: star-drop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        `}} />
        <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 border border-violet-500/40">
          <h2 className="text-3xl font-black text-violet-300 mb-2 drop-shadow-md">传送门通关！</h2>

          <div className="flex justify-center gap-2 mb-6 h-12 items-center">
            {[1, 2, 3].map(s => (
              <div key={s} className="relative w-10 h-10 flex items-center justify-center">
                <Star size={36} className="text-slate-700 absolute" />
                {s <= report.stars && (
                  <Star size={36} className="absolute text-yellow-400 fill-yellow-400 animate-star-drop drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3 mb-6">
            {canContinue && (
              <button onClick={onNext} className="w-full bg-violet-500 hover:bg-violet-400 text-white py-3.5 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.4)]">
                下一关 <FastForward size={16} />
              </button>
            )}
            {!canContinue && (
              <button onClick={onBack} className="w-full bg-violet-500 hover:bg-violet-400 text-white py-3.5 rounded-xl font-bold active:scale-95 transition shadow-[0_0_15px_rgba(139,92,246,0.35)]">
                返回关卡列表
              </button>
            )}
            <div className="flex justify-center gap-4 text-sm font-bold">
              <button onClick={onRetry} className="text-slate-400 hover:text-white transition flex items-center gap-1">
                <RotateCcw size={14} /> 重新挑战
              </button>
              <button onClick={onModeSelect} className="text-slate-400 hover:text-white transition">
                模式选择
              </button>
            </div>
          </div>

          <details className="mb-4 rounded-xl border border-slate-700 bg-slate-900/35 px-4 py-3 text-left text-sm text-slate-400">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              <span>通关数据</span>
              <span className="font-mono normal-case tracking-normal text-violet-300">{report.bestSteps} 步</span>
            </summary>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span>当前步数</span>
                <span className="font-mono font-black text-violet-300">{report.steps}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>路径长度</span>
                <span className="font-mono font-bold text-white">{report.pathLength}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>3星目标</span>
                <span className="font-mono font-bold text-emerald-300">{report.targetSteps} 步</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                <span>最佳步数</span>
                <span className="font-mono font-black text-violet-300">{report.bestSteps}</span>
              </div>
            </div>
          </details>
        </div>
      </>
    );
  }

  let currentStars = 1;
  if (total >= sMax * 0.9) currentStars = 3;
  else if (total >= sMax * 0.6) currentStars = 2;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes star-drop {
          0% { transform: scale(3) translateY(-30px) rotate(15deg); opacity: 0; filter: blur(4px); }
          50% { transform: scale(0.9) translateY(5px) rotate(-5deg); opacity: 1; filter: blur(0); }
          100% { transform: scale(1) translateY(0) rotate(0); opacity: 1; }
        }
        .animate-star-drop { animation: star-drop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}} />
      <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 border border-slate-700">
        <h2 className="text-3xl font-black text-emerald-400 mb-2 drop-shadow-md">关卡完成！</h2>

        <div className="flex justify-center gap-2 mb-6 h-12 items-center">
          {[1, 2, 3].map(s => {
             const isActive = s <= currentStars;
             return (
               <div key={s} className="relative w-10 h-10 flex items-center justify-center">
                 <Star size={36} className="text-slate-700 absolute" />
                 {isActive && (
                   <Star size={36} className="absolute text-yellow-400 fill-yellow-400 animate-star-drop drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                 )}
               </div>
             )
          })}
        </div>

        <div className="space-y-3 mb-6">
          {canContinue && (
            <button onClick={onNext} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              下一关 <FastForward size={16} />
            </button>
          )}
          {!canContinue && (
            <button onClick={onBack} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold active:scale-95 transition shadow-[0_0_15px_rgba(16,185,129,0.35)]">
              返回关卡列表
            </button>
          )}
          <div className="flex justify-center gap-4 text-sm font-bold">
            <button onClick={onRetry} className="text-slate-400 hover:text-white transition flex items-center gap-1">
              <RotateCcw size={14} /> 重新挑战
            </button>
            <button onClick={onModeSelect} className="text-slate-400 hover:text-white transition">
              模式选择
            </button>
          </div>
        </div>

        <details className="mb-4 rounded-xl border border-slate-700 bg-slate-900/35 px-4 py-3 text-sm text-slate-400 text-left">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            <span>成绩详情</span>
            <span className="font-mono normal-case tracking-normal text-emerald-300">{total}</span>
          </summary>
          <div className="mt-4 space-y-3">
            {total > 0 && (
              <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
                <span>完成分</span>
                <span className="font-mono font-bold text-white">{renderRowVal(completionScore, 0, step1)}</span>
              </div>
            )}
            {total > step1 && (
              <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
                <span>时间加成</span>
                <span className="font-mono text-yellow-400">+{renderRowVal(timeBonus, step1, step2)}</span>
              </div>
            )}
            {total > step2 && (
              <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
                <span>生命加成</span>
                <span className="font-mono text-rose-400">+{renderRowVal(lifeBonus, step2, step3)}</span>
              </div>
            )}
            {total > step3 && (
              <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
                <span>连击加成</span>
                <span className="font-mono text-purple-400">+{renderRowVal(comboBonus, step3, step4)}</span>
              </div>
            )}
            {ruleBonus > 0 && (
              <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
                <span>玩法加成</span>
                <span className="font-mono text-cyan-300">+{renderRowVal(ruleBonus, step4, step5)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-slate-700 font-black pt-3">
              <span className="text-slate-300 tracking-widest">总分</span>
              <span className="font-mono text-emerald-400 text-lg">{total}</span>
            </div>
          </div>
        </details>

        <div className="flex justify-center gap-4">
          <div className={`bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full font-bold flex items-center gap-1.5 text-sm border border-yellow-500/20 transition-opacity duration-500 ${animating ? 'opacity-0' : 'opacity-100'}`}>
            <CircleDollarSign size={16} /> 奖励 +{coinReward} 金币
          </div>
        </div>
      </div>
    </>
  );
};

export default WinPanel;
