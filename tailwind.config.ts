import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F7F8F7",
        surface: "#FFFFFF",
        ink: {
          50: "#F1F4F2",
          100: "#E7ECE8",
          200: "#D8E0DB",
          300: "#BCC7C1",
          400: "#94A39B",
          500: "#6B7D75",
          600: "#4C6058",
          800: "#1F332E",
          950: "#0B1F1B",
        },
        river: {
          50: "#EAF6F4",
          100: "#D3EDE9",
          300: "#6FC9BE",
          500: "#16A394",
          700: "#0C6A5F",
          800: "#0A554C",
          950: "#052C27",
        },
        amber: {
          100: "#F7EBD3",
          600: "#A8730F",
          800: "#7A5210",
        },
        brick: {
          100: "#F8E5E1",
          600: "#B23A2B",
          800: "#8C2D22",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xs: "3px",
        sm: "5px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        overlay: "0 1px 2px rgba(11,31,27,.04), 0 12px 32px -8px rgba(11,31,27,.16)",
        sticky: "0 1px 0 rgba(11,31,27,.06)",
      },
      maxWidth: {
        client: "680px",
        admin: "1240px",
      },
    },
  },
  plugins: [],
};

export default config;
