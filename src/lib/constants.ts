export const REPO_BASE = "/cabo-marlin-ops/";

export const TRIP_WINDOW = {
  start: "2026-03-20",
  end: "2026-03-23",
  fishingDays: ["2026-03-21", "2026-03-22"],
} as const;

export const DEFAULT_COORDINATES = {
  latitude: 22.879,
  longitude: -109.892,
  label: "Cabo Marina",
} as const;

export const PRICE_BAND_CONSTANTS = {
  lowMaxUsdPerHour: 120,
  highMinUsdPerHour: 190,
} as const;

export const SETTINGS_STORAGE_KEY = "cmo.settings.v1";
export const SHORTLIST_STORAGE_KEY = "cmo.shortlist.v1";
