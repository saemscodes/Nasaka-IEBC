import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // ✅ CRITICAL FOR CLIENT-SIDE ROUTING
    historyApiFallback: true
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          leaflet: ["leaflet", "react-leaflet"],
          ui: ["@radix-ui/react-select", "@radix-ui/react-dialog", "@radix-ui/react-tabs"],
          utils: ["lucide-react", "clsx", "tailwind-merge"]
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ✅ ENVIRONMENT VARIABLES FOR IEBC MAP
  define: {
    'process.env': process.env
  },
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
    exclude: ['lovable-tagger']
  },
  // ✅ PUBLIC PATH FOR ASSETS
  base: './',
  // ✅ CSS CONFIGURATION
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  }
}));
