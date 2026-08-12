# Matching → MEGGA X

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne suppose
> aucune conversation antérieure. Mesures faites le **12 août 2026** sur la branche
> `claude/megga-x-mes-biens-6ea5ec` (PR #1201), au commit `ded67a34` ;
> **à revérifier avant de coder**, voir §2.
>
> ⚠ **Même branche que Contacts et Mes biens — `claude/megga-x-mes-biens-6ea5ec`,
> PR #1201.** Pousser dessus, ne pas en ouvrir une seconde.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique du cerveau ne remonte pas ces fiches sur une phrase
générique — mesuré encore le 12 août : la fiche `megga/gardes-vacuites` ne sort
sur aucune des trois formulations essayées, alors que son contenu est bien en
base. Les interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** Neuf formes de « garde verte pendant que l'écran est faux ». Les n° 6, 8 et 9 se déclenchent tous les trois sur ce chantier-ci — voir §2. |
| `megga/da-meggax-crm` | La direction : accent `#424bfb` sur l'**actif**, échelle sombre, ce que la vitrine fait de la capitale. |
| `megga/contacts-meggax` | La surface précédente, livrée le 12 août. Ses arbitrages (13/500 pour les libellés, sur-titres à 600) font jurisprudence. |
| `megga/mesbiens-meggax` | Les six pièges qui se répètent, dont les trois façons dont son plan s'est trompé sur le périmètre. |
| `megga/matching-modes` | Ce que la surface FAIT (3 modes du moteur, `include_market`). Ne pas casser une affordance en la repeignant. |
| `megga/matching-refonte` | La refonte Sugar Pure de juillet 2026 — c'est ELLE qu'on remplace. |
| `megga/map-mapbox` | La carte. ⚠ Fiche marquée « EN SOMMEIL » : elle décrit la marketplace publique retirée, pas la carte du CRM. |

Lire aussi `CLAUDE.md` §3 en entier.

---

## §1 — Le périmètre, dérivé du ROUTAGE

⛔ **Ne pas partir du nom des dossiers.** Le plan de « Mes biens » l'a fait et
s'est trompé trois fois. Ce périmètre-ci est dérivé de `src/App.tsx:547`.

```
/dashboard/matching → ResponsiveRoute
                        desktop = MatchingPagerPage      (src/pages/agent/)
                        mobile  = MobileMatchingPage     (src/components/crm-mobile/matching/)
```

`MatchingPagerPage` (346 lignes) est un **pager à deux pages**, pas une page :

| Page | Composant | Dossier |
|---|---|---|
| 0 — Atelier « par score » | `MatchingAtelierPage embedded` | `matching-atelier/` (19 fichiers, 3 730 lignes **+ `atelier.css`, 868 lignes**) |
| 1 — Recherche hybride | `MatchingRechercheHybride` | `matching-recherche/` (14 fichiers, 2 659 lignes + `mrh.css`, 93 lignes) |

Poids total du périmètre **bureau** : ≈ **7 900 lignes**, soit deux fois Contacts.

**✅ Le mobile est DÉJÀ porté — ne pas l'ouvrir.** `src/components/crm-mobile`
est entré en entier dans `megga-x-grammar.spec.ts` le 12 août ; le cliquet est
vert (12 tests). ⚠ Une sonde grossière écrite pour ce plan a compté « 12
marqueurs » dans `crm-mobile/matching/` : ce sont des **exemptions listées** dans
le cliquet, pas de la dette. Le cliquet officiel est l'autorité, pas une regex
réécrite à la main.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé**.

### ⛔ Le chiffre à ne pas croire : « 232 marqueurs »

Le cliquet de grammaire **ne lit que les styles EN LIGNE des `.tsx`**. Porté tel
quel sur le périmètre, il rend 232. C'est **faux d'un facteur deux**, et la façon
dont c'est faux décide de tout le plan :

| Dossier | `className=` | `style={{` | Marqueurs vus par le cliquet | Marqueurs RÉELS |
|---|---|---|---|---|
| `matching-atelier` | **305** | 123 | 20 | **≈ 216** (+196 dans `atelier.css`) |
| `matching-recherche` | 17 | **231** | 201 | ≈ 203 |
| `pages/agent/Matching*` | — | — | 8 | 8 |
| **Total** | | | **232** | **≈ 427** |

L'atelier paraissait presque sain. Il ne l'est pas : il est **stylé en CSS**, et
le cliquet ne voit pas le CSS. C'est le piège n° 6 de `megga/gardes-vacuites`
(« la garde muette prise pour un verdict »), déjà rencontré sur
`ContactImportPage` — ici à l'échelle d'un dossier entier.

Détail d'`atelier.css` (868 lignes) : 88 tailles littérales · 44 graisses ≥ 700 ·
22 polices en dur · 19 rayons littéraux · 18 noirs Sugar · 5 micro-capitales.

### ⛔ `atelier.css` est un SECOND système de tokens, resté sur Sugar Pure

C'est le fait structurant du chantier, et il ne se voit dans aucun compteur.
La feuille déclare **19 variables CSS à elle**, avec **41 blocs de thème sombre** :

```css
--ink:#0B0C0E;              /* le noir Sugar que le cliquet INTERDIT */
--black:#0B0C0E;            /* clair */
--black:#FFFFFF;            /* sombre → « l'accent EST l'encre », inversé */
--surface:#17181A; --surface-2:#121213; --cardsub:#1E1F21;   /* échelle Graphite */
```

Trois règles abandonnées y survivent intactes :

1. **Le noir Sugar `#0B0C0E`**, listé comme interdit dans `megga-x-grammar.spec.ts`.
2. **« L'accent EST l'encre »** (`--black` qui s'inverse en blanc au sombre) —
   remplacée le 10 août 2026 par « l'élément ACTIF porte `#424bfb` ».
3. **L'échelle Graphite** (`#17181A` ×4, `#121213` ×2, `#1E1F21` ×2, `#12161C` ×1),
   dont `CLAUDE.md` §3 dit qu'elle ne peint plus le CRM.

Corollaires mesurés :
- `#424bfb` : **0 occurrence** dans tout le périmètre bureau.
- `var(--crm-*)` : **0** dans `matching-atelier`, **2** dans `matching-recherche`
  — contre **139** dans `crm-mobile/matching`, qui est la référence de « porté ».
- `AtelierStage.tsx` ne lit `crmSugarPalette` / `sp.` **aucune fois**.
- `encreSur()` : **0 usage** dans tout le périmètre.

### ⛔ AUCUNE garde ne lit ces deux feuilles

Vérifié fichier par fichier :

| Garde | Ce qu'elle lit |
|---|---|
| `megga-x-grammar.spec.ts` | styles en ligne des `.tsx` + `src/styles/megga-x.generated.css` |
| `megga-x-crm-tokens.spec.ts` | `src/styles/megga-x.generated.css` + `src/styles/globals.css` |
| `graphite-scale.spec.ts` | **des objets JS/TS uniquement** — il n'ouvre aucun `.css` |

`atelier.css` et `mrh.css` ne sont lus par rien. C'est pour ça que Graphite et le
noir Sugar y ont survécu à deux campagnes de retrait, toutes portes vertes.

### ⛔ Contraste — mesuré au rendu sur `/dev/matching-atelier`

Sonde à composition alpha (remonte les ancêtres ; un fond translucide lu seul ment) :

| Thème | Textes sous AA |
|---|---|
| clair | **31** |
| sombre | **5** |

Les pires, et ce qu'ils disent :

| Ratio | Seuil | Texte |
|---|---|---|
| **1,88:1** | 4,5 | initiales d'avatar « TB » (sombre) |
| **2,92:1** | 4,5 | initiales d'avatar « KH » (sombre) |
| 3,61:1 | 4,5 | onglets « Tous » / « Engagé » / « Sans retour » (clair) |
| 4,03:1 | 4,5 | le prix « CHF 1'100'000 » (clair) |

⚠ Les avatars sont **le défaut déjà corrigé sur Contacts** : l'encre est
**choisie** au lieu d'être **dérivée du fond**. Le remède est connu et tient en
une ligne — `encreSur(aplat)`. Qu'il réapparaisse ici confirme qu'il n'est pas
tenu par une garde, seulement par la vigilance.

### ✅ Ce qui est déjà sain — à ne pas « corriger »

- Le **mobile** en entier (cliquet vert).
- Les **18 modales** du dépôt, y compris les 5 du matching (`SgaConfirm`,
  `SgaSendSheet`, `SgaAnnonceVue`, `MrhSendSheet`) : nom accessible, `aria-modal`,
  piège de focus, Échap — mesurées le 12 août, 0 défaut.
- Le **banc `/dev/matching-atelier`** existe et fonctionne sans session.

### ⚠ Deux limites du terrain, à connaître avant de promettre un écran

1. **La carte est morte en production.** `MrhMapView` lit
   `import.meta.env.VITE_MAPBOX_TOKEN`, vide au build
   ([issue #1061](https://github.com/megga/megga-real-estate/issues/1061)) : l'écran
   affiche son repli « Carte indisponible ». On peut donc redessiner le repli,
   **pas** vérifier une carte vivante. Ne pas faire dépendre un lot de la carte.
2. **`MatchingRechercheHybride` n'est pas montable sans session.** Contrairement à
   `AtelierStage` (présentationnel, alimenté par des fixtures dans
   `MatchingAtelierDemoPage`), il porte **ses propres hooks** — `useAuth`,
   `useMatchingSearch`, `useMatchingBuyers`, `useCitySuggest`. La moitié la plus
   lourde du périmètre (≈ 203 marqueurs) **n'a aucun banc**. C'est le Lot 0.

---

## §3 — À trancher explicitement

⛔ **Ne pas laisser ces trois-là se décider en passant.** Les écrire dans la
réponse avant d'ouvrir un fichier.

### 1. `atelier.css` : reciblage ou dissolution ?

- **(a) Recibler les 19 variables** vers les tokens partagés (`--ink` → l'encre
  MEGGA X, `--black` → l'accent actif, les surfaces → l'échelle sombre de
  `CLAUDE.md` §3), en gardant la feuille. Peu de diff, effet immédiat sur les
  868 lignes, **et le sombre bascule d'un coup** (41 blocs).
- **(b) Dissoudre la feuille** dans la grammaire tokenisée `var(--crm-*)`,
  fichier par fichier. Aligne l'atelier sur le reste du dépôt, mais c'est
  305 `className` à défaire et un risque de régression visuelle sur toute la page 0.

**Recommandation : (a) d'abord, en un lot isolé et mesurable, (b) jamais dans le
même lot.** (a) rend l'écran juste ; (b) est une dette de structure qui peut
attendre et qui, faite sous la pression d'un rendu à corriger, casserait la page.

### 2. La carte : repli redessiné, ou hors périmètre ?

Le repli « Carte indisponible » est ce que l'agent voit réellement aujourd'hui.
Soit on le traite comme une surface à part entière, soit on gèle
`MrhMapView` (39 marqueurs) jusqu'à ce que le jeton existe. **Recommandation :
traiter le repli, geler le reste** — redessiner une carte qu'on ne peut pas
afficher, c'est livrer sans preuve.

### 3. Le banc de `matching-recherche` : scinder ou ajouter un mode ?

- **(a) Ajouter `demo` / `demoData`** à `MatchingRechercheHybride`, comme
  `MobileMatchingScreen demo`. Idiome déjà présent dans le dépôt.
- **(b) Extraire une vue présentationnelle** et laisser les hooks dans la page,
  comme `ContactsPager` / `ContactsSugarV2Page`. Plus propre, plus cher.

**Recommandation : (a).** Le but du banc est de VOIR ; scinder un composant de
2 659 lignes est un chantier en soi, et le faire pour se donner un banc mettrait
le refactor avant la mesure.

---

## §4 — Les lots

### Lot 0 — Voir l'écran (à faire EN PREMIER)

Sans banc, `ProtectedRoute` renvoie sur la production (`megga.ch/login`,
redirection **absolue**) : on relit l'ancienne version de son propre travail en
croyant regarder localhost. Le piège ne ressemble pas à une erreur.

1. Étendre `/dev/matching-atelier` au **pager entier** (le chrome, les deux
   pages, la bascule) plutôt qu'à `AtelierStage` seul.
2. Donner à `MatchingRechercheHybride` de quoi se monter sans session (§3.3).
3. Alimenter les états qui ne s'atteignent pas par hasard : **premier lancement**
   (`MatchingFirstRun`, 11 marqueurs), **liste vide**, **échec de chargement**,
   **repli de carte**. Un banc qui ne montre que le cas nominal cache exactement
   les surfaces qu'on va casser — défaut vécu sur `/dev/biens`.

⚠ **Vérifier le `cwd` du serveur de dev avant toute mesure.** Le port 5173 sert
un AUTRE worktree sur cette machine :
```bash
lsof -a -p "$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t | head -1)" -d cwd -Fn
```

### Lot 1 — Contraste (le plus grave, le moins cher)

⚠ **Écrire la garde AVANT le correctif, et l'éprouver par contrôle négatif** :
réintroduire le défaut, vérifier que la porte rougit, restaurer.

1. Avatars : `encreSur(aplat)` au lieu d'une encre choisie. Corrige 1,88:1 et 2,92:1.
2. Les 31 textes clairs sous AA — les onglets et le prix d'abord, ce sont les
   deux que l'œil cherche en premier.
3. Garde : reprendre `contacts-contraste.spec.ts` en changeant de cible.

### Lot 2 — `atelier.css` (le cœur)

Selon la décision §3.1. Si (a) : recibler les 19 variables, vérifier les 41 blocs
sombres, et **capturer avant/après dans les deux thèmes** — 868 lignes de CSS
touchées d'un geste, c'est le lot où une régression passe le plus facilement.

### Lot 3 — `matching-recherche` (≈ 203 marqueurs en ligne)

Les cinq fichiers portent presque tout : `MrhExtDetail` (63), le composant
principal (62), `MrhMapView` (39, **gelé** si §3.2 = geler), `MrhCard` (17),
`MrhSendSheet` (17).

### Lot 4 — Les restes et la garde qui manque

1. `MatchingPagerPage` + `MatchingAtelierPage` (8 marqueurs).
2. `MatchingFirstRun` (11).
3. ⛔ **Faire lire le CSS du périmètre par le cliquet.** Sans ça, tout le Lot 2
   peut se défaire au premier commit suivant sans qu'une porte bouge — c'est
   exactement ce qui a permis à Sugar Pure et à Graphite de survivre ici. C'est
   le livrable le plus durable du chantier, plus que n'importe quel pixel.

---

## §5 — Portes

```bash
npx tsc -b                    # 0 erreur
npx eslint src tests --ext .ts,.tsx   # 0 erreur (136 warnings = référence)
npx vitest run                # 2017 tests + ceux ajoutés
npm run lint:deadcode         # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci      # cliquet : ne peut que descendre
npm run build
```

Plus, propre à ce chantier :
- Le banc rejoué **en clair ET en sombre**, captures à l'appui, avant de commiter.
- Le cliquet de grammaire **étendu au CSS** (Lot 4) — vert.

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche pas au mobile.** Déjà porté, cliquet vert.
- **Il ne touche pas au moteur de matching** (`matching-engine`, scoring v2,
  `include_market`). C'est un chantier de rendu. Ne pas modifier une affordance
  en la repeignant : lire `megga/matching-modes` avant de déplacer un geste.
- **Il ne répare pas la carte.** Le jeton Mapbox est un problème de secrets
  ([#1061](https://github.com/megga/megga-real-estate/issues/1061)), pas de DA.
- **Il ne dissout pas `atelier.css`** si §3.1 = (a). C'est une dette assumée et
  écrite, pas un oubli.
- **Il ne réordonne pas les deux pages du pager** ni ne fusionne atelier et
  recherche. Si ça doit arriver, c'est une décision produit, pas une conséquence
  d'un portage de DA.

---

## §7 — Après la livraison

1. **Mettre le cerveau à jour** — sinon il se périme :
   - `megga/matching-refonte` décrit la refonte **Sugar Pure** de juillet 2026 ;
     elle devient du passé le jour où le Lot 2 est mergé. Le dire dans la fiche.
   - Créer `megga/matching-meggax` sur le modèle de `megga/contacts-meggax`.
   - Compléter `megga/gardes-vacuites` : le cas « aucune garde ne lit le CSS »
     est une **dixième** forme, distincte du n° 6 (là, l'instrument ne voyait pas
     un fichier ; ici, il ne voit pas un LANGAGE).
   - `npm run ruflo:seed`, puis vérifier par `memory get -k`, pas par `search`.
2. **Surveiller la CI de la PR #1201** avant de merger : elle porte maintenant
   Mes biens + Contacts + Matching, et n'a jamais bouclé un cycle vert complet.
