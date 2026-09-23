import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// DESIGN.md Paper as sRGB hex: manifest parsers do not all read oklch. The
// status bar matches the page, so theme and background are both Paper.
const PAPER = "#ffffff";

export default defineConfig({
  plugins: [
    tailwindcss(),
    // The router plugin must precede the React plugin so it sees the raw
    // route files it splits.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // `main.tsx` registers the worker through `virtual:pwa-register`.
      injectRegister: false,
      manifest: {
        name: "Bookkeeping",
        short_name: "Bookkeeping",
        description: "A personal ledger",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: PAPER,
        background_color: PAPER,
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // A worker installed on the first visit controls that page at once,
        // so the next launch is already served by it.
        clientsClaim: true,
        // The shell, its hashed assets, the icons, and the offline page.
        globPatterns: ["**/*.{js,css,html,ico,png}"],
        // Navigations go to the network so an offline launch can fall back to
        // the offline page instead of booting a shell that cannot reach the
        // API; the precache navigation route would otherwise answer first.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.mode === "navigate",
            handler: "NetworkOnly",
            options: { precacheFallback: { fallbackURL: "/offline.html" } },
          },
          // The API lives on another origin, so match by pathname anywhere.
          // Each matcher is serialised into the worker, so it cannot share
          // a helper.
          {
            urlPattern: ({ url }) =>
              url.pathname === "/v1" || url.pathname.startsWith("/v1/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) =>
              url.pathname === "/api/auth" ||
              url.pathname.startsWith("/api/auth/"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
