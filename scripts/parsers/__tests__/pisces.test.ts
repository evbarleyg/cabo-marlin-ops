import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePiscesReports } from "../pisces";

describe("parsePiscesReports", () => {
  it("parses blog-style weekly report entries", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/pisces-happy.html"), "utf8");
    const result = parsePiscesReports(html, "https://www.piscessportfishing.com/fishing-reports/");

    expect(result.failures).toHaveLength(0);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].species).toContain("striped marlin");
    expect(result.reports[0].distance_offshore_miles).toBe(24);
    expect(result.reports[0].water_temp_f).toBe(77);
  });

  it("parses JSON feed entries from the Pisces blog endpoint", () => {
    const json = readFileSync(resolve("scripts/parsers/fixtures/pisces-feed-happy.json"), "utf8");
    const result = parsePiscesReports(json, "https://blog.piscessportfishing.com/feed/json/?paged=1");

    expect(result.failures).toHaveLength(0);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].date).toBe("2025-11-07");
    expect(result.reports[0].species).toContain("striped marlin");
    expect(result.reports[0].species).toContain("dorado");
    expect(result.reports[0].distance_offshore_miles).toBe(21);
    expect(result.reports[0].water_temp_f).toBe(77);
    expect(result.reports[0].link).toContain("striped-marlin-strong-week");
  });
});
