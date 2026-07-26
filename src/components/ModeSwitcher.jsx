import { getModeStyle } from './modePresentation.js';

/**
 * Bookmark-style play-mode tabs that connect to the chapter panel below.
 * One tap per mode; unselected tabs stay readable. No sub-descriptions.
 * Only renders when there is more than one mode (single-mode catalogs omit it).
 */
export default function ModeSwitcher({
  modes,
  activeMode,
  modeProgressSummaries = {},
  onSelectMode,
}) {
  if (!modes || modes.length <= 1) return null;

  return (
    <section className="mode-bookmarks" aria-label="玩法选择" data-testid="mode-switcher">
      <div className="mode-bookmarks-track" role="group" aria-label="选择玩法">
        {modes.map(mode => {
          const style = getModeStyle(mode.id);
          const ModeArt = style.art;
          const isSelected = mode.id === activeMode;
          const progress = modeProgressSummaries[mode.id] || { completed: 0, total: 0 };

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              aria-pressed={isSelected}
              data-testid={`mode-card-${mode.id}`}
              className={`mode-bookmark mode-${mode.id} ${isSelected ? 'is-active' : ''}`}
            >
              <span className="mode-bookmark-art"><ModeArt /></span>
              <span className="mode-bookmark-text">
                <span className="mode-bookmark-name">{mode.name}</span>
                <span className="mode-bookmark-sub">
                  {progress.completed}/{progress.total}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
