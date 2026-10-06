import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { carePlanReviewDate, scheduleDates, type CalendarEvent } from "./resident-calendar";
import { domainLabel, riskLabel, type CarePlanDomain, type RiskType } from "./care-domains";

export const getResidentCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    start: z.string().date(), end: z.string().date(),
  }).refine((value) => value.start <= value.end && (Date.parse(value.end) - Date.parse(value.start)) <= 62 * 86400000, "Invalid calendar period").parse(input))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const results = await Promise.all([
      sb.from("residents").select("id,full_name,room_number").order("full_name"),
      sb.from("care_schedules").select("id,resident_id,domain,activity,notes,days_of_week,specific_date,specific_time,window_start,window_end").eq("is_active", true).in("domain", ["appointment", "other"]),
      sb.from("care_plans").select("id,resident_id,domain,last_review,content,needs,outcome"),
      sb.from("risk_assessments").select("id,resident_id,type,review_date").gte("review_date", data.start).lte("review_date", data.end),
      sb.from("consents").select("id,resident_id,consent_type,review_date").gte("review_date", data.start).lte("review_date", data.end),
      sb.from("mca_assessments").select("id,resident_id,decision,review_date").gte("review_date", data.start).lte("review_date", data.end),
      sb.from("medications").select("id,resident_id,name,review_date").eq("status", "active").gte("review_date", data.start).lte("review_date", data.end),
      sb.from("wounds").select("id,resident_id,location,review_date").eq("status", "open").gte("review_date", data.start).lte("review_date", data.end),
    ]);
    for (const result of results) if (result.error) throw new Error("Unable to load the resident calendar. Please try again.");
    const [residents, schedules, plans, risks, consents, capacity, medications, wounds] = results;
    const residentList = residents.data ?? [];
    const residentMap = new Map(residentList.map((resident) => [resident.id, resident]));
    const events: CalendarEvent[] = [];
    const append = (event: Omit<CalendarEvent, "residentName" | "room">) => {
      const resident = residentMap.get(event.residentId);
      if (!resident || event.date < data.start || event.date > data.end) return;
      events.push({ ...event, residentName: resident.full_name, room: resident.room_number });
    };
    for (const schedule of schedules.data ?? []) {
      for (const date of scheduleDates(schedule, data.start, data.end)) append({
        id: `schedule-${schedule.id}-${date}`, residentId: schedule.resident_id, date,
        time: schedule.specific_time?.slice(0, 5) ?? `${schedule.window_start.slice(0, 5)}–${schedule.window_end.slice(0, 5)}`,
        title: schedule.activity, kind: "appointment", category: schedule.domain === "appointment" ? "Appointment" : "Other scheduled event", notes: schedule.notes,
      });
    }
    const review = (id: string, residentId: string, date: string | null, title: string, category: string) => {
      if (date) append({ id, residentId, date, title, category, kind: "review", time: null, notes: null });
    };
    for (const plan of plans.data ?? []) {
      if (plan.last_review && (plan.content || plan.needs || plan.outcome)) review(`plan-${plan.id}`, plan.resident_id, carePlanReviewDate(plan.last_review), domainLabel(plan.domain as CarePlanDomain), "Care plan review");
    }
    for (const risk of risks.data ?? []) review(`risk-${risk.id}`, risk.resident_id, risk.review_date, riskLabel(risk.type as RiskType), "Risk assessment review");
    for (const consent of consents.data ?? []) review(`consent-${consent.id}`, consent.resident_id, consent.review_date, consent.consent_type, "Consent review");
    for (const mca of capacity.data ?? []) review(`mca-${mca.id}`, mca.resident_id, mca.review_date, mca.decision, "Capacity review");
    for (const med of medications.data ?? []) review(`med-${med.id}`, med.resident_id, med.review_date, med.name, "Medication review");
    for (const wound of wounds.data ?? []) review(`wound-${wound.id}`, wound.resident_id, wound.review_date, wound.location, "Wound review");
    events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.residentName.localeCompare(b.residentName));
    return { residents: residentList, events };
  });