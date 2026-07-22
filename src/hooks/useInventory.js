import { useCallback, useEffect, useRef, useState } from 'react';
import {
  safeReadFiniteNumber,
  safeReadJsonStorage,
  safeSetStorageItem
} from '../utils/safeStorage.js';

export const SHOP = { heal: 15, exclude: 15, hint: 25, revive: 30 };

const ITEM_NAMES = { heal: '恢复', exclude: '排除', hint: '提示' };
const DEFAULT_ITEMS = { heal: 3, exclude: 3, hint: 3 };

const readStoredCoins = () => {
  const stored = safeReadFiniteNumber('cg_coins', 100);
  return stored >= 0 ? Math.trunc(stored) : 100;
};

const readStoredItems = () => {
  const stored = safeReadJsonStorage('cg_items', DEFAULT_ITEMS);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...DEFAULT_ITEMS };
  const normalized = {};
  for (const [key, fallback] of Object.entries(DEFAULT_ITEMS)) {
    const value = Number(stored[key]);
    normalized[key] = Number.isFinite(value) && value >= 0 ? Math.trunc(value) : fallback;
  }
  return normalized;
};

function useGatedState(initializer) {
  const [value, setValueState] = useState(initializer);
  const persistGate = useRef(false);
  const setValue = useCallback((valueOrFn) => {
    persistGate.current = true;
    setValueState(valueOrFn);
  }, []);
  return [value, setValue, persistGate];
}

export default function useInventory() {
  const [coins, setCoins, coinsPersistGate] = useGatedState(readStoredCoins);
  const [items, setItems, itemsPersistGate] = useGatedState(readStoredItems);
  const [purchasePrompt, setPurchasePrompt] = useState(null);

  useEffect(() => {
    if (coinsPersistGate.current && safeSetStorageItem('cg_coins', coins.toString())) {
      coinsPersistGate.current = false;
    }
    if (itemsPersistGate.current && safeSetStorageItem('cg_items', JSON.stringify(items))) {
      itemsPersistGate.current = false;
    }
  }, [coins, items]);

  const hasItem = useCallback((type) => items[type] > 0, [items]);

  const canAfford = useCallback((cost) => coins >= cost, [coins]);

  const consumeItem = useCallback((type) => {
    setItems(prev => ({ ...prev, [type]: prev[type] - 1 }));
  }, []);

  const spendCoinsForItem = useCallback((type) => {
    setCoins(prev => prev - SHOP[type]);
  }, []);

  const openPurchasePrompt = useCallback((type) => {
    setPurchasePrompt({ type, cost: SHOP[type], name: ITEM_NAMES[type] });
  }, []);

  const closePurchasePrompt = useCallback(() => {
    setPurchasePrompt(null);
  }, []);

  const buyPromptItem = useCallback(() => {
    if (!purchasePrompt) return null;

    setCoins(prev => prev - purchasePrompt.cost);
    setItems(prev => ({ ...prev, [purchasePrompt.type]: prev[purchasePrompt.type] + 1 }));
    const purchased = purchasePrompt;
    setPurchasePrompt(null);
    return purchased;
  }, [purchasePrompt]);

  const reviveWithCoins = useCallback(() => {
    if (coins < SHOP.revive) return false;
    setCoins(prev => prev - SHOP.revive);
    return true;
  }, [coins]);

  return {
    coins,
    setCoins,
    items,
    setItems,
    purchasePrompt,
    hasItem,
    canAfford,
    consumeItem,
    spendCoinsForItem,
    openPurchasePrompt,
    closePurchasePrompt,
    buyPromptItem,
    reviveWithCoins
  };
}
