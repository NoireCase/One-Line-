import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { STAR_LINE_DOUBLE_GUIDE_KEY } from '../hooks/useStarLineGuide.js';

/**
 * 双星首次进入提示。基础操作与规则教学已经移到棋盘内引导。
 */
export default function StarLineTutorial({ quota, operationReady = true, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (quota < 2 || !operationReady) {
      setVisible(false);
      return;
    }
    try {
      setVisible(!localStorage.getItem(STAR_LINE_DOUBLE_GUIDE_KEY));
    } catch { /* ignore */ }
  }, [operationReady, quota]);

  const handleClose = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STAR_LINE_DOUBLE_GUIDE_KEY, '1');
    } catch { /* ignore */ }
    onClose?.();
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
      <div
        className="surface-panel p-6 max-w-sm w-full"
        data-testid="star-line-double-tutorial"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">
            双星开始
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-500 hover:text-white transition active:scale-90"
            data-testid="star-line-tutorial-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-sm text-slate-300 leading-relaxed mb-5">
          <p>每行、每列和每片星域需要 <span className="text-amber-300 font-bold">2 个</span> 星点，相邻规则不变。</p>
        </div>

        <button
          onClick={handleClose}
          className="button-primary w-full py-2.5 text-sm font-bold"
          data-testid="star-line-tutorial-confirm"
        >
          开始挑战
        </button>
      </div>
    </div>
  );
}

export { STAR_LINE_DOUBLE_GUIDE_KEY as DOUBLE_STAR_KEY };
