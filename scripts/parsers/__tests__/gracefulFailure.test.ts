import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseElBudsterReport } from "../elBudster";

describe("parser graceful failure", () => {
  it("returns parse failure with snippet and link on broken HTML", () => {
    const html = readFileSync(resolve("scripts/parsers/fixtures/broken.html"), "utf8");
    const result = parseElBudsterReport(html, "https://www.elbudster.com/report");

    expect(result.reports).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].snippet.length).toBeGreaterThan(0);
    expect(result.failures[0].link).toContain("elbudster.com");
  });
});
