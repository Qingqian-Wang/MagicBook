import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./packages/editor/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [typography],
};

export default config;
