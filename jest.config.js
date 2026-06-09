/**
 * @file jest.config.js
 * @description Configuration for Jest test suite and coverage collections.
 */

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js'
  ],
  coverageReporters: ['text', 'lcov', 'json', 'clover'],
  verbose: true
};
