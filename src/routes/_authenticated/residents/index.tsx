import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Archive, Calendar, FileText, Heart, MapPin, Plus, Search, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ARCHIVED_STATUSES = ["Discharged", "Deceased"];

export const Route = createFileRoute("/_authenticated/residents/")({
  head: () => ({ meta: [{ title: "Residents · CareCore" }] }),
  component: ResidentsList,
});

function ResidentsList() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["residents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("*, daily_notes(content, created_at), risk_assessments(level)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const isArchived = (r: any) => ARCHIVED_STATUSES.includes(r.residency_status ?? "");
  const activeResidents = data.filter((r) => !isArchived(r));
  const archivedResidents = data.filter((r) => isArchived(r));
  const pool = view === "active" ? activeResidents : archivedResidents;

  const filtered = pool.filter((r) =>
    `${r.full_name ?? ""} ${r.room_number ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const highRiskCount = activeResidents.filter((r) =>
    (r.risk_assessments as { level: string }[] | null)?.some((x) => x.level === "high"),
  ).length;

  return (
    <AppShell
      title="Residents"
      subtitle="Manage resident profiles and care information"
      action={<NewResidentDialog onCreated={() => qc.invalidateQueries({ queryKey: ["residents"] })} />}
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBox icon={User} value={activeResidents.length} label="Active Residents" tone="primary" />
          <StatBox icon={Heart} value={activeResidents.filter((r) => r.room_number).length} label="In Rooms" tone="urgent" />
          <StatBox icon={AlertTriangle} value={highRiskCount} label="High Risk" tone="warning" />
          <StatBox icon={Archive} value={archivedResidents.length} label="Archived" tone="ontrack" />
        </div>

        {/* View tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as "active" | "archived")}>
          <TabsList>
            <TabsTrigger value="active">Active ({activeResidents.length})</TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="mr-1 h-3 w-3" /> Archived ({archivedResidents.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${view} residents by name or room…`}
            className="pl-10"
          />
        </div>


        {/* Grid */}
        {filtered.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => {
              const latestNote = (r.daily_notes as { content: string; created_at: string }[] | null)
                ?.slice()
                .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
              const risks = (r.risk_assessments as { level: string }[] | null) ?? [];
              const hasHigh = risks.some((x) => x.level === "high");
              const hasMed = risks.some((x) => x.level === "medium");
              const initials = (r.full_name ?? "?")
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("");

              return (
                <Link
                  key={r.id}
                  to="/residents/$id"
                  params={{ id: r.id }}
                  className="group"
                >
                  <Card className="h-full transition hover:shadow-elevated">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{r.full_name}</CardTitle>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              {r.date_of_birth && (
                                <>
                                  <span>Age {ageFrom(r.date_of_birth)}</span>
                                  <span>·</span>
                                </>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {r.room_number ? `Room ${r.room_number}` : "No room"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {isArchived(r) ? (
                          <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground">
                            <Archive className="mr-1 h-3 w-3" /> {r.residency_status}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              hasHigh
                                ? "border-care-urgent/40 bg-care-urgent/10 text-care-urgent"
                                : hasMed
                                  ? "border-care-attention/40 bg-care-attention/20 text-care-attention"
                                  : "border-care-on-track/40 bg-care-on-track/10 text-care-on-track"
                            }
                          >
                            {hasHigh ? "High risk" : hasMed ? "Medium" : "Low"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {latestNote ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest note</p>
                          <p className="mt-1 line-clamp-2 text-sm text-foreground">{latestNote.content}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No notes yet.</p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1">
                          <FileText className="mr-1 h-3 w-3" /> View
                        </Button>
                        <Button size="sm" className="flex-1">
                          <Plus className="mr-1 h-3 w-3" /> Note
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {view === "archived" ? "No archived residents." : "No residents yet."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {view === "archived"
                ? "Discharged or deceased residents will appear here."
                : "Add a resident to start documenting care."}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ageFrom(iso: string) {
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
}

function StatBox({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tone: "primary" | "urgent" | "warning" | "ontrack";
}) {
  const colors = {
    primary: "text-primary",
    urgent: "text-care-urgent",
    warning: "text-care-attention",
    ontrack: "text-care-on-track",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 ${colors}`} />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NewResidentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("residents").insert({
        full_name: f.full_name,
        preferred_name: f.preferred_name || null,
        room_number: f.room_number || null,
        date_of_birth: f.date_of_birth || null,
        gender: f.gender || null,
        marital_status: f.marital_status || null,
        residency_status: f.residency_status || null,
        admission_date: f.admission_date || null,
        dnacpr_status: f.dnacpr_status || null,
        next_of_kin: f.next_of_kin ? { name: f.next_of_kin } : {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resident added");
      setOpen(false);
      setF({});
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add resident
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New resident</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Row>
            <FieldBox label="Full name *"><Input value={f.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} placeholder="Mary Smith" /></FieldBox>
            <FieldBox label="Preferred name"><Input value={f.preferred_name ?? ""} onChange={(e) => set("preferred_name", e.target.value)} /></FieldBox>
          </Row>
          <Row>
            <FieldBox label="Room"><Input value={f.room_number ?? ""} onChange={(e) => set("room_number", e.target.value)} placeholder="12" /></FieldBox>
            <FieldBox label="Date of birth"><Input type="date" value={f.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} /></FieldBox>
          </Row>
          <Row>
            <FieldBox label="Gender"><SimpleSelect value={f.gender} onChange={(v) => set("gender", v)} options={["Female","Male","Non-binary","Prefer not to say","Other"]} /></FieldBox>
            <FieldBox label="Marital status"><SimpleSelect value={f.marital_status} onChange={(v) => set("marital_status", v)} options={["Single","Married","Civil partnership","Cohabiting","Separated","Divorced","Widowed","Prefer not to say"]} /></FieldBox>
          </Row>
          <Row>
            <FieldBox label="Residency status"><SimpleSelect value={f.residency_status} onChange={(v) => set("residency_status", v)} options={["Permanent","Respite","Day care","Trial stay","Hospital admission","Discharged","Deceased"]} /></FieldBox>
            <FieldBox label="Admission date"><Input type="date" value={f.admission_date ?? ""} onChange={(e) => set("admission_date", e.target.value)} /></FieldBox>
          </Row>
          <FieldBox label="DNACPR status"><SimpleSelect value={f.dnacpr_status} onChange={(v) => set("dnacpr_status", v)} options={["Not recorded","For resuscitation","DNACPR in place","Under review"]} /></FieldBox>
          <FieldBox label="Next of kin"><Input value={f.next_of_kin ?? ""} onChange={(e) => set("next_of_kin", e.target.value)} placeholder="Daughter — Jane Smith" /></FieldBox>
          <p className="text-xs text-muted-foreground">More fields (DNACPR notes, GP, allergies, religion, funding…) are editable in the resident's Profile tab.</p>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!f.full_name || create.isPending}>
            Add resident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function SimpleSelect({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}
