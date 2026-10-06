import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";

export const CARE_PLAN_REVIEW_DAYS = 30;
export type CalendarEvent = {
  id: string;
  residentId: string;
  residentName: string;
  room: string | null;
  date: string;
  time: string | null;
  title: string;
  kind: "appointment" | "review";
  category: string;
  notes: string | null;
};

export function carePlanReviewDate(lastReview: string) {
  return format(addDays(parseISO(lastReview), CARE_PLAN_REVIEW_DAYS), "yyyy-MM-dd");
}

export function scheduleDates(schedule: { specific_date: string | null; days_of_week: number[] }, start: string, end: string) {
  if (schedule.specific_date) {
    return schedule.specific_date >= start && schedule.specific_date <= end ? [schedule.specific_date] : [];
  }
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })
    .filter((day) => schedule.days_of_week.includes(day.getDay()))
    .map((day) => format(day, "yyyy-MM-dd"));
}