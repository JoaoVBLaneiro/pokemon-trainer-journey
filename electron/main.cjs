const path = require("node:path");
const { spawn, execFile } = require("node:child_process");
const { app, BrowserWindow, ipcMain, screen } = require("electron");

const isDev = process.argv.includes("--dev");
const overlayOnly = process.argv.includes("--overlay-only");
const devBaseUrl =
  process.env.TRAINER_JOURNEY_DEV_URL ||
  "http://localhost:5173/pokemon-trainer-journey/";

let mainWindow = null;
let overlayWindow = null;
let activeAppMonitor = null;
let activeAppBuffer = "";
let currentForegroundApp = null;
let visibilityRulesReady = false;
let visibilityRules = { mode: "everywhere", apps: [] };

function normalizedDevBaseUrl() {
  return devBaseUrl.endsWith("/") ? devBaseUrl : `${devBaseUrl}/`;
}

async function loadTrainerRoute(window, route) {
  if (isDev) {
    await window.loadURL(`${normalizedDevBaseUrl()}#${route}`);
    return;
  }

  await window.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
    hash: route,
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 920,
    minHeight: 650,
    backgroundColor: "#f4f7f3",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  void loadTrainerRoute(mainWindow, "/");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  overlayWindow.setAlwaysOnTop(true, "floating");
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // The renderer sends its persisted visibility rules immediately after load.
  // We deliberately keep the overlay hidden until that first rules handshake,
  // preventing a blocked game from getting a one-frame Pokémon flash on launch.
  void loadTrainerRoute(overlayWindow, "/desktop-overlay");

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}



function normalizeAppValue(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .toLowerCase();
}

function appKeyFromInfo(info) {
  const pathValue = normalizeAppValue(info?.path);
  if (pathValue) return pathValue;
  return normalizeAppValue(info?.name);
}

function sanitizedVisibilityRules(input) {
  const mode =
    input?.mode === "hide-selected" || input?.mode === "show-selected"
      ? input.mode
      : "everywhere";

  const apps = Array.isArray(input?.apps)
    ? input.apps
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          key: normalizeAppValue(item.key),
          name: String(item.name || "Application"),
          path: item.path ? String(item.path) : undefined,
        }))
        .filter((item) => item.key)
    : [];

  return { mode, apps };
}

function foregroundMatchesSelectedApp() {
  if (!currentForegroundApp) return false;
  const foregroundKey = appKeyFromInfo(currentForegroundApp);
  const foregroundName = normalizeAppValue(currentForegroundApp.name);

  return visibilityRules.apps.some((rule) => {
    const ruleKey = normalizeAppValue(rule.key);
    const ruleName = normalizeAppValue(rule.name);
    return (
      (ruleKey && ruleKey === foregroundKey) ||
      (ruleName && ruleName === foregroundName)
    );
  });
}

function shouldOverlayBeVisible() {
  if (!visibilityRulesReady) return false;
  if (visibilityRules.mode === "everywhere") return true;

  const matched = foregroundMatchesSelectedApp();
  if (visibilityRules.mode === "hide-selected") return !matched;
  return matched;
}

function applyOverlayVisibility() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  if (shouldOverlayBeVisible()) {
    if (!overlayWindow.isVisible()) overlayWindow.showInactive();
    return;
  }

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  if (overlayWindow.isVisible()) overlayWindow.hide();
}

function startActiveAppMonitor() {
  if (process.platform !== "win32") {
    // App filtering is currently implemented for the user's Windows desktop.
    // Other platforms keep the overlay visible until their native monitor is added.
    currentForegroundApp = null;
    applyOverlayVisibility();
    return;
  }

  const scriptPath = path.join(__dirname, "active-app-monitor.ps1");
  activeAppMonitor = spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ],
    { windowsHide: true },
  );

  activeAppMonitor.stdout.setEncoding("utf8");
  activeAppMonitor.stdout.on("data", (chunk) => {
    activeAppBuffer += chunk;
    const lines = activeAppBuffer.split(/\\r?\\n/);
    activeAppBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        currentForegroundApp = JSON.parse(trimmed);
        applyOverlayVisibility();
      } catch {}
    }
  });

  activeAppMonitor.on("exit", () => {
    activeAppMonitor = null;
  });
}

function listRunningWindowsApps() {
  if (process.platform !== "win32") return Promise.resolve([]);

  const scriptPath = path.join(__dirname, "active-app-monitor.ps1");
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-List",
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            "Trainer Journey app discovery failed:",
            String(stderr || error.message || error),
          );
          resolve([]);
          return;
        }

        try {
          const raw = JSON.parse(String(stdout || "[]").trim() || "[]");
          const list = Array.isArray(raw) ? raw : [raw];
          const deduped = new Map();

          for (const item of list) {
            const key = appKeyFromInfo(item);
            if (!key) continue;

            const isTrainerJourney = Number(item.processId) === process.pid;
            const existing = deduped.get(key);
            if (!existing || (!existing.title && item.title) || isTrainerJourney) {
              deduped.set(key, {
                key,
                name: isTrainerJourney
                  ? "Trainer Journey"
                  : String(item.name || "Application"),
                title: String(item.title || ""),
                path: item.path ? String(item.path) : undefined,
              });
            }
          }

          resolve(
            [...deduped.values()].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
            ),
          );
        } catch {
          resolve([]);
        }
      },
    );
  });
}

ipcMain.on("desktop-overlay:set-app-visibility-rules", (event, input) => {
  const allowedSender =
    event.sender === overlayWindow?.webContents ||
    event.sender === mainWindow?.webContents;
  if (!allowedSender) return;

  visibilityRules = sanitizedVisibilityRules(input);
  visibilityRulesReady = true;
  applyOverlayVisibility();
});

ipcMain.handle("desktop-apps:list", async (event) => {
  const allowedSender =
    event.sender === mainWindow?.webContents ||
    event.sender === overlayWindow?.webContents;
  if (!allowedSender) return [];
  return listRunningWindowsApps();
});

ipcMain.on("desktop-overlay:set-mouse-capture", (event, shouldCapture) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (event.sender !== overlayWindow.webContents) return;

  if (Boolean(shouldCapture)) {
    // Only while the pointer is actually over a Pokémon. The window remains
    // focusable:false, so petting a companion should not steal keyboard focus
    // from whatever application the user is working in.
    overlayWindow.setIgnoreMouseEvents(false);
  } else {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  }
});

app.whenReady().then(() => {
  // Both BrowserWindows intentionally use Electron's default session and the
  // same application origin. That means the normal Trainer Journey window and
  // the overlay see the same IndexedDB/Dexie database inside the desktop app.
  if (!overlayOnly) createMainWindow();
  createOverlayWindow();
  startActiveAppMonitor();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (activeAppMonitor && !activeAppMonitor.killed) {
    activeAppMonitor.kill();
  }
});
