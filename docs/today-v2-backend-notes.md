# Today V2 « concept H » — notes backend et plan d'hydratation

> Établi le 3 août 2026, à l'installation du port front (`PageAujourdhuiH`).
> Source côté design : `design_handoff_today_v2/` (pack du 3 août 2026), §2 « Architecture backend ».
> Source côté réel : schéma live `eayczugyrvmtqnnmvjod` + 259 migrations + `src/hooks/`.
>
> **Ce document existe parce que le §2 du handoff décrit un backend qui n'est pas
> celui de MEGGA.** Il ne le contredit pas sur l'intention ; il corrige les noms,
> et signale les endroits où l'appliquer à la lettre casserait quelque chose.

---

## 0 · Où on en est

Le front est installé et fidèle : `PageAujourdhuiH` rend le bento complet
(journée, dossiers/annonces, « Pendant ton absence », What's new, popover de
bloc, overlay groupé).

**✅ Lot 0 livré** (`useTodayH`) — décision d'architecture prise : **pas de
`today_payload` monolithique**, on compose bloc par bloc. Sont réels :

| Bloc | Source |
|---|---|
| prénom de l'en-tête | `useAuth().profile.full_name` |
| la journée + fenêtre libre | `useCalendarSugar` (visites ∪ rappels ∪ RDV), fenêtre dérivée |
| What's new | `get_agent_changelog` |
| total du Pipeline | `usePipelineSugar` |

**✅ Lot 1 livré** — « Pendant ton absence » est vivant : réactions acheteur
bornées par la présence, rappels échus de l'agence, groupés par nature.

Restent en démonstration, et **l'écran le dit** (repère « Démo ») : Dossiers et
Annonces (Lot 3).

Trois principes tenus dans ce lot, à ne pas défaire :
- **aucun repli sur la démo** — une journée vide s'affiche « Journée dégagée » ;
- **rien de fabriqué** — pas de `risk` par événement, pas de note IA inventée ;
- **aucun bouton mort** — un CTA sans référence routable ouvre la liste.

Garde-fou : [tests/unit/today-h-day.spec.ts](../tests/unit/today-h-day.spec.ts)
(19 cas, éprouvés par mutation : forcer la durée à 1 h en casse 4).

⚠️ **L'ancien cockpit `PageAujourdhui` n'est plus rendu, mais reste au dépôt.**
C'est lui qui porte le câblage Supabase vivant (`useFocusQueue`, `AgendaTile`
sur `useCalendarSugar`, `PipelineTile`, `ObjectifTile`, `RelancesTile`). Il est
exempté du garde-fou code mort avec ce motif, dans
[scripts/check-dead-exports.mjs](../scripts/check-dead-exports.mjs). Le supprimer
avant d'avoir hydraté le concept H reviendrait à jeter le câblage qu'il faut
reprendre.

---

## 1 · Le contrat que le front lit VRAIMENT

Le §2.1 du handoff décrit un payload `today_payload` qui **n'a pas la forme des
composants**. Deux divergences, à trancher avant d'écrire la moindre ligne de SQL :

| Handoff §2.1 | Ce que les composants lisent (`dataH.ts`) |
|---|---|
| `day.blocks[].from_min` / `dur_min` | `from` / `dur` (minutes depuis minuit — même sémantique, autre nom) |
| `day.blocks[].contact: { id, name, initials, color, role }` | `contact` (string), `initials`, `av`, `role` — **aplati** |
| `day.blocks[].property: { photo_url, price_chf, place }` | `photo`, `price` (string CHF déjà formatée), `place` — **aplati** |

**Décision à prendre : qui s'adapte ?** Le plus sain est que le serveur renvoie
la forme imbriquée du handoff (elle est plus juste : elle porte des `id`, donc
des CTA routables) et qu'un **mapper unique** dans `dataH.ts` l'aplatisse. Ça
évite d'inventer un contrat serveur bâtard, et ça garde les composants intacts.

⚠️ Le handoff impose « montants en CHF entiers côté serveur, apostrophes côté
client ». Le prototype stocke déjà `"CHF 890'000"` en dur. Le mapper doit donc
appeler `formatCHF()` — pas recopier une chaîne du serveur.

---

## 2 · État réel du backend, bloc par bloc

Mesuré, pas déduit. `✅` = existe et sert · `🔶` = existe sous un autre nom ou
partiellement · `❌` = à construire.

| Bloc du payload | État | Ce qui existe réellement |
|---|---|---|
| `agent` | ✅ | `profiles` + `useAuth` — **déjà branché** dans la page |
| `kpis` | ✅ | `analytics_cockpit` (RPC) |
| `objectif` | ✅ | `analytics_objectif` + `analytics_set_target` |
| `catalogue` | ✅ à ~95 % | `focus_top_matches` (gating + cap + anti-IDOR **en SQL**) |
| `day.blocks` | 🔶 | la fusion 3 sources est **déjà écrite** : `useCalendarSugar` (visits ∪ reminders ∪ appointments) |
| `day.free_windows` | 🔶 | `_shared/booking-slots.ts` — algorithme écrit **et testé**, mais derrière un endpoint public à jeton |
| `news` | 🔶 | `get_agent_changelog(p_limit)` — **déjà livré, aucun appelant** |
| `hot_deals` | 🔶 | deux sources partielles (`usePipelineSugar`, contacts `hot`/`warm`) ; aucun classement « dossier chaud » |
| `listing_actions` | 🔶 | `property_syndications` réelle, mais les actions agent sont en **localStorage** (`useExternalListingActions`) |
| `relance` | 🔶 | `useRelanceLeads` réel ; la **session** n'est persistée nulle part |
| `absence` | ❌ | **zéro backend** — ni table, ni colonne, ni concept |

### Correspondance des noms — le handoff se trompe sur 7 tables sur 14

| Handoff | Réalité |
|---|---|
| `calendar_events` | éclatée en **`visits`** + **`appointments`** + **`reminders`** |
| `match_scores` | **`matches`** |
| `match_transmissions` | **`buyer_reception_links`** |
| `match_reactions` | **colonnes de `matches`** (`reaction_motif`, `reaction_note`…), écrites par `record_buyer_reaction` (service_role) |
| `deals` | **`transactions`** (« deal » est du vocabulaire d'UI) |
| `product_news` | **`admin_changelog`** |
| `catalogue_proposals` | **`buyer_reception_links`** (équivalent fonctionnel complet) |
| `listings` | ⛔ **n'existe plus** — droppée le 18.07.2026 (`20260718152000_audit_p2_drop_dead_tables.sql`). Elle apparaît encore dans le baseline : un grep la trouve, `to_regclass` rend `NULL`. Les vraies tables sont `properties` / `market_listings`. |
| `ai_insights`, `agent_presence`, `signal_acks`, `relance_sessions` | n'existent pas, aucun équivalent |
| `reminders`, `activity_events` | existent telles quelles |

Côté RPC : **aucune des 11 du handoff n'existe sous ce nom**, mais 8 ont un
équivalent opérationnel (dont `matching_recalibrate` → edge `matching-engine`
mode `match-contact`, et `catalogue_propose` → edge `buyer-reception-create`).
Trois sont réellement à construire : `presence_touch`, `signal_ack`,
`relance_session_*`.

---

## 3 · Les six pièges qui coûteraient cher

1. **Le mur n'est pas « il manque du backend », c'est « il en existe déjà trop,
   sous d'autres noms ».** Le vrai risque est la duplication : recréer
   `match_scores` à côté de `matches`, ou un `today_payload` monolithique à côté
   de `focus_top_matches` + `analytics_cockpit`, qui font déjà le gating et
   l'anti-IDOR en SQL. Composer, ne pas réécrire.

2. **`ai_note` par bloc contredit une décision d'architecture écrite.**
   `useFocusQueue.ts` pose « DÉTERMINISTE + EXPLICABLE … 0 LLM ». Une note IA par
   événement d'agenda réintroduit un appel LLM par chargement de page, et affiche
   du texte non validé à côté d'un rendez-vous client. **Décision produit, pas
   d'implémentation.**

3. **`day.blocks[].risk` fabriquerait un signal.** `transactions` n'a aucune
   colonne de risque : le `risk` du CRM est dérivé de `status` et ne prend que
   trois valeurs — et il est au niveau **deal**, pas **événement**. Au niveau d'une
   visite ou d'un rappel, il n'a aucune source.

4. **`news` : ne pas relire `admin_changelog` en direct.** `get_agent_changelog`
   ampute volontairement sa projection ; la migration explique qu'une lecture
   directe exposerait `author_id`, `status` et `scheduled_for` — le calendrier
   éditorial interne — et elle a dû fermer une fuite réelle (`revoke select …
   from anon`). Corollaire : la pilule « Nouveau » n'a **pas** de source, l'état
   lu/non-lu a été **refusé explicitement**, pas oublié. `news_mark_read` est donc
   à ne pas construire sans rouvrir ce débat.

5. **`free_windows` : ne pas élargir la porte publique.** `appointment-slots` est
   conçu pour ne **jamais** révéler le contenu de l'agenda. Il faut une **seconde**
   porte authentifiée qui réutilise `computeSlots`, surtout pas assouplir celle-ci.

6. **`dur_min` : le code actuel ment, et son commentaire aussi.**
   `useCalendarSugar.ts:68` force 1 h « à raffiner si la table porte une durée » —
   or `visits.duration_minutes` **existe**. Hydrater sans corriger graverait un
   60 min inventé dans le payload serveur. Et `reminders` n'aura jamais de durée
   honnête : assumer un `null`, pas les 30 min forcées.

### Deux mécaniques d'acquittement existent déjà — n'en créez pas une troisième

`signal_acks` serait la **troisième** : il y a déjà le localStorage des
notifications (`activity_events` est immuable — trigger
`enforce_activity_events_immutability`) et le snooze en base
(`matches.snoozed_until`, `reminders.status='snoozed'`). Et `useFocusQueue`
**interdit explicitement** d'écrire `matches.status`/`sent_at` sur un geste
« Fait » : ça fausserait le pipeline matching et les analytics.

### Convention d'agence : une seule est bonne

`focus_top_matches` tire l'agence **du JWT** (anti-IDOR) ; `matching-engine` la
reçoit **du client** dans le body. Toute nouvelle surface suit la première.

---

## 4 · Plan proposé

Il diffère de celui du handoff (§2.8) sur un point : le handoff met l'absence
dans le Lot 0 comme le reste. Or c'est le seul bloc à **zéro backend**, et le
plus visible de la page. Il mérite son propre lot.

**Lot 0 — hydrater ce qui existe déjà (aucune table nouvelle). ✅ FAIT.**
`day.blocks` (via `useCalendarSugar`, `duration_minutes` corrigé au passage — la
colonne existait et le code forçait 1 h) · `news` (via `get_agent_changelog`) ·
total du Pipeline · deep-links `navigate(id, ref)`.
⚠️ `kpis`, `objectif` et `catalogue` ne sont **pas** de ce lot : le concept H ne
les rend pas (le catalogue est la page 1, déjà câblée ; `kpis`/`objectif` étaient
des tuiles de l'ancien cockpit, supprimées par la refonte).

**Lot 1 — présence et absence. ✅ FAIT** (migration `20260803120000`, appliquée
le 03.08.2026). `agent_presence(agent_id, last_seen_at)` + `presence_touch()` +
`today_absence(p_fallback_hours)`.

Trois décisions prises, et pourquoi :

1. **Aucune table `signal_acks`.** Elle aurait été la *troisième* mécanique
   d'acquittement du dépôt. On s'en passe : **la présence EST l'acquittement** —
   « Tout marquer comme vu » avance `last_seen_at`, ce qui vide le fil par sa
   borne. L'écartement d'UNE ligne reste local à la session, comme dans la
   maquette ; sa disparition durable viendra du geste (Lot 2).
2. **Deux régimes, volontairement asymétriques.** Les réactions acheteur sont
   bornées par `last_seen_at` (ce sont des ÉVÉNEMENTS) ; les rappels échus ne le
   sont **pas** (ce sont des choses qui ATTENDENT). Motif mesuré : les 9 rappels
   échus de la base datent d'avril à juillet, donc antérieurs à toute fenêtre
   d'absence — les borner afficherait « Tu es à jour » à un agent qui a trois
   mois de retard. Verrouillé par un test.
3. **Pas de groupe « MEGGA AI ».** Aucune table d'insight par événement ; en
   fabriquer un supposerait un LLM par signal. Le fil sort à deux groupes.

⚠️ **Constat de production (03.08.2026) : zéro réaction acheteur, zéro lien de
réception en base.** Le groupe « Retours acheteurs » sortira donc vide tant que
la boucle de match n'aura pas servi. Ce n'est pas un défaut du code — c'est que
la fonctionnalité n'a jamais tourné.

Garde-fou : [tests/backend/today-absence.spec.ts](../tests/backend/today-absence.spec.ts).

**Lot 2 — gestes. ⚠️ PARTIELLEMENT FAIT — et c'est la mesure qui l'a réduit.**

✅ **`reminder_resume` livré, sans une ligne de SQL.** « Reprendre » marque le
rappel traité (`status='done'` + `completed_at`), le journalise dans
`activity_events` (`reminder_resumed`), invalide le fil ET la journée, puis ouvre
la fiche. Si l'écriture échoue, on ne navigue pas et on le dit.
Vérifié avant d'employer ce chemin : `reminders` n'a **aucun trigger**, et la
seule fonction qui lit `reminders`+`done` est `contact_next_action`, en LECTURE.
La RLS `reminders_update USING (agency_id = get_user_agency_id())` est le seul
verrou — deux cas de test la couvrent, dont l'écriture croisée entre agences.

⛔ **`visit_propose` et `matching_recalibrate` : NON livrés, à dessein.** Ils
n'ont rien à traiter. La base compte **0 réaction acheteur et 0 lien de
réception** : les deux gestes ne pourraient être ni exercés ni éprouvés. Les
construire maintenant, ce serait écrire du code qu'aucun test ne peut atteindre.
Ils redeviennent pertinents le jour où la boucle de match aura servi une fois.
En attendant, leurs CTA **emmènent** vers la fiche du contact.

⛔ **`event_mark_done` : bloqué par une QUESTION PRODUIT, pas par la technique.**
Le popover de la maquette n'expose aucun bouton « Terminé » — seulement un badge
d'état (vérifié dans `today-h-live.jsx` : ses deux seules actions sont le CTA et
« Ouvrir dans le calendrier »). Le §2.4 du handoff demande pourtant le RPC. Le
composant qui portait ce geste, `HlDossier`, existe dans la maquette mais **n'est
jamais rendu** : le popover l'a remplacé et a perdu le bouton au passage.
Il faut donc trancher : *ajouter un bouton que la maquette ne montre pas, ou
accepter que « fait » reste un état de donnée sur cet écran ?* Tant que ce n'est
pas tranché, construire le RPC serait livrer une porte sans poignée.
⚠ Quand il sera tranché : trois chemins d'écriture coexistent selon la source
(`reminders` en UPDATE direct, `visits` par trigger de statut, `appointments` en
RPC `service_role`) — un RPC unique doit **router**, jamais aplatir.

**Lot 3 — dossiers chauds et annonces.** `hot_deals` demande un classement qui
n'existe pas ; `listing_actions` demande de faire passer
`useExternalListingActions` du localStorage à la base. ⚠ `listing_publish_portal`
ne débloquerait **rien** : le go-live est bloqué chez le tiers (accès FTP,
`idx_enabled` à `false`) — le RPC livrerait un bouton qui écrit `queued` sans que
rien ne parte.

**Lot 4 — session de relance.** `relance_sessions` / `relance_items`. Aujourd'hui
une session interrompue est perdue : les seules traces sont `ai-copilot`,
`send-relance-email` et un insert d'audit.

### Hors périmètre, dit par le handoff lui-même

- **C2PA** : la carte annonce « 2 photos sans certificat C2PA » est un motif de
  **démo à ne pas implémenter** (handoff §2.7). Le feed live ne produit que des
  motifs réels : brouillon incomplet, non poussée portail, retours acheteurs.
- **Portail unique V1 = Immobilier.ch.** N'en présenter aucun autre comme actif.

---

## 5 · Dette front laissée en l'état, à trancher

1. ~~Cinq CTA sans cible.~~ **Résolu au Lot 0** : `TodayNav.navigate(id, ref)`
   transporte l'identifiant réel, `TodayPage` route
   `contact-detail`/`deal-detail`/`visite-detail`/`biens-detail`, et un CTA sans
   référence ouvre la LISTE au lieu de ne rien faire.
2. **Seuil de molette du pager : 560 (maquette) vs 36 (code), timer 220 ms vs
   180 ms.** Écart introduit au portage de juin, sans commentaire. Non touché ici :
   c'est le geste que l'agent connaît aujourd'hui. À confirmer ou restaurer.
3. **Tiret cadratin.** Le pack en utilise dans les libellés d'interface ;
   `scripts/check-prose-typography.mjs` l'interdit dans `src/i18n/locales/**`.
   Les chaînes d'interface portées utilisent donc « · » ou une virgule. Les textes
   de **données** (`dataH.ts`) gardent le tiret du pack : ils ne sont pas dans les
   locales.
4. ~~Mobile.~~ **Fait.** `MobileTodayHScreen` porte la maquette mobile du pack et
   lit les mêmes hooks que le desktop — il hérite des lots 0 et 1 sans logique
   dupliquée. Seule différence assumée : il expose le bouton « fait », que la
   maquette mobile porte et que la maquette desktop n'a pas. Il ne crée aucun
   chemin d'écriture : `markBlockDone` route vers ceux du Calendrier et refuse
   les rendez-vous de vérification.
   ⚠ L'ancien cockpit mobile reste au dépôt : `/dev/mobile` le consomme, et sa
   galerie a besoin du mode `demo` que le nouvel écran n'a pas — par choix.
