import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  ADMIN_STATUSES, type AdminStatus, type Medication,
  allergyConflict, minutesSinceLastPrn, prnDosesInLast24h, type Administration,
} from "@/lib/medications";
import { format } from "date-fns";

export function RecordDoseDialog({
  medication, scheduledDate, scheduledTime, allergies, priorAdministrations, onClose,
}: {
  medication: Medication;
  scheduledDate: string;
  scheduledTime: string | null;
  allergies?: string | null;
  priorAdministrations: Administration[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [doseGiven, setDoseGiven] = useState(medication.dose ?? "");
  const [notes, setNotes] = useState("");

  const conflict = allergyConflict(allergies, medication.name);
  const sinceLast = medication.is_prn ? minutesSinceLastPrn(medication, priorAdministrations) : null;
  const dosesToday = medication.is_prn ? prnDosesInLast24h(medication, priorAdministrations) : 0;
  const tooSoon =
    medication.is_prn && medication.prn_min_interval_minutes && sinceLast !== null
      ? sinceLast < medication.prn_min_interval_minutes
      : false;
  const overMax =
    medication.is_prn && medication.prn_max_doses_24h ? dosesToday >= medication.prn_max_doses_24h : false;

  const meta = status ? ADMIN_STATUSES.find((s) => s.value === status)! : null;
  const reasonRequired = meta?.needsReason && !reason.trim();

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
        dose_given: status === "given" ? doseGiven || null : null,
        administered_by: u.user?.id ?? null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recorded");
      qc.invalidateQueries({ queryKey: ["med-admins"] });
      qc.invalidateQueries({ queryKey: ["med-round"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record this dose"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{medication.name}</DialogTitle>
          <DialogDescription>
            {medication.dose ? `${medication.dose} · ` : ""}{medication.route ?? "route not set"}
            {scheduledTime ? ` · due ${scheduledTime}` : " · as required"}
            {` · ${format(new Date(scheduledDate), "d MMM yyyy")}`}
          </DialogDescription>
        </DialogHeader>

        {conflict && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{conflict}. Check before giving.</span>
          </div>
        )}

        {medication.is_prn && (
          <div className="rounded-lg border bg-muted/40 p-2 text-xs">
            <div>Last given: {sinceLast === null ? "no record" : `${Math.floor(sinceLast / 60)}h ${sinceLast % 60}m ago`}</div>
            <div>Doses in last 24h: {dosesToday}{medication.prn_max_doses_24h ? ` of ${medication.prn_max_doses_24h} max` : ""}</div>
            {medication.prn_min_interval_minutes && <div>Minimum interval: {medication.prn_min_interval_minutes} minutes</div>}
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

        <div className="grid grid-cols-2 gap-2">
          {ADMIN_STATUSES.map((s) => (
            <Button
              key={s.value}
              variant={status === s.value ? "default" : "outline"}
              className="h-11"
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {status && (
          <div className="space-y-3">
            {status === "given" && (
              <div>
                <Label className="text-xs">Dose given</Label>
                <Input value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} />
              </div>
            )}
            {meta?.needsReason && (
              <div>
                <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. resident declined, out of stock, resident asleep" />
              </div>
            )}
            {meta?.needsReason && (
              <div>
                <Label className="text-xs">Action taken</Label>
                <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. informed nurse in charge" />
              </div>
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
          <Button onClick={() => save.mutate()} disabled={!status || !!reasonRequired || save.isPending}>
            Save record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
