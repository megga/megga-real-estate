# Matching → MEGGA X

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne suppose
> aucune conversation antérieure. Mesures faites les **12–13 août 2026** sur la
> branche `claude/megga-x-mes-biens-6ea5ec` (PR #1201) ; **à revérifier avant de
> coder**, voir §2.
>
> ✅ **Les trois questions ouvertes sont TRANCHÉES** (§3, 13 août) : recibler les
> variables · geler la carte · mode `demo` pour le banc. Commencer par le Lot 0.
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
                        desktop = MatchingPage      (src/pages/agent/)
                        mobile  = MobileMatchingPage     (src/components/crm-mobile/matching/)
```

`MatchingPage` (346 lignes) est un **pager à deux pages**, pas une page :

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
- `AtelierStage.tsx` ne lit `crmPalette` / `sp.` **aucune fois**.
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

1. **La carte Mapbox ne charge pas — mais l'écran N'EST PAS vide.**
   ⛔ **Correction d'une affirmation fausse de la première version de ce plan**, qui
   disait que l'écran affichait un repli « Carte indisponible ». Cette chaîne
   **n'existe nulle part** dans `matching-recherche` ; elle venait d'une fiche de
   mémoire décrivant l'ancienne marketplace, recopiée sans être mesurée.

   Ce qui se passe réellement : `MrhMapView` (342 lignes) teste `HAS_MAPBOX` au
   niveau module. Le jeton étant vide au build
   ([#1061](https://github.com/megga/megga-real-estate/issues/1061)), la branche
   `else` rend **une carte schématique complète et fonctionnelle** — fond dessiné
   (`MapSurface` : grille, eau, parcs), **vraies pastilles de prix positionnées
   depuis les bornes** (`PricePin`, `mrhPos`), commandes de zoom, bouton « vue
   d'ensemble », survol avec aperçu (`MapPopover`).

   **Conséquence pour §3.2 :** geler `MrhMapView`, ce n'est pas geler un carré
   gris — c'est geler **la surface cartographique que l'agent utilise tous les
   jours**, avec ses couleurs propres (`#0F131A` / `#E9EDF2`, eau et parcs en
   rgba) qui ne sortent d'aucun système de tokens.
2. **`MatchingRechercheHybride` n'est pas montable sans session.** Contrairement à
   `AtelierStage` (présentationnel, alimenté par des fixtures dans
   `MatchingAtelierDemoPage`), il porte **ses propres hooks** — `useAuth`,
   `useMatchingSearch`, `useMatchingBuyers`, `useCitySuggest`. La moitié la plus
   lourde du périmètre (≈ 203 marqueurs) **n'a aucun banc**. C'est le Lot 0.

---

## §3 — TRANCHÉ (Julien, 13 août 2026)

Les trois questions sont **décidées**. Ne pas les rouvrir ; les exécuter.

| # | Décision | Effet sur le périmètre |
|---|---|---|
| 1 | **Recibler les 19 variables** d'`atelier.css` vers les tokens partagés. La feuille RESTE. | Lot 2 — voir la table ci-dessous |
| 2 | **Geler la carte** (`MrhMapView`) | −39 marqueurs : Lot 3 passe de ≈203 à **≈164** |
| 3 | **Mode `demo`** sur `MatchingRechercheHybride` | Lot 0 — idiome déjà présent (`MobileMatchingScreen demo`) |

⚠ **Décision 2, à relire une fois avec l'information corrigée** (§2, « limites du
terrain ») : la carte gelée n'est pas un carré gris, c'est une carte schématique
qui rend et qui sert. Le portage livrera donc une page 1 dont la moitié gauche
est portée et la moitié droite ne l'est pas. C'est un choix tenable — la carte
est le morceau le plus risqué et le seul dont le rendu final dépend d'un secret
absent — mais il se **verra**. Si l'écart saute aux yeux à la livraison du Lot 3,
c'est le moment de rouvrir, pas avant.

---

### La table de reciblage (décision 1)

⛔ **Ce n'est PAS un remplacement mécanique.** Cinq lignes de cette table changent
un sens, pas une valeur. Les traiter comme un `sed` casserait l'écran.

**Couleurs — reciblage direct**

| Variable atelier | Clair | Sombre | Cible |
|---|---|---|---|
| `--ink` | `#0B0C0E` ⛔ noir Sugar interdit | `#F3F3F5` | `sp.ink` (`#030303` / `#ffffff`) |
| `--ink-soft` | `#3C3C40` | `#CACACE` | `sp.sub` (`#686868` / `#a3a3a3`) |
| `--surface` | `#FFFFFF` | `#17181A` ⛔ Graphite | `sp.cardBg` (`#ffffff` / `#090909`) |
| `--surface-2` | `#F4F4F5` | `#121213` ⛔ Graphite | `sp.cardSubBg` (`#f9f9f9` / `#050505`) |
| `--cardsub` | `#F2F2F3` | `#1E1F21` ⛔ Graphite | `sp.cardSubBg` |
| `--surface-solid` | `#FFFFFF` | `#17181A` | `sp.solidBg` (`#ffffff` / `#090909`) |
| `--hairline` · `--hairline-2` | rgba(17,17,19,…) | rgba(255,255,255,…) | `sp.cardBorder` (`#cccccc` / `#181818`) |
| `--field` · `--field-bd` | `#F4F4F5` | `#121213` | `sp.cardSubBg` / `sp.cardBorder` |

**Les cinq lignes qui changent un SENS**

1. ⛔ **`--black` / `--black-hover` — le cœur du chantier.** `#0B0C0E` en clair,
   **`#FFFFFF` en sombre** : c'est la règle Sugar Pure « l'accent EST l'encre,
   inversée au sombre ». MEGGA X l'a remplacée le 10 août par « l'élément **ACTIF**
   porte `#424bfb` ». Recibler vers `sp.accent` **n'est pas un changement de
   teinte, c'est un changement de règle** : il faut vérifier les **6 usages** un
   par un et se demander, pour chacun, si l'élément est ACTIF ou seulement
   *appuyé*. Un fond qui était noir parce que « c'était l'accent » et qui devient
   bleu sans être actif serait une régression de sens, pas une mise à jour.
   ⚠ Rappel `CLAUDE.md` §3 : `#424bfb` **ne passe pas AA en TEXTE sur sombre**
   (3,44:1). En aplat il tient (5,78:1, c'est l'encre blanche qui porte). Pour une
   encre teintée sur sombre : `MXC_SYSTEM.blue300`.

2. ⛔ **`--sys-green` · `--sys-red` · `--sys-yellow` · `--sys-blue` : NE PAS
   TOUCHER.** La feuille les documente elle-même comme **fonctionnelles** —
   « données métier, jamais d'accent UI ». Même statut que `CRM_STAGE_HUE` : elles
   **encodent une information**, elles ne décorent pas. Les recibler effacerait
   du sens. ⚠ Vérifier en revanche leur contraste sur les NOUVELLES surfaces —
   `#059669` sur `#090909` n'est pas `#059669` sur `#17181A`.

3. ⚠ **Les 7 rayons ne sont PAS bijectifs.** L'atelier a `10 · 12 · 14 · 16 · 18 ·
   22 · 999`. La grammaire a `2 · 4 · 8 · 12 · 16 · 20 · 24 · 999`. **10, 14, 18 et
   22 n'ont pas de barreau.** Chacun demande une décision (descendre ou monter),
   écrite. Ne pas ajouter de barreau à l'échelle pour faire coïncider : l'échelle
   est verrouillée par `megga-x-crm-tokens.spec.ts`, et l'élargir pour un dossier
   la vide de son sens.

4. ⛔ **Les 3 ombres n'existent pas au sombre.** `sp.shadow` vaut **`'none'`** en
   sombre : « la séparation vient de la BORDURE, pas de l'écart de luminance »
   (`CLAUDE.md` §3). Recibler `--sh-sm` / `--sh` / `--sh-lg` naïvement garderait
   trois niveaux d'ombre là où il ne doit y en avoir aucun. En clair, `MXC_CARD_SHADOW`.

5. ⛔ **`font-family: "Manrope"` → `var(--crm-font)` (Inter Tight) est la ligne la
   plus risquée du fichier.** Ce n'est pas une couleur : les métriques changent,
   donc les longueurs de ligne et le rythme vertical bougent sur **868 lignes de
   CSS** d'un seul geste. La faire **en dernier** dans le Lot 2, isolée, avec
   captures avant/après dans les deux thèmes.

⚠ **Un fait qui explique le reste :** le bloc sombre d'`atelier.css` porte un
commentaire disant « valeurs de `CLAUDE.md` ». Il **dit vrai pour la version de
`CLAUDE.md` de l'époque** — l'échelle Graphite. La référence a bougé le 10 août,
la feuille non. Ce n'est donc pas un dossier négligé : c'est un dossier aligné
sur une norme périmée, ce qui est plus difficile à voir et explique qu'il ait
traversé deux campagnes de retrait.

---

## §4 — Les lots

### Lot 0 — Voir l'écran (à faire EN PREMIER)

Sans banc, `ProtectedRoute` renvoie sur la production (`megga.ch/login`,
redirection **absolue**) : on relit l'ancienne version de son propre travail en
croyant regarder localhost. Le piège ne ressemble pas à une erreur.

1. Étendre `/dev/matching-atelier` au **pager entier** (le chrome, les deux
   pages, la bascule) plutôt qu'à `AtelierStage` seul.
2. **Mode `demo` sur `MatchingRechercheHybride`** (décision §3.3). Il porte
   `useAuth`, `useMatchingSearch`, `useMatchingSearchTotal`, `useMatchingBuyers`,
   `useCitySuggest` : chacun doit avoir un chemin de fixture. Copier l'idiome de
   `MobileMatchingScreen demo`, pas en inventer un second.
   ⚠ **Ne PAS injecter une session pour contourner** : une session injectée rend
   la page sans qu'aucun appel Supabase parte (fiche `megga/…-preview-method`) —
   on croit voir des données réelles et on voit un écran vide.
3. Alimenter les états qui ne s'atteignent pas par hasard : **premier lancement**
   (`MatchingFirstRun`, 11 marqueurs), **liste vide**, **échec de chargement**,
   **carte sans jeton** (l'état par défaut aujourd'hui, cf. §2). Un banc qui ne
   montre que le cas nominal cache exactement les surfaces qu'on va casser —
   défaut vécu sur `/dev/biens`.
4. ⚠ Le banc doit exposer la **bascule de thème** : le Lot 2 touche 41 blocs
   sombres d'un geste, et un banc qui ne rend qu'en clair les laisserait
   invérifiés.

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

### Lot 2 — `atelier.css` : recibler les 19 variables (le cœur)

Exécuter la table de §3, **dans cet ordre** — il n'est pas arbitraire, il va du
mécanique vers le risqué, pour qu'une régression tardive soit facile à isoler :

1. **Les 8 lignes de reciblage direct** (encre, surfaces, filets, champs). Vérifier
   les **41 blocs sombres** : c'est là que Graphite disparaît.
2. **Les 4 couleurs `--sys-*` : ne pas les recibler**, mais **re-mesurer leur
   contraste** sur les nouvelles surfaces.
3. **Les 7 rayons** — 4 n'ont pas de barreau, écrire la décision pour chacun.
4. **Les 3 ombres** — `none` en sombre, `MXC_CARD_SHADOW` en clair.
5. **`--black` / `--black-hover`** : les 6 usages, un par un. C'est un changement
   de RÈGLE, pas de teinte.
6. **La police, en dernier et seule** : `Manrope` → `var(--crm-font)`.

⚠ **Capturer avant/après dans les deux thèmes à chaque étape**, pas seulement à
la fin. 868 lignes touchées d'un geste : c'est le lot où une régression passe le
plus facilement, et un avant/après global ne dirait pas laquelle des six étapes
l'a causée.

### Lot 3 — `matching-recherche` (≈ **164** marqueurs, carte gelée)

Périmètre après la décision §3.2 : `MrhExtDetail` (63), le composant principal
(62), `MrhCard` (17), `MrhSendSheet` (17), `MrhLightbox` (3), `mrh.css` (2).

⛔ **`MrhMapView` (39 marqueurs, 342 lignes) est GELÉ.** Ne pas y toucher « tant
qu'on y est » — c'est la seule façon dont un gel se défait. Ses couleurs propres
(`#0F131A` / `#E9EDF2`, eau et parcs en rgba) restent hors tokens : c'est assumé
et écrit ici pour que ce ne soit pas relevé comme un oubli à la relecture.

⚠ Conséquence visible à surveiller : la page 1 aura une moitié gauche portée et
une moitié droite non portée, **côte à côte** (`.mrh-split-map`). Si l'écart
saute aux yeux une fois le lot livré, c'est le moment de rouvrir §3.2 — avec la
mesure sous les yeux, pas avant.

### Lot 4 — Les restes et la garde qui manque

1. `MatchingPage` + `MatchingAtelierPage` (8 marqueurs).
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
- **Il ne touche pas à la carte** (décision §3.2). `MrhMapView` reste sur ses
  couleurs propres. Le jeton Mapbox absent est par ailleurs un problème de
  secrets ([#1061](https://github.com/megga/megga-real-estate/issues/1061)), pas
  de direction artistique — le réparer ne relève pas de ce chantier.
- **Il ne dissout PAS `atelier.css`** (décision §3.1 = recibler). La feuille
  reste, avec ses 305 `className`. C'est une dette de structure **assumée et
  écrite**, pas un oubli : la dissoudre demanderait de défaire ces 305 classes,
  et le faire sous la pression d'un rendu à corriger casserait la page 0.
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
