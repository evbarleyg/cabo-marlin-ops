import { describe, expect, it } from "vitest";
import {
  buildSpeciesHeatLayers,
  collectSpeciesLayerOptions,
  seasonFromDate,
  type SpeciesLayerOption,
} from "@/lib/shoreline-heatmap";
import type { BiteReport } from "@/lib/schemas";

const SAMPLE_REPORTS: BiteReport[] = [
  {
    source: "Test",
    date: "2025-03-10",
    species: ["striped marlin", "dorado"],
    notes: "Good striped marlin action near Gordo Banks.",
    distance_offshore_miles: 8,
    link: "https://example.com/reports/1",
  },
  {
    source: "Test",
    date: "2024-04-14",
    species: ["striped marlin"],
    notes: "Two marlin releases offshore at Golden Gate.",
    distance_offshore_miles: 24,
    link: "https://example.com/reports/2",
  },
  {
    source: "Test",
    date: "2024-07-22",
    species: ["yellowfin tuna"],
    notes: "Strong tuna bite along the corridor.",
    distance_offshore_miles: 18,
    link: "https://example.com/reports/3",
  },
];

describe("shoreline heatmap helpers", () => {
  it("maps dates to seasons", () => {
    expect(seasonFromDate("2026-01-05")).toBe("winter");
    expect(seasonFromDate("2026-04-05")).toBe("spring");
    expect(seasonFromDate("2026-07-05")).toBe("summer");
    expect(seasonFromDate("2026-10-05")).toBe("fall");
  });

  it("collects top species options", () => {
    const options = collectSpeciesLayerOptions(SAMPLE_REPORTS, 4);
    expect(options.map((option) => option.species)).toContain("striped marlin");
    expect(options.map((option) => option.species)).toContain("yellowfin tuna");
  });

  it("builds species layers with shoreline band counts", () => {
    const selectedSpecies: SpeciesLayerOption[] = [{ species: "striped marlin", count: 2, color: "#06b6d4" }];
    const layers = buildSpeciesHeatLayers({
      reports: SAMPLE_REPORTS,
      season: "spring",
      selectedSpecies,
    });

    expect(layers).toHaveLength(1);
    expect(layers[0].totalReports).toBe(2);
    expect(layers[0].rangedReports).toBe(2);

    const nearshore = layers[0].bands.find((band) => band.key === "nearshore");
    const offshore = layers[0].bands.find((band) => band.key === "offshore");
    expect(nearshore?.reportCount).toBe(1);
    expect(offshore?.reportCount).toBe(1);
    expect(layers[0].cells.length).toBeGreaterThan(0);
  });

  it("produces different cell footprints for different species zones", () => {
    const selectedSpecies: SpeciesLayerOption[] = [
      { species: "striped marlin", count: 2, color: "#06b6d4" },
      { species: "yellowfin tuna", count: 1, color: "#22c55e" },
    ];

    const layers = buildSpeciesHeatLayers({
      reports: SAMPLE_REPORTS,
      season: "all",
      selectedSpecies,
    });

    expect(layers).toHaveLength(2);
    expect(layers[0].cells.length).toBeGreaterThan(0);
    expect(layers[1].cells.length).toBeGreaterThan(0);

    const marlinMeanLng = layers[0].cells.reduce((sum, cell) => sum + cell.lng, 0) / layers[0].cells.length;
    const tunaMeanLng = layers[1].cells.reduce((sum, cell) => sum + cell.lng, 0) / layers[1].cells.length;
    expect(Math.abs(marlinMeanLng - tunaMeanLng)).toBeGreaterThan(0.01);
  });
});
