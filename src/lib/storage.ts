import { DEFAULT_COORDINATES, SETTINGS_STORAGE_KEY, SHORTLIST_STORAGE_KEY } from "@/lib/constants";

export type TemperatureUnit = "f" | "c";
export type WaveUnit = "m" | "ft";
export type SpeedUnit = "mps" | "knots";
export type ThemeMode = "dark" | "light";

export interface AppSettings {
  latitude: number;
  longitude: number;
  temperatureUnit: TemperatureUnit;
  waveUnit: WaveUnit;
  speedUnit: SpeedUnit;
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  latitude: DEFAULT_COORDINATES.latitude,
  longitude: DEFAULT_COORDINATES.longitude,
  temperatureUnit: "f",
  waveUnit: "m",
  speedUnit: "mps",
  theme: "dark",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadSettings(): AppSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function loadShortlist(): string[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function saveShortlist(shortlist: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(shortlist));
}
