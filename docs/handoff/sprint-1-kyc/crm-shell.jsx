// MEGGA CRM — Shared UI primitives (icons, sidebar, cmd+K, AI bubble, drawer)

const CRMIcon = ({ name, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 1.6 }) => {
  const paths = {
    search:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    plus:    <><path d="M12 5v14M5 12h14"/></>,
    today:   <><path d="M3 13c4-1 6-3 9-9 3 6 5 8 9 9-4 1-6 3-9 9-3-6-5-8-9-9Z"/></>,
    dash:    <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    contacts:<><circle cx="9" cy="8" r="3.5"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c.4-2 1.5-3 3-3s2.6 1 3 3"/></>,
    pipeline:<><path d="M4 6h6v4H4zM14 4h6v4h-6zM14 12h6v4h-6zM14 20h6"/><path d="M10 8h4M14 14h-4v6h4"/></>,
    matching:<><path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4 4 20"/><path d="M14 14l6 6"/><path d="M4 10 10 4"/></>,
    bien:    <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></>,
    chat:    <><path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.4A8 8 0 0 1 21 12Z"/></>,
    cal:     <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    support: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></>,
    kyc:     <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    docs:    <><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6M9 9h2"/></>,
    auto:    <><path d="m13 3-7 11h5l-1 7 7-11h-5l1-7Z"/></>,
    moon:    <><path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/></>,
    sun:     <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/></>,
    cog:     <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z"/></>,
    chevronD:<><path d="m6 9 6 6 6-6"/></>,
    chevronR:<><path d="m9 6 6 6-6 6"/></>,
    chevronL:<><path d="m15 6-6 6 6 6"/></>,
    chevronUD:<><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></>,
    spark:   <><path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/></>,
    bolt:    <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
    phone:   <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9Z"/></>,
    mail:    <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    msg:     <><path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.4A8 8 0 0 1 21 12Z"/></>,
    check:   <><path d="m5 13 4 4 10-12"/></>,
    x:       <><path d="m6 6 12 12M6 18 18 6"/></>,
    eye:     <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    risk:    <><path d="M12 4 2 20h20L12 4Z"/><path d="M12 10v5M12 18v.4"/></>,
    flag:    <><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></>,
    drag:    <><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></>,
    filter:  <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    arrowR:  <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    home:    <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></>,
    file:    <><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></>,
    download:<><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 21h14"/></>,
    layers:  <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></>,
    bell:    <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    share:   <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8 11 8-4M8 13l8 4"/></>,
    star:    <><path d="m12 3 2.6 6 6.4.6-4.8 4.4 1.4 6.4L12 17l-5.6 3.4 1.4-6.4L3 9.6 9.4 9 12 3Z"/></>,
    send:    <><path d="M22 3 11 14"/><path d="M22 3l-7 18-4-8-8-4 19-6Z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────
const CRMSidebar = ({ t, active, onNavigate, dark, setDark, collapsed, onCmd }) => {
  const itemPad = collapsed ? "10px 10px" : "8px 10px";
  const SECTIONS = [
    { label: "Principal", items: [
      { id: "today",     icon:"today",    name: "Aujourd'hui" },
      { id: "dashboard", icon:"dash",     name: "Dashboard" },
    ]},
    { label: "CRM", items: [
      { id: "contacts",  icon:"contacts", name: "Contacts" },
      { id: "pipeline",  icon:"pipeline", name: "Pipeline" },
      { id: "matching",  icon:"matching", name: "Matching" },
    ]},
    { label: "Biens", items: [
      { id: "biens",     icon:"bien",     name: "Mes biens" },
      { id: "biens-new", icon:"plus",     name: "Créer un bien" },
    ]},
    { label: "Communication", items: [
      { id: "chat",      icon:"chat",     name: "Chat" },
      { id: "calendar",  icon:"cal",      name: "Calendrier" },
    ]},
    { label: "Conformité", items: [
      { id: "kyc",       icon:"kyc",      name: "KYC" },
      { id: "docs",      icon:"docs",     name: "Documents" },
      { id: "auto",      icon:"auto",     name: "Automatisation" },
    ]},
  ];

  return (
    <aside style={{
      width: collapsed ? 60 : 224, flexShrink: 0,
      background: t.surface, borderRight: `1px solid ${t.border}`,
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "16px 12px" : "16px 16px", display:"flex", alignItems:"center", justifyContent: "space-between" }}>
        {!collapsed && <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: t.ink }}>MEGGA</span>}
        {collapsed && <span style={{ fontWeight: 800, fontSize: 14, color: t.ink }}>M</span>}
        {!collapsed && <button onClick={() => onNavigate("__toggleCollapse")} style={iconBtn(t)}><CRMIcon name="layers" size={14} /></button>}
      </div>

      {/* Search */}
      {!collapsed && (
        <div style={{ padding: "0 12px 8px" }}>
          <button onClick={onCmd} style={{
            width: "100%", height: 32, padding: "0 10px",
            display: "flex", alignItems: "center", gap: 8,
            background: t.surface2, border: `1px solid ${t.border}`,
            borderRadius: 8, color: t.muted, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", textAlign: "left",
          }}>
            <CRMIcon name="search" size={14} />
            <span style={{ flex: 1 }}>Rechercher…</span>
            <kbd style={kbd(t)}>⌘K</kbd>
          </button>
        </div>
      )}
      {!collapsed && (
        <div style={{ padding: "0 12px 8px" }}>
          <button style={{
            width: "100%", height: 32, padding: "0 10px",
            display: "flex", alignItems: "center", gap: 8,
            background: "transparent", border: `1px dashed ${t.borderStrong}`,
            borderRadius: 8, color: t.soft, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit",
          }}>
            <CRMIcon name="plus" size={14} />
            <span style={{ flex: 1, textAlign: "left" }}>Nouveau contact</span>
            <kbd style={kbd(t)}>⌘C</kbd>
          </button>
        </div>
      )}

      {/* Sections */}
      <div style={{ flex: 1, overflowY: "auto", padding: collapsed ? "4px 6px" : "4px 8px" }}>
        {SECTIONS.map(s => (
          <div key={s.label} style={{ marginTop: 14 }}>
            {!collapsed && (
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: 0.6,
                textTransform: "uppercase", padding: "0 8px 6px",
              }}>{s.label}</div>
            )}
            {s.items.map(it => {
              const isActive = active === it.id;
              return (
                <button key={it.id} onClick={() => onNavigate(it.id)}
                  title={collapsed ? it.name : undefined}
                  style={{
                    width: "100%", padding: itemPad, display: "flex", alignItems: "center", gap: 10,
                    background: isActive ? t.primarySoft : "transparent",
                    color: isActive ? t.primary : t.soft,
                    borderRadius: 8, border: 0, cursor: "pointer", fontSize: 13.5,
                    fontWeight: isActive ? 600 : 500, fontFamily: "inherit",
                    justifyContent: collapsed ? "center" : "flex-start",
                    marginBottom: 1,
                  }}>
                  <CRMIcon name={it.icon} size={16} />
                  {!collapsed && <span>{it.name}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ borderTop: `1px solid ${t.border}`, padding: collapsed ? "8px 6px" : "8px 10px" }}>
        <button onClick={() => setDark(!dark)} title="Mode" style={{
          width: "100%", padding: itemPad, display: "flex", alignItems: "center", gap: 10,
          background: "transparent", color: t.soft, borderRadius: 8, border: 0,
          cursor: "pointer", fontSize: 13, fontFamily: "inherit",
          justifyContent: collapsed ? "center" : "flex-start",
        }}>
          <CRMIcon name={dark ? "sun" : "moon"} size={16} />
          {!collapsed && <span>{dark ? "Mode clair" : "Mode sombre"}</span>}
        </button>
        <button style={{
          width: "100%", padding: itemPad, display: "flex", alignItems: "center", gap: 10,
          background: "transparent", color: t.soft, borderRadius: 8, border: 0,
          cursor: "pointer", fontSize: 13, fontFamily: "inherit",
          justifyContent: collapsed ? "center" : "flex-start",
        }}>
          <CRMIcon name="cog" size={16} />
          {!collapsed && <span>Paramètres</span>}
        </button>
        {/* Profile */}
        <div style={{
          marginTop: 6, padding: collapsed ? 4 : 8, display: "flex", alignItems: "center", gap: 10,
          background: t.surface2, borderRadius: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999, background: t.primary,
            color: "#fff", display: "grid", placeItems: "center",
            fontSize: 11, fontWeight: 700, fontFamily: "inherit",
          }}>{CRM_AGENT.initials}</div>
          {!collapsed && (
            <div style={{ flex: 1, lineHeight: 1.2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{CRM_AGENT.name}</div>
              <div style={{ fontSize: 10.5, color: t.muted }}>{CRM_AGENT.role}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

const iconBtn = (t) => ({
  width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.border}`,
  background: t.surface2, cursor: "pointer", display: "grid", placeItems: "center",
  color: t.soft, fontFamily: "inherit",
});
const kbd = (t) => ({
  fontSize: 10, fontWeight: 600, color: t.muted,
  border: `1px solid ${t.border}`, borderRadius: 4, padding: "1px 4px",
  background: t.surface, fontFamily: "JetBrains Mono, monospace",
});

// ─── Stage chip ───────────────────────────────────────────────────────
const CRMStageChip = ({ stage, t, size = "sm" }) => {
  const s = CRM_STAGES[stage] || { label: stage, color: t.muted };
  const dot = s.color;
  const px = size === "sm" ? "3px 8px" : "4px 10px";
  const fz = size === "sm" ? 11 : 12;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding: px, background: t.surface2, border: `1px solid ${t.border}`,
      color: t.soft, borderRadius: 999, fontSize: fz, fontWeight: 600,
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background: dot, flexShrink:0 }} />
      {s.label}
    </span>
  );
};

// ─── KYC Badge ────────────────────────────────────────────────────────
const CRMKYCBadge = ({ status, t }) => {
  const map = {
    none:     { label:"KYC manquant", bg: t.dangerSoft, fg: t.danger,  dot:t.danger },
    pending:  { label:"KYC en cours", bg: t.warnSoft,   fg: t.warn,    dot:t.warn },
    verified: { label:"KYC vérifié",  bg: t.okSoft,     fg: t.ok,      dot:t.ok },
    stale:    { label:"KYC à re-screener", bg: t.warnSoft, fg: t.warn, dot:t.warn },
  };
  const m = map[status || "none"];
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"2px 8px", borderRadius: 999,
      background: m.bg, color: m.fg, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
    }}>
      <span style={{ width:5, height:5, borderRadius:999, background: m.dot }} />
      {m.label}
    </span>
  );
};

// ─── Avatar ───────────────────────────────────────────────────────────
const CRMAvatar = ({ contact, size = 32, t }) => (
  <div style={{
    width: size, height: size, borderRadius: 999,
    background: contact.avatarBg || t.primary, color: "#fff",
    display:"grid", placeItems:"center",
    fontSize: Math.max(10, size * 0.36), fontWeight: 700,
    flexShrink: 0,
  }}>{crmInitials(`${contact.firstName} ${contact.lastName}`)}</div>
);

// ─── Match score ring ─────────────────────────────────────────────────
const CRMScoreRing = ({ score, size = 36, t }) => {
  const r = (size / 2) - 3;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  const color = score >= 80 ? t.ok : score >= 60 ? t.primary : score >= 40 ? t.warn : t.danger;
  return (
    <div style={{ position:"relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={t.border} strokeWidth="2.5" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="2.5" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div style={{
        position:"absolute", inset:0, display:"grid", placeItems:"center",
        fontSize: size <= 32 ? 10 : 11, fontWeight: 700, color: t.ink,
        fontVariantNumeric:"tabular-nums",
      }}>{score}</div>
    </div>
  );
};

// ─── AI Suggestion bubble ─────────────────────────────────────────────
const CRMAIBubble = ({ s, t, dense }) => {
  const c = crmContactById(s.contactId);
  const name = c ? `${c.firstName} ${c.lastName}` : "—";
  const dotColor = s.priority === "high" ? t.danger : s.priority === "medium" ? t.warn : t.muted;
  return (
    <div style={{
      padding: dense ? "10px 12px" : "12px 14px",
      borderRadius: 12, border: `1px solid ${t.border}`,
      background: t.surface, display:"flex", gap: 12, alignItems:"flex-start",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `linear-gradient(135deg, ${t.primary} 0%, #8B5CF6 100%)`,
        color: "#fff", display:"grid", placeItems:"center", flexShrink:0,
      }}>
        <CRMIcon name="spark" size={14} stroke="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{s.title}</span>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: dotColor }} />
          <span style={{ fontSize: 10.5, color: t.muted, fontWeight: 600, textTransform:"uppercase", letterSpacing: 0.5 }}>
            {s.priority === "high" ? "Priorité" : s.priority === "medium" ? "Suggéré" : "Info"}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: t.soft, lineHeight: 1.45, marginBottom: 8 }}>{s.body}</div>
        <div style={{ display:"flex", gap: 8 }}>
          <button style={btnPrimary(t)}>{s.cta}</button>
          <button style={btnGhost(t)}>Plus tard</button>
        </div>
      </div>
    </div>
  );
};

const btnPrimary = (t) => ({
  height: 28, padding: "0 12px", borderRadius: 8,
  background: t.ink, color: t.surface, border: 0, fontWeight: 600, fontSize: 12,
  cursor: "pointer", fontFamily: "inherit",
});
const btnGhost = (t) => ({
  height: 28, padding: "0 12px", borderRadius: 8,
  background: "transparent", color: t.soft, border: `1px solid ${t.border}`,
  fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
});
const btnPrimaryBlue = (t) => ({
  height: 32, padding: "0 14px", borderRadius: 8,
  background: t.primary, color: "#fff", border: 0, fontWeight: 600, fontSize: 13,
  cursor: "pointer", fontFamily: "inherit",
});
const btnGhost32 = (t) => ({
  height: 32, padding: "0 12px", borderRadius: 8,
  background: t.surface, color: t.soft, border: `1px solid ${t.border}`,
  fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
});

// ─── Command palette ──────────────────────────────────────────────────
const CRMCmdPalette = ({ open, onClose, t, onNavigate }) => {
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && open) onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const contacts = CRM_CONTACTS.filter(c => !ql || (c.firstName+" "+c.lastName).toLowerCase().includes(ql)).slice(0, 4);
  const biens    = CRM_BIENS.filter(b => !ql || b.title.toLowerCase().includes(ql) || b.ref.toLowerCase().includes(ql)).slice(0, 4);
  const actions  = [
    { id:"new-contact", label:"Nouveau contact", icon:"plus" },
    { id:"new-bien",    label:"Créer un bien",   icon:"plus" },
    { id:"matching",    label:"Lancer le matching IA", icon:"spark" },
    { id:"ask-ai",      label:`Demander à MEGGA AI : "${q || "…"}"`, icon:"spark" },
  ];
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:t.overlay, zIndex:100,
      display:"grid", placeItems:"start center", paddingTop:"12vh",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 640, background: t.surface, borderRadius: 14,
        border: `1px solid ${t.border}`, boxShadow: t.shadow2, overflow:"hidden",
      }}>
        <div style={{ padding:"14px 16px", borderBottom: `1px solid ${t.border}`, display:"flex", alignItems:"center", gap:10 }}>
          <CRMIcon name="search" size={16} stroke={t.muted} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Rechercher contacts, biens, deals — ou demander à MEGGA AI…"
            style={{
              flex:1, background:"transparent", border:0, outline:"none",
              color: t.ink, fontSize: 15, fontFamily:"inherit",
            }} />
          <kbd style={kbd(t)}>Esc</kbd>
        </div>
        <div style={{ maxHeight: 420, overflowY:"auto", padding: 8 }}>
          {contacts.length > 0 && <CmdGroup t={t} title="Contacts">
            {contacts.map(c => (
              <CmdRow key={c.id} t={t} icon="contacts" label={`${c.firstName} ${c.lastName}`} sub={c.email} />
            ))}
          </CmdGroup>}
          {biens.length > 0 && <CmdGroup t={t} title="Biens">
            {biens.map(b => (
              <CmdRow key={b.id} t={t} icon="bien" label={b.title} sub={`${b.ref} · ${crmFmtCHF(b.price || b.rent)}${b.transaction === "location" ? "/mois" : ""}`} />
            ))}
          </CmdGroup>}
          <CmdGroup t={t} title="Actions">
            {actions.map(a => (
              <CmdRow key={a.id} t={t} icon={a.icon} label={a.label} accent />
            ))}
          </CmdGroup>
        </div>
        <div style={{
          padding:"8px 14px", borderTop: `1px solid ${t.border}`,
          display:"flex", gap:14, alignItems:"center", fontSize:11, color: t.muted,
        }}>
          <span><kbd style={kbd(t)}>↑↓</kbd> naviguer</span>
          <span><kbd style={kbd(t)}>↵</kbd> ouvrir</span>
          <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
            <CRMIcon name="spark" size={12} /> Propulsé par MEGGA AI
          </span>
        </div>
      </div>
    </div>
  );
};

const CmdGroup = ({ title, t, children }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: 0.6, textTransform:"uppercase", padding: "8px 10px 4px" }}>{title}</div>
    {children}
  </div>
);
const CmdRow = ({ icon, label, sub, t, accent }) => (
  <button style={{
    width:"100%", padding:"8px 10px", display:"flex", alignItems:"center", gap: 10,
    background:"transparent", border: 0, borderRadius: 8, cursor:"pointer",
    color: t.ink, fontFamily:"inherit", textAlign:"left",
  }}
  onMouseEnter={(e) => e.currentTarget.style.background = t.surface2}
  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
    <div style={{
      width: 26, height: 26, borderRadius: 6, background: accent ? t.primarySoft : t.surface2,
      color: accent ? t.primary : t.soft, display:"grid", placeItems:"center",
    }}><CRMIcon name={icon} size={14} /></div>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 1 }}>{sub}</div>}
    </div>
    <CRMIcon name="arrowR" size={12} stroke={t.muted} />
  </button>
);

// Export
Object.assign(window, {
  CRMIcon, CRMSidebar, CRMStageChip, CRMKYCBadge, CRMAvatar, CRMScoreRing,
  CRMAIBubble, CRMCmdPalette,
  crmIconBtn: iconBtn, crmKbd: kbd,
  crmBtnPrimary: btnPrimary, crmBtnGhost: btnGhost,
  crmBtnPrimaryBlue: btnPrimaryBlue, crmBtnGhost32: btnGhost32,
});
