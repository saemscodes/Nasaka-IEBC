import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  
  return {
    plugins: [
      react(),
      isDev && componentTagger(),
    ].filter(Boolean),

    resolve: {
      alias: {
        // canonical project alias
        "@": path.resolve(__dirname, "./src"),
        // FORCE single copy of react/react-dom to root node_modules
        // (prevents multiple React copies and hook dispatcher null issues)
        "react": path.resolve(__dirname, "node_modules", "react"),
        "react-dom": path.resolve(__dirname, "node_modules", "react-dom"),
      },
      // ensure vite optimizer dedupes these packages
      dedupe: ["react", "react-dom"],
    },

    server: {
      host: "::",
      port: 8080,
    },

    build: {
      outDir: "dist",
      sourcemap: isDev,
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
      // include native ESM deps that need pre-bundling
      include: ["leaflet", "react-leaflet"],
      // exclude any plugin that breaks pre-bundling
      exclude: ["lovable-tagger"],
    },

    css: {
      modules: {
        localsConvention: "camelCase",
      },
    },

    // base path for production (Vercel/root deployments)
    base: "/",

    // ensure TSX gets correct loader path on esbuild
    esbuild: {
      loader: "tsx",
    },
  };
});
