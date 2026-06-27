import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { AuditDefinition, AuditAnswer } from "@/lib/audit-questions";
import { saveSubmission } from "@/lib/audit-questions";

export function AuditDialog({
  audit,
  open,
  onOpenChange,
  onSubmitted,
}: {
  audit: AuditDefinition | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, { answer: AuditAnswer; note?: string }>>({});
  const [completedBy, setCompletedBy] = useState("");
  const [unit, setUnit] = useState("");
  const [summary, setSummary] = useState("");

  const compliance = useMemo(() => {
    if (!audit) return 0;
    const scored = audit.questions.filter((q) => answers[q.id]?.answer && answers[q.id].answer !== "na");
    if (scored.length === 0) return 0;
    const yes = scored.filter((q) => answers[q.id].answer === "yes").length;
    return Math.round((yes / scored.length) * 100);
  }, [audit, answers]);

  const reset = () => {
    setAnswers({});
    setCompletedBy("");
    setUnit("");
    setSummary("");
  };

  const submit = () => {
    if (!audit) return;
    if (!completedBy.trim()) return toast.error("Enter your name to complete the audit");
    const unanswered = audit.questions.filter((q) => !answers[q.id]?.answer);
    if (unanswered.length) return toast.error(`Answer all ${audit.questions.length} questions (${unanswered.length} left)`);

    saveSubmission({
      id: crypto.randomUUID(),
      auditKey: audit.key,
      auditTitle: audit.title,
      completedAt: new Date().toISOString(),
      completedBy: completedBy.trim(),
      unit: unit.trim() || undefined,
      answers,
      summary: summary.trim(),
      compliance,
    });
    toast.success(`${audit.title} submitted — ${compliance}% compliance`);
    reset();
    onOpenChange(false);
    onSubmitted?.();
  };

  if (!audit) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{audit.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {audit.questions.length} questions · current compliance {compliance}%
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="completedBy">Your name</Label>
            <Input id="completedBy" value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} placeholder="e.g. S. Patel" />
          </div>
          <div>
            <Label htmlFor="unit">Unit / area (optional)</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. Unit A" />
          </div>
        </div>

        <div className="mt-2 space-y-4">
          {audit.questions.map((q, idx) => {
            const a = answers[q.id];
            return (
              <div key={q.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">
                  {idx + 1}. {q.text}
                </p>
                <RadioGroup
                  className="mt-2 flex gap-4"
                  value={a?.answer ?? ""}
                  onValueChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], answer: v as AuditAnswer } }))
                  }
                >
                  {(["yes", "no", "na"] as AuditAnswer[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                      <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                      {opt === "na" ? "N/A" : opt}
                    </label>
                  ))}
                </RadioGroup>
                {a?.answer === "no" && (
                  <Textarea
                    className="mt-2"
                    placeholder="Action required / notes"
                    value={a.note ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], note: e.target.value } }))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2">
          <Label htmlFor="summary">Overall summary / actions</Label>
          <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Key findings, actions, owner, deadline" />
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Compliance: <strong className="text-foreground">{compliance}%</strong></span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit}>Submit audit</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
