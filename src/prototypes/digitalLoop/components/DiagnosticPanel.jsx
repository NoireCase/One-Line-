// P4B 数字环线 Spike · 诊断面板（原型级状态展示）

export default function DiagnosticPanel({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-5 font-mono" data-testid="diagnostic-panel">
      {items.map(({ label, value, tone = 'default' }) => (
        <div key={label} className="flex justify-between gap-2">
          <dt className="text-slate-500">{label}</dt>
          <dd
            data-testid={`diag-${label}`}
            className={[
              'text-right font-semibold',
              tone === 'ok' ? 'text-emerald-400'
                : tone === 'warn' ? 'text-amber-400'
                  : tone === 'bad' ? 'text-rose-400'
                    : 'text-slate-300',
            ].join(' ')}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
