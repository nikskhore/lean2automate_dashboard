import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHROME, useIsDark } from "@/lib/chartTheme";
import { formatMoney, formatMoneyCompact, formatMonthShort } from "@/lib/format";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

/** Multi-line trend over months. valueKind controls Y-axis + tooltip formatting. */
export function LineTrendChart({
  data,
  series,
  valueKind = "money",
  height = 260,
}: {
  data: Record<string, unknown>[];
  series: TrendSeries[];
  valueKind?: "money" | "percent";
  height?: number;
}) {
  const dark = useIsDark();
  const c = dark ? CHROME.dark : CHROME.light;
  const fmtAxis = (v: number) => (valueKind === "percent" ? `${v}%` : formatMoneyCompact(v));
  const fmtTip = (v: number) => (valueKind === "percent" ? `${v}%` : formatMoney(v));

  const rows = data.map((d) => ({ ...d, monthLabel: formatMonthShort(String(d.month)) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
        <XAxis dataKey="monthLabel" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axis }} />
        <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={56} tickFormatter={fmtAxis} />
        <Tooltip
          contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: c.text }}
          formatter={(value: number, name: string) => [fmtTip(value), name]}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: c.text }} iconType="plainline" />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 2.5, fill: s.color }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
