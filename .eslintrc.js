module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'simple-import-sort'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended',
  ],
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    "@typescript-eslint/ban-types": [
      "error", {
        "types": {
          "String": {
            "message": "Use string instead",
            "fixWith": "string"
          },

          "{}": {
            "message": "Use object instead",
            "fixWith": "object"
          },
        },
        extendDefaults: false
      }
    ]
  },
}
