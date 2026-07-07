// Integration-managed auth gate. Redirects unauthenticated users to /auth.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isNativeShell } from "@/lib/surface";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Android/iOS Capacitor shell → carer surface on first landing.
    if (
      isNativeShell() &&
      (location.pathname === "/" || location.pathname === "/dashboard")
    ) {
      throw redirect({ to: "/carer" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
