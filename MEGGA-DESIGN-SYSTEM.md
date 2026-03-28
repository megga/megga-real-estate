# MEGGA Design System

> Document de reference pour tous les produits MEGGA (Real Estate, Shield, etc.)
> Ce document ne contient AUCUNE fonctionnalite metier — uniquement le systeme de design visuel.
> Tout produit MEGGA doit suivre ces specifications pour garantir une identite visuelle unifiee.

---

## 1. IDENTITE VISUELLE

### Logo
- **Logo complet** : `/public/megga-logo.svg` (sidebar ouverte, navbar)
- **Icone GG** : `/public/megga-gg.svg` (sidebar repliee, favicon, mobile)
- En dark mode : `filter: brightness(0) invert(1)` pour inverser en blanc
- CSS : `style={{ filter: 'var(--logo-filter, none)' }}`

### Typographie
```
Police principale : "DM Sans", sans-serif (weights: 400, 500, 600, 700)
Police display :    "Plus Jakarta Sans", sans-serif (optionnel, pour les titres)

Import Google Fonts :
https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap
```

### Tailles de texte
```
text-xs    : 12px    — Captions, labels, metadata
text-sm    : 14px    — Body texte, inputs, boutons
text-base  : 16px    — Body principal
text-lg    : 18px    — Titres de cards
text-xl    : 20px    — Titres de sections
text-2xl   : 24px    — Titres de pages
text-3xl   : 30px    — Titres principaux
text-4xl   : 36px    — Hero titres
text-5xl   : 48px    — Hero titres large
```

---

## 2. COULEURS

### Systeme de couleurs par tokens CSS

Toutes les couleurs sont definies via CSS variables en format RGB (pour supporter l'opacite Tailwind). Deux themes : `:root` (light) et `[data-theme="dark"]`.

#### Theme clair (`:root`)
```css
/* Backgrounds */
--color-bg-page:      255 255 255;    /* #FFFFFF */
--color-bg-card:      255 255 255;    /* #FFFFFF */
--color-bg-section:   249 250 251;    /* #F9FAFB */
--color-bg-sidebar:   250 250 250;    /* #FAFAFA */
--color-bg-input:     243 244 246;    /* #F3F4F6 */
--color-bg-elevated:  255 255 255;    /* #FFFFFF */
--color-bg-hover:     249 250 251;    /* #F9FAFB */
--color-bg-active:    243 244 246;    /* #F3F4F6 */
--color-bg-overlay:   0 0 0;          /* #000000 (avec opacite) */

/* Textes */
--color-text-primary:    28 28 28;     /* #1C1C1C */
--color-text-secondary:  107 114 128;  /* #6B7280 */
--color-text-tertiary:   130 135 145;  /* #828791 */
--color-text-inverse:    255 255 255;  /* #FFFFFF */
--color-text-muted:      107 114 128;  /* #6B7280 */

/* Borders */
--color-border:          215 218 224;  /* #D7DAE0 */
--color-border-subtle:   229 231 235;  /* #E5E7EB */
--color-border-focus:    37 99 235;    /* #2563EB */

/* Accent (bleu MEGGA) */
--color-accent:       37 99 235;   /* #2563EB */
--color-accent-hover: 29 78 216;   /* #1D4ED8 */
--color-accent-light: 239 246 255; /* #EFF6FF */
--color-accent-dark:  30 64 175;   /* #1E40AF */
--color-accent-fg:    255 255 255; /* #FFFFFF */

/* Statuts */
--color-success:       5 150 105;    /* #059669 */
--color-success-light: 236 253 245;  /* #ECFDF5 */
--color-warning:       217 119 6;    /* #D97706 */
--color-warning-light: 255 251 235;  /* #FFFBEB */
--color-danger:        220 38 38;    /* #DC2626 */
--color-danger-light:  254 242 242;  /* #FEF2F2 */
```

#### Theme sombre (`[data-theme="dark"]`)
```css
/* Backgrounds */
--color-bg-page:      28 28 28;    /* #1C1C1C */
--color-bg-card:      42 42 42;    /* #2A2A2A */
--color-bg-section:   34 34 34;    /* #222222 */
--color-bg-sidebar:   22 22 22;    /* #161616 */
--color-bg-input:     50 50 50;    /* #323232 */
--color-bg-elevated:  42 42 42;    /* #2A2A2A */
--color-bg-hover:     50 50 50;    /* #323232 */
--color-bg-active:    56 56 56;    /* #383838 */

/* Textes */
--color-text-primary:    236 236 239;  /* #ECECEF */
--color-text-secondary:  142 142 150;  /* #8E8E96 */
--color-text-tertiary:   107 107 107;  /* #6B6B6B */
--color-text-inverse:    28 28 28;     /* #1C1C1C */

/* Borders */
--color-border:          56 56 56;   /* #383838 */
--color-border-subtle:   42 42 42;   /* #2A2A2A */

/* Accent (plus clair en dark pour le contraste) */
--color-accent:       59 130 246;  /* #3B82F6 */
--color-accent-hover: 96 165 250;  /* #60A5FA */
--color-accent-light: 23 37 84;    /* fond sombre bleu */
--color-accent-dark:  37 99 235;   /* #2563EB */

/* Statuts dark */
--color-success:       16 185 129;  /* #10B981 */
--color-success-light: 6 45 35;
--color-warning:       245 158 11;  /* #F59E0B */
--color-warning-light: 50 35 7;
--color-danger:        239 68 68;   /* #EF4444 */
--color-danger-light:  55 15 15;
```

### Tokens Tailwind semantiques

Utiliser TOUJOURS ces classes au lieu de couleurs hardcodees :

```
Backgrounds : bg-theme-page, bg-theme-card, bg-theme-section, bg-theme-sidebar,
              bg-theme-input, bg-theme-elevated, bg-theme-hover, bg-theme-active

Textes :      text-theme-primary, text-theme-secondary, text-theme-tertiary,
              text-theme-muted, text-theme-inverse

Borders :     border-theme-border, border-theme-border-subtle, border-theme-border-focus

Accent :      bg-accent, text-accent, border-accent (+ /hover, /light, /dark)
Statuts :     text-success, bg-success-light, text-warning, text-danger, etc.
```

**JAMAIS utiliser** : `bg-white`, `bg-gray-50`, `text-gray-900`, `border-gray-200` — ils ne fonctionnent pas en dark mode.

### Presets de couleur accent (personnalisables par l'utilisateur)

```
Sapphire (defaut) :  #2563EB / #3B82F6 (dark)
Graphite :           #4A4A55 / #8B8B99
Burgundy :           #8B2252 / #C44B7A
Forest :             #2D6A4F / #52B788
Ocean :              #1B6B8A / #3BA5CC
Mauve :              #6B4C8A / #9B7BBF
Bronze :             #8B6F47 / #C4A06E
Custom :             Hex libre avec variantes auto-generees
```

---

## 3. OMBRES

```css
--shadow-card:       0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
--shadow-card-hover: 0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04);
--shadow-navbar:     0 1px 3px rgba(0,0,0,0.05);
--shadow-dropdown:   0 10px 40px rgba(0,0,0,0.12);
--shadow-modal:      0 20px 60px rgba(0,0,0,0.15);

/* Dark mode — ombres plus prononcees */
--shadow-card:       0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
--shadow-card-hover: 0 10px 25px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3);
--shadow-dropdown:   0 10px 40px rgba(0,0,0,0.5);
--shadow-modal:      0 20px 60px rgba(0,0,0,0.6);
```

---

## 4. BORDER RADIUS

```css
--radius-card:   12px;   /* Cards, containers principaux */
--radius-button: 8px;    /* Boutons */
--radius-input:  10px;   /* Champs de formulaire */
--radius-badge:  6px;    /* Badges, pills */
```

Presets personnalisables :
```
sharp :   card 4px,  button 4px,  input 4px,  badge 3px
default : card 12px, button 8px,  input 10px, badge 6px
pill :    card 20px, button 12px, input 16px, badge 10px
```

---

## 5. SPACING & DENSITE

### Presets de densite
```
compact :     cardPadding 16px, gap 12px, fontSize 13px
comfortable : cardPadding 20px, gap 16px, fontSize 14px (defaut)
spacious :    cardPadding 24px, gap 20px, fontSize 15px
```

### Spacing de reference
```
Page padding :     px-4 md:px-6 lg:px-8
Max width :        max-w-7xl mx-auto (1280px)
Card padding :     p-5 (20px)
Input height :     h-10 (40px) — h-11 pour CTA primaires
Button height :    h-10 (40px)
Navbar height :    h-16 (64px)
Sidebar width :    w-64 (256px) ouvert, w-[60px] replie
Section gap :      py-12 md:py-16
Card gap :         gap-4 md:gap-6
```

---

## 6. Z-INDEX LAYERS

```
z-30  : Header mobile sticky
z-40  : Sticky nav bars, bottom bars
z-50  : Modals standards, popovers, dropdowns, navbar
z-[80] : Panels overlay (preview, slide-in)
z-[90] : Dialogs prioritaires
z-[100] : Modals critiques (createPortal)
z-[110] : Context menus, tooltips au-dessus des modals
```

---

## 7. COMPOSANTS UI

### 7.1 Button

```tsx
/* Variantes */
default :     border border-theme-border text-theme-secondary
              hover:text-theme-primary hover:border-theme-active
destructive : bg-danger text-white hover:bg-danger-dark
outline :     border border-border bg-transparent hover:bg-section
ghost :       bg-transparent hover:bg-section
link :        text-accent underline-offset-4 hover:underline

/* Tailles */
default : h-10 px-4 py-2
sm :      h-9 px-3
lg :      h-11 px-8
icon :    h-10 w-10

/* Base commune */
inline-flex items-center justify-center rounded-button text-sm font-medium
transition-colors focus-visible:outline-none focus-visible:ring-2
disabled:pointer-events-none disabled:opacity-50
```

**REGLE** : Le CTA primaire de conversion (ex: "Contacter", "Planifier") peut utiliser `bg-accent text-white`. Tous les autres boutons utilisent le style ghost (border).

### 7.2 Input

```tsx
w-full h-10 px-3 text-sm
bg-theme-input border border-theme-border rounded-input
placeholder:text-theme-muted
focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
transition-colors
disabled:opacity-50 disabled:cursor-not-allowed
```

### 7.3 Card / Bento

```tsx
/* Container standard — PAS d'ombre, juste une bordure */
<div className="rounded-xl border border-theme-border p-5">

/* Card avec ombre (optionnel, pour elements eleves) */
<div className="rounded-xl border border-theme-border p-5 shadow-card">
```

### 7.4 Badge

```tsx
/* Badge texte (pas de fond) */
<span className="text-xs font-medium text-red-500">Eleve</span>

/* Badge avec fond */
<span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-accent/10 text-accent">Actif</span>

/* Variantes */
default : bg-theme-active text-theme-secondary
accent :  bg-accent/10 text-accent
success : bg-success-light text-success
warning : bg-warning-light text-warning
danger :  bg-danger-light text-danger
```

### 7.5 Tabs

```tsx
/* TabsList */
inline-flex h-10 items-center gap-1 border-b border-border w-full

/* TabsTrigger */
px-4 py-2 text-sm font-medium text-muted
hover:text-primary
data-[state=active]:text-accent
data-[state=active]:border-b-2 data-[state=active]:border-accent
```

### 7.6 Switch / Toggle

```tsx
/* Root */
peer inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
border-2 border-transparent transition-colors
data-[state=checked]:bg-accent
data-[state=unchecked]:bg-gray-200

/* Thumb */
h-4 w-4 rounded-full bg-white shadow-lg transition-transform
data-[state=checked]:translate-x-4
data-[state=unchecked]:translate-x-0
```

### 7.7 Modal / Dialog

```tsx
/* TOUJOURS via createPortal(document.body) */

/* Overlay */
fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm

/* Content */
relative bg-theme-card rounded-xl border border-theme-border p-6
max-w-lg w-full mx-4 shadow-modal
animate-in fade-in zoom-in-95 duration-200

/* Actions en bas */
flex justify-end gap-3 mt-6
  <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary">Annuler</button>
  <button className="h-9 px-4 text-sm font-medium border border-theme-border rounded-lg hover:border-theme-active">Confirmer</button>
```

### 7.8 Dropdown Menu

```tsx
/* Content */
z-50 min-w-[8rem] rounded-md border border-theme-border
bg-theme-elevated p-1 shadow-dropdown
animate-in zoom-in-95

/* Item */
rounded-sm px-2 py-1.5 text-sm
focus:bg-theme-hover focus:text-theme-primary
```

---

## 8. LAYOUT

### 8.1 Navbar (publique)

```
Hauteur :    h-16 (64px)
Position :   sticky top-0 z-50
Background : bg-white/95 backdrop-blur-md (scrolled)
             bg-transparent (home page, pas de scroll)
Border :     border-b border-gray-100 (scrolled)
Logo :       h-7 (28px)
Liens :      text-[15px] font-medium, gap-1.5
Lien actif : underline 2px accent sous le texte
CTA droite : "Publier" (outline) + "Se connecter" (accent)
Mobile :     hamburger menu, slide-down max-h-[500px]
```

### 8.2 Sidebar (dashboard)

```
Position :     fixe a gauche, h-full
Background :   bg-theme-sidebar
Border :       border-r border-theme-border-subtle
Largeur :      w-64 (256px) ouvert, w-[60px] replie
Transition :   transition-[width] duration-200 ease-out
Logo ouvert :  megga-logo.svg (logo complet)
Logo replie :  megga-gg.svg (icone GG, w-7 h-7 mx-auto)

/* Navigation */
Sections :     Labels en majuscule text-[10px] text-theme-muted font-semibold uppercase tracking-wider
Items :        h-9 rounded-lg mx-2 px-2.5 gap-2.5 text-sm
Item actif :   bg-accent/8 text-accent font-medium
Item hover :   bg-theme-hover text-theme-primary
Item replie :  justify-center w-10, tooltip au hover

/* Pliage */
Labels :       opacity animee avec delay-75 au depliage
Bouton plier : en bas de la sidebar (pas a cote du logo)
Tooltips :     quand replie, nom de page au hover

/* Styles de sidebar (personnalisables) */
default :      couleurs theme neutre
colored :      bg-accent, texte blanc, hover bg-accent-dark
minimal :      ultra-condense, icones seules
```

### 8.3 Agent Layout (structure globale dashboard)

```tsx
<div className="flex h-screen overflow-hidden bg-theme-section">
  <Sidebar />                           /* Gauche, fixe */
  <div className="flex-1 flex flex-col min-w-0">
    <MobileHeader />                     /* Mobile seulement, h-14 sticky */
    <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-4 overflow-y-auto">
      <PageHeader />
      {/* Contenu de la page */}
    </main>
    <MobileTabBar />                     /* Mobile seulement, bottom fixed */
  </div>
</div>
```

---

## 9. ANIMATIONS & TRANSITIONS

### Transitions globales
```css
/* Changement de theme — smooth 0.35s */
body { transition: background-color 0.35s ease, color 0.35s ease; }

/* Elements du theme — 0.3s pendant la transition */
[data-theme-transitioning] * {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

/* Couleur accent — toujours fluide */
.text-accent, .bg-accent, .border-accent {
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}
```

### Animations composants
```
Modals :       animate-in fade-in zoom-in-95 duration-200
Dropdowns :    animate-in zoom-in-95 (slide-in-from-top-2 si side=bottom)
Slide-in :     animate-in slide-in-from-right duration-300
Fade :         animate-in fade-in duration-100
Images hover : group-hover:scale-[1.02] transition-transform duration-500
Cards hover :  hover:shadow-card-hover transition-shadow duration-200
Sidebar :      transition-[width] duration-200 ease-out
Labels sidebar: opacity transition avec delay-75
```

### Scroll infini horizontal
```css
@keyframes scroll-x {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-scroll-x { animation: scroll-x 25s linear infinite; }
.animate-scroll-x:hover { animation-play-state: paused; }
```

---

## 10. RESPONSIVE

### Breakpoints
```
sm  : 640px   (mobile large)
md  : 768px   (tablette)
lg  : 1024px  (desktop)
xl  : 1280px  (desktop large)
2xl : 1536px  (ultra-large)
```

### Patterns responsifs
```
/* Mobile-first */
hidden md:flex           /* Cache sur mobile, visible sur tablette+ */
md:hidden                /* Visible mobile, cache tablette+ */
p-4 md:p-6 lg:p-8       /* Padding progressif */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3   /* Grilles adaptatives */
h-14 md:h-16            /* Navbar adaptative */
```

---

## 11. DARK MODE

### Implementation
```tsx
/* Activer */
document.documentElement.setAttribute('data-theme', 'dark')

/* Desactiver */
document.documentElement.removeAttribute('data-theme')

/* Transition fluide */
1. Ajouter [data-theme-transitioning] au root
2. Les elements transitionnent pendant 0.3s
3. Retirer l'attribut apres 320ms
```

### Logo en dark mode
```tsx
<img src="/megga-logo.svg" style={{ filter: 'var(--logo-filter, none)' }} />
/* --logo-filter: none (light) / brightness(0) invert(1) (dark) */
```

### Toggles dark mode
```
Fond toggle off : bg-gray-200 (light) / bg-gray-600 (dark)
Fond toggle on :  bg-accent
JAMAIS bg-theme-primary pour le toggle (il est blanc en dark = invisible)
```

---

## 12. REGLES DE DESIGN ABSOLUES

### A FAIRE
- Toujours utiliser les tokens semantiques (`text-theme-primary`, `bg-theme-card`, etc.)
- Toujours `cn()` (clsx + tailwind-merge) pour les classes conditionnelles
- Toujours `createPortal(document.body)` pour les modals avec `z-[100]`
- Toujours gerer les etats : loading, empty, error
- Toujours responsive : mobile-first

### A NE PAS FAIRE
- JAMAIS de couleurs hardcodees (`bg-white`, `text-gray-900`, `border-gray-200`)
- JAMAIS de `bg-accent text-white` sur les boutons standard — utiliser ghost (border)
- JAMAIS d'ombres sur les bentos — juste `border border-theme-border`
- JAMAIS de modals rendus inline — toujours `createPortal`
- JAMAIS de scrollbars visibles dans les modals — utiliser `.scrollbar-hide`
- JAMAIS de titres UPPERCASE pour les sections — utiliser capitalize
- JAMAIS de gradients flashy ni de couleurs saturees

---

## 13. STACK TECHNIQUE DE REFERENCE

```
Frontend :     React 18+ / TypeScript / Vite / Tailwind CSS 3
UI Kit :       shadcn/ui + Radix UI
Icons :        Lucide React
Animations :   tailwindcss-animate + motion/react (Framer Motion)
Fonts :        DM Sans (Google Fonts)
Helpers :      cn() = clsx + tailwind-merge
```

### Fonction utilitaire `cn()`
```tsx
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 14. PRINT STYLES

```css
@media print {
  /* Cacher navigation, barres fixes, overlays */
  aside, header, [class*="fixed"][class*="bottom"], [class*="z-50"] { display: none; }

  /* Contenu pleine largeur */
  main { width: 100%; margin: 0; padding: 0; }

  /* Forcer light mode */
  * { background: white !important; color: black !important; }
  * { print-color-adjust: exact; }

  /* Eviter les coupures dans les cards */
  .rounded-xl { break-inside: avoid; }
}
```

---

> **Ce document est la source de verite pour le design system MEGGA.**
> Tout produit MEGGA (Shield, Real Estate, futurs produits) doit implementer ces specifications pour garantir une experience utilisateur coherente.
