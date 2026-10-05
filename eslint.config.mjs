// @ts-check
import prettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['app/shared/api/generated/**', 'openapi/**'],
  },
  {
    files: ['app/features/*/**'],
    rules: {
      // Regla de dependencias (D-P17): una feature no importa a otra.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/features/*/**', '../../*/**'],
              message: 'Una feature no importa a otra; mueve lo común a ~/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      'vue/no-v-html': 'error',
    },
  },
  prettier,
)
