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
    '!src/domain/ports/*.repository.js',
    '!src/domain/entities/*.entity.js',
    '!src/infrastructure/clients/pokeapi.adapter.js',
    '!src/infrastructure/persistence/mongodb/adapters/*.mongo.repository.js',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 44,
      functions: 80,
      lines: 80,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
};
