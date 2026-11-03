import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  base: "./",
  plugins: [react()],
  build: { outDir: "../public", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://localhost:8080" } },
});
