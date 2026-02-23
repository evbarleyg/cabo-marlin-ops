import { useEffect, useState } from "react";
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/storage";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings]);

  const update = (partial: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...partial }));
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    update,
    reset,
  };
}
