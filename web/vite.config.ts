import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // 5180 (not Vite's default 5173) to avoid clashing with other local projects.
    // strictPort makes the port deterministic so the backend CORS origin always matches.
    port: 5180,
    strictPort: true,
  },
});
