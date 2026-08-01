// @swc/jest picks up .swcrc, so decorator metadata behaves identically to the
// nest-cli SWC build — configuring it twice here would invite drift.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/test/unit"],
  testRegex: "\\.spec\\.ts$",
  transform: { "^.+\\.ts$": "@swc/jest" },
  moduleFileExtensions: ["js", "json", "ts"],
  // Mirrors the `paths` entry in tsconfig.test.json. SWC never sees this
  // alias — jest resolves it — which is why it cannot leak into dist.
  moduleNameMapper: { "^@api/(.*)$": "<rootDir>/src/$1" },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/main.ts",
    "!src/**/*.module.ts",
  ],
};
