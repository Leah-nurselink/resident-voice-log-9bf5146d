import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { format } from "date-fns";
import type { Evidence } from "@/lib/care-intelligence";

export function ExplainPopover({
  title,
  rationale,
  evidence,
  className,
}: {
  title: string;
  rationale?: string;
  evidence: Evidence[];
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            "inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground " +
            (className ?? "")
          }
          aria-label="Why this insight?"
        >
          <Info className="h-3 w-3" /> Why?
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <p className="text-xs font-semibold">{title}</p>
        {rationale && <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>}
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Supporting evidence
        </p>
        {evidence.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No direct excerpts — derived from aggregate counts.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {evidence.map((e, i) => (
              <li key={i} className="rounded-md border bg-muted/40 p-2">
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{e.kind}</span>
                  <span>{format(new Date(e.date), "d MMM HH:mm")}</span>
                </div>
                <p className="mt-1 text-xs leading-snug">{e.snippet}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
          Derived deterministically from your records. Advisory only — clinical judgement required.
        </p>
      </PopoverContent>
    </Popover>
  );
}
