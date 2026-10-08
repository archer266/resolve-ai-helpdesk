import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${loadEnv(mode, fileURLToPath(new URL("../server", import.meta.url)), "PORT").PORT || 3001}`,
    },
  },
}));
