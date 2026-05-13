# MEGGA Marketplace — Property X Design System

> **Source** : Template Property X par BRIX Templates (licence achetée par MEGGA).
> Extrait via Figma MCP depuis le fichier `fZovI4RREX4XHpLazsz8JB`, page `⚙️ Components` (node `1:5`).
>
> **Direction artistique** : 100% neutres (noir / blanc / gris), aucune couleur d'accent.
> Sans-serif moderne (Objectivity), letter-spacing -3, line-height 1.25, layouts asymétriques, photos qui dominent.
>
> **Implémentation** : [`src/components/propertyx/`](../src/components/propertyx/)

---

## 1. Tokens

> Code source : [`src/components/propertyx/tokens.ts`](../src/components/propertyx/tokens.ts)

### 1.1 Couleurs (Neutrals)

| Token | Hex | Usage |
|---|---|---|
| `neutral100` | `#FFFFFF` | Page bg principal, texte sur fond noir |
| `neutral200` | `#FAFAFB` | Surface subtle, hover, inputs light |
| `neutral300` | `#EEEFF1` | Bordures, dividers, avatars vides |
| `neutral400` | `#A4A6B0` | Texte muted, placeholders, eyebrows uppercase |
| `neutral500` | `#464851` | Texte body / soft |
| `neutral700` | `#14161C` | Texte primary, sections ink, bg primary buttons |
| `overlayDark10` | `#0013581A` | Overlays foncés (drop shadow soft) |

**Aucune couleur d'accent.** Les badges/CTAs s'appuient sur le contraste noir/blanc.

### 1.2 Typographie

```ts
font: {
  sans:    '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif',
  display: '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif',
}
```

- **Police primaire** : **Objectivity** (Pangram Pangram — payante)
- **Fallback actuel** : Plus Jakarta Sans (géométrie proche)
- **Échelle** : 14 / 16 / 20 / 24 (base), 40 / 56 / 80 (hero)
- **Tracking universel** : `letter-spacing: -3` (sur tous les Display)
- **Line-height** : 1.25 (Medium) ou 1.5 (Regular paragraph)
- **Weights** : 400 (Regular), 500 (Medium). Pas de Bold dans le DS.

⚠️ **Police Objectivity à fournir** — déposer les `.woff2` dans `public/fonts/objectivity/` et la déclarer dans `index.html` ou un CSS global.

### 1.3 Spacings

```
xxSmall: 2    xSmall: 6     small: 8       regular: 10
large: 16     xxxLarge: 48

gap:     xs 8  / sm 12 / md 16 / lg 24 / xl 40
padding: xxs 12 / sm 20 / md 24 / lg 32
section: regular 80 / default 160 (entre sections principales)
margin:  md 24 / xxl 80
```

### 1.4 Border Radius

| Token | Valeur | Usage |
|---|---|---|
| `radius.tiny` | `8px` | Inputs textarea, list items |
| `radius.small` | `12px` | Cards petites, image cards |
| `radius.large` | `24px` | Cards sections, upload card |
| `radius.pill` | `200px` | Buttons, badges, avatars, toggles |

### 1.5 Shadows

**Page Basic Styles > Shadows du Figma** — 4 niveaux d'élévation neutre.

| Token | Valeur CSS | Usage |
|---|---|---|
| `shadow.small` | `0 4 4 0 #D3D3D30F, 0 1 1 0 #0E0E0E0A` | Cards passives, états repos, items de liste |
| `shadow.regular` | `0 2 4 0 #19213D14` | Cards par défaut, sections (Neutral/BS Regular) |
| `shadow.medium` | `0 8 15 0 #19213D1A` | Cards hover, dropdowns, popovers |
| `shadow.large` | `0 8 24 0 #19213D1F` | Modals, drawers, surfaces très élevées |

```ts
// Pattern Property X : Shadow Card avec border + shadow combinés
<div style={{
  background: PX.neutral100,
  border: `1px solid ${PX.neutral300}`,
  borderRadius: PX.radius.large,
  boxShadow: PX.shadow.medium,
  padding: 24,
}}>
```

### 1.6 Layout

- Container desktop : **1440px** max-width
- Section vertical spacing : **160px** entre sections principales
- Page horizontal padding : **40px**

---

## 2. Composants atomes

> 10 atomes officiels du Figma `⚙️ Components` + extensions utilitaires.
> Tous importables via `import { ... } from '@/components/propertyx'`.

### 2.1 PxButton + PxCircleButton

> [`PxButton.tsx`](../src/components/propertyx/PxButton.tsx)

**Pattern signature** : pill **asymétrique** (`paddingLeft: 16`, `paddingRight: 6` ou `10`) + icône arrow dans un **cercle inverse** à droite.

```tsx
<PxButton to="/acheter" variant="primary" size="lg">Commencer</PxButton>
<PxButton variant="invert" size="sm">Démarrer</PxButton>
<PxButton variant="ghost" showIcon={false}>Annuler</PxButton>

<PxCircleButton size="lg" variant="light" ariaLabel="Précédent">
  <PxIcon name="chevron-left" />
</PxCircleButton>
```

| Prop | Valeurs |
|---|---|
| `variant` | `primary` (noir/blanc) · `invert` (blanc/noir) · `ghost` |
| `size` | `sm` (32px h) · `lg` (40px h) |
| `to`/`href`/`onClick` | Routing / lien externe / handler |
| `showIcon` | Cacher l'icône cercle (défaut `true`) |
| `icon` | Override de l'icône arrow par défaut |

### 2.2 PxBadge

> [`PxBadge.tsx`](../src/components/propertyx/PxBadge.tsx)

```tsx
<PxBadge variant="invert" size="sm">À louer</PxBadge>
<PxBadge variant="primary" size="lg" icon={<PxIconFont name="check-circle" size={14} />}>
  Vérifié
</PxBadge>
```

| Prop | Valeurs |
|---|---|
| `variant` | `primary` (noir) · `invert` (blanc) |
| `size` | `sm` (compact) · `lg` (avec cercle d'icône interne 26px) |
| `icon` | Icône optionnelle (à gauche pour sm, dans cercle pour lg) |

### 2.3 PxInput + variants

> [`PxInput.tsx`](../src/components/propertyx/PxInput.tsx)

```tsx
<PxInput variant="light" placeholder="..." leftIcon={<PxIcon name="search" />} />
<PxInput variant="dark" placeholder="email@..." rightSlot={<PxButton size="sm">OK</PxButton>} />

<PxSelect value={x} onChange={...}>
  <option value="a">A</option>
</PxSelect>

<PxTextArea placeholder="..." />

<PxCheckbox checked={x} onChange={setX} label="Accepter" size="lg" />
<PxRadio checked={x} onChange={...} name="g" label="Option" />
<PxToggle checked={x} onChange={setX} label="Activer" size="lg" />
```

| Composant | Variants |
|---|---|
| `PxInput` | `light` (bg neutral 200, h 48) · `dark` (bg neutral 700, h 52) |
| `PxSelect` | bg neutral 200, pill, chevron-down auto |
| `PxTextArea` | bg neutral 200, radius 8, min-h 104 |
| `PxCheckbox` / `PxRadio` / `PxToggle` | `sm` (14) · `lg` (18 ou 18×32) |

### 2.4 PxUploadCard

> [`PxUploadCard.tsx`](../src/components/propertyx/PxUploadCard.tsx)

```tsx
<PxUploadCard variant="outline" accept="image/*" multiple onFiles={(files) => {...}} />
<PxUploadCard variant="filled" title="Sélectionner des photos" hint="ou glissez-déposez" />
```

| Prop | Valeurs |
|---|---|
| `variant` | `outline` (bg clair) · `filled` (bg ink noir) |
| `accept` / `multiple` | Standard input file |
| `onFiles` | Handler appelé avec `FileList` (click ou drag-drop) |

### 2.5 PxAvatar

> [`PxAvatar.tsx`](../src/components/propertyx/PxAvatar.tsx)

```tsx
<PxAvatar src="..." alt="Sophie" size={48} />
<PxAvatar fallback="SB" size={120} />
```

| Prop | Valeurs |
|---|---|
| `size` | `32` · `40` · `48` · `80` · `120` · `160` · `200` |
| `src` | URL image (si absent, fallback initiales) |
| `fallback` | Texte affiché si pas de src |

### 2.6 PxLink

> [`PxLink.tsx`](../src/components/propertyx/PxLink.tsx)

```tsx
<PxLink to="/acheter" variant="dark" weight="medium" arrow>
  Parcourir la marketplace
</PxLink>
<PxLink href="mailto:..." variant="light">support@megga.ch</PxLink>
```

| Prop | Valeurs |
|---|---|
| `variant` | `dark` (sur fond clair) · `light` (sur fond ink) |
| `weight` | `regular` (400) · `medium` (500) |
| `arrow` | Ajoute une arrow-right auto à droite |
| `leftIcon` / `rightIcon` | Slots libres |

### 2.7 PxLogo

> [`PxLogo.tsx`](../src/components/propertyx/PxLogo.tsx)

```tsx
<PxLogo variant="dark" form="text" size="sm" to="/" />
<PxLogo variant="light" form="icon" size="lg" />
```

| Prop | Valeurs |
|---|---|
| `variant` | `dark` (noir) · `light` (blanc) |
| `form` | `icon` (seul) · `text` (icon + "MEGGA") |
| `size` | `sm` (22) · `md` (36) · `lg` (80) |

### 2.8 PxIcon (line)

> [`PxIcon.tsx`](../src/components/propertyx/PxIcon.tsx) — 60 icônes line-style, stroke 1.7

Catalogue : `search`, `location`, `chevron-{down,up,left,right}`, `arrow-{up,right,down,left}`, `bed`, `bath`, `surface`, `sofa`, `kitchen`, `parking`, `star`, `heart`, `share`, `flag`, `bookmark`, `plus`, `minus`, `close`, `check`, `menu`, `mail`, `phone`, `calendar`, `clock`, `lock`, `home`, `building`, `key`, `gallery`, `sparkle`, `shield`, `eye`, `globe`, `compass`, `filter`, `sort`, `settings`, `download`, `upload`, `user`, `users`, `logout`, `info`, `help`, `alert`, `credit-card`, `bell`, `bell-ring`, `edit`, `trash`, `copy`, `external`, `play`, `pause`, `refresh`, `expand`, `collapse`, `thumb-{up,down}`, `message`, `send`.

```tsx
<PxIcon name="search" size={18} color={PX.neutral500} />
```

### 2.9 PxIconFont (filled)

> [`PxIconFont.tsx`](../src/components/propertyx/PxIconFont.tsx) — 35 icônes filled (forme pleine)

Catalogue : `home`, `building`, `buildings`, `door`, `key`, `bed`, `bath`, `sofa`, `kitchen`, `dimensions`, `bell`, `bookmark`, `heart`, `star`, `flag`, `calendar`, `clock`, `mail`, `phone`, `location`, `eye`, `camera`, `gallery`, `globe`, `compass`, `check-circle`, `close-circle`, `info`, `help`, `alert`, `shield`, `lock`, `user`, `users`, `credit-card`.

```tsx
<PxIconFont name="heart" size={20} color={PX.neutral700} />
```

### 2.10 PxImage

> [`PxImage.tsx`](../src/components/propertyx/PxImage.tsx)

```tsx
<PxImage
  src="/photo.jpg"
  ratio="landscape"
  radius="large"
  overlay={<PxBadge variant="invert">À louer</PxBadge>}
/>
```

| Prop | Valeurs |
|---|---|
| `radius` | `none` · `tiny` (8) · `small` (12) · `large` (24) |
| `ratio` | `square` (1/1) · `landscape` (4/3) · `portrait` (3/4) · `wide` (16/9) · `auto` |
| `overlay` | ReactNode superposé (badge, gradient, ...) |

### 2.11 PxList + PxListItem

> [`PxList.tsx`](../src/components/propertyx/PxList.tsx)

```tsx
<PxList gap={8}>
  <PxListItem leftIcon={<PxIcon name="home" />} active>Logo</PxListItem>
  <PxListItem to="/buttons" leftIcon={<PxIcon name="settings" />}>Buttons</PxListItem>
  <PxListItem onClick={...} leftIcon={<PxIcon name="link" />}>Links</PxListItem>
</PxList>
```

### 2.12 PxSectionLabel

> [`PxSectionLabel.tsx`](../src/components/propertyx/PxSectionLabel.tsx) — eyebrow uppercase au-dessus des titres de section

```tsx
<PxSectionLabel>À propos de MEGGA</PxSectionLabel>
<PxSectionLabel invert>Témoignages</PxSectionLabel>
```

Style : 14px, weight 500, letter-spacing -0.42, uppercase, color `neutral400`.

---

## 3. Compositions / sections de page

> Pattern réutilisé pour toutes les pages marketplace.
> Code source : [`src/components/propertyx/sections/`](../src/components/propertyx/sections/)

### 3.1 Structure d'une section type

```tsx
<section style={{ padding: `${PX.sectionDefault}px 40px`, background: PX.neutral100 }}>
  <div style={{ maxWidth: PX.containerDesktop, margin: '0 auto' }}>
    {/* Header */}
    <PxSectionLabel>Eyebrow</PxSectionLabel>
    <h2 style={h2Style}>Titre principal</h2>

    {/* Body grid / flex */}
    <div>...</div>
  </div>
</section>
```

### 3.2 Sections livrées

- **PxNav** — top nav (logo + 4 liens + CTA)
- **PxHero** — photo plein cadre + markers + titre h1 + 2 CTAs
- **PxSearchBar** — barre flottante avec PxInput + 3 PxSelect + PxButton
- **PxAboutSection** — 3 colonnes : narrative + iPhone mockup + stats
- **PxFeaturedProperties** — section noire, cards de biens + carousel
- **PxAllProperties** — sticky header + 3 cards horizontales de biens
- **PxHowItWorks** — accordéon 1-2-3 + photo lifestyle
- **PxExploreCTA** — section noire CTA + iPad mockup
- **PxTestimonials** — 1 grande card + 2 petites empilées
- **PxFooter** — newsletter + 3 colonnes liens + crédits

---

## 4. Conventions de code

### 4.1 Imports

```tsx
import { PX, PxButton, PxBadge, PxIcon } from '@/components/propertyx'
```

### 4.2 Styling — inline style objects (pas de Tailwind)

Property X utilise des **inline styles** (cohérent avec le pattern Sugar v2 du CRM agent).
**Pas de Tailwind classes** sur les composants Property X — uniquement les `PX.*` tokens.

```tsx
// ✅ OK
<div style={{ background: PX.neutral100, padding: PX.padding.md }}>

// ❌ Pas Property X
<div className="bg-white p-6">
```

### 4.3 Espacement vertical entre sections

Toujours `PX.sectionDefault` (160px) entre les sections principales.

### 4.4 Responsivité

`fontSize: clamp(40px, 6.5vw, 88px)` pour les h1/h2 — assure une mise à l'échelle fluide sans breakpoints media-query explicites.

---

## 5. Statut & roadmap

### Ce qui est fait
- ✅ Tokens complets (couleurs, typo, spacings, radii, shadows)
- ✅ 10 atomes officiels du Figma `Components` (Logo, Buttons, Badges, Inputs, Avatars, Links, Lists, Icons, Icon font, Images)
- ✅ PxUploadCard (atome distinct des Inputs)
- ✅ HomePage refactorée — 10 sections utilisent les atomes
- ✅ Routing `/` → PropertyXHomePage (legacy sur `/home-legacy`)

### Ce qui est ouvert / à venir

#### Police Objectivity
Déposer les `.woff2` (gauche par le user) dans `public/fonts/objectivity/` et déclarer :

```css
/* index.html ou global.css */
@font-face {
  font-family: 'Objectivity';
  src: url('/fonts/objectivity/Objectivity-Regular.woff2') format('woff2');
  font-weight: 400;
}
@font-face {
  font-family: 'Objectivity';
  src: url('/fonts/objectivity/Objectivity-Medium.woff2') format('woff2');
  font-weight: 500;
}
```

#### Autres pages à porter
- `/acheter` + `/louer` (= Properties grid)
- `/listing/:id` (= Single Property)
- `/agents/:slug` (= Agent Single)
- `/publier` (= Submit Property) — utilisera `PxUploadCard`
- `/contact` (3 versions disponibles dans Figma)
- About page

#### Catalogues d'icônes
Ajouter à `PxIcon` ou `PxIconFont` au besoin — le Figma a beaucoup plus de glyphs.

---

## 6. Notes IP & licence

- Template Property X acheté chez **BRIX Templates** via la marketplace Webflow
- Adaptation autorisée par la licence du template
- Police **Objectivity** : licence séparée (Pangram Pangram) — à vérifier dans le ZIP BRIX

---

## 7. Sections ouvertes pour ajouts

> Place pour les compléments que tu veux donner par la suite.

### 7.1 Autres composants à porter

_(à remplir)_

### 7.2 Patterns spécifiques marketplace

_(à remplir)_

### 7.3 Animations & micro-interactions

_(à remplir)_

### 7.4 Breakpoints responsive précis

_(à remplir)_

### 7.5 Custom MEGGA additions

_(à remplir)_

---

## Changelog

- **2026-05-13** — Création initiale. DS complet extrait du Figma, 12 composants + tokens + sections HomePage refactorées.
