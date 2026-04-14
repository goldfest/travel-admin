const SETTINGS_KEY = "travel-admin-settings";

export const defaultSettings = {
  mode: "api",
  token: "",
  refreshToken: "",
  currentUser: null,
  services: {
    auth: "https://abc123.ngrok-free.app/api",
    city: "https://abc123.ngrok-free.app/api/cities",
    poi: "https://abc123.ngrok-free.app/api/poi",
    review: "https://abc123.ngrok-free.app/api/reviews",
    route: "https://abc123.ngrok-free.app/api/routes",
    graphImport: "https://abc123.ngrok-free.app",
    ml: "https://abc123.ngrok-free.app",
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
