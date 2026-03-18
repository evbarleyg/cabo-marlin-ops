import { describe, expect, it } from "vitest";
import { summarizeMarlinConditions } from "@/lib/heuristics";

describe("summarizeMarlinConditions", () => {
  it("marks an ideal trip-day style setup as favorable", () => {
    const result = summarizeMarlinConditions({
      waveHeightP90M: 1.06,
      swellPeriodMedianS: 10.2,
      currentVelocityMedianMS: 0.9,
      sstFMedian: 75.1,
    });

    expect(result.overall).toBe("Favorable");
    expect(result.details.every((detail) => detail.status !== "weak")).toBe(true);
  });

  it("flags multiple off-band variables as marginal", () => {
    const result = summarizeMarlinConditions({
      waveHeightP90M: 2.3,
      swellPeriodMedianS: 7.1,
      currentVelocityMedianMS: 1.35,
      sstFMedian: 69.5,
    });

    expect(result.overall).toBe("Marginal");
    expect(result.details.filter((detail) => detail.status === "weak").length).toBeGreaterThanOrEqual(2);
  });
});
