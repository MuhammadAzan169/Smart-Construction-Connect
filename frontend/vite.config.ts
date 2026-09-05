import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Local API target for the dev-server proxy. The repo-root `app.py` runner sets
// DEV_API_TARGET so a custom --backend-port still proxies to the right place;
// standalone `npm run dev` falls back to the default :8000.
const API_TARGET = process.env.DEV_API_TARGET ?? "http://localhost:8000";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
      "/images": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/company_data": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/uploads": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // Content hashes guarantee cache-busting on every new build
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: (id: string) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
            return "vendor";
          }
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/lucide-react")) {
            return "ui";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "query";
          }
        },
      },
    },
  },
});
