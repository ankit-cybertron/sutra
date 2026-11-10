import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + WebSocket to the FastAPI backend, so the browser only
// ever talks to one origin and no API keys or CORS tricks are needed on the client.
const BACKEND = process.env.VITE_DEV_BACKEND ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: false },
      "/ws": { target: BACKEND.replace(/^http/, "ws"), ws: true, changeOrigin: false },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
