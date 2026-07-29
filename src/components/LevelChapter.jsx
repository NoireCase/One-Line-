import { ChevronDown, Lock } from 'lucide-react';

/**
 * Presentational chapter shell for the level-select page (both One Line and Star Line).
 * Holds no gameplay / save logic — receives computed status + handlers via props.
 *
 * status: 'current' | 'completed' | 'partial' | 'locked'
 *  - current   : always expanded, header carries the primary CTA (passed as `cta`)
 *  - completed : collapsed summary by default, a toggle button expands it to replay
 *  - partial   : unlocked but not current, collapsible
 *  - locked    : static summary only, never renders level bodies
 */
export default function LevelChapter({
  chapterId,
  status,
  name,
  cta = null,
  expanded = false,
  onToggle,
  children,
}) {
  const isCurrent = status === 'current';
  const collapsible = status === 'completed' || status === 'partial';
  const bodyOpen = isCurrent || (collapsible && expanded);
  // completed 章节展开是"重玩"，partial 章节只是"展开关卡"（可能尚未通关）。
  const toggleHint = expanded ? '收起' : (status === 'completed' ? '展开重玩' : '展开关卡');

  return (
    <section className="lv-chapter" data-status={status} data-testid={`level-chapter-${chapterId}`}>
      {isCurrent ? (
        <div className="lv-chapter-head lv-chapter-head-current">
          <div className="lv-chapter-info">
            <h2 className="lv-chapter-name">{name}</h2>
          </div>
          {cta}
        </div>
      ) : collapsible ? (
        <button
          type="button"
          className="lv-chapter-head lv-chapter-head-toggle"
          aria-expanded={expanded}
          aria-controls={`level-chapter-body-${chapterId}`}
          onClick={onToggle}
          data-testid={`level-chapter-toggle-${chapterId}`}
        >
          <div className="lv-chapter-info">
            <h2 className="lv-chapter-name">{name}</h2>
          </div>
          <span className="lv-chapter-toggle-hint">
            {toggleHint}
            <ChevronDown size={16} className={`lv-chapter-chevron ${expanded ? 'is-open' : ''}`} />
          </span>
        </button>
      ) : (
        <div className="lv-chapter-head lv-chapter-head-locked">
          <div className="lv-chapter-info">
            <h2 className="lv-chapter-name">{name}</h2>
          </div>
          <span className="lv-chapter-locked-state">
            <Lock size={14} className="lv-chapter-lock" />
            未解锁
          </span>
        </div>
      )}

      {/* current renders its body directly; collapsible keeps the aria-controls target
          present at all times (hidden when collapsed). locked has no body/region. */}
      {isCurrent ? (
        <div className="lv-chapter-body" id={`level-chapter-body-${chapterId}`}>
          {children}
        </div>
      ) : collapsible ? (
        <div className="lv-chapter-body" id={`level-chapter-body-${chapterId}`} hidden={!bodyOpen}>
          {bodyOpen ? children : null}
        </div>
      ) : null}
    </section>
  );
}
