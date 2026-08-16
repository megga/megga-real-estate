# Contacts → MEGGA X

> Plan **autonome**, écrit pour être ouvert dans une session neuve : il ne suppose
> aucune conversation antérieure. Mesures faites le **12 août 2026** sur `main`
> + la branche `claude/megga-x-mes-biens-6ea5ec` (PR #1201) ; **à revérifier**
> avant de coder, voir §2.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique du cerveau ne remonte pas ces fiches sur une phrase
générique. Les interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/mesbiens-meggax` | La surface précédente. Contient les six pièges qui se répètent, dont les trois façons dont son plan s'est trompé. |
| `megga/da-meggax-crm` | La direction elle-même : accent sur l'ACTIF, échelle sombre, ce que la vitrine fait de la capitale. |
| `megga/reglages-meggax-composition` | Première surface portée. Ses arbitrages de sur-titres font jurisprudence. |
| `megga/calendrier-meggax` | Deuxième surface. C'est là qu'est né le piège « un correctif ne traverse qu'un des deux dossiers ». |

Lire aussi `CLAUDE.md` §3 en entier. En particulier : **l'élément actif porte
l'accent `#424bfb`**, jamais l'encre ; les rayons, espacements et tailles passent
par `var(--crm-*)`.

---

## §1 — Le périmètre, dérivé du ROUTAGE

⛔ **Ne pas partir du nom des dossiers.** Le plan de « Mes biens » l'a fait et
s'est trompé **trois fois** : la palette de la fiche vivait un dossier plus loin,
le mobile tenait dans trois dossiers au lieu d'un, et le calendrier avant lui
avait déjà donné la leçon. Ce périmètre-ci est dérivé de `src/App.tsx`.

| Route | Bureau | Mobile |
|---|---|---|
| `/dashboard/contacts` | `ContactsPage` | `MobileContactsListPage` |
| `/dashboard/contacts/new` | → redirige vers la liste | `MobileNewContactPage` |
| `/dashboard/contacts/import` | `ContactImportPage` (pas de variante mobile) | — |
| `/dashboard/contacts/:id` | `ContactDetailPage` | `MobileContactDetailPage` |

Ces pages sont des **coquilles** : elles montent le chrome (`CrmTopNav`,
`CrmIconRail`), câblent les hooks et délèguent le rendu à
`src/components/crm/contacts-pager/` — 7 fichiers, 3 926 lignes.

**✅ Le mobile est DÉJÀ porté.** `src/components/crm-mobile/` est entré en entier
dans le cliquet `megga-x-grammar.spec.ts` le 12 août : mesuré à **0 marqueur**
sur les 9 fichiers de `crm-mobile/contacts/`. C'est la grande différence avec
« Mes biens ». Ne pas rouvrir ce dossier « pour vérifier » — le cliquet le tient.

---

## §2 — Ce que la mesure a trouvé

Refaire ces mesures avant de coder et **dire si elles ont bougé**.

### Grammaire et palette (capitales, graisses ≥ 700, interlettrage, noir Sugar, tailles littérales)

| Fichier | Lignes | Marqueurs |
|---|---|---|
| `contacts-pager/ContactDetailPager.tsx` | 1 433 | **70** |
| `contacts-pager/NewContactModal.tsx` | 1 167 | **42** |
| `contacts-pager/ContactsPager.tsx` | 780 | **30** |
| `contacts-pager/WhatsAppConnectModal.tsx` | 189 | 8 |
| `contacts-pager/ContactsFirstRun.tsx` | 251 | 3 |
| `glyphs.tsx`, `ncvIcon.tsx` | 106 | 2 |
| `pages/agent/ContactDetailPage.tsx` | 271 | 5 |
| `pages/agent/ContactsPage.tsx` | 198 | **0** |
| `pages/agent/ContactImportPage.tsx` | 669 | **0** |

**≈ 160 marqueurs**, dont **142 dans trois fichiers**. C'est un chantier
concentré, pas un balayage.

### ✅ Ce qui est déjà sain — à ne pas « corriger »

- **Pas de fichier de jetons autonome.** La palette descend de
  `crmPalette()` et voyage en prop `sp`. C'était le gros du lot 1 de « Mes
  biens » ; ici il n'y a rien à faire.
- **Aucune donnée fabriquée** dans `contacts-pager`. Pas de mock appliqué, pas
  d'animation d'extraction. (Le seul `import` de `mockData` est un **type**.)
- **La sauvegarde de la note écrit vraiment** — `update.mutateAsync` après un
  débounce de 600 ms ([ContactDetailPage.tsx:244](../../../src/pages/agent/ContactDetailPage.tsx#L244)).
  Ce n'est pas le mensonge du wizard. Mais voir §3.

### ⛔ Les défauts, par gravité

**1. Encre blanche figée sur des aplats de données.** Exactement le défaut
corrigé sur « Mes biens » le 12 août — le correctif existe déjà, il suffit de
l'appliquer.

- `ContactsPager.tsx:105` — avatar : `color: sp.accentInk` (blanc) sur
  `c.avatarBg`, qui vient de `pickAvatarBg()`. **Cinq des huit couleurs de cette
  palette échouent l'AA sous blanc** (`#F59E0B` : 2,15:1).
- `ContactsPager.tsx:118` — pilule de type : `color: '#fff'` sur `CTP_FN`.
  Mesuré : `seller` 4,37 · `tenant` 3,68 · `ok` 3,77 — **trois sur quatre sous
  le seuil**. Seul `buyer` (#1E5BC6) passe, à 6,24.

**Le correctif est `encreSur()`** (`@/components/megga-x-crm/tokens`), qui dérive
l'encre de l'aplat. Ne PAS choisir de nouvelles couleurs : c'est ainsi que
naissent les exceptions écrites à la main.

⚠ `CTP_FN` porte déjà une correction de contraste **documentée et volontaire**
pour le TEXTE en sombre (`#6F8CFF` au lieu de `#1E5BC6`). Lire le commentaire
lignes 28-36 avant d'y toucher : le corriger « au nom de la fidélité au
prototype » serait une régression.

**2. Polices en dur** — interdit par `CLAUDE.md` §3, et aucun garde-fou ne
couvre ces fichiers :

- `'Inter Tight', system-ui, sans-serif` dans `NewContactModal.tsx:840`,
  `ContactsFirstRun.tsx:171`, `WhatsAppConnectModal.tsx:93`, et le toast de
  `ContactDetailPager.tsx:389`
- `'JetBrains Mono'` dans `NewContactModal.tsx:193`

**3. Le toast « enregistré » cumule quatre écarts** en une ligne
(`ContactDetailPager.tsx:389`) : `#0B0C0E` (le noir Sugar), `#FFFFFF`,
`fontWeight: 700`, et `'Inter Tight'`.

**4. Le trio capitale + graisse 800 + interlettrage** est encore présent, par
exemple `ContactDetailPager.tsx:860` :
`fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase'`.

### ⚠ Une exception à respecter, pas à corriger

`ContactsFirstRun.tsx` est **mono-thème par décision**, comme `BiensFirstRun` et
la couverture Pipeline : fond `#0A0B0D` et textes blancs en dur quel que soit le
thème. Son en-tête le dit. **Ne pas ramener ses couleurs vers les jetons.**

⚠ Mais l'exception couvre les **couleurs**, pas la grammaire : ses
`fontWeight: 700` et sa police en dur restent à corriger. Distinguer les deux
est le geste juste ; tout exempter en bloc serait la facilité.

---

## §3 — À trancher explicitement

**a) La note échoue en silence.** `onSaveNote` est un `(v: string) => void`
fire-and-forget, quand `onSaveIdentity` et `onSaveCoord` rendent des
`Promise<void>` dont l'échec est traité. Si l'écriture de la note échoue, l'agent
ne voit rien — il a tapé, il croit que c'est parti. C'est la même famille que le
témoin menteur du wizard, en moins grave. **Décider** : aligner la note sur les
deux autres (promesse + état visible), ou l'assumer par écrit.

⚠ Vérifier aussi si le timer de débounce est nettoyé au démontage : quitter la
fiche pendant les 600 ms pourrait écrire après coup, ou perdre la frappe.

**b) Le toast est-il optimiste ?** `useSavedFlash` dit « après un enregistrement
réussi ». Le vérifier : s'il se déclenche avant la résolution de la promesse,
c'est le défaut du wizard à l'identique.

**c) `ContactImportPage` (669 lignes, 0 marqueur) — dans le lot ou hors ?**
Elle est propre côté grammaire, ce qui laisse penser qu'elle a déjà été portée
ou qu'elle n'a jamais eu de dette. Mesurer son **rendu** avant de conclure : la
grammaire propre ne dit rien de la palette ni du contraste.

---

## §4 — Les lots

**Écrire le garde-fou AVANT le correctif**, à chaque lot, sur le modèle de
`tests/unit/biens-contraste.spec.ts`. Éprouver chaque garde par **contrôle
négatif** : réintroduire le défaut, vérifier que la porte rougit, restaurer.

### Lot 0 — Voir l'écran (à faire en premier)

⛔ **Sans ça, le reste est aveugle.** `ProtectedRoute` fait
`window.location.replace('https://megga.ch/login')` — une redirection **absolue**
vers la production : sans session locale, on est déposé sur `app.megga.ch`, qui
sert `main`, en croyant regarder localhost. C'est ce qui a rendu le lot « Mes
biens » invisible pendant des heures.

Créer `/dev/contacts` sur l'idiome existant de `/dev/biens`
([BiensShowcasePage.tsx](../../../src/pages/dev/BiensShowcasePage.tsx)) :
harnais **permanent**, sans session, zéro échafaudage dans le code de
production.

⚠ Trois pièges déjà payés sur ce harnais :
1. Il doit lire `megga.sugar.dark` (valeurs `'1'` / `'0'`, **pas** `'true'`),
   sinon il rend clair dans une page sombre et **fabrique** des défauts qu'on
   passera des heures à chercher.
2. Il doit montrer les éléments FRAGILES. `/dev/biens` ne montrait aucune
   pastille de score faute de `health` dans les données de démonstration — le
   banc cachait précisément l'élément défectueux.
3. `preview_start` démarre le serveur dans le répertoire de **lancement** de la
   session, pas dans le worktree où elle s'est déplacée. Vérifier avec
   `fetch('/src/…/Fichier.tsx').then(r=>r.text()).then(t=>t.includes('<symbole que je viens d ajouter>'))`.

### Lot 1 — Contraste (le plus grave, le moins cher)

Appliquer `encreSur()` à l'avatar et à la pilule de type. Étendre
`biens-contraste.spec.ts` — ou créer `contacts-contraste.spec.ts` — pour couvrir
les quatre `CTP_FN` et le chemin réel de l'avatar.

Puis **mesurer au rendu**, dans les deux thèmes, avec la sonde qui : applique le
seuil WCAG correct (3:1 au-dessus de 18 px ou 14 px gras, 4,5 sinon), remonte au
premier fond **opaque**, et **abandonne** si une image traverse — le texte sur
photo ne se mesure pas ainsi, et c'est un faux positif connu.

⚠ Regarder les DEUX thèmes. Les neuf défauts de « Mes biens » ne cassaient que
le thème clair, et les captures avaient été prises en sombre.

### Lot 2 — Grammaire de `ContactsPager` + `ContactDetailPager`

112 des 160 marqueurs. Ajouter `src/components/crm/contacts-pager` aux
`ZONES` du cliquet **en même temps** qu'on nettoie — une zone absente n'est pas
déclarée propre, elle est déclarée non traitée.

⛔ Trois défauts de garde-fou déjà rencontrés, à ne pas refaire :
1. Un motif ancré sur `fontWeight:\s*[789]00` ne voit pas
   `fontWeight: sel ? 700 : 600`. Lire l'**expression entière**.
2. Une garde exigeant `var(` juste après `fontSize:` refuse un ternaire valide.
   Effacer les `var(--crm-*)` **puis** chercher un chiffre.
3. Exempter un FICHIER est trop grossier — exempter **expression par
   expression**.

⚠ Et le balayage mécanique s'est trompé 5 fois sur « Mes biens », vu à la
relecture du diff : le détecteur de « titre d'affichage » lisait une fenêtre de
±3 lignes et prenait le barreau d'un élément voisin. **Relire le diff.**

⚠ `<strong>` et `<b>` héritent `bolder` (→ 700) du preflight Tailwind, sans
`fontWeight` dans le source. Le garde-fou est vert et l'écran est faux. Les
chercher au RENDU.

### Lot 3 — `NewContactModal` + les polices en dur

42 marqueurs, plus les cinq littéraux de police. Remplacer par la variable de
police du CRM.

### Lot 4 — Les restes

`WhatsAppConnectModal` (8), `ContactsFirstRun` (3, **grammaire seulement**),
`ContactDetailPage` (5), glyphes (2).

---

## §5 — Portes

Toutes à 0 avant chaque commit :

```bash
npx tsc -b && npm run lint && npm run lint:deadcode && npm run i18n:parity && npm run lint:prose && npm run lint:i18n && npx vitest run tests/unit && npm run build
```

⚠ `npm run lint` sort ~136 **avertissements** de base. C'est le nombre
d'**erreurs** qui doit être 0.

---

## §6 — Ce que ce lot ne fait PAS

- **Le mobile** — déjà porté, tenu par le cliquet.
- **Les 8 boutons peints en encre** ailleurs dans `src/` (analytics,
  notifications, `BuyerReceptionPage`, `settings/focus/ProfileFocusSection` où
  l'état ACTIF est l'encre). Même famille, autres surfaces.
- **Les espacements en dur** — ce n'est pas la dette de ce chantier. Mesuré sur
  « Mes biens » : 201 sur la fiche contre 209 dans le wizard déjà porté. Les
  chasser sur une seule surface creuserait l'écart au lieu de le fermer.

---

## §7 — Après la livraison

Mettre le cerveau à jour, sinon il se périme : éditer
[.claude-flow/knowledge/megga-memory.seed.json](../../../.claude-flow/knowledge/megga-memory.seed.json)
puis `npm run ruflo:seed`.

⚠ Deux pièges du cerveau, payés le 12 août :
- Une écriture `ruflo memory store` nue **ment** : succès affiché, zéro
  persistance. Passer par le seed.
- `ruflo memory get` **tronque** ses cellules : greper sa sortie fait conclure à
  tort que le reseed n'a pas pris. L'oracle est SQL —
  `sqlite3 .swarm/memory.db "SELECT LENGTH(content), content LIKE '%…%' FROM memory_entries WHERE key='…';"`
