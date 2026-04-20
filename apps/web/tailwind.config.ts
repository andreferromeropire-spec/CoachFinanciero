import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces (light mode)
        base:    "#F8FAFC",
        surface: "#FFFFFF",
        raised:  "#F1F5F9",
        border:  "#E2E8F0",
        // Primary accent — teal
        teal: {
          DEFAULT: "#14B8A6",
          dim:     "#14B8A61A",
          hover:   "#0D9488",
          light:   "#CCFBF1",
        },
        // Secondary accent
        purple: {
          DEFAULT: "#8B5CF6",
          dim:     "#8B5CF61A",
          light:   "#EDE9FE",
        },
        pink: {
          DEFAULT: "#EC4899",
          dim:     "#EC48991A",
          light:   "#FCE7F3",
        },
        sky: {
          DEFAULT: "#0EA5E9",
          dim:     "#0EA5E91A",
          light:   "#E0F2FE",
        },
        // Status
        success: "#10B981",
        danger:  "#EF4444",
        warning: "#F59E0B",
        // Text
        hi:  "#1E2937",
        mid: "#64748B",
        lo:  "#94A3B8",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        pill: "9999px",
        xl2: "16px",
      },
      boxShadow: {
        card:      "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-md": "0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
        "card-lg": "0 10px 25px -5px rgb(0 0 0 / 0.10), 0 4px 10px -5px rgb(0 0 0 / 0.06)",
        "card-xl": "0 20px 40px -10px rgb(0 0 0 / 0.12), 0 8px 16px -8px rgb(0 0 0 / 0.06)",
        "glow-teal":   "0 0 20px rgb(20 184 166 / 0.25)",
        "glow-purple": "0 0 20px rgb(139 92 246 / 0.20)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
        "250": "250ms",
      },
    },
  },
  plugins: [],
};

export default config;
