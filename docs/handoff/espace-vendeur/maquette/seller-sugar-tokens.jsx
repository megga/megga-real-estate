// MEGGA — Page vendeur « Votre vente » — Tokens Sugar Pure
// Direction artistique strictement alignée sur le wizard (crm-wizard-sugar-v2).
// Deux palettes : claire (par défaut) et sombre. window.SELLER_SP pointe sur la
// palette active — la page le réassigne à chaque rendu selon le dark mode.

const SELLER_SP_LIGHT = {
  // Fond — Sugar Pure : gradient radial gris-bleu
  bg: "#EDEFF3",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)",

  // Surfaces
  card: "#FFFFFF",
  cardSubtle: "#F7F8FA",

  // Accent unique (noir pur)
  accent: "#0B0C0E",
  accentHover: "#1F2024",
  onAccent: "#FFFFFF",
  black: "#0B0C0E",        // alias rétro-compat
  blackHover: "#1F2024",

  // Texte
  ink: "#0B0C0E",
  inkSoft: "#3A3D44",
  muted: "#7A8088",
  ghost: "#B5BAC2",

  // Lignes / insets (jamais de bordure décorative — uniquement controls)
  line: "rgba(11,12,14,0.10)",
  lineStrong: "rgba(11,12,14,0.16)",
  hairline: "rgba(11,12,14,0.07)",
  disabledBg: "#C9CDD3",
  closeHover: "#ECEEF1",

  // Ombres signature
  shadowSm: "0 4px 16px rgba(15, 23, 42, 0.04)",
  shadow:   "0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)",
  shadowLg: "0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)",
  shadowHover: "0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)",

  // États
  ok: "#10B981", warn: "#F59E0B", err: "#EF4444",
  // Statut fort (pilule pleine premium)
  forestGreen: "#15643F", burntOrange: "#A0521E", bordeaux: "#8E1F3D",
};

const SELLER_SP_DARK = {
  // Aligné sur le dark mode du CRM (crm-tokens.jsx) : quasi-noir, voile bleuté discret.
  bg: "#0A0A0F",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #15151F 0%, #0E0E16 55%, #0A0A0F 100%)",

  card: "#101019",
  cardSubtle: "#171724",

  // Accent inversé : presque-blanc, texte foncé dessus
  accent: "#ECEDF3",
  accentHover: "#FFFFFF",
  onAccent: "#0A0A0F",
  black: "#ECEDF3",
  blackHover: "#FFFFFF",

  ink: "#ECEDF3",
  inkSoft: "#B5B7C4",
  muted: "#797D90",
  ghost: "#454960",

  line: "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.20)",
  hairline: "rgba(255,255,255,0.07)",
  disabledBg: "#2E2E42",
  closeHover: "#1F1F2E",

  shadowSm: "0 4px 16px rgba(0,0,0,0.35)",
  shadow:   "0 12px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.30)",
  shadowLg: "0 24px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)",
  shadowHover: "0 32px 70px rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.4)",

  ok: "#34D399", warn: "#FBBF24", err: "#F87171",
  forestGreen: "#1C7A4E", burntOrange: "#B86329", bordeaux: "#A8395A",
};

// Formatage CHF suisse → CHF 1'250'000
const sellerFmtCHF = (n) =>
  "CHF " + Math.round(n).toLocaleString("fr-CH").replace(/[\u00A0\u202F,.\s]/g, "'");
const sellerFmtNum = (n) => Math.round(n).toLocaleString("fr-CH").replace(/[\u00A0\u202F,.\s]/g, "'");

window.SELLER_SP_LIGHT = SELLER_SP_LIGHT;
window.SELLER_SP_DARK = SELLER_SP_DARK;
window.SELLER_SP = SELLER_SP_LIGHT;   // défaut ; réassigné par la page
window.sellerFmtCHF = sellerFmtCHF;
window.sellerFmtNum = sellerFmtNum;

window.SELLER_CSS = `
  @keyframes sgFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sgScaleIn { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
  @keyframes sgDashFlow { to { background-position-x: -14px; } }
  @keyframes sgSpin { to { transform: rotate(360deg); } }
  .sg-enter { animation: sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both; }
  .sg-tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
  image-slot { display:block; }
  /* Le badge « +N » n'apparaît qu'une fois une photo déposée */
  image-slot:not([data-filled]) + .photo-more { display: none !important; }
  /* Avatar : laisser passer les initiales tant qu'aucune photo n'est déposée */
  .av-slot::part(frame) { background: transparent; }

  /* ─── Responsive : tablette ─────────────────────────────────────── */
  @media (max-width: 960px) {
    .sv-twocol { grid-template-columns: minmax(0, 1fr) !important; gap: 22px !important; }
    .sv-aside { position: static !important; top: auto !important; }
    .sv-page { padding: 32px 28px 44px !important; }
  }

  /* ─── Responsive : mobile ───────────────────────────────────────── */
  @media (max-width: 680px) {
    .sv-page { padding: 22px 16px 40px !important; }
    .sv-propcard { grid-template-columns: minmax(0, 1fr) !important; gap: 16px !important; }
    .sv-propinfo { padding: 4px 6px 10px !important; }
    .sv-journey { padding: 24px 20px 26px !important; }
    .sv-journeyrow { gap: 24px !important; }
    .sv-arc { width: 100% !important; max-width: 340px !important; margin: 0 auto !important; }
    .sv-arc svg { width: 100% !important; height: auto !important; }
    .sv-stats { flex-wrap: wrap !important; gap: 20px !important; padding: 26px 20px 22px !important; }
  }
`;
