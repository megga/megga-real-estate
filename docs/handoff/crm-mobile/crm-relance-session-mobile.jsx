// MEGGA CRM — Responsive · Écran « Session de relance » MOBILE (375–402)
// Pendant portrait de la session desktop (DBRelanceSession), pensé une décision
// à la fois : contexte lead → brouillon MEGGA AI éditable + tons IA → action
// (Envoyer / Appeler / Reporter J+7). Sugar Pure, theme-aware (clair + sombre).
// Données + persistance PARTAGÉES avec le desktop :
//   window.RELANCE_LEADS · getInitialDraft · TONE_VARIANTS · TONE_ACTIONS
//   localStorage "megga.session.relance.v1" (pause / reprise communes).
// Atomes via window.* (crm-mobile-today.jsx) : MTCtx, MIcon, MT_LIGHT/DARK, MT_STAGE.

const RS_useMT = () => React.useContext(window.MTCtx);

// ─── Persistance — MÊME clé que le desktop (pause/reprise communes) ──────
const RS_KEY = "megga.session.relance.v1";
const rsLoad = () => { try { const r = localStorage.getItem(RS_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
const rsSave = (s) => { try { localStorage.setItem(RS_KEY, JSON.stringify(s)); } catch (e) {} };
const rsClear = () => { try { localStorage.removeItem(RS_KEY); } catch (e) {} };

// ─── Icônes complémentaires (line-style, cohérentes avec MIcon) ──────────
const RS_ICONS = {
  x:        "M6 6l12 12 M18 6L6 18",
  send:     "M4 12l16-7-7 16-2.5-6.5z",
  mail:     "M3.5 6.5h17v11h-17z M4 7l8 6 8-6",
  sparkle:  "M12 3l1.7 4.8L18.5 9.5 13.7 11.2 12 16l-1.7-4.8L5.5 9.5l4.8-1.7z",
  refresh:  "M19 8a7 7 0 10.6 6 M19 4v4h-4",
  user:     "M12 12a4 4 0 100-8 4 4 0 000 8z M5 20a7 7 0 0114 0",
};
const RSIcon = ({ name, size = 20, sw = 1.9, color = "currentColor" }) => (
  RS_ICONS[name]
    ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
        <path d={RS_ICONS[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    : <window.MIcon name={name} size={size} sw={sw} color={color} />
);

const rsInitials = (l) => `${(l.first || "")[0] || ""}${(l.last || "")[0] || ""}`.toUpperCase();

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═══════════════════════════════════════════════════════════════════════
const MobileRelanceSessionScreen = ({ dark = false, onGo, onClose }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const LEADS = window.RELANCE_LEADS || [];
  const total = LEADS.length;

  // État restauré depuis localStorage (partagé desktop)
  const [state, setState] = React.useState(() => {
    const saved = rsLoad();
    if (saved && typeof saved.currentIdx === "number") return saved;
    return { version: 1, currentIdx: 0, treated: {}, drafts: {}, startedAt: Date.now() };
  });
  React.useEffect(() => { rsSave(state); }, [state]);

  const idx = state.currentIdx;
  const finished = idx >= total;
  const lead = finished ? null : LEADS[idx];

  // Brouillon courant (édits préservés)
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [activeTone, setActiveTone] = React.useState(null);
  React.useEffect(() => {
    if (!lead) return;
    const d = state.drafts[lead.id] || window.getInitialDraft(lead);
    setSubject(d.subject); setBody(d.body); setActiveTone(null);
  }, [lead?.id]);

  const persistDraft = () => {
    if (!lead) return;
    setState((s) => ({ ...s, drafts: { ...s.drafts, [lead.id]: { subject, body } } }));
  };
  const applyTone = (toneId) => {
    if (!lead) return;
    const v = window.TONE_VARIANTS?.[toneId];
    if (!v) return;
    const next = v({ subject, body }, lead);
    setSubject(next.subject); setBody(next.body); setActiveTone(toneId);
    setState((s) => ({ ...s, drafts: { ...s.drafts, [lead.id]: next } }));
  };
  const advance = (action) => {
    if (!lead) return;
    setState((s) => ({
      ...s,
      treated: { ...s.treated, [lead.id]: { action, ts: Date.now() } },
      currentIdx: s.currentIdx + 1,
    }));
    if (typeof document !== "undefined") {
      const main = document.getElementById("rs-scroll");
      if (main) main.scrollTop = 0;
    }
  };

  const treatedCount = Object.keys(state.treated).length;
  const TONES = window.TONE_ACTIONS || [];

  const exit = () => { if (onClose) onClose(); else if (onGo) onGo("today"); };

  if (finished) {
    return (
      <window.MTCtx.Provider value={T}>
        <RsRecap T={T} state={state} total={total}
          onRestart={() => { rsClear(); setState({ version: 1, currentIdx: 0, treated: {}, drafts: {}, startedAt: Date.now() }); }}
          onExit={() => { rsClear(); exit(); }} />
      </window.MTCtx.Provider>
    );
  }

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden" }}>
        <style>{`@keyframes rsUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

        {/* ── Header ── */}
        <header style={{ flexShrink: 0, paddingTop: 54, paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={exit} aria-label="Fermer" style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}>
              <RSIcon name="x" size={19} sw={2} color={T.ink} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }} />
          </div>
        </header>

        {/* ── Corps scrollable ── */}
        <main id="rs-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 16px 18px", WebkitOverflowScrolling: "touch" }}>
          <div key={lead.id} style={{ animation: "rsUp .42s cubic-bezier(.2,.8,.2,1) both" }}>

            {/* Carte contexte lead */}
            <div style={{ background: T.card, borderRadius: 20, boxShadow: T.shadow, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 50, height: 50, borderRadius: 999, flexShrink: 0, background: lead.avatarBg, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{rsInitials(lead)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.first} {lead.last}</span>
                    {lead.kyc === "verified" && window.CvVerifiedBadge && <window.CvVerifiedBadge size={18} />}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.muted, marginTop: 2 }}>Dormant depuis {lead.dormSince} jours</div>
                </div>
              </div>

              <p style={{ margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.5, color: T.inkSoft, fontWeight: 500, textWrap: "pretty" }}>{lead.reason}</p>
            </div>

            {/* Brouillon MEGGA AI */}
            <div style={{ marginTop: 16, background: T.card, borderRadius: 20, boxShadow: T.shadow, padding: 18 }}>
              <style>{`@keyframes rsShine{0%{background-position:-140% 0}60%,100%{background-position:240% 0}}`}</style>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 15 }}>
                <span style={{ position: "relative", width: 34, height: 34, flexShrink: 0, display: "grid", placeItems: "center" }}>
                  <RSIcon name="sparkle" size={22} sw={2.1} color="#9A4EDD" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", background: "linear-gradient(90deg, #6E78F0, #B154D6, #D24A9C, #6E78F0)", backgroundSize: "220% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", animation: "rsShine 4.5s linear infinite" }}>MEGGA AI</div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink, marginTop: 1 }}>Message prêt à envoyer</div>
                </div>
              </div>

              <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", color: T.muted }}>Objet</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={persistDraft}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 6, height: 44, padding: "0 13px", borderRadius: 12, border: 0, outline: "none", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }} />

              <label style={{ display: "block", marginTop: 13, fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", color: T.muted }}>Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={persistDraft} rows={9}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 6, padding: "12px 13px", borderRadius: 12, border: 0, outline: "none", resize: "vertical", background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }} />

              {/* Tons IA */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", color: T.muted, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
                  <RSIcon name="refresh" size={13} sw={2} color={T.muted} />Ajuster le ton
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                  {TONES.map((t) => {
                    const on = activeTone === t.id;
                    return (
                      <button key={t.id} onClick={() => applyTone(t.id)} style={{
                        flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                        border: 0, background: on ? T.ink : T.cardSubtle, color: on ? (T.card === "#FFFFFF" ? "#fff" : T.canvas) : T.inkSoft,
                      }}>{t.label}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Barre d'action sticky ── */}
        <div style={{ flexShrink: 0, padding: "12px 16px 26px", background: T.headerBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}` }}>
          <button onClick={() => advance("sent")} style={{ width: "100%", height: 52, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, color: T.accentInk, background: T.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            <RSIcon name="send" size={18} sw={2} color={T.accentInk} />Envoyer la relance
          </button>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => advance("called")} style={{ flex: 1, height: 46, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: T.ink, background: T.card, boxShadow: T.shadowSm, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <RSIcon name="phone" size={16} sw={2} color={T.ink} />Plutôt appeler
            </button>
            <button onClick={() => advance("postponed")} style={{ flex: 1, height: 46, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: T.inkSoft, background: T.card, boxShadow: T.shadowSm, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <RSIcon name="clock" size={16} sw={2} color={T.inkSoft} />Reporter J+7
            </button>
          </div>
        </div>
      </div>
    </window.MTCtx.Provider>
  );
};

// ─── Récap de fin de session ─────────────────────────────────────────────
const RsRecap = ({ T, state, total, onRestart, onExit }) => {
  const counts = Object.values(state.treated).reduce((a, t) => { a[t.action] = (a[t.action] || 0) + 1; return a; }, {});
  const sent = counts.sent || 0, called = counts.called || 0, postponed = counts.postponed || 0;
  const treated = sent + called + postponed;
  const duration = Math.max(1, Math.round((Date.now() - (state.startedAt || Date.now())) / 60000));
  const rows = [
    { l: "Relances envoyées", v: sent, c: "#066B45", icon: "send" },
    { l: "Appels programmés", v: called, c: "#1E5BC6", icon: "phone" },
    { l: "Reportés à J+7", v: postponed, c: "#B4570A", icon: "clock" },
  ];
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden" }}>
      <style>{`@keyframes rsUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <main style={{ flex: 1, overflowY: "auto", padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ animation: "rsUp .5s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ width: 60, height: 60, borderRadius: 999, background: T.ink, display: "grid", placeItems: "center", margin: "0 auto" }}>
            <RSIcon name="check" size={30} sw={2.4} color={T.accentInk} />
          </div>
          <h1 style={{ margin: "20px 0 0", textAlign: "center", fontSize: 25, fontWeight: 800, letterSpacing: -0.8, color: T.ink }}>Session terminée</h1>
          <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 14, fontWeight: 600, color: T.muted, lineHeight: 1.45 }}>{treated} lead{treated > 1 ? "s" : ""} traité{treated > 1 ? "s" : ""} sur {total} · {duration} min</p>

          <div style={{ marginTop: 26, background: T.card, borderRadius: 20, boxShadow: T.shadow, overflow: "hidden" }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 18px", boxShadow: i < rows.length - 1 ? `inset 0 -1px 0 ${T.hair}` : "none" }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: T.cardSubtle }}><RSIcon name={r.icon} size={17} sw={2} color={r.c} /></span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{r.l}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <div style={{ flexShrink: 0, padding: "12px 20px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onExit} style={{ width: "100%", height: 52, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, color: T.accentInk, background: T.accent }}>Retour à l'accueil</button>
        <button onClick={onRestart} style={{ width: "100%", height: 46, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: T.inkSoft, background: "transparent" }}>Recommencer une session</button>
      </div>
    </div>
  );
};

window.MobileRelanceSessionScreen = MobileRelanceSessionScreen;
