# Pipeline → MEGGA X

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne suppose
> aucune conversation antérieure. Mesures faites le **13 août 2026** sur la
> branche `claude/megga-x-mes-biens-6ea5ec` (PR #1201) ; **à revérifier avant de
> coder**, voir §2 — le plan précédent s'est trompé sur sept chiffres.
>
> ⚠ **Nouvelle branche.** Contrairement à Contacts / Mes biens / Matching, ce
> chantier ne continue PAS sur `claude/megga-x-mes-biens-6ea5ec`. Ce plan-ci y est
> seulement déposé.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique ne remonte pas ces fiches sur une phrase générique. Les
interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/gardes-vacuites` | **La plus importante.** Treize formes de « garde verte pendant que l'écran est faux ». Les n° 6, 10, 11 et 13 se déclenchent tous sur ce chantier — voir §2. |
| `megga/matching-meggax` | Le chantier précédent, livré le 13 août. Ses six pièges se répètent, et sa méthode (garde d'abord, contrôle négatif, banc avant de croire fini) est celle à reprendre. |
| `megga/pipeline-v2-sugar-pure` | Ce qu'on remplace — et ⚠ elle affirme que l'écran « est passé à MEGGA X » le 10 août. C'est **vrai pour une moitié seulement** (§2). |
| `megga/da-meggax-crm` | La direction. Contient l'arbitrage, **rendu quatre fois**, qui protège `SG_STAGE_HUE`. |
| `megga/pipeline-kanban` | Ce que la surface FAIT : 9 colonnes UI qui agrègent 14 stades DB, drag-drop HTML5 natif. Ne pas casser une affordance en la repeignant. |
| `megga/deal-detail` | La fiche deal : stepper 8 cercles, **bannière KYC bloquante**, chaîne d'offres. |
| `megga/pipeline-firstrun-ecartee` | ⛔ La couverture de premier lancement est **écartée définitivement** (verbatim Julien). Ne pas la réintroduire, ne pas redemander l'asset. |

Lire aussi `CLAUDE.md` §3 en entier.

---

## §1 — Le périmètre, dérivé du ROUTAGE

⛔ **Ne pas partir du nom des dossiers.** Le plan de « Mes biens » l'a fait et
s'est trompé trois fois ; celui du Matching a compté le CSS deux fois. Ce
périmètre-ci est dérivé de `src/App.tsx`.

```
/dashboard/pipeline            → ResponsiveRoute
                                   desktop = PipelinePage      (767 l.)
                                   mobile  = MobilePipelinePage       ✅ DÉJÀ PORTÉ
/dashboard/transactions/:id    → desktop = DealDetailPage      (673 l.)
                                   mobile  = MobileDealDetailPage     ✅ DÉJÀ PORTÉ
/dashboard/transactions/:id/offre/:kind → OfferPage (43 l.)
                                            → crm-sugar-v3/offer-modal (909 l.)
```

| Zone | Fichiers | Lignes | Marqueurs |
|---|---|---|---|
| `pages/agent` (les 3 pages) | 3 | 1 483 | **97** |
| `crm-sugar/pipeline` | 11 | 2 321 | **94** |
| `crm-sugar-v3` — part Pipeline | 5 + offer-modal | ~1 670 | ~30 |
| **Total** | | **≈ 5 500** | **≈ 220** |

**✅ Le mobile est DÉJÀ porté — ne pas l'ouvrir.** `crm-mobile` est entré en
entier dans `megga-x-grammar.spec.ts` le 12 août ; le cliquet est vert.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé**.

### ⛔ « Le Pipeline est déjà passé à MEGGA X » — vrai pour UNE MOITIÉ

`megga/pipeline-v2-sugar-pure` l'affirme, et le cerveau a raison sur ce qu'il a
vu. Mais la mesure sépare nettement deux populations :

| | `sp.` | `sp.accent` | hex distincts |
|---|---|---|---|
| `crm-sugar/pipeline/` (colonnes, cartes, modales) | **139** | **20** | — |
| `PipelinePage` | lit `crmSugarPalette` | 0 | **1** (`#0B0C0E`) |
| `DealDetailPage` | lit `crmSugarPalette` | 0 | **15** |

Les **composants** sont portés. Les **pages** délèguent la palette mais peignent
encore à la main par-dessus — c'est exactement le constat d'ouverture de
`megga/da-meggax-crm` (« la bascule n'avait porté que la coquille »), une
campagne plus tard, sur les deux surfaces qu'elle n'avait pas atteintes.

⚠ **Conséquence de méthode : ne pas croire un cerveau qui dit « porté » sans
mesurer QUELLE PART.** C'est une variante du piège n° 6 — un verdict global sur
une zone dont l'instrument n'a vu qu'une partie.

### ⛔ Le vrai second système de jetons : `crm-sugar-v3/tokens.ts`

C'est le fait structurant, et il est **plus lourd que celui du Matching**.
`SugarV3` déclare une échelle de gris complète, **hors** de MEGGA X :

```
#0B0C0E  ⛔ le noir Sugar, interdit par le cliquet
#1F2024 #3A3D44 #7A8088 #B5BAC2 #C8D5E0 #E2E5EB #EDEFF3 #F7F8FA
                                    ↑ gris-BLEU (B−R = 24), la teinte que
                                      `atelier.css` avait dû neutraliser
```

⚠ **Il est lu par 28 fichiers.** `atelier.css` ne servait qu'un dossier ; celui-ci
est le kit commun de **onze pages** — KYC, Audit, Visites, Contacts, Biens,
Import-lead, la fiche deal et la modale d'offre. Le toucher déborde du Pipeline.
**C'est la décision n° 1 du §3.**

⚠ Et **aucune garde ne l'ouvre** : seul `crm-sugar-v3/vitrine` (la fiche bien)
est entré dans `megga-x-grammar.spec.ts` au lot 4 de « Mes biens ». Le reste du
kit n'a jamais été mesuré — dixième forme de garde vacuité, la même qui a laissé
Graphite survivre dans `atelier.css`.

### ⛔ Six fichiers sur un cliquet qui ne doit que RÉTRÉCIR

`POLICES_ASSUMEES` (`megga-x-crm-tokens.spec.ts`) liste les fichiers qui écrivent
encore une police en dur. Six appartiennent à cette chaîne :

```
crm-sugar/pipeline/LostConfirmModal.tsx      crm-sugar-v3/offer-modal/OfferModalSugar.tsx
crm-sugar/pipeline/NewDealModal.tsx          pages/agent/DealDetailPage.tsx
crm-sugar/pipeline/SignedBento.tsx           pages/agent/PipelinePage.tsx
```

⚠ Le test refuse toute entrée devenue morte : les sortir de la liste **fait
partie du correctif**, ce n'est pas un nettoyage optionnel. Livrable chiffrable :
**28 entrées → 22**.

### Répartition des ≈ 220 marqueurs

| | graisses ≥700 | capitales | interlettrage | noir Sugar | tailles |
|---|---|---|---|---|---|
| pages (3) | 27 | 7 | 7 | 5 | **51** |
| `crm-sugar/pipeline` | **62** | 9 | 8 | 14 | **1** |

⚠ **L'inverse du Matching.** Là-bas, 97 tailles littérales et peu de graisses ;
ici `crm-sugar/pipeline` est déjà tokenisé sur les tailles (1 seule littérale) et
porte sa dette sur la **graisse**. Ne pas recopier l'ordre des lots du Matching.

### ✅ Ce qui est déjà sain — à ne pas « corriger »

- Le **mobile** en entier (cliquet vert).
- **Aucune palette parallèle** : ni `SET_PALETTE`, ni `TK`, ni `buildPal`. Les
  deux pages appellent `crmSugarPalette(dark)`. C'est un dossier plus propre que
  les Réglages ne l'étaient.
- ⛔ **`SG_STAGE_HUE` et `sgMix` RESTENT.** Arbitrage rendu **quatre fois**
  (`megga/da-meggax-crm`) : ces teintes **encodent l'étape du deal**, elles ne
  décorent pas. Les dérivations sont figées (colonne .81/.85, tintInk .45/.35,
  pilule .32). Mesuré : 12 usages. ⚠ Comme pour les `--sys-*` du Matching, il
  faudra **re-mesurer leur contraste** sur les nouvelles surfaces sans les
  recibler — c'est là que le Matching a trouvé sa pastille à 4,37:1.

### ⚠ Trois limites du terrain, à connaître avant de promettre un écran

1. **Il n'y a AUCUN banc.** `src/pages/dev/` n'a rien pour le Pipeline. Sans
   session, `ProtectedRoute` fait `window.location.replace('https://megga.ch/login')`
   — une redirection **absolue** : on relit `main` en croyant regarder localhost.
   C'est le Lot 0, et il est plus lourd qu'ailleurs (voir §4).
2. ⛔ **`layoutId` sur `SugarDealCard`.** Le FLIP de `motion` est posé en
   `layoutId={\`sgdeal-${deal.id}\`}`. `megga/crm-da-meggax-*` documente qu'un
   `layoutId` **global vide les colonnes jumelles** : deux vues montées en même
   temps (kanban + liste, ou le banc qui empile les états) partagent l'identité
   et les cartes s'aspirent. Tout banc qui monte deux vues à la fois le
   déclenchera.
3. **La bannière KYC est BLOQUANTE.** Elle interdit certains stades tant que le
   KYC n'est pas vérifié, avec override audité (`severity=critical` si signé).
   ⛔ Ce n'est pas un ornement : la repeindre sans la rendre plus visible serait
   une régression de conformité, pas de style.

---

## §3 — Les trois questions à trancher AVANT de coder

Le plan du Matching a perdu du temps à laisser ses questions ouvertes jusqu'au
milieu du chantier. Celles-ci se posent **maintenant**.

### 1. `crm-sugar-v3/tokens.ts` — jusqu'où ?

| Option | Portée | Ce que ça coûte |
|---|---|---|
| **A · Périmètre strict** | ne toucher que ce que la chaîne Pipeline rend | La fiche deal reste sur une échelle grise étrangère à MEGGA X ; le gris-bleu survit ; on repasse forcément plus tard |
| **B · Kit entier** | recibler `SugarV3` en une fois | **28 fichiers, 11 pages** — KYC, Audit, Visites, Contacts, Biens. Ce n'est plus un chantier Pipeline |
| **C · Recibler les valeurs, garder le nom** | `SugarV3.*` pointe sur `mxCrmPalette` | Le geste du Matching sur `atelier.css`. Rayonne quand même sur 11 pages, mais **sans toucher un seul appelant** |

⚠ **C est probablement la bonne**, et c'est précisément ce qu'a fait le Matching :
la feuille reste, ses valeurs changent. Mais le rayonnement doit être **assumé et
mesuré**, pas découvert au moment où une page KYC change de gris.

### 2. La fiche deal fait-elle partie du chantier ?

Elle porte **15 hex distincts sur 673 lignes** et 63 marqueurs — c'est la moitié
lourde. Mais elle a sa propre route, son propre stepper, sa bannière KYC.
La traiter à part donnerait deux chantiers cohérents ; la traiter ici donne un
écran cohérent de bout en bout. **À trancher, pas à découvrir en route.**

### 3. Quel banc, et jusqu'où ?

Le Matching a montré qu'un banc partiel coûte plus qu'il ne rapporte : cinq fois
le banc a caché la surface à regarder. Ici il faut au minimum les **trois vues**
(kanban / liste / timeline), les **états d'exception** (vide, échec, premier
lancement — ⛔ sans couverture, cf. `pipeline-firstrun-ecartee`), la **bascule de
thème**, et les **modales** (NewDeal, LostConfirm, SignedBento, l'offre).
⚠ Et le piège `layoutId` du §2.2 se déclenchera si le banc empile deux vues.

---

## §4 — Les lots

### Lot 0 — Voir l'écran (à faire EN PREMIER)

1. Banc permanent `/dev/pipeline`, sur l'idiome de `/dev/matching-atelier` :
   monter la **page réelle** avec un slot de contenu, jamais une copie — un banc
   qui recopie la mécanique mesure sa copie.
2. Les trois vues, les états d'exception, les modales, la bascule de thème.
3. ⚠ **Vérifier le `cwd` du serveur de dev avant toute mesure.** Le port 5173
   sert un AUTRE worktree sur cette machine :
   ```bash
   lsof -a -p "$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t | head -1)" -d cwd -Fn
   ```
4. ⚠ Le serveur lancé depuis une session Claude est **fauché à la fin du tour**
   (enfant de `Claude.app`) et son port change à chaque relance. Pour une session
   longue, le lancer soi-même.

### Lot 1 — Contraste (le plus grave, le moins cher)

Sonde à composition alpha sur le banc, **dans les deux thèmes**, avant tout
correctif. Attendus d'après les chantiers précédents :

- les teintes `SG_STAGE_HUE` en **encre** sur les nouvelles surfaces (le Matching
  y a trouvé 4,37:1) ;
- toute encre posée sur un aplat venu de la **donnée** → `encreSur()` ;
  **mesuré : 0 usage d'`encreSur` dans tout le périmètre** ;
- ⚠ les pièges de sonde (f) et (g) de `megga/gardes-vacuites` : volet masqué =
  transition gelée, et texte sur image = fond non mesurable.

Garde écrite **AVANT** le correctif, éprouvée par **contrôle négatif**.

### Lot 2 — `crm-sugar-v3/tokens.ts` (le cœur, selon la décision §3.1)

Recibler les ~22 valeurs. ⚠ Vérifier le rayonnement sur les 11 pages à chaque
étape, pas à la fin. Le gris-bleu `#C8D5E0` (B−R = 24) et le noir Sugar `#0B0C0E`
sont les deux à traiter en premier — ce sont eux que les gardes existantes
interdisent déjà ailleurs.

### Lot 3 — Les deux pages (97 marqueurs)

`DealDetailPage` (63) puis `PipelinePage` (34). Dette
majoritairement de **taille** (51) — l'inverse du dossier de composants.

### Lot 4 — `crm-sugar/pipeline` (94 marqueurs)

Dette de **graisse** (62). Les tailles sont déjà tokenisées.

### Lot 5 — Les gardes, et c'est le livrable le plus durable

1. Entrer `crm-sugar/pipeline`, `crm-sugar-v3` (hors `vitrine`, déjà couvert) et
   les trois pages dans `megga-x-grammar.spec.ts`.
2. Sortir les **six** fichiers de `POLICES_ASSUMEES` (28 → 22).
3. Une garde de palette sur `SugarV3`, sur le modèle de
   `matching-atelier-css.spec.ts` : chaque valeur est un barreau MEGGA X ou une
   teinte sémantique **nommée**.
4. ⛔ Sans ça, tout le Lot 2 peut se défaire au premier commit suivant sans qu'une
   porte bouge — c'est exactement ce qui a permis à Sugar Pure et à Graphite de
   survivre dans `atelier.css` à deux campagnes de retrait.

---

## §5 — Portes

```bash
npx tsc -b                            # 0 erreur
npx eslint src tests --ext .ts,.tsx   # 0 erreur (139 warnings = référence)
npx vitest run                        # 2041 tests + ceux ajoutés
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

Plus, propre à ce chantier :
- Le banc rejoué **en clair ET en sombre**, captures à l'appui, avant de commiter.
- `POLICES_ASSUMEES` descendu à 22 entrées.
- ⚠ Un **contrôle négatif** par clause de garde, avec la substitution **vérifiée
  avant lecture** — un contrôle dont le motif ne s'applique pas ressemble à un
  succès.

---

## §6 — Ce que ce plan ne fait PAS

- **Il ne touche pas au mobile.** Déjà porté, cliquet vert.
- **Il ne touche pas au moteur** : agrégation 14 stades → 9 colonnes, drag-drop
  HTML5, `useUpdateTransactionStage` (qui écrit DEUX tables), triggers KYC,
  `nextAction` ← reminders. C'est un chantier de rendu.
- ⛔ **Il ne réintroduit PAS la couverture de premier lancement** — écartée
  définitivement par Julien, verbatim, et l'asset n'existera pas.
- **Il ne recible PAS `SG_STAGE_HUE`.** Il la **re-mesure**.
- **Il ne renomme pas `crmSugarPalette` ni `SugarV3`.** Le nom a survécu à la
  direction qu'il servait ; le renommer est un geste lexical à part.

---

## §7 — Après la livraison

1. **Mettre le cerveau à jour** — sinon il se périme :
   - `megga/pipeline-v2-sugar-pure` devient du passé pour l'apparence ; le dire.
   - Créer `megga/pipeline-meggax` sur le modèle de `megga/matching-meggax`.
   - Compléter `megga/gardes-vacuites` de ce que ce chantier aura trouvé.
   - `npm run ruflo:seed`, puis vérifier **par `memory get -k`**, jamais par
     `search`.
2. **Surveiller la CI** avant de merger.
