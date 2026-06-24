// comboEngine.js —— 纯 path 驱动的 Combo 计算
// 与输入模式、点击速度、stroke 概念完全解耦

/**
 * 根据事件类型更新 combo 状态
 * @param {number} prevStreak - 当前连击数
 * @param {number} prevMax - 历史最大连击
 * @param {'success'|'failure'|'reset'} event
 * @returns {{ streak: number, max: number }}
 */
export function computeComboState(prevStreak, prevMax, event) {
  if (event === 'success') {
    const streak = prevStreak + 1;
    return { streak, max: Math.max(prevMax, streak) };
  }
  if (event === 'failure') {
    return { streak: 0, max: prevMax };
  }
  if (event === 'reset') {
    return { streak: 0, max: 0 };
  }
  return { streak: prevStreak, max: prevMax };
}

/**
 * Combo 倍率表（与视觉反馈联动）
 * 注意：倍率只影响分数显示，不修改评分体系
 */
export const COMBO_TIERS = [
  { min: 0,  multi: 1.0, text: '',          color: '' },
  { min: 2,  multi: 1.0, text: 'Nice',      color: 'from-emerald-300 to-emerald-500' },
  { min: 5,  multi: 1.2, text: 'Great',     color: 'from-blue-300 to-cyan-400' },
  { min: 10, multi: 1.5, text: 'Excellent', color: 'from-amber-300 to-yellow-400' },
  { min: 16, multi: 2.0, text: 'Perfect!',  color: 'from-rose-300 to-pink-400' }
];

export function getComboTier(combo) {
  let tier = COMBO_TIERS[0];
  for (let i = 1; i < COMBO_TIERS.length; i++) {
    if (combo >= COMBO_TIERS[i].min) tier = COMBO_TIERS[i];
  }
  return tier;
}

export function getComboMultiplier(combo) {
  return getComboTier(combo).multi;
}
