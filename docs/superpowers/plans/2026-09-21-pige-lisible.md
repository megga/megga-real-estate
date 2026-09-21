# Pige lisible et historique des prix — étape 1b (plan de réalisation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Écrire l'historique des prix et des statuts du marché à chaque changement réel, dater le retrait d'une annonce, détecter les baisses aussi sur Flatfox, montrer « Ce qui a bougé » (nouveaux, en baisse, retirés) dans la Recherche et l'historique du prix sur la fiche d'une annonce.

**Architecture :** Des déclencheurs SQL sur `market_listings` sont l'écrivain unique de `market_price_history` (une ligne à l'insertion, une ligne à chaque changement réel de prix ou de statut, un relevé initial à la mise en service) ; chaque ligne porte le contexte de l'annonce à l'instant (transaction, canton, type, ville), si bien que le flux « Ce qui a bougé » (RPC `pige_mouvements`, SECURITY INVOKER, paginée par clé, sans comptage) ne lit que cette table étroite. Le front ajoute une vue à la page Recherche (page 1 du pager Matching), sur les mêmes filtres durs que la grille, et un composant d'historique commun aux deux fiches d'annonce.

**Tech Stack :** PostgreSQL 17 (plpgsql, déclencheurs, index B-tree), Supabase (PostgREST, edge functions Deno), React 19 + TypeScript, TanStack Query v5 (`useInfiniteQuery`), react-i18next (FR/DE/EN/IT), Vitest.

**Sources :** [feuille de route verrouillée](../feuille-de-route.md), étape 1b ; cahier des charges de Gregory (https://claude.ai/artifact/7VViBuAfsJmWe3N6uentXM), modules « Pige lisible » et « Historique des prix » (P0) ; `CLAUDE.md` §3 (MEGGA X) et §7 (performance).

---

## Règles de ce chantier

- **Commits : AU SIGNAL de Julien seulement** (« committe »), un commit PAR SUJET, jamais de push. Chaque tâche finit par un « point de commit (au signal) » qui dit quoi grouper.
- **Production : aucune écriture pendant le chantier.** Les deux migrations partent à la fusion (`deploy.yml`). Les requêtes de la Task 16 sont en LECTURE seule.
- **Date-guard de `deploy.yml` :** une migration n'est appliquée que si ses 8 premiers chiffres sont ≥ au jour UTC de la fusion, et elle est rejouée à chaque push de ce jour-là. Les deux fichiers sont datés `20260921` : si la fusion a lieu plus tard, **les renommer tous les deux au jour de la fusion** (`git mv`), en gardant `…145000` AVANT `…150000` (l'ordre compte, cf. Task 2), et corriger les noms cités dans ce plan, dans `tests/unit/pige-sql.spec.ts` (il les cherche par suffixe, rien à changer) et dans les commentaires SQL.
- **Chantier parallèle (étape 1a, lot B du matching) :** il touche `src/components/matching-fil/**`, `src/hooks/useAtelierMatching.ts`, `src/hooks/useMatchingFil.ts`, `src/hooks/useSelectionMarche.ts`, `supabase/functions/matching-engine`, des migrations `20260921140000_…`. **Ce plan n'y touche pas.** Fichiers PARTAGÉS : `src/i18n/locales/*/matching.json`, `src/pages/dev/crmFixtures.ts`, `src/types/database.ts`, `docs/system-map.md`, `CLAUDE.md`, `.claude-flow/knowledge/megga-memory.seed.json`, `tests/unit/megga-x-grammar.spec.ts`. Pour chacun : **le relire juste avant d'écrire, ne modifier que ses propres sections**, jamais réécrire le fichier entier depuis une copie ancienne.
- **Grammaire MEGGA X** (`CLAUDE.md` §3) : couleurs par la palette (`sp.*`, `surf.*`, `mrhPriceDropInk`), aucune couleur hexadécimale neuve, graisse ≤ 600, aucune capitale, tailles en `var(--crm-text-*)`, rayons et espacements en `var(--crm-radius-*)` / `var(--crm-space-*)` : **aucun littéral neuf** (le cliquet `megga-x-grammar.spec.ts` compte ceux du dossier `matching-recherche` et de `src/pages/agent`).
- **i18n** dans les 4 langues par script python qui vérifie d'abord le format `json.dumps(d, ensure_ascii=False, indent=2) + '\n'`, sans tiret cadratin ni demi-cadratin, sans ß, italien au « Lei ».
- **Performance** (`CLAUDE.md` §7) : jamais de `count: 'exact'` ni de `count(` dans le flux, un index qui couvre le WHERE et l'ORDER BY, aucune colonne lourde en liste.
- Aucun export mort (`npm run lint:deadcode`). Specs ciblées pendant le chantier ; `npm run test:unit` SEUL, à la fin (en parallèle de tsc/eslint, les délais de 5 s sautent).
- Lire chaque fichier avant de le modifier : les ancres de ce plan sont celles du 21.09.2026 (travail non commité des lots 1, 2 et A compris).

## Ce qui a été mesuré (production, 21.09.2026, lecture seule)

- `market_listings` : 295 291 lignes, tas 460 Mo (2,19 Go avec index et TOAST), **25 index**. Depuis le démarrage du 28.05.2026 : 8 852 465 UPDATE (~76 000/jour) et 236 952 INSERT (~2 000/jour) ; 11 465 UPDATE HOT seulement (0,13 %) : chaque upsert réécrit tous les index.
- Statuts : Flatfox (location) 48 406 `active` / 94 372 `removed` ; RealAdvisor (vente) 46 464 `active`, 1 614 `price_reduced`, 104 729 `removed` ; 27 `megga-demo`.
- `market_price_history` : **0 ligne**, 16 ko. Seul écrivain : `market-scraper`, dormant.
- Flatfox : `price_at_first_seen = current_price` sur **48 406 actives sur 48 406** (l'upsert le réécrit à chaque passage) ; 0 `price_reduced_at`. RealAdvisor : 314 baisses datées en 7 jours, 1 272 en 30 jours.
- **`days_on_market` vaut 0 sur les 48 078 annonces RealAdvisor vivantes** : `realadvisor-sync` ne l'écrit jamais. La Recherche affiche donc « aujourd'hui » sur toute vente, et la fiche « moins d'un jour ».
- Retrait non daté : `updated_at` des retirées RealAdvisor est repoussé chaque nuit par la sonde de résurrection (4 060 retirées touchées en 24 h, dernier `updated_at` à 02:45:00 UTC, l'heure de `realadvisor-revive-collect`).
- **Balayage Flatfox en panne muette depuis le 05.09.2026** : `total_removed = 0` à chaque passage (16 nuits), runs pourtant `completed` ; journal de l'edge du 21.09 : `sweep error: canceling statement due to statement timeout` à 04:17:23 UTC, 8,0 s après le comptage de sécurité. **12 492 annonces Flatfox « actives » n'ont pas été vues au passage du 21.09**, dont 7 882 depuis plus de 7 jours (plus ancienne dernière vue : 04.09). Avant le 05.09, le balayage retirait 400 à 1 400 annonces par nuit.
- Annonces insérées en 7 jours et encore vivantes : RealAdvisor 12 206, Flatfox 4 922 (~2 400/jour).
- Coût d'un flux lu sur `market_listings` (équivalent SQL de « Nouveaux », 30 jours) : 977 ms à froid pour Genève ≥ 4,25 MCHF (857 blocs lus) ; **11,5 s à froid pour une ville rare** (11 233 blocs lus), au-delà du statement_timeout de 8 s. Sélection des candidates du balayage Flatfox par `idx_ml_flatfox_sync` : 786 ms à froid pour les 1 000 premières ; cet index porte aussi les ~94 000 retirées, qu'un dernier lot incomplet traverserait une à une avec un accès au tas (estimé, non mesuré).

## Décisions de ce plan

1. **Écrivain unique : des déclencheurs SQL** (`ml_historique_prix`, SECURITY DEFINER, `search_path` vide). `AFTER INSERT` écrit une `apparition` ; `AFTER UPDATE` porte une clause `WHEN (old.current_price IS DISTINCT FROM new.current_price OR old.price IS DISTINCT FROM new.price OR old.status IS DISTINCT FROM new.status)`, évaluée sans appel de fonction : l'upsert quotidien qui ne change rien ne coûte que trois comparaisons par ligne. Pas de `UPDATE OF current_price, price, status` : `trg_ra_price_status` (BEFORE) peut changer le statut d'un UPDATE qui ne le nomme pas, et `UPDATE OF` le raterait. `market-scraper` perd son insertion directe.
2. **Genres d'événement** (CHECK) : `suivi` (relevé initial), `apparition`, `baisse`, `hausse`, `prix` (prix affiché ou retiré, 0 ↔ X), `retrait`, `retour`, `statut`. Priorité dans un même UPDATE : retrait, puis changement de prix, puis retour, puis statut (un retour moins cher est une `baisse`, avec `old_status = removed`).
3. **L'historique commence à la mise en service** : la migration écrit un relevé `suivi` par annonce vivante, et rien d'autre du passé. La série de toute annonce vivante ce jour-là, ou apparue depuis, a donc un point de départ.
4. **Le contexte est recopié sur la ligne** (`transaction_type`, `canton`, `type`, `city`) et **le flux ne filtre que l'historique** : mesuré, filtrer `market_listings` sur 30 jours dépasse le timeout à froid pour une ville rare. Les ≤ 30 lignes retenues sont seules jointes à `market_listings` (clé primaire).
5. **`removed_at` = la date où le CRM CONSTATE le retrait**, posée par `trg_ml_date_retrait` au passage à `removed`, conservée tant que l'annonce reste retirée, effacée à son retour. **NULL pour toutes les annonces déjà retirées** : `updated_at` est pollué chaque nuit côté RealAdvisor, et une approximation mêlerait deux natures de date ; le cahier dit de ne pas reconstituer le passé. « Constaté » et non « disparu » : c'est ce qui rend « retiré depuis hier » exhaustif (RealAdvisor confirme jusqu'à ~3 jours après la première absence, `absent_first_at`).
6. **Flatfox : `trg_ra_price_status` étendu à `flatfox`** (le nom reste). Le premier prix se gèle au prix de la veille du premier passage, et les baisses se détectent dès le lendemain (`price_reduced`, `price_reduced_at`), comme RealAdvisor depuis le 19.06.2026. Aucune modification de l'edge pour cela.
7. **`pige_mouvements(p_kind, p_since, filtres…)`** : `apparition` et `baisse` ne rendent que des annonces encore vivantes, `retrait` que des annonces encore retirées ; mêmes filtres durs que la grille (`search_market_listings`) — marge de 15 % sur le budget, prix > 0, qualité ≥ 50 — pour que le flux décrive la population que la grille montre. Pagination par clé (`detected_at`, `id`), `p_limit` ≤ 100, **aucun comptage**.
8. **Index** : `market_price_history (kind, detected_at desc, id desc)`, non partiel (le genre est un paramètre : un index partiel sur `kind` ne se prouverait pas dans un plan générique), sur une table qui reçoit ~5 000 lignes par jour ; `market_listings (last_seen_at) WHERE source_portal = 'flatfox' AND status IN ('active','price_reduced')`, partiel, pour le balayage Flatfox. Aucun index pour `removed_at` : le flux lit l'historique.
9. **« Ce qui a bougé » vit dans la Recherche** : un groupe de segments « Tout le marché · Nouveaux · En baisse · Retirés » à côté des filtres existants, et, dans les trois flux, la période « 24 h · 7 jours · 30 jours » (7 jours par défaut) à la place de l'affichage grille/carte et du tri. Les filtres (acheteur, transaction, jetons), la vue et la période se rangent **dans l'onglet** (`useTabScopedState`) ; **aucun segment n'est imposé** (la vue par défaut reste « Tout le marché », sans filtre). L'acheteur est rangé par sa recherche (`searchId`), jamais en objet : ni nom ni critère dans la pile d'onglets.
10. **Historique sur les DEUX fiches**, par un seul composant (`MrhHistoriquePrix`) : la fiche de la Recherche (`MrhExtDetail`, section après les équipements) et la fiche autonome (`ExternalListingDetailPage`, carte après l'analyse de prix). Jours sur le marché, changements de prix, écart (« depuis la première publication » si la série commence par une apparition, sinon « depuis le {date} »), courbe en escalier en SVG à la main, liste des événements ; lecture bornée aux 200 derniers événements par l'index existant `(market_listing_id, detected_at desc)`.
11. **Les jours sur le marché se lisent dans `first_seen_at`** (gelé par la collecte) dans `mapListingRow`, `days_on_market` ne servant plus que de repli : sans quoi la fiche afficherait « moins d'un jour » juste au-dessus d'un historique qui dit « 147 jours ».
12. **Balayage Flatfox par lots** (Question 1) : `flatfox_balayer_retraits` retire au plus 500 annonces par appel ; `flatfox-sync` rappelle tant qu'un lot revient plein, et un échec fait finir le run en `failed` avec son message au lieu d'un `completed` muet. Les 12 492 fantômes sont rattrapés par la migration **avant** la pose des déclencheurs : disparus avant la mise en service, ils gardent `removed_at` NULL et n'inondent pas « Retirés » d'un jour de fusion.
13. **Bancs** : la Recherche du banc tourne en mode `demo` (`mrhDemo.ts`, flux et historiques inventés, dates relatives) ; la fiche autonome du banc lit `market_price_history` par l'interception (`crmFixtures.ts`).

## Rayon d'impact et coût

- **Écritures par jour estimées** : ~2 400 `apparition` + ~1 000 retraits Flatfox (rythme d'avant la panne) + jusqu'à ~2 900 retraits RealAdvisor (plafond `realadvisor_sweep_cap_pct` à 6 % du vivant) + ~45 baisses RealAdvisor + les baisses Flatfox (inconnues : jamais mesurables jusqu'ici) ≈ 5 000 à 7 000 lignes/jour, ~2 M/an, ~300 Mo avec index. Une fois : ~84 000 relevés `suivi` (96 511 vivantes moins le rattrapage).
- **Coût par UPDATE de `market_listings`** : la clause `WHEN` du déclencheur d'historique (sans appel) ; `trg_ml_date_retrait` (clause `WHEN` fausse pour une annonce vivante) ; `ra_price_status` désormais appelé aussi pour les ~36 000 Flatfox du passage nocturne (une fonction plpgsql par ligne, de l'ordre de la microseconde, face à 25 réécritures d'index par ligne). Le nouvel index partiel ajoute une écriture d'index aux upserts Flatfox (+1 sur 26).
- **Effets voulus** : le bonus « prix baissé » du moteur de matching (`calculateScoreV2`) s'applique désormais aussi aux locations ; la pastille « −X % » de la Recherche aussi ; l'étape 1a (« retour d'un bien refusé pour le prix quand son prix baisse ») voit enfin les baisses Flatfox.
- **Effets de bord à arbitrer (en attente)** : trois lecteurs ne comptent que `status = 'active'` et perdront les locations passées en `price_reduced` — le `search_listings` du copilote WhatsApp (il perd déjà les 1 614 ventes en baisse), la vue matérialisée `market_rent_stats` et `flatfox_active_count_refresh()`. Le rattrapage fait baisser d'un coup le compte Flatfox actif (~48 400 → ~36 000) : c'est la correction, pas une panne.

## Carte des fichiers

| Zone | Fichiers |
|---|---|
| Données | `supabase/migrations/20260921145000_flatfox_balayage_par_lots.sql` (créé, Question 1), `supabase/migrations/20260921150000_pige_historique_prix.sql` (créé), `src/types/database.ts` |
| Edge | `supabase/functions/flatfox-sync/index.ts` (Question 1), `supabase/functions/market-scraper/index.ts` |
| Modèle et données front | `src/components/matching-recherche/pige.ts` (créé), `src/hooks/usePige.ts` (créé), `src/components/matching-recherche/types.ts`, `src/hooks/useMatchingRecherche.ts`, `src/hooks/useMarketListing.ts` |
| Écrans | `src/components/matching-recherche/MrhBouge.tsx` (créé), `src/components/matching-recherche/MrhHistoriquePrix.tsx` (créé), `MatchingRechercheHybride.tsx`, `MrhExtDetail.tsx`, `RechIcon.tsx`, `mrh.css`, `src/pages/agent/ExternalListingDetailPage.tsx` |
| i18n | `src/i18n/locales/{fr,de,en,it}/matching.json` (partagé avec 1a) |
| Bancs | `src/components/matching-recherche/mrhDemo.ts`, `src/pages/dev/crmFixtures.ts` (partagé avec 1a) |
| Tests | `tests/backend/pige-historique-prix.spec.ts` (créé), `tests/unit/pige-sql.spec.ts` (créé), `tests/unit/pige.spec.ts` (créé), `tests/unit/mrh-listing-detail.test.ts`, `tests/unit/market-listing.spec.ts`, `tests/unit/megga-x-grammar.spec.ts` (inventaire) |
| Docs | `CLAUDE.md`, `docs/system-map.md`, `docs/schema.md`, `docs/pages.md`, `.claude-flow/knowledge/megga-memory.seed.json` |

---

### Task 0 : Préalables

**Files :** aucun.

- [ ] **Step 1 : L'étape 0 de la feuille de route est faite**

Run : `git diff --name-only --diff-filter=U`
Expected : sortie vide (la fusion de `origin/main` en cours dans ce worktree au 21.09.2026 — `crmFixtures.ts`, `CrmShowcasePage.tsx`, `couleur-barreaux.spec.ts`, `megga-x-grammar.spec.ts`, `docs/system-map.md` — est résolue et commitée, ainsi que les lots 1, 2 et A). Sinon : s'arrêter et le dire à Julien.

- [ ] **Step 2 : Les versions de migration sont libres, branche ET `origin/main`**

Run : `git fetch origin main && { git ls-tree -r --name-only origin/main -- supabase/migrations/; git ls-tree -r --name-only HEAD -- supabase/migrations/; ls supabase/migrations; } | grep -oE '[0-9]{14}' | sort -u | grep -E '^20260921(145000|150000)$'`
Expected : sortie vide. Sinon, choisir deux horodatages libres du même jour, le premier AVANT le second.

- [ ] **Step 3 : Point de départ vert**

Run : `npx tsc -b 2>&1 | tail -3 && npx vitest run tests/unit/mrh-listing-detail.test.ts tests/unit/market-listing.spec.ts`
Expected : tsc sans erreur, les deux specs PASS. Noter tout rouge préexistant pour ne pas se l'attribuer.

---

### Task 1 : Les gardes d'abord — backend (CI) et statique (local)

**Files :**
- Create : `tests/backend/pige-historique-prix.spec.ts`
- Create : `tests/unit/pige-sql.spec.ts`

- [ ] **Step 1 : Écrire la spec backend**

```ts
// Backend test — Pige lisible et historique des prix (migrations 20260921145000 et 20260921150000).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : la suite tourne contre un Supabase local fraîchement migré.
//
// CE QUE CE FICHIER FIGE
//  1. Une ligne d'historique par changement RÉEL : le passage nocturne de la collecte, qui réécrit
//     toutes les colonnes, n'en écrit aucune quand ni le prix ni le statut n'ont bougé.
//  2. Flatfox : le premier prix est gelé et la baisse détectée (price_reduced + price_reduced_at),
//     comme RealAdvisor depuis le 19.06.2026 — l'upsert réécrivait price_at_first_seen à chaque passage.
//  3. removed_at : posé au retrait, conservé tant que l'annonce reste retirée, effacé à son retour.
//  4. pige_mouvements : les trois flux, les filtres durs, la pagination par clé, anon refusé.
//  5. market_price_history : lisible par un agent, jamais écrite par lui.
//  6. flatfox_balayer_retraits : retire par lots bornés, et seulement ce qui n'a pas été revu.
//
// MÉTHODE : un micro-marché semé dans une VILLE unique au run (le flux se filtre dessus), détruit en
// afterAll — l'historique part en cascade (FK ON DELETE CASCADE). Aucune ligne préexistante n'est
// écrite : le balayage n'est éprouvé que sous une borne en l'an 2000, que seules nos lignes datent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'
const JOUR = 86_400_000

interface Ligne {
  kind: string
  old_price: number | null
  new_price: number | null
  old_status: string | null
  new_status: string | null
  change_pct: number | null
  city: string | null
  transaction_type: string | null
}

interface Mouvement {
  event_id: string
  detected_at: string
  kind: string
  market_listing_id: string
  old_price: number | string | null
  new_price: number | string | null
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

describe.skipIf(!HAS_KEYS)('pige — historique des prix, retrait daté, flux « Ce qui a bougé »', () => {
  const STAMP = Date.now()
  const CITY = `Pige QA ${STAMP}`
  let service: SupabaseClient
  let agents: TwoAgenciesSetup
  const semees: string[] = []

  const sourceId = (suffixe: string) => `pige-${suffixe}-${STAMP}`

  /** Une location Flatfox vivante, publiée il y a quarante jours. */
  const semer = async (suffixe: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const { data, error } = await service
      .from('market_listings')
      .insert({
        source_portal: 'flatfox', source_id: sourceId(suffixe), title: `Pige QA ${suffixe}`,
        city: CITY, canton: 'GE', type: 'apartment', transaction_type: 'rent',
        price: 3000, current_price: 3000, price_at_first_seen: 3000, status: 'active', quality_score: 80,
        first_seen_at: new Date(Date.now() - 40 * JOUR).toISOString(),
        ...extra,
      })
      .select('id')
      .single()
    if (error) throw new Error(`semis ${suffixe} : ${error.message}`)
    semees.push(data.id as string)
    return data.id as string
  }

  /** Ce que fait `flatfox-sync` chaque nuit : TOUTES les colonnes réécrites, `active` posé d'office. */
  const passageFlatfox = async (suffixe: string, prix: number): Promise<void> => {
    const { error } = await service.from('market_listings').upsert([{
      source_portal: 'flatfox', source_id: sourceId(suffixe), title: `Pige QA ${suffixe}`,
      city: CITY, canton: 'GE', type: 'apartment', transaction_type: 'rent',
      price: prix, current_price: prix, price_at_first_seen: prix, status: 'active', quality_score: 80,
      last_seen_at: new Date().toISOString(),
    }], { onConflict: 'source_portal,source_id' })
    if (error) throw new Error(`passage ${suffixe} : ${error.message}`)
  }

  const historique = async (id: string): Promise<Ligne[]> => {
    const { data, error } = await service
      .from('market_price_history')
      .select('kind, old_price, new_price, old_status, new_status, change_pct, city, transaction_type')
      .eq('market_listing_id', id)
      .order('detected_at', { ascending: true })
    if (error) throw new Error(`historique : ${error.message}`)
    return (data ?? []).map((l) => ({
      ...l, old_price: num(l.old_price), new_price: num(l.new_price), change_pct: num(l.change_pct),
    })) as Ligne[]
  }

  const annonce = async (id: string) => {
    const { data, error } = await service
      .from('market_listings')
      .select('status, removed_at, price_at_first_seen, price_reduced_at')
      .eq('id', id)
      .single()
    if (error) throw new Error(`annonce : ${error.message}`)
    return data as { status: string; removed_at: string | null; price_at_first_seen: number | string; price_reduced_at: string | null }
  }

  beforeAll(async () => {
    service = serviceRoleClient()
    agents = await setupTwoAgencies()
  })

  afterAll(async () => {
    for (const id of semees) await service.from('market_listings').delete().eq('id', id)
    await agents?.cleanup()
  })

  it('une insertion écrit UNE apparition, avec le contexte de l’annonce', async () => {
    const id = await semer('apparition')
    expect(await historique(id)).toEqual([
      { kind: 'apparition', old_price: null, new_price: 3000, old_status: null, new_status: 'active', change_pct: null, city: CITY, transaction_type: 'rent' },
    ])
  })

  it('le passage nocturne qui ne change ni le prix ni le statut n’écrit rien', async () => {
    const id = await semer('stable')
    await passageFlatfox('stable', 3000)
    await passageFlatfox('stable', 3000)
    expect((await historique(id)).map((l) => l.kind)).toEqual(['apparition'])
  })

  it('Flatfox : le premier prix est gelé, la baisse est détectée, datée et historisée', async () => {
    const id = await semer('baisse')
    // L'upsert réécrit price_at_first_seen à 2700 : c'est ce qui rendait la baisse indétectable.
    await passageFlatfox('baisse', 2700)
    const a = await annonce(id)
    expect(a.status).toBe('price_reduced')
    expect(Number(a.price_at_first_seen)).toBe(3000)
    expect(a.price_reduced_at).not.toBeNull()
    const h = await historique(id)
    expect(h.map((l) => l.kind)).toEqual(['apparition', 'baisse'])
    expect(h[1]).toMatchObject({ old_price: 3000, new_price: 2700, old_status: 'active', new_status: 'price_reduced', change_pct: -10 })
  })

  it('une hausse est historisée, et l’annonce reste `active`', async () => {
    const id = await semer('hausse')
    await passageFlatfox('hausse', 3150)
    expect((await annonce(id)).status).toBe('active')
    const h = await historique(id)
    expect(h.map((l) => l.kind)).toEqual(['apparition', 'hausse'])
    expect(h[1]).toMatchObject({ old_price: 3000, new_price: 3150, change_pct: 5 })
  })

  it('removed_at : posé au retrait, gardé tant que l’annonce reste retirée, effacé à son retour', async () => {
    const id = await semer('retrait')
    const { error } = await service.from('market_listings').update({ status: 'removed' }).eq('id', id)
    expect(error).toBeNull()
    const retiree = await annonce(id)
    expect(retiree.status).toBe('removed')
    expect(retiree.removed_at).not.toBeNull()
    // Une écriture qui ne touche pas au statut (comme la sonde RealAdvisor) ne déplace pas la date.
    await service.from('market_listings').update({ last_seen_at: new Date().toISOString() }).eq('id', id)
    expect((await annonce(id)).removed_at).toBe(retiree.removed_at)
    // Le retour : la collecte repose `active`.
    await passageFlatfox('retrait', 3000)
    expect(await annonce(id)).toMatchObject({ status: 'active', removed_at: null })
    expect((await historique(id)).map((l) => l.kind)).toEqual(['apparition', 'retrait', 'retour'])
  })

  describe('pige_mouvements — le flux « Ce qui a bougé »', () => {
    let apparue = ''
    let baissee = ''
    let retiree = ''
    const flux = async (client: SupabaseClient, args: Record<string, unknown>) => {
      const { data, error } = await client.rpc('pige_mouvements', {
        p_since: new Date(Date.now() - 3_600_000).toISOString(), p_city: CITY, p_tx: 'buy', ...args,
      })
      return { lignes: (data ?? []) as Mouvement[], error }
    }

    beforeAll(async () => {
      const vente = { transaction_type: 'buy', type: 'villa' }
      apparue = await semer('flux-apparue', { ...vente, price: 5_200_000, current_price: 5_200_000, price_at_first_seen: 5_200_000 })
      baissee = await semer('flux-baissee', { ...vente, price: 6_000_000, current_price: 6_000_000, price_at_first_seen: 6_000_000 })
      retiree = await semer('flux-retiree', { ...vente, price: 7_000_000, current_price: 7_000_000, price_at_first_seen: 7_000_000 })
      const { error: e1 } = await service.from('market_listings').update({ price: 5_500_000, current_price: 5_500_000 }).eq('id', baissee)
      const { error: e2 } = await service.from('market_listings').update({ status: 'removed' }).eq('id', retiree)
      if (e1 || e2) throw new Error(`préparation du flux : ${(e1 ?? e2)!.message}`)
    })

    it('chaque flux rend ses mouvements : apparues vivantes, baisses, retraits', async () => {
      const apparitions = await flux(service, { p_kind: 'apparition' })
      expect(apparitions.error).toBeNull()
      expect(apparitions.lignes.map((l) => l.market_listing_id).sort()).toEqual([apparue, baissee].sort())
      const baisses = await flux(service, { p_kind: 'baisse' })
      expect(baisses.lignes.map((l) => l.market_listing_id)).toEqual([baissee])
      expect([num(baisses.lignes[0]!.old_price), num(baisses.lignes[0]!.new_price)]).toEqual([6_000_000, 5_500_000])
      expect((await flux(service, { p_kind: 'retrait' })).lignes.map((l) => l.market_listing_id)).toEqual([retiree])
    })

    it('les filtres durs : type, canton, tranche de prix (marge de 15 % comme la grille), transaction', async () => {
      expect((await flux(service, { p_kind: 'apparition', p_types: ['apartment'] })).lignes).toEqual([])
      expect((await flux(service, { p_kind: 'apparition', p_cantons: ['VD'] })).lignes).toEqual([])
      // 4,6 M × 1,15 = 5,29 M : l'apparition à 5,2 M passe, celle à 6 M non.
      expect((await flux(service, { p_kind: 'apparition', p_budget_max: 4_600_000 })).lignes.map((l) => l.market_listing_id)).toEqual([apparue])
      expect((await flux(service, { p_kind: 'apparition', p_tx: 'rent' })).lignes.map((l) => l.market_listing_id)).not.toContain(apparue)
    })

    it('la pagination par clé rend deux pages d’une ligne, sans doublon ni trou', async () => {
      const p1 = await flux(service, { p_kind: 'apparition', p_limit: 1 })
      expect(p1.lignes).toHaveLength(1)
      const a = p1.lignes[0]!
      const p2 = await flux(service, { p_kind: 'apparition', p_limit: 1, p_before_at: a.detected_at, p_before_id: a.event_id })
      expect(p2.lignes).toHaveLength(1)
      const b = p2.lignes[0]!
      expect([a.market_listing_id, b.market_listing_id].sort()).toEqual([apparue, baissee].sort())
      const p3 = await flux(service, { p_kind: 'apparition', p_limit: 1, p_before_at: b.detected_at, p_before_id: b.event_id })
      expect(p3.lignes).toEqual([])
    })

    it('anon est refusé ; un agent authentifié lit le flux', async () => {
      expect((await flux(anonClient(), { p_kind: 'apparition' })).error?.code).toBe(DENIED)
      const agent = await flux(agents.clientA, { p_kind: 'baisse' })
      expect(agent.error).toBeNull()
      expect(agent.lignes.map((l) => l.market_listing_id)).toEqual([baissee])
    })

    it('un agent lit l’historique mais ne peut pas l’écrire', async () => {
      const lecture = await agents.clientA.from('market_price_history').select('kind').eq('market_listing_id', apparue)
      expect(lecture.error).toBeNull()
      expect(lecture.data).toEqual([{ kind: 'apparition' }])
      const ecriture = await agents.clientA.from('market_price_history').insert({ market_listing_id: apparue, kind: 'baisse', old_price: 2, new_price: 1 })
      expect(ecriture.error?.code).toBe(DENIED)
    })
  })

  // ⚠ Question 1 : si Julien écarte le balayage par lots, retirer ce bloc avec la migration 145000.
  describe('flatfox_balayer_retraits — le balayage par lots', () => {
    // Borne en l'an 2000 : seules les lignes semées ici ont une dernière vue plus ancienne.
    const BORNE = '2000-01-01T00:00:00Z'

    it('retire par lots bornés les Flatfox non revues, et seulement elles', async () => {
      const perdue1 = await semer('balai-perdue-1', { last_seen_at: '1999-06-01T00:00:00Z' })
      const perdue2 = await semer('balai-perdue-2', { last_seen_at: '1999-06-02T00:00:00Z' })
      const revue = await semer('balai-revue', { last_seen_at: '2000-06-01T00:00:00Z' })
      const lot = async (): Promise<number> => {
        const { data, error } = await service.rpc('flatfox_balayer_retraits', { p_sync_start: BORNE, p_limit: 1 })
        expect(error).toBeNull()
        return Number(data)
      }
      expect([await lot(), await lot(), await lot()]).toEqual([1, 1, 0])
      for (const id of [perdue1, perdue2]) {
        const a = await annonce(id)
        expect(a.status).toBe('removed')
        expect(a.removed_at).not.toBeNull()
      }
      expect((await annonce(revue)).status).toBe('active')
      expect((await historique(perdue1)).map((l) => l.kind)).toEqual(['apparition', 'retrait'])
    })

    it('réservé au service : un agent authentifié est refusé', async () => {
      const { error } = await agents.clientA.rpc('flatfox_balayer_retraits', { p_sync_start: BORNE })
      expect(error?.code).toBe(DENIED)
    })
  })
})
```

- [ ] **Step 2 : Écrire la garde statique locale**

`tests/unit/pige-sql.spec.ts` :

```ts
/**
 * Garde statique de la pige (21.09.2026) — ce que la suite backend ne voit qu'en CI, lu dans le TEXTE des
 * migrations pour rougir en local :
 *  1. le rattrapage Flatfox s'applique AVANT les déclencheurs de la pige, et une seule fois (sinon ses
 *     ~12 500 retraits d'avant la mise en service seraient datés du jour et inonderaient « Retirés ») ;
 *  2. le flux reste SECURITY INVOKER, borné, et ne compte jamais (CLAUDE.md §7) ;
 *  3. l'historique ne s'écrit que sur un changement réel (clause WHEN sur l'UPDATE).
 * ⚠ Question 1 : si Julien écarte le balayage par lots, retirer les deux premiers `it`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const DIR = 'supabase/migrations'
const fichiers = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
const PIGE = fichiers.find((f) => f.endsWith('_pige_historique_prix.sql'))
const BALAYAGE = fichiers.find((f) => f.endsWith('_flatfox_balayage_par_lots.sql'))
const lire = (f: string | undefined): string => (f ? readFileSync(`${DIR}/${f}`, 'utf8').toLowerCase() : '')

describe('pige — garde statique des migrations', () => {
  it('les deux migrations existent et sont datées du même jour', () => {
    expect(PIGE, 'migration de la pige introuvable').toBeDefined()
    expect(BALAYAGE, 'migration du balayage Flatfox introuvable').toBeDefined()
    expect(PIGE!.slice(0, 8)).toBe(BALAYAGE!.slice(0, 8))
  })

  it('le rattrapage Flatfox passe AVANT les déclencheurs de la pige, et une seule fois', () => {
    expect(fichiers.indexOf(BALAYAGE!)).toBeLessThan(fichiers.indexOf(PIGE!))
    expect(lire(BALAYAGE)).toContain("tgname = 'trg_ml_historique_maj'")
  })

  it('le flux reste SECURITY INVOKER, borné, et ne compte jamais', () => {
    const sql = lire(PIGE)
    const debut = sql.indexOf('create function public.pige_mouvements')
    const fin = sql.indexOf('comment on function public.pige_mouvements')
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    const corps = sql.slice(debut, fin)
    expect(corps).toContain('security invoker')
    expect(corps).not.toMatch(/count\s*\(/)
    expect(corps).toContain('limit least(greatest(')
  })

  it('l’historique ne s’écrit que sur un changement réel de prix ou de statut', () => {
    const sql = lire(PIGE).replace(/\s+/g, ' ')
    expect(sql).toContain(
      'create trigger trg_ml_historique_maj after update on public.market_listings for each row ' +
        'when (old.current_price is distinct from new.current_price or old.price is distinct from new.price ' +
        'or old.status is distinct from new.status)',
    )
  })
})
```

- [ ] **Step 3 : Voir la garde rouge**

Run : `npx vitest run tests/unit/pige-sql.spec.ts`
Expected : FAIL — « migration de la pige introuvable » (les migrations n'existent pas encore).

Si la pile locale tourne (`npx supabase start`, puis les variables `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` lues dans `npx supabase status`) : `npm run test:backend -- tests/backend/pige-historique-prix.spec.ts` → FAIL (colonne `kind` et RPC absentes). Sans pile locale, la spec est ignorée en local et tourne en CI (« Backend Integration Tests ») : le noter.

- [ ] **Point de commit (au signal)** : avec les Tasks 3, 4 et 6 (sujet « historique et flux »).

---

### Task 2 : Migration Flatfox — rattrapage et balayage par lots (Question 1)

**Files :**
- Create : `supabase/migrations/20260921145000_flatfox_balayage_par_lots.sql`

⚠ **Sur accord de Julien seulement (Question 1).** Sans accord : ne pas créer ce fichier, sauter la Task 5, retirer le dernier `describe` de la spec backend et les deux premiers `it` de `pige-sql.spec.ts`, et laisser le point 12 des décisions en attente.

- [ ] **Step 1 : Écrire la migration**

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Flatfox : le balayage des retraits repart, par lots (pige, étape 1b, 21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Plan : docs/superpowers/plans/2026-09-21-pige-lisible.md, Task 2 (Question 1).
--
-- ⛔ LE BALAYAGE FLATFOX EST EN PANNE MUETTE DEPUIS LE 05.09.2026. Mesuré en production le 21.09 :
--   · `flatfox_sync_runs.total_removed` = 0 à chaque passage depuis le 05.09, runs pourtant `completed` ;
--   · journal de l'edge : « sweep error: canceling statement due to statement timeout » (04:17:23 UTC) —
--     l'UPDATE unique de retrait dépasse les 8 s de PostgREST ;
--   · 12 492 annonces Flatfox « actives » non vues au passage du 21.09, dont 7 882 depuis plus de sept
--     jours : un quart des locations servies au matching n'existent plus.
--
-- 1. Un index partiel des Flatfox vivantes par dernière vue : le balayage n'y lit que les candidates, au
--    lieu de traverser les ~94 000 retirées de `idx_ml_flatfox_sync` avec un accès au tas chacune.
-- 2. Rattrapage : ces annonces passent `removed`, UNE fois, AVANT que la migration de la pige
--    (20260921150000) ne pose ses déclencheurs. Disparues avant la mise en service, elles gardent
--    removed_at NULL et n'écrivent aucun historique, comme toute annonce retirée avant elle ; sans cet
--    ordre, « Retirés » les daterait toutes du jour de la fusion.
-- 3. flatfox_balayer_retraits() : un lot borné par appel ; `flatfox-sync` rappelle tant qu'un lot revient
--    plein.
--
-- ⚠ DATE-GUARD : horodatage ≥ au jour UTC de la fusion, sinon `deploy.yml` la saute ; la renommer au jour
-- de la fusion en gardant un horodatage ANTÉRIEUR à celui de la migration de la pige.
-- Rejouable : le rattrapage se tait dès que le déclencheur de la pige existe (rejeu du même jour).
-- ⚠ Pas de CONCURRENTLY : deploy.yml envoie le fichier en un seul bloc transactionnel.

begin;

set local statement_timeout = '120s';

-- ─── 1. Index (posé d'abord : le rattrapage s'en sert) ─────────────────────────
create index if not exists idx_ml_flatfox_vivantes_vues
  on public.market_listings (last_seen_at)
  where source_portal = 'flatfox' and status in ('active', 'price_reduced');

-- ─── 2. Rattrapage, une seule fois ────────────────────────────────────────────
do $$
declare
  v_depart timestamptz;
  v_vivantes integer;
  v_candidates integer;
begin
  -- Rejeu du même jour : la pige est posée, ce qui reste appartient au balayage par lots.
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.market_listings'::regclass and tgname = 'trg_ml_historique_maj'
  ) then
    raise notice 'rattrapage Flatfox : déjà fait (la pige est en service)';
    return;
  end if;

  -- Le dernier passage COMPLET qui a vu au moins 80 % de ce qu'il attendait (la garde de l'edge).
  select r.started_at into v_depart
    from public.flatfox_sync_runs r
   where r.status = 'completed'
     and r.total_expected > 0
     and r.total_seen >= 0.8 * r.total_expected
   order by r.started_at desc
   limit 1;
  if v_depart is null then
    raise notice 'rattrapage Flatfox : aucun passage complet, rien à faire';
    return;
  end if;

  select count(*) into v_vivantes
    from public.market_listings
   where source_portal = 'flatfox' and status in ('active', 'price_reduced');

  -- ⚠ Dix minutes de marge : la première invocation de l'edge fixe l'horodatage qu'elle écrit dans
  -- `last_seen_at` (`nowIso`) quelques secondes AVANT d'insérer la ligne de run (`started_at`).
  select count(*) into v_candidates
    from public.market_listings
   where source_portal = 'flatfox' and status in ('active', 'price_reduced')
     and last_seen_at < v_depart - interval '10 minutes';

  -- Au-delà de 40 % du vivier, c'est un incident, pas un rattrapage : on ne retire rien.
  if v_candidates > 0.4 * v_vivantes then
    raise notice 'rattrapage Flatfox : % candidates sur % vivantes, au-delà de 40 %% — rien n''est retiré', v_candidates, v_vivantes;
    return;
  end if;

  update public.market_listings
     set status = 'removed'
   where source_portal = 'flatfox' and status in ('active', 'price_reduced')
     and last_seen_at < v_depart - interval '10 minutes';
  raise notice 'rattrapage Flatfox : % annonces retirées (dernier passage complet : %)', v_candidates, v_depart;
end $$;

-- ─── 3. Le balayage par lots ──────────────────────────────────────────────────
create or replace function public.flatfox_balayer_retraits(
  p_sync_start timestamptz,
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not (public.is_service_role() or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: service or postgres only' using errcode = '42501';
  end if;

  update public.market_listings ml
     set status = 'removed'
   where ml.id in (
     select c.id
       from public.market_listings c
      where c.source_portal = 'flatfox'
        and c.status in ('active', 'price_reduced')
        and c.last_seen_at < p_sync_start
      order by c.last_seen_at desc
      limit greatest(1, least(coalesce(p_limit, 500), 2000))
   );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

comment on function public.flatfox_balayer_retraits(timestamptz, integer) is
  'Retire (status = removed) au plus p_limit annonces Flatfox vivantes non revues depuis p_sync_start. Appelée en boucle par flatfox-sync tant qu''un lot revient plein : l''UPDATE unique d''avant dépassait le statement_timeout de 8 s (panne muette du 05.09 au 21.09.2026). Service_role ou postgres seuls.';

revoke all on function public.flatfox_balayer_retraits(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.flatfox_balayer_retraits(timestamptz, integer) to service_role;

commit;
```

- [ ] **Step 2 : Vérifier le rejeu**

Run : `npm run lint:migrations`
Expected : sortie sans « non rejouable ».

- [ ] **Point de commit (au signal)** : avec la Task 5 — `fix(flatfox): le balayage des retraits repart, par lots`.

---

### Task 3 : Migration de la pige — historique, retrait daté, flux

**Files :**
- Create : `supabase/migrations/20260921150000_pige_historique_prix.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Pige lisible et historique des prix (étape 1b de la feuille de route, 21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Plan : docs/superpowers/plans/2026-09-21-pige-lisible.md. Cahier des charges de Gregory, modules
-- « Pige lisible » et « Historique des prix » (P0).
--
-- Mesuré en production le 21.09.2026, en lecture seule :
--   · market_price_history : 0 ligne ; son seul écrivain était `market-scraper`, dormant.
--   · Flatfox : price_at_first_seen = current_price sur 48 406 actives sur 48 406 — l'upsert réécrit le
--     « premier prix » à chaque passage, aucune baisse n'est détectable ; trg_ra_price_status
--     (20260619160000) ne visait que RealAdvisor.
--   · Retrait sans date ; updated_at n'en tient pas lieu : la sonde de résurrection RealAdvisor
--     (02:45 UTC) le repousse chaque nuit sur les retirées (4 060 touchées en 24 h).
--   · Un flux lu sur market_listings expire à froid (11,5 s pour une ville rare sur 30 jours) : le flux
--     lit donc CETTE table, qui porte le contexte de l'annonce à l'instant de l'événement.
--
-- DANS CET ORDRE :
--   1. market_listings.removed_at.
--   2. market_price_history ouverte aux relevés, apparitions et statuts ; seul le déclencheur y écrit.
--   3. Le premier prix gelé et la baisse détectée aussi sur Flatfox (trg_ra_price_status).
--   4. removed_at posé par déclencheur.
--   5. Une ligne d'historique à l'insertion et à chaque changement RÉEL de prix ou de statut.
--   6. Relevé initial `suivi` de chaque annonce vivante : l'historique commence ICI, on ne reconstitue
--      pas le passé. Les annonces déjà retirées gardent removed_at NULL.
--   7. Index.
--   8. pige_mouvements() : « Ce qui a bougé » (SECURITY INVOKER, paginé par clé, sans comptage).
--
-- ⚠ DATE-GUARD (`deploy.yml`) : appliquée seulement si son horodatage est ≥ au jour UTC de la fusion,
-- et rejouée à chaque push de ce jour-là. Tout est rejouable (le relevé saute les annonces qui ont déjà
-- une ligne). Renommer au jour de la fusion si elle a lieu plus tard, APRÈS 20260921145000.
-- ⚠ Pas de CONCURRENTLY : deploy.yml envoie le fichier en un seul bloc transactionnel.

begin;

set local statement_timeout = '120s';

-- ─── 1. La date du retrait ────────────────────────────────────────────────────
alter table public.market_listings add column if not exists removed_at timestamptz;

comment on column public.market_listings.removed_at is
  'Date à laquelle le CRM a CONSTATÉ le retrait (passage à status = ''removed''), posée par trg_ml_date_retrait et effacée au retour. NULL pour une annonce vivante, et pour toute annonce retirée avant la mise en service de la pige (21.09.2026) : on ne reconstitue pas le passé. RealAdvisor confirme un retrait jusqu''à ~3 jours après la première absence (absent_first_at).';

-- ─── 2. L'historique : relevés, apparitions, statuts ──────────────────────────
alter table public.market_price_history alter column old_price drop not null;
alter table public.market_price_history alter column new_price drop not null;
alter table public.market_price_history
  add column if not exists kind text,
  add column if not exists old_status text,
  add column if not exists new_status text,
  add column if not exists transaction_type text,
  add column if not exists canton text,
  add column if not exists type text,
  add column if not exists city text;

-- Lignes éventuelles de l'ancien `market-scraper` (0 en production le 21.09.2026) : rangées, pas perdues.
update public.market_price_history
   set kind = case when new_price < old_price then 'baisse' when new_price > old_price then 'hausse' else 'prix' end
 where kind is null;

alter table public.market_price_history alter column kind set not null;
alter table public.market_price_history drop constraint if exists market_price_history_kind_check;
alter table public.market_price_history add constraint market_price_history_kind_check
  check (kind in ('suivi', 'apparition', 'baisse', 'hausse', 'prix', 'retrait', 'retour', 'statut'));

comment on table public.market_price_history is
  'Historique des prix et des statuts des annonces du marché, écrit par déclencheur sur market_listings (ml_historique_prix) et par lui seul. Commence à la mise en service de la pige (21.09.2026) : relevé `suivi` de chaque annonce vivante ce jour-là, puis `apparition` de chaque annonce insérée. Chaque ligne porte le contexte de l''annonce à l''instant (transaction_type, canton, type, city) : le flux pige_mouvements filtre dessus.';
comment on column public.market_price_history.kind is
  'suivi : relevé initial · apparition : insertion · baisse / hausse : prix changé (deux prix > 0) · prix : prix affiché ou retiré (0 ↔ X) · retrait : passage à removed · retour : sortie de removed au même prix · statut : autre changement de statut.';

-- Aucun client n'y écrit : le déclencheur (SECURITY DEFINER) est l'écrivain unique.
revoke insert, update, delete, truncate on table public.market_price_history from authenticated;

-- ─── 3. Le premier prix gelé et la baisse, aussi sur Flatfox ───────────────────
-- Même fonction que RealAdvisor (20260619160000) : le premier prix réel se gèle, first_seen_at aussi,
-- et un passage de la collecte (status 'active') bascule en price_reduced sous ce premier prix. Pour les
-- annonces Flatfox déjà en ligne, le premier prix gelé est celui de la veille du premier passage.
drop trigger if exists trg_ra_price_status on public.market_listings;
create trigger trg_ra_price_status
  before update on public.market_listings
  for each row
  when (new.source_portal in ('realadvisor', 'flatfox'))
  execute function public.ra_price_status();

comment on function public.ra_price_status() is
  'Gèle le premier prix (price_at_first_seen) et first_seen_at, et passe une annonce en price_reduced quand son prix courant descend sous ce premier prix, sur un passage de la collecte (status = active). RealAdvisor depuis le 19.06.2026, Flatfox aussi depuis le 21.09.2026 (le nom est resté). Un UPDATE qui pose explicitement un autre statut (retrait) n''est pas touché.';

-- ─── 4. removed_at posé par déclencheur ───────────────────────────────────────
-- ⚠ L'ordre des BEFORE (alphabétique) n'importe pas ici : trg_ra_price_status ne pose ni ne retire
-- jamais `removed`, il choisit seulement entre active et price_reduced.
create or replace function public.ml_date_retrait()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'removed' then
    if tg_op = 'UPDATE' then
      if old.status = 'removed' then
        -- Déjà retirée : la date ne bouge pas (NULL si retirée avant la pige).
        new.removed_at := old.removed_at;
        return new;
      end if;
    end if;
    new.removed_at := now();
  else
    new.removed_at := null;
  end if;
  return new;
end $$;

comment on function public.ml_date_retrait() is
  'Pose market_listings.removed_at au passage à removed, le garde tant que l''annonce reste retirée, l''efface à son retour. Date de CONSTAT, pas de disparition (pige, 21.09.2026).';

drop trigger if exists trg_ml_date_retrait on public.market_listings;
create trigger trg_ml_date_retrait
  before insert or update on public.market_listings
  for each row
  when (new.status = 'removed' or new.removed_at is not null)
  execute function public.ml_date_retrait();

-- ─── 5. L'historique, écrit à chaque changement réel ──────────────────────────
-- AFTER : la ligne voit le statut FINAL, après trg_ra_price_status. SECURITY DEFINER : l'historique se
-- doit à tout écrivain de market_listings (edges en service_role, crons en postgres), quels que soient
-- ses droits sur cette table. change_pct est borné à ±999,99 (numeric(5,2)) : un déclencheur qui lève
-- ferait échouer l'upsert de la collecte.
create or replace function public.ml_historique_prix()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien numeric;
  v_nouveau numeric := coalesce(new.current_price, new.price);
  v_ancien_statut text;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'apparition';
  else
    v_ancien := coalesce(old.current_price, old.price);
    v_ancien_statut := old.status;
    if new.status = 'removed' and old.status is distinct from 'removed' then
      v_kind := 'retrait';
    elsif v_ancien is distinct from v_nouveau then
      v_kind := case
        when v_ancien > 0 and v_nouveau > 0 and v_nouveau < v_ancien then 'baisse'
        when v_ancien > 0 and v_nouveau > 0 and v_nouveau > v_ancien then 'hausse'
        else 'prix'
      end;
    elsif old.status = 'removed' and new.status <> 'removed' then
      v_kind := 'retour';
    elsif old.status is distinct from new.status then
      v_kind := 'statut';
    else
      -- `price` a bougé sans changer le prix effectif (current_price ?? price) : rien à dire.
      return null;
    end if;
  end if;

  insert into public.market_price_history (
    market_listing_id, kind, old_price, new_price, change_pct,
    old_status, new_status, transaction_type, canton, type, city, detected_at
  ) values (
    new.id, v_kind, v_ancien, v_nouveau,
    case when v_ancien > 0 and v_nouveau > 0
         then greatest(-999.99, least(999.99, round((v_nouveau - v_ancien) / v_ancien * 100, 2)))
    end,
    v_ancien_statut, new.status, new.transaction_type, new.canton, new.type, new.city, now()
  );
  return null;
end $$;

comment on function public.ml_historique_prix() is
  'Écrivain unique de market_price_history : apparition à l''insertion, puis retrait, baisse / hausse / prix, retour ou statut à chaque changement RÉEL (clause WHEN du déclencheur de mise à jour). Pige, 21.09.2026.';

drop trigger if exists trg_ml_historique_ins on public.market_listings;
create trigger trg_ml_historique_ins
  after insert on public.market_listings
  for each row
  execute function public.ml_historique_prix();

-- ⚠ Pas de `UPDATE OF current_price, price, status` : trg_ra_price_status (BEFORE) peut changer le
-- statut d'un UPDATE qui ne le nomme pas. La clause WHEN, évaluée sans appel de fonction, suffit à
-- rendre gratuit le passage nocturne qui ne change rien (~76 000 UPDATE par jour en moyenne).
drop trigger if exists trg_ml_historique_maj on public.market_listings;
create trigger trg_ml_historique_maj
  after update on public.market_listings
  for each row
  when (old.current_price is distinct from new.current_price
        or old.price is distinct from new.price
        or old.status is distinct from new.status)
  execute function public.ml_historique_prix();

-- ─── 6. Le relevé initial : l'historique commence ici ─────────────────────────
insert into public.market_price_history
  (market_listing_id, kind, old_price, new_price, old_status, new_status,
   transaction_type, canton, type, city, detected_at)
select ml.id, 'suivi', null, coalesce(ml.current_price, ml.price), null, ml.status,
       ml.transaction_type, ml.canton, ml.type, ml.city, now()
  from public.market_listings ml
 where ml.status in ('active', 'price_reduced')
   and not exists (select 1 from public.market_price_history h where h.market_listing_id = ml.id);

-- ─── 7. Index du flux ─────────────────────────────────────────────────────────
-- Non partiel : le genre est un PARAMÈTRE de pige_mouvements, un index partiel sur `kind` ne se
-- prouverait pas dans un plan générique. La fiche lit idx_market_price_history_listing (existant).
create index if not exists idx_mph_evenements
  on public.market_price_history (kind, detected_at desc, id desc);

-- ─── 8. « Ce qui a bougé » ────────────────────────────────────────────────────
-- Mêmes filtres durs que search_market_listings (20260720150000) — marge sur le budget, prix > 0,
-- qualité — pour que le flux décrive la population que la grille montre. Seules les ≤ p_limit lignes
-- retenues sont jointes à market_listings, par clé primaire.
drop function if exists public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer);

create function public.pige_mouvements(
  p_kind text,
  p_since timestamptz,
  p_tx text default null,
  p_cantons text[] default null,
  p_types text[] default null,
  p_city text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_margin numeric default 0.15,
  p_min_quality integer default 50,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns table (
  event_id uuid,
  detected_at timestamptz,
  kind text,
  market_listing_id uuid,
  old_price numeric,
  new_price numeric,
  change_pct numeric,
  first_seen_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.detected_at, h.kind, h.market_listing_id,
         h.old_price, h.new_price, h.change_pct, ml.first_seen_at
    from public.market_price_history h
    join public.market_listings ml on ml.id = h.market_listing_id
   where p_kind in ('apparition', 'baisse', 'retrait')
     and h.kind = p_kind
     and h.detected_at >= p_since
     and (h.detected_at, h.id) < (coalesce(p_before_at, 'infinity'::timestamptz),
                                  coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
     and h.new_price > 0
     and (p_tx is null or h.transaction_type = p_tx)
     and (p_cantons is null or h.canton = any (p_cantons))
     and (p_types is null or h.type = any (p_types))
     and (p_city is null or public.unaccent(lower(h.city)) = public.unaccent(lower(p_city)))
     and (p_budget_max is null or h.new_price <= p_budget_max * (1 + p_margin))
     and (p_budget_min is null or h.new_price >= p_budget_min * (1 - p_margin))
     and ml.quality_score >= p_min_quality
     and case when h.kind = 'retrait' then ml.status = 'removed'
              else ml.status in ('active', 'price_reduced') end
   order by h.detected_at desc, h.id desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

comment on function public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer) is
  'Pige, « Ce qui a bougé » : apparitions et baisses d''annonces encore vivantes, retraits d''annonces encore retirées, depuis p_since, sur les filtres durs de la Recherche. Pagination par clé (p_before_at, p_before_id), p_limit ≤ 100, jamais de comptage (CLAUDE.md §7). SECURITY INVOKER : la RLS de l''appelant s''applique.';

revoke all on function public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer) from public, anon;
grant execute on function public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer) to authenticated, service_role;

commit;
```

- [ ] **Step 2 : Vérifier le rejeu et la garde statique**

Run : `npm run lint:migrations && npx vitest run tests/unit/pige-sql.spec.ts`
Expected : lint sans « non rejouable » ; `pige-sql.spec.ts` PASS, 4 tests (2 si la Question 1 est refusée).

- [ ] **Step 3 (si la pile locale tourne) : la spec backend**

Run : `npx supabase db reset && npm run test:backend -- tests/backend/pige-historique-prix.spec.ts`
Expected : PASS (12 tests, 10 sans le bloc Question 1). Sans pile locale : la CI le jouera, le noter dans la PR.

- [ ] **Point de commit (au signal)** : avec les Tasks 1, 4 et 6.

---

### Task 4 : Les types

**Files :**
- Modify : `src/types/database.ts` (partagé avec 1a : le relire juste avant d'écrire)

- [ ] **Step 1 : `market_listings`**

Dans les trois blocs `Row`, `Insert`, `Update` de `market_listings`, ajouter `removed_at` entre `relevance_score` et `rent` :
- `Row` : `          removed_at: string | null`
- `Insert` et `Update` : `          removed_at?: string | null`

- [ ] **Step 2 : `market_price_history`**

Remplacer les trois blocs `Row` / `Insert` / `Update` de `market_price_history` (ne pas toucher `Relationships`) par :

```ts
        Row: {
          canton: string | null
          change_pct: number | null
          city: string | null
          detected_at: string
          id: string
          kind: string
          market_listing_id: string
          new_price: number | null
          new_status: string | null
          old_price: number | null
          old_status: string | null
          transaction_type: string | null
          type: string | null
        }
        Insert: {
          canton?: string | null
          change_pct?: number | null
          city?: string | null
          detected_at?: string
          id?: string
          kind: string
          market_listing_id: string
          new_price?: number | null
          new_status?: string | null
          old_price?: number | null
          old_status?: string | null
          transaction_type?: string | null
          type?: string | null
        }
        Update: {
          canton?: string | null
          change_pct?: number | null
          city?: string | null
          detected_at?: string
          id?: string
          kind?: string
          market_listing_id?: string
          new_price?: number | null
          new_status?: string | null
          old_price?: number | null
          old_status?: string | null
          transaction_type?: string | null
          type?: string | null
        }
```

- [ ] **Step 3 : Les deux fonctions**

Dans `Functions`, après `flatfox_active_count_refresh: { Args: never; Returns: number }` :

```ts
      flatfox_balayer_retraits: {
        Args: { p_limit?: number; p_sync_start: string }
        Returns: number
      }
```

Entre `pg_database_size_mb: { Args: never; Returns: number }` et `populate_geometry_columns:` :

```ts
      pige_mouvements: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_budget_max?: number
          p_budget_min?: number
          p_cantons?: string[]
          p_city?: string
          p_kind: string
          p_limit?: number
          p_margin?: number
          p_min_quality?: number
          p_since: string
          p_tx?: string
          p_types?: string[]
        }
        Returns: {
          change_pct: number
          detected_at: string
          event_id: string
          first_seen_at: string
          kind: string
          market_listing_id: string
          new_price: number
          old_price: number
        }[]
      }
```

- [ ] **Step 4 : Vérifier**

Run : `npm run lint:types-freshness && npx tsc -b 2>&1 | tail -3`
Expected : porte verte (mode statique) ; tsc sans erreur.

- [ ] **Point de commit (au signal)** : avec les Tasks 1, 3 et 6.

---

### Task 5 : `flatfox-sync` — le balayage par lots (Question 1)

**Files :**
- Modify : `supabase/functions/flatfox-sync/index.ts`

- [ ] **Step 1 : Remplacer `runSweep`**

Remplacer toute la fonction, du commentaire `// ─── Sweep : marque 'removed' les biens Flatfox non vus depuis sync_start_at ───` jusqu'à la fin de `runSweep` (le `}` qui précède `// ─── Main handler ───`), par :

```ts
// ─── Sweep : marque 'removed' les biens Flatfox non vus depuis sync_start_at ───

/** Retraits par appel de `flatfox_balayer_retraits` : un lot tient largement sous le statement_timeout. */
const SWEEP_LOT = 500
/** Plafond d'appels : 60 lots, bien plus que tout le catalogue — au-delà, c'est un bug, on s'arrête. */
const SWEEP_MAX_LOTS = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSweep(supabase: any, syncStartAt: string, _totalSeen: number, totalExpected: number): Promise<{ removed: number; skipped_safety: boolean; erreur: string | null }> {
  // Count via DB (plus fiable que stats fragmentés entre chunks parallèles)
  const { count: actuallySeen } = await supabase
    .from('market_listings')
    .select('id', { count: 'exact', head: true })
    .eq('source_portal', 'flatfox')
    .gte('last_seen_at', syncStartAt)
  const totalSeen = actuallySeen ?? 0
  const ratio = totalExpected > 0 ? totalSeen / totalExpected : 0
  console.log(`[sweep check] totalSeen=${totalSeen} totalExpected=${totalExpected} ratio=${Math.round(ratio * 100)}%`)
  if (ratio < SAFETY_MIN_RATIO) {
    console.warn(`⚠️ Safety skip: only ${Math.round(ratio * 100)}% of expected listings upserted (${totalSeen}/${totalExpected}, threshold ${Math.round(SAFETY_MIN_RATIO * 100)}%). Sweep skipped to avoid wipe.`)
    return { removed: 0, skipped_safety: true, erreur: null }
  }
  // ⛔ PAR LOTS, PAR LA RPC. L'UPDATE unique d'avant (toutes les Flatfox non revues en une requête)
  // dépassait le statement_timeout de 8 s de PostgREST depuis le 05.09.2026 : `total_removed = 0` chaque
  // nuit, run pourtant `completed`, et 12 492 annonces disparues restées « actives » au 21.09.2026.
  // `flatfox_balayer_retraits` retire au plus SWEEP_LOT annonces par appel (index partiel
  // `idx_ml_flatfox_vivantes_vues`) ; on rappelle tant qu'un lot revient plein.
  // On ne supprime JAMAIS les rows : le statut passe à `removed`, et les déclencheurs datent le retrait
  // (`removed_at`) et l'écrivent à l'historique.
  let removed = 0
  for (let lot = 0; lot < SWEEP_MAX_LOTS; lot++) {
    const { data, error } = await supabase.rpc('flatfox_balayer_retraits', { p_sync_start: syncStartAt, p_limit: SWEEP_LOT })
    if (error) {
      console.error('sweep error:', error.message)
      return { removed, skipped_safety: false, erreur: error.message }
    }
    const n = Number(data ?? 0)
    removed += n
    if (n < SWEEP_LOT) return { removed, skipped_safety: false, erreur: null }
  }
  return { removed, skipped_safety: false, erreur: `plafond de ${SWEEP_MAX_LOTS} lots atteint` }
}
```

- [ ] **Step 2 : Un balayage en échec ne finit plus `completed`**

Dans `runBackground`, branche `mode === 'sweep'`, remplacer :

```ts
      const residu: string[] = []
      if (stats.errors > 0) residu.push(`${stats.errors} ligne(s) en échec d'upsert`)
```

par :

```ts
      const residu: string[] = []
      // ⛔ Le balayage échouait en silence du 05.09 au 21.09.2026 : le run finissait `completed` avec
      // 0 retrait. Un échec de balayage dit désormais son nom, et le run finit `failed`.
      if (sweep.erreur) residu.push(`balayage interrompu après ${sweep.removed} retrait(s) : ${sweep.erreur}`)
      if (stats.errors > 0) residu.push(`${stats.errors} ligne(s) en échec d'upsert`)
```

puis, dans l'appel `finalizeRun` qui suit, remplacer :

```ts
        status: sweep.skipped_safety ? 'safety_skipped' : 'completed',
```

par :

```ts
        status: sweep.erreur ? 'failed' : sweep.skipped_safety ? 'safety_skipped' : 'completed',
```

- [ ] **Step 3 : Vérifier**

Run : `command -v deno && deno check --no-lock supabase/functions/flatfox-sync/index.ts ; npm run lint:edge-auth`
Expected : `deno check` sans erreur (s'il est installé ; sinon la CI « Type-check Edge Functions » le fera — le noter), porte d'authentification verte (la garde `isServiceSecret` est intacte).

- [ ] **Point de commit (au signal)** : avec la Task 2 — `fix(flatfox): le balayage des retraits repart, par lots`.

---

### Task 6 : `market-scraper` — un seul écrivain

**Files :**
- Modify : `supabase/functions/market-scraper/index.ts`

- [ ] **Step 1 : Retirer l'insertion directe**

Remplacer :

```ts
        const oldPrice = Number(existing.current_price) || 0
        if (oldPrice > 0 && salePrice > 0 && oldPrice !== salePrice) {
          await supabase.from('market_price_history').insert({
            market_listing_id: existing.id, old_price: oldPrice, new_price: salePrice,
            change_pct: Math.round(((salePrice - oldPrice) / oldPrice) * 10000) / 100,
          })
          updates.current_price = salePrice
```

par :

```ts
        const oldPrice = Number(existing.current_price) || 0
        if (oldPrice > 0 && salePrice > 0 && oldPrice !== salePrice) {
          // L'historique s'écrit par déclencheur sur market_listings (ml_historique_prix, 21.09.2026) :
          // l'écrire ici aussi doublerait chaque changement.
          updates.current_price = salePrice
```

- [ ] **Step 2 : Vérifier**

Run : `grep -rn "from('market_price_history').insert" supabase/functions src ; command -v deno && deno check --no-lock supabase/functions/market-scraper/index.ts`
Expected : grep vide ; `deno check` sans erreur s'il est installé.

- [ ] **Point de commit (au signal)** : Tasks 1, 3, 4, 6 — `feat(pige): historique des prix écrit par déclencheur, retrait daté, flux « Ce qui a bougé »`.

---

### Task 7 : Le modèle pur

**Files :**
- Create : `src/components/matching-recherche/pige.ts`
- Test : `tests/unit/pige.spec.ts`

- [ ] **Step 1 : Écrire les tests**

```ts
/**
 * Pige lisible — le modèle PUR (`src/components/matching-recherche/pige.ts`) : période, pagination, mise
 * en forme des mouvements, résumé et tracé de l'historique d'une annonce.
 *
 * ⚠ « aujourd'hui / hier » se comptent en jours CIVILS locaux : ces instants sont construits en heure
 * locale (`new Date(a, m, j, h)`), jamais par `Date.now() + Δ`, qui casse près de minuit.
 */
import { describe, expect, it } from 'vitest'
import {
  curseurSuivant, depuisFenetre, formaterPct, joursEntre, quandRelatif, resumerHistorique,
  tracerCourbe, versMouvement, versPointPrix, type LigneMouvement, type PointPrix,
} from '@/components/matching-recherche/pige'
import type { MrhBien } from '@/components/matching-recherche/types'

const JOUR = 86_400_000
const BIEN = { id: 'ml-1', title: 'Villa', transaction: 'vente' } as MrhBien

const ligne = (extra: Partial<LigneMouvement> = {}): LigneMouvement => ({
  event_id: 'ev-1', detected_at: '2026-09-21T08:00:00.000Z', kind: 'baisse', market_listing_id: 'ml-1',
  old_price: 14_500_000, new_price: 12_900_000, change_pct: -11.03, first_seen_at: '2026-04-27T08:00:00.000Z',
  ...extra,
})

const point = (genre: PointPrix['genre'], quand: string, prix: number | null, ancienPrix: number | null = null): PointPrix =>
  ({ id: `${genre}-${quand}`, genre, quand, ancienPrix, prix, variationPct: null, statut: null })

describe('période et jours', () => {
  it('depuisFenetre recule de N jours pleins', () => {
    const t = Date.parse('2026-09-21T10:00:00.000Z')
    expect(depuisFenetre(1, t)).toBe('2026-09-20T10:00:00.000Z')
    expect(depuisFenetre(7, t)).toBe('2026-09-14T10:00:00.000Z')
    expect(depuisFenetre(30, t)).toBe('2026-08-22T10:00:00.000Z')
  })

  it('joursEntre compte des jours pleins, jamais négatifs, et se tait sans début lisible', () => {
    expect(joursEntre('2026-04-27T08:00:00.000Z', '2026-09-21T08:00:00.000Z')).toBe(147)
    expect(joursEntre('2026-09-21T08:00:00.000Z', '2026-09-21T20:00:00.000Z')).toBe(0)
    expect(joursEntre('2026-09-22T08:00:00.000Z', '2026-09-21T08:00:00.000Z')).toBe(0)
    expect(joursEntre(null, Date.now())).toBeNull()
    expect(joursEntre('pas une date', Date.now())).toBeNull()
  })

  it('quandRelatif parle en jours civils locaux', () => {
    const maintenant = new Date(2026, 8, 21, 9, 0).getTime()
    expect(quandRelatif(new Date(2026, 8, 21, 0, 30).toISOString(), maintenant)).toEqual({ cle: 'aujourdhui', jours: 0 })
    expect(quandRelatif(new Date(2026, 8, 20, 23, 50).toISOString(), maintenant)).toEqual({ cle: 'hier', jours: 1 })
    expect(quandRelatif(new Date(2026, 8, 18, 12, 0).toISOString(), maintenant)).toEqual({ cle: 'jours', jours: 3 })
  })

  it('formaterPct signe, arrondit à une décimale et suit la langue', () => {
    expect(formaterPct(-11.034, 'fr')).toBe('−11,0 %')
    expect(formaterPct(5, 'en')).toBe('+5.0 %')
    expect(formaterPct(0, 'fr')).toBe('0,0 %')
  })
})

describe('mouvements du flux', () => {
  it('versMouvement lit les montants (PostgREST peut rendre du texte) et les jours sur le marché', () => {
    const m = versMouvement(ligne({ old_price: '14500000.00', new_price: '12900000.00' }), BIEN)
    expect(m).toMatchObject({ id: 'ev-1', genre: 'baisse', ancienPrix: 14_500_000, prix: 12_900_000, variationPct: -11.03, joursSurMarche: 147 })
    expect(m!.bien).toBe(BIEN)
  })

  it('versMouvement écarte ce qui n’est pas l’un des trois flux', () => {
    expect(versMouvement(ligne({ kind: 'suivi' }), BIEN)).toBeNull()
    expect(versMouvement(ligne({ kind: 'hausse' }), BIEN)).toBeNull()
  })

  it('curseurSuivant : la dernière ligne d’une page pleine, rien après une page incomplète', () => {
    const page = [ligne({ event_id: 'a', detected_at: 't2' }), ligne({ event_id: 'b', detected_at: 't1' })]
    expect(curseurSuivant(page, 2)).toEqual({ at: 't1', id: 'b' })
    expect(curseurSuivant(page, 3)).toBeNull()
    expect(curseurSuivant([], 2)).toBeNull()
  })
})

describe('historique d’une annonce', () => {
  it('versPointPrix range un genre inconnu parmi les statuts', () => {
    const p = versPointPrix({ id: 'h1', kind: 'inconnu', detected_at: 't', old_price: null, new_price: '900', change_pct: null, old_status: null, new_status: 'active' })
    expect(p).toMatchObject({ genre: 'statut', prix: 900, statut: 'active' })
  })

  it('série ouverte par une apparition : écart depuis la publication, changements de prix comptés', () => {
    const points = [
      point('apparition', '2026-05-01T00:00:00.000Z', 1_000_000),
      point('baisse', '2026-06-01T00:00:00.000Z', 900_000, 1_000_000),
      point('hausse', '2026-07-01T00:00:00.000Z', 950_000, 900_000),
      point('statut', '2026-07-02T00:00:00.000Z', 950_000, 950_000),
    ]
    const r = resumerHistorique(points, { enLigneDepuis: '2026-05-01T00:00:00.000Z', retireeLe: null, prixActuel: 950_000 }, Date.parse('2026-05-31T00:00:00.000Z'))
    expect(r).toEqual({
      debut: { nature: 'publication', quand: '2026-05-01T00:00:00.000Z' },
      premierPrix: 1_000_000, prixActuel: 950_000, changements: 2, ecartPct: -5, joursSurMarche: 30,
    })
  })

  it('série ouverte par le relevé initial : l’écart se dit depuis le début du suivi', () => {
    const r = resumerHistorique([point('suivi', '2026-09-21T00:00:00.000Z', 2_000_000)], { enLigneDepuis: null, retireeLe: null, prixActuel: 2_000_000 }, Date.parse('2026-09-22T00:00:00.000Z'))
    expect(r.debut?.nature).toBe('suivi')
    expect(r).toMatchObject({ changements: 0, ecartPct: 0, joursSurMarche: null })
  })

  it('une annonce retirée compte ses jours jusqu’à son retrait', () => {
    const r = resumerHistorique([], { enLigneDepuis: '2026-09-01T00:00:00.000Z', retireeLe: '2026-09-11T00:00:00.000Z', prixActuel: null }, Date.parse('2026-09-21T00:00:00.000Z'))
    expect(r).toEqual({ debut: null, premierPrix: null, prixActuel: null, changements: 0, ecartPct: null, joursSurMarche: 10 })
  })

  it('tracerCourbe dessine un escalier jusqu’à la fin de la période', () => {
    const t0 = Date.parse('2026-09-01T00:00:00.000Z')
    const points = [point('suivi', new Date(t0).toISOString(), 100), point('baisse', new Date(t0 + 10 * JOUR).toISOString(), 80, 100)]
    const c = tracerCourbe(points, 200, 100, t0 + 20 * JOUR)
    expect(c?.chemin).toBe('M0 10 H100 V90 H200')
    expect(c?.marques.map((m) => [m.x, m.y, m.genre])).toEqual([[0, 10, 'suivi'], [100, 90, 'baisse']])
  })

  it('tracerCourbe : un seul prix donne une ligne plate, aucun prix ne donne rien', () => {
    const t0 = Date.parse('2026-09-01T00:00:00.000Z')
    expect(tracerCourbe([point('suivi', new Date(t0).toISOString(), 100)], 200, 100, t0)?.chemin).toBe('M0 50 H200')
    expect(tracerCourbe([point('statut', new Date(t0).toISOString(), null)], 200, 100, t0)).toBeNull()
  })
})
```

- [ ] **Step 2 : Voir rouge**

Run : `npx vitest run tests/unit/pige.spec.ts`
Expected : FAIL — `Failed to resolve import "@/components/matching-recherche/pige"`.

- [ ] **Step 3 : Écrire `pige.ts`**

```ts
/**
 * Pige lisible — le modèle PUR de « Ce qui a bougé » et de l'historique du prix d'une annonce du marché.
 *
 * Aucun appel réseau ici : les lignes viennent de la RPC `pige_mouvements` et de la table
 * `market_price_history` (hooks de `src/hooks/usePige.ts`) ; ce module les met en forme, et se prouve
 * sans rendu (`tests/unit/pige.spec.ts`).
 *
 * ⚠ L'HISTORIQUE COMMENCE À LA MISE EN SERVICE DE LA PIGE (21.09.2026) : on ne reconstitue pas le passé.
 * Une annonce déjà en ligne ce jour-là ouvre sa série par un relevé `suivi` ; une annonce apparue ensuite,
 * par son `apparition`. D'où `ResumePrix.debut.nature` : l'écart ne se dit « depuis la première
 * publication » que dans le second cas.
 */
import type { MrhBien } from './types'

/** Les trois mouvements que la pige montre. */
export type GenreMouvement = 'apparition' | 'baisse' | 'retrait'
/** Ce que montre la Recherche : le marché, ou l'un des trois flux. */
export type VueRecherche = 'marche' | GenreMouvement
export const VUES_RECHERCHE: readonly VueRecherche[] = ['marche', 'apparition', 'baisse', 'retrait']
/** Période du flux, en jours. */
export type FenetrePige = 1 | 7 | 30
export const FENETRES_PIGE: readonly FenetrePige[] = [1, 7, 30]
/** Tout ce qu'une ligne d'historique peut dire — le CHECK `market_price_history_kind_check`. */
export type GenrePoint = 'suivi' | 'apparition' | 'baisse' | 'hausse' | 'prix' | 'retrait' | 'retour' | 'statut'

const JOUR = 86_400_000
const GENRES_FLUX = new Set<string>(['apparition', 'baisse', 'retrait'])
const GENRES_POINT = new Set<string>(['suivi', 'apparition', 'baisse', 'hausse', 'prix', 'retrait', 'retour', 'statut'])

/** Montant PostgREST (nombre ou texte) → nombre ; `null` s'il manque ou ne se lit pas. */
const nombre = (v: unknown): number | null =>
  v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)

/** Une ligne de `pige_mouvements`. */
export interface LigneMouvement {
  event_id: string
  detected_at: string
  kind: string
  market_listing_id: string
  old_price: number | string | null
  new_price: number | string | null
  change_pct: number | string | null
  first_seen_at: string | null
}

/** Un mouvement prêt à rendre : l'événement, et la carte de son annonce. */
export interface MouvementPige {
  id: string
  genre: GenreMouvement
  /** Quand le CRM l'a constaté (`detected_at`). */
  quand: string
  ancienPrix: number | null
  prix: number | null
  variationPct: number | null
  /** Jours sur le marché AU MOMENT du mouvement, depuis la première publication observée. */
  joursSurMarche: number | null
  bien: MrhBien
}

/** Clé de pagination : le dernier mouvement rendu, dans l'ordre `detected_at DESC, id DESC`. */
export interface CurseurPige { at: string; id: string }

/** Une ligne de `market_price_history`, lue pour la fiche. */
export interface LigneHistorique {
  id: string
  kind: string
  detected_at: string
  old_price: number | string | null
  new_price: number | string | null
  change_pct: number | string | null
  old_status: string | null
  new_status: string | null
}

/** Un point de la série de prix d'une annonce. */
export interface PointPrix {
  id: string
  genre: GenrePoint
  quand: string
  ancienPrix: number | null
  prix: number | null
  variationPct: number | null
  statut: string | null
}

/** Borne basse ISO de la période : `maintenant` moins N jours. */
export function depuisFenetre(jours: FenetrePige, maintenant: number): string {
  return new Date(maintenant - jours * JOUR).toISOString()
}

/** Jours PLEINS entre deux instants, jamais négatifs ; `null` si le début manque ou ne se lit pas. */
export function joursEntre(debut: string | null | undefined, fin: string | number): number | null {
  if (!debut) return null
  const a = Date.parse(debut)
  const b = typeof fin === 'number' ? fin : Date.parse(fin)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.floor((b - a) / JOUR))
}

/**
 * « aujourd'hui », « hier » ou « il y a N jours » — en jours CIVILS locaux, pas en tranches de 24 h :
 * une annonce apparue à 23 h 50 la veille est d'« hier », même vue à 0 h 10.
 */
export function quandRelatif(iso: string, maintenant: number): { cle: 'aujourdhui' | 'hier' | 'jours'; jours: number } {
  const jourCivil = (t: number) => {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  // Math.round et non floor : un jour de changement d'heure dure 23 ou 25 heures.
  const n = Math.round((jourCivil(maintenant) - jourCivil(Date.parse(iso))) / JOUR)
  if (n <= 0) return { cle: 'aujourdhui', jours: 0 }
  if (n === 1) return { cle: 'hier', jours: 1 }
  return { cle: 'jours', jours: n }
}

/** Variation signée à une décimale, au séparateur de la langue : « −4,2 % », « +5.0 % ». */
export function formaterPct(v: number, langue: string): string {
  const signe = v < 0 ? '−' : v > 0 ? '+' : ''
  const chiffre = Math.abs(v).toLocaleString(`${langue.slice(0, 2)}-CH`, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${signe}${chiffre} %`
}

/** Ligne RPC + carte déjà mappée → mouvement ; `null` si la ligne n'est pas l'un des trois flux. */
export function versMouvement(ligne: LigneMouvement, bien: MrhBien): MouvementPige | null {
  if (!GENRES_FLUX.has(ligne.kind)) return null
  return {
    id: ligne.event_id,
    genre: ligne.kind as GenreMouvement,
    quand: ligne.detected_at,
    ancienPrix: nombre(ligne.old_price),
    prix: nombre(ligne.new_price),
    variationPct: nombre(ligne.change_pct),
    joursSurMarche: joursEntre(ligne.first_seen_at, ligne.detected_at),
    bien,
  }
}

/** Curseur de la page suivante : la dernière ligne d'une page PLEINE ; `null` après une page incomplète. */
export function curseurSuivant(lignes: LigneMouvement[], taille: number): CurseurPige | null {
  const derniere = lignes[lignes.length - 1]
  if (!derniere || lignes.length < taille) return null
  return { at: derniere.detected_at, id: derniere.event_id }
}

/** Ligne de `market_price_history` → point ; un genre inconnu se range parmi les statuts. */
export function versPointPrix(l: LigneHistorique): PointPrix {
  return {
    id: l.id,
    genre: (GENRES_POINT.has(l.kind) ? l.kind : 'statut') as GenrePoint,
    quand: l.detected_at,
    ancienPrix: nombre(l.old_price),
    prix: nombre(l.new_price),
    variationPct: nombre(l.change_pct),
    statut: l.new_status,
  }
}

/** Ce que la fiche dit d'une série. */
export interface ResumePrix {
  /** Premier point : une publication observée (`apparition`), ou le début du suivi. */
  debut: { nature: 'publication' | 'suivi'; quand: string } | null
  premierPrix: number | null
  prixActuel: number | null
  /** Changements de prix — baisses, hausses, prix affiché ou retiré — depuis le début de la série. */
  changements: number
  /** Écart du prix actuel au premier prix de la série, en %, à une décimale. */
  ecartPct: number | null
  /** Depuis la première publication observée, jusqu'au retrait s'il y en a un. */
  joursSurMarche: number | null
}

/** Résumé d'une série triée du plus ancien au plus récent. */
export function resumerHistorique(
  points: PointPrix[],
  annonce: { enLigneDepuis: string | null; retireeLe: string | null; prixActuel: number | null },
  maintenant: number,
): ResumePrix {
  const avecPrix = points.filter((p) => p.prix != null && p.prix > 0)
  const premier = points[0]
  const premierPrix = avecPrix[0]?.prix ?? null
  const prixActuel = annonce.prixActuel ?? avecPrix[avecPrix.length - 1]?.prix ?? null
  return {
    debut: premier ? { nature: premier.genre === 'apparition' ? 'publication' : 'suivi', quand: premier.quand } : null,
    premierPrix,
    prixActuel,
    changements: points.filter((p) => p.ancienPrix != null && p.prix != null && p.ancienPrix !== p.prix).length,
    ecartPct: premierPrix && prixActuel ? Math.round(((prixActuel - premierPrix) / premierPrix) * 1000) / 10 : null,
    joursSurMarche: joursEntre(annonce.enLigneDepuis, annonce.retireeLe ?? maintenant),
  }
}

/** L'escalier des prix dans un cadre largeur × hauteur (origine en haut à gauche). */
export interface Courbe {
  chemin: string
  marques: { x: number; y: number; genre: GenrePoint }[]
}

/**
 * Tracé en ESCALIER : un prix tient jusqu'au changement suivant, puis jusqu'à `fin` (maintenant, ou le
 * retrait). `null` si aucun point ne porte de prix. 10 % de marge en haut et en bas ; un prix unique se
 * trace à mi-hauteur.
 */
export function tracerCourbe(points: PointPrix[], largeur: number, hauteur: number, fin: number): Courbe | null {
  const avecPrix = points.filter((p): p is PointPrix & { prix: number } => p.prix != null && p.prix > 0)
  if (!avecPrix.length) return null
  const temps = avecPrix.map((p) => Date.parse(p.quand))
  const t0 = temps[0]!
  const t1 = Math.max(fin, temps[temps.length - 1]!)
  const prix = avecPrix.map((p) => p.prix)
  const min = Math.min(...prix)
  const max = Math.max(...prix)
  const marge = hauteur * 0.1
  const arrondi = (v: number) => Math.round(v * 10) / 10
  const x = (t: number) => arrondi(t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * largeur)
  const y = (v: number) => arrondi(max === min ? hauteur / 2 : marge + (1 - (v - min) / (max - min)) * (hauteur - 2 * marge))
  const marques = avecPrix.map((p, i) => ({ x: x(temps[i]!), y: y(p.prix), genre: p.genre }))
  let chemin = `M${marques[0]!.x} ${marques[0]!.y}`
  for (const m of marques.slice(1)) chemin += ` H${m.x} V${m.y}`
  return { chemin: `${chemin} H${arrondi(largeur)}`, marques }
}
```

- [ ] **Step 4 : Voir vert**

Run : `npx vitest run tests/unit/pige.spec.ts`
Expected : PASS, 13 tests.

- [ ] **Point de commit (au signal)** : avec les Tasks 8 et 9.

---

### Task 8 : L'âge d'une annonce se lit dans `first_seen_at`

**Files :**
- Modify : `src/components/matching-recherche/types.ts`
- Modify : `src/hooks/useMatchingRecherche.ts` (colonnes seulement ici ; `chargerCartes` à la Task 9)
- Modify : `src/hooks/useMarketListing.ts`
- Test : `tests/unit/mrh-listing-detail.test.ts`, `tests/unit/market-listing.spec.ts`

- [ ] **Step 1 : Les tests du mapper**

Dans `tests/unit/mrh-listing-detail.test.ts`, remplacer `import { describe, it, expect } from 'vitest'` par `import { afterEach, describe, it, expect, vi } from 'vitest'`, puis ajouter en fin de fichier :

```ts

describe('mapListingRow — l’âge de l’annonce vient de first_seen_at', () => {
  // ⚠ RealAdvisor n'écrit jamais `days_on_market` : 0 sur les 48 078 ventes vivantes au 21.09.2026,
  // si bien que toute vente s'affichait « aujourd'hui ». `first_seen_at` est gelé à la publication.
  afterEach(() => { vi.useRealTimers() })

  it('une vente RealAdvisor à days_on_market = 0 a bien 147 jours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'))
    const b = mapListingRow({ id: 'x', transaction_type: 'buy', days_on_market: 0, first_seen_at: '2026-04-27T12:00:00.000Z', removed_at: null })
    expect(b.days_on_market).toBe(147)
    expect(b.enLigneDepuis).toBe('2026-04-27T12:00:00.000Z')
    expect(b.retireeLe).toBeNull()
  })

  it('une annonce retirée arrête de vieillir à son retrait', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'))
    const b = mapListingRow({ id: 'x', transaction_type: 'rent', first_seen_at: '2026-09-01T12:00:00.000Z', removed_at: '2026-09-11T12:00:00.000Z' })
    expect(b.days_on_market).toBe(10)
    expect(b.retireeLe).toBe('2026-09-11T12:00:00.000Z')
  })

  it('sans first_seen_at, la colonne reste le repli', () => {
    expect(mapListingRow({ id: 'x', transaction_type: 'rent', days_on_market: 12 }).days_on_market).toBe(12)
  })
})
```

Dans `tests/unit/market-listing.spec.ts`, dans l'objet rendu par `annonce()`, remplacer `    days_on_market: 12, postedAt: 'il y a 12 j', postedRank: 12,` par :

```ts
    days_on_market: 12, postedAt: 'il y a 12 j', postedRank: 12,
    enLigneDepuis: null, retireeLe: null,
```

- [ ] **Step 2 : Voir rouge**

Run : `npx vitest run tests/unit/mrh-listing-detail.test.ts`
Expected : FAIL — `expected 0 to be 147` (et `enLigneDepuis` absent).

- [ ] **Step 3 : `types.ts`**

1. Juste après le commentaire d'en-tête du fichier (avant `export type MrhTransaction`), ajouter :

```ts
import { joursEntre } from './pige'
```

2. Dans `MrhBien`, après `  days_on_market: number | null`, ajouter :

```ts
  /** Première publication observée (`first_seen_at`, gelée par la collecte) : c'est elle qui date l'annonce. */
  enLigneDepuis: string | null
  /** Retrait constaté par le CRM (`removed_at`) ; `null` si l'annonce vit, ou fut retirée avant la pige. */
  retireeLe: string | null
```

3. Dans `mapListingRow`, remplacer `  const dom = num(row.days_on_market)` par :

```ts
  const enLigneDepuis = typeof row.first_seen_at === 'string' ? row.first_seen_at : null
  const retireeLe = typeof row.removed_at === 'string' ? row.removed_at : null
  // ⛔ `days_on_market` NE SE LIT PLUS EN PREMIER : RealAdvisor ne l'écrit jamais (0 sur les 48 078 ventes
  // vivantes le 21.09.2026), et toute vente s'affichait « aujourd'hui ». `first_seen_at`, gelé à la
  // publication par la collecte, dit l'âge ; la colonne ne reste que le repli d'une ligne qui ne le porte pas.
  const dom = joursEntre(enLigneDepuis, retireeLe ?? Date.now()) ?? num(row.days_on_market)
```

4. Dans l'objet rendu, remplacer `    days_on_market: dom,` par :

```ts
    days_on_market: dom,
    enLigneDepuis,
    retireeLe,
```

- [ ] **Step 4 : Les colonnes lues**

Dans `src/hooks/useMatchingRecherche.ts` (`CARD_COLS`) ET dans `src/hooks/useMarketListing.ts` (`COLS`), remplacer la ligne :

```ts
  'year_built,days_on_market,land_surface,' +
```

par :

```ts
  'year_built,days_on_market,land_surface,first_seen_at,removed_at,' +
```

- [ ] **Step 5 : Les annonces du banc**

Dans `src/components/matching-recherche/mrhDemo.ts` :

1. Après la constante `PHOTO` (les deux lignes `const PHOTO = (id: string, n = 1200) =>` et son gabarit), ajouter :

```ts

/** « il y a N jours (et H heures) », relatif à l'ouverture du banc : les libellés restent vrais d'un jour sur l'autre. */
const ILYA = (jours: number, heures = 0) => new Date(Date.now() - (jours * 24 + heures) * 3_600_000).toISOString()
```

2. Dans `bien()`, remplacer :

```ts
    photos: [],
    ...p,
```

par :

```ts
    photos: [],
    enLigneDepuis: ILYA(dom),
    retireeLe: null,
    ...p,
```

- [ ] **Step 6 : Voir vert**

Run : `npx vitest run tests/unit/mrh-listing-detail.test.ts tests/unit/market-listing.spec.ts && npx tsc -b 2>&1 | tail -3`
Expected : PASS ; tsc sans erreur.

- [ ] **Point de commit (au signal)** : avec les Tasks 7 et 9.

---

### Task 9 : Les hooks

**Files :**
- Modify : `src/hooks/useMatchingRecherche.ts`
- Create : `src/hooks/usePige.ts`

- [ ] **Step 1 : Extraire `chargerCartes`**

Dans `src/hooks/useMatchingRecherche.ts`, après la fonction `candidateCount` (qui finit par `  return Number(data ?? 0)` puis `}`), ajouter :

```ts

/**
 * Colonnes de carte d'une liste d'annonces, mappées par `mapListingRow` — l'ordre rendu n'est PAS celui
 * des ids. Lecture par clé primaire, découpée en lots de `ID_CHUNK` (au-delà, le proxy rend un 414).
 * Partagée avec le flux de la pige (`usePige.ts`) : même sélection de colonnes, même mapper.
 */
export async function chargerCartes(ids: string[]): Promise<MrhBien[]> {
  if (!ids.length) return []
  const lots: string[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) lots.push(ids.slice(i, i + ID_CHUNK))
  const reponses = await Promise.all(lots.map((lot) => supabase.from('market_listings').select(CARD_COLS).in('id', lot)))
  const echec = reponses.find((r) => r.error)
  if (echec?.error) throw echec.error
  return reponses.flatMap((r) => r.data ?? []).map((row) => mapListingRow(row as unknown as Record<string, unknown>))
}
```

Puis, dans `useMatchingSearch`, remplacer :

```ts
      if (!ids.length) return []
      // Découpage du `.in()` : voir ID_CHUNK — au-delà, le proxy renvoie un 414.
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
      const responses = await Promise.all(
        chunks.map((chunk) => supabase.from('market_listings').select(CARD_COLS).in('id', chunk)),
      )
      const failed = responses.find((r) => r.error)
      if (failed?.error) throw failed.error
      const data = responses.flatMap((r) => r.data ?? [])
      const order = new Map(ids.map((id, i) => [id, i]))
      return (data ?? [])
        .map((row) => mapListingRow(row as unknown as Record<string, unknown>))
        .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
```

par :

```ts
      const order = new Map(ids.map((id, i) => [id, i]))
      return (await chargerCartes(ids)).sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
```

- [ ] **Step 2 : Écrire `src/hooks/usePige.ts`**

```ts
/**
 * Pige lisible — accès données : le flux « Ce qui a bougé » (RPC `pige_mouvements`) et l'historique du
 * prix d'une annonce (`market_price_history`). La mise en forme vit dans `pige.ts`, pure et testée.
 *
 * ⚠ AUCUN COMPTAGE (CLAUDE.md §7) : le flux se pagine par clé (`detected_at`, `id`), 30 par page, et
 * l'écran dit « d'autres suivent » au lieu d'un total.
 * ⚠ La RPC ne rend que l'événement et l'id de l'annonce ; les colonnes de carte passent par
 * `chargerCartes`, le chemin de la grille.
 * ⚠ La borne de la période se calcule à la PREMIÈRE page et voyage avec les suivantes : recalculée à
 * chaque page, elle glisserait pendant qu'on pagine.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { chargerCartes, type SearchTx } from '@/hooks/useMatchingRecherche'
import {
  curseurSuivant, depuisFenetre, versMouvement, versPointPrix,
  type CurseurPige, type FenetrePige, type GenreMouvement, type LigneHistorique,
  type LigneMouvement, type MouvementPige, type PointPrix,
} from '@/components/matching-recherche/pige'

/** Mouvements par page : de quoi remplir l'écran, assez peu pour que la page reste instantanée. */
const PAGE = 30
/** Événements lus pour UNE annonce, les plus récents d'abord (index `(market_listing_id, detected_at)`). */
const HISTORIQUE_MAX = 200

/** Les filtres du flux — ceux de la grille, plus le genre et la période. */
export interface PigeParams {
  genre: GenreMouvement
  fenetre: FenetrePige
  transaction: SearchTx
  cantons: string[]
  types: string[]
  city: string | null
  budgetMin: number | null
  budgetMax: number | null
}

interface ParamPage { depuis: string; curseur: CurseurPige }
interface PagePige { mouvements: MouvementPige[]; depuis: string; suivant: CurseurPige | null }

async function chargerPage(p: PigeParams, param: ParamPage | null): Promise<PagePige> {
  const depuis = param?.depuis ?? depuisFenetre(p.fenetre, Date.now())
  const { data, error } = await supabase.rpc('pige_mouvements', {
    p_kind: p.genre,
    p_since: depuis,
    p_tx: p.transaction ?? undefined,
    p_cantons: p.cantons.length ? p.cantons : undefined,
    p_types: p.types.length ? p.types : undefined,
    p_city: p.city?.trim() ? p.city.trim() : undefined,
    p_budget_min: p.budgetMin ?? undefined,
    p_budget_max: p.budgetMax ?? undefined,
    // Même marge et même plancher de qualité que la grille : le flux décrit la population qu'elle montre.
    p_margin: 0.15,
    p_min_quality: 50,
    p_before_at: param?.curseur.at,
    p_before_id: param?.curseur.id,
    p_limit: PAGE,
  })
  if (error) throw error
  const lignes: LigneMouvement[] = data ?? []
  const cartes = await chargerCartes([...new Set(lignes.map((l) => l.market_listing_id))])
  const parId = new Map(cartes.map((b) => [b.id, b]))
  const mouvements = lignes.flatMap((l) => {
    const bien = parId.get(l.market_listing_id)
    const m = bien ? versMouvement(l, bien) : null
    return m ? [m] : []
  })
  return { mouvements, depuis, suivant: curseurSuivant(lignes, PAGE) }
}

/**
 * Le flux « Ce qui a bougé », page par page. `actif` faux (vue « Tout le marché », ou banc) : aucune
 * requête ne part, et `blocked` ne se lève pas — rien n'a été demandé.
 */
export function usePigeMouvements(p: PigeParams, actif: boolean) {
  const { user } = useAuth()
  const query = useInfiniteQuery({
    queryKey: ['pige-mouvements', p],
    enabled: actif && !!user,
    staleTime: 60_000,
    initialPageParam: null as ParamPage | null,
    queryFn: ({ pageParam }) => chargerPage(p, pageParam),
    getNextPageParam: (derniere: PagePige): ParamPage | null =>
      derniere.suivant ? { depuis: derniere.depuis, curseur: derniere.suivant } : null,
  })
  return { ...query, blocked: actif && !user }
}

/** Historique du prix d'UNE annonce, du plus ancien au plus récent. `annonceId` nul (banc) : aucune requête. */
export function useHistoriquePrix(annonceId: string | null) {
  const { user } = useAuth()
  return useQuery<{ points: PointPrix[]; tronque: boolean }>({
    queryKey: ['pige-historique', annonceId],
    enabled: !!user && !!annonceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_price_history')
        .select('id, kind, detected_at, old_price, new_price, change_pct, old_status, new_status')
        .eq('market_listing_id', annonceId as string)
        .order('detected_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(HISTORIQUE_MAX)
      if (error) throw error
      const lignes: LigneHistorique[] = data ?? []
      return { points: lignes.map(versPointPrix).reverse(), tronque: lignes.length === HISTORIQUE_MAX }
    },
  })
}
```

- [ ] **Step 3 : Vérifier**

Run : `npx tsc -b 2>&1 | tail -3 && npx vitest run tests/unit/pige.spec.ts tests/unit/mrh-listing-detail.test.ts`
Expected : tsc sans erreur ; PASS. (`lint:deadcode` rougirait tant que les hooks n'ont pas de lecteur : c'est la Task 11.)

- [ ] **Point de commit (au signal)** : Tasks 7, 8, 9 — `feat(pige): modèle, hooks, et l'âge des annonces lu dans first_seen_at`.

---

### Task 10 : Les libellés (4 langues)

**Files :**
- Modify : `src/i18n/locales/{fr,de,en,it}/matching.json` (partagé avec 1a, qui ajoute `fil.*` : le script relit chaque fichier juste avant d'écrire et n'ajoute que quatre blocs sous `recherche`)

- [ ] **Step 1 : Lancer le script**

```bash
python3 - <<'EOF'
import json

FR = {
  'vue': {
    'group': 'Ce que montre la recherche', 'marche': 'Tout le marché', 'apparition': 'Nouveaux',
    'baisse': 'En baisse', 'retrait': 'Retirés', 'aria': 'Afficher : {{label}}',
  },
  'fenetre': {'group': 'Période', 'j1': '24 h', 'j7': '7 jours', 'j30': '30 jours', 'aria': 'Période : {{label}}'},
  'bouge': {
    'compte_one': '{{count}} mouvement affiché', 'compte_other': '{{count}} mouvements affichés',
    'suite': "d'autres suivent", 'voirPlus': 'Voir plus', 'chargement': 'Chargement des mouvements…',
    'erreur': "Les mouvements du marché n'ont pas pu être chargés.",
    'vide': {
      'apparition': 'Aucune nouvelle annonce sur cette période.',
      'baisse': 'Aucune baisse de prix sur cette période.',
      'retrait': 'Aucune annonce retirée sur cette période.',
    },
    'videCorps': "Les mouvements sont suivis depuis la mise en service de la pige ; ce qui a bougé avant n'est pas reconstitué. Élargissez la période ou les filtres.",
    'quandAujourdhui': "aujourd'hui", 'quandHier': 'hier',
    'quandJours_one': 'il y a {{count}} jour', 'quandJours_other': 'il y a {{count}} jours',
    'deA': '{{avant}} → {{apres}}', 'dernierPrix': 'dernier prix {{prix}}',
    'enLigneDepuis_one': 'en ligne depuis {{count}} jour', 'enLigneDepuis_other': 'en ligne depuis {{count}} jours',
    'apresJours_one': 'après {{count}} jour sur le marché', 'apresJours_other': 'après {{count}} jours sur le marché',
  },
  'historique': {
    'titre': 'Historique du prix', 'courbe': "Évolution du prix de l'annonce",
    'erreur': 'Historique indisponible pour le moment.',
    'vide': 'Aucun prix relevé pour cette annonce depuis le début du suivi.',
    'surMarche': 'Sur le marché', 'jours_one': '{{count}} jour', 'jours_other': '{{count}} jours',
    'moinsUnJour': "moins d'un jour", 'retireeLe': 'retirée le {{date}}',
    'changements': 'Changements de prix', 'suiviDepuis': 'suivi depuis le {{date}}',
    'ecart': 'Écart', 'depuisPublication': 'depuis la première publication', 'depuisDate': 'depuis le {{date}}',
    'tronque': 'Les {{n}} derniers événements sont affichés.',
    'genre': {
      'suivi': 'Premier relevé', 'apparition': 'Publication', 'baisse': 'Baisse', 'hausse': 'Hausse',
      'prix': 'Prix modifié', 'retrait': 'Retirée', 'retour': 'De retour sur le marché', 'statut': 'Statut modifié',
    },
  },
}
DE = {
  'vue': {
    'group': 'Was die Suche zeigt', 'marche': 'Ganzer Markt', 'apparition': 'Neu',
    'baisse': 'Preis gesenkt', 'retrait': 'Zurückgezogen', 'aria': 'Anzeigen: {{label}}',
  },
  'fenetre': {'group': 'Zeitraum', 'j1': '24 Std.', 'j7': '7 Tage', 'j30': '30 Tage', 'aria': 'Zeitraum: {{label}}'},
  'bouge': {
    'compte_one': '{{count}} Bewegung angezeigt', 'compte_other': '{{count}} Bewegungen angezeigt',
    'suite': 'weitere folgen', 'voirPlus': 'Mehr anzeigen', 'chargement': 'Bewegungen werden geladen…',
    'erreur': 'Die Marktbewegungen konnten nicht geladen werden.',
    'vide': {
      'apparition': 'Keine neuen Inserate in diesem Zeitraum.',
      'baisse': 'Keine Preissenkung in diesem Zeitraum.',
      'retrait': 'Keine zurückgezogenen Inserate in diesem Zeitraum.',
    },
    'videCorps': 'Bewegungen werden seit der Inbetriebnahme der Marktbeobachtung erfasst; frühere Änderungen werden nicht rekonstruiert. Erweitern Sie den Zeitraum oder die Filter.',
    'quandAujourdhui': 'heute', 'quandHier': 'gestern',
    'quandJours_one': 'vor {{count}} Tag', 'quandJours_other': 'vor {{count}} Tagen',
    'deA': '{{avant}} → {{apres}}', 'dernierPrix': 'letzter Preis {{prix}}',
    'enLigneDepuis_one': 'seit {{count}} Tag online', 'enLigneDepuis_other': 'seit {{count}} Tagen online',
    'apresJours_one': 'nach {{count}} Tag auf dem Markt', 'apresJours_other': 'nach {{count}} Tagen auf dem Markt',
  },
  'historique': {
    'titre': 'Preisverlauf', 'courbe': 'Preisentwicklung des Inserats',
    'erreur': 'Verlauf derzeit nicht verfügbar.',
    'vide': 'Seit Beginn der Beobachtung wurde für dieses Inserat kein Preis erfasst.',
    'surMarche': 'Auf dem Markt', 'jours_one': '{{count}} Tag', 'jours_other': '{{count}} Tage',
    'moinsUnJour': 'weniger als ein Tag', 'retireeLe': 'zurückgezogen am {{date}}',
    'changements': 'Preisänderungen', 'suiviDepuis': 'beobachtet seit dem {{date}}',
    'ecart': 'Abweichung', 'depuisPublication': 'seit der ersten Veröffentlichung', 'depuisDate': 'seit dem {{date}}',
    'tronque': 'Die letzten {{n}} Ereignisse werden angezeigt.',
    'genre': {
      'suivi': 'Erste Erfassung', 'apparition': 'Veröffentlichung', 'baisse': 'Senkung', 'hausse': 'Erhöhung',
      'prix': 'Preis geändert', 'retrait': 'Zurückgezogen', 'retour': 'Wieder auf dem Markt', 'statut': 'Status geändert',
    },
  },
}
EN = {
  'vue': {
    'group': 'What the search shows', 'marche': 'Whole market', 'apparition': 'New',
    'baisse': 'Price cuts', 'retrait': 'Withdrawn', 'aria': 'Show: {{label}}',
  },
  'fenetre': {'group': 'Period', 'j1': '24 h', 'j7': '7 days', 'j30': '30 days', 'aria': 'Period: {{label}}'},
  'bouge': {
    'compte_one': '{{count}} change shown', 'compte_other': '{{count}} changes shown',
    'suite': 'more to come', 'voirPlus': 'Show more', 'chargement': 'Loading changes…',
    'erreur': 'Market changes could not be loaded.',
    'vide': {
      'apparition': 'No new listings in this period.',
      'baisse': 'No price cuts in this period.',
      'retrait': 'No withdrawn listings in this period.',
    },
    'videCorps': 'Changes are tracked since market monitoring went live; earlier changes are not reconstructed. Widen the period or the filters.',
    'quandAujourdhui': 'today', 'quandHier': 'yesterday',
    'quandJours_one': '{{count}} day ago', 'quandJours_other': '{{count}} days ago',
    'deA': '{{avant}} → {{apres}}', 'dernierPrix': 'last price {{prix}}',
    'enLigneDepuis_one': 'online for {{count}} day', 'enLigneDepuis_other': 'online for {{count}} days',
    'apresJours_one': 'after {{count}} day on the market', 'apresJours_other': 'after {{count}} days on the market',
  },
  'historique': {
    'titre': 'Price history', 'courbe': 'Price trend of the listing',
    'erreur': 'History unavailable for now.',
    'vide': 'No price recorded for this listing since tracking began.',
    'surMarche': 'On the market', 'jours_one': '{{count}} day', 'jours_other': '{{count}} days',
    'moinsUnJour': 'less than a day', 'retireeLe': 'withdrawn on {{date}}',
    'changements': 'Price changes', 'suiviDepuis': 'tracked since {{date}}',
    'ecart': 'Change', 'depuisPublication': 'since first publication', 'depuisDate': 'since {{date}}',
    'tronque': 'The last {{n}} events are shown.',
    'genre': {
      'suivi': 'First record', 'apparition': 'Published', 'baisse': 'Price cut', 'hausse': 'Price rise',
      'prix': 'Price changed', 'retrait': 'Withdrawn', 'retour': 'Back on the market', 'statut': 'Status changed',
    },
  },
}
IT = {
  'vue': {
    'group': 'Cosa mostra la ricerca', 'marche': 'Tutto il mercato', 'apparition': 'Nuovi',
    'baisse': 'In ribasso', 'retrait': 'Ritirati', 'aria': 'Vista: {{label}}',
  },
  'fenetre': {'group': 'Periodo', 'j1': '24 h', 'j7': '7 giorni', 'j30': '30 giorni', 'aria': 'Periodo: {{label}}'},
  'bouge': {
    'compte_one': '{{count}} movimento visualizzato', 'compte_other': '{{count}} movimenti visualizzati',
    'suite': 'altri seguono', 'voirPlus': 'Altri risultati', 'chargement': 'Caricamento dei movimenti…',
    'erreur': 'Non è stato possibile caricare i movimenti del mercato.',
    'vide': {
      'apparition': 'Nessun nuovo annuncio in questo periodo.',
      'baisse': 'Nessun ribasso di prezzo in questo periodo.',
      'retrait': 'Nessun annuncio ritirato in questo periodo.',
    },
    'videCorps': "I movimenti sono seguiti dall'attivazione del monitoraggio del mercato; quelli precedenti non vengono ricostruiti. Allarghi il periodo o i filtri.",
    'quandAujourdhui': 'oggi', 'quandHier': 'ieri',
    'quandJours_one': '{{count}} giorno fa', 'quandJours_other': '{{count}} giorni fa',
    'deA': '{{avant}} → {{apres}}', 'dernierPrix': 'ultimo prezzo {{prix}}',
    'enLigneDepuis_one': 'online da {{count}} giorno', 'enLigneDepuis_other': 'online da {{count}} giorni',
    'apresJours_one': 'dopo {{count}} giorno sul mercato', 'apresJours_other': 'dopo {{count}} giorni sul mercato',
  },
  'historique': {
    'titre': 'Storico del prezzo', 'courbe': "Andamento del prezzo dell'annuncio",
    'erreur': 'Storico non disponibile al momento.',
    'vide': "Nessun prezzo rilevato per questo annuncio dall'inizio del monitoraggio.",
    'surMarche': 'Sul mercato', 'jours_one': '{{count}} giorno', 'jours_other': '{{count}} giorni',
    'moinsUnJour': 'meno di un giorno', 'retireeLe': 'ritirato il {{date}}',
    'changements': 'Variazioni di prezzo', 'suiviDepuis': 'monitorato dal {{date}}',
    'ecart': 'Scostamento', 'depuisPublication': 'dalla prima pubblicazione', 'depuisDate': 'dal {{date}}',
    'tronque': 'Sono visualizzati gli ultimi {{n}} eventi.',
    'genre': {
      'suivi': 'Primo rilevamento', 'apparition': 'Pubblicazione', 'baisse': 'Ribasso', 'hausse': 'Rialzo',
      'prix': 'Prezzo modificato', 'retrait': 'Ritirato', 'retour': 'Di nuovo sul mercato', 'statut': 'Stato modificato',
    },
  },
}

INTERDITS = ('—', '–', 'ß')  # tiret cadratin, demi-cadratin, eszett
for langue, blocs in {'fr': FR, 'de': DE, 'en': EN, 'it': IT}.items():
    chemin = f'src/i18n/locales/{langue}/matching.json'
    brut = open(chemin, encoding='utf-8').read()  # relu JUSTE avant d'écrire : le lot B y ajoute ses clés fil.*
    donnees = json.loads(brut)
    assert json.dumps(donnees, ensure_ascii=False, indent=2) + '\n' == brut, f'{chemin} : mise en forme inattendue'
    recherche = donnees['recherche']
    for cle, bloc in blocs.items():
        assert cle not in recherche, f'{chemin} : recherche.{cle} existe déjà'
        texte = json.dumps(bloc, ensure_ascii=False)
        assert not any(c in texte for c in INTERDITS), f'{chemin} : caractère interdit dans recherche.{cle}'
        recherche[cle] = bloc
    open(chemin, 'w', encoding='utf-8').write(json.dumps(donnees, ensure_ascii=False, indent=2) + '\n')
    print(chemin, 'ok')
EOF
```

Expected : quatre lignes `… ok`.

- [ ] **Step 2 : Parité et typographie**

Run : `npm run i18n:parity:ci && npm run lint:prose && npm run i18n:coverage:ci`
Expected : les trois verts (aucune clé manquante, aucun caractère interdit, dette DE/IT inchangée).

- [ ] **Point de commit (au signal)** : avec les Tasks 11 à 14.

---

### Task 11 : La vue « Ce qui a bougé »

**Files :**
- Create : `src/components/matching-recherche/MrhBouge.tsx`
- Modify : `src/components/matching-recherche/MatchingRechercheHybride.tsx`, `RechIcon.tsx`, `mrh.css`, `mrhDemo.ts`

- [ ] **Step 1 : L'icône de baisse**

Dans `RechIcon.tsx`, table `MAP`, après `  mapPin: 'location',` ajouter :

```ts
  trendDown: 'trend-down',
```

- [ ] **Step 2 : Le survol d'une ligne**

À la fin de `mrh.css`, ajouter :

```css

/* « Ce qui a bougé » : la ligne survolée prend le filet de l'écran pour fond, rien de plus. */
.mrh-flux-ligne { transition: background .15s; }
.mrh-flux-ligne:hover { background: var(--mrh-line); }
```

- [ ] **Step 3 : Écrire `MrhBouge.tsx`**

```tsx
/**
 * Matching · Recherche — « Ce qui a bougé » : les annonces apparues, en baisse ou retirées sur la période
 * choisie, de la plus récente à la plus ancienne.
 *
 * Présentationnel : `MatchingRechercheHybride` porte la requête (`usePigeMouvements`), les filtres, la
 * période et la pagination ; ce composant rend une ligne par mouvement et les quatre états.
 *
 * ⚠ AUCUN TOTAL : le flux se pagine par clé et ne se compte pas (CLAUDE.md §7).
 * ⚠ Les mouvements datent de la mise en service de la pige : un flux vide dans les premiers jours ne dit
 * pas que le marché dort, il dit que le suivi commence — l'état vide le dit.
 * ⚠ Aucun littéral de rayon ni d'espacement : le cliquet de `megga-x-grammar.spec.ts` compte ceux du
 * dossier, et ce fichier n'en ajoute pas.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EtatVide from '@/components/crm/EtatVide'
import { formatCHF } from '@/lib/utils'
import MrhPhoto from './MrhPhoto'
import RechIcon from './RechIcon'
import { mrhPriceDropInk, type MrhCtx } from './mrhCtx'
import { formaterPct, quandRelatif, type GenreMouvement, type MouvementPige } from './pige'
import type { MrhBien } from './types'

/** Ce que l'écran peut dire du flux — `bloque` : la requête n'a pas pu partir (pas de session). */
export type EtatFlux = 'chargement' | 'lent' | 'erreur' | 'bloque' | 'pret'

interface Props {
  genre: GenreMouvement
  mouvements: MouvementPige[]
  etat: EtatFlux
  /** Une page de plus existe : la dernière chargée était pleine. */
  suiteDisponible: boolean
  chargeSuite: boolean
  onSuite: () => void
  onReessayer: () => void
  onOuvrir: (b: MrhBien) => void
  ctx: MrhCtx
}

export default function MrhBouge({ genre, mouvements, etat, suiteDisponible, chargeSuite, onSuite, onReessayer, onOuvrir, ctx }: Props) {
  const { t } = useTranslation('matching')
  const { sp, surf, dark, ACC, ONACC } = ctx
  // Horloge figée au montage : « hier » ne bascule pas pendant qu'on lit (idiome de `BpTopGallery`).
  const [maintenant] = useState(() => Date.now())

  const bouton = (libelle: string, onClick: () => void, occupe = false) => (
    <button onClick={onClick} disabled={occupe}
      style={{ height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: occupe ? 'default' : 'pointer', background: ACC, color: ONACC, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, opacity: occupe ? 0.6 : 1 }}>
      {libelle}
    </button>
  )

  if (etat === 'chargement' || etat === 'lent') {
    return (
      <div role="status" style={{ display: 'grid', placeItems: 'center', alignContent: 'center', minHeight: 240, gap: 'var(--crm-space-2xl)', color: sp.sub, fontSize: 'var(--crm-text-lg)', fontWeight: 600, textAlign: 'center' }}>
        <span>{etat === 'lent' ? t('recherche.slow') : t('recherche.bouge.chargement')}</span>
        {etat === 'lent' && bouton(t('recherche.retry'), onReessayer)}
      </div>
    )
  }
  if (etat === 'erreur' || etat === 'bloque') {
    return (
      <EtatVide dark={dark} registre="erreur"
        titre={etat === 'erreur' ? t('recherche.bouge.erreur') : t('recherche.blocked')}
        action={{ libelle: t('recherche.retry'), onClick: onReessayer }} />
    )
  }
  if (!mouvements.length) {
    return <EtatVide dark={dark} titre={t(`recherche.bouge.vide.${genre}`)} corps={t('recherche.bouge.videCorps')} />
  }

  return (
    <div>
      <ol aria-label={t(`recherche.vue.${genre}`)} style={{ listStyle: 'none', margin: 0, padding: 0, background: surf.card, border: surf.hairline, borderRadius: 'var(--crm-radius-4xl)', boxShadow: surf.shadow, overflow: 'hidden' }}>
        {mouvements.map((m, i) => (
          <LigneFlux key={m.id} m={m} bordure={i > 0} maintenant={maintenant} onOuvrir={onOuvrir} ctx={ctx} />
        ))}
      </ol>
      {suiteDisponible && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--crm-space-6xl)' }}>
          {bouton(chargeSuite ? t('recherche.bouge.chargement') : t('recherche.bouge.voirPlus'), onSuite, chargeSuite)}
        </div>
      )}
    </div>
  )
}

/** Une ligne : vignette, identité, ce qui a bougé, et quand. Toute la ligne ouvre la fiche. */
function LigneFlux({ m, bordure, maintenant, onOuvrir, ctx }: { m: MouvementPige; bordure: boolean; maintenant: number; onOuvrir: (b: MrhBien) => void; ctx: MrhCtx }) {
  const { t, i18n } = useTranslation('matching')
  const { sp, surf, dark, line } = ctx
  const b = m.bien
  const loyer = b.transaction === 'location'
  const encreBaisse = mrhPriceDropInk(dark)
  const chf = (v: number | null) => (v ? `${formatCHF(v)}${loyer ? ' ' + t('recherche.card.perMonth') : ''}` : t('recherche.card.estimate'))
  const q = quandRelatif(m.quand, maintenant)
  const quand = q.cle === 'aujourdhui' ? t('recherche.bouge.quandAujourdhui')
    : q.cle === 'hier' ? t('recherche.bouge.quandHier')
      : t('recherche.bouge.quandJours', { count: q.jours })
  const detail = m.genre === 'baisse' ? t('recherche.bouge.deA', { avant: chf(m.ancienPrix), apres: chf(m.prix) })
    : m.genre === 'retrait' ? t('recherche.bouge.dernierPrix', { prix: chf(m.prix) })
      : chf(m.prix)
  // Une annonce qui apparaît dans la pige peut être en ligne depuis des jours (la collecte RealAdvisor
  // la voit en moyenne 4,5 jours après sa publication) : on le dit, au-delà d'un jour.
  const age = m.joursSurMarche == null ? null
    : m.genre === 'apparition' ? (m.joursSurMarche > 1 ? t('recherche.bouge.enLigneDepuis', { count: m.joursSurMarche }) : null)
      : t('recherche.bouge.apresJours', { count: m.joursSurMarche })

  return (
    <li style={{ borderTop: bordure ? '1px solid ' + line : 'none' }}>
      <button onClick={() => onOuvrir(b)} className="mrh-flux-ligne"
        style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) auto', alignItems: 'center', gap: 'var(--crm-space-2xl)', width: '100%', padding: 'var(--crm-space-lg) var(--crm-space-4xl)', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: sp.ink }}>
        <span style={{ position: 'relative', display: 'block', width: 56, height: 56, borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', background: surf.cardSub }}>
          <MrhPhoto url={b.photos[0] ?? null} dark={dark} fallbackBg={surf.cardSub} fallbackInk={sp.sub} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</span>
          <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[b.typeLabel, b.city, b.canton].filter(Boolean).join(' · ')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
            {m.genre === 'baisse' && <RechIcon name="trendDown" size={13} stroke={encreBaisse} />}
            <span>{detail}</span>
            {m.genre === 'baisse' && m.variationPct != null && <span style={{ color: encreBaisse }}>{formaterPct(m.variationPct, i18n.language)}</span>}
            {age && <span style={{ fontWeight: 500, color: sp.sub }}>{age}</span>}
          </span>
        </span>
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, whiteSpace: 'nowrap' }}>{quand}</span>
      </button>
    </li>
  )
}
```

- [ ] **Step 4 : Les mouvements du banc**

Dans `mrhDemo.ts` :

1. Remplacer `import type { MrhBien, MrhBienDetail, MrhContact } from './types'` par :

```ts
import type { MouvementPige, PointPrix } from './pige'
import type { MrhBien, MrhBienDetail, MrhContact } from './types'
```

2. Dans l'en-tête du fichier, après le paragraphe « ⛔ Rien ici ne vient de la base et rien n'écrit. … », ajouter la ligne :

```ts
 * « Ce qui a bougé » et l'historique du prix (pige, 21.09.2026) y ont leurs fixtures, en fin de fichier.
```

3. En fin de fichier, ajouter :

```ts

/** Une annonce du banc par son id — les mouvements ci-dessous n'en inventent pas de nouvelles. */
const annonceDemo = (id: string): MrhBien => {
  const b = MRH_DEMO_BIENS.find((x) => x.id === id)
  if (!b) throw new Error(`mrhDemo : annonce ${id} introuvable`)
  return b
}

/**
 * « Ce qui a bougé » au banc : deux mouvements par flux, pris parmi les neuf annonces ci-dessus.
 * ⚠ Dates RELATIVES à l'ouverture du banc, pour que « aujourd'hui » et « hier » restent vrais d'un jour
 * sur l'autre. Les retirées portent `status` et `retireeLe` : la fiche ouverte depuis le flux doit dire
 * « retirée le … ». ⛔ Inventés, comme le reste de ce fichier.
 */
export const MRH_DEMO_MOUVEMENTS: MouvementPige[] = [
  { id: 'demo-mv-01', genre: 'apparition', quand: ILYA(0, 3), ancienPrix: null, prix: 980000, variationPct: null, joursSurMarche: 4, bien: annonceDemo('demo-ml-02') },
  { id: 'demo-mv-02', genre: 'apparition', quand: ILYA(1, 2), ancienPrix: null, prix: 1980, variationPct: null, joursSurMarche: 0, bien: annonceDemo('demo-ml-09') },
  { id: 'demo-mv-03', genre: 'baisse', quand: ILYA(0, 5), ancienPrix: 1145000, prix: 1100000, variationPct: -3.93, joursSurMarche: 12, bien: annonceDemo('demo-ml-01') },
  { id: 'demo-mv-04', genre: 'baisse', quand: ILYA(3), ancienPrix: 1220000, prix: 1180000, variationPct: -3.28, joursSurMarche: 11, bien: annonceDemo('demo-ml-03') },
  { id: 'demo-mv-05', genre: 'retrait', quand: ILYA(0, 6), ancienPrix: 3250000, prix: 3250000, variationPct: null, joursSurMarche: 41, bien: { ...annonceDemo('demo-ml-04'), status: 'removed', retireeLe: ILYA(0, 6) } },
  { id: 'demo-mv-06', genre: 'retrait', quand: ILYA(2), ancienPrix: 4100, prix: 4100, variationPct: null, joursSurMarche: 19, bien: { ...annonceDemo('demo-ml-07'), status: 'removed', retireeLe: ILYA(2) } },
]

/** Historique d'une annonce du banc : un relevé il y a quarante jours, sa baisse si elle en porte une, son retrait si elle est retirée. */
function historiqueDemo(b: MrhBien): PointPrix[] {
  const actuel = (b.transaction === 'location' ? b.rent : b.price) ?? null
  const premier = b.price_original ?? actuel
  const points: PointPrix[] = [
    { id: `${b.id}-suivi`, genre: 'suivi', quand: ILYA(40), ancienPrix: null, prix: premier, variationPct: null, statut: 'active' },
  ]
  if (b.price_original && actuel && b.price_original > actuel) {
    // Même date que le mouvement du flux quand il existe : la fiche ne contredit pas la ligne qu'on a cliquée.
    const quand = MRH_DEMO_MOUVEMENTS.find((m) => m.bien.id === b.id && m.genre === 'baisse')?.quand ?? ILYA(6)
    points.push({ id: `${b.id}-baisse`, genre: 'baisse', quand, ancienPrix: b.price_original, prix: actuel, variationPct: Math.round(((actuel - b.price_original) / b.price_original) * 10000) / 100, statut: 'price_reduced' })
  }
  if (b.retireeLe) {
    points.push({ id: `${b.id}-retrait`, genre: 'retrait', quand: b.retireeLe, ancienPrix: actuel, prix: actuel, variationPct: null, statut: 'removed' })
  }
  return points
}

/**
 * Historique de chaque annonce du banc, calculé UNE fois au chargement du module — le calculer au rendu
 * lirait l'horloge pendant le rendu. Les annonces retirées du flux remplacent leur version vivante.
 */
export const MRH_DEMO_HISTORIQUES: Record<string, PointPrix[]> = Object.fromEntries(
  [...MRH_DEMO_BIENS, ...MRH_DEMO_MOUVEMENTS.map((m) => m.bien)].map((b) => [b.id, historiqueDemo(b)]),
)
```

- [ ] **Step 5 : Brancher la vue dans `MatchingRechercheHybride.tsx`**

Lire le fichier, puis appliquer ces remplacements (texte exact au 21.09.2026) :

(a) En-tête : après la ligne `//     à la sélection de l'acheteur (⛔ rien ne part vers lui depuis le 21.09.2026).`, ajouter :

```ts
//   - « Ce qui a bougé » (pige, 21.09.2026) : Nouveaux · En baisse · Retirés sur 24 h, 7 ou 30 jours, sur
//     les MÊMES filtres durs (`usePigeMouvements`, rendu par `MrhBouge`). Filtres, vue et période se
//     rangent dans l'onglet (`useTabScopedState`).
```

(b) Imports : remplacer

```ts
import { useEcranActif } from '@/hooks/useEcranActif'
import './mrh.css'
```

par

```ts
import { useEcranActif } from '@/hooks/useEcranActif'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { usePigeMouvements, type PigeParams } from '@/hooks/usePige'
import MrhBouge, { type EtatFlux } from './MrhBouge'
import { FENETRES_PIGE, VUES_RECHERCHE, type FenetrePige, type GenreMouvement, type VueRecherche } from './pige'
import './mrh.css'
```

et remplacer

```ts
import {
  MRH_DEMO_BIENS, MRH_DEMO_BUYERS, MRH_DEMO_CITIES, MRH_DEMO_DETAIL,
  MRH_DEMO_TOTAL, type MrhDemoEtat,
} from './mrhDemo'
```

par

```ts
import {
  MRH_DEMO_BIENS, MRH_DEMO_BUYERS, MRH_DEMO_CITIES, MRH_DEMO_DETAIL, MRH_DEMO_HISTORIQUES,
  MRH_DEMO_MOUVEMENTS, MRH_DEMO_TOTAL, type MrhDemoEtat,
} from './mrhDemo'
```

(c) État : remplacer

```ts
  // ── état ──
  const [buyer, setBuyer] = useState<MrhContact | null>(null)
  const [trans, setTrans] = useState<'all' | 'vente' | 'location'>('all')
  const [tokens, setTokens] = useState<MrhToken[]>([])
```

par

```ts
  // ── état ──
  // ⚠ Les FILTRES se rangent dans l'onglet (`useTabScopedState`) : ce sont ceux de la grille ET de « Ce
  // qui a bougé ». Deux onglets sur Matching gardent chacun leur segment, et aucun n'est imposé (décision
  // de Julien, 21.09.2026). L'acheteur y est rangé par sa recherche, jamais en objet : ni nom ni critère
  // dans la pile d'onglets, et des critères toujours relus.
  const [acheteurId, setAcheteurId] = useTabScopedState<string | null>('recherche.acheteur', null)
  const [trans, setTrans] = useTabScopedState<'all' | 'vente' | 'location'>('recherche.trans', 'all')
  const [tokens, setTokens] = useTabScopedState<MrhToken[]>('recherche.jetons', SANS_JETON)
  const [vue, setVue] = useTabScopedState<VueRecherche>('recherche.vue', 'marche')
  const [fenetre, setFenetre] = useTabScopedState<FenetrePige>('recherche.fenetre', 7)
```

et, au niveau du MODULE, juste après la fin du type `MrhToken` (la ligne `  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'text'; value: string }`), ajouter :

```ts

/**
 * La valeur initiale des jetons, d'identité STABLE : `useTabScopedState` rend `initial` tant que l'onglet
 * n'a rien rangé, et un `[]` écrit dans l'appel changerait d'identité à chaque rendu — donc `serverParams`,
 * puis les paramètres du flux, recalculés à chaque frappe.
 */
const SANS_JETON: MrhToken[] = []
```

(d) Acheteur : remplacer

```ts
  const { data: liveBuyers = [] } = useMatchingBuyers()
  const buyers = demo ? MRH_DEMO_BUYERS : liveBuyers
```

par

```ts
  const { data: liveBuyers = [] } = useMatchingBuyers()
  const buyers = demo ? MRH_DEMO_BUYERS : liveBuyers
  const buyer = useMemo(() => buyers.find((c) => c.searchId === acheteurId) ?? null, [buyers, acheteurId])
  const setBuyer = (c: MrhContact | null) => setAcheteurId(c ? c.searchId : null)
```

(e) Le flux : remplacer

```ts
  const isSettled = demo ? demo === 'ok' || demo === 'vide' : live.status === 'success'
```

par

```ts
  const isSettled = demo ? demo === 'ok' || demo === 'vide' : live.status === 'success'

  // ── « Ce qui a bougé » : le flux de la pige, sur les MÊMES filtres durs que la grille ──
  const genreFlux: GenreMouvement | null = vue === 'marche' ? null : vue
  const pigeParams = useMemo<PigeParams>(() => ({
    genre: genreFlux ?? 'apparition',
    fenetre,
    transaction: serverParams.transaction,
    cantons: serverParams.cantons,
    types: serverParams.types,
    city: serverParams.city,
    budgetMin: serverParams.budgetMin,
    budgetMax: serverParams.budgetMax,
  }), [genreFlux, fenetre, serverParams])
  const pige = usePigeMouvements(pigeParams, genreFlux != null && !demo)
  const mouvementsCharges = useMemo(() => (pige.data?.pages ?? []).flatMap((p) => p.mouvements), [pige.data])
  const mouvements = demo
    ? (demo === 'ok' && genreFlux ? MRH_DEMO_MOUVEMENTS.filter((m) => m.genre === genreFlux) : [])
    : mouvementsCharges
  const fluxEnVol = !demo && genreFlux != null && pige.status === 'pending' && pige.fetchStatus === 'fetching'
```

(f) Le chien de garde sert les deux vues : remplacer

```ts
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!isFetchingFirst) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 15_000)
    return () => clearTimeout(id)
  }, [isFetchingFirst])
```

par

```ts
  const enVol = genreFlux ? fluxEnVol : isFetchingFirst
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!enVol) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 15_000)
    return () => clearTimeout(id)
  }, [enVol])
```

(g) Filtres client et état du flux : remplacer

```ts
    if (q.trim() && !hay.includes(norm(q))) return false
    return true
  }, [clientTokens, q, bienHay])
```

par

```ts
    if (q.trim() && !hay.includes(norm(q))) return false
    return true
  }, [clientTokens, q, bienHay])

  // Les jetons CLIENT (pièces, surface, texte) filtrent aussi les mouvements chargés, avec la même limite
  // que la grille — que l'écran dit (`clientFilterScope`).
  const mouvementsVisibles = useMemo(() => mouvements.filter((m) => strictPass(m.bien)), [mouvements, strictPass])
  const etatFlux: EtatFlux = demo
    ? (demo === 'erreur' ? 'erreur' : demo === 'bloque' ? 'bloque' : 'pret')
    : fluxEnVol ? (slow ? 'lent' : 'chargement')
      : pige.isError ? 'erreur'
        : pige.status === 'success' ? 'pret'
          : 'bloque'
```

(h) L'ajout à la sélection retrouve un bien coché depuis la fiche d'un mouvement : remplacer

```ts
    const items = sel
      .map((id) => biens.find((b) => b.id === id))
      .filter((b): b is MrhBien => !!b)
```

par

```ts
    // Un bien coché depuis la fiche d'un MOUVEMENT n'est pas dans la grille : on le cherche aussi là.
    const connus = new Map([...biens, ...mouvements.map((m) => m.bien)].map((b) => [b.id, b]))
    const items = sel
      .map((id) => connus.get(id))
      .filter((b): b is MrhBien => !!b)
```

(i) Les segments : après la ligne qui définit `const Lab = (…) => <div …>{children}</div>`, ajouter :

```tsx
  /**
   * Un groupe de segments — une pilule par choix, l'actif à l'accent. Vue, transaction, affichage et
   * période le partagent : quatre groupes côte à côte ne peuvent pas avoir quatre géométries. Espacements
   * et rayons en jetons : le cliquet de `megga-x-grammar.spec.ts` compte les littéraux du dossier.
   */
  const segments = <V extends string | number>({ groupe, options, valeur, onChoix, aria }: {
    groupe: string; options: { id: V; label: string }[]; valeur: V; onChoix: (v: V) => void; aria: (label: string) => string
  }) => (
    <div role="group" aria-label={groupe} style={{ display: 'inline-flex', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', background: chipBg, boxShadow: 'inset 0 0 0 1px ' + line }}>
      {options.map((o) => (
        <button key={String(o.id)} onClick={() => onChoix(o.id)} aria-pressed={valeur === o.id} aria-label={aria(o.label)}
          style={{ height: 30, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', background: valeur === o.id ? ACC : 'transparent', color: valeur === o.id ? ONACC : sp.soft, transition: 'background .15s, color .15s' }}>{o.label}</button>
      ))}
    </div>
  )
```

(j) Le compte sous le titre : remplacer

```tsx
              {countText}
              {truncated && (
                <span style={{ color: sp.sub }}> · {t('recherche.countTotal', { total: marketTotal })}</span>
              )}
            </div>
            {truncated && clientFilterActive && (
```

par

```tsx
              {genreFlux ? (
                <>
                  {t('recherche.bouge.compte', { count: mouvementsVisibles.length })}
                  {!demo && pige.hasNextPage && <span style={{ color: sp.sub }}> · {t('recherche.bouge.suite')}</span>}
                </>
              ) : (
                <>
                  {countText}
                  {truncated && (
                    <span style={{ color: sp.sub }}> · {t('recherche.countTotal', { total: marketTotal })}</span>
                  )}
                </>
              )}
            </div>
            {(genreFlux ? clientFilterActive : truncated && clientFilterActive) && (
```

puis, deux lignes plus bas, remplacer `                {t('recherche.clientFilterScope', { count: biens.length })}` par :

```tsx
                {t('recherche.clientFilterScope', { count: genreFlux ? mouvements.length : biens.length })}
```

(k) Les commandes de l'en-tête : remplacer le bloc entier, depuis `            <div role="group" aria-label={t('recherche.trans.group')}` jusqu'à la fin du groupe de tri inclus (`              {sortOpts.map((o) => <Chip … />)}` puis `            </div>`), par :

```tsx
            {segments({
              groupe: t('recherche.vue.group'), valeur: vue, onChoix: setVue, aria: (label) => t('recherche.vue.aria', { label }),
              options: VUES_RECHERCHE.map((v) => ({ id: v, label: t(`recherche.vue.${v}`) })),
            })}
            {segments({
              groupe: t('recherche.trans.group'), valeur: trans, onChoix: setTrans, aria: (label) => t('recherche.trans.aria', { label }),
              options: [
                { id: 'all' as const, label: t('recherche.trans.all') },
                { id: 'vente' as const, label: t('recherche.trans.sale') },
                { id: 'location' as const, label: t('recherche.trans.rent') },
              ],
            })}
            {genreFlux ? (
              segments({
                groupe: t('recherche.fenetre.group'), valeur: fenetre, onChoix: setFenetre, aria: (label) => t('recherche.fenetre.aria', { label }),
                options: FENETRES_PIGE.map((j) => ({ id: j, label: t(`recherche.fenetre.j${j}`) })),
              })
            ) : (
              <>
                {segments({
                  groupe: t('recherche.view.group'), valeur: view, onChoix: setView, aria: (label) => t('recherche.view.aria', { label }),
                  options: [{ id: 'grid' as const, label: t('recherche.view.grid') }, { id: 'map' as const, label: t('recherche.view.map') }],
                })}
                <div role="group" aria-label={t('recherche.sort.group')} style={{ display: 'flex', gap: 6 }}>
                  {sortOpts.map((o) => <Chip key={o.id} active={sort === o.id} onClick={() => setSort(o.id)} pressed={sort === o.id} aria={t('recherche.sort.aria', { label: o.l })}>{o.l}</Chip>)}
                </div>
              </>
            )}
```

(l) Les résultats : remplacer

```tsx
      {/* Résultats — grille OU vue carte (split liste ↔ carte à pins) */}
      {view === 'map' && isSettled && !isError && (strict.length + near.length) > 0 ? (
```

par

```tsx
      {/* Résultats — « Ce qui a bougé », ou la grille / la vue carte (split liste ↔ carte à pins) */}
      {!genreFlux && view === 'map' && isSettled && !isError && (strict.length + near.length) > 0 ? (
```

puis remplacer `          {isFetchingFirst ? (` par :

```tsx
          {genreFlux ? (
            <MrhBouge
              genre={genreFlux}
              mouvements={mouvementsVisibles}
              etat={etatFlux}
              suiteDisponible={!demo && !!pige.hasNextPage}
              chargeSuite={pige.isFetchingNextPage}
              onSuite={() => { void pige.fetchNextPage() }}
              onReessayer={() => { void pige.refetch() }}
              onOuvrir={openBien}
              ctx={ctx}
            />
          ) : isFetchingFirst ? (
```

(m) La fiche : remplacer

```tsx
          detailDemo={demo ? MRH_DEMO_DETAIL : undefined}
        />
```

par

```tsx
          detailDemo={demo ? MRH_DEMO_DETAIL : undefined}
          historiqueDemo={demo ? (MRH_DEMO_HISTORIQUES[extBien.id] ?? []) : undefined}
        />
```

- [ ] **Step 6 : Vérifier la compilation**

Run : `npx tsc -b 2>&1 | grep -E "matching-recherche|usePige" ; echo fin`
Expected : `fin` seul, à l'exception d'erreurs sur `historiqueDemo` (prop ajoutée à la Task 12).

- [ ] **Point de commit (au signal)** : avec les Tasks 10, 12, 13, 14.

---

### Task 12 : L'historique sur la fiche

**Files :**
- Create : `src/components/matching-recherche/MrhHistoriquePrix.tsx`
- Modify : `src/components/matching-recherche/MrhExtDetail.tsx`, `src/pages/agent/ExternalListingDetailPage.tsx`

- [ ] **Step 1 : Écrire `MrhHistoriquePrix.tsx`**

```tsx
/**
 * Matching · Recherche — l'historique du prix d'une annonce du marché : jours sur le marché, nombre de
 * changements, écart au premier prix de la série, la courbe, puis la liste des événements.
 *
 * Monté par la fiche de la Recherche (`MrhExtDetail`) et par la fiche autonome
 * (`ExternalListingDetailPage`) : une lecture (`useHistoriquePrix`), un rendu.
 *
 * ⚠ L'HISTORIQUE COMMENCE À LA MISE EN SERVICE (21.09.2026) — cf. `pige.ts`. L'écart se dit « depuis la
 * première publication » seulement si la série commence par une apparition ; sinon « depuis le {date} ».
 * Le dire autrement ferait passer un relevé pour une publication.
 * ⚠ Les jours sur le marché se lisent dans `first_seen_at` (`bien.enLigneDepuis`), pas dans
 * `days_on_market`, que RealAdvisor n'écrit jamais.
 * ⚠ SVG à la main : un escalier de quelques points ne demande pas de librairie de graphiques.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useHistoriquePrix } from '@/hooks/usePige'
import { formatCHF, formatDate } from '@/lib/utils'
import { mrhPriceDropInk } from './mrhCtx'
import { formaterPct, resumerHistorique, tracerCourbe, type GenrePoint, type PointPrix } from './pige'
import type { MrhBien } from './types'

/** Cadre du tracé en unités du viewBox ; l'SVG garde ses proportions et suit la largeur de la fiche. */
const LARGEUR = 600
const HAUTEUR = 120

interface Props {
  bien: MrhBien
  sp: CrmPalette
  dark: boolean
  /** Pose le titre de section, quand l'hôte n'en a pas (fiche autonome). */
  avecTitre?: boolean
  /** Banc : les points fournis au lieu d'être lus ; aucune requête ne part. */
  pointsDemo?: PointPrix[]
}

export default function MrhHistoriquePrix({ bien, sp, dark, avecTitre = false, pointsDemo }: Props) {
  const { t, i18n } = useTranslation('matching')
  const live = useHistoriquePrix(pointsDemo ? null : bien.id)
  // Horloge figée au montage (idiome de `BpTopGallery`) : la courbe s'arrête à l'ouverture de la fiche.
  const [maintenant] = useState(() => Date.now())

  const titre = avecTitre ? (
    <h3 style={{ margin: '0 0 var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{t('recherche.historique.titre')}</h3>
  ) : null
  const message = (texte: string) => (
    <div>{titre}<div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{texte}</div></div>
  )

  if (!pointsDemo && live.isPending) {
    // Requête désactivée (pas de session) : rien à affirmer. En vol : place réservée, hauteur du tracé.
    if (live.fetchStatus !== 'fetching') return null
    return <div>{titre}<div aria-hidden="true" style={{ height: HAUTEUR, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} /></div>
  }
  if (!pointsDemo && live.isError) return message(t('recherche.historique.erreur'))

  const points = pointsDemo ?? live.data?.points ?? []
  const tronque = !pointsDemo && (live.data?.tronque ?? false)
  if (!points.length) return message(t('recherche.historique.vide'))

  const loyer = bien.transaction === 'location'
  const prixActuel = loyer ? bien.rent : bien.price
  const fin = bien.retireeLe ? Date.parse(bien.retireeLe) : maintenant
  const r = resumerHistorique(points, { enLigneDepuis: bien.enLigneDepuis, retireeLe: bien.retireeLe, prixActuel }, maintenant)
  const courbe = tracerCourbe(points, LARGEUR, HAUTEUR, fin)
  const encreBaisse = mrhPriceDropInk(dark)
  const chf = (v: number | null) => `${formatCHF(v)}${loyer && v ? ' ' + t('recherche.card.perMonth') : ''}`
  const genre = (g: GenrePoint) => t(`recherche.historique.genre.${g}`)

  const kpi = (libelle: string, valeur: string, note: string | null, encre = sp.ink) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{libelle}</div>
      <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: encre, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{valeur}</div>
      {note && <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{note}</div>}
    </div>
  )

  const jours = r.joursSurMarche == null ? null
    : r.joursSurMarche === 0 ? t('recherche.historique.moinsUnJour')
      : t('recherche.historique.jours', { count: r.joursSurMarche })
  const depuis = r.debut?.nature === 'publication'
    ? t('recherche.historique.depuisPublication')
    : r.debut ? t('recherche.historique.depuisDate', { date: formatDate(r.debut.quand) }) : null

  return (
    <div>
      {titre}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--crm-space-2xl) var(--crm-space-6xl)' }}>
        {jours && kpi(t('recherche.historique.surMarche'), jours, bien.retireeLe ? t('recherche.historique.retireeLe', { date: formatDate(bien.retireeLe) }) : null)}
        {kpi(t('recherche.historique.changements'), String(r.changements), r.debut ? t('recherche.historique.suiviDepuis', { date: formatDate(r.debut.quand) }) : null)}
        {r.ecartPct != null && kpi(t('recherche.historique.ecart'), formaterPct(r.ecartPct, i18n.language), depuis, r.ecartPct < 0 ? encreBaisse : sp.ink)}
      </div>
      {courbe && (
        <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} role="img" aria-label={t('recherche.historique.courbe')}
          style={{ display: 'block', width: '100%', height: 'auto', marginTop: 'var(--crm-space-4xl)', overflow: 'visible' }}>
          <path d={courbe.chemin} fill="none" stroke={sp.ink} strokeWidth={1.5} strokeLinejoin="round" />
          {courbe.marques.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={4}
              fill={m.genre === 'baisse' ? encreBaisse : sp.cardBg}
              stroke={m.genre === 'baisse' ? encreBaisse : sp.ink} strokeWidth={1.5} />
          ))}
        </svg>
      )}
      <ol style={{ listStyle: 'none', margin: 'var(--crm-space-4xl) 0 0', padding: 0, display: 'grid', gap: 'var(--crm-space-sm)' }}>
        {[...points].reverse().map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)', minWidth: 0, fontSize: 'var(--crm-text-md)' }}>
            <span style={{ flexShrink: 0, width: 88, fontWeight: 600, color: sp.sub }}>{formatDate(p.quand)}</span>
            <span style={{ flexShrink: 0, fontWeight: 600, color: p.genre === 'baisse' ? encreBaisse : sp.ink }}>{genre(p.genre)}</span>
            <span style={{ minWidth: 0, fontWeight: 500, color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.ancienPrix != null && p.prix != null && p.ancienPrix !== p.prix
                ? `${t('recherche.bouge.deA', { avant: chf(p.ancienPrix), apres: chf(p.prix) })}${p.variationPct != null ? ` (${formaterPct(p.variationPct, i18n.language)})` : ''}`
                : chf(p.prix)}
            </span>
          </li>
        ))}
      </ol>
      {tronque && (
        <div style={{ marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
          {t('recherche.historique.tronque', { n: points.length })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : La fiche de la Recherche (`MrhExtDetail.tsx`)**

1. En-tête : après la puce `//  · Carte plein écran et lightbox sont PORTÉES dans `document.body` : …` (et ses deux lignes de suite), ajouter :

```ts
//  · L'historique du prix (pige, 21.09.2026) est la section qui suit les équipements : `MrhHistoriquePrix`,
//    le même composant que la fiche autonome.
```

2. Imports : après `import { useEcranActif } from '@/hooks/useEcranActif'`, ajouter :

```ts
import MrhHistoriquePrix from './MrhHistoriquePrix'
import type { PointPrix } from './pige'
```

3. Props : remplacer

```ts
  detailDemo?: MrhBienDetail
}
```

par

```ts
  detailDemo?: MrhBienDetail
  /** Banc : l'historique du prix fourni au lieu d'être lu (`MRH_DEMO_HISTORIQUES`). */
  historiqueDemo?: PointPrix[]
}
```

4. Signature : dans `export default function MrhExtDetail({ … detailDemo }: Props)`, remplacer `detailDemo }: Props` par `detailDemo, historiqueDemo }: Props`.

5. Dans la colonne de gauche du bento 2, remplacer

```tsx
                      ))}
                    </div>
                  </>
                )}
              </div>
```

(la fin du bloc « Équipements », suivie de la fermeture de la colonne) par

```tsx
                      ))}
                    </div>
                  </>
                )}
                {/* L'historique du prix (pige) — la même lecture que la fiche autonome. */}
                {rule}
                {eyebrow(t('recherche.historique.titre'))}
                <MrhHistoriquePrix bien={bien} sp={sp} dark={dark} pointsDemo={historiqueDemo} />
              </div>
```

- [ ] **Step 3 : La fiche autonome (`ExternalListingDetailPage.tsx`)**

1. En-tête : après le paragraphe « ⛔ Plus d'« Envoyer par e-mail » (21.09.2026) … », ajouter :

```ts
 *
 * L'historique du prix (pige, 21.09.2026) : `MrhHistoriquePrix`, la même lecture que la fiche de la Recherche.
```

2. Imports : après `import { useCrmDarkPref } from '@/lib/crmDark'`, ajouter :

```ts
import MrhHistoriquePrix from '@/components/matching-recherche/MrhHistoriquePrix'
```

3. Avant la ligne `            {/* ── NIVEAU 3 : Notes agent ─────────────────────────────────── */}`, insérer :

```tsx
            {/* Historique du prix (pige) — rayon et marge en jetons : cette page est au cliquet de
                `megga-x-grammar.spec.ts`, qui compte `rounded-xl` et `p-5` comme des littéraux. */}
            {annonce && (
              <section className="border border-theme-border" style={{ borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-4xl)' }}>
                <MrhHistoriquePrix bien={annonce} sp={sgSp} dark={dark} avecTitre />
              </section>
            )}

```

- [ ] **Step 4 : Vérifier**

Run : `npx tsc -b 2>&1 | tail -3 && npx vitest run tests/unit/market-listing.spec.ts tests/unit/mrh-listing-detail.test.ts tests/unit/pige.spec.ts`
Expected : tsc sans erreur ; PASS.

- [ ] **Point de commit (au signal)** : avec les Tasks 10, 11, 13, 14.

---

### Task 13 : Le banc de la fiche autonome

**Files :**
- Modify : `src/pages/dev/crmFixtures.ts` (partagé avec 1a : relire juste avant d'écrire, ne toucher qu'à `ANNONCE_MARCHE_BANC`, au nouveau bloc et à UNE ligne de `CRM_TABLES`)

- [ ] **Step 1 : L'annonce du banc porte sa publication**

Dans `ANNONCE_MARCHE_BANC`, remplacer

```ts
  year_built: 2019, days_on_market: 12, land_surface: null,
```

par

```ts
  year_built: 2019, days_on_market: 12, land_surface: null,
  // Pige (21.09.2026) : l'âge se lit dans first_seen_at, et removed_at dit un retrait.
  first_seen_at: ilYA(24 * 42), removed_at: null,
```

- [ ] **Step 2 : Son historique**

Juste après l'objet `ANNONCE_MARCHE_BANC` (sa ligne `}` de fermeture), ajouter :

```ts

/**
 * L'historique du prix de `ANNONCE_MARCHE_BANC` (pige, 21.09.2026) — ce que la fiche autonome lit dans
 * `market_price_history`. Un relevé initial puis une baisse : la courbe, l'écart et la liste ont de quoi se
 * dessiner. ⚠ Forme de LIGNE : le banc filtre `market_listing_id=eq.…` et trie `detected_at.desc,id.desc`.
 */
const HISTORIQUE_PRIX_BANC = [
  {
    id: 'mph-banc-1', market_listing_id: ANNONCE_MARCHE_BANC.id, kind: 'suivi', detected_at: ilYA(24 * 30),
    old_price: null, new_price: 2600, change_pct: null, old_status: null, new_status: 'active',
    transaction_type: 'rent', canton: 'VD', type: 'apartment', city: 'Rolle',
  },
  {
    id: 'mph-banc-2', market_listing_id: ANNONCE_MARCHE_BANC.id, kind: 'baisse', detected_at: ilYA(24 * 6),
    old_price: 2600, new_price: 2450, change_pct: -5.77, old_status: 'active', new_status: 'price_reduced',
    transaction_type: 'rent', canton: 'VD', type: 'apartment', city: 'Rolle',
  },
]
```

- [ ] **Step 3 : La table**

Dans `CRM_TABLES`, juste après la ligne `market_listings: [...]` (telle qu'elle est à ce moment, quelle que soit sa liste), ajouter :

```ts
  market_price_history: HISTORIQUE_PRIX_BANC,
```

- [ ] **Step 4 : Vérifier**

Run : `npx tsc -b 2>&1 | tail -3 && npx vitest run tests/unit/banc-supabase.spec.ts tests/unit/dev-bancs-frontiere.spec.ts`
Expected : tsc sans erreur ; PASS.

- [ ] **Point de commit (au signal)** : avec les Tasks 10, 11, 12, 14.

---

### Task 14 : Les gardes de grammaire, puis toutes les portes

**Files :**
- Modify : `tests/unit/megga-x-grammar.spec.ts` (inventaire B4 de `matching-recherche` ; partagé : ne toucher qu'à cette entrée)

- [ ] **Step 1 : Le cliquet des rayons et espacements**

Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts`
Expected : un seul échec, « inventaire B4 à resserrer » sur `src/components/matching-recherche` : les deux groupes de segments de l'ancienne en-tête (transaction, affichage) emportent six littéraux (`gap: 2`, `padding: 3`, `padding: '0 13px'`, deux fois), et le code neuf n'en ajoute aucun. Attendu : `{ hors: 106, total: 165 }` ; prendre les chiffres que la spec affiche. Remplacer l'entrée

```ts
  // {123,185} -> {112,171} (21.09.2026) : la feuille d'envoi `MrhSendSheet` est retirée, la
  // Recherche ajoute à la sélection de l'acheteur au lieu de lui envoyer un lien.
  ['src/components/matching-recherche', { hors: 112, total: 171 }],
```

par (chiffres mesurés)

```ts
  // {123,185} -> {112,171} (21.09.2026) : la feuille d'envoi `MrhSendSheet` est retirée, la
  // Recherche ajoute à la sélection de l'acheteur au lieu de lui envoyer un lien.
  // {112,171} -> {106,165} (21.09.2026) : les groupes de segments de l'en-tête passent aux jetons
  // (`segments`), et « Ce qui a bougé » (`MrhBouge`) et l'historique du prix (`MrhHistoriquePrix`)
  // naissent sans littéral.
  ['src/components/matching-recherche', { hors: 106, total: 165 }],
```

Si une AUTRE zone rougit (hausse), c'est un littéral écrit par ce chantier : le remplacer par un jeton, ne jamais monter un inventaire.

Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts`
Expected : PASS.

- [ ] **Step 2 : Les gardes de la Recherche**

Run : `npx vitest run tests/unit/couleur-barreaux.spec.ts tests/unit/matching-contraste.spec.ts tests/unit/matching-atelier-css.spec.ts tests/unit/etat-vide.spec.ts tests/unit/statut-clair.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/stockage-inventaire.spec.ts tests/unit/pige.spec.ts tests/unit/pige-sql.spec.ts tests/unit/mrh-listing-detail.test.ts tests/unit/market-listing.spec.ts`
Expected : PASS (aucune couleur hexadécimale neuve, aucune encre translucide, aucun stockage navigateur neuf, aucun appel de sortie vers l'acheteur).

- [ ] **Step 3 : Les portes du workflow, une à une**

Run : `npx tsc -b && npm run lint 2>&1 | grep -E "matching-recherche|usePige|ExternalListingDetailPage|crmFixtures" ; echo fin`
Expected : tsc sans erreur ; `fin` seul (aucune alerte sur les fichiers de ce chantier ; les ~45 erreurs préexistantes d'`eslint .` ailleurs ne comptent pas).

Run : `npm run lint:prose && npm run lint:i18n && npm run i18n:parity:ci && npm run i18n:coverage:ci && npm run lint:deadcode && npm run lint:deps && npm run lint:types-freshness && npm run lint:roster && npm run lint:migrations && npm run lint:edge-auth`
Expected : tout vert (aucun export mort : chaque export de `pige.ts`, `usePige.ts`, `MrhBouge.tsx`, `mrhDemo.ts` a un lecteur).

Run : `command -v deno && deno check --no-lock supabase/functions/flatfox-sync/index.ts supabase/functions/market-scraper/index.ts`
Expected : sans erreur (sinon laissé à la CI, le noter).

- [ ] **Step 4 : La suite unitaire, SEULE**

Run : `npm run test:unit`
Expected : PASS, hormis les échecs connus et sans lien relevés au lot A (deux specs de messagerie sur `npm:postal-mime@3.0.0`, `safe-internal-path` sur `javascript:`) ; toute autre rouge est de ce chantier.

- [ ] **Step 5 : Le banc, à l'écran** (serveur de dev sur le port 5173, cf. mémoire « Serveur dev = dernière version »)

1. `http://localhost:5173/dev/crm?entree=/dashboard/matching` → PageDown jusqu'à la Recherche (démo) : le groupe « Tout le marché · Nouveaux · En baisse · Retirés » est là ; « Nouveaux » montre deux lignes (dont « en ligne depuis 4 jours »), « En baisse » deux lignes avec « CHF 1'145'000 → CHF 1'100'000 », « −3,9 % » en encre de baisse et l'icône, « Retirés » deux lignes ; la période remplace grille/carte et le tri ; « Tout le marché » les rend.
2. Cliquer une baisse → la fiche montre « Historique du prix » : trois indicateurs, la courbe en escalier, la liste ; une retirée → « retirée le … » sous « Sur le marché ».
3. Choisir un acheteur, cocher un bien depuis la fiche d'un mouvement → la barre « Ajouter à la sélection de … » l'ajoute (toast « 1 bien ajouté »).
4. `http://localhost:5173/dev/crm?entree=/dashboard/market/00432e97-f3d2-4d11-9c1f-dd882343ee8e` → la carte « Historique du prix » : 42 jours sur le marché, 1 changement, −5,8 %, la courbe.
5. `/dev/matching-atelier` : états Vide, Échec, Bloqué de la Recherche en vue « En baisse » → état vide, « Réessayer ».
6. Les mêmes écrans en sombre ; aucune erreur en console (`read_console_messages`), aucun appel `rpc/pige_mouvements` ni `market_price_history` depuis la Recherche en démo (`read_network_requests`).

- [ ] **Point de commit (au signal)** : Tasks 10 à 14 — `feat(recherche): « Ce qui a bougé » et l'historique du prix sur la fiche d'une annonce`.

---

### Task 15 : La documentation et le cerveau

**Files :** `docs/schema.md`, `docs/system-map.md`, `docs/pages.md`, `CLAUDE.md`, `.claude-flow/knowledge/megga-memory.seed.json` (tous partagés : relire juste avant d'écrire)

- [ ] **Step 1 : `docs/schema.md`**

Après le bloc SQL de `market_listings` (celui qui finit par « affiche un loyer nul, à l'écran, sans erreur. »), insérer :

````markdown
`market_listings.removed_at` (21.09.2026) : la date à laquelle le CRM a CONSTATÉ le retrait, posée par
`trg_ml_date_retrait` au passage à `removed`, effacée au retour. NULL pour toute annonce retirée avant la mise en
service de la pige : on ne reconstitue pas le passé. ⚠ `updated_at` n'en tient pas lieu : la sonde de résurrection
RealAdvisor le repousse chaque nuit sur les retirées.

```sql
-- Historique des prix et des statuts du marché, écrit par DÉCLENCHEUR (`ml_historique_prix`, SECURITY DEFINER)
-- et par lui seul. Lisible par tout agent authentifié, jamais écrit par un client.
market_price_history (
  id, market_listing_id,               -- FK market_listings ON DELETE CASCADE
  kind,                                -- suivi | apparition | baisse | hausse | prix | retrait | retour | statut
  old_price, new_price,                -- prix effectif (current_price ?? price) avant / après
  change_pct,                          -- borné à ±999,99
  old_status, new_status,
  transaction_type, canton, type, city, -- contexte À L'INSTANT de l'événement : pige_mouvements filtre dessus
  detected_at
)
-- `suivi` = relevé initial de chaque annonce vivante à la mise en service ; `apparition` = chaque insertion
-- depuis. Index : (market_listing_id, detected_at desc) pour la fiche, (kind, detected_at desc, id desc)
-- pour le flux « Ce qui a bougé ».
```
````

- [ ] **Step 2 : `docs/system-map.md` §4 « Pipeline marketplace »**

Après la puce « **Observabilité** : `flatfox_sync_runs` … », ajouter :

```markdown
- **Pige et historique des prix (21.09.2026, étape 1b)** : chaque changement réel de prix ou de statut d'une annonce écrit une ligne de `market_price_history` (déclencheurs `trg_ml_historique_ins` / `trg_ml_historique_maj`, jamais les edges), `removed_at` date le retrait constaté, et la baisse se détecte sur Flatfox comme sur RealAdvisor (`trg_ra_price_status`, premier prix gelé). La Recherche montre « Ce qui a bougé » (RPC `pige_mouvements`, SECURITY INVOKER, paginée par clé, sans comptage) et les deux fiches d'annonce l'historique (`MrhHistoriquePrix`). L'historique commence à la mise en service. Cerveau : `megga/pige-historique-prix`.
- **Balayage Flatfox par lots** : `flatfox_balayer_retraits` (500 par appel, index partiel `idx_ml_flatfox_vivantes_vues`) remplace l'UPDATE unique qui dépassait le statement_timeout depuis le 05.09.2026 (0 retrait en 16 nuits ; 12 492 fantômes rattrapés par la migration, avant les déclencheurs). Un balayage en échec finit le run en `failed`.
```

Puis remesurer le nombre de hooks cité au §2 (« Hooks (`src/hooks/`, N, … ») : `ls src/hooks | wc -l` ; écrire le chiffre mesuré et la date.

- [ ] **Step 3 : `docs/pages.md`**

Ligne `/dashboard/matching` : ajouter en fin de description « ; la Recherche porte « Ce qui a bougé » (nouveaux, en baisse, retirés) ». Ligne `/dashboard/market/:externalId` : ajouter « , avec l'historique de son prix ».

- [ ] **Step 4 : `CLAUDE.md` §8**

1. Dans la liste « **CRM agent :** … », remplacer `Matching, Mes biens` par `Matching (la Recherche porte « Ce qui a bougé » et les fiches d'annonce l'historique du prix, 21.09.2026), Mes biens`.
2. À la fin de la puce « Backend conservé intact : `market_listings` (…) — au service du matching CRM, pas d'un affichage public », ajouter : ` ; depuis le 21.09.2026, `market_price_history` s'écrit par déclencheur (écrivain unique) et `removed_at` date le retrait`.

Run : `npm run lint:claude-md`
Expected : vert. Si une prétention mesurée bouge, corriger selon le skill `claude-md-freshness` (le document ou le registre `scripts/_data/claude-md-claims.json`, jamais le code pour faire passer la porte).

- [ ] **Step 5 : Le cerveau**

```bash
python3 - <<'EOF'
import json
chemin = '.claude-flow/knowledge/megga-memory.seed.json'
brut = open(chemin, encoding='utf-8').read()  # relu juste avant d'écrire : le lot B y écrit aussi
d = json.loads(brut)
assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, 'seed : mise en forme inattendue'
par_cle = {e['key']: e for e in d['entries']}
assert 'megga/pige-historique-prix' not in par_cle
d['entries'].append({
    'key': 'megga/pige-historique-prix',
    'namespace': 'megga',
    'value': (
        "PIGE LISIBLE + HISTORIQUE DES PRIX (etape 1b, 21.09.2026, plan docs/superpowers/plans/2026-09-21-pige-lisible.md). "
        "Ecrivain UNIQUE de market_price_history = declencheurs sur market_listings (ml_historique_prix, SECURITY DEFINER) : "
        "AFTER INSERT -> apparition ; AFTER UPDATE avec WHEN (current_price / price / status IS DISTINCT FROM) -> "
        "retrait > baisse|hausse|prix > retour > statut ; 'suivi' = releve initial de chaque annonce vivante a la mise en service "
        "(on ne reconstitue pas le passe). Chaque ligne porte le contexte a l'instant (transaction_type, canton, type, city) : "
        "le flux filtre l'historique, jamais market_listings (11,5 s a froid mesurees pour une ville rare sur 30 jours). "
        "removed_at = date de CONSTAT (trg_ml_date_retrait), efface au retour, NULL pour les retraits d'avant la pige "
        "(updated_at n'en tient pas lieu : revive-collect RA le repousse chaque nuit). Flatfox : trg_ra_price_status etendu "
        "(premier prix gele, price_reduced + price_reduced_at). RPC pige_mouvements(p_kind apparition|baisse|retrait, p_since, "
        "filtres de la grille, marge 15 %, cle p_before_at/p_before_id, p_limit <= 100) SECURITY INVOKER, jamais de count. "
        "UI : Recherche (page 1 du pager Matching), vue 'Ce qui a bouge' (Nouveaux / En baisse / Retires, 24 h / 7 j / 30 j), "
        "filtres, vue et periode dans l'onglet (useTabScopedState ; acheteur range par searchId), aucun segment impose ; "
        "MrhHistoriquePrix sur MrhExtDetail et ExternalListingDetailPage (jours depuis first_seen_at, changements, ecart, "
        "courbe SVG). mapListingRow lit l'age dans first_seen_at : RA n'ecrit jamais days_on_market (0 sur 48 078 ventes). "
        "Balayage Flatfox par lots (flatfox_balayer_retraits, 500/appel) : l'UPDATE unique depassait le statement_timeout "
        "de 8 s depuis le 05.09.2026 (0 retrait en 16 nuits, 12 492 fantomes rattrapes AVANT les declencheurs)."
    ),
    'tags': 'pige,market_listings,market_price_history,flatfox,realadvisor,matching-recherche',
})
par_cle['megga/flatfox-pipeline']['value'] += (
    " Depuis le 21.09.2026 : balayage par lots (flatfox_balayer_retraits, 500/appel ; l'UPDATE unique expirait depuis le "
    "05.09), premier prix gele et baisses detectees (trg_ra_price_status etendu a flatfox), historique ecrit par declencheur. "
    "Cf. megga/pige-historique-prix."
)
par_cle['megga/edge-flatfox-arch']['value'] += (
    " Sweep : RPC flatfox_balayer_retraits en boucle tant qu'un lot revient plein ; un echec finit le run en failed "
    "(il finissait completed avec 0 retrait, 05.09 -> 21.09.2026)."
)
open(chemin, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('seed ok', len(d['entries']))
EOF
npm run ruflo:seed
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "historique des prix du marché écrit par déclencheur et retrait daté" -n megga
```

Expected : `seed ok N` ; la recherche rend `megga/pige-historique-prix` en tête.

- [ ] **Point de commit (au signal)** : `docs(cerveau): pige lisible et historique des prix`.

---

### Task 16 : Après la fusion (production, LECTURE seule)

**Files :** aucun.

- [ ] **Step 1 : Le jour de la fusion**

Dans les journaux de `deploy.yml` : `HTTP 201` pour `20260921145000_flatfox_balayage_par_lots.sql` puis `20260921150000_pige_historique_prix.sql` (ou leurs noms renommés). Puis, en lecture seule (éditeur SQL ou MCP `execute_sql`) :

```sql
select tgname from pg_trigger
 where tgrelid = 'public.market_listings'::regclass and not tgisinternal order by 1;
select kind, count(*) from public.market_price_history group by 1 order by 1;
select count(*) filter (where status in ('active', 'price_reduced')) as flatfox_vivantes
  from public.market_listings where source_portal = 'flatfox';
```

Expected : `trg_market_listings_updated_at`, `trg_ml_date_retrait`, `trg_ml_fill_rooms_surface`, `trg_ml_historique_ins`, `trg_ml_historique_maj`, `trg_ra_price_status` ; `suivi` ≈ nombre d'annonces vivantes (~84 000) ; Flatfox vivantes ≈ 36 000 (le rattrapage a eu lieu).

- [ ] **Step 2 : Le lendemain, après 04:17 UTC**

```sql
select started_at, status, total_seen, total_removed, error_message
  from public.flatfox_sync_runs order by started_at desc limit 2;
select kind, count(*) from public.market_price_history
 where detected_at > now() - interval '1 day' group by 1 order by 1;
select count(*) from public.market_listings
 where source_portal = 'flatfox' and status = 'price_reduced';
```

Expected : dernier run `completed`, `total_removed` > 0 (quelques centaines à ~1 500), `error_message` sans « balayage interrompu » ; lignes `apparition`, `retrait` et `baisse` > 0. ⚠ Si les baisses Flatfox d'une nuit dépassent ~2 % du catalogue, soupçonner un champ de prix qui change de nature d'un passage à l'autre (`price_display` brut ou net) : le signaler, ne rien corriger à chaud.

- [ ] **Step 3 : Le flux tient sous le timeout**

Dans l'app, Recherche → « Nouveaux » sur 30 jours, avec puis sans une ville rare : réponse en moins d'une seconde. En lecture seule :

```sql
explain (analyze, buffers)
select h.id from public.market_price_history h join public.market_listings ml on ml.id = h.market_listing_id
 where h.kind = 'apparition' and h.detected_at >= now() - interval '30 days'
   and (h.detected_at, h.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
   and public.unaccent(lower(h.city)) = public.unaccent(lower('Cologny')) and h.new_price > 0
   and ml.status in ('active', 'price_reduced') and ml.quality_score >= 50
 order by h.detected_at desc, h.id desc limit 30;
```

Expected : `Index Scan using idx_mph_evenements`, exécution < 1 s.

- [ ] **Step 4 : En cas de panne d'une collecte causée par les déclencheurs** (sur accord de Julien seulement) : `alter table public.market_listings disable trigger trg_ml_historique_maj;` rend la collecte à son état d'avant sans rien perdre d'autre que l'historique de la période ; le signaler, puis corriger par une migration.

- [ ] **Step 5** : proposer à Julien de passer l'étape 1b à « fait » dans la feuille de route (c'est lui qui l'écrit).

---

## En attente (hors périmètre, vu en chemin — rien n'est fait sans accord)

1. **Effet de 1b sur trois lecteurs `status = 'active'`** : le `search_listings` du copilote WhatsApp (`_shared/whatsapp-actions.ts`, `execSearchListings`) exclut déjà les 1 614 ventes en baisse et exclura les locations en baisse ; la vue matérialisée `market_rent_stats` et `flatfox_active_count_refresh()` aussi. Un `.in('status', ['active','price_reduced'])` suffit côté copilote (les index partiels `idx_ml_active_tx_canton_type` et `idx_ml_city_trgm` couvrent ce prédicat).
2. **`days_on_market` est encore lu ailleurs** (0 sur toutes les ventes RealAdvisor) : l'atelier (`useAtelierMatching.ts`, `daysOnMarket` — fichier du lot 1a) et le catalogue d'« Aujourd'hui » (`PageCatalogue.tsx:155`). Ou : écrire la colonne dans `realadvisor-sync`.
3. **Le comptage de sécurité de `runSweep`** (`count: 'exact'`, 6 s mesurées sous un timeout de 8 s) frôle l'échec : jours `safety_skipped` le 11.09 et le 17.09. Le remplacer par le compte du run lui-même.
4. « Chaque ligne dit s'il existe des acheteurs compatibles » (cahier, pige) : relève de « Qui pour ce bien ? », étape 2.
5. Le segment par défaut de l'agence (Genève > 5 MCHF) ou un réglage par agent : la décision proposée est « aucun » ; seule la valeur initiale de `recherche.jetons` changerait.
6. Le courtier dans les lignes du flux (`visit_contact_name`, RealAdvisor) : module « Pige », hors étape 1b.
7. Des flux « Hausses » et « De retour » : l'historique les enregistre déjà (`hausse`, `retour`), l'écran ne les montre pas.
8. Les signaux du marché dans le point du matin et « Aujourd'hui » : étape 4.
9. « Ce qui a bougé » sur mobile : la Recherche n'existe qu'au bureau.
10. Rétention de `market_price_history` (~2 M lignes par an estimées).
11. `flatfox_sync_runs.total_upserted` dépasse `total_expected` (35 983 contre 35 931 le 21.09) : double comptage aux bornes de pages quand le catalogue bouge pendant la marche arrière.
12. Les 27 annonces `megga-demo` vivantes dans `market_listings` apparaissent dans le marché comme de vraies annonces.
13. Une annonce RealAdvisor republiée sous un nouvel identifiant apparaît comme « nouvelle » : identité unique des biens, P1.
14. `docs/system-map.md` §4 dit encore « RealAdvisor via `market-scraper(-batch)` » : c'est `realadvisor-sync`.

## Questions

1. **Le balayage Flatfox (Task 2, Task 5, décision 12) entre-t-il dans l'étape 1b ?** Il est en panne muette depuis le 05.09.2026 : 12 492 annonces Flatfox « actives » n'existent plus, et sans lui « Retirés » ne montrera AUCUN retrait de location. Le corriger demande un rattrapage en production à la fusion (ces ~12 500 annonces passent `removed`, sans date, avant la pose des déclencheurs), une RPC de balayage par lots et deux modifications de `flatfox-sync`. Proposé : oui. Si non : ne pas créer la migration `…145000`, sauter la Task 5, retirer le bloc correspondant des deux specs, et « Retirés » ne portera que RealAdvisor.
