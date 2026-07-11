import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = "default",
  sub,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: "default" | "success" | "destructive";
  sub?: string;
}) {
  const accentColor =
    accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {Icon && <Icon className={cn("h-4 w-4", accentColor)} />}
        </div>
        <div className={cn("mt-2 text-2xl font-bold tabular-nums", accentColor)}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
