# KYC en MEGGA X — le portage est fait, le design ne l'est pas

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne
> suppose aucune conversation antérieure. Mesures faites le **16 août 2026**,
> après le chantier « CRM agent → MEGGA X » (11 lots, PR #1205, CI verte).
> **À revérifier avant de coder — voir §2.**
>
> ### ⛔ AVANT TOUT : trois points portent le nom de ce chantier, un seul est bon
>
> | Nom | Commit | Ce que c'est |
> |---|---|---|
> | `claude/crm-agent-meggax-35caba` | `8520810f` | **le travail**, dans le worktree `megga-x-settings-design-5a4908` — sans amont |
> | `origin/claude/pipeline-meggax-bench-fe8d37` | `8520810f` | la tête de la **PR #1205** — même commit |
> | `claude/pipeline-meggax-bench-fe8d37` (locale) | `f3c57a01` | **piège : 56 commits en retard**, sortie dans un AUTRE worktree |
>
> ⛔ **Ne pas faire `git checkout claude/pipeline-meggax-bench-fe8d37`.** C'est la
> troisième ligne — périmée de 56 commits, et déjà sortie ailleurs (git refusera,
> ou pire, on travaillera dans l'autre worktree sans le voir). Rester dans
> `megga-x-settings-design-5a4908`, sur `claude/crm-agent-meggax-35caba`.
>
> La branche locale n'a **pas d'amont**. La poussée qui avance la PR est explicite :
>
> ```bash
> git push origin claude/crm-agent-meggax-35caba:claude/pipeline-meggax-bench-fe8d37
> ```
>
> Vérifier avant de commencer que le commit d'ici et celui d'`origin` coïncident
> toujours — si quelqu'un a poussé entre-temps, ils divergent.
>
> ⚠ Ce plan suit un chantier qui a déjà PORTÉ le KYC agent (lot A2 : 149
> marqueurs de grammaire → 0). Il ne recommence pas ce travail. Il traite ce que
> le portage, par construction, ne pouvait pas voir : **le cliquet mesure la
> composition, jamais le contraste, et jamais ce qui est hors de ses zones.**
>
> ⛔ Trois plans successifs se sont trompés de périmètre, toujours par le même
> geste : **le dériver d'une DESCRIPTION ou d'un DOSSIER au lieu du ROUTAGE.**
> Le plan Pipeline désignait le mauvais fichier structurant ; celui de la console
> annonçait 12 entrées de rail pour 18 ; celui du CRM agent ratait deux pages KYC
> routées et les 114 marqueurs du dock IA. Ici chaque chiffre est mesuré, et §2
> dit comment.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique ne remonte pas ces fiches sur une phrase générique. Les
interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** Vingt-huit formes de « garde verte pendant que l'écran est faux », plus huit pièges de sonde. Le fichier le plus rentable du cerveau. |
| `megga/crm-agent-meggax` | Le chantier qui vient de porter ce KYC. Sa méthode est celle à reprendre. |
| `megga/crm-agent-meggax-banc` | Le banc `/dev/crm`, ses trois murs, et le piège de vérification le plus cher — le rAF du volet est à ZÉRO image/seconde. |
| `megga/kyc-ui-hooks` | La plus grosse fiche UI du KYC (5 927 car.) : quel écran lit quoi. |
| `megga/kyc-overview` · `megga/kyc-data-model` | Le domaine — ne pas redessiner ce qu'on n'a pas compris. |
| `megga/kyc-magic-link-flow` | Le parcours CLIENT, celui que le portage n'a jamais touché (voir §2.1). |
| `megga/kyc-report-pdf-whatsapp` | Le rapport PDF, l'autre face non portée. |
| `megga/da-meggax-crm` | La direction, et l'arbitrage actif/donnée rendu quatre fois. |

⚠ `memory get` rend une table ASCII plafonnée à **64 Kio** et tronque les fiches
longues **sans le dire**. L'oracle du contenu est SQL :

```bash
sqlite3 .swarm/memory.db "SELECT LENGTH(content), content LIKE '%maChaîne%' FROM memory_entries WHERE key='megga/kyc-ui-hooks';"
```

⚠ **Le seed vit dans le CHECKOUT.** Interroger la base du dépôt principal en
travaillant dans un worktree fait conclure à tort qu'une fiche n'existe pas.

Lire aussi `CLAUDE.md` §3 en entier, et
[`tests/unit/megga-x-grammar.spec.ts`](../../../tests/unit/megga-x-grammar.spec.ts) —
le cliquet **est** la définition de « porté », et il ne dit rien du contraste.

---

## §1 — Le périmètre, dérivé du ROUTAGE

⛔ **« Le KYC » n'est pas les trois dossiers portés.** Le routage en montre CINQ
faces, et le portage n'en a couvert que trois.

| Face | Route | Fich. | Lignes | Cliquet | Marqueurs restants |
|---|---|---|---|---|---|
| **Agent · les 2 pages** | `/dashboard/kyc`, `kyc/:id` | 8 | 2 463 | ✅ porté | 0 |
| **Agent · l'entonnoir** | modale du wizard | 10 | 2 318 | ✅ porté | 0 |
| **Agent · palette et cartes** | — | 3 | 651 | ✅ porté | 0 |
| **CLIENT · lien magique** | `/kyc/:token` (public) | 6 | 1 993 | ⛔ **jamais** | **94** |
| **PDF · rapport** | `/kyc-report/:token` | 7 | 1 844 | ⛔ **jamais** | **109** |
| Mobile | via `crm-mobile` | 4 | 871 | ✅ porté | 0 |

Plus trois pages routées : `KycSugarV3Page` (202 l.), `KycOnboardingPage`
(203 l.), `KycExportPage` (258 l.) — toutes portées.

### ⛔ Ce que ce tableau dit, et qui décide du chantier

**Le KYC que l'AGENT voit est porté. Le KYC que le CLIENT voit ne l'est pas.**
203 marqueurs vivent sur la seule face que voit une personne extérieure à
l'agence — celle qui décide si MEGGA a l'air sérieux au moment où on lui demande
une pièce d'identité.

**Commande qui régénère ce tableau :**

```bash
# les racines réelles du cliquet — la seule source de vérité
grep -oE "root: '[^']+'" tests/unit/megga-x-grammar.spec.ts | sort -u
# la route d'une page, par son NOM de composant, jamais par une fenêtre de lignes
grep -nE "^const Kyc\w+ = lazy" src/App.tsx
```

⚠ Ne PAS résoudre les routes par une fenêtre de lignes autour de `<Route>` : ça
déborde sur la suivante. Et ne pas déduire l'état du cliquet en grepant un
chemin dans le spec — mesuré en écrivant ce plan, ça rend « porté » sur des
dossiers qui ne le sont pas. La preuve est la liste des `root:`.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé.**

### ⛔ FAIT STRUCTURANT n° 1 — le cliquet ne mesure pas le contraste, et ça se voit

Cinq specs de contraste existent (`admin`, `biens`, `contacts`, `matching`,
`pipeline`). **Aucune ne couvre le KYC.** Le seul test qui ouvre `kycPalette` est
`graphite-scale`, qui vérifie des paliers, pas des ratios.

Mesuré sur `KYC_LIGHT`, encre sur sa propre carte (`#FFFFFF`) :

| Jeton | Valeur | Ratio | Rôle mesuré |
|---|---|---|---|
| `inkSoft` | `#3A3D44` | 10,88:1 ✅ | |
| **`muted`** | **`#7A8088`** | **3,98:1 ⛔** | **23 sites en `color:`** |
| `ghost` | `#B5BAC2` | 1,95:1 | à qualifier — probablement un repos, pas une encre |
| `ok` / `warn` / `err` | | 2,15 à 3,76 | **0 site en `color:`** — voir l'avertissement |

⚠ **Ne pas rapporter `ok`/`warn`/`err` comme des défauts sans les avoir
qualifiés.** Mesuré : zéro usage en `color:`, et zéro en
`background`/`stroke`/`fill` non plus. Ils sont donc soit morts, soit employés
par une prop indirecte. Un seuil de TEXTE appliqué à un aplat envoie corriger un
écran sain — c'est le piège (g) de `megga/gardes-vacuites`, qui avait fait
annoncer 31 défauts pour 18 réels sur le Matching.

⚠ En SOMBRE, `muted` vaut `sp.sub` — dérivé, donc sain. **Le défaut est
mono-thème.** Une garde d'un seul thème serait passée au vert.

### ⛔ FAIT STRUCTURANT n° 2 — deux jetons « black » dans le MÊME entonnoir

`kycPalette.black` vaut l'accent `#424bfb` depuis le lot A2 — 16 lecteurs dans
les trois dossiers KYC. Mais `SugarV3.black` vaut toujours `#0B0C0E`, le noir de
Sugar, et il a **11 lecteurs**, dont `MlkAgentModal` — qui vit **dans le wizard
KYC**.

Deux couleurs d'état actif sur le même écran. C'est le défaut exact que la fiche
des Réglages décrit (`PfSwitch` noir pendant que `PxfSwitch` était déjà bleu), et
il survit parce que **`crm-sugar-v3/tokens.ts` n'est PAS dans le cliquet** — une
décision datée du lot A0, prise quand ses lecteurs n'étaient pas encore portés.
Ils le sont maintenant, sauf trois hors KYC (`audit`, `visite-detail`,
`ImportLead`).

```bash
grep -rn "SugarV3\.black" src --include='*.tsx' | cut -d: -f1 | sort -u
```

### ⛔ FAIT STRUCTURANT n° 3 — `KYC_LIGHT` est une palette PARALLÈLE

72 clés, dont **23 littéraux hexadécimaux** et seulement **11 dérivés** de
`mxCrmPalette` / `MXC_COLOR` / `sgVoileEncre`. Le reste est écrit à la main.

C'est la troisième occurrence du motif que ce chantier a rencontré partout : la
console (`adminSurfaces`), la popover de notifications (`#16181F`), les cinq
modales du dock (`#17181C`). Chercher ce motif **par la FORME** — un objet
littéral de ≥ 5 clés de couleur — jamais par le nom.

### ⛔ FAIT STRUCTURANT n° 4 — le KYC ne se regarde PAS peuplé

`crmFixtures.ts` porte `kyc_cases: []`. Le banc `/dev/crm` ne montre donc que le
**premier lancement** : ni liste de dossiers, ni vigie, ni fiche stricte, ni
aucun état actif du wizard. Les seize lecteurs de `kycPalette.black` sont
invisibles.

⚠ **C'est le Lot 0 de ce plan.** Le chantier précédent a livré exactement cette
leçon : « câblé n'est pas vérifié », et un quatrième état vide n'est apparu
qu'une fois la bascule posée — aucune relecture ne l'aurait trouvé.

### Ce que le terrain offre déjà, et qu'il ne faut pas reconstruire

- **`/dev/crm`** monte les dix surfaces sous leur vraie coquille, avec trois
  états (Nominal / Vide / Échec) et un compteur d'appels sans fixture.
- **`EtatVide`** (`src/components/crm-sugar/EtatVide.tsx`) — l'idiome du vide,
  quatre registres, gardé par `etat-vide.spec.ts`. Le KYC n'y est PAS encore.
- **`bancSupabase`** — une seule interception couvre REST, edges et `/auth/v1`.
- **`sgVoileEncre`**, **`encreSur`** — ne pas ré-inventer.
- Les cinq specs de contraste donnent la FORME d'une sixième.

---

## §3 — Les questions à trancher AVANT de coder

Elles ne sont **pas** tranchées.

### 1. Que veut dire « refaire le design » ici ?

Le KYC agent est porté : 0 marqueur de grammaire, 0 teinte proscrite. Trois
lectures possibles, très différentes :

- **Réparer ce que le portage n'a pas vu** — le contraste (§2.1), les deux
  `black` (§2.2), la palette parallèle (§2.3). Mécanique, mesurable, garde-able.
- **Porter les deux faces CLIENT** — lien magique (94) et rapport PDF (109). Le
  même travail que le chantier précédent, sur la surface qui fait la première
  impression.
- **Redessiner** — revoir la composition des écrans eux-mêmes, comme on l'a fait
  pour les états vides : mesurer ce que la vitrine pratique, proposer, trancher.

⚠ Les trois sont légitimes et ne se font pas dans le même ordre. **À décider.**

### 2. Le rapport PDF suit-il la direction ?

Il n'est pas rendu à l'écran mais **imprimé** — Cloudflare Browser Rendering, sur
papier blanc, sans thème sombre. Les règles de MEGGA X (canvas `#030303`, la
séparation par la bordure, l'accent en aplat) y sont sans objet, voire nuisibles.

⛔ **Le traiter comme une surface d'écran serait une faute.** Mais le laisser
hors direction demande d'écrire pourquoi, et où passe la frontière.

### 3. Jusqu'où va la palette ?

`KYC_LIGHT` a 72 clés. La faire descendre entièrement de `mxCrmPalette` est le
geste cohérent — mais le KYC porte des tons de **conformité** (statut de dossier,
niveau de risque, verdict de screening) qui ENCODENT une information, et
l'arbitrage rendu quatre fois dit que ces familles restent hors direction.

⛔ **Mesurer lesquelles encodent avant d'en recibler une seule.** Le pôle d'un
mélange n'encode rien ; la teinte d'un statut, si.

---

## §4 — Les lots, si l'ordre du §3.1 est « réparer, puis client »

**Lot 0 — le KYC devient regardable.** Fixtures `kyc_cases`,
`kyc_checklist_items`, `kyc_screening_decisions`, `documents`. Sans lui, tout le
reste se vérifie à l'aveugle.

⚠ Formes recopiées des types, jamais devinées : la console avait livré quatre
fixtures syntaxiquement valides et sémantiquement fausses.
⚠ Et prévoir l'état **vide** distinct de l'absence de réponse (`rpcVide`) — pour
une RPC qui rend un objet, `null` se lit « pas encore répondu » et la page reste
sur son squelette.

**Lot 1 — le contraste.** `kyc-contraste.spec.ts` sur le modèle des cinq
existantes : les DEUX thèmes, les rôles énumérés (pas seulement les zones), et
une clause qui REFUSE une couleur qu'elle ne sait pas lire.

**Lot 2 — un seul « black ».** Entrer `crm-sugar-v3/tokens.ts` dans le cliquet,
ce qui exige d'avoir traité ses onze lecteurs. Trois sont hors KYC — les faire ou
justifier de ne pas les faire.

**Lot 3 — la palette descend.** Après avoir mesuré ce qui encode.

**Lot 4 — l'état vide.** Entrer le KYC dans `etat-vide.spec.ts`.

**Lot 5 — les deux faces client**, si le §3.1 les retient.

---

## §5 — Portes

```bash
npx tsc -b                            # 0 erreur
npx eslint src tests --ext .ts,.tsx   # 0 erreur (139 warnings = référence)
npx vitest run                        # 2 104 tests + ceux ajoutés
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

Plus, propre à tout chantier de rendu :

- Le banc rejoué **en clair ET en sombre**, captures à l'appui, avant de commiter.
- ⛔ **Les surfaces PORTÉES ouvertes en sombre** — aucune porte automatique ne
  voit le piège de modale.
- ⚠ Un **contrôle négatif** par clause. Le harnais doit EXIGER la preuve qu'un
  test a TOURNÉ (ligne « Tests N passed|failed ») : une variable non substituée,
  un filtre `-t` qui ne matche rien, ou un essai dont la commande échoue se
  rapportent tous comme « pas d'échec ».
- ⛔ **Ne jamais restaurer avec `git checkout --` pendant un contrôle négatif** :
  l'index porte le lot précédent. Copier (`cp .bak`), ou `git restore
  --source=HEAD` APRÈS avoir vérifié que rien n'est indexé.

### Pièges d'outillage vécus, qui coûtent une demi-heure chacun

- ⛔ **`io.open(p,'w')` s'évalue AVANT l'argument qui lit le même chemin** — un
  fichier de 26 623 octets tronqué à zéro, révélé par `tsc`, pas par la passe.
  Lire dans une instruction séparée, puis asserter la taille.
- ⛔ **Une boucle de substitution s'emballe** : 14 141 lignes ajoutées à un
  fichier de jetons. Passe UNIQUE + garde-fou qui abandonne au-delà de +25 %.
- ⛔ **zsh ne découpe pas les paramètres non quotés** : un `set -- $var` rend le
  chemin entier comme un seul argument, et la sonde rapporte « non résolu » sur
  des fichiers qui existent. Essai NUL, pas résultat négatif.
- ⛔ **Une lookahead après `\s*` est défaite par le retour arrière** :
  `/border\s*:\s*(?!0)/` attrape `border: 0`. Capturer la valeur, ne pas la nier.
- ⛔ **Une garde qui cherche un NOM trouve l'import**, pas l'usage : le cliquet
  restait vert sur une surface revenue à son propre `<div>`. Ancrer sur `<Nom`.
- ⛔ **Un import statique amarre ce qu'il désigne dans le bundle**, même derrière
  une branche gelée en DEV. Vérifié sur `dist/`, avec un contrôle POSITIF — une
  sonde qui cherche un identifiant minifié rend zéro sur du code présent.

### Le volet du navigateur ment, et voici comment

- ⚠ **Son rAF est à ZÉRO image/seconde** (mesuré : 0 frame en 800 ms). Tout ce
  qui s'ouvre par `requestAnimationFrame` paraît cassé alors qu'il est sain.
- ⚠ **Après un changement d'état en place, la capture peut contredire le DOM.**
  Ni un rechargement ni un redimensionnement ne dégèlent ; un **onglet neuf**,
  si. Discriminant : quand l'image contredit le DOM, ouvrir un onglet.
- ⚠ Vérifier le `cwd` du serveur de dev avant toute mesure — `npm run dev` peut
  servir un AUTRE worktree.

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche à aucun backend.** C'est un chantier de rendu. Le KYC porte des
  RPC, des edges et un moteur de score : rien de tout ça n'est en jeu.
- **Il ne change pas un mot de ce qui est DIT.** Surface de conformité : aucun
  libellé, aucun seuil, aucun statut. Le lot A2 s'y est tenu — la bannière
  « CONFIANCE VÉRIFIÉE » est du texte, pas une capitale CSS, et elle reste.
- **Il ne renomme pas** `crmSugarPalette`, `SugarV3`, ni les dossiers
  `crm-sugar*`. Geste lexical à part, des centaines d'imports.
- **Il ne rouvre pas l'arbitrage actif/donnée** : les familles qui ENCODENT une
  information restent hors direction, décision rendue quatre fois.
- **Il ne touche pas au CRM mobile** (`crm-mobile/kyc`), porté le 12 août.

---

## §7 — Après chaque lot livré

1. **Mettre le cerveau à jour** — sinon il se périme, et deux fiches l'ont déjà
   montré pendant le chantier précédent :
   - compléter `megga/gardes-vacuites` de ce que le lot aura trouvé ;
   - corriger la fiche KYC que le lot contredirait ;
   - `npm run ruflo:seed`, puis vérifier **par l'oracle SQL**, jamais par
     l'affichage de `memory get`.
   - ⚠ Reseeder depuis le worktree où l'on travaille.
2. **Surveiller la CI.** La PR #1205 est ouverte et la CI se déclenche sur
   `pull_request` : chaque poussée la rejoue. Six checks — Cloudflare Pages, gate
   KYB, Playwright, Vitest backend, Vitest unit, build-and-deploy.
   ⚠ Pousser par la forme explicite du préambule (`local:distante`) : la branche
   d'ici n'a pas d'amont, et un `git push` nu ne créerait qu'une branche de plus,
   sans PR, sans CI — c'est l'état dans lequel ce chantier a été trouvé.
3. ⚠ **La référence visuelle de `/dashboard/pipeline`** est la seule capture
   gardée du dépôt. Un changement qui la déplace de plus de 1 % la fait rougir ;
   elle se régénère en commentant `/regenerate-visual-baselines` sur la PR.
   Mesuré : le portage complet du chrome et du pôle d'encre ne l'a PAS bougée
   (le seuil de distance colorimétrique de Playwright absorbe 2-3 unités RVB).
