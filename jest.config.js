module.exports = {
  roots: ['<rootDir>'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  testPathIgnorePatterns: ['<rootDir>[/\\\\](node_modules)[/\\\\]'],
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(ts|tsx)$'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  setupFiles: ['./jest-setup.ts'],
  setupFilesAfterEnv: ['./jest-setup-after-env.ts'],
};
