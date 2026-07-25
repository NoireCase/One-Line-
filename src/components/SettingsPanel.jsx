import React, { useMemo, useState } from 'react';
import { Settings, X, ShieldAlert } from 'lucide-react';

export default function SettingsPanel({
  sfxVol,
  onSfxVolChange,
  showDevTools = false,
  onOpenDevTools,
  onReplayStarLineGuide,
  starLineGuideCompleted = false,
  starLineGuideReplayRequested = false,
  onReplayStarLineDoubleGuide,
  starLineDoubleGuideCompleted = false,
  starLineDoubleGuideReplayRequested = false,
  starLineDoubleCompletedLessons = {},
  starLineDoubleReplayLevelId = null,
  onClose,
}) {
  const completedDoubleLessonNumbers = useMemo(() => (
    Array.from({ length: 10 }, (_, index) => index + 1).filter((lessonNumber) => {
      const levelId = `star-double-tutorial-${String(lessonNumber).padStart(2, '0')}`;
      return Boolean(starLineDoubleCompletedLessons[levelId]);
    })
  ), [starLineDoubleCompletedLessons]);
  const initialReplayLessonNumber = Number(
    starLineDoubleReplayLevelId?.match(/(\d+)$/)?.[1]
    || completedDoubleLessonNumbers.at(-1)
    || 1,
  );
  const [doubleReplayLessonNumber, setDoubleReplayLessonNumber] = useState(initialReplayLessonNumber);
  const selectedDoubleReplayLevelId = `star-double-tutorial-${String(doubleReplayLessonNumber).padStart(2, '0')}`;
  const selectedDoubleLessonCompleted = Boolean(
    starLineDoubleCompletedLessons[selectedDoubleReplayLevelId],
  );

  return (
    <div className="absolute inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="surface-panel p-6 max-w-sm w-full" data-testid="settings-panel">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white flex items-center gap-2" data-testid="settings-panel-title">
            <Settings size={19} className="text-slate-400" />
            游戏设置
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg transition active:scale-90" data-testid="settings-close-button">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">音效音量</span>
              <span className="text-sm font-semibold text-slate-300 tabular-nums">{sfxVol}%</span>
            </div>
            <input
              type="range" min="0" max="100" value={sfxVol}
              onChange={e => onSfxVolChange(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-300">星线操作教学</div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {starLineGuideReplayRequested
                    ? '下次进入单星第 1 关时播放'
                    : !starLineGuideCompleted
                      ? '完成首次教学后可重新查看'
                      : '重新练习单击、双击和连续拖动'}
                </div>
              </div>
              <button
                type="button"
                className="button-secondary shrink-0 px-3 py-2 text-xs"
                onClick={onReplayStarLineGuide}
                disabled={starLineGuideReplayRequested || !starLineGuideCompleted}
                data-testid="star-line-guide-replay-button"
              >
                {starLineGuideReplayRequested ? '已开启' : '重新查看'}
              </button>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-5">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                <div className="text-xs font-bold text-slate-300">双星推理教学</div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {starLineDoubleGuideReplayRequested
                    ? `下次进入双星第 ${Number(starLineDoubleReplayLevelId?.match(/(\d+)$/)?.[1] || 1)} 关时播放`
                    : !starLineDoubleGuideCompleted
                      ? '完成首次双星教学后可重新查看'
                      : '选择已经完成的课程重新练习'}
                </div>
                </div>
                <select
                  className="surface-muted rounded-lg px-2 py-2 text-xs text-slate-200"
                  value={doubleReplayLessonNumber}
                  onChange={event => setDoubleReplayLessonNumber(Number(event.target.value))}
                  disabled={starLineDoubleGuideReplayRequested || completedDoubleLessonNumbers.length === 0}
                  data-testid="star-line-double-guide-replay-select"
                  aria-label="选择双星重播课程"
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(lessonNumber => (
                    <option
                      key={lessonNumber}
                      value={lessonNumber}
                      disabled={!completedDoubleLessonNumbers.includes(lessonNumber)}
                    >
                      {`第 ${lessonNumber} 关`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="button-secondary w-full px-3 py-2 text-xs"
                onClick={() => onReplayStarLineDoubleGuide?.(selectedDoubleReplayLevelId)}
                disabled={starLineDoubleGuideReplayRequested || !selectedDoubleLessonCompleted}
                data-testid="star-line-double-guide-replay-button"
              >
                {starLineDoubleGuideReplayRequested ? '已开启' : '重新查看所选课程'}
              </button>
            </div>
          </div>

          {showDevTools && (
            <div className="border-t border-white/[0.06] pt-5">
              <div className="dev-surface p-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">开发工具</div>
                <button
                  onClick={onOpenDevTools}
                  className="button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm"
                >
                  <ShieldAlert size={18} /> 打开 GM 控制台
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={onClose} className="button-secondary w-full mt-6 py-3 text-sm" data-testid="settings-confirm-button">
          确认
        </button>
      </div>
    </div>
  );
}
