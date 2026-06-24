import React from 'react';
import { Lightbulb, Play } from 'lucide-react';
import DiagonalAnimation from './DiagonalAnimation.jsx';

const ANIMATIONS = {
  diagonal: DiagonalAnimation
};

export default function RuleCard({ discovery, onStart }) {
  if (!discovery) return null;

  const AnimComponent = ANIMATIONS[discovery.id];

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-300">
        {/* Icon */}
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Lightbulb size={28} className="text-emerald-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-emerald-400 mb-6">
          新规则发现
        </h2>

        {/* Rule Name Badge */}
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-emerald-300 font-black text-sm tracking-wide">{discovery.name}</span>
        </div>

        {/* Animation Demo */}
        <div className="mb-6">
          {AnimComponent ? (
            <AnimComponent />
          ) : (
            <div className="w-48 h-48 mx-auto bg-slate-700/50 rounded-2xl flex items-center justify-center text-slate-500 text-sm">
              演示区域
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-slate-300 text-sm leading-relaxed mb-8 whitespace-pre-line">
          {discovery.description}
        </p>

        {/* Button */}
        <button
          onClick={onStart}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
        >
          <Play fill="currentColor" size={20} />
          {discovery.buttonText}
        </button>
      </div>
    </div>
  );
}
