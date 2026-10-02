import { defineConfig } from "@vite-pwa/assets-generator/config";

// Midnight, the icon's ground, as sRGB hex because sharp cannot read oklch.
const MIDNIGHT = "#242047";

// The source is a Midnight squircle, so padding the maskable and Apple icons
// on a Midnight ground yields a full-bleed square with the mark inside the
// safe zone; the transparent icons keep the squircle as drawn.
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
      resizeOptions: { background: MIDNIGHT },
    },
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { background: MIDNIGHT },
    },
  },
  images: ["public/icon.svg"],
});
