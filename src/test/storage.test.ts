import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, loadShortlist, saveSettings, saveShortlist } from "@/lib/storage";

describe("storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists and reads shortlist values", () => {
    saveShortlist(["boat-1", "boat-2"]);
    expect(loadShortlist()).toEqual(["boat-1", "boat-2"]);
  });

  it("falls back to defaults for missing settings", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and reads settings", () => {
    saveSettings({ ...DEFAULT_SETTINGS, latitude: 10.2, theme: "light" });
    expect(loadSettings().latitude).toBe(10.2);
    expect(loadSettings().theme).toBe("light");
  });
});
