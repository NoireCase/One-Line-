export default function ModeSwitcher({
  modes,
  activeMode,
  completedModeIds = [],
  guideModeId = null,
  onSelectMode,
}) {
  if (!modes || modes.length <= 1) return null;
  const completed = completedModeIds instanceof Set
    ? completedModeIds
    : new Set(completedModeIds);

  return (
    <nav className="level-mode-tabs" aria-label="子玩法切换" data-testid="mode-switcher">
      <div className="level-mode-tabs-track" role="group" aria-label="选择玩法">
        {modes.map(mode => {
          const isSelected = mode.id === activeMode;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              aria-pressed={isSelected}
              aria-current={isSelected ? 'page' : undefined}
              data-testid={`mode-card-${mode.id}`}
              data-complete={completed.has(mode.id) ? 'true' : 'false'}
              data-guide={guideModeId === mode.id ? 'true' : 'false'}
              className={`level-mode-tab mode-${mode.id}`}
            >
              {mode.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
