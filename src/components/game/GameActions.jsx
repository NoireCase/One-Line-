import { PlusCircle, Ban, Lightbulb, CircleDollarSign } from 'lucide-react';
import { SHOP } from '../../hooks/useInventory.js';

const ITEMS = [
  { id: 'heal', icon: PlusCircle, name: '恢复', desc: '恢复 1 点生命值', color: 'text-[#80b789]' },
  { id: 'exclude', icon: Ban, name: '排除', desc: '排查出一个错误干扰', color: 'text-[#c08386]' },
  { id: 'hint', icon: Lightbulb, name: '提示', desc: '点亮下一步的数字', color: 'text-[#d0b66e]' }
];

export default function GameActions({ items, onUseItem }) {
  return (
    <div className="flex justify-center gap-4 z-10 pt-2 pb-4 px-4">
      {ITEMS.map(item => (
        <button key={item.id} onClick={() => onUseItem(item.id)}
                className="group flex flex-col items-center gap-1 relative transition-transform active:scale-90">
          <div className="absolute -top-9 opacity-0 group-hover:opacity-100 bg-[#151b24] text-slate-200 text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 border border-white/[0.08] transition-opacity">
            {item.desc}
          </div>
          <div className="item-token w-14 h-14 flex items-center justify-center relative bg-[#212430] border border-[#666170]/75">
            <item.icon className={item.color} size={22} />
            {items[item.id] > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 bg-teal-700 text-teal-50 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items[item.id]}</span>
            ) : (
              <span className="absolute -bottom-1 bg-slate-900 text-slate-500 text-[10px] font-bold px-1 py-0 rounded-full border border-slate-700 flex items-center gap-0.5">
                <CircleDollarSign size={9} /> {SHOP[item.id]}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[#827b6e] font-medium">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
