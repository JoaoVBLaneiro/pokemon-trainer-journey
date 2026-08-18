const path = require("node:path");
const { app, BrowserWindow, screen } = require("electron");

let overlayWindow = null;

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;

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
    },
  });

  // Float over ordinary apps, but not above system UI such as the Windows taskbar.
  overlayWindow.setAlwaysOnTop(true, "floating");

  // The proof-of-concept is entirely click-through. In the real version we can
  // toggle this when the cursor is over a Pokémon so companions remain clickable.
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.loadFile(path.join(__dirname, "desktop-overlay.html"));

  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.showInactive();
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

app.whenReady().then(() => {
  createOverlayWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
