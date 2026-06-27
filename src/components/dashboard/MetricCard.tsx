import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
}

export function MetricCard({ title, value, description, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 text-care-on-track" />
            ) : (
              <TrendingDown className="h-3 w-3 text-care-urgent" />
            )}
            <span className={trend.isPositive ? "text-care-on-track" : "text-care-urgent"}>
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-muted-foreground">vs last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
