import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'masked-icon.svg',
        'assets/*.png',
        'assets/*.webp',
        'logo_green.png',
        'logo_white.png',
        'nasaka.svg'
      ],
      manifest: {
        name: 'Nasaka IEBC Office Finder',
        short_name: 'Nasaka',
        description: 'Find your nearest IEBC voter registration office in Kenya',
        theme_color: '#007AFF',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/iebc-office',
        icons: [
          {
            src: '/nasaka-logo-round-blacknblue.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/nasaka-logo-round-blacknblue.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/nasaka-logo-round-blacknblue.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Find IEBC Office',
            short_name: 'Find',
            description: 'Find nearest IEBC office',
            url: '/iebc-office?action=find',
            icons: [{ src: '/assets/icon-shortcut.png', sizes: '96x96' }]
          },
          {
            name: 'View Map',
            short_name: 'Map',
            description: 'View IEBC offices on map',
            url: '/iebc-office/map',
            icons: [{ src: '/assets/icon-map.png', sizes: '96x96' }]
          }
        ],
        categories: ['navigation', 'productivity', 'utilities'],
        screenshots: [
          {
            src: '/assets/screenshot-desktop.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Nasaka IEBC Desktop View'
          },
          {
            src: '/assets/screenshot-mobile.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Nasaka IEBC Mobile View'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,ttf}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ftswzvqwxdwgkvfbwfpx\.supabase\.co\/rest\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/ftswzvqwxdwgkvfbwfpx\.supabase\.co\/storage\/v1\/object\/.*\.(geojson|json)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geojson-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nominatim-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        sourcemap: false,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_next/, /^\/static/, /^\/api\//]
      },
      devOptions: {
        enabled: mode === 'development',
        type: 'module',
        navigateFallback: 'index.html'
      },
      strategies: 'generateSW'
    })
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "::",
    port: 8080,
    historyApiFallback: true,
    headers: {
      'Service-Worker-Allowed': '/'
    }
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
          utils: ["lucide-react", "clsx", "tailwind-merge", "idb-keyval"],
          supabase: ["@supabase/supabase-js"],
          framer: ["framer-motion"],
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode !== 'development',
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 1000
  },

  define: {
    'process.env': process.env,
    '__VITE_PWA_MANIFEST': JSON.stringify({})
  },

  optimizeDeps: {
    include: ["leaflet", "react-leaflet", "fuse.js"],
    exclude: ["lovable-tagger"]
  },

  css: {
    modules: {
      localsConvention: "camelCase",
    },
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer
      ]
    }
  },

  base: "/",

  esbuild: {
    loader: "tsx",
    legalComments: 'none'
  },

  publicDir: 'public',
  assetsInclude: ['**/*.geojson', '**/*.csv']
}));