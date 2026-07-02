// MEGGA CRM — Wizard « Créer un bien » MOBILE — Steps 2·3·4
// Adresse · Caractéristiques · Photos. Theme-aware (lit window.MWCtx).
// Carte = rendu vectoriel autonome (aucune dépendance réseau).

const useMW2 = () => React.useContext(window.MWCtx);

// ═══ STEP 2 — ADRESSE ═════════════════════════════════════════════════════
const MW_CANTON_SHORT = {
  "Genève":"GE", "Vaud":"VD", "Fribourg":"FR", "Valais":"VS", "Neuchâtel":"NE", "Jura":"JU", "Berne":"BE", "Zurich":"ZH",
};
const mwMockSuggestions = (q) => {
  const base = [
    { place:`${q}, 1227 Carouge`, pc:"1227", city:"Carouge", region:"Genève", coords:[6.1336,46.1839] },
    { place:`${q}, 1206 Genève`,  pc:"1206", city:"Genève",  region:"Genève", coords:[6.1432,46.1958] },
    { place:`${q}, 1003 Lausanne`,pc:"1003", city:"Lausanne",region:"Vaud",   coords:[6.6323,46.5197] },
  ];
  return base.slice(0, q.trim().length>5?3:2).map((s,i)=>({ id:`m${i}`, ...s }));
};

// Carte vectorielle (rues + pin) — pas de réseau
const MWMiniMap = ({ confirmed }) => {
  const T = useMW2();
  const g1 = T.isDark ? "rgba(255,255,255,0.08)" : "#C5CDD9";
  const g2 = T.isDark ? "rgba(255,255,255,0.05)" : "#DBE1EA";
  const bg = T.isDark
    ? "linear-gradient(135deg,#15161F 0%,#0E0F16 100%)"
    : "linear-gradient(135deg,#EEF1F6 0%,#E4E9F1 100%)";
  return (
    <div style={{ position:"relative", height:200, borderRadius:20, overflow:"hidden", boxShadow:T.shadow, background:bg }}>
      <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position:"absolute", inset:0, opacity:0.6 }}>
        <line x1="0" y1="64" x2="400" y2="56" stroke={g1} strokeWidth="2" />
        <line x1="0" y1="120" x2="400" y2="132" stroke={g1} strokeWidth="2" />
        <line x1="60" y1="0" x2="52" y2="200" stroke={g1} strokeWidth="2" />
        <line x1="190" y1="0" x2="206" y2="200" stroke={g1} strokeWidth="2" />
        <line x1="320" y1="0" x2="332" y2="200" stroke={g1} strokeWidth="2" />
        <line x1="0" y1="30" x2="400" y2="26" stroke={g2} strokeWidth="1.5" />
        <line x1="0" y1="168" x2="400" y2="160" stroke={g2} strokeWidth="1.5" />
      </svg>
      {confirmed ? (
        <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)" }}>
          <div style={{ width:22, height:22, borderRadius:999, background:"#0B0C0E", border:"4px solid #fff", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"mwPinPulse 2s ease-in-out infinite" }} />
        </div>
      ) : (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center" }}>
          <div style={{ padding:"8px 14px", borderRadius:999, background:T.onAcc(0.85), backdropFilter:"blur(6px)", fontSize:11, fontWeight:700, color:T.muted, letterSpacing:0.4, textTransform:"uppercase" }}>Tapez une adresse</div>
        </div>
      )}
    </div>
  );
};

const MWStepAddress = ({ data, set }) => {
  const T = useMW2();
  const [q, setQ] = React.useState(data.addr || "");
  const [sugg, setSugg] = React.useState([]);
  const [show, setShow] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(!!data.addrConfirmed);
  const [refine, setRefine] = React.useState(false);
  const debounce = React.useRef(null);

  const onQuery = (v) => {
    setQ(v); setConfirmed(false); set({ addr:v, addrConfirmed:false, coords:null });
    if (debounce.current) clearTimeout(debounce.current);
    if (v.trim().length<3) { setSugg([]); setShow(false); return; }
    debounce.current = setTimeout(()=>{ setSugg(mwMockSuggestions(v)); setShow(true); }, 220);
  };
  const pick = (s) => {
    setQ(s.place); setSugg([]); setShow(false); setConfirmed(true);
    set({ addr:s.place, addrConfirmed:true, postCode:s.pc, city:s.city, canton:s.region, cantonShort:MW_CANTON_SHORT[s.region]||"", coords:s.coords });
  };
  const reset = () => { setQ(""); setSugg([]); setConfirmed(false); set({ addr:"", addrConfirmed:false, coords:null }); };

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <window.MWHeader eyebrow="Étape 3 / 7 · Adresse" title="Où se situe le bien ?" />
      <window.MWOwnerChip data={data} />

      {/* Recherche */}
      <div style={{ position:"relative", marginTop:18, marginBottom:16 }}>
        <div style={{ background:T.card, borderRadius:16, padding:"6px 6px 6px 16px", boxShadow: confirmed?T.shadowSm:T.shadow, display:"flex", alignItems:"center", gap:10 }}>
          <window.MWIcon name={confirmed?"check":"pin"} size={20} color={confirmed?T.ok:T.muted} />
          <input value={q} onChange={e=>onQuery(e.target.value)} onFocus={()=>setShow(sugg.length>0)} placeholder="Rue, numéro, ville…"
            style={{ flex:1, height:46, border:0, background:"transparent", outline:"none", fontFamily:"inherit", fontSize:15, fontWeight:600, color:T.ink }} />
          {confirmed && <button onClick={reset} style={{ height:36, padding:"0 13px", borderRadius:999, border:0, background:T.cardSubtle, color:T.inkSoft, fontFamily:"inherit", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>Modifier</button>}
        </div>
        {show && sugg.length>0 && !confirmed && (
          <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:8, background:T.card, borderRadius:16, boxShadow:T.shadowLg, padding:6, zIndex:30, animation:"mwFadeUp .2s ease both" }}>
            {sugg.map(s=>(
              <button key={s.id} onClick={()=>pick(s)} style={{ display:"flex", alignItems:"center", gap:11, width:"100%", textAlign:"left", fontFamily:"inherit", border:0, cursor:"pointer", background:"transparent", borderRadius:11, padding:"12px 12px", color:T.ink }}>
                <window.MWIcon name="pin" size={16} color={T.muted} />
                <span style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.place}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <MWMiniMap confirmed={confirmed} />

      {/* Données extraites */}
      {confirmed && (
        <div style={{ marginTop:16, background:T.card, borderRadius:20, padding:18, boxShadow:T.shadow, animation:"mwScaleIn .3s ease both" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:11, background:T.isDark?"rgba(52,199,150,0.16)":"rgba(16,185,129,0.12)", display:"grid", placeItems:"center", flexShrink:0 }}>
              <window.MWIcon name="check" size={18} color={T.ok} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14, fontWeight:800, color:T.ink }}>Adresse confirmée</span>
                <window.MWAiTag />
              </div>
              <div style={{ fontSize:11.5, color:T.muted, fontWeight:600 }}>Code postal, canton et coordonnées détectés.</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { l:"Code postal", v:data.postCode||"—" },
              { l:"Ville", v:data.city||"—" },
              { l:"Canton", v:data.canton?`${data.canton} (${data.cantonShort||"—"})`:"—" },
              { l:"Coordonnées", v:data.coords?`${data.coords[1].toFixed(3)}, ${data.coords[0].toFixed(3)}`:"—" },
            ].map((f,i)=>(
              <div key={i} style={{ padding:"11px 13px", borderRadius:12, background:T.cardSubtle }}>
                <div style={{ fontSize:9.5, fontWeight:700, color:T.muted, letterSpacing:0.5, textTransform:"uppercase", marginBottom:4 }}>{f.l}</div>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink, letterSpacing:-0.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Affiner */}
          <button onClick={()=>setRefine(s=>!s)} style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 4px", border:0, background:"transparent", color:T.ink, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            <window.MWIcon name="arrowR" size={14} color={T.ink} />
            <span style={{ transition:"transform .2s", transform: refine?"none":"none" }}>Affiner (étage, lot, parcelle…)</span>
          </button>
          {refine && (
            <div style={{ marginTop:6, padding:16, borderRadius:14, background:T.cardSubtle, display:"flex", flexDirection:"column", gap:12, animation:"mwFadeUp .25s ease both" }}>
              <window.MWInput label="N° d'appartement / lot" value={data.unit||""} onChange={v=>set({ unit:v })} placeholder="Ex : 3B" />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <window.MWInput label="Étage" inputMode="numeric" value={data.floor!=null?String(data.floor):""} onChange={v=>set({ floor:v?parseInt(v):null })} placeholder="3" />
                <window.MWInput label="Sur (total)" inputMode="numeric" value={data.floorsTotal!=null?String(data.floorsTotal):""} onChange={v=>set({ floorsTotal:v?parseInt(v):null })} placeholder="5" />
              </div>
              <window.MWInput label="N° parcelle cadastrale" value={data.cadastralId||""} onChange={v=>set({ cadastralId:v })} placeholder="Ex : 1234-567" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══ STEP 3 — CARACTÉRISTIQUES ════════════════════════════════════════════
const MW_TYPES = [
  { v:"appartement", label:"Appartement", icon:"building" },
  { v:"maison",      label:"Maison",      icon:"building" },
  { v:"villa",       label:"Villa",       icon:"building" },
  { v:"terrain",     label:"Terrain",     icon:"layers" },
];
const MW_TYPE_ICON = {
  appartement: "M4 3h10v18H4zM14 9h6v12h-6M7 7h1M11 7h1M7 11h1M11 11h1M7 15h1M11 15h1",
  maison: "M3 11.5L12 4l9 7.5M5 10v10h14V10M10 20v-6h4v6",
  villa: "M2 12h20M3 12V7l5-3 5 3v5M13 12V9l4-2 4 2v3M3 12v8h18v-8",
  terrain: "M3 18l6-3 6 3 6-3M3 14l6-3 6 3 6-3M3 10l6-3 6 3 6-3",
};
const MW_DPE = [
  { v:"A", color:"#1F8B4C", desc:"Très performant" },
  { v:"B", color:"#4FAD3D", desc:"Performant" },
  { v:"C", color:"#A6C13D", desc:"Bonne performance" },
  { v:"D", color:"#F2C94C", desc:"Performance moyenne" },
  { v:"E", color:"#F2994A", desc:"Énergivore" },
  { v:"F", color:"#EB5757", desc:"Très énergivore" },
  { v:"G", color:"#B92E2E", desc:"Passoire thermique" },
];
const MW_FEATURES = [
  "Balcon","Terrasse","Jardin","Garage","Place de parc","Cave","Ascenseur","Piscine","Cheminée","Climatisation","Buanderie","Vue dégagée",
];

const MWNumStepper = ({ label, value, onChange, step=1, min=0, max=99, fmt }) => {
  const T = useMW2();
  const display = fmt ? fmt(value) : value;
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:0.5, textTransform:"uppercase", marginBottom:8 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={()=>onChange(Math.max(min, value-step))} style={{ width:38, height:38, borderRadius:999, border:0, background:T.cardSubtle, color:T.ink, fontSize:20, fontWeight:600, cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 }}>−</button>
        <div style={{ flex:1, textAlign:"center", fontSize:21, fontWeight:800, color:T.ink, letterSpacing:-0.5 }}>{display}</div>
        <button onClick={()=>onChange(Math.min(max, value+step))} style={{ width:38, height:38, borderRadius:999, border:0, background:T.cardSubtle, color:T.ink, fontSize:20, fontWeight:600, cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 }}>+</button>
      </div>
    </div>
  );
};

const MWStepSpecs = ({ data, set }) => {
  const T = useMW2();
  const num = (v) => v==null||v===""?null:Number(v);
  const features = data.features || [];
  const toggle = (f) => set({ features: features.includes(f)?features.filter(x=>x!==f):[...features,f] });

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <window.MWHeader eyebrow="Étape 4 / 7 · Caractéristiques" title="Décrivez le bien"
        lede="Type, surface, pièces, performance énergétique. Tout est optionnel." />

      {/* Type */}
      <window.MWSection title="Type de bien">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {MW_TYPES.map(t=>{
            const sel = data.type===t.v;
            return (
              <button key={t.v} onClick={()=>set({ type:t.v })} style={{
                padding:"18px 14px", borderRadius:16, border:0, fontFamily:"inherit", cursor:"pointer",
                background: sel?T.black:T.card, color: sel?T.onBlack:T.ink, boxShadow: sel?T.shadowLg:T.shadowSm,
                display:"flex", flexDirection:"column", alignItems:"center", gap:9, transition:"all .2s ease", transform: sel?"translateY(-2px)":"none",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sel?T.onBlack:T.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={MW_TYPE_ICON[t.v]} /></svg>
                <span style={{ fontSize:13, fontWeight:800, letterSpacing:-0.2 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </window.MWSection>

      {/* Surface */}
      <window.MWSection title="Surface habitable">
        <div style={{ background:T.card, borderRadius:18, padding:"22px 22px 18px", boxShadow:T.shadowSm }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:18 }}>
            <span style={{ fontSize:46, fontWeight:800, color:T.ink, letterSpacing:-1.5, lineHeight:1 }}>{data.area||"—"}</span>
            <span style={{ fontSize:20, fontWeight:700, color:T.muted }}>m²</span>
          </div>
          <input type="range" min="20" max="500" step="5" value={data.area||80} onChange={e=>set({ area:Number(e.target.value) })}
            className="mw-range" style={{ width:"100%", height:6, borderRadius:999, appearance:"none", WebkitAppearance:"none",
              background:`linear-gradient(to right, ${T.black} 0%, ${T.black} ${(((data.area||80)-20)/480)*100}%, ${T.cardSubtle} ${(((data.area||80)-20)/480)*100}%, ${T.cardSubtle} 100%)`, outline:"none" }} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:T.muted }}>20 m²</span>
            <span style={{ fontSize:11, fontWeight:700, color:T.muted }}>500 m²</span>
          </div>
        </div>
      </window.MWSection>

      {/* Pièces & année */}
      <window.MWSection title="Pièces & année">
        <div style={{ background:T.card, borderRadius:18, padding:20, boxShadow:T.shadowSm, display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <MWNumStepper label="Pièces" value={num(data.rooms)||0} onChange={v=>set({ rooms:v })} step={0.5} min={1} max={20} fmt={v=>v%1===0?v:v.toFixed(1)} />
          <MWNumStepper label="Chambres" value={num(data.bedrooms)||0} onChange={v=>set({ bedrooms:v })} step={1} min={0} max={15} />
          <MWNumStepper label="Salles de bain" value={num(data.bathrooms)||0} onChange={v=>set({ bathrooms:v })} step={1} min={0} max={10} />
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:0.5, textTransform:"uppercase", marginBottom:8 }}>Année</div>
            <input type="number" inputMode="numeric" value={data.year||""} placeholder="1985" onChange={e=>set({ year:e.target.value?parseInt(e.target.value):null })}
              style={{ width:"100%", boxSizing:"border-box", height:44, padding:"0 12px", borderRadius:12, border:0, outline:"none", fontFamily:"inherit", background:T.cardSubtle, color:T.ink, fontSize:16, fontWeight:700, textAlign:"center" }} />
          </div>
        </div>
      </window.MWSection>

      {/* DPE */}
      <window.MWSection title="Performance énergétique" subtitle="Classe DPE. Visible sur l'annonce.">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
          {MW_DPE.map(d=>{
            const sel = data.energy===d.v;
            return (
              <button key={d.v} onClick={()=>set({ energy:d.v })} style={{
                padding:"14px 0", borderRadius:11, border:0, fontFamily:"inherit", cursor:"pointer",
                background: sel?d.color:T.card, color: sel?"#fff":T.ink, boxShadow: sel?`0 10px 22px ${d.color}55`:T.shadowSm,
                fontSize:18, fontWeight:800, letterSpacing:-0.5, transition:"all .18s ease", transform: sel?"translateY(-2px)":"none",
              }}>{d.v}</button>
            );
          })}
        </div>
        {data.energy && (
          <div style={{ marginTop:12, padding:"11px 15px", borderRadius:12, background:T.card, boxShadow:T.shadowSm, display:"flex", alignItems:"center", gap:10, animation:"mwFadeUp .25s ease both" }}>
            <span style={{ width:8, height:8, borderRadius:999, background:MW_DPE.find(d=>d.v===data.energy).color }} />
            <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>Classe {data.energy} — {MW_DPE.find(d=>d.v===data.energy).desc}</span>
          </div>
        )}
      </window.MWSection>

      {/* Équipements */}
      <window.MWSection title="Équipements & atouts" subtitle="Sélectionnez tout ce qui s'applique.">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
          {MW_FEATURES.map(f=>{
            const sel = features.includes(f);
            return (
              <button key={f} onClick={()=>toggle(f)} style={{
                padding:"13px 15px", borderRadius:13, border:0, fontFamily:"inherit", cursor:"pointer",
                background: sel?T.black:T.card, color: sel?T.onBlack:T.ink, boxShadow: sel?T.shadow:T.shadowSm,
                fontSize:13, fontWeight:700, letterSpacing:-0.2, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
                transition:"all .16s ease", transform: sel?"translateY(-1px)":"none",
              }}>
                <span>{f}</span>
                {sel && <window.MWIcon name="check" size={15} color={T.onBlack} />}
              </button>
            );
          })}
        </div>
      </window.MWSection>
    </div>
  );
};

// ═══ STEP 4 — PHOTOS ══════════════════════════════════════════════════════
const MW_STOCK = [
  { id:"p1", label:"Salon", kind:"interior", tone:"#D4DDE3" },
  { id:"p2", label:"Cuisine", kind:"interior", tone:"#E2D8C8" },
  { id:"p3", label:"Chambre", kind:"interior", tone:"#D8DCE3" },
  { id:"p4", label:"Salle de bain", kind:"interior", tone:"#CFD7D9" },
  { id:"p5", label:"Façade", kind:"exterior", tone:"#C8D2DA" },
  { id:"p6", label:"Jardin", kind:"exterior", tone:"#CDD6CC" },
  { id:"p7", label:"Vue", kind:"exterior", tone:"#BDCAD3" },
  { id:"p8", label:"Plan", kind:"plan", tone:"#EAEAEA" },
];
const mwShade = (hex, amt) => {
  const c = hex.replace("#",""); const r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
  const a=(v)=>Math.max(0,Math.min(255,Math.round(v+255*amt)));
  return `rgb(${a(r)},${a(g)},${a(b)})`;
};
const mwQuality = (photos, T) => {
  const n = photos.length;
  const exterior = photos.filter(p=>p.kind==="exterior").length;
  const plan = photos.filter(p=>p.kind==="plan").length;
  let score = Math.min(100, n*10), label, color, message;
  const sugg = [];
  if (n<8) sugg.push(`Ajoutez ${8-n} photos pour atteindre le minimum`);
  if (exterior===0 && n>0) sugg.push("Ajoutez une photo extérieure");
  if (plan===0 && n>0) sugg.push("Un plan rassure les acheteurs");
  if (n===0) { label="Aucune photo"; color=T.muted; message="Ajoutez au moins 8 photos."; score=5; }
  else if (n<4) { label="Insuffisant"; color=T.err; message=`${n} photo${n>1?"s":""} — annonce peu consultée.`; }
  else if (n<8) { label="À compléter"; color=T.warn; message=`${n} photos · presque prêt.`; }
  else if (n<12){ label="Bon"; color=T.ok; message=`${n} photos · qualité satisfaisante.`; }
  else { label="Excellent"; color=T.ok; message=`${n} photos · annonce premium.`; score=100; }
  return { score, label, color, message, sugg };
};

const MWFakePhoto = ({ p }) => {
  const stripes = `repeating-linear-gradient(135deg, ${p.tone} 0 12px, ${mwShade(p.tone,-0.03)} 12px 24px)`;
  const sym = {
    interior:"M3 21V11l9-7 9 7v10M9 21v-7h6v7",
    exterior:"M3 21l5-7 4 5 4-3 5 5M12 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
    plan:"M3 3h18v18H3zM3 12h10M13 3v18M13 9h8M13 15h5",
  };
  return (
    <div style={{ width:"100%", height:"100%", position:"relative", background:stripes }}>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", color:"rgba(0,0,0,0.18)" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d={sym[p.kind]} /></svg>
      </div>
    </div>
  );
};

const MWStepPhotos = ({ data, set }) => {
  const T = useMW2();
  const photos = data.photos || [];
  const [mode, setMode] = React.useState("pc");
  const [phase, setPhase] = React.useState("waiting"); // for mobile transfer

  const addStock = (n=1) => {
    const taken = photos.length;
    let pool = MW_STOCK.slice(taken, taken+n);
    if (pool.length < n) pool = [...pool, ...MW_STOCK.slice(0, n-pool.length)];
    const next = pool.map((p,i)=>({ ...p, id:`${p.id}-${Date.now()}-${i}` }));
    set({ photos:[...photos, ...next] });
  };
  const removePhoto = (id) => set({ photos: photos.filter(p=>p.id!==id) });
  const setCover = (id) => {
    const idx = photos.findIndex(p=>p.id===id); if (idx<=0) return;
    const next=[...photos]; const [m]=next.splice(idx,1); next.unshift(m); set({ photos:next });
  };
  const simTransfer = () => {
    setPhase("connected");
    setTimeout(()=>setPhase("receiving"),900);
    setTimeout(()=>addStock(2),1800);
    setTimeout(()=>addStock(2),3000);
    setTimeout(()=>setPhase("connected"),4200);
  };
  const q = mwQuality(photos, T);

  const MODES = [
    { v:"pc", label:"Ordinateur", icon:"computer" },
    { v:"mobile", label:"Téléphone", icon:"phone" },
    { v:"drive", label:"Drive", icon:"cloud" },
  ];

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <window.MWHeader eyebrow="Étape 5 / 7 · Photos" title="Ajoutez les photos" />

      {/* Zone d'ajout — galerie */}
      {(
        <button onClick={()=>addStock(4)} style={{
          width:"100%", border:0, cursor:"pointer", fontFamily:"inherit",
          background:T.card, borderRadius:22, padding:"34px 24px", boxShadow:T.shadow,
          display:"flex", flexDirection:"column", alignItems:"center", gap:14,
        }}>
          <div style={{ width:72, height:72, borderRadius:22, background:T.cardSubtle, color:T.black, display:"grid", placeItems:"center" }}>
            <window.MWIcon name="upload" size={30} color={T.black} />
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>Ajouter depuis la galerie</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
            {["JPG · PNG · HEIC","Max 30 photos"].map(s=>(
              <span key={s} style={{ padding:"5px 11px", borderRadius:999, background:T.cardSubtle, fontSize:11, fontWeight:700, color:T.inkSoft }}>{s}</span>
            ))}
          </div>
        </button>
      )}

      {/* Grille photos */}
      <div style={{ marginTop:26 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <h2 style={{ margin:0, fontSize:15, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>
            {photos.length===0?"Aucune photo":`${photos.length} photo${photos.length>1?"s":""}`}
          </h2>
          {photos.length>0 && <button onClick={()=>set({ photos:[] })} style={{ border:0, background:"transparent", color:T.muted, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>Tout effacer</button>}
        </div>

        {photos.length===0 ? null : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {photos.map((p,idx)=>{
              const cover = idx===0;
              return (
                <div key={p.id} style={{ position:"relative", aspectRatio:"4/3", borderRadius:16, overflow:"hidden", background:T.card, boxShadow:T.shadow }}>
                  <MWFakePhoto p={p} />
                  {cover ? (
                    <div style={{ position:"absolute", top:8, left:8, padding:"4px 9px", borderRadius:999, background:T.black, color:T.onBlack, fontSize:9, fontWeight:800, letterSpacing:0.4, textTransform:"uppercase", display:"inline-flex", alignItems:"center", gap:4 }}>
                      <window.MWIcon name="star" size={9} color={T.onBlack} /> Couv.
                    </div>
                  ) : (
                    <div style={{ position:"absolute", top:8, left:8, width:22, height:22, borderRadius:999, background:T.onAcc(0.92), color:"#0B0C0E", fontSize:10.5, fontWeight:800, display:"grid", placeItems:"center" }}>{idx+1}</div>
                  )}
                  <div style={{ position:"absolute", bottom:8, right:8, display:"flex", gap:6 }}>
                    {!cover && (
                      <button onClick={()=>setCover(p.id)} title="Couverture" style={{ width:30, height:30, borderRadius:999, border:0, background:T.onAcc(0.95), color:"#0B0C0E", cursor:"pointer", display:"grid", placeItems:"center", boxShadow:"0 4px 10px rgba(0,0,0,0.2)" }}>
                        <window.MWIcon name="star" size={13} color="#0B0C0E" />
                      </button>
                    )}
                    <button onClick={()=>removePhoto(p.id)} title="Supprimer" style={{ width:30, height:30, borderRadius:999, border:0, background:T.onAcc(0.95), color:T.err, cursor:"pointer", display:"grid", placeItems:"center", boxShadow:"0 4px 10px rgba(0,0,0,0.2)" }}>
                      <window.MWIcon name="trash" size={13} color={T.err} />
                    </button>
                  </div>
                  <div style={{ position:"absolute", bottom:8, left:8, padding:"3px 9px", borderRadius:999, background:T.onAcc(0.9), fontSize:10, fontWeight:700, color:"#0B0C0E" }}>{p.label}</div>
                </div>
              );
            })}
            <button onClick={()=>addStock(2)} style={{ aspectRatio:"4/3", borderRadius:16, border:0, background:T.cardSubtle, color:T.muted, cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, fontSize:12.5, fontWeight:700, boxShadow:`inset 0 0 0 2px ${T.hair}` }}>
              <window.MWIcon name="plus" size={20} color={T.muted} /> Ajouter
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

const MWFakeQR = ({ T, active }) => {
  const cells = React.useMemo(()=>{
    const arr=[];
    for(let y=0;y<21;y++)for(let x=0;x<21;x++){
      const finder = (x<7&&y<7)||(x>13&&y<7)||(x<7&&y>13);
      if(finder){ const fx=x<7?x:x-14, fy=y<7?y:y-14; const o=fx===0||fx===6||fy===0||fy===6; const ii=fx>=2&&fx<=4&&fy>=2&&fy<=4; arr.push(o||ii); }
      else arr.push(((Math.sin((x*23+y*7)*42)+1)/2)>0.55);
    }
    return arr;
  },[]);
  return (
    <div style={{ width:172, height:172, padding:10, borderRadius:16, background:"#fff",
      boxShadow: active?"0 0 0 5px rgba(16,185,129,0.3), 0 12px 28px rgba(0,0,0,0.1)":"0 12px 28px rgba(0,0,0,0.1)",
      transition:"box-shadow .4s ease", display:"grid", gridTemplateColumns:"repeat(21,1fr)", gap:1 }}>
      {cells.map((on,i)=><div key={i} style={{ background:on?"#0B0C0E":"transparent", borderRadius:1, aspectRatio:"1" }} />)}
    </div>
  );
};

Object.assign(window, { MWStepAddress, MWStepSpecs, MWStepPhotos });
