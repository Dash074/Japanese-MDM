/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        shu: "var(--shu)",
        "on-shu": "var(--on-shu)",
        ai: "var(--ai)",
        matcha: "var(--matcha)",
        kincha: "var(--kincha)",
        grid: "var(--grid)",
      },
      fontFamily: {
        kanji: ['"Klee One"', "serif"],
        mincho: ['"Shippori Mincho"', "serif"],
        sans: ['"Zen Kaku Gothic New"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
