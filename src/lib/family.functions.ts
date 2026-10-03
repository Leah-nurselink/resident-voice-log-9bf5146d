import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function assertManager(context: Ctx) {
  const [a, m] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!a.data && !m.data) throw new Error("Only an Admin or Manager can do this");
}

function escapeHtml(s: unknown) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Admin/Manager creates a family or LPA login linked to one resident. */
export const inviteFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    residentId: z.string().uuid(),
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    relationship: z.string().trim().max(60),
    phone: z.string().trim().max(40).optional(),
    tempPassword: z.string().min(8).max(72),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.tempPassword, email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "family", approved: true, is_active: true });
    if (rErr) throw new Error(rErr.message);
    const { error: fErr } = await supabaseAdmin.from("family_members").insert({
      resident_id: data.residentId, full_name: data.fullName, email: data.email,
      relationship: data.relationship, phone: data.phone || null, user_id: uid,
    });
    if (fErr) throw new Error(fErr.message);
    return { userId: uid };
  });

/** Family member: their linked resident(s) plus a short care overview for the chosen period. */
export const getFamilySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period: z.enum(["24h", "7d", "14d"]), residentId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: links } = await context.supabase.from("family_members")
      .select("id, resident_id, relationship, residents(full_name, preferred_name)")
      .eq("user_id", context.userId);
    const list = (links ?? []) as unknown as { id: string; resident_id: string; relationship: string | null; residents: { full_name: string; preferred_name: string | null } | null }[];
    if (!list.length) return { links: [], summary: null };
    const link = list.find((l) => l.resident_id === data.residentId) ?? list[0];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadHighlights } = await import("./resident-highlights");
    const h = await loadHighlights(link.resident_id, data.period, supabaseAdmin, true);
    const name = link.residents?.preferred_name || link.residents?.full_name?.split(" ")[0] || "Your relative";
    const lines: string[] = [];
    lines.push(h.noteCount ? `Staff recorded ${h.noteCount} care update${h.noteCount === 1 ? "" : "s"} for ${name}.` : `No care updates have been recorded for ${name} in this period yet.`);
    for (const a of h.areas) if (a.count) lines.push(`${a.label}: supported ${a.count} time${a.count === 1 ? "" : "s"}${a.concerns ? " — the team is keeping an eye on this" : ", all going well"}.`);
    const m = h.meds;
    if (m.given + m.refused + m.omitted) lines.push(`Medication: ${m.given} dose${m.given === 1 ? "" : "s"} given${m.refused ? `, ${m.refused} declined` : ""}.`);
    if (h.professionalTotal) lines.push(`Seen by health professionals: ${h.professionals.map((p) => p.label).join(", ")}.`);
    return {
      links: list.map((l) => ({ id: l.id, residentId: l.resident_id, name: l.residents?.full_name ?? "Resident" })),
      residentId: link.resident_id, familyMemberId: link.id,
      summary: { name, lines },
    };
  });

/** Admin/Manager replies to family feedback — saved in app and emailed to the family member. */
export const respondToFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ feedbackId: z.string().uuid(), response: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { data: fb, error } = await context.supabase.from("family_feedback" as never)
      .update({ manager_response: data.response, responded_by: context.userId, responded_at: new Date().toISOString() } as never)
      .eq("id", data.feedbackId).select("user_id, resident_id").single();
    if (error || !fb) throw new Error(error?.message ?? "Feedback not found");
    const { user_id } = fb as { user_id: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const email = u.user?.email;
    let emailed = false;
    const lov = process.env.LOVABLE_API_KEY; const rk = process.env.RESEND_API_KEY;
    if (email && lov && rk) {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": rk },
        body: JSON.stringify({
          from: "CareCore <onboarding@resend.dev>", to: [email],
          subject: "A reply to your feedback",
          html: `<p>Thank you for your feedback. The home has replied:</p><p style="white-space:pre-wrap">${escapeHtml(data.response)}</p><p>You can also see this reply when you sign in to the family page.</p>`,
        }),
      });
      emailed = res.ok;
    }
    return { emailed };
  });
