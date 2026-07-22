import { useCallback, useState } from 'react';
import { findTriggeredDiscovery } from '../config/ruleDiscoveries.js';
import { safeSetStorageItem } from '../utils/safeStorage.js';

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
    safeSetStorageItem(pendingDiscovery.discovery.storageKey, 'true');
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
