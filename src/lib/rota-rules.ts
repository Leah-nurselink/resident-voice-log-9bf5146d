import { hhmm, mismatchFlags, shiftEnd, shiftStart, type ShiftRow, type StaffContext } from "@/lib/rota";

export type LeaveRow = {
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
};

export const LEAVE_LABELS: Record<string, string> = {
  annual_leave: "Annual leave",
  sick: "Sick",
  other: "Other",
};

export function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftHours(s: { shift_date: string; start_time: string; end_time: string }) {
  return (shiftEnd(s).getTime() - shiftStart(s).getTime()) / 3_600_000;
}

/** Leave that covers any part of a shift (handles overnight shifts crossing midnight). */
export function leaveCovering(
  userId: string,
  shift: { shift_date: string; start_time: string; end_time: string },
  leave: LeaveRow[],
): LeaveRow | undefined {
  const startISO = fmtDate(shiftStart(shift));
  const endISO = fmtDate(shiftEnd(shift));
  return leave.find((l) => l.user_id === userId && l.start_date <= endISO && l.end_date >= startISO);
}

/** Monday–Sunday week containing the given date, as [startISO, endISO]. */
export function weekOf(dateISO: string): [string, string] {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const start = fmtDate(d);
  d.setDate(d.getDate() + 6);
  return [start, fmtDate(d)];
}

/** Total hours a person works across shifts starting in the given week. */
export function weeklyHoursFor(userId: string, weekStartISO: string, shifts: ShiftRow[]) {
  const [start, end] = weekOf(weekStartISO);
  return shifts
    .filter((s) => s.staff_user_id === userId && s.shift_date >= start && s.shift_date <= end)
    .reduce((sum, s) => sum + shiftHours(s), 0);
}

export type AssignmentContext = StaffContext & { max_weekly_hours?: number | null };

/**
 * Flags a person should review before an assignment. Never blocks.
 * Extends the shared mismatch flags with leave, weekly hours and rest-gap checks.
 */
export function assignmentFlags(
  shift: ShiftRow,
  ctx: AssignmentContext | null,
  allShifts: ShiftRow[],
  leave: LeaveRow[],
  restGapHours = 11,
): string[] {
  const flags = mismatchFlags(shift, ctx);
  if (!shift.staff_user_id) return flags;
  const uid = shift.staff_user_id;

  const l = leaveCovering(uid, shift, leave);
  if (l) {
    flags.push(
      `On leave (${LEAVE_LABELS[l.leave_type] ?? l.leave_type}) ${l.start_date} to ${l.end_date}.`,
    );
  }

  if (ctx?.max_weekly_hours != null) {
    const [weekStart] = weekOf(shift.shift_date);
    const others = weeklyHoursFor(uid, weekStart, allShifts.filter((s) => s.id !== shift.id));
    const total = others + shiftHours(shift);
    if (total > ctx.max_weekly_hours) {
      flags.push(
        `This would take them to about ${Math.round(total)}h this week, over their ${ctx.max_weekly_hours}h maximum.`,
      );
    }
  }

  const start = shiftStart(shift);
  const end = shiftEnd(shift);
  for (const other of allShifts) {
    if (other.staff_user_id !== uid || other.id === shift.id) continue;
    const oStart = shiftStart(other);
    const oEnd = shiftEnd(other);
    const gapBefore = start.getTime() - oEnd.getTime();
    const gapAfter = oStart.getTime() - end.getTime();
    const gap = oStart >= end ? gapAfter : start >= oEnd ? gapBefore : -1;
    if (gap < 0) continue; // overlapping — already flagged by the shared rules
    if (gap < restGapHours * 3_600_000) {
      flags.push(
        `Only ${(gap / 3_600_000).toFixed(1)}h rest next to their shift on ${other.shift_date} (${hhmm(other.start_time)}). Minimum is ${restGapHours}h.`,
      );
      break;
    }
  }

  return flags;
}
