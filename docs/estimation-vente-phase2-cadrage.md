# Référence de PRIX de VENTE marché — Rapport de cadrage Phase 2

*Statut : DATA-GATED dur. Aucun algo livrable aujourd'hui. La décision qui débloque la phase est une décision d'acquisition de données, et son volet juridique revient à Gregory/Julien.*

---

## 1. Le constat — l'écart de données, chiffré

La primitive de **loyer** tourne en production : `market_rent_stats` = **285 segments** peuplés, rafraîchie par cron quotidien, injectée dans le matching. C'est l'architecture qu'on veut réutiliser pour la vente. Le problème n'est pas l'algo. C'est qu'il n'y a **aucune donnée de vente réelle**.

Vérifié en base ce jour (`market_listings`) :

| Métrique vente (`transaction_type='buy'`) | Valeur |
|---|---|
| Total lignes vente | **12** |
| dont seed `megga-demo` | **12** (100 %) |
| dont vraies annonces scrapées (`realadvisor`, etc.) | **0** |
| Densité max d'un segment canton×type | **n = 2** (GE apartment) ; tous les autres **n = 1** |
| Seuil requis par la primitive | **n ≥ 20** par segment |

Les 12 lignes sont un seed de démo pur : un seul `created_at` (2026-04-15 18:36), photos Unsplash, prix/m² « trop propre » (100 % rempli et cohérent, ce qui n'arrive jamais sur de la vraie donnée scrapée). Au grain le plus fin, on est **~10× à 20× sous le seuil**. Au grain le plus large (apartment tous cantons, ~8 lignes), encore ~2,5× court.

**Pourquoi 0 algo utile aujourd'hui :** la primitive exige `count(*) >= 20` par segment (clause `HAVING`) précisément pour ne pas publier une médiane construite sur 3 annonces. Avec n=2 max, **aucun segment vente ne franchit le seuil** → la référence reste vide → l'axe de position-prix reste neutre. Tout calcul lancé maintenant produirait soit zéro segment, soit (si on trichait sur le seuil) des médianes fantaisistes. Le garde-fou fait correctement son travail : il refuse de mentir.

**Ordre de grandeur cible.** Étalon mesuré sur le rent en base (résidentiel plausible, prix 200–20 000, surface 8–1000) :

- **16 068** annonces de location → **52** segments canton×type, dont **32** à n≥20 → **99,4 %** des lignes couvertes, ~499 lignes/segment dense.

La vente sera **plus fragmentée** que le rent à densité égale (moins de transactions, queues de prestige), donc il faut viser le **même ordre de grandeur de milliers d'annonces** pour espérer remplir ne serait-ce que les segments apartment des grands cantons. Écart à combler : de **12 lignes démo** à **~10 000 vraies annonces de vente résidentielle**. Soit un facteur **~800×**.

---

## 2. Ce qui est DÉJÀ prêt (et ne demande qu'à être branché)

Bonne nouvelle : tout sauf la donnée. La location a servi d'entraînement de l'architecture, exactement comme prévu.

**Côté primitive + algo (réutilisable quasi tel quel) :**

- **La mécanique de bucket** `market_rent_stats` (UNION 3 niveaux, `HAVING n>=20`, winsorisation p2.5/p97.5, refresh `CONCURRENTLY` par cron) se clone en `market_sale_stats` en changeant `transaction_type` et les bornes.
- **Le module pur** `rent-reference.ts` (`rentPosition`, fallback de segment, raisonnement en r = prix/m² sujet ÷ médiane) est zéro-I/O, déjà testé. Rien dedans n'est spécifique au loyer — c'est un copier-renommer.
- **L'injection matching est déjà câblée pour la vente, à un gate près.** Le matching `buy` passe **déjà** par le même `calculateScoreV2` (barème 6 axes). Vérifié : `matching-engine/index.ts:214`
  ```ts
  const rentRef = tx === 'rent' ? rentPosition(subject, rentIndex) : null
  ```
  Une vente reçoit donc toujours `rentRef = null` → bonus position-prix = 0. **Dégater = remplacer ce ternaire** par une référence vente quand `tx === 'buy'`. C'est ce gate qu'on ouvre, pas le scoring.
- **Les tunables sont externalisés** dans `app_config` (seuil, bandes, bornes, courbe). Pour la vente : une nouvelle clé JSON avec bornes 50 000–50 000 000 au lieu de 200–20 000. La frontière 50k est déjà la limite naturelle (`inferTransactionType` classe budget ≥ 50 000 = `buy`, vérifié `matching-normalize.ts:75`).

**Côté infra d'ingestion (ce qui ingère déjà de la vente vs pas) :**

| Composant | Ingère de la vente ? | État |
|---|---|---|
| `flatfox-sync` (le seul cron actif sur `market_listings`) | **Non** — `offer_type=RENT` en dur ; mapper BUY-ready mais Flatfox **ne vend pas** | Location uniquement, 76 590 lignes rent |
| `market-scraper` / `market-scraper-batch` | **Oui en code** — écrit `transaction_type='buy'` depuis RealAdvisor | **DORMANT** : 0 cron, 0 appelant, 0 ligne en base |
| `external-matching` | Scrape de la vente RealAdvisor mais écrit dans un cache éphémère `external_listings` | **0 ligne** (cache vide) — n'alimente jamais le pool de comparables |

Autrement dit : **un chemin d'ingestion de vente complet existe déjà en code** (`market-scraper` → RealAdvisor → `transaction_type='buy'`), mais il n'a **jamais tourné en prod** et il repose sur du scraping d'API privée (voir §3). Le seul pipeline qui peuple réellement le pool aujourd'hui est rent-only.

---

## 3. Options d'acquisition de données

Tableau honnête. La colonne qui décide n'est pas l'effort technique — c'est la **posture compliance/ToS**, parce que MEGGA est compliance-first.

| Source | Volume vente réaliste | Code déjà là ? | Posture compliance / ToS | Effort |
|---|---|---|---|---|
| **Flatfox (vente)** | **~0** — Flatfox = location only (documenté + 0 ligne buy en base) | Oui (sync durci, mapper BUY-ready) | ✅ **Défendable** — seul greenlight partenaire explicite (Gregory). Mais inutilisable : pas de stock vente | Faible mais **sans objet** |
| **Feed / licence officiel** (Homegate-SwissMarketplace, RealAdvisor data, ImmoScout) | **Élevé** — marché national, ordre 30–50k annonces | Non (à intégrer) | ✅ **Le plus défendable** — contractuel, payant, PII cadrée | Moyen + **négo commerciale** |
| **`market-scraper` RealAdvisor (dormant)** | Plafond théorique ~1 476/run avant dédup ; **réel inconnu, probablement < cible** | Oui (déployé, jamais exécuté) | ⚠️ **Risqué** — API JSON privée, User-Agent navigateur usurpé, usage non prévu de l'API | Faible (allumer un cron) — **mais bloqué juridiquement** |
| **`external-matching` RealAdvisor HTML** | Éphémère par-recherche, pas un pool | Oui | 🔴 **Le plus fragile** — parse du RSC Next.js, casse à la moindre refonte front | Sans objet pour un pool |
| **Scrapers Homegate (`scripts/`)** | Élevé (marché entier) | Oui | 🔴 **Le plus risqué** — API reverse-engineered + **contournement CAPTCHA Datadome** + `navigator.webdriver=false` | Moyen — **frontalement anti-ToS** |

**Lecture :**

- **Défendable compliance-first :** un **feed/licence officiel** (ligne 2). C'est la seule voie où MEGGA acquiert la donnée avec une base légale, et où la PII des annonces (nom/téléphone d'agent, parfois du vendeur, adresse) est couverte par un contrat. C'est aussi la seule compatible avec un refresh quotidien fiable — un scraper protégé par CAPTCHA n'est pas automatisable proprement en cron.
- **Risqué, à ne PAS allumer sans arbitrage juridique :** réutiliser le code de scraping existant (RealAdvisor ou Homegate). Il est techniquement prêt, mais l'exécuter en prod fait tourner du scraping d'API privée tierce sur l'infra MEGGA — en contradiction directe avec le positionnement compliance-first, et avec un risque LPD sur la PII ingérée. **Le code prêt n'est pas une autorisation de l'allumer.**

---

## 4. Plan algo une fois la donnée là

Petit chantier (l'inverse de l'acquisition). Estimation : **2–3 jours de dev** une fois un feed branché, hors recalibrage.

**Ce qui se clone (verbatim ou presque) :**
- `market_sale_stats` = clone structurel de la migration `market_rent_stats` : changer `transaction_type='rent'→'buy'`, le nom, les bornes. Toute l'ossature (niveaux, `HAVING n>=20`, `seg_key`, index unique, `CONCURRENTLY`, cron) se réutilise. **MV séparée** (pas unifiée) : les distributions loyer/m² vs prix/m² diffèrent d'un facteur ~100, partager une winsorisation serait sale.
- Module : généraliser `rentPosition` en `pricePosition(subject, index)` plutôt que cloner un 2ᵉ module qui divergera (leçon des helpers copiés verbatim déjà dans le code).
- Nouvelle clé `app_config` `market_sale_reference_v1` avec bornes 50 000–50 000 000.

**Ce qui se recalibre (PAS un copier-coller) :**
- **Bornes de plausibilité :** prix de vente 50k–50M (vs loyer 200–20 000).
- **Courbe `positionFrac`** et **percentiles de winsorisation :** les prix de vente sont plus dispersés. Sur les 12 seed, le prix/m² va de **8 780 à 14 082 CHF** (×1,6) pour du résidentiel comparable, et le prestige (GE villa 14 082, ZH 13 810) tire les queues. Les breakpoints calés sur la dispersion loyer ne valent pas pour la vente. **À recalibrer une fois la vraie donnée là**, pas avant.
- **price/m² recalculé LIVE, jamais depuis la colonne.** Sur le seed, `price_per_m2` est rempli à 100 % — piège. Sur de la vraie donnée scrapée il sera majoritairement NULL (le rent réel : ~23 % de remplissage). La primitive location **ignore** la colonne et recalcule `price/surface` live ; la vente doit faire pareil.

**Le dégate, concrètement :**
- Ouvrir le gate `tx === 'rent'` (matching-engine:214) → charger un `saleIndex` depuis `market_sale_stats` et le passer quand `tx === 'buy'`.
- ⚠️ **Plafond L1 hérité :** la RPC `match_candidate_listings` ne renvoie pas `postal_code`, donc la référence vente sera limitée au niveau **canton×type×bande** comme le rent. Or la vente sera plus thin à ce niveau → risque que beaucoup de segments restent < n=20 et que l'axe reste neutre **même après acquisition**. À quantifier sur le premier vrai feed avant de promettre l'axe ; éventuellement élargir la RPC pour exposer city/NPA.

**Garde-fous à poser à l'activation (petits chantiers, en même temps) :**
- **Exclure `megga-demo`** du calcul des stats vente (sinon les 12 démos polluent).
- **Quality gate vente** (le `computeQualityScore` de flatfox-sync est loyer-spécifique) : sans lui, buckets pollués.
- **Calculer `price_per_m2 = price/surface` à l'ingest** quand l'API ne le fournit pas, sinon des comparables valides sont écartés du bucket.
- **CANTON_MAP** de `market-scraper` ne mappe que GE/VD — à compléter avant tout usage national.

---

## 5. Décisions ouvertes pour Gregory/Julien

**LA décision (bloquante, juridique — je ne la tranche pas) :**

> **Quelle voie d'acquisition de données de vente ?** Concrètement : payer/négocier un **feed ou une licence officiel** (Homegate-SwissMarketplace, RealAdvisor data, ImmoScout), ou bien accepter le risque ToS/LPD du **scraping** déjà codé.
>
> Le volet qui vous revient : décider si MEGGA contracte une source de données, à quel coût, et **valider le terrain juridique** (CGU des portails, robots.txt, droit de réutilisation, base légale LPD pour la PII des annonces). Le code de scraping est prêt — ce n'est **pas** une autorisation de l'utiliser. L'allumer en prod sans accord contredit le positionnement compliance-first.

**Décisions secondaires (techniques, je recommande mais elles découlent de la première) :**
- **Seuil de données qui déclenche l'algo :** je recommande **~10 000 annonces de vente résidentielle plausibles** (apartment/house/villa, 50k–50M, surface 8–1000). Étalon : à 16k le rent couvre 99,4 % via ses segments denses ; à ~10k on remplit les segments apartment des grands cantons (ZH/GE/VD/VS/BE/TI) = la majorité du volume de biens réels. **En-dessous de ~5 000, ne pas démarrer** (sur-fitting garanti). **Ne jamais abaisser n<20** pour faire apparaître des segments : mieux vaut 0 référence qu'une fausse position.
- **Mesurer avant de promettre :** quelle que soit la source retenue, faire **un run de reconnaissance** pour compter le volume unique vente réel après dédup, et le fill-rate de `price_per_m2`, **avant** de câbler un cron ou d'annoncer une couverture.

---

## 6. Recommandation

**Tant qu'il n'y a pas de source de données de vente défendable, la Phase 2 reste en attente. C'est la réponse honnête.** La primitive est prête, le matching est prêt à un gate près, l'algo est ~2–3 jours de travail — mais sans donnée réelle il n'y a rien à livrer, et la seule donnée immédiatement disponible vient de scraping anti-ToS incompatible avec ce qu'est MEGGA.

**La plus petite première étape, défendable, qui débloque tout :** ouvrir **une conversation commerciale pour un feed/licence officiel** — Homegate (SwissMarketplace Group) ou RealAdvisor data partnership en priorité. C'est une démarche produit/juridique de Gregory, pas un chantier code. **Ne rien shipper, ne rien cron, ne pas allumer le scraper dormant** d'ici là.

En parallèle, sans risque et sans engager de licence, deux gestes utiles tout de suite :
1. **Run de reconnaissance** sur les sources candidates pour chiffrer le volume vente unique réel (mesure, pas ingestion en prod) — pour savoir si la cible ~10k est même atteignable avant d'investir dans une licence.
2. Quand une source légale est verrouillée, le dev algo (clone MV + dégate + recalibrage) est rapide et déjà cartographié au §4.

Je ne tranche pas le légal. **La balle est dans le camp de Gregory/Julien sur la source ; le reste suit en quelques jours une fois la donnée acquise.**

---

**Fichiers de référence (chemins absolus) :**
- Gate à dégater : `/Users/megga/Desktop/megga-real-estate/supabase/functions/matching-engine/index.ts:214`
- Frontière buy/rent 50k : `/Users/megga/Desktop/megga-real-estate/supabase/functions/_shared/matching-normalize.ts:70-76`
- Module pur à généraliser : `/Users/megga/Desktop/megga-real-estate/supabase/functions/_shared/rent-reference.ts`
- Primitive à cloner : `/Users/megga/Desktop/megga-real-estate/supabase/migrations/20260618210000_market_rent_stats.sql`
- Ingesteur vente dormant : `/Users/megga/Desktop/megga-real-estate/supabase/functions/market-scraper/index.ts` + `market-scraper-batch/index.ts`
- Décision verrouillée Phase 2 : `/Users/megga/Desktop/megga-real-estate/docs/estimation-loyer-plan.md:59-62`

*Note de vérification : faits live confirmés ce jour via SQL (12 buy / 0 réel / 0 realadvisor, n=2 max, prix/m² 8 780–14 082, 285 rent_stats segments, external_listings vide, gate `tx==='rent'` ligne 214). Les chiffres « 148 segments / 97,8 % » du rapport sale-primitive ont été mesurés avec bandes de surface (grain plus fin) ; ma re-mesure canton×type donne 52 segments / 99,4 % — même ordre de grandeur, même conclusion sur la cible.*
