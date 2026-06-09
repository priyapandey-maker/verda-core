/**
 * @file eslint.config.js
 * @description Strict ESLint configuration for the Verda project (CommonJS Node environment).
 */

module.exports = [
  // Node.js files configuration
  {
    files: ['src/**/*.js', 'eslint.config.js', 'jest.config.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js Globals
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        // Jest Test Globals
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          'varsIgnorePattern': '^_',
          'argsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_'
        }
      ],
      'no-undef': 'error',
      'no-console': 'error',
      'complexity': ['error', 10],
      'consistent-return': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }]
    }
  },
  // Browser client-side JS configuration
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script', // Vanilla JS loaded via script tags
      globals: {
        // Browser Globals
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        // Third-party Libraries & App Globals
        Chart: 'readonly',
        jspdf: 'readonly',
        html2canvas: 'readonly',
        VerdaAPI: 'writable',
        VerdaDOM: 'writable',
        module: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          'varsIgnorePattern': '^_',
          'argsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_'
        }
      ],
      'no-undef': 'error',
      'no-console': 'off', // Browser files logging/debugging allowed
      'complexity': ['error', 10], // Strictly limit complexity
      'consistent-return': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }]
    }
  }
];
