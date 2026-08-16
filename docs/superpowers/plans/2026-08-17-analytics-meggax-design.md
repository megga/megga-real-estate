# Analytics en MEGGA X — la grammaire est faite, la couleur n'est gardée nulle part

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne suppose
> aucune conversation antérieure. Mesures faites le **16 août 2026**, après le
> chantier « KYC en MEGGA X » (6 lots + 4 retouches, PR #1205).
> **À revérifier avant de coder — voir §2.**
>
> ### ⛔ AVANT TOUT : la branche, et le piège qui l'accompagne
>
> | Nom | Ce que c'est |
> |---|---|
> | `origin/claude/pipeline-meggax-bench-fe8d37` | **la tête de la PR #1205** — c'est là qu'on pousse |
> | `claude/kyc-meggax-design-270db8` | la branche LOCALE du worktree `scrape-realadvisor-agencies-917d34`, **sans amont** |
> | `claude/pipeline-meggax-bench-fe8d37` (locale) | ⛔ **piège : périmée de 56+ commits**, sortie dans un AUTRE worktree |
>
> ⛔ **Ne pas faire `git checkout claude/pipeline-meggax-bench-fe8d37`.** La locale
> de ce nom est la troisième ligne. Rester dans le worktree courant.
>
> La poussée qui avance la PR est **explicite** — la branche d'ici n'a pas d'amont,
> et un `git push` nu ne créerait qu'une branche de plus, sans PR, sans CI :
>
> ```bash
> git push origin HEAD:claude/pipeline-meggax-bench-fe8d37
> ```
>
> Vérifier AVANT de commencer que la tête d'`origin` est bien un ancêtre du HEAD
> local (`git merge-base --is-ancestor origin/claude/pipeline-meggax-bench-fe8d37 HEAD`).
>
> ⚠ **Vérifier le `cwd` du serveur de dev avant toute mesure à l'écran.** Trois
> `vite` tournent en permanence sur cette machine et occupent 5173/5174 pour
> d'AUTRES worktrees. `preview_start` prend un port libre ; confirmer son `cwd` :
> ```bash
> P=$(lsof -nP -iTCP:<port> -sTCP:LISTEN -t | head -1); lsof -a -p "$P" -d cwd -Fn | grep ^n
> ```

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique ne remonte pas ces fiches sur une phrase générique. Les
interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** 38 formes de « garde verte pendant que l'écran est faux ». Les n° **15**, **31**, **37** et **38** décident de ce chantier. |
| `megga/kyc-meggax-design` | Le chantier qui vient de faire exactement ce travail sur le KYC. Sa méthode est celle à reprendre. |
| `megga/crm-agent-meggax-banc` | Le banc `/dev/crm`, ses trois murs, son SOCLE, et le rAF à ZÉRO image/seconde. |
| `megga/da-meggax-crm` | La direction, l'arbitrage actif/donnée rendu quatre fois, et la règle vive/foncée. |
| `megga/analytics-cockpit-commission` | Le domaine — ne pas redessiner ce qu'on n'a pas compris. |

⚠ `memory get` rend une table plafonnée à **64 Kio** et tronque **sans le dire**.
L'oracle du contenu est SQL, et le seed vit **dans le checkout** :

```bash
sqlite3 .swarm/memory.db "SELECT LENGTH(content), content LIKE '%maChaîne%' FROM memory_entries WHERE key='megga/gardes-vacuites';"
```

⚠ Une sonde `LIKE` qui échappe une apostrophe **droite** ne matche pas un texte
qui porte une **typographique** — vérifier lequel des deux ment avant de conclure.

Lire aussi `CLAUDE.md` §3 en entier.

---

## §1 — Le périmètre, dérivé du ROUTAGE et du CLIQUET

⛔ **Trois noms ne coïncident pas, et c'est le premier piège.**

| Ce qu'on cherche | Ce que c'est vraiment |
|---|---|
| la route | `/dashboard/analytics` |
| la page | **`AnalyticsPage`** (126 l.) — pas d'« AnalyticsPage » |
| le dossier | **`crm-sugar/analytics/`** |

Le cliquet le dit déjà en commentaire, et il a fallu s'y reprendre pour le voir.

| Face | Fichiers | Lignes | Cliquet | Marqueurs |
|---|---|---|---|---|
| `analytics/` (AxDashboard, AxFirstRun, AxGate, buildAxData, tokens) | 5 | 1 474 | ✅ porté | **0** |
| `AnalyticsPage` | 1 | 126 | ✅ dans `PAGES` | **0** |
| Mobile (`crm-mobile/analytics/`) | | | ✅ porté | 0 |

**Commandes qui régénèrent ce tableau :**

```bash
grep -oE "root: '[^']+'" tests/unit/megga-x-grammar.spec.ts | sort -u
grep -nE "^const \w+ = lazy" src/App.tsx | grep -i analytics
grep -n 'path="analytics"' src/App.tsx
```

⚠ Ne PAS résoudre les routes par une fenêtre de lignes autour de `<Route>`, et ne
pas déduire l'état du cliquet en grepant un chemin dans le spec : la preuve est la
liste des `root:` et des `PAGES`.

### ⛔ Ce que ce tableau dit, et qui décide du chantier

**La GRAMMAIRE d'Analytics est faite.** 0 marqueur, 0 noir de Sugar, 0 gris-bleu.
Comme pour le KYC, ce qui reste est ce que le cliquet **ne mesure pas** : la
couleur, et ce qui ne s'évalue pas.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé.**

### ⛔ FAIT n° 1 — `AX` / `AX_DARK` ne sont gardées par RIEN

C'est la forme **n° 38** de `megga/gardes-vacuites`, en plein : les sept specs de
contraste gardent chacune une **zone** ; un objet de jetons n'EST pas une zone, il
est lu par elles, et tombe entre. `graphite-scale.spec.ts` les nomme déjà :

> « `AX` et `AX_DARK` (Analytics) … dont AUCUNE n'était couverte. Mesurées le
> 16 août 2026, elles sont toutes propres ; mais « propre aujourd'hui » et
> « gardée » sont deux choses. »

Composition : **40 littéraux hexadécimaux, 20 dérivations** de MEGGA X.

### ⛔ FAIT n° 2 — `AX_DARK` est une TROISIÈME échelle sombre

Ses surfaces sont `card: #191B1F`, `cardSubtle: #23262B`, `cardWhisper: #1F2126`.
Ce n'est **ni MEGGA X** (`#030303 · #050505 · #090909 · #181818`) **ni Graphite**
(`#12161C`→`#21242F`) — d'où le fait que `graphite-scale` la déclare « propre » :
elle cherche les barreaux de Graphite, et ceux-ci n'en sont pas.

⚠ C'est exactement pourquoi une garde qui **liste** ne remplace pas une garde qui
**décrit** : `AX_DARK` est passée entre les deux échelles nommées.

### ⛔ FAIT n° 3 — au moins deux encres sous l'AA en CLAIR

Mesuré sur `AX`, encre sur sa propre carte (`#FFFFFF`) :

| Jeton | Valeur | card | cardSubtle | Rôle MESURÉ |
|---|---|---|---|---|
| `ink` | `#030303` | 20,62 ✅ | 19,24 ✅ | |
| `inkSoft` | `#3A3D44` | 10,88 ✅ | 10,15 ✅ | 3 en `color:` |
| **`muted`** | **`#80858E`** | **3,71 ⛔** | **3,46 ⛔** | **15 en `color:`** + 4 en `fill/stroke` |
| **`ghost`** | `#B5BAC2` | **1,95 ⛔** | 1,82 ⛔ | **1 en `color:`** |
| `goal` | `#C2C6CD` | 1,71 | 1,60 | **0 en `color:`**, 3 en `fill/stroke` |

⚠⚠ **`probable`, `possible`, `secured`, `line`, `area`, `grid` sortent à ZÉRO
usage sous la liaison `A.`** — et il ne faut PAS en conclure qu'ils sont morts.
Ils sont vraisemblablement passés en PROPS à des composants de graphique, ou
destructurés. **Les chercher par la valeur et par la prop avant de trancher** ;
c'est la différence entre « mort » et « lu autrement », et le KYC a fait les deux
erreurs dans le même chantier.

### ⛔ FAIT n° 4 — la liaison est `A`, pas `ax` ni `t`

`const A = useAX()` dans `AxDashboard.tsx` ; `AnalyticsPage` fait
`const axTheme = dark ? AX_DARK : AX` et le passe par `AXCtx`.

⚠ **Toute mesure de rôle doit résoudre la LIAISON, jamais le nom de clé** (forme
n° 31) : une première passe cherchant `ax.muted` / `AX.muted` / `t.muted` a rendu
**zéro sur toute la palette**, ce qui se lit « rien à faire ».

### ⛔ FAIT n° 5 — l'en-tête de `tokens.ts` décrit une direction RETIRÉE

> « Grammaire Sugar Pure : surfaces blanches, accent ink `#0B0C0E`, ombres douces »

`accent` vaut pourtant `MXC_COLOR.accent` depuis le lot A4. Forme n° 10 : un
fichier aligné sur une norme périmée se relit **moins** qu'un fichier négligé.

### Ce que le terrain offre déjà, et qu'il ne faut pas reconstruire

- **`/dev/crm` → surface « Analytics »** monte l'écran sous sa vraie coquille, avec
  ses trois RPC en fixtures (`analytics_cockpit`, `_objectif`, `_funnel`) **et**
  leurs formes VIDES dans `CRM_RPC_VIDE`.
  ⚠ **La fiche du cerveau qui annonce « 4 appels sans fixture sur Analytics » est
  PÉRIMÉE** — mesuré, les 4 restants sont ceux d'« Aujourd'hui » (`today_*`,
  `focus_*`). Analytics est couvert.
- **`EtatVide`** (`crm-sugar/EtatVide.tsx`) — l'idiome du vide, 4 registres, gardé.
  `AxDashboard` y est **déjà** entré ; `AxFirstRun` et `AxGate` sont hors sujet
  (couvertures de premier lancement).
- **`sugar-v3-contraste.spec.ts`** et **`kyc-contraste.spec.ts`** donnent la FORME
  d'une garde d'objet de jetons : inventaire des rôles **confronté à la source**,
  refus de toute couleur illisible, et une clause qui dit combien de thèmes on
  mesure.
- **`sgVoileEncre`**, **`encreSur`**, **`mxCrmPalette`** — ne pas ré-inventer.

---

## §3 — Les questions à trancher AVANT de coder

Elles ne sont **pas** tranchées.

### 1. `AX_DARK` rejoint-elle l'échelle de MEGGA X ?

C'est le geste le plus structurant et le plus visible. Passer
`#191B1F/#23262B/#1F2126` à `n300/n200/n400` aligne Analytics sur les onze autres
surfaces — mais **change l'aspect du plus gros écran du CRM**, et l'écart de
luminance MEGGA X en sombre est volontairement plus faible (la séparation vient de
la bordure). ⚠ Mesurer d'abord si les cartes d'Analytics **ont** une bordure : sans
elle, descendre l'échelle sans ajouter le filet aplatirait l'écran.

### 2. Quels tons ENCODENT, ici ?

`secured` / `probable` / `possible` sont la **décomposition de la commission** —
trois valeurs d'une même grandeur, lues dans un graphique. C'est une famille qui
ENCODE, comme les teintes d'étape du pipeline : l'arbitrage rendu quatre fois dit
qu'elle reste hors direction. Mais `goal`, `line`, `area`, `grid` sont du
**chrome de graphique**, pas de la donnée.
⛔ **Mesurer lesquels encodent avant d'en recibler un seul**, et se rappeler qu'un
seuil de TEXTE appliqué à une série de graphique envoie corriger un écran sain
(piège (g) : 31 défauts annoncés pour 18 réels sur le Matching).

### 3. Que veut dire « refaire le design » ici ?

Trois lectures, très différentes, et elles ne se font pas dans le même ordre :

- **Réparer ce que le cliquet ne voit pas** — les encres sous l'AA, la troisième
  échelle sombre, l'en-tête périmé. Mécanique, mesurable, garde-able.
- **Faire descendre `AX`/`AX_DARK` de `mxCrmPalette`** — le geste du lot 3 du KYC,
  qui avait retiré 10 clés mortes sur 35 en chemin.
- **Redessiner la composition** — revoir l'écran lui-même. Rien dans la mesure ne
  le réclame ; c'est une décision produit.

---

## §4 — Les lots, si l'ordre du §3.3 est « réparer, puis descendre »

**Lot 0 — la garde qui manque.** `analytics-contraste.spec.ts` sur le modèle de
`sugar-v3-contraste` : les DEUX thèmes, les rôles **énumérés** (texte 4,5 /
non-texte 3), l'inventaire **confronté à la source** par la LIAISON, et une clause
qui REFUSE une couleur qu'elle ne sait pas lire. Elle doit rougir avant tout
correctif.

⚠ Commencer par **compter les lecteurs de chaque clé**. Le KYC a trouvé 10 clés
mortes sur 35 en le faisant, ce qui a supprimé le débat de direction sur toute une
famille : une clé sans lecteur n'est pas « hors direction », elle est morte.

**Lot 1 — les encres.** `muted` et `ghost` au minimum. Prendre les barreaux que le
dépôt possède déjà (`n500` en clair, `n600` en sombre) plutôt que d'inventer.

**Lot 2 — l'échelle sombre**, si le §3.1 le retient. Mesurer la bordure AVANT.

**Lot 3 — la palette descend**, après avoir mesuré ce qui encode.

**Lot 4 — l'en-tête de `tokens.ts`** dit la direction réelle.

---

## §5 — Portes

```bash
npx tsc -b                            # 0 erreur — PAS `tsc -p`, qui ne vérifie rien
npx eslint src tests --ext .ts,.tsx   # 0 erreur (136 warnings = référence)
npx vitest run                        # 2 134 + ceux ajoutés
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

Plus, propre à tout chantier de rendu :

- Le banc rejoué **en clair ET en sombre**, captures à l'appui, avant de commiter.
- ⛔ **Une CAPTURE, pas seulement une lecture DOM.** Le défaut le plus coûteux du
  chantier KYC — un badge blanc sur blanc — a été vu à l'image, pas par une sonde,
  et il avait survécu à un lot entier avec la CI verte.
- ⚠ Un **contrôle négatif** par clause. Le harnais doit EXIGER la preuve qu'un test
  a TOURNÉ (ligne « Tests N passed|failed ») : une variable non substituée, un
  filtre `-t` qui ne matche rien, ou un essai dont la commande échoue se rapportent
  tous comme « pas d'échec ».
- ⛔ **Ne jamais restaurer avec `git checkout --` pendant un contrôle négatif** :
  l'index porte le lot précédent. Copier (`cp .bak`).

### Pièges d'outillage vécus, qui coûtent une demi-heure chacun

- ⛔ **Le graphe de modules de Vite s'empoisonne** sur des réécritures en place
  (`perl -i`, `python`) : trois `ReferenceError` sur des imports pourtant présents,
  `tsc` vert. Remède : `rm -rf node_modules/.vite` + redémarrage du serveur, pas un
  rechargement de page.
- ⛔ **`getComputedStyle` lu pendant que le volet est MASQUÉ** rend la valeur de
  DÉPART d'une transition. Discriminant neuf : comparer à un voisin **sans**
  `transition` — s'ils divergent, c'est celui qui en a une qui ment.
- ⛔ **Un `window.print()` au montage fige le volet** (boîte native). Chercher tout
  `window.*` auto-exécuté avant d'ajouter une surface à un banc.
- ⛔ **Une substitution `perl`/`python` qui ne matche pas se rapporte comme un
  succès.** Toujours un TÉMOIN après coup, et `node --check` sur un script généré.
- ⛔ **`io.open(p,'w')` s'évalue AVANT l'argument qui lit le même chemin** — lire
  dans une instruction séparée, puis asserter la taille.
- ⛔ **Une passe de substitution s'emballe** : 14 141 lignes ajoutées à
  `analytics/tokens.ts` lors d'un lot précédent. Passe UNIQUE + abandon au-delà
  de +25 %.

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche à aucun backend.** Les trois RPC `analytics_*` sont
  `SECURITY DEFINER` et agrègent des montants : rien de tout ça n'est en jeu.
- **Il ne change pas un chiffre ni un libellé.** Un écran de commission se lit ;
  une valeur déplacée est une erreur comptable, pas un choix de design.
- **Il ne renomme pas** `AX`, `AX_DARK`, `crmSugarPalette` ni les dossiers
  `crm-sugar*`. Geste lexical à part.
- **Il ne rouvre pas l'arbitrage actif/donnée** : les familles qui ENCODENT restent
  hors direction, décision rendue quatre fois.
- **Il ne touche pas au CRM mobile** (`crm-mobile/analytics`).

---

## §7 — Après chaque lot livré

1. **Mettre le cerveau à jour** — éditer
   `.claude-flow/knowledge/megga-memory.seed.json`, puis `npm run ruflo:seed`,
   puis vérifier **par l'oracle SQL**, jamais par l'affichage de `memory get`.
   ⚠ Reseeder depuis le worktree où l'on travaille.
   ⚠ Corriger la fiche `megga/crm-agent-meggax-banc`, qui annonce encore « 4 appels
   sans fixture sur Analytics » — c'est faux depuis le lot 0 du chantier KYC.
2. **Surveiller la CI.** La PR #1205 se déclenche sur `pull_request` : chaque
   poussée rejoue six checks — Cloudflare Pages, gate KYB, Playwright, Vitest
   backend, Vitest unit, build-and-deploy.
   ⚠ `Vitest backend` a un historique de *flake* sur le rate-limit du CLI Supabase :
   lire le motif avant de conclure à une régression.
3. ⚠ **La référence visuelle de `/dashboard/pipeline`** est la seule capture gardée
   du dépôt. Un changement qui la déplace de plus de 1 % la fait rougir ; elle se
   régénère en commentant `/regenerate-visual-baselines` sur la PR.
