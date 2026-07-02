// MEGGA CRM — Responsive · Écran « Mes biens » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). Portage fidèle du desktop
// (crm-screen-biens-sugar.jsx) : liste catalogue ↔ fiche bien (4 onglets
// Aperçu / Performance / Demandes / Historique). Tout est cliquable :
//   • recherche, filtres, ouverture d'un bien, retour, changement d'onglet
//   • inbox soumissions vendeurs (bottom-sheet)
//   • Modifier / Publier (animé), Appeler / Email vendeur
// Réutilise window.MTCtx / MT_LIGHT / MT_DARK (crm-mobile-today.jsx),
// window.MIcon, et la data window.CRM_BIENS / CRM_SUBMISSIONS / CRM_MATCHES /
// CRM_BIEN_HISTORY / crmContactById.

const Bm_useMT = () => React.useContext(window.MTCtx);

// ─── Photos de biens (mêmes covers que matching/today) ──────────────────
const BM_PHOTO = {
  "b-101": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80", // Eaux-Vives
  "b-102": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80", // Champel
  "b-103": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=80", // Carouge
  "b-104": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80", // Cologny
  "b-106": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80" // Pâquis loc.
};

// ─── Pool d'intérieurs partagé (galerie) ────────────────────────────────
const BM_LIST_INTERIORS = [
"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&q=80&auto=format&fit=crop",
"https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1400&q=80&auto=format&fit=crop",
"https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1400&q=80&auto=format&fit=crop",
"https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1400&q=80&auto=format&fit=crop",
"https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1400&q=80&auto=format&fit=crop",
"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80&auto=format&fit=crop",
"https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1400&q=80&auto=format&fit=crop"];

const bmListPhotos = (b) => {
  const cover = BM_PHOTO[b.id];
  const n = Math.max(3, Math.min(b.photoCount || 8, 10));
  const pool = BM_LIST_INTERIORS.filter((u) => u !== cover);
  const out = cover ? [cover] : [];
  for (let i = 0; out.length < n; i++) out.push(pool[i % pool.length]);
  return out;
};

// ─── Palette dérivée des tokens mobiles ─────────────────────────────────
function bmListPal(T) {
  const dark = T.mode === "dark";
  return {
    pageBg: dark ? "#121316" : "#E9ECF1",
    card: T.card, cardSubtle: T.cardSubtle, cardBorder: T.cardBorder,
    ink: T.ink, inkSoft: T.inkSoft, muted: T.muted, ghost: T.ghost, hair: T.hair,
    black: T.accent, onAccent: T.accentInk,
    shadowSm: T.shadowSm, shadow: T.shadow, shadowLg: T.shadowLg,
    tabBg: T.tabBg
  };
}

// ─── Statut (pilule pleine couleur + texte blanc, fonctionnel MEGGA) ────
function bmStatus(s) {
  return {
    active: { label: "Actif", tone: "#059669" },
    reserved: { label: "Réservé", tone: "#1E5BC6" },
    draft: { label: "Brouillon", tone: "#7A8088" },
    paused: { label: "En pause", tone: "#C45A00" },
    sold: { label: "Vendu", tone: "#0B0C0E" }
  }[s] || { label: s, tone: "#7A8088" };
}

// ─── Helpers format ─────────────────────────────────────────────────────
const bmFmtCHF = (n) => {
  if (n == null) return "—";
  if (n >= 1e6) return "CHF " + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M";
  return "CHF " + n.toLocaleString("fr-CH").replace(/\u202f/g, "'").replace(/,/g, "'").replace(/\s/g, "'");
};
const bmFmtNum = (n) => n == null ? "0" : n.toLocaleString("fr-CH").replace(/\u202f/g, "'").replace(/,/g, "'").replace(/\s/g, "'");
const bmFmtDate = (d, long) => d ? new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: long ? "long" : "short", year: "numeric" }) : "—";
const bmRelative = (iso) => {
  if (!iso) return "—";
  const ms = new Date() - new Date(iso),h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + " min";
  if (h < 24) return Math.round(h) + " h";
  const j = Math.round(h / 24);
  if (j < 30) return j + " j";
  return Math.round(j / 30) + " mois";
};

// ─── Icônes (trait linéaire) ────────────────────────────────────────────
const BmIcon = ({ name, size = 20, stroke = "currentColor", sw = 1.8 }) => {
  const p = {
    arrowL: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
    arrowR: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    area: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h4M4 15h4M9 4v4M15 4v4" /></>,
    rooms: <><path d="M3 21V8l9-5 9 5v13" /><path d="M3 21h18M9 21v-6h6v6" /></>,
    bed: <><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M7 10V7h10v3" /><path d="M3 18v2M21 18v2" /></>,
    bath: <><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" /><path d="M6 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2" /><path d="M7 19l-1 2M18 19l1 2" /></>,
    bolt: <><path d="M13 3 5 13h6l-1 8 8-10h-6z" /></>,
    cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    star: <><path d="m12 3 2.6 5.6L21 9.2l-4.5 4.3 1.1 6.2L12 16.8 6.4 19.7l1.1-6.2L3 9.2l6.4-.6z" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v9h14v-9" /></>,
    phone: <><path d="M5 4h3l2 4.5-2.3 1.4a11 11 0 0 0 5 5L14.5 12.5 19 14.5V18a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4 5a2 2 0 0 1 1-1z" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    send: <><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>,
    download: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
    check: <><path d="m5 13 4 4 10-12" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    pin: <><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
    sliders: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" /><circle cx="15" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></>,
    dots: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}>{p[name] || null}</svg>);

};

// ─── Placeholder photo (gradient déterministe) ──────────────────────────
const BmPhotoFallback = ({ id, style }) => {
  let n = 0;
  for (let i = 0; i < (id || "").length; i++) n = (n * 31 + id.charCodeAt(i)) % 360;
  return (
    <div style={{ ...style, background: `linear-gradient(135deg, hsl(${n} 22% 72%), hsl(${(n + 40) % 360} 20% 56%))`, display: "grid", placeItems: "center" }}>
      <BmIcon name="home" size={26} stroke="rgba(255,255,255,0.85)" sw={1.6} />
    </div>);

};
const BmCover = ({ bien, style, radius }) => {
  const url = BM_PHOTO[bien.id];
  const s = { width: "100%", height: "100%", objectFit: "cover", display: "block", ...style };
  if (url) return <img src={url} alt="" style={s} />;
  return <BmPhotoFallback id={bien.id} style={{ ...s, borderRadius: radius }} />;
};

// ═══════════════════════════════════════════════════════════════════════
//  PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════
const BmStatusPill = ({ status, onPhoto }) => {
  const meta = bmStatus(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999,
      background: meta.tone, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 0.1,
      whiteSpace: "nowrap", boxShadow: onPhoto ? "0 2px 8px rgba(0,0,0,0.25)" : "none"
    }}>{meta.label}</span>);

};

const BmGhostPill = ({ children, active, onClick, icon }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return (
    <button onClick={onClick} style={{
      height: 38, padding: "0 15px", borderRadius: 999, border: 0, cursor: "pointer",
      fontFamily: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
      background: active ? P.black : P.card, color: active ? P.onAccent : P.inkSoft,
      boxShadow: active ? "0 6px 16px -6px rgba(11,12,14,0.4)" : P.shadowSm,
      display: "inline-flex", alignItems: "center", gap: 7
    }}>{icon}{children}</button>);

};

const BmListSpec = ({ icon, value, label }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <BmIcon name={icon} size={15} stroke={P.muted} sw={1.7} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {label && <span style={{ fontSize: 11, fontWeight: 600, color: P.muted }}>{label}</span>}
    </span>);

};

// Bouton noir animé (Modifier → enregistre / Publier)
const BmAnimCTA = ({ label, doneLabel, icon, onAccentColor }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const [state, setState] = React.useState("idle");
  React.useEffect(() => {
    if (state === "running") {const t = setTimeout(() => setState("done"), 1300);return () => clearTimeout(t);}
    if (state === "done") {const t = setTimeout(() => setState("idle"), 1900);return () => clearTimeout(t);}
  }, [state]);
  const running = state === "running",done = state === "done";
  const bg = done ? "#059669" : P.black;
  return (
    <button onClick={() => state === "idle" && setState("running")} disabled={running} style={{
      flex: 1, height: 50, borderRadius: 999, border: 0, background: bg, color: P.onAccent,
      fontFamily: "inherit", fontSize: 14, fontWeight: 800, letterSpacing: -0.1,
      cursor: running ? "default" : "pointer", display: "inline-flex", alignItems: "center",
      justifyContent: "center", gap: 9, whiteSpace: "nowrap",
      boxShadow: "0 10px 24px -10px rgba(11,12,14,0.55)", transition: "background .25s ease"
    }}>
      <span style={{ display: "inline-flex", animation: running ? "bmSpin .8s linear infinite" : "none" }}>
        <BmIcon name={done ? "check" : running ? "refresh" : icon} size={16} stroke={P.onAccent} sw={done ? 2.3 : 1.9} />
      </span>
      {running ? "Enregistrement…" : done ? doneLabel : label}
    </button>);

};

// ═══════════════════════════════════════════════════════════════════════
//  LISTE — carte bien
// ═══════════════════════════════════════════════════════════════════════
const BmBienCard = ({ bien, onOpen, onMenu, delay }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const isRent = bien.transaction === "location";
  const price = isRent ? bien.rent : bien.price;
  const owner = bien.ownerContactId ? window.crmContactById(bien.ownerContactId) : null;
  const ppm2 = bien.price && bien.area ? Math.round(bien.price / bien.area) : null;
  return (
    <div role="button" tabIndex={0} onClick={onOpen} className="bmUp" style={{
      "--d": `${delay}ms`, width: "100%", textAlign: "left", fontFamily: "inherit",
      display: "block", padding: 0, border: `1px solid ${P.cardBorder}`, borderRadius: 22,
      background: P.card, cursor: "pointer", boxShadow: P.shadowSm, overflow: "hidden"
    }}>
      {/* Cover */}
      <div style={{ position: "relative", height: 158, background: P.cardSubtle }}>
        <BmCover bien={bien} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,12,14,0.30) 0%, rgba(11,12,14,0) 30%, rgba(11,12,14,0) 55%, rgba(11,12,14,0.42) 100%)" }} />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 7 }}>
          <BmStatusPill status={bien.status} onPhoto />
        </div>
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 7 }}>
          <button onClick={(e) => {e.stopPropagation();onMenu && onMenu(bien);}} aria-label="Actions" style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: "rgba(11,12,14,0.6)", backdropFilter: "blur(6px)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="#fff" aria-hidden="true">
              <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
            </svg>
          </button>
        </div>
        <div style={{ position: "absolute", left: 14, bottom: 11, right: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: 0.2 }}>{isRent ? "Location" : "Vente"}</span>
          <span style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: -0.4, fontVariantNumeric: "tabular-nums", textShadow: "0 1px 8px rgba(0,0,0,0.35)" }}>
            {bmFmtCHF(price)}{isRent && <span style={{ fontSize: 11.5, fontWeight: 700 }}>/mois</span>}
          </span>
        </div>
      </div>
      {/* Corps */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, color: P.muted }}>
          <BmIcon name="pin" size={13} stroke={P.muted} sw={1.7} />
          <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.addr}</span>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 13, flexWrap: "wrap" }}>
          <BmListSpec icon="area" value={bien.area} label="m²" />
          <BmListSpec icon="rooms" value={bien.rooms} label="pces" />
          <BmListSpec icon="bed" value={bien.beds} label="ch." />
          <BmListSpec icon="bath" value={bien.baths} label="sdb" />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${P.cardSubtle}` }}>
          {owner ?
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: owner.avatarBg || P.black, color: "#fff", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 700 }}>
                {(owner.firstName[0] + owner.lastName[0]).toUpperCase()}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{owner.firstName} {owner.lastName[0]}.</span>
            </div> :

          <span style={{ fontSize: 12, fontWeight: 600, color: P.ghost, fontStyle: "italic" }}>Vendeur non lié</span>
          }
        </div>
      </div>
    </div>);

};

// ─── Stat chip ──────────────────────────────────────────────────────────
const BmStatChip = ({ label, value, tone }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return (
    <div style={{ flexShrink: 0, minWidth: 112, background: P.card, borderRadius: 16, padding: "13px 15px", border: `1px solid ${P.cardBorder}`, boxShadow: P.shadowSm }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: P.muted }}>{label}</span>
      </div>
      <div style={{ fontSize: 29, fontWeight: 800, letterSpacing: -1, color: P.ink, fontVariantNumeric: "tabular-nums", marginTop: 7, lineHeight: 1 }}>{value}</div>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  VUE LISTE
// ═══════════════════════════════════════════════════════════════════════
const BmListView = ({ onOpen, filter, setFilter, search, setSearch, onMenu, sortBy }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const biens = window.CRM_BIENS || [];
  const stats = {
    total: biens.length,
    active: biens.filter((b) => b.status === "active").length,
    reserved: biens.filter((b) => b.status === "reserved").length,
    draft: biens.filter((b) => b.status === "draft").length
  };
  const filters = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actif" },
  { id: "reserved", label: "Réservé" },
  { id: "vente", label: "Vente" },
  { id: "location", label: "Location" },
  { id: "draft", label: "Brouillon" }];

  const filtered = biens.filter((b) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!b.title.toLowerCase().includes(q) && !b.addr.toLowerCase().includes(q) && !b.ref.toLowerCase().includes(q)) return false;
    }
    if (filter === "all") return true;
    if (filter === "vente") return b.transaction === "vente";
    if (filter === "location") return b.transaction === "location";
    return b.status === filter;
  });
  const bmPriceOf = (b) => b.price || b.rent || b.askingPrice || b.askingRent || 0;
  const bmSorters = {
    priceDesc: (a, b) => bmPriceOf(b) - bmPriceOf(a),
    priceAsc: (a, b) => bmPriceOf(a) - bmPriceOf(b),
    area: (a, b) => (b.area || 0) - (a.area || 0),
    ref: (a, b) => String(a.ref || a.title).localeCompare(String(b.ref || b.title))
  };
  const sorted = sortBy && bmSorters[sortBy] ? [...filtered].sort(bmSorters[sortBy]) : filtered;
  return (
    <div>
      <div className="bmUp" style={{ "--d": "20ms" }}>
        <h1 style={{ margin: "2px 0 4px", fontSize: 30, fontWeight: 800, letterSpacing: -1.2, color: P.ink, lineHeight: 1.05 }}>Mes biens</h1>
      </div>

      {/* Recherche */}
      <div className="bmUp" style={{ "--d": "55ms", marginTop: 16 }}>
        <div style={{ height: 46, padding: "0 15px", background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: P.shadowSm }}>
          <BmIcon name="search" size={16} stroke={P.muted} sw={1.9} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bien, adresse, référence…" style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: "none", color: P.ink, fontSize: 14, fontFamily: "inherit", fontWeight: 600 }} />
          {search && <button onClick={() => setSearch("")} style={{ border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}><BmIcon name="close" size={16} stroke={P.muted} sw={2} /></button>}
        </div>
      </div>

      {/* Filtres */}
      <div className="bmUp bm-hscroll" style={{ "--d": "115ms", display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden", margin: "8px -18px 0", padding: "8px 18px 12px" }}>
        {filters.map((f) => <BmGhostPill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</BmGhostPill>)}
      </div>

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {sorted.map((b, i) => <BmBienCard key={b.id} bien={b} onOpen={() => onOpen(b.id)} onMenu={onMenu} delay={150 + i * 55} />)}
        {sorted.length === 0 &&
        <div style={{ padding: "44px 20px", textAlign: "center", background: P.card, borderRadius: 20, border: `1px solid ${P.cardBorder}`, boxShadow: P.shadowSm }}>
            <div style={{ width: 54, height: 54, borderRadius: 999, margin: "0 auto 14px", background: P.cardSubtle, display: "grid", placeItems: "center" }}><BmIcon name="home" size={22} stroke={P.muted} /></div>
            <div style={{ fontSize: 14, fontWeight: 800, color: P.ink, marginBottom: 5 }}>Aucun bien ne correspond</div>
            <div style={{ fontSize: 12.5, color: P.muted, fontWeight: 600 }}>Réinitialisez les filtres ou la recherche.</div>
          </div>
        }
      </div>
    </div>);

};

// ═══════════════════════════════════════════════════════════════════════
//  DÉTAIL — onglets
// ═══════════════════════════════════════════════════════════════════════
const BM_TABS = [
{ id: "apercu", label: "Aperçu" },
{ id: "perf", label: "Performance" },
{ id: "demand", label: "Demandes" },
{ id: "history", label: "Historique" }];

const BmSegBar = ({ active, onChange }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return (
    <div style={{ flexShrink: 0, padding: "6px 18px 12px" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {BM_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{
              flex: 1, height: 38, border: 0, cursor: "pointer", borderRadius: 999, fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, letterSpacing: -0.2,
              color: on ? P.onAccent : P.inkSoft, background: on ? P.black : P.card,
              boxShadow: on ? T.mode === "dark" ? P.shadowSm : "0 6px 16px rgba(11,12,14,0.2)" : P.shadowSm,
              transition: "all .2s ease", whiteSpace: "nowrap", padding: "0 4px"
            }}>{t.label}</button>);

        })}
      </div>
    </div>);

};

const BmBento = ({ children, pad = "18px 18px", shadow }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return <div style={{ background: P.card, borderRadius: 20, padding: pad, border: `1px solid ${P.cardBorder}`, boxShadow: shadow === undefined ? P.shadow : shadow }}>{children}</div>;
};
const BmEyebrow = ({ children }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return <div style={{ fontSize: 10.5, fontWeight: 800, color: P.muted, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
};
const BmMetaRow = ({ label, children, last }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "11px 0", borderBottom: last ? "none" : `1px solid ${P.cardSubtle}` }}>
      <span style={{ fontSize: 12.5, color: P.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: P.ink, fontWeight: 700, textAlign: "right" }}>{children}</span>
    </div>);

};

// ─── Onglet Aperçu ──────────────────────────────────────────────────────
const BmApercu = ({ bien }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const owner = bien.ownerContactId ? window.crmContactById(bien.ownerContactId) : null;
  const platforms = ["MEGGA", "Homegate", "ImmoScout", "Newhome"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {bien.desc &&
      <BmBento>
          <BmEyebrow>Description</BmEyebrow>
          <p style={{ margin: 0, fontSize: 13.5, color: P.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>{bien.desc}</p>
          {bien.features && bien.features.length > 0 &&
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
              {bien.features.map((f) =>
          <span key={f} style={{ padding: "6px 12px", borderRadius: 999, background: P.cardSubtle, color: P.inkSoft, fontSize: 11.5, fontWeight: 700 }}>{f}</span>
          )}
            </div>
        }
        </BmBento>
      }

      <BmBento>
        <BmEyebrow>Mandat</BmEyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <BmMetaRow label="Type"><span style={{ textTransform: "capitalize" }}>{bien.mandat?.type || "—"}</span></BmMetaRow>
          <BmMetaRow label="Commission">{bien.mandat?.commission ? bien.mandat.commission + "%" : "—"}</BmMetaRow>
          <BmMetaRow label="Signé le" last={!bien.mandat?.expiresAt}>{bmFmtDate(bien.mandat?.signedAt)}</BmMetaRow>
          <BmMetaRow label="Expire le" last>{bmFmtDate(bien.mandat?.expiresAt)}</BmMetaRow>
        </div>
      </BmBento>

      <BmBento>
        <BmEyebrow>Diffusion</BmEyebrow>
        {platforms.map((pl, i) => {
          const on = (bien.publishedTo || []).includes(pl);
          return (
            <div key={pl} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < platforms.length - 1 ? `1px solid ${P.cardSubtle}` : "none" }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: on ? "#059669" : P.ghost, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: on ? P.ink : P.muted }}>{pl}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? "#059669" : P.muted }}>{on ? "Actif" : "Non publié"}</span>
            </div>);

        })}
      </BmBento>

      <BmBento>
        <BmEyebrow>Vendeur</BmEyebrow>
        {owner ?
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 48, height: 48, borderRadius: 999, flexShrink: 0, background: owner.avatarBg || P.black, color: "#fff", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 700 }}>{(owner.firstName[0] + owner.lastName[0]).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: P.ink, letterSpacing: -0.2 }}>{owner.firstName} {owner.lastName}</div>
                {owner.email && <div style={{ fontSize: 12, color: P.muted, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{owner.email}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
              <button style={{ flex: 1, height: 44, borderRadius: 999, border: 0, background: P.black, color: P.onAccent, fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 20px -10px rgba(11,12,14,0.5)" }}>
                <BmIcon name="phone" size={15} stroke={P.onAccent} sw={1.9} />Appeler
              </button>
              <button style={{ flex: 1, height: 44, borderRadius: 999, border: `1px solid ${P.cardBorder}`, background: P.cardSubtle, color: P.ink, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <BmIcon name="mail" size={15} stroke={P.ink} sw={1.9} />Email
              </button>
            </div>
          </> :

        <div style={{ padding: "18px 16px", textAlign: "center", background: P.cardSubtle, borderRadius: 14, color: P.muted, fontSize: 12.5, fontWeight: 600 }}>Aucun vendeur rattaché à ce bien.</div>
        }
      </BmBento>
    </div>);

};

// ─── Onglet Performance ─────────────────────────────────────────────────
const BmPerf = ({ bien }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const st = bien.stats || {};
  const cards = [
  { l: "Vues", v: st.views || 0, icon: "eye" },
  { l: "Favoris", v: st.favorites || 0, icon: "star" },
  { l: "Demandes de visite", v: st.visitRequests || 0, icon: "home" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cards.map((k) =>
      <BmBento key={k.l} pad="18px 20px">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: P.cardSubtle, display: "grid", placeItems: "center" }}>
              <BmIcon name={k.icon} size={20} stroke={P.ink} sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: P.muted, letterSpacing: 0.6, textTransform: "uppercase" }}>{k.l}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: P.ink, letterSpacing: -1, fontVariantNumeric: "tabular-nums", lineHeight: 1.05, marginTop: 3 }}>{bmFmtNum(k.v)}</div>
            </div>
          </div>
        </BmBento>
      )}
    </div>);

};

// ─── Onglet Demandes (matchs) ───────────────────────────────────────────
const BmDemandes = ({ bien }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const matches = (window.CRM_MATCHES || []).filter((m) => m.bienId === bien.id);
  const verdict = (s) => s >= 90 ? "Excellent" : s >= 75 ? "Très bon" : s >= 60 ? "Bon" : "À explorer";
  if (matches.length === 0) {
    return <BmBento><div style={{ padding: "28px 12px", textAlign: "center", color: P.muted, fontSize: 13, fontWeight: 600 }}>Aucune demande ni match pour ce bien.</div></BmBento>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {matches.map((m, i) => {
        const c = window.crmContactById(m.contactId);
        if (!c) return null;
        const tone = m.score >= 90 ? "#059669" : m.score >= 75 ? "#1E5BC6" : "#C45A00";
        return (
          <BmBento key={i} pad="14px 16px">
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, background: c.avatarBg || P.black, color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{(c.firstName[0] + c.lastName[0]).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: P.ink, letterSpacing: -0.2 }}>{c.firstName} {c.lastName}</div>
                <div style={{ fontSize: 11.5, color: P.muted, fontWeight: 600, marginTop: 1, textTransform: "capitalize" }}>{(m.status || "").replace(/-/g, " ")}</div>
              </div>
              <span style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, background: tone, color: "#fff", fontSize: 11.5, fontWeight: 800 }}>{verdict(m.score)}</span>
            </div>
          </BmBento>);

      })}
    </div>);

};

// ─── Onglet Historique ──────────────────────────────────────────────────
const BmHistory = ({ bien }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const history = ((window.CRM_BIEN_HISTORY || {})[bien.id] || []).slice().reverse();
  if (history.length === 0) {
    return <BmBento><div style={{ padding: "28px 12px", textAlign: "center", color: P.muted, fontSize: 13, fontWeight: 600 }}>Aucun événement enregistré.</div></BmBento>;
  }
  return (
    <BmBento pad="20px 18px">
      <BmEyebrow>Journal du bien</BmEyebrow>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {history.map((a, i) =>
        <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, paddingBottom: i === history.length - 1 ? 0 : 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: P.black, flexShrink: 0, boxShadow: `0 0 0 4px ${T.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(11,12,14,0.06)"}` }} />
              {i < history.length - 1 && <div style={{ width: 2, flex: 1, background: P.cardSubtle, marginTop: 4 }} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, lineHeight: 1.5 }}>{a.text}</div>
              <div style={{ fontSize: 11.5, color: P.muted, fontWeight: 600, marginTop: 4 }}>{bmFmtDate(a.at)} · il y a {bmRelative(a.at)}</div>
            </div>
          </div>
        )}
      </div>
    </BmBento>);

};

// ─── Galerie plein écran ────────────────────────────────────────────────
const BmListGallery = ({ photos, start = 0, onClose }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const dark = T.mode === "dark";
  const [i, setI] = React.useState(start);
  const n = photos.length;
  const go = (d) => setI((p) => (p + d + n) % n);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: dark ? "rgba(8,9,11,0.98)" : "rgba(238,241,245,0.98)", backdropFilter: "blur(8px)", animation: "bmFade .26s ease both" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "grid", placeItems: "center", padding: "calc(54px + 8px) 16px 0" }}>
        <img key={i} src={photos[i]} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 16, boxShadow: dark ? "none" : "0 18px 50px rgba(15,23,42,0.18)", animation: "bmFadeIn .3s ease both" }} />
        <button onClick={onClose} style={{ position: "absolute", top: "calc(54px + 6px)", right: 16, width: 40, height: 40, borderRadius: 999, border: 0, background: P.card, boxShadow: P.shadow, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <BmIcon name="close" size={19} stroke={P.ink} sw={2} />
        </button>
        <span style={{ position: "absolute", top: "calc(54px + 12px)", left: 18, height: 32, padding: "0 13px", borderRadius: 999, background: P.card, boxShadow: P.shadowSm, color: P.ink, fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1} / {n}</span>
        {n > 1 &&
        <>
            <button onClick={() => go(-1)} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 999, border: 0, background: P.card, boxShadow: P.shadow, cursor: "pointer", display: "grid", placeItems: "center" }}><BmIcon name="arrowL" size={20} stroke={P.ink} sw={2} /></button>
            <button onClick={() => go(1)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 999, border: 0, background: P.card, boxShadow: P.shadow, cursor: "pointer", display: "grid", placeItems: "center" }}><BmIcon name="arrowR" size={20} stroke={P.ink} sw={2} /></button>
          </>
        }
      </div>
      <div className="bm-hscroll" style={{ display: "flex", gap: 8, padding: "14px 16px calc(18px + env(safe-area-inset-bottom))", overflowX: "auto" }}>
        {photos.map((p, k) =>
        <button key={k} onClick={() => setI(k)} style={{ flexShrink: 0, width: 72, height: 52, borderRadius: 10, overflow: "hidden", border: 0, cursor: "pointer", padding: 0, boxShadow: k === i ? `0 0 0 2.5px ${P.ink}` : "none", opacity: k === i ? 1 : dark ? 0.5 : 0.62 }}>
            <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        )}
      </div>
    </div>);

};

// ─── Header détail (hero photo + essentiels) ────────────────────────────
const BmDetailHero = ({ bien, onOpenGallery }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const photos = bmListPhotos(bien);
  const hasPhotos = bien.photoCount > 0 && photos.length > 0;
  const isRent = bien.transaction === "location";
  const price = isRent ? bien.rent : bien.price;
  const ppm2 = bien.price && bien.area ? Math.round(bien.price / bien.area) : null;
  const specs = [
  { icon: "area", v: bien.area + " m²", l: "Surface" },
  { icon: "rooms", v: bien.rooms, l: "Pièces" },
  { icon: "bed", v: bien.beds, l: "Chambres" },
  { icon: "bath", v: bien.baths, l: "S. de bain" },
  { icon: "bolt", v: bien.energy || "—", l: "DPE" },
  { icon: "cal", v: bien.year || "—", l: "Année" }];

  return (
    <div className="bmUp" style={{ "--d": "20ms", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Photo */}
      <button onClick={() => hasPhotos && onOpenGallery && onOpenGallery(photos)} style={{ position: "relative", height: 218, borderRadius: 22, overflow: "hidden", background: P.cardSubtle, boxShadow: P.shadow, border: 0, padding: 0, cursor: hasPhotos ? "pointer" : "default", display: "block", width: "100%" }}>
        <BmCover bien={bien} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,12,14,0.3) 0%, rgba(11,12,14,0) 32%, rgba(11,12,14,0) 60%, rgba(11,12,14,0.18) 100%)" }} />
        <div style={{ position: "absolute", top: 13, left: 13, display: "flex", gap: 7 }}>
          <BmStatusPill status={bien.status} onPhoto />
          <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 11px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#0B0C0E", fontSize: 10.5, fontWeight: 800, boxShadow: "0 2px 8px rgba(0,0,0,0.22)" }}>{isRent ? "Location" : "Vente"}</span>
        </div>
        {hasPhotos &&
        <span style={{ position: "absolute", right: 13, bottom: 13, display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 999, background: "rgba(255,255,255,0.95)", color: "#0B0C0E", fontSize: 12, fontWeight: 800, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <BmIcon name="eye" size={14} stroke="#0B0C0E" sw={1.9} />{bien.photoCount} photos
          </span>
        }
      </button>

      {/* Titre + prix */}
      <div>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, color: P.ink, letterSpacing: -0.7, lineHeight: 1.15 }}>{bien.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, color: P.muted }}>
          <BmIcon name="pin" size={14} stroke={P.muted} sw={1.7} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{bien.addr} · {bien.canton}</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: P.ink, letterSpacing: -1, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {bmFmtCHF(price)}{isRent && <span style={{ fontSize: 14, fontWeight: 700, color: P.muted }}>/mois</span>}
          </span>
          {ppm2 && <span style={{ fontSize: 12.5, fontWeight: 700, color: P.muted, fontVariantNumeric: "tabular-nums" }}>CHF {bmFmtNum(ppm2)}/m²{bien.charges ? ` · +${bien.charges} ch.` : ""}</span>}
        </div>
      </div>

      {/* Specs */}
      <BmBento pad="6px 18px" shadow={T.shadowSm}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
          {specs.map((s, i) =>
          <div key={s.l} style={{ padding: "14px 4px", display: "flex", flexDirection: "column", gap: 6, borderBottom: i < 3 ? `1px solid ${P.cardSubtle}` : "none", borderRight: i % 3 !== 2 ? `1px solid ${P.cardSubtle}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <BmIcon name={s.icon} size={14} stroke={P.muted} sw={1.7} />
                <span style={{ fontSize: 10, fontWeight: 800, color: P.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>{s.l}</span>
              </div>
              <span style={{ fontSize: 17, fontWeight: 800, color: P.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" }}>{s.v}</span>
            </div>
          )}
        </div>
      </BmBento>
    </div>);

};

const BmDetailPanels = ({ bien, tab }) =>
<div key={tab} style={{ animation: "bmFadeIn .4s cubic-bezier(.2,.8,.2,1)" }}>
    {tab === "apercu" && <BmApercu bien={bien} />}
    {tab === "perf" && <BmPerf bien={bien} />}
    {tab === "demand" && <BmDemandes bien={bien} />}
    {tab === "history" && <BmHistory bien={bien} />}
  </div>;


// ═══════════════════════════════════════════════════════════════════════
//  CHROME
// ═══════════════════════════════════════════════════════════════════════
const BmTopBar = ({ inDetail, onBack, bien, onMenu }) => {
  const T = Bm_useMT();const P = bmListPal(T);
  const circle = { width: 40, height: 40, borderRadius: 999, border: `1px solid ${P.cardBorder}`, background: P.card, boxShadow: P.shadowSm, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 };
  return (
    <header style={{ paddingTop: 54, paddingLeft: 18, paddingRight: 18, paddingBottom: 10, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <button onClick={onBack} style={circle}><BmIcon name="arrowL" size={18} stroke={P.ink} sw={2} /></button>
      {inDetail && bien &&
      <span style={{ fontSize: 12, fontWeight: 700, color: P.muted, fontVariantNumeric: "tabular-nums", letterSpacing: 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.ref}</span>
      }
      <div style={{ flex: 1 }} />
    </header>);

};

const BM_NAV = [
{ id: "today", label: "Aujourd'hui", icon: "home" },
{ id: "pipeline", label: "Pipeline", icon: "trend" },
{ id: "matching", label: "Matching", icon: "spark" },
{ id: "agenda", label: "Agenda", icon: "cal" },
{ id: "more", label: "Plus", icon: "menu" }];

const BmTabBar = () => {
  const T = Bm_useMT();const P = bmListPal(T);
  return (
    <nav style={{ flexShrink: 0, background: P.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${P.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {BM_NAV.map((tb) => {
        const on = tb.id === "more"; // « Mes biens » vit dans Plus
        return (
          <button key={tb.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <window.MIcon name={tb.icon} size={22} sw={on ? 2.2 : 1.9} color={on ? P.ink : P.ghost} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? P.ink : P.muted, whiteSpace: "nowrap" }}>{tb.label}</span>
          </button>);

      })}
    </nav>);

};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═══════════════════════════════════════════════════════════════════════
const MobileBiensScreen = ({ dark = false, initialBienId = null, onGo }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const P = bmListPal(T);
  const [selectedId, setSelectedId] = React.useState(initialBienId);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState("apercu");
  const [menuBien, setMenuBien] = React.useState(null);
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [topMenu, setTopMenu] = React.useState(false);
  const [sortMenu, setSortMenu] = React.useState(false);
  const [sortBy, setSortBy] = React.useState(null);
  const [statusFor, setStatusFor] = React.useState(null);
  const [, setBmRev] = React.useState(0);
  const bmBump = () => setBmRev((x) => x + 1);
  const BM_STATUSES = [
  { id: "active", label: "Actif" },
  { id: "reserved", label: "Réservé" },
  { id: "draft", label: "Brouillon" }];
  const [bmImporting, setBmImporting] = React.useState(false);
  const bmFileRef = React.useRef(null);
  const [gallery, setGallery] = React.useState(null);
  const [bmToast, setBmToast] = React.useState(null);
  const bmToastRef = React.useRef(null);
  const showBmToast = (t) => {setBmToast(t);clearTimeout(bmToastRef.current);bmToastRef.current = setTimeout(() => setBmToast(null), 2200);};
  const handleBienAction = (id) => {
    const bien = menuBien;
    if (id === "delete") {setConfirmDel(menuBien);setMenuBien(null);return;}
    if (id === "status") {setStatusFor(menuBien);setMenuBien(null);return;}
    setMenuBien(null);
    if (!bien) return;
    if (id === "duplicate") {
      const list = window.CRM_BIENS || [];
      const idx = list.findIndex((b) => b.id === bien.id);
      const copy = { ...bien, id: bien.id + "-copy-" + Date.now(), ref: (bien.ref || "MG") + "-C", status: "draft", title: bien.title + " (copie)" };
      list.splice(idx < 0 ? 0 : idx + 1, 0, copy);
      bmBump();
      showBmToast("Bien dupliqué (brouillon)");
      return;
    }
    if (id === "remove") {
      bien.status = "draft"; bien.visibility = "private";
      bmBump();
      showBmToast("Bien retiré de la diffusion");
      return;
    }
  };
  const handleTopAction = (id) => {
    setTopMenu(false);
    if (id === "create") {if (onGo) onGo("biens-new");return;}
    if (id === "import") {if (bmFileRef.current) bmFileRef.current.click();return;}
    if (id === "sort") {setSortMenu(true);return;}
  };
  const BM_SORTS = [
  { id: "priceDesc", label: "Prix décroissant" },
  { id: "priceAsc", label: "Prix croissant" },
  { id: "area", label: "Surface" },
  { id: "ref", label: "Référence A–Z" }];

  const handleSortPick = (id) => {
    setSortMenu(false);
    setSortBy(id);
    const lbl = (BM_SORTS.find((s) => s.id === id) || {}).label || "";
    showBmToast(`Trié — ${lbl}`);
  };
  const handleBmImport = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBmImporting(true);
    setTimeout(() => {
      setBmImporting(false);
      const name = f.name.length > 26 ? f.name.slice(0, 23) + "…" : f.name;
      showBmToast(`Bien importé — ${name}`);
    }, 900);
  };
  const mainRef = React.useRef(null);

  const open = (id) => {setTab("apercu");setSelectedId(id);if (mainRef.current) mainRef.current.scrollTop = 0;};
  const back = () => {if (selectedId) {if (mainRef.current) mainRef.current.scrollTop = 0;setSelectedId(null);} else if (onGo) {onGo("more");}};

  const selected = selectedId ? (window.CRM_BIENS || []).find((b) => b.id === selectedId) : null;
  const inDetail = !!selected;

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", background: P.pageBg, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, position: "relative" }}>
        <style>{`
          @keyframes bmUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
          @keyframes bmFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
          @keyframes bmFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes bmSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes bmSpin { to { transform: rotate(360deg); } }
          .bmUp { opacity: 1; }
          @media (prefers-reduced-motion: no-preference) { .bmUp { animation: bmUp .5s cubic-bezier(.2,.8,.2,1) var(--d, 40ms) both; } }
          .bm-hscroll::-webkit-scrollbar { display: none; }
          .bm-hscroll { scrollbar-width: none; }
        `}</style>

        <BmTopBar inDetail={inDetail} onBack={back} bien={selected} onMenu={() => setTopMenu(true)} />

        {inDetail ?
        <>
            <main ref={mainRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 18px 24px", WebkitOverflowScrolling: "touch" }}>
              <div style={{ paddingTop: 6 }}>
                <BmDetailHero bien={selected} onOpenGallery={(photos) => setGallery(photos)} />
              </div>
              <div style={{ position: "sticky", top: 0, zIndex: 5, background: P.pageBg, margin: "10px -18px 0" }}>
                <BmSegBar active={tab} onChange={setTab} />
              </div>
              <BmDetailPanels bien={selected} tab={tab} />
            </main>
            {/* Barre d'action fixe */}
            <div style={{ flexShrink: 0, padding: "14px 18px 30px", background: P.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${P.hair}`, display: "flex", gap: 11 }}>
              <button style={{ height: 50, padding: "0 22px", borderRadius: 999, border: 0, background: P.cardSubtle, color: P.ink, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: P.shadowSm, flexShrink: 0 }}>
                <BmIcon name="file" size={15} stroke={P.ink} sw={1.8} />Modifier
              </button>
              <BmAnimCTA label={selected.status === "draft" ? "Publier" : "Mettre à jour"} doneLabel={selected.status === "draft" ? "Publié" : "À jour"} icon={selected.status === "draft" ? "send" : "refresh"} />
            </div>
          </> :

        <main ref={mainRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 18px 26px", WebkitOverflowScrolling: "touch" }}>
            <BmListView onOpen={open} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} onMenu={setMenuBien} sortBy={sortBy} />
          </main>
        }

        {!inDetail && <BmTabBar />}

        {gallery && <BmListGallery photos={gallery} start={0} onClose={() => setGallery(null)} />}
        {topMenu && window.SgActionMenu &&
        <window.SgActionMenu
          mode="sheet"
          title="Mes biens"
          dark={dark}
          pal={{ card: P.card, ink: P.ink, inkSoft: P.inkSoft, hair: P.cardSubtle, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.42)" }}
          items={[
          { id: "create", icon: "plus", label: "Nouveau bien" },
          { id: "import", icon: "upload", label: "Importer un bien" },
          { id: "sort", icon: "sort", label: "Trier les biens" }]
          }
          sheetStyle={{ margin: "0 10px 96px" }}
          onAction={handleTopAction}
          onClose={() => setTopMenu(false)} />

        }
        {sortMenu && window.SgActionMenu &&
        <window.SgActionMenu
          mode="sheet"
          title="Trier les biens"
          dark={dark}
          pal={{ card: P.card, ink: P.ink, inkSoft: P.inkSoft, hair: P.cardSubtle, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.42)" }}
          items={BM_SORTS.map((s) => ({ id: s.id, icon: sortBy === s.id ? "check" : "sort", label: s.label }))}
          sheetStyle={{ margin: "0 10px 96px" }}
          onAction={handleSortPick}
          onClose={() => setSortMenu(false)} />

        }
        {menuBien && window.SgActionMenu &&
        <window.SgActionMenu
          mode="sheet"
          title={menuBien.title}
          subtitle={menuBien.addr}
          dark={dark}
          pal={{ card: P.card, ink: P.ink, inkSoft: P.inkSoft, hair: P.cardSubtle, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.42)" }}
          items={[
          { id: "duplicate", icon: "copy", label: "Dupliquer le bien" },
          { id: "status", icon: "stage", label: "Changer le statut" },
          { id: "remove", icon: "ban", label: "Retirer de la diffusion", divider: true },
          { id: "delete", icon: "trash", label: "Supprimer le bien", danger: true }]
          }
          sheetStyle={{ margin: "0 10px 96px" }}
          onAction={handleBienAction}
          onClose={() => setMenuBien(null)} />

        }
        {statusFor && window.SgActionMenu &&
        <window.SgActionMenu
          mode="sheet"
          title="Changer le statut"
          subtitle={statusFor.title}
          dark={dark}
          pal={{ card: P.card, ink: P.ink, inkSoft: P.inkSoft, hair: P.cardSubtle, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.42)" }}
          items={BM_STATUSES.map((s) => ({ id: s.id, icon: statusFor.status === s.id ? "check" : "stage", label: s.label }))}
          sheetStyle={{ margin: "0 10px 96px" }}
          onAction={(sid) => {const b = statusFor;b.status = sid;if (sid !== "draft") b.visibility = "public";setStatusFor(null);bmBump();showBmToast(`Statut : ${(BM_STATUSES.find((x) => x.id === sid) || {}).label}`);}}
          onClose={() => setStatusFor(null)} />

        }
        {confirmDel &&
        <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={() => setConfirmDel(null)} style={{ position: "absolute", inset: 0, background: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.42)", animation: "bmFade .18s ease both" }}></div>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", margin: "0 10px 96px", background: P.card, borderRadius: 26, boxShadow: P.shadowLg, overflow: "hidden", padding: "22px 20px 18px", animation: "bmUp .26s cubic-bezier(.2,.9,.3,1.1) both" }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: P.ink }}>Supprimer ce bien&nbsp;?</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: P.inkSoft, marginTop: 6, lineHeight: 1.45 }}>
                <b style={{ fontWeight: 700, color: P.ink }}>{confirmDel.title}</b> sera définitivement supprimé du catalogue, ainsi que ses demandes et son historique.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: P.ink, background: P.cardSubtle }}>Annuler</button>
                <button onClick={() => {const d = confirmDel;const list = window.CRM_BIENS || [];const i = list.findIndex((b) => b.id === d.id);if (i >= 0) list.splice(i, 1);setConfirmDel(null);bmBump();showBmToast("Bien supprimé");}} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: "#fff", background: dark ? "#E0738C" : "#8E1F3D" }}>Supprimer</button>
              </div>
            </div>
          </div>
        }
        {bmToast &&
        <div style={{ position: "absolute", left: "50%", bottom: 100, transform: "translateX(-50%)", zIndex: 50, background: dark ? "#ECEDF3" : "#0B0C0E", color: dark ? "#0B0C0E" : "#fff", fontSize: 13, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 12px 30px rgba(15,23,42,0.25)", whiteSpace: "nowrap" }}>{bmToast}</div>
        }
        <input ref={bmFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.csv,image/*,application/pdf" onChange={handleBmImport} style={{ display: "none" }} />
        {bmImporting &&
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.42)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: P.card, color: P.ink, fontSize: 13.5, fontWeight: 700, padding: "14px 20px", borderRadius: 16, boxShadow: P.shadowLg }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${P.cardSubtle}`, borderTopColor: P.ink, display: "inline-block", animation: "bmSpin .7s linear infinite" }}></span>
              Import en cours…
            </div>
          </div>
        }
      </div>
    </window.MTCtx.Provider>);

};

window.MobileBiensScreen = MobileBiensScreen;