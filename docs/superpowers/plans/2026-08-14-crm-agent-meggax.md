# CRM agent → MEGGA X — ce qu'il reste

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne
> suppose aucune conversation antérieure. Mesures faites le **14 août 2026** sur
> `claude/pipeline-meggax-bench-fe8d37`, après la livraison de la console
> super-admin (7 commits). **À revérifier avant de coder — voir §2.**
>
> ⚠ Écrit après DEUX chantiers dont les plans se sont trompés. Le plan Pipeline
> désignait le mauvais fichier comme fait structurant et comptait 28 lecteurs là
> où il y en avait 11. Le plan Console annonçait 12 entrées de rail là où le code
> en portait 18 — un tiers du périmètre. Les deux erreurs ont la même cause :
> **un périmètre dérivé d'une DESCRIPTION au lieu du ROUTAGE.**
>
> Ici chaque chiffre a été mesuré, et §2 dit comment. Refaites-les quand même.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique ne remonte pas ces fiches sur une phrase générique. Les
interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** Vingt-deux formes de « garde verte pendant que l'écran est faux », plus huit pièges de sonde. C'est le fichier le plus rentable du cerveau. |
| `megga/console-admin-meggax` | Le chantier précédent, livré le 14 août. Sa méthode est celle à reprendre, et il a trouvé six formes de garde vacuité de plus. |
| `megga/pipeline-meggax` | Le chantier d'avant. C'est lui qui a introduit `sgVoileEncre` et le banc par slot. |
| `megga/da-meggax-crm` | La direction, et l'arbitrage actif/donnée rendu quatre fois. |
| `megga/reglages-meggax-composition` | ⚠ Dit que les Réglages ont été portés le 10 août. **C'est vrai pour la COMPOSITION et faux pour la COULEUR** — voir §2. |
| `megga/today-v2-concept-h` | « Aujourd'hui » est une page NEUVE installée récemment ; savoir ce qu'elle est avant de la repeindre. |

⚠ `memory get` rend une table ASCII plafonnée à **64 Kio** et tronque les
fiches longues sans le dire. L'oracle du contenu est SQL :

```bash
sqlite3 .swarm/memory.db "SELECT LENGTH(content), content LIKE '%maChaîne%' FROM memory_entries WHERE key='megga/gardes-vacuites';"
```

Lire aussi `CLAUDE.md` §3 en entier, et
[`tests/unit/megga-x-grammar.spec.ts`](../../../tests/unit/megga-x-grammar.spec.ts) —
le cliquet **est** la définition de « porté ».

---

## §1 — Le périmètre, dérivé du CLIQUET et du ROUTAGE

⛔ **Ne pas partir du nom des dossiers, NI de ce que le cerveau déclare porté.**
La source de vérité est `ZONES` + `PAGES` dans `megga-x-grammar.spec.ts` : une
zone absente n'est pas déclarée propre, elle est déclarée **non traitée**.

**Déjà porté** (14 racines, 9 pages nommées) : `crm-sugar-wizard`,
`crm-sugar/biens`, `crm-sugar/contacts-pager`, `crm-sugar/pipeline`,
`crm-sugar-v3/vitrine`, `crm-sugar-v3/offer-modal`, `crm-mobile`,
`matching-recherche`, `matching-atelier`, `pages/admin`, `components/admin`,
plus `SugarShell.tsx` et trois fichiers de `crm-sugar-v3`.

### Ce qui reste — 773 marqueurs, 113 fichiers, 37 133 lignes

⚠ **C'est DEUX FOIS le chantier de la console** (386 marqueurs). Ce n'est pas un
chantier, c'est une série. Le §4 le découpe en surfaces livrables séparément.

| Surface | Route | gram. | coul. | **tot** | fich. | lignes |
|---|---|---|---|---|---|---|
| **Aujourd'hui** | `/dashboard` (index) | 124 | 15 | **139** | 21 | 5 916 |
| **KYC** | `/dashboard/kyc` | 101 | 33 | **134** | 22 | 5 669 |
| **Visites** | `/dashboard/visits/*` | 100 | 5 | **105** | 3 | 2 268 |
| **Analytics** | `/dashboard/analytics` | 64 | 18 | **82** | 6 | 1 572 |
| **Import lead** | `/dashboard/import-lead` | 73 | 4 | **77** | 3 | 1 670 |
| **Chrome partagé** | *(rendu partout)* | 32 | 26 | **58** | 10 | 2 643 |
| **Réglages** | `/dashboard/settings` | 12 | 43 | **55** | 15 | 6 000 |
| **Julien** | `/dashboard/julien` | 29 | 11 | **40** | 1 | 909 |
| **Parcours** | `/dashboard/journey` | 21 | 6 | **27** | 7 | 1 462 |
| **Reste (pages)** | *(divers)* | 17 | 6 | **23** | 9 | 4 660 |
| **Audit** | `/dashboard/audit` | 20 | 1 | **21** | 3 | 845 |
| **Calendrier** | `/dashboard/calendar` | 0 | 12 | **12** | 13 | 3 519 |
| | | **593** | **180** | **773** | **113** | **37 133** |

**Commandes qui régénèrent ce tableau** (à rejouer, §2) :

```bash
# ce que le cliquet déclare porté
grep -oE "root: '[^']+'" tests/unit/megga-x-grammar.spec.ts | sort -u
# la route d'une page, sans passer par une description
grep -n "<TodaySugarPage" src/App.tsx
```

⚠ **Les routes passent par `ResponsiveRoute` (desktop/mobile) et par `ByParam`.**
Une résolution par fenêtre de lignes déborde sur la route suivante et produit de
faux couples — mesuré en écrivant ce plan : elle donnait `admin/*` → la page du
Pipeline. Chercher le composant **par son nom**, un par un.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé**.

### ⛔ FAIT STRUCTURANT n° 1 — « porté » veut dire deux choses, et le cerveau n'en dit qu'une

Le cerveau déclare les **Réglages** portés le 10 août et le **Calendrier** porté
par #1199. C'est vrai — **de la composition seulement** :

| | grammaire | couleur |
|---|---|---|
| Réglages | 12 | **43** |
| Calendrier | **0** | 12 |

Le Calendrier n'a **plus une seule** faute de grammaire : casse, graisse,
interlettrage et échelle de texte sont entièrement portés. Il lui reste dix noirs
de Sugar et deux gris-bleus. Les Réglages sont dans le même état, en plus lourd.

⚠ **La conséquence pratique : ces deux surfaces ne demandent PAS un chantier,
elles demandent une passe de couleur et une entrée au cliquet.** Les traiter
comme « à refaire » coûterait dix fois leur prix. Inversement, **Aujourd'hui,
KYC, Visites, Import lead et Analytics n'ont jamais été portés** — 462 des 593
marqueurs de grammaire y sont.

### ⛔ FAIT STRUCTURANT n° 2 — « Aujourd'hui » est la plus grosse, et la plus récente

`crm-sugar/today` : **20 fichiers, 5 548 lignes, 134 marqueurs**, dont
**94 graisses ≥ 700**. C'est le dossier le plus lourd du reste, et c'est aussi le
plus RÉCEMMENT écrit (« concept H », page 0 installée).

⚠ Le lire comme « du vieux code à rattraper » serait faux : il a été écrit
**après** la bascule de direction, et il porte quand même 94 graisses proscrites.
Cela veut dire que la grammaire MEGGA X **n'est pas encore ce que la main écrit
par défaut** — et donc que le cliquet est le livrable qui compte, pas la passe.

### ⛔ FAIT STRUCTURANT n° 3 — deux feuilles CSS qu'aucune garde n'ouvre

Le chantier Matching a montré qu'une feuille est un système de jetons dans un
langage invisible aux gardes ; le chantier Console l'a revu sur
`admin-console.css`, où Graphite avait survécu quatre jours toutes portes vertes.
Il en reste **deux non gardées** :

| Feuille | Lignes | Hex | Lecteurs |
|---|---|---|---|
| `src/styles/megga-x-additions.css` | 1 335 | **8** | 10 fichiers, dont `MxModal`, `MxField`, l'onboarding identité |
| `src/components/crm-sugar-v3/responsive.css` | 94 | **0** | `main.tsx` |

`responsive.css` ne porte aucune couleur — il est probablement sans risque, mais
le VÉRIFIER plutôt que le supposer. `megga-x-additions.css` en porte huit et sert
la coquille d'identité : **c'est le candidat sérieux**.

### ⛔ FAIT STRUCTURANT n° 4 — le chrome partagé est rendu partout, et il n'est gardé nulle part

`search` (18), `notifications` (14), `profile` (5), `LiquidGlassRail.tsx` (2),
`crm-sugar/tokens.ts` (3), `crm-sugar-v3/primitives.tsx` (10),
`crm-sugar-v3/tokens.ts` (6) — **58 marqueurs sur des surfaces rendues par les
28 écrans du CRM**, y compris les onze déjà portés.

⚠ `crm-sugar/tokens.ts` et `crm-sugar-v3/tokens.ts` sont des fichiers de JETONS :
ce qu'ils portent rayonne. Trois noirs de Sugar dans le premier, quatre gris-bleus
et deux noirs dans le second.

⚠ Et `LiquidGlassRail.tsx` est monté par **28 surfaces**. Toute retouche s'y
vérifie sur au moins deux bancs, pas un.

### Ce que le terrain offre déjà, et qu'il ne faut pas reconstruire

- **Huit bancs** existent : `/dev/pipeline`, `/dev/biens`, `/dev/contacts`,
  `/dev/matching-atelier`, `/dev/mobile`, `/dev/modales`, `/dev/onboarding`,
  `/dev/admin`. **Aucune** des dix surfaces restantes n'en a un.
- **`graphite-scale.spec.ts` couvre déjà** `SugarV2` (wizard), `TK` (Aujourd'hui),
  `buildCalPalette` (Calendrier), `SET_PALETTE` (Réglages), `VxSP` (fiche bien),
  `MT` (mobile) et la console. La dette de couleur restante n'est donc **pas**
  Graphite : c'est le **noir de Sugar** et le **gris-bleu slate-900**.
- **`sgVoileEncre(dark, alpha)`** existe et nomme le rôle par lequel le gris-bleu
  rentre à chaque fois. Ne pas ré-inventer, ne pas se contenter d'interdire le hex.
- **`encreSur(aplat)`** existe et dérive l'encre d'un aplat. Toute pilule pleine
  doit l'appeler.

---

## §3 — Les questions à trancher AVANT de coder

Elles ne sont **pas** tranchées. Y répondre avant d'ouvrir un fichier.

### 1. Une série de chantiers, ou un seul ?

773 marqueurs, c'est deux fois la console. Trois découpages possibles :

- **Par surface** (10 chantiers) — chacun avec son banc, sa passe, ses gardes.
  Le plus lisible en revue, le plus lent.
- **Par NATURE de dette** (2 chantiers) — d'abord les 593 grammaires sur les dix
  surfaces, puis les 180 couleurs. Le plus rapide, mais un diff qui touche dix
  surfaces à la fois ne se relit pas.
- **Mixte** : les cinq surfaces jamais portées une par une (462 marqueurs), puis
  UNE passe de couleur sur les cinq déjà portées (Réglages, Calendrier, chrome,
  Parcours, Audit — 122 marqueurs).

⚠ Le mixte est celui que la mesure suggère, parce que la frontière
grammaire/couleur du §2.1 tombe presque exactement sur la frontière
porté/non-porté. **À décider, pas à supposer.**

### 2. Un banc par surface, ou un banc unique du CRM ?

La console a montré que le point d'injection unique existe : `MemoryRouter` pour
la navigation, `window.fetch` pour les données. Les dix surfaces restantes
vivent toutes sous `/dashboard/*`, derrière le **même** `ProtectedRoute`.

Un `/dev/crm` unique les monterait toutes — mais il porterait alors les fixtures
de **34 hooks de plus**, et chaque surface a ses propres formes.

⛔ **À mesurer avant de trancher**, exactement comme sur la console : combien de
hooks, de RPC et de tables par surface, et combien sont partagés. La console a
réfuté la composition par le kit sur cette seule mesure.

### 3. Le chrome partagé : maintenant ou à la fin ?

Ses 58 marqueurs sont rendus par les 28 écrans, dont les onze DÉJÀ portés — donc
onze surfaces réputées propres montent en ce moment un rail et une recherche qui
ne le sont pas.

- **Maintenant** : le gain est immédiat sur tout le CRM, mais il faut le vérifier
  sur au moins deux bancs existants avant de toucher aux surfaces neuves.
- **À la fin** : chaque banc construit d'ici là sert de témoin supplémentaire.

⚠ Quelle que soit la réponse : `crm-sugar/tokens.ts` est un fichier de jetons lu
par tout le CRM. Le toucher en dernier lot serait le toucher quand plus personne
ne regarde.

---

## §4 — Les lots, si la réponse au §3.1 est « mixte »

Chaque surface se traite comme la console : **Lot 0 = le banc**, puis contraste,
puis grammaire, puis gardes. La méthode est décrite dans
`megga/console-admin-meggax` ; ce plan ne la répète pas.

### Vague A — les cinq surfaces jamais portées (462 marqueurs)

Par ordre de poids décroissant, chacune livrable seule :

1. **Aujourd'hui** — 139. La plus grosse, et la page d'accueil du CRM : c'est le
   premier écran que l'agent voit. 94 graisses ≥ 700 à elle seule.
2. **KYC** — 134, éclatés sur TROIS dossiers (`kyc-pager`, `kyc`, `kyc-wizard`).
   ⚠ Surface de CONFORMITÉ : ne rien changer à ce qui est dit, seulement à la
   façon dont c'est composé.
3. **Visites** — 105 sur 3 fichiers seulement, donc la plus DENSE (1 marqueur
   toutes les 22 lignes). `VisitModalSugarV3Page` est une modale : elle relève du
   piège de modale, et `/dev/modales` existe déjà pour l'accueillir.
4. **Analytics** — 82. ⚠ Contient des graphiques : la sonde de rendu y trouvera
   du texte sur aplat coloré, et le piège (g) — texte sur image/dégradé, fond non
   mesurable — s'y appliquera.
5. **Import lead** — 77 sur 3 fichiers, dont une page de 1 597 lignes.

### Vague B — une passe de COULEUR sur ce qui est déjà composé (122 marqueurs)

Réglages (43), chrome partagé (26), Calendrier (12), Julien (11), Parcours (6),
Reste (6), Audit (1). Une seule cible : le **noir de Sugar** et le **gris-bleu**,
tous deux entrant par une fraction d'opacité, tous deux nommés par
`sgVoileEncre`. ⚠ Julien porte en plus 29 grammaires — il n'appartient pas
vraiment à cette vague ; le vérifier.

### Vague C — les gardes, et c'est le livrable qui dure

1. Entrer les dix surfaces dans `ZONES` **avec leurs témoins de zone**
   (`TEMOINS_DE_ZONE`), sans quoi une racine présente dont un sous-dossier
   échappe au filtre passe pour couverte.
2. Une garde de palette sur `megga-x-additions.css`, sur le modèle
   d'`admin-console-css.spec.ts` — celle-ci **dérive** la valeur attendue de la
   palette au lieu de se contenter d'interdire.
3. `POLICES_ASSUMEES` : 18 aujourd'hui. Chaque surface portée doit en retirer ses
   entrées. ⚠ **Recompter avant d'annoncer un chiffre** — le plan Pipeline avait
   dit 28 pour 26, celui de la console 20 pour 20 (juste, mais vérifié).
4. Vérifier que `graphite-scale.spec.ts` couvre les palettes des surfaces neuves.

---

## §5 — Portes

```bash
npx tsc -b                            # 0 erreur
npx eslint src tests --ext .ts,.tsx   # 0 erreur (139 warnings = référence)
npx vitest run                        # 2090 tests + ceux ajoutés
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

Plus, propre à tout chantier de rendu :

- Le banc rejoué **en clair ET en sombre**, captures à l'appui, avant de commiter.
- ⛔ **Les surfaces PORTÉES ouvertes en sombre** — aucune porte automatique ne
  voit le piège de modale.
- ⚠ Un **contrôle négatif** par clause de garde. Trois façons de rapporter un
  faux vert, toutes vécues le 14 août : une variable non substituée qui fait que
  `vitest` **n'exécute aucun test** ; un filtre `-t` qui ne matche rien ; un
  témoin ligne-à-ligne incapable de valider un remplacement multi-lignes.
  **Le harnais doit exiger la preuve qu'un test a TOURNÉ** avant de conclure.
- ⛔ **Ne jamais restaurer avec `git checkout --` pendant un contrôle négatif** :
  l'index porte l'état du lot précédent, et deux fichiers ont ainsi perdu leurs
  correctifs. Restaurer depuis une copie (`cp .bak`).

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche à aucun backend.** C'est un chantier de rendu.
- **Il ne renomme pas `crmSugarPalette`, `useAdminSugar`, ni les dossiers
  `crm-sugar*`.** Les noms ont survécu à la direction qu'ils servaient ; les
  changer est un geste lexical à part, qui touche des centaines d'imports.
- **Il ne touche pas au CRM mobile** (`crm-mobile`), porté en entier le 12 août.
- **Il ne rouvre pas l'arbitrage actif/donnée** : les familles qui ENCODENT une
  information (teintes d'étape, hues de groupe, `TYPE_COLOR`) restent hors
  direction, décision rendue quatre fois.

---

## §7 — Après chaque surface livrée

1. **Mettre le cerveau à jour** — sinon il se périme :
   - compléter `megga/gardes-vacuites` de ce que la surface aura trouvé ;
   - corriger la fiche de la surface si elle la déclarait portée à tort
     (`megga/reglages-meggax-composition` en est un cas déjà identifié) ;
   - `npm run ruflo:seed`, puis vérifier **par l'oracle SQL**, jamais par
     l'affichage de `memory get`.
   - ⚠ Le seed vit dans le **checkout** : reseeder depuis le worktree où l'on
     travaille.
2. **Surveiller la CI avant de merger.** ⚠ Au 14 août, la branche
   `claude/pipeline-meggax-bench-fe8d37` n'a **aucune PR**, donc **aucun run
   CI** : la CI de ce dépôt se déclenche sur `pull_request`. Elle est aussi
   **32 commits derrière `main`** — conflits mesurés sur le seed du cerveau,
   `CLAUDE.md`, `docs/system-map.md` et `scripts/realadvisor-*`, **jamais sur le
   code**.
