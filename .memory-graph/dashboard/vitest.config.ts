import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    globals: false,
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "hooks/**/*.test.ts",
      "hooks/**/*.test.tsx",
      "components/**/*.test.tsx",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx"
    ],
    exclude: ["node_modules/**", ".next/**"]
  }
});
