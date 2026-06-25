// MEGGA CRM — Responsive · Écran « Matching » MOBILE (375–402)
// ─────────────────────────────────────────────────────────────────────────────
// Le desktop est déjà un pattern INBOX (liste compacte + panneau focus). C'est le
// quick win responsive : sur mobile, le split se déplie en navigation à deux temps.
//   Vue 1 — LISTE : acheteurs triés par score, filtres d'engagement, jauge de match.
//   Vue 2 — FOCUS : plein écran, glisse depuis la droite. Critères éditables inline,
//           biens correspondants empilés, note MEGGA AI, CTA noir sticky en bas.
// Sugar Pure, theme-aware (clair + sombre). Réutilise window.MTCtx / MIcon / MAv /
// MEGGAWordmark + les données partagées window.CRM_* (crm-data.jsx).
// KYC = rappel doux non-bloquant. Couleur d'avatar = identité du contact (pas un accent UI).

const MM_useMT = () => React.useContext(window.MTCtx);

// ─── Photos de biens (réutilise MT_PHOTO + compléments) ──────────────────
const MM_PHOTO = {
  "b-101": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80",   // Eaux-Vives
  "b-102": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80", // Champel
  "b-103": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=80", // Carouge
  "b-104": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80", // Cologny
  "b-106": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80", // Pâquis loc.
};

// ─── Galerie : pool d'intérieurs partagé, cover du bien en tête ──────────
const MM_INTERIORS = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1500&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1500&q=80&auto=format&fit=crop",
];
const mmBienPhotos = (b) => {
  const cover = MM_PHOTO[b.id];
  const n = Math.max(3, Math.min(b.photoCount || 8, 12));
  const pool = MM_INTERIORS.filter((u) => u !== cover);
  const out = cover ? [cover] : [];
  let k = 0;
  while (out.length < n) { out.push(pool[k % pool.length]); k++; }
  return out;
};

// Glyphe WhatsApp officiel — vert de marque uniquement (jamais en accent UI)
const MM_WA_GREEN = "#25D366";
const MmWaGlyph = ({ size = 18 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }}>
    <path fill={MM_WA_GREEN} d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.8 1 3.9 1.5 6.2 1.5 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.5-1.5l-.4-.2-4 1 1.1-3.9-.3-.4A10.5 10.5 0 1 1 16 26.6zm6-7.9c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.8.1-.2.3-.9 1-1 1.2-.2.2-.4.2-.7.1-1.8-.9-3-1.6-4.2-3.6-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6-.1-.2-.8-1.8-1-2.5-.3-.7-.5-.6-.7-.6h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8 0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.9 5.2 2.2.9 3 1 4.1.9.7-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z" />
  </svg>
);

// ─── Formats ─────────────────────────────────────────────────────────────
const mmCHF = (n) => "CHF " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
const mmShort = (n) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return `${n}`;
};
const mmBienPrice = (b) => {
  if (!b) return "";
  if (b.price) return `CHF ${mmShort(b.price)}`;
  if (b.rent) return `${mmCHF(b.rent)}/mois`;
  return "";
};
const mmInitials = (c) => `${(c.firstName || " ")[0]}${(c.lastName || " ")[0]}`.toUpperCase();
const mmBuyerType = (b) => b.criteria?.transaction === "location" ? "Location" : (b.tags?.includes("investisseur") ? "Investisseur" : "Acheteur");
const mmCities = (b) => (b.criteria?.cities || b.criteria?.cantons || []).slice(0, 2).join(" · ");
const mmRooms = (b) => b.rooms ? `${b.rooms} pces` : "";

// ─── Construction des groupes acheteur → matches ─────────────────────────
function mmBuildGroups() {
  const C = window.CRM_CONTACTS || [];
  const M = window.CRM_MATCHES || [];
  return C.filter((c) => c.type === "buyer")
    .map((buyer) => {
      const matches = M.filter((m) => m.contactId === buyer.id)
        .map((m) => ({ ...m, bien: window.crmBienById(m.bienId) }))
        .sort((a, b) => b.score - a.score);
      return { buyer, matches, topScore: matches[0]?.score || 0 };
    })
    .filter((g) => g.matches.length > 0)
    .sort((a, b) => b.topScore - a.topScore);
}

// Onglet d'engagement d'un groupe.
function mmTabOf(g) {
  const ms = g.matches;
  if (ms.some((m) => ["liked", "viewed"].includes(m.status))) return "engaged";
  if (ms.some((m) => m.status === "to-send")) return "to-send";
  if (ms.length > 0 && ms.every((m) => m.status === "sent")) return "no-reply";
  return "to-send";
}

// Signal d'engagement le plus fort (pour la pastille de liste).
function mmEngagement(g, T) {
  const ms = g.matches;
  if (ms.some((m) => m.status === "liked"))  return { label: "A aimé un bien", tone: "good" };
  if (ms.some((m) => m.status === "viewed")) return { label: "Dossier consulté", tone: "warm" };
  if (ms.some((m) => m.status === "to-send"))return { label: "À activer", tone: "ink" };
  if (ms.every((m) => m.status === "sent"))  return { label: "Envoyé · sans retour", tone: "muted" };
  return { label: "Nouveau", tone: "muted" };
}
function mmTone(tone, T) {
  const dark = T.mode === "dark";
  if (tone === "good")  return dark ? { bg: "rgba(6,107,69,0.26)", fg: "#7BD4A6" } : { bg: "#DCF1E6", fg: "#066B45" };
  if (tone === "warm")  return dark ? { bg: "rgba(180,87,10,0.22)", fg: "#F0B27A" } : { bg: "#FAEAD7", fg: "#B4570A" };
  if (tone === "ink")   return { bg: T.accent, fg: T.accentInk };
  return { bg: T.cardSubtle, fg: T.muted }; // muted
}

// ─── Jauge de match circulaire (monochrome ink — signal de qualité) ──────
const MmRing = ({ score, size = 46, stroke = 4, faded = false }) => {
  const T = MM_useMT();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  const col = faded ? T.muted : T.ink;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.hair} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800,
        fontSize: size * 0.3, color: faded ? T.muted : T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
        {score}
      </div>
    </div>
  );
};

// ─── Verdict de matching qualitatif (le score chiffré reste interne à l'algo) ──
const mMatchLabel = (s) => s >= 90 ? "Excellent" : s >= 75 ? "Très bon" : s >= 60 ? "Bon" : "À explorer";
const MmVerdict = ({ score, big = false, onPhoto = false }) => {
  const T = MM_useMT();
  const base = { display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0,
    height: big ? 32 : 26, padding: big ? "0 15px" : "0 12px", borderRadius: 999,
    fontSize: big ? 13 : 11.5, fontWeight: 800, letterSpacing: -0.1 };
  const skin = onPhoto
    ? { background: "rgba(11,12,14,0.78)", backdropFilter: "blur(8px)", color: "#fff" }
    : { background: T.cardSubtle, color: T.ink };
  return <span style={{ ...base, ...skin }}>{mMatchLabel(score)}</span>;
};

// ─── Icône type de bien (trait linéaire, monochrome) ─────────────────────
const MmBienIcon = ({ bien, size = 18, color }) => {
  const T = MM_useMT();
  const c = color || T.inkSoft;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  if (!bien) return null;
  if (bien.transaction === "location") return (<svg {...common}><circle cx="8" cy="14" r="4" /><path d="m11 11 8.5-8.5" /><path d="m17 5 3 3" /><path d="m14 8 3 3" /></svg>);
  if (bien.type === "maison") return (<svg {...common}><path d="M3 11 12 3l9 8" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg>);
  return (<svg {...common}><rect x="5" y="3" width="14" height="18" rx="1.2" /><path d="M9 8h0M15 8h0M9 12h0M15 12h0M9 16h0M15 16h0" strokeWidth={2.1} /><path d="M11 21v-3h2v3" /></svg>);
};

// ─── Pastille soft générique ─────────────────────────────────────────────
const MmChip = ({ children, tone = "muted", solid = false }) => {
  const T = MM_useMT();
  const t = mmTone(tone, T);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0,
      height: 22, padding: "0 9px", borderRadius: 999, background: t.bg, color: t.fg,
      fontSize: 10.5, fontWeight: 800, letterSpacing: tone === "ink" ? -0.1 : 0.2,
      textTransform: tone === "ink" || tone === "muted" || tone === "good" || tone === "warm" ? "none" : "none",
    }}>{children}</span>
  );
};

// ─── Chip KYC — rappel doux NON-bloquant (jamais rouge "bloqué") ─────────
const MmKyc = ({ kyc }) => {
  const T = MM_useMT();
  const s = kyc?.status || "none";
  const dark = T.mode === "dark";
  const map = {
    verified: { label: "KYC vérifié",   icon: "check",  bg: dark ? "rgba(6,107,69,0.24)" : "#DCF1E6", fg: dark ? "#7BD4A6" : "#066B45" },
    pending:  { label: "KYC en cours",  icon: "clock",  bg: dark ? "rgba(180,87,10,0.20)" : "#FAEAD7", fg: dark ? "#F0B27A" : "#B4570A" },
    none:     { label: "KYC · optionnel",icon: "shield", bg: T.cardSubtle, fg: T.muted },
  };
  const m = map[s] || map.none;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 11px", borderRadius: 999,
      background: m.bg, color: m.fg, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
      <window.MIcon name={m.icon} size={13} sw={2.1} color={m.fg} />{m.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Badge « verified » (sceau festonné 8 lobes + check) — réf. icône social media
// ═══════════════════════════════════════════════════════════════════════
// Badge « verified » — tracé exact fourni (sceau festonné, check détouré en négatif via evenodd). viewBox 19.
const MM_SEAL_D = "M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z";
// Le disque blanc plein derrière est entièrement recouvert par le sceau SAUF à l'emplacement de la
// coche (trou en négatif) → la coche ressort en blanc sur n'importe quel fond (photo, sombre, clair).
const MmVerifiedBadge = ({ size = 18, seal = "#0041D9", check = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 19 19" style={{ flexShrink: 0, display: "block" }} aria-label="Vérifié">
    <circle cx="9.5" cy="9.5" r="5.6" fill={check} />
    <path d={MM_SEAL_D} fill={seal} fillRule="evenodd" clipRule="evenodd" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════
//  VUE 1 — CARTE ACHETEUR (liste)
// ═══════════════════════════════════════════════════════════════════════
const MmBuyerCard = ({ group, onOpen, onMenu, i, hideVerdict }) => {
  const T = MM_useMT();
  const { buyer, matches, topScore } = group;
  const top = matches[0];
  const eng = mmEngagement(group, T);
  const et = mmTone(eng.tone, T);
  const photo = top?.bien ? MM_PHOTO[top.bien.id] : null;
  // budget lisible
  const cr = buyer.criteria || {};
  const budget = cr.budgetMin != null && cr.budgetMax != null
    ? `CHF ${mmShort(cr.budgetMin)} – ${mmShort(cr.budgetMax)}`
    : cr.budgetMax != null
      ? (cr.transaction === "location" ? `CHF ${mmShort(cr.budgetMax)}/mois` : `CHF ${mmShort(cr.budgetMax)}`)
      : "Budget à préciser";
  // Badge certifié (sceau bleu) = seul badge, affiché systématiquement après KYC validé
  const verified = buyer.kyc?.status === "verified";
  return (
    <div role="button" tabIndex={0} onClick={onOpen} style={{
      width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", padding: 0,
      background: T.card, borderRadius: 22, boxShadow: T.shadow, overflow: "hidden", display: "block",
    }}>
      {/* photo plein cadre du meilleur bien */}
      <div style={{ position: "relative", height: 216, background: T.cardSubtle }}>
        {photo
          ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><MmBienIcon bien={top?.bien} size={44} color={T.ghost} /></div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,9,12,0.86) 0%, rgba(8,9,12,0.30) 42%, rgba(8,9,12,0) 68%)" }} />

        {onMenu && (
          <button onClick={(e) => { e.stopPropagation(); onMenu(group); }} aria-label="Actions" style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, border: 0, background: "rgba(8,9,12,0.55)", backdropFilter: "blur(6px)", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="#fff" aria-hidden="true">
              <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
            </svg>
          </button>
        )}

        {/* haut-droite : verdict de match */}
        {!hideVerdict && <div style={{ position: "absolute", top: 12, right: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 13px", borderRadius: 999,
            background: "rgba(255,255,255,0.95)", color: "#0B0C0E", fontSize: 12, fontWeight: 800, letterSpacing: -0.1, whiteSpace: "nowrap" }}>
            {mMatchLabel(topScore)}
          </span>
        </div>}

        {/* bas : identité + nb biens */}
        <div style={{ position: "absolute", left: 13, right: 13, bottom: 13, display: "flex", alignItems: "center", gap: 10 }}>
          <window.MAv bg={buyer.avatarBg} ink="#fff" size={38}>{mmInitials(buyer)}</window.MAv>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{buyer.firstName} {buyer.lastName}</span>
            {verified && <MmVerifiedBadge size={16} />}
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
            <span>{matches.length} bien{matches.length > 1 ? "s" : ""}</span>
            <window.MIcon name="arrow" size={15} sw={2.2} color="#fff" />
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  VUE 2 — FOCUS : champ critère éditable inline
// ═══════════════════════════════════════════════════════════════════════
const MmEditField = ({ label, value, suffix = "", onCommit }) => {
  const T = MM_useMT();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value ?? ""));
  const ref = React.useRef(null);
  React.useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);
  const commit = () => { const n = parseInt(draft.replace(/\D/g, ""), 10); if (!isNaN(n)) onCommit(n); setEditing(false); };
  return (
    <div style={{ minWidth: 0, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14,
      boxShadow: T.shadowSm, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</span>
      {editing ? (
        <input ref={ref} value={draft} inputMode="numeric"
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={{ width: "100%", border: 0, outline: "none", background: "transparent", fontFamily: "inherit",
            fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3, padding: 0, fontVariantNumeric: "tabular-nums" }} />
      ) : (
        <button onClick={() => { setDraft(String(value ?? "")); setEditing(true); }} style={{
          display: "flex", alignItems: "baseline", gap: 3, border: 0, background: "transparent", padding: 0, cursor: "text", fontFamily: "inherit", textAlign: "left" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" }}>
            {typeof value === "number" ? (label === "Budget max" || label === "Budget min" ? mmShort(value) : value) : "—"}
          </span>
          {suffix && <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{suffix}</span>}
        </button>
      )}
    </div>
  );
};

// Carte d'un bien correspondant (focus)
const MmMatchCard = ({ m, sent, scheduled, onSend, onSchedule, onOpen, i, hideReasons, hideVerdict, hideActions, inDossier, onToggleDossier }) => {
  const T = MM_useMT();
  const b = m.bien;
  if (!b) return null;
  const photo = MM_PHOTO[b.id];
  const reasons = (m.reasons || []).slice(0, 3);
  const open = onOpen ? () => onOpen() : undefined;
  return (
    <div style={{ border: `1px solid ${T.cardBorder}`, background: T.card, borderRadius: 18, boxShadow: T.shadowSm, overflow: "hidden" }}>
      {/* photo — ouvre l'annonce */}
      <div onClick={open} style={{ position: "relative", height: 116, background: T.cardSubtle, cursor: open ? "pointer" : "default" }}>
        {photo
          ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><MmBienIcon bien={b} size={30} color={T.ghost} /></div>}
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 8 }}>
          {!hideVerdict && <MmVerdict score={m.score} onPhoto />}
        </div>
      </div>
      {/* corps */}
      <div style={{ padding: "13px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div onClick={open} style={{ flex: 1, minWidth: 0, cursor: open ? "pointer" : "default" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.addr}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{mmBienPrice(b)}</div>
        </div>
        {/* raisons du score */}
        {!hideReasons && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
          {reasons.map((r, k) => {
            const neg = r.includes("−") || r.includes("-");
            return (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 9px", borderRadius: 999,
                background: T.cardSubtle, color: neg ? T.muted : T.inkSoft, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={{ color: neg ? T.muted : T.ink, fontWeight: 800 }}>{neg ? "–" : "+"}</span>{r.replace(/[+−-]\s*\d+/g, "").trim()}
              </span>
            );
          })}
        </div>}
        {/* actions par bien */}
        {!hideActions && <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
          <button onClick={onSchedule} style={{
            flex: 1, height: 40, borderRadius: 999, border: `1px solid ${T.mode === "dark" ? "rgba(255,255,255,0.14)" : "#E4E7EC"}`,
            background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.ink,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <window.MIcon name="cal" size={15} sw={2} color={scheduled ? T.muted : T.ink} />
            {scheduled ? "Visite planifiée" : "Planifier"}
          </button>
          <button onClick={onSend} style={{
            flex: 1, height: 40, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800,
            background: sent ? T.cardSubtle : T.accent, color: sent ? T.muted : T.accentInk,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <window.MIcon name={sent ? "check" : "arrow"} size={15} sw={2.2} color={sent ? T.muted : T.accentInk} />
            {sent ? "Envoyé" : "Envoyer"}
          </button>
        </div>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  GALERIE + BOTTOM SHEETS (Envoyer / Planifier) — mobile, Sugar Pure
// ═══════════════════════════════════════════════════════════════════════
const mmGhostBtn = (T) => ({ flex: 1, height: 50, borderRadius: 999, border: 0, background: T.cardSubtle, color: T.inkSoft,
  cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2 });
const mmBlackBtn = (T, disabled) => ({ flex: 1.4, height: 50, borderRadius: 999, border: 0, cursor: disabled ? "default" : "pointer",
  fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, background: disabled ? T.cardSubtle : T.accent,
  color: disabled ? T.ghost : T.accentInk, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 });
const mmSheetLabel = (T) => ({ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.muted, margin: "0 0 9px" });

const MmSheet = ({ eyebrow, title, sub, onClose, children, footer }) => {
  const T = MM_useMT();
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end",
      background: T.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.34)", backdropFilter: "blur(6px)", animation: "mmScrim .28s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderTopLeftRadius: 26, borderTopRightRadius: 26,
        boxShadow: "0 -20px 60px rgba(15,23,42,0.22)", borderTop: T.mode === "dark" ? `1px solid ${T.cardBorder}` : 0,
        padding: "10px 20px calc(22px + env(safe-area-inset-bottom))", animation: "mmSheetUp .42s cubic-bezier(.2,.85,.25,1) both", maxHeight: "88%", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.cardBorder, margin: "0 auto 14px", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.muted }}>{eyebrow}</div>}
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: -0.4, marginTop: 3 }}>{title}</div>
            {sub && <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, marginTop: 3 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 999, border: 0, background: T.cardSubtle, cursor: "pointer", display: "grid", placeItems: "center" }}>
            <window.MEIcon name="close" size={17} color={T.muted} strokeWidth={2} />
          </button>
        </div>
        <div className="mmMain" style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>{children}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexShrink: 0 }}>{footer}</div>
      </div>
    </div>
  );
};

const MmBienRow = ({ bien }) => {
  const T = MM_useMT();
  const photo = MM_PHOTO[bien.id];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, background: T.cardSubtle, marginBottom: 10 }}>
      <div style={{ width: 54, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: T.card, display: "grid", placeItems: "center" }}>
        {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <MmBienIcon bien={bien} size={20} color={T.ghost} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.title}</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.addr}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{mmBienPrice(bien)}</div>
    </div>
  );
};

const MmGallery = ({ photos, start = 0, title, onClose }) => {
  const T = MM_useMT();
  const dark = T.mode === "dark";
  const [i, setI] = React.useState(start);
  const n = photos.length;
  const go = React.useCallback((d) => setI((p) => (p + d + n) % n), [n]);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);
  const ink = dark ? "#fff" : T.ink;
  const sub = dark ? "rgba(255,255,255,0.6)" : T.muted;
  const ctrlBg = dark ? "rgba(255,255,255,0.14)" : T.card;
  const navBtn = (side) => ({ position: "absolute", top: "50%", [side]: 12, transform: "translateY(-50%)",
    width: 44, height: 44, borderRadius: 999, border: 0, cursor: "pointer", background: ctrlBg, boxShadow: dark ? "none" : T.shadowSm, display: "grid", placeItems: "center" });
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column",
      background: dark ? "rgba(8,9,11,0.98)" : "rgba(240,242,246,0.98)", backdropFilter: "blur(10px)", animation: "mmScrim .26s ease both" }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "grid", placeItems: "center", padding: "calc(16px + env(safe-area-inset-top)) 14px 0" }}>
        <img key={i} src={photos[i]} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 14, boxShadow: dark ? "none" : "0 18px 50px rgba(15,23,42,0.18)", animation: "mmGalFade .3s ease both" }} />
        <button onClick={onClose} style={{ position: "absolute", top: "calc(52px + env(safe-area-inset-top))", right: 14, zIndex: 2, width: 40, height: 40, borderRadius: 999, border: 0, background: ctrlBg, boxShadow: dark ? "none" : T.shadowSm, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <window.MEIcon name="close" size={19} color={ink} strokeWidth={2} />
        </button>
        <button onClick={() => go(-1)} style={navBtn("left")}><window.MEIcon name="chevron-left" size={22} color={ink} strokeWidth={2.1} /></button>
        <button onClick={() => go(1)} style={navBtn("right")}><window.MEIcon name="chevron-right" size={22} color={ink} strokeWidth={2.1} /></button>
      </div>
      <div className="mmMain" style={{ display: "flex", gap: 8, padding: "14px 16px calc(100px + env(safe-area-inset-bottom))", overflowX: "auto" }}>
        {photos.map((p, k) => (
          <button key={k} onClick={() => setI(k)} style={{ flexShrink: 0, width: 72, height: 52, borderRadius: 10, overflow: "hidden", border: 0, cursor: "pointer", padding: 0,
            boxShadow: k === i ? `0 0 0 2.5px ${ink}` : "none", opacity: k === i ? 1 : (dark ? 0.5 : 0.62) }}>
            <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── FICHE ANNONCE (mobile) — vue complète d'un bien, Sugar Pure ─────────
const MM_ENERGY_TONE = { A: "#059669", B: "#059669", C: "#65A30D", D: "#C45A00", E: "#C45A00", F: "#DC2626", G: "#DC2626" };
const MmAnnonceCard = ({ title, eyebrow, children }) => {
  const T = MM_useMT();
  return (
    <div style={{ border: `1px solid ${T.cardBorder}`, background: T.card, borderRadius: 18, boxShadow: T.shadowSm, padding: 18 }}>
      {(title || eyebrow) && (
        <div style={{ marginBottom: 14 }}>
          {eyebrow && <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{eyebrow}</div>}
          {title && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
};

// Fiche annonce plein écran. Props : m {bien, score, status, reasons}, onBack,
// onSend?/onSchedule? (contexte matching). Galerie intégrée (MmGallery).
const MmBienSheet = ({ m, onBack, onSend, onSchedule, sent, scheduled }) => {
  const T = MM_useMT();
  const b = m.bien;
  const [showGallery, setShowGallery] = React.useState(false);
  const wrapRef = React.useRef(null);
  const [wide, setWide] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const measure = () => setWide(el.offsetWidth >= 680);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el); return () => ro.disconnect();
  }, []);
  if (!b) return null;
  const photos = mmBienPhotos(b);
  const cover = photos[0];
  const reasons = (m.reasons || []).filter(r => !/[−-]\s*\d/.test(r)).map(r => r.replace(/[+−-]\s*\d+/g, "").trim());
  const I = (name, size, color, sw = 1.7) => window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;
  const specs = [
    { label: "Surface", value: `${b.area} m²`, icon: "ruler" },
    { label: "Pièces", value: `${b.rooms}`, icon: "home" },
    b.beds != null ? { label: "Chambres", value: `${b.beds}`, icon: "bed" } : null,
    b.baths != null ? { label: "Salles d'eau", value: `${b.baths}`, icon: "bath" } : null,
    b.year ? { label: "Année", value: `${b.year}`, icon: "calendar" } : null,
    b.energy ? { label: "Énergie", value: b.energy, icon: "bolt", tone: MM_ENERGY_TONE[b.energy] } : null,
  ].filter(Boolean);
  const stats = b.stats || {};

  const heroBlock = (
    <button onClick={() => photos.length && setShowGallery(true)} style={{ position: "relative", width: "100%", height: wide ? 340 : 220, borderRadius: 20, overflow: "hidden", border: 0, padding: 0, cursor: photos.length ? "pointer" : "default", background: T.cardSubtle, boxShadow: T.shadowSm }}>
      {cover
        ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><MmBienIcon bien={b} size={34} color={T.ghost} /></div>}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,12,14,0.28) 0%, rgba(11,12,14,0) 34%, rgba(11,12,14,0) 60%, rgba(11,12,14,0.5) 100%)" }} />
      <span style={{ position: "absolute", right: 12, bottom: 12, display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 999, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", color: "#0B0C0E", fontSize: 12.5, fontWeight: 800, boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}>
        {I("camera", 14, "#0B0C0E", 1.9)}{b.photoCount || photos.length}
      </span>
    </button>
  );

  const priceBlock = (
    <div style={{ border: `1px solid ${T.cardBorder}`, background: T.card, borderRadius: 20, boxShadow: T.shadowSm, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: wide ? 30 : 25, fontWeight: 800, color: T.ink, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{mmBienPrice(b)}</div>
          {b.charges != null && <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 5 }}>+ {mmCHF(b.charges)} de charges{b.rent ? "/mois" : ""}</div>}
        </div>
        {m.score != null && <MmVerdict score={m.score} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 12.5, color: T.muted, fontWeight: 600 }}>
        {I("location", 15, T.muted, 1.7)}
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.addr}</span>
      </div>
    </div>
  );

  const specsBlock = (
    <MmAnnonceCard title="Caractéristiques">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {specs.map(s => (
          <div key={s.label} style={{ background: T.cardSubtle, borderRadius: 14, padding: "13px 11px", display: "flex", flexDirection: "column", gap: 8 }}>
            {I(s.icon, 17, s.tone || T.inkSoft, 1.7)}
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: s.tone || T.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.4, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </MmAnnonceCard>
  );

  const reasonsBlock = reasons.length > 0 ? (
    <MmAnnonceCard title="Pourquoi ce match" eyebrow="Matching IA">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {reasons.map((r, k) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 12px", borderRadius: 999, background: T.cardSubtle, color: T.inkSoft, fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: T.ink, fontWeight: 800 }}>+</span>{r}
          </span>
        ))}
      </div>
    </MmAnnonceCard>
  ) : null;

  const featuresBlock = (b.features || []).length > 0 ? (
    <MmAnnonceCard title="Atouts du bien">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {b.features.map(f => (
          <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 999, background: T.cardSubtle, color: T.ink, fontSize: 12.5, fontWeight: 700 }}>
            {I("check", 14, T.ink, 2.2)}{f}
          </span>
        ))}
      </div>
    </MmAnnonceCard>
  ) : null;

  const descBlock = b.desc ? (
    <MmAnnonceCard title="Description">
      <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>{b.desc}</div>
    </MmAnnonceCard>
  ) : null;

  const diffusionBlock = (b.publishedTo || []).length > 0 ? (
    <MmAnnonceCard title="Diffusion" eyebrow={b.visibility === "public" ? "En ligne" : "Privé"}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
        {b.publishedTo.map(p => (
          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 999, background: T.cardSubtle, color: T.ink, fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "#059669" }} />{p}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[{ k: "views", l: "Vues" }, { k: "favorites", l: "Favoris" }, { k: "visitRequests", l: "Visites" }].map(s => (
          <div key={s.k} style={{ background: T.cardSubtle, borderRadius: 14, padding: "12px 11px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.4 }}>{stats[s.k] != null ? stats[s.k] : "—"}</div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.4, textTransform: "uppercase", marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </MmAnnonceCard>
  ) : null;

  const colCards = [specsBlock, reasonsBlock, featuresBlock, descBlock, diffusionBlock].filter(Boolean);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, zIndex: 65, background: T.canvas, display: "flex", flexDirection: "column", animation: "mmAnnonceIn .32s cubic-bezier(.2,.8,.2,1) both" }}>
      <style>{`@keyframes mmAnnonceIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}`}</style>
      <header style={{ paddingTop: 52, paddingLeft: 14, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: T.headerBg, backdropFilter: "blur(18px)", boxShadow: `0 1px 0 ${T.hair}` }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, boxShadow: T.shadowSm, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, maxWidth: wide ? 980 : "none", margin: wide ? "0 auto" : 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: wide ? "22px 24px 32px" : "16px 16px 28px" }}>
        {wide ? (
          <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, alignItems: "start" }}>
              {heroBlock}
              {priceBlock}
            </div>
            <div style={{ columnCount: 2, columnGap: 16 }}>
              {colCards.map((blk, i) => (
                <div key={i} style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 16 }}>{blk}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {heroBlock}{priceBlock}{specsBlock}{reasonsBlock}{featuresBlock}{descBlock}{diffusionBlock}
          </div>
        )}
      </main>

      <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 16px calc(20px + env(safe-area-inset-bottom))", background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.06})` }}>
        <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: wide ? 980 : "none", margin: wide ? "0 auto" : 0 }}>
          {onSchedule && (
            <button onClick={onSchedule} style={{ height: 50, padding: "0 18px", borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, color: T.ink, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              {I("calendar", 16, scheduled ? T.muted : T.ink, 1.9)}{scheduled ? "Planifiée" : "Visite"}
            </button>
          )}
          <button onClick={() => onSend ? onSend() : (photos.length && setShowGallery(true))} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: sent ? T.cardSubtle : T.accent, color: sent ? T.muted : T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            {onSend ? <>{I(sent ? "check" : "send", 17, sent ? T.muted : T.accentInk, 2)}{sent ? "Envoyé" : "Envoyer l'annonce"}</> : <>{I("camera", 18, T.accentInk, 1.9)}Voir les {b.photoCount || photos.length} photos</>}
          </button>
        </div>
      </div>

      {showGallery && <MmGallery photos={photos} start={0} title={b.title} onClose={() => setShowGallery(false)} />}
    </div>
  );
};

const mmDefaultMessage = (channel, buyer, items) => {
  const n = items.length;
  const bienLine = n === 1
    ? `le bien « ${items[0].bien.title} »`
    : `une sélection de ${n} biens`;
  if (channel === "whatsapp") {
    return `Bonjour ${buyer.firstName}, j'ai ${bienLine} qui correspond${n === 1 ? "" : "ent"} à votre recherche. Découvrez le dossier ci-dessous — dites-moi ce qui vous plaît et on organise les visites.`;
  }
  return `Bonjour ${buyer.firstName},\n\nSuite à nos échanges, je vous adresse ${bienLine} qui correspond${n === 1 ? "" : "ent"} à vos critères. Vous trouverez le détail dans le dossier joint.\n\nN'hésitez pas à me dire lesquels retiennent votre attention — je reste à votre disposition pour organiser les visites.\n\nBien à vous,`;
};

const MmDossierLink = ({ items, buyer, dark }) => {
  const T = MM_useMT();
  const cover = MM_PHOTO[items[0].bien.id];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 11, borderRadius: 14, background: T.card, boxShadow: T.shadowSm }}>
      <div style={{ position: "relative", width: 56, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
        {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <MmBienIcon bien={items[0].bien} size={20} color={T.ghost} />}
        {items.length > 1 && (
          <span style={{ position: "absolute", inset: 0, background: "rgba(11,12,14,0.5)", display: "grid", placeItems: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>+{items.length - 1}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>Dossier · {items.length} bien{items.length > 1 ? "s" : ""}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>megga.ch/d/{buyer.firstName.toLowerCase()}-{(items[0].bienId || "").replace(/[^a-z0-9]/gi, "")}</div>
      </div>
      <window.MEIcon name="link" size={16} color={T.muted} strokeWidth={1.9} />
    </div>
  );
};

const MmSendModal = ({ items, buyer, onClose, onConfirm }) => {
  const T = MM_useMT();
  const [channel, setChannel] = React.useState("email");
  const [step, setStep] = React.useState("compose");
  const [msg, setMsg] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const channels = [{ id: "email", label: "E-mail" }, { id: "whatsapp", label: "WhatsApp" }];
  const multi = items.length > 1;
  const dark = T.mode === "dark";
  const goPreview = () => {
    setMsg(mmDefaultMessage(channel, buyer, items));
    setSubject(multi ? `${items.length} biens pour votre recherche` : items[0].bien.title);
    setStep("preview");
  };

  if (step === "preview") {
    const isWa = channel === "whatsapp";
    return (
      <MmSheet eyebrow={isWa ? "Aperçu WhatsApp" : "Aperçu e-mail"} title={`${buyer.firstName} ${buyer.lastName}`}
        sub="Relisez le message avant l'envoi" onClose={onClose}
        footer={<>
          <button onClick={() => setStep("compose")} style={mmGhostBtn(T)}>Retour</button>
          <button onClick={() => onConfirm(channel)} style={mmBlackBtn(T)}>
            {isWa ? <MmWaGlyph size={17} color={T.accentInk} /> : <window.MEIcon name="send" size={16} color={T.accentInk} strokeWidth={2} />}
            {isWa ? "Envoyer sur WhatsApp" : "Envoyer l'e-mail"}
          </button>
        </>}>
        {isWa ? (
          // Aperçu bulle WhatsApp
          <div style={{ borderRadius: 18, overflow: "hidden", background: dark ? "#0B141A" : "#E5DDD3", padding: "16px 14px", boxShadow: T.shadowSm }}>
            <div style={{ maxWidth: "92%", marginLeft: "auto", background: dark ? "#005C4B" : "#D9FDD3", borderRadius: "14px 14px 4px 14px", padding: "10px 12px 8px", boxShadow: "0 1px 1px rgba(0,0,0,0.12)" }}>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} style={{ width: "100%", border: 0, outline: "none", resize: "vertical", background: "transparent", fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: dark ? "#E9EDEF" : "#111B21" }} />
              <div style={{ marginTop: 8 }}><MmDossierLink items={items} buyer={buyer} dark={dark} /></div>
              <div style={{ textAlign: "right", fontSize: 10.5, fontWeight: 600, color: dark ? "rgba(233,237,239,0.6)" : "#667781", marginTop: 6 }}>
                {new Date().toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })} ✓✓
              </div>
            </div>
          </div>
        ) : (
          // Aperçu e-mail
          <div style={{ borderRadius: 16, background: T.card, boxShadow: T.shadowSm, overflow: "hidden" }}>
            <div style={{ padding: "13px 15px", borderBottom: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 7 }}>À&nbsp;: {buyer.firstName} {buyer.lastName} &lt;{buyer.email || `${buyer.firstName.toLowerCase()}@email.ch`}&gt;</div>
              <div style={{ ...mmSheetLabel(T), margin: "0 0 5px" }}>Objet</div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", border: 0, outline: "none", background: T.cardSubtle, borderRadius: 10, padding: "10px 12px", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }} />
            </div>
            <div style={{ padding: "13px 15px" }}>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={7} style={{ width: "100%", border: 0, outline: "none", resize: "vertical", background: "transparent", fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, color: T.inkSoft }} />
              <div style={{ marginTop: 10 }}><MmDossierLink items={items} buyer={buyer} dark={dark} /></div>
            </div>
          </div>
        )}
      </MmSheet>
    );
  }

  return (
    <MmSheet eyebrow={multi ? "Envoyer le dossier" : "Envoyer un dossier"} title={`${buyer.firstName} ${buyer.lastName}`}
      sub={multi ? `${items.length} biens sélectionnés` : null} onClose={onClose}
      footer={<>
        <button onClick={onClose} style={mmGhostBtn(T)}>Annuler</button>
        <button onClick={goPreview} style={mmBlackBtn(T)}>
          <window.MEIcon name="arrow-right" size={16} color={T.accentInk} strokeWidth={2} />Continuer
        </button>
      </>}>
      <div>{items.map((m) => <MmBienRow key={m.bienId} bien={m.bien} />)}</div>
      <div style={{ ...mmSheetLabel(T), marginTop: 8 }}>Canal d'envoi</div>
      <div style={{ display: "flex", gap: 9 }}>
        {channels.map((c) => {
          const on = c.id === channel;
          return (
            <button key={c.id} onClick={() => setChannel(c.id)} style={{ flex: 1, height: 52, borderRadius: 14, border: 0, cursor: "pointer",
              background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14, fontWeight: 800, letterSpacing: -0.2 }}>
              {c.id === "whatsapp"
                ? <MmWaGlyph size={18} />
                : <window.MEIcon name="mail" size={17} color={on ? T.accentInk : T.inkSoft} strokeWidth={1.9} />}{c.label}
            </button>
          );
        })}
      </div>
    </MmSheet>
  );
};

const MM_VISIT_DURATIONS = [30, 45, 60, 90];
const MM_VISIT_SLOTS = ["Demain · 10:30", "Demain · 14:00", "Jeu. · 17:30"];
const MmVisitModal = ({ match, buyer, onClose, onConfirm }) => {
  const T = MM_useMT();
  const [dur, setDur] = React.useState(45);
  const [slot, setSlot] = React.useState(null);
  return (
    <MmSheet eyebrow="Planifier une visite" title={`${buyer.firstName} ${buyer.lastName}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} style={mmGhostBtn(T)}>Annuler</button>
        <button disabled={!slot} onClick={() => slot && onConfirm(slot, dur)} style={mmBlackBtn(T, !slot)}>
          <window.MEIcon name="calendar" size={16} color={slot ? T.accentInk : T.ghost} strokeWidth={2} />Proposer
        </button>
      </>}>
      <MmBienRow bien={match.bien} />
      <div style={{ ...mmSheetLabel(T), marginTop: 8 }}>Durée</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {MM_VISIT_DURATIONS.map((d) => {
          const on = d === dur;
          return (
            <button key={d} onClick={() => setDur(d)} style={{ flex: 1, height: 44, borderRadius: 12, border: 0, cursor: "pointer",
              background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft, fontSize: 13, fontWeight: 800, letterSpacing: -0.2 }}>
              {d} min
            </button>
          );
        })}
      </div>
      <div style={mmSheetLabel(T)}>Créneau proposé</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {MM_VISIT_SLOTS.map((s) => {
          const on = s === slot;
          return (
            <button key={s} onClick={() => setSlot(s)} style={{ height: 50, borderRadius: 14, border: 0, cursor: "pointer", textAlign: "left",
              padding: "0 16px", display: "flex", alignItems: "center", gap: 11, fontFamily: "inherit", fontSize: 14, fontWeight: 800, letterSpacing: -0.2,
              background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.ink }}>
              <window.MEIcon name="clock" size={16} color={on ? T.accentInk : T.muted} strokeWidth={1.9} />
              {s}
              {on && <span style={{ marginLeft: "auto" }}><window.MEIcon name="check" size={17} color={T.accentInk} strokeWidth={2.2} /></span>}
            </button>
          );
        })}
      </div>
    </MmSheet>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  VUE 2 — PANNEAU FOCUS (plein écran)
// ═══════════════════════════════════════════════════════════════════════
const MM_AI_NOTES = {
  "c-001": "Marie a visité le 5 pièces Carouge il y a 36 h sans suivi. Le bien à 94 % colle pile à son profil famille — relance prioritaire.",
  "c-003": "Lead chaud pré-qualifié par MEGGA AI. KYC requis avant l'offre, mais non bloquant pour envoyer le dossier.",
  "c-002": "Investisseur, pas pressé. Élargir au réseau MEGGA pour densifier les options.",
  "c-007": "Offre déjà en cours sur Cologny (96 %). Ne pas brouiller le signal — garder un seul bien actif.",
  "c-005": "Expat US, arrive en juillet. Le 3 pièces meublé Pâquis coche tous les critères de location.",
};

const MmFocus = ({ group, onBack }) => {
  const T = MM_useMT();
  const { buyer, matches, topScore } = group;
  const cr = buyer.criteria || {};
  const [crit, setCrit] = React.useState({ budgetMin: cr.budgetMin, budgetMax: cr.budgetMax, areaMin: cr.areaMin, roomsMin: cr.roomsMin });
  const baseRef = React.useRef({ budgetMin: cr.budgetMin, budgetMax: cr.budgetMax, areaMin: cr.areaMin, roomsMin: cr.roomsMin });
  const [searching, setSearching] = React.useState(false);
  const dirty = JSON.stringify(crit) !== JSON.stringify(baseRef.current);
  const [sent, setSent] = React.useState(() => new Set(matches.filter((m) => m.status === "sent").map((m) => m.bienId)));
  const [scheduled, setScheduled] = React.useState(() => new Set());
  const [dossier, setDossier] = React.useState(() => new Set());
  const [modal, setModal] = React.useState(null);
  const [gallery, setGallery] = React.useState(null);
  const [bienSheet, setBienSheet] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const pushToast = (msg) => { setToast(msg); window.clearTimeout(pushToast._t); pushToast._t = window.setTimeout(() => setToast(null), 1900); };
  const openSend = (items) => setModal({ kind: "send", items });
  const openVisit = (m) => setModal({ kind: "visit", match: m });
  const openGallery = (b) => setGallery({ photos: mmBienPhotos(b), start: 0, title: b.title });
  const confirmSend = (channel) => {
    const ids = modal.items.map((m) => m.bienId);
    setSent((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n; });
    setDossier((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    setModal(null);
    const canal = channel === "whatsapp" ? "WhatsApp" : "e-mail";
    pushToast(ids.length > 1 ? `Dossier de ${ids.length} biens envoyé à ${buyer.firstName} · ${canal}` : `Dossier envoyé à ${buyer.firstName} · ${canal}`);
  };
  const confirmVisit = (slot) => {
    const id = modal.match.bienId;
    setScheduled((s) => { const n = new Set(s); n.add(id); return n; });
    setModal(null);
    pushToast(`Visite proposée · ${slot}`);
  };
  const toggleDossier = (id) => {
    setDossier((s) => {
      const n = new Set(s); const has = n.has(id); has ? n.delete(id) : n.add(id);
      pushToast(has ? "Retiré du dossier" : `Ajouté au dossier · ${n.size} bien${n.size > 1 ? "s" : ""}`);
      return n;
    });
  };
  const relaunch = () => {
    if (searching || !dirty) return;
    setSearching(true);
    window.setTimeout(() => {
      setSearching(false);
      baseRef.current = { ...crit };
      pushToast(`Recherche relancée · ${matches.length} correspondances réévaluées`);
    }, 1150);
  };

  const note = MM_AI_NOTES[buyer.id];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: T.canvas, color: T.ink }}>
      {/* top bar */}
      <header style={{ paddingTop: 52, paddingLeft: 14, paddingRight: 16, paddingBottom: 8, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "transparent" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, boxShadow: T.shadowSm, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      </header>

      {/* corps */}
      <main style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: dossier.size > 0 ? "18px 18px 178px" : "18px 18px 30px" }}>
        {/* critères éditables */}
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: T.muted }}>Critères de recherche</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {cr.budgetMin != null && <MmEditField label="Budget min" value={crit.budgetMin} suffix="CHF" onCommit={(v) => setCrit((c) => ({ ...c, budgetMin: v }))} />}
            {cr.budgetMax != null && <MmEditField label="Budget max" value={crit.budgetMax} suffix="CHF" onCommit={(v) => setCrit((c) => ({ ...c, budgetMax: v }))} />}
            {cr.areaMin != null && <MmEditField label="Surface min" value={crit.areaMin} suffix="m²" onCommit={(v) => setCrit((c) => ({ ...c, areaMin: v }))} />}
            {cr.roomsMin != null && <MmEditField label="Pièces min" value={crit.roomsMin} suffix="pces" onCommit={(v) => setCrit((c) => ({ ...c, roomsMin: v }))} />}
          </div>
          {(dirty || searching) && (
            <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 11, padding: "11px 12px 11px 14px", borderRadius: 14, background: T.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F3F5FA", border: `1px solid ${T.cardBorder}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>{searching ? "MEGGA AI recalcule…" : "Critères modifiés"}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginTop: 1 }}>{searching ? "Réévaluation des correspondances" : "Relancez pour mettre à jour les biens"}</div>
              </div>
              <button onClick={relaunch} disabled={searching} style={{ flexShrink: 0, height: 38, padding: "0 16px", borderRadius: 999, border: 0, cursor: searching ? "default" : "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, background: T.accent, color: T.accentInk, opacity: searching ? 0.9 : 1, display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                {searching
                  ? <span style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: T.accentInk, animation: "mmSpin .7s linear infinite", display: "inline-block" }} />
                  : <window.MIcon name="spark" size={15} sw={2} color={T.accentInk} />}
                {searching ? "Analyse…" : "Relancer"}
              </button>
            </div>
          )}
          {/* tags statiques */}
          {(cr.types?.length || cr.mustHave?.length) > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
              {(cr.types || []).map((t) => <MmChip key={t} tone="muted">{t}</MmChip>)}
              {(cr.mustHave || []).map((t) => <MmChip key={t} tone="muted">{t}</MmChip>)}
            </div>
          )}
        </div>

        {/* biens correspondants */}
        <div style={{ marginTop: 24, marginBottom: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Biens correspondants</h3>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.muted, fontVariantNumeric: "tabular-nums" }}>{matches.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {matches.map((m, i) => (
            <MmMatchCard key={m.bienId} m={m} i={i} hideReasons hideVerdict
              sent={sent.has(m.bienId)} scheduled={scheduled.has(m.bienId)}
              inDossier={dossier.has(m.bienId)} onToggleDossier={() => toggleDossier(m.bienId)}
              onSend={() => openSend([m])} onSchedule={() => openVisit(m)} onOpen={() => setBienSheet(m)} />
          ))}
        </div>
      </main>

      {/* barre dossier collante */}
      {dossier.size > 0 && (
        <div style={{ position: "absolute", left: 14, right: 14, bottom: "calc(94px + env(safe-area-inset-bottom))", zIndex: 56, padding: "12px 14px 12px 16px", borderRadius: 22,
          background: T.card, boxShadow: `${T.shadowLg || T.shadow}, 0 18px 44px rgba(15,23,42,${T.mode === "dark" ? 0.5 : 0.16})`,
          display: "flex", alignItems: "center", gap: 12, animation: "mmSheetUp .34s cubic-bezier(.2,.85,.25,1) both" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>{dossier.size} bien{dossier.size > 1 ? "s" : ""} au dossier</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted }}>Prêt à envoyer à {buyer.firstName}</div>
          </div>
          <button onClick={() => openSend(matches.filter((m) => dossier.has(m.bienId)))} style={{ height: 46, padding: "0 20px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, background: T.accent, color: T.accentInk, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <window.MEIcon name="send" size={16} color={T.accentInk} strokeWidth={2} />Envoyer le dossier
          </button>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: "absolute", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 80,
          padding: "11px 18px", borderRadius: 999, background: "rgba(11,12,14,0.92)", color: "#fff", fontSize: 13, fontWeight: 700,
          whiteSpace: "nowrap", boxShadow: "0 12px 30px rgba(0,0,0,0.3)", animation: "mmToast .26s cubic-bezier(.2,.8,.2,1) both" }}>
          {toast}
        </div>
      )}

      {/* modals + galerie */}
      {modal && (modal.kind === "send"
        ? <MmSendModal items={modal.items} buyer={buyer} onClose={() => setModal(null)} onConfirm={confirmSend} />
        : <MmVisitModal match={modal.match} buyer={buyer} onClose={() => setModal(null)} onConfirm={confirmVisit} />)}
      {gallery && <MmGallery photos={gallery.photos} start={gallery.start} title={gallery.title} onClose={() => setGallery(null)} />}
      {bienSheet && <MmBienSheet m={bienSheet} onBack={() => setBienSheet(null)} sent={sent.has(bienSheet.bienId)} scheduled={scheduled.has(bienSheet.bienId)} onSend={() => { const mm = bienSheet; setBienSheet(null); openSend([mm]); }} onSchedule={() => { const mm = bienSheet; setBienSheet(null); openVisit(mm); }} />}
    </div>
  );
};

// ─── Header + tab bar ────────────────────────────────────────────────────
const MmHeader = ({ onOpenSearch, onOpenMenu }) => {
  const T = MM_useMT();
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <window.MEGGAWordmark color={T.ink} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onOpenSearch} aria-label="Recherche & MEGGA AI" style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}><window.MIcon name="search" size={18} sw={2} color={T.ink} /></button>
        <button onClick={onOpenMenu} aria-label="Plus d'options" style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={T.ink}><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
        </button>
      </div>
    </header>
  );
};

const MM_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const MmTabBar = () => {
  const T = MM_useMT();
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {MM_TABS.map((tb) => {
        const on = tb.id === "matching";
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
//  ÉCRAN MATCHING MOBILE
// ═══════════════════════════════════════════════════════════════════════
const MM_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "to-send", label: "À activer" },
  { id: "engaged", label: "Engagés" },
  { id: "no-reply", label: "Sans retour" },
];

const MobileMatchingScreen = ({ dark = false, onGo }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const groups = React.useMemo(() => mmBuildGroups(), []);
  const [extraGroups, setExtraGroups] = React.useState([]);
  const [filter, setFilter] = React.useState("all");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sel, setSel] = React.useState(null);   // groupe en focus (conservé pendant la sortie)
  const [open, setOpen] = React.useState(false);
  const [menuGroup, setMenuGroup] = React.useState(null);
  const [confirmExclude, setConfirmExclude] = React.useState(null);
  const [screenMenu, setScreenMenu] = React.useState(false);
  const [sortMenu, setSortMenu] = React.useState(false);
  const [mmSort, setMmSort] = React.useState("score");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [newSearchOpen, setNewSearchOpen] = React.useState(false);
  const [mmToast, setMmToast] = React.useState(null);
  const [mmToastDanger, setMmToastDanger] = React.useState(false);
  const mmToastRef = React.useRef(null);
  const showMmToast = (t, danger = false) => { setMmToast(t); setMmToastDanger(danger); clearTimeout(mmToastRef.current); mmToastRef.current = setTimeout(() => setMmToast(null), 2200); };
  const handleScreenAction = (id) => {
    setScreenMenu(false);
    if (id === "settings") { setSettingsOpen(true); return; }
    if (id === "new-profile") { setNewSearchOpen(true); return; }
    if (id === "sort") { setSortMenu(true); return; }
    showMmToast("");
  };
  const handleMatchAction = (id) => {
    const g = menuGroup;
    const b = menuGroup?.buyer;
    setMenuGroup(null);
    if (id === "exclude") { setConfirmExclude(b); return; }
    if (id === "refine") { openFocus(g); return; }
    if (id === "contact") { onGo && onGo("contact"); return; }
    const L = { send: "Sélection envoyée à l'acheteur" };
    showMmToast(L[id] || "");
  };

  const allGroups = React.useMemo(() => [...extraGroups, ...groups], [extraGroups, groups]);
  const counts = React.useMemo(() => {
    const c = { all: allGroups.length, "to-send": 0, engaged: 0, "no-reply": 0 };
    allGroups.forEach((g) => { c[mmTabOf(g)] = (c[mmTabOf(g)] || 0) + 1; });
    return c;
  }, [allGroups]);
  const visibleRaw = filter === "all" ? allGroups : allGroups.filter((g) => mmTabOf(g) === filter);
  const MM_SORTS = [
    { id: "score", label: "Meilleur score" },
    { id: "count", label: "Nombre de biens" },
    { id: "name",  label: "Nom (A–Z)" },
  ];
  const visible = React.useMemo(() => {
    const arr = [...visibleRaw];
    if (mmSort === "count") arr.sort((a, b) => b.matches.length - a.matches.length);
    else if (mmSort === "name") arr.sort((a, b) => `${a.buyer.lastName} ${a.buyer.firstName}`.localeCompare(`${b.buyer.lastName} ${b.buyer.firstName}`, "fr"));
    else arr.sort((a, b) => b.topScore - a.topScore);
    return arr;
  }, [visibleRaw, mmSort]);
  const totalMatches = allGroups.reduce((s, g) => s + g.matches.length, 0);

  const openFocus = (g) => { setSel(g); window.setTimeout(() => setOpen(true), 24); };
  const back = () => { setOpen(false); window.setTimeout(() => setSel(null), 340); };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden" }}>
        <style>{`
          @keyframes mmToast { from { opacity:0; } to { opacity:1; } }
          @keyframes mmSpin { to { transform: rotate(360deg); } }
          @keyframes mmScrim { from { opacity:0; } to { opacity:1; } }
          @keyframes mmSheetUp { from { opacity:0; transform: translateY(40px); } to { opacity:1; transform: translateY(0); } }
          @keyframes mmGalFade { from { opacity:0; } to { opacity:1; } }
          .mmFilters::-webkit-scrollbar{display:none}
          .mmMain::-webkit-scrollbar{display:none}
        `}</style>

        {/* ── couche LISTE (parallaxe quand focus ouvert) ── */}
        <div style={{ height: "100%", display: "flex", flexDirection: "column", transition: "transform .34s cubic-bezier(.4,0,.2,1), filter .34s ease",
          transform: open ? "translateX(-22%)" : "none", filter: open ? "brightness(.96)" : "none" }}>
          <MmHeader onOpenSearch={() => setSearchOpen(true)} onOpenMenu={() => setScreenMenu(true)} />
          <main className="mmMain" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 20px", WebkitOverflowScrolling: "touch" }}>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Matching</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.inkSoft }}>{allGroups.length} acheteurs actifs</span>
            </div>

            {/* filtres */}
            <div className="mmFilters" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "16px -18px 0", padding: "2px 18px 4px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {MM_FILTERS.map((f) => {
                const on = f.id === filter;
                if (f.id !== "all" && f.id !== filter && !counts[f.id]) return null;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)} style={{
                    flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 999,
                    border: 0, cursor: "pointer", fontFamily: "inherit", background: on ? T.accent : T.card, boxShadow: on ? T.shadow : T.shadowSm, transition: "background .2s ease" }}>
                    <span style={{ fontSize: 13, fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? T.accentInk : T.ink, whiteSpace: "nowrap" }}>{f.label}</span>
                  </button>
                );
              })}
            </div>

            {/* liste */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {visible.map((g, i) => <MmBuyerCard key={g.buyer.id} group={g} i={i} hideVerdict onOpen={() => openFocus(g)} onMenu={setMenuGroup} />)}
              {visible.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 20px", color: T.muted, fontSize: 14, fontWeight: 600 }}>Aucun acheteur dans ce filtre.</div>
              )}
            </div>
          </main>
          <MmTabBar />
        </div>

        {/* ── couche FOCUS (glisse depuis la droite) ── */}
        {sel && (
          <div style={{ position: "absolute", inset: 0, zIndex: 30, transform: open ? "translateX(0)" : "translateX(100%)",
            transition: "transform .34s cubic-bezier(.4,0,.2,1)", boxShadow: open ? "-24px 0 60px rgba(15,23,42,0.18)" : "none" }}>
            <MmFocus group={sel} onBack={back} />
          </div>
        )}
        {screenMenu && window.SgActionMenu && (
          <window.SgActionMenu
            mode="sheet"
            dark={dark}
            pal={{ card: T.card, ink: T.ink, inkSoft: T.inkSoft, hair: T.hair, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.34)" }}
            items={[
              { id: "sort",        icon: "sort",     label: "Trier les acheteurs" },
              { id: "new-profile", icon: "searchplus",     label: "Nouveau profil de recherche" },
              { id: "settings",    icon: "sliders", label: "Réglages du matching" },
            ]}
            sheetStyle={{ margin: "0 10px 96px" }}
            onAction={handleScreenAction}
            onClose={() => setScreenMenu(false)}
          />
        )}
        {sortMenu && window.SgActionMenu && (
          <window.SgActionMenu
            mode="sheet"
            dark={dark}
            pal={{ card: T.card, ink: T.ink, inkSoft: T.inkSoft, hair: T.hair, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.34)" }}
            items={MM_SORTS.map((s) => ({ id: s.id, icon: mmSort === s.id ? "check" : "sort", label: s.label }))}
            sheetStyle={{ margin: "0 10px 96px" }}
            onAction={(id) => { setMmSort(id); setSortMenu(false); showMmToast(`Trié — ${(MM_SORTS.find((s) => s.id === id) || {}).label}`); }}
            onClose={() => setSortMenu(false)}
          />
        )}
        {menuGroup && window.SgActionMenu && (
          <window.SgActionMenu
            mode="sheet"
            title={`${menuGroup.buyer.firstName} ${menuGroup.buyer.lastName}`}
            subtitle={`${menuGroup.matches.length} bien${menuGroup.matches.length > 1 ? "s" : ""} en correspondance`}
            dark={dark}
            pal={{ card: T.card, ink: T.ink, inkSoft: T.inkSoft, hair: T.hair, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.34)" }}
            items={[
              { id: "contact", icon: "contact", label: "Voir le contact" },
              { id: "refine",  icon: "edit",   label: "Affiner les critères" },
              { id: "exclude", icon: "ban",    label: "Retirer de la liste", danger: true, divider: true },
            ]}
            sheetStyle={{ margin: "0 10px 96px" }}
            onAction={handleMatchAction}
            onClose={() => setMenuGroup(null)}
          />
        )}
        {confirmExclude && (
          <div style={{ position: "absolute", inset: 0, zIndex: 85, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={() => setConfirmExclude(null)} style={{ position: "absolute", inset: 0, background: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.34)", animation: "mmScrim .18s ease both" }}></div>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", margin: "0 10px 96px", background: T.card, borderRadius: 26, boxShadow: T.shadowLg, overflow: "hidden", padding: "22px 20px 18px", animation: "mmConfirm .26s cubic-bezier(.2,.9,.3,1.1) both" }}>
              <style>{`@keyframes mmConfirm{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Retirer de la liste&nbsp;?</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: T.inkSoft, marginTop: 6, lineHeight: 1.45 }}>
                <b style={{ fontWeight: 700, color: T.ink }}>{confirmExclude.firstName} {confirmExclude.lastName}</b> ne recevra plus de propositions issues de cette recherche.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmExclude(null)} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: T.ink, background: T.cardSubtle }}>Annuler</button>
                <button onClick={() => { const b = confirmExclude; setConfirmExclude(null); showMmToast(`${b.firstName} ${b.lastName} retiré de la liste`, true); }} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: "#fff", background: dark ? "#E0738C" : "#8E1F3D" }}>Retirer</button>
              </div>
            </div>
          </div>
        )}
        {mmToast && (
          <div style={{ position: "absolute", left: "50%", bottom: 100, transform: "translateX(-50%)", zIndex: 80, background: mmToastDanger ? (dark ? "#E0738C" : "#8E1F3D") : (dark ? "#ECEDF3" : "#0B0C0E"), color: mmToastDanger ? "#fff" : (dark ? "#0B0C0E" : "#fff"), fontSize: 13, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 12px 30px rgba(15,23,42,0.25)", whiteSpace: "nowrap" }}>{mmToast}</div>
        )}
        {searchOpen && window.MTCommand && <window.MTCommand dark={dark} onGo={onGo} onClose={() => setSearchOpen(false)} />}
        {settingsOpen && window.MmMatchingSettings && (
          <window.MmMatchingSettings
            dark={dark}
            onClose={() => setSettingsOpen(false)}
            onSaved={() => { setSettingsOpen(false); showMmToast("Réglages du matching enregistrés"); }}
          />
        )}
        {newSearchOpen && window.MmNewSearch && (
          <window.MmNewSearch
            dark={dark}
            onClose={() => setNewSearchOpen(false)}
            onCreate={(g) => {
              setExtraGroups((prev) => [g, ...prev.filter((x) => x.buyer.id !== g.buyer.id)]);
              setNewSearchOpen(false);
              setFilter("all");
              showMmToast(g.matches.length ? `${g.matches.length} bien${g.matches.length > 1 ? "s" : ""} trouvé${g.matches.length > 1 ? "s" : ""} pour ${g.buyer.firstName}` : `Recherche créée — aucun bien pour l'instant`);
            }}
          />
        )}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileMatchingScreen = MobileMatchingScreen;
Object.assign(window, { mmBuildGroups, mmCHF, mmBienPrice, MM_PHOTO,
  mmEngagement, mmInitials, mmBuyerType, mmCities, mmRooms, mmShort,
  MmRing, MmBienIcon, MmVerdict, MmChip, mmTone, mMatchLabel,
  MmBuyerCard, MmEditField, MmMatchCard, MmVerifiedBadge, mmTabOf, MM_AI_NOTES,
  MmGallery, mmBienPhotos, MmBienSheet });
