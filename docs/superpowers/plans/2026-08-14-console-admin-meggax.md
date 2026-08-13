# Console super-admin → MEGGA X

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne
> suppose aucune conversation antérieure. Mesures faites le **14 août 2026** sur
> `claude/pipeline-meggax-bench-fe8d37` (après la livraison du Pipeline) ; **à
> revérifier avant de coder**, voir §2.
>
> ⚠ **Ce plan est écrit APRÈS le chantier Pipeline, et par quelqu'un qui a vu
> son plan se tromper.** Le plan Pipeline désignait le mauvais fichier comme
> « fait structurant », comptait 28 lecteurs là où il y en avait 11, annonçait
> 28 entrées de police là où il y en avait 26, et affirmait une contrainte de
> conformité qui n'avait pas d'objet. Chaque chiffre ci-dessous a donc été
> mesuré, et la §2 dit **comment**. Refaites-les quand même.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique ne remonte pas ces fiches sur une phrase générique. Les
interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** Seize formes de « garde verte pendant que l'écran est faux ». Les n° 6, 10, 13, 14 et 15 se déclenchent toutes sur ce chantier — voir §2. |
| `megga/pipeline-meggax` | Le chantier précédent, livré le 13 août. Sa méthode est celle à reprendre : banc d'abord, garde avant correctif, contrôle négatif avec substitution vérifiée. |
| `megga/console-admin-passe-ui` | La passe UI précédente sur la console — ce qu'elle a fait, et ce qu'elle a **laissé** (sa feuille le dit elle-même, voir §2). |
| `megga/console-admin-backend` | Ce que la console FAIT. ⛔ Ne pas casser une affordance en la repeignant. |
| `megga/super-admin` | Le mur d'accès : `is_super_admin()` en base, `useSuperAdminGate` en UX. Compte pour le banc (§2.6). |
| `megga/da-meggax-crm` | La direction. Contient l'arbitrage actif/donnée, rendu quatre fois. |
| `megga/graphite-dark-scale` | L'échelle que la console porte **encore**, et que le CRM a retirée le 10 août. |

Et dans la mémoire Claude (`~/.claude/projects/…/memory/`) :
`project_admin_console_modal_theme_trap` — ⛔ **le piège le plus contre-intuitif
du périmètre**, détaillé en §2.5.

Lire aussi `CLAUDE.md` §3 en entier.

---

## §1 — Le périmètre, dérivé du ROUTAGE

⛔ **Ne pas partir du nom des dossiers, NI de la description du design.** Ce
périmètre-ci est dérivé de `src/App.tsx:517` et de
`AdminConsoleRoutes.tsx` / `AdminShell.tsx`.

```
/dashboard/admin/*  → AdminConsoleRoute      (useSuperAdminGate, UX seule)
                        → AdminConsoleRoutes
                            → AdminShell     (pose .megga-admin-console + data-admin-dark)
                            → 19 pages lazy
```

### ⚠ LE RAIL RÉEL N'EST PAS CELUI QU'ON DÉCRIT — 18 entrées, 5 groupes

Relevé dans `AdminShell.tsx`, groupe par groupe. La description de référence du
design annonce **12 entrées en 6 groupes** ; le code en porte **18 en 5**. Ce
n'est pas une erreur de la description : la console a **grandi** depuis, et six
entrées n'y figurent pas. Vérifier ce tableau avant de chiffrer quoi que ce soit.

| Groupe (i18n) | Entrées | Route |
|---|---|---|
| **Pilotage** | Live · Vue d'ensemble | `/live` · `(index)` |
| **Clients** | Agences · Utilisateurs · **Utilisateurs finaux** · **Modération** · **Appels d'onboarding** | `/agencies` `/users` `/end-users` `/moderation` `/onboarding-calls` |
| **Revenus** | Plans | `/plans` |
| **Opérations** | Monitoring · Sécurité · **Conformité** · **Revue KYB** | `/monitoring` `/security` `/compliance` `/kyb-review` |
| **Produit & IA** | Diffusion · **Feature flags** · Satisfaction · **Autonomie** · **Apprentissage** · **Usage des outils** | `/changelog` `/feature-flags` `/nps` `/autonomy` `/learning` `/tool-usage` |

**En gras : les six entrées absentes de la description.**

Trois écarts mesurés, à ne pas reporter dans le chantier :

1. ⛔ **Il n'y a pas de groupe « Contenu ».** « Diffusion » (`/changelog`,
   `AdminCommunicationPage`) est rangée dans **Produit & IA**. Le mot
   « Diffusion » n'existe ailleurs que comme famille d'audit et comme terme des
   annonces.
2. ⛔ **Les groupes s'appellent « Opérations » et « Produit & IA »**, pas
   « Exploitation » et « Produit ».
3. ⛔ **La Satisfaction (NPS) n'est PAS un « Bientôt disponible ».**
   `AdminNpsPage` fait 255 lignes, lit `useAdminNps()`, rend des réponses, des
   notes 1-5 et un `AdminEmpty`. C'est une page VIVANTE avec un état vide — la
   mention « bientôt disponible » décrit l'état de la DONNÉE, pas celui de
   l'écran. ⚠ La traiter comme un placeholder la laisserait hors du chantier
   avec ses 14 marqueurs.

### Les deux surfaces qui ne sont pas des entrées de rail

- **la fiche agence** — `agencies/:id` → `AdminAgencyDetailPage` (458 l.,
  **38 marqueurs**, la 2ᵉ plus lourde) ;
- **la modale de diagnostic KYC** — `KycLinkDiagnosticModal.tsx`, ouverte depuis
  le pied de Vue d'ensemble. ⚠ Elle est PORTÉE : elle relève du piège de modale
  (§2.5), et c'est en la livrant qu'il a été mesuré.

⚠ Ne pas confondre cette modale avec `/kyb-review` (`AdminKybReviewPage`), qui
est une entrée de rail à part entière — et le fait structurant n° 1.

**18 entrées de rail + la fiche agence = 19 fichiers de page.** Le compte tombe
juste ; c'est le rail qui était mal décrit, pas le dossier.

| Zone | Fichiers | Lignes | Marqueurs |
|---|---|---|---|
| `pages/admin` | 19 | 8 116 | **303** |
| `components/admin` (racine) | 21 | 3 923 | **65** |
| `components/admin/kit` | 3 | 800 | **18** |
| `styles/admin-console.css` | 1 | 180 | *(non mesurable par le cliquet — §2.2)* |
| **Total** | **44** | **13 019** | **≈ 386** |

⚠ **C'est le double du chantier Pipeline** (196 marqueurs). Prévoir le temps en
conséquence, ou découper (§3.3).

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé**.

### ✅ La bonne nouvelle, et elle change l'ordre des lots

**Les couleurs sont DÉJÀ MEGGA X sur 18 pages sur 19.** `useAdminSugar()`
(`src/hooks/useAdminSugar.ts:83`) rend `crmSugarPalette(dark)` — qui, depuis le
10 août, **est** `mxCrmPalette(dark)`. Les 18 pages en style inline en
descendent.

⛔ **Ne pas chercher de palette parallèle par la FORME : il n'y en a aucune.**
Vérifié — zéro objet littéral de ≥ 5 couleurs dans les 44 fichiers. C'est
l'inverse du Pipeline, où il y en avait trois. ⚠ Mais la recherche par la forme
**a quand même raté la vraie palette**, parce qu'ici elle n'est ni un littéral
ni une fonction nommée `palette` : c'est un **hook**. Chercher `use*Sugar`,
`use*Theme`, `use*Palette` autant que les objets.

Ce qui reste en couleur tient en deux endroits :

```
adminSurfaces(dark)   5 clés écrites à la main (useAdminSugar.ts:38)
AdminTones            8 hex écrits à la main (ok/warn/err/info/cyan…)
```

### ⛔ FAIT STRUCTURANT n° 1 — la plus grosse page est INVISIBLE aux deux gardes

`AdminKybReviewPage` : **1 503 lignes**, la plus grosse page de la console.
Elle rend **0 marqueur** — et c'est un silence, pas un verdict.

```
className :  154        style={{ :  0
```

Le cliquet de grammaire ne lit que les styles **EN LIGNE**. C'est la sixième
forme de `megga/gardes-vacuites`, celle qui avait déjà fait conclure à tort que
`ContactImportPage` était propre. ⚠ Et c'est le SEUL fichier du périmètre dans
ce cas : les 43 autres portent 872 styles en ligne contre 262 `className`.

Elle est peinte par des classes sémantiques — `text-theme-tertiary` (30),
`text-theme-primary` (21), `border-theme-border` (21), `bg-theme-card` — c'est-à-dire
par les variables que `admin-console.css` repointe. Donc :

### ⛔ FAIT STRUCTURANT n° 2 — `admin-console.css` est un second système de jetons dans un LANGAGE qu'aucune garde ne lit

180 lignes, **28 variables**, 17 hex distincts. Dixième forme des gardes
vacuités, exactement celle d'`atelier.css` sur le Matching.

Vérifié : `graphite-scale.spec.ts` **n'ouvre aucun `.css`** (0 occurrence de
`readFileSync`), `megga-x-grammar` ne lit que les `.tsx`, et le mot `admin`
apparaît **0 fois** dans ses `ZONES`.

⛔ **Et ses valeurs sont l'échelle GRAPHITE** — `#12161C`, `#161A21`, `#1A1D26`,
`#1D212A`, `#252A36`, c'est-à-dire `CRM_GRAPHITE.s0…s4`, l'échelle que
`CLAUDE.md` §3 déclare retirée du CRM le 10 août 2026.

⚠ **Sa propre docstring dit tout, et c'est ce qui la rend dure à voir :**

> « Les valeurs viennent de `CRM_TOKENS` […] Elles y sont **dupliquées à la
> main** parce que le CSS ne lit pas le JS ; toute évolution de tokens.ts doit
> être reportée ici. »
> « ⚠ Le CSS ne suit **PAS** la teinte choisie par l'agent : il est figé sur le
> défaut. »
> « Ce qui reste à faire dans les lots suivants : les badges à fond coloré, les
> bentos séparés par bordure plutôt que par ombre, et l'iconographie lucide. »

Un fichier qui énonce lui-même sa norme et son arriéré se relit **moins** qu'un
fichier négligé — il a l'air tenu. C'est la forme la plus dure de la n° 10, et
elle est ici sous sa version la plus franche : le fichier **demande** qu'on
reporte les évolutions, et personne ne l'a fait depuis le 10 août.

### ⛔ FAIT STRUCTURANT n° 3 — un TROISIÈME interrupteur de thème

| Clé / attribut | Qui l'écrit | Qui le lit |
|---|---|---|
| `megga.sugar.dark` | le CRM et la console | `useAdminTheme`, `crmSugarPalette` |
| `data-theme` (sur `<html>`) | `AdminThemeProvider`, et le provider du CRM | `globals.css`, **les surfaces PORTÉES** |
| `data-admin-dark` | `AdminShell`, sur le cadre | `admin-console.css` **seul** |

⚠ Les trois doivent rester d'accord. `AdminThemeProvider` **restaure**
`data-theme` en sortant, sans quoi le CRM héritait du réglage de la console.

### ⛔ FAIT STRUCTURANT n° 4 — le piège de modale, que rien ne voit

`project_admin_console_modal_theme_trap`, mesuré le 3 août :

> Poser `className="megga-admin-console"` sur une modale portée la force au
> **BLANC** sur une console sombre — la feuille redéfinit les couleurs en clair
> et ne repasse au sombre que sur `[data-admin-dark='true']`, attribut que
> `ModalProps` n'a **aucun moyen** de transmettre (pas de rest spread).

✅ Le bon geste : **ne PAS poser la classe**. ⚠ Et le piège est
contre-intuitif : *une revue le recommande spontanément*, parce que scoper la
modale « pour lui donner l'anneau de focus de la console » est un raisonnement
juste qui produit une régression visible. **Aucune porte ne le voit** — ni
`tsc`, ni lint, ni les tests, ni l'e2e. Seule une capture en sombre le montre.

Quatre surfaces portées à vérifier : `AdminSearchDialog`, `UserDrawer`,
`AnnouncementFormModal`, et une dans `AdminKybReviewPage`.

### Répartition des ≈ 386 marqueurs

| | capitales | graisses ≥700 | interlettrage | **tailles** | gris-bleu | balise |
|---|---|---|---|---|---|---|
| `pages/admin` | 6 | 76 | 5 | **208** | 8 | 0 |
| `components/admin` | 4 | 45 | 4 | 0 | **11** | 1 |
| `kit` | 0 | 13 | 0 | 2 | 2 | 0 |

⚠ **Les deux dettes sont SÉPARÉES, et c'est la même leçon que sur le Pipeline
mais dans l'autre sens** : les pages portent les **tailles** (208 sur 209), les
composants portent les **graisses** (45 sur 134) et le **gris-bleu**. Ne pas
appliquer le même geste aux deux zones.

Six pages concentrent 60 % des marqueurs :
`AdminDashboardPage` (56), `AdminAgencyDetailPage` (38), `AdminPlansPage` (31),
`AdminMonitoringPage` (25), `AdminCompliancePage` (23), `AdminSecurityAuditPage` (21).

### Le gris-bleu slate-900 revient — septième dossier

`rgba(15,23,42,…)` (B−R = 27) est dans **16 fichiers** du périmètre, plus 3
occurrences dans `useAdminSugar` (le filet et deux ombres) et 1 dans la feuille.

⚠ **Il entre TOUJOURS par une fraction d'opacité** — c'est la leçon du Pipeline,
où il avait onze exemplaires tous en `rgba(15,23,42,0.0xx)`. Personne ne relit
un alpha en cherchant une couleur. `sgVoileEncre(dark, alpha)`
(`crm-sugar/tokens.ts`) existe depuis le 13 août et nomme ce rôle.

### ⚠ Trois limites du terrain, à connaître avant de promettre un écran

1. **Il n'y a AUCUN banc.** `src/pages/dev/` n'a rien pour la console, et il n'y
   a aucune route `/dev/admin`. La console est montée **sous** `/dashboard/*`,
   donc `ProtectedRoute` frappe AVANT `useSuperAdminGate` : sans session c'est
   `window.location.replace('https://megga.ch/login')` — une redirection
   **absolue**, on relit `main` en croyant regarder localhost.
   ⚠ Et un second mur derrière : `useSuperAdminGate` rend
   `<Navigate to="/dashboard" replace />`. **Deux gates, pas un.**
2. **L'accent violet n'est lu que par 2 fichiers.** `--color-admin-accent`
   (`139 92 246` = `#8B5CF6`) sert l'anneau de focus et `tones.accent`. Comme
   sur le Matching, où `sp.accent` n'était lu que 16 fois : **repeindre
   l'accent ne se VOIT pas**, et c'est une décision de sens, pas de teinte (§3.2).
3. **`AdminKybReviewPage` fait 1 503 lignes à elle seule** — 18 % du périmètre
   en lignes. Elle se traite à part, quel que soit le découpage.

---

## §3 — Les questions à trancher AVANT de coder

✅ **Les trois sont TRANCHÉES le 14 août 2026.** Elles restent écrites avec
leurs options, parce que le raisonnement qui a mené à chacune compte autant que
la réponse — et parce qu'une décision dont on a perdu le motif se rouvre.

### 1. ✅ TRANCHÉE — `AdminKybReviewPage` passe au style en ligne

**Décision Julien, 14 août 2026.** Les 154 `className` deviennent des styles en
ligne nourris par `useAdminSugar()`, comme les 18 autres pages. La console
n'aura plus qu'une grammaire, et la page rejoint le cliquet.

⚠ Ce que la décision coûte, à accepter d'emblée : **1 503 lignes**, la plus
grosse page du périmètre, et elle rend aujourd'hui **0 marqueur**. Après
migration elle en portera — c'est le but : ils deviennent VISIBLES. Ne pas
s'alarmer de voir le total du chantier monter au lot 3.

⚠ Et un risque propre à cette migration : les classes sémantiques
(`text-theme-tertiary`, `bg-theme-card`…) sont peintes par `admin-console.css`.
La migrer AVANT le lot 2 la ferait passer de Graphite à MEGGA X d'un coup, sans
qu'on sache lequel des deux gestes a changé quoi. **La migrer APRÈS le lot 2**,
quand la feuille est déjà reciblée : les deux sources auront alors la même
valeur, et le diff visuel sera nul. C'est la seule façon de la vérifier.

### 2. ✅ TRANCHÉE — le violet reste au RAIL, le reste passe à l'accent

**Décision Julien, 14 août 2026 : « garde le violet pour le rail ».** Le violet
`#8B5CF6` dit *tu es dans la console* ; il ne décore pas. Décliné site par site,
comme les sept `--black` du Matching — il n'y en a que cinq :

| Site | Rôle | Décision |
|---|---|---|
| `AdminShell.tsx:131` — pastille 7×7 | repère de contexte | **violet** |
| `AdminShell.tsx:134` — badge « ADMIN » | repère de contexte | **violet** |
| `AdminShell.tsx:321` — titre / lien racine | repère de contexte | **violet** |
| `adminKit.tsx:136` — ton `'accent'` du kit | teinte offerte à N composants, pas le rail | **`#424bfb`** |
| `admin-console.css:129` — anneau de focus | marque l'élément ACTIF | **`#424bfb`** |

⚠ **L'anneau de focus est le seul des cinq que je re-soumettrais à l'écran.**
La règle du 10 août dit que l'élément ACTIF porte `#424bfb`, et un anneau de
focus marque bien l'actif — mais c'est aussi le chrome de la console, et le
passer au bleu la rend indiscernable du CRM au clavier. Le plan applique la
règle ; **à confirmer sur une capture**, pas sur un raisonnement.

⛔ Et ne pas y toucher sans relire `project_sugar_outline_none_a11y_trap` :
c'est `outline: none` qui avait privé le rail, ⌘K et les listes de tout repère
de focus au clavier. On change la COULEUR de l'anneau, jamais son existence.

⚠ Noter que la console MÉLANGE déjà les deux accents : `AdminShell.tsx:283`
peint le focus de la recherche avec `sp.accent` (le bleu MEGGA X), pas avec le
violet. Le chantier ne crée donc pas la cohabitation — il la rend lisible.

### 3. ✅ TRANCHÉE — le banc couvre les 19 pages

**Décision Julien, 14 août 2026 : « on doit faire toutes les pages de la console
admin ».** Le banc couvre donc les **18 entrées de rail + la fiche agence**, les
**4 surfaces portées** et les **2 thèmes**. Pas de découpage par volume.

⛔ Ce que cela implique, et qu'il faut accepter d'emblée : le banc est le plus
gros de tous ceux du dépôt. `/dev/matching-atelier` montait 2 pages,
`/dev/pipeline` en monte 2 ; celui-ci en monte 19. Prévoir que le Lot 0 soit
**le lot le plus long du chantier**, pas une formalité d'ouverture.

⚠ Deux économies possibles, à MESURER avant de les supposer :
- si les pages ne sont que des compositions du **kit** (`AdminPage`,
  `adminKit`), le banc peut monter la coquille une fois et les pages par un
  slot — c'est l'idiome du pager Matching ;
- les 18 pages passent toutes par `AdminConsoleRoutes` : un seul point
  d'injection peut suffire, au lieu de 19 substitutions.

⛔ Dans tous les cas le banc doit couvrir **le sombre** et **les surfaces
portées** : c'est là que vit le piège de modale, et c'est la seule chose qui le
montre.

---

## §4 — Les lots

### Lot 0 — Voir l'écran (à faire EN PREMIER)

1. Banc permanent `/dev/admin`, sur l'idiome de `/dev/pipeline` : monter les
   pages **réelles** par un slot, jamais une copie.
2. ⛔ **Deux gates à franchir, pas un** : `ProtectedRoute` (absolu, vers la
   production) puis `useSuperAdminGate`. Le banc doit monter `AdminShell` +
   `AdminConsoleRoutes` **hors** de la route protégée.
3. ⛔ **Intercepter toute navigation.** Le banc du Pipeline a livré ce défaut :
   un clic sur une carte le déposait sur `megga.ch`. Point de sortie unique,
   `onNavigate`, dès la première version.
4. Les surfaces portées **en sombre** — c'est le seul instrument qui voit le
   piège de modale.
5. ⚠ **Vérifier le `cwd` du serveur de dev avant toute mesure** :
   ```bash
   lsof -a -p "$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t | head -1)" -d cwd -Fn
   ```
6. ⚠ Le serveur lancé depuis une session Claude est **fauché à la fin du tour**.

### Lot 1 — Contraste (le plus grave, le moins cher)

Sonde à composition alpha sur le banc, **dans les deux thèmes**, avant tout
correctif. Attendus d'après les chantiers précédents :

- les 8 `AdminTones` en **encre** et en **aplat** — deux rôles, deux mesures.
  Le Matching y a trouvé sa pastille à 4,37:1, le Pipeline son CTA désactivé à
  1,95:1 ;
- ⚠ **les états DÉSACTIVÉS** : ni la sonde de rendu ni les gardes de palette ne
  les voient (le bouton n'est désactivé qu'avant saisie) ;
- ⚠ **`err`/`ok`/`warn` doivent être NOMMÉS à la garde**. Sur le Pipeline, un
  vert à 3,77:1 a échappé entièrement au lot de contraste parce que la liste
  d'encres ne connaissait que `ink`/`soft`/`muted` ;
- ⚠ les pièges de sonde (f) et (g) : volet masqué = transition gelée, texte sur
  image = fond non mesurable.

Garde écrite **AVANT** le correctif, éprouvée par **contrôle négatif**.

### Lot 2 — `admin-console.css` et le troisième interrupteur

1. Recibler les 28 variables sur MEGGA X — ⛔ **c'est là que Graphite meurt**.
2. ⚠ Vérifier le rayonnement sur `AdminKybReviewPage` **à chaque étape** : c'est
   sa seule source de couleur.
3. Trancher `data-admin-dark` : le garder (et le documenter comme le seul
   lecteur de la feuille) ou l'aligner sur `data-theme`. ⛔ Ne pas y toucher
   sans relire pourquoi il existe — la feuille explique que deux providers se
   disputaient `data-theme` et que celui du CRM gagnait.
4. Écrire une garde qui **ouvre le `.css`**, sur le modèle de
   `matching-atelier-css.spec.ts` : chaque valeur est un barreau MEGGA X ou une
   teinte sémantique **nommée**.

### Lot 3 — Les pages (303 marqueurs, plus celles qu'AdminKybReview révélera)

⛔ **APRÈS le lot 2, et ce n'est pas un confort** — voir §3.1 : migrer
`AdminKybReviewPage` avant que la feuille soit reciblée la ferait passer de
Graphite à MEGGA X en même temps qu'elle change de grammaire, et on ne saurait
pas lequel des deux gestes a changé quoi.

Dette de **taille** (208). Règle établie et réutilisable : **barreau le plus
proche, égalité vers le bas** ; sous le plancher de l'échelle (11 px) on monte.
Les six pages lourdes d'abord.

Coût variable selon la décision §3.1.

### Lot 4 — Les composants et le kit (83 marqueurs)

Dette de **graisse** (58) et le **gris-bleu** (13). Les tailles sont déjà
tokenisées, comme sur le dossier du Pipeline.

### Lot 5 — Les gardes, et c'est le livrable le plus durable

1. Entrer `components/admin`, `components/admin/kit` et `pages/admin` dans
   `megga-x-grammar.spec.ts`.
   ⚠ **Ajouter les zones à la liste ACQUISE en même temps** — le cliquet du
   dépôt a laissé une page en sortir en silence pendant quatre chantiers
   (n° 15).
2. Une garde de palette sur `admin-console.css` (Lot 2, point 4).
3. Sortir `AdminShell.tsx` et `UserDrawer.tsx` de `POLICES_ASSUMEES` : **20 → 18**.
   ⚠ Recompter avant de l'annoncer — le plan Pipeline disait 28, il y en avait 26.
4. ⛔ Sans ça, tout le reste peut se défaire au premier commit suivant sans
   qu'une porte bouge.

---

## §5 — Portes

```bash
npx tsc -b                            # 0 erreur
npx eslint src tests --ext .ts,.tsx   # 0 erreur (139 warnings = référence)
npx vitest run                        # 2071 tests + ceux ajoutés
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

Plus, propre à ce chantier :
- Le banc rejoué **en clair ET en sombre**, captures à l'appui, avant de commiter.
- ⛔ **Les quatre surfaces PORTÉES ouvertes en sombre** — aucune porte
  automatique ne voit le piège de modale.
- `POLICES_ASSUMEES` descendu à 18.
- ⚠ Un **contrôle négatif** par clause de garde, avec la substitution **vérifiée
  avant lecture**, et sur **la ligne visée** — un témoin qui confirme qu'*une*
  substitution a eu lieu, pas *celle-là*, rend un faux vert. Un essai dont la
  commande échoue se rapporte **nul**, jamais vert.

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche pas au backend de la console** : `is_super_admin()`,
  `_shared/require-super-admin.ts`, l'impersonation audit-first,
  `admin_console_entered`. C'est un chantier de rendu.
- ⛔ **Il ne préfixe rien sans `ADMIN_CONSOLE_PATH`.** Une cible nue tombe sur
  le 404 du CRM. Gardes existantes : `admin-console-paths.spec.ts`,
  `redirects-guard.spec.ts`.
- **Il ne remet pas le 2FA** (retiré, #873) et ne touche pas au mur d'accès.
- **Il ne renomme pas `useAdminSugar`.** Le nom a survécu à la direction qu'il
  servait ; le renommer est un geste lexical à part — même arbitrage que
  `crmSugarPalette`.

---

## §7 — Après la livraison

1. **Mettre le cerveau à jour** — sinon il se périme :
   - `megga/console-admin-passe-ui` devient du passé pour l'apparence ; le dire.
   - Créer `megga/console-admin-meggax` sur le modèle de `megga/pipeline-meggax`.
   - Compléter `megga/gardes-vacuites` de ce que ce chantier aura trouvé.
   - `npm run ruflo:seed`, puis vérifier **par `memory get -k`**, jamais par
     `search`.
   - ⚠ Le seed vit dans le **checkout**, pas dans la base : reseeder depuis le
     worktree où l'on travaille.
2. **Surveiller la CI** avant de merger.
