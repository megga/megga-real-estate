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
  neutral600: '#202127',  // ink subtle (extrait Figma node 11755:27864)
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
  // Property X utilise "Objectivity" (Pangram Pangram).
  // Fichiers .woff2 chargés dans /public/fonts/objectivity/ avec @font-face
  // déclaré dans src/styles/globals.css. 9 weights complets (100→950) +
  // italiques.
  font: {
    sans: '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif',
    display: '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif',
  },

  // Échelle Display — source Figma "🅰 Typography" (BS interior)
  // Convention Figma : letter-spacing -3 partout, line-height 1.25 sauf
  // Paragraph/* qui sont à 1.5.
  // Tailles Figma définies : 14, 16, 20, 24. Les heros (40/56/80) sont
  // dérivés par les sections et suivent la même règle ls -3.
  type: {
    // ─── Échelle Display 1→10 (Figma "🖋️ Typography Styles" exacte) ────
    // Source : node 11703:26347 (Typography page Figma).
    // letter-spacing -3 partout.
    display1:  { size: 16, lh: 1.25, ls: -3, weight: 500 },  // Display 1 : 16/125%
    display2:  { size: 18, lh: 1.25, ls: -3, weight: 500 },  // Display 2 : 18/125%
    display3:  { size: 20, lh: 1.25, ls: -3, weight: 500 },  // Display 3 : 20/125%
    display4:  { size: 22, lh: 1.25, ls: -3, weight: 500 },  // Display 4 : 22/125%
    display5:  { size: 24, lh: 1.25, ls: -3, weight: 500 },  // Display 5 : 24/125%
    display6:  { size: 30, lh: 1.25, ls: -3, weight: 500 },  // Display 6 : 30/125%
    display7:  { size: 36, lh: 1.25, ls: -3, weight: 500 },  // Display 7 : 36/125%
    display8:  { size: 48, lh: 1.25, ls: -3, weight: 500 },  // Display 8 : 48/125%
    display9:  { size: 60, lh: 1.15, ls: -3, weight: 500 },  // Display 9 : 60/115%
    display10: { size: 72, lh: 1.10, ls: -3, weight: 500 },  // Display 10 : 72/110% ← lh 1.10 pas 1.15

    // ─── Aliases sémantiques HTML (alignés sur l'échelle Display Figma) ─
    h1:       { size: 72, lh: 1.10, ls: -3, weight: 500 },  // = Display 10 (lh 1.10!)
    h2:       { size: 48, lh: 1.25, ls: -3, weight: 500 },  // = Display 8
    h3:       { size: 36, lh: 1.25, ls: -3, weight: 500 },  // = Display 7 (36 pas 32)
    h4:       { size: 24, lh: 1.25, ls: -3, weight: 500 },  // = Display 5
    h5:       { size: 22, lh: 1.25, ls: -3, weight: 500 },  // = Display 4 (22 pas 20)

    // ─── Body & utilitaires ────────────────────────────────────────────
    bodyMd:        { size: 16, lh: 1.25, ls: -3, weight: 500 }, // Display/2/Medium
    bodyDefault:   { size: 16, lh: 1.25, ls: -3, weight: 400 }, // Display/2/Default
    bodySmMd:      { size: 14, lh: 1.25, ls: -3, weight: 500 }, // Display/1/Medium
    bodySmDefault: { size: 14, lh: 1.25, ls: -3, weight: 400 }, // Display/1/Default
    label:         { size: 14, lh: 1.25, ls: -3, weight: 500 }, // Display/1/Uppercase/Medium

    // ─── Figma Paragraph/* (line-height 1.5) ───────────────────────────
    paragraphLg:   { size: 18, lh: 1.5,  ls: -3, weight: 500 }, // Paragraph/Large/Medium
    body:          { size: 16, lh: 1.5,  ls: -3, weight: 400 }, // Paragraph/Default/Regular
    bodySm:        { size: 14, lh: 1.5,  ls: -3, weight: 400 }, // Paragraph/Small/Regular

    // ─── Aliases legacy ───────────────────────────────────────────────
    caption:  { size: 13, lh: 1.3,  ls: 0,  weight: 500 },
    cta:      { size: 14, lh: 1,    ls: 0,  weight: 500 },
  },

  // ─── Spacing (Figma "Numbers/Spacings/*") ───────────────────────────
  space: {
    none: 0,        // Spacings/None
    xxSmall: 2,     // Spacings/XX Small
    xSmall: 6,      // Spacings/X Small
    small: 8,       // Spacings/Small
    regular: 10,    // Spacings/Regular
    medium: 12,     // Spacings/Medium
    large: 16,      // Spacings/Large
    xLarge: 24,     // Spacings/X Large
    xxLarge: 32,    // Spacings/XX Large
    xxxLarge: 48,   // Spacings/XXX Large
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
  sectionRegular: 80,   // entre sections petites — "Numbers/Sections/Regular"
  sectionDefault: 160,  // entre sections principales — "Spacings/Sections/Default"
  // Padding intérieur d'une section (Sections/PD * dans Figma)
  sectionPadding: {
    xs: 16,             // Sections/PD Extra Small
    small: 24,          // Sections/PD Small
    default: 48,        // Sections/PD Default
    medium: 64,         // Sections/PD Medium
  },

  // ─── Border Radius (Figma "Numbers/Radius/*" & "Border Radius/BR *") ─
  radius: {
    none: 0,            // Radius/None
    tiny: 8,            // BR Tiny / Radius/Small
    small: 12,          // BR Small
    medium: 16,         // Radius/Medium
    large: 24,          // BR Large / BR Default / Radius/Large
    pill: 200,          // BR Pill / Radius/Pill (full rounded)
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
