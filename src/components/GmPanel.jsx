import { useState, useRef } from 'react';
import { X, ShieldAlert } from 'lucide-react';

export default function GmPanel({
  show,
  onClose,
  view,
  showToast,
  setCoins,
  setItems,
  gridData,
  setGridData,
  setPath,
  setTimer,
  handleWin,
  maxComboStreak
}) {
  const [gmPos, setGmPos] = useState({ x: 20, y: 80 });
  const gmDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const onGmPointerDown = (e) => {
    gmDragRef.current.isDragging = true;
    gmDragRef.current.startX = e.clientX;
    gmDragRef.current.startY = e.clientY;
    gmDragRef.current.initialX = gmPos.x;
    gmDragRef.current.initialY = gmPos.y;
    e.target.setPointerCapture(e.pointerId);
  };

  const onGmPointerMove = (e) => {
    if (!gmDragRef.current.isDragging) return;
    setGmPos({
      x: gmDragRef.current.initialX + (e.clientX - gmDragRef.current.startX),
      y: gmDragRef.current.initialY + (e.clientY - gmDragRef.current.startY)
    });
  };

  const onGmPointerUp = (e) => {
    gmDragRef.current.isDragging = false;
    e.target.releasePointerCapture(e.pointerId);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bg-slate-900 border-2 border-emerald-500 rounded-xl p-3 shadow-2xl z-[9998] text-white cursor-move w-64 select-none opacity-95"
      style={{ left: gmPos.x, top: gmPos.y, touchAction: 'none' }}
      onPointerDown={onGmPointerDown}
      onPointerMove={onGmPointerMove}
      onPointerUp={onGmPointerUp}
      onPointerCancel={onGmPointerUp}
    >
      <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 pointer-events-none">
        <h3 className="font-bold flex items-center gap-1 text-emerald-400 text-sm"><ShieldAlert size={16} /> GM 控制台</h3>
        <button onClick={onClose} className="pointer-events-auto active:scale-90 hover:bg-slate-800 p-1 rounded-md"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 pointer-events-auto">
        <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => setCoins(c => c + 99999)}>+99999 金币</button>
        <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => setItems({heal: 999, exclude: 999, hint: 999})}>道具 999</button>
        <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => {
          if (view !== 'game') { showToast('请在关卡内使用！'); return; }
          let n = [...gridData]; n.forEach(c => c.isRevealed = true);
          setGridData(n);
        }}>显示全图暗牌</button>
        <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => {
          if (view !== 'game') { showToast('请在关卡内使用！'); return; }
          let fullPath = [];
          let sorted = [...gridData].map((v, i) => ({v: v.val, i})).sort((a,b)=>a.v-b.v);
          sorted.forEach(x => fullPath.push(x.i));
          setPath(fullPath); setTimer(0);
          setTimeout(() => { handleWin(fullPath, maxComboStreak); }, 500);
        }}>一键通关</button>
      </div>
    </div>
  );
}
