import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

const STORAGE = 'Tárhelyhez csak a src/storage/ nyúlhat, az app többi része a store-on át ment (lásd CLAUDE.md).';
const HTML = 'Tartalmat ne szúrj be HTML-ként; használd a h() segédet vagy a textContent-et (lásd CLAUDE.md).';

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', '.sprite-preview/']),
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      'no-alert': 'error',
      'no-restricted-globals': [
        'error',
        ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({ name, message: STORAGE })),
      ],
      'no-restricted-properties': [
        'error',
        ...['localStorage', 'sessionStorage', 'indexedDB'].map((property) => ({ property, message: STORAGE })),
        { object: 'document', property: 'cookie', message: STORAGE },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]', message: HTML },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: HTML },
      ],
    },
  },
  {
    // Az egyetlen hely, ahol a tárhely-API-k használhatók.
    files: ['src/storage/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['scripts/**', '*.config.js', 'src/**/*.test.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);
