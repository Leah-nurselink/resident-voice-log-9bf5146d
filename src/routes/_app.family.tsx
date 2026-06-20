import { createFileRoute } from "@tanstack/react-router";
import { Heart, MessageSquare } from "lucide-react";
import { careNotes, residents } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/family")({
  head: () => ({
    meta: [
      { title: "Family portal · Caresound" },
      { name: "description", content: "Approved updates shared with family members." },
    ],
  }),
  component: Family,
});

function Family() {
  // Show a curated subset that's safe to share with family
  const updates = careNotes
    .filter((n) => n.flags.length === 0)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Heart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Family portal</h1>
          <p className="text-sm text-muted-foreground">
            Approved updates shared with loved ones. Sensitive notes are never shown here.
          </p>
        </div>
      </header>

      <ul className="space-y-3">
        {updates.map((n) => {
          const r = residents.find((x) => x.id === n.residentId);
          return (
            <li key={n.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <img src={r?.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-medium">{r?.name}</div>
                  <div className="text-xs text-muted-foreground">{n.category}</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{n.note}</p>
              <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <MessageSquare className="h-3.5 w-3.5" />
                Send message to staff
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
