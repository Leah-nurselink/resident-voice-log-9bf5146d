import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/professionals")({
  head: () => ({ meta: [{ title: "Professional Directory · ForgeAI" }] }),
  component: Page,
});

const ROLES = [
  "GP","Community Nurse","SALT","Dietitian","Physiotherapist","Occupational Therapist",
  "Social Worker","Mental Health Team","Tissue Viability Nurse","Safeguarding Team",
  "Palliative Care","Pharmacist","Consultant","Optician","Dentist","Chiropodist","Other",
];

type Pro = {
  id: string; name: string; role: string; organisation: string | null;
  email: string | null; phone: string | null; speciality: string | null;
  address: string | null; notes: string | null; is_active: boolean;
};

function Page() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Pro> | null>(null);

  const list = useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals").select("*").order("name");
      if (error) throw error;
      return data as Pro[];
    },
  });

  const filtered = (list.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [p.name, p.role, p.organisation, p.email, p.speciality]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.role) {
      toast.error("Name and role are required");
      return;
    }
    const payload = {
      name: editing.name, role: editing.role,
      organisation: editing.organisation ?? null,
      email: editing.email ?? null, phone: editing.phone ?? null,
      speciality: editing.speciality ?? null, address: editing.address ?? null,
      notes: editing.notes ?? null,
      is_active: editing.is_active ?? true,
    };
    if (editing.id) {
      const { error } = await supabase.from("professionals").update(payload as never).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("professionals").insert(payload as never);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["professionals"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this professional?")) return;
    const { error } = await supabase.from("professionals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["professionals"] });
  };

  return (
    <AppShell title="Professional Directory" subtitle="GPs, nurses, therapists, social workers and other healthcare contacts">
      <div className="mb-4 flex items-center gap-2">
        <Input placeholder="Search by name, role, organisation, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <Button onClick={() => setEditing({ is_active: true })}><Plus className="mr-1 h-4 w-4" /> Add professional</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> {p.name}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div><Badge variant="secondary">{p.role}</Badge> {p.speciality && <span className="ml-1 text-muted-foreground">· {p.speciality}</span>}</div>
              {p.organisation && <div className="text-muted-foreground">{p.organisation}</div>}
              {p.email && <div>📧 <a className="text-primary hover:underline" href={`mailto:${p.email}`}>{p.email}</a></div>}
              {p.phone && <div>☎ {p.phone}</div>}
              {p.address && <div className="text-muted-foreground">{p.address}</div>}
            </CardContent>
          </Card>
        ))}
        {!filtered.length && (
          <p className="text-sm text-muted-foreground">No professionals yet. Add your first contact.</p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} professional</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} /></div>
              <div>
                <Label>Role *</Label>
                <Select value={editing?.role ?? ""} onValueChange={(v) => setEditing({ ...editing!, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Organisation</Label><Input value={editing?.organisation ?? ""} onChange={(e) => setEditing({ ...editing!, organisation: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing!, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editing?.phone ?? ""} onChange={(e) => setEditing({ ...editing!, phone: e.target.value })} /></div>
            </div>
            <div><Label>Speciality</Label><Input value={editing?.speciality ?? ""} onChange={(e) => setEditing({ ...editing!, speciality: e.target.value })} /></div>
            <div><Label>Address</Label><Textarea rows={2} value={editing?.address ?? ""} onChange={(e) => setEditing({ ...editing!, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={editing?.notes ?? ""} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
