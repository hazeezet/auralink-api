import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores([
        "dist/**",
        "node_modules/**",
        "coverage/**",
        "script/**",
    ]),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // Formatting: 4 indent, double quotes, semicolons
            indent: ["error", 4, { SwitchCase: 1 }],
            quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ["error", "always"],
            "comma-dangle": ["error", "always-multiline"],
            "object-curly-spacing": ["error", "always"],
            "arrow-parens": ["error", "always"],
            "eol-last": ["error", "always"],
            "no-trailing-spaces": "error",

            // Standard best practices & hygiene
            "prefer-const": "error",
            "no-var": "error",
            "no-duplicate-imports": "error",
            eqeqeq: ["error", "always", { null: "ignore" }],
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "no-debugger": "error",
            curly: ["error", "all"],
            "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],

            // TypeScript rules
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    args: "after-used",
                    varsIgnorePattern: "^_",
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-empty-object-type": [
                "warn",
                {
                    allowInterfaces: "always",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                {
                    prefer: "type-imports",
                    fixStyle: "separate-type-imports",
                },
            ],
        },
    },
]);
