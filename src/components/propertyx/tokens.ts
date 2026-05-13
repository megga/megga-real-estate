// MEGGA Marketplace — Property X design tokens (port fidèle).
// Source : variables Figma extraites du fichier Property X (BRIX Templates).
// Direction artistique : 100% neutres (noir/blanc/gris), font Objectivity.

export const PX = {
  // ─── Neutrals (la seule palette du DS, pas de couleur d'accent) ──────
  neutral100: '#FFFFFF',  // page bg principal
  neutral200: '#FAFAFB',  // surface subtle / hover
  neutral300: '#EEEFF1',  // bordures, dividers
  neutral400: '#A4A6B0',  // texte muted, placeholders
  neutral500: '#464851',  // texte body / soft
  neutral700: '#14161C',  // texte primary / "ink"
  overlayDark10: '#0013581A',

  // ─── Aliases sémantiques (pour rester lisible dans le code) ──────────
  pageBg: '#FFFFFF',
  surfaceBg: '#FAFAFB',
  inkBg: '#14161C',        // sections noires (Featured, CTA, Footer)
  inkBgSubtle: '#1F2026',  // sections noires légèrement plus claires (cards)
  border: '#EEEFF1',
  borderInverse: 'rgba(255,255,255,0.10)',
  ink: '#14161C',
  inkSoft: '#464851',
  inkMuted: '#A4A6B0',
  inkInverse: '#FFFFFF',
  inkInverseSoft: 'rgba(255,255,255,0.72)',
  inkInverseMuted: 'rgba(255,255,255,0.48)',

  // ─── Typography ──────────────────────────────────────────────────────
  // Property X utilise "Objectivity" (police payante Pangram).
  // En attendant que tu fournisses les fichiers Objectivity, on fallback
  // sur Plus Jakarta Sans (déjà dans le projet, géométrie proche).
  font: {
    sans: '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif',
    display: '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif',
  },

  // Échelle Display (Property X : line-height 1.25 et letter-spacing -3 partout)
  // Tailles inférées (le DS Figma définit 14/16/20/24 mais les pages
  // utilisent des tailles dérivées plus grandes pour les heros — on ajoute h1/h2).
  type: {
    h1:       { size: 80, lh: 1.05, ls: -3, weight: 500 },  // hero
    h2:       { size: 56, lh: 1.1,  ls: -3, weight: 500 },  // section
    h3:       { size: 40, lh: 1.18, ls: -3, weight: 500 },  // sous-section
    h4:       { size: 24, lh: 1.25, ls: -3, weight: 500 },  // Display/5/Medium
    h5:       { size: 20, lh: 1.25, ls: -3, weight: 500 },  // Display/4/Medium
    body:     { size: 16, lh: 1.5,  ls: -3, weight: 400 },  // Display/2/Default
    bodyMd:   { size: 16, lh: 1.25, ls: -3, weight: 500 },  // Display/2/Medium
    bodySm:   { size: 14, lh: 1.5,  ls: -3, weight: 400 },  // Paragraph/Small/Regular
    bodySmMd: { size: 14, lh: 1.25, ls: -3, weight: 500 },  // Display/1/Medium
    label:    { size: 14, lh: 1.25, ls: -3, weight: 500 },  // Display/1/Uppercase/Medium
    // Aliases legacy
    caption:  { size: 13, lh: 1.3,  ls: 0,  weight: 500 },
    cta:      { size: 14, lh: 1,    ls: 0,  weight: 500 },
  },

  // ─── Spacing (extrait Figma) ─────────────────────────────────────────
  space: {
    none: 0,
    xxSmall: 2,
    xSmall: 6,
    small: 8,
    regular: 10,
    large: 16,
    xxxLarge: 48,
    // Aliases legacy (utilisés par les sections actuelles)
    section: 160,      // = sectionDefault
    sectionInner: 80,  // = sectionRegular
    pageX: 40,         // padding horizontal page
    blockGap: 32,
    itemGap: 16,
  },

  gap: {
    none: 0,
    xs: 8,
    sm: 12,
    md: 16,    // Regular
    lg: 24,    // Medium
    xl: 40,    // Extra Large
  },

  padding: {
    none: 0,
    xxs: 12,
    sm: 20,
    md: 24,
    lg: 32,
  },

  margin: {
    md: 24,
    xxl: 80,
  },

  // ─── Layout ──────────────────────────────────────────────────────────
  containerDesktop: 1440,
  sectionRegular: 80,   // entre sections petites
  sectionDefault: 160,  // entre sections principales (vrai Property X)

  // ─── Border Radius ───────────────────────────────────────────────────
  radius: {
    none: 0,
    tiny: 8,      // BR Tiny
    small: 12,    // BR Small
    large: 24,    // BR Large
    pill: 200,    // BR Pill (full rounded)
  },

  // Aliases legacy (pour rétro-compat avec mes anciens composants)
  radiusPill: 200,
  radiusCard: 24,
  radiusImage: 12,
  radiusInput: 12,

  // ─── Border Width ────────────────────────────────────────────────────
  borderWidth: {
    default: 1,
    medium: 1.5,
  },

  // ─── Shadows (Neutral/BS Small/Regular/Medium/Large) ────────────────
  // Source : page Basic Styles > Shadows du Figma Property X.
  shadow: {
    // BS Small : 0 4 4 0 #D3D3D30F + 0 1 1 0 #0E0E0E0A
    small: '0 4px 4px 0 rgba(211, 211, 211, 0.06), 0 1px 1px 0 rgba(14, 14, 14, 0.04)',
    // BS Regular : 0 2 4 0 #19213D14
    regular: '0 2px 4px 0 rgba(25, 33, 61, 0.08)',
    // BS Medium : 0 8 15 0 #19213D1A
    medium: '0 8px 15px 0 rgba(25, 33, 61, 0.10)',
    // BS Large : 0 8 24 0 #19213D1F
    large: '0 8px 24px 0 rgba(25, 33, 61, 0.12)',
    // Aliases pour mes composants existants
    soft: '0 4px 4px 0 rgba(211, 211, 211, 0.06), 0 1px 1px 0 rgba(14, 14, 14, 0.04)',
    card: '0 2px 4px 0 rgba(25, 33, 61, 0.08)',
    pillBlack: '0 2px 4px 0 rgba(20, 22, 28, 0.20)',
    pillWhite: '0 2px 4px 0 rgba(255, 255, 255, 0.10)',
  },

  // ─── Transitions ─────────────────────────────────────────────────────
  ease: 'cubic-bezier(.22, 1, .36, 1)',
  duration: {
    fast: '160ms',
    base: '240ms',
    slow: '480ms',
  },
} as const

export type PxPalette = typeof PX
