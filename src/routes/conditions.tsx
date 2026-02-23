import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip } from "react-leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFile } from "@/hooks/useDataFile";
import { useOpsSettings } from "@/lib/app-context";
import { TRIP_WINDOW } from "@/lib/constants";
import { conditionsEnvelopeSchema } from "@/lib/schemas";
import { formatDate, formatNumber } from "@/lib/utils";

export function ConditionsRoute() {
  const { settings } = useOpsSettings();
  const conditions = useDataFile("conditions.json", conditionsEnvelopeSchema);

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
    <div className="space-y-4 pb-20 md:pb-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Conditions</h1>
        <p className="text-sm text-muted-foreground">Trip-focused marine forecast with a transparent go/no-go heuristic.</p>
      </header>

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
            variant={date === (selectedSummary?.date ?? focusedDates[0]) ? "default" : "outline"}
            onClick={() => setActiveDate(date)}
          >
            {formatDate(date)}
          </Button>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wave + Swell</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
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
                  formatter={(value) =>
                    typeof value === "number" ? formatNumber(value) : "N/A"
                  }
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
          <CardContent className="h-80">
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
                  formatter={(value) =>
                    typeof value === "number" ? formatNumber(value) : "N/A"
                  }
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Coordinates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 overflow-hidden rounded-lg border border-border/50">
            <MapContainer center={[settings.latitude, settings.longitude]} zoom={10} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker center={[settings.latitude, settings.longitude]} pathOptions={{ color: "#22d3ee" }} radius={8}>
                <LeafletTooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                  Cabo base
                </LeafletTooltip>
              </CircleMarker>
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
