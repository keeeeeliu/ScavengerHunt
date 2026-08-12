import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brown: {
          DEFAULT: "#4E3629",
          light: "#6B4A38",
        },
        seal: "#C8102E",
      },
    },
  },
  plugins: [],
};

export default config;
