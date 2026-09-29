# Matching · lot E1 — la bascule au bureau (conception)

**Date :** 27.09.2026 · **Statut :** validé par Julien le 27.09.2026, section par section · **Étape 5a** de la [feuille de route](../feuille-de-route.md) · Précise le §7 de la [conception de la boucle](2026-09-21-matching-boucle-agent-design.md) (« E, la bascule ») et le §10 de la [conception du fil](2026-09-17-matching-fil-design.md), qui en restent les sources. ⚠ La conception du fil numérote encore « lot 3 = bascule » et « lot 4 = retrait et mobile » : ces deux lots sont E1 et E2.

## 1. Les décisions

E1 met le fil de matchs en production au bureau, à la place de l'atelier, et retire l'atelier de bureau. Il n'écrit toujours rien à l'acheteur.

Décisions de Julien, le 27.09.2026 :

1. **Le lot E est coupé en deux**, comme D : **E1 le bureau**, puis **E2 le téléphone** (écran mobile sur le modèle du fil, feuille « Retours » en plein écran, « Aujourd'hui » et fiche contact mobiles, retrait du reste de l'atelier), chacun avec sa conception, son plan et son exécution. E1 suffit pour que les liens de D1 atterrissent au bon endroit.
2. **Le périmètre d'E1** : le fil en page 0 et l'arrivée sur lui ; le retrait de l'atelier de bureau ; la garde i18n étendue au fil ; le lien d'arrivée qui ne se rejoue plus ; un vrai premier lancement et le journal de « Réactiver » ; la renotation d'une recherche modifiée ; le retrait du catalogue d'« Aujourd'hui ». Trois points vont en « En attente » (§10).
3. **Quatre décisions en suspens de la feuille de route sont tranchées** : 13a (« Qui pour ce bien ? » du fil sans les refus), 12a (un mandat qui n'est plus en vente sort de ce qui se propose, une seule règle), 10a (« Sa boucle » s'aligne sur le fil pour les biens revenus), 9c (« Planifier une visite » garde les acquéreurs compatibles, sans message pré-rempli). Et, trouvé en route : une visite planifiée depuis la fiche d'un mandat pour un acquéreur compatible suit la règle du fil (§5.6).
4. **La renotation B** : quand les critères changent, et chaque nuit pour les couples notés par une version antérieure du moteur (§5.7).
5. **Le premier lancement A** : la couverture de l'atelier, reprise, textes corrigés (§5.1).
6. **Le relogement A** : le dossier `matching-atelier/` disparaît dès E1 ; ce qui survit rejoint son lecteur (§6.2).

## 2. Ce qu'on a mesuré

En production le 27.09.2026 (lecture seule), et dans le code de la pile (`megga/matching-lot-e`, partie de `megga/matching-lot-d2`) :

| Sujet | Ce qui existe | Ce qui cloche |
|---|---|---|
| **Les matchs** | 1 837, tous dans UNE agence : 10 à proposer sur des mandats, 1 827 sur le marché, pour 4 acheteurs | La boucle n'a jamais tourné en production (0 `sent`, `interested`, `rejected`, `visit_planned`) : les lots B à D2 sont sur branche. **12 agences sur 13 n'ont aucun match** |
| **Les versions du moteur** | `app_config.matching_scoring_v2.version` = 3 ; parmi les `suggested`, 1 249 en v3, 113 en v2, **475 sans version** | Une paire existante n'est jamais renotée (`insert_*_matches` en `ON CONFLICT DO NOTHING`) ; `renoter()` saute les couples sans version ; le code du lot C vaut version 4 par défaut, la production dit 3 |
| **Le scan de nuit** | `daily-matching-scan`, `0 5 * * *`, actif ; `purge-stale-matches` à `50 4 * * *` | — |
| **Les règles automatiques** | Une seule : `property_sent`, sans envoi automatique | Aucune règle `visit_completed` : l'e-mail d'avis après une visite ne part chez personne aujourd'hui |
| **L'atelier de bureau** | Page (232 lignes) + `matching-atelier/` (18 fichiers, 3 761) + `useAtelierMatching.ts` (1 157 : lecture ≈ 424, exécuteurs du reste) ; banc `/dev/matching-atelier` (498) | Le fil emprunte ses exécuteurs, sa file d'annulation et deux types ; la Recherche, son icône |
| **L'écran mobile** | `crm-mobile/matching/`, 13 fichiers, 2 012 lignes, sur le modèle de l'atelier | Il lit `useAtelierMatching()` et trois petits modules de `matching-atelier/` (`types`, `format`, `pendingTriage`) : retirer l'atelier de bureau ne le casse pas |
| **Le fil** | 24 fichiers, 4 190 lignes, sur le banc `/dev/crm` seulement ; 10 de ses fichiers servent déjà d'autres surfaces | Il ne lit ni `properties.status` ni `deleted_at` ; « Qui pour ce bien ? » compte les refus ; un lien d'arrivée se rejoue à chaque remontage ; son état « À proposer » vide dit « Tout est à jour » à une agence qui n'a rien ; `matching-fil` est hors de la garde i18n |
| **« Planifier une visite » d'un mandat** | Liste les acheteurs en deal puis les acquéreurs compatibles ; pré-remplit un WhatsApp et un `mailto:` au client | La visite d'un acquéreur compatible part sans `reminder_sent` (le rappel J-1 écrit au client) et ne fait pas passer son match en « visite planifiée », à l'inverse du fil (décision du 21.09.2026) |
| **Le catalogue d'« Aujourd'hui »** | Page 2 du pager, 1 047 lignes | Un refus y porte « Nouveau », la baisse y vaut 0 en dur, il charge tous les matchs de l'agence |

## 3. Principes

1. **Rien ne part vers l'acheteur.** E1 n'ajoute aucune sortie ; il en retire une (le message pré-rempli de « Planifier une visite » pour un acquéreur compatible). `matching-sans-sortie.spec.ts` suit les fichiers déplacés.
2. **Une règle, une source.** « En vente » est la règle du copilote WhatsApp ; « compatible » est `STATUTS_COMPATIBLES` ; un bien revenu se compte comme dans le fil.
3. **Le plus simple possible** (règle de la conception du fil) : on reprend ce qui existe — la couverture de premier lancement, l'écrivain de notes du lot B (`matching_appliquer_notes`), la piste de jeton écrite au plan de D1.
4. **Code mort interdit** (conception du fil, §10) : ce que le retrait laisse sans lecteur part avec lui.
5. **L'historique ne se réécrit pas** : un bien déjà proposé garde la note qu'il avait quand on l'a proposé.

## 4. La bascule

### 4.1 Le fil en page 0

`MatchingPage` monte `MatchingFil` en page 0 en production (plus `MatchingAtelierPage`) ; « Matching » s'ouvre sur le fil (`atterrissage` vaut le fil par défaut, plus la Recherche). La Recherche reste en page 1. Chaque onglet garde la dernière page vue (`useTabScopedState('pager')`). Le banc garde ses emplacements (`banc`).

### 4.2 Le lien d'arrivée : appliqué une fois par navigation

Un lien qui mène à une place du fil (`?onglet`, `?ligne`, `?attente`, `?contact`, `annonce=p:`) porte un **jeton** dans sa navigation (`navigate(…, { state })`, la piste écrite au plan de D1). L'écran range dans la tranche de son onglet le dernier jeton appliqué ; il n'applique une arrivée que si son jeton est neuf. Donc :

- revenir sur l'onglet, un retour arrière, une éviction au-delà des six écrans vivants ou un rechargement **ne rejouent plus** l'arrivée ;
- un NOUVEAU clic sur le même lien la rejoue, même si l'onglet est déjà ouvert sur cette adresse (il est seulement réactivé, et c'est son écran, désormais montré, qui reçoit le jeton) ;
- l'adresse n'est jamais réécrite : ⛔ pas de `setSearchParams(…, { replace })`, que la réconciliation des onglets lirait comme un autre onglet.

Même mécanique pour `?qui=1` de la fiche d'un bien (aujourd'hui rejoué à chaque remontage) et pour le choix de page du pager, qui attend en plus le chargement de la pile d'onglets, comme le fil.

### 4.3 Les liens entrants

| Lien | Aujourd'hui (atelier) | Après E1 (fil) |
|---|---|---|
| Barre latérale, nouvel onglet, fiche bien, retour de fiche d'annonce, Analytics, KYC | L'atelier sur sa vue par défaut | Le fil |
| `?contact=` (fiche et liste des contacts, deal) | Le mode « Par acheteur » | Le fil filtré sur l'acheteur |
| `lienFil` / `lienPlace` de D1 (« Aujourd'hui », « Pendant ton absence », « Sa boucle », « Qui pour ce bien ? », segment Matching) | L'atelier, la place visée perdue | La bonne ligne, le bon onglet, la bonne feuille |
| `?annonce=` | Écrit par l'atelier seul, pour lui-même | Disparaît avec lui (le fil lit `p:` ; `m:` reste en attente, §10) |

### 4.4 « Aujourd'hui » à une page

Le catalogue (`PageCatalogue.tsx`) est retiré : « Aujourd'hui » n'a plus qu'une page. Partent avec lui les points de page, l'indice de molette, les changements de page à la molette, au clavier et au toucher et leur verrou, la page mémorisée de ce pager, `Orbs` (`kit.tsx`), `SEED_CATA`, les clés `today.catalogue.*` et `today.pager.*` (quatre langues), et `goToPage` (`TodayNavContext`), déjà sans lecteur. Le segment Matching de D1 et le fil prennent le relais.

## 5. Ce que le fil gagne avant la production

### 5.1 Le premier lancement et les états vides

| L'agence a… | Page 0 |
|---|---|
| Aucune recherche d'acheteur active | La couverture de l'atelier, reprise (`MatchingFirstRun`) : même image, trois étapes, **textes corrigés** — « Ajoutez un acheteur » (budget, secteur, pièces), « Vos mandats et le marché » (les biens qu'on lui compare), « MEGGA calcule les matchs » (rien à configurer) —, et un bouton « Ajouter un acheteur » vers la création d'un contact. Le marché suffit : l'ancienne première étape, « Créez votre premier mandat », laissait croire qu'un mandat était requis. Sombre quel que soit le thème, comme celle de Mes biens (celle des Contacts suit le thème depuis le 16.09.2026). La Recherche reste accessible en page 1 |
| Des recherches, aucun match | « Aucun bien ne correspond encore aux critères de vos acheteurs », avec « Voir le marché » |
| Des matchs, rien à proposer | « Tout est à jour » (le texte actuel, qui redevient juste) |

La condition de la couverture change : l'atelier la montrait sans pivot ni bien ; elle vaut désormais « aucune recherche active dans l'agence », le seul prérequis réel.

### 5.2 « Réactiver » au journal

`execWake` écrit sa ligne au journal, comme « Plus tard » (`match_reporte`) et « Écarter » (`match_ecarte`).

### 5.3 Un mandat qui n'est plus en vente (12a)

La règle du copilote WhatsApp (`get_matches`), reprise telle quelle : un mandat est **en vente** s'il est `active` et non supprimé.

- **Il sort d'« À proposer »** — ses suggestions, ses biens revenus, ses reportés — **et de « Qui pour ce bien ? »**, dont l'action n'est plus offerte sur un mandat qui n'est plus en vente.
- **« En attente » et « À conclure » le gardent**, avec son état écrit, dans le vocabulaire de Mes biens (« Vendu », « Archivé », « Réservé », « Brouillon ») : une réponse en cours se consigne encore.
- **Le copilote WhatsApp suit la même règle** (décision de Julien, 27.09.2026) : `record_match_outcome` refuse « Je l'ai proposé » sur un mandat qui n'est plus en vente, comme `get_matches` l'écarte déjà. Jusqu'ici, il l'acceptait.
- **Précision confirmée par Julien à la relecture (27.09.2026)** — la section présentée rangeait les corrections « Apprendre » parmi ce qui sort : un refus dit quelque chose de l'acheteur, pas du bien. Les refus d'un mandat qui n'est plus en vente **continuent de nourrir** « Apprendre » ; seules ses lignes de bien sortent.

### 5.4 « Qui pour ce bien ? » sans les refus (13a)

Le panneau du fil (`MatchingFil.tsx`, `compatibles`) lit `STATUTS_COMPATIBLES`, comme la fiche : les refus sortent du compte et de la liste.

### 5.5 « Sa boucle » et les biens revenus (10a)

Un bien revenu (refusé pour le prix, revenu par une baisse) n'est plus compté parmi les « Proposés » de la fiche contact ; il reste « à traiter ». Le fil fait déjà ainsi (« Déjà proposé » ne compte que la boucle). Sur un mandat qui n'est plus en vente, il n'est plus « à traiter » et perd son lien (§5.3). Le titre de la liste, qui disait « Biens proposés (N) » en comptant aussi les revenus, devient un titre neutre qui compte ce qu'il liste (« Ses biens (N) ») : la fiche ne dit plus « 4 Proposés » au-dessus de « Biens proposés (5) » (décision de Julien, 27.09.2026).

### 5.6 « Planifier une visite » d'un mandat (9c)

- Les acquéreurs compatibles restent proposés comme visiteurs, **sans message pré-rempli** (ni WhatsApp ni e-mail).
- Le pré-remplissage reste pour un acheteur **déjà en deal sur ce bien**. Précision confirmée par Julien à la relecture : un deal perdu n'en fait pas un (aujourd'hui, tout statut compte). ⚠ Décision de Julien du 29.09.2026 (écart à l'exécution) : sauf un acquéreur INTÉRESSÉ du matching, qui suit la règle du fil comme sur WhatsApp — l'écrivain du fil, qui rattache la visite à son deal, sans message ni rappel ; et tant que les compatibles ne sont pas lus, rien ne part.
- Pour un acquéreur compatible, la visite **suit la règle du fil et du copilote WhatsApp** (décision du 21.09.2026 ; `wa_matching_visite`, lot D2) : **aucun rappel J-1 au client** (`reminder_sent`), et **son match passe en « visite planifiée » s'il est « intéressé »**, son deal ouvert ou avancé comme depuis le fil. Précision confirmée par Julien à la relecture (la section présentée disait « le match passe en visite planifiée » sans condition) : un match encore « à proposer » ou « proposé » ne bouge pas — la réponse de l'acheteur se consigne dans le fil, comme sur WhatsApp. Une règle, une source.

### 5.7 La renotation (B)

- **Quand les critères d'une recherche changent**, le déclencheur existant (`on_search_criteria_updated`) relance déjà le moteur en `match-contact`, qui ne fait que créer les couples neufs. Il **renote aussi les couples « à proposer » existants** de la recherche, avec ses critères du moment.
- **Chaque nuit**, le scan de 05:00 UTC (`scan-all`) renote les couples « à proposer » notés par une version antérieure du moteur, **y compris ceux sans version**, que `renoter()` saute aujourd'hui. Au plus 2 000 couples par agence et par nuit, pour tenir le temps d'une fonction : la production en compte 1 837, la première nuit suffit.
- Un seul écrivain, celui du lot B : `matching_appliquer_notes`. Sous le seuil, le couple sort d'« À proposer » (`ignored`, motif `recherche_ajustee` : écarté par une réévaluation, pas par l'acheteur). **Une ligne au journal par recherche renotée** (`matching_ajuster_recherche`, action `matchs_reevalues`, avec son bilan).
- **Seuls les couples « à proposer »** : un bien déjà proposé garde sa note (§3.5).
- ⚠ **Décision de Julien du 29.09.2026 (écart à l'exécution) : l'écart du moteur se défait.** Les critères changent aussi par des sources automatiques (extraction WhatsApp, `qualify_lead`, import) : un écart définitif ne se rattrapait jamais. La renotation d'une recherche (`match-contact`, `rescore-search`) relit aussi les couples que le moteur en a écartés (`ignored` + `recherche_ajustee`), et ceux que la note retient reviennent à proposer, motif effacé — sur une annonce vivante ou un mandat en vente ; la nuit reste sur les « à proposer ». Un écart de l'agent n'est jamais relu (« Écarter » efface le motif). Mesuré le même jour en lecture seule : la première nuit en v4 écarterait au moins 473 des 1 950 « à proposer » (24 %), tous hors du pré-filtre des critères actuels, et au plus 199 de plus.
- **À la fusion**, sur accord de Julien : la version passe à 4 (le lot C a changé le barème). La nuit suivante renote les 1 837 couples.

### 5.8 Le deal d'un acheteur : jamais un deal perdu

Mesuré le 27.09.2026 : « perdu » n'est pas un statut de deal mais une étape (`stage = 'lost'`), que « Marquer perdu » du Pipeline écrit seule, le statut restant `active`. L'écrivain du fil (`rattacherDeal`, « Je l'ai proposé ») et les deux fonctions du copilote WhatsApp (`wa_matching_consigner`, `wa_matching_visite`) prennent « le deal actif » d'un acheteur sur le statut seul : un geste neuf pouvait se rattacher à son deal PERDU au lieu d'en ouvrir un. Décision de Julien (27.09.2026), une seule règle partout où un geste cherche le deal d'un acheteur : **un deal est ouvert si son statut est `active` ou `on_hold` et que son étape n'est pas `lost`** ; sinon le geste en ouvre un neuf, comme pour un acheteur sans deal. C'est la définition que « Planifier une visite » applique déjà (§5.6). ⚠ Décision de Julien du 29.09.2026 : un deal ARCHIVÉ (`archived_at`) n'est pas ouvert non plus.

## 6. Le retrait de l'atelier de bureau

### 6.1 Supprimé

- La page `MatchingAtelierPage.tsx` (232 lignes).
- Dans `matching-atelier/` : dix composants (`AtelierStage`, `AtlAcheteurMode`, `AtlAnnonceVue`, `AtlCockpit`, `AtlConfirm`, `AtlEmptyState`, `AtlListing`, `AtlOverlayHost`, `AtlQueue`, `AtlWhy`), `constants.ts` et `atelier.css` : 3 287 lignes.
- Le banc `/dev/matching-atelier` (`MatchingShowcasePage.tsx`, `matchingAtelierFixtures.ts`, 498 lignes) et sa route.
- Les specs propres à l'atelier (`matching-atelier-css.spec.ts`) ; celles qui gardent aussi d'autres surfaces (`matching-contraste.spec.ts`, `tests/backend/atelier-matching-loop.spec.ts`, qui éprouve des exécuteurs que le fil garde) sont recentrées, pas jetées.

### 6.2 Déplacé (relogement A)

| Quoi | Vers |
|---|---|
| Les exécuteurs des gestes et ce qu'ils portent (références des biens, statuts de relance, `isSnoozed`, `rattacherDeal`), avec **leurs propres types** au lieu de `Pick` de ceux de l'atelier | `src/lib/matchingGestes.ts` |
| La file d'annulation (`pendingTriage`), lue par le fil et le mobile | `src/lib/` |
| `AtlIcon`, que la Recherche emprunte | `matching-recherche/` |
| `MatchingFirstRun`, textes corrigés | `matching-fil/` |
| `types`, `format`, `composeAiHint`, lus seulement par la lecture de l'atelier et par l'écran mobile | À côté de l'écran mobile, qui part en E2 |
| `useAtelierMatching.ts` | Reste, réduit à la lecture de l'atelier pour l'écran mobile ; retiré en E2 |

**L'écran mobile ne change pas** : seuls ses imports bougent.

### 6.3 i18n

Les clés propres à l'atelier de bureau partent ; celles du mobile restent jusqu'à E2 ; celles de la couverture passent au fil avec leurs textes corrigés, dans les quatre langues. Les clés du namespace `matching` que plus rien ne lit partent aussi, une fois vérifié qu'aucune n'est composée dynamiquement. La garde i18n (`eslint.config.js`, `scripts/lint-i18n-hardcoded.mjs`, `i18n-globs-vivants.spec.ts`) vise `matching-fil` à la place de `matching-atelier`.

### 6.4 Les gardes et les docs

- **Gardes à chemins en dur** mises à jour : `matching-sans-sortie` (entrées de l'atelier et du catalogue retirées, `matchingGestes.ts` ajouté), `megga-x-grammar` et `couleur-barreaux` (zones de l'atelier retirées ; les cliquets ne font que descendre, celui de `crm/today` compris), `megga-x-crm-tokens` (chemin de `MatchingFirstRun`), `dev-bancs-frontiere`, `etat-vide`.
- **Docs** : `docs/system-map.md` (la chaîne « → Atelier Matching », les familles i18n verrouillées), le cerveau (`megga/matching-ui-hooks`, périmé, et trois entrées qui décrivent encore l'atelier ou l'envoi au client : `megga/matching-fil`, `megga/ai-matching-spec`, `megga/matching-data-model`), le CHANGELOG, CLAUDE.md §8, la feuille de route (étapes 5a et 5b).

## 7. Ce qui ne change pas

- **Le mobile** : son écran, sa lecture et ses gestes (E2).
- **Le moteur**, hors la renotation : ses notes, ses modes, son seuil.
- **La Recherche** (page 1 du pager), « Ce qui a bougé » compris.
- **Les gestes du fil** : aucun n'est ajouté.
- **Le copilote WhatsApp** (D2), hors la règle du mandat en vente (§5.3).

## 8. Garde-fous

| Spec | Ce qu'elle refuse |
|---|---|
| Fil (unitaires) | Un mandat qui n'est plus en vente dans « À proposer » ou dans « Qui pour ce bien ? » ; le même absent d'« En attente » ; un refus compté dans « Qui pour ce bien ? » ; la couverture montrée à une agence qui a une recherche active ; « Tout est à jour » dit à une agence sans match |
| Jeton d'arrivée (unitaire) | Une arrivée rejouée au remontage ou au rechargement ; une arrivée ignorée sur un nouveau clic ; une adresse réécrite — pour le fil, le pager et `?qui=1` |
| `sa-boucle.spec.ts` (unitaire, mise à jour) | Un bien revenu compté parmi les « Proposés » |
| « Planifier une visite » (unitaire) | Un message pré-rempli ou un rappel J-1 pour un acquéreur compatible ; un match « intéressé » qui ne passe pas en « visite planifiée », ou un match d'un autre statut qui bouge ; un pré-remplissage refusé à un acheteur en deal ouvert |
| « Aujourd'hui » (unitaire) | Une seconde page, un point de page |
| Renotation (unitaire, modèle pur) | Un couple sans version sauté ; un couple déjà proposé renoté |
| Moteur (backend) | `match-contact` qui laisse une ancienne note sur un couple « à proposer » ; le scan de nuit qui laisse une version ancienne ; un couple sous le seuil resté « à proposer » ; une recherche renotée sans ligne au journal |
| `matching-sans-sortie.spec.ts` (étendue) | Tout fichier déplacé ou neuf d'E1 qui écrirait à l'acheteur |
| Le banc `/dev/crm` | Le fil, sa couverture et ses deux états sobres ; « Aujourd'hui » sans catalogue |

## 9. La mise en production

- **Aucune migration prévue** : `matching_appliquer_notes`, `matching_ajuster_recherche` et `visits.reminder_sent` existent. À confirmer au plan ; s'il en faut une, elle se redate au jour de la fusion, comme les autres.
- La fonction `matching-engine` est redéployée par `deploy.yml` à la fusion.
- Les **specs de la base** se jouent en local (colima) avant la fusion : c'est ce jeu-là qui a trouvé l'épingle de région manquante des lots B et C.
- **Sur accord de Julien, à la fusion** : la version du moteur passe à 4 (§5.7).
- **Fusion à la fin**, avec toute la pile. E1 suffit à D1 et D2 ; E2 suit.

## 10. En attente (hors périmètre — rien n'est fait sans accord de Julien)

- Paginer la boucle et plafonner les `.in()` du fil : la production en est loin (boucle vide, 4 acheteurs avec une sélection du marché, 27.09.2026).
- `?annonce=m:` (filtrer le fil sur une annonce du marché) et « Chercher plus loin dans Recherche » : aucune surface n'y mène.
- L'e-mail d'avis après une visite du fil : aucune agence n'a de règle `visit_completed` (27.09.2026).
- « Qui pour ce bien ? » du fil garde les acheteurs déjà en deal, que la fiche écarte : les deux comptes peuvent encore différer de ce seul fait.
- Le lot E2 (le téléphone), sa conception et ses maquettes.
- Les décisions encore attendues de la feuille de route (6, 7, 8, 11) : E1 n'y touche pas.
