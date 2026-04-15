# Rental Listings — Plan 2 : Formulaire agent CRM

**Goal :** Permettre à un agent de créer un bien à louer depuis `ListingFormPage.tsx` : toggle Vente/Location, champs conditionnels (loyer, caution, meublé, disponibilité requise), validation Zod conditionnelle, aperçu sidebar adapté au type de transaction.

**Spec :** `docs/superpowers/specs/2026-04-15-rental-listings-design.md`
**Pré-requis :** `plan-1-schema-and-types.md` appliqué (migration DB + champs sur `Property` + `formatRent` dans utils).
**Plan suivant :** `plan-3-public-display.md` (`/louer`, `RegieContactCard`, pins carte).

**Scope :** Uniquement `ListingFormPage.tsx`. Pas de modif des pages publiques (plan-3). Pas de nouveau composant (le toggle et les champs sont inlinés dans le formulaire existant).

**Hors scope :**
- Pipeline location CRM — reste vente only
- `duplicateProperty` : la copie d'un bien existant conserve son `transaction_type` (c'est logique métier, pas un cas spécial à gérer ici)
- i18n des labels — le formulaire agent reste en FR (convention projet)

---

## Tâche 4 — Toggle Vente/Location + champ dans le form + défauts

**Fichier** : `src/pages/agent/ListingFormPage.tsx` (lignes 50-98 pour schémas, 1874-1902 pour `defaultValues`, 2228+ pour le JSX)

**Changement** : Ajouter `transaction_type: 'buy' | 'rent'` au schéma `step1Schema` avec défaut `'buy'`. Ajouter le champ dans `defaultValues` du `useForm`. Ajouter un toggle binaire (pills `Vente` / `Location`) en tête du formulaire, juste au-dessus de la première section dépliable (~ligne 2228). Le toggle doit être **désactivé en mode édition** (`isEditMode`) pour respecter la règle d'immutabilité du spec (section "Règle d'immutabilité"). Passer `transaction_type` dans `buildPropertyData` (ligne 1992) pour qu'il soit persisté en DB.

**Exemple** :

```tsx
// step1Schema (vers ligne 50)
const step1Schema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères'),
  transaction_type: z.enum(['buy', 'rent']).default('buy'),
  type: z.enum(['apartment', 'house', 'villa', 'commercial', 'land']),
  // ... reste inchangé
})

// Toggle JSX (au-dessus des sections, vers ligne 2228)
const txType = form.watch('transaction_type') ?? 'buy'
<div className="flex items-center gap-2 mb-6">
  {(['buy', 'rent'] as const).map((v) => (
    <button key={v} type="button" disabled={isEditMode}
      onClick={() => form.setValue('transaction_type', v, { shouldValidate: true })}
      className={cn('h-9 px-4 rounded-lg text-sm transition-colors',
        txType === v ? 'bg-theme-active text-theme-primary font-medium'
                     : 'text-theme-secondary hover:text-theme-primary',
        isEditMode && 'opacity-50 cursor-not-allowed')}>
      {v === 'buy' ? 'Vente' : 'Location'}
    </button>
  ))}
</div>
```

**Note** : ajouter `transaction_type: values.transaction_type ?? 'buy'` dans `buildPropertyData` (ligne 1992-2022). Ajouter `transaction_type: 'buy'` dans `defaultValues` (ligne 1875). Dans les flows d'import PDF (ligne 1818) et duplication (ligne 1847), propager la valeur existante (par défaut `'buy'` pour les imports).

**Commit** : `feat(listing-form): add Vente/Location toggle with immutability in edit mode`

---

## Tâche 5 — Champs conditionnels Step 3 (loyer, caution, meublé, dispo)

**Fichier** : `src/pages/agent/ListingFormPage.tsx` (Step 3 composant lignes 579-750, `step3Schema` lignes 74-85)

**Changement** : Dans `Step3`, lire `watch('transaction_type')` pour basculer l'affichage :
1. **Label prix** : "Prix de vente" → "Loyer mensuel" (ligne 621) + placeholder `"2500"` au lieu de `"720000"` (ligne 628).
2. **Caution** : nouveau bloc (pills `1 mois` / `2 mois` / `3 mois`, défaut `3`) affiché uniquement si `'rent'`, après le bloc charges (ligne 646).
3. **Meublé** : toggle Oui/Non affiché uniquement si `'rent'` (le feature existant `'Meublé'` dans `FEATURES_CATEGORIZED` ligne 112 reste, mais ce toggle dédié alimente la colonne DB `is_furnished` — deux sources, le toggle prime).
4. **Date de disponibilité** : déjà présente ligne 724. Devient **requise** en location (ajouter `required` visuel + validation Zod).
5. **Badge résumé** (ligne 650-659) : afficher `formatRent(price)` au lieu de `formatCHF(price)` si `'rent'`. Le prix/m² reste affiché en vente uniquement.

Pour la validation Zod : remplacer `step3Schema` par un `z.discriminatedUnion('transaction_type', [...])` OU un `.superRefine` qui applique les contraintes selon `transaction_type`. `.superRefine` est plus simple à intégrer au `stepSchemas` existant (ligne 125) car il préserve la forme plate du schéma.

**Exemple** :

```tsx
// step3Schema (lignes 74-85) — bornes différentes + dispo requise en rent
const step3Schema = z.object({
  transaction_type: z.enum(['buy', 'rent']).default('buy'),
  price: z.coerce.number(),
  charges_monthly: optionalNumber,
  mandate_type: z.enum(['exclusive', 'simple', 'search']),
  features: z.array(z.string()).optional(),
  availability_date: z.string().optional(),
  deposit_months: z.coerce.number().int().min(1).max(3).optional(),
  is_furnished: z.boolean().optional(),
}).superRefine((d, ctx) => {
  if (d.transaction_type === 'rent') {
    if (d.price < 100 || d.price > 50000)
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Loyer entre CHF 100 et 50\'000/mois' })
    if (!d.availability_date)
      ctx.addIssue({ code: 'custom', path: ['availability_date'], message: 'Date requise pour une location' })
  } else {
    if (d.price < 50000)
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Minimum CHF 50\'000' })
  }
})

// Bloc caution (à insérer après le bloc charges ligne 646)
{txType === 'rent' && (
  <div>
    <FieldLabel>Caution (mois de loyer)</FieldLabel>
    <div className="flex gap-2">
      {[1, 2, 3].map((n) => (
        <button key={n} type="button"
          onClick={() => setValue('deposit_months', n, { shouldValidate: true })}
          className={cn('h-9 px-4 rounded-lg text-sm transition-colors',
            watch('deposit_months') === n ? 'bg-theme-active text-theme-primary font-medium'
                                          : 'text-theme-secondary hover:text-theme-primary')}>
          {n} mois
        </button>
      ))}
    </div>
  </div>
)}
```

**Défauts** : dans `defaultValues` (ligne 1875), ajouter `deposit_months: undefined`, `is_furnished: false`. Quand le toggle bascule vers `'rent'`, appliquer `deposit_months = 3` (défaut spec, section "Section Caractéristiques"). Persister `deposit_months` et `is_furnished` dans `buildPropertyData` (ligne 1992).

**Commit** : `feat(listing-form): conditional rent fields + Zod superRefine by transaction_type`

---

## Tâche 6 — Sidebar preview adaptée + régie externe (optionnelle)

**Fichier** : `src/pages/agent/ListingFormPage.tsx` (sidebar preview lignes 2385-2411, nouvelle section externe à insérer après Step 3)

**Changement** :
1. **Preview prix** (ligne 2409) : afficher `formatRent(price)` au lieu de `formatCHF(price)` si `transaction_type === 'rent'`. Ajouter un badge `Meublé` sous la ligne infos pièces/m² si `is_furnished === true`.
2. **Régie externe** : ajouter un bloc dépliable **en bas de Step 3** (après le mandate_type, avant les features) UNIQUEMENT si `transaction_type === 'rent'`. Le bloc contient 4 champs optionnels (`name`, `phone`, `email`, `website`) regroupés dans l'objet `external_regie`. Label du bloc : "Régie externe (optionnel — sinon, l'agence publie sous son nom)". Stocker comme objet unique dans `form` via `setValue('external_regie', {...})`, pas comme 4 champs à plat.
3. **Complétion sidebar** (lignes 2423-2429) : pas de changement — les 5 steps existants restent. La validation de complétude du Step 3 tient déjà compte du schéma via `superRefine`, donc `availability_date` manquante en rent bloquera le check.
4. **Labels actions** : aucun changement sur les boutons "Sauver brouillon" / "Publier" (ligne 2446+).

**Exemple** :

```tsx
// Sidebar preview prix (ligne 2409, à adapter)
const txType = form.watch('transaction_type') ?? 'buy'
const priceVal = Number(form.watch('price'))
{priceVal > 0 && (
  <span className="font-medium text-theme-primary">
    {txType === 'rent' ? formatRent(priceVal) : formatCHF(priceVal)}
  </span>
)}
{form.watch('is_furnished') && (
  <span className="ml-2 text-xs text-theme-muted">· Meublé</span>
)}

// Bloc régie externe (à insérer dans Step3 après mandate_type, avant features)
{txType === 'rent' && (
  <details className="rounded-xl border border-theme-border p-4">
    <summary className="text-sm font-medium text-theme-primary cursor-pointer">
      Régie externe (optionnel)
    </summary>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      <input placeholder="Nom régie"
        onChange={(e) => setValue('external_regie',
          { ...(watch('external_regie') ?? {}), name: e.target.value })} />
      {/* répéter pour phone / email / website */}
    </div>
  </details>
)}
```

**Vérifications finales** (à faire avant le commit) :
- `npm run build` passe.
- Créer un bien de test (vente) : pas de changement visible, comportement inchangé.
- Créer un bien location : toggle visible, 3 champs conditionnels apparaissent, bloc régie dépliable présent, preview sidebar affiche `CHF X/mois`.
- Éditer un bien existant : toggle verrouillé (`isEditMode === true`).
- Vérifier que `transaction_type`, `deposit_months`, `is_furnished`, `external_regie` arrivent bien en DB (requête SQL de vérif sur `properties` après création de test).

**Commit** : `feat(listing-form): sidebar preview + external regie block for rentals`

---

## Self-review checklist

- [ ] `git log --oneline -3` : 3 nouveaux commits (tâches 4, 5, 6)
- [ ] `npm run build` : 0 erreur TypeScript
- [ ] Test manuel vente : comportement identique à avant plan-2 (non-régression)
- [ ] Test manuel location : flux complet (toggle → champs conditionnels → publication → bien visible en DB avec tous les champs)
- [ ] En mode édition, toggle désactivé (inspection visuelle + tentative de clic)
- [ ] `git diff main --stat` : uniquement `src/pages/agent/ListingFormPage.tsx` modifié

---

## Après ce plan

Pusher : `git push -u origin claude/check-system-setup-bz6Xd`. Passer à `plan-3-public-display.md` : routing `/louer`, prop `context` sur `SearchPage`, `RegieContactCard`, adaptation `ListingCard`/`ListingPreviewPanel`/`ListingPage`, pins carte via `formatPricePin`, clés i18n `rental.*`.

**Rien n'est visible côté acheteur à ce stade** — les biens à louer créés via plan-2 existent en DB mais ne sont pas encore exposés sur `/louer`.
