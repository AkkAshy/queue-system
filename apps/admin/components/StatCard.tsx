interface Props {
  eyebrow: string;
  value: string | number;
  unit?: string;
  hint?: string;
}

export function StatCard({ eyebrow, value, unit, hint }: Props) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800/40 p-6">
      <span className="eyebrow">{eyebrow}</span>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums text-paper-100">
          {value}
        </span>
        {unit && <span className="text-sm text-ink-400">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
