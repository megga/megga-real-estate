// MEGGA CRM — Wizard « Créer un bien » MOBILE — Steps 5·6·7·8 + SHELL
// Prix & Description · Options · Publication · Succès · puis le shell complet.

const useMW3 = () => React.useContext(window.MWCtx);
const mwFmtCHF = (n) => {
  if (n==null||n==="") return "";
  const num = typeof n==="number"?n:parseInt(String(n).replace(/\D/g,""),10);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("fr-CH").replace(/[\u00A0\u202F,]/g,"'");
};

// ═══ STEP 5 — PRIX & DESCRIPTION ══════════════════════════════════════════
const mwEstimate = (data) => {
  const tx = data.transaction||"vente", area = data.area||80, type = data.type||"appartement", canton = data.canton||"Vaud";
  const vente = { appartement:{Vaud:11500,Genève:13800,Valais:6800,Fribourg:6500,Neuchâtel:6200}, maison:{Vaud:9500,Genève:12500,Valais:6000,Fribourg:5800,Neuchâtel:5600}, villa:{Vaud:12500,Genève:15500,Valais:7800,Fribourg:7200,Neuchâtel:7000}, terrain:{Vaud:1200,Genève:2800,Valais:600,Fribourg:500,Neuchâtel:480} };
  const loc = { appartement:{Vaud:32,Genève:42,Valais:22,Fribourg:24,Neuchâtel:22}, maison:{Vaud:28,Genève:38,Valais:20,Fribourg:22,Neuchâtel:20}, villa:{Vaud:35,Genève:48,Valais:24,Fribourg:26,Neuchâtel:24}, terrain:{Vaud:0,Genève:0,Valais:0,Fribourg:0,Neuchâtel:0} };
  const table = tx==="vente"?vente:loc;
  const p = (table[type]&&table[type][canton]) || table[type]?.Vaud || 10000;
  if (!p) return null;
  const mid = Math.round(p*area/100)*100, low = Math.round(mid*0.88/100)*100, high = Math.round(mid*1.15/100)*100;
  return { low, mid, high, label:`${type} de ${area} m²${canton?` · ${canton}`:""}` };
};
const mwBuildDesc = (data, tone) => {
  const type = ({appartement:"appartement",maison:"maison",villa:"villa",terrain:"terrain"})[data.type]||"bien";
  const area = data.area||"—", rooms = data.rooms, beds = data.bedrooms, canton = data.canton||"", energy = data.energy;
  const feat = (data.features||[]).slice(0,5).map(f=>f.toLowerCase());
  const featClause = feat.length?`Le bien est complété par : ${feat.join(", ")}.`:"";
  const energyClause = energy?` Sa classe énergétique ${energy} ${["A","B","C"].includes(energy)?"garantit une excellente performance":"permet une consommation maîtrisée"}.`:"";
  const intros = {
    neutre:`Bel ${type} de ${area} m²${rooms?`, ${rooms} pièces`:""}${beds?`, ${beds} chambre${beds>1?"s":""}`:""}${canton?`, dans le canton de ${canton}`:""}.`,
    premium:`Exception architecturale : cet ${type} de ${area} m² incarne un art de vivre raffiné${canton?`, au cœur du canton de ${canton}`:""}.`,
    famille:`Pensé pour la vie de famille : ${type} de ${area} m² qui combine confort et fonctionnalité${canton?`, dans le canton de ${canton}`:""}.`,
    invest:`Opportunité d'investissement solide : ${type} de ${area} m²${canton?`, canton de ${canton}`:""}, dans une zone à fort potentiel.`,
  };
  const mids = { neutre:" Les espaces sont lumineux et bien agencés.", premium:" Finitions haut de gamme et matériaux nobles caractérisent ce bien rare.", famille:" Les pièces de jour s'ouvrent sur l'extérieur ; chaque chambre offre intimité et calme.", invest:" Bien en parfait état, prêt à être loué ou revendu." };
  const ends = { neutre:" Un coup de cœur à découvrir lors d'une visite.", premium:" Une visite s'impose pour en saisir toute la dimension.", famille:" À découvrir sans tarder pour s'installer durablement.", invest:" Dossier complet disponible sur demande." };
  return [intros[tone], mids[tone], featClause, energyClause.trim(), ends[tone]].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
};

const MWStepPriceDesc = ({ data, set }) => {
  const T = useMW3();
  const tx = data.transaction||"vente";
  const value = tx==="vente"?data.price:data.rent;
  const display = mwFmtCHF(value);
  const estim = mwEstimate(data);
  const [tone, setTone] = React.useState(data.descTone||"neutre");
  const [phase, setPhase] = React.useState("idle");
  const [stream, setStream] = React.useState("");

  const onPrice = (raw) => { const c=String(raw).replace(/\D/g,""); const n=c?parseInt(c,10):null; tx==="vente"?set({ price:n }):set({ rent:n }); };
  const generate = () => {
    setPhase("thinking"); setStream("");
    const text = mwBuildDesc(data, tone);
    setTimeout(()=>{
      setPhase("streaming"); let i=0;
      const id = setInterval(()=>{
        i += Math.max(2, Math.round(Math.random()*5)); setStream(text.slice(0,i));
        if (i>=text.length){ clearInterval(id); setPhase("done"); set({ description:text, aiAssist:true, descTone:tone }); }
      }, 18);
    }, 600);
  };
  const onEdit = (v) => { set({ description:v, aiAssist:false }); setPhase("idle"); };
  const visibleDesc = phase==="streaming"?stream:(data.description||"");
  const charCount = (data.description||"").length;
  const minChars = 200, ideal = 600;

  const TONES = [{v:"neutre",l:"Neutre"},{v:"premium",l:"Premium"},{v:"famille",l:"Famille"},{v:"invest",l:"Invest."}];

  // position bar
  let posLabel="", posColor=T.muted;
  if (value && estim) {
    if (value<estim.low*0.92){ posLabel="Très en-dessous"; posColor="#3B82F6"; }
    else if (value<estim.low){ posLabel="En-dessous"; posColor=T.ok; }
    else if (value<=estim.high){ posLabel="Dans la fourchette"; posColor=T.ok; }
    else if (value<=estim.high*1.08){ posLabel="Au-dessus"; posColor=T.warn; }
    else { posLabel="Très au-dessus"; posColor=T.err; }
  }
  const range = estim?estim.high-estim.low:1, pad = range*0.4;
  const minV = estim?estim.low-pad:0, maxV = estim?estim.high+pad:1;
  const pct = estim&&value?Math.max(0,Math.min(100,((value-minV)/(maxV-minV))*100)):0;

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <window.MWHeader eyebrow="Étape 6 / 7 · Prix & Description" title="D'abord le prix." />

      {/* Héro prix */}
      <div style={{ background:T.card, borderRadius:24, padding:"24px 20px 22px", boxShadow:T.shadowLg, marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <div style={{ display:"inline-flex", padding:4, borderRadius:999, background:T.cardSubtle }}>
            {[{v:"vente",l:"Vente"},{v:"location",l:"Location"}].map(t=>{
              const sel = tx===t.v;
              return <button key={t.v} onClick={()=>set({ transaction:t.v })} style={{ height:36, padding:"0 22px", borderRadius:999, border:0, fontFamily:"inherit", fontSize:13, fontWeight:800, cursor:"pointer", background: sel?T.black:"transparent", color: sel?T.onBlack:T.inkSoft, transition:"all .18s ease" }}>{t.l}</button>;
            })}
          </div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:10.5, fontWeight:800, color:T.muted, letterSpacing:1.2, textTransform:"uppercase", marginBottom:10 }}>{tx==="vente"?"Prix de vente":"Loyer mensuel"}</div>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
            <input type="text" inputMode="numeric" value={display} onChange={e=>onPrice(e.target.value)} placeholder="0"
              style={{ width: display.length?`${Math.min(display.length+1, 9)}ch`:"3ch", maxWidth:"82%", height:64, border:0, outline:"none", background:"transparent", fontFamily:"inherit", fontSize:54, fontWeight:800, color:T.ink, letterSpacing:-2, lineHeight:1, textAlign:"right", padding:0 }} />
            <span style={{ fontSize:22, fontWeight:700, color:T.muted }}>CHF</span>
          </div>
          {tx==="location" && (
            <div style={{ marginTop:18, display:"inline-flex", alignItems:"center", gap:10, padding:"10px 16px", borderRadius:999, background:T.cardSubtle }}>
              <span style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:0.4 }}>+ Charges</span>
              <input type="text" inputMode="numeric" value={mwFmtCHF(data.charges)} onChange={e=>{const c=e.target.value.replace(/\D/g,"");set({ charges:c?parseInt(c,10):null });}} placeholder="350"
                style={{ width:80, height:32, border:0, outline:"none", background:T.card, borderRadius:8, padding:"0 10px", fontFamily:"inherit", fontSize:15, fontWeight:700, color:T.ink, textAlign:"center" }} />
              <span style={{ fontSize:12, fontWeight:600, color:T.inkSoft }}>CHF</span>
            </div>
          )}
        </div>

      </div>

      {/* Description */}
      <div style={{ marginBottom:14 }}>
        <h2 style={{ margin:"0 0 5px", fontSize:20, fontWeight:800, color:T.ink, letterSpacing:-0.4 }}>Puis la description.</h2>
      </div>

      {/* Textarea + bouton étoile MEGGA AI */}
      <div style={{ position:"relative", background:T.card, borderRadius:18, boxShadow:T.shadow, overflow:"hidden" }}>
        <textarea value={visibleDesc} onChange={e=>onEdit(e.target.value)} readOnly={phase==="streaming"||phase==="thinking"} placeholder="Écrivez la description du bien…"
          style={{ width:"100%", minHeight:170, boxSizing:"border-box", padding:"18px 18px 56px", border:0, outline:"none", resize:"vertical", fontFamily:"inherit", fontSize:14, lineHeight:1.6, color:T.ink, fontWeight:500, background:"transparent" }} />
        <button onClick={generate} disabled={phase==="thinking"||phase==="streaming"}
          title={(data.description||"").length>0?"Améliorer la description avec MEGGA AI":"Générer la description avec MEGGA AI"}
          style={{ position:"absolute", bottom:12, right:12, width:30, height:30, borderRadius:999, border:0, background:"transparent", cursor:(phase==="thinking"||phase==="streaming")?"wait":"pointer", display:"grid", placeItems:"center", padding:0, transition:"transform .16s ease" }}>
          {(phase==="thinking"||phase==="streaming") ? (
            <span style={{ width:14, height:14, borderRadius:999, border:"2px solid rgba(81,69,229,0.25)", borderTopColor:"#5145E5", animation:"mwSpin .8s linear infinite", display:"inline-block" }} />
          ) : (
            <svg width="30" height="30" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="24" fill="#5145E5"/>
              <path transform="translate(7.2 7.2) scale(1.4)" d="M12 2C12.6 8.4 15.6 11.4 22 12C15.6 12.6 12.6 15.6 12 22C11.4 15.6 8.4 12.6 2 12C8.4 11.4 11.4 8.4 12 2Z" fill="#FFFFFF"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

// ═══ STEP 6 — OPTIONS ═════════════════════════════════════════════════════
const MW_STAGE_STYLES = [
  { v:"scandinave", label:"Scandinave", tone:"#E8E4DD", accent:"#A8B5BF" },
  { v:"moderne", label:"Moderne", tone:"#D4D8DC", accent:"#3C4148" },
  { v:"chaleureux", label:"Chaleureux", tone:"#E8D6C2", accent:"#8B6F4E" },
  { v:"minimal", label:"Minimaliste", tone:"#EFEFEF", accent:"#0B0C0E" },
  { v:"luxe", label:"Luxe", tone:"#D9C9A0", accent:"#7A632E" },
  { v:"familial", label:"Familial", tone:"#D6E1D8", accent:"#5A7A60" },
];

const MWStepOptions = ({ data, set }) => {
  const T = useMW3();
  const opt = data.options || {};
  const setOpt = (patch) => set({ options:{ ...opt, ...patch } });
  const [pos, setPos] = React.useState(50);
  const stagingUserOn = !!opt.virtualStagingUser;
  const stagingAgent = opt.virtualStagingAgent || [];
  const toggleStyle = (v) => setOpt({ virtualStagingAgent: stagingAgent.includes(v)?stagingAgent.filter(s=>s!==v):[...stagingAgent,v] });

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <window.MWHeader eyebrow="Étape 7 / 8 · Options" title="Plus d'impact à votre annonce."
        lede="Le staging virtuel est inclus dans votre offre MEGGA — aucune facturation." />

      {/* Staging acheteur */}
      <div style={{ background:T.card, borderRadius:22, overflow:"hidden", boxShadow:T.shadow, marginBottom:16 }}>
        <div style={{ position:"relative", height:200, background:"#222", touchAction:"none" }}
          onPointerMove={e=>{ const r=e.currentTarget.getBoundingClientRect(); setPos(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100))); }}>
          <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(45deg,#C8CDD3 0 12px,#BFC4CA 12px 24px)" }}>
            <div style={{ position:"absolute", top:12, left:12, padding:"4px 10px", borderRadius:999, background:T.onAcc(0.92), color:"#0B0C0E", fontSize:9, fontWeight:800, letterSpacing:0.4, textTransform:"uppercase" }}>Avant — vide</div>
          </div>
          <div style={{ position:"absolute", inset:0, clipPath:`inset(0 0 0 ${pos}%)`, background:"repeating-linear-gradient(135deg,#D4DDE3 0 12px,#C4CDD3 12px 24px)" }}>
            <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", color:"rgba(0,0,0,0.35)" }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.9"><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M5 13V9a2 2 0 012-2h10a2 2 0 012 2v4M5 19v2M19 19v2"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>
            </div>
            <div style={{ position:"absolute", top:12, right:12, padding:"4px 10px", borderRadius:999, background:T.black, color:T.onBlack, fontSize:9, fontWeight:800, letterSpacing:0.4, textTransform:"uppercase" }}>Après</div>
          </div>
          <div style={{ position:"absolute", top:0, bottom:0, left:`${pos}%`, width:2, background:"#fff", boxShadow:"0 0 24px rgba(0,0,0,0.4)", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:40, height:40, borderRadius:999, background:"#fff", boxShadow:"0 6px 20px rgba(0,0,0,0.3)", display:"grid", placeItems:"center", color:"#0B0C0E" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/></svg>
            </div>
          </div>
          <div style={{ position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)", padding:"4px 10px", borderRadius:999, background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:9.5, fontWeight:600, backdropFilter:"blur(6px)" }}>Glissez pour comparer</div>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:6 }}>Pour l'acheteur · immersif</div>
          <h3 style={{ margin:"0 0 8px", fontSize:19, fontWeight:800, color:T.ink, letterSpacing:-0.4 }}>Staging virtuel premium</h3>
          <p style={{ margin:"0 0 16px", fontSize:13, color:T.inkSoft, fontWeight:500, lineHeight:1.5 }}>Sur les pièces vides, l'acheteur active le mobilier virtuel pour se projeter. Slider avant/après sur la fiche publique.</p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"14px 16px", borderRadius:15, background: stagingUserOn?T.black:T.cardSubtle, color: stagingUserOn?T.onBlack:T.ink, transition:"all .2s ease" }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:800, letterSpacing:-0.2 }}>Activer le staging acheteur</div>
              <div style={{ fontSize:11, fontWeight:600, color: stagingUserOn?T.onAcc(0.7):T.muted, marginTop:2 }}>Inclus dans MEGGA — sans frais</div>
            </div>
            <window.MWSwitch checked={stagingUserOn} onChange={()=>setOpt({ virtualStagingUser:!stagingUserOn })} dark={stagingUserOn} />
          </div>
          <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.hair}`, fontSize:11, color:T.muted, fontWeight:500, lineHeight:1.5 }}>Provenance certifiée pour chaque image générée — trace consultable dans le journal d'audit.</div>
        </div>
      </div>

      {/* Staging agent */}
      <div style={{ background:T.card, borderRadius:22, padding:20, boxShadow:T.shadow, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:16 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:6 }}>Pour l'agent · multi-styles</div>
            <h3 style={{ margin:"0 0 5px", fontSize:18, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>Staging virtuel agent</h3>
            <p style={{ margin:0, fontSize:12.5, color:T.inkSoft, fontWeight:500, lineHeight:1.45 }}>Plusieurs ambiances pour les entretiens. Non visible côté acheteur.</p>
          </div>
          {stagingAgent.length>0 && <div style={{ padding:"5px 11px", borderRadius:999, background:T.black, color:T.onBlack, fontSize:11, fontWeight:800, flexShrink:0 }}>{stagingAgent.length} sélectionné{stagingAgent.length>1?"s":""}</div>}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {MW_STAGE_STYLES.map(s=>{
            const sel = stagingAgent.includes(s.v);
            return (
              <button key={s.v} onClick={()=>toggleStyle(s.v)} style={{ position:"relative", padding:0, borderRadius:14, border:0, background:T.cardSubtle, fontFamily:"inherit", cursor:"pointer", overflow:"hidden", boxShadow: sel?T.shadow:"none", outline: sel?`3px solid ${T.black}`:"none", outlineOffset:-3, transition:"all .2s ease", transform: sel?"translateY(-1px)":"none" }}>
                <div style={{ height:72, background:`linear-gradient(135deg,${s.tone} 0%,${s.accent}33 100%)`, display:"grid", placeItems:"center", color:s.accent }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M5 13V9a2 2 0 012-2h10a2 2 0 012 2v4"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>
                </div>
                <div style={{ padding:"11px 13px", display:"flex", alignItems:"center", justifyContent:"space-between", background:T.card }}>
                  <div style={{ textAlign:"left", minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:800, color:T.ink, letterSpacing:-0.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.label}</div>
                    <div style={{ fontSize:10.5, fontWeight:700, color:T.muted, marginTop:1 }}>Inclus</div>
                  </div>
                  <div style={{ width:20, height:20, borderRadius:999, flexShrink:0, background: sel?T.black:"transparent", boxShadow: sel?"none":`inset 0 0 0 2px ${T.ghost}`, display:"grid", placeItems:"center" }}>
                    {sel && <window.MWIcon name="check" size={11} color={T.onBlack} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inclus — aucune facturation */}
      <div style={{ background:T.card, borderRadius:18, padding:"16px 18px", boxShadow:T.shadow, display:"flex", alignItems:"center", gap:14, marginTop:16 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:T.black, color:T.onBlack, display:"grid", placeItems:"center", flexShrink:0 }}>
          <window.MWIcon name="check" size={20} color={T.onBlack} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:3 }}>Staging virtuel</div>
          <div style={{ fontSize:13, color:T.ink, fontWeight:700, letterSpacing:-0.2 }}>Inclus dans votre offre MEGGA — aucune facturation à la publication.</div>
        </div>
      </div>
    </div>
  );
};

const MWOptionCard = ({ icon, tag, title, subtitle, price, checked, onToggle, stats }) => {
  const T = useMW3();
  return (
    <div style={{ background: checked?T.black:T.card, color: checked?T.onBlack:T.ink, borderRadius:20, padding:18, boxShadow: checked?T.shadowLg:T.shadow, marginBottom:12, transition:"all .2s ease", transform: checked?"translateY(-1px)":"none" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:12 }}>
        <div style={{ width:42, height:42, borderRadius:12, background: checked?T.onAcc(0.13):T.cardSubtle, color: checked?T.onBlack:T.ink, display:"grid", placeItems:"center", flexShrink:0 }}>
          <window.MWIcon name={icon} size={20} color={checked?T.onBlack:T.ink} />
        </div>
        <window.MWSwitch checked={checked} onChange={onToggle} dark={checked} />
      </div>
      <div style={{ fontSize:9.5, fontWeight:800, color: checked?T.onAcc(0.62):T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:5 }}>{tag}</div>
      <h3 style={{ margin:"0 0 5px", fontSize:17, fontWeight:800, letterSpacing:-0.3, lineHeight:1.2 }}>{title}</h3>
      <p style={{ margin:"0 0 14px", fontSize:12.5, fontWeight:500, lineHeight:1.5, color: checked?T.onAcc(0.74):T.inkSoft }}>{subtitle}</p>
      <div style={{ paddingTop:12, borderTop:`1px solid ${checked?T.onAcc(0.12):T.hair}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div style={{ display:"flex", gap:16 }}>
          {stats.map((s,i)=>(
            <div key={i}>
              <div style={{ fontSize:9, fontWeight:800, color: checked?T.onAcc(0.55):T.muted, letterSpacing:0.5, textTransform:"uppercase", marginBottom:2 }}>{s.l}</div>
              <div style={{ fontSize:13.5, fontWeight:800, letterSpacing:-0.2 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:17, fontWeight:800, letterSpacing:-0.3 }}>{price}</div>
      </div>
    </div>
  );
};

// ═══ STEP 7 — PUBLICATION ═════════════════════════════════════════════════
const MWStepPublish = ({ data, set }) => {
  const T = useMW3();
  const owner = data.ownerContactId ? (window.MW_CONTACTS.find(c=>c.id===data.ownerContactId) || data._newContact) : null;
  const mode = data.publishMode || "now";
  const tx = data.transaction||"vente";
  const price = tx==="vente"?data.price:data.rent;
  const photos = data.photos||[]; const cover = photos[0];
  const chips = [];
  if (data.type) chips.push(({appartement:"Appartement",maison:"Maison",villa:"Villa",terrain:"Terrain"})[data.type]||data.type);
  if (data.area) chips.push(`${data.area} m²`);
  if (data.rooms) chips.push(`${data.rooms} pièces`);
  if (data.energy) chips.push(`DPE ${data.energy}`);
  const visibility = data.visibility||"public";

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <window.MWHeader eyebrow="Étape 7 / 7 · Publication" title="Prêt à mettre en ligne ?" />

      {/* Aperçu annonce */}
      <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:9 }}>Aperçu de l'annonce</div>
      <div style={{ background:T.card, borderRadius:22, overflow:"hidden", boxShadow:T.shadowLg, marginBottom:16 }}>
        <div style={{ position:"relative", aspectRatio:"16/9", background: cover?`repeating-linear-gradient(135deg,${cover.tone} 0 12px,#C4CDD3 12px 24px)`:T.cardSubtle, display:"grid", placeItems:"center" }}>
          {cover ? <div style={{ color:"rgba(0,0,0,0.2)" }}><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 21V11l9-7 9 7v10M9 21v-7h6v7"/></svg></div> : <div style={{ color:T.muted, fontSize:12, fontWeight:600 }}>Pas de couverture</div>}
          <div style={{ position:"absolute", top:12, left:12, display:"flex", gap:6, flexWrap:"wrap" }}>
            {data.options?.featured && <span style={{ padding:"4px 9px", borderRadius:999, background:T.black, color:T.onBlack, fontSize:9, fontWeight:800, letterSpacing:0.4, textTransform:"uppercase" }}>★ En vedette</span>}
            {data.options?.videoTour && <span style={{ padding:"4px 9px", borderRadius:999, background:T.onAcc(0.95), color:"#0B0C0E", fontSize:9, fontWeight:800, letterSpacing:0.4, textTransform:"uppercase" }}>▶ Vidéo</span>}
          </div>
          {photos.length>1 && <div style={{ position:"absolute", bottom:12, right:12, padding:"4px 9px", borderRadius:999, background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:10, fontWeight:600, backdropFilter:"blur(6px)" }}>1 / {photos.length}</div>}
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:5 }}>{tx==="vente"?"À vendre":"À louer"} · {data.canton||"Suisse"}</div>
              <h2 style={{ margin:"0 0 3px", fontSize:18, fontWeight:800, color:T.ink, letterSpacing:-0.4, lineHeight:1.2 }}>{data.addr||"Adresse à compléter"}</h2>
              <div style={{ fontSize:12, color:T.muted, fontWeight:600 }}>{data.postCode?`${data.postCode} · `:""}{data.canton||""}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:22, fontWeight:800, color:T.ink, letterSpacing:-1, lineHeight:1 }}>{mwFmtCHF(price)||"—"}</div>
              <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.4, marginTop:3 }}>CHF{tx==="location"?" / mois":""}</div>
            </div>
          </div>
          {chips.length>0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
              {chips.map((c,i)=><span key={i} style={{ padding:"5px 11px", borderRadius:999, background:T.cardSubtle, color:T.ink, fontSize:11.5, fontWeight:700 }}>{c}</span>)}
            </div>
          )}
          {data.description && <p style={{ margin:"0 0 14px", fontSize:13, color:T.inkSoft, fontWeight:500, lineHeight:1.55, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{data.description}</p>}
          <div style={{ padding:"12px 14px", borderRadius:13, background:T.cardSubtle, display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ width:34, height:34, borderRadius:999, background:T.black, color:T.onBlack, display:"grid", placeItems:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>MA</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:T.ink }}>Marie Aebischer</div>
              <div style={{ fontSize:10.5, color:T.muted, fontWeight:600 }}>MEGGA · Vaud</div>
            </div>
            <span style={{ height:30, padding:"0 13px", borderRadius:999, background:T.black, color:T.onBlack, fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center" }}>Contacter</span>
          </div>
        </div>
      </div>

      {/* Quand publier */}
      <div style={{ background:T.card, borderRadius:20, padding:18, boxShadow:T.shadow, marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:800, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:12 }}>Quand publier</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <MWPubChoice mode="now" current={mode} onSelect={()=>set({ publishMode:"now" })} title="Publier maintenant" icon="check" />
          <MWPubChoice mode="schedule" current={mode} onSelect={()=>set({ publishMode:"schedule" })} title="Programmer" icon="cal" />
          <MWPubChoice mode="draft" current={mode} onSelect={()=>set({ publishMode:"draft" })} title="Brouillon" icon="doc" />
        </div>
        {mode==="schedule" && (
          <div style={{ marginTop:12, padding:"12px 14px", borderRadius:13, background:T.cardSubtle, animation:"mwFadeUp .3s ease both" }}>
            <div style={{ fontSize:9.5, fontWeight:800, color:T.muted, letterSpacing:0.5, textTransform:"uppercase", marginBottom:7 }}>Date & heure</div>
            <input type="datetime-local" value={data.scheduledAt||""} onChange={e=>set({ scheduledAt:e.target.value })}
              style={{ width:"100%", boxSizing:"border-box", height:42, padding:"0 12px", borderRadius:11, border:0, outline:"none", background:T.card, fontFamily:"inherit", fontSize:14, fontWeight:600, color:T.ink }} />
          </div>
        )}
      </div>

      {/* Récap */}
    </div>
  );
};

const MWPubChoice = ({ mode, current, onSelect, title, sub, icon }) => {
  const T = useMW3();
  const sel = current===mode;
  return (
    <button onClick={onSelect} style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 15px", borderRadius:15, border:0, fontFamily:"inherit", textAlign:"left", cursor:"pointer", background: sel?T.black:T.cardSubtle, color: sel?T.onBlack:T.ink, boxShadow: sel?T.shadow:"none", transition:"all .18s ease" }}>
      <div style={{ width:34, height:34, borderRadius:10, background: sel?T.onAcc(0.14):T.card, color: sel?T.onBlack:T.ink, display:"grid", placeItems:"center", flexShrink:0 }}>
        <window.MWIcon name={icon} size={16} color={sel?T.onBlack:T.ink} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:800, letterSpacing:-0.2 }}>{title}</div>
        {sub && <div style={{ fontSize:11.5, fontWeight:500, color: sel?T.onAcc(0.7):T.muted }}>{sub}</div>}
      </div>
      <div style={{ width:18, height:18, borderRadius:999, flexShrink:0, background: sel?T.onBlack:"transparent", boxShadow: sel?"none":`inset 0 0 0 2px ${T.ghost}`, display:"grid", placeItems:"center" }}>
        {sel && <div style={{ width:7, height:7, borderRadius:999, background:T.black }} />}
      </div>
    </button>
  );
};

// ═══ STEP 8 — SUCCÈS ══════════════════════════════════════════════════════
const MWConfetti = () => {
  const items = React.useMemo(()=>Array.from({ length:22 },(_, i)=>({
    id:i, left:Math.random()*100, delay:Math.random()*0.3, dx:(Math.random()-0.5)*200, rot:Math.random()*720-360,
    color:["#0B0C0E","#0B0C0E","#3C4148","#A8B5BF","#D4D8DC"][Math.floor(Math.random()*5)], size:Math.random()*5+4, round:Math.random()>0.5,
  })),[]);
  return (
    <div style={{ position:"absolute", inset:-30, pointerEvents:"none", overflow:"hidden" }}>
      {items.map(c=><div key={c.id} style={{ position:"absolute", top:0, left:`${c.left}%`, width:c.size, height:c.size, background:c.color, borderRadius:c.round?"50%":"1px", animation:`mwConfetti 1.8s cubic-bezier(.2,.6,.4,1) ${c.delay}s forwards`, "--dx":`${c.dx}px`, "--rot":`${c.rot}deg` }} />)}
    </div>
  );
};

const MWStepSuccess = ({ data, onClose }) => {
  const [settled, setSettled] = React.useState(false);
  React.useEffect(()=>{ const t=setTimeout(()=>setSettled(true), 550); return ()=>clearTimeout(t); },[]);
  const mode = data.publishMode||"now";
  const eyebrow = { now:"En ligne", schedule:"Programmé", draft:"Brouillon" }[mode];
  const title = { now:"C'est publié.", schedule:"C'est programmé.", draft:"Brouillon prêt." }[mode];

  return (
    <div style={{ height:"100%", width:"100%", boxSizing:"border-box", background:"#0B0C0E", color:"#fff", display:"flex", flexDirection:"column", padding:"112px 26px 44px", fontFamily:"inherit", animation:"mwFadeUp .5s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
        <div style={{ position:"relative", display:"inline-block", marginBottom:30 }}>
          <svg width="84" height="84" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
            <path d="M30 52 L44 65 L70 38" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={settled?0:60} style={{ transition:"stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1) .1s" }} />
          </svg>
        </div>
        <div style={{ fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:14 }}>{eyebrow}</div>
        <h1 style={{ margin:0, fontSize:38, fontWeight:800, letterSpacing:-1.4, color:"#fff", lineHeight:1 }}>{title}</h1>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        <button style={{ width:"100%", height:54, borderRadius:999, border:0, fontFamily:"inherit", fontSize:15.5, fontWeight:800, letterSpacing:0.1, cursor:"pointer", background:"#fff", color:"#0B0C0E", boxShadow:"0 10px 28px rgba(0,0,0,0.35)", whiteSpace:"nowrap" }}>Voir l'annonce</button>
        <button onClick={onClose} style={{ width:"100%", height:50, borderRadius:999, border:0, fontFamily:"inherit", fontSize:14.5, fontWeight:700, cursor:"pointer", background:"transparent", color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap" }}>Retour au tableau de bord</button>
      </div>
    </div>
  );
};

// ═══ SHELL ════════════════════════════════════════════════════════════════
const MW_STEPS = [
  { id:"start",   label:"Démarrer" },
  { id:"mandate", label:"Vendeur" },
  { id:"address", label:"Adresse" },
  { id:"specs",   label:"Caractéristiques" },
  { id:"photos",  label:"Photos" },
  { id:"desc",    label:"Prix & Description" },
  { id:"publish", label:"Publication" },
];

const MWLogo = ({ color }) => (
  <svg viewBox="0 0 694.81 419.02" width="44" height="27" style={{ display:"block" }} aria-label="MEGGA">
    <path fill={color} d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z"/>
    <path fill={color} d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z"/>
    <path fill={color} d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z"/>
  </svg>
);

const MobileWizardScreen = ({ dark = false, onGo }) => {
  const T = dark ? window.MW_DARK : window.MW_LIGHT;
  const [step, setStep] = React.useState(0);
  const [subStep, setSubStep] = React.useState(0);
  const [published, setPublished] = React.useState(false);
  const [data, setDataRaw] = React.useState(() => JSON.parse(JSON.stringify(window.MW_EMPTY)));
  const set = (patch) => setDataRaw(prev => ({ ...prev, ...patch }));
  const scrollRef = React.useRef(null);

  React.useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop = 0; }, [step, subStep, published]);

  const canNext = (() => {
    if (step===0) { if(!data.source) return false; if(data.source==="submission"&&!data.fromSubmissionId) return false; return true; }
    if (step===1 && subStep===0) return !!data.ownerContactId;
    return true;
  })();

  const next = () => {
    if (step===0 && data.source==="import") { setStep(1); setSubStep(1); return; }
    if (step===0 && data.source==="submission" && data.ownerContactId) { setStep(1); setSubStep(1); return; }
    if (step===1 && subStep===0) { setSubStep(1); return; }
    setSubStep(0); setStep(s=>Math.min(s+1, MW_STEPS.length-1));
  };
  const prev = () => {
    if (step===1 && subStep===1) {
      if (data.source==="import"||data.source==="submission") { setStep(0); setSubStep(0); return; }
      setSubStep(0); return;
    }
    setSubStep(0); setStep(s=>Math.max(s-1,0));
  };

  const headerLabel = published ? "Publication"
    : step===1 ? (subStep===0?"Vendeur":"Mandat") : MW_STEPS[step].label;
  const restart = () => { setDataRaw(JSON.parse(JSON.stringify(window.MW_EMPTY))); setStep(0); setSubStep(0); setPublished(false); };

  return (
    <window.MWCtx.Provider value={T}>
      <div style={{ height:"100%", display:"flex", flexDirection:"column", background: published ? "#0B0C0E" : T.canvas, fontFamily:"Manrope, system-ui, sans-serif", color:T.ink, position:"relative" }}>
        {published ? <MWStepSuccess data={data} onClose={restart} /> : (
        <>
        {/* Top bar */}
        <header style={{ flexShrink:0, paddingTop:72 }}>
          <div style={{ padding:"4px 16px 12px", display:"flex", alignItems:"center", gap:12 }}>
            <MWLogo color={T.ink} />
            <div style={{ width:1, height:22, background:T.hair }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9.5, fontWeight:800, color:T.muted, letterSpacing:0.9, textTransform:"uppercase" }}>Nouveau bien</div>
              <div style={{ fontSize:15, fontWeight:800, color:T.ink, letterSpacing:-0.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{headerLabel}</div>
            </div>
            <button onClick={published?restart:(onGo?()=>onGo("more"):undefined)} title="Fermer" style={{ width:38, height:38, borderRadius:999, border:0, background:T.card, color:T.ink, cursor:"pointer", display:"grid", placeItems:"center", boxShadow:T.shadowSm, flexShrink:0 }}>
              <window.MWIcon name="close" size={17} color={T.ink} />
            </button>
          </div>
          <window.MWProgress total={MW_STEPS.length} current={step} />
        </header>

        {/* Body */}
        <main ref={scrollRef} key={`${step}-${subStep}`} style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"34px 18px 130px", WebkitOverflowScrolling:"touch" }}>
          {(
            <>
              {step===0 && <window.MWStepStart data={data} set={set} />}
              {step===1 && subStep===0 && <window.MWStepVendor data={data} set={set} />}
              {step===1 && subStep===1 && <window.MWStepMandate data={data} set={set} />}
              {step===2 && <window.MWStepAddress data={data} set={set} />}
              {step===3 && <window.MWStepSpecs data={data} set={set} />}
              {step===4 && <window.MWStepPhotos data={data} set={set} />}
              {step===5 && <MWStepPriceDesc data={data} set={set} />}
              {step===6 && <MWStepPublish data={data} set={set} />}
            </>
          )}
        </main>

        {/* Footer */}
        {(
          <footer style={{ position:"absolute", left:0, right:0, bottom:0, padding:"22px 18px 30px", display:"flex", alignItems:"center", gap:12, background:T.footerFade, pointerEvents:"none" }}>
            {step>0 ? (
              <button onClick={prev} style={{ pointerEvents:"auto", width:50, height:52, borderRadius:999, border:0, flexShrink:0, background:T.card, color:T.inkSoft, cursor:"pointer", display:"grid", placeItems:"center", boxShadow:T.shadow }}>
                <window.MWIcon name="arrowL" size={20} color={T.inkSoft} />
              </button>
            ) : <div style={{ width:1 }} />}
            {step < MW_STEPS.length-1 ? (
              <button onClick={next} disabled={!canNext} style={{ pointerEvents:"auto", flex:1, height:52, borderRadius:999, border:0, background: canNext?T.black:T.ghost, color:T.onBlack, fontFamily:"inherit", fontSize:15, fontWeight:800, letterSpacing:0.1, cursor: canNext?"pointer":"not-allowed", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:9, boxShadow: canNext?T.pillShadow:"none", transition:"all .18s ease" }}>
                Continuer
              </button>
            ) : (
              <button onClick={()=>setPublished(true)} style={{ pointerEvents:"auto", flex:1, height:52, borderRadius:999, border:0, background:T.black, color:T.onBlack, fontFamily:"inherit", fontSize:15, fontWeight:800, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:9, boxShadow:T.pillShadow }}>
                {data.publishMode==="schedule"?"Programmer":data.publishMode==="draft"?"Enregistrer":"Publier"}
                <window.MWIcon name="arrowR" size={18} color={T.onBlack} />
              </button>
            )}
          </footer>
        )}
        </>
        )}
      </div>
    </window.MWCtx.Provider>
  );
};

Object.assign(window, { MWLogo, MWStepPriceDesc, MWStepOptions, MWStepPublish, MWStepSuccess, MobileWizardScreen });
