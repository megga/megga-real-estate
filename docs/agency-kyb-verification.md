# Vérification d'identité des agences (KYB) — décisions de conception

> **Statut (26.07.2026) : schéma + frontend livrés et vérifiés ; parcours d'onboarding
> conçu ; moteur, connecteurs et file de revue non commencés.**
> Branche : `feat/agency-kyb-verification`.
>
> **➜ Pour reprendre le travail, commence par [agency-kyb-handoff.md](agency-kyb-handoff.md)** :
> état exact, programme en 6 étapes exécutables, pièges à traiter avant de merger,
> montage de l'environnement.
>
> Le présent document porte les **décisions et les arbitrages du schéma et de la
> vérification** : le pourquoi, pour ne pas les rejouer. Il ne dit pas où on en est.
> La conception du **parcours utilisateur** (gate, wizard, politique d'accès) vit dans
> [2026-07-26-onboarding-kyb-design.md](superpowers/specs/2026-07-26-onboarding-kyb-design.md).

---

## 1. Cadrage

Onboarding **par agence**, pas par agent : un dirigeant crée un compte agence dont
l'identité est vérifiée ; ce compte crée ensuite les comptes agents (employés).

Distinction structurante — les deux ne se vérifient pas pareil :

| | Objet | Méthode |
|---|---|---|
| **KYB** | La personne morale existe-t-elle, est-elle légitime | Registre du commerce, TVA, signaux publics |
| **KYC** | Quel humain a le droit d'agir en son nom | Pièce d'identité + liveness, screening PEP/sanctions |

Une SA n'a pas d'« identité » à vérifier comme une personne physique : elle a une
existence légale, des organes avec pouvoir de signature, et des ayants droit
économiques. C'est ce qui bloquait la réflexion initiale.

**Comptes agents = confiance déléguée.** Une fois le représentant légal vérifié, il
répond des employés qu'il embarque (tracé dans `activity_events`). Vérification ID +
selfie légère suffisante — l'agent n'engage pas juridiquement l'entité.

### Confirmé et précisé le 26.07.2026 (Thomas)

Ce cadrage est retenu. Trois précisions le complètent.

**Self-serve.** La saisie est à la charge de l'utilisateur, pas d'une équipe interne.
`admin_create_agency` (onboarding sales-led, déjà en place) reste utilisable mais ne
fait pas l'objet d'un parcours dédié en v1.

**L'utilisateur individuel n'ouvre pas de compte en self-serve.** Un courtier
indépendant sans structure entre par invitation d'une agence existante
(`team_invitations`, déjà en place) et relève du KYC agent léger, pas du KYB. Cela
évite le trou du véto n°1 : une raison individuelle suisse n'est pas toujours inscrite
au registre du commerce, l'inscription n'étant obligatoire qu'au-delà d'un seuil de
chiffre d'affaires. Un indépendant légitime ferait donc échouer le véto par
construction. Le cas `sole_proprietorship` du référentiel reste utile pour les raisons
individuelles réellement inscrites.

**Le parcours décrit ci-dessus n'existait plus dans le dépôt au moment de la rédaction
de ce document.** Le wizard post-login a été supprimé le 18 juillet 2026 (commit
`d4cbe117`, environ 9 600 lignes), et `handle_new_user()` auto-provisionne désormais
une agence solo nommée d'après la personne, sans aucune donnée d'identité. Le schéma
ci-dessous reste valable ; c'est ce qui le remplit qui manquait. Voir le spec du
parcours et le handoff §0.

---

## 2. Principe de vérification

> **Chaque identifiant se valide contre sa propre source faisant autorité, indépendamment.
> La corrélation entre identifiants est un signal de risque, jamais une porte pass/fail.**

Comparer des chaînes entre elles (nom d'agence ↔ nom de domaine email) est fragile dans
les deux sens : ça rejette des agences légitimes opérant sous un nom commercial distinct
de leur raison sociale, et ça laisse passer un fraudeur qui achète un domaine assorti à
son faux nom. D'où le champ `trade_name` séparé (§4) : le matching flou se fait sur lui,
**jamais** sur `legal_name`.

### A. Vétos durs — échec = revue humaine bloquante, aucun score ne compense

1. `business_registration_number` → format + checksum selon pays, existence au registre, statut actif
2. `legal_name` saisi ↔ raison sociale retournée par le registre (fuzzy strict : accents/casse/ponctuation tolérés, rien d'autre)
3. `country` saisi ↔ juridiction du registre interrogé

*Pourquoi vétos et non score : ces champs décrivent la même donnée vue par deux sources
indépendantes. Un écart n'est pas « moins de confiance », c'est une erreur de saisie ou
une usurpation — ça mérite un humain.*

### B. Signaux moyens — contribuent au score, jamais bloquants seuls

Adresse ↔ registre (fuzzy tolérant) · TVA ↔ VIES (UE) · géocodage Mapbox ↔ pays/canton ·
RCC / association professionnelle · code d'activité registre (NOGA/NAICS) ↔ whitelist
immobilier · LEI ↔ GLEIF · signataire listé comme organe au registre

### C. Signaux faibles — jamais comparés à `legal_name`

Domaine email ↔ `website` · domaine ↔ **`trade_name`** (Jaro-Winkler après normalisation :
suffixes légaux SA/Sàrl/GmbH/Ltd retirés, accents, tokenisation) · WHOIS/RDAP (âge du
domaine, MX présents) · domaine grand public (gmail/outlook) = pénalité forte mais
compensable · téléphone (indicatif, type de ligne)

> **Question posée le 26.07.2026 :** peut-on s'appuyer sur le domaine e-mail pour
> valider l'appartenance à l'agence, en attendant Zefix ? **Réponse : non comme véto,
> oui comme signal faible**, c'est-à-dire exactement ce que dit cette section.
>
> Deux choses s'y cachent. Le **contrôle de la boîte** est déjà prouvé gratuitement par
> la confirmation d'e-mail Supabase, et c'est un vrai signal d'affiliation : recevoir du
> courrier à `@regie-dupont.ch` rend plausible l'appartenance à Régie Dupont.
> L'**existence et la légitimité de l'entité** ne s'en déduisent pas : un domaine coûte
> douze francs, et un fraudeur soigneux fera correspondre son domaine à son faux nom
> mieux qu'une agence légitime opérant sous un nom commercial distinct de sa raison
> sociale.
>
> Ce que ça ne débloque pas : avec Zefix muet, le véto « existence au registre » reste
> `unavailable`, et un véto absent ne passe pas. Tout dossier suisse ira en revue
> humaine. Le check `domain_whois` sert au relecteur (âge et statut du domaine, signal
> de risque autrement plus solide que la ressemblance des noms), pas à l'auto-validation.

### D. Personne physique — ancrage indépendant

Nom/prénom ↔ pièce d'identité (vendor KYC/liveness) · screening PEP/sanctions
(Dilisense, déjà branché via `kyc-screening`) — un hit = revue humaine quel que soit le
score entité.

### Agrégation

```
score = Σ(poids_i × résultat_i) / Σ(poids_i des checks DISPONIBLES)
```

- `résultat_i` ∈ {1 = match, 0.5 = partiel, 0 = mismatch} ; absent = **exclu du dénominateur**
- Normalisation sur les checks disponibles : un pays sans VIES ni RCC n'est pas
  mécaniquement pénalisé, juste moins confirmé. C'est ce qui rend le système transposable.
- Vétos (A) et hits PEP/sanctions sont **hors score** — gates binaires évalués avant agrégation.

| Condition | Issue |
|---|---|
| Véto échoué ou hit PEP/sanctions | Revue humaine bloquante, dossier gelé |
| Aucun véto + score ≥ 0.85 | Auto-validation |
| 0.5 ≤ score < 0.85 | File de revue humaine, priorité normale |
| score < 0.5 | Revue humaine, priorité haute |

Formule linéaire explicable délibérément préférée à un modèle opaque : en conformité
LAB/KYC il faut pouvoir justifier check par check pourquoi un dossier a été auto-validé.

---

## 3. Inventaire des sources par pays

Statuts **testés en direct le 25.07.2026** sauf mention contraire.

> **Depuis l'étape 6 (29.07.2026) :** Zefix et le registre UID ont un **squelette câblé**
> dans `_shared/kyb-sources.ts` — sources déclarées, juridiction (`CH` pour Zefix,
> `CH`/`LI` pour l'UID), place dans le registre et forme de l'indisponibilité. Leur statut
> ci-dessous est inchangé : aucune requête n'est émise, les quatre checks sortent
> `unavailable`. Ne restent à écrire, le jour où les identifiants arrivent, que l'URL,
> l'authentification et l'analyse de la réponse (handoff §6 étape 6, variables au §8).

### 🇨🇭 Suisse

| Donnée | Source | Statut | Action |
|---|---|---|---|
| Registre entreprise | Zefix PublicREST | ⚠ `401 Unauthorized` confirmé | Identifiants demandés à `zefix@bj.admin.ch` — **en attente** |
| TVA | UID-Register (`uid.admin.ch`) | ⚠ non testé en API | Clarifier : API séparée ou champ Zefix ? — **en attente** |
| Registre courtiers (RCC) | Cantonal (ex. Genève) | Aucune API trouvée | Signal optionnel, faible priorité |
| WHOIS domaine `.ch` | RDAP `rdap.nic.ch` | ✅ répond, public, sans clé | Aucune |

### 🇱🇮 Liechtenstein

| Donnée | Source | Statut | Action |
|---|---|---|---|
| Registre entreprise | `oera.li` (Amt für Justiz) | ⚠ aucune API publique trouvée | Confirmé auprès de l'Amt für Justiz — **en attente** ; sinon revue manuelle pour ce pays |
| TVA | FL-UID (dérivé du système suisse, union douanière, préfixe CHE) | ⚠ non testé | Dépend de la réponse UID-Register |
| WHOIS domaine `.li` | RDAP `rdap.nic.li` | ✅ répond (même infra SWITCH que `.ch`) | Aucune |
| Registre professionnel immobilier | — | Inexistant | Signal absent — le score le tolère par construction |

### 🇫🇷 France

| Donnée | Source | Statut | Action |
|---|---|---|---|
| Registre entreprise | `recherche-entreprises.api.gouv.fr` | ✅ **public, sans clé, sans compte**, 7 req/s | **À privilégier** |
| Alternative riche | API Sirene INSEE | Compte + clé OAuth gratuits | Seulement si champs manquants |
| TVA | VIES (UE) | ✅ public, sans clé | Aucune |
| Carte pro (loi Hoguet) | CCI France | ⚠ **pas d'API**, formulaire web, 403 anti-bot | Revue humaine — pas d'automatisation fiable |
| WHOIS domaine `.fr` | RDAP `rdap.nic.fr` | ✅ répond, public | Aucune |

### Transversal

- **GLEIF (LEI)** — public d'après la doc, mais **n'a pas répondu depuis le sandbox d'outils**
  (probable restriction réseau de l'environnement, pas un fait sur GLEIF).
  ⚠ **À retester depuis l'Edge Function réelle** avant de conclure.
- **Géocodage** — Mapbox, déjà dans la stack.

---

## 4. Schéma DB cible

### Décisions tranchées

1. **`agencies.ide` → `business_registration_number`** (nom générique, anticipe
   l'international). Renommage assumé : casse le frontend le temps d'un correctif d'imports.
2. **`legal_form` passe en FK vers une table de référence** (« option propre » retenue
   contre l'option texte libre). Ce champ pilote une décision de conformité (déclenche ou
   non la vérification UBO) — une faute de frappe a un impact réel, il ne peut pas rester
   du texte libre. Implique un menu déroulant dans les 2 UI (desktop + mobile), filtré par
   `agencies.country`.

### Piège 3NF identifié

Ne **jamais** stocker `legal_form` (« SA ») et sa catégorie dérivée
(« société de capitaux ») sur la même ligne `agencies` : la catégorie dépend de la forme
juridique, pas de la clé `agencies.id` → dépendance transitive, violation de 3NF.
D'où la table de référence.

### Tables

**`legal_forms`** (nouvelle, référence)
```
id, code            -- 'CH_SA', 'CH_SARL', 'FR_SAS', 'LI_AG'…
country             -- ISO 3166-1 alpha-2
label_fr, label_de, label_en, label_it
category            -- 'corporation' | 'partnership' | 'sole_proprietorship'
```

**`agencies`** (colonnes à ajouter)
```
legal_form_id                  FK → legal_forms.id   (remplace legal_form text)
trade_name                     -- nom commercial ; cible du matching flou
business_registration_number   -- renommage de ide
verification_status            -- 'pending' | 'auto_validated' | 'validated'
                               -- | 'manual_review' | 'rejected'
verification_score             -- numeric, cache calculé
verified_at
identity_submitted_at          -- ajout 26.07 : l'utilisateur a terminé la saisie
```

*Deux ajouts du 26.07.2026, tous deux additifs :*

**`validated`.** L'énumération initiale ne prévoyait rien pour un dossier validé par un
humain après revue : `auto_validated` mentirait sur l'origine de la décision, et c'est
précisément la distinction qu'un audit LAB regarde. `auto_validated` reste réservé au
moteur, `validated` à la décision humaine. Le moteur ne doit pas plus écraser un
`validated` qu'un `rejected` : même raison, un verdict humain ne se retourne pas seul.

**`identity_submitted_at`.** `verification_status` répond à « que dit la vérification »
et vaut `pending` par défaut dès la création de la ligne : il ne distingue pas « rien
n'a été saisi » de « saisi, en attente de traitement ». C'est pourtant cette
distinction qui pilote le gate d'onboarding. Deux faits distincts, deux colonnes.

**`agency_related_persons`** (nouvelle — identité compliance, distincte de `profiles`)
```
id, agency_id       FK → agencies.id
profile_id          FK → profiles.id, NULLABLE   -- un UBO passif n'a aucun login CRM
first_name, last_name, date_of_birth, nationality
id_document_type, id_document_number
created_at
```
*`profiles` = identité opérationnelle CRM (login, rôle métier). Ici = identité
compliance, qui peut concerner quelqu'un qui ne se connecte jamais.*

**`agency_person_roles`** (nouvelle — jonction)
```
id, related_person_id   FK → agency_related_persons.id
role                    -- 'signatory' | 'ubo'
signature_power         -- 'individual' | 'joint' | NULL  (si role='signatory')
ownership_pct           -- NULL sauf role='ubo'  (seuil 25% FATF)
pep_self_declared       -- déclaratif ≠ résultat de screening
source                  -- 'registry_officer_listing' | 'declared' | 'poa_document'
valid_from, valid_to
```
*Séparée de la table précédente pour éviter de dupliquer l'identité quand la même
personne est à la fois signataire ET UBO — cas très fréquent en petite SA (fondateur
administrateur + actionnaire majoritaire). Sans ce split : anomalie de mise à jour.*

**`agency_verification_checks`** (nouvelle — niveau entité)
```
id, agency_id       FK → agencies.id
check_type          -- 'registry_lookup' | 'vat_lookup' | 'address_geocode'
                    -- | 'domain_whois' | 'naics_code_match' | 'professional_registry'
source              -- 'zefix' | 'vies' | 'recherche-entreprises' | 'rdap' | 'mapbox' | 'manual'
weight
result              -- 'match' | 'partial' | 'mismatch' | 'unavailable' | 'pending_manual_review'
raw_response        jsonb   -- réponse brute, pour l'audit
checked_at
```

**`agency_person_verification_checks`** (nouvelle — niveau personne)
```
id, related_person_id   FK → agency_related_persons.id
check_type              -- 'id_document' | 'pep_sanctions_screening'
                        -- | 'registry_officer_match' | 'poa_document_review'
source                  -- 'dilisense' | 'registry' | 'manual'
weight, result, raw_response jsonb, checked_at
```

*Deux tables de checks plutôt qu'une seule polymorphe (`subject_type`/`subject_id`) :
une FK polymorphe interdit toute contrainte d'intégrité référentielle réelle en Postgres,
et complique les policies RLS. Deux vraies FK gardent l'intégrité.*

### Ce qui ne bouge pas

- `agencies.address/city/postal_code/country` restent inline : un seul siège par agence,
  aucune dépendance transitive.
- `agencies.verification_score` est un **cache calculé** depuis les tables de checks —
  donnée dérivée assumée pour la lecture, pas une redondance de fait indépendant.
- La décision humaine finale se logue dans `activity_events` existant, pas de table d'audit
  redondante.

### RLS

Chaque nouvelle table : policies `agency_id = (SELECT get_my_agency_id())` pour les agents,
plus un accès élargi pour les rôles super-admin qui traitent la file de revue.
⚠ La console super-admin est depuis le 25.07 une **application séparée** sur
`admin.megga.ch` (bundle `npm run build:admin`) — la file de revue manuelle y vivra,
pas dans le CRM agent.

---

## 5. Portée du renommage `ide` → `business_registration_number`

Fichiers à corriger (vérifié par grep) :

- `src/hooks/useAgencySettings.ts` — type, `select`, `update`
- `src/components/crm-sugar/settings/focus/AgencyFocusSection.tsx` — UI desktop (`RowKey`, `AG_GROUPS`)
- `src/components/crm-mobile/settings/MobileSettingsScreen.tsx` — UI mobile
- `src/types/database.ts` — types générés
- `src/i18n/locales/{fr,de,en,it}/settings.json` — clés i18n (cosmétique, non bloquant)
- Nouvelle migration (ne pas éditer rétroactivement `20260607171915`)

---

## 5bis. ⚠ AVANT DE MERGER — le piège du date-guard

Les 4 migrations sont datées **`20260726`**. `deploy.yml` n'applique que les fichiers
dont l'horodatage est `>= TODAY` (UTC). Deux conséquences :

- **Mergé le 26 juil. 2026** → elles s'appliquent normalement.
- **Mergé un jour plus tard, sans rien faire** → elles sont **sautées définitivement**
  (aucun déploiement ultérieur ne les rattrape ; il n'y a qu'une alerte
  `::warning::` dans le job, facile à manquer). Or `deploy-app.yml` n'a **pas** de
  garde-fou de date : le frontend partirait en cherchant `business_registration_number`
  et `legal_form_id`, colonnes inexistantes → **Réglages → Agence cassée durablement**,
  pas quelques minutes.

**Une des deux parades, au choix, au moment du merge :**

1. **Re-dater les 4 fichiers** au jour du merge (`git mv`, puis re-lancer
   `npm run lint:migrations`). Le dépôt l'a déjà fait deux fois en juillet 2026
   (`debfdeea`, `674e80e9`) — c'est une pratique établie ici.
2. **Les appliquer à la main** avant de merger. `deploy.yml` documente explicitement
   que l'application manuelle est le flux normal du dépôt.

**Fenêtre de coupure, quoi qu'il arrive :** les trois workflows de déploiement
(`deploy.yml` migrations+vitrine, `deploy-app.yml` CRM, `deploy-admin.yml`) se
déclenchent **en parallèle** sur le même push, sans ordre garanti entre « migration
appliquée » et « nouveau bundle en ligne ». Réglages → Agence sera donc en erreur
quelques minutes, dans un sens ou dans l'autre. C'est la conséquence assumée d'un
`RENAME COLUMN` atomique : le rendre transparent demanderait le découpage en trois
temps (ajouter la colonne + double écriture, déployer, supprimer l'ancienne plus tard),
jugé disproportionné au vu du nombre d'agences en production.

> **Mise à jour 26.07.2026 :** Thomas a confirmé qu'**aucun client n'est connecté et que
> toutes les données en base sont mock**. La fenêtre de coupure ne coûte donc rien ici,
> et aucune reprise de données n'est nécessaire nulle part dans ce chantier. Le point
> redeviendra vrai le jour où il y aura des agences réelles.

---

## 6. Prérequis avant implémentation

- [x] ~~`npm install`~~ — fait (Node 24.18 LTS installé via scoop).
- [x] ~~Validation d'exécution des migrations~~ — faite le 26 juil. 2026 :
      `supabase db reset` sur Postgres 17 local, 174 migrations appliquées à neuf.
      A révélé un vrai défaut (alias homonymes manquants, corrigé par `d4220fe2`) que
      le linter d'idempotence ne pouvait pas voir — il ne lit que du texte.
      Backfill : 13 cas vérifiés. RLS : agent simple 0 ligne / dirigeant 1 / autre
      agence 0, pondérations invisibles au dirigeant, écriture de check refusée
      (`42501`), insertion cross-agence refusée, contrainte rôle/attributs tenue.
      Figé en non-régression dans `tests/backend/agency-kyb-verification.spec.ts`
      (16 tests, dont l'assertion d'ambiguïté qui aurait attrapé le défaut seule —
      vérifiée par mutation : le défaut réintroduit fait bien échouer le test).
- [x] ~~Décisions produit du parcours~~ — prises le 26 juil. 2026 avec Thomas
      (self-serve, individuel par invitation, accès complet après saisie avec gardes
      LAB, exemption de gate limitée aux trois comptes développeurs, base mock).
      Consignées dans le [spec du parcours](superpowers/specs/2026-07-26-onboarding-kyb-design.md).
- [ ] Identifiants Zefix (CH) — demandés, en attente
- [ ] Statut API UID-Register TVA (CH/LI) — en attente
- [ ] Accès API Öffentlichkeitsregister (LI) — en attente
- [ ] Retester GLEIF depuis une Edge Function (le sandbox d'outils ne prouve rien)
- [ ] Vérifier si les Edge Functions Supabase permettent une résolution DNS, avant
      d'inscrire la présence d'enregistrements MX au barème (le RDAP ne la donne pas)

**Seule l'étape 6 du programme dépend de ces points** : les tables de checks sont
agnostiques de la source, et un check `source='manual'` se score exactement comme un
check automatique. Les étapes 0 à 5 (correctifs, gate et wizard, moteur, connecteurs
publics, file de revue) s'exécutent sans attendre aucune réponse.

---

## 7. Contraintes projet à respecter

- Migrations **idempotentes / rejouables** : la CI ré-applique les migrations datées du
  jour à chaque deploy. `ADD CONSTRAINT` seul n'est pas idempotent →
  `DROP CONSTRAINT IF EXISTS` d'abord.
- Nommage des fichiers : `YYYYMMDDHHMMSS_nom.sql` (convention réelle du dépôt — le skill
  `supabase-migration` documente `YYYYMMDD_NNN_`, c'est périmé).
- RLS obligatoire sur chaque table, jamais `USING (true)`.
- Index sur chaque colonne FK utilisée en WHERE/JOIN.
- `get_my_agency_id()` : helper SECURITY DEFINER existant, à réutiliser.
