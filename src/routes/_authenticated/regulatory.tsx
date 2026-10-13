import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Scale, Plus, FileText, CheckCircle2, BookOpen, Building2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/regulatory")({
  head: () => ({
    meta: [
      { title: "Regulatory · CareCore" },
      { name: "description", content: "CQC notifications log, policy register and registration details in CareCore." },
    ],
  }),
  component: RegulatoryPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">{(error as Error).message}</div>
  ),
});

const CQC_PORTAL = "https://www.cqc.org.uk/online-services/provider-portal";

// CQC statutory notification types (Care Quality Commission (Registration)
// Regulations 2009, regs 16–18). Submissions are made in the CQC portal; this
// logs that they were made.
const NOTIFICATION_TYPES = [
  "Death of a service user",
  "Serious injury to a service user",
  "Abuse or allegation of abuse",
  "Incident reported to or investigated by police",
  "Application to deprive of liberty (DoLS)",
  "DoLS authorisation outcome",
  "Event preventing the service running (fire, flood, outbreak, utilities)",
  "Infection outbreak",
  "Change to registered details",
  "Other notifiable event",
];
const NOTIF_STATUS = ["draft", "submitted", "acknowledged", "closed"] as const;
type NotifStatus = (typeof NOTIF_STATUS)[number];

const POLICY_SOURCES = ["Internal policy", "CQC guidance / bulletin", "Local Authority guidance", "Clinical / NICE", "Other"];
const POLICY_STATUS = ["active", "draft", "archived"] as const;

const notifStatusClass = (s: string): string => {
  switch (s) {
    case "acknowledged": case "closed": return "bg-success/15 text-success-foreground border border-success/30";
    case "submitted": return "bg-warning/20 text-warning-foreground border border-warning/40";
    default: return "bg-muted text-muted-foreground border";
  }
};

type Notification = {
  id: string; notification_type: string; regulator: string; summary: string; status: string;
  submitted_at: string | null; reference: string | null; outcome: string | null;
  submitter_name: string | null; created_at: string;
};
type Policy = {
  id: string; title: string; category: string | null; version: string | null; source: string | null;
  link_url: string | null; effective_date: string | null; review_date: string | null; status: string; notes: string | null;
};
type Registration = {
  provider_name: string | null; regulator: string | null; cqc_provider_id: string | null; cqc_location_id: string | null;
  registered_manager: string | null; nominated_individual: string | null; regulated_activities: string | null; conditions: string | null;
};

function RegulatoryPage() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const notifications = useQuery({
    queryKey: ["cqc-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cqc_notifications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("policies").select("*").order("status").order("title");
      if (error) throw error;
      return (data ?? []) as Policy[];
    },
  });

  const list = notifications.data ?? [];
  const openNotifs = list.filter((n) => n.status === "draft" || n.status === "submitted").length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = list.filter((n) => new Date(n.created_at) >= monthStart).length;
  const policyList = policies.data ?? [];
  const activePolicies = policyList.filter((p) => p.status === "active").length;

  return (
    <AppShell
      title="Regulatory"
      subtitle="CQC notifications, policies & registration"
      action={
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        </Button>
      }
    >
      <div className="space-y-4 pb-24">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm">
              <Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">CQC provider portal</p>
                <p className="text-muted-foreground">Statutory notifications are submitted in the portal. Record them here so the service keeps its own evidence trail.</p>
              </div>
            </div>
            <Button asChild className="min-h-11 shrink-0">
              <a href={CQC_PORTAL} target="_blank" rel="noreferrer">Open CQC portal<ExternalLink className="h-4 w-4" /></a>
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="notifications">
          <TabsList>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="registration">Registration</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <StatTile icon={FileText} label="Open / in progress" value={openNotifs} tone={openNotifs ? "text-warning-foreground" : "text-muted-foreground"} />
              <StatTile icon={CheckCircle2} label="Total logged" value={list.length} tone="text-foreground" />
              <StatTile icon={Plus} label="This month" value={thisMonth} tone="text-foreground" />
            </div>
            <Button onClick={() => setNotifOpen(true)} className="min-h-11 w-full sm:w-auto"><Plus className="h-4 w-4" />Record a notification</Button>

            <section className="space-y-2">
              {notifications.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : list.length === 0 ? (
                <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No notifications logged yet. When you submit a statutory notification in the CQC portal, record it here.</p>
              ) : (
                list.map((n) => (
                  <div key={n.id} className="rounded-xl border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{n.notification_type}</span>
                      <Badge variant="outline" className="text-[10px]">{n.regulator}</Badge>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${notifStatusClass(n.status)}`}>{n.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {n.submitted_at && <span>Submitted {format(new Date(n.submitted_at), "d MMM yyyy")}</span>}
                      {n.reference && <span>Ref {n.reference}</span>}
                      {n.submitter_name && <span>by {n.submitter_name}</span>}
                      {n.outcome && <span>Outcome: {n.outcome}</span>}
                    </div>
                  </div>
                ))
              )}
            </section>
            <p className="text-xs text-muted-foreground">This log is a record-keeping aid. The CQC portal remains the system of record for statutory notifications.</p>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={BookOpen} label="Active policies" value={activePolicies} tone="text-foreground" />
              <StatTile icon={FileText} label="Total" value={policyList.length} tone="text-muted-foreground" />
            </div>
            <Button onClick={() => setPolicyOpen(true)} className="min-h-11 w-full sm:w-auto"><Plus className="h-4 w-4" />Add a policy / update</Button>

            <section className="space-y-2">
              {policies.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : policyList.length === 0 ? (
                <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No policies added yet. Add a policy or an update received and your team can acknowledge it here.</p>
              ) : (
                policyList.map((p) => <PolicyRow key={p.id} policy={p} />)
              )}
            </section>
          </TabsContent>

          <TabsContent value="registration">
            <RegistrationTab />
          </TabsContent>
        </Tabs>
      </div>

      {notifOpen && <NotificationDialog onClose={() => setNotifOpen(false)} />}
      {policyOpen && <PolicyDialog onClose={() => setPolicyOpen(false)} />}
    </AppShell>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function NotificationDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState(NOTIFICATION_TYPES[0]);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<NotifStatus>("submitted");
  const [submittedAt, setSubmittedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!summary.trim()) return toast.error("Add a short summary before saving.");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let submitterName: string | null = null;
      if (u.user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
        submitterName = prof?.full_name ?? null;
      }
      const { error } = await supabase.from("cqc_notifications").insert({
        notification_type: type,
        regulator: "CQC",
        summary,
        status,
        submitted_at: status === "draft" ? null : submittedAt || null,
        reference: reference || null,
        outcome: outcome || null,
        submitter_name: submitterName,
      });
      if (error) throw error;
      toast.success("Notification recorded");
      qc.invalidateQueries({ queryKey: ["cqc-notifications"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record a CQC notification</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Notification type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NOTIFICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Summary</Label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} className="resize-none" placeholder="Brief factual summary — no need to duplicate the full portal submission." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as NotifStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTIF_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Submitted on</Label><Input type="date" value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} disabled={status === "draft"} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CQC reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. INS1-…" /></div>
            <div className="space-y-1.5"><Label>Outcome</Label><Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Acknowledged" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("");
  const [source, setSource] = useState(POLICY_SOURCES[0]);
  const [linkUrl, setLinkUrl] = useState("");
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));
  const [review, setReview] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast.error("Give the policy a title.");
    setSaving(true);
    try {
      const { error } = await supabase.from("policies").insert({
        title, category: category || null, version: version || null, source,
        link_url: linkUrl || null, effective_date: effective || null, review_date: review || null,
        status: "active", notes: notes || null,
      });
      if (error) throw error;
      toast.success("Policy added");
      qc.invalidateQueries({ queryKey: ["policies"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save — only managers can manage policies.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add a policy or update</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Medicines Management Policy" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Medicines, Safeguarding" /></div>
            <div className="space-y-1.5"><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. v4.2" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{POLICY_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Link to document</Label><Input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://… (SharePoint, Drive, etc.)" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Effective date</Label><Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Review by</Label><Input type="date" value={review} onChange={(e) => setReview(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none" placeholder="What changed / why staff need to read it." /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyRow({ policy }: { policy: Policy }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const acks = useQuery({
    queryKey: ["policy-acks", policy.id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, count } = await supabase.from("policy_acknowledgements")
        .select("user_id", { count: "exact" }).eq("policy_id", policy.id);
      const mine = !!data?.some((r) => r.user_id === u.user?.id);
      return { count: count ?? 0, mine };
    },
  });

  const acknowledge = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("policy_acknowledgements").insert({ policy_id: policy.id });
      if (error && !error.message.includes("duplicate")) throw error;
      toast.success("Marked as read");
      qc.invalidateQueries({ queryKey: ["policy-acks", policy.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record");
    } finally {
      setBusy(false);
    }
  };

  const overdue = policy.review_date && new Date(policy.review_date) < new Date();

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{policy.title}</span>
        {policy.version && <Badge variant="outline" className="text-[10px]">{policy.version}</Badge>}
        {policy.status !== "active" && <Badge variant="secondary" className="text-[10px] capitalize">{policy.status}</Badge>}
        {policy.source && <Badge variant="outline" className="text-[10px]">{policy.source}</Badge>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {policy.category && <span>{policy.category}</span>}
        {policy.effective_date && <span>Effective {format(new Date(policy.effective_date), "d MMM yyyy")}</span>}
        {policy.review_date && <span className={overdue ? "font-medium text-destructive" : ""}>Review {format(new Date(policy.review_date), "d MMM yyyy")}{overdue ? " · overdue" : ""}</span>}
        <span>{acks.data?.count ?? 0} read</span>
      </div>
      {policy.notes && <p className="mt-1 text-sm text-muted-foreground">{policy.notes}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {policy.link_url && (
          <Button asChild size="sm" variant="outline" className="min-h-10">
            <a href={policy.link_url} target="_blank" rel="noreferrer">Open document<ExternalLink className="h-3.5 w-3.5" /></a>
          </Button>
        )}
        <Button size="sm" className="min-h-10" onClick={acknowledge} disabled={busy || acks.data?.mine}>
          <CheckCircle2 className="h-3.5 w-3.5" />{acks.data?.mine ? "Read ✓" : "Mark as read"}
        </Button>
      </div>
    </div>
  );
}

function RegistrationTab() {
  const qc = useQueryClient();
  const reg = useQuery({
    queryKey: ["org-registration"],
    queryFn: async () => {
      const { data } = await supabase.from("org_registration").select("*").maybeSingle();
      return (data ?? null) as Registration | null;
    },
  });
  const [form, setForm] = useState<Registration | null>(null);
  const [saving, setSaving] = useState(false);
  const v = form ?? reg.data ?? {
    provider_name: "", regulator: "CQC", cqc_provider_id: "", cqc_location_id: "",
    registered_manager: "", nominated_individual: "", regulated_activities: "", conditions: "",
  };
  const set = (k: keyof Registration, val: string) => setForm({ ...v, [k]: val });

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("org_registration").upsert({ id: true, ...v, regulator: v.regulator || "CQC" });
      if (error) throw error;
      toast.success("Registration saved");
      qc.invalidateQueries({ queryKey: ["org-registration"] });
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save — only managers can edit registration.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, k: keyof Registration, placeholder?: string) => (
    <div className="space-y-1.5"><Label>{label}</Label><Input value={(v[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} /></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />The facts you get asked for most — kept in one place.</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Provider name", "provider_name", "e.g. Eleni Care Ltd")}
        {field("Main regulator", "regulator", "CQC")}
        {field("CQC provider ID", "cqc_provider_id", "1-…")}
        {field("CQC location ID", "cqc_location_id", "1-…")}
        {field("Registered manager", "registered_manager")}
        {field("Nominated individual", "nominated_individual")}
      </div>
      <div className="space-y-1.5"><Label>Regulated activities</Label><Textarea rows={2} value={v.regulated_activities ?? ""} onChange={(e) => set("regulated_activities", e.target.value)} className="resize-none" placeholder="e.g. Personal care; Accommodation for persons who require nursing or personal care" /></div>
      <div className="space-y-1.5"><Label>Conditions of registration</Label><Textarea rows={2} value={v.conditions ?? ""} onChange={(e) => set("conditions", e.target.value)} className="resize-none" /></div>
      <Button onClick={save} disabled={saving} className="min-h-11">{saving ? "Saving…" : "Save registration"}</Button>
    </div>
  );
}
