import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHROME, useIsDark } from "@/lib/chartTheme";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

/** Ranked horizontal bars for "top categories" (magnitude → single hue). */
export function HorizontalCategoryBar({ data }: { data: { name: string; total: string }[] }) {
  const dark = useIsDark();
  const c = dark ? CHROME.dark : CHROME.light;
  const bar = dark ? "#3987e5" : "#2a78d6"; // sequential blue, single hue

  if (data.length === 0) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data.</div>;
  }
  const rows = data.map((d) => ({ name: d.name, value: Number(d.total) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 48)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axis }} tickFormatter={(v) => formatMoneyCompact(v)} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fill: c.text, fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: c.grid, opacity: 0.3 }}
          contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 12 }}
          formatter={(value: number) => [formatMoney(value), "Total"]}
        />
        <Bar dataKey="value" fill={bar} radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
