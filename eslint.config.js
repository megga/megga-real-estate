import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.venv` : virtualenv Python local (Playwright pour Deno/pytest). Il embarque
  // ~600 fichiers JS/TS vendorisés qui font remonter des centaines d'erreurs sans
  // rapport avec le dépôt — et des règles inconnues (`internal-playwright/*`,
  // `notice/notice`) référencées dans leurs directives inline. Non suivi par git,
  // donc invisible en CI : sans cette ligne, `npm run lint` est rouge en local et
  // vert en CI, ce qui rend le garde-fou inutilisable côté dev.
  // `.claude/helpers` : scripts du HARNAIS, réécrits par l'outil à chaque mise à
  // jour — pas du code applicatif. Même famille de problème que `.venv`, en pire :
  // ces fichiers sont SUIVIS par git, donc leur directive inline
  // `/* eslint-disable @typescript-eslint/no-var-requires */` — une règle absente
  // de cette config — rendait `npm run lint` rouge en local ET en CI, pour un
  // fichier que personne du projet n'a écrit. Les linter n'apporte rien : ils ne
  // sont pas bundlés, et la prochaine mise à jour du harnais écraserait tout
  // correctif qu'on y ferait.
  globalIgnores(['dist', '.claude/worktrees', '.claude/helpers', '.venv']),
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
          // Isolation lazy Mapbox : mapbox-gl (~1,7 Mo) ne doit être importé QUE dans
          // MrhMapbox.tsx (chargé en lazy). Un import ailleurs le ré-embarque dans le
          // bundle principal → régression de poids silencieuse sur tout le CRM.
          patterns: [
            {
              group: ['mapbox-gl', 'mapbox-gl/*', 'react-map-gl', 'react-map-gl/*'],
              message: 'Importer Mapbox UNIQUEMENT via src/components/matching-recherche/MrhMapbox.tsx (isolation lazy — évite +1,7 Mo dans le bundle principal).',
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
    // Exceptions : ces fichiers SONT les points de passage autorisés (Intercom / Mapbox).
    files: ['src/lib/intercom.ts', 'src/components/matching-recherche/MrhMapbox.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // ── Garde-fou i18n — texte JSX codé en dur sur les surfaces agent ──────────
  // Options partagées. `words.exclude` neutralise les faux positifs structurels
  // (unités, séparateurs, glyphes, marques, attributions cartes) — full-match
  // ancré (generateFullMatchRegExp), donc une vraie phrase FR n'est jamais
  // exclue par sous-correspondance. ⚠ Le plugin fait `_.defaults` (merge shallow)
  // → fournir `words` REMPLACE le tableau par défaut : on re-déclare donc les
  // défauts du plugin (ponctuation/chiffres ASCII, MAJUSCULES, emoji) avant nos
  // ajouts, sinon régression.
  ...(() => {
    const i18nLiteralOptions = {
      mode: 'jsx-text-only',
      // ⚠ generateFullMatchRegExp ancre les STRINGS en `(^|\.)…$` (full-match) mais
      // renvoie les RegExp TELLES QUELLES (test partiel non ancré). Donc : défauts
      // = strings (full-match), nos ajouts = RegExp AUTO-ANCRÉES `/^…$/` — sinon une
      // classe comme [\s·]+ matcherait toute phrase contenant une espace.
      words: {
        exclude: [
          // — défauts du plugin (re-déclarés car `words` remplace, ne fusionne pas) —
          '[0-9!-/:-@[-`{-~]+',
          '[A-Z0-9_-]+', // élargi aux chiffres : acronymes/codes (C2PA, SHA-256, M365)
          /^\p{Emoji}+$/u,
          // — nœuds purement symboliques : séparateurs, glyphes, signes, ponctuation —
          /^[\s\d.,;:!?'’"“”()[\]{}%°²³+\-−–—―·•∙‧/\\|→←↔↕⇄⋮⋯▾▴▸◂◦●○×✓✗✕…›»‹«]+$/u,
          // — unités/abréviations collées à une interpolation : « 20 m² », « {x} min) »,
          //   « {lat}°N », « {rooms} p · », « · ID {id} », « {x}x (…) » —
          /^[\s(/·•|]*\d*\s*(?:m²|km²|km|CHF|min|kWh|h|x|p|j|ID|°[NSEWO])[\s().,·•/²]*$/u,
          // — suffixes « par unité » accolés à un montant : « {x}/m² », « {x}/mois » —
          /^\/(?:m²|mois|an|j|sem)$/u,
          // — marques & produits (verbatim cross-langue) + attributions cartes —
          /^MEGGA( [A-Z][A-Za-z]*)*$/, // MEGGA · MEGGA AI · MEGGA Staging · MEGGA REAL ESTATE
          /^WhatsApp$/,
          /^©\s*Mapbox([\s·•]*©\s*OpenStreetMap)?$/u,
          /^©\s*OpenStreetMap$/u,
        ],
      },
    }
    // ⚠ CES GLOBS SONT DES CHEMINS, DONC ILS MEURENT EN SILENCE À CHAQUE RENOMMAGE.
    // Mesuré le 16 août 2026 : le renommage « plus aucun Sugar » avait mis à jour
    // `scripts/lint-i18n-hardcoded.mjs` mais pas cette liste, restée sur quatre
    // dossiers `crm-sugar*` disparus. Le script ne compte que la sévérité 2 : la
    // règle ne s'appliquant plus du tout aux héritiers, 158 fichiers de composants
    // CRM sortaient de la garde sans qu'aucune porte rougisse (0 message sur les
    // 25 fichiers de `crm-dossiers`). Renommer un dossier verrouillé EXIGE de
    // corriger ici ET dans le script — la garde est `tests/unit/i18n-globs-vivants.spec.ts`.
    const lockedFamilies = [
      'src/components/crm-mobile/**/*.{ts,tsx}',
      'src/components/crm/**/*.{ts,tsx}',
      'src/components/crm-dossiers/**/*.{ts,tsx}',
      'src/components/crm-wizard/**/*.{ts,tsx}',
      'src/components/crm-identity/**/*.{ts,tsx}',
      'src/components/matching-atelier/**/*.{ts,tsx}',
      'src/components/ai-copilot/**/*.{ts,tsx}',
      'src/components/kyc-report/**/*.{ts,tsx}',
      'src/pages/agent/**/*.{ts,tsx}',
    ]
    // Surfaces différées (non encore bilingues). On les laisse en WARN — flaggées
    // mais non bloquantes — jusqu'à leur migration.
    //
    // ⚠ Trois entrées ont été RETIRÉES le 16 août 2026, leurs cibles ayant disparu
    // avec leurs fonctionnalités : `seller-portal/**` (portail vendeur retiré le
    // 26 juil.), `NetworkSugarV2Page.tsx` (réseau inter-agences retiré) et
    // `crm-sugar/ai/**` (jamais reporté sous `crm/`). Un glob différé qui ne vise
    // rien n'est pas inoffensif : il donne à lire une exemption vivante là où il
    // n'y a plus de surface.
    const deferredFamilies = [
      // MEGGA AI (Partie 1) — surface FR-only, non encore bilingue. WARN jusqu'à
      // sa migration i18n. Ce glob est plus spécifique qu'`ai-copilot/**` ci-dessus :
      // ce bloc venant après le bloc verrouillé, le dernier match l'emporte → WARN.
      'src/components/ai-copilot/panel/**/*.{ts,tsx}',
      // Refonte KYC (nouveau pager / vigie / fiche stricte / onboarding / import) —
      // surface FR-first (« FR d'abord »), i18n bilingue différée comme ci-dessus.
      // Plus spécifique que crm-dossiers/** et pages/agent/** → WARN (dernier match).
      'src/components/crm-dossiers/kyc-pager/**/*.{ts,tsx}',
      'src/components/crm-dossiers/kyc-wizard/KwStepImport.tsx',
      'src/pages/agent/KycOnboardingPage.tsx',
    ]
    return [
      {
        // VERROUILLÉES : surfaces auditées + vérifiées (i18n vagues 1→3). En ERROR :
        // toute réintroduction de texte FR en dur casse `npm run lint:i18n` (gate CI).
        files: lockedFamilies,
        plugins: { i18next },
        rules: { 'i18next/no-literal-string': ['error', i18nLiteralOptions] },
      },
      {
        files: deferredFamilies,
        plugins: { i18next },
        rules: { 'i18next/no-literal-string': ['warn', i18nLiteralOptions] },
      },
    ]
  })(),
])
