import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/incident-review")({
  head: () => ({
    meta: [
      { title: "Incident Review · CareCore" },
      { name: "description", content: "Report incidents and complete manager reviews in CareCore." },
      { property: "og:title", content: "Incident Review · CareCore" },
      { property: "og:description", content: "Report incidents and complete manager reviews in CareCore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IncidentReviewPage,
});

const TYPES = ["Fall", "Medication error", "Skin tear / injury", "Pressure ulcer", "Behaviour / altercation", "Safeguarding concern", "Missing person", "Missing property", "Near miss", "Equipment failure", "Infection", "Other"];
const SEVERITIES = ["low", "moderate", "high", "critical"] as const;
const sevVariant = (s: string) => (s === "critical" || s === "high" ? "destructive" : s === "moderate" ? "default" : "secondary");

type Incident = {
  id: string; resident_id: string | null; incident_type: string; severity: string; occurred_at: string;
  location: string | null; description: string; immediate_action: string | null; injuries: string | null;
  witnesses: string | null; people_notified: string | null; safeguarding_concern: boolean; reporter_name: string | null;
  status: string; manager_review: string | null; root_cause: string | null; lessons_learned: string | null;
  follow_up_actions: string | null; closed_at: string | null; created_at: string;
  residents?: { full_name: string } | null;
};

const db = supabase as unknown as { from: (t: string) => any };

function useIsManager() {
  return useQuery({
    queryKey: ["is-manager"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role, approved, is_active").eq("user_id", u.user.id);
      return (data ?? []).some((r) => r.approved && r.is_active && (r.role === "admin" || r.role === "manager"));
    },
  }).data ?? false;
}

function IncidentReviewPage() {
  const qc = useQueryClient();
  const isManager = useIsManager();
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await db.from("incidents").select("*, residents(full_name)").order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Incident[];
    },
  });

  const groups = [
    { key: "open", label: "Open — awaiting manager review" },
    { key: "under_review", label: "Under review" },
    { key: "closed", label: "Closed" },
  ];
  const refresh = () => qc.invalidateQueries({ queryKey: ["incidents"] });

  return (
    <AppShell
      title="Incident Review"
      subtitle="Anyone can report an incident; managers review and close"
      action={<Button onClick={() => setReportOpen(true)}><Plus className="mr-1 h-4 w-4" />Report incident</Button>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {groups.map((g) => (
            <div key={g.key} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{g.label}</p>
              <p className="mt-1 text-2xl font-semibold">{incidents.filter((i) => i.status === g.key).length}</p>
            </div>
          ))}
        </div>

        {groups.map((g) => {
          const list = incidents.filter((i) => i.status === g.key);
          return (
            <section key={g.key} className="space-y-2">
              <h2 className="text-sm font-semibold">{g.label}</h2>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">None.</p>
              ) : list.map((i) => (
                <button key={i.id} onClick={() => setSelected(i)} className="w-full rounded-lg border bg-card p-3 text-left hover:bg-accent">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileSearch className="h-4 w-4 text-primary" />
                    <span className="font-medium">{i.incident_type}</span>
                    {i.residents?.full_name && <span className="text-sm text-muted-foreground">— {i.residents.full_name}</span>}
                    <Badge variant={sevVariant(i.severity)} className="capitalize">{i.severity}</Badge>
                    {i.safeguarding_concern && <Badge variant="destructive"><ShieldAlert className="mr-1 h-3 w-3" />Safeguarding</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(i.occurred_at).toLocaleString()}{i.location ? ` · ${i.location}` : ""}{i.reporter_name ? ` · reported by ${i.reporter_name}` : ""}
                  </p>
                </button>
              ))}
            </section>
          );
        })}
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} onSaved={refresh} />
      <ReviewDialog incident={selected} isManager={isManager} onClose={() => setSelected(null)} onSaved={refresh} />
    </AppShell>
  );
}

function ReportDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const blank = { resident_id: "none", incident_type: "", severity: "low", occurred_at: new Date().toISOString().slice(0, 16), location: "", description: "", immediate_action: "", injuries: "", witnesses: "", people_notified: "", safeguarding_concern: false, reporter_name: "" };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof blank, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const { data: residents = [] } = useQuery({
    queryKey: ["incident-residents"],
    queryFn: async () => (await supabase.from("residents").select("id, full_name").order("full_name")).data ?? [],
    enabled: open,
  });

  const save = async () => {
    if (!f.incident_type) return toast.error("Choose the type of incident");
    if (f.description.trim().length < 10) return toast.error("Describe what happened (at least 10 characters)");
    if (!f.reporter_name.trim()) return toast.error("Enter your name");
    if (new Date(f.occurred_at) > new Date()) return toast.error("Date/time cannot be in the future");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("incidents").insert({
      ...f,
      resident_id: f.resident_id === "none" ? null : f.resident_id,
      occurred_at: new Date(f.occurred_at).toISOString(),
      description: f.description.trim().slice(0, 5000),
      reported_by: u.user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Incident reported — a manager will review it");
    setF(blank); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Report an incident</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label>Type of incident *</Label>
            <Select value={f.incident_type} onValueChange={(v) => set("incident_type", v)}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Severity *</Label>
            <Select value={f.severity} onValueChange={(v) => set("severity", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Date & time *</Label><Input type="datetime-local" value={f.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} /></div>
          <div><Label>Location</Label><Input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Lounge, Room 12" maxLength={200} /></div>
          <div className="sm:col-span-2"><Label>Resident involved</Label>
            <Select value={f.resident_id} onValueChange={(v) => set("resident_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No resident / not applicable</SelectItem>
                {residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
              </SelectContent>
            </Select></div>
        </div>
        <div className="space-y-3">
          <div><Label>What happened? *</Label><Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Facts only: what you saw, heard and did" /></div>
          <div><Label>Immediate action taken</Label><Textarea value={f.immediate_action} onChange={(e) => set("immediate_action", e.target.value)} /></div>
          <div><Label>Injuries / harm</Label><Textarea value={f.injuries} onChange={(e) => set("injuries", e.target.value)} placeholder="None, or describe" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Witnesses</Label><Input value={f.witnesses} onChange={(e) => set("witnesses", e.target.value)} maxLength={500} /></div>
            <div><Label>Who was informed</Label><Input value={f.people_notified} onChange={(e) => set("people_notified", e.target.value)} placeholder="Nurse, GP, family…" maxLength={500} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.safeguarding_concern} onCheckedChange={(v) => set("safeguarding_concern", !!v)} /> This may be a safeguarding concern
          </label>
          <div><Label>Your name *</Label><Input value={f.reporter_name} onChange={(e) => set("reporter_name", e.target.value)} maxLength={100} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Submit report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ incident, isManager, onClose, onSaved }: { incident: Incident | null; isManager: boolean; onClose: () => void; onSaved: () => void }) {
  const [r, setR] = useState({ manager_review: "", root_cause: "", lessons_learned: "", follow_up_actions: "" });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (incident && loadedId !== incident.id) {
    setLoadedId(incident.id);
    setR({ manager_review: incident.manager_review ?? "", root_cause: incident.root_cause ?? "", lessons_learned: incident.lessons_learned ?? "", follow_up_actions: incident.follow_up_actions ?? "" });
  }
  if (!incident) return null;
  const closed = incident.status === "closed";
  const editable = isManager && !closed;

  const update = async (status: "under_review" | "closed") => {
    if (status === "closed" && !r.manager_review.trim()) return toast.error("Write the manager review before closing");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("incidents").update({ ...r, status, reviewed_by: u.user?.id, reviewed_at: new Date().toISOString() }).eq("id", incident.id);
    if (error) return toast.error(error.message);
    toast.success(status === "closed" ? "Incident closed" : "Review saved");
    onSaved(); onClose();
  };

  const Row = ({ label, value }: { label: string; value: string | null }) => value ? (
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="whitespace-pre-wrap text-sm">{value}</p></div>
  ) : null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {incident.incident_type}
            <Badge variant={sevVariant(incident.severity)} className="capitalize">{incident.severity}</Badge>
            <Badge variant="outline" className="capitalize">{incident.status.replace("_", " ")}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {new Date(incident.occurred_at).toLocaleString()}{incident.location ? ` · ${incident.location}` : ""}{incident.residents?.full_name ? ` · ${incident.residents.full_name}` : ""}
          </p>
        </DialogHeader>
        <div className="space-y-3 rounded-md border p-3">
          <Row label="What happened" value={incident.description} />
          <Row label="Immediate action" value={incident.immediate_action} />
          <Row label="Injuries / harm" value={incident.injuries} />
          <Row label="Witnesses" value={incident.witnesses} />
          <Row label="Informed" value={incident.people_notified} />
          <Row label="Reported by" value={incident.reporter_name} />
          {incident.safeguarding_concern && <Badge variant="destructive">Possible safeguarding concern</Badge>}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Manager review</h3>
          {!isManager && !closed && <p className="text-xs text-muted-foreground">Only an Admin or Registered Manager can review and close this incident.</p>}
          {([["manager_review", "Review findings *"], ["root_cause", "Root cause"], ["lessons_learned", "Lessons learned"], ["follow_up_actions", "Follow-up actions"]] as const).map(([k, label]) => (
            editable ? (
              <div key={k}><Label>{label}</Label><Textarea value={r[k]} onChange={(e) => setR((p) => ({ ...p, [k]: e.target.value }))} /></div>
            ) : <Row key={k} label={label.replace(" *", "")} value={r[k] || null} />
          ))}
          {closed && incident.closed_at && <p className="text-xs text-muted-foreground">Closed {new Date(incident.closed_at).toLocaleString()}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close window</Button>
          {editable && <>
            <Button variant="secondary" onClick={() => update("under_review")}>Save review</Button>
            <Button onClick={() => update("closed")}>Close incident</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
