# CLAUDE.md — MEGGA Real Estate

> Instructions persistantes pour ce projet. À lire avant **toute** intervention.

---



---

## 🎯 Contexte du projet

**MEGGA Real Estate** — plateforme immobilière suisse :
- **Marketplace publique** (Homepage, Recherche, Bien, Agence, Compte, Vendre, KYC public)
- **CRM agent** (Aujourd'hui, Pipeline, Matching, Parcours, Contacts, Biens, Calendrier, Documents, KYC, Settings)

Les maquettes hi-fi vivent dans des fichiers `MEGGA *.html` à la racine, alimentés par des composants `.jsx` co-localisés.

> **Marketplace v1 archivée** (mai 2026) : `archive-marketplace-v1/` contient l'ancienne charte « MEGGA Identity » (bleu `#0041D9`, fond `#FAFAFA`, Manrope) et tous ses fichiers `megga-*.jsx` / `MEGGA <Page>.html`. Ne pas la consommer. La nouvelle marketplace utilise **Property X** (voir plus bas).

---

## 🧭 Deux dialectes, une même marque

Le projet MEGGA utilise **deux directions artistiques distinctes** selon l'audience :

| Surface | Direction | Référence | Tokens |
|---|---|---|---|
| **Marketplace publique** (Homepage, Recherche, Bien, Agence, Compte, Vendre, KYC public) | **Property X** | `docs/design-system-propertyx.md` (repo GitHub) + `MEGGA-DESIGN-SYSTEM.md` | `propertyx-tokens.jsx` + `propertyx-atoms.jsx` |
| **CRM agent** (Aujourd'hui, Pipeline, Matching, Wizard, Documents…) | **Sugar Pure** | `MEGGA-DESIGN-SYSTEM.md` | `crm-tokens.jsx` |

**Règle de décision** : *l'utilisateur passe-t-il plus de 10 minutes par session en mode « travail » ?*
- **Oui** → Sugar Pure (outil)
- **Non, il vient consommer / découvrir / désirer** → Property X (marketplace)

**Partagé entre les deux** : logo `assets/megga-logo.svg` (wordmark MEGGA complet), `tabular-nums` sur les nombres, formatage CHF avec apostrophes (`'`), iconographie SVG stroke linéaire (zero emoji), voix éditoriale FR-CH.

> ⚠️ La typo diffère : Marketplace = **Objectivity**, CRM = **Manrope**. Ne jamais mélanger.

---

## 🏠 Direction artistique de la Marketplace : **Property X**

> **Source canonique** : `docs/design-system-propertyx.md` dans le repo GitHub `megga/megga-real-estate`. Template **Property X** par BRIX Templates (licence achetée), porté sur `src/components/propertyx/`. Ici en local : `propertyx-tokens.jsx` (tokens) + `propertyx-atoms.jsx` (10 atomes Px). Logos officiels : `assets/megga-logo.svg` et `assets/megga-favicon.svg`. Fonts : `assets/fonts/objectivity/` (9 weights + italiques).

**Toute** page de la marketplace **doit** consommer `propertyx-tokens.jsx` + `propertyx-atoms.jsx`. Aucune palette locale, aucun atome réinventé.

### Principes non-négociables
1. **100 % neutres.** Une seule palette : `neutral100 → neutral700`. **Aucune couleur d'accent** (pas de bleu, pas de vert, rien). Le contraste se fait par le noir/blanc.
2. **Typo Objectivity** (Pangram Pangram) avec fallback Plus Jakarta Sans. **Weight max = 500 (Medium)**, pas de Bold dans le DS. `letter-spacing: -3 %` partout (équivalent `-0.03em`). `line-height: 1.25` (Display) ou `1.5` (Paragraph).
3. **Photos qui dominent.** Hero pleine cadre, ratios 4/3 ou 16/9, radius 24px (`large`). Le visuel porte le design, pas la chrome.
4. **Boutons pill asymétriques** : `pl 16 / pr 6 ou 10` avec **cercle inverse** à droite (28×28) contenant l'arrow. C'est la signature Property X.
5. **Pills partout** : boutons, badges, inputs, avatars, toggles → `radius 200px`. Sauf textarea (`tiny 8px`), cards (`small 12px` ou `large 24px`).
6. **Ombres neutres** (BS Small/Regular/Medium/Large) en complément d'une bordure 1px `neutral300` sur les cards. Pattern Property X : bordure + ombre combinées.
7. **Sections noires immersives** : `inkBg #14161C` pour Featured, CTA, Footer. Texte `neutral100`, eyebrow `PxSectionLabel invert`.
8. **Spacing généreux** : 160px entre sections principales, 1440px max-width, 40px padding horizontal page.

### Palette Property X (neutrals exclusivement)
```
neutral100      #FFFFFF        page bg principal, texte sur fond noir
neutral200      #FAFAFB        surface subtle, hover, inputs light
neutral300      #EEEFF1        bordures, dividers, avatars vides
neutral400      #A4A6B0        texte muted, placeholders, eyebrows
neutral500      #464851        texte body / soft
neutral600      #202127        ink subtle (cards sur fond noir)
neutral700      #14161C        texte primary, sections ink, bg primary buttons
overlayDark10   #0013581A      overlays foncés (drop shadow soft)
```

Aliases sémantiques exposés : `pageBg`, `surfaceBg`, `inkBg`, `inkBgSubtle`, `border`, `borderInverse`, `ink`, `inkSoft`, `inkMuted`, `inkInverse`, `inkInverseSoft`, `inkInverseMuted`.

### Typographie Objectivity
```
Display 1   16px   125%   ls -3 %   weight 500     Labels, boutons
Display 2   18px   125%   ls -3 %   weight 500     Body emphase
Display 3   20px   125%   ls -3 %   weight 500     Sous-titres
Display 4   22px   125%   ls -3 %   weight 500     Titres cards (h5)
Display 5   24px   125%   ls -3 %   weight 500     Sous-sections (h4)
Display 6   30px   125%   ls -3 %   weight 500
Display 7   36px   125%   ls -3 %   weight 500     h3
Display 8   48px   125%   ls -3 %   weight 500     h2
Display 9   60px   115%   ls -3 %   weight 500
Display 10  72px   110%   ls -3 %   weight 500     Hero (h1)

Paragraph Lg   18px   150%   weight 500
Body           16px   150%   weight 400            Body courant
Body Sm        14px   150%   weight 400            Légendes, méta
```
Helper React : `pxType('h1')` retourne `{fontFamily, fontSize, fontWeight, lineHeight, letterSpacing}` prêt à brancher sur `style={}`.

### Border Radius
```
radius.none     0          désactiver
radius.tiny     8px        textarea, list items
radius.small    12px       cards petites, images
radius.medium   16px       cards intermédiaires
radius.large    24px       cards sections, hero, upload
radius.pill     200px      buttons, badges, inputs, avatars, toggles
```

### Shadows
```
shadow.small     0 4 4 0 #D3D3D30F + 0 1 1 0 #0E0E0E0A     cards passives, items
shadow.regular   0 2 4 0 #19213D14                          cards par défaut
shadow.medium    0 8 15 0 #19213D1A                         cards hover, dropdowns
shadow.large     0 8 24 0 #19213D1F                         modals, drawers
```

### Spacing / Layout
```
containerDesktop : 1440px
sectionDefault   : 160px (entre sections principales)
sectionRegular   : 80px  (entre sections petites)
sectionPadding   : 48px par défaut
page padding X   : 40px
```

### 🚫 Interdictions spécifiques marketplace
| ❌ Interdit | ✅ À faire |
|---|---|
| Couleur d'accent (bleu, vert, orange…) | Noir/blanc uniquement (`neutral100/700`) |
| Police Manrope ou DM Sans en local | **Objectivity** via `@font-face` (chargé par `PxFontFace` ou `PX_FONT_FACE_CSS`) |
| Weight 700+ (Bold) sur du texte UI | Max **500 (Medium)** |
| Bouton plat sans cercle inverse | Pill asymétrique + cercle 28×28 (sauf variant `ghost`) |
| Rédéfinir une palette `M = { ... }` locale | Consommer `window.PX` directement |
| Importer `crm-tokens.jsx` ou `MEGGA_TOKENS` (archivé) | `propertyx-tokens.jsx` |
| Background gradient coloré | Blanc, gris très clair, ou noir `inkBg` |
| Card sans bordure 1px | Pattern Property X = bordure `neutral300` **+** ombre |
| Pilule de label qui wrappe sur 2 lignes | `whiteSpace: "nowrap"` systématique |
| `letter-spacing: 0` ou positif sur du Display | Toujours `-3 %` (sauf eyebrow uppercase) |

### Référence visuelle
Le repo GitHub `megga/megga-real-estate` contient la version finale en production sur `/`, `/acheter`, `/louer`, `/listing/:id`, `/agents/:slug`, `/publier`, `/contact`. La doc complète (compositions, sections de page, exemples) est dans **`docs/design-system-propertyx.md`** — à consulter avant toute nouvelle page.

---

## 🧭 Direction artistique du CRM : **Sugar Pure** (a.k.a. *Sugar immersive*)

**Toute** nouvelle interface, modal, panneau, écran ou composant du CRM **doit** suivre la grammaire **Sugar Pure**, sans exception.

### Référence canonique numéro 1
👉 **`MEGGA-DESIGN-SYSTEM.md`** — lire en intégralité avant de toucher au CRM.
👉 **Step 0 du wizard** (`crm-wizard-sugar-v2.jsx`, composant `SgGateCard`) — c'est l'incarnation de référence du style.

### Principes non-négociables
1. **Beaucoup d'air.** Hiérarchie par l'espace, pas par les bordures.
2. **Surfaces blanches pures** (`#FFFFFF`) sur fond gradient radial gris-bleu (`#C8D5E0` → `#EDEFF3`).
3. **Ombres douces uniquement** comme séparateur — **JAMAIS** de bordure 1px décorative sur les cards/modals/panels.
4. **Accent unique = NOIR PUR `#0B0C0E`.** Boutons CTA, sélection, ring actif, stepper actif. Aucune couleur ne joue le rôle d'accent UI.
5. **Titres en noir franc `#0B0C0E`.** Jamais de gris pour un titre.
6. **Coins arrondis généreux** : 28px modal, 22px panel, 18px card, 14px sous-card, 12px input, 999px pilule/cercle.
7. **Animation d'entrée** `sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both` sur les cards qui apparaissent.

### Palette Sugar Pure (light)
```
bgCanvas:    radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)
modalBg:     #FFFFFF
cardSubtle:  #F7F8FA
black/ink:   #0B0C0E   ← accent unique + titres
blackHover:  #1F2024
inkSoft:     #3A3D44   ← texte courant
muted:       #7A8088   ← labels, placeholders
ghost:       #B5BAC2   ← disabled
```

### Ombres signature
```
shadowSm:    0 4px 16px rgba(15,23,42,0.04)
shadow:      0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)
shadowLg:    0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)
shadowHov:   0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)
modalShadow: 0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)
```

### Couleurs **fonctionnelles** MEGGA (réservées aux données métier — pas à l'UI)
```
Mandat / Bleu :    #1E5BC6
Préparation :      #0891B2  (cyan)
Visites :          #0891B2  (cyan)
Offre :            #C45A00  (orange)
Compromis :        #059669  (vert)
Acte :             #0B0C0E  (noir)
```

Ces couleurs s'utilisent uniquement pour des **pastilles 8px** ou des **pilules de statut** avec fond très opaque ~12% — jamais en fond plein dans l'UI, jamais en accent de bouton.

### CTA Sugar — bouton noir
```
height: 44–46px, borderRadius: 999px, background: #0B0C0E
hover: background #1F2024 + translateY(-1px) + ombre lift
color: #FFFFFF, fontWeight: 700
```

### Sélection & états actifs
- Card sélectionnée : `boxShadow: "0 0 0 2px #0B0C0E inset, [shadow normal]"` + fond `cardSubtle`
- **Jamais** de fond bleu clair sur sélection.
- Radio/checkbox actifs : background `#0B0C0E`, ✓ blanc.

---

## 🚫 Interdictions absolues dans le CRM

| ❌ Interdit | ✅ À faire |
|---|---|
| Bordure 1px décorative sur card/modal/panel | Ombre douce |
| Couleur en accent UI (bleu vif, violet, vert…) | Noir `#0B0C0E` |
| Violet `#7A4FD8` | N'existe pas dans MEGGA |
| Dégradé coloré en fond | Blanc pur ou gradient radial gris Sugar |
| Fond bleu clair sur sélection | `cardSubtle` + ring noir 2px inset |
| Couleur agence en accent UI | Réservée aux aperçus de documents uniquement |
| Titre en gris | Toujours `#0B0C0E` |
| Glassmorphism agressif, gradients arc-en-ciel | Surfaces sobres + ombres |
| Emoji dans l'UI | Icônes SVG stroke linéaires (cf. `CRMIcon`) |
| `Inter`, `Roboto`, `Arial` | `Manrope` (cohérent site public) ou `ui-sans-serif` |
| Pilule de type redondante avec le titre | Supprimer |
| Méta décorative inutile (#views, #usages) | Moins = mieux |

---

## 🧱 Composants & utilitaires existants (réutiliser, ne pas réinventer)

### Tokens marketplace (Property X)
- `propertyx-tokens.jsx` — `window.PX` (palette neutrals, font, type, space, gap, padding, radius, shadow, transitions), helper `pxType(name)`, formatter `pxFormatCHF(amount)`, CSS `PX_FONT_FACE_CSS` + composant `<PxFontFace />` pour injecter les @font-face Objectivity.
- `propertyx-atoms.jsx` — 10 atomes Px : `PxButton`, `PxCircleButton`, `PxBadge`, `PxInput`, `PxSelect`, `PxTextArea`, `PxCheckbox`, `PxRadio`, `PxToggle`, `PxAvatar`, `PxLink`, `PxLogo`, `PxImage`, `PxSectionLabel`, `PxList`, `PxListItem`, `PxIcon` (catalogue de ~50 icônes line-style).
- Assets : `assets/megga-logo.svg` (wordmark), `assets/megga-favicon.svg`, `assets/fonts/objectivity/*.woff2` (9 weights + italiques).

### Tokens CRM (Sugar Pure)
- `crm-tokens.jsx` — `CRM_TOKENS` (light/dark), `CRM_STAGES`, `CRM_DENSITY`, `crmFmtCHF`, `crmFmtNum`, `crmRelative`, `crmInitials`, `crmSugarPalette(t, dark, tone)`.
- `window.SugarV2Palette` (a.k.a. `SP`) — palette Sugar v2 utilisée dans le wizard.

### Shell & primitives
- `crm-shell.jsx` — `CRMIcon`, `CRMSidebar`, drawer, AI bubble, cmd+K.
- `crm-screen-today-sugar.jsx` — `SugarTopNav`, `SugarIconRail`, `SugarFrame`, `SugarTeamChip`, `SugarTaskCard`, `SugarRoundIconBtn`, `SugarConnector`.

### Wizard Sugar v2
- `crm-wizard-sugar-v2.jsx` — shell + Step 0 + primitives (`SgGateCard`, `SgBlackPill`, `SgGhostPill`, `SgCircleBtn`, stepper 8 cercles).
- `crm-wizard-sugar-step1..8.jsx` — étapes individuelles. **Lire** `HANDOFF_WIZARD_SUGAR_V2.md` avant de toucher.

### Référence absolue de la grammaire
- `crm-wizard-sugar-v2.jsx` (Step 0)
- `crm-documents-new-modal.jsx` (modal 3 étapes Sugar pur)
- `crm-documents-sugar-studio.jsx` (studio 3 colonnes)

---

## ⚠️ Pièges connus (collisions de noms globaux)

Tous les fichiers `.jsx` Babel partagent le scope global. Les composants chargés en **dernier gagnent**. Pour éviter les collisions :
- Préfixer les composants spécifiques à un fichier (ex. `SgNumStepper` plutôt que `SgStepper` quand `SgStepper` existe déjà ailleurs).
- **Jamais** de `const styles = {...}` en haut d'un fichier — toujours nommer (ex. `const todayStyles = {...}`).
- L'ordre de chargement dans `MEGGA CRM.html` est significatif (cf. `HANDOFF_WIZARD_SUGAR_V2.md`).

---

## 📐 Process de design

### Pour la marketplace (Property X)
1. **Charger** `propertyx-tokens.jsx` PUIS `propertyx-atoms.jsx` dans le HTML (dans cet ordre, car les atomes consomment `window.PX`).
2. **Injecter les fonts Objectivity** via `<PxFontFace />` dans l'app, OU coller `PX_FONT_FACE_CSS` dans un `<style>` global.
3. **Réutiliser les atomes** (`PxButton`, `PxBadge`, `PxInput`…) avant d'en créer. La grammaire est faite — composer, pas réinventer.
4. **Vérifier** : palette 100 % neutrals, font Objectivity, ls -3 %, pills partout, cercle inverse sur les CTAs, `whiteSpace: nowrap` sur les pills courtes.
5. **Ne jamais** importer les tokens CRM (`crm-tokens.jsx`) ni les anciens `megga-*.jsx` (archivés) dans une page marketplace.
6. **Avant** de créer une nouvelle page : consulter `docs/design-system-propertyx.md` (GitHub) pour voir la composition de référence (sections type, hero, search bar, cards de biens, footer).

### Pour le CRM (Sugar Pure)
1. **Lire** `MEGGA-DESIGN-SYSTEM.md` + le fichier de référence canonique le plus proche du composant à produire.
2. **Réutiliser** les primitives Sugar (`SgGateCard`, `SugarFrame`, `SgBlackPill`, etc.) avant d'en créer.
3. **Vérifier** : aucune bordure décorative, aucun accent coloré, titres en noir franc, ombres douces.
4. **Tweaks** : exposer mode clair/sombre, densité, et toute variation pertinente via `tweaks-panel.jsx`.
5. Pas d'écran "title" dans les prototypes — atterrir directement sur le contenu.

---

## 🇨🇭 Spécificités MEGGA

- **Marché suisse** : prix en CHF avec apostrophes (`crmFmtCHF` → `CHF 1'250'000`), cantons, LBA/LSFin.
- **KYC bloquant** dans le pipeline (un deal ne passe pas en "Intérêt confirmé" sans KYC).
- **C2PA** sur les photos publiées.
- **MEGGA AI** présent partout — suggestions contextuelles, jamais d'action auto invisible.
- **Langue** : interface en français (CH).

---

*Dernière mise à jour : mai 2026.*
*Références visuelles : Marketplace = **Property X** (`docs/design-system-propertyx.md` sur GitHub, port local dans `propertyx-tokens.jsx` + `propertyx-atoms.jsx`) — CRM = **Sugar Pure** (`MEGGA-DESIGN-SYSTEM.md`).*
