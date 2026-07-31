// MEGGA CRM — Design tokens + theme provider
// Cohérent avec le site public MEGGA, étendu pour outil pro.

const CRM_TOKENS = {
  light: {
    bg:           "#FAFBFD",
    surface:      "#FFFFFF",
    surface2:     "#F5F7FA",
    border:       "#E2E6EC",
    borderStrong: "#CDD3DB",
    ink:          "#0E1410",
    soft:         "#3F4640",
    muted:        "#7A8079",
    primary:      "#0041D9",
    primarySoft:  "#E8EFFE",
    primaryHover: "#0033AC",
    danger:       "#E53935",
    dangerSoft:   "#FDECEA",
    warn:         "#F59E0B",
    warnSoft:     "#FEF3DB",
    ok:           "#0E9F6E",
    okSoft:       "#E1F5EC",
    section:      "#F6F8F4",
    overlay:      "rgba(14,20,16,.42)",
    shadow1:      "0 1px 2px rgba(14,20,16,.04), 0 0 0 1px rgba(14,20,16,.04)",
    shadow2:      "0 8px 24px -8px rgba(14,20,16,.12), 0 0 0 1px rgba(14,20,16,.05)",
  },
  // Dark mode — cohérence avec MEGGA AI : quasi-noir NEUTRE (aligné sur le cockpit Today #0A0B0D).
  dark: {
    bg:           "#0A0B0D",
    surface:      "#101019",
    surface2:     "#171724",
    border:       "#1F1F2E",
    borderStrong: "#2E2E42",
    ink:          "#ECEDF3",
    soft:         "#B5B7C4",
    muted:        "#797D90",
    primary:      "#6F8CFF",
    primarySoft:  "#1A1E3A",
    primaryHover: "#8DA4FF",
    danger:       "#F26B65",
    dangerSoft:   "#341B1F",
    warn:         "#F2B855",
    warnSoft:     "#332811",
    ok:           "#34C796",
    okSoft:       "#0F2620",
    section:      "#0D0D14",
    overlay:      "rgba(0,0,4,.68)",
    shadow1:      "0 1px 2px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)",
    shadow2:      "0 14px 36px -10px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.045)",
  },
};

// Teinte sombre « Noir pur » — même grammaire que dark mais fond #000 absolu.
CRM_TOKENS.noir = {
  ...CRM_TOKENS.dark,
  bg:       "#000000",
  surface:  "#0C0C10",
  surface2: "#131319",
  border:   "#1A1A22",
  section:  "#060608",
};

// Teinte sombre « Graphite » — DÉFAUT PRODUIT (acté juil. 2026).
// Échelle opaque tenue entre #12161C (canvas) et #21242F (surfaces flottantes).
// 5 paliers d'écart de luminance constant (~1,04) : l'élévation se lit sans bordure.
// muted remonté à #868A9C : #797D90 tombait à 4,45:1 sur #12161C (sous AA).
CRM_TOKENS.graphite = {
  ...CRM_TOKENS.dark,
  bg:           "#12161C",   // S0 canvas
  section:      "#161A21",   // S1 cadre
  surface:      "#1A1D26",   // S2 card
  surface2:     "#1D212A",   // S3 sous-card / input
  border:       "#252A36",   // filet (hors plage par nature : c'est un trait, pas une surface)
  borderStrong: "#333949",
  muted:        "#868A9C",
  overlay:      "rgba(6,8,11,.66)",
};

// Teintes sombres proposées à l'agent (Réglages › Préférences › Apparence).
// Graphite par défaut ; Noir pur conservé. Marine et MEGGA AI retirés de l'offre
// mais toujours résolvables par CRM_TOKENS[tone] pour les anciens réglages stockés.
// Échelle graphite — source unique, lue aussi par crmStep() hors palette.
const CRM_GRAPHITE = { s0: "#12161C", s1: "#161A21", s2: "#1A1D26", s3: "#1D212A", s4: "#21242F" };
window.CRM_GRAPHITE = CRM_GRAPHITE;

const CRM_DARK_TONES = [
  { id: "graphite", label: "Graphite", sub: "Gris profond, lecture longue", swatch: "#12161C" },
  { id: "noir",     label: "Noir pur", sub: "Contraste maximal, OLED",      swatch: "#000000" },
];
function crmDarkTone() {
  if (typeof window !== "undefined" && window.__meggaDarkTone) return window.__meggaDarkTone;
  try { return localStorage.getItem("megga.darkTone") || "graphite"; } catch (e) { return "graphite"; }
}
window.CRM_DARK_TONES = CRM_DARK_TONES;
window.crmDarkTone = crmDarkTone;

// ─── Pilules "premium solides" ──────────────────────────────────────
// Pattern unifié pour TOUS les badges/statuts du CRM (KYC, statut bien,
// delta dashboard, sources hot, jalons, bottleneck, etc.).
// Fond plein (pas de rgba), texte blanc, légère ombre + inset pour donner
// de la profondeur sans tomber dans le glassmorphism. Pas de neon.
//
// Usage :
//   const p = CRM_PILL.ok;
//   <span style={{ background: p.bg, color: p.fg, boxShadow: p.shadow, ... }}>
//
// Tons :
//   ok       — succès, hausse, KYC vérifié, mandat actif, hot lead
//   warn     — alerte douce, KYC en cours, en pause, baisse de prix
//   danger   — perte, KYC manquant, bottleneck, alerte
//   info     — info neutre métier (Vendu, lien externe)
//   neutral  — brouillon / en pause / état désactivé
const CRM_PILL = {
  ok:      { bg: "#15643F", fg: "#FFFFFF", shadow: "0 1px 2px rgba(21,100,63,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)", dot: "#7CD8A6" },
  warn:    { bg: "#A0521E", fg: "#FFFFFF", shadow: "0 1px 2px rgba(160,82,30,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)",  dot: "#F5C58A" },
  danger:  { bg: "#8E1F3D", fg: "#FFFFFF", shadow: "0 1px 2px rgba(142,31,61,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)",  dot: "#F0A1B5" },
  info:    { bg: "#1B4A8E", fg: "#FFFFFF", shadow: "0 1px 2px rgba(27,74,142,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)",  dot: "#A3C1EE" },
  neutral: { bg: "#202127", fg: "#FFFFFF", shadow: "0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)",   dot: "#9CA0AC" },
};

// Stage colors (deal pipeline) — same across themes for recognition
const CRM_STAGES = {
  "new-lead":           { label: "Nouveau lead",      color: "#9AA0A6" },
  "to-qualify":         { label: "À qualifier",       color: "#7A8088" },
  "searching":          { label: "Recherche active",  color: "#5A616B" },
  "visit-scheduled":    { label: "Visite planifiée",  color: "#4B5563" },
  "visit-done":         { label: "Visite effectuée",  color: "#0891B2" },
  "interest-confirmed": { label: "Intérêt confirmé",  color: "#475569" },
  "offer":              { label: "Offre déposée",     color: "#C45A00" },
  "signed":             { label: "Signé",             color: "#059669" },
  "lost":               { label: "Perdu",             color: "#8E1F3D" },
};
const CRM_STAGE_ORDER = [
  "new-lead", "to-qualify", "searching", "visit-scheduled",
  "visit-done", "interest-confirmed", "offer", "signed"
];

const CRM_DENSITY = {
  comfortable: { rowH: 56, gap: 14, padX: 18, padY: 14, fontBody: 14, fontDense: 13 },
  compact:     { rowH: 40, gap:  8, padX: 12, padY:  8, fontBody: 13, fontDense: 12 },
};

function crmFmtCHF(n) {
  if (n == null) return "—";
  return "CHF " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
function crmFmtNum(n) {
  if (n == null) return "—";
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
function crmRelative(date) {
  const d = (typeof date === "string") ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 7) return `il y a ${j} j`;
  if (j < 30) return `il y a ${Math.round(j/7)} sem`;
  return `il y a ${Math.round(j/30)} mois`;
}
function crmInitials(name) {
  return name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
}

// ─── Accent UI global (choisi dans Préférences › Apparence) ───────────
// Défaut "black" = comportement Sugar Pure historique (noir #0B0C0E en clair,
// quasi-blanc #ECEDF3 en sombre). Comme crmAcc("black") ≈ sp.ink dans les deux
// modes, brancher les surfaces d'accent sur crmAccent NE CHANGE RIEN visuellement
// tant que l'accent reste Noir → propagation sans risque de régression.
const CRM_ACCENTS = {
  black:      { light: "#0B0C0E", dark: "#ECEDF3", onLight: "#FFFFFF", onDark: "#0B0C0E" },
  periwinkle: { light: "#6F8CFF", dark: "#8CA3FF", onLight: "#FFFFFF", onDark: "#0B0C0E" },
  blue:       { light: "#0041D9", dark: "#4C7BFF", onLight: "#FFFFFF", onDark: "#FFFFFF" },
  cyan:       { light: "#0891B2", dark: "#2CB7D6", onLight: "#FFFFFF", onDark: "#0B0C0E" },
  green:      { light: "#059669", dark: "#2FBE8B", onLight: "#FFFFFF", onDark: "#0B0C0E" },
  orange:     { light: "#C45A00", dark: "#EE8B36", onLight: "#FFFFFF", onDark: "#0B0C0E" },
};
function crmAccentId() {
  if (typeof window !== "undefined" && window.__meggaAccentId) return window.__meggaAccentId;
  try { return localStorage.getItem("megga.accent") || "black"; } catch (e) { return "black"; }
}
function crmAccent(dark) {
  const a = CRM_ACCENTS[crmAccentId()] || CRM_ACCENTS.black;
  return dark ? a.dark : a.light;
}
function crmAccentInk(dark) {
  const a = CRM_ACCENTS[crmAccentId()] || CRM_ACCENTS.black;
  return dark ? a.onDark : a.onLight;
}
window.CRM_ACCENTS = CRM_ACCENTS;
window.crmAccentId = crmAccentId;
window.crmAccent = crmAccent;
window.crmAccentInk = crmAccentInk;

// Sugar palette derived from the active theme — used by *-sugar screens.
// Light theme keeps the original cool grey-blue page bg + white floating cards.
// Dark themes (marine / meggaAi) flip to deep surfaces, translucent frames,
// and a bright ink/sub for legibility on glass.
function crmSugarPalette(t, dark, tone) {
  if (!dark) {
    return {
      pageBg:        "#EEF1F5",
      frameBg:       "rgba(255,255,255,0.35)",
      frameBorder:   "rgba(255,255,255,0.55)",
      cardBg:        "rgba(255,255,255,0.55)",
      cardBorder:    "rgba(255,255,255,0.7)",
      cardSubBg:     "rgba(245,247,250,0.6)",
      ink:           "#0E1410",
      sub:           "#7A8079",
      soft:          "#3F4640",
      focusBg:       crmAccent(false),
      focusInk:      crmAccentInk(false),
      accent:        crmAccent(false),
      accentInk:     crmAccentInk(false),
      focusSurface:  "rgba(255,255,255,.10)",
      focusShadow:   "0 6px 24px -6px rgba(14,20,16,.45)",
      shadow:        "0 1px 2px rgba(14,20,16,.04), 0 8px 24px -10px rgba(60,80,120,.18)",
      shadowSm:      "0 1px 2px rgba(14,20,16,.04), 0 6px 18px -10px rgba(60,80,120,.18)",
      tableHeadBg:   "#FAFBFD",
      avatarBorder:  "#FFFFFF",
      iconBtnBg:     "rgba(255,255,255,0.55)",
      iconRailBg:    "rgba(255,255,255,0.7)",
      dotBorder:     "#EEF1F5",
      kbdBg:         "#F5F7FA",
      // Surfaces opaques (popovers solides : profil, menus denses) — jamais de verre.
      // Surface nettement détachée du fond (#EEF1F5) : blanc + bordure marquée + ombre portée.
      solidBg:       "#FFFFFF",
      solidBgSub:    "#F1F4F8",
      solidBgSub2:   "#E6EAF0",
      solidBorder:   "rgba(15,23,42,0.10)",
      solidShadow:   "0 1px 2px rgba(14,20,16,.05), 0 18px 48px -12px rgba(40,55,90,.30)",
    };
  }
  // ── Teinte Graphite : échelle OPAQUE, jamais de blanc translucide en remplissage.
  // Les rgba blancs ne servent plus que de filets (α ≤ .06). Les sous-surfaces d'une
  // modale se CREUSENT (solidBgSub < solidBg) au lieu de monter : la plage reste étanche.
  if (tone === "graphite") {
    const G = CRM_GRAPHITE;
    return {
      ramp:          G,
      pageBg:        G.s0,
      frameBg:       G.s1,
      frameBorder:   "rgba(255,255,255,0.05)",
      cardBg:        G.s2,
      cardBorder:    "rgba(255,255,255,0.06)",
      cardSubBg:     G.s3,
      ink:           t.ink,
      sub:           t.muted,
      soft:          t.soft,
      focusBg:       crmAccent(true),
      focusInk:      crmAccentInk(true),
      accent:        crmAccent(true),
      accentInk:     crmAccentInk(true),
      focusSurface:  "rgba(255,255,255,.10)",
      focusShadow:   "0 8px 28px -8px rgba(0,0,0,.7)",
      shadow:        "0 1px 2px rgba(0,0,0,.45), 0 10px 28px -12px rgba(0,0,0,.65)",
      shadowSm:      "0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.6)",
      tableHeadBg:   G.s1,
      avatarBorder:  G.s2,
      iconBtnBg:     G.s3,
      iconRailBg:    G.s1,
      dotBorder:     G.s2,
      kbdBg:         G.s3,
      solidBg:       G.s4,
      solidBgSub:    G.s3,
      solidBgSub2:   G.s2,
      solidBorder:   "rgba(255,255,255,0.08)",
      solidShadow:   "0 28px 64px -14px rgba(0,0,0,.72), 0 8px 22px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)",
    };
  }
  // Dark — both marine and meggaAi share the same approach but with their own bg/surfaces.
  return {
    pageBg:        t.bg,
    frameBg:       tone === "marine" ? "rgba(23,34,56,0.30)" : tone === "noir" ? "rgba(18,18,22,0.45)" : "rgba(23,23,36,0.30)",
    frameBorder:   "rgba(255,255,255,0.08)",
    cardBg:        "rgba(255,255,255,0.05)",
    cardBorder:    "rgba(255,255,255,0.08)",
    cardSubBg:     "rgba(255,255,255,0.04)",
    ink:           t.ink,
    sub:           t.muted,
    soft:          t.soft,
    focusBg:       crmAccent(true),
    focusInk:      crmAccentInk(true),
    accent:        crmAccent(true),
    accentInk:     crmAccentInk(true),
    focusSurface:  "rgba(255,255,255,.12)",
    focusShadow:   "0 8px 28px -8px rgba(0,0,0,.65)",
    shadow:        "0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.6)",
    shadowSm:      "0 1px 2px rgba(0,0,0,.35), 0 6px 18px -10px rgba(0,0,0,.55)",
    tableHeadBg:   t.section,
    avatarBorder:  t.surface,
    iconBtnBg:     "rgba(255,255,255,0.06)",
    iconRailBg:    "rgba(255,255,255,0.04)",
    dotBorder:     t.surface,
    kbdBg:         t.surface2,
    // Surfaces opaques (popovers solides : profil, menus denses) — jamais de verre.
    // Surface nettement ÉLEVÉE au-dessus du fond quasi-noir (#0A0A0F) : sur fond
    // sombre l'ombre noire est invisible, donc le relief vient de la clarté de la
    // surface + d'une bordure lumineuse + d'un liseré haut.
    solidBg:       "#22242F",
    solidBgSub:    "#2C2F3B",
    solidBgSub2:   "#373B49",
    solidBorder:   "rgba(255,255,255,0.14)",
    solidShadow:   "0 24px 60px -12px rgba(0,0,0,.65), 0 8px 22px -10px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)",
  };
}
window.crmSugarPalette = crmSugarPalette;

// Palier de l'échelle sombre active (teinte Graphite) — sinon la valeur historique.
// Deux signatures, au choix selon ce qu'on a sous la main :
//   crmStep("s3", "rgba(255,255,255,.08)")       ← lit la teinte active globale
//   crmStep(sp, "s3", "rgba(255,255,255,.08)")   ← lit la palette passée
// À n'utiliser QUE dans une branche déjà gardée par `dark ? … : …`.
function crmStep(a, b, c) {
  if (typeof a === "string") return crmDarkTone() === "graphite" ? CRM_GRAPHITE[a] : b;
  return (a && a.ramp && a.ramp[b]) || c;
}
window.crmStep = crmStep;

window.CRM_TOKENS = CRM_TOKENS;
window.CRM_PILL = CRM_PILL;
window.CRM_STAGES = CRM_STAGES;
window.CRM_STAGE_ORDER = CRM_STAGE_ORDER;
window.CRM_DENSITY = CRM_DENSITY;
window.crmFmtCHF = crmFmtCHF;
window.crmFmtNum = crmFmtNum;
window.crmRelative = crmRelative;
window.crmInitials = crmInitials;
