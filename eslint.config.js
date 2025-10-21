// ESLint flat config (v9+)
export default [
  {
    ignores: ['bmad/**', 'docs/**', 'node_modules/**', 'services/ws-gateway/**']
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
