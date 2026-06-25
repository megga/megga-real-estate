// MEGGA CRM — Responsive · Écran « Plus » (hub) MOBILE
// Sugar Pure, theme-aware. 3 directions de layout explorées via le prop `variant`:
//   A = "list"     liste de lignes sobre (une carte, hairlines)
//   B = "grid"     grille de tuiles 2 colonnes
//   C = "sections" sections groupées comme la sidebar desktop
// Réutilise tokens + atomes via window.* (crm-mobile-today.jsx) : MTCtx, MT_LIGHT/DARK,
// MEGGAWordmark, MAv, MIcon. Icônes riches via window.MEIcon. Zéro emoji.

const MR_useMT = () => React.useContext(window.MTCtx);

// Câblage destination « Plus » → écran du shell (les ids sans cible restent no-op)
const MR_NAV = { biens: "biens", contacts: "contacts", dashboard: "analytics", kyc: "kyc", settings: "settings", "biens-new": "biens-new" };

// ─── Destinations (hors tab bar) ────────────────────────────────────────
const MR_DESTS = {
  biens:      { icon: "building",  name: "Mes biens",     meta: "12 actifs" },
  contacts:   { icon: "users",     name: "Contacts",      meta: "248" },
  dashboard:  { icon: "dashboard", name: "Dashboard",     meta: "Cette semaine" },
  "biens-new":{ icon: "plus",      name: "Créer un bien", meta: null, cta: true },
  kyc:        { icon: "shield",    name: "KYC",           meta: "3 à compléter", soft: true },
  whatsapp:   { icon: "whatsapp",  name: "WhatsApp",      meta: "Messages clients" },
  settings:   { icon: "settings",  name: "Paramètres",    meta: null },
};

// ─── Petit utilitaire d'icône riche ─────────────────────────────────────
const MrGlyph = ({ name, size = 20, color = "currentColor", sw = 1.85 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

// ═══════════════════════════════════════════════════════════════════════
//  En-tête — wordmark + cloche
// ═══════════════════════════════════════════════════════════════════════
const MrHeader = ({ onOpenNotif }) => {
  const T = MR_useMT();
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <window.MEGGAWordmark color={T.ink} />
      <button onClick={onOpenNotif} aria-label="Notifications" style={{ position: "relative", width: 38, height: 38, borderRadius: 999, border: 0, cursor: "pointer", background: "transparent", display: "grid", placeItems: "center" }}>
        <MrGlyph name="bell" size={24} color={T.ink} sw={1.9} />
        <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 999, background: "#E0533F", boxShadow: `0 0 0 2px ${T.canvas.startsWith("radial") ? "transparent" : T.card}` }}></span>
      </button>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Profil compact (hero)
// ═══════════════════════════════════════════════════════════════════════
const MrProfile = ({ delay = 0, onGo }) => {
  const T = MR_useMT();
  return (
    <button onClick={() => onGo && onGo("settings")} style={{
      "--d": `${delay}ms`, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      display: "flex", alignItems: "center", gap: 15, padding: "16px 18px", borderRadius: 22,
      background: T.card, border: 0, boxShadow: T.shadow,
    }} className="mrItem">
      <window.MAv bg={T.accent} ink={T.accentInk} size={54}>GL</window.MAv>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17.5, fontWeight: 800, letterSpacing: -0.5, color: T.ink, lineHeight: 1.1 }}>Gregory Lyonnet</div>
      </div>
      <MrGlyph name="chevron-right" size={20} color={T.ghost} sw={2} />
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Préférences — thème (live) + langue
// ═══════════════════════════════════════════════════════════════════════
const MrSegment = ({ options, value, onChange }) => {
  const T = MR_useMT();
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, background: T.cardSubtle }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: o.icon ? "0 13px 0 11px" : "0 15px",
            borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, letterSpacing: -0.1,
            background: on ? T.accent : "transparent", color: on ? T.accentInk : T.muted,
            boxShadow: on ? T.shadowSm : "none", transition: "background .18s ease, color .18s ease",
          }}>
            {o.icon && <MrGlyph name={o.icon} size={15} color={on ? T.accentInk : T.muted} sw={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

const MrPreferences = ({ dark, setDark, lang, setLang, delay = 0 }) => {
  const T = MR_useMT();
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px" };
  return (
    <div className="mrItem" style={{ "--d": `${delay}ms`, marginTop: 12, borderRadius: 20, background: T.card, boxShadow: T.shadowSm, overflow: "hidden" }}>
      <div style={row}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <MrGlyph name={dark ? "moon" : "sun"} size={18} color={T.ink} sw={1.9} />
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>Apparence</span>
        </div>
        <MrSegment value={dark ? "dark" : "light"} onChange={(v) => setDark(v === "dark")}
          options={[{ id: "light", label: "Clair" }, { id: "dark", label: "Sombre" }]} />
      </div>
      <div style={{ height: 1, background: T.hair, marginLeft: 66 }}></div>
      <div style={row}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <MrGlyph name="globe" size={18} color={T.ink} sw={1.9} />
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>Langue</span>
        </div>
        <MrSegment value={lang} onChange={setLang}
          options={[{ id: "fr", label: "FR" }, { id: "en", label: "EN" }]} />
      </div>
    </div>
  );
};

// ─── Pied : déconnexion (commun) ────────────────────────────────────────
const MrSignOut = ({ delay = 0 }) => {
  const T = MR_useMT();
  return (
    <button className="mrItem" style={{
      "--d": `${delay}ms`, width: "100%", marginTop: 16, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
      fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: T.muted, background: T.card,
      boxShadow: T.shadowSm, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
    }}>
      <MrGlyph name="logout" size={18} color={T.muted} sw={1.9} />Se déconnecter
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  VARIANTE A — Liste de lignes (sobre)
// ═══════════════════════════════════════════════════════════════════════
const MR_LIST_ORDER = ["biens", "contacts", "dashboard", "biens-new", "kyc", "settings"];
const MrListVariant = ({ base, onGo }) => {
  const T = MR_useMT();
  return (
    <div className="mrItem" style={{ "--d": `${base}ms`, marginTop: 16, borderRadius: 20, background: T.card, boxShadow: T.shadowSm, overflow: "hidden" }}>
      {MR_LIST_ORDER.map((id, i) => {
        const d = MR_DESTS[id];
        const last = i === MR_LIST_ORDER.length - 1;
        return (
          <React.Fragment key={id}>
            <button onClick={() => MR_NAV[id] && onGo && onGo(MR_NAV[id])} style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", background: "transparent", display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
                background: d.cta ? T.accent : T.cardSubtle }}>
                <MrGlyph name={d.icon} size={19} color={d.cta ? T.accentInk : T.ink} sw={1.9} />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{d.name}</span>
              {d.meta && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: d.soft ? "#FFFFFF" : T.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                  ...(d.soft ? { background: "#C0392B", padding: "4px 9px", borderRadius: 999 } : {}) }}>{d.meta}</span>
              )}
              <MrGlyph name="chevron-right" size={18} color={T.ghost} sw={2} />
            </button>
            {!last && <div style={{ height: 1, background: T.hair, marginLeft: 72 }}></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  VARIANTE B — Grille de tuiles (2 colonnes)
// ═══════════════════════════════════════════════════════════════════════
const MR_GRID_ORDER = ["biens", "contacts", "whatsapp", "kyc", "biens-new", "settings"];
const MrGridVariant = ({ base, onGo }) => {
  const T = MR_useMT();
  const dd = MR_DESTS.dashboard;
  return (
    <React.Fragment>
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {MR_GRID_ORDER.map((id, i) => {
        const d = MR_DESTS[id];
        const accent = d.cta;
        return (
          <button key={id} onClick={() => MR_NAV[id] && onGo && onGo(MR_NAV[id])} className="mrItem" style={{
            "--d": `${base + i * 45}ms`, position: "relative", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", gap: 12, padding: "16px 16px 15px", borderRadius: 18, border: 0, minHeight: 116,
            background: accent ? T.accent : T.card, color: accent ? T.accentInk : T.ink, boxShadow: T.shadowSm,
          }}>
            {id === "whatsapp" ? (
              <img src="assets/whatsapp.svg" alt="WhatsApp" width="34" height="34" style={{ width: 34, height: 34, display: "block" }} />
            ) : (
              <MrGlyph name={d.icon} size={28} color={accent ? T.accentInk : T.ink} sw={1.85} />
            )}
            <div style={{ marginTop: "auto" }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.15 }}>{d.name}</div>
              {d.meta && (
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, fontVariantNumeric: "tabular-nums",
                  color: accent ? "rgba(255,255,255,0.72)" : (d.soft ? T.riskFg : T.muted) }}>{d.meta}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
    {/* Dashboard — consultation hebdo, moins quotidienne → ligne discrète */}
    <button onClick={() => onGo && onGo(MR_NAV.dashboard)} className="mrItem" style={{
      "--d": `${base + MR_GRID_ORDER.length * 45}ms`, width: "100%", marginTop: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 18, border: 0,
      background: T.card, boxShadow: T.shadowSm,
    }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: T.cardSubtle }}>
        <MrGlyph name={dd.icon} size={18} color={T.ink} sw={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{dd.name}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, whiteSpace: "nowrap" }}>{dd.meta}</span>
      <MrGlyph name="chevron-right" size={18} color={T.ghost} sw={2} />
    </button>
    </React.Fragment>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  VARIANTE C — Sections groupées (comme la sidebar desktop)
// ═══════════════════════════════════════════════════════════════════════
const MR_SECTIONS = [
  { label: "Biens", items: ["biens", "biens-new"] },
  { label: "CRM", items: ["contacts", "dashboard"] },
  { label: "Conformité", items: ["kyc"] },
  { label: "Compte", items: ["settings"] },
];
const MrSectionsVariant = ({ base, onGo }) => {
  const T = MR_useMT();
  let n = 0;
  return (
    <div style={{ marginTop: 8 }}>
      {MR_SECTIONS.map((sec) => (
        <div key={sec.label} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted, padding: "0 4px 9px" }}>{sec.label}</div>
          <div className="mrItem" style={{ "--d": `${base + (n++) * 60}ms`, borderRadius: 18, background: T.card, boxShadow: T.shadowSm, overflow: "hidden" }}>
            {sec.items.map((id, i) => {
              const d = MR_DESTS[id];
              const last = i === sec.items.length - 1;
              return (
                <React.Fragment key={id}>
                  <button onClick={() => MR_NAV[id] && onGo && onGo(MR_NAV[id])} style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", background: "transparent", display: "flex", alignItems: "center", gap: 13, padding: "14px 16px" }}>
                    <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: d.cta ? T.accent : T.cardSubtle }}>
                      <MrGlyph name={d.icon} size={18} color={d.cta ? T.accentInk : T.ink} sw={1.9} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{d.name}</span>
                    {d.meta && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: d.soft ? T.riskFg : T.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                        ...(d.soft ? { background: T.riskBg, padding: "4px 9px", borderRadius: 999 } : {}) }}>{d.meta}</span>
                    )}
                    <MrGlyph name="chevron-right" size={17} color={T.ghost} sw={2} />
                  </button>
                  {!last && <div style={{ height: 1, background: T.hair, marginLeft: 65 }}></div>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Tab bar — « Plus » actif
// ═══════════════════════════════════════════════════════════════════════
const MR_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const MrTabBar = () => {
  const T = MR_useMT();
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {MR_TABS.map((tb) => {
        const on = tb.id === "more";
        return (
          <button key={tb.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <window.MIcon name={tb.icon} size={22} sw={on ? 2.2 : 1.9} color={on ? T.ink : T.ghost} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? T.ink : T.muted, whiteSpace: "nowrap" }}>{tb.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// ─── Skeleton (affiché pendant le changement de langue) ──────────────────
const MrSkeleton = () => {
  const T = MR_useMT();
  const isDark = T.mode === "dark";
  const base = isDark ? "rgba(255,255,255,0.06)" : "#EAECF0";
  const hl = isDark ? "rgba(255,255,255,0.13)" : "#F5F6F8";
  const Bar = ({ w, h = 13, r = 7 }) => (
    <span style={{ display: "block", width: w, height: h, borderRadius: r,
      backgroundColor: base, backgroundImage: `linear-gradient(90deg, ${base} 0px, ${hl} 90px, ${base} 180px)`,
      backgroundSize: "400px 100%", animation: "mrShimmer 1.1s linear infinite" }} />
  );
  return (
    <React.Fragment>
      <div style={{ marginTop: 12, borderRadius: 20, background: T.card, boxShadow: T.shadowSm, overflow: "hidden" }}>
        {[0, 1].map((i) => (
          <React.Fragment key={i}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Bar w={36} h={36} r={11} />
                <Bar w={i === 0 ? 92 : 64} />
              </div>
              <Bar w={104} h={34} r={999} />
            </div>
            {i < 1 && <div style={{ height: 1, background: T.hair, marginLeft: 66 }}></div>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 16, borderRadius: 20, background: T.card, boxShadow: T.shadowSm, overflow: "hidden" }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <React.Fragment key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
            <Bar w={40} h={40} r={12} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <Bar w={`${52 + (i * 13) % 38}%`} />
              <Bar w={`${28 + (i * 7) % 20}%`} h={10} />
            </div>
          </div>
          {i < 5 && <div style={{ height: 1, background: T.hair, marginLeft: 72 }}></div>}
        </React.Fragment>
      ))}
      </div>
    </React.Fragment>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═══════════════════════════════════════════════════════════════════════
const MobileMoreScreen = ({ dark: darkProp = false, variant = "list", onGo, setDark: setDarkApp }) => {
  const [darkLocal, setDarkLocal] = React.useState(darkProp);
  const dark = setDarkApp ? darkProp : darkLocal;
  const setDark = setDarkApp || setDarkLocal;
  const [notifOpen, setNotifOpen] = React.useState(false);
  React.useEffect(() => { setDarkLocal(darkProp); }, [darkProp]);
  const [lang, setLangState] = React.useState("fr");
  const [langLoading, setLangLoading] = React.useState(false);
  const langTimer = React.useRef(null);
  const setLang = (v) => {
    if (v === lang) return;
    setLangState(v);
    setLangLoading(true);
    clearTimeout(langTimer.current);
    langTimer.current = setTimeout(() => setLangLoading(false), 900);
  };
  React.useEffect(() => () => clearTimeout(langTimer.current), []);
  const T = dark
    ? { ...window.MT_DARK, stage: window.MT_STAGE.dark }
    : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink }}>
        <style>{`
          @keyframes mrUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
          @keyframes mrShimmer { from { background-position: -180px 0; } to { background-position: 220px 0; } }
          .mrItem { opacity: 1; }
          @media (prefers-reduced-motion: no-preference) {
            .mrItem { opacity: 0; animation: mrUp .55s cubic-bezier(.2,.8,.2,1) var(--d, 40ms) both; }
          }
        `}</style>

        <MrHeader onOpenNotif={() => setNotifOpen(true)} />

        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 26px", WebkitOverflowScrolling: "touch" }}>
          <MrProfile delay={40} onGo={onGo} />
          {langLoading ? <MrSkeleton /> : (<React.Fragment>
          <MrPreferences dark={dark} setDark={setDark} lang={lang} setLang={setLang} delay={90} />
          {variant === "list" && <MrListVariant base={140} onGo={onGo} />}
          {variant === "grid" && <MrGridVariant base={140} onGo={onGo} />}
          {variant === "sections" && <MrSectionsVariant base={140} onGo={onGo} />}
          </React.Fragment>)}

          <MrSignOut delay={variant === "grid" ? 430 : 460} />
        </main>

        <MrTabBar />
        {notifOpen && window.MrNotifSheet && <window.MrNotifSheet dark={dark} onGo={onGo} onClose={() => setNotifOpen(false)} />}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileMoreScreen = MobileMoreScreen;
