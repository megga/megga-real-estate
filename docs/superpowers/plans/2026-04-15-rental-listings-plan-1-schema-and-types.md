# Rental Listings — Plan 1 : Schéma DB + types + util

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer les fondations DB/types pour la location : colonnes `transaction_type`, `deposit_months`, `is_furnished`, `external_regie` sur `properties` et `market_listings`, mise à jour du type `Property`, et util `formatRent` pour afficher les loyers.

**Architecture:** Une migration SQL idempotente. Ajout de 4 colonnes à `properties` (dont `transaction_type`) et 3 colonnes à `market_listings` (`transaction_type` y existe déjà depuis 2026-03-24). Utilise le pattern `DO $$` avec checks d'existence. La colonne `price` est réutilisée aussi bien pour la vente que pour la location (convention déjà en place sur market_listings). Aucune migration de données nécessaire : les biens existants obtiennent `transaction_type = 'buy'` par défaut.

**Tech Stack:** Supabase (Postgres 15), TypeScript, Vite. Pas de test runner — vérification via `npm run build` + inspection manuelle.

**Spec:** `docs/superpowers/specs/2026-04-15-rental-listings-design.md`

**Plans suivants :** `plan-2-agent-crm.md` (formulaire de création), `plan-3-public-display.md` (pages publiques + i18n).

---

## Task 1 : Migration SQL — ajouts rental sur properties + market_listings

**Fichiers :**
- Créer : `supabase/migrations/20260415_001_rental_support.sql`

- [ ] **Step 1 : Créer le fichier de migration**

Écrire `supabase/migrations/20260415_001_rental_support.sql` avec ce contenu exact :

```sql
-- ============================================================================
-- Rental listings support: add transaction_type + rental-specific columns
-- Spec: docs/superpowers/specs/2026-04-15-rental-listings-design.md
-- Created: 2026-04-15
--
-- Changes:
--   properties:      +transaction_type, +deposit_months, +is_furnished, +external_regie
--   market_listings: +deposit_months, +is_furnished, +external_regie
--                    (transaction_type already exists since 20260324_001)
--
-- The price column is reused for both sale price and monthly rent.
-- transaction_type disambiguates the interpretation at display time.
-- Idempotent: safe to run multiple times.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- properties: add rental columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN

    -- transaction_type: 'buy' (default) or 'rent'
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'transaction_type'
    ) THEN
      ALTER TABLE properties
        ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'buy';

      ALTER TABLE properties
        ADD CONSTRAINT properties_transaction_type_check
        CHECK (transaction_type IN ('buy', 'rent'));

      RAISE NOTICE 'properties: transaction_type added (default buy)';
    ELSE
      RAISE NOTICE 'properties: transaction_type already exists, skipping';
    END IF;

    -- deposit_months: 1, 2 or 3 (rental only, NULL for sale)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'deposit_months'
    ) THEN
      ALTER TABLE properties ADD COLUMN deposit_months SMALLINT;
      RAISE NOTICE 'properties: deposit_months added';
    ELSE
      RAISE NOTICE 'properties: deposit_months already exists, skipping';
    END IF;

    -- is_furnished: rental only, defaults to false
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'is_furnished'
    ) THEN
      ALTER TABLE properties ADD COLUMN is_furnished BOOLEAN DEFAULT false;
      RAISE NOTICE 'properties: is_furnished added';
    ELSE
      RAISE NOTICE 'properties: is_furnished already exists, skipping';
    END IF;

    -- external_regie: optional override for rental contact info
    -- Shape: {"name": "...", "phone": "...", "email": "...", "website": "..."}
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'external_regie'
    ) THEN
      ALTER TABLE properties ADD COLUMN external_regie JSONB;
      RAISE NOTICE 'properties: external_regie added';
    ELSE
      RAISE NOTICE 'properties: external_regie already exists, skipping';
    END IF;

    -- Index on transaction_type for active listings (public search filtering)
    CREATE INDEX IF NOT EXISTS idx_properties_transaction_type
      ON properties(transaction_type)
      WHERE status = 'active';

  ELSE
    RAISE NOTICE 'properties: table not found, skipping';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- market_listings: add rental columns (transaction_type already exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_listings') THEN

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'market_listings' AND column_name = 'deposit_months'
    ) THEN
      ALTER TABLE market_listings ADD COLUMN deposit_months SMALLINT;
      RAISE NOTICE 'market_listings: deposit_months added';
    ELSE
      RAISE NOTICE 'market_listings: deposit_months already exists, skipping';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'market_listings' AND column_name = 'is_furnished'
    ) THEN
      ALTER TABLE market_listings ADD COLUMN is_furnished BOOLEAN DEFAULT false;
      RAISE NOTICE 'market_listings: is_furnished added';
    ELSE
      RAISE NOTICE 'market_listings: is_furnished already exists, skipping';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'market_listings' AND column_name = 'external_regie'
    ) THEN
      ALTER TABLE market_listings ADD COLUMN external_regie JSONB;
      RAISE NOTICE 'market_listings: external_regie added';
    ELSE
      RAISE NOTICE 'market_listings: external_regie already exists, skipping';
    END IF;

  ELSE
    RAISE NOTICE 'market_listings: table not found, skipping';
  END IF;
END $$;

COMMIT;
```

- [ ] **Step 2 : Vérifier la syntaxe SQL localement (dry-run)**

Commande :
```bash
# Vérifier qu'il n'y a pas de faute de frappe évidente
grep -c "RAISE NOTICE" supabase/migrations/20260415_001_rental_support.sql
```

Attendu : `10` (10 RAISE NOTICE, un par sous-cas).

- [ ] **Step 3 : Appliquer la migration en dev**

L'utilisateur Julien applique les migrations via Supabase Studio SQL editor (copier-coller le fichier) ou via CLI `supabase db push` s'il a la CLI configurée.

**Ne PAS appliquer automatiquement depuis Claude Code.** Signaler à l'utilisateur :

> "Migration prête. Applique `20260415_001_rental_support.sql` via le SQL editor Supabase (projet `eayczugyrvmtqnnmvjod`), ou avec `supabase db push` si tu as la CLI. La migration est idempotente et ne touche aucune donnée existante."

- [ ] **Step 4 : Vérifier l'application via requête**

Après que l'utilisateur a confirmé l'application, demander :

> "Colle le résultat de cette requête dans le SQL editor pour confirmer :
> ```sql
> SELECT column_name, data_type, column_default
> FROM information_schema.columns
> WHERE table_name = 'properties'
>   AND column_name IN ('transaction_type', 'deposit_months', 'is_furnished', 'external_regie')
> ORDER BY column_name;
> ```"

Attendu : 4 lignes, `transaction_type` avec default `'buy'`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260415_001_rental_support.sql
git commit -m "feat(db): add rental support columns to properties + market_listings

- properties: +transaction_type (default 'buy'), +deposit_months, +is_furnished, +external_regie
- market_listings: +deposit_months, +is_furnished, +external_regie
- transaction_type CHECK constraint ('buy' | 'rent')
- Index on properties(transaction_type) WHERE status='active'

Spec: docs/superpowers/specs/2026-04-15-rental-listings-design.md"
```

---

## Task 2 : Mise à jour du type Property

**Fichiers :**
- Modifier : `src/types/property.ts`

**Contexte :** Le fichier définit actuellement `Property` avec 40+ champs. On ajoute 4 champs facultatifs pour le support rental. Pas de nouveau fichier ; le type `Listing` reste dans le même fichier (convention existante).

- [ ] **Step 1 : Lire le fichier actuel**

Lire `src/types/property.ts` pour vérifier la structure (doit correspondre au rapport Explore : ~50 lignes, interface `Property` de ligne ~4 à ~40 environ).

- [ ] **Step 2 : Ajouter les champs rental à l'interface `Property`**

Dans `src/types/property.ts`, ajouter les 4 champs **juste après la ligne `mandate_type?: string`** (autour de la ligne 20) :

Remplacer :
```typescript
  charges_monthly?: number
  mandate_type?: string
  condition?: string
```

Par :
```typescript
  charges_monthly?: number
  mandate_type?: string
  condition?: string
  // Rental support (2026-04-15)
  transaction_type?: 'buy' | 'rent'        // default 'buy' in DB, undefined = buy for backward compat in TS
  deposit_months?: number | null            // 1, 2 or 3 (rental only)
  is_furnished?: boolean                    // rental only
  external_regie?: {                        // optional contact override for rentals
    name: string
    phone: string
    email: string
    website?: string
  } | null
```

**Note :** `transaction_type` est optionnel côté TypeScript pour ne pas casser les ~200 lignes de code existantes qui créent des objets `Partial<Property>` sans ce champ. La DB garantit une valeur par défaut `'buy'`.

- [ ] **Step 3 : Vérifier que le build passe**

```bash
npm run build
```

Attendu : build réussit sans erreur TypeScript.

Si erreur du type "Property X is missing transaction_type" : c'est parce qu'un autre fichier typait strictement. Remettre `transaction_type?:` (avec point d'interrogation) — il doit être optionnel.

- [ ] **Step 4 : Commit**

```bash
git add src/types/property.ts
git commit -m "types: add rental fields to Property interface

- transaction_type, deposit_months, is_furnished, external_regie
- All optional to avoid breaking existing code that uses Partial<Property>

Spec: docs/superpowers/specs/2026-04-15-rental-listings-design.md"
```

---

## Task 3 : Fonction utilitaire `formatRent`

**Fichiers :**
- Modifier : `src/lib/utils.ts`

**Contexte :** `formatCHF` existe déjà et retourne `"CHF 720'000"`. On ajoute `formatRent` qui retourne `"CHF 2'500/mois"` en réutilisant `formatCHF`. YAGNI : pas d'options, pas de pluriel, pas de i18n côté util (les textes i18n sont gérés dans les composants).

- [ ] **Step 1 : Ajouter la fonction à la fin de `src/lib/utils.ts`**

Ajouter ce bloc **à la fin** du fichier `src/lib/utils.ts` (après `formatSurface`, ligne 49) :

```typescript

/**
 * Format monthly rent in CHF
 * Example: 2500 → "CHF 2'500/mois"
 */
export function formatRent(amount: number): string {
  return `${formatCHF(amount)}/mois`
}

/**
 * Format price pin for map markers.
 * Sale: abbreviated (2.5M, 530K)
 * Rent: abbreviated with /mois suffix (2.5K/mois, 530/mois)
 */
export function formatPricePin(
  price: number,
  transactionType: 'buy' | 'rent' = 'buy'
): string {
  if (transactionType === 'rent') {
    // Rent: no M abbreviation (rents rarely exceed 20K/mois)
    if (price >= 1000) {
      const k = price / 1000
      // 1 decimal if not a round thousand, else none: 2500 → "2.5K/mois", 3000 → "3K/mois"
      const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)
      return `${formatted}K/mois`
    }
    return `${price}/mois`
  }

  // Sale: existing abbreviation logic (M for millions, K for thousands)
  if (price >= 1_000_000) {
    const m = price / 1_000_000
    const formatted = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)
    return `${formatted}M`
  }
  if (price >= 1000) {
    const k = price / 1000
    return `${k.toFixed(0)}K`
  }
  return String(price)
}
```

**Note sur `formatPricePin`** : le rapport Explore a confirmé que cette fonction n'existe pas encore dans `utils.ts`. Elle sera utilisée par les pins carte (MapView) dans le plan 3. On la crée ici pour que les 3 plans soient indépendants.

- [ ] **Step 2 : Vérifier que le build passe**

```bash
npm run build
```

Attendu : build réussit.

- [ ] **Step 3 : Vérifier manuellement le format (smoke test inline)**

Créer un fichier temporaire `/tmp/test-format.mjs` :

```javascript
// Quick smoke test — non persisté
const formatCHF = (amount) => {
  const formatted = amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  return `CHF ${formatted}`
}
const formatRent = (amount) => `${formatCHF(amount)}/mois`

console.log(formatRent(2500))    // expect: CHF 2'500/mois
console.log(formatRent(720000))  // expect: CHF 720'000/mois (abusé mais correct)
console.log(formatRent(3200))    // expect: CHF 3'200/mois
```

Lancer :
```bash
node /tmp/test-format.mjs
```

Attendu :
```
CHF 2'500/mois
CHF 720'000/mois
CHF 3'200/mois
```

Puis supprimer le fichier temp :
```bash
rm /tmp/test-format.mjs
```

- [ ] **Step 4 : Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add formatRent and formatPricePin utilities

- formatRent(amount) → 'CHF 2\\'500/mois'
- formatPricePin(price, transactionType) → map pin format ('2.5K/mois', '2.5M', etc.)

These will be consumed by ListingCard, ListingPreviewPanel, and MapView
in plan-3-public-display.md.

Spec: docs/superpowers/specs/2026-04-15-rental-listings-design.md"
```

---

## Self-review checklist (engineer runs this before declaring plan-1 done)

- [ ] `git log --oneline -5` : voir 3 nouveaux commits (migration, types, utils)
- [ ] `npm run build` : passe sans erreur TypeScript
- [ ] `npm run lint` : pas de nouvelle erreur ESLint (des warnings préexistants sont OK)
- [ ] Migration appliquée en DB (confirmer avec l'utilisateur que la requête de vérification Step 4 de Task 1 retourne 4 lignes)
- [ ] Aucun fichier modifié en dehors des 3 prévus : `git diff main --stat | head` doit montrer uniquement `supabase/migrations/20260415_001_rental_support.sql`, `src/types/property.ts`, `src/lib/utils.ts` (+ les commits précédents sur le spec)

---

## Après ce plan

Une fois tous les steps de ce plan exécutés et committés :

1. Pusher : `git push -u origin claude/check-system-setup-bz6Xd`
2. Passer à `plan-2-agent-crm.md` : formulaire de création de bien avec toggle Vente/Location, champs conditionnels, Zod conditionnel, sidebar preview adaptée.

**Rien d'autre n'est visible côté utilisateur à ce stade** — plan-1 prépare uniquement les fondations. Les modifications UI arrivent dans plan-2 et plan-3.
