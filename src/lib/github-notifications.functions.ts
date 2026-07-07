import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

export type GitHubNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string;
  severity: "info" | "warning" | "critical" | null;
  created_at: string;
  read_at: string | null;
  source: "github";
  thread_id: string;
  repository: string;
};

const threadIdSchema = z.object({ threadId: z.string() });

export const getGitHubNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GITHUB_API_KEY = process.env.GITHUB_API_KEY;
    if (!LOVABLE_API_KEY || !GITHUB_API_KEY) {
      throw new Error("GitHub connector is not configured");
    }

    const res = await fetch(`${GATEWAY_URL}/notifications`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GITHUB_API_KEY,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[github-notifications] fetch failed [${res.status}]: ${text}`);
      throw new Error(`GitHub notifications failed [${res.status}]: ${text}`);
    }

    const raw = (await res.json()) as Array<{
      id: string;
      unread: boolean;
      subject: { title: string; type: string; url?: string };
      repository: { full_name: string };
      updated_at: string;
      reason: string;
    }>;

    return raw.map((n): GitHubNotification => {
      const severity: GitHubNotification["severity"] =
        n.reason === "assign"
          ? "critical"
          : n.reason === "mention" || n.reason === "team_mention" || n.reason === "review_requested"
            ? "warning"
            : "info";

      const link = n.subject?.url
        ? n.subject.url
            .replace("api.github.com/repos", "github.com")
            .replace("/pulls/", "/pull/")
        : `https://github.com/${n.repository.full_name}`;

      return {
        id: `github-${n.id}`,
        title: n.subject.title,
        body: `${n.repository.full_name} · ${n.reason.replace(/_/g, " ")}`,
        link,
        severity,
        created_at: n.updated_at,
        read_at: n.unread ? null : n.updated_at,
        source: "github",
        thread_id: n.id,
        repository: n.repository.full_name,
      };
    });
  });

export const markGitHubNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data) => threadIdSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GITHUB_API_KEY = process.env.GITHUB_API_KEY;
    if (!LOVABLE_API_KEY || !GITHUB_API_KEY) {
      throw new Error("GitHub connector is not configured");
    }

    const res = await fetch(`${GATEWAY_URL}/notifications/threads/${data.threadId}`, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GITHUB_API_KEY,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[github-notifications] mark read failed [${res.status}]: ${text}`);
      throw new Error(`Mark GitHub notification read failed [${res.status}]: ${text}`);
    }

    return { ok: true };
  });
