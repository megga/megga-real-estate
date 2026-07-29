# Onboarding agence et vérification d'identité (KYB) — conception

> **Date :** 26 juillet 2026
> **Reprend :** [agency-kyb-verification.md](../../agency-kyb-verification.md) (conception schéma, Antoine)
> et [agency-kyb-handoff.md](../../agency-kyb-handoff.md) (état de la branche `feat/agency-kyb-verification`).
> **Ce document ajoute** ce que ces deux-là ne couvrent pas : le parcours utilisateur,
> le gate, les correctifs d'existant qu'il impose, et le découpage en étapes livrables.

---

## 1. Objet

Créer le parcours par lequel une agence saisit elle-même son identité légale à
l'inscription, et la machinerie qui confronte cette saisie aux sources faisant
autorité.

Antoine a livré les tables qui accueillent cette donnée et le moteur de vérification
qui l'exploitera. Il manque les deux bouts : **ce qui remplit les tables** (le
parcours) et **ce qui les exploite** (le moteur, les connecteurs, la file de revue).

Objectifs du Document Maître servis : réduire le risque LAB/KYC (2), augmenter la
transparence client (4).

---

## 2. Décisions actées

| Sujet | Décision | Qui |
|---|---|---|
| Modèle | Self-serve, saisie à la charge de l'utilisateur, au niveau agence | Thomas |
| Utilisateur individuel | N'ouvre pas de compte en self-serve. Il entre par invitation d'une agence existante et relève du KYC agent léger, pas du KYB | Thomas |
| Accès pendant la vérification | Accès complet dès la saisie soumise, bandeau de rappel, blocage des seules actions à risque LAB | Thomas |
| Exemption de gate | Les trois comptes développeurs uniquement | Thomas |
| Reprise de données | Aucune. Base entièrement mock, aucun client connecté | Thomas |
| Domaine e-mail | Signal faible qui nourrit le score, jamais un véto | Antoine (§2), confirmé |
| Prestataire liveness | Aucun pour l'instant. Upload relu par un humain, le slot reste ouvert | Ce document |

### Sur le domaine e-mail

La question posée était : peut-on s'appuyer sur le domaine e-mail pour valider
l'appartenance à l'agence, en attendant Zefix. Deux choses distinctes s'y cachent.

**Le contrôle de la boîte** est déjà prouvé gratuitement par la confirmation d'e-mail
Supabase, et c'est un vrai signal d'affiliation : recevoir du courrier à
`@regie-dupont.ch` rend plausible l'appartenance à Régie Dupont.

**L'existence et la légitimité de l'entité** ne s'en déduisent pas. Un domaine coûte
douze francs, et un fraudeur soigneux fera correspondre son domaine à son faux nom
mieux qu'une agence légitime opérant sous un nom commercial distinct de sa raison
sociale. C'est l'arbitrage d'Antoine (§2) et il tient.

Ce qu'on en tire concrètement : le check `domain_whois` via RDAP, l'une des rares
sources qui répondent aujourd'hui (`.ch`, `.li`, `.fr`, publiques, sans clé). L'âge du
domaine et son statut sont un signal de risque plus solide que la ressemblance des
noms. Un domaine grand public (gmail, outlook) vaut pénalité compensable.

Ce que ça ne débloque pas : avec Zefix muet, le véto « existence au registre » reste
`unavailable`, et la règle d'Antoine est qu'un véto absent ne passe pas. Tout dossier
suisse ira en revue humaine. Le domaine sert au relecteur, pas à l'auto-validation.

---

## 3. Ce sur quoi on construit (état vérifié le 26.07.2026)

### Acquis (branche `feat/agency-kyb-verification`)

8 tables, 4 migrations, 16 tests de non-régression, exécutées pour de vrai sur
Postgres 17. Frontend limité à Réglages → Agence : menu forme juridique alimenté par
`legal_forms`, `ide` renommé `business_registration_number`.

### Absent

Moteur de scoring (conçu, non commencé), connecteurs registres, file de revue admin.

### L'existant que ce chantier doit corriger

Cinq faits vérifiés en lisant le dépôt, chacun incompatible avec le parcours cible.

1. **Le champ « nom de votre agence » de l'inscription est jeté.** La vitrine l'envoie
   dans `raw_user_meta_data.agency_name`
   ([megga-auth.js:369](../../../sites/megga-vitrine/js/megga-auth.js)), et
   `handle_new_user()` nomme l'agence d'après `full_name` ou le préfixe de l'e-mail.
   Aucun consommateur de `agency_name` en migrations, `src/` ou edge functions.

2. **Le fondateur n'est pas admin de sa propre agence.** `handle_new_user()` fige
   `role='agent'` (valeur envoyée par la vitrine) et `provision_solo_agency()` ne
   touche pas au rôle. Or `is_agency_admin()` d'Antoine exige `admin` ou `manager`.
   **Conséquence : dans l'état actuel, le fondateur ne peut pas écrire ses propres
   données KYB.** Le parcours est structurellement bloqué avant même d'exister.
   `create_agency_and_join` fait pourtant l'inverse : l'appelant devient admin.

3. **Chaque agent invité laisse une agence solo orpheline.** Il doit d'abord créer un
   compte, ce qui déclenche `handle_new_user` et lui fabrique une agence solo, avant
   que `accept-team-invite` ne réécrive son `agency_id`
   ([index.ts:129](../../../supabase/functions/accept-team-invite/index.ts)).

4. **`join_agency(uuid)` ne vérifie aucune invitation** et reste accordée à
   `authenticated`
   ([20260621130000:56](../../../supabase/migrations/20260621130000_fix_agency_join_role_cast.sql)).
   N'importe quel compte authentifié peut s'attacher à n'importe quelle agence par son
   UUID et devenir `agent` dessus, avec l'accès RLS aux contacts, deals et dossiers
   KYC. Le commentaire d'origine de la fonction annonçait son remplacement par un
   workflow validé, qui n'est jamais venu.

5. **Il n'existe plus aucun gate.** `resolveOnboardingGate` a été supprimé avec le
   wizard le 18 juillet (commit `d4cbe117`, ~9 600 lignes). On repart de zéro, ce qui
   est voulu : l'ancien wizard servait le calibrage D0, qui n'avait jamais produit de
   donnée. Celui-ci sert la conformité.

---

## 4. Parcours cible

### Inscription (vitrine, quasi inchangée)

Nom, e-mail, mot de passe, captcha. Le seul changement est côté serveur : le nom
d'agence saisi sert enfin à nommer l'agence auto-provisionnée.

L'auto-provision reste. La leçon inscrite dans la migration du 18 juillet
(« best-effort, ne bloque JAMAIS le signup ») a été payée par un incident : le
parcours complète une agence existante au lieu d'en créer une.

### Premier login : gate de saisie

Cinq étapes, bloquantes tant que la saisie n'est pas soumise.

| Étape | Contenu | Écrit dans |
|---|---|---|
| 1. Signataire | Prénom, nom, date de naissance, nationalité, pouvoir de signature (individuel / collectif) | `agency_related_persons` + `agency_person_roles` (`signatory`) |
| 2. Agence | Pays du siège, forme juridique, raison sociale, nom commercial, n° de registre, TVA, adresse, NPA, ville, canton | `agencies.*` |
| 3. Bénéficiaires effectifs | Personnes détenant 25 % ou plus | `agency_person_roles` (`ubo`) |
| 4. Pièce d'identité | Recto/verso du signataire | Storage `documents` + `agency_person_verification_checks` |
| 5. Récapitulatif | Attestation d'exactitude, soumission | `agencies.identity_submitted_at`, `activity_events` |

**Étape 3 conditionnelle.** Sautée si `legal_forms.category = 'sole_proprietorship'`,
où le signataire est l'entité et il n'y a pas d'UBO tiers. C'est le rôle explicite de
la colonne `category` chez Antoine (« category pilote le parcours KYB »).

**Étape 2 avant étape 3.** Le pays du siège filtre le menu des formes juridiques
(`useLegalForms`, déjà livré), et la forme juridique décide de l'affichage de l'étape
3. L'ordre n'est donc pas cosmétique.

**Étape 4 sans prestataire.** Upload dans le bucket `documents` sous un préfixe dédié,
puis check `source='manual'` en attente de relecture humaine. Ajouter un prestataire
de liveness aujourd'hui n'achèterait rien, puisque tout dossier suisse part de toute
façon en revue humaine.

### Après soumission

Accès complet au CRM. Bandeau persistant tant que `verification_status` vaut `pending`
ou `manual_review`. Actions à risque LAB bloquées (§9).

### Agent invité

Ne voit rien de ce parcours. Il hérite de l'agence et de son statut de vérification.
Son KYC agent léger (pièce d'identité) est non bloquant, conformément à la confiance
déléguée posée par Antoine (§1) : l'agent n'engage pas juridiquement l'entité, le
dirigeant répond de lui et c'est tracé dans `activity_events`.

---

## 5. Le gate

### Condition d'activation

```
gate actif si :
      profiles.agency_id is not null
  and profiles.role in ('admin', 'manager')        -- le dirigeant, pas l'employé
  and agencies.identity_submitted_at is null
  and not is_super_admin()
```

### Pourquoi une colonne dédiée et pas `verification_status`

`verification_status` répond à « que dit la vérification » et vaut `pending` par
défaut à la création de la ligne. Il ne distingue pas « rien n'a été saisi » de
« saisi, en attente de traitement ». `identity_submitted_at` répond à une autre
question, « l'utilisateur a-t-il terminé le formulaire », et donne en prime une date
auditable. Deux faits distincts, deux colonnes.

### Exemption

Portée par `is_super_admin()`, dont le corps est
`profiles.role = 'super_admin'`. **Hypothèse à valider avant merge : le rôle
`super_admin` est aujourd'hui porté par exactement les trois comptes développeurs.**
Si l'équipe MEGGA doit en compter d'autres plus tard, l'exemption s'élargira
mécaniquement. C'est acceptable (un compte interne n'a pas d'agence à vérifier) mais
doit rester un choix conscient, pas une dérive.

### Ne pas rejouer la boucle

Un gate bloquant a déjà causé un P0 en juillet (`c830f9a9`, « boucle onboarding ») et
un autre chantier a dû exempter les super-admins après coup (`e6c26c02`). Trois
garde-fous dès la première version :

- La progression est persistée à chaque étape, pas seulement à la fin. Fermer l'onglet
  ne perd rien.
- Une sortie explicite « reprendre plus tard » ramène à un écran d'attente lisible, et
  jamais à une redirection en boucle vers le gate.
- Un test e2e couvre le cycle complet login, gate, soumission, accès, relogin.

---

## 6. Modèle de données

Le schéma d'Antoine est repris tel quel. Deux ajouts additifs.

### `identity_submitted_at`

```sql
alter table public.agencies
  add column if not exists identity_submitted_at timestamptz;
```

Index partiel pour la vue admin des agences qui n'ont jamais soumis (relances). Le
gate, lui, lit l'agence par sa clé primaire et n'a besoin d'aucun index.

```sql
create index if not exists idx_agencies_identity_never_submitted
  on public.agencies (created_at)
  where identity_submitted_at is null;
```

### Un statut manque : `validated`

L'énumération d'Antoine est `pending | auto_validated | manual_review | rejected`.
Quand un relecteur valide un dossier parti en revue humaine, aucune valeur ne convient :
`auto_validated` mentirait sur l'origine de la décision, et c'est précisément la
distinction qu'un audit LAB regarde. On ajoute donc une valeur au CHECK.

```sql
alter table public.agencies drop constraint if exists agencies_verification_status_chk;
alter table public.agencies
  add constraint agencies_verification_status_chk
  check (verification_status in
    ('pending', 'auto_validated', 'validated', 'manual_review', 'rejected'));
```

`auto_validated` reste réservé au moteur, `validated` à la décision humaine. Le moteur
ne doit pas plus écraser un `validated` qu'un `rejected` : même raison, un verdict
humain ne se retourne pas seul.

Rien d'autre. Les personnes, les rôles, les checks et la configuration pondérée
existent déjà.

---

## 7. Écriture et sécurité

### Ce que le dirigeant écrit directement

`agencies` (via `useAgencySettings`, déjà câblé sur les colonnes KYB),
`agency_related_persons` et `agency_person_roles`, sous les policies d'Antoine
(`is_agency_admin()`).

### Ce qu'il n'écrit pas

Les tables de checks. L'écriture y est déjà refusée (`42501`), seul le `service_role`
écrit un verdict. C'est la garantie qu'un utilisateur ne peut pas fabriquer sa propre
preuve de vérification.

### RPC de soumission

`submit_agency_identity()`, `SECURITY DEFINER`, `search_path` figé.

- Garde `is_agency_admin()` en entrée.
- Vérifie la complétude minimale (raison sociale, forme juridique, pays, au moins un
  signataire actif) et échoue explicitement sinon.
- Pose `identity_submitted_at = now()`.
- Journalise dans `activity_events` : `category='kyc'`, `severity='info'`,
  `actor_kind='user'`. Contraintes vérifiées en base par Antoine : `'compliance'`
  n'est pas une catégorie valide, et `actor_kind='system'` impose `actor_id` NULL.
- `GRANT authenticated`, `REVOKE anon` (discipline `20260711210000`).

### Correctifs de sécurité embarqués

`join_agency(uuid)` doit exiger une invitation valide pour l'agence visée, ou être
révoquée de `authenticated` si le chemin invitation suffit. Le second est préférable :
`accept-team-invite` couvre déjà le besoin, avec vérification d'expiration et de
correspondance d'e-mail. Une RPC ouverte sans garde n'a pas à survivre à ce chantier.

---

## 8. Moteur de vérification

Conception intégralement établie par Antoine (handoff §6), reprise sans modification.
Résumé des points qui cassent s'ils sont mal repris :

- **Forme** : RPC Postgres, pas Edge Function. Tous les moteurs de score du projet
  vivent en Postgres, et l'agrégation pondérée sur des lignes de checks est du SQL
  naturel. Les Edge Functions servent les connecteurs, qui eux ont besoin du réseau.
- **Seuils** : patron `app_config`, clé `agency_verification_v1`, fonction jumelle
  `get_agency_verification_config()` calquée sur `get_property_score_config()`.
  Défauts en dur : auto-validation à 0.85, priorité de revue à 0.5.
- **Dernier check par type** : les checks sont append-only,
  `distinct on (check_type) ... order by check_type, checked_at desc`.
- **Jointure du poids temporelle** : `cfg.valid_from <= chk.checked_at and
  (cfg.valid_to is null or cfg.valid_to > chk.checked_at)`. C'est le coeur de
  l'auditabilité : un dossier validé hier se rejustifie avec le barème d'hier.
- **Véto** : ne passe que sur `match`. Un véto absent ne passe pas.
- **`unavailable`** exclu du numérateur et du dénominateur. **`pending_manual_review`**
  force la revue.
- **Score `null`** (aucun check scorable) n'auto-valide jamais.
- **`rejected`** n'est jamais posé automatiquement et n'est jamais écrasé par le
  moteur : un verdict humain ne se retourne pas tout seul.
- **Droits** : `service_role` seul.

Déclenchement : l'edge function de vérification (§9) appelle le moteur après avoir
écrit ses checks. Pas de cron tant qu'aucun connecteur ne produit de check en continu.

---

## 9. Connecteurs

Une edge function `agency-verification-run` (service_role), appelée après soumission
et rejouable depuis la console admin.

**Écrivables aujourd'hui :**

| Check | Source | Statut de la source |
|---|---|---|
| `domain_whois` | RDAP `.ch` / `.li` / `.fr` | publiques, sans clé, confirmées |
| `vat_lookup` | VIES (UE) | publique, sans clé, confirmée |
| `registry_lookup` (FR) | `recherche-entreprises.api.gouv.fr` | publique, sans clé, 7 req/s |
| `address_geocode` | Mapbox | déjà dans la stack |

**Bloqués :** Zefix (`401`, identifiants demandés sans réponse), UID/TVA CH-LI (statut
d'API non clarifié), `oera.li` (aucune API publique). Ces trois produisent des checks
`unavailable`, ce qui envoie mécaniquement tout dossier suisse en revue humaine.

**À retester avant de conclure :** GLEIF, injoignable depuis le bac à sable d'outils
d'Antoine, ce qui n'est pas un fait sur GLEIF. Idem pour la présence d'enregistrements
MX, qui demande une résolution DNS et non du RDAP : vérifier ce que permettent les
Edge Functions Supabase avant de l'inscrire au barème.

**Ce qui rend le parcours suisse exploitable malgré tout :** un check `source='manual'`
saisi par un relecteur se score exactement comme un check automatique. Le moteur ne
dépend d'aucune réponse externe.

---

## 10. File de revue (console admin)

Sur `admin.megga.ch`, application séparée (`npm run build:admin`), pas dans le CRM
agent.

- Liste triée par score croissant, les plus douteux en tête. Pas de colonne de
  priorité dérivée : le tri suffit, décision d'Antoine.
- Dossier détaillé : chaque check avec son type, sa source, son poids applicable à la
  date du check, son résultat et sa réponse brute. C'est ce qui permet de justifier
  check par check pourquoi un dossier a été validé, exigence de conformité LAB.
- Actions : valider, rejeter avec motif, relancer la vérification.
- Toute décision tracée dans `activity_events` (`category='kyc'`).

---

## 11. Gardes LAB

Un hook unique lit `verification_status` et expose l'état. Deux surfaces bloquées tant
que le statut n'est pas `auto_validated` ou `validated` :

- ouverture d'un dossier KYC client (`/dashboard/kyc`, edge `kyc-screening`) ;
- demande de signature électronique (edge `sign-document`).

Le blocage explique pourquoi et pointe l'état du dossier. Il ne cache pas la
fonctionnalité : une porte fermée avec un motif lisible vaut mieux qu'un bouton
absent.

Liste exacte à figer à l'implémentation avec Gregory : ce sont des actions métier, pas
un choix technique.

---

## 12. Correctifs d'existant embarqués

Chacun corrige un fait vérifié du §3.

1. `handle_new_user()` lit `raw_user_meta_data.agency_name` pour nommer l'agence.
2. `provision_solo_agency()` pose `role='admin'` sur le fondateur, alignement sur
   `create_agency_and_join`. **Sans ce correctif, rien du reste ne fonctionne :** le
   fondateur échoue à `is_agency_admin()` et ne peut pas écrire ses propres données.
3. `handle_new_user()` ne provisionne pas d'agence solo si une invitation valide
   existe pour cet e-mail. Fin des agences orphelines.
4. `join_agency(uuid)` révoquée de `authenticated`, le chemin invitation étant
   couvert par `accept-team-invite`.
5. Nouveau gate, avec exemption super-admin et anti-boucle dès la première version.

---

## 13. Découpage en étapes livrables

Une étape par PR, chacune vérifiable seule. Ce document est le cadrage du programme,
pas le plan d'une PR : **chaque étape aura son propre plan d'implémentation** au
moment de l'attaquer.

| # | Étape | Dépend de | Bloqué par une source externe |
|---|---|---|---|
| 0 | Débloquer et merger la branche d'Antoine : re-dater les 4 migrations au jour du merge, relancer `lint:migrations` et les 16 tests | rien | non |
| 1 | Correctifs d'existant (§12, points 1 à 4) | 0 | non |
| 2 | Gate + wizard 5 étapes + RPC de soumission | 1 | non |
| 3 | Moteur de scoring + config `app_config` | 0 | non |
| 4 | Connecteurs disponibles : RDAP, VIES, recherche-entreprises, Mapbox | 3 | non |
| 5 | File de revue admin + gardes LAB | 3 | non |
| 6 | Connecteurs Zefix et UID | 4 | **oui** |

L'étape 0 conditionne tout : les quatre migrations d'Antoine portent un horodatage qui
entre en collision avec `20260726120000_realadvisor_shard_map_3day.sql` déjà sur
`main`, et le date-guard de `deploy.yml` saute définitivement toute migration datée
d'avant le jour du déploiement. Le re-datage règle les deux d'un coup. La fenêtre de
coupure sur Réglages → Agence est sans objet ici : la base est mock.

---

## 14. Hors périmètre

- Prestataire de liveness et vérification automatisée de pièce d'identité. Le schéma
  garde le slot ouvert.
- Vérification de la carte professionnelle immobilière (RCC cantonal en Suisse, loi
  Hoguet en France). Aucune API exploitable, revue manuelle.
- Onboarding sales-led. `admin_create_agency` existe et reste utilisable, mais ne fait
  pas l'objet d'un parcours dédié en v1.
- Réseau inter-agences et partage de biens, hors périmètre v1 du produit.

---

## 15. Vérification

Ce qui devra être vrai avant de considérer chaque étape terminée.

- `supabase db reset` applique toutes les migrations à neuf, exit 0. C'est ce filet qui
  a trouvé le défaut d'alias homonymes qu'aucun linter de texte ne pouvait voir.
- Tests backend exécutés avec les clés, **et le compte de tests lu**, pas seulement le
  code de sortie : ils sont derrière `describe.skipIf(!HAS_KEYS)` et sortent en 0 sans
  rien exécuter si les variables manquent.
- RLS prouvée par mutation, pas seulement par assertion verte : un test qui n'a jamais
  échoué ne prouve rien.
- Cas couverts en non-régression : fondateur admin de sa propre agence, agent invité
  sans agence orpheline, gate franchi une seule fois, gate inactif pour un super-admin,
  écriture de check refusée à un utilisateur, `join_agency` inaccessible à
  `authenticated`.
- `npm run build`, `npm run build:admin`, `npm run lint`, `npm run lint:migrations`.
- CI backend verte : `lint:prose` et les specs backend live se sautent en local, le
  merge se gate sur la CI.
