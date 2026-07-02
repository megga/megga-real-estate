// Dashboard Analytics — "Le Cockpit Commission" (Sugar Pure, hi-fi)
// Tokens, formatters, time-series generator & period data model.
// Sugar Pure grammar: white surfaces, ink #0B0C0E accent, soft shadows,
// no decorative borders, Manrope, CHF with apostrophes, monochrome data ramp.

const AX = {
  card:       "#FFFFFF",
  cardSubtle: "#F6F7F9",
  cardWhisper:"#FAFAFB",
  ink:        "#0B0C0E",
  inkSoft:    "#3A3D44",
  muted:      "#80858E",
  ghost:      "#B5BAC2",
  hairline:   "rgba(11,12,14,0.07)",
  hairlineSt: "rgba(11,12,14,0.12)",
  shadowSm:   "0 4px 16px rgba(15,23,42,0.05)",
  shadow:     "0 14px 44px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
  shadowLg:   "0 28px 70px rgba(15,23,42,0.10), 0 6px 18px rgba(15,23,42,0.05)",
  // monochrome data ramp (composition)
  secured:    "#0B0C0E",
  probable:   "#7B828C",
  possible:   "#CDD1D7",
  // chart
  line:       "#0B0C0E",
  area:       "rgba(11,12,14,0.06)",
  goal:       "#C2C6CD",
  grid:       "rgba(11,12,14,0.05)",
  // premium status pills (solid)
  pillAhead:  { bg: "#15643F", fg: "#FFFFFF", sh: "0 1px 2px rgba(21,100,63,0.32), inset 0 -1px 0 rgba(0,0,0,0.10)" },
  pillBehind: { bg: "#A0521E", fg: "#FFFFFF", sh: "0 1px 2px rgba(160,82,30,0.32), inset 0 -1px 0 rgba(0,0,0,0.10)" },
  pillNeutral:{ bg: "#202127", fg: "#FFFFFF", sh: "0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)" },
  onAccent:   "#FFFFFF",
  skBase:     "#ECEDF0",
  skShine:    "#F8F9FB",
  appBlur:    "rgba(239,239,241,0.82)",
  scrim:      "rgba(11,12,14,0.34)",
  pageBg:     "radial-gradient(ellipse 120% 80% at 50% 100%, #D7D8DB 0%, #E6E7E9 50%, #EFEFF1 100%)",
};
window.AX = AX;

// dark theme (Sugar Pure — accent inverts to near-white on deep ink)
const AX_DARK = {
  ...AX,
  card: "#191B1F", cardSubtle: "#23262B", cardWhisper: "#1F2126",
  ink: "#F3F4F6", inkSoft: "#B4B9C2", muted: "#7C818B", ghost: "#454953",
  hairline: "rgba(255,255,255,0.08)", hairlineSt: "rgba(255,255,255,0.18)",
  shadowSm: "0 4px 16px rgba(0,0,0,0.40)",
  shadow:   "0 16px 44px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.35)",
  shadowLg: "0 30px 70px rgba(0,0,0,0.60), 0 6px 18px rgba(0,0,0,0.40)",
  secured: "#F3F4F6", probable: "#878D98", possible: "#41454D",
  line: "#F3F4F6", area: "rgba(255,255,255,0.08)", goal: "#565A62", grid: "rgba(255,255,255,0.07)",
  onAccent: "#0B0C0E",
  skBase: "#23262B", skShine: "#2F333A",
  appBlur: "rgba(13,14,17,0.78)",
  scrim: "rgba(0,0,0,0.58)",
  pageBg: "radial-gradient(ellipse 120% 80% at 50% 0%, #16181C 0%, #0C0D0F 55%, #090A0B 100%)",
};
window.AX_DARK = AX_DARK;

// theme context + hook
const AXCtx = React.createContext(AX);
window.AXCtx = AXCtx;
window.useAX = () => React.useContext(AXCtx);

// ── Formatters ──────────────────────────────────────────────────────────
const axCHF = (n) => "CHF " + Math.round(n).toLocaleString("fr-CH").replace(/\u202f|\s/g, "'");
const axShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace(/\.?0+$/, "") + "M";
  if (a >= 1e3) return Math.round(n / 1e3) + "k";
  return String(Math.round(n));
};
const axCHFShort = (n) => "CHF " + axShort(n);
window.axCHF = axCHF; window.axShort = axShort; window.axCHFShort = axCHFShort;

// ── Time-series generator ───────────────────────────────────────────────
// Builds realized (0→elapsed), dashed projection (elapsed→end), linear goal.
function axBuildSeries({ n, elapsed, realizedNow, projectedEnd, target }) {
  const real = [];
  for (let i = 0; i <= elapsed; i++) {
    const t = elapsed === 0 ? 1 : i / elapsed;
    const wob = Math.sin(i * 1.27) * realizedNow * 0.011;
    real.push(Math.max(0, Math.round(realizedNow * t + wob)));
  }
  real[0] = 0; real[elapsed] = realizedNow;
  const proj = [];
  for (let i = elapsed; i < n; i++) {
    const t = (n - 1 - elapsed) === 0 ? 1 : (i - elapsed) / (n - 1 - elapsed);
    proj.push(Math.round(realizedNow + (projectedEnd - realizedNow) * t));
  }
  const goal = [];
  for (let i = 0; i < n; i++) goal.push(Math.round(target * (i / (n - 1))));
  const yMax = Math.max(target, projectedEnd) * 1.06;
  return { real, proj, goal, yMax, n, elapsed };
}

// deterministic sparkline data (8 pts, gentle trend)
const axSpark = (seed, trend = 1) => {
  const a = [];
  for (let i = 0; i < 8; i++) a.push(50 + Math.sin(i * 0.9 + seed) * 14 + i * trend * 3.2);
  return a;
};

// ── Shared upcoming deals (the "what's closing" forecast) ───────────────
const AX_DEALS = [
  { prop: "Appartement", loc: "Champel",    gmv: 1850000, comm: 46250, prob: 90, stage: "Compromis", when: "≈ 22 juin", days: 8 },
  { prop: "Villa",       loc: "Cologny",    gmv: 3200000, comm: 80000, prob: 65, stage: "Offre",     when: "≈ 5 juil",  days: 21 },
  { prop: "Loft",        loc: "Pâquis",     gmv: 1150000, comm: 28750, prob: 55, stage: "Offre",     when: "≈ 12 juil", days: 28 },
  { prop: "Maison",      loc: "Carouge",    gmv: 1420000, comm: 35500, prob: 40, stage: "Visite",    when: "fin juil",  days: 40 },
];
window.AX_DEALS = AX_DEALS;

// ── Records behind each composition bucket (the drilldown target) ───────
const AX_RECORDS = {
  secured: {
    label: "Sécurisé", hint: "Actes signés + compromis fermes",
    items: [
      { prop: "Penthouse", loc: "Eaux-Vives",  gmv: 2880000, comm: 72000, prob: 100, state: "Signé" },
      { prop: "Villa",      loc: "Vandœuvres",  gmv: 3800000, comm: 95000, prob: 85,  state: "Compromis" },
      { prop: "Appartement",loc: "Champel",     gmv: 1850000, comm: 46250, prob: 90,  state: "Compromis" },
      { prop: "Duplex",     loc: "Plainpalais", gmv: 1660000, comm: 41500, prob: 100, state: "Signé" },
    ],
  },
  probable: {
    label: "Probable", hint: "Offres déposées en cours de négociation",
    items: [
      { prop: "Villa",  loc: "Cologny", gmv: 3200000, comm: 80000, prob: 65, state: "Offre" },
      { prop: "Maison", loc: "Genthod", gmv: 2080000, comm: 52000, prob: 60, state: "Offre" },
      { prop: "Loft",   loc: "Pâquis",  gmv: 1150000, comm: 28750, prob: 55, state: "Offre" },
    ],
  },
  possible: {
    label: "Possible", hint: "Mandats actifs & visites en cours",
    items: [
      { prop: "Maison",      loc: "Carouge",  gmv: 1420000, comm: 35500, prob: 40, state: "Visite" },
      { prop: "Terrain",     loc: "Bernex",   gmv: 1320000, comm: 33000, prob: 25, state: "Mandat" },
      { prop: "Appartement", loc: "Servette", gmv: 1040000, comm: 26000, prob: 30, state: "Mandat" },
    ],
  },
};
window.AX_RECORDS = AX_RECORDS;

// ── Period model ────────────────────────────────────────────────────────
const AX_DATA = {
  year: {
    key: "year", label: "Année 2026", scopeLabel: "Vue personnelle · Julien Berset",
    period: "cette année", granularity: "Cumul mensuel", pointWord: "Mois",
    target: 1200000, realizedNow: 470000, projectedEnd: 1075000, paceFrac: 5.5 / 12,
    series: axBuildSeries({ n: 12, elapsed: 5, realizedNow: 470000, projectedEnd: 1075000, target: 1200000 }),
    axisLabels: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"],
    composition: [
      { k: "secured",  label: "Sécurisé",  hint: "Actes + compromis", v: 620000 },
      { k: "probable", label: "Probable",  hint: "Offres en cours",    v: 305000 },
      { k: "possible", label: "Possible",  hint: "Mandats & visites",  v: 150000 },
    ],
    kpis: [
      { label: "Volume transacté", value: "CHF 23.4M", delta: +6,  spark: axSpark(1, 1.0) },
      { label: "Transactions",     value: "14",        delta: +2,  unit: "", spark: axSpark(2, 0.8), abs: true },
      { label: "Commission moy.",  value: "CHF 33'600",delta: +4,  spark: axSpark(3, 0.4) },
      { label: "Taux conversion",  value: "19 %",      delta: +1,  pts: true, spark: axSpark(4, 0.6) },
    ],
    sources: [
      { label: "Réseau & recommandations", sub: "Bouche-à-oreille, anciens clients", deals: 5, comm: 408000, pct: 38, delta: +5 },
      { label: "Portails",            sub: "Homegate · ImmoScout24",      deals: 4, comm: 290000, pct: 27, delta: -3 },
      { label: "Site MEGGA",          sub: "Formulaires & estimations",   deals: 3, comm: 193000, pct: 18, delta: +8 },
      { label: "Clients repeat",      sub: "Revente / 2e mandat",         deals: 1, comm: 118000, pct: 11, delta: +2 },
      { label: "Prospection directe", sub: "Démarchage, pige",            deals: 1, comm: 64000,  pct: 6,  delta: -1 },
    ],
  },
  quarter: {
    key: "quarter", label: "T2 2026", scopeLabel: "Vue personnelle · Julien Berset",
    period: "ce trimestre", granularity: "Cumul hebdomadaire", pointWord: "Semaine",
    target: 525000, realizedNow: 410000, projectedEnd: 500000, paceFrac: 10.5 / 13,
    series: axBuildSeries({ n: 13, elapsed: 10, realizedNow: 410000, projectedEnd: 500000, target: 525000 }),
    axisLabels: ["", "Avr", "", "", "Mai", "", "", "", "Juin", "", "", "", ""],
    composition: [
      { k: "secured",  label: "Sécurisé",  hint: "Actes + compromis", v: 330000 },
      { k: "probable", label: "Probable",  hint: "Offres en cours",    v: 110000 },
      { k: "possible", label: "Possible",  hint: "Mandats & visites",  v: 60000 },
    ],
    kpis: [
      { label: "Volume transacté", value: "CHF 8.1M",  delta: +9,  spark: axSpark(5, 1.1) },
      { label: "Transactions",     value: "6",         delta: +1,  spark: axSpark(6, 0.7), abs: true },
      { label: "Commission moy.",  value: "CHF 34'200",delta: +3,  spark: axSpark(7, 0.5) },
      { label: "Taux conversion",  value: "20 %",      delta: +2,  pts: true, spark: axSpark(8, 0.9) },
    ],
    sources: [
      { label: "Réseau & recommandations", sub: "Bouche-à-oreille, anciens clients", deals: 3, comm: 185000, pct: 37, delta: +4 },
      { label: "Portails",            sub: "Homegate · ImmoScout24",      deals: 2, comm: 140000, pct: 28, delta: -2 },
      { label: "Site MEGGA",          sub: "Formulaires & estimations",   deals: 1, comm: 90000,  pct: 18, delta: +6 },
      { label: "Clients repeat",      sub: "Revente / 2e mandat",         deals: 1, comm: 55000,  pct: 11, delta: +1 },
      { label: "Prospection directe", sub: "Démarchage, pige",            deals: 0, comm: 30000,  pct: 6,  delta: 0 },
    ],
  },
  month: {
    key: "month", label: "Juin 2026", scopeLabel: "Vue personnelle · Julien Berset",
    period: "ce mois", granularity: "Cumul journalier", pointWord: "Jour",
    target: 175000, realizedNow: 72000, projectedEnd: 154000, paceFrac: 13.5 / 30,
    series: axBuildSeries({ n: 30, elapsed: 13, realizedNow: 72000, projectedEnd: 154000, target: 175000 }),
    axisLabels: (() => { const a = Array(30).fill(""); a[0] = "1"; a[7] = "8"; a[14] = "15"; a[21] = "22"; a[29] = "30"; return a; })(),
    composition: [
      { k: "secured",  label: "Sécurisé",  hint: "Actes + compromis", v: 96000 },
      { k: "probable", label: "Probable",  hint: "Offres en cours",    v: 38000 },
      { k: "possible", label: "Possible",  hint: "Mandats & visites",  v: 20000 },
    ],
    kpis: [
      { label: "Volume transacté", value: "CHF 2.6M",  delta: -4,  spark: axSpark(9, -0.4) },
      { label: "Transactions",     value: "2",         delta: 0,   spark: axSpark(10, 0.2), abs: true },
      { label: "Commission moy.",  value: "CHF 36'000",delta: +5,  spark: axSpark(11, 0.6) },
      { label: "Taux conversion",  value: "18 %",      delta: -1,  pts: true, spark: axSpark(12, -0.3) },
    ],
    sources: [
      { label: "Réseau & recommandations", sub: "Bouche-à-oreille, anciens clients", deals: 1, comm: 58000, pct: 38, delta: +3 },
      { label: "Portails",            sub: "Homegate · ImmoScout24",      deals: 1, comm: 42000, pct: 27, delta: -4 },
      { label: "Site MEGGA",          sub: "Formulaires & estimations",   deals: 0, comm: 28000, pct: 18, delta: +5 },
      { label: "Clients repeat",      sub: "Revente / 2e mandat",         deals: 0, comm: 16000, pct: 10, delta: +1 },
      { label: "Prospection directe", sub: "Démarchage, pige",            deals: 0, comm: 10000, pct: 7,  delta: -2 },
    ],
  },
};
window.AX_DATA = AX_DATA;

// pace helper → verdict object
window.axPace = (d) => {
  const paceNow = Math.round(d.target * d.paceFrac);
  const diff = d.realizedNow - paceNow;          // + ahead, − behind
  const ahead = diff >= 0;
  const projPct = Math.round((d.projectedEnd / d.target) * 100);
  return { paceNow, diff, ahead, projPct };
};

// ── Objective: single source of truth = annual target ────────────────────
// Month = annual / 12, Quarter = annual / 4 (linear pacing).
const AX_DEFAULT_ANNUAL_TARGET = 1200000;
window.AX_DEFAULT_ANNUAL_TARGET = AX_DEFAULT_ANNUAL_TARGET;

window.axTargetFor = (period, annual) =>
  period === "year" ? annual : period === "quarter" ? Math.round(annual / 4) : Math.round(annual / 12);

// inverse: editing the displayed period target rescales the annual target
window.axAnnualFromPeriod = (period, periodValue) =>
  period === "year" ? periodValue : period === "quarter" ? periodValue * 4 : periodValue * 12;

// returns a copy of the period data with `target` overridden and the chart
// goal line + yMax recomputed to match.
window.axApplyTarget = (base, target) => {
  const n = base.series.n;
  const goal = [];
  for (let i = 0; i < n; i++) goal.push(Math.round(target * (i / (n - 1))));
  const yMax = Math.max(target, base.projectedEnd) * 1.06;
  return { ...base, target, series: { ...base.series, goal, yMax } };
};
