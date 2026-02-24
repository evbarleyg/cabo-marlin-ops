import { useMemo, useState } from "react";
import { Copy, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreenGuide } from "@/components/screen-guide";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { useOpsShortlist } from "@/lib/app-context";
import { biteReportsEnvelopeSchema, chartersEnvelopeSchema, type BiteReport } from "@/lib/schemas";
import { formatNumber, toTitleCase } from "@/lib/utils";

type SortMode = "price_hour" | "price_angler" | "name" | "max_people" | "boat_length";

type BandFilter = "all" | "low" | "typical" | "high" | "unknown";

interface OutreachContact {
  name: string;
  totalReports: number;
  marlinReports: number;
  latestDate: string;
  sampleLink: string;
}

function bandVariant(band: string): "success" | "warning" | "destructive" | "outline" {
  if (band === "low") return "success";
  if (band === "typical") return "warning";
  if (band === "high") return "destructive";
  return "outline";
}

function isMarlinSignal(report: BiteReport): boolean {
  return report.species.some((species) => species.toLowerCase().includes("marlin")) || report.notes.toLowerCase().includes("marlin");
}

function extractOutreachName(report: BiteReport): string | null {
  const note = report.notes;
  const patterns = [
    /fishing on the\s+([^,.]+?)(?:\.|,|\s{2,}|$)/i,
    /^\s*([^\n.!?]{3,60}?)\s+fishing report\b/i,
    /^\s*([^\n.!?]{3,60}?)\s+sportfishing\b/i,
    /^\s*([^\n.!?]{3,60}?)\s+book now\b/i,
  ];

  for (const pattern of patterns) {
    const match = note.match(pattern);
    if (!match?.[1]) continue;
    const normalized = normalizeOutreachName(match[1]);
    if (normalized.length >= 3) return normalized;
  }

  return null;
}

function normalizeOutreachName(raw: string): string {
  return raw
    .replace(/[“”"'`´]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/i, "")
    .split(" ")
    .map((token) => {
      if (token.length <= 3 && token === token.toUpperCase()) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function buildTopOutreachContacts(reports: BiteReport[], limit: number): OutreachContact[] {
  const grouped = new Map<string, OutreachContact>();

  for (const report of reports) {
    const name = extractOutreachName(report);
    if (!name) continue;

    const existing = grouped.get(name) ?? {
      name,
      totalReports: 0,
      marlinReports: 0,
      latestDate: report.date,
      sampleLink: report.link,
    };

    existing.totalReports += 1;
    if (isMarlinSignal(report)) existing.marlinReports += 1;

    if (report.date >= existing.latestDate) {
      existing.latestDate = report.date;
      existing.sampleLink = report.link;
    }

    grouped.set(name, existing);
  }

  return [...grouped.values()]
    .sort((a, b) => {
      if (b.marlinReports !== a.marlinReports) return b.marlinReports - a.marlinReports;
      if (b.totalReports !== a.totalReports) return b.totalReports - a.totalReports;
      return b.latestDate.localeCompare(a.latestDate);
    })
    .slice(0, limit);
}

export function ChartersRoute() {
  const charters = useDataFile("charters.json", chartersEnvelopeSchema);
  const bite = useDataFile("biteReports.json", biteReportsEnvelopeSchema);
  const { shortlistSet, toggleShortlist } = useOpsShortlist();

  const [sortMode, setSortMode] = useState<SortMode>("price_hour");
  const [bandFilter, setBandFilter] = useState<BandFilter>("all");
  const [minPeople, setMinPeople] = useState(0);
  const [minBoatLength, setMinBoatLength] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedTop40, setCopiedTop40] = useState(false);

  const sortedEntries = useMemo(() => {
    const entries = charters.data?.data.entries ?? [];
    const filtered = entries
      .filter((entry) => (bandFilter === "all" ? true : entry.price_band === bandFilter))
      .filter((entry) => (minPeople > 0 ? (entry.max_people ?? 0) >= minPeople : true))
      .filter((entry) => (minBoatLength > 0 ? (entry.boat_length_ft ?? 0) >= minBoatLength : true));

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "max_people") return (b.max_people ?? 0) - (a.max_people ?? 0);
      if (sortMode === "boat_length") return (b.boat_length_ft ?? 0) - (a.boat_length_ft ?? 0);
      if (sortMode === "price_hour") {
        const av = a.normalized.price_per_hour_usd ?? Number.POSITIVE_INFINITY;
        const bv = b.normalized.price_per_hour_usd ?? Number.POSITIVE_INFINITY;
        return av - bv;
      }
      const av = a.normalized.price_per_angler_usd ?? Number.POSITIVE_INFINITY;
      const bv = b.normalized.price_per_angler_usd ?? Number.POSITIVE_INFINITY;
      return av - bv;
    });
  }, [charters.data, sortMode, bandFilter, minPeople, minBoatLength]);

  const selectedForTemplate = sortedEntries.find((entry) => shortlistSet.has(entry.id)) ?? sortedEntries[0];

  const quoteTemplate = selectedForTemplate
    ? `Hi ${selectedForTemplate.name} team,\n\nI'm planning a marlin-focused trip in Cabo for March 21-22, 2026 (${selectedForTemplate.typical_trip_hours}-hour trip target). Please share availability, all-in pricing, what's included (licenses, bait, tackle), and your recent marlin results.\n\nCrew size: up to ${selectedForTemplate.max_people ?? "TBD"}\nPreferred launch: Cabo Marina\n\nThanks!`
    : "Select a charter to generate a template.";

  const topOutreachContacts = useMemo(() => buildTopOutreachContacts(bite.data?.data.reports ?? [], 40), [bite.data]);

  const top40OutreachText = useMemo(() => {
    if (topOutreachContacts.length === 0) {
      return "No outreach contacts available from parsed reports yet.";
    }

    const header =
      "Subject: Cabo Marlin Trip Inquiry (March 21-22, 2026)\n\n" +
      "Hi team,\n\n" +
      "I am planning a marlin-focused trip in Cabo for March 21-22, 2026. Please share availability, all-in pricing, what is included, and your recent marlin results.\n\n" +
      "Top 40 outreach targets (ranked by marlin-report activity):\n";

    const rows = topOutreachContacts
      .map(
        (contact, index) =>
          `${index + 1}. ${contact.name} | marlin reports: ${contact.marlinReports} | total reports: ${contact.totalReports} | latest: ${contact.latestDate} | ${contact.sampleLink}`,
      )
      .join("\n");

    const footer =
      "\n\nNote: Parsed report sources do not expose email addresses directly, so this list is outreach-ready context + links for manual/contact-form follow-up.";

    return `${header}${rows}${footer}`;
  }, [topOutreachContacts]);

  async function copyTemplate() {
    if (!selectedForTemplate) return;
    await navigator.clipboard.writeText(quoteTemplate);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyTop40Outreach() {
    if (topOutreachContacts.length === 0) return;
    await navigator.clipboard.writeText(top40OutreachText);
    setCopiedTop40(true);
    window.setTimeout(() => setCopiedTop40(false), 1800);
  }

  function composeTop40Draft() {
    if (topOutreachContacts.length === 0) return;
    const subject = encodeURIComponent("Cabo Marlin Trip Inquiry (March 21-22, 2026)");
    const body = encodeURIComponent(top40OutreachText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
    <div className="space-y-4 pb-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Charters</h1>
        <p className="text-sm text-muted-foreground">Sort by normalized pricing and keep a personal shortlist in local storage.</p>
      </header>

      <ScreenGuide text="Sort by $/hour or $/angler to compare value consistently. Use price bands as rough guides, shortlist likely options, then copy the quote template to standardize outreach." />

      <section className="grid gap-3 rounded-lg border border-border/60 bg-card/70 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="price_hour">Price / hour</option>
            <option value="price_angler">Price / angler</option>
            <option value="max_people">Max people</option>
            <option value="boat_length">Boat length</option>
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

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Min anglers</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={minPeople}
            onChange={(event) => setMinPeople(Number(event.target.value))}
          >
            <option value={0}>Any</option>
            <option value={4}>4+</option>
            <option value={6}>6+</option>
            <option value={8}>8+</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Min boat length (ft)</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3"
            value={minBoatLength}
            onChange={(event) => setMinBoatLength(Number(event.target.value))}
          >
            <option value={0}>Any</option>
            <option value={28}>28+</option>
            <option value={32}>32+</option>
            <option value={36}>36+</option>
            <option value={40}>40+</option>
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
                  <Badge variant="outline">Max people: {entry.max_people ?? "N/A"}</Badge>
                  <Badge variant="outline">Boat: {entry.boat_length_ft ? `${entry.boat_length_ft} ft` : "N/A"}</Badge>
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

        <div className="space-y-4">
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

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Top 40 Outreach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Ranked from bite-report history using marlin activity first, then total report activity. Showing {topOutreachContacts.length} contacts.
              </p>
              <textarea className="h-56 w-full rounded-md border border-input bg-background p-3 text-xs" value={top40OutreachText} readOnly />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={copyTop40Outreach} variant="outline" disabled={topOutreachContacts.length === 0}>
                  <Copy className="h-4 w-4" aria-hidden />
                  {copiedTop40 ? "Copied" : "Copy Top 40"}
                </Button>
                <Button onClick={composeTop40Draft} disabled={topOutreachContacts.length === 0}>
                  <Mail className="h-4 w-4" aria-hidden />
                  Compose Email
                </Button>
              </div>
              {topOutreachContacts.length > 0 ? (
                <div className="rounded-md border border-border/50 p-2 text-xs">
                  <p className="font-medium">Top contacts preview</p>
                  {topOutreachContacts.slice(0, 8).map((contact, index) => (
                    <p key={contact.name} className="text-muted-foreground">
                      {index + 1}. {toTitleCase(contact.name)} • marlin {contact.marlinReports} • total {contact.totalReports}
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Parsed sources do not expose direct email addresses, so this generates outreach-ready ranked contacts and a draft for manual send or mail-merge.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
