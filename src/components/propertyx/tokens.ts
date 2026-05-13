// MEGGA Marketplace — Property X design tokens.
// Adaptation du template BRIX Templates "Property X" pour MEGGA.
//
// Direction artistique : noir/blanc/crème, sans-serif moderne,
// photos qui dominent, layout asymétrique, beaucoup d'air vertical.

export const PX = {
  // ─── Surfaces ────────────────────────────────────────────────────────
  pageBg: '#F7F5F0',           // crème chaud (fond principal pages light)
  surfaceBg: '#FFFFFF',         // cards/sections "elevated"
  inkBg: '#0A0A0A',             // sections noires (featured, CTA, footer)
  inkBgSubtle: '#141414',       // ink + 5% lightness pour overlays

  // ─── Encres (texte) ──────────────────────────────────────────────────
  ink: '#0A0A0A',               // texte principal
  inkSoft: '#3A3A3A',           // texte body
  inkMuted: '#737373',          // sous-titres, captions
  inkInverse: '#FFFFFF',        // texte sur fond noir
  inkInverseSoft: 'rgba(255,255,255,0.72)',
  inkInverseMuted: 'rgba(255,255,255,0.48)',

  // ─── Bordures ────────────────────────────────────────────────────────
  border: 'rgba(10,10,10,0.08)',
  borderInverse: 'rgba(255,255,255,0.10)',

  // ─── Radii ───────────────────────────────────────────────────────────
  radiusPill: 999,
  radiusCard: 24,
  radiusImage: 20,
  radiusInput: 14,

  // ─── Spacing scale (pixels) ──────────────────────────────────────────
  space: {
    section: 96,                // entre sections verticales
    sectionInner: 64,           // padding interne haut/bas d'une section
    pageX: 40,                  // padding horizontal page
    blockGap: 32,               // entre blocks dans une section
    itemGap: 16,
  },

  // ─── Typographie ─────────────────────────────────────────────────────
  font: {
    sans: '"DM Sans", system-ui, sans-serif',
    display: '"Plus Jakarta Sans", "DM Sans", sans-serif',
  },

  // Échelle typo (taille / lineHeight / letterSpacing)
  type: {
    h1: { size: 64, lh: 1.08, ls: -1.4, weight: 600 },     // hero
    h2: { size: 48, lh: 1.12, ls: -1.0, weight: 600 },     // section
    h3: { size: 32, lh: 1.18, ls: -0.6, weight: 600 },     // sous-section
    h4: { size: 22, lh: 1.25, ls: -0.3, weight: 600 },     // card title
    body: { size: 15, lh: 1.55, ls: 0, weight: 400 },      // body
    bodySm: { size: 13.5, lh: 1.5, ls: 0, weight: 400 },   // small body
    label: { size: 12, lh: 1.2, ls: 0.4, weight: 600 },    // pill labels (uppercase)
    caption: { size: 11.5, lh: 1.3, ls: 0.2, weight: 500 },
    cta: { size: 14, lh: 1, ls: 0, weight: 600 },          // boutons
  },

  // ─── Shadows ─────────────────────────────────────────────────────────
  shadow: {
    soft: '0 8px 32px rgba(10,10,10,0.06), 0 2px 8px rgba(10,10,10,0.04)',
    card: '0 12px 40px rgba(10,10,10,0.08), 0 4px 12px rgba(10,10,10,0.05)',
    pillBlack: '0 4px 14px rgba(10,10,10,0.20)',
    pillWhite: '0 4px 14px rgba(255,255,255,0.12)',
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
