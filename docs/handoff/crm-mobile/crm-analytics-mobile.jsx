// MEGGA CRM — Responsive · Écran « Analytics / Performance » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). « Le Cockpit Commission » du desktop
// reformulé en LECTURE D'ABORD, une seule colonne empilée : héros commission
// projetée → trajectoire → KPI 2×2 → ce qui se signe → composition → sources.
// Tout est tactile (≥44px). Switch de période + drilldown en bottom-sheet.
//
// Réutilise les atomes/tokens partagés mobile (window.MTCtx / MIcon / MAv / MEGGAWordmark / MRing)
// ET les données du desktop Analytics (window.AX_DATA / axCHF / axPace / AX_DEALS / AX_RECORDS
// / axApplyTarget / axTargetFor). Aucune donnée n'est ré-inventée.

const AxM_useMT = () => React.useContext(window.MTCtx);

// ─── Glyphes complémentaires (non présents dans MT_ICONS) ───────────────
const AxMGlyph = ({ name, size = 14, sw = 2, color = "currentColor" }) => {
  const P = {
    up:    "M5 14l7-7 7 7",
    down:  "M5 10l7 7 7-7",
    lock:  "M6 10.5h12V20H6z M8.5 10.5V8a3.5 3.5 0 017 0v2.5",
    refresh:"M4 11a8 8 0 0113.9-4.9M20 5v4h-4 M20 13a8 8 0 01-13.9 4.9M4 19v-4h4",
    target:"M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z M12 8a4 4 0 100 8 4 4 0 000-8z M12 11.5a.5.5 0 100 1 .5.5 0 000-1z",
    chevR: "M9 6l6 6-6 6",
    chevL: "M15 6l-6 6 6 6",
    dots:  "M12 5.5h.01 M12 12h.01 M12 18.5h.01",
    download:"M12 4v11 M7.5 10.5L12 15l4.5-4.5 M5 19.5h14",
    share: "M16 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M8 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M16 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M10.1 10.8l3.8-2.1 M10.1 13.2l3.8 2.1",
    calClock:"M5 8.5h14 M7.5 4.5V7 M16.5 4.5V7 M5 6.5h14V19a1 1 0 01-1 1H6a1 1 0 01-1-1V6.5z M12 12v2.5l1.6 1",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d={P[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Pilule de delta (données métier → pleine couleur + texte blanc) ────
const AxMDelta = ({ v, pts, abs }) => {
  const T = AxM_useMT();
  if (v === 0) return <span style={{ fontSize: 11, fontWeight: 800, color: T.muted }}>—</span>;
  const up = v > 0;
  const bg = up ? "#15643F" : "#A0521E";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 999, background: bg, color: "#fff", fontSize: 10.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      <AxMGlyph name={up ? "up" : "down"} size={9} sw={3} color="#fff" />
      {up ? "+" : ""}{v}{pts ? " pt" : abs ? "" : "%"}
    </span>
  );
};

// ─── Sparkline KPI ──────────────────────────────────────────────────────
const AxMSpark = ({ data, up }) => {
  const T = AxM_useMT();
  const W = 58, H = 22, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [ (i / (data.length - 1)) * W, H - ((v - min) / span) * (H - 3) - 1.5 ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const col = up ? T.goal : "#C45A00";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flexShrink: 0 }}>
      <path d={d} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={col} />
    </svg>
  );
};

// ─── Barre de rythme (réalisé → projeté → objectif), sur héros sombre ───
const AxMPaceBar = ({ d, ink, mut }) => {
  const realW = Math.min(100, (d.realizedNow / d.target) * 100);
  const projW = Math.min(100, (d.projectedEnd / d.target) * 100);
  const paceX = Math.min(100, d.paceFrac * 100);
  const track = "rgba(255,255,255,0.13)";
  return (
    <div>
      <div style={{ position: "relative", height: 16, borderRadius: 999, background: track, overflow: "visible", marginTop: 26 }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${projW}%`, borderRadius: 999,
          backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.34) 0 5px, transparent 5px 10px)` }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${realW}%`, borderRadius: 999, background: ink, transition: "width .8s cubic-bezier(.2,.8,.2,1)" }} />
        <div style={{ position: "absolute", left: `${paceX}%`, top: -5, bottom: -5, width: 2, background: mut, transform: "translateX(-1px)", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: `${paceX}%`, top: -19, transform: "translateX(-50%)", fontSize: 8.5, fontWeight: 800, color: mut, letterSpacing: 0.6, whiteSpace: "nowrap", textTransform: "uppercase" }}>rythme</div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
        {[
          { sw: ink, t: "Réalisé", v: window.axCHF(d.realizedNow) },
          { sw: "hatch", t: "Projeté", v: window.axCHF(d.projectedEnd) },
          { sw: null, t: "Objectif", v: window.axCHF(d.target) },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0,
              background: l.sw === "hatch" ? undefined : (l.sw || "transparent"),
              backgroundImage: l.sw === "hatch" ? `repeating-linear-gradient(45deg, ${mut} 0 3px, transparent 3px 6px)` : undefined,
              boxShadow: l.sw ? "none" : `inset 0 0 0 1.5px ${mut}` }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: mut }}>{l.t}</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: ink, fontVariantNumeric: "tabular-nums" }}>{String(l.v).replace("CHF ", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Héros : commission projetée (carte immersive) ──────────────────────
const AxMHero = ({ d, onSettings }) => {
  const T = AxM_useMT();
  const pace = window.axPace(d);
  const ink = T.relanceInk, mut = T.relanceMuted;
  const verdictBg = pace.ahead ? "#15643F" : "#A0521E";
  return (
    <div style={{ marginTop: 18, background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 24, padding: "22px 22px 20px", boxShadow: T.shadowLg, color: ink }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: mut }}>
        Commission projetée · {d.label}
      </div>
      <div style={{ marginTop: 9, fontSize: 40, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {window.axCHF(d.projectedEnd)}
      </div>
      <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, background: verdictBg, color: "#fff", fontSize: 11.5, fontWeight: 800, letterSpacing: -0.1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          <AxMGlyph name={pace.ahead ? "up" : "down"} size={11} sw={2.6} color="#fff" />
          {pace.ahead ? "En avance" : "En retard"} {window.axCHF(Math.abs(pace.diff)).replace("CHF ", "")}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: mut, whiteSpace: "nowrap" }}>vs rythme</span>
      </div>
      <AxMPaceBar d={d} ink={ink} mut={mut} />
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, color: mut }}>
        <AxMGlyph name="lock" size={12} sw={1.9} color={mut} />
        <span>Objectif fixé par l'agence ·</span>
        <button onClick={onSettings} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, color: ink, textDecoration: "underline", textUnderlineOffset: 2 }}>
          Réglages
        </button>
      </div>
    </div>
  );
};

// ─── Carte trajectoire (mini area chart + ligne objectif) ───────────────
const AxMTrajectory = ({ d }) => {
  const T = AxM_useMT();
  const s = d.series, W = 300, H = 132, padT = 12, padB = 16, padX = 2;
  const n = s.n, yMax = s.yMax;
  const X = (i) => padX + (i / (n - 1)) * (W - 2 * padX);
  const Y = (v) => H - padB - (v / yMax) * (H - padT - padB);
  const realPts = s.real.map((v, i) => [X(i), Y(v)]);
  const projPts = s.proj.map((v, k) => [X(s.elapsed + k), Y(v)]);
  const goalPts = s.goal.map((v, i) => [X(i), Y(v)]);
  const toPath = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = realPts[realPts.length - 1];
  const area = toPath(realPts) + ` L${last[0].toFixed(1)} ${(H - padB).toFixed(1)} L${realPts[0][0].toFixed(1)} ${(H - padB).toFixed(1)} Z`;
  return (
    <div style={{ marginTop: 24, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, padding: "18px 16px 14px", boxShadow: T.shadowSm }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>Trajectoire vers l'objectif</h3>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, whiteSpace: "nowrap" }}>{d.granularity}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", height: 132 }}>
        <path d={area} fill={T.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(11,12,14,0.05)"} stroke="none" />
        <path d={toPath(goalPts)} fill="none" stroke={T.goal} strokeWidth={1.6} strokeDasharray="4 4" strokeLinecap="round" />
        <path d={toPath(realPts)} fill="none" stroke={T.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(projPts)} fill="none" stroke={T.ink} strokeWidth={2.4} strokeDasharray="2 5" strokeLinecap="round" opacity={0.55} />
        <circle cx={last[0]} cy={last[1]} r={3.4} fill={T.ink} stroke={T.card} strokeWidth={2} />
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: T.inkSoft }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: T.ink }} /> Réalisé
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: T.inkSoft }}>
          <span style={{ width: 14, height: 0, borderTop: `2px dashed ${T.goal}` }} /> Objectif
        </span>
      </div>
    </div>
  );
};

// ─── KPI 2×2 ─────────────────────────────────────────────────────────────
const AxMKpis = ({ d }) => {
  const T = AxM_useMT();
  return (
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
      {d.kpis.map((k, i) => (
        <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "13px 14px", boxShadow: T.shadowSm, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, minHeight: 28 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, lineHeight: 1.25 }}>{k.label}</span>
            <AxMDelta v={k.delta} pts={k.pts} abs={k.abs} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: T.ink, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{k.value}</span>
            <AxMSpark data={k.spark} up={k.delta >= 0} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Ce qui se signe bientôt (liste tactile → sheet) ────────────────────
const AxMClosing = ({ onDrill }) => {
  const T = AxM_useMT();
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 11px", fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.4, padding: "0 2px" }}>Ce qui se signe bientôt</h3>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, boxShadow: T.shadowSm, overflow: "hidden" }}>
        {window.AX_DEALS.map((dl, i) => (
          <button key={i} onClick={() => onDrill({ type: "deal", deal: dl })} style={{
            width: "100%", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
            boxShadow: i === window.AX_DEALS.length - 1 ? "none" : `inset 0 -1px 0 ${T.hair}`,
          }}>
            <div style={{ width: 44, flexShrink: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{dl.prob}%</div>
              <div style={{ height: 4, borderRadius: 999, background: T.cardSubtle, overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", width: `${dl.prob}%`, background: T.ink, borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dl.prop} · {dl.loc}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted, marginTop: 1 }}>{dl.stage} · {dl.when}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{window.axCHF(dl.comm).replace("CHF ", "")}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.muted }}>commission</div>
            </div>
            <AxMGlyph name="chevR" size={16} sw={2} color={T.ghost} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── De quoi est fait le projeté (composition → sheet) ──────────────────
const AxMComposition = ({ d, onDrill }) => {
  const T = AxM_useMT();
  const total = d.composition.reduce((s, c) => s + c.v, 0);
  const ramp = T.mode === "dark"
    ? { secured: "#F3F4F6", probable: "#878D98", possible: "#41454D" }
    : { secured: "#0B0C0E", probable: "#7B828C", possible: "#CDD1D7" };
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 11, padding: "0 2px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.4 }}>De quoi est fait le projeté</h3>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{window.axCHF(total).replace("CHF ", "")}</span>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, boxShadow: T.shadowSm, padding: "16px 14px 8px" }}>
        <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 14 }}>
          {d.composition.map((c, i) => (
            <div key={i} style={{ width: `${(c.v / total) * 100}%`, background: ramp[c.k], transition: "width .7s cubic-bezier(.2,.8,.2,1)" }} />
          ))}
        </div>
        {d.composition.map((c, i) => (
          <button key={i} onClick={() => onDrill({ type: "bucket", bucket: c.k })} style={{
            width: "100%", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            display: "flex", alignItems: "center", gap: 11, padding: "10px 4px",
            boxShadow: i === d.composition.length - 1 ? "none" : `inset 0 -1px 0 ${T.hair}`,
          }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, background: ramp[c.k], flexShrink: 0, boxShadow: c.k === "possible" ? `inset 0 0 0 1px ${T.ghost}` : "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{c.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{c.hint}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{window.axCHF(c.v).replace("CHF ", "")}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: T.muted, fontVariantNumeric: "tabular-nums" }}>{Math.round((c.v / total) * 100)} %</div>
            </div>
            <AxMGlyph name="chevR" size={15} sw={2} color={T.ghost} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Sources des deals ──────────────────────────────────────────────────
const AxMSources = ({ d }) => {
  const T = AxM_useMT();
  const opac = [1, 0.72, 0.52, 0.38, 0.28];
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.4, padding: "0 2px" }}>Sources des deals</h3>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted, padding: "0 2px", marginBottom: 11 }}>D'où vient ton chiffre · {d.label}</div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, boxShadow: T.shadowSm, padding: "8px 14px" }}>
        {d.sources.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", boxShadow: i === d.sources.length - 1 ? "none" : `inset 0 -1px 0 ${T.hair}` }}>
            <span style={{ width: 16, fontSize: 11, fontWeight: 800, color: T.muted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              <div style={{ height: 7, borderRadius: 999, background: T.cardSubtle, overflow: "hidden", marginTop: 6 }}>
                <div style={{ height: "100%", width: `${s.pct}%`, background: T.ink, opacity: opac[i] ?? 0.3, borderRadius: 999, transition: "width .7s cubic-bezier(.2,.8,.2,1)" }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 64 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{window.axCHF(s.comm).replace("CHF ", "")}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.muted }}>{s.deals} deal{s.deals > 1 ? "s" : ""} · {s.pct}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Bottom-sheet drilldown (records derrière un agrégat) ───────────────
const AxMSheet = ({ drill, onClose }) => {
  const T = AxM_useMT();
  const [closing, setClosing] = React.useState(false);
  const close = React.useCallback(() => { setClosing(true); setTimeout(onClose, 240); }, [onClose]);
  if (!drill) return null;

  let eyebrow, title, sub, records, total;
  if (drill.type === "bucket") {
    const b = window.AX_RECORDS[drill.bucket];
    eyebrow = "Composition"; title = b.label; sub = b.hint; records = b.items;
    total = b.items.reduce((s, x) => s + x.comm, 0);
  } else {
    const dl = drill.deal;
    eyebrow = "Deal · " + dl.stage; title = dl.prop + " · " + dl.loc;
    sub = `${window.axCHF(dl.gmv)} · ${dl.prob}% · ${dl.when}`;
    records = window.AX_RECORDS.probable.items.concat(window.AX_RECORDS.secured.items)
      .filter((r) => r.loc !== dl.loc).slice(0, 3);
    total = dl.comm;
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: T.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(11,12,14,0.36)", opacity: closing ? 0 : 1, transition: "opacity .24s ease", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", background: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        boxShadow: T.shadowLg, maxHeight: "78%", display: "flex", flexDirection: "column",
        transform: closing ? "translateY(102%)" : "translateY(0)", transition: "transform .28s cubic-bezier(.2,.85,.25,1)",
        paddingBottom: 22,
      }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: T.hair }} />
        </div>
        <div style={{ padding: "12px 22px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: T.muted }}>{eyebrow}</div>
            <h3 style={{ margin: "6px 0 0", fontSize: 21, fontWeight: 800, letterSpacing: -0.6, color: T.ink, lineHeight: 1.12 }}>{title}</h3>
            <div style={{ marginTop: 5, fontSize: 12, fontWeight: 600, color: T.muted, fontVariantNumeric: "tabular-nums" }}>{sub}</div>
          </div>
          <button onClick={close} style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: T.cardSubtle, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke={T.inkSoft} strokeWidth={2.2} strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ padding: "0 16px", display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, paddingLeft: 6 }}>{drill.type === "bucket" ? `${records.length} dossiers` : "Deals comparables"}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", paddingRight: 6 }}>{window.axCHF(total)}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 8px", WebkitOverflowScrolling: "touch" }}>
          {records.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", borderRadius: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.prop} · {r.loc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, background: T.cardSubtle, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{r.state}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, fontVariantNumeric: "tabular-nums" }}>{window.axCHF(r.gmv)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{window.axCHF(r.comm).replace("CHF ", "")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 4 }}>
                  <div style={{ width: 38, height: 4, borderRadius: 999, background: T.cardSubtle, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.prob}%`, background: T.ink, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{r.prob}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 18px 0" }}>
          <button onClick={close} style={{
            width: "100%", height: 48, borderRadius: 999, border: 0, background: T.accent, color: T.accentInk,
            fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: -0.1,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            Ouvrir dans le Pipeline filtré
            <window.MIcon name="arrow" size={16} sw={2} color={T.accentInk} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Segmented période ───────────────────────────────────────────────────
const AxM_PERIODS = [ { id: "month", label: "Mois" }, { id: "quarter", label: "Trimestre" }, { id: "year", label: "Année" } ];
const AxMSegment = ({ value, onChange }) => {
  const T = AxM_useMT();
  return (
    <div style={{ marginTop: 16, display: "flex", padding: 4, borderRadius: 999, background: T.cardSubtle, gap: 3, boxShadow: T.mode === "dark" ? `inset 0 0 0 1px ${T.cardBorder}` : "none" }}>
      {AxM_PERIODS.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            flex: 1, height: 38, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit",
            background: on ? T.accent : "transparent", color: on ? T.accentInk : T.inkSoft,
            fontSize: 13, fontWeight: on ? 800 : 700, letterSpacing: -0.1, whiteSpace: "nowrap",
            boxShadow: on ? T.shadowSm : "none", transition: "background .15s ease, color .15s ease",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
};

// ─── Header + barre d'onglets (réutilisent les atomes partagés) ─────────
const AxMHeader = ({ onRefresh, spinning, onBack }) => {
  const T = AxM_useMT();
  const [menu, setMenu] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);
  const ITEMS = [
    { id: "pdf",      label: "Exporter en PDF",   icon: "download" },
    { id: "share",    label: "Partager le rapport", icon: "share" },
    { id: "schedule", label: "Planifier un envoi", icon: "calClock" },
  ];
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <button onClick={onBack} aria-label="Retour" style={{ display: "flex", alignItems: "center", gap: 8, height: 38, paddingLeft: 6, paddingRight: 14, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, fontFamily: "inherit" }}>
        <span style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center" }}>
          <AxMGlyph name="chevL" size={18} sw={2.2} color={T.ink} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>Plus</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onRefresh} style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}>
          <span style={{ display: "inline-flex", transition: "transform 1s cubic-bezier(.2,.8,.2,1)", transform: spinning ? "rotate(-360deg)" : "none" }}>
            <AxMGlyph name="refresh" size={17} sw={2} color={T.ink} />
          </span>
        </button>
      </div>
    </header>
  );
};

const AxM_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const AxMTabBar = () => {
  const T = AxM_useMT();
  const active = "more";
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {AxM_TABS.map((tb) => {
        const on = tb.id === active;
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
//  ÉCRAN ANALYTICS MOBILE
// ═══════════════════════════════════════════════════════════════════════
const MobileAnalyticsScreen = ({ dark = false, onBack = () => {} }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const [period, setPeriod] = React.useState("year");
  const [drill, setDrill] = React.useState(null);
  const [spin, setSpin] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  const base = window.AX_DATA[period];
  const d = window.axApplyTarget(base, window.axTargetFor(period, window.AX_DEFAULT_ANNUAL_TARGET));

  const onPeriod = (p) => { if (p === period) return; setPeriod(p); setNonce((k) => k + 1); };
  const refresh = () => { if (spin) return; setSpin(true); setNonce((k) => k + 1); setTimeout(() => setSpin(false), 1000); };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden" }}>
        <style>{`@keyframes axmRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
        <AxMHeader onRefresh={refresh} spinning={spin} onBack={onBack} />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 24px", WebkitOverflowScrolling: "touch" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: T.muted, display: "none" }}>Performance</div>
          <h1 style={{ margin: "0", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Ton cockpit commission</h1>

          <AxMSegment value={period} onChange={onPeriod} />

          <div key={nonce} style={{ animation: "axmRise .42s cubic-bezier(.2,.8,.2,1) both" }}>
            <AxMHero d={d} onSettings={() => {}} />
            <AxMTrajectory d={d} />
            <AxMKpis d={d} />
            <AxMClosing onDrill={setDrill} />
            <AxMComposition d={d} onDrill={setDrill} />
            <AxMSources d={d} />
          </div>
        </main>
        <AxMTabBar />
        {drill && <AxMSheet drill={drill} onClose={() => setDrill(null)} />}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileAnalyticsScreen = MobileAnalyticsScreen;
