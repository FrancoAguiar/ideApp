import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: ["hidden"],
  theme: {
    extend: {
      colors: {
        ideapp: {
          bg: "#f8f5ec",
          green: "#58cc02",
          ink: "#20251f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
