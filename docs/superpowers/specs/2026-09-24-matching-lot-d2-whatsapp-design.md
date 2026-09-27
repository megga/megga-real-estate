# Matching · lot D2 — le copilote WhatsApp (conception)

**Date :** 24.09.2026 · **Statut :** validé par Julien le 24.09.2026 · **Étape 4b** de la [feuille de route](../feuille-de-route.md) · Précise le §5.1 de la [conception de la boucle](2026-09-21-matching-boucle-agent-design.md), qui en reste la source.

**Exécuté** à partir du 24.09.2026, vérifié le 27.09.2026. Ce que l'exécution a changé est noté en place (« ⚠ À l'exécution »), avec sa mesure et sa date ; le détail, tâche par tâche, est à la fin du [plan](../plans/2026-09-24-matching-lot-d2-whatsapp.md).

## 1. Les décisions

Le copilote WhatsApp est le côté de la boucle que l'agent a dans la poche : il lui dit le matin ce qui l'attend, et il reçoit ses comptes rendus. Il n'écrit jamais à l'acheteur.

Six décisions de Julien, le 24.09.2026 :

1. **Le modèle Meta approuvé est gardé.** Le matching entre dans le détail (« mon point du jour ») et dans le point envoyé en texte libre ; aucun nouveau modèle, aucun geste chez Meta. Sa phrase ne nomme pas le matching : c'est la limite acceptée.
2. **Le compte du modèle inclut le matching** : le point part aussi un jour où seul le matching a du nouveau.
3. **`get_matches` entre dans D2** — prévu au §5.1 de la conception de la boucle, absent de la ligne 4b : il écarte les biens refusés et écartés, dit l'état de chaque bien et explique son score.
4. **`record_match_outcome` demande Oui / Non avant d'écrire.** ⚠ Écart assumé au §5.1, qui le voulait « annulable dans le message suivant » : une réponse déclenche une chaîne qu'une annulation ne remet pas en l'état — une ligne de journal qui ne s'efface pas, la clôture de la relance, un deal et une relance pour « Proposé » —, et le bien est retrouvé d'après un texte.
5. **« Pas encore » est une réponse de `record_match_outcome`** : la troisième de la feuille « Retours » (§4.4 de la conception de la boucle), absente de la liste du §5.1.
6. **La base porte les règles** (§4).

## 2. Ce qu'on a mesuré

En production le 24.09.2026 (lecture seule), et dans le code :

| Sujet | Ce qui existe | Ce qui cloche |
|---|---|---|
| **Le point du matin** | Allumé le 15.09.2026 (`whatsapp_morning_brief_enabled = true`) : 10 points envoyés du 15 au 24.09, dont 8 par le modèle (fenêtre de 24 h fermée). Un seul numéro relié : celui de « MEGGA Agence » | Aucun matching. La carte système le dit encore « éteint » |
| **Le modèle `megga_agent_daily_brief`** | « Bonjour {{1}}, votre point du jour MEGGA compte {{2}} élément(s) à traiter : visites, relances, offres à échéance et nouveaux leads. Répondez « mon point du jour » pour recevoir le détail ici. » Soumis en utility, classé MARKETING par Meta (0,0592 $ le message, contre 0,0171 $), sans bouton | Ne nomme pas le matching (décision 1) |
| **`get_daily_brief`** | Recalcule le point quand l'agent répond ; partagé avec le copilote web | Aucun matching. Une relance de proposition s'y lit « Retour sur un bien proposé », sans le nombre de biens en attente |
| **`get_matches`** | Les cinq meilleurs scores d'un contact | ⛔ Aucun filtre de statut : un bien refusé revient tant que son score le garde en tête. Ni état, ni explication |
| **`schedule_visit`** | Une visite interne sur un mandat, « /annuler » pendant 30 s | ⛔ `reminder_sent` reste faux : `visit-reminders-j1` écrit au client la veille, alors que l'outil promet de ne « RIEN » lui envoyer. Ne touche ni le match ni le deal. Refuse une annonce du marché, alors que 1 818 matchs sur 1 828 en sont |
| **Consigner, chercher des acheteurs** | — | Aucun outil. Une écriture directe depuis la fonction WhatsApp serait journalisée `system`, pas MEGGA AI : les déclencheurs lisent `app.actor_kind`, qu'une requête PostgREST ne peut pas poser |
| **Les fonctions de D1** | `matching_actions_du_jour`, `pige_acheteurs_compatibles` | Elles dérivent l'agence de `get_user_agency_id()` : sous le rôle de service, elles ne rendent rien |
| **Les matchs** | 1 828, tous `suggested` : 1 818 sur des annonces du marché, 10 sur des mandats | La boucle n'a jamais tourné en production : les lots B à D1 sont sur branche |

## 3. Principes

1. **Rien ne part vers l'acheteur.** Les outils du matching consignent et lisent ; aucun n'écrit au client. `matching-sans-sortie.spec.ts` couvre les fichiers neufs.
2. **MEGGA AI signe ce qu'il écrit.** Toute écriture du copilote passe par une fonction de base qui pose `app.actor_kind = 'ai'` : le journal dit qui a écrit (CLAUDE.md §5).
3. **Un geste s'écrit d'un bloc**, ou pas du tout.
4. **Une règle, une source.** « Compatible », les seuils des signaux, l'explication du score et les gestes de la boucle existent déjà : WhatsApp les relit. Une copie inévitable entre `src/` et `supabase/functions/` est confrontée à l'original par une spec.
5. **Le copilote ne devine pas.** Un bien désigné par un texte qui répond à plusieurs candidats, ou à aucun : il les liste et demande, il n'écrit rien.
6. **Le point du matin reste sans modèle de langue** : des gabarits figés, des données déterministes.

## 4. L'architecture

### 4.1 Les écritures : trois fonctions de base, et une redéfinition

Toutes trois `security definer`, `search_path` fixé, exécutables par le seul `service_role` (révoquées de `public`, `anon` et `authenticated`). Elles posent `app.actor_kind = 'ai'`, `app.actor_via = 'whatsapp'` et `app.actor_profile_id` pour la transaction, comme `wa_move_transaction_stage` : les déclencheurs existants — `set_match_response_at`, `log_match_reaction` et son motif, `fermer_relance_proposition`, `set_match_prix_propose`, le journal des étapes du deal, et `calendar_events_journaliser` (redéfinie, ci-dessous) — attribuent alors l'écriture à MEGGA AI ; les lignes de journal qu'elles écrivent elles-mêmes (`match_propose`, `match_pas_encore`, `visit_scheduled`) portent `actor_kind = 'ai'`, sans `actor_id`. Chacune vérifie que le match et le contact appartiennent à l'agence passée, et rend ce qu'elle a fait ; `wa_matching_consigner` rend `deja` quand rien n'a été écrit.

| Fonction | Ce qu'elle écrit |
|---|---|
| `wa_matching_consigner(p_agency, p_profile, p_match, p_reponse, p_motif, p_note)` | Les quatre réponses, aux règles des gestes du fil (`execProposer`, `execRepondre`, `execPasEncore`) — §5.3 |
| `wa_matching_visite(p_agency, p_profile, p_contact, p_property, p_market_listing, p_debut, p_duree, p_type)` et `wa_matching_visite_annuler(p_agency, p_profile, p_retour)` | La visite de `schedule_visit`, avec ou sans match : la ligne `visits` (mandat) ou l'événement d'agenda (annonce), puis, si l'acheteur est « intéressé », le match, le deal et son étape, à la règle d'`execPlanifierVisite` — §5.4 |

⚠ **À l'exécution**, les relectures y ont ajouté quatre choses :

- **`calendar_events_journaliser` est REDÉFINIE.** Sur une annonce, la visite du copilote n'écrit qu'un événement d'agenda, dont le journal (`20260915080300`) ne lisait que `auth.uid()`, nul sous le rôle de service : l'écriture partait `system`, jamais MEGGA AI. C'est le chemin majoritaire — 1 818 des 1 828 matchs de la production visaient une annonce le 24.09.2026. Sa détermination de l'acteur reprend celle de `log_match_reaction` (les trois réglages de transaction d'abord) ; le reste de son corps est celui du 15.09, et rien ne change pour le CRM, qui ne pose jamais ces réglages. Elle ne pose rien : elle LIT ce que `wa_matching_visite` a posé dans la même transaction.
- **Le mandat d'un match et le profil de l'agent sont ancrés sur l'agence**, avant toute écriture (`ok: false` ; `raison: 'profil'` pour la visite) : la politique d'insertion de `matches` ne vérifie que `agency_id`, un match peut donc viser le mandat d'une autre agence. `deja` rend aussi le statut trouvé.
- **Un verrou CONSULTATIF par acheteur** (`wa_matching_acheteur:<contact>`), pris par `wa_matching_consigner` et par `wa_matching_visite` après le verrou du match et avant le deal : deux appels simultanés pour un même acheteur ne créent plus chacun leur deal. Un `for update` sur le contact ouvrait deux cycles d'interblocage — avec les clés étrangères d'une relance posée par le fil, et avec le déclencheur d'étape du deal, qui met le contact à jour —, établis à la lecture des déclencheurs, non reproduits sur une base. Le fil ne prend pas ce verrou : la course à deux deals reste ouverte entre le fil et WhatsApp.
- **Deux lectures neuves désignent un bien EN BASE** (§5.2, §5.3) : `wa_matching_biens_designes` et `wa_matching_biens_de_l_acheteur`, `security invoker`, réservées au seul `service_role`. Avec `matching_actions_agence` (§4.2) et les trois fonctions d'écriture, la migration porte **six noms neufs**, plus deux redéfinitions : `matching_actions_du_jour` et `calendar_events_journaliser`.

### 4.2 La lecture du point du matin

`matching_actions_du_jour` (D1) devient une enveloppe : son corps passe dans `matching_actions_agence(p_agency uuid, p_limite int)`, `security invoker`, et elle rend `matching_actions_agence(get_user_agency_id(), p_limite)` — même signature, même type de retour, donc sans le piège du date-guard. **Une seule définition des quatre sortes d'actions** pour « Aujourd'hui », le point du matin et son détail.

Les deux copilotes lisent par le rôle de service, filtrés par l'agence de l'agent, comme leurs autres outils (`auth.supabase` pour le copilote web). Un utilisateur qui appellerait `matching_actions_agence` avec une autre agence ne lirait rien : la RLS de `matches`, `reminders` et `properties` le borne à la sienne.

### 4.3 Le code

| Où | Quoi |
|---|---|
| `supabase/functions/_shared/whatsapp-matching.ts` (neuf) | Le modèle PUR des quatre outils : retrouver un bien d'après un texte, rendre l'état et l'explication d'un match, le signal, les réponses. Testé sous Vitest. Un module à part plutôt qu'allonger `whatsapp-actions.ts` (3 656 lignes) |
| `supabase/functions/_shared/whatsapp-matching-outils.ts` (neuf) | Les exécuteurs : les lectures, la préparation de la question Oui / Non, les appels aux fonctions de base. Testé sous Vitest avec un faux client |
| `_shared/whatsapp-tools.ts`, `_shared/whatsapp-agent-router.ts` | Les deux outils neufs et leur niveau (lecture ; Oui / Non) ; les descriptions de `get_matches` et de `schedule_visit` |
| `whatsapp-agent`, `whatsapp-webhook` | Les branchements : lecture, préparation de la question Oui / Non, écriture sur « Oui », annulation de la visite |
| `_shared/morning-brief-data.ts`, `_shared/morning-brief.ts`, `whatsapp-morning-brief` | La sixième source, la section « Matching », le compte |
| `_shared/whatsapp-i18n.ts` | Les phrases, en français et en anglais (les deux langues du copilote) |
| `supabase/migrations/…200000_matching_whatsapp.sql` | `matching_actions_agence` et l'enveloppe ; les trois fonctions d'écriture ; `calendar_events_journaliser` redéfinie ; les deux lectures qui désignent un bien (§4.1, « À l'exécution ») |

⚠ **La migration garde un suffixe POSTÉRIEUR à celui de D1** (`…190000_matching_surfaces`) : au redatage du jour de la fusion, chaque lot garde son suffixe, et celle-ci réécrit une fonction de D1.

La branche est `megga/matching-lot-d2`, partie de `megga/matching-lot-d1`.

## 5. Les outils

### 5.1 `get_matches` — « quels biens pour Julie ? » (lecture)

- **Les biens vivants de Julie** : ni refusés, ni écartés, ni reportés tant que leur report court. D'abord ceux en cours — intéressé, visite planifiée, proposé (avec sa date) —, puis les meilleurs à proposer, signal d'abord à score égal, comme le fil. **Huit au plus**, avec le total par état.
- **Pour chaque bien** : titre, ville, prix ; l'état ; le score, présenté comme une estimation ; l'explication — les critères tenus, les écarts, les non évalués ; le signal — nouveau, prix baissé de X, nouveau mandat, ou « revenu » avec le prix auquel il avait été refusé. L'identifiant du bien reste dans la réponse : les autres outils s'en servent.
- **L'explication vient des mêmes sources que le fil** : `matches.reasons`, écrit par le moteur, et, pour chambres, état et off-market, `axesComplementaires` (`_shared/matching-normalize.ts`), la règle du moteur. Une spec confronte le verdict WhatsApp à `lignesCriteres` du fil sur les mêmes fixtures.
- Le copilote web partage l'outil : il gagne la même réponse.
- ⚠ **À l'exécution** : « à proposer » ne garde qu'un mandat `active`, la règle du point du matin (`matching_actions_agence` : un mandat vendu, retiré ou supprimé n'est plus une occasion) — appliquée à cet outil, et à faire confirmer par Julien (décision 12 du lot D1, en attente) ; le fil garde tous les mandats. Un bien qui n'est plus une occasion reste « en cours » s'il l'est déjà, et le dit (`occasion: false`, le statut du mandat). Chaque lecture est bornée et lue à sa limite plus une ligne : un total coupé s'écrit « N+ », jamais comme un compte exact.

### 5.2 `get_buyers_for_property` — « qui pour la villa de Cologny ? » (lecture)

- **Le bien** se désigne par un texte ou par son identifiant. Un identifiant : le mandat de l'agence, sinon l'annonce. Un texte se cherche **EN BASE, sur l'agence entière** (`wa_matching_biens_designes`), parmi les mandats de l'agence (titre, adresse, ville — `properties` n'a pas de colonne de référence) ET les annonces du marché qui y ont un match compatible, **ensemble** : un mandat ne masque jamais seul une annonce qui répond aussi. Plusieurs candidats : l'outil en rend cinq au plus, avec leur total, sans choisir ; le copilote demande lequel.
  ⚠ **À l'exécution** : le plan lisait 500 mandats puis, à défaut, 1 000 matchs compatibles, pour chercher le texte en TypeScript — un ÉCHANTILLON, puisque PostgREST plafonne à 1 000 lignes et que l'agence WhatsApp portait 1 828 matchs le 24.09.2026 ; et « le mandat d'abord » choisissait à la place de l'agent. La base rend un sur-ensemble (chaque mot contenu dans le titre, l'adresse ou la ville, sans accent), que `candidats` affine aux règles du §5.3. Lue à 50 lignes plus une, **une lecture coupée ne rend jamais un bien seul** : la base les rend dans l'ordre des identifiants, sans rapport avec le texte, et celui qui survit seul à l'affinage n'est pas forcément le seul à répondre ; le copilote demande l'adresse ou l'identifiant. Un mot courant y mène : sur les 1 806 biens désignables de l'agence WhatsApp, « appartement » en désignait 820, « genève » 565, « villa » 154 (25.09.2026).
- **Il rend les acquéreurs compatibles**, à la définition des fiches (`STATUTS_COMPATIBLES` : à proposer, proposé, intéressé, visite planifiée ; les refus exclus) et avec leurs états — « reporté jusqu'au … », « revenu » compris. Par score, dix au plus, avec le total. Une annonce retirée le dit.
  ⚠ **À l'exécution** : les fiches de TOUS les compatibles lus (200 au plus) sont relues, et une ligne sans fiche est écartée avant de compter, comme le hook des fiches (`useQuiPourCeBien`) ; un total coupé s'écrit « N+ ». La fiche d'un mandat retire encore les acheteurs déjà en deal sur ce bien, que l'outil garde : son total peut dépasser ce qu'elle affiche (en attente).
- **Les anciens prospects ne passent pas par WhatsApp** : ils se réactivent d'un geste dans le CRM. Pour un mandat actif, la réponse rappelle qu'ils sont sur sa fiche.

### 5.3 `record_match_outcome` — « Julie refuse Florissant, trop cher » (Oui / Non)

**Les arguments** : l'acheteur, le bien (un texte ou un identifiant), la réponse — `propose`, `interesse`, `pas_interesse`, `pas_encore`. Pour `pas_interesse`, un motif obligatoire parmi ceux du fil (prix, quartier, surface, pièces, type, équipements, état, autre) et une note facultative.

**Le bien se cherche parmi les matchs de l'acheteur, au statut que la réponse suppose** :

| Réponse | Statut cherché | Ce qui s'écrit, d'un bloc, sur « Oui » |
|---|---|---|
| Proposé | `suggested` | Le match passe `sent` (`sent_via = 'agent'`) ; le deal : l'actif, sinon un `new_lead` sur ce bien ; UNE relance à +3 jours (canal `task`) ; `match_propose` au journal |
| Intéressé | `sent` | `interested` ; les déclencheurs datent la réponse, la journalisent, et closent la relance quand plus aucun bien n'attend |
| Pas intéressé | `sent` ou `interested` | `rejected`, le motif, la note ; même chaîne |
| Pas encore | `sent` | Rien sur le match ; la relance qui couvre le bien est repoussée de 3 jours, ou posée ; `match_pas_encore` au journal |

⚠ **À l'exécution, la désignation prend TROIS chemins** (25.09.2026). Le plan cherchait le texte dans les 100 premiers matchs de l'acheteur, par score ; mesuré en production ce jour-là (lecture seule), 3 acheteurs de l'agence WhatsApp en ont plus de 100 `suggested`, jusqu'à 1 142 — « proposé » ratait le bien nommé. Et la désignation sur l'agence entière (§5.2) aurait répondu « trop large » dès le premier mot courant.

1. **Un identifiant** : revérifié exactement parmi les matchs de l'acheteur au statut de départ.
2. **Des mots** : désignés EN BASE parmi les SEULS biens de l'acheteur à ce statut, avec le match de chacun (`wa_matching_biens_de_l_acheteur`), puis affinés par `candidats`.
3. **Aucun mot utile** (« le bien », rien) : la page de ses matchs, où un seul bien se désigne de lui-même (« Julie est intéressée » quand un seul l'attend) ; une page coupée n'en désigne aucun.

**Les règles de `candidats`**, fixées sur mesure :

- **Un ÉCHO se compare au LIBELLÉ entier.** Un texte qui porte le « · » d'un libellé (« titre · adresse », sinon « titre · ville ») désigne le bien dont c'est exactement le libellé, et ceux qui portent le même : c'est ce que le copilote nomme, et ce que le modèle lui redonne au tour suivant. Jamais sans « · » : « studio rue du Lac 2 » se plie comme le libellé « Studio · Rue du Lac 2 », mais ses mots désignent aussi « Studio lumineux · Rue du Lac 2 » ; jamais le titre nu non plus, qu'un titre générique (« Studio ») ferait choisir. ⚠ Le « · » est un indice, pas une preuve : 98 annonces du marché le portent dans leur titre (31 en ligne), aucune suivie par un match, aucun mandat (25.09.2026) ; l'égalité ne joue pas quand le texte est aussi le titre d'un bien qu'elle écarterait. Risque accepté : le modèle peut écrire à la manière du copilote un libellé qu'il n'a jamais lu.
- **Sinon, TOUS les mots**, entiers ou en début de mot à partir de quatre lettres, et **un nombre toujours entier, où qu'il soit** : « 4 » ne désigne ni le n° 40 ni un « 4.5 pièces » ; « 4½ », « 4,5 » et « 4.5 » sont une même taille. ⛔ Un nombre ne se comparait d'abord qu'à l'adresse : or 1 184 des 1 806 biens désignables de l'agence WhatsApp portent un chiffre dans leur titre, et 22 seulement se retrouvaient par leur propre titre (25.09.2026). Un palier « le nombre dans l'adresse d'abord » a été essayé, puis abandonné : il détournait l'écho nu d'un titre (« Attique 4 p. ») vers un leurre (« Attique 3 p. · Rue du Stand 4 ») rendu SEUL.
- **Une lecture coupée ne rend jamais un bien seul, ni « aucun »** : au-delà de ce qu'elle a rendu, un autre bien de l'acheteur répondait peut-être. Un texte ordinaire fait demander l'adresse ou l'identifiant ; un écho, relu jusqu'à 200 biens, renvoie au CRM s'il reste coupé — « donne l'adresse » n'y aurait pas de réponse : 252 des 1 800 annonces que suit l'agence WhatsApp n'ont pas d'adresse, et 410 (23 %) partagent leur libellé avec une autre (25.09.2026).

- **Aucun candidat, ou plusieurs** : aucune question Oui / Non. L'outil rend les candidats (ou les biens qui attendent une réponse), et le copilote demande.
  ⚠ **À l'exécution** : le refus est une PHRASE pour l'agent, qui nomme cinq biens au plus par leur libellé (« 5 sur N » ; « n sur plus de P » quand la page est coupée), **sans identifiant** : `whatsapp-agent` rend un refus au modèle une fois, puis TEL QUEL à l'agent au second refus du même échange — des identifiants partiraient dans WhatsApp. C'est le libellé que le modèle redonne ensuite, et que l'égalité ci-dessus retrouve.
- **Un seul** : le copilote dit ce qu'il va écrire — « Je consigne pour Julie Martin : « Attique 4 p. · Florissant » — pas intéressée, motif prix. Tu confirmes ? » — et pose [Oui] [Non]. L'action attend 15 minutes, comme les autres.
  ⚠ **À l'exécution** : « Je consigne que … », et non « Je note que … » (le plan), pour « proposé » et « pas encore » : sans mot d'action, une imitation de la question par le modèle, privée de son suffixe « (« oui » / « non ») », passait la garde des confirmations simulées (§8).
- **Sur « Oui »**, `wa_matching_consigner` écrit, avec le même statut de départ en garde : si un collègue a consigné entre-temps, rien n'est réécrit et le copilote le dit.
  ⚠ **À l'exécution, trois comptes rendus quand rien n'est écrit** : « déjà consignée » quand le match porte ce que la réponse écrit ; « … a changé entre-temps » quand il a bougé ailleurs (pour « pas encore », qui n'écrit aucun statut, tout mouvement) — « déjà consignée » y serait faux ; et « Non confirmée — vérifie la fiche » sur une panne de transport, sans code Postgres : la base a pu écrire avant que la réponse ne se perde, « rien n'a été écrit » serait parfois faux.
- ⚠ **À l'exécution : une annonce retirée ne se « propose » pas.** La consigner créerait un deal et une relance sur un bien parti, et le fil n'en offre aucune à proposer ; le refus la nomme, rien n'est écrit. Un mandat garde sa place quel que soit son statut, comme dans le fil (décision 12 du lot D1).
- **Rien ne part vers l'acheteur**, et le copilote ne prétend jamais l'avoir prévenu.

### 5.4 `schedule_visit` — « organise une visite de l'attique avec Julie mardi 14h » (automatique, « /annuler » pendant 30 s)

- **Un mandat ou une annonce du marché.** Comme dans le fil : un mandat reçoit une ligne `visits` ; une annonce, que l'agence ne détient pas, un événement `visite` de l'agenda (`calendar_events`).
- **Si l'acheteur est « intéressé » par ce bien** : le match passe `visit_planned`, le deal est rattaché (l'actif, sinon un `new_lead`) et avance à `visit_planned` s'il était avant, jamais en arrière — la règle de « Planifier une visite ». La visite d'un mandat porte le deal (`visits.transaction_id`) ; l'événement d'agenda d'une annonce n'a pas de colonne pour lui, comme dans le fil.
- **S'il n'est que « proposé »** : la visite est posée sans toucher au match, et le copilote demande si l'acheteur est intéressé (`record_match_outcome`). Sans match : une visite, comme aujourd'hui.
- ⛔ **`reminder_sent` est posé à vrai à la création, pour toute visite du copilote** : l'outil promet de ne rien envoyer au client, et `visit-reminders-j1` lui écrivait la veille. Même règle que le fil.
- ⚠ **À l'exécution — l'étape d'un deal avance sans « oui ».** `schedule_visit` est automatique (« /annuler » 30 s) et fait avancer à `visit_planned` le deal d'un acheteur intéressé, jamais en arrière, quand `update_pipeline` demande une confirmation au nom du garde-fou « jamais sans action humaine ». Exception décidée par Julien le 24.09.2026, écrite dans le routeur (`whatsapp-agent-router.ts`).
- ⚠ **À l'exécution — l'heure.** Lue par `new Date(…)` dans une Edge Function qui tourne en UTC, « 14:00 » sans décalage planifiait à 16:00 l'été, sur un outil qui écrit sans relecture. Désormais : sans décalage, l'heure de Genève ; un décalage `+01:00` ou `+02:00` se lit comme la même heure murale de Genève, recalculée pour la saison de la date (le modèle vise Genève sans savoir si l'heure d'été y est en vigueur ce jour-là) ; tout autre décalage, tel quel. Refusées : une date passée de plus d'une heure, une date qui n'existe pas (le 31 septembre), une heure sautée au passage à l'heure d'été.
- ⚠ **À l'exécution — une annonce retirée, un mandat vendu, une visio sur une annonce** : l'outil étant automatique, rien n'est refusé, tout est SIGNALÉ — « ce bien n'est plus disponible (retiré) » ; « rendez-vous inscrit à l'agenda, sans visio », un événement d'agenda n'ayant pas de champ de visio.
- **« /annuler » défait tout** : la visite ou l'événement ; le match revient à « intéressé » ; le deal revient à son étape d'avant s'il avait avancé. Le journal garde la trace des deux mouvements.
  ⚠ **À l'exécution** : chaque retour n'a lieu que si rien n'a bougé depuis (le match encore `visit_planned`, le deal encore à cette étape). **Un deal CRÉÉ par la visite n'est pas supprimé** : il revient à `new_lead`, comme dans le fil. Annuler la visite d'un mandat ne laisse rien sur la fiche du contact : l'audit de l'annulation porte l'entité `visit` (en attente).

## 6. Le point du matin

- **Une sixième source** : `matching_actions_agence` (les quatre sortes de D1, classées, avec leur total exact) et les intéressés qui attendent une visite. Ce sont les actions de l'AGENCE, comme ses relances aujourd'hui ; les visites restent celles de l'agent.
  ⚠ Chaque agent y lit donc les retours et les intéressés des acheteurs de ses collègues — à dire à Julien avant la fusion ; le « par agent » est en attente (§10).
- **Le point en texte libre** (fenêtre ouverte) gagne une section **« Matching (N) »** : cinq lignes au plus, aux phrases du segment d'« Aujourd'hui » — « Retour à consigner pour Julie · 2 biens », « Prix baissé de CHF 900'000 sur le bien proposé à Antoine · Attique Florissant », « Nouveau mandat · 4 acquéreurs compatibles · Villa Cologny », « Nouveau bien à Carouge pour Anastasia » —, puis « …et N autres », puis « 2 acheteurs intéressés attendent une visite : Léa Blanc, Marc Roux ». N se lit sur le total : il est exact.
  ⚠ **À l'exécution** : « …et N autres actions », jamais « autres » seul — la ligne qui suit compte des acheteurs. Un loyer porte « / mois » (« / month »), comme le montant d'« Aujourd'hui » (clé `fil.valeurs.parMois`) : la colonne `location` de la base n'était pas lue, et une baisse de loyer s'écrivait comme un prix de vente. Les phrases sont confrontées à celles de l'écran (`ecrire`, `matchingDuJour.ts`), pluriel anglais compris (« 0 properties »).
- **Une relance de proposition n'est comptée qu'une fois** : quand la section porte le retour d'un acheteur, sa relance quitte « À relancer ». Les autres relances y restent, celles de proposition dues plus tard dans la journée comprises.
  ⚠ **À l'exécution — la déduplication se fait DANS la requête des relances**, par la définition du retour de `matching_actions_agence` : une relance `follow_up_sent_property` échue, avec un acheteur et au moins un match couvert (par `match_ids` ou `match_id`), quitte « À relancer » avant la limite de lecture. Dédupliquer après coup, à partir des actions lues, avait deux défauts : une FAMINE (les vingt relances lues toutes des retours, « À relancer » restait vide sans qu'aucune vraie relance au-delà n'ait été lue) et un DOUBLE COMPTE (le retour d'un acheteur au-delà du rang des actions lues restait dans « À relancer »). Conséquence : une relance « orpheline » — ouverte, mais dont plus aucun match n'attend — sort elle aussi de « À relancer », sans que la section la porte. Mesuré le 25.09.2026 : aucune en production, où `reminders.match_ids` n'existe pas encore (le lot B n'y est pas appliqué) ; à remesurer une fois la pile appliquée. Une relance sans acheteur reste lue, sans nom.
- **Le compte du modèle** (`briefItemCount`, le `{{2}}`) ajoute les actions de matching et les intéressés : le modèle part dès qu'il y a quelque chose, matching seul compris. Son texte ne change pas.
- **Le détail** (`get_daily_brief`, `composeBriefDetail`) gagne la même section, sans plafond d'affichage, et son total reste celui du modèle.
  ⚠ **À l'exécution** : le `total` de sa section Matching compte comme l'en-tête du point poussé — les actions ET les intéressés, « + » compris quand la lecture des intéressés est coupée ; un jour d'intéressés sans action, il disait « 0 » sous un en-tête qui en annonçait un. `actions_total` ne compte que les actions.

## 7. Ce qui ne change pas

- Le texte du modèle, sa catégorie, les heures d'envoi, l'interrupteur global et celui de chaque agent.
- Le copilote hors matching, et le niveau de ses autres outils.
- Les gestes du CRM : ils restent écrits dans `useAtelierMatching`. Les fonctions de base de D2 en reprennent les règles ; elles ne les remplacent pas.
- Le moteur de matching, ses notes et ses modes.

## 8. Garde-fous

| Spec | Ce qu'elle refuse |
|---|---|
| `matching-sans-sortie.spec.ts` (étendue) | Un envoi au client depuis le module WhatsApp du matching ou depuis les parties matching du point du matin ; une visite du copilote sans `reminder_sent` à vrai. ⚠ **À l'exécution** : le périmètre compte les deux modules du copilote et quatre blocs du point du matin (`ligneMatching`, `ligneInteresses`, le bloc Matching de `composeMorningBrief`, l'objet `matching` de `composeBriefDetail`) ; elle refuse `sendOutboundGuarded`, `buildTemplateMessage` et `sendRelanceEmail`, un import des deux modules hors d'une liste NOMMÉE (une liste d'interdits ne connaît que les envois d'hier), un `fetch(`, un `import(`, un `functions.invoke` ou un `urlFonction`, un `insert` ou un `upsert` dans `visits` depuis les deux modules et `whatsapp-actions.ts` ; elle lit la valeur À LA PLACE de `reminder_sent` dans l'`insert`, et exige qu'il n'y paraisse qu'une fois. Elle ne lit pas les branches du webhook (en attente) |
| `whatsapp-matching.test.ts`, `whatsapp-matching-outils.test.ts` (unitaires, neufs) | Un bien choisi parmi plusieurs candidats ; un refusé, un écarté ou un reporté rendu par `get_matches` ; un contact d'une autre agence. ⚠ **À l'exécution** : aussi un bien rendu SEUL par une lecture coupée, une date passée ou impossible, une heure sans décalage lue en UTC (horloge figée : écrits à date fixe, ces tests rougissaient dès le 29.09.2026) ; le faux client projette le `select` et trie comme PostgreSQL |
| `whatsapp-matching-fil.spec.ts` (neuf) | Une copie qui dérive du fil : les statuts compatibles, les motifs, les seuils des signaux, l'état d'un acheteur, l'explication (`lignesCriteres`), le signal. ⚠ **À l'exécution** : aussi l'ordre « à proposer » (`construireFil`), l'ordre des acheteurs (`trierCompatibles`), et le point du matin confronté à « Aujourd'hui » (`lireMatching` à `versAction`, `ligneMatching` à `ecrire`) |
| `matching-whatsapp-sql.spec.ts` (neuf, statique) | Un corps de `matching_actions_agence` qui s'écarterait de celui de D1 ; une fonction d'écriture qui ne signe pas MEGGA AI ou s'ouvre à `authenticated` ; un ordre des verrous différent entre les deux fonctions ; une `calendar_events_journaliser` (y compris la dernière redéfinition à venir) qui ne lirait plus `app.actor_kind` ; un nombre dans la désignation SQL comparé autrement qu'un mot ; un plafond du §6 de la migration autre que `LIMITE_ECHO + 1` |
| `morning-brief.test.ts` (étendue) | Une relance de proposition comptée deux fois ; un compte du modèle qui oublie le matching ; un point vide les jours de matching seul ; un « …et N autres » faux. ⚠ **À l'exécution** : la déduplication vit dans la requête, donc `morning-brief-data.test.ts` aussi, dont le faux client évalue le `.or(…)` des relances et fige sa chaîne — sans prouver que PostgREST l'accepte (W6) |
| `whatsapp-agent-router.test.ts`, `whatsapp-confirm-tools.spec.ts` | `record_match_outcome` hors des outils à confirmer, ou sans ses branchements de préparation et d'écriture |
| La garde des confirmations simulées (`whatsapp-phantom-action.test.ts`) | Le copilote qui dirait « consigné » sans avoir écrit. ⚠ **À l'exécution** : un « ✅ Consigné » recopié se reconnaît à la FORME exacte des quatre comptes rendus (un préfixe prenait aussi un relais d'`add_note`) ; « je consigne », « I'll record her answer », une question imitée ; jamais une offre, une question, ni le nom « consigne » (une instruction). Garde heuristique : ses bords connus sont en attente |
| `copilot-tools.test.ts` (étendue) | La description web de `get_matches` qui renverrait à des outils absents du copilote web : elle est DÉRIVÉE de celle de WhatsApp, sans exception au chargement, qui ferait tomber tout le copilote web |
| `matching-whatsapp.spec.ts` (backend) | Une réponse écrite depuis le mauvais statut ; un « déjà consigné » réécrit ; une écriture journalisée `system` au lieu de `ai` ; un match d'une autre agence ; une visite avec rappel au client ; un deal qui recule ; une annonce sans son événement d'agenda ; `matching_actions_agence` qui rendrait autre chose que `matching_actions_du_jour`. ⚠ **À l'exécution** : aussi les deux désignations (W4, W5 : sans accent, majuscule accentuée, ligature, nombre du titre, « 4½ », absents, plafond de 201), et `loadAgencyData` contre une vraie base (W6), seule preuve que le filtre `.or(…)` des relances est valide — une faute y rendrait une erreur 400, donc plus AUCUN point du matin |
| `whatsapp-matches-enrich.spec.ts`, `whatsapp-antifab.spec.ts` (backend, réparées) | ⚠ **À l'exécution** : deux défauts du plan, rouges en CI à la fusion — l'une importait l'ancien `execGetMatches`, l'autre figeait `required` avec `property_id` alors que l'outil accepte une annonce |

⚠ Les specs de la base ne tournent pas sur cette machine (le port 54321 est occupé) : la CI les joue, et `npm run test:backend` se joue sur une base locale avant d'appliquer la migration. ⚠ **Au 27.09.2026, aucune ne l'a été** — ni W1 à W6, ni les deux réparées ; `backend.yml` ne tourne que sur une PR ou un push vers `main`. Sur la même base locale, un EXPLAIN des deux désignations (§5 et §6 de la migration) doit confirmer l'usage des index partiels de `matches`, attendu et non vérifié.

## 9. La mise en production

- **La fusion se fait à la fin**, avec toute la pile, après le lot E. La migration s'applique à la main avant la fusion, après celle de D1, sur accord de Julien.
  ⚠ **À l'exécution** : avant de l'appliquer, les points « Avant la fusion » de la section « En attente » du [plan](../plans/2026-09-24-matching-lot-d2-whatsapp.md) — les specs de la base jouées sur une base locale, l'EXPLAIN des deux désignations, la garde du profil remesurée, et, la pile appliquée, les relances orphelines.
- **Les fonctions WhatsApp partent à la fusion** : dès ce jour-là, le point du matin de « MEGGA Agence » parle du matching, et les outils répondent.
- **Aucun geste chez Meta, aucun secret neuf.** Le modèle partira plus souvent — le marché bouge presque chaque jour : 0,06 $ au plus, par jour et par agent, quand la fenêtre est fermée.

## 10. En attente (hors périmètre — rien n'est fait sans accord de Julien)

- Les anciens prospects par WhatsApp.
- Les actions de matching par agent plutôt que par agence (dans « Aujourd'hui » comme au point du matin).
- Les intéressés qui attendent une visite dans « Aujourd'hui ».
- Les relances « acheteur chaud » d'`automation-engine` (`follow_up_sent_property` sans match), libellées à tort « Retour sur un bien proposé ».
- `prepare_meeting` lit encore les cinq meilleurs matchs sans filtre de statut : un refusé peut y revenir (relevé en écrivant le plan).
- `execCreateDeal` journalise `kyc_case_opened` en ouvrant un deal.
- L'interrupteur du point du matin par agent (`set_morning_brief_enabled`) n'a pas d'écran.
- Le corps anglais du modèle écrit « my daily brief » quand son commentaire dit la commande française dans toutes les langues.
- Un nouveau modèle Meta qui nommerait le matching (décision 1) : à reconsidérer une fois le point enrichi en service.
- ⚠ **Relevé à l'exécution** (désigner un bien par sa référence du CRM, les bords de la garde des confirmations simulées, l'heure des autres outils datés, les jointures de `matching_actions_agence` sous le rôle de service…) : section « En attente » du [plan](../plans/2026-09-24-matching-lot-d2-whatsapp.md).
