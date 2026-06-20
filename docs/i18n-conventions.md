# Conventions i18n — CRM MEGGA (FR/EN)

> Source de vérité pour rendre le CRM bilingue. À lire avant d'internationaliser
> une surface. Établi par le pilote « Aujourd'hui » (Phase 1). Le contrat v1 est
> **FR ↔ EN** ; DE/IT dégradent proprement vers EN (jamais de clé brute affichée).

## 1. L'infra est déjà là

`src/i18n/index.ts` : `react-i18next`, FR bundlé en synchrone (fallback + défaut),
DE/EN/IT lazy-loadés. 15 namespaces. Détection : `localStorage['megga-language']`
puis navigateur. Le changement de langue déclenche `LanguageChangeOverlay`.

**On ne touche pas à `i18n/index.ts`** sauf pour ajouter un namespace (rare —
préférer réutiliser les 15 existants).

## 2. Namespaces

Réutiliser le namespace du domaine. Ne pas en créer un par écran.

| Domaine | Namespace |
|---|---|
| Cockpit « Aujourd'hui », dashboard, focus | `dashboard` |
| Contacts | `contacts` |
| Pipeline / deals | `pipeline` |
| Biens / listings | `listings` |
| Matching | `matching` |
| KYC | `kyc` |
| Calendrier | `calendar` |
| Chat / messages | `messages` |
| Réglages | `settings` |
| Chrome partagé (nav, actions génériques, états) | `common` |

## 3. Nommage des clés

`namespace:domaine.zone.intention` en camelCase. Exemples :
`dashboard:today.cockpit.greeting`, `dashboard:today.focus.queueDone`,
`common:actions.viewAll`, `common:nav.pipeline`.

- **Réutiliser `common`** pour tout ce qui est transverse : `common:actions.*`
  (save/cancel/viewAll…), `common:nav.*` (labels de navigation),
  `common:language.*` (fr/en/de/it). Ne pas redéfinir ce qui existe déjà.
- Un libellé partagé par plusieurs écrans → `common`, pas dupliqué par surface.

## 4. Composants React

```tsx
import { useTranslation } from 'react-i18next'

export function AgendaTile() {
  const { t } = useTranslation('dashboard')
  return <h3>{t('today.agenda.title')}</h3>
}
```

Interpolation et pluriels via i18next (jamais de concaténation manuelle de
fragments traduits) :

```tsx
t('today.cockpit.greeting', { name })          // "Bonjour {{name}}" / "Hello {{name}}"
t('today.focus.processed', { count })          // clés _one / _other
```

```json
{ "processed_one": "{{count}} traitée", "processed_other": "{{count}} traitées" }
```

## 5. Modules `.ts` non-composants (le cas dur)

Un module pur (logique, données, helpers) **ne peut pas** appeler le hook
`useTranslation`. Deux patrons, dans l'ordre de préférence :

**A. Injection du traducteur** — pour les fonctions qui produisent du texte
d'affichage (ex. `focusScore.ts::buildReason`). On passe `t` en paramètre ; le
hook appelant fournit le vrai `t`, les tests fournissent une instance i18next FR
autonome.

```ts
type TFunc = (key: string, params?: Record<string, unknown>) => string
export function buildReason(input: Input, now: number, t: TFunc, cfg = DEFAULTS): string {
  return t('today.reasons.matchStrong', { score: input.matchScore })
}
```

```ts
// test : instance FR autonome, 0 dépendance au navigateur
import i18next from 'i18next'
import frDashboard from '@/i18n/locales/fr/dashboard.json'
const i = i18next.createInstance()
i.init({ lng: 'fr', resources: { fr: { dashboard: frDashboard } }, initImmediate: false })
const t = i.getFixedT('fr', 'dashboard')
buildReason(input, NOW, t)   // les assertions FR existantes passent
```

> Les clés FR doivent **reproduire à l'identique** les chaînes que les tests
> existants asservissent (`'Match fort (87)'` → `"Match fort ({{score}})"`).

**B. Clés stables + traduction chez le consommateur** — pour les maps de
libellés / codes (ex. `FOCUS_TYPE.labelKey`). Le module expose une **clé**, le
composant la traduit.

```ts
export const FOCUS_TYPE = { call: { labelKey: 'today.focusTypes.call', /* … */ } }
```
```tsx
t(ty.labelKey, { name: firstName })
```

**Valeurs stockées en base** (stades pipeline, statuts KYC, catégories) : la
**valeur reste un code stable** ; on ne traduit QUE l'affichage via une map
`code → clé`.

## 6. Formats & dates

- `CHF 720'000` et `120 m²` : **inchangés** quelle que soit la langue (marché
  suisse, pas la langue). `formatCHF` reste tel quel.
- Dates écrites en toutes lettres : **localisées** via i18n. `formatTodayHeader`
  et `formatRelativeDate` (`src/lib/utils.ts`) lisent `i18n.language` et
  choisissent la locale date-fns. Les formats numériques courts (`16.03.2026`)
  restent suisses.
- `toLocaleTimeString` / `toLocaleDateString` : passer la locale dérivée de
  `i18n.language` (`fr-CH` / `en-CH`), pas un littéral codé en dur.

## 7. On ne traduit JAMAIS

- La marque **MEGGA**, les noms propres, les codes/IDs.
- Les **valeurs DB** (on traduit le libellé, pas la donnée).
- Les **données de démo** (faux noms, fausses adresses) : libellés structurels
  oui, contenu fictif (personas) non.
- La donnée Flatfox / `market_listings` (source externe).
- Les sorties de **MEGGA AI** (contenu généré, géré ailleurs).

## 8. Le sélecteur de langue

Il **existe** (`PreferencesSection`, carte « Région & langue »). Le `onChange`
appelle `i18n.changeLanguage(v)` (effet live + cache localStorage via le
détecteur) et persiste la préférence serveur. Les noms de langue viennent de
`common:language.*`.

## 9. Outillage & garde-fous

```bash
npm run i18n:scan         # chaînes FR codées en dur restantes (chiffrage / vérif)
npm run i18n:scan -- --list src/components/crm-sugar/today   # détail d'une surface
npm run i18n:parity       # parité FR↔EN (clés manquantes / orphelines)
npm run i18n:parity:ci    # idem, exit 1 si dérive (gate CI)
```

- ESLint `i18next/no-literal-string` est en **warn** sur les dossiers CRM ; il
  passera en **error** quand une surface est migrée (Phase 4) pour empêcher la
  régression.
- Une surface est « propre » quand `i18n:scan` retourne 0 dessus (hors noms
  propres de démo) et que `i18n:parity` est vert.

## 10. Workflow d'une surface (Phase 2)

1. `npm run i18n:scan -- --list <dir>` → inventaire des chaînes.
2. Extraire vers le namespace du domaine, clés `domaine.zone.intention`.
3. Traduire EN (anglais CRM immobilier suisse, sobre). DE/IT = repli EN.
4. Câbler `useTranslation` + `t()` ; modules `.ts` → §5.
5. Vérifier : `tsc -b`, `vitest`, `i18n:scan` = 0, `i18n:parity` vert, QA FR+EN.
6. Passer la règle ESLint du dossier en `error`.
