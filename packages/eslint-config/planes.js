import importX from "eslint-plugin-import-x";

/**
 * Enforces the plane graph inside `apps/api/src`: `solutions/*` may reach
 * `control-plane/*`, never the reverse, and one solution may never reach
 * another.
 *
 * `no-restricted-imports` cannot express this. It matches the literal
 * specifier, so `../../solutions/crm/x` and `../../../solutions/crm/x` need
 * separate globs — and, worse, `apps/api` already sets that rule for `src/**`,
 * and a second config block declaring it would replace rather than extend it,
 * silently dropping the `@api/*` guard. `import-x/no-restricted-paths`
 * resolves the specifier to a real path first and is a distinct rule name, so
 * it composes instead of colliding.
 *
 * Sibling-solution zones are added one line per solution, because the `except`
 * list has to name the solution it belongs to.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const apiPlanes = [
  {
    files: ["src/**/*.ts"],
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver": { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/control-plane",
              from: "./src/solutions",
              message:
                "control-plane may not depend on solutions. The direction is one-way: solutions -> control-plane. Machinery every solution needs belongs in control-plane, not in one of them.",
            },
          ],
        },
      ],
    },
  },
];
