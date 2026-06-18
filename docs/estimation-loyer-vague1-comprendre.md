# Vague 1 — Comprendre : Référence de loyer marché (signal backend déterministe, locations d'abord)

> Synthèse d'entrée pour **Vague 2 (Concevoir)**. Plan maître = `docs/estimation-loyer-plan.md`
> (branche `claude/estimation-loyer-plan-doc`, commit `ed79ffe6`, pas encore sur `main`).
> Méthode : 3 vagues (Comprendre → Concevoir → Implémenter + revue adversariale + tests live → cerveau).
> **Tous les chiffres ci-dessous ont été re-dérivés live (prod eayczugyrvmtqnnmvjod) et recoupés** ;
> conflits signalés ; aucun chiffre inventé. Cadrage verrouillé : signal **backend déterministe (0 LLM)**
> qui mesure une **position vs marché** (prix demandés), **jamais** un estimateur public ni une valeur garantie.

---

## 1. Faits données confirmés

- **Pool brut.** `market_listings` actives : **34 661 rent / 12 buy** (la vente est un désert → location d'abord).
- **Estimable brut** (rent avec `current_price|price` + `surface_m2` + `canton` non-null) = **25 269**, mais **~18 % pollué** (montant/surface aberrants).
- **Pool propre** après filtre de plausibilité (montant 200–20 000 CHF/mois, surface 8–1000 m²) : **~20 717 tous types → ~16 068 RÉSIDENTIEL** (`type IN ('apartment','house','villa')`). **Concevoir sur le 16 068 résidentiel propre, pas sur le 25 269 brut.** *(re-vérifié : 16 068)*
- **Montant canonique.** Loyer mensuel = `COALESCE(current_price, price)` en CHF. `rent`/`rent_chf` **MORTES** (NULL). Source : `matching-normalize.ts:182` (l'app lit déjà `current_price ?? price`).
- **⚠ Piège `price_per_m2`.** Colonne **75 % NULL sur le rent** (8580/34661 non-null). `flatfox-sync/index.ts:428` écrit `current_price` mais **jamais `price_per_m2`** ; cette colonne n'est posée que par `market-scraper`/`external-matching` à partir d'une métrique de **VENTE**. ⇒ **ne pas** bâtir le signal loyer sur `price_per_m2` ni sur la vue `cantonal_price_medians` (aveugle au rent). **Calculer loyer/m² LIVE = `COALESCE(current_price,price)/surface_m2`.**
- **Bornes d'outliers.** Percentiles loyer/m² bruts = bruit (p97.5 = 7384) ⇒ **filtre dur de plausibilité D'ABORD, winsorisation ENSUITE**. Dans la bande plausible : loyer/m² **p2.5 = 0,96 · p50 = 23,71 · p97.5 = 73,33**.
- **Surface manquante** : ~9k annonces rent sans surface (impossibles à scorer en loyer/m²).
- **Cadence flatfox.** `flatfox-sync-daily` = `0 4 * * *` (04:00 UTC) actif ⇒ un agrégat matérialisé rafraîchi **juste après le sync** est la cadence naturelle.
- **Index.** Aucun index `market_listings` ne supporte un GROUP BY canton/type/surface/prix ⇒ pré-calcul (MV) obligatoire, pas de GROUP BY live dans le hot path (statement_timeout 15s sur 34k).

**Conflit mineur (sans incidence) :** ground truth 34 661 rent vs note cerveau matching-v2 « 34 693 » — écart ~0,09 %, fraîcheur de snapshot. Retenir **34 661**. Aucun seuil n'en dépend.

---

## 2. Segmentation recommandée

Base résidentielle propre (16 068 lignes ; `rooms`, `postal_code`/NPA, `city` 100 % non-null ; 21 cantons, 1934 NPA distincts, 3 types).

**Edges SURFACE (4 bandes) :** `<50 / 50-80 / 80-120 / 120+ m²`. Ancrés sur les quartiles réels (p25=55, p50=78, p75=100, p90=130) et une échelle loyer/m² monotone *(re-vérifiée live)* : **<50 → 41,8** (n=3119) / **50-80 → 25,5** (n=5136) / **80-120 → 21,8** (n=5503) / **120+ → 19,9** (n=2310). Prime petite surface **+64 %** vs 80-120 ⇒ **la surface est le plus fort driver non-géo.**

**Edges PIÈCES (si utilisée, 5 bandes) :** `≤1.5 / 2-2.5 / 3-3.5 / 4-4.5 / 5+`. **Reco : ne PAS faire de `rooms` une clé de segment dure en v1** (coûte ~7,5 pts de couverture n≥20 : 97,8 %→90,3 %).

**Seuil min-n :** **20 comparables** (médiane stable, résout 99,4 %, garde 38,6 % à un cran géo plus fin ; 15 = plus de bruit, 30 = moins de géo).

**Hiérarchie de fallback** (pas de colonne commune/district ; `city` et `postal_code` existent) :
`NPA×type×surf → city×type×surf → canton×type×surf → canton×type`.
À min-n=20 : NPA 26,8 % · city 11,8 % · canton×surf 59,2 % · canton×type 1,6 % · **non résolu 0,6 %** ⇒ **99,4 % résolu, dont 38,6 % géo-fin**. Le rung `city` n'est pas redondant (477 NPA couvrent >1 ville).

**Niveau primaire viable le plus fin = `canton×type×surface_band`** (148 segments, **97,8 % à n≥20** *re-vérifié*), avec **raffinement géo descendant opportuniste** (NPA/city quand la cellule fine a elle-même n≥20). NPA en primaire est impossible (NPA×type×surf s'effondre à 26,8 %).

| Niveau | segs | n≥10 | n≥20 | n≥30 |
|---|---|---|---|---|
| L0 canton×type | 52 | 99,7 | 99,4 | 98,8 |
| **L1 canton×type×surf** | **148** | **99,1** | **97,8** | 96,7 |
| L2 +rooms | 453 | 95,3 | 90,3 | 85,0 |
| L3 NPA×type | 2314 | 69,8 | 56,7 | 47,3 |
| L3 city×type | 2748 | 66,0 | 54,0 | 46,1 |
| L4 NPA×type×surf | 4422 | 46,4 | 26,8 | 17,8 |

**Verdict dispersion géo :** NPA = **luxe métropolitain** (additif là où dense), pas une granularité nationale. ZH : IQR inter-NPA 8,2 (~±25 %), 48 NPA denses ⇒ compte beaucoup. GE : IQR 2,4 (~6 %), 7 NPA denses ⇒ géo n'apporte presque rien. VD : NPA denses (p25=30,0) au-dessus de la médiane canton (28,7) — longue traîne rurale. ⇒ dorsale `canton×type×surf`, NPA en raffinement.

---

## 3. Qualité & nettoyage

**Pré-filtre de plausibilité DUR (avant tout percentile/médiane) :** montant ∈ [200, 20 000] CHF/mois ; `surface_m2` ∈ [8, 1000] m² ; `type IN ('apartment','house','villa')` ; `canton` non-null ; `status='active'` ; `transaction_type='rent'`. **Ordre non négociable** : sans lui, p97.5 = 7384.

**Winsorisation APRÈS pré-filtre :** borner loyer/m² aux percentiles de la bande plausible (p2.5=0,96, p97.5=73,33) avant médiane/p25/p75 par segment. `percentile_cont` reste l'estimateur robuste.

**Surface manquante (~9k)** : exclues du calcul ; côté score de bien, mandat sans surface ⇒ axe marché **NULL**, jamais inventé.

**Périmètre type résidentiel :** mix réel = apartment 15 455 (96,2 %) · house 561 (3,5 %) · **villa 52 (0,3 %)**. La villa est trop rare pour un segment fin — v1 ne promet pas de position villa-spécifique (fallback canton×type, voire fusion house+villa).

---

## 4. Structure de la primitive (préfiguration Vague 2)

**Nouvelle vue matérialisée `market_rent_stats`** (PAS d'extension de `cantonal_price_medians`, rent-aveugle). Aucune table de référence n'existe aujourd'hui.

- **Clé de segment :** `(level, canton, type, surface_band, [postal_code|city])` — une ligne par niveau résolvable (L1 systématique ; NPA/city là où n≥20).
- **Mesures :** `median_loyer_m2` (p50), `p25_loyer_m2`, `p75_loyer_m2`, `n_comparables`.
- **Calcul :** LIVE depuis `COALESCE(current_price,price)/surface_m2`, bande plausible résidentielle. Jamais `price_per_m2`.
- **Refresh :** `REFRESH MATERIALIZED VIEW [CONCURRENTLY]` juste après `flatfox-sync-daily` (04:00). Lecture depuis snapshot statique, jamais recalculé par match.
- **Garde-fou seuil :** ne matérialiser un segment **que si `n_comparables ≥ 20`** (honnêteté par construction — les cellules sous seuil n'existent pas). Index unique sur la clé (sert le CONCURRENTLY + le lookup).

**Fonction pure `rentPosition(subject, stats)` (déterministe, 0 LLM, zéro I/O — calque `matching-normalize.ts`) :**
- **Entrée :** `{ canton, type, surface_m2, loyer = COALESCE(current_price,price), postal_code?, city? }`.
- **Résolution :** fallback `NPA×type×surf → city×type×surf → canton×type×surf → canton×type`, s'arrête au cran le plus fin **présent dans la MV** (donc déjà n≥20).
- **Calcul :** `subject_loyer_m2 = loyer/surface_m2` ; `r = subject_loyer_m2/median` ; `position_pct = round((r-1)*100)`.
- **Sortie :** `{ expected_loyer_m2, range:[p25,p75], n_comparables, position_pct, level }` ou **`null`** (aucun segment ≥ seuil OU surface/loyer absent).
- **Cadre :** « position vs marché », jamais « valeur correcte ». Sous seuil/sans surface ⇒ neutre/absent.

---

## 5. Point de branchement MATCHING (le moins invasif)

Deux étages : pré-filtre dur SQL `match_candidate_listings` (seul `transaction_type` dur) puis scorer soft pur `calculateScoreV2`. **Vérifié** : la redistribution de poids (axe inactif cède son poids aux actifs via `scale = totalWeight/liveWeight`, `matching-normalize.ts:208-231`) rend l'ajout d'un axe **mathématiquement sûr** — un axe `active:false` laisse le barème à 100 pts **identique** pour les ~75 % de candidats sans référence.

**(a) Nouveau poids soft tunable `weights.pricePosition`** (~6-8 pts) dans `DEFAULT_SCORING_CONFIG` + un axe `scorePricePosition` qui renvoie `{active:false}` sans référence. **Vérifié** : `parseScoringConfig` (l.145-159) fait `{...DEFAULT.weights, ...(raw.weights ?? {})}` ⇒ l'`app_config` live (sans la clé) **continue de marcher**, poids tunable **sans redéploiement**. Axe **hors** du bloc de fusion rooms (l.234-238). Quand actif : `frac` déterministe de loyer/m² vs médiane — **neutre 0,5 au marché, →1 sous le marché, →0 nettement au-dessus**. Orthogonal à l'axe budget (32 pts) : budget = fit vs budget **acheteur** ; pricePosition = loyer/m² vs **médiane segment**.

**(b) Où lire la référence :** **pré-calcul + lookup JS Map dans l'edge fn**, pas de GROUP BY live. **Vérifié** : `match_candidate_listings` RETURNS TABLE expose `canton, type, surface_m2, current_price, price` ⇒ loyer/m² + lookup **L1** calculables côté edge **sans changer la signature RPC**. Charger `market_rent_stats` une fois par invocation dans une `Map` clé `canton×type×surface_band`.

**(c) Surfacer la raison FR SANS 6ᵉ clé :** **Vérifié** : `MatchReasons` = EXACTEMENT 5 clés `budget/zone/type/rooms/features` (`matching-normalize.ts:163-169`) ; `mapReasons` (`useAtelierMatching.ts:241-251`) itère `Object.entries` en aveugle ⇒ une 6ᵉ clé = **ligne parasite**. **Solution : appender au `budget.detail` existant** (ex. `Dans le budget · ~12% sous le marché du secteur (sur 47 comparables)`). `composeAiHint` lit déjà `budget.detail` ⇒ MEGGA AI hérite du phrasé. Zéro nouvelle clé, zéro changement de schéma.

**Plafond L1 :** la RPC ne renvoie **pas** `postal_code` ⇒ v1 verrouillé à L1 (canton×type×surf). NPA-level plus tard = altérer le RETURNS TABLE ou une passe de lookup dédiée (décision Vague 2 délibérée).

---

## 6. Point de branchement SCORE DE BIEN

`calculate_property_scores` (`20260616190000`) = somme pondérée fixe de 4 axes : `0.20·freshness + 0.20·interest + 0.15·pipeline + 0.45·completeness`, clampée [0..100]. Les colonnes marché (`market_position_score`, `comparable_count`, `avg_comparable_price`, `price_vs_market_pct`) sont **déjà forcées à NULL** (« jamais fabriqué : marketplace OFF »).

**Design du 5ᵉ axe « alignement marché » (mandats locatifs) :**
- **Entrée :** `loyer/m² = COALESCE(p.price,…)/p.surface_m2` (price = loyer quand `transaction_type='rent'`), `type` résidentiel, lookup `market_rent_stats` ⇒ `r = subject_loyer_m2/median`.
- **Courbe (position, pas valeur), pénalité asymétrique** (le sur-marché fait plus mal, car actionnable) : `r∈[0.90,1.05]→90-100` ; `[0.80,0.90]→80-95` ; `<0.70→tapering ~60` (suspicion data) ; `[1.05,1.20]→60→40` ; `>1.30→plancher 20-30` (jamais 0). Breakpoints dans `app_config.property_scoring_v1` (bloc `market_alignment`), jamais en dur.
- **Écriture :** brut dans `market_position_score` (**colonne déjà existante, 0 DDL**), `comparable_count=n`, `price_vs_market_pct=round((r-1)*100)`.

**Re-pondération honnête (Option C — neutralize-and-renormalize-on-absence) :** poids nominaux ex. `{freshness:0.18, interest:0.18, pipeline:0.14, completeness:0.40, market:0.10}` ; si `market_score IS NULL` (buy, ou rent < seuil, ou surface/prix absent) ⇒ renormaliser sur les 4 axes présents en gardant 0.20/0.20/0.15/0.45 ⇒ **reproduit les 6 scores buy actuels octet pour octet** (live : overall 51-59, tous `a_animer`). Anti-double-comptage : l'axe marché ne produit une valeur que si surface ET prix présents (sinon NULL renormalisé, `completeness` porte seule la pénalité). `data_completeness` : dénominateur 2 pour buy, 3 pour rent à segment valide.

**Décision de ship v1 : DÉFÉRER l'axe score-de-bien.** `properties` = **6 lignes, 100 % buy, 0 mandat rent** ⇒ l'axe est structurellement inapplicable à 100 % des mandats actuels. Shipper sans donnée = l'anti-pattern documenté (« cold à 2517 matches »). Réserver le design (Option C, `market_position_score` existe ⇒ coût DDL futur ≈ 0), **gated** sur : (1) `market_rent_stats` live, (2) ≥1 mandat rent avec surface+prix, (3) calibration des breakpoints.

---

## 7. Décisions tranchées vs ouvertes

### Tranchées par la donnée (ne pas re-débattre)
1. **Loyer/m² LIVE** = `COALESCE(current_price,price)/surface_m2`. `price_per_m2` (75 % NULL) et `cantonal_price_medians` écartés. `rent`/`rent_chf` mortes.
2. **Pré-filtre de plausibilité D'ABORD** (200–20 000 CHF, 8–1000 m², résidentiel), winsorisation ensuite. Concevoir sur **16 068**.
3. **Périmètre résidentiel** : `type IN ('apartment','house','villa')` (exclut ~23 % bureau/commerce/parking). Villa (52) sans segment fin.
4. **Edges surface** : `<50/50-80/80-120/120+` (41,8/25,5/21,8/19,9).
5. **Primaire = `canton×type×surface_band`** ; NPA/city = raffinement additif descendant uniquement là où dense.
6. **Fallback** : `NPA×type×surf → city×type×surf → canton×type×surf → canton×type`.
7. **Nouvelle MV `market_rent_stats`**, rafraîchie post flatfox-sync (04:00).
8. **Matching : axe inactif cède son poids** (mécanique vérifiée l.208-231) ⇒ `pricePosition` ne touche pas le barème pour les ~75 % sans référence.
9. **Pas de 6ᵉ clé reasons** : surfacer dans `budget.detail`.
10. **Score de bien : pas d'inférence sur donnée vide** ⇒ NULL, jamais un milieu neutre.

### Ouvertes — vrais choix produit pour Gregory/Julien
1. **Seuil min-n exact** : reco **20** ; 15 (plus de localité, plus de bruit) vs 30 (moins de géo).
2. **Poids `pricePosition`** dans le matching : reco **6-8 pts** ; valeur finale tunable via `app_config`.
3. **`rooms` comme clé de segment ?** Reco **non en v1** (coûte ~7,5 pts de couverture).
4. **Granularité géo** : reco `canton×type×surf` backbone + NPA opportuniste ; jusqu'où pousser le NPA (métropoles seulement ?).
5. **Axe score-de-bien inerte en v1 ?** Reco **différer** (0 mandat rent).
6. **Backfill `score_version`** des matches re-scorés vs accepter le gap.

---

## 8. Risques & garde-fous

1. **Piège `price_per_m2`** (75 % NULL, métrique de vente) ⇒ loyer/m² live uniquement.
2. **Contamination par type** (~23 % non-résidentiel) ⇒ filtrer dur `type IN ('apartment','house','villa')`.
3. **Malhonnêteté sous seuil** : segment fin < min_comparables ⇒ NULL, jamais une médiane sur 3-4 comparables. Exposer `comparable_count`.
4. **Double-comptage matching** : budget (32 pts) récompense déjà in-budget ; garder `pricePosition` orthogonal (vs médiane segment), poids petit, neutre 0,5 au marché.
5. **Double-comptage score-de-bien** : surface/prix manquants pénalisent déjà `completeness` ; l'axe marché ne re-pénalise pas (NULL renormalisé), `data_completeness` ne gonfle pas sur buy.
6. **Perf (pas d'index → MV)** : GROUP BY live dépasserait le statement_timeout 15s sur 34k ⇒ MV + lookup JS Map ; `REFRESH … CONCURRENTLY` ⇒ index unique requis.
7. **Lignes UI parasites** : 6ᵉ clé rendue par `mapReasons` (l.243) ; les 2700 matches prod ont exactement 5 clés. Tenir le FR dans `budget.detail`.
8. **Verrou billing/deploy GitHub Actions** : déploiements post-merge échouent ⇒ migrations à appliquer à la main via Supabase MCP, idempotentes, possiblement absentes de `schema_migrations`.
9. **Edge type-check gap** : `supabase/functions/**` (Deno) échappe à `tsc`/vitest-unit ⇒ couvrir `rentPosition` par un test unit pur + un spec `tests/backend` qui importe l'exécuteur (run live en CI).
10. **Tests live BEGIN/ROLLBACK** : specs backend tournent contre un Supabase réel seedé en CI ⇒ encadrer les écritures en transaction, qualifier les colonnes ambiguës (`42702`/`42703`).
11. **Bord de bande surface** : loyer/m² saute fort au seuil <50 (41,8 vs 25,5) ⇒ 49 vs 51 m² basculent de référence (discontinuité « position vs marché » près des bords) — préoccupation Vague 2 au **scoring** (référence soft/mélangée près des edges), pas un changement de segmentation.
12. **Biais canton VD** : NPA denses (p25=30,0) au-dessus de la médiane canton (28,7), tirée par la traîne rurale ⇒ le fallback canton sous-estime l'urbain.

---

## Fichiers de référence (ancrage)

- `supabase/functions/_shared/matching-normalize.ts` — axes, redistribution l.208-231, contrat 5 clés l.163-169, `parseScoringConfig` l.145-159, montant canonique l.182.
- `src/hooks/useAtelierMatching.ts` — `mapReasons` l.241-251 + `REASON_LABELS` 5 clés.
- `supabase/functions/matching-engine/index.ts` — appel `calculateScoreV2`, RPC `match_candidate_listings`.
- `supabase/migrations/20260616190000_property_scoring_v1.sql` — barème 4 axes, colonnes marché NULL, Option C.
- `supabase/functions/flatfox-sync/index.ts:428` — écrit `current_price`, jamais `price_per_m2`.
- `supabase/migrations/20260614130100_matching_candidate_rpc.sql` — RETURNS TABLE sans `postal_code` ⇒ plafond L1.
- `supabase/migrations/20260614130000_matching_scoring_config.sql` — `app_config.matching_scoring_v2`.

> **Prochaine étape : Vague 2 (Concevoir)** — spec implémentable de `market_rent_stats` (MV + refresh + seuil),
> `rentPosition()` pur, l'axe `pricePosition` du matching (poids + lecture edge + `budget.detail`),
> et le design réservé de l'axe score-de-bien — puis revue adversariale avant code.
