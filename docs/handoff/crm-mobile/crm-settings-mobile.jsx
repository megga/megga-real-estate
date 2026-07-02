// MEGGA CRM — Paramètres MOBILE · Hub de tuiles + shell/router
// Sugar Pure, theme-aware. Entrée depuis « Plus › Paramètres ».
// Architecture : Hub (hero compte + grille de 6 tuiles « remplissables ») → drill-in par push.
// Charge APRÈS crm-settings-mobile-sections.jsx (consomme window.Sm* + window.SettingsSection*).
// Réutilise window.* : MTCtx, MT_LIGHT/DARK, MT_STAGE, MEGGAWordmark, MAv, MIcon, MEIcon.

const SH_useMT = () => React.useContext(window.MTCtx);
const ShGlyph = ({ name, size = 20, color = "currentColor", sw = 1.85 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

// ─── Tuiles (6 sections — Profil est traité en hero) ────────────────────
//  Chaque tuile porte un « état vivant » : pilule de statut, compteur ou score.
const SH_TILES = [
  { id: "agency",        icon: "building",    name: "Agence",        status: { tone: "ok",    label: "Vérifiée" } },
  { id: "notifications", icon: "bell",        name: "Notifications", status: { tone: "muted", label: "4 canaux" } },
  { id: "integrations",  icon: "link",        name: "Intégrations",  iconSize: 36, status: { tone: "muted", label: "2 connectées" } },
  { id: "billing",       icon: "credit-card", name: "Facturation",   status: { tone: "muted", label: "Pro" } },
  { id: "security",      icon: "lock",        name: "Sécurité",      status: { tone: "warn",  label: "1 action" } },
  { id: "preferences",   icon: "globe",       name: "Préférences",   status: { tone: "muted", label: "FR · Clair" } },
];

const ShStatusPill = ({ tone, children }) => {
  const T = SH_useMT();
  const tones = {
    ok:    { bg: T.mode === "dark" ? "rgba(52,199,150,0.18)" : "#E3F4EC", fg: T.goal },
    warn:  { bg: T.riskBg, fg: T.riskFg },
    muted: { bg: T.cardSubtle, fg: T.muted },
  }[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, background: tones.bg, color: tones.fg, fontSize: 11, fontWeight: 800, letterSpacing: -0.1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{tone === "warn" && <span style={{ width: 5, height: 5, borderRadius: 999, background: tones.fg }} />}{children}</span>;
};

// ─── En-tête du hub (retour vers « Plus » + titre) ──────────────────────
const ShHubHeader = ({ onExit }) => {
  const T = SH_useMT();
  return (
    <header style={{ flexShrink: 0, paddingTop: 76, paddingBottom: 14, paddingLeft: 14, paddingRight: 18, display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={onExit} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <ShGlyph name="chevron-left" size={20} color={T.ink} sw={2.1} />
      </button>
      <h1 style={{ flex: 1, margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.8, color: T.ink }}>Paramètres</h1>
    </header>
  );
};

// ─── Hub : hero compte + grille de tuiles ───────────────────────────────
const ShHub = ({ go, onExit, profile }) => {
  const T = SH_useMT();
  const pct = window.smProfileCompletion(profile);
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || "Sans nom";
  const [loggingOut, setLoggingOut] = React.useState(false);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas }}>
      <ShHubHeader onExit={onExit} />
      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 26px", WebkitOverflowScrolling: "touch" }}>
        {/* Hero compte → Profil */}
        <button onClick={() => go("profile")} className="shItem" style={{
          "--d": "40ms", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", border: 0,
          display: "flex", alignItems: "center", gap: 15, padding: "16px 18px", borderRadius: 22, background: T.card, boxShadow: T.shadow,
        }}>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0, display: "grid", placeItems: "center" }}>
            <div style={{ position: "absolute", inset: 0 }}><window.SmRing value={pct} size={64} sw={4} showLabel={false} /></div>
            <window.MAv bg={T.accent} ink={T.accentInk} size={50}>GL</window.MAv>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink, lineHeight: 1.1 }}>{fullName}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, marginTop: 3 }}>Profil complété à {pct}%</div>
          </div>
          <ShGlyph name="chevron-right" size={20} color={T.ghost} sw={2} />
        </button>

        {/* Grille de tuiles */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {SH_TILES.map((tl, i) => (
            <button key={tl.id} onClick={() => go(tl.id)} className="shItem" style={{
              "--d": `${90 + i * 45}ms`, textAlign: "left", cursor: "pointer", fontFamily: "inherit", border: 0,
              display: "flex", flexDirection: "column", gap: 14, padding: "16px 16px 15px", borderRadius: 18, minHeight: 124,
              background: T.card, boxShadow: T.shadowSm,
            }}>
              <span style={{ display: "grid", placeItems: "center", width: 30, height: 30 }}>
                <ShGlyph name={tl.icon} size={tl.iconSize || 26} color={T.ink} sw={1.85} />
              </span>
              <div style={{ marginTop: "auto" }}>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink, lineHeight: 1.15 }}>{tl.name}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Déconnexion */}
        <button onClick={() => { if (!loggingOut) setLoggingOut(true); }} disabled={loggingOut} className="shItem" style={{
          "--d": "400ms", width: "100%", marginTop: 16, height: 50, borderRadius: 999, border: 0, cursor: loggingOut ? "default" : "pointer",
          fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: T.muted, background: T.card,
          boxShadow: T.shadowSm, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
          opacity: loggingOut ? 0.75 : 1, transition: "opacity .2s",
        }}>
          {loggingOut ? (
            <><span style={{ width: 17, height: 17, borderRadius: 999, border: `2px solid ${T.hair}`, borderTopColor: T.muted, display: "inline-block", animation: "shSpin .7s linear infinite" }} />Déconnexion en cours…</>
          ) : (
            <><ShGlyph name="logout" size={18} color={T.muted} sw={1.9} />Se déconnecter</>
          )}
        </button>
      </main>
    </div>
  );
};

// ─── Tab bar (Plus actif) ───────────────────────────────────────────────
const SH_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const ShTabBar = () => {
  const T = SH_useMT();
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {SH_TABS.map(tb => {
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

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN — shell + router
// ═══════════════════════════════════════════════════════════════════════
const SettingsMobileScreen = ({ dark: darkProp = false, onBack = () => {} }) => {
  const [dark, setDark] = React.useState(darkProp);
  React.useEffect(() => { setDark(darkProp); }, [darkProp]);
  const [lang, setLang] = React.useState("fr");
  const [view, setView] = React.useState("hub"); // "hub" | sectionId
  const [profile, setProfile] = React.useState(window.SM_PROFILE_DEFAULT);
  const [smToast, setSmToast] = React.useState(null);
  const smToastTimer = React.useRef(null);
  const showSmToast = (msg) => {
    setSmToast(msg);
    if (smToastTimer.current) clearTimeout(smToastTimer.current);
    smToastTimer.current = setTimeout(() => setSmToast(null), 2200);
  };
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };

  const back = () => setView("hub");
  const renderView = () => {
    const p = { onBack: back, onSave: () => { back(); showSmToast("Modifications enregistrées"); } };
    switch (view) {
      case "profile":       return <window.SettingsSectionProfil {...p} data={profile} onChange={setProfile} />;
      case "agency":        return <window.SettingsSectionAgence {...p} />;
      case "notifications": return <window.SettingsSectionNotifications {...p} />;
      case "integrations":  return <window.SettingsSectionIntegrations {...p} />;
      case "billing":       return <window.SettingsSectionFacturation {...p} />;
      case "security":      return <window.SettingsSectionSecurite {...p} />;
      case "preferences":   return <window.SettingsSectionPreferences {...p} dark={dark} setDark={setDark} lang={lang} setLang={setLang} />;
      default:              return <ShHub go={setView} onExit={onBack} profile={profile} />;
    }
  };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink }}>
        <style>{`
          @keyframes shUp { from { transform: translateY(14px); } to { transform: none; } }
          @keyframes smIn { from { transform: translateX(22px); } to { transform: none; } }
          @keyframes shSpin { to { transform: rotate(360deg); } }
          @keyframes smToastUp { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
          .shItem { opacity: 1; }
        `}</style>
        <div key={view} style={{ flex: 1, minHeight: 0 }}>
          {renderView()}
        </div>
        {smToast && (
          <div style={{ position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 90, background: dark ? "#ECEDF3" : "#0B0C0E", color: dark ? "#0B0C0E" : "#fff", fontSize: 13, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 12px 30px rgba(15,23,42,0.25)", whiteSpace: "nowrap", animation: "smToastUp .26s cubic-bezier(.2,.9,.3,1.1) both" }}>{smToast}</div>
        )}
        <ShTabBar />
      </div>
    </window.MTCtx.Provider>
  );
};

window.SettingsMobileScreen = SettingsMobileScreen;
