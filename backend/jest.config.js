module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
    '^.+\\.mjs$': '<rootDir>/jest.mjs-transformer.cjs',
  },
  transformIgnorePatterns: ['/node_modules/(?!@games-arena/game-engine/)'],
}
