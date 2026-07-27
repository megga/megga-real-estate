# Onboarding KYB — étape 2 : gate et wizard de saisie

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`
> pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe case à cocher.

**Goal :** permettre au dirigeant d'une agence de saisir lui-même l'identité légale de
son entreprise au premier login, et bloquer l'accès au CRM tant qu'il ne l'a pas fait.

**Architecture :** une route dédiée `/dashboard/identite` porte un wizard en cinq
étapes ; `AgentSugarLayout` y redirige tant que `agencies.identity_submitted_at` est
nul. Le wizard écrit directement dans les tables KYB sous RLS, et une RPC de soumission
valide la complétude, pose l'horodatage et journalise. Grammaire visuelle Sugar v2,
calquée sur le wizard « Créer un bien ».

**Tech stack :** React 18, TypeScript strict, Vite, React Router v6, React Query,
Supabase (RLS + RPC), Vitest (jsdom pour l'unitaire, config backend pour le SQL),
Playwright pour le parcours complet.

**Conception de référence :**
[spec du parcours](../specs/2026-07-26-onboarding-kyb-design.md) §4 à §7.

---

## Global Constraints

- **TypeScript strict, jamais `any`.**
- **Aucune couleur codée en dur.** Le wizard lit `SugarV2` (Proxy de thème) exactement
  comme `crm-sugar-wizard` : `setSugarV2Dark(dark)` au début du render du shell, puis
  `SugarV2.foo` lu au render dans chaque étape. Ne pas threader le thème en prop.
- **Boutons en style fantôme**, jamais `bg-accent` plein. Badges en texte coloré sans
  fond. Pas d'ombre sur les bentos. Pas de majuscules dans les titres.
- **Modales** toujours via `createPortal(document.body)` avec `z-[100]`.
- **i18n obligatoire, 4 langues** (fr, de, en, it). Toute chaîne visible passe par
  `useTranslation`. `npm run lint:i18n` refuse le texte en dur.
- **Prix et montants** via `formatCHF()`, jamais `.toFixed()` sur une valeur de
  formulaire.
- **Realtime**, si utilisé : nom de canal via `useId()`, sinon crash au remount.
- **RLS** sur chaque écriture ; ne jamais contourner par `service_role` côté client.
- **Fonctions SECURITY DEFINER** : `SET search_path TO 'public'`, `REVOKE` sur `anon`,
  `GRANT` explicite à `authenticated` seulement si l'utilisateur doit l'appeler.
- **`activity_events`** : `category` dans `kyc | deal | contact | bien | doc | auth |
  settings | ai` (`'compliance'` échoue), `severity` dans `info | warn | critical`,
  et avec `actor_kind='system'` le champ `actor_id` doit être NULL.
- **Migrations** idempotentes, nommées `YYYYMMDDHHMMSS_nom.sql`, datées du jour du
  merge : le pipeline saute définitivement toute migration antérieure.
- **Tests backend** derrière `describe.skipIf(!HAS_KEYS)` : lire le compte de tests,
  jamais le code de sortie.
- **Documentation** : en-tête `/** */` par fichier disant le rôle et la route, docstring
  par export, commentaires expliquant le **pourquoi**. Pas de glose ligne à ligne.

### Décisions prises pour cette étape

| Sujet | Décision |
|---|---|
| Emplacement du gate | Route dédiée `/dashboard/identite`, redirection depuis `AgentSugarLayout` |
| Grammaire visuelle | Sugar v2, calquée sur `src/components/crm-sugar-wizard` |
| Mobile | Hors périmètre. Le gate redirige, et l'écran mobile invite à terminer sur ordinateur |
| Accès après soumission | Complet, avec bandeau, et blocage des seules actions à risque LAB (étape 5) |
| Exemption | `is_super_admin()` |

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/<jour>_submit_agency_identity.sql` | RPC de soumission, garde de complétude, journalisation |
| `src/hooks/useAgencyIdentity.ts` | Lecture de l'état d'identité, écritures des personnes et rôles, appel de la RPC |
| `src/hooks/useIdentityGate.ts` | Le gate : décide si la redirection s'applique |
| `src/components/crm-sugar-identity/tokens.ts` | Données du wizard, étapes, thème (calqué sur `crm-sugar-wizard/tokens.ts`) |
| `src/components/crm-sugar-identity/IdentityShell.tsx` | Coquille, navigation, persistance, soumission |
| `src/components/crm-sugar-identity/steps/StepSignataire.tsx` | Étape 1 |
| `src/components/crm-sugar-identity/steps/StepAgence.tsx` | Étape 2 |
| `src/components/crm-sugar-identity/steps/StepBeneficiaires.tsx` | Étape 3, conditionnelle |
| `src/components/crm-sugar-identity/steps/StepPieceIdentite.tsx` | Étape 4 |
| `src/components/crm-sugar-identity/steps/StepRecapitulatif.tsx` | Étape 5 |
| `src/pages/agent/IdentitySugarPage.tsx` | Route `/dashboard/identite` |
| `src/pages/agent/IdentityMobileNotice.tsx` | Écran mobile « terminer sur ordinateur » |
| `src/i18n/locales/{fr,de,en,it}/onboarding.json` | Nouveau namespace i18n |
| `tests/backend/agency-identity-submit.spec.ts` | Tests de la RPC |
| `tests/unit/identity-gate.spec.ts` | Tests du gate |
| `tests/e2e/onboarding-identite.spec.ts` | Parcours complet |

**Le wizard de référence à imiter** est `src/components/crm-sugar-wizard/`
(`WizardShell.tsx` 464 lignes, `tokens.ts` 438, `primitives.tsx` 211). Chaque tâche qui
touche au rendu doit le lire avant d'écrire, et réutiliser ses primitives (`SgIcon`,
`SgCircleBtn`, `SgBlackPill`, `SgGhostPill`) plutôt que d'en créer de nouvelles.

### Interface partagée entre les tâches 3 à 7

`src/hooks/useAgencyIdentity.ts` est écrit à la tâche 3 puis étendu par les suivantes.
Son contrat, que toutes doivent respecter :

```ts
interface IdentityPerson {
  id: string | null            // null = pas encore enregistrée
  firstName: string
  lastName: string
  dateOfBirth: string | null   // ISO court, 'YYYY-MM-DD'
  nationality: string | null   // ISO 3166-1 alpha-2
}

interface IdentityRole {
  role: 'signatory' | 'ubo'
  signaturePower: 'individual' | 'joint' | null  // seulement si role='signatory'
  ownershipPct: number | null                    // seulement si role='ubo'
  pepSelfDeclared: boolean
}

export function useAgencyIdentity(): {
  agency: AgencySettingsData          // réutilise le type de useAgencySettings
  persons: Array<IdentityPerson & { roles: IdentityRole[] }>
  isLoading: boolean
  savePerson: (p: IdentityPerson, roles: IdentityRole[]) => Promise<string>  // renvoie l'id
  removePerson: (id: string) => Promise<void>
  submit: () => Promise<void>         // appelle submit_agency_identity()
}
```

### Écart assumé avec le format habituel des plans

Ce plan décrit les fichiers, les contrats, les comportements attendus et les tests à
écrire, mais il ne contient pas le code complet de chaque écran. C'est délibéré : le
wizard imite une référence de 1 100 lignes déjà présente dans le dépôt, et recopier son
équivalent ici produirait un document plus long que le code, périmé dès la première
divergence, et moins fiable que la référence elle-même. Chaque tâche nomme le fichier à
lire avant d'écrire. En revanche, la RPC de la tâche 1, la condition du gate de la
tâche 2 et les contrats ci-dessus sont spécifiés sans ambiguïté, car eux ne s'imitent
pas.

---

## Task 1 : RPC de soumission

**Files:**
- Créer : `supabase/migrations/<jour>_submit_agency_identity.sql`
- Créer : `tests/backend/agency-identity-submit.spec.ts`

**Interfaces:**
- Consomme : `agencies.identity_submitted_at`, `is_agency_admin()`,
  `agency_related_persons`, `agency_person_roles`.
- Produit : `public.submit_agency_identity() returns void`.

**Comportement attendu :**

1. Refuse si l'appelant n'est pas `is_agency_admin()` (erreur `42501`).
2. Refuse si l'agence n'a pas, dans cet ordre de vérification : `legal_name`,
   `legal_form_id`, `country`, et au moins une personne liée portant le rôle
   `signatory` valide (`valid_to` nul ou futur). Message d'erreur distinct par cas,
   pour que l'interface puisse ramener l'utilisateur à la bonne étape.
3. Idempotente côté métier : si `identity_submitted_at` est déjà posé, ne fait rien et
   ne journalise pas une seconde fois.
4. Pose `identity_submitted_at = now()`.
5. Journalise dans `activity_events` : `category='kyc'`, `severity='info'`,
   `actor_kind='user'`, `actor_id = auth.uid()`, `action='agency_identity_submitted'`,
   `entity_type='agency'`.
6. `REVOKE` sur `anon`, `GRANT EXECUTE` à `authenticated`.

**Tests à écrire, chacun prouvé rouge avant la migration :**

- un dirigeant dont l'agence est complète soumet, et `identity_submitted_at` est posé ;
- un second appel ne crée pas un second événement dans `activity_events` ;
- un agent simple (`role='agent'`) reçoit `42501` ;
- une agence sans `legal_name` est refusée, avec le message dédié ;
- une agence sans signataire actif est refusée, avec le message dédié ;
- l'événement journalisé porte bien `category='kyc'` (et non `'compliance'`, qui
  ferait échouer la contrainte).

Chaque test crée son agence et ses personnes via `serviceRoleClient()`, et appelle la
RPC via un client authentifié. Suivre le motif de `tests/backend/signup-provisioning.spec.ts`
pour la création d'utilisateur.

---

## Task 2 : le gate et la route

**Files:**
- Créer : `src/hooks/useIdentityGate.ts`
- Créer : `src/pages/agent/IdentitySugarPage.tsx` (coquille vide à ce stade)
- Créer : `src/pages/agent/IdentityMobileNotice.tsx`
- Modifier : `src/components/layout/AgentSugarLayout.tsx`
- Modifier : `src/App.tsx`
- Créer : `tests/unit/identity-gate.spec.ts`

**Interfaces:**
- Produit : `useIdentityGate(): { status: 'loading' | 'required' | 'exempt' | 'done' }`.

**La condition, telle qu'elle doit être :**

```
gate requis si :
      profiles.agency_id est non nul
  et  profiles.role est dans ('admin', 'manager')
  et  agencies.identity_submitted_at est nul
  et  l'utilisateur n'est pas super_admin
```

Un agent simple ne voit jamais le gate : il n'est pas celui qui engage l'entité.

**Trois garde-fous obligatoires dès cette tâche**, parce qu'un gate bloquant a déjà
causé un incident P0 en juillet 2026 (commit `c830f9a9`, « boucle onboarding ») :

1. Tant que l'état n'est pas résolu, le statut vaut `loading` et **aucune redirection
   n'est émise**. Rediriger sur un état indéterminé est exactement ce qui produit une
   boucle.
2. La route `/dashboard/identite` elle-même n'est jamais redirigée vers elle-même.
3. Un test unitaire couvre le cycle : requis, puis soumis, puis plus jamais requis.

**Écran mobile :** sous 768 px, la route rend `IdentityMobileNotice`, qui explique que
la saisie se termine sur ordinateur et n'offre aucun moyen de contourner. Utiliser le
motif `ResponsiveRoute` déjà employé partout dans `App.tsx`.

---

## Task 3 : coquille du wizard et étape 1, le signataire

**Files:**
- Créer : `src/components/crm-sugar-identity/tokens.ts`
- Créer : `src/components/crm-sugar-identity/IdentityShell.tsx`
- Créer : `src/components/crm-sugar-identity/steps/StepSignataire.tsx`
- Créer : `src/hooks/useAgencyIdentity.ts`
- **Étendre** : `src/i18n/locales/{fr,de,en,it}/onboarding.json`
- Modifier : `src/pages/agent/IdentitySugarPage.tsx`

⚠ **Les quatre fichiers i18n existent déjà**, créés par la tâche 2 avec les clés `gate.*`
du gate et de l'écran mobile, et ces clés sont couvertes par des tests. Les **étendre**,
jamais les récrire : un écrasement ferait disparaître silencieusement des chaînes déjà
validées dans les quatre langues. Le namespace est déjà câblé dans `src/i18n/index.ts`,
il n'y a rien à y ajouter.

**Avant d'écrire :** lire `src/components/crm-sugar-wizard/WizardShell.tsx` et
`tokens.ts`. Le mécanisme de thème (Proxy `SugarV2` réassigné par `setSugarV2Dark`) doit
être repris tel quel, pas réinventé. Réutiliser les primitives existantes.

**Champs de l'étape 1 :** prénom, nom, date de naissance, nationalité, pouvoir de
signature (`individual` ou `joint`).

**Écrit dans :** `agency_related_persons` (identité) et `agency_person_roles` avec
`role='signatory'`, `signature_power` renseigné, `source='declared'`.

**Persistance :** l'état du wizard est sauvegardé à chaque changement d'étape, pas
seulement à la fin. Fermer l'onglet ne doit rien perdre. Les tables KYB sont la source
de vérité ; ne pas inventer un stockage local parallèle.

---

## Task 4 : étape 2, l'agence

**Files:**
- Créer : `src/components/crm-sugar-identity/steps/StepAgence.tsx`
- Modifier : `src/hooks/useAgencyIdentity.ts`, `IdentityShell.tsx`, les 4 fichiers i18n

**Champs :** pays du siège, forme juridique, raison sociale, nom commercial, numéro de
registre, TVA, adresse, NPA, ville, canton.

**Deux dépendances d'ordre, elles ne sont pas cosmétiques :**

- Le pays du siège filtre la liste des formes juridiques. Le hook `useLegalForms(country)`
  existe déjà et fait exactement cela.
- La catégorie de la forme juridique choisie décide de l'affichage de l'étape 3.

**Écrit dans :** `agencies` (`legal_name`, `trade_name`, `legal_form_id`,
`business_registration_number`, `tva`, `address`, `postal_code`, `city`, `canton`,
`country`). Le hook `useAgencySettings` porte déjà ces colonnes en lecture et en
écriture : le réutiliser plutôt que d'écrire un second chemin.

---

## Task 5 : étape 3, les bénéficiaires effectifs

**Files:**
- Créer : `src/components/crm-sugar-identity/steps/StepBeneficiaires.tsx`
- Modifier : `IdentityShell.tsx`, `useAgencyIdentity.ts`, les 4 fichiers i18n

**Étape conditionnelle.** Elle est **sautée** quand la catégorie de la forme juridique
choisie à l'étape 2 vaut `sole_proprietorship` : dans ce cas le signataire est l'entité,
il n'y a pas de bénéficiaire tiers. C'est le rôle explicite de la colonne
`legal_forms.category`.

**Champs par personne :** prénom, nom, date de naissance, nationalité, pourcentage de
détention, déclaration d'exposition politique.

**Écrit dans :** `agency_related_persons` et `agency_person_roles` avec `role='ubo'`,
`ownership_pct` renseigné, `pep_self_declared`, `source='declared'`.

**Le seuil de 25 %** est celui du GAFI. L'interface le rappelle mais n'empêche pas de
déclarer en dessous : c'est une aide, pas une validation.

**Cas à gérer :** la même personne peut être signataire et bénéficiaire, c'est fréquent
dans une petite SA. Ne pas dupliquer son identité, ajouter un second rôle à la personne
existante. C'est précisément pourquoi le schéma sépare les deux tables.

---

## Task 6 : étape 4, la pièce d'identité

**Files:**
- Créer : `src/components/crm-sugar-identity/steps/StepPieceIdentite.tsx`
- Modifier : `IdentityShell.tsx`, `useAgencyIdentity.ts`, les 4 fichiers i18n

**Avant d'écrire :** vérifier les politiques du bucket Storage `documents` (le seul
bucket généraliste du projet, avec `property-photos` et `signed-documents`). Si aucune
politique ne couvre un préfixe réservé aux pièces d'identité de conformité, en ajouter
une par migration. Ne pas déposer des pièces d'identité dans un espace lisible par toute
l'agence : seul un dirigeant doit y accéder.

**Comportement :** téléversement recto et verso, avec aperçu et possibilité de
remplacer. Aucun prestataire de vérification automatique à ce stade, décision assumée :
tout dossier suisse partant de toute façon en revue humaine tant que le registre ne
répond pas, un prestataire de liveness n'achèterait rien aujourd'hui.

**Écrit dans :** `agency_person_verification_checks`, `check_type='id_document'`,
`source='manual'`, `result='pending_manual_review'`.

⚠ **Cette écriture ne peut pas venir du client.** Les tables de checks refusent
l'écriture à tout rôle utilisateur (`42501`), et c'est la garantie qu'un inscrit ne peut
pas fabriquer sa propre preuve de vérification. Le dépôt du fichier se fait donc côté
client dans Storage, et la ligne de check est posée par la RPC de soumission de la
tâche 1, qu'il faudra étendre pour cela. Prévoir cette extension ici, avec son test
backend.

---

## Task 7 : étape 5, récapitulatif et soumission

**Files:**
- Créer : `src/components/crm-sugar-identity/steps/StepRecapitulatif.tsx`
- Modifier : `IdentityShell.tsx`, `useAgencyIdentity.ts`, les 4 fichiers i18n

**Contenu :** relecture de tout ce qui a été saisi, avec un lien de retour vers chaque
étape ; case d'attestation d'exactitude ; bouton de soumission.

**Comportement d'erreur :** si la RPC refuse pour cause d'incomplétude, ramener
l'utilisateur à l'étape concernée avec le message correspondant. C'est pourquoi la
tâche 1 exige un message distinct par cas.

**Après succès :** rediriger vers `/dashboard`, où le bandeau de rappel de l'étape 5 du
programme prendra le relais.

---

## Task 8 : sortie de secours et parcours complet

**Files:**
- Modifier : `IdentityShell.tsx`
- Créer : `tests/e2e/onboarding-identite.spec.ts`

**La sortie « reprendre plus tard »** ramène à un écran d'attente lisible, qui explique
ce qui reste à faire et comment revenir. Elle ne ramène **jamais** vers `/dashboard`,
qui redirigerait aussitôt vers le gate : c'est la boucle de juillet 2026, reproduite à
l'identique.

**Le test de bout en bout** couvre le cycle complet : connexion, redirection vers le
gate, saisie des cinq étapes, soumission, accès au dashboard, déconnexion, reconnexion,
et absence de nouvelle redirection. C'est le seul test qui prouve que le gate ne boucle
pas.

---

## Task 9 : vérification et documentation

**Files:**
- Modifier : `docs/agency-kyb-handoff.md`, `.claude-flow/knowledge/megga-memory.seed.json`

- [ ] Suite backend complète, en lisant le compte de tests.
- [ ] `npm run test:unit`, `npm run test:e2e`.
- [ ] `npm run lint:migrations`, `npm run lint:i18n`, `npm run build`, `npm run build:admin`.
- [ ] ESLint sur les seuls fichiers du chantier : le dépôt porte une dette ESLint
      antérieure de 28 erreurs sur 14 fichiers, traitée séparément ; `npm run lint`
      global ne peut pas servir de critère ici.
- [ ] Handoff : passer l'étape 2 à l'état fait, décrire le gate et le wizard.
- [ ] Cerveau système : ajouter une entrée `megga/onboarding-gate`, puis
      `npm run ruflo:seed` après validation du JSON.

---

## Ce qui reste ouvert à la fin de ce plan

- **Le roster `super_admin`.** L'exemption passe par `is_super_admin()`, ce qui ne
  signifie « les trois développeurs » que si personne d'autre ne porte ce rôle. À
  confirmer avant merge.
- **Les gardes LAB et le bandeau** relèvent de l'étape 5 du programme, pas de celle-ci.
  Tant qu'ils n'existent pas, une agence non vérifiée a accès à tout après soumission.
- **Le mobile** reste à construire, avec son propre plan.
