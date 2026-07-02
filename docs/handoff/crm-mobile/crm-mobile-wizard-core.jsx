// MEGGA CRM — Responsive · Wizard « Créer un bien » MOBILE (375–402)
// Portage fidèle du wizard desktop Sugar v2 (crm-wizard-sugar-*.jsx),
// repensé pour le tactile : 1 colonne, footer d'action fixe, stepper-points,
// cibles ≥ 44px, scroll vertical fluide. Theme-aware (clair + sombre).
// Grammaire Sugar Pure : surfaces blanches, accent NOIR pur, ombres douces,
// AUCUNE bordure décorative, titres noirs francs, beaucoup d'air.

// ═══ TOKENS (clair + sombre) ════════════════════════════════════════════
const MW_LIGHT = {
  mode: "light",
  canvas: "radial-gradient(ellipse 120% 75% at 50% 0%, #C8D5E0 0%, #E0E4EB 48%, #EDEFF3 100%)",
  card: "#FFFFFF",
  cardSubtle: "#F5F6F9",
  ink: "#0B0C0E",
  inkSoft: "#3A3D44",
  muted: "#7A8088",
  ghost: "#B5BAC2",
  hair: "rgba(11,12,14,0.07)",
  black: "#0B0C0E",
  blackHover: "#1F2024",
  onBlack: "#FFFFFF",
  headerBg: "rgba(247,248,250,0.86)",
  footerBg: "rgba(237,239,243,0.0)",
  footerFade: "linear-gradient(180deg, rgba(237,239,243,0) 0%, rgba(237,239,243,0.92) 42%, rgba(237,239,243,1) 100%)",
  shadowSm: "0 4px 14px rgba(15,23,42,0.05)",
  shadow: "0 12px 34px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
  shadowLg: "0 22px 50px rgba(15,23,42,0.12), 0 6px 18px rgba(15,23,42,0.06)",
  pillShadow: "0 8px 20px rgba(11,12,14,0.20)",
  ok: "#10B981", warn: "#F59E0B", err: "#EF4444",
  onAcc: (a) => `rgba(255,255,255,${a})`,
  isDark: false,
};
const MW_DARK = {
  mode: "dark",
  canvas: "radial-gradient(ellipse 125% 80% at 50% 0%, #141414 0%, #0C0C0C 52%, #060606 100%)",
  card: "#161616",
  cardSubtle: "#1F1F1F",
  ink: "#EDEDED",
  inkSoft: "#B8B8B8",
  muted: "#888888",
  ghost: "#454545",
  hair: "rgba(255,255,255,0.08)",
  black: "#EDEDED",
  blackHover: "#FFFFFF",
  onBlack: "#0B0B0B",
  headerBg: "rgba(12,12,12,0.84)",
  footerBg: "rgba(6,6,6,0.0)",
  footerFade: "linear-gradient(180deg, rgba(6,6,6,0) 0%, rgba(6,6,6,0.9) 42%, rgba(6,6,6,1) 100%)",
  shadowSm: "0 2px 10px rgba(0,0,0,0.42)",
  shadow: "0 12px 34px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
  shadowLg: "0 24px 56px rgba(0,0,0,0.62), 0 6px 18px rgba(0,0,0,0.5)",
  pillShadow: "0 10px 24px rgba(0,0,0,0.55)",
  ok: "#34C796", warn: "#F2B855", err: "#F26B65",
  onAcc: (a) => `rgba(11,12,14,${a})`,
  isDark: true,
};
const MWCtx = React.createContext(MW_LIGHT);
const useMW = () => React.useContext(MWCtx);

// ═══ DONNÉES (seed) ══════════════════════════════════════════════════════
const MW_CONTACTS = [
  { id:"c1", type:"seller", firstName:"Jean-Marc", lastName:"Aebischer", email:"jm.aebischer@bluewin.ch", phone:"+41 79 412 65 09", avatarBg:"#1E5BC6", kyc:{ status:"verified" } },
  { id:"c2", type:"seller", firstName:"Sophie",    lastName:"Rochat",    email:"sophie.rochat@gmail.com",  phone:"+41 78 220 14 88", avatarBg:"#0891B2", kyc:{ status:"pending" } },
  { id:"c3", type:"seller", firstName:"Pierre",    lastName:"Vionnet",   email:"p.vionnet@net2000.ch",     phone:"+41 76 508 33 21", avatarBg:"#C45A00", kyc:{ status:"none" } },
  { id:"c4", type:"buyer",  firstName:"Élodie",    lastName:"Schmidt",   email:"elodie.schmidt@me.com",    phone:"+41 79 661 02 47", avatarBg:"#059669", kyc:{ status:"verified" } },
  { id:"c5", type:"seller", firstName:"Antoine",   lastName:"Picard",    email:"antoine.picard@icloud.com",phone:"+41 78 904 71 15", avatarBg:"#7A4Fd0", kyc:{ status:"stale" } },
];
const MW_SUBMISSIONS = [
  { id:"s1", title:"Appartement 4.5p · Carouge", accent:"#1E5BC6", contactId:"c2",
    type:"appartement", transaction:"vente", addr:"Rue Ancienne 22, 1227 Carouge", canton:"Genève",
    area:112, rooms:4.5, beds:3, baths:2, year:2008, energy:"C", features:["balcon","cave","ascenseur"],
    desc:"", askingPrice:1180000 },
  { id:"s2", title:"Villa individuelle · Cologny", accent:"#C45A00",
    contactDraft:{ firstName:"Marc", lastName:"Délèze", email:"marc.deleze@gmail.com", phone:"+41 79 330 12 76" },
    type:"villa", transaction:"vente", addr:"Chemin de la Tour 4, 1223 Cologny", canton:"Genève",
    area:240, rooms:7, beds:5, baths:3, year:2015, energy:"B", features:["jardin","garage","piscine","vue"],
    desc:"", askingPrice:3450000 },
];

const MW_EMPTY = {
  source: null, fromSubmissionId: null,
  ownerContactId: null, _newContact: null,
  mandate: { type:"exclusive", duration: 6, commission: 3.0, signed: false, fees:"owner" },
  addr: "", canton: "Vaud", postCode: "", city: "", cantonShort:"", coords: null, addrConfirmed: false,
  type: "appartement", area: null, rooms: null, bedrooms: null, bathrooms: null,
  year: null, energy: null, features: [],
  photos: [], description: "", aiAssist: false, descTone: "neutre",
  transaction: "vente", price: null, rent: null, charges: null,
  options: { virtualStagingUser: false, virtualStagingAgent: [], featured: false, videoTour: false },
  visibility: "public", publishMode: "now", scheduledAt: null,
};

// ═══ ICÔNES (line, zéro emoji) ═══════════════════════════════════════════
const MW_PATHS = {
  close:    "M6 6l12 12M18 6L6 18",
  arrowR:   "M5 12h13M12.5 6l6 6-6 6",
  arrowL:   "M19 12H6M11.5 6l-6 6 6 6",
  check:    "M5 12.5l4.2 4L19 6.5",
  edit:     "M4 20h4L18.5 9.5l-4-4L4 16v4zM13 7l4 4",
  upload:   "M12 16V4M7 9l5-5 5 5M5 18v2h14v-2",
  inbox:    "M4 13l2.5-7h11L20 13M4 13v5h16v-5M4 13h4l1 2h6l1-2h4",
  search:   "M11 4.5a6.5 6.5 0 104.6 11.1A6.5 6.5 0 0011 4.5zM16 16l4 4",
  user:     "M12 12a4 4 0 100-8 4 4 0 000 8zM5 20a7 7 0 0114 0",
  pin:      "M12 21s7-6.2 7-11A7 7 0 005 10c0 4.8 7 11 7 11zM12 10.5a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z",
  doc:      "M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h4",
  spark:    "M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z",
  camera:   "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z",
  phone:    "M7 3h10v18H7zM10.5 18.5h3",
  cloud:    "M7 18h10a3.5 3.5 0 000-7 5 5 0 00-9.6-1.3A3.4 3.4 0 007 18z",
  computer: "M3 5h18v11H3zM8 20h8M12 16v4",
  tag:      "M3 12V4h8l9 9-8 8-9-9zM7.5 7.5h.01",
  trash:    "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  star:     "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  bolt:     "M13 3L5 13h5l-1 8 8-10h-5z",
  video:    "M3 7h12v10H3zM15 10l5-2.5v9L15 14",
  clock:    "M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5v5l3.2 2",
  cal:      "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  eye:      "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  message:  "M4 5h16v11H9l-5 4z",
  copy:     "M9 9h11v11H9zM5 15H4V4h11v1",
  share:    "M14 9V5l7 7-7 7v-4c-5 0-8 1.5-10 5 .5-6 3.5-9 10-11z",
  link:     "M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.2 1.2M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.2-1.2",
  grid:     "M4 4h7v7H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 13h7v7H4z",
  globe:    "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.8 2.4 2.8 15.6 0 18M12 3c-2.8 2.4-2.8 15.6 0 18",
  plus:     "M12 5v14M5 12h14",
  qr:       "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  building: "M4 21V5l8-2v18M12 21V9l8 2v10M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2",
  layers:   "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
};
const MWIcon = ({ name, size = 20, sw = 1.8, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display:"block", flexShrink:0 }}>
    <path d={MW_PATHS[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ═══ PRIMITIVES ══════════════════════════════════════════════════════════
const MWEyebrow = ({ children }) => {
  const T = useMW();
  return <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, letterSpacing: 1.4, textTransform:"uppercase" }}>{children}</div>;
};
const MWTitle = ({ children, size = 27 }) => {
  const T = useMW();
  return <h1 style={{ margin:"8px 0 0", fontSize: size, fontWeight: 800, color: T.ink, letterSpacing:-0.9, lineHeight: 1.08, textWrap:"balance" }}>{children}</h1>;
};
const MWLede = ({ children }) => {
  const T = useMW();
  return <p style={{ margin:"8px 0 0", fontSize: 13.5, color: T.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>{children}</p>;
};
const MWHeader = ({ eyebrow, title, lede, titleSize, center }) => (
  <div style={{ marginBottom: 22, textAlign: center ? "center" : "left" }}>
    <MWTitle size={titleSize}>{title}</MWTitle>
    {lede && <MWLede>{lede}</MWLede>}
  </div>
);

// Avatar initiales
const MWAvatar = ({ contact, size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: 999, background: contact.avatarBg || "#1E5BC6",
    color:"#fff", display:"grid", placeItems:"center", flexShrink:0,
    fontSize: Math.max(11, size*0.34), fontWeight: 800,
  }}>{`${contact.firstName?.[0]||""}${contact.lastName?.[0]||""}`.toUpperCase()}</div>
);

// Pastille KYC discrète
const MWKycChip = ({ status }) => {
  const T = useMW();
  const map = {
    verified:{ l:"KYC vérifié",  c:T.ok },
    pending: { l:"KYC en cours", c:T.warn },
    stale:   { l:"KYC à refaire",c:T.warn },
    none:    { l:"KYC à faire",  c:T.muted },
  };
  const m = map[status||"none"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, fontWeight:700, color:m.c }}>
      <span style={{ width:6, height:6, borderRadius:999, background:m.c }} />{m.l}
    </span>
  );
};

// Champ texte Sugar
const MWInput = ({ label, value, onChange, type="text", placeholder, inputMode }) => {
  const T = useMW();
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display:"block" }}>
      {label && <div style={{ fontSize:10.5, fontWeight:700, color:T.muted, letterSpacing:0.6, textTransform:"uppercase", marginBottom:7 }}>{label}</div>}
      <input type={type} value={value} placeholder={placeholder} inputMode={inputMode}
        onChange={e=>onChange(e.target.value)} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        style={{
          width:"100%", boxSizing:"border-box", height:48, padding:"0 15px", borderRadius:13,
          border:0, outline:"none", fontFamily:"inherit", fontSize:15, fontWeight:600,
          background: focus ? T.card : T.cardSubtle, color:T.ink,
          boxShadow: focus ? `0 0 0 2px ${T.black}` : "none",
          transition:"box-shadow .15s ease, background .15s ease",
        }} />
    </label>
  );
};

// Switch Sugar
const MWSwitch = ({ checked, onChange, dark }) => {
  const T = useMW();
  return (
    <button onClick={onChange} aria-pressed={checked} style={{
      width:50, height:30, borderRadius:999, border:0, flexShrink:0, position:"relative", padding:0, cursor:"pointer",
      background: checked ? (dark ? T.onBlack : T.black) : (dark ? T.onAcc(0.22) : T.cardSubtle),
      transition:"background .2s ease",
    }}>
      <span style={{
        position:"absolute", top:3, left: checked ? 23 : 3, width:24, height:24, borderRadius:999,
        background: checked ? (dark ? T.black : T.onBlack) : T.onBlack,
        boxShadow:"0 2px 6px rgba(0,0,0,0.25)", transition:"left .2s cubic-bezier(.2,.8,.2,1)",
      }} />
    </button>
  );
};

// Stepper « segment » horizontal (8 segments)
const MWProgress = ({ total, current }) => {
  const T = useMW();
  return (
    <div style={{ display:"flex", gap:5, padding:"0 16px 12px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          flex:1, height:4, borderRadius:999,
          background: i < current ? T.ink : i === current ? T.ink : T.hair,
          opacity: i <= current ? 1 : 1,
          transition:"background .3s ease",
        }} />
      ))}
    </div>
  );
};

// Petite section titrée
const MWSection = ({ title, subtitle, children, style }) => {
  const T = useMW();
  return (
    <section style={{ marginBottom: 26, ...style }}>
      {title && (
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:T.ink, letterSpacing:-0.4 }}>{title}</h2>
          {subtitle && <p style={{ margin:"3px 0 0", fontSize:12.5, color:T.muted, fontWeight:500, lineHeight:1.45 }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
};

// Pilule MEGGA AI
const MWAiTag = () => {
  const T = useMW();
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:999,
      background:T.black, color:T.onBlack, fontSize:9, fontWeight:800, letterSpacing:0.6, textTransform:"uppercase",
    }}>MEGGA AI</span>
  );
};

// ═══ STEP 0 — DÉMARRER ═══════════════════════════════════════════════════
const MWGateCard = ({ icon, title, sub, onClick, recommended, selected }) => {
  const T = useMW();
  return (
    <button onClick={onClick} style={{
      width:"100%", textAlign:"left", fontFamily:"inherit", border:0, cursor:"pointer",
      background: selected ? T.black : T.card, color: selected ? T.onBlack : T.ink,
      borderRadius: 22, padding:"18px 18px 16px",
      boxShadow: selected ? T.shadowLg : T.shadow,
      display:"flex", alignItems:"center", gap:16,
      transition:"all .22s cubic-bezier(.2,.8,.2,1)",
      transform: selected ? "translateY(-2px)" : "none",
    }}>
      <div style={{
        width:52, height:52, borderRadius:15, flexShrink:0, display:"grid", placeItems:"center",
        background: selected ? T.onAcc(0.14) : T.cardSubtle, color: selected ? T.onBlack : T.black,
      }}><MWIcon name={icon} size={24} /></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <span style={{ fontSize:16.5, fontWeight:800, letterSpacing:-0.3 }}>{title}</span>
          {recommended && (
            <span style={{
              padding:"2px 7px", borderRadius:999, fontSize:8.5, fontWeight:800, letterSpacing:0.5, textTransform:"uppercase",
              background: selected ? T.onAcc(0.16) : T.black, color: selected ? T.onBlack : T.onBlack,
            }}>Conseillé</span>
          )}
        </div>
        {sub && <div style={{ fontSize:12.5, fontWeight:500, lineHeight:1.45, color: selected ? T.onAcc(0.72) : T.inkSoft }}>{sub}</div>}
      </div>
      <MWIcon name="arrowR" size={18} color={selected ? T.onBlack : T.ghost} />
    </button>
  );
};

const MWStepStart = ({ data, set }) => {
  const T = useMW();
  const subs = MW_SUBMISSIONS;
  const pickSubmission = (sub) => {
    let ownerId = null, newContact = null;
    if (sub.contactId) ownerId = sub.contactId;
    else if (sub.contactDraft) {
      const id = `c-from-${sub.id}`;
      newContact = { id, type:"seller", ...sub.contactDraft, kyc:{ status:"none" }, avatarBg: sub.accent };
      ownerId = id;
    }
    set({
      source:"submission", fromSubmissionId: sub.id, ownerContactId: ownerId, _newContact: newContact,
      type: sub.type, transaction: sub.transaction, addr: sub.addr, canton: sub.canton,
      area: sub.area, rooms: sub.rooms, bedrooms: sub.beds, bathrooms: sub.baths,
      year: sub.year, energy: sub.energy, features: sub.features, description: sub.desc, price: sub.askingPrice,
    });
  };
  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <MWHeader center title="Comment créer ce bien ?" />

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <MWGateCard icon="edit" title="Saisir à la main"
          selected={data.source==="manual"}
          onClick={()=>set({ source:"manual", fromSubmissionId:null, ownerContactId:null, _newContact:null })} />
        <MWGateCard icon="upload" title="Importer un mandat"
          sub={"MEGGA AI extrait les infos "}
          selected={data.source==="import"}
          onClick={()=>set({ source:"import", fromSubmissionId:null, ownerContactId:null, _newContact:null })} />
      </div>

      {/* Soumissions */}
      {subs.length > 0 && <div style={{ marginTop: 22 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <MWIcon name="inbox" size={16} color={T.muted} />
          <span style={{ fontSize:11, fontWeight:800, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Reprendre une soumission</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {subs.map(sub => {
            const sel = data.fromSubmissionId === sub.id;
            const c = sub.contactId ? MW_CONTACTS.find(x=>x.id===sub.contactId) : sub.contactDraft;
            const name = c ? `${c.firstName} ${c.lastName}` : "Vendeur inconnu";
            const initials = name.split(" ").filter(Boolean).map(p=>p[0]).join("").slice(0,2).toUpperCase();
            return (
              <button key={sub.id} onClick={()=>pickSubmission(sub)} style={{
                display:"flex", alignItems:"center", gap:13, width:"100%", textAlign:"left", fontFamily:"inherit",
                border:0, cursor:"pointer", borderRadius:18, padding:"13px 15px",
                background: sel ? T.black : T.card, color: sel ? T.onBlack : T.ink,
                boxShadow: sel ? T.shadowLg : T.shadowSm, transition:"all .2s ease",
              }}>
                <div style={{ width:38, height:38, borderRadius:999, background:sub.accent, color:"#fff", display:"grid", placeItems:"center", fontSize:12, fontWeight:800, flexShrink:0 }}>{initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, letterSpacing:-0.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</div>
                </div>
                {sel ? <MWIcon name="check" size={18} color={T.onBlack} /> : <MWIcon name="arrowR" size={16} color={T.ghost} />}
              </button>
            );
          })}
        </div>
      </div>}

    </div>
  );
};

// ═══ STEP 1a — VENDEUR ════════════════════════════════════════════════════
const MWStepVendor = ({ data, set }) => {
  const T = useMW();
  const [q, setQ] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [nc, setNc] = React.useState({ firstName:"", lastName:"", email:"", phone:"" });

  const sellers = MW_CONTACTS.filter(c=>c.type==="seller");
  const matches = q.trim().length===0 ? sellers
    : MW_CONTACTS.filter(c => `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(q.trim().toLowerCase()));
  const selected = data.ownerContactId ? (MW_CONTACTS.find(c=>c.id===data.ownerContactId) || data._newContact) : null;

  const startCreate = () => {
    const parts = q.trim().split(/\s+/);
    if (parts.length>=2) setNc({ firstName:parts[0], lastName:parts.slice(1).join(" "), email:"", phone:"" });
    else setNc({ firstName:q.trim(), lastName:"", email:"", phone:"" });
    setCreating(true);
  };
  const saveNew = () => {
    const id = `c-new-${Date.now()}`;
    set({ ownerContactId:id, _newContact:{ ...nc, id, type:"seller", kyc:{ status:"none" }, avatarBg:"#1E5BC6" } });
    setCreating(false);
  };

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <MWHeader eyebrow="Étape 2 / 7 · Vendeur (1/2)" title="Qui est le propriétaire ?"
        lede={<>Liez ce bien à un contact existant<br />ou créez-en un nouveau.</>} />

      {/* Sélectionné */}
      {selected && !creating && (
        <div style={{ background:T.card, borderRadius:20, boxShadow:T.shadowLg, padding:16, display:"flex", alignItems:"center", gap:14, animation:"mwScaleIn .3s ease both" }}>
          <MWAvatar contact={selected} size={48} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>{selected.firstName} {selected.lastName}</div>
          </div>
          <button onClick={()=>set({ ownerContactId:null, _newContact:null })} style={{
            height:36, padding:"0 14px", borderRadius:999, border:0, background:T.cardSubtle, color:T.inkSoft,
            fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer", flexShrink:0,
          }}>Changer</button>
        </div>
      )}

      {/* Recherche */}
      {!selected && !creating && (
        <>
          <div style={{ background:T.card, borderRadius:16, padding:"6px 6px 6px 16px", boxShadow:T.shadow, display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <MWIcon name="search" size={20} color={T.muted} />
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, email ou téléphone…"
              style={{ flex:1, height:46, border:0, background:"transparent", outline:"none", fontFamily:"inherit", fontSize:15, fontWeight:600, color:T.ink }} />
            {q.length>0 && (
              <button onClick={startCreate} style={{ height:38, padding:"0 14px", borderRadius:999, border:0, background:T.black, color:T.onBlack, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer", flexShrink:0 }}>+ Nouveau</button>
            )}
          </div>

          {q.length===0 && <div style={{ fontSize:11, fontWeight:800, color:T.muted, letterSpacing:1, textTransform:"uppercase", margin:"0 2px 8px" }}>Vos vendeurs récents</div>}

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {matches.length===0 ? (
              <div style={{ background:T.card, borderRadius:18, padding:24, boxShadow:T.shadowSm, textAlign:"center" }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:5 }}>Aucun contact pour « {q} »</div>
                <button onClick={startCreate} style={{ marginTop:8, height:42, padding:"0 20px", borderRadius:999, border:0, background:T.black, color:T.onBlack, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Créer « {q.trim()} »</button>
              </div>
            ) : matches.slice(0,6).map(c => (
              <button key={c.id} onClick={()=>set({ ownerContactId:c.id, _newContact:null })} style={{
                display:"flex", alignItems:"center", gap:13, width:"100%", textAlign:"left", fontFamily:"inherit",
                border:0, cursor:"pointer", background:T.card, borderRadius:16, padding:"13px 15px", boxShadow:T.shadowSm, transition:"all .18s ease",
              }}>
                <MWAvatar contact={c} size={42} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:800, color:T.ink }}>{c.firstName} {c.lastName}</div>
                </div>
                <MWIcon name="arrowR" size={16} color={T.ghost} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Création */}
      {creating && (
        <div style={{ background:T.card, borderRadius:22, padding:20, boxShadow:T.shadow, animation:"mwScaleIn .3s ease both" }}>
          <div style={{ marginBottom:16 }}>
            <MWEyebrow>Nouveau vendeur</MWEyebrow>
            <h3 style={{ margin:"6px 0 0", fontSize:18, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>Quelques infos rapides</h3>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <MWInput label="Prénom" value={nc.firstName} onChange={v=>setNc(p=>({ ...p, firstName:v }))} />
            <MWInput label="Nom" value={nc.lastName} onChange={v=>setNc(p=>({ ...p, lastName:v }))} />
            <MWInput label="Email" type="email" inputMode="email" value={nc.email} onChange={v=>setNc(p=>({ ...p, email:v }))} />
            <MWInput label="Téléphone" type="tel" inputMode="tel" placeholder="+41 79 …" value={nc.phone} onChange={v=>setNc(p=>({ ...p, phone:v }))} />
          </div>
          <div style={{ marginTop:16, padding:"12px 14px", borderRadius:13, background:T.cardSubtle, fontSize:12, color:T.inkSoft, fontWeight:500, lineHeight:1.45 }}>
            Le KYC sera demandé après signature du mandat. MEGGA enverra la procédure au vendeur.
          </div>
          <div style={{ marginTop:18, display:"flex", gap:10 }}>
            <button onClick={()=>setCreating(false)} style={{ flex:"0 0 auto", height:46, padding:"0 18px", borderRadius:999, border:0, background:T.cardSubtle, color:T.inkSoft, fontFamily:"inherit", fontSize:13.5, fontWeight:700, cursor:"pointer" }}>Annuler</button>
            <button onClick={saveNew} disabled={!nc.firstName||!nc.lastName} style={{
              flex:1, height:46, borderRadius:999, border:0,
              background:(!nc.firstName||!nc.lastName)?T.ghost:T.black, color:T.onBlack,
              fontFamily:"inherit", fontSize:13.5, fontWeight:700, cursor:(!nc.firstName||!nc.lastName)?"not-allowed":"pointer",
            }}>Créer le contact</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Chip vendeur lié (réutilisé étapes suivantes)
const MWOwnerChip = ({ data }) => {
  const T = useMW();
  const owner = data.ownerContactId ? (MW_CONTACTS.find(c=>c.id===data.ownerContactId) || data._newContact) : null;
  if (!owner) return null;
  return (
    <div style={{ marginTop:14, display:"inline-flex", alignItems:"center", gap:9, padding:"7px 14px 7px 7px", borderRadius:999, background:T.card, boxShadow:T.shadowSm }}>
      <div style={{ width:24, height:24, borderRadius:999, background:owner.avatarBg||"#1E5BC6", color:"#fff", display:"grid", placeItems:"center", fontSize:9.5, fontWeight:800 }}>{(owner.firstName?.[0]||"")+(owner.lastName?.[0]||"")}</div>
      <span style={{ fontSize:11.5, fontWeight:700, color:T.ink }}>Pour {owner.firstName} {owner.lastName}</span>
    </div>
  );
};

// ═══ STEP 1b — MANDAT ═════════════════════════════════════════════════════
const MW_MANDATE_EXTRACT = [
  { label:"Type de mandat",     value:"Mandat exclusif" },
  { label:"Durée",              value:"6 mois" },
  { label:"Commission",         value:"3,0 %" },
  { label:"Honoraires",         value:"À charge du vendeur" },
  { label:"Date de signature",  value:"14 mars 2026" },
  { label:"Vendeur identifié",  value:"Jean-Marc Aebischer" },
];
const MW_MANDATE_TYPES = [
  { v:"exclusive", title:"Mandat exclusif", sub:"Une seule agence, durée déterminée. Le vendeur ne confie le bien à personne d'autre — engagement et commission maximisés.", hint:"Le plus courant", com:3.0 },
  { v:"simple",    title:"Mandat simple",   sub:"Plusieurs agences en parallèle, le vendeur peut aussi vendre seul. Commission à l'agence qui conclut la vente.", hint:null, com:2.5 },
];

// motion (Framer Motion) — fallback "div" si la lib n'est pas chargée
const MWmotion = (window.Motion && window.Motion.motion) || { div: "div" };

const MWStepMandate = ({ data, set }) => {
  const T = useMW();
  const m = data.mandate || MW_EMPTY.mandate;
  const setM = (patch) => set({ mandate:{ ...m, ...patch } });
  const [importMode, setImportMode] = React.useState(m.importedFile ? "imported" : "manual");
  const [fileName, setFileName] = React.useState(m.importedFile || "mandat-exclusif.pdf");
  const [fields, setFields] = React.useState(m.extractedFields || []);
  const [step, setStep] = React.useState(0);
  const fileInputRef = React.useRef(null);
  const [editKey, setEditKey] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const [overrides, setOverrides] = React.useState({});

  const runImport = (name) => {
    const fn = name || fileName;
    setFileName(fn);
    setImportMode("uploading"); setFields([]); setStep(0);
    // Lecture du fichier, puis extraction : les champs entrent en cascade (delay par item)
    setTimeout(() => setImportMode("extracting"), 700);
    const lastFieldEnd = 50 + (MW_MANDATE_EXTRACT.length - 1) * 120 + 340; // ms (stagger + durée item)
    setTimeout(() => {
      setImportMode("imported");
      setM({ type:"exclusive", duration:6, commission:3.0, fees:"owner", signed:true, importedFile:fn, extractedFields:MW_MANDATE_EXTRACT });
    }, 700 + lastFieldEnd + 450);
  };
  const onFilePicked = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    runImport(f.name);
  };
  const cancelImport = () => { setImportMode("manual"); setFields([]); setStep(0); setM({ importedFile:null, extractedFields:null }); };
  const startEdit = (key, cur) => { setEditKey(key); setDraft(cur); };
  const commitEdit = () => { if (editKey) setOverrides(o => ({ ...o, [editKey]: draft.trim() || (o[editKey] ?? "") })); setEditKey(null); };
  const cancelEdit = () => setEditKey(null);

  const choose = (v) => { const t = MW_MANDATE_TYPES.find(x=>x.v===v); setM({ type:v, commission:t.com }); };
  const fmt = (n) => Math.round(n).toLocaleString("fr-CH").replace(/[\u00A0\u202F,]/g,"'");

  return (
    <div style={{ animation:"mwFadeUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <MWHeader title="Quel type de mandat ?" />
      <MWOwnerChip data={data} />

      {/* Zone import */}
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={onFilePicked} style={{ display:"none" }} />
      {importMode==="manual" && (
        <button onClick={()=>fileInputRef.current && fileInputRef.current.click()} style={{
          width:"100%", textAlign:"left", fontFamily:"inherit", border:0, cursor:"pointer", marginTop:18, marginBottom:22,
          background:T.card, borderRadius:20, padding:18, boxShadow:T.shadow, display:"flex", alignItems:"center", gap:14,
        }}>
          <div style={{ width:52, height:52, borderRadius:15, background:T.cardSubtle, color:T.black, display:"grid", placeItems:"center", flexShrink:0 }}>
            <MWIcon name="doc" size={24} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <span style={{ fontSize:15, fontWeight:800, color:T.ink, letterSpacing:-0.2 }}>Importer un mandat</span>
              <MWAiTag />
            </div>
          </div>
        </button>
      )}

      {/* En cours */}
      {(importMode==="uploading" || importMode==="extracting") && (
        <div style={{ marginTop:18, marginBottom:22, background:T.card, borderRadius:20, padding:20, boxShadow:T.shadow, animation:"mwScaleIn .3s ease both" }}>
          <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:16 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:T.black, color:T.onBlack, display:"grid", placeItems:"center", flexShrink:0 }}>
              <MWIcon name="spark" size={20} color={T.onBlack} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:800, color:T.ink, letterSpacing:-0.2 }}>{importMode==="uploading" ? "Lecture du fichier…" : "MEGGA AI analyse le mandat"}</div>
              <div style={{ fontSize:12, color:T.muted, fontWeight:600 }}>{fileName}</div>
            </div>
          </div>
          {importMode==="uploading" ? (
            <div style={{ padding:"10px 12px", borderRadius:11, fontSize:12, color:T.muted, fontStyle:"italic", boxShadow:`inset 0 0 0 1px ${T.hair}` }}>Recherche des champs…</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {MW_MANDATE_EXTRACT.map((f,i)=>(
                <MWmotion.div key={f.label}
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                  transition={{ duration:0.34, ease:[0.2,0.8,0.2,1], delay:0.05 + i*0.12 }}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:11, background:T.cardSubtle }}>
                  <MWIcon name="check" size={15} color={T.ok} />
                  <span style={{ fontSize:10.5, fontWeight:700, color:T.muted, letterSpacing:0.4, textTransform:"uppercase", flex:"0 0 auto", width:96 }}>{f.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink, flex:1, textAlign:"right" }}>{f.value}</span>
                </MWmotion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Importé : synthèse IA éditoriale (édition inline) */}
      {importMode==="imported" && (() => {
        const recap = [
          { key:"type",       label:"Type de mandat", value:({exclusive:"Mandat exclusif",simple:"Mandat simple",co:"Co-mandat"})[m.type]||m.type },
          { key:"vendor",     label:"Vendeur",        value:"Jean-Marc Aebischer" },
          { key:"duration",   label:"Durée",          value:`${m.duration} mois` },
          { key:"commission", label:"Commission",     value:`${(m.commission||0).toFixed(1).replace(".", ",")} %` },
          { key:"fees",       label:"Honoraires",     value:m.fees==="owner"?"À charge du vendeur":"À charge de l'acheteur", flag:true },
          { key:"signedAt",   label:"Signé le",       value:"14 mars 2026", flag:true },
        ];
        const toCheck = recap.filter(r => r.flag).length;
        return (
        <div style={{ marginTop:18, marginBottom:22, animation:"mwScaleIn .3s ease both" }}>
          {/* En-tête IA */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, padding:"0 2px" }}>
            <div style={{ width:40, height:40, borderRadius:12, background:T.black, display:"grid", placeItems:"center", flexShrink:0, boxShadow:T.shadowSm }}>
              <MWIcon name="spark" size={19} color={T.onBlack} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14.5, fontWeight:800, color:T.ink, letterSpacing:-0.2 }}>Mandat analysé</span>
                <MWAiTag />
              </div>
              <div style={{ fontSize:12, color:T.muted, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fileName}</div>
            </div>
          </div>

          {/* Rappel doux non-bloquant */}
          {toCheck > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 14px", borderRadius:14, marginBottom:12,
              background: T.isDark ? "rgba(242,184,85,0.12)" : "rgba(245,158,11,0.10)" }}>
              <span style={{ width:8, height:8, borderRadius:999, background:T.warn, flexShrink:0 }} />
              <span style={{ fontSize:12.5, fontWeight:600, color:T.inkSoft, flex:1 }}>{toCheck} valeur{toCheck>1?"s":""} à confirmer d'un coup d'œil.</span>
            </div>
          )}

          {/* Liste éditoriale */}
          <div style={{ background:T.card, borderRadius:20, boxShadow:T.shadow, padding:"4px 6px" }}>
            {recap.map((r, i) => {
              const on = editKey === r.key;
              const val = overrides[r.key] != null ? overrides[r.key] : r.value;
              return (
                <div key={r.key} onClick={() => !on && startEdit(r.key, val)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 12px",
                    borderTop: i===0 ? "none" : `1px solid ${on ? "transparent" : T.hair}`,
                    borderRadius:14, cursor:"pointer",
                    background: on ? T.cardSubtle : "transparent",
                    boxShadow: on ? `inset 0 0 0 1.6px ${T.black}` : "none",
                    transition:"background .15s ease" }}>
                  {on ? (
                    <>
                      <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onClick={e=>e.stopPropagation()}
                        onKeyDown={e=>{ if(e.key==="Enter") commitEdit(); if(e.key==="Escape") cancelEdit(); }}
                        style={{ flex:1, minWidth:0, height:40, padding:"0 12px", borderRadius:10, border:0, outline:"none",
                          background:T.card, color:T.ink, fontFamily:"inherit", fontSize:15, fontWeight:700, letterSpacing:-0.2,
                          boxShadow:`inset 0 0 0 1.6px ${T.black}` }} />
                      <button onClick={e=>{ e.stopPropagation(); commitEdit(); }} style={{ width:40, height:40, borderRadius:11, border:0, background:T.black, cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 }}>
                        <MWIcon name="check" size={16} color={T.onBlack} sw={2.4} />
                      </button>
                      <button onClick={e=>{ e.stopPropagation(); cancelEdit(); }} style={{ width:40, height:40, borderRadius:11, border:0, background:T.cardSubtle, cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 }}>
                        <MWIcon name="close" size={15} color={T.inkSoft} sw={2.2} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:9.5, fontWeight:800, color:T.muted, letterSpacing:0.6, textTransform:"uppercase", marginBottom:2 }}>{r.label}</div>
                        <div style={{ fontSize:15.5, fontWeight:700, color:T.ink, letterSpacing:-0.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{val}</div>
                      </div>
                      {r.flag && <span title="à confirmer" style={{ width:8, height:8, borderRadius:999, background:T.warn, flexShrink:0 }} />}
                      <MWIcon name="edit" size={15} color={T.ghost} />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={cancelImport} style={{ marginTop:14, width:"100%", height:44, borderRadius:999, border:0, background:T.cardSubtle, color:T.inkSoft, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer" }}>Saisir manuellement</button>
        </div>
        );
      })()}

      {/* Manuel : types + paramètres */}
      {importMode==="manual" && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0 16px" }}>
            <div style={{ flex:1, height:1, background:T.hair }} />
            <span style={{ fontSize:10.5, fontWeight:700, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>ou à la main</span>
            <div style={{ flex:1, height:1, background:T.hair }} />
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:22 }}>
            {MW_MANDATE_TYPES.map(t => {
              const sel = m.type===t.v;
              return (
                <button key={t.v} onClick={()=>choose(t.v)} style={{
                  position:"relative", textAlign:"left", fontFamily:"inherit", border:0, cursor:"pointer",
                  background: sel?T.black:T.card, color: sel?T.onBlack:T.ink, borderRadius:18, padding:"16px 18px",
                  boxShadow: sel?T.shadowLg:T.shadowSm, transition:"all .2s ease", transform: sel?"translateY(-1px)":"none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:5 }}>
                    <span style={{ fontSize:16, fontWeight:800, letterSpacing:-0.3 }}>{t.title}</span>
                    {t.hint && <span style={{ padding:"3px 8px", borderRadius:999, fontSize:9, fontWeight:800, letterSpacing:0.5, textTransform:"uppercase", background: sel?T.onAcc(0.16):T.cardSubtle, color: sel?T.onBlack:T.inkSoft }}>{t.hint}</span>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11.5, fontWeight:700, color: sel?T.onAcc(0.65):T.muted, marginTop:8 }}>
                    <span>Commission proposée</span><span style={{ fontSize:14, fontWeight:800, color: sel?T.onBlack:T.ink }}>{t.com.toFixed(1)}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Paramètres */}
          <div style={{ background:T.card, borderRadius:20, padding:18, boxShadow:T.shadow, animation:"mwScaleIn .3s ease both" }}>
            <div style={{ marginBottom:18 }}>
              <MWEyebrow>Paramètres</MWEyebrow>
              <h3 style={{ margin:"5px 0 0", fontSize:16, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>Conditions du mandat</h3>
            </div>

            {/* Durée */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:T.muted, letterSpacing:0.6, textTransform:"uppercase", marginBottom:9 }}>Durée</div>
              <div style={{ display:"flex", gap:8 }}>
                {[3,6,9,12].map(d=>(
                  <button key={d} onClick={()=>setM({ duration:d })} style={{
                    flex:1, height:42, borderRadius:12, border:0, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer",
                    background: m.duration===d?T.black:T.cardSubtle, color: m.duration===d?T.onBlack:T.inkSoft, transition:"all .15s ease",
                  }}>{d} m.</button>
                ))}
              </div>
            </div>

            {/* Commission */}
            <div style={{ marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:9 }}>
                <span style={{ fontSize:10.5, fontWeight:700, color:T.muted, letterSpacing:0.6, textTransform:"uppercase" }}>Commission</span>
                <span style={{ fontSize:17, fontWeight:800, color:T.ink, letterSpacing:-0.3 }}>{(m.commission||0).toFixed(1)}%</span>
              </div>
              <input type="range" min="2" max="6" step="0.1" value={m.commission||3.0} onChange={e=>setM({ commission:parseFloat(e.target.value) })}
                className="mw-range" style={{ width:"100%", height:6, borderRadius:999, appearance:"none", WebkitAppearance:"none",
                  background:`linear-gradient(to right, ${T.black} 0%, ${T.black} ${(((m.commission||3.0)-2)/4)*100}%, ${T.cardSubtle} ${(((m.commission||3.0)-2)/4)*100}%, ${T.cardSubtle} 100%)`, outline:"none" }} />
            </div>

            {/* Honoraires */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:T.muted, letterSpacing:0.6, textTransform:"uppercase", marginBottom:9 }}>Honoraires à la charge de</div>
              <div style={{ display:"flex", gap:8 }}>
                {[{v:"owner",l:"Vendeur"},{v:"buyer",l:"Acheteur"}].map(o=>(
                  <button key={o.v} onClick={()=>setM({ fees:o.v })} style={{
                    flex:1, height:42, borderRadius:12, border:0, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer",
                    background: m.fees===o.v?T.black:T.cardSubtle, color: m.fees===o.v?T.onBlack:T.inkSoft, transition:"all .15s ease",
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            {/* Calcul */}
            <div style={{ padding:"13px 15px", borderRadius:14, background:T.cardSubtle, fontSize:12.5, color:T.inkSoft, fontWeight:500, lineHeight:1.5 }}>
              Sur un bien à <b style={{ color:T.ink }}>1'500'000 CHF</b>,<br />la commission serait de <b style={{ color:T.ink }}>{fmt(1500000*(m.commission||3.0)/100)} CHF</b> ({m.fees==="owner"?"vendeur":"acheteur"}).
            </div>

          </div>
        </>
      )}
    </div>
  );
};

Object.assign(window, {
  MWCtx, MW_LIGHT, MW_DARK, MW_CONTACTS, MW_SUBMISSIONS, MW_EMPTY,
  MWIcon, MW_PATHS, MWEyebrow, MWTitle, MWLede, MWHeader, MWAvatar, MWKycChip,
  MWInput, MWSwitch, MWProgress, MWSection, MWAiTag, MWOwnerChip,
  MWStepStart, MWStepVendor, MWStepMandate,
});
