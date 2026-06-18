# Vague 2 — Concevoir : Référence de loyer marché — Spec implémentable (FINALE, post-revue)

> Document unique de conception, prêt à coder en Vague 3. Fusion réconciliée des 4 fragments (A mv-refresh, B rentPosition pur, C injection matching, D score-de-bien différé), **durcie par les 3 revues adverses (SQL/perf, honnêteté, intégration)**. Toutes les incohérences entre fragments ET tous les `mustFix` des revues sont tranchés et signalés en ligne (« RÉCONCILIATION » pour les fragments, « CORRECTION REVUE » pour les revues). Le SQL et le TS sont littéraux : à appliquer tels quels.

---

## 0. Résumé exécutif + contrat de nommage figé

### 0.1 Ce qu'on livre

Un signal **backend déterministe (0 LLM)** qui mesure la **position d'un loyer demandé vs le marché** de son segment, puis l'injecte comme petit axe **bonus** du matching. Compliance-enabling, jamais un estimateur public ni une « valeur garantie ». Trois composants shippés en v1 + un quatrième réservé :

1. **MV `market_rent_stats`** (comparables de loyers/m² pré-calculés par segment, n≥20) + refresh cron + config tunable + RPC de lecture.
2. **Module pur `rent-reference.ts`** (zéro I/O, importable Deno + testable Node) qui résout un segment et calcule la position.
3. **Injection matching** : axe **bonus** `pricePosition` (7 pts **additionnels**, jamais redistribués quand inactif), suffixe FR appendé à `reasons.budget.detail`, `score_version` → 3.
4. **Axe « alignement marché » du score-de-bien** : **DIFFÉRÉ** (0 fichier en v1, design réservé seulement).

> **CORRECTION REVUE (mustFix SQL #1 + intégration #1, confirmé live) :** l'axe `pricePosition` est **un bonus additif**, PAS un 7ᵉ axe de la redistribution `axes[]`. Mettre `pricePosition` dans le tableau partagé `totalWeight` inflate le `scale` (=`totalWeight/liveWeight`) de 100/liveWeight à 107/liveWeight **même quand l'axe est inactif** → +7 % sur le barème de 100 % des biens buy, des mandats internes et des ~75 % de candidats rent sans référence. Le `clamp(…,0,100)` ne masque la dérive que pour le cas dégénéré tout-frac=1. Vérifié à la source (`matching-normalize.ts` l.217-219 : `totalWeight = axes.reduce((s,a)=>s+a.w,0)`). Conséquence si non corrigé : franchissements de seuil parasites (55), matches buy différents au prochain scan sans aucune implication loyer. **Voir §3.1 pour l'implémentation exacte du bonus.**

### 0.2 Contrat de nommage FIGÉ (source de vérité — tous les composants s'y conforment)

| Élément | Valeur figée | Notes de réconciliation |
|---|---|---|
| **MV** | `public.market_rent_stats` | — |
| **Niveaux (`level`)** | `'canton_surf'`, `'city_surf'`, `'npa_surf'` | **RÉCONCILIATION** : le fragment A produit `canton_surf` / `city_surf` / `npa_surf`. Les fragments C (`canton_type_surf`) et D (`npa`/`city`/`canton_surf`/`canton_type`) utilisaient d'autres orthographes — **CES ORTHOGRAPHES SONT REJETÉES**. Le module B lit exactement les 3 valeurs de A. `canton_type` (band null, terminal) **n'est PAS matérialisé en v1** → le rung 4 du fallback de B existe dans le code mais ne résout jamais rien (retourne `null`). |
| **Module pur** | `supabase/functions/_shared/rent-reference.ts` | — |
| **Test unit du module** | `supabase/functions/_shared/rent-reference.test.ts` | co-localisé, à inscrire **par nom** dans `vitest.config.ts` |
| **Clé config** | `app_config.market_rent_reference_v1` (value = TEXT JSON) | lue par la RPC infra ET par le matching ; **un seul objet** |
| **RPC config** | `public.get_market_rent_reference_config()` | SECURITY DEFINER, calque `get_property_score_config()` |
| **Clé config matching** | `app_config.matching_scoring_v2` | + `weights.pricePosition` + `version` |
| **Poids axe matching** | `pricePosition: 7` (**bonus additif**) | s'ajoute au-dessus du barème 100, ne participe PAS à la redistribution |
| **`score_version` matching** | **3** | bumpé dans config ET `DEFAULT_SCORING_CONFIG.version` |
| **Bandes de surface** | edges `[50, 80, 120]` → `'<50'`, `'50-80'`, `'80-120'`, `'120+'` | fermées-à-gauche ; le CASE SQL (A) et `surfaceBand()` (B) doivent être **octet-pour-octet** identiques (voir §1 et §2.3) |
| **Loyer canonique** | `COALESCE(current_price, price)` | sur `market_listings` (A et C). **Sur `properties` (D) : `price` SEUL** (pas de colonne `current_price` → 42703). |
| **Seuil comparables** | `min_comparables = 20` | littéral SQL `HAVING count(*) >= 20` ET `config.min_comparables` (non auto-liés, voir §8) |
| **Cron** | `market-rent-stats-refresh` @ `45 4 * * *` | clock-offset, 15 min après `cantonal-medians-refresh` |
| **Slug ville (B)** | **réutiliser `slugify` exporté de `matching-normalize.ts`** | **CORRECTION REVUE (shouldConsider intégration) :** ne PAS recréer un `citySlug` privé divergent. `slugify` est déjà exporté (l.52) et byte-identique. Voir §2.3. Dormant en v1 (matching L1-only). |

### 0.3 Courbe position→frac (matching) — UNE seule définition, **non-monotone par design (hump)**

**RÉCONCILIATION majeure.** Les fragments B et C proposaient deux courbes `positionFrac` différentes :
- B : piecewise-linéaire sur `r` (loyer/m² ÷ médiane), breakpoints `r_floor 0.70 / r_under 0.85 / r_market 0.97–1.05 / r_over 1.25`, fracs `0.62 / 0.92 / 0.50 / 0.05`, paramètres dans `config.position_curve.matching`.
- C : piecewise sur `position_pct`, breakpoints `-20 / 0 / +30`, en dur dans le scorer.

**Décision : on retient la courbe de B (en `r`, config-driven), et on la PORTE dans le scorer de C.** Raison : (1) B est la seule à avoir un plafond `< 1.0` sous le marché (un loyer suspectement bas ne « gagne » jamais tout — garde anti-erreur-de-donnée) ; (2) B est calibrable via `app_config` sans redeploy ; (3) garder une seule courbe évite deux comportements divergents. **Le scorer de C n'embarque PAS sa propre courbe `-20/0/+30`** : il réutilise `rentRef.frac` (déjà calculé par `positionFrac`). Le bloc `position_curve.property_score` de la config reste réservé pour D.

> **CORRECTION REVUE (mustFix honnêteté #1 + shouldConsider) — la courbe est un *hump*, PAS monotone.** Calcul vérifié sur `DEFAULT_POSITION_CURVE` : frac **MONTE** 0.62 (r=0.70) → 0.92 (r=0.85) puis **REDESCEND** 0.50 (r=0.97) → 0.05 (r=1.25). Le maximum est `frac_under = 0.92` **à `r = r_under = 0.85`**, pas aux extrêmes. C'est **délibéré** : un loyer suspectement bas (r < r_under) est amorti vers `frac_floor` (0.62) — garde anti-erreur-de-donnée, l'expression de « position pas valeur ». **Le test §5.1 #16 ne doit PAS asserter la monotonie** (il échouerait, poussant un coder à « corriger » la courbe en rampe monotone et à supprimer silencieusement la garde). Voir §2.5 (prose explicite) et §5.1 #16 (réécrit).

---

## 1. Migration — MV `market_rent_stats` + index + config + refresh

**Fichier (unique) :** `supabase/migrations/20260618210000_market_rent_stats.sql`

> **Date-guard FAIT** (cette session) : `git ls-tree origin/main supabase/migrations | grep 20260618` → **aucune ligne** sur origin/main ; plus haut slot local = `20260618090000` → `210000` sûr et unique. Si origin/main avance avant l'apply, re-jouer le guard et **bumper l'heure (pas la date)**.
>
> **Apply-by-hand (verrou billing) :** déployer via Supabase MCP `apply_migration`. Chaque instruction est **idempotente** (DROP IF EXISTS / CREATE OR REPLACE / ON CONFLICT / garde cron) → re-run sûr même si la ligne manque dans `schema_migrations`.

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Référence de loyer marché v1 : MV market_rent_stats (Composant A)
-- ════════════════════════════════════════════════════════════════════════════
-- Signal BACKEND déterministe (0 LLM) : comparables de LOYERS DEMANDÉS par
-- segment, pré-calculés. Mesure une POSITION vs marché, jamais une valeur
-- garantie ni un estimateur public (compliance-enabling, comme le KYC).
--
-- Jumeau structurel de cantonal_price_medians (_archived), mais AVEUGLE AU LOYER
-- là-bas (price_per_m2 75% NULL sur le rent). Ici loyer/m² =
-- COALESCE(current_price,price)/surface_m2 calculé LIVE sur le pré-filtre de
-- plausibilité résidentiel.
--
-- Multi-niveaux (UNION ALL) :
--   L1 canton_surf  : canton×type×surface_band (dorsale, toujours si n≥20)
--   +  city_surf     : city×type×surface_band   (raffinement, n≥20)
--   +  npa_surf      : NPA ×type×surface_band    (raffinement, n≥20)
-- Un segment n'existe QUE si n_comparables >= 20 (honnêteté par construction).
--
-- Validé live (eayczugyrvmtqnnmvjod, 2026-06-18) : 285 lignes
-- (83 canton_surf + 80 city_surf + 122 npa_surf), EXPLAIN ANALYZE = 245 ms,
-- 285 clés distinctes pour 285 lignes (CONCURRENTLY sûr).

-- ── (0) Idempotence. DROP MATERIALIZED VIEW ne supporte pas OR REPLACE. ──────
DROP MATERIALIZED VIEW IF EXISTS public.market_rent_stats CASCADE;

-- ── (1) MV : UNION ALL des 3 niveaux. ───────────────────────────────────────
-- Pré-filtre de plausibilité DUR puis winsorisation loyer/m² aux p2.5/p97.5 du
-- pool plausible (bornes recalculées à CHAQUE refresh, auto-adaptatives).
CREATE MATERIALIZED VIEW public.market_rent_stats AS
WITH base AS (
  SELECT
    ml.canton,
    ml.type,
    ml.postal_code,
    ml.city,
    CASE
      WHEN ml.surface_m2 < 50  THEN '<50'
      WHEN ml.surface_m2 < 80  THEN '50-80'
      WHEN ml.surface_m2 < 120 THEN '80-120'
      ELSE '120+'
    END AS surface_band,
    (COALESCE(ml.current_price, ml.price)::numeric / NULLIF(ml.surface_m2, 0)) AS loyer_m2
  FROM public.market_listings ml
  WHERE ml.transaction_type = 'rent'
    AND ml.status = 'active'
    AND ml.type IN ('apartment','house','villa')
    AND ml.canton IS NOT NULL          -- défensif (canton NOT NULL au schéma) : coût nul
    AND ml.surface_m2 BETWEEN 8 AND 1000
    AND COALESCE(ml.current_price, ml.price) BETWEEN 200 AND 20000
),
bounds AS (
  SELECT
    percentile_cont(0.025) WITHIN GROUP (ORDER BY loyer_m2) AS lo,
    percentile_cont(0.975) WITHIN GROUP (ORDER BY loyer_m2) AS hi
  FROM base
),
wins AS (
  SELECT
    b.canton, b.type, b.postal_code, b.city, b.surface_band,
    GREATEST(bo.lo, LEAST(bo.hi, b.loyer_m2)) AS loyer_m2
  FROM base b CROSS JOIN bounds bo
)
-- L1 : canton × type × surface_band (dorsale)
SELECT
  'canton_surf'::text AS level,
  w.canton,
  w.type,
  w.surface_band,
  NULL::text AS postal_code,
  NULL::text AS city,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2) AS median_loyer_m2,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2) AS p25_loyer_m2,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2) AS p75_loyer_m2,
  count(*)::int AS n_comparables
FROM wins w
GROUP BY w.canton, w.type, w.surface_band
HAVING count(*) >= 20  -- DOIT égaler app_config.market_rent_reference_v1.min_comparables — bouger les DEUX ensemble (une MV ne lit pas app_config au refresh)

UNION ALL
-- city × type × surface_band (raffinement)
SELECT
  'city_surf'::text,
  w.canton,
  w.type,
  w.surface_band,
  NULL::text AS postal_code,
  w.city,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  count(*)::int
FROM wins w
WHERE w.city IS NOT NULL
GROUP BY w.canton, w.type, w.surface_band, w.city
HAVING count(*) >= 20  -- idem : lié à min_comparables, bouger les DEUX ensemble

UNION ALL
-- NPA (postal_code) × type × surface_band (raffinement le plus fin)
SELECT
  'npa_surf'::text,
  w.canton,
  w.type,
  w.surface_band,
  w.postal_code,
  NULL::text AS city,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  count(*)::int
FROM wins w
WHERE w.postal_code IS NOT NULL
GROUP BY w.canton, w.type, w.surface_band, w.postal_code
HAVING count(*) >= 20  -- idem : lié à min_comparables, bouger les DEUX ensemble
WITH NO DATA;

-- ── (2) Index UNIQUE (requis pour REFRESH … CONCURRENTLY). ───────────────────
-- COALESCE('') sur les nullables (NULL ≠ NULL en index unique). Unicité prouvée
-- par la DONNÉE, pas par le schéma : vérifié live sur le pool résidentiel
-- plausible — city_null=0, city_empty=0, city_blank=0, pc_null=0, pc_empty=0,
-- pc_blank=0 → 285 lignes = 285 clés COALESCE distinctes AUJOURD'HUI. Le préfixe
-- 'level' désambigue de toute façon les niveaux entre eux ; une dérive scraper
-- vers '' produirait une clé dégénérée '||…' (captée par la spec §5.2 #6).
CREATE UNIQUE INDEX uq_market_rent_stats
  ON public.market_rent_stats (
    level, canton, type, surface_band,
    COALESCE(postal_code, ''), COALESCE(city, '')
  );

-- ── (2bis) Index de lecture L1 — PROVISIONING pour le score-de-bien différé
-- (§4, LEFT JOIN LATERAL mono-segment). NON utilisé par le hot-path matching
-- v1 (l'edge fait .eq('level','canton_surf').select('*') sans prédicat
-- canton/type → seqscan trivial d'une MV de 285 lignes). Gardé volontairement
-- comme forward-provisioning ; coût = un build d'index au refresh. ───────────
CREATE INDEX idx_market_rent_stats_l1
  ON public.market_rent_stats (canton, type, surface_band)
  WHERE level = 'canton_surf';

-- ── (3) Premier peuplement (non-CONCURRENT ; MV créée WITH NO DATA). ─────────
REFRESH MATERIALIZED VIEW public.market_rent_stats;

-- ── (4) GRANTS. Pas de RLS sur les MV en Postgres. Donnée agrégée non-sensible
-- MAIS lue server-side (edge matching sous service_role) ⇒ EXPOSE
-- authenticated+service_role, REVOKE anon. ──────────────────────────────────
REVOKE ALL ON public.market_rent_stats FROM PUBLIC, anon;
GRANT SELECT ON public.market_rent_stats TO authenticated, service_role;

-- ── (5) Tunables app_config (value = TEXT JSON, comme property_scoring_v1). ──
INSERT INTO public.app_config (key, value)
VALUES (
  'market_rent_reference_v1',
  '{"min_comparables":20,"surface_band_edges":[50,80,120],"plausibility":{"amount_min":200,"amount_max":20000,"surface_min":8,"surface_max":1000},"winsor":{"p_lo":0.025,"p_hi":0.975},"residential_types":["apartment","house","villa"],"position_curve":{"matching":{"r_floor":0.70,"r_under":0.85,"r_market_lo":0.97,"r_market_hi":1.05,"r_over":1.25,"frac_floor":0.62,"frac_under":0.92,"frac_market":0.50,"frac_over":0.05},"property_score":{"breakpoints":[{"r_max":0.70,"score":60},{"r_max":0.80,"score":85},{"r_max":0.90,"score":95},{"r_max":1.05,"score":100},{"r_max":1.20,"score":60},{"r_max":1.30,"score":40},{"r_max":999,"score":25}],"floor":20,"low_taper_floor":50}},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── (6) RPC de lecture du barème (calque get_property_score_config). ─────────
CREATE OR REPLACE FUNCTION public.get_market_rent_reference_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM app_config WHERE key = 'market_rent_reference_v1'),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_market_rent_reference_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_market_rent_reference_config() TO authenticated, service_role;

-- ── (7) CRON refresh quotidien. Clock-offset 45 4 UTC (15 min après
-- cantonal-medians-refresh @ 30 4). PAS dans l'edge flatfox-sync
-- (fire-and-forget, self-chunking, pas de hook "terminé"). Gardé par présence
-- du schéma cron (sauté en local/CI). Idempotent (cron.schedule = upsert par nom).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'market-rent-stats-refresh',
      '45 4 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.market_rent_stats'
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — market-rent-stats-refresh non planifié';
  END IF;
END
$do$;
```

**RÉCONCILIATION config.** Le `position_curve.matching` expose exactement les 9 clés de `PositionCurve` de B (`r_floor, r_under, r_market_lo, r_market_hi, r_over, frac_floor, frac_under, frac_market, frac_over`) avec les valeurs par défaut de B. Le bloc `property_score` (breakpoints + floor + low_taper_floor) est aligné sur le design de D et reste réservé.

**Justifications condensées** (preuves dans le fragment A) : UNION ALL plutôt que GROUPING SETS (null-padding et gardes `WHERE city/postal_code IS NOT NULL` explicites par niveau) ; index unique requis pour CONCURRENTLY ; clock-offset `45 4` plutôt que REFRESH inline dans flatfox-sync.

> **CORRECTION REVUE (mustFix SQL #3) — l'unicité de l'index vient de la DONNÉE, pas du schéma.** `canton` ET `city` sont NOT NULL au schéma (vérifié `information_schema`), mais NOT NULL ≠ non-vide : un `''` de scraper produirait une clé dégénérée. Le commentaire (2) cite désormais le **fait vérifié live** (city/pc null/empty/blank = 0, 285 = 285) et **non le schéma**. La spec §5.2 #6 ajoute une assertion qui échoue si une ligne du pool a city/postal_code vide ou blanc (drift futur).
>
> **CORRECTION REVUE (shouldConsider SQL — index L1 inutilisé en v1) :** l'index partiel `idx_market_rent_stats_l1` n'est PAS sur le chemin d'accès du matching v1 (l'edge charge les ~83 lignes sans prédicat). Plutôt que le droper, on le **garde explicitement comme provisioning du LATERAL join du score-de-bien différé (§4)** et on le commente comme tel (voir bloc (2bis)).

---

## 2. Module pur `rent-reference.ts`

**Fichier (NOUVEAU) :** `supabase/functions/_shared/rent-reference.ts` — zéro import (ni Deno std, ni supabase), miroir de `matching-normalize.ts`. Importable par l'edge `matching-engine` ET testable en Node.

### 2.1 En-tête + types (signatures exactes)

```ts
// Référence de loyer marché — fonctions PURES (zéro I/O, zéro dépendance Deno).
//
// Réutilisé par l'edge function matching-engine (Deno) ET par les tests vitest
// (Node) : aucun import, tout est déterministe. Mesure une POSITION vs marché
// (loyer/m² du bien vs médiane du segment), jamais une « valeur correcte ».
// Sous le seuil de comparables ou sans surface ⇒ null.
//
// Source des médianes = vue matérialisée public.market_rent_stats (Composant A),
// déjà filtrée à n_comparables >= 20 (honnêteté par construction).

// RÉCONCILIATION : level ∈ exactement les 3 valeurs émises par la MV (A).
// 'canton_type' est gardé dans le type pour le rung terminal du fallback, mais
// la MV ne le matérialise PAS en v1 → ce rung ne résout jamais (retourne null).
export type RentLevel = 'npa_surf' | 'city_surf' | 'canton_surf' | 'canton_type'

export interface RentStatsRow {
  level: RentLevel
  canton: string
  type: string                  // 'apartment' | 'house' | 'villa'
  surface_band: string | null   // '<50'|'50-80'|'80-120'|'120+' ; null si canton_type
  postal_code: string | null    // renseigné seulement si level='npa_surf'
  city: string | null           // renseigné seulement si level='city_surf'
  median_loyer_m2: number
  p25_loyer_m2: number
  p75_loyer_m2: number
  n_comparables: number
}

export interface RentStatsIndex { byKey: Map<string, RentStatsRow> }

export interface RentSubject {
  canton: string | null
  type: string | null
  surface_m2: number | null
  loyer: number | null          // = COALESCE(current_price, price), résolu côté appelant
  postal_code?: string | null
  city?: string | null
}

export interface RentPosition {
  expected_loyer_m2: number     // = médiane du segment résolu
  p25: number
  p75: number
  n_comparables: number
  position_pct: number          // round((r-1)*100) ; négatif = sous le marché
  level: RentLevel              // cran de fallback effectivement utilisé
  frac: number                  // courbe position→[0,1] pour le matching
}

export interface PositionCurve {
  r_floor: number       // 0.70
  r_under: number       // 0.85
  r_market_lo: number   // 0.97
  r_market_hi: number   // 1.05
  r_over: number        // 1.25
  frac_floor: number    // 0.62
  frac_under: number    // 0.92  ← MAXIMUM de la courbe (hump à r_under, voir §2.5)
  frac_market: number   // 0.50
  frac_over: number     // 0.05
}
```

> **RÉCONCILIATION du type `RentPosition`.** Forme de B retenue (`p25`/`p75` séparés, `level: RentLevel`, `frac` inclus). La forme de C (`range: [number,number]`, `level: string`) est rejetée. C s'aligne (le scorer lit `position_pct`, `n_comparables`, `frac`).

### 2.2 `surfaceBand` — SOURCE DE VÉRITÉ UNIQUE (miroir octet du CASE SQL de A)

```ts
// DOIT correspondre OCTET POUR OCTET au CASE de la MV (§1) :
//   CASE WHEN surface_m2 < 50 THEN '<50'
//        WHEN surface_m2 < 80 THEN '50-80'
//        WHEN surface_m2 < 120 THEN '80-120'
//        ELSE '120+' END
// Edges fermés-à-gauche : 50 → '50-80', 80 → '80-120', 120 → '120+'.
export const SURFACE_BAND_EDGES: readonly [number, number, number] = [50, 80, 120]
export function surfaceBand(surface_m2: number): string {
  const [a, b, c] = SURFACE_BAND_EDGES
  if (surface_m2 < a) return '<50'
  if (surface_m2 < b) return '50-80'
  if (surface_m2 < c) return '80-120'
  return '120+'
}
```

### 2.3 `buildRentStatsIndex` + clés

> **CORRECTION REVUE (shouldConsider intégration) — réutiliser `slugify`, pas un `citySlug` divergent.** `matching-normalize.ts` exporte déjà `slugify` (l.52), byte-identique au `citySlug` proposé. Le rung `city_surf` étant **dormant en v1** (matching L1-only), on définit le slug ville **par import du `slugify` partagé** pour qu'il n'y ait jamais deux logiques à garder synchronisées le jour où le rung city sera activé. Le module restant « zéro import runtime », on importe `slugify` (une fonction pure sans dépendance) — c'est le SEUL import autorisé, vers un autre module pur du même dossier `_shared`.

```ts
import { slugify } from './matching-normalize.ts' // fonction PURE partagée (zéro I/O) ; évite un 2ᵉ slug divergent

// Clés (préfixe = level pour éviter toute collision entre niveaux) :
//   npa_surf   : 'npa_surf|<CANTON>|<type>|<band>|<postal_code>'
//   city_surf  : 'city_surf|<CANTON>|<type>|<band>|<city_slug>'   (dormant v1)
//   canton_surf: 'canton_surf|<CANTON>|<type>|<band>'
//   canton_type: 'canton_type|<CANTON>|<type>'                    (jamais matérialisé v1)
function rentKey(level: RentLevel, canton: string, type: string,
                 band: string | null, geo: string | null): string {
  const C = (canton || '').toUpperCase().trim()
  const T = (type || '').toLowerCase().trim()
  const B = (band || '').toLowerCase().trim()
  switch (level) {
    case 'npa_surf':    return `npa_surf|${C}|${T}|${B}|${(geo || '').toLowerCase().trim()}`
    case 'city_surf':   return `city_surf|${C}|${T}|${B}|${slugify(geo || '')}`
    case 'canton_surf': return `canton_surf|${C}|${T}|${B}`
    case 'canton_type': return `canton_type|${C}|${T}`
  }
}

export function buildRentStatsIndex(rows: RentStatsRow[]): RentStatsIndex {
  const byKey = new Map<string, RentStatsRow>()
  for (const r of rows ?? []) {
    if (!r || !r.canton || !r.type) continue
    const geo = r.level === 'npa_surf' ? r.postal_code
              : r.level === 'city_surf' ? r.city
              : null
    const k = rentKey(r.level, r.canton, r.type, r.surface_band, geo)
    if (!byKey.has(k)) byKey.set(k, r) // 1 ligne/clé garantie par l'index unique MV
  }
  return { byKey }
}
```

> **Note couplage (dormant v1) :** le slug côté B (`slugify`) doit matcher la forme stockée par A dans `market_rent_stats.city` (texte flatfox brut). Les DEUX côtés slugifient (index build ET clé sujet) → symétrie préservée. À re-valider avant d'activer le rung city (§8.8).

### 2.4 `rentPosition` — résolution + arithmétique (vérifiée vs live)

```ts
export function rentPosition(
  subject: RentSubject,
  index: RentStatsIndex,
  curve: PositionCurve = DEFAULT_POSITION_CURVE,
): RentPosition | null {
  const surf = numOrNull(subject.surface_m2)
  const loyer = numOrNull(subject.loyer)
  const canton = subject.canton ? String(subject.canton).toUpperCase().trim() : null
  const type = subject.type ? String(subject.type).toLowerCase().trim() : null
  if (surf == null || surf <= 0) return null
  if (loyer == null || loyer <= 0) return null
  if (!canton || !type) return null

  const band = surfaceBand(surf)
  // Fallback DESCENDANT, s'arrête au 1er cran présent (donc déjà n≥20).
  const candidates: Array<[RentLevel, string | null]> = [
    ['npa_surf', subject.postal_code ?? null],
    ['city_surf', subject.city ?? null],
    ['canton_surf', null],
    ['canton_type', null],
  ]
  let hit: RentStatsRow | null = null
  let hitLevel: RentLevel | null = null
  for (const [level, geo] of candidates) {
    if ((level === 'npa_surf' || level === 'city_surf') && !geo) continue
    const b = level === 'canton_type' ? null : band
    const row = index.byKey.get(rentKey(level, canton, type, b, geo))
    if (row) { hit = row; hitLevel = level; break }
  }
  if (!hit || !hitLevel) return null

  const median = numOrNull(hit.median_loyer_m2)
  if (median == null || median <= 0) return null // div-by-zero défensif
  const subjectLoyerM2 = loyer / surf
  const r = subjectLoyerM2 / median
  return {
    expected_loyer_m2: round2(median),
    p25: round2(numOrNull(hit.p25_loyer_m2) ?? median),
    p75: round2(numOrNull(hit.p75_loyer_m2) ?? median),
    n_comparables: hit.n_comparables,
    position_pct: Math.round((r - 1) * 100),
    level: hitLevel,
    frac: positionFrac(r, curve),
  }
}
```

> Arithmétique vérifiée live (GE apartment 50-80, médiane 37.79) : loyer/surf 24.29→r 0.64→-36 % ; 30.29→0.80→-20 % ; 37.79→1.00→0 % ; 45.29→1.20→+20 % ; 52.86→1.40→+40 %.

### 2.5 `positionFrac` — la courbe (**hump non-monotone par design**, bornée, plafond < 1.0)

```ts
export const DEFAULT_POSITION_CURVE: PositionCurve = {
  r_floor: 0.70, r_under: 0.85, r_market_lo: 0.97, r_market_hi: 1.05, r_over: 1.25,
  frac_floor: 0.62, frac_under: 0.92, frac_market: 0.50, frac_over: 0.05,
}
// Piecewise-linéaire NON-MONOTONE PAR DESIGN (un « hump ») :
//   frac CULMINE à frac_under (0.92) à r = r_under = 0.85, PUIS REDESCEND.
//   Un loyer suspectement bas (r < r_under) est volontairement amorti vers
//   frac_floor (0.62) → garde anti-erreur-de-donnée (« position pas valeur » :
//   un loyer aberrant ne gagne jamais tout). Neutre 0.50 PILE au marché (r=1).
//   Ne JAMAIS « corriger » ce hump en rampe monotone : cela supprimerait la garde.
//   r <= r_floor                 → frac_floor (0.62)
//   r_floor..r_under             → frac_floor→frac_under (0.62→0.92)   [MONTE]
//   r_under..r_market_lo         → frac_under→frac_market (0.92→0.50)  [DESCEND]
//   r_market_lo..r_market_hi     → frac_market (0.50)
//   r_market_hi..r_over          → frac_market→frac_over (0.50→0.05)   [DESCEND]
//   r >= r_over                  → frac_over (0.05)
export function positionFrac(r: number, c: PositionCurve = DEFAULT_POSITION_CURVE): number {
  if (!Number.isFinite(r) || r <= 0) return c.frac_market
  if (r <= c.r_floor) return c.frac_floor
  if (r < c.r_under)      return lerp(r, c.r_floor, c.r_under, c.frac_floor, c.frac_under)
  if (r < c.r_market_lo)  return lerp(r, c.r_under, c.r_market_lo, c.frac_under, c.frac_market)
  if (r <= c.r_market_hi) return c.frac_market
  if (r < c.r_over)       return lerp(r, c.r_market_hi, c.r_over, c.frac_market, c.frac_over)
  return c.frac_over
}
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0
  const t = clamp((x - x0) / (x1 - x0), 0, 1)
  return y0 + t * (y1 - y0)
}
```

### 2.6 `buildRentReasonSuffix` — raison FR, compliance-safe (PROPRIÉTAIRE = B)

**RÉCONCILIATION ownership.** `buildRentReasonSuffix` vit dans B (`rent-reference.ts`), C l'importe. Toute la formulation FR + sémantique de position dans le module pur unique, testable, sans duplication. C n'a plus de `rentPositionDetail` local.

```ts
// SUFFIXE à concaténer au budget.detail existant (jamais une 6ᵉ clé reasons).
// « position / marché du secteur / n comparables », jamais « valeur » ni « garanti ».
export function buildRentReasonSuffix(pos: RentPosition | null): string {
  if (!pos) return ''
  const pct = Math.abs(pos.position_pct)
  const n = pos.n_comparables
  const plural = n > 1 ? 's' : ''
  if (pct <= 3) return ` · au prix du marché du secteur (sur ${n} comparable${plural})`
  if (pos.position_pct < 0) return ` · ~${pct}% sous le marché du secteur (sur ${n} comparable${plural})`
  return ` · ~${pct}% au-dessus du marché du secteur (sur ${n} comparable${plural})`
}
```

> **RÉCONCILIATION wording.** Retenu : « au prix du marché du secteur » (formulation de C, plus concrète) avec la bande neutre ±3 % de B. Le pluriel de `comparable(s)` est géré.

### 2.7 Helpers locaux (copiés verbatim de `matching-normalize.ts`, module auto-contenu)

```ts
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}
function clamp(n: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, n)) }
function round2(n: number): number { return Math.round(n * 100) / 100 }
```

**Exports publics du module :** types `RentLevel, RentStatsRow, RentStatsIndex, RentSubject, RentPosition, PositionCurve` ; const `SURFACE_BAND_EDGES, DEFAULT_POSITION_CURVE` ; fonctions `surfaceBand, buildRentStatsIndex, rentPosition, positionFrac, buildRentReasonSuffix`. **Import entrant unique :** `slugify` depuis `matching-normalize.ts` (pure).

---

## 3. Injection matching

Dépend du module §2. Trois surfaces : `matching-normalize.ts` (pur), `matching-engine/index.ts` (edge), `app_config.matching_scoring_v2` (DB). `useAtelierMatching.ts` et `composeAiHint.ts` = **aucun changement** (le suffixe ride dans `budget.detail`, contrat 5 clés intact).

### 3.1 `supabase/functions/_shared/matching-normalize.ts`

> **CORRECTION REVUE (mustFix SQL #1 + intégration #1, racine).** L'ancienne instruction §3.1(h) « pousser `pricePosition` dans le tableau `axes[]` de redistribution » **EST SUPPRIMÉE**. `pricePosition` est un **bonus additif** qui ne touche PAS `totalWeight` quand inactif. Implémentation littérale ci-dessous. Identité prouvée : inactif → `pricePosP = 0` → total byte-identique au barème 6 axes à 100 ; actif frac 0.5 → bonus borné absorbé par le clamp 100.

**(a)** Import consolidé du module rent-reference (après le bloc d'en-tête, avant `export const SWISS_CANTONS`). **Un seul `import` value + un seul `import type`** (mustFix intégration #3 : ne PAS éparpiller en prose) :
```ts
import { positionFrac, DEFAULT_POSITION_CURVE, buildRentReasonSuffix } from './rent-reference.ts'
import type { PositionCurve, RentPosition } from './rent-reference.ts'
```
> `import type` erasé au runtime ; les value imports (`positionFrac, DEFAULT_POSITION_CURVE, buildRentReasonSuffix`) sont des fonctions/const pures → l'invariant « zéro I/O » du module est préservé.

**(b)** Type `Weights` — ajouter `pricePosition` :
```ts
  weights: { price: number; zone: number; type: number; rooms: number; surface: number; features: number; pricePosition: number }
```

**(c)** `DEFAULT_SCORING_CONFIG.weights` :
```ts
  weights: { price: 32, zone: 24, type: 12, rooms: 12, surface: 10, features: 10, pricePosition: 7 }, // 100 = barème redistribué ; 7 = BONUS additif (hors redistribution)
```
> `parseScoringConfig` (`weights: { ...DEFAULT.weights, ...(raw.weights ?? {}) }`) remplit `pricePosition` depuis DEFAULT pour la config live (qui ne l'a pas encore) → **aucun changement de `parseScoringConfig`**.

**(d)** `DEFAULT_SCORING_CONFIG.version` : `2` → `3`.

**(e)** Signature de `calculateScoreV2` — 4ᵉ param précalculé :
```ts
export function calculateScoreV2(
  listing: Record<string, unknown>,
  criteria: Record<string, unknown> | null | undefined,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
  rentRef: RentPosition | null = null, // précalculé par l'edge, zéro I/O ici
): ScoreResult {
```
> Défaut `null` → tous les appelants existants restent source-compatibles ET byte-identiques (axe bonus inactif → +0 → barème inchangé).

**(f)** **Le bloc `axes[]` de redistribution NE CHANGE PAS** (reste les 6 axes originaux ; `totalWeight` reste 100). Ajouter le bonus APRÈS le calcul du sous-total 6 axes, juste avant la ligne `const total = clamp(...)`. Remplacer la ligne `total` existante :
```ts
  // ─── PRIX vs MARCHÉ (BONUS additif, hors redistribution) ─────────────────
  // CORRECTION REVUE : pricePosition n'entre PAS dans axes[]/totalWeight (sinon
  // +7% sur 100% des candidats inactifs — régression prouvée). C'est un bonus
  // qui s'ajoute au sous-total 6 axes UNIQUEMENT quand rentRef est présent.
  // rentRef.frac est déjà calculé par rentPosition() avec la même courbe →
  // réutilisé tel quel, zéro divergence. Le clamp(…,0,100) borne le résultat.
  const pricePosP = rentRef ? clamp(rentRef.frac, 0, 1) * W.pricePosition : 0

  const total = clamp(Math.round(priceP + zoneP + typeP + roomsP + surfaceP + featP + pricePosP), 0, 100)
```
> **Preuve d'identité (mustFix) :** quand `rentRef == null`, `pricePosP = 0` → `total = clamp(round(priceP+…+featP), 0, 100)` = **exactement l'expression d'origine, caractère pour caractère**. `totalWeight` n'a pas bougé (toujours 100) donc `scale`, `priceP…featP` sont inchangés. Identité par construction, pas par chance d'arrondi. Quand `rentRef` actif (frac 0.5) : `+0.5*7 = +3.5` pts bornés à 100.

**(g)** Reconstruire le `return` pour appender le suffixe à `reasons.budget.detail` (toujours **5 clés** : `budget/zone/type/rooms/features`) :
```ts
  const reasons: MatchReasons = {
    budget: axisReason(price, priceP),
    zone: axisReason(zone, zoneP),
    type: axisReason(type, typeP),
    rooms: { match: roomsSurfActive && roomsFrac >= 0.5, score: Math.round(roomsSurfP), detail: roomsDetail },
    features: axisReason(features, featP),
  }
  // Position marché : appendée au détail BUDGET (jamais une 6ᵉ clé — contrat figé).
  if (rentRef) {
    const suffix = buildRentReasonSuffix(rentRef)
    if (suffix) reasons.budget = { ...reasons.budget, detail: `${reasons.budget.detail}${suffix}` }
  }
  return { total, reasons }
```
> Le `score` de la ligne budget reste les points de l'axe budget (la position est texte informatif seulement). Exemple : `Dans le budget · ~12% sous le marché du secteur (sur 47 comparables)`. `axisReason` dérive `match`/`score` de `axis.frac`/`points`, JAMAIS du texte `detail` → le suffixe ne peut pas faire basculer le verdict de l'axe (vérifié l.322-325).

> **RÉCONCILIATION.** C ré-exportait `buildRentReasonSuffix`/`rentPositionDetail` depuis `matching-normalize.ts`. **Supprimé** : ces fonctions vivent uniquement dans `rent-reference.ts` (§2.6) ; `matching-normalize.ts` les **importe**.

> **Note sur `positionFrac`/`DEFAULT_POSITION_CURVE`/`PositionCurve` importés :** ils ne sont PAS appelés dans `calculateScoreV2` (le scorer réutilise `rentRef.frac` déjà calculé). Ils sont importés pour rester disponibles si une future calibration veut recalculer côté scorer, et parce que `import type { PositionCurve }` documente le contrat. **Si le linter Deno signale un import value inutilisé** (`positionFrac`/`DEFAULT_POSITION_CURVE`), les retirer de l'import value (a) et ne garder que `buildRentReasonSuffix` + le `import type`. Le coder tranche selon le lint réel ; le comportement runtime est identique dans les deux cas.

### 3.2 `supabase/functions/matching-engine/index.ts`

**(a)** Import du module rent-reference (après l'import `matching-normalize.ts`). **Bloc COMPLET et explicite** (mustFix intégration #3 : `RentStatsRow` DOIT y figurer, plus de note en prose) :
```ts
import {
  buildRentStatsIndex,
  rentPosition,
  type RentStatsIndex,
  type RentStatsRow,
  type RentSubject,
} from '../_shared/rent-reference.ts'
```

**(b)** Charger `market_rent_stats` UNE fois par invocation + construire l'index (après le chargement de cfg, avant `let newMatches = 0`). Filtre `level='canton_surf'` (orthographe figée §0.2) :
```ts
    // ── Référence loyer marché (signal déterministe, lookup en mémoire) ──
    // Chargé UNE fois ; jamais de GROUP BY live. Absence/erreur ⇒ index vide ⇒
    // rentPosition()=null ⇒ bonus pricePosP=0 ⇒ barème 100 pts inchangé
    // (dégradation silencieuse). v1 plafonné L1 : on charge canton_surf seul
    // car la RPC match_candidate_listings ne renvoie PAS postal_code (la finesse
    // city/NPA est un choix de scope v1, voir §8.8 — city EST disponible mais
    // non activé pour éviter le couplage slug dormant non testé).
    let rentIndex: RentStatsIndex = buildRentStatsIndex([])
    const { data: statsRows, error: statsErr } = await supabase
      .from('market_rent_stats')
      .select('*')
      .eq('level', 'canton_surf')
    if (statsErr) {
      console.error('[matching-engine] market_rent_stats load failed, axis inactive:', statsErr.message)
    } else {
      rentIndex = buildRentStatsIndex((statsRows ?? []) as RentStatsRow[])
    }
```
> **CORRECTION REVUE (shouldConsider intégration — try/catch décoratif).** supabase-js ne *throw* pas sur erreur de requête : il renvoie `{ data, error }`. L'ancien `try/catch` ne captait donc que les exceptions réseau et ignorait `error`. Remplacé par une destructuration explicite de `error` + log ; la dégradation gracieuse vient du `?? []` (index vide → bonus 0), pas du catch. Comportement : axe inerte si la MV manque/erre, barème inchangé.

**(c)** Dans `matchSearchesAgainstMarket`, boucle candidats — construire `RentSubject`, calculer `rentRef` (gated rent), passer en 4ᵉ arg :
```ts
        for (const ml of (candidates ?? []) as Record<string, unknown>[]) {
          const subject: RentSubject = {
            canton: (ml.canton as string | null) ?? null,
            type: (ml.type as string | null) ?? null,
            surface_m2: numOrNull(ml.surface_m2),
            loyer: numOrNull(ml.current_price) ?? numOrNull(ml.price),
          }
          const rentRef = tx === 'rent' ? rentPosition(subject, rentIndex) : null
          const score = calculateScoreV2(ml, criteria, cfg, rentRef)
          if (score.total >= cfg.threshold) {
            rows.push({
```
> `tx` déjà en scope (`const tx = inferTransactionType(criteria)`). Gate `tx === 'rent'` → jamais de raison loyer sur une vente. **CORRECTION REVUE (mustFix intégration #2) :** ce gate suffit MAINTENANT que `pricePosition` est un bonus (§3.1.f) — sur buy, `rentRef=null` → `pricePosP=0` → score buy byte-identique à v2, zéro franchissement de seuil parasite. `numOrNull` = helper local de l'edge. Le `RentSubject` n'inclut pas `postal_code`/`city` → résolution L1 seulement.

**(d)** `buildInternalRows` (mandats agence) : **aucun changement** — le 4ᵉ param défaut `null` garde le barème interne byte-identique (bonus 0). L'axe loyer côté propriété interne est l'axe score-de-bien différé §4 ; ne pas le câbler ici.

**(e)** `score_version` → 3 : découle de `cfg.version` une fois (§3.1.d) et (§3.3) bumpés. `MatchRow.score_version: cfg.version` et l'audit `score_version: cfg.version` portent 3. **Aucun backfill** des lignes existantes (frontière de version honnête).

**(f)** Persistance `position_pct`/`comparable_count` — **DÉCISION : reason-only en v1.** La table `matches` n'a pas ces colonnes et les RPC `insert_*_matches` whitelistent un set fixe. La position ride entièrement dans `reasons.budget.detail` (jsonb persisté + rendu). Zéro DDL, zéro édition de RPC. Colonnes dédiées = follow-up Vague 3+ si l'analytique « % de matches sous le marché » le demande.

### 3.3 `app_config.matching_scoring_v2` — UPDATE idempotent (via MCP `apply_migration`, verrou billing)

```sql
UPDATE public.app_config
SET value = '{"weights":{"price":32,"zone":24,"type":12,"rooms":12,"surface":10,"features":10,"pricePosition":7},"threshold":55,"priceOverTolerance":0.15,"surfaceDeficitTolerance":0.20,"version":3}'
WHERE key = 'matching_scoring_v2';
```
> Seuls ajouts vs live : `weights.pricePosition:7` et `version` 2→3. Tout le reste préservé verbatim. Tunable post-ship sans redeploy.

### 3.4 `src/hooks/useAtelierMatching.ts` + `composeAiHint.ts` — AUCUN CHANGEMENT (confirmé)

`mapReasons` itère `Object.entries(raw)` et rend chaque `v.detail` → 5 clés inchangées, la ligne « Budget » lit le détail enrichi. `composeAiHint` consomme `detail` de façon opaque (`.toLowerCase()`). Sites de rendu (`SgaWhy.tsx`, `SgaAcheteurMode.tsx`) impriment `{r.detail}` verbatim → le suffixe s'affiche.

> **CORRECTION REVUE (shouldConsider honnêteté + intégration — suffixe sur un budget « frein »).** Quand un bien est AU-DESSUS du budget (`budget.match=false`) ET sous le marché, `budget.detail` devient ex. `33% au-dessus du budget · ~12% sous le marché du secteur (sur 47 comparables)`. C'est honnête et utile (hors budget mais bonne affaire marché) et `mapReasons` dérive `ok`/`pts` de `v.match`/`v.score` (PAS du texte) → le suffixe ne peut pas transformer un frein en force. **On NE supprime PAS le suffixe sur budget négatif** (décliné, voir changelog) ; on **verrouille le comportement par un test** (§5.1 scorer + §5.2 #7) : un bien sous le marché ET hors budget garde `budget.match===false` ET le suffixe présent.

---

## 4. Axe score-de-bien « alignement marché » — RÉSERVÉ / DIFFÉRÉ

**DÉCISION DE SHIP v1 : DIFFÉRÉ TOTAL — design documenté seulement, ZÉRO fichier, ZÉRO code.** `fileChanges` pour cette section en v1 = **NÉANT**.

### 4.1 Pourquoi différer (et pas « plumb-inert »)

- **La branche est intestable jusqu'au gate 2.** Live : 6 mandats, 100 % buy, **0 mandat rent scorable**. Le chemin `market_score_raw IS NOT NULL` n'est atteint par aucune ligne. Shipper du code que le cron saute pour chaque ligne = l'anti-pattern « signal sans donnée ».
- **« Plumb-inert » n'achète rien et ajoute du risque** : il ferait atterrir la renormalisation/courbe non-testée. La garantie byte-identité reposerait sur la branche NULL seule — ce que C-1 (§4.4) donne déjà gratuitement au vrai ship.
- **Le coût de différer est ~0** : colonnes déjà présentes (0 DDL), spec verbatim-appliable.

### 4.2 Faits terrain (live prod, confirmés)

| Fait | Valeur | Conséquence |
|---|---|---|
| Loyer sujet sur `properties` | **`price`** seul (PAS de `current_price`) | sujet loyer = `p.price` gated `transaction_type='rent'`. `COALESCE(current_price,price)` ici = **42703**. |
| Colonnes d'écriture déjà présentes | `market_position_score` INTEGER, `comparable_count` INTEGER, `price_vs_market_pct` NUMERIC, `avg_comparable_price` NUMERIC | **0 DDL.** Sortie de courbe = `round(...)::int`. |
| Mix mandats | total 6, rent 0, rent-scorable 0 | axe inapplicable à 100 % → différer. |
| Config live `property_scoring_v1` | weights {freshness:0.20,interest:0.20,pipeline:0.15,completeness:0.45} ; pas de bloc `market_alignment` | un-defer ajoute le bloc + un 5ᵉ poids ; RPC COALESCE chaque clé → absence sûre. |

### 4.3 Design réservé de l'axe (RPC, au un-defer)

- **Lookup** : `LEFT JOIN LATERAL` sur `market_rent_stats`, fallback `npa_surf → city_surf → canton_surf` (la propriété a `postal_code` + `city`). Surface band via les edges figés `[50,80,120]`. **RÉCONCILIATION : le join utilise les `level` figés `npa_surf`/`city_surf`/`canton_surf`** (orthographes `npa`/`city`/`canton_type` du fragment D rejetées). `canton_type` non matérialisé par A en v1 → rung retiré du join réservé jusqu'à ce que A l'émette.
- **Index** : le LATERAL mono-segment utilisera `idx_market_rent_stats_l1` (provisionné §1 bloc 2bis) ; étendre l'index aux clés npa/city si le plan le justifie au un-defer.
- **Éligibilité** (sinon `market_score := NULL`) : `transaction_type='rent'` ∧ `type IN ('apartment','house','villa')` ∧ `price`/`surface_m2` non-null ∧ `surface_m2 BETWEEN 8 AND 1000` ∧ `price BETWEEN 200 AND 20000` ∧ segment résolu.
- **Courbe asymétrique** : breakpoints dans `position_curve.property_score` (déjà posé §1) (`breakpoints`, `floor:20`, `low_taper_floor:50`). Sortie `LEAST(100, GREATEST(0, round(...)))::int`.

### 4.4 Re-pondération — PREUVE d'identité octet-pour-octet

**CORRECTION verrouillée (prouvée live) :** les poids `{freshness:0.18, interest:0.18, pipeline:0.14, completeness:0.40, market:0.10}` **NE renormalisent PAS** vers 0.20/0.20/0.15/0.45 (présent-4=0.90 → 0.14/0.90=**0.15556**≠0.15 ; 0.40/0.90=**0.44444**≠0.45). Ils passent sur les 6 lignes actuelles **par chance d'arrondi seulement**. → **INTERDITS**.

**C-1 (RECOMMANDÉ) — branche existante verbatim quand `market_score IS NULL`, zéro renormalisation :**
```sql
overall_score = CASE
  WHEN s.market_score_raw IS NULL THEN
    -- IDENTIQUE octet-pour-octet à l'expression actuelle (poids 0.20/0.20/0.15/0.45)
    LEAST(100, GREATEST(0, round( w_fresh*fr + w_interest*int + w_pipeline*pl + w_complete*cp )))
  ELSE
    LEAST(100, GREATEST(0, round(
        w5_fresh*fr + w5_interest*int + w5_pipeline*pl + w5_complete*cp + w5_market*market_score_raw )))
END
```
**Preuve d'identité :** la branche NULL est **caractère-pour-caractère** l'expression présente ; `market_score_raw` NULL pour les 6 lignes buy → opérandes et `round()` inchangés → 59/57/55/52/52/51, tous `a_animer`, `data_completeness 0.50`, colonnes marché NULL — **identique par construction**.

**C-2 (alternative) — vecteur nominal ratio-preserving corrigé** : `{freshness:0.18, interest:0.18, pipeline:0.135, completeness:0.405, market:0.10}` (somme 1.00 ; renormalisé sur présent-4=0.90 → exactement 0.20/0.20/0.15/0.45). C-1 reste préféré.

**Baseline byte-identité (6 lignes buy) :** `3d49a867`→59, `c030901b`→57, `4d2fcfe8`→55, `fa6bcf89`→52, `7bb36e18`→52, `5d35d15d`→51 (tous `a_animer`, `data_completeness 0.50`).

### 4.5 Honnêteté + anti-double-count + dénominateur

- **NULL, jamais un neutre 50** quand non calculable.
- **Anti-double-count** : l'axe ne produit une valeur que si `surface_m2` ET `price` présents (déjà pénalisés une fois par `completeness_score`). NULL sur absence → jamais de double pénalité.
- **`data_completeness`** : dénominateur reste **2 pour buy** ; passe à **3 pour un mandat rent à segment valide**. `denominator = 2 + (market_eligible)::int`.
- `avg_comparable_price` **reste NULL** même quand l'axe tire (la MV stocke loyer/m², pas un prix absolu — ne pas fabriquer).
- **Winsor (note du un-defer)** : la MV winsorise globalement (p2.5/p97.5 sur tout le pool). La MÉDIANE est tail-robuste (inchangée), donc le signal `r = sujet/médiane` est intact en v1. **Mais `p25`/`p75` se compriment** sur les segments à très haut loyer (ex. ZH <50 : p75 75.00→72.68). Si le score-de-bien différé surface un jour des bandes p25/p75, envisager une winsorisation par-bande ou par-canton là-bas (shouldConsider SQL adopté pour D).

### 4.6 Couplage critique à surveiller au un-defer

Le join réservé dépend de l'orthographe `level` de la MV (`canton_surf`/`city_surf`/`npa_surf` + nullables par niveau). Reprendre **exactement** ces noms (déjà corrigé §4.3) sinon le join résout silencieusement rien (axe toujours NULL). **NPA multi-canton (1 cas live) :** garder `canton` dans toute clé npa future — la clé MV est `(canton, postal_code)`, pas `postal_code` seul.

### 4.7 Conditions de GATING pour un-defer (les 3 requises)

1. `market_rent_stats` live et rafraîchie (§1 shippé).
2. ≥1 mandat rent avec `surface_m2` + `price` + `canton` (aujourd'hui : 0).
3. Une passe de calibration des breakpoints sur des `r` réels résolus.

### 4.8 Fichiers que le un-defer toucherait (PAS en v1)

- `supabase/migrations/<14-digit>_property_scoring_v2_market_axis.sql` : `ON CONFLICT DO UPDATE` du bloc `market_alignment` + `weights5` dans `app_config.property_scoring_v1` (version→2) ; `CREATE OR REPLACE calculate_property_scores` (join §4.3 + courbe + branche C-1 + dénominateur §4.5). 0 DDL tables.
- `tests/backend/property_score_market_axis.spec.ts` : BEGIN/ROLLBACK, seed 1 mandat rent + 1 segment fake, assert blend 5-axes + 6 buy inchangés (régression byte-identité), qualifier colonnes ambiguës (leçons 42702/42703).

---

## 5. Plan de tests

### 5.1 (a) Test unit pur de `rentPosition` / courbe

**Fichier (NOUVEAU) :** `supabase/functions/_shared/rent-reference.test.ts` — co-localisé. **DOIT être ajouté par nom au `include[]` de `vitest.config.ts`** (le glob `tests/unit/**` ne ramasse PAS les `_shared/*.test.ts` ; vérifié : `esign-gateway.test.ts`/`pii-redaction.test.ts` existent non-listés et ne tournent jamais — c'est l'erreur ops la plus probable).

Fixtures :
```ts
import { describe, it, expect } from 'vitest'
import {
  buildRentStatsIndex, rentPosition, surfaceBand, positionFrac,
  buildRentReasonSuffix, DEFAULT_POSITION_CURVE, type RentStatsRow,
} from './rent-reference'

const GE_50_80: RentStatsRow = { level: 'canton_surf', canton: 'GE', type: 'apartment',
  surface_band: '50-80', postal_code: null, city: null,
  median_loyer_m2: 37.79, p25_loyer_m2: 31.44, p75_loyer_m2: 42.50, n_comparables: 128 }

// CORRECTION REVUE (mustFix honnêteté #2) : NPA fixture SYNTHÉTIQUE dont la
// médiane est DÉLIBÉRÉMENT distincte du canton — la distinctness EST le but du
// test (#12/#13 prouvent la SÉLECTION de niveau, pas une relecture du même
// nombre via deux chemins). On NE met PAS n=900 sur un NPA (forme impossible :
// la MV exige n>=20 ET le 8001 réel a n=13<20 → ne serait jamais matérialisé).
const ZH_NPA: RentStatsRow = { level: 'npa_surf', canton: 'ZH', type: 'apartment',
  surface_band: '<50', postal_code: '8001', city: null,
  median_loyer_m2: 64.00, p25_loyer_m2: 52.00, p75_loyer_m2: 78.00, n_comparables: 42 }
const ZH_CANTON: RentStatsRow = { level: 'canton_surf', canton: 'ZH', type: 'apartment',
  surface_band: '<50', postal_code: null, city: null,
  median_loyer_m2: 56.84, p25_loyer_m2: 44.00, p75_loyer_m2: 72.68, n_comparables: 1500 }
const idx = buildRentStatsIndex([GE_50_80, ZH_NPA, ZH_CANTON])
```

| # | Cas | Sujet | Attendu |
|---|---|---|---|
| 1 | surface null | `{GE,apartment,surface_m2:null,loyer:2645}` | `null` |
| 2 | surface ≤ 0 | `{...,surface_m2:0}` | `null` |
| 3 | loyer null | `{GE,apartment,surface_m2:70,loyer:null}` | `null` |
| 4 | loyer ≤ 0 | `{...,loyer:0}` | `null` |
| 5 | pas de segment | `{JU,apartment,70,1500}` | `null` |
| 6 | r=1 → frac 0.5 | GE apt 70 @2645 | `level==='canton_surf'`, `position_pct===0`, `frac≈0.50`, `expected_loyer_m2===37.79`, `n_comparables===128` |
| 7 | -20 % → frac haut | GE apt 70 @2120 | `position_pct===-20`, `frac∈(0.80,0.92]` et `<0.92` |
| 8 | -36 % → floor, pas 1.0 | GE apt 70 @1700 | `position_pct===-36`, `frac===DEFAULT_POSITION_CURVE.frac_floor` (0.62), **`frac<1`** |
| 9 | +20 % → frac bas | GE apt 70 @3170 | `position_pct===20`, `frac<0.50`, `frac>0.05` |
| 10 | +40 % → floor over | GE apt 70 @3700 | `position_pct===40`, `frac===frac_over` (0.05) |
| 11 | fallback canton si NPA absent | GE apt 70 @2645 + `postal_code:'1201'` | `level==='canton_surf'` |
| 12 | NPA préféré si présent | ZH apt 40 @2200 `postal_code:'8001'` | `level==='npa_surf'`, **`expected_loyer_m2===64.00`** (≠ canton 56.84 → discrimine vraiment le niveau) |
| 13 | fallback canton si NPA non indexé | ZH apt 40 @2200 `postal_code:'9999'` | `level==='canton_surf'`, **`expected_loyer_m2===56.84`** |
| 14 | garde collision de clé | index `[ZH_NPA, ZH_CANTON]` | les deux retrouvables (préfixe level désambigue) |
| 15 | edges surfaceBand | `49.99/50/79.99/80/119.99/120` | `'<50','50-80','50-80','80-120','80-120','120+'` |
| 16 | **courbe = hump (PAS monotone)** | voir détail ci-dessous | voir détail ci-dessous |
| 17 | div-by-zero | row `median_loyer_m2:0` | `null` (pas NaN/Infinity) |
| 18 | wording raison | `buildRentReasonSuffix({position_pct:-12,n_comparables:47,...})` | `'~12% sous le marché du secteur (sur 47 comparables)'` ; `0`→`'au prix du marché'` ; `9`→`'~9% au-dessus'` ; `n:1`→`'comparable'` (singulier) ; jamais `'valeur'`/`'garanti'` |
| 19 | r dégénéré dans la courbe | `positionFrac(0)`, `positionFrac(NaN)` | `frac_market` (0.50), no throw |

> **CORRECTION REVUE (mustFix honnêteté #1) — test #16 réécrit.** L'ancienne assertion « non-croissant / monotone » est FAUSSE (la courbe est un hump). #16 doit asserter la **forme honnête réelle** :
> ```ts
> it('#16 courbe = hump non-monotone (max à r_under)', () => {
>   const c = DEFAULT_POSITION_CURVE
>   // (a) NON-DÉCROISSANT sur [r_floor, r_under]
>   expect(positionFrac(0.70)).toBeLessThanOrEqual(positionFrac(0.78))
>   expect(positionFrac(0.78)).toBeLessThanOrEqual(positionFrac(0.85))
>   // (b) NON-CROISSANT sur [r_under, r_over]
>   expect(positionFrac(0.85)).toBeGreaterThanOrEqual(positionFrac(0.97))
>   expect(positionFrac(0.97)).toBeGreaterThanOrEqual(positionFrac(1.15))
>   expect(positionFrac(1.15)).toBeGreaterThanOrEqual(positionFrac(1.25))
>   // (c) max global = frac_under à r_under
>   expect(positionFrac(0.85)).toBeCloseTo(c.frac_under, 10) // 0.92
>   // (d) neutre exact au marché
>   expect(positionFrac(1.0)).toBe(0.50)
>   // (e) toutes les valeurs ∈ [frac_over, frac_under]
>   for (const r of [0.5,0.7,0.85,0.97,1.0,1.05,1.25,1.5]) {
>     const f = positionFrac(r)
>     expect(f).toBeGreaterThanOrEqual(c.frac_over)   // 0.05
>     expect(f).toBeLessThanOrEqual(c.frac_under)     // 0.92
>   }
>   // (f) sous le marché (r<r_market_lo) JAMAIS puni sous le neutre
>   for (const r of [0.5,0.7,0.85,0.90,0.96]) {
>     expect(positionFrac(r)).toBeGreaterThanOrEqual(c.frac_market) // >= 0.50
>   }
> })
> ```
> Ne contient PLUS le mot « monotone » / « non-croissant » global.

**Test unit complémentaire scorer** `tests/unit/rent-position-scoring.test.ts` (NOUVEAU) :

> **CORRECTION REVUE (mustFix SQL #2 + intégration #1) — régression contre BASELINE EN DUR, pas new-vs-new.** L'assertion « 3-arg === 4-arg(null) » est insuffisante : les deux exécutent le NOUVEAU code et seraient toutes deux gonflées de concert si le bonus polluait `totalWeight`. On asserte donc contre des **valeurs golden pré-PR figées** (le bonus étant additif, le total à `rentRef=null` DOIT égaler la formule 6-axes à `totalWeight=100`).

```ts
import { describe, it, expect } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import type { RentPosition } from '../../supabase/functions/_shared/rent-reference'

// Golden = scores produits par le barème 6-axes à totalWeight=100 (formule pré-PR).
// Capturés/recalculés à la main pour des candidats représentatifs. Le bonus
// additif NE doit PAS les bouger quand rentRef=null.
const cfg = DEFAULT_SCORING_CONFIG // version 3, mais barème 100 inchangé

describe('pricePosition = bonus additif (non-régression du barème 100)', () => {
  // 1) rentRef=null ⇒ identité au barème 6-axes (partiel-frac, pas seulement frac=1)
  it('candidat partiel-frac : total(null) == golden 6-axes', () => {
    const listing = { /* canton GE, type apartment, surface 70, price 2645, city partielle… */ }
    const criteria = { /* budget/zone/type/rooms tels que ≥1 axe inactif ET fracs partiels */ }
    const goldenTotal = /* nombre figé recalculé sans pricePosition, ex. 73 */ 73
    expect(calculateScoreV2(listing, criteria, cfg, null).total).toBe(goldenTotal)
  })

  // 2) buy : version 3 sur un sujet buy == ce que donnait version 2 (rentRef toujours null)
  it('candidat buy : aucun décalage de seuil (bonus 0)', () => {
    const buyListing = { /* transaction_type buy */ }
    const buyCriteria = { /* budget vente */ }
    const goldenBuyTotal = /* figé */ 0 // remplacer par la valeur réelle attendue
    expect(calculateScoreV2(buyListing, buyCriteria, cfg, null).total).toBe(goldenBuyTotal)
  })

  // 3) rentRef actif frac 0.5 ⇒ +0.5*7 = +3.5 pts (borné à 100)
  it('rentRef frac 0.5 ⇒ bonus additif borné', () => {
    const rentRef: RentPosition = { expected_loyer_m2: 37.79, p25: 31.44, p75: 42.5,
      n_comparables: 128, position_pct: 0, level: 'canton_surf', frac: 0.5 }
    const base = calculateScoreV2(listing, criteria, cfg, null).total
    const withBonus = calculateScoreV2(listing, criteria, cfg, rentRef).total
    expect(withBonus).toBe(Math.min(100, base + Math.round(0.5 * 7) ... )) // tenir compte du round global
  })

  // 4) suffixe appendé à budget.detail ; toujours 5 clés
  it('budget.detail enrichi sans 6ᵉ clé', () => {
    const rentRef: RentPosition = { /* position_pct:-12, n_comparables:47, frac:0.7… */ } as RentPosition
    const res = calculateScoreV2(listing, criteria, cfg, rentRef)
    expect(res.reasons.budget.detail).toMatch(/marché du secteur/)
    expect(Object.keys(res.reasons).length).toBe(5)
  })

  // 5) CORRECTION REVUE (honnêteté/intégration) : suffixe sur un budget « frein »
  //    ne mute jamais le verdict de l'axe.
  it('bien sous le marché ET hors budget : budget.match reste false + suffixe présent', () => {
    const overBudgetCriteria = { /* max < price du listing */ }
    const rentRefBelow: RentPosition = { /* position_pct:-12, frac:0.7 */ } as RentPosition
    const res = calculateScoreV2(listing, overBudgetCriteria, cfg, rentRefBelow)
    expect(res.reasons.budget.match).toBe(false)
    expect(res.reasons.budget.detail).toMatch(/sous le marché du secteur/)
  })
})
```
> Le coder remplace les `listing`/`criteria`/golden par des fixtures concrètes et recalcule les golden **à la main avec la formule 6-axes** (ou en capturant la sortie de `main` avant la PR). L'essentiel : l'assertion #1 est **new-code-vs-nombre-figé**, pas new-vs-new.

### 5.2 (b) Spec backend LIVE — `tests/backend/matching-rent-position.spec.ts`

S'exécute contre Supabase réel seedé en CI (les `skipIf` n'y sautent PAS). **Tout write wrappé en BEGIN/ROLLBACK ; colonnes ambiguës qualifiées.** Assertions :

1. **Médianes saines** : la MV renvoie, pour des segments connus, des médianes monotones/plausibles (ex. GE apartment bands) ; toutes `median/p25/p75 > 0`.
2. **Seuil n≥20 respecté** : `SELECT min(n_comparables) FROM market_rent_stats` ≥ 20.
3. **Résolution de fallback** : un sujet rent GE résout `canton_surf` (matching L1) ; via `rentPosition` direct, un sujet avec NPA présent dans la MV résout `npa_surf`, NPA absent retombe sur `canton_surf`.
4. **Reasons matching enrichi sans 6ᵉ clé** : un candidat rent connu scoré par l'exécuteur a `reasons.budget.detail` contenant `marché du secteur` ET `Object.keys(reasons).length === 5`.
5. **Refresh idempotent** : `REFRESH MATERIALIZED VIEW CONCURRENTLY public.market_rent_stats` deux fois ne change pas le nombre de lignes ni les médianes (déterminisme à donnée constante).
6. **Isolation / qualité colonnes** : tout `surface_band` ∈ `{'<50','50-80','80-120','120+'}` ; `level` ∈ `{'canton_surf','city_surf','npa_surf'}` ; `surfaceBand()` (importé) reproduit les bornes de chaque band (anti-drift §2.2). **CORRECTION REVUE (mustFix SQL #3) :** assertion qui **ÉCHOUE si une ligne du pool plausible a city/postal_code vide ou blanc** — re-jouer le WHERE de plausibilité de §1 et vérifier `count(*) FILTER (WHERE coalesce(trim(city),'')='' OR coalesce(trim(postal_code),'')='') = 0` (garde contre une dérive scraper introduisant une clé dégénérée `'||'`).
7. **CORRECTION REVUE — non-régression du barème + suffixe sur frein.** (a) un candidat **buy** scoré par l'exécuteur avec `cfg.version=3` donne le MÊME total qu'avec une copie de cfg à `version:2` (rentRef toujours null sur buy → bonus 0 → aucun décalage de seuil) ; (b) un candidat rent sous le marché ET hors budget garde `reasons.budget.match===false` avec le suffixe `sous le marché du secteur` présent.

### 5.3 (c) `npm run build` (tsc -b)

`npm run build` (tsc -b + vite) attrape les imports cross-fichier front. **Rappel (leçon mémoire) :** `supabase/functions/**` échappe à tsc front — le build ne type-check PAS l'edge. Donc l'import `RentStatsRow` ajouté §3.2(a), les value/type imports §3.1(a) et l'import `slugify` §2.3 ne sont PAS couverts par `npm run build` mais par : (1) le test unit câblé dans vitest qui IMPORTE `rent-reference.ts` (parse à la collecte), (2) la spec backend live qui importe l'exécuteur/scorer. C'est exactement pourquoi le bloc d'import edge §3.2(a) DOIT être complet (mustFix intégration #3) : une omission n'y serait captée qu'au deploy Deno (billing-locked → jamais).

---

## 6. Ordre de build (1 ou 2 PRs, pas de merge sans accord)

**Ordre strict (dépendances) :**

1. **Migration §1** → appliquée à la main via MCP `apply_migration` (verrou billing). Vérifier 285 lignes / `level` ∈ 3 valeurs / RPC lisible.
2. **Module pur §2 + test unit §5.1** (`rent-reference.ts` + `rent-reference.test.ts` + ajout au `vitest.config.ts include[]`). `npm run test:unit` vert. Note : `rent-reference.ts` importe `slugify` de `matching-normalize.ts` → s'assurer que le test résout cet import (chemin relatif `./matching-normalize`).
3. **Wiring matching §3** (`matching-normalize.ts` + `matching-engine/index.ts` + UPDATE `app_config.matching_scoring_v2` via MCP + test unit scorer §5.1).
4. **Spec backend §5.2** (`matching-rent-position.spec.ts`).
5. **`npm run build` §5.3** en dernier.

**Découpage PR recommandé :**
- **PR 1 = migration + module pur + test unit** (étapes 1-2). Mergeable indépendamment : la MV existe, le module est testé, rien ne consomme encore → zéro impact matching. (Le module importe `slugify` de `matching-normalize.ts`, déjà présent sur `main` → pas de dépendance vers du code non encore écrit.)
- **PR 2 = wiring matching + spec backend + UPDATE config** (étapes 3-5). Dépend de PR 1 mergée.

> Cohérent avec l'ordre inter-composants : **MV d'abord, puis le module, puis l'injection** — sinon l'edge donne un index vide (bonus 0) tant que la MV n'existe pas.

---

## 7. Notes OPS

- **Verrou billing GitHub Actions** : deploys post-merge sur `main` échouent (account locked). Migration + UPDATE `app_config.matching_scoring_v2` s'appliquent **à la main via Supabase MCP `apply_migration`**. Tout est **idempotent** → re-run sûr même si absent de `schema_migrations`. Risque connu : un `supabase db push` ultérieur pourrait re-jouer la migration — l'idempotence le tolère.
- **Edge type-check gap** : `supabase/functions/**` échappe à `tsc` et au vitest par défaut. (1) le test unit du module **DOIT** être dans `vitest.config.ts include[]` ou il est mort ; (2) la spec backend live **importe l'exécuteur/scorer** pour couvrir l'edge à la collecte + au run en CI.
- **Tests live en CI** : `tests/backend/*.spec.ts` tournent contre un Supabase réel seedé. BEGIN/ROLLBACK sur tout write ; qualifier les colonnes ambiguës (leçons 42702/42703).
- **Fenêtre stale (honnêteté élargie — shouldConsider SQL adopté)** : le refresh est à `45 4`, mais `flatfox-sync` @ `00 4` est fire-and-forget / self-chunking **sans hook "terminé"**. Si le sync tourne encore à 04:45, le refresh voit non seulement la donnée d'hier mais **une table partiellement mise à jour aujourd'hui** (stale-within-today, pas seulement stale-by-one-day). Acceptable (signal advisory, pas un gate dur), mais le commentaire est désormais honnête là-dessus. Voisinage cron 04:30/04:40/04:45 (medians/learn-agent-style/rent-stats) : pas de collision, `CONCURRENTLY` ne bloque pas.
- **CASCADE sur DROP MV** : rien ne dépend de `market_rent_stats`. Vague 3 ne doit PAS construire de dépendant (vue/MV) que la migration idempotente droperait en CASCADE au re-apply.

---

## 8. Décisions ouvertes consolidées (pour Gregory / Julien)

1. **Slot de refresh** : recommandé `45 4`. Si ops préfère une fenêtre unique, `30 4` possible. Décision ops.
2. **`min_comparables` = 20** : verrouillé. **Piège documenté** : `HAVING count(*) >= 20` est un littéral SQL (une MV ne lit pas `app_config` au refresh), donc `config.min_comparables` est doc/UI seulement. Changer le seuil = bouger **les deux ensemble**. Commentaire `-- DOIT égaler … bouger les DEUX ensemble` désormais inline sur les 3 `HAVING` (shouldConsider honnêteté adopté). Même caveat `winsor.p_lo/p_hi`.
3. **Courbe matching** : défaut opiniâtre `r_floor 0.70 / r_under 0.85 / r_market 0.97-1.05 / r_over 1.25` ; fracs `0.62/0.92/0.50/0.05` ; config-driven, recalibrable sans redeploy. **Hump non-monotone assumé** (max 0.92 à r=0.85) — ne pas « corriger » en rampe.
4. **Bande neutre du suffixe** : ±3 % → « au prix du marché du secteur ». Wording. Confirmer ±3 vs ±5.
5. **Poids `pricePosition` = 7 (bonus)** : tunable via `app_config` sans redeploy. C'est un bonus additif (max +7 pts, borné à 100), PAS un axe redistribué. Confirmer 7.
6. **Politique `score_version`** : bump → 3 ne tamponne que les nouvelles lignes. Recommandé : accepter la frontière. Re-scorer pour une version uniforme doit **lancer le moteur complet** (pas un UPDATE aveugle).
7. **Persistance position** : v1 reason-only (0 DDL). Si « % de matches sous le marché » voulu : décider plus tard ADD COLUMN + édition des deux RPC, ou sous-objet non-rendu dans `reasons` jsonb.
8. **Rung `city_surf`/NPA au matching** : la RPC `match_candidate_listings` renvoie `city` mais PAS `postal_code` → v1 plafonné L1 **par choix de scope** (pas parce que city manque — city EST disponible). Activer le rung city plus tard = pur changement edge (charger `level IN ('canton_surf','city_surf')`, passer `subject.city`, **valider que `slugify(subject.city)` matche la forme stockée dans `market_rent_stats.city`**) ; NPA exigerait un changement de RPC. **Caveat couplage** : slug B (`slugify` partagé) ↔ city stockée par A ; dormant en v1, à valider avant d'activer. Note agent-facing : « secteur » = niveau canton en v1.
9. **`canton_type` (band-null, terminal)** : gardé dans le type/fallback de B mais **non matérialisé par A en v1** → rung jamais atteint. Confirmer si A doit l'émettre un jour (sinon le retirer du type au cleanup).
10. **Score-de-bien différé (§4)** — au un-defer : (a) calibrer breakpoints sur de vrais `r` ; (b) C-1 (recommandé, byte-identique par construction) vs C-2 (`{0.18,0.18,0.135,0.405,0.10}`) — **jamais** `{...,0.14,0.40,...}` ; (c) poids marché 0.10 à confirmer ; (d) finesse NPA/city ; (e) dénominateur `2 + market_eligible::int` ; (f) **winsorisation par-bande/par-canton** si p25/p75 surfacés (la winsor globale comprime le p75 des segments haut-loyer ; médiane intacte donc v1 OK).

---

**Fichiers livrés en v1 :** `supabase/migrations/20260618210000_market_rent_stats.sql`, `supabase/functions/_shared/rent-reference.ts`, `supabase/functions/_shared/rent-reference.test.ts`, édits `supabase/functions/_shared/matching-normalize.ts` + `supabase/functions/matching-engine/index.ts`, édit `vitest.config.ts`, UPDATE DB `app_config.matching_scoring_v2`, `tests/unit/rent-position-scoring.test.ts`, `tests/backend/matching-rent-position.spec.ts`. **§4 (score-de-bien) = 0 fichier.**

---

## Corrections de la revue

### mustFix intégrés (8/8)

| # | Revue | Issue | Résolution dans la spec |
|---|---|---|---|
| 1 | SQL #1 + Intégration #1 (même racine) | **Byte-identity break** : `pricePosition` ajouté à `axes[]`/`totalWeight` inflate `scale = totalWeight/liveWeight` de 100→107 même inactif → +7 % sur 100 % buy/internes/~75 % rent ; franchissements de seuil parasites. Confirmé à la source (`matching-normalize.ts` l.217-219). | **Root cause corrigée :** §3.1 réécrit. L'instruction « pousser dans `axes[]` » est **supprimée**. `pricePosition` devient un **bonus ADDITIF** : `const pricePosP = rentRef ? clamp(rentRef.frac,0,1)*W.pricePosition : 0`, ajouté au sous-total 6 axes, `totalWeight` reste 100. Identité prouvée par construction quand `rentRef=null` (`pricePosP=0` → expression d'origine caractère pour caractère). §0.1 + §0.2 + §3.1(c)(f) + §3.2(c) reformulés « bonus additif ». |
| 2 | SQL #2 | Le test « rentRef=null === 3-args » est **new-vs-new** → passe en restant gonflé, masque la régression. | §5.1 test scorer réécrit : assertion #1 = **new-code-vs-baseline golden EN DUR** (total à `rentRef=null` == formule 6-axes à `totalWeight=100`, nombre figé). + test buy version3==version2. §5.2 #7 ajoute la même garde en live. |
| 3 | SQL #3 | L'unicité de l'index repose sur le schéma alors que NOT NULL ≠ non-vide ; un `''` scraper créerait une clé dégénérée. | Commentaire MV (2) réécrit pour citer le **fait vérifié live** (city/pc null/empty/blank=0, 285=285), pas le schéma. §5.2 #6 ajoute une assertion qui échoue si une ligne du pool a city/postal_code vide/blanc. |
| 4 | Honnêteté #1 | Test #16 asserte « monotone / non-croissant » — **FAUX** : la courbe est un *hump* (max 0.92 à r=0.85). Un coder le « corrigerait » en rampe et supprimerait la garde anti-erreur. | §5.1 #16 **entièrement réécrit** : asserte non-décroissant sur [r_floor,r_under], non-croissant sur [r_under,r_over], max=frac_under à r_under, neutre 0.50 à r=1, bornes [0.05,0.92], sous-marché ≥ 0.50. Mot « monotone » supprimé. §0.3 + §2.5 documentent explicitement le hump « ne pas corriger ». |
| 5 | Honnêteté #2 | Fixture `ZH_NPA` impossible : `n=900` sur un NPA (la MV exige n≥20 ET le 8001 réel a n=13), portant la médiane DU CANTON (56.84) → #12/#13 ne discriminent rien. | §5.1 fixtures : `ZH_NPA` synthétique **distinct** (médiane 64.00, n=42) ≠ `ZH_CANTON` (56.84). #12/#13 assertent désormais `expected_loyer_m2===64.00` vs `===56.84` → prouvent la sélection de niveau. Commentaire « distinctness EST le but ». |
| 6 | Intégration #3 | Bloc d'import edge §3.2(a) **incomplet** : `RentStatsRow` utilisé en (b) mais absent de l'import (note en prose seulement) → `Cannot find name`, non capté par tsc/vitest (edge échappe), surface au deploy (billing-locked → jamais). | §3.2(a) : import edge **complet et explicite** incluant `type RentStatsRow`. §3.1(a) : import `matching-normalize.ts` **consolidé** en un value-import + un type-import (plus d'éparpillement (a)/(f)/(i)). |
| 7 | Intégration #2 | `score_version` 3 + le bug d'inflation décalent aussi les matches **buy/internes** (le gate `tx==='rent'` ne supprime que le texte, pas l'inflation). | **Résolu automatiquement par #1** (bonus additif) : sur buy `rentRef=null` → `pricePosP=0` → score buy byte-identique à v2, zéro décalage de seuil. Garde explicite ajoutée §3.2(c) + assertion live §5.2 #7(a). |
| 8 | (sous #1) | La version « 107-pt scale » serait permise mais impose de **supprimer toutes les claims byte-identité**. | Choix tranché : on garde le bonus additif (identité préservée), on ne bascule PAS sur le scale 107. Toutes les claims byte-identité (§3.1, §3.2.d) restent **vraies** avec le nouveau code. |

### shouldConsider — adoptés

- **SQL — index L1 inutilisé en v1** : gardé comme **forward-provisioning** du LATERAL join du score-de-bien différé, commenté comme tel (§1 bloc 2bis). (Pas droppé : il sert §4 au un-defer.)
- **SQL — winsor globale comprime le p75 des segments haut-loyer** : noté §4.5 + §8 #10(f) pour le score-de-bien différé (winsor par-bande/par-canton si p25/p75 surfacés). Immatériel en v1 (médiane robuste).
- **SQL — NPA multi-canton (1 cas)** : couplage noté §4.6 (garder `canton` dans toute clé npa future).
- **SQL/Intégration/Honnêteté — fenêtre stale-within-today** : commentaire OPS §7 rendu honnête (sync fire-and-forget sans hook → table partiellement à jour possible, pas seulement stale-by-one-day).
- **SQL/Honnêteté — rationale L1 imprécise** : §3.2(b) + §8 #8 corrigés (« city EST disponible ; L1 est un choix de scope », pas « la RPC ne renvoie pas city »).
- **Intégration — `citySlug` divergent** : remplacé par réutilisation du `slugify` exporté de `matching-normalize.ts` (§0.2 + §2.3). Évite deux logiques de slug à synchroniser au un-defer du rung city.
- **Intégration — try/catch décoratif** : remplacé par destructuration de `error` + log (§3.2.b) ; dégradation gracieuse via `?? []`.
- **Honnêteté — min_comparables littéral** : commentaire inline `-- DOIT égaler … bouger les DEUX ensemble` ajouté sur les 3 `HAVING` (§1) + §8 #2.
- **Honnêteté — hump non documenté en prose** : phrase explicite ajoutée §2.5 header + §8 #3.

### shouldConsider — déclinés (avec raison)

- **Honnêteté/Intégration — supprimer le suffixe quand `budget.match=false`** : **décliné.** `mapReasons` dérive `ok`/`pts` de `v.match`/`v.score`, jamais du texte → le suffixe ne peut PAS transformer un frein en force (vérifié l.322-325). Afficher « hors budget mais sous le marché » est honnête et utile à l'agent (bonne affaire marché malgré le dépassement). On verrouille plutôt le comportement par test (§5.1 #5 scorer + §5.2 #7(b)) au lieu de masquer une information vraie. Suppression = perte d'info sans gain compliance.
- **Intégration — `import type` non utilisés (`positionFrac`/`DEFAULT_POSITION_CURVE`/`PositionCurve`) au scorer** : **conditionnellement décliné.** Le scorer réutilise `rentRef.frac` (pas de recalcul), donc ces imports peuvent paraître inutiles. Gardés pour documenter le contrat de courbe et permettre une calibration future ; note §3.1 fin laisse le coder les retirer **si et seulement si** le linter Deno réel les signale (comportement runtime identique). Pas de décision en dur car le lint edge n'est pas observable localement (edge gap).

### Verdict consolidé

**SHIP-WITH-FIXES → tous les mustFix intégrés ; spec prête à coder en Vague 3.**

Les 3 lentilles convergeaient sur **une seule racine** (le bonus `pricePosition` polluant la redistribution `totalWeight`), confirmée indépendamment par les reviewers SQL et Intégration avec preuve numérique, et vérifiée par moi à la source (`matching-normalize.ts` l.217-219). Cette racine corrigée fait tomber 3 des 8 mustFix (#1, #7, #8) d'un coup et restaure toutes les garanties byte-identité (buy/internes/rent-sans-ref inchangés, frontière `score_version=3` honnête). Les 5 autres mustFix (tests masquants #2, index dégénéré #3, courbe-hump #4, fixture impossible #5, import edge #6) sont des corrections locales et littérales. Les forces relevées par les 3 revues (MV correcte 285 lignes/245 ms, CONCURRENTLY sûr, honnêteté n≥20 par construction, contrat 5 clés gardé par un test existant, déféré §4 honnête par la donnée) sont préservées sans affaiblissement. Aucune garantie d'honnêteté ni de non-régression n'a été diluée pour silencer un reviewer — chaque correction attaque la cause, pas le symptôme.
