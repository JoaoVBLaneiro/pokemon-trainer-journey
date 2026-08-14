import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site:
// https://<USERNAME>.github.io/pokemon-trainer-journey/
export default defineConfig({
  plugins: [react()],
  base: "/pokemon-trainer-journey/",
});
