import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DesktopOverlay } from "./DesktopOverlay.tsx";

const isDesktopOverlay = window.location.hash.startsWith("#/desktop-overlay");

document.documentElement.classList.toggle("desktop-overlay-mode", isDesktopOverlay);
document.body.classList.toggle("desktop-overlay-mode", isDesktopOverlay);

const root = createRoot(document.getElementById("root")!);

if (isDesktopOverlay) {
  // Do not wrap the overlay in StrictMode. In development React intentionally
  // re-runs Effects in StrictMode, which makes desktop movement timers harder
  // to reason about and can make companions appear to double-schedule moves.
  root.render(<DesktopOverlay />);
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
