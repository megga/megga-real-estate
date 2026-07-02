// MEGGA CRM — Nouveau contact MOBILE (Sugar Pure) · outil de création en ligne
// Slide-in depuis le + de la liste. Inputs Sugar (ring noir au focus, pas de
// bordure), avatar live, type segmenté, assist IA. Réutilise window.* :
//   MTCtx, MT_LIGHT/DARK, MT_STAGE, MEIcon, MAv.

const Nc_useMT = () => React.useContext(window.MTCtx);
const NcIcon = ({ name, size = 18, color = "currentColor", sw = 1.8 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

// ─── Champ texte Sugar ───────────────────────────────────────────────────
const NcField = ({ label, value, onChange, placeholder, type = "text", icon, flex }) => {
  const T = Nc_useMT();
  const [foc, setFoc] = React.useState(false);
  return (
    <label style={{ display: "block", flex: flex || "auto", minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, height: 46, padding: "0 13px", borderRadius: 12, background: T.cardSubtle, boxShadow: foc ? `inset 0 0 0 2px ${T.ink}` : "none", transition: "box-shadow .14s ease" }}>
        {icon && <NcIcon name={icon} size={16} color={T.muted} sw={1.8} />}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : "text"} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.2, colorScheme: T.mode === "dark" ? "dark" : "light", fontVariantNumeric: type === "tel" ? "tabular-nums" : "normal" }} />
      </div>
    </label>
  );
};

// ─── Select Sugar ────────────────────────────────────────────────────────
const NcSelect = ({ label, value, onChange, options, flex }) => {
  const T = Nc_useMT();
  const [foc, setFoc] = React.useState(false);
  const chev = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237A8088' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9.5l6 6 6-6'/%3E%3C/svg%3E")`;
  return (
    <label style={{ display: "block", flex: flex || "auto", minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{ width: "100%", height: 46, padding: "0 32px 0 13px", borderRadius: 12, border: 0, outline: "none", appearance: "none", WebkitAppearance: "none", background: `${T.cardSubtle} ${chev} no-repeat right 11px center`, boxShadow: foc ? `inset 0 0 0 2px ${T.ink}` : "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.2, cursor: "pointer", transition: "box-shadow .14s ease" }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
};

// ─── Type segmenté ───────────────────────────────────────────────────────
const NC_TYPES = [{ v: "buyer", l: "Acheteur" }, { v: "seller", l: "Vendeur" }, { v: "tenant", l: "Locataire" }];
const NcTypeSeg = ({ value, onChange }) => {
  const T = Nc_useMT();
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>Type de contact</div>
      <div style={{ display: "flex", background: T.cardSubtle, borderRadius: 12, padding: 4, gap: 3 }}>
        {NC_TYPES.map(t => {
          const on = t.v === value;
          return (
            <button key={t.v} onClick={() => onChange(t.v)} style={{ flex: 1, height: 38, border: 0, cursor: "pointer", borderRadius: 9, fontFamily: "inherit", fontSize: 12.5, fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? T.accentInk : T.muted, background: on ? T.accent : "transparent", transition: "color .15s ease" }}>{t.l}</button>
          );
        })}
      </div>
    </div>
  );
};

const NcSectionLabel = ({ children }) => {
  const T = Nc_useMT();
  return <div style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase", padding: "0 2px", marginTop: 4 }}>{children}</div>;
};

// ─── Écran création ──────────────────────────────────────────────────────
const NcCreateScreen = ({ dark = false, onClose }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const stageBg = dark ? "#111214" : "#E7EBF0";
  const Tx = { ...T, stage: stageBg };
  const [d, setD] = React.useState({ firstName: "", lastName: "", type: "buyer", birth: "", phone: "", email: "", lang: "fr", source: "manual", city: "" });
  const [done, setDone] = React.useState(false);
  const [photo, setPhoto] = React.useState(null);
  const fileRef = React.useRef(null);
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const onPick = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setPhoto(r.result); r.readAsDataURL(f); };
  const initials = ((d.firstName[0] || "") + (d.lastName[0] || "")).toUpperCase() || "—";
  const valid = d.firstName.trim() && d.lastName.trim();

  return (
    <window.MTCtx.Provider value={Tx}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: Tx.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: Tx.ink, position: "relative", "--ncph": Tx.ghost }}>
        <style>{`.ncScroll::-webkit-scrollbar{display:none}.ncScroll{scrollbar-width:none}.ncScroll input::placeholder{color:var(--ncph);font-weight:600;opacity:1}@keyframes ncUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>

        {/* Header */}
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "transparent", position: "relative", zIndex: 8 }}>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: Tx.card, boxShadow: Tx.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <NcIcon name="close" size={19} color={Tx.ink} sw={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          </div>
          <div style={{ width: 40, flexShrink: 0 }} />
        </header>

        {done ? (
          <main className="ncScroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 26px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: "#059669", display: "grid", placeItems: "center", animation: "ncUp .4s cubic-bezier(.2,.8,.2,1) both" }}>
              <NcIcon name="check" size={30} color="#fff" sw={2.6} />
            </div>
            <h2 style={{ margin: "18px 0 0", fontSize: 22, fontWeight: 800, color: Tx.ink, letterSpacing: -0.5 }}>Contact créé</h2>
            <p style={{ margin: "7px 0 0", fontSize: 13.5, color: Tx.muted, fontWeight: 600, maxWidth: 250, lineHeight: 1.5 }}>{d.firstName} {d.lastName} a été ajouté. MEGGA AI lance le matching des biens.</p>
            <button onClick={onClose} style={{ marginTop: 22, height: 48, padding: "0 26px", borderRadius: 999, border: 0, cursor: "pointer", background: Tx.accent, color: Tx.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", gap: 9 }}>
              Ouvrir la fiche <NcIcon name="arrow-right" size={17} color={Tx.accentInk} sw={2} />
            </button>
          </main>
        ) : (
          <>
            <main className="ncScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 16, WebkitOverflowScrolling: "touch" }}>
              {/* Avatar live — import photo */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, animation: "ncUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
                <button onClick={() => fileRef.current && fileRef.current.click()} title="Importer une photo" style={{ position: "relative", width: 76, height: 76, borderRadius: 999, border: 0, padding: 0, cursor: "pointer", background: "transparent" }}>
                  {photo ? (
                    <img src={photo} alt="" style={{ width: 76, height: 76, borderRadius: 999, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: 76, height: 76, borderRadius: 999, background: valid ? "#0041D9" : Tx.ghost, color: "#fff", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>{initials}</div>
                  )}
                </button>
                <div style={{ fontSize: 13, fontWeight: 700, color: valid ? Tx.ink : Tx.muted, letterSpacing: -0.2 }}>{valid ? `${d.firstName} ${d.lastName}` : "Importer une photo"}</div>
              </div>

              {/* Identité */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "ncUp .45s cubic-bezier(.2,.8,.2,1) .08s both" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <NcField label="Prénom" value={d.firstName} onChange={v => set("firstName", v)} placeholder="Marie" flex={1} />
                  <NcField label="Nom" value={d.lastName} onChange={v => set("lastName", v)} placeholder="Bertrand" flex={1} />
                </div>
                <NcTypeSeg value={d.type} onChange={v => set("type", v)} />
                <NcField label="Date de naissance · utile pour le KYC" value={d.birth} onChange={v => set("birth", v)} type="date" icon="calendar" />
              </div>

              {/* Coordonnées */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "ncUp .45s cubic-bezier(.2,.8,.2,1) .12s both" }}>
                <NcField label="Téléphone" value={d.phone} onChange={v => set("phone", v)} placeholder="+41 79 000 00 00" type="tel" icon="phone" />
                <NcField label="E-mail" value={d.email} onChange={v => set("email", v)} placeholder="contact@email.ch" type="email" icon="mail" />
                <NcSelect label="Langue" value={d.lang} onChange={v => set("lang", v)} options={[{ v: "fr", l: "Français" }, { v: "en", l: "English" }, { v: "de", l: "Deutsch" }, { v: "it", l: "Italiano" }]} />
              </div>

              {/* Origine */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "ncUp .45s cubic-bezier(.2,.8,.2,1) .16s both" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <NcSelect label="Source" value={d.source} onChange={v => set("source", v)} flex={1} options={[{ v: "manual", l: "Saisie manuelle" }, { v: "website", l: "Site web" }, { v: "referral", l: "Recommandation" }, { v: "call", l: "Appel entrant" }, { v: "walk-in", l: "Visite agence" }]} />
                  <NcField label="Ville" value={d.city} onChange={v => set("city", v)} placeholder="Genève" flex={1} />
                </div>
              </div>
            </main>

            {/* Footer */}
            <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: Tx.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${Tx.hair}, 0 -8px 24px rgba(15,23,42,${Tx.mode === "dark" ? 0.3 : 0.05})` }}>
              <button onClick={onClose} style={{ height: 50, padding: "0 22px", borderRadius: 999, border: 0, cursor: "pointer", background: Tx.cardSubtle, color: Tx.inkSoft, fontFamily: "inherit", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>Annuler</button>
              <button disabled={!valid} onClick={() => valid && setDone(true)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: valid ? "pointer" : "default", background: valid ? Tx.accent : Tx.cardSubtle, color: valid ? Tx.accentInk : Tx.ghost, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, transition: "background .15s ease" }}>
                <NcIcon name="check" size={18} color={valid ? Tx.accentInk : Tx.ghost} sw={2.2} />Créer le contact
              </button>
            </div>
          </>
        )}
      </div>
    </window.MTCtx.Provider>
  );
};

window.NcCreateScreen = NcCreateScreen;
