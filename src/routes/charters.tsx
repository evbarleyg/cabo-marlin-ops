import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { useOpsShortlist } from "@/lib/app-context";
import { chartersEnvelopeSchema } from "@/lib/schemas";
import { formatNumber } from "@/lib/utils";

type SortMode = "price_hour" | "price_angler" | "name";

type BandFilter = "all" | "low" | "typical" | "high" | "unknown";

function bandVariant(band: string): "success" | "warning" | "destructive" | "outline" {
  if (band === "low") return "success";
  if (band === "typical") return "warning";
  if (band === "high") return "destructive";
  return "outline";
}

export function ChartersRoute() {
  const charters = useDataFile("charters.json", chartersEnvelopeSchema);
  const { shortlistSet, toggleShortlist } = useOpsShortlist();

  const [sortMode, setSortMode] = useState<SortMode>("price_hour");
  const [bandFilter, setBandFilter] = useState<BandFilter>("all");
  const [copied, setCopied] = useState(false);

  const sortedEntries = useMemo(() => {
    const entries = charters.data?.data.entries ?? [];
    const filtered = entries.filter((entry) => (bandFilter === "all" ? true : entry.price_band === bandFilter));

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "price_hour") {
        const av = a.normalized.price_per_hour_usd ?? Number.POSITIVE_INFINITY;
        const bv = b.normalized.price_per_hour_usd ?? Number.POSITIVE_INFINITY;
        return av - bv;
      }
      const av = a.normalized.price_per_angler_usd ?? Number.POSITIVE_INFINITY;
      const bv = b.normalized.price_per_angler_usd ?? Number.POSITIVE_INFINITY;
      return av - bv;
    });
  }, [charters.data, sortMode, bandFilter]);

  const selectedForTemplate = sortedEntries.find((entry) => shortlistSet.has(entry.id)) ?? sortedEntries[0];

  const quoteTemplate = selectedForTemplate
    ? `Hi ${selectedForTemplate.name} team,\n\nI'm planning a marlin-focused trip in Cabo for March 21-22, 2026 (${selectedForTemplate.typical_trip_hours}-hour trip target). Please share availability, all-in pricing, what's included (licenses, bait, tackle), and your recent marlin results.\n\nCrew size: up to ${selectedForTemplate.max_people ?? "TBD"}\nPreferred launch: Cabo Marina\n\nThanks!`
    : "Select a charter to generate a template.";

  async function copyTemplate() {
    if (!selectedForTemplate) return;
    await navigator.clipboard.writeText(quoteTemplate);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (charters.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!charters.data) {
    return <p className="text-sm text-destructive">Unable to load charters. {charters.error}</p>;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Charters</h1>
        <p className="text-sm text-muted-foreground">Sort by normalized pricing and keep a personal shortlist in local storage.</p>
      </header>

      <section className="grid gap-3 rounded-lg border border-border/60 bg-card/70 p-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="price_hour">Price / hour</option>
            <option value="price_angler">Price / angler</option>
            <option value="name">Name</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Price band</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={bandFilter}
            onChange={(event) => setBandFilter(event.target.value as BandFilter)}
          >
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="typical">Typical</option>
            <option value="high">High</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.boat_length_ft ? `${entry.boat_length_ft} ft` : "Length n/a"} • {entry.max_people ?? "?"} anglers • {entry.typical_trip_hours}h typical
                    </p>
                  </div>
                  <Badge variant={bandVariant(entry.price_band)}>{entry.price_band} (approx)</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">$ / hour: {formatNumber(entry.normalized.price_per_hour_usd, 0)}</Badge>
                  <Badge variant="outline">$ / angler: {formatNumber(entry.normalized.price_per_angler_usd, 0)}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant={shortlistSet.has(entry.id) ? "secondary" : "outline"} size="sm" onClick={() => toggleShortlist(entry.id)}>
                    {shortlistSet.has(entry.id) ? "Remove shortlist" : "Add shortlist"}
                  </Button>
                  <a className="inline-flex h-9 items-center rounded-md border px-3 text-sm" href={entry.link} target="_blank" rel="noreferrer">
                    Listing
                  </a>
                  {entry.book_direct_link ? (
                    <a className="inline-flex h-9 items-center rounded-md border px-3 text-sm" href={entry.book_direct_link} target="_blank" rel="noreferrer">
                      Book direct
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Quote Request Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Prefills with the first shortlisted charter when available.</p>
            <textarea className="h-64 w-full rounded-md border border-input bg-background p-3 text-xs" value={quoteTemplate} readOnly />
            <Button onClick={copyTemplate} className="w-full" disabled={!selectedForTemplate}>
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Copy Template"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
