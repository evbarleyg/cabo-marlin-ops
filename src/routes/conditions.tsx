import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip as LeafletTooltip } from "react-leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreenGuide } from "@/components/screen-guide";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { useOpsSettings } from "@/lib/app-context";
import { TRIP_WINDOW } from "@/lib/constants";
import { biteReportsEnvelopeSchema, conditionsEnvelopeSchema, type BiteReport } from "@/lib/schemas";
import { formatDate, formatNumber } from "@/lib/utils";

function isMarlinSignal(report: BiteReport): boolean {
  return report.species.some((species) => species.toLowerCase().includes("marlin")) || report.notes.toLowerCase().includes("marlin");
}

export function ConditionsRoute() {
  const { settings } = useOpsSettings();
  const conditions = useDataFile("conditions.json", conditionsEnvelopeSchema);
  const bite = useDataFile("biteReports.json", biteReportsEnvelopeSchema);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const [activeDate, setActiveDate] = useState<string>(TRIP_WINDOW.start);

  const focusedDates = useMemo(() => {
    const summaries = conditions.data?.data.day_summaries ?? [];
    const tripDates = [TRIP_WINDOW.start, "2026-03-21", "2026-03-22", TRIP_WINDOW.end];
    const availableTripDates = tripDates.filter((date) => summaries.some((summary) => summary.date === date));
    if (availableTripDates.length >= 2) {
      return availableTripDates;
    }
    return summaries.slice(0, 4).map((summary) => summary.date);
  }, [conditions.data]);

  const selectedSummary =
    conditions.data?.data.day_summaries.find((summary) => summary.date === activeDate) ??
    conditions.data?.data.day_summaries[0];

  const mapStatusColor =
    selectedSummary?.go_no_go_label === "Go"
      ? "#22c55e"
      : selectedSummary?.go_no_go_label === "Caution"
        ? "#f59e0b"
        : "#ef4444";

  const propensityBands = useMemo(() => {
    const bandDefs = [
      { key: "inshore", label: "Inshore 5-15 mi", maxDistance: 15, radiusMiles: 12, color: "#22c55e" },
      { key: "midshore", label: "Midshore 15-30 mi", maxDistance: 30, radiusMiles: 22, color: "#f59e0b" },
      { key: "offshore", label: "Offshore 30-45 mi", maxDistance: 45, radiusMiles: 36, color: "#ef4444" },
    ];

    const scores = new Map<string, number>(bandDefs.map((band) => [band.key, 0]));
    const counts = new Map<string, number>(bandDefs.map((band) => [band.key, 0]));
    const now = Date.now();

    for (const report of bite.data?.data.reports ?? []) {
      if (!isMarlinSignal(report)) continue;

      const reportTs = new Date(`${report.date}T12:00:00Z`).getTime();
      if (!Number.isFinite(reportTs)) continue;
      const daysAgo = (now - reportTs) / (1000 * 60 * 60 * 24);
      if (daysAgo > 160) continue;

      const recencyWeight = Math.max(0.2, 1 - daysAgo / 120);
      const distance = report.distance_offshore_miles ?? 22;
      const band = bandDefs.find((candidate) => distance <= candidate.maxDistance) ?? bandDefs[bandDefs.length - 1];

      scores.set(band.key, (scores.get(band.key) ?? 0) + recencyWeight);
      counts.set(band.key, (counts.get(band.key) ?? 0) + 1);
    }

    const maxScore = Math.max(...[...scores.values(), 1]);
    return bandDefs.map((band) => {
      const score = scores.get(band.key) ?? 0;
      const intensity = score / maxScore;
      return {
        ...band,
        score,
        mentions: counts.get(band.key) ?? 0,
        intensity,
      };
    });
  }, [bite.data]);

  if (conditions.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!conditions.data) {
    return <p className="text-sm text-destructive">Unable to load conditions data. {conditions.error}</p>;
  }

  const hourly = conditions.data.data.hourly.map((point) => {
    const wave = settings.waveUnit === "ft" && point.wave_height_m !== null ? point.wave_height_m * 3.28084 : point.wave_height_m;
    const swell =
      settings.waveUnit === "ft" && point.swell_wave_height_m !== null ? point.swell_wave_height_m * 3.28084 : point.swell_wave_height_m;
    const sst =
      settings.temperatureUnit === "c"
        ? point.sea_surface_temperature_c
        : point.sea_surface_temperature_f;
    const current =
      settings.speedUnit === "knots" && point.ocean_current_velocity_m_s !== null
        ? point.ocean_current_velocity_m_s * 1.94384
        : point.ocean_current_velocity_m_s;

    return {
      ...point,
      wave_display: wave,
      swell_display: swell,
      sst_display: sst,
      current_display: current,
    };
  });

  return (
    <div className="space-y-4 pb-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Conditions</h1>
        <p className="text-sm text-muted-foreground">Trip-focused marine forecast with a transparent go/no-go heuristic.</p>
      </header>

      <ScreenGuide text="Use the Go/Caution/No-Go banner for overall risk, then inspect wave p90, swell period, current, and SST inputs. On the map, heat rings estimate marlin propensity by offshore distance band around Cabo Marina." />

      <Card className="border-primary/30">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selectedSummary?.go_no_go_label === "Go" ? "success" : selectedSummary?.go_no_go_label === "Caution" ? "warning" : "destructive"}>
              {selectedSummary?.go_no_go_label ?? "Unknown"}
            </Badge>
            <span className="text-sm">
              Heuristic score: <strong>{selectedSummary?.go_no_go_score ?? "N/A"}</strong>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rules: Wave p90 &gt;1.8m (-20), &gt;2.4m (-40), swell median &lt;8s (-10), current median &gt;1.2m/s (-15), SST outside 72-84F (-10).
          </p>
          {selectedSummary ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Inputs: wave p90 {formatNumber(selectedSummary.rule_inputs.wave_height_p90_m)}m • swell period{" "}
              {formatNumber(selectedSummary.rule_inputs.swell_period_median_s)}s • current{" "}
              {formatNumber(selectedSummary.rule_inputs.current_velocity_median_m_s)}m/s • SST{" "}
              {formatNumber(selectedSummary.rule_inputs.sst_median_f)}F
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-4">
        {focusedDates.map((date) => (
          <Button
            key={date}
            size="sm"
            className="text-xs sm:text-sm"
            variant={date === (selectedSummary?.date ?? focusedDates[0]) ? "default" : "outline"}
            onClick={() => setActiveDate(date)}
          >
            {formatDate(date)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Coordinates + Estimated Bite Propensity Heat Overlay</CardTitle>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant={showHeatmap ? "default" : "outline"} onClick={() => setShowHeatmap((value) => !value)}>
              {showHeatmap ? "Heatmap On" : "Heatmap Off"}
            </Button>
            <span className="text-xs text-muted-foreground">Toggle estimated marlin propensity rings</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[18rem] overflow-hidden rounded-lg border border-border/50 sm:h-80">
            <MapContainer center={[settings.latitude, settings.longitude]} zoom={10} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {showHeatmap
                ? propensityBands.map((band) => (
                    <Circle
                      key={band.key}
                      center={[settings.latitude, settings.longitude]}
                      radius={band.radiusMiles * 1609.34}
                      pathOptions={{
                        color: band.color,
                        fillColor: band.color,
                        fillOpacity: 0.12 + band.intensity * 0.35,
                        weight: 1.25,
                      }}
                    />
                  ))
                : null}
              <CircleMarker
                center={[settings.latitude, settings.longitude]}
                pathOptions={{ color: mapStatusColor, fillColor: mapStatusColor, fillOpacity: 0.95 }}
                radius={10}
              >
                <LeafletTooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                  Cabo base
                </LeafletTooltip>
                <Popup>
                  <p><strong>{selectedSummary?.go_no_go_label ?? "Unknown"} conditions</strong></p>
                  <p>Wave p90: {formatNumber(selectedSummary?.rule_inputs.wave_height_p90_m)} m</p>
                  <p>Current median: {formatNumber(selectedSummary?.rule_inputs.current_velocity_median_m_s)} m/s</p>
                  <p>SST median: {formatNumber(selectedSummary?.rule_inputs.sst_median_f)} F</p>
                </Popup>
              </CircleMarker>
            </MapContainer>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {propensityBands.map((band) => (
              <div key={band.key} className="rounded-md border border-border/50 bg-background/70 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: band.color }} />
                  <span className="font-medium">{band.label}</span>
                </div>
                <p className="text-muted-foreground">
                  Heat intensity {Math.round(band.intensity * 100)}% • marlin report mentions: {band.mentions}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Heat overlay is an estimated propensity map based on recent marlin report density by offshore distance band, centered on Cabo Marina. It is not a GPS catch heatmap.
          </p>
          {bite.error ? <p className="mt-2 text-xs text-destructive">Bite overlay warning: {bite.error}</p> : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Late-March Cabo Marlin Read (Operational)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Late March in Cabo is typically shoulder-season for striped marlin consistency. You can still have good days, but reliability improves when
              bluewater edges are reachable and sea state lets boats comfortably work 15-35nm bands.
            </p>
            <p>
              Practical expectation: prioritize fishability and travel comfort first, then treat bite momentum as a tiebreaker for charter decisions.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li>Better setup: cleaner swell period, manageable combined wave height, and moderate current.</li>
              <li>Risk setup: short-period swell + elevated current + high wave p90 can quickly reduce quality hours offshore.</li>
              <li>Use the heat rings to choose offshore distance targets, not exact GPS spots.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to Interpret Wave Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Read this in order: <strong>wave p90</strong>, <strong>swell period</strong>, then <strong>current speed</strong>.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li><strong>Wave p90:</strong> your rough-water guardrail for comfort and fishability windows.</li>
              <li><strong>Swell period:</strong> shorter period means steeper/choppier motion at same height.</li>
              <li><strong>Current velocity:</strong> stronger current can make spread control and drifts harder.</li>
              <li><strong>SST:</strong> use as context, not a standalone go/no-go trigger.</li>
            </ul>
            <p className="text-xs">
              Heuristic: if wave p90 and current are both elevated, downgrade confidence even if a single metric looks acceptable.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wave + Swell</CardTitle>
          </CardHeader>
          <CardContent className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 12 }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 360]} />
                <Tooltip
                  labelFormatter={(value) => new Date(value as string).toLocaleString()}
                  formatter={(value) => (typeof value === "number" ? formatNumber(value) : "N/A")}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="wave_display" stroke="#0ea5e9" dot={false} name={`Wave (${settings.waveUnit})`} />
                <Line yAxisId="left" type="monotone" dataKey="swell_display" stroke="#10b981" dot={false} name={`Swell (${settings.waveUnit})`} />
                <Line yAxisId="left" type="monotone" dataKey="swell_wave_period_s" stroke="#f59e0b" dot={false} name="Swell period (s)" />
                <Line yAxisId="right" type="monotone" dataKey="swell_wave_direction_deg" stroke="#a855f7" dot={false} name="Swell dir (deg)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current + SST</CardTitle>
          </CardHeader>
          <CardContent className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 12 }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 360]} />
                <Tooltip
                  labelFormatter={(value) => new Date(value as string).toLocaleString()}
                  formatter={(value) => (typeof value === "number" ? formatNumber(value) : "N/A")}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="current_display" stroke="#f97316" dot={false} name={`Current (${settings.speedUnit === "mps" ? "m/s" : "kn"})`} />
                <Line yAxisId="left" type="monotone" dataKey="sst_display" stroke="#ef4444" dot={false} name={`SST (${settings.temperatureUnit.toUpperCase()})`} />
                <Line yAxisId="right" type="monotone" dataKey="ocean_current_direction_deg" stroke="#8b5cf6" dot={false} name="Current dir (deg)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
