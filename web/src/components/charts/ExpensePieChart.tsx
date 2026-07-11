import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MoneyTooltip } from "./ChartTooltip";
import { CATEGORICAL_DARK, CATEGORICAL_LIGHT, CHROME, topNWithOther, useIsDark } from "@/lib/chartTheme";
import { formatMoney } from "@/lib/format";
import type { PnlCategoryTotal } from "@/types";

export function ExpensePieChart({ data }: { data: PnlCategoryTotal[] }) {
  const dark = useIsDark();
  const palette = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const surface = dark ? CHROME.dark.surface : CHROME.light.surface;
  const textColor = dark ? CHROME.dark.text : CHROME.light.text;

  const slices = topNWithOther(data, 6);

  if (slices.length === 0) {
    return <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No expenses in this period.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          stroke={surface}
          strokeWidth={2}
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip content={<MoneyTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          formatter={(value: string, entry) => {
            // Legend supplies text identity (relief for low-contrast fills) plus the amount.
            const val = (entry?.payload as unknown as { value?: number })?.value ?? 0;
            return (
              <span style={{ color: textColor, fontSize: 12 }}>
                {value} · {formatMoney(val)}
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
