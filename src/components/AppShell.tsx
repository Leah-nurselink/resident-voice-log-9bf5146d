import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, Home, LogOut, Users, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/residents", label: "Residents", icon: Users },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/family", label: "Family", icon: Heart },
];

export function AppShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">ForgeAI</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI clinical scribe</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {action}
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
