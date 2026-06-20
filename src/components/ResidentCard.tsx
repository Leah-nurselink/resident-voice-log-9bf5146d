import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Resident } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const riskStyles: Record<Resident["riskLevel"], string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/20 text-warning-foreground",
  high: "bg-destructive/15 text-destructive",
};

export function ResidentCard({ resident, lastNote }: { resident: Resident; lastNote?: string }) {
  return (
    <Link
      to="/residents/$id"
      params={{ id: resident.id }}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-primary/40 hover:shadow-elevated"
    >
      <img
        src={resident.photo}
        alt=""
        className="h-14 w-14 rounded-full object-cover ring-2 ring-secondary"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold">{resident.name}</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              riskStyles[resident.riskLevel],
            )}
          >
            {resident.riskLevel}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Room {resident.room} · {resident.unit}
        </div>
        {lastNote && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{lastNote}</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
