// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from './prettier.js';

// Base for plain TS/Node packages (e.g. the API). The Nuxt app uses only the
// `prettier` preset instead, since @nuxt/eslint supplies its own typescript-eslint.
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  ...prettier,
);
