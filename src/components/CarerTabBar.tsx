import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Mic, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: { to: string; label: string; icon: typeof Home; exact?: boolean }[] = [
  { to: "/carer", label: "Today", icon: Home, exact: true },
  { to: "/carer/capture", label: "Capture", icon: Mic },
  { to: "/residents", label: "Residents", icon: Users },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export function CarerTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to as string}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
