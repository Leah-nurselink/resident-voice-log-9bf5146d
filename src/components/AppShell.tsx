import { Link, useRouter } from "@tanstack/react-router";
import { Bell, FileWarning, LogOut, MoreVertical, User } from "lucide-react";
import { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export function AppShell({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-card px-3 py-2 md:flex md:min-h-16 md:items-center md:justify-between md:px-6 md:py-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="h-10 w-10 shrink-0 border border-border bg-background hover:bg-accent md:h-8 md:w-8" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Open menu to change pages</TooltipContent>
              </Tooltip>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold leading-tight md:text-lg">{title}</h1>
                <p className="truncate text-xs text-muted-foreground">{subtitle ?? "Meadowbrook Care Home"}</p>
              </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
              <NotificationBell />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Clinical alerts" asChild className="hidden md:inline-flex">
                    <Link to="/alerts">
                      <Bell className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Clinical alerts</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Send a CQC notification" asChild className="hidden md:inline-flex">
                    <a
                      href="https://www.cqc.org.uk/guidance-providers/notifications"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileWarning className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Send a CQC notification</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="icon" aria-label="Profile" className="hidden md:inline-flex">
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" className="hidden md:inline-flex">
                <LogOut className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More options" className="md:hidden">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild className="min-h-11">
                    <Link to="/alerts"><Bell /> Clinical alerts</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="min-h-11">
                    <a href="https://www.cqc.org.uk/guidance-providers/notifications" target="_blank" rel="noopener noreferrer">
                      <FileWarning /> Send a CQC notification
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11"><User /> Profile</DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11" onSelect={signOut}><LogOut /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>
            {action ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-2 md:mt-0 md:border-0 md:pt-0">{action}</div> : null}
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden bg-background p-3 sm:p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
