import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HIGHLIGHT_PERIODS, loadHighlights, type HighlightPeriod } from "@/lib/resident-highlights";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function ResidentHighlights({ residentId }: { residentId: string }) {
  const [period, setPeriod] = useState<HighlightPeriod>("7d");
  const { data, isLoading } = useQuery({
    queryKey: ["highlights", residentId, period],
    queryFn: () => loadHighlights(residentId, period),
  });

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Highlights</p>
        <div className="flex gap-1">
          {HIGHLIGHT_PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`rounded-full border px-3 py-1 text-xs ${period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading || !data ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : (
        <>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.summary.map((s, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{s}</span></li>)}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.areas.map((a) => (
              <div key={a.id} className="rounded-lg border p-2.5">
                <p className="text-xs text-muted-foreground">{a.label}</p>
                <p className="text-lg font-semibold">{a.count}</p>
                {a.concerns > 0 && <Badge variant="outline" className="text-[10px] text-amber-700">{a.concerns} concern{a.concerns > 1 ? "s" : ""}</Badge>}
              </div>
            ))}
            <div className="rounded-lg border p-2.5">
              <p className="text-xs text-muted-foreground">Health professionals</p>
              <p className="text-lg font-semibold">{data.professionalTotal}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Drawn from recorded notes, medication, pain and communications. For staff review — not a diagnosis.</p>
        </>
      )}
    </div>
  );
}
