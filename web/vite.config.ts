import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://<owner>.github.io/<repo>/ — override with VITE_BASE for a custom domain.
export default defineConfig({
  base: process.env.VITE_BASE ?? "./",
  plugins: [react()],
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
});
