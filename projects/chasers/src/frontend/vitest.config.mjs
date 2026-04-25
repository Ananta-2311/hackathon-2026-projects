import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      include: /\.[jt]sx?$/,
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(rootDir),
    },
  },
  test: {
    include: ["lib/**/*.test.js"],
    environment: "jsdom",
    setupFiles: "./vitest.setup.js",
    globals: true,
  },
});
