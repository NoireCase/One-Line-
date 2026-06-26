import { getComboMultiplier } from '../../config/comboEngine.js';

export const SCORE_CONFIG = {
  visibleStep: 10,
  hiddenStep: 30,
  hpBonus: 500,
  timeBonus: 15,
  comboBonus: 50,
  starThresholds: {
    two: 0.6,
    three: 0.9
  }
};

export const calculateLevelScoreReport = ({ config, gridData, baseScore, hp, timer, maxCombo }) => {
  const L = config.N * config.N;
  const hiddenCount = gridData.filter(c => c.isHidden).length;
  const maxSteps = L - 1;

  const rawBaseScore = hiddenCount * SCORE_CONFIG.hiddenStep + (maxSteps - hiddenCount) * SCORE_CONFIG.visibleStep;
  const maxBaseScore = Math.floor(rawBaseScore * getComboMultiplier(maxSteps));
  const maxHpBonus = config.hp * SCORE_CONFIG.hpBonus;
  const maxTimeBonus = config.times[1] * SCORE_CONFIG.timeBonus;
  const maxMcBonus = maxSteps * SCORE_CONFIG.comboBonus;
  const sMax = maxBaseScore + maxHpBonus + maxTimeBonus + maxMcBonus;

  const timeBonus = Math.max(0, (config.times[1] - timer) * SCORE_CONFIG.timeBonus);
  const lifeBonus = hp * SCORE_CONFIG.hpBonus;
  const comboBonus = maxCombo * SCORE_CONFIG.comboBonus;
  const ruleBonus = 0;
  const totalScore = baseScore + lifeBonus + timeBonus + comboBonus + ruleBonus;

  let stars = 1;
  if (totalScore >= sMax * SCORE_CONFIG.starThresholds.three) stars = 3;
  else if (totalScore >= sMax * SCORE_CONFIG.starThresholds.two) stars = 2;

  return {
    completionScore: baseScore,
    timeBonus,
    lifeBonus,
    comboBonus,
    ruleBonus,
    totalScore,
    sMax,
    stars,
    base: baseScore,
    hpBonus: lifeBonus,
    mcBonus: comboBonus,
    totalLevelScore: totalScore
  };
};
