// MEGGA CRM — Journal d'audit nLPD / LBA (Sugar Pure)
// Direction artistique conforme à crm-wizard-sugar-v2.jsx (Step 0).
// — Page de conformité : timeline immuable, filtrable, exportable
// — Surfaces blanches, radius 22-28px, ombres douces, accent noir #0B0C0E
// — Conserve la traçabilité requise par nLPD (10 ans) + LBA (piste d'audit)
//
// Prérequis : window.SugarV2Palette, window.AUDIT_EVENTS, window.AUDIT_CATEGORIES,
//             window.SugarTopNav, window.CRM_CONTACTS

const AudSP = window.SugarV2Palette || {
  bg: "#EDEFF3",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)",
  card: "#FFFFFF", cardSubtle: "#F7F8FA",
  black: "#0B0C0E", blackHover: "#1F2024",
  ink: "#0B0C0E", inkSoft: "#3A3D44", muted: "#7A8088", ghost: "#B5BAC2",
  shadowSm: "0 4px 16px rgba(15,23,42,0.04)",
  shadow:   "0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)",
  shadowLg: "0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
};

const AudIcon = ({ name, size = 16, stroke = "currentColor", sw = 1.6 }) => {
  const p = {
    arrowL:    <><path d="M19 12H5M12 19l-7-7 7-7"/></>,
    arrowR:    <><path d="M5 12h14M12 5l7 7-7 7"/></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    search:    <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    download:  <><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>,
    file:      <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></>,
    shield:    <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/></>,
    deal:      <><path d="M12 2v6M12 16v6M5 9h14M5 15h14"/></>,
    pipeline:  <><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="3" y="14" width="6" height="6" rx="1"/><rect x="15" y="9" width="6" height="6" rx="1"/><path d="M9 7h6M9 17h6"/></>,
    contact:   <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    home:      <><path d="m3 11 9-8 9 8"/><path d="M5 10v9h14v-9"/></>,
    cog:       <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    lock:      <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    sparkle:   <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></>,
    alert:     <><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></>,
    cal:       <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    check:     <><path d="m5 13 4 4 10-12"/></>,
    person:    <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    server:    <><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></>,
    chevDown:  <><path d="m6 9 6 6 6-6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || null}
    </svg>
  );
};

const AUD_CAT_ICON = {
  kyc: "shield", deal: "pipeline", contact: "contact", bien: "home",
  doc: "file", auth: "lock", settings: "cog", ai: "sparkle",
};

// ─── Primitives Sugar Pure (préfixées Aud) ────────────────────────────
const AudBlackPill = ({ children, onClick, icon, size = "md" }) => {
  const [hover, setHover] = React.useState(false);
  const h = size === "lg" ? 50 : 40;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === "lg" ? "0 26px" : "0 18px", borderRadius: 999, border: 0,
        background: hover ? AudSP.blackHover : AudSP.black,
        color: "#fff", fontFamily: "inherit", fontSize: size === "lg" ? 14.5 : 13,
        fontWeight: 600, letterSpacing: 0.1, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
        boxShadow: hover ? "0 12px 30px rgba(11,12,14,0.25)" : "0 6px 16px rgba(11,12,14,0.18)",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition: "all .18s ease",
      }}>
      {icon}{children}
    </button>
  );
};

const AudGhostPill = ({ children, onClick, icon, active }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 36, padding: "0 14px", borderRadius: 999, border: 0,
        background: active ? AudSP.black : (hover ? AudSP.card : "transparent"),
        color: active ? "#fff" : AudSP.inkSoft, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
        boxShadow: active ? "0 6px 16px rgba(11,12,14,0.18)" : (hover ? AudSP.shadow : "none"),
        transition: "all .18s ease",
      }}>
      {icon}{children}
    </button>
  );
};

const AudCircleBtn = ({ icon, onClick, title, size = 40 }) => (
  <button onClick={onClick} title={title} style={{
    width: size, height: size, borderRadius: 999, border: 0,
    background: AudSP.cardSubtle, color: AudSP.inkSoft, cursor: "pointer",
    display: "grid", placeItems: "center", boxShadow: AudSP.shadowSm,
    transition: "all .18s ease",
  }}
    onMouseEnter={e => { e.currentTarget.style.background = AudSP.card; e.currentTarget.style.boxShadow = AudSP.shadow; }}
    onMouseLeave={e => { e.currentTarget.style.background = AudSP.cardSubtle; e.currentTarget.style.boxShadow = AudSP.shadowSm; }}>
    {icon}
  </button>
);

// ─── Stat card ────────────────────────────────────────────────────────
const AudStatCard = ({ label, value, sub, accent }) => (
  <div style={{
    background: AudSP.card, borderRadius: 22, padding: "22px 24px",
    boxShadow: AudSP.shadow, minHeight: 120,
    display: "flex", flexDirection: "column", justifyContent: "space-between",
  }}>
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 1.1,
      textTransform: "uppercase", color: AudSP.muted,
    }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
      <span style={{
        fontSize: 42, fontWeight: 700, letterSpacing: -1.3, lineHeight: 1,
        color: AudSP.ink, fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
      {accent && <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, marginBottom: 6 }} />}
    </div>
    <div style={{ fontSize: 12.5, fontWeight: 500, color: AudSP.muted, marginTop: 8 }}>{sub}</div>
  </div>
);

// ─── Row d'événement ──────────────────────────────────────────────────
const AudEventRow = ({ event, last }) => {
  const [hover, setHover] = React.useState(false);
  const cat = (window.AUDIT_CATEGORIES || {})[event.category] || { label: event.category, tone: AudSP.muted };
  const actor = event.actor === "system"
    ? { name: "Système", initials: "AI", avatarBg: AudSP.black, isSystem: true }
    : (() => {
        const c = (window.CRM_TEAM || []).find(a => a.id === event.actor);
        return c ? { name: c.name, initials: c.initials, avatarBg: "#0041D9", isSystem: false } : { name: event.actor, initials: "??", avatarBg: AudSP.muted, isSystem: false };
      })();

  const sev = event.severity || "info";
  const sevTone = sev === "critical" ? "#EF4444" : sev === "warn" ? "#F59E0B" : "#10B981";

  const fmt = (iso) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("fr-CH", { day: "2-digit", month: "short" }),
      time: d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }),
    };
  };
  const dt = fmt(event.at);

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid", gridTemplateColumns: "86px 44px 1.7fr 1fr auto",
        gap: 18, alignItems: "center",
        padding: "18px 24px",
        background: hover ? AudSP.cardSubtle : "transparent",
        borderBottom: last ? "none" : `1px solid ${AudSP.cardSubtle}`,
        transition: "background .15s ease",
      }}>
      {/* Date/heure */}
      <div style={{ fontSize: 12, color: AudSP.muted, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        <div style={{ fontWeight: 700, color: AudSP.ink, marginBottom: 2 }}>{dt.date}</div>
        <div>{dt.time}</div>
      </div>

      {/* Avatar acteur */}
      <div title={actor.name} style={{
        width: 36, height: 36, borderRadius: 999, color: "#fff",
        background: actor.avatarBg,
        display: "grid", placeItems: "center", flexShrink: 0,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      }}>
        {actor.isSystem ? <AudIcon name="sparkle" size={15} stroke="#fff" /> : actor.initials}
      </div>

      {/* Action */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
        }}>
          <span style={{
            fontSize: 13.5, fontWeight: 700, color: AudSP.ink, letterSpacing: -0.15,
            whiteSpace: "nowrap",
          }}>{event.action}</span>
          {sev !== "info" && (
            <span style={{
              padding: "2px 8px", borderRadius: 999,
              background: sev === "critical" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              color: sev === "critical" ? "#B91C1C" : "#8C5A00",
              fontSize: 10, fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase",
            }}>{sev === "critical" ? "Critique" : "Attention"}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: AudSP.muted, fontWeight: 500, lineHeight: 1.5 }}>
          {event.detail}
        </div>
      </div>

      {/* Objet ciblé + catégorie */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: AudSP.cardSubtle,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <AudIcon name={AUD_CAT_ICON[event.category] || "file"} size={14} stroke={cat.tone} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: cat.tone,
            letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 1,
          }}>{cat.label}</div>
          <div style={{
            fontSize: 12.5, fontWeight: 700, color: AudSP.ink, letterSpacing: -0.1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240,
          }}>{event.object.label}</div>
        </div>
      </div>

      {/* IP / chevron */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {event.ip && (
          <span style={{
            fontSize: 10.5, color: AudSP.muted, fontWeight: 500,
            fontVariantNumeric: "tabular-nums", fontFamily: "JetBrains Mono, monospace",
          }}>{event.ip}</span>
        )}
        <AudCircleBtn size={32} title="Détails"
          icon={<AudIcon name="arrowR" size={13} stroke={AudSP.inkSoft} />} />
      </div>
    </div>
  );
};

// ─── Group d'événements par date (header sticky-like) ─────────────────
const AudDayGroup = ({ dateLabel, count, events }) => {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 28px 12px",
        background: AudSP.cardSubtle,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: AudSP.ink, letterSpacing: -0.1,
          }}>{dateLabel}</span>
          <span style={{
            padding: "2px 9px", borderRadius: 999, background: AudSP.card,
            fontSize: 10.5, fontWeight: 700, color: AudSP.inkSoft, fontVariantNumeric: "tabular-nums",
            boxShadow: AudSP.shadowSm,
          }}>{count} évènement{count > 1 ? "s" : ""}</span>
        </div>
      </div>
      {events.map((ev, i) => (
        <AudEventRow key={ev.id} event={ev} last={i === events.length - 1} />
      ))}
    </div>
  );
};

// ─── SCREEN ───────────────────────────────────────────────────────────
const CRMScreenAuditSugar = ({ t, dense, aiLevel, dark, darkTone, setDark, onNavigate, onCmd, screen }) => {
  const sp = (window.crmSugarPalette && window.crmSugarPalette(t, dark, darkTone)) || {
    pageBg: AudSP.bg, ink: AudSP.ink, soft: AudSP.inkSoft, sub: AudSP.muted,
  };

  const allEvents = window.AUDIT_EVENTS || [];
  const [filterCat, setFilterCat] = React.useState("all");
  const [filterSev, setFilterSev] = React.useState("all");
  const [filterDays, setFilterDays] = React.useState(30);
  const [query, setQuery] = React.useState("");

  const filtered = allEvents.filter(ev => {
    if (filterCat !== "all" && ev.category !== filterCat) return false;
    if (filterSev !== "all" && (ev.severity || "info") !== filterSev) return false;
    const cutoff = new Date(Date.now() - filterDays * 24 * 3600 * 1000);
    if (new Date(ev.at) < cutoff) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!ev.action.toLowerCase().includes(q) &&
          !ev.detail.toLowerCase().includes(q) &&
          !ev.object.label.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.at) - new Date(a.at));

  // Groupement par jour
  const groups = {};
  filtered.forEach(ev => {
    const d = new Date(ev.at);
    const key = d.toLocaleDateString("fr-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });
  const groupKeys = Object.keys(groups);

  // Stats
  const stats = {
    total:    filtered.length,
    critical: filtered.filter(e => e.severity === "critical").length,
    warn:     filtered.filter(e => e.severity === "warn").length,
    ai:       filtered.filter(e => e.actor === "system").length,
  };

  const cats = window.AUDIT_CATEGORIES || {};

  return (
    <div data-screen-label="CRM Audit log (sugar)" style={{
      minHeight: "100vh", width: "100%",
      background: AudSP.bgGradient,
      fontFamily: "Manrope, system-ui, sans-serif", color: AudSP.ink,
    }}>
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {window.SugarTopNav && (
        <window.SugarTopNav active="audit" t={t} sp={sp} dark={dark}
          onNavigate={onNavigate} onCmd={onCmd} />
      )}

      <main style={{ padding: "32px 40px 120px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>

          {/* HEADER */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end",
            marginBottom: 36, animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
          }}>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: AudSP.muted,
                letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
              }}>Conformité · nouvelle Loi sur la Protection des Données</div>
              <h1 style={{
                margin: "0 0 12px", fontSize: 40, fontWeight: 700,
                color: AudSP.ink, letterSpacing: -0.8, lineHeight: 1.05,
              }}>Journal d'audit.</h1>
              <p style={{
                margin: 0, fontSize: 15, color: AudSP.inkSoft, fontWeight: 500,
                lineHeight: 1.55, maxWidth: 620,
              }}>
                Toutes les actions sur les contacts, biens, deals et documents sont enregistrées de manière immuable.
                Cette trace satisfait l'obligation d'audit nLPD (art. 12) et LBA (art. 7), conservée 10 ans.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <AudGhostPill icon={<AudIcon name="download" size={14} stroke={AudSP.inkSoft} />}>
                Export CSV
              </AudGhostPill>
              <AudBlackPill size="lg" icon={<AudIcon name="download" size={15} stroke="#fff" />}>
                Export PDF horodaté
              </AudBlackPill>
            </div>
          </div>

          {/* STATS */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24,
            animation: "sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both",
          }}>
            <AudStatCard label="Évènements"          value={stats.total}    accent="#0B0C0E" sub={`Sur les ${filterDays} derniers jours`} />
            <AudStatCard label="Critiques"           value={stats.critical} accent="#EF4444" sub="Verrous, échecs auth, refus" />
            <AudStatCard label="Attention"           value={stats.warn}     accent="#F59E0B" sub="Re-screening, export données" />
            <AudStatCard label="Actions MEGGA AI"    value={stats.ai}       accent="#7A4FD8" sub="Suggestions et matching automatique" />
          </div>

          {/* BARRE DE FILTRES */}
          <div style={{
            background: AudSP.card, borderRadius: 22, padding: "18px 22px",
            boxShadow: AudSP.shadow, marginBottom: 18,
            display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center",
            animation: "sgFadeUp .6s cubic-bezier(.2,.8,.2,1) both",
          }}>
            {/* Recherche */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "0 14px", height: 44, background: AudSP.cardSubtle,
              borderRadius: 999, maxWidth: 380,
            }}>
              <AudIcon name="search" size={16} stroke={AudSP.muted} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher une action, un objet…"
                style={{
                  flex: 1, border: 0, outline: "none", background: "transparent",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: AudSP.ink,
                }} />
            </div>
            {/* Date range */}
            <div style={{ display: "flex", gap: 6 }}>
              <AudGhostPill active={filterDays === 7}  onClick={() => setFilterDays(7)}>7 jours</AudGhostPill>
              <AudGhostPill active={filterDays === 30} onClick={() => setFilterDays(30)}>30 jours</AudGhostPill>
              <AudGhostPill active={filterDays === 90} onClick={() => setFilterDays(90)}>90 jours</AudGhostPill>
              <AudGhostPill active={filterDays === 3650} onClick={() => setFilterDays(3650)}>Tout</AudGhostPill>
            </div>
          </div>

          {/* FILTRES CATÉGORIES + SÉVÉRITÉ */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap",
            animation: "sgFadeUp .65s cubic-bezier(.2,.8,.2,1) both",
          }}>
            <AudGhostPill active={filterCat === "all"} onClick={() => setFilterCat("all")}>
              Toutes catégories · {allEvents.length}
            </AudGhostPill>
            {Object.entries(cats).map(([key, c]) => (
              <AudGhostPill key={key} active={filterCat === key} onClick={() => setFilterCat(key)}
                icon={<AudIcon name={AUD_CAT_ICON[key] || "file"} size={13}
                  stroke={filterCat === key ? "#fff" : c.tone} />}>
                {c.label}
              </AudGhostPill>
            ))}
            <div style={{ width: 1, height: 22, background: "rgba(11,12,14,0.08)", margin: "0 6px" }} />
            <AudGhostPill active={filterSev === "all"} onClick={() => setFilterSev("all")}>Toute sévérité</AudGhostPill>
            <AudGhostPill active={filterSev === "critical"} onClick={() => setFilterSev("critical")}
              icon={<span style={{ width: 7, height: 7, borderRadius: 999, background: "#EF4444" }} />}>
              Critique
            </AudGhostPill>
            <AudGhostPill active={filterSev === "warn"} onClick={() => setFilterSev("warn")}
              icon={<span style={{ width: 7, height: 7, borderRadius: 999, background: "#F59E0B" }} />}>
              Attention
            </AudGhostPill>
          </div>

          {/* LISTE GROUPÉE */}
          <div style={{
            background: AudSP.card, borderRadius: 22, overflow: "hidden",
            boxShadow: AudSP.shadow,
            animation: "sgFadeUp .7s cubic-bezier(.2,.8,.2,1) both",
          }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: "80px 40px", textAlign: "center",
                color: AudSP.muted, fontSize: 14, fontWeight: 500,
              }}>
                Aucun évènement ne correspond à ces filtres.
              </div>
            ) : (
              groupKeys.map(key => (
                <AudDayGroup key={key} dateLabel={key.charAt(0).toUpperCase() + key.slice(1)}
                  count={groups[key].length} events={groups[key]} />
              ))
            )}
          </div>

          {/* Footer note */}
          <div style={{
            marginTop: 24, padding: "20px 28px",
            display: "flex", alignItems: "center", gap: 14,
            color: AudSP.muted, fontSize: 12.5, fontWeight: 500,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999,
              background: AudSP.card, boxShadow: AudSP.shadowSm,
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              <AudIcon name="lock" size={14} stroke={AudSP.inkSoft} />
            </div>
            <div>
              Les évènements sont signés cryptographiquement et conservés 10 ans (nLPD art. 12 · LBA art. 7).
              <br/>
              Toute tentative de suppression ou modification est elle-même journalisée.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

window.CRMScreenAuditSugar = CRMScreenAuditSugar;
