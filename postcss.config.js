export default {
  plugins: {
    '@tailwindcss/postcss': {},
    // Old Android WebViews (Chrome < 99/111) don't understand cascade layers or
    // modern color functions, so Tailwind v4's output renders as "no CSS".
    // Flatten @layer, then lower oklch()/color-mix() to plain rgb fallbacks.
    '@csstools/postcss-cascade-layers': {},
    '@csstools/postcss-oklab-function': { preserve: false, subFeatures: { displayP3: false } },
    '@csstools/postcss-color-mix-function': { preserve: false },
    autoprefixer: {},
  },
}
