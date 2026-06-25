// MEGGA CRM — Responsive · Fiche bien « Vitrine » MOBILE (375–402)
// ─────────────────────────────────────────────────────────────────────
// Port fidèle du desktop (crm-screen-bien-vitrine.jsx) repensé pour le pouce.
// Importe TOUTES les sections de la version PC :
//   Header retour · Galerie immersive + lightbox · Identité (statut/prix) ·
//   Ruban specs · Description (+ édition) · Caractéristiques + équipements ·
//   Acheteurs en cours (deals + matchs + rappel KYC doux) · Prochaine visite ·
//   Performance (stats + sparkline) · Mandat + vendeur · Diffusion (portails).
//   CTA fixe « Planifier une visite / Gérer la diffusion ». Plan de visite =
//   bottom sheet. Toast de confirmation. Clair + sombre. Grammaire Sugar Pure.
//
// Réutilise window.Vx* (kit Vitrine) + window.CRM_* (données).

const BmToday = new Date("2026-05-16");

// crmInitials de secours (si crm-tokens.jsx absent)
window.crmInitials = window.crmInitials || function (name) {
  if (!name) return "?";
  const p = String(name).trim().split(/\s+/);
  return ((p[0] || "")[0] || "" ) + ((p[1] || "")[0] || "");
};

// ─── Palette mobile : surfaces solides (dark « flat », pas de glass) ────
const bmPal = (dark) => {
  const base = dark ? window.VxSP_DARK : window.VxSP_LIGHT;
  if (!dark) return base;
  return { ...base,
    bg: "#0A0A0B",
    bgGradient: "radial-gradient(ellipse 120% 72% at 50% 0%, #1A1B1E 0%, #111214 55%, #0A0A0B 100%)",
    card: "#17181A", cardSub: "#1F2023", cardSub2: "#26282C",
    hairline: "rgba(255,255,255,0.07)",
    shadowSm: "0 1px 2px rgba(0,0,0,.45)",
    shadow: "0 1px 2px rgba(0,0,0,.5), 0 16px 40px -18px rgba(0,0,0,.7)",
    shadowHov: "0 2px 8px rgba(0,0,0,.55), 0 30px 60px -20px rgba(0,0,0,.8)",
  };
};

// ─── Photos réelles (mêmes sources que les autres écrans mobiles) ───────
const BM_COVER = {
  "b-101": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80&auto=format&fit=crop",
  "b-102": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80&auto=format&fit=crop",
  "b-103": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80&auto=format&fit=crop",
  "b-104": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80&auto=format&fit=crop",
  "b-106": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80&auto=format&fit=crop",
};
const BM_INTERIORS = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1400&q=80&auto=format&fit=crop",
];
const BM_LABELS = ["Séjour","Cuisine","Chambre","Salle de bain","Balcon","Vue dégagée","Entrée","Façade","Pièce à vivre","Couloir","Rangements","Extérieur"];
const BM_AI = { 0: true, 2: true };
const bmBienPhotos = (bien) => {
  const cover = BM_COVER[bien.id];
  const n = Math.max(4, Math.min(bien.photoCount || 8, 12));
  const pool = BM_INTERIORS.filter(u => u !== cover);
  const out = cover ? [cover] : [];
  let k = 0; while (out.length < n) { out.push(pool[k % pool.length]); k++; }
  return out;
};

// ─── Boutons (cibles ≥ 44px) ───────────────────────────────────────────
const BmBlackBtn = ({ children, onClick, icon, dark, full, flex }) => {
  const sp = bmPal(dark);
  return (
    <button onClick={onClick} style={{
      height: 46, padding: "0 20px", borderRadius: 999, border: 0,
      background: sp.black, color: sp.onAccent, fontFamily: "inherit",
      fontWeight: 700, fontSize: 14.5, cursor: "pointer", whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
      width: full ? "100%" : undefined, flex: flex ? 1 : undefined,
      boxShadow: "0 8px 22px -10px rgba(11,12,14,.5)", WebkitTapHighlightColor: "transparent",
    }}>{icon && <window.VxIcon name={icon} size={16} stroke={sp.onAccent} sw={2} />}{children}</button>
  );
};
const BmGhostBtn = ({ children, onClick, icon, dark, full, flex, small }) => {
  const sp = bmPal(dark);
  return (
    <button onClick={onClick} style={{
      height: small ? 38 : 46, padding: small ? "0 14px" : "0 18px", borderRadius: 999,
      background: sp.card, color: sp.inkSoft, border: "1px solid " + sp.hairline,
      fontFamily: "inherit", fontSize: small ? 13 : 14.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      width: full ? "100%" : undefined, flex: flex ? 1 : undefined,
      boxShadow: sp.shadowSm, WebkitTapHighlightColor: "transparent",
    }}>{icon && <window.VxIcon name={icon} size={15} stroke={sp.inkSoft} sw={1.9} />}{children}</button>
  );
};
const BmCircle = ({ icon, onClick, dark, active, title }) => {
  const sp = bmPal(dark);
  return (
    <button onClick={onClick} title={title} style={{
      width: 44, height: 44, borderRadius: 999, border: active ? 0 : "1px solid " + sp.hairline,
      background: active ? sp.black : sp.card, cursor: "pointer", display: "grid", placeItems: "center",
      flexShrink: 0, boxShadow: sp.shadowSm, WebkitTapHighlightColor: "transparent",
    }}><window.VxIcon name={icon} size={19} stroke={active ? sp.onAccent : sp.inkSoft} sw={1.9} /></button>
  );
};

// ─── Cellule de spec (ruban horizontal · contours premium MEIcon) ──────
const BmSpec = ({ icon, label, value, dark }) => {
  const sp = bmPal(dark);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, paddingRight: 24 }}>
      <window.MEIcon name={icon} size={21} color={sp.inkSoft} strokeWidth={1.6} />
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: sp.ink, letterSpacing: -0.4, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: sp.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
  );
};

// ─── Stat de performance ───────────────────────────────────────────────
const BmStat = ({ icon, label, value, dark }) => {
  const sp = bmPal(dark);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: sp.muted, marginBottom: 7 }}>
        <window.VxIcon name={icon} size={13} stroke={sp.muted} sw={1.8} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: sp.ink, letterSpacing: -0.7, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
};

// ─── Ligne de diffusion (portail) ──────────────────────────────────────
const BmPortal = ({ name, online, dark }) => {
  const sp = bmPal(dark);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderRadius: 14, background: sp.cardSub }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: dark ? "rgba(255,255,255,.08)" : "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800, color: sp.ink, boxShadow: sp.shadowSm }}>{name[0]}</div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: sp.ink }}>{name}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: online ? sp.ok : sp.muted, whiteSpace: "nowrap" }}>
        <span style={{ width: 6, height: 6, borderRadius: 9, background: online ? sp.ok : sp.muted }} />{online ? "En ligne" : "Hors ligne"}
      </span>
    </div>
  );
};

// ─── Galerie mobile : héro + filmstrip (vraies photos) ─────────────────
const BmGallery = ({ photos, label, dark, onOpen }) => {
  const sp = bmPal(dark);
  return (
    <div>
      {/* héro */}
      <button onClick={() => onOpen(0)} style={{ position: "relative", width: "100%", height: 268, border: 0, padding: 0, cursor: "pointer", overflow: "hidden", background: sp.cardSub, display: "block" }}>
        <img src={photos[0]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.36) 100%)" }} />
        {BM_AI[0] && (
          <span style={{ position: "absolute", top: 12, right: 12, display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 10px", borderRadius: 999, background: "rgba(8,10,14,.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "#fff", fontSize: 10.5, fontWeight: 700 }}>
            <window.VxIcon name="sparkle" size={11} stroke="#fff" sw={2} /> Staging IA
          </span>
        )}
      </button>
      {/* filmstrip */}
      <div className="bm-scroll" style={{ display: "flex", gap: 7, padding: "10px 16px 2px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {photos.map((src, i) => (
          <button key={i} onClick={() => onOpen(i)} style={{ position: "relative", width: 66, height: 48, borderRadius: 9, overflow: "hidden", flexShrink: 0, border: 0, padding: 0, cursor: "pointer", background: sp.cardSub }}>
            <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Visionneuse plein écran (theme-aware, cohérente avec le Matching) ──
const BmLightbox = ({ open, index, photos, dark, onClose, onIndex }) => {
  const sp = bmPal(dark);
  const touch = React.useRef(null);
  if (!open) return null;
  const count = photos.length;
  const sc = { label: BM_LABELS[index % BM_LABELS.length], ai: !!BM_AI[index] };
  const swipe = (dx) => { if (dx < -40) onIndex((index + 1) % count); else if (dx > 40) onIndex((index - 1 + count) % count); };
  const ink = dark ? "#fff" : sp.ink;
  const sub = dark ? "rgba(255,255,255,0.55)" : sp.muted;
  const ctrlBg = dark ? "rgba(255,255,255,0.14)" : sp.card;
  const ctrlSh = dark ? "none" : sp.shadowSm;
  const chipBg = dark ? "rgba(255,255,255,0.14)" : sp.cardSub;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: dark ? "rgba(8,9,11,0.98)" : "rgba(240,242,246,0.98)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", animation: "vxFade .2s ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "62px 18px 14px", color: ink, flexShrink: 0, gap: 12 }}>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: ctrlBg, boxShadow: ctrlSh, color: ink, display: "grid", placeItems: "center" }}>
          <window.VxIcon name="close" size={20} stroke={ink} sw={1.9} />
        </button>
      </div>
      <div
        onTouchStart={e => touch.current = e.touches[0].clientX}
        onTouchEnd={e => { if (touch.current != null) swipe(e.changedTouches[0].clientX - touch.current); touch.current = null; }}
        style={{ flex: 1, position: "relative", margin: "0 16px 8px", minHeight: 0, display: "grid", placeItems: "center" }}>
        <img src={photos[index]} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 16, boxShadow: dark ? "none" : "0 18px 50px rgba(15,23,42,0.18)" }} />
        {/* nav */}
        <button onClick={() => onIndex((index - 1 + count) % count)} style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 999, border: 0, background: ctrlBg, boxShadow: ctrlSh, color: ink, display: "grid", placeItems: "center", cursor: "pointer" }}><window.VxIcon name="chevL" size={20} stroke={ink} sw={1.9} /></button>
        <button onClick={() => onIndex((index + 1) % count)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 999, border: 0, background: ctrlBg, boxShadow: ctrlSh, color: ink, display: "grid", placeItems: "center", cursor: "pointer" }}><window.VxIcon name="chevR" size={20} stroke={ink} sw={1.9} /></button>
        {sc.label && <div style={{ position: "absolute", left: 10, bottom: 10, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 999, background: chipBg, boxShadow: ctrlSh, fontSize: 13, fontWeight: 700, color: ink }}>{sc.label}</span>
          {sc.ai && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 11px", borderRadius: 999, background: chipBg, boxShadow: ctrlSh, fontSize: 11, fontWeight: 600, color: ink }}><window.VxIcon name="sparkle" size={12} stroke={ink} sw={1.9} /> Staging IA</span>}
        </div>}
      </div>
      <div className="bm-scroll" style={{ display: "flex", gap: 8, padding: "6px 16px calc(20px + env(safe-area-inset-bottom))", overflowX: "auto", flexShrink: 0 }}>
        {photos.map((src, i) => (
          <button key={i} onClick={() => onIndex(i)} style={{ position: "relative", width: 70, height: 50, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: 0, padding: 0, cursor: "pointer", opacity: i === index ? 1 : (dark ? 0.5 : 0.62), boxShadow: i === index ? `0 0 0 2.5px ${ink}` : "none" }}>
            <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Bottom sheet « Planifier une visite » ─────────────────────────────
const BmVisitSheet = ({ open, onClose, bien, dark, onConfirm }) => {
  const sp = bmPal(dark);
  const [day, setDay] = React.useState(0);
  const [time, setTime] = React.useState("14:00");
  const contacts = (window.CRM_MATCHES || []).filter(m => m.bienId === bien.id).map(m => (window.CRM_CONTACTS || []).find(c => c.id === m.contactId)).filter(Boolean);
  const [who, setWho] = React.useState(contacts[0]?.id || null);
  if (!open) return null;
  const days = [];
  for (let i = 1; i <= 21; i++) { const d = new Date(BmToday); d.setDate(d.getDate() + i); days.push(d); }
  const times = ["10:00", "11:30", "14:00", "15:30", "17:00"];
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 190, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "flex-end", animation: "vxFade .18s ease-out" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxHeight: "88%", overflowY: "auto", background: dark ? "#1B1D27" : "#fff",
        borderRadius: "26px 26px 0 0", padding: "10px 20px 28px", boxShadow: "0 -20px 60px rgba(15,23,42,.4)",
        animation: "bmSheetUp .28s cubic-bezier(.2,.85,.25,1)",
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 99, background: sp.hairline, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: sp.muted, letterSpacing: 1, textTransform: "uppercase" }}>Planifier une visite</div>
            <h3 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800, color: sp.ink, letterSpacing: -0.5, lineHeight: 1.2 }}>{bien.title}</h3>
          </div>
          <BmCircle icon="close" onClick={onClose} dark={dark} />
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: sp.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Jour</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: sp.ghost }}>Glisser pour plus →</span>
        </div>
        <div className="bm-scroll" style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch", marginLeft: -20, marginRight: -20, padding: "0 20px" }}>
          {days.map((d, i) => {
            const on = i === day;
            return (
              <button key={i} onClick={() => setDay(i)} style={{ flexShrink: 0, width: 56, padding: "11px 4px", borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit", background: on ? sp.black : sp.cardSub, color: on ? sp.onAccent : sp.inkSoft, textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: .7 }}>{d.toLocaleDateString("fr-CH", { weekday: "short" })}</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{d.getDate()}</div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: .55, marginTop: 2 }}>{d.toLocaleDateString("fr-CH", { month: "short" })}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: sp.muted, marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.4 }}>Heure</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {times.map(tm => {
            const on = tm === time;
            return <button key={tm} onClick={() => setTime(tm)} style={{ padding: "10px 16px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", background: on ? sp.black : sp.cardSub, color: on ? sp.onAccent : sp.inkSoft }}>{tm}</button>;
          })}
        </div>

        {contacts.length > 0 && <>
          <div style={{ fontSize: 11, fontWeight: 700, color: sp.muted, marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.4 }}>Visiteur</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {contacts.map(c => {
              const on = c.id === who;
              return (
                <button key={c.id} onClick={() => setWho(c.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 15, cursor: "pointer", fontFamily: "inherit", background: sp.cardSub, border: 0, textAlign: "left", boxShadow: on ? "0 0 0 2px " + sp.ink + " inset" : "none" }}>
                  <window.VxAvatar name={c.firstName + " " + c.lastName} bg={c.avatarBg} size={36} dark={dark} />
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: sp.ink }}>{c.firstName} {c.lastName}</span>
                  {on && <window.VxIcon name="check" size={17} stroke={sp.ink} sw={2.2} />}
                </button>
              );
            })}
          </div>
        </>}

        <BmBlackBtn dark={dark} full onClick={() => { onConfirm(days[day], time, contacts.find(c => c.id === who) || null); onClose(); }}>Confirmer la visite</BmBlackBtn>
      </div>
    </div>
  );
};

// ─── Menu d'actions (popover ancré sous le bouton •••) — convention mobile ──
const BM_MENU_ACTIONS = [
  { id: "edit", icon: "pencil", label: "Modifier l'annonce" },
  { id: "visit", icon: "cal", label: "Planifier une visite" },
  { id: "diffuse", icon: "globe", label: "Gérer la diffusion" },
  { id: "preview", icon: "external", label: "Voir l'annonce publique" },
];
const BmActionMenu = ({ dark, onClose, onAction }) => {
  const sp = bmPal(dark);
  const Row = ({ icon, label, last, onClick }) => (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxShadow: last ? "none" : "inset 0 -1px 0 " + sp.hairline, WebkitTapHighlightColor: "transparent" }}>
      <window.VxIcon name={icon} size={18} stroke={sp.inkSoft} sw={1.85} />
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{label}</span>
    </button>
  );
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 160 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(11,12,14,0.32)", animation: "vxFade .18s ease both" }} />
      <div style={{ position: "absolute", top: 96, right: 14, width: 248, background: sp.card, borderRadius: 18, boxShadow: sp.shadowHov, overflow: "hidden", animation: "bmMenu .22s cubic-bezier(.2,.9,.3,1.2) both", transformOrigin: "top right" }}>
        {BM_MENU_ACTIONS.map((a, i) => <Row key={a.id} icon={a.icon} label={a.label} last={i === BM_MENU_ACTIONS.length - 1} onClick={() => onAction(a.id)} />)}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//   ÉCRAN — Fiche bien Vitrine · Mobile
// ═══════════════════════════════════════════════════════════════════════
const MobileBienVitrineScreen = ({ dark = false, bienId: bienIdProp }) => {
  const sp = bmPal(dark);
  const biens = window.CRM_BIENS || [];
  const bienId = bienIdProp || window.__bdBienId || (biens.find(b => b.status === "active") || biens[0] || {}).id;
  const bien = biens.find(b => b.id === bienId) || biens[0];

  const [lb, setLb] = React.useState({ open: false, i: 0 });
  const [editing, setEditing] = React.useState(false);
  const [visitOpen, setVisitOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [nextVisit, setNextVisit] = React.useState(null);
  const buildDraft = (b) => b ? ({ title: b.title, addr: b.addr, price: b.price || 0, desc: "" }) : {};
  const [draft, setDraft] = React.useState(() => buildDraft(bien));

  React.useEffect(() => {
    try { const raw = localStorage.getItem("megga_bm_nextvisit_" + bienId); setNextVisit(raw ? JSON.parse(raw) : null); }
    catch (e) { setNextVisit(null); }
  }, [bienId]);
  const saveNextVisit = (nv) => {
    setNextVisit(nv);
    try {
      if (nv) localStorage.setItem("megga_bm_nextvisit_" + bienId, JSON.stringify(nv));
      else localStorage.removeItem("megga_bm_nextvisit_" + bienId);
    } catch (e) {}
  };

  if (!bien) return <div style={{ padding: 40 }}>Aucun bien.</div>;

  const owner = bien.ownerContactId ? (window.CRM_CONTACTS || []).find(c => c.id === bien.ownerContactId) : null;
  const deals = (window.CRM_DEALS || []).filter(d => d.bienId === bien.id);
  const matches = (window.CRM_MATCHES || []).filter(m => m.bienId === bien.id);
  const isRent = bien.transaction === "location";
  const price = isRent ? bien.rent : bien.price;
  const ppm2 = bien.price && bien.area ? Math.round(bien.price / bien.area) : null;
  const mandatExp = bien.mandat?.expiresAt ? new Date(bien.mandat.expiresAt) : null;
  const daysToExp = mandatExp ? Math.round((mandatExp - BmToday) / 86400000) : null;
  const setField = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const publicDesc = draft.desc || bien.desc || `Magnifique ${bien.rooms} pièces de ${bien.area} m².`;
  const features = bien.features || [];
  const photos = bmBienPhotos(bien);

  const flash = (title, lines) => { setToast({ title, lines }); setTimeout(() => setToast(null), 4200); };
  const saveEdit = () => {
    bien.title = draft.title || bien.title;
    bien.addr = draft.addr || bien.addr;
    if (!isRent) bien.price = +draft.price || bien.price;
    setEditing(false);
    flash("Annonce mise à jour", [bien.publishedTo?.length ? "Re-publiée sur " + bien.publishedTo.join(", ") : null, owner ? "Notification envoyée à " + owner.firstName : null, "Entrée ajoutée au journal nLPD"].filter(Boolean));
  };

  const rootVars = { "--vx-card": sp.card, "--vx-hairline": sp.hairline, "--vx-shadow": sp.shadow, "--vx-shadow-hov": sp.shadowHov };
  const kycPending = deals.some(d => { const c = (window.CRM_CONTACTS || []).find(x => x.id === d.contactId); return c && c.kyc?.status !== "verified"; });

  return (
    <div style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column", background: dark ? sp.bg : sp.bgGradient, color: sp.ink, fontFamily: "'Manrope', system-ui, sans-serif", fontVariantNumeric: "tabular-nums", ...rootVars }}>
      <style>{`
        @keyframes vxFadeUp { from { transform:translateY(14px);} to { transform:none;} }
        @keyframes vxFade { from {opacity:0;} to {opacity:1;} }
        @keyframes bmSheetUp { from {transform:translateY(100%);} to {transform:none;} }
        @keyframes bmMenu { from {opacity:0; transform:scale(.94);} to {opacity:1; transform:none;} }
        .bm-scroll::-webkit-scrollbar { width: 0; height: 0; }
        @media (prefers-reduced-motion: reduce){ [style*="vxFadeUp"],[style*="bmSheetUp"]{ animation:none !important; opacity:1 !important; transform:none !important; } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, paddingTop: 52, paddingBottom: 12, paddingLeft: 14, paddingRight: 14, display: "flex", alignItems: "center", gap: 10, background: dark ? "rgba(10,10,15,.72)" : "rgba(237,239,243,.78)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "inset 0 -1px 0 " + sp.hairline, zIndex: 30 }}>
        <button onClick={() => flash("Retour", ["Mes biens"]) } style={{ height: 40, padding: "0 14px 0 11px", borderRadius: 999, border: "1px solid " + sp.hairline, background: sp.card, color: sp.inkSoft, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: sp.shadowSm }}>
          <window.VxIcon name="arrowL" size={16} stroke={sp.inkSoft} sw={1.9} /> Mes biens
        </button>
        <div style={{ flex: 1 }} />
        {editing ? (
          <BmCircle icon="close" dark={dark} title="Annuler" onClick={() => { setDraft(buildDraft(bien)); setEditing(false); }} />
        ) : (
          <button onClick={() => setMenuOpen(true)} title="Plus d'actions" style={{ width: 44, height: 44, borderRadius: 999, border: "1px solid " + sp.hairline, background: sp.card, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: sp.shadowSm, WebkitTapHighlightColor: "transparent" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 4.5, height: 4.5, borderRadius: 999, background: sp.inkSoft }} />)}
            </div>
          </button>
        )}
      </div>

      {/* ── SCROLL ── */}
      <div className="bm-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 16px 120px" }}>

        {/* HERO : galerie + identité + ruban specs */}
        <div style={{ background: sp.card, borderRadius: 22, overflow: "hidden", boxShadow: sp.shadow, marginBottom: 16, animation: "vxFadeUp .5s cubic-bezier(.2,.8,.2,1) both" }}>
          <BmGallery photos={photos} label={bien.photoCount || photos.length} dark={dark} onOpen={i => setLb({ open: true, i })} />
          <div style={{ padding: "16px 18px 18px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 13, flexWrap: "wrap" }}>
              <window.VxStatusPill status={bien.status} dark={dark} />
              {bien.visibility === "private" && <window.VxMetaPill icon="lock" dark={dark}>Off-market</window.VxMetaPill>}
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 25, fontWeight: 800, color: sp.ink, letterSpacing: -0.7, lineHeight: 1.15, textWrap: "balance" }}>
              {editing ? <window.VxEditInput dark={dark} value={draft.title} onChange={v => setField("title", v)} block style={{ fontSize: 22, fontWeight: 800 }} /> : bien.title}
            </h1>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: sp.muted, fontSize: 13.5, fontWeight: 500 }}>
              <window.VxIcon name="map" size={15} stroke={sp.muted} sw={1.8} />
              {editing ? <window.VxEditInput dark={dark} value={draft.addr} onChange={v => setField("addr", v)} style={{ fontSize: 13.5, color: sp.ink }} /> : bien.addr}
            </div>

            {/* prix */}
            <div style={{ marginTop: 16, paddingTop: 16, boxShadow: "inset 0 1px 0 " + sp.hairline }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: sp.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{isRent ? "Loyer" : "Prix de vente"}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: sp.ink, letterSpacing: -1.2, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {editing ? <window.VxEditInput dark={dark} type="number" prefix="CHF" value={draft.price} onChange={v => setField("price", v)} style={{ fontSize: 26, fontWeight: 800, width: 180 }} /> : window.vxFmtCHF(price)}
                {isRent && <span style={{ fontSize: 14, color: sp.muted, fontWeight: 600 }}>/mois</span>}
              </div>
              {bien.charges && <div style={{ marginTop: 6, fontSize: 12.5, color: sp.muted, fontWeight: 500 }}>+ CHF {bien.charges} charges{isRent ? "/mois" : ""}</div>}
            </div>

            {/* ruban specs (scroll horizontal) */}
            <div className="bm-scroll" style={{ marginTop: 16, paddingTop: 18, boxShadow: "inset 0 1px 0 " + sp.hairline, display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <BmSpec icon="surface" label="Surface" value={bien.area + " m²"} dark={dark} />
              <BmSpec icon="home" label="Pièces" value={bien.rooms} dark={dark} />
              <BmSpec icon="bed" label="Chambres" value={bien.beds ?? "—"} dark={dark} />
              <BmSpec icon="bath" label="SdB" value={bien.baths ?? "—"} dark={dark} />
              <BmSpec icon="calendar" label="Année" value={bien.year ?? "—"} dark={dark} />
              <BmSpec icon="flame" label="DPE" value={bien.energy ?? "—"} dark={dark} />
              <BmSpec icon="banknote" label="CHF/m²" value={ppm2 ? window.vxCompact(ppm2) : "—"} dark={dark} />
            </div>
          </div>
        </div>

        {/* DESCRIPTION */}
        <window.VxCard index={1} padding={20} style={{ marginBottom: 16 }}>
          <window.VxSectionHead dark={dark} eyebrow="Description" title="" />
          {editing
            ? <textarea value={draft.desc || publicDesc} onChange={e => setField("desc", e.target.value)} rows={7} style={{ width: "100%", padding: 14, borderRadius: 14, background: sp.cardSub, border: 0, fontFamily: "inherit", fontSize: 14.5, color: sp.ink, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box", boxShadow: "inset 0 0 0 2px " + sp.ink }} />
            : <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.72, color: sp.inkSoft, fontWeight: 400, textWrap: "pretty" }}>{publicDesc}</p>}
        </window.VxCard>

        {/* CARACTÉRISTIQUES */}
        <window.VxCard index={2} padding={20} style={{ marginBottom: 16 }}>
          <window.VxSectionHead dark={dark} eyebrow="Caractéristiques" title="" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { l: "Type de bien", v: bien.type.charAt(0).toUpperCase() + bien.type.slice(1) },
              { l: "Transaction", v: isRent ? "Location" : "Vente" },
              { l: "Surface habitable", v: bien.area + " m²" },
              { l: "Pièces", v: bien.rooms },
              { l: "Chambres", v: bien.beds ?? "—" },
              { l: "Salles de bain", v: bien.baths ?? "—" },
              { l: "Année", v: bien.year ?? "—" },
              { l: "Classe énergétique", v: bien.energy ? "DPE " + bien.energy : "—" },
            ].map(s => (
              <div key={s.l} style={{ padding: 13, borderRadius: 14, background: sp.cardSub }}>
                <div style={{ fontSize: 10.5, color: sp.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{s.l}</div>
                <div style={{ marginTop: 6, fontSize: 15.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              </div>
            ))}
          </div>
          {features.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {features.map(f => (
                <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px", borderRadius: 999, background: sp.cardSub, color: sp.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
                  <window.VxIcon name="check" size={12} stroke={sp.ok} sw={2.4} />{f}
                </span>
              ))}
            </div>
          )}
        </window.VxCard>

        {/* ACHETEURS EN COURS */}
        <window.VxCard index={3} padding={20} style={{ marginBottom: 16 }}>
          <window.VxSectionHead dark={dark} eyebrow={`Pipeline acheteur${deals.length > 1 ? "s" : ""}`} title="Acheteurs en cours" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {deals.map(d => {
              const c = (window.CRM_CONTACTS || []).find(x => x.id === d.contactId);
              const stage = (window.CRM_STAGES || {})[d.stage] || { label: d.stage };
              return (
                <div key={d.id} onClick={() => flash("Ouverture du deal", [c ? c.firstName + " " + c.lastName : "Acheteur"])} style={{ padding: "13px 14px", background: sp.cardSub, borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  {c && <window.VxAvatar name={c.firstName + " " + c.lastName} bg={c.avatarBg} size={40} dark={dark} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: sp.ink }}>{c ? c.firstName + " " + c.lastName : "Acheteur"}</div>
                    <div style={{ fontSize: 12, color: sp.muted, fontWeight: 500, marginTop: 1 }}>{stage.label}{d.probability != null && ` · ${d.probability}%`}</div>
                  </div>
                  <window.VxIcon name="chevR" size={16} stroke={sp.muted} sw={1.8} />
                </div>
              );
            })}

            {matches.filter(m => !deals.some(d => d.contactId === m.contactId)).map(m => {
              const c = (window.CRM_CONTACTS || []).find(x => x.id === m.contactId);
              if (!c) return null;
              return (
                <div key={m.contactId} style={{ padding: "12px 14px", borderRadius: 16, border: "1px dashed " + sp.hairline, display: "flex", alignItems: "center", gap: 12 }}>
                  <window.VxAvatar name={c.firstName + " " + c.lastName} bg={c.avatarBg} size={36} dark={dark} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{c.firstName} {c.lastName}</div>
                    <div style={{ fontSize: 12, color: sp.muted, fontWeight: 500, marginTop: 1 }}>Match MEGGA AI · {m.score}%</div>
                  </div>
                  <BmGhostBtn dark={dark} small icon="send" onClick={() => flash("Proposition envoyée", [c.firstName + " " + c.lastName])}>Proposer</BmGhostBtn>
                </div>
              );
            })}
          </div>
        </window.VxCard>

        {/* PROCHAINE VISITE */}
        {nextVisit && (() => {
          const vd = new Date(nextVisit.dateISO);
          const vc = nextVisit.contactId ? (window.CRM_CONTACTS || []).find(c => c.id === nextVisit.contactId) : null;
          return (
            <window.VxCard index={4} padding={20} style={{ marginBottom: 16 }}>
              <window.VxSectionHead dark={dark} eyebrow="Prochaine visite" title="" />
              <div style={{ fontSize: 20, fontWeight: 800, color: sp.ink, letterSpacing: -0.5, textTransform: "capitalize", lineHeight: 1.15 }}>{vd.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" })}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: sp.inkSoft, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{nextVisit.time}</div>
              {vc && (
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14, padding: 12, borderRadius: 14, background: sp.cardSub }}>
                  <window.VxAvatar name={vc.firstName + " " + vc.lastName} bg={vc.avatarBg} size={36} dark={dark} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{vc.firstName} {vc.lastName}</div>
                    <div style={{ fontSize: 11.5, color: sp.muted, fontWeight: 500 }}>Visiteur</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 13, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: sp.muted }}><window.VxIcon name="cal" size={13} stroke={sp.muted} sw={1.9} /> Ajouté au calendrier</div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <BmGhostBtn dark={dark} flex small icon="cal" onClick={() => setVisitOpen(true)}>Déplacer</BmGhostBtn>
                <BmGhostBtn dark={dark} flex small onClick={() => { saveNextVisit(null); flash("Visite annulée", ["Retirée du calendrier"]); }}>Annuler</BmGhostBtn>
              </div>
            </window.VxCard>
          );
        })()}

        {/* PERFORMANCE */}
        <window.VxCard index={5} padding={20} style={{ marginBottom: 16 }}>
          <window.VxSectionHead dark={dark} eyebrow="Performance · 30 jours" title="" />
          <div style={{ display: "flex", gap: 12 }}>
            <BmStat icon="eye" label="Vues" value={window.vxFmtNum(bien.stats?.views)} dark={dark} />
            <BmStat icon="heart" label="Favoris" value={window.vxFmtNum(bien.stats?.favorites)} dark={dark} />
            <BmStat icon="cal" label="Demandes" value={window.vxFmtNum(bien.stats?.visitRequests)} dark={dark} />
          </div>
          <div style={{ marginTop: 16 }}><window.VxSpark points={[210, 260, 240, 320, 360, 410, 480]} color={sp.ok} /></div>
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: sp.ok }}><window.VxIcon name="trend" size={13} stroke={sp.ok} sw={2} /> +18 % vs. mois précédent</div>
        </window.VxCard>

        {/* MANDAT + VENDEUR */}
        <window.VxCard index={6} padding={20} style={{ marginBottom: 16 }}>
          <window.VxSectionHead dark={dark} eyebrow="Mandat" title="" />
          {owner && (
            <button onClick={() => flash("Fiche vendeur", [owner.firstName + " " + owner.lastName])} style={{ width: "100%", textAlign: "left", padding: 13, background: sp.cardSub, border: 0, borderRadius: 15, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <window.VxAvatar name={owner.firstName + " " + owner.lastName} bg={owner.avatarBg} size={40} dark={dark} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{owner.firstName} {owner.lastName}</div>
                <div style={{ fontSize: 11.5, color: sp.muted, fontWeight: 500 }}>Vendeur · voir la fiche</div>
              </div>
              <window.VxIcon name="chevR" size={16} stroke={sp.muted} sw={1.8} />
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              { l: "Commission", v: bien.mandat?.commission ? bien.mandat.commission + " %" : "—" },
              { l: "Signé le", v: bien.mandat?.signedAt ? new Date(bien.mandat.signedAt).toLocaleDateString("fr-CH") : "—" },
              { l: "Expire le", v: bien.mandat?.expiresAt ? new Date(bien.mandat.expiresAt).toLocaleDateString("fr-CH") : "—" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13, color: sp.muted, fontWeight: 500, whiteSpace: "nowrap" }}>{r.l}</span>
                <span style={{ fontSize: 13.5, color: sp.ink, fontWeight: 700, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                  {r.v}{r.note && <span style={{ fontSize: 11, fontWeight: 700, color: r.warn ? sp.warn : sp.muted, padding: "2px 8px", borderRadius: 999, background: r.warn ? sp.warnBg : sp.cardSub }}>{r.note}</span>}
                </span>
              </div>
            ))}
          </div>
        </window.VxCard>

        {/* DIFFUSION */}
        <window.VxCard index={7} padding={20}>
          <window.VxSectionHead dark={dark} eyebrow="Diffusion" title="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(bien.publishedTo || ["MEGGA"]).map(p => <BmPortal key={p} name={p} online dark={dark} />)}
          </div>
          <button onClick={() => flash("Aperçu public", ["Ouverture de l'annonce telle que la voit l'acheteur"])} style={{ marginTop: 13, width: "100%", height: 46, borderRadius: 14, border: "1px solid " + sp.hairline, background: "transparent", color: sp.ink, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <window.VxIcon name="external" size={15} stroke={sp.ink} sw={1.8} /> Voir l'annonce publique
          </button>
        </window.VxCard>
      </div>

      {/* ── CTA FIXE ── */}
      <div style={{ flexShrink: 0, position: "relative", zIndex: 20, padding: "10px 16px calc(30px + env(safe-area-inset-bottom))", display: "flex", gap: 10, background: dark ? "rgba(10,10,15,.82)" : "rgba(237,239,243,.86)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "inset 0 1px 0 " + sp.hairline }}>
        {editing ? (
          <BmBlackBtn dark={dark} full icon="check" onClick={saveEdit}>Enregistrer &amp; publier</BmBlackBtn>
        ) : (
          <>
            <BmGhostBtn dark={dark} flex icon="cal" onClick={() => setVisitOpen(true)}>Visite</BmGhostBtn>
            <BmBlackBtn dark={dark} flex icon="globe" onClick={() => flash("Diffusion", ["Annonce en ligne sur " + (bien.publishedTo || ["MEGGA"]).join(", ")])}>Gérer la diffusion</BmBlackBtn>
          </>
        )}
      </div>

      {/* OVERLAYS (contenus dans l'appareil) */}
      <BmLightbox open={lb.open} index={lb.i} photos={photos} dark={dark} onClose={() => setLb({ open: false, i: lb.i })} onIndex={i => setLb({ open: true, i })} />
      <BmVisitSheet open={visitOpen} onClose={() => setVisitOpen(false)} bien={bien} dark={dark} onConfirm={(d, tm, contact) => {
        saveNextVisit({ dateISO: d.toISOString(), time: tm, contactId: contact ? contact.id : null });
        flash("Visite planifiée", [`${d.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" })} à ${tm}`, "Ajoutée au calendrier · invitation envoyée"]);
      }} />

      {/* MENU D'ACTIONS */}
      {menuOpen && <BmActionMenu dark={dark} onClose={() => setMenuOpen(false)} onAction={(id) => {
        setMenuOpen(false);
        if (id === "edit") setEditing(true);
        else if (id === "visit") setVisitOpen(true);
        else if (id === "diffuse") flash("Diffusion", ["Annonce en ligne sur " + (bien.publishedTo || ["MEGGA"]).join(", ")]);
        else if (id === "preview") flash("Aperçu public", ["Ouverture de l'annonce telle que la voit l'acheteur"]);
        else if (id === "share") flash("Partage", ["Lien de l'annonce copié"]);
      }} />}

      {/* TOAST */}
      {toast && (
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 92, zIndex: 220, background: dark ? "#22242F" : "#0B0C0E", color: "#fff", borderRadius: 18, padding: "15px 18px", boxShadow: "0 24px 60px rgba(15,23,42,.45)", animation: "vxFadeUp .3s cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: toast.lines?.length ? 7 : 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(255,255,255,.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><window.VxIcon name="check" size={14} stroke="#fff" sw={2.4} /></span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{toast.title}</span>
          </div>
          {toast.lines?.map((l, i) => <div key={i} style={{ fontSize: 12.5, color: "rgba(255,255,255,.72)", paddingLeft: 34, lineHeight: 1.5 }}>{l}</div>)}
        </div>
      )}
    </div>
  );
};

window.MobileBienVitrineScreen = MobileBienVitrineScreen;
