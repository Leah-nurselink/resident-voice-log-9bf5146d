import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import type { AuditDefinition, AuditAnswer, AuditActionItem, ActionPriority } from "@/lib/audit-questions";
import { saveSubmission } from "@/lib/audit-questions";

const newItem = (partial: Partial<AuditActionItem> = {}): AuditActionItem => ({
  id: crypto.randomUUID(),
  action: "",
  owner: "",
  dueDate: "",
  priority: "medium",
  status: "open",
  ...partial,
});

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
  const [actionPlan, setActionPlan] = useState<AuditActionItem[]>([]);

  const compliance = useMemo(() => {
    if (!audit) return 0;
    const scored = audit.questions.filter((q) => answers[q.id]?.answer && answers[q.id].answer !== "na");
    if (scored.length === 0) return 0;
    const yes = scored.filter((q) => answers[q.id].answer === "yes").length;
    return Math.round((yes / scored.length) * 100);
  }, [audit, answers]);

  // Auto-seed action items from any "No" answer
  useEffect(() => {
    if (!audit) return;
    setActionPlan((prev) => {
      const keptManual = prev.filter((a) => !a.questionId);
      const fromNos = audit.questions
        .filter((q) => answers[q.id]?.answer === "no")
        .map((q) => {
          const existing = prev.find((a) => a.questionId === q.id);
          return existing ?? newItem({
            questionId: q.id,
            questionText: q.text,
            action: answers[q.id]?.note ?? "",
          });
        });
      return [...fromNos, ...keptManual];
    });
  }, [answers, audit]);

  const updateItem = (id: string, patch: Partial<AuditActionItem>) =>
    setActionPlan((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeItem = (id: string) => setActionPlan((prev) => prev.filter((a) => a.id !== id));
  const addBlank = () => setActionPlan((prev) => [...prev, newItem()]);

  const reset = () => {
    setAnswers({});
    setCompletedBy("");
    setUnit("");
    setSummary("");
    setActionPlan([]);
  };

  const submit = () => {
    if (!audit) return;
    if (!completedBy.trim()) return toast.error("Enter your name to complete the audit");
    const unanswered = audit.questions.filter((q) => !answers[q.id]?.answer);
    if (unanswered.length) return toast.error(`Answer all ${audit.questions.length} questions (${unanswered.length} left)`);
    const incompleteActions = actionPlan.filter((a) => !a.action.trim() || !a.owner.trim() || !a.dueDate);
    if (incompleteActions.length) return toast.error(`Complete every action plan row (action, owner, due date)`);

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
      actionPlan,
    });
    toast.success(`${audit.title} submitted — ${compliance}% · ${actionPlan.length} action${actionPlan.length === 1 ? "" : "s"}`);
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
            {audit.questions.length} questions · current compliance {compliance}% · {actionPlan.length} action{actionPlan.length === 1 ? "" : "s"}
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
                <p className="text-sm font-medium">{idx + 1}. {q.text}</p>
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

        <div className="mt-4 rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Action plan</p>
            </div>
            <Button size="sm" variant="outline" onClick={addBlank}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add action
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Any "No" answer auto-creates an action. Add owner, due date and priority; add extra actions as needed.
          </p>
          {actionPlan.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No actions yet — add one or mark a question "No".</p>
          ) : (
            <div className="space-y-3">
              {actionPlan.map((a, i) => (
                <div key={a.id} className="rounded border p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Action {i + 1}{a.questionText ? ` · from Q: "${a.questionText}"` : " · manual"}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => removeItem(a.id)} className="h-6 px-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="What needs to happen?"
                    value={a.action}
                    onChange={(e) => updateItem(a.id, { action: e.target.value })}
                    rows={2}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Owner"
                      value={a.owner}
                      onChange={(e) => updateItem(a.id, { owner: e.target.value })}
                    />
                    <Input
                      type="date"
                      value={a.dueDate}
                      onChange={(e) => updateItem(a.id, { dueDate: e.target.value })}
                    />
                    <Select value={a.priority} onValueChange={(v) => updateItem(a.id, { priority: v as ActionPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low priority</SelectItem>
                        <SelectItem value="medium">Medium priority</SelectItem>
                        <SelectItem value="high">High priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2">
          <Label htmlFor="summary">Overall summary</Label>
          <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Key findings, themes, escalations" />
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Compliance: <strong className="text-foreground">{compliance}%</strong> · Actions: <strong className="text-foreground">{actionPlan.length}</strong>
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit}>Submit audit</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
