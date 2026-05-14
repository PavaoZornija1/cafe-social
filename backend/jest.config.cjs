/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  /**
   * Coverage is scoped to libraries and partner/staff services we unit-test with mocks.
   * Full Nest surface (controllers, modules, gateways) is excluded so thresholds stay
   * meaningful; add paths here as you add specs for more services.
   */
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!**/*.spec.ts",
    "src/auth/user-email.util.ts",
    "src/owner/partner-access.constants.ts",
    "src/staff/staff-redemptions.service.ts",
    "src/owner/owner-campaign.service.ts",
    "src/owner/partner-org-access.service.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 78,
      functions: 80,
      lines: 80,
    },
  },
};
