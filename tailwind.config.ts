import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soft, friendly brand palette — calm indigo/violet, not a banking blue.
        brand: {
          50: "#f2f1ff",
          100: "#e7e5ff",
          200: "#d2ceff",
          300: "#b3aaff",
          400: "#8f7bff",
          500: "#6f53f5",
          600: "#5f3fe0",
          700: "#4f31bd",
          800: "#412c99",
          900: "#372a7a",
        },
        // Warm, calm accent for positive money ("you are owed").
        mint: {
          50: "#eefdf6",
          100: "#d6f9e8",
          200: "#b0f1d4",
          300: "#79e3b8",
          400: "#3fcd97",
          500: "#1bb27e",
          600: "#0f9067",
          700: "#0d7354",
          800: "#0e5b45",
          900: "#0c4b3a",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 16px rgba(16, 24, 40, 0.06)",
        soft: "0 8px 30px rgba(16, 24, 40, 0.08)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
