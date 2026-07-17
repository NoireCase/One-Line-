import React from 'react';
import { Lightbulb, Play, Waypoints } from 'lucide-react';
import DiagonalAnimation from './DiagonalAnimation.jsx';
import { getModeCopy } from '../config/gameExplanations.js';

const ANIMATIONS = {
  diagonal: DiagonalAnimation
};

const CARD_META = {
  portalClassic: {
    title: '空间传送',
    subtitle: getModeCopy('portalClassic').ruleCardSubtitle,
    icon: Waypoints,
    accentBorder: 'border-[#9a87c2]/40',
    accentBg: 'bg-[#2b2440]',
    accentText: 'text-[#d1c2ec]',
    badgeBg: 'bg-[#2b2440]',
    badgeBorder: 'border-[#9a87c2]/30',
    badgeText: 'text-[#d1c2ec]',
    btnBg: 'bg-[#2b2440] hover:bg-[#352e50]',
    btnBorder: 'border-[#9a87c2]/25',
    btnText: 'text-[#d1c2ec]',
  },
  diagonal: {
    title: '新规则发现',
    subtitle: '八向连线解锁',
    icon: Lightbulb,
    accentBorder: 'border-[#6ee7b7]/30',
    accentBg: 'bg-[#1a3a32]',
    accentText: 'text-[#9bdccd]',
    badgeBg: 'bg-[#1a3a32]',
    badgeBorder: 'border-[#6ee7b7]/25',
    badgeText: 'text-[#9bdccd]',
    btnBg: 'bg-[#1a3a32] hover:bg-[#224d42]',
    btnBorder: 'border-[#6ee7b7]/20',
    btnText: 'text-[#c6f0e4]',
  }
};

export default function RuleCard({ discovery, onStart }) {
  if (!discovery) return null;

  const AnimComponent = ANIMATIONS[discovery.id];
  const meta = CARD_META[discovery.id] || CARD_META.diagonal;
  const IconComp = meta.icon;

  return (
    <div className="fixed inset-0 bg-[#060a13]/92 backdrop-blur-sm z-[100000] flex items-center justify-center p-6">
      <div className={`bg-[#151a25] rounded-[28px] p-8 max-w-sm w-full text-center shadow-2xl border ${meta.accentBorder}`}>
        {/* Icon */}
        <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl ${meta.accentBg} ${meta.accentBorder} flex items-center justify-center`}>
          <IconComp size={28} className={meta.accentText} />
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
        <div className={`inline-block mb-5 px-4 py-1.5 rounded-full ${meta.badgeBg} ${meta.badgeBorder}`}>
          <span className={`font-bold text-sm tracking-wide ${meta.badgeText}`}>{discovery.name}</span>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed mb-8 whitespace-pre-line">
          {discovery.description}
        </p>

        {/* Button */}
        <button
          onClick={onStart}
          className={`w-full py-4 rounded-xl font-bold text-lg active:scale-95 transition flex items-center justify-center gap-2 border ${meta.btnBg} ${meta.btnText} ${meta.btnBorder}`}
        >
          <Play fill="currentColor" size={20} />
          {discovery.buttonText}
        </button>
      </div>
    </div>
  );
}
