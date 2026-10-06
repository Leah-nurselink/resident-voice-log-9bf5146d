import { describe, expect, it } from "vitest";
import { assignmentFlags, leaveCovering, shiftHours, weeklyHoursFor, type LeaveRow } from "@/lib/rota-rules";
import type { ShiftRow, StaffContext } from "@/lib/rota";

const shift = (over: Partial<ShiftRow>): ShiftRow => ({
  id: "s1",
  shift_date: "2026-10-06",
  start_time: "07:00",
  end_time: "15:00",
  location: "Care home",
  staff_user_id: null,
  role: null,
  cover_required: false,
  clock_in_at: null,
  clock_out_at: null,
  break_minutes: null,
  resident_ids: [],
  handover_status: "not_started",
  notes: null,
  ...over,
});

const ctx = (over: Partial<StaffContext> = {}): StaffContext => ({
  role: "carer",
  availability: [],
  qualifications: [],
  training: [],
  restrictions: null,
  restrictionTags: [],
  employmentStatus: "employed",
  otherShifts: [],
  ...over,
});

describe("shiftHours", () => {
  it("handles overnight shifts", () => {
    expect(shiftHours(shift({ start_time: "21:00", end_time: "07:00" }))).toBe(10);
  });
});

describe("leaveCovering", () => {
  const leave: LeaveRow[] = [
    { user_id: "u1", leave_type: "annual_leave", start_date: "2026-10-06", end_date: "2026-10-08" },
    { user_id: "u2", leave_type: "sick", start_date: "2026-10-06", end_date: "2026-10-06" },
  ];

  it("blocks a shift inside the leave period", () => {
    expect(leaveCovering("u1", shift({}), leave)?.leave_type).toBe("annual_leave");
  });

  it("ignores other people's leave", () => {
    expect(leaveCovering("u3", shift({}), leave)).toBeUndefined();
  });

  it("covers an overnight shift that starts on the last leave day", () => {
    expect(leaveCovering("u2", shift({ start_time: "21:00", end_time: "07:00" }), leave)?.leave_type).toBe("sick");
  });
});

describe("weeklyHoursFor", () => {
  it("sums hours within the Monday–Sunday week", () => {
    const shifts = [
      shift({ id: "a", staff_user_id: "u1", shift_date: "2026-10-05" }), // Monday
      shift({ id: "b", staff_user_id: "u1", shift_date: "2026-10-11" }), // Sunday
      shift({ id: "c", staff_user_id: "u1", shift_date: "2026-10-12" }), // next Monday — excluded
      shift({ id: "d", staff_user_id: "u2", shift_date: "2026-10-06" }), // someone else — excluded
    ];
    expect(weeklyHoursFor("u1", "2026-10-06", shifts)).toBe(16);
  });
});

describe("assignmentFlags", () => {
  it("flags leave, rest gap and weekly hours", () => {
    const target = shift({ id: "t", staff_user_id: "u1", shift_date: "2026-10-06", start_time: "07:00", end_time: "15:00" });
    const leave: LeaveRow[] = [{ user_id: "u1", leave_type: "annual_leave", start_date: "2026-10-06", end_date: "2026-10-06" }];
    const others = [
      shift({ id: "p", staff_user_id: "u1", shift_date: "2026-10-05", start_time: "14:00", end_time: "22:00" }), // 9h rest
      shift({ id: "w", staff_user_id: "u1", shift_date: "2026-10-05", start_time: "07:00", end_time: "15:00" }), // 8h this week
    ];
    const flags = assignmentFlags(target, ctx({ max_weekly_hours: 12 }), [target, ...others], leave, 11);
    expect(flags.some((f) => f.startsWith("On leave"))).toBe(true);
    expect(flags.some((f) => f.startsWith("Only 9.0h rest"))).toBe(true);
    expect(flags.some((f) => f.includes("over their 12h maximum"))).toBe(true);
  });

  it("adds no extra flags for a clean assignment", () => {
    const target = shift({ staff_user_id: "u1", shift_date: "2026-10-06" });
    const flags = assignmentFlags(target, ctx(), [target], [], 11);
    expect(flags).toEqual([]);
  });

  it("keeps the unfilled-within-24h flag for empty shifts", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const flags = assignmentFlags(shift({ shift_date: iso, start_time: "23:00", end_time: "23:30" }), null, [], []);
    expect(flags.some((f) => f.includes("Unfilled shift"))).toBe(true);
  });
});
