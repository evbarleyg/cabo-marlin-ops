import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseElBudsterReport } from "../elBudster";

describe("parseElBudsterReport", () => {
  it("parses reports with species/date/notes/link", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/elbudster-happy.html"), "utf8");
    const result = parseElBudsterReport(html, "https://www.elbudster.com/report");

    expect(result.failures).toHaveLength(0);
    expect(result.reports.length).toBeGreaterThanOrEqual(2);

    const feb21 = result.reports.find((report) => report.date === "2026-02-21");
    expect(feb21).toBeDefined();
    expect(feb21?.species.join(" ")).toContain("marlin");
    expect(feb21?.link).toContain("elbudster.com");
  });
});
