export const RULE_DISCOVERIES = [
  {
    id: 'diagonal',
    name: '斜向连接',
    description: '现在你可以向八个方向移动。利用新的连接方式，规划更灵活的路线。',
    buttonText: '开始挑战',
    storageKey: 'cg_discovery_diagonal',
    trigger: {
      mode: 'classic',
      diff: 'easy',
      levelIdx: 5
    }
  }
  // 未来扩展:
  // { id: 'portal', ... },
  // { id: 'hidden', ... },
  // { id: 'obstacle', ... },
  // { id: 'oneway', ... }
];

export function getRuleDiscovery(ruleId) {
  return RULE_DISCOVERIES.find(r => r.id === ruleId) || null;
}

export function findTriggeredDiscovery(playMode, diff, levelIdx) {
  return RULE_DISCOVERIES.find(rule => {
    const t = rule.trigger;
    if (t.mode !== playMode) return false;
    if (t.diff !== diff) return false;
    if (t.levelIdx !== levelIdx) return false;
    const seen = localStorage.getItem(rule.storageKey);
    return seen !== 'true';
  }) || null;
}

export function getDiscoveredRules() {
  return RULE_DISCOVERIES.filter(rule => {
    const seen = localStorage.getItem(rule.storageKey);
    return seen === 'true';
  });
}
