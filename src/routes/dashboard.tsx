import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { DayToggle } from "@/components/day-toggle";
import { MetricCard } from "@/components/metric-card";
import { SourceStatusList } from "@/components/source-status-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { useOpsShortlist } from "@/lib/app-context";
import { getDashboardDayOptions } from "@/lib/day-options";
import { biteReportsEnvelopeSchema, chartersEnvelopeSchema, conditionsEnvelopeSchema } from "@/lib/schemas";
import { formatDate, formatNumber } from "@/lib/utils";

export function DashboardRoute() {
  const conditions = useDataFile("conditions.json", conditionsEnvelopeSchema);
  const bite = useDataFile("biteReports.json", biteReportsEnvelopeSchema);
  const charters = useDataFile("charters.json", chartersEnvelopeSchema);
  const { shortlistSet } = useOpsShortlist();

  const dayOptions = useMemo(() => getDashboardDayOptions(), []);
  const [activeDay, setActiveDay] = useState(dayOptions[0]?.key ?? "today");
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
    <div className="space-y-4 pb-20 md:pb-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Trip Dashboard</h1>
        <p className="text-sm text-muted-foreground">Fast snapshot for sea state, bite signal, and shortlist readiness.</p>
        <DayToggle options={dayOptions} activeKey={activeDay} onChange={setActiveDay} />
      </section>

      {hasError ? (
        <Card className="border-destructive/60">
          <CardContent className="pt-5 text-sm text-destructive">
            Partial data load issue. {conditions.error ?? bite.error ?? charters.error}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
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
          title="My Shortlist"
          value={`${shortlistItems.length}`}
          subtitle={shortlistItems.length ? shortlistItems.slice(0, 2).map((item) => item.name).join(" • ") : "No charters selected"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bite Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bite.data?.data.metrics.trend_last_72h ?? []}>
                <defs>
                  <linearGradient id="marlinMentions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.65} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="bucket_ts"
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })
                  }
                />
                <Area type="monotone" dataKey="mentions" stroke="#22d3ee" fill="url(#marlinMentions)" />
              </AreaChart>
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
