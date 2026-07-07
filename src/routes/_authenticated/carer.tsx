import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { Heart, LayoutDashboard, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CarerTabBar } from "@/components/CarerTabBar";

export const Route = createFileRoute("/_authenticated/carer")({
  head: () => ({ meta: [{ title: "ForgeAI — Carer" }] }),
  component: CarerLayout,
});

function CarerLayout() {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4">
        <Link to="/carer" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Heart className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">ForgeAI</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Manager dashboard" asChild>
            <Link to="/dashboard"><LayoutDashboard className="h-4 w-4" /></Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <CarerTabBar />
    </div>
  );
}
