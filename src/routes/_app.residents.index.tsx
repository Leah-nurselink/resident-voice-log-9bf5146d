import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ResidentCard } from "@/components/ResidentCard";
import { Input } from "@/components/ui/input";
import { careNotes, residents } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/residents/")({
  head: () => ({
    meta: [
      { title: "Residents · Caresound" },
      { name: "description", content: "Browse and document care for residents across the home." },
    ],
  }),
  component: ResidentsList,
});

function ResidentsList() {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      residents.filter((r) =>
        `${r.name} ${r.room} ${r.unit}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );
  const lastByResident = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of [...careNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (!map.has(n.residentId)) map.set(n.residentId, n.note);
    }
    return map;
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Residents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a resident to view their timeline or document new care.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, room or wing"
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((r) => (
          <ResidentCard key={r.id} resident={r} lastNote={lastByResident.get(r.id)} />
        ))}
      </div>
    </div>
  );
}
