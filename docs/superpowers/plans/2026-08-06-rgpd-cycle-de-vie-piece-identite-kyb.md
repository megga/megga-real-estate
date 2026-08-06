# RGPD : donner un cycle de vie à la pièce d'identité KYB

> Fait suite à l'audit RGPD/PII de l'onboarding du 06.08.2026. Ce plan traite le constat F1
> (l'image de pièce d'identité n'a ni propriétaire, ni rétention, ni purge) et le constat F2
> (accès et effacement portent des périmètres disjoints). Les constats F3 (registre) et F5
> (README périmé) sont traités ailleurs ; F4 (jeton d'appel sans échéance) entre ici en
> tâche 7 parce qu'il partage la même migration de bord.

## Le fait qui commande ce chantier

Le dépôt l'a écrit lui-même, le 02.08.2026, dans `20260802200000_kyb_identity_super_admin_select.sql` :

> Elle ne donne AUCUN cycle de vie au fichier. Celui-ci n'a toujours ni ligne en base, ni
> propriétaire, ni rétention, ni chemin de purge — il échappe à `delete-account` comme aux
> deux triggers de rétention 10 ans, qui ne s'arment que sur `kyc_case_id IS NOT NULL`.

Ce n'est donc pas une découverte, c'est une dette datée qu'on solde. Ce qui est neuf, c'est
la mesure de sa portée : **rien** ne s'applique à ce fichier. Ni dix ans, ni un an, ni jamais.
Un scan de passeport déposé le 26.07 est encore là, et le restera, parce qu'aucun mécanisme
ne le connaît.

Deux mécanismes échouent, et ils échouent pour la même raison — ils parcourent des TABLES :

* `delete-account` énumère `activity_events`, `contacts`, `documents`, `kyc_cases`, `profiles`.
  Le fichier n'a pas de ligne : il n'est pas manqué par oubli de liste, il est INTROUVABLE.
* Les déclencheurs de rétention LBA s'arment sur `kyc_case_id IS NOT NULL`. Le fichier n'est
  rattaché à aucun dossier KYC : aucune règle ne le prend, pas même une règle sévère.

### Ce qui rend la voie de secours structurelle, et non marginale

`20260803160000` annonce que la question « disparaît » avec Stripe Identity. Elle ne disparaît
que pour les dossiers qui passent par Stripe. Or `options.document.allowed_types` de Stripe ne
connaît que `driving_license`, `id_card` et `passport` — **aucun titre de séjour**. À Genève,
une part notable des dirigeants d'agence sont des ressortissants étrangers porteurs d'un livret
B/C : la voie de secours est LEUR voie, pas un cas résiduel.

Conséquence à nommer franchement : la population dont le scan s'accumule sans terme est
structurellement la population non suisse. Ce n'est l'intention de personne — cela tombe de la
liste de documents acceptés par un prestataire — mais le motif se lit mal de l'extérieur, et il
se lira encore plus mal dans deux ans qu'aujourd'hui.

---

## Trois arbitrages, tranchés le 6 août 2026

### Arbitrage 1 : l'image est SUPPRIMÉE une fois le verdict humain posé

Retenu contre les deux autres options (conservation bornée, conservation 10 ans).

Ce qui emporte la décision, c'est que **le dépôt fait déjà le plus dur**. `KybIdReadRecord` —
ce que `kyb-identity-read` écrit dans `agency_related_persons.id_document_read` — ne stocke pas
ce que le modèle a lu, mais le RÉSULTAT DE LA COMPARAISON :

```ts
fields: { firstName, lastName, dateOfBirth }   // 'exact' | 'approx' | 'differs' | 'unreadable'
```

et `KybIdExtraction`, qui porte les vraies valeurs, est documentée « **jamais persistée telle
quelle** ». Le prompt d'extraction exclut par ailleurs explicitement le NUMÉRO de la pièce.
Autrement dit : la transcription est déjà jetée, la minimisation est déjà faite. **L'image est
le dernier artefact brut du dispositif.** La supprimer ne demande pas de repenser le modèle de
données — elle termine un travail commencé.

Assises RGPD, dans l'ordre de poids :

| Article | Effet |
|---|---|
| **5(1)(c)** minimisation | La finalité de l'image s'éteint quand un humain a tranché. Au-delà, elle est détenue sans nécessité. |
| **5(1)(e)** limitation de conservation | Une rétention nulle n'est pas « adéquate », c'est la réponse la plus propre possible. |
| **25** protection dès la conception | Cas d'école de l'art. 25 al. 2. |
| **17** droit à l'effacement | Rien à effacer : le mode de défaillance de F1 cesse d'exister. |
| **32 + 33/34** sécurité et violation | Une violation portant sur un stock de scans de passeports est à risque élevé et impose la notification **aux personnes**. Une violation portant sur `verdict: match, fields: exact/exact/exact` n'est pas le même événement. |

C'est cette dernière ligne qui pèse le plus commercialement : elle sépare l'incident qu'on
gère en interne de celui où l'on écrit à chaque dirigeant d'agence.

**Contre-argument examiné — l'art. 5(2), redevabilité.** Supprimer la pièce n'affaiblit pas la
capacité à démontrer la conformité : subsistent le verdict daté et append-only
(`agency_person_verification_checks`), l'identité du relecteur (`activity_events`), les verdicts
par champ, le modèle utilisé et l'échéance du document. Cela établit QU'UNE vérification a eu
lieu, PAR QUI, QUAND, avec QUEL résultat. Le RGPD demande de démontrer que le traitement fut
conforme, pas d'entreposer la matière première.

### Arbitrage 2 : le déclencheur est le VERDICT HUMAIN, jamais la lecture OCR

Piège évité de justesse, et la raison pour laquelle ce plan ne dit pas « supprimer après
lecture ». `20260802200000` existe précisément pour que le relecteur super-admin puisse OUVRIR
la pièce qu'il juge — avant elle, il tranchait « à l'aveugle, sur un nom de personne et trois
boutons ». Supprimer à la fin de l'OCR le renverrait exactement à ce défaut.

La chaîne est donc : dépôt → OCR (verdicts par champ) → **le relecteur ouvre l'image** →
`admin_resolve_agency_id_document` pose un verdict terminal → **purge**.

Avec un filet : un dossier abandonné n'atteint jamais de verdict terminal, donc l'image y
resterait indéfiniment par une autre porte. D'où une échéance de sécurité (tâche 3).

### Arbitrage 3 : la durée est une VALEUR DE CONFIGURATION, pas une constante gravée

Décision d'ingénierie, motivée par une asymétrie : **la suppression est irréversible.** La seule
question juridique encore ouverte — la LBA atteint-elle l'onboarding d'agence, ou seulement le
KYC des parties à une transaction ? — n'est pas tranchée (voir « hors périmètre »). Si elle se
tranchait plus tard en faveur d'une obligation de conservation, un dispositif qui SUPPRIME en
dur aurait détruit des pièces qu'il fallait garder.

On construit donc le MÉCANISME (le fichier a une ligne, un propriétaire, une échéance, un
chemin de purge) et on paramètre la POLITIQUE. Valeur par défaut : purge au verdict, soit
l'arbitrage 1. Si le conseil juridique conclut autrement, c'est une valeur qui change, pas une
migration à réécrire.

### Arbitrage 4 : accès et effacement portent le MÊME périmètre

Aujourd'hui `delete-account` et `admin-dsar-export` se recoupent sur deux tables
(`activity_events`, `profiles`) et divergent sur tout le reste. Une personne peut donc exporter
ce qui n'est jamais effacé, et ce qui est effacé n'a jamais été exportable. Les art. 15 et 17
portent sur le même patrimoine de données : les deux fonctions doivent lire la même liste, et
cette liste devient une constante partagée plutôt que deux énumérations recopiées — même
raisonnement que la PR #1178 sur les deux helpers d'agence.

---

## Découpage en tâches

Découpage pensé pour que chaque tâche parte en PR séparée et **atteigne `main` le jour même
où sa migration est horodatée** (voir « contraintes de dépôt »).

### Tâche 1 : le fichier cesse d'être introuvable — ✅ FAIT (`20260806184824`)

> ⚠ **Conception révisée pendant l'implémentation.** Ce plan prévoyait une table-miroir
> `agency_id_document_files`. En lisant le chemin réel — `{agence}/kyb-identity/{personne}/{côté}.{ext}`
> — il est apparu que **`storage.objects` EST déjà le registre** : l'agence et la personne y
> sont écrites. Rien ne manquait en base, il manquait quelqu'un pour REGARDER. Un miroir
> aurait ajouté une source de vérité concurrente à tenir à jour au dépôt, au remplacement et
> à la purge — et sa première désynchronisation aurait recréé le défaut qu'on ferme.

Livré à la place :

* **`kyb_identity_files()`** — inventaire DÉRIVÉ (`security definer`, `storage.objects` étant
  sous RLS). Rend chemin, agence, personne, date de dépôt, verdict courant, exigibilité et
  motif de purge. Le verdict est départagé par `_latest_person_verification_check`, le **même**
  point de décision que `submit_agency_identity` et `admin_resolve_agency_id_document` :
  recopier cet ordre ferait diverger « où en est ce check » entre celui qui juge et celui qui
  purge, et une pièce pourrait être détruite alors que la revue la croit en attente.
* **`agency_id_document_purges`** — journal append-only, **sans FK ni cascade**. C'est le seul
  fait qu'un inventaire dérivé ne peut pas reconstituer, l'objet ayant disparu. Sans cascade
  parce qu'une preuve de destruction qui s'efface avec son sujet ne prouve plus rien : c'est
  exactement quand l'agence est supprimée qu'il faut pouvoir montrer que sa pièce l'a été.
* **`kyb_identity_retention_days()`** — l'arbitrage 3 matérialisé : 90 jours, en un point de
  réglage unique. Ne s'applique qu'aux pièces SANS verdict ; une pièce tranchée part sans
  attendre l'échéance.

Aucun trigger sur `storage.objects` : le dépôt n'en pose aucun aujourd'hui, le privilège n'est
acquis nulle part, et faire dépendre la conformité d'une écriture qui peut échouer en silence
serait un mauvais échange.

Pas de changement de comportement — la migration est purement additive et sûre quelle que soit
la réponse à la question LBA.

### Tâche 2 : purge au verdict terminal

`admin_resolve_agency_id_document` (20260731121000) pose déjà le verdict. Elle gagne, **en
dernière instruction**, la suppression de l'objet Storage et le renseignement de
`purged_at`/`purge_reason='verdict'`.

Verdicts terminaux : `match` et `mismatch`. **Pas** `pending_manual_review` (question ouverte),
**pas** `partial` tant que l'étape 7 le rend remplaçable — une pièce refusée redevient
déposable, donc purger sur `partial` casserait la boucle de remédiation.

### Tâche 3 : le filet — purge à échéance

Un dossier abandonné n'atteint aucun verdict. Job `pg_cron` quotidien : purge les objets dont
`purge_after < now()` et `purged_at is null`, `purge_reason='expiry'`.

Échéance par défaut proposée : **90 jours après dépôt**. Assez long pour une revue humaine qui
traîne, assez court pour ne pas devenir un entrepôt. Valeur portée par la configuration
(arbitrage 3), pas par une constante.

⚠ Identifier le job par son `jobname`, jamais par son `jobid` (§7 de CLAUDE.md).

### Tâche 4 : réconciliation de l'existant

Les fichiers déjà déposés n'ont pas de ligne. Script `scripts/` (exécutable, pas dans `src/`) :
lister le préfixe, rapprocher chaque objet de son agence et de sa personne par le chemin,
insérer la ligne manquante avec `purge_reason='backfill'`.

Un objet non rapprochable est **signalé, pas supprimé** : un orphelin peut être le seul
exemplaire d'une pièce en cours de revue. La destruction sur inférence est le seul geste
vraiment irréversible de ce plan.

### Tâche 5 : `delete-account` couvre le patrimoine onboarding

Ajouter `agency_related_persons`, `agency_id_document_files` (+ purge Storage effective),
`onboarding_calls`, `onboarding_hosts`.

Attention à `agency_related_persons` : elle porte `date_of_birth`, `nationality`,
`id_document_type`, `id_document_number` — commentée « PII sensible (LPD) » — aujourd'hui dans
NI l'un NI l'autre chemin. C'est le gros de F2.

### Tâche 6 : `admin-dsar-export` lit la même liste

Même périmètre que la tâche 5, via une constante partagée dans `_shared/`. Un test interdit la
divergence : toute table du périmètre d'effacement doit apparaître au périmètre d'accès, et
réciproquement.

### Tâche 7 : borner le jeton d'appel d'accueil (F4)

`onboarding_calls.manage_token` est un uuid sans échéance, et
`get_onboarding_call_by_token` est exécutable par `anon`. `can_manage`/`can_reschedule` bornent
les GESTES sur `scheduled_at > now()`, mais la LECTURE rend indéfiniment le nom du réservant,
le nom de l'agence, l'hôte, l'horaire et l'URL de réunion.

Aligner la lecture sur les gestes : au-delà d'une fenêtre après `scheduled_at`, la fonction ne
rend plus rien. Aucune colonne nouvelle — la borne se calcule sur `scheduled_at`.

### Tâche 8 : refermer le registre

`01-registre-activites-traitement.md` porte des champs **À DÉTERMINER** posés le 06.08.2026
(activité n°13, durée de conservation). Les remplacer par la valeur retenue une fois la tâche 3
en service, et retirer le point ouvert n°2.

---

## Vérification de fin de chantier

* Un compte supprimé ne laisse **aucun** objet sous `documents/{agence}/kyb-identity/` — vérifié
  par un test qui dépose, supprime, puis liste le préfixe.
* Un verdict `match` purge l'objet et renseigne `purged_at` ; la ligne survit.
* Un dossier laissé sans verdict au-delà de l'échéance est purgé par le cron avec
  `purge_reason='expiry'`.
* L'export DSAR et l'effacement énumèrent la même liste de tables (test de symétrie).
* Un jeton d'appel d'accueil au-delà de sa fenêtre ne rend plus de PII.
* `npm run build`, `npm run lint`, `deno check` sur les fonctions touchées, et les tests
  backend RLS.

## Contraintes de dépôt à ne pas redécouvrir

1. **Une migration doit atteindre `main` le JOUR UTC de son horodatage**, sinon elle ne
   s'applique jamais. Horodatage jamais rond (`20260806171204`, pas `20260806120000`).
2. **Le piège de la parenthèse** (`20260802200000`) : dans une policy Storage, `or
   public.is_super_admin()` reste IMBRIQUÉ sous les clauses de portée. Posé au niveau du
   `using(...)`, il ouvre TOUS les buckets.
3. Les policies `documents_bucket_*` excluent le préfixe `kyb-identity` **exprès**. Postgres
   combine les policies permissives en OR : une branche du mauvais côté rouvre le préfixe à
   tout membre de l'agence.
4. Ne pas donner UPDATE/DELETE au relecteur sur le préfixe : le verdict est append-only et
   désigne un fichier qui n'a pas bougé. La purge s'exécute en `service_role`.
5. Le trigger `enforce_agency_person_id_read_writer` (20260803150000) refuse
   `id_document_read` / `id_document_expires_on` à tout rôle sauf service.
6. `scripts/` = exécutables seuls ; helpers → `scripts/_shared/`.

## Ce qui reste hors de ce chantier, et pour qui

| Question | Qui tranche |
|---|---|
| **La LBA atteint-elle l'onboarding d'agence, ou seulement le KYC des parties à une transaction ?** Seule question capable de renverser l'arbitrage 1. Le déclencheur 10 ans porte sur `documents` et s'arme sur `kyc_case_id` — soit les acheteurs/vendeurs, pas le client SaaS. | Conseil juridique |
| Le contrôle du vivant (selfie Stripe) est-il une donnée biométrique au sens de l'art. 5 let. c ch. 4 nLPD ? Déplacerait la base légale vers le consentement explicite. | Conseil juridique |
| Base de transfert pour **DeepSeek (Chine)** — aucune adéquation, aucun DPA. Concerne les activités #2, #7, #9, #12. | Direction + conseil juridique |
| Re-qualification du DPA Google : Gemini lit des **pièces d'identité**, le contrat visait le staging de photos. | Direction + Google |
| Extension de la DPIA au KYB et au contrôle du vivant. | Direction + conseil juridique |
| Durée de conservation des champs DÉCLARÉS (`date_of_birth`, `nationality`, `id_document_number`). Provenance meilleure que l'image — donnés par la personne, non extraits d'un scan — mais durée à fixer quand même. | Direction |
