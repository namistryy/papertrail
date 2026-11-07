import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built site works from any path (e.g. GitHub Pages /papertrail/)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
