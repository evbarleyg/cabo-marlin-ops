import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { AppProvider } from "@/lib/app-context";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="leaflet-map">
      {children}
    </div>
  ),
  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const conditionsFixture = {
  generated_at: "2026-03-18T05:06:13.324Z",
  sources: [
    {
      name: "Open-Meteo Marine",
      url: "https://marine-api.open-meteo.com/v1/marine",
      fetched_at: "2026-03-18T05:06:13.324Z",
      ok: true,
    },
  ],
  data: {
    location: { name: "Cabo", latitude: 22.879, longitude: -109.892, timezone: "America/Mazatlan" },
    trip: { start: "2026-03-20", end: "2026-03-23", fishing_days: ["2026-03-21", "2026-03-22"] },
    hourly: [],
    day_summaries: [
      {
        date: "2026-03-21",
        wave_height_median: 0.99,
        wave_height_p90: 1.06,
        sst_f_median: 74.39,
        current_velocity_median: 1.15,
        go_no_go_score: 100,
        go_no_go_label: "Go",
        rule_inputs: {
          wave_height_p90_m: 1.06,
          swell_period_median_s: 10.65,
          current_velocity_median_m_s: 1.15,
          sst_median_f: 74.39,
        },
      },
      {
        date: "2026-03-22",
        wave_height_median: 0.98,
        wave_height_p90: 1.034,
        sst_f_median: 75.2,
        current_velocity_median: 0.9,
        go_no_go_score: 100,
        go_no_go_label: "Go",
        rule_inputs: {
          wave_height_p90_m: 1.034,
          swell_period_median_s: 10.4,
          current_velocity_median_m_s: 0.9,
          sst_median_f: 75.2,
        },
      },
    ],
  },
};

const biteFixture = {
  generated_at: "2026-03-18T05:06:13.324Z",
  sources: [],
  data: {
    reports: [
      {
        source: "FishingBooker",
        date: "2026-03-17",
        species: ["striped marlin"],
        notes: "Worked the Pacific side near Golden Gate with marlin action in 22 miles.",
        distance_offshore_miles: 22,
        water_temp_f: 75,
        link: "https://example.com/report-1",
      },
      {
        source: "Pisces",
        date: "2026-03-16",
        species: ["dorado"],
        notes: "Tourist Corridor fish in 14 miles.",
        distance_offshore_miles: 14,
        water_temp_f: 76,
        link: "https://example.com/report-2",
      },
      {
        source: "FishingBooker",
        date: "2025-12-12",
        species: ["tuna"],
        notes: "Winter sample off East Cape in 20 miles.",
        distance_offshore_miles: 20,
        water_temp_f: 72,
        link: "https://example.com/report-3",
      },
    ],
    parse_failures: [],
    metrics: {
      marlin_mentions_last_72h: 1,
      weighted_marlin_signal_last_72h: 0.75,
      trend_last_72h: [
        {
          bucket_ts: "2026-03-18T00:00:00.000Z",
          mentions: 1,
        },
      ],
      daily_marlin_counts: [
        {
          date: "2026-03-17",
          total_reports: 1,
          marlin_mentions: 1,
          weighted_marlin_signal: 0.75,
        },
      ],
      season_context: {
        sample_days: 2,
        sample_start: "2025-12-12",
        sample_end: "2026-03-17",
        latest_report_date: "2026-03-17",
        latest_day_total_reports: 1,
        latest_day_marlin_mentions: 1,
        latest_day_percentile: 84.9,
        average_daily_marlin_mentions: 0.5,
        p90_daily_marlin_mentions: 1,
        latest_vs_average_ratio: 2,
        latest_day_weighted_signal: 0.75,
        average_daily_weighted_signal: 0.38,
      },
      source_quality: [],
    },
  },
};

const chartersFixture = {
  generated_at: "2026-03-18T05:06:13.324Z",
  sources: [],
  data: {
    entries: [],
    price_band_constants: {
      low_max_usd_per_hour: 120,
      high_min_usd_per_hour: 190,
    },
  },
};

describe("conditions route interactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("conditions.json")) {
        return new Response(JSON.stringify(conditionsFixture), { status: 200 });
      }
      if (url.includes("biteReports.json")) {
        return new Response(JSON.stringify(biteFixture), { status: 200 });
      }
      if (url.includes("charters.json")) {
        return new Response(JSON.stringify(chartersFixture), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
  });

  it("keeps route buttons interactive on the conditions screen", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/conditions"]}>
        <AppProvider>
          <App />
        </AppProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Conditions" })).toBeInTheDocument();
    });

    expect(screen.getByText(/inputs: wave p90 1\.1m/i)).toBeInTheDocument();

    expect(screen.getByText(/all year sample window: 2025-12-12 to 2026-03-17 • 3 reports\./i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Winter" }));
    expect(screen.getByText(/winter sample window: 2025-12-12 to 2025-12-12 • 1 reports\./i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /heatmap on/i }));
    expect(screen.getByRole("button", { name: /heatmap off/i })).toBeInTheDocument();
  });
});
