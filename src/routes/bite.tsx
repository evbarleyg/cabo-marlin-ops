import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { computeBiteScore } from "@/lib/heuristics";
import { biteReportsEnvelopeSchema, conditionsEnvelopeSchema } from "@/lib/schemas";
import { formatDate } from "@/lib/utils";

export function BiteRoute() {
  const bite = useDataFile("biteReports.json", biteReportsEnvelopeSchema);
  const conditions = useDataFile("conditions.json", conditionsEnvelopeSchema);

  const biteScore = useMemo(() => {
    if (!bite.data || !conditions.data) return null;

    const latestDay = conditions.data.data.day_summaries[0];
    if (!latestDay) return null;

    return computeBiteScore({
      marlinMentionsLast72h: bite.data.data.metrics.marlin_mentions_last_72h,
      sstF: latestDay.sst_f_median,
      waveHeightM: latestDay.wave_height_median,
      currentVelocityMS: latestDay.current_velocity_median,
    });
  }, [bite.data, conditions.data]);

  if (bite.loading || conditions.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!bite.data) {
    return <p className="text-sm text-destructive">Unable to load bite report data. {bite.error}</p>;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Bite Reports</h1>
        <p className="text-sm text-muted-foreground">Normalized report timeline and marlin-weighted bite heuristic.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marlin Mentions Last 72h</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bite.data.data.metrics.trend_last_72h}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="bucket_ts"
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 12 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(value) => new Date(value as string).toLocaleString()} />
                <Bar dataKey="mentions" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bite Score (0-100)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-semibold">{biteScore?.score ?? "N/A"}</p>
            {biteScore ? (
              <div className="space-y-2 text-sm">
                <p>Marlin signal: {Math.round(biteScore.breakdown.marlinSignal)} (60%)</p>
                <p>SST alignment: {Math.round(biteScore.breakdown.sstAlignment)} (15%)</p>
                <p>Wave comfort: {Math.round(biteScore.breakdown.waveComfort)} (15%)</p>
                <p>Current alignment: {Math.round(biteScore.breakdown.currentAlignment)} (10%)</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough data to calculate score.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bite.data.data.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No normalized reports available yet.</p>
          ) : (
            bite.data.data.reports.map((report) => (
              <article key={`${report.source}-${report.link}-${report.date}`} className="rounded-md border border-border/50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{report.source}</Badge>
                  <span className="text-muted-foreground">{formatDate(report.date)}</span>
                  <a className="text-primary underline-offset-2 hover:underline" href={report.link} target="_blank" rel="noreferrer">
                    Source
                  </a>
                </div>
                <p className="mt-2 leading-relaxed">{report.notes}</p>
                <p className="mt-2 text-xs text-muted-foreground">Species: {report.species.join(", ") || "Unknown"}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      {bite.data.data.parse_failures.length > 0 ? (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-base">Parser Warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {bite.data.data.parse_failures.map((failure) => (
              <div key={`${failure.source}-${failure.link}`} className="rounded border border-border/40 p-2">
                <p className="font-medium">{failure.source}</p>
                <p className="text-muted-foreground">{failure.error}</p>
                <p className="line-clamp-2">{failure.snippet}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
