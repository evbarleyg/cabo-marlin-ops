import { describe, expect, it } from "vitest";
import { extractIsoDate, extractSpecies, extractWaterTempF } from "../shared";

describe("shared parser helpers", () => {
  it("extracts multiple date formats including abbreviated month and ordinal", () => {
    expect(extractIsoDate("Posted Feb 22nd, 2026 after a good marlin day")).toBe("2026-02-22");
    expect(extractIsoDate("22 September 2025 report")).toBe("2025-09-22");
    expect(extractIsoDate("Trip date 2/19/26")).toBe("2026-02-19");
  });

  it("normalizes species aliases", () => {
    const species = extractSpecies("Great mahi-mahi, yellowfin and marlin action.");
    expect(species).toContain("mahi mahi");
    expect(species).toContain("yellowfin tuna");
    expect(species).toContain("marlin");
  });

  it("extracts water temperature in celsius and converts to fahrenheit", () => {
    expect(extractWaterTempF("Water temperature held near 25 C most of the day")).toBe(77);
  });
});
