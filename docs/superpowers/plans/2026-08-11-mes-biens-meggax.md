# Mes biens → direction MEGGA X

**Écrit le 11 août 2026**, à la suite de la même opération menée sur les Réglages
([#1197](https://github.com/megga/megga-real-estate/pull/1197)) et sur le Calendrier
([#1199](https://github.com/megga/megga-real-estate/pull/1199), a11y [#1200](https://github.com/megga/megga-real-estate/pull/1200)).
Base mesurée : `2a18bb2c`.

Ce document est **autonome** : il ne suppose aucune conversation antérieure.

---

## 0. À lire avant de commencer

La recherche sémantique du cerveau **ne remonte pas** ces fiches sur des phrases
génériques du type « direction artistique du CRM » — vérifié le 11.08.2026, elle
rend `megga/overview`. Interroge donc par **clé exacte** :

| Clé | Ce qu'elle t'évite |
|---|---|
| `megga/da-meggax-crm` | La direction, ses barreaux, et le fait que Sugar est **supprimée** (plus de choix, plus de `useCrmDa`) |
| `megga/reglages-meggax-composition` | La grammaire cible, décidée écran par écran |
| `megga/calendrier-meggax` | Le précédent le plus proche, **et l'interdit sur les teintes de type** |
| `megga/shademix-nan-invisible` | Un parseur d'octets qui rend un élément invisible |

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "<phrase>" -n megga
```

⚠ Le tableau de `ruflo` **tronque les clés** (`megga/calendrier-...`). Ne conclus
pas « absente » sur un `grep` du nom complet — c'est une erreur que j'ai commise
deux fois.

---

## 1. La grammaire cible

Décidée sur les Réglages, appliquée au Calendrier. Elle n'est pas à rediscuter.

- **Aucune micro-capitale.** `textTransform: 'uppercase'` est proscrit, et
  l'interlettrage qui l'accompagne (`letterSpacing` ≥ 0,4 sur 11–12 px) part avec
  elle : sur un mot en casse normale il le disloque.
- **Aucune graisse au-dessus de 600.** Les titres d'affichage sont en **500**. La
  vitrine ne règle aucun `display` en 700/800 ; c'est la **couleur d'encre** qui
  porte la hiérarchie, pas la graisse.
- **Libellé de champ** : casse normale, 16 px (`--crm-text-2xl`), poids 400.
- **Tout état actif prend l'accent `#424bfb`**, jamais l'encre.
- Rayons, espacements et tailles passent par `var(--crm-*)`, jamais un littéral.

---

## 2. Ce que la surface contient, mesuré

Cinq zones, ~7 300 lignes. **Les chiffres ci-dessous sont à revérifier** avant de
commencer (le code aura bougé) :

```bash
D=(src/components/crm/biens src/components/crm-mobile/biens \
   src/components/crm-wizard src/pages/agent/ListingsPage.tsx \
   src/pages/agent/ListingDetailPage.tsx src/pages/agent/ListingWizardPage.tsx \
   src/pages/agent/ListingFormPage.tsx)
grep -rho "textTransform: 'uppercase'" $D | wc -l
grep -rho "fontWeight: [78]00" $D | wc -l
grep -rhoE "#[0-9A-Fa-f]{6}" $D | wc -l
```

⚠ **En zsh, un `$D` non quoté ne se découpe pas en mots** — utilise bien un
tableau `D=(…)`. Avec une variable simple, tous les comptes rendent **0** et on
croit la surface propre. Je m'y suis fait prendre.

| Zone | Lignes | Capitales | Graisses ≥ 700 | Hex | Palette |
|---|---|---|---|---|---|
| `crm/biens` (liste, pager) | 2 197 | 7 | 59 | 31 | `crmPalette()` ✅ |
| `ListingDetailPage` (fiche) | 1 039 | 9 | 37 | 2 | `crmPalette()` ✅ |
| `ListingFormPage` (édition) | 3 188 | **0** | **0** | 2 | `crmPalette()` ✅ |
| `crm-wizard` (création) | 4 832 | **33** | **94** | **97** | ⛔ **jetons propres** |
| `crm-mobile/biens` | 273 | 0 | 11 | 4 | jetons mobile |

**Total : 49 capitales, 201 graisses, 136 hex.** Environ quatre fois la dette du
calendrier.

**`ListingFormPage` est déjà propre** (0 capitale, 0 graisse lourde) malgré ses
3 188 lignes. Ne perds pas de temps dessus.

---

## 3. ⛔ Le vrai sujet : le wizard tourne encore en Sugar Pure

`src/components/crm-wizard/tokens.ts` est un **fichier de jetons autonome**,
pas une dérivation. En thème clair :

```
bg:         '#EDEFF3'      ← le gris bleuté de Sugar (MEGGA X : #f9f9f9)
bgGradient: radial-gradient(… #C8D5E0 … #EDEFF3)
black:      '#0B0C0E'      ← L'ACCENT EST NOIR, pas #424bfb
onBlack:    '#FFFFFF'
```

**`#424bfb` n'apparaît nulle part dans tout le wizard.** Il est resté sur la règle
Sugar Pure « l'accent EST l'encre », que la décision du 10 août 2026 a remplacée
par « l'élément actif porte l'accent `#424bfb` » (cf. `CLAUDE.md` §3).

### Pourquoi ce n'est pas un chercher-remplacer

Le noir n'est pas qu'une valeur, c'est une **mécanique** :

| Symbole | Occurrences | Rôle |
|---|---|---|
| `WizardTokens.black` | 58 | l'accent |
| `crmOn(…)` | 47 | l'encre à poser **sur** l'accent |
| `.onBlack` | 6 | idem, en direct |

`crmOn()` existe parce qu'en **sombre** l'accent devient un near-white `#ECEDF3` :
ce qui est posé dessus doit alors s'inverser. Avec `#424bfb` dans les deux thèmes,
l'encre est **toujours** blanche — `crmOn()` devient une constante et ses 47 appels
deviennent une logique morte.

**Décide explicitement** : soit tu gardes `crmOn()` comme indirection (et le test
doit dire pourquoi), soit tu la retires et les 47 sites passent en `MXC_COLOR.n1000`.
Ne laisse pas la question implicite.

### La même asymétrie que le calendrier

La branche **sombre** du wizard dérive **déjà** de `MXC_COLOR` (`n100`, `n200`,
`n300`, `n400`, lignes 84-111). Seule la branche claire est restée Sugar. C'est
exactement le défaut trouvé sur `buildCalPalette()` — voir `megga/calendrier-meggax`.

⚠ **Le `bgGradient` du wizard EST lu** (`WizardShell.tsx:349`). Contrairement à
celui du calendrier, qui était mort et a été supprimé. Ne transpose pas le geste :
ici, le retirer change le rendu.

---

## 4. Découpage proposé

**Lot 1 — la palette du wizard.** `crm-wizard/tokens.ts`.
Faire dériver la branche claire de `mxCrmPalette(false)`, comme la sombre l'est
déjà. Trancher la question `crmOn()`.
*Écrire le garde-fou AVANT le correctif* : sur les Réglages et le calendrier, c'est
ce qui a trouvé ce que l'audit manuel avait manqué. Modèle :
`tests/unit/calendar-palette.spec.ts` — il exempte **nommément** les jetons
sémantiques plutôt que d'interdire en bloc.

**Lot 2 — la grammaire du wizard.** 33 capitales, 94 graisses, 13 fichiers.
Mécanique, à faire d'un bloc **après** le lot 1 (voir le contraste avant de
toucher à la typographie évite de régler deux fois).

**Lot 3 — liste + fiche.** `crm/biens` et `ListingDetailPage` : 16
capitales, 96 graisses. Les couleurs y sont déjà bonnes ; c'est le cas « Réglages ».

**Lot 4 — mobile.** `crm-mobile/biens`, 11 graisses. **Ne le saute pas** : laisser
le mobile en arrière recrée l'écart qu'on vient de fermer ailleurs.

---

## 5. Pièges d'aperçu (aucune session en local)

- **La liste sans session rend une page vide.** Pour atteindre les cartes, le
  pager et la fiche, il faut injecter des données — échafaudage temporaire dans le
  hook, gardé par `location.search.includes('demo')`, **retiré avant commit**.
- **Une route d'aperçu nue vers une page mobile rend l'`ErrorBoundary`** : les
  pages mobiles montent `MobileShell`, qui exige un contexte absent. Passer par
  `/dev/mobile`. ⚠ Sans ça, avant et après sont **identiques** et la comparaison
  ne vaut rien — attrapé par un `shasum`, pas par l'œil.
- Le chemin d'une route d'aperçu doit contenir `/dashboard` : le script d'amorçage
  d'`index.html` ne pose `data-theme="dark"` que si l'URL le contient.

---

## 6. Portes à passer **en local** avant de pousser

```bash
npx tsc -b
npm run lint
npm run lint:deadcode     # ⚠ NE TOURNE QU'EN CI par ailleurs
npm run i18n:parity       # 0 manquante / 0 orpheline
npm run lint:prose        # tiret cadratin interdit dans locales/
npx vitest run tests/unit
npm run build
```

⚠ **`lint:deadcode` est le piège de la journée** : retirer une surface laisse des
exports orphelins (`PfSwitch` a fait rougir la CI sur #1197). Après toute
suppression, lance-le **avant** de pousser.

⚠ Retirer une clé i18n **sans retirer son `t()`** affiche le nom de la clé en clair
à l'écran. Grepe les appels après chaque suppression.

---

## 7. Ce qui reste ouvert ailleurs (hors périmètre, pour mémoire)

- Le **focus n'entre pas** dans la bulle d'événement du calendrier à l'ouverture ;
  l'annonce du chevauchement au montage n'est donc pas garantie. Changement de
  comportement, pas d'attribut.
- Le **sélecteur d'entité CRM** de la modale d'édition du calendrier n'a jamais été
  vu à l'écran (il interroge la base).
