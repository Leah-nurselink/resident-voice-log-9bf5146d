import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer } from "lucide-react";

type Row = Record<string, unknown>;
type Col = [key: string, label: string];

const PROFILE_FIELDS: Col[] = [
  ["resident_ref", "Resident ID"], ["full_name", "Full name"], ["preferred_name", "Preferred name"],
  ["date_of_birth", "Date of birth"], ["gender", "Gender"], ["room_number", "Room"],
  ["residency_status", "Status"], ["admission_date", "Admission date"], ["nhs_number", "NHS number"],
  ["gp_practice", "GP practice"], ["gp_phone", "GP phone"], ["first_language", "Language"],
  ["communication_needs", "Communication needs"], ["allergies", "Allergies"],
  ["dietary_requirements", "Diet"], ["important_preferences", "Important preferences"],
  ["dnacpr_status", "DNACPR"], ["next_of_kin_relationship", "Next of kin relation"],
  ["next_of_kin_phone", "Next of kin phone"], ["emergency_contact_name", "Emergency contact"],
  ["emergency_contact_phone", "Emergency phone"], ["power_of_attorney", "Power of attorney"],
  ["advance_decisions", "Advance decisions"],
];

type Section = { id: string; label: string; table?: string; order?: string; cols?: Col[]; title?: string; filter?: (q: any) => any };

const SECTIONS: Section[] = [
  { id: "profile", label: "Resident profile" },
  { id: "care", label: "Care plan", table: "care_plans", order: "domain",
    cols: [["domain", "Area"], ["needs", "Needs"], ["risks", "Risks"], ["outcome", "Outcome"], ["content", "Plan of care"], ["last_review", "Reviewed"]] },
  { id: "risk", label: "Risk assessments", table: "risk_assessments", order: "type",
    cols: [["type", "Type"], ["level", "Level"], ["factors", "Factors"], ["controls", "Controls"], ["review_date", "Review"]] },
  { id: "notes", label: "Notes", table: "daily_notes", order: "created_at",
    cols: [["created_at", "Date"], ["category", "Category"], ["content", "Note"], ["status", "Status"]] },
  { id: "wounds", label: "Wounds", table: "wounds", order: "date_noticed",
    cols: [["location", "Location"], ["wound_type", "Type"], ["category", "Category"], ["date_noticed", "Noticed"], ["status", "Status"], ["review_date", "Review"]] },
  { id: "consents", label: "Consents", table: "consents", order: "consent_type",
    cols: [["consent_type", "Consent"], ["status", "Status"], ["given_by", "Given by"], ["date_given", "Date"], ["review_date", "Review"], ["notes", "Notes"]] },
  { id: "comms", label: "Communications", table: "communications", order: "created_at",
    cols: [["created_at", "Date"], ["channel", "Channel"], ["direction", "Direction"], ["subject", "Subject"], ["ai_summary", "Summary"]] },
  { id: "pain", label: "Pain", table: "pain_assessments", order: "assessed_at",
    cols: [["assessed_at", "Date"], ["total_score", "Score"], ["severity", "Severity"], ["intervention", "Intervention"], ["response", "Response"]] },
  { id: "meds", label: "Medications", table: "medications", order: "name",
    cols: [["name", "Medication"], ["dose", "Dose"], ["route", "Route"], ["frequency_text", "Frequency"], ["is_prn", "PRN"], ["indication", "Indication"], ["status", "Status"]] },
  { id: "mar", label: "Medication given (last 30 days)", table: "medication_administrations", order: "administered_at",
    cols: [["scheduled_date", "Date"], ["scheduled_time", "Due"], ["status", "Status"], ["dose_given", "Dose"], ["reason", "Reason"]] },
  { id: "mca", label: "Mental capacity (MCA)", table: "mca_assessments", order: "assessment_date",
    cols: [["decision", "Decision"], ["has_capacity", "Has capacity"], ["best_interests_decision", "Best interests"], ["assessment_date", "Assessed"], ["review_date", "Review"]] },
  { id: "story", label: "Story (last 30 days)" },
];

function fmt(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v).replace(/_/g, " ");
}

export function ResidentPdfDialog({ resident }: { resident: Row }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(["profile"]));
  const [busy, setBusy] = useState(false);
  const id = String(resident.id);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function load(table: string, order: string) {
    let q = supabase.from(table as never).select("*").eq("resident_id", id);
    if (table === "medication_administrations") q = q.gte("administered_at", since);
    const { data } = await q.order(order, { ascending: !/_at$|date_noticed/.test(order) });
    return (data ?? []) as Row[];
  }

  async function generate() {
    setBusy(true);
    try {
      const doc = new jsPDF();
      const name = String(resident.full_name ?? "Resident");
      doc.setFontSize(16); doc.text(name, 14, 16);
      doc.setFontSize(9);
      doc.text(`${resident.resident_ref ? `${resident.resident_ref} · ` : ""}${resident.room_number ? `Room ${resident.room_number} · ` : ""}Generated ${new Date().toLocaleString("en-GB")}`, 14, 22);
      let y = 28;
      const heading = (t: string) => {
        if (y > 260) { doc.addPage(); y = 16; }
        doc.setFontSize(13); doc.text(t, 14, y + 6); y += 10;
      };
      const table = (head: string[], body: string[][]) => {
        autoTable(doc, { head: [head], body: body.length ? body : [[`No records`, ...head.slice(1).map(() => "")]], startY: y,
          styles: { fontSize: 8, cellPadding: 2, valign: "top" }, headStyles: { fillColor: [38, 94, 90] } });
        y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;
      };

      for (const s of SECTIONS) {
        if (!picked.has(s.id)) continue;
        heading(s.label);
        if (s.id === "profile") {
          table(["Field", "Value"], PROFILE_FIELDS.map(([k, l]) => [l, fmt(resident[k])]).filter(([, v]) => v));
        } else if (s.id === "story") {
          const [notes, mar, comms] = await Promise.all([
            load("daily_notes", "created_at"), load("medication_administrations", "administered_at"), load("communications", "created_at"),
          ]);
          const ev = [
            ...notes.filter((n) => String(n.created_at) >= since).map((n) => [String(n.created_at), "Note", fmt(n.content)]),
            ...mar.map((m) => [String(m.administered_at), "Medication", `${fmt(m.status)}${m.scheduled_time ? ` · due ${m.scheduled_time}` : ""}${m.reason ? ` · ${m.reason}` : ""}`]),
            ...comms.filter((c) => String(c.created_at) >= since).map((c) => [String(c.created_at), `Comms (${fmt(c.channel)})`, fmt(c.ai_summary || c.subject || c.body)]),
          ].sort((a, b) => b[0].localeCompare(a[0])).map(([d, k, t]) => [fmt(d), k, t]);
          table(["When", "Type", "Detail"], ev);
        } else if (s.table && s.cols) {
          const rows = await load(s.table, s.order!);
          table(s.cols.map((c) => c[1]), rows.map((r) => s.cols!.map(([k]) => fmt(r[k]))));
        }
      }
      doc.save(`${name.replace(/\s+/g, "-")}-record.pdf`);
      setOpen(false);
    } catch (e) {
      toast.error("Could not create the PDF", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Printer className="h-3.5 w-3.5" /> PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Choose what to include in the PDF</DialogTitle></DialogHeader>
          <div className="flex gap-2 text-xs">
            <button className="underline" onClick={() => setPicked(new Set(SECTIONS.map((s) => s.id)))}>Select all</button>
            <button className="underline" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                {s.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={generate} disabled={busy || picked.size === 0}>{busy ? "Creating…" : "Download PDF"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
