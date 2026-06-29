// Public inbound email webhook for the Smart Communications Hub.
// Accepts a JSON payload from any inbound-email provider (Resend Inbound,
// Mailgun routes, Postmark) with a generic shape:
//   { from, to, subject, text, html?, message_id?, in_reply_to? }
// Optional header signature verification via INBOUND_WEBHOOK_SECRET.
// Matches the resident by +token@ alias first, then by fuzzy name search.
// Creates a communications row, extracts actions via AI, and persists tasks.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type Payload = {
  from?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
  in_reply_to?: string;
};

function parseAddress(s?: string): { email: string; name?: string } {
  if (!s) return { email: "" };
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].toLowerCase(), name: m[1].trim() || undefined };
  return { email: s.trim().toLowerCase() };
}

function pickTo(to: Payload["to"]): string {
  if (Array.isArray(to)) return to[0] ?? "";
  return to ?? "";
}

export const Route = createFileRoute("/api/public/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env.INBOUND_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[inbound-email] INBOUND_WEBHOOK_SECRET not configured; rejecting request");
          return new Response("Unauthorized", { status: 401 });
        }
        const sig = request.headers.get("x-signature") ?? "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let p: Payload;
        try { p = JSON.parse(raw) as Payload; }
        catch { return new Response("Invalid JSON", { status: 400 }); }

        const toRaw = pickTo(p.to);
        const fromParsed = parseAddress(p.from);
        const body = (p.text ?? p.html ?? "").toString().slice(0, 50_000);

        // Resolve resident by alias token or fuzzy name
        const tokenMatch = toRaw.match(/\+([a-f0-9]{8,16})@/i);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let residentId: string | null = null;
        if (tokenMatch) {
          const { data: r } = await supabaseAdmin
            .from("residents").select("id").eq("inbound_token", tokenMatch[1].toLowerCase()).maybeSingle();
          residentId = (r?.id as string | undefined) ?? null;
        }
        if (!residentId) {
          const hay = `${p.subject ?? ""} ${body}`.toLowerCase();
          const { data: residents } = await supabaseAdmin
            .from("residents").select("id,full_name,preferred_name").limit(500);
          for (const r of residents ?? []) {
            const n = String(r.full_name ?? "").toLowerCase();
            if (n && hay.includes(n)) { residentId = r.id as string; break; }
            const pn = String(r.preferred_name ?? "").toLowerCase();
            if (pn && pn.length > 2 && hay.includes(pn)) { residentId = r.id as string; break; }
          }
        }

        // Resolve / auto-create professional by sender email
        let professionalId: string | null = null;
        if (fromParsed.email) {
          const { data: pro } = await supabaseAdmin
            .from("professionals").select("id").eq("email", fromParsed.email).maybeSingle();
          if (pro) professionalId = pro.id as string;
          else {
            const { data: inserted } = await supabaseAdmin
              .from("professionals").insert({
                name: fromParsed.name ?? fromParsed.email,
                role: "Unknown (auto-added)",
                email: fromParsed.email,
              } as never).select("id").single();
            professionalId = (inserted?.id as string | undefined) ?? null;
          }
        }

        // Insert communications row
        const { data: commIns, error: ce } = await supabaseAdmin
          .from("communications").insert({
            resident_id: residentId,
            professional_id: professionalId,
            direction: "inbound",
            channel: "email",
            status: "received",
            subject: p.subject ?? null,
            body,
            sender_email: fromParsed.email || null,
            sender_name: fromParsed.name ?? null,
            from_message_id: p.message_id ?? null,
            in_reply_to: p.in_reply_to ?? null,
            received_at: new Date().toISOString(),
          } as never).select("id").single();
        if (ce) {
          console.error("[inbound-email] DB insert failed", ce);
          return new Response("Internal server error", { status: 500 });
        }
        const commId = (commIns as { id: string }).id;

        // Extract tasks via Lovable AI (best effort, non-blocking on failure)
        try {
          const lov = process.env.LOVABLE_API_KEY;
          if (lov && body) {
            const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
            const { generateText, Output } = await import("ai");
            const { z } = await import("zod");
            const gateway = createLovableAiGatewayProvider(lov);
            const schema = z.object({
              summary: z.string().max(600),
              tasks: z.array(z.object({
                kind: z.enum(["recommendation","appointment","referral","investigation","monitoring","follow_up","medication","other"]),
                title: z.string().max(160),
                detail: z.string().max(600).optional(),
                due_date: z.string().max(40).nullable().optional(),
                priority: z.enum(["low","normal","high","urgent"]).default("normal"),
              })).max(20),
            });
            const { experimental_output } = await generateText({
              model: gateway("google/gemini-3-flash-preview"),
              system: "Extract a short summary and actionable tasks from this inbound healthcare professional message. UK English. Do not invent facts. Empty array if no actions.",
              prompt: `Subject: ${p.subject ?? ""}\n\n${body.slice(0, 10_000)}`,
              experimental_output: Output.object({ schema }),
            });

            await supabaseAdmin.from("communications").update({
              ai_summary: experimental_output.summary, status: "processed",
            } as never).eq("id", commId);

            if (experimental_output.tasks?.length) {
              const rows = experimental_output.tasks.map((t) => ({
                communication_id: commId,
                resident_id: residentId,
                kind: t.kind,
                title: t.title,
                detail: t.detail ?? null,
                due_date: t.due_date && /^\d{4}-\d{2}-\d{2}/.test(t.due_date) ? t.due_date.slice(0, 10) : null,
                priority: t.priority ?? "normal",
              }));
              await supabaseAdmin.from("communication_tasks").insert(rows as never);
            }

            // Raise an alert for urgent items
            const urgent = experimental_output.tasks?.find((t) => t.priority === "urgent");
            if (urgent && residentId) {
              await supabaseAdmin.from("alerts").insert({
                resident_id: residentId,
                kind: "inbound_urgent",
                message: `Urgent action from ${fromParsed.email || "professional"}: ${urgent.title}`,
                severity: "critical",
                source: "communications",
                dedupe_key: `alert:inbound:${commId}`,
                resolved: false,
                payload: { communication_id: commId },
              } as never);
            }
          }
        } catch (e) {
          console.warn("[inbound-email] extraction failed", e);
        }

        return new Response(JSON.stringify({ ok: true, communication_id: commId, resident_id: residentId }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
