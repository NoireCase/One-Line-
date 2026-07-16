import React from 'react';
import { Check, Lock, Star } from 'lucide-react';

/**
 * Presentational star-track for a Star Line chapter: nodes in a row with
 * per-segment connectors. A connector between node i and i+1 is lit ONLY when
 * both adjacent nodes are completed — so non-contiguous completion does not
 * draw a line across an unfinished node.
 * No gameplay / save logic — receives levels + handlers via props.
 * Keeps the level-tile-<key> testid + data-* attributes for stable E2E targeting.
 */
export default function StarTrack({ levels = [], recommendedKey, onSelectLevel }) {
  return (
    <div className={`star-track${levels.length > 10 ? ' star-track--wide' : ''}`} data-testid="star-track">
      <ol className="star-track-nodes">
        {levels.map((level, i) => {
          const isRecommended = level.key === recommendedKey;
          const ariaSuffix = !level.isUnlocked
            ? '，未解锁'
            : isRecommended
              ? (level.hasSave ? '，有未完成存档，点击继续' : '，下一关')
              : level.isCompleted ? '，已完成，点击重玩' : '';
          const next = levels[i + 1];
          // A segment lights up only when this node and the next are both completed.
          const linkLit = Boolean(next && level.isCompleted && next.isCompleted);

          return (
            <React.Fragment key={level.key}>
              <li className="star-track-item">
                <button
                  type="button"
                  onClick={() => level.isUnlocked && onSelectLevel(level)}
                  disabled={!level.isUnlocked}
                  data-testid={`level-tile-${level.key}`}
                  data-completed={level.isCompleted ? 'true' : 'false'}
                  data-recommended={isRecommended ? 'true' : 'false'}
                  data-locked={!level.isUnlocked ? 'true' : 'false'}
                  data-has-save={level.hasSave ? 'true' : 'false'}
                  aria-label={`第 ${level.displayLevelNumber} 关${ariaSuffix}`}
                  className="star-node"
                >
                  {level.hasSave && <span className="star-node-bookmark" aria-hidden="true" />}

                  <span className="star-node-glyph" aria-hidden="true">
                    {!level.isUnlocked ? (
                      <Lock size={13} className="star-node-lock" />
                    ) : level.isCompleted ? (
                      <Star size={14} className="star-node-star is-lit" fill="currentColor" />
                    ) : (
                      <Star size={14} className="star-node-star" />
                    )}
                  </span>

                  <span className="star-node-num">{level.displayLevelNumber}</span>

                  {isRecommended ? (
                    <span className="star-node-next">{level.hasSave ? '继续' : '下一关'}</span>
                  ) : (
                    <span className="star-node-next-spacer" />
                  )}

                  {level.isCompleted && !isRecommended && (
                    <Check size={12} className="star-node-check" />
                  )}
                </button>
              </li>

              {next && (
                <li
                  className="star-track-link"
                  data-testid={`star-track-link-${i}`}
                  data-lit={linkLit ? 'true' : 'false'}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
