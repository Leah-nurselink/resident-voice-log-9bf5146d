import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AnyRow = Record<string, unknown>;

const FIELDS: { key: string; label: string }[] = [
  { key: "full_name", label: "Full name" },
  { key: "preferred_name", label: "Preferred name" },
  { key: "date_of_birth", label: "DOB" },
  { key: "gender", label: "Gender" },
  { key: "pronouns", label: "Pronouns" },
  { key: "marital_status", label: "Marital status" },
  { key: "religion", label: "Religion" },
  { key: "ethnicity", label: "Ethnicity" },
  { key: "first_language", label: "First language" },
  { key: "nationality", label: "Nationality" },
  { key: "room_number", label: "Room" },
  { key: "residency_status", label: "Residency status" },
  { key: "admission_type", label: "Admission type" },
  { key: "admission_date", label: "Admission date" },
  { key: "discharge_date", label: "Discharge date" },
  { key: "funding_source", label: "Funding" },
  { key: "local_authority", label: "Local authority" },
  { key: "dnacpr_status", label: "DNACPR" },
  { key: "dnacpr_date", label: "DNACPR date" },
  { key: "nhs_number", label: "NHS number" },
  { key: "gp_practice", label: "GP practice" },
  { key: "gp_phone", label: "GP phone" },
  { key: "allergies", label: "Allergies" },
  { key: "dietary_requirements", label: "Diet" },
  { key: "communication_needs", label: "Communication" },
  { key: "next_of_kin", label: "NOK name" },
  { key: "next_of_kin_relationship", label: "NOK relation" },
  { key: "next_of_kin_phone", label: "NOK phone" },
  { key: "next_of_kin_secondary", label: "NOK 2 name" },
  { key: "next_of_kin_secondary_relationship", label: "NOK 2 relation" },
  { key: "next_of_kin_secondary_phone", label: "NOK 2 phone" },
  { key: "power_of_attorney", label: "Power of attorney" },
  { key: "advance_decisions", label: "Advance decisions" },
];

function val(r: AnyRow, k: string): string {
  const v = r[k];
  if (v == null || v === "") return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function exportResidentsExcel(residents: AnyRow[]) {
  const rows = residents.map((r) =>
    Object.fromEntries(FIELDS.map((f) => [f.label, val(r, f.key)])),
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = FIELDS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Residents");
  XLSX.writeFile(wb, `residents-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportResidentsPDF(residents: AnyRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Resident summary", 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 20);

  const compact: { key: string; label: string }[] = [
    { key: "full_name", label: "Name" },
    { key: "room_number", label: "Room" },
    { key: "date_of_birth", label: "DOB" },
    { key: "residency_status", label: "Status" },
    { key: "dnacpr_status", label: "DNACPR" },
    { key: "nhs_number", label: "NHS no." },
    { key: "gp_practice", label: "GP" },
    { key: "next_of_kin", label: "NOK" },
    { key: "next_of_kin_phone", label: "NOK phone" },
    { key: "allergies", label: "Allergies" },
  ];

  autoTable(doc, {
    head: [compact.map((c) => c.label)],
    body: residents.map((r) => compact.map((c) => val(r, c.key))),
    startY: 26,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save(`residents-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSingleResidentPDF(r: AnyRow, schedules?: AnyRow[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(String(r.full_name ?? "Resident"), 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    head: [["Field", "Value"]],
    body: FIELDS.map((f) => [f.label, val(r, f.key)]),
    startY: 28,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });

  if (schedules?.length) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
    doc.setFontSize(13);
    doc.text("Care schedule", 14, finalY + 10);
    autoTable(doc, {
      head: [["Domain", "Activity", "Days", "Window", "Notes"]],
      body: schedules.map((s) => [
        val(s, "domain"),
        val(s, "activity"),
        formatDays(s.days_of_week as number[] | null),
        `${val(s, "window_start")}–${val(s, "window_end")}`,
        val(s, "notes"),
      ]),
      startY: finalY + 14,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] },
    });
  }

  doc.save(`${String(r.full_name ?? "resident").replace(/\s+/g, "-")}.pdf`);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function formatDays(days?: number[] | null): string {
  if (!days || days.length === 7) return "Every day";
  return days.map((d) => DAY_LABELS[d]).join(", ");
}
