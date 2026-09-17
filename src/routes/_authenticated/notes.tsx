import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VoiceRecorder, type StructuredNote } from "@/components/VoiceRecorder";
import { ChevronRight, MessageSquare, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { domainLabel, type CarePlanDomain } from "@/lib/care-domains";
import { NOTE_CATEGORIES, NOTE_CATEGORY_LABELS, noteCategoryLabel, type NoteCategory } from "@/lib/note-categories";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Daily Notes · CareCore" },
      { name: "description", content: "Care observations across the home, captured by voice or text and structured by AI." },
      { property: "og:title", content: "Daily Notes · CareCore" },
      { property: "og:description", content: "Care observations across the home, captured by voice or text and structured by AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const [category, setCategory] = useState<"all" | NoteCategory>("all");
  const [adding, setAdding] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["all-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, content, domain, category, status, flags, created_at, resident_id, residents(full_name, room_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(
    () => (category === "all" ? data : data.filter((n) => n.category === category)),
    [data, category],
  );

  return (
    <AppShell title="Daily Notes" subtitle="Care observations across the home">
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="flex-1 min-w-[200px]">
              Speak or type — the AI structures the note, you review it before it saves.
            </span>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />New note
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-1.5">
          <CategoryChip active={category === "all"} onClick={() => setCategory("all")} label="All" />
          {NOTE_CATEGORIES.map((c) => (
            <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)} label={NOTE_CATEGORY_LABELS[c]} />
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
            No notes here yet.
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {filtered.map((n) => (
              <li key={n.id}>
                <Link
                  to="/residents/$id"
                  params={{ id: n.resident_id }}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-accent/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{n.residents?.full_name}</span>
                      {n.residents?.room_number && (
                        <span className="text-xs text-muted-foreground">Room {n.residents.room_number}</span>
                      )}
                      {noteCategoryLabel(n.category) && (
                        <Badge className="text-[10px]">{noteCategoryLabel(n.category)}</Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {domainLabel(n.domain as CarePlanDomain)}
                      </Badge>
                      {n.status === "draft" && (
                        <Badge variant="outline" className="text-[10px] border-care-attention/40 text-care-attention">
                          Draft
                        </Badge>
                      )}
                      {Array.isArray(n.flags) && n.flags.length > 0 && (
                        <Badge className="text-[10px] bg-care-urgent/15 text-care-urgent border-care-urgent/40">
                          Flag
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.content}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {adding && <QuickNoteDialog onClose={() => setAdding(false)} />}
      </div>
    </AppShell>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent/40"
      }`}
    >
      {label}
    </button>
  );
}

function QuickNoteDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [residentId, setResidentId] = useState("");
  const [pending, setPending] = useState<StructuredNote | null>(null);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<NoteCategory>("other");

  const residents = useQuery({
    queryKey: ["residents-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents").select("id, full_name, room_number").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const resident = residents.data?.find((r) => r.id === residentId);

  const save = useMutation({
    mutationFn: async () => {
      if (!pending || !residentId) throw new Error("Choose a resident first");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_notes").insert({
        resident_id: residentId,
        author_id: u.user!.id,
        transcript: pending.transcript,
        content: text,
        domain: (pending.domain as CarePlanDomain) || null,
        category,
        risks: pending.risks as never,
        flags: pending.flags,
        status: "approved",
        source: "voice",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note saved");
      qc.invalidateQueries({ queryKey: ["all-notes"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New note</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Resident</Label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger><SelectValue placeholder="Choose a resident" /></SelectTrigger>
              <SelectContent>
                {residents.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name}{r.room_number ? ` · Room ${r.room_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {residentId && !pending && (
            <VoiceRecorder
              residentName={resident?.full_name}
              onResult={(n) => {
                setPending(n);
                setText(n.content);
                setCategory((n.category as NoteCategory) || "other");
              }}
            />
          )}

          {pending && (
            <div className="space-y-3 rounded-2xl border bg-card p-3">
              <div className="text-xs font-medium text-primary">AI-generated note — review before saving</div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as NoteCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{NOTE_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{domainLabel(pending.domain as CarePlanDomain)}</Badge>
                {pending.flags.map((f) => (
                  <Badge key={f} className="text-[10px] bg-care-urgent/15 text-care-urgent border-care-urgent/40">{f}</Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>Approve & save</Button>
                <Button variant="ghost" onClick={() => { setPending(null); setText(""); }}>Reject</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
