import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Bell,
  Bluetooth,
  Download,
  Info,
  KeyRound,
  LogOut,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { getAppVersion, getAppBuildTimeLocal } from "@/lib/app-version";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareCore" },
      { name: "description", content: "Account, notifications and app settings for CareCore." },
      { property: "og:title", content: "Settings — CareCore" },
      { property: "og:description", content: "Account, notifications and app settings for CareCore." },
    ],
  }),
  component: SettingsPage,
});

const NOTIF_KEY = "carecore-notification-prefs";

type NotifPrefs = {
  alerts: boolean;
  reviewsDue: boolean;
  tasks: boolean;
};

const DEFAULT_PREFS: NotifPrefs = { alerts: true, reviewsDue: true, tasks: true };

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function SettingsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const updatePref = (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    toast.success("Preference saved");
  };

  const { data: account } = useQuery({
    queryKey: ["settings-account"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, approved, is_active")
        .eq("user_id", user.id);
      const active = (roles ?? []).filter((r) => r.approved && r.is_active);
      return {
        email: user.email ?? "",
        name: (user.user_metadata?.full_name as string | undefined) ?? "",
        roles: active.map((r) => ROLE_LABELS[r.role as Role] ?? r.role),
        isAdmin: active.some((r) => r.role === "admin" || r.role === "manager"),
      };
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <AppShell title="Settings" subtitle="Account, notifications and app preferences">
      <div className="mx-auto grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> My account
            </CardTitle>
            <CardDescription>Who you're signed in as and what you can access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-1">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{account?.name || "—"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium break-all">{account?.email || "—"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">
                {account?.roles.length ? account.roles.join(", ") : "—"}
              </span>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/reset-password">
                  <KeyRound className="h-4 w-4" /> Change password
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
            <CardDescription>Choose what the bell in the top bar highlights for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="pref-alerts" className="flex-1">
                Clinical alerts
                <span className="block text-xs font-normal text-muted-foreground">
                  New and escalating alerts for residents.
                </span>
              </Label>
              <Switch
                id="pref-alerts"
                checked={prefs.alerts}
                onCheckedChange={(v) => updatePref("alerts", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="pref-reviews" className="flex-1">
                Reviews due
                <span className="block text-xs font-normal text-muted-foreground">
                  Care plans, risk assessments, consents and capacity reviews coming due.
                </span>
              </Label>
              <Switch
                id="pref-reviews"
                checked={prefs.reviewsDue}
                onCheckedChange={(v) => updatePref("reviewsDue", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="pref-tasks" className="flex-1">
                Tasks assigned to me
                <span className="block text-xs font-normal text-muted-foreground">
                  New tasks and approaching due dates.
                </span>
              </Label>
              <Switch
                id="pref-tasks"
                checked={prefs.tasks}
                onCheckedChange={(v) => updatePref("tasks", v)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Administration
            </CardTitle>
            <CardDescription>Shortcuts to the areas you manage.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {account?.isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <Users className="h-4 w-4" /> Staff & roles
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/devices">
                <Bluetooth className="h-4 w-4" /> Devices
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/downloads">
                <Download className="h-4 w-4" /> Downloads
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" /> About this app
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">CareCore</span> — person-centred care
              recording for Meadowbrook Care Home.
            </p>
            <p>Version {getAppVersion()}</p>
            <p>Built {getAppBuildTimeLocal()}</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
