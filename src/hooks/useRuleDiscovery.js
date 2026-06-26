import { useCallback, useState } from 'react';
import { findTriggeredDiscovery } from '../config/ruleDiscoveries.js';

export default function useRuleDiscovery() {
  const [ruleDiscovery, setRuleDiscovery] = useState(null);

  const requestRuleDiscovery = useCallback((targetPlayMode, diff, levelIdx) => {
    const discovery = findTriggeredDiscovery(targetPlayMode, diff, levelIdx);
    if (!discovery) return null;

    setRuleDiscovery({ discovery, d: diff, lvl: levelIdx, targetPlayMode });
    return discovery;
  }, []);

  const completeRuleDiscovery = useCallback(() => {
    if (!ruleDiscovery) return null;

    const pendingDiscovery = ruleDiscovery;
    localStorage.setItem(pendingDiscovery.discovery.storageKey, 'true');
    setRuleDiscovery(null);
    return pendingDiscovery;
  }, [ruleDiscovery]);

  const resetRuleDiscovery = useCallback(() => {
    setRuleDiscovery(null);
  }, []);

  return {
    ruleDiscovery,
    requestRuleDiscovery,
    completeRuleDiscovery,
    resetRuleDiscovery
  };
}
