# Matching · lot C, un matching qui explique et qui s'inverse — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Étape 2 de la feuille de route verrouillée : le moteur note trois critères de plus — chambres, état, off-market — là où la donnée existe (sinon « non évalué », sans effet sur la note) ; l'agent pose l'off-market d'un mandat par un interrupteur ; le fil dit « pourquoi maintenant » (nouveau sur le marché, prix baissé, nouveau mandat) et fait passer ces lignes devant à score égal ; et « Qui pour ce bien ? » répond depuis un bien : ses acquéreurs compatibles, puis les anciens prospects notés à la demande, réactivables en un clic.

**Architecture :** Le moteur (`_shared/matching-normalize.ts`) gagne trois axes redistribués SANS toucher au contrat des `reasons` (cinq clés, lu par l'atelier) ; l'échelle reste ancrée sur le barème historique, de sorte qu'une recherche sans les nouveaux critères garde exactement sa note (éprouvé sur 20 000 cas contre le moteur actuel). Une migration ajoute `properties.off_market` (et son trigger de renotation), rend chambres et années dans le pré-filtre `match_candidate_listings`, et crée la RPC `matching_fil_marche_resume()` (comptes « nouveaux » et « en baisse »). « Qui pour ce bien ? » passe par deux modes de l'edge `matching-engine` (`prospects`, en lecture seule, et `reactiver-prospect`) sur un module pur `_shared/matching-prospects.ts`. Côté écran : les champs de la fiche contact, l'interrupteur du bien (fiche et « Nouveau bien »), un module pur `filSignaux.ts`, les lignes de critères du fil, et un panneau `FilQuiPourCeBien`.

**Tech Stack :** React 19 + TypeScript, TanStack Query v5, react-i18next (FR/DE/EN/IT), Supabase (SQL, triggers, RLS, PostgREST, edge Deno), Vitest, jetons MEGGA X.

**Conceptions :** [boucle chez l'agent](../specs/2026-09-21-matching-boucle-agent-design.md) §4.1, §4.2, §5, §7 (lot C), §10 n° 6 ; [fil de matchs](../specs/2026-09-17-matching-fil-design.md) §3, §4. **Feuille de route :** [étape 2](../feuille-de-route.md). **Lots précédents** (commités, non fusionnés) : lots 1, 2 et A (PR #1339), lot B et pige (branche `megga/matching-boucle-et-pige`) — le code du dépôt fait foi.

---

## Règles de ce chantier

- **Branche `megga/matching-lot-c`**, partie de `megga/matching-boucle-et-pige` (1a et 1b commités). **Commits : AU SIGNAL de Julien seulement** (« committe »), un commit PAR SUJET, jamais de push. Les « Point de commit » ne s'exécutent pas sans ce signal.
- **Fusion : à la fin** (Julien, 22.09.2026). La migration de ce lot s'appelle `20260922160000_matching_explique.sql` : après toutes celles des lots précédents. Le jour de la fusion finale, toutes les migrations des lots sont redatées à ce jour, dans leur ordre (date-guard de `deploy.yml`).
- ⛔ **Aucune migration de ce lot ne change le type de retour d'une fonction qu'une migration du même jour crée par `CREATE OR REPLACE`.** Le date-guard rejoue chaque migration du jour à CHAQUE push ; la migration du lot 2 (`…_matching_fil_marche.sql`) recréerait `matching_fil_marche()` à quatre colonnes par-dessus une version à six, et échouerait sur `cannot change return type of existing function` — `set -e` emporterait les migrations suivantes et les edges. D'où une RPC NEUVE, `matching_fil_marche_resume()`, et l'ancienne retirée APRÈS elle dans l'ordre des fichiers (son rejeu la recrée, le nôtre la retire de nouveau).
- **Production : aucune écriture.** Toutes les requêtes de production de ce plan sont en lecture seule.
- **Grammaire MEGGA X** dans `src/components/matching-fil/` (cliquet `{ hors: 0, total: 0 }`, `megga-x-grammar.spec.ts`) : aucun littéral de rayon, d'espacement ou de taille de texte — `var(--crm-radius-*)`, `var(--crm-space-*)`, `var(--crm-text-*)`, `0`, ou `calc()` de variables ; largeurs et hauteurs en pixels permises. Aucune couleur en dur (`couleur-barreaux.spec.ts` : palette `sp.*`, `encreAccent`, `teinteEcart`, `teinteTenu`), graisse ≤ 600, pas de capitales CSS, aucune chaîne affichée hors `t()`. L'élément ACTIF porte l'accent.
- **i18n** : fichiers `src/i18n/locales/*/{matching,contacts,listings,common}.json` au format exact `json.dumps(d, ensure_ascii=False, indent=2) + '\n'`, modifiés par script python qui vérifie ce format D'ABORD et n'écrit que ses propres clés. Aucun tiret cadratin ni demi-cadratin, aucun ß, l'italien au « Lei ». « Off-market » ne se traduit pas (identique dans les quatre langues, comme `fiche.offMarket`). ⚠ Le cliquet `i18n:coverage:ci` refuse une valeur DE ou IT identique à l'EN et différente du FR.
- **Rien ne sort vers le client.** `tests/unit/matching-sans-sortie.spec.ts` reste vert : la seule fonction serveur que le matching appelle est `matching-engine`. Réactiver un ancien prospect ne lui écrit rien.
- **Les `reasons` du moteur ne changent pas de forme** : cinq clés (`budget`, `zone`, `type`, `rooms`, `features`), lues par l'atelier en production, `useMatching`, `focus_top_matches` et trois specs (`rent-position-scoring.test.ts`, `matching-price-drop.spec.ts`, `matching-engine-hardening.spec.ts`). Les trois critères du lot C s'expliquent dans le fil, sur les faits.
- **Surfaces de PRODUCTION touchées** (elles partent à la fusion) : le moteur (ses notes ne bougent que pour une recherche qui pose un nouveau critère), la carte « Critères » de la fiche contact, la fiche d'un bien (pastille et bloc Diffusion), l'étape Mandat et le pied de « Nouveau bien ». Le fil, lui, ne vit que sur le banc jusqu'au lot E. **L'atelier ne change pas.**
- **Tests : ciblés et SEULS** — jamais la suite complète en parallèle de `tsc` ou `eslint` ; la suite complète seule, à la fin (Task 15). Échecs locaux connus, hors de ce lot : `mail/imap.test.ts`, `mail/mime-parse.test.ts` (`npm:postal-mime`), `safe-internal-path.spec.ts`.
- **Aucun export mort** (`npm run lint:deadcode`, `src/` seulement) : une fonction seulement lue par une spec n'est pas exportée.
- **Banc** : `http://localhost:5173/dev/crm?entree=/dashboard/matching` (serveur déjà lancé, HMR). Le banc ne note pas (`src/` ne charge pas le barème Deno) : ses notes sont calculées et confrontées au vrai moteur par une spec.
- **Décisions attendues de Julien** : ce plan applique la proposition de la conception pour les « anciens prospects » (§10 n° 6) et les seuils des signaux (3, 14 et 7 jours) ; il modifie deux textes de « Nouveau bien » validés le 16.09.2026 (D6). Changer l'un ou l'autre ne demande que des constantes et des traductions.

## Décisions de ce plan

1. **Les nouveaux critères de l'acheteur** — trois clés de `client_searches.criteria`, écrites par la carte « Critères » de la fiche contact : `bedrooms_min` (entier ≥ 1), `condition_min` (`'good'` | `'renovated'` | `'new'`), `off_market_only` (`true`). ⚠ `buildSearchCriteria` reconstruit l'objet de zéro et JETTE toute clé qu'il ne connaît pas : sans lui, la fiche effacerait ces critères au premier enregistrement. Le formulaire de création (`NewContactModal`) et l'extraction WhatsApp (`mapCriteria`) ne les portent pas (« En attente ») : la fiche les complète.
2. **Trois axes au moteur, jamais une 6ᵉ clé `reasons`** — `bedrooms` (poids 10), `condition` (8), `offMarket` (10), ajoutés à la redistribution. ⛔ **L'échelle reste ancrée sur le barème historique** : `scale = (somme des six poids historiques) / poids vivants`. Rapportée à la somme de TOUS les poids (128), une recherche sans les nouveaux critères aurait vu chacune de ses notes gonfler de 28 %. **Une donnée absente rend l'axe INACTIF** : il sort du dénominateur, la note ne bouge pas — « le score dit ce qu'il sait » (§4.1). ⚠ C'est un choix différent de celui des pièces et de la surface, que le moteur compte à 0 quand elles manquent ; il n'est pas étendu à eux (leurs notes de production changeraient).
3. **Chambres** — `bedrooms` du bien ; ⛔ 0 vaut « inconnu » : le wizard l'écrit pour « non renseigné » (`useWizardDraft.ts`). Tenu à partir du minimum ; une chambre de moins : 0,5 ; deux et plus : 0. Mesuré le 22.09.2026 : 27 annonces actives du marché sur 98 107 portent `bedrooms`, 6 mandats sur 6 : l'axe sera presque toujours « non évalué » sur le marché.
4. **État** — quatre rangs : `to_renovate` < `good` < `renovated` < `new`. Un mandat : `condition` saisi (formulaire du bien ; 0 sur 6 en production). Sinon, et pour le marché (qui n'a pas de colonne `condition`) : déduit des années qui DISENT quelque chose — neuf si construit il y a 5 ans au plus (ou en chantier, 5 ans au plus dans le futur), rénové si rénové il y a 10 ans au plus. ⛔ Jamais « bon état » ni « à rénover » d'une date. Tenu au rang voulu ou mieux ; un rang en dessous : 0,5 ; au-delà : 0. L'année de référence est celle de `maintenant`, cinquième paramètre de `calculateScoreV2` (`Date.now()` par défaut, figé par les tests).
5. **Off-market** — nouvelle colonne `properties.off_market boolean not null default false`, posée par l'agent (décision de Julien du 22.09.2026 : aucune donnée existante ne le disait — tout mandat actif porte `published_at`, et la diffusion vers les portails n'est pas en service). Une annonce du marché est publique par définition : l'axe y est évalué, et manqué. Un mandat qui passe off-market (ou redevient public) est renoté comme pour un changement de prix (trigger `trg_property_off_market`).
6. **« Réseau Off-market » ne fait plus un brouillon.** Aujourd'hui, « Enregistrer sans publier » enregistre en `draft`, et le texte de fin dit « enregistré Off-market ». Or un brouillon n'est JAMAIS noté (le moteur ne lit que les biens `active`) : un bien « off-market » n'était proposé à aucun acheteur, le contraire d'un réseau off-market. Le bloc « Diffusion » de l'étape Mandat devient le CHOIX (deux cartes : « Publier l'annonce » / « Réseau Off-market ») ; le bouton principal met le bien en service (`active`) avec `off_market` = ce choix, sous le libellé « Publier l'annonce » ou « Proposer en Off-market » ; le bouton secondaire devient « Enregistrer le brouillon ». Sur la fiche : la pastille « Off-market » lit `off_market` (plus `!published_at`), le bloc Diffusion porte « Passer en Off-market » / « Rendre public », un brouillon garde « Diffuser ». ⚠ Deux textes validés par Julien le 16.09.2026 changent (« Enregistrer sans publier », « est enregistré Off-market ») : à relire par lui.
7. **Signaux « pourquoi maintenant »** (§4.1) — calculés à la lecture, module pur `filSignaux.ts` : **baisse** (une annonce dont le prix courant est sous son premier prix, baisse datée par `price_reduced_at` dans les 14 derniers jours ; montant = premier prix − prix courant), **nouveau** (une annonce vue pour la première fois il y a 3 jours au plus), **mandat** (un mandat signé ou mis en service il y a 7 jours au plus : la plus récente de `mandate_signed_at` et `published_at` — `mandate_signed_at` n'est posé sur aucun mandat de production au 22.09.2026). Priorité : la baisse depuis la proposition (lot B) > baisse > nouveau > mandat. **À score égal, ce qui porte un signal passe devant** : les matchs d'un bien, les groupes « Vos biens », les lignes « Marché », et les biens d'une sélection du marché. La ligne « Marché » compte ses annonces nouvelles et en baisse côté serveur (`matching_fil_marche_resume`), aux MÊMES seuils, confrontés par une spec.
8. **« Qui pour ce bien ? »** (§4.2) — l'en-tête d'un groupe « Vos biens » devient une ligne du fil (clé `bien:<id>`, un `role="option"` dans l'ordre de ↑/↓ ; la ligne choisie par défaut reste le premier MATCH). Son panneau : **Acquéreurs compatibles** (les matchs de ce bien connus du fil : à proposer, reportés, proposés, intéressés, visite planifiée, refusés — par score, avec leur état) ; **Anciens prospects**, notés À LA DEMANDE par `matching-engine` (mode `prospects`, lecture seule) : les recherches CLOSES (`is_active = false`) depuis plus de 90 jours (`updated_at`), ou d'un acheteur dont un deal est perdu (`stage = 'lost'`, `transactions.updated_at` dans les 24 derniers mois), sans aucun match sur ce bien, au seuil du moteur, 20 au plus, par score. **Réactiver** (un clic, mode `reactiver-prospect`) renote (409 sous le seuil), rouvre la recherche, crée le match `suggested` par la même RPC d'insertion que le moteur, et écrit UNE ligne `prospect_reactive` au journal. Les prescripteurs attendent le modèle relationnel (étape 6) ; la fiche du bien, la fiche d'une annonce et l'ouverture à la création d'un mandat sont des surfaces du lot D (étape 4). ⚠ Rouvrir une recherche ne relance pas le moteur (`on_search_criteria_updated` ne part que sur un changement de critères) : ses autres biens arrivent au scan de la nuit (`daily-matching-scan`). ⚠ Le pont `sync_contact_client_search` referme une recherche au prochain enregistrement d'une fiche SANS critères — défaut connu, déjà en « En attente » depuis le lot B.
9. **Journal** : `prospect_reactive` (edge : `actor_kind 'user'`, l'agent en `actor_id`, catégorie `contact`), `bien_off_market` et `bien_rendu_public` (fiche du bien, catégorie `bien`). Libellés dans `common:audit.action`, rangés par la cloche (`KIND_PAR_ACTION`).
10. **Le banc** : un mandat neuf et off-market (`p3`, Florissant), une acheteuse qui pose les trois critères (`c11` Anastasia Volkova), deux annonces à signal, et deux anciens prospects (`c12` Philippe Rey, recherche close depuis 120 jours ; `c13` Nathalie Gerber, deal perdu il y a 150 jours). Notes calculées par le vrai moteur, confrontées par `banc-matching-explique.spec.ts`. ⚠ `published_at` de `p1` et `p2` valait 5 et 12,5 JOURS (`ilYA(120)` est en heures) : `p1` aurait porté « Nouveau mandat ». Ils passent à 120 et 300 jours, comme leurs mandats.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md` (modifié) | §13, les précisions de ce plan |
| `supabase/functions/_shared/matching-normalize.ts` (modifié) | Trois axes, `etatDuBien`, `axesComplementaires`, échelle ancrée |
| `tests/unit/matching-criteres-explique.spec.ts` (créé) | Le moteur du lot C, et son invariance |
| `supabase/migrations/20260922160000_matching_explique.sql` (créé) | `off_market`, son trigger, `match_candidate_listings`, `matching_fil_marche_resume` |
| `src/types/database.ts` (modifié) | `properties.off_market`, les deux RPC |
| `tests/backend/matching-explique.spec.ts` (créé), `tests/backend/matching-fil-marche.spec.ts` (modifié) | La migration contre `supabase start` (CI) |
| `supabase/functions/matching-engine/index.ts` (modifié) | Colonnes lues ; modes `prospects` et `reactiver-prospect` |
| `supabase/functions/_shared/matching-prospects.ts` (créé), `supabase/functions/_shared/matching-renotation.ts` (modifié) | Les anciens prospects (pur) ; `annonceRetenue` exportée |
| `tests/unit/matching-prospects.spec.ts` (créé) | Ses tests |
| `src/types/contact.ts`, `src/lib/contactCriteria.ts`, `src/components/crm/contacts-pager/ContactDetailPager.tsx` (modifiés) | Les trois critères de l'acheteur |
| `tests/unit/contact-criteres-explique.spec.ts` (créé) | Leur aller-retour |
| `src/hooks/useProperties.ts`, `src/components/crm-wizard/tokens.ts`, `src/components/crm-wizard/useWizardDraft.ts`, `src/components/crm-wizard/usePublierWizard.ts`, `src/components/crm/biens/nouveau/EtapeMandat.tsx`, `src/components/crm/biens/nouveau/NouveauBien.tsx`, `src/pages/agent/ListingDetailPage.tsx` (modifiés) | L'interrupteur Off-market |
| `tests/unit/off-market-mandat.spec.ts` (créé) | L'écriture de l'interrupteur |
| `src/components/matching-fil/filModele.ts`, `filValeurs.ts` (modifiés), `filSignaux.ts` (créé) | Lignes chambres, état, off-market ; signaux ; ordre à score égal ; clé `bien:` |
| `tests/unit/matching-fil-modele.spec.ts` (modifié), `tests/unit/matching-fil-signaux.spec.ts` (créé) | Leurs tests, confrontés au moteur et à la migration |
| `src/hooks/useMatchingFil.ts`, `src/hooks/useSelectionMarche.ts` (modifiés), `src/hooks/useAnciensProspects.ts` (créé) | Lectures ; anciens prospects et réactivation |
| `src/components/matching-fil/{filAffichage.ts,FilListe.tsx,FilSelection.tsx,FilPanneau.tsx,MatchingFil.tsx}` (modifiés), `FilQuiPourCeBien.tsx` (créé) | L'écran |
| `src/i18n/locales/{fr,de,en,it}/{matching,contacts,listings,common}.json` (modifiés) | `fil.*`, `fiche.crit.*`, `nouveauBien.*`/`fiche.*`, `audit.action.*` |
| `src/hooks/useAgentNotifications.ts` (modifié) | Trois actions rangées |
| `src/pages/dev/crmFixtures.ts` (modifié) | Le banc du lot C |
| `tests/unit/banc-matching-explique.spec.ts` (créé) | Ses notes confrontées au vrai moteur |
| `docs/system-map.md`, `.claude-flow/knowledge/megga-memory.seed.json`, `docs/schema.md`, `CLAUDE.md`, `docs/superpowers/feuille-de-route.md` (modifiés) | Carte, cerveau, schéma, état |

---

### Task 0 : Consigner les décisions du lot C dans la conception

**Files :** Modify `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`

- [ ] **Step 1 : Ajouter le §13 à la fin du fichier**

```markdown

## 13. Précisions du plan du lot C (22.09.2026)

Plan : [2026-09-22-matching-lot-c-explique-inverse.md](../plans/2026-09-22-matching-lot-c-explique-inverse.md).

- **Trois axes, pas une 6ᵉ clé `reasons`.** Chambres (poids 10), état (8), off-market (10) entrent dans la
  redistribution du moteur ; l'échelle reste ancrée sur le barème des six axes historiques, si bien qu'une
  recherche sans ces critères garde exactement sa note. Un critère que le bien ne renseigne pas sort du
  dénominateur. Le fil les explique sur les faits, aux mêmes règles que le moteur.
- **Critères de l'acheteur** : `bedrooms_min`, `condition_min` (`good` < `renovated` < `new`), `off_market_only`,
  posés sur la fiche contact.
- **État** : saisi sur un mandat ; sinon neuf (construit il y a 5 ans au plus) ou rénové (il y a 10 ans au plus) ;
  jamais « bon état » ni « à rénover » déduit d'une date.
- **Off-market** : un interrupteur de l'agent sur le mandat (`properties.off_market`, décision de Julien du
  22.09.2026). « Réseau Off-market » met le bien en service au lieu d'en faire un brouillon, que le moteur ne note
  jamais.
- **Signaux** : baisse (14 jours), nouveau (3 jours), nouveau mandat (7 jours) ; à score égal, ils passent devant.
- **Anciens prospects** (§10 n° 6, proposition appliquée) : recherche close depuis plus de 90 jours, ou deal perdu
  dans les 24 derniers mois ; notés à la demande, 20 au plus ; « Réactiver » rouvre la recherche et crée le match.
- **Accès** : l'en-tête d'un groupe « Vos biens » du fil. La fiche du bien et celle d'une annonce : lot D.
```

- [ ] **Step 2 : Point de commit (au signal de Julien)**

```bash
git add docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md
git commit -m "docs(matching): les précisions du lot C dans la conception de la boucle"
```

---

### Task 1 : Le moteur — chambres, état, off-market, et une échelle ancrée

**Files :**
- Modify : `supabase/functions/_shared/matching-normalize.ts`
- Test : `tests/unit/matching-criteres-explique.spec.ts` (créé)

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/matching-criteres-explique.spec.ts` :

```ts
/**
 * Le moteur du lot C : chambres, état, off-market (conception de la boucle, §4.1 et §13). Un critère que le bien
 * ne renseigne pas sort du dénominateur — le score dit ce qu'il sait ; une recherche sans ces critères garde
 * EXACTEMENT sa note ; et `reasons` garde ses cinq clés, que l'atelier lit.
 */
import { describe, expect, it } from 'vitest'
import {
  axesComplementaires, calculateScoreV2, DEFAULT_SCORING_CONFIG, etatDuBien, parseScoringConfig,
} from '../../supabase/functions/_shared/matching-normalize'

/** Le 22.09.2026 : l'année de référence de l'état. */
const T = Date.UTC(2026, 8, 22)
const BIEN = { price: 1_400_000, type: 'apartment', canton: 'GE', city: 'Genève', rooms: 4.5, surface_m2: 110, features: ['Balcon'] }
const RECHERCHE = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 1_500_000, rooms_min: 4 }
const note = (bien: Record<string, unknown>, criteres: Record<string, unknown>) =>
  calculateScoreV2(bien, criteres, DEFAULT_SCORING_CONFIG, null, T)

describe('etatDuBien', () => {
  it("lit l'état saisi sur un mandat, avant toute année", () => {
    expect(etatDuBien({ condition: 'good', year_built: 2024 }, 2026)).toEqual({ etat: 'good', source: 'saisi', annee: null })
  })
  it('déduit « neuf » d’une construction de 5 ans au plus, chantier compris', () => {
    expect(etatDuBien({ year_built: 2021 }, 2026)).toEqual({ etat: 'new', source: 'construction', annee: 2021 })
    expect(etatDuBien({ year_built: 2031 }, 2026)).toEqual({ etat: 'new', source: 'construction', annee: 2031 })
    expect(etatDuBien({ year_built: 2020 }, 2026)).toBeNull()
    expect(etatDuBien({ year_built: 2032 }, 2026)).toBeNull()
  })
  it('déduit « rénové » d’une rénovation de 10 ans au plus, jamais d’une rénovation future', () => {
    expect(etatDuBien({ year_built: 1968, year_renovated: 2016 }, 2026)).toEqual({ etat: 'renovated', source: 'renovation', annee: 2016 })
    expect(etatDuBien({ year_renovated: 2015 }, 2026)).toBeNull()
    expect(etatDuBien({ year_renovated: 2027 }, 2026)).toBeNull()
  })
  it('ne déduit jamais « bon état » ni « à rénover » d’une date, et ignore un état hors vocabulaire', () => {
    expect(etatDuBien({ year_built: 1968 }, 2026)).toBeNull()
    expect(etatDuBien({ condition: 'excellent' }, 2026)).toBeNull()
  })
})

describe('axesComplementaires', () => {
  const tout = { bedrooms_min: 3, condition_min: 'renovated', off_market_only: true }
  it('un critère non posé est inactif', () => {
    const a = axesComplementaires({ bedrooms: 3, condition: 'new', off_market: true }, {}, T)
    expect([a.chambres.active, a.etat.active, a.offMarket.active]).toEqual([false, false, false])
  })
  it('chambres : tenu, à moitié, pas tenu ; 0 et absent ne sont pas évalués', () => {
    const f = (bedrooms: unknown) => axesComplementaires({ bedrooms }, tout, T).chambres
    expect(f(3)).toMatchObject({ active: true, frac: 1 })
    expect(f(2)).toMatchObject({ active: true, frac: 0.5 })
    expect(f(1)).toMatchObject({ active: true, frac: 0 })
    expect(f(0).active).toBe(false)
    expect(f(null).active).toBe(false)
  })
  it('état : le rang voulu ou mieux tient, un rang en dessous à moitié', () => {
    const f = (champs: Record<string, unknown>) => axesComplementaires(champs, tout, T).etat
    expect(f({ condition: 'new' })).toMatchObject({ active: true, frac: 1 })
    expect(f({ condition: 'renovated' })).toMatchObject({ active: true, frac: 1 })
    expect(f({ condition: 'good' })).toMatchObject({ active: true, frac: 0.5 })
    expect(f({ condition: 'to_renovate' })).toMatchObject({ active: true, frac: 0 })
    expect(f({ year_built: 1968 }).active).toBe(false)
  })
  it('off-market : un mandat off-market tient ; une annonce du marché, publique, est évaluée et manque', () => {
    expect(axesComplementaires({ off_market: true }, tout, T).offMarket).toMatchObject({ active: true, frac: 1 })
    expect(axesComplementaires({ off_market: false }, tout, T).offMarket).toMatchObject({ active: true, frac: 0 })
    expect(axesComplementaires({ status: 'active' }, tout, T).offMarket).toMatchObject({ active: true, frac: 0 })
  })
})

describe('calculateScoreV2 et le lot C', () => {
  const complet = { ...BIEN, bedrooms: 3, condition: 'renovated', off_market: true }
  const exigeant = { ...RECHERCHE, bedrooms_min: 3, condition_min: 'renovated', off_market_only: true }

  it('une recherche SANS ces critères garde sa note, même sur un bien qui les renseigne', () => {
    expect(note(complet, RECHERCHE)).toEqual(note(BIEN, RECHERCHE))
  })
  it('un critère que le bien ne renseigne pas ne change pas la note', () => {
    const avant = note(BIEN, RECHERCHE).total
    expect(note(BIEN, { ...RECHERCHE, bedrooms_min: 3 }).total).toBe(avant)
    expect(note({ ...BIEN, bedrooms: 0 }, { ...RECHERCHE, bedrooms_min: 3 }).total).toBe(avant)
    expect(note({ ...BIEN, year_built: 1968 }, { ...RECHERCHE, condition_min: 'renovated' }).total).toBe(avant)
  })
  it('tout tenu : 100 ; un critère manqué prend SA part, sur les poids vivants', () => {
    expect(note(complet, exigeant).total).toBe(100)
    // Poids vivants : 32 + 24 + 12 + 12 + 10 + 8 + 10 = 108. Off-market manqué : 10 / 108 → 91.
    expect(note({ ...complet, off_market: false }, exigeant).total).toBe(91)
    expect(note({ ...complet, bedrooms: 2 }, exigeant).total).toBe(95)
    expect(note({ ...complet, condition: 'good' }, exigeant).total).toBe(96)
  })
  it('reasons garde ses cinq clés', () => {
    const r = note({ ...BIEN, bedrooms: 3 }, { ...RECHERCHE, bedrooms_min: 4, off_market_only: true }).reasons
    expect(Object.keys(r).sort()).toEqual(['budget', 'features', 'rooms', 'type', 'zone'])
  })
  it('une configuration de production sans les nouveaux poids les reçoit par défaut', () => {
    const cfg = parseScoringConfig(JSON.stringify({ weights: { price: 32, zone: 24, type: 12, rooms: 12, surface: 10, features: 10 }, threshold: 55, version: 3 }))
    expect([cfg.weights.bedrooms, cfg.weights.condition, cfg.weights.offMarket]).toEqual([10, 8, 10])
  })
})
```

- [ ] **Step 2 : Lancer le test, le voir échouer**

Run : `npx vitest run tests/unit/matching-criteres-explique.spec.ts`
Expected : FAIL (`axesComplementaires` et `etatDuBien` ne sont pas exportés).

- [ ] **Step 3 : Les poids (`matching-normalize.ts`)**

Remplacer :

```ts
export interface ScoringConfig {
  weights: { price: number; zone: number; type: number; rooms: number; surface: number; features: number; pricePosition: number; priceDrop: number }
```

par :

```ts
export interface ScoringConfig {
  weights: {
    price: number; zone: number; type: number; rooms: number; surface: number; features: number
    /** Lot C : chambres, état, off-market — actifs quand la recherche les pose ET que le bien les renseigne. */
    bedrooms: number; condition: number; offMarket: number
    pricePosition: number; priceDrop: number
  }
```

et, dans `DEFAULT_SCORING_CONFIG` :

```ts
  weights: { price: 32, zone: 24, type: 12, rooms: 12, surface: 10, features: 10, pricePosition: 7, priceDrop: 5 }, // 100 = barème redistribué ; 7 et 5 = BONUS additifs (hors redistribution)
```

par :

```ts
  // 100 = le barème des six axes historiques, redistribué ; chambres, état et off-market (lot C) y PRENNENT
  // leur part quand ils sont actifs ; 7 et 5 = BONUS additifs (hors redistribution).
  weights: { price: 32, zone: 24, type: 12, rooms: 12, surface: 10, features: 10, bedrooms: 10, condition: 8, offMarket: 10, pricePosition: 7, priceDrop: 5 },
```

- [ ] **Step 4 : L'état du bien, avant la configuration**

Juste avant la ligne `// ─── Config de scoring (poids/seuil), surchargée par app_config ─────────────`, insérer :

```ts
// ─── État du bien (lot C) ────────────────────────────────────────────────────
/** Les états d'un bien, du moins bon au meilleur : l'index est le RANG qui se compare. */
export const ETATS_BIEN = ['to_renovate', 'good', 'renovated', 'new'] as const
export type EtatBien = (typeof ETATS_BIEN)[number]
/** Neuf : construit il y a 5 ans au plus, ou en chantier. Rénové : rénové il y a 10 ans au plus. */
export const ANS_NEUF = 5
export const ANS_RENOVE = 10
/** Au-delà, une année de construction future est une saisie fautive, pas un chantier. */
const ANS_CHANTIER = 5

/** L'état connu d'un bien, et d'où il vient : saisi par l'agent (mandat), ou déduit d'une année. */
export interface EtatConnu {
  etat: EtatBien
  source: 'saisi' | 'construction' | 'renovation'
  annee: number | null
}

/**
 * L'état d'un bien, ou `null` s'il est INCONNU. Saisi sur un mandat (`condition`, formulaire du bien) ;
 * sinon déduit des seules années qui DISENT quelque chose : neuf, rénové. ⛔ Jamais « bon état » ni « à
 * rénover » d'une date : un immeuble de 1968 a pu être refait l'an dernier sans que l'annonce le dise.
 */
export function etatDuBien(listing: Record<string, unknown>, annee: number): EtatConnu | null {
  const saisi = listing.condition
  if (typeof saisi === 'string' && (ETATS_BIEN as readonly string[]).includes(saisi)) {
    return { etat: saisi as EtatBien, source: 'saisi', annee: null }
  }
  const construit = numOrNull(listing.year_built)
  if (construit != null && construit > 0 && construit >= annee - ANS_NEUF && construit <= annee + ANS_CHANTIER) {
    return { etat: 'new', source: 'construction', annee: construit }
  }
  const renove = numOrNull(listing.year_renovated)
  if (renove != null && renove > 0 && renove >= annee - ANS_RENOVE && renove <= annee) {
    return { etat: 'renovated', source: 'renovation', annee: renove }
  }
  return null
}

```

- [ ] **Step 5 : `calculateScoreV2` — la signature, les axes, l'échelle, le total**

Remplacer :

```ts
  rentRef: RentPosition | null = null, // précalculé par l'edge, zéro I/O ici
): ScoreResult {
```

par :

```ts
  rentRef: RentPosition | null = null, // précalculé par l'edge, zéro I/O ici
  maintenant: number = Date.now(), // l'année de référence de l'état (lot C) ; figée par les tests
): ScoreResult {
```

Remplacer :

```ts
  // ── FEATURES : actif si des features sont demandées (corrige le +10 par défaut) ──
  const features = scoreFeatures(featTokens(listing.features), wantFeats)
```

par :

```ts
  // ── FEATURES : actif si des features sont demandées (corrige le +10 par défaut) ──
  const features = scoreFeatures(featTokens(listing.features), wantFeats)

  // ── CHAMBRES, ÉTAT, OFF-MARKET (lot C) : actifs si la recherche les pose ET que le bien les renseigne ──
  const { chambres, etat, offMarket } = axesComplementaires(listing, criteria, maintenant)
```

Remplacer :

```ts
    { active: features.active, w: W.features },
  ]
  const liveWeight = axes.reduce((s, a) => s + (a.active ? a.w : 0), 0)
  const totalWeight = axes.reduce((s, a) => s + a.w, 0)
  const scale = liveWeight > 0 ? totalWeight / liveWeight : 0
```

par :

```ts
    { active: features.active, w: W.features },
    { active: chambres.active, w: W.bedrooms },
    { active: etat.active, w: W.condition },
    { active: offMarket.active, w: W.offMarket },
  ]
  const liveWeight = axes.reduce((s, a) => s + (a.active ? a.w : 0), 0)
  // ⛔ L'ÉCHELLE EST ANCRÉE SUR LE BARÈME HISTORIQUE (les six axes, 100) : les trois axes du lot C ne font que
  // PRENDRE leur part quand ils sont actifs. Rapportée à la somme de TOUS les poids (128), une recherche sans
  // eux aurait vu chacune de ses notes gonfler de 28 %.
  const bareme = W.price + W.zone + W.type + W.rooms + W.surface + W.features
  const scale = liveWeight > 0 ? bareme / liveWeight : 0
```

Remplacer :

```ts
  const featP = pts(features, W.features)
```

par :

```ts
  const featP = pts(features, W.features)
  const chambresP = pts(chambres, W.bedrooms)
  const etatP = pts(etat, W.condition)
  const offMarketP = pts(offMarket, W.offMarket)
```

Remplacer :

```ts
  const total = clamp(Math.round(priceP + zoneP + typeP + roomsP + surfaceP + featP + pricePosP + priceDropP), 0, 100)
```

par :

```ts
  const total = clamp(Math.round(
    priceP + zoneP + typeP + roomsP + surfaceP + featP + chambresP + etatP + offMarketP + pricePosP + priceDropP,
  ), 0, 100)
```

- [ ] **Step 6 : Les trois axes, après `scoreFeatures`**

Remplacer `interface Axis { active: boolean; frac: number; detail: string }` par `export interface Axis { active: boolean; frac: number; detail: string }`, puis, juste avant `// ─── utilitaires ─────────────────────────────────────────────────────────`, insérer :

```ts
/** Chambres (lot C). ⛔ 0 n'est pas une valeur : le wizard l'écrit pour « non renseigné » (`useWizardDraft.ts`). */
function scoreChambres(chambres: number | null, min: number | null): Axis {
  if (min == null || min <= 0 || chambres == null || chambres <= 0) return { active: false, frac: 0, detail: '' }
  if (chambres >= min) return { active: true, frac: 1, detail: `${fmtNum(chambres)} chambres` }
  return { active: true, frac: Math.max(0, 1 - (min - chambres) / 2), detail: `${fmtNum(chambres)} chambres` }
}

/** État (lot C) : tenu au rang voulu ou mieux, à moitié un rang en dessous, pas au-delà. */
function scoreEtat(etat: EtatConnu | null, voulu: EtatBien | null): Axis {
  if (!voulu || !etat) return { active: false, frac: 0, detail: '' }
  const manque = ETATS_BIEN.indexOf(voulu) - ETATS_BIEN.indexOf(etat.etat)
  return { active: true, frac: manque <= 0 ? 1 : manque === 1 ? 0.5 : 0, detail: etat.etat }
}

/** Off-market (lot C) : toujours évalué — un mandat porte son interrupteur, une annonce du marché est publique. */
function scoreOffMarket(offMarket: boolean, voulu: boolean): Axis {
  if (!voulu) return { active: false, frac: 0, detail: '' }
  return { active: true, frac: offMarket ? 1 : 0, detail: offMarket ? 'Off-market' : 'Publié' }
}

/**
 * Les trois critères du lot C (conception de la boucle, §4.1) : chambres, état, off-market. Un critère que la
 * recherche ne pose pas, OU que le bien ne renseigne pas, est INACTIF : il sort du dénominateur — le score dit
 * ce qu'il sait. ⛔ Jamais une 6ᵉ clé `reasons` (contrat figé, lu par l'atelier) : le fil explique ces trois
 * critères sur les mêmes faits (`lignesCriteres`), confronté à cette fonction par `matching-fil-modele.spec.ts`.
 */
export function axesComplementaires(
  listing: Record<string, unknown>, criteria: Record<string, unknown>, maintenant: number,
): { chambres: Axis; etat: Axis; offMarket: Axis } {
  const voulu = typeof criteria.condition_min === 'string' && (ETATS_BIEN as readonly string[]).includes(criteria.condition_min)
    ? criteria.condition_min as EtatBien
    : null
  return {
    chambres: scoreChambres(numOrNull(listing.bedrooms), numOrNull(criteria.bedrooms_min)),
    etat: scoreEtat(etatDuBien(listing, new Date(maintenant).getUTCFullYear()), voulu),
    offMarket: scoreOffMarket(listing.off_market === true, criteria.off_market_only === true),
  }
}

```

Enfin, au-dessus de la signature de `calculateScoreV2`, remplacer les deux lignes de commentaire
`// listing : current_price?/price/type/canton/city/rooms/surface_m2/features` et
`// criteria : budget_min/max/zones/type/rooms_min/max/surface_min/features` par :

```ts
// listing : current_price?/price/type/canton/city/rooms/surface_m2/features, + bedrooms/condition/year_built/
//           year_renovated/off_market (lot C)
// criteria : budget_min/max/zones/type/rooms_min/max/surface_min/features, + bedrooms_min/condition_min/
//            off_market_only (lot C)
```

- [ ] **Step 7 : Lancer les tests, les voir passer — et les anciens avec**

Run : `npx vitest run tests/unit/matching-criteres-explique.spec.ts tests/unit/rent-position-scoring.test.ts tests/unit/matching-renotation.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/banc-matching-boucle.spec.ts`
Expected : PASS — les notes figées des specs existantes (89, 93, 96 ; les notes du banc de la boucle) ne bougent pas.

- [ ] **Step 8 : Vérifier le module sous Deno**

Run : `deno check supabase/functions/_shared/matching-normalize.ts supabase/functions/_shared/matching-renotation.ts`
Expected : aucune erreur.

- [ ] **Step 9 : Point de commit (au signal de Julien)**

```bash
git add supabase/functions/_shared/matching-normalize.ts tests/unit/matching-criteres-explique.spec.ts
git commit -m "feat(matching): chambres, état et off-market au moteur, sans toucher aux notes d'aujourd'hui"
```

---

### Task 2 : La migration — `off_market`, son trigger, le pré-filtre, le résumé du marché

**Files :**
- Create : `supabase/migrations/20260922160000_matching_explique.sql`
- Modify : `src/types/database.ts`
- Create : `tests/backend/matching-explique.spec.ts`
- Modify : `tests/backend/matching-fil-marche.spec.ts`

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/20260922160000_matching_explique.sql` :

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Matching · lot C : un matching qui explique et qui s'inverse (22.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.1, §4.2 et §13.
-- Plan : docs/superpowers/plans/2026-09-22-matching-lot-c-explique-inverse.md.
--
-- ⚠ REJOUABLE : le date-guard de deploy.yml rejoue chaque migration du jour à chaque push.
-- ⛔ AUCUNE FONCTION D'UNE MIGRATION ANTÉRIEURE DU MÊME JOUR N'Y CHANGE DE TYPE DE RETOUR : le rejeu de
--    `…_matching_fil_marche.sql` (lot 2) recréerait `matching_fil_marche()` par CREATE OR REPLACE, et
--    échouerait sur `cannot change return type` si on l'avait élargie ici. D'où une RPC NEUVE (4), et
--    l'ancienne retirée APRÈS elle dans l'ordre des fichiers : son rejeu la recrée, celui-ci la retire.

begin;

-- ── 1. L'off-market d'un mandat : un interrupteur de l'agent (décision de Julien, 22.09.2026) ──
-- Aucune donnée ne le disait : tout mandat actif porte `published_at` (posé à sa mise en service), et la
-- diffusion vers les portails n'est pas en service. Le moteur le note pour un acheteur qui le demande
-- (`off_market_only`) ; une annonce du marché est publique par définition.
alter table public.properties add column if not exists off_market boolean not null default false;

comment on column public.properties.off_market is
  'Mandat off-market : proposé aux seuls acheteurs de l''agence, jamais diffusé. Posé par l''agent (fiche du bien, « Nouveau bien »). Noté par matching-engine pour une recherche `off_market_only` (lot C).';

-- ── 2. Un mandat qui passe off-market, ou redevient public : le moteur le renote ──
-- Même mécanique que `trigger_matching_on_price_change` (lot B) : les matchs à proposer JAMAIS proposés sont
-- supprimés et le moteur les recrée au nouvel état ; un match qui a une histoire (`sent_at`) reste.
create or replace function public.trigger_matching_on_off_market_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  base_url text;
  svc_key text;
begin
  base_url := public.get_app_config('supabase_url');
  svc_key := public.get_app_config('service_role_key');
  -- Sans configuration, ni suppression ni appel : on ne supprime pas ce que personne ne recréera.
  if base_url is null or base_url = '' or svc_key is null or svc_key = '' then
    return NEW;
  end if;
  delete from public.matches m
   where m.property_id = NEW.id
     and m.status = 'suggested'
     and m.sent_at is null;
  perform net.http_post(
    url := base_url || '/functions/v1/matching-engine',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc_key),
    body := jsonb_build_object('mode', 'match-property', 'property_id', NEW.id, 'agency_id', NEW.agency_id)
  );
  return NEW;
end;
$function$;

revoke all on function public.trigger_matching_on_off_market_change() from public, anon, authenticated;

drop trigger if exists trg_property_off_market on public.properties;
create trigger trg_property_off_market
  after update of off_market on public.properties
  for each row
  when (NEW.status = 'active' and NEW.off_market is distinct from OLD.off_market)
  execute function public.trigger_matching_on_off_market_change();

-- ── 3. Le pré-filtre du moteur rend aussi les chambres et les années (état) ──
-- Corps et WHERE identiques à 20260709140000 ; trois colonnes de plus. DROP requis : un RETURNS TABLE ne change
-- pas par CREATE OR REPLACE. Trois consommateurs (le moteur, l'écran Recherche qui ne lit que `id`, les
-- statistiques du copilote) : une colonne de plus ne casse aucun des trois.
drop function if exists public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text);

create function public.match_candidate_listings(
  p_tx text,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_margin numeric default 0.15,
  p_cantons text[] default null,
  p_types text[] default null,
  p_min_quality integer default 50,
  p_limit integer default 400,
  p_city text default null
)
returns table(
  id uuid,
  price numeric,
  current_price numeric,
  type text,
  canton text,
  city text,
  rooms numeric,
  surface_m2 numeric,
  features jsonb,
  lat double precision,
  lng double precision,
  transaction_type text,
  status text,
  price_at_first_seen numeric,
  bedrooms integer,
  year_built integer,
  year_renovated integer
)
language sql
stable security definer
set search_path to 'public'
set statement_timeout to '15s'
as $$
  select ml.id, ml.price, ml.current_price, ml.type, ml.canton, ml.city,
         ml.rooms, ml.surface_m2, ml.features, ml.lat, ml.lng, ml.transaction_type,
         ml.status, ml.price_at_first_seen, ml.bedrooms, ml.year_built, ml.year_renovated
  from public.market_listings ml
  where ml.status in ('active', 'price_reduced')
    and ml.transaction_type = p_tx
    and ml.quality_score >= p_min_quality
    and coalesce(ml.current_price, ml.price) > 0
    and (p_budget_max is null or coalesce(ml.current_price, ml.price) <= p_budget_max * (1 + p_margin))
    and (p_budget_min is null or coalesce(ml.current_price, ml.price) >= p_budget_min * (1 - p_margin))
    and (p_cantons is null or ml.canton = any (p_cantons))
    and (p_types is null or ml.type = any (p_types))
    and (p_city is null or public.unaccent(lower(ml.city)) = public.unaccent(lower(p_city)))
  order by ml.quality_score desc nulls last, coalesce(ml.current_price, ml.price) asc
  limit greatest(coalesce(p_limit, 400), 1);
$$;

revoke all on function public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) from public, anon;
grant execute on function public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) to authenticated, service_role;

-- ── 4. Le résumé « Marché » du fil compte aussi les annonces NOUVELLES et EN BAISSE ──
-- Mêmes lignes, même ordre et mêmes vignettes que `matching_fil_marche()` (lot 2) ; deux comptes de plus, aux
-- seuils de `src/components/matching-fil/filSignaux.ts` (JOURS_NOUVEAU, JOURS_BAISSE), confrontés par
-- `matching-fil-signaux.spec.ts`. Une annonce en baisse ne compte pas aussi comme nouvelle : le fil ne lui
-- montre qu'un signal, la baisse d'abord.
create or replace function public.matching_fil_marche_resume()
returns table (
  contact_id uuid,
  nombre integer,
  meilleur_score integer,
  vignettes text[],
  nouveaux integer,
  baisses integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with retenus as (
    select m.contact_id,
           m.score,
           coalesce(
             nullif(case when jsonb_typeof(ml.photos_cf -> 0) = 'string' then ml.photos_cf ->> 0 end, ''),
             nullif(ml.photos_cf -> 0 ->> 'thumb', ''),
             nullif(ml.photos[1], '')
           ) as vignette,
           coalesce(ml.price_reduced_at > now() - interval '14 days'
             and ml.price_at_first_seen > coalesce(ml.current_price, ml.price)
             and coalesce(ml.current_price, ml.price) > 0, false) as en_baisse,
           coalesce(ml.first_seen_at > now() - interval '3 days', false) as nouveau,
           row_number() over (
             partition by m.contact_id order by m.score desc, m.created_at desc nulls last, m.id
           ) as rang
      from public.matches m
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.agency_id = public.get_user_agency_id()
       and m.status = 'suggested'
       and m.market_listing_id is not null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  )
  select r.contact_id,
         count(*)::integer,
         max(r.score)::integer,
         coalesce((array_agg(r.vignette order by r.rang) filter (where r.vignette is not null))[1:3], '{}'::text[]),
         (count(*) filter (where r.nouveau and not r.en_baisse))::integer,
         (count(*) filter (where r.en_baisse))::integer
    from retenus r
   group by r.contact_id
   order by max(r.score) desc, count(*) desc;
$$;

comment on function public.matching_fil_marche_resume() is
  'Fil de matchs (lots 2 et C) : une ligne « Marché » par acheteur — nombre de matchs du marché à traiter, meilleur score, trois vignettes, annonces nouvelles (3 jours) et en baisse (14 jours).';

revoke all on function public.matching_fil_marche_resume() from public, anon;
grant execute on function public.matching_fil_marche_resume() to authenticated;

-- L'ancienne, sans lecteur depuis ce lot. Son rejeu du jour la recrée AVANT ce fichier ; celui-ci la retire.
drop function if exists public.matching_fil_marche();

commit;
```

- [ ] **Step 2 : Vérifier qu'elle est rejouable**

Run : `npm run -s lint:migrations`
Expected : `✓ Migrations rejouables (…)` et `✓ Versions uniques (…)`.

- [ ] **Step 3 : Les types (`src/types/database.ts`)**

Dans `properties`, insérer après `neighborhood_variant: string` (Row — l'ordre alphabétique du fichier généré) :

```ts
          off_market: boolean
```

et après `neighborhood_variant?: string` dans `Insert` ET dans `Update` :

```ts
          off_market?: boolean
```

Dans `Functions`, dans le `Returns` de `match_candidate_listings`, insérer à leur place alphabétique :

```ts
          bedrooms: number
```

(après `Returns: {`, avant `canton: string`), et :

```ts
          year_built: number
          year_renovated: number
```

(après `type: string`). Remplacer le bloc `matching_fil_marche: { … }` entier par :

```ts
      matching_fil_marche_resume: {
        Args: never
        Returns: {
          baisses: number
          contact_id: string
          meilleur_score: number
          nombre: number
          nouveaux: number
          vignettes: string[]
        }[]
      }
```

- [ ] **Step 4 : La spec backend du résumé (`tests/backend/matching-fil-marche.spec.ts`)**

Elle vise désormais `matching_fil_marche_resume()`. Remplacer la première ligne du fichier par :

```ts
// Le fil de matchs, lots 2 et C : la RPC `matching_fil_marche_resume()` (migration 20260922160000), une ligne
```

remplacer `interface LigneMarche { contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] }` par :

```ts
interface LigneMarche {
  contact_id: string; nombre: number; meilleur_score: number; vignettes: string[]; nouveaux: number; baisses: number
}
```

remplacer les DEUX appels `rpc('matching_fil_marche')` par `rpc('matching_fil_marche_resume')`, et le titre `describe.skipIf(!HAS_KEYS)('matching_fil_marche — une ligne « Marché » par acheteur', () => {` par `describe.skipIf(!HAS_KEYS)('matching_fil_marche_resume — une ligne « Marché » par acheteur', () => {`. Dans le test « chaque agence ne lit que ses acheteurs », l'annonce de l'agence B est vue à l'instant (`first_seen_at` par défaut) : remplacer

```ts
    expect(deB).toEqual([{ contact_id: chezB, nombre: 1, meilleur_score: 100, vignettes: [`${IMG}/chez-b.jpg`] }])
```

par :

```ts
    expect(deB).toEqual([{ contact_id: chezB, nombre: 1, meilleur_score: 100, vignettes: [`${IMG}/chez-b.jpg`], nouveaux: 1, baisses: 0 }])
```

Enfin, avant le test « un anonyme ne l’appelle pas », ajouter :

```ts
  it('compte les annonces nouvelles (3 jours) et en baisse (14 jours) ; une baisse ne compte pas aussi comme nouvelle', async () => {
    const c = await mkContact(s.agencyAId, 'Signaux')
    const vieille = new Date(Date.now() - 10 * JOUR).toISOString()
    const neuve = await mkAnnonce('sig-neuve')
    const ancienne = await mkAnnonce('sig-ancienne')
    const enBaisse = await mkAnnonce('sig-baisse')
    const baisseVieille = await mkAnnonce('sig-baisse-vieille')
    await svc.from('market_listings').update({ first_seen_at: vieille }).in('id', [ancienne, baisseVieille])
    await svc.from('market_listings').update({
      price_at_first_seen: 1_300_000, current_price: 1_200_000, price_reduced_at: new Date(Date.now() - 2 * JOUR).toISOString(),
    }).eq('id', enBaisse)
    await svc.from('market_listings').update({
      price_at_first_seen: 1_300_000, current_price: 1_200_000, price_reduced_at: new Date(Date.now() - 20 * JOUR).toISOString(),
    }).eq('id', baisseVieille)
    for (const a of [neuve, ancienne, enBaisse, baisseVieille]) {
      const { error } = await svc.from('matches').insert({
        agency_id: s.agencyAId, contact_id: c, market_listing_id: a, score: 70, status: 'suggested', source: 'market',
      })
      if (error) throw new Error(`matches: ${error.message}`)
    }
    const l = (await lignes(s.clientA)).find((x) => x.contact_id === c)
    // `enBaisse` est aussi vue à l'instant : baisse d'abord, jamais les deux.
    expect(l).toMatchObject({ nombre: 4, nouveaux: 1, baisses: 1 })
  })
```

`mkContact(agencyId, nom)` range le contact dans `contacts`, que `afterAll` supprime ; ses matchs partent en cascade avec lui.

- [ ] **Step 5 : La spec backend de la migration**

Créer `tests/backend/matching-explique.spec.ts` :

```ts
// Matching · lot C (migration 20260922160000_matching_explique.sql).
//   E1  `properties.off_market` : faux par défaut ; un mandat ACTIF qui bascule voit supprimés ses matchs jamais
//       proposés (le moteur les recrée), pas ceux qui ont une histoire ; un brouillon qui bascule, rien.
//   E2  `match_candidate_listings` rend chambres et années.
//   E3  l'edge matching-engine, mode `prospects` : recherche close depuis plus de 90 jours, ou deal perdu ; ni une
//       recherche fermée il y a 20 jours sans deal perdu, ni un acheteur déjà sur le bien, ni une autre agence.
//   E4  mode `reactiver-prospect` : le match naît `suggested` avec la note du moteur, la recherche rouvre, UNE ligne
//       au journal ; un second appel est refusé (409) ; une autre agence ne trouve rien (404).
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const JOUR = 86_400_000
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 2_500_000, rooms_min: 5 }

async function tokenOf(client: TwoAgenciesSetup['clientA']): Promise<string> {
  const { data } = await client.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('session attendue')
  return t
}

async function invoke(jwt: string, body: unknown) {
  const res = await fetch(`${URL}/functions/v1/matching-engine`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('matching · lot C — expliqué et inversé', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const biens: string[] = []
  const deals: string[] = []

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Explique', last_name: `${nom} ${s.stamp}`, type: 'buyer', search_criteria: null,
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  /** Une recherche CLOSE, datée : insérée à la main (le pont n'en crée que d'actives). */
  const mkRechercheClose = async (agencyId: string, contactId: string, joursDepuis: number) => {
    const { data, error } = await svc.from('client_searches').insert({
      agency_id: agencyId, contact_id: contactId, criteria: CRITERES, is_active: false,
      updated_at: new Date(Date.now() - joursDepuis * JOUR).toISOString(),
    }).select('id').single()
    if (error) throw new Error(`client_searches: ${error.message}`)
    return data.id as string
  }
  // 'draft' par défaut : évite `on_property_active` (net.http_post) ; le mode `prospects` ne lit pas le statut.
  const mkBien = async (agencyId: string, tag: string, status: 'draft' | 'active' = 'draft') => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: agencyId, title: `Explique ${tag} ${s.stamp}`, type: 'apartment', status, transaction_type: 'buy',
      price: 2_350_000, rooms: 5.5, surface_m2: 168, city: 'Genève', canton: 'GE',
    }).select('id').single()
    if (error) throw new Error(`properties ${tag}: ${error.message}`)
    biens.push(data.id as string)
    return data.id as string
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé.
    if (contacts.length) await svc.from('matches').delete().in('contact_id', contacts)
    if (deals.length) await svc.from('transactions').delete().in('id', deals)
    if (contacts.length) await svc.from('client_searches').delete().in('contact_id', contacts)
    if (biens.length) await svc.from('properties').delete().in('id', biens)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('E1 — off_market : faux par défaut ; la bascule d’un mandat actif renote, celle d’un brouillon non', async () => {
    const brouillon = await mkBien(s.agencyAId, 'e1-brouillon')
    const { data: lu } = await svc.from('properties').select('off_market').eq('id', brouillon).single()
    expect((lu as { off_market: boolean }).off_market).toBe(false)

    // Le trigger ne supprime rien sans configuration pour rappeler le moteur, et le local n'en a pas : on lui en
    // donne une, INERTE (l'appel part vers un port fermé), le temps du test — comme B5b du lot B.
    const cles = ['supabase_url', 'service_role_key']
    const { data: avant } = await svc.from('app_config').select('key, value').in('key', cles)
    const precedentes = new Map(((avant ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]))
    await svc.from('app_config').upsert([
      { key: 'supabase_url', value: 'http://127.0.0.1:9' },
      { key: 'service_role_key', value: 'spec-explique-inerte' },
    ], { onConflict: 'key' })
    try {
      const actif = await mkBien(s.agencyAId, 'e1-actif', 'active')
      const c1 = await mkContact(s.agencyAId, 'E1-jamais')
      const c2 = await mkContact(s.agencyAId, 'E1-propose')
      const c3 = await mkContact(s.agencyAId, 'E1-brouillon')
      const ins = async (contactId: string, bienId: string, champs: Record<string, unknown> = {}) => {
        const { data, error } = await svc.from('matches').insert({
          agency_id: s.agencyAId, contact_id: contactId, property_id: bienId, score: 80, status: 'suggested', source: 'internal', ...champs,
        }).select('id').single()
        if (error) throw new Error(`matches: ${error.message}`)
        return data.id as string
      }
      const jamais = await ins(c1, actif)
      const propose = await ins(c2, actif, { status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
      const surBrouillon = await ins(c3, brouillon)
      await svc.from('properties').update({ off_market: true }).eq('id', actif)
      await svc.from('properties').update({ off_market: true }).eq('id', brouillon)
      const existe = async (id: string) => ((await svc.from('matches').select('id').eq('id', id)).data ?? []).length === 1
      expect(await existe(jamais), 'jamais proposé : supprimé, le moteur le recrée').toBe(false)
      expect(await existe(propose), 'proposé : il a une histoire, il reste').toBe(true)
      expect(await existe(surBrouillon), 'un brouillon n’est pas noté : rien ne bouge').toBe(true)
    } finally {
      for (const k of cles) {
        if (precedentes.has(k)) await svc.from('app_config').update({ value: precedentes.get(k) }).eq('key', k)
        else await svc.from('app_config').delete().eq('key', k)
      }
    }
  })

  it('E2 — match_candidate_listings rend chambres et années', async () => {
    const { data, error } = await svc.rpc('match_candidate_listings', { p_tx: 'buy', p_limit: 5 })
    expect(error).toBeNull()
    // CI : market_listings peut être vide → assertions par ligne.
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      expect(r).toHaveProperty('bedrooms')
      expect(r).toHaveProperty('year_built')
      expect(r).toHaveProperty('year_renovated')
    }
  })

  it('E3 — prospects : recherche close depuis 90 jours, ou deal perdu ; ni récente sans deal, ni déjà sur le bien', async () => {
    const bien = await mkBien(s.agencyAId, 'e3')
    const ancien = await mkContact(s.agencyAId, 'E3-ancien')
    await mkRechercheClose(s.agencyAId, ancien, 120)
    const recent = await mkContact(s.agencyAId, 'E3-recent')
    await mkRechercheClose(s.agencyAId, recent, 20)
    const perdu = await mkContact(s.agencyAId, 'E3-perdu')
    await mkRechercheClose(s.agencyAId, perdu, 20)
    const { data: deal, error: dErr } = await svc.from('transactions').insert({
      agency_id: s.agencyAId, stage: 'lost', contact_buyer_id: perdu,
    }).select('id').single()
    if (dErr) throw new Error(`transactions: ${dErr.message}`)
    deals.push(deal.id as string)
    const deja = await mkContact(s.agencyAId, 'E3-deja')
    await mkRechercheClose(s.agencyAId, deja, 200)
    await svc.from('matches').insert({ agency_id: s.agencyAId, contact_id: deja, property_id: bien, score: 70, status: 'ignored', source: 'internal' })

    const { status, body } = await invoke(await tokenOf(s.clientA), { mode: 'prospects', property_id: bien })
    expect(status, JSON.stringify(body)).toBe(200)
    const prospects = body.prospects as { contact_id: string; origine: string; score: number }[]
    expect(prospects.map((p) => p.contact_id).sort()).toEqual([ancien, perdu].sort())
    expect(prospects.find((p) => p.contact_id === perdu)?.origine).toBe('deal_perdu')
    expect(prospects.find((p) => p.contact_id === ancien)?.origine).toBe('recherche_close')
    for (const p of prospects) expect(p.score).toBeGreaterThanOrEqual(55)

    const etranger = await invoke(await tokenOf(s.clientB), { mode: 'prospects', property_id: bien })
    expect(etranger.status).toBe(404)
  })

  it('E4 — reactiver-prospect : le match naît, la recherche rouvre, UNE ligne au journal ; puis 409', async () => {
    const bien = await mkBien(s.agencyAId, 'e4')
    const c = await mkContact(s.agencyAId, 'E4')
    const recherche = await mkRechercheClose(s.agencyAId, c, 120)
    const etranger = await invoke(await tokenOf(s.clientB), { mode: 'reactiver-prospect', property_id: bien, client_search_id: recherche })
    expect(etranger.status).toBe(404)

    const jwt = await tokenOf(s.clientA)
    const { status, body } = await invoke(jwt, { mode: 'reactiver-prospect', property_id: bien, client_search_id: recherche, origine: 'recherche_close' })
    expect(status, JSON.stringify(body)).toBe(200)
    const { data: m } = await svc.from('matches').select('id, status, score, client_search_id, score_version').eq('id', body.match_id as string).single()
    expect(m).toMatchObject({ status: 'suggested', client_search_id: recherche, score: body.score })
    expect((m as { score_version: number | null }).score_version).not.toBeNull()
    const { data: cs } = await svc.from('client_searches').select('is_active').eq('id', recherche).single()
    expect((cs as { is_active: boolean }).is_active).toBe(true)
    const { data: j } = await svc.from('activity_events').select('actor_kind, category, metadata').eq('action', 'prospect_reactive').eq('entity_id', c)
    expect(j ?? []).toHaveLength(1)
    expect(j![0]).toMatchObject({ actor_kind: 'user', category: 'contact' })

    const encore = await invoke(jwt, { mode: 'reactiver-prospect', property_id: bien, client_search_id: recherche })
    expect(encore.status).toBe(409)
  })
})
```

- [ ] **Step 6 : Lancer la CI backend localement, si `supabase start` tourne**

Run : `npx vitest run --config vitest.backend.config.ts tests/backend/matching-explique.spec.ts tests/backend/matching-fil-marche.spec.ts tests/backend/matching-price-drop.spec.ts`
Expected : PASS avec les clés `SUPABASE_TEST_*` (E3 et E4 attendent la Task 5) ; sans elles, SKIP — c'est la CI `backend.yml` qui les joue.


- [ ] **Step 7 : Point de commit (au signal de Julien)**

```bash
git add supabase/migrations/20260922160000_matching_explique.sql src/types/database.ts tests/backend/matching-explique.spec.ts tests/backend/matching-fil-marche.spec.ts
git commit -m "feat(matching): off-market d'un mandat, pré-filtre élargi et résumé du marché avec ses signaux"
```

---

### Task 3 : Le moteur lit les nouvelles colonnes

**Files :** Modify `supabase/functions/matching-engine/index.ts`

- [ ] **Step 1 : Les colonnes du barème**

Remplacer :

```ts
const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features'
```

par :

```ts
// Lot C : chambres, état (saisi, ou déduit de l'année de construction) et l'interrupteur off-market.
const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features, bedrooms, condition, year_built, off_market'
```

et :

```ts
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score'
```

par :

```ts
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score, bedrooms, year_built, year_renovated'
```

`match_candidate_listings` rend les trois mêmes colonnes (Task 2) : les candidats du marché les portent déjà.

- [ ] **Step 2 : Vérifier sous Deno**

Run : `deno check supabase/functions/matching-engine/index.ts`
Expected : aucune erreur.

- [ ] **Step 3 : Point de commit — avec la Task 5 (même fichier)**

---

### Task 4 : Les anciens prospects — module pur

**Files :**
- Create : `supabase/functions/_shared/matching-prospects.ts`
- Modify : `supabase/functions/_shared/matching-renotation.ts` (export de `annonceRetenue`)
- Test : `tests/unit/matching-prospects.spec.ts` (créé)

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/matching-prospects.spec.ts` :

```ts
/**
 * « Qui pour ce bien ? » côté moteur (lot C) : les anciens prospects — recherche close depuis plus de 90 jours, ou
 * deal perdu dans les 24 derniers mois, sans match sur ce bien —, notés au vrai barème, derrière le pré-filtre
 * du moteur, au seuil. Module pur de l'edge `matching-engine`, modes `prospects` et `reactiver-prospect`.
 */
import { describe, expect, it } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  candidatsProspects, debutFenetreDeal, noterProspects, PROSPECTS_MAX, type RechercheClose,
} from '../../supabase/functions/_shared/matching-prospects'

const T = Date.UTC(2026, 8, 22)
const JOUR = 86_400_000
const iso = (t: number) => new Date(t).toISOString()
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 2_500_000, rooms_min: 5 }
const recherche = (id: string, contact: string, jours: number, criteria: Record<string, unknown> | null = CRITERES): RechercheClose =>
  ({ id, contact_id: contact, criteria, updated_at: iso(T - jours * JOUR) })
const MANDAT = { transaction_type: 'buy', price: 2_350_000, type: 'apartment', canton: 'GE', city: 'Genève', rooms: 5.5, surface_m2: 168, features: [] }
const sansLoyer = () => null

describe('candidatsProspects', () => {
  it('une recherche close depuis plus de 90 jours ; pas une recherche fermée il y a 20 jours sans deal perdu', () => {
    const c = candidatsProspects([recherche('r1', 'c1', 120), recherche('r2', 'c2', 20)], [], new Set(), T)
    expect(c.map((x) => [x.contact_id, x.origine])).toEqual([['c1', 'recherche_close']])
  })
  it('un deal perdu dans les 24 mois l’emporte, daté de sa perte ; au-delà, il ne compte plus', () => {
    const c = candidatsProspects(
      [recherche('r3', 'c3', 20), recherche('r4', 'c4', 20)],
      [{ contact_id: 'c3', le: iso(T - 150 * JOUR) }, { contact_id: 'c4', le: iso(T - 900 * JOUR) }],
      new Set(), T,
    )
    expect(c).toEqual([expect.objectContaining({ contact_id: 'c3', origine: 'deal_perdu', depuis: iso(T - 150 * JOUR) })])
  })
  it('écarte un acheteur déjà sur ce bien, une recherche sans critères, une date illisible', () => {
    const c = candidatsProspects(
      [recherche('r5', 'c5', 200), recherche('r6', 'c6', 200, null), { id: 'r7', contact_id: 'c7', criteria: CRITERES, updated_at: 'hier' }],
      [], new Set(['c5']), T,
    )
    expect(c).toEqual([])
  })
  it('la fenêtre des deals perdus commence 24 mois avant, au jour près', () => {
    expect(iso(debutFenetreDeal(T))).toBe('2024-09-22T00:00:00.000Z')
  })
})

describe('noterProspects', () => {
  const candidats = candidatsProspects([recherche('r1', 'c1', 120)], [], new Set(), T)
  it('note au vrai barème, au seuil du moteur', () => {
    const [p] = noterProspects(candidats, MANDAT, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)
    expect(p).toMatchObject({ contact_id: 'c1', client_search_id: 'r1', origine: 'recherche_close' })
    expect(p!.score).toBe(calculateScoreV2(MANDAT, CRITERES, DEFAULT_SCORING_CONFIG, null, T).total)
  })
  it('un mandat en location ne va pas à une recherche d’achat, et sous le seuil personne ne passe', () => {
    expect(noterProspects(candidats, { ...MANDAT, transaction_type: 'rent' }, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toEqual([])
    // ⚠ Sans le prix, cette villa de Zürich tombait PILE sur le seuil (55 : prix et pièces, redistribués) — gardée.
    expect(noterProspects(candidats, { ...MANDAT, type: 'house', city: 'Zürich', canton: 'ZH', price: 4_000_000 }, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toEqual([])
  })
  it('une annonce du marché passe par le pré-filtre du moteur (budget à 15 % près)', () => {
    const annonce = { ...MANDAT, current_price: 2_950_000, price: 2_950_000, status: 'active', quality_score: 70 }
    expect(noterProspects(candidats, annonce, true, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toEqual([])
  })
  it('garde la meilleure recherche d’un acheteur, trie par score, 20 au plus', () => {
    const faible = { ...CRITERES, rooms_min: 7 }
    const deux = candidatsProspects([recherche('r1', 'c1', 120), recherche('r1b', 'c1', 120, faible)], [], new Set(), T)
    expect(noterProspects(deux, MANDAT, false, DEFAULT_SCORING_CONFIG, sansLoyer, T).map((p) => p.client_search_id)).toEqual(['r1'])
    const beaucoup = candidatsProspects(Array.from({ length: 30 }, (_, i) => recherche(`r${i}`, `c${String(i).padStart(2, '0')}`, 120)), [], new Set(), T)
    expect(noterProspects(beaucoup, MANDAT, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toHaveLength(PROSPECTS_MAX)
  })
})
```

- [ ] **Step 2 : Le voir échouer**

Run : `npx vitest run tests/unit/matching-prospects.spec.ts`
Expected : FAIL (module absent).

- [ ] **Step 3 : Exporter `annonceRetenue`**

Dans `supabase/functions/_shared/matching-renotation.ts`, remplacer :

```ts
function annonceRetenue(a: Record<string, unknown>, criteres: Record<string, unknown>, tx: 'buy' | 'rent'): boolean {
```

par :

```ts
export function annonceRetenue(a: Record<string, unknown>, criteres: Record<string, unknown>, tx: 'buy' | 'rent'): boolean {
```

- [ ] **Step 4 : Écrire le module**

Créer `supabase/functions/_shared/matching-prospects.ts` :

```ts
// Matching — les ANCIENS PROSPECTS d'un bien (lot C, « Qui pour ce bien ? »). Fonctions PURES, comme
// matching-normalize.ts : zéro I/O, zéro API Deno — réutilisées par l'edge matching-engine (modes `prospects`
// et `reactiver-prospect`) ET par les tests vitest (Node).
//
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.2, §10 n° 6 et §13.
//
// Un ancien prospect est un acheteur dont la recherche est CLOSE (`is_active = false`) depuis plus de 90 jours,
// ou dont un deal a été perdu dans les 24 derniers mois, et qui n'a encore AUCUN match sur ce bien : un match
// écarté, refusé ou proposé dit déjà ce que l'agent en pense. Le moteur ne le note plus (il ne lit que les
// recherches actives) ; ce module le note À LA DEMANDE, au même barème, au même seuil, derrière le même
// pré-filtre qu'à la création : la transaction pour un mandat (`buildInternalRows`), `annonceRetenue` pour une
// annonce du marché.
//
// ⚠ Une recherche fermée il y a MOINS de 90 jours, sans deal perdu, n'en fait pas un : l'acheteur vient de
// s'arrêter (il a acheté ailleurs, ou il fait une pause), et le lui reproposer tout de suite serait du bruit.

import { calculateScoreV2, inferTransactionType, type MatchReasons, type ScoringConfig } from './matching-normalize.ts'
import { annonceRetenue } from './matching-renotation.ts'
import type { RentPosition } from './rent-reference.ts'

/** Une recherche close depuis plus de 90 jours fait un ancien prospect. */
export const JOURS_RECHERCHE_CLOSE = 90
/** Un deal perdu dans les 24 derniers mois fait un ancien prospect, quelle que soit la date de sa recherche. */
export const MOIS_DEAL_PERDU = 24
/** Les 20 meilleurs : au-delà, la liste ne se lit plus. */
export const PROSPECTS_MAX = 20

const JOUR = 86_400_000

/** Une recherche close, telle que l'edge la lit. */
export interface RechercheClose {
  id: string
  contact_id: string
  criteria: Record<string, unknown> | null
  /** Posé par le pont à la fermeture (`sync_contact_client_search`) : la date de la clôture, au mieux. */
  updated_at: string | null
}

/** Un deal perdu (`transactions.stage = 'lost'`) d'un acheteur, daté par sa dernière écriture. */
export interface DealPerdu { contact_id: string; le: string }

export type OrigineProspect = 'recherche_close' | 'deal_perdu'

/** Une recherche close retenue, et ce qui en fait un ancien prospect. */
export type CandidatProspect = RechercheClose & { origine: OrigineProspect; depuis: string | null }

/** Un ancien prospect noté contre le bien ; l'edge y joint son nom. */
export interface ProspectNote {
  contact_id: string
  client_search_id: string
  score: number
  reasons: MatchReasons
  origine: OrigineProspect
  /** La perte du deal, sinon la clôture de la recherche. */
  depuis: string | null
}

const temps = (iso: string | null): number => (iso ? Date.parse(iso) : Number.NaN)

/** Le début de la fenêtre des deals perdus : 24 mois avant `maintenant`, au jour près. */
export function debutFenetreDeal(maintenant: number): number {
  const d = new Date(maintenant)
  d.setUTCMonth(d.getUTCMonth() - MOIS_DEAL_PERDU)
  return d.getTime()
}

/**
 * Les recherches closes qui font un ANCIEN PROSPECT de ce bien, et pourquoi. Un deal perdu l'emporte sur la
 * date de la recherche : c'est le signe le plus fort. Une date illisible ne qualifie rien.
 */
export function candidatsProspects(
  recherches: readonly RechercheClose[],
  dealsPerdus: readonly DealPerdu[],
  dejaSurCeBien: ReadonlySet<string>,
  maintenant: number,
): CandidatProspect[] {
  const debutDeals = debutFenetreDeal(maintenant)
  const perdus = new Map<string, string>()
  for (const d of dealsPerdus) {
    const t = temps(d.le)
    if (!(t >= debutDeals && t <= maintenant)) continue
    const avant = perdus.get(d.contact_id)
    if (!avant || temps(avant) < t) perdus.set(d.contact_id, d.le)
  }
  const finClose = maintenant - JOURS_RECHERCHE_CLOSE * JOUR
  const candidats: CandidatProspect[] = []
  for (const r of recherches) {
    if (!r.criteria || dejaSurCeBien.has(r.contact_id)) continue
    const perdu = perdus.get(r.contact_id)
    if (perdu) candidats.push({ ...r, origine: 'deal_perdu', depuis: perdu })
    else if (temps(r.updated_at) <= finClose) candidats.push({ ...r, origine: 'recherche_close', depuis: r.updated_at })
  }
  return candidats
}

/**
 * Les candidats NOTÉS contre le bien : le pré-filtre du moteur, puis son barème et son seuil ; la meilleure
 * recherche par acheteur ; par score décroissant, {@link PROSPECTS_MAX} au plus.
 */
export function noterProspects(
  candidats: readonly CandidatProspect[],
  bien: Record<string, unknown>,
  marche: boolean,
  cfg: ScoringConfig,
  refLoyer: (annonce: Record<string, unknown>) => RentPosition | null,
  maintenant: number,
): ProspectNote[] {
  const meilleurs = new Map<string, ProspectNote>()
  for (const c of candidats) {
    if (!c.criteria) continue
    const tx = inferTransactionType(c.criteria)
    const retenu = marche
      ? annonceRetenue(bien, c.criteria, tx)
      : !(typeof bien.transaction_type === 'string' && bien.transaction_type !== tx)
    if (!retenu) continue
    const note = calculateScoreV2(bien, c.criteria, cfg, marche && tx === 'rent' ? refLoyer(bien) : null, maintenant)
    if (note.total < cfg.threshold) continue
    const avant = meilleurs.get(c.contact_id)
    if (avant && avant.score >= note.total) continue
    meilleurs.set(c.contact_id, {
      contact_id: c.contact_id, client_search_id: c.id, score: note.total, reasons: note.reasons, origine: c.origine, depuis: c.depuis,
    })
  }
  return [...meilleurs.values()]
    .sort((a, b) => b.score - a.score || a.contact_id.localeCompare(b.contact_id))
    .slice(0, PROSPECTS_MAX)
}
```

- [ ] **Step 5 : Les tests passent, et ceux de la renotation avec**

Run : `npx vitest run tests/unit/matching-prospects.spec.ts tests/unit/matching-renotation.spec.ts`
Expected : PASS.

Run : `deno check supabase/functions/_shared/matching-prospects.ts`
Expected : aucune erreur.

- [ ] **Step 6 : Point de commit — avec la Task 5**

---

### Task 5 : Les modes `prospects` et `reactiver-prospect`

**Files :**
- Modify : `supabase/functions/matching-engine/index.ts`
- Modify : `src/i18n/locales/{fr,de,en,it}/common.json` (`audit.action.prospect_reactive`)
- Modify : `src/hooks/useAgentNotifications.ts`

- [ ] **Step 1 : Les imports et le corps de requête**

Dans `supabase/functions/matching-engine/index.ts`, remplacer :

```ts
import {
  estUuid, fusionnerCorrection, lireCorrection, lireRefus, renoter, REFUS_MAX, tranches, type MatchARenoter,
} from '../_shared/matching-renotation.ts'
```

par :

```ts
import {
  estUuid, fusionnerCorrection, lireCorrection, lireRefus, renoter, REFUS_MAX, tranches, type MatchARenoter,
} from '../_shared/matching-renotation.ts'
import {
  candidatsProspects, debutFenetreDeal, noterProspects, type OrigineProspect, type RechercheClose,
} from '../_shared/matching-prospects.ts'
```

Remplacer :

```ts
  mode: 'match-property' | 'match-contact' | 'scan-all' | 'rescore-search'
  property_id?: string
```

par :

```ts
  mode: 'match-property' | 'match-contact' | 'scan-all' | 'rescore-search' | 'prospects' | 'reactiver-prospect'
  property_id?: string
  /** prospects, reactiver-prospect : une annonce du marché au lieu d'un mandat (lot C ; lot D pour l'écran). */
  market_listing_id?: string
  /** reactiver-prospect : pourquoi il était un ancien prospect (journal). */
  origine?: string
```

et remplacer le commentaire de `client_search_id` par :

```ts
  /** rescore-search : la recherche dont les matchs à proposer sont renotés ; reactiver-prospect : celle qu'on rouvre. */
  client_search_id?: string
```

- [ ] **Step 2 : Une référence loyer partagée**

Juste avant `async function renoterRecherche(`, insérer :

```ts
/** La position loyer d'une annonce du marché (bonus du barème) : la même pour la renotation et les prospects. */
const refLoyer = (rentIndex: RentStatsIndex) => (a: Record<string, unknown>) => rentPosition({
  canton: (a.canton as string | null) ?? null,
  type: (a.type as string | null) ?? null,
  surface_m2: numOrNull(a.surface_m2),
  loyer: numOrNull(a.current_price) ?? numOrNull(a.price),
}, rentIndex)
```

et, dans `renoterRecherche`, remplacer :

```ts
  const notes = renoter(matchs, biens, criteres, cfg, (a) => rentPosition({
    canton: (a.canton as string | null) ?? null,
    type: (a.type as string | null) ?? null,
    surface_m2: numOrNull(a.surface_m2),
    loyer: numOrNull(a.current_price) ?? numOrNull(a.price),
  }, rentIndex))
```

par :

```ts
  const notes = renoter(matchs, biens, criteres, cfg, refLoyer(rentIndex))
```

- [ ] **Step 3 : Les deux modes, après `renoterRecherche`**

Juste avant `serve(async (req) => {`, insérer :

```ts
/** Le bien visé par `prospects` et `reactiver-prospect` : un mandat OU une annonce du marché, jamais les deux. */
type CibleBien = { genre: 'mandat' | 'annonce'; id: string }

function lireCible(body: RequestBody): CibleBien | null {
  const mandat = estUuid(body.property_id)
  const annonce = estUuid(body.market_listing_id)
  if (mandat === annonce) return null
  return mandat ? { genre: 'mandat', id: body.property_id as string } : { genre: 'annonce', id: body.market_listing_id as string }
}

/** Le bien, colonnes du barème et du pré-filtre ; un mandat d'une autre agence est introuvable. */
async function lireBien(supabase: SupabaseClient, agencyId: string, cible: CibleBien): Promise<Record<string, unknown> | null> {
  const { data, error } = cible.genre === 'mandat'
    ? await supabase.from('properties').select(PROP_COLS).eq('id', cible.id).eq('agency_id', agencyId).maybeSingle()
    : await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).eq('id', cible.id).maybeSingle()
  if (error) throw error
  return (data ?? null) as Record<string, unknown> | null
}

const colonneDe = (cible: CibleBien): 'property_id' | 'market_listing_id' =>
  (cible.genre === 'mandat' ? 'property_id' : 'market_listing_id')

/**
 * `prospects` — les ANCIENS PROSPECTS d'un bien, notés À LA DEMANDE (lot C, « Qui pour ce bien ? »). Lecture
 * seule : rien n'est écrit, ni match, ni journal. Règles : `_shared/matching-prospects.ts`.
 */
async function prospectsDuBien(
  supabase: SupabaseClient, agencyId: string, body: RequestBody, cfg: ScoringConfig, rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const cible = lireCible(body)
  if (!cible) return { statut: 400, corps: { error: 'invalid_body' } }
  const bien = await lireBien(supabase, agencyId, cible)
  if (!bien) return { statut: 404, corps: { error: 'bien_not_found' } }
  const maintenant = Date.now()

  // Les recherches closes de l'agence, page par page (`max_rows` tronque en silence).
  const recherches: RechercheClose[] = []
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await supabase
      .from('client_searches')
      .select('id, contact_id, criteria, updated_at')
      .eq('agency_id', agencyId)
      .eq('is_active', false)
      .order('id')
      .range(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const page = (data ?? []) as RechercheClose[]
    recherches.push(...page)
    if (page.length < PAGE_MATCHS) break
  }
  if (recherches.length === 0) return { statut: 200, corps: { prospects: [] } }

  const { data: deals, error: dErr } = await supabase
    .from('transactions')
    .select('contact_buyer_id, updated_at')
    .eq('agency_id', agencyId)
    .eq('stage', 'lost')
    .gte('updated_at', new Date(debutFenetreDeal(maintenant)).toISOString())
    .not('contact_buyer_id', 'is', null)
  if (dErr) throw dErr
  // Tout acheteur qui a déjà un match sur ce bien, quel qu'en soit l'état : l'agent en a déjà jugé.
  const { data: deja, error: mErr } = await supabase
    .from('matches')
    .select('contact_id')
    .eq('agency_id', agencyId)
    .eq(colonneDe(cible), cible.id)
  if (mErr) throw mErr

  const candidats = candidatsProspects(
    recherches,
    ((deals ?? []) as { contact_buyer_id: string; updated_at: string }[]).map((d) => ({ contact_id: d.contact_buyer_id, le: d.updated_at })),
    new Set(((deja ?? []) as { contact_id: string }[]).map((m) => m.contact_id)),
    maintenant,
  )
  const notes = noterProspects(candidats, bien, cible.genre === 'annonce', cfg, refLoyer(rentIndex), maintenant)
  if (notes.length === 0) return { statut: 200, corps: { prospects: [] } }

  const { data: contacts, error: cErr } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('agency_id', agencyId)
    .in('id', notes.map((n) => n.contact_id))
  if (cErr) throw cErr
  const parId = new Map(((contacts ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((c) => [c.id, c]))
  const prospects = notes.flatMap((n) => {
    const c = parId.get(n.contact_id)
    // Un contact que la lecture ne rend pas (supprimé entre-temps) : on n'invente pas la ligne.
    return c ? [{
      contact_id: n.contact_id, prenom: c.first_name ?? '', nom: c.last_name ?? '', client_search_id: n.client_search_id,
      score: n.score, origine: n.origine, depuis: n.depuis,
    }] : []
  })
  return { statut: 200, corps: { prospects } }
}

/**
 * `reactiver-prospect` — un clic de l'agent (lot C) : le match naît `suggested`, avec la note du moteur, par la
 * même RPC d'insertion que lui ; la recherche ROUVRE ; UNE ligne au journal (CLAUDE.md §5). Rien n'est écrit à
 * l'acheteur. ⚠ Rouvrir une recherche ne relance pas le moteur (`on_search_criteria_updated` ne part que sur un
 * changement de critères) : ses autres biens viennent au scan de la nuit.
 */
async function reactiverProspect(
  supabase: SupabaseClient, agencyId: string, acteurId: string | null, body: RequestBody, cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  // Un geste d'agent, jamais d'un appel de service : le journal le nomme.
  if (!acteurId) return { statut: 403, corps: { error: 'agent_only' } }
  const cible = lireCible(body)
  if (!cible || !estUuid(body.client_search_id)) return { statut: 400, corps: { error: 'invalid_body' } }
  const origine: OrigineProspect | null = body.origine === 'deal_perdu' || body.origine === 'recherche_close' ? body.origine : null

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria, updated_at')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  const bien = await lireBien(supabase, agencyId, cible)
  if (!bien) return { statut: 404, corps: { error: 'bien_not_found' } }

  const colonne = colonneDe(cible)
  const { data: deja, error: dErr } = await supabase
    .from('matches')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('contact_id', recherche.contact_id)
    .eq(colonne, cible.id)
    .limit(1)
  if (dErr) throw dErr
  if ((deja ?? []).length > 0) return { statut: 409, corps: { error: 'deja_sur_ce_bien' } }

  const [note] = noterProspects(
    [{ ...(recherche as RechercheClose), origine: origine ?? 'recherche_close', depuis: null }],
    bien, cible.genre === 'annonce', cfg, refLoyer(rentIndex), Date.now(),
  )
  if (!note) return { statut: 409, corps: { error: 'sous_le_seuil' } }

  const { data: crees, error: iErr } = await supabase.rpc(
    cible.genre === 'mandat' ? 'insert_internal_matches' : 'insert_market_matches',
    { p_rows: [{
      agency_id: agencyId, contact_id: recherche.contact_id, [colonne]: cible.id, client_search_id: recherche.id,
      score: note.score, reasons: note.reasons, score_version: cfg.version,
    }] },
  )
  if (iErr) throw iErr
  const cree = ((crees ?? []) as { id: string }[])[0]
  // Un match est né entre la lecture et l'écriture (`ON CONFLICT DO NOTHING`) : l'agent en a déjà un.
  if (!cree) return { statut: 409, corps: { error: 'deja_sur_ce_bien' } }

  const { error: uErr } = await supabase
    .from('client_searches')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', recherche.id)
    .eq('agency_id', agencyId)
  if (uErr) throw uErr

  const { error: jErr } = await supabase.from('activity_events').insert({
    agency_id: agencyId, actor_id: acteurId, actor_kind: 'user', action: 'prospect_reactive',
    category: 'contact', severity: 'info', entity_type: 'contact', entity_id: recherche.contact_id, object_label: null,
    metadata: { client_search_id: recherche.id, [colonne]: cible.id, match_id: cree.id, score: note.score, score_version: cfg.version, origine },
  })
  // Audit obligatoire, mais l'écriture faite ne se défait pas pour lui : on le dit dans les journaux.
  if (jErr) console.error('[matching-engine] journal prospect_reactive :', redactedErrorMessage(jErr))

  return { statut: 200, corps: { match_id: cree.id, score: note.score } }
}

```

- [ ] **Step 4 : Les brancher**

Remplacer :

```ts
    } else if (mode === 'rescore-search') {
      const r = await renoterRecherche(supabase, agency_id, acteurId, body, cfg, rentIndex)
      return new Response(JSON.stringify(r.corps), {
        status: r.statut, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
```

par :

```ts
    } else if (mode === 'rescore-search' || mode === 'prospects' || mode === 'reactiver-prospect') {
      const r = mode === 'rescore-search' ? await renoterRecherche(supabase, agency_id, acteurId, body, cfg, rentIndex)
        : mode === 'prospects' ? await prospectsDuBien(supabase, agency_id, body, cfg, rentIndex)
          : await reactiverProspect(supabase, agency_id, acteurId, body, cfg, rentIndex)
      return new Response(JSON.stringify(r.corps), {
        status: r.statut, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
```

- [ ] **Step 5 : Le libellé du journal et la cloche**

Script python (vérifie le format d'abord, n'écrit que `audit.action.prospect_reactive`) :

```bash
python3 - <<'PY'
import json
LIB = {
  'fr': "Ancien prospect réactivé pour un bien",
  'en': "Former prospect reactivated for a property",
  'de': "Früherer Interessent für eine Immobilie reaktiviert",
  'it': "Ex potenziale acquirente riattivato per un immobile",
}
for lang, texte in LIB.items():
    p = f'src/i18n/locales/{lang}/common.json'
    brut = open(p, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'format inattendu : {p}'
    d['audit']['action']['prospect_reactive'] = texte
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print('ok', p)
PY
```

Dans `src/hooks/useAgentNotifications.ts`, remplacer :

```ts
  recherche_ajustee: 'matching', matchs_reevalues: 'matching', correction_ignoree: 'matching',
```

par :

```ts
  recherche_ajustee: 'matching', matchs_reevalues: 'matching', correction_ignoree: 'matching',
  // « Qui pour ce bien ? » (lot C, 22.09.2026) : un ancien prospect réactivé par l'agent.
  prospect_reactive: 'matching',
```

- [ ] **Step 6 : Vérifier**

Run : `deno check supabase/functions/matching-engine/index.ts`
Expected : aucune erreur.

Run : `npx vitest run tests/unit/agent-notifications-scenarios.spec.ts tests/unit/activity-events-category.spec.ts tests/unit/audit-acteur-ia.spec.ts`
Expected : PASS.

Run : `npm run -s i18n:parity:ci && npm run -s lint:edge-auth`
Expected : vert.

- [ ] **Step 7 : Point de commit (au signal de Julien)**

```bash
git add supabase/functions/matching-engine/index.ts supabase/functions/_shared/matching-prospects.ts supabase/functions/_shared/matching-renotation.ts tests/unit/matching-prospects.spec.ts src/i18n/locales/*/common.json src/hooks/useAgentNotifications.ts
git commit -m "feat(matching): les anciens prospects d'un bien, notés à la demande et réactivables"
```

---

### Task 6 : Les trois critères de l'acheteur (fiche contact)

**Files :**
- Modify : `src/types/contact.ts`, `src/lib/contactCriteria.ts`, `src/components/crm/contacts-pager/ContactDetailPager.tsx`
- Modify : `src/i18n/locales/{fr,de,en,it}/contacts.json`
- Test : `tests/unit/contact-criteres-explique.spec.ts` (créé)

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/contact-criteres-explique.spec.ts` :

```ts
/**
 * Les trois critères du lot C sur la fiche contact : chambres, état minimum, off-market seulement. Ils passent par
 * `buildSearchCriteria`, qui reconstruit l'objet de zéro — une clé qu'il ignore est EFFACÉE au premier
 * enregistrement de la fiche, et le pont `sync_contact_client_search` recopie cet effacement dans la recherche.
 */
import { describe, expect, it } from 'vitest'
import { buildSearchCriteria, parseSearchCriteria, type CriteriaInput } from '@/lib/contactCriteria'

const BASE: CriteriaInput = { transaction: 'vente', types: ['appartement'], cantons: ['GE'], budgetMax: 2_500_000 }

describe('les critères du lot C', () => {
  it('s’écrivent, et se relisent à l’identique', () => {
    const c = buildSearchCriteria({ ...BASE, bedroomsMin: 4, conditionMin: 'renovated', offMarketOnly: true })
    expect(c).toMatchObject({ bedrooms_min: 4, condition_min: 'renovated', off_market_only: true })
    expect(parseSearchCriteria(c)).toMatchObject({ bedroomsMin: 4, conditionMin: 'renovated', offMarketOnly: true })
  })
  it('un critère vide ne s’écrit pas', () => {
    const c = buildSearchCriteria({ ...BASE, bedroomsMin: 0, conditionMin: null, offMarketOnly: false })
    expect(c).not.toHaveProperty('bedrooms_min')
    expect(c).not.toHaveProperty('condition_min')
    expect(c).not.toHaveProperty('off_market_only')
  })
  it('à lui seul, chacun rend la recherche signifiante', () => {
    const vide: CriteriaInput = { transaction: 'vente', types: [], cantons: [] }
    expect(buildSearchCriteria(vide)).toBeNull()
    expect(buildSearchCriteria({ ...vide, bedroomsMin: 3 })).not.toBeNull()
    expect(buildSearchCriteria({ ...vide, conditionMin: 'new' })).not.toBeNull()
    expect(buildSearchCriteria({ ...vide, offMarketOnly: true })).not.toBeNull()
  })
  it('une valeur d’état hors vocabulaire se relit comme absente', () => {
    expect(parseSearchCriteria({ condition_min: 'excellent' as never }).conditionMin).toBeNull()
  })
})
```

- [ ] **Step 2 : Le voir échouer**

Run : `npx vitest run tests/unit/contact-criteres-explique.spec.ts`
Expected : FAIL (clés inconnues de `CriteriaInput`).

- [ ] **Step 3 : Le type (`src/types/contact.ts`)**

Dans `SearchCriteria`, après `features?: string[]`, ajouter :

```ts
  /** Lot C : chambres au minimum. */
  bedrooms_min?: number
  /** Lot C : l'état minimum — bon état < rénové < neuf (`matching-normalize.ts`, `ETATS_BIEN`). */
  condition_min?: 'good' | 'renovated' | 'new'
  /** Lot C : l'acheteur ne veut que de l'off-market. Le moteur le NOTE, ce n'est pas un filtre. */
  off_market_only?: boolean
```

- [ ] **Step 4 : Le pont (`src/lib/contactCriteria.ts`)**

Dans `CriteriaInput`, après `mustHave?: string[] // libellés d'indispensables (features)`, ajouter :

```ts
  bedroomsMin?: number | null
  conditionMin?: EtatMinimum | null
  offMarketOnly?: boolean
```

et, juste avant `export interface CriteriaInput {`, ajouter :

```ts
/** L'état minimum qu'un acheteur peut demander (lot C) : « à rénover » n'en est pas un, tout bien le tient. */
export const ETATS_MINIMUM = ['good', 'renovated', 'new'] as const
export type EtatMinimum = (typeof ETATS_MINIMUM)[number]
```

Dans `buildSearchCriteria`, remplacer :

```ts
  if (i.mustHave?.length) c.features = i.mustHave

  const meaningful =
    c.type || c.zones || c.budget_min || c.budget_max || c.rooms_min || c.surface_min || c.features
```

par :

```ts
  if (i.mustHave?.length) c.features = i.mustHave
  // Lot C. ⛔ Une clé oubliée ici est EFFACÉE au prochain enregistrement de la fiche : l'objet est reconstruit.
  if (i.bedroomsMin != null && i.bedroomsMin > 0) c.bedrooms_min = i.bedroomsMin
  if (i.conditionMin) c.condition_min = i.conditionMin
  if (i.offMarketOnly) c.off_market_only = true

  const meaningful =
    c.type || c.zones || c.budget_min || c.budget_max || c.rooms_min || c.surface_min || c.features
    || c.bedrooms_min || c.condition_min || c.off_market_only
```

Dans `parseSearchCriteria`, remplacer :

```ts
    mustHave: sc?.features ?? [],
  }
```

par :

```ts
    mustHave: sc?.features ?? [],
    bedroomsMin: sc?.bedrooms_min ?? null,
    conditionMin: (ETATS_MINIMUM as readonly string[]).includes(sc?.condition_min ?? '') ? sc!.condition_min as EtatMinimum : null,
    offMarketOnly: sc?.off_market_only === true,
  }
```

- [ ] **Step 5 : La carte « Critères » (`ContactDetailPager.tsx`)**

Ajouter `ETATS_MINIMUM` et `type EtatMinimum` à l'import existant de `@/lib/contactCriteria` (celui qui porte `CriteriaInput`).

Remplacer :

```ts
interface CritForm {
  budgetMin: string; budgetMax: string; types: string[]; cantons: string[]
  cities: string; roomsMin: string; areaMin: string; mustHave: string[]
}
```

par :

```ts
interface CritForm {
  budgetMin: string; budgetMax: string; types: string[]; cantons: string[]
  cities: string; roomsMin: string; areaMin: string; mustHave: string[]
  /** Lot C — côté DEMANDE seulement : l'offre d'un vendeur ne porte ni l'un ni l'autre. */
  bedroomsMin: string; conditionMin: EtatMinimum | ''; offMarketOnly: boolean
}
```

Dans `seed`, après `mustHave: [...(cr.mustHave || [])],`, ajouter :

```ts
    bedroomsMin: cr.bedroomsMin != null ? String(cr.bedroomsMin) : '',
    conditionMin: cr.conditionMin ?? '',
    offMarketOnly: cr.offMarketOnly === true,
```

Dans `save`, remplacer :

```ts
      mustHave: d.mustHave,
    }
    void onSave(out).then(flashSaved)
```

par :

```ts
      mustHave: d.mustHave,
      ...(isSeller ? {} : {
        bedroomsMin: d.bedroomsMin === '' ? null : Number(d.bedroomsMin),
        conditionMin: d.conditionMin || null,
        offMarketOnly: d.offMarketOnly,
      }),
    }
    void onSave(out).then(flashSaved)
```

En édition, juste APRÈS la grille « Pièces min / Surface min » (le `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', … }}>` qui contient `fiche.crit.roomsMin` et `fiche.crit.areaMinEdit`), insérer :

```tsx
          {!isSeller && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
                <div><div style={cdLbl(P)}>{t('fiche.crit.bedroomsMin')}</div><CdTextInput type="number" value={d.bedroomsMin} onChange={setF('bedroomsMin')} placeholder="3" mono P={P} /></div>
              </div>
              <div>
                <div style={cdLbl(P)}>{t('fiche.crit.condition')}</div>
                <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                  <CdPickChip on={d.conditionMin === ''} onClick={() => setD((s) => ({ ...s, conditionMin: '' }))} P={P}>{t('fiche.crit.conditionAny')}</CdPickChip>
                  {ETATS_MINIMUM.map((e) => (
                    <CdPickChip key={e} on={d.conditionMin === e} onClick={() => setD((s) => ({ ...s, conditionMin: e }))} P={P}>{t(`fiche.crit.conditions.${e}`)}</CdPickChip>
                  ))}
                </div>
              </div>
              <div>
                <div style={cdLbl(P)}>{t('fiche.crit.offMarket')}</div>
                <CdPickChip on={d.offMarketOnly} onClick={() => setD((s) => ({ ...s, offMarketOnly: !s.offMarketOnly }))} P={P}>{t('fiche.crit.offMarketOnly')}</CdPickChip>
              </div>
            </>
          )}
```

En lecture, juste APRÈS la grille qui porte `CdReadRow` de `fiche.crit.roomsMin` et `fiche.crit.areaMin`, insérer :

```tsx
          {!isSeller && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
              <CdReadRow label={t('fiche.crit.bedroomsMin')} value={v.bedroomsMin} empty={!v.bedroomsMin} mono P={P} />
              <CdReadRow label={t('fiche.crit.condition')} value={v.conditionMin ? t(`fiche.crit.conditions.${v.conditionMin}`) : ''} empty={!v.conditionMin} P={P} />
              <CdReadRow label={t('fiche.crit.offMarket')} value={t('fiche.crit.offMarketOnly')} empty={!v.offMarketOnly} P={P} />
            </div>
          )}
```

- [ ] **Step 6 : Les libellés (`contacts.json`)**

```bash
python3 - <<'PY'
import json
T = {
  'fr': {'bedroomsMin': 'Chambres min', 'condition': 'État minimum', 'conditionAny': 'Peu importe',
         'conditions': {'good': 'Bon état', 'renovated': 'Rénové', 'new': 'Neuf'},
         'offMarket': 'Off-market', 'offMarketOnly': 'Off-market seulement'},
  'en': {'bedroomsMin': 'Min bedrooms', 'condition': 'Minimum condition', 'conditionAny': 'Any',
         'conditions': {'good': 'Good condition', 'renovated': 'Renovated', 'new': 'New'},
         'offMarket': 'Off-market', 'offMarketOnly': 'Off-market only'},
  'de': {'bedroomsMin': 'Min. Schlafzimmer', 'condition': 'Mindestzustand', 'conditionAny': 'Egal',
         'conditions': {'good': 'Guter Zustand', 'renovated': 'Renoviert', 'new': 'Neubau'},
         'offMarket': 'Off-market', 'offMarketOnly': 'Nur Off-market'},
  'it': {'bedroomsMin': 'Camere min', 'condition': 'Stato minimo', 'conditionAny': 'Indifferente',
         'conditions': {'good': 'Buono stato', 'renovated': 'Ristrutturato', 'new': 'Nuovo'},
         'offMarket': 'Off-market', 'offMarketOnly': 'Solo off-market'},
}
for lang, cles in T.items():
    p = f'src/i18n/locales/{lang}/contacts.json'
    brut = open(p, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'format inattendu : {p}'
    crit = d['fiche']['crit']
    for k in cles:
        assert k not in crit, f'{p} : fiche.crit.{k} existe déjà'
    crit.update(cles)
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print('ok', p)
PY
```

- [ ] **Step 7 : Vérifier**

Run : `npx vitest run tests/unit/contact-criteres-explique.spec.ts`
Expected : PASS.

Run : `npx tsc -p tsconfig.app.json --noEmit` (ou `npm run -s typecheck` s'il existe)
Expected : aucune erreur.

Run : `npm run -s i18n:parity:ci && npm run -s i18n:coverage:ci && npm run -s lint:prose`
Expected : vert.

- [ ] **Step 8 : Point de commit (au signal de Julien)**

```bash
git add src/types/contact.ts src/lib/contactCriteria.ts src/components/crm/contacts-pager/ContactDetailPager.tsx src/i18n/locales/*/contacts.json tests/unit/contact-criteres-explique.spec.ts
git commit -m "feat(contacts): chambres, état minimum et off-market dans les critères de l'acheteur"
```

---

### Task 7 : L'interrupteur Off-market du mandat

**Files :**
- Modify : `src/types/listing.ts`, `src/hooks/useProperties.ts`, `src/components/crm-wizard/useWizardDraft.ts`, `src/components/crm-wizard/usePublierWizard.ts`
- Modify : `src/components/crm/biens/nouveau/EtapeMandat.tsx`, `src/components/crm/biens/nouveau/NouveauBien.tsx`, `src/pages/agent/ListingDetailPage.tsx`
- Modify : `src/i18n/locales/{fr,de,en,it}/listings.json`, `src/i18n/locales/{fr,de,en,it}/common.json`, `src/hooks/useAgentNotifications.ts`
- Test : `tests/unit/off-market-mandat.spec.ts` (créé)

⚠ **Le choix de « Nouveau bien » réutilise `WizardData.visibility`** (`'public' | 'network' | 'private'`, `crm-wizard/tokens.ts`) : un champ déjà déclaré, initialisé à `'public'`, et lu par personne. `'network'` EST le « Réseau Off-market ». Pas de champ neuf.

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/off-market-mandat.spec.ts` :

```ts
/**
 * L'interrupteur Off-market d'un mandat (lot C, décision de Julien du 22.09.2026). « Réseau Off-market » dans
 * « Nouveau bien » écrit `off_market` — sur le brouillon automatique comme à la mise en service ; « Publier » ne
 * l'écrit pas.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_WIZARD } from '@/components/crm-wizard/tokens'
import { wizardPayload } from '@/components/crm-wizard/useWizardDraft'

describe('wizardPayload et l’off-market', () => {
  it('« Réseau Off-market » écrit off_market, brouillon compris', () => {
    const data = { ...EMPTY_WIZARD, addr: 'Route de Florissant 62', visibility: 'network' as const }
    expect(wizardPayload(data, 'active').off_market).toBe(true)
    expect(wizardPayload(data, 'draft').off_market).toBe(true)
  })
  it('« Publier » ne l’écrit pas', () => {
    expect(wizardPayload({ ...EMPTY_WIZARD, addr: 'Rue du Lac 14' }, 'active').off_market).toBe(false)
  })
})
```

- [ ] **Step 2 : Le voir échouer**

Run : `npx vitest run tests/unit/off-market-mandat.spec.ts`
Expected : FAIL (`off_market` absent du payload).

- [ ] **Step 3 : Les types**

Dans `src/types/listing.ts`, interface `Property`, après `published_at: string | null`, ajouter :

```ts
  /** Mandat off-market : proposé aux seuls acheteurs de l'agence, jamais diffusé (lot C). */
  off_market?: boolean
```

Dans `src/hooks/useProperties.ts`, interface `CreatePropertyInput`, après `partner_agency?: string | null`, ajouter :

```ts
  /** Off-market (lot C) : l'interrupteur de l'agent ; le moteur renote le bien quand il bascule. */
  off_market?: boolean
```

- [ ] **Step 4 : Le payload (`useWizardDraft.ts`)**

Dans `wizardPayload`, après `partner_agency: data.partnerAgency ?? null,`, ajouter :

```ts
    // « Réseau Off-market » (étape Mandat) : proposé aux seuls acheteurs de l'agence (lot C).
    off_market: data.visibility === 'network',
```

Dans `usePublierWizard.ts`, remplacer le commentaire du paramètre `statut` :

```ts
   * @param statut `active` publie ; `draft` enregistre tout — photos et vendeur compris —
   *               sans mettre en ligne (le bien reste Off-market, `published_at` vide).
```

par :

```ts
   * @param statut `active` met le bien en service — publié, ou Off-market selon `data.visibility` ;
   *               `draft` enregistre tout, photos et vendeur compris, en brouillon (`published_at` vide) :
   *               un brouillon n'est jamais noté par le moteur.
```

- [ ] **Step 5 : Le choix de diffusion (`EtapeMandat.tsx`)**

Remplacer le bloc « Diffusion » :

```tsx
        <NbBloc sp={sp} titre={t('nouveauBien.mandat.diffusion')}>
          <div className="nb-grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(['publier', 'garder'] as const).map((k) => (
              <div key={k} style={{ display: 'flex', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg }}>
                <MEIcon name={k === 'publier' ? 'globe' : 'lock'} size={18} color={sp.sub} />
                <div>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t(`nouveauBien.mandat.${k}Titre`)}</div>
                  {/* « Réseau Off-market » se suffit (Julien, 16.09.2026) : seule la publication s'explique. */}
                  {k === 'publier' && <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub, lineHeight: 1.5 }}>{t('nouveauBien.mandat.publierAide')}</div>}
                </div>
              </div>
            ))}
          </div>
        </NbBloc>
```

par :

```tsx
        <NbBloc sp={sp} titre={t('nouveauBien.mandat.diffusion')}>
          {/* ⚠ UN CHOIX, plus deux étiquettes (lot C, 22.09.2026) : « Réseau Off-market » met le bien en service,
              proposé aux seuls acheteurs de l'agence (`off_market`). Il en faisait un BROUILLON, que le moteur ne
              note jamais — le bien n'était proposé à personne. */}
          <div role="radiogroup" aria-label={t('nouveauBien.mandat.diffusion')} className="nb-grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(['publier', 'garder'] as const).map((k) => {
              const choisi = (data.visibility === 'network') === (k === 'garder')
              return (
                <button key={k} type="button" role="radio" aria-checked={choisi} className={choisi ? undefined : 'nb-puce'}
                  onClick={() => set({ visibility: k === 'garder' ? 'network' : 'public' })} style={{
                    display: 'flex', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)',
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: sp.cardBg,
                    // L'élément ACTIF porte l'accent (CLAUDE.md §3), comme `NbPuce`.
                    border: `1px solid ${choisi ? sp.accent : sp.cardBorder}`, boxShadow: choisi ? `inset 0 0 0 1px ${sp.accent}` : 'none',
                  }}>
                  <MEIcon name={k === 'publier' ? 'globe' : 'lock'} size={18} color={choisi ? sp.accent : sp.sub} />
                  <span>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t(`nouveauBien.mandat.${k}Titre`)}</span>
                    {/* « Réseau Off-market » se suffit (Julien, 16.09.2026) : seule la publication s'explique. */}
                    {k === 'publier' && <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub, lineHeight: 1.5 }}>{t('nouveauBien.mandat.publierAide')}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </NbBloc>
```

- [ ] **Step 6 : Le pied et l'écran de fin (`NouveauBien.tsx`)**

Juste après `const manques = manquesPublication(points)`, ajouter :

```ts
  const offMarket = data.visibility === 'network'
```

Remplacer, dans le pied :

```tsx
                  <MEIcon name="lock" size={14} />{t('nouveauBien.garder')}
```

par :

```tsx
                  <MEIcon name="edit" size={14} />{t('nouveauBien.garder')}
```

et :

```tsx
                  <MEIcon name="globe" size={14} />{enCours ? t('nouveauBien.enCours') : t('nouveauBien.publier')}
```

par :

```tsx
                  <MEIcon name={offMarket ? 'lock' : 'globe'} size={14} />
                  {enCours ? t('nouveauBien.enCours') : offMarket ? t('nouveauBien.proposerOffMarket') : t('nouveauBien.publier')}
```

Dans l'écran de fin, remplacer :

```tsx
              {fini.publie ? t('nouveauBien.fini.publie') : t('nouveauBien.fini.garde')}
```

par :

```tsx
              {!fini.publie ? t('nouveauBien.fini.garde') : offMarket ? t('nouveauBien.fini.offMarket') : t('nouveauBien.fini.publie')}
```

et :

```tsx
              {fini.publie ? t('nouveauBien.fini.publieAide', { titre: data.title?.trim() || titreSuggere }) : t('nouveauBien.fini.gardeAide', { titre: data.title?.trim() || titreSuggere })}
```

par :

```tsx
              {t(!fini.publie ? 'nouveauBien.fini.gardeAide' : offMarket ? 'nouveauBien.fini.offMarketAide' : 'nouveauBien.fini.publieAide', { titre: data.title?.trim() || titreSuggere })}
```

- [ ] **Step 7 : La fiche du bien (`ListingDetailPage.tsx`)**

Remplacer :

```ts
  // Off-market = non publié (proxy réel de la « visibilité privée »).
  const offMarket = !bien.published_at
```

par :

```ts
  // Off-market = l'interrupteur de l'agent (`off_market`, lot C, 22.09.2026). « Non publié » désignait un
  // BROUILLON, que le moteur ne note jamais : un bien « off-market » n'était proposé à aucun acheteur.
  const offMarket = bien.off_market === true
```

Juste après la fonction `publishBien` (qui se termine par `}` après `updateProperty(patch, { … })`), ajouter :

```ts
  // L'interrupteur Off-market : le moteur renote le bien (trigger `trg_property_off_market`, lot C).
  const basculerOffMarket = (valeur: boolean) => {
    if (demoData) return // aperçu : aucune écriture
    updateProperty({ id: bien.id, off_market: valeur }, {
      onSuccess: () => {
        logAudit({
          category: 'bien',
          severity: 'info',
          action: valeur ? 'bien_off_market' : 'bien_rendu_public',
          entityType: 'property',
          entityId: bien.id,
          objectLabel: bien.title,
          metadata: { off_market: valeur },
        })
        flash(valeur ? tr('detail.toast.offMarketTitle') : tr('detail.toast.publicTitle'), [tr('detail.toast.renote'), tr('detail.toast.auditAdded')])
      },
    })
  }
```

Dans le bloc Diffusion, remplacer :

```tsx
                    {offMarket
                      ? <BfCta small vx={vx} onClick={publishBien}>{tr('fiche.diffusion.publish')}</BfCta>
                      : (
```

par :

```tsx
                    {bien.status === 'draft'
                      ? <BfCta small vx={vx} onClick={publishBien}>{tr('fiche.diffusion.publish')}</BfCta>
                      : offMarket ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: vx.inkSoft, whiteSpace: 'nowrap' }}>
                          <MEIcon name="lock" size={12} />{tr('fiche.diffusion.offMarketLigne')}
                        </span>
                      ) : (
```

et remplacer le bloc de l'aperçu public :

```tsx
                  <div>
                    <BfCta small ghost vx={vx} icon="external" onClick={() => flash(tr('fiche.diffusion.previewToastTitle'), [idxOnline ? tr('fiche.diffusion.previewOnlineLine') : tr('fiche.diffusion.previewOfflineLine')])}>
                      {tr('fiche.diffusion.publicPreview')}
                    </BfCta>
                  </div>
```

par :

```tsx
                  <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
                    {!offMarket && (
                      <BfCta small ghost vx={vx} icon="external" onClick={() => flash(tr('fiche.diffusion.previewToastTitle'), [idxOnline ? tr('fiche.diffusion.previewOnlineLine') : tr('fiche.diffusion.previewOfflineLine')])}>
                        {tr('fiche.diffusion.publicPreview')}
                      </BfCta>
                    )}
                    {bien.status !== 'draft' && (
                      <BfCta small ghost vx={vx} icon={offMarket ? 'globe' : 'lock'} onClick={() => basculerOffMarket(!offMarket)}>
                        {offMarket ? tr('fiche.diffusion.rendrePublic') : tr('fiche.diffusion.passerOffMarket')}
                      </BfCta>
                    )}
                  </div>
```

- [ ] **Step 8 : Les textes (`listings.json`, `common.json`) et la cloche**

```bash
python3 - <<'PY'
import json
L = {
  'fr': {'garder': 'Enregistrer le brouillon', 'proposerOffMarket': 'Proposer en Off-market',
         'fini': {'garde': 'Brouillon enregistré', 'gardeAide': '« {{titre}} » est enregistré en brouillon. Publiez-le depuis sa fiche quand il est prêt.',
                  'offMarket': 'Bien en Off-market', 'offMarketAide': '« {{titre}} » est en service : il est proposé à vos acheteurs, jamais diffusé.'},
         'diffusion': {'offMarketLigne': 'Off-market · vos acheteurs seulement', 'passerOffMarket': 'Passer en Off-market', 'rendrePublic': 'Rendre public'},
         'toast': {'offMarketTitle': 'Bien passé en Off-market', 'publicTitle': 'Bien rendu public', 'renote': 'Les matchs de ce bien sont recalculés'},
         'audit': {'bien_off_market': 'Bien passé en Off-market', 'bien_rendu_public': 'Bien rendu public'}},
  'en': {'garder': 'Save as draft', 'proposerOffMarket': 'Offer off-market',
         'fini': {'garde': 'Draft saved', 'gardeAide': '“{{titre}}” is saved as a draft. Publish it from its page when it is ready.',
                  'offMarket': 'Property off-market', 'offMarketAide': '“{{titre}}” is live: it is offered to your buyers and never advertised.'},
         'diffusion': {'offMarketLigne': 'Off-market · your buyers only', 'passerOffMarket': 'Take off-market', 'rendrePublic': 'Make public'},
         'toast': {'offMarketTitle': 'Property taken off-market', 'publicTitle': 'Property made public', 'renote': 'The matches for this property are recalculated'},
         'audit': {'bien_off_market': 'Property taken off-market', 'bien_rendu_public': 'Property made public'}},
  'de': {'garder': 'Als Entwurf speichern', 'proposerOffMarket': 'Off-market anbieten',
         'fini': {'garde': 'Entwurf gespeichert', 'gardeAide': '«{{titre}}» ist als Entwurf gespeichert. Veröffentlichen Sie es über die Objektseite, sobald es bereit ist.',
                  'offMarket': 'Objekt Off-market', 'offMarketAide': '«{{titre}}» ist aktiv: Es wird Ihren Käufern angeboten und nie ausgeschrieben.'},
         'diffusion': {'offMarketLigne': 'Off-market · nur Ihre Käufer', 'passerOffMarket': 'Auf Off-market stellen', 'rendrePublic': 'Öffentlich machen'},
         'toast': {'offMarketTitle': 'Objekt auf Off-market gestellt', 'publicTitle': 'Objekt öffentlich gemacht', 'renote': 'Die Matches dieses Objekts werden neu berechnet'},
         'audit': {'bien_off_market': 'Objekt auf Off-market gestellt', 'bien_rendu_public': 'Objekt öffentlich gemacht'}},
  'it': {'garder': 'Salva come bozza', 'proposerOffMarket': 'Proponi off-market',
         'fini': {'garde': 'Bozza salvata', 'gardeAide': '«{{titre}}» è salvato come bozza. Lo pubblichi dalla sua scheda quando è pronto.',
                  'offMarket': 'Immobile off-market', 'offMarketAide': '«{{titre}}» è attivo: è proposto ai Suoi acquirenti, mai pubblicizzato.'},
         'diffusion': {'offMarketLigne': 'Off-market · solo i Suoi acquirenti', 'passerOffMarket': 'Passa a off-market', 'rendrePublic': 'Rendi pubblico'},
         'toast': {'offMarketTitle': 'Immobile passato a off-market', 'publicTitle': 'Immobile reso pubblico', 'renote': 'I match di questo immobile vengono ricalcolati'},
         'audit': {'bien_off_market': 'Immobile passato a off-market', 'bien_rendu_public': 'Immobile reso pubblico'}},
}
def charger(p):
    brut = open(p, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'format inattendu : {p}'
    return d
def ecrire(p, d):
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
for lang, v in L.items():
    p = f'src/i18n/locales/{lang}/listings.json'
    d = charger(p)
    nb = d['nouveauBien']
    nb['garder'] = v['garder']
    assert 'proposerOffMarket' not in nb
    nb['proposerOffMarket'] = v['proposerOffMarket']
    nb['fini'].update(v['fini'])
    for k in v['diffusion']: assert k not in d['fiche']['diffusion']
    d['fiche']['diffusion'].update(v['diffusion'])
    for k in v['toast']: assert k not in d['detail']['toast']
    d['detail']['toast'].update(v['toast'])
    ecrire(p, d)
    p = f'src/i18n/locales/{lang}/common.json'
    d = charger(p)
    for k in v['audit']: assert k not in d['audit']['action']
    d['audit']['action'].update(v['audit'])
    ecrire(p, d)
    print('ok', lang)
PY
```

Dans `src/hooks/useAgentNotifications.ts`, `KIND_PAR_ACTION`, remplacer :

```ts
  idx_feed_pushed: 'bien', extract_property_pdf: 'bien', extract_property_url: 'bien',
```

par :

```ts
  idx_feed_pushed: 'bien', extract_property_pdf: 'bien', extract_property_url: 'bien',
  // L'interrupteur Off-market d'un mandat (lot C, 22.09.2026).
  bien_off_market: 'bien', bien_rendu_public: 'bien',
```

- [ ] **Step 9 : Vérifier**

Run : `npx vitest run tests/unit/off-market-mandat.spec.ts tests/unit/agent-notifications-scenarios.spec.ts`
Expected : PASS.

Run : `npx tsc -p tsconfig.app.json --noEmit`
Expected : aucune erreur.

Run : `npm run -s i18n:parity:ci && npm run -s i18n:coverage:ci && npm run -s lint:prose && npm run -s lint:i18n`
Expected : vert.

- [ ] **Step 10 : Voir l'interrupteur au banc**

Ouvrir `http://localhost:5173/dev/crm?entree=/dashboard/listings/p1` : le bloc Diffusion montre « Passer en Off-market » ; le clic affiche le toast (le banc n'écrit pas `properties`). Ouvrir « Nouveau bien » (`/dashboard/listings/new`) jusqu'à l'étape Mandat : les deux cartes se choisissent, la carte choisie porte l'accent, et le bouton principal devient « Proposer en Off-market ».

- [ ] **Step 11 : Point de commit (au signal de Julien)**

```bash
git add src/types/listing.ts src/hooks/useProperties.ts src/components/crm-wizard/useWizardDraft.ts src/components/crm-wizard/usePublierWizard.ts src/components/crm/biens/nouveau/EtapeMandat.tsx src/components/crm/biens/nouveau/NouveauBien.tsx src/pages/agent/ListingDetailPage.tsx src/i18n/locales/*/listings.json src/i18n/locales/*/common.json src/hooks/useAgentNotifications.ts tests/unit/off-market-mandat.spec.ts
git commit -m "feat(biens): l'interrupteur Off-market du mandat — un bien off-market est proposé à vos acheteurs"
```

---

### Task 8 : Le modèle du fil — les lignes chambres, état, off-market

**Files :**
- Modify : `src/components/matching-fil/filModele.ts`, `src/components/matching-fil/filValeurs.ts`
- Modify : `src/i18n/locales/{fr,de,en,it}/matching.json` (`fil.criteres`, `fil.valeurs`, `fil.etats`, `fil.selection`)
- Test : `tests/unit/matching-fil-modele.spec.ts` (modifié)

- [ ] **Step 1 : Écrire le test**

Dans `tests/unit/matching-fil-modele.spec.ts`, ajouter `axesComplementaires` à l'import de `matching-normalize` :

```ts
import { axesComplementaires, calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
```

et, à la fin du fichier :

```ts
describe('lot C : chambres, état, off-market — des faits, à la règle du moteur', () => {
  const T = Date.parse('2026-09-22T12:00:00.000Z')
  const recherche = { bedrooms_min: 3, condition_min: 'renovated', off_market_only: true } as const
  const ligne = (b: Partial<FilBien>, cle: string) =>
    lignesCriteres(match('m', 90, bien('p', b), acheteur('c'), { criteres: recherche }), T).find((l) => l.cle === cle)

  it('chambres : un fait ; 0 et absent ne sont pas évalués', () => {
    expect(ligne({ chambres: 3 }, 'chambres')).toMatchObject({ ok: true, chambres: 3, min: 3 })
    expect(ligne({ chambres: 2 }, 'chambres')).toMatchObject({ ok: false })
    expect(ligne({ chambres: 0 }, 'chambres')).toMatchObject({ ok: null, chambres: null })
    expect(ligne({}, 'chambres')).toMatchObject({ ok: null })
  })
  it('état : saisi, ou déduit des années qui disent quelque chose', () => {
    expect(ligne({ etatSaisi: 'good' }, 'etat')).toMatchObject({ ok: false, etat: { etat: 'good', source: 'saisi' } })
    expect(ligne({ anneeConstruction: 2024 }, 'etat')).toMatchObject({ ok: true, etat: { etat: 'new', source: 'construction', annee: 2024 } })
    expect(ligne({ anneeRenovation: 2019 }, 'etat')).toMatchObject({ ok: true, etat: { etat: 'renovated', annee: 2019 } })
    expect(ligne({ anneeConstruction: 1968 }, 'etat')).toMatchObject({ ok: null, etat: null })
  })
  it('off-market : un mandat off-market tient ; un bien public ou une annonce du marché, non', () => {
    expect(ligne({ offMarket: true }, 'offMarket')).toMatchObject({ ok: true })
    expect(ligne({}, 'offMarket')).toMatchObject({ ok: false })
    expect(ligne({ marche: { ref: 'MG-FL-1', sourceUrl: null } }, 'offMarket')).toMatchObject({ ok: false })
  })
  it('aucune ligne pour un critère que la recherche ne pose pas', () => {
    const l = lignesCriteres(match('m', 90, bien('p', { chambres: 3, offMarket: true }), acheteur('c'), { criteres: { type: 'apartment' } }), T)
    expect(l.map((x) => x.cle)).toEqual(['type'])
  })
  it('même verdict que le moteur : ✓ = tenu en entier, sans verdict = axe inactif', () => {
    const cas: Partial<FilBien>[] = [
      { chambres: 3 }, { chambres: 2 }, { chambres: 1 }, { chambres: 0 }, {},
      { etatSaisi: 'new' }, { etatSaisi: 'good' }, { etatSaisi: 'to_renovate' },
      { anneeConstruction: 2023 }, { anneeRenovation: 2017 }, { anneeConstruction: 1970 },
      { offMarket: true }, { offMarket: false },
    ]
    const verdict = (a: { active: boolean; frac: number }) => (a.active ? a.frac === 1 : null)
    for (const b of cas) {
      const lignes = lignesCriteres(match('m', 90, bien('p', b), acheteur('c'), { criteres: recherche }), T)
      const axes = axesComplementaires({
        bedrooms: b.chambres ?? null, condition: b.etatSaisi ?? null, year_built: b.anneeConstruction ?? null,
        year_renovated: b.anneeRenovation ?? null, off_market: b.offMarket === true,
      }, recherche, T)
      expect(lignes.find((l) => l.cle === 'chambres')?.ok, JSON.stringify(b)).toBe(verdict(axes.chambres))
      expect(lignes.find((l) => l.cle === 'etat')?.ok, JSON.stringify(b)).toBe(verdict(axes.etat))
      expect(lignes.find((l) => l.cle === 'offMarket')?.ok, JSON.stringify(b)).toBe(verdict(axes.offMarket))
    }
  })
})
```

- [ ] **Step 2 : Le voir échouer**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts`
Expected : FAIL (champs et lignes inconnus).

- [ ] **Step 3 : `FilBien` (`filModele.ts`)**

Remplacer :

```ts
  /** Annonce du MARCHÉ (lot 2) : sa référence et son lien d'origine. Absent pour un bien en mandat. */
  marche?: { ref: string; sourceUrl: string | null }
}
```

par :

```ts
  /** Annonce du MARCHÉ (lot 2) : sa référence et son lien d'origine. Absent pour un bien en mandat. */
  marche?: { ref: string; sourceUrl: string | null }
  /** Lot C. Chambres ; 0 ou absent : inconnues (le wizard écrit 0 pour « non renseigné »). */
  chambres?: number | null
  /** Lot C. L'état saisi sur un mandat (`condition`) ; une annonce du marché n'en porte pas. */
  etatSaisi?: string | null
  anneeConstruction?: number | null
  anneeRenovation?: number | null
  /** Lot C. L'interrupteur de l'agent ; une annonce du marché est publique. */
  offMarket?: boolean
  /** Lot C, signaux : première apparition sur le marché, premier prix, date de la dernière baisse. */
  vuLe?: string | null
  prixInitial?: number | null
  baisseLe?: string | null
  /** Lot C, signal : la signature du mandat ou sa mise en service, la plus récente des deux. */
  mandatLe?: string | null
}
```

- [ ] **Step 4 : `LigneCritere` et l'état**

Remplacer :

```ts
  | ({ cle: 'equipements'; voulus: string[]; presents: string[] } & Verdict)
```

par :

```ts
  | ({ cle: 'equipements'; voulus: string[]; presents: string[] } & Verdict)
  | ({ cle: 'chambres'; min: number; chambres: number | null } & Verdict)
  | ({ cle: 'etat'; voulu: EtatBien; etat: EtatConnu | null } & Verdict)
  | ({ cle: 'offMarket'; offMarket: boolean } & Verdict)
```

et, juste avant `/** Les lignes « Recherché / Ce bien » : une par critère que la recherche a posé (§4.4). */`, insérer :

```ts
/**
 * L'état d'un bien, du moins bon au meilleur, et ses seuils : ceux du moteur (`ETATS_BIEN`, `ANS_NEUF`,
 * `ANS_RENOVE`, `etatDuBien` dans matching-normalize.ts), à l'identique — `matching-fil-modele.spec.ts` les
 * confronte. Neuf : construit il y a 5 ans au plus, ou en chantier ; rénové : il y a 10 ans au plus.
 */
const ETATS = ['to_renovate', 'good', 'renovated', 'new'] as const
type EtatBien = (typeof ETATS)[number]
type EtatConnu = { etat: EtatBien; source: 'saisi' | 'construction' | 'renovation'; annee: number | null }
const ANS_NEUF = 5
const ANS_RENOVE = 10
const ANS_CHANTIER = 5
const estEtat = (v: unknown): v is EtatBien => typeof v === 'string' && (ETATS as readonly string[]).includes(v)

/** L'état d'un bien, ou `null` : ⛔ jamais « bon état » ni « à rénover » déduit d'une date. */
function etatDuBien(b: FilBien, annee: number): EtatConnu | null {
  if (estEtat(b.etatSaisi)) return { etat: b.etatSaisi, source: 'saisi', annee: null }
  const construit = b.anneeConstruction
  if (construit != null && construit > 0 && construit >= annee - ANS_NEUF && construit <= annee + ANS_CHANTIER) {
    return { etat: 'new', source: 'construction', annee: construit }
  }
  const renove = b.anneeRenovation
  if (renove != null && renove > 0 && renove >= annee - ANS_RENOVE && renove <= annee) {
    return { etat: 'renovated', source: 'renovation', annee: renove }
  }
  return null
}

```

- [ ] **Step 5 : `lignesCriteres` — trois lignes de plus**

Remplacer la signature :

```ts
export function lignesCriteres(m: FilMatch): LigneCritere[] {
```

par :

```ts
export function lignesCriteres(m: FilMatch, maintenant: number = Date.now()): LigneCritere[] {
```

Juste AVANT la ligne `  if (c.surface_min != null) {`, insérer :

```ts
  // Lot C. ⛔ UN FAIT, comme les pièces, à la règle du MOTEUR : 0 chambre n'est pas une valeur, et un critère
  // que le bien ne renseigne pas n'a pas de verdict — il n'a pas compté dans la note.
  if (typeof c.bedrooms_min === 'number' && c.bedrooms_min > 0) {
    const n = m.bien.chambres != null && m.bien.chambres > 0 ? m.bien.chambres : null
    lignes.push({ cle: 'chambres', min: c.bedrooms_min, chambres: n, ecart: null, ok: n == null ? null : n >= c.bedrooms_min })
  }
```

Juste AVANT la ligne `  // Un équipement dont le slug est vide (« — ») n'existe pas pour le moteur : il n'existe pas ici.`, insérer :

```ts
  if (estEtat(c.condition_min)) {
    const voulu = c.condition_min
    const e = etatDuBien(m.bien, new Date(maintenant).getUTCFullYear())
    lignes.push({ cle: 'etat', voulu, etat: e, ecart: null, ok: e == null ? null : ETATS.indexOf(e.etat) >= ETATS.indexOf(voulu) })
  }
```

Remplacer la fin de la fonction :

```ts
    lignes.push({ cle: 'equipements', voulus, presents, ...verdict('features', true) })
  }
  return lignes
}
```

par :

```ts
    lignes.push({ cle: 'equipements', voulus, presents, ...verdict('features', true) })
  }
  // Off-market : toujours évalué — un mandat porte son interrupteur, une annonce du marché est publique.
  if (c.off_market_only === true) {
    const off = m.bien.offMarket === true
    lignes.push({ cle: 'offMarket', offMarket: off, ecart: null, ok: off })
  }
  return lignes
}
```

Compléter l'en-tête du fichier, après le paragraphe « ⛔ LES ÉQUIPEMENTS SE COMPARENT… » :

```ts
 *
 * ⛔ CHAMBRES, ÉTAT, OFF-MARKET (lot C) SONT DES FAITS, comme pièces et surface : le moteur les note sans les
 * écrire dans `reasons` (contrat de cinq clés). Même règle que lui — un critère que le bien ne renseigne pas n'a
 * pas de verdict —, confrontée à `axesComplementaires` par `matching-fil-modele.spec.ts`.
```

- [ ] **Step 6 : Les valeurs (`filValeurs.ts`)**

Remplacer l'import :

```ts
import { cleEquipement, lignesCriteres, type FilMatch, type LigneCritere } from './filModele'
```

par :

```ts
import { cleEquipement, lignesCriteres, type FilMatch, type LigneCritere } from './filModele'

type LigneEtat = Extract<LigneCritere, { cle: 'etat' }>
/** L'état d'un bien, écrit : saisi (« Rénové »), ou avec l'année d'où il vient (« Rénové en 2019 »). */
function texteEtat(e: NonNullable<LigneEtat['etat']>, t: TFunction): string {
  if (e.source === 'construction') return t('fil.etats.neufEn', { annee: e.annee })
  if (e.source === 'renovation') return t('fil.etats.renoveEn', { annee: e.annee })
  return t(`fil.etats.${e.etat}`)
}
```

Dans `valeursCritere`, remplacer :

```ts
        t('fil.valeurs.presents', { n: l.presents.length, total: l.voulus.length }),
      ]
  }
}
```

par :

```ts
        t('fil.valeurs.presents', { n: l.presents.length, total: l.voulus.length }),
      ]
    case 'chambres':
      return [t('fil.valeurs.auMoins', { valeur: nombre(l.min) }), l.chambres == null ? inconnu : nombre(l.chambres)]
    case 'etat':
      return [t(`fil.etats.min.${l.voulu}`), l.etat == null ? inconnu : texteEtat(l.etat, t)]
    case 'offMarket':
      return [t('fil.valeurs.offMarketSeul'), t(l.offMarket ? 'fil.valeurs.offMarket' : 'fil.valeurs.public')]
  }
}
```

Dans `resumeRecherche`, remplacer :

```ts
    .map((l) => (l.cle === 'pieces' ? piecesVoulues(l, t, nombre) : valeursCritere(l, t, nombre)[0]))
```

par :

```ts
    .map((l) => (l.cle === 'pieces' ? piecesVoulues(l, t, nombre)
      // « 3 et plus » ne dit pas de quoi dans une phrase : l'unité, comme pour les pièces.
      : l.cle === 'chambres' ? t('fil.selection.chambresAuMoins', { count: l.min, valeur: nombre(l.min) })
        : valeursCritere(l, t, nombre)[0]))
```

- [ ] **Step 7 : Les libellés (`matching.json`)**

```bash
python3 - <<'PY'
import json
T = {
  'fr': {'criteres': {'chambres': 'Chambres', 'etat': 'État', 'offMarket': 'Off-market'},
         'valeurs': {'offMarketSeul': 'Off-market seulement', 'offMarket': 'Off-market', 'public': 'Diffusé'},
         'etats': {'to_renovate': 'À rénover', 'good': 'Bon état', 'renovated': 'Rénové', 'new': 'Neuf',
                   'neufEn': 'Neuf · construit en {{annee}}', 'renoveEn': 'Rénové en {{annee}}',
                   'min': {'to_renovate': 'Tout état', 'good': 'Bon état ou mieux', 'renovated': 'Rénové ou neuf', 'new': 'Neuf'}},
         'selection': {'chambresAuMoins_one': '{{valeur}} chambre et plus', 'chambresAuMoins_other': '{{valeur}} chambres et plus'}},
  'en': {'criteres': {'chambres': 'Bedrooms', 'etat': 'Condition', 'offMarket': 'Off-market'},
         'valeurs': {'offMarketSeul': 'Off-market only', 'offMarket': 'Off-market', 'public': 'Advertised'},
         'etats': {'to_renovate': 'To renovate', 'good': 'Good condition', 'renovated': 'Renovated', 'new': 'New',
                   'neufEn': 'New · built in {{annee}}', 'renoveEn': 'Renovated in {{annee}}',
                   'min': {'to_renovate': 'Any condition', 'good': 'Good condition or better', 'renovated': 'Renovated or new', 'new': 'New'}},
         'selection': {'chambresAuMoins_one': '{{valeur}} bedroom or more', 'chambresAuMoins_other': '{{valeur}} bedrooms or more'}},
  'de': {'criteres': {'chambres': 'Schlafzimmer', 'etat': 'Zustand', 'offMarket': 'Off-market'},
         'valeurs': {'offMarketSeul': 'Nur Off-market', 'offMarket': 'Off-market', 'public': 'Ausgeschrieben'},
         'etats': {'to_renovate': 'Renovationsbedürftig', 'good': 'Guter Zustand', 'renovated': 'Renoviert', 'new': 'Neubau',
                   'neufEn': 'Neubau · erbaut {{annee}}', 'renoveEn': 'Renoviert {{annee}}',
                   'min': {'to_renovate': 'Jeder Zustand', 'good': 'Guter Zustand oder besser', 'renovated': 'Renoviert oder neu', 'new': 'Neubau'}},
         'selection': {'chambresAuMoins_one': '{{valeur}} Schlafzimmer oder mehr', 'chambresAuMoins_other': '{{valeur}} Schlafzimmer oder mehr'}},
  'it': {'criteres': {'chambres': 'Camere', 'etat': 'Stato', 'offMarket': 'Off-market'},
         'valeurs': {'offMarketSeul': 'Solo off-market', 'offMarket': 'Off-market', 'public': 'Pubblicizzato'},
         'etats': {'to_renovate': 'Da ristrutturare', 'good': 'Buono stato', 'renovated': 'Ristrutturato', 'new': 'Nuovo',
                   'neufEn': 'Nuovo · costruito nel {{annee}}', 'renoveEn': 'Ristrutturato nel {{annee}}',
                   'min': {'to_renovate': 'Qualsiasi stato', 'good': 'Buono stato o migliore', 'renovated': 'Ristrutturato o nuovo', 'new': 'Nuovo'}},
         'selection': {'chambresAuMoins_one': '{{valeur}} camera o più', 'chambresAuMoins_other': '{{valeur}} camere o più'}},
}
for lang, v in T.items():
    p = f'src/i18n/locales/{lang}/matching.json'
    brut = open(p, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'format inattendu : {p}'
    fil = d['fil']
    for groupe in ('criteres', 'valeurs', 'selection'):
        for k in v[groupe]: assert k not in fil[groupe], f'{p} : fil.{groupe}.{k} existe déjà'
        fil[groupe].update(v[groupe])
    assert 'etats' not in fil
    fil['etats'] = v['etats']
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print('ok', p)
PY
```

- [ ] **Step 8 : Vérifier**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-boucle.spec.ts`
Expected : PASS.

Run : `npx tsc -p tsconfig.app.json --noEmit && npm run -s i18n:parity:ci && npm run -s i18n:coverage:ci`
Expected : vert.

- [ ] **Step 9 : Point de commit — avec les Tasks 9 à 12 (le fil)**

---

### Task 9 : Les signaux « pourquoi maintenant »

**Files :**
- Create : `src/components/matching-fil/filSignaux.ts`
- Modify : `src/components/matching-fil/filModele.ts` (ordre à score égal, comptes du résumé « Marché »)
- Test : `tests/unit/matching-fil-signaux.spec.ts` (créé)

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/matching-fil-signaux.spec.ts` :

```ts
/**
 * Les signaux « pourquoi maintenant » du fil (lot C, conception de la boucle §4.1) : une baisse de prix récente,
 * une annonce nouvelle, un nouveau mandat ; et l'ordre qu'ils donnent à score égal. Les seuils sont aussi ceux de
 * la base (`matching_fil_marche_resume`) : ce fichier lit la migration pour les confronter.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  construireFil, construireSelections, type FilBien, type FilMatch, type FilSelectionResume,
} from '@/components/matching-fil/filModele'
import { aUnSignal, JOURS_BAISSE, JOURS_NOUVEAU, signalBien } from '@/components/matching-fil/filSignaux'

const T = Date.parse('2026-09-22T12:00:00.000Z')
const JOUR = 86_400_000
const il = (jours: number) => new Date(T - jours * JOUR).toISOString()
const SANS_FILTRE = { bienId: null, acheteurId: null, texte: '' }
const annonce = (champs: Partial<FilBien> = {}): FilBien => ({
  id: 'ml', titre: 'Annonce', prix: 1_000_000, location: false, type: 'apartment', pieces: 4, surface: 100,
  ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, marche: { ref: 'MG-FL-1', sourceUrl: null }, ...champs,
})
const mandat = (id: string, champs: Partial<FilBien> = {}): FilBien => ({ ...annonce({ id, ...champs }), marche: undefined })
const acheteur = { id: 'c1', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' as const }
const match = (id: string, score: number, bien: FilBien, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score, raisons: null, criteres: null, creeLe: '2026-09-10T10:00:00.000Z', reporteJusquau: null, bien, acheteur, ...champs,
})

describe('signalBien', () => {
  it('une baisse récente, chiffrée et datée ; trop ancienne, plus de signal de baisse', () => {
    expect(signalBien(annonce({ prix: 950_000, prixInitial: 1_000_000, baisseLe: il(5) }), T))
      .toEqual({ genre: 'baisse', montant: 50_000, le: il(5) })
    expect(signalBien(annonce({ prix: 950_000, prixInitial: 1_000_000, baisseLe: il(JOURS_BAISSE + 1) }), T)).toBeNull()
  })
  it('une annonce nouvelle ; la baisse passe avant la nouveauté', () => {
    expect(signalBien(annonce({ vuLe: il(1) }), T)).toEqual({ genre: 'nouveau', le: il(1) })
    expect(signalBien(annonce({ vuLe: il(JOURS_NOUVEAU + 1) }), T)).toBeNull()
    expect(signalBien(annonce({ vuLe: il(1), prix: 950_000, prixInitial: 1_000_000, baisseLe: il(1) }), T)?.genre).toBe('baisse')
  })
  it('un prix nul ou une hausse ne sont pas une baisse ; une date future n’est pas récente', () => {
    expect(signalBien(annonce({ prix: 0, prixInitial: 1_000_000, baisseLe: il(1) }), T)).toBeNull()
    expect(signalBien(annonce({ prix: 1_100_000, prixInitial: 1_000_000, baisseLe: il(1) }), T)).toBeNull()
    expect(signalBien(annonce({ vuLe: new Date(T + JOUR).toISOString() }), T)).toBeNull()
  })
  it('un mandat : signé ou mis en service il y a 7 jours au plus', () => {
    expect(signalBien(mandat('p1', { mandatLe: il(2) }), T)).toEqual({ genre: 'mandat', le: il(2) })
    expect(signalBien(mandat('p1', { mandatLe: il(8) }), T)).toBeNull()
    expect(signalBien(mandat('p1', { vuLe: il(1) }), T), 'un mandat n’est pas « nouveau sur le marché »').toBeNull()
  })
  it('aUnSignal : celui du match (lot B) ou celui de son bien', () => {
    expect(aUnSignal(match('m', 80, mandat('p1', { mandatLe: il(2) })), T)).toBe(true)
    expect(aUnSignal(match('m', 80, mandat('p1', { prix: 900_000 }), {
      suivi: { statut: 'sent', proposeLe: il(3), reponduLe: null, motif: null, note: null, prixPropose: 1_000_000, apprisLe: null },
    }), T)).toBe(true)
    expect(aUnSignal(match('m', 80, mandat('p1')), T)).toBe(false)
  })
})

describe('l’ordre, à score égal', () => {
  it('construireFil : un match à signal, et son groupe, passent devant', () => {
    const neuf = mandat('p2', { mandatLe: il(1) })
    const vieux = mandat('p1')
    const signal = (m: FilMatch) => aUnSignal(m, T)
    const vue = construireFil([match('a', 90, vieux), match('b', 90, neuf, { creeLe: '2026-09-01T00:00:00.000Z' })], SANS_FILTRE, T, signal)
    expect(vue.groupes.map((g) => g.bien.id)).toEqual(['p2', 'p1'])
    // Sans comparateur, l'ordre d'avant : le plus récent d'abord.
    expect(construireFil([match('a', 90, vieux), match('b', 90, neuf, { creeLe: '2026-09-01T00:00:00.000Z' })], SANS_FILTRE, T)
      .groupes.map((g) => g.bien.id)).toEqual(['p1', 'p2'])
  })
  it('construireSelections : une ligne « Marché » à signal passe devant, à meilleur score égal', () => {
    const resume = (id: string, champs: Partial<FilSelectionResume> = {}): FilSelectionResume => ({
      acheteur: { ...acheteur, id, prenom: id, nom: id }, nombre: 3, meilleurScore: 90, vignettes: [], ...champs,
    })
    expect(construireSelections([resume('a'), resume('b', { nouveaux: 1 })], SANS_FILTRE).map((s) => s.acheteur.id)).toEqual(['b', 'a'])
    expect(construireSelections([resume('a', { meilleurScore: 91 }), resume('b', { baisses: 2 })], SANS_FILTRE).map((s) => s.acheteur.id)).toEqual(['a', 'b'])
  })
})

describe('les seuils de la base', () => {
  it('matching_fil_marche_resume compte avec les mêmes seuils', () => {
    const dossier = 'supabase/migrations'
    const fichier = readdirSync(dossier).find((f) => f.endsWith('_matching_explique.sql'))
    expect(fichier, 'migration du lot C introuvable').toBeDefined()
    const sql = readFileSync(join(dossier, fichier!), 'utf8')
    expect(sql).toMatch(new RegExp(`price_reduced_at > now\\(\\) - interval '${JOURS_BAISSE} days'`))
    expect(sql).toMatch(new RegExp(`first_seen_at > now\\(\\) - interval '${JOURS_NOUVEAU} days'`))
  })
})
```

- [ ] **Step 2 : Le voir échouer**

Run : `npx vitest run tests/unit/matching-fil-signaux.spec.ts`
Expected : FAIL (module absent).

- [ ] **Step 3 : Le module**

Créer `src/components/matching-fil/filSignaux.ts` :

```ts
/**
 * Le fil de matchs — les signaux « pourquoi maintenant » (lot C, conception de la boucle §4.1). Module PUR : ni
 * React, ni Supabase, ni traduction.
 *
 * Trois signaux, lus sur le BIEN : une baisse de prix récente (une annonce du marché), une annonce nouvelle sur le
 * marché, un nouveau mandat. Plus celui du lot B, porté par le MATCH (`signalPrix`) : la baisse depuis que le bien a
 * été proposé ou refusé — il passe avant, parce qu'il parle de CET acheteur.
 *
 * ⛔ LES SEUILS SONT AUSSI CEUX DE LA BASE : `matching_fil_marche_resume()` (migration `…_matching_explique.sql`)
 * compte les annonces nouvelles et en baisse de la ligne « Marché » avec les mêmes ; `matching-fil-signaux.spec.ts`
 * lit la migration pour les confronter.
 */
import { temps, type FilBien, type FilMatch } from './filModele'
import { signalPrix } from './filBoucle'

/** Une annonce vue pour la première fois il y a 3 jours au plus est « nouvelle » (§4.1). */
export const JOURS_NOUVEAU = 3
/** Une baisse de prix de 14 jours au plus dit « pourquoi maintenant » ; au-delà, c'est son prix. */
export const JOURS_BAISSE = 14
/** Un mandat signé ou mis en service il y a 7 jours au plus est « nouveau ». */
const JOURS_MANDAT = 7
const JOUR = 86_400_000

export type SignalBien =
  | { genre: 'baisse'; montant: number; le: string }
  | { genre: 'nouveau'; le: string }
  | { genre: 'mandat'; le: string }

/** Une date des `jours` derniers jours ; une date future est une saisie fautive, pas un signal. */
function recente(iso: string | null | undefined, jours: number, maintenant: number): iso is string {
  const t = temps(iso ?? null)
  return t > 0 && t <= maintenant && maintenant - t <= jours * JOUR
}

/**
 * Le signal d'un bien, ou `null`. Une annonce du marché : sa baisse d'abord, puis sa nouveauté. Un mandat : sa
 * signature ou sa mise en service (la plus récente des deux, `mandatLe`).
 *
 * ⛔ Un prix nul (« prix sur demande ») n'est pas une baisse, pas plus qu'une hausse : même règle que `signalPrix`.
 */
export function signalBien(bien: FilBien, maintenant: number): SignalBien | null {
  if (bien.marche) {
    const prix = bien.prix
    const premier = bien.prixInitial
    if (prix != null && prix > 0 && premier != null && premier > prix && recente(bien.baisseLe, JOURS_BAISSE, maintenant)) {
      return { genre: 'baisse', montant: premier - prix, le: bien.baisseLe }
    }
    return recente(bien.vuLe, JOURS_NOUVEAU, maintenant) ? { genre: 'nouveau', le: bien.vuLe } : null
  }
  return recente(bien.mandatLe, JOURS_MANDAT, maintenant) ? { genre: 'mandat', le: bien.mandatLe } : null
}

/** Un match porte un signal : le sien (lot B), ou celui de son bien. C'est ce qui le fait passer devant, à score égal. */
export function aUnSignal(m: FilMatch, maintenant: number): boolean {
  return signalPrix(m) != null || signalBien(m.bien, maintenant) != null
}
```

- [ ] **Step 4 : L'ordre à score égal (`filModele.ts`)**

Remplacer :

```ts
/** Score décroissant, puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. */
function avant(a: FilMatch, b: FilMatch): number {
  return b.score - a.score || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
}

/** Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. */
export function construireFil(matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number): FilVue {
```

par :

```ts
/**
 * Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. L'ordre : score
 * décroissant, puis — à score égal — ce qui porte un signal (`signal`, lot C : `aUnSignal` de filSignaux.ts ;
 * absent, aucun), puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. Un groupe se
 * range par son premier match. ⚠ Le comparateur est PASSÉ, pas importé : filSignaux lit ce module.
 */
export function construireFil(
  matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number, signal: (m: FilMatch) => boolean = () => false,
): FilVue {
  const avant = (a: FilMatch, b: FilMatch): number =>
    b.score - a.score || Number(signal(b)) - Number(signal(a)) || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
```

Dans `FilSelectionResume`, après `vignettes: string[]`, ajouter :

```ts
  /** Lot C : ses annonces nouvelles (3 jours) et en baisse (14 jours), comptées par la base. */
  nouveaux?: number
  baisses?: number
```

Dans `construireSelections`, remplacer :

```ts
    .sort((a, b) =>
      b.meilleurScore - a.meilleurScore || b.nombre - a.nombre
      || nom(a).localeCompare(nom(b), 'fr') || a.acheteur.id.localeCompare(b.acheteur.id))
```

par :

```ts
    .sort((a, b) =>
      b.meilleurScore - a.meilleurScore || Number(aDesSignaux(b)) - Number(aDesSignaux(a)) || b.nombre - a.nombre
      || nom(a).localeCompare(nom(b), 'fr') || a.acheteur.id.localeCompare(b.acheteur.id))
```

et, juste avant `export function construireSelections(`, ajouter :

```ts
/** Une ligne « Marché » porte un signal (lot C) : une annonce nouvelle ou en baisse. */
const aDesSignaux = (s: FilSelectionResume): boolean => (s.nouveaux ?? 0) + (s.baisses ?? 0) > 0
```

Mettre à jour la docstring de `construireSelections` : `par meilleur score (§3.2)` devient `par meilleur score, puis, à score égal, celles qui portent un signal (lot C)`.

- [ ] **Step 5 : Vérifier**

Run : `npx vitest run tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-fil-modele.spec.ts`
Expected : PASS (les ordres d'avant sont inchangés sans comparateur).

- [ ] **Step 6 : Point de commit — avec les Tasks 8 à 12**

---

### Task 10 : Les lectures du fil

**Files :** Modify `src/hooks/useMatchingFil.ts`, `src/hooks/useSelectionMarche.ts` (rien à y changer si elle lit `COLONNES_ANNONCE` et `versBienMarche` — vérifier)

- [ ] **Step 1 : Les colonnes d'une annonce**

Remplacer :

```ts
export const COLONNES_ANNONCE = 'id, title, type, transaction_type, price, current_price, rooms, surface_m2, address, city, canton, features, photos, photos_cf, status, source_portal, source_id, source_url'
```

par :

```ts
export const COLONNES_ANNONCE = 'id, title, type, transaction_type, price, current_price, rooms, surface_m2, address, city, canton, features, photos, photos_cf, status, source_portal, source_id, source_url, bedrooms, year_built, year_renovated, first_seen_at, price_at_first_seen, price_reduced_at'
```

Dans `LigneAnnonce`, après `source_portal: string | null; source_id: string | null; source_url: string | null`, ajouter :

```ts
  /** Lot C : chambres et années (état) ; première apparition, premier prix, dernière baisse (signaux). */
  bedrooms: number | string | null; year_built: number | string | null; year_renovated: number | string | null
  first_seen_at: string | null; price_at_first_seen: number | string | null; price_reduced_at: string | null
```

Dans `LigneBien`, après `address: string | null; city: string | null; canton: string | null; features: unknown; photos: string[] | null`, ajouter :

```ts
  /** Lot C. */
  bedrooms: number | string | null; condition: string | null; year_built: number | string | null
  off_market: boolean | null; mandate_signed_at: string | null; published_at: string | null
```

- [ ] **Step 2 : Les mappeurs**

Juste avant `function versBien(b: LigneBien): FilBien {`, ajouter :

```ts
/** La plus récente de deux dates ISO ; l'une absente, l'autre. */
function plusRecente(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b
  return Date.parse(a) >= Date.parse(b) ? a : b
}
```

Dans `versBien`, remplacer :

```ts
    adresse: b.address, equipements: listeEquipements(b.features), photo: b.photos?.[0] ?? null,
  }
}
```

par :

```ts
    adresse: b.address, equipements: listeEquipements(b.features), photo: b.photos?.[0] ?? null,
    chambres: nombreOuNull(b.bedrooms), etatSaisi: b.condition, anneeConstruction: nombreOuNull(b.year_built),
    offMarket: b.off_market === true,
    // `mandate_signed_at` n'est posé que par « Nouveau bien » (0 mandat sur 6 en production le 22.09.2026) :
    // la mise en service (`published_at`) date aussi un nouveau mandat.
    mandatLe: plusRecente(b.mandate_signed_at, b.published_at),
  }
}
```

Dans `versBienMarche`, remplacer :

```ts
    photo: photoAnnonce(a.photos_cf, a.photos),
    marche: { ref, sourceUrl: a.source_url },
  }
}
```

par :

```ts
    photo: photoAnnonce(a.photos_cf, a.photos),
    marche: { ref, sourceUrl: a.source_url },
    chambres: nombreOuNull(a.bedrooms), anneeConstruction: nombreOuNull(a.year_built), anneeRenovation: nombreOuNull(a.year_renovated),
    // Une annonce du marché est publique par définition.
    offMarket: false,
    vuLe: a.first_seen_at, prixInitial: nombreOuNull(a.price_at_first_seen), baisseLe: a.price_reduced_at,
  }
}
```

- [ ] **Step 3 : Les lectures de `chargerFil`**

Remplacer la lecture des biens :

```ts
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos')
```

par :

```ts
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos, bedrooms, condition, year_built, off_market, mandate_signed_at, published_at')
```

Remplacer l'appel de la RPC :

```ts
    lire<{ contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] | null }>(supabase.rpc('matching_fil_marche'))
      .catch((e: unknown) => {
        const code = (e as { code?: unknown } | null)?.code
        if (code !== 'PGRST202' && code !== '42883') throw e
        console.error('[matching-fil] matching_fil_marche absente : migration pas encore appliquée', e)
        return []
      }),
```

par :

```ts
    lire<{
      contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] | null
      nouveaux: number | null; baisses: number | null
    }>(supabase.rpc('matching_fil_marche_resume'))
      .catch((e: unknown) => {
        const code = (e as { code?: unknown } | null)?.code
        if (code !== 'PGRST202' && code !== '42883') throw e
        console.error('[matching-fil] matching_fil_marche_resume absente : migration pas encore appliquée', e)
        return []
      }),
```

et, plus bas :

```ts
      nombre: r.nombre, meilleurScore: r.meilleur_score, vignettes: r.vignettes ?? [],
```

par :

```ts
      nombre: r.nombre, meilleurScore: r.meilleur_score, vignettes: r.vignettes ?? [],
      nouveaux: r.nouveaux ?? 0, baisses: r.baisses ?? 0,
```

⚠ Si le fichier lit « `matching_fil_marche` » ailleurs (commentaires de tête), mettre à jour le nom.

- [ ] **Step 4 : Vérifier `useSelectionMarche.ts`**

Run : `grep -n "COLONNES_ANNONCE\|versBienMarche" src/hooks/useSelectionMarche.ts`
Expected : les deux sont importés de `useMatchingFil` — la sélection lit donc déjà les nouvelles colonnes, rien à changer.

- [ ] **Step 5 : Vérifier**

Run : `npx tsc -p tsconfig.app.json --noEmit && npm run -s lint:types-freshness`
Expected : vert (la RPC appelée est dans les types, Task 2).

- [ ] **Step 6 : Point de commit — avec les Tasks 8 à 12**

---

### Task 11 : L'écran — les signaux et l'ordre

**Files :**
- Modify : `src/components/matching-fil/{filAffichage.ts,FilListe.tsx,FilSelection.tsx,FilPanneau.tsx,MatchingFil.tsx}`
- Modify : `src/i18n/locales/{fr,de,en,it}/matching.json` (`fil.signal`, `fil.selection`)

- [ ] **Step 1 : Écrire un signal (`filAffichage.ts`)**

Remplacer l'import :

```ts
import { signalPrix } from './filBoucle'
```

par :

```ts
import { signalPrix } from './filBoucle'
import { signalBien, type SignalBien } from './filSignaux'
```

et, juste APRÈS la fonction `texteSignal`, ajouter :

```ts
/**
 * Le signal « pourquoi maintenant » d'un bien (lot C), écrit : court sur une ligne (« Nouveau sur le marché »),
 * daté dans un panneau (« Prix baissé de CHF 250'000 le 18.09 »).
 */
export function texteSignalBien(s: SignalBien, bien: FilBien, t: TFunction, court = false): string {
  switch (s.genre) {
    case 'baisse': {
      const baisse = montant(bien.location, s.montant, t)
      return court ? t('fil.signal.court', { montant: baisse }) : t('fil.signal.baisseMarche', { montant: baisse, date: dateCourte(s.le) })
    }
    case 'nouveau':
      return court ? t('fil.signal.nouveauCourt') : t('fil.signal.nouveau', { date: dateCourte(s.le) })
    case 'mandat':
      return court ? t('fil.signal.mandatCourt') : t('fil.signal.mandat', { date: dateCourte(s.le) })
  }
}

/** Le signal d'un match, écrit : le sien d'abord (lot B — il parle de CET acheteur), sinon celui de son bien. */
export function texteSignalMatch(m: FilMatch, t: TFunction, maintenant: number, court = false): string | null {
  const propre = texteSignal(m, t, court)
  if (propre) return propre
  const s = signalBien(m.bien, maintenant)
  return s ? texteSignalBien(s, m.bien, t, court) : null
}
```

Compléter la première phrase de l'en-tête du fichier : `… et le signal « prix baissé » (lot B).` devient `… le signal « prix baissé » (lot B) et les signaux « pourquoi maintenant » (lot C).`

- [ ] **Step 2 : La ligne « Marché » (`FilListe.tsx`)**

Dans `LigneSelection`, remplacer :

```tsx
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.selection.ligne', { count: s.nombre })}</span>
```

par :

```tsx
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {[
            t('fil.selection.ligne', { count: s.nombre }),
            s.baisses ? t('fil.selection.baisses', { count: s.baisses }) : null,
            s.nouveaux ? t('fil.selection.nouveaux', { count: s.nouveaux }) : null,
          ].filter(Boolean).join(' · ')}
        </span>
```

- [ ] **Step 3 : Un bien de la sélection (`FilSelection.tsx`)**

Remplacer, dans l'import de `./filAffichage`, `texteSignal` par `texteSignalMatch`. Dans `Props`, après `onVoirContact: () => void`, ajouter :

```ts
  /** L'heure de la lecture : les signaux « pourquoi maintenant » s'y mesurent (lot C). */
  maintenant: number
```

ajouter `maintenant` à la déstructuration de `FilSelection`, passer `maintenant={maintenant}` à chaque `<Bien … />`, et, dans `Bien`, remplacer la signature :

```tsx
function Bien({ sp, m, coche, nombre, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; nombre: (n: number) => string
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
```

par :

```tsx
function Bien({ sp, m, coche, nombre, maintenant, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; nombre: (n: number) => string; maintenant: number
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
```

et :

```tsx
  // Un bien refusé pour le PRIX et revenu par une baisse (lot B) : c'est ce qui le ramène, on le dit.
  const signal = texteSignal(m, t)
```

par :

```tsx
  // Le signal du match (lot B : revenu par une baisse depuis la proposition), sinon celui du bien (lot C :
  // nouveau sur le marché, prix baissé), daté.
  const signal = texteSignalMatch(m, t, maintenant)
```

Compléter l'en-tête : après `⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B) le dit sous ses détails (`texteSignal`).`, ajouter ` Un bien nouveau sur le marché ou en baisse le dit aussi, daté (lot C), et passe devant à score égal.`

- [ ] **Step 4 : Le panneau d'un match (`FilPanneau.tsx`)**

Remplacer, dans l'import de `./filAffichage`, `texteSignal` par `texteSignalMatch`. Dans `Props`, après `onVoirContact: () => void`, ajouter `maintenant: number`, l'ajouter à la déstructuration, et remplacer :

```tsx
  const signal = texteSignal(m, t)
```

par :

```tsx
  const signal = texteSignalMatch(m, t, maintenant)
```

- [ ] **Step 5 : L'ordre et l'heure (`MatchingFil.tsx`)**

Ajouter l'import :

```ts
import { aUnSignal } from '@/components/matching-fil/filSignaux'
```

(à côté des autres imports de `@/components/matching-fil/…` ; si le fichier les importe en relatif, `./filSignaux`).

Remplacer :

```ts
  const vue = useMemo(() => construireFil(visibles, filtresValides, chargeLe), [visibles, filtresValides, chargeLe])
```

par :

```ts
  // À score égal, ce qui porte un signal passe devant (lot C) ; mesuré à l'heure de la lecture, stable d'un rendu à l'autre.
  const vue = useMemo(
    () => construireFil(visibles, filtresValides, chargeLe, (m) => aUnSignal(m, chargeLe)),
    [visibles, filtresValides, chargeLe],
  )
```

Remplacer :

```ts
    () => selection.matchs.filter((m) => m.acheteur.id === contactSelection && visibleSelon(masques, m.id, selection.chargeLe)),
```

par :

```ts
    () => selection.matchs
      .filter((m) => m.acheteur.id === contactSelection && visibleSelon(masques, m.id, selection.chargeLe))
      // À score égal, un bien à signal passe devant (lot C) ; le tri est stable : l'ordre de la base départage le reste.
      .sort((a, b) => b.score - a.score || Number(aUnSignal(b, selection.chargeLe)) - Number(aUnSignal(a, selection.chargeLe))),
```

Passer `maintenant={chargeLe}` à `<FilPanneau … />` et `maintenant={selection.chargeLe}` à `<FilSelection … />`.

- [ ] **Step 6 : Les libellés**

```bash
python3 - <<'PY'
import json
T = {
  'fr': {'signal': {'baisseMarche': 'Prix baissé de {{montant}} le {{date}}', 'nouveauCourt': 'Nouveau sur le marché',
                    'nouveau': 'Nouveau sur le marché depuis le {{date}}', 'mandatCourt': 'Nouveau mandat', 'mandat': 'Nouveau mandat du {{date}}'},
         'selection': {'nouveaux_one': '{{count}} nouveau', 'nouveaux_other': '{{count}} nouveaux',
                       'baisses_one': '{{count}} en baisse', 'baisses_other': '{{count}} en baisse'}},
  'en': {'signal': {'baisseMarche': 'Price cut by {{montant}} on {{date}}', 'nouveauCourt': 'New on the market',
                    'nouveau': 'New on the market since {{date}}', 'mandatCourt': 'New mandate', 'mandat': 'New mandate from {{date}}'},
         'selection': {'nouveaux_one': '{{count}} new', 'nouveaux_other': '{{count}} new',
                       'baisses_one': '{{count}} price cut', 'baisses_other': '{{count}} price cuts'}},
  'de': {'signal': {'baisseMarche': 'Preis am {{date}} um {{montant}} gesenkt', 'nouveauCourt': 'Neu auf dem Markt',
                    'nouveau': 'Neu auf dem Markt seit {{date}}', 'mandatCourt': 'Neues Mandat', 'mandat': 'Neues Mandat vom {{date}}'},
         'selection': {'nouveaux_one': '{{count}} neu', 'nouveaux_other': '{{count}} neu',
                       'baisses_one': '{{count}} Preissenkung', 'baisses_other': '{{count}} Preissenkungen'}},
  'it': {'signal': {'baisseMarche': 'Prezzo ribassato di {{montant}} il {{date}}', 'nouveauCourt': 'Nuovo sul mercato',
                    'nouveau': 'Nuovo sul mercato dal {{date}}', 'mandatCourt': 'Nuovo mandato', 'mandat': 'Nuovo mandato del {{date}}'},
         'selection': {'nouveaux_one': '{{count}} nuovo', 'nouveaux_other': '{{count}} nuovi',
                       'baisses_one': '{{count}} ribasso', 'baisses_other': '{{count}} ribassi'}},
}
for lang, v in T.items():
    p = f'src/i18n/locales/{lang}/matching.json'
    brut = open(p, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'format inattendu : {p}'
    for groupe in ('signal', 'selection'):
        for k in v[groupe]: assert k not in d['fil'][groupe], f'{p} : fil.{groupe}.{k} existe déjà'
        d['fil'][groupe].update(v[groupe])
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print('ok', p)
PY
```

- [ ] **Step 7 : Vérifier**

Run : `npx tsc -p tsconfig.app.json --noEmit && npx eslint src/components/matching-fil src/hooks/useMatchingFil.ts`
Expected : aucune erreur.

Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts`
Expected : PASS (aucun littéral de grammaire, aucune couleur en dur).

- [ ] **Step 8 : Point de commit — avec les Tasks 8 à 12**

---

### Task 12 : « Qui pour ce bien ? »

**Files :**
- Modify : `src/components/matching-fil/filModele.ts` (clé `bien:`, ordre), `src/components/matching-fil/FilListe.tsx` (l'en-tête devient une ligne), `src/components/matching-fil/MatchingFil.tsx`
- Create : `src/components/matching-fil/FilQuiPourCeBien.tsx`, `src/hooks/useAnciensProspects.ts`
- Modify : `src/i18n/locales/{fr,de,en,it}/matching.json` (`fil.quiPour`)
- Modify : `tests/unit/matching-fil-modele.spec.ts`, `tests/unit/matching-sans-sortie.spec.ts`

- [ ] **Step 1 : Les tests de l'ordre — l'en-tête de chaque bien ouvre son groupe**

Dans `tests/unit/matching-fil-modele.spec.ts`, remplacer les attentes d'ordre :

| Avant | Après |
|---|---|
| `expect(vue.ordre).toEqual(['m5', 'm2', 'm3'])` | `expect(vue.ordre).toEqual(['bien:p2', 'm5', 'bien:p1', 'm2', 'm3'])` |
| `expect(vue.ordre).toEqual(['c', 'a', 'b', 'd'])` | `expect(vue.ordre).toEqual(['bien:p1', 'c', 'a', 'b', 'd'])` |
| `expect(vue.ordre).toEqual(['m3'])` | `expect(vue.ordre).toEqual(['bien:p1', 'm3'])` |
| `….ordre).toEqual(['m2', 'm3'])` (filtre `bienId: 'p1'`) | `….ordre).toEqual(['bien:p1', 'm2', 'm3'])` |
| `….ordre).toEqual(['m2'])` (filtre `acheteurId: 'c7'`) | `….ordre).toEqual(['bien:p1', 'm2'])` |
| `….ordre).toEqual(['m5'])` (filtre `texte: 'lefevre'`) | `….ordre).toEqual(['bien:p2', 'm5'])` |
| `….ordre).toEqual(['m5'])` (filtre `texte: '  COLOGNY '`) | `….ordre).toEqual(['bien:p2', 'm5'])` |
| `….ordre).toEqual(['m6'])` (filtre `texte: 'vandoeuvres'`) | `….ordre).toEqual(['bien:p3', 'm6'])` |

Les `compte` ne changent pas : un en-tête n'est pas une ligne à traiter. Ajouter `bienDeCle, cleBien` à l'import de `filModele` et, dans le `describe('construireFil'`, ce test :

```ts
  it('l’en-tête d’un bien est une ligne de l’ordre, pas du compte', () => {
    const vue = construireFil([match('m2', 91, champel, emma)], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre[0]).toBe(cleBien('p1'))
    expect(bienDeCle(vue.ordre[0]!)).toBe('p1')
    expect(bienDeCle('m2')).toBeNull()
    expect(vue.compte).toBe(1)
  })
```

Dans `tests/unit/matching-sans-sortie.spec.ts`, ajouter à la liste des fichiers du matching, après `'src/hooks/useAjouterSelection.ts',` :

```ts
  'src/hooks/useAnciensProspects.ts',
```

- [ ] **Step 2 : Les voir échouer**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-sans-sortie.spec.ts`
Expected : FAIL (`cleBien` absent ; `useAnciensProspects.ts` absent).

- [ ] **Step 3 : La clé et l'ordre (`filModele.ts`)**

Juste avant `const PREFIXE_SELECTION = 'marche:'`, ajouter :

```ts
const PREFIXE_BIEN = 'bien:'

/** La ligne « Qui pour ce bien ? » d'un bien en mandat (lot C) : son en-tête, dans l'ordre du fil. */
export const cleBien = (bienId: string): string => `${PREFIXE_BIEN}${bienId}`

/** Le bien d'un en-tête, ou `null` pour toute autre ligne. */
export const bienDeCle = (cle: string): string | null => (cle.startsWith(PREFIXE_BIEN) ? cle.slice(PREFIXE_BIEN.length) : null)
```

Dans `construireFil`, remplacer :

```ts
  const ordre = groupes.flatMap((g) => g.matchs.map((m) => m.id))
  return { groupes, reportes, compte: ordre.length, ordre }
```

par :

```ts
  // L'en-tête de chaque bien ouvre son groupe (« Qui pour ce bien ? », lot C) : une ligne de l'ordre, pas du compte.
  const ordre = groupes.flatMap((g) => [cleBien(g.bien.id), ...g.matchs.map((m) => m.id)])
  return { groupes, reportes, compte: groupes.reduce((n, g) => n + g.matchs.length, 0), ordre }
```

Dans `FilVue`, remplacer `/** Ordre de lecture des lignes, celui de ↑/↓. */` par `/** Ordre de lecture des lignes, celui de ↑/↓ : chaque groupe s'ouvre sur l'en-tête de son bien (\`cleBien\`). */`.

⚠ `cleBien` est déclaré plus bas que `construireFil` dans le fichier : c'est une `const` de module, lue à l'APPEL, jamais à l'évaluation du module — l'ordre des déclarations n'y fait rien.

- [ ] **Step 4 : Les anciens prospects (`src/hooks/useAnciensProspects.ts`)**

```ts
/**
 * « Qui pour ce bien ? » (lot C) — les anciens prospects d'un bien, notés À LA DEMANDE par `matching-engine` (mode
 * `prospects`, lecture seule), et le geste qui en réactive un (mode `reactiver-prospect`). Règles côté moteur :
 * `supabase/functions/_shared/matching-prospects.ts`.
 *
 * ⚠ La réponse de l'edge est relue champ par champ : un prospect mal formé est écarté, jamais affiché à moitié.
 * ⚠ Réactiver invalide TOUT le fil (`CLE_FIL`) : le match né entre dans « À proposer », et la liste des prospects —
 * sous la même clé — le perd.
 * ⛔ Rien n'est écrit à l'acheteur : la seule fonction appelée est `matching-engine` (`matching-sans-sortie.spec.ts`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CLE_FIL } from '@/hooks/useMatchingFil'

/** Un ancien prospect d'un bien, tel que le moteur le rend. */
export interface AncienProspect {
  contact_id: string
  prenom: string
  nom: string
  client_search_id: string
  score: number
  origine: 'recherche_close' | 'deal_perdu'
  /** La perte du deal, sinon la clôture de la recherche. */
  depuis: string | null
}

function lireProspects(data: unknown): AncienProspect[] {
  const brut = (data as { prospects?: unknown } | null)?.prospects
  if (!Array.isArray(brut)) return []
  return brut.flatMap((p): AncienProspect[] => {
    const x = (p ?? {}) as Record<string, unknown>
    if (typeof x.contact_id !== 'string' || typeof x.client_search_id !== 'string' || typeof x.score !== 'number') return []
    if (x.origine !== 'recherche_close' && x.origine !== 'deal_perdu') return []
    return [{
      contact_id: x.contact_id, client_search_id: x.client_search_id, score: x.score, origine: x.origine,
      prenom: typeof x.prenom === 'string' ? x.prenom : '', nom: typeof x.nom === 'string' ? x.nom : '',
      depuis: typeof x.depuis === 'string' ? x.depuis : null,
    }]
  })
}

/** Les anciens prospects d'un bien en mandat, et `reactiver`, le geste qui en fait entrer un dans « À proposer ». */
export function useAnciensProspects(propertyId: string | null) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const qc = useQueryClient()
  const requete = useQuery({
    queryKey: [CLE_FIL, 'prospects', agencyId, propertyId],
    enabled: Boolean(agencyId && propertyId),
    // Noter à la demande relit toutes les recherches closes de l'agence : pas à chaque retour sur la ligne.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('matching-engine', { body: { mode: 'prospects', property_id: propertyId } })
      if (error) throw error
      return lireProspects(data)
    },
  })
  const reactiver = useMutation({
    mutationFn: async (p: AncienProspect) => {
      const { data, error } = await supabase.functions.invoke('matching-engine', {
        body: { mode: 'reactiver-prospect', property_id: propertyId, client_search_id: p.client_search_id, origine: p.origine },
      })
      if (error) throw error
      return data as { match_id: string; score: number }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLE_FIL] }),
  })
  return { ...requete, reactiver }
}
```

- [ ] **Step 5 : Le panneau (`src/components/matching-fil/FilQuiPourCeBien.tsx`)**

```tsx
/**
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat.
 * (1) Les acquéreurs compatibles : ses matchs que le fil connaît, par score, avec leur état ; un match à proposer
 * s'ouvre en un clic. (2) Les anciens prospects, notés À LA DEMANDE par le moteur (`useAnciensProspects`) :
 * recherche close depuis plus de 90 jours, ou deal perdu ; « Réactiver » rouvre sa recherche et fait entrer le match
 * dans « À proposer ». Les prescripteurs attendent le modèle relationnel (étape 6) : pas de section vide.
 *
 * ⛔ Réactiver n'écrit rien à l'acheteur : c'est l'agent qui l'appellera (conception de la boucle, §1).
 */
import type { CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAnciensProspects, type AncienProspect } from '@/hooks/useAnciensProspects'
import { initiales, palierScore, temps, type FilBien, type FilMatch } from './filModele'
import { dateCourte, encreAccent, MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilBouton, FilScore, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  bien: FilBien
  /** Ses matchs connus du fil : à proposer, reportés, et ceux de la boucle. */
  compatibles: FilMatch[]
  /** L'heure de la lecture du fil. */
  maintenant: number
  onChoisir: (matchId: string) => void
  onVoirBien: () => void
  onVoirContact: (contactId: string) => void
}

export default function FilQuiPourCeBien({ sp, bien, compatibles, maintenant, onChoisir, onVoirBien, onVoirContact }: Props) {
  const { t } = useTranslation('matching')
  const toast = useToast()
  const prospects = useAnciensProspects(bien.id)
  const signal = signalBien(bien, maintenant)
  const tries = [...compatibles].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const anciens = prospects.data ?? []
  const reactiver = (p: AncienProspect): void => {
    prospects.reactiver.mutate(p, {
      onSuccess: () => { toast.success(t('fil.quiPour.reactive', { prenom: p.prenom })) },
      onError: () => { toast.error(t('fil.quiPour.erreurReactiver')) },
    })
  }
  const titre: CSSProperties = { margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }
  const aide: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }
  const nom: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
  }
  const ligne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-sm)',
    paddingBottom: 'var(--crm-space-sm)', borderBottom: `1px solid ${sp.cardBorder}`,
  }
  const liste: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }
  return (
    <section aria-label={t('fil.quiPour.titreAria', { titre: bien.titre })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
        <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
        <div style={{ minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
          }}>
            {t('fil.quiPour.titre')}
          </span>
          <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
          </p>
          {signal && (
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {texteSignalBien(signal, bien, t)}
            </p>
          )}
          <button type="button" onClick={onVoirBien} style={{ ...nom, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: encreAccent(sp) }}>
            {t('fil.voirBien')}
          </button>
        </div>
      </div>

      <div>
        <h3 style={titre}>{t('fil.quiPour.compatibles', { count: tries.length })}</h3>
        {tries.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunCompatible')}</p> : (
          <ul style={liste}>
            {tries.map((m) => {
              const reporte = m.reporteJusquau != null && temps(m.reporteJusquau) > maintenant
              const ouvrable = !reporte && (!m.suivi || m.suivi.statut === 'suggested')
              return (
                <li key={m.id} style={ligne}>
                  <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" onClick={() => onVoirContact(m.acheteur.id)} style={nom}>{m.acheteur.prenom} {m.acheteur.nom}</button>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{etatCompatible(m, reporte, t)}</span>
                  </span>
                  <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
                  {ouvrable && (
                    <FilBouton sp={sp} compact onClick={() => onChoisir(m.id)}>
                      {t('fil.quiPour.ouvrir')}<span className="sr-only"> {m.acheteur.prenom} {m.acheteur.nom}</span>
                    </FilBouton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 style={titre}>{t('fil.quiPour.anciens')}</h3>
        <p style={{ ...aide, marginBottom: 'var(--crm-space-md)' }}>{t('fil.quiPour.anciensAide')}</p>
        {prospects.isLoading ? <p role="status" style={aide}>{t('fil.quiPour.chargement')}</p>
          : prospects.isError ? (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
              <p style={aide}>{t('fil.quiPour.erreur')}</p>
              <FilBouton sp={sp} compact onClick={() => { void prospects.refetch() }}>{t('fil.reessayer')}</FilBouton>
            </div>
          ) : anciens.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunAncien')}</p> : (
            <ul style={liste}>
              {anciens.map((p) => (
                <li key={p.contact_id} style={ligne}>
                  <FilAvatar sp={sp} texte={initiales(p.prenom, p.nom)} taille={28} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" onClick={() => onVoirContact(p.contact_id)} style={nom}>{p.prenom} {p.nom}</button>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{origine(p, t)}</span>
                  </span>
                  <FilScore sp={sp} score={p.score} palier={palierScore(p.score)} />
                  <FilBouton sp={sp} compact principal desactive={prospects.reactiver.isPending} onClick={() => reactiver(p)}>
                    {t('fil.quiPour.reactiver')}<span className="sr-only"> {p.prenom} {p.nom}</span>
                  </FilBouton>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  )
}

/** Où en est un acquéreur compatible, écrit. */
function etatCompatible(m: FilMatch, reporte: boolean, t: TFunction): string {
  if (reporte && m.reporteJusquau) return t('fil.quiPour.etat.reporte', { date: dateCourte(m.reporteJusquau) })
  const s = m.suivi
  if (!s || s.statut === 'suggested') return t('fil.quiPour.etat.aProposer')
  if (s.statut === 'sent') return s.proposeLe ? t('fil.quiPour.etat.propose', { date: dateCourte(s.proposeLe) }) : t('fil.quiPour.etat.proposeSansDate')
  if (s.statut === 'interested') return t('fil.quiPour.etat.interesse')
  if (s.statut === 'visit_planned') return t('fil.quiPour.etat.visite')
  return s.motif ? t('fil.quiPour.etat.refuse', { motif: t(`fil.motifs.${s.motif}`) }) : t('fil.quiPour.etat.refuseSansMotif')
}

/** Ce qui fait un ancien prospect, daté. */
function origine(p: AncienProspect, t: TFunction): string {
  if (p.origine === 'deal_perdu') return p.depuis ? t('fil.quiPour.dealPerdu', { date: dateCourte(p.depuis) }) : t('fil.quiPour.dealPerduSansDate')
  return p.depuis ? t('fil.quiPour.rechercheClose', { date: dateCourte(p.depuis) }) : t('fil.quiPour.rechercheCloseSansDate')
}
```

- [ ] **Step 6 : L'en-tête devient une ligne (`FilListe.tsx`)**

Remplacer, dans l'en-tête du fichier :

```ts
 * ⚠ L'en-tête d'un bien est MASQUÉ aux lecteurs d'écran : un `listbox` ne contient que des options et
 * des groupes, et le groupe porte déjà le titre du bien en libellé.
```

par :

```ts
 * ⚠ L'en-tête d'un bien est une LIGNE depuis le lot C (`cleBien`) : choisie, elle ouvre « Qui pour ce bien ? ».
 * Une `option` dans le groupe du bien — un `listbox` ne contient que des options et des groupes. Il porte le
 * signal « nouveau mandat ».
```

Remplacer les imports :

```ts
import {
  cleSelection, initiales, lignesCriteres, palierScore, premierEcart,
  type FilBien, type FilMatch, type FilSelectionResume, type FilVue,
} from './filModele'
import type { Correction } from './filApprendre'
import { dateCourte, encreAccent, prixBien, styleLigne, teinteEcart, texteSignal, unSeulClic } from './filAffichage'
```

par :

```ts
import {
  cleBien, cleSelection, initiales, lignesCriteres, palierScore, premierEcart,
  type FilBien, type FilMatch, type FilSelectionResume, type FilVue,
} from './filModele'
import type { Correction } from './filApprendre'
import { dateCourte, encreAccent, prixBien, styleLigne, teinteEcart, texteSignal, texteSignalBien, unSeulClic } from './filAffichage'
import { signalBien } from './filSignaux'
```

Dans `Props`, après `onReactiver: (id: string) => void`, ajouter :

```ts
  /** L'heure de la lecture : le signal « nouveau mandat » s'y mesure (lot C). */
  maintenant: number
```

ajouter `maintenant` à la déstructuration de `FilListe`, et remplacer :

```tsx
                <EnTeteBien sp={sp} bien={g.bien} nombre={g.matchs.length} />
```

par :

```tsx
                <EnTeteBien sp={sp} bien={g.bien} nombre={g.matchs.length} maintenant={maintenant}
                  active={cleBien(g.bien.id) === courant} onChoisir={onChoisir} />
```

Remplacer toute la fonction `EnTeteBien` par :

```tsx
/** L'en-tête d'un bien : une ligne du fil qui ouvre « Qui pour ce bien ? » (lot C), avec son signal « nouveau mandat ». */
function EnTeteBien({ sp, bien, nombre, maintenant, active, onChoisir }: {
  sp: CrmPalette; bien: FilBien; nombre: number; maintenant: number; active: boolean; onChoisir: (id: string) => void
}) {
  const { t } = useTranslation('matching')
  const cle = cleBien(bien.id)
  const signal = signalBien(bien, maintenant)
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      aria-label={t('fil.quiPour.ligneAria', { titre: bien.titre, count: nombre })}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(cle))} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <FilVignette sp={sp} photo={bien.photo} largeur={40} hauteur={30} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bien.titre}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {[prixBien(bien, t), t('fil.acheteurs', { count: nombre }), signal ? texteSignalBien(signal, bien, t) : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flex: 'none', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: encreAccent(sp) }}>
        {t('fil.quiPour.titre')}<MEIcon name="arrow-right" size={12} color={encreAccent(sp)} />
      </span>
    </button>
  )
}
```

- [ ] **Step 7 : Le conteneur (`MatchingFil.tsx`)**

Ajouter `bienDeCle` à l'import de `filModele` et l'import du panneau :

```ts
import FilQuiPourCeBien from '@/components/matching-fil/FilQuiPourCeBien'
```

(même forme que les imports voisins des panneaux, relative ou `@/`).

Remplacer :

```ts
  // Sélection DÉRIVÉE : une ligne qui sort du fil (geste, filtre, onglet) cède la place à la première restante.
  const courant = choix && ordre.includes(choix) ? choix : (ordre[0] ?? null)
```

par :

```ts
  // Sélection DÉRIVÉE : une ligne qui sort du fil (geste, filtre, onglet) cède la place à la première restante —
  // la première LIGNE À TRAITER, pas l'en-tête d'un bien (« Qui pour ce bien ? », lot C) : on arrive sur un match.
  const parDefaut = ordre.find((k) => bienDeCle(k) == null) ?? ordre[0] ?? null
  const courant = choix && ordre.includes(choix) ? choix : parDefaut
```

Remplacer :

```ts
  const match = onglet === 'aProposer' && courant && !contactSelection && !correction
    ? visibles.find((m) => m.id === courant) ?? null : null
```

par :

```ts
  // « Qui pour ce bien ? » : l'en-tête d'un bien, choisi.
  const bienQuiPour = onglet === 'aProposer' && courant ? bienDeCle(courant) : null
  const groupeQuiPour = bienQuiPour ? vue.groupes.find((g) => g.bien.id === bienQuiPour) ?? null : null
  const match = onglet === 'aProposer' && courant && !contactSelection && !correction && !bienQuiPour
    ? visibles.find((m) => m.id === courant) ?? null : null
```

Juste après la ligne `const aConclure = …`, ajouter :

```ts
  // Ses acquéreurs compatibles : ses matchs que le fil connaît, à proposer (reportés compris) et de la boucle.
  const compatibles = useMemo(
    () => (bienQuiPour ? [...visibles, ...visiblesBoucle].filter((m) => m.bien.id === bienQuiPour && !m.bien.marche) : []),
    [bienQuiPour, visibles, visiblesBoucle],
  )
```

Dans la chaîne des panneaux, remplacer :

```tsx
  ) : match ? (
    <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)}
```

par :

```tsx
  ) : groupeQuiPour ? (
    <FilQuiPourCeBien sp={sp} bien={groupeQuiPour.bien} compatibles={compatibles} maintenant={chargeLe}
      onChoisir={(id) => { setChoix(id); focaliser(id) }}
      onVoirBien={() => navigate(`/dashboard/listings/${groupeQuiPour.bien.id}`)}
      onVoirContact={(id) => navigate(`/dashboard/contacts/${id}`)} />
  ) : match ? (
    <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)}
```

et passer `maintenant={chargeLe}` à `<FilListe … />`.

Aucune touche à ajouter : sur un en-tête, `match` est nul, et `E`, `P`, `X` ne font rien (`if (!match) return`).

Compléter l'en-tête de `MatchingFil.tsx`, après le paragraphe « ⚠ Lot 2 : une ligne « Marché »… » :

```ts
 * ⚠ Lot C : l'en-tête de chaque bien en mandat est une ligne (`cleBien`) ; choisi, il montre « Qui pour ce
 * bien ? » (`FilQuiPourCeBien`). Il n'est jamais choisi D'OFFICE : on arrive sur le premier match. À score égal,
 * ce qui porte un signal « pourquoi maintenant » passe devant (`aUnSignal`, mesuré à l'heure de la lecture).
```

- [ ] **Step 8 : Les libellés (`fil.quiPour`)**

```bash
python3 - <<'PY'
import json
T = {
  'fr': {'titre': 'Qui pour ce bien ?', 'titreAria': 'Qui pour « {{titre}} » ?',
         'ligneAria_one': 'Qui pour « {{titre}} » ? {{count}} acheteur compatible', 'ligneAria_other': 'Qui pour « {{titre}} » ? {{count}} acheteurs compatibles',
         'compatibles_one': '{{count}} acquéreur compatible', 'compatibles_other': '{{count}} acquéreurs compatibles',
         'aucunCompatible': "Aucun acquéreur compatible pour l'instant.", 'ouvrir': 'Ouvrir',
         'anciens': 'Anciens prospects',
         'anciensAide': "Recherche close depuis plus de 90 jours, ou deal perdu depuis moins de deux ans. Notés à la demande, au même seuil que le moteur.",
         'chargement': 'Notation des anciens prospects…', 'erreur': "Les anciens prospects n'ont pas pu être notés.",
         'aucunAncien': 'Aucun ancien prospect ne correspond à ce bien.',
         'rechercheClose': 'Recherche close le {{date}}', 'rechercheCloseSansDate': 'Recherche close',
         'dealPerdu': 'Deal perdu le {{date}}', 'dealPerduSansDate': 'Deal perdu',
         'reactiver': 'Réactiver', 'reactive': '{{prenom}} est de retour dans « À proposer »',
         'erreurReactiver': "La réactivation n'a pas abouti. Réessayez.",
         'etat': {'aProposer': 'À proposer', 'reporte': "Reporté jusqu'au {{date}}", 'propose': 'Proposé le {{date}}', 'proposeSansDate': 'Proposé',
                  'interesse': 'Intéressé·e', 'visite': 'Visite planifiée', 'refuse': 'Pas intéressé·e · {{motif}}', 'refuseSansMotif': 'Pas intéressé·e'}},
  'en': {'titre': 'Who is this property for?', 'titreAria': 'Who is “{{titre}}” for?',
         'ligneAria_one': 'Who is “{{titre}}” for? {{count}} matching buyer', 'ligneAria_other': 'Who is “{{titre}}” for? {{count}} matching buyers',
         'compatibles_one': '{{count}} matching buyer', 'compatibles_other': '{{count}} matching buyers',
         'aucunCompatible': 'No matching buyer yet.', 'ouvrir': 'Open',
         'anciens': 'Former prospects',
         'anciensAide': 'Search closed for more than 90 days, or deal lost within the last two years. Scored on demand, at the same threshold as the engine.',
         'chargement': 'Scoring former prospects…', 'erreur': 'Former prospects could not be scored.',
         'aucunAncien': 'No former prospect matches this property.',
         'rechercheClose': 'Search closed on {{date}}', 'rechercheCloseSansDate': 'Search closed',
         'dealPerdu': 'Deal lost on {{date}}', 'dealPerduSansDate': 'Deal lost',
         'reactiver': 'Reactivate', 'reactive': '{{prenom}} is back in “To propose”',
         'erreurReactiver': 'The reactivation did not go through. Try again.',
         'etat': {'aProposer': 'To propose', 'reporte': 'Postponed until {{date}}', 'propose': 'Proposed on {{date}}', 'proposeSansDate': 'Proposed',
                  'interesse': 'Interested', 'visite': 'Viewing planned', 'refuse': 'Not interested · {{motif}}', 'refuseSansMotif': 'Not interested'}},
  'de': {'titre': 'Für wen ist dieses Objekt?', 'titreAria': 'Für wen ist «{{titre}}»?',
         'ligneAria_one': 'Für wen ist «{{titre}}»? {{count}} passender Käufer', 'ligneAria_other': 'Für wen ist «{{titre}}»? {{count}} passende Käufer',
         'compatibles_one': '{{count}} passender Käufer', 'compatibles_other': '{{count}} passende Käufer',
         'aucunCompatible': 'Noch kein passender Käufer.', 'ouvrir': 'Öffnen',
         'anciens': 'Frühere Interessenten',
         'anciensAide': 'Suche seit mehr als 90 Tagen geschlossen, oder Deal in den letzten zwei Jahren verloren. Auf Abruf bewertet, mit derselben Schwelle wie die Engine.',
         'chargement': 'Frühere Interessenten werden bewertet…', 'erreur': 'Die früheren Interessenten konnten nicht bewertet werden.',
         'aucunAncien': 'Kein früherer Interessent passt zu diesem Objekt.',
         'rechercheClose': 'Suche geschlossen am {{date}}', 'rechercheCloseSansDate': 'Suche geschlossen',
         'dealPerdu': 'Deal verloren am {{date}}', 'dealPerduSansDate': 'Deal verloren',
         'reactiver': 'Reaktivieren', 'reactive': '{{prenom}} ist zurück in «Vorzuschlagen»',
         'erreurReactiver': 'Die Reaktivierung ist fehlgeschlagen. Versuchen Sie es erneut.',
         'etat': {'aProposer': 'Vorzuschlagen', 'reporte': 'Verschoben bis {{date}}', 'propose': 'Vorgeschlagen am {{date}}', 'proposeSansDate': 'Vorgeschlagen',
                  'interesse': 'Interessiert', 'visite': 'Besichtigung geplant', 'refuse': 'Kein Interesse · {{motif}}', 'refuseSansMotif': 'Kein Interesse'}},
  'it': {'titre': 'Per chi è questo immobile?', 'titreAria': 'Per chi è «{{titre}}»?',
         'ligneAria_one': 'Per chi è «{{titre}}»? {{count}} acquirente compatibile', 'ligneAria_other': 'Per chi è «{{titre}}»? {{count}} acquirenti compatibili',
         'compatibles_one': '{{count}} acquirente compatibile', 'compatibles_other': '{{count}} acquirenti compatibili',
         'aucunCompatible': 'Ancora nessun acquirente compatibile.', 'ouvrir': 'Apri',
         'anciens': 'Ex potenziali acquirenti',
         'anciensAide': 'Ricerca chiusa da più di 90 giorni, o trattativa persa negli ultimi due anni. Valutati su richiesta, alla stessa soglia del motore.',
         'chargement': 'Valutazione degli ex potenziali acquirenti…', 'erreur': 'Non è stato possibile valutare gli ex potenziali acquirenti.',
         'aucunAncien': 'Nessun ex potenziale acquirente corrisponde a questo immobile.',
         'rechercheClose': 'Ricerca chiusa il {{date}}', 'rechercheCloseSansDate': 'Ricerca chiusa',
         'dealPerdu': 'Trattativa persa il {{date}}', 'dealPerduSansDate': 'Trattativa persa',
         'reactiver': 'Riattiva', 'reactive': '{{prenom}} è di nuovo in «Da proporre»',
         'erreurReactiver': 'La riattivazione non è riuscita. Riprovi.',
         'etat': {'aProposer': 'Da proporre', 'reporte': 'Rinviato fino al {{date}}', 'propose': 'Proposto il {{date}}', 'proposeSansDate': 'Proposto',
                  'interesse': 'Interessato', 'visite': 'Visita pianificata', 'refuse': 'Non interessato · {{motif}}', 'refuseSansMotif': 'Non interessato'}},
}
for lang, v in T.items():
    p = f'src/i18n/locales/{lang}/matching.json'
    brut = open(p, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'format inattendu : {p}'
    assert 'quiPour' not in d['fil']
    d['fil']['quiPour'] = v
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print('ok', p)
PY
```

`reactive` et `etat.aProposer` reprennent le libellé de l'onglet (`fil.onglets.aProposer`) de chaque langue.

- [ ] **Step 9 : Vérifier**

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/clavier-ecran-cache.spec.ts`
Expected : PASS.

Run : `npx tsc -p tsconfig.app.json --noEmit && npx eslint src/components/matching-fil src/hooks/useAnciensProspects.ts && npm run -s lint:deadcode && npm run -s i18n:parity:ci && npm run -s i18n:coverage:ci && npm run -s lint:prose`
Expected : vert.

- [ ] **Step 10 : Point de commit (au signal de Julien) — le fil, Tasks 8 à 12**

```bash
git add src/components/matching-fil src/hooks/useMatchingFil.ts src/hooks/useAnciensProspects.ts src/i18n/locales/*/matching.json tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-signaux.spec.ts tests/unit/matching-sans-sortie.spec.ts
git commit -m "feat(matching): le fil explique chambres, état et off-market, dit pourquoi maintenant, et répond « Qui pour ce bien ? »"
```

---

### Task 13 : Le banc du lot C

**Files :**
- Modify : `src/pages/dev/crmFixtures.ts`
- Test : `tests/unit/banc-matching-explique.spec.ts` (créé)

Le banc montre, dans « À proposer » : **Attique · Florissant** (`p3`, off-market, « Nouveau mandat ») en tête de « Vos biens », avec Anastasia (100, les trois critères tenus) et Emma (100) ; la ligne « Marché » d'Anastasia, « 2 biens · 1 en baisse · 1 nouveau » ; et, sur l'en-tête de Florissant, « Qui pour ce bien ? » avec deux anciens prospects, Philippe Rey (recherche close il y a 120 jours, 100) et Nathalie Gerber (deal perdu il y a 150 jours, 96), réactivables. Les notes sont celles du vrai moteur (calculées le 22.09.2026, confrontées par la spec).

- [ ] **Step 1 : Écrire la spec**

Créer `tests/unit/banc-matching-explique.spec.ts` :

```ts
/**
 * Le banc `/dev/crm` et le lot C : ses matchs portent la note du VRAI moteur (chambres, état, off-market
 * compris), ses anciens prospects aussi, et son `matching-engine` les rend puis les réactive comme l'edge.
 *
 * ⚠ Le banc ne note pas (`src/` ne charge pas le barème Deno) : il porte des notes calculées, que ce fichier
 * confronte à `calculateScoreV2`. ⚠ Les fixtures sont des tableaux de MODULE que la réactivation modifie :
 * chaque test relit un module neuf (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'

type Ligne = Record<string, unknown> & { id: string }
const JOUR = 86_400_000

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const table = (nom: string): Ligne[] => f.CRM_TABLES[nom] as Ligne[]
  const ligne = (nom: string, id: string): Ligne => {
    const l = table(nom).find((x) => x.id === id)
    if (!l) throw new Error(`${nom}/${id} absent du banc`)
    return l
  }
  const edge = f.CRM_EDGES['matching-engine'] as (a: Record<string, unknown>) => Record<string, unknown>
  const resume = f.CRM_RPC.matching_fil_marche_resume as () => Record<string, unknown>[]
  return { table, ligne, edge, resume }
}

describe('le banc du lot C', () => {
  it('ses matchs portent la note du moteur, raisons comprises', async () => {
    const { ligne } = await banc()
    for (const id of ['m22', 'm23', 'm24', 'm25']) {
      const m = ligne('matches', id)
      const bien = m.property_id ? ligne('properties', m.property_id as string) : ligne('market_listings', m.market_listing_id as string)
      const criteres = ligne('client_searches', m.client_search_id as string).criteria as Record<string, unknown>
      const note = calculateScoreV2(bien, criteres, DEFAULT_SCORING_CONFIG, null, Date.now())
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
    }
  })

  it('Florissant est le seul nouveau mandat ; Champel et Cologny sont anciens', async () => {
    const { ligne } = await banc()
    const recent = (b: Ligne) => [b.mandate_signed_at, b.published_at]
      .some((d) => typeof d === 'string' && Date.now() - Date.parse(d) <= 7 * JOUR)
    expect(recent(ligne('properties', 'p3'))).toBe(true)
    expect(recent(ligne('properties', 'p1'))).toBe(false)
    expect(recent(ligne('properties', 'p2'))).toBe(false)
  })

  it('les anciens prospects de Florissant : recherche close depuis 90 jours ou deal perdu, notés par le moteur', async () => {
    const { ligne, edge } = await banc()
    const { prospects } = edge({ mode: 'prospects', property_id: 'p3' }) as { prospects: Record<string, unknown>[] }
    expect(prospects.map((p) => [p.contact_id, p.origine])).toEqual([['c12', 'recherche_close'], ['c13', 'deal_perdu']])
    const bien = ligne('properties', 'p3')
    for (const p of prospects) {
      const recherche = ligne('client_searches', p.client_search_id as string)
      expect(recherche.is_active).toBe(false)
      expect(p.score).toBe(calculateScoreV2(bien, recherche.criteria as Record<string, unknown>, DEFAULT_SCORING_CONFIG, null, Date.now()).total)
    }
    expect(Date.now() - Date.parse(ligne('client_searches', 'cs12').updated_at as string)).toBeGreaterThan(90 * JOUR)
  })

  it('réactiver : le match naît à proposer, la recherche rouvre, une ligne au journal, le prospect sort de la liste', async () => {
    const { table, ligne, edge } = await banc()
    const r = edge({ mode: 'reactiver-prospect', property_id: 'p3', client_search_id: 'cs12', origine: 'recherche_close' })
    const m = ligne('matches', r.match_id as string)
    expect(m).toMatchObject({ contact_id: 'c12', property_id: 'p3', status: 'suggested', score: r.score })
    expect(ligne('client_searches', 'cs12').is_active).toBe(true)
    expect(table('activity_events').filter((e) => e.action === 'prospect_reactive' && e.entity_id === 'c12')).toHaveLength(1)
    const { prospects } = edge({ mode: 'prospects', property_id: 'p3' }) as { prospects: Record<string, unknown>[] }
    expect(prospects.map((p) => p.contact_id)).toEqual(['c13'])
  })

  it('le résumé « Marché » compte les annonces nouvelles et en baisse d’Anastasia', async () => {
    const { resume } = await banc()
    expect(resume().find((l) => l.contact_id === 'c11')).toMatchObject({ nombre: 2, nouveaux: 1, baisses: 1 })
  })
})
```

- [ ] **Step 2 : La voir échouer**

Run : `npx vitest run tests/unit/banc-matching-explique.spec.ts`
Expected : FAIL (`m22` absent du banc).

- [ ] **Step 3 : Les imports et les dates des mandats (`crmFixtures.ts`)**

Ajouter l'import :

```ts
import { JOURS_BAISSE, JOURS_NOUVEAU } from '@/components/matching-fil/filSignaux'
```

Dans `p1`, remplacer `published_at: ilYA(120),` par `published_at: ilYA(24 * 120), condition: 'good', off_market: false,` ; dans `p2`, remplacer `published_at: ilYA(300),` par `published_at: ilYA(24 * 300), off_market: false,`. ⚠ `ilYA` compte en HEURES : `published_at` valait 5 et 12,5 jours, et Champel aurait porté « Nouveau mandat ».

- [ ] **Step 4 : Le mandat neuf, off-market**

Juste après la ligne `...BIENS_CATALOGUE,` de `properties`, AVANT elle, insérer (le mandat vient après `p2`) :

```ts
    // Lot C (22.09.2026) : un mandat NEUF et OFF-MARKET — « Nouveau mandat » en tête de « Vos biens », et
    // « Qui pour ce bien ? » sur son en-tête, avec deux anciens prospects.
    {
      id: 'p3', agency_id: AGENCE_BANC.id, created_by: AGENT_BANC.id, partner_agency: null, title: 'Attique 5,5 pièces · Florissant', type: 'apartment',
      address: 'Route de Florissant 58', postal_code: '1206', city: 'Genève', canton: 'GE',
      price: 2_350_000, charges_monthly: 690, rooms: 5.5, bedrooms: 4, bathrooms: 2, surface_m2: 168,
      year_built: 1972, energy_class: 'C', floor: 7, condition: 'renovated', off_market: true,
      description: 'Attique traversant, terrasse de 60 m² et vue sur le lac. Entièrement rénové.',
      features: ['Terrasse', 'Ascenseur', 'Vue lac'],
      mandate_type: 'exclusive', mandate_commission_pct: 3, mandate_signed_at: ilYA(24 * 3), mandate_expires_at: ilYA(-24 * 180),
      views_count: 0, favorites_count: 0,
      status: 'active', transaction_type: 'sale', published_at: ilYA(24 * 2), created_at: ilYA(24 * 3),
      photos: [unsplash(PHOTOS_APPART[9]!)], photos_cf: null,
    },
```

- [ ] **Step 5 : Les contacts**

À la fin de `CONTACTS`, après `c10`, ajouter :

```ts
  // Lot C (22.09.2026). Anastasia pose les TROIS critères du lot : 4 chambres, rénovée au moins, off-market.
  // Philippe et Nathalie sont d'anciens prospects : leur fiche n'a plus de critères (le pont a fermé leur recherche).
  contact('c11', 'Anastasia', 'Volkova', {
    email: 'a.volkova@example.ch', phone: '+41 79 214 60 88', canton: 'GE', type: 'buyer', score: 'hot', source: 'referral', language: 'en',
    search_criteria: {
      transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Florissant', 'GE'], budget_min: 2_000_000, budget_max: 2_600_000,
      rooms_min: 5, bedrooms_min: 4, condition_min: 'renovated', off_market_only: true, features: ['terrasse', 'vue lac'],
    },
    last_interaction_at: ilYA(20), created_at: ilYA(24 * 30),
  }),
  contact('c12', 'Philippe', 'Rey', {
    email: 'philippe.rey@example.ch', phone: '+41 78 331 07 52', canton: 'GE', type: 'buyer', score: 'cold', source: 'website',
    last_interaction_at: ilYA(24 * 130), created_at: ilYA(24 * 400),
  }),
  contact('c13', 'Nathalie', 'Gerber', {
    email: 'n.gerber@example.ch', phone: '+41 76 540 93 17', canton: 'GE', type: 'buyer', score: 'warm', source: 'referral',
    last_interaction_at: ilYA(24 * 25), created_at: ilYA(24 * 500),
  }),
```

- [ ] **Step 6 : Les recherches**

Remplacer :

```ts
  client_searches: ['c1', 'c7', 'c9', 'c10'].map((id) => ({
    id: `cs${id.slice(1)}`, agency_id: AGENCE_BANC.id, contact_id: id, label: null, is_active: true,
    criteria: CONTACTS.find((c) => c.id === id)?.search_criteria ?? null,
    last_matched_at: null, created_at: ilYA(300), updated_at: ilYA(300),
  })),
```

par :

```ts
  client_searches: [
    ...['c1', 'c7', 'c9', 'c10', 'c11'].map((id) => ({
      id: `cs${id.slice(1)}`, agency_id: AGENCE_BANC.id, contact_id: id, label: null, is_active: true,
      criteria: CONTACTS.find((c) => c.id === id)?.search_criteria ?? null,
      last_matched_at: null, created_at: ilYA(300), updated_at: ilYA(300),
    })),
    // Deux recherches CLOSES (lot C) : `updated_at` date leur clôture (le pont la pose). Philippe : il y a 120 jours ;
    // Nathalie : il y a 20 jours, mais un deal perdu il y a 150 jours en fait une ancienne prospecte.
    {
      id: 'cs12', agency_id: AGENCE_BANC.id, contact_id: 'c12', label: null, is_active: false, last_matched_at: null,
      criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_max: 2_500_000, rooms_min: 5, features: ['terrasse'] },
      created_at: ilYA(24 * 400), updated_at: ilYA(24 * 120),
    },
    {
      id: 'cs13', agency_id: AGENCE_BANC.id, contact_id: 'c13', label: null, is_active: false, last_matched_at: null,
      criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_min: 1_800_000, budget_max: 2_400_000, rooms_min: 5, surface_min: 180 },
      created_at: ilYA(24 * 500), updated_at: ilYA(24 * 20),
    },
  ],
```

- [ ] **Step 7 : Deux annonces à signal**

Juste après la définition de `ANNONCES_BOUCLE` (le tableau se ferme par `]`), ajouter :

```ts
/**
 * Lot C (22.09.2026) — deux ventes du marché pour Anastasia, chacune avec son signal « pourquoi maintenant » :
 * ml-signal-1 vue il y a un jour (« Nouveau sur le marché », construite l'an dernier : neuve), ml-signal-2 baissée
 * il y a cinq jours de CHF 250'000 (rénovée il y a trois ans ; ses chambres ne sont pas renseignées : « non
 * évalué »). L'année suit l'horloge, comme le moteur (`maintenant`).
 */
const ANNEE_BANC = new Date().getUTCFullYear()
const ANNONCES_SIGNAL = [
  {
    ...annonceFil('ml-signal-1', 'Appartement 6 pièces · Malagnou', 'Route de Malagnou 40', '1208', 2_480_000, 6, 172, ['Terrasse', 'Ascenseur'], PHOTOS_APPART[12]!, '52301'),
    year_built: ANNEE_BANC - 1, first_seen_at: ilYA(24), price_reduced_at: null, removed_at: null,
  },
  {
    ...annonceFil('ml-signal-2', 'Attique 5 pièces · Eaux-Vives', 'Quai Gustave-Ador 30', '1207', 2_450_000, 5, 150, ['Terrasse', 'Vue lac', 'Ascenseur'], PHOTOS_APPART[13]!, '52302'),
    price_at_first_seen: 2_700_000, status: 'price_reduced', price_reduced_at: ilYA(24 * 5), first_seen_at: ilYA(24 * 40),
    bedrooms: null, year_built: 1965, year_renovated: ANNEE_BANC - 3, removed_at: null,
  },
]
/** Les jointures `contact` et `property` des matchs du lot C — le banc n'applique pas `select`. */
const ANASTASIA_EMBARQUEE = { first_name: 'Anastasia', last_name: 'Volkova', email: 'a.volkova@example.ch', phone: '+41 79 214 60 88' }
const FLORISSANT_EMBARQUE = {
  title: 'Attique 5,5 pièces · Florissant', price: 2_350_000, address: 'Route de Florissant 58',
  city: 'Genève', canton: 'GE', postal_code: '1206', rooms: 5.5, bedrooms: 4, surface_m2: 168,
  photos: [unsplash(PHOTOS_APPART[9]!)], type: 'apartment', description: 'Attique traversant, terrasse de 60 m² et vue sur le lac.',
  features: ['Terrasse', 'Ascenseur', 'Vue lac'], floor: 7, year_built: 1972, charges_monthly: 690,
}
```

et, dans `CRM_TABLES`, remplacer :

```ts
  market_listings: [ANNONCE_MARCHE_BANC, ...ANNONCES_CLOCHE, ...ANNONCES_FIL, ...ANNONCES_BOUCLE],
```

par :

```ts
  market_listings: [ANNONCE_MARCHE_BANC, ...ANNONCES_CLOCHE, ...ANNONCES_FIL, ...ANNONCES_BOUCLE, ...ANNONCES_SIGNAL],
```

- [ ] **Step 8 : Les quatre matchs**

À la fin du tableau `matches` (après `m21`), ajouter — notes et raisons du vrai moteur, confrontées par la spec :

```ts
    // ── Lot C (22.09.2026) : Florissant, off-market, et les deux annonces à signal d'Anastasia. ──
    {
      id: 'm22', agency_id: AGENCE_BANC.id, client_search_id: 'cs11', contact_id: 'c11', source: 'internal',
      property_id: 'p3', market_listing_id: null, score_version: 4,
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(40),
      reasons: {
        budget: { match: true, score: 27, detail: 'Dans le budget' },
        zone: { match: true, score: 20, detail: 'Genève correspond' },
        type: { match: true, score: 10, detail: 'apartment' },
        rooms: { match: true, score: 10, detail: '5,5 pièces' },
        features: { match: true, score: 8, detail: '2/2 critères' },
      },
      contact: ANASTASIA_EMBARQUEE, property: FLORISSANT_EMBARQUE, market_listing: null,
    },
    {
      id: 'm23', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'p3', market_listing_id: null, score_version: 4,
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(40),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: EMMA_EMBARQUEE, property: FLORISSANT_EMBARQUE, market_listing: null,
    },
    {
      id: 'm24', agency_id: AGENCE_BANC.id, client_search_id: 'cs11', contact_id: 'c11', source: 'market',
      property_id: null, market_listing_id: 'ml-signal-1', score_version: 4,
      score: 87, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(20),
      reasons: {
        budget: { match: true, score: 27, detail: 'Dans le budget' },
        zone: { match: true, score: 20, detail: 'Genève correspond' },
        type: { match: true, score: 10, detail: 'apartment' },
        rooms: { match: true, score: 10, detail: '6 pièces' },
        features: { match: true, score: 4, detail: '1/2 critères' },
      },
      contact: ANASTASIA_EMBARQUEE, property: null, market_listing: ANNONCES_SIGNAL[0],
    },
    {
      id: 'm25', agency_id: AGENCE_BANC.id, client_search_id: 'cs11', contact_id: 'c11', source: 'market',
      property_id: null, market_listing_id: 'ml-signal-2', score_version: 4,
      score: 95, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(24 * 2),
      reasons: {
        budget: { match: true, score: 30, detail: 'Dans le budget · Prix baissé de 9%' },
        zone: { match: true, score: 22, detail: 'Genève correspond' },
        type: { match: true, score: 11, detail: 'apartment' },
        rooms: { match: true, score: 11, detail: '5 pièces' },
        features: { match: true, score: 9, detail: '2/2 critères' },
      },
      contact: ANASTASIA_EMBARQUEE, property: null, market_listing: ANNONCES_SIGNAL[1],
    },
```

`EMMA_EMBARQUEE` est défini avec la boucle du lot B, avant `CRM_TABLES`. ⚠ m24 et m25 sont notés À L'ÉTAT D'AUJOURD'HUI (créés après la baisse de ml-signal-2, d'où « Prix baissé de 9 % »), pas à leur premier prix comme ceux de la boucle.

- [ ] **Step 9 : Le moteur du banc — `prospects` et `reactiver-prospect`**

Juste avant `export const CRM_EDGES`, ajouter :

```ts
/**
 * « Qui pour ce bien ? » (lot C) — les anciens prospects de Florissant, NOTÉS par le vrai moteur (calculés le
 * 22.09.2026, confrontés par `banc-matching-explique.spec.ts`). Le banc ne note pas : il rejoue seulement les
 * deux règles d'état du moteur — ni un acheteur qui a déjà un match sur le bien, ni une recherche rouverte.
 */
const PROSPECTS_BANC: Record<string, {
  contact_id: string; prenom: string; nom: string; client_search_id: string; score: number
  origine: 'recherche_close' | 'deal_perdu'; depuis: string; reasons: Record<string, RaisonBanc>
}[]> = {
  p3: [
    {
      contact_id: 'c12', prenom: 'Philippe', nom: 'Rey', client_search_id: 'cs12', score: 100, origine: 'recherche_close', depuis: ilYA(24 * 120),
      reasons: {
        budget: { match: true, score: 36, detail: 'Dans le budget' },
        zone: { match: true, score: 27, detail: 'Genève correspond' },
        type: { match: true, score: 13, detail: 'apartment' },
        rooms: { match: true, score: 13, detail: '5,5 pièces' },
        features: { match: true, score: 11, detail: '1/1 critères' },
      },
    },
    {
      contact_id: 'c13', prenom: 'Nathalie', nom: 'Gerber', client_search_id: 'cs13', score: 96, origine: 'deal_perdu', depuis: ilYA(24 * 150),
      reasons: {
        budget: { match: true, score: 36, detail: 'Dans le budget' },
        zone: { match: true, score: 27, detail: 'Genève correspond' },
        type: { match: true, score: 13, detail: 'apartment' },
        rooms: { match: true, score: 21, detail: '5,5 pièces · 168 m²' },
        features: { match: false, score: 0, detail: '—' },
      },
    },
  ],
}

function prospectsDuBanc(bienId: string | null) {
  const matchs = CRM_TABLES.matches as { contact_id: string; property_id: string | null }[]
  const recherches = CRM_TABLES.client_searches as { id: string; is_active: boolean | null }[]
  return (bienId ? PROSPECTS_BANC[bienId] ?? [] : [])
    .filter((p) => !matchs.some((m) => m.contact_id === p.contact_id && m.property_id === bienId))
    .filter((p) => recherches.find((r) => r.id === p.client_search_id)?.is_active === false)
}

function prospectsBanc(a: Record<string, unknown>): Record<string, unknown> {
  const bienId = typeof a.property_id === 'string' ? a.property_id : null
  return {
    prospects: prospectsDuBanc(bienId).map((p) => ({
      contact_id: p.contact_id, prenom: p.prenom, nom: p.nom, client_search_id: p.client_search_id,
      score: p.score, origine: p.origine, depuis: p.depuis,
    })),
  }
}

function reactiverBanc(a: Record<string, unknown>): Record<string, unknown> {
  const bienId = typeof a.property_id === 'string' ? a.property_id : null
  const p = prospectsDuBanc(bienId).find((x) => x.client_search_id === a.client_search_id)
  if (!p || !bienId) return { error: 'deja_sur_ce_bien' }
  const maintenant = new Date().toISOString()
  const recherche = (CRM_TABLES.client_searches as { id: string; is_active: boolean | null; updated_at: string }[])
    .find((r) => r.id === p.client_search_id)
  if (recherche) {
    recherche.is_active = true
    recherche.updated_at = maintenant
  }
  const id = `m-prospect-${p.contact_id}`
  ;(CRM_TABLES.matches as Record<string, unknown>[]).push({
    id, agency_id: AGENCE_BANC.id, client_search_id: p.client_search_id, contact_id: p.contact_id, source: 'internal',
    property_id: bienId, market_listing_id: null, score: p.score, reasons: p.reasons, score_version: 4,
    status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: maintenant,
    contact: { first_name: p.prenom, last_name: p.nom, email: null, phone: null }, property: FLORISSANT_EMBARQUE, market_listing: null,
  })
  ;(CRM_TABLES.activity_events as Record<string, unknown>[]).push({
    id: crypto.randomUUID(), agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'prospect_reactive',
    entity_type: 'contact', entity_id: p.contact_id, category: 'contact', severity: 'info', object_label: null, created_at: maintenant,
    metadata: { client_search_id: p.client_search_id, property_id: bienId, match_id: id, score: p.score, origine: a.origine ?? null },
  })
  return { match_id: id, score: p.score }
}
```

Remplacer :

```ts
  // « Apprendre » (lot B) : voir `renoterBanc`.
  'matching-engine': (a: Record<string, unknown>) => (a.mode === 'rescore-search' ? renoterBanc(a) : { ok: true, banc: true }),
```

par :

```ts
  // « Apprendre » (lot B) : voir `renoterBanc`. « Qui pour ce bien ? » (lot C) : `prospectsBanc`, `reactiverBanc`.
  'matching-engine': (a: Record<string, unknown>) => (a.mode === 'rescore-search' ? renoterBanc(a)
    : a.mode === 'prospects' ? prospectsBanc(a)
      : a.mode === 'reactiver-prospect' ? reactiverBanc(a)
        : { ok: true, banc: true }),
```

- [ ] **Step 10 : Le résumé « Marché » du banc**

Dans `resumeMarcheBanc`, remplacer le type de la table des annonces :

```ts
  const annonces = new Map((CRM_TABLES.market_listings as {
    id: string; status?: string | null; photos?: string[] | null; photos_cf?: unknown
  }[]).map((a) => [a.id, a]))
  const parContact = new Map<string, { id: string; score: number; creeLe: string | null; vignette: string | null }[]>()
```

par :

```ts
  const annonces = new Map((CRM_TABLES.market_listings as {
    id: string; status?: string | null; photos?: string[] | null; photos_cf?: unknown
    price?: number | null; current_price?: number | null; price_at_first_seen?: number | null
    price_reduced_at?: string | null; first_seen_at?: string | null
  }[]).map((a) => [a.id, a]))
  const parContact = new Map<string, {
    id: string; score: number; creeLe: string | null; vignette: string | null; nouveau: boolean; enBaisse: boolean
  }[]>()
  const jour = 86_400_000
```

remplacer :

```ts
    liste.push({ id: m.id, score: m.score, creeLe: m.created_at, vignette: vignetteMarcheBanc(a.photos_cf, a.photos) })
```

par :

```ts
    // Les seuils de la RPC (`matching_fil_marche_resume`) : ceux de `filSignaux`.
    const prix = Number(a.current_price ?? a.price ?? 0)
    const enBaisse = a.price_reduced_at != null && Date.parse(a.price_reduced_at) > maintenant - JOURS_BAISSE * jour
      && Number(a.price_at_first_seen ?? 0) > prix && prix > 0
    const nouveau = a.first_seen_at != null && Date.parse(a.first_seen_at) > maintenant - JOURS_NOUVEAU * jour
    liste.push({ id: m.id, score: m.score, creeLe: m.created_at, vignette: vignetteMarcheBanc(a.photos_cf, a.photos), nouveau, enBaisse })
```

et :

```ts
        vignettes: tries.map((x) => x.vignette).filter((v): v is string => v != null).slice(0, 3),
      }
```

par :

```ts
        vignettes: tries.map((x) => x.vignette).filter((v): v is string => v != null).slice(0, 3),
        nouveaux: l.filter((x) => x.nouveau && !x.enBaisse).length,
        baisses: l.filter((x) => x.enBaisse).length,
      }
```

Dans `CRM_RPC`, remplacer :

```ts
  matching_fil_marche: () => resumeMarcheBanc(),
```

par :

```ts
  matching_fil_marche_resume: () => resumeMarcheBanc(),
```

- [ ] **Step 11 : Vérifier**

Run : `npx vitest run tests/unit/banc-matching-explique.spec.ts tests/unit/banc-matching-boucle.spec.ts tests/unit/banc-supabase.spec.ts`
Expected : PASS — le banc de la boucle ne bouge pas (Emma y gagne seulement « 1 en baisse » sur sa ligne « Marché », ml-boucle-7).

- [ ] **Step 12 : Le voir à l'écran**

Ouvrir `http://localhost:5173/dev/crm?entree=/dashboard/matching` :
- « Vos biens » commence par **Attique 5,5 pièces · Florissant**, sous-titre « CHF 2'350'000 · 2 acheteurs · Nouveau mandat du … » ;
- ↓ depuis l'en-tête passe à Anastasia, puis Emma ; le panneau d'Anastasia montre Chambres ✓ (4), État ✓ (Rénové), Off-market ✓ ;
- l'en-tête de Florissant ouvre « Qui pour ce bien ? » : deux compatibles, puis Philippe Rey (« Recherche close le … », 100) et Nathalie Gerber (« Deal perdu le … », 96) ; « Réactiver » Philippe le fait entrer dans « Vos biens » et le retire des anciens prospects ;
- la ligne « Marché » d'Anastasia dit « 2 biens pas encore proposés · 1 en baisse · 1 nouveau » ; sa sélection montre ml-signal-2 d'abord (95), « Prix baissé de CHF 250'000 le … », puis ml-signal-1 (87), « Nouveau sur le marché depuis le … » ; Chambres « Non renseigné » sur ml-signal-2.

Refaire en sombre (bascule du thème) et à 1280 px de large. Capturer les trois panneaux.

- [ ] **Step 13 : Point de commit (au signal de Julien)**

```bash
git add src/pages/dev/crmFixtures.ts tests/unit/banc-matching-explique.spec.ts
git commit -m "feat(banc): le lot C au banc — un mandat off-market, ses anciens prospects, deux annonces à signal"
```

---

### Task 14 : La carte, le cerveau, le schéma, l'état

**Files :** Modify `docs/system-map.md`, `.claude-flow/knowledge/megga-memory.seed.json`, `docs/schema.md`, `CLAUDE.md`, `docs/superpowers/feuille-de-route.md`

- [ ] **Step 1 : La carte système**

Dans `docs/system-map.md`, section du matching (repérer `matching_fil_marche` et la mention du lot B), remplacer `matching_fil_marche()` par `matching_fil_marche_resume()` partout, et ajouter à la fin de la description du fil :

```markdown
- **Lot C (22.09.2026, sur branche, non fusionné)** : le moteur note chambres (`bedrooms_min`), état (`condition_min`,
  saisi ou déduit des années) et off-market (`off_market_only` ; `properties.off_market`, l'interrupteur de l'agent)
  SANS 6ᵉ clé `reasons` — l'échelle reste ancrée sur le barème des six axes historiques, une recherche sans ces
  critères garde exactement sa note ; un critère que le bien ne renseigne pas sort du dénominateur. Le fil dit
  « pourquoi maintenant » (baisse 14 jours, nouveau 3 jours, nouveau mandat 7 jours), et ces lignes passent devant à
  score égal. « Qui pour ce bien ? » : l'en-tête d'un bien en mandat, ses acquéreurs compatibles, ses anciens
  prospects notés à la demande (`matching-engine` modes `prospects` et `reactiver-prospect`,
  `_shared/matching-prospects.ts`). « Réseau Off-market » (« Nouveau bien ») met le bien en service au lieu d'en
  faire un brouillon. Cerveau : `megga/matching-explique`.
```

- [ ] **Step 2 : Le cerveau**

Ajouter une entrée au tableau des entrées du seed (même forme que `megga/matching-boucle`), par script python qui relit le fichier et vérifie qu'il se recharge en JSON :

```bash
python3 - <<'PY'
import json
p = '.claude-flow/knowledge/megga-memory.seed.json'
brut = open(p, encoding='utf-8').read()
d = json.loads(brut)
entrees = d['entries'] if isinstance(d, dict) and 'entries' in d else d
modele = next(e for e in entrees if e.get('key') == 'megga/matching-boucle')
entree = {k: v for k, v in modele.items()}
entree['key'] = 'megga/matching-explique'
entree['value'] = (
  "MATCHING · LOT C, EXPLIQUÉ ET INVERSÉ (22.09.2026, branche megga/matching-lot-c, fusion à la fin). "
  "Le moteur (_shared/matching-normalize.ts) note CHAMBRES (bedrooms_min ; 0 = inconnu), ÉTAT (condition_min : good < renovated < new ; "
  "saisi sur un mandat, sinon neuf si construit il y a 5 ans au plus, rénové il y a 10 ans au plus ; jamais « bon état » d'une date) "
  "et OFF-MARKET (off_market_only ; properties.off_market, interrupteur de l'agent, décision de Julien du 22.09.2026) — "
  "JAMAIS une 6e clé reasons : axes redistribués, échelle ANCRÉE sur le barème des six axes historiques (sinon +28 % sur toute "
  "recherche), donnée absente = axe inactif. Invariance éprouvée sur 20 000 cas. Le fil explique ces trois critères sur les faits "
  "(lignesCriteres), confronté à axesComplementaires. Signaux « pourquoi maintenant » (filSignaux.ts) : baisse 14 j, nouveau 3 j, "
  "nouveau mandat 7 j (plus récente de mandate_signed_at et published_at) ; à score égal ils passent devant ; la ligne Marché compte "
  "nouveaux et baisses (RPC matching_fil_marche_resume, qui REMPLACE matching_fil_marche : un CREATE OR REPLACE qui change de type "
  "de retour casserait le rejeu du jour du date-guard). « Qui pour ce bien ? » : l'en-tête d'un bien du fil (clé bien:), acquéreurs "
  "compatibles + anciens prospects notés à la demande (matching-engine mode prospects, lecture seule : recherche close > 90 j ou deal "
  "perdu < 24 mois, sans match sur le bien, seuil 55, 20 max ; mode reactiver-prospect : match suggested, recherche rouverte, journal "
  "prospect_reactive). « Réseau Off-market » de Nouveau bien met le bien en service (il faisait un brouillon, jamais noté). "
  "Plan : docs/superpowers/plans/2026-09-22-matching-lot-c-explique-inverse.md."
)
entree.setdefault('tags', [])
entree['tags'] = sorted(set(entree['tags']) | {'matching', 'lot-c', 'off-market', 'signaux', 'prospects'})
assert not any(e.get('key') == 'megga/matching-explique' for e in entrees)
entrees.append(entree)
open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
json.loads(open(p, encoding='utf-8').read())
print('ok')
PY
npm run -s ruflo:seed
```

Le seed a la forme `{ schema, source, namespace, entries: [{ key, namespace, value, tags }] }` (relevé le 22.09.2026) ; le script relit le fichier et n'y AJOUTE qu'une entrée.

- [ ] **Step 3 : Le schéma**

Dans `docs/schema.md`, table `properties`, ajouter la ligne de `off_market` (boolean, défaut false, « Off-market : proposé aux seuls acheteurs de l'agence, jamais diffusé ; noté par le moteur pour une recherche `off_market_only` (lot C) ») ; dans la section des fonctions (si elle existe), remplacer `matching_fil_marche()` par `matching_fil_marche_resume()` (six colonnes).

- [ ] **Step 4 : CLAUDE.md**

Au §8, point « CRM agent », dans la parenthèse du Matching, après `… la Recherche porte « Ce qui a bougé » et les fiches d'annonce l'historique du prix, même date)`, ajouter : ` ; lot C sur branche le 22.09.2026 : chambres, état et off-market notés sans 6ᵉ clé reasons, signaux « pourquoi maintenant », « Qui pour ce bien ? »`.

Run : `npm run -s lint:claude-md`
Expected : vert (aucune prétention chiffrée touchée).

- [ ] **Step 5 : La feuille de route et « En attente »**

Dans `docs/superpowers/feuille-de-route.md`, ligne de l'étape 2, remplacer l'état par : `**fait sur le banc le …** (branche \`megga/matching-lot-c\`, non commité : attend « committe »)`, et ajouter à « En attente » les points de la section « En attente » de ce plan.

- [ ] **Step 6 : Point de commit (au signal de Julien)**

```bash
git add docs/system-map.md .claude-flow/knowledge/megga-memory.seed.json docs/schema.md CLAUDE.md docs/superpowers/plans/2026-09-22-matching-lot-c-explique-inverse.md
git commit -m "docs(matching): le lot C dans la carte, le cerveau, le schéma et CLAUDE.md"
```

---

### Task 15 : Vérification complète

- [ ] **Step 1 : Les types et le lint**

Run : `npx tsc -p tsconfig.app.json --noEmit && npx eslint src tests --max-warnings=0`
Expected : aucune erreur.

- [ ] **Step 2 : Deno**

Run : `for f in supabase/functions/matching-engine/index.ts supabase/functions/_shared/matching-normalize.ts supabase/functions/_shared/matching-prospects.ts supabase/functions/_shared/matching-renotation.ts; do deno check "$f" || echo "ÉCHEC $f"; done`
Expected : aucun « ÉCHEC ».

- [ ] **Step 3 : Les portes**

Run, une par une : `npm run -s lint:deadcode`, `npm run -s i18n:parity:ci`, `npm run -s i18n:coverage:ci`, `npm run -s lint:prose`, `npm run -s lint:i18n`, `npm run -s lint:migrations`, `npm run -s lint:types-freshness`, `npm run -s lint:spec-sql`, `npm run -s lint:edge-auth`, `npm run -s lint:claude-md`
Expected : toutes vertes.

- [ ] **Step 4 : La suite unitaire, SEULE**

Run : `npx vitest run` (rien d'autre en parallèle)
Expected : tout vert, hors les trois échecs locaux connus (`mail/imap.test.ts`, `mail/mime-parse.test.ts`, `safe-internal-path.spec.ts`). Un autre rouge se relance d'abord seul (`npx vitest run <fichier>`) avant d'être cru.

- [ ] **Step 5 : Le banc, clair et sombre**

Refaire le Step 12 de la Task 13, et le Step 10 de la Task 7 (« Nouveau bien » et la fiche du bien), en clair puis en sombre. Aucune erreur dans la console.

---

## En attente (relevé en écrivant ce plan — rien n'est fait sans accord)

- **La création d'un contact** (`NewContactModal`) et **l'extraction WhatsApp** (`mapCriteria`, `qualify_lead`) ne posent ni chambres, ni état, ni off-market : la fiche les complète.
- **L'atelier** (production jusqu'au lot E) n'explique pas chambres, état ni off-market : ses raisons sont les cinq clés du moteur. Le fil les explique.
- **Pièces et surface inconnues comptent 0** dans le moteur, quand chambres et état inconnus sortent du dénominateur : deux règles pour « donnée absente ». Les aligner changerait les notes de production (`score_version` à relever).
- **`app_config.matching_scoring_v2.version`** : le barème a changé (trois axes) ; la version écrite sur les matchs est celle d'`app_config`, pas le défaut du code.
- **Un mandat off-market n'est pas protégé de la diffusion** : `off_market` ne bloque pas `publish_to_portals` / `property_syndications` (IDX pas en service au 22.09.2026).
- **L'onglet « Off-market » de la galerie de Mes biens** (`BpTopGallery`) regroupe `paused` et `sold` : un autre sens du même mot.
- **« Qui pour ce bien ? » sur la fiche du bien, sur la fiche d'une annonce du marché, et à la création d'un mandat** : lot D (étape 4). Le mode `prospects` accepte déjà `market_listing_id`.
- **Prescripteurs** (§4.2, groupe 3) : attendent le modèle relationnel (étape 6).
- **« Qui pour ce bien ? » ne lit que les matchs du fil** (à proposer, reportés, boucle) : un match `ignored` n'y figure pas — mais il exclut bien l'acheteur des anciens prospects.
- **Rouvrir une recherche ne relance pas le moteur** : ses autres biens arrivent au scan de la nuit. Un `match-contact` au moment de la réactivation le ferait tout de suite.
- **La date d'un deal perdu** est `transactions.updated_at`, que toute écriture touche ; la vraie date est l'événement `stage_change` du journal (depuis le 17.06.2026).

---

## Corrections après revue (22.09.2026) — le code du dépôt fait foi

L'exécution a suivi ce plan ; deux revues (serveur, puis écran) et la vérification au banc ont changé ce qui suit. Les blocs de code des tâches ci-dessus ne sont pas réécrits : ces lignes disent où le dépôt s'en écarte, et pourquoi.

**Serveur (revue des Tasks 1 à 5)**
- **Réactiver est UNE transaction** : fonction `matching_reactiver_prospect(...)` (migration, section 5 ; `SECURITY DEFINER`, `service_role` seul), qui vérifie que la recherche ET son contact sont de l'agence, crée le match (`ON CONFLICT DO NOTHING`), rouvre la recherche et écrit la ligne `prospect_reactive`. Les trois écritures séparées de la Task 5 laissaient, après une panne au milieu, une recherche fermée pour toujours (le nouvel essai tombait sur le 409).
- **Mandats ACTIFS seulement** dans `prospects` et `reactiver-prospect` (404 sinon) : le moteur ne note que les mandats actifs. L'écran traite ce 404 comme « aucun ancien prospect » (`useAnciensProspects`).
- **Un acheteur qui a un deal sur CE bien n'est pas un ancien prospect de ce bien** (exclu comme ceux qui y ont un match).
- **Les quatre lectures de `prospects` sont paginées** (`max_rows` tronque en silence).
- **Le trigger off-market ne supprime que les matchs des acheteurs `off_market_only`** (les autres gardent leur report et leur date), et ne part que sur un mandat DÉJÀ actif (`OLD.status = 'active'`).
- **`set local lock_timeout = '5s'`** en tête de migration (l'`ALTER TABLE properties` se rejoue à chaque push du jour de la fusion).
- **« À rénover » n'est pas un état minimum** : le moteur (et le fil) ne l'acceptent pas comme `condition_min` — un axe toujours tenu gonflait les notes (52 → 56, au-dessus du seuil).
- **Specs** : le test des comptes « nouveaux / en baisse » sème ses annonces À L'INSERTION (le trigger `trg_ra_price_status` de la pige défaisait ses UPDATE) ; E2 sème son annonce ; E1 et E5 couvrent les règles ci-dessus. La villa de Zürich du test des prospects tombait PILE sur le seuil (55) : son prix est passé à 4'000'000.

**Écran (exécution des Tasks 8 à 13, banc)**
- **Après un geste (E, P, X), la sélection saute les en-têtes de bien** (`ceder`) : on enchaîne les matchs sans atterrir sur « Qui pour ce bien ? ».
- **« Ouvrir » n'apparaît que sur un match visible** dans le fil tel qu'il est filtré (`peutOuvrir`).
- **L'invite « Qui pour ce bien ? » ne s'écrit que sur l'en-tête choisi** (une flèche ailleurs), et l'en-tête porte le signal en forme COURTE (« Nouveau mandat ») : écrite sur chacun, l'invite coupait le signal.
- **Fiche du bien** : le « pourquoi » de l'off-market (« Proposé à vos seuls acheteurs, jamais diffusé », `fiche.diffusion.offMarketLigne`) passe SOUS le nom du portail, et la colonne de droite dit « Off-market » : à droite, la phrase écrasait « immobilier.ch ».
