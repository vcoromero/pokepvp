/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!**/__tests__/**',
    '!src/domain/ports/catalog.port.js',
    '!src/infrastructure/clients/pokeapi.adapter.js',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 44, // app error middleware branches not hit by current routes (controller handles errors)
      functions: 80,
      lines: 80,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
};
