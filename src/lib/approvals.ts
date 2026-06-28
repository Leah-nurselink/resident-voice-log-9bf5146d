// Approve/reject AI recommendations. Optional auto-apply for care_gap items
// that should create/refresh a care plan.

import { supabase } from "@/integrations/supabase/client";

export type ApprovalAction = "approve" | "reject" | "action";

export async function reviewRecommendation(
  recId: string,
  action: ApprovalAction,
  notes?: string,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const status =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "actioned";
  const { error } = await supabase
    .from("ai_recommendations")
    .update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? null,
    } as never)
    .eq("id", recId);
  if (error) throw error;
}

/**
 * Apply a care_gap recommendation by inserting (or refreshing) a care plan
 * for the linked domain, then marking the rec as actioned.
 */
export async function applyCareGapToCarePlan(rec: {
  id: string;
  resident_id: string | null;
  domain: string | null;
  title: string;
  detail: string | null;
}): Promise<string | null> {
  if (!rec.resident_id || !rec.domain) throw new Error("Missing resident or domain");
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;

  // Look for an existing plan in this domain.
  const { data: existing } = await supabase
    .from("care_plans")
    .select("id")
    .eq("resident_id", rec.resident_id)
    .eq("domain", rec.domain as never)
    .maybeSingle();

  let planId: string | null = null;
  const content = `AI suggestion (pending clinician review): ${rec.detail ?? rec.title}`;

  if (existing?.id) {
    const { error } = await supabase
      .from("care_plans")
      .update({
        content,
        last_review: new Date().toISOString(),
        updated_by: userId,
      } as never)
      .eq("id", existing.id);
    if (error) throw error;
    planId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("care_plans")
      .insert({
        resident_id: rec.resident_id,
        domain: rec.domain,
        content,
        needs: rec.title,
        last_review: new Date().toISOString(),
        updated_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    planId = (data as { id: string }).id;
  }

  await supabase
    .from("ai_recommendations")
    .update({
      status: "actioned",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      applied_care_plan_id: planId,
    } as never)
    .eq("id", rec.id);

  return planId;
}

export async function updateAlertStatus(
  alertId: string,
  action: "acknowledge" | "resolve" | "dismiss",
  notes?: string,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (action === "acknowledge") {
    patch.status = "acknowledged";
    patch.acknowledged_at = now;
    patch.acknowledged_by = userId;
  } else if (action === "resolve") {
    patch.status = "resolved";
    patch.resolved = true;
    patch.resolved_at = now;
    patch.resolved_by = userId;
    if (notes) patch.resolution_notes = notes;
  } else {
    patch.status = "dismissed";
    patch.resolved = true;
    patch.resolved_at = now;
    patch.resolved_by = userId;
    if (notes) patch.resolution_notes = notes;
  }
  const { error } = await supabase.from("alerts").update(patch as never).eq("id", alertId);
  if (error) throw error;
}

export async function assignAlert(alertId: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ assigned_to: userId } as never)
    .eq("id", alertId);
  if (error) throw error;
  if (userId) {
    try {
      const { emailAlertAssignee } = await import("@/lib/communications.functions");
      await emailAlertAssignee({ data: { alertId } });
    } catch (e) { console.warn("[assignAlert] email failed", e); }
  }
}

export async function bulkUpdateAlerts(
  ids: string[],
  action: "acknowledge" | "resolve" | "dismiss",
): Promise<void> {
  if (!ids.length) return;
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (action === "acknowledge") {
    patch.status = "acknowledged";
    patch.acknowledged_at = now;
    patch.acknowledged_by = userId;
  } else {
    patch.status = action === "resolve" ? "resolved" : "dismissed";
    patch.resolved = true;
    patch.resolved_at = now;
    patch.resolved_by = userId;
  }
  const { error } = await supabase.from("alerts").update(patch as never).in("id", ids);
  if (error) throw error;
}

export async function bulkAssignAlerts(ids: string[], userId: string | null): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("alerts")
    .update({ assigned_to: userId } as never)
    .in("id", ids);
  if (error) throw error;
  if (userId) {
    try {
      const { emailAlertAssignee } = await import("@/lib/communications.functions");
      await Promise.all(ids.map((id) => emailAlertAssignee({ data: { alertId: id } })));
    } catch (e) { console.warn("[bulkAssignAlerts] email failed", e); }
  }
}

export async function bulkReviewRecommendations(
  ids: string[],
  action: "approve" | "reject",
): Promise<void> {
  if (!ids.length) return;
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;
  const { error } = await supabase
    .from("ai_recommendations")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    } as never)
    .in("id", ids);
  if (error) throw error;
}

export async function bulkApplyCareGaps(
  recs: Array<Parameters<typeof applyCareGapToCarePlan>[0]>,
): Promise<number> {
  let n = 0;
  for (const r of recs) {
    if (!r.resident_id || !r.domain) continue;
    try {
      await applyCareGapToCarePlan(r);
      n++;
    } catch (e) {
      // continue; surface count to caller
      console.error("Bulk apply failed for", r.id, e);
    }
  }
  return n;
}

