import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Activity,
  LayoutDashboard,
  Mic,
  PanelLeft,
  ShieldCheck,
  Sparkles,
  Ear,
  Brain,
  FileCheck2,
  CheckCircle2,
  Clock,
  HeartHandshake,
  AlertTriangle,
  Users,
  Building2,
  Home,
  Stethoscope,
  Quote,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ForgeAI — The Digital Witness to Care Delivery" },
      {
        name: "description",
        content:
          "ForgeAI turns natural care conversations into structured, compliant records — so care professionals spend more time with residents and less on paperwork.",
      },
      { property: "og:title", content: "ForgeAI — The Digital Witness to Care Delivery" },
      {
        property: "og:description",
        content:
          "Voice-first AI documentation for nursing homes, residential care, supported living and domiciliary services.",
      },
      { property: "og:url", content: "https://resident-voice-log.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://resident-voice-log.lovable.app/" }],
  }),
  component: Landing,
});

function Landing() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">ForgeAI</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                The Digital Witness to Care
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> ForgeAI
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-2">
                  {[
                    { title: "Dashboard", url: "/dashboard" },
                    { title: "Residents", url: "/residents" },
                    { title: "Care Plans", url: "/care-plans" },
                    { title: "Tasks", url: "/tasks" },
                    { title: "Daily Notes", url: "/notes" },
                    { title: "Audits", url: "/audits" },
                  ].map((item) => (
                    <Button key={item.title} variant="ghost" className="justify-start" asChild>
                      <Link to={item.url}>{item.title}</Link>
                    </Button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            {isSignedIn ? (
              <Button asChild className="gap-2">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-5 inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> The Digital Witness to Care Delivery
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Care First. <span className="text-primary">Documentation Automatically.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              ForgeAI transforms natural care conversations into structured, compliant care records — helping
              care professionals spend more time supporting residents and less time completing paperwork.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">Book a Demo</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Join Early Access</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Care is happening. Documentation is happening too.
            </p>
          </div>

          {/* Hero illustration */}
          <div className="relative">
            <div className="relative rounded-3xl border bg-card p-6 shadow-xl">
              <div className="flex items-center gap-3 border-b pb-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <HeartHandshake className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Carer with Margaret, Room 12</div>
                  <div className="text-xs text-muted-foreground">Personal care · 08:42</div>
                </div>
                <div className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Listening
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl bg-muted/60 p-3 text-muted-foreground">
                  "Morning Margaret, let's get you washed and dressed. How's your hip feeling today?"
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-muted-foreground">
                  "A bit sore. I didn't sleep well."
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" /> AI care note · drafted
                </div>
                <p className="text-sm">
                  Assisted Margaret with full personal care. Reported hip discomfort and poor sleep overnight.
                  Mobility steady with frame. Linked to <span className="font-medium">Pain Management</span> care
                  plan and <span className="font-medium">Falls</span> risk assessment.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-7 text-xs">Approve</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">Edit</Button>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 hidden rounded-2xl border bg-card px-4 py-3 shadow-lg sm:block">
              <div className="flex items-center gap-2 text-xs">
                <Mic className="h-4 w-4 text-primary" />
                <span className="font-medium">Captured passively</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Phone in pocket · 1.4s to draft</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-destructive" /> The problem
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The care was given. The documentation wasn't.
          </h2>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Every day, care professionals provide exceptional support — but documentation is often completed
            hours later, at the end of a shift, or under significant time pressure.
          </p>
          <p className="mt-3 max-w-3xl text-muted-foreground">When care is not documented, proving what happened becomes difficult. This creates risk during:</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Safeguarding investigations",
              "Complaints",
              "CQC inspections",
              "Coroners' inquests",
            ].map((r) => (
              <div key={r} className="rounded-2xl border bg-background p-5">
                <AlertTriangle className="mb-2 h-5 w-5 text-destructive" />
                <div className="font-medium">{r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> The solution
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            A digital witness to care delivery.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
            ForgeAI captures care interactions in real time and automatically generates professional care
            records. Using voice technology, AI, resident identification and contextual awareness, ForgeAI
            turns everyday care conversations into structured documentation — linked directly to care plans
            and risk assessments.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-3 text-muted-foreground">Five steps. Zero friction at the bedside.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-5">
            {[
              { icon: Users, title: "Identify", body: "Resident and staff identified automatically through room beacons and wearable devices." },
              { icon: Ear, title: "Listen", body: "Care conversations and observations captured naturally during care delivery." },
              { icon: Brain, title: "Understand", body: "AI extracts relevant information and categorises it appropriately." },
              { icon: FileCheck2, title: "Document", body: "Professional care notes generated automatically and linked to the resident record." },
              { icon: CheckCircle2, title: "Approve", body: "Staff quickly review and approve documentation before it is saved." },
            ].map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border bg-background p-5">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <s.icon className="mb-2 h-5 w-5 text-primary" />
                <div className="font-medium">{s.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Key benefits</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Outcomes care providers feel within the first week — for residents, staff and registered managers.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: "More time caring", body: "Reduce admin workload and increase direct resident contact." },
              { icon: FileCheck2, title: "Better documentation", body: "Capture meaningful interactions while details are fresh and accurate." },
              { icon: ShieldCheck, title: "Stronger compliance", body: "Contemporaneous records that support regulatory requirements." },
              { icon: HeartHandshake, title: "Improved safeguarding", body: "Clear evidence of observations, concerns and actions taken." },
              { icon: AlertTriangle, title: "Reduced risk", body: "Support during investigations, complaints and inspections." },
              { icon: Sparkles, title: "Earlier insight", body: "Trends and emerging risks surfaced across the whole service." },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border bg-card p-6">
                <b.icon className="mb-3 h-6 w-6 text-primary" />
                <div className="font-medium">{b.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for care */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for care</h2>
          <p className="mt-3 text-muted-foreground">Designed for the full breadth of adult social care.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Stethoscope, label: "Nursing Homes" },
              { icon: Building2, label: "Residential Care Homes" },
              { icon: Home, label: "Supported Living Services" },
              { icon: HeartHandshake, label: "Domiciliary Care" },
              { icon: Users, label: "Learning Disability Services" },
              { icon: Brain, label: "Mental Health Services" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl border bg-background p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligent care management */}
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Beyond documentation
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Intelligent care management.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              ForgeAI doesn't simply write notes. It connects information across the whole service, helping
              organisations identify trends and emerging risks earlier.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Daily Records",
              "Care Plans",
              "Risk Assessments",
              "Incidents",
              "Family Communication",
              "Clinical Observations",
            ].map((c) => (
              <div key={c} className="rounded-xl border bg-card p-4 text-sm font-medium">
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder story */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Founder story
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Inspired by real experience.
          </h2>
          <div className="mt-6 rounded-2xl border bg-background p-6">
            <Quote className="mb-4 h-6 w-6 text-primary" />
            <p className="text-lg leading-relaxed text-muted-foreground">
              ForgeAI was created from firsthand experience working as a nurse and nursing home manager.
              Years of managing safeguarding investigations, complaints, inspections and complex care
              environments highlighted a recurring problem: care was often delivered, but the evidence of
              that care was missing from the record.
            </p>
            <p className="mt-4 font-medium">ForgeAI was built to bridge that gap.</p>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Our vision
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The future of care documentation.
          </h2>
          <div className="mx-auto mt-6 max-w-2xl space-y-3 text-lg text-muted-foreground">
            <p>A world where documentation becomes a natural by-product of care delivery.</p>
            <p>Where care professionals spend more time with residents than behind screens.</p>
            <p>Where every meaningful interaction is captured, understood and transformed into actionable insight.</p>
            <p>Where technology supports care rather than distracting from it.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to transform care documentation?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
            Reduce paperwork. Improve compliance. Create stronger evidence of care delivery.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/auth">
                Book a Demo <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/auth">Join the Waitlist</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">ForgeAI</span>
            <span>· The Digital Witness to Care Delivery</span>
          </div>
          <div>© {new Date().getFullYear()} ForgeAI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
