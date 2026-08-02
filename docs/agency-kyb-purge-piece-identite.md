# Purge de la pièce d'identité KYB — trois mécanismes, une question

> **Pour qui :** Gregory (PO), pour choisir. Julien et qui implémentera.
> **Écrit le :** 2 août 2026. **État :** en attente d'une décision, rien n'est codé.
>
> Ce document répond à **Q2** de
> [agency-kyb-piece-identite-metadonnees.md](agency-kyb-piece-identite-metadonnees.md) §4 :
> « la pièce d'identité n'a aucun chemin de suppression ; on la rend purgeable, ou on
> assume ? ». Cette note ne rouvre pas la question, elle la rend **choisissable** : trois
> mécanismes concrets, ce qu'ils coûtent, et l'unique arbitrage dont tout le reste découle.

---

## En une minute

Le dépôt sait déjà faire tout ce qu'il faut. Il a **dix crons de purge** en production, un
motif de rétention par compteur, un motif d'immuabilité à exceptions nommées, et un précédent
d'effacement de fichier Storage qui tourne toutes les nuits. **Rien de tout cela n'est branché
sur la pièce d'identité d'un dirigeant**, qui est pourtant la donnée la plus sensible du
dispositif. La rigueur existe ; elle n'a pas été appliquée au bon objet.

| | |
|---|---|
| La question à trancher | **à partir de quel événement le délai commence** (§4) |
| Les trois réponses possibles | dépôt du fichier · fin de l'examen · fin de la relation (§3) |
| Recommandation | **voie 1** maintenant, voie 2 quand un vrai flux existera |
| Décision transverse, à ne pas oublier | aujourd'hui le dirigeant peut effacer sa pièce **sans laisser de trace** (§5) |
| Fenêtre de tir | **il n'y a aucune vraie pièce en production** : zéro reprise de stock |

---

## 1. Les murs — ce qui contraint les trois voies

Quatre contraintes vérifiées en production. Elles éliminent d'emblée les solutions
« évidentes », et il vaut mieux les connaître avant de choisir.

**On ne peut pas effacer un fichier depuis du SQL.** Le trigger `protect_objects_delete`
(`BEFORE DELETE FOR EACH STATEMENT` sur `storage.objects`) interdit tout `DELETE` SQL. Un cron
ne peut donc pas supprimer un fichier directement : il doit passer par l'API Storage, avec la
clé de service. C'est ce que fait le seul précédent existant.

**Un super-admin ne peut pas effacer cette pièce depuis son navigateur.** Depuis
[#1098](https://github.com/megga/megga-real-estate/pull/1098), il peut la *lire* — la branche
`is_super_admin()` n'a été ajoutée qu'à la policy `SELECT`, délibérément. La purge devra donc
passer par `service_role`, jamais par un clic dans la console.

**Un compteur rangé au mauvais endroit disparaît au moment où il servirait.**
`agency_person_verification_checks` est en cascade depuis `agency_related_persons`, elle-même
en cascade depuis `agencies`. Si l'échéance vit là et que l'événement déclencheur est « la
personne ou l'agence disparaît », **la ligne qui porte le compteur s'évapore en même temps que
lui** — et le fichier, lui, survit. Pire : `removePerson` permet au dirigeant de supprimer la
personne en un clic, sans trigger et sans audit.

**Deux horodatages qui ressemblent à des compteurs n'en sont pas.**
`agencies.identity_submitted_at` et `verified_at` sont **remis à `NULL`** par
`admin_request_agency_correction`. Ils s'effacent au premier aller-retour de correction.

> ⚠ Et le piège déjà écrit dans la note d'arbitrage, qui reste le réflexe le plus dangereux :
> **créer une ligne `documents` pour indexer le fichier le rendrait supprimable par le
> dirigeant** via `delete-account` (filtre `.is('kyc_case_id', null)`), et **sans aucune
> protection de rétention**, les deux triggers des dix ans ne s'armant que si `kyc_case_id`
> est renseigné. Indexer et protéger sont deux gestes distincts, à poser ensemble.

---

## 2. Ce qui existe déjà et se copie

Aucune des trois voies n'exige d'inventer un mécanisme. Tout est là, éprouvé :

| Brique | Ce qu'elle prouve | Réutilisable pour |
|---|---|---|
| `purge-chat-staging-daily` (cron 03:30) | qu'un cron **peut** effacer un fichier Storage : il lit `storage.objects` en SQL, puis appelle l'API par `net.http_delete` avec la clé de service | **l'exécutant**, dans les trois voies |
| `kyc_cases.expires_at` | un compteur armé par un **événement métier**, puis balayé par un cron nocturne qui journalise | la voie 2 |
| `purge_activity_events_retention()` | une RPC `SECURITY DEFINER` à triple garde, qui **se journalise elle-même** et rend le nombre d'effacements | la forme du balayeur |
| `enforce_activity_events_immutability()` | le motif le plus abouti : interdiction par défaut, **exceptions nommées** qui estampillent la ligne avec leur raison | la protection (§5) |
| `get_cron_health()` + page Monitoring | un nouveau cron **apparaît tout seul** dans la console, avec son dernier statut et un bouton « Relancer » | la visibilité, gratuitement |
| `idx_documents_retention_until` | un index partiel sur l'échéance existe déjà | la voie 2 |

---

## 3. Les trois voies

Elles ne diffèrent que sur **une chose** : ce qui déclenche le compte à rebours. Tout le reste
en découle.

### Voie 1 — Depuis le dépôt du fichier

Le délai part de `storage.objects.created_at`. **Aucune ligne en base, aucun compteur à
maintenir** : le cron sélectionne sur bucket, préfixe et âge, exactement comme
`purge-chat-staging-daily`.

- **Coût :** le plus faible des trois. Tous les maillons tournent déjà en production.
- **Ce que ça dit :** « une pièce d'identité ne reste pas plus de N années en ligne, quoi
  qu'il arrive. »
- **Faiblesse honnête :** `created_at` **repart à zéro à chaque remplacement** de la pièce.
  Le compteur mesure l'âge du fichier, pas celui de la relation. C'est grossier, mais robuste
  — et rien ne peut le casser, puisqu'il ne dépend d'aucune ligne supprimable.

### Voie 2 — Depuis la fin de l'examen

Le délai part du verdict humain (`agency_person_verification_checks.checked_at` avec
`result = 'match'`), qui est horodaté à la seconde, posé par une RPC gardée, et inécrasable
depuis le client.

- **Coût :** moyen. Il faut un **porteur d'échéance hors du chemin de cascade** (§1) — donc
  une table à soi, pas une colonne sur la personne.
- **Ce que ça dit :** « une fois la pièce examinée et acceptée, elle a fini de servir ; le
  décompte commence. » C'est sémantiquement le plus juste.
- **Faiblesse honnête :** seul `match` signifie « fini ». Après `partial` ou `mismatch`, la
  pièce est censée être **remplacée**, pas oubliée — le mécanisme doit distinguer les deux.

### Voie 3 — Depuis la fin de la relation d'affaires

C'est ce que les conditions générales annoncent aujourd'hui aux clients.

- **Coût :** le plus élevé, et pour une raison qui n'est pas technique : **cet événement
  n'existe pas.** `agencies.status` ne connaît que `active` et `suspended`, la suspension est
  réversible, aucune RPC ne supprime une agence, et aucune colonne ne date une fin de contrat.
  Il faudrait d'abord **créer la notion de fin de relation**, puis seulement brancher la purge.
- **Ce que ça dit :** ce que le contrat promet déjà.
- **À savoir :** ce n'est pas un mécanisme de purge, c'est un chantier produit qui en
  contient un.

**Recommandation.** La voie 1 maintenant — elle ferme le trou avec des briques éprouvées, et
sa faiblesse (le compteur qui repart au remplacement) est sans conséquence tant que les dépôts
sont rares. La voie 2 quand un vrai flux existera et justifiera le porteur d'échéance. La voie
3 est un objectif, pas une option immédiate.

---

## 4. La question à trancher

Tout le reste se déduit de celle-ci :

> **À partir de quel moment la pièce d'identité d'un dirigeant cesse-t-elle d'être utile, et
> combien de temps la garde-t-on après ce moment ?**

Et il faut savoir, pour y répondre, que **le dépôt se contredit déjà par écrit** :

| Où | Ce qui est promis |
|---|---|
| Registre des traitements, activité n°1 | « anonymisation immédiate » à la clôture du compte |
| Registre des traitements, activité n°5 | dix ans — mais vise nommément les parties d'une **transaction**, pas un dirigeant d'agence |
| Vitrine | les dossiers de conformité « **peuvent** être soumis à » dix ans (formulation non affirmative) |
| Conditions générales | suppression **trente jours** après la fin du contrat |
| Corpus du CRM | « vos documents non-KYC supprimés » avec le compte — ce qui **décrit exactement** cette pièce |

Aucune de ces promesses ne couvre proprement le cas, et deux d'entre elles s'opposent
frontalement. Le registre est par ailleurs un modèle non rempli, jamais relu par un juriste.
**Trancher la durée, c'est aussi choisir laquelle de ces phrases devient vraie** et corriger
les autres.

---

## 5. Deux décisions transverses, indépendantes du choix de voie

### La protection, qui manque autant que la purge

Aujourd'hui, la policy `documents_kyb_identity_delete` **autorise déjà le dirigeant à effacer
sa propre pièce** par l'API Storage. Il n'y a pas de bouton, mais il y a le droit. Et aucun
trigger, aucun journal ne consigne un effacement de fichier : **la disparition d'une pièce est
aujourd'hui indétectable a posteriori.**

Le problème n'est donc pas seulement « rien ne l'efface », c'est aussi « n'importe qui du bon
rôle peut l'effacer sans laisser de trace ». Les deux se décident ensemble. Le motif à copier
existe : `enforce_activity_events_immutability()` interdit par défaut et n'autorise que des
cas **nommés**, chacun estampillant la ligne avec sa raison.

### Le dirigeant n'est informé de rien

Le wizard ne dit nulle part combien de temps sa pièce est conservée : aucune mention de durée,
de conservation ni de suppression dans l'écran de dépôt. Quelle que soit la durée retenue,
elle devrait y figurer.

---

## 6. La fenêtre

**Il n'y a aucune vraie pièce d'identité en production à ce jour.** Le bucket `documents` ne
contient qu'un `.emptyFolderPlaceholder` de 0 octet, et la table `documents` compte zéro
ligne. Autrement dit : **aucun stock à reprendre, aucune migration de données, aucun
rattrapage.** Le mécanisme choisi s'appliquera au premier dépôt réel.

Cette fenêtre se referme au premier vrai client. C'est le seul argument de calendrier de ce
document, et il est solide.

---

## 7. Comment ces éléments ont été établis

Lecture du dépôt et interrogation de la base de **production** `eayczugyrvmtqnnmvjod` le
02.08.2026 : `pg_trigger` sur `storage.objects`, `cron.job`, `pg_get_functiondef` sur les
fonctions de rétention et d'immuabilité, `pg_constraint` pour les cascades, et comptages sur
`documents`, `subscriptions` et `storage.objects`.

Les deux contraintes qui éliminent le plus d'options — l'impossibilité d'un `DELETE` SQL sur
`storage.objects` et l'existence d'un unique précédent d'effacement Storage — ont été
revérifiées directement. Le reste provient d'une instruction en éventail dont les constats
portent leur propre référence ; les points non revérifiés à la main sont ceux qui n'engagent
pas le choix de voie.

Ce document ne cite aucune source juridique : les textes du dépôt se contredisent (§4) et
aucun n'a été relu par un juriste. **La durée est une décision, pas une déduction.**
