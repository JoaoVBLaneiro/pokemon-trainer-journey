import { useEffect, useState } from "react";
import {
  readDesktopPreferences,
  setDesktopActivityFeedEnabled,
  setDesktopAppVisibility,
  setDesktopMouseInteractionsEnabled,
  subscribeDesktopPreferences,
  type DesktopAppRule,
  type DesktopAppVisibilityMode,
} from "./desktopPreferences";
import "./DesktopSettingsPage.css";

type DesktopRunningApp = {
  key: string;
  name: string;
  path?: string;
  title?: string;
};

export function DesktopSettingsPage() {
  const [activityFeedEnabled, setActivityFeedState] = useState(
    () => readDesktopPreferences().activityFeedEnabled,
  );
  const [mouseInteractionsEnabled, setMouseInteractionsState] = useState(
    () => readDesktopPreferences().mouseInteractionsEnabled,
  );
  const [appVisibilityMode, setAppVisibilityModeState] =
    useState<DesktopAppVisibilityMode>(
      () => readDesktopPreferences().appVisibilityMode,
    );
  const [appVisibilityApps, setAppVisibilityAppsState] = useState<DesktopAppRule[]>(
    () => readDesktopPreferences().appVisibilityApps,
  );
  const [runningApps, setRunningApps] = useState<DesktopRunningApp[]>([]);
  const [loadingRunningApps, setLoadingRunningApps] = useState(false);

  useEffect(
    () =>
      subscribeDesktopPreferences((preferences) => {
        setActivityFeedState(preferences.activityFeedEnabled);
        setMouseInteractionsState(preferences.mouseInteractionsEnabled);
        setAppVisibilityModeState(preferences.appVisibilityMode);
        setAppVisibilityAppsState(preferences.appVisibilityApps);
      }),
    [],
  );

  const toggleActivityFeed = () => {
    const next = !activityFeedEnabled;
    setActivityFeedState(next);
    setDesktopActivityFeedEnabled(next);
  };

  const toggleMouseInteractions = () => {
    const next = !mouseInteractionsEnabled;
    setMouseInteractionsState(next);
    setDesktopMouseInteractionsEnabled(next);
  };

  const syncAppVisibility = (
    mode: DesktopAppVisibilityMode,
    apps: DesktopAppRule[],
  ) => {
    setAppVisibilityModeState(mode);
    setAppVisibilityAppsState(apps);
    setDesktopAppVisibility(mode, apps);
    window.trainerJourneyDesktop?.setAppVisibilityRules({ mode, apps });
  };

  const changeAppVisibilityMode = (mode: DesktopAppVisibilityMode) => {
    syncAppVisibility(mode, appVisibilityApps);
  };

  const toggleVisibilityApp = (app: DesktopRunningApp) => {
    const alreadySelected = appVisibilityApps.some((rule) => rule.key === app.key);
    const next = alreadySelected
      ? appVisibilityApps.filter((rule) => rule.key !== app.key)
      : [
          ...appVisibilityApps,
          { key: app.key, name: app.name, path: app.path },
        ];
    syncAppVisibility(appVisibilityMode, next);
  };

  const removeSavedApp = (key: string) => {
    syncAppVisibility(
      appVisibilityMode,
      appVisibilityApps.filter((rule) => rule.key !== key),
    );
  };

  const refreshRunningApps = async () => {
    if (!window.trainerJourneyDesktop?.listRunningApps) return;
    setLoadingRunningApps(true);
    try {
      const apps = await window.trainerJourneyDesktop.listRunningApps();
      setRunningApps(apps);
    } finally {
      setLoadingRunningApps(false);
    }
  };

  useEffect(() => {
    void refreshRunningApps();
  }, []);

  return (
    <section className="desktop-settings-page">
      <header className="desktop-settings-header">
        <span className="section-kicker">Desktop habitat</span>
        <h1>Desktop companions</h1>
        <p>
          Control how your Pokémon behave while they are spending time on your
          actual desktop.
        </p>
      </header>

      <div className="desktop-settings-grid">
        <article className="desktop-setting-card">
          <div className="desktop-setting-copy">
            <div className="desktop-setting-icon" aria-hidden="true">
              ▤
            </div>
            <div>
              <strong>Activity feed</strong>
              <p>
                Show one small text box in the bottom-right corner when a
                companion does something noteworthy. The feed never stacks
                multiple messages.
              </p>
            </div>
          </div>

          <button
            className={`desktop-toggle ${activityFeedEnabled ? "is-on" : ""}`}
            type="button"
            role="switch"
            aria-checked={activityFeedEnabled}
            onClick={toggleActivityFeed}
          >
            <span className="desktop-toggle-track" aria-hidden="true">
              <i />
            </span>
            <strong>{activityFeedEnabled ? "On" : "Off"}</strong>
          </button>
        </article>

        <article className="desktop-setting-card">
          <div className="desktop-setting-copy">
            <div className="desktop-setting-icon" aria-hidden="true">
              ↖
            </div>
            <div>
              <strong>Mouse interactions</strong>
              <p>
                Let Pokémon notice your cursor and temporarily capture clicks
                only while the pointer is directly over them. Left-click a
                companion to pet it; the rest of the desktop remains
                click-through.
              </p>
            </div>
          </div>

          <button
            className={`desktop-toggle ${mouseInteractionsEnabled ? "is-on" : ""}`}
            type="button"
            role="switch"
            aria-checked={mouseInteractionsEnabled}
            onClick={toggleMouseInteractions}
          >
            <span className="desktop-toggle-track" aria-hidden="true">
              <i />
            </span>
            <strong>{mouseInteractionsEnabled ? "On" : "Off"}</strong>
          </button>
        </article>

        <article className="desktop-setting-card desktop-setting-card-column">
          <div className="desktop-setting-copy">
            <div className="desktop-setting-icon" aria-hidden="true">
              ◫
            </div>
            <div>
              <strong>App visibility</strong>
              <p>
                Decide when the desktop habitat should disappear. App rules use
                the application itself, so blocking Terraria hides the Pokémon
                whenever Terraria is the foreground app.
              </p>
            </div>
          </div>

          <div className="desktop-app-visibility-controls">
            <label className="desktop-field">
              <span>Overlay behavior</span>
              <select
                value={appVisibilityMode}
                onChange={(event) =>
                  changeAppVisibilityMode(
                    event.target.value as DesktopAppVisibilityMode,
                  )
                }
              >
                <option value="everywhere">Show everywhere</option>
                <option value="hide-selected">Hide in selected apps</option>
                <option value="show-selected">Show only in selected apps</option>
              </select>
            </label>

            {appVisibilityMode !== "everywhere" && (
              <>
                <div className="desktop-app-picker-heading">
                  <div>
                    <strong>Running apps</strong>
                    <span>Select applications using a normal visible window.</span>
                  </div>
                  <button
                    type="button"
                    className="desktop-secondary-button"
                    onClick={() => void refreshRunningApps()}
                    disabled={loadingRunningApps}
                  >
                    {loadingRunningApps ? "Refreshing…" : "Refresh"}
                  </button>
                </div>

                <div className="desktop-running-apps">
                  {runningApps.length === 0 && !loadingRunningApps ? (
                    <p className="desktop-empty-apps">
                      No running desktop apps were found. Open an app and press
                      Refresh.
                    </p>
                  ) : (
                    runningApps.map((app) => {
                      const selected = appVisibilityApps.some(
                        (rule) => rule.key === app.key,
                      );
                      return (
                        <button
                          type="button"
                          className={`desktop-running-app ${
                            selected ? "is-selected" : ""
                          }`}
                          key={app.key}
                          onClick={() => toggleVisibilityApp(app)}
                        >
                          <span className="desktop-app-check" aria-hidden="true">
                            {selected ? "✓" : ""}
                          </span>
                          <span className="desktop-running-app-copy">
                            <strong>{app.name}</strong>
                            <small>{app.title || app.path || "Running application"}</small>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {appVisibilityApps.length > 0 && (
                  <div className="desktop-saved-apps">
                    <span>Saved rules</span>
                    <div>
                      {appVisibilityApps.map((app) => (
                        <button
                          key={app.key}
                          type="button"
                          title={`Remove ${app.name}`}
                          onClick={() => removeSavedApp(app.key)}
                        >
                          {app.name} <b>×</b>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </article>

        <article className="desktop-setting-card desktop-setting-card-muted">
          <div className="desktop-setting-copy">
            <div className="desktop-setting-icon" aria-hidden="true">
              ✦
            </div>
            <div>
              <strong>More desktop controls</strong>
              <p>
                Companion selection, monitor assignment, always-on-top behavior,
                and other controls can live here as the desktop habitat grows.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
