const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trainerJourneyDesktop", {
  setMouseCapture(shouldCapture) {
    ipcRenderer.send(
      "desktop-overlay:set-mouse-capture",
      Boolean(shouldCapture),
    );
  },

  setAppVisibilityRules(rules) {
    ipcRenderer.send("desktop-overlay:set-app-visibility-rules", rules);
  },

  listRunningApps() {
    return ipcRenderer.invoke("desktop-apps:list");
  },
});
