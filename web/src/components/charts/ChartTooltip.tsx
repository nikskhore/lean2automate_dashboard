import type { TooltipProps } from "recharts";
import { formatMoney } from "@/lib/format";

/** Shared tooltip styled like a card. Values use money formatting; identity via colored dot + label. */
export function MoneyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-card p-3 text-xs shadow-lg">
      {label && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatMoney(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}
