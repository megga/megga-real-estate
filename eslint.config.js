import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude/worktrees']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Frontière LPD : le SDK Intercom ne s'importe QUE dans src/lib/intercom.ts
      // (point de passage unique → no-op guard + allowlist anti-fuite). Ailleurs = erreur.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@intercom/messenger-js-sdk',
              message: 'Importer Intercom UNIQUEMENT via src/lib/intercom.ts (frontière LPD + no-op guard).',
            },
          ],
        },
      ],
      // Convention TS standard : un préfixe `_` marque l'arg/var intentionnel-
      // lement non utilisé (e.g. callback signature, deps array contractuelle).
      // On accepte le pattern au lieu de râler dessus.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Exception : le wrapper EST le point de passage autorisé vers le SDK Intercom.
    files: ['src/lib/intercom.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Garde-fou i18n — surfaces CRM agent. En WARN : signale le texte JSX codé en
    // dur restant (chantier Phase 2) sans casser le build. Une fois une surface
    // migrée + vérifiée (i18n:scan = 0), la passer en 'error' pour verrouiller
    // (Phase 4). Mode jsx-text-only = uniquement le texte visible entre balises.
    files: [
      'src/components/crm-sugar/**/*.{ts,tsx}',
      'src/components/crm-sugar-v3/**/*.{ts,tsx}',
      'src/components/crm-sugar-wizard/**/*.{ts,tsx}',
      'src/components/matching-atelier/**/*.{ts,tsx}',
      'src/components/seller-portal/**/*.{ts,tsx}',
      'src/components/onboarding-sugar/**/*.{ts,tsx}',
      'src/components/premier-jour-sugar/**/*.{ts,tsx}',
      'src/components/ai-copilot/**/*.{ts,tsx}',
      'src/components/kyc-report/**/*.{ts,tsx}',
      'src/pages/agent/**/*.{ts,tsx}',
    ],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['warn', { mode: 'jsx-text-only' }],
    },
  },
])
