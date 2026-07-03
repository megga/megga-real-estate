# Patch 12 — Quick-wins qualité & perf (faible risque, fort ROI)

## A) Supprimer ~9 dépendances mortes (Q4, S20) — `package.json`
0 import dans `src/` (vérifié) : `react-use`, `@giphy/react-components`, `@giphy/js-fetch-api`, `langsmith`,
`motion` (doublon de `framer-motion`), `@emoji-mart/data`, `@emoji-mart/react`, `emoji-mart`, `cmdk`.
```bash
npm remove react-use @giphy/react-components @giphy/js-fetch-api langsmith motion \
  @emoji-mart/data @emoji-mart/react emoji-mart cmdk
```
> `@stripe/stripe-js` : 0 usage front (Stripe est server-side) — confirmer puis retirer.
> `@deepgram/sdk` : les hits sont dans `supabase/functions/*` (Deno/esm.sh), pas ce package npm — confirmer avant retrait.
Réduit aussi une partie des 48 vulns `npm audit`. Ensuite : `npm audit fix` (revue), traiter `protobufjs` (critique).

## B) Supprimer les fichiers morts (Q6) — 0 référence
```bash
git rm src/pages/agent/NetworkSugarV2Page.tsx            # 2314 LOC, route neutralisée (App.tsx:543-544)
git rm src/components/crm-sugar/network/data.ts          # data-file du fichier mort
git rm src/components/crm/ContactTimeline.tsx            # + dossier crm/ (vide ensuite)
git rm src/components/crm-sugar/SugarContactDetail.tsx   # doublon mort (routé = ContactDetailSugarV3Page)
git rm src/components/crm-sugar/contacts/ContactsDetailPane.tsx
```
> Vérifier `tsc -b` + `npm run build` après suppression (les routes `/network`/`/reseau` sont déjà des `Navigate`).

## C) Rendre le lint bloquant (Q2) — `.github/workflows/deploy.yml:60`
Les 46 erreurs tiennent sur 5 règles / ~12 fichiers, aucune de type :
1. `npx eslint . --fix` → règle `no-irregular-whitespace` (3) auto-corrigée.
2. `react-refresh/only-export-components` (27) : déplacer les exports non-composant (constantes/hooks) hors des
   fichiers `primitives.tsx`/`atoms.tsx`/`*Shared.tsx`/`vitrineKit.tsx` vers un `.ts` voisin.
3. `react-hooks/static-components` (13, tous dans `SwissIdCardSkeleton.tsx`) : sortir les sous-composants du corps.
4. `react-hooks/refs` (2) : `AgencySection.tsx:1119`, `atoms.tsx:1074` — vraie revue (lecture/écriture ref au render).
5. Puis retirer `|| true` : `run: npm run lint`.

## D) Perf ciblée
- **P9 (Kanban)** `SugarStageColumn.tsx:118-129` : `useCallback` sur `onClick`/`onDragStart` (dispatch par id, sans
  wrapper inline) + `memo()` sur `SugarStageColumn` → réactive le `memo` déjà écrit de `SugarDealCard`.
- **P8 (`useReminders.ts:362,368`)** : `count:'exact'` → `count:'estimated'`, et regrouper la boucle 3N en une
  agrégation unique / RPC.
- **P10 (`useProperties.ts:187-190`)** : remplacer l'invalidation des listes entières par un `setQueryData`
  optimiste sur la ligne éditée (modèle `useKyc`/`useOffers`).
- **B8 (`ListingFormPage.tsx:3020`)** : mémoïser l'`URL.createObjectURL` + `revokeObjectURL` au cleanup (fuite blob).

## E) Bugs restants (salve bugs) — voir audit §4
`B2` (ordre photos), `B3`/`B4` (matching non atomique), `B6` (flash overlay), `B7` (contact orphelin),
`B9`/`B10` (gardes `NaN`/`toFixed`). À traiter en PR dédiées avec tests.

## Test
- `tsc -b` + `npm run build` OK après suppressions.
- `npm run lint` → 0 erreur (après C), puis CI bloquante.
- `npm audit` : nombre de vulns réduit.
