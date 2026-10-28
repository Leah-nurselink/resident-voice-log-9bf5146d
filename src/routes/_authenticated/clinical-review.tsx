import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { Check, Printer, Ruler } from "lucide-react";

const db = supabase as any;

export const Route = createFileRoute("/_authenticated/clinical-meeting")({
  head: () => ({ meta: [{ title: "Weekly clinical meeting · CareCore" }] }),
  component: ClinicalMeetingPage,
});

type FlaggedWound = {
  id: string;
  resident_id: string;
  location: string;
  side: string | null;
  wound_type: string | null;
  category: string | null;
  status: string;
  date_noticed: string;
  date_healed: string | null;
  clinical_flag: "deteriorated" | "healed";
  flag_note: string | null;
  flagged_at: string | null;
  discussed_at: string | null;
  residents: { full_name: string | null; preferred_name: string | null } | null;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Something went wrong");

function ClinicalMeetingPage() {
  const qc = useQueryClient();

  const wounds = useQuery({
    queryKey: ["clinical-meeting", "wounds"],
    queryFn: async () => {
      const { data, error } = await db
        .from("wounds")
        .select("id, resident_id, location, side, wound_type, category, status, date_noticed, date_healed, clinical_flag, flag_note, flagged_at, discussed_at, residents(full_name, preferred_name)")
        .not("clinical_flag", "is", null)
        .order("flagged_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FlaggedWound[];
    },
  });

  const ids = (wounds.data ?? []).map((w) => w.id);
  const latest = useQuery({
    queryKey: ["clinical-meeting", "assessments", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("wound_assessments")
        .select("wound_id, assessed_at, length_cm, width_cm, depth_cm, tissue_type, exudate_amount, pain_score, dressing, treatment_plan, photos")
        .in("wound_id", ids)
        .order("assessed_at", { ascending: false });
      if (error) throw error;
      const byWound = new Map<string, any>();
      const counts = new Map<string, number>();
      for (const a of data ?? []) {
        if (!byWound.has(a.wound_id)) byWound.set(a.wound_id, a);
        counts.set(a.wound_id, (counts.get(a.wound_id) ?? 0) + 1);
      }
      return { byWound, counts };
    },
  });

  const markDiscussed = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("wounds").update({ discussed_at: new Date().toISOString(), discussed_by: u.user!.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked as discussed"); qc.invalidateQueries({ queryKey: ["clinical-meeting"] }); qc.invalidateQueries({ queryKey: ["wounds"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { toDiscuss, discussed } = useMemo(() => {
    const all = wounds.data ?? [];
    const cutoff = subDays(new Date(), 28);
    return {
      toDiscuss: all.filter((w) => !w.discussed_at),
      discussed: all.filter((w) => w.discussed_at && new Date(w.discussed_at) > cutoff),
    };
  }, [wounds.data]);

  const counts = {
    deteriorated: toDiscuss.filter((w) => w.clinical_flag === "deteriorated").length,
    healed: toDiscuss.filter((w) => w.clinical_flag === "healed").length,
  };

  return (
    <AppShell title="Weekly clinical meeting" subtitle="Wounds that staff have flagged as deteriorated or healed, ready to discuss">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-destructive/30 bg-destructive/15 text-destructive">{counts.deteriorated} deteriorated</Badge>
          <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-700">{counts.healed} healed</Badge>
          <Button size="sm" variant="outline" className="ml-auto print:hidden" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />Print
          </Button>
        </div>

        <p className="text-xs text-muted-foreground print:hidden">
          Staff flag a wound from the resident's Wounds tab. A wound marked as healed is added here automatically.
          Nothing on this page is decided by AI.
        </p>

        <Card>
          <CardHeader><CardTitle className="text-base">To discuss ({toDiscuss.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {wounds.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!wounds.isLoading && toDiscuss.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing flagged for the meeting.</p>
            )}
            {toDiscuss.map((w) => (
              <WoundRow key={w.id} w={w} a={latest.data?.byWound.get(w.id)} n={latest.data?.counts.get(w.id) ?? 0}
                action={<Button size="sm" className="print:hidden" onClick={() => markDiscussed.mutate(w.id)} disabled={markDiscussed.isPending}><Check className="mr-1 h-4 w-4" />Mark discussed</Button>} />
            ))}
          </CardContent>
        </Card>

        {discussed.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Discussed in the last 4 weeks ({discussed.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {discussed.map((w) => (
                <WoundRow key={w.id} w={w} a={latest.data?.byWound.get(w.id)} n={latest.data?.counts.get(w.id) ?? 0}
                  action={<span className="text-xs text-muted-foreground">Discussed {formatDistanceToNow(new Date(w.discussed_at!), { addSuffix: true })}</span>} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function WoundRow({ w, a, n, action }: { w: FlaggedWound; a?: any; n: number; action: React.ReactNode }) {
  const name = w.residents?.preferred_name || w.residents?.full_name || "Resident";
  const dim = a && (a.length_cm != null || a.width_cm != null || a.depth_cm != null)
    ? `${a.length_cm ?? "—"} × ${a.width_cm ?? "—"} × ${a.depth_cm ?? "—"} cm`
    : null;
  const photoCount = Array.isArray(a?.photos) ? a.photos.length : 0;

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-sm text-muted-foreground">
          {w.location}{w.side ? ` (${w.side})` : ""}
        </span>
        <Badge className={w.clinical_flag === "deteriorated"
          ? "border border-destructive/30 bg-destructive/15 text-[10px] capitalize text-destructive"
          : "border border-emerald-500/40 bg-emerald-500/15 text-[10px] capitalize text-emerald-700"}>
          {w.clinical_flag}
        </Badge>
        <div className="ml-auto">{action}</div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {w.wound_type || "Wound"}{w.category && w.category !== "N/A" ? ` · ${w.category}` : ""}
        {" · noticed "}{format(new Date(w.date_noticed), "d MMM yyyy")}
        {w.date_healed ? ` · healed ${format(new Date(w.date_healed), "d MMM yyyy")}` : ""}
        {w.flagged_at ? ` · flagged ${format(new Date(w.flagged_at), "d MMM yyyy")}` : ""}
      </p>
      {w.flag_note && <p className="mt-1 text-sm">{w.flag_note}</p>}
      {a && (
        <div className="mt-2 rounded-md bg-muted/30 p-2 text-xs">
          <span className="font-medium">Latest assessment {format(new Date(a.assessed_at), "d MMM yyyy")}</span>
          {" · "}{n} assessment{n === 1 ? "" : "s"}{photoCount ? ` · ${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
            {dim && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{dim}</span>}
            {a.tissue_type && <span>{a.tissue_type}</span>}
            {a.exudate_amount && <span>Exudate: {a.exudate_amount}</span>}
            {a.pain_score != null && <span>Pain {a.pain_score}/10</span>}
            {a.dressing && <span>Dressing: {a.dressing}</span>}
          </div>
          {a.treatment_plan && <p className="mt-1">Plan: {a.treatment_plan}</p>}
        </div>
      )}
    </div>
  );
}
