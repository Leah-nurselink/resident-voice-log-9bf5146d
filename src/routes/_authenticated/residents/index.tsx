import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/residents/")({
  head: () => ({ meta: [{ title: "Residents · ForgeAI" }] }),
  component: ResidentsList,
});

function ResidentsList() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["residents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = data.filter((r) =>
    `${r.full_name} ${r.room_number ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell title="Residents" action={<NewResidentDialog onCreated={() => qc.invalidateQueries({ queryKey: ["residents"] })} />}>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or room…" className="pl-9" />
      </div>

      {filtered.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link to="/residents/$id" params={{ id: r.id }} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                    {r.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.room_number ? `Room ${r.room_number}` : "No room"}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">No residents yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a resident to start documenting care.</p>
        </div>
      )}
    </AppShell>
  );
}

function NewResidentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [dob, setDob] = useState("");
  const [nok, setNok] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("residents").insert({
        full_name: name,
        room_number: room || null,
        date_of_birth: dob || null,
        next_of_kin: nok ? { name: nok } : {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resident added");
      setOpen(false);
      setName(""); setRoom(""); setDob(""); setNok("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add resident</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New resident</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mary Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="12" />
            </div>
            <div className="space-y-1.5">
              <Label>Date of birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Next of kin</Label>
            <Input value={nok} onChange={(e) => setNok(e.target.value)} placeholder="Daughter — Jane Smith" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Add resident</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
