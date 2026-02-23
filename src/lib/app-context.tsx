import { createContext, useContext, useMemo } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useShortlist } from "@/hooks/useShortlist";

const AppContext = createContext<ReturnType<typeof useAppContextValue> | null>(null);

function useAppContextValue() {
  const settingsApi = useAppSettings();
  const shortlistApi = useShortlist();

  return useMemo(
    () => ({
      settings: settingsApi.settings,
      updateSettings: settingsApi.update,
      resetSettings: settingsApi.reset,
      shortlist: shortlistApi.shortlist,
      shortlistSet: shortlistApi.shortlistSet,
      toggleShortlist: shortlistApi.toggle,
    }),
    [settingsApi, shortlistApi],
  );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const value = useAppContextValue();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("App context is only available inside AppProvider");
  }
  return context;
}

export function useOpsSettings() {
  const { settings, updateSettings, resetSettings } = useAppContext();
  return { settings, updateSettings, resetSettings };
}

export function useOpsShortlist() {
  const { shortlist, shortlistSet, toggleShortlist } = useAppContext();
  return { shortlist, shortlistSet, toggleShortlist };
}
