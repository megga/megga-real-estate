# Onboarding KYB — étape 5 : la file de revue et les gardes LAB

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`.

**Goal :** donner à un humain le moyen de trancher les dossiers de vérification, et
empêcher une agence non vérifiée de poser des actes à risque en attendant.

**Architecture :** la file vit dans la **console super-admin**, application séparée sur
`admin.megga.ch` (`npm run build:admin`), pas dans le CRM agent. Les gardes, eux, vivent
dans le CRM agent, là où les actions se déclenchent.

**Conception de référence :**
[spec du parcours](../specs/2026-07-26-onboarding-kyb-design.md) §10 et §11.

---

## Pourquoi cette étape est le chemin critique

Aujourd'hui **aucune agence, d'aucun pays, ne peut être auto-validée** : deux des quatre
vétos d'entité n'ont aucun connecteur, et un véto absent ne passe pas. Voir
[le handoff §7bis](../../agency-kyb-handoff.md), où le fait est démontré en base.

La revue humaine n'est donc pas une voie de secours pour les cas douteux : c'est
**l'unique** voie. Tant que cette file n'existe pas, aucun dossier ne peut aboutir, et
une agence qui a rempli son dossier reste indéfiniment en attente sans que personne
puisse la débloquer.

---

## Global Constraints

- La console admin est une **application séparée** : entrée `index.admin.html`,
  `AdminApp`, build `npm run build:admin`, routes montées à la racine (`/compliance`, pas
  `/dashboard/compliance`). Ne mélange pas les deux bundles.
- Grammaire visuelle : pas de kit dédié, `@/components/admin/kit` n'existe pas dans ce
  dépôt. Reprend la grammaire CRM réellement en vigueur, y compris sur
  `AdminCompliancePage.tsx` (le voisin le plus proche, à lire avant d'écrire) : bentos
  `rounded-xl border border-theme-border` SANS ombre, boutons fantômes (`border
  border-theme-border text-theme-secondary`, jamais `bg-accent` plein), statuts en texte
  coloré sans fond (`text-red-500`, pas de pilule pleine), chiffres tabulaires. Voir
  [docs/design-system.md](../../design-system.md).
- Côté CRM agent : tokens de thème uniquement, boutons fantômes, pas d'ombre sur les
  bentos, pas de majuscules dans les titres.
- Toute chaîne visible via `react-i18next`, dans les **quatre** langues.
- Les trois états, chargement, vide et erreur, sur chaque surface.
- `activity_events` : `category` doit valoir `'kyc'`, `severity` dans
  `info | warn | critical`, et avec `actor_kind='system'` le champ `actor_id` **doit être
  NULL**. Ici l'acteur est un humain.
- TypeScript strict sans `any`. Apostrophes ASCII droites uniquement.
- Migrations idempotentes, datées du jour du merge. La séquence va jusqu'à
  `20260728150000`.
- Tests backend derrière `describe.skipIf(!HAS_KEYS)` : **lire le compte de tests, jamais
  le code de sortie**.

---

## Trois obstacles connus, relevés par les revues précédentes

**La RPC de recalcul est réservée au `service_role`.** L'action « relancer la
vérification » partira d'un navigateur, donc sous un jeton `authenticated`. Il faut soit
une Edge Function relais, soit un élargissement gardé par `is_super_admin()`. Ce n'est
pas un oubli, c'est un report assumé : à toi de le lever.

**Les seuils ne sont lisibles par personne dans un navigateur.**
`get_agency_verification_config()` est au `service_role` seul, alors que les **poids**,
eux, sont déjà lisibles par un super-admin. Si la file doit afficher un seuil, aligne les
seuils sur `is_super_admin()`, pas sur `authenticated`.

**La pièce d'identité reste bloquée en attente de revue, définitivement.** Aucun
prestataire automatique n'est branché, et **rien ne met jamais cette ligne à jour**. Tant
que la file ne permet pas de la résoudre, elle bloque l'auto-validation à elle seule,
même si les vétos manquants étaient comblés. Cette étape doit donner ce moyen.

---

## Task 1 : la couche de données de la file

**Files:**
- Créer : `supabase/migrations/<jour>_agency_review_queue.sql`
- Créer : `tests/backend/agency-review-queue.spec.ts`

Deux fonctions, lisibles par un super-admin et personne d'autre : la liste des dossiers à
trancher, et le détail d'un dossier.

**La liste** est triée par score croissant, les plus douteux en tête. Pas de colonne de
priorité dérivée : le tri suffit, c'est une décision de conception d'Antoine. Elle doit
faire remonter aussi les dossiers que le filet de rattrapage a abandonnés après avoir
épuisé ses tentatives, sans quoi ils resteraient invisibles.

**Le détail** rend chaque check avec son type, sa source, son résultat, sa réponse brute,
et **le poids applicable à la date du check**, pas le poids courant. C'est ce qui permet
de justifier après coup pourquoi un dossier a été tranché ainsi, et c'est la raison d'être
de la jointure temporelle du moteur. Une file qui afficherait le poids d'aujourd'hui
mentirait sur la décision d'hier.

**Tests :** un super-admin voit la file ; un utilisateur authentifié ordinaire ne voit
rien ; `anon` non plus ; le tri place bien le plus douteux en tête ; un dossier abandonné
par le filet apparaît ; le poids rendu est celui de la date du check et non le courant.

---

## Task 2 : la décision humaine

**Files:**
- Modifier : la migration de la tâche 1
- Modifier : `tests/backend/agency-review-queue.spec.ts`

Trois actions : valider, rejeter avec motif, relancer la vérification.

**Valider** pose `validated`, jamais `auto_validated` : la distinction entre décision
humaine et décision du moteur est exactement ce qu'un audit regarde. **Rejeter** pose
`rejected` et exige un motif. Le moteur ne doit écraser ni l'un ni l'autre, c'est déjà
son comportement et un test le garde.

**Relancer** appelle le moteur. C'est ici que se lève l'obstacle des droits : choisis
entre une Edge Function relais et un élargissement gardé par `is_super_admin()`, et
explique ton choix.

**Résoudre la pièce d'identité** doit être possible ici, sans quoi aucun dossier
n'aboutira jamais. Le relecteur qui a vu le document doit pouvoir dire s'il correspond ou
non à la personne déclarée.

**Chaque décision est journalisée** dans `activity_events`, avec l'identité du décideur.
Sur un dispositif LAB, une décision sans trace de son auteur ne vaut rien.

**Tests :** un super-admin valide, rejette, relance ; un utilisateur ordinaire ne peut
rien de tout cela ; un rejet sans motif est refusé ; la trace porte bien le décideur ; le
moteur relancé n'écrase pas la décision humaine.

---

## Task 3 : la file dans la console admin

**Files:**
- Créer : `src/pages/admin/AdminKybReviewPage.tsx`, hook associé
- Modifier : `src/AdminApp.tsx`, navigation de la console
- Modifier : les quatre fichiers i18n de la console

Liste et détail. Chaque check lisible par un humain qui n'a pas lu ce dépôt : le type dit
ce qui a été vérifié, la source dit qui l'a dit, le résultat dit ce qu'il en ressort, et
la réponse brute reste consultable pour qui veut vérifier.

**Ce que l'écran doit rendre évident :** pourquoi ce dossier est là. Un score faible, un
véto échoué, un véto absent faute de source, une pièce d'identité en attente : ce ne sont
pas les mêmes situations et elles n'appellent pas la même décision. Un dossier suisse
bloqué parce que le registre est injoignable n'est pas un dossier douteux.

---

## Task 4 : les gardes LAB dans le CRM agent

**Files:**
- Créer : un hook de garde
- Modifier : les surfaces concernées, les quatre fichiers i18n

Un bandeau tant que le statut n'est ni `auto_validated` ni `validated`, et le blocage des
seules actions à risque : ouvrir un dossier KYC client (`/dashboard/kyc`, edge
`kyc-screening`) et lancer une signature électronique (edge `sign-document`).

**Le blocage explique pourquoi et pointe l'état du dossier.** Il ne cache pas la
fonctionnalité : une porte fermée avec un motif lisible vaut mieux qu'un bouton absent,
qui laisse croire à un défaut.

**Le garde doit valoir côté serveur aussi.** Un blocage seulement dans l'interface se
contourne en appelant l'edge function directement. Vérifie ce que ces deux fonctions
contrôlent déjà et complète.

**La portée du garde est tranchée : garde plein.** Aucune agence ne peut ouvrir un
dossier KYC client ni lancer une signature avant qu'un humain ait validé son identité
dans la file. Aucun interrupteur, aucune exemption transitoire.

Décision de Thomas, prise en connaissance de la conséquence : puisque aucune agence ne
peut être auto-validée aujourd'hui, cela signifie que **toutes** passent par la file, et
que l'équipe MEGGA doit trancher chaque dossier avant que l'agence ne travaille. C'est la
posture de conformité que le produit revendique, et la file construite aux tâches 1 à 3
est ce qui rend ce déblocage possible.

Conséquence pour toi : l'écran bloqué doit être **excellent**. C'est le premier mur que
rencontrera chaque agence, et il doit dire sans ambiguïté ce qui se passe, ce qui est
attendu, et de qui. Un message vague ici se paiera en appels au support.

---

## Task 5 : vérification et documentation

- [ ] Suites backend, unitaire et bout en bout, en lisant les comptes de tests.
- [ ] `npm run lint:migrations`, `lint:i18n`, `i18n:parity`, `build`, `build:admin`.
- [ ] ESLint sur les seuls fichiers du chantier.
- [ ] Handoff : étape 5 à l'état fait, et **mise à jour du §7bis** si l'auto-validation
      devient atteignable.
- [ ] Cerveau système, puis `npm run ruflo:seed` après validation du JSON.
