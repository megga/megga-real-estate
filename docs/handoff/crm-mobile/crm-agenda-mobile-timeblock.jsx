// MEGGA CRM — Responsive · Écran « Agenda » MOBILE — variante TIME-BLOCKING
// Option 1 : grille horaire continue où la HAUTEUR de chaque carte reflète la
// durée réelle du RDV (grammaire Fantastical / Cron / Google Calendar), posée
// sur un rail d'heures avec ligne « maintenant ». Réutilise tout le chrome,
// les données et la feuille de détail de crm-agenda-mobile.jsx via window.*.
// Direction Sugar Pure : surfaces blanches, ombres douces, accent noir,
// couleurs fonctionnelles MEGGA en liseré de bord uniquement.

const TB_useMT = () => React.useContext(window.MTCtx);
const TB_PX_PER_MIN = 1.7;          // échelle verticale
const TB_MIN_H = 38;                // hauteur mini d'une carte lisible
const TB_GUTTER = 50;               // largeur du rail d'heures

// ═══════════════════════════════════════════════════════════════════════
//  GRILLE TIME-BLOCKING
// ═══════════════════════════════════════════════════════════════════════
const AgTimeGrid = ({ events, isToday, onOpen, onFree }) => {
  const T = TB_useMT();
  const { agMin, agEnd, agFmtDur, AG_TYPES, agTone, AG_NOW_MIN } = window;
  const Me = window.MEIcon;

  if (!events.length) {
    return (
      <div style={{ marginTop: 22, padding: "44px 24px", textAlign: "center", background: T.card, borderRadius: 18, boxShadow: T.shadowSm }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: T.cardSubtle, display: "grid", placeItems: "center", margin: "0 auto" }}>
          <Me name="calendar" size={24} color={T.muted} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: T.ink, marginTop: 14 }}>Journée libre</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginTop: 5, maxWidth: 240, marginInline: "auto", lineHeight: 1.45 }}>Bloquez du temps pour vos acheteurs chauds ou avancez sur le pipeline.</div>
      </div>
    );
  }

  // bornes de la grille (arrondies à l'heure), inclut « maintenant » si aujourd'hui
  const starts = events.map((e) => agMin(e.start));
  const ends = events.map((e) => agMin(e.start) + (e.dur || 30));
  const gridStart = Math.floor(Math.min(...starts) / 60) * 60;
  const gridEnd = Math.ceil((Math.max(...ends, isToday ? AG_NOW_MIN + 20 : 0)) / 60) * 60;
  const totalMin = gridEnd - gridStart;
  const H = totalMin * TB_PX_PER_MIN;
  const yOf = (m) => (m - gridStart) * TB_PX_PER_MIN;

  const hours = [];
  for (let m = gridStart; m <= gridEnd; m += 60) hours.push(m);

  const nowVisible = isToday && AG_NOW_MIN >= gridStart && AG_NOW_MIN <= gridEnd;
  const nowStr = `${String(Math.floor(AG_NOW_MIN / 60)).padStart(2, "0")}:${String(AG_NOW_MIN % 60).padStart(2, "0")}`;
  const lineColor = T.mode === "dark" ? "rgba(255,255,255,0.14)" : "#D2D7DF";

  return (
    <div style={{ position: "relative", marginTop: 18, height: H, paddingBottom: 8 }}>
      {/* lignes d'heures + labels du rail */}
      {hours.map((m) => (
        <div key={m} style={{ position: "absolute", left: 0, right: 0, top: yOf(m), display: "flex", alignItems: "center", pointerEvents: "none" }}>
          <span style={{ width: TB_GUTTER - 8, textAlign: "right", paddingRight: 10, fontSize: 11, fontWeight: 700, color: T.muted, fontVariantNumeric: "tabular-nums", transform: "translateY(-50%)", lineHeight: 1 }}>
            {String(Math.floor(m / 60)).padStart(2, "0")}:00
          </span>
          <span style={{ flex: 1, height: 1, background: lineColor }} />
        </div>
      ))}

      {/* événements posés proportionnellement */}
      {events.map((e) => {
        const tp = AG_TYPES[e.type];
        const tone = agTone(e.type, T);
        const sM = agMin(e.start);
        const dur = e.dur || 0;
        const past = e.status === "done" || (isToday && sM + dur <= AG_NOW_MIN);
        const photo = e.property && e.property.photo;

        // RDV instantané (publication) → marqueur fin
        if (dur === 0) {
          return (
            <button key={e.id} onClick={() => onOpen(e)} style={{
              position: "absolute", left: TB_GUTTER, right: 2, top: yOf(sM) - 1, height: 34,
              display: "flex", alignItems: "center", gap: 10, padding: "0 13px", border: 0, cursor: "pointer", fontFamily: "inherit",
              background: T.card, borderRadius: 12, boxShadow: T.shadowSm, opacity: past ? 0.6 : 1,
              boxShadow: `${T.shadowSm}${T.mode === "dark" ? `, inset 0 0 0 1px ${T.cardBorder}` : ""}`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tone, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: -0.2, color: past ? T.muted : T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>{e.title}</span>
              <Me name="chevron-right" size={15} color={T.ghost} strokeWidth={2} />
            </button>
          );
        }

        const rawH = dur * TB_PX_PER_MIN;
        const h = Math.max(rawH, TB_MIN_H) - 4;
        const compact = h < 56;

        return (
          <button key={e.id} onClick={() => onOpen(e)} style={{
            position: "absolute", left: TB_GUTTER, right: 2, top: yOf(sM) + 2, height: h,
            textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", overflow: "hidden",
            background: T.card, borderRadius: 14, padding: compact ? "0 13px 0 16px" : "11px 13px 11px 16px",
            display: "flex", alignItems: compact ? "center" : "flex-start", gap: 11, opacity: past ? 0.62 : 1,
            boxShadow: `${T.shadowSm}${T.mode === "dark" ? `, inset 0 0 0 1px ${T.cardBorder}` : ""}`,
          }}>
            {/* liseré de type (encode la couleur fonctionnelle) */}
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: tone, opacity: past ? 0.5 : 1 }} />

            {compact ? (
              <React.Fragment>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.3, color: past ? T.muted : T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0, textDecoration: e.status === "done" ? "line-through" : "none", textDecorationColor: T.ghost }}>{e.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: past ? T.ghost : T.muted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{e.start}</span>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: tone }}>{tp.label}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ghost, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{agFmtDur(dur)}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: past ? T.muted : T.ink, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: e.status === "done" ? "line-through" : "none", textDecorationColor: T.ghost }}>{e.title}</div>
                  {h >= 74 && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: "auto", paddingTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.contact ? e.contact.name : (e.location || (e.property && e.property.addr) || "—")}
                    </div>
                  )}
                </div>
                {/* vignette / état à droite */}
                {e.status === "done" ? (
                  <Me name="check-circle" size={20} color={T.ghost} />
                ) : e.risk ? (
                  <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: 0.3, color: T.riskFg, background: T.riskBg, padding: "4px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>À RISQUE</span>
                ) : photo && h >= 64 ? (
                  <div style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", flexShrink: 0, background: T.cardSubtle }}>
                    <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
                    <Me name={tp.icon} size={18} color={tone} strokeWidth={1.9} />
                  </div>
                )}
              </React.Fragment>
            )}
          </button>
        );
      })}

      {/* ligne « maintenant » */}
      {nowVisible && (
        <div style={{ position: "absolute", left: 0, right: 2, top: yOf(AG_NOW_MIN), display: "flex", alignItems: "center", pointerEvents: "none", zIndex: 5 }}>
          <span style={{ width: TB_GUTTER - 8, textAlign: "right", paddingRight: 8, fontSize: 10, fontWeight: 800, color: "#E54D38", fontVariantNumeric: "tabular-nums", transform: "translateY(-50%)", lineHeight: 1 }}>{nowStr}</span>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: "#E54D38", flexShrink: 0, boxShadow: "0 0 0 4px rgba(229,77,56,0.16)", transform: "translateX(-1px)" }} />
          <span style={{ flex: 1, height: 2, background: "#E54D38", borderRadius: 999 }} />
        </div>
      )}
    </div>
  );
};

// En-tête local (sans wordmark) — propre à cette variante
const TbHeader = () => {
  const T = TB_useMT();
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
      <window.MAv bg={T.accent} ink={T.accentInk} size={38}>GL</window.MAv>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN — réutilise header / week strip / detail sheet / new sheet
// ═══════════════════════════════════════════════════════════════════════
const MobileAgendaTimeblockScreen = ({ dark = false }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const { agDayEvents, agMin, AG_DAYS, AG_MONTH, AG_NOW_MIN, agFmtDur, AgTabBar, AgWeekStrip, AgDetailSheet, AgNewEventSheet } = window;

  const [selOff, setSelOff] = React.useState(0);
  const [detail, setDetail] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [extra, setExtra] = React.useState([]);
  const [statuses, setStatuses] = React.useState({}); // { eventId: "done" }
  const [toast, setToast] = React.useState(null);
  const mainRef = React.useRef(null);
  const pushToast = (msg) => { setToast(msg); window.clearTimeout(pushToast._t); pushToast._t = window.setTimeout(() => setToast(null), 1900); };

  const isToday = selOff === 0;
  const events = React.useMemo(() => {
    const base = agDayEvents(selOff);
    const mine = extra.filter((e) => e.off === selOff);
    return [...base, ...mine]
      .map((e) => statuses[e.id] !== undefined ? { ...e, status: statuses[e.id] } : e)
      .sort((a, b) => agMin(a.start) - agMin(b.start));
  }, [selOff, extra, statuses]);

  const toggleDone = (ev) => {
    setStatuses((s) => {
      const cur = s[ev.id] !== undefined ? s[ev.id] : ev.status;
      return { ...s, [ev.id]: cur === "done" ? "" : "done" };
    });
  };

  // synthèse de la journée
  const total = events.reduce((s, e) => s + (e.dur || 0), 0);

  // amène « maintenant » près du haut au chargement (aujourd'hui)
  React.useEffect(() => {
    if (!mainRef.current) return;
    if (isToday) {
      const firstStart = events.length ? agMin(events[0].start) : AG_NOW_MIN;
      const gridStart = Math.floor(firstStart / 60) * 60;
      const y = (AG_NOW_MIN - gridStart) * TB_PX_PER_MIN;
      mainRef.current.scrollTo({ top: Math.max(0, y - 130), behavior: "auto" });
    } else {
      mainRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [selOff]);

  const handleCreate = (draft) => {
    setExtra((prev) => [...prev, { ...draft, id: "new-" + Date.now(), contact: draft.contact ? { name: draft.contact, role: "Acheteur" } : null }]);
    setCreating(false);
    pushToast("Événement ajouté");
  };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden" }}>
        <style>{`
          @keyframes agScrim { from { opacity:0 } to { opacity:1 } }
          @keyframes agSheet { from { opacity:0; transform: translateY(40px) } to { opacity:1; transform: translateY(0) } }
          @keyframes agToast { from { opacity:0; transform: translate(-50%, 8px) } to { opacity:1; transform: translate(-50%, 0) } }
          .agScroll::-webkit-scrollbar { width:0; height:0 }
        `}</style>

        <TbHeader />

        <main ref={mainRef} className="agScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 24px", WebkitOverflowScrolling: "touch" }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Agenda</h1>

          <AgWeekStrip selOff={selOff} onSelect={setSelOff} />

          {/* synthèse de la journée */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink }}>
              {events.length ? `${events.length} RDV` : "Aucun RDV"}
            </span>
            {total > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>· {agFmtDur(total)} planifiées</span>}
          </div>

          <AgTimeGrid events={events} isToday={isToday} onOpen={setDetail} onFree={() => setCreating(true)} />
        </main>

        {/* FAB — nouveau RDV, bas-droite au-dessus de la tab bar (masqué quand une feuille est ouverte) */}
        {!detail && !creating && (
        <button onClick={() => setCreating(true)} aria-label="Nouvel événement" style={{
          position: "absolute", right: 18, bottom: 92, zIndex: 70, width: 56, height: 56, borderRadius: 999,
          border: 0, cursor: "pointer", background: T.accent, color: T.accentInk,
          boxShadow: "0 14px 30px rgba(11,12,14,0.30), 0 4px 12px rgba(11,12,14,0.18)",
          display: "grid", placeItems: "center",
        }}>
          <window.MEIcon name="plus" size={24} color={T.accentInk} strokeWidth={2.2} />
        </button>
        )}

        <AgTabBar />

        {detail && <AgDetailSheet event={detail} onClose={() => setDetail(null)} onToast={pushToast} onToggleDone={toggleDone} />}
        {creating && <AgNewEventSheet selOff={selOff} onClose={() => setCreating(false)} onCreate={handleCreate} />}

        {toast && (
          <div style={{ position: "absolute", left: "50%", bottom: 92, transform: "translateX(-50%)", zIndex: 80,
            padding: "11px 18px", borderRadius: 999, background: "rgba(11,12,14,0.94)", color: "#fff", fontSize: 13, fontWeight: 700,
            whiteSpace: "nowrap", boxShadow: "0 12px 30px rgba(0,0,0,0.3)", animation: "agToast .26s cubic-bezier(.2,.8,.2,1) both" }}>
            {toast}
          </div>
        )}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileAgendaTimeblockScreen = MobileAgendaTimeblockScreen;
window.AgTimeGrid = AgTimeGrid;
