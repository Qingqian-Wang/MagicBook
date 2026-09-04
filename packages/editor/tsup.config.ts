import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  banner: {
    js: "'use client'",
  },
  minify: true,
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  loader: {
    // §13 任务模板：md 以纯文本打进 bundle
    ".md": "text",
  },
});
