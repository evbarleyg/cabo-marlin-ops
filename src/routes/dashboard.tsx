import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DayToggle } from "@/components/day-toggle";
import { MetricCard } from "@/components/metric-card";
import { ScreenGuide } from "@/components/screen-guide";
import { SourceStatusList } from "@/components/source-status-list";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { useOpsShortlist } from "@/lib/app-context";
import { getDashboardDayOptions } from "@/lib/day-options";
import { biteReportsEnvelopeSchema, chartersEnvelopeSchema, conditionsEnvelopeSchema } from "@/lib/schemas";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export function DashboardRoute() {
  const conditions = useDataFile("conditions.json", conditionsEnvelopeSchema);
  const bite = useDataFile("biteReports.json", biteReportsEnvelopeSchema);
  const charters = useDataFile("charters.json", chartersEnvelopeSchema);
  const { shortlistSet } = useOpsShortlist();

  const dayOptions = useMemo(() => getDashboardDayOptions(), []);
  const [activeDay, setActiveDay] = useState(dayOptions[0]?.key ?? "today");
  const [historyWindow, setHistoryWindow] = useState<"30" | "90" | "180">("90");
  const selectedDate = dayOptions.find((item) => item.key === activeDay)?.date;

  const selectedSummary = useMemo(() => {
    const summaries = conditions.data?.data.day_summaries ?? [];
    if (!summaries.length) return null;
    return summaries.find((summary) => summary.date === selectedDate) ?? summaries[0];
  }, [conditions.data, selectedDate]);

  const shortlistItems = useMemo(() => {
    const entries = charters.data?.data.entries ?? [];
    return entries.filter((entry) => shortlistSet.has(entry.id));
  }, [charters.data, shortlistSet]);

  const seasonContext = bite.data?.data.metrics.season_context;
  const dailyCounts = bite.data?.data.metrics.daily_marlin_counts ?? [];

  const historicalBiteData = useMemo(() => {
    const days = Number(historyWindow);
    const cutoff = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return dailyCounts.filter((point) => point.date >= cutoff);
  }, [dailyCounts, historyWindow]);

  const opportunity = useMemo(() => {
    if (!selectedSummary || !seasonContext) return null;
    const combined = selectedSummary.go_no_go_score * 0.55 + seasonContext.latest_day_percentile * 0.45;
    const rounded = Math.round(combined);
    const label = rounded >= 70 ? "Strong setup" : rounded >= 50 ? "Mixed setup" : "Weak setup";
    return { score: rounded, label };
  }, [selectedSummary, seasonContext]);

  if (conditions.loading || bite.loading || charters.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasError = conditions.error || bite.error || charters.error;

  return (
    <div className="space-y-4 pb-4">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Trip Dashboard</h1>
        <p className="text-sm text-muted-foreground">Fast snapshot for sea state, bite signal, seasonal context, and shortlist readiness.</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
            View how-to front page
          </Link>
          <Link to="/conditions" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-fit")}>
            Open conditions heatmap
          </Link>
        </div>
        <DayToggle options={dayOptions} activeKey={activeDay} onChange={setActiveDay} />
      </section>

      <ScreenGuide text="Start with Conditions Summary, then compare Season Position and Marlin Mentions (72h). The combined posture card blends sea-state readiness with seasonal bite context for a quick go/no-go posture." />

      {hasError ? (
        <Card className="border-destructive/60">
          <CardContent className="pt-5 text-sm text-destructive">
            Partial data load issue. {conditions.error ?? bite.error ?? charters.error}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Conditions Summary"
          value={selectedSummary ? `${formatNumber(selectedSummary.wave_height_median)} m waves` : "N/A"}
          subtitle={selectedSummary ? `${formatDate(selectedSummary.date)} • ${selectedSummary.go_no_go_label}` : "No summary"}
        />
        <MetricCard
          title="Marlin Mentions (72h)"
          value={`${bite.data?.data.metrics.marlin_mentions_last_72h ?? 0}`}
          subtitle="Higher count means stronger recent signal"
        />
        <MetricCard
          title="Season Position"
          value={seasonContext ? `${Math.round(seasonContext.latest_day_percentile)}th pct` : "N/A"}
          subtitle={
            seasonContext
              ? `${seasonContext.latest_day_marlin_mentions} marlin mentions vs avg ${formatNumber(
                  seasonContext.average_daily_marlin_mentions,
                  1,
                )}`
              : "Need more seasonal samples"
          }
        />
        <MetricCard
          title="My Shortlist"
          value={`${shortlistItems.length}`}
          subtitle={shortlistItems.length ? shortlistItems.slice(0, 2).map((item) => item.name).join(" • ") : "No charters selected"}
        />
      </section>

      {opportunity ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Conditions x Seasonal Bite Posture</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Combined posture score: <strong className="text-foreground">{opportunity.score}</strong> ({opportunity.label}).
            This blends today&apos;s sea-state readiness with where the latest bite sits in seasonal context.
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bites Over Time</CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: historyWindow === "30" ? "default" : "outline", size: "sm" }))}
                onClick={() => setHistoryWindow("30")}
              >
                30D
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: historyWindow === "90" ? "default" : "outline", size: "sm" }))}
                onClick={() => setHistoryWindow("90")}
              >
                90D
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: historyWindow === "180" ? "default" : "outline", size: "sm" }))}
                onClick={() => setHistoryWindow("180")}
              >
                180D
              </button>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalBiteData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 12 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleString("en-US", { month: "short", day: "numeric" })
                  }
                />
                <Line type="monotone" dataKey="marlin_mentions" stroke="#22d3ee" dot={false} name="Marlin mentions/day" />
                <Line type="monotone" dataKey="total_reports" stroke="#94a3b8" dot={false} name="Total reports/day" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {conditions.data ? (
          <SourceStatusList
            generatedAt={conditions.data.generated_at}
            sources={[
              ...conditions.data.sources,
              ...(bite.data?.sources ?? []),
              ...(charters.data?.sources ?? []),
            ]}
          />
        ) : null}
      </section>
    </div>
  );
}
