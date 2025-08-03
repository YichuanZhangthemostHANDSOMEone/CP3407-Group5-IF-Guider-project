module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1'
  }
};
