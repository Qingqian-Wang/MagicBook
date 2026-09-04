import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/editor/test/**/*.test.ts"],
    environment: "node",
  },
});
