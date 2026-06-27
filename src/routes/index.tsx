import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, Mic, PanelLeft, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ForgeAI — AI clinical scribe for social care" },
      { name: "description", content: "Capture care interactions in real time. Voice-first documentation that auto-links to care plans and risk assessments." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setIsSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ForgeAI</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI clinical scribe</div>
          </div>
        </div>
        {isSignedIn ? (
          <Button asChild className="gap-2">
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        ) : (
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 text-center">
        <p className="mb-4 inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> AI documentation that captures care as it happens
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          The AI clinical scribe for adult social care.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
          Carers speak naturally during a resident interaction. ForgeAI turns it into a professional record and auto-links it to the right care plan and risk assessment.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button size="lg" asChild><Link to="/auth">Get started</Link></Button>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Mic, title: "Voice-first", body: "Speak naturally. AI writes the note in UK care language." },
            { icon: ShieldCheck, title: "Auto-linked", body: "Notes connect to care plans and risk assessments automatically." },
            { icon: Activity, title: "Live dashboard", body: "Managers see flags, patterns, and outstanding tasks in real time." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-4 text-left">
              <f.icon className="mb-2 h-5 w-5 text-primary" />
              <div className="font-medium">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
