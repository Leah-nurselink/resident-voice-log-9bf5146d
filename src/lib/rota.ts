import type { Role } from "@/lib/permissions";

export type ShiftRow = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  location: string;
  staff_user_id: string | null;
  role: Role | null;
  cover_required: boolean;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number | null;
  resident_ids: string[];
  handover_status: string;
  notes: string | null;
};

export type ShiftStatus =
  | "unfilled"
  | "cover_required"
  | "absent"
  | "late"
  | "active"
  | "upcoming"
  | "completed";

export const STATUS_LABELS: Record<ShiftStatus, string> = {
  unfilled: "Unfilled",
  cover_required: "Cover Required",
  absent: "Staff Absent",
  late: "Late",
  active: "Active",
  upcoming: "Upcoming",
  completed: "Completed",
};

export const STATUS_CLASSES: Record<ShiftStatus, string> = {
  unfilled: "bg-destructive/10 text-destructive border-destructive/30",
  cover_required: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
  late: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  upcoming: "bg-muted text-muted-foreground border-border",
  completed: "bg-muted text-muted-foreground border-border",
};

export const HANDOVER_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

export const LOCATIONS = [
  "Main house",
  "Ground floor",
  "First floor",
  "Second floor",
  "Dementia unit",
  "Community",
  "Office",
];

export function shiftStart(s: { shift_date: string; start_time: string }) {
  return new Date(`${s.shift_date}T${s.start_time}`);
}

export function shiftEnd(s: { shift_date: string; start_time: string; end_time: string }) {
  const start = shiftStart(s);
  const end = new Date(`${s.shift_date}T${s.end_time}`);
  // Overnight shift: end time earlier than start time means it finishes the next day.
  if (end <= start) end.setDate(end.getDate() + 1);
  return end;
}

export function shiftStatus(s: ShiftRow, absent: boolean, now: Date = new Date()): ShiftStatus {
  if (absent) return "absent";
  if (!s.staff_user_id) return "unfilled";
  if (s.cover_required) return "cover_required";
  const start = shiftStart(s);
  const end = shiftEnd(s);
  if (now < start) return "upcoming";
  if (now >= end) return "completed";
  // Started: late if nobody has clocked in 15 minutes after the start.
  if (!s.clock_in_at && now.getTime() - start.getTime() > 15 * 60 * 1000) return "late";
  return "active";
}

export function hhmm(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "—";
}

export type StaffContext = {
  role: Role | null;
  availability: { day_of_week: number; available: boolean; from_time: string | null; to_time: string | null }[];
  qualifications: { title: string; expiry_date: string | null }[];
  training: { course: string; renewal_due: string | null }[];
  restrictions: string | null;
  restrictionTags: string[];
  employmentStatus: string | null;
  otherShifts: ShiftRow[];
};

/** Flags a person can review. Never blocks an assignment. */
export function mismatchFlags(shift: ShiftRow, ctx: StaffContext | null, now: Date = new Date()): string[] {
  const flags: string[] = [];
  const start = shiftStart(shift);

  if (!shift.staff_user_id) {
    const hoursAway = (start.getTime() - now.getTime()) / 3_600_000;
    if (hoursAway > 0 && hoursAway <= 24) flags.push("Unfilled shift starting within 24 hours.");
    return flags;
  }
  if (!ctx) return flags;

  const dow = start.getDay();
  const avail = ctx.availability.find((a) => a.day_of_week === dow);
  if (avail && !avail.available) {
    flags.push("This person is normally unavailable on this day.");
  } else if (avail?.from_time && avail?.to_time) {
    if (shift.start_time < avail.from_time || shift.end_time > avail.to_time) {
      flags.push(
        `Shift falls outside their stated hours (${hhmm(avail.from_time)}–${hhmm(avail.to_time)}).`,
      );
    }
  }

  if (shift.role && ctx.role && shift.role !== ctx.role) {
    flags.push("The role on this shift does not match the person's role.");
  }

  const today = now.toISOString().slice(0, 10);
  for (const q of ctx.qualifications) {
    if (q.expiry_date && q.expiry_date < today) flags.push(`Qualification expired: ${q.title}.`);
  }
  for (const t of ctx.training) {
    if (t.renewal_due && t.renewal_due < today) flags.push(`Training overdue: ${t.course}.`);
  }

  if (ctx.restrictionTags.length) {
    flags.push(`Restriction to check: ${ctx.restrictionTags.join(", ")}.`);
  }
  if (ctx.employmentStatus === "left") {
    flags.push("This person is recorded as having left.");
  }

  const end = shiftEnd(shift);
  for (const other of ctx.otherShifts) {
    if (other.id === shift.id) continue;
    if (shiftStart(other) < end && shiftEnd(other) > start) {
      flags.push(`Overlaps another shift on ${other.shift_date} (${hhmm(other.start_time)}).`);
      break;
    }
  }

  return flags;
}

export const RESTRICTION_TAGS = [
  "No lone working",
  "No manual handling",
  "No night shifts",
  "No medication administration",
  "No driving",
  "Supervision required",
];

export const EMPLOYMENT_STATUSES = [
  { value: "employed", label: "Employed" },
  { value: "bank", label: "Bank" },
  { value: "agency", label: "Agency" },
  { value: "student", label: "Student" },
  { value: "left", label: "Left" },
];

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
