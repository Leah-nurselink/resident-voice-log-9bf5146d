import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink, Phone, Search, Shield } from "lucide-react";
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
  component: SafeguardingPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
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
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Safeguarding directory</h1>
          <p className="text-sm text-muted-foreground">
            Adult safeguarding referral pages for every local authority across
            England, Scotland and Wales. Always verify the route locally before
            raising a concern.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Find your council</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by council or region…"
              className="pl-9"
            />
          </div>

          <Tabs value={country} onValueChange={(v) => setCountry(v as Country)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="All">All ({counts.All})</TabsTrigger>
              <TabsTrigger value="England">England ({counts.England})</TabsTrigger>
              <TabsTrigger value="Scotland">Scotland ({counts.Scotland})</TabsTrigger>
              <TabsTrigger value="Wales">Wales ({counts.Wales})</TabsTrigger>
            </TabsList>

            <TabsContent value={country} className="mt-4">
              <p className="mb-3 text-xs text-muted-foreground">
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
        </CardContent>
      </Card>
    </div>
  );
}

function CouncilCard({ council }: { council: Council }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">
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
            className="flex items-center gap-2 text-xs text-foreground hover:text-primary"
          >
            <Phone className="h-3.5 w-3.5" />
            {council.phone}
          </a>
        )}
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="w-full justify-between"
        >
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${council.name} council adult safeguarding referral`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Find referral page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="w-full justify-between text-xs"
        >
          <a href={council.safeguardingUrl} target="_blank" rel="noreferrer">
            Try direct link
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
