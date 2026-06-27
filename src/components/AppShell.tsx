import { useRouter } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="h-8 w-8 border border-border bg-background hover:bg-accent" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Open menu to change pages</TooltipContent>
              </Tooltip>
              <div>
                <h1 className="text-base font-semibold leading-tight md:text-lg">{title}</h1>
                <p className="text-xs text-muted-foreground">{subtitle ?? "Meadowbrook Care Home"}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {action}
              <Button variant="ghost" size="icon" aria-label="Send a CQC notification" asChild>
                <a
                  href="https://www.cqc.org.uk/guidance-providers/notifications"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Send a CQC notification"
                >
                  <Bell className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Profile">
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 bg-background p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
