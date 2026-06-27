import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, Calendar, FileText, Heart, MapPin, Plus, Search, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/residents/")({
  head: () => ({ meta: [{ title: "Residents · CareCore" }] }),
  component: ResidentsList,
});

function ResidentsList() {
  const [q, setQ] = useState("");
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

  const filtered = data.filter((r) =>
    `${r.full_name} ${r.room_number ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const highRiskCount = data.filter((r) =>
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
          <StatBox icon={User} value={data.length} label="Total Residents" tone="primary" />
          <StatBox icon={Heart} value={data.filter((r) => r.room_number).length} label="In Rooms" tone="urgent" />
          <StatBox icon={AlertTriangle} value={highRiskCount} label="High Risk" tone="warning" />
          <StatBox
            icon={Calendar}
            value={data.filter((r) => r.admission_date && new Date(r.admission_date) > new Date(Date.now() - 30 * 86400000)).length}
            label="New This Month"
            tone="ontrack"
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search residents by name or room…"
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
              const initials = r.full_name
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
            <p className="text-sm text-muted-foreground">No residents yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a resident to start documenting care.</p>
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
      setName("");
      setRoom("");
      setDob("");
      setNok("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add resident
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New resident</DialogTitle>
        </DialogHeader>
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
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            Add resident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
