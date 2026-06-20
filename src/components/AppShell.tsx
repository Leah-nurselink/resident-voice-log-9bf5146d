import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, Heart, ShieldAlert, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/residents", label: "Residents", icon: Users },
  { to: "/alerts", label: "Alerts", icon: ShieldAlert },
  { to: "/family", label: "Family", icon: Heart },
];

export function AppShell() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Mic className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight">Caresound</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                AI care scribe
              </div>
            </div>
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right text-sm">
              <div className="font-medium">Aisha Khan</div>
              <div className="text-xs text-muted-foreground">Care Assistant · Lavender Wing</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground text-sm font-semibold">
              AK
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-24 pt-6 sm:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-56 shrink-0 lg:block">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {nav.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[11px] font-medium",
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
