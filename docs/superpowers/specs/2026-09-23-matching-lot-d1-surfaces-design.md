# Matching · lot D1 — les surfaces du CRM (conception)

**Date :** 23.09.2026 · **Statut :** validé par Julien le 23.09.2026 · **Étape 4a** de la [feuille de route](../feuille-de-route.md) · Précise le §5 et le §4.2 de la [conception de la boucle](2026-09-21-matching-boucle-agent-design.md), qui en reste la source.

## 1. La décision

La boucle vit dans le fil. D1 la porte là où l'agent travaille déjà : « Aujourd'hui », la fiche d'un contact, la fiche d'un bien. Le lot D a été coupé en deux par Julien le 23.09.2026 : **D1**, ces trois surfaces, ne dépend de rien d'extérieur au dépôt ; **D2**, WhatsApp, commence par une décision sur le modèle Meta.

Trois décisions de Julien, le 23.09.2026 :

1. **Les liens de D1 visent le fil seul.** Le fil n'est pas encore en production — `/dashboard/matching` monte l'atelier jusqu'au lot E —, mais tout fusionne ensemble à la fin et le lot E vient juste après. D1 ajoute au fil les liens d'arrivée qui lui manquent ; rien n'est construit deux fois. ⚠ Conséquence : **D1 ne part pas en production sans le lot E.**
2. **« Aujourd'hui » gagne un bloc « Matching » à part**, plafonné à cinq actions, chacune avec sa raison. Les matchs quittent « Dossiers », où ils apparaissaient sans raison.
3. **« Qui pour ce bien ? » sur les deux fiches** : les acquéreurs compatibles sur la fiche d'un mandat ET sur celle d'une annonce du marché ; les anciens prospects sur le mandat seul, comme au lot C.
4. **« Ce qui a bougé » dit, ligne par ligne, s'il existe des acheteurs compatibles** (ajouté par Julien le 23.09.2026). C'est un critère P0 du cahier des charges que la pige n'a pas tenu : « c'est fait quand l'agent voit ce qui est apparu, a baissé ou a disparu, **avec les acheteurs concernés** ».

## 2. Ce qu'on a mesuré

L'état des lieux du 23.09.2026, dans le code :

| Surface | Ce qui existe | Ce qui cloche |
|---|---|---|
| **Le fil** | Liens d'arrivée `?contact=` et `?annonce=p:` (mandat seul) | Pas de `?onglet=`, pas de ligne à sélectionner, pas de feuille « Retours » à ouvrir, rien pour une annonce du marché |
| **« Aujourd'hui »** | Matchs forts dans « Dossiers » (`focus_top_matches`), réponses dans « Pendant ton absence » (`today_absence`), relances de proposition dans trois blocs | Aucun signal « pourquoi maintenant », rien de la pige ; les matchs de « Dossiers » s'affichent sans leur raison ; motif brut ; vocabulaire de la page de réception retirée (« a aimé », « a écarté ») ; ⛔ **« Reprendre » marque la relance faite sans qu'aucune réponse soit consignée** — les matchs restent `sent` et le fil perd leur échéance |
| **« Sa boucle »** | `useContactSentMatches`, en direct sur `matches` | ⛔ Le motif s'affiche en code brut (`prix`) ; ⛔ **un bien revenu disparaît** — il redevient `suggested` et le filtre de statut l'exclut, en direct ; une visite planifiée s'affiche « Proposé » ; ni date ni prix ; « Plus tard » et « Ignorer » ne font que masquer jusqu'au rechargement ; « Proposer la visite » perd le match ; ordre instable sur une sélection |
| **Fiche du bien** | « Suggestions MEGGA AI » = les matchs `suggested` du bien | ⛔ **Elle charge TOUS les matchs de l'agence** (`useMatching()`) pour en garder quelques-uns : 1 754 en production le 21.09.2026, et PostgREST tronque à 1 000 sans rien dire — des acquéreurs disparaissent déjà ; un match reporté ou revenu s'affiche comme une suggestion ordinaire ; « Proposer » mène au matching sans aucun paramètre ; un libellé « IA » sur un score déterministe |
| **Fiche d'une annonce** | — | Aucun « Qui pour ce bien ? » |
| **« Ce qui a bougé »** (pige) | `pige_mouvements` rend l'événement, l'annonce, les prix et la date | ⛔ **Aucun compte d'acheteurs** : la ligne ne montre que le prix et la date, alors que le cahier demande que « chaque ligne dise s'il existe des acheteurs compatibles » |

## 3. Principes

1. **Une surface montre et oriente ; le fil agit.** Aucune surface de D1 ne recopie un geste du fil. Chacune dit ce qui se passe, et **un** geste mène à la bonne place du fil.
2. **Toute action a sa raison.** Un élément sans « pourquoi » ne s'affiche pas.
3. **On ne charge jamais tout pour en garder cinq.** Chaque surface lit ce qui la concerne, borné côté serveur (§7 de CLAUDE.md).
4. **Rien ne part vers l'acheteur.** `matching-sans-sortie.spec.ts` couvre les fichiers neufs.

## 4. Le socle : le fil sait où arriver

Trois liens d'arrivée neufs, lus une fois, à l'arrivée, comme les deux qui existent :

| Lien | Effet |
|---|---|
| `?onglet=aProposer\|enAttente\|aConclure` | Ouvre l'onglet ; une valeur inconnue retombe sur « À proposer » (`ongletValide`) |
| `?ligne=<clé>` | Sélectionne une ligne de l'ordre du fil : un match (`<id>`), l'en-tête d'un bien (`bien:<id>`), une ligne « Marché » (`marche:<contactId>`). Une clé absente de l'ordre ne sélectionne rien et ne casse rien |
| `?attente=<contactId>` | Ouvre la feuille « Retours » de cet acheteur, dans « En attente » — sa ligne y a pour clé `attente:<contactId>`. ⚠ Pas `?retours=` : le filet secondaire de `redirection-ouverte.spec.ts` lit tout paramètre qui commence par `retour` comme une URL de retour |

⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus — même règle et même mécanique que `?contact=` aujourd'hui. Une ligne sans onglet ouvre « À proposer » ; `?attente=` filtre aussi le fil sur l'acheteur. Les liens se construisent par `lienFil` et se lisent par `lireArrivee` (`matching-fil/filLiens.ts`), jamais à la main : un paramètre renommé d'un côté ne survit pas de l'autre. Le pager de Matching atterrit sur le fil pour chacun d'eux, comme pour `?contact=`.

⛔ **`?annonce=m:` n'est pas construit** (23.09.2026, à la rédaction du plan) : aucune surface de D1 n'y mène, et le fil range les annonces du marché dans les lignes « Marché », qu'un filtre de bien écarte (`construireSelections`). Voir §10.

## 5. « Aujourd'hui » : le bloc Matching

### 5.1 Les quatre actions, dans cet ordre

Le bloc est le **troisième segment** de la colonne droite — **Dossiers | Annonces | Matching** —, et le segment porte son compte : une action ne se cache pas derrière un clic sans le dire.

| # | Action | Quand | Geste |
|---|---|---|---|
| 1 | « Retour à consigner pour Julie · 2 biens » | Une relance de proposition (`follow_up_sent_property`) est échue et ses matchs sont encore `sent` | `?attente=<contact>` |
| 2 | « Prix baissé de CHF 250'000 sur le bien proposé à Julie » (ou « … refusé par Julie ») | Le signal du lot B : prix actuel sous `prix_propose`, sur un match proposé ou refusé pour le prix | La place du match dans le fil (`lienPlace`) : « Retours de … » s'il attend une réponse ; sa ligne s'il est revenu à proposer — la ligne « Marché » de l'acheteur pour une annonce du marché, que le fil range là |
| 3 | « Nouveau mandat · 4 acquéreurs compatibles » | Un mandat signé ou mis en service il y a 7 jours au plus — la plus récente des deux dates, la règle du signal « nouveau mandat » du lot C —, avec au moins un match compatible | La fiche du bien, sur « Qui pour ce bien ? » |
| 4 | « Nouveau bien à Cologny pour Anastasia » ; à plusieurs, « Anastasia · 2 nouveaux biens, 1 en baisse » | Des annonces du marché nouvelles (3 jours) ou en baisse (14 jours) compatibles avec un acheteur — les seuils de `matching_fil_marche_resume`, sans les biens déjà proposés à cet acheteur : leur baisse est l'action 2, et un bien ne s'annonce pas deux fois. Une seule annonce est NOMMÉE ; au-delà, on compte, pour qu'un acheteur tienne en une ligne | `?ligne=marche:<contact>` |

⚠ « pour Julie », jamais « de Julie » : le français élide devant une voyelle (« d'Emma »), et une interpolation ne le sait pas — même règle que le fil.

**L'ordre dit l'urgence** : un retour dû ferme la boucle, une baisse sur un bien déjà montré est l'argument le plus fort pour rappeler, un nouveau mandat est une occasion, le marché est un flux. À l'intérieur d'une même sorte : la plus ancienne échéance d'abord pour les retours, la plus forte baisse pour les prix, le plus récent pour le reste.

**Cinq au plus**, puis « Voir tout », qui ouvre le fil. Les seuils sont ceux des signaux du lot C (`filSignaux.ts`), et la spec des signaux les confronte déjà au SQL : ils ne se recopient pas.

### 5.2 La source : une RPC bornée

`matching_actions_du_jour(p_limite int default 5)` — `security invoker`, filtrée par `get_user_agency_id()`, comme `matching_fil_marche_resume`. Elle rend les actions déjà classées et coupées, avec ce qu'il faut pour les écrire et pour construire leur lien. La page ne lit jamais les matchs de l'agence.

⚠ **Un nom neuf, jamais un `CREATE OR REPLACE` d'une RPC existante dont le type change** : le date-guard réapplique les migrations du jour à chaque push (leçon du lot C).

### 5.3 Ce qui change ailleurs sur la page

- **« Dossiers »** ne reçoit plus de matchs : un même match ne s'affiche plus deux fois, dont une sans raison.
- **« Pendant ton absence »**, sur sa partie matching seulement :
  - le motif s'affiche **libellé** (`fil.motifs.<code>`) ;
  - « a aimé » / « a écarté » deviennent le vocabulaire d'un **retour consigné** : ces mots étaient ceux de la page de réception, retirée le 21.09.2026 ;
  - ⛔ **« Reprendre » ouvre la feuille « Retours »** au lieu de passer la relance à `done`. Aujourd'hui il la clôt sans qu'aucune réponse soit consignée : les matchs restent `sent`, et l'onglet « En attente » du fil perd leur échéance. `today_absence` rend donc le TYPE de chaque rappel et le nombre de biens encore sans réponse (sa sortie reste un `jsonb` : le date-guard peut la rejouer).
  - Le mobile n'est pas repris (§8), mais il partage le hook : il ne clôt plus une relance de proposition non plus — il ouvre la fiche du contact, sans rien écrire.

## 6. « Sa boucle » : toute la boucle, lisible

**Ce qu'elle lit** : les matchs du contact dont le statut est `sent`, `interested`, `rejected` ou `visit_planned`, **plus** ceux redevenus `suggested` qui portent encore un suivi (`prix_propose` ou `reaction_motif` posé) — les biens revenus, la même règle que `suiviAProposer` dans le fil. Tri stable : `sent_at` décroissant, puis l'id.

**Ce qu'elle montre, par bien** :

| État | Ce qui s'écrit |
|---|---|
| Proposé | la date de la proposition et le prix à ce moment |
| Intéressé | la date du retour |
| Visite planifiée | **son propre état** — aujourd'hui elle s'affiche « Proposé » |
| Pas intéressé | le motif **libellé** et la note de l'agent (`reaction_note`, jamais lue aujourd'hui) |
| Revenu | « Refusé à CHF 3'450'000 · baissé de CHF 250'000 depuis » — le texte du fil (`texteSignal`) |

**En plus** : la correction de recherche en attente (« Apprendre », lot B), calculée par les règles pures du fil (`filApprendre`) sur les refus de ce contact, avec un lien vers le fil.

**Les gestes** : chaque bien que le fil porte encore ouvre SA place dans le fil (`lienPlace`) — « Retours de … » s'il attend une réponse, « À conclure » s'il intéresse, sa ligne s'il est revenu. Un refus ou une visite planifiée n'y ont plus de place : leur ligne ne mène nulle part, plutôt qu'à une page où on ne les trouverait pas. Un bien proposé dont le prix a baissé depuis le dit, avec le texte du fil. « Proposer la visite » ouvre le match intéressé dans « À conclure », au lieu de perdre le match en route. « Plus tard » et « Ignorer » **sont retirés** : ils ne faisaient que masquer une ligne jusqu'au rechargement, sans rien écrire — deux faux gestes.

⚠ **Deux lectures parallèles, pas un `or(…)`** : les statuts de la boucle d'un côté (`status in (…)`), les biens revenus de l'autre (`status = suggested` et `prix_propose > 0` — un bien revenu a forcément été proposé, donc porte son prix de proposition). Les deux passent par des opérateurs que le banc sait appliquer. La conception prévoyait d'apprendre `or` au banc ; l'état des lieux a montré qu'il fallait un analyseur d'arbres booléens à parenthèses imbriquées — un risque sans nécessité, écarté (23.09.2026). `or` reste en attente au banc, et le dit en console.

## 7. « Qui pour ce bien ? » sur les fiches

**Un composant partagé.** Les deux listes du panneau du fil — compatibles, anciens prospects — sortent de `FilQuiPourCeBien` dans un composant qui ne porte ni l'en-tête du bien ni la notion de ligne du fil : « Ouvrir » y devient un lien (`?ligne=`). Il sert trois places :

| Place | Compatibles | Anciens prospects |
|---|---|---|
| Le fil (en-tête d'un bien) | ✓ | ✓ — inchangé |
| La fiche d'un mandat | ✓ | ✓ |
| La fiche d'une annonce du marché | ✓ | — (en attente) |

**Sa source, sur la fiche** : ⛔ **les matchs DU bien**, par une requête ciblée (`property_id` ou `market_listing_id`), jamais `useMatching()`. C'est ce qui corrige la troncature silencieuse. Un match reporté dit jusqu'à quand ; un bien revenu dit à quel prix il avait été refusé.

Sur la fiche d'un mandat, un acheteur déjà en deal sur ce bien reste dans « Acheteurs en cours » et sort de la liste, comme aujourd'hui.

**Le libellé** : « Suggestions MEGGA AI » devient « Qui pour ce bien ? ». Le score est celui du moteur, déterministe : l'appeler IA ment sur sa nature.

**Après « Réactiver »** : la liste de la fiche se rafraîchit aussi. Aujourd'hui `useAnciensProspects` n'invalide que la clé du fil.

**Le nouveau mandat.** L'écran de fin de « Nouveau bien » dit « Recherche des acquéreurs compatibles… », puis « 4 acquéreurs compatibles », en écoutant les matchs du bien en direct (`matches` est dans la publication Realtime). Le moteur les calcule quelques secondes après la création, par le déclencheur `on_property_active`. Au-delà de 30 secondes sans match, la ligne dit « Aucun acquéreur compatible pour l'instant » plutôt que de tourner indéfiniment — un mandat sans acquéreur compatible est un résultat, pas une attente. « Voir qui » ouvre la fiche, sur « Qui pour ce bien ? ».

**Un lien vers une fiche peut demander le bloc** : `?qui=1` fait défiler la fiche jusqu'à lui — « Aujourd'hui », « Ce qui a bougé » et l'écran de fin de « Nouveau bien » l'écrivent (`cheminFicheQuiPour`). Les colonnes de la fiche d'un mandat défilent chacune : sans lui, le bloc peut être sous le pli.

## 7bis. « Ce qui a bougé » : les acheteurs de chaque ligne

Chaque ligne du flux dit **« 3 acheteurs »** quand des acheteurs compatibles existent, et ne dit rien sinon : la ligne dit s'il y en a, pas qu'il n'y en a pas. La pastille ouvre la fiche de l'annonce sur « Qui pour ce bien ? » (§7).

**Qui compte** : les contacts distincts qui ont sur cette annonce un match `suggested`, `sent`, `interested` ou `visit_planned` — les compatibles du §7, ceux qu'un refus ou un « Pas intéressé » n'a pas écartés.

**La source** : une RPC à part, `pige_acheteurs_compatibles(p_annonces uuid[])`, appelée avec les identifiants de la page chargée (30 au plus). `security invoker`, filtrée par `get_user_agency_id()`, servie par l'index `idx_matches_market_listing`.

⚠ **`pige_mouvements` ne change pas** : lui ajouter une colonne changerait son type de retour, et le date-guard qui réapplique une migration du jour ferait échouer son `CREATE OR REPLACE`. Une RPC à part, appelée en lot, laisse le flux intact — et sa pagination par clé avec.

## 8. Ce qui ne change pas

- **Le moteur de matching** : ni ses notes, ni ses modes. Les anciens prospects restent notés contre un mandat seulement.
- **Les gestes du fil** : ils restent les seuls. D1 n'en ajoute aucun hors du fil.
- **Le catalogue** (page 2 d'« Aujourd'hui ») : le lot E le remplace.
- **Le mobile** : « Aujourd'hui » et la fiche contact mobiles ne sont pas repris (lot E).

## 9. Garde-fous

| Spec | Ce qu'elle refuse |
|---|---|
| `matching-actions-du-jour.spec.ts` (backend) | Un ordre faux entre les quatre sortes ; plus de cinq actions ; une action d'une autre agence ; un retour compté alors que ses matchs ont reçu une réponse |
| `sa-boucle.spec.ts` (unitaire) | Une visite planifiée rendue « Proposé » ; un bien revenu absent ; un motif en code brut ; un ordre instable |
| `fiche-qui-pour.spec.ts` (unitaire) | La fiche qui lirait les matchs de l'agence au lieu de ceux du bien (lecture du code) ; un reporté ou un revenu rendu comme une suggestion |
| `fil-liens-arrivee.spec.ts` (unitaire) | Un lien d'arrivée inconnu qui casse le fil ; une clé de ligne absente qui sélectionne n'importe quoi |
| `pige-acheteurs.spec.ts` (backend) | Un compte qui inclurait un refus ou une autre agence ; un contact compté deux fois pour deux matchs sur la même annonce |
| `matching-sans-sortie.spec.ts` (étendue) | Tout fichier neuf de D1 qui écrirait à l'acheteur |
| Le banc | Les fixtures de `today_absence`, `focus_top_matches` et de la RPC neuve — sans elles, le banc disait toujours « Tu es à jour », relance échue comprise |

## 10. En attente (hors périmètre — rien n'est fait sans accord de Julien)

- Le catalogue d'« Aujourd'hui » : un match refusé y porte l'étiquette « Nouveau », la baisse y vaut 0 en dur, et il charge tous les matchs de l'agence (même troncature que la fiche) — le lot E le remplace.
- Les anciens prospects d'une annonce du marché (le moteur ne note que contre un mandat).
- Les prescripteurs de « Qui pour ce bien ? » : ils attendent les relations (étape 6).
- L'étincelle « MEGGA AI » posée sur le texte système d'une relance, dans « Ta journée ».
- Un lien mort dans « Dossiers » : un élément de type bien y mène à `/dashboard/contacts/property:…`.
- « Aujourd'hui » et la fiche contact sur mobile (lot E).
- `?annonce=m:<uuid>` : un filtre du fil sur une annonce du marché. Aucune surface de D1 n'y mène, et le fil range les annonces du marché dans les lignes « Marché », qu'un filtre de bien écarte — à concevoir avec le lot E.
