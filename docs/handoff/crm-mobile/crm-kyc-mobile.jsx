// MEGGA CRM — Responsive · Écran KYC / Conformité LBA MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). Portage fidèle du desktop
// (crm-screen-kyc-sugar.jsx) : liste de dossiers ↔ vue détail (4 onglets
// Synthèse / Contrôles / Documents / Audit). Tout est cliquable :
//   • filtres, ouverture d'un dossier, retour, changement d'onglet
//   • « Marquer vérifié » par contrôle + « Tout marquer vérifié »
//   • Re-screener (animé) + Exporter le dossier (animé)
// Réutilise window.MTCtx / MT_LIGHT / MT_DARK (crm-mobile-today.jsx),
// window.MEIcon (crm-meicon.jsx) et la data window.KYC_* / CRM_CONTACTS.

const MK_useMT = () => React.useContext(window.MTCtx);

// Badge "vérifié" — sceau festonné bleu MEGGA (réutilisé de la fiche contact CvVerifiedBadge).
const MK_SEAL_D = "M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z";
const MkVerifiedBadge = ({ size = 20, seal = "#0041D9", check = "#FFFFFF" }) =>
<svg width={size} height={size} viewBox="0 0 19 19" style={{ flexShrink: 0, display: "block" }} aria-label="Vérifié">
    <circle cx="9.5" cy="9.5" r="5.6" fill={check} />
    <path d={MK_SEAL_D} fill={seal} fillRule="evenodd" clipRule="evenodd" />
  </svg>;


// ─── Palette KYC dérivée des tokens mobiles ─────────────────────────────
// On mappe les tokens MT_* (clair/sombre) vers les clés sémantiques KYC.
// black/onAccent = CTA (noir pur en clair, pilule claire en sombre).
function mkPal(T) {
  const dark = T.mode === "dark";
  return {
    pageBg: dark ? "#121316" : "#E9ECF1",
    card: T.card, cardSubtle: T.cardSubtle, cardBorder: T.cardBorder,
    ink: T.ink, inkSoft: T.inkSoft, muted: T.muted, ghost: T.ghost, hair: T.hair,
    black: T.accent, blackHover: dark ? "#FFFFFF" : "#1F2024", onAccent: T.accentInk,
    shadowSm: T.shadowSm, shadow: T.shadow, shadowLg: T.shadowLg,
    ringTrack: dark ? "rgba(255,255,255,0.14)" : "rgba(11,12,14,0.08)"
  };
}

const MK_RISK_TONE = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" };
const MK_CHECK_KEYS = ["id", "address", "pep", "sanctions", "funds"];
const MK_CHECK_ICON = { id: "id", address: "home", pep: "flag", sanctions: "ban", funds: "coins" };

// ─── Icônes KYC (portage 1:1 du desktop, trait linéaire) ────────────────
const MkIcon = ({ name, size = 22, stroke = "currentColor", sw = 1.7 }) => {
  const p = {
    id: <><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="9" cy="12" r="2.5" /><path d="M14 10h4M14 14h4" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v9h14v-9" /></>,
    flag: <><path d="M4 21V4" /><path d="M4 5h13l-2 4 2 4H4" /></>,
    ban: <><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></>,
    coins: <><circle cx="9" cy="9" r="6" /><circle cx="15" cy="15" r="6" /></>,
    check: <><path d="m5 13 4 4 10-12" /></>,
    checkAll: <><path d="m2 13 4 4 10-12" /><path d="m9 15 3 3 10-12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrowL: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
    arrowR: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    download: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
    upload: <><path d="M12 20V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}>{p[name] || null}</svg>);

};

const fmtDateFR = (iso, long) => iso ? new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: long ? "long" : "short", year: "numeric" }) : "—";
const fmtTimeFR = (iso) => iso ? new Date(iso).toLocaleString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

// ═══════════════════════════════════════════════════════════════════════
//  PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════
const MkBlackBtn = ({ children, onClick, icon, full, disabled }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: 46, padding: "0 20px", borderRadius: 999, border: 0,
      background: disabled ? P.ghost : P.black, color: P.onAccent, fontFamily: "inherit",
      fontSize: 14, fontWeight: 700, letterSpacing: -0.1, cursor: disabled ? "default" : "pointer",
      width: full ? "100%" : "auto", display: "inline-flex", alignItems: "center",
      justifyContent: "center", gap: 9, whiteSpace: "nowrap",
      boxShadow: disabled ? "none" : "0 8px 20px -8px rgba(11,12,14,0.5)"
    }}>{icon}{children}</button>);

};

const MkGhostBtn = ({ children, onClick, icon, active }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <button onClick={onClick} style={{
      height: 38, padding: "0 15px", borderRadius: 999,
      border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
      background: active ? P.black : P.card, color: active ? P.onAccent : P.inkSoft,
      boxShadow: active ? "0 6px 16px -6px rgba(11,12,14,0.4)" : P.shadowSm,
      display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", flexShrink: 0
    }}>{icon}{children}</button>);

};

const MkStatusPill = ({ status }) => {
  const meta = (window.KYC_STATUS_LABELS || {})[status] || { label: status, tone: "#7A8088" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999,
      background: meta.tone, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 0.1, whiteSpace: "nowrap"
    }}>{meta.label}</span>);

};

const MkRiskPill = ({ risk }) => {
  const meta = (window.KYC_RISK_LABELS || {})[risk] || { label: risk, tone: "#7A8088" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999,
      background: meta.tone, color: "#fff", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap"
    }}>{meta.label}</span>);

};

// Jauge : arc = avancement (done/total), couleur = risque, halo si modéré/élevé
const MkGauge = ({ dossier, size = 56 }) => {
  const T = MK_useMT();const P = mkPal(T);
  const checks = Object.values(dossier.checks || {});
  const total = checks.length;
  const done = checks.filter((c) => c.status === "verified" || c.status === "na").length;
  const frac = total ? done / total : 0;
  const risk = dossier.riskLevel || "low";
  const color = MK_RISK_TONE[risk] || P.muted;
  const isHigh = risk === "high",isMed = risk === "medium";
  const stroke = Math.max(5, Math.round(size * 0.12));
  const r = (size - stroke) / 2,c = 2 * Math.PI * r,off = c * (1 - frac);
  const big = size >= 76 ? 20 : 15;
  const wrap = { position: "relative", width: size, height: size, borderRadius: 999, flexShrink: 0 };
  // Pas de lueur de risque tant que rien n'est avancé (frac 0) — la jauge reste neutre.
  if (isMed && frac > 0) wrap.boxShadow = `0 0 14px 0 ${color}3A`;
  return (
    <div className={isHigh && frac > 0 ? "mk-halo-high" : undefined} style={wrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.ringTrack} strokeWidth={stroke} />
        {frac > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ fontSize: big, fontWeight: 800, color: P.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.4, lineHeight: 1 }}>
          {done}<span style={{ color: P.muted, fontWeight: 700 }}>/{total}</span>
        </div>
      </div>
    </div>);

};

// Boutons animés (Re-screener / Exporter)
const MkAnimBtn = ({ kind }) => {
  const T = MK_useMT();const P = mkPal(T);
  const [state, setState] = React.useState("idle");
  React.useEffect(() => {
    if (state === "running") {const t = setTimeout(() => setState("done"), 1600);return () => clearTimeout(t);}
    if (state === "done") {const t = setTimeout(() => setState("idle"), 1800);return () => clearTimeout(t);}
  }, [state]);
  const running = state === "running",done = state === "done";
  const isExport = kind === "export";
  const label = isExport ?
  running ? "Génération…" : done ? "Dossier exporté" : "Exporter le dossier" :
  running ? "Screening…" : done ? "À jour" : "Re-screener";
  const icon = done ? "check" : running ? "refresh" : isExport ? "download" : "refresh";
  if (isExport) {
    const bg = done ? "#10B981" : P.black;
    return (
      <button onClick={() => state === "idle" && setState("running")} disabled={running} style={{
        height: 46, padding: "0 18px", borderRadius: 999, border: 0, background: bg, color: P.onAccent,
        fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: running ? "default" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap",
        boxShadow: "0 8px 20px -8px rgba(11,12,14,0.5)"
      }}>
        {label}
      </button>);

  }
  return (
    <button onClick={() => state === "idle" && setState("running")} disabled={running} style={{
      height: 46, padding: "0 16px", borderRadius: 999, border: 0, background: P.card,
      color: done ? "#10B981" : P.inkSoft, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
      cursor: running ? "default" : "pointer", display: "inline-flex", alignItems: "center",
      justifyContent: "center", gap: 8, whiteSpace: "nowrap", boxShadow: P.shadowSm
    }}>
      <span style={{ display: "inline-flex", animation: running ? "mkSpin .8s linear infinite" : "none" }}>
        <MkIcon name={icon} size={14} stroke={done ? "#10B981" : P.inkSoft} sw={done ? 2.3 : 1.8} />
      </span>{label}
    </button>);

};

// ═══════════════════════════════════════════════════════════════════════
//  LISTE — ligne dossier
// ═══════════════════════════════════════════════════════════════════════
const MkDossierRow = ({ dossier, contact, onOpen, delay }) => {
  const T = MK_useMT();const P = mkPal(T);
  const blocking = dossier.status !== "verified";
  return (
    <button onClick={onOpen} className="mkUp" style={{
      "--d": `${delay}ms`, width: "100%", textAlign: "left", fontFamily: "inherit",
      display: "flex", alignItems: "center", gap: 14, padding: "16px 16px",
      background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 20,
      cursor: "pointer", boxShadow: P.shadowSm
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 999, color: "#fff", flexShrink: 0,
        background: contact.avatarBg || P.black, display: "grid", placeItems: "center",
        fontSize: 16, fontWeight: 700, letterSpacing: -0.3
      }}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: P.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {contact.firstName} {contact.lastName}
        </div>
      </div>
      <MkGauge dossier={dossier} size={52} />
    </button>);

};

// ─── Bandeau de stats compact (scroll horizontal) ───────────────────────
const MkStatChip = ({ label, value, tone }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <div style={{
      flexShrink: 0, minWidth: 124, background: P.card, borderRadius: 16, padding: "14px 16px",
      border: `1px solid ${P.cardBorder}`, boxShadow: P.shadowSm
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: P.muted }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: P.ink, fontVariantNumeric: "tabular-nums", marginTop: 8, lineHeight: 1 }}>{value}</div>
    </div>);

};

const MkListView = ({ onOpen, filter, setFilter }) => {
  const T = MK_useMT();const P = mkPal(T);
  const dossiers = window.KYC_DOSSIERS || [];
  const contacts = window.CRM_CONTACTS || [];
  const stats = {
    verified: dossiers.filter((d) => d.status === "verified").length,
    pending: dossiers.filter((d) => d.status === "pending").length,
    none: dossiers.filter((d) => d.status === "none").length,
    risk: dossiers.filter((d) => d.riskLevel === "high" || d.riskLevel === "medium").length,
    high: dossiers.filter((d) => d.riskLevel === "high").length
  };
  const filtered = dossiers.filter((d) => {
    if (filter === "all") return true;
    if (filter === "verified") return d.status === "verified";
    if (filter === "pending") return d.status === "pending";
    if (filter === "none") return d.status === "none";
    if (filter === "risk") return d.riskLevel === "high";
    return true;
  });
  const filters = [
  { id: "all", label: "Tous" },
  { id: "pending", label: "En cours" },
  { id: "none", label: "À démarrer" },
  { id: "verified", label: "Vérifiés" },
  { id: "risk", label: "Risque élevé" }];

  return (
    <div>
      <div className="mkUp" style={{ "--d": "20ms" }}>
        <h1 style={{ margin: "2px 0 8px", fontSize: 30, fontWeight: 800, letterSpacing: -1.2, color: P.ink, lineHeight: 1.05 }}>Dossiers KYC</h1>
      </div>

      {/* Filtres */}
      <div className="mkUp mk-hscroll" style={{ "--d": "120ms", display: "flex", gap: 8, overflowX: "auto", margin: "16px -18px 0", padding: "0 18px 4px" }}>
        {filters.map((f) =>
        <MkGhostBtn key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</MkGhostBtn>
        )}
      </div>

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 16 }}>
        {filtered.map((d, i) => {
          const contact = contacts.find((c) => c.id === d.contactId);
          if (!contact) return null;
          return <MkDossierRow key={d.id} dossier={d} contact={contact} onOpen={() => onOpen(d.id)} delay={160 + i * 45} />;
        })}
        {filtered.length === 0 &&
        <div style={{ padding: "44px 20px", textAlign: "center", background: P.card, borderRadius: 20, border: `1px solid ${P.cardBorder}`, boxShadow: P.shadowSm, color: P.muted, fontSize: 13.5, fontWeight: 600 }}>
            Aucun dossier ne correspond à ce filtre.
          </div>
        }
      </div>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  DÉTAIL — header
// ═══════════════════════════════════════════════════════════════════════
const MkDetailHeader = ({ dossier, contact }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <div className="mkUp" style={{ "--d": "20ms", background: P.card, borderRadius: 22, padding: "18px 18px", border: `1px solid ${P.cardBorder}`, boxShadow: P.shadow }}>
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        <div style={{
          width: 58, height: 58, borderRadius: 999, color: "#fff", flexShrink: 0,
          background: contact.avatarBg || P.black, display: "grid", placeItems: "center",
          fontSize: 19, fontWeight: 700, letterSpacing: -0.4
        }}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: P.ink, letterSpacing: -0.6, lineHeight: 1.1, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ minWidth: 0, flexShrink: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.firstName} {contact.lastName}</span>
            {dossier.status === "verified" && <MkVerifiedBadge size={20} />}
          </h1>
        </div>
        <MkGauge dossier={dossier} size={62} />
      </div>
      {dossier.riskFlag &&
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14, padding: "11px 13px", borderRadius: 14, background: T.mode === "dark" ? "rgba(180,35,24,0.16)" : "rgba(180,35,24,0.07)" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: dossier.riskFlag.tone || "#B42318" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, letterSpacing: -0.2 }}>Risque signalé — niveau {dossier.riskFlag.levelLabel.toLowerCase()}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: P.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dossier.riskFlag.motifLabel} · escaladé à la conformité</div>
          </div>
        </div>
      }
    </div>);

};

// ─── Onglets segmentés ──────────────────────────────────────────────────
// ─── Onglets (barre fixe, hors zone de défilement) ───────────────────────
const MK_DETAIL_TABS = [
{ id: "synthese", label: "Synthèse" },
{ id: "controles", label: "Contrôles" },
{ id: "documents", label: "Documents" },
{ id: "audit", label: "Audit" }];

const MkSegBar = ({ tabs, active, onChange }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <div style={{ flexShrink: 0, zIndex: 6, padding: "10px 18px 16px", background: "transparent" }}>
      <div style={{ display: "flex", gap: 16 }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{
              flex: 1, height: 38, border: 0, cursor: "pointer", borderRadius: 999, fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2,
              color: on ? P.onAccent : P.inkSoft, background: on ? P.black : P.card,
              boxShadow: on ? T.mode === "dark" ? P.shadowSm : "0 6px 16px rgba(11,12,14,0.20)" : P.shadowSm,
              transition: "all .2s ease"
            }}>{t.label}</button>);

        })}
      </div>
    </div>);

};

// ─── Onglet Synthèse ────────────────────────────────────────────────────
const MkMetaRow = ({ label, children, last }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "11px 0", borderBottom: last ? "none" : `1px solid ${P.cardSubtle}` }}>
      <span style={{ fontSize: 12.5, color: P.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: P.ink, fontWeight: 700, textAlign: "right" }}>{children}</span>
    </div>);

};

const MkCheckMini = ({ checkKey, check, onClick, last }) => {
  const T = MK_useMT();const P = mkPal(T);
  const label = (window.KYC_CHECK_LABELS || {})[checkKey] || { title: checkKey };
  const verified = check.status === "verified" || check.status === "na";
  const meta = (window.KYC_STATUS_LABELS || {})[check.status] || { tone: P.muted, label: check.status };
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", border: 0, background: "transparent", cursor: "pointer",
      fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, padding: "11px 0",
      borderBottom: last ? "none" : `1px solid ${P.cardSubtle}`
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: verified ? P.black : P.cardSubtle, display: "grid", placeItems: "center" }}>
        <MkIcon name={MK_CHECK_ICON[checkKey]} size={16} stroke={verified ? P.onAccent : P.inkSoft} />
      </div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: P.ink, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label.title}</span>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: verified ? P.muted : meta.tone, flexShrink: 0 }}>{meta.label}</span>
    </button>);

};

const MkSynthese = ({ dossier, contact, onMarkAll, goControles }) => {
  const T = MK_useMT();const P = mkPal(T);
  const verified = dossier.status === "verified";
  const checks = dossier.checks || {};
  const riskMeta = (window.KYC_RISK_LABELS || {})[dossier.riskLevel] || {};
  let last = dossier.verifiedAt || null;
  Object.values(checks).forEach((c) => {if (c.at && (!last || new Date(c.at) > new Date(last))) last = c.at;});
  const bento = { background: P.card, borderRadius: 20, padding: "20px 18px", border: `1px solid ${P.cardBorder}`, boxShadow: P.shadow };
  const eyebrow = { fontSize: 10.5, fontWeight: 700, color: P.muted, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={bento}>
        <div style={eyebrow}>État du dossier</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: -0.3 }}>
          {verified ? "Vérifié — transaction autorisée" : "Vérifications à compléter"}
        </div>
        <div style={{ fontSize: 13, color: P.muted, fontWeight: 500, marginTop: 5, lineHeight: 1.5 }}>
          {verified ? "Tous les contrôles LBA sont validés." : "Vous pouvez continuer à faire avancer le deal — le KYC reste recommandé avant la signature, mais il n'est pas bloquant."}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <MkAnimBtn kind="rescreen" />
          {verified ? <MkAnimBtn kind="export" /> :
          <MkBlackBtn onClick={onMarkAll} icon={<MkIcon name="checkAll" size={14} stroke={P.onAccent} />}>Tout vérifier</MkBlackBtn>
          }
        </div>
      </div>

      <div style={bento}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 6 }}>
          <button onClick={goControles} style={{ border: 0, background: "transparent", color: P.ink, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
            Détail <MkIcon name="arrowR" size={13} stroke={P.ink} />
          </button>
        </div>
        {MK_CHECK_KEYS.map((k, i) =>
        <MkCheckMini key={k} checkKey={k} check={checks[k] || { status: "pending" }} onClick={goControles} last={i === MK_CHECK_KEYS.length - 1} />
        )}
      </div>

      <div style={bento}>
        <div style={{ ...eyebrow, marginBottom: 6 }}>Informations</div>
        <MkMetaRow label="Niveau de risque">{riskMeta.label || "—"}</MkMetaRow>
        <MkMetaRow label="Type de contact">{contact.type === "buyer" ? "Acheteur" : contact.type === "seller" ? "Vendeur" : "Locataire"}</MkMetaRow>
        <MkMetaRow label="Dossier ouvert le">{fmtDateFR(dossier.createdAt, true)}</MkMetaRow>
        <MkMetaRow label="Dernier screening">{fmtDateFR(last, true)}</MkMetaRow>
        <MkMetaRow label="Échéance">{fmtDateFR(dossier.expiresAt, true)}</MkMetaRow>
        <MkMetaRow label="Référence" last><span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: 0.2 }}>{(dossier.id || "—").toUpperCase()}</span></MkMetaRow>
      </div>
    </div>);

};

// ─── Onglet Contrôles ───────────────────────────────────────────────────
const MkCheckCard = ({ checkKey, check, onMarkVerified }) => {
  const T = MK_useMT();const P = mkPal(T);
  const label = window.KYC_CHECK_LABELS[checkKey] || { title: checkKey, sub: "" };
  const verified = check.status === "verified" || check.status === "na";
  return (
    <div style={{ background: P.card, borderRadius: 20, padding: "20px 18px", border: `1px solid ${P.cardBorder}`, boxShadow: P.shadow, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: verified ? P.black : P.cardSubtle, display: "grid", placeItems: "center" }}>
          <MkIcon name={MK_CHECK_ICON[checkKey]} size={20} stroke={verified ? P.onAccent : P.black} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: P.ink, letterSpacing: -0.2 }}>{label.title}</h4>
            <MkStatusPill status={check.status} />
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: P.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>{label.sub}</p>
        </div>
      </div>
      {check.note &&
      <div style={{ background: P.cardSubtle, borderRadius: 12, padding: "11px 13px", fontSize: 12, color: P.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>{check.note}</div>
      }
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: P.muted, fontWeight: 500 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {check.at ? fmtTimeFR(check.at) : "En attente"}
          {check.by === "system" ? " · Système" : check.by && check.by !== "system" ? " · Gregory" : ""}
        </span>
        {!verified &&
        <button onClick={onMarkVerified} style={{
          border: 0, background: P.black, color: P.onAccent, fontFamily: "inherit", fontSize: 11.5, fontWeight: 800,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999,
          flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(11,12,14,0.4)"
        }}>
            <MkIcon name="check" size={12} stroke={P.onAccent} sw={2.3} />Marquer vérifié
          </button>
        }
      </div>
    </div>);

};

// ─── Onglet Documents ───────────────────────────────────────────────────
const MkDocDownloadBtn = () => {
  const T = MK_useMT();const P = mkPal(T);
  const [state, setState] = React.useState("idle"); // idle · loading · done
  React.useEffect(() => {
    if (state === "loading") {const t = setTimeout(() => setState("done"), 900);return () => clearTimeout(t);}
    if (state === "done") {const t = setTimeout(() => setState("idle"), 1900);return () => clearTimeout(t);}
  }, [state]);
  const done = state === "done",loading = state === "loading";
  return (
    <button onClick={() => state === "idle" && setState("loading")} title="Télécharger"
    style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: loading ? "default" : "pointer", display: "grid", placeItems: "center", flexShrink: 0, background: done ? "#DCF1E6" : P.cardSubtle, transition: "background .2s ease" }}>
      <style>{`@keyframes mkDlBounce { 0%,100% { transform: translateY(-1px); } 50% { transform: translateY(2px); } }`}</style>
      {done ?
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#066B45" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4 10-12" /></svg> :

      <span style={{ display: "grid", placeItems: "center", animation: loading ? "mkDlBounce .6s ease infinite" : "none" }}>
          <MkIcon name="download" size={15} stroke={P.inkSoft} />
        </span>
      }
    </button>);

};
window.MkDocDownloadBtn = MkDocDownloadBtn;

// Portal : remonte un overlay au niveau du cadre écran (data-mk-root) pour
// échapper au containing-block créé par les cartes animées (transform).
const MkPortal = ({ children }) => {
  const ref = React.useRef(null);
  const [node, setNode] = React.useState(null);
  React.useLayoutEffect(() => {setNode(ref.current && ref.current.closest("[data-mk-root]"));}, []);
  return <span ref={ref} style={{ display: "none" }}>{node && window.ReactDOM.createPortal(children, node)}</span>;
};

const MkDocPreview = ({ doc, onClose }) => {
  const T = MK_useMT();const P = mkPal(T);
  const isImg = /\.(jpg|jpeg|png|heic)$/i.test(doc.name || "");
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(8,9,12,0.58)", display: "flex", padding: "clamp(16px, 5%, 56px)", animation: "mkFade .22s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ margin: "auto", width: "100%", maxWidth: 540, maxHeight: "100%", display: "flex", flexDirection: "column", background: P.card, borderRadius: 22, boxShadow: "0 40px 100px rgba(8,9,12,0.5)", overflow: "hidden", animation: "mkUp .3s cubic-bezier(.2,.8,.2,1) both" }}>
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 16px", flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: P.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <MkIcon name="file" size={18} stroke={P.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: P.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
            <div style={{ fontSize: 11.5, color: P.muted, fontWeight: 600, marginTop: 1 }}>{doc.size} · ajouté le {fmtDateFR(doc.uploadedAt)}</div>
          </div>
          <MkDocDownloadBtn />
          <button onClick={onClose} title="Fermer" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: P.black, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.onAccent} strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {/* Aperçu de la page (maquette) */}
        <div className="mk-hscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 18px 18px", background: P.cardSubtle }}>
          <div style={{ background: "#FFFFFF", borderRadius: 8, boxShadow: "0 12px 30px rgba(8,9,12,0.14)", padding: "30px 28px", marginTop: 4, minHeight: 360, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div style={{ width: 46, height: 16, borderRadius: 4, background: "#0B0C0E" }}></div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0B0C0E", letterSpacing: -0.3, marginBottom: 4 }}>{doc.name.replace(/\.[a-z]+$/i, "")}</div>
            <div style={{ fontSize: 11.5, color: "#7A8088", fontWeight: 600, marginBottom: 20 }}>Pièce KYC · LBA — vérification d'identité</div>
            {isImg ?
            <div style={{ flex: 1, minHeight: 220, borderRadius: 10, background: "repeating-linear-gradient(135deg, #EDEFF3 0 14px, #F6F7F9 14px 28px)", display: "grid", placeItems: "center" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9AA0A8", letterSpacing: 0.3 }}>aperçu numérisé</span>
              </div> :

            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {[100, 92, 96, 70, 100, 88, 94, 60].map((w, i) =>
              <div key={i} style={{ height: 9, width: `${w}%`, borderRadius: 4, background: i === 3 || i === 7 ? "#EDEFF3" : "#F1F3F6" }}></div>
              )}
              </div>
            }
          </div>
        </div>
      </div>
    </div>);

};

// ─── Modal · Ajouter une pièce (Sugar Pure) ─────────────────────────────
const MK_DOC_TYPES = [
{ id: "identite", label: "Pièce d'identité", hint: "Passeport · CNI · permis", file: "piece-identite.pdf" },
{ id: "domicile", label: "Justificatif de domicile", hint: "Facture · attestation", file: "justificatif-domicile.pdf" },
{ id: "funds", label: "Source des fonds", hint: "Attestation bancaire", file: "attestation-source-fonds.pdf" },
{ id: "rc", label: "Extrait du registre", hint: "Registre du commerce", file: "extrait-registre.pdf" },
{ id: "autre", label: "Autre pièce", hint: "Document libre", file: "document.pdf" }];


const MkDocAddModal = ({ onClose, onAdd }) => {
  const T = MK_useMT();const P = mkPal(T);
  const [type, setType] = React.useState(null);
  const [file, setFile] = React.useState(null);
  const pick = () => {const t = MK_DOC_TYPES.find((x) => x.id === type);setFile({ name: t ? t.file : "document.pdf", size: (1 + Math.random() * 2.4).toFixed(1) + " Mo" });};
  const submit = () => {
    if (!type) return;
    const t = MK_DOC_TYPES.find((x) => x.id === type);
    onAdd({ id: "d" + Date.now(), name: file ? file.name : t.file, size: file ? file.size : "1.2 Mo", uploadedAt: new Date().toISOString() });
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(8,9,12,0.58)", display: "flex", padding: "clamp(16px, 5%, 56px)", animation: "mkFade .22s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ margin: "auto", width: "100%", maxWidth: 460, background: P.card, borderRadius: 24, boxShadow: "0 40px 100px rgba(8,9,12,0.5)", overflow: "hidden", animation: "mkUp .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 18px 4px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: P.ink, letterSpacing: -0.4 }}>Ajouter une pièce</h3>
            <div style={{ fontSize: 12, color: P.muted, fontWeight: 600, marginTop: 2 }}>Joindre un document au dossier KYC</div>
          </div>
          <button onClick={onClose} title="Fermer" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: P.black, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.onAccent} strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "14px 18px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 9 }}>Type de pièce</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {MK_DOC_TYPES.map((t) => {
              const on = type === t.id;
              return (
                <button key={t.id} onClick={() => setType(t.id)} style={{
                  width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer", border: 0,
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14,
                  background: P.cardSubtle, boxShadow: on ? `0 0 0 2px ${P.black} inset` : "none", transition: "box-shadow .15s"
                }}>
                  <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
                    background: on ? P.black : "transparent", boxShadow: on ? "none" : `0 0 0 2px ${P.ghost} inset` }}>
                    {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P.onAccent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4 10-12" /></svg>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: P.ink, letterSpacing: -0.2 }}>{t.label}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: P.muted, fontWeight: 500, marginTop: 1 }}>{t.hint}</span>
                  </span>
                </button>);

            })}
          </div>
          <button onClick={pick} style={{
            width: "100%", fontFamily: "inherit", cursor: "pointer", border: `2px dashed ${file ? P.black : P.cardBorder}`,
            background: file ? P.cardSubtle : "transparent", borderRadius: 16, padding: "18px 16px", marginBottom: 18,
            display: "flex", alignItems: "center", gap: 13, transition: "border-color .15s, background .15s"
          }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: P.card, boxShadow: P.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <MkIcon name={file ? "file" : "upload"} size={18} stroke={P.ink} />
            </span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: P.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file ? file.name : "Glissez un fichier ou parcourir"}</span>
              <span style={{ display: "block", fontSize: 11.5, color: P.muted, fontWeight: 500, marginTop: 1 }}>{file ? file.size + " · prêt à joindre" : "PDF, JPG ou PNG — 10 Mo max"}</span>
            </span>
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <MkGhostBtn onClick={onClose}>Annuler</MkGhostBtn>
            <div style={{ flex: 1 }} />
            <MkBlackBtn onClick={submit} disabled={!type}>Ajouter la pièce</MkBlackBtn>
          </div>
        </div>
      </div>
    </div>);

};

// ─── Modal · Signaler un risque (LBA, Sugar Pure) ───────────────────────
const MK_RISK_MOTIFS = [
{ id: "funds", label: "Source des fonds incohérente" },
{ id: "pep", label: "Personne politiquement exposée" },
{ id: "doc", label: "Document douteux ou falsifié" },
{ id: "behavior", label: "Comportement / réticence du client" },
{ id: "other", label: "Autre motif" }];

const MK_RISK_LEVELS = [
{ id: "low", label: "Faible", tone: "#0891B2" },
{ id: "mid", label: "Moyen", tone: "#C45A00" },
{ id: "high", label: "Élevé", tone: "#B42318" }];

const MkRiskModal = ({ onClose, onSubmit }) => {
  const T = MK_useMT();const P = mkPal(T);
  const [motif, setMotif] = React.useState(null);
  const [level, setLevel] = React.useState("mid");
  const [note, setNote] = React.useState("");
  const submit = () => {
    if (!motif) return;
    const m = MK_RISK_MOTIFS.find((x) => x.id === motif);
    const l = MK_RISK_LEVELS.find((x) => x.id === level);
    onSubmit({ motif, motifLabel: m.label, level, levelLabel: l.label, tone: l.tone, note: note.trim(), at: new Date().toISOString() });
  };
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(8,9,12,0.58)", display: "flex", padding: "clamp(16px, 5%, 56px)", animation: "mkFade .22s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ margin: "auto", width: "100%", maxWidth: 460, maxHeight: "100%", overflowY: "auto", background: P.card, borderRadius: 24, boxShadow: "0 40px 100px rgba(8,9,12,0.5)", animation: "mkUp .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 18px 4px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.mode === "dark" ? "rgba(180,35,24,0.18)" : "rgba(180,35,24,0.08)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: P.ink, letterSpacing: -0.4 }}>Signaler un risque</h3>
          </div>
          <button onClick={onClose} title="Fermer" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: P.cardSubtle, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "14px 18px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 9 }}>Motif</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {MK_RISK_MOTIFS.map((m) => {
              const on = motif === m.id;
              return (
                <button key={m.id} onClick={() => setMotif(m.id)} style={{
                  width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer", border: 0,
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14,
                  background: P.cardSubtle, boxShadow: on ? `0 0 0 2px ${P.black} inset` : "none", transition: "box-shadow .15s"
                }}>
                  <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
                    background: on ? P.black : "transparent", boxShadow: on ? "none" : `0 0 0 2px ${P.ghost} inset` }}>
                    {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P.onAccent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4 10-12" /></svg>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: P.ink, letterSpacing: -0.2 }}>{m.label}</span>
                </button>);

            })}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 9 }}>Niveau de risque</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {MK_RISK_LEVELS.map((l) => {
              const on = level === l.id;
              return (
                <button key={l.id} onClick={() => setLevel(l.id)} style={{
                  flex: 1, height: 42, borderRadius: 12, border: 0, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 800, letterSpacing: -0.2, transition: "all .15s",
                  color: on ? "#fff" : P.inkSoft, background: on ? l.tone : P.cardSubtle
                }}>{l.label}</button>);

            })}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 9 }}>Note (optionnel)</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Précisez les éléments observés…" rows={3} style={{
            width: "100%", boxSizing: "border-box", resize: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 500,
            color: P.ink, background: P.cardSubtle, border: 0, borderRadius: 14, padding: "12px 13px", outline: "none", marginBottom: 18, lineHeight: 1.45
          }} />
          <div style={{ display: "flex", gap: 10 }}>
            <MkGhostBtn onClick={onClose}>Annuler</MkGhostBtn>
            <div style={{ flex: 1 }} />
            <button onClick={submit} disabled={!motif} style={{
              height: 46, padding: "0 22px", borderRadius: 999, border: 0, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800,
              color: "#fff", background: motif ? "#B42318" : P.ghost, cursor: motif ? "pointer" : "default",
              display: "inline-flex", alignItems: "center", gap: 8, boxShadow: motif ? "0 8px 20px rgba(180,35,24,0.28)" : "none"
            }}>Signaler</button>
          </div>
        </div>
      </div>
    </div>);

};

const MkDocsSection = ({ docs }) => {
  const T = MK_useMT();const P = mkPal(T);
  const [preview, setPreview] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const [extra, setExtra] = React.useState([]);
  const allDocs = [...extra, ...docs];
  return (
    <div style={{ background: P.card, borderRadius: 20, padding: "20px 18px", border: `1px solid ${P.cardBorder}`, boxShadow: P.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: allDocs.length ? 16 : 0 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: P.muted, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 }}>Pièces du dossier</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.ink, letterSpacing: -0.3 }}>Documents joints</h3>
        </div>
        <MkGhostBtn onClick={() => setAdding(true)} icon={<MkIcon name="upload" size={14} stroke={P.inkSoft} />}>Ajouter</MkGhostBtn>
      </div>
      {allDocs.length === 0 ?
      <div style={{ padding: "28px 16px", textAlign: "center", background: P.cardSubtle, borderRadius: 14, color: P.muted, fontSize: 12.5, fontWeight: 500, lineHeight: 1.5 }}>
          Aucun document joint pour l'instant.<br />Demandez les pièces au contact pour démarrer.
        </div> :

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allDocs.map((d) =>
        <button key={d.id} onClick={() => setPreview(d)} style={{ width: "100%", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 14, background: P.cardSubtle, border: 0, cursor: "pointer" }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, background: P.card, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <MkIcon name="file" size={17} stroke={P.inkSoft} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: P.muted, fontWeight: 500, marginTop: 1 }}>{d.size} · {fmtDateFR(d.uploadedAt)}</div>
              </div>
              <span title="Aperçu" style={{ width: 36, height: 36, borderRadius: 999, background: P.card, display: "grid", placeItems: "center", boxShadow: P.shadowSm, flexShrink: 0 }}>
                <MkIcon name="eye" size={14} stroke={P.inkSoft} />
              </span>
            </button>
        )}
        </div>
      }
      {preview && <MkPortal><MkDocPreview doc={preview} onClose={() => setPreview(null)} /></MkPortal>}
      {adding && <MkPortal><MkDocAddModal onClose={() => setAdding(false)} onAdd={(d) => setExtra((e) => [d, ...e])} /></MkPortal>}
    </div>);

};

// ─── Onglet Audit · A+B togglable (Timeline ↔ Registre LBA) ──────────────
const MkAuditSeg = ({ view, setView }) => {
  const T = MK_useMT();const P = mkPal(T);
  const opts = [
  { v: "timeline", label: "Timeline", icon: <><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><path d="M6 8.4v7.2M12 6h7M12 18h7" /></> },
  { v: "registre", label: "Registre", icon: <path d="M4 6h16M4 12h16M4 18h16" /> }];

  return (
    <div style={{ display: "inline-flex", padding: 3, background: P.cardSubtle, borderRadius: 999, flexShrink: 0 }}>
      {opts.map((o) => {
        const on = view === o.v;
        return (
          <button key={o.v} onClick={() => setView(o.v)} style={{
            appearance: "none", border: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1,
            color: on ? P.onAccent : P.muted, background: on ? P.black : "transparent",
            padding: "7px 13px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: on ? "0 6px 16px -6px rgba(11,12,14,0.45)" : "none", transition: "color .18s, background .18s"
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>{o.icon}</svg>
            {o.label}
          </button>);

      })}
    </div>);

};

const MkAuditTrail = ({ dossier }) => {
  const T = MK_useMT();const P = mkPal(T);
  const [view, setView] = React.useState("timeline");
  const events = [];
  if (dossier.createdAt) events.push({ at: dossier.createdAt, label: "Dossier ouvert", actor: "Gregory" });
  Object.entries(dossier.checks).forEach(([key, check]) => {
    if (check.at) {
      const lab = window.KYC_CHECK_LABELS[key]?.title || key;
      const action = check.status === "verified" ? "validé" : check.status === "na" ? "non applicable" : "marqué " + check.status;
      events.push({ at: check.at, label: `${lab} ${action}`, actor: check.by === "system" ? "Système" : "Gregory", note: check.note });
    }
  });
  if (dossier.verifiedAt) events.push({ at: dossier.verifiedAt, label: "Dossier clôturé", actor: "Gregory" });
  (dossier.riskEvents || []).forEach((r) => events.push({ at: r.at, label: `Risque signalé — ${r.motifLabel} · niveau ${r.levelLabel.toLowerCase()}`, actor: "Gregory", note: r.note || undefined, risk: true }));
  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  const fmt = (iso) => new Date(iso).toLocaleString("fr-CH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
  const initials = (a) => a === "Système" ? "Σ" : a.slice(0, 1).toUpperCase();

  return (
    <div style={{ background: P.card, borderRadius: 20, padding: "20px 18px", border: `1px solid ${P.cardBorder}`, boxShadow: P.shadow }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.ink, letterSpacing: -0.3 }}>Piste d'audit</h3>
        </div>
        {events.length > 0 && <MkAuditSeg view={view} setView={setView} />}
      </div>

      {events.length === 0 ?
      <div style={{ padding: "28px 16px", textAlign: "center", background: P.cardSubtle, borderRadius: 14, color: P.muted, fontSize: 12.5, fontWeight: 500 }}>Aucune action enregistrée — dossier non démarré.</div> :
      view === "timeline" ?
      <div key="tl" style={{ display: "flex", flexDirection: "column", animation: "mkFade .35s cubic-bezier(.2,.8,.2,1) both" }}>
          {events.map((ev, i) => {
          const last = i === events.length - 1;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, paddingBottom: last ? 0 : 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 11, height: 11, borderRadius: 999, flexShrink: 0, marginTop: 2,
                  background: last ? P.card : P.black,
                  border: last ? `2px solid ${P.black}` : "0",
                  boxShadow: last ? "none" : `0 0 0 4px ${T.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(11,12,14,0.07)"}` }} />
                  {!last && <div style={{ width: 2, flex: 1, background: P.cardSubtle, marginTop: 5, minHeight: 18 }} />}
                </div>
                <div style={{ paddingTop: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: P.ink, letterSpacing: -0.15, marginBottom: 3 }}>{ev.label}</div>
                  <div style={{ fontSize: 11.5, color: P.muted, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(ev.at)} · {ev.actor}</div>
                  {ev.note && <div style={{ fontSize: 12, color: P.inkSoft, fontWeight: 500, marginTop: 7, lineHeight: 1.45, background: P.cardSubtle, borderRadius: 11, padding: "9px 11px" }}>{ev.note}</div>}
                </div>
              </div>);

        })}
        </div> :

      <div key="reg" style={{ animation: "mkFade .35s cubic-bezier(.2,.8,.2,1) both", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                {["Horodatage", "Action", "Auteur"].map((h) =>
              <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: P.muted, padding: "0 9px 9px", borderBottom: `1.5px solid ${P.ink}`, whiteSpace: "nowrap" }}>{h}</th>
              )}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
              const last = i === events.length - 1;
              const sys = ev.actor === "Système";
              return (
                <tr key={i}>
                    <td style={{ padding: "12px 9px", borderBottom: last ? 0 : `1px solid ${P.cardSubtle}`, verticalAlign: "top" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: P.inkSoft, whiteSpace: "nowrap" }}>{fmtDate(ev.at)}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: P.ghost, marginTop: 1 }}>{fmtTime(ev.at)}</div>
                    </td>
                    <td style={{ padding: "12px 9px", borderBottom: last ? 0 : `1px solid ${P.cardSubtle}`, verticalAlign: "top" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, letterSpacing: -0.15 }}>{ev.label}</div>
                      {ev.note && <div style={{ fontSize: 11, fontWeight: 500, color: P.muted, marginTop: 2, lineHeight: 1.4 }}>{ev.note}</div>}
                    </td>
                    <td style={{ padding: "12px 9px", borderBottom: last ? 0 : `1px solid ${P.cardSubtle}`, verticalAlign: "top" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: P.inkSoft, whiteSpace: "nowrap" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 800, flexShrink: 0,
                        background: sys ? P.black : P.cardSubtle, color: sys ? P.onAccent : P.muted }}>{initials(ev.actor)}</span>
                        {ev.actor}
                      </span>
                    </td>
                  </tr>);

            })}
            </tbody>
          </table>
        </div>
      }
    </div>);

};

// ─── Vue détail ─────────────────────────────────────────────────────────
// ─── Vue détail — panneaux (header + onglets sont fixes, gérés par l'écran) ──
const MkDetailPanels = ({ dossier, contact, tab, setTab, onMarkVerified, onMarkAll }) => {
  const docs = dossier.documents || [];
  return (
    <div key={tab} style={{ animation: "mkFade .4s cubic-bezier(.2,.8,.2,1) both" }}>
      {tab === "synthese" && <MkSynthese dossier={dossier} contact={contact} onMarkAll={onMarkAll} goControles={() => setTab("controles")} />}
      {tab === "controles" &&
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {MK_CHECK_KEYS.map((k) =>
        <MkCheckCard key={k} checkKey={k} check={dossier.checks[k] || { status: "pending" }} onMarkVerified={() => onMarkVerified(k)} />
        )}
        </div>
      }
      {tab === "documents" && <MkDocsSection docs={docs} />}
      {tab === "audit" && <MkAuditTrail dossier={dossier} />}
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  CHROME
// ═══════════════════════════════════════════════════════════════════════
const MkTopBar = ({ inDetail, onBack, onMenu, menuOpen }) => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <header style={{ paddingTop: 54, paddingLeft: 18, paddingRight: 18, paddingBottom: 10, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${P.cardBorder}`, background: P.card, boxShadow: P.shadowSm, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <MkIcon name="arrowL" size={18} stroke={P.ink} sw={2} />
      </button>
      <div style={{ flex: 1 }}></div>
      {inDetail ?
      <button onClick={onMenu} style={{ width: 40, height: 40, borderRadius: 999, border: menuOpen ? "0" : `1px solid ${P.cardBorder}`, background: menuOpen ? P.black : P.card, boxShadow: P.shadowSm, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, transition: "background .2s ease" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill={menuOpen ? P.onAccent : P.ink} aria-hidden="true">
            <circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" />
          </svg>
        </button> :
      null}
    </header>);

};

// ─── Menu d'actions du dossier KYC (popover ancré sous le bouton •••) ─────
// Délègue au composant partagé window.SgActionMenu (crm-action-menu.jsx).
const MK_KYC_ACTIONS = [
{ id: "rescreen", icon: "refresh", label: "Re-screener le dossier" },
{ id: "export", icon: "download", label: "Exporter le rapport" },
{ id: "contact", icon: "id", label: "Voir le contact" },
{ id: "risk", icon: "ban", label: "Signaler un risque", danger: true, divider: true }];

const MkActionMenu = ({ onClose, onAction }) => {
  const T = MK_useMT();const P = mkPal(T);
  const Menu = window.SgActionMenu;
  if (!Menu) return null;
  return (
    <Menu
      items={MK_KYC_ACTIONS}
      onAction={onAction}
      onClose={onClose}
      mode="overlay"
      top={96}
      right={18}
      pal={{ card: P.card, ink: P.ink, inkSoft: P.inkSoft, hair: P.hair, overlay: "rgba(11,12,14,0.32)" }}
      dark={T.mode === "dark"}
      renderIcon={(name, opt) => <MkIcon name={name} {...opt} />} />);


};

const MK_TABS = [
{ id: "today", label: "Aujourd'hui", icon: "home" },
{ id: "pipeline", label: "Pipeline", icon: "trend" },
{ id: "matching", label: "Matching", icon: "spark" },
{ id: "agenda", label: "Agenda", icon: "cal" },
{ id: "more", label: "Plus", icon: "menu" }];

const MkTabBar = () => {
  const T = MK_useMT();const P = mkPal(T);
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${P.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {MK_TABS.map((tb) => {
        const on = tb.id === "more"; // KYC vit dans « Plus »
        return (
          <button key={tb.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <window.MIcon name={tb.icon} size={22} sw={on ? 2.2 : 1.9} color={on ? P.ink : P.ghost} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? P.ink : P.muted, whiteSpace: "nowrap" }}>{tb.label}</span>
          </button>);

      })}
    </nav>);

};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═══════════════════════════════════════════════════════════════════════
const MobileKycScreen = ({ dark = false, initialDossierId = null, onGo }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const P = mkPal(T);
  const [selectedId, setSelectedId] = React.useState(initialDossierId);
  const [filter, setFilter] = React.useState("all");
  const [detailTab, setDetailTab] = React.useState("synthese");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mkToast, setMkToast] = React.useState(null);
  const mkToastRef = React.useRef(null);
  const showMkToast = (t) => {setMkToast(t);clearTimeout(mkToastRef.current);mkToastRef.current = setTimeout(() => setMkToast(null), 2200);};
  const fileInputRef = React.useRef(null);
  const [mkImporting, setMkImporting] = React.useState(false);
  const [riskModal, setRiskModal] = React.useState(false);

  const submitRisk = (payload) => {
    setRiskModal(false);
    if (selectedId) {
      const dossier = (window.KYC_DOSSIERS || []).find((d) => d.id === selectedId);
      if (dossier) {
        dossier.riskFlag = payload;
        dossier.riskEvents = [...(dossier.riskEvents || []), payload];
        bump();
      }
    }
    showMkToast("Risque signalé à la conformité");
  };

  const exportReport = () => {
    const d = selectedId ? (window.KYC_DOSSIERS || []).find((x) => x.id === selectedId) : null;
    const c = d ? (window.CRM_CONTACTS || []).find((x) => x.id === d.contactId) : null;
    if (!d) {showMkToast("Aucun dossier sélectionné");return;}
    const fmtD = (iso) => iso ? new Date(iso).toLocaleDateString("fr-CH") : "—";
    const lines = [];
    lines.push("MEGGA — RAPPORT KYC / LBA");
    lines.push("═".repeat(40));
    lines.push(`Contact   : ${c ? c.firstName + " " + c.lastName : d.contactId}`);
    lines.push(`Dossier   : ${d.id}`);
    lines.push(`Statut    : ${d.status}`);
    lines.push(`Créé le   : ${fmtD(d.createdAt)}`);
    lines.push(`Vérifié   : ${fmtD(d.verifiedAt)}`);
    lines.push(`Expire le : ${fmtD(d.expiresAt)}`);
    lines.push("");
    lines.push("VÉRIFICATIONS");
    lines.push("─".repeat(40));
    Object.keys(d.checks || {}).forEach((k) => {
      const ch = d.checks[k];
      lines.push(`• ${k.padEnd(22)} ${ch.status}${ch.at ? "  (" + fmtD(ch.at) + ")" : ""}`);
    });
    lines.push("");
    lines.push(`Édité le ${new Date().toLocaleString("fr-CH")} — MEGGA Real Estate`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;a.download = `KYC_${d.id}.txt`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMkToast("Rapport KYC exporté");
  };

  const handleImportFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setMkImporting(true);
    setTimeout(() => {
      setMkImporting(false);
      const name = f.name.length > 26 ? f.name.slice(0, 23) + "…" : f.name;
      showMkToast(`Pièce importée — ${name}`);
    }, 900);
  };

  const handleMkAction = (id) => {
    setMenuOpen(false);
    if (id === "export") {exportReport();return;}
    if (id === "import") {if (fileInputRef.current) fileInputRef.current.click();return;}
    if (id === "contact") {
      if (onGo) {showMkToast("Ouverture de la fiche contact…");setTimeout(() => onGo("contact"), 350);}
      return;
    }
    if (id === "risk") {setRiskModal(true);return;}
    const L = { rescreen: "Re-screening lancé…" };
    showMkToast(L[id] || "");
  };
  const [, setRev] = React.useState(0);
  const bump = () => setRev((x) => x + 1);
  const mainRef = React.useRef(null);

  const markVerified = (checkKey) => {
    if (!selectedId) return;
    const dossier = (window.KYC_DOSSIERS || []).find((d) => d.id === selectedId);
    if (!dossier) return;
    const now = new Date().toISOString();
    const prevNote = dossier.checks[checkKey]?.note;
    dossier.checks[checkKey] = { status: "verified", at: now, by: "agt-1", note: prevNote || "Vérifié manuellement par l'agent." };
    const allChecks = Object.values(dossier.checks);
    const allDone = allChecks.every((c) => c.status === "verified" || c.status === "na");
    if (allDone) {
      dossier.status = "verified";dossier.verifiedAt = now;
      const exp = new Date();exp.setFullYear(exp.getFullYear() + 1);dossier.expiresAt = exp.toISOString();
    } else if (dossier.status === "none") {
      dossier.status = "pending";dossier.createdAt = dossier.createdAt || now;
    }
    bump();
  };
  const markAll = () => {
    if (!selectedId) return;
    const dossier = (window.KYC_DOSSIERS || []).find((d) => d.id === selectedId);
    if (!dossier) return;
    Object.keys(dossier.checks).forEach((k) => {
      const c = dossier.checks[k];
      if (c.status !== "verified" && c.status !== "na") markVerified(k);
    });
  };

  const openDossier = (id) => {setDetailTab("synthese");setSelectedId(id);if (mainRef.current) mainRef.current.scrollTop = 0;};
  const back = () => {if (selectedId) {if (mainRef.current) mainRef.current.scrollTop = 0;setSelectedId(null);setMenuOpen(false);} else if (onGo) {onGo("more");}};

  const selected = selectedId ? (window.KYC_DOSSIERS || []).find((d) => d.id === selectedId) : null;
  const selectedContact = selected ? (window.CRM_CONTACTS || []).find((c) => c.id === selected.contactId) : null;
  const inDetail = !!(selected && selectedContact);

  return (
    <window.MTCtx.Provider value={T}>
      <div data-mk-root style={{ height: "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", background: P.pageBg, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink }}>
        <style>{`
          @keyframes mkUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
          @keyframes mkFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
          @keyframes mkSpin { to { transform: rotate(360deg); } }
          @keyframes mkMenu { from { transform: scale(.92) translateY(-6px); } to { transform: none; } }
          .mkUp { opacity: 1; }
          @media (prefers-reduced-motion: no-preference) { .mkUp { animation: mkUp .5s cubic-bezier(.2,.8,.2,1) var(--d, 40ms) both; } }
          .mk-halo-high { box-shadow: 0 0 16px 1px rgba(239,68,68,0.5); }
          .mk-hscroll::-webkit-scrollbar { display: none; }
          .mk-hscroll { scrollbar-width: none; }
        `}</style>

        <MkTopBar inDetail={inDetail} onBack={back} onMenu={() => setMenuOpen((v) => !v)} menuOpen={menuOpen} />

        {inDetail ?
        <main ref={mainRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 18px 26px", WebkitOverflowScrolling: "touch" }}>
            <div style={{ paddingTop: 6 }}>
              <MkDetailHeader dossier={selected} contact={selectedContact} />
            </div>
            <div style={{ position: "sticky", top: 0, zIndex: 5, background: P.pageBg, margin: "0 -18px" }}>
              <MkSegBar tabs={MK_DETAIL_TABS} active={detailTab} onChange={setDetailTab} />
            </div>
            <MkDetailPanels dossier={selected} contact={selectedContact} tab={detailTab} setTab={setDetailTab} onMarkVerified={markVerified} onMarkAll={markAll} />
          </main> :

        <main ref={mainRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 18px 26px", WebkitOverflowScrolling: "touch" }}>
            <MkListView onOpen={openDossier} filter={filter} setFilter={setFilter} />
          </main>
        }

        <MkTabBar />
        {menuOpen && inDetail && <MkActionMenu onClose={() => setMenuOpen(false)} onAction={handleMkAction} />}
        {riskModal && <MkPortal><MkRiskModal onClose={() => setRiskModal(false)} onSubmit={submitRisk} /></MkPortal>}
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" onChange={handleImportFile} style={{ display: "none" }} />
        {mkImporting &&
        <div style={{ position: "absolute", inset: 0, zIndex: 45, display: "grid", placeItems: "center", background: "rgba(11,12,14,0.32)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: P.card, color: P.ink, fontSize: 13.5, fontWeight: 700, padding: "14px 20px", borderRadius: 16, boxShadow: P.shadow }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${P.hair}`, borderTopColor: P.black, display: "inline-block", animation: "mkSpin .7s linear infinite" }}></span>
              Import en cours…
            </div>
          </div>
        }
        {mkToast &&
        <div style={{ position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 40, background: P.black, color: P.onAccent, fontSize: 13, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 12px 30px rgba(11,12,14,0.30)", whiteSpace: "nowrap", animation: "mkFade .26s cubic-bezier(.2,.8,.2,1) both" }}>{mkToast}</div>
        }
      </div>
    </window.MTCtx.Provider>);

};

window.MobileKycScreen = MobileKycScreen;

// Primitives réutilisées par la version TABLETTE (master-detail). Les scripts
// Babel ne partageant pas leur scope, on expose ce dont crm-kyc-tablet.jsx a besoin.
Object.assign(window, {
  mkPal, MkIcon, MkGauge, MkStatusPill, MkRiskPill,
  MkDetailHeader, MkSegBar, MkDetailPanels, MK_DETAIL_TABS,
  MkSynthese, MkCheckCard, MkDocsSection, MkAuditTrail,
  MkBlackBtn, MkGhostBtn, MkAnimBtn,
  MK_CHECK_KEYS, MK_CHECK_ICON, mkFmtDateFR: fmtDateFR
});