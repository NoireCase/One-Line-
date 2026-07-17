import { getModeCopy } from './gameExplanations.js';

export const RULE_DISCOVERIES = [
  {
    id: 'portalClassic',
    name: '经典传送门',
    description: getModeCopy('portalClassic').description,
    buttonText: '开始挑战',
    storageKey: 'cg_discovery_portal_classic',
    trigger: {
      mode: 'portalClassic',
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
