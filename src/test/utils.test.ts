import { describe, expect, it } from "vitest";
import { formatCompassBearing, normalizeBearing } from "@/lib/utils";

describe("bearing helpers", () => {
  it("normalizes raw bearings into 0-359 range", () => {
    expect(normalizeBearing(370)).toBe(10);
    expect(normalizeBearing(-45)).toBe(315);
  });

  it("formats bearings as compass labels", () => {
    expect(formatCompassBearing(0)).toBe("N");
    expect(formatCompassBearing(90)).toBe("E");
    expect(formatCompassBearing(225)).toBe("SW");
    expect(formatCompassBearing(359)).toBe("N");
  });
});
