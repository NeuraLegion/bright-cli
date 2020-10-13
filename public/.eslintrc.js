module.exports = {
  root: true,
  env: {
    es6: true,
    node: false
  },
  plugins: [
    '@angular-eslint',
    '@typescript-eslint/tslint',
    'eslint-plugin-import'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@angular-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    project: './tsconfig.json',
    sourceType: 'module',
    tsconfigRootDir: '.'
  },
  reportUnusedDisableDirectives: true,
  rules: {
    '@angular-eslint/component-max-inline-declarations': [
      'error',
      {
        animations: 1,
        styles: 1,
        template: 1
      }
    ],
    '@angular-eslint/no-forward-ref': 'error',
    '@angular-eslint/no-input-prefix': [
      'error',
      {
        prefixes: ['can', 'is', 'should']
      }
    ],
    '@angular-eslint/no-pipe-impure': 'error',
    '@angular-eslint/no-queries-metadata-property': 'error',
    '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    '@angular-eslint/prefer-output-readonly': 'error',
    '@angular-eslint/use-component-selector': 'error',
    '@angular-eslint/use-component-view-encapsulation': 'error',
    '@angular-eslint/use-pipe-decorator': 'error',

    '@typescript-eslint/brace-style': 'error',
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      {
        accessibility: 'explicit',
        overrides: {
          accessors: 'no-public',
          constructors: 'no-public'
        }
      }
    ],
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false
        }
      }
    ],
    '@typescript-eslint/member-ordering': 'off',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase'],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid'
      },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
      {
        selector: 'property',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase']
      },
      // https://github.com/typescript-eslint/typescript-eslint/issues/1510#issuecomment-580593245
      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow'
      }
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-for-in-array': 'error',
    // https://github.com/typescript-eslint/typescript-eslint/issues/491
    '@typescript-eslint/no-invalid-this': 'off',
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-shadow': [
      'error',
      {
        hoist: 'all'
      }
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/no-use-before-define': 'error',
    '@typescript-eslint/quotes': [
      'error',
      'single',
      {
        avoidEscape: true,
        allowTemplateLiterals: true
      }
    ],
    '@typescript-eslint/semi': ['error', 'always'],
    '@typescript-eslint/type-annotation-spacing': 'error',
    '@typescript-eslint/unbound-method': 'off',
    '@typescript-eslint/unified-signatures': 'error',

    'array-bracket-spacing': ['error', 'never'],
    'arrow-body-style': 'error',
    'arrow-parens': ['error', 'as-needed'],
    'block-spacing': 'error',
    'brace-style': 'off',
    'comma-dangle': 'error',
    'computed-property-spacing': 'error',
    'curly': 'error',
    'dot-notation': 'error',
    'eol-last': 'error',
    'eqeqeq': ['error', 'smart'],
    'func-call-spacing': 'error',
    'guard-for-in': 'error',
    'max-classes-per-file': 'off',
    'max-len': [
      'error',
      {
        code: 120
      }
    ],
    'new-parens': 'error',
    'no-bitwise': 'error',
    'no-caller': 'error',
    'no-cond-assign': 'error',
    'no-console': [
      'error',
      {
        allow: ['error', 'warn']
      }
    ],
    'no-debugger': 'error',
    'no-dupe-class-members': 'error',
    'no-duplicate-imports': 'error',
    'no-else-return': 'error',
    'no-eval': 'error',
    'no-fallthrough': 'error',
    'no-invalid-this': 'off',
    'no-multiple-empty-lines': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-param-reassign': 'error',
    'no-prototype-builtins': 'off',
    'no-restricted-imports': [
      'error',
      'rxjs/Rx',
      'rxjs/internal',
      'rxjs/internal-compatibility',
      '@angular/material/snack-bar'
    ],
    'no-restricted-syntax': ['error', 'ForInStatement'],
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    'no-undef-init': 'error',
    'no-underscore-dangle': 'error',
    'no-unsafe-finally': 'error',
    'no-unused-labels': 'error',
    'no-unused-vars': 'off',
    'no-useless-escape': 'error',
    'no-var': 'error',
    'object-curly-spacing': ['error', 'always'],
    'object-shorthand': 'error',
    'one-var': ['error', 'never'],
    'padding-line-between-statements': 'off',
    'prefer-arrow-callback': 'error',
    'prefer-const': 'error',
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'quote-props': ['error', 'as-needed'],
    'radix': 'error',
    'space-before-blocks': ['error', 'always'],
    'space-before-function-paren': [
      'error',
      {
        anonymous: 'never',
        asyncArrow: 'always',
        named: 'never'
      }
    ],
    'space-in-parens': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error'
  },
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@angular-eslint/template'],
      rules: {
        'import/no-deprecated': 'error',

        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/indent': [
          'error',
          2,
          {
            CallExpression: {
              arguments: 'first'
            },
            FunctionDeclaration: {
              parameters: 'first'
            },
            FunctionExpression: {
              parameters: 'first'
            },
            SwitchCase: 1
          }
        ],
        '@typescript-eslint/no-misused-promises': [
          'error',
          {
            checksVoidReturn: false
          }
        ],
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
        '@typescript-eslint/prefer-for-of': 'off',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-includes': 'error',
        '@typescript-eslint/prefer-regexp-exec': 'error',
        '@typescript-eslint/prefer-string-starts-ends-with': 'error',
        '@typescript-eslint/restrict-plus-operands': 'error',

        // rules that are not yet available in angular-eslint
        '@typescript-eslint/tslint/config': [
          'error',
          {
            rulesDirectory: ['codelyzer'],
            rules: {
              'contextual-decorator': true,
              'import-destructuring-spacing': true,
              'no-attribute-decorator': true,
              'no-unused-css': true,
              'no-restricted-globals': [
                true,
                'window',
                'document',
                'localStorage',
                'sessionStorage'
              ],
              'whitespace': [
                true,
                'check-branch',
                'check-decl',
                'check-module',
                'check-operator',
                'check-preblock',
                'check-rest-spread',
                'check-separator',
                'check-type',
                'check-type-operator'
              ],
              'template-accessibility-alt-text': true,
              'template-no-any': true,
              'template-use-track-by-function': true
            }
          }
        ]
      }
    },
    {
      files: ['*.component.html'],
      extends: ['plugin:@angular-eslint/template/recommended'],
      rules: {
        'max-len': 'off'
      }
    }
  ],
  ignorePatterns: ['.eslintrc.js']
};
