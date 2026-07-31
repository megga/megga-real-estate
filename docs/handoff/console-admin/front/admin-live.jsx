// MEGGA CRM — Console admin · LIVE (concept D « la table nue », juillet 2026)
// ─────────────────────────────────────────────────────────────────────
// Journal d'exploitation : on l'interroge (chips d'entité, filtre d'action,
// recherche) plutôt qu'on le regarde passer.
//   • profondeur 1 — le tableau est posé À MÊME le fond du bento, aucune card ;
//   • le seul mouvement de l'écran est le battement du direct + l'arrivée des
//     lignes (admFadeUp). Aucune animation de survol ;
//   • types = couleurs fonctionnelles MEGGA en pilule pleine, neutre pour le
//     reste — la couleur ne sert que là où elle porte du sens.
(function () {
  const { AdmIcon, AdmPill, AdmChip, AdmGhostBtn, AdmSearch, AdmTh, AdmTd, AdmEmpty,
          admTones, admFieldStyle, admNum, ADM_R } = window;

  const ADV_PAGE = 14;      // lignes ajoutées par « Charger plus »
  const ADV_TICK = 6500;    // cadence d'arrivée du direct

  const advNextClock = (t) => {
    const [h, m] = t.split(":").map(Number);
    const nm = m + 1 + Math.floor(Math.random() * 2);
    return String(h + (nm > 59 ? 1 : 0)).padStart(2, "0") + ":" + String(nm % 60).padStart(2, "0");
  };

  const AdvBeat = ({ live, dark }) => {
    const T = admTones(dark);
    return (
      <span style={{ position: "relative", width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: live ? T.ok : (dark ? "rgba(255,255,255,0.24)" : "#B5BAC2") }}>
        {live && <span style={{ position: "absolute", inset: -5, borderRadius: 999, background: T.ok, animation: "advBeat 1.9s ease-out infinite" }} />}
      </span>
    );
  };

  const AdminLiveSection = ({ sp, surf, dark }) => {
    const T = admTones(dark);
    const S = window.ADMIN_LIVE_STATS;
    const [live, setLive] = React.useState(true);
    const [cat, setCat] = React.useState("all");
    const [action, setAction] = React.useState("");
    const [q, setQ] = React.useState("");
    const [shown, setShown] = React.useState(ADV_PAGE);
    const [feed, setFeed] = React.useState(() => window.ADMIN_LIVE.slice());
    const [clock, setClock] = React.useState(S.clock);
    const poolRef = React.useRef(0);

    // Arrivée du direct — suspendue dès qu'on met en pause
    React.useEffect(() => {
      if (!live) return;
      const id = setInterval(() => {
        const P = window.ADMIN_LIVE_POOL;
        const src = P[poolRef.current % P.length];
        poolRef.current += 1;
        setClock((c) => {
          const t = advNextClock(c);
          setFeed((f) => [{ ...src, id: "lv" + Date.now(), t, fresh: true }, ...f]);
          return t;
        });
      }, ADV_TICK);
      return () => clearInterval(id);
    }, [live]);

    const actions = React.useMemo(() => {
      const set = new Map();
      feed.forEach((e) => set.set(e.action, (set.get(e.action) || 0) + 1));
      return Array.from(set.keys()).sort((a, b) => a.localeCompare(b, "fr"));
    }, [feed]);

    const needle = q.trim().toLowerCase();
    const rows = feed.filter((e) =>
      (cat === "all" || e.cat === cat) &&
      (!action || e.action === action) &&
      (!needle || [e.action, e.type, e.detail, e.agency, e.who].join(" ").toLowerCase().includes(needle))
    );
    const visible = rows.slice(0, shown);
    const injected = feed.length - window.ADMIN_LIVE.length;
    const thSp = { ...sp, tableHeadBg: sp.pageBg };

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <style>{`@keyframes advBeat{0%{transform:scale(.5);opacity:.30}100%{transform:scale(1.35);opacity:0}}`}</style>

        {/* Pouls du flux + commandes */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AdvBeat live={live} dark={dark} />
          <strong style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: sp.ink }}>{live ? "En direct" : "Flux en pause"}</strong>
          <span style={{ fontSize: 15, fontWeight: 500, color: sp.sub }}>
            {admNum(S.day + injected)} événements aujourd'hui
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
            <AdmGhostBtn sp={sp} surf={surf} onClick={() => setLive(!live)}>
              {live ? "Pause" : "Reprendre"}
            </AdmGhostBtn>
          </div>
        </div>

        {/* Interrogation : entité, action, texte libre */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0 8px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
            {window.ADMIN_LIVE_CATS.map((c) => (
              <AdmChip key={c.id} label={c.label} count={c.id === "all" ? undefined : c.count}
                on={cat === c.id} onClick={() => { setCat(c.id); setShown(ADV_PAGE); }} sp={sp} surf={surf} />
            ))}
          </div>
          <select value={action} onChange={(e) => { setAction(e.target.value); setShown(ADV_PAGE); }} aria-label="Filtrer par action"
            style={{ ...admFieldStyle(sp, surf, dark, 36), width: 196, cursor: "pointer", fontSize: 12.5, flexShrink: 0 }}>
            <option value="">Toutes les actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <AdmSearch value={q} onChange={(v) => { setQ(v); setShown(ADV_PAGE); }} placeholder="Agence, auteur, entité…" sp={sp} surf={surf} dark={dark} width={222} />
        </div>

        {/* Table nue — posée sur le fond, jamais dans une card */}
        {visible.length === 0 ? (
          <AdmEmpty sp={sp} icon="broadcast" title="Aucun événement" />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <AdmTh sp={thSp} width={62}>Heure</AdmTh>
                <AdmTh sp={thSp} width={198}>Action</AdmTh>
                <AdmTh sp={thSp} width={116}>Type</AdmTh>
                <AdmTh sp={thSp}>Détail</AdmTh>
                <AdmTh sp={thSp} width={162}>Agence</AdmTh>
                <AdmTh sp={thSp} width={142}>Auteur</AdmTh>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} className="adm-row" style={e.fresh ? { animation: "admFadeUp .34s cubic-bezier(.2,.8,.2,1) both" } : undefined}>
                  <AdmTd sp={sp} dark={dark} numeric style={{ color: sp.sub, fontWeight: 600, fontSize: 11.5, whiteSpace: "nowrap" }}>{e.t}</AdmTd>
                  <AdmTd sp={sp} dark={dark} style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.action}</AdmTd>
                  <AdmTd sp={sp} dark={dark}>
                    <AdmPill sp={sp} surf={surf} dark={dark} tone={window.ADMIN_LIVE_TYPES[e.type] || "neutral"} label={e.type} />
                  </AdmTd>
                  <AdmTd sp={sp} dark={dark} style={{ color: sp.soft, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0 }}>{e.detail}</AdmTd>
                  <AdmTd sp={sp} dark={dark} style={{ color: sp.sub, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.agency}</AdmTd>
                  <AdmTd sp={sp} dark={dark} style={{ color: sp.sub, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.who}</AdmTd>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}` }}>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>
            {visible.length} des {admNum(S.day + injected)} événements du jour{live ? " · flux en direct" : " · flux en pause"}
          </span>
          {shown < rows.length && (
            <button onClick={() => setShown(shown + ADV_PAGE)} style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.soft,
            }}>
              Charger {Math.min(ADV_PAGE, rows.length - shown)} de plus
              <AdmIcon name="chevronR" size={14} color={sp.sub} />
            </button>
          )}
        </div>
      </div>
    );
  };

  Object.assign(window, { AdminLiveSection });
})();
