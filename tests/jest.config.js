/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: '../jest.config.js',
  testMatch: ['<rootDir>/**/*.(spec|test).[jt]s?(x)'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};
