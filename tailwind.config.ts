import type { Config } from "tailwindcss";

// Palette: ink text, white paper, cool mist surfaces, deep teal for actions, scholarship gold reserved for money.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Public Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#172033", soft: "#4A5568", faint: "#6B7686" },
        mist: { DEFAULT: "#EEF2F6", deep: "#E2E8EF" },
        line: "#D6DDE6",
        teal: { DEFAULT: "#0E6B66", dark: "#0A514D", tint: "#E3F1EF" },
        gold: { DEFAULT: "#F2B544", tint: "#FDF3DC", ink: "#6B4A06" },
        danger: { DEFAULT: "#B42318", tint: "#FDECEA" },
      },
      borderRadius: { xl: "14px" },
    },
  },
  plugins: [],
} satisfies Config;
