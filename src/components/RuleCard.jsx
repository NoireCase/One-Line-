import React from 'react';
import { Lightbulb, Play, Waypoints } from 'lucide-react';
import DiagonalAnimation from './DiagonalAnimation.jsx';

const ANIMATIONS = {
  diagonal: DiagonalAnimation
};

const CARD_META = {
  portal: {
    title: '传送门规则',
    subtitle: '跨点连接',
    icon: Waypoints
  },
  diagonal: {
    title: '新规则发现',
    subtitle: 'Rule unlocked',
    icon: Lightbulb
  }
};

export default function RuleCard({ discovery, onStart }) {
  if (!discovery) return null;

  const AnimComponent = ANIMATIONS[discovery.id];
  const meta = CARD_META[discovery.id] || CARD_META.diagonal;
  const IconComp = meta.icon;

  return (
    <div className="fixed inset-0 bg-[#060a13]/92 backdrop-blur-sm z-[100000] flex items-center justify-center p-6">
      <div className="bg-[#151a25] rounded-[28px] p-8 max-w-sm w-full text-center shadow-2xl border border-[#4a4a5d]/80">
        {/* Icon */}
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[#1a3a32] border border-[#6ee7b7]/30 flex items-center justify-center">
          <IconComp size={28} className="text-[#6ee7b7]" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-[#d7eee7] mb-1">
          {meta.title}
        </h2>
        <p className="text-[11px] text-[#8f8a7c] tracking-[0.2em] uppercase mb-5">{meta.subtitle}</p>

        {/* Animation Demo */}
        {AnimComponent && (
          <div className="mb-5">
            <AnimComponent />
          </div>
        )}

        {/* Rule Name Badge */}
        <div className="inline-block mb-5 px-4 py-1.5 rounded-full bg-[#1a3a32] border border-[#6ee7b7]/25">
          <span className="text-[#9bdccd] font-bold text-sm tracking-wide">{discovery.name}</span>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed mb-8 whitespace-pre-line">
          {discovery.description}
        </p>

        {/* Button */}
        <button
          onClick={onStart}
          className="w-full bg-[#1a3a32] hover:bg-[#224d42] text-[#c6f0e4] py-4 rounded-xl font-bold text-lg active:scale-95 transition flex items-center justify-center gap-2 border border-[#6ee7b7]/20"
        >
          <Play fill="currentColor" size={20} />
          {discovery.buttonText}
        </button>
      </div>
    </div>
  );
}
