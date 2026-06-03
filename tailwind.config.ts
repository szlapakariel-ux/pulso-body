import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pulso: {
          bg: "#F8F7F2",
          ink: "#1B221F",
          soft: "#6B7280",
          accent: "#111111",
          mute: "#E7E2D8",
          card: "#FFFFFF",
          ai: "#F1F0EB",
          highlight: "#C99563",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
      },
    },
  },
  plugins: [],
};

export default config;
