// ═══════════════════════════════════════════════════════════════════════
//  MEGGA CRM mobile — Feuille NOTIFICATIONS (écran « Plus » → cloche)
//  Base A (bottom sheet groupé par date) + esprit D (digest MEGGA AI en tête).
//  Sugar Pure, theme-aware. Réutilise window.MT_LIGHT/MT_DARK + window.MEIcon.
// ═══════════════════════════════════════════════════════════════════════

const MN_KIND = {
  kyc:    { label: "KYC",      icon: "shield",   c: "#C0392B" },
  offre:  { label: "Offre",    icon: "bolt",     c: "#C45A00" },
  doc:    { label: "Document", icon: "file",     c: "#059669" },
  visite: { label: "Visite",   icon: "calendar", c: "#0891B2" },
  mandat: { label: "Mandat",   icon: "file",     c: "#1E5BC6" },
  ai:     { label: "MEGGA AI", icon: "sparkle",  c: "#0B0C0E" },
  team:   { label: "Équipe",   icon: "users",    c: "#1B4A8E" },
  system: { label: "Système",  icon: "bell",     c: "#7A8088" },
};

const MN_DATA = [
  { id: "n1", kind: "kyc", read: false, group: "today", time: "Il y a 6 min", priority: true,
    title: "KYC à débloquer — Élodie Schmidt", body: "Pièce d'identité expirée, le dossier reste en attente.", cta: "Relancer le KYC", to: "matching" },
  { id: "n3", kind: "offre", read: false, group: "today", time: "Il y a 42 min", priority: true,
    title: "Offre de CHF 1'250'000 sur Cologny", body: "7 % sous le prix demandé. Réponse attendue sous 48 h.", cta: "Ouvrir le deal", to: "pipeline" },
  { id: "n6", kind: "doc", read: false, group: "today", time: "Il y a 1 h", priority: true,
    title: "Compromis Vionnet prêt à signer", body: "Le notaire a déposé la version finale.", cta: "Vérifier & signer", to: "agenda" },
  { id: "n2", kind: "visite", read: false, group: "today", time: "Il y a 2 h",
    title: "Marie Bertrand a confirmé la visite", body: "Demain 14:00 — rue de la Filature, Carouge.", cta: "Voir le créneau", to: "agenda" },
  { id: "n10", kind: "visite", read: false, group: "today", time: "Il y a 3 h",
    title: "Nouvelle demande de visite — Eaux-Vives", body: "Julien Favre souhaite visiter en fin de semaine.", cta: "Proposer un créneau", to: "agenda" },
  { id: "n11", kind: "team", read: true, group: "today", time: "Il y a 4 h",
    title: "Léa vous a assigné un lead acheteur", body: "Budget 1,2 M — recherche 4 pièces rive gauche.", cta: "Voir le lead", to: "contacts" },
  { id: "n5", kind: "mandat", read: false, group: "yesterday", time: "Hier · 17:42",
    title: "Mandat exclusif des Pâquis signé", body: "Le propriétaire a signé, le bien peut être publié.", cta: "Publier le bien", to: "biens" },
  { id: "n4", kind: "ai", read: true, group: "yesterday", time: "Hier · 15:10",
    title: "3 nouveaux leads pour Champel", body: "Trois recherches sauvegardées correspondent à votre bien.", cta: "Examiner", to: "matching" },
  { id: "n12", kind: "offre", read: true, group: "yesterday", time: "Hier · 09:28",
    title: "Contre-offre refusée sur Carouge", body: "L'acheteur n'a pas donné suite à la contre-offre.", cta: "Voir le deal", to: "pipeline" },
  { id: "n13", kind: "kyc", read: true, group: "yesterday", time: "Hier · 08:40",
    title: "KYC validé pour P. Nguyen", body: "Le dossier est complet, le deal peut avancer.", cta: "Voir le dossier", to: "contacts" },
  { id: "n8", kind: "system", read: true, group: "older", time: "Lun. · 08:30",
    title: "18 photos de Chêne-Bougeries validées C2PA", body: "Les photos sont signées et publiables.", cta: "Voir le bien", to: "biens" },
  { id: "n9", kind: "system", read: true, group: "older", time: "Dim. · 18:00",
    title: "Votre rapport hebdomadaire est prêt", body: "12 visites, 4 offres et 2 compromis cette semaine.", cta: "Voir le rapport", to: "today" },
];

const MN_GROUPS = [["today", "Aujourd'hui"], ["yesterday", "Hier"], ["older", "Plus tôt"]];

const MrNotifSheet = ({ dark = false, onClose, onGo }) => {
  const T = dark ? { ...window.MT_DARK } : { ...window.MT_LIGHT };
  const Me = window.MEIcon;
  const [items, setItems] = React.useState(() => MN_DATA.map((n) => ({ ...n })));
  const [closing, setClosing] = React.useState(false);

  const unread = items.filter((n) => !n.read).length;
  const priorities = items.filter((n) => n.priority && !n.read);

  const close = () => { setClosing(true); window.setTimeout(() => onClose && onClose(), 240); };
  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const open = (n) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.to && onGo) { close(); window.setTimeout(() => onGo(n.to), 250); }
  };

  const kindTint = (hex, a) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const row = (n) => {
    const k = MN_KIND[n.kind] || MN_KIND.system;
    const col = dark ? "#FFFFFF" : k.c;
    return (
      <button key={n.id} onClick={() => open(n)} style={{
        width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit",
        background: n.read ? "transparent" : T.card, borderRadius: 16,
        boxShadow: n.read ? "none" : T.shadowSm, padding: "13px 14px",
        display: "flex", gap: 12, alignItems: "flex-start", opacity: n.read ? 0.62 : 1,
        transition: "opacity .2s ease",
      }}>
        <span style={{ position: "relative", width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
          background: n.read ? T.cardSubtle : kindTint(k.c, dark ? 0.22 : 0.1) }}>
          <Me name={k.icon} size={19} color={col} strokeWidth={1.9} />
          {!n.read && <span style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: 999, background: k.c, boxShadow: `0 0 0 2.5px ${T.canvas.startsWith("radial") ? (dark ? "#121315" : "#EDEFF2") : T.card}` }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 14.5, fontWeight: n.read ? 700 : 800, letterSpacing: -0.3, color: T.ink, lineHeight: 1.3 }}>{n.title}</span>
          </span>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{n.body}</span>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.ghost, marginTop: 6, letterSpacing: -0.1 }}>{n.time}</span>
        </span>
      </button>
    );
  };

  return (
    <div onClick={close} style={{
      position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end",
      background: dark ? "rgba(0,0,0,0.62)" : "rgba(15,23,42,0.34)", backdropFilter: "blur(6px)",
      animation: `${closing ? "mnScrimOut" : "mnScrim"} .26s ease both`,
    }}>
      <style>{`
        @keyframes mnScrim{from{opacity:0}to{opacity:1}}
        @keyframes mnScrimOut{from{opacity:1}to{opacity:0}}
        @keyframes mnSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes mnSheetOut{from{transform:translateY(0)}to{transform:translateY(100%)}}
        @keyframes mnRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes mnBlobA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(14px,8px) scale(1.08)}}
        @keyframes mnBlobB{0%,100%{transform:translate(0,0) scale(1.04)}50%{transform:translate(-16px,10px) scale(1.1)}}
        .mnScroll::-webkit-scrollbar{display:none}
      `}</style>

      <div onClick={(e) => e.stopPropagation()} style={{
        background: dark ? "#0E0F11" : "#EDEFF2", borderRadius: "26px 26px 0 0", height: "88%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.3)",
        animation: `${closing ? "mnSheetOut" : "mnSheet"} .36s cubic-bezier(.2,.8,.2,1) both`,
      }}>
        {/* poignée + en-tête */}
        <div style={{ flexShrink: 0, padding: "12px 20px 6px" }}>
          <span style={{ display: "block", width: 40, height: 5, borderRadius: 999, background: T.ghost, opacity: 0.5, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: -0.7, color: T.ink }}>Notifications</h2>
            </div>
            {unread > 0 && (
              <button onClick={markAll} style={{ height: 36, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, color: T.inkSoft, background: T.card, boxShadow: T.shadowSm, display: "inline-flex", alignItems: "center", gap: 7 }}>
                Tout lire
              </button>
            )}
          </div>
        </div>

        <div className="mnScroll" style={{ flex: 1, overflowY: "auto", padding: "8px 16px 28px", WebkitOverflowScrolling: "touch" }}>
          {/* digest MEGGA AI — immersif */}
          {priorities.length > 0 && (
            <div style={{ position: "relative", overflow: "hidden", background: "#0B0C0E", borderRadius: 20, padding: "16px 17px 17px", boxShadow: "0 18px 44px rgba(11,12,14,0.4)", animation: "mnRise .4s cubic-bezier(.2,.8,.2,1) both" }}>
              {/* halos de marque */}
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: "-18%", top: "-40%", width: "70%", height: "120%", borderRadius: "50%", background: "radial-gradient(circle, #4F5BF2 0%, rgba(79,91,242,0) 70%)", filter: "blur(20px)", opacity: 0.5, animation: "mnBlobA 16s ease-in-out infinite" }} />
                <div style={{ position: "absolute", right: "-20%", top: "-30%", width: "66%", height: "120%", borderRadius: "50%", background: "radial-gradient(circle, #D24A9C 0%, rgba(210,74,156,0) 70%)", filter: "blur(20px)", opacity: 0.46, animation: "mnBlobB 19s ease-in-out infinite" }} />
              </div>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.14)" }}>
                    <Me name="sparkle" size={15} color="#FFFFFF" strokeWidth={1.8} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.82)" }}>L'essentiel</span>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, marginTop: 11 }}>
                  <b style={{ color: "#FFFFFF", fontWeight: 800 }}>{priorities.length} priorité{priorities.length > 1 ? "s" : ""}</b> à traiter aujourd'hui — KYC, offre et compromis demandent une action.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 13 }}>
                  {priorities.map((p) => {
                    const k = MN_KIND[p.kind] || MN_KIND.system;
                    return (
                      <button key={p.id} onClick={() => open(p)} style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit",
                        background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 11 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.1)" }}>
                          <Me name={k.icon} size={15} color="#FFFFFF" strokeWidth={1.9} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* liste groupée */}
          {MN_GROUPS.map(([g, label]) => {
            const list = items.filter((n) => n.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: T.muted, margin: "20px 4px 8px" }}>{label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.map(row)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

window.MrNotifSheet = MrNotifSheet;
Object.assign(window, { MN_KIND, MN_DATA });
