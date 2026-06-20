import { AlertTriangle, Sparkles } from "lucide-react";
import type { CareNote } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const categoryColors: Record<string, string> = {
  "Personal care": "bg-primary/10 text-primary",
  "Nutrition & hydration": "bg-accent text-accent-foreground",
  Mobility: "bg-warning/20 text-warning-foreground",
  "Skin integrity": "bg-secondary text-secondary-foreground",
  "Emotional wellbeing": "bg-accent text-accent-foreground",
  "Family communication": "bg-secondary text-secondary-foreground",
  Medication: "bg-destructive/10 text-destructive",
  Sleep: "bg-secondary text-secondary-foreground",
  Safeguarding: "bg-destructive/15 text-destructive",
};

export function Timeline({ notes }: { notes: CareNote[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No care notes yet. Tap the microphone to document your first interaction.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {notes.map((n) => (
        <li key={n.id} className="relative">
          <span className="absolute -left-[29px] top-3 grid h-4 w-4 place-items-center rounded-full bg-primary ring-4 ring-background" />
          <article className="rounded-xl border border-border bg-card p-4 shadow-card">
            <header className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  categoryColors[n.category] ?? "bg-secondary text-secondary-foreground",
                )}
              >
                {n.category}
              </span>
              {n.flags.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {f}
                </span>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
            </header>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{n.note}</p>
            <details className="mt-2 group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" />
                View original transcript
              </summary>
              <p className="mt-2 rounded-md bg-muted p-3 text-xs italic text-muted-foreground">
                "{n.transcript}"
              </p>
            </details>
            <footer className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
              {n.author}
            </footer>
          </article>
        </li>
      ))}
    </ol>
  );
}
