# La face publique en MEGGA X — le CRM est fini, il reste ce que le client voit

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne suppose
> aucune conversation antérieure. Mesures faites le **15 août 2026**, après le
> chantier « Analytics en MEGGA X » (5 lots) et le passage du Pipeline en feuille
> continue, tous deux sur la PR #1205.
> **À revérifier avant de coder — voir §2.**
>
> ### ⛔ AVANT TOUT : la branche, et le piège qui l'accompagne
>
> | Nom | Ce que c'est |
> |---|---|
> | `origin/claude/pipeline-meggax-bench-fe8d37` | **la tête de la PR #1205** — c'est là qu'on pousse |
> | `claude/analytics-meggax-design-381ad2` | la branche LOCALE du worktree `analytics-meggax-design-381ad2`, **sans amont** |
> | `claude/pipeline-meggax-bench-fe8d37` (locale) | ⛔ **piège : périmée**, sortie dans un AUTRE worktree |
>
> ⛔ **Ne pas faire `git checkout claude/pipeline-meggax-bench-fe8d37`.** La locale
> de ce nom est la troisième ligne. Rester dans le worktree courant.
>
> La poussée est **explicite** — la branche d'ici n'a pas d'amont, et un `git push`
> nu ne créerait qu'une branche de plus, sans PR, sans CI :
>
> ```bash
> git push origin HEAD:claude/pipeline-meggax-bench-fe8d37
> ```
>
> Vérifier AVANT de commencer que la tête d'`origin` est bien un ancêtre du HEAD
> local (`git merge-base --is-ancestor origin/claude/pipeline-meggax-bench-fe8d37 HEAD`).
> ⚠ D'autres sessions poussent sur cette branche : **se rebaser**, jamais forcer.
>
> ⚠ **Vérifier le `cwd` du serveur de dev avant toute mesure à l'écran.** Trois
> `vite` tournent en permanence sur cette machine et occupent 5173/5174 pour
> d'AUTRES worktrees. `preview_start` prend un port libre ; confirmer son `cwd` :
> ```bash
> P=$(lsof -nP -iTCP:<port> -sTCP:LISTEN -t | head -1); lsof -a -p "$P" -d cwd -Fn | grep ^n
> ```

---

## §0 — À lire AVANT, par clé exacte

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** 44 formes de « garde verte pendant que l'écran est faux ». Les n° **15**, **31**, **38**, **40**, **41**, **42** et **44** décident de ce chantier. |
| `megga/analytics-meggax-design` | Le chantier de la veille : sa méthode est celle à reprendre, et il documente le piège « la description ne vaut pas le routage ». |
| `megga/kyc-meggax-design` | ⚠ Il a rencontré `kyc-magic-link` et l'a laissé de côté **en le nommant** — lire pourquoi avant de le rouvrir. |
| `megga/da-meggax-crm` | La direction, l'arbitrage actif/donnée rendu quatre fois, la règle vive/foncée, et l'échelle qui n'est pas régulière dans sa moitié claire. |
| `megga/pipeline-meggax` | La feuille continue, et le critère « ce que l'écart PORTE ». |

⚠ `memory get` rend une table plafonnée à **64 Kio** et tronque **sans le dire**.
L'oracle du contenu est SQL, et le seed vit **dans le checkout** :

```bash
sqlite3 .swarm/memory.db "SELECT LENGTH(content), content LIKE '%maChaîne%' FROM memory_entries WHERE key='megga/gardes-vacuites';"
```

Lire aussi `CLAUDE.md` §3 en entier.

---

## §1 — Le périmètre, dérivé du ROUTAGE et du CLIQUET

⛔ **Le CRM agent est FINI.** Sur les 47 pages montées dans `App.tsx`, 23 sont
sous cliquet, et **aucune page `/pages/agent` routée n'a de marqueur**. Ce qui
reste est **entièrement sur la face publique**.

⛔ **ET LE PLUS GROS MORCEAU N'EST PAS UNE PAGE.** `KycPublicPage.tsx` rend
**0 marqueur** — et monte une zone qui en porte **sept clauses**. C'est le piège
exact que le plan du KYC avait rencontré (`KycExportPage` propre, `kyc-report/`
à 104 marqueurs) : **grouper par DOSSIER fait rater le périmètre**.

| Face | Chemin | Lignes | Clauses rouges | Monté par |
|---|---|---|---|---|
| **zone partagée** | `src/components/kyc-magic-link/` | **1 993** | **7** | `KycPublicPage` + `AppointmentManagePage` |
| page | `src/pages/public/BuyerReceptionPage.tsx` | 369 | **7** | autonome (un seul import : un hook) |
| page | `src/pages/public/AppointmentManagePage.tsx` | 244 | **2** | — |
| page | `src/pages/public/AcceptInvitePage.tsx` | 168 | **1** | — |

**Total : 2 774 lignes** (`wc -l`, tous fichiers des zones citées ; `MlkScreens.tsx` en pèse 1 008 à lui seul).

### Les clauses qui rougissent, nommément

| Cible | Clauses |
|---|---|
| `kyc-magic-link/` | micro-capitale · graisse > 600 · graisse héritée du preflight · interlettrage · tailles hors échelle · **noir Sugar** · **gris-bleu slate-900** |
| `BuyerReceptionPage` | les sept mêmes, plus **élément cliquable peint en encre** |
| `AppointmentManagePage` | graisse > 600 · tailles hors échelle |
| `AcceptInvitePage` | graisse héritée du preflight |

Fichiers cités dans `kyc-magic-link/` : `MlkScreens.tsx`, `MlkBooking.tsx`,
`MlkPrimitives.tsx`, `MlkSlotPicker.tsx`.

**Commandes qui régénèrent ce tableau :**

```bash
grep -oE "root: '[^']+'" tests/unit/megga-x-grammar.spec.ts | sort -u
grep -oE "^const \w+ = lazy\(\(\) => import\('@/pages/[^']+'\)\)" src/App.tsx
sed -n '/^const PAGES = new Set/,/^\])/p' tests/unit/megga-x-grammar.spec.ts
```

⚠ Pour mesurer une cible HORS cliquet, ne pas l'ajouter à `PAGES` (une clause
refuse qu'on y touche sans l'inscrire dans `PAGES_ACQUISES`). Ajouter une
**racine temporaire** avec un `keep`, lancer le spec, lire les échecs, restaurer
par COPIE :

```js
{ root: 'src/components/kyc-magic-link', keep: (n) => /\.tsx?$/.test(n) },
```

### Les 14 pages PROPRES mais NON GARDÉES

`IdentitySugarPage`, `IdentityMobileNotice`, `OnboardingCallPage`,
`WizardSugarV2Page`, `ExternalListingDetailPage`, `KycPublicPage`,
`VisitManagePage`, `VisitFeedbackPage`, `OnboardingCallManagePage`,
`AuthCallbackPage`, `ResetPasswordPage`, `KycReportRenderPage`, `PrivacyPage`,
`NotFoundPage`.

⚠ Elles rendent 0 marqueur **aujourd'hui**. Les entrer au cliquet est ce qui
empêche qu'elles cessent de l'être — c'est l'argument déjà écrit dans le cliquet
pour `MatchingAtelierPage` et `OfferModalSugarV3Page`. Bon marché, à faire en
dernier, quand elles ne bougeront plus.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé.**

### ⛔ FAIT n° 1 — `MLK` est la prochaine `AX`

`src/components/kyc-magic-link/mlkTokens.ts` porte un objet `MLK` de **15 clés**,
dont **12 littéraux hexadécimaux**, qui **ne descend de rien** (zéro `MXC_COLOR`,
zéro `mxCrmPalette`) et que **AUCUNE spec ne garde**.

C'est la forme **n° 38** en plein — « l'objet de jetons partagé n'a de garde
nulle part » — et c'est le troisième exemplaire après `SugarV3` et `AX`. Les
neuf specs de contraste gardent chacune une ZONE ; un objet de jetons n'EST pas
une zone.

⚠ Il alimente **deux surfaces publiques**, donc le corriger repeint les deux.
C'est exactement pourquoi le chantier KYC l'avait laissé de côté **en le
nommant** plutôt qu'en le touchant depuis un lot qui ne regardait que le KYC.

### ⛔ FAIT n° 2 — le noir de Sugar et le gris-bleu survivent ici

Deux clauses que le CRM ne fait plus rougir nulle part rougissent encore sur la
face publique : **`aucun noir Sugar ne subsiste`** et **`aucun gris-bleu
slate-900 hors inventaire`**. Elles tombent sur `kyc-magic-link/` ET sur
`BuyerReceptionPage`.

⚠ Ce sont les deux marqueurs de la direction RETIRÉE. Leur présence dit que
cette face n'a jamais été touchée par la bascule du 10 août — pas qu'elle a
dérivé depuis.

### ⛔ FAIT n° 3 — `BuyerReceptionPage` est autonome, et c'est une chance

Son seul import de premier niveau est `@/hooks/useBuyerReception`. Aucune zone
partagée, aucun composant commun : **369 lignes qui ne repeignent qu'elles-mêmes**.
Elle porte pourtant sept clauses, dont **`aucun élément cliquable peint en
encre`** — la seule des quatre cibles à l'avoir.

⚠ Cette clause a un historique de FAUX POSITIF (forme n° 25 : elle avait envoyé
repeindre un marqueur d'allure d'`AxDashboard` parce qu'un bouton vivait plus
bas). **Lire les sites avant de les corriger**, et vérifier que le `onClick`
appartient bien à l'élément peint.

### ⛔ FAIT n° 4 — la face publique n'a pas de thème sombre

À vérifier avant de coder : ces pages sont-elles mono-thème ? Si oui, la garde
de contraste qu'on écrira doit le DIRE et rougir le jour où l'une gagne une
branche sombre — comme `sugar-v3-contraste.spec.ts` le fait pour `SugarV3`.
Sinon elle ne mesurerait que la moitié de la vérité.

### Ce que le terrain offre déjà, et qu'il ne faut pas reconstruire

- **`sugar-v3-contraste.spec.ts`** et **`analytics-contraste.spec.ts`** donnent
  la FORME d'une garde d'objet de jetons : inventaire des rôles **confronté à la
  source par la LIAISON**, refus de toute couleur illisible, clause qui dit
  combien de thèmes on mesure, couples mesurés dans les DEUX sens.
- **`sgVoileEncre`**, **`encreSur`**, **`mxCrmPalette`**, **`MXC_COLOR`** — ne pas
  ré-inventer. Et **chercher la valeur avant d'en inventer une** : le dépôt porte
  déjà `#B45309`, `#B91C1C`, `#F0A05A`, `MXC_SYSTEM.blue300`.
- **`EtatVide`** — l'idiome du vide, 4 registres, gardé.
- ⚠ **Aucun banc pour la face publique.** `/dev/crm` couvre l'agent ;
  `KycPublicPage` et `AppointmentManagePage` prennent un **jeton dans l'URL**.
  Mesurer comment les monter AVANT de promettre une vérification à l'image —
  c'est ce qui a coûté le plus cher au chantier KYC.

---

## §3 — Les questions à trancher AVANT de coder

Elles ne sont **pas** tranchées.

### 1. `MLK` descend-elle de `MXC_COLOR`, ou reste-t-elle une palette à part ?

C'est le geste le plus structurant. Descendre aligne la face publique sur les
onze autres surfaces — mais cette face est vue par des **clients**, pas par des
agents, et rien ne dit que la direction du CRM doive s'y appliquer telle quelle.
⚠ Mesurer d'abord ce que `MLK` encode réellement : une teinte qui porte un
STATUT reste hors direction, comme les teintes d'étape du pipeline.

### 2. Une garde de contraste par ZONE, ou une par OBJET ?

Le dépôt a neuf specs par zone et trois par objet (`SugarV3`, `AX`, `MLK` à
venir). La forme n° 38 dit que l'objet est le bon grain. ⚠ Mais `BuyerReceptionPage`
n'a **pas** d'objet — ses 8 littéraux sont écrits dans la page. Il faudra donc
soit lui en créer un, soit garder la page comme une zone.

### 3. Jusqu'où va « refaire le design » ici ?

Trois lectures, très différentes :

- **Réparer ce que le cliquet voit** — les 11 clauses sur 2 713 lignes.
  Mécanique, mesurable, garde-able.
- **Faire descendre `MLK` et donner une palette à `BuyerReceptionPage`** — le
  geste du lot 3 du KYC et du lot 3 d'Analytics, qui avaient retiré 10 et 13 clés
  mortes en chemin.
- **Redessiner ces écrans** — rien dans la mesure ne le réclame ; c'est une
  décision produit, et elle porte sur ce que le CLIENT voit.

---

## §4 — Les lots, si l'ordre du §3.3 est « réparer, puis descendre »

**Lot 0 — la garde qui manque.** `mlk-contraste.spec.ts` sur le modèle
d'`analytics-contraste` : les rôles **énumérés** (texte 4,5 / non-texte 3),
l'inventaire **confronté à la source par la LIAISON**, une clause qui REFUSE une
couleur qu'elle ne sait pas lire, et une clause qui dit combien de thèmes on
mesure. Elle doit rougir avant tout correctif.

⚠ Commencer par **compter les lecteurs de chaque clé**. Le KYC a trouvé 10 clés
mortes sur 35 en le faisant, Analytics 13 sur 30 : une clé sans lecteur n'est pas
« hors direction », elle est **morte**, et la nommer supprime le débat.

**Lot 1 — `kyc-magic-link/` entre au cliquet.** La zone partagée d'abord : c'est
elle qui pèse 1 993 lignes — dont 1 008 pour `MlkScreens.tsx` — et qui alimente deux pages. Les sept clauses, dans
l'ordre du moins risqué au plus visible.

**Lot 2 — `BuyerReceptionPage`.** Autonome, donc sans effet de bord. ⚠ Lire les
sites de `élément cliquable peint en encre` avant de les corriger (forme n° 25).

**Lot 3 — `AppointmentManagePage` et `AcceptInvitePage`.** Trois clauses à elles
deux ; le gros du travail aura été fait au lot 1, dont elles héritent.

**Lot 4 — la palette descend**, après avoir mesuré ce qui encode.

**Lot 5 — les 14 pages propres entrent au cliquet.** En dernier, quand plus rien
ne bouge. Un lot de cliquet, pas un lot de rendu.

---

## §5 — Portes

```bash
npx tsc -b                            # 0 erreur — PAS `tsc -p`, qui ne vérifie rien
npx eslint src tests --ext .ts,.tsx   # 0 erreur (136 warnings = référence)
npx vitest run                        # 2 150 + ceux ajoutés
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

Plus, propre à tout chantier de rendu :

- Le rendu vérifié **en clair ET en sombre** (si la face en a un), captures à
  l'appui, avant de commiter.
- ⛔ **Une CAPTURE, pas seulement une lecture DOM.** Le défaut le plus coûteux du
  chantier KYC — un badge blanc sur blanc — a été vu à l'image, pas par une
  sonde, et il avait survécu à un lot entier avec la CI verte.
- ⚠ Un **contrôle négatif** par clause. Le harnais doit EXIGER la preuve qu'un
  test a TOURNÉ (ligne « Tests N passed|failed ») ET qu'au moins un test n'a pas
  été ignoré : un filtre `-t` qui ne matche rien se rapporte « pas d'échec ».
- ⛔ **Ne jamais restaurer avec `git checkout --` pendant un contrôle négatif** :
  l'index porte le lot précédent. Copier (`cp .bak`).
- ⛔ **Une mutation de contrôle doit muter ce que la garde MESURE.** Trois
  contrôles ont menti la veille : une liaison mutée parmi quatorze, un témoin
  cassé dans un fichier et vivant dans l'autre, une mutation par COMMENTAIRE sur
  une garde qui retire les commentaires. Témoin AVANT (« le motif apparaît
  exactement une fois »), harnais MULTI-FICHIERS.

### Pièges d'outillage vécus, qui coûtent une demi-heure chacun

- ⛔ **`reuseExistingServer` prend le serveur d'un AUTRE worktree.** Mesuré : une
  régénération visuelle lancée en local a photographié `megga-x-mes-biens-6ea5ec`.
  Port dédié + `reuseExistingServer: false`, toujours.
- ⛔ **Une étape ajoutée à un workflow `issue_comment` NE S'EXÉCUTE PAS** : GitHub
  lit la définition sur la BRANCHE PAR DÉFAUT, même s'il checkout la PR ensuite.
- ⛔ **Le graphe de modules de Vite s'empoisonne** sur des réécritures en place
  (`perl -i`, `python`) : `ReferenceError` sur des imports présents, `tsc` vert.
  Remède : `rm -rf node_modules/.vite` + redémarrage, pas un rechargement.
- ⛔ **Des backticks non échappés dans un littéral de gabarit** cassent un
  `<style>{\`…\`}</style>` de façon illisible. Deux fois la veille.
- ⛔ **Une ancre d'insertion qui nomme une FAMILLE** (`la dernière ligne
  d'import`) atterrit au milieu d'un import multi-ligne. Ancrer sur un SITE.
- ⛔ **`getComputedStyle` lu pendant que le volet est MASQUÉ** rend la valeur de
  DÉPART d'une transition. Quand l'image contredit le DOM, **ouvrir un onglet neuf**.
- ⛔ **Une substitution `perl`/`python` qui ne matche pas se rapporte comme un
  succès.** Toujours un TÉMOIN après coup, et `node --check` sur un script généré.

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche à aucun backend.**
- **Il ne change pas un chiffre ni un libellé.** Ces pages portent des dates de
  rendez-vous et des références de dossier : une valeur déplacée est une erreur
  de contenu, pas un choix de design.
- **Il ne renomme pas** `MLK`, `Mlk*`, `crm-sugar*` ni les dossiers. Geste
  lexical à part.
- **Il ne rouvre pas l'arbitrage actif/donnée** : les familles qui ENCODENT
  restent hors direction, décision rendue quatre fois.
- **Il ne touche pas au CRM agent ni au mobile** — les deux sont finis.

---

## §7 — L'état à reprendre, et ce qui reste en suspens

### ⚠ La CI de la PR #1205 n'a pas tourné sur les trois derniers commits

Mesuré le 15 août à 01h40 : les *check-suites* de `43a90c8e` listent sept
applications, et **`github-actions` n'y est pas**. Actions est pourtant `enabled`
et tourne sur `main`. Les derniers runs de la branche datent de `926da98a`.

Le geste qui débloque, **en attente d'accord** :

```bash
gh pr close 1205 && gh pr reopen 1205
```

⚠ Un commit poussé par `GITHUB_TOKEN` (la régénération de captures) ne produit
PAS d'événement `pull_request` — protection anti-boucle documentée. C'est
l'explication du premier des trois, pas des deux autres.

### ⚠ Le chantier de la garde visuelle est à moitié fait

Livrés : le lot 0 (mesure) et la clause de fraîcheur
(`tests/unit/visual-baseline-fraicheur.spec.ts` + `scripts/visual-baseline-empreinte.mjs`).

Reste, **une demi-journée** : confirmer le **plancher de bruit sur Linux** puis
abaisser le seuil PAR PIXEL de `visual-regression.spec.ts` avec les deux nombres
écrits. Mesuré sur macOS, le plancher est **nul** et le signal d'un redesign
complet vaut **11,55 %** ; la même chose vaut **1,09 %** sur la CI, ce qui situe
le facteur de métrique à ~10. Le seuil se pose entre les deux, sur des chiffres
Linux — pas sur ceux-là.

### Après chaque lot livré

1. **Mettre le cerveau à jour** — éditer
   `.claude-flow/knowledge/megga-memory.seed.json`, puis `npm run ruflo:seed`,
   puis vérifier **par l'oracle SQL**, jamais par l'affichage de `memory get`.
   ⚠ Reseeder depuis le worktree où l'on travaille.
2. **Surveiller la CI** — six checks par poussée. ⚠ Un guetteur doit EXIGER que
   les checks EXISTENT avant de conclure : « no checks reported » ne contient pas
   « pending », et un compteur d'absences y lit un verdict.
3. ⚠ **La référence visuelle de `/dashboard/pipeline`** rougit dès qu'un fichier
   de sa chaîne de peinture change — c'est la clause de fraîcheur, et c'est
   voulu. Elle se régénère en commentant `/regenerate-visual-baselines` sur la
   PR, ce qui met la capture ET l'empreinte à jour d'un coup.
