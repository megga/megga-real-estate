# Plan — Référence de loyer marché (signal backend pour un matching plus intelligent)

> Handoff pour **session dédiée** (rédigé 18 juin 2026 ; session probablement longue). À exécuter via
> la **méthode des 3 vagues** (cerveau ruflo `megga/methode-algo-vagues` : comprendre → concevoir →
> implémenter + revue adversariale + tests live → entretenir le cerveau ; orchestration Workflow ;
> qualité = discipline de vérification).

## Cadrage produit (DÉCISION VERROUILLÉE — Gregory/Julien, 18 juin)
On NE construit PAS un estimateur de loyer **public** (commodité, faible différenciation, et on n'est
pas spécialiste d'estimation → risque de défendre un chiffre). On construit une **primitive backend
« référence de loyer marché »** qui **rend le circuit plus intelligent** en alimentant le **matching**
(+ le score de bien). Objectifs : un service **plus juste** (« bon match ET bon prix »), un algo
**toujours plus puissant**, et un **entraînement** qui prépare la version VENTE (architecture réutilisée).

Principes (mêmes que tout ce qu'on a bâti) :
- **100% déterministe, ZÉRO LLM** — comparables statistiques, jamais un modèle qui « devine » un prix.
- **Basé sur des prix DEMANDÉS** (annonces Flatfox) → ça mesure une **position vs le marché actuel**, PAS une « valeur experte ». C'est exactement ce qu'on veut pour un signal interne. **Jamais** présenté comme une valuation officielle ni montré au client comme un chiffre garanti (compliance-enabling, pas replacing — comme le KYC).
- **Honnêteté de confiance** : toujours renvoyer le **nombre de comparables** ; **pas de référence** sous un seuil (axe neutralisé, jamais fabriqué).
- **LOCATION d'abord** (la donnée existe), **VENTE en phase 2** (data-gated, voir fin).

## Faits données VÉRIFIÉS (live, 18 juin, prod eayczugyrvmtqnnmvjod)
- `market_listings` actives : **location 34 661** / **vente 12**. → la vente est IMPOSSIBLE sur notre donnée aujourd'hui (12 lignes). On fait LOCATION.
- Location **estimable** (prix + surface + canton non-null) : **23 897**. (with_surface 25 269, with_rooms 21 408, with_price 32 718.)
- Montant loyer canonique = `COALESCE(current_price, price)` (rent/rent_chf morts/NULL, cf matching v2). loyer/m² = montant / `surface_m2`.
- Densité de comparables (canton×type, location) : ZH appart 4047, BE 1961, VD 1402, TI 1259, BL 1034, SG 1002, AG 856, GE appart 434 / GE bureaux 575 / GE commercial 410, FR 722, BS 599, VS 567, LU 464, NE 462… → dense pour `apartment` dans la plupart des cantons + bureaux/commercial dans les grands ; **thin** pour types/cantons de niche → d'où le seuil + la hiérarchie de repli.
- Seed existant à ÉTENDRE (ne pas réinventer) : vue `cantonal_price_medians` (médiane prix/m² par canton×type, sert le badge « bon prix » du matching).

## Méthode / garde-fous (« fait correctement »)
- Ancrer chaque fait au code (fichier:ligne) / DB live avant de toucher.
- Edge functions Deno (`matching-engine`) = **non type-checkées** par build/vitest-unit (cf mémoire `feedback_edge_functions_typecheck_gap`) → logique pure dans un module testable (calque `_shared/matching-normalize.ts`) + import-smoke dans un spec `tests/backend/` + **BEGIN/ROLLBACK live**.
- Tests backend **LIVE** en CI (la primitive renvoie des médianes saines sur la vraie donnée ; seuil/repli ; position ; reasons matching enrichis ; axe score de bien).
- Migrations timestamps **14 chiffres** (vérifier libre) ; **verrou facturation GitHub** → souvent appliqué à la main via MCP `apply_migration` (idempotent) ; **le classifieur gate les déploiements prod** → prévoir une autorisation explicite.
- Barème/seuils **tunables en `app_config`** (comme `matching_scoring_v2` / `property_scoring_v1`). Perf §7 (pas de `count:'exact'`, index, pas de scan full). DeepSeek-only si jamais un appel IA (ici : aucun). PR par vague, **pas de merge sans accord**, cerveau MAJ à la fin. Lire les exit codes à la source. Subagents → `cd <worktree>`.

---

## VAGUE 1 — COMPRENDRE
- **Granularité de segmentation** : jusqu'où segmenter avant que le nombre de comparables tombe sous le seuil ? Tester canton×type, puis + bandes de surface, + bandes de pièces, + commune. Établir la **hiérarchie de repli** (commune → district/NPA → canton) et le **seuil minimum de comparables** (ex. n ≥ 20-30) sous lequel on ne rend pas de référence.
- **Qualité donnée** : outliers loyer/m² (absurdes) → borne/winsorisation ; gestion surface manquante (9k sans surface) ; confirmer le montant canonique `COALESCE(current_price,price)` et l'unité (loyer mensuel).
- **Vue `cantonal_price_medians`** : lire sa définition, son refresh, ses lecteurs (badge « bon prix ») → décider extension vs nouvelle structure.
- **Points de branchement** : matching = `_shared/matching-normalize.ts` (scoring pur) + `reasons` + RPC `match_candidate_listings` + barème `app_config.matching_scoring_v2`. Score de bien = `calculate_property_scores` + `app_config.property_scoring_v1`.
- **Décisions ouvertes** : vue matérialisée (stats par segment, refresh nocturne post `flatfox-sync`) vs RPC à la volée ? bandes de surface/pièces (bornes) ? seuil de comparables ? poids du signal dans le matching (soft, n'écrase pas le barème existant) ?

## VAGUE 2 — CONCEVOIR (spec implémentable + revue adversariale)
- **La primitive** : probable **vue matérialisée** `market_rent_stats` (segment = canton/commune × type × bande surface × bande pièces → médiane, p25/p75, n_comparables), refresh nocturne après `flatfox-sync` ; + **fonction PURE** `rentPosition(subject, stats)` (choisit le segment le plus fin avec n ≥ seuil via la hiérarchie de repli, renvoie loyer/m² attendu + fourchette + n + position % du sujet). Décider MV vs RPC (perf : MV pour lectures répétées).
- **Intégration matching** : nouvel axe/`reason` « position prix » dans `matching-normalize.ts` (déterministe, alimenté par la référence), **tunable** dans `matching_scoring_v2` (poids ajouté, barème existant intact). Un loyer aligné/sous le marché monte ; un sur-évalué est signalé. Reason FR explicable (« loyer ~X% sous le marché du secteur, sur N comparables »).
- **Intégration score de bien** : sous-axe « aligné au marché ? » pour les **mandats locatifs** de l'agence dans `calculate_property_scores` (tunable `property_scoring_v1`) — aide à prixer + explique un mandat qui stagne. Neutralisé honnêtement si non-locatif / pas assez de comparables.
- **Honnêteté** : n_comparables exposé partout ; pas de signal sous le seuil ; libellés « position marché », jamais « valeur ».
- Revue adversariale (3 lentilles ou 1 agent) sur la spec avant code.

## VAGUE 3 — IMPLÉMENTER
Migration(s) : MV `market_rent_stats` + refresh (cron post flatfox-sync) + clés `app_config` (seuil, bandes, poids). Code : `rentPosition` pur + branchement matching-normalize + axe property-score. Front : surfacer la position prix dans les `reasons` du match / l'axe du score de bien (marqué estimation, n comparables visibles). Tests live CI + build + revue 3 lentilles + PR (no-merge-sans-accord).

## VAGUE 4 — ENTRETENIR LE CERVEAU
Nœud `megga/market-rent-reference` (la primitive + LA DÉCISION DE CADRAGE : signal backend non public, prix demandés = position marché, alimente matching + score de bien, déterministe/0 LLM, vente = phase 2 data-gated, entraînement pour la vente). MAJ `megga/matching-scoring-algo` + `megga/property-score` + `docs/system-map.md`. `npm run ruflo:seed`.

---

## PHASE 2 — VENTE (chantier SÉPARÉ, plus tard)
La **même primitive** appliquée à des comparables de **VENTE**. PRÉREQUIS = **acquérir la donnée de vente** (aujourd'hui 12 annonces) : ingérer la section vente d'ImmoScout/Homegate ou une source RealAdvisor — chantier **DONNÉES**, avec ses questions de licence/ToS, pas un chantier algo. Une fois la donnée là, la primitive + les branchements matching/score sont réutilisés tels quels (c'est tout l'intérêt de faire la location d'abord = entraînement de l'architecture).

**PHRASE D'AMORÇAGE (nouvelle session) :** « On attaque la référence de loyer marché (plan `docs/estimation-loyer-plan.md`) : signal backend déterministe qui alimente le matching + le score de bien, location d'abord. Commence par la Vague 1 (Comprendre). »
