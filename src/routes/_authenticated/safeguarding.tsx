import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Phone, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { COUNCILS, type Council } from "@/lib/safeguarding-councils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/safeguarding")({
  head: () => ({
    meta: [
      { title: "Safeguarding directory · CareCore" },
      { name: "description", content: "Find local adult safeguarding contacts and referral pages in CareCore." },
      { property: "og:title", content: "Safeguarding directory · CareCore" },
      { property: "og:description", content: "Find local adult safeguarding contacts and referral pages in CareCore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SafeguardingPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type Country = "All" | "England" | "Scotland" | "Wales";

function SafeguardingPage() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<Country>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNCILS.filter((c) => {
      if (country !== "All" && c.country !== country) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.region?.toLowerCase().includes(q) ?? false)
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, country]);

  const counts = useMemo(
    () => ({
      All: COUNCILS.length,
      England: COUNCILS.filter((c) => c.country === "England").length,
      Scotland: COUNCILS.filter((c) => c.country === "Scotland").length,
      Wales: COUNCILS.filter((c) => c.country === "Wales").length,
    }),
    [],
  );

  return (
    <AppShell
      title="Safeguarding"
      subtitle="Local safeguarding contacts"
      action={
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
        </Button>
      }
    >
      <div className="space-y-4 pb-20">
        <p className="text-sm text-muted-foreground">
          Adult safeguarding contacts across England, Scotland and Wales.
          Always verify referral details locally before raising a concern.
        </p>
        <section aria-labelledby="council-search-heading" className="space-y-4">
          <h2 id="council-search-heading" className="text-base font-semibold">Find your council</h2>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search by council or region"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by council or region…"
              className="min-h-11 pl-9 text-base"
            />
          </div>

          <Tabs value={country} onValueChange={(v) => setCountry(v as Country)}>
            <TabsList aria-label="Filter councils by country" className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger className="min-h-11 min-w-0" value="All">All ({counts.All})</TabsTrigger>
              <TabsTrigger className="min-h-11 min-w-0" value="England">England ({counts.England})</TabsTrigger>
              <TabsTrigger className="min-h-11 min-w-0" value="Scotland">Scotland ({counts.Scotland})</TabsTrigger>
              <TabsTrigger className="min-h-11 min-w-0" value="Wales">Wales ({counts.Wales})</TabsTrigger>
            </TabsList>

            <TabsContent value={country} className="mt-4">
              <p role="status" aria-live="polite" className="mb-3 text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "council" : "councils"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((c) => (
                  <CouncilCard key={`${c.country}-${c.name}`} council={c} />
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No councils match your search.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </AppShell>
  );
}

function CouncilCard({ council }: { council: Council }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <CardTitle className="min-w-0 break-words text-base font-semibold leading-tight">
            {council.name}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {council.country}
          </Badge>
        </div>
        {council.region && (
          <p className="text-xs text-muted-foreground">{council.region}</p>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-2 pt-2">
        {council.phone && (
          <a
            href={`tel:${council.phone.replace(/\s+/g, "")}`}
            aria-label={`Call ${council.name} on ${council.phone}`}
            className="flex min-h-11 items-center gap-2 rounded-md text-sm text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Phone className="h-3.5 w-3.5" />
            {council.phone}
          </a>
        )}
        <Button
          asChild
          size="sm"
          className="min-h-11 w-full justify-between"
        >
          <a href={council.safeguardingUrl} target="_blank" rel="noreferrer">
            Go to safeguarding page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="min-h-11 w-full justify-between text-sm"
        >
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${council.name} council adult safeguarding referral`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Search instead
            <Search className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
