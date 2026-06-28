// Persists Care Intelligence Engine outputs into the database so they become
// actionable items (AI recommendations + alerts) reviewable by clinical staff.

import { supabase } from "@/integrations/supabase/client";
import type { ResidentIntelligence } from "@/lib/care-intelligence";

type RecRow = {
  resident_id: string;
  kind: "recommendation" | "care_gap" | "prediction" | "deterioration" | "plan_review" | "safeguarding";
  domain: string | null;
  title: string;
  detail: string | null;
  severity: "info" | "warning" | "critical";
  payload: Record<string, unknown>;
  dedupe_key: string;
};

type AlertRow = {
  resident_id: string;
  kind: string;
  message: string;
  severity: "info" | "warning" | "critical";
  source: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
};

function buildRecs(residentId: string, intel: ResidentIntelligence): RecRow[] {
  const out: RecRow[] = [];

  for (const r of intel.recommendations) {
    out.push({
      resident_id: residentId,
      kind: "recommendation",
      domain: null,
      title: r.title,
      detail: r.detail,
      severity: r.severity,
      payload: { evidence: r.evidence, source_id: r.id },
      dedupe_key: `rec:${residentId}:${r.id}`,
    });
  }
  for (const g of intel.careGaps) {
    out.push({
      resident_id: residentId,
      kind: "care_gap",
      domain: g.domain,
      title: `${g.kind === "missing_plan" ? "Missing" : "Stale"} care plan: ${g.domain}`,
      detail: g.message,
      severity: g.kind === "missing_plan" ? "warning" : "info",
      payload: { evidence: g.evidence, gap_kind: g.kind },
      dedupe_key: `gap:${residentId}:${g.domain}:${g.kind}`,
    });
  }
  for (const p of intel.predictions) {
    out.push({
      resident_id: residentId,
      kind: "prediction",
      domain: null,
      title: p.title,
      detail: `${p.horizon} · ${p.rationale}`,
      severity: p.likelihood === "High" ? "warning" : "info",
      payload: { evidence: p.evidence, horizon: p.horizon, likelihood: p.likelihood },
      dedupe_key: `pred:${residentId}:${p.title}`,
    });
  }
  for (const d of intel.deterioration) {
    out.push({
      resident_id: residentId,
      kind: "deterioration",
      domain: d.key,
      title: `Possible decline: ${d.label}`,
      detail: d.message,
      severity: "warning",
      payload: { evidence: d.evidence, recent: d.recent, prior: d.prior },
      dedupe_key: `det:${residentId}:${d.key}`,
    });
  }
  for (const p of intel.planReviews) {
    out.push({
      resident_id: residentId,
      kind: "plan_review",
      domain: p.domain,
      title: `Care plan review suggested: ${p.domain}`,
      detail: p.reason,
      severity: "info",
      payload: { evidence: p.evidence },
      dedupe_key: `review:${residentId}:${p.domain}`,
    });
  }
  for (const s of intel.safeguarding) {
    out.push({
      resident_id: residentId,
      kind: "safeguarding",
      domain: null,
      title: `Safeguarding signal: ${s.signal}`,
      detail: `${s.count} signal(s) in recent notes — manager review required.`,
      severity: "critical",
      payload: { evidence: s.evidence, count: s.count },
      dedupe_key: `safe:${residentId}:${s.signal}`,
    });
  }
  return out;
}

function buildAlerts(residentId: string, intel: ResidentIntelligence): AlertRow[] {
  const out: AlertRow[] = [];
  for (const r of intel.recommendations) {
    if (r.severity === "critical") {
      out.push({
        resident_id: residentId,
        kind: "ai_recommendation",
        message: r.title,
        severity: "critical",
        source: "care_intelligence",
        dedupe_key: `alert:rec:${residentId}:${r.id}`,
        payload: { detail: r.detail },
      });
    }
  }
  for (const d of intel.deterioration) {
    out.push({
      resident_id: residentId,
      kind: "deterioration",
      message: `Possible decline: ${d.label}`,
      severity: "warning",
      source: "care_intelligence",
      dedupe_key: `alert:det:${residentId}:${d.key}`,
      payload: { recent: d.recent, prior: d.prior },
    });
  }
  for (const p of intel.predictions) {
    if (p.likelihood === "High") {
      out.push({
        resident_id: residentId,
        kind: "prediction",
        message: p.title,
        severity: "warning",
        source: "care_intelligence",
        dedupe_key: `alert:pred:${residentId}:${p.title}`,
        payload: { horizon: p.horizon },
      });
    }
  }
  for (const s of intel.safeguarding) {
    out.push({
      resident_id: residentId,
      kind: "safeguarding",
      message: `Safeguarding signal: ${s.signal}`,
      severity: "critical",
      source: "care_intelligence",
      dedupe_key: `alert:safe:${residentId}:${s.signal}`,
      payload: { count: s.count },
    });
  }
  return out;
}

/**
 * Sync intelligence outputs into ai_recommendations + alerts.
 * Idempotent via dedupe_key partial-unique indexes.
 * Errors are swallowed (advisory, non-blocking UI).
 */
export async function syncResidentIntelligence(
  residentId: string,
  intel: ResidentIntelligence,
): Promise<void> {
  if (!residentId || intel.noteCount === 0) return;
  const recs = buildRecs(residentId, intel);
  const alerts = buildAlerts(residentId, intel);

  try {
    if (recs.length) {
      // Find which dedupe_keys already exist as pending — only insert new ones.
      const keys = recs.map((r) => r.dedupe_key);
      const { data: existing } = await supabase
        .from("ai_recommendations")
        .select("dedupe_key")
        .in("dedupe_key", keys)
        .eq("status", "pending");
      const have = new Set((existing ?? []).map((e) => e.dedupe_key));
      const fresh = recs.filter((r) => !have.has(r.dedupe_key));
      if (fresh.length) await supabase.from("ai_recommendations").insert(fresh as never);
    }
    if (alerts.length) {
      const keys = alerts.map((a) => a.dedupe_key);
      const { data: existing } = await supabase
        .from("alerts")
        .select("dedupe_key")
        .in("dedupe_key", keys)
        .in("status", ["open", "acknowledged"]);
      const have = new Set((existing ?? []).map((e) => e.dedupe_key as string));
      const fresh = alerts.filter((a) => !have.has(a.dedupe_key));
      if (fresh.length) await supabase.from("alerts").insert(fresh.map((a) => ({ ...a, resolved: false })) as never);

    }
  } catch (err) {
    // Non-fatal — UI still shows in-memory intelligence.
    console.warn("[intelligence-sync] failed", err);
  }
}
