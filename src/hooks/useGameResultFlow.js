import { useCallback, useMemo } from 'react';
import { getLevelsPerDiff } from '../config/gameModes.js';
import { playComboTone } from '../config/soundEngine.js';
import { CONFIG } from '../game/classic/createClassicLevel.js';
import { calculateLevelScoreReport } from '../game/scoring/scoreEngine.js';
import { createLevelConfig } from '../game/rules/levelConfig.js';
import {
  calculatePortalStars,
  calculatePortal2Stars,
  getPortalLevelCount,
  isPortal2Level,
  isPortalMode,
  normalizePortalBestStepsDiff,
  normalizePortalProgressDiff
} from '../game/portal/portalRules.js';

const LEVEL_SECTION_ORDER = ['easy', 'medium', 'hard'];

const getNextLevelTarget = (playMode, diff, levelIdx) => {
  if (isPortalMode(playMode)) {
    return levelIdx + 1 < getPortalLevelCount() ? { diff, levelIdx: levelIdx + 1 } : null;
  }
  const sections = [
    { diff: 'easy', count: 10 },
    { diff: 'medium', count: 15 },
    { diff: 'hard', count: 20 }
  ];
  const section = sections.find(s => s.diff === diff);
  const sectionCount = section ? section.count : 10;
  if (levelIdx + 1 < sectionCount) {
    return { diff, levelIdx: levelIdx + 1 };
  }
  const idx = LEVEL_SECTION_ORDER.indexOf(diff);
  const nextDiff = LEVEL_SECTION_ORDER[idx + 1];
  return nextDiff ? { diff: nextDiff, levelIdx: 0 } : null;
};

export default function useGameResultFlow({
  playMode,
  diff,
  levelIdx,
  path,
  gridData,
  hp,
  timer,
  scoreRef,
  maxComboStreak,
  setHp,
  setStatus,
  setLevelReport,
  portalBestSteps,
  setPortalProgress,
  setPortalBestSteps,
  setCoins,
  setGlobalScore,
  setProgress,
  setHighScores,
  reviveWithCoins,
  showToast,
  markWon,
  markLost
}) {
  const nextLevelTarget = useMemo(
    () => {
      const levelConfig = createLevelConfig(diff, levelIdx, playMode);
      if (isPortal2Level(levelConfig.portalLevel)) return null;
      return getNextLevelTarget(playMode, diff, levelIdx);
    },
    [diff, levelIdx, playMode]
  );

  const handleWin = useCallback((completedPath = path, finalMaxCombo = maxComboStreak) => {
    markWon();
    playComboTone(999);

    const config = CONFIG[diff];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);

    if (levelConfig.portalLevel) {
      const portalLevel = levelConfig.portalLevel;
      const levelId = portalLevel.id;
      const steps = completedPath.length - 1;
      const pathLength = completedPath.length;
      const isP2 = isPortal2Level(portalLevel);
      const stars = isP2
        ? calculatePortal2Stars(steps, portalLevel)
        : calculatePortalStars(steps, portalLevel.targetSteps);
      const currentBestSteps = portalBestSteps[diff]?.[levelId] || 0;
      const bestSteps = currentBestSteps > 0 ? Math.min(currentBestSteps, steps) : steps;

      setLevelReport({
        isPortal: true,
        isPortal2: isP2,
        steps,
        pathLength,
        bestSteps,
        targetSteps: isP2 ? portalLevel.targetSteps : portalLevel.targetSteps,
        excellentSteps: isP2 ? portalLevel.excellentSteps : undefined,
        stars,
        coinReward: 0
      });

      setPortalProgress(prev => {
        const currentDiff = normalizePortalProgressDiff(prev[diff]);
        const currentStars = currentDiff.starsById[levelId] || 0;
        return {
          ...prev,
          [diff]: {
            unlockedIndex: levelIdx + 1 < getLevelsPerDiff(playMode) ? Math.max(currentDiff.unlockedIndex, levelIdx + 1) : currentDiff.unlockedIndex,
            starsById: {
              ...currentDiff.starsById,
              [levelId]: Math.max(currentStars, stars)
            }
          }
        };
      });

      setPortalBestSteps(prev => {
        const currentDiff = normalizePortalBestStepsDiff(prev[diff]);
        const current = currentDiff[levelId] || 0;
        return {
          ...prev,
          [diff]: {
            ...currentDiff,
            [levelId]: !current || steps < current ? steps : current
          }
        };
      });
      return;
    }

    const scoreReport = calculateLevelScoreReport({
      config,
      gridData,
      baseScore: scoreRef.current,
      hp,
      timer,
      maxCombo: finalMaxCombo
    });

    const coinReward = config.coins + (scoreReport.stars * 5);
    const finalLevelScore = scoreReport.totalLevelScore;
    const stars = scoreReport.stars;

    setLevelReport({
      ...scoreReport,
      coinReward
    });

    setCoins(c => c + coinReward);
    setGlobalScore(prev => prev + finalLevelScore);

    setProgress(prev => {
      const nextProgress = {
        ...prev,
        [diff]: [...(prev[diff] || [])]
      };
      const newDiffProg = nextProgress[diff];
      if (!newDiffProg[levelIdx] || newDiffProg[levelIdx] < stars) newDiffProg[levelIdx] = stars;

      if (nextLevelTarget) {
        const nextDiffProgress = [...(nextProgress[nextLevelTarget.diff] || [])];
        if (typeof nextDiffProgress[nextLevelTarget.levelIdx] !== 'number') {
          nextDiffProgress[nextLevelTarget.levelIdx] = 0;
        }
        nextProgress[nextLevelTarget.diff] = nextDiffProgress;
      }

      return nextProgress;
    });

    setHighScores(prev => {
      let newDiffScores = [...(prev[diff] || [])];
      const currentHS = newDiffScores[levelIdx] || 0;
      if (finalLevelScore > currentHS) {
        newDiffScores[levelIdx] = finalLevelScore;
      }
      return { ...prev, [diff]: newDiffScores };
    });
  }, [
    diff,
    gridData,
    hp,
    levelIdx,
    markWon,
    maxComboStreak,
    nextLevelTarget,
    path,
    playMode,
    portalBestSteps,
    scoreRef,
    setCoins,
    setGlobalScore,
    setHighScores,
    setLevelReport,
    setPortalBestSteps,
    setPortalProgress,
    setProgress,
    timer
  ]);

  const handleRevive = useCallback(() => {
    if (reviveWithCoins()) {
      setHp(CONFIG[diff].hp);
      setStatus('playing');
    } else {
      showToast('金币不足无法复活！');
    }
  }, [diff, reviveWithCoins, setHp, setStatus, showToast]);

  const handleLose = useCallback(() => {
    markLost();
  }, [markLost]);

  return {
    handleWin,
    handleLose,
    handleRevive,
    nextLevelTarget
  };
}
