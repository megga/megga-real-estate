// MEGGA CRM — SgActionMenu (menu d'actions ••• partagé, Sugar Pure)
// ════════════════════════════════════════════════════════════════════════
// Popover d'actions secondaires réutilisable sur N'IMPORTE quelle carte/ligne
// (deal, contact, bien, document, RDV, tâche…). Grammaire Sugar Pure :
//   • surface blanche pure, radius 18, ombre douce (zéro bordure décorative)
//   • overlay 32 %, animation scale top-right
//   • 3–5 actions + 1 action destructive séparée en bas (rouge sobre)
//
// API
//   <SgActionMenu
//     items={[{ id, icon, label, danger, disabled, divider }]}
//     onAction={(id) => …}      // appelé au clic d'une action
//     onClose={() => …}         // overlay / Échap
//     pal={…}                   // palette normalisée (optionnelle, voir defaults)
//     dark={false}              // pour dériver une palette par défaut
//     renderIcon={(name,{size,stroke,sw}) => …}  // optionnel — sinon set interne
//     mode="overlay"|"fixed"    // overlay = absolu dans un cadre (mobile)
//                               // fixed   = ancré à anchorRect (desktop)
//     anchorRect={DOMRect}      // requis si mode="fixed"
//     top, right                // ancrage overlay (def 96 / 18)
//     width                     // def 244
//   />
//
// Exposé : window.SgActionMenu
// ════════════════════════════════════════════════════════════════════════

// ─── Jeu d'icônes interne (stroke linéaire, zero emoji) ──────────────────
const SGAM_ICONS = {
  refresh:  <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4" />,
  download: <><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></>,
  upload:   <><path d="M12 21V9" /><path d="m7 13 5-5 5 5" /><path d="M5 3h14" /></>,
  id:       <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M13 9h5M13 13h5M5.5 15.2c.6-1.4 4.4-1.4 5 0" /></>,
  contact:  <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20c.7-3.6 12.3-3.6 13 0" /></>,
  phone:    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z" />,
  mail:     <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  edit:     <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  copy:     <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  share:    <><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" /></>,
  cal:      <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  clock:    <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check:    <path d="m5 13 4 4 10-12" />,
  stage:    <><path d="M3 17l6-6 4 4 7-7" /><path d="M14 8h6v6" /></>,
  archive:  <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M9.5 13h5" /></>,
  trash:    <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>,
  ban:      <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
  flag:     <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  user:     <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20c.7-3.6 12.3-3.6 13 0" /></>,
  link:     <><path d="M9 13a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-5.7-5.7L10 7" /><path d="M15 11a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 5.7 5.7L14 17" /></>,
  plus:     <path d="M12 5v14M5 12h14" />,
  searchplus: <><circle cx="10.5" cy="10.5" r="6" /><path d="m20 20-4.3-4.3" /><path d="M10.5 8v5M8 10.5h5" /></>,
  dots:     <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  sort:     <><path d="M7 4v15M7 4l-3 3.2M7 4l3 3.2" /><path d="M14 7h6M14 12h4M14 17h2" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" /></>,
  sliders:  <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></>,
};

const SgamIcon = ({ name, size = 18, stroke = "currentColor", sw = 1.85 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
    {SGAM_ICONS[name] || SGAM_ICONS.dots}
  </svg>
);

// ─── Palette normalisée par défaut (clair / sombre) ──────────────────────
const sgamPal = (pal, dark) => {
  const base = dark
    ? { card: "#171724", ink: "#ECEDF3", inkSoft: "#B5B7C4", hair: "rgba(255,255,255,0.07)",
        overlay: "rgba(0,0,4,0.5)", danger: "#E0738C",
        shadow: "0 24px 60px rgba(0,0,0,0.5)" }
    : { card: "#FFFFFF", ink: "#0B0C0E", inkSoft: "#3A3D44", hair: "rgba(15,23,42,0.07)",
        overlay: "rgba(11,12,14,0.32)", danger: "#8E1F3D",
        shadow: "0 24px 60px rgba(15,23,42,0.22), 0 4px 14px rgba(15,23,42,0.10)" };
  return { ...base, ...(pal || {}) };
};

// ─── Composant ───────────────────────────────────────────────────────────
const SgActionMenu = ({
  items = [],
  onAction,
  onClose,
  pal,
  dark = false,
  renderIcon,
  mode = "overlay",
  anchorRect = null,
  top = 96,
  right = 18,
  width = 244,
  title = null,
  subtitle = null,
  sheetStyle = null,
}) => {
  const P = sgamPal(pal, dark);
  const drawIcon = renderIcon || ((name, opt) => <SgamIcon name={name} {...opt} />);

  // Fermeture au clavier (Échap)
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Row = ({ it, last }) => {
    const danger = !!it.danger;
    const tone = it.disabled ? P.inkSoft : danger ? P.danger : P.ink;
    return (
      <button
        onClick={() => { if (it.disabled) return; onAction && onAction(it.id); }}
        disabled={it.disabled}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 13,
          padding: "12px 15px", border: 0, background: "transparent",
          cursor: it.disabled ? "default" : "pointer", fontFamily: "inherit",
          textAlign: "left", opacity: it.disabled ? 0.5 : 1,
          borderTop: it.divider ? `1px solid ${P.hair}` : "none",
          transition: "background .12s ease",
        }}
        onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = danger ? (dark ? "rgba(224,115,140,0.10)" : "rgba(142,31,61,0.06)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(11,12,14,0.04)"); }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {drawIcon(it.icon, { size: 18, stroke: it.disabled ? P.inkSoft : danger ? P.danger : P.inkSoft, sw: 1.85 })}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: tone, whiteSpace: "nowrap" }}>{it.label}</span>
      </button>
    );
  };

  // Surface du popover (carte blanche, radius 18, ombre douce)
  const card = (extraStyle) => (
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        width, background: P.card, borderRadius: 18, boxShadow: P.shadow,
        overflow: "hidden", animation: "sgamMenu .22s cubic-bezier(.2,.9,.3,1.2) both",
        transformOrigin: "top right", ...extraStyle,
      }}>
      <style>{`
        @keyframes sgamFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sgamMenu { from { opacity: 0; transform: scale(.92) translateY(-6px) } to { opacity: 1; transform: none } }
      `}</style>
      {items.map((it, i) => <Row key={it.id || i} it={it} last={i === items.length - 1} />)}
    </div>
  );

  // ── Mode fixed : ancré au rectangle du déclencheur (desktop) ──
  if (mode === "fixed") {
    const r = anchorRect || { bottom: 60, right: width + 18 };
    const t = r.bottom + (window.scrollY || 0) + 8;
    const l = r.right + (window.scrollX || 0) - width;
    return (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1300, background: "transparent" }} />
        <div style={{ position: "absolute", top: t, left: Math.max(8, l), zIndex: 1301 }}>{card()}</div>
      </>
    );
  }

  // ── Mode sheet : action sheet en bas du cadre (mobile, listes) ──
  // Pas besoin de géométrie de carte : l'overlay assombrit tout l'écran et la
  // feuille glisse du bas. Idéal pour les actions d'un item de liste.
  if (mode === "sheet") {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div onClick={onClose} style={{ position: "absolute", inset: 0, background: P.overlay, animation: "sgamFade .18s ease both" }} />
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative", margin: "0 10px 12px", background: P.card,
            borderRadius: 22, boxShadow: P.shadow, overflow: "hidden",
            animation: "sgamSheet .26s cubic-bezier(.2,.9,.3,1.1) both",
            ...(sheetStyle || {}),
          }}>
          <style>{`
            @keyframes sgamFade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes sgamSheet { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
          `}</style>
          {title && (
            <div style={{ padding: "15px 17px 11px" }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, fontWeight: 600, color: P.inkSoft, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
            </div>
          )}
          <div style={{ borderTop: title ? `1px solid ${P.hair}` : "none" }}>
            {items.map((it, i) => <Row key={it.id || i} it={it} last={i === items.length - 1} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Mode overlay : absolu plein cadre (mobile dans device frame) ──
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: P.overlay, animation: "sgamFade .18s ease both" }} />
      <div style={{ position: "absolute", top, right }}>{card()}</div>
    </div>
  );
};

window.SgActionMenu = SgActionMenu;
window.SgamIcon = SgamIcon;
