import { useCallback, useMemo } from 'react';
import { getClassicLevelTargetByNumber, getLevelsPerDiff } from '../config/gameModes.js';
import { playComboTone } from '../config/soundEngine.js';
import { CONFIG } from '../game/classic/createClassicLevel.js';
import { calculateLevelScoreReport } from '../game/scoring/scoreEngine.js';
import { createLevelConfig } from '../game/rules/levelConfig.js';
import { isHiddenMode } from '../config/gameModes.js';
import { getHiddenLevelCount } from '../data/hiddenLevels.js';
import { getStarLineLevelCount, isStarLineMode } from '../game/starLine/starLineRules.js';
import { getNormalLevelLinearIndex } from '../utils/levelNavigation.js';
import {
  calculatePortalStars,
  getPortalLevelCount,
  isPortalMode,
  normalizePortalBestStepsDiff,
  normalizePortalProgressDiff
} from '../game/portal/portalRules.js';

const getNextLevelTarget = (playMode, diff, levelIdx) => {
  if (isPortalMode(playMode)) {
    return levelIdx + 1 < getPortalLevelCount(playMode) ? { diff, levelIdx: levelIdx + 1 } : null;
  }
  if (isHiddenMode(playMode)) {
    return levelIdx + 1 < getHiddenLevelCount() ? { diff, levelIdx: levelIdx + 1 } : null;
  }
  if (isStarLineMode(playMode)) {
    return levelIdx + 1 < getStarLineLevelCount() ? { diff, levelIdx: levelIdx + 1 } : null;
  }

  const currentLinearIndex = getNormalLevelLinearIndex(playMode, diff, levelIdx);
  return getClassicLevelTargetByNumber(playMode, currentLinearIndex + 2);
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
  setHiddenProgress,
  setStarLineProgress,
  reviveWithCoins,
  showToast,
  markWon,
  markLost
}) {
  const nextLevelTarget = useMemo(
    () => {
      return getNextLevelTarget(playMode, diff, levelIdx);
    },
    [diff, levelIdx, playMode]
  );

  const handleWin = useCallback((completedPath = path, finalMaxCombo = maxComboStreak) => {
    markWon();
    playComboTone(999);

    const config = CONFIG[diff];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);

    if (levelConfig.hiddenLevel) {
      // Hidden / 极简线索：只记录通关，无分数/金币/星级
      const hl = levelConfig.hiddenLevel;
      setLevelReport({
        isHidden: true,
        hiddenTitle: hl.title,
        hiddenKeyCount: hl.keyNumbers.length,
        steps: completedPath.length - 1,
        pathLength: completedPath.length,
        totalCells: hl.N * hl.N,
        elapsedTime: timer
      });

      setHiddenProgress(prev => {
        const arr = [...(prev.hidden || [])];
        while (arr.length <= levelIdx) arr.push(0);
        arr[levelIdx] = 1;
        return { hidden: arr };
      });
      return;
    }

    if (levelConfig.portalLevel) {
      const portalLevel = levelConfig.portalLevel;
      const levelId = portalLevel.id;
      const steps = completedPath.length - 1;
      const pathLength = completedPath.length;
      const stars = calculatePortalStars(steps, portalLevel.targetSteps);
      const currentBestSteps = portalBestSteps[diff]?.[levelId] || 0;
      const bestSteps = currentBestSteps > 0 ? Math.min(currentBestSteps, steps) : steps;

      setLevelReport({
        isPortal: true,
        steps,
        pathLength,
        bestSteps,
        targetSteps: portalLevel.targetSteps,
        stars,
        coinReward: 0
      });

      setPortalProgress(prev => {
        const currentDiff = normalizePortalProgressDiff(prev[diff], playMode);
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
        const currentDiff = normalizePortalBestStepsDiff(prev[diff], playMode);
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

    if (levelConfig.starLineLevel) {
      const sl = levelConfig.starLineLevel;
      setLevelReport({
        isStarLine: true,
        title: sl.name,
        placedStars: sl.N,
        totalStars: sl.N,
        stars: 3
      });

      setStarLineProgress(prev => {
        const next = { ...prev };
        next.completed = { ...(next.completed || {}), [String(levelIdx)]: 3 };
        if (nextLevelTarget) {
          next.unlockedThrough = Math.max(next.unlockedThrough || 0, nextLevelTarget.levelIdx);
        }
        return next;
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
    setHiddenProgress,
    setStarLineProgress,
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

  const handleDevWin = useCallback((completedPath, finalMaxCombo, candidate) => {
    markWon({ skipStorageClear: true });

    const steps = completedPath.length - 1;
    const optimalSteps = candidate.path.length - 1;
    let stars = 1;
    if (steps <= optimalSteps) stars = 3;
    else if (steps <= Math.ceil(optimalSteps * 1.2)) stars = 2;

    setLevelReport({
      isDevCandidate: true,
      steps,
      optimalSteps,
      pathLength: completedPath.length,
      stars,
      candidate,
      totalScore: 0,
      coinReward: 0
    });
  }, [markWon, setLevelReport]);

  const handleDevLose = useCallback(() => {
    markLost();
  }, [markLost]);

  return {
    handleWin,
    handleLose,
    handleDevWin,
    handleDevLose,
    handleRevive,
    nextLevelTarget
  };
}
