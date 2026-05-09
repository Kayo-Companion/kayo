import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FFF8F2",
          50: "#FFFCF8",
          100: "#FFF8F2",
          200: "#FFF0E2",
        },
        peach: {
          DEFAULT: "#FFE8D6",
          200: "#FFE8D6",
          300: "#FFD4B5",
          400: "#FFB088",
        },
        coral: {
          DEFAULT: "#E85D5D",
          400: "#F07878",
          500: "#E85D5D",
          600: "#D14545",
        },
        rose: {
          DEFAULT: "#F5A3A3",
          200: "#FFD4D4",
          300: "#FFB8B8",
          400: "#F5A3A3",
          500: "#EC8B8B",
        },
        warm: {
          orange: "#FF8A65",
          gray: "#7B6B63",
          brown: "#2D1B14",
        },
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-jp)", "system-ui", "sans-serif"],
        serif: ["var(--font-noto-serif-jp)", "serif"],
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-in": "fadeSlideIn 0.8s ease-out forwards",
        marquee: "marquee 40s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
