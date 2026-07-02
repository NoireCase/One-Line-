import { useCallback } from 'react';
import { CONFIG } from '../game/classic/createClassicLevel.js';
import { createLevelConfig, resolveRules } from '../game/rules/levelConfig.js';
import { getAllowedDirections, getCellIndex, isInsideBoard } from '../game/rules/movement.js';
import { SHOP } from './useInventory.js';

export default function useItemLogic({
  diff,
  levelIdx,
  playMode,
  path,
  gridData,
  setGridData,
  hp,
  setHp,
  status,
  hasItem,
  canAfford,
  consumeItem,
  spendCoinsForItem,
  openPurchasePrompt,
  showToast
}) {
  const executeItemLogic = useCallback((type, useInventory) => {
    let success = false;
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const N = levelConfig.portalLevel?.N || levelConfig.hiddenLevel?.N || CONFIG[diff].N;
    const rules = resolveRules(levelConfig);
    const tip = path[path.length - 1];
    const nextVal = path.length + 1;

    if (type === 'heal') {
      setHp(h => Math.min(h + 1, CONFIG[diff].hp));
      showToast('生命值已恢复 1 点！');
      success = true;
    } else if (type === 'exclude') {
      const r = Math.floor(tip / N), c = tip % N;
      let candidates = [];
      for (let [dr, dc] of getAllowedDirections(rules)) {
        let nr = r + dr, nc = c + dc;
        if (isInsideBoard(nr, nc, N)) {
          let idx = getCellIndex(nr, nc, N);
          let cell = gridData[idx];
          if (cell.isHidden && !cell.isRevealed && !cell.isExcluded && cell.val !== nextVal && !path.includes(idx)) {
            candidates.push(idx);
          }
        }
      }
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        setGridData(prev => {
          let nd = [...prev];
          nd[target] = { ...nd[target], isExcluded: true };
          return nd;
        });
        success = true;
      } else {
        showToast('周围没有可排除的未知错误格子！');
      }
    } else if (type === 'hint') {
      let targetIdx = gridData.findIndex(c => c.val === nextVal);
      if (targetIdx !== -1) {
        setGridData(prev => {
          let nd = [...prev];
          nd[targetIdx] = { ...nd[targetIdx], isHinted: true };
          return nd;
        });
        success = true;
      }
    }

    if (success) {
      if (useInventory) {
        consumeItem(type);
      } else {
        spendCoinsForItem(type);
        showToast(`已花费 ${SHOP[type]} 金币购买并使用道具！`);
      }
    }
  }, [diff, levelIdx, playMode, path, gridData, setGridData, setHp, consumeItem, spendCoinsForItem, showToast]);

  const handleUseItem = useCallback((type) => {
    if (status !== 'playing') return;
    const cost = SHOP[type];
    const useInventory = hasItem(type);

    const nextVal = path.length + 1;
    if (type === 'heal' && hp >= CONFIG[diff].hp) {
      showToast('生命值已满，无需恢复！');
      return;
    }
    if (type === 'hint') {
      let targetIdx = gridData.findIndex(c => c.val === nextVal);
      if (targetIdx !== -1) {
        let cell = gridData[targetIdx];
        if (!cell.isHidden || cell.isRevealed) {
          showToast('下一个数字已出现，请在棋盘上寻找！');
          return;
        }
        if (cell.isHinted) {
          showToast('已为您提示下一个数字，请勿重复使用道具！');
          return;
        }
      }
    }

    if (!useInventory && !canAfford(cost)) {
      showToast('您的金币或道具不足！');
      return;
    }

    if (!useInventory) {
      openPurchasePrompt(type);
      return;
    }

    executeItemLogic(type, true);
  }, [status, path.length, hp, gridData, diff, hasItem, canAfford, openPurchasePrompt, executeItemLogic, showToast]);

  return { handleUseItem };
}
