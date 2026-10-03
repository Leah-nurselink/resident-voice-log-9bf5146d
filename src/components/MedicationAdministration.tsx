import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Sparkles, Check } from "lucide-react";
import {
  ADMIN_STATUSES, type AdminStatus, type Medication,
  minutesSinceLastPrn, prnDosesInLast24h, type Administration,
} from "@/lib/medications";
import { MED_RIGHTS, medicationSafetyFlags, stockState, unitsFromDose, type SafetyFlag } from "@/lib/medication-safety";
import { reviewMedicationSafety } from "@/lib/medication-ai.functions";
import { addDays, format } from "date-fns";

/** Resident context used for safety checks: allergies, history, all active medicines, high risks. */
export function useResidentMedContext(residentId: string) {
  return useQuery({
    queryKey: ["med-context", residentId],
    queryFn: async () => {
      const [res, meds, risks] = await Promise.all([
        supabase.from("residents").select("allergies, medical_history").eq("id", residentId).single(),
        supabase.from("medications").select("*").eq("resident_id", residentId).eq("status", "active"),
        supabase.from("risk_assessments").select("type, level, factors").eq("resident_id", residentId),
      ]);
      const highRisks = (risks.data ?? [])
        .filter((r) => r.level === "high" || r.level === "medium")
        .map((r) => `${r.type} risk ${r.factors ?? ""}`);
      return {
        allergies: res.data?.allergies ?? null,
        history: (res.data as { medical_history?: string | null } | null)?.medical_history ?? null,
        otherMeds: (meds.data ?? []) as unknown as Medication[],
        highRisks,
      };
    },
  });
}

export function SafetyFlagList({ flags }: { flags: SafetyFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
      {flags.map((f, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span><b>{f.level === "high" ? "Check before giving: " : "Be aware: "}</b>{f.text}</span>
        </div>
      ))}
      <p className="text-[10px] opacity-80">Automatic checks — confirm with the nurse, GP or pharmacist.</p>
    </div>
  );
}

export function AiMedicationReview({ residentId }: { residentId: string }) {
  const run = useServerFn(reviewMedicationSafety);
  const [text, setText] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => run({ data: { residentId } }),
    onSuccess: (r) => setText(r.text),
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI review failed"),
  });
  return (
    <div className="rounded-lg border p-2">
      <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
        <Sparkles className="mr-1 h-3.5 w-3.5" />{m.isPending ? "Reviewing…" : "Ask AI for a deeper safety review"}
      </Button>
      {text && (
        <div className="mt-2 whitespace-pre-wrap text-xs">
          {text}
          <p className="mt-1 text-[10px] italic text-muted-foreground">AI suggestion for staff review — a person decides.</p>
        </div>
      )}
    </div>
  );
}

export function RecordDoseDialog({
  medication, scheduledDate, scheduledTime, priorAdministrations, onClose,
}: {
  medication: Medication;
  scheduledDate: string;
  scheduledTime: string | null;
  allergies?: string | null;
  priorAdministrations: Administration[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const ctx = useResidentMedContext(medication.resident_id);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [doseGiven, setDoseGiven] = useState(medication.dose ?? "");
  const [notes, setNotes] = useState("");
  const [countFound, setCountFound] = useState("");
  const [rights, setRights] = useState<string[]>([]);

  const flags = ctx.data ? medicationSafetyFlags(medication, ctx.data) : [];
  const stock = stockState(medication);
  const sinceLast = medication.is_prn ? minutesSinceLastPrn(medication, priorAdministrations) : null;
  const dosesToday = medication.is_prn ? prnDosesInLast24h(medication, priorAdministrations) : 0;
  const tooSoon =
    medication.is_prn && medication.prn_min_interval_minutes && sinceLast !== null
      ? sinceLast < medication.prn_min_interval_minutes : false;
  const overMax =
    medication.is_prn && medication.prn_max_doses_24h ? dosesToday >= medication.prn_max_doses_24h : false;

  const units = unitsFromDose(doseGiven);
  const found = countFound.trim() === "" ? null : Number(countFound);
  const expected = medication.stock_count ?? null;
  const giving = status === "given";
  const after = giving ? (found ?? expected) !== null ? Math.max(0, (found ?? expected)! - units) : null : found;
  const mismatch = found !== null && expected !== null && found !== expected;

  const meta = status ? ADMIN_STATUSES.find((s) => s.value === status)! : null;
  const reasonRequired = meta?.needsReason && !reason.trim();
  const countRequired = giving && medication.controlled_drug && found === null;

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("medication_administrations").insert({
        medication_id: medication.id,
        resident_id: medication.resident_id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        status: status!,
        reason: reason.trim() || null,
        action_taken: action.trim() || null,
        dose_given: giving ? doseGiven || null : null,
        administered_by: u.user?.id ?? null,
        notes: [notes.trim(), mismatch ? `Count mismatch: expected ${expected}, found ${found}` : ""].filter(Boolean).join(" · ") || null,
        count_before: found,
        count_after: after,
      } as never);
      if (error) throw error;
      if (after !== null) {
        const { error: e2 } = await supabase.from("medication_stock_events" as never).insert({
          medication_id: medication.id, resident_id: medication.resident_id,
          kind: giving ? "dispense" : "recount", quantity: giving ? units : null,
          count_before: found, count_after: after,
        } as never);
        if (e2) toast.warning("Dose saved, but the stock count could not be updated");
      }
    },
    onSuccess: () => {
      toast.success("Recorded");
      for (const k of ["med-admins", "med-round", "timeline", "medications", "med-context"]) qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record this dose"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{medication.name}{medication.controlled_drug ? " · CD" : ""}</DialogTitle>
          <DialogDescription>
            {medication.dose ? `${medication.dose} · ` : ""}{medication.route ?? "route not set"}
            {scheduledTime ? ` · due ${scheduledTime}` : " · as required"}
            {` · ${format(new Date(scheduledDate), "d MMM yyyy")}`}
          </DialogDescription>
        </DialogHeader>

        <SafetyFlagList flags={flags} />

        {stock.status !== "ok" && (
          <div className="rounded-lg border border-warning/40 bg-warning/15 p-2 text-xs">{stock.label}{stock.status === "out" ? " — medicine may be missing. Record as Not available if it can't be found." : ""}</div>
        )}

        {medication.is_prn && (
          <div className="rounded-lg border bg-muted/40 p-2 text-xs">
            <div>Last given: {sinceLast === null ? "no record" : `${Math.floor(sinceLast / 60)}h ${sinceLast % 60}m ago`}</div>
            <div>Doses in last 24h: {dosesToday}{medication.prn_max_doses_24h ? ` of ${medication.prn_max_doses_24h} max` : ""}</div>
            {(tooSoon || overMax) && (
              <div className="mt-1 font-medium text-destructive">
                {tooSoon ? "Given sooner than the configured interval. " : ""}{overMax ? "24-hour maximum already reached." : ""}
              </div>
            )}
          </div>
        )}

        {medication.instructions && (
          <p className="rounded-lg border bg-card p-2 text-xs text-muted-foreground">{medication.instructions}</p>
        )}

        <div className="rounded-lg border p-2">
          <p className="mb-1 text-xs font-semibold">Rights of administration</p>
          <div className="flex flex-wrap gap-1">
            {MED_RIGHTS.map((r) => {
              const on = rights.includes(r);
              return (
                <button key={r} type="button" onClick={() => setRights(on ? rights.filter((x) => x !== r) : [...rights, r])}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/10" : ""}`}>
                  {on && <Check className="h-3 w-3" />}{r}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ADMIN_STATUSES.map((s) => (
            <Button key={s.value} variant={status === s.value ? "default" : "outline"} className="h-11" onClick={() => setStatus(s.value)}>
              {s.label}
            </Button>
          ))}
        </div>

        {status && (
          <div className="space-y-3">
            {giving && (
              <div>
                <Label className="text-xs">Dose given</Label>
                <Input value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Physical count found {medication.controlled_drug && giving && <span className="text-destructive">*</span>}</Label>
                <Input type="number" inputMode="numeric" value={countFound} onChange={(e) => setCountFound(e.target.value)}
                  placeholder={expected !== null ? `expected ${expected}` : "count"} />
              </div>
              <div>
                <Label className="text-xs">Count left after</Label>
                <Input readOnly value={after ?? ""} placeholder="—" />
              </div>
            </div>
            {mismatch && <p className="text-xs font-medium text-destructive">Count doesn't match the expected {expected}. This will be noted on the record.</p>}
            {meta?.needsReason && (
              <>
                <div>
                  <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
                  <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. resident declined, out of stock, resident asleep" />
                </div>
                <div>
                  <Label className="text-xs">Action taken</Label>
                  <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. informed nurse in charge" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Badge variant="outline" className="text-[10px]">Recorded against you, with the date and time</Badge>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!status || !!reasonRequired || countRequired || save.isPending}>
            Save record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Record a delivery (starts a new cycle) or a physical recount for one medicine. */
export function StockDialog({ medication, onClose }: { medication: Medication; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"delivery" | "recount">("delivery");
  const [qty, setQty] = useState("");
  const [count, setCount] = useState("");
  const [cycleEnd, setCycleEnd] = useState(format(addDays(new Date(), 28), "yyyy-MM-dd"));

  const save = useMutation({
    mutationFn: async () => {
      const current = medication.stock_count ?? 0;
      const row = kind === "delivery"
        ? { kind, quantity: Number(qty), count_before: current, count_after: current + Number(qty), notes: JSON.stringify({ cycle_end: cycleEnd }) }
        : { kind, count_before: medication.stock_count ?? null, count_after: Number(count) };
      const { error } = await supabase.from("medication_stock_events" as never).insert({
        medication_id: medication.id, resident_id: medication.resident_id, ...row,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      for (const k of ["med-round", "medications", "med-context"]) qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update stock"),
  });

  const valid = kind === "delivery" ? Number(qty) > 0 && !!cycleEnd : count.trim() !== "" && Number(count) >= 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock · {medication.name}</DialogTitle>
          <DialogDescription>{stockState(medication).label}{medication.cycle_end_date ? ` · cycle ends ${format(new Date(medication.cycle_end_date), "d MMM")}` : ""}</DialogDescription>
        </DialogHeader>
        <Select value={kind} onValueChange={(v) => setKind(v as "delivery" | "recount")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="delivery">Delivery received (new cycle)</SelectItem>
            <SelectItem value="recount">Physical recount</SelectItem>
          </SelectContent>
        </Select>
        {kind === "delivery" ? (
          <div className="space-y-2">
            <div><Label className="text-xs">Quantity received</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Cycle ends (standard 28 days)</Label>
              <Input type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
              <div className="mt-1 flex gap-1">
                {[7, 28].map((d) => (
                  <Button key={d} size="sm" variant="outline" type="button" onClick={() => setCycleEnd(format(addDays(new Date(), d), "yyyy-MM-dd"))}>{d} days</Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div><Label className="text-xs">Count found</Label><Input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder={medication.stock_count != null ? `expected ${medication.stock_count}` : ""} /></div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
