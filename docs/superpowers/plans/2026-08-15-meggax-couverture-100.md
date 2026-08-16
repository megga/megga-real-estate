# MEGGA X à 100 % — couvrir tout ce qui peint, puis mesurer ce que la direction promet

> Suite directe du chantier « face publique » ([PR #1205](https://github.com/megga/megga-real-estate/pull/1205),
> 22 commits, CI 6/6 verte sur `492e1e91`). **Même branche distante :
> `claude/pipeline-meggax-bench-fe8d37`.**
>
> ⛔ **Ne sors JAMAIS cette branche.** La locale du même nom est périmée et déjà
> sortie ailleurs. Vérifie que la tête d'origin est ANCÊTRE de ton HEAD
> (`git merge-base --is-ancestor origin/claude/pipeline-meggax-bench-fe8d37 HEAD`)
> et pousse par la forme explicite `git push origin HEAD:claude/pipeline-meggax-bench-fe8d37`.
> La branche d'ici n'a pas d'amont et d'autres sessions poussent dessus : **rebase, jamais force.**
>
> ⚠ Le dépôt `megga/megga-real-estate` est **PUBLIC**. Tout push, commentaire et
> artefact y est publié.

---

## §0 — À lire AVANT, par clé exacte

`CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga`

| Clé | Pourquoi elle décide de ce chantier |
|---|---|
| `megga/gardes-vacuites` | **51 formes.** Les n° **15, 45, 46, 47, 48, 50 et 51** sont les pièges exacts de ce plan. |
| `megga/face-publique-meggax` | Ce qui a été fait au chantier précédent, et pourquoi `MLK` et `RC` sont deux objets. |
| `megga/da-meggax-crm` | Le coût réel d'un reciblage d'accent, et pourquoi `sp.accent` n'est lu que 16×. |
| `megga/crm-mobile-responsive` | Le mobile est COUVERT par le cliquet — ne pas le rouvrir croyant l'ouvrir. |

⚠ `memory get` **plafonne à 64 Kio et TRONQUE sans le dire** ; `gardes-vacuites`
pèse 60 866 caractères, donc passe encore — mais l'oracle reste le SQL :

```bash
sqlite3 .swarm/memory.db "SELECT LENGTH(content) FROM memory_entries WHERE key='megga/gardes-vacuites';"
```

⛔ **Les motifs SQL d'un témoin doivent être SANS ACCENT** : `LIKE` de SQLite ne
plie la casse que sur l'ASCII (forme n° 48).

---

## §1 — Ce que « 100 % » veut dire, et pourquoi le chiffre de 77 % ne suffit pas

**77 % = 255 des 330 fichiers PORTEURS sont sous le cliquet.** Un fichier
« porteur » est un `.tsx` contenant `style={{`, `className=` ou `<style` — les
119 hooks, 41 fichiers de `lib/` et 12 de `types/` ne peignent rien et n'ont
aucune raison d'entrer dans un dénominateur de direction.

⛔ **MAIS LA COUVERTURE N'EST QU'UN DES DEUX AXES, et c'est le moins profond.**
L'audit du 15 août 2026 (12 agents, 10 zones, 2 passes de réfutation) a montré que
le cliquet **mesure moins que ce que la direction promet**. Une zone peut donc
être couverte, verte, et pourtant hors direction.

**100 % = les DEUX axes fermés :**

| Axe | Ce qu'il exige |
|---|---|
| **A — COUVERTURE** | Tout fichier porteur est sous une racine du cliquet **ou** sous une exemption ÉCRITE et testée. « Absent » n'est pas une troisième possibilité. |
| **B — PROFONDEUR** | Le cliquet mesure ce que CLAUDE.md §3 déclare : couleur, échelle, rayons, espacements, police — **dans tous les langages où ils s'écrivent** (style en ligne, classe, attribut JSX, feuille CSS). |

⚠ **Et 100 % ne se DÉCLARE pas, il se GARDE.** Le lot final n'est pas un
comptage : c'est une clause qui énumère les porteurs **depuis le système de
fichiers** et exige que chacun soit couvert ou exempté-avec-motif. C'est la
forme n° 51 — un tiers que la mutation ne peut pas éditer.

---

## §2 — L'état mesuré le 15 août 2026 (à REFAIRE en ouvrant, et à comparer)

### La méthode, transmissible

⛔ **Dérive le périmètre du CLIQUET et du ROUTAGE, jamais d'une page.** Le script
qui calcule la couverture est reconstructible en trois règles — il vivait dans un
scratchpad, qui a été effacé une fois (forme n° 51) :

1. Extraire du cliquet toutes les lignes `root: '…'` avec leur `keep` et leur
   `keepPath`, puis appliquer la sémantique de `collect()` (**elle RÉCURSE**).
2. ⛔ **Retirer les commentaires AVANT d'extraire les ensembles `PAGES` /
   `PAGES_PUBLIQUES`.** La prose française du dépôt contient des apostrophes
   ASCII (« d'être ») : les laisser apparie les quotes de travers et rend un
   ensemble VIDE — `src/pages/public` sortait à 0 sur treize pages réellement
   gardées.
3. ⛔ **Une spec écrite sur UNE SEULE LIGNE se ferme sur elle-même.** Chercher
   son `keepPath` « en avant » attrape celui de l'objet SUIVANT : `crm-mobile`
   héritait ainsi d'une contrainte de profondeur et sortait à 2 fichiers sur 75.

⚠ **Le garde-fou qui a sauvé les deux mesures : « une racine rendue vide ⇒ MON
parseur est faux, pas le dépôt ».** À réécrire en premier.

### Axe A — les 75 porteurs hors cliquet

| Zone | Porteurs | Marqueurs mesurés | Nature |
|---|---|---|---|
| `src/components/megga-x` | 18 | 0 | **la SOURCE de la direction** — exemption de nature |
| `src/pages/dev` | 12 | 24 | bancs `import.meta.env.DEV`, jamais servis |
| `src/components/layout` | 9 | 0 | 2 fichiers déjà couverts nommément |
| `src/components/crm-identity` | 8 | 0 (⚠ un agent annonce 9 polices — à re-mesurer) | onboarding KYB |
| `src/components/ui` | 6 | 0 | primitives shadcn |
| `src/components/auth-bento` | 4 | 1 | ⚠ 1 route vivante sur 15 |
| `src/components/kyc-report` | 4 (+1 `.ts`) | **45** | **PUBLIC** — 22 graisses ≥ 700, 16 micro-capitales, 7 polices |
| `src/components/propertyx` | 4 | 0 | icônes + jetons, seuls vestiges Px |
| `src/components/onboarding-call` | 3 | 0 | |
| `listings`, `skeletons` | 2 + 2 | 0 | |
| `auth`, `map`, `matching-recherche` | 1 + 1 + 1 | 25 | `MrhMapView` = **exemption déjà écrite** (carte gelée, issue #1061) |

Plus, hors du compte des porteurs : `crm/mockData.ts` et
`crm/crmThemeVars.ts`, laissés dehors par le `keep` de la racine.

⛔ **`kyc-report` est le trou le plus grave, et c'est le piège du PÉRIMÈTRE
retombé.** `KycReportRenderPage.tsx` **est** au cliquet depuis le lot 5 et ne
porte que 4 styles en ligne — mais elle **monte** `src/components/kyc-report/`
(45 marqueurs), resté hors de toute racine. Le cliquet met lui-même en garde :
*« c'est le ROUTAGE qui dit ce qui est rendu »*. Route `/kyc-report/:token`, vue
par des clients et des autorités.

### Axe B — ce que le cliquet ne mesure pas

| # | Angle mort | Mesure |
|---|---|---|
| **B1** | **Graisse en ATTRIBUT JSX.** La clause s'ancre sur `fontWeight:` (deux-points) ; un SVG écrit `fontWeight="800"`. | **6 sites** — `AxDashboard`, `AxFirstRun`. Zone COUVERTE, cliquet VERT. |
| **B2** | **Couleur en CLASSES.** `text-gray-500` n'est ni le noir de Sugar ni le gris-bleu — et n'est aucun jeton. | 6 fichiers, dont **4 pages publiques vivantes** (`VisitManage`, `VisitFeedback`, `AcceptInvite`, `ResetPassword`) + `ExternalListingDetailPage` + `ImpersonateBanner`. |
| **B3** | **Échelle en CLASSES.** `text-sm` est un barreau de Tailwind, pas `var(--crm-text-*)`. | 7 des 14 pages publiques sont peintes en classes (8 à 57 `className`, 0 `style={{`). |
| **B4** | **Rayons et espacements.** | **0 citation** de `borderRadius`/`padding`/`--crm-space`/`--crm-radius` dans le cliquet — alors que CLAUDE.md §3.3 déclare qu'un tel littéral **est une régression**. Plusieurs centaines de sites (chiffre contesté, voir §6). |
| **B5** | **Feuilles CSS.** La clause CSS ne lit que `globals.css`. | **8 feuilles.** `responsive.css` est importée par `main.tsx` et porte `font-size: 28px !important` — **28 n'est pas un barreau** (l'échelle saute 24 → 30). |
| **B6** | **Police par une autre clé.** La garde s'ancre sur `fontFamily:`. | `crm-dossiers/tokens.ts:113` écrit `font: '"Inter Tight", …'` ; l'attribut SVG `fontFamily="Manrope"` passe aussi. |

⚠ **B2 et B3 sont DÉJÀ INVENTORIÉS** par la clause « les pages publiques que
l'instrument ne voit pas sont inventoriées », qui dit explicitement ce qu'il ne
voit pas et ne peut que rétrécir. Ce plan ne découvre pas l'angle mort : **il le
ferme.**

### Ce qui est faux dans CLAUDE.md, et qu'il faudra corriger

1. **§3 — « Manrope … la seule chose qui distingue ces écrans du CRM » : FAUX.**
   `MOBILE_FONT` vaut `'Manrope'` et alimente **56 sites** du CRM mobile ;
   s'ajoutent Today, Analytics, Search et deux pages agent — **12 fichiers**.
2. **§3 — « les quatre surfaces sans compte suivent MEGGA X » : FAUX pour
   `/accept-invite/:token`**, qui importe **zéro jeton** et porte 14 classes
   grises.

### Ce qui n'est PAS un défaut, malgré les apparences

⚠ **L'échelle Graphite dans `crm/tokens.ts` est un résidu GARDÉ, pas une
direction vive.** Ses littéraux n'alimentent que `CRM_TOKENS.graphite`, et
`graphite-scale.spec.ts` porte trois clauses qui l'encerclent : « n'alimente plus
que le thème legacy », « aucun fichier de `src/` n'écrit un barreau de l'échelle
Graphite », « aucune de ces surfaces n'est restée sur Graphite ». **Ne pas le
« nettoyer »** sans lire ces clauses d'abord.

---

## §3 — Les questions à trancher AVANT de coder

⛔ **Aucune n'est une mesure. Elles se posent à Julien, et le chantier attend.**

### 1. Manrope : la direction l'adopte, ou 56+ sites basculent ?

Deux réponses cohérentes, une seule à choisir :

- **(a) Manrope entre dans la direction** pour le mobile et les surfaces
  « produit » (Today, Analytics). Coût : ~0 ligne de code, **une correction de
  CLAUDE.md** et une clause qui déclare *où* chaque police a droit de cité.
- **(b) Le CRM revient à `var(--crm-font)`.** Coût : 56 sites mobiles + 6 zones
  desktop, et le mobile change d'aspect sur toutes ses surfaces.

⚠ La face publique garde Manrope dans les deux cas — c'est une décision du
15 août, et elle n'est pas rouverte ici.

### 2. Les 7 pages publiques en classes : repeindre en jetons, ou en classes de thème ?

- **(a) Styles en ligne + jetons**, comme `MLK` et `RC`. Cohérent avec les trois
  faces déjà portées, mais réécrit 200+ lignes de JSX sur des pages qui portent
  **des dates de rendez-vous et des références de dossier**.
- **(b) Classes de thème** (`bg-theme-card`, `text-theme-primary`) : geste plus
  petit, mais introduit un second langage sur la face publique, qui est
  MONO-THÈME par décision et gardée comme telle.

### 3. `auth-bento` : porter, ou SUPPRIMER ?

**1 route vivante sur 15.** Le précédent existe : le portail vendeur a été retiré
en entier le 26 juillet 2026 parce qu'il n'avait jamais servi. Porter une coquille
morte, c'est la déclarer vivante.

### 4. Le gel de `MrhMapView` tient-il ?

Il est adossé à l'absence du jeton Mapbox ([issue #1061](https://github.com/megga/megga-real-estate/issues/1061)).
Si le jeton est posé entre-temps, la carte réelle remplace la schématique et
l'exemption perd son motif.

### 5. `src/components/megga-x` : exemption de NATURE, confirmée ?

Le port de la vitrine **définit** la direction ; le mesurer contre elle est
circulaire. L'exemption doit être écrite comme telle — et sa contrepartie est que
`megga-x.generated.css` (10 500 lignes, 100 % de la DA) ne soit gardé par **rien**
aujourd'hui. ⚠ La réfutation y a trouvé **6 `url("../images/…")` mortes**
(`src/images/` n'existe pas) et un **`@import` réseau vers Google Fonts**
(`megga-x.css:13`).

---

## §4 — Les lots

⛔ **COUVRIR D'ABORD, APPROFONDIR ENSUITE.** L'ordre inverse ferait payer chaque
élargissement zone par zone. Ici, l'axe A se ferme sous les clauses ACTUELLES —
donc vite et par un cliquet qui ne recule plus — puis chaque élargissement de
l'axe B s'applique d'un coup à toute la surface couverte.

### Phase I — COUVERTURE (l'axe A)

| Lot | Contenu | Taille attendue |
|---|---|---|
| **1** | Les zones **sans marqueur** entrent : `layout`, `ui`, `propertyx`, `onboarding-call`, `listings`, `skeletons`, `auth`, `map`, `crm-identity`, + les 2 fichiers de `crm`. | ~30 porteurs, entrée quasi mécanique. ⚠ Re-mesurer `crm-identity` : un agent y annonce 9 polices en dur, mon comptage en donne 0 — **l'écart doit être tranché avant d'entrer**. |
| **2** | **`kyc-report`** — 5 fichiers, 45 marqueurs, surface PUBLIQUE. Graisses ≥ 700, micro-capitales, polices en dur. | Le vrai lot de la phase I. ⚠ **C'est un PDF** : la casse et la graisse y portent peut-être une fonction (en-têtes officiels) — mesurer avant de raboter. |
| **3** | **Les exemptions ÉCRITES** : `megga-x` (source de la direction), `pages/dev` (bancs), `MrhMapView` (gel adossé à #1061), `auth-bento` (selon §3.3). Chacune est une entrée nommée avec son MOTIF, testée. | Une exemption sans motif écrit est un oubli déguisé. |

**Fin de phase I : l'axe A est à 100 %**, et une clause le prouve depuis le
système de fichiers.

### Phase II — PROFONDEUR (l'axe B)

| Lot | Contenu | Effet attendu |
|---|---|---|
| **4** | **B1 + B6 — les ATTRIBUTS JSX.** Étendre les clauses graisse/casse/interlettrage/police au langage `attribut="valeur"`, et la police à la clé `font:`. | 6 sites à reprendre. Petit, prouvé, et ferme une vacuité démontrée. |
| **5** | **B5 — les FEUILLES CSS.** La clause passe de 1 à 8 feuilles. | `responsive.css:28px` sort de l'échelle ; `admin-console.css` et les 3 feuilles de composants entrent. ⚠ `megga-x.generated.css` est GÉNÉRÉE : la garder exige de garder sa SOURCE, pas son produit. |
| **6** | **B2 + B3 — la COULEUR et l'ÉCHELLE en CLASSES**, puis reprise des 7 pages publiques inventoriées. | Le geste le plus visible du chantier, sur des surfaces CLIENTES. Dépend de **§3.2**. ⚠ L'inventaire `AVEUGLES` doit se VIDER, pas être supprimé. |
| **7** | **B4 — RAYONS et ESPACEMENTS.** | Le plus gros. ⚠ Viser zéro d'un coup ferait une PR illisible : poser un **cliquet à plafond décroissant** (le compte ne peut que baisser), et descendre par zones. |

### Phase III — FERMETURE

| Lot | Contenu |
|---|---|
| **8** | La **clause de fermeture** : « tout porteur de `src/` est couvert ou exempté-avec-motif », énumérée depuis le système de fichiers. Puis les **deux corrections de CLAUDE.md** (§2), et le cerveau (`megga/face-publique-meggax`, `megga/gardes-vacuites`). |

---

## §5 — Discipline (non négociable, elle vient du chantier précédent)

1. ⛔ **La garde AVANT le correctif**, et elle doit ROUGIR avant qu'on répare.
2. ⛔ **Contrôle négatif** pour chaque garde : muter ce que la garde MESURE, et
   exiger la preuve que le test a TOURNÉ. Le harnais doit refuser un « essai nul ».
3. ⛔ **Jamais `git checkout --` pendant un contrôle négatif** : copier (`cp .bak`).
4. ⚠ **Quand un contrôle négatif passe au vert, la première hypothèse n'est pas
   « la garde est vacue » — c'est « je n'ai pas lancé la bonne clause ».** Un
   filtre `-t` qui vise une clause pendant qu'une autre attrape la mutation a
   menti **quatre fois** au chantier précédent.
5. ⚠ **Une CAPTURE, pas seulement une lecture DOM.** Le banc `/dev/public` existe
   (`PublicShowcasePage`, contrat posé dans l'initialiseur de `useState`, jamais
   dans un `useEffect`) ; `/dev/crm` couvre onze surfaces agent.
6. ⚠ **Vérifier le cwd du serveur de dev avant toute mesure à l'écran** —
   `launch.json` a déjà servi un autre checkout.
7. ⛔ **Ne touche pas** au backend, ni aux noms (`MLK`, `Mlk*`, `crm-sugar*`), ni
   à un libellé, ni à un chiffre : ces pages portent des dates de rendez-vous et
   des références de dossier.

### Portes

```bash
npm run build          # tsc && vite build — ⚠ `npx tsc -b | tail` lit le code de TAIL, pas de tsc
npx vitest run tests/unit
npm run lint:prose
```

⚠ **La CI ne tourne pas si la PR est en conflit** : sans `refs/pull/N/merge`, il
n'y a **aucun événement `pull_request`**, et le symptôme ressemble à des Actions
désactivées. Le remède est de fusionner `main`, pas de fermer/rouvrir la PR.

⚠ **Un guetteur de CI ne conclut pas sur un SEUIL** (forme n° 51) : ancrer
l'ensemble attendu sur un commit ANCÊTRE déjà réglé, exiger que tous les checks
soient `completed`, et que les NOMS soient identiques sur 3 lectures.

---

## §6 — Ce que ce plan ne fait PAS

- Il **ne tranche pas** les cinq questions du §3 : elles reviennent à Julien.
- Il **ne rouvre pas** le mobile, la console admin ni le pipeline en tant que
  zones : ils sont couverts. Ils ne bougeront que par ricochet des lots 4 à 7.
- Il **ne touche à aucun libellé ni chiffre** sur les surfaces clientes.
- Il **ne fige pas** le compte de rayons/espacements : mon relevé (189 dans
  `crm`, 96 dans `crm-mobile`, 35 dans `components/admin`) et celui des
  agents (127, 67, 262) **divergent** parce que les définitions divergent — les
  leurs incluaient `pages/admin` et d'autres formes d'écriture. ⛔ **Le chiffre
  est à réétablir au lot 7, avec une définition écrite.** Ce qui n'est pas
  contesté, c'est le **0 clause**.
- Il **ne supprime rien** : le retrait d'`auth-bento` est une PROPOSITION (§3.3),
  pas une décision prise.

---

## §7 — L'état à reprendre

- Branche distante `claude/pipeline-meggax-bench-fe8d37`, tête **`492e1e91`**,
  **CI 6/6 verte**, PR [#1205](https://github.com/megga/megga-real-estate/pull/1205)
  `MERGEABLE / CLEAN`, arbre propre.
- **2 320 tests**, dont **21 clauses** au cliquet et **10 specs de contraste**
  (`mlk-contraste` et `rc-contraste` sont les deux dernières nées).
- Le cerveau est à jour : `gardes-vacuites` = **51 formes, 60 866 caractères**.
- ⚠ **`megga-x.generated.css` n'est gardée par rien** et porte 6 URL d'images
  mortes — trouvaille de la passe de réfutation, **non encore corrigée**.

### Après chaque lot livré

1. `npm run build` + `npx vitest run tests/unit` + `npm run lint:prose`
2. Commit avec le POURQUOI dans le corps, pas seulement le QUOI
3. `git push origin HEAD:claude/pipeline-meggax-bench-fe8d37` (après le contrôle d'ancêtre)
4. Surveiller la CI **par l'ensemble attendu**, pas par un seuil
5. Mettre le cerveau à jour (`npm run ruflo:seed`) — une forme neuve par vacuité trouvée
