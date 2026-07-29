import {
  OneLinePathIcon,
  StarLineEntryIcon,
} from './PuzzleMarks.jsx';
import {
  getReplayVisualFamily,
  REPLAY_VISUAL_FAMILIES,
} from '../config/replayVisualFamily.js';

export default function ReplayLevelMark({
  modeId,
  state,
  levelKey,
  className = '',
}) {
  const family = getReplayVisualFamily(modeId);
  if (!family) return null;

  const Icon = family === REPLAY_VISUAL_FAMILIES.oneLine
    ? OneLinePathIcon
    : StarLineEntryIcon;

  return (
    <span
      className={`level-tile-replay-mark ${className}`.trim()}
      data-family={family}
      data-replay-state={state}
      data-testid={`level-replay-mark-${family}-${levelKey}`}
      aria-hidden="true"
    >
      <Icon size="100%" />
    </span>
  );
}
