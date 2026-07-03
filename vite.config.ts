import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Vite configuration.
// - `@` resolves to `src/` so imports stay clean as the tree grows.
// - Phaser is split into its own chunk to keep the main bundle lean.
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2020",
    // Phaser is a large single dependency; its own chunk legitimately exceeds
    // the default 500 kB warning threshold.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
  },
});
