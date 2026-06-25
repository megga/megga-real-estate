// MEGGA CRM mobile — Réglages du matching (Sugar Pure, theme-aware)
// ═════════════════════════════════════════════════════════════════
// Volontairement MINIMAL : l'agent choisit la "largeur" du filet, rien d'autre.
// Le barème détaillé (pondérations, tolérances, veille marché) reste géré par
// le moteur côté serveur (app_config: matching_scoring_v2) — pas un réglage agent.
// Chaque mode = un seuil de pertinence appliqué à tous les acheteurs.
// Persisté en localStorage (megga-matching-mode). Exposé : window.MmMatchingSettings
// ═════════════════════════════════════════════════════════════════

const MS_LS_KEY = "megga-matching-mode";
const MS_DEFAULT_MODE = "balanced";

const MS_MODES = [
  { id: "wide",     name: "Large",      desc: "Beaucoup de biens",            icon: "globe" },
  { id: "balanced", name: "Équilibré",  desc: "Le bon compromis", reco: true, icon: "scale" },
  { id: "precise",  name: "Précis",     desc: "Les meilleurs uniquement",     icon: "target" },
];

function msLoadMode() {
  try {
    const v = window.localStorage.getItem(MS_LS_KEY);
    return MS_MODES.some((m) => m.id === v) ? v : MS_DEFAULT_MODE;
  } catch (_) { return MS_DEFAULT_MODE; }
}

const MS_useMT = () => React.useContext(window.MTCtx);

// ─── Glyphes ───────────────────────────────────────────────────────────────
const MsGlyph = ({ name, size = 18, sw = 1.85, color = "currentColor" }) => {
  const P = {
    back:   "M15 5l-7 7 7 7",
    check:  "M5 13l4 4 10-12",
    target: "M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z M12 8a4 4 0 100 8 4 4 0 000-8z M12 11.6a.4.4 0 100 .8 .4.4 0 000-.8z",
    scale:  "M12 4v16 M5 8l-2 5a3 3 0 006 0L7 8z M17 8l-2 5a3 3 0 006 0l-2-5z M7 8h10",
    globe:  "M12 3a9 9 0 100 18 9 9 0 000-18z M3.5 9h17 M3.5 15h17 M12 3c2.5 2.4 2.5 15.6 0 18 M12 3c-2.5 2.4-2.5 15.6 0 18",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d={P[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════
//  PANNEAU
// ═════════════════════════════════════════════════════════════════
const MmMatchingSettings = ({ dark = false, onClose, onSaved }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const [mode, setMode] = React.useState(msLoadMode);

  const save = () => {
    try { window.localStorage.setItem(MS_LS_KEY, mode); } catch (_) {}
    onSaved && onSaved();
  };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden", animation: "msIn .32s cubic-bezier(.2,.8,.2,1) both" }}>
        <style>{`
          @keyframes msIn { from { opacity:0; transform: translateX(16px); } to { opacity:1; transform:none; } }
          .msScroll::-webkit-scrollbar{ display:none; }
        `}</style>

        {/* Header */}
        <header style={{ paddingTop: 52, paddingLeft: 14, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: "transparent" }}>
          <button onClick={onClose} aria-label="Retour" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: T.card, boxShadow: T.shadowSm, cursor: "pointer", display: "grid", placeItems: "center" }}>
            <MsGlyph name="back" size={20} sw={2.1} color={T.ink} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Réglages du matching</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 1 }}>Quels matchs MEGGA te propose</div>
          </div>
        </header>

        {/* Corps */}
        <main className="msScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 18px 130px", WebkitOverflowScrolling: "touch" }}>
          <h1 style={{ margin: "0 4px 20px", fontSize: 22, fontWeight: 800, letterSpacing: -0.7, color: T.ink, lineHeight: 1.2 }}>Combien de biens proposer&nbsp;?</h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MS_MODES.map((m) => {
              const on = m.id === mode;
              return (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit",
                  background: on ? T.cardSubtle : T.card, borderRadius: 18, padding: 18, display: "flex", gap: 15, alignItems: "flex-start",
                  boxShadow: on ? `0 0 0 2px ${T.ink} inset, ${T.shadowSm}` : T.shadowSm, transition: "box-shadow .18s ease, background .18s ease",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, color: T.ink }}>{m.name}</span>
                      {m.reco && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.accentInk, background: T.ink, padding: "2px 8px", borderRadius: 999 }}>Conseillé</span>}
                      <span style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
                        background: on ? T.ink : "transparent", boxShadow: on ? "none" : `0 0 0 2px ${T.ghost} inset` }}>
                        {on && <MsGlyph name="check" size={13} sw={2.6} color={T.accentInk} />}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginTop: 3 }}>{m.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </main>

        {/* Footer CTA */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 18px calc(18px + env(safe-area-inset-bottom))", background: `linear-gradient(to top, ${T.canvas} 70%, transparent)` }}>
          <button onClick={save} style={{ width: "100%", height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, letterSpacing: -0.2, color: T.accentInk, background: T.ink, boxShadow: T.shadowLg, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            <MsGlyph name="check" size={18} sw={2.4} color={T.accentInk} />Enregistrer
          </button>
        </div>
      </div>
    </window.MTCtx.Provider>
  );
};

window.MmMatchingSettings = MmMatchingSettings;
