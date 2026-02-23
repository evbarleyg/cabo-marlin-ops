import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFishingBookerReports } from "../fishingBooker";

describe("parseFishingBookerReports", () => {
  it("parses normalized records from listing cards", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/fishingbooker-happy.html"), "utf8");
    const result = parseFishingBookerReports(
      html,
      "https://fishingbooker.com/reports/destination/mx/BS/cabo-san-lucas?page=1",
    );

    expect(result.failures).toHaveLength(0);
    expect(result.reports).toHaveLength(2);
    expect(result.reports[0].species.join(" ")).toContain("marlin");
    expect(result.reports[1].distance_offshore_miles).toBe(26);
  });

  it("gracefully handles missing dates and still emits partial report", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/missing-fields.html"), "utf8");
    const result = parseFishingBookerReports(html, "https://fishingbooker.com/reports/foo");

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.failures).toHaveLength(0);
  });

  it("parses report feed cards with heading metadata", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/fishingbooker-report-feed.html"), "utf8");
    const result = parseFishingBookerReports(
      html,
      "https://fishingbooker.com/reports/destination/mx/BS/cabo-san-lucas?page=2",
    );

    expect(result.reports.length).toBeGreaterThanOrEqual(2);
    expect(result.reports.some((report) => report.date === "2026-02-21")).toBe(true);
    expect(result.reports.some((report) => report.species.includes("striped marlin"))).toBe(true);
  });

  it("falls back to JSON-LD entries when cards are unavailable", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/fishingbooker-jsonld.html"), "utf8");
    const result = parseFishingBookerReports(html, "https://fishingbooker.com/reports/destination/mx/BS/cabo-san-lucas?page=1");

    expect(result.failures).toHaveLength(0);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].date).toBe("2026-02-20");
    expect(result.reports[0].link).toContain("/reports/trips/marlin-and-dorado");
  });
});
