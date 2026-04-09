import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getAppSettings, saveAppSettings } from "./settingsService";

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => getAppSettings());

  const updateSettings = useCallback((updater) => {
    setSettings((current) => {
      const nextSettings =
        typeof updater === "function"
          ? updater(current)
          : {
              ...current,
              ...updater,
              services: {
                ...current.services,
                ...(updater.services || {}),
              },
            };

      return saveAppSettings(nextSettings);
    });
  }, []);

  const clearSession = useCallback(
    () =>
      updateSettings((current) => ({
        ...current,
        token: "",
        refreshToken: "",
        currentUser: null,
      })),
    [updateSettings],
  );

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      clearSession,
    }),
    [clearSession, settings, updateSettings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error("useAppSettings must be used inside AppSettingsProvider");
  }

  return context;
}
