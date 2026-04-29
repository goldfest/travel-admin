import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_URL = "https://turban-financial-penholder.ngrok-free.dev";

const proxyConfig = {
  target: BACKEND_URL,
  changeOrigin: true,
  secure: true,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": proxyConfig,
      "/internal": proxyConfig,
      "/health": proxyConfig,
    },
  },
});