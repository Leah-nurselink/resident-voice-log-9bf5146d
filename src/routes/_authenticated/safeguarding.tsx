import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Phone, Search, ShieldAlert, Plus, AlertTriangle, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { COUNCILS, type Council } from "@/lib/safeguarding-councils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/safeguarding")({
  head: () => ({
    meta: [
      { title: "Safeguarding · CareCore" },
      { name: "description", content: "Safeguarding concerns log and local referral contacts in CareCore." },
      { property: "og:title", content: "Safeguarding · CareCore" },
      { property: "og:description", content: "Safeguarding concerns log and local referral contacts in CareCore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SafeguardingPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">{(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

// Care Act 2014 categories of abuse.
const ABUSE = [
  "Physical", "Neglect / acts of omission", "Psychological / emotional", "Financial / material",
  "Sexual", "Organisational / institutional", "Discriminatory", "Domestic", "Modern slavery", "Self-neglect",
];
// Local-authority safeguarding workflow.
const SG_STATUS = ["Concern raised", "Referred to Local Authority", "S42 enquiry underway", "Outcome / no further action", "Closed"] as const;
type SgStatus = (typeof SG_STATUS)[number];
const SEVERITIES = ["low", "moderate", "high", "critical"] as const;

const statusClass = (s: string): string => {
  switch (s) {
    case "Closed": case "Outcome / no further action": return "bg-success/15 text-success-foreground border border-success/30";
    case "Referred to Local Authority": case "S42 enquiry underway": return "bg-warning/20 text-warning-foreground border border-warning/40";
    default: return "bg-destructive/15 text-destructive border border-destructive/30";
  }
};
const sevVariant = (s: string) => (s === "critical" || s === "high" ? "destructive" : s === "moderate" ? "default" : "secondary");

type Incident = {
  id: string; resident_id: string | null; incident_type: string; severity: string; occurred_at: string;
  location: string | null; description: string; immediate_action: string | null; injuries: string | null;
  witnesses: string | null; people_notified: string | null; safeguarding_concern: boolean; reporter_name: string | null;
  status: string; manager_review: string | null; follow_up_actions: string | null; created_at: string;
  safeguarding_category: string | null; safeguarding_status: string | null; consent_basis: string | null;
  assigned_to: string | null; review_due: string | null;
  la_referred_at: string | null; cqc_notified_at: string | null; police_notified_at: string | null;
};
type NameRow = { id: string; full_name: string | null };

function SafeguardingPage() {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [active, setActive] = useState<Incident | null>(null);

  const concerns = useQuery({
    queryKey: ["safeguarding-concerns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*").eq("safeguarding_concern", true).order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Incident[];
    },
  });
  const residents = useQuery({
    queryKey: ["residents-min"],
    queryFn: async () => { const { data } = await supabase.from("residents").select("id, full_name").order("full_name"); return (data ?? []) as NameRow[]; },
  });
  const staff = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("id, full_name").order("full_name"); return (data ?? []) as NameRow[]; },
  });
  const flagged = useQuery({
    queryKey: ["safeguarding-flagged-notes"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data } = await supabase.from("daily_notes").select("id, resident_id, content, created_at, flags")
        .contains("flags", ["safeguarding"]).gte("created_at", since).order("created_at", { ascending: false }).limit(20);
      return (data ?? []) as { id: string; resident_id: string | null; content: string; created_at: string }[];
    },
  });

  const residentName = (id: string | null) => residents.data?.find((r) => r.id === id)?.full_name ?? "Unknown resident";
  const staffName = (id: string | null) => (id ? staff.data?.find((s) => s.id === id)?.full_name ?? "Assigned" : null);

  const list = concerns.data ?? [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOpen = (c: Incident) => (c.safeguarding_status ?? "Concern raised") !== "Closed";
  const open = list.filter(isOpen);
  const overdue = open.filter((c) => c.review_due && new Date(c.review_due) < today);
  const referred = open.filter((c) => c.la_referred_at);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonth = list.filter((c) => new Date(c.occurred_at) >= monthStart);

  const stats = [
    { label: "Open concerns", value: open.length, icon: ShieldAlert, tone: "text-destructive" },
    { label: "Overdue reviews", value: overdue.length, icon: Clock, tone: overdue.length ? "text-destructive" : "text-muted-foreground" },
    { label: "Referred to LA", value: referred.length, icon: ExternalLink, tone: "text-warning-foreground" },
    { label: "Raised this month", value: thisMonth.length, icon: Plus, tone: "text-foreground" },
  ];

  return (
    <AppShell
      title="Safeguarding"
      subtitle="Concerns log & local contacts"
      action={
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        </Button>
      }
    >
      <div className="space-y-4 pb-24">
        <Tabs defaultValue="concerns">
          <TabsList>
            <TabsTrigger value="concerns">Concerns</TabsTrigger>
            <TabsTrigger value="contacts">Local contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="concerns" className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><s.icon className="h-3.5 w-3.5" />{s.label}</div>
                  <p className={`mt-1 text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <Button onClick={() => setRaiseOpen(true)} className="min-h-11 w-full sm:w-auto">
              <Plus className="h-4 w-4" />Raise a safeguarding concern
            </Button>

            {flagged.data && flagged.data.length > 0 && (
              <section className="rounded-xl border border-warning/40 bg-warning/5 p-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning-foreground" />AI-flagged in daily notes — review and raise if needed</h2>
                <div className="mt-2 space-y-2">
                  {flagged.data.map((n) => (
                    <div key={n.id} className="rounded-lg border bg-card p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{residentName(n.resident_id)}</span>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-base font-semibold">Concerns</h2>
              {concerns.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : list.length === 0 ? (
                <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No safeguarding concerns recorded. Use “Raise a safeguarding concern” above to log one.</p>
              ) : (
                list.map((c) => {
                  const st = (c.safeguarding_status ?? "Concern raised") as string;
                  const isOverdue = isOpen(c) && c.review_due && new Date(c.review_due) < today;
                  return (
                    <button key={c.id} type="button" onClick={() => setActive(c)} className="w-full rounded-xl border bg-card p-3 text-left hover:bg-accent/30">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{residentName(c.resident_id)}</span>
                        {c.safeguarding_category && <Badge variant="outline" className="text-[10px]">{c.safeguarding_category}</Badge>}
                        <Badge variant={sevVariant(c.severity)} className="text-[10px] capitalize">{c.severity}</Badge>
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(st)}`}>{st}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Raised {format(new Date(c.occurred_at), "d MMM yyyy")}{c.reporter_name ? ` by ${c.reporter_name}` : ""}</span>
                        {staffName(c.assigned_to) && <span>Lead: {staffName(c.assigned_to)}</span>}
                        {c.review_due && <span className={isOverdue ? "font-medium text-destructive" : ""}>Review {format(new Date(c.review_due), "d MMM")}{isOverdue ? " · overdue" : ""}</span>}
                        {c.la_referred_at && <span>LA referred</span>}
                        {c.cqc_notified_at && <span>CQC notified</span>}
                        {c.police_notified_at && <span>Police notified</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </section>
            <p className="text-xs text-muted-foreground">All changes are recorded in the audit log. This log supports, but does not replace, your local authority safeguarding referral process.</p>
          </TabsContent>

          <TabsContent value="contacts">
            <ContactsDirectory />
          </TabsContent>
        </Tabs>
      </div>

      {raiseOpen && <RaiseConcernDialog residents={residents.data ?? []} staff={staff.data ?? []} onClose={() => setRaiseOpen(false)} />}
      {active && <ConcernDetailDialog concern={active} residentName={residentName} staff={staff.data ?? []} onClose={() => setActive(null)} />}
    </AppShell>
  );
}

function RaiseConcernDialog({ residents, staff, onClose }: { residents: NameRow[]; staff: NameRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [residentId, setResidentId] = useState("");
  const [category, setCategory] = useState(ABUSE[0]);
  const [severity, setSeverity] = useState<string>("moderate");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [whoInvolved, setWhoInvolved] = useState("");
  const [immediate, setImmediate] = useState("");
  const [injuries, setInjuries] = useState("");
  const [consent, setConsent] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [reviewDue, setReviewDue] = useState("");
  const [laRef, setLaRef] = useState(false);
  const [cqc, setCqc] = useState(false);
  const [police, setPolice] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!description.trim()) return toast.error("Describe what happened before saving.");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const reporter = staff.find((s) => s.id === u.user?.id)?.full_name ?? null;
      const today = new Date().toISOString().slice(0, 10);
      const notified = [laRef && "Local Authority", cqc && "CQC", police && "Police"].filter(Boolean).join(", ") || null;
      const { error } = await supabase.from("incidents").insert({
        resident_id: residentId || null,
        incident_type: "Safeguarding concern",
        severity,
        occurred_at: new Date(occurredAt).toISOString(),
        location: location || null,
        description,
        immediate_action: immediate || null,
        injuries: injuries || null,
        witnesses: whoInvolved || null,
        people_notified: notified,
        safeguarding_concern: true,
        reporter_name: reporter,
        safeguarding_category: category,
        safeguarding_status: "Concern raised",
        consent_basis: consent || null,
        assigned_to: assignedTo || null,
        review_due: reviewDue || null,
        la_referred_at: laRef ? today : null,
        cqc_notified_at: cqc ? today : null,
        police_notified_at: police ? today : null,
      });
      if (error) throw error;
      toast.success("Safeguarding concern logged");
      qc.invalidateQueries({ queryKey: ["safeguarding-concerns"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the concern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Raise a safeguarding concern</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Resident</Label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger><SelectValue placeholder="Select resident (optional)" /></SelectTrigger>
              <SelectContent>{residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name ?? "Unnamed"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type of abuse</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ABUSE.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>When</Label><Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Where</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Room 4, lounge" /></div>
          </div>
          <div className="space-y-1.5"><Label>What happened</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" placeholder="Factual account — what was seen, heard or disclosed." /></div>
          <div className="space-y-1.5"><Label>Who was involved</Label><Input value={whoInvolved} onChange={(e) => setWhoInvolved(e.target.value)} placeholder="People involved / witnesses" /></div>
          <div className="space-y-1.5"><Label>Immediate actions taken</Label><Textarea rows={2} value={immediate} onChange={(e) => setImmediate(e.target.value)} className="resize-none" placeholder="To keep the person safe right now." /></div>
          <div className="space-y-1.5"><Label>Injuries (if any)</Label><Input value={injuries} onChange={(e) => setInjuries(e.target.value)} placeholder="Describe; add a body map photo in the resident record." /></div>
          <div className="space-y-1.5"><Label>Consent / best-interest basis</Label><Textarea rows={2} value={consent} onChange={(e) => setConsent(e.target.value)} className="resize-none" placeholder="Did the person consent to a referral? If not, the best-interest reason." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned lead</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name ?? "Staff"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Review by</Label><Input type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Notified</Label>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={laRef} onCheckedChange={(v) => setLaRef(!!v)} />Local Authority safeguarding team</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={cqc} onCheckedChange={(v) => setCqc(!!v)} />CQC</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={police} onCheckedChange={(v) => setPolice(!!v)} />Police</label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Log concern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConcernDetailDialog({ concern, residentName, staff, onClose }: { concern: Incident; residentName: (id: string | null) => string; staff: NameRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SgStatus>((concern.safeguarding_status as SgStatus) ?? "Concern raised");
  const [assignedTo, setAssignedTo] = useState(concern.assigned_to ?? "");
  const [reviewDue, setReviewDue] = useState(concern.review_due ?? "");
  const [laRef, setLaRef] = useState(concern.la_referred_at ?? "");
  const [cqc, setCqc] = useState(concern.cqc_notified_at ?? "");
  const [police, setPolice] = useState(concern.police_notified_at ?? "");
  const [review, setReview] = useState(concern.manager_review ?? "");
  const [actions, setActions] = useState(concern.follow_up_actions ?? "");
  const [contactsOpen, setContactsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("incidents").update({
        safeguarding_status: status,
        assigned_to: assignedTo || null,
        review_due: reviewDue || null,
        la_referred_at: laRef || null,
        cqc_notified_at: cqc || null,
        police_notified_at: police || null,
        manager_review: review || null,
        follow_up_actions: actions || null,
      }).eq("id", concern.id);
      if (error) throw error;
      toast.success("Concern updated");
      qc.invalidateQueries({ queryKey: ["safeguarding-concerns"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed — only managers can update concerns.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{residentName(concern.resident_id)} — safeguarding concern</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {concern.safeguarding_category && <Badge variant="outline">{concern.safeguarding_category}</Badge>}
              <Badge variant={sevVariant(concern.severity)} className="capitalize">{concern.severity}</Badge>
              <span>Raised {format(new Date(concern.occurred_at), "d MMM yyyy, HH:mm")}{concern.reporter_name ? ` by ${concern.reporter_name}` : ""}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{concern.description}</p>
            {concern.immediate_action && <p className="mt-2"><span className="font-medium">Immediate action: </span>{concern.immediate_action}</p>}
            {concern.witnesses && <p className="mt-1"><span className="font-medium">Involved: </span>{concern.witnesses}</p>}
            {concern.consent_basis && <p className="mt-1"><span className="font-medium">Consent basis: </span>{concern.consent_basis}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SgStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SG_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned lead</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name ?? "Staff"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Review by</Label><Input type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label className="text-xs">LA referred</Label><Input type="date" value={laRef} onChange={(e) => setLaRef(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">CQC notified</Label><Input type="date" value={cqc} onChange={(e) => setCqc(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Police notified</Label><Input type="date" value={police} onChange={(e) => setPolice(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Manager review / outcome</Label><Textarea rows={3} value={review} onChange={(e) => setReview(e.target.value)} className="resize-none" /></div>
          <div className="space-y-1.5"><Label>Follow-up actions</Label><Textarea rows={2} value={actions} onChange={(e) => setActions(e.target.value)} className="resize-none" /></div>

          <Button variant="outline" className="w-full" onClick={() => setContactsOpen(true)}>
            <ExternalLink className="h-4 w-4" />Find local authority referral contact
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
      {contactsOpen && (
        <Dialog open onOpenChange={() => setContactsOpen(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Local safeguarding contacts</DialogTitle></DialogHeader>
            <ContactsDirectory compact />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

function ContactsDirectory({ compact }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<"All" | "England" | "Scotland" | "Wales">("All");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNCILS.filter((c) => {
      if (country !== "All" && c.country !== country) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.region?.toLowerCase().includes(q) ?? false);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, country]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Adult safeguarding contacts across England, Scotland and Wales. Always verify referral details locally before raising a concern.</p>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search by council or region" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by council or region…" className="min-h-11 pl-9 text-base" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["All", "England", "Scotland", "Wales"] as const).map((c) => (
          <Button key={c} size="sm" variant={country === c ? "default" : "outline"} onClick={() => setCountry(c)}>{c}</Button>
        ))}
      </div>
      <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
        {filtered.slice(0, compact ? 20 : 400).map((c) => <CouncilCard key={`${c.name}-${c.region ?? ""}`} council={c} />)}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No matching council — try the search instead.</p>}
      </div>
    </div>
  );
}

function CouncilCard({ council }: { council: Council }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <CardTitle className="min-w-0 break-words text-base font-semibold leading-tight">{council.name}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">{council.country}</Badge>
        </div>
        {council.region && <p className="text-xs text-muted-foreground">{council.region}</p>}
      </CardHeader>
      <CardContent className="mt-auto space-y-2 pt-2">
        {council.phone && (
          <a href={`tel:${council.phone.replace(/\s+/g, "")}`} className="flex min-h-11 items-center gap-2 rounded-md text-sm text-foreground hover:text-primary">
            <Phone className="h-3.5 w-3.5" />{council.phone}
          </a>
        )}
        <Button asChild size="sm" className="min-h-11 w-full justify-between">
          <a href={council.safeguardingUrl} target="_blank" rel="noreferrer">Go to safeguarding page<ExternalLink className="h-3.5 w-3.5" /></a>
        </Button>
        <Button asChild size="sm" variant="ghost" className="min-h-11 w-full justify-between text-sm">
          <a href={`https://www.google.com/search?q=${encodeURIComponent(`${council.name} council adult safeguarding referral`)}`} target="_blank" rel="noreferrer">Search instead<Search className="h-3.5 w-3.5" /></a>
        </Button>
      </CardContent>
    </Card>
  );
}
