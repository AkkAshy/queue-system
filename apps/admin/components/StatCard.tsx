interface Props {
  eyebrow: string;
  value: string | number;
  unit?: string;
  hint?: string;
}

export function StatCard({ eyebrow, value, unit, hint }: Props) {
  return (
    <div className="rounded-2xl border border-hair bg-card/40 p-6">
      <span className="eyebrow">{eyebrow}</span>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums text-coal">
          {value}
        </span>
        {unit && <span className="text-sm text-coal-3">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-coal-3">{hint}</p>}
    </div>
  );
}
