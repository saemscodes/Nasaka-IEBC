import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import path from "path"
import { componentTagger } from "lovable-tagger"

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "::",
    port: 8080,
    // ✅ Enables client-side routing in dev mode
    historyApiFallback: true,
  },

  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          leaflet: ["leaflet", "react-leaflet"],
          ui: [
            "@radix-ui/react-select",
            "@radix-ui/react-dialog",
            "@radix-ui/react-tabs",
          ],
          utils: ["lucide-react", "clsx", "tailwind-merge"],
        },
      },
    },
  },

  define: {
    "process.env": process.env,
  },

  optimizeDeps: {
    include: ["leaflet", "react-leaflet"],
    exclude: ["lovable-tagger"],
  },

  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },

  // ✅ Critical fix: correct asset base for production builds
  // When deployed at root (Vercel, custom domain, etc.)
  base: "/",

  // ✅ Ensures correct MIME headers on built assets
  esbuild: {
    loader: "tsx",
  },
}))
