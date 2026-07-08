import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const BASIC_KEY = 'cg_discovery_star_line_basic_v1';
const DOUBLE_STAR_KEY = 'cg_discovery_star_line_double_star_v1';

/**
 * Star Line 教学弹窗
 * - 基础教学：首次进入任意 Star Line 关卡时显示
 * - 双星提示：首次进入 Q=2 关卡时显示
 */
export default function StarLineTutorial({ quota, onClose }) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState(null); // 'basic' | 'double'

  useEffect(() => {
    if (quota == null) return;

    // Check double-star first (more specific)
    if (quota >= 2) {
      try {
        if (!localStorage.getItem(DOUBLE_STAR_KEY)) {
          setMode('double');
          setVisible(true);
          return;
        }
      } catch { /* ignore */ }
    }

    // Check basic tutorial
    try {
      if (!localStorage.getItem(BASIC_KEY)) {
        setMode('basic');
        setVisible(true);
      }
    } catch { /* ignore */ }
  }, [quota]);

  const handleClose = useCallback(() => {
    setVisible(false);
    try {
      if (mode === 'basic') localStorage.setItem(BASIC_KEY, '1');
      if (mode === 'double') localStorage.setItem(DOUBLE_STAR_KEY, '1');
    } catch { /* ignore */ }
    onClose?.();
  }, [mode, onClose]);

  if (!visible || !mode) return null;

  const isDouble = mode === 'double';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
      <div
        className="surface-panel p-6 max-w-sm w-full"
        data-testid={isDouble ? 'star-line-double-tutorial' : 'star-line-basic-tutorial'}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">
            {isDouble ? '双星开始' : '星线谜阵'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-500 hover:text-white transition active:scale-90"
            data-testid="star-line-tutorial-close"
          >
            <X size={18} />
          </button>
        </div>

        {isDouble ? (
          <div className="text-sm text-slate-300 leading-relaxed space-y-2 mb-5">
            <p>从这一关起，每一行、每一列、每片星域都需要放 <span className="text-amber-300 font-bold">2 个</span> 星点。</p>
            <p>星点仍然不能上下左右或斜向相邻。</p>
          </div>
        ) : (
          <div className="text-sm text-slate-300 leading-relaxed space-y-2 mb-5">
            <p>1. 每一行需要放入指定数量的星点。</p>
            <p>2. 每一列也需要放入指定数量的星点。</p>
            <p>3. 每片星域同样需要放入指定数量的星点。</p>
            <p>4. 星点不能上下左右或斜向相邻。</p>
          </div>
        )}

        <button
          onClick={handleClose}
          className="button-primary w-full py-2.5 text-sm font-bold"
          data-testid="star-line-tutorial-confirm"
        >
          {isDouble ? '开始挑战' : '知道了'}
        </button>
      </div>
    </div>
  );
}

export { BASIC_KEY, DOUBLE_STAR_KEY };
