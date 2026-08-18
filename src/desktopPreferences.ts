export type DesktopAppVisibilityMode =
  | "everywhere"
  | "hide-selected"
  | "show-selected";

export type DesktopAppRule = {
  key: string;
  name: string;
  path?: string;
};

export type DesktopPreferences = {
  activityFeedEnabled: boolean;
  mouseInteractionsEnabled: boolean;
  appVisibilityMode: DesktopAppVisibilityMode;
  appVisibilityApps: DesktopAppRule[];
};

const STORAGE_KEY = "trainerJourney.desktopPreferences.v1";
const CHANNEL_NAME = "trainerJourney.desktopPreferences";
const DEFAULT_PREFERENCES: DesktopPreferences = {
  // Keep the desktop quiet by default. The user can explicitly opt into text.
  activityFeedEnabled: false,
  // Mouse interactions are the fun part of desktop companions, so new installs
  // get them immediately. They can still be disabled from the Desktop page.
  mouseInteractionsEnabled: true,
  // Preserve today's behavior after upgrading. The user opts into app filtering.
  appVisibilityMode: "everywhere",
  appVisibilityApps: [],
};

export function readDesktopPreferences(): DesktopPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<DesktopPreferences>;
    return {
      activityFeedEnabled:
        typeof parsed.activityFeedEnabled === "boolean"
          ? parsed.activityFeedEnabled
          : DEFAULT_PREFERENCES.activityFeedEnabled,
      mouseInteractionsEnabled:
        typeof parsed.mouseInteractionsEnabled === "boolean"
          ? parsed.mouseInteractionsEnabled
          : DEFAULT_PREFERENCES.mouseInteractionsEnabled,
      appVisibilityMode:
        parsed.appVisibilityMode === "hide-selected" ||
        parsed.appVisibilityMode === "show-selected" ||
        parsed.appVisibilityMode === "everywhere"
          ? parsed.appVisibilityMode
          : DEFAULT_PREFERENCES.appVisibilityMode,
      appVisibilityApps: Array.isArray(parsed.appVisibilityApps)
        ? parsed.appVisibilityApps
            .filter(
              (app): app is DesktopAppRule =>
                Boolean(app) &&
                typeof app === "object" &&
                typeof app.key === "string" &&
                typeof app.name === "string",
            )
            .map((app) => ({
              key: app.key,
              name: app.name,
              path: typeof app.path === "string" ? app.path : undefined,
            }))
        : DEFAULT_PREFERENCES.appVisibilityApps,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writeDesktopPreferences(
  preferences: DesktopPreferences,
): DesktopPreferences {
  const next: DesktopPreferences = {
    activityFeedEnabled: Boolean(preferences.activityFeedEnabled),
    mouseInteractionsEnabled: Boolean(preferences.mouseInteractionsEnabled),
    appVisibilityMode:
      preferences.appVisibilityMode === "hide-selected" ||
      preferences.appVisibilityMode === "show-selected"
        ? preferences.appVisibilityMode
        : "everywhere",
    appVisibilityApps: preferences.appVisibilityApps.map((app) => ({
      key: app.key,
      name: app.name,
      path: app.path,
    })),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  // storage events cover the other BrowserWindow; BroadcastChannel makes the
  // update immediate and also keeps this useful if the renderer arrangement
  // changes later.
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(next);
    channel.close();
  }

  return next;
}

export function setDesktopActivityFeedEnabled(enabled: boolean) {
  return writeDesktopPreferences({
    ...readDesktopPreferences(),
    activityFeedEnabled: enabled,
  });
}

export function setDesktopMouseInteractionsEnabled(enabled: boolean) {
  return writeDesktopPreferences({
    ...readDesktopPreferences(),
    mouseInteractionsEnabled: enabled,
  });
}


export function setDesktopAppVisibility(
  mode: DesktopAppVisibilityMode,
  apps: DesktopAppRule[],
) {
  return writeDesktopPreferences({
    ...readDesktopPreferences(),
    appVisibilityMode: mode,
    appVisibilityApps: apps,
  });
}

export function subscribeDesktopPreferences(
  callback: (preferences: DesktopPreferences) => void,
) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback(readDesktopPreferences());
    }
  };

  window.addEventListener("storage", onStorage);

  let channel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", () => {
      callback(readDesktopPreferences());
    });
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}
