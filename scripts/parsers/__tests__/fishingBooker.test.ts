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
});
