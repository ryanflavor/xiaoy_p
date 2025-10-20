module.exports = {
  root: true,
  env: { node: true, es2023: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: ['bmad/', 'docs/', 'node_modules/'],
  rules: {}
};

