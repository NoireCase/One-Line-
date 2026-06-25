export const RULE_DISCOVERIES = [
  {
    id: 'diagonal',
    name: '八方向连接',
    description: '现在可以向上下左右和四个斜向移动。\n利用新的连接方式，规划更灵活的路线。',
    buttonText: '开始挑战',
    storageKey: 'cg_discovery_diagonal',
    trigger: {
      mode: 'classic',
      diff: 'easy',
      levelIdx: 5
    }
  },
  {
    id: 'portal',
    name: '传送门规则',
    description: '进入传送门后，会从对应出口继续连线。\n传送段会断开显示，这不是失败。',
    buttonText: '开始挑战',
    storageKey: 'cg_discovery_portal',
    trigger: {
      mode: 'portal',
      diff: 'easy',
      levelIdx: 0
    }
  }
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
