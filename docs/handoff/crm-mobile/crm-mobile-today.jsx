// MEGGA CRM — Responsive · Écran « Aujourd'hui » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). Le héros = la file de priorités
// « une situation à la fois » (portée du cockpit desktop). Le bento 2×2 desktop
// s'empile en vertical. Contenu 100 % fidèle (today-redesign-kit.jsx).
// Tokens via contexte → deux instances (clair/sombre) cohabitent sur la page.

// ─── Jeux de tokens ─────────────────────────────────────────────────────
const MT_LIGHT = {
  mode: "light",
  canvas: "radial-gradient(ellipse 120% 65% at 50% 0%, #CFDAE4 0%, #DFE3EA 46%, #EEF0F3 100%)",
  card: "#FFFFFF",
  cardSubtle: "#F6F7F9",
  ink: "#0B0C0E",
  inkSoft: "#3A3D44",
  muted: "#7A8088",
  ghost: "#AEB3BC",
  hair: "#ECEEF1",
  accent: "#0B0C0E", // surface CTA noir
  accentInk: "#FFFFFF",
  headerBg: "rgba(255,255,255,0.92)",
  tabBg: "rgba(255,255,255,0.92)",
  shadowSm: "0 4px 16px rgba(15,23,42,0.05)",
  shadow: "0 12px 34px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
  shadowLg: "0 22px 50px rgba(15,23,42,0.12), 0 6px 18px rgba(15,23,42,0.06)",
  // bloc Relances (accent immersif)
  relanceBg: "#0B0C0E", relanceBorder: "transparent", relanceInk: "#FFFFFF", relanceMuted: "#9CA0AC",
  ctaBg: "#FFFFFF", ctaInk: "#0B0C0E",
  riskBg: "#FAEAD7", riskFg: "#B4570A",
  goal: "#059669",
  cardBorder: "transparent"
};
const MT_DARK = {
  mode: "dark",
  canvas: "#030303",
  card: "#17181A",
  cardSubtle: "#1F2023",
  ink: "#ECEDF3",
  inkSoft: "#B5B7C4",
  muted: "#878B99",
  ghost: "#54576A",
  hair: "rgba(255,255,255,0.08)",
  accent: "#F2F2F6", // surface CTA claire (accent inversé)
  accentInk: "#0B0C0E",
  headerBg: "rgba(15,15,16,0.82)",
  tabBg: "rgba(17,17,18,0.86)",
  shadowSm: "0 2px 10px rgba(0,0,0,0.4)",
  shadow: "0 12px 34px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
  shadowLg: "0 24px 56px rgba(0,0,0,0.62), 0 6px 18px rgba(0,0,0,0.5)",
  relanceBg: "#1F2023", relanceBorder: "rgba(255,255,255,0.08)", relanceInk: "#ECEDF3", relanceMuted: "#878B99",
  ctaBg: "#F2F2F6", ctaInk: "#0B0C0E",
  riskBg: "rgba(180,87,10,0.20)", riskFg: "#F0B27A",
  goal: "#34C796",
  cardBorder: "rgba(255,255,255,0.07)"
};
// pastilles fonctionnelles MEGGA (par mode)
const MT_STAGE = {
  light: {
    Mandat: { bg: "#E6EDFB", fg: "#1E5BC6" }, KYC: { bg: "#E0F1F5", fg: "#0E7490" },
    Offre: { bg: "#FAEAD7", fg: "#B4570A" }, Compromis: { bg: "#DCF1E6", fg: "#066B45" }
  },
  dark: {
    Mandat: { bg: "rgba(30,91,198,0.22)", fg: "#9FBEF2" }, KYC: { bg: "rgba(14,116,144,0.24)", fg: "#7FCFE0" },
    Offre: { bg: "rgba(180,87,10,0.22)", fg: "#F0B27A" }, Compromis: { bg: "rgba(6,107,69,0.26)", fg: "#7BD4A6" }
  }
};

const MTCtx = React.createContext(MT_LIGHT);
const useMT = () => React.useContext(MTCtx);

const MT_PHOTO = {
  carouge: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1000&q=80",
  champel: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&q=80",
  cologny: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&q=80",
  eauxvives: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000&q=80"
};

// ─── Icônes — trait linéaire, zéro emoji ────────────────────────────────
const MT_ICONS = {
  home: "M3 11l9-7 9 7 M5 9.8V20h14V9.8",
  trend: "M3 17l6-6 4 4 7-7 M16 8h5v5",
  spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z",
  cal: "M4 6.5h16V20H4z M4 10.5h16 M8.5 3.5v4 M15.5 3.5v4",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  phone: "M5 4h3l2 4.5-2.3 1.4a11 11 0 005 5L14.5 12.5 19 14.5V18a2 2 0 01-2 2A15.5 15.5 0 014 5a2 2 0 011-1z",
  shield: "M12 3.5l7 2.8v4.7c0 4.3-3 7.2-7 8.5-4-1.3-7-4.2-7-8.5V6.3z",
  file: "M6.5 3.5h7l4 4V20.5h-11z M13.5 3.5v4h4",
  bank: "M3 6.5h18v11H3z M6 9.5v5 M18 9.5v5",
  check: "M5 12.5l4.2 4L19 6.5",
  arrow: "M5 12h13 M12.5 6l6 6-6 6",
  clock: "M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z M12 7.5v5l3.2 2",
  search: "M11 4.5a6.5 6.5 0 104.6 11.1A6.5 6.5 0 0011 4.5z M16 16l4 4",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  plus: "M12 5v14 M5 12h14",
  download: "M12 4v11 M7.5 10.5l4.5 4.5 4.5-4.5 M5 20h14",
  trash: "M4 7h16 M9 7V4.5h6V7 M6.5 7l1 13h9l1-13"
};
const MIcon = ({ name, size = 20, sw = 1.9, color = "currentColor" }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <path d={MT_ICONS[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;


const MAv = ({ children, bg, ink, size = 34 }) =>
<div style={{
  width: size, height: size, borderRadius: 999, background: bg, color: ink || "#fff",
  display: "grid", placeItems: "center", flexShrink: 0,
  fontSize: size * 0.38, fontWeight: 700, letterSpacing: -0.2, fontVariantNumeric: "tabular-nums"
}}>{children}</div>;


// ═══════════════════════════════════════════════════════════════════════
//  FILE DE PRIORITÉS — héros mobile (carte photo, couleurs fixes sur voile)
// ═══════════════════════════════════════════════════════════════════════
const MT_FOCUS = [
{ id: "marie", badge: "RELANCE", icon: "phone", name: "Marie Bertrand", time: "10:00", eta: "dans 7 min",
  sub: "Suite visite Carouge — opportunité tiède à confirmer", price: "CHF 890'000", photo: MT_PHOTO.carouge, primary: "Appeler Marie", live: true },
{ id: "elodie", badge: "KYC", icon: "shield", name: "Élodie Schmidt", time: "11:00", eta: "à compléter aujourd'hui",
  sub: "Vérification d'identité requise avant de déposer l'offre", price: "CHF 1'250'000", photo: MT_PHOTO.champel, primary: "Vérifier le KYC" },
{ id: "julien", badge: "MANDAT", icon: "file", name: "Julien Aebischer", time: "11:30", eta: "signature à préparer",
  sub: "Mandat exclusif prêt — relire les clauses avant signature", price: "CHF 2'400'000", photo: MT_PHOTO.cologny, primary: "Préparer le mandat" },
{ id: "antoine", badge: "OFFRE", icon: "bank", name: "Antoine Picard", time: "14:00", eta: "délai dépassé · 2 j", urgent: true,
  sub: "Suivi offre Villa Cologny — relancer avant expiration", price: "CHF 1'850'000", photo: MT_PHOTO.eauxvives, primary: "Relancer l'offre" }];


const MFocusHero = () => {
  const T = useMT();
  const [idx, setIdx] = React.useState(0);
  const [vis, setVis] = React.useState(true);
  const [calling, setCalling] = React.useState(false);
  const [secs, setSecs] = React.useState(0);

  const total = MT_FOCUS.length;
  const done = idx >= total;
  const f = done ? null : MT_FOCUS[idx];

  React.useEffect(() => {
    if (!calling) {setSecs(0);return;}
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [calling]);
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  const advance = () => {setCalling(false);setVis(false);setTimeout(() => {setIdx((i) => i + 1);requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));}, 280);};
  const onPrimary = () => {if (f.live) {if (calling) advance();else setCalling(true);} else advance();};
  const reset = () => {setVis(false);setTimeout(() => {setIdx(0);requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));}, 200);};

  const rise = (i) => ({ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(12px)", transition: `opacity .45s ease ${i * 55}ms, transform .5s cubic-bezier(.22,1,.36,1) ${i * 55}ms` });

  if (done) {
    return (
      <div style={{
        position: "relative", borderRadius: 24, overflow: "hidden", marginTop: 18,
        background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowLg,
        padding: "40px 26px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center"
      }}>
        <div style={{ width: 58, height: 58, borderRadius: 999, background: T.accent, display: "grid", placeItems: "center" }}>
          <MIcon name="check" size={28} sw={2.4} color={T.accentInk} />
        </div>
        <h2 style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: T.ink }}>File traitée</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: T.muted, fontWeight: 600, maxWidth: 230, lineHeight: 1.45 }}>
          Toutes tes priorités du moment sont gérées. Profite — ou avance sur le pipeline.
        </p>
        <button onClick={reset} style={{
          marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px",
          borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 14, fontWeight: 700
        }}><MIcon name="arrow" size={16} sw={2} color={T.ink} />Revoir la file</button>
      </div>);

  }

  return (
    <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", marginTop: 18, minHeight: 430, boxShadow: T.shadowLg, color: "#fff", display: "flex", flexDirection: "column" }}>
      <img key={f.id} src={f.photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(3px)", transform: "scale(1.06)", opacity: vis ? 1 : 0, transition: "opacity .4s ease" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,9,12,.58) 0%, rgba(8,9,12,.30) 30%, rgba(8,9,12,.95) 100%)" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", flex: 1, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ display: "flex", gap: 5, flex: 1 }}>
            {MT_FOCUS.map((_, i) =>
            <span key={i} style={{ height: 3, flex: 1, borderRadius: 999, background: i < idx ? "#34C796" : i === idx ? "#fff" : "rgba(255,255,255,.28)", transition: "background .3s ease" }} />
            )}
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.78)", fontVariantNumeric: "tabular-nums" }}>{idx + 1}<span style={{ color: "rgba(255,255,255,.45)" }}> / {total}</span></span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, ...rise(0) }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: f.urgent ? "#F7B0AA" : "rgba(255,255,255,.88)", whiteSpace: "nowrap", fontSize: "13.5px" }}>
            <MIcon name="clock" size={14} sw={2} color={f.urgent ? "#F7B0AA" : "rgba(255,255,255,.72)"} />{f.time} · {f.eta}
          </span>
        </div>
        <h2 style={{ margin: "11px 0 0", fontSize: 27, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.04, ...rise(1) }}>{f.name}</h2>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,.84)", lineHeight: 1.42, ...rise(2), fontWeight: "500", fontSize: "15px" }}>{f.sub}</p>
        <div style={{ marginTop: 15, paddingTop: 15, borderTop: "1px solid rgba(255,255,255,.18)", ...rise(3) }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4, marginBottom: 12 }}>{f.price}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onPrimary} style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap",
              background: calling ? "#0B7A4B" : "#fff", color: calling ? "#fff" : "#0B0C0E", boxShadow: "0 10px 26px -10px rgba(0,0,0,.55)", transition: "background .25s ease"
            }}>
              {calling ?
              <><span style={{ position: "relative", display: "inline-flex", width: 9, height: 9 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: 999, background: "#34C796", animation: "mfPing 1.4s cubic-bezier(0,0,.2,1) infinite" }} />
                  <span style={{ position: "relative", width: 9, height: 9, borderRadius: 999, background: "#34C796" }} />
                </span><span style={{ fontVariantNumeric: "tabular-nums" }}>Terminer · {mmss}</span></> :
              <><MIcon name={f.icon} size={18} sw={2} color="#0B0C0E" />{f.primary}</>}
            </button>
            <button onClick={advance} title="Replanifier" style={{ width: 50, height: 50, borderRadius: 999, flexShrink: 0, cursor: "pointer", border: "1px solid rgba(255,255,255,.22)", background: "rgba(8,9,12,.42)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center" }}><MIcon name="cal" size={18} sw={1.9} color="#fff" /></button>
            <button onClick={advance} title="Marquer fait" style={{ width: 50, height: 50, borderRadius: 999, flexShrink: 0, cursor: "pointer", border: "1px solid rgba(255,255,255,.22)", background: "rgba(8,9,12,.42)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center" }}><MIcon name="check" size={19} sw={2.3} color="#fff" /></button>
          </div>
        </div>
      </div>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  STATS (Pipeline + Objectif)
// ═══════════════════════════════════════════════════════════════════════
const MRing = ({ pct = 90, size = 66, stroke = 7, color = "#0B0C0E" }) => {
  const T = useMT();
  const r = (size - stroke) / 2,c = 2 * Math.PI * r,off = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.hair} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.4, whiteSpace: "nowrap", lineHeight: 1 }}>{`${pct}%`}</div>
    </div>);

};

const MStatCards = () => {
  const T = useMT();
  const cardBase = { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, padding: "16px 16px 15px", boxShadow: T.shadowSm };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
      <div style={{ ...cardBase, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.muted }}>
          <MIcon name="trend" size={15} sw={2} color={T.muted} /><span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.2 }}>Pipeline</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1, color: T.ink, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>CHF 7.6M</div>
        <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>22 affaires · 1 à risque</div>
      </div>
      <div style={{ ...cardBase, display: "flex", alignItems: "center", gap: 14 }}>
        <MRing pct={90} color={T.goal} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, letterSpacing: 0.2 }}>Objectif 2026</div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.4, color: T.ink, fontVariantNumeric: "tabular-nums", marginTop: 4, whiteSpace: "nowrap" }}>1.07<span style={{ color: T.muted, fontWeight: 700 }}> / 1.2M</span></div>
        </div>
      </div>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  AGENDA DU JOUR
// ═══════════════════════════════════════════════════════════════════════
const MT_AGENDA = [
{ time: "09:30", label: "Relance Pierre Vionnet", meta: "3 nouveaux matchs", color: "#9b7cf0", done: true },
{ time: "10:00", label: "Appel Marie Bertrand", meta: "Relance à chaud", color: "#5b6cff", now: true },
{ time: "11:00", label: "KYC Élodie Schmidt", meta: "Vérification", color: "#0E7490" },
{ time: "11:30", label: "Mandat — Julien Aebischer", meta: "Signature", color: "#1E5BC6" },
{ time: "14:00", label: "Visite Carouge", meta: "Marie Bertrand · 45 min", color: "#0E7490" },
{ time: "16:00", label: "Suivi offre Cologny", meta: "Antoine Picard", color: "#B4570A", risk: true }];


const MAgendaRow = ({ a, last }) => {
  const T = useMT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", background: a.now ? T.cardSubtle : "transparent", boxShadow: last ? "none" : `inset 0 -1px 0 ${T.hair}` }}>
      <div style={{ width: 42, flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: a.now ? T.ink : T.muted, fontVariantNumeric: "tabular-nums" }}>{a.time}</div>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: a.color, flexShrink: 0, opacity: a.done ? 0.4 : 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: a.done ? T.muted : T.ink, letterSpacing: -0.2, textDecoration: a.done ? "line-through" : "none", textDecorationColor: T.ghost, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.label}</div>
        <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.meta}</div>
      </div>
      {a.done && <MIcon name="check" size={16} sw={2.2} color={T.ghost} />}
      {a.now && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, color: T.accentInk, background: T.accent, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>MAINTENANT</span>}
    </div>);

};

const MAgenda = ({ onGo }) => {
  const T = useMT();
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11, padding: "0 2px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: T.ink, whiteSpace: "nowrap" }}>Agenda du jour</h3>
        <button onClick={() => onGo && onGo("agenda")} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.muted, whiteSpace: "nowrap", flexShrink: 0 }}>
          Tout voir <MIcon name="arrow" size={13} sw={2} color={T.muted} />
        </button>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, boxShadow: T.shadowSm, overflow: "hidden" }}>
        {MT_AGENDA.map((a, i) => <MAgendaRow key={i} a={a} last={i === MT_AGENDA.length - 1} />)}
      </div>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  RELANCES IA — bloc accent immersif
// ═══════════════════════════════════════════════════════════════════════
const MRelancesIA = ({ onGo }) => {
  const T = useMT();
  return (
    <div style={{ marginTop: 24, background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 22, padding: "22px 22px 20px", boxShadow: T.shadow, color: T.relanceInk }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.relanceMuted }}>
        <MIcon name="bolt" size={15} sw={2} color={T.relanceMuted} /><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Relances IA</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.6, marginTop: 11 }}>47 contacts à relancer</div>
      <button onClick={() => onGo && onGo("relance")} style={{ marginTop: 16, width: "100%", height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: T.ctaInk, background: T.ctaBg, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, whiteSpace: "nowrap" }}>
        Démarrer la session <MIcon name="arrow" size={17} sw={2} color={T.ctaInk} />
      </button>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  CHROME
// ═══════════════════════════════════════════════════════════════════════
const MEGGAWordmark = ({ color = "#0B0C0E" }) =>
<svg viewBox="0 0 694.81 419.02" width="58" height="35" style={{ display: "block" }} aria-label="MEGGA">
    <path fill={color} d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z" />
    <path fill={color} d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z" />
    <path fill={color} d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z" />
  </svg>;


const MHeader = ({ onOpenSearch }) => {
  const T = useMT();
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <MEGGAWordmark color={T.ink} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onOpenSearch} aria-label="Recherche & MEGGA AI" style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}><MIcon name="search" size={18} sw={2} color={T.ink} /></button>
      </div>
    </header>);

};

// ═══ Barre de commande MEGGA AI — recherche + langage naturel ═══
const MEGlyph = ({ name, size = 18, color = "currentColor", sw = 1.9 }) =>
window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

const MEGGA_GRAD = "linear-gradient(118deg, #4F5BF2 0%, #9A4EDD 50%, #D24A9C 100%)";
const MTSparkGrad = ({ size = 18, sw = 1.7 }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <defs>
      <linearGradient id="mgGrad" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4F5BF2" />
        <stop offset="50%" stopColor="#9A4EDD" />
        <stop offset="100%" stopColor="#D24A9C" />
      </linearGradient>
    </defs>
    <path d="m12 3-1.91 5.81a2 2 0 0 1-1.28 1.28L3 12l5.81 1.91a2 2 0 0 1 1.28 1.28L12 21l1.91-5.81a2 2 0 0 1 1.28-1.28L21 12l-5.81-1.91a2 2 0 0 1-1.28-1.28L12 3Z"
  stroke="url(#mgGrad)" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;


const MT_PROMPTS = [
"Relancer les acheteurs tièdes de Carouge",
"Biens à vendre > 1M à Genève",
"Mes rendez-vous de demain"];


const MTCommand = ({ dark, onClose, onGo }) => {
  const C = {
    ink: "#FFFFFF", inkSoft: "rgba(255,255,255,0.84)", muted: "rgba(255,255,255,0.56)",
    ghost: "rgba(255,255,255,0.44)", card: "rgba(255,255,255,0.075)", cardBorder: "rgba(255,255,255,0.14)",
    chip: "rgba(255,255,255,0.13)", shadow: "0 18px 50px rgba(0,0,0,0.45)"
  };
  const PAGE_BG = "#08080B";
  const glass = { background: C.card, border: `1px solid ${C.cardBorder}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" };
  const [q, setQ] = React.useState("");
  const [asked, setAsked] = React.useState(false);
  const [thinking, setThinking] = React.useState(false);
  const [shown, setShown] = React.useState(0);
  const [turns, setTurns] = React.useState([]);
  const [follow, setFollow] = React.useState("");
  const inputRef = React.useRef(null);
  const tRef = React.useRef(null);
  const scrollMainRef = React.useRef(null);
  React.useEffect(() => {const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 280);return () => {clearTimeout(t);clearTimeout(tRef.current);};}, []);

  const query = q.trim().toLowerCase();
  const contacts = (window.CRM_CONTACTS || []).filter((c) => query && `${c.firstName} ${c.lastName}`.toLowerCase().includes(query)).slice(0, 3);
  const biens = (window.CRM_BIENS || []).filter((b) => query && `${b.title} ${b.addr} ${b.ref}`.toLowerCase().includes(query)).slice(0, 3);
  const deals = (window.CRM_DEALS || []).filter((d) => {
    if (!query) return false;
    const c = (window.CRM_CONTACTS || []).find((x) => x.id === d.contactId);
    const b = (window.CRM_BIENS || []).find((x) => x.id === d.bienId);
    return `${c ? c.firstName + " " + c.lastName : ""} ${b ? b.title : ""}`.toLowerCase().includes(query);
  }).slice(0, 3);
  const totalRes = contacts.length + biens.length + deals.length;

  // Intention interprétée (heuristique légère)
  const intent = (() => {
    const t = query;
    if (/rdv|rendez|agenda|demain|semaine|visite|calendr/.test(t)) return { label: "Agenda & rendez-vous", icon: "calendar" };
    if (/bien|appart|villa|maison|vendre|vente|location|loyer|m2|chf|million|pièce|>|<|\d{6,}/.test(t)) return { label: "Recherche de bien", icon: "building" };
    if (/relanc|offre|deal|pipeline|acheteur|vendeur|match|tiède|chaud/.test(t)) return { label: "Pipeline & relances", icon: "pipeline" };
    return { label: "Recherche de contact", icon: "user" };
  })();

  // Correction douce (distance de Levenshtein sur prénoms/noms)
  const lev = (a, b) => {
    const m = a.length,n = b.length;if (!m) return n;if (!n) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  };
  const correction = (() => {
    if (totalRes > 0 || query.length < 3) return null;
    const names = [...new Set((window.CRM_CONTACTS || []).flatMap((c) => [c.firstName, c.lastName]))];
    let best = null,bd = 99;
    names.forEach((n) => {const dd = lev(query, n.toLowerCase());if (dd < bd) {bd = dd;best = n;}});
    return best && bd <= 2 && best.toLowerCase() !== query ? best : null;
  })();

  const answerText = totalRes > 0 ?
  `J'ai trouvé ${totalRes} élément${totalRes > 1 ? "s" : ""} liés à « ${q} ». Voici les plus pertinents — ou je prépare une action pour vous.` :
  `Rien dans vos données pour « ${q} ». Je peux élargir la recherche au marché public MEGGA, ou créer directement le bon élément.`;

  const intentActions = (() => {
    if (totalRes > 0) return [{ label: "Voir les matchs", id: "matching", icon: "sparkle", primary: true }, { label: "Ouvrir le pipeline", id: "pipeline" }];
    switch (intent.icon) {
      case "calendar":return [{ label: "Ouvrir l'agenda", id: "agenda", icon: "calendar", primary: true }];
      case "building":return [{ label: "Voir tous les biens", id: "biens", icon: "building", primary: true }, { label: "Créer un bien", id: "biens-new" }];
      case "pipeline":return [{ label: "Ouvrir le pipeline", id: "pipeline", icon: "pipeline", primary: true }, { label: "Voir les matchs", id: "matching" }];
      default:return [{ label: `Créer le contact « ${q} »`, id: "contact-new", icon: "plus", primary: true }];
    }
  })();

  // Prévisualisations inline (meilleurs résultats)
  const fmtCHF = (n) => n == null ? null : "CHF " + Number(n).toLocaleString("fr-CH").replace(/[\s\u202f,]/g, "'");
  const previewItems = [
  ...contacts.map((c) => ({ icon: "user", title: `${c.firstName} ${c.lastName}`, sub: c.type === "seller" ? "Vendeur" : "Acheteur", id: "contacts" })),
  ...biens.map((b) => ({ icon: "building", title: b.title, sub: [b.addr, fmtCHF(b.price || b.rent)].filter(Boolean).join(" · "), id: "biens" })),
  ...deals.map((d) => {const c = (window.CRM_CONTACTS || []).find((x) => x.id === d.contactId);const b = (window.CRM_BIENS || []).find((x) => x.id === d.bienId);return { icon: "pipeline", title: c ? `${c.firstName} ${c.lastName}` : "Affaire", sub: b ? b.title : "Sans bien", id: "pipeline" };})].
  slice(0, 3);

  const followReply = (f) => {const subj = previewItems[0] ? previewItems[0].title : q;return `Concernant « ${subj} » — en affinant sur « ${f} », je peux préparer l'action ou ouvrir le détail directement. Dites-moi le sens à donner.`;};

  const ask = () => {if (!query) return;setAsked(true);setThinking(true);setShown(0);setFollow("");setTurns([{ role: "ai", text: answerText }]);clearTimeout(tRef.current);tRef.current = setTimeout(() => setThinking(false), 750);};
  const reset = () => {setQ("");setAsked(false);setThinking(false);setShown(0);setTurns([]);setFollow("");};
  const go = (id) => {onClose && onClose();onGo && onGo(id);};
  const sendFollow = () => {const f = follow.trim();if (!f) return;setFollow("");setTurns((t) => [...t, { role: "user", text: f }, { role: "ai", text: followReply(f) }]);setShown(0);setThinking(true);clearTimeout(tRef.current);tRef.current = setTimeout(() => setThinking(false), 650);};

  const lastAiText = turns.length && turns[turns.length - 1].role === "ai" ? turns[turns.length - 1].text : "";

  // Streaming « machine à écrire » du dernier message IA
  React.useEffect(() => {
    if (!asked || thinking || !lastAiText) return;
    let i = 0;setShown(0);
    const id = setInterval(() => {i += 2;setShown(i);if (i >= lastAiText.length) clearInterval(id);}, 16);
    return () => clearInterval(id);
  }, [turns, thinking, asked]);

  // Auto-scroll vers le dernier message du fil
  React.useEffect(() => {
    if (scrollMainRef.current) scrollMainRef.current.scrollTop = scrollMainRef.current.scrollHeight;
  }, [turns, shown, thinking]);

  const groupLabel = (txt) =>
  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: C.muted, padding: "0 4px 9px", marginTop: 18 }}>{txt}</div>;

  const resultRow = (icon, title, sub, onClick) =>
  <button onClick={onClick} style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", background: "transparent", display: "flex", alignItems: "center", gap: 13, padding: "12px 14px" }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: C.chip }}>
        <MEGlyph name={icon} size={19} color={C.ink} sw={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{sub}</span>}
      </span>
    </button>;


  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: PAGE_BG, color: C.ink, overflow: "hidden", animation: "mtCmd .3s cubic-bezier(.2,.8,.2,1) both" }}>
      <style>{`@keyframes mtCmd{from{opacity:0;transform:scale(.97) translateY(-8px)}to{opacity:1;transform:none}}@keyframes mtCmdUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes mtDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}@keyframes mtBlobA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(18px,-12px) scale(1.07)}}@keyframes mtBlobB{0%,100%{transform:translate(0,0) scale(1.03)}50%{transform:translate(-20px,-14px) scale(1.09)}}@keyframes mtBlobC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(0,-16px) scale(1.1)}}@keyframes mtCaret{0%,50%{opacity:1}50.01%,100%{opacity:0}} .mtCmdField::placeholder{color:rgba(255,255,255,0.5);font-weight:600} .mtBtn{transition:transform .2s cubic-bezier(.2,.8,.2,1)} .mtBtn:active{transform:scale(.97)} .mtCta{position:relative;overflow:hidden;transition:transform .2s cubic-bezier(.2,.8,.2,1)} .mtCta:active{transform:scale(.985)}`}</style>

      {/* Halos de marque animés (doux) */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "-22%", bottom: "-30%", width: "78%", height: "66%", borderRadius: "50%", background: "radial-gradient(circle, #4F5BF2 0%, rgba(79,91,242,0) 70%)", filter: "blur(26px)", opacity: 0.6, animation: "mtBlobA 16s ease-in-out infinite" }} />
        <div style={{ position: "absolute", right: "-24%", bottom: "-32%", width: "82%", height: "68%", borderRadius: "50%", background: "radial-gradient(circle, #D24A9C 0%, rgba(210,74,156,0) 70%)", filter: "blur(26px)", opacity: 0.58, animation: "mtBlobB 19s ease-in-out infinite" }} />
        <div style={{ position: "absolute", left: "50%", bottom: "-40%", width: "86%", height: "72%", marginLeft: "-43%", borderRadius: "50%", background: "radial-gradient(circle, #9A4EDD 0%, rgba(154,78,221,0) 68%)", filter: "blur(24px)", opacity: 0.55, animation: "mtBlobC 14s ease-in-out infinite" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Champ */}
      <div style={{ flexShrink: 0, paddingTop: 54, paddingLeft: 16, paddingRight: 16, paddingBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 52, borderRadius: 16, ...glass, boxShadow: C.shadow, display: "flex", alignItems: "center", gap: 11, padding: "0 14px" }}>
          <MTSparkGrad size={20} sw={1.8} />
          <input ref={inputRef} className="mtCmdField" value={q}
            onChange={(e) => {setQ(e.target.value);setAsked(false);}}
            onKeyDown={(e) => {if (e.key === "Enter") ask();}}
            placeholder="Recherche ou demande à MEGGA…"
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: -0.2, color: C.ink, minWidth: 0 }} />
          {q && <button onClick={reset} aria-label="Effacer" style={{ width: 26, height: 26, borderRadius: 999, border: 0, cursor: "pointer", background: C.chip, display: "grid", placeItems: "center", flexShrink: 0 }}><MEGlyph name="close" size={14} color={C.muted} sw={2.2} /></button>}
        </div>
        <button onClick={onClose} className="mtBtn" style={{ height: 52, padding: "0 16px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: C.ink, ...glass, flexShrink: 0 }}>OK</button>
      </div>

      <main ref={scrollMainRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 16px 28px", WebkitOverflowScrolling: "touch" }}>
        {asked &&
          <div style={{ marginTop: 8, borderRadius: 20, ...glass, color: "#FFFFFF", padding: "18px 18px 16px", boxShadow: C.shadow, animation: "mtCmdUp .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.8 }}>MEGGA AI</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 11, padding: "5px 11px 5px 9px", borderRadius: 999, background: "rgba(255,255,255,0.16)" }}>
              <MEGlyph name={intent.icon} size={14} color="#FFFFFF" sw={1.9} />
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: -0.1 }}>J'ai compris : {intent.label}</span>
            </div>

            {turns.map((m, ti) => {
              const isLast = ti === turns.length - 1;
              if (m.role === "user") return (
                <div key={ti} style={{ display: "flex", justifyContent: "flex-end", marginTop: 13 }}>
                  <span style={{ maxWidth: "82%", background: "rgba(255,255,255,0.22)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, letterSpacing: -0.2, padding: "9px 13px", borderRadius: "16px 16px 4px 16px" }}>{m.text}</span>
                </div>);

              if (isLast && thinking) return (
                <div key={ti} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 13, height: 22 }}>
                  {[0, 1, 2].map((k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 999, background: "#FFFFFF", animation: `mtDot 1s ${k * 0.15}s infinite ease-in-out` }} />)}
                </div>);

              const display = isLast ? m.text.slice(0, shown) : m.text;
              return (
                <div key={ti} style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.5, marginTop: 12 }}>
                  {display}
                  {isLast && shown < m.text.length && <span style={{ display: "inline-block", width: 2, height: "1em", marginLeft: 1, background: "#FFFFFF", verticalAlign: "-2px", animation: "mtCaret .7s steps(1) infinite" }} />}
                </div>);

            })}

            {!thinking && lastAiText && shown >= lastAiText.length &&
            <div style={{ animation: "mtCmdUp .3s ease both" }}>
                {turns.length === 1 &&
              <>
                    {correction &&
                <button onClick={() => {const v = correction;setQ(v);setAsked(false);setTimeout(ask, 0);}} style={{ marginTop: 12, height: 34, padding: "0 13px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", background: "rgba(255,255,255,0.16)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <MEGlyph name="search" size={13} color="#FFFFFF" sw={2} />Vouliez-vous dire&nbsp;<b style={{ fontWeight: 800 }}>{correction}</b>&nbsp;?
                      </button>
                }
                    {previewItems.length > 0 &&
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                        {previewItems.map((p, pi) =>
                  <button key={pi} onClick={() => go(p.id)} style={{ textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", borderRadius: 14, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", gap: 12, padding: "11px 13px" }}>
                            <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.2)" }}><MEGlyph name={p.icon} size={17} color="#FFFFFF" sw={1.9} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                              {p.sub && <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{p.sub}</span>}
                            </span>
                            <MEGlyph name="arrow-right" size={15} color="rgba(255,255,255,0.6)" sw={2} />
                          </button>
                  )}
                      </div>
                }
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      {intentActions.map((a, k) => a.primary ?
                  <button key={k} onClick={() => go(a.id)} style={{ height: 38, padding: "0 15px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: "#6D28D9", background: "#FFFFFF", display: "inline-flex", alignItems: "center", gap: 7 }}>{a.icon && <MEGlyph name={a.icon} size={14} color="#6D28D9" sw={1.9} />}{a.label}</button> :

                  <button key={k} onClick={() => go(a.id)} style={{ height: 38, padding: "0 15px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: "#FFFFFF", background: "transparent", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.45)" }}>{a.label}</button>
                  )}
                    </div>
                  </>
              }
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                  <input value={follow} onChange={(e) => setFollow(e.target.value)} onKeyDown={(e) => {if (e.key === "Enter") sendFollow();}} placeholder="Répondre à MEGGA…" className="mtCmdField" style={{ flex: 1, height: 42, border: 0, outline: "none", borderRadius: 999, background: "rgba(255,255,255,0.16)", color: "#FFFFFF", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, padding: "0 15px", minWidth: 0 }} />
                  <button onClick={sendFollow} aria-label="Envoyer" style={{ width: 42, height: 42, borderRadius: 999, border: 0, cursor: "pointer", background: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><MEGlyph name="arrow-up" size={18} color="#FFFFFF" sw={2.1} /></button>
                </div>
              </div>
            }
          </div>
          }

        {query ?
          <div style={{ animation: "mtCmdUp .3s ease both" }}>
            {!asked &&
            <button onClick={ask} className="mtCta" style={{ width: "100%", textAlign: "left", marginTop: 14, border: 0, cursor: "pointer", fontFamily: "inherit", borderRadius: 18, background: MEGGA_GRAD, color: "#FFFFFF", boxShadow: "0 16px 40px rgba(154,78,221,0.38)", display: "flex", alignItems: "center", gap: 13, padding: "15px 16px" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.75 }}>Demander à MEGGA</span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, letterSpacing: -0.3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>« {q} »</span>
                </span>
              </button>
            }
            {totalRes > 0 ?
            <div style={{ marginTop: 6, borderRadius: 20, ...glass, boxShadow: C.shadow, overflow: "hidden" }}>
                {contacts.length > 0 && <div style={{ padding: "12px 4px 0" }}>{groupLabel("Contacts")}</div>}
                {contacts.map((c) => resultRow("user", `${c.firstName} ${c.lastName}`, c.type === "seller" ? "Vendeur" : "Acheteur", () => go("contacts")))}
                {biens.length > 0 && <div style={{ padding: "0 4px" }}>{groupLabel("Biens")}</div>}
                {biens.map((b) => resultRow("building", b.title, b.addr, () => go("biens")))}
                {deals.length > 0 && <div style={{ padding: "0 4px" }}>{groupLabel("Affaires")}</div>}
                {deals.map((d) => {const c = (window.CRM_CONTACTS || []).find((x) => x.id === d.contactId);const b = (window.CRM_BIENS || []).find((x) => x.id === d.bienId);return resultRow("pipeline", c ? `${c.firstName} ${c.lastName}` : "Affaire", b ? b.title : "Sans bien", () => go("pipeline"));})}
                <div style={{ height: 10 }} />
              </div> :
            null}
          </div> :

          <div style={{ animation: "mtCmdUp .3s ease both" }}>
            {groupLabel("Suggestions")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MT_PROMPTS.map((p, i) =>
              <button key={i} onClick={() => {setQ(p);setAsked(false);setTimeout(ask, 0);}} className="mtBtn" style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", borderRadius: 14, ...glass, display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, color: C.inkSoft }}>{p}</span>
                  <MEGlyph name="arrow-right" size={16} color={C.ghost} sw={2} />
                </button>
              )}
            </div>
            {groupLabel("Actions rapides")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[{ icon: "building", label: "Créer un bien", id: "biens-new" }, { icon: "user", label: "Nouveau contact", id: "contacts" }, { icon: "bell-ring", label: "Mes relances", id: "pipeline" }, { icon: "calendar", label: "Agenda", id: "agenda" }].map((a, i) =>
              <button key={i} onClick={() => go(a.id)} className="mtBtn" style={{ textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", borderRadius: 16, ...glass, display: "flex", flexDirection: "column", gap: 14, padding: "15px 15px 14px", minHeight: 96 }}>
                  <MEGlyph name={a.icon} size={24} color={C.ink} sw={1.85} />
                  <span style={{ marginTop: "auto", fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: C.ink }}>{a.label}</span>
                </button>
              )}
            </div>
          </div>
          }
      </main>
      </div>
    </div>);

};

const MT_TABS = [
{ id: "today", label: "Aujourd'hui", icon: "home" },
{ id: "pipeline", label: "Pipeline", icon: "trend" },
{ id: "matching", label: "Matching", icon: "spark" },
{ id: "agenda", label: "Agenda", icon: "cal" },
{ id: "more", label: "Plus", icon: "menu" }];


const MTabBar = () => {
  const T = useMT();
  const active = "today";
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {MT_TABS.map((tb) => {
        const on = tb.id === active;
        return (
          <button key={tb.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <MIcon name={tb.icon} size={22} sw={on ? 2.2 : 1.9} color={on ? T.ink : T.ghost} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? T.ink : T.muted, whiteSpace: "nowrap" }}>{tb.label}</span>
          </button>);

      })}
    </nav>);

};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═══════════════════════════════════════════════════════════════════════
const MobileTodayScreen = ({ dark = false, onGo }) => {
  const T = dark ? { ...MT_DARK, stage: MT_STAGE.dark } : { ...MT_LIGHT, stage: MT_STAGE.light };
  const [searchOpen, setSearchOpen] = React.useState(false);
  return (
    <MTCtx.Provider value={T}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, position: "relative" }}>
        <style>{`@keyframes mfPing {0%{transform:scale(1);opacity:.7}75%,100%{transform:scale(2.4);opacity:0}}`}</style>
        <MHeader onOpenSearch={() => setSearchOpen(true)} />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 24px", WebkitOverflowScrolling: "touch" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: T.muted }}>Dimanche 14 juin</div>
          <h1 style={{ margin: "5px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Bonjour Gregory</h1>
          <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 600, marginTop: 5 }}>5 priorités · 6 rendez-vous aujourd'hui</div>
          <MFocusHero />
          <MStatCards />
          <MAgenda onGo={onGo} />
          <MRelancesIA onGo={onGo} />
        </main>
        <MTabBar />
        {searchOpen && <MTCommand dark={dark} onGo={onGo} onClose={() => setSearchOpen(false)} />}
      </div>
    </MTCtx.Provider>);

};

window.MobileTodayScreen = MobileTodayScreen;
// Atomes + données partagés (réutilisés par la version tablette)
Object.assign(window, {
  MTCtx, MT_LIGHT, MT_DARK, MT_STAGE, MTCommand,
  MIcon, MAv, MEGGAWordmark, MRing,
  MT_FOCUS, MT_AGENDA, MT_PHOTO
});