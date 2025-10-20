// ESLint flat config (v9+)
export default [
  {
    ignores: ['bmad/**', 'docs/**', 'node_modules/**']
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {}
  }
];

