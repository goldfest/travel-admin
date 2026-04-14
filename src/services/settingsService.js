const SETTINGS_KEY = "travel-admin-settings";

export const defaultSettings = {
  mode: "api",
  token: "",
  refreshToken: "",
  currentUser: null,
  services: {
    auth: "https://turban-financial-penholder.ngrok-free.dev/api",
    city: "https://turban-financial-penholder.ngrok-free.dev/api/cities",
    poi: "https://turban-financial-penholder.ngrok-free.dev/api/poi",
    review: "https://turban-financial-penholder.ngrok-free.dev/api/reviews",
    route: "https://turban-financial-penholder.ngrok-free.dev/api/routes",
    graphImport: "https://turban-financial-penholder.ngrok-free.dev",
    ml: "https://turban-financial-penholder.ngrok-free.dev",
  },
};

function mergeSettings(rawSettings = {}) {
  return {
    ...defaultSettings,
    ...rawSettings,
    mode: "api",
    services: {
      ...defaultSettings.services,
      ...(rawSettings.services || {}),
    },
  };
}

export function getAppSettings() {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  const rawValue = window.localStorage.getItem(SETTINGS_KEY);

  if (!rawValue) {
    return defaultSettings;
  }

  try {
    return mergeSettings(JSON.parse(rawValue));
  } catch {
    return defaultSettings;
  }
}

export function saveAppSettings(settings) {
  const merged = mergeSettings(settings);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  }

  return merged;
}
