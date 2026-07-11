import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MoneyTooltip } from "./ChartTooltip";
import { CHROME, FLOW_COLORS, useIsDark } from "@/lib/chartTheme";
import { formatMoneyCompact, formatMonthShort } from "@/lib/format";
import type { CashFlowResponse } from "@/types";

export function InflowOutflowChart({ data }: { data: CashFlowResponse["monthly"] }) {
  const dark = useIsDark();
  const c = dark ? CHROME.dark : CHROME.light;
  const flow = dark ? FLOW_COLORS.dark : FLOW_COLORS.light;

  const rows = data.map((d) => ({
    month: formatMonthShort(d.month),
    Inflow: Number(d.inflow),
    Outflow: Number(d.outflow),
  }));

  if (rows.length === 0) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No cash flow in this period.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axis }} />
        <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatMoneyCompact(v)} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: c.grid, opacity: 0.3 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: c.text }} iconType="circle" />
        <Bar dataKey="Inflow" fill={flow.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Outflow" fill={flow.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
