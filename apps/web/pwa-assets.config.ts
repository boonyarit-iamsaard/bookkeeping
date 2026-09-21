import { defineConfig } from "@vite-pwa/assets-generator/config";

// Cobalt from DESIGN.md, as sRGB hex because sharp cannot read oklch.
const COBALT = "#1f5ed9";

// The source is a cobalt disc, so padding the maskable and Apple icons on a
// cobalt ground yields a full-bleed square with the monogram inside the safe
// zone; the transparent icons keep the disc as drawn.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, "favicon.ico"]],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0.1,
      resizeOptions: { background: COBALT },
    },
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { background: COBALT },
    },
  },
  images: ["public/icon.svg"],
});
