// @ts-check
import eslintConfigPrettier from 'eslint-config-prettier/flat';

// Turns off ESLint rules that would conflict with Prettier. Formatting itself
// is owned by Prettier (`pnpm format`), not ESLint — this is just the
// compatibility layer, shared by every package. Append it last.
/** @type {import('eslint').Linter.Config[]} */
export default [eslintConfigPrettier];
