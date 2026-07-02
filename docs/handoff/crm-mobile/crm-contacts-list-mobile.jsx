// MEGGA CRM — Liste contacts MOBILE (Sugar Pure) + flux liste ↔ fiche.
// Écran « avant la fiche » : recherche, segments, regroupement « À relancer ».
// Réutilise window.* : MTCtx, MT_LIGHT/DARK, MT_STAGE, MEIcon, MAv,
//   CRM_CONTACTS, CRM_DEALS, MobileContactScreenV2.

const Cl_useMT = () => React.useContext(window.MTCtx);
const ClIcon = ({ name, size = 18, color = "currentColor", sw = 1.7 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

const CL_TYPE = { buyer: "Acheteur", seller: "Vendeur", tenant: "Locataire", landlord: "Propriétaire", mixed: "Mixte" };
const CL_STATUS = { lead: "Lead", qualified: "Qualifié", active: "Actif", archived: "Archivé" };
const CL_SOURCE = { website: "Site web", referral: "Recommandation", csv: "Import CSV", call: "Appel", "walk-in": "Agence", AI: "IA", vcard: "vCard" };
const clVille = (c) => (c.criteria && ((c.criteria.cities || [])[0] || (c.criteria.cantons || [])[0])) || null;

// ─── Badge vérifié KYC (sceau bleu officiel — identique à Matching mobile) ─
const CL_SEAL_D = "M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z";
const ClVerifiedBadge = ({ size = 16, seal = "#0041D9", check = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 19 19" style={{ flexShrink: 0, display: "block" }} aria-label="Vérifié">
    <circle cx="9.5" cy="9.5" r="5.6" fill={check} />
    <path d={CL_SEAL_D} fill={seal} fillRule="evenodd" clipRule="evenodd" />
  </svg>
);

// ─── Rangée contact ──────────────────────────────────────────────────────
const ClRow = ({ contact, relance, onOpen, onMenu }) => {
  const T = Cl_useMT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, paddingRight: 6 }}>
      <button onClick={() => onOpen(contact.id)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 16, border: 0, cursor: "pointer", background: "transparent", fontFamily: "inherit", textAlign: "left" }}>
        <window.MAv bg={contact.avatarBg || T.accent} ink="#fff" size={44}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</window.MAv>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.firstName} {contact.lastName}</span>
            {contact.kyc && contact.kyc.status === "verified" && <ClVerifiedBadge size={15} />}
          </div>
        </div>
        {relance && <ClIcon name="bolt" size={15} color={T.ink} sw={2} />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onMenu && onMenu(contact); }} aria-label="Actions" style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill={T.ghost} aria-hidden="true">
          <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
        </svg>
      </button>
    </div>
  );
};

// ─── Groupe (titre + card de rangées) ────────────────────────────────────
const ClGroup = ({ label, count, contacts, relanceSet, onOpen, onMenu }) => {
  const T = Cl_useMT();
  if (!contacts.length) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px", marginBottom: 9 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ background: T.card, borderRadius: 20, boxShadow: T.shadow, padding: 5 }}>
        {contacts.map((c, i) => (
          <div key={c.id}>
            {i > 0 && <div style={{ height: 1, background: T.hair, margin: "0 13px" }} />}
            <ClRow contact={c} relance={relanceSet.has(c.id)} onOpen={onOpen} onMenu={onMenu} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Barre d'onglets bas (app nav) ───────────────────────────────────────
const CL_NAV = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "layers" },
  { id: "contacts", label: "Contacts", icon: "user" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "more", label: "Plus", icon: "grip" },
];
const ClTabBar = () => {
  const T = Cl_useMT();
  return (
    <nav style={{ flexShrink: 0, display: "flex", justifyContent: "space-around", alignItems: "stretch", paddingTop: 9, paddingBottom: 28, paddingLeft: 6, paddingRight: 6, background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
      {CL_NAV.map(n => {
        const on = n.id === "contacts";
        return (
          <button key={n.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <ClIcon name={n.icon} size={22} color={on ? T.ink : T.ghost} sw={on ? 2.1 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? T.ink : T.muted, whiteSpace: "nowrap" }}>{n.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// ─── ÉCRAN LISTE ─────────────────────────────────────────────────────────
const CL_SEGMENTS = [
  { id: "all", label: "Tous" },
  { id: "buyer", label: "Acheteurs" },
  { id: "seller", label: "Vendeurs" },
  { id: "relance", label: "À relancer" },
];
const MobileContactsListScreen = ({ dark = false, onOpen = () => {}, onNew = () => {}, onBack }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const stageBg = dark ? "#111214" : "#E7EBF0";
  const Tx = { ...T, stage: stageBg };
  const contacts = window.CRM_CONTACTS || [];
  const [seg, setSeg] = React.useState("all");
  const [menuContact, setMenuContact] = React.useState(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [clToast, setClToast] = React.useState(null);
  const [clToastDanger, setClToastDanger] = React.useState(false);
  const clToastRef = React.useRef(null);
  const showClToast = (t, danger = false) => { setClToast(t); setClToastDanger(danger); clearTimeout(clToastRef.current); clToastRef.current = setTimeout(() => setClToast(null), 2200); };
  const handleContactAction = (id) => {
    const c = menuContact;
    setMenuContact(null);
    if (!c) return;
    if (id === "block") { setConfirmDel(c); return; }
    if (id === "call")  { try { window.open(`tel:${(c.phone || "").replace(/\s/g, "")}`); } catch (e) {} showClToast(`Appel · ${c.firstName} ${c.lastName}`); return; }
    if (id === "mail")  { try { window.open(`mailto:${c.email || ""}`); } catch (e) {} showClToast(`Email · ${c.firstName} ${c.lastName}`); return; }
    if (id === "deal")  { onOpen(c.id, "apercu"); return; }
    if (id === "kyc")   { onOpen(c.id, "docs"); return; }
  };

  // Relances « du jour » : sélection courte et actionnable (pas tout le pipeline)
  const relanceSet = React.useMemo(() => new Set(["c-001", "c-007", "c-006"]), []);

  const filtered = contacts.filter(c => {
    if (seg === "buyer") return c.type === "buyer";
    if (seg === "seller") return c.type === "seller";
    if (seg === "relance") return relanceSet.has(c.id);
    return true;
  });
  const relanceList = filtered.filter(c => relanceSet.has(c.id));
  const restList = filtered.filter(c => !relanceSet.has(c.id));

  return (
    <window.MTCtx.Provider value={Tx}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: Tx.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: Tx.ink, position: "relative" }}>
        <style>{`.clScroll::-webkit-scrollbar{display:none}.clScroll{scrollbar-width:none}@keyframes clUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>

        {/* Header */}
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 20, paddingRight: 20, paddingBottom: 4, display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button onClick={onBack} aria-label="Retour" style={{ width: 38, height: 38, borderRadius: 999, border: 0, cursor: "pointer", background: Tx.card, boxShadow: Tx.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <ClIcon name="arrow-left" size={19} color={Tx.ink} sw={2} />
            </button>
          )}
        </header>

        {/* Recherche + filtre */}
        <div style={{ flexShrink: 0, padding: "8px 16px 6px", display: "flex", gap: 9 }}>
          <div style={{ flex: 1, height: 44, borderRadius: 14, background: Tx.card, boxShadow: Tx.shadowSm, display: "flex", alignItems: "center", gap: 10, padding: "0 15px" }}>
            <ClIcon name="search" size={18} color={Tx.muted} sw={1.9} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: Tx.muted }}>Rechercher un contact…</span>
          </div>
          <button onClick={() => setFilterOpen(true)} style={{ width: 44, height: 44, borderRadius: 14, border: 0, cursor: "pointer", background: seg !== "all" ? Tx.accent : Tx.card, boxShadow: Tx.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <ClIcon name="filter" size={19} color={seg !== "all" ? Tx.accentInk : Tx.ink} sw={1.9} />
          </button>
        </div>

        {/* Segments */}
        <div className="clScroll" style={{ flexShrink: 0, display: "flex", gap: 8, overflowX: "auto", padding: "8px 16px 12px" }}>
          {CL_SEGMENTS.map(s => {
            const on = s.id === seg;
            return (
              <button key={s.id} onClick={() => setSeg(s.id)} style={{ flexShrink: 0, height: 34, padding: "0 16px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2, background: on ? Tx.accent : Tx.card, color: on ? Tx.accentInk : Tx.inkSoft, boxShadow: Tx.shadowSm, whiteSpace: "nowrap" }}>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Liste */}
        <main className="clScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 20, WebkitOverflowScrolling: "touch" }}>
          <div style={{ animation: "clUp .5s cubic-bezier(.2,.8,.2,1) both" }}>
            {seg === "all" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <ClGroup label="À relancer · aujourd'hui" contacts={relanceList} relanceSet={relanceSet} onOpen={onOpen} onMenu={setMenuContact} />
                <ClGroup label="Tous les contacts" contacts={restList} relanceSet={relanceSet} onOpen={onOpen} onMenu={setMenuContact} />
              </div>
            ) : (
              <ClGroup label={CL_SEGMENTS.find(s => s.id === seg).label} count={filtered.length} contacts={filtered} relanceSet={relanceSet} onOpen={onOpen} onMenu={setMenuContact} />
            )}
          </div>
        </main>

        {/* FAB nouveau contact */}
        <button onClick={onNew} title="Nouveau contact" style={{ position: "absolute", right: 18, bottom: 104, zIndex: 20, width: 58, height: 58, borderRadius: 20, border: 0, cursor: "pointer", background: Tx.accent, color: Tx.accentInk, boxShadow: Tx.shadowLg, display: "grid", placeItems: "center" }}>
          <ClIcon name="plus" size={24} color={Tx.accentInk} sw={2.3} />
        </button>

        <ClTabBar />
        {filterOpen && window.SgActionMenu && (
          <window.SgActionMenu
            mode="sheet"
            title="Filtrer les contacts"
            dark={dark}
            pal={{ card: Tx.card, ink: Tx.ink, inkSoft: Tx.inkSoft, hair: Tx.hair, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.32)" }}
            items={CL_SEGMENTS.map(s => ({ id: s.id, icon: s.id === "all" ? "users" : s.id === "relance" ? "clock" : "user", label: s.label, checked: s.id === seg }))}
            sheetStyle={{ margin: "0 14px 96px", borderRadius: 26 }}
            onAction={(id) => { setSeg(id); setFilterOpen(false); }}
            onClose={() => setFilterOpen(false)}
          />
        )}
        {menuContact && window.SgActionMenu && (
          <window.SgActionMenu
            mode="sheet"
            title={`${menuContact.firstName} ${menuContact.lastName}`}
            subtitle={CL_TYPE[menuContact.type] || "Contact"}
            dark={dark}
            pal={{ card: Tx.card, ink: Tx.ink, inkSoft: Tx.inkSoft, hair: Tx.hair, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.32)" }}
            items={[
              { id: "call", icon: "phone",   label: "Appeler" },
              { id: "mail", icon: "mail",    label: "Envoyer un email" },
              { id: "deal", icon: "plus",    label: "Nouvelle affaire" },
              { id: "kyc",  icon: "id",      label: "Voir le KYC" },
              { id: "block", icon: "trash",    label: "Supprimer le contact", danger: true, divider: true },
            ]}
            onAction={handleContactAction}
            onClose={() => setMenuContact(null)}
            sheetStyle={{ margin: "0 14px 96px", borderRadius: 26 }}
          />
        )}
        {clToast && (
          <div style={{ position: "absolute", left: "50%", bottom: 100, transform: "translateX(-50%)", zIndex: 50, background: clToastDanger ? "#8E1F3D" : (dark ? "#ECEDF3" : "#0B0C0E"), color: clToastDanger ? "#fff" : (dark ? "#0B0C0E" : "#fff"), fontSize: 13, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 12px 30px rgba(15,23,42,0.25)", whiteSpace: "nowrap" }}>{clToast}</div>
        )}
        {confirmDel && (
          <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={() => setConfirmDel(null)} style={{ position: "absolute", inset: 0, background: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.32)", animation: "clFade .18s ease both" }}></div>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", margin: "0 14px 96px", background: Tx.card, borderRadius: 26, boxShadow: Tx.shadowLg, overflow: "hidden", padding: "22px 20px 18px", animation: "clConfirm .26s cubic-bezier(.2,.9,.3,1.1) both" }}>
              <style>{`@keyframes clFade{from{opacity:0}to{opacity:1}}@keyframes clConfirm{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: Tx.ink }}>Supprimer ce contact&nbsp;?</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: Tx.inkSoft, marginTop: 6, lineHeight: 1.45 }}>
                <b style={{ fontWeight: 700, color: Tx.ink }}>{confirmDel.firstName} {confirmDel.lastName}</b> sera retiré de vos contacts.<br />Cette action est définitive.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: Tx.ink, background: Tx.cardSubtle }}>Annuler</button>
                <button onClick={() => { const c = confirmDel; setConfirmDel(null); showClToast(`${c.firstName} ${c.lastName} supprimé`, true); }} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: "#fff", background: dark ? "#E0738C" : "#8E1F3D" }}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </window.MTCtx.Provider>
  );
};

// ─── FLUX liste ↔ fiche ──────────────────────────────────────────────────
const MobileContactsFlow = ({ dark = false, onBack }) => {
  const [selected, setSelected] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <MobileContactsListScreen dark={dark} onOpen={(id, tab) => setSelected({ id, tab: tab || "apercu" })} onNew={() => setCreating(true)} onBack={onBack} />
      {selected && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30, animation: "clSlideIn .34s cubic-bezier(.2,.8,.2,1) both" }}>
          <style>{`@keyframes clSlideIn{from{transform:translateX(100%)}to{transform:none}}@keyframes clSlideUp{from{transform:translateY(100%)}to{transform:none}}`}</style>
          <window.MobileContactScreenV2 dark={dark} contactId={selected.id} initialTab={selected.tab} onBack={() => setSelected(null)} />
        </div>
      )}
      {creating && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, animation: "clSlideUp .34s cubic-bezier(.2,.8,.2,1) both" }}>
          <window.NcCreateScreen dark={dark} onClose={() => setCreating(false)} />
        </div>
      )}
    </div>
  );
};

window.MobileContactsListScreen = MobileContactsListScreen;
window.MobileContactsFlow = MobileContactsFlow;
