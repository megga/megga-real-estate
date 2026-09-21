# Matching : la boucle fermée chez l'agent (conception)

**Date :** 21.09.2026 · **Statut :** à valider par Julien · **Remplace :** le §6 (« L'envoi et les retours ») et la décision D4 de [la conception du fil](2026-09-17-matching-fil-design.md), qui reste valable pour la liste, le panneau, la sélection du marché, les filtres et le score.

## 1. La décision

> « Le matching doit exclusivement rester à l'agent. » (Julien, 21.09.2026)

Le matching ne va jamais jusqu'au client. Rien de ce qu'il produit (un bien, une sélection, un lien, une relance) ne part vers l'acheteur par le CRM. L'agent présente les biens par ses propres moyens (un appel, un rendez-vous, sa messagerie à lui) et le CRM consigne ce qu'il en ressort.

**WhatsApp reste, du côté de l'agent** : le copilote lui dit ce qui l'attend et reçoit ses comptes rendus. Il n'écrit jamais à l'acheteur au nom du matching.

## 2. Ce qu'on a mesuré

En production, le 21.09.2026 (lecture seule) :

| Mesure | Valeur |
|---|---|
| Matchs, tous statuts | 1 754, tous `suggested` |
| Liens de réception jamais créés (`buyer_reception_links`) | 0 |
| Matchs jamais envoyés, par quelque canal que ce soit | 0 |
| Événements d'envoi au journal (`reception_*`, `dossier_envoye`, `whatsapp_ai_send_listings`) | 0 |

**Conséquence :** retirer ce qui sort ne perd aucune donnée et ne casse aucun lien en circulation.

**Le vrai manque :** la boucle se fermait CHEZ LE CLIENT (il cliquait ♥ ou ✕ sur sa page). Côté agent, il n'existe aucun geste « Pas intéressé », aucune saisie de motif, et rien n'écrit jamais `visit_planned`. Sans la page client, la boucle ne se ferme plus nulle part. Elle doit se fermer chez l'agent.

## 3. Principes

1. **Rien ne sort.** Aucun code du matching n'appelle un envoi vers l'acheteur. Une garde de test le vérifie (§9).
2. **La réponse de l'acheteur est une donnée de l'agent.** C'est lui qui la consigne, en un geste.
3. **Un geste, un suivi.** Proposer une sélection de N biens pose UNE relance, pas N.
4. **La boucle apprend.** Un refus avec motif corrige la recherche de l'acheteur, et les matchs suivants en tiennent compte.
5. **Le plus simple possible.** Chaque temps de la boucle tient en un geste, avec la touche clavier qui va avec.

## 4. La boucle en cinq temps

```
 Détecter ──► Proposer ──► Consigner la réponse ──► Agir (visite, deal)
    ▲                               │
    └──────────── Apprendre ◄───────┘ (motifs de refus → recherche corrigée)
```

**Ce que Gregory demande pour le matching** (message du 21.09.2026, points 4, 5, 9 et 12 ; le reste de son message est au §11) :

- **Un matching qui explique** (« 92 % compatible, et pourquoi », pas « Gstaad + chalet = match ») → 4.1.
- **Le matching inversé** (« Villa Cologny 22 MCHF → 7 acquéreurs compatibles, 3 anciens prospects ») → 4.2.
- **Les signaux du matin** (« nouveau bien à Cologny correspondant à Cliente A », « prix du bien proposé à Client B réduit de 900 000 CHF », « nouveau mandat susceptible d'intéresser 4 acquéreurs ») → 4.1, 4.6 et §5.
- **L'automatisation** (« nouveau bien > 10 M → cherche les acquéreurs → informe Gregory → prépare les messages → Gregory valide → envoi → suivi → rappel ») → 4.3, avec une limite : l'envoi reste le geste de l'agent, pas du CRM (§10).

### 4.1 Détecter, et dire pourquoi maintenant

Le moteur trouve les paires bien ↔ acheteur, comme aujourd'hui. La page Recherche l'alimente aussi : son « Envoyer N biens » devient **« Ajouter à la sélection de Julie »** (les biens entrent dans le fil en `suggested`), au lieu de créer un lien.

**Un score qui s'explique.** Le fil montre déjà le score sur 100 (« estimation ») et, critère par critère, ce que l'acheteur cherche face à ce que le bien offre. Le moteur gagne les critères que Gregory cite, **là où la donnée existe** :

| Critère | Donnée | Couverture mesurée (21.09.2026) |
|---|---|---|
| Chambres | `bedrooms` | nos mandats ; marché : 27 annonces actives sur 96 511 |
| État (neuf, rénové) | `condition` (mandats), `year_built` / `year_renovated` | marché : 54 % des annonces actives |
| Off-market | nos mandats non publiés | mandats seulement, par définition |
| Vue, piscine | équipements saisis ; `has_nice_view` / `has_swimming_pool` | `has_nice_view` : 0 annonce renseignée |

**Règle :** un critère sans donnée est « non évalué », jamais compté comme tenu (même règle que le lot 1). Le score dit ce qu'il sait, et la ligne dit ce qu'il ne sait pas. Un bien à 92 % dont on ignore les chambres ne se présente pas comme un bien à 92 % qui a les chambres.

**Pourquoi maintenant.** Une ligne du fil peut porter un signal daté, en tête de son résumé :

| Signal | Source |
|---|---|
| Nouveau sur le marché (moins de 3 jours) | `market_listings.first_seen_at` |
| Prix baissé (montant et date) | `price_at_first_seen`, `current_price`, `price_reduced_at` (1 614 annonces actives en baisse) |
| Nouveau mandat | `properties.mandate_signed_at` |
| Proposé par plusieurs agences | exige le dédoublonnage des annonces (§11, point 2) : pas avant |

Dans « À proposer », les lignes à signal passent devant, à score égal.

### 4.2 Le matching inversé : qui pour ce bien ?

Depuis un bien (un mandat ou une annonce du marché), une vue **« Qui pour ce bien ? »** répond en trois groupes :

1. **Acquéreurs compatibles** : les matchs de ce bien, par score (ils existent déjà ; le fil les groupe par bien dans « Vos biens »).
2. **Anciens prospects** : les acheteurs dont la recherche est close ou inactive, ou dont le deal a été perdu, notés **à la demande** contre ce bien, au même seuil. Un clic les réactive (la recherche redevient active et le match entre dans « À proposer »).
3. **Prescripteurs** : ceux dont les clients pourraient être intéressés. Ce groupe attend le modèle relationnel (§11, points 6 et 7) ; il n'est pas construit ici.

Accès : la fiche du bien (mandat), la fiche d'une annonce du marché, et l'en-tête d'un groupe « Vos biens » du fil. Pour un **nouveau mandat**, la vue s'ouvre d'elle-même à la création : « 4 acquéreurs compatibles ».

### 4.3 Proposer

L'agent présente le bien à l'acheteur, hors du CRM. Dans le CRM, un geste : **« Proposé à Julie »** (touche E), pour un bien en mandat ou pour les biens cochés d'une sélection du marché.

- Écrit : `matches.status = 'sent'`, `sent_via = 'agent'` (nouvelle valeur), `sent_at`.
- Un deal : l'actif, sinon un `new_lead` sur le meilleur bien (inchangé).
- UNE tâche de relance `follow_up_sent_property` à **+3 jours**, canal `task`, visible de l'agent seul : « Retour de Julie sur 2 biens proposés ».
- UNE ligne au journal (`match_propose`, avec la liste des matchs).
- **Aucun envoi.** Pas de feuille WhatsApp, pas de lien, pas d'e-mail.

Si l'agent a déjà la réponse (il propose pendant l'appel), il la consigne directement (4.4) sans passer par « Proposé ».

**Le prix au moment de proposer** est gardé sur le match (nouvelle colonne `matches.prix_propose`) : c'est lui qui permet de dire plus tard « prix baissé de 900 000 CHF depuis que vous l'avez proposé » (4.6).

**L'automatisation que demande Gregory** (« nouveau bien > 10 M → acquéreurs → informe → prépare les messages → valide → envoi → suivi ») se fait ainsi : le CRM trouve les acquéreurs (4.1, 4.2), prévient l'agent (fil, Aujourd'hui, point du matin WhatsApp), prépare le suivi (la relance) et consigne. **L'envoi reste le geste de l'agent**, avec ses propres outils. Faut-il que le CRM lui prépare un brouillon de message à copier ? À trancher (§10).

### 4.4 Consigner la réponse

Une feuille **« Retours de Julie »** liste les biens proposés et pas encore répondus. Pour chacun, trois choix :

| Choix | Écrit | Suite |
|---|---|---|
| **Intéressé** | `status = 'interested'` | propose tout de suite « Planifier une visite » (4.5) |
| **Pas intéressé** | `status = 'rejected'`, `reaction_motif`, `reaction_note` facultative | alimente « Apprendre » (4.6) |
| **Pas encore** | rien | le bien reste en attente, la relance est repoussée de 3 jours |

**Les motifs** (un geste, une puce) : prix, quartier, surface, pièces, type de bien, équipements, état du bien, autre (+ note). Liste à confirmer avec Gregory.

Les triggers existants (`set_match_response_at`, `log_match_reaction`) posent déjà `response_at` et la ligne `match_reaction` au journal quel que soit l'écrivain : la réponse consignée par l'agent y est tracée en `actor_kind = 'user'`.

La relance est close quand plus aucun bien de la proposition n'attend de réponse.

### 4.5 Agir

« Intéressé » ouvre **« Planifier une visite »** : la visite est créée en interne (comme l'outil `schedule_visit` du copilote : aucune invitation au client), le match passe à `visit_planned`, le deal avance. Rien d'autre ne change dans le pipeline.

### 4.6 Apprendre

Les motifs de refus s'additionnent par acheteur. Au **deuxième refus pour un même motif**, le fil propose une correction de la recherche, chiffrée à partir des biens refusés :

| Motif | Correction proposée |
|---|---|
| prix | abaisser le budget maximum sous le prix le plus bas refusé pour ce motif |
| quartier | retirer le quartier (ou la ville) des zones |
| surface | relever la surface minimum au-dessus de la plus grande surface refusée |
| pièces | relever le minimum de pièces |
| type de bien | restreindre au type des biens acceptés |
| équipements | rendre obligatoire l'équipement absent des biens refusés |
| état, autre | pas de correction automatique : la note reste lisible sur la fiche |

L'agent valide en un geste (ou ignore). La recherche (`client_searches.criteria`) est mise à jour, et **les matchs encore à proposer de cette recherche sont réévalués** : ceux qui ne passent plus le seuil sortent du fil (`ignored`, motif « recherche ajustée »), avec une trace au journal.

**Un refus n'est pas définitif quand le monde bouge.** Un bien refusé pour le **prix** revient dans « À proposer » si son prix baisse sous celui auquel il a été proposé (`prix_propose`), avec le signal « Prix baissé de 900 000 CHF depuis le refus de Julie ». Même règle pour un bien proposé et resté sans réponse : sa ligne d'« En attente » porte le signal, et la relance du jour le dit. Les autres motifs ne réactivent rien.

⚠ Aujourd'hui, le moteur ne re-note pas une paire existante (`ON CONFLICT DO NOTHING`, §13 de la conception du fil). Apprendre exige de lever ce verrou pour les matchs `suggested` d'une recherche modifiée. C'est le morceau serveur de ce chantier.

## 5. Où l'agent ferme la boucle

| Surface | Ce qu'il y fait |
|---|---|
| **Le fil (bureau)** | Trois onglets : **À proposer** (les suggestions, mandats et sélections du marché), **En attente** (les biens proposés sans réponse, relances dues en tête), **À conclure** (les intéressés sans visite). Les gestes du §4. |
| **Aujourd'hui** | Les signaux du matching deviennent des actions du jour, avec leur raison : « Nouveau bien à Cologny pour Anastasia », « Prix baissé de 900 000 CHF sur le bien proposé à Julie », « Nouveau mandat : 4 acquéreurs compatibles », « Retour de Julie sur 2 biens » (qui ouvre la feuille « Retours »). |
| **Fiche contact** | « Sa boucle » : proposés, intéressés, refusés avec leurs motifs, la correction de recherche en attente. Plus de « vu », plus de lien. |
| **Fiche d'un bien** (mandat ou annonce du marché) | « Qui pour ce bien ? » (4.2). |
| **Mobile** | Après un appel : la feuille « Retours » en plein écran, les mêmes gestes. |
| **WhatsApp (copilote de l'agent)** | Voir 5.1. |

### 5.1 WhatsApp, côté agent

- **Le point du matin** (`whatsapp-morning-brief`, 07h30) ajoute le matching à son décompte : nouveaux biens compatibles, baisses de prix sur des biens proposés, nouveaux mandats et leurs acquéreurs, retours à consigner, intéressés sans visite. Il part déjà par le modèle **approuvé** `agent_daily_brief` : **aucun nouveau modèle Meta** n'est nécessaire. Le détail arrive par « mon point du jour » (`get_daily_brief`).
- **« Quels biens pour Julie ? »** : l'outil existant `get_matches` (lecture seule), qui rend désormais le score ET son explication (critères tenus, non évalués, signal). **« Qui pour la villa de Cologny ? »** : un outil `get_buyers_for_property`, le matching inversé du 4.2.
- **Consigner par message** : un nouvel outil interne `record_match_outcome` (proposé, intéressé, pas intéressé + motif) pour « Julie intéressée par l'attique » ou « Julie refuse Florissant, trop cher ». Même contrat que les autres outils internes du copilote (écho de ce qui a été consigné, annulable dans le message suivant) ; il n'écrit jamais au client.
- **« Organise une visite de l'attique avec Julie mardi 14h »** : l'outil existant `schedule_visit`, qui pose en plus `visit_planned` sur le match.
- **Retiré** : l'outil `send_listings`, qui envoyait des biens au client.

## 6. Le nettoyage (ce qui part)

### 6.1 Retiré

- La page publique `/reception/:token`, ses jetons `RC`, `useBuyerReception`, sa surface du banc `/dev/public`, `rc-contraste.spec.ts`.
- Les fonctions serveur `buyer-reception-create`, `-get`, `-react` (et leurs blocs de `config.toml`), puis **leur dépublication** par le workflow manuel `purge-orphan-functions.yml` (un déploiement ne retire rien).
- La table `buyer_reception_links`, les RPC `record_buyer_reaction` et `revoke_reception_link` (migration ; la table est vide).
- `send-property-email` et son gabarit, avec leurs deux appelants : l'atelier (canal e-mail de `execSendDossier`) et le bouton « Envoyer par e-mail » de la fiche d'une annonce du marché.
- L'appel de `send-relance-email` par le geste R de l'atelier (la fonction reste : « Aujourd'hui » et le copilote s'en servent hors matching).
- L'outil WhatsApp `send_listings` (outil, préparation, exécution, chaînes, tests).
- Les feuilles d'envoi `AtlSendSheet`, `MrhSendSheet`, `FilFeuilleEnvoi`, les hooks `useCreateReceptionLink`, `useSendReceptionSelection`, `useReceptionLinks`, les liens de la fiche contact (`CdLinks`).
- Dans `automation-engine`, la relance J+3 par e-mail des biens envoyés (§1) : la tâche posée par le geste « Proposé » la remplace, ce qui règle aussi le doublon N-1 relevé au §13 de la conception du fil.

### 6.2 Gardé (partagé)

`_shared/magic-link-token.ts` (KYC, rendez-vous, désinscription, rapport KYC), `send-relance-email`, `insert_market_matches` (moteur et Recherche), les colonnes `sent_via` / `sent_at` / `response_at` / `reaction_motif` / `reaction_note`, les triggers de réaction, les libellés historiques du journal (`reception_link_created`, `dossier_envoye`, `whatsapp_ai_send_listings`).

### 6.3 Adapté

- **Atelier (en production jusqu'à la bascule)** : « Envoyer le dossier » devient « Proposé » (sans e-mail) ; « Relancer · autre canal » repousse la relance sans rien envoyer ; la touche I reste ; « Pas intéressé » s'ajoute.
- **Recherche** : « Envoyer N biens » devient « Ajouter à la sélection de … ».
- **Mobile** : « Envoyer » devient « Proposé » ; la feuille « Retours » s'ajoute au lot de la bascule.
- **Aujourd'hui** : `sent_via = 'email'` écrit sans rien envoyer devient `'agent'` ; « Retours acheteurs » (pendant l'absence) disparaît ou devient « retours consignés par l'équipe ».
- **Le fil (lots 1 et 2, non commités)** : la feuille d'envoi disparaît ; « Proposer » et « Envoyer N biens » deviennent « Proposé ». Le panneau, la sélection du marché, les filtres et le score restent.
- **Données** : `matches_sent_via_check` accepte `'agent'` ; les lignes historiques gardent leur valeur.
- **Documentation** : CLAUDE.md (la face publique passe de six à cinq surfaces), `docs/system-map.md`, `docs/pages.md`, les articles d'aide Intercom (publication externe, avec l'accord de Julien), le cerveau.

## 7. Découpage

| Lot | Contenu | Où |
|---|---|---|
| **A · Nettoyage** | Tout le §6 : retrait de ce qui sort, gestes internes dans l'atelier, Recherche et mobile, migration (table, RPC, `sent_via = 'agent'`), dépublication des fonctions, docs. | Production, à la fusion |
| **B · La boucle dans le fil** | Onglets En attente et À conclure, « Proposé » (avec `prix_propose`), feuille « Retours », motifs, « Planifier une visite », Apprendre (correction proposée, réévaluation des matchs à proposer, réactivation par baisse de prix). | Banc |
| **C · Un matching qui explique et qui s'inverse** | Critères chambres, état, off-market au moteur (là où la donnée existe) ; signaux « pourquoi maintenant » ; « Qui pour ce bien ? » (acquéreurs, anciens prospects). | Banc, puis production |
| **D · WhatsApp et les surfaces de l'agent** | Point du matin, `record_match_outcome`, `get_buyers_for_property`, `schedule_visit` → `visit_planned` ; Aujourd'hui (signaux et relances) ; fiche contact « Sa boucle » ; fiche du bien « Qui pour ce bien ? ». | Production |
| **E · Bascule** | Le fil remplace l'atelier ; mobile ; retrait de l'atelier. | Production |

Le lot A vient d'abord : il ferme la porte vers le client avant qu'on construise la boucle, et il est court (du retrait, surtout).

## 8. Ce qui ne change pas

Le moteur et son score, le seuil de 55, les tables `matches` et `client_searches`, le pipeline et les visites, le copilote WhatsApp hors matching, la page Recherche hors envoi.

## 9. Garde-fous

- **`matching-sans-sortie.spec.ts`** (nouvelle garde) : aucun fichier du matching (`src/components/matching-*`, `src/hooks/*Matching*`, `useAtelierMatching`, `useMatchingFil`, `useSelectionMarche`, la page Recherche, le mobile) n'invoque une fonction qui écrit au client (`send-property-email`, `send-relance-email`, `buyer-reception-*`, `wa.me`) ; l'outil `send_listings` n'existe plus dans `whatsapp-tools.ts`.
- Les gardes existantes suivent les retraits (`redirection-ouverte`, `magic-link-public-surface`, `edge-corps-erreur`, `email-senders-scope`, `token-routes`, grammaire, couleurs, polices).
- Tests des gestes : « Proposé » n'écrit ni e-mail ni lien, une seule relance par proposition ; « Pas intéressé » écrit le motif ; « Apprendre » ne propose rien au premier refus, propose au deuxième.

## 10. À trancher

1. **La liste des motifs** (§4.3) : à confirmer avec Gregory.
2. **Le délai de relance** : 3 jours proposé.
3. **La correction « prix »** : abaisser le budget sous le prix refusé, ou demander à l'agent le nouveau plafond ? Proposé : pré-remplir la valeur, l'agent la modifie avant de valider.
4. **Les articles d'aide Intercom** qui décrivent l'envoi au client : les réécrire (publication externe, accord de Julien au moment de publier).
5. **Le brouillon de message** (point 12 de Gregory) : le CRM prépare-t-il, à la demande de l'agent, un texte personnalisé qu'il copie et envoie lui-même ? Rien ne part par le CRM dans les deux cas. Proposé : non pour le lot B ; à reconsidérer une fois la boucle en place.
6. **« Anciens prospects »** (4.2) : quelle définition ? Proposé : recherche inactive depuis plus de 90 jours, ou deal perdu dans les 24 derniers mois.

## 11. Le reste du message de Gregory

Gregory a envoyé le 21.09.2026 quinze demandes, bien au-delà du matching. Celles qui touchent la boucle sont intégrées plus haut (points 4, 5, 9, 12). Les autres sont des chantiers à part, **hors de cette conception** ; ce qu'on en sait aujourd'hui :

| Point | Demande | Où on en est (mesuré le 21.09.2026) |
|---|---|---|
| 1 | Moteur de pige (apparitions, modifications, disparitions) | La collecte existe (Flatfox, RealAdvisor ; 96 511 annonces actives) avec `first_seen_at`, `last_seen_at`, la détection de disparition. Pas de flux « ce qui vient d'apparaître » lisible par l'agent. |
| 2 | Identité unique par propriété (le même bien sur plusieurs portails) | Pas de dédoublonnage entre portails. Préalable au signal « proposé par plusieurs agences ». |
| 3 | Historique complet du prix | `market_price_history` existe mais est **vide** (0 ligne) ; seuls le premier prix, le prix courant et la date de la dernière baisse sont gardés. |
| 6, 7, 8 | Contact à rôles multiples, graphe relationnel, score relationnel | Un contact a un type ; pas de relations entre contacts. Préalable au groupe « prescripteurs » du 4.2. |
| 9 | Assistant commercial du matin | « Aujourd'hui » et le point du matin WhatsApp existent ; le matching les alimente (§5). |
| 10, 11 | E-mails, WhatsApp, appels enregistrés ; critères extraits | La Messagerie rattache les e-mails aux contacts ; l'extraction des critères de recherche depuis un échange n'existe pas. |
| 13 | Diffusion vers les portails | `publish_to_portals` et `property_syndications` existent ; Gregory recommande des connecteurs plutôt qu'un développement maison. |
| 14 | Réseau inter-agences privé | Retiré du périmètre v1 (CLAUDE.md §8). |
| 15 | Recherche universelle en langage naturel | Le copilote (WhatsApp, dock MEGGA AI) répond déjà à « Quels biens correspondent à Anastasia ? » par `get_matches`. |
| — | Apimo comme moteur immobilier « en dessous » | Décision d'architecture à instruire séparément. |

Gregory propose un cahier des charges technique (modules, priorités P0/P1/P2, données, automatisations, API, ce qu'il faut acheter plutôt que construire). À faire à part, si Julien le souhaite.
