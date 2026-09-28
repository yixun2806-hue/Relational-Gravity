import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "prisma/migrations/**",
      "src/routes/ads.ts",
      "src/routes/products.ts",
      "src/services/product-service.ts",
      "src/services/unlock-service.ts",
      "scripts/p0-e2e.mjs",
      "scripts/product-e2e.mjs",
      "web/assets/vendor/**",
    ],
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["src/**/*.ts", "prisma/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
