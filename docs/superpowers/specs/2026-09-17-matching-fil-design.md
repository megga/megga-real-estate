# Matching — le fil de matchs (refonte de la page « Matching »)

> **Statut :** conception validée par Julien le 17.09.2026, en conversation, sur maquettes.
> **Périmètre :** la page 0 du pager Matching (`MatchingPage`), aujourd'hui l'« Atelier »
> (`src/components/matching-atelier/`). La page « Recherche » ne change pas.
> **Règle directrice (Julien) :** « faire le plus simple possible pour l'utilisateur ».
>
> ⚠ **Amendée le 21.09.2026 : le matching reste exclusivement chez l'agent.** Rien ne part plus
> vers l'acheteur : la décision D4 (lien de réception), le §3.3 et le §6 (« L'envoi et les
> retours ») sont remplacés par [la boucle fermée chez l'agent](2026-09-21-matching-boucle-agent-design.md).
> La liste, le panneau, la sélection du marché, les filtres et le score restent valables.

---

## 1. Pourquoi refaire l'atelier

Constaté sur le banc `/dev/crm` et dans le code le 17.09.2026 :

1. **Trois portes, trois mises en page.** L'écran principal part d'un bien, la vue acheteur
   (ouverte par un petit lien « N autres biens matchent ce profil ») a une autre disposition,
   le mobile part des acheteurs. Rien ne dit où l'on est.
2. **Le match est invisible.** La file de l'écran principal ne montre que des noms : aucun score,
   aucune raison. Les en-têtes de `AtlQueue.tsx` et `AtlWhy.tsx` renvoient chacun le score à
   l'autre colonne ; il n'apparaît que dans la vue acheteur.
3. **La photo occupe la place de la décision.** La colonne centrale répète le bien déjà nommé en
   haut ; les critères, qui font décider, sont serrés à droite.
4. **Le bouton principal ignore l'étape.** « Envoyer le dossier » reste affiché pour un acheteur
   « Engagé » ou « Sans retour ».
5. **Gestes cachés.** Écarter et Plus tard sont des icônes ; Intéressé (I) et Visite (V) n'existent
   qu'au clavier ; changer de bien n'a aucune affordance.
6. **Les retours des acheteurs sont stockés et jamais montrés** (`matches.status`
   interested/rejected, `reaction_motif`, `reaction_note`, `buyer_reception_links.viewed_at`).
7. **Défauts :**
   - le « Annuler » de l'envoi n'annule rien : `buyer-reception-create` crée le lien et marque le
     match `sent` avant la fin de la fenêtre ;
   - trois chemins d'envoi : lien sans e-mail (vue bien), e-mail (vue acheteur), e-mail (mobile) ;
   - `fmtM` écrit tout en millions, un loyer rend « CHF 0M » ;
   - Plus tard et Écarter n'écrivent rien au journal ;
   - l'atelier charge TOUS les matchs de l'agence avec `properties(*)` et `market_listings(*)`,
     sans pagination (§7 de CLAUDE.md).

**Mesuré en production le 17.09.2026** (une seule agence a des matchs, 4 acheteurs) :

| Source | Matchs | ≥ 90 | 80–89 | 70–79 | < 70 | Dernier créé |
|---|---|---|---|---|---|---|
| Biens en mandat (`property_id`) | 10 | 3 | 1 | 2 | 4 | 15.06.2026 |
| Marché (`market_listing_id`) | 1 618 | 118 | 295 | 444 | 761 | 16.09.2026 |

Matchs du marché par acheteur : 40, 133, 412, 1 033. **Aucun match n'a jamais été envoyé** (tous
`suggested`). Un fil à une ligne par match noierait les 10 mandats sous 1 618 annonces.

---

## 2. Décisions

| # | Question | Décision |
|---|---|---|
| D1 | Autour de quoi s'organise l'écran ? | **Un fil de matchs** (paires bien ↔ acheteur), pas un écran par bien ni par acheteur. |
| D2 | Que faire du marché ? | **Mandats : une ligne par match. Marché : une sélection par acheteur.** |
| D3 | Quelle disposition sur ordinateur ? | **Liste et panneau**, comme la Messagerie. |
| D4 | Comment envoyer ? | **Un seul chemin : le lien privé de réception**, pour un ou plusieurs biens. |
| D5 | Où atterrit « Matching » ? | **Sur le fil.** Recherche reste la page 2 du pager, inchangée. |

---

## 3. Le fil

### 3.1 Trois onglets, un par étape

Un match est dans **un seul** onglet. Le compteur d'un onglet compte ses **lignes** : dans
« À traiter », un acheteur sous un bien et une sélection du marché valent une ligne chacun ; un
en-tête de bien n'est pas une ligne.

| Onglet | Contient | Règle sur les données |
|---|---|---|
| **À traiter** | ce qui n'a jamais été proposé | `status = 'suggested'` et (`snoozed_until` nul ou passé) |
| **En attente** | ce qui a été proposé, sans réponse | `status = 'sent'` |
| **Réponses** | ce à quoi l'acheteur a répondu et qui attend une suite | `status in ('interested','rejected')` et `handled_at` nul |

- **Reportés** (Plus tard) : repliés en bas d'« À traiter » (« 2 reportés · reviennent le 24.09 »),
  dépliables, avec « Réactiver ». Pas d'onglet.
- Un match `ignored` (écarté) ou `visit_planned`, ou une réponse classée, ne s'affiche plus.

### 3.2 Deux sections dans « À traiter »

1. **Vos biens.** Un groupe par bien (vignette, titre, prix, « N acheteurs »), ses acheteurs
   dessous, triés par score décroissant. Les groupes sont triés par leur meilleur score.
2. **Marché · une sélection par acheteur.** Une ligne par acheteur : vignettes empilées des
   meilleurs biens, « N biens pas encore proposés », meilleur score. Triées par meilleur score.
   Une sélection ne compte que les matchs marché `suggested` non reportés, sur une annonce non
   `removed`.

### 3.3 Lignes d'« En attente » et de « Réponses »

- **En attente :** une ligne **par envoi** (un lien peut porter plusieurs biens) : acheteur,
  « 1 bien » ou « 3 biens », date d'envoi, et l'état du lien lu sur `buyer_reception_links` :
  « pas ouvert » (`pending`), « vu le 12.09 » (`viewed_at`), « lien expiré » (`expires_at` passé).
  Un match `sent` sans lien (envois historiques par e-mail : 0 en production) s'affiche sans état.
- **Réponses :** une ligne par match répondu : pastille « intéressé·e » ou « pas intéressé·e », le
  motif et la note s'il y en a.

### 3.4 Filtres

Deux puces en haut : **Bien** et **Acheteur**, plus une recherche texte. Elles remplacent les deux
vues de l'atelier : filtrer sur un acheteur montre, dans chaque onglet, tout ce qui le concerne
(ses matchs sur vos biens, sa sélection du marché, ses envois, ses réponses).

Les liens entrants existants gardent leur sens : `?contact=<id>` ouvre le fil filtré sur cet
acheteur, `?annonce=<clé>` filtré sur ce bien (appelants : fiche deal « Transmettre à … », fiche
contact).

### 3.5 Le score

- Une seule échelle, bureau et mobile : **85 et plus**, **70 à 84**, **55 à 69**. Elle remplace les
  seuils 80/60 de `matching-atelier/format.ts` et 90/75/60 de `crm-mobile/matching/vm.ts`
  (mobile au lot 4).
- Toujours présenté comme une **estimation** (CLAUDE.md §5).
- Rien sous le seuil du moteur (55, `matching_scoring_v2`) : le moteur ne crée pas ces paires ;
  le fil n'invente pas de filtre supplémentaire.

---

## 4. Le panneau d'un match

Ouvert à droite de la liste ; le premier match de l'onglet est ouvert d'office.

1. **Le bien :** photo principale (défilable), titre, prix (`formatCHF` / `formatRent`, jamais
   `fmtM`), adresse, « Voir l'annonce ». Pastille « votre bien » ou « marché ».
2. **L'acheteur :** avatar, nom, état KYC (information, jamais un blocage à ce stade), téléphone
   et e-mail présents ou non. Le nom mène à la fiche contact.
3. **Le score** en grand, « estimation ».
4. **Pourquoi ce match — « Recherché / Ce bien ».** Une ligne par critère que l'acheteur a posé
   (`client_searches.criteria`) : Budget, Quartier, Type, Pièces, Surface, Équipements. Un critère
   non posé n'a pas de ligne. Chaque ligne porte ✓ (correspond) ou ⚠ (écart) :
   - le verdict vient du moteur (`matches.reasons[axe].match`), SAUF pour Pièces et Surface : le
     moteur les a fusionnés en un axe dont le verdict contredit l'une des deux lignes dès que l'autre
     tire la moyenne (deux cas en production le 17.09.2026). Chaque ligne y compare donc sa valeur à
     ses bornes — un fait, pas une note ;
   - les critères sont ceux de la recherche notée (`client_searches.criteria`), jamais ceux de la
     fiche contact (vide pour 3 acheteurs sur 4 en production le 17.09.2026) ;
   - l'écart s'écrit en clair avec le `detail` du moteur (« 12 % au-dessus du budget ») ;
   - **jamais de points** à l'écran.
5. **Déjà reçu :** une ligne d'historique pour cet acheteur — biens déjà proposés, et leurs
   réponses (« 2 biens proposés · 1 intéressé »), ou « aucun envoi ».
6. **Un seul bouton principal, qui suit l'étape :**

| Étape | Bouton principal | Autres gestes |
|---|---|---|
| À traiter (votre bien) | **Proposer à {prénom}** (E) | Plus tard (P), Écarter (X) |
| En attente | **Relancer** (R) | menu « … » : Copier le lien, Retirer le lien |
| Réponse « intéressé », votre bien | **Planifier une visite** (V) | Classer |
| Réponse « intéressé », marché | **Ouvrir l'annonce d'origine** | Classer |
| Réponse « pas intéressé » | **Proposer d'autres biens** | Classer |

- « Proposer d'autres biens » pose le filtre Acheteur et bascule sur « À traiter ».
- Les raccourcis sont **écrits sur les boutons** (infobulle et indication discrète), jamais
  cachés. ↑/↓ passent d'une ligne à l'autre. Les écouteurs clavier lisent `useEcranActif`
  (garde `clavier-ecran-cache.spec.ts`).

---

## 5. La sélection du marché

Ouverte dans le même panneau quand on clique une ligne « Marché ».

- En tête : l'acheteur et sa recherche en une ligne (« CHF 0,9–1,3M · Carouge · appartement ·
  4 pièces et plus · 90 m² et plus »).
- Ses biens du marché `suggested`, par score décroissant, **20 à la fois** (« Voir 20 de plus »).
  Chaque bien : case à cocher, vignette, titre, prix, pièces, surface, score, et **seulement ses
  écarts** (« Plainpalais, hors de ses quartiers ») ou « Tous ses critères ».
- **Pré-cochés :** les biens qui remplissent tous ses critères (✓ sur chaque axe), 5 au plus.
  Tout le reste se coche à la main.
- « Écarter » est **écrit sur chaque ligne** (lien discret, jamais seulement au survol) : même
  écriture que « Écarter » dans le panneau. Décocher, en revanche, n'écrit rien.
- Pied fixe : **« Envoyer N biens à {prénom} »**, désactivé à zéro coché, avec la raison écrite.
- Lien discret « Chercher plus loin dans Recherche » : bascule sur la page 2 avec les critères de
  l'acheteur (comportement existant de Recherche).

---

## 6. L'envoi et les retours

### 6.1 Un seul chemin

« Proposer » (un bien) et « Envoyer N biens » (sélection) ouvrent la même **feuille d'envoi** :

- texte : « Un lien privé. {prénom} voit les biens et vous dit lesquels l'intéressent. Sa réponse
  arrive dans « Réponses ». » ;
- trois choix : **WhatsApp** (message prérempli, comportement actuel d'`AtlSendSheet`), **E-mail**,
  **Copier le lien** ; un canal sans coordonnée est grisé avec la raison (« pas de numéro ») ;
- « Voir ce que {prénom} verra » ouvre l'aperçu **sans rien créer ni marquer** (aujourd'hui
  l'aperçu crée le lien et marque les matchs envoyés).

**Rien ne part sans le clic de l'agent** (CLAUDE.md §5, humain dans la boucle).

### 6.2 Plus de faux « Annuler »

- Le lien est créé **au clic sur un canal**, pas avant. L'envoi n'a donc pas de fenêtre
  d'annulation ; en cas d'erreur, « Retirer le lien » révoque le lien (`status = revoked`) et
  **remet les matchs dans « À traiter »**.
- Plus tard et Écarter gardent la fenêtre d'annulation de `pendingTriage.ts` (4,5 s).
  « Annuler » n'est affiché **que tant qu'il annule encore** (aujourd'hui il reste visible
  après le début de l'écriture).

### 6.3 Ce que chaque geste écrit

| Geste | Écritures | Journal (`activity_events`) |
|---|---|---|
| Proposer / Envoyer N biens | `buyer-reception-create` (lien, matchs `sent`, `sent_via = reception`) ; puis, comme aujourd'hui : deal rattaché ou `new_lead`, rappel `follow_up_sent_property` à +5 j | `reception_link_created` + `dossier_envoye` |
| Relancer | **le même lien** renvoyé par le canal choisi ; rappel repoussé à +5 j | `relance` |
| Plus tard | `snoozed_until` +7 j, rappel `custom` | **nouveau** : `match_reporte` |
| Écarter | `status = ignored` | **nouveau** : `match_ecarte` |
| Réactiver | `snoozed_until` nul, rappel annulé | **nouveau** : `match_reactive` |
| Retirer le lien | lien `revoked`, matchs → `suggested` | **nouveau** : `reception_link_revoked` |
| Planifier une visite | ouvre `/dashboard/visits/new?bienId=…&contactId=…&matchId=…` ; la création de la visite passe le match à `visit_planned` | écrit par la création de visite |
| Classer | `handled_at = now()` | **nouveau** : `match_classe` |

Les noms d'événements marqués « nouveau » sont à confirmer contre la liste des catégories
existantes au moment du plan (ne pas créer un doublon d'un type déjà écrit).

### 6.4 Les retours

- **Réponses en direct :** `matches` est dans la publication Realtime (migration
  `20260903212000`) ; une réaction de l'acheteur fait passer la ligne dans « Réponses » sans
  recharger. Abonnement selon le motif `useId()` (CLAUDE.md §4).
- **« Vu » sans migration :** `buyer_reception_links` n'est **pas** publiée. L'état du lien est
  relu à l'ouverture de l'écran, au retour sur l'onglet et à chaque changement Realtime de
  `matches`. Pas d'ajout à la publication pour ce seul libellé.
- **Aucune pastille rouge** ni notification nouvelle (CLAUDE.md §3).

### 6.5 L'e-mail

Seule pièce serveur nouvelle de l'envoi : aujourd'hui `send-property-email` envoie la fiche du
bien, et `buyer-reception-create` ne connaît que `whatsapp | link`. Il faut un canal `email` qui
envoie **le lien** par Resend, dans la langue du contact (cf. `docs/email-i18n-handoff.md`).

---

## 7. États

| État | Ce qui s'affiche |
|---|---|
| Chargement | squelette de la liste et du panneau |
| Onglet vide | « À traiter » : « Tout est à jour », et la date de retour du prochain reporté ; « En attente » / « Réponses » : une phrase qui dit ce qui y arrivera |
| Aucun acheteur avec critères | « Ajoutez les critères de recherche d'un contact » → Contacts |
| Aucun bien et aucun match | `MatchingFirstRun`, conservé tel quel |
| Échec | message et « Réessayer » |
| Filtre sans résultat | « Rien pour {nom} dans cet onglet » et « Retirer le filtre » |

---

## 8. Données et performance

- **Vos biens :** matchs `property_id not null` de l'agence, colonnes légères seulement
  (id, statut, score, reasons, dates, `snoozed_until`, `handled_at`), contact (id, prénom, nom,
  présence du téléphone et de l'e-mail), bien (id, titre, prix, type de transaction, pièces,
  surface, ville, **première** photo), `client_searches.criteria`. Volume réel : 10 lignes.
- **Marché, lignes du fil :** une RPC de résumé par acheteur (nombre de matchs `suggested`
  non reportés sur annonce non `removed`, meilleur score, trois vignettes). Jamais les 1 618
  lignes au navigateur.
- **Sélection :** les 20 meilleurs matchs marché d'un acheteur, chargés à l'ouverture. Vérifier
  au plan l'index qui sert `contact_id + status + score desc` (CLAUDE.md §7 : pas d'`ORDER BY`
  sans index adapté, pas de `count: 'exact'`).
- **En attente / Réponses :** matchs `sent`, `interested`, `rejected` (volumes faibles) et leurs
  liens.
- **Migration :** `matches.handled_at timestamptz` (et l'index partiel utile à « Réponses »),
  plus la RPC de résumé. `visit_planned` existe déjà dans la contrainte `matches_status_check` ;
  rien ne l'écrit aujourd'hui.
- ⚠ La production n'a **aucun** envoi : « En attente » et « Réponses » ne se prouvent que sur le
  banc tant qu'un premier lien réel n'est pas parti.

---

## 9. Ce qui ne change pas

- La page **Recherche** (page 2 du pager) et le **pager** lui-même.
- Le **moteur** (`matching-engine`, pondérations, seuil 55) et le calcul des scores.
- La **page de réception** de l'acheteur (`/reception/:token`) et ses réactions.
- `MatchingFirstRun`.
- Le **mobile**, jusqu'au lot 4 : il lit `useAtelierMatching` et importe `types.ts`,
  `pendingTriage.ts` et `format.ts` de `matching-atelier/` — ces modules restent jusqu'à ce qu'il
  soit aligné.

---

## 10. Découpage en lots

Chaque lot est visible sur le banc `/dev/crm` (surface « Matching ») avant d'être fusionné.

⚠ **L'atelier reste en production jusqu'à la fin du lot 3.** Le fil ne remplace la page 0 (et ne
devient la page d'atterrissage) qu'une fois « Marché », « En attente » et « Réponses » livrés :
un lot 1 seul retirerait aux agents la vue des 1 618 matchs du marché. D'ici là, le fil vit derrière
le banc.

1. **Lot 1 — Le fil et le panneau.** Modèle de vue pur (étapes, groupes, tris, compteurs, échelle
   de score, lignes « Recherché / Ce bien »), liste et panneau, filtres, section « Vos biens »,
   gestes Proposer / Plus tard / Écarter (feuille d'envoi WhatsApp et Copier le lien), journal de
   Plus tard et Écarter, atterrissage sur le fil. Données de démonstration **refaites pour
   ressembler au moteur** : cinq axes, points jamais négatifs, rien sous 55, critères distincts par
   acheteur, des envois et des réponses (les fixtures actuelles inventent « Année » et
   « Motivation », avec des points négatifs).
2. **Lot 2 — La sélection du marché.** RPC de résumé, lignes « Marché », panneau de sélection,
   envoi de plusieurs biens dans un lien.
3. **Lot 3 — En attente et Réponses.** État du lien, Relancer, Retirer le lien, Classer
   (migration `handled_at`), Planifier une visite → `visit_planned`, canal e-mail.
4. **Lot 4 — Nettoyage et mobile.** Retrait de l'ancien atelier de bureau (code mort interdit),
   mobile aligné sur le même modèle de vue, `docs/system-map.md`, cerveau (`megga/matching-ui-hooks`
   est périmé), CHANGELOG.

**Précisions du plan du lot 1 (17.09.2026).** Le lot 1 ne montre que « À traiter » : les onglets
« En attente » et « Réponses » arrivent avec leur contenu, au lot 3. Il ne charge qu'**une photo**
par bien. Sont reportés au lot 3, parce qu'ils accompagnent la bascule de production ou exigent une
écriture serveur : l'aperçu « Voir ce que {prénom} verra » (le lien ne se crée aujourd'hui qu'en
marquant les matchs envoyés), l'état « aucun acheteur avec critères », `MatchingFirstRun` et le
journal de « Réactiver ». L'atterrissage sur le fil ne vaut que pour le banc.

**Précisions du plan du lot 2 (17.09.2026).** Un envoi de sélection est UN suivi : un deal (l'actif,
sinon un `new_lead` sur le meilleur bien), UNE relance à +5 j et UNE ligne `dossier_envoye` qui liste
les `match_ids` (`execEnvoyerSelection`). Le lien « Chercher plus loin dans Recherche » est reporté au
lot 3 : Recherche ne sait pas s'ouvrir sur un acheteur, et on n'y touche pas. Sur une ligne « Marché »,
`E` envoie les biens cochés ; `P` et `X` n'y font rien. Un filtre « Bien » masque les lignes « Marché ».
La RPC de résumé est `matching_fil_marche()` (migration `20260922121000` : écrite le 21.09.2026, renommée au 22.09.2026, jour de la
fusion, pour le date-guard de `deploy.yml`).

---

## 11. Garde-fous

- **Tests unitaires du modèle de vue :** étape de chaque statut, exclusivité des onglets, groupes et
  tris, compteurs, bornes de l'échelle (54/55, 69/70, 84/85), lignes de critères non posés absentes,
  loyer formaté en CHF par mois.
- **Banc :** états Nominal / Vide / Échec de `/dev/crm`, plus les trois onglets remplis.
- **Gardes existantes :** grammaire MEGGA X (tokens, aucun littéral de rayon, d'espacement ou de
  taille), specs de contraste, parité i18n FR/DE/EN/IT (skill `i18n-sync`), `lint:deadcode`.
- **Accessibilité :** onglets en `tablist`, liste navigable au clavier, focus rendu au panneau,
  modales portées (`createPortal`).

---

## 12. Conformité

- **Objectifs servis :** 1 (temps administratif : un geste par étape), 3 (closing : les réponses
  mènent à la visite), 4 (transparence client : l'acheteur voit la sélection et répond).
- **Humain dans la boucle :** aucun envoi sans clic ; le score reste une estimation.
- **KYC :** affiché, non bloquant à la proposition (décision existante de l'atelier).
- **Audit :** chaque geste écrit `activity_events`, y compris ceux qui ne l'écrivaient pas.
- **LPD :** le lien ne porte qu'un jeton ; aucune donnée personnelle ajoutée à une URL.

---

## 13. À trancher au plan du lot concerné

- **Lot 3 :** expéditeur et texte de l'e-mail du lien (langue du contact).
- **Lot 3 :** durée affichée d'un lien avant « expiré » (défaut serveur actuel : 30 jours).
- **Moteur (hors lot 1) :** `insert_internal_matches` ne re-note pas une paire existante
  (`ON CONFLICT DO NOTHING`) ; une recherche modifiée garde ses anciennes raisons (1 match sur 10 en
  production le 17.09.2026, et 7 sur 10 notés par l'ancienne version du moteur). Le fil ne peut pas
  les écarter : `client_searches.updated_at` bouge à chaque enregistrement du contact (trigger de
  synchro), ce n'est pas un signal. Re-noter (et ne toucher `updated_at` que si les critères changent)
  est à décider avant la bascule de production (lot 3).
- **Lot 3 :** un axe « tenu » (`match` = fraction ≥ 0,5) s'affiche ✓ même quand il n'est tenu qu'en
  partie (un prix 7 % au-dessus du budget peut valoir `match: true`). Afficher le `detail` du moteur
  sur un axe partiel suppose de connaître le poids de l'axe ; d'ici là, les valeurs « Recherché /
  Ce bien » côte à côte montrent l'écart, et les fixtures du banc évitent ce cas.
- **Moteur / automatisations (avant la bascule) :** `automation-engine` pose une relance à +3 j par
  match envoyé resté sans réponse et sans relance portant SON `match_id`. Une sélection de N biens n'en
  porte qu'une : N-1 relances automatiques suivraient, envoyées par e-mail si la règle est en envoi
  automatique. À aligner sur « un envoi, un suivi ».
- **Données (avant la bascule) :** `useMatchingFil` passe à `.in()` la liste des acheteurs qui ont
  une ligne « Marché » (contacts, KYC, historique d'envois), et cette liste grossit avec le nombre
  d'acheteurs ayant une sélection du marché : `matching_fil_marche` ne la plafonne pas. Quatre
  acheteurs en production le 17.09.2026 ; pour une grosse agence, surveiller `max_rows` (1 000, qui
  tronque en silence) et la longueur de l'URL (un `.in()` de plusieurs centaines d'uuid dépasse la
  limite des en-têtes) avant la bascule.
