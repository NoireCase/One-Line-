import { useCallback, useEffect, useState } from 'react';

export const SHOP = { heal: 15, exclude: 15, hint: 25, revive: 30 };

const ITEM_NAMES = { heal: '恢复', exclude: '排除', hint: '提示' };

const readStoredCoins = () => {
  try {
    const sCoins = localStorage.getItem('cg_coins');
    return sCoins ? parseInt(sCoins) : 100;
  } catch {
    return 100;
  }
};

const readStoredItems = () => {
  try {
    const sItems = localStorage.getItem('cg_items');
    return sItems ? JSON.parse(sItems) : { heal: 3, exclude: 3, hint: 3 };
  } catch {
    return { heal: 3, exclude: 3, hint: 3 };
  }
};

export default function useInventory() {
  const [coins, setCoins] = useState(readStoredCoins);
  const [items, setItems] = useState(readStoredItems);
  const [purchasePrompt, setPurchasePrompt] = useState(null);

  useEffect(() => {
    localStorage.setItem('cg_coins', coins.toString());
    localStorage.setItem('cg_items', JSON.stringify(items));
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
