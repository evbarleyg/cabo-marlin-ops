import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { AppProvider } from "@/lib/app-context";

const conditionsFixture = {
  generated_at: "2026-02-23T12:00:00.000Z",
  sources: [
    {
      name: "Open-Meteo Marine",
      url: "https://marine-api.open-meteo.com/v1/marine",
      fetched_at: "2026-02-23T12:00:00.000Z",
      ok: true,
    },
  ],
  data: {
    location: { name: "Cabo", latitude: 22.879, longitude: -109.892, timezone: "America/Mazatlan" },
    trip: { start: "2026-03-20", end: "2026-03-23", fishing_days: ["2026-03-21", "2026-03-22"] },
    hourly: [],
    day_summaries: [
      {
        date: "2026-03-20",
        wave_height_median: 1.4,
        wave_height_p90: 1.6,
        sst_f_median: 78,
        current_velocity_median: 0.8,
        go_no_go_score: 100,
        go_no_go_label: "Go",
        rule_inputs: {
          wave_height_p90_m: 1.6,
          swell_period_median_s: 10,
          current_velocity_median_m_s: 0.8,
          sst_median_f: 78,
        },
      },
    ],
  },
};

const biteFixture = {
  generated_at: "2026-02-23T12:00:00.000Z",
  sources: [],
  data: {
    reports: [],
    parse_failures: [],
    metrics: {
      marlin_mentions_last_72h: 0,
      trend_last_72h: [],
      daily_marlin_counts: [],
      season_context: {
        sample_days: 0,
        sample_start: "2026-02-23",
        sample_end: "2026-02-23",
        latest_report_date: "2026-02-23",
        latest_day_total_reports: 0,
        latest_day_marlin_mentions: 0,
        latest_day_percentile: 0,
        average_daily_marlin_mentions: 0,
        p90_daily_marlin_mentions: 0,
        latest_vs_average_ratio: 0,
      },
    },
  },
};

const chartersFixture = {
  generated_at: "2026-02-23T12:00:00.000Z",
  sources: [],
  data: {
    entries: [],
    price_band_constants: {
      low_max_usd_per_hour: 120,
      high_min_usd_per_hour: 190,
    },
  },
};

describe("app smoke", () => {
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

  it("renders dashboard route with loaded data", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppProvider>
          <App />
        </AppProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Trip Dashboard")).toBeInTheDocument();
    });
    expect(screen.getByText("My Shortlist")).toBeInTheDocument();
  });

  it("renders how-to front page", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppProvider>
          <App />
        </AppProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("How To Use Cabo Marlin Ops")).toBeInTheDocument();
    });
  });
});
