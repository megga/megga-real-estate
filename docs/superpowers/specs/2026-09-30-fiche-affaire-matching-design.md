# Pipeline · la fiche d'affaire branchée sur le matching (conception)

**Date :** 30.09.2026 · **Statut :** validé par Julien le 30.09.2026, section par section · **Étape 5b-1** de la [feuille de route](../feuille-de-route.md) (5b, « Pipeline et KYC branchés sur le matching », coupée en deux : 5b-1 la fiche d'affaire, 5b-2 le KYC) · Branche `megga/fiche-affaire-matching`, partie de `main` (`d4b5e2d9`) · Un prototype jetable, monté hors dépôt sur le banc `/dev/crm` avec ses données, a servi à valider le §4 (fiches de Julie Morand en Recherche et d'Anastasia Volkova en Visites).

## 1. Les décisions

La fiche d'une affaire (`DealDetailPage`, Pipeline refait le 27.09.2026) dit où en est chaque bien de l'acheteur dans le matching, et son historique dit d'où vient l'affaire. Rien n'est écrit en base ; rien ne part vers l'acheteur.

Décisions de Julien, le 30.09.2026 :

1. **L'étape 5b est coupée en deux.** 5b-1, la fiche d'affaire, maintenant ; 5b-2, le KYC, une fois le KYC refait commité dans sa session et ramené sur `main` (§10).
2. **Quels biens (question 1, réponse A)** : tous les biens de l'acheteur dans le matching, rangés par état, comme « Sa boucle ». Une affaire d'acheteur est son parcours : le fil lui rattache tous ses biens (`rattacherDeal`).
3. **Quand (question 2, réponse A)** : en Prospects, en Recherche et en Visites — tant que l'affaire cherche son bien. À partir de l'Offre, la fiche se concentre sur le bien négocié ; le bloc revient si l'affaire revient en Recherche.
4. **L'historique (question 3, réponse A)** : chaque étape du matching liée à l'affaire y devient une ligne ; il passe de 8 à 12 lignes.
5. **L'approche 1** : côté écran, avec les règles du fil ; ni migration, ni fonction de base, ni fonction serveur.
6. **Les trois sections** — le bloc (§4), l'historique (§5), l'architecture et les tests (§6 à §9) — validées une à une.

Tranché en route, sans question : **une affaire sans acheteur n'a pas de bloc** — la modale « Nouvelle affaire » n'en crée pas, la fiche ne les traite que dans le titre d'une section, et la production n'en compte aucune.

## 2. Ce qu'on a mesuré

En production le 30.09.2026 (lecture seule), et dans le code de `main` (`d4b5e2d9`) :

| Sujet | Ce qui existe | Ce qui cloche |
|---|---|---|
| **La production** | 4 affaires, toutes « Nouveau lead » et actives, aucune côté vendeur seul ; 1 950 matchs, tous à proposer | Aucun `match_propose`, `visit_scheduled` ni `match_reaction` au journal : la boucle, fusionnée le 29.09.2026, n'a pas encore tourné. L'historique neuf se remplira à l'usage |
| **Le bloc « Biens à proposer »** | La branche par défaut du contenu de phase (`phaseContenu`) : Prospects et Recherche, sans offre, affaire ni conclue ni perdue. Les 3 meilleurs matchs de l'acheteur (`useFicheAffaire`, statuts `suggested`, `sent`, `interested`), par score | Aucun état : un bien proposé ou intéressé s'y lit « à proposer ». Ni règle « en vente » ni filtre de suppression : un mandat supprimé revient sans titre. Score en « 92 % », pas en `FilScore`. Clé de cache hors du fil (`['fiche-affaire', …]`) : un geste du fil ne le rafraîchit pas. Chaque ligne mène à la fiche du bien, pas à sa place dans le fil |
| **La phase Visites** | La section « Visites » seule | Aucun bien du matching, alors que l'affaire cherche encore |
| **L'historique** | `activity_events` dont `entity_id` est l'affaire, la chaîne d'offres, une ligne « Deal créé » ; 8 lignes au plus | Les gestes du matching sont journalisés sur le CONTACT : `match_propose` (`metadata.deal_id`, `match_ids`, `nombre`), `visit_scheduled` (`deal_id`, `match_id`), `match_reaction` (`match_id`, `new_status`, sans `deal_id`). La fiche n'en lit aucun |
| **L'origine d'une affaire** | `rattacherDeal` ouvre ou rattache l'affaire de l'acheteur quand on propose un bien, une sélection, ou qu'on planifie une visite (fil et copilote WhatsApp) | Aucune colonne ne dit qu'elle vient du matching ; « Intéressé » ne touche pas l'affaire |
| **Une visite planifiée** | Elle fait aussi avancer l'affaire en « Visite planifiée » (`stage_change` sur l'affaire) | Deux faits pour un geste, et seul celui qui ne nomme pas le bien est lu |

## 3. Principes

1. **Rien ne part vers l'acheteur.** Le bloc n'ajoute aucune sortie ; il entre dans le périmètre de `matching-sans-sortie.spec.ts`. La page, elle, n'y entre pas : elle porte ses liens WhatsApp et e-mail vers le client, hors du matching.
2. **Une règle, une source.** Les biens : `construireSaBoucle` (« Sa boucle »). Les états : `etatCompatible` (« Qui pour ce bien ? »). Les liens : `lienPlace`. Le score : `FilScore`. « En vente » : la règle du fil (`active` et non supprimé ; une annonce du marché non retirée).
3. **Rien de neuf en base.** L'historique lit ce que le journal porte déjà.
4. **Le moins de texte possible** (règle n°1). L'état d'un bien est une donnée, écrite comme dans « Qui pour ce bien ? ». Ni phrase d'aide, ni pastille : une ligne de texte, que la règle des aplats pleins ne vise pas.
5. **Code mort interdit.** Ce que le bloc remplace part avec lui.

## 4. Le bloc « Matching »

### 4.1 Où et quand

En Prospects et en Recherche, il est la première section de la colonne de gauche, à la place de « Biens à proposer ». En Visites, il se place sous la section « Visites ». Il n'est rendu ni à partir de l'Offre, ni sur une affaire conclue ou perdue, ni sur une affaire sans acheteur (`contact_buyer_id` nul). Une affaire revenue en Recherche le retrouve.

⚠ Précisé à l'exécution (30.09.2026) : le bloc vient sous le contenu de phase — une affaire qui a une chaîne d'offres garde sa « Négociation » en tête, quelle que soit sa phase, et une affaire revenue en Recherche après une offre retrouve le bloc DESSOUS. « Conclue ou perdue » s'entend comme la règle des gestes du fil (`dealOuvert`, lot E1) : une affaire annulée ou archivée n'a pas de bloc non plus. Et le nombre de l'en-tête ne se dit qu'avec les lignes : ni en lecture, ni sur l'échec d'une première lecture.

### 4.2 Ce qu'une ligne montre

- Le **titre du bien**, et dessous, en petit, son **état** — les libellés `matching:fil.quiPour.etat.*` : « À proposer », « Revenu · refusé à CHF … », « Reporté jusqu'au … », « Proposé le 24.09 », « Intéressé·e », « Visite planifiée ».
- Un mandat qui n'est plus en vente ajoute son état à celui du bien (`listings:status.*`) : « Proposé le 24.09 · Vendu ».
- À droite, le **prix**, puis le **score** en `FilScore` (la pastille du palier et le chiffre ; l'estimation dans son infobulle).
- L'en-tête : « Matching », et à droite le nombre de biens (`N biens`) — tous, même au-delà du plafond.

### 4.3 Quels biens, dans quel ordre

1. **Les intéressés et les visites planifiées**, puis **les proposés**, puis **les biens à proposer**. Dans chaque groupe, le score décroissant ; l'id départage.
2. **Les biens à proposer** : les biens revenus (refusés pour le prix, revenus par une baisse) et les **trois meilleurs jamais proposés**, en vente et non reportés, rangés ensemble par score.
3. **N'entrent pas** : les refus (ils vivent dans « Sa boucle »), les mandats supprimés, les biens à proposer qui ne sont plus en vente, les matchs écartés.
4. **Huit lignes au plus.** Le nombre de l'en-tête compte tout.

### 4.4 Où mène une ligne

Au bien, à sa place dans le fil (`lienPlace`, avec un jeton d'arrivée) : un proposé ouvre « Retours de … » dans « En attente », un intéressé sa ligne dans « À conclure », un bien à proposer sa ligne dans « À proposer » (une annonce du marché, la ligne « Marché » de l'acheteur). Une visite planifiée ou un revenu reporté n'ont pas de place : leur ligne ne mène nulle part, comme dans « Sa boucle ». ⚠ Précisé à l'exécution (30.09.2026), le §4.4 disant l'inverse du §4.3 : un revenu sur un bien qui n'est plus en vente n'a PAS de ligne — c'est un bien à proposer, il sort de ce qui se propose (décision 12a du lot E1), comme d'« Aujourd'hui » (`matching_actions_du_jour`) ; « Sa boucle », l'historique du contact, le garde, sans lien. Sous la liste, « Ouvrir le matching » ouvre le fil filtré sur l'acheteur (`lienFil({ contact })`).

### 4.5 Mise à jour et états

- Le bloc lit les mêmes lignes que « Sa boucle », sous la clé du fil (`CLE_FIL`) : un geste consigné dans le fil l'invalide, et l'abonnement realtime de « Sa boucle » fait paraître la réponse consignée par un collègue.
- **Chargement** : une ligne neutre, rien qui ressemble à un résultat — « Lecture des biens de l'acheteur… ».
- **Échec** de l'une de ses trois lectures (§6.2) : « Les biens de l'acheteur n'ont pas pu être lus. » et « Réessayer », qui les relit toutes. ⚠ Précisé à l'exécution (30.09.2026) : le message et « Réessayer » ne paraissent que tant que les trois lectures n'ont pas toutes abouti une fois (`aDesDonnees`) ; un rafraîchissement en échec garde les biens déjà lus, comme le fil et « Qui pour ce bien ? ».
- **Vide** : « Aucun bien pour l'instant. » ; « Ouvrir le matching » reste.

⚠ Précisé à l'écriture du plan : les trois textes suivent ceux de « Qui pour ce bien ? », la surface sœur
(« Lecture des acquéreurs compatibles… », « Les acquéreurs compatibles n'ont pas pu être lus. », « Aucun acquéreur
compatible pour l'instant. ») — « Lecture impossible » aurait été le seul texte du matching à ne pas nommer ce qu'il lit.

## 5. L'historique

### 5.1 Trois lignes neuves

Lues dans le journal du contact, sans écriture neuve :

- **« Proposé : Attique 5,5 pièces · Florissant »**, ou « Proposé : 3 biens » pour une sélection — un `match_propose` dont `metadata.deal_id` est l'affaire (fil ou copilote WhatsApp) ;
- **« Intéressé·e : Attique 5,5 pièces · Florissant »** — un `match_reaction` dont `new_status` est `interested` et dont `match_id` est l'un des `match_ids` proposés avec l'affaire ; ⚠ Précisé à l'exécution (30.09.2026) : par la DERNIÈRE proposition de ce bien qui précède l'intérêt — un bien reproposé avec une autre affaire lui appartient ;
- **« Visite planifiée : Appartement 4,5 pièces · Champel »** — un `visit_scheduled` dont `metadata.deal_id` est l'affaire.

Le nom du bien vient des lignes du bloc (la lecture de « Sa boucle » porte aussi les refus) ; introuvable — un mandat supprimé, un match écarté —, la ligne dit « un bien ». Les refus n'entrent pas dans l'historique.

### 5.2 D'où vient l'affaire

La ligne « Deal créé » devient **« Deal créé depuis le matching »** quand un geste du matching lié à l'affaire suit sa création de moins d'une minute : `rattacherDeal` crée l'affaire, puis journalise le geste ; le copilote le fait dans la même transaction.

### 5.3 Sans doublon

Une visite planifiée écrit aussi un changement d'étape de l'affaire vers `visit_planned`. À moins de 10 secondes l'un de l'autre, seule la ligne « Visite planifiée : … » reste — elle nomme le bien. La même règle que celle qui écarte le doublon « Étape changée » de l'écran (`doublonDeLaBase`).

### 5.4 Taille et mise à jour

Douze lignes au plus (huit avant). Le journal se lit sous la clé du fil : un geste du fil ou du copilote y paraît au retour sur la fiche. Les icônes restent celles de l'historique, discrètes : envoi, cœur, maison.

## 6. Architecture

### 6.1 Le modèle pur — `src/components/matching-fil/filAffaire.ts`

⚠ Écart décidé à l'écriture du plan (30.09.2026) : le modèle et le bloc vivent dans `matching-fil/`, pas dans
`crm/pipeline/` — l'empreinte de la capture de référence du Pipeline (`scripts/_shared/visual-baseline-empreinte.mjs`)
couvre ce dossier entier, et un fichier neuf y rendrait la capture périmée alors que le tableau ne change pas.
`matching-fil` est le dossier des surfaces du matching montées ailleurs (`QuiPourFiche`), et `matching-sans-sortie`
le couvre d'office.

Ni React, ni Supabase, ni traduction ; le `maintenant` de l'appelant, comme les modules purs du fil.

- `biensDeLAffaire(boucle, aProposer, acheteur, maintenant)` → `{ lignes, total }`. `boucle` : la lecture de « Sa boucle » (ses lignes et les critères de ses recherches, ce que `construireSaBoucle` prend) ; `aProposer` : les meilleurs `suggested` de l'acheteur. S'appuie sur `construireSaBoucle`, `etatCompatible` et `lienPlace`. Une ligne : `{ id, rang, score, titre, prix, location, etat, cleEtatMandat, lien }`, où `etat` est l'état d'`etatCompatible` (clé et valeurs brutes), `cleEtatMandat` la clé `listings:status.*` d'un mandat qui n'est plus en vente (`null` sinon), `lien` la requête du fil ou `null`.
- `journalMatchingDeLAffaire(evenements, dealId, titres)` → les lignes « proposé », « intéressé », « visite », datées, avec le titre du bien, ou `null` (« un bien »), et le nombre d'une sélection ; `titresDesMatchs(...lectures)` nomme les biens lus.
- ⚠ Trouvé en capturant le banc : les biens à proposer se dédoublonnent sur ce que « Sa boucle » PORTE, pas sur ce que ses lectures rendent — le banc compare `gt` en chaînes, et sa lecture des revenus ramène les `suggested` jamais proposés.
- `neeDuMatching(creeLe, lignes)` → vrai si une ligne suit la création de moins d'une minute.
- `doublonDeVisite(quand, lignes)` → vrai si une ligne « visite » est à moins de 10 secondes.

### 6.2 Les lectures — `src/hooks/useMatchingAffaire.ts`

`useMatchingAffaire(contactId, dealId)` compose trois lectures, toutes sous `CLE_FIL`, et rend `{ lignes, total, journal, isLoading, isError, aDesDonnees, refetch }` — `journal` : les lignes du §5.1 ; `isError` : l'une des trois lectures a échoué ; `aDesDonnees` (⚠ Précisé à l'exécution, 30.09.2026) : les trois ont abouti une fois, l'erreur ne se dit qu'avant (§4.5) ; `refetch` : les relit toutes, d'une identité stable. L'origine (§5.2) et le doublon (§5.3) se jugent dans la page, qui connaît la création de l'affaire et ses faits :

1. **« Sa boucle »** : `useContactSentMatches(contactId)`, telle quelle (et son abonnement realtime).
2. **Les meilleurs à proposer** : `matches` de l'acheteur en `suggested`, par score décroissant, 20 au plus, avec les colonnes de « Sa boucle » (exportées de `useContactSentMatches` au lieu d'être recopiées) — clé `[CLE_FIL, 'affaire-a-proposer', contactId]`.
3. **Le journal** : `activity_events` du contact (`entity_type = 'contact'`, `entity_id`), actions `match_propose`, `visit_scheduled`, `match_reaction`, du plus récent au plus ancien, 100 au plus — clé `[CLE_FIL, 'affaire-journal', contactId]`. L'index `idx_activity_events_entity_created` couvre la lecture.

### 6.3 Le composant — `src/components/matching-fil/BlocMatchingAffaire.tsx`

La section du §4 : en-tête, lignes, états de chargement, d'échec et de vide, « Ouvrir le matching ». Il reçoit ses lignes et ses états de la page, qui lit `useMatchingAffaire` pour son historique aussi : une seule lecture.

### 6.4 La fiche d'affaire

- Monte le bloc selon le §4.1 ; la branche par défaut de `phaseContenu` disparaît.
- Lit `useMatchingAffaire`, passe les lignes au bloc, fusionne le `journal` dans son historique avec `neeDuMatching` (§5.2) et `doublonDeVisite` (§5.3), et passe à 12 lignes.
- `useFicheAffaire` perd sa lecture `matchs`, qui n'a plus de lecteur ; `faits` et `visites` restent.
- ⚠ L'écriture de l'état d'un bien sort de `QuiPourCeBien.tsx` vers `filAffichage.ts` (`texteEtatCompatible`), partagée par
  « Qui pour ce bien ? » et le bloc : ni recopiée, ni exportée d'un fichier de composants (react-refresh le refuse).

### 6.5 Les textes (quatre langues)

- Neufs, sous `pipeline:fiche.matching.*` : le titre et le nombre de biens (pluriel), que la fiche écrit. ⚠ Le vide,
  la lecture et l'échec vivent sous `matching:fil.affaire.*`, avec le bloc ; « Réessayer » reprend `matching:fil.reessayer`.
- Neufs, sous `pipeline:fiche.hist.*` : « Proposé : … », « Proposé : N biens » (pluriel), « Intéressé·e : … », « Visite planifiée : … », « un bien », « Deal créé depuis le matching ».
- Réemployés : `pipeline:fiche.ouvrirMatching`, `matching:fil.quiPour.etat.*`, `listings:status.*`.
- Retirés : `pipeline:deal.matches_title`, `deal.matches_count_one`, `deal.matches_count_other`, `deal.no_matches` — plus aucun lecteur.

## 7. Garde-fous

- **Une spec du modèle pur** (`fil-affaire.spec.ts`) : l'ordre ; les filtres (refus, mandats supprimés, à proposer hors vente, reportés) ; les trois meilleurs à proposer ; le plafond de huit et le total ; le lien de chaque état ; l'état d'un mandat hors vente ; les trois lignes du journal et leur filtre sur l'affaire ; l'intérêt relié par les biens proposés ; « un bien » ; l'origine à moins d'une minute ; le doublon de visite à moins de dix secondes.
- **Une spec de rendu du bloc** (`bloc-matching-affaire.spec.tsx`, idiome `createRoot` + `act` du dépôt) : les textes, le score en `FilScore`, un clic qui navigue vers la place du bien avec son jeton d'arrivée, une ligne sans place qui n'est pas un bouton, les états de chargement, d'échec et de vide.
- **Une spec des lectures** (`matching-affaire-lecture.spec.tsx`) : les biens à proposer de l'acheteur et le journal du contact, leurs filtres, leur ordre et leur plafond ; un bien que « Sa boucle » porte déjà, compté une fois ; la clé du fil ; aucune lecture sans acheteur ; un échec, et « Réessayer » qui relit tout.
- **`score-une-ecriture.spec.ts`** s'étend à la fiche d'affaire : plus de « {score} % ».
- **`jeton-arrivee.spec.tsx`** : le bloc s'y inscrit (un site : chaque ligne vers sa place) ; la page garde le sien, « Ouvrir le matching ».
- **`matching-sans-sortie.spec.ts`** : le bloc et son modèle y sont d'office (`matching-fil`) ; la lecture
  `useMatchingAffaire` y entre.
- **`fiche-qui-pour.spec.ts`** : l'écriture de l'état partagée (`texteEtatCompatible`), clé et valeurs de chaque état.
- **Les cliquets** de grammaire (`megga-x-grammar.spec.ts` : `src/pages/agent`, et `src/components/matching-fil`, qui
  ne tolère aucun littéral) et de couleur (`couleur-barreaux.spec.ts`) — remesurés au plan : ils ne bougent pas.
- Les portes i18n (clés, parité, couverture, textes en dur) et `lint:deadcode`.

## 8. Le banc

Le banc reçoit des événements de matching pour les affaires de Julie Morand (d5, Recherche) et d'Anastasia Volkova (d6, Visites) — une proposition, une sélection, un intérêt, une visite planifiée —, pour que l'historique se voie. La visite de Champel d'Anastasia, planifiée dans son matching, reçoit sa ligne `visits`, qui lui manquait.

⚠ Précisé à l'écriture du plan : un fait d'étape d'Anastasia (`fd8`, cinq secondes après sa visite) montre le
doublon écarté ; la visite est posée à 20 jours, hors de la semaine que le glissé du Calendrier éprouve
(`calendrier-deplacement.spec.ts` y cherche UNE visite) ; les six événements, plus récents que la traîne du journal,
décalent la pagination du journal d'audit — `tests/e2e/journal-audit.spec.ts` suit (963 / 964).

## 9. La livraison

En petites mises à jour, relues une par une, sur `megga/fiche-affaire-matching` — huit tâches, cinq commits.

⚠ Écart décidé à l'écriture du plan (30.09.2026) : un commit par SUJET, pas par tâche. `lint:deadcode` ne lit que
`src` : un modèle ou une lecture sans lecteur y paraît mort, et chaque commit doit passer seul.

0. l'écriture de l'état, partagée (tâche 1) ;
1. le bloc sur la fiche — le modèle, la lecture, le composant, la fiche (tâches 2 à 5) ;
2. l'historique (tâche 6) ;
3. le banc (tâche 7) ;
4. les docs — conception, plan, feuille de route, carte système, cerveau, CHANGELOG (tâche 8).

Chaque commit est vérifié seul (il compile, passe la suite unitaire, `lint:deadcode` et les portes i18n) dans une copie jetable liée au `node_modules` du dossier principal ; captures du banc en clair et en sombre à chaque étape visible. Cette conception attend le « committe » de Julien avec le reste ; rien n'est poussé sans sa demande. Aucune migration : la fusion ne demande aucun geste en production.

## 10. En attente (hors périmètre — rien n'est fait sans accord de Julien)

- **L'étape 5b-2, le KYC.** Condition : le KYC refait, commité dans sa session et ramené sur `main` — mesuré le 30.09.2026, 54 commits de retard, ~160 fichiers dont les aplats d'état sur 84, ~35 points de conflit (5 fichiers que `main` a supprimés, ~30 modifiés des deux côtés). Ce qui l'attend : lire les rôles du contact (`contacts.roles`, `src/lib/contactRoles.ts`) ; mettre en tête l'acheteur qui a une visite planifiée (`visits.status` `planned` ou `confirmed`) ou une offre en cours (`crm_offers` `pending`, par `deal_id`) — aucune lecture ne le dit aujourd'hui pour une liste de contacts, et `get_contact_next_action` lit `crm_offers.transaction_id`, que l'écran ne remplit pas.
- **Une affaire côté vendeur** : « Qui pour ce bien ? » de son mandat sur sa fiche.
- **La décision 15** (« Intéressé·e ») : l'historique et le bloc suivront la forme retenue.
- **Une visite d'annonce du marché** planifiée depuis le fil n'écrit que `calendar_event_created`, sans affaire ni match : elle n'entre pas dans l'historique.
- **La prochaine action de la fiche** peut être une relance de proposition du matching (« Retour de … ») : la fiche la montre comme toute relance.
- **Un intérêt dont la proposition est plus ancienne que les 100 derniers événements** du contact n'est pas relié à l'affaire.
- **Le bien de l'affaire** peut paraître « À proposer » dans son propre bloc si son match n'a jamais été proposé (affaire ouverte hors du fil).
- **La fiche d'affaire mobile** (`MobileDealDetailScreen`) ne dit rien du matching — étape 5c (lot E2).
