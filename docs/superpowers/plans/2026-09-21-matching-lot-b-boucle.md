# Matching · lot B, la boucle chez l'agent — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Fermer la boucle du matching CHEZ L'AGENT dans le fil de matchs (étape 1a de la feuille de route verrouillée) : onglets « À proposer », « En attente » et « À conclure » ; feuille « Retours de … » (Intéressé, Pas intéressé + motif, Pas encore) ; « Planifier une visite » ; « Apprendre » (correction de recherche au deuxième refus pour un même motif, réévaluation des matchs à proposer par le vrai moteur, retour d'un bien refusé pour le prix quand son prix baisse) ; la relance d'une sélection close quand plus aucun de ses biens n'attend. Sur le banc `/dev/crm` ; l'atelier en production ne change pas.

**Architecture :** La base porte ce qui doit valoir pour TOUS les écrivains (atelier, mobile, « Aujourd'hui », fil, et demain WhatsApp) : une migration ajoute `matches.prix_propose` (posé par trigger au passage à `sent`), `matches.apprentissage_at`, `reminders.match_ids`, le vocabulaire des motifs, et trois triggers (relance d'une proposition close quand plus aucun bien n'attend, motif au journal, retour d'un bien refusé pour le prix sur une BAISSE de prix). La réévaluation vit dans l'edge `matching-engine` (nouveau mode `rescore-search`), parce que le score se calcule en TypeScript : un module pur `_shared/matching-renotation.ts` rejoue `calculateScoreV2`, une RPC `service_role` écrit les notes en lot. Côté écran, deux modèles purs (`filBoucle.ts`, `filApprendre.ts`), cinq exécuteurs dans `useAtelierMatching.ts` (source unique des écritures), une lecture de la boucle dans `useMatchingFil`, et six composants neufs dans `src/components/matching-fil/`. Le code de ce plan a été appliqué et éprouvé sur une copie du dépôt (tsc, eslint, portes, suite unitaire, banc à l'écran) le 21.09.2026.

**Tech Stack :** React 19 + TypeScript, TanStack Query v5, react-i18next (FR/DE/EN/IT), Supabase (SQL, triggers, RLS, PostgREST, edge Deno), Vitest, jetons MEGGA X.

**Conceptions :** [boucle chez l'agent](../specs/2026-09-21-matching-boucle-agent-design.md) §3, §4.3 à §4.6, §5, §7 (lot B), §9, §10 ; [fil de matchs](../specs/2026-09-17-matching-fil-design.md) §3.1, §4, §7. **Feuille de route :** [étape 1a](../feuille-de-route.md). **Lots précédents** (commités, PR #1339 ouverte le 21.09.2026) : [lot 2 du fil](2026-09-17-matching-fil-lot2.md), [lot A](2026-09-21-matching-lot-a-nettoyage.md) — le code du dépôt fait foi.

---

## Règles de ce chantier

- **Commits : AU SIGNAL de Julien seulement** (« committe »), un commit PAR SUJET, jamais de push. Les « Point de commit » ne s'exécutent pas sans ce signal. Ce lot part de l'état des lots 1, 2 et A (étape 0 de la feuille de route, PR #1339) : il modifie des fichiers qu'ils créent.
- **Production : aucune écriture.** La migration part avec la fusion (`deploy.yml`). Elle s'appelle `20260921140000_matching_boucle.sql` : après `20260921130000` (lot A), avant celles de la pige (`20260921145000`, `20260921150000`, étape 1b, dont elle ne dépend pas). **À renommer au jour de la fusion** si elle a lieu après le 21.09.2026 (date-guard), en gardant cet ordre.
- **Grammaire MEGGA X** dans `src/components/matching-fil/` (cliquet `{ hors: 0, total: 0 }`) : aucun littéral de rayon, d'espacement ou de taille de texte — `var(--crm-radius-*)`, `var(--crm-space-*)`, `var(--crm-text-*)`, `0`, ou `calc()` de variables ; largeurs et hauteurs en pixels permises. Aucune couleur en dur (palette `sp.*`, `encreAccent`, `teinteEcart`, `teinteTenu`), graisse ≤ 600, pas de capitales CSS, aucune chaîne affichée hors `t()`. L'élément ACTIF porte l'accent.
- **i18n** : `src/i18n/locales/*/matching.json` et `common.json` au format exact `json.dumps(d, ensure_ascii=False, indent=2) + '\n'`, modifiés par script python qui vérifie ce format D'ABORD. Aucun tiret cadratin ni demi-cadratin, aucun ß, l'italien au « Lei » dans les phrases (les boutons gardent l'impératif du fichier : « Scarta », « Mostra »).
- **Rien ne sort vers le client.** `tests/unit/matching-sans-sortie.spec.ts` reste vert : la seule fonction serveur que le matching appelle est `matching-engine`. Une visite planifiée depuis le fil n'envoie rien : ni invitation, ni lien, ni rappel la veille — `reminder_sent` est posé à la création, sans quoi `visit-reminders-j1` écrirait au client par `send-visit-email` (CLAUDE.md §5 : aucun envoi au client sans validation de l'agent).
- **Chantier parallèle (étape 1b, pige), DANS LE MÊME WORKTREE.** Ce plan ne touche PAS `src/components/matching-recherche/**`, `supabase/functions/flatfox-sync`, `supabase/functions/realadvisor-sync`, ni les migrations de la pige (`20260921145000_…`, `20260921150000_…`). Fichiers partagés que ce plan modifie : `src/i18n/locales/*/matching.json` (1b y ajoute des clés `recherche.*`), `src/pages/dev/crmFixtures.ts` (1b y ajoute des annonces du marché) — et, d'après le plan de la pige, `src/types/database.ts`, `docs/system-map.md` et `.claude-flow/knowledge/megga-memory.seed.json`. Leurs points de commit indexent, si la pige n'a pas encore commité, un blob intermédiaire (la version de `HEAD` plus les seules lignes de ce lot), jamais le fichier du worktree tel quel. ⛔ **Relire chacun JUSTE AVANT d'écrire, et ne modifier que ses propres sections** : les scripts i18n relisent le fichier à l'exécution et n'écrivent que sous `fil.*` ; les autres modifications se font par remplacements ciblés, ancre relue (une ancre changée par 1b se réadapte, elle ne s'écrase pas) ; jamais un fichier entier réécrit depuis une copie. Au 21.09.2026 au soir, 1b avait déjà modifié `src/types/database.ts` (`removed_at`, `market_price_history`) : ce plan n'y touche que `matches`, `reminders` et une fonction.
- **L'atelier en production ne change pas** : ni son écran, ni ses gestes, ni le mobile, ni « Aujourd'hui ». Les exécuteurs partagés gagnent seulement `match_ids` sur leur relance ; les triggers valent pour tout écrivain (écarts assumés, écrits dans « En attente »).
- **Tests : ciblés et SEULS** — jamais la suite complète en parallèle de `tsc` ou `eslint` ; la suite complète seule, à la fin (Task 18).
- **Aucun export mort** (`npm run lint:deadcode`, `src/` seulement) : une fonction seulement lue par une spec n'est pas exportée.
- **Banc** : `http://localhost:5173/dev/crm?entree=/dashboard/matching` (serveur déjà lancé, HMR). Le banc ne joue AUCUN trigger : ce que la base fait seule (prix proposé, clôture de relance, retour par baisse, ligne `match_reaction`) s'y montre par son état d'arrivée dans les fixtures, et se prouve par la spec backend (CI `backend.yml`).
- **Décisions attendues de Julien (feuille de route, n° 3)** : ce plan applique les propositions de la conception — les huit motifs, la relance à 3 jours, la correction « prix » pré-remplie et modifiable. Changer la liste des motifs demandera une migration (CHECK), `MOTIFS_REFUS` et les quatre langues.

## Décisions de ce plan

1. **La réévaluation vit dans `matching-engine`, mode `rescore-search`** (le score est du TypeScript, `calculateScoreV2`). Un appel fait TOUT, dans cet ordre : lire les matchs `suggested` de la recherche (par pages de 1 000, `max_rows`), leurs biens (par lots de 100 ids), les renoter avec les critères CORRIGÉS en mémoire, écrire les notes en lot (`matching_appliquer_notes`, `service_role`) — sous le seuil : `ignored` et `reaction_motif = 'recherche_ajustee'` —, PUIS poser les critères sur la recherche (et sur la fiche du contact si elle portait exactement les mêmes : sans quoi le pont `sync_contact_client_search` remettrait l'ancienne au prochain enregistrement de la fiche), PUIS marquer les refus pris en compte, PUIS écrire UNE ligne `recherche_ajustee` au journal. ⛔ Critères écrits d'abord par le client, un échec de la renotation effaçait la correction de l'écran (elle n'avait plus d'écart à proposer) sans rien avoir renoté ; dans cet ordre, un échec la laisse et la même validation se rejoue (chaque étape est idempotente).
2. **Un match ajouté à la main n'est pas renoté** : la Recherche (« Ajouter à la sélection de … ») crée des matchs SANS `score_version` et avec ses propres raisons ; les écarter parce que le barème ne les retiendrait pas déferait une décision de l'agent.
3. **Le retour par baisse de prix est un trigger SQL** sur la BAISSE de prix (`market_listings` : `coalesce(current_price, price)` ; `properties` : `price`), pas un calcul à la lecture. Seules les baisses le déclenchent (clause `WHEN`), et chacune ne lit que les matchs de SON bien (`idx_matches_market_listing`, `idx_matches_property_status`) : sur 96 511 annonces actives, le coût est celui des baisses du jour. Le match repasse `suggested` en GARDANT `reaction_motif = 'prix'` et `prix_propose` (c'est ce qui écrit « Refusé par Julie à CHF … · baissé de CHF … depuis »), une ligne `match_retour_prix` au journal. Calculé à la lecture, le bien resterait `rejected` pour l'atelier, `matching_fil_marche`, « Aujourd'hui » et demain WhatsApp, chacun devant recopier la règle.
4. **La relance d'une sélection : `reminders.match_ids uuid[]`** (tous les biens de la proposition ; `match_id` garde le meilleur, pour les lecteurs d'aujourd'hui) **et un trigger** `fermer_relance_proposition` : un match qui QUITTE `sent` clôt la relance qui le couvre si plus aucun de ses biens n'est `sent`. Une colonne, pas de table de liaison ; un trigger, comme `set_match_response_at` et `log_match_reaction`, pour que tout écrivain ferme la boucle pareil. Une relance d'avant le lot B (sans `match_ids`) couvre son seul `match_id`.
5. **`prix_propose` est posé par la base** (trigger `set_match_prix_propose`, au passage à `sent`) et non par les exécuteurs : une sélection propose N biens en UNE écriture, à N prix différents, et quatre écrivains passent un match à `sent`. La même transition efface la réponse d'avant (`reaction_motif`, `reaction_note`, `apprentissage_at`) : un bien revenu et reproposé repart sans motif.
6. **« Apprendre » compte les refus PAR RECHERCHE** (`client_search_id`), non encore pris en compte (`matches.apprentissage_at` nul). Valider OU ignorer une correction marque ses refus : deux NOUVEAUX refus en proposeront une autre. Les corrections sont une section « Recherches à ajuster » en tête d'« À proposer » (une ligne par recherche et par motif) ; leur apparition est annoncée une fois (toast), où qu'on soit.
7. **Règles chiffrées d'« Apprendre »** (§4.6, sur les seules clés que la fiche sait écrire) : prix → budget maximum sous le prix refusé le plus bas (le prix PROPOSÉ), arrondi à 10 000 francs (50 pour un loyer), jamais sous le minimum ; surface → multiple de 5 m² au-dessus de la plus grande surface refusée ; pièces → une demi-pièce au-dessus ; quartier → la zone de VILLE qui a retenu les refusés sort, et le canton qu'elle nomme (« Genève » → `GE`) reste en code ; type → le type, unique, des biens ACCEPTÉS (intéressé, visite) ; équipements → ce que TOUS les acceptés ont et qu'AUCUN refusé n'a, ajouté aux équipements voulus (le moteur note les équipements en fraction : un « obligatoire » strict attend un critère du moteur, cf. « En attente ») ; état, autre → rien. Budget, surface et pièces se saisissent (pré-remplis, modifiables).
8. **« Planifier une visite »** : un bien EN MANDAT reçoit une visite interne (`visits`, statut `planned`, rattachée au deal) ; une annonce du MARCHÉ, que l'agence ne détient pas (`visits.property_id` n'accepte qu'un bien en mandat), entre dans l'agenda de l'agent comme événement `calendar_events` de type `visite`. Dans les deux cas le match passe `visit_planned` (d'abord, pour qu'un double geste ne pose pas deux visites ; rendu `interested` si la visite échoue) et le deal avance à `visit_planned` s'il était avant (`new_lead`, `to_qualify`, `active_search`, `to_recontact`), jamais en arrière. Formulaire en ligne dans le panneau (date, heure, durée), pas de fenêtre d'annulation. ⛔ Aucun rappel la veille : `reminder_sent` est posé à la création — `visit-reminders-j1` écrit sinon à l'acheteur (`send-visit-email`), et l'écran promet « Rien n'est envoyé à … ». Pas `PlanifierVisite` (fiche d'un bien) : il ne connaît que les mandats et prépare un message de confirmation au client.
9. **« En attente » : une ligne par ACHETEUR**, ses biens proposés sans réponse, triée par relance (échue d'abord, puis la plus proche, puis sans relance) ; le panneau est la feuille « Retours de … ». **« À conclure » : une ligne par match** `interested`, la réponse la plus ancienne d'abord ; « Pas intéressé » (N, avec motif) y reste possible — sans quoi un intérêt retombé n'aurait pas de sortie.
10. **Gestes et clavier.** Intéressé (I) et Pas intéressé (N, puis un motif en une puce, touches 1 à 8, Échap) passent par la fenêtre d'annulation, comme Plus tard et Écarter ; après « Intéressé », la barre offre « Planifier la visite », qui fait partir l'écriture et ouvre « À conclure » sur ce match. « Pas encore » (P) écrit tout de suite (rien ne sort du fil). Dans « À conclure », V porte le focus sur la date de la visite. Les touches d'« En attente » visent le bien qui a le focus (`data-retour`), sinon le premier.
11. **Journal** : `match_reaction` (trigger existant, désormais avec le motif), `match_pas_encore`, `visit_scheduled` (visite d'un mandat ; l'événement d'agenda se journalise par son propre trigger), `correction_ignoree`, `recherche_ajustee` / `matchs_reevalues` (edge), `match_retour_prix` (trigger). Libellés dans `common:audit.action`, rangés en « matching » par la cloche.
12. **Français sans élision manquée** : aucune chaîne « de {{prenom}} » (« de Emma » au lieu de « d'Emma », qu'une interpolation ne sait pas élider). La feuille « Retours » a pour titre le NOM de l'acheteur ; le signal dit « Refusé par Antoine à CHF 3'450'000 · baissé de CHF 250'000 depuis » dans un panneau, « Prix baissé de CHF 250'000 » sur une ligne.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md` (modifié) | §12, les précisions de ce plan |
| `supabase/migrations/20260921140000_matching_boucle.sql` (créé) | Colonnes, CHECK, index, triggers, RPC de réévaluation |
| `src/types/database.ts` (modifié) | `matches.prix_propose`, `matches.apprentissage_at`, `reminders.match_ids`, RPC |
| `tests/backend/matching-boucle.spec.ts` (créé) | Triggers, RPC et mode `rescore-search` contre `supabase start` (CI) |
| `supabase/functions/_shared/matching-renotation.ts` (créé) | Module PUR : renoter, comparer des critères, découper en lots |
| `tests/unit/matching-renotation.spec.ts` (créé) | Ses tests, confrontés à `calculateScoreV2` |
| `supabase/functions/matching-engine/index.ts` (modifié) | Mode `rescore-search` |
| `src/components/matching-fil/filModele.ts` (modifié) | `SuiviMatch`, `FilMatch.suivi` / `rechercheId`, exports partagés, `optionsFiltres` |
| `src/components/matching-fil/filBoucle.ts` (créé) | Onglets, motifs, « En attente », « À conclure », signal de prix |
| `src/components/matching-fil/filApprendre.ts` (créé) | Corrections de recherche |
| `tests/unit/matching-fil-boucle.spec.ts`, `tests/unit/matching-fil-apprendre.spec.ts` (créés), `tests/unit/matching-fil-modele.spec.ts` (modifié) | Tests des modèles |
| `src/hooks/useAtelierMatching.ts` (modifié) | `match_ids` des relances ; `execRepondre`, `execPasEncore`, `execPlanifierVisite`, `execIgnorerCorrection`, `execAjusterRecherche` |
| `tests/unit/matching-fil-gestes.spec.ts` (modifié) | Tests des gestes |
| `src/hooks/useMatchingFil.ts`, `src/hooks/useSelectionMarche.ts` (modifiés) | La boucle, les relances, le suivi des biens revenus |
| `src/i18n/locales/{fr,de,en,it}/matching.json`, `common.json` (modifiés) | `fil.*` ; `audit.action.*` |
| `src/hooks/useAgentNotifications.ts` (modifié) | Type des nouvelles actions |
| `src/components/matching-fil/{filAffichage.ts,filAtomes.tsx,FilAnnulation.tsx,FilEnTete.tsx,FilPanneau.tsx,FilSelection.tsx,FilListe.tsx}` (modifiés) | Signal, bouton et survol partagés, section « Recherches à ajuster » |
| `src/components/matching-fil/{FilOnglets,FilListeBoucle,FilMotifs,FilRetours,FilConclure,FilCorrection}.tsx` (créés) | Onglets, listes, retours, visite, correction |
| `src/components/matching-fil/MatchingFil.tsx` (modifié) | Intégration |
| `src/pages/dev/crmFixtures.ts`, `src/pages/dev/CrmShowcasePage.tsx` (modifiés) | La boucle du banc et son `matching-engine` |
| `tests/unit/banc-matching-boucle.spec.ts` (créé) | Les fixtures notées par le vrai moteur |
| `.claude-flow/knowledge/megga-memory.seed.json`, `docs/system-map.md` (modifiés, PARTAGÉS avec la pige) | Cerveau (`megga/matching-boucle`), carte système §E |

---

### Task 0 : Consigner les décisions du lot B dans la conception

**Files :** Modify `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`

- [ ] **Step 1 : Ajouter le §12**

À la FIN du fichier (après le §11 et son dernier paragraphe « Gregory propose un cahier des charges technique… »), ajouter :

```
## 12. Précisions du plan du lot B (21.09.2026)

Plan : [2026-09-21-matching-lot-b-boucle.md](../plans/2026-09-21-matching-lot-b-boucle.md).

- **Prix proposé** : `matches.prix_propose` est posé par la BASE au passage à `sent` (trigger
  `set_match_prix_propose`) — une sélection propose N biens en une écriture, à N prix, et quatre écrivains
  proposent. La même transition efface la réponse d'avant.
- **Relance d'une sélection** : `reminders.match_ids` porte TOUS les biens de la proposition ; le trigger
  `fermer_relance_proposition` la clôt quand plus aucun n'est `sent`, quel que soit l'écrivain.
- **Retour par baisse de prix** : trigger sur la BAISSE de prix des annonces et des mandats ; le match
  repasse `suggested` en gardant son motif `prix` et son prix proposé ; ligne `match_retour_prix`.
- **Apprendre** : refus comptés PAR RECHERCHE ; un refus pris en compte (`matches.apprentissage_at`, correction
  validée ou ignorée) ne compte plus. Les corrections forment la section « Recherches à ajuster »
  d'« À proposer ». Valider appelle `matching-engine` (mode `rescore-search`) : renotation par
  `calculateScoreV2`, puis critères (et fiche si identique), puis refus pris en compte, puis
  `recherche_ajustee` au journal. Un match ajouté à la main (sans `score_version`) n'est pas renoté.
- **Équipements** : « rendre obligatoire » devient « ajouter aux équipements voulus ce que tous les biens
  acceptés ont et qu'aucun refusé n'a » — le moteur note les équipements en fraction ; un obligatoire strict
  attend un critère du moteur. **Quartier** : seule une zone de ville sort ; le canton qu'elle nomme reste.
- **Planifier une visite** : `visits` pour un bien en mandat, événement `visite` de l'agenda
  (`calendar_events`) pour une annonce du marché ; le deal avance à `visit_planned`, jamais en arrière. Aucun
  rappel au client la veille (`reminder_sent` posé à la création : `visit-reminders-j1` lui écrirait).
- **À conclure** garde « Pas intéressé » (avec motif). **Pas encore** écrit tout de suite, sans fenêtre
  d'annulation.
```

- [ ] **Step 2 : Point de commit (au signal)** — avec le plan.

```bash
git add docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md docs/superpowers/plans/2026-09-21-matching-lot-b-boucle.md
git commit -m "docs(matching): plan du lot B, la boucle chez l'agent"
```

---

### Task 1 : La migration

**Files :**
- Create : `supabase/migrations/20260921140000_matching_boucle.sql`
- Modify : `src/types/database.ts`

- [ ] **Step 1 : Vérifier qu'aucune migration ne redéfinit `log_match_reaction` après sa création**

Run : `grep -ln "function public.log_match_reaction" supabase/migrations/*.sql`
Expected : seulement `supabase/migrations/20260617120000_match_reaction_response_at.sql`. Si un autre fichier apparaît, reprendre au Step 2 le corps de la version LA PLUS RÉCENTE (en y gardant l'ajout du motif) et le signaler.

- [ ] **Step 2 : Écrire la migration**

Créer `supabase/migrations/20260921140000_matching_boucle.sql` :

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Matching · lot B : la boucle chez l'agent (21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.3 à §4.6 et §12.
-- Plan : docs/superpowers/plans/2026-09-21-matching-lot-b-boucle.md.
--
-- Mesuré en production le 21.09.2026 : 1 754 matchs, tous `suggested` ; aucune réponse consignée
-- (`reaction_motif` nul partout) ; aucune relance de proposition. Rien à reprendre.
--
-- 1. `matches.prix_propose` — le prix du bien quand l'agent l'a proposé. Posé par TRIGGER au passage à
--    `sent`, pas par les exécuteurs : une sélection propose N biens en UNE écriture, à N prix différents,
--    et quatre écrivains proposent (atelier, mobile, « Aujourd'hui », fil). La même transition efface la
--    réponse d'avant : un bien revenu par une baisse et reproposé repart sans motif.
-- 2. `matches.apprentissage_at` — ce refus a nourri une correction de recherche (« Apprendre »), validée
--    ou ignorée. Il ne compte plus : deux NOUVEAUX refus pour ce motif en proposeront une autre.
-- 3. `matches.reaction_motif` — vocabulaire FERMÉ : les huit motifs de la conception, plus
--    `recherche_ajustee` (écarté par la réévaluation d'une recherche, pas par l'acheteur). NOT VALID :
--    les lignes existantes, toutes nulles (mesuré), ne sont pas relues.
-- 4. `reminders.match_ids` — les biens que couvre une relance de proposition. Une sélection de N biens
--    n'a qu'UNE relance ; `match_id` n'en porte que le meilleur (lecteurs d'aujourd'hui inchangés).
-- 5. `idx_matches_boucle` — ce que le fil lit pour « En attente », « À conclure » et « Apprendre ».
-- 6. `fermer_relance_proposition` — un match qui QUITTE `sent` clôt la relance qui le couvre si plus
--    aucun de ses biens n'est `sent`. Quel que soit l'écrivain, comme les triggers de réaction.
-- 7. `log_match_reaction` inscrit aussi le MOTIF d'un refus.
-- 8. `match_retour_prix_*` — un bien refusé pour le PRIX revient à proposer quand son prix passe sous
--    `prix_propose`. Seules les BAISSES déclenchent (clause WHEN), et chacune ne lit que les matchs de son
--    bien : sur 96 511 annonces actives, le coût est celui des baisses du jour, pas celui du catalogue.
-- 9. `matching_appliquer_notes` — les notes d'une recherche ajustée, écrites en lot par l'edge
--    `matching-engine` (mode `rescore-search`, le score est du TypeScript) : service_role seul.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : appliquée seulement si son horodatage est ≥ au jour UTC de la fusion.
-- Renommer au jour de la fusion si elle a lieu après le 21.09.2026 — après la migration du lot A
-- (…130000), avant celle de la pige (…150000), dont elle ne dépend pas.

begin;

-- ── 1 à 4. Les colonnes et le vocabulaire ────────────────────────────────────
alter table public.matches add column if not exists prix_propose numeric;
alter table public.matches add column if not exists apprentissage_at timestamptz;

comment on column public.matches.prix_propose is
  'Prix du bien (COALESCE(current_price, price) d''une annonce, price d''un mandat) quand l''agent l''a proposé. Posé par trg_match_prix_propose au passage à sent. Sert le signal « prix baissé de … » et le retour d''un bien refusé pour le prix.';
comment on column public.matches.apprentissage_at is
  'Ce refus a nourri une correction de recherche (« Apprendre », lot B), validée ou ignorée : il ne compte plus.';

alter table public.matches drop constraint if exists matches_reaction_motif_check;
alter table public.matches add constraint matches_reaction_motif_check
  check (reaction_motif is null or reaction_motif = any (array[
    'prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre', 'recherche_ajustee'
  ])) not valid;

alter table public.reminders add column if not exists match_ids uuid[];

comment on column public.reminders.match_ids is
  'Relance de proposition (follow_up_sent_property) : TOUS les biens qu''elle couvre. match_id n''en porte que le meilleur. Close par trg_match_fermer_relance quand plus aucun n''est sent.';

-- ── 5. L'index de la boucle ──────────────────────────────────────────────────
-- ⚠ Même liste de statuts que la lecture du fil (`useMatchingFil`) : un `in` identique à celui du
-- prédicat partiel le laisse s'appliquer.
create index if not exists idx_matches_boucle on public.matches (agency_id, status)
  where status in ('sent', 'interested', 'rejected', 'visit_planned');

-- ── 1 (trigger). Le prix proposé, et la réponse d'avant effacée ──────────────
create or replace function public.set_match_prix_propose()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if NEW.status = 'sent' and OLD.status is distinct from 'sent' then
    if NEW.market_listing_id is not null then
      NEW.prix_propose := (select coalesce(ml.current_price, ml.price) from public.market_listings ml where ml.id = NEW.market_listing_id);
    elsif NEW.property_id is not null then
      NEW.prix_propose := (select p.price from public.properties p where p.id = NEW.property_id);
    end if;
    NEW.reaction_motif := null;
    NEW.reaction_note := null;
    NEW.apprentissage_at := null;
  end if;
  return NEW;
end;
$function$;

revoke all on function public.set_match_prix_propose() from public, anon, authenticated;

drop trigger if exists trg_match_prix_propose on public.matches;
create trigger trg_match_prix_propose
  before update of status on public.matches
  for each row
  execute function public.set_match_prix_propose();

-- ── 6. La relance d'une proposition, close quand plus aucun de ses biens n'attend ──
create or replace function public.fermer_relance_proposition()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.reminders r
     set status = 'done', completed_at = now()
   where r.contact_id = NEW.contact_id
     and r.agency_id = NEW.agency_id
     and r.type = 'follow_up_sent_property'
     and r.status in ('pending', 'triggered')
     and NEW.id = any (coalesce(r.match_ids, array[r.match_id]))
     and not exists (
       select 1 from public.matches m
        where m.id = any (coalesce(r.match_ids, array[r.match_id]))
          and m.status = 'sent'
     );
  return null;
end;
$function$;

revoke all on function public.fermer_relance_proposition() from public, anon, authenticated;

drop trigger if exists trg_match_fermer_relance on public.matches;
create trigger trg_match_fermer_relance
  after update of status on public.matches
  for each row
  when (OLD.status = 'sent' and NEW.status is distinct from 'sent')
  execute function public.fermer_relance_proposition();

-- ── 7. Le journal d'une réponse porte son motif ──────────────────────────────
-- Corps de 20260617120000, À L'IDENTIQUE, plus la clé `motif`.
create or replace function public.log_match_reaction()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_guc_kind text := nullif(current_setting('app.actor_kind', true), '');
  v_via      text := nullif(current_setting('app.actor_via', true), '');
  v_profile  text := nullif(current_setting('app.actor_profile_id', true), '');
  v_uid      uuid := auth.uid();
  v_kind     text;
  v_actor    uuid;
  v_meta     jsonb;
begin
  v_kind := case
    when v_guc_kind in ('ai', 'system', 'user') then v_guc_kind
    when v_uid is null then 'system'
    else 'user'
  end;
  v_actor := case when v_kind = 'user' then v_uid else null end;

  v_meta := jsonb_build_object(
    'match_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status, 'contact_id', NEW.contact_id);
  if v_via is not null then v_meta := v_meta || jsonb_build_object('via', v_via); end if;
  if v_profile is not null then v_meta := v_meta || jsonb_build_object('profile_id', v_profile); end if;
  if NEW.reaction_motif is not null then v_meta := v_meta || jsonb_build_object('motif', NEW.reaction_motif); end if;

  insert into activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  values
    (NEW.agency_id, v_actor, v_kind, 'match_reaction', 'contact', NEW.contact_id,
     OLD.status::text || ' → ' || NEW.status::text, 'deal', 'info', v_meta);
  return NEW;
end;
$function$;

revoke all on function public.log_match_reaction() from public, anon, authenticated;

-- ── 8. Le retour d'un bien refusé pour le prix, sur une BAISSE ───────────────
-- Deux fonctions, une par table : chacune lit la colonne de prix de la sienne.
create or replace function public.match_retour_prix_annonce()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prix numeric := coalesce(NEW.current_price, NEW.price);
begin
  with revenus as (
    update public.matches m
       set status = 'suggested', snoozed_until = null
     where m.market_listing_id = NEW.id
       and m.status = 'rejected'
       and m.reaction_motif = 'prix'
       and m.prix_propose is not null
       and v_prix < m.prix_propose
    returning m.id, m.agency_id, m.contact_id, m.prix_propose
  )
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  select r.agency_id, null, 'system', 'match_retour_prix', 'contact', r.contact_id, null, 'deal', 'info',
         jsonb_build_object('match_id', r.id, 'market_listing_id', NEW.id, 'prix_propose', r.prix_propose, 'prix', v_prix)
    from revenus r;
  return null;
end;
$function$;

create or replace function public.match_retour_prix_mandat()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  with revenus as (
    update public.matches m
       set status = 'suggested', snoozed_until = null
     where m.property_id = NEW.id
       and m.status = 'rejected'
       and m.reaction_motif = 'prix'
       and m.prix_propose is not null
       and NEW.price < m.prix_propose
    returning m.id, m.agency_id, m.contact_id, m.prix_propose
  )
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  select r.agency_id, null, 'system', 'match_retour_prix', 'contact', r.contact_id, null, 'deal', 'info',
         jsonb_build_object('match_id', r.id, 'property_id', NEW.id, 'prix_propose', r.prix_propose, 'prix', NEW.price)
    from revenus r;
  return null;
end;
$function$;

revoke all on function public.match_retour_prix_annonce() from public, anon, authenticated;
revoke all on function public.match_retour_prix_mandat() from public, anon, authenticated;

drop trigger if exists trg_market_listing_retour_prix on public.market_listings;
create trigger trg_market_listing_retour_prix
  after update of price, current_price on public.market_listings
  for each row
  when (coalesce(NEW.current_price, NEW.price) < coalesce(OLD.current_price, OLD.price))
  execute function public.match_retour_prix_annonce();

drop trigger if exists trg_property_retour_prix on public.properties;
create trigger trg_property_retour_prix
  after update of price on public.properties
  for each row
  when (NEW.price < OLD.price)
  execute function public.match_retour_prix_mandat();

-- ── 9. Les notes d'une recherche ajustée ─────────────────────────────────────
-- SECURITY INVOKER, appelée par l'edge en service_role (RLS contournée) : le cloisonnement vient des
-- filtres EXPLICITES — l'agence tirée du JWT de l'agent, la recherche visée, et `suggested` seulement
-- (un match proposé, répondu ou écarté entre-temps n'est jamais réécrit).
create or replace function public.matching_appliquer_notes(p_agency_id uuid, p_client_search_id uuid, p_notes jsonb)
returns table (id uuid, status text)
language sql
security invoker
set search_path to 'public', 'pg_temp'
as $$
  update public.matches m
     set score          = (n->>'score')::int,
         reasons        = coalesce(n->'reasons', '{}'::jsonb),
         score_version  = nullif(n->>'score_version', '')::int,
         status         = case when (n->>'ecarte')::boolean then 'ignored' else m.status end,
         reaction_motif = case when (n->>'ecarte')::boolean then 'recherche_ajustee' else m.reaction_motif end
    from jsonb_array_elements(p_notes) as n
   where m.id = (n->>'id')::uuid
     and m.agency_id = p_agency_id
     and m.client_search_id = p_client_search_id
     and m.status = 'suggested'
  returning m.id, m.status;
$$;

comment on function public.matching_appliquer_notes(uuid, uuid, jsonb) is
  'Lot B « Apprendre » : les notes d''une recherche ajustée (edge matching-engine, mode rescore-search). Sous le seuil : ignored, motif recherche_ajustee.';

revoke all on function public.matching_appliquer_notes(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.matching_appliquer_notes(uuid, uuid, jsonb) to service_role;

commit;
```

- [ ] **Step 3 : Déclarer les types**

⚠ `src/types/database.ts` est PARTAGÉ avec la pige (étape 1b), qui l'a déjà modifié le 21.09.2026 (`removed_at`, `market_price_history`). Le script le relit à l'exécution et n'insère que dans `matches`, `reminders` et la section `Functions`, à des ancres vérifiées. `CIBLE=<fichier>` l'applique à une autre copie (blob intermédiaire du commit, Task 2 Step 3). L'enregistrer dans le scratchpad de la session (hors dépôt), par exemple `$SCRATCH/types_boucle.py`, puis :

Run : `python3 $SCRATCH/types_boucle.py`

```python
"""Lot B, Task 1 : les types de la migration 20260921140000 dans database.ts."""
import os

chemin = os.environ.get('CIBLE', 'src/types/database.ts')
s = open(chemin, encoding='utf-8').read()
assert 'prix_propose' not in s, 'déjà appliqué'


def dans_table(texte, table, modifier):
    """N'édite que le bloc Row / Insert / Update de `table`."""
    debut = texte.index(f'      {table}: {{\n        Row: {{')
    fin = texte.index('        Relationships:', debut)
    return texte[:debut] + modifier(texte[debut:fin]) + texte[fin:]


def remplacer(bloc, ancien, nouveau, fois):
    assert bloc.count(ancien) == fois, (ancien, bloc.count(ancien))
    return bloc.replace(ancien, nouveau)


def matches(b):
    b = remplacer(b, '          agency_id: string\n          client_search_id: string | null\n',
                  '          agency_id: string\n          apprentissage_at: string | null\n          client_search_id: string | null\n', 1)
    b = remplacer(b, '          agency_id: string\n          client_search_id?: string | null\n',
                  '          agency_id: string\n          apprentissage_at?: string | null\n          client_search_id?: string | null\n', 1)
    b = remplacer(b, '          agency_id?: string\n          client_search_id?: string | null\n',
                  '          agency_id?: string\n          apprentissage_at?: string | null\n          client_search_id?: string | null\n', 1)
    b = remplacer(b, '          market_listing_id: string | null\n          property_id: string | null\n',
                  '          market_listing_id: string | null\n          prix_propose: number | null\n          property_id: string | null\n', 1)
    return remplacer(b, '          market_listing_id?: string | null\n          property_id?: string | null\n',
                     '          market_listing_id?: string | null\n          prix_propose?: number | null\n          property_id?: string | null\n', 2)


def reminders(b):
    b = remplacer(b, '          match_id: string | null\n          message_template: string | null\n',
                  '          match_id: string | null\n          match_ids: string[] | null\n          message_template: string | null\n', 1)
    return remplacer(b, '          match_id?: string | null\n          message_template?: string | null\n',
                     '          match_id?: string | null\n          match_ids?: string[] | null\n          message_template?: string | null\n', 2)


s = dans_table(s, 'matches', matches)
s = dans_table(s, 'reminders', reminders)
FONCTION = """      matching_appliquer_notes: {
        Args: { p_agency_id: string; p_client_search_id: string; p_notes: Json }
        Returns: {
          id: string
          status: string
        }[]
      }
"""
s = remplacer(s, '      matching_fil_marche: {\n', FONCTION + '      matching_fil_marche: {\n', 1)
open(chemin, 'w', encoding='utf-8').write(s)
print(chemin, 'ok')
```

Expected : `src/types/database.ts ok`. `git diff src/types/database.ts` montre, en plus des lignes de la pige, 3 × `apprentissage_at`, 3 × `prix_propose`, 3 × `match_ids` et `matching_appliquer_notes`.

- [ ] **Step 4 : Vérifier**

Run : `npm run lint:migrations && npm run lint:types-freshness`
Expected : les deux sortent en 0.

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS" ; echo fin`
Expected : `0` puis `fin` (colonnes ajoutées, aucun lecteur encore).

⚠ La migration ne se joue pas localement (pas de Docker) : c'est la spec de la Task 2, en CI (`backend.yml`), qui l'exécute.

- [ ] **Step 5 : Point de commit (au signal)** — avec la Task 2.

---

### Task 2 : La spec backend

**Files :** Create `tests/backend/matching-boucle.spec.ts`

- [ ] **Step 1 : Écrire la spec**

```ts
// Matching · lot B, la boucle chez l'agent (migration 20260921140000_matching_boucle.sql).
//   B1  prix_propose posé par la base au passage à `sent` ; la réponse d'avant effacée.
//   B2  la relance d'une PROPOSITION se clôt quand plus aucun de ses biens n'est `sent`.
//   B3  une relance d'avant le lot B (sans match_ids) se clôt sur son match_id.
//   B4  le journal d'un refus porte son motif ; un motif hors vocabulaire est refusé.
//   B5  un bien refusé pour le PRIX revient à proposer quand son prix baisse sous prix_propose
//       (annonce, puis mandat) ; un autre motif, ou une hausse, ne ramène rien.
//   B6  matching_appliquer_notes : service_role seul ; ne touche que les `suggested` de la recherche
//       et de l'agence visées.
//   B7  l'edge matching-engine, mode rescore-search : renote par le vrai barème, écarte sous le seuil,
//       ne touche pas un match ajouté à la main, pose les critères (et la fiche identique), prend les
//       refus en compte, écrit au journal ; la recherche d'une autre agence est introuvable.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 1_600_000 }

async function tokenOf(client: TwoAgenciesSetup['clientA']): Promise<string> {
  const { data } = await client.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('session attendue')
  return t
}

async function invoke(fn: string, jwt: string, body: unknown) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('matching · lot B — la boucle chez l’agent', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const annonces: string[] = []
  const biens: string[] = []
  const matchs: string[] = []
  const relances: string[] = []

  const mkContact = async (agencyId: string, nom: string, criteres: Record<string, unknown> | null = null) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Boucle', last_name: `${nom} ${s.stamp}`, type: 'buyer', search_criteria: criteres,
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  const mkAnnonce = async (tag: string, prix: number, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `boucle-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `Boucle ${tag} ${s.stamp}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', rooms: 4.5, surface_m2: 110,
      features: ['Balcon'], price: prix, current_price: prix, quality_score: 70, status: 'active', ...champs,
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }
  const mkBien = async (tag: string, prix: number) => {
    // 'draft' : évite on_property_active (net.http_post) ; un match n'exige qu'une FK valide.
    const { data, error } = await svc.from('properties').insert({
      agency_id: s.agencyAId, title: `Boucle ${tag} ${s.stamp}`, type: 'apartment', status: 'draft', transaction_type: 'buy', price: prix,
    }).select('id').single()
    if (error) throw new Error(`properties ${tag}: ${error.message}`)
    biens.push(data.id as string)
    return data.id as string
  }
  const mkMatch = async (contactId: string, cible: { annonce?: string; bien?: string }, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: s.agencyAId, contact_id: contactId, score: 80, status: 'suggested',
      source: cible.annonce ? 'market' : 'internal',
      market_listing_id: cible.annonce ?? null, property_id: cible.bien ?? null, ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    matchs.push(data.id as string)
    return data.id as string
  }
  const lireMatch = async (id: string) => {
    const { data } = await svc.from('matches').select('*').eq('id', id).single()
    return data as Record<string, unknown>
  }
  const mkRelance = async (contactId: string, matchId: string, matchIds: string[] | null) => {
    const { data, error } = await svc.from('reminders').insert({
      agency_id: s.agencyAId, contact_id: contactId, type: 'follow_up_sent_property', trigger_rule: 'manual',
      trigger_days: 3, trigger_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), status: 'pending', channel: 'task',
      match_id: matchId, match_ids: matchIds, message_template: 'Retour (spec boucle)',
    }).select('id').single()
    if (error) throw new Error(`reminders: ${error.message}`)
    relances.push(data.id as string)
    return data.id as string
  }
  const statutRelance = async (id: string) =>
    ((await svc.from('reminders').select('status').eq('id', id).single()).data as { status: string }).status

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé.
    if (relances.length) await svc.from('reminders').delete().in('id', relances)
    if (matchs.length) await svc.from('matches').delete().in('id', matchs)
    if (contacts.length) await svc.from('client_searches').delete().in('contact_id', contacts)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (biens.length) await svc.from('properties').delete().in('id', biens)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('B1 — prix_propose au passage à `sent` (prix courant de l’annonce) ; la réponse d’avant effacée', async () => {
    const c = await mkContact(s.agencyAId, 'B1')
    const a = await mkAnnonce('b1', 1_400_000, { current_price: 1_350_000 })
    const m = await mkMatch(c, { annonce: a }, { reaction_motif: 'prix', reaction_note: 'avant', apprentissage_at: new Date().toISOString() })
    await svc.from('matches').update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() }).eq('id', m)
    const apres = await lireMatch(m)
    expect(Number(apres.prix_propose)).toBe(1_350_000)
    expect(apres.reaction_motif).toBeNull()
    expect(apres.reaction_note).toBeNull()
    expect(apres.apprentissage_at).toBeNull()
  })

  it('B2 — une sélection : la relance tient tant qu’un bien attend, se clôt au dernier', async () => {
    const c = await mkContact(s.agencyAId, 'B2')
    const a1 = await mkAnnonce('b2a', 1_200_000)
    const a2 = await mkAnnonce('b2b', 1_250_000)
    const m1 = await mkMatch(c, { annonce: a1 }, { status: 'sent' })
    const m2 = await mkMatch(c, { annonce: a2 }, { status: 'sent' })
    const r = await mkRelance(c, m2, [m1, m2])
    await svc.from('matches').update({ status: 'interested' }).eq('id', m2)
    expect(await statutRelance(r), 'm1 attend encore').toBe('pending')
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'quartier' }).eq('id', m1)
    expect(await statutRelance(r)).toBe('done')
  })

  it('B3 — une relance sans match_ids se clôt sur la réponse à son match_id', async () => {
    const c = await mkContact(s.agencyAId, 'B3')
    const m = await mkMatch(c, { annonce: await mkAnnonce('b3', 1_100_000) }, { status: 'sent' })
    const r = await mkRelance(c, m, null)
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'surface' }).eq('id', m)
    expect(await statutRelance(r)).toBe('done')
  })

  it('B4 — le journal d’un refus porte son motif ; un motif inconnu est refusé', async () => {
    const c = await mkContact(s.agencyAId, 'B4')
    const m = await mkMatch(c, { annonce: await mkAnnonce('b4', 1_000_000) }, { status: 'sent' })
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'prix' }).eq('id', m)
    const { data } = await svc.from('activity_events').select('metadata').eq('action', 'match_reaction').eq('entity_id', c)
    expect(((data ?? []) as { metadata: Record<string, unknown> }[]).some((e) => e.metadata.match_id === m && e.metadata.motif === 'prix')).toBe(true)
    const { error } = await svc.from('matches').update({ reaction_motif: 'trop cher' }).eq('id', m)
    expect(error?.code).toBe('23514')
  })

  it('B5 — refusé pour le prix : revient sur une BAISSE sous le prix proposé ; ni un autre motif, ni une hausse', async () => {
    const c = await mkContact(s.agencyAId, 'B5')
    const a = await mkAnnonce('b5', 1_500_000)
    const prix = await mkMatch(c, { annonce: a }, { status: 'rejected', reaction_motif: 'prix', prix_propose: 1_500_000 })
    const c2 = await mkContact(s.agencyAId, 'B5bis')
    const quartier = await mkMatch(c2, { annonce: a }, { status: 'rejected', reaction_motif: 'quartier', prix_propose: 1_500_000 })
    await svc.from('market_listings').update({ current_price: 1_550_000 }).eq('id', a)
    expect((await lireMatch(prix)).status, 'une hausse ne ramène rien').toBe('rejected')
    await svc.from('market_listings').update({ current_price: 1_450_000 }).eq('id', a)
    const revenu = await lireMatch(prix)
    expect(revenu.status).toBe('suggested')
    expect(revenu.reaction_motif, 'le motif reste : c’est lui qui écrit le signal').toBe('prix')
    expect(Number(revenu.prix_propose)).toBe(1_500_000)
    expect((await lireMatch(quartier)).status).toBe('rejected')
    const { data } = await svc.from('activity_events').select('metadata').eq('action', 'match_retour_prix').eq('entity_id', c)
    expect(((data ?? []) as { metadata: Record<string, unknown> }[]).some((e) => e.metadata.match_id === prix)).toBe(true)

    const b = await mkBien('b5', 2_100_000)
    const c3 = await mkContact(s.agencyAId, 'B5ter')
    const mandat = await mkMatch(c3, { bien: b }, { status: 'rejected', reaction_motif: 'prix', prix_propose: 2_100_000 })
    await svc.from('properties').update({ price: 1_950_000 }).eq('id', b)
    expect((await lireMatch(mandat)).status).toBe('suggested')
  })

  it('B6 — matching_appliquer_notes : refusée à un agent ; ne réécrit que les `suggested` de la recherche visée', async () => {
    const c = await mkContact(s.agencyAId, 'B6')
    const { data: rs, error: re } = await svc.from('client_searches')
      .insert({ agency_id: s.agencyAId, contact_id: c, criteria: CRITERES, is_active: false }).select('id').single()
    if (re) throw new Error(re.message)
    const recherche = rs.id as string
    const vise = await mkMatch(c, { annonce: await mkAnnonce('b6a', 1_000_000) }, { client_search_id: recherche })
    const repondu = await mkMatch(c, { annonce: await mkAnnonce('b6b', 1_000_000) }, { client_search_id: recherche, status: 'interested' })
    const notes = [
      { id: vise, score: 42, reasons: { budget: { match: false, score: 0, detail: 'x' } }, score_version: 4, ecarte: true },
      { id: repondu, score: 42, reasons: {}, score_version: 4, ecarte: true },
    ]
    const refus = await s.clientA.rpc('matching_appliquer_notes', { p_agency_id: s.agencyAId, p_client_search_id: recherche, p_notes: notes })
    expect(refus.error?.code).toBe('42501')
    const { data, error } = await svc.rpc('matching_appliquer_notes', { p_agency_id: s.agencyAId, p_client_search_id: recherche, p_notes: notes })
    expect(error).toBeNull()
    expect(data).toEqual([{ id: vise, status: 'ignored' }])
    expect(await lireMatch(vise)).toMatchObject({ status: 'ignored', reaction_motif: 'recherche_ajustee', score: 42, score_version: 4 })
    expect(await lireMatch(repondu)).toMatchObject({ status: 'interested', score: 80 })
    const autreAgence = await svc.rpc('matching_appliquer_notes', { p_agency_id: s.agencyBId, p_client_search_id: recherche, p_notes: notes })
    expect(autreAgence.data).toEqual([])
  })

  it('B7 — rescore-search : le vrai barème, les critères, la fiche, les refus, le journal', async () => {
    const c = await mkContact(s.agencyAId, 'B7', CRITERES)
    const { data: rs } = await svc.from('client_searches').select('id').eq('contact_id', c).single()
    const recherche = (rs as { id: string }).id
    const ok = await mkMatch(c, { annonce: await mkAnnonce('b7ok', 1_500_000) }, { client_search_id: recherche, score_version: 4 })
    const hors = await mkMatch(c, { annonce: await mkAnnonce('b7hors', 1_700_000) }, { client_search_id: recherche, score_version: 4 })
    const main = await mkMatch(c, { annonce: await mkAnnonce('b7main', 1_720_000) }, { client_search_id: recherche, score: 70, score_version: null })
    const r1 = await mkMatch(c, { annonce: await mkAnnonce('b7r1', 1_480_000) }, { client_search_id: recherche, status: 'rejected', reaction_motif: 'prix', prix_propose: 1_480_000 })
    const r2 = await mkMatch(c, { annonce: await mkAnnonce('b7r2', 1_460_000) }, { client_search_id: recherche, status: 'rejected', reaction_motif: 'prix', prix_propose: 1_460_000 })
    const apres = { ...CRITERES, budget_max: 1_450_000 }

    const jwtB = await tokenOf(s.clientB)
    const etranger = await invoke('matching-engine', jwtB, { mode: 'rescore-search', client_search_id: recherche, criteria: apres })
    expect(etranger.status).toBe(404)

    const jwtA = await tokenOf(s.clientA)
    const { status, body } = await invoke('matching-engine', jwtA, {
      mode: 'rescore-search', client_search_id: recherche, criteria: apres, motif: 'prix', refus_ids: [r1, r2],
    })
    expect(status, JSON.stringify(body)).toBe(200)
    expect(body).toMatchObject({ reevalues: 2, ecartes: 1 })
    // Notes de calculateScoreV2 (budget, zone, type actifs) : 1'500'000 → 89 ; 1'700'000 → 53, sous le seuil.
    expect(await lireMatch(ok)).toMatchObject({ status: 'suggested', score: 89 })
    expect(await lireMatch(hors)).toMatchObject({ status: 'ignored', score: 53, reaction_motif: 'recherche_ajustee' })
    expect(await lireMatch(main)).toMatchObject({ status: 'suggested', score: 70 })
    const { data: cs } = await svc.from('client_searches').select('criteria').eq('id', recherche).single()
    expect((cs as { criteria: Record<string, unknown> }).criteria).toMatchObject({ budget_max: 1_450_000 })
    const { data: fiche } = await svc.from('contacts').select('search_criteria').eq('id', c).single()
    expect((fiche as { search_criteria: Record<string, unknown> }).search_criteria).toMatchObject({ budget_max: 1_450_000 })
    expect((await lireMatch(r1)).apprentissage_at).not.toBeNull()
    expect((await lireMatch(r2)).apprentissage_at).not.toBeNull()
    const { data: j } = await svc.from('activity_events').select('actor_kind, metadata').eq('action', 'recherche_ajustee').eq('entity_id', c)
    expect(j).toEqual([expect.objectContaining({ actor_kind: 'user', metadata: expect.objectContaining({ motif: 'prix', reevalues: 2, ecartes: 1 }) })])
  })
})
```

- [ ] **Step 2 : Vérifier qu'elle se charge et se saute sans clés**

Run : `npx vitest run --config=vitest.backend.config.ts tests/backend/matching-boucle.spec.ts`
Expected : `1 skipped` (pas de `supabase start` local). Elle tourne pour de bon en CI, dans `backend.yml`, à l'ouverture de la PR — c'est là qu'on la regarde passer.

- [ ] **Step 3 : Point de commit (au signal)**

⚠ Si `git diff src/types/database.ts` montre encore des lignes de la pige (non commitées), ne PAS l'ajouter tel quel : indexer un blob intermédiaire — la version de `HEAD` plus les seules lignes de ce lot — puis vérifier l'index.

```bash
git show HEAD:src/types/database.ts > "$SCRATCH/database.head.ts"
CIBLE="$SCRATCH/database.head.ts" python3 "$SCRATCH/types_boucle.py"
git update-index --cacheinfo 100644,"$(git hash-object -w "$SCRATCH/database.head.ts")",src/types/database.ts
git diff --cached src/types/database.ts   # 3 apprentissage_at, 3 prix_propose, 3 match_ids, matching_appliquer_notes : rien d'autre
git add supabase/migrations/20260921140000_matching_boucle.sql tests/backend/matching-boucle.spec.ts
git commit -m "feat(db): la boucle du matching en base, prix proposé, relance d'une sélection, retour par baisse de prix"
```

Sinon (la pige a commité ses types), `git add src/types/database.ts` avec les deux autres fichiers.

---

### Task 3 : Le module pur de réévaluation (moteur)

**Files :**
- Create : `supabase/functions/_shared/matching-renotation.ts`
- Create : `tests/unit/matching-renotation.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `tests/unit/matching-renotation.spec.ts` :

```ts
/**
 * « Apprendre » côté moteur (lot B) : la réévaluation des matchs à proposer d'une recherche ajustée rejoue
 * le VRAI barème (`calculateScoreV2`), écarte sous le seuil, et ne touche pas un match ajouté à la main.
 * Module pur de l'edge `matching-engine`, mode `rescore-search`.
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import { memesCriteres, renoter, tranches, type MatchARenoter } from '../../supabase/functions/_shared/matching-renotation'

const CRITERES = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_550_000,
  rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'],
}
const annonce = (id: string, prix: number, champs: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, price: prix, current_price: prix, type: 'apartment', city: 'Genève', canton: 'GE', rooms: 4.5, surface_m2: 132,
  features: ['Terrasse', 'Ascenseur', 'Balcon'], status: 'active', price_at_first_seen: prix, transaction_type: 'buy', ...champs,
})
const match = (id: string, bienId: string, champs: Partial<MatchARenoter> = {}): MatchARenoter => ({
  id, property_id: null, market_listing_id: bienId, score_version: 4, ...champs,
})
const sansLoyer = () => null

describe('renoter — le vrai barème, sur les critères corrigés', () => {
  const biens = new Map<string, Record<string, unknown>>([
    ['ml-2', annonce('ml-2', 1_590_000)],
    ['ml-4', annonce('ml-4', 1_750_000, { city: 'Onex', rooms: 3.5, surface_m2: 92, features: ['Ascenseur'] })],
  ])

  it('score et raisons de calculateScoreV2 ; sous le seuil, écarté', () => {
    const notes = renoter([match('m9', 'ml-2'), match('m19', 'ml-4')], biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    const attendu = (id: string) => calculateScoreV2(biens.get(id)!, CRITERES, DEFAULT_SCORING_CONFIG, null)
    expect(notes).toEqual([
      { id: 'm9', score: attendu('ml-2').total, reasons: attendu('ml-2').reasons, score_version: DEFAULT_SCORING_CONFIG.version, ecarte: false },
      { id: 'm19', score: attendu('ml-4').total, reasons: attendu('ml-4').reasons, score_version: DEFAULT_SCORING_CONFIG.version, ecarte: true },
    ])
    // Les notes du banc (Task 16) : 94, et 49 sous le seuil.
    expect(notes.map((n) => n.score)).toEqual([94, 49])
  })

  it('un match ajouté à la main (sans `score_version`), ou dont le bien est illisible, n’est pas renoté', () => {
    expect(renoter(
      [match('m-main', 'ml-2', { score_version: null }), match('m-perdu', 'ml-inconnue')],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
  })

  it('un bien d’une autre transaction est écarté, comme le moteur ne l’aurait jamais créé', () => {
    const loc = new Map([['p-loc', annonce('p-loc', 3_000, { transaction_type: 'rent' })]])
    const [n] = renoter([match('m-x', 'p-loc', { market_listing_id: null, property_id: 'p-loc' })], loc, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    expect(n).toMatchObject({ id: 'm-x', score: 0, ecarte: true })
  })

  it('la référence loyer ne sert qu’une annonce du MARCHÉ d’une recherche de LOCATION', () => {
    const refLoyer = vi.fn(() => null)
    renoter([match('m9', 'ml-2')], biens, CRITERES, DEFAULT_SCORING_CONFIG, refLoyer)
    expect(refLoyer).not.toHaveBeenCalled()
    const loyer = { ...CRITERES, transaction_type: 'rent', budget_min: 2_000, budget_max: 3_000 }
    const locations = new Map([
      ['ml-l', annonce('ml-l', 2_800, { transaction_type: 'rent' })],
      ['p-l', annonce('p-l', 2_800, { transaction_type: 'rent' })],
    ])
    renoter([match('a', 'ml-l'), match('b', 'p-l', { market_listing_id: null, property_id: 'p-l' })], locations, loyer, DEFAULT_SCORING_CONFIG, refLoyer)
    expect(refLoyer).toHaveBeenCalledTimes(1)
  })
})

describe('memesCriteres et tranches', () => {
  it('compare des critères quel que soit l’ordre des clés', () => {
    expect(memesCriteres({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
    expect(memesCriteres({ a: 1 }, { a: 2 })).toBe(false)
    expect(memesCriteres(null, null)).toBe(true)
    expect(memesCriteres({ zones: ['GE'] }, null)).toBe(false)
  })

  it('découpe en lots', () => {
    expect(tranches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(tranches([], 2)).toEqual([])
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-renotation.spec.ts`
Expected : FAIL (module `matching-renotation` introuvable).

- [ ] **Step 3 : Écrire le module**

Créer `supabase/functions/_shared/matching-renotation.ts` :

```ts
// Matching — la RÉÉVALUATION des matchs à proposer d'une recherche ajustée (lot B de la boucle chez
// l'agent, « Apprendre »). Fonctions PURES, comme matching-normalize.ts : zéro I/O, zéro API Deno —
// réutilisées par l'edge matching-engine (mode `rescore-search`) ET par les tests vitest (Node).
//
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.6 et §12.
//
// POURQUOI. Le moteur ne re-note jamais une paire existante : `insert_*_matches` est en
// `ON CONFLICT DO NOTHING`. Une recherche corrigée garderait ses anciens scores et ses anciennes raisons.
// Ce module rejoue le VRAI barème (`calculateScoreV2`) sur les matchs encore à proposer ; l'edge en fait
// les lectures et les écritures (RPC `matching_appliquer_notes`).
//
// Mêmes règles qu'à la création : une autre transaction ⇒ écarté (un loyer n'est jamais une vente) ;
// référence loyer SEULEMENT pour une annonce du marché d'une recherche de location.
//
// ⛔ UN MATCH AJOUTÉ À LA MAIN N'EST PAS RENOTÉ. La Recherche (« Ajouter à la sélection de … ») crée des
// matchs SANS `score_version`, avec ses propres raisons : l'agent les a choisis. Les écarter parce que le
// barème ne les retiendrait pas déferait une décision humaine.

import { calculateScoreV2, inferTransactionType, type MatchReasons, type ScoringConfig } from './matching-normalize.ts'
import type { RentPosition } from './rent-reference.ts'

/** Un match `suggested` de la recherche, tel que l'edge le lit. */
export interface MatchARenoter {
  id: string
  property_id: string | null
  market_listing_id: string | null
  /** `null` : ajouté à la main (Recherche), jamais renoté. */
  score_version: number | null
}

/** Ce que la RPC `matching_appliquer_notes` écrit pour un match. */
export interface NoteMatch {
  id: string
  score: number
  reasons: MatchReasons
  score_version: number
  /** Sous le seuil (ou autre transaction) : le match sort des propositions. */
  ecarte: boolean
}

/**
 * Les notes des matchs à proposer d'une recherche, avec ses critères CORRIGÉS. `biens` : les mandats et les
 * annonces par id, colonnes du barème ; `refLoyer` : la position loyer d'une annonce du marché.
 */
export function renoter(
  matchs: readonly MatchARenoter[],
  biens: ReadonlyMap<string, Record<string, unknown>>,
  criteres: Record<string, unknown>,
  cfg: ScoringConfig,
  refLoyer: (annonce: Record<string, unknown>) => RentPosition | null,
): NoteMatch[] {
  const tx = inferTransactionType(criteres)
  const notes: NoteMatch[] = []
  for (const m of matchs) {
    if (m.score_version == null) continue
    const marche = m.market_listing_id != null
    const idBien = marche ? m.market_listing_id : m.property_id
    const bien = idBien ? biens.get(idBien) : undefined
    // Un bien que la lecture n'a pas rendu (supprimé, autre agence) : on ne note pas sur une absence.
    if (!bien) continue
    const note = calculateScoreV2(bien, criteres, cfg, marche && tx === 'rent' ? refLoyer(bien) : null)
    const autreTransaction = typeof bien.transaction_type === 'string' && bien.transaction_type !== tx
    notes.push({
      id: m.id,
      score: autreTransaction ? 0 : note.total,
      reasons: note.reasons,
      score_version: cfg.version,
      ecarte: autreTransaction || note.total < cfg.threshold,
    })
  }
  return notes
}

/**
 * Deux critères de recherche identiques, quel que soit l'ordre de leurs clés : la fiche du contact ne reçoit
 * la correction que si elle portait EXACTEMENT les critères corrigés (sinon elle en sait plus, ou autre chose).
 */
export function memesCriteres(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

function stable(v: unknown): string {
  if (v == null) return 'null'
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

/** Découpe en lots : un `.in()` de centaines d'uuid dépasse la limite des en-têtes, et une RPC géante le délai. */
export function tranches<T>(xs: readonly T[], taille: number): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < xs.length; i += taille) lots.push(xs.slice(i, i + taille))
  return lots
}
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/unit/matching-renotation.spec.ts`
Expected : PASS, 6 tests.

- [ ] **Step 5 : Point de commit (au signal)** — avec la Task 4.

---

### Task 4 : Le mode `rescore-search` de `matching-engine`

**Files :** Modify `supabase/functions/matching-engine/index.ts`

- [ ] **Step 1 : Importer le module**

Juste APRÈS le bloc d'import de `'../_shared/matching-normalize.ts'` (qui se termine par `} from '../_shared/matching-normalize.ts'`), ajouter :

```ts
import { memesCriteres, renoter, tranches, type MatchARenoter } from '../_shared/matching-renotation.ts'
```

- [ ] **Step 2 : Élargir le corps de requête**

Remplacer INTÉGRALEMENT :

```ts
interface RequestBody {
  mode: 'match-property' | 'match-contact' | 'scan-all'
  property_id?: string
  contact_id?: string
  include_market?: boolean // Aussi matcher contre market_listings (veille marché)
}
```

par :

```ts
interface RequestBody {
  mode: 'match-property' | 'match-contact' | 'scan-all' | 'rescore-search'
  property_id?: string
  contact_id?: string
  include_market?: boolean // Aussi matcher contre market_listings (veille marché)
  /** rescore-search : la recherche dont les matchs à proposer sont renotés (lot B, « Apprendre »). */
  client_search_id?: string
  /** rescore-search : les critères CORRIGÉS, posés sur la recherche APRÈS la renotation. Absents : ses critères actuels. */
  criteria?: Record<string, unknown>
  /** rescore-search : le motif de refus qui a produit la correction (journal). */
  motif?: string
  /** rescore-search : les refus pris en compte (`apprentissage_at`), 50 au plus. */
  refus_ids?: string[]
}
```

- [ ] **Step 3 : Sortir `PROP_COLS` du gestionnaire**

Supprimer les deux lignes :

```ts
    // colonnes lues par le scoring (jamais description/photos — règles perf §7)
    const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features'
```

et ajouter, juste APRÈS la fonction `numOrNull` (qui se termine par `  return Number.isFinite(n) ? n : null\n}`), le bloc :

```ts

// colonnes lues par le scoring (jamais description/photos — règles perf §7)
const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features'
/** Ce que le barème lit d'une annonce du marché : ce que rend `match_candidate_listings`. */
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Les motifs qu'« Apprendre » chiffre (le CHECK `matches_reaction_motif_check` en porte d'autres). */
const MOTIFS_CORRECTION = new Set(['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements'])
/** `max_rows` de PostgREST : au-delà, une lecture tronque EN SILENCE. */
const PAGE_MATCHS = 1000
const LOT_IDS = 100
const LOT_NOTES = 500

/**
 * `rescore-search` — la réévaluation des matchs à proposer d'une recherche ajustée (lot B, « Apprendre »).
 *
 * ⚠ L'ORDRE EST LE CONTRAT. (1) renoter avec les critères corrigés, EN MÉMOIRE ; (2) écrire les notes ;
 * (3) poser les critères sur la recherche, et sur la fiche si elle portait exactement les mêmes — sans quoi
 * le pont `sync_contact_client_search` remettrait l'ancienne au prochain enregistrement de la fiche ;
 * (4) marquer les refus pris en compte ; (5) UNE ligne au journal. Chaque étape se rejoue sans dommage :
 * une panne au milieu laisse la correction proposée à l'écran, et la même validation la termine. Écrire
 * les critères d'abord effaçait la correction (plus d'écart à proposer) sans avoir rien renoté.
 *
 * ⚠ La mise à jour des critères déclenche `trigger_matching_on_search_updated`, qui relance le moteur en
 * `match-contact` (pg_net, asynchrone) : les biens que la recherche corrigée retient DE PLUS y naissent.
 */
async function renoterRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  body: RequestBody,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const refus = body.refus_ids ?? []
  const criteresLisibles = body.criteria === undefined
    || (typeof body.criteria === 'object' && body.criteria !== null && !Array.isArray(body.criteria))
  if (!body.client_search_id || !UUID.test(body.client_search_id) || !criteresLisibles
    || !Array.isArray(refus) || refus.length > 50 || !refus.every((id) => typeof id === 'string' && UUID.test(id))
    || (body.motif !== undefined && !MOTIFS_CORRECTION.has(body.motif))) {
    return { statut: 400, corps: { error: 'invalid_body' } }
  }

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  const avant = (recherche.criteria ?? null) as Record<string, unknown> | null
  const criteres = body.criteria ?? avant
  if (!criteres) return { statut: 400, corps: { error: 'invalid_body' } }

  // 1. Les matchs à proposer de la recherche, page par page (idx_matches_agency_focus).
  const matchs: MatchARenoter[] = []
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, property_id, market_listing_id, score_version')
      .eq('agency_id', agencyId)
      .eq('contact_id', recherche.contact_id)
      .eq('client_search_id', recherche.id)
      .eq('status', 'suggested')
      .order('id')
      .range(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const page = (data ?? []) as MatchARenoter[]
    matchs.push(...page)
    if (page.length < PAGE_MATCHS) break
  }

  // Leurs biens, colonnes du barème seulement.
  const biens = new Map<string, Record<string, unknown>>()
  const mandats = [...new Set(matchs.map((m) => m.property_id).filter((id): id is string => id != null))]
  for (const lot of tranches(mandats, LOT_IDS)) {
    const { data, error } = await supabase.from('properties').select(PROP_COLS).eq('agency_id', agencyId).in('id', lot)
    if (error) throw error
    for (const p of (data ?? []) as Record<string, unknown>[]) biens.set(p.id as string, p)
  }
  const annonces = [...new Set(matchs.map((m) => m.market_listing_id).filter((id): id is string => id != null))]
  for (const lot of tranches(annonces, LOT_IDS)) {
    const { data, error } = await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).in('id', lot)
    if (error) throw error
    for (const a of (data ?? []) as Record<string, unknown>[]) biens.set(a.id as string, a)
  }

  // 1-2. Le VRAI barème, sur les critères corrigés — AVANT de les poser.
  const notes = renoter(matchs, biens, criteres, cfg, (a) => rentPosition({
    canton: (a.canton as string | null) ?? null,
    type: (a.type as string | null) ?? null,
    surface_m2: numOrNull(a.surface_m2),
    loyer: numOrNull(a.current_price) ?? numOrNull(a.price),
  }, rentIndex))
  const ecartes: string[] = []
  let reevalues = 0
  for (const lot of tranches(notes, LOT_NOTES)) {
    const { data, error } = await supabase.rpc('matching_appliquer_notes', {
      p_agency_id: agencyId, p_client_search_id: recherche.id, p_notes: lot,
    })
    if (error) throw error
    for (const l of (data ?? []) as { id: string; status: string }[]) {
      reevalues++
      if (l.status === 'ignored') ecartes.push(l.id)
    }
  }

  // 3. Les critères corrigés, sur la recherche — et sur la fiche si elle portait EXACTEMENT les mêmes.
  if (body.criteria) {
    const { error: cErr } = await supabase
      .from('client_searches').update({ criteria: body.criteria }).eq('id', recherche.id).eq('agency_id', agencyId)
    if (cErr) throw cErr
    const { data: fiche, error: fErr } = await supabase
      .from('contacts').select('search_criteria').eq('id', recherche.contact_id).eq('agency_id', agencyId).maybeSingle()
    if (fErr) throw fErr
    if (fiche && memesCriteres(fiche.search_criteria, avant)) {
      const { error: uErr } = await supabase
        .from('contacts').update({ search_criteria: body.criteria }).eq('id', recherche.contact_id).eq('agency_id', agencyId)
      if (uErr) throw uErr
    }
  }

  // 4. Les refus pris en compte : deux NOUVEAUX refus pour ce motif en proposeront une autre.
  if (refus.length > 0) {
    const { error } = await supabase
      .from('matches')
      .update({ apprentissage_at: new Date().toISOString() })
      .in('id', refus)
      .eq('agency_id', agencyId)
      .eq('client_search_id', recherche.id)
      .eq('status', 'rejected')
    if (error) throw error
  }

  // 5. UNE ligne au journal (CLAUDE.md §5) : ce qui a changé, et ce qui en est sorti.
  const { error: jErr } = await supabase.from('activity_events').insert({
    agency_id: agencyId,
    actor_id: acteurId,
    actor_kind: acteurId ? 'user' : 'system',
    action: body.criteria ? 'recherche_ajustee' : 'matchs_reevalues',
    entity_type: 'contact',
    entity_id: recherche.contact_id,
    category: 'contact',
    severity: 'info',
    object_label: null,
    metadata: {
      client_search_id: recherche.id, motif: body.motif ?? null, avant, apres: body.criteria ?? null,
      refus_ids: refus, reevalues, ecartes: ecartes.length, match_ids_ecartes: ecartes.slice(0, 50), score_version: cfg.version,
    },
  })
  if (jErr) console.error('[matching-engine] activity_events insert failed:', jErr.message)

  return { statut: 200, corps: { reevalues, ecartes: ecartes.length, mode: 'rescore-search', scoreVersion: cfg.version } }
}
```

- [ ] **Step 4 : Retenir l'agent qui appelle**

Remplacer :

```ts
    let supabase: SupabaseClient
    let agency_id: string
```

par :

```ts
    let supabase: SupabaseClient
    let agency_id: string
    // L'agent derrière le JWT — `null` pour un appel de service : le journal de `rescore-search` le nomme.
    let acteurId: string | null = null
```

et, dans la branche `else` qui suit, remplacer :

```ts
      supabase = auth.supabase
      agency_id = auth.profile.agency_id // JWT-derived, on ignore body.agency_id
```

par :

```ts
      supabase = auth.supabase
      agency_id = auth.profile.agency_id // JWT-derived, on ignore body.agency_id
      acteurId = auth.profile.id
```

- [ ] **Step 5 : Brancher le mode**

Remplacer :

```ts
    } else {
      return new Response(JSON.stringify({ error: 'invalid_mode' }), {
```

par :

```ts
    } else if (mode === 'rescore-search') {
      const r = await renoterRecherche(supabase, agency_id, acteurId, body, cfg, rentIndex)
      return new Response(JSON.stringify(r.corps), {
        status: r.statut, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify({ error: 'invalid_mode' }), {
```

- [ ] **Step 6 : Vérifier**

Run : `deno check --no-lock supabase/functions/matching-engine/index.ts supabase/functions/_shared/matching-renotation.ts`
Expected : `Check …` sans erreur.

Run : `npx vitest run tests/unit/edge-corps-erreur.spec.ts tests/unit/activity-events-category.spec.ts tests/unit/edge-secret-compare.spec.ts tests/unit/edge-guard-order.spec.ts tests/unit/matching-sans-sortie.spec.ts`
Expected : PASS (aucune réponse ne recopie une erreur ; l'écriture au journal porte `category`).

- [ ] **Step 7 : Point de commit (au signal)**

```bash
git add supabase/functions/_shared/matching-renotation.ts supabase/functions/matching-engine/index.ts tests/unit/matching-renotation.spec.ts
git commit -m "feat(matching-engine): renoter une recherche ajustée, mode rescore-search"
```

---

### Task 5 : Le modèle de la boucle

**Files :**
- Modify : `src/components/matching-fil/filModele.ts`
- Create : `src/components/matching-fil/filBoucle.ts`
- Create : `tests/unit/matching-fil-boucle.spec.ts`
- Modify : `tests/unit/matching-fil-modele.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `tests/unit/matching-fil-boucle.spec.ts` :

```ts
/**
 * La boucle chez l'agent (lot B) — le modèle pur des onglets « En attente » et « À conclure », et le signal
 * « prix baissé ». Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4 et §5.
 */
import { describe, expect, it } from 'vitest'
import {
  cleAttente, construireAConclure, construireAttente, ongletValide, signalPrix, type RelanceProposition,
} from '@/components/matching-fil/filBoucle'
import type { FilBien, FilFiltres, FilMatch, SuiviMatch } from '@/components/matching-fil/filModele'

const MAINTENANT = Date.parse('2026-09-21T12:00:00.000Z')
const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const bien = (id: string, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre: `Bien ${id}`, prix: 1_000_000, location: false, type: 'apartment', pieces: 4.5,
  surface: 110, ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, ...champs,
})
const acheteur = (id: string, prenom = `Prénom${id}`): FilMatch['acheteur'] => ({
  id, prenom, nom: `Nom${id}`, telephone: null, email: null, kyc: 'none',
})
const suivi = (champs: Partial<SuiviMatch>): SuiviMatch => ({
  statut: 'sent', proposeLe: null, reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null, ...champs,
})
const match = (id: string, a: FilMatch['acheteur'], s: Partial<SuiviMatch>, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 90, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: bien(`b-${id}`), acheteur: a,
  suivi: suivi(s), ...champs,
})
const relance = (id: string, contactId: string, matchIds: string[], echeance: string | null): RelanceProposition =>
  ({ id, contactId, matchIds, echeance })

describe('construireAttente — une ligne par acheteur (§5)', () => {
  const julie = acheteur('c9', 'Julie')
  const emma = acheteur('c7', 'Emma')
  const camille = acheteur('c1', 'Camille')

  it('groupe les biens proposés sans réponse, le plus récent d’abord ; les autres statuts n’y sont pas', () => {
    const lignes = construireAttente([
      match('m14', julie, { proposeLe: '2026-09-19T10:00:00.000Z' }),
      match('m15', julie, { proposeLe: '2026-09-20T10:00:00.000Z' }),
      match('m16', julie, { statut: 'rejected', motif: 'prix' }),
      match('m6', emma, { statut: 'interested' }),
    ], [], SANS_FILTRE, MAINTENANT)
    expect(lignes.map((l) => [l.acheteur.id, l.matchs.map((m) => m.id)])).toEqual([['c9', ['m15', 'm14']]])
  })

  it('les relances échues en tête, puis la plus proche ; sans relance, en dernier', () => {
    const lignes = construireAttente([match('m14', julie, {}), match('m18', emma, {}), match('m1', camille, {})], [
      relance('rb1', 'c9', ['m14', 'm15'], '2026-09-22T10:00:00.000Z'),
      relance('rb2', 'c7', ['m18'], '2026-09-19T10:00:00.000Z'),
    ], SANS_FILTRE, MAINTENANT)
    expect(lignes.map((l) => [l.acheteur.id, l.echeance, l.due])).toEqual([
      ['c7', '2026-09-19T10:00:00.000Z', true],
      ['c9', '2026-09-22T10:00:00.000Z', false],
      ['c1', null, false],
    ])
  })

  it('une relance ne compte que pour ses biens et son acheteur', () => {
    const [l] = construireAttente([match('m14', julie, {})], [
      relance('r-autre', 'c9', ['m99'], '2026-09-20T10:00:00.000Z'),
      relance('r-emma', 'c7', ['m14'], '2026-09-20T10:00:00.000Z'),
    ], SANS_FILTRE, MAINTENANT)
    expect(l!.echeance).toBeNull()
  })

  it('les filtres s’appliquent aux biens ; un acheteur sans bien retenu n’a pas de ligne', () => {
    const lignes = construireAttente([
      match('m14', julie, {}, { bien: bien('p1', { titre: 'Champel' }) }),
      match('m18', emma, {}, { bien: bien('p2', { titre: 'Cologny' }) }),
    ], [], { ...SANS_FILTRE, texte: 'champel' }, MAINTENANT)
    expect(lignes.map((l) => l.acheteur.id)).toEqual(['c9'])
  })
})

describe('construireAConclure — les intéressés sans visite', () => {
  it('seulement `interested`, la réponse la plus ancienne d’abord, une réponse non datée en dernier', () => {
    const a = acheteur('c7')
    const r = construireAConclure([
      match('m6', a, { statut: 'interested', reponduLe: '2026-09-20T10:00:00.000Z' }),
      match('m17', a, { statut: 'interested', reponduLe: '2026-09-18T10:00:00.000Z' }),
      match('m20', a, { statut: 'visit_planned', reponduLe: '2026-09-10T10:00:00.000Z' }),
      match('m21', a, { statut: 'sent' }),
      match('m22', a, { statut: 'interested' }),
    ], SANS_FILTRE)
    expect(r.map((m) => m.id)).toEqual(['m17', 'm6', 'm22'])
  })
})

describe('signalPrix — « prix baissé de … » (§4.6)', () => {
  const antoine = acheteur('c10', 'Antoine')

  it('un bien refusé pour le prix et revenu : la baisse depuis le refus', () => {
    expect(signalPrix(match('m5', antoine, { statut: 'suggested', motif: 'prix', prixPropose: 3_450_000 }, { bien: bien('p2', { prix: 3_200_000 }) })))
      .toEqual({ baisse: 250_000, depuis: 'refus' })
  })

  it('un bien proposé sans réponse : la baisse depuis la proposition', () => {
    expect(signalPrix(match('m15', antoine, { prixPropose: 1_490_000 }, { bien: bien('b', { prix: 1_440_000 }) })))
      .toEqual({ baisse: 50_000, depuis: 'proposition' })
  })

  it('rien sans prix proposé, sans baisse, ni sur un intéressé', () => {
    expect(signalPrix(match('x', antoine, {}, { bien: bien('b', { prix: 1 }) }))).toBeNull()
    expect(signalPrix(match('y', antoine, { prixPropose: 1_000_000 }, { bien: bien('b', { prix: 1_000_000 }) }))).toBeNull()
    expect(signalPrix(match('z', antoine, { statut: 'interested', prixPropose: 2_000_000 }, { bien: bien('b', { prix: 1_000_000 }) }))).toBeNull()
  })
})

describe('ongletValide et cleAttente', () => {
  it('un onglet inconnu retombe sur « À proposer »', () => {
    expect(ongletValide('enAttente')).toBe('enAttente')
    expect(ongletValide('aTraiter')).toBe('aProposer')
    expect(ongletValide(null)).toBe('aProposer')
  })

  it('la clé d’une ligne d’attente ne se confond pas avec un id de match', () => {
    expect(cleAttente('c9')).toBe('attente:c9')
  })
})
```

Dans `tests/unit/matching-fil-modele.spec.ts`, dans `describe('optionsFiltres', …)`, juste APRÈS le test `'les acheteurs des lignes « Marché » en sont aussi, une fois chacun, dans le même tri'` (avant la fermeture `})` du `describe`), ajouter :

```ts

  it('les acheteurs de la boucle (lot B) en sont aussi, sans ajouter de bien', () => {
    const villa = bien('p1', { titre: 'Villa' })
    const zoe = acheteur('c1', { prenom: 'Zoé', nom: 'Aubert' })
    const lea = acheteur('c4', { prenom: 'Léa', nom: 'Martin' })
    const o = optionsFiltres([match('1', 90, villa, zoe)], [], [lea, zoe])
    expect(o.biens).toEqual([{ id: 'p1', libelle: 'Villa' }])
    expect(o.acheteurs).toEqual([{ id: 'c4', libelle: 'Léa Martin' }, { id: 'c1', libelle: 'Zoé Aubert' }])
  })
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-modele.spec.ts`
Expected : FAIL (`filBoucle` introuvable ; `optionsFiltres` n'accepte pas de troisième argument).

- [ ] **Step 3 : Étendre `filModele.ts`**

1. Juste APRÈS la fermeture de `export interface FilBien { … }`, ajouter :

```ts

/**
 * Où en est un match dans la boucle chez l'agent (lot B) : proposé, répondu, et ce qui a été consigné.
 * Absent d'un match jamais proposé.
 */
export interface SuiviMatch {
  statut: 'suggested' | 'sent' | 'interested' | 'rejected' | 'visit_planned'
  /** `sent_at` : la proposition (ou la dernière relance consignée). */
  proposeLe: string | null
  /** `response_at` : la PREMIÈRE réponse consignée (trigger `set_match_response_at`). */
  reponduLe: string | null
  /** Le motif d'un refus (`reaction_motif`), un code : `fil.motifs.*` l'écrit. */
  motif: string | null
  note: string | null
  /** Le prix du bien quand il a été proposé (`prix_propose`) : c'est lui qui dit « prix baissé de … ». */
  prixPropose: number | null
  /** `apprentissage_at` : ce refus a déjà nourri une correction de recherche, validée ou ignorée. */
  apprisLe: string | null
}
```

2. Dans `export interface FilMatch`, juste APRÈS la ligne `  reporteJusquau: string | null`, ajouter :

```ts
  /** La recherche notée (`client_search_id`) : c'est elle qu'« Apprendre » corrige (lot B). */
  rechercheId?: string | null
  /** La boucle (lot B) ; absent d'un match jamais proposé. */
  suivi?: SuiviMatch
```

3. Remplacer `const slug = (s: string): string =>` par `export const slug = (s: string): string =>`.

4. Remplacer `const temps = (iso: string | null): number => {` par `export const temps = (iso: string | null): number => {`.

5. Remplacer `function passeFiltres(m: FilMatch, f: FilFiltres): boolean {` par :

```ts
/** Un match retenu par les filtres du fil : le bien, l'acheteur, et le texte (bien, ville, adresse, acheteur). */
export function passeFiltres(m: FilMatch, f: FilFiltres): boolean {
```

6. Remplacer la ligne `const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])` par :

```ts
/** Les chaînes non vides d'un tableau jsonb — une zone ou un équipement mal saisi n'existe pas. */
export const chaines = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])
```

7. Remplacer INTÉGRALEMENT la fonction `optionsFiltres` et son docblock par :

```ts
/**
 * Les choix des filtres Bien et Acheteur : chacun une fois, triés par libellé. Les acheteurs des lignes
 * « Marché » (`selections`) en sont aussi : sans eux, un acheteur qui n'a que des biens du marché ne
 * pouvait pas être filtré ; de même ceux de la boucle (`autres`, lot B), qui n'ont peut-être plus rien à
 * proposer. Le filtre Bien ne vise que les biens en mandat : il écarte toutes les lignes « Marché »
 * (`construireSelections`).
 */
export function optionsFiltres(
  matchs: readonly FilMatch[], selections: readonly FilSelectionResume[] = [], autres: readonly FilMatch['acheteur'][] = [],
): { biens: OptionFiltre[]; acheteurs: OptionFiltre[] } {
  const biens = new Map<string, string>()
  const acheteurs = new Map<string, string>()
  for (const m of matchs) {
    biens.set(m.bien.id, m.bien.titre)
    acheteurs.set(m.acheteur.id, `${m.acheteur.prenom} ${m.acheteur.nom}`)
  }
  for (const s of selections) acheteurs.set(s.acheteur.id, `${s.acheteur.prenom} ${s.acheteur.nom}`)
  for (const a of autres) acheteurs.set(a.id, `${a.prenom} ${a.nom}`)
  const trier = (e: Map<string, string>): OptionFiltre[] =>
    [...e].map(([id, libelle]) => ({ id, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr') || a.id.localeCompare(b.id))
  return { biens: trier(biens), acheteurs: trier(acheteurs) }
}
```

- [ ] **Step 4 : Créer `filBoucle.ts`**

```ts
/**
 * La boucle chez l'agent (lot B) — modèle de vue PUR des onglets « En attente » et « À conclure », des motifs
 * de refus et du signal « prix baissé ». Ni React, ni Supabase, ni traduction.
 *
 * Conception : `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`, §4.3 à §4.6 et §5.
 *
 * ⚠ « En attente » a UNE ligne par ACHETEUR, pas par bien : la feuille « Retours de … » liste tout ce qui
 * attend sa réponse, propositions confondues. Son échéance est la plus proche des relances qui couvrent ces
 * biens (`reminders.match_ids`, ou `match_id` pour une relance d'avant le lot B).
 *
 * ⛔ LE SIGNAL DE PRIX SE CALCULE SUR `prix_propose` SEULEMENT, posé par la base au geste « Je l'ai
 * proposé » (trigger `set_match_prix_propose`). Sans lui, pas de signal : le premier prix de l'annonce ne dit
 * rien de ce que l'acheteur a vu.
 */
import { passeFiltres, temps, type FilFiltres, type FilMatch } from './filModele'

/** Les trois onglets du fil, un par temps de la boucle (§5). */
export const ONGLETS = ['aProposer', 'enAttente', 'aConclure'] as const
export type FilOnglet = (typeof ONGLETS)[number]

/**
 * Les motifs d'un refus (§4.4) — un geste, une puce —, dans l'ordre de l'écran et de leurs touches (1 à 8).
 * ⚠ Les codes du CHECK `matches_reaction_motif_check` (migration 20260921140000), qui y ajoute
 * `recherche_ajustee` : un match écarté par la réévaluation d'une recherche, pas par l'acheteur.
 */
export const MOTIFS_REFUS = ['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre'] as const
export type MotifRefus = (typeof MOTIFS_REFUS)[number]

/** Une relance de proposition en cours (`reminders`), et les biens qu'elle couvre. */
export interface RelanceProposition { id: string; contactId: string; matchIds: string[]; echeance: string | null }

/** Une ligne d'« En attente » : un acheteur, ses biens proposés sans réponse, et sa relance. */
export interface FilAttente {
  acheteur: FilMatch['acheteur']
  /** Du plus récemment proposé au plus ancien. */
  matchs: FilMatch[]
  /** La plus proche des relances qui couvrent ces biens, ou `null`. */
  echeance: string | null
  /** La relance est échue. */
  due: boolean
}

/** L'identifiant d'une ligne d'« En attente » dans l'ordre du fil — distinct de tout id de match. */
export const cleAttente = (contactId: string): string => `attente:${contactId}`

/** L'onglet rangé dans l'onglet du CRM peut venir d'un schéma antérieur : tout ce qui n'en est pas un retombe sur « À proposer ». */
export const ongletValide = (v: unknown): FilOnglet =>
  ((ONGLETS as readonly unknown[]).includes(v) ? v as FilOnglet : 'aProposer')

/**
 * « En attente » (§5) : les biens PROPOSÉS sans réponse, une ligne par acheteur ; les relances échues en
 * tête, puis la plus proche, puis les lignes sans relance.
 */
export function construireAttente(
  matchs: readonly FilMatch[], relances: readonly RelanceProposition[], filtres: FilFiltres, maintenant: number,
): FilAttente[] {
  const parAcheteur = new Map<string, FilMatch[]>()
  for (const m of matchs) {
    if (m.suivi?.statut !== 'sent' || !passeFiltres(m, filtres)) continue
    parAcheteur.set(m.acheteur.id, [...(parAcheteur.get(m.acheteur.id) ?? []), m])
  }
  const lignes: FilAttente[] = []
  for (const [contactId, ms] of parAcheteur) {
    const ids = new Set(ms.map((m) => m.id))
    const echeances = relances
      .filter((r) => r.contactId === contactId && r.echeance != null && r.matchIds.some((id) => ids.has(id)))
      .map((r) => r.echeance as string)
      .sort((a, b) => temps(a) - temps(b))
    const echeance = echeances[0] ?? null
    lignes.push({
      acheteur: ms[0]!.acheteur,
      matchs: [...ms].sort((a, b) =>
        temps(b.suivi?.proposeLe ?? null) - temps(a.suivi?.proposeLe ?? null) || b.score - a.score || a.id.localeCompare(b.id)),
      echeance,
      due: echeance != null && temps(echeance) <= maintenant,
    })
  }
  const nom = (l: FilAttente): string => `${l.acheteur.prenom} ${l.acheteur.nom}`
  return lignes.sort((a, b) =>
    (a.echeance == null ? 1 : 0) - (b.echeance == null ? 1 : 0)
    || temps(a.echeance) - temps(b.echeance)
    || temps(b.matchs[0]?.suivi?.proposeLe ?? null) - temps(a.matchs[0]?.suivi?.proposeLe ?? null)
    || nom(a).localeCompare(nom(b), 'fr'))
}

/**
 * « À conclure » (§5) : les biens qui INTÉRESSENT un acheteur et n'ont pas encore de visite, la réponse la plus
 * ancienne d'abord. Une réponse NON DATÉE (d'avant `set_match_response_at`, ou du banc, qui ne joue aucun
 * trigger) passe en dernier : datée à 0, elle passerait pour la plus ancienne.
 */
export function construireAConclure(matchs: readonly FilMatch[], filtres: FilFiltres): FilMatch[] {
  const quand = (m: FilMatch): number => temps(m.suivi?.reponduLe ?? null) || Number.POSITIVE_INFINITY
  return matchs
    .filter((m) => m.suivi?.statut === 'interested' && passeFiltres(m, filtres))
    .sort((a, b) => quand(a) - quand(b) || a.id.localeCompare(b.id))
}

/**
 * La baisse du prix d'un bien depuis qu'il a été proposé (§4.6) : depuis le REFUS pour un bien refusé pour le
 * prix et revenu à proposer (trigger `match_retour_prix_*`), depuis la PROPOSITION pour un bien sans réponse.
 * `null` sans baisse mesurée.
 */
export function signalPrix(m: FilMatch): { baisse: number; depuis: 'refus' | 'proposition' } | null {
  const s = m.suivi
  if (!s || s.prixPropose == null || m.bien.prix == null) return null
  const baisse = s.prixPropose - m.bien.prix
  if (baisse <= 0) return null
  if (s.statut === 'suggested' && s.motif === 'prix') return { baisse, depuis: 'refus' }
  if (s.statut === 'sent') return { baisse, depuis: 'proposition' }
  return null
}
```

- [ ] **Step 5 : Lancer, constater le succès**

Run : `npx vitest run tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-modele.spec.ts`
Expected : PASS (10 tests dans le premier fichier ; le second gagne 1 test, tous verts).

- [ ] **Step 6 : Point de commit (au signal)** — avec la Task 15 (exports sans lecteur avant).

---

### Task 6 : Le modèle « Apprendre »

**Files :**
- Create : `src/components/matching-fil/filApprendre.ts`
- Create : `tests/unit/matching-fil-apprendre.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Créer `tests/unit/matching-fil-apprendre.spec.ts` :

```ts
/**
 * « Apprendre » (lot B) — la correction de recherche proposée au DEUXIÈME refus pour un même motif, chiffrée
 * à partir des biens refusés (conception de la boucle, §4.6).
 *
 * ⚠ Là où le fil recopie une règle du moteur (familles de types, canton que nomme une ville), le test la
 * confronte au moteur lui-même : une règle à nous qui divergerait proposerait une correction sans effet.
 */
import { describe, expect, it } from 'vitest'
import { calculateScoreV2, normalizeZones } from '../../supabase/functions/_shared/matching-normalize'
import {
  construireCorrections, criteresCorriges, estNumerique, filtrerCorrections,
} from '@/components/matching-fil/filApprendre'
import type { FilBien, FilMatch, SuiviMatch } from '@/components/matching-fil/filModele'
import type { SearchCriteria } from '@/types/contact'

const JULIE: FilMatch['acheteur'] = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' }
const CRITERES: SearchCriteria = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_600_000,
  rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur'],
}
const bien = (id: string, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre: `Bien ${id}`, prix: 1_500_000, location: false, type: 'apartment', pieces: 4.5, surface: 110,
  ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, ...champs,
})
const suivi = (s: Partial<SuiviMatch>): SuiviMatch => ({
  statut: 'rejected', proposeLe: null, reponduLe: '2026-09-20T10:00:00.000Z', motif: 'prix', note: null,
  prixPropose: null, apprisLe: null, ...s,
})
const m = (id: string, s: Partial<SuiviMatch>, b: Partial<FilBien> = {}, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 90, raisons: null, criteres: CRITERES, creeLe: null, reporteJusquau: null, bien: bien(`b-${id}`, b),
  acheteur: JULIE, rechercheId: 'cs9', suivi: suivi(s), ...champs,
})
const accepte = (id: string, b: Partial<FilBien>) => m(id, { statut: 'interested', motif: null }, b)

describe('construireCorrections — au deuxième refus pour un même motif', () => {
  it('rien au premier refus ; au deuxième, le budget passe sous le prix refusé le plus bas', () => {
    const premier = m('m16', { prixPropose: 1_580_000 })
    expect(construireCorrections([premier])).toEqual([])
    const [c] = construireCorrections([premier, m('m14', { prixPropose: 1_560_000 })])
    expect(c).toMatchObject({
      cle: 'correction:cs9:prix', rechercheId: 'cs9', motif: 'prix',
      changement: { cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false },
    })
    expect(c!.refus.map((x) => x.id)).toEqual(['m16', 'm14'])
  })

  it('le prix refusé est celui PROPOSÉ, sinon le prix actuel ; un loyer se chiffre par 50 francs', () => {
    const loyer = { ...CRITERES, budget_min: 2_000, budget_max: 3_200 }
    const [c] = construireCorrections([
      m('a', {}, { prix: 3_010, location: true }, { criteres: loyer }),
      m('b', { prixPropose: 3_150 }, { prix: 2_990, location: true }, { criteres: loyer }),
    ])
    expect(c!.changement).toEqual({ cle: 'budget_max', avant: 3_200, apres: 3_000, location: true })
  })

  it('aucune correction qui n’abaisse rien, ni sous le budget minimum', () => {
    expect(construireCorrections([m('a', { prixPropose: 1_700_000 }), m('b', { prixPropose: 1_650_000 })])).toEqual([])
    expect(construireCorrections([m('a', { prixPropose: 1_295_000 }), m('b', { prixPropose: 1_299_000 })])).toEqual([])
  })

  it('un refus pris en compte ne compte plus ; deux recherches ne se mélangent pas', () => {
    expect(construireCorrections([m('a', { apprisLe: '2026-09-20T12:00:00.000Z' }), m('b', {})])).toEqual([])
    expect(construireCorrections([m('a', {}), m('b', {}, {}, { rechercheId: 'cs-autre' })])).toEqual([])
  })

  it('état et autre : jamais de correction', () => {
    expect(construireCorrections([m('a', { motif: 'etat' }), m('b', { motif: 'etat' })])).toEqual([])
    expect(construireCorrections([m('a', { motif: 'autre' }), m('b', { motif: 'autre' })])).toEqual([])
  })

  it('surface : le multiple de 5 m² au-dessus de la plus grande refusée ; pièces : une demi-pièce au-dessus', () => {
    const [s] = construireCorrections([m('a', { motif: 'surface' }, { surface: 104 }), m('b', { motif: 'surface' }, { surface: 112 })])
    expect(s!.changement).toEqual({ cle: 'surface_min', avant: 100, apres: 115 })
    const [p] = construireCorrections([m('a', { motif: 'pieces' }, { pieces: 4 }), m('b', { motif: 'pieces' }, { pieces: 4.5 })])
    expect(p!.changement).toEqual({ cle: 'rooms_min', avant: 4, apres: 5 })
  })

  it('quartier : la zone de ville sort ; le canton qu’elle nomme reste une zone', () => {
    const [c] = construireCorrections([m('a', { motif: 'quartier' }), m('b', { motif: 'quartier' })])
    expect(c!.changement).toEqual({ cle: 'zones', retirees: ['Genève'], apres: ['Champel', 'GE'] })
    const sansCode = { ...CRITERES, zones: ['Genève', 'Carouge'] }
    const [d] = construireCorrections([
      m('a', { motif: 'quartier' }, {}, { criteres: sansCode }), m('b', { motif: 'quartier' }, {}, { criteres: sansCode }),
    ])
    expect(d!.changement).toEqual({ cle: 'zones', retirees: ['Genève'], apres: ['Carouge', 'GE'] })
    // Le moteur lit « Genève » comme le canton GE : la retirer sans l'écrire élargirait la recherche au pays.
    expect(normalizeZones(['Genève']).cantons).toEqual(['GE'])
  })

  it('quartier : rien quand la ville refusée n’est retenue que par le canton, ni quand plus aucune zone ne resterait', () => {
    expect(construireCorrections([m('a', { motif: 'quartier' }, { ville: 'Onex' }), m('b', { motif: 'quartier' }, { ville: 'Onex' })])).toEqual([])
    const seule = { ...CRITERES, zones: ['Champel'] }
    expect(construireCorrections([
      m('a', { motif: 'quartier' }, { ville: 'Champel' }, { criteres: seule }), m('b', { motif: 'quartier' }, { ville: 'Champel' }, { criteres: seule }),
    ])).toEqual([])
  })

  it('type : celui, unique, des biens acceptés — une même famille du moteur ne se corrige pas', () => {
    const refus = [m('a', { motif: 'type' }, { type: 'house' }), m('b', { motif: 'type' }, { type: 'house' })]
    const [c] = construireCorrections([...refus, accepte('c', { type: 'villa' })])
    expect(c!.changement).toEqual({ cle: 'type', avant: 'apartment', apres: 'house' })
    expect(construireCorrections([...refus, accepte('c', { type: 'attique' })])).toEqual([])
    expect(calculateScoreV2({ type: 'attique' }, { type: 'apartment' }).reasons.type.match).toBe(true)
    expect(calculateScoreV2({ type: 'villa' }, { type: 'house' }).reasons.type.match).toBe(true)
    expect(construireCorrections([...refus, accepte('c', { type: 'house' }), accepte('d', { type: 'office' })])).toEqual([])
    expect(construireCorrections(refus)).toEqual([])
  })

  it('équipements : ce que TOUS les acceptés ont, qu’aucun refusé n’a, et qu’elle ne demande pas encore', () => {
    const [c] = construireCorrections([
      m('a', { motif: 'equipements' }, { equipements: ['Ascenseur'] }),
      m('b', { motif: 'equipements' }, { equipements: ['Balcon', 'Cave'] }),
      accepte('c', { equipements: ['Terrasse', 'Balcon', 'Cave'] }),
      m('d', { statut: 'visit_planned', motif: null }, { equipements: ['Terrasse', 'Cave', 'Parking'] }),
    ])
    expect(c!.changement).toEqual({ cle: 'features', ajoutes: ['terrasse'], apres: ['balcon', 'ascenseur', 'terrasse'] })
    expect(construireCorrections([m('a', { motif: 'equipements' }), m('b', { motif: 'equipements' })])).toEqual([])
  })

  it('les plus récentes d’abord', () => {
    const cs = construireCorrections([
      m('a', {}), m('b', {}),
      m('c', { motif: 'surface', reponduLe: '2026-09-21T10:00:00.000Z' }, { surface: 104 }), m('d', { motif: 'surface' }, { surface: 108 }),
    ])
    expect(cs.map((c) => c.motif)).toEqual(['surface', 'prix'])
  })
})

describe('criteresCorriges et estNumerique', () => {
  it('ne change que la clé corrigée', () => {
    expect(criteresCorriges(CRITERES, { cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false }))
      .toEqual({ ...CRITERES, budget_max: 1_550_000 })
    expect(criteresCorriges(CRITERES, { cle: 'zones', retirees: ['Genève'], apres: ['Champel', 'GE'] }))
      .toEqual({ ...CRITERES, zones: ['Champel', 'GE'] })
    expect(criteresCorriges(CRITERES, { cle: 'features', ajoutes: ['terrasse'], apres: ['balcon', 'ascenseur', 'terrasse'] }))
      .toEqual({ ...CRITERES, features: ['balcon', 'ascenseur', 'terrasse'] })
  })

  it('seuls le budget, la surface et les pièces se saisissent', () => {
    expect(estNumerique({ cle: 'surface_min', avant: null, apres: 115 })).toBe(true)
    expect(estNumerique({ cle: 'type', avant: null, apres: 'house' })).toBe(false)
  })
})

describe('filtrerCorrections', () => {
  it('un filtre sur un bien les écarte ; l’acheteur et le texte s’appliquent', () => {
    const cs = construireCorrections([m('a', {}), m('b', {})])
    expect(filtrerCorrections(cs, { bienId: 'p1', acheteurId: null, texte: '' })).toEqual([])
    expect(filtrerCorrections(cs, { bienId: null, acheteurId: 'c9', texte: '' })).toHaveLength(1)
    expect(filtrerCorrections(cs, { bienId: null, acheteurId: 'c7', texte: '' })).toEqual([])
    expect(filtrerCorrections(cs, { bienId: null, acheteurId: null, texte: 'morand' })).toHaveLength(1)
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-apprendre.spec.ts`
Expected : FAIL (`filApprendre` introuvable).

- [ ] **Step 3 : Créer `filApprendre.ts`**

```ts
/**
 * « Apprendre » (lot B, conception de la boucle §4.6) : au DEUXIÈME refus pour un même motif, une correction
 * CHIFFRÉE de la recherche de l'acheteur, à partir des biens refusés. Modèle PUR : ni React, ni Supabase, ni
 * traduction.
 *
 * ⚠ Les refus s'additionnent PAR RECHERCHE (`client_search_id`) : deux refus « prix » d'un même contact,
 * l'un sur un loyer, l'autre sur un achat, ne corrigent rien ensemble. Un refus pris en compte
 * (`apprentissage_at` : correction validée OU ignorée) ne compte plus — deux NOUVEAUX refus en proposeront une
 * autre.
 *
 * Les règles (§4.6), sur les seules clés que la fiche contact sait écrire — sans quoi le pont
 * `sync_contact_client_search` effacerait la correction au prochain enregistrement de la fiche :
 *   · prix — le budget maximum passe SOUS le prix refusé le plus bas (le prix PROPOSÉ), arrondi à 10 000
 *     francs (50 pour un loyer) ; jamais sous le budget minimum ;
 *   · surface — le minimum passe au multiple de 5 m² au-dessus de la plus grande surface refusée ;
 *   · pièces — une demi-pièce au-dessus du plus grand nombre refusé ;
 *   · quartier — la zone de VILLE qui a retenu les refusés sort ; un canton reste, et celui qu'une ville
 *     nomme (« Genève ») est gardé en code (« GE ») : le retirer élargirait la recherche au pays entier ;
 *   · type — le type, unique, des biens ACCEPTÉS (intéressé, visite) ;
 *   · équipements — ce que TOUS les acceptés ont et qu'AUCUN refusé n'a, ajouté aux équipements voulus.
 *     ⚠ Le moteur note les équipements en fraction (10 points sur 100) : un « obligatoire » strict attend un
 *     critère qu'il n'a pas (plan du lot B, « En attente ») ;
 *   · état, autre — rien : la note reste lisible.
 *
 * ⛔ DEUX RÈGLES DU MOTEUR SONT RECOPIÉES ICI — les familles de types et les cantons que nomme une ville —,
 * parce que `src/` ne charge pas le code Deno (CLAUDE.md §4). `matching-fil-apprendre.spec.ts` les confronte
 * au moteur.
 */
import type { SearchCriteria } from '@/types/contact'
import { isCantonCode } from '@/lib/contactCriteria'
import { chaines, passeFiltres, slug, temps, type FilFiltres, type FilMatch } from './filModele'
import type { MotifRefus } from './filBoucle'

type MotifCorrigeable = Extract<MotifRefus, 'prix' | 'quartier' | 'surface' | 'pieces' | 'type' | 'equipements'>
const CORRIGEABLES = new Set<string>(['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements'])

/** La correction proposée, sur UNE clé des critères. */
export type CorrectionChangement =
  | { cle: 'budget_max'; avant: number | null; apres: number; location: boolean }
  | { cle: 'surface_min'; avant: number | null; apres: number }
  | { cle: 'rooms_min'; avant: number | null; apres: number }
  | { cle: 'zones'; retirees: string[]; apres: string[] }
  | { cle: 'type'; avant: string | null; apres: string }
  | { cle: 'features'; ajoutes: string[]; apres: string[] }

/** Les corrections qui se saisissent : un nombre pré-rempli, que l'agent peut changer avant de valider. */
export type ChangementNumerique = Extract<CorrectionChangement, { cle: 'budget_max' | 'surface_min' | 'rooms_min' }>

/** Une correction de recherche proposée : une ligne de la section « Recherches à ajuster ». */
export interface Correction {
  /** `correction:<recherche>:<motif>`. */
  cle: string
  rechercheId: string
  acheteur: FilMatch['acheteur']
  motif: MotifCorrigeable
  /** Les refus qui la fondent. */
  refus: FilMatch[]
  /** Les critères ACTUELS de la recherche. */
  criteres: SearchCriteria
  changement: CorrectionChangement
}

const SEUIL_REFUS = 2
const PAS_VENTE = 10_000
const PAS_LOYER = 50
const PAS_SURFACE = 5

/** Les familles de types du moteur (`TYPE_FAMILY`, matching-normalize.ts). */
const FAMILLE_TYPE: Readonly<Record<string, string>> = {
  apartment: 'apartment', studio: 'apartment', attic: 'apartment', attique: 'apartment', duplex: 'apartment',
  loft: 'apartment', penthouse: 'apartment', house: 'house', villa: 'house', chalet: 'house', maison: 'house',
  commercial: 'commercial', office: 'commercial', bureau: 'commercial', parking: 'parking', garage: 'parking',
  land: 'land', terrain: 'land',
}

/** Les cantons que nomme une zone (`CANTON_BY_NAME`, matching-normalize.ts). */
const CANTON_PAR_NOM: Readonly<Record<string, string>> = {
  geneve: 'GE', geneva: 'GE', genf: 'GE', vaud: 'VD', waadt: 'VD', valais: 'VS', wallis: 'VS', neuchatel: 'NE',
  fribourg: 'FR', freiburg: 'FR', berne: 'BE', bern: 'BE', jura: 'JU', bale: 'BS', basel: 'BS', 'bale-ville': 'BS',
  'bale-campagne': 'BL', argovie: 'AG', aargau: 'AG', soleure: 'SO', solothurn: 'SO', zurich: 'ZH', zuerich: 'ZH',
  lucerne: 'LU', luzern: 'LU', zoug: 'ZG', zug: 'ZG', schwyz: 'SZ', nidwald: 'NW', obwald: 'OW', uri: 'UR',
  glaris: 'GL', glarus: 'GL', schaffhouse: 'SH', schaffhausen: 'SH', thurgovie: 'TG', thurgau: 'TG',
  'saint-gall': 'SG', 'st-gall': 'SG', grisons: 'GR', graubunden: 'GR', tessin: 'TI', ticino: 'TI',
}

const familleType = (type: string | null | undefined): string | null => {
  if (!type) return null
  const s = slug(type)
  return FAMILLE_TYPE[s] ?? s
}

/** La règle de zone du moteur (`scoreZone`) : égalité, ou inclusion entre slugs d'au moins 4 lettres. */
const zoneCouvre = (zone: string, ville: string): boolean =>
  zone === ville || (zone.length >= 4 && ville.length >= 4 && (zone.includes(ville) || ville.includes(zone)))

/** Le code du canton qu'une zone désigne (`GE`, ou « Genève »), ou `undefined`. */
const cantonDe = (zone: string): string | undefined =>
  (isCantonCode(zone) ? zone.trim().toUpperCase() : CANTON_PAR_NOM[slug(zone)])

/** Budget, surface ou pièces : une correction qui se saisit. */
export const estNumerique = (ch: CorrectionChangement): ch is ChangementNumerique =>
  ch.cle === 'budget_max' || ch.cle === 'surface_min' || ch.cle === 'rooms_min'

function correctionPrix(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const prix = refus.map((m) => m.suivi?.prixPropose ?? m.bien.prix).filter((p): p is number => p != null && p > 0)
  if (prix.length === 0) return null
  const location = refus.some((m) => m.bien.location)
  const pas = location ? PAS_LOYER : PAS_VENTE
  const apres = Math.floor((Math.min(...prix) - 1) / pas) * pas
  const avant = c.budget_max ?? null
  if (apres <= 0 || (avant != null && apres >= avant) || (c.budget_min != null && apres < c.budget_min)) return null
  return { cle: 'budget_max', avant, apres, location }
}

function correctionSurface(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const surfaces = refus.map((m) => m.bien.surface).filter((s): s is number => s != null && s > 0)
  if (surfaces.length === 0) return null
  const apres = (Math.floor(Math.max(...surfaces) / PAS_SURFACE) + 1) * PAS_SURFACE
  const avant = c.surface_min ?? null
  if ((avant != null && apres <= avant) || (c.surface_max != null && apres > c.surface_max)) return null
  return { cle: 'surface_min', avant, apres }
}

function correctionPieces(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const pieces = refus.map((m) => m.bien.pieces).filter((p): p is number => p != null && p > 0)
  if (pieces.length === 0) return null
  const apres = Math.max(...pieces) + 0.5
  const avant = c.rooms_min ?? null
  if ((avant != null && apres <= avant) || (c.rooms_max != null && apres > c.rooms_max)) return null
  return { cle: 'rooms_min', avant, apres }
}

function correctionZones(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const zones = chaines(c.zones)
  const villes = refus.map((m) => slug(m.bien.ville ?? '')).filter(Boolean)
  const retirees = zones.filter((z) => !isCantonCode(z) && villes.some((v) => zoneCouvre(slug(z), v)))
  if (retirees.length === 0) return null
  const restantes = zones.filter((z) => !retirees.includes(z))
  const cantonsRestants = new Set(restantes.map(cantonDe).filter((code): code is string => code != null))
  const gardes = [...new Set(retirees.map(cantonDe).filter((code): code is string => code != null && !cantonsRestants.has(code)))]
  const apres = [...restantes, ...gardes]
  return apres.length > 0 ? { cle: 'zones', retirees, apres } : null
}

function correctionType(c: SearchCriteria, acceptes: readonly FilMatch[]): CorrectionChangement | null {
  const familles = [...new Set(acceptes.map((m) => familleType(m.bien.type)).filter((f): f is string => f != null))]
  if (familles.length !== 1) return null
  const apres = familles[0]!
  const avant = c.type ?? null
  return familleType(avant) === apres ? null : { cle: 'type', avant, apres }
}

function correctionEquipements(c: SearchCriteria, refus: readonly FilMatch[], acceptes: readonly FilMatch[]): CorrectionChangement | null {
  if (acceptes.length === 0) return null
  const voulus = new Set(chaines(c.features).map(slug))
  const refuses = new Set(refus.flatMap((m) => m.bien.equipements.map(slug)))
  const [premier, ...autres] = acceptes.map((m) => new Set(m.bien.equipements.map(slug).filter(Boolean)))
  const ajoutes = [...premier!].filter((e) => autres.every((s) => s.has(e)) && !refuses.has(e) && !voulus.has(e))
  return ajoutes.length > 0 ? { cle: 'features', ajoutes, apres: [...chaines(c.features), ...ajoutes] } : null
}

function changementPour(
  motif: MotifCorrigeable, c: SearchCriteria, refus: readonly FilMatch[], acceptes: readonly FilMatch[],
): CorrectionChangement | null {
  switch (motif) {
    case 'prix': return correctionPrix(c, refus)
    case 'surface': return correctionSurface(c, refus)
    case 'pieces': return correctionPieces(c, refus)
    case 'quartier': return correctionZones(c, refus)
    case 'type': return correctionType(c, acceptes)
    case 'equipements': return correctionEquipements(c, refus, acceptes)
  }
}

/**
 * Les corrections de recherche à proposer : une par recherche et par motif qui a au moins deux refus non
 * encore pris en compte ET un changement chiffrable. Les plus récentes d'abord.
 */
export function construireCorrections(boucle: readonly FilMatch[]): Correction[] {
  const groupes = new Map<string, FilMatch[]>()
  for (const m of boucle) {
    const s = m.suivi
    if (!s || s.statut !== 'rejected' || s.apprisLe != null || !m.rechercheId || !m.criteres) continue
    if (!s.motif || !CORRIGEABLES.has(s.motif)) continue
    const cle = `${m.rechercheId}:${s.motif}`
    groupes.set(cle, [...(groupes.get(cle) ?? []), m])
  }
  const corrections: Correction[] = []
  for (const [cle, refus] of groupes) {
    const premier = refus[0]!
    if (refus.length < SEUIL_REFUS || !premier.rechercheId || !premier.criteres) continue
    const motif = premier.suivi!.motif as MotifCorrigeable
    const acceptes = boucle.filter((m) =>
      m.rechercheId === premier.rechercheId && (m.suivi?.statut === 'interested' || m.suivi?.statut === 'visit_planned'))
    const changement = changementPour(motif, premier.criteres, refus, acceptes)
    if (!changement) continue
    corrections.push({
      cle: `correction:${cle}`, rechercheId: premier.rechercheId, acheteur: premier.acheteur, motif, refus,
      criteres: premier.criteres, changement,
    })
  }
  const dernierRefus = (c: Correction): number => Math.max(...c.refus.map((m) => temps(m.suivi?.reponduLe ?? null)))
  return corrections.sort((a, b) => dernierRefus(b) - dernierRefus(a) || a.cle.localeCompare(b.cle))
}

/** Les corrections retenues par les filtres du fil : un filtre sur un BIEN les écarte (une correction vise une recherche). */
export function filtrerCorrections(corrections: readonly Correction[], filtres: FilFiltres): Correction[] {
  if (filtres.bienId) return []
  return corrections.filter((c) => c.refus.some((m) => passeFiltres(m, filtres)))
}

/** Les critères de la recherche, une fois la correction appliquée : seule sa clé change. */
export function criteresCorriges(c: SearchCriteria, ch: CorrectionChangement): SearchCriteria {
  switch (ch.cle) {
    case 'budget_max': return { ...c, budget_max: ch.apres }
    case 'surface_min': return { ...c, surface_min: ch.apres }
    case 'rooms_min': return { ...c, rooms_min: ch.apres }
    case 'zones': return { ...c, zones: ch.apres }
    case 'type': return { ...c, type: ch.apres }
    case 'features': return { ...c, features: ch.apres }
  }
}
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/unit/matching-fil-apprendre.spec.ts`
Expected : PASS, 14 tests.

- [ ] **Step 5 : Point de commit (au signal)** — avec la Task 15.

---

### Task 7 : Les gestes de la boucle (exécuteurs)

**Files :**
- Modify : `src/hooks/useAtelierMatching.ts`
- Modify : `tests/unit/matching-fil-gestes.spec.ts`

- [ ] **Step 1 : Écrire les tests**

Dans `tests/unit/matching-fil-gestes.spec.ts`, remplacer le bloc d'import :

```ts
import {
  execDismiss, execProposer, execProposerSelection, execReact, execRelance, execSnooze,
} from '@/hooks/useAtelierMatching'
```

par :

```ts
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execReact, execRelance, execRepondre, execSnooze,
} from '@/hooks/useAtelierMatching'
```

Puis ajouter à la FIN du fichier :

```ts

describe('la relance couvre TOUS les biens d’une proposition (lot B)', () => {
  it('une sélection : `match_ids` porte chaque bien marqué, `match_id` le meilleur', async () => {
    await execProposerSelection(CTX, { id: 'c-1', first: 'Julie', last: 'Morand' }, [
      { matchId: 'm-b', score: 91, bien: annonce('ml-2', 'MG-MK-2') },
      { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
    ])
    expect(ecrit('insert:reminders').valeurs).toMatchObject({ match_id: 'm-a', match_ids: ['m-b', 'm-a'] })
  })

  it('un bien : `match_ids` le porte seul', async () => {
    await execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('insert:reminders').valeurs).toMatchObject({ match_id: 'm-1', match_ids: ['m-1'] })
  })
})

describe('execRepondre — la réponse consignée par l’agent (lot B)', () => {
  it('Intéressé : depuis `sent` seulement, efface un motif d’avant, ne touche aucune relance', async () => {
    await expect(execRepondre(ACHETEUR, { genre: 'interested' })).resolves.toEqual({ deja: false })
    expect(seq()).toEqual(['update:matches'])
    const e = ecrit('update:matches')
    expect(e.valeurs).toEqual({ status: 'interested', reaction_motif: null, reaction_note: null, apprentissage_at: null })
    expect(e.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status in sent'])
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('Pas intéressé : le motif et la note sans espaces, depuis `sent` ou `interested`', async () => {
    await execRepondre(ACHETEUR, { genre: 'rejected', motif: 'prix', note: '  Trop cher  ' })
    const e = ecrit('update:matches')
    expect(e.valeurs).toEqual({ status: 'rejected', reaction_motif: 'prix', reaction_note: 'Trop cher', apprentissage_at: null })
    expect(e.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status in sent,interested'])
  })

  it('une note vide ne s’écrit pas ; rien de réécrit : `deja`', async () => {
    h.retours['update:matches'] = []
    await expect(execRepondre(ACHETEUR, { genre: 'rejected', motif: 'autre', note: '   ' })).resolves.toEqual({ deja: true })
    expect(ecrit('update:matches').valeurs).toMatchObject({ reaction_note: null })
  })

  it('un refus de la base fait lever', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execRepondre(ACHETEUR, { genre: 'interested' })).rejects.toMatchObject({ code: '42501' })
  })
})

describe('execPasEncore — la relance de la proposition repoussée de 3 jours', () => {
  it('reprend la relance qui COUVRE ce bien, même portée par un autre ; rien sur le match', async () => {
    h.lectures.reminders = [
      { id: 'r-autre', match_id: 'm-9', match_ids: ['m-9'] },
      { id: 'r-sel', match_id: 'm-best', match_ids: ['m-best', 'm-1'] },
    ]
    await execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(lectures().find((l) => l.table === 'reminders')!.filtres).toEqual([
      'contact_id=c-1', 'type=follow_up_sent_property', 'status in pending,triggered', 'order created_at desc',
    ])
    const report = ecrit('update:reminders')
    expect(report.filtres).toEqual(['id=r-sel'])
    expect(report.valeurs).toMatchObject({ status: 'pending' })
    expect(dansJours((report.valeurs as { trigger_at: string }).trigger_at)).toBe(3)
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({ action: 'match_pas_encore', metadata: { match_id: 'm-1', relance_id: 'r-sel' } })
    expect(ecritures().some((e) => e.table === 'matches')).toBe(false)
  })

  it('une relance d’avant le lot B (sans `match_ids`) se reconnaît à son `match_id`', async () => {
    h.lectures.reminders = [{ id: 'r-vieille', match_id: 'm-1', match_ids: null }]
    await execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('update:reminders').filtres).toEqual(['id=r-vieille'])
  })

  it('aucune relance en cours : en pose une à +3 j pour ce bien', async () => {
    await execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('insert:reminders').valeurs).toMatchObject({ match_id: 'm-1', match_ids: ['m-1'], channel: 'task', trigger_days: 3 })
  })
})

describe('execPlanifierVisite — la visite créée en interne, aucune invitation (lot B)', () => {
  const VISITE = { debut: '2026-09-24T12:00:00.000Z', dureeMinutes: 45, lieu: 'Avenue de Champel 12, Genève' }
  const MANDAT = {
    kind: 'property' as const, id: 'p1', key: 'p:p1', ref: 'MG-IN-P1', title: 'Champel', price: 1_450_000, addr: 'Genève',
    rooms: 4.5, area: 118, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
  }

  it('un bien en mandat : match → visit_planned, visite `planned` rattachée au deal, deal avancé, journal', async () => {
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: false })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:visits', 'insert:activity_events', 'update:transactions'])
    expect(ecritures()[0]!.valeurs).toEqual({ status: 'visit_planned' })
    expect(ecritures()[0]!.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status=interested'])
    expect(ecrit('insert:visits').valeurs).toMatchObject({
      agency_id: 'ag-1', agent_id: 'u-1', property_id: 'p1', contact_id: 'c-1', transaction_id: 'deal-neuf',
      scheduled_at: VISITE.debut, duration_minutes: 45, status: 'planned', visit_type: 'sur_place', buyer_name: 'Julie Morand',
      reminder_sent: true,
    })
    expect(ecrit('update:transactions').valeurs).toEqual({ stage: 'visit_planned' })
    expect(ecrit('update:transactions').filtres).toEqual(['id=deal-neuf', 'stage in new_lead,to_qualify,active_search,to_recontact'])
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({
      action: 'visit_scheduled', category: 'contact', metadata: { match_id: 'm-1', deal_id: 'deal-neuf', scheduled_at: VISITE.debut },
    })
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('une annonce du marché : un événement « visite » de l’agenda, jamais une ligne `visits`', async () => {
    await execPlanifierVisite(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), VISITE)
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:calendar_events', 'update:transactions'])
    expect(ecrit('insert:calendar_events').valeurs).toMatchObject({
      agency_id: 'ag-1', type: 'visite', title: 'Visite · Annonce ml-1', starts_at: VISITE.debut,
      ends_at: '2026-09-24T12:45:00.000Z', contact_id: 'c-1', location: VISITE.lieu,
    })
  })

  it('un match qui n’est plus « intéressé » : rien d’autre, `deja`', async () => {
    h.retours['update:matches'] = []
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: true })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })

  it('une visite refusée : le match redevient « intéressé », et le geste lève', async () => {
    h.erreurs['insert:visits'] = { message: 'refus', code: '42501' }
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).rejects.toMatchObject({ code: '42501' })
    const retour = ecritures().filter((e) => e.table === 'matches')[1]!
    expect(retour.valeurs).toEqual({ status: 'interested' })
    expect(retour.filtres).toEqual(['id=m-1', 'status=visit_planned'])
  })
})

describe('Apprendre — les deux gestes d’une correction (lot B)', () => {
  const C = { contactId: 'c-1', rechercheId: 'cs-1', motif: 'prix', refusIds: ['r-1', 'r-2'] }

  it('Ignorer : les refus sont pris en compte, et le journal le dit', async () => {
    await execIgnorerCorrection(CTX, C)
    const e = ecrit('update:matches')
    expect(typeof (e.valeurs as { apprentissage_at: unknown }).apprentissage_at).toBe('string')
    expect(e.filtres).toEqual(['id in r-1,r-2', 'client_search_id=cs-1', 'status=rejected'])
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({
      action: 'correction_ignoree', entity_id: 'c-1', metadata: { client_search_id: 'cs-1', motif: 'prix', match_ids: ['r-1', 'r-2'] },
    })
  })

  it('Ajuster : UN appel au moteur (mode rescore-search), aucune écriture du client', async () => {
    h.invoke = vi.fn(() => Promise.resolve({ data: { reevalues: 5, ecartes: 1 }, error: null }))
    const criteres = { budget_max: 1_550_000 }
    await expect(execAjusterRecherche(C, criteres)).resolves.toEqual({ reevalues: 5, ecartes: 1 })
    expect(h.invoke).toHaveBeenCalledWith('matching-engine', {
      body: { mode: 'rescore-search', client_search_id: 'cs-1', criteria: criteres, motif: 'prix', refus_ids: ['r-1', 'r-2'] },
    })
    expect(h.appels).toEqual([])
  })

  it('Ajuster en échec fait lever : la correction reste à l’écran', async () => {
    h.invoke = vi.fn(() => Promise.resolve({ data: null, error: { message: 'internal_error' } }))
    await expect(execAjusterRecherche(C, {})).rejects.toMatchObject({ message: 'internal_error' })
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts`
Expected : FAIL (`execRepondre`, `execPasEncore`, `execPlanifierVisite`, `execIgnorerCorrection`, `execAjusterRecherche` n'existent pas ; `match_ids` absent des relances).

- [ ] **Step 3 : Implémenter dans `useAtelierMatching.ts`**

1. Dans l'en-tête, juste APRÈS la ligne `//   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue)`, ajouter :

```ts
//   repondre     → (fil, lot B) Intéressé / Pas intéressé + motif : matches.status, motif, note ; la
//                  relance de la PROPOSITION se clôt par trigger quand plus aucun de ses biens n'attend
//   pasEncore    → (fil) la relance de la proposition repoussée de +3 j ; rien sur le match
//   planifierVisite → (fil) match 'visit_planned' + visite interne (mandat) ou événement « visite » de
//                  l'agenda (annonce du marché) + deal avancé ; aucune invitation
//   ajusterRecherche / ignorerCorrection → (fil) « Apprendre » : la correction validée (edge
//                  matching-engine, mode rescore-search) ou ses refus pris en compte
```

2. Remplacer `import type { Json, TablesInsert } from '@/types/database'` par :

```ts
import type { Enums, Json, TablesInsert } from '@/types/database'
```

et juste APRÈS la ligne `import type { KycCase } from '@/types/kyc'`, ajouter :

```ts
import type { MotifRefus } from '@/components/matching-fil/filBoucle'
```

3. Dans `execProposer`, remplacer :

```ts
  await poserRelance(ctx, {
    contactId: buyer.id,
    matchId: buyer.matchId,
    dealId,
    propertyId: listing.kind === 'property' ? listing.id : null,
    message: `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}`,
  })
```

par :

```ts
  await poserRelance(ctx, {
    contactId: buyer.id,
    matchId: buyer.matchId,
    matchIds: [buyer.matchId],
    dealId,
    propertyId: listing.kind === 'property' ? listing.id : null,
    message: `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}`,
  })
```

4. Dans `execProposerSelection`, remplacer :

```ts
  await poserRelance(ctx, {
    contactId: acheteur.id,
    matchId: meilleur.matchId,
    dealId,
```

par :

```ts
  await poserRelance(ctx, {
    contactId: acheteur.id,
    matchId: meilleur.matchId,
    // TOUS les biens marqués : le trigger `fermer_relance_proposition` clôt la relance au dernier répondu.
    matchIds: proposees.map((p) => p.matchId),
    dealId,
```

5. Dans `execRelance`, remplacer :

```ts
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      dealId: null,
```

par :

```ts
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      matchIds: [buyer.matchId],
      dealId: null,
```

6. Dans la docstring de `execReact`, remplacer sa dernière ligne ` *  Un refus est signalé sans faire lever : la réponse, elle, est consignée. */` par :

```ts
 *  Un refus est signalé sans faire lever : la réponse, elle, est consignée.
 *  ⚠ Atelier et mobile seulement (inchangés au lot B) : le fil consigne par `execRepondre`, sans clore par
 *  `match_id` — une sélection n'a qu'une relance, que le trigger clôt au dernier bien répondu. */
```

7. Juste AVANT la ligne `// ─── privé ──────────────────────────────────────────────────────────────`, ajouter :

```ts
// ═══════════════════ La boucle dans le fil (lot B) ════════════════════════
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.4 à §4.6.

/** La réponse de l'acheteur, consignée par l'agent depuis le fil. */
export type ReponseAcheteur =
  | { genre: 'interested' }
  | { genre: 'rejected'; motif: MotifRefus; note: string | null }

/**
 * « Intéressé » / « Pas intéressé » (+ motif) — la réponse de l'acheteur à un bien proposé, consignée par
 * l'agent (§4.4).
 *
 * Les triggers font le reste, quel que soit l'écrivain : `set_match_response_at` date la réponse,
 * `log_match_reaction` l'inscrit au journal, motif compris, et `fermer_relance_proposition` clôt la relance de
 * la proposition quand plus AUCUN de ses biens n'attend. ⛔ Pas de clôture par `match_id` ici, contrairement à
 * `execReact` : une sélection de trois biens n'a qu'UNE relance, portée par son meilleur bien — la clore sur la
 * réponse à ce seul bien laissait les deux autres sans suivi.
 *
 * Seulement depuis l'étape d'avant : « Intéressé » répond à un bien PROPOSÉ ; « Pas intéressé » aussi, ou
 * revient sur un intérêt (« À conclure »). Rien de réécrit : `deja` (un collègue a répondu entre-temps).
 */
export async function execRepondre(
  buyer: Pick<AcheteurGeste, 'id' | 'matchId'>,
  reponse: ReponseAcheteur,
): Promise<{ deja: boolean }> {
  const ecriture = reponse.genre === 'interested'
    ? { status: 'interested', reaction_motif: null, reaction_note: null, apprentissage_at: null }
    : { status: 'rejected', reaction_motif: reponse.motif, reaction_note: reponse.note?.trim() || null, apprentissage_at: null }
  const { data, error } = await supabase
    .from('matches')
    .update(ecriture)
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .in('status', reponse.genre === 'interested' ? ['sent'] : ['sent', 'interested'])
    .select('id')
  if (error) throw error
  return { deja: !data || data.length === 0 }
}

/**
 * « Pas encore » — l'acheteur n'a pas décidé : rien sur le match, la relance de SA proposition est repoussée
 * de trois jours (§4.4). La relance est celle qui COUVRE le bien (`match_ids`, ou `match_id` pour une relance
 * d'avant le lot B) : dans une sélection, elle est portée par un autre bien. Aucune : une relance est posée.
 */
export async function execPasEncore(ctx: GesteContext, buyer: AcheteurGeste, listing: BienGeste): Promise<void> {
  const { data: enCours, error: lErr } = await supabase
    .from('reminders')
    .select('id, match_id, match_ids')
    .eq('contact_id', buyer.id)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
    .order('created_at', { ascending: false })
  if (lErr) throw lErr
  const relance = ((enCours ?? []) as { id: string; match_id: string | null; match_ids: string[] | null }[])
    .find((r) => (r.match_ids ?? (r.match_id ? [r.match_id] : [])).includes(buyer.matchId))
  if (relance) {
    const { error } = await supabase
      .from('reminders')
      .update({ trigger_at: inDays(DELAI_RELANCE_JOURS), status: 'pending' })
      .eq('id', relance.id)
    if (error) throw error
  } else {
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      matchIds: [buyer.matchId],
      dealId: null,
      propertyId: listing.kind === 'property' ? listing.id : null,
      message: `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}`,
    })
  }
  await logEvent(ctx, {
    action: 'match_pas_encore',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, relance_id: relance?.id ?? null },
  })
}

/** Le créneau d'une visite planifiée depuis le fil. */
export interface VisiteAPlanifier {
  /** Début, ISO. */
  debut: string
  dureeMinutes: number
  /** Adresse du bien, pour l'agenda. */
  lieu: string | null
}

/** Les étapes d'un deal AVANT la visite : « Planifier une visite » l'y fait avancer, jamais reculer. */
const ETAPES_AVANT_VISITE: Enums<'transaction_stage'>[] = ['new_lead', 'to_qualify', 'active_search', 'to_recontact']

/**
 * « Planifier une visite » (§4.5) — depuis « À conclure », EN INTERNE : rien n'est envoyé à l'acheteur, ni
 * invitation ni lien (comme l'outil `schedule_visit` du copilote).
 *
 * Le match passe `visit_planned` D'ABORD, et seulement s'il est encore « intéressé » : un double geste ne pose
 * pas deux visites. Puis le deal (l'actif, sinon un `new_lead`, `rattacherDeal`), puis la visite : un bien EN
 * MANDAT reçoit une ligne `visits` (sa fiche, son bon) ; une annonce du MARCHÉ, que l'agence ne détient pas
 * (`visits.property_id` n'accepte qu'un mandat), un événement `visite` de l'agenda (`calendar_events`, qui se
 * journalise lui-même). Le deal avance à `visit_planned` s'il était avant. Une visite refusée rend au match son
 * « intéressé » : il reste dans « À conclure ».
 *
 * ⛔ Aucun rappel au client non plus : `visit-reminders-j1` écrit à l'acheteur la veille de toute visite `planned`
 * dont `reminder_sent` est faux (`send-visit-email`). Posé à la création, il ne part pas — le matching reste chez
 * l'agent, et aucun envoi au client ne part sans sa validation (CLAUDE.md §5).
 */
export async function execPlanifierVisite(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
  visite: VisiteAPlanifier,
): Promise<{ deja: boolean }> {
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'visit_planned' })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'interested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { deja: true }

  try {
    const dealId = await rattacherDeal(ctx, buyer.id, listing)
    if (listing.kind === 'property') {
      const { data: v, error: vErr } = await supabase
        .from('visits')
        .insert({
          agency_id: ctx.agencyId,
          agent_id: ctx.userId,
          property_id: listing.id,
          contact_id: buyer.id,
          transaction_id: dealId,
          scheduled_at: visite.debut,
          duration_minutes: visite.dureeMinutes,
          status: 'planned',
          visit_type: 'sur_place',
          buyer_name: `${buyer.first} ${buyer.last}`.trim() || null,
          // Le rappel J-1 ne part pas : voir la docstring.
          reminder_sent: true,
        })
        .select('id')
        .single()
      if (vErr) throw vErr
      await logEvent(ctx, {
        action: 'visit_scheduled',
        contactId: buyer.id,
        label: `${buyer.first} ${buyer.last} · ${listing.title}`,
        categorie: 'contact',
        metadata: { match_id: buyer.matchId, visit_id: (v as { id: string }).id, deal_id: dealId, bien_ref: listing.ref, scheduled_at: visite.debut },
      })
    } else {
      const fin = new Date(Date.parse(visite.debut) + visite.dureeMinutes * 60_000).toISOString()
      const { error: eErr } = await supabase.from('calendar_events').insert({
        agency_id: ctx.agencyId,
        type: 'visite',
        title: `Visite · ${listing.title}`.slice(0, 200),
        starts_at: visite.debut,
        ends_at: fin,
        contact_id: buyer.id,
        location: visite.lieu,
      })
      if (eErr) throw eErr
    }
    const { error: dErr } = await supabase
      .from('transactions')
      .update({ stage: 'visit_planned' })
      .eq('id', dealId)
      .in('stage', ETAPES_AVANT_VISITE)
    if (dErr) console.error('[atelier] deal stage advance failed', dErr)
  } catch (err) {
    await supabase.from('matches').update({ status: 'interested' }).eq('id', buyer.matchId).eq('status', 'visit_planned')
    throw err
  }
  return { deja: false }
}

/** Une correction de recherche proposée par « Apprendre », telle que ses deux gestes la lisent. */
export interface CorrectionGeste {
  contactId: string
  rechercheId: string
  motif: string
  refusIds: readonly string[]
}

/**
 * « Ajuster la recherche » (§4.6) — la correction validée par l'agent.
 *
 * TOUT se fait côté serveur, en UN appel (`matching-engine`, mode `rescore-search`) : les matchs à proposer
 * sont renotés par le VRAI barème avec les critères corrigés, puis les critères sont posés (et sur la fiche si
 * elle portait les mêmes), puis les refus pris en compte, puis UNE ligne `recherche_ajustee` au journal. ⛔
 * Critères écrits d'abord par le client, un échec de la renotation effaçait la correction de l'écran (plus
 * d'écart à proposer) sans rien avoir renoté ; ici, un échec la laisse, et la même validation se rejoue.
 */
export async function execAjusterRecherche(
  c: CorrectionGeste,
  criteres: SearchCriteria,
): Promise<{ reevalues: number; ecartes: number }> {
  const { data, error } = await supabase.functions.invoke('matching-engine', {
    body: { mode: 'rescore-search', client_search_id: c.rechercheId, criteria: criteres, motif: c.motif, refus_ids: [...c.refusIds] },
  })
  if (error) throw error
  const r = (data ?? {}) as { reevalues?: unknown; ecartes?: unknown }
  return {
    reevalues: typeof r.reevalues === 'number' ? r.reevalues : 0,
    ecartes: typeof r.ecartes === 'number' ? r.ecartes : 0,
  }
}

/**
 * « Ignorer » une correction : ses refus sont pris en compte sans rien corriger. Deux NOUVEAUX refus pour ce
 * motif en proposeront une autre.
 */
export async function execIgnorerCorrection(ctx: GesteContext, c: CorrectionGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ apprentissage_at: new Date().toISOString() })
    .in('id', [...c.refusIds])
    .eq('client_search_id', c.rechercheId)
    .eq('status', 'rejected')
  if (error) throw error
  await logEvent(ctx, {
    action: 'correction_ignoree',
    contactId: c.contactId,
    label: c.motif,
    metadata: { client_search_id: c.rechercheId, motif: c.motif, match_ids: [...c.refusIds] },
  })
}

```

8. Remplacer INTÉGRALEMENT la fonction `poserRelance` et son docblock par :

```ts
/**
 * La relance interne d'une proposition : une tâche de l'agent (canal `task`), jamais un message à
 * l'acheteur. Elle remplace la relance J+3 automatique d'`automation-engine`, retirée au lot A : elle
 * doublait celle-ci et pouvait écrire au client. Partagée par les gestes pour qu'ils ne divergent pas.
 *
 * `match_ids` porte TOUS les biens qu'elle couvre (une sélection n'a qu'une relance) : le trigger
 * `fermer_relance_proposition` la clôt quand plus aucun n'attend. `match_id`, le meilleur, reste pour les
 * lecteurs d'avant le lot B.
 *
 * Un refus est signalé sans faire lever : le match est déjà proposé et le journal écrit, le geste ne
 * doit pas passer pour échoué — mais il ne doit pas passer inaperçu non plus (même règle que `logEvent`).
 */
async function poserRelance(
  ctx: GesteContext,
  r: { contactId: string; matchId: string; matchIds: readonly string[]; dealId: string | null; propertyId: string | null; message: string },
): Promise<void> {
  const { error } = await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: r.contactId,
    property_id: r.propertyId,
    transaction_id: r.dealId,
    match_id: r.matchId,
    match_ids: [...r.matchIds],
    type: 'follow_up_sent_property',
    trigger_rule: 'manual',
    trigger_days: DELAI_RELANCE_JOURS,
    trigger_at: inDays(DELAI_RELANCE_JOURS),
    status: 'pending',
    channel: 'task',
    message_template: r.message,
  })
  if (error) console.error('[atelier] reminder insert failed', error)
}
```

9. Remplacer INTÉGRALEMENT la fonction `logEvent` par :

```ts
async function logEvent(
  ctx: GesteContext,
  e: { action: string; contactId: string; label: string; metadata: Record<string, unknown>; categorie?: 'deal' | 'contact' },
): Promise<void> {
  const { error } = await supabase.from('activity_events').insert({
    agency_id: ctx.agencyId,
    actor_id: ctx.userId,
    actor_kind: 'user',
    action: e.action,
    entity_type: 'contact',
    entity_id: e.contactId,
    // `visit_scheduled` est de la famille `contact`, comme l'écrit le copilote (whatsapp-actions) ; les
    // autres gestes du matching font avancer le deal.
    category: e.categorie ?? 'deal',
    severity: 'info',
    object_label: e.label,
    metadata: e.metadata as Json,
  })
  // Consignation = exigence du contrat ; une erreur RLS ne doit pas passer inaperçue
  if (error) console.error('[atelier] activity_events insert failed', error)
}
```

- [ ] **Step 4 : Lancer, constater le succès**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts`
Expected : PASS, 41 tests (25 d'avant, 16 nouveaux).

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useAtelierMatching" ; echo fin`
Expected : `fin`.

- [ ] **Step 5 : Point de commit (au signal)** — avec la Task 15 : `useAtelierMatching.ts` importe le type `MotifRefus` de `filBoucle.ts` (Task 5), qui n'est commité qu'avec l'écran ; un commit de ce seul fichier ne compilerait pas.

---

### Task 8 : Les données — la boucle et les relances

**Files :**
- Modify : `src/hooks/useMatchingFil.ts`
- Modify : `src/hooks/useSelectionMarche.ts`

- [ ] **Step 1 : Remplacer `useMatchingFil.ts`**

Relire le fichier avant de le remplacer (le lot A a pu y retoucher des commentaires) ; tout paragraphe d'en-tête absent du bloc ci-dessous se reporte, et se signale. Remplacer INTÉGRALEMENT `src/hooks/useMatchingFil.ts` par :

```ts
/**
 * Données du fil de matchs : « À proposer » sur les biens de l'agence (lot 1), une ligne « Marché » par
 * acheteur, résumée côté serveur par `matching_fil_marche()` (lot 2), et la BOUCLE (lot B) — les matchs
 * proposés, répondus ou en visite, et les relances de proposition en cours.
 *
 * Conceptions : `docs/superpowers/specs/2026-09-17-matching-fil-design.md` §8 ;
 * `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md` §4 et §5.
 *
 * ⛔ DES LECTURES PLATES, AUCUNE JOINTURE EMBARQUÉE. L'atelier charge tous les matchs de l'agence
 * avec `properties(*)` et `market_listings(*)` — descriptions et galeries comprises, 1 628 lignes
 * en production le 17.09.2026 — contre le §7 de CLAUDE.md. Ici : les matchs `suggested` des biens
 * en mandat (10 en production), puis leurs contacts, leurs recherches, leurs biens (colonnes légères)
 * et le KYC, par `in`. Et le banc `/dev/crm` n'applique pas `select` : une jointure y rendrait des
 * lignes sans acheteur ni bien, et l'écran mentirait sur ce que la production affiche.
 *
 * ⛔ LES CRITÈRES VIENNENT DE LA RECHERCHE DU MATCH (`client_searches.criteria`, par
 * `matches.client_search_id`) — ce que le moteur a noté. `contacts.search_criteria` n'est qu'un
 * repli : mesuré le 17.09.2026, il est vide pour 3 acheteurs sur 4.
 *
 * ⚠ UNE RECHERCHE MODIFIÉE GARDE LES RAISONS DE L'ANCIENNE : `insert_internal_matches` ne re-note pas
 * une paire existante (`ON CONFLICT DO NOTHING`). Seule une correction d'« Apprendre » (lot B) renote les
 * matchs à proposer de SA recherche (`matching-engine`, mode `rescore-search`). Aucun signal fiable ne
 * permet d'écarter les autres ici — `client_searches.updated_at` bouge à CHAQUE enregistrement du contact
 * (trigger de synchro), et s'y fier effacerait les verdicts d'un acheteur dont on a corrigé la nationalité.
 *
 * ⚠ LA BOUCLE SE LIT EN ENTIER, sans pagination : ses statuts (`sent`, `interested`, `rejected`,
 * `visit_planned`) ne naissent que d'un geste de l'agent — aucun en production le 21.09.2026 —, servis par
 * `idx_matches_boucle`. Au-delà de 1 000 lignes, `max_rows` tronquerait en silence : à surveiller avant la
 * bascule (conception du fil, §13).
 *
 * ⚠ Le filtre « bien en mandat » est posé DEUX fois : `not(property_id, is, null)` pour la base, et
 * côté client pour le banc, qui ne connaît pas l'opérateur `not`.
 *
 * ⚠ `chargeLe` est l'heure du DÉBUT des lectures, pas de leur fin : le fil la compare à l'heure où un
 * geste a fini d'écrire pour savoir si ces données le reflètent déjà. Prise à la fin, une lecture
 * partie avant l'écriture passerait pour postérieure.
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import { refAnnonceMarche, refBienInterne, type AcheteurGeste, type BienGeste } from '@/hooks/useAtelierMatching'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import {
  compterHistorique, type FilBien, type FilMatch, type FilSelectionResume, type Historique, type RaisonsMoteur,
  type SuiviMatch,
} from '@/components/matching-fil/filModele'
import type { RelanceProposition } from '@/components/matching-fil/filBoucle'

/** Ce qu'une ligne `matches` porte de son suivi (lot B). */
interface ColonnesSuivi {
  sent_at: string | null; response_at: string | null; reaction_motif: string | null; reaction_note: string | null
  prix_propose: number | string | null
}
interface LigneMatch extends ColonnesSuivi {
  id: string; contact_id: string; property_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
}
/** Un match de la boucle : proposé, répondu ou en visite (lot B). */
interface LigneBoucle extends ColonnesSuivi {
  id: string; contact_id: string; property_id: string | null; market_listing_id: string | null
  client_search_id: string | null; score: number; reasons: RaisonsMoteur | null; status: string
  created_at: string | null; apprentissage_at: string | null
}
export interface LigneContact {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null
  search_criteria: SearchCriteria | null
}
interface LigneBien {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; rooms: number | string | null; surface_m2: number | string | null
  address: string | null; city: string | null; canton: string | null; features: unknown; photos: string[] | null
}
/** Une annonce du marché, colonnes légères (§7 de CLAUDE.md) : la sélection (lot 2) et la boucle (lot B) la lisent pareil. */
export interface LigneAnnonce {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; current_price: number | string | null; rooms: number | string | null
  surface_m2: number | string | null; address: string | null; city: string | null; canton: string | null
  features: unknown; photos: string[] | null; photos_cf: unknown; status: string | null
  source_portal: string | null; source_id: string | null; source_url: string | null
}
interface LigneRelance {
  id: string; contact_id: string | null; match_id: string | null; match_ids: string[] | null; trigger_at: string | null
}
interface DonneesFil {
  matchs: FilMatch[]
  selections: FilSelectionResume[]
  /** La boucle (lot B) : proposés, répondus, en visite. */
  boucle: FilMatch[]
  /** Les relances de proposition en cours. */
  relances: RelanceProposition[]
  historique: Map<string, Historique>
  chargeLe: number
}

/** Préfixe des clés de requête du fil : l'invalider rafraîchit aussi les sélections ouvertes. */
export const CLE_FIL = 'matching-fil'
/** Les colonnes d'une annonce du marché que le fil lit. */
export const COLONNES_ANNONCE = 'id, title, type, transaction_type, price, current_price, rooms, surface_m2, address, city, canton, features, photos, photos_cf, status, source_portal, source_id, source_url'
/** Les statuts de la boucle — ceux que compte aussi « Déjà proposé » (`compterHistorique`), et l'index `idx_matches_boucle`. */
const STATUTS_BOUCLE = ['sent', 'interested', 'rejected', 'visit_planned']
const VIDE: DonneesFil = { matchs: [], selections: [], boucle: [], relances: [], historique: new Map(), chargeLe: 0 }
const nonNul = (id: string | null): id is string => id != null

export async function lire<T>(requete: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await requete
  if (error) throw error
  return (data ?? []) as T[]
}

const nombreOuNull = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

function listeEquipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

function versBien(b: LigneBien): FilBien {
  return {
    id: b.id, titre: b.title ?? '', prix: nombreOuNull(b.price), location: b.transaction_type === 'rent',
    type: b.type, pieces: nombreOuNull(b.rooms), surface: nombreOuNull(b.surface_m2), ville: b.city, canton: b.canton,
    adresse: b.address, equipements: listeEquipements(b.features), photo: b.photos?.[0] ?? null,
  }
}

/** La vignette d'une annonce : `photos_cf` porte des URL en chaîne OU des objets `{thumb, …}`, sinon `photos`. */
function photoAnnonce(cf: unknown, photos: string[] | null): string | null {
  const premier: unknown = Array.isArray(cf) ? cf[0] : undefined
  if (typeof premier === 'string' && premier) return premier
  if (premier && typeof premier === 'object') {
    const thumb = (premier as Record<string, unknown>).thumb
    if (typeof thumb === 'string' && thumb) return thumb
  }
  return photos?.find((p) => typeof p === 'string' && p !== '') ?? null
}

/** Une annonce du marché, dans la forme du fil. */
export function versBienMarche(a: LigneAnnonce): FilBien {
  const ref = refAnnonceMarche(a.source_portal, a.source_id, a.id)
  return {
    // Une annonce sans titre (le portail n'en donne pas toujours) : une ligne sans nom ne se coche pas
    // en connaissance de cause, et la case comme « Écarter » se nomment d'après lui.
    id: a.id, titre: a.title?.trim() || a.address?.trim() || a.city?.trim() || ref,
    prix: nombreOuNull(a.current_price) ?? nombreOuNull(a.price),
    location: a.transaction_type === 'rent', type: a.type, pieces: nombreOuNull(a.rooms), surface: nombreOuNull(a.surface_m2),
    ville: a.city, canton: a.canton, adresse: a.address, equipements: listeEquipements(a.features),
    photo: photoAnnonce(a.photos_cf, a.photos),
    marche: { ref, sourceUrl: a.source_url },
  }
}

function versSuivi(m: ColonnesSuivi & { status: string; apprentissage_at?: string | null }): SuiviMatch {
  return {
    statut: m.status as SuiviMatch['statut'], proposeLe: m.sent_at, reponduLe: m.response_at,
    motif: m.reaction_motif, note: m.reaction_note, prixPropose: nombreOuNull(m.prix_propose), apprisLe: m.apprentissage_at ?? null,
  }
}

/**
 * Le suivi d'un match ENCORE à proposer — seulement s'il a déjà été proposé : un bien refusé pour le prix et
 * revenu par une baisse (trigger `match_retour_prix_*`) garde son motif et son prix proposé.
 */
export function suiviAProposer(m: ColonnesSuivi): SuiviMatch | undefined {
  return m.prix_propose != null || m.reaction_motif != null ? versSuivi({ ...m, status: 'suggested' }) : undefined
}

/** Un contact lu, dans la forme du fil. */
export function versAcheteur(c: LigneContact, kyc: KycDossierStatus | null | undefined): FilMatch['acheteur'] {
  return {
    id: c.id, prenom: c.first_name, nom: c.last_name, telephone: c.phone, email: c.email,
    kyc: mapKycStatus(kyc ?? undefined),
  }
}

async function chargerFil(agencyId: string): Promise<DonneesFil> {
  const debut = Date.now()
  const [bruts, resumes, boucleBrute, relancesBrutes] = await Promise.all([
    lire<LigneMatch>(
      supabase.from('matches')
        .select('id, contact_id, property_id, client_search_id, score, reasons, snoozed_until, created_at, sent_at, response_at, reaction_motif, reaction_note, prix_propose')
        .eq('agency_id', agencyId)
        .eq('status', 'suggested')
        .not('property_id', 'is', null)
        .order('score', { ascending: false }),
    ),
    // ⛔ UNE RPC ABSENTE NE FAIT PAS TOMBER LE FIL. L'écran part AVANT les migrations (`deploy-app.yml`
    // n'attend pas `deploy.yml`, CLAUDE.md §8) : la fonction peut ne pas exister encore, et les biens en
    // mandat n'en dépendent pas. Sans lignes « Marché », mais pas sans fil — et pas en silence.
    // ⚠ CETTE TOLÉRANCE NE VAUT QUE POUR L'ABSENCE (PostgREST `PGRST202`, Postgres `42883`). Un échec
    // passager doit faire échouer la lecture ENTIÈRE : TanStack garde alors les données déjà chargées et
    // le fil le dit (« rafraîchissement impossible »). Avalé, il rendait un fil sans ses lignes « Marché »,
    // cohérent en apparence et faux en substance.
    lire<{ contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] | null }>(supabase.rpc('matching_fil_marche'))
      .catch((e: unknown) => {
        const code = (e as { code?: unknown } | null)?.code
        if (code !== 'PGRST202' && code !== '42883') throw e
        console.error('[matching-fil] matching_fil_marche absente : migration pas encore appliquée', e)
        return []
      }),
    lire<LigneBoucle>(
      supabase.from('matches')
        .select('id, contact_id, property_id, market_listing_id, client_search_id, score, reasons, status, created_at, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at')
        .eq('agency_id', agencyId)
        .in('status', STATUTS_BOUCLE),
    ),
    // Les relances de PROPOSITION en cours : « En attente » en tire l'échéance de chaque acheteur.
    lire<LigneRelance>(
      supabase.from('reminders')
        .select('id, contact_id, match_id, match_ids, trigger_at')
        .eq('agency_id', agencyId)
        .eq('type', 'follow_up_sent_property')
        .in('status', ['pending', 'triggered']),
    ),
  ])
  const lignes = bruts.filter((m) => m.property_id != null)
  if (lignes.length === 0 && resumes.length === 0 && boucleBrute.length === 0) return { ...VIDE, historique: new Map(), chargeLe: debut }
  const avecBien = [...lignes, ...boucleBrute]
  const contactIds = [...new Set([...avecBien.map((m) => m.contact_id), ...resumes.map((r) => r.contact_id)])]
  const bienIds = [...new Set(avecBien.map((m) => m.property_id).filter(nonNul))]
  const annonceIds = [...new Set(boucleBrute.map((m) => m.market_listing_id).filter(nonNul))]
  const rechercheIds = [...new Set(avecBien.map((m) => m.client_search_id).filter(nonNul))]

  const [contacts, recherches, biens, annonces, kyc] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', contactIds)),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    bienIds.length > 0
      ? lire<LigneBien>(
        supabase.from('properties')
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos')
          .in('id', bienIds),
      )
      : Promise.resolve([]),
    annonceIds.length > 0
      ? lire<LigneAnnonce>(supabase.from('market_listings').select(COLONNES_ANNONCE).in('id', annonceIds))
      : Promise.resolve([]),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', contactIds).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
  ])

  const contactParId = new Map(contacts.map((c) => [c.id, c]))
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const bienParId = new Map(biens.map((b) => [b.id, versBien(b)]))
  const annonceParId = new Map(annonces.map((a) => [a.id, versBienMarche(a)]))
  const kycParContact = new Map<string, KycDossierStatus | null>()
  for (const k of kyc) if (!kycParContact.has(k.contact_id)) kycParContact.set(k.contact_id, k.dossier_status)
  const criteresDe = (m: { client_search_id: string | null }, c: LigneContact): SearchCriteria | null =>
    (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const c = contactParId.get(m.contact_id)
    const bien = bienParId.get(m.property_id as string)
    // Un contact ou un bien que la RLS ne rend pas : on n'invente pas la ligne.
    if (!c || !bien) continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until, bien,
      criteres: criteresDe(m, c), rechercheId: m.client_search_id,
      acheteur: versAcheteur(c, kycParContact.get(c.id)), suivi: suiviAProposer(m),
    })
  }

  const boucle: FilMatch[] = []
  for (const m of boucleBrute) {
    const c = contactParId.get(m.contact_id)
    const bien = m.property_id ? bienParId.get(m.property_id) : m.market_listing_id ? annonceParId.get(m.market_listing_id) : undefined
    if (!c || !bien) continue
    boucle.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: null, bien,
      criteres: criteresDe(m, c), rechercheId: m.client_search_id,
      acheteur: versAcheteur(c, kycParContact.get(c.id)), suivi: versSuivi(m),
    })
  }

  const selections: FilSelectionResume[] = []
  for (const r of resumes) {
    const c = contactParId.get(r.contact_id)
    if (!c || r.nombre <= 0) continue
    selections.push({
      acheteur: versAcheteur(c, kycParContact.get(c.id)),
      nombre: r.nombre, meilleurScore: r.meilleur_score, vignettes: r.vignettes ?? [],
    })
  }

  // Une relance d'avant le lot B ne porte que `match_id` : elle couvre ce seul bien.
  const relances: RelanceProposition[] = relancesBrutes
    .filter((r): r is LigneRelance & { contact_id: string } => r.contact_id != null)
    .map((r) => ({ id: r.id, contactId: r.contact_id, matchIds: r.match_ids ?? (r.match_id ? [r.match_id] : []), echeance: r.trigger_at }))
  return { matchs, selections, boucle, relances, historique: compterHistorique(boucleBrute), chargeLe: debut }
}

interface EtatFil {
  isLoading: boolean
  isError: boolean
  /** Des données sont déjà là : un rafraîchissement en échec ne doit pas les remplacer par l'erreur. */
  aDesDonnees: boolean
  /** Horodatage du dernier échec (0 si aucun) : un échec signalé ne l'est qu'une fois. */
  erreurLe: number
  /** Rend la promesse d'invalidation : un appelant qui doit attendre la fin du rafraîchissement
   *  (relâcher un verrou, par exemple) le peut ; les autres l'ignorent avec `void`. */
  rafraichir: () => Promise<void>
}

/** Les matchs du fil — à proposer, du marché, de la boucle —, les relances en cours, et l'heure du chargement. */
export function useMatchingFil(): DonneesFil & EtatFil {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const client = useQueryClient()
  const requete = useQuery({
    queryKey: [CLE_FIL, agencyId],
    queryFn: () => chargerFil(agencyId as string),
    enabled: agencyId != null,
  })
  const rafraichir = useCallback((): Promise<void> => client.invalidateQueries({ queryKey: [CLE_FIL] }), [client])
  // ⚠ Une requête DÉSACTIVÉE n'est pas « en chargement » pour TanStack v5 (`isLoading` faux) : sans
  // la garde sur le profil, le fil afficherait « Tout est à jour » le temps que la session arrive.
  return {
    ...(requete.data ?? VIDE),
    isLoading: profile == null || requete.isLoading,
    isError: requete.isError,
    aDesDonnees: requete.data !== undefined,
    erreurLe: requete.errorUpdatedAt,
    rafraichir,
  }
}

/** Ce que les exécuteurs de l'atelier lisent d'un match du fil : ils restent la source unique des écritures. */
export function versGeste(m: FilMatch): { acheteur: AcheteurGeste; bien: BienGeste } {
  const marche = m.bien.marche
  return {
    acheteur: { id: m.acheteur.id, matchId: m.id, first: m.acheteur.prenom, last: m.acheteur.nom, score: m.score },
    bien: {
      kind: marche ? 'market' : 'property',
      id: m.bien.id,
      ref: marche ? marche.ref : refBienInterne(m.bien.id),
      title: m.bien.titre,
    },
  }
}
```

- [ ] **Step 2 : Remplacer `useSelectionMarche.ts`**

Remplacer INTÉGRALEMENT `src/hooks/useSelectionMarche.ts` par :

```ts
/**
 * Les biens du MARCHÉ d'un acheteur, pour la sélection du fil de matchs (lot 2, conception §5 et §8).
 *
 * ⛔ CHARGÉS À L'OUVERTURE DE SA LIGNE, VINGT À LA FOIS — jamais les 1 612 matchs du marché au
 * navigateur (17.09.2026). Servis par `idx_matches_agency_focus (agency_id, contact_id, score desc)
 * where status = 'suggested'`. On lit `limite + 1` lignes : la dernière ne sert qu'à dire s'il en reste.
 *
 * ⚠ Mêmes règles que le résumé serveur (`matching_fil_marche`) : non reporté, annonce non `removed`.
 * Appliquées ici côté client aussi — le banc ne connaît ni `not`, ni `or`.
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B) porte son suivi : la sélection dit
 * « prix baissé de … depuis le refus de … ». La lecture et la forme d'une annonce viennent de
 * `useMatchingFil` (`COLONNES_ANNONCE`, `versBienMarche`) : la boucle lit les annonces pareil.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  CLE_FIL, COLONNES_ANNONCE, lire, suiviAProposer, versAcheteur, versBienMarche, type LigneAnnonce, type LigneContact,
} from '@/hooks/useMatchingFil'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import type { FilMatch, RaisonsMoteur } from '@/components/matching-fil/filModele'

/** Le pas de chargement d'une sélection (§5). */
export const PAS_SELECTION = 20

interface LigneMatchMarche {
  id: string; market_listing_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
  sent_at: string | null; response_at: string | null; reaction_motif: string | null; reaction_note: string | null
  prix_propose: number | string | null
}
interface DonneesSelection { matchs: FilMatch[]; aPlus: boolean; chargeLe: number }

const AUCUNE: DonneesSelection = { matchs: [], aPlus: false, chargeLe: 0 }

async function chargerSelection(agencyId: string, contactId: string, limite: number): Promise<DonneesSelection> {
  const debut = Date.now()
  const bruts = await lire<LigneMatchMarche>(
    supabase.from('matches')
      .select('id, market_listing_id, client_search_id, score, reasons, snoozed_until, created_at, sent_at, response_at, reaction_motif, reaction_note, prix_propose')
      .eq('agency_id', agencyId)
      .eq('contact_id', contactId)
      .eq('status', 'suggested')
      .not('market_listing_id', 'is', null)
      // Le départage de `matching_fil_marche` : les vignettes de la ligne sont les premiers biens ouverts.
      .order('score', { ascending: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id')
      .range(0, limite),
  )
  const aPlus = bruts.length > limite
  const lignes = bruts.slice(0, limite).filter((m) =>
    m.market_listing_id != null && !(m.snoozed_until != null && Date.parse(m.snoozed_until) > debut))
  if (lignes.length === 0) return { matchs: [], aPlus, chargeLe: debut }
  const annonceIds = [...new Set(lignes.map((m) => m.market_listing_id as string))]
  const rechercheIds = [...new Set(lignes.map((m) => m.client_search_id).filter((id): id is string => id != null))]

  const [contacts, recherches, annonces, kyc] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', [contactId])),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    lire<LigneAnnonce>(supabase.from('market_listings').select(COLONNES_ANNONCE).in('id', annonceIds)),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', [contactId]).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
  ])

  const c = contacts.find((x) => x.id === contactId)
  if (!c) return { matchs: [], aPlus: false, chargeLe: debut }
  const acheteur = versAcheteur(c, kyc.find((k) => k.contact_id === contactId)?.dossier_status)
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const annonceParId = new Map(annonces.map((a) => [a.id, a]))

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const a = annonceParId.get(m.market_listing_id as string)
    if (!a || a.status === 'removed') continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until,
      bien: versBienMarche(a),
      criteres: (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria,
      rechercheId: m.client_search_id,
      acheteur,
      suivi: suiviAProposer(m),
    })
  }
  return { matchs, aPlus, chargeLe: debut }
}

const cleRequete = (agencyId: string | null, contactId: string | null, limite: number) =>
  [CLE_FIL, 'selection', agencyId, contactId, limite] as const

/** Les biens du marché d'un acheteur, `limite` à la fois ; `null` : aucune sélection ouverte. */
export function useSelectionMarche(contactId: string | null, limite: number) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const client = useQueryClient()
  const requete = useQuery({
    queryKey: cleRequete(agencyId, contactId, limite),
    queryFn: () => chargerSelection(agencyId as string, contactId as string, limite),
    enabled: agencyId != null && contactId != null,
    // « Voir 20 de plus » garde les vingt premiers à l'écran pendant que les suivants arrivent.
    // ⛔ MAIS SEULEMENT POUR LE MÊME ACHETEUR : `keepPreviousData` rendait la sélection de l'acheteur
    // QUITTÉ sous le nom du suivant, le temps de sa lecture — cochables et envoyables à la mauvaise
    // personne. Un autre acheteur n'a pas de données provisoires : il montre le squelette.
    placeholderData: (prec, requetePrec) => (requetePrec?.queryKey[3] === contactId ? prec : undefined),
  })
  // ⚠ Un « Voir 20 de plus » en échec : TanStack ne rend les données provisoires que TANT QUE la lecture
  // attend — l'échec les retire, et la liste disparaissait sous l'erreur. La page d'avant, de CE même
  // acheteur, est encore au cache (30 min) : elle reste à l'écran, l'erreur s'affiche dessous.
  const pagePrecedente = requete.isError && requete.data === undefined && contactId != null && limite > PAS_SELECTION
    ? client.getQueryData<DonneesSelection>(cleRequete(agencyId, contactId, limite - PAS_SELECTION))
    : undefined
  const donnees = requete.data ?? pagePrecedente ?? AUCUNE
  return {
    ...donnees,
    isLoading: contactId != null && (profile == null || requete.isLoading),
    /** La dernière lecture a échoué — avec ou sans liste encore à l'écran (`aDesDonnees`). */
    isError: requete.isError,
    /** Des biens de CET acheteur sont lisibles : lus, provisoires (« Voir plus » en route) ou la page d'avant un échec. */
    aDesDonnees: donnees !== AUCUNE,
    /** Données de la page précédente, affichées pendant que la suivante arrive : jamais une base de pré-cochage. */
    isPlaceholderData: requete.isPlaceholderData,
    isFetching: requete.isFetching,
    refetch: requete.refetch,
  }
}
```

- [ ] **Step 3 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useMatchingFil|useSelectionMarche" ; echo fin`
Expected : `fin` — aucune erreur dans les deux hooks. (`MatchingFil.tsx` ne lit pas encore `boucle` ni `relances` : c'est la Task 15.)

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-sans-sortie.spec.ts`
Expected : PASS.

- [ ] **Step 4 : Point de commit (au signal)** — avec la Task 15.

---

### Task 9 : Les traductions et la cloche

**Files :**
- Modify : `src/i18n/locales/{fr,de,en,it}/matching.json`
- Modify : `src/i18n/locales/{fr,de,en,it}/common.json`
- Modify : `src/hooks/useAgentNotifications.ts`

⚠ `matching.json` est partagé avec l'étape 1b (clés `recherche.*`). Le script le RELIT à l'exécution et n'écrit que sous `fil.*` : lancer le script, ne jamais recopier un fichier entier.

- [ ] **Step 1 : Les clés `fil.*`**

Lancer depuis la racine du worktree :

```bash
python3 - <<'EOF'
import json
FIL = {
  'fr': {
    'onglets': {'aria': 'Étapes de la boucle', 'aProposer': 'À proposer', 'enAttente': 'En attente', 'aConclure': 'À conclure'},
    'motifs': {'prix': 'Prix', 'quartier': 'Quartier', 'surface': 'Surface', 'pieces': 'Pièces', 'type': 'Type de bien', 'equipements': 'Équipements', 'etat': 'État du bien', 'autre': 'Autre'},
    'motifsAide': 'Pourquoi ? Un clic consigne le refus.',
    'note': 'Note (facultative)',
    'annulerMotif': 'Annuler',
    'retours': {
      'titre': 'Retours à consigner pour {{nom}}',
      'sousTitre_one': '{{count}} bien proposé attend sa réponse', 'sousTitre_other': '{{count}} biens proposés attendent sa réponse',
      'proposeLe': 'proposé le {{date}}',
      'interesse': 'Intéressé', 'pasInteresse': 'Pas intéressé', 'pasEncore': 'Pas encore',
      'listeAria': 'Biens proposés à {{prenom}}',
    },
    'attente': {
      'listeAria': 'Acheteurs en attente de réponse',
      'ligne_one': '{{count}} bien proposé', 'ligne_other': '{{count}} biens proposés',
      'relance': 'relance le {{date}}', 'relanceDue': 'relance due depuis le {{date}}',
    },
    'repondu': {
      'interesse': '{{prenom}} intéressé·e par « {{titre}} »',
      'refuse': '« {{titre}} » : pas intéressé·e ({{motif}})',
      'pasEncore': 'Relance repoussée de 3 jours pour {{prenom}}',
      'planifier': 'Planifier la visite',
    },
    'conclure': {
      'listeAria': 'Acheteurs intéressés',
      'ligne': '{{titre}} · intéressé·e le {{date}}',
      'titreAria': 'Visite à planifier : {{acheteur}} pour {{bien}}',
      'interesseLe': 'Intéressé·e le {{date}}',
      'planifier': 'Planifier une visite',
      'date': 'Date', 'heure': 'Heure', 'duree': 'Durée', 'minutes': '{{n}} min',
      'confirmer': 'Planifier la visite',
      'aucuneInvitation': "Rien n'est envoyé à {{prenom}} : la visite entre dans votre agenda.",
      'agenceAnnonce': "Visite avec l'agence de l'annonce : elle entre dans votre agenda, rien n'est envoyé à {{prenom}}.",
      'voirAnnonce': "Voir l'annonce d'origine",
      'dateRequise': 'Choisissez une date et une heure à venir.',
      'planifiee': 'Visite planifiée avec {{prenom}} le {{date}}',
    },
    'signal': {
      'baisseRefus': 'Refusé par {{prenom}} à {{prix}} · baissé de {{montant}} depuis',
      'baissePropose': "Prix baissé de {{montant}} depuis que vous l'avez proposé",
      'court': 'Prix baissé de {{montant}}',
    },
    'corrections': {
      'section': 'Recherches à ajuster', 'listeAria': 'Corrections de recherche proposées',
      'ligne_one': '{{motif}} · {{count}} refus', 'ligne_other': '{{motif}} · {{count}} refus',
      'titreAria': 'Recherche à ajuster pour {{nom}}',
      'sousTitre_one': 'Refusé {{count}} fois pour « {{motif}} »', 'sousTitre_other': 'Refusé {{count}} fois pour « {{motif}} »',
      'pourquoi': 'Les biens refusés', 'refuseLe': 'refusé le {{date}}', 'proposition': 'La correction proposée',
      'budget': 'Abaisser son budget maximum à (CHF)', 'surface': 'Relever sa surface minimum à (m²)', 'pieces': 'Relever son minimum de pièces à',
      'avant': "aujourd'hui : {{valeur}}", 'sansMax': "aujourd'hui : sans maximum", 'sansMin': "aujourd'hui : sans minimum",
      'zones': 'Retirer de ses zones : {{liste}}', 'zonesApres': 'Ses zones deviennent : {{liste}}',
      'type': 'Ne lui proposer que : {{type}}', 'typeAvant': "aujourd'hui : {{type}}", 'tousTypes': "aujourd'hui : tous les types",
      'equipements': 'Ajouter à ses équipements voulus : {{liste}}',
      'effet': 'Ses biens à proposer seront réévalués ; ceux qui ne correspondent plus sortiront de la liste.',
      'valider': 'Ajuster la recherche', 'ignorer': 'Ignorer', 'valeurInvalide': 'Saisissez un nombre positif.',
      'fait_one': 'Recherche ajustée pour {{prenom}} · {{count}} bien retiré des propositions',
      'fait_other': 'Recherche ajustée pour {{prenom}} · {{count}} biens retirés des propositions',
      'faitAucun': 'Recherche ajustée pour {{prenom}} · aucun bien retiré',
      'ignoree': 'Correction ignorée',
      'nouvelle': 'Une recherche à ajuster pour {{prenom}} vous attend dans « À proposer ».',
      'erreur': "La recherche n'a pas pu être ajustée. Réessayez.",
    },
    'vide': {
      'attenteTitre': 'Aucune réponse attendue', 'attenteTexte': "Les biens que vous proposez attendent ici la réponse de l'acheteur.",
      'conclureTitre': 'Aucune visite à planifier', 'conclureTexte': 'Les biens qui intéressent un acheteur attendent ici leur visite.',
    },
  },
  'de': {
    'onglets': {'aria': 'Schritte des Ablaufs', 'aProposer': 'Vorzuschlagen', 'enAttente': 'Ausstehend', 'aConclure': 'Abzuschliessen'},
    'motifs': {'prix': 'Preis', 'quartier': 'Quartier', 'surface': 'Fläche', 'pieces': 'Zimmer', 'type': 'Objektart', 'equipements': 'Ausstattung', 'etat': 'Zustand', 'autre': 'Anderes'},
    'motifsAide': 'Warum? Ein Klick erfasst die Absage.',
    'note': 'Notiz (optional)',
    'annulerMotif': 'Abbrechen',
    'retours': {
      'titre': 'Rückmeldungen von {{nom}} erfassen',
      'sousTitre_one': '{{count}} vorgeschlagenes Objekt wartet auf eine Antwort', 'sousTitre_other': '{{count}} vorgeschlagene Objekte warten auf eine Antwort',
      'proposeLe': 'vorgeschlagen am {{date}}',
      'interesse': 'Interessiert', 'pasInteresse': 'Nicht interessiert', 'pasEncore': 'Noch nicht',
      'listeAria': '{{prenom}} vorgeschlagene Objekte',
    },
    'attente': {
      'listeAria': 'Käufer mit ausstehender Antwort',
      'ligne_one': '{{count}} Objekt vorgeschlagen', 'ligne_other': '{{count}} Objekte vorgeschlagen',
      'relance': 'Nachfassen am {{date}}', 'relanceDue': 'Nachfassen fällig seit {{date}}',
    },
    'repondu': {
      'interesse': '{{prenom}} interessiert an „{{titre}}“',
      'refuse': '„{{titre}}“: nicht interessiert ({{motif}})',
      'pasEncore': 'Nachfassen bei {{prenom}} um 3 Tage verschoben',
      'planifier': 'Besichtigung planen',
    },
    'conclure': {
      'listeAria': 'Interessierte Käufer',
      'ligne': '{{titre}} · interessiert seit {{date}}',
      'titreAria': 'Zu planende Besichtigung: {{acheteur}} für {{bien}}',
      'interesseLe': 'Interessiert seit {{date}}',
      'planifier': 'Besichtigung planen',
      'date': 'Datum', 'heure': 'Uhrzeit', 'duree': 'Dauer', 'minutes': '{{n}} Min.',
      'confirmer': 'Besichtigung planen',
      'aucuneInvitation': '{{prenom}} erhält nichts: Die Besichtigung wird in Ihrer Agenda eingetragen.',
      'agenceAnnonce': 'Besichtigung mit der Agentur des Inserats: Sie wird in Ihrer Agenda eingetragen, {{prenom}} erhält nichts.',
      'voirAnnonce': 'Originalinserat ansehen',
      'dateRequise': 'Wählen Sie ein künftiges Datum und eine Uhrzeit.',
      'planifiee': 'Besichtigung mit {{prenom}} am {{date}} geplant',
    },
    'signal': {
      'baisseRefus': 'Von {{prenom}} bei {{prix}} abgelehnt · seither um {{montant}} gesenkt',
      'baissePropose': 'Preis um {{montant}} gesenkt, seit Sie es vorgeschlagen haben',
      'court': 'Preis um {{montant}} gesenkt',
    },
    'corrections': {
      'section': 'Anzupassende Suchen', 'listeAria': 'Vorgeschlagene Suchkorrekturen',
      'ligne_one': '{{motif}} · {{count}} Absage', 'ligne_other': '{{motif}} · {{count}} Absagen',
      'titreAria': 'Anzupassende Suche von {{nom}}',
      'sousTitre_one': '{{count}}-mal abgelehnt wegen „{{motif}}“', 'sousTitre_other': '{{count}}-mal abgelehnt wegen „{{motif}}“',
      'pourquoi': 'Abgelehnte Objekte', 'refuseLe': 'abgelehnt am {{date}}', 'proposition': 'Vorgeschlagene Korrektur',
      'budget': 'Maximalbudget senken auf (CHF)', 'surface': 'Mindestfläche erhöhen auf (m²)', 'pieces': 'Mindestzimmerzahl erhöhen auf',
      'avant': 'heute: {{valeur}}', 'sansMax': 'heute: ohne Maximum', 'sansMin': 'heute: ohne Minimum',
      'zones': 'Aus den Gebieten entfernen: {{liste}}', 'zonesApres': 'Neue Gebiete: {{liste}}',
      'type': 'Nur noch vorschlagen: {{type}}', 'typeAvant': 'heute: {{type}}', 'tousTypes': 'heute: alle Objektarten',
      'equipements': 'Zur gewünschten Ausstattung hinzufügen: {{liste}}',
      'effet': 'Die vorzuschlagenden Objekte werden neu bewertet; was nicht mehr passt, fällt aus der Liste.',
      'valider': 'Suche anpassen', 'ignorer': 'Ignorieren', 'valeurInvalide': 'Geben Sie eine positive Zahl ein.',
      'fait_one': 'Suche von {{prenom}} angepasst · {{count}} Objekt aus den Vorschlägen entfernt',
      'fait_other': 'Suche von {{prenom}} angepasst · {{count}} Objekte aus den Vorschlägen entfernt',
      'faitAucun': 'Suche von {{prenom}} angepasst · kein Objekt entfernt',
      'ignoree': 'Korrektur ignoriert',
      'nouvelle': 'Eine Korrektur der Suche von {{prenom}} wartet unter „Vorzuschlagen“.',
      'erreur': 'Die Suche konnte nicht angepasst werden. Versuchen Sie es erneut.',
    },
    'vide': {
      'attenteTitre': 'Keine Antwort ausstehend', 'attenteTexte': 'Vorgeschlagene Objekte warten hier auf die Antwort des Käufers.',
      'conclureTitre': 'Keine Besichtigung zu planen', 'conclureTexte': 'Objekte, die einen Käufer interessieren, warten hier auf ihre Besichtigung.',
    },
  },
  'en': {
    'onglets': {'aria': 'Loop steps', 'aProposer': 'To propose', 'enAttente': 'Awaiting reply', 'aConclure': 'To close'},
    'motifs': {'prix': 'Price', 'quartier': 'Neighbourhood', 'surface': 'Floor area', 'pieces': 'Rooms', 'type': 'Property type', 'equipements': 'Features', 'etat': 'Condition', 'autre': 'Other'},
    'motifsAide': 'Why? One click records the decline.',
    'note': 'Note (optional)',
    'annulerMotif': 'Cancel',
    'retours': {
      'titre': 'Feedback to record for {{nom}}',
      'sousTitre_one': '{{count}} proposed property awaits a reply', 'sousTitre_other': '{{count}} proposed properties await a reply',
      'proposeLe': 'proposed on {{date}}',
      'interesse': 'Interested', 'pasInteresse': 'Not interested', 'pasEncore': 'Not yet',
      'listeAria': 'Properties proposed to {{prenom}}',
    },
    'attente': {
      'listeAria': 'Buyers awaiting a reply',
      'ligne_one': '{{count}} property proposed', 'ligne_other': '{{count}} properties proposed',
      'relance': 'follow-up on {{date}}', 'relanceDue': 'follow-up due since {{date}}',
    },
    'repondu': {
      'interesse': '{{prenom}} interested in “{{titre}}”',
      'refuse': '“{{titre}}”: not interested ({{motif}})',
      'pasEncore': 'Follow-up with {{prenom}} pushed back 3 days',
      'planifier': 'Schedule the viewing',
    },
    'conclure': {
      'listeAria': 'Interested buyers',
      'ligne': '{{titre}} · interested on {{date}}',
      'titreAria': 'Viewing to schedule: {{acheteur}} for {{bien}}',
      'interesseLe': 'Interested on {{date}}',
      'planifier': 'Schedule a viewing',
      'date': 'Date', 'heure': 'Time', 'duree': 'Duration', 'minutes': '{{n}} min',
      'confirmer': 'Schedule the viewing',
      'aucuneInvitation': 'Nothing is sent to {{prenom}}: the viewing goes into your calendar.',
      'agenceAnnonce': "Viewing with the listing's agency: it goes into your calendar, nothing is sent to {{prenom}}.",
      'voirAnnonce': 'View the original listing',
      'dateRequise': 'Choose an upcoming date and time.',
      'planifiee': 'Viewing with {{prenom}} scheduled on {{date}}',
    },
    'signal': {
      'baisseRefus': 'Declined by {{prenom}} at {{prix}} · down {{montant}} since',
      'baissePropose': 'Price down {{montant}} since you proposed it',
      'court': 'Price down {{montant}}',
    },
    'corrections': {
      'section': 'Searches to adjust', 'listeAria': 'Proposed search corrections',
      'ligne_one': '{{motif}} · {{count}} decline', 'ligne_other': '{{motif}} · {{count}} declines',
      'titreAria': 'Search to adjust for {{nom}}',
      'sousTitre_one': 'Declined {{count}} time for “{{motif}}”', 'sousTitre_other': 'Declined {{count}} times for “{{motif}}”',
      'pourquoi': 'Declined properties', 'refuseLe': 'declined on {{date}}', 'proposition': 'Proposed correction',
      'budget': 'Lower the maximum budget to (CHF)', 'surface': 'Raise the minimum floor area to (m²)', 'pieces': 'Raise the minimum number of rooms to',
      'avant': 'currently: {{valeur}}', 'sansMax': 'currently: no maximum', 'sansMin': 'currently: no minimum',
      'zones': 'Remove from the areas: {{liste}}', 'zonesApres': 'New areas: {{liste}}',
      'type': 'Only propose: {{type}}', 'typeAvant': 'currently: {{type}}', 'tousTypes': 'currently: all types',
      'equipements': 'Add to the wanted features: {{liste}}',
      'effet': 'The properties to propose will be re-scored; those that no longer match will leave the list.',
      'valider': 'Adjust the search', 'ignorer': 'Ignore', 'valeurInvalide': 'Enter a positive number.',
      'fait_one': "{{prenom}}'s search adjusted · {{count}} property removed from the proposals",
      'fait_other': "{{prenom}}'s search adjusted · {{count}} properties removed from the proposals",
      'faitAucun': "{{prenom}}'s search adjusted · no property removed",
      'ignoree': 'Correction ignored',
      'nouvelle': "A correction of {{prenom}}'s search awaits you in “To propose”.",
      'erreur': "The search couldn't be adjusted. Try again.",
    },
    'vide': {
      'attenteTitre': 'No reply awaited', 'attenteTexte': "The properties you propose wait here for the buyer's reply.",
      'conclureTitre': 'No viewing to schedule', 'conclureTexte': 'Properties a buyer is interested in wait here for their viewing.',
    },
  },
  'it': {
    'onglets': {'aria': 'Fasi del ciclo', 'aProposer': 'Da proporre', 'enAttente': 'In attesa', 'aConclure': 'Da concludere'},
    'motifs': {'prix': 'Prezzo', 'quartier': 'Quartiere', 'surface': 'Superficie', 'pieces': 'Locali', 'type': 'Tipo di immobile', 'equipements': 'Dotazioni', 'etat': 'Stato', 'autre': 'Altro'},
    'motifsAide': 'Perché? Un clic registra il rifiuto.',
    'note': 'Nota (facoltativa)',
    'annulerMotif': 'Annulla',
    'retours': {
      'titre': 'Riscontri da registrare per {{nom}}',
      'sousTitre_one': '{{count}} immobile proposto attende una risposta', 'sousTitre_other': '{{count}} immobili proposti attendono una risposta',
      'proposeLe': 'proposto il {{date}}',
      'interesse': 'Interessato', 'pasInteresse': 'Non interessato', 'pasEncore': 'Non ancora',
      'listeAria': 'Immobili proposti a {{prenom}}',
    },
    'attente': {
      'listeAria': 'Acquirenti in attesa di risposta',
      'ligne_one': '{{count}} immobile proposto', 'ligne_other': '{{count}} immobili proposti',
      'relance': 'sollecito il {{date}}', 'relanceDue': 'sollecito dovuto dal {{date}}',
    },
    'repondu': {
      'interesse': '{{prenom}} interessato/a a «{{titre}}»',
      'refuse': '«{{titre}}»: non interessato/a ({{motif}})',
      'pasEncore': 'Sollecito a {{prenom}} rinviato di 3 giorni',
      'planifier': 'Pianifica la visita',
    },
    'conclure': {
      'listeAria': 'Acquirenti interessati',
      'ligne': '{{titre}} · interessato/a il {{date}}',
      'titreAria': 'Visita da pianificare: {{acheteur}} per {{bien}}',
      'interesseLe': 'Interessato/a il {{date}}',
      'planifier': 'Pianifica una visita',
      'date': 'Data', 'heure': 'Ora', 'duree': 'Durata', 'minutes': '{{n}} min',
      'confirmer': 'Pianifica la visita',
      'aucuneInvitation': 'A {{prenom}} non viene inviato nulla: la visita entra nella Sua agenda.',
      'agenceAnnonce': "Visita con l'agenzia dell'annuncio: entra nella Sua agenda, a {{prenom}} non viene inviato nulla.",
      'voirAnnonce': "Vedi l'annuncio originale",
      'dateRequise': 'Scelga una data e un orario futuri.',
      'planifiee': 'Visita di {{prenom}} pianificata il {{date}}',
    },
    'signal': {
      'baisseRefus': 'Rifiutato da {{prenom}} a {{prix}} · ribassato di {{montant}} da allora',
      'baissePropose': "Prezzo ridotto di {{montant}} da quando l'ha proposto",
      'court': 'Prezzo ridotto di {{montant}}',
    },
    'corrections': {
      'section': 'Ricerche da adattare', 'listeAria': 'Correzioni di ricerca proposte',
      'ligne_one': '{{motif}} · {{count}} rifiuto', 'ligne_other': '{{motif}} · {{count}} rifiuti',
      'titreAria': 'Ricerca da adattare per {{nom}}',
      'sousTitre_one': 'Rifiutato {{count}} volta per «{{motif}}»', 'sousTitre_other': 'Rifiutato {{count}} volte per «{{motif}}»',
      'pourquoi': 'Immobili rifiutati', 'refuseLe': 'rifiutato il {{date}}', 'proposition': 'Correzione proposta',
      'budget': 'Ridurre il budget massimo a (CHF)', 'surface': 'Aumentare la superficie minima a (m²)', 'pieces': 'Aumentare il numero minimo di locali a',
      'avant': 'oggi: {{valeur}}', 'sansMax': 'oggi: senza massimo', 'sansMin': 'oggi: senza minimo',
      'zones': 'Togliere dalle zone: {{liste}}', 'zonesApres': 'Nuove zone: {{liste}}',
      'type': 'Proporre solo: {{type}}', 'typeAvant': 'oggi: {{type}}', 'tousTypes': 'oggi: tutti i tipi',
      'equipements': 'Aggiungere alle dotazioni desiderate: {{liste}}',
      'effet': 'Gli immobili da proporre saranno rivalutati; quelli che non corrispondono più usciranno dalla lista.',
      'valider': 'Adatta la ricerca', 'ignorer': 'Ignora', 'valeurInvalide': 'Inserisca un numero positivo.',
      'fait_one': 'Ricerca di {{prenom}} adattata · {{count}} immobile tolto dalle proposte',
      'fait_other': 'Ricerca di {{prenom}} adattata · {{count}} immobili tolti dalle proposte',
      'faitAucun': 'Ricerca di {{prenom}} adattata · nessun immobile tolto',
      'ignoree': 'Correzione ignorata',
      'nouvelle': 'Una correzione della ricerca di {{prenom}} La attende in «Da proporre».',
      'erreur': 'Non è stato possibile adattare la ricerca. Riprovi.',
    },
    'vide': {
      'attenteTitre': 'Nessuna risposta in attesa', 'attenteTexte': "Gli immobili che propone attendono qui la risposta dell'acquirente.",
      'conclureTitre': 'Nessuna visita da pianificare', 'conclureTexte': 'Gli immobili che interessano un acquirente attendono qui la loro visita.',
    },
  },
}
LISTE_ARIA = {'fr': 'Matchs à proposer', 'de': 'Vorzuschlagende Matches', 'en': 'Matches to propose', 'it': 'Match da proporre'}

def verifier(o, langue, cle=''):
    if isinstance(o, str):
        assert '—' not in o and '–' not in o, f'{langue}{cle} : tiret cadratin'
        assert not (langue == 'de' and 'ß' in o), f'{langue}{cle} : ß'
    elif isinstance(o, dict):
        for k, v in o.items():
            verifier(v, langue, f'{cle}.{k}')

for langue, ajout in FIL.items():
    verifier(ajout, langue)
    chemin = f'src/i18n/locales/{langue}/matching.json'
    brut = open(chemin, encoding='utf-8').read()  # relu à l'exécution : les clés de la pige (1b) restent
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'{chemin} : mise en forme inattendue'
    fil = d['fil']
    for cle, valeur in ajout.items():
        if cle == 'vide':
            for k in valeur:
                assert k not in fil['vide'], f'{chemin} : fil.vide.{k} existe déjà'
        else:
            assert cle not in fil, f'{chemin} : fil.{cle} existe déjà'
    assert 'aTraiter' in fil, f'{chemin} : fil.aTraiter attendu (retiré par ce script)'
    for cle, valeur in ajout.items():
        if cle == 'vide':
            fil['vide'].update(valeur)
        else:
            fil[cle] = valeur
    fil['listeAria'] = LISTE_ARIA[langue]
    # « À traiter · N » vivait dans l'en-tête ; les onglets portent désormais leurs comptes.
    del fil['aTraiter']
    open(chemin, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print(chemin, 'ok')
EOF
```

Expected : quatre lignes `… ok`.

- [ ] **Step 2 : Les libellés du journal**

```bash
python3 - <<'EOF'
import json
AUDIT = {
  'fr': {'match_reaction': "Réponse de l'acheteur consignée", 'match_pas_encore': "Pas encore de réponse de l'acheteur",
         'match_retour_prix': 'Bien refusé revenu après une baisse de prix', 'recherche_ajustee': "Recherche ajustée d'après les refus",
         'matchs_reevalues': 'Matchs réévalués', 'correction_ignoree': 'Correction de recherche ignorée'},
  'de': {'match_reaction': 'Antwort des Käufers erfasst', 'match_pas_encore': 'Noch keine Antwort des Käufers',
         'match_retour_prix': 'Abgelehntes Objekt nach Preissenkung zurück', 'recherche_ajustee': 'Suche nach Absagen angepasst',
         'matchs_reevalues': 'Matches neu bewertet', 'correction_ignoree': 'Suchkorrektur ignoriert'},
  'en': {'match_reaction': "Buyer's answer recorded", 'match_pas_encore': 'No answer from the buyer yet',
         'match_retour_prix': 'Declined property back after a price drop', 'recherche_ajustee': 'Search adjusted after declines',
         'matchs_reevalues': 'Matches re-scored', 'correction_ignoree': 'Search correction ignored'},
  'it': {'match_reaction': "Risposta dell'acquirente registrata", 'match_pas_encore': "Ancora nessuna risposta dell'acquirente",
         'match_retour_prix': 'Immobile rifiutato tornato dopo un calo di prezzo', 'recherche_ajustee': 'Ricerca adattata dopo i rifiuti',
         'matchs_reevalues': 'Match rivalutati', 'correction_ignoree': 'Correzione della ricerca ignorata'},
}
for langue, ajout in AUDIT.items():
    chemin = f'src/i18n/locales/{langue}/common.json'
    brut = open(chemin, encoding='utf-8').read()
    d = json.loads(brut)
    assert json.dumps(d, ensure_ascii=False, indent=2) + '\n' == brut, f'{chemin} : mise en forme inattendue'
    action = d['audit']['action']
    for cle in ajout:
        assert cle not in action, f'{chemin} : audit.action.{cle} existe déjà'
    action.update(ajout)
    open(chemin, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print(chemin, 'ok')
EOF
```

Expected : quatre lignes `… ok`.

- [ ] **Step 3 : La cloche range les nouvelles actions**

Dans `src/hooks/useAgentNotifications.ts`, remplacer la ligne :

```ts
  match_reporte: 'matching', match_ecarte: 'matching', match_propose: 'matching',
```

par :

```ts
  match_reporte: 'matching', match_ecarte: 'matching', match_propose: 'matching',
  // La boucle chez l'agent (lot B, 21.09.2026) : réponses consignées, relance repoussée, retour d'un bien par
  // une baisse de prix, et « Apprendre » (recherche ajustée, correction ignorée).
  match_reaction: 'matching', match_pas_encore: 'matching', match_retour_prix: 'matching',
  recherche_ajustee: 'matching', matchs_reevalues: 'matching', correction_ignoree: 'matching',
```

- [ ] **Step 4 : Vérifier**

Run : `npm run i18n:parity:ci && npm run lint:prose`
Expected : 0 manquante, 0 orpheline ; typographie OK.

Run : `npx vitest run tests/unit/agent-notifications-scenarios.spec.ts`
Expected : PASS (aucune action du journal ne tombe en « Système »).

Run : `grep -rn "fil.aTraiter" src ; echo fin`
Expected : `src/components/matching-fil/FilEnTete.tsx` seulement, puis `fin` — son lecteur part à la Task 10.

- [ ] **Step 5 : Point de commit (au signal)** — avec la Task 15.

---

### Task 10 : L'affichage partagé — signal, bouton, survol, « Recherches à ajuster »

**Files :**
- Modify : `src/components/matching-fil/filAffichage.ts`, `filAtomes.tsx`, `FilAnnulation.tsx`, `FilEnTete.tsx`, `FilPanneau.tsx`, `FilSelection.tsx`, `FilListe.tsx`

Chaque fichier se relit avant d'être remplacé : un commentaire du lot 1, 2 ou A absent des blocs ci-dessous se reporte, et se signale.

- [ ] **Step 1 : Remplacer `filAffichage.ts`**

Remplacer INTÉGRALEMENT `src/components/matching-fil/filAffichage.ts` par :

```ts
/**
 * Affichage du fil de matchs, hors composants : les teintes qui ENCODENT (le palier d'un score, un critère
 * tenu, un écart), l'encre d'une action en texte, l'écriture d'un montant et d'une date, le style d'une
 * ligne, et le signal « prix baissé » (lot B).
 *
 * ⚠ Jamais d'aplat teinté sous du texte : la couleur est portée par une pastille ou une icône, le
 * chiffre et les libellés restent à l'encre. Les couleurs de système de la vitrine sont PÂLES,
 * réglées pour le noir ; en clair l'encre passe par `STATUT_CLAIR` (CLAUDE.md §3, point 4 de
 * « Sombre — échelle MEGGA X »).
 */
import type { CSSProperties, MouseEvent } from 'react'
import type { TFunction } from 'i18next'
import { format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { formatCHF } from '@/lib/utils'
import type { FilBien, FilMatch, PalierScore } from './filModele'
import { signalPrix } from './filBoucle'

/** Pastille du palier : vert, bleu de marque, ou la sourdine. */
export function teinteScore(palier: PalierScore, sp: CrmPalette): string {
  if (palier === 'fort') return sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk
  if (palier === 'bon') return sp.isDark ? MXC_SYSTEM.blue300 : sp.accent
  return sp.sub
}

/** Un critère tenu, un KYC vérifié. */
export const teinteTenu = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk)

/** Un écart signalé par le moteur. */
export const teinteEcart = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.yellow400 : STATUT_CLAIR.warnInk)

/**
 * Encre d'une action en TEXTE, et filet d'un élément ACTIF : sur sombre, l'accent ne passe ni l'AA en
 * texte ni le seuil de 3:1 d'un filet (3,07:1 sur une carte).
 */
export const encreAccent = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.blue300 : sp.accent)

/** Un montant du bien : « CHF 1'450'000 », ou « CHF 2'950 / mois » pour une location. */
export function montant(location: boolean, valeur: number, t: TFunction): string {
  return location ? t('fil.valeurs.parMois', { valeur: formatCHF(valeur) }) : formatCHF(valeur)
}

/** Le prix d'un bien ; « Non renseigné » sans prix. */
export function prixBien(bien: FilBien, t: TFunction): string {
  return bien.prix == null ? t('fil.valeurs.inconnu') : montant(bien.location, bien.prix, t)
}

/** « 21.09 » : une date du fil — proposition, réponse, relance, retour. */
export const dateCourte = (iso: string): string => format(new Date(iso), 'dd.MM')

/**
 * Le signal « prix baissé » d'un bien (conception de la boucle, §4.6), ou `null` sans baisse mesurée sur
 * `prix_propose`. Long dans un panneau — « Refusé par Antoine à CHF 3'450'000 · baissé de CHF 250'000
 * depuis », ou « Prix baissé de … depuis que vous l'avez proposé » sur un bien sans réponse —, court sur une
 * ligne (« Prix baissé de CHF 250'000 »).
 *
 * ⚠ Aucune tournure « de {{prenom}} » : le français élide devant une voyelle (« d'Antoine », « d'Emma »), et
 * une interpolation ne le sait pas.
 */
export function texteSignal(m: FilMatch, t: TFunction, court = false): string | null {
  const s = signalPrix(m)
  const propose = m.suivi?.prixPropose
  if (!s || propose == null) return null
  const baisse = montant(m.bien.location, s.baisse, t)
  if (court) return t('fil.signal.court', { montant: baisse })
  return s.depuis === 'refus'
    ? t('fil.signal.baisseRefus', { prenom: m.acheteur.prenom, prix: montant(m.bien.location, propose, t), montant: baisse })
    : t('fil.signal.baissePropose', { montant: baisse })
}

/**
 * Marge droite des panneaux du fil : les points de page du pager (`MatchingPage`) flottent au bord
 * droit, et recouvraient le grand score et le bouton principal.
 */
export const MARGE_POINTS = 'calc(var(--crm-space-7xl) + var(--crm-space-lg))'

/** Une ligne du fil — match, sélection, correction, acheteur en attente — choisie ou non. */
export function styleLigne(sp: CrmPalette, active: boolean): CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
    padding: 'var(--crm-space-sm) var(--crm-space-lg)', border: 0, borderRadius: 'var(--crm-radius-md)',
    cursor: 'pointer', fontFamily: 'inherit', color: sp.ink,
    background: active ? sp.focusSurface : 'transparent',
    // Le fond RÉEL de la ligne (transparente, elle montre celui de la colonne) : la règle `:hover` le
    // reprend, et l'anneau des vignettes empilées le lit.
    ['--fil-fond' as string]: active ? sp.focusSurface : sp.frameBg,
    // L'élément ACTIF porte l'accent (CLAUDE.md §3), en filet : sur sombre l'accent brut tombe sous 3:1.
    boxShadow: active ? `inset 0 0 0 1px ${encreAccent(sp)}` : 'none',
  }
}

/**
 * ⛔ Le second clic d'un double clic tombe sur ce que le premier a fait apparaître ou déplacer sous le
 * curseur (une ligne qui glisse, un bouton qui la remplace) : `detail` compte les clics du même geste, 2 au
 * second — l'activation clavier, elle, porte `detail: 0` et n'est jamais concernée.
 */
export function ignorerDoubleClic<T>(faire: (v: T) => void) {
  return (v: T) => (e: MouseEvent) => { if (e.detail > 1) return; faire(v) }
}
```

- [ ] **Step 2 : Remplacer `filAtomes.tsx`**

Remplacer INTÉGRALEMENT `src/components/matching-fil/filAtomes.tsx` par :

```tsx
/**
 * Atomes du fil de matchs — l'avatar, la vignette d'un bien, le score, le bouton d'un geste et le survol des
 * lignes, partagés par les listes et les panneaux : un même acheteur, un même score ou un même geste ne se
 * dessinent jamais de deux façons sur un écran.
 */
import type { MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { PalierScore } from './filModele'
import { teinteScore } from './filAffichage'

/** Initiales sur la sous-surface, neutres : une couleur d'avatar n'encode rien ici. */
export function FilAvatar({ sp, texte, taille }: { sp: CrmPalette; texte: string; taille: number }) {
  // Hors de la déclaration de style : le cliquet de grammaire lirait ce seuil comme une taille de texte.
  const texteGrand = taille >= 36
  return (
    <span aria-hidden style={{
      width: taille, height: taille, flex: 'none', display: 'grid', placeItems: 'center',
      borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
      color: sp.ink, fontSize: texteGrand ? 'var(--crm-text-md)' : 'var(--crm-text-xs)', fontWeight: 600,
    }}>
      {texte}
    </span>
  )
}

/**
 * La première photo d'un bien, ou une maison en sourdine.
 *
 * `no-referrer` : Flatfox refuse les images demandées depuis un autre site (même règle que `MrhPhoto`).
 */
export function FilVignette({ sp, photo, largeur, hauteur }: { sp: CrmPalette; photo: string | null; largeur: number; hauteur: number }) {
  return (
    <span aria-hidden style={{
      width: largeur, height: hauteur, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
      borderRadius: 'var(--crm-radius-xs)', background: sp.cardSubBg,
    }}>
      {photo
        ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <MEIcon name="home" size={14} color={sp.sub} />}
    </span>
  )
}

/** Le score : le chiffre à l'encre, le palier dans la pastille. Toujours une estimation (CLAUDE.md §5). */
export function FilScore({ sp, score, palier, grand = false }: { sp: CrmPalette; score: number; palier: PalierScore; grand?: boolean }) {
  const { t } = useTranslation('matching')
  const libelle = t('fil.scoreAria', { score, palier: t(`fil.palier.${palier}`) })
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flex: 'none' }}>
      <span aria-hidden style={{ width: grand ? 10 : 8, height: grand ? 10 : 8, borderRadius: 'var(--crm-radius-pill)', background: teinteScore(palier, sp) }} />
      <span aria-hidden style={{ fontSize: grand ? 'var(--crm-text-6xl)' : 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
        {score}
      </span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}

/**
 * Le bouton d'un geste, sa touche ÉCRITE dessus (jamais cachée) : le principal porte l'accent (CLAUDE.md §3),
 * les autres un filet. `bien` pose `data-bien` : le fil y rend le focus après un geste annulé.
 *
 * ⛔ Un double clic trie DEUX lignes : le premier clic fait passer la sélection à la suivante (même bouton,
 * sous le curseur), le second la trie à son tour. `detail` compte les clics du même geste (2 au second) ;
 * l'activation clavier vaut toujours 0.
 */
export function FilBouton({ sp, touche, onClick, principal = false, compact = false, bien, ouvert, desactive = false, children }: {
  sp: CrmPalette; touche?: string; onClick: () => void; principal?: boolean; compact?: boolean
  bien?: string; ouvert?: boolean; desactive?: boolean; children: ReactNode
}) {
  const { t } = useTranslation('matching')
  const clic = (e: MouseEvent<HTMLButtonElement>) => { if (e.detail > 1) return; onClick() }
  return (
    <button type="button" onClick={clic} disabled={desactive} data-bien={bien} aria-expanded={ouvert}
      title={touche ? t('fil.actions.raccourci', { touche }) : undefined} aria-keyshortcuts={touche} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: compact ? 32 : 40,
        paddingLeft: compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
        paddingRight: compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-pill)', border: principal ? 0 : `1px solid ${sp.cardBorder}`,
        cursor: desactive ? 'not-allowed' : 'pointer', opacity: desactive ? 0.5 : 1, fontFamily: 'inherit',
        background: principal ? sp.accent : 'transparent', color: principal ? sp.accentInk : sp.ink,
        fontSize: compact ? 'var(--crm-text-sm)' : 'var(--crm-text-md)', fontWeight: 600,
      }}>
      {children}
      {touche && <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: principal ? sp.accentInk : sp.sub }}>{touche}</kbd>}
    </button>
  )
}

/**
 * Le survol des lignes du fil (`.fil-ligne`), posé UNE fois par le conteneur : trois listes le partagent, et
 * celle qui le portait l'emportait quand on changeait d'onglet. `--fil-fond` suit le fond : l'anneau des
 * vignettes d'une ligne « Marché » en prend la teinte.
 */
export function FilStyleLignes({ sp }: { sp: CrmPalette }) {
  return <style>{`.fil-ligne:hover { background: ${sp.focusSurface} !important; --fil-fond: ${sp.focusSurface} !important; }`}</style>
}
```

- [ ] **Step 3 : Remplacer `FilAnnulation.tsx`**

Remplacer INTÉGRALEMENT `src/components/matching-fil/FilAnnulation.tsx` par :

```tsx
/**
 * La barre d'annulation d'un geste différé (« Je l'ai proposé », Plus tard, Écarter, Intéressé, Pas
 * intéressé) : visible tant que « Annuler » annule ENCORE — `MatchingFil` la retire avant la fin de la
 * fenêtre d'écriture (§6.2). « Je l'ai proposé » s'annule depuis qu'il n'envoie plus rien à l'acheteur
 * (21.09.2026). Elle peut offrir un second geste (« Planifier la visite » après « Intéressé », lot B), qui
 * fait partir l'écriture tout de suite.
 *
 * ⚠ Pas de `role="status"` ici : une région vivante MONTÉE avec son texte n'est pas annoncée de façon
 * fiable. L'annonce passe par la région que `MatchingFil` garde montée en permanence.
 *
 * ⚠ EN OVERLAY, pas dans le flux : posée sous la liste/le panneau, elle poussait la barre d'actions
 * sticky de ~50 px à chaque apparition/disparition. `MatchingFil` pose `position: relative` sur sa
 * racine ; ici `position: absolute`, ancrée bas-gauche.
 */
import type { CSSProperties, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { encreAccent } from './filAffichage'

export default function FilAnnulation({ sp, texte, action, onAnnuler }: {
  sp: CrmPalette; texte: string; action?: { libelle: string; faire: () => void }; onAnnuler: () => void
}) {
  const { t } = useTranslation('matching')
  // ⛔ La barre est un OVERLAY posé SUR la liste (pas dans son flux) : un de ses boutons la démonte, ce qui
  // découvre la ligne qui était dessous, exactement là où le curseur se trouve. Le second clic d'un double
  // clic, à la même position, tombe alors sur cette ligne — `detail` compte les clics du même geste (2 au
  // second) quel que soit l'élément qui les reçoit. Même garde sur les lignes (`ignorerDoubleClic`).
  const unSeulClic = (faire: () => void) => (e: MouseEvent<HTMLButtonElement>) => { if (e.detail > 1) return; faire() }
  const bouton: CSSProperties = {
    border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
    fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)', flex: 'none',
  }
  return (
    <div style={{
      position: 'absolute', left: 'var(--crm-space-lg)', bottom: 'var(--crm-space-lg)', zIndex: 2, maxWidth: 460,
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
      borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.solidBg, boxShadow: sp.solidShadow,
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{texte}</span>
      {action && <button type="button" onClick={unSeulClic(action.faire)} style={bouton}>{action.libelle}</button>}
      <button type="button" onClick={unSeulClic(onAnnuler)} style={bouton}>{t('fil.annuler')}</button>
    </div>
  )
}
```

- [ ] **Step 4 : `FilEnTete.tsx` — le compte part dans les onglets**

1. Remplacer la première ligne de l'en-tête ` * En-tête du fil de matchs : le titre, le compte d'« À traiter », et les filtres Bien, Acheteur et` par ` * En-tête du fil de matchs : le titre et les filtres Bien, Acheteur et` — la phrase se poursuit à la ligne suivante, inchangée ; ajouter, juste AVANT la ligne `` * ⚠ Des `<select>` NATIFS : … ``, les deux lignes :

```ts
 * Les comptes vivent dans les onglets (`FilOnglets`, lot B) : un par temps de la boucle.
 *
```

2. Dans `interface Props`, supprimer les deux lignes :

```ts
  /** `null` tant que le compte n'est pas connu (chargement, échec). */
  compte: number | null
```

3. Remplacer `export default function FilEnTete({ sp, compte, filtres, options, onFiltres }: Props) {` par `export default function FilEnTete({ sp, filtres, options, onFiltres }: Props) {`.

4. Supprimer le bloc :

```tsx
        {compte != null && (
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {t('fil.aTraiter', { count: compte })}
          </p>
        )}
```

- [ ] **Step 5 : Remplacer `FilPanneau.tsx`**

Remplacer INTÉGRALEMENT `src/components/matching-fil/FilPanneau.tsx` par :

```tsx
/**
 * Le panneau d'un match à proposer (§4) : le bien, l'acheteur, le score, la comparaison « Recherché / Ce
 * bien » et UN bouton principal — « Je l'ai proposé », Plus tard, Écarter. ⛔ « Je l'ai proposé » n'envoie
 * rien à l'acheteur (21.09.2026) : il consigne ce que l'agent a fait lui-même.
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B) le dit sous son prix : « Prix baissé de …
 * depuis le refus de … ».
 *
 * ⛔ Jamais de points à l'écran : le moteur reporte le poids d'un axe sans critère sur les autres, donc
 * la somme des points ne retombe pas sur le score, et l'afficher se lirait comme une erreur de calcul.
 */
import type { CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, type FilMatch, type Historique, type LigneCritere } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu, texteSignal } from './filAffichage'
import { FilAvatar, FilBouton, FilScore } from './filAtomes'
import { valeursCritere } from './filValeurs'

interface Props {
  sp: CrmPalette
  m: FilMatch
  historique: Historique | undefined
  onProposer: () => void
  onPlusTard: () => void
  onEcarter: () => void
  onVoirBien: () => void
  onVoirContact: () => void
}

export default function FilPanneau({ sp, m, historique, onProposer, onPlusTard, onEcarter, onVoirBien, onVoirContact }: Props) {
  const { t, i18n } = useTranslation('matching')
  const { bien, acheteur } = m
  const lignes = lignesCriteres(m)
  const signal = texteSignal(m, t)
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
  }
  return (
    <section aria-label={t('fil.panneauAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)', padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)` }}>
        <div style={{ height: 220, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }}>
          {bien.photo
            ? <img src={bien.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                <MEIcon name="home" size={18} color={sp.sub} />{t('fil.sansPhoto')}
              </span>
            )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
            }}>
              {t('fil.votreBien')}
            </span>
            <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            {signal && (
              <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>{signal}</p>
            )}
            <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>
          </div>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} grand />
            <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.estimation')}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: acheteur.kyc === 'verified' ? teinteTenu(sp) : sp.sub }}>
              {t(`fil.kyc.${acheteur.kyc}`)}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>
            {t('fil.pourquoi')}
          </h3>
          {lignes.length === 0
            ? <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('fil.sansCriteres')}</p>
            : <TableCriteres sp={sp} lignes={lignes} t={t} nombre={nombre} />}
        </div>

        <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
          {!historique || historique.proposes === 0
            ? t('fil.historique.aucun', { prenom: acheteur.prenom })
            : t('fil.historique.proposes', { prenom: acheteur.prenom, count: historique.proposes })
              + (historique.interesses > 0 ? t('fil.historique.interesses', { count: historique.interesses }) : '')}
        </p>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`, background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} touche="X" onClick={onEcarter}>{t('fil.actions.ecarter')}</FilBouton>
        <FilBouton sp={sp} touche="P" onClick={onPlusTard}>{t('fil.actions.plusTard')}</FilBouton>
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} touche="E" onClick={onProposer} principal>{t('fil.actions.proposer', { prenom: acheteur.prenom })}</FilBouton>
      </div>
    </section>
  )
}

function TableCriteres({ sp, lignes, t, nombre }: { sp: CrmPalette; lignes: LigneCritere[]; t: TFunction; nombre: (n: number) => string }) {
  const cellule: CSSProperties = {
    padding: 'var(--crm-space-sm) var(--crm-space-xs)', borderBottom: `1px solid ${sp.cardBorder}`, textAlign: 'left', verticalAlign: 'top',
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'var(--crm-text-md)', color: sp.ink }}>
      <thead>
        <tr style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          <th scope="col" style={{ ...cellule, width: '24%', fontWeight: 500 }}>{t('fil.colonnes.critere')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.recherche')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.bien')}</th>
          <th scope="col" style={{ ...cellule, width: 32 }}><span className="sr-only">{t('fil.colonnes.verdict')}</span></th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => {
          const [recherche, propose] = valeursCritere(l, t, nombre)
          return (
            <tr key={l.cle}>
              <th scope="row" style={{ ...cellule, fontWeight: 500, color: sp.sub }}>{t(`fil.criteres.${l.cle}`)}</th>
              <td style={cellule}>{recherche}</td>
              <td style={cellule}>
                {propose}
                {l.ecart && (
                  <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: teinteEcart(sp) }}>{l.ecart}</span>
                )}
              </td>
              <td style={cellule}>
                {l.ok !== null && (
                  <span role="img" aria-label={t(l.ok ? 'fil.correspond' : 'fil.ecart')} style={{ display: 'inline-flex' }}>
                    <MEIcon name={l.ok ? 'check' : 'alert'} size={16} color={l.ok ? teinteTenu(sp) : teinteEcart(sp)} />
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 6 : `FilSelection.tsx` — le signal d'un bien revenu**

0. Dans l'en-tête, juste AVANT la ligne `` * ⚠ Chaque case porte `data-bien` : … ``, ajouter les deux lignes :

```ts
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B) le dit sous ses détails (`texteSignal`).
 *
```

1. Remplacer `import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu } from './filAffichage'` par :

```ts
import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu, texteSignal } from './filAffichage'
```

2. Dans la fonction `Bien`, juste APRÈS la ligne `  const aVerifier = criteresNonTenus(lignes)`, ajouter :

```ts
  // Un bien refusé pour le PRIX et revenu par une baisse (lot B) : c'est ce qui le ramène, on le dit.
  const signal = texteSignal(m, t)
```

3. Toujours dans `Bien`, remplacer :

```tsx
          <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
```

par :

```tsx
          <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
          {signal && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.ink }}>{signal}</span>}
```

- [ ] **Step 7 : Remplacer `FilListe.tsx`**

Remplacer INTÉGRALEMENT `src/components/matching-fil/FilListe.tsx` par :

```tsx
/**
 * La liste « À proposer » du fil (§3.2) : les recherches à ajuster (« Apprendre », lot B), puis « Vos
 * biens », un groupe par bien et ses acheteurs dessous ; puis « Marché », une ligne par acheteur (lot 2) ;
 * puis les reportés, repliés.
 *
 * ⚠ Une ligne est un `role="option"` à tabindex ITINÉRANT : seule la ligne courante est dans l'ordre
 * de tabulation, et ↑/↓ déplacent la sélection — c'est `MatchingFil` qui porte le clavier du fil.
 * La liste entière n'est donc qu'un arrêt de Tab.
 *
 * ⚠ L'en-tête d'un bien est MASQUÉ aux lecteurs d'écran : un `listbox` ne contient que des options et
 * des groupes, et le groupe porte déjà le titre du bien en libellé.
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse porte, à la place de ses écarts, « Prix baissé de
 * … » : c'est ce qui le ramène, donc ce qui le fait proposer (le panneau dit le reste). Le survol des lignes
 * (`.fil-ligne`) est posé par `MatchingFil` (`FilStyleLignes`), commun aux trois onglets.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import {
  cleSelection, initiales, lignesCriteres, palierScore, premierEcart,
  type FilBien, type FilMatch, type FilSelectionResume, type FilVue,
} from './filModele'
import type { Correction } from './filApprendre'
import { dateCourte, encreAccent, ignorerDoubleClic, prixBien, styleLigne, teinteEcart, texteSignal } from './filAffichage'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  vue: FilVue
  selections: FilSelectionResume[]
  corrections: Correction[]
  courant: string | null
  onChoisir: (id: string) => void
  onReactiver: (id: string) => void
}

export default function FilListe({ sp, vue, selections, corrections, courant, onChoisir, onReactiver }: Props) {
  const { t } = useTranslation('matching')
  const [reportesOuverts, setReportesOuverts] = useState(false)
  const prochainRetour = vue.reportes[0]?.reporteJusquau ?? null
  const titreSection = { margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }
  return (
    <div style={{ padding: 'var(--crm-space-lg)' }}>
      {corrections.length > 0 && (
        <>
          <p style={titreSection}>{t('fil.corrections.section')}</p>
          <div role="listbox" aria-label={t('fil.corrections.listeAria')} style={{ marginBottom: 'var(--crm-space-md)' }}>
            {corrections.map((c) => (
              <LigneCorrection key={c.cle} sp={sp} c={c} active={c.cle === courant} onChoisir={onChoisir} />
            ))}
          </div>
        </>
      )}
      {vue.groupes.length > 0 && (
        <>
          <p style={titreSection}>{t('fil.vosBiens')}</p>
          <div role="listbox" aria-label={t('fil.listeAria')}>
            {vue.groupes.map((g) => (
              <div key={g.bien.id} role="group" aria-label={g.bien.titre} style={{ marginBottom: 'var(--crm-space-md)' }}>
                <EnTeteBien sp={sp} bien={g.bien} nombre={g.matchs.length} />
                {g.matchs.map((m) => <Ligne key={m.id} sp={sp} m={m} active={m.id === courant} onChoisir={onChoisir} />)}
              </div>
            ))}
          </div>
        </>
      )}
      {selections.length > 0 && (
        <>
          <p style={titreSection}>{t('fil.marche')}</p>
          <div role="listbox" aria-label={t('fil.marcheAria')} style={{ marginBottom: 'var(--crm-space-md)' }}>
            {selections.map((s) => (
              <LigneSelection key={s.acheteur.id} sp={sp} s={s} active={cleSelection(s.acheteur.id) === courant} onChoisir={onChoisir} />
            ))}
          </div>
        </>
      )}
      {vue.reportes.length > 0 && prochainRetour && (
        <div style={{ marginTop: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)', borderTop: `1px solid ${sp.cardBorder}` }}>
          <button type="button" aria-expanded={reportesOuverts} onClick={() => setReportesOuverts((v) => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', width: '100%', border: 0, background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', color: sp.sub, textAlign: 'left',
            padding: 'var(--crm-space-sm) var(--crm-space-lg)',
          }}>
            <MEIcon name={reportesOuverts ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
            {t('fil.reportes', { count: vue.reportes.length, date: dateCourte(prochainRetour) })}
          </button>
          {reportesOuverts && vue.reportes.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
              <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={24} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{m.acheteur.prenom} {m.acheteur.nom}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.bien.titre} · {t('fil.deRetour', { date: dateCourte(m.reporteJusquau as string) })}
                </div>
              </div>
              <button type="button" onClick={ignorerDoubleClic(onReactiver)(m.id)} style={{
                border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)',
              }}>
                {t('fil.reactiver')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Une correction de recherche proposée par « Apprendre » : l'acheteur, le motif, le nombre de refus. */
function LigneCorrection({ sp, c, active, onChoisir }: { sp: CrmPalette; c: Correction; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={c.cle}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(c.cle)} onFocus={() => onChoisir(c.cle)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(c.acheteur.prenom, c.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.acheteur.prenom} {c.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {t('fil.corrections.ligne', { motif: t(`fil.motifs.${c.motif}`), count: c.refus.length })}
        </span>
      </span>
    </button>
  )
}

/** La ligne « Marché » d'un acheteur : ses meilleures vignettes, combien de biens attendent, le meilleur score. */
function LigneSelection({ sp, s, active, onChoisir }: { sp: CrmPalette; s: FilSelectionResume; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const cle = cleSelection(s.acheteur.id)
  const vignettes: (string | null)[] = s.vignettes.length > 0 ? s.vignettes.slice(0, 3) : [null]
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(cle)} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
        {vignettes.map((url, i) => (
          <span key={`${i}-${url ?? 'vide'}`} style={{
            display: 'inline-flex', marginLeft: i === 0 ? 0 : 'calc(var(--crm-space-md) * -1)',
            // ⚠ L'anneau détache chaque vignette de la précédente : peint au fond de la colonne, il
            // dessinait un cadre d'une autre teinte sur la ligne choisie ou survolée.
            borderRadius: 'var(--crm-radius-xs)', boxShadow: '0 0 0 2px var(--fil-fond)',
          }}>
            <FilVignette sp={sp} photo={url} largeur={28} hauteur={28} />
          </span>
        ))}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.acheteur.prenom} {s.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.selection.ligne', { count: s.nombre })}</span>
      </span>
      <FilScore sp={sp} score={s.meilleurScore} palier={palierScore(s.meilleurScore)} />
    </button>
  )
}

function EnTeteBien({ sp, bien, nombre }: { sp: CrmPalette; bien: FilBien; nombre: number }) {
  const { t } = useTranslation('matching')
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
      <FilVignette sp={sp} photo={bien.photo} largeur={40} hauteur={30} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bien.titre}
        </div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {prixBien(bien, t)} · {t('fil.acheteurs', { count: nombre })}
        </div>
      </div>
    </div>
  )
}

function Ligne({ sp, m, active, onChoisir }: { sp: CrmPalette; m: FilMatch; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const ecart = premierEcart(lignes)
  const signal = texteSignal(m, t, true)
  const resume = signal ?? (lignes.length === 0 ? t('fil.sansCriteres')
    : ecart ? t('fil.ecartSur', { critere: t(`fil.criteres.${ecart}`) })
      : lignes.some((l) => l.ok === null) ? t('fil.nonEvalues') : t('fil.sansEcart'))
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={m.id}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(m.id)} onFocus={() => onChoisir(m.id)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.acheteur.prenom} {m.acheteur.nom}
        </span>
        {/* ⚠ Le résumé reste à l'encre sourde, l'écart est porté par l'icône : l'ambre en texte tombe
            à 4,29:1 sur la ligne choisie ou survolée, en clair. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {ecart && !signal && (
            <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
              <MEIcon name="alert" size={12} color={teinteEcart(sp)} />
            </span>
          )}
          {resume}
        </span>
      </span>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </button>
  )
}
```

- [ ] **Step 8 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "filAffichage|filAtomes|FilAnnulation|FilEnTete|FilPanneau|FilSelection|FilListe\.tsx" ; echo fin`
Expected : `fin` — sauf dans `MatchingFil.tsx`, qui passe encore `compte` à `FilEnTete` et ne donne pas `corrections` à `FilListe` (Task 15).

Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts`
Expected : PASS (zone `matching-fil` à `{ hors: 0, total: 0 }`).

- [ ] **Step 9 : Point de commit (au signal)** — avec la Task 15.

---

### Task 11 : Les onglets et les listes de la boucle

**Files :**
- Create : `src/components/matching-fil/FilOnglets.tsx`
- Create : `src/components/matching-fil/FilListeBoucle.tsx`

- [ ] **Step 1 : Créer `FilOnglets.tsx`**

```tsx
/**
 * Les trois onglets du fil (conception de la boucle, §5) : « À proposer », « En attente », « À conclure »,
 * chacun avec le compte de ses LIGNES (conception du fil, §3.1). Un match n'est que dans un onglet.
 *
 * ⚠ Un `tablist` à tabindex itinérant : ←/→ passent d'un onglet à l'autre, Tab entre dans la liste. L'onglet
 * ACTIF porte l'accent (CLAUDE.md §3), en filet sous le libellé — l'accent brut tombe sous 3:1 sur sombre.
 */
import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { ONGLETS, type FilOnglet } from './filBoucle'
import { encreAccent } from './filAffichage'

interface Props {
  sp: CrmPalette
  onglet: FilOnglet
  comptes: Record<FilOnglet, number>
  onChoisir: (o: FilOnglet) => void
}

export default function FilOnglets({ sp, onglet, comptes, onChoisir }: Props) {
  const { t } = useTranslation('matching')
  const boutons = useRef<Partial<Record<FilOnglet, HTMLButtonElement | null>>>({})
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = ONGLETS.indexOf(onglet)
    const suivant = ONGLETS[(i + (e.key === 'ArrowRight' ? 1 : ONGLETS.length - 1)) % ONGLETS.length]!
    onChoisir(suivant)
    boutons.current[suivant]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('fil.onglets.aria')} onKeyDown={onKeyDown} style={{
      display: 'flex', gap: 'var(--crm-space-2xl)', padding: '0 var(--crm-space-6xl)', borderBottom: `1px solid ${sp.cardBorder}`,
    }}>
      {ONGLETS.map((o) => {
        const actif = o === onglet
        return (
          <button key={o} ref={(el) => { boutons.current[o] = el }} type="button" role="tab" aria-selected={actif}
            tabIndex={actif ? 0 : -1} onClick={() => onChoisir(o)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: 0,
              border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)',
              fontWeight: actif ? 600 : 500, color: actif ? sp.ink : sp.sub,
              boxShadow: actif ? `inset 0 -2px 0 ${encreAccent(sp)}` : 'none',
            }}>
            {t(`fil.onglets.${o}`)}
            <span style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{comptes[o]}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 : Créer `FilListeBoucle.tsx`**

```tsx
/**
 * Les listes d'« En attente » et d'« À conclure » (conception de la boucle, §5) : une ligne par ACHETEUR en
 * attente de réponse (ses biens proposés, sa relance), une ligne par bien qui INTÉRESSE un acheteur.
 *
 * ⚠ Mêmes lignes que « À proposer » (`styleLigne`, tabindex itinérant, `data-match` pour le focus) : c'est
 * `MatchingFil` qui porte le clavier. Une relance échue le dit, icône d'écart à l'appui ; un bien proposé
 * dont le prix a baissé depuis aussi (§4.6 : « sa ligne d'En attente porte le signal »).
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, type FilMatch } from './filModele'
import { cleAttente, type FilAttente } from './filBoucle'
import { dateCourte, ignorerDoubleClic, styleLigne, teinteEcart, texteSignal } from './filAffichage'
import { FilAvatar } from './filAtomes'

interface Props {
  sp: CrmPalette
  onglet: 'enAttente' | 'aConclure'
  attentes: FilAttente[]
  conclure: FilMatch[]
  courant: string | null
  onChoisir: (cle: string) => void
}

export default function FilListeBoucle({ sp, onglet, attentes, conclure, courant, onChoisir }: Props) {
  const { t } = useTranslation('matching')
  return (
    <div style={{ padding: 'var(--crm-space-lg)' }}>
      <div role="listbox" aria-label={t(onglet === 'enAttente' ? 'fil.attente.listeAria' : 'fil.conclure.listeAria')}>
        {onglet === 'enAttente'
          ? attentes.map((a) => (
            <LigneAttente key={a.acheteur.id} sp={sp} a={a} active={cleAttente(a.acheteur.id) === courant} onChoisir={onChoisir} />
          ))
          : conclure.map((m) => <LigneConclure key={m.id} sp={sp} m={m} active={m.id === courant} onChoisir={onChoisir} />)}
      </div>
    </div>
  )
}

function LigneAttente({ sp, a, active, onChoisir }: { sp: CrmPalette; a: FilAttente; active: boolean; onChoisir: (cle: string) => void }) {
  const { t } = useTranslation('matching')
  const cle = cleAttente(a.acheteur.id)
  const baisse = a.matchs.map((m) => texteSignal(m, t, true)).find((s) => s != null) ?? null
  const resume = [
    t('fil.attente.ligne', { count: a.matchs.length }),
    a.echeance ? t(a.due ? 'fil.attente.relanceDue' : 'fil.attente.relance', { date: dateCourte(a.echeance) }) : null,
    baisse,
  ].filter(Boolean).join(' · ')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(cle)} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(a.acheteur.prenom, a.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.acheteur.prenom} {a.acheteur.nom}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {a.due && (
            <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
              <MEIcon name="alert" size={12} color={teinteEcart(sp)} />
            </span>
          )}
          {resume}
        </span>
      </span>
    </button>
  )
}

function LigneConclure({ sp, m, active, onChoisir }: { sp: CrmPalette; m: FilMatch; active: boolean; onChoisir: (cle: string) => void }) {
  const { t } = useTranslation('matching')
  const repondu = m.suivi?.reponduLe
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={m.id}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(m.id)} onFocus={() => onChoisir(m.id)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.acheteur.prenom} {m.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {repondu ? t('fil.conclure.ligne', { titre: m.bien.titre, date: dateCourte(repondu) }) : m.bien.titre}
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 15.

---

### Task 12 : Les retours — motifs et feuille « Retours de … »

**Files :**
- Create : `src/components/matching-fil/FilMotifs.tsx`
- Create : `src/components/matching-fil/FilRetours.tsx`

- [ ] **Step 1 : Créer `FilMotifs.tsx`**

```tsx
/**
 * Le motif d'un refus, en UNE puce (conception de la boucle, §4.4) : un clic consigne. Les huit motifs portent
 * leur touche (1 à 8) ; Échap referme. La note, facultative, se tape AVANT la puce — d'où sa place, au-dessus :
 * sous les puces, elle se lirait comme la suite d'un geste que la puce a déjà consigné.
 *
 * ⚠ Les touches sont traitées ICI et marquées `preventDefault` : le clavier du fil (`MatchingFil`) les ignore
 * alors. Dans la note, un chiffre reste un chiffre. La première puce prend le focus à l'ouverture : les
 * chiffres répondent aussitôt, et la note est à un Maj+Tab.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { MOTIFS_REFUS, type MotifRefus } from './filBoucle'
import { encreAccent } from './filAffichage'

interface Props {
  sp: CrmPalette
  onChoisir: (motif: MotifRefus, note: string | null) => void
  onAnnuler: () => void
}

const unSeulClic = (faire: () => void) => (e: MouseEvent) => { if (e.detail > 1) return; faire() }

export default function FilMotifs({ sp, onChoisir, onAnnuler }: Props) {
  const { t } = useTranslation('matching')
  const [note, setNote] = useState('')
  const noteId = useId()
  const premier = useRef<HTMLButtonElement>(null)
  // Ouvert par N ou par un clic : la première puce prend le focus, les chiffres et Échap répondent aussitôt.
  useEffect(() => { premier.current?.focus() }, [])
  const choisir = (motif: MotifRefus) => onChoisir(motif, note.trim() || null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onAnnuler(); return }
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
    const rang = Number(e.key)
    const motif = Number.isInteger(rang) ? MOTIFS_REFUS[rang - 1] : undefined
    if (motif) { e.preventDefault(); choisir(motif) }
  }
  return (
    <div role="group" aria-label={t('fil.motifsAide')} onKeyDown={onKeyDown}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.motifsAide')}</span>
      <label htmlFor={noteId} className="sr-only">{t('fil.note')}</label>
      <input id={noteId} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('fil.note')} maxLength={500}
        style={{
          height: 34, border: `1px solid ${sp.cardBorder}`, borderRadius: 'var(--crm-radius-md)', background: sp.cardBg,
          color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
          paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
        }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>
        {MOTIFS_REFUS.map((motif, i) => (
          <button key={motif} ref={i === 0 ? premier : undefined} type="button" onClick={unSeulClic(() => choisir(motif))}
            aria-keyshortcuts={String(i + 1)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 30,
              paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, background: 'transparent', color: sp.ink, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500,
            }}>
            {t(`fil.motifs.${motif}`)}
            <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{i + 1}</kbd>
          </button>
        ))}
      </div>
      <button type="button" onClick={unSeulClic(onAnnuler)} style={{
        alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
      }}>
        {t('fil.annulerMotif')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `FilRetours.tsx`**

```tsx
/**
 * « Retours de … » (conception de la boucle, §4.4) : les biens proposés à un acheteur et pas encore répondus,
 * toutes propositions confondues. Pour chacun, trois gestes : Intéressé (I), Pas intéressé (N, puis un motif
 * en une puce), Pas encore (P).
 *
 * ⚠ Les touches visent le bien qui porte le focus (`data-retour`), sinon le premier : c'est `MatchingFil` qui
 * les lit, comme tout le clavier du fil. « Intéressé » porte `data-bien` : le focus y revient après un geste
 * annulé.
 *
 * ⚠ « Pas encore » n'écrit rien sur le match : la relance de sa proposition est repoussée de trois jours.
 *
 * ⚠ Le titre est le NOM de l'acheteur, comme dans la sélection du marché — pas « Retours de Julie » : le
 * français élide devant une voyelle (« d'Emma »), et une interpolation ne le sait pas.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, palierScore, type FilMatch } from './filModele'
import type { FilAttente, MotifRefus } from './filBoucle'
import { dateCourte, encreAccent, MARGE_POINTS, prixBien, texteSignal } from './filAffichage'
import { FilAvatar, FilBouton, FilScore, FilVignette } from './filAtomes'
import FilMotifs from './FilMotifs'

interface Props {
  sp: CrmPalette
  attente: FilAttente
  /** Le bien dont on choisit le motif de refus, ou `null`. */
  motifsPour: string | null
  onInteresse: (m: FilMatch) => void
  onPasInteresse: (m: FilMatch) => void
  onMotif: (m: FilMatch, motif: MotifRefus, note: string | null) => void
  onFermerMotifs: () => void
  onPasEncore: (m: FilMatch) => void
  onVoirContact: () => void
}

export default function FilRetours({
  sp, attente, motifsPour, onInteresse, onPasInteresse, onMotif, onFermerMotifs, onPasEncore, onVoirContact,
}: Props) {
  const { t } = useTranslation('matching')
  const { acheteur, matchs, echeance, due } = attente
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600,
  }
  const sousTitre = [
    t('fil.retours.sousTitre', { count: matchs.length }),
    echeance ? t(due ? 'fil.attente.relanceDue' : 'fil.attente.relance', { date: dateCourte(echeance) }) : null,
  ].filter(Boolean).join(' · ')
  return (
    <section aria-label={t('fil.retours.titre', { nom: `${acheteur.prenom} ${acheteur.nom}` })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
        <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
        <div style={{ minWidth: 0 }}>
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{sousTitre}</div>
        </div>
      </div>
      <ul aria-label={t('fil.retours.listeAria', { prenom: acheteur.prenom })} style={{
        listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)',
      }}>
        {matchs.map((m) => {
          const ouvert = motifsPour === m.id
          return (
            <li key={m.id} data-retour={m.id} style={{
              display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
              borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg,
              // Le bien dont on choisit le motif est l'élément ACTIF : il porte l'accent (CLAUDE.md §3).
              border: `1px solid ${ouvert ? encreAccent(sp) : sp.cardBorder}`,
            }}>
              <BienPropose sp={sp} m={m} />
              <div role="group" aria-label={m.bien.titre} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
                <FilBouton sp={sp} compact principal touche="I" bien={m.id} onClick={() => onInteresse(m)}>{t('fil.retours.interesse')}</FilBouton>
                <FilBouton sp={sp} compact touche="N" ouvert={ouvert} onClick={() => onPasInteresse(m)}>{t('fil.retours.pasInteresse')}</FilBouton>
                <FilBouton sp={sp} compact touche="P" onClick={() => onPasEncore(m)}>{t('fil.retours.pasEncore')}</FilBouton>
              </div>
              {ouvert && <FilMotifs sp={sp} onChoisir={(motif, note) => onMotif(m, motif, note)} onAnnuler={onFermerMotifs} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function BienPropose({ sp, m }: { sp: CrmPalette; m: FilMatch }) {
  const { t } = useTranslation('matching')
  const signal = texteSignal(m, t)
  const propose = m.suivi?.proposeLe
  const details = [prixBien(m.bien, t), m.bien.ville, propose ? t('fil.retours.proposeLe', { date: dateCourte(propose) }) : null]
    .filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
      <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.bien.titre}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
        {signal && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.ink }}>{signal}</span>}
      </span>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </div>
  )
}
```

- [ ] **Step 3 : Point de commit (au signal)** — avec la Task 15.

---

### Task 13 : « À conclure » — planifier la visite

**Files :** Create `src/components/matching-fil/FilConclure.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
/**
 * « À conclure » (conception de la boucle, §4.5) : un bien qui INTÉRESSE un acheteur, et sa visite à
 * planifier — EN INTERNE : rien n'est envoyé à l'acheteur, ni invitation ni lien (comme l'outil
 * `schedule_visit` du copilote). Le match passe `visit_planned`, le deal avance (`execPlanifierVisite`).
 *
 * ⚠ Deux destinations, un seul geste : un bien EN MANDAT reçoit une visite (`visits`) ; une annonce du
 * MARCHÉ, que l'agence ne détient pas, entre dans l'agenda comme événement « visite » (`calendar_events`).
 * Pas de fenêtre d'annulation : c'est un formulaire validé. V porte le focus sur la date, et « Planifier la
 * visite » de la barre d'annulation (après « Intéressé ») l'y pose d'office (`focusDate`).
 *
 * ⛔ PAS `PlanifierVisite` (fiche d'un bien) : il ne connaît que les biens en mandat, il redemande le
 * visiteur, et son dernier pas prépare un message de confirmation au CLIENT (WhatsApp, e-mail) — ce que le
 * matching ne fait plus (`matching-sans-sortie.spec.ts`). Mêmes durées (30 à 90 minutes).
 *
 * ⚠ L'annonce d'origine s'ouvre par un LIEN (`<a>`), jamais par `window.open` : son adresse vient du
 * portail, et seul un `http(s)` est rendu cliquable.
 *
 * ⚠ L'horloge est FIGÉE à l'ouverture (`ouvertLe`, comme `PlanifierVisite`) : un rendu reste pur, et la date
 * proposée ne bouge pas pendant la saisie.
 *
 * ⚠ « Pas intéressé » (N) reste possible : un intérêt peut retomber, et sans ce geste la ligne n'aurait pas
 * de sortie.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
import type { VisiteAPlanifier } from '@/hooks/useAtelierMatching'
import { initiales, palierScore, type FilMatch } from './filModele'
import type { MotifRefus } from './filBoucle'
import { dateCourte, encreAccent, MARGE_POINTS, prixBien } from './filAffichage'
import { FilAvatar, FilBouton, FilScore, FilVignette } from './filAtomes'
import FilMotifs from './FilMotifs'

interface Props {
  sp: CrmPalette
  m: FilMatch
  motifsOuverts: boolean
  /** Une visite est en cours d'écriture : le bouton se grise. */
  occupe: boolean
  /** La visite vient d'être demandée depuis la barre d'annulation : la date prend le focus. */
  focusDate: boolean
  onPlanifier: (visite: VisiteAPlanifier) => void
  onPasInteresse: () => void
  onMotif: (motif: MotifRefus, note: string | null) => void
  onFermerMotifs: () => void
  onVoirBien: () => void
  onVoirContact: () => void
}

const DUREES = [30, 45, 60, 90]
/** Une date locale `AAAA-MM-JJ` (le format d'un `<input type="date">`). */
const jourIso = (d: Date): string => format(d, 'yyyy-MM-dd')

export default function FilConclure({
  sp, m, motifsOuverts, occupe, focusDate, onPlanifier, onPasInteresse, onMotif, onFermerMotifs, onVoirBien, onVoirContact,
}: Props) {
  const { t } = useTranslation('matching')
  const formId = useId()
  const aideId = useId()
  const dateRef = useRef<HTMLInputElement>(null)
  const [ouvertLe] = useState(() => new Date())
  // Même défaut que `VisitNewPage` : dans deux jours, à 14 h, 45 minutes.
  const [date, setDate] = useState(() => jourIso(addDays(ouvertLe, 2)))
  const [heure, setHeure] = useState('14:00')
  const [duree, setDuree] = useState(45)
  useEffect(() => { if (focusDate) dateRef.current?.focus() }, [focusDate])
  const { bien, acheteur } = m
  const debut = date && heure ? new Date(`${date}T${heure}:00`) : null
  const valide = debut != null && Number.isFinite(debut.getTime()) && debut.getTime() > ouvertLe.getTime()
  const repondu = m.suivi?.reponduLe
  const lienAnnonce = bien.marche?.sourceUrl && /^https?:\/\//i.test(bien.marche.sourceUrl) ? bien.marche.sourceUrl : null
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp), textDecoration: 'none',
  }
  const champ: CSSProperties = {
    height: 36, border: `1px solid ${sp.cardBorder}`, borderRadius: 'var(--crm-radius-md)', background: sp.cardBg, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
    colorScheme: sp.isDark ? 'dark' : 'light',
  }
  const libelle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }
  const soumettre = () => {
    if (!valide || occupe || !debut) return
    onPlanifier({ debut: debut.toISOString(), dureeMinutes: duree, lieu: [bien.adresse, bien.ville].filter(Boolean).join(', ') || null })
  }
  return (
    <section aria-label={t('fil.conclure.titreAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)' }}>
          <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
            }}>
              {t(bien.marche ? 'fil.selection.marche' : 'fil.votreBien')}
            </span>
            <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            {bien.marche
              ? lienAnnonce && (
                <a href={lienAnnonce} target="_blank" rel="noopener noreferrer" style={{ ...lien, display: 'inline-block', marginTop: 'var(--crm-space-sm)' }}>
                  {t('fil.conclure.voirAnnonce')}
                </a>
              )
              : <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>}
          </div>
          <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} grand />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            {repondu && <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.conclure.interesseLe', { date: dateCourte(repondu) })}</div>}
          </div>
        </div>

        <form id={formId} onSubmit={(e) => { e.preventDefault(); soumettre() }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t('fil.conclure.planifier')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
            <label style={libelle}>
              {t('fil.conclure.date')}
              <input ref={dateRef} type="date" data-visite-date value={date} min={jourIso(ouvertLe)} onChange={(e) => setDate(e.target.value)}
                aria-describedby={aideId} aria-keyshortcuts="V" style={champ} />
            </label>
            <label style={libelle}>
              {t('fil.conclure.heure')}
              <input type="time" value={heure} step={900} onChange={(e) => setHeure(e.target.value)} style={champ} />
            </label>
            <label style={libelle}>
              {t('fil.conclure.duree')}
              <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} style={{ ...champ, cursor: 'pointer' }}>
                {DUREES.map((n) => <option key={n} value={n}>{t('fil.conclure.minutes', { n })}</option>)}
              </select>
            </label>
          </div>
          <p id={aideId} style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            {valide
              ? t(bien.marche ? 'fil.conclure.agenceAnnonce' : 'fil.conclure.aucuneInvitation', { prenom: acheteur.prenom })
              : t('fil.conclure.dateRequise')}
          </p>
        </form>

        {motifsOuverts && <FilMotifs sp={sp} onChoisir={onMotif} onAnnuler={onFermerMotifs} />}
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} touche="N" ouvert={motifsOuverts} onClick={onPasInteresse}>{t('fil.retours.pasInteresse')}</FilBouton>
        <span style={{ flex: 1 }} />
        <button type="submit" form={formId} disabled={!valide || occupe} aria-describedby={aideId} style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
          paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
          border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
          background: sp.accent, color: sp.accentInk, opacity: !valide || occupe ? 0.5 : 1,
          cursor: !valide || occupe ? 'not-allowed' : 'pointer',
        }}>
          {t('fil.conclure.confirmer')}
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2 : Point de commit (au signal)** — avec la Task 15.

---

### Task 14 : « Apprendre » à l'écran — la correction de recherche

**Files :** Create `src/components/matching-fil/FilCorrection.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
/**
 * « Apprendre » (conception de la boucle, §4.6) : au deuxième refus pour un même motif, la correction
 * CHIFFRÉE de la recherche de l'acheteur. L'agent la valide en un geste, la modifie d'abord (budget,
 * surface, pièces : un nombre pré-rempli), ou l'ignore.
 *
 * ⚠ Valider renote les biens à proposer de CETTE recherche par le vrai moteur (`matching-engine`, mode
 * `rescore-search`) : ceux qui passent sous le seuil sortent du fil, écartés « recherche ajustée ». Pas de
 * fenêtre d'annulation — un bouton, jamais une touche.
 *
 * ⚠ Les biens refusés sont montrés au prix où ils ont été PROPOSÉS : c'est à ce prix que l'acheteur a dit non.
 */
import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { formatCHF } from '@/lib/utils'
import type { SearchCriteria } from '@/types/contact'
import { cleEquipement, initiales, lignesCriteres } from './filModele'
import {
  criteresCorriges, estNumerique, type ChangementNumerique, type Correction, type CorrectionChangement,
} from './filApprendre'
import { dateCourte, MARGE_POINTS, montant, teinteEcart } from './filAffichage'
import { FilAvatar, FilBouton, FilVignette } from './filAtomes'
import { resumeRecherche } from './filValeurs'

interface Props {
  sp: CrmPalette
  correction: Correction
  /** La correction part : les deux gestes se grisent. */
  occupe: boolean
  onAjuster: (criteres: SearchCriteria) => void
  onIgnorer: () => void
  onVoirContact: () => void
}

export default function FilCorrection({ sp, correction: c, occupe, onAjuster, onIgnorer, onVoirContact }: Props) {
  const { t, i18n } = useTranslation('matching')
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const champId = useId()
  const aideId = useId()
  const ch = c.changement
  // Pré-rempli comme on le lit : « 1'550'000 » (l'apostrophe de `formatCHF`, sans l'unité), « 4.5 ».
  const [saisie, setSaisie] = useState(() => (!estNumerique(ch) ? ''
    : ch.cle === 'rooms_min' ? String(ch.apres) : formatCHF(ch.apres).replace(/^CHF /, '')))
  // « 1'550'000 », « 1 550 000 » ou « 4,5 » se lisent : l'agent tape comme il lit.
  const valeur = Number(saisie.replace(/['’\s]/g, '').replace(',', '.'))
  const valide = !estNumerique(ch) || (Number.isFinite(valeur) && valeur > 0)
  const changement: CorrectionChangement = estNumerique(ch) && valide ? { ...ch, apres: valeur } : ch
  const { acheteur } = c
  const reference = c.refus[0]
  const nomType = (type: string): string => t(`fil.types.${type}`, { defaultValue: type })
  // Même libellé que la grille « Recherché / Ce bien » (`valeursCritere`) : sans le préfixe `custom:`.
  const nomEquipement = (f: string): string =>
    t(`fil.equipementsNoms.${cleEquipement(f)}`, { defaultValue: f.replace(/^custom:/i, '') })
  const avant = (n: ChangementNumerique): string => {
    const v = n.avant
    if (v == null) return t(n.cle === 'budget_max' ? 'fil.corrections.sansMax' : 'fil.corrections.sansMin')
    const valeur = n.cle === 'budget_max' ? montant(n.location, v, t)
      : n.cle === 'surface_min' ? t('fil.valeurs.m2', { valeur: nombre(v) })
        : nombre(v)
    return t('fil.corrections.avant', { valeur })
  }
  const lien: CSSProperties = { border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600 }
  const titre: CSSProperties = { margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }
  const texte: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-md)', color: sp.ink }
  const aide: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }
  return (
    <section aria-label={t('fil.corrections.titreAria', { nom: `${acheteur.prenom} ${acheteur.nom}` })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
              {t('fil.corrections.sousTitre', { count: c.refus.length, motif: t(`fil.motifs.${c.motif}`) })}
            </div>
          </div>
        </div>
        {reference && lignesCriteres(reference).length > 0 && (
          <p style={aide}>{t('fil.selection.recherche', { resume: resumeRecherche(reference, t, nombre) })}</p>
        )}

        <div>
          <h3 style={titre}>{t('fil.corrections.pourquoi')}</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            {c.refus.map((m) => {
              const prix = m.suivi?.prixPropose ?? m.bien.prix
              const refuse = m.suivi?.reponduLe
              const details = [
                prix != null ? montant(m.bien.location, prix, t) : null,
                m.bien.pieces != null ? t('fil.selection.pieces', { count: m.bien.pieces, valeur: nombre(m.bien.pieces) }) : null,
                m.bien.surface != null ? t('fil.valeurs.m2', { valeur: nombre(m.bien.surface) }) : null,
                m.bien.ville,
                refuse ? t('fil.corrections.refuseLe', { date: dateCourte(refuse) }) : null,
              ].filter(Boolean).join(' · ')
              return (
                <li key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
                  borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
                }}>
                  <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.bien.titre}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
                    {m.suivi?.note && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontStyle: 'italic', color: sp.ink }}>{m.suivi.note}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <h3 style={titre}>{t('fil.corrections.proposition')}</h3>
          {estNumerique(ch) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
              <label htmlFor={champId} style={texte}>
                {t(ch.cle === 'budget_max' ? 'fil.corrections.budget' : ch.cle === 'surface_min' ? 'fil.corrections.surface' : 'fil.corrections.pieces')}
              </label>
              <input id={champId} inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)}
                aria-invalid={!valide} aria-describedby={aideId} style={{
                  width: 200, height: 36, border: `1px solid ${valide ? sp.cardBorder : teinteEcart(sp)}`,
                  borderRadius: 'var(--crm-radius-md)', background: sp.cardBg, color: sp.ink, fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-md)', paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
                }} />
              <span id={aideId} style={aide}>{valide ? avant(ch) : t('fil.corrections.valeurInvalide')}</span>
            </div>
          ) : ch.cle === 'zones' ? (
            <>
              <p style={texte}>{t('fil.corrections.zones', { liste: ch.retirees.join(', ') })}</p>
              <p style={aide}>{t('fil.corrections.zonesApres', { liste: ch.apres.join(', ') })}</p>
            </>
          ) : ch.cle === 'type' ? (
            <>
              <p style={texte}>{t('fil.corrections.type', { type: nomType(ch.apres) })}</p>
              <p style={aide}>{ch.avant ? t('fil.corrections.typeAvant', { type: nomType(ch.avant) }) : t('fil.corrections.tousTypes')}</p>
            </>
          ) : (
            <p style={texte}>{t('fil.corrections.equipements', { liste: ch.ajoutes.map(nomEquipement).join(', ') })}</p>
          )}
          <p style={aide}>{t('fil.corrections.effet')}</p>
        </div>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} onClick={onIgnorer} desactive={occupe}>{t('fil.corrections.ignorer')}</FilBouton>
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} principal onClick={() => onAjuster(criteresCorriges(c.criteres, changement))} desactive={!valide || occupe}>
          {t('fil.corrections.valider')}
        </FilBouton>
      </div>
    </section>
  )
}
```

- [ ] **Step 2 : Point de commit (au signal)** — avec la Task 15.

---

### Task 15 : Le conteneur — onglets, gestes de la boucle, clavier

**Files :** Modify `src/components/matching-fil/MatchingFil.tsx`

Ce qui change, pour la relecture : l'onglet rangé dans l'onglet du CRM (`fil.onglet`, relu par `ongletValide`) ; les comptes par onglet ; l'ordre de lecture et le panneau selon l'onglet (correction, sélection, match ; retours ; visite) ; `differer` généralisé (`OptionsGeste` : la ligne qui sort, ce qu'on rend, la suite « Planifier la visite ») ; les gestes `repondre`, `pasEncore`, `planifier`, `ajuster`, `ignorer` ; l'annonce d'une correction nouvelle ; au clavier, I / N / P sur le bien qui a le focus dans « Retours de … », V / N dans « À conclure », aucune touche pour une correction ; ↑/↓ entre les CASES d'une sélection seulement (« Intéressé » porte aussi `data-bien`). Le reste — pivot d'arrivée, cases figées, reprise du focus, masques — est inchangé.

- [ ] **Step 1 : Remplacer `MatchingFil.tsx`**

Relire le fichier avant de le remplacer : un paragraphe d'en-tête ou un commentaire « pourquoi » absent du bloc ci-dessous se reporte, et se signale. Remplacer INTÉGRALEMENT `src/components/matching-fil/MatchingFil.tsx` par :

```tsx
/**
 * Matching — le FIL DE MATCHS (refonte de la page 0 du pager : lots 1 et 2, puis la boucle, lot B).
 *
 * Conceptions : `docs/superpowers/specs/2026-09-17-matching-fil-design.md` et, pour la boucle,
 * `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`. Il remplacera l'atelier
 * (`MatchingAtelierPage`) au lot E ; d'ici là il ne vit que sur le banc `/dev/crm`.
 *
 * Ce conteneur porte les données (`useMatchingFil`, `useSelectionMarche`), l'onglet, les filtres, la
 * sélection, les gestes, et le CLAVIER du fil entier.
 *
 * ⚠ TROIS ONGLETS, un par temps de la boucle (§5) : « À proposer » (les recherches à ajuster, les biens en
 * mandat, une ligne « Marché » par acheteur), « En attente » (une ligne par acheteur ; le panneau est la
 * feuille « Retours de … »), « À conclure » (une ligne par bien qui intéresse ; le panneau planifie la
 * visite). L'onglet est rangé dans l'ONGLET du CRM, comme les filtres ; la sélection reste locale.
 *
 * ⚠ Le clavier est posé sur la RACINE du fil (`onKeyDown`), pas sur `window` : le fil est la page 0
 * d'un pager dont la page 1 reste montée, et plusieurs écrans d'onglet restent vivants. Un écouteur
 * global agirait depuis une page ou un onglet qu'on ne regarde pas ; celui-ci n'entend que ce qui a
 * le focus dedans. D'où, après chaque geste, le focus rendu à une ligne (ou à la racine).
 *
 * ⚠ Les gestes qui font SORTIR un match passent par la fenêtre d'annulation (`PendingRegistry`) : « Je
 * l'ai proposé », Plus tard, Écarter, Intéressé, Pas intéressé. Ils consignent ce que l'agent a fait
 * lui-même — rien ne part vers l'acheteur (décision du 21.09.2026) —, donc ils s'annulent. « Pas encore »,
 * « Planifier la visite » et les deux gestes d'une correction écrivent tout de suite : le premier ne fait
 * rien sortir, les autres sont des formulaires validés.
 *
 * ⚠ Un match qu'un geste fait sortir est MASQUÉ localement (`masques`) jusqu'à ce que les données le
 * reflètent : la valeur est `null` tant que l'écriture n'a pas fini, puis l'heure où elle a fini. Une
 * lecture COMMENCÉE après cette heure fait foi — un reporté reparaît sous « Reportés », un match
 * encore à traiter reparaît à sa place. Sans cette levée, un reporté restait caché jusqu'au
 * rechargement. Une correction validée ou ignorée sort de même : ce sont ses refus qui sont masqués.
 *
 * ⚠ Lot 2 : une ligne « Marché » par acheteur (`cleSelection`) suit les biens en mandat dans l'ordre de
 * lecture. Choisie, elle charge ses biens et montre la sélection à droite ; `E` y consigne les biens
 * cochés comme proposés, en UN geste. `P` et `X` n'y font rien : ils visent UN match, et la ligne en
 * porte plusieurs. Un « Écarter » dans la sélection ne déplace pas la sélection du fil : le focus passe à la
 * case du bien voisin.
 *
 * ⚠ Les cases cochées d'office sont FIGÉES par acheteur (`coches`), et le focus perdu sous un élément
 * démonté revient à la ligne courante (`reprendreFocus`) : voir les deux blocs plus bas.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execRepondre, execSnooze, execWake,
  type CorrectionGeste, type GesteContext, type ReponseAcheteur, type VisiteAPlanifier,
} from '@/hooks/useAtelierMatching'
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
import { PAS_SELECTION, useSelectionMarche } from '@/hooks/useSelectionMarche'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/components/matching-atelier/pendingTriage'
import type { SearchCriteria } from '@/types/contact'
import {
  cleSelection, construireFil, construireSelections, contactDeSelection, optionsFiltres, precoches,
  type FilFiltres, type FilMatch,
} from './filModele'
import { cleAttente, construireAConclure, construireAttente, ongletValide, type FilOnglet } from './filBoucle'
import { construireCorrections, filtrerCorrections, type Correction } from './filApprendre'
import { FilStyleLignes } from './filAtomes'
import FilAnnulation from './FilAnnulation'
import FilConclure from './FilConclure'
import FilCorrection from './FilCorrection'
import FilEnTete from './FilEnTete'
import FilListe from './FilListe'
import FilListeBoucle from './FilListeBoucle'
import FilOnglets from './FilOnglets'
import FilPanneau from './FilPanneau'
import FilRetours from './FilRetours'
import FilSelection from './FilSelection'

const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const COLONNES = 'minmax(300px, 380px) minmax(0, 1fr)'
const nomComplet = (m: FilMatch): string => `${m.acheteur.prenom} ${m.acheteur.nom}`

/** L'état vide des deux onglets de la boucle ; « À proposer » garde le sien, et ses deux chemins. */
const VIDE_BOUCLE = {
  enAttente: { titre: 'fil.vide.attenteTitre', texte: 'fil.vide.attenteTexte' },
  aConclure: { titre: 'fil.vide.conclureTitre', texte: 'fil.vide.conclureTexte' },
} as const

/** Ce qu'un geste différé fait d'autre que masquer ses matchs. */
interface OptionsGeste {
  /**
   * La LIGNE du fil qu'il fait sortir — par défaut, celle du premier match. `null` : aucune ; un bien d'une
   * sélection du marché ou de « Retours de … » n'est pas une ligne, et la sélection du fil ne bouge pas.
   */
  ligneQuiSort?: string | null
  /** Défait, sur un échec ou une annulation, ce qu'il a retiré d'autre (les cases cochées d'une sélection). */
  rendre?: () => void
  /** Un second geste offert par la barre : l'écriture part tout de suite, puis `apres`, les données relues. */
  suite?: { libelle: string; apres: () => void }
}

interface BarreAnnulation { id: string; texte: string; annuler: () => void; action?: { libelle: string; faire: () => void } }

/** Un match masqué par un geste redevient visible quand une lecture COMMENCÉE après l'écriture le dit. */
function visibleSelon(masques: ReadonlyMap<string, number | null>, id: string, chargeLe: number): boolean {
  const fin = masques.get(id)
  // ⚠ `>=` et non `>` : `rafraichir` lance la lecture dans le même tour que la fin de l'écriture, donc
  // souvent dans la même milliseconde. Une lecture partie AVANT est annulée par cette invalidation.
  return fin === undefined || (fin !== null && chargeLe >= fin)
}

/** Ce que les deux gestes d'une correction lisent d'elle. */
const versCorrectionGeste = (c: Correction): CorrectionGeste => ({
  contactId: c.acheteur.id, rechercheId: c.rechercheId, motif: c.motif, refusIds: c.refus.map((m) => m.id),
})

export default function MatchingFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche?: () => void }) {
  const { t } = useTranslation('matching')
  const sp = crmPalette(dark)
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const {
    isLoading, isError, aDesDonnees, erreurLe, matchs, selections, boucle, relances, historique, chargeLe, rafraichir,
  } = useMatchingFil()

  // Les liens entrants de l'atelier gardent leur sens (§3.4) : `?contact=` filtre sur l'acheteur,
  // `?annonce=p:<uuid>` sur le bien. Lus une fois, à l'arrivée.
  const [filtresArrivee] = useState<FilFiltres | null>(() => {
    const annonce = params.get('annonce')
    const contact = params.get('contact')
    if (!annonce && !contact) return null
    return { bienId: annonce?.startsWith('p:') ? annonce.slice(2) : null, acheteurId: contact, texte: '' }
  })
  // Les filtres sont rangés dans l'ONGLET : ils survivent à un aller-retour entre onglets. La
  // sélection, elle, reste LOCALE (§2 des retours de revue) — la ranger dans l'onglet écrivait sur
  // le serveur à CHAQUE flèche du clavier, pour une position qui n'a jamais eu besoin de survivre.
  // Même règle pour les cases cochées et le pas de chargement d'une sélection du marché (lot 2).
  const [filtresRetenus, setFiltres] = useTabScopedState<FilFiltres>('fil.filtres', filtresArrivee ?? SANS_FILTRE)
  // L'onglet aussi (lot B) : ce qu'on y relit peut venir d'un schéma antérieur, d'où `ongletValide`.
  const [ongletRetenu, setOngletRetenu] = useTabScopedState<FilOnglet>('fil.onglet', 'aProposer')
  const onglet = ongletValide(ongletRetenu)
  const [choix, setChoix] = useState<string | null>(null)
  // ⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus — même règle et même
  // mécanique que le pivot du pager (`MatchingPage`) : lu au rendu, écrit dans un effet.
  const [pivotConsomme, setPivotConsomme] = useState(filtresArrivee == null)
  const filtres = pivotConsomme || !filtresArrivee ? filtresRetenus : filtresArrivee
  // ⛔ TANT QUE LA PILE D'ONGLETS CHARGE, ON N'ÉCRIT PAS. L'hydratation de `CrmTabsProvider` REMPLACE
  // la tranche de l'onglet une fois la pile serveur arrivée (`reconcilier`) : un pivot consommé avant
  // cette arrivée écrivait dans un onglet qui n'existait pas encore, et l'hydratation l'effaçait
  // aussitôt — le lien d'arrivée perdait son filtre sur un chargement à froid.
  const chargementOnglets = useCrmTabsOptionnel()?.chargement ?? false
  useEffect(() => {
    if (pivotConsomme || !filtresArrivee || chargementOnglets) return
    setFiltres(filtresArrivee)
    setPivotConsomme(true)
  }, [pivotConsomme, filtresArrivee, setFiltres, chargementOnglets])

  const [masques, setMasques] = useState<ReadonlyMap<string, number | null>>(() => new Map())
  const [coches, setCoches] = useState<Readonly<Record<string, readonly string[]>>>({})
  const [limites, setLimites] = useState<Readonly<Record<string, number>>>({})
  const [annulation, setAnnulation] = useState<BarreAnnulation | null>(null)
  /** Le bien dont on choisit le motif de refus (« Retours de … », « À conclure »). */
  const [motifsPour, setMotifsPour] = useState<string | null>(null)
  /** Le bien dont la visite vient d'être demandée depuis la barre d'annulation : sa date prend le focus. */
  const [visitePour, setVisitePour] = useState<string | null>(null)
  /** Une visite ou une correction s'écrit : leurs boutons se grisent. */
  const [occupe, setOccupe] = useState(false)
  const [registre] = useState(() => new PendingRegistry())
  const racine = useRef<HTMLDivElement>(null)
  const reveils = useRef(new Set<string>())
  /** « Pas encore » en vol, par match : un second appui ne repousse pas la relance deux fois. */
  const reports = useRef(new Set<string>())

  // L'agent n'a pas annulé : ce qui attend part quand le fil se ferme.
  useEffect(() => () => registre.flushAll(), [registre])

  const ctx = useMemo<GesteContext | null>(() => (profile?.agency_id
    ? { agencyId: profile.agency_id, userId: profile.id ?? user?.id ?? '' }
    : null), [profile, user])

  const visibles = useMemo(() => matchs.filter((m) => visibleSelon(masques, m.id, chargeLe)), [matchs, masques, chargeLe])
  const visiblesBoucle = useMemo(() => boucle.filter((m) => visibleSelon(masques, m.id, chargeLe)), [boucle, masques, chargeLe])
  // Les acheteurs de la boucle comptent aussi, même sans rien à proposer ; le filtre Bien ne vise que les
  // biens en mandat (`optionsFiltres`).
  const options = useMemo(() => optionsFiltres(
    [...matchs, ...boucle.filter((m) => !m.bien.marche)], selections, boucle.filter((m) => m.bien.marche).map((m) => m.acheteur),
  ), [matchs, boucle, selections])
  // ⚠ CE QUE L'ONGLET RESTITUE PEUT ÊTRE PÉRIMÉ OU MALFORMÉ : un schéma antérieur, une écriture
  // interrompue. `texte` redevient une chaîne, `bienId`/`acheteurId` une chaîne ou `null` — mais un id
  // qui ne correspond plus à AUCUN match connu (bien vendu, acheteur supprimé, ou son SEUL match
  // proposé à l'instant) N'EST PAS effacé : un filtre qu'on efface tout seul rouvre le fil à tout le
  // monde sans le dire. `construireFil` ne trouve alors rien, et c'est l'état « Rien ne correspond à
  // ces filtres » qui doit paraître — jamais la liste entière.
  const filtresValides = useMemo<FilFiltres>(() => ({
    texte: typeof filtres.texte === 'string' ? filtres.texte : '',
    bienId: typeof filtres.bienId === 'string' ? filtres.bienId : null,
    acheteurId: typeof filtres.acheteurId === 'string' ? filtres.acheteurId : null,
  }), [filtres])
  const vue = useMemo(() => construireFil(visibles, filtresValides, chargeLe), [visibles, filtresValides, chargeLe])
  const selectionsVues = useMemo(() => construireSelections(selections, filtresValides), [selections, filtresValides])
  const toutesCorrections = useMemo(() => construireCorrections(visiblesBoucle), [visiblesBoucle])
  const corrections = useMemo(() => filtrerCorrections(toutesCorrections, filtresValides), [toutesCorrections, filtresValides])
  const attentes = useMemo(
    () => construireAttente(visiblesBoucle, relances, filtresValides, chargeLe),
    [visiblesBoucle, relances, filtresValides, chargeLe],
  )
  const conclure = useMemo(() => construireAConclure(visiblesBoucle, filtresValides), [visiblesBoucle, filtresValides])
  // Le compte d'un onglet est celui de ses LIGNES (conception du fil, §3.1).
  const comptes: Record<FilOnglet, number> = {
    aProposer: corrections.length + vue.compte + selectionsVues.length,
    enAttente: attentes.length,
    aConclure: conclure.length,
  }
  const ordre = useMemo(() => (
    onglet === 'enAttente' ? attentes.map((a) => cleAttente(a.acheteur.id))
      : onglet === 'aConclure' ? conclure.map((m) => m.id)
        : [...corrections.map((c) => c.cle), ...vue.ordre, ...selectionsVues.map((s) => cleSelection(s.acheteur.id))]
  ), [onglet, attentes, conclure, corrections, vue.ordre, selectionsVues])
  const filtreActif = Boolean(filtresValides.bienId || filtresValides.acheteurId || filtresValides.texte)
  // Sélection DÉRIVÉE : une ligne qui sort du fil (geste, filtre, onglet) cède la place à la première restante.
  const courant = choix && ordre.includes(choix) ? choix : (ordre[0] ?? null)
  // Le panneau de la ligne courante : une seule de ces valeurs est posée.
  const correction = onglet === 'aProposer' && courant ? corrections.find((c) => c.cle === courant) ?? null : null
  const contactSelection = onglet === 'aProposer' && courant ? contactDeSelection(courant) : null
  const match = onglet === 'aProposer' && courant && !contactSelection && !correction
    ? visibles.find((m) => m.id === courant) ?? null : null
  const resumeSelection = contactSelection ? selectionsVues.find((s) => s.acheteur.id === contactSelection) ?? null : null
  const attente = onglet === 'enAttente' && courant ? attentes.find((a) => cleAttente(a.acheteur.id) === courant) ?? null : null
  const aConclure = onglet === 'aConclure' && courant ? conclure.find((m) => m.id === courant) ?? null : null

  const limite = contactSelection ? (limites[contactSelection] ?? PAS_SELECTION) : PAS_SELECTION
  const selection = useSelectionMarche(contactSelection, limite)
  const matchsSelection = useMemo(
    // ⛔ En défense : jamais le bien d'un autre acheteur sous le nom de celui-ci (`useSelectionMarche`
    // ne garde déjà ses données provisoires que pour le même acheteur).
    () => selection.matchs.filter((m) => m.acheteur.id === contactSelection && visibleSelon(masques, m.id, selection.chargeLe)),
    [selection.matchs, selection.chargeLe, masques, contactSelection],
  )
  // ⚠ LES CASES COCHÉES D'OFFICE SONT FIGÉES : calculées UNE fois par acheteur, sur sa première lecture
  // RÉELLE — ni pendant le squelette, ni sur les données provisoires d'un « Voir plus » —, rangées dans
  // `coches` et jamais recalculées. Recalculées à chaque rendu, elles recochaient ce que l'agent venait
  // de décocher dès que la liste bougeait, cochaient un bien arrivé par « Voir 20 de plus », et
  // recochaient tout après une proposition. Posées PENDANT LE RENDU (l'ajustement d'état que React documente),
  // gardées par `coches[…] === undefined` donc une seule fois : un effet les poserait un rendu trop tard
  // — la liste paraîtrait un instant sans ses cases —, et `react-hooks/set-state-in-effect` le refuse.
  // ⚠ Figées aussi sur un CACHE : revenu à un acheteur après un remontage du fil, `coches` est vide et
  // la « première lecture réelle » peut être la liste gardée par TanStack (jusqu'à `gcTime`), relue
  // avant son actualisation. Assumé : un bien disparu depuis est filtré par `cochesSelection`, et un
  // bien devenu éligible entre-temps n'est simplement pas coché — jamais coché à tort.
  if (contactSelection && coches[contactSelection] === undefined
    && !selection.isLoading && !selection.isPlaceholderData && selection.aDesDonnees) {
    setCoches((c) => (c[contactSelection] !== undefined ? c : { ...c, [contactSelection]: precoches(matchsSelection) }))
  }
  const cochesSelection = useMemo(() => {
    if (!contactSelection) return []
    return (coches[contactSelection] ?? []).filter((id) => matchsSelection.some((m) => m.id === id))
  }, [contactSelection, coches, matchsSelection])

  // Lus APRÈS un `await` ou un minuteur, où la valeur du rendu qui a créé la fonction serait périmée.
  // Posés dans un effet : une ref écrite pendant le rendu est refusée par `react-hooks/refs`.
  const ordreRef = useRef(ordre)
  const courantRef = useRef(courant)
  useLayoutEffect(() => {
    ordreRef.current = ordre
    courantRef.current = courant
  })

  const focaliser = useCallback((id: string | null) => {
    const ligne = id ? racine.current?.querySelector<HTMLElement>(`[data-match="${CSS.escape(id)}"]`) : null
    if (ligne) ligne.focus()
    else racine.current?.focus()
  }, [])
  /** L'élément d'un bien dans le panneau (case d'une sélection, « Intéressé » d'un retour) ; `false` s'il n'est pas (ou plus) à l'écran. */
  const focaliserBien = useCallback((id: string): boolean => {
    const element = racine.current?.querySelector<HTMLElement>(`[data-bien="${CSS.escape(id)}"]`)
    element?.focus()
    return element != null
  }, [])

  // ⛔ LE CLAVIER DU FIL VIT SUR SA RACINE : un focus retombé sur `<body>` le rend sourd. Or une ligne ou
  // une case peut être démontée SOUS le focus — la ligne « Marché » qu'une proposition complète retire, un
  // bien qu'une actualisation fait sortir —, et aucun navigateur ne rend alors le focus (Chrome émet un
  // `blur`, sur un élément encore attaché ; Firefox rien). D'où le dernier élément focalisé DANS le fil, relu
  // après chaque rendu et à chaque sortie : démonté sous un focus perdu, la ligne courante le reprend ;
  // encore attaché et actif, c'est l'agent qui est allé ailleurs, et on l'oublie — sans quoi un démontage
  // plus tardif ramènerait le focus dans un fil qu'il a quitté.
  // ⚠ Le fil ne porte plus rien dans `<body>` depuis le retrait de sa feuille d'envoi (21.09.2026) : tout
  // `focus` et `blur` qui remonte ici vient de son DOM. Une portée ajoutée demain ferait remonter par
  // l'arbre React les siens, et devrait les filtrer (`racine.contains`).
  const dernierFocus = useRef<HTMLElement | null>(null)
  const reprendreFocus = useCallback(() => {
    const el = dernierFocus.current
    const boite = racine.current
    if (!el || !boite) return
    const actif = document.activeElement
    if (actif && boite.contains(actif)) return
    dernierFocus.current = null
    // Démonté, ou désactivé sous le focus (un navigateur peut alors le rendre à `<body>`).
    const perdu = !el.isConnected || el.matches(':disabled')
    if (perdu && (actif == null || actif === document.body)) focaliser(courantRef.current)
  }, [focaliser])
  // Après `courantRef` (effet déclaré plus haut, donc joué avant) : la ligne courante est celle de CE rendu.
  useLayoutEffect(() => { reprendreFocus() })

  const montrer = useCallback((ids: readonly string[]) => {
    setMasques((s) => {
      if (!ids.some((id) => s.has(id))) return s
      const n = new Map(s)
      for (const id of ids) n.delete(id)
      return n
    })
  }, [])

  /** Une ligne sort du fil : la sélection passe à la suivante, ou à la précédente si c'était la dernière. */
  const ceder = useCallback((id: string): string | null => {
    const liste = ordreRef.current
    const i = liste.indexOf(id)
    const suivant = liste[i + 1] ?? liste[i - 1] ?? null
    setChoix(suivant)
    return suivant
  }, [])

  /**
   * Un geste différé sur un ou plusieurs matchs : ils sortent tout de suite, l'écriture part à la fin de la
   * fenêtre d'annulation. Plusieurs matchs : les biens cochés d'une sélection, proposés en UN geste — une
   * seule écriture, une seule annulation pour tous.
   */
  const differer = useCallback((
    ms: readonly FilMatch[], texte: string, ecrire: (c: GesteContext) => Promise<unknown>, options: OptionsGeste = {},
  ) => {
    const premier = ms[0]
    if (!ctx || !premier) return
    const ids = ms.map((m) => m.id)
    const ligne = options.ligneQuiSort === undefined ? premier.id : options.ligneQuiSort
    if (ligne) focaliser(ceder(ligne))
    setMasques((s) => { const n = new Map(s); for (const id of ids) n.set(id, null); return n })
    // `flushNow` rend `null` après un échec comme après une réussite : la suite lit ce drapeau.
    let ecrit = false
    const poignee = registre.defer(async () => { await ecrire(ctx); ecrit = true; return null }, {
      onSettled: () => {
        // Après un échec, `onError` a déjà rendu les matchs : rien à dater.
        const fin = Date.now()
        setMasques((s) => {
          if (!ids.some((id) => s.has(id))) return s
          const n = new Map(s)
          for (const id of ids) if (n.has(id)) n.set(id, fin)
          return n
        })
        void rafraichir()
      },
      // Le geste n'a pas eu lieu : les biens reviennent comme ils étaient, cases comprises.
      onError: () => { montrer(ids); options.rendre?.(); toast.error(t('fil.erreurGeste')) },
    })
    const { suite } = options
    setAnnulation({
      id: premier.id,
      texte,
      action: suite && {
        libelle: suite.libelle,
        faire: () => {
          setAnnulation(null)
          // L'écriture part tout de suite ; un échec a déjà été dit (`onError`), et rien ne suit.
          void poignee.flushNow().then(() => (ecrit ? rafraichir().then(suite.apres) : undefined))
        },
      },
      annuler: () => {
        poignee.cancel()
        montrer(ids)
        setAnnulation(null)
        options.rendre?.()
        if (ligne) setChoix(ligne)
        // Le bien (sa case, son bouton) ou la ligne revient au rendu suivant : le focus le suit après lui.
        setTimeout(() => { if (!focaliserBien(premier.id)) focaliser(ligne ?? courantRef.current) }, 0)
      },
    })
  }, [ctx, ceder, registre, rafraichir, montrer, focaliser, focaliserBien, toast, t])

  // « Annuler » disparaît AVANT que l'écriture parte : passé ce délai, il n'annulerait plus rien.
  useEffect(() => {
    if (!annulation) return
    const minuteur = setTimeout(() => setAnnulation((e) => (e === annulation ? null : e)), UNDO_WINDOW_MS - 400)
    return () => clearTimeout(minuteur)
  }, [annulation])

  // « Je l'ai proposé » (E) : l'agent a présenté le bien lui-même ; le CRM consigne et pose la relance.
  const proposer = useCallback((m: FilMatch) => {
    differer([m], t('fil.propose', { prenom: m.acheteur.prenom }), (c) => {
      const { acheteur, bien } = versGeste(m)
      return execProposer(c, acheteur, bien)
    })
  }, [differer, t])
  const plusTard = useCallback((m: FilMatch) => {
    differer([m], t('fil.reporte', { nom: nomComplet(m) }), (c) => execSnooze(c, versGeste(m).acheteur))
  }, [differer, t])
  const ecarter = useCallback((m: FilMatch) => {
    differer([m], t('fil.ecarte', { nom: nomComplet(m) }), (c) => execDismiss(c, versGeste(m).acheteur))
  }, [differer, t])
  const ecarterDeSelection = useCallback((m: FilMatch) => {
    // Sans contexte d'agent, `differer` n'écrira rien : ni la case ni le focus ne doivent bouger.
    if (!ctx) return
    // Le bouton cliqué part avec son bien : le focus passe AVANT à la case voisine (la suivante, sinon la
    // précédente, sinon la ligne du fil), qui, elle, reste montée — sinon il tombait sur `<body>`.
    const i = matchsSelection.findIndex((x) => x.id === m.id)
    const voisin = matchsSelection[i + 1] ?? matchsSelection[i - 1] ?? null
    if (!voisin || !focaliserBien(voisin.id)) focaliser(courantRef.current)
    const contact = m.acheteur.id
    const etaitCoche = cochesSelection.includes(m.id)
    setCoches((c) => {
      const actuels = c[contact]
      return actuels ? { ...c, [contact]: actuels.filter((id) => id !== m.id) } : c
    })
    differer([m], t('fil.ecarteSelection', { titre: m.bien.titre, prenom: m.acheteur.prenom }),
      (c) => execDismiss(c, versGeste(m).acheteur), {
        ligneQuiSort: null,
        rendre: () => {
          if (!etaitCoche) return
          setCoches((c) => {
            const actuels = c[contact] ?? []
            return actuels.includes(m.id) ? c : { ...c, [contact]: [...actuels, m.id] }
          })
        },
      })
  }, [ctx, differer, t, matchsSelection, cochesSelection, focaliser, focaliserBien])
  const reactiver = useCallback((id: string) => {
    // Un double clic ne réveille pas deux fois (deux écritures, deux annulations de rappel).
    if (reveils.current.has(id)) return
    reveils.current.add(id)
    // ⚠ `rafraichir` rend la promesse d'invalidation : `.then(rafraichir)` l'ADOPTE, donc `.finally`
    // n'ouvre le verrou qu'une fois le rafraîchissement retombé — pas dès l'écriture de `execWake`.
    // Sans ça, un second clic pendant le rafraîchissement encore en vol rouvrait une seconde écriture.
    execWake(id).then(rafraichir)
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reveils.current.delete(id))
  }, [rafraichir, toast, t])

  const cocher = useCallback((id: string, coche: boolean) => {
    if (!contactSelection) return
    setCoches((c) => {
      const actuels = c[contactSelection] ?? []
      return { ...c, [contactSelection]: coche ? [...new Set([...actuels, id])] : actuels.filter((x) => x !== id) }
    })
  }, [contactSelection])

  // « J'ai proposé N biens » (E sur une ligne « Marché ») : les biens cochés sortent de la sélection, UNE
  // écriture pour tous (`execProposerSelection` : un deal, une ligne de journal, une relance), annulable.
  const proposerSelection = useCallback(() => {
    // Sans contexte d'agent, `differer` n'écrira rien : les cases ne doivent pas se vider pour rien.
    if (!ctx || !resumeSelection || cochesSelection.length === 0) return
    const { acheteur } = resumeSelection
    const proposes = matchsSelection.filter((m) => cochesSelection.includes(m.id))
    if (proposes.length === 0) return
    const avant = cochesSelection
    // Décision : pas de recochage après une proposition. Effacer l'entrée rouvrait le pré-cochage, qui
    // aurait coché EN SILENCE les biens suivants ; l'agent choisit lui-même la prochaine.
    setCoches((c) => ({ ...c, [acheteur.id]: [] }))
    differer(proposes, t('fil.proposeSelection', { count: proposes.length, prenom: acheteur.prenom }),
      (c) => execProposerSelection(
        c,
        { id: acheteur.id, first: acheteur.prenom, last: acheteur.nom },
        proposes.map((m) => ({ matchId: m.id, score: m.score, bien: versGeste(m).bien })),
      ),
      { ligneQuiSort: null, rendre: () => setCoches((c) => ({ ...c, [acheteur.id]: avant })) })
  }, [ctx, resumeSelection, cochesSelection, matchsSelection, differer, t])

  /** Changer d'onglet : sa première ligne est choisie, les motifs ouverts se referment. */
  const choisirOnglet = useCallback((o: FilOnglet) => {
    setOngletRetenu(o)
    setChoix(null)
    setMotifsPour(null)
    setVisitePour(null)
  }, [setOngletRetenu])

  /**
   * « Intéressé » / « Pas intéressé » — la réponse de l'acheteur, consignée (§4.4), depuis « Retours de … »
   * ou « À conclure ». Dans « Retours de … », seule la réponse au DERNIER bien fait sortir la ligne de
   * l'acheteur ; sinon le focus passe AVANT au bien voisin, qui reste monté.
   */
  const repondre = useCallback((m: FilMatch, reponse: ReponseAcheteur) => {
    if (!ctx) return
    setMotifsPour(null)
    let ligneQuiSort: string | null = m.id
    if (onglet === 'enAttente') {
      const biens = attentes.find((a) => a.acheteur.id === m.acheteur.id)?.matchs ?? []
      const i = biens.findIndex((x) => x.id === m.id)
      const voisin = biens[i + 1] ?? biens[i - 1] ?? null
      if (voisin && voisin.id !== m.id) {
        if (!focaliserBien(voisin.id)) focaliser(courantRef.current)
        ligneQuiSort = null
      } else ligneQuiSort = cleAttente(m.acheteur.id)
    }
    const texte = reponse.genre === 'interested'
      ? t('fil.repondu.interesse', { prenom: m.acheteur.prenom, titre: m.bien.titre })
      : t('fil.repondu.refuse', { titre: m.bien.titre, motif: t(`fil.motifs.${reponse.motif}`) })
    differer([m], texte, () => execRepondre(versGeste(m).acheteur, reponse), {
      ligneQuiSort,
      // §4.4 : « Intéressé » propose tout de suite la visite — « À conclure », ce bien choisi, sa date prête.
      suite: reponse.genre === 'interested'
        ? { libelle: t('fil.repondu.planifier'), apres: () => { choisirOnglet('aConclure'); setChoix(m.id); setVisitePour(m.id) } }
        : undefined,
    })
  }, [ctx, onglet, attentes, focaliser, focaliserBien, differer, choisirOnglet, t])

  /** « Pas encore » : rien ne sort du fil ; la relance de la proposition est repoussée de trois jours (§4.4). */
  const pasEncore = useCallback((m: FilMatch) => {
    if (!ctx || reports.current.has(m.id)) return
    reports.current.add(m.id)
    const { acheteur, bien } = versGeste(m)
    execPasEncore(ctx, acheteur, bien)
      .then(() => { toast.success(t('fil.repondu.pasEncore', { prenom: m.acheteur.prenom })); return rafraichir() })
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reports.current.delete(m.id))
  }, [ctx, rafraichir, toast, t])

  /** Les motifs se referment : le focus revient au bien (son « Intéressé »), sinon à la ligne. */
  const fermerMotifs = useCallback(() => {
    const id = motifsPour
    setMotifsPour(null)
    if (id) setTimeout(() => { if (!focaliserBien(id)) focaliser(courantRef.current) }, 0)
  }, [motifsPour, focaliser, focaliserBien])

  /**
   * « Planifier la visite » (§4.5) : écrite tout de suite (un formulaire validé). La ligne sort d'« À
   * conclure », masquée jusqu'à la lecture qui le dit, comme après un geste différé.
   */
  const planifier = useCallback((m: FilMatch, visite: VisiteAPlanifier) => {
    if (!ctx || occupe) return
    setOccupe(true)
    const { acheteur, bien } = versGeste(m)
    execPlanifierVisite(ctx, acheteur, bien, visite)
      .then(({ deja }) => {
        // `deja` : un collègue a répondu entre-temps, rien n'a été planifié ; la relecture le montrera.
        if (!deja) {
          toast.success(t('fil.conclure.planifiee', { prenom: m.acheteur.prenom, date: format(new Date(visite.debut), 'dd.MM.yyyy HH:mm') }))
        }
        const fin = Date.now()
        setMasques((s) => new Map(s).set(m.id, fin))
        setVisitePour(null)
        focaliser(ceder(m.id))
        return rafraichir()
      })
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => setOccupe(false))
  }, [ctx, occupe, ceder, focaliser, rafraichir, toast, t])

  /** Une correction validée ou ignorée sort de la liste : ses refus sont masqués jusqu'à la lecture qui les dit pris en compte. */
  const sortirCorrection = useCallback((c: Correction) => {
    const fin = Date.now()
    setMasques((s) => { const n = new Map(s); for (const m of c.refus) n.set(m.id, fin); return n })
    focaliser(ceder(c.cle))
  }, [ceder, focaliser])

  // « Ajuster la recherche » (§4.6) : UN appel au moteur, qui renote, pose et journalise. Un échec laisse la
  // correction à l'écran, et la même validation se rejoue.
  const ajuster = useCallback((c: Correction, criteres: SearchCriteria) => {
    if (occupe) return
    setOccupe(true)
    execAjusterRecherche(versCorrectionGeste(c), criteres)
      .then(({ ecartes }) => {
        toast.success(ecartes > 0
          ? t('fil.corrections.fait', { prenom: c.acheteur.prenom, count: ecartes })
          : t('fil.corrections.faitAucun', { prenom: c.acheteur.prenom }))
        sortirCorrection(c)
        return rafraichir()
      })
      .catch(() => toast.error(t('fil.corrections.erreur')))
      .finally(() => setOccupe(false))
  }, [occupe, sortirCorrection, rafraichir, toast, t])
  const ignorer = useCallback((c: Correction) => {
    if (!ctx || occupe) return
    setOccupe(true)
    execIgnorerCorrection(ctx, versCorrectionGeste(c))
      .then(() => { toast.info(t('fil.corrections.ignoree')); sortirCorrection(c); return rafraichir() })
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => setOccupe(false))
  }, [ctx, occupe, sortirCorrection, rafraichir, toast, t])

  // « Apprendre » s'annonce UNE fois, où qu'on soit (décision 6 du plan du lot B) : une correction qui paraît
  // après le premier chargement — un deuxième refus pour un même motif vient d'être consigné.
  const correctionsConnues = useRef<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (!aDesDonnees) return
    const connues = correctionsConnues.current
    correctionsConnues.current = new Set(toutesCorrections.map((c) => c.cle))
    const nouvelle = connues ? toutesCorrections.find((c) => !connues.has(c.cle)) : undefined
    if (nouvelle) toast.info(t('fil.corrections.nouvelle', { prenom: nouvelle.acheteur.prenom }))
  }, [aDesDonnees, toutesCorrections, toast, t])

  // Un rafraîchissement en échec garde la liste chargée, et le dit UNE fois par échec.
  const echecSignale = useRef(0)
  useEffect(() => {
    if (!isError || !aDesDonnees || erreurLe === echecSignale.current) return
    echecSignale.current = erreurLe
    toast.error(t('fil.erreurRafraichir'))
  }, [isError, aDesDonnees, erreurLe, toast, t])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Déjà traité plus bas dans l'arbre : ←/→ des onglets, chiffres et Échap des motifs.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const cible = e.target as HTMLElement
    const fleche = e.key === 'ArrowDown' || e.key === 'ArrowUp'
    const caseACocher = cible instanceof HTMLInputElement && cible.type === 'checkbox'
    // ↑/↓ sur la case d'un bien parcourent les CASES de la sélection, pas le fil : descendre la liste des
    // biens au clavier changeait sinon d'acheteur. Aux extrémités, on reste sur place.
    if (fleche && caseACocher && cible.dataset.bien !== undefined) {
      e.preventDefault()
      // Les cases SEULES : « Intéressé » d'un retour porte aussi `data-bien` (le focus y revient).
      const cases = [...(racine.current?.querySelectorAll<HTMLElement>('input[type="checkbox"][data-bien]') ?? [])]
      cases[cases.indexOf(cible) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
      return
    }
    // Une case à cocher n'est pas une saisie POUR E SEULEMENT : E doit proposer depuis la case qu'on vient
    // de cocher. Toute autre touche y garde son sens natif.
    const saisie = cible instanceof HTMLInputElement ? !(caseACocher && e.key.toLowerCase() === 'e')
      : /^(TEXTAREA|SELECT)$/.test(cible.tagName)
    if (saisie || cible.isContentEditable) return
    if (fleche) {
      if (!courant) return
      e.preventDefault()
      const i = ordre.indexOf(courant)
      const suivant = ordre[Math.min(ordre.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (!suivant) return
      setChoix(suivant)
      focaliser(suivant)
      return
    }
    // ⛔ La répétition automatique d'une touche tenue trierait une ligne par répétition.
    if (e.repeat) return
    const touche = e.key.toLowerCase()
    if (attente) {
      // Les touches visent le bien qui a le focus dans « Retours de … », sinon le premier.
      const id = cible.closest<HTMLElement>('[data-retour]')?.dataset.retour
      const m = attente.matchs.find((x) => x.id === id) ?? attente.matchs[0]
      if (!m) return
      if (touche === 'i') { e.preventDefault(); repondre(m, { genre: 'interested' }) }
      else if (touche === 'n') { e.preventDefault(); setMotifsPour(m.id) }
      else if (touche === 'p') { e.preventDefault(); pasEncore(m) }
      return
    }
    if (aConclure) {
      if (touche === 'v') { e.preventDefault(); racine.current?.querySelector<HTMLElement>('[data-visite-date]')?.focus() }
      else if (touche === 'n') { e.preventDefault(); setMotifsPour(aConclure.id) }
      return
    }
    // Une correction se valide par un BOUTON, jamais par une touche : elle renote toute une recherche.
    if (correction) return
    if (contactSelection) {
      if (touche === 'e' && cochesSelection.length > 0) { e.preventDefault(); proposerSelection() }
      return
    }
    if (!match) return
    if (touche === 'e') { e.preventDefault(); proposer(match) }
    else if (touche === 'p') { e.preventDefault(); plusTard(match) }
    else if (touche === 'x') { e.preventDefault(); ecarter(match) }
  }

  const enEchec = isError && !aDesDonnees
  const connu = !isLoading && !enEchec
  // Les reportés vivent dans « À proposer » : ils le gardent ouvert, même sans ligne à traiter.
  const ongletVide = comptes[onglet] === 0 && (onglet !== 'aProposer' || vue.reportes.length === 0)
  const rienDuTout = !filtreActif && vue.reportes.length === 0
    && comptes.aProposer + comptes.enAttente + comptes.aConclure === 0
  const etatAProposer = (
    <Etat sp={sp} titre={t('fil.vide.titre')} texte={t('fil.vide.texte')}
      action={{ libelle: t('fil.vide.contacts'), faire: () => navigate('/dashboard/contacts') }}
      secondaire={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
  )
  const panneau = attente ? (
    <FilRetours sp={sp} attente={attente} motifsPour={motifsPour}
      onInteresse={(m) => repondre(m, { genre: 'interested' })}
      onPasInteresse={(m) => setMotifsPour((x) => (x === m.id ? null : m.id))}
      onMotif={(m, motif, note) => repondre(m, { genre: 'rejected', motif, note })}
      onFermerMotifs={fermerMotifs} onPasEncore={pasEncore}
      onVoirContact={() => navigate(`/dashboard/contacts/${attente.acheteur.id}`)} />
  ) : aConclure ? (
    <FilConclure sp={sp} m={aConclure} motifsOuverts={motifsPour === aConclure.id} occupe={occupe}
      focusDate={visitePour === aConclure.id}
      onPlanifier={(visite) => planifier(aConclure, visite)}
      onPasInteresse={() => setMotifsPour((x) => (x === aConclure.id ? null : aConclure.id))}
      onMotif={(motif, note) => repondre(aConclure, { genre: 'rejected', motif, note })}
      onFermerMotifs={fermerMotifs}
      onVoirBien={() => navigate(`/dashboard/listings/${aConclure.bien.id}`)}
      onVoirContact={() => navigate(`/dashboard/contacts/${aConclure.acheteur.id}`)} />
  ) : correction ? (
    <FilCorrection sp={sp} correction={correction} occupe={occupe}
      onAjuster={(criteres) => ajuster(correction, criteres)} onIgnorer={() => ignorer(correction)}
      onVoirContact={() => navigate(`/dashboard/contacts/${correction.acheteur.id}`)} />
  ) : contactSelection && resumeSelection ? (
    <FilSelection sp={sp} resume={resumeSelection} matchs={matchsSelection} coches={cochesSelection}
      aPlus={selection.aPlus} isLoading={selection.isLoading} isError={selection.isError}
      aDesDonnees={selection.aDesDonnees} isFetching={selection.isFetching}
      onCocher={cocher} onEcarter={ecarterDeSelection} onProposer={proposerSelection}
      onVoirPlus={() => setLimites((l) => ({ ...l, [contactSelection]: limite + PAS_SELECTION }))}
      onReessayer={() => { void selection.refetch() }}
      onVoirContact={() => navigate(`/dashboard/contacts/${contactSelection}`)} />
  ) : match ? (
    <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)}
      onProposer={() => proposer(match)}
      onPlusTard={() => plusTard(match)} onEcarter={() => ecarter(match)}
      onVoirBien={() => navigate(`/dashboard/listings/${match.bien.id}`)}
      onVoirContact={() => navigate(`/dashboard/contacts/${match.acheteur.id}`)} />
  ) : (
    <Etat sp={sp} titre={onglet === 'aProposer' && comptes.aProposer === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
  )
  return (
    <div ref={racine} tabIndex={-1} onKeyDown={onKeyDown}
      onFocus={(e) => { dernierFocus.current = e.target }}
      onBlur={() => { setTimeout(reprendreFocus, 0) }} style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', outline: 'none', background: sp.frameBg, color: sp.ink,
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <FilStyleLignes sp={sp} />
      <FilEnTete sp={sp} filtres={filtresValides} options={options} onFiltres={setFiltres} />
      {connu && !rienDuTout && <FilOnglets sp={sp} onglet={onglet} comptes={comptes} onChoisir={choisirOnglet} />}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isLoading ? <Squelette sp={sp} />
          : enEchec ? <Etat sp={sp} alerte titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
            // ⚠ Un FILTRE actif qui ne retient rien passe AVANT le constat « aucune donnée du tout » :
            // sinon le seul match d'un acheteur filtré, une fois proposé, fait lire « Tout est à jour »
            // (vrai pour l'agence entière, faux pour ce filtre) au lieu de « Rien ne correspond ».
            : filtreActif && ongletVide ? (
              <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
            ) : rienDuTout || (onglet === 'aProposer' && ongletVide) ? etatAProposer
              : onglet !== 'aProposer' && ongletVide ? (
                <Etat sp={sp} titre={t(VIDE_BOUCLE[onglet].titre)} texte={t(VIDE_BOUCLE[onglet].texte)} />
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}` }}>
                  {/* `paddingBottom` : la barre d'annulation est un OVERLAY ancré bas-gauche (§ci-dessous) —
                      sans réserve, elle couvre les dernières lignes pendant toute la fenêtre d'annulation. */}
                  <div style={{ minHeight: 0, overflowY: 'auto', borderRight: `1px solid ${sp.cardBorder}`, paddingBottom: 'calc(var(--crm-space-7xl) * 3)' }}>
                    {onglet === 'aProposer' ? (
                      <FilListe sp={sp} vue={vue} selections={selectionsVues} corrections={corrections} courant={courant}
                        onChoisir={setChoix} onReactiver={reactiver} />
                    ) : (
                      <FilListeBoucle sp={sp} onglet={onglet} attentes={attentes} conclure={conclure} courant={courant} onChoisir={setChoix} />
                    )}
                  </div>
                  {/* La clé remet le défilement en haut quand on change de ligne. */}
                  <div key={`${onglet}:${courant ?? 'aucun'}`} style={{ minHeight: 0, overflowY: 'auto' }}>
                    {panneau}
                  </div>
                </div>
              )}
      </div>
      {/* ⛔ HORS des états : Plus tard ou Écarter sur la DERNIÈRE ligne fait basculer l'écran sur « Tout est
          à jour », et la barre partait avec la liste alors que l'écriture attendait encore. */}
      {annulation && <FilAnnulation sp={sp} texte={annulation.texte} action={annulation.action} onAnnuler={annulation.annuler} />}
      {/* Région vivante montée en PERMANENCE : une région qui apparaît avec son texte n'est pas annoncée
          de façon fiable. */}
      <div role="status" aria-live="polite" className="sr-only">{annulation?.texte ?? ''}</div>
    </div>
  )
}

function Etat({ sp, titre, texte, action, secondaire, alerte = false }: {
  sp: CrmPalette; titre: string; texte?: string
  action?: { libelle: string; faire: () => void }; secondaire?: { libelle: string; faire: () => void }
  /** Un échec : le titre est annoncé dès qu'il paraît. */
  alerte?: boolean
}) {
  const bouton = (principal: boolean) => ({
    height: 38, paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
    border: principal ? 0 : `1px solid ${sp.cardBorder}`, background: principal ? sp.accent : 'transparent',
    color: principal ? sp.accentInk : sp.ink,
  }) as const
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'grid', placeItems: 'center', padding: 'var(--crm-space-6xl)' }}>
      <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'center' }}>
        <p role={alerte ? 'alert' : undefined} style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{titre}</p>
        {texte && <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: sp.sub }}>{texte}</p>}
        {(action || secondaire) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-sm)' }}>
            {action && <button type="button" onClick={action.faire} style={bouton(true)}>{action.libelle}</button>}
            {secondaire && <button type="button" onClick={secondaire.faire} style={bouton(false)}>{secondaire.libelle}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function Squelette({ sp }: { sp: CrmPalette }) {
  const { t } = useTranslation('matching')
  // ⛔ Pas d'`aria-busy` : posé sur l'élément qui porte le libellé, il empêche certains lecteurs
  // d'écran d'annoncer ce même libellé — l'un neutralisait l'autre.
  return (
    <div role="status" style={{
      flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}`,
    }}>
      <span className="sr-only">{t('fil.chargement')}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-lg)', borderRight: `1px solid ${sp.cardBorder}` }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ height: 48, borderRadius: 'var(--crm-radius-md)', background: sp.cardSubBg }} />)}
      </div>
      <div style={{ padding: 'var(--crm-space-6xl)' }}>
        <div style={{ height: 220, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier**

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected : `0`.

Run : `npx eslint src/components/matching-fil src/hooks/useMatchingFil.ts src/hooks/useSelectionMarche.ts src/hooks/useAtelierMatching.ts src/hooks/useAgentNotifications.ts`
Expected : `0 errors, 1 warning` — `react-hooks/set-state-in-effect` sur `setPivotConsomme(true)`, l'effet du pivot d'arrivée, présent AVANT ce lot (même avertissement sur le fichier d'origine).

Run : `npx vitest run tests/unit/megga-x-grammar.spec.ts tests/unit/couleur-barreaux.spec.ts tests/unit/matching-sans-sortie.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/megga-x-crm-tokens.spec.ts tests/unit/polices-domaines.spec.ts tests/unit/accent-ramp.spec.ts tests/unit/clavier-ecran-cache.spec.ts`
Expected : PASS, 8 fichiers (la zone `matching-fil` reste à `{ hors: 0, total: 0 }` ; `matching-engine` reste la seule fonction appelée).

Run : `npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts tests/unit/matching-fil-gestes.spec.ts`
Expected : PASS — 51, 10, 14 et 41 tests.

Run : `npm run lint:deadcode && npm run lint:i18n`
Expected : « Aucun export mort », « 0 texte FR en dur ».

- [ ] **Step 3 : Point de commit (au signal) — l'écran de la boucle (Tasks 5 à 15)**

⚠ Fichiers partagés avec la pige : `git diff` de chaque `matching.json` montrera aussi ses clés `recherche.*` tant qu'elle ne les a pas commitées. N'indexer alors que `fil.*`, par un blob intermédiaire — la version de `HEAD` à laquelle on greffe le `fil` du worktree :

```bash
python3 - <<'EOF'
"""Index de matching.json : HEAD + le seul `fil` du worktree (les `recherche.*` de la pige restent hors du commit)."""
import json, subprocess
for langue in ('fr', 'de', 'en', 'it'):
    f = f'src/i18n/locales/{langue}/matching.json'
    base = json.loads(subprocess.run(['git', 'show', f'HEAD:{f}'], capture_output=True, text=True, check=True).stdout)
    base['fil'] = json.load(open(f, encoding='utf-8'))['fil']
    contenu = json.dumps(base, ensure_ascii=False, indent=2) + '\n'
    sha = subprocess.run(['git', 'hash-object', '-w', '--stdin'], input=contenu, capture_output=True, text=True, check=True).stdout.strip()
    subprocess.run(['git', 'update-index', '--cacheinfo', f'100644,{sha},{f}'], check=True)
    print(f, sha[:8])
EOF
git add src/components/matching-fil src/hooks/useAtelierMatching.ts src/hooks/useMatchingFil.ts src/hooks/useSelectionMarche.ts \
  src/hooks/useAgentNotifications.ts src/i18n/locales/fr/common.json src/i18n/locales/de/common.json \
  src/i18n/locales/en/common.json src/i18n/locales/it/common.json \
  tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-boucle.spec.ts tests/unit/matching-fil-apprendre.spec.ts \
  tests/unit/matching-fil-gestes.spec.ts
git diff --cached --stat
git diff --cached src/i18n/locales/fr/matching.json | grep '^[-+] ' | grep -v '"fil"' | head
git commit -m "feat(matching): la boucle dans le fil — En attente, À conclure, retours, visite, Apprendre"
```

Le `grep` doit ne rien montrer d'autre que des clés du `fil` ; si la pige a déjà commité ses clés, un simple `git add` des quatre `matching.json` suffit. Même vérification sur les `common.json` : ce lot n'y ajoute que six libellés `audit.action.*`.

---

### Task 16 : La boucle sur le banc

**Files :**
- Create : `tests/unit/banc-matching-boucle.spec.ts`
- Modify : `src/pages/dev/crmFixtures.ts` (PARTAGÉ avec la pige), `src/pages/dev/CrmShowcasePage.tsx`

Le banc ne joue aucun trigger et ne charge pas le barème : chaque match de la boucle y porte l'état que la base lui laisserait, et la note que le moteur lui a donnée À SA NOTATION (au premier prix de l'annonce : il ne renote pas une paire existante). Scènes posées :

| Match | Acheteur × bien | État | Ce qu'il montre |
|---|---|---|---|
| m14, m16 | Julie × ml-boucle-2, -1 | `rejected`, motif `prix` (1'560'000 et 1'580'000) | « Recherches à ajuster » : budget maximum → 1'550'000 |
| m15 | Julie × ml-boucle-3 | `sent`, proposé à 1'490'000, l'annonce à 1'440'000 | « Prix baissé de CHF 50'000 depuis que vous l'avez proposé » |
| rb1 | relance de m14 + m15 | `pending`, J+1 | Une relance de sélection reste ouverte tant qu'un bien attend |
| m19 | Julie × ml-boucle-4 | `suggested`, 57 | Le seul que la correction écarte (49) |
| m17 | Emma × ml-boucle-5 | `interested` | « À conclure », annonce du marché → événement d'agenda |
| m18, m21 | Emma × ml-boucle-6, -8 | `sent` ensemble | « Retours de … » à DEUX biens |
| rb2 | relance de m18 + m21 | `pending`, échue | La relance due en tête d'« En attente » |
| m20 | Emma × ml-boucle-7 | `suggested`, motif `prix`, proposé à 2'590'000, l'annonce à 2'480'000 | Retour par baisse, dans sa sélection du marché |
| m5 | Antoine × Cologny (p2) | `suggested`, motif `prix`, proposé à 3'450'000, le mandat à 3'200'000 | Retour par baisse, dans « Vos biens » |
| m6 | Emma × Loft (pb32) | `interested`, réponse datée | « À conclure », bien en mandat → visite |

- [ ] **Step 1 : Écrire la spec**

Créer `tests/unit/banc-matching-boucle.spec.ts` :

```ts
/**
 * Le banc `/dev/crm` et la boucle du matching (lot B) : ses matchs portent la note que le VRAI moteur leur
 * donnerait, ses états d'arrivée sont ceux que les triggers laisseraient, et son `matching-engine` renote la
 * recherche de Julie comme l'edge le ferait.
 *
 * ⚠ Le banc ne note pas (`src/` ne charge pas le barème Deno, CLAUDE.md §4) : il porte des notes calculées. Ce
 * fichier les confronte à `calculateScoreV2` — sans lui, une ligne « 97 · Genève correspond » du banc pourrait
 * dire ce que le moteur ne dirait pas, et l'écran se régler sur une fixture fausse.
 *
 * ⚠ Les fixtures sont des tableaux de MODULE, que la renotation du banc modifie : chaque test relit un module
 * neuf (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'

type Ligne = Record<string, unknown> & { id: string }

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const table = (nom: string): Ligne[] => f.CRM_TABLES[nom] as Ligne[]
  const ligne = (nom: string, id: string): Ligne => {
    const l = table(nom).find((x) => x.id === id)
    if (!l) throw new Error(`${nom}/${id} absent du banc`)
    return l
  }
  const bienDe = (m: Ligne): Ligne => (m.property_id
    ? ligne('properties', m.property_id as string)
    : ligne('market_listings', m.market_listing_id as string))
  const edge = f.CRM_EDGES['matching-engine'] as (a: Record<string, unknown>) => unknown
  return { table, ligne, bienDe, edge }
}

const BOUCLE = ['m14', 'm15', 'm16', 'm17', 'm18', 'm19', 'm20', 'm21']

/**
 * L'annonce telle que le moteur l'a notée : à son PREMIER prix. Il ne renote pas une paire existante
 * (`ON CONFLICT DO NOTHING`) ; notée au prix d'aujourd'hui, une annonce en baisse gagnerait « Prix baissé de
 * 3 % » et un point que la base n'a jamais écrits.
 */
const aLaNotation = (b: Ligne): Ligne => (Number(b.price_at_first_seen) > Number(b.current_price ?? b.price)
  ? { ...b, price: b.price_at_first_seen, current_price: b.price_at_first_seen, status: 'active' }
  : b)
const JULIE_A_PROPOSER = ['m3', 'm8', 'm9', 'm10', 'm19']

describe('le banc de la boucle', () => {
  it('ses matchs portent la note du moteur à leur notation, raisons comprises', async () => {
    const { ligne, bienDe } = await banc()
    for (const id of BOUCLE) {
      const m = ligne('matches', id)
      const criteres = ligne('contacts', m.contact_id as string).search_criteria as Record<string, unknown>
      const note = calculateScoreV2(aLaNotation(bienDe(m)), criteres)
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
    }
  })

  it('ses états d’arrivée sont ceux que les triggers laisseraient', async () => {
    const { table, ligne, bienDe } = await banc()
    // Une relance de proposition reste ouverte tant qu'un de ses biens attend (`fermer_relance_proposition`).
    const relances = table('reminders').filter((r) => r.type === 'follow_up_sent_property')
    expect(relances.map((r) => r.id)).toEqual(['rb1', 'rb2'])
    for (const r of relances) {
      const ids = (r.match_ids as string[] | null) ?? [r.match_id as string]
      expect(ids.some((id) => ligne('matches', id).status === 'sent'), r.id).toBe(r.status === 'pending')
    }
    // Un bien revenu par une baisse (`match_retour_prix_*`) : à proposer, motif « prix », proposé plus cher.
    for (const id of ['m5', 'm20']) {
      const m = ligne('matches', id)
      const bien = bienDe(m)
      expect(m).toMatchObject({ status: 'suggested', reaction_motif: 'prix' })
      expect(Number(m.prix_propose)).toBeGreaterThan(Number(bien.current_price ?? bien.price))
    }
    // Un bien proposé porte le prix auquel il l'a été (`set_match_prix_propose`) : sur le banc, son premier prix.
    for (const id of BOUCLE.filter((x) => ligne('matches', x).status !== 'suggested')) {
      const m = ligne('matches', id)
      expect(m.prix_propose, id).toBe(bienDe(m).price_at_first_seen)
    }
  })

  it('`matching-engine` renote la recherche de Julie comme le moteur, et pose ce que l’edge pose', async () => {
    const { table, ligne, bienDe, edge } = await banc()
    const avant = ligne('client_searches', 'cs9').criteria as Record<string, unknown>
    const corriges = { ...avant, budget_max: 1_550_000 }
    expect(edge({ mode: 'rescore-search', client_search_id: 'cs9', criteria: corriges, motif: 'prix', refus_ids: ['m16', 'm14'] }))
      .toEqual({ reevalues: 5, ecartes: 1, mode: 'rescore-search' })
    for (const id of JULIE_A_PROPOSER) {
      const m = ligne('matches', id)
      const note = calculateScoreV2(bienDe(m), corriges)
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
      expect(m.status, id).toBe(note.total < DEFAULT_SCORING_CONFIG.threshold ? 'ignored' : 'suggested')
    }
    expect(ligne('matches', 'm19').reaction_motif).toBe('recherche_ajustee')
    expect(ligne('client_searches', 'cs9').criteria).toEqual(corriges)
    expect(ligne('contacts', 'c9').search_criteria).toEqual(corriges)
    for (const id of ['m14', 'm16']) expect(typeof ligne('matches', id).apprentissage_at, id).toBe('string')
    expect(table('activity_events').at(-1)).toMatchObject({
      action: 'recherche_ajustee', category: 'contact', entity_id: 'c9', metadata: { reevalues: 5, ecartes: 1 },
    })
  })

  it('une autre valeur pose les critères sans rien renoter', async () => {
    const { ligne, edge } = await banc()
    const avant = ligne('client_searches', 'cs9').criteria as Record<string, unknown>
    const scores = JULIE_A_PROPOSER.map((id) => ligne('matches', id).score)
    expect(edge({ mode: 'rescore-search', client_search_id: 'cs9', criteria: { ...avant, budget_max: 1_500_000 }, motif: 'prix', refus_ids: ['m16', 'm14'] }))
      .toEqual({ reevalues: 0, ecartes: 0, mode: 'rescore-search' })
    expect(JULIE_A_PROPOSER.map((id) => ligne('matches', id).score)).toEqual(scores)
    expect(ligne('client_searches', 'cs9').criteria).toMatchObject({ budget_max: 1_500_000 })
  })

  it('les autres modes gardent la réponse d’une edge sans fixture', async () => {
    const { edge } = await banc()
    expect(edge({ mode: 'scan-all' })).toEqual({ ok: true, banc: true })
  })
})
```

- [ ] **Step 2 : Lancer, constater l'échec**

Run : `npx vitest run tests/unit/banc-matching-boucle.spec.ts`
Expected : FAIL (`matches/m14 absent du banc`, `matching-engine` sans fixture).

- [ ] **Step 3 : Les fixtures**

⚠ `crmFixtures.ts` est PARTAGÉ avec la pige : le script le relit à l'exécution et n'y fait que des insertions à des ancres vérifiées (une ancre changée par la pige fait échouer une assertion : l'adapter, ne jamais réécrire le fichier). L'enregistrer dans le scratchpad de la session, par exemple `$SCRATCH/boucle_banc.py`, puis :

Run : `python3 $SCRATCH/boucle_banc.py`
Expected : `src/pages/dev/crmFixtures.ts ok`.

```python
"""Lot B, Task 16 : la boucle du banc (crmFixtures.ts).

⚠ Le fichier est PARTAGÉ avec la pige (étape 1b), qui y ajoute des annonces du marché : il est relu À L'EXÉCUTION,
et le script n'y fait que des insertions à des ancres vérifiées. `CIBLE=<fichier>` l'applique à une autre copie
(blob intermédiaire du commit, Step 7).
"""
import os
import re

chemin = os.environ.get('CIBLE', 'src/pages/dev/crmFixtures.ts')
s = open(chemin, encoding='utf-8').read()
assert 'ANNONCES_BOUCLE' not in s, 'déjà appliqué'


def inserer(ancre, ajout, avant=False):
    global s
    n = s.count(ancre)
    assert n == 1, f'ancre trouvée {n} fois : {ancre[:90]!r}'
    s = s.replace(ancre, ajout + ancre if avant else ancre + ajout)


# 1. Les annonces de la boucle, juste avant CRM_TABLES (après celles que la pige aurait ajoutées).
ANNONCES = r'''/**
 * La BOUCLE du fil (lot B, 21.09.2026) — huit ventes du marché, notées par le vrai moteur À LEUR PREMIER PRIX
 * (`banc-matching-boucle.spec.ts` les confronte à `calculateScoreV2` ; il ne renote pas une paire existante). Julie (c9) en a refusé deux pour le
 * PRIX (ml-boucle-1 et -2 : « Apprendre » propose d'abaisser son budget à 1'550'000) ; elle n'a pas encore
 * répondu sur ml-boucle-3, qui a baissé depuis qu'on le lui a proposé ; ml-boucle-4 est la seule de ses
 * suggestions que la correction écarte (57 → 49). Emma (c7) est intéressée par ml-boucle-5, n'a répondu ni sur
 * ml-boucle-6 ni sur ml-boucle-8 (proposés ensemble : « Retours de … » à deux biens), et ml-boucle-7, qu'elle
 * a refusé pour le prix, est revenu par une baisse.
 *
 * ⚠ Mêmes colonnes que `annonceFil`, plus l'historique du prix : `price_at_first_seen` au-dessus du prix
 * courant ⇒ baisse datée, et `price_reduced`, comme le pose `trg_ra_price_status` sur une vente RealAdvisor.
 */
const annonceBoucle = (
  id: string, titre: string, lieu: { rue: string; npa: string; ville: string; canton: string },
  prix: { actuel: number; premier: number }, pieces: number, surface: number, equipements: string[], photo: string, sourceId: string,
) => ({
  ...annonceFil(id, titre, lieu.rue, lieu.npa, prix.actuel, pieces, surface, equipements, photo, sourceId),
  city: lieu.ville, canton: lieu.canton, price_at_first_seen: prix.premier, first_seen_at: ilYA(24 * 14), removed_at: null,
  status: prix.premier > prix.actuel ? 'price_reduced' : 'active',
  price_reduced_at: prix.premier > prix.actuel ? ilYA(24 * 2) : null,
})
const GENEVE = (rue: string, npa: string) => ({ rue, npa, ville: 'Genève', canton: 'GE' })
const ZURICH = (rue: string, npa: string) => ({ rue, npa, ville: 'Zürich', canton: 'ZH' })
const ANNONCES_BOUCLE = [
  annonceBoucle('ml-boucle-1', 'Attique 4,5 pièces · Malagnou', GENEVE('Route de Malagnou 28', '1208'), { actuel: 1_580_000, premier: 1_580_000 }, 4.5, 112, ['Balcon', 'Ascenseur', 'Terrasse'], PHOTOS_APPART[4]!, '52210'),
  annonceBoucle('ml-boucle-2', 'Appartement 5 pièces · Servette', GENEVE('Rue de la Servette 45', '1202'), { actuel: 1_560_000, premier: 1_560_000 }, 5, 118, ['Balcon', 'Ascenseur'], PHOTOS_APPART[5]!, '52211'),
  annonceBoucle('ml-boucle-3', 'Appartement 4 pièces · Champel', GENEVE('Chemin des Crêts-de-Champel 9', '1206'), { actuel: 1_440_000, premier: 1_490_000 }, 4, 104, ['Balcon', 'Ascenseur'], PHOTOS_APPART[6]!, '52212'),
  annonceBoucle('ml-boucle-4', 'Appartement 3,5 pièces · Onex', { rue: 'Avenue du Bois-de-la-Chapelle 15', npa: '1213', ville: 'Onex', canton: 'GE' }, { actuel: 1_750_000, premier: 1_750_000 }, 3.5, 92, ['Ascenseur'], PHOTOS_APPART[7]!, '52213'),
  annonceBoucle('ml-boucle-5', 'Appartement 5,5 pièces · Enge', ZURICH('Seestrasse 120', '8002'), { actuel: 2_200_000, premier: 2_200_000 }, 5.5, 146, ['Balcon', 'Ascenseur'], PHOTOS_APPART[8]!, '52214'),
  annonceBoucle('ml-boucle-6', 'Attique 4,5 pièces · Oerlikon', ZURICH('Schaffhauserstrasse 340', '8050'), { actuel: 2_650_000, premier: 2_650_000 }, 4.5, 128, ['Terrasse', 'Ascenseur'], PHOTOS_APPART[9]!, '52215'),
  annonceBoucle('ml-boucle-7', 'Appartement 4,5 pièces · Seefeld', ZURICH('Seefeldstrasse 88', '8008'), { actuel: 2_480_000, premier: 2_590_000 }, 4.5, 121, ['Balcon', 'Ascenseur'], PHOTOS_APPART[10]!, '52216'),
  annonceBoucle('ml-boucle-8', 'Appartement 4,5 pièces · Wollishofen', ZURICH('Albisstrasse 60', '8038'), { actuel: 1_980_000, premier: 1_980_000 }, 4.5, 118, ['Balcon', 'Cave'], PHOTOS_APPART[11]!, '52217'),
]
/** Les jointures `contact` des matchs de la boucle — le banc n'applique pas `select`, la ligne les porte. */
const JULIE_EMBARQUEE = { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' }
const EMMA_EMBARQUEE = { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' }
/** Emma (c7) sur un bien de Zürich : ni pièces ni équipements dans sa recherche, le moteur reporte leur poids. */
const RAISONS_EMMA_ZURICH = {
  budget: { match: true, score: 47, detail: 'Dans le budget' },
  zone: { match: true, score: 35, detail: 'Zürich correspond' },
  type: { match: true, score: 18, detail: 'apartment' },
  rooms: { match: false, score: 0, detail: 'Aucun critère' },
  features: { match: false, score: 0, detail: '—' },
}

'''
inserer('export const CRM_TABLES: Record<string, unknown[]> = {\n', ANNONCES, avant=True)

# 2. Elles rejoignent `market_listings`, quoi que la pige ait ajouté sur la même ligne.
m = re.search(r'^  market_listings: \[(.*)\],$', s, re.M)
assert m, 'ligne market_listings introuvable (sur plusieurs lignes ?) : y ajouter ...ANNONCES_BOUCLE à la main'
s = s[:m.start()] + f'  market_listings: [{m.group(1)}, ...ANNONCES_BOUCLE],' + s[m.end():]

# 3. Les relances de proposition, après r2.
RELANCES = r'''    // La boucle du fil (lot B) : UNE relance par proposition, qui couvre TOUS ses biens (`match_ids`). rb1
    // reste ouverte — Julie a refusé m14 mais pas encore répondu sur m15 (`fermer_relance_proposition`) ;
    // rb2, échue, couvre les deux biens proposés ensemble à Emma. Colonnes réelles de `reminders`, telles que `poserRelance` les pose.
    { id: 'rb1', agency_id: AGENCE_BANC.id, contact_id: 'c9', property_id: null, transaction_id: null, match_id: 'm14', match_ids: ['m14', 'm15'], type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3, trigger_at: ilYA(-24), status: 'pending', channel: 'task', kind: null, completed_at: null, draft_message: null, calendar_label_id: null, message_template: 'Retour de Julie Morand sur 2 biens proposés', created_at: ilYA(48) },
    { id: 'rb2', agency_id: AGENCE_BANC.id, contact_id: 'c7', property_id: null, transaction_id: null, match_id: 'm18', match_ids: ['m18', 'm21'], type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3, trigger_at: ilYA(24), status: 'pending', channel: 'task', kind: null, completed_at: null, draft_message: null, calendar_label_id: null, message_template: 'Retour de Emma Schneider sur 2 biens proposés', created_at: ilYA(96) },
'''
inserer("message_template: null, calendar_label_id: null, created_at: ilYA(52) },\n", RELANCES)

# 4. m5 : un refus « prix » revenu par une baisse du mandat.
M5_AVANT = (
    "    {\n"
    "      id: 'm5', agency_id: AGENCE_BANC.id, client_search_id: 'cs10', contact_id: 'c10', source: 'internal',\n"
    "      property_id: 'p2', market_listing_id: null,\n"
    "      score: 97, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(12),\n"
)
M5 = r'''    {
      // Refusé par Antoine pour le PRIX à 3'450'000, revenu à proposer quand le mandat est passé à 3'200'000
      // (lot B, `match_retour_prix_mandat`) : « Refusé par Antoine à CHF 3'450'000 · baissé de CHF 250'000 depuis ».
      id: 'm5', agency_id: AGENCE_BANC.id, client_search_id: 'cs10', contact_id: 'c10', source: 'internal',
      property_id: 'p2', market_listing_id: null,
      score: 97, status: 'suggested', sent_via: 'agent', sent_at: ilYA(24 * 20), snoozed_until: null, created_at: ilYA(24 * 25),
      response_at: ilYA(24 * 18), reaction_motif: 'prix', reaction_note: null, prix_propose: 3_450_000,
'''
assert s.count(M5_AVANT) == 1, 'bloc m5 introuvable'
s = s.replace(M5_AVANT, M5)

# 5. m6 : sa réponse est datée (`set_match_response_at`).
inserer("      score: 100, status: 'interested', sent_via: 'reception', sent_at: ilYA(24 * 6), snoozed_until: null, created_at: ilYA(24 * 6 + 2),\n",
        "      response_at: ilYA(24 * 5),\n")

# 6. m14 à m21, après m13.
MATCHS = r'''    // ── La boucle du fil (lot B, 21.09.2026) : m14 à m21, sur ANNONCES_BOUCLE, notés par le vrai moteur
    // (`banc-matching-boucle.spec.ts`). ⚠ Le banc ne joue AUCUN trigger : ce que la base poserait seule y est
    // écrit tel qu'elle le laisserait — `prix_propose` au passage à `sent`, `response_at` à la réponse, le
    // retour à `suggested` d'un refus « prix » quand le prix baisse (m20, et m5 plus haut).
    {
      id: 'm14', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-2',
      score: 97, status: 'rejected', sent_via: 'agent', sent_at: ilYA(48), snoozed_until: null, created_at: ilYA(24 * 4),
      response_at: ilYA(24), reaction_motif: 'prix', reaction_note: null, prix_propose: 1_560_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '5 pièces · 118 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[1], property: null,
    },
    {
      id: 'm15', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-3',
      score: 97, status: 'sent', sent_via: 'agent', sent_at: ilYA(48), snoozed_until: null, created_at: ilYA(24 * 4),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 1_490_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4 pièces · 104 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[2], property: null,
    },
    {
      id: 'm16', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-1',
      score: 100, status: 'rejected', sent_via: 'agent', sent_at: ilYA(24 * 9), snoozed_until: null, created_at: ilYA(24 * 10),
      response_at: ilYA(24 * 8), reaction_motif: 'prix', reaction_note: 'Au-dessus de ce que sa banque suit.', prix_propose: 1_580_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 112 m²' },
        features: { match: true, score: 10, detail: '3/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[0], property: null,
    },
    {
      id: 'm17', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-5',
      score: 100, status: 'interested', sent_via: 'agent', sent_at: ilYA(24 * 5), snoozed_until: null, created_at: ilYA(24 * 7),
      response_at: ilYA(24 * 3), reaction_motif: null, reaction_note: null, prix_propose: 2_200_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[4], property: null,
    },
    {
      id: 'm18', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-6',
      score: 100, status: 'sent', sent_via: 'agent', sent_at: ilYA(24 * 4), snoozed_until: null, created_at: ilYA(24 * 7),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 2_650_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[5], property: null,
    },
    {
      id: 'm19', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-4',
      score: 57, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(24 * 4),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: null, apprentissage_at: null,
      reasons: {
        budget: { match: false, score: 12, detail: '9% au-dessus du budget' },
        zone: { match: true, score: 14, detail: 'Canton GE correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 15, detail: '3,5 pièces · 92 m²' },
        features: { match: false, score: 3, detail: '1/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[3], property: null,
    },
    {
      id: 'm20', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-7',
      score: 100, status: 'suggested', sent_via: 'agent', sent_at: ilYA(24 * 12), snoozed_until: null, created_at: ilYA(24 * 14),
      response_at: ilYA(24 * 10), reaction_motif: 'prix', reaction_note: 'Attend une baisse.', prix_propose: 2_590_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[6], property: null,
    },
    {
      id: 'm21', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-8',
      score: 100, status: 'sent', sent_via: 'agent', sent_at: ilYA(24 * 4), snoozed_until: null, created_at: ilYA(24 * 7),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 1_980_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[7], property: null,
    },
'''
inserer('      market_listing: ANNONCES_FIL[3], property: null,\n    },\n', MATCHS)

# 7. `matching-engine` du banc : `renoterBanc`, avant les edges, et son entrée.
EDGE = r'''/**
 * `matching-engine` du banc — le mode `rescore-search` d'« Apprendre » (lot B) ; les autres modes rendent
 * `{ ok: true, banc: true }`, comme toute edge sans fixture.
 *
 * ⛔ LE BANC NE NOTE PAS : `src/` ne charge pas le barème Deno (CLAUDE.md §4). Il connaît les notes du cas de
 * démonstration — la recherche de Julie (cs9), budget maximum abaissé à 1'550'000 par ses deux refus « prix » —,
 * CONFRONTÉES au moteur par `banc-matching-boucle.spec.ts`. Une autre valeur pose les critères et prend les
 * refus en compte sans rien renoter (0 réévalué, et l'écran le dit) : le banc n'invente pas de note.
 *
 * Mêmes écritures que l'edge, dans le même ordre : les notes (sous le seuil : `ignored`, motif
 * `recherche_ajustee`), les critères de la recherche puis ceux de la fiche si elle portait les mêmes, les refus
 * pris en compte, une ligne au journal.
 */
type RaisonBanc = { match: boolean; score: number; detail: string }
/** Le seuil du barème (`DEFAULT_SCORING_CONFIG.threshold`, matching-normalize.ts). */
const SEUIL_MOTEUR = 55
/** Les notes du moteur pour la recherche de Julie au budget maximum de 1'550'000 : seul l'axe budget change. */
const NOTES_JULIE_1550: Record<string, { score: number; budget?: RaisonBanc }> = {
  m3: { score: 97 }, m8: { score: 97 }, m10: { score: 90 },
  m9: { score: 94, budget: { match: true, score: 26, detail: '3% au-dessus du budget' } },
  m19: { score: 49, budget: { match: false, score: 4, detail: '13% au-dessus du budget' } },
}

function renoterBanc(a: Record<string, unknown>): Record<string, unknown> {
  const recherche = (CRM_TABLES.client_searches as { id: string; contact_id: string; criteria: unknown }[])
    .find((r) => r.id === a.client_search_id)
  if (!recherche) return { error: 'search_not_found' }
  const criteres = a.criteria && typeof a.criteria === 'object' ? a.criteria as Record<string, unknown> : null
  const refus = Array.isArray(a.refus_ids) ? a.refus_ids.filter((id): id is string => typeof id === 'string') : []
  const matchs = CRM_TABLES.matches as {
    id: string; status: string; client_search_id?: string | null; score: number
    reasons: Record<string, unknown> | null; reaction_motif?: string | null; apprentissage_at?: string | null
  }[]
  const demonstration = recherche.id === 'cs9' && criteres?.budget_max === 1_550_000
  let reevalues = 0
  let ecartes = 0
  for (const m of matchs) {
    const note = demonstration ? NOTES_JULIE_1550[m.id] : undefined
    if (!note || m.status !== 'suggested' || m.client_search_id !== recherche.id) continue
    reevalues++
    m.score = note.score
    if (note.budget) m.reasons = { ...m.reasons, budget: note.budget }
    if (note.score < SEUIL_MOTEUR) {
      ecartes++
      m.status = 'ignored'
      m.reaction_motif = 'recherche_ajustee'
    }
  }
  const avant = recherche.criteria
  if (criteres) {
    recherche.criteria = criteres
    const fiche = (CRM_TABLES.contacts as { id: string; search_criteria: unknown }[]).find((c) => c.id === recherche.contact_id)
    if (fiche && JSON.stringify(fiche.search_criteria) === JSON.stringify(avant)) fiche.search_criteria = criteres
  }
  const maintenant = new Date().toISOString()
  for (const m of matchs) {
    if (refus.includes(m.id) && m.status === 'rejected' && m.client_search_id === recherche.id) m.apprentissage_at = maintenant
  }
  const journal = CRM_TABLES.activity_events as Record<string, unknown>[]
  journal.push({
    id: crypto.randomUUID(), agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user',
    action: criteres ? 'recherche_ajustee' : 'matchs_reevalues', entity_type: 'contact', entity_id: recherche.contact_id,
    category: 'contact', severity: 'info', object_label: null, created_at: maintenant,
    metadata: { client_search_id: recherche.id, motif: a.motif ?? null, avant, apres: criteres, refus_ids: refus, reevalues, ecartes },
  })
  return { reevalues, ecartes, mode: 'rescore-search' }
}

'''
inserer('/**\n * Edge functions du banc.\n', EDGE, avant=True)
inserer('export const CRM_EDGES: Record<string, unknown> = {\n',
        "  // « Apprendre » (lot B) : voir `renoterBanc`.\n"
        "  'matching-engine': (a: Record<string, unknown>) => (a.mode === 'rescore-search' ? renoterBanc(a) : { ok: true, banc: true }),\n")

open(chemin, 'w', encoding='utf-8').write(s)
print(chemin, 'ok')
```

- [ ] **Step 4 : Le titre de l'état « Nominal »**

Dans `src/pages/dev/CrmShowcasePage.tsx`, remplacer `'10 contacts, 50 biens, 12 matchs, 2 rappels, 1 visite, journal à 4 lignes'` par `'10 contacts, 50 biens, 20 matchs, 4 rappels, 1 visite, journal à 4 lignes'` (m14 à m21, rb1 et rb2 ; le journal ne gagne aucune ligne au chargement).

- [ ] **Step 5 : Lancer, constater le succès**

Run : `npx vitest run tests/unit/banc-matching-boucle.spec.ts`
Expected : PASS, 5 tests.

Run : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS" ; npx eslint src/pages/dev/crmFixtures.ts src/pages/dev/CrmShowcasePage.tsx`
Expected : `0`, puis aucune erreur ni avertissement.

- [ ] **Step 6 : Relire l'écran** — c'est la Task 17.

- [ ] **Step 7 : Point de commit (au signal)**

⚠ Si `git diff src/pages/dev/crmFixtures.ts` montre des lignes de la pige non commitées, indexer un blob intermédiaire : le même script, appliqué à la version de `HEAD`.

```bash
git show HEAD:src/pages/dev/crmFixtures.ts > "$SCRATCH/crmFixtures.head.ts"
CIBLE="$SCRATCH/crmFixtures.head.ts" python3 "$SCRATCH/boucle_banc.py"
git update-index --cacheinfo 100644,"$(git hash-object -w "$SCRATCH/crmFixtures.head.ts")",src/pages/dev/crmFixtures.ts
git add src/pages/dev/CrmShowcasePage.tsx tests/unit/banc-matching-boucle.spec.ts
git diff --cached --stat
git commit -m "test(banc): la boucle du matching sur /dev/crm, notée par le vrai moteur"
```

Sinon, un simple `git add src/pages/dev/crmFixtures.ts` avec les deux autres fichiers.

---

### Task 17 : Relire la boucle sur le banc

**Files :** aucun (vérification à l'écran).

Banc : `http://localhost:5173/dev/crm?entree=/dashboard/matching`, état « Nominal », viewport de bureau (≥ 1280 px). Un rechargement remet les fixtures à neuf. Les dates ci-dessous sont relatives au jour de la relecture (JJ.MM).

- [ ] **Step 1 : « À proposer »**

Expected :
- les onglets lisent « À proposer 6 · En attente 3 · À conclure 2 » ;
- en tête, « Recherches à ajuster » : Julie Morand, « Prix · 2 refus ». Son panneau montre les deux biens refusés (Servette à CHF 1'560'000, Malagnou à CHF 1'580'000 avec sa note), « Abaisser son budget maximum à (CHF) » pré-rempli `1'550'000`, « aujourd'hui : CHF 1'600'000 » ;
- « Vos biens » : sous Villa individuelle · Cologny, Antoine Lefèvre porte « Prix baissé de CHF 250'000 » ; son panneau dit « Refusé par Antoine à CHF 3'450'000 · baissé de CHF 250'000 depuis » ;
- « Marché » : Emma (4 biens) et Julie (4 biens). Dans la sélection d'Emma, Seefeld porte « Refusé par Emma à CHF 2'590'000 · baissé de CHF 110'000 depuis ».

- [ ] **Step 2 : « Apprendre »**

Sur la correction de Julie, « Ajuster la recherche ».

Expected : toast « Recherche ajustée pour Julie · 1 bien retiré des propositions » ; la section disparaît ; « À proposer 5 » ; la ligne « Marché » de Julie passe à « 3 biens pas encore proposés » et son meilleur score à 97 (l'Attique des Eaux-Vives tombe de 100 à 94, Onex sort). Recharger, puis « Ignorer » : toast « Correction ignorée », la section disparaît.

- [ ] **Step 3 : « En attente » et « Retours de … »**

Expected :
- trois lignes dans cet ordre : Emma (« 2 biens proposés · relance due depuis le JJ.MM », icône d'écart), Julie (« 1 bien proposé · relance le JJ.MM · Prix baissé de CHF 50'000 »), Camille (« 1 bien proposé ») ;
- la feuille d'Emma a pour titre son nom et liste Oerlikon et Wollishofen, chacun avec « Intéressé I », « Pas intéressé N », « Pas encore P » ;
- `I` sur Oerlikon : le focus passe à « Intéressé » de Wollishofen, la ligne reste (« 1 bien proposé ») ; « Annuler » dans la barre : Oerlikon revient ;
- `N` : les huit puces s'ouvrent sous une note facultative, le focus sur « Prix 1 » ; `Échap` les referme et rend le focus à « Intéressé » ; `N` puis `3` : barre « « … » : pas intéressé·e (Surface) », et au DERNIER bien de l'acheteur, sa ligne sort ;
- `P` sur Julie : toast « Relance repoussée de 3 jours pour Julie », sa ligne lit « relance le » J+3.

- [ ] **Step 4 : « Intéressé » puis « Planifier la visite »**

Sur le dernier bien d'un acheteur, `I`, puis « Planifier la visite » dans la barre (avant qu'elle ne s'efface, ~4 s).

Expected : l'onglet passe à « À conclure », ce bien choisi, le focus sur la DATE ; le formulaire propose J+2 à 14:00, 45 min, et dit « Rien n'est envoyé à … : la visite entre dans votre agenda. » (bien en mandat) ou « Visite avec l'agence de l'annonce : … » (annonce du marché), avec « Voir l'annonce d'origine ».

- [ ] **Step 5 : « À conclure »**

Expected : « Planifier la visite » → toast « Visite planifiée avec Emma le JJ.MM.AAAA 14:00 », la ligne sort. Le Loft (pb32, mandat) apparaît ensuite dans le Calendrier comme visite ; une annonce du marché comme événement « Visite · … ». `V` porte le focus sur la date ; `N` ouvre les motifs.

- [ ] **Step 6 : Thème sombre, états, limites du banc**

Expected : en sombre, le filet de l'onglet actif et la bordure du bien dont on choisit le motif sont en bleu clair (`blue300`), aucun aplat teinté sous du texte. « Vide » : « Tout est à jour », sans onglets. « Échec » : l'erreur et « Réessayer ».

⚠ Limites CONNUES du banc, qui ne joue aucun trigger : une réponse consignée n'y est pas datée (elle passe en dernier dans « À conclure ») ; une relance de sélection n'y est pas close ; un bien revenu puis reproposé y garde son ancien prix proposé ; aucune ligne `match_reaction` au journal. La spec backend (Task 2) prouve ces comportements en base.

---

### Task 18 : Les portes, puis la suite complète

**Files :** aucun.

- [ ] **Step 1 : Les portes**

Run, l'une après l'autre :
- `npx tsc -b` → aucune erreur ;
- `npm run lint` → `0 errors` (aucun avertissement neuf dans les fichiers du lot : le seul du fil, `setPivotConsomme`, lui est antérieur) ;
- `npm run lint:deadcode` → « Aucun export mort » ;
- `npm run i18n:parity:ci` → « 0 manquante(s), 0 orpheline(s) » ;
- `npm run lint:prose` → « Typographie MEGGA OK » ;
- `npm run lint:i18n` → « 0 texte FR en dur » ;
- `npm run lint:migrations` → « Migrations rejouables », « Versions uniques » ;
- `npm run lint:types-freshness` → « Typage Supabase » vert (contrôles statiques sans `SUPABASE_ACCESS_TOKEN`) ;
- `npm run lint:spec-sql` → « Blocs SQL équilibrés » ;
- `deno check --no-lock supabase/functions/matching-engine/index.ts supabase/functions/_shared/matching-renotation.ts` → `Check …` sans erreur ;
- `npm run lint:claude-md` → « 24 prétention(s) … aucun écart » (sans jeton ; les 17 de base tournent en CI).

- [ ] **Step 2 : La suite complète, SEULE**

Run : `npm run test:unit` (rien d'autre ne tourne en même temps).
Expected : vert, sauf les trois échecs connus et étrangers à ce lot — `supabase/functions/_shared/mail/imap.test.ts` et `mime-parse.test.ts` (import `npm:postal-mime@3.0.0` non résolu localement) et `tests/unit/safe-internal-path.spec.ts` (« valeur BRUTE `javascript:` »). Relevé sur une copie du dépôt au 21.09.2026, le lot appliqué : 3 fichiers en échec, 316 verts ; 1 test en échec, 4 442 verts, 3 sautés. Un échec de plus se relance d'abord SEUL (délais de 5 s dépassés sous charge), puis se lit.

- [ ] **Step 3 : La CI de la PR**

La spec backend `tests/backend/matching-boucle.spec.ts` ne tourne qu'en CI (`backend.yml`, `supabase start`) : c'est elle qui prouve les triggers, la RPC et le mode `rescore-search`. La regarder passer à l'ouverture de la PR — et vérifier `gh pr view --json mergeable` : une PR en conflit n'a AUCUN run (CLAUDE.md §8).

---

### Task 19 : Le cerveau

**Files :**
- Modify : `.claude-flow/knowledge/megga-memory.seed.json` (PARTAGÉ avec la pige)
- Modify : `docs/system-map.md` (PARTAGÉ avec la pige)

- [ ] **Step 1 : Le seed**

Le script relit le seed à l'exécution, vérifie son format, et ne touche qu'à ses trois entrées. L'enregistrer dans le scratchpad (`$SCRATCH/cerveau_boucle.py`) ; `CIBLE=<fichier>` l'applique à une autre copie (Step 5).

Run : `python3 $SCRATCH/cerveau_boucle.py`
Expected : `… megga-memory.seed.json ok`.

```python
"""Lot B, Task 19 : megga/matching-boucle (nouvelle), et un renvoi depuis megga/matching-fil et megga/matching-sans-sortie."""
import json
import os

chemin = os.environ.get('CIBLE', '.claude-flow/knowledge/megga-memory.seed.json')
brut = open(chemin, encoding='utf-8').read()
seed = json.loads(brut)
assert json.dumps(seed, ensure_ascii=False, indent=2) + '\n' == brut, 'mise en forme inattendue'
entrees = {e['key']: e for e in seed['entries']}
assert 'megga/matching-boucle' not in entrees, 'déjà appliqué'

BOUCLE = (
    "LA BOUCLE CHEZ L'AGENT, DANS LE FIL (lot B, 21.09.2026 ; conception docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md "
    "§4.3 à §4.6, §5 et §12 ; plan docs/superpowers/plans/2026-09-21-matching-lot-b-boucle.md). BANC SEUL (/dev/crm?entree=/dashboard/matching) : "
    "l'atelier en production ne change pas, le fil le remplace au lot E. "
    "EN BASE (migration 20260921140000_matching_boucle ; à RENOMMER au jour de la fusion si elle a lieu après le 21.09, date-guard de deploy.yml, "
    "en gardant l'ordre : après le lot A 130000, avant la pige 145000/150000) : matches.prix_propose posé par TRIGGER set_match_prix_propose au "
    "passage à sent (une sélection propose N biens en UNE écriture, à N prix, et quatre écrivains proposent ; la même transition efface motif, "
    "note et apprentissage_at) ; matches.apprentissage_at (un refus pris en compte par « Apprendre », correction validée OU ignorée) ; "
    "matches_reaction_motif_check NOT VALID (prix, quartier, surface, pieces, type, equipements, etat, autre, recherche_ajustee) ; "
    "reminders.match_ids uuid[] (TOUS les biens d'une proposition ; match_id garde le meilleur pour les lecteurs d'avant) et le trigger "
    "fermer_relance_proposition (un match qui QUITTE sent clôt la relance qui le couvre si plus aucun de ses biens n'est sent, quel que soit "
    "l'écrivain) ; log_match_reaction inscrit le motif ; match_retour_prix_annonce / _mandat : sur une BAISSE de prix seulement (clause WHEN : "
    "le coût est celui des baisses du jour, pas des 96 511 annonces actives), un refus « prix » repasse suggested EN GARDANT motif et "
    "prix_propose, ligne match_retour_prix ; RPC matching_appliquer_notes (service_role seul) ; idx_matches_boucle. "
    "MOTEUR : matching-engine, mode rescore-search (module pur _shared/matching-renotation.ts) : renote les suggested de la recherche par "
    "calculateScoreV2 avec les critères CORRIGÉS (sous le seuil : ignored, motif recherche_ajustee), PUIS pose les critères (et sur la fiche si "
    "elle portait les mêmes : sinon le pont sync_contact_client_search les remettrait), PUIS marque les refus, PUIS UNE ligne recherche_ajustee ; "
    "un échec au milieu laisse la correction à l'écran et se rejoue. Un match sans score_version (ajouté à la main par la Recherche) n'est pas renoté. "
    "ÉCRAN : filBoucle.ts (onglets À proposer / En attente / À conclure ; En attente = une ligne par ACHETEUR, relance échue en tête ; "
    "À conclure = un intéressé par ligne, la réponse la plus ancienne d'abord ; signalPrix lit prix_propose, jamais le premier prix de l'annonce), "
    "filApprendre.ts (au 2e refus d'un même motif PAR RECHERCHE : prix → budget maximum sous le prix PROPOSÉ le plus bas, 10 000 ou 50 ; "
    "surface → multiple de 5 m² au-dessus ; pièces → +0,5 ; quartier → la zone de ville sort, le canton qu'elle nomme reste en code ; "
    "type → celui des acceptés ; équipements → ceux de TOUS les acceptés ; état et autre : rien ; familles de types et cantons du moteur "
    "recopiés et confrontés par spec). Gestes (useAtelierMatching) : execRepondre, execPasEncore (relance +3 j de la proposition, rien sur le "
    "match), execPlanifierVisite (mandat → visits avec reminder_sent posé : le rappel J-1 écrirait au client ; marché → calendar_events type "
    "visite ; deal avancé à visit_planned, jamais en arrière ; aucune invitation), execAjusterRecherche, execIgnorerCorrection. Intéressé et "
    "Pas intéressé (motif en une puce, touches 1 à 8) passent par la fenêtre d'annulation ; la barre offre « Planifier la visite » après "
    "Intéressé ; Pas encore, la visite et la correction écrivent tout de suite. FRANÇAIS : jamais « de {{prenom}} » (« d'Emma ») — la feuille "
    "« Retours » a pour titre le NOM. BANC : annonces ml-boucle-1..8, matchs m14..m21, relances rb1 / rb2, m5 et m20 revenus par une baisse ; "
    "le matching-engine du banc porte les notes du cas Julie 1'550'000, confrontées au moteur par tests/unit/banc-matching-boucle.spec.ts. "
    "EN ATTENTE (section du plan) : le rappel J-1 des AUTRES visites, le pont des recherches, la relance close par match_id dans l'atelier "
    "et le mobile, la renotation de toute recherche modifiée, max_rows sur la boucle."
)
seed['entries'].append({
    'key': 'megga/matching-boucle',
    'namespace': 'megga',
    'value': BOUCLE,
    'tags': 'matching,fil,lot-b,boucle,apprendre,prix-propose,relance,visite,2026-09-21',
})
RENVOI = "⛔ 21.09.2026, LOT B : la BOUCLE est dans le fil (En attente, À conclure, Retours, motifs, visite, Apprendre) — voir megga/matching-boucle. "
entrees['megga/matching-fil']['value'] = RENVOI + entrees['megga/matching-fil']['value']
ANCIEN = "LIMITE connue (lot B) : la relance d'une sélection est attachée au meilleur match seulement."
assert ANCIEN in entrees['megga/matching-sans-sortie']['value'], 'phrase de megga/matching-sans-sortie introuvable : la relire'
entrees['megga/matching-sans-sortie']['value'] = entrees['megga/matching-sans-sortie']['value'].replace(
    ANCIEN, "Réglé au lot B : reminders.match_ids et le trigger fermer_relance_proposition (megga/matching-boucle).")
open(chemin, 'w', encoding='utf-8').write(json.dumps(seed, ensure_ascii=False, indent=2) + '\n')
print(chemin, 'ok')
```

- [ ] **Step 2 : La carte système**

Dans `docs/system-map.md`, relu juste avant (la pige y écrit aussi), au paragraphe **E · Matching & alertes**, juste APRÈS la phrase « Alertes email publiques (`market_alerts`/`search-alert` cron via Resend) inchangées. », ajouter (même paragraphe, précédé d'une espace) :

```
**La boucle chez l'agent (lot B, 21.09.2026, fil sur le banc)** : `matches.prix_propose` posé par trigger au passage à `sent` ; une relance de proposition couvre TOUS ses biens (`reminders.match_ids`) et se clôt quand plus aucun n'attend (`fermer_relance_proposition`) ; un refus « prix » revient à `suggested` sur une BAISSE de prix (`match_retour_prix_*`) ; « Apprendre » corrige une recherche au 2ᵉ refus d'un même motif, et `matching-engine` (mode `rescore-search`) renote ses matchs à proposer par le vrai barème. Cf. `megga/matching-boucle`.
```

- [ ] **Step 3 : Semer et interroger**

Run : `npm run ruflo:seed`
Run : `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "la boucle du matching chez l'agent, relance d'une sélection et retour d'un bien par une baisse de prix" -n megga`
Expected : `megga/matching-boucle` dans les premiers résultats. (Une PHRASE, jamais un mot seul : sous le plancher de score, la recherche répond « no results » sur un cerveau plein.)

- [ ] **Step 4 : Vérifier**

Run : `npm run lint:claude-md`
Expected : aucun écart (le paragraphe ajouté ne porte aucune prétention chiffrée enregistrée).

- [ ] **Step 5 : Point de commit (au signal)**

⚠ Si la pige a encore des modifications non commitées dans le seed ou la carte, indexer des blobs intermédiaires : `git show HEAD:<fichier>` dans le scratchpad, y rejouer le script (`CIBLE=…`) ou l'ajout du Step 2, puis `git update-index --cacheinfo 100644,"$(git hash-object -w <copie>)",<fichier>` et `git diff --cached`.

```bash
git add .claude-flow/knowledge/megga-memory.seed.json docs/system-map.md
git diff --cached --stat
git commit -m "docs(cerveau): la boucle du matching chez l'agent, lot B"
```

---

## En attente

Relevé en préparant ce lot, hors de son périmètre (feuille de route : à Julien de le placer dans une étape).

1. **Le rappel J-1 des AUTRES visites écrit au client.** `visit-reminders-j1` → `send-visit-email` envoie un rappel à l'acheteur pour toute visite `planned` ou `confirmed` dont `reminder_sent` est faux, dans la fenêtre de 12 à 36 h (migration `20260903211000`). Le fil l'évite (`reminder_sent` posé à la création) ; `VisitNewPage`, « Planifier une visite » de la fiche d'un bien et l'outil `schedule_visit` du copilote — dont la description promet de n'envoyer rien — ne l'évitent pas. À trancher : un rappel au client est-il voulu, et validé par qui (CLAUDE.md §5) ?
2. **L'interrupteur `emailVisitor` de `VisitNewPage`** est enregistré et jamais lu (même famille que les automatisations que `PlanifierVisite` a cessé de promettre).
3. **Le pont des recherches** (`sync_contact_client_search`) désactive les recherches d'un contact dont la fiche n'a pas de critères — 3 acheteurs sur 4 en production — et réécrit TOUTES ses recherches à chaque enregistrement de la fiche. Une correction d'« Apprendre » n'est posée sur la fiche que si elle portait les mêmes critères ; sinon, un enregistrement de la fiche pourrait l'effacer. À traiter avec le lot E.
4. **Une recherche modifiée AILLEURS garde ses anciennes notes** : seule une correction d'« Apprendre » renote (`rescore-search`). `trigger_matching_on_search_updated` ne fait que chercher de nouveaux biens (`match-contact`, asynchrone). Renoter à chaque modification ? À décider au lot E (conception du fil, §13).
5. **La relance d'une sélection, dans l'atelier et le mobile** : `execReact` la clôt par `match_id` dès la réponse au meilleur bien, avant le trigger — les autres biens perdent leur suivi. Inchangé ici (l'atelier ne change pas) ; disparaît avec l'atelier au lot E.
6. **Lot D** : « Aujourd'hui » ne dit pas encore « Prix baissé de … sur le bien proposé à Julie » ni « Retour de Julie sur 2 biens » (qui ouvrirait « Retours » : un lien d'arrivée `?onglet=` sera à ajouter au fil) ; « Sa boucle » (fiche contact) montre le CODE du motif (`prix`), pas son libellé.
7. **Lot C** : un équipement OBLIGATOIRE demande un critère du moteur (il note en fraction) ; les lignes à signal devant les autres à score égal (conception §4.1).
8. **Décision n° 3 de Julien** (feuille de route) : la liste des motifs, le délai de 3 jours, la correction « prix » modifiable — ce plan applique la proposition. Changer la liste demandera une migration (le CHECK), `MOTIFS_REFUS` et les quatre langues.
9. **Français, élision** : des chaînes d'avant ce lot écrivent « de {{prenom}} » (`recherche.ajouter` « à la sélection de Emma »), et le texte d'une relance est bâti en code (« Retour de Emma Schneider sur 2 biens proposés », `execProposer`, `execProposerSelection`). Ce lot ne le fait nulle part ; les anciennes restent à reprendre.
10. **La garde i18n ne lit pas le fil** : `src/components/matching-fil/**` n'est pas une famille verrouillée de `lint:i18n` (`eslint.config.js` et `scripts/lint-i18n-hardcoded.mjs`). À ajouter à la bascule (lot E), avec `tests/unit/i18n-globs-vivants.spec.ts`.
11. **Le banc** : les biens y ont `transaction_type = 'sale'` quand le moteur écrit `buy` ; m1 apparie une LOCATION à une recherche d'achat ; r1 et r2 portent une colonne `title` que `reminders` n'a pas ; ml-boucle-3 et ml-boucle-7 ont baissé sans ligne `market_price_history` (la pige n'en pose que pour `ANNONCE_MARCHE_BANC`, dans sa section du fichier).
12. **`docs/schema.md`** ne connaît pas les colonnes de suivi de `matches` (`sent_at`, `response_at`, `reaction_*`) ni celles de ce lot.
13. **`max_rows`** : la boucle se lit sans pagination (0 ligne en production le 21.09.2026, servie par `idx_matches_boucle`). Au-delà de 1 000 matchs répondus par agence, PostgREST tronquerait en silence — à surveiller avant la bascule.
14. **Après une correction**, `trigger_matching_on_search_updated` relance `match-contact` : des biens NOUVEAUX peuvent entrer dans la sélection de l'acheteur quelques secondes plus tard. Attendu, mais l'écran ne l'annonce pas.
15. **Consigner la réponse sans passer par « Proposé »** (conception §4.3 : l'agent propose pendant l'appel) : aujourd'hui deux gestes — E dans « À proposer », puis la réponse dans « En attente ». Un geste combiné (proposer et répondre, `prix_propose` compris) n'est pas dans la liste de l'étape 1a.

## Questions

Aucune question bloquante : ce plan applique les propositions de la conception (les huit motifs, la relance à 3 jours, la correction « prix » pré-remplie et modifiable), et les points ouverts vont dans « En attente ». Le seul arbitrage fait ici que Julien pourrait vouloir revoir : une visite planifiée depuis le fil ne déclenche PAS le rappel J-1 au client (`reminder_sent` posé à la création), pour tenir « rien ne sort vers le client ».
