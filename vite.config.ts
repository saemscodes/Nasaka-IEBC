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
        'logo_green.png',
        'logo_white.png',
        'nasaka.svg',
        'offline.html',
        'illustrations/undraw_lost_teip.svg',
        'illustrations/undraw_world_bdnk.svg'
      ],
      manifest: {
        name: 'Nasaka IEBC — Find IEBC Offices near You, anywhere across Kenya',
        short_name: 'Nasaka IEBC',
        description: 'Find IEBC offices in all 47 counties and 290 constituencies. Nasaka IEBC helps Kenyans locate, verify and engage with IEBC service points. Interactive maps, directions, ride-hailing services support, verification and civic reporting for trustworthy electoral access. Learn how to register to vote, check status, transfer registration at your nearest IEBC office.',
        theme_color: '#0b63c6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/iebc-office',
        icons: [
          {
            src: '/nasaka.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/nasaka-logo-blue.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/nasaka-logo-white.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/nasaka-logo-black.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/nasaka-logo-bnw.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/nasaka-logo-round-black.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/nasaka-logo-round-bnw.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/nasaka-logo-blue.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Find IEBC Office',
            short_name: 'Find',
            description: 'Find nearest IEBC office',
            url: '/iebc-office?action=find',
            icons: [{ src: '/nasaka-logo-blue.png', sizes: '96x96' }]
          },
          {
            name: 'View Map',
            short_name: 'Map',
            description: 'View IEBC offices on map',
            url: '/iebc-office/map',
            icons: [{ src: '/nasaka-logo-blue.png', sizes: '96x96' }]
          }
        ],
        categories: ['navigation', 'productivity', 'utilities'],
        screenshots: [
          {
            src: '/1.webp',
            sizes: '1280x720',
            type: 'image/webp',
            form_factor: 'wide',
            label: 'Nasaka IEBC Desktop View'
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
                maxEntries: 50, // Reduced from 100
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
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
                maxEntries: 20, // Aggressive reduction
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              }
            }
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nominatim-cache',
              networkTimeoutSeconds: 15, // Increased timeout 
              expiration: {
                maxEntries: 20, // Aggressive reduction
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50, // Aggressive reduction
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              }
            }
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources-cache',
              expiration: {
                maxEntries: 50, // Aggressive reduction
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              }
            }
          },
          // ── Map Tile Caching (Lowered limits to avoid QuotaExceededError) ──
          {
            urlPattern: /^https:\/\/.*\.?tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 20, // Absolute minimum for basic offline
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'satellite-tiles-cache',
              expiration: {
                maxEntries: 10, // Minimal for critical locations
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // ── Weather & Routing API Caching ──
          {
            urlPattern: /^https:\/\/api\.openrouteservice\.org\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ors-routing-cache',
              networkTimeoutSeconds: 15, // Increased timeout
              expiration: {
                maxEntries: 10, // Minimal
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
                purgeOnQuotaError: true // AUTO-PURGE IF QUOTA HIT
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/weather\.visualcrossing\.com\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-vc-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 15 * 60 // 15 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-openmeteo-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 15 * 60 // 15 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true,
        sourcemap: false,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\//],
        navigateFallbackDenylist: [/^\/_next/, /^\/static/, /^\/api\//, /^\/assets\//]
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
      'Service-Worker-Allowed': '/',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    // Proxy /api/* to Vercel dev server (port 3000) — keeps API routes
    // completely outside of Vite's SPA/React-Router fallback.
    // Run `vercel dev` in a separate terminal for this to work locally.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            // Vercel dev not running — return a helpful 503 instead of crashing
            if (!res.headersSent) {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ error: 'API server unavailable. Run `vercel dev` in a separate terminal to enable /api/* routes locally.' }));
            }
          });
        }
      }
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
    'process.env': process.env
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