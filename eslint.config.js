import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Sinhala: U+0D80–U+0DFF, Tamil: U+0B80–U+0BFF
const SI_TA_MSG =
  "Sinhala/Tamil characters are only allowed in dictionary files (src/lib/i18n.tsx, src/lib/format.ts, src/surveys/*) and tests. Move the string into the dictionary and reference it via pickText / UI / format helpers.";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".tanstack",
      "src/routeTree.gen.ts",
      "src/integrations/supabase/types.ts",
      "public/sw.js",
      "audits/**",
      "Codex-audits/**",
      "Plans/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Block Sinhala/Tamil glyphs outside dictionary + survey content + tests.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "src/lib/i18n.tsx",
      "src/lib/analytics-report-i18n.ts",
      "src/lib/format.ts",
      "src/components/QuestionCount.tsx",
      "src/surveys/**",
      "src/**/__tests__/**",
      "src/**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "src/test/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/[\\u0D80-\\u0DFF\\u0B80-\\u0BFF]/]",
          message: SI_TA_MSG,
        },
        {
          selector: "TemplateElement[value.raw=/[\\u0D80-\\u0DFF\\u0B80-\\u0BFF]/]",
          message: SI_TA_MSG,
        },
        {
          selector: "JSXText[value=/[\\u0D80-\\u0DFF\\u0B80-\\u0BFF]/]",
          message: SI_TA_MSG,
        },
      ],
    },
  },
  eslintPluginPrettier,
);
