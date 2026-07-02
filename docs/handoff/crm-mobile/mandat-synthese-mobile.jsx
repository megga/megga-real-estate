// MEGGA CRM — "Importer un mandat" : SYNTHÈSE IA · version MOBILE (portage de C2)
// Liste éditoriale Sugar Pure adaptée au 390px : icône + label/valeur empilés,
// édition inline au tap, CTA collé en bas. Clair & sombre.

const MMT = (dark) => dark ? {
  canvas:  "radial-gradient(ellipse 130% 90% at 50% 0%, #1B1C28 0%, #10111B 52%, #08080C 100%)",
  card:    "#15151F",
  subtle:  "#1E1F2B",
  subtle2: "#272838",
  ink:     "#ECEDF3",
  inkSoft: "#B7B9C6",
  muted:   "#797D90",
  ghost:   "#3F4252",
  hair:    "rgba(255,255,255,0.07)",
  ok:      "#34C796",
  warn:    "#F2B855",
  onBlack: "#0A0A0F",
  accent:  "#ECEDF3",     // accent near-white en dark
  onAccent:"#0A0A0F",
  shadow:  "0 1px 2px rgba(0,0,0,.5), 0 16px 40px -16px rgba(0,0,0,.7)",
} : {
  canvas:  "radial-gradient(ellipse 130% 90% at 50% 0%, #C8D5E0 0%, #E2E5EB 52%, #EDEFF3 100%)",
  card:    "#FFFFFF",
  subtle:  "#F7F8FA",
  subtle2: "#F0F2F6",
  ink:     "#0B0C0E",
  inkSoft: "#3A3D44",
  muted:   "#7A8088",
  ghost:   "#B5BAC2",
  hair:    "#ECEEF2",
  ok:      "#10B981",
  warn:    "#F59E0B",
  onBlack: "#FFFFFF",
  accent:  "#0B0C0E",
  onAccent:"#FFFFFF",
  shadow:  "0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)",
};
const mmFont = "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif";

const MMIcon = ({ name, size = 18, stroke, sw = 1.7 }) => {
  const p = {
    doc:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></>,
    check:   <path d="M20 6 9 17l-5-5"/>,
    x:       <><path d="M18 6 6 18M6 6l12 12"/></>,
    arrow:   <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    pen:     <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    percent: <><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
    user:    <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    home:    <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></>,
    tag:     <><path d="M3 7v4.5a2 2 0 0 0 .6 1.4l7.5 7.5a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.8L11 5.6A2 2 0 0 0 9.6 5H5a2 2 0 0 0-2 2Z"/><circle cx="7.5" cy="9.5" r="1.2"/></>,
    wallet:  <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/><path d="M16 12.5h2.5"/></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{p}</svg>
  );
};

const MM_FIELDS = [
  { key:"type",       icon:"doc",      label:"Type de mandat", value:"Mandat exclusif",       conf:99 },
  { key:"vendor",     icon:"user",     label:"Vendeur",        value:"Jean‑Marc Aebischer",   conf:98 },
  { key:"address",    icon:"home",     label:"Bien",           value:"Ch. de Bellevue 12, Cologny", conf:96 },
  { key:"price",      icon:"tag",      label:"Prix de vente",  value:"CHF 2'450'000",         conf:99 },
  { key:"duration",   icon:"calendar", label:"Durée",          value:"6 mois",                conf:97 },
  { key:"commission", icon:"percent",  label:"Commission",     value:"3,5 %",                 conf:99 },
  { key:"fees",       icon:"wallet",   label:"Honoraires",     value:"À charge du vendeur",   conf:94 },
  { key:"signedAt",   icon:"pen",      label:"Signé le",       value:"14 mars 2026",          conf:95 },
];

const MSMobileScreen = ({ dark = false }) => {
  const T = MMT(dark);
  const [vals, setVals] = React.useState(() => Object.fromEntries(MM_FIELDS.map(f => [f.key, f.value])));
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState("");

  const startEdit = (f) => { setEditing(f.key); setDraft(vals[f.key]); };
  const commit = () => { if (editing != null) setVals(v => ({ ...v, [editing]: draft.trim() || v[editing] })); setEditing(null); };
  const cancel = () => setEditing(null);

  const toCheck = MM_FIELDS.filter(f => f.conf < 97).length;

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:T.canvas, fontFamily:mmFont }}>
      {/* Scroll area */}
      <div style={{ flex:1, overflow:"auto", padding:"58px 16px 12px" }}>
        {/* En-tête IA */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:13, marginBottom:20, padding:"0 2px" }}>
          <div style={{ width:44, height:44, borderRadius:13, background:T.accent, display:"grid", placeItems:"center",
            flexShrink:0, boxShadow: dark ? "0 8px 20px rgba(0,0,0,0.5)" : "0 10px 22px rgba(11,12,14,0.22)" }}>
            <MMIcon name="sparkle" size={21} stroke={T.onAccent} sw={1.9}/>
          </div>
          <div style={{ flex:1, minWidth:0, paddingTop:1 }}>
            <p style={{ margin:0, fontSize:18, fontWeight:800, color:T.ink, letterSpacing:-0.4, lineHeight:1.32 }}>
              Mandat analysé.<br/>Voici les 8 éléments clés.
            </p>
          </div>
        </div>

        {/* Rappel doux : champs à vérifier */}
        {toCheck > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 14px", borderRadius:14,
            background: dark ? "rgba(242,184,85,0.12)" : "rgba(245,158,11,0.10)", marginBottom:14 }}>
            <span style={{ width:8, height:8, borderRadius:999, background:T.warn, flexShrink:0 }}/>
            <span style={{ fontSize:12.5, fontWeight:600, color:T.inkSoft, flex:1 }}>
              {toCheck} valeur{toCheck>1?"s":""} à confirmer d&apos;un coup d&apos;œil.
            </span>
          </div>
        )}

        {/* Carte liste */}
        <div style={{ background:T.card, borderRadius:22, boxShadow:T.shadow, padding:"4px 6px", overflow:"hidden" }}>
          {MM_FIELDS.map((f, i) => {
            const on = editing === f.key;
            return (
              <div key={f.key} onClick={() => !on && startEdit(f)}
                style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 12px",
                  borderTop: i===0 ? "none" : `1px solid ${on ? "transparent" : T.hair}`,
                  borderRadius:14, cursor:"pointer",
                  background: on ? T.subtle : "transparent",
                  boxShadow: on ? `inset 0 0 0 1.6px ${T.accent}` : "none",
                  transition:"background .15s" }}>
                {on ? (
                  <>
                    <input autoFocus value={draft}
                      onChange={e=>setDraft(e.target.value)}
                      onClick={e=>e.stopPropagation()}
                      onKeyDown={e=>{ if(e.key==="Enter") commit(); if(e.key==="Escape") cancel(); }}
                      style={{ flex:1, minWidth:0, height:40, padding:"0 12px", borderRadius:10, border:0, outline:"none",
                        background:T.card, color:T.ink, fontFamily:mmFont, fontSize:15, fontWeight:700, letterSpacing:-0.2,
                        boxShadow:`inset 0 0 0 1.6px ${T.accent}` }}/>
                    <button onClick={e=>{e.stopPropagation(); commit();}} style={{ width:40, height:40, borderRadius:11, border:0,
                      background:T.accent, cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 }}>
                      <MMIcon name="check" size={16} stroke={T.onAccent} sw={2.4}/>
                    </button>
                    <button onClick={e=>{e.stopPropagation(); cancel();}} style={{ width:40, height:40, borderRadius:11, border:0,
                      background:T.subtle2, cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 }}>
                      <MMIcon name="x" size={15} stroke={T.inkSoft} sw={2.2}/>
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:9.5, fontWeight:800, color:T.muted, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>{f.label}</div>
                      <div style={{ fontSize:15.5, fontWeight:700, color:T.ink, letterSpacing:-0.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{vals[f.key]}</div>
                    </div>
                    {f.conf<97 && <span title="à confirmer" style={{ width:8, height:8, borderRadius:999, background:T.warn, flexShrink:0 }}/>}
                    <MMIcon name="pen" size={15} stroke={T.ghost}/>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, marginTop:14, color:T.muted, fontSize:11.5, fontWeight:600 }}>
          <MMIcon name="doc" size={13} stroke={T.muted}/> mandat-exclusif-aebischer.pdf
        </div>
      </div>

      {/* Footer CTA collé */}
      <div style={{ padding:"12px 16px 30px", background: dark
        ? "linear-gradient(180deg, rgba(8,8,12,0) 0%, rgba(8,8,12,0.9) 40%, #08080C 100%)"
        : "linear-gradient(180deg, rgba(237,239,243,0) 0%, rgba(237,239,243,0.92) 42%, #EDEFF3 100%)" }}>
        <button style={{ width:"100%", height:52, borderRadius:999, border:0, cursor:"pointer",
          background:T.accent, color:T.onAccent, fontFamily:mmFont, fontSize:15, fontWeight:700,
          display:"flex", alignItems:"center", justifyContent:"center", gap:9,
          boxShadow: dark ? "0 10px 24px rgba(0,0,0,0.5)" : "0 10px 24px rgba(11,12,14,0.22)" }}>
          Tout est juste, continuer <MMIcon name="arrow" size={17} stroke={T.onAccent} sw={2}/>
        </button>
        <button style={{ width:"100%", height:44, marginTop:4, border:0, background:"transparent",
          color:T.muted, fontFamily:mmFont, fontSize:13.5, fontWeight:700, cursor:"pointer" }}>
          Repartir de zéro
        </button>
      </div>
    </div>
  );
};

window.MSMobileScreen = MSMobileScreen;
