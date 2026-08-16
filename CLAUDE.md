# CLAUDE.md — MEGGA Real Estate

> Source de vérité pour Claude Code. Lis-le avant de coder.
>
> **🧠 CERVEAU SYSTÈME — à consulter AVANT toute tâche non triviale :**
> Une cartographie vivante de TOUS les rouages (archi, KYC, WhatsApp, matching, pipeline,
> copilote IA, marketplace, intégrations, signatures…) existe et doit être utilisée.
> 1. Carte lisible (point d'entrée) : [docs/system-map.md](docs/system-map.md)
> 2. Mémoire sémantique locale (0 API) :
>    `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "<phrase topique>" -n megga`
>    (⚠ le flag ET la version épinglée sont nécessaires — sans eux la recherche répond
>    « no results » sur un cerveau plein. ⚠ Interroger par une PHRASE, jamais par un mot-clé :
>    un mot seul passe sous le plancher de score et rend « no results » lui aussi, flag correct
>    ou non ; cf. « Maintenir le cerveau » de docs/system-map.md)
> 3. Source de la mémoire : [.claude-flow/knowledge/megga-memory.seed.json](.claude-flow/knowledge/megga-memory.seed.json)
>
> **APRÈS avoir livré une feature / un changement d'archi :** mettre le cerveau à jour
> (sinon il se périme). Routine : éditer le seed JSON (+ `docs/system-map.md` si besoin),
> puis `npm run ruflo:seed`. Détails : section « Maintenir le cerveau » de docs/system-map.md.
>
> **Docs détaillés (externalisés pour économiser des tokens) :**
> - 🧠 Carte système / rouages : [docs/system-map.md](docs/system-map.md)
> - Schéma DB complet : [docs/schema.md](docs/schema.md)
> - Pages et routes réelles (inventaire, pas spec) : [docs/pages.md](docs/pages.md)
> - Modules IA (specs Gregory) : [docs/ai-modules.md](docs/ai-modules.md)
> - Design system patterns (Sugar v2 CRM) : [docs/design-system.md](docs/design-system.md)
> - Design system Property X (Marketplace — ⚠ ARCHIVÉ, marketplace désactivée) : [docs/design-system-propertyx.md](docs/design-system-propertyx.md)
> - Roadmap sprints : [docs/roadmap.md](docs/roadmap.md)
> - Changelog : [docs/CHANGELOG.md](docs/CHANGELOG.md)
> - Langue des e-mails, ce qui reste : [docs/email-i18n-handoff.md](docs/email-i18n-handoff.md)
>
> **🎨 Vestiges Property X (marketplace désactivée — pivot CRM-first) :**
> Le design system Property X, ses 11 pages `/design-system/*` et le catalogue `figma-catalog.ts`
> (ainsi que le skill `figma-to-section`) ont été **retirés** avec la marketplace. Il ne subsiste
> que le **système d'icônes** utilisé par tout le CRM — `MEIcon`, `PxIconFont`, `PxSocialIcon`,
> `PxWhatsAppButton` — et les **tokens `PX.*`** ([src/components/propertyx/tokens.ts](src/components/propertyx/tokens.ts)).
> Utiliser ces tokens pour tout ce qui touche à l'iconographie ; ne pas réintroduire d'atomes Px
> de présentation (PxButton, PxBadge, PxInput…). Seule route DS survivante : `/design-system/megga-x`
> (MeggaX, port de la vitrine — voir [src/components/megga-x/](src/components/megga-x)).

---

## 1. PROJET

**Nom :** MEGGA Real Estate — SaaS immobilier AI-native, compliance-first
**Marché :** Suisse (26 cantons, 4 langues)
**Client :** Gregory Lyonnet, agent immobilier à Genève
**Développeur :** Julien (frontend — Claude Code gère le backend)

**Vision :** Compliance-First Transaction OS — CRM transactionnel verticalisé + pipeline LAB/KYC + copilote IA métier. La marketplace publique est désactivée depuis le pivot CRM-first (juin 2026) ; son backend Flatfox reste branché pour le matching CRM (voir §8).

**5 objectifs (Document Maître) :** Toute fonctionnalité doit servir au moins 1 :
1. Réduire le temps administratif
2. Réduire le risque LAB/KYC
3. Accélérer le closing
4. Augmenter la transparence client
5. Remplacer un outil fragmenté

**Positionnement :** System of record + workflow engine + rules engine + AI copilot. L'IA est compliance-enabling, PAS compliance-replacing. Validation humaine obligatoire.

---

## 2. STACK TECHNIQUE

```
Frontend :     React 18+ / TypeScript / Vite / Tailwind CSS 3
UI Kit :       shadcn/ui + Radix UI
State :        React Query (TanStack Query)
Routing :      React Router v6
Forms :        React Hook Form + Zod
Drag & Drop :  HTML5 natif (pipeline Kanban) · dnd-kit (réordonnancement photos ListingForm)
Maps :         Mapbox GL JS (react-map-gl)
Icons :        Lucide React
Charts :       Recharts
i18n :         react-i18next (FR/DE/EN/IT)

Backend :      Supabase Pro (eayczugyrvmtqnnmvjod, eu-west-1)
               PostgreSQL 15+ / Edge Functions (Deno) / Auth / Storage / Realtime / pgvector / pg_cron
IA :           DeepSeek (deepseek-chat) pour TOUT le texte via Edge Functions — décision coût
               Vision/OCR/PDF : Gemini (Google) — DeepSeek n'a pas de vision. AUCUN Claude/Anthropic.
Email :        Resend (megga.ch DKIM/SPF)
Payments :     Stripe
Hosting :      Cloudflare Pages — 2 projets : megga-real-estate (megga.ch vitrine),
               megga-app (app.megga.ch CRM, console super-admin comprise)
CI/CD :        GitHub Actions → Cloudflare Pages + Supabase Edge Functions auto-deploy

Marketplace :  DÉSACTIVÉE (pivot CRM-first juin 2026) — /acheter /louer → vitrine megga.ch
               Backend conservé : market_listings ~173k (dont ~35k flatfox actives) + flatfox-sync
               (pg_cron 04:00 UTC)
               sert uniquement le matching CRM, aucun affichage public dans cette app
```

### Commandes

```bash
npm run dev          # Dev server localhost:5173
npm run build        # Build production (tsc + vite)
npm run lint         # ESLint
```

---

## 3. DESIGN SYSTEM

> Patterns détaillés (composants, exemples TSX) : voir [docs/design-system.md](docs/design-system.md)

**🎨 DIRECTION UNIQUE = MEGGA X (depuis le 10 août 2026, [PR #1194](https://github.com/megga/megga-real-estate/pull/1194)).**
**Sugar est SUPPRIMÉE** — il n'y a plus de choix, plus de préférence `megga.da`,
plus de hook `useCrmDa`, plus d'attribut `<html data-crm-da>`, plus de blocs CSS
`[data-crm-da="…"]` ni d'alias `--crm-sugar-*`. Tout ce qui parle de Sugar Pure,
de Graphite ou d'une direction alternative dans ce document ou dans le cerveau
décrit désormais le PASSÉ.

Mécanique, à connaître avant de toucher au style :
1. **Couleurs** — `crmPalette(dark)` rend `mxCrmPalette(dark)`. Le nom a
   survécu à la direction qu'il servait (33 points de construction et le type
   `CrmPalette`) ; le renommer est un geste lexical à part.
2. **Police et grammaire** — variables CSS déclarées dans le `:root` de
   [globals.css](src/styles/globals.css). Elles étaient une surcharge posée sur
   un sélecteur de direction ; la direction retirée, elles SONT l'échelle.
3. **Grammaire tokenisée** — rayons, espacements et tailles de texte ne sont pas
   des littéraux : ~4200 valeurs en variables CSS sur 161 fichiers, échelle
   normalisée à 13 barreaux de texte. **Écrire un littéral de rayon/espacement/
   taille dans un composant est une régression.**
4. **L'élément ACTIF porte l'accent `#424bfb`** (décision Julien, 10 août 2026).
   Remplace la règle Sugar Pure « l'accent EST l'encre », qui peignait l'actif en
   encre inversée — donc en non-couleur. ⚠ Exception : la pastille d'avatar est
   déjà l'accent, son état ouvert garde `sp.ink` pour contraster.

**Où vit quoi** — la distinction compte pour ne pas créer une seconde échelle :
[megga-x-crm/tokens.ts](src/components/megga-x-crm/tokens.ts) ne porte que la
**couleur** (ce qui alimente `mxCrmPalette()`) ; la **grammaire et la police**
sont des variables CSS, parce qu'elles doivent pouvoir basculer sur un conteneur.
[megga-x-crm-tokens.spec.ts](tests/unit/megga-x-crm-tokens.spec.ts) verrouille les
deux : les couleurs contre les variables de la vitrine, et le bloc CSS lui-même —
chaque rayon et chaque espacement doit être un barreau réel de la feuille.

⚠ Le **texte** s'en écarte volontairement sur **11 et 13 px**, absents de la
vitrine (ses tailles sautent 10 → 12 → 14). Le CRM a besoin de ces demi-pas. Le
test fige cet écart au lieu de l'interdire : en ajouter un demande de l'écrire,
donc d'en décider.

Les deux routes de décision (`/design-system/da-compare`, `/design-system/pipeline-mx`)
ont été retirées le 9 août 2026, la direction étant tranchée.

**Direction :** Minimal, transparent, professionnel (Linear/Notion style). Dark/light mode sur dashboard agent.

**⚠ « Sugar Pure » — HISTORIQUE.** Sa grammaire (ombre douce sans bordure,
accent noir unique, pilules à fond plein) a régi Pipeline, modale Nouveau deal et
fiche deal V4 de juillet 2026 au 10 août 2026. Ces surfaces sont passées à
MEGGA X. Ce qui SUBSISTE d'elle : les teintes d'étape `CRM_STAGE_HUE` et les
dérivations `crmMix`, gardées parce qu'elles **encodent une information** (l'étape
du deal), pas parce qu'elles décorent.

**🌒 Sombre — échelle MEGGA X.** L'échelle « Graphite » (`#12161C`→`#21242F`,
5 paliers) ne peint PLUS le CRM : ses 110 appels à `crmStep` ont été repris, et
`crmStep`, le choix de teinte (Graphite / Noir pur), `useDarkTone` et
`megga.darkTone` sont supprimés. Le **mode** sombre est conservé.

Correspondance appliquée, **par rôle et non par numéro** — Graphite *montait* ses
sous-surfaces, MEGGA X les *creuse* :

| Rôle | Token | Valeur |
|---|---|---|
| canvas | `sp.pageBg` | `#030303` |
| cadre bento, rail, top nav | `sp.frameBg` | `#050505` |
| carte, colonne, ligne | `sp.cardBg` | `#090909` |
| sous-carte **creusée** | `sp.cardSubBg` | `#050505` |
| survol, **élevée** | `sp.focusSurface` | `#181818` |
| flottante (modale, popover) | `sp.solidBg` | `#090909` |

1. **La séparation vient de la BORDURE**, pas de l'écart de luminance —
   `sp.shadow` vaut `'none'` en sombre, comme la vitrine. Écart mesuré
   canvas↔carte : 1,078:1 (Graphite) → **1,036:1** (MEGGA X).
2. ⛔ **Un élément posé sur une surface TEINTÉE reste un VOILE translucide**, pas
   un palier opaque. La migration Graphite avait converti mécaniquement les
   pastilles « + » des colonnes du pipeline en S3 opaque : des blocs gris au
   milieu de colonnes colorées.
3. ⛔ **L'accent `#424bfb` ne passe pas l'AA en TEXTE sur sombre** (3,44:1). En
   aplat il tient (5,78:1, c'est l'encre blanche qui porte). Pour une encre
   teintée sur sombre : `MXC_SYSTEM.blue300` (#8dc1ff, 10,6:1).
4. ⛔ **Les couleurs de système de la vitrine sont PÂLES** — réglées pour un
   canvas `#030303`. Sous encre blanche : 1,7:1. Sous `n100` : 11–19:1. Un
   remplissage pâle prend TOUJOURS l'encre sombre.

Garde-fous : [megga-x-crm-tokens.spec.ts](tests/unit/megga-x-crm-tokens.spec.ts)
(couleurs = barreaux réels de la vitrine, seuils AA, aucune police en dur, aucun
lecteur de `CrmTheme.primary`) et
[graphite-scale.spec.ts](tests/unit/graphite-scale.spec.ts) (aucune palette
d'écran n'est restée sur Graphite).

**Règles visuelles clés :**

> ⚠ **SEPT RÈGLES REMESURÉES LE 16 AOÛT 2026, UNE SEULE ÉTAIT ENCORE VRAIE.** Les
> six autres décrivaient Sugar Pure, pas MEGGA X — et une règle fausse ici coûte
> plus qu'un écart dans le code : c'est ce qu'un agent lit AVANT d'écrire, donc
> elle se recopie sur chaque surface neuve. Chaque correction porte son chiffre et
> sa méthode ; un chiffre sans date se périme sans prévenir.

- Bentos : `rounded-xl border border-theme-border`. ⚠ **« PAS d'ombres » ÉTAIT FAUX
  EN CLAIR, et un test EXIGE le contraire.** Mesuré : **740 `boxShadow` en style en
  ligne sur 188 fichiers** (contre 6 classes `shadow-*`), et
  [megga-x-crm-tokens.spec.ts:311](tests/unit/megga-x-crm-tokens.spec.ts) exige que
  `SET_PALETTE.shadow` CONTIENNE `MXC_CARD_SHADOW` — une valeur confrontée ligne 106
  à la feuille de la vitrine, donc **l'ombre de carte vient de la direction
  elle-même**. La règle vraie est celle du mode : `MXC_CARD_SHADOW` en clair,
  `shadow: 'none'` en sombre (ligne 316 l'interdit explicitement), parce que MEGGA X
  y sépare par la BORDURE. Ce qui reste proscrit, ce sont les ombres de Tailwind
  (`shadow-card`, `shadow-sm`), qui ne suivent aucun thème.
- Boutons : ⚠ **CETTE RÈGLE DÉCRIT SUGAR PURE, corrigée le 15 août 2026.** Elle
  disait « style ghost — JAMAIS `bg-accent text-white` », ce qui CONTREDIT la
  décision du 10 août écrite quatre points plus haut. Mesuré sur `src/` : **120
  sites peignent une affordance en accent** (102 `background: *.accent`, 18
  `bg-accent`) dans 36 fichiers, contre **11** au ghost canonique. La règle vive
  est celle du point 4 — **l'affordance PRIMAIRE porte l'accent**, le ghost est
  le SECONDAIRE. ✅ **UN SEUL ACCENT depuis le 15 août 2026.** La rampe
  Tailwind portait un second bleu (`#2563EB`) que rien ne rattachait à MEGGA X ;
  elle adopte l'accent de marque. ⚠ Mais **deux JETONS, un par rôle**, parce
  qu'aucune valeur unique ne tient les deux en sombre :
  `--color-accent-solid` = `#424bfb` dans les deux thèmes (l'APLAT, 5,78:1 sous
  blanc) ; `--color-accent` = `#424bfb` en clair et **`#8dc1ff`** en sombre
  (l'ENCRE et les filets — l'accent y rend 2,95:1, sous l'AA ET sous le seuil des
  filets, donc l'anneau de focus tomberait avec). `#8dc1ff` est
  `MXC_SYSTEM.blue300`, le barreau déjà nommé pour ce cas. Gardé par
  [accent-ramp.spec.ts](tests/unit/accent-ramp.spec.ts)
- Badges : ⚠ **RÈGLE INVERSÉE, et une garde exige l'inverse.** Elle disait « texte
  coloré sans fond (`text-red-500`, pas `bg-red-100 text-red-800`) ». Mesuré :
  **25 des 27 fichiers de badge/pilule/puce posent un fond**, et
  [contacts-contraste.spec.ts:250](tests/unit/contacts-contraste.spec.ts) assère
  qu'une pilule porte bien `background:`. L'idiome vivant est **l'aplat sous une
  encre lisible** — c'est d'ailleurs ce que gardent les dix specs de contraste. Ce
  qui reste proscrit est la palette Tailwind BRUTE (`bg-red-100 text-red-800`) :
  ni jeton de thème, ni jeton sémantique, elle ne bougera pas si la direction bouge.
- Modals : `createPortal(document.body)`. ⚠ **« TOUJOURS … avec `z-[100]` » n'est
  vrai ni pour l'un ni pour l'autre.** Mesuré : **33 des 36 fichiers de
  modale/panneau/dialogue** appellent `createPortal` — la règle tient à trois près —
  mais le z-index est un **désordre assumé nulle part** : **175 sites `zIndex`
  portant 44 valeurs DISTINCTES**, dont seulement **10** valent 100. Aucune garde ne
  le mesure. Poser `z-[100]` sans regarder ses voisins est donc un coup de dé, pas
  une convention : lire l'empilement local d'abord.
- **Steppers : l'étape courante porte l'ACCENT, et la progression se lit dans la
  GÉOMÉTRIE.** ⛔ La règle précédente disait « monochrome (numéros + underline) » :
  mesuré le 16 août 2026, **aucun stepper du dépôt n'a jamais utilisé
  d'underline**, et l'accent a remplacé le monochrome le 10 août. Elle décrivait
  Sugar Pure, pas MEGGA X. Trois idiomes coexistent, chacun justifié par le NOMBRE
  d'étapes — ne pas en inventer un quatrième :
  - **barre segmentée** quand les étapes n'ont pas de nom utile (`WizardShell`,
    7 étapes : segments de 4 px, `i <= etape ? accent : line`) ;
  - **pilules à libellé** quand elles en ont un et qu'on peut revenir en arrière
    (`KwStepper`, 3 étapes : actif = pilule d'accent, fait = coche verte, à venir
    = sourdine) ;
  - **barre segmentée, encore** quand l'étape est une DONNÉE et non une position
    dans un formulaire. ⛔ **CE POINT DISAIT « `dealStepper`, 8 CERCLES » : IL N'Y A
    AUCUN CERCLE.** Mesuré le 16 août 2026 sur les deux seuls consommateurs —
    `DealDetailPage:100` et `MobileDealDetailScreen:179` rendent tous deux
    `CRM_STAGE_ORDER.map(...)` en `flex: 1, height: 4` : une **barre de 8 segments**,
    la même forme que `WizardShell`. Le « 8 » était juste (8 colonnes UI pour 14
    stades DB), la forme non.
    ⚠ Et les deux segments ne se peignent pas pareil : le mobile met l'étape
    courante en `accent`, le bureau la peint en `ink` — donc **le bureau n'applique
    pas la règle du 10 août** (« l'élément ACTIF porte l'accent »). Écart réel, non
    tranché.
  - **cercles numérotés** — l'idiome que ce point ne nommait pas. `KycStepper`
    (alias `SgStepper`, [primitives.tsx:341](src/components/crm-dossiers/primitives.tsx))
    rend des pastilles de 32 px reliées par un trait de 2 px, portant `✓` si l'étape
    est faite et **son rang sinon**. Unique consommateur hors primitives :
    `ImportLeadPage:302`.
  ⚠ **Pas de numéro de rang** : trois étapes alignées SONT 1, 2, 3, et l'accent dit
  déjà laquelle est courante. Ce qui reste marqué est ce que la position ne dit
  pas — « fait », par une coche. La règle annonçait **deux** exceptions ; il y en a
  **trois**, et la troisième n'est pas une exception mais un OUBLI D'INVENTAIRE :
  `IdentityShell` (onboarding KYB) suit la nav `.mx-stepper` de la VITRINE, dont
  le numéro fait partie ; le wizard mobile affiche un compteur `n / N`, qui n'est
  pas un rang mais une distance restante sur un écran sans place pour les
  libellés ; et **`KycStepper` affiche bel et bien le rang** (`{done ? '✓' : i + 1}`),
  sans motif écrit. Il porte pourtant DÉJÀ la coche que la règle prescrit — le
  numéro y est donc redondant avec la position, exactement ce que la règle vise.
  À trancher : le retirer, ou l'inscrire comme troisième exception.
- Scrollbars : `.scrollbar-hide` sur modals et pipeline
- Notifications sidebar : pas de dot rouge par défaut (système Messages retiré du CRM agent)

**Thème CSS Variables :**
```
Dark mode :   Page #1C1C1C | Cards #2A2A2A | Borders #383838 | Text #ECECEF | Muted #8E8E96
Tokens :      bg-theme-page, bg-theme-card, bg-theme-section, bg-theme-sidebar, bg-theme-hover, bg-theme-active
              text-theme-primary, text-theme-secondary, text-theme-tertiary, text-theme-muted
              border-theme-border, border-theme-border-subtle
```

**JAMAIS utiliser** : `bg-white`, `text-gray-900`, `border-gray-200` (cassent le dark mode), `shadow-card`, `shadow-sm`

> ⚠ **ET LA CLAUSE QUI GARDE `bg-white` NE LIT QUE LES CLASSES.** Mesuré le 16 août
> 2026 : **6** occurrences de `bg-white` en `className` — que le cliquet compte et
> plafonne — contre **17 fonds blancs écrits en STYLE EN LIGNE**
> (`background: '#fff'`), qui lui sont invisibles. Le même défaut, dans l'autre
> langage. Une partie est légitime (encre blanche sur aplat, papier A4 du rapport
> KYC) ; la garde de valeur est [couleur-barreaux.spec.ts](tests/unit/couleur-barreaux.spec.ts).

**Typo :** ⚠ **`--crm-font` vaut `"Inter Tight"`** (globals.css `:root`), pas DM Sans —
cette ligne annonçait la police de **Sugar**, supprimée le 10 août 2026. Mesuré le
15 août : DM Sans ne survit qu'en **repli** (`admin-console.css`, `index.html`) et
dans deux fichiers de jetons archivés (`propertyx`, `auth-bento`). `index.html`
charge quatre familles — Inter Tight, Manrope, DM Sans, Plus Jakarta Sans — dont
une seule habille le CRM. Échelle : les 13 barreaux `--crm-text-*` (11 → 38 px),
pas des noms de taille Tailwind.

**🌐 LA FACE PUBLIQUE — ce que le CLIENT voit** (portée le 15 août 2026). Quatre
surfaces sans compte : `/kyc/:token`, `/rendez-vous/:token`, `/reception/:token`,
`/accept-invite/:token`. Elles suivent MEGGA X, avec **trois écarts assumés** :

1. **Manrope**, pas Inter Tight — décision Julien. ⚠ Cette ligne disait « c'est,
   avec le dégradé bleuté, **la seule chose qui distingue ces écrans du CRM** » :
   **FAUX, et corrigé le 15 août 2026 avec le chiffre.** `MOBILE_FONT` vaut
   Manrope et alimente **34 emplois dans 23 fichiers** du CRM mobile ; NEUF
   fichiers du CRM de BUREAU l'écrivaient aussi (Analytics, « Aujourd'hui », la
   recherche, deux pages agent). Mesuré à l'écran sur « Aujourd'hui » : **29
   éléments rendaient en Inter Tight et 26 en Manrope** — deux polices se
   partageaient le même écran, presque à parts égales.

   ✅ **LA FRONTIÈRE EST DÉSORMAIS UNE RÈGLE, pas un constat** (décision Julien,
   option (b) du plan « 100 % ») : **Inter Tight (`var(--crm-font)`) est la
   police de l'agent au BUREAU ; Manrope est celle du MOBILE et de tout ce que
   voit un CLIENT.** Le bureau est revenu au jeton — 15 sites, 8 fichiers.
   Gardée dans les deux sens par [polices-domaines.spec.ts](tests/unit/polices-domaines.spec.ts).

   ⚠ TROIS POLICES RESTENT HORS RÈGLE PARCE QU'ELLES ENCODENT, nommées dans la
   garde : `ui-monospace` (une suite lue caractère par caractère),
   `Caveat, cursive` (la SIGNATURE du rapport KYC — en Inter Tight ce n'est plus
   une signature), `'Cormorant Garamond'` (la police que l'AGENT CHOISIT pour sa
   galerie — une donnée saisie, pas un choix de direction).
2. **Mono-thème.** Zéro `dark` / `prefers-color-scheme` / `matchMedia` sur les six
   fichiers ; les deux gardes le DISENT et rougiront le jour où ça change.
3. `inkSoft` / `soft` = `#3A3D44`, hors échelle par **mesure** (n400 est à 1,16:1
   de n100 en clair — un doublon, pas un cran). Même valeur qu'Analytics.

Deux objets de jetons, deux specs : `MLK` (kyc-magic-link, 2 surfaces) et `RC`
(réception acheteur). ⛔ Le cliquet de grammaire **ne lisait pas du tout** ce
dossier avant ce chantier, et sa clause « aucun élément cliquable peint en encre »
y est **aveugle par le nom** — elle cherche `…ink`, le jeton s'appelait `black`.
La règle est donc gardée dans `mlk-contraste.spec.ts`, testée sur la **valeur**.
Cf. `megga/face-publique-meggax` et `megga/gardes-vacuites` n° 45-47.

⚠ **« Elles suivent MEGGA X » ÉTAIT FAUX POUR `/accept-invite/:token`** — elle
n'importait AUCUN jeton et portait 23 couleurs de palette Tailwind brute. C'est
vrai depuis le 15 août 2026 : elle est portée, et **deux autres pages clientes
l'ont rejointe** — `/visit/:id/edit` et `/visit/:id/feedback`, que cette section
ne comptait pas parce qu'elles ne prennent pas leur jeton dans le chemin mais
dans la QUERY. La face publique fait donc **SIX** surfaces sans compte, pas
quatre.

⛔ **DEUX ENCRES SÉMANTIQUES ÉTAIENT SOUS L'AA sur ces pages**, et c'est mesuré,
pas préféré : `text-red-500` rendait **3,76:1** sur carte blanche et
`text-emerald-600` **3,77:1**. Elles passent par `MLK_STATUT` — la famille qui
ENCODE, tenue SÉPARÉE de `MLK` parce que la direction ne la gouverne pas :
`#B91C1C` (6,47:1) et `#047857` (5,48:1). ⚠ L'ambre, lui, a été *baissé* de 7,09
à 5,02:1 pour prendre la valeur que trois autres surfaces portent déjà — une
encre d'alerte qui diffère d'un écran à l'autre coûte plus que deux points de
contraste. Les étoiles de notation restent hors seuil **par écrit** : aucune
teinte dorée n'atteint 3:1 sur blanc sans virer au brun, et c'est la POSITION de
la coupure dans une rangée de cinq qui porte l'information.

🧪 **Banc : `/dev/public` monte les SIX surfaces**, trois états chacune. ⚠ Les
deux visites ne se branchent pas comme les autres — elles lisent une RPC
(`get_visit_by_token`, la lecture directe de `visits` ayant été retirée en
juillet 2026) et prennent leur jeton dans la QUERY. Une route de banc en
`visite/:token` les monterait sans jeton : elles rendraient « lien invalide », et
on corrigerait la fixture au lieu de la route.

---

## 4. PATTERNS DE CODE

### Convention de nommage
```
Composants : PascalCase (ListingCard.tsx) | Hooks : use* (useListings.ts)
Types : PascalCase | SQL : snake_case | Edge Functions : kebab-case
```

### Structure des dossiers (où va quoi) — 3 runtimes séparés

Le code vit dans **3 runtimes distincts** ; un fichier ne « déménage » pas librement de l'un à l'autre.

| Dossier | Runtime | Contenu autorisé |
|---|---|---|
| `src/` | Navigateur (bundle Vite, **TS only**) | Code d'app **importé et rendu**, rien d'autre |
| `scripts/` | Node (`node scripts/*.mjs`, brut, **aucun loader TS**) | **Exécutables** seuls ; helpers partagés → `scripts/_shared/`, fixtures de données → `scripts/_data/` |
| `supabase/functions/` | Deno (edge) | Edge functions ; code partagé → `_shared/` |
| `scripts/realadvisor-agencies/` | **Python** (venv `uv`, hors CI) | ⚠ Seule exception à la règle Node, et elle est contrainte : franchir le challenge Cloudflare de RealAdvisor exige un navigateur furtif **headful** (Camoufox), et rien d'équivalent ne passe côté Node — mesuré, cf. le README du dossier. Ne pas « corriger » en portant vers `.mjs` sans avoir prouvé qu'un client Node passe. **Le dossier est une unité autonome : ses helpers Python y restent** (`ra_parse.py`) au lieu d'aller dans `scripts/_shared/`, qui est le dossier des helpers **Node** — y mêler deux runtimes nuirait plus à la lisibilité que la co-location. |

- ⛔ **JAMAIS de helper ni de donnée de script dans `src/`** : c'est le bundle navigateur, et un script Node ne peut importer ni un `.ts` ni l'arbre frontend. Un helper de script va dans `scripts/_shared/`, pas dans `src/lib/`.
- `src/lib/` et `src/hooks/` sont **PLATS volontairement** — ne PAS les réorganiser en sous-dossiers thématiques (churn massif d'imports + conflits de merge ; le plat est idiomatique, l'alias `@/` suffit). `src/components/` est foldered par thème.
- Pas de dossier vide (`.gitkeep` orphelin), pas de code mort (0 fichier non-joignable depuis `main.tsx`, 0 export mort — `npm run lint:deadcode`).
- **Avant tout déplacement/renommage** : `git mv` (préserve l'historique) + greper TOUS les usages (imports relatifs ET `@/`, docs, skills, workflows CI), corriger les chemins, puis `npm run build`.

### Documentation du code

- En-tête `/** */` par fichier (rôle, route si page, comportements non-évidents) + docstring concise par unité **exportée** (composant/hook/TSDoc lib) + commentaires **« pourquoi »** là où la logique n'est pas évidente.
- ⛔ PAS de glose ligne-à-ligne, PAS de docstring sur chaque helper trivial, PAS de commentaire qui répète le code. Le commentaire dit le **pourquoi**, pas le **quoi** ; match la densité existante.

### Pattern composant
```tsx
import { cn } from '@/lib/utils';
interface Props { listing: Listing; className?: string }
export default function ListingCard({ listing, className }: Props) {
  return <div className={cn('rounded-xl border border-theme-border', className)}>{...}</div>
}
```

### Pattern hook Supabase
```tsx
export function useListings(filters?: Filters) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

### Pattern Supabase Realtime (IMPORTANT — bug A1 audit)
```tsx
// TOUJOURS utiliser useId() pour le channel name — sinon crash au re-mount
const channelId = useId()
useEffect(() => {
  const channel = supabase.channel(`nom-${channelId}`).on('postgres_changes', {...}).subscribe()
  return () => { supabase.removeChannel(channel) }
}, [channelId])
```

---

## 5. RÈGLES ABSOLUES

### DO ✅
- TypeScript strict (pas de `any`)
- RLS activé sur CHAQUE table Supabase
- `cn()` pour classes conditionnelles
- Prix : `CHF 720'000` (apostrophe suisse) — utiliser `formatCHF()` (type-defensive, accepte string/null)
- Labels UI en français par défaut
- Composants shadcn/ui quand ils existent
- États loading, empty, error pour chaque liste/page
- Responsive mobile-first (md: lg:)
- Human-in-the-loop : validation KYC, envoi message/document
- Audit trail : `activity_events` pour toute action (y compris IA avec `actor_id = 'ai'`)
- Scores IA affichés comme "estimation" (icône sparkle/ai)
- Timeline unifiée par contact
- `scripts/` = exécutables seuls (helpers → `scripts/_shared/`, données → `scripts/_data/`)
- Documenter le **pourquoi** : en-tête `/** */` par fichier + docstring par export
- `git mv` + corriger tous les imports (relatifs ET `@/`) avant `npm run build`

### DON'T ❌
- `any` en TypeScript
- Données hardcodées (tout vient de Supabase)
- localStorage pour données sensibles
- Validation KYC auto sans action humaine
- Envoi auto au client sans validation agent
- Couleurs hardcodées (`bg-white`, `text-gray-*`) → tokens thème
- ⚠ ~~`bg-accent` plein sur boutons → style ghost~~ — **périmé**, voir §3 : c'est l'inverse depuis le 10 août 2026 (120 sites contre 11)
- Ombres sur bentos
- Modals inline → toujours `createPortal`
- UPPERCASE dans les titres → capitalize — ✅ **la SEULE des sept règles visuelles
  qui soit encore vraie ET gardée** (16 août 2026). Mesuré : 20 `textTransform:
  'uppercase'` vivants, tous dans `kyc-report` (papier A4, exempté par écrit) et
  `pages/dev` (bancs absents du bundle). Zéro sur une surface agent.
- Dots rouges sidebar
- Next.js / Vercel → React+Vite / Cloudflare Pages
- `console.log` en production
- Mentionner "Lovable", "Claude", "ChatGPT" dans l'interface
- IA présentée comme "automatique" ou "garantie" → "assistance"
- Fonctionnalité hors les 5 objectifs du Document Maître
- Helper ou donnée de script dans `src/` (mauvais runtime — va dans `scripts/_shared/` ou `_data/`)
- Réorganiser `src/lib/` ou `src/hooks/` en sous-dossiers (churn d'imports + conflits de merge)
- Commenter chaque ligne / docstring-er chaque helper trivial (bruit qui se périme)
- Laisser un dossier vide (`.gitkeep` orphelin) ou du code mort

---

## 6. MONNAIE ET LOCALISATION

```
Devise :     CHF (apostrophe : CHF 720'000)
Surface :    120 m²
Date :       16.03.2026 (DD.MM.YYYY) ou relatif
Langues :    FR (défaut), DE, EN, IT — react-i18next, 12 namespaces
Cantons :    GE VD VS NE FR BE JU BS BL AG SO ZH LU ZG SZ NW OW UR GL SH TG AR AI SG GR TI
```

---

## 7. PERFORMANCE & BASE DE DONNÉES

> Section ajoutée le 16 avril 2026 après des incidents de statement timeout sur 33K+ rows.

### Règles Supabase (statement timeout = 3-8s sur Pro)

| Règle | Pourquoi | Exemple |
|---|---|---|
| **JAMAIS `count: 'exact'`** sur tables > 5K rows | Cause un sequential scan complet → timeout | Utiliser `count: 'estimated'` ou pas de count |
| **JAMAIS `ORDER BY` sans partial index** sur le WHERE exact | PostgreSQL fait un sort en mémoire sur toute la table → timeout | Créer un partial index couvrant WHERE + ORDER BY |
| **JAMAIS `.in('status', [...])` quand `.eq()` suffit** | `IN` ne match pas les partial indexes | `.eq('status', 'active')` au lieu de `.in('status', ['active', 'price_reduced'])` |
| **JAMAIS SELECT colonnes lourdes en liste** | `description` (2KB/row × 33K = 66MB), `photos` (array d'URLs) | Charger `description` uniquement sur la page détail |
| **Toujours un partial index pour les filtres fréquents** | Réduit le scan de 33K rows à <1K | `CREATE INDEX ... WHERE transaction_type='rent' AND status='active' AND quality_score >= 50` |

### Index existants (market_listings)
```sql
idx_ml_rent_active_created ON market_listings (created_at DESC)
  WHERE transaction_type = 'rent' AND status = 'active' AND quality_score >= 50
idx_market_listings_tx_type_status ON market_listings (transaction_type, status, quality_score, created_at DESC)
```

### Supabase Realtime — pattern obligatoire
```tsx
// TOUJOURS useId() pour channel name — sinon crash au re-mount (StrictMode/navigation)
const channelId = useId()
const channel = supabase.channel(`nom-${channelId}`)
```
Fichiers concernés : `useAdminNotifications.ts`, `useAdminLiveFeed.ts`, `useMessaging.ts` (tous fixés).

### Formatters type-defensive
`formatCHF(amount)` et `formatRent(amount)` acceptent `number | string | null | undefined`. Retournent `'CHF —'` pour les valeurs invalides. Ne JAMAIS appeler `.toFixed()` directement sur une valeur de formulaire.

### pg_cron actifs

**41 jobs actifs** au 29 juil. 2026 (relevés dans `cron.job`) — cette section n'en listait que 2.
Inventaire complet et à jour dans le cerveau : `megga/pg-cron`. Les plus structurants :

| Job | Schedule | Cible |
|---|---|---|
| `flatfox-sync-daily` | `0 4 * * *` | flatfox-sync (location) |
| `realadvisor-fresh-daily` | `30 3 * * *` | realadvisor-sync (vente, national) |
| `realadvisor-rolling-daily` | `0 22 * * *` | realadvisor-sync (1 bucket de cantons/nuit) |
| `realadvisor-probe-fire` / `-collect` | `0 * * * *` / `10 * * * *` | RPC pg_net (détection de disparition) |
| `realadvisor-probe-sweep` | `30 1 * * *` | RPC (retrait des absents confirmés) |
| `realadvisor-revive-fire` / `-collect` | `30 2 * * *` / `45 2 * * *` | RPC (résurrection) |
| `realadvisor-health-daily` | `0 9 * * *` | RPC `realadvisor_health_check` |
| `platform-metrics-hourly` | `15 * * * *` | admin-monitoring |

⚠ Identifier un job par son **jobname**, jamais par son `jobid` : il change à chaque recréation.

---

## 8. ÉTAT D'IMPLÉMENTATION (mise à jour : 14 juin 2026 — pivot CRM-first)

### Vue d'ensemble

MVP Compliance-First Transaction OS en production sur `main` (Cloudflare Pages). **Pivot CRM-first (juin 2026)** : `app.megga.ch` = CRM agent seul ; la vitrine et la marketplace publique vivent hors de cette app.

**Marketplace publique : DÉSACTIVÉE (pivot CRM-first) :**
- `/acheter` + `/louer` (+ `/buy` `/rent` `/propriete`) → `MarketplaceDisabledRedirect` vers la vitrine `megga.ch`
- Backend conservé intact : `market_listings` (~90k Flatfox, ~50k active), `flatfox-sync` (pg_cron), `matching-engine` — au service du matching CRM, pas d'un affichage public
- Atomes Px + onboarding gardés ; pages SPA marketplace + Property X retirées (PR #601/#602)

**CRM agent :** la plupart des ~18 surfaces agent connectées Supabase (le « 11/14 » était périmé) — Contacts, Pipeline v2 Sugar Pure (14 stades DB → 8 colonnes UI ; kanban teinté/liste/timeline, bento de signature, nextAction = reminders), Matching, Mes biens (pager galerie + à-suivre · wizard « Créer un bien » Sugar v2 7 étapes · fiche V4), KYC (dilisense), ContactDetail, ListingForm, ActionBoard, Chat, Dashboard, cockpit Aujourd'hui, Analytics.

**Réseau inter-agences : ❌ RETIRÉ (hors périmètre v1).** L'ancien prototype `NetworkSugarV2Page` (données d'exemple, aucun backend, jamais routé) a été supprimé lors du nettoyage code mort ; les routes `/dashboard/network` et `/dashboard/reseau` redirigent vers `/dashboard`. Le module réel (partage de biens inter-agences + RLS cross-agence + modèles PDF) reste à construire plus tard.

**MEGGA AI :** Edge Function ai-copilot (DeepSeek deepseek-chat — appel api.deepseek.com direct), streaming, score engine. **Inférence texte = DeepSeek partout** ; **vision/OCR/PDF = Gemini** (photo-vision, extract-property-pdf via `_shared/vision.ts`). **AUCUN Claude/Anthropic** (retiré ; kyc-screening = Dilisense déterministe seul).

**Portail vendeur : ❌ RETIRÉ (26 juillet 2026).** Il n'avait jamais servi — `seller_portals` comptait 0 ligne depuis sa création, aucun lien personnel n'a jamais été émis, et l'UI de création avait déjà disparu de la fiche contact. Retiré en entier : routes (`/portal*` et `/portail*` redirigent vers la vitrine), pages, `components/seller-portal/`, hooks, section « Portails vendeurs » de la console admin, drapeau de plan `sellerPortal`, edge `seller-portal-action`, et les tables `seller_portals` / `seller_preferences` (migration `20260726180000`).

**Super-Admin :** **surface du CRM** montée sous `/dashboard/admin/*` (`App.tsx` → `AdminConsoleRoute` → `AdminConsoleRoutes` → `AdminShell` + 17 pages lazy). L'application autonome `admin.megga.ch` a été retirée le 28.07.2026 : plus de `build:admin`, plus de projet Pages dédié, plus de passage de session par fragment d'URL. Accent violet réservé au repère de contexte du rail ; nav groupée en 5 sections ; chrome et atomes dans `src/components/admin/kit/`.

Accès : `AdminConsoleRoute` → `useSuperAdminGate` (UX seule) ; le mur réel est en base (`is_super_admin()` = rôle **ET** e-mail allowlisté, lu dans `auth.users`) et sur les edges (`_shared/require-super-admin.ts`). ⚠️ Aucun contrôle AAL2 : le 2FA a été retiré (#873). Entrée par le dropdown profil Sugar et ⌘K (`src/lib/adminEntry.ts`) ; chaque entrée est journalisée (`admin_console_entered`) et l'impersonation reste audit-first (`admin_log_impersonation`, bloquante) via `?impersonate=<id>`.

⚠️ Les cibles de navigation de la console DOIVENT être préfixées par `ADMIN_CONSOLE_PATH` — une cible nue tombe sur le 404 du CRM, voire sur une redirection publique. Garde-fous : `tests/unit/admin-console-paths.spec.ts` et `tests/unit/redirects-guard.spec.ts` (ce dernier interdit toute règle de bord qui expulserait `/dashboard/*` vers un autre hôte : c'est ce qui avait rendu la console injoignable).

**Intégrations :** Resend, Stripe, Google/Outlook Calendar (OAuth), virtual staging (Gemini), Flatfox sync.

### Secrets Supabase
```
DEEPSEEK_API_KEY, GEMINI_API_KEY, RESEND_API_KEY, DILISENSE_API_KEY,
MEGGA_MAGIC_LINK_HMAC_SECRET,
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET,
GOOGLE_WORKSPACE_SA_KEY (✅ posé le 09.08.2026 — voir ci-dessous),
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_IDENTITY_FLOW_ID,
MAPBOX_TOKEN,
UID_REGISTER_API_URL, UID_REGISTER_API_CREDENTIAL
```

> ⚠ **`STRIPE_IDENTITY_FLOW_ID` n'est pas un secret, mais il doit rester hors du dépôt.**
> C'est l'identifiant (`vf_…`) du flux de vérification configuré dans le tableau de bord
> Stripe (Identity, décision du 03.08.2026 : passeport + carte d'identité, selfie exigé,
> capture en direct, ni numéro de pièce ni e-mail ni téléphone). Le mode TEST et le mode
> RÉEL en portent **deux distincts** — en figer un dans le code casserait l'autre, même
> raison que les `STRIPE_PRICE_*`. Absent, `kyb-identity-verify` retombe sur les mêmes
> options posées en clair : le parcours tourne, il n'échoue pas.
>
> ⛔ **`MEGGA_APP_URL` doit rester ABSENTE — ne pas « réparer » son absence.** Constaté le
> 03.08.2026 : elle n'est posée nulle part, et c'est la bonne configuration. Son repli en
> dur, `https://app.megga.ch`, est la valeur qui sert réellement les quatre parcours
> publics — mesuré, `/kyc/…`, `/kyc-report/…`, `/accept-invite/…` et
> `/visite/…/modifier` rendent **200 sur `app.megga.ch` et 401 sur `megga.ch`** (la
> vitrine est protégée par mot de passe et ne connaît aucune de ces routes).
>
> La poser n'ajoute donc aucune capacité, seulement deux façons de casser les liens : une
> faute de frappe, ou le plan archivé
> `docs/superpowers/plans/2026-06-02-whatsapp-kyc-report-pdf.md` qui donne
> `MEGGA_APP_URL=https://megga.ch` en exemple. La suivre remplacerait une panne visible par
> une panne qui ressemble à un site vivant.
>
> À poser UNIQUEMENT le jour où l'app changerait de domaine — et alors sur le domaine de
> l'APP, avec le schéma, sans chemin (le segment `/kyc` appartient à la route, pas au
> réglage). Lecteurs : `_shared/app-url.ts` — qui porte les quatre constructeurs
> (`kycMagicLinkUrl`, `visitManageUrl`, `teamInviteAcceptUrl`, `kycReportRenderUrl`) — et
> `appointment-book`, seule fonction à garder sa propre lecture (elle accepte en plus un
> repli `APP_URL`, et fige la valeur dans une `const` de module).

> ✅ **`MEGGA_MAGIC_LINK_HMAC_SECRET` EST configuré** (mesuré le 03.08.2026) — il manquait
> simplement à cet inventaire. Il signe les jetons publics du lien magique KYC ET des liens
> de réception acheteur (`_shared/magic-link-token.ts`, ≥ 32 caractères exigés à la
> signature). Sans lui, les deux parcours échouent **fermé** — `verifyMagicLinkToken` rend
> `no_secret` et tout lien est refusé — donc son absence casse la fonctionnalité sans ouvrir
> de faille.
>
> Méthode, réutilisable pour tout secret d'edge : interroger la fonction déployée avec un
> faux jeton de syntaxe valide et lire le motif. Le secret est vérifié AVANT la signature,
> donc `no_secret` ⇒ absent, `invalid_signature` ⇒ présent. ⚠ Cet oracle disparaît avec la
> PR #1114, qui réduit le motif rendu aux appelants anonymes à `expired`/`invalid` — il
> renseignait un tiers sur la configuration du déploiement.

> 🗓 **`GOOGLE_WORKSPACE_SA_KEY` — l'agenda des appels d'accueil (15.08.2026).**
> ⚠ Le NOM vient de la prod : Julien l'avait posé ainsi le 09.08, avant le code — et la
> valeur d'un secret ne se relit pas depuis le dashboard, donc c'est le code qui s'est
> aligné (un nom désaccordé échoue comme un secret absent : `degraded`, silencieux).
> Contenu : le fichier de clé JSON **entier** du compte de service
> `megga-onboarding-calendar@tribal-dispatch-504619-c1.iam.gserviceaccount.com`
> (projet Google « My First Project » du compte **hello@megga.ai**, API Calendar déjà
> activée). Lu par `_shared/google-service-account.ts`, qui signe une assertion RS256 et
> **usurpe** la boîte déclarée dans `onboarding_hosts.calendar_email`.
>
> ⚠ L'usurpation n'est pas un luxe : un compte de service qui écrit dans un agenda
> simplement PARTAGÉ avec lui **ne peut pas créer de lien Google Meet** (Google exige un
> utilisateur organisateur). C'est possible ici parce que **`megga.ai` EST un Workspace**
> — mesuré le 15.08 : MX `smtp.google.com`, SPF `_spf.google.com` (par contraste
> `megga.ch` est chez privateemail). `calendars/primary` désigne alors l'agenda de la
> boîte usurpée.
>
> ⛔ **Sans la délégation à l'échelle du domaine, le secret ne sert à rien** : le jeton
> est refusé en `unauthorized_client`. À accorder dans la console d'administration
> Workspace (Sécurité › Contrôle des API › Délégation), au client OAuth
> **`118071255987425211651`**, scope **`https://www.googleapis.com/auth/calendar`** et lui
> seul. Cette page exige une ré-authentification par mot de passe même sur une session
> ouverte : elle ne peut pas être configurée par un agent.
>
> Bascule hôte par hôte, sans déploiement : `calendar_email` renseignée ⇒ compte de
> service ; NULL ⇒ voie OAuth personnelle historique (inchangée, Outlook comprise).
> ⚠ Un hôte dont la boîte est déclarée mais le jeton indisponible est **écarté de la
> grille** (`degraded`), jamais traité comme libre — donc « aucun créneau » est le symptôme
> attendu tant que la délégation manque.

> ✅ **`MAPBOX_TOKEN` est configuré et FONCTIONNE** (posé et mesuré le 16.08.2026 —
> [issue #1061](https://github.com/megga/megga-real-estate/issues/1061) close). Il est distinct de
> `VITE_MAPBOX_TOKEN` : le connecteur de géocodage KYB tourne dans une Edge Function, côté serveur,
> et lui faut le jeton dans les secrets Supabase, pas dans le build.
>
> ⛔ **LES DEUX JETONS NE PEUVENT PAS PORTER LA MÊME VALEUR.** L'Edge Function appelle Mapbox
> **sans referrer** : un jeton restreint par URL y échoue en 403, alors qu'il marche dans le
> navigateur. `MAPBOX_TOKEN` doit donc être SANS restriction, et `VITE_MAPBOX_TOKEN` — lisible par
> quiconque dans le bundle public — doit être restreint à `app.megga.ch`.
>
> ⚠ **Le code appelle Geocoding v6, jamais v5.** Mapbox a classé `geocoding/v5/mapbox.places`
> *legacy* : un compte créé aujourd'hui reçoit `403 {"message":"Forbidden"}`. Trois appels sont
> concernés (`_shared/kyb-sources.ts`, `src/lib/mapbox.ts`, `Step2Address.tsx`) et la forme de la
> réponse diffère — détails dans le cerveau, `megga/mapbox-geocoding-v6`.
>
> Effet mesuré une fois posé : `address_geocode` rend `match`, et `verification_score` cesse d'être
> `NULL` (1.000 sur les deux dossiers de test, contre 13 dossiers à `NULL` depuis toujours). ⚠ Ce
> score ne repose encore que sur UN check scorable : `vat_lookup` attend le registre UID et
> `domain_whois_age` réclame un site web déclaré.

### Secrets GitHub Actions
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN (✅ posé le 16.08.2026),
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SUPABASE_ACCESS_TOKEN
```

> ✅ **`VITE_MAPBOX_TOKEN` est posé et présent dans le bundle** (16.08.2026). Vérifié en balayant
> les **263 chunks** réellement servis par `app.megga.ch` : le jeton (`pk.eyJ…`) est dans
> `ListingFormPage-*.js` et `WizardShell-*.js`, aux côtés de `search/geocode/v6/forward`.
>
> ⛔ **NE PAS CHERCHER LE JETON DANS `index-*.js`** : ce fichier ne contient pas une ligne de
> Mapbox, le code étant découpé en morceaux chargés à la demande. C'est ce raccourci qui a fait
> conclure deux fois à tort que le secret était vide. Un jeton absent du bundle se prouve en
> balayant les chunks, jamais l'index seul.
>
> ⚠ La valeur est figée **au build** : la poser exige un redéploiement pour prendre effet.

### Supabase
- **Project ref** : eayczugyrvmtqnnmvjod | **Region** : eu-west-1 | **Plan** : Pro
- **Anon key** : hardcodée dans `src/lib/supabase.ts` (sécurité via RLS, pas par obscurité)

### « Se connecter avec Google » — le client OAuth (migré le 16.08.2026)

Le fournisseur Google de Supabase Auth tournait sur un client appartenant à un **ancien
compte Google** (`178156637080-1d7r3cmb…`). Il vit désormais sur **hello@megga.ai**, projet
**« My First Project » (`tribal-dispatch-504619-c1`)** — le même que le compte de service
`megga-onboarding-calendar`, mais ce sont **deux mécaniques distinctes** : le compte de
service sert l'agenda d'accueil (`GOOGLE_WORKSPACE_SA_KEY`), le client OAuth sert la
connexion des agents. Changer l'un ne touche pas l'autre.

```
Client ID   833483825712-vh715spjupqcl86qffv3hvffsaqk0g8e.apps.googleusercontent.com
Consentement  External · In production (publié le 16.08) · app « GET MEGGA »
Scopes déclarés  userinfo.email, userinfo.profile, openid  (tous NON sensibles)
```

⚠ **L'URI de redirection est `https://api.megga.ch/auth/v1/callback`, PAS l'URL `.supabase.co`.**
Le projet a un domaine personnalisé, et c'est cette URL-là que le panneau du fournisseur donne
à enregistrer. `supabase.co` a été **délibérément écarté** des URI du client : Google inscrit
d'office le domaine de chaque URI comme domaine autorisé du consentement, et `supabase.co`
n'appartient pas à MEGGA — un domaine non possédé gênerait une soumission en vérification.

⛔ **Google ne réaffiche PLUS un secret client après sa création** (« Viewing and downloading
client secrets is no longer available »). Il n'est lisible qu'une fois, dans la boîte « OAuth
client created » ; la page de détail n'en montre que les 4 derniers caractères. Le seul endroit
où la valeur reste récupérable est le **bouton « Reveal » du panneau Google de Supabase**. Le
perdre oblige à générer un nouveau secret.

⛔ **`GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` NE SONT PAS POSÉS** (relevé le 16.08.2026 dans
les secrets du projet). Trois chemins les lisent pour **rafraîchir** un jeton Google —
[google-calendar-sync/index.ts:43](supabase/functions/google-calendar-sync/index.ts),
[_shared/booking-oauth.ts:63](supabase/functions/_shared/booking-oauth.ts),
[_shared/host-freebusy.ts:110](supabase/functions/_shared/host-freebusy.ts) — et tournent donc
avec `client_id: ''`. Défaut **antérieur à la migration**, pas causé par elle : `google_calendar_tokens`
compte **0 ligne**, la liaison Google Calendar n'a jamais été exercée de bout en bout. ⚠ Le mode
d'échec est **silencieux** : `host-freebusy` passe `sync_enabled = false` sur échec de refresh, donc
un agent qui connecte son agenda le verrait se déconnecter tout seul ~1 h plus tard, sans erreur.
Google exige les identifiants **du client qui a émis le refresh token** : le jour où on pose ces
secrets, ce sont ceux du client ci-dessus, pas ceux de l'ancien compte.

⚠ **Le scope `https://www.googleapis.com/auth/calendar` n'est pas déclaré** dans Data Access.
Conséquence, mesurée à la publication : la **connexion** est propre pour tout le monde (scopes
non sensibles seulement, ni plafond ni avertissement), mais la liaison Calendar demande un scope
sensible non approuvé — cet écran-là affiche « Google n'a pas validé cette application » et
consomme le plafond de 100 utilisateurs. À déclarer avant toute soumission en vérification.

⚠ **L'ancien client reste actif sur l'ancien compte, et hello@megga.ai n'y a AUCUN accès**
(`resourcemanager.projects.get`, `oauthconfig.verification.get`, `iam.serviceAccounts.list`
manquants). Il ne peut être supprimé que depuis l'ancien compte.

⚠ **`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` sont annoncés plus haut mais ABSENTS du
projet** (même relevé). La voie OAuth Outlook est donc dans le même état que la voie Google.

**Vérifier la bascule sans se connecter** — l'oracle est côté serveur, pas dans l'UI du dashboard :
```bash
curl -s -o /dev/null -w '%{redirect_url}' \
  'https://api.megga.ch/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.megga.ch%2Fauth%2Fcallback'
```
Lire le `client_id` de la redirection, puis suivre cette URL : une page « Sign in - Google Accounts »
**sans** `redirect_uri_mismatch` / `invalid_client` / `unauthorized_client` prouve que le client et
l'URI sont acceptés par Google.

### Prochaines priorités

**✅ Résolu le 16.08.2026 — [issue #1061](https://github.com/megga/megga-real-estate/issues/1061), jeton Mapbox.**
Les deux secrets sont posés, le code est passé en Geocoding v6, et le KYB calcule enfin des
scores (`1.000` sur les deux dossiers de test, contre 13 dossiers à `NULL` depuis toujours).
Ce qui reste de cet épisode est écrit plus haut, dans les deux encadrés des secrets.

**🟠 Reste à faire, par ordre d'effet :**
1. **Deux jetons Mapbox distincts.** Le même est aujourd'hui posé aux deux endroits, donc le
   jeton du navigateur est **sans restriction et lisible par tous** dans le bundle public.
   Dupliquer, et restreindre la copie navigateur à `app.megga.ch`.
2. **Registre UID** (`UID_REGISTER_API_URL` / `_CREDENTIAL`) : sans lui `vat_lookup` reste
   `unavailable` et le score suisse ne repose que sur UN check.
3. **`Step2Address.tsx` invente des adresses** quand le géocodage échoue : son `catch` retombe
   sur `mockSuggestions` sans rien dire à l'écran. Décider ce que l'utilisateur doit voir.

---

> ⚠ Liste pré-pivot (avril 2026), conservée pour mémoire. Depuis le pivot CRM-first (juin 2026), les points marketplace publique (`/louer`, « Mes lieux », carte des prix) sont gelés ; le focus actuel est le CRM agent.

1. **Audit perf /louer** — Lighthouse, lazy images, virtualisation liste, Supercluster en worker
2. **"Mes lieux" multi-POI** — travail+école+sport sur la carte, trajet vers chaque bien
3. **Carte des prix temporelle** — overlay prix/m² avec slider 12 mois
4. **i18n** — finir migration 3 pages marketing (ServicesPage, EstimationsPage, VendrePage)
5. **Onboarding interactif** — checklist 5 étapes dans le dashboard agent
